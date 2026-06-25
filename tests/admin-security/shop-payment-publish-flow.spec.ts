import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { onRequest as coachPageRequest } from "../../functions/coach/[slug]";
import { onRequestPost as shopCheckoutRequest } from "../../functions/api/shop/checkout";
import { onRequestPost as shopRetryPublishRequest } from "../../functions/api/shop/retry-publish";
import { onRequest as shopWebhookRequest } from "../../functions/api/shop/razorpay-webhook";
import { saveShopDraft } from "../../lib/server/shop";

const SHOP_WEBHOOK_SECRET = "local-shop-webhook-secret";
const SHOP_PAYMENT_PAGE_URL = "https://rzp.io/rzp/webb";

test.describe("shop payment publish flow", () => {
  test("same normalized email reuses the active unpaid Shop draft", async () => {
    const harness = createShopPaymentDb();
    const env = {
      ADMIN_DB: harness.db,
      SHOP_PAYMENT_PAGE_URL,
      SHOP_RAZORPAY_WEBHOOK_SECRET: SHOP_WEBHOOK_SECRET
    };

    const first = await saveShopDraft({
      env,
      idempotencyKey: "same-email-draft-1",
      state: {
        coachEmail: "  raj@example.com ",
        coachName: "Raj First Draft",
        email: "RAJ@example.com",
        niche: "General wellness",
        shortBio: "Practical education-first wellness guidance."
      }
    });
    expect(first).toMatchObject({ ok: true });
    expect([...harness.shopSites.values()]).toHaveLength(1);
    expect([...harness.shopSites.values()][0]).toMatchObject({
      coach_email: "raj@example.com",
      payment_status: "draft",
      site_status: "draft"
    });
    await expect(
      (harness.db as { prepare: (sql: string) => { bind: (...values: unknown[]) => { first: <T>() => Promise<T | null> } } })
        .prepare(
          `SELECT * FROM shop_sites
           WHERE lower(coach_email) = ?1
             AND payment_status = 'draft'
             AND site_status = 'draft'
             AND locked_at IS NULL
           ORDER BY updated_at DESC
           LIMIT 1`
        )
        .bind("raj@example.com")
        .first()
    ).resolves.toBeTruthy();

    const second = await saveShopDraft({
      env,
      idempotencyKey: "same-email-draft-2",
      state: {
        coachEmail: "raj@example.com",
        coachName: "Raj Updated Draft",
        email: "raj@example.com",
        niche: "Gut health",
        shortBio: "Updated practical wellness guidance."
      }
    });
    expect(second).toMatchObject({ ok: true });
    expect(second.order?.orderId).toBe(first.order?.orderId);
    expect(second.accessKey).toBe(first.accessKey);
    expect([...harness.shopSites.values()]).toHaveLength(1);
    expect([...harness.shopSites.values()][0]).toMatchObject({
      coach_email: "raj@example.com",
      coach_name: "Raj Updated Draft",
      niche: "Gut health",
      payment_status: "draft",
      site_status: "draft"
    });
  });

  test("same normalized email reuses recoverable pending or failed unpaid Shop drafts", async () => {
    const harness = createShopPaymentDb();
    const env = {
      ADMIN_DB: harness.db,
      SHOP_PAYMENT_PAGE_URL,
      SHOP_RAZORPAY_WEBHOOK_SECRET: SHOP_WEBHOOK_SECRET
    };

    const first = await saveShopDraft({
      env,
      idempotencyKey: "same-email-pending-1",
      state: {
        coachEmail: "resume@example.com",
        coachName: "Resume First Draft",
        email: "resume@example.com",
        niche: "Sleep wellness",
        shortBio: "Practical education-first sleep guidance."
      }
    });
    expect(first).toMatchObject({ ok: true });
    const orderId = first.order?.orderId || "";
    expect(orderId).toBeTruthy();

    Object.assign(harness.shopSites.get(orderId) || {}, {
      payment_status: "pending_payment",
      site_status: "pending_payment",
      updated_at: nowSeconds() + 1
    });

    const resumedPending = await saveShopDraft({
      env,
      idempotencyKey: "same-email-pending-2",
      state: {
        coachEmail: "resume@example.com",
        coachName: "Resume Pending Draft",
        email: "resume@example.com",
        niche: "Gut health",
        shortBio: "Updated draft before checkout completion."
      }
    });
    expect(resumedPending).toMatchObject({ ok: true });
    expect(resumedPending.order?.orderId).toBe(orderId);
    expect(harness.shopSites.get(orderId)).toMatchObject({
      coach_name: "Resume Pending Draft",
      niche: "Gut health",
      payment_status: "pending_payment",
      site_status: "pending_payment"
    });

    Object.assign(harness.shopSites.get(orderId) || {}, {
      payment_status: "payment_failed",
      site_status: "payment_failed",
      updated_at: nowSeconds() + 2
    });

    const resumedFailed = await saveShopDraft({
      env,
      idempotencyKey: "same-email-pending-3",
      state: {
        coachEmail: "RESUME@example.com",
        coachName: "Resume Failed Draft",
        email: "resume@example.com",
        niche: "Fitness",
        shortBio: "Updated draft after a failed payment attempt."
      }
    });
    expect(resumedFailed).toMatchObject({ ok: true });
    expect(resumedFailed.order?.orderId).toBe(orderId);
    expect([...harness.shopSites.values()]).toHaveLength(1);
    expect(harness.shopSites.get(orderId)).toMatchObject({
      coach_email: "resume@example.com",
      coach_name: "Resume Failed Draft",
      niche: "Fitness",
      payment_status: "payment_failed",
      site_status: "payment_failed"
    });
  });

  test("paid publish-failed Shop order can be edited and retried only with secure access key", async () => {
    const harness = createShopPaymentDb();
    const env = {
      ADMIN_DB: harness.db,
      SHOP_PAYMENT_PAGE_URL,
      SHOP_RAZORPAY_WEBHOOK_SECRET: SHOP_WEBHOOK_SECRET
    };

    const first = await saveShopDraft({
      env,
      idempotencyKey: "publish-failed-recovery-1",
      state: {
        coachEmail: "paid-failed@example.com",
        coachName: "Paid Failed Draft",
        coachPhone: "+919876543210",
        contactLink: "https://forms.gle/paidFailed",
        email: "paid-failed@example.com",
        niche: "General wellness",
        shortBio: "Original paid publish failed draft."
      }
    });
    expect(first).toMatchObject({ ok: true });
    const orderId = first.order?.orderId || "";
    const accessKey = first.accessKey || "";
    expect(orderId).toBeTruthy();
    expect(accessKey).toBeTruthy();

    Object.assign(harness.shopSites.get(orderId) || {}, {
      issue_status: "Publish failed after payment verification.",
      payment_status: "paid",
      site_status: "publish_failed",
      updated_at: nowSeconds() + 1,
      workflow_stage: "publish_failed"
    });

    const blockedSave = await saveShopDraft({
      env,
      idempotencyKey: "publish-failed-recovery-blocked",
      state: {
        coachEmail: "paid-failed@example.com",
        coachName: "Blocked Recovery Attempt",
        coachPhone: "+919876543210",
        contactLink: "https://forms.gle/blocked",
        email: "paid-failed@example.com",
        niche: "Gut health",
        orderId,
        shortBio: "This should not save without the secure access key.",
        status: "publish_failed"
      }
    });
    expect(blockedSave).toMatchObject({
      ok: false,
      error: "Use the secure resume link for this paid website before saving publish-failure fixes."
    });

    const saved = await saveShopDraft({
      accessKey,
      env,
      idempotencyKey: "publish-failed-recovery-saved",
      state: {
        coachEmail: "paid-failed@example.com",
        coachName: "Recovered Paid Coach",
        coachPhone: "+919876543210",
        contactLink: "https://forms.gle/recoveredPaid",
        email: "paid-failed@example.com",
        niche: "Sleep wellness",
        orderId,
        shortBio: "Saved fixes after payment without another checkout.",
        slug: "recovered-paid-coach",
        status: "publish_failed"
      }
    });
    expect(saved).toMatchObject({ ok: true });
    expect(saved.order?.orderId).toBe(orderId);
    expect(harness.shopSites.get(orderId)).toMatchObject({
      coach_name: "Recovered Paid Coach",
      contact_link: "https://forms.gle/recoveredPaid",
      payment_status: "paid",
      site_status: "publish_failed",
      workflow_stage: "publish_failed_draft_saved"
    });

    const wrongRetry = await shopRetryPublishRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/shop/retry-publish", {
        accessKey: "wrong-access-key",
        orderId
      })
    });
    expect(wrongRetry.status).toBe(403);

    const retry = await shopRetryPublishRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/shop/retry-publish", {
        accessKey,
        orderId
      })
    });
    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toMatchObject({
      ok: true,
      order: {
        orderId,
        paymentStatus: "published",
        siteStatus: "published"
      }
    });
    expect(harness.shopSites.get(orderId)).toMatchObject({
      payment_status: "published",
      public_url: "/coach/recovered-paid-coach",
      site_status: "published",
      workflow_stage: "published_verified"
    });
    expect([...harness.coachSites.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coach_name: "Recovered Paid Coach",
          google_form_url: "https://forms.gle/recoveredPaid",
          slug: "recovered-paid-coach",
          status: "published"
        })
      ])
    );
  });

  test("signed Razorpay webhook publishes the matching Shop order only", async () => {
    const harness = createShopPaymentDb();
    const env = {
      ADMIN_DB: harness.db,
      SHOP_PAYMENT_PAGE_URL,
      SHOP_RAZORPAY_WEBHOOK_SECRET: SHOP_WEBHOOK_SECRET
    };

    const checkout = await shopCheckoutRequest({
      env,
      request: jsonRequest("https://ywcoach.com/api/shop/checkout", {
        idempotencyKey: "shop-payment-flow-ok",
        state: {
          coachEmail: "raj@example.com",
          coachName: "Raj Shamani Payment QA",
          coachPhone: "+919876543210",
          contactLink: "https://forms.gle/rajPaymentQa",
          email: "raj@example.com",
          heroMediaType: "none",
          niche: "Metabolic wellness",
          shortBio: "Practical wellness coach helping clients build daily habits."
        }
      })
    });
    expect(checkout.status).toBe(200);
    const checkoutBody = await checkout.json();
    expect(checkoutBody).toMatchObject({ ok: true });
    expect(checkoutBody.redirectUrl).toContain("shop_order_id=");
    expect(checkoutBody.redirectUrl).toContain("source=ywcoach_shop");
    const orderId = checkoutBody.order.orderId as string;

    const webhookPayload = createRazorpayPayload({
      email: "raj@example.com",
      orderId,
      paymentId: "pay_testPublished01",
      phone: "+919876543210"
    });
    const webhook = await shopWebhookRequest({
      env,
      request: signedWebhookRequest(webhookPayload)
    });
    expect(webhook.status).toBe(200);
    await expect(webhook.json()).resolves.toMatchObject({
      ok: true,
      published: true,
      reason: "verified"
    });

    const publishedOrder = harness.shopSites.get(orderId);
    expect(publishedOrder).toMatchObject({
      payment_reference: "pay_testPublished01",
      payment_status: "published",
      site_status: "published",
      workflow_stage: "published_verified"
    });

    const publicSite = [...harness.coachSites.values()].find(
      (site) => site.slug === "raj-shamani-payment-qa"
    );
    expect(publicSite).toBeTruthy();
    expect(publicSite).toMatchObject({
      coach_name: "Raj Shamani Payment QA",
      google_form_url: "https://forms.gle/rajPaymentQa",
      selected_theme_id: "canonical-coach-site-template",
      status: "published"
    });

    const publicPage = await coachPageRequest({
      env,
      params: { slug: "raj-shamani-payment-qa" },
      request: new Request("https://ywcoach.com/coach/raj-shamani-payment-qa")
    });
    expect(publicPage.status).toBe(200);
    const html = await publicPage.text();
    expect(html).toContain("YW Nutritech</strong><small>Coach Circle</small>");
    expect(html).toContain("circle-marquee");
    expect(html).toContain("Raj Shamani Payment QA");
    expect(html).toContain("https://forms.gle/rajPaymentQa");

    const unmatchedPayload = createRazorpayPayload({
      email: "wrong@example.com",
      paymentId: "pay_testUnmatched01",
      phone: "+910000000000"
    });
    const unmatchedWebhook = await shopWebhookRequest({
      env,
      request: signedWebhookRequest(unmatchedPayload)
    });
    expect(unmatchedWebhook.status).toBe(200);
    await expect(unmatchedWebhook.json()).resolves.toMatchObject({
      acceptedForManualReview: true,
      ok: true
    });
    expect(harness.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coach_email: "wrong@example.com",
          stage: "webhook_order_match"
        })
      ])
    );
    expect([...harness.shopSites.values()].filter((site) => site.payment_reference === "pay_testUnmatched01")).toHaveLength(0);
  });
});

