import type { D1Database } from "@cloudflare/workers-types";
import {
  buildCoachSiteFromShopState,
  normalizeShopBuilderState,
  validateShopBuilderState,
  validateShopDraftContactFields,
  type ShopBuilderState,
  type ShopBuilderStatus
} from "../shop-builder";
import { type CoachSiteStatus, normalizeCoachSlug } from "../admin-coach-sites";
import { getCoachSiteBySlugFromDb, upsertCoachSiteToDb } from "./coach-site-storage";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";
import { recordAdminAuditEvent } from "./admin-audit";

export type ShopEnv = {
  ADMIN_DB?: D1Database;
  SHOP_RAZORPAY_WEBHOOK_SECRET?: string;
  SHOP_PAYMENT_PAGE_URL?: string;
};

export type ShopPaymentSettings = {
  active: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string;
  packageLabel: string;
  paymentPageUrl: string;
  providerLabel: string;
  storageSource: "d1_table" | "env_fallback" | "unavailable";
};

export type ShopSiteRecord = {
  coachEmail: string;
  coachName: string;
  coachPhone: string;
  contactLink: string;
  contentSummary: string;
  createdAt: string;
  id: string;
  issueStatus: string;
  location: string;
  lockedAt: string | null;
  niche: string;
  orderId: string;
  paymentDate: string | null;
  paymentReference: string;
  paymentStatus: ShopBuilderStatus;
  publicUrl: string;
  publishedAt: string | null;
  retryCount: number;
  selectedThemeId: string;
  siteStatus: ShopBuilderStatus;
  slug: string;
  source: "shop_purchased";
  updatedAt: string;
  workflowStage: string;
  state: ShopBuilderState;
};

export type ShopFailureRecord = {
  coachEmail: string;
  coachName: string;
  createdAt: string;
  id: string;
  message: string;
  orderId: string;
  recoveryStatus: string;
  severity: "critical" | "high" | "medium" | "low";
  stage: string;
};

export type ShopPaymentAuditRecord = {
  action: string;
  adminEmail: string;
  createdAt: string;
  id: string;
  newUrlSummary: string;
  oldUrlSummary: string;
  packageLabel: string;
  providerLabel: string;
  active: boolean;
};

export type ShopAdminSnapshot = {
  audits: ShopPaymentAuditRecord[];
  failures: ShopFailureRecord[];
  paymentSettings: ShopPaymentSettings;
  reports: {
    analyticsSummaryCount: number;
    failureCount: number;
    paymentSettingsAuditCount: number;
    purchaseCount: number;
    siteCount: number;
  };
  sites: ShopSiteRecord[];
};

export type ShopBackupSections = Awaited<ReturnType<typeof getShopBackupSections>>;

const SHOP_SETTINGS_ID = "shop-payment-settings";
const shopSchemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();

