import type { D1Database } from "@cloudflare/workers-types";
import type { Funnel } from "../coach-platform";

export type PrivateFunnelLinkEnv = {
  ADMIN_DB?: D1Database;
};

export type PrivateWhatsappLinkStorageSource = "d1_table" | "none";

export type PrivateWhatsappLinkMetadata = {
  configured: boolean;
  funnelId: string;
  storageSource: PrivateWhatsappLinkStorageSource;
  updatedAt: string | null;
  updatedBy: string;
};

export type PrivateWhatsappLinkRecord = PrivateWhatsappLinkMetadata & {
  whatsappGroupUrl: string;
};

type PrivateFunnelLinkRow = {
  funnel_id: string;
  updated_at: number | string;
  updated_by: string;
  whatsapp_group_url: string;
};

const PRIVATE_FUNNEL_LINK_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS private_funnel_links (
    funnel_id TEXT PRIMARY KEY,
    whatsapp_group_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_private_funnel_links_status_updated_at
   ON private_funnel_links (status, updated_at DESC)`
];

export async function getPrivateWhatsappGroupUrl(funnel: Funnel, env: PrivateFunnelLinkEnv) {
  const record = await getPrivateWhatsappLinkRecord(funnel, env);

  return record?.whatsappGroupUrl || null;
}

export async function getPrivateWhatsappLinkMetadata(
  funnel: Funnel,
  env: PrivateFunnelLinkEnv
): Promise<PrivateWhatsappLinkMetadata> {
  const record = await getPrivateWhatsappLinkRecord(funnel, env);

  return {
    configured: Boolean(record),
    funnelId: funnel.id,
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
    metadata: {
      configured: true,
      funnelId: funnel.id,
      storageSource: "d1_table" as const,
      updatedAt: secondsToIso(now),
      updatedBy
    },
    ok: true as const
  };
}

async function getPrivateWhatsappLinkFromDb(
  funnelId: string,
  db?: D1Database
): Promise<PrivateWhatsappLinkRecord | null> {
  if (!db) return null;

  try {
    const row = await db
      .prepare(
        `SELECT funnel_id, whatsapp_group_url, updated_at, updated_by
         FROM private_funnel_links
         WHERE funnel_id = ?1 AND status = 'active'
         LIMIT 1`
      )
      .bind(funnelId)
      .first<PrivateFunnelLinkRow>();

    if (!row || !isAllowedWhatsappInviteUrl(row.whatsapp_group_url)) return null;

    return {
      configured: true,
      funnelId: row.funnel_id,
      storageSource: "d1_table",
      updatedAt: secondsToIso(row.updated_at),
      updatedBy: row.updated_by || "Admin",
      whatsappGroupUrl: row.whatsapp_group_url
    };
  } catch {
    return null;
  }
}

async function ensurePrivateFunnelLinksSchema(db: D1Database) {
  for (const statement of PRIVATE_FUNNEL_LINK_SCHEMA) {
    await db.prepare(statement).run();
  }
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

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function secondsToIso(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds)) return null;

  return new Date(seconds * 1000).toISOString();
}
