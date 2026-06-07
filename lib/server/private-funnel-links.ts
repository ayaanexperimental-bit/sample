import type { D1Database } from "@cloudflare/workers-types";
import type { Funnel } from "../coach-platform";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";

export type PrivateFunnelLinkEnv = {
  ADMIN_DB?: D1Database;
};

export type PrivateWhatsappLinkStorageSource = "d1_table" | "none";

export type PrivateWhatsappLinkMetadata = {
  configured: boolean;
  funnelId: string;
  paymentPageConfigured: boolean;
  paymentPageStorageSource: PrivateWhatsappLinkStorageSource;
  paymentPageUpdatedAt: string | null;
  paymentPageUpdatedBy: string;
  storageSource: PrivateWhatsappLinkStorageSource;
  updatedAt: string | null;
  updatedBy: string;
};

export type PrivateWhatsappLinkRecord = PrivateWhatsappLinkMetadata & {
  paymentPageUrl: string;
  whatsappGroupUrl: string;
};

type PrivateFunnelLinkRow = {
  payment_page_url?: string;
  payment_updated_at?: number | string;
  payment_updated_by?: string;
  funnel_id: string;
  updated_at: number | string;
  updated_by: string;
  whatsapp_group_url: string;
};

const PRIVATE_FUNNEL_LINK_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS private_funnel_links (
    funnel_id TEXT PRIMARY KEY,
    whatsapp_group_url TEXT NOT NULL DEFAULT '',
    payment_page_url TEXT NOT NULL DEFAULT '',
    payment_updated_at INTEGER NOT NULL DEFAULT 0,
    payment_updated_by TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_private_funnel_links_status_updated_at
   ON private_funnel_links (status, updated_at DESC)`
];
const privateFunnelLinksSchemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();

export async function getPrivateWhatsappGroupUrl(funnel: Funnel, env: PrivateFunnelLinkEnv) {
  const record = await getPrivateWhatsappLinkRecord(funnel, env);

  return record?.whatsappGroupUrl || null;
}

export async function getPrivatePaymentPageUrl(funnel: Funnel, env: PrivateFunnelLinkEnv) {
  const record = await getPrivateWhatsappLinkRecord(funnel, env);

  return record?.paymentPageUrl || null;
}

export async function getPrivateWhatsappLinkMetadata(
  funnel: Funnel,
  env: PrivateFunnelLinkEnv
): Promise<PrivateWhatsappLinkMetadata> {
  const record = await getPrivateWhatsappLinkRecord(funnel, env);

  return {
    configured: Boolean(record),
    funnelId: funnel.id,
    paymentPageConfigured: Boolean(record?.paymentPageUrl),
    paymentPageStorageSource: record?.paymentPageUrl ? "d1_table" : "none",
    paymentPageUpdatedAt: record?.paymentPageUpdatedAt || null,
    paymentPageUpdatedBy: record?.paymentPageUpdatedBy || "Not recorded yet",
    storageSource: record?.storageSource || "none",
    updatedAt: record?.updatedAt || null,
    updatedBy: record?.updatedBy || "Not recorded yet"
  };
}

export async function getPrivateWhatsappLinkRecord(
  funnel: Funnel,
  env: PrivateFunnelLinkEnv
): Promise<PrivateWhatsappLinkRecord | null> {
  return getPrivateWhatsappLinkFromDb(funnel.id, env.ADMIN_DB);
}

export async function upsertPrivateWhatsappGroupUrl({
  env,
  funnel,
  updatedBy,
  whatsappGroupUrl
}: {
  env: PrivateFunnelLinkEnv;
  funnel: Funnel;
  updatedBy: string;
  whatsappGroupUrl: string;
}) {
  if (!env.ADMIN_DB) {
    return { ok: false as const, error: "Private link database is not configured." };
  }

  const normalizedUrl = whatsappGroupUrl.trim();
  if (!isAllowedWhatsappInviteUrl(normalizedUrl)) {
    return {
      ok: false as const,
      error: "Enter a valid WhatsApp invite URL starting with https://chat.whatsapp.com/."
    };
  }

  await ensurePrivateFunnelLinksSchema(env.ADMIN_DB);

  const now = getNowSeconds();
  await env.ADMIN_DB.prepare(
    `INSERT INTO private_funnel_links (
      funnel_id,
      whatsapp_group_url,
      status,
      created_at,
      updated_at,
      updated_by
    )
    VALUES (?1, ?2, 'active', ?3, ?3, ?4)
    ON CONFLICT(funnel_id) DO UPDATE SET
      whatsapp_group_url = excluded.whatsapp_group_url,
      status = 'active',
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`
  )
    .bind(funnel.id, normalizedUrl, now, updatedBy)
    .run();

  return {
    metadata: await getPrivateWhatsappLinkMetadata(funnel, env),
    ok: true as const
  };
}

export async function upsertPrivatePaymentPageUrl({
  env,
  funnel,
  paymentPageUrl,
  updatedBy
}: {
  env: PrivateFunnelLinkEnv;
  funnel: Funnel;
  paymentPageUrl: string;
  updatedBy: string;
}) {
  if (!env.ADMIN_DB) {
    return { ok: false as const, error: "Private link database is not configured." };
  }

  const normalizedUrl = paymentPageUrl.trim();
  if (!isAllowedPaymentPageUrl(normalizedUrl)) {
    return {
      ok: false as const,
      error: "Enter a valid Razorpay payment page URL."
    };
  }

  await ensurePrivateFunnelLinksSchema(env.ADMIN_DB);

  const now = getNowSeconds();
  await env.ADMIN_DB.prepare(
    `INSERT INTO private_funnel_links (
      funnel_id,
      whatsapp_group_url,
      payment_page_url,
      payment_updated_at,
      payment_updated_by,
      status,
      created_at,
      updated_at,
      updated_by
    )
    VALUES (?1, '', ?2, ?3, ?4, 'active', ?3, ?3, ?4)
    ON CONFLICT(funnel_id) DO UPDATE SET
      payment_page_url = excluded.payment_page_url,
      payment_updated_at = excluded.payment_updated_at,
      payment_updated_by = excluded.payment_updated_by,
      status = 'active'`
  )
    .bind(funnel.id, normalizedUrl, now, updatedBy)
    .run();

  return {
    metadata: await getPrivateWhatsappLinkMetadata(funnel, env),
    ok: true as const
  };
}

async function getPrivateWhatsappLinkFromDb(
  funnelId: string,
  db?: D1Database
): Promise<PrivateWhatsappLinkRecord | null> {
  if (!db) return null;

  try {
    await ensurePrivateFunnelLinksSchema(db);

    const row = await db
      .prepare(
        `SELECT funnel_id, whatsapp_group_url, payment_page_url, payment_updated_at,
                payment_updated_by, updated_at, updated_by
         FROM private_funnel_links
         WHERE funnel_id = ?1 AND status = 'active'
         LIMIT 1`
      )
      .bind(funnelId)
      .first<PrivateFunnelLinkRow>();

    if (!row) return null;
    const whatsappGroupUrl = isAllowedWhatsappInviteUrl(row.whatsapp_group_url)
      ? row.whatsapp_group_url
      : "";
    const paymentPageUrl = isAllowedPaymentPageUrl(row.payment_page_url || "")
      ? row.payment_page_url || ""
      : "";

    if (!whatsappGroupUrl && !paymentPageUrl) return null;

    return {
      configured: Boolean(whatsappGroupUrl),
      funnelId: row.funnel_id,
      paymentPageConfigured: Boolean(paymentPageUrl),
      paymentPageStorageSource: paymentPageUrl ? "d1_table" : "none",
      paymentPageUpdatedAt: paymentPageUrl ? secondsToIso(row.payment_updated_at) : null,
      paymentPageUpdatedBy: paymentPageUrl
        ? row.payment_updated_by || "Admin"
        : "Not recorded yet",
      paymentPageUrl,
      storageSource: whatsappGroupUrl ? "d1_table" : "none",
      updatedAt: whatsappGroupUrl ? secondsToIso(row.updated_at) : null,
      updatedBy: whatsappGroupUrl ? row.updated_by || "Admin" : "Not recorded yet",
      whatsappGroupUrl
    };
  } catch {
    return null;
  }
}

async function ensurePrivateFunnelLinksSchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: privateFunnelLinksSchemaCache,
    db,
    setup: async () => {
      for (const statement of PRIVATE_FUNNEL_LINK_SCHEMA) {
        await db.prepare(statement).run();
      }

      const compatibilityColumns = [
        "ALTER TABLE private_funnel_links ADD COLUMN payment_page_url TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE private_funnel_links ADD COLUMN payment_updated_at INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE private_funnel_links ADD COLUMN payment_updated_by TEXT NOT NULL DEFAULT ''"
      ];

      for (const statement of compatibilityColumns) {
        try {
          await db.prepare(statement).run();
        } catch {
          // Existing production tables already have this column.
        }
      }
    }
  });
}

function isAllowedWhatsappInviteUrl(value: string) {
  if (!value) return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" && url.hostname === "chat.whatsapp.com" && url.pathname !== "/"
    );
  } catch {
    return false;
  }
}

export function isAllowedPaymentPageUrl(value: string) {
  if (!value) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      url.pathname !== "/" &&
      (hostname === "pages.razorpay.com" ||
        hostname === "rzp.io" ||
        hostname.endsWith(".razorpay.com"))
    );
  } catch {
    return false;
  }
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function secondsToIso(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds)) return null;

  return new Date(seconds * 1000).toISOString();
}