const SHOP_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS shop_sites (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE,
    coach_name TEXT NOT NULL DEFAULT '',
    coach_email TEXT NOT NULL DEFAULT '',
    coach_phone TEXT NOT NULL DEFAULT '',
    niche TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL UNIQUE,
    client_access_key TEXT NOT NULL DEFAULT '',
    public_url TEXT NOT NULL DEFAULT '',
    selected_theme_id TEXT NOT NULL DEFAULT 'canonical-coach-site-template',
    contact_link TEXT NOT NULL DEFAULT '',
    payment_status TEXT NOT NULL DEFAULT 'draft',
    site_status TEXT NOT NULL DEFAULT 'draft',
    workflow_stage TEXT NOT NULL DEFAULT 'draft',
    issue_status TEXT NOT NULL DEFAULT '',
    content_json TEXT NOT NULL DEFAULT '{}',
    builder_json TEXT NOT NULL DEFAULT '{}',
    payment_url_snapshot TEXT NOT NULL DEFAULT '',
    payment_reference TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'shop_purchased',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    payment_date INTEGER,
    published_at INTEGER,
    locked_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shop_sites_created_at ON shop_sites (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_shop_sites_status ON shop_sites (payment_status, site_status)`,
  `CREATE INDEX IF NOT EXISTS idx_shop_sites_draft_email
    ON shop_sites (coach_email, payment_status, site_status, updated_at DESC)`,
  `ALTER TABLE shop_sites ADD COLUMN client_access_key TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE shop_sites ADD COLUMN payment_reference TEXT NOT NULL DEFAULT ''`,
  `CREATE INDEX IF NOT EXISTS idx_shop_sites_payment_reference ON shop_sites (payment_reference)`,
  `CREATE TABLE IF NOT EXISTS shop_payment_settings (
    id TEXT PRIMARY KEY,
    payment_page_url TEXT NOT NULL DEFAULT '',
    provider_label TEXT NOT NULL DEFAULT '',
    package_label TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS shop_payment_settings_audit (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    old_url_summary TEXT NOT NULL DEFAULT '',
    new_url_summary TEXT NOT NULL DEFAULT '',
    provider_label TEXT NOT NULL DEFAULT '',
    package_label TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    admin_email TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shop_payment_settings_audit_created_at
    ON shop_payment_settings_audit (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS shop_failures (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL DEFAULT '',
    coach_name TEXT NOT NULL DEFAULT '',
    coach_email TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium',
    stage TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    recovery_status TEXT NOT NULL DEFAULT 'needs_review',
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shop_failures_created_at ON shop_failures (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_shop_failures_stage_created_at
    ON shop_failures (stage, created_at DESC)`
];

type ShopSiteRow = {
  builder_json: string;
  client_access_key?: string;
  coach_email: string;
  coach_name: string;
  coach_phone: string;
  contact_link: string;
  content_json: string;
  created_at: number | string;
  id: string;
  issue_status: string;
  location: string;
  locked_at: number | string | null;
  niche: string;
  order_id: string;
  payment_date: number | string | null;
  payment_reference?: string;
  payment_status: ShopBuilderStatus;
  public_url: string;
  published_at: number | string | null;
  retry_count: number | string;
  selected_theme_id: string;
  site_status: ShopBuilderStatus;
  slug: string;
  updated_at: number | string;
  workflow_stage: string;
};

type ShopSettingsRow = {
  active: number | string;
  package_label: string;
  payment_page_url: string;
  provider_label: string;
  updated_at: number | string;
  updated_by: string;
};

type ShopAuditRow = {
  action: string;
  active: number | string;
  admin_email: string;
  created_at: number | string;
  id: string;
  new_url_summary: string;
  old_url_summary: string;
  package_label: string;
  provider_label: string;
};

type ShopFailureRow = {
  coach_email: string;
  coach_name: string;
  created_at: number | string;
  id: string;
  message: string;
  order_id: string;
  recovery_status: string;
  severity: string;
  stage: string;
};

export async function ensureShopTables(env: ShopEnv) {
  const db = env.ADMIN_DB;
  if (!db) return false;

  await runCachedD1SchemaSetup({
    cache: shopSchemaCache,
    db,
    setup: async () => {
      for (const statement of SHOP_SCHEMA_SQL) {
        try {
          await db.prepare(statement).run();
        } catch (error) {
          if (!isDuplicateColumnMigration(error)) throw error;
        }
      }
      await seedShopPaymentSettings(db, env);
    }
  });

  return true;
}

export async function getShopPaymentSettings(env: ShopEnv): Promise<ShopPaymentSettings> {
  const db = env.ADMIN_DB;
  if (!db) {
    const envUrl = sanitizeUrl(env.SHOP_PAYMENT_PAGE_URL || "");
    return {
      active: Boolean(envUrl),
      lastUpdatedAt: null,
      lastUpdatedBy: envUrl ? "Environment fallback" : "Not configured",
      packageLabel: "Premium coach website",
      paymentPageUrl: envUrl,
      providerLabel: envUrl ? "Razorpay" : "",
      storageSource: envUrl ? "env_fallback" : "unavailable"
    };
  }

  await ensureShopTables(env);
  const row = await db
    .prepare(`SELECT * FROM shop_payment_settings WHERE id = ?1 LIMIT 1`)
    .bind(SHOP_SETTINGS_ID)
    .first<ShopSettingsRow>();

  if (!row) {
    const envUrl = sanitizeUrl(env.SHOP_PAYMENT_PAGE_URL || "");
    return {
      active: Boolean(envUrl),
      lastUpdatedAt: null,
      lastUpdatedBy: envUrl ? "Environment fallback" : "Not configured",
      packageLabel: "Premium coach website",
      paymentPageUrl: envUrl,
      providerLabel: envUrl ? "Razorpay" : "",
      storageSource: envUrl ? "env_fallback" : "unavailable"
    };
  }

  return settingsRowToPublic(row, "d1_table");
}

export async function updateShopPaymentSettings({
  adminEmail,
  env,
  packageLabel,
  paymentPageUrl,
  providerLabel,
  active,
  request
}: {
  active: boolean;
  adminEmail: string;
  env: ShopEnv;
  packageLabel: string;
  paymentPageUrl: string;
  providerLabel: string;
  request?: Request;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "ADMIN_DB is not configured." };

  await ensureShopTables(env);
  const cleanUrl = sanitizeUrl(paymentPageUrl);
  const validation = validateShopPaymentUrl(cleanUrl);
  if (!validation.ok) {
    return { ok: false as const, error: validation.error };
  }

  const now = getNowSeconds();
  const oldSettings = await getShopPaymentSettings(env);
  const cleanProvider = sanitizeText(providerLabel || "Razorpay", 80);
  const cleanPackage = sanitizeText(packageLabel || "Premium coach website", 120);

  await db
    .prepare(
      `INSERT INTO shop_payment_settings (
        id, payment_page_url, provider_label, package_label, active, updated_at, updated_by
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(id) DO UPDATE SET
        payment_page_url = excluded.payment_page_url,
        provider_label = excluded.provider_label,
        package_label = excluded.package_label,
        active = excluded.active,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by`
    )
    .bind(
      SHOP_SETTINGS_ID,
      cleanUrl,
      cleanProvider,
      cleanPackage,
      active ? 1 : 0,
      now,
      sanitizeEmail(adminEmail)
    )
    .run();

  await db
    .prepare(
      `INSERT INTO shop_payment_settings_audit (
        id, action, old_url_summary, new_url_summary, provider_label, package_label,
        active, admin_email, created_at
      ) VALUES (?1, 'shop_payment_link_updated', ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
    .bind(
      `shop-pay-audit-${crypto.randomUUID()}`,
      summarizeUrl(oldSettings.paymentPageUrl),
      summarizeUrl(cleanUrl),
      cleanProvider,
      cleanPackage,
      active ? 1 : 0,
      sanitizeEmail(adminEmail),
      now
    )
    .run();

  if (request) {
    await recordAdminAuditEvent({
      email: adminEmail,
      env,
      reason: `shop_payment_link_updated:${summarizeUrl(cleanUrl)}`,
      request,
      type: "shop_payment_link_updated"
    });
  }

  return { ok: true as const, paymentSettings: await getShopPaymentSettings(env) };
}

export async function saveShopDraft({
  accessKey = "",
  env,
  idempotencyKey,
  state
}: {
  accessKey?: string;
  env: ShopEnv;
  idempotencyKey?: string;
  state: Partial<ShopBuilderState>;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };

  await ensureShopTables(env);
  const normalized = normalizeShopBuilderState(state);
  const normalizedEmail = sanitizeEmail(normalized.email || normalized.coachEmail);
  if (!isValidShopDraftEmail(normalizedEmail)) {
    return { ok: false as const, error: "Enter a valid email before saving this Shop draft." };
  }
  const draftContactIssues = validateShopDraftContactFields(normalized).filter(
    (issue) => issue.severity === "error"
  );
  if (draftContactIssues.length > 0) {
    return {
      ok: false as const,
      error:
        draftContactIssues[0]?.message ||
        "Fix the highlighted contact details before saving this Shop draft.",
      issues: draftContactIssues
    };
  }
  const cleanIdempotencyKey = sanitizeText(idempotencyKey, 160);
  const cleanAccessKey = sanitizeText(accessKey, 120);
  const existingIdempotentOrder =
    normalized.orderId || !cleanIdempotencyKey
      ? null
      : await getShopOrderByIdempotencyKey(db, cleanIdempotencyKey);
  const existingEmailDraft =
    normalized.orderId || existingIdempotentOrder
      ? null
      : await getActiveShopDraftByEmail(db, normalizedEmail);
  const targetOrderId =
    normalized.orderId || existingIdempotentOrder?.orderId || existingEmailDraft?.orderId || "";

  if (targetOrderId) {
    const existingOrder = await getShopOrder(env, targetOrderId);
    const isPublishFailedRecovery = Boolean(
      existingOrder &&
      existingOrder.siteStatus === "publish_failed" &&
      (existingOrder.paymentStatus === "paid" || existingOrder.paymentStatus === "publishing") &&
      !existingOrder.lockedAt
    );

    if (existingOrder) {
      const existingAccessKey = await getExistingShopClientAccessKey(db, existingOrder.orderId);
      const authorizedByIdempotency = existingIdempotentOrder?.orderId === existingOrder.orderId;
      const authorizedByAccessKey = Boolean(
        cleanAccessKey && existingAccessKey && cleanAccessKey === existingAccessKey
      );

      if (!isPublishFailedRecovery && !authorizedByIdempotency && !authorizedByAccessKey) {
        return {
          ok: false as const,
          error:
            "A saved draft exists for this email. Continue from the same device, open your secure resume link, or contact YWcoach support.",
          resumeRequired: true as const
        };
      }
    }

    if (
      existingOrder &&
      (existingOrder.lockedAt ||
        existingOrder.paymentStatus === "paid" ||
        existingOrder.paymentStatus === "published" ||
        existingOrder.siteStatus === "publishing" ||
        existingOrder.siteStatus === "published" ||
        existingOrder.siteStatus === "publish_failed") &&
      !isPublishFailedRecovery
    ) {
      return {
        ok: false as const,
        error:
          "This website is already in the paid publishing workflow. For future changes, please contact YWcoach support."
      };
    }

    if (existingOrder && isPublishFailedRecovery) {
      const existingAccessKey = await getExistingShopClientAccessKey(db, existingOrder.orderId);
      if (!existingAccessKey || !cleanAccessKey || cleanAccessKey !== existingAccessKey) {
        return {
          ok: false as const,
          error:
            "Use the secure resume link for this paid website before saving publish-failure fixes."
        };
      }
    }
  }

  const now = getNowSeconds();
  const orderId = targetOrderId || `shop-order-${crypto.randomUUID()}`;
  const slug = await getAvailableShopSlug(db, normalized.slug || normalized.coachName, orderId);
  const recordId = `shop-site-${orderId.replace(/^shop-order-/, "")}`;
  const key = cleanIdempotencyKey || orderId;
  const clientAccessKey = targetOrderId
    ? (await getExistingShopClientAccessKey(db, targetOrderId)) || createClientAccessKey()
    : createClientAccessKey();
  const stateForStorage = normalizeShopBuilderState({
    ...normalized,
    coachEmail: normalizedEmail,
    email: normalizedEmail,
    orderId,
    slug,
    status: targetOrderId
      ? (await getShopOrder(env, targetOrderId))?.siteStatus || "draft"
      : "draft"
  });

  await db
    .prepare(
      `INSERT INTO shop_sites (
        id, order_id, idempotency_key, coach_name, coach_email, coach_phone, niche,
        location, slug, public_url, selected_theme_id, contact_link, payment_status,
        site_status, workflow_stage, issue_status, client_access_key, content_json, builder_json,
        payment_url_snapshot, source, retry_count, created_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7,
        ?8, ?9, ?10, ?11, ?12, 'draft',
        'draft', 'draft_saved', '', ?13, ?14, ?15,
        '', 'shop_purchased', 0, ?16, ?16
      )
      ON CONFLICT(order_id) DO UPDATE SET
        coach_name = excluded.coach_name,
        coach_email = excluded.coach_email,
        coach_phone = excluded.coach_phone,
        niche = excluded.niche,
        location = excluded.location,
        slug = excluded.slug,
        public_url = excluded.public_url,
        selected_theme_id = excluded.selected_theme_id,
        contact_link = excluded.contact_link,
        client_access_key = COALESCE(NULLIF(shop_sites.client_access_key, ''), excluded.client_access_key),
        content_json = excluded.content_json,
        builder_json = excluded.builder_json,
        workflow_stage = CASE
          WHEN shop_sites.site_status = 'publish_failed' THEN 'publish_failed_draft_saved'
          ELSE 'draft_saved'
        END,
        updated_at = excluded.updated_at`
    )
    .bind(
      recordId,
      orderId,
      key,
      stateForStorage.coachName,
      normalizedEmail,
      stateForStorage.coachPhone,
      stateForStorage.niche,
      stateForStorage.location,
      slug,
      `/coach/${slug}`,
      stateForStorage.selectedThemeId,
      stateForStorage.contactLink,
      clientAccessKey,
      JSON.stringify(stateForStorage.content),
      JSON.stringify(stateForStorage),
      now
    )
    .run();

  return { ok: true as const, accessKey: clientAccessKey, order: await getShopOrder(env, orderId) };
}

export async function startShopCheckout({
  env,
  idempotencyKey,
  state
}: {
  env: ShopEnv;
  idempotencyKey?: string;
  state: Partial<ShopBuilderState>;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };

  await ensureShopTables(env);
  const settings = await getShopPaymentSettings(env);
  if (!settings.paymentPageUrl) {
    return { ok: false as const, error: "Shop payment link is not configured." };
  }
  if (!env.SHOP_RAZORPAY_WEBHOOK_SECRET) {
    return {
      ok: false as const,
      error:
        "Shop payment verification is not configured. Please contact YWcoach support before payment."
    };
  }
  if (!settings.active) {
    return { ok: false as const, error: "Shop payment is temporarily unavailable." };
  }

  const paymentValidation = validateShopPaymentUrl(settings.paymentPageUrl);
  if (!paymentValidation.ok) return { ok: false as const, error: paymentValidation.error };

  const normalized = normalizeShopBuilderState(state);
  const issues = validateShopBuilderState(normalized, { requirePaymentReady: true }).filter(
    (issue) => issue.severity === "error"
  );
  if (issues.length > 0) {
    return {
      ok: false as const,
      error: "Fix the highlighted website details before checkout.",
      issues
    };
  }

  const duplicateCoachName = await coachSiteNameExists(db, normalized.coachName);
  if (duplicateCoachName) {
    return {
      ok: false as const,
      error:
        "A coach site already exists with this coach name. Use a unique public coach name before checkout."
    };
  }

  const cleanIdempotencyKey = sanitizeText(idempotencyKey, 160);
  const existingIdempotentOrder = cleanIdempotencyKey
    ? await getShopOrderByIdempotencyKey(db, cleanIdempotencyKey)
    : null;
  const allowedPendingOrderId = normalized.orderId || existingIdempotentOrder?.orderId || "";
  const pendingContactConflict = await findPendingShopOrderConflictForContact(
    db,
    normalized,
    allowedPendingOrderId
  );
  if (pendingContactConflict) {
    return {
      ok: false as const,
      error:
        "This email or phone already has a Shop checkout waiting for payment verification. Finish that payment or contact support before starting another website purchase."
    };
  }

  const saved = await saveShopDraft({ env, idempotencyKey, state: normalized });
  if (!saved.ok || !saved.order) {
    return { ok: false as const, error: saved.ok ? "Could not prepare checkout." : saved.error };
  }

  const now = getNowSeconds();
  const redirectUrl = appendShopOrderToPaymentUrl(settings.paymentPageUrl, saved.order.orderId);

  await db
    .prepare(
      `UPDATE shop_sites
       SET payment_status = 'pending_payment',
           site_status = 'pending_payment',
           workflow_stage = 'redirected_to_checkout',
           payment_url_snapshot = ?1,
           updated_at = ?2
       WHERE order_id = ?3`
    )
    .bind(summarizeUrl(settings.paymentPageUrl), now, saved.order.orderId)
    .run();

  return {
    accessKey: saved.accessKey,
    ok: true as const,
    order: await getShopOrder(env, saved.order.orderId),
    redirectUrl
  };
}

export async function getShopOrder(env: ShopEnv, orderId: string) {
  const db = env.ADMIN_DB;
  if (!db) return null;
  await ensureShopTables(env);

  const row = await db
    .prepare(`SELECT * FROM shop_sites WHERE order_id = ?1 LIMIT 1`)
    .bind(sanitizeText(orderId, 160))
    .first<ShopSiteRow>();

  return row ? shopSiteRowToRecord(row) : null;
}

async function reconcileShopOrderLiveStatus(env: ShopEnv, order: ShopSiteRecord) {
  if (order.siteStatus !== "published" || !env.ADMIN_DB) return order;

  let linkedSite: Awaited<ReturnType<typeof getCoachSiteBySlugFromDb>> | null = null;
  try {
    linkedSite = await getCoachSiteBySlugFromDb(order.slug, env);
  } catch {
    linkedSite = null;
  }

  if (linkedSite?.status === "published") {
    const publicUrl = linkedSite.publicUrl || order.publicUrl || `/coach/${order.slug}`;
    return publicUrl === order.publicUrl ? order : { ...order, publicUrl };
  }

  const nextStatus = shopStatusFromCoachSiteStatus(linkedSite?.status);
  const workflowStage = linkedSite
    ? `coach_site_${linkedSite.status}_after_publish`
    : "coach_site_missing_after_publish";
  const issueStatus = linkedSite
    ? `Coach site is ${linkedSite.status} after paid publish.`
    : "Published Shop order has no matching Coach Site.";

  return {
    ...order,
    issueStatus,
    publicUrl: "",
    siteStatus: nextStatus,
    state: {
      ...order.state,
      status: nextStatus
    },
    workflowStage
  };
}

function shopStatusFromCoachSiteStatus(
  status: CoachSiteStatus | null | undefined
): ShopBuilderStatus {
  if (
    status === "archived" ||
    status === "draft" ||
    status === "paused" ||
    status === "published" ||
    status === "removed"
  ) {
    return status;
  }

  return "publish_failed";
}

function isPublicInactiveShopStatus(status: ShopBuilderStatus) {
  return (
    status === "archived" ||
    status === "paused" ||
    status === "publish_failed" ||
    status === "removed"
  );
}

export async function syncShopOrderStatusForCoachSite({
  env,
  site
}: {
  env: ShopEnv;
  site: {
    coachName?: string;
    publicUrl?: string;
    slug?: string;
    status: CoachSiteStatus;
  };
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };
  await ensureShopTables(env);

  const slug = normalizeCoachSlug(site.slug || site.coachName || "");
  if (!slug) return { ok: false as const, error: "Coach site slug is required." };

  const nextStatus = shopStatusFromCoachSiteStatus(site.status);
  const publicUrl = site.publicUrl || `/coach/${slug}`;
  const workflowStage =
    nextStatus === "published"
      ? "coach_site_published_after_shop_sync"
      : `coach_site_${nextStatus}_after_publish`;
  const issueStatus =
    nextStatus === "published" ? "" : `Coach site is ${nextStatus} after paid publish.`;
  const now = getNowSeconds();

  await db
    .prepare(
      `UPDATE shop_sites
       SET site_status = ?1,
           workflow_stage = ?2,
           issue_status = ?3,
           public_url = CASE WHEN ?1 = 'published' THEN ?4 ELSE public_url END,
           updated_at = ?5
       WHERE source = 'shop_purchased'
         AND payment_status IN ('paid', 'published', 'publishing')
         AND (slug = ?6 OR public_url = ?4 OR id = ?7)`
    )
    .bind(nextStatus, workflowStage, issueStatus, publicUrl, now, slug, `shop-site-${slug}`)
    .run();

  return { ok: true as const };
}

export async function getShopOrderByPaymentReference({
  env,
  providerPaymentId
}: {
  env: ShopEnv;
  providerPaymentId: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return null;
  await ensureShopTables(env);

  const row = await db
    .prepare(`SELECT * FROM shop_sites WHERE payment_reference = ?1 LIMIT 1`)
    .bind(sanitizeText(providerPaymentId, 80))
    .first<ShopSiteRow>();

  return row ? shopSiteRowToRecord(row) : null;
}

export async function findPendingShopOrderByContact({
  email,
  env,
  phone
}: {
  email?: string;
  env: ShopEnv;
  phone?: string;
}): Promise<
  | { reason: "ambiguous"; matchCount: number; ok: false }
  | { reason: "missing_contact" | "not_found"; matchCount: number; ok: false }
  | { matchCount: number; ok: true; order: ShopSiteRecord }
> {
  const db = env.ADMIN_DB;
  if (!db) return { matchCount: 0, ok: false, reason: "not_found" };
  await ensureShopTables(env);

  const cleanEmail = sanitizeEmail(email);
  const cleanPhone = normalizePhoneDigits(phone);
  if (!cleanEmail && !cleanPhone) {
    return { matchCount: 0, ok: false, reason: "missing_contact" };
  }

  const recentCutoff = getNowSeconds() - 60 * 60 * 24;
  const rows = await db
    .prepare(
      `SELECT * FROM shop_sites
       WHERE payment_status = 'pending_payment'
         AND site_status = 'pending_payment'
         AND created_at >= ?1
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .bind(recentCutoff)
    .all<ShopSiteRow>();

  const matches = (rows.results || []).map(shopSiteRowToRecord).filter((order) => {
    const emailMatches = Boolean(cleanEmail && sanitizeEmail(order.coachEmail) === cleanEmail);
    const phoneMatches = Boolean(
      cleanPhone && normalizePhoneDigits(order.coachPhone) === cleanPhone
    );
    return emailMatches || phoneMatches;
  });

  if (matches.length === 1) return { matchCount: 1, ok: true, order: matches[0] };
  if (matches.length > 1) return { matchCount: matches.length, ok: false, reason: "ambiguous" };
  return { matchCount: 0, ok: false, reason: "not_found" };
}

export async function getPublicShopOrder({
  accessKey,
  env,
  orderId
}: {
  accessKey?: string;
  env: ShopEnv;
  orderId: string;
}) {
  const rawOrder = await getShopOrder(env, orderId);
  if (!rawOrder) return null;
  const order = await reconcileShopOrderLiveStatus(env, rawOrder);
  const db = env.ADMIN_DB;
  const orderAccessKey = db ? await getExistingShopClientAccessKey(db, order.orderId) : "";
  const cleanAccessKey = sanitizeText(accessKey, 120);
  const hasClientAccess = Boolean(
    cleanAccessKey && orderAccessKey && cleanAccessKey === orderAccessKey
  );
  const hasAccess = Boolean(order.siteStatus === "published" || hasClientAccess);

  if (!hasAccess) {
    if (isPublicInactiveShopStatus(order.siteStatus)) {
      return {
        orderId: order.orderId,
        publicUrl: "",
        siteStatus: order.siteStatus,
        workflowStage: order.workflowStage
      };
    }

    return {
      orderId: order.orderId,
      publicUrl: "",
      siteStatus: "protected",
      workflowStage: "access_key_required"
    };
  }

  return {
    accessKey: hasClientAccess ? orderAccessKey : "",
    coachName: order.coachName,
    lockedAt: order.lockedAt,
    orderId: order.orderId,
    paymentStatus: order.paymentStatus,
    publicUrl: order.siteStatus === "published" ? order.publicUrl : "",
    publishedAt: order.publishedAt,
    siteStatus: order.siteStatus,
    state: hasClientAccess ? order.state : undefined,
    workflowStage: order.workflowStage
  };
}

export async function getShopOrderForClient({
  accessKey,
  env,
  orderId
}: {
  accessKey?: string;
  env: ShopEnv;
  orderId: string;
}): Promise<ShopSiteRecord | null> {
  const cleanAccessKey = sanitizeText(accessKey, 120);
  const cleanOrderId = sanitizeText(orderId, 160);
  const db = env.ADMIN_DB;
  if (!db || !cleanAccessKey || !cleanOrderId) return null;

  const rawOrder = await getShopOrder(env, cleanOrderId);
  if (!rawOrder) return null;

  const orderAccessKey = await getExistingShopClientAccessKey(db, rawOrder.orderId);
  if (!orderAccessKey || cleanAccessKey !== orderAccessKey) return null;

  return reconcileShopOrderLiveStatus(env, rawOrder);
}

export async function archiveShopDraft({
  accessKey,
  env,
  orderId,
  reason = "start_fresh"
}: {
  accessKey?: string;
  env: ShopEnv;
  orderId: string;
  reason?: "archive" | "start_fresh";
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };
  await ensureShopTables(env);

  const cleanOrderId = sanitizeText(orderId, 160);
  const order = cleanOrderId ? await getShopOrder(env, cleanOrderId) : null;
  if (!order) return { ok: false as const, error: "Draft was not found." };

  const existingAccessKey = await getExistingShopClientAccessKey(db, order.orderId);
  const cleanAccessKey = sanitizeText(accessKey, 120);
  if (!existingAccessKey || !cleanAccessKey || cleanAccessKey !== existingAccessKey) {
    return {
      ok: false as const,
      error:
        "Open the secure resume link or continue on the same device before archiving this draft."
    };
  }

  const canArchive =
    order.paymentStatus === "draft" ||
    order.paymentStatus === "payment_failed" ||
    order.siteStatus === "draft" ||
    order.siteStatus === "payment_failed";
  if (!canArchive || order.paymentStatus === "pending_payment" || order.siteStatus === "pending_payment") {
    return {
      ok: false as const,
      error:
        "This draft is already in payment or publishing. Finish or recover that flow before starting fresh."
    };
  }
  if (order.paymentStatus === "published" || order.siteStatus === "published") {
    return {
      ok: false as const,
      error: "This website is already published. Future changes are handled through YWcoach support."
    };
  }

  const now = getNowSeconds();
  const workflowStage = reason === "start_fresh" ? "draft_archived_start_fresh" : "draft_archived";
  await db
    .prepare(
      `UPDATE shop_sites
       SET payment_status = 'archived',
           site_status = 'archived',
           workflow_stage = ?1,
           issue_status = ?2,
           updated_at = ?3
       WHERE order_id = ?4`
    )
    .bind(
      workflowStage,
      reason === "start_fresh"
        ? "Archived by coach before starting a fresh website draft."
        : "Archived by coach.",
      now,
      order.orderId
    )
    .run();

  return { ok: true as const, order: await getShopOrder(env, order.orderId) };
}

export async function listShopAdminSnapshot(env: ShopEnv): Promise<ShopAdminSnapshot> {
  const db = env.ADMIN_DB;
  const settings = await getShopPaymentSettings(env);
  if (!db) {
    return {
      audits: [],
      failures: [],
      paymentSettings: settings,
      reports: {
        analyticsSummaryCount: 0,
        failureCount: 0,
        paymentSettingsAuditCount: 0,
        purchaseCount: 0,
        siteCount: 0
      },
      sites: []
    };
  }

  await ensureShopTables(env);
  const [siteRows, auditRows, failureRows] = await Promise.all([
    db.prepare(`SELECT * FROM shop_sites ORDER BY updated_at DESC LIMIT 500`).all<ShopSiteRow>(),
    db
      .prepare(`SELECT * FROM shop_payment_settings_audit ORDER BY created_at DESC LIMIT 100`)
      .all<ShopAuditRow>(),
    db
      .prepare(`SELECT * FROM shop_failures ORDER BY created_at DESC LIMIT 100`)
      .all<ShopFailureRow>()
  ]);

  const sites = await Promise.all(
    (siteRows.results || []).map((row) =>
      reconcileShopOrderLiveStatus(env, shopSiteRowToRecord(row))
    )
  );
  const failures = (failureRows.results || []).map(failureRowToRecord);
  const audits = (auditRows.results || []).map(auditRowToRecord);

  return {
    audits,
    failures,
    paymentSettings: settings,
    reports: {
      analyticsSummaryCount: sites.filter((site) => site.siteStatus === "published").length,
      failureCount: failures.length,
      paymentSettingsAuditCount: audits.length,
      purchaseCount: sites.filter((site) => site.paymentStatus !== "draft").length,
      siteCount: sites.length
    },
    sites
  };
}

export async function publishShopOrder({
  adminEmail = "shop-payment-verifier",
  env,
  orderId
}: {
  adminEmail?: string;
  env: ShopEnv;
  orderId: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };
  await ensureShopTables(env);

  const order = await getShopOrder(env, orderId);
  if (!order) return { ok: false as const, error: "Shop order was not found." };
  if (order.siteStatus === "published") return { ok: true as const, order };
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "publishing") {
    return { ok: false as const, error: "Payment has not been verified server-side." };
  }

  const now = getNowSeconds();
  try {
    const coachSite = await upsertCoachSiteToDb({
      adminEmail,
      env,
      payload: buildCoachSiteFromShopState({
        id: `shop-site-${order.slug}`,
        published: true,
        state: order.state
      })
    });

    await db
      .prepare(
        `UPDATE shop_sites
         SET site_status = 'published',
             payment_status = 'published',
             workflow_stage = 'published_verified',
             public_url = ?1,
             locked_at = ?2,
             published_at = ?2,
             updated_at = ?2
         WHERE order_id = ?3`
      )
      .bind(coachSite?.publicUrl || order.publicUrl || `/coach/${order.slug}`, now, order.orderId)
      .run();

    return { ok: true as const, order: await getShopOrder(env, order.orderId) };
  } catch (error) {
    await recordShopFailure({
      coachEmail: order.coachEmail,
      coachName: order.coachName,
      env,
      message: error instanceof Error ? error.message : "Shop publish failed.",
      orderId: order.orderId,
      severity: "high",
      stage: "publish"
    });

    await db
      .prepare(
        `UPDATE shop_sites
         SET site_status = 'publish_failed',
             workflow_stage = 'publish_failed',
             issue_status = 'Publish failed after payment verification.',
             retry_count = retry_count + 1,
             updated_at = ?1
         WHERE order_id = ?2`
      )
      .bind(now, order.orderId)
      .run();

    return { ok: false as const, error: "Payment was recorded, but publishing failed safely." };
  }
}

export async function markShopOrderPaymentVerified({
  adminEmail = "shop-payment-webhook",
  env,
  orderId,
  payerEmail = "",
  payerPhone = "",
  providerEventId = "",
  providerPaymentId = ""
}: {
  adminEmail?: string;
  env: ShopEnv;
  orderId: string;
  payerEmail?: string;
  payerPhone?: string;
  providerEventId?: string;
  providerPaymentId?: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };
  await ensureShopTables(env);

  const order = await getShopOrder(env, orderId);
  if (!order) {
    await recordShopFailure({
      env,
      message: "Payment webhook referenced an unknown Shop order.",
      orderId,
      severity: "high",
      stage: "payment_verification"
    });
    return { ok: false as const, error: "Shop order was not found." };
  }

  if (order.siteStatus === "published" || order.paymentStatus === "published") {
    return { ok: true as const, order };
  }

  const contactMatches = shopOrderContactMatchesPayment(order, {
    email: payerEmail,
    phone: payerPhone
  });
  const legacyContactRecovery = canRecoverLegacyBlankContactOrder(order, {
    email: payerEmail,
    phone: payerPhone
  });

  if (!contactMatches && !legacyContactRecovery.ok) {
    await recordShopFailure({
      coachEmail: order.coachEmail,
      coachName: order.coachName,
      env,
      message: `Payment webhook contact did not match the Shop order. Event ${sanitizeText(providerEventId, 80)} payment ${sanitizeText(providerPaymentId, 80)}.`,
      orderId: order.orderId,
      severity: "high",
      stage: "payment_contact_match"
    });

    return { ok: false as const, error: "Payment contact did not match this Shop order." };
  }

  const now = getNowSeconds();
  if (legacyContactRecovery.ok) {
    await db
      .prepare(
        `UPDATE shop_sites
         SET coach_email = CASE WHEN coach_email = '' THEN ?1 ELSE coach_email END,
             coach_phone = CASE WHEN coach_phone = '' THEN ?2 ELSE coach_phone END,
             issue_status = 'Recovered missing checkout contact from signed Razorpay webhook.',
             updated_at = ?3
         WHERE order_id = ?4`
      )
      .bind(legacyContactRecovery.email, legacyContactRecovery.phone, now, order.orderId)
      .run();
  }

  await db
    .prepare(
      `UPDATE shop_sites
       SET payment_status = 'paid',
           site_status = 'publishing',
           workflow_stage = 'payment_verified',
           issue_status = '',
           payment_reference = COALESCE(NULLIF(payment_reference, ''), ?3),
           payment_date = COALESCE(payment_date, ?1),
           updated_at = ?1
       WHERE order_id = ?2`
    )
    .bind(now, order.orderId, sanitizeText(providerPaymentId, 80))
    .run();

  const publishResult = await publishShopOrder({ adminEmail, env, orderId: order.orderId });
  if (!publishResult.ok) {
    await recordShopFailure({
      coachEmail: order.coachEmail,
      coachName: order.coachName,
      env,
      message: `Verified payment could not publish. Event ${sanitizeText(providerEventId, 80)} payment ${sanitizeText(providerPaymentId, 80)}.`,
      orderId: order.orderId,
      severity: "critical",
      stage: "post_payment_publish"
    });
  }

  return publishResult;
}

export async function claimSignedShopPaymentForOrder({
  accessKey,
  env,
  orderId,
  payerEmail,
  providerPaymentId
}: {
  accessKey: string;
  env: ShopEnv;
  orderId: string;
  payerEmail: string;
  providerPaymentId: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };
  await ensureShopTables(env);

  const cleanOrderId = sanitizeText(orderId, 160);
  const cleanAccessKey = sanitizeText(accessKey, 160);
  const cleanPaymentId = sanitizeText(providerPaymentId, 80);
  const cleanEmail = sanitizeEmail(payerEmail);

  if (!isRazorpayPaymentId(cleanPaymentId)) {
    return { ok: false as const, error: "Enter a valid Razorpay payment id." };
  }
  if (!cleanEmail) {
    return { ok: false as const, error: "Enter the email used on the Razorpay payment." };
  }

  const order = await getShopOrder(env, cleanOrderId);
  if (!order) return { ok: false as const, error: "Shop order was not found." };

  const orderAccessKey = await getExistingShopClientAccessKey(db, order.orderId);
  if (!cleanAccessKey || !orderAccessKey || cleanAccessKey !== orderAccessKey) {
    return {
      ok: false as const,
      error: "Open this page from the same browser used during checkout, then try again."
    };
  }

  if (order.siteStatus === "published") return { ok: true as const, order };
  if (order.paymentStatus !== "pending_payment" || order.siteStatus !== "pending_payment") {
    return {
      ok: false as const,
      error: "This order is not waiting for payment verification."
    };
  }

  const alreadyClaimed = await db
    .prepare(
      `SELECT order_id FROM shop_sites
       WHERE payment_reference = ?1
         AND order_id != ?2
       LIMIT 1`
    )
    .bind(cleanPaymentId, order.orderId)
    .first<{ order_id: string }>();

  if (alreadyClaimed?.order_id) {
    return {
      ok: false as const,
      error: "This Razorpay payment is already linked to another Shop order."
    };
  }

  const failure = await findSignedUnmatchedShopPaymentFailure(db, {
    payerEmail: cleanEmail,
    providerPaymentId: cleanPaymentId
  });

  if (!failure) {
    return {
      ok: false as const,
      error: "No signed Razorpay webhook was found for that payment id and email yet."
    };
  }

  return applySignedShopPaymentClaim({
    adminEmail: "shop-payment-claim",
    db,
    env,
    issueStatus: "Payment verified from signed Razorpay webhook recovery.",
    order,
    payerEmail: cleanEmail,
    providerPaymentId: cleanPaymentId,
    publishFailureStage: "claimed_payment_publish",
    workflowStage: "payment_claim_verified"
  });
}

export async function autoRecoverSignedShopPaymentForOrder({
  accessKey,
  env,
  orderId
}: {
  accessKey: string;
  env: ShopEnv;
  orderId: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };
  await ensureShopTables(env);

  const cleanOrderId = sanitizeText(orderId, 160);
  const cleanAccessKey = sanitizeText(accessKey, 160);
  const order = await getShopOrder(env, cleanOrderId);
  if (!order) return { ok: false as const, error: "Shop order was not found." };

  const orderAccessKey = await getExistingShopClientAccessKey(db, order.orderId);
  if (!cleanAccessKey || !orderAccessKey || cleanAccessKey !== orderAccessKey) {
    return {
      ok: false as const,
      error: "Open this page from the same browser used during checkout, then try again."
    };
  }

  if (order.siteStatus === "published") {
    return { matchedPaymentId: order.paymentReference, ok: true as const, order, recovered: false };
  }

  if (order.paymentStatus !== "pending_payment" || order.siteStatus !== "pending_payment") {
    return {
      ok: false as const,
      error: "This order is not waiting for payment verification."
    };
  }

  const candidate = await findAutoRecoverableSignedPaymentCandidate(db, order);
  if (!candidate) {
    return {
      ok: false as const,
      error: "Razorpay confirmation has not reached this order yet."
    };
  }

  const publishResult = await applySignedShopPaymentClaim({
    adminEmail: "shop-payment-auto-recovery",
    db,
    env,
    issueStatus: candidate.contactMatched
      ? "Payment auto-verified from signed Razorpay webhook contact."
      : "Payment auto-verified from same-browser signed Razorpay webhook recovery.",
    order,
    payerEmail: candidate.payerEmail,
    providerPaymentId: candidate.paymentId,
    publishFailureStage: "auto_recovered_payment_publish",
    workflowStage: candidate.contactMatched
      ? "payment_auto_recovered_contact"
      : "payment_auto_recovered_same_browser"
  });

  return {
    ...publishResult,
    matchedPaymentId: candidate.paymentId,
    recovered: publishResult.ok
  };
}

async function applySignedShopPaymentClaim({
  adminEmail,
  db,
  env,
  issueStatus,
  order,
  payerEmail,
  providerPaymentId,
  publishFailureStage,
  workflowStage
}: {
  adminEmail: string;
  db: D1Database;
  env: ShopEnv;
  issueStatus: string;
  order: ShopSiteRecord;
  payerEmail: string;
  providerPaymentId: string;
  publishFailureStage: string;
  workflowStage: string;
}) {
  const cleanEmail = sanitizeEmail(payerEmail);
  const cleanPaymentId = sanitizeText(providerPaymentId, 80);
  const now = getNowSeconds();

  await db
    .prepare(
      `UPDATE shop_sites
       SET payment_status = 'paid',
           site_status = 'publishing',
           workflow_stage = ?1,
           issue_status = ?2,
           payment_reference = ?3,
           payment_date = COALESCE(payment_date, ?4),
           coach_email = CASE WHEN coach_email = '' THEN ?5 ELSE coach_email END,
           updated_at = ?4
       WHERE order_id = ?6`
    )
    .bind(workflowStage, issueStatus, cleanPaymentId, now, cleanEmail, order.orderId)
    .run();

  await db
    .prepare(
      `UPDATE shop_failures
       SET order_id = ?1,
           coach_name = ?2,
           recovery_status = 'claimed_to_order'
       WHERE stage = 'webhook_order_match'
         AND lower(coach_email) = ?3
         AND message LIKE ?4`
    )
    .bind(order.orderId, order.coachName, cleanEmail, `%payment ${cleanPaymentId}%`)
    .run();

  const publishResult = await publishShopOrder({
    adminEmail,
    env,
    orderId: order.orderId
  });

  if (!publishResult.ok) {
    await recordShopFailure({
      coachEmail: order.coachEmail || cleanEmail,
      coachName: order.coachName,
      env,
      message: `Claimed Razorpay payment could not publish. Payment ${cleanPaymentId}.`,
      orderId: order.orderId,
      severity: "critical",
      stage: publishFailureStage
    });
  }

  return publishResult;
}

export async function retryShopPublish({
  adminEmail,
  env,
  orderId
}: {
  adminEmail: string;
  env: ShopEnv;
  orderId: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return { ok: false as const, error: "Shop database is not configured." };
  await ensureShopTables(env);

  const order = await getShopOrder(env, orderId);
  if (!order) return { ok: false as const, error: "Shop order was not found." };
  if (order.paymentStatus !== "paid" && order.paymentStatus !== "publishing") {
    return { ok: false as const, error: "Payment is not verified for this Shop order." };
  }

  await db
    .prepare(
      `UPDATE shop_sites
       SET site_status = 'publishing',
           workflow_stage = 'admin_retry_publish',
           issue_status = '',
           updated_at = ?1
       WHERE order_id = ?2`
    )
    .bind(getNowSeconds(), order.orderId)
    .run();

  return publishShopOrder({ adminEmail, env, orderId: order.orderId });
}

export async function recordShopFailure({
  coachEmail = "",
  coachName = "",
  env,
  message,
  orderId = "",
  severity = "medium",
  stage
}: {
  coachEmail?: string;
  coachName?: string;
  env: ShopEnv;
  message: string;
  orderId?: string;
  severity?: ShopFailureRecord["severity"];
  stage: string;
}) {
  const db = env.ADMIN_DB;
  if (!db) return;
  await ensureShopTables(env);
  await db
    .prepare(
      `INSERT INTO shop_failures (
        id, order_id, coach_name, coach_email, severity, stage, message, recovery_status, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'needs_review', ?8)`
    )
    .bind(
      `shop-failure-${crypto.randomUUID()}`,
      sanitizeText(orderId, 160),
      sanitizeText(coachName, 160),
      sanitizeEmail(coachEmail),
      severity,
      sanitizeText(stage, 80),
      sanitizeText(message, 600),
      getNowSeconds()
    )
    .run();
}

export async function createShopReportCsv(env: ShopEnv, report: string) {
  const snapshot = await listShopAdminSnapshot(env);
  if (report === "duplicate-drafts") return createDuplicateDraftsCsv(snapshot.sites);
  if (report === "input-audit") return createInputAuditCsv(snapshot.sites);
  if (report === "settings") return createPaymentAuditCsv(snapshot.audits);
  if (report === "failures") return createFailureCsv(snapshot.failures);
  if (report === "analytics") return createAnalyticsSummaryCsv(snapshot.sites);
  if (report === "published")
    return createSitesCsv(snapshot.sites.filter((site) => site.siteStatus === "published"));
  return createSitesCsv(snapshot.sites);
}

export async function getShopBackupSections(env: ShopEnv) {
  const snapshot = await listShopAdminSnapshot(env);
  return {
    analyticsSummary: snapshot.sites.map((site) => ({
      coach_name: site.coachName,
      cta_clicks: 0,
      page_views: 0,
      public_url: site.publicUrl,
      source: site.source,
      video_plays: 0,
      whatsapp_clicks: 0
    })),
    audits: snapshot.audits,
    failures: snapshot.failures,
    paymentSettings: snapshot.paymentSettings,
    sites: snapshot.sites
  };
}

function createSitesCsv(sites: ShopSiteRecord[]) {
  const headers = [
    "order_id",
    "coach_name",
    "coach_email",
    "coach_phone",
    "niche",
    "payment_status",
    "payment_reference",
    "site_status",
    "public_url",
    "slug",
    "selected_theme_id",
    "source",
    "workflow_stage",
    "issue_status",
    "created_at",
    "payment_date",
    "published_at"
  ];
  return [
    headers.join(","),
    ...sites.map((site) =>
      [
        site.orderId,
        site.coachName,
        site.coachEmail,
        site.coachPhone,
        site.niche,
        site.paymentStatus,
        site.paymentReference,
        site.siteStatus,
        site.publicUrl,
        site.slug,
        site.selectedThemeId,
        site.source,
        site.workflowStage,
        site.issueStatus,
        site.createdAt,
        site.paymentDate || "",
        site.publishedAt || ""
      ]
        .map(csvEscape)
        .join(",")
    )
  ].join("\n");
}

function createInputAuditCsv(sites: ShopSiteRecord[]) {
  const headers = [
    "order_id",
    "coach_name",
    "coach_email",
    "field",
    "issue",
    "current_value",
    "status",
    "updated_at"
  ];
  const rows = sites.flatMap((site) => {
    const issues = validateShopDraftContactFields({
      ...site.state,
      coachEmail: site.coachEmail,
      coachPhone: site.coachPhone,
      contactLink: site.contactLink,
      email: site.coachEmail
    });

    return issues.map((issue) => [
      site.orderId,
      site.coachName,
      site.coachEmail,
      issue.field,
      issue.message,
      getShopAuditFieldValue(site, String(issue.field)),
      "needs_review",
      site.updatedAt
    ]);
  });

  return [headers.join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
}

function createDuplicateDraftsCsv(sites: ShopSiteRecord[]) {
  const headers = [
    "coach_email",
    "active_draft_count",
    "kept_order_id",
    "duplicate_order_id",
    "duplicate_status",
    "duplicate_updated_at",
    "recommendation"
  ];
  const activeDrafts = sites.filter(isActiveUnfinishedShopDraft);
  const grouped = new Map<string, ShopSiteRecord[]>();
  activeDrafts.forEach((site) => {
    const email = sanitizeEmail(site.coachEmail || site.state.email);
    if (!email) return;
    const list = grouped.get(email) || [];
    list.push(site);
    grouped.set(email, list);
  });

  const rows: string[][] = [];
  grouped.forEach((group, email) => {
    if (group.length < 2) return;
    const sorted = [...group].sort(
      (left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "")
    );
    const kept = sorted[0];
    sorted.slice(1).forEach((duplicate) => {
      rows.push([
        email,
        String(group.length),
        kept?.orderId || "",
        duplicate.orderId,
        `${duplicate.paymentStatus}/${duplicate.siteStatus}`,
        duplicate.updatedAt,
        "Keep latest active draft; archive older duplicate after manual review."
      ]);
    });
  });

  return [headers.join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
}

function getShopAuditFieldValue(site: ShopSiteRecord, field: string) {
  if (field === "coachPhone") return site.coachPhone;
  if (field === "contactLink" || field === "whatsappLink") return site.contactLink;
  if (field === "email" || field === "coachEmail") return site.coachEmail;
  return "";
}

function isActiveUnfinishedShopDraft(site: ShopSiteRecord) {
  return (
    !site.lockedAt &&
    ((site.paymentStatus === "draft" && site.siteStatus === "draft") ||
      (site.paymentStatus === "payment_failed" && site.siteStatus === "payment_failed") ||
      (site.paymentStatus === "pending_payment" && site.siteStatus === "pending_payment"))
  );
}

function createFailureCsv(failures: ShopFailureRecord[]) {
  const headers = [
    "id",
    "order_id",
    "coach_name",
    "coach_email",
    "severity",
    "stage",
    "message",
    "recovery_status",
    "created_at"
  ];
  return [
    headers.join(","),
    ...failures.map((failure) =>
      [
        failure.id,
        failure.orderId,
        failure.coachName,
        failure.coachEmail,
        failure.severity,
        failure.stage,
        failure.message,
        failure.recoveryStatus,
        failure.createdAt
      ]
        .map(csvEscape)
        .join(",")
    )
  ].join("\n");
}

function createPaymentAuditCsv(audits: ShopPaymentAuditRecord[]) {
  const headers = [
    "id",
    "action",
    "old_url_summary",
    "new_url_summary",
    "provider",
    "package",
    "active",
    "admin_email",
    "created_at"
  ];
  return [
    headers.join(","),
    ...audits.map((audit) =>
      [
        audit.id,
        audit.action,
        audit.oldUrlSummary,
        audit.newUrlSummary,
        audit.providerLabel,
        audit.packageLabel,
        audit.active ? "active" : "inactive",
        audit.adminEmail,
        audit.createdAt
      ]
        .map(csvEscape)
        .join(",")
    )
  ].join("\n");
}

function createAnalyticsSummaryCsv(sites: ShopSiteRecord[]) {
  const headers = [
    "coach_name",
    "public_url",
    "source",
    "page_views",
    "cta_clicks",
    "whatsapp_clicks",
    "video_plays"
  ];
  return [
    headers.join(","),
    ...sites.map((site) =>
      [site.coachName, site.publicUrl, site.source, "0", "0", "0", "0"].map(csvEscape).join(",")
    )
  ].join("\n");
}

async function seedShopPaymentSettings(db: D1Database, env: ShopEnv) {
  const existing = await db
    .prepare(`SELECT id FROM shop_payment_settings WHERE id = ?1 LIMIT 1`)
    .bind(SHOP_SETTINGS_ID)
    .first<{ id: string }>();
  if (existing) return;

  const seedUrl = sanitizeUrl(env.SHOP_PAYMENT_PAGE_URL || "");
  if (!seedUrl) return;
  await db
    .prepare(
      `INSERT INTO shop_payment_settings (
        id, payment_page_url, provider_label, package_label, active, updated_at, updated_by
      ) VALUES (?1, ?2, 'Razorpay', 'Premium coach website', 1, ?3, 'initial_shop_seed')`
    )
    .bind(SHOP_SETTINGS_ID, seedUrl, getNowSeconds())
    .run();
}

async function getAvailableShopSlug(db: D1Database, value: string, currentOrderId = "") {
  const base = normalizeCoachSlug(value || "coach-website") || "coach-website";
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const existingInShop = await db
      .prepare(`SELECT order_id, slug FROM shop_sites WHERE slug = ?1 LIMIT 1`)
      .bind(candidate)
      .first<{ order_id: string; slug: string }>();
    if (existingInShop && existingInShop.order_id !== currentOrderId) continue;
    if (existingInShop && existingInShop.order_id === currentOrderId) return candidate;

    if (!(await coachSiteSlugExists(db, candidate))) return candidate;
  }

  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getExistingShopClientAccessKey(db: D1Database, orderId: string) {
  try {
    const row = await db
      .prepare(`SELECT client_access_key FROM shop_sites WHERE order_id = ?1 LIMIT 1`)
      .bind(sanitizeText(orderId, 160))
      .first<{ client_access_key: string }>();
    return sanitizeText(row?.client_access_key, 120);
  } catch {
    return "";
  }
}

async function findAutoRecoverableSignedPaymentCandidate(db: D1Database, order: ShopSiteRecord) {
  const orderCreatedAt = isoStringToSeconds(order.createdAt) || getNowSeconds();
  const recentCutoff = Math.max(0, orderCreatedAt - 15 * 60);
  const rows = await db
    .prepare(
      `SELECT * FROM shop_failures
       WHERE stage = 'webhook_order_match'
         AND recovery_status = 'needs_review'
         AND created_at >= ?1
         AND message LIKE '%payment pay_%'
         AND (
           message LIKE '%event payment.captured%'
           OR message LIKE '%event order.paid%'
           OR message LIKE '%event payment_link.paid%'
           OR message LIKE '%event payment_page.paid%'
         )
       ORDER BY created_at DESC
       LIMIT 120`
    )
    .bind(recentCutoff)
    .all<ShopFailureRow>();

  const byPaymentId = new Map<
    string,
    {
      contactMatched: boolean;
      createdAt: number;
      payerEmail: string;
      paymentId: string;
    }
  >();

  for (const row of rows.results || []) {
    const paymentId = extractRazorpayPaymentId(row.message);
    const payerEmail = sanitizeEmail(row.coach_email);
    const createdAt = Number(row.created_at) || 0;
    if (!paymentId || !payerEmail) continue;
    if (await shopPaymentReferenceBelongsToAnotherOrder(db, paymentId, order.orderId)) continue;

    const contactMatched = sanitizeEmail(order.coachEmail) === payerEmail;
    const existing = byPaymentId.get(paymentId);
    if (existing && existing.createdAt >= createdAt) continue;

    byPaymentId.set(paymentId, {
      contactMatched,
      createdAt,
      payerEmail,
      paymentId
    });
  }

  const candidates = [...byPaymentId.values()].sort((left, right) => {
    if (left.contactMatched !== right.contactMatched) return left.contactMatched ? -1 : 1;
    return right.createdAt - left.createdAt;
  });

  return candidates[0] || null;
}

async function shopPaymentReferenceBelongsToAnotherOrder(
  db: D1Database,
  paymentId: string,
  orderId: string
) {
  const row = await db
    .prepare(
      `SELECT order_id FROM shop_sites
       WHERE payment_reference = ?1
         AND order_id != ?2
       LIMIT 1`
    )
    .bind(sanitizeText(paymentId, 80), sanitizeText(orderId, 160))
    .first<{ order_id: string }>();

  return Boolean(row?.order_id);
}

async function findSignedUnmatchedShopPaymentFailure(
  db: D1Database,
  {
    payerEmail,
    providerPaymentId
  }: {
    payerEmail: string;
    providerPaymentId: string;
  }
) {
  const cleanEmail = sanitizeEmail(payerEmail);
  const cleanPaymentId = sanitizeText(providerPaymentId, 80);
  if (!cleanEmail || !isRazorpayPaymentId(cleanPaymentId)) return null;

  return db
    .prepare(
      `SELECT * FROM shop_failures
       WHERE stage = 'webhook_order_match'
         AND lower(coach_email) = ?1
         AND message LIKE ?2
         AND (
           message LIKE '%event payment.captured%'
           OR message LIKE '%event order.paid%'
           OR message LIKE '%event payment_link.paid%'
           OR message LIKE '%event payment_page.paid%'
         )
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(cleanEmail, `%payment ${cleanPaymentId}%`)
    .first<ShopFailureRow>();
}

async function getShopOrderByIdempotencyKey(db: D1Database, idempotencyKey: string) {
  try {
    const row = await db
      .prepare(`SELECT * FROM shop_sites WHERE idempotency_key = ?1 LIMIT 1`)
      .bind(sanitizeText(idempotencyKey, 160))
      .first<ShopSiteRow>();
    const order = row ? shopSiteRowToRecord(row) : null;
    return order && isAutoResumableShopDraft(order) ? order : null;
  } catch {
    return null;
  }
}

function isAutoResumableShopDraft(order: ShopSiteRecord) {
  return (
    (order.paymentStatus === "draft" && order.siteStatus === "draft") ||
    (order.paymentStatus === "payment_failed" && order.siteStatus === "payment_failed") ||
    (order.paymentStatus === "pending_payment" && order.siteStatus === "pending_payment")
  );
}

async function getActiveShopDraftByEmail(db: D1Database, email: string) {
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) return null;

  try {
    const row = await db
      .prepare(
        `SELECT * FROM shop_sites
         WHERE lower(coach_email) = ?1
           AND locked_at IS NULL
           AND (
             (payment_status IN ('draft', 'incomplete', 'payment_failed')
               AND site_status IN ('draft', 'incomplete', 'payment_failed'))
             OR (payment_status = 'pending_payment' AND site_status = 'pending_payment')
           )
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .bind(cleanEmail)
      .first<ShopSiteRow>();
    return row ? shopSiteRowToRecord(row) : null;
  } catch {
    return null;
  }
}

async function findPendingShopOrderConflictForContact(
  db: D1Database,
  state: Pick<ShopBuilderState, "coachEmail" | "coachPhone" | "email">,
  allowedOrderId = ""
) {
  const cleanEmail = sanitizeEmail(state.email || state.coachEmail);
  const cleanPhone = normalizePhoneDigits(state.coachPhone);
  if (!cleanEmail && !cleanPhone) return null;

  try {
    const rows = await db
      .prepare(
        `SELECT * FROM shop_sites
         WHERE payment_status = 'pending_payment'
           AND site_status = 'pending_payment'
           AND order_id <> ?1
         ORDER BY updated_at DESC
         LIMIT 100`
      )
      .bind(sanitizeText(allowedOrderId, 160))
      .all<ShopSiteRow>();

    return (
      (rows.results || []).map(shopSiteRowToRecord).find((order) => {
        const emailMatches = Boolean(cleanEmail && sanitizeEmail(order.coachEmail) === cleanEmail);
        const phoneMatches = Boolean(
          cleanPhone && normalizePhoneDigits(order.coachPhone) === cleanPhone
        );

        return emailMatches || phoneMatches;
      }) || null
    );
  } catch {
    return null;
  }
}

function createClientAccessKey() {
  return `shop-access-${crypto.randomUUID()}`;
}

async function coachSiteSlugExists(db: D1Database, slug: string) {
  try {
    const existing = await db
      .prepare(`SELECT slug FROM coach_sites WHERE slug = ?1 LIMIT 1`)
      .bind(slug)
      .first<{ slug: string }>();
    return Boolean(existing);
  } catch {
    return false;
  }
}

async function coachSiteNameExists(db: D1Database, coachName: string) {
  const cleanName = sanitizeText(coachName, 160);
  if (!cleanName) return false;

  try {
    const existing = await db
      .prepare(
        `SELECT coach_name
         FROM coach_sites
         WHERE status <> 'removed' AND lower(coach_name) = lower(?1)
         LIMIT 1`
      )
      .bind(cleanName)
      .first<{ coach_name: string }>();
    return Boolean(existing);
  } catch {
    return false;
  }
}

function isDuplicateColumnMigration(error: unknown) {
  return error instanceof Error && /duplicate column name|already exists/i.test(error.message);
}

function appendShopOrderToPaymentUrl(paymentUrl: string, orderId: string) {
  const url = new URL(paymentUrl);
  url.searchParams.set("shop_order_id", orderId);
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("reference_id", orderId);
  url.searchParams.set("source", "ywcoach_shop");
  return url.toString();
}

function isRazorpayPaymentId(value: string) {
  return /^pay_[A-Za-z0-9]{8,}$/.test(value.trim());
}

function extractRazorpayPaymentId(value: string) {
  const match = value.match(/\bpay_[A-Za-z0-9]{8,}\b/);
  return match ? match[0] : "";
}

function isoStringToSeconds(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.floor(time / 1000) : 0;
}

function shopOrderContactMatchesPayment(
  order: Pick<ShopSiteRecord, "coachEmail" | "coachPhone">,
  paymentContact: { email?: string; phone?: string }
) {
  const payerEmail = sanitizeEmail(paymentContact.email);
  const payerPhone = normalizePhoneDigits(paymentContact.phone);

  if (!payerEmail && !payerPhone) return false;
  if (payerEmail && sanitizeEmail(order.coachEmail) === payerEmail) return true;
  if (payerPhone && normalizePhoneDigits(order.coachPhone) === payerPhone) return true;

  return false;
}

function canRecoverLegacyBlankContactOrder(
  order: Pick<ShopSiteRecord, "coachEmail" | "coachPhone" | "paymentStatus" | "siteStatus">,
  paymentContact: { email?: string; phone?: string }
) {
  const orderEmail = sanitizeEmail(order.coachEmail);
  const orderPhone = normalizePhoneDigits(order.coachPhone);
  const payerEmail = sanitizeEmail(paymentContact.email);
  const payerPhone = normalizePhoneDigits(paymentContact.phone);

  if (orderEmail || orderPhone) return { ok: false as const };
  if (!payerEmail && !payerPhone) return { ok: false as const };
  if (order.paymentStatus !== "pending_payment" || order.siteStatus !== "pending_payment") {
    return { ok: false as const };
  }

  return {
    email: payerEmail,
    ok: true as const,
    phone: payerPhone
  };
}

function settingsRowToPublic(
  row: ShopSettingsRow,
  storageSource: ShopPaymentSettings["storageSource"]
): ShopPaymentSettings {
  return {
    active: isTruthy(row.active),
    lastUpdatedAt: secondsToIso(row.updated_at),
    lastUpdatedBy: row.updated_by || "Not recorded",
    packageLabel: row.package_label || "Premium coach website",
    paymentPageUrl: row.payment_page_url || "",
    providerLabel: row.provider_label || "Razorpay",
    storageSource
  };
}

function shopSiteRowToRecord(row: ShopSiteRow): ShopSiteRecord {
  const parsed = parseJson<Record<string, unknown>>(row.builder_json, {});
  const state = normalizeShopBuilderState({
    ...parsed,
    coachEmail: row.coach_email,
    coachName: row.coach_name,
    coachPhone: row.coach_phone,
    contactLink: row.contact_link,
    location: row.location,
    niche: row.niche,
    orderId: row.order_id,
    selectedThemeId: row.selected_theme_id,
    slug: row.slug,
    status: row.site_status
  });

  return {
    coachEmail: row.coach_email || state.email,
    coachName: row.coach_name || state.coachName,
    coachPhone: row.coach_phone || state.coachPhone,
    contactLink: row.contact_link || state.contactLink,
    contentSummary: summarizeContent(row.content_json),
    createdAt: secondsToIso(row.created_at) || "",
    id: row.id,
    issueStatus: row.issue_status || "",
    location: row.location || state.location,
    lockedAt: secondsToIso(row.locked_at),
    niche: row.niche || state.niche,
    orderId: row.order_id,
    paymentDate: secondsToIso(row.payment_date),
    paymentReference: row.payment_reference || "",
    paymentStatus: normalizeStatus(row.payment_status),
    publicUrl: row.public_url || `/coach/${row.slug}`,
    publishedAt: secondsToIso(row.published_at),
    retryCount: normalizeNumber(row.retry_count),
    selectedThemeId: state.selectedThemeId,
    siteStatus: normalizeStatus(row.site_status),
    slug: row.slug,
    source: "shop_purchased",
    state,
    updatedAt: secondsToIso(row.updated_at) || "",
    workflowStage: row.workflow_stage || ""
  };
}

function auditRowToRecord(row: ShopAuditRow): ShopPaymentAuditRecord {
  return {
    action: row.action,
    active: isTruthy(row.active),
    adminEmail: row.admin_email,
    createdAt: secondsToIso(row.created_at) || "",
    id: row.id,
    newUrlSummary: row.new_url_summary,
    oldUrlSummary: row.old_url_summary,
    packageLabel: row.package_label,
    providerLabel: row.provider_label
  };
}

function failureRowToRecord(row: ShopFailureRow): ShopFailureRecord {
  const severity =
    row.severity === "critical" || row.severity === "high" || row.severity === "low"
      ? row.severity
      : "medium";
  return {
    coachEmail: row.coach_email,
    coachName: row.coach_name,
    createdAt: secondsToIso(row.created_at) || "",
    id: row.id,
    message: row.message,
    orderId: row.order_id,
    recoveryStatus: row.recovery_status,
    severity,
    stage: row.stage
  };
}

function validateShopPaymentUrl(value: string) {
  if (!value) return { ok: false as const, error: "Shop payment URL is required." };
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return { ok: false as const, error: "Shop payment URL must use HTTPS." };
    }
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url.hostname)) {
      return { ok: false as const, error: "Shop payment URL cannot use localhost." };
    }
    if (/[?&](key|secret|token|password)=/i.test(url.search)) {
      return { ok: false as const, error: "Remove private keys or tokens from the payment URL." };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Enter a valid HTTPS payment URL." };
  }
}

function summarizeUrl(value: string) {
  if (!value) return "empty";
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function summarizeContent(value: string) {
  const parsed = parseJson<Record<string, unknown>>(value, {});
  const headline = String(parsed.heroHeadline || "").slice(0, 120);
  const cta = String(parsed.ctaText || "").slice(0, 80);
  return [headline, cta].filter(Boolean).join(" | ");
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeStatus(value: unknown): ShopBuilderStatus {
  if (
    value === "abandoned" ||
    value === "archived" ||
    value === "draft" ||
    value === "paid" ||
    value === "payment_failed" ||
    value === "pending_payment" ||
    value === "paused" ||
    value === "publish_failed" ||
    value === "published" ||
    value === "publishing" ||
    value === "removed"
  ) {
    return value;
  }
  return "draft";
}

function sanitizeUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(value: unknown) {
  return sanitizeText(value, 240).toLowerCase();
}

function isValidShopDraftEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function normalizePhoneDigits(value: unknown) {
  return sanitizeText(value, 80).replace(/\D/g, "").slice(-12);
}

function secondsToIso(value: unknown) {
  const seconds = normalizeNumber(value);
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function normalizeNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isTruthy(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