function createRazorpayPayload({
  email,
  orderId = "",
  paymentId,
  phone
}: {
  email: string;
  orderId?: string;
  paymentId: string;
  phone: string;
}) {
  return {
    event: "payment.captured",
    id: `evt_${paymentId}`,
    payload: {
      payment: {
        entity: {
          captured: true,
          contact: phone,
          email,
          id: paymentId,
          notes: orderId
            ? {
                shop_order_id: orderId
              }
            : {
                source: "ywcoach_shop"
              },
          status: "captured"
        }
      }
    }
  };
}

function signedWebhookRequest(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", SHOP_WEBHOOK_SECRET).update(body).digest("hex");
  return new Request("https://ywcoach.com/api/shop/razorpay-webhook", {
    body,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature
    },
    method: "POST"
  });
}

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1"
    },
    method: "POST"
  });
}

function createShopPaymentDb() {
  type ShopRow = Record<string, unknown>;
  type CoachRow = Record<string, unknown>;
  type FailureRow = Record<string, unknown>;

  const shopSites = new Map<string, ShopRow>();
  const coachSites = new Map<string, CoachRow>();
  const failures: FailureRow[] = [];
  const settings = new Map<string, Record<string, unknown>>();

  const db = {
    prepare(statement: string) {
      const sql = normalizeSql(statement);
      let values: unknown[] = [];
      return {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return this;
        },
        async run() {
          runStatement(sql, values);
          return { success: true };
        },
        async first<T>() {
          return firstStatement(sql, values) as T | null;
        },
        async all<T>() {
          return { results: allStatement(sql, values) as T[] };
        }
      };
    }
  };

  function runStatement(sql: string, values: unknown[]) {
    if (
      sql.startsWith("create ") ||
      sql.startsWith("alter table") ||
      sql.startsWith("create index")
    ) {
      return;
    }

    if (sql.startsWith("insert into shop_payment_settings")) {
      settings.set(String(values[0]), {
        active: values[4] ?? 1,
        id: values[0],
        package_label: values[3] || "Premium coach website",
        payment_page_url: values[1],
        provider_label: values[2] || "Razorpay",
        updated_at: values[5] || values[2] || nowSeconds(),
        updated_by: values[6] || "initial_shop_seed"
      });
      return;
    }

    if (sql.startsWith("insert into shop_payment_settings_audit")) return;

    if (sql.startsWith("insert into shop_sites")) {
      const row = toShopRow(values);
      const existing = shopSites.get(String(row.order_id));
      shopSites.set(
        String(row.order_id),
        existing
          ? {
              ...existing,
              ...row,
              client_access_key: existing.client_access_key || row.client_access_key,
              locked_at: existing.locked_at ?? row.locked_at,
              payment_status: existing.payment_status,
              site_status: existing.site_status,
              workflow_stage:
                existing.site_status === "publish_failed"
                  ? "publish_failed_draft_saved"
                  : row.workflow_stage
            }
          : row
      );
      return;
    }

    if (sql.startsWith("update shop_sites set payment_status = 'pending_payment'")) {
      const orderId = String(values[2]);
      const existing = shopSites.get(orderId);
      if (existing) {
        Object.assign(existing, {
          payment_status: "pending_payment",
          payment_url_snapshot: values[0],
          site_status: "pending_payment",
          updated_at: values[1],
          workflow_stage: "redirected_to_checkout"
        });
      }
      return;
    }

    if (sql.startsWith("update shop_sites set payment_status = 'paid'")) {
      const orderId = String(values[1]);
      const existing = shopSites.get(orderId);
      if (existing) {
        Object.assign(existing, {
          issue_status: "",
          payment_date: existing.payment_date || values[0],
          payment_reference: existing.payment_reference || values[2],
          payment_status: "paid",
          site_status: "publishing",
          updated_at: values[0],
          workflow_stage: "payment_verified"
        });
      }
      return;
    }

    if (sql.startsWith("update shop_sites set site_status = 'publishing'")) {
      const orderId = String(values[1]);
      const existing = shopSites.get(orderId);
      if (existing) {
        Object.assign(existing, {
          issue_status: "",
          site_status: "publishing",
          updated_at: values[0],
          workflow_stage: "admin_retry_publish"
        });
      }
      return;
    }

    if (
      sql.startsWith("update shop_sites set site_status = 'published', payment_status = 'published'")
    ) {
      const orderId = String(values[2]);
      const existing = shopSites.get(orderId);
      if (existing) {
        Object.assign(existing, {
          locked_at: values[1],
          payment_status: "published",
          public_url: values[0],
          published_at: values[1],
          site_status: "published",
          updated_at: values[1],
          workflow_stage: "published_verified"
        });
      }
      return;
    }

    if (sql.startsWith("insert into coach_sites")) {
      const row = toCoachRow(values);
      coachSites.set(String(row.id), {
        ...coachSites.get(String(row.id)),
        ...row
      });
      return;
    }

    if (sql.startsWith("insert into shop_failures")) {
      failures.push({
        coach_email: values[3],
        coach_name: values[2],
        created_at: values[7],
        id: values[0],
        message: values[6],
        order_id: values[1],
        recovery_status: "needs_review",
        severity: values[4],
        stage: values[5]
      });
    }
  }

  function firstStatement(sql: string, values: unknown[]) {
    if (sql.includes("from shop_payment_settings")) {
      if (sql.startsWith("select id ")) return settings.has(String(values[0])) ? { id: values[0] } : null;
      return settings.get(String(values[0])) || null;
    }

    if (sql.includes("from shop_sites where idempotency_key")) {
      return (
        [...shopSites.values()].find((row) => row.idempotency_key === values[0]) || null
      );
    }

    if (sql.includes("from shop_sites") && sql.includes("lower(coach_email)")) {
      const email = String(values[0]).toLowerCase();
      return (
        [...shopSites.values()]
          .filter(
            (row) =>
              String(row.coach_email).toLowerCase() === email &&
              isRecoverableUnpaidDraftRow(row) &&
              !row.locked_at
          )
          .sort((left, right) => Number(right.updated_at || 0) - Number(left.updated_at || 0))[0] || null
      );
    }

    if (sql.includes("from shop_sites where slug")) {
      const row = [...shopSites.values()].find((item) => item.slug === values[0]);
      return row ? { order_id: row.order_id, slug: row.slug } : null;
    }

    if (sql.includes("select client_access_key from shop_sites")) {
      const row = shopSites.get(String(values[0]));
      return row ? { client_access_key: row.client_access_key } : null;
    }

    if (sql.includes("from shop_sites where order_id =")) {
      return shopSites.get(String(values[0])) || null;
    }

    if (sql.includes("from shop_sites where payment_reference")) {
      return (
        [...shopSites.values()].find(
          (row) => row.payment_reference === values[0] && row.order_id !== values[1]
        ) || null
      );
    }

    if (sql.includes("from coach_sites where slug =")) {
      const row = [...coachSites.values()].find((item) => item.slug === values[0]);
      if (!row) return null;
      if (sql.includes("status in") && !["published", "paused"].includes(String(row.status))) return null;
      if (sql.startsWith("select slug")) return { slug: row.slug };
      if (sql.startsWith("select id ")) return { id: row.id };
      return row;
    }

    if (sql.includes("from coach_sites where status <> 'removed' and lower(coach_name)")) {
      const name = String(values[0]).toLowerCase();
      const row = [...coachSites.values()].find(
        (item) => item.status !== "removed" && String(item.coach_name).toLowerCase() === name
      );
      return row ? { coach_name: row.coach_name } : null;
    }

    if (sql.includes("from coach_sites where id = ?1 or slug = ?2")) {
      const row = [...coachSites.values()].find(
        (item) => item.id === values[0] || item.slug === values[1]
      );
      return row
        ? {
            archived_at: row.archived_at,
            coach_id: row.coach_id,
            created_at: row.created_at,
            created_by: row.created_by,
            id: row.id,
            published_at: row.published_at
          }
        : null;
    }

    if (sql.includes("from coach_sites where id =")) {
      return coachSites.get(String(values[0])) || null;
    }

    return null;
  }

  function allStatement(sql: string, values: unknown[]) {
    if (sql.includes("from shop_sites") && sql.includes("payment_status = 'pending_payment'")) {
      const excludedOrderId = sql.includes("order_id <>") ? String(values[0]) : "";
      return [...shopSites.values()].filter(
        (row) =>
          row.payment_status === "pending_payment" &&
          row.site_status === "pending_payment" &&
          (!excludedOrderId || row.order_id !== excludedOrderId)
      );
    }

    if (sql.includes("from coach_sites") && sql.includes("status <> 'removed'")) {
      return [...coachSites.values()].filter((row) => row.status !== "removed");
    }

    if (sql.includes("from shop_sites order by")) return [...shopSites.values()];
    if (sql.includes("from shop_failures")) return failures;
    if (sql.includes("from shop_payment_settings_audit")) return [];

    return [];
  }

  return {
    coachSites,
    db: db as never,
    failures,
    shopSites
  };
}

