import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { onRequest as coachPageRequest } from "../../functions/coach/[slug]";
import { onRequestPost as shopCheckoutRequest } from "../../functions/api/shop/checkout";
import { onRequest as shopWebhookRequest } from "../../functions/api/shop/razorpay-webhook";

const SHOP_WEBHOOK_SECRET = "local-shop-webhook-secret";
const SHOP_PAYMENT_PAGE_URL = "https://rzp.io/rzp/webb";

test.describe("shop payment publish flow", () => {
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
      shopSites.set(String(row.order_id), {
        ...shopSites.get(String(row.order_id)),
        ...row
      });
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
