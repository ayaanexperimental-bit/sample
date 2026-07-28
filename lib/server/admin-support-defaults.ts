import type { D1Database } from "@cloudflare/workers-types";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";

export type AdminSupportDefaultsEnv = {
  ADMIN_DB?: D1Database;
  NEXT_PUBLIC_SUPPORT_EMAIL?: string;
  NEXT_PUBLIC_SUPPORT_MESSAGE?: string;
  NEXT_PUBLIC_SUPPORT_NAME?: string;
  NEXT_PUBLIC_SUPPORT_PHONE?: string;
  NEXT_PUBLIC_SUPPORT_WHATSAPP?: string;
};

export type AdminSupportDefaults = {
  source: "d1_table" | "env";
  supportEmail: string;
  supportMessage: string;
  supportName: string;
  supportPhone: string;
  supportWhatsapp: string;
  updatedAt: string | null;
  updatedBy: string;
};

export type AdminSupportDefaultsInput = {
  supportEmail?: unknown;
  supportMessage?: unknown;
  supportName?: unknown;
  supportPhone?: unknown;
  supportWhatsapp?: unknown;
};

type AdminSupportDefaultsRow = {
  support_email: string | null;
  support_message: string | null;
  support_name: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
  updated_at: number | string;
  updated_by: string | null;
};

const SUPPORT_DEFAULTS_ID = "default";
const supportDefaultsSchemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();

const SUPPORT_DEFAULTS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_support_defaults (
    id TEXT PRIMARY KEY,
    support_name TEXT NOT NULL DEFAULT '',
    support_email TEXT NOT NULL DEFAULT '',
    support_phone TEXT NOT NULL DEFAULT '',
    support_whatsapp TEXT NOT NULL DEFAULT '',
    support_message TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL DEFAULT ''
  )`
];

export async function getAdminSupportDefaults(
  env: AdminSupportDefaultsEnv
): Promise<AdminSupportDefaults> {
  if (env.ADMIN_DB) {
    await ensureSupportDefaultsSchema(env.ADMIN_DB);
    const row = await env.ADMIN_DB.prepare(
      `SELECT support_name, support_email, support_phone, support_whatsapp,
              support_message, updated_at, updated_by
       FROM admin_support_defaults
       WHERE id = ?1
       LIMIT 1`
    )
      .bind(SUPPORT_DEFAULTS_ID)
      .first<AdminSupportDefaultsRow>();

    if (row) return rowToSupportDefaults(row);
  }

  return getEnvSupportDefaults(env);
}

export async function updateAdminSupportDefaults({
  env,
  input,
  updatedBy
}: {
  env: AdminSupportDefaultsEnv;
  input: AdminSupportDefaultsInput;
  updatedBy: string;
}) {
  if (!env.ADMIN_DB) {
    return {
      error: "Support defaults database is not configured.",
      ok: false as const
    };
  }

  const normalized = normalizeAdminSupportDefaultsInput(input);
  if (!normalized.ok) return normalized;

  await ensureSupportDefaultsSchema(env.ADMIN_DB);

  const now = Math.floor(Date.now() / 1000);
  await env.ADMIN_DB.prepare(
    `INSERT INTO admin_support_defaults (
      id,
      support_name,
      support_email,
      support_phone,
      support_whatsapp,
      support_message,
      created_at,
      updated_at,
      updated_by
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)
    ON CONFLICT(id) DO UPDATE SET
      support_name = excluded.support_name,
      support_email = excluded.support_email,
      support_phone = excluded.support_phone,
      support_whatsapp = excluded.support_whatsapp,
      support_message = excluded.support_message,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by`
  )
    .bind(
      SUPPORT_DEFAULTS_ID,
      normalized.defaults.supportName,
      normalized.defaults.supportEmail,
      normalized.defaults.supportPhone,
      normalized.defaults.supportWhatsapp,
      normalized.defaults.supportMessage,
      now,
      updatedBy
    )
    .run();

  return {
    defaults: await getAdminSupportDefaults(env),
    ok: true as const
  };
}

export function normalizeAdminSupportDefaultsInput(input: AdminSupportDefaultsInput) {
  const supportName = stringValue(input.supportName);
  const supportEmail = stringValue(input.supportEmail).toLowerCase();
  const supportPhone = stringValue(input.supportPhone);
  const supportWhatsapp = stringValue(input.supportWhatsapp);
  const supportMessage = stringValue(input.supportMessage);

  if (supportName.length < 2 || supportName.length > 80) {
    return { error: "Support name must be 2 to 80 characters.", ok: false as const };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) || supportEmail.length > 120) {
    return { error: "Enter a valid support email.", ok: false as const };
  }

  if (supportPhone && !/^[0-9+\-\s()]{7,24}$/.test(supportPhone)) {
    return { error: "Enter a valid support phone number or leave it blank.", ok: false as const };
  }

  if (supportWhatsapp && !isAllowedWhatsappSupportUrl(supportWhatsapp)) {
    return {
      error: "Enter a valid WhatsApp support URL or leave it blank.",
      ok: false as const
    };
  }

  if (supportMessage.length < 12 || supportMessage.length > 240) {
    return { error: "Support message must be 12 to 240 characters.", ok: false as const };
  }

  return {
    defaults: {
      supportEmail,
      supportMessage,
      supportName,
      supportPhone,
      supportWhatsapp
    },
    ok: true as const
  };
}

async function ensureSupportDefaultsSchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: supportDefaultsSchemaCache,
    db,
    setup: async () => {
      for (const statement of SUPPORT_DEFAULTS_SCHEMA) {
        await db.prepare(statement).run();
      }
    }
  });
}

function rowToSupportDefaults(row: AdminSupportDefaultsRow): AdminSupportDefaults {
  return {
    source: "d1_table",
    supportEmail: stringValue(row.support_email),
    supportMessage: stringValue(row.support_message),
    supportName: stringValue(row.support_name),
    supportPhone: stringValue(row.support_phone),
    supportWhatsapp: stringValue(row.support_whatsapp),
    updatedAt: secondsToIso(row.updated_at),
    updatedBy: stringValue(row.updated_by) || "Admin"
  };
}

function getEnvSupportDefaults(env: AdminSupportDefaultsEnv): AdminSupportDefaults {
  return {
    source: "env",
    supportEmail: env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@ywcoach.com",
    supportMessage:
      env.NEXT_PUBLIC_SUPPORT_MESSAGE ||
      "We could not complete this step. Please contact support for help.",
    supportName: env.NEXT_PUBLIC_SUPPORT_NAME || "Yours Wellness Support",
    supportPhone: env.NEXT_PUBLIC_SUPPORT_PHONE || "",
    supportWhatsapp: env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "",
    updatedAt: null,
    updatedBy: "Environment fallback"
  };
}

function isAllowedWhatsappSupportUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (hostname === "wa.me" || hostname === "api.whatsapp.com" || hostname === "chat.whatsapp.com")
    );
  } catch {
    return false;
  }
}

function secondsToIso(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds)) return null;

  return new Date(seconds * 1000).toISOString();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