function isRecoverableUnpaidDraftRow(row: Record<string, unknown>) {
  const paymentStatus = String(row.payment_status || "");
  const siteStatus = String(row.site_status || "");
  const editableStatuses = ["draft", "incomplete", "payment_failed"];
  return (
    (editableStatuses.includes(paymentStatus) && editableStatuses.includes(siteStatus)) ||
    (paymentStatus === "pending_payment" && siteStatus === "pending_payment")
  );
}

function toShopRow(values: unknown[]) {
  return {
    builder_json: values[14],
    client_access_key: values[12],
    coach_email: values[4],
    coach_name: values[3],
    coach_phone: values[5],
    contact_link: values[11],
    content_json: values[13],
    created_at: values[15],
    id: values[0],
    idempotency_key: values[2],
    issue_status: "",
    location: values[7],
    locked_at: null,
    niche: values[6],
    order_id: values[1],
    payment_date: null,
    payment_reference: "",
    payment_status: "draft",
    payment_url_snapshot: "",
    public_url: values[9],
    published_at: null,
    retry_count: 0,
    selected_theme_id: values[10],
    site_status: "draft",
    slug: values[8],
    source: "shop_purchased",
    updated_at: values[15],
    workflow_stage: "draft_saved"
  };
}

function toCoachRow(values: unknown[]) {
  return {
    analytics_json: values[24],
    archived_at: values[28],
    bio: values[7],
    coach_email: values[9],
    coach_id: values[1],
    coach_name: values[2],
    coach_phone: values[10],
    content_json: values[23],
    created_at: values[25],
    created_by: values[29],
    existing_paid_funnel_url: values[15],
    google_form_url: values[16],
    hero_media_type: values[17],
    id: values[0],
    location: values[6],
    logo_url: values[13],
    niche: values[5],
    paid_funnel_context: values[21],
    photo_url: values[12],
    published_at: values[27],
    public_url: values[18],
    register_button_text: values[19],
    selected_theme_id: values[20],
    slug: values[3],
    status: values[4],
    support_text: values[22],
    updated_at: values[26],
    updated_by: values[30],
    video_url: values[14],
    vision: values[8],
    whatsapp_link: values[11]
  };
}

function normalizeSql(statement: string) {
  return statement.replace(/\s+/g, " ").trim().toLowerCase();
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
