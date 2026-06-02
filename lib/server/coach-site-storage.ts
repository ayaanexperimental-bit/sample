import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {
  type CoachHeroMediaType,
  type CoachSiteAnalyticsSummary,
  type CoachSiteContent,
  type CoachSiteRecord,
  type CoachSiteStatus,
  createCoachSiteFromForm,
  getCoachPublicUrl,
  normalizeCoachSlug,
  toPublicCoachSiteRecord
} from "../admin-coach-sites";
import { normalizeCoachTemplateThemeId } from "../coach-template-themes";

export type CoachSiteStorageEnv = {
  ADMIN_DB?: D1Database;
  COACH_MEDIA_BUCKET?: R2Bucket;
};

type CoachSiteRow = {
  analytics_json: string;
  bio: string;
  coach_email: string;
  coach_id: string;
  coach_name: string;
  coach_phone: string;
  content_json: string;
  created_at: number;
  created_by: string;
  google_form_url: string;
  hero_media_type: CoachHeroMediaType;
  id: string;
  location: string;
  logo_url: string;
  niche: string;
  photo_url: string;
  public_url: string;
  register_button_text: string;
  selected_theme_id: string | null;
  slug: string;
  status: CoachSiteStatus;
  support_text: string;
  video_url: string;
  vision: string;
  whatsapp_link: string;
};

type CoachSitePayload = Partial<CoachSiteRecord> & {
  status?: CoachSiteStatus;
};

const COACH_SITE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS coach_sites (
    id TEXT PRIMARY KEY,
    coach_id TEXT NOT NULL,
    coach_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('archived', 'draft', 'paused', 'published', 'removed')),
    niche TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    vision TEXT NOT NULL DEFAULT '',
    coach_email TEXT NOT NULL DEFAULT '',
    coach_phone TEXT NOT NULL DEFAULT '',
    whatsapp_link TEXT NOT NULL DEFAULT '',
    photo_url TEXT NOT NULL DEFAULT '',
    logo_url TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    google_form_url TEXT NOT NULL DEFAULT '',
    hero_media_type TEXT NOT NULL DEFAULT 'image' CHECK (hero_media_type IN ('image', 'none', 'video')),
    public_url TEXT NOT NULL,
    register_button_text TEXT NOT NULL DEFAULT 'Register Now',
    selected_theme_id TEXT NOT NULL DEFAULT 'default-current',
    support_text TEXT NOT NULL DEFAULT '',
    content_json TEXT NOT NULL,
    analytics_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    published_at INTEGER,
    archived_at INTEGER,
    created_by TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_coach_sites_status_updated_at
    ON coach_sites (status, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coach_sites_slug
    ON coach_sites (slug)`,
  `CREATE TABLE IF NOT EXISTS coach_site_media (
    id TEXT PRIMARY KEY,
    coach_site_id TEXT,
    slug TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    deleted_at INTEGER,
    FOREIGN KEY (coach_site_id) REFERENCES coach_sites(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_coach_site_media_slug_created_at
    ON coach_site_media (slug, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_coach_site_media_deleted_at
    ON coach_site_media (deleted_at)`
];

const COACH_SITE_MIGRATIONS_SQL = [
  `ALTER TABLE coach_sites ADD COLUMN selected_theme_id TEXT NOT NULL DEFAULT 'default-current'`
];

const DEFAULT_ANALYTICS: CoachSiteAnalyticsSummary = {
  averageVisits: 0,
  conversionRate: "0%",
  dailyVisits: 0,
  deviceBreakdown: {
    desktop: 0,
    mobile: 0,
    tablet: 0
  },
  lastUpdated: "Not connected",
  monthlyVisits: 0,
  region: "Not available",
  source: "Not available",
  totalRegisterClicks: 0,
  totalVisits: 0,
  totalWhatsappClicks: 0,
  videoPlays: 0,
  weeklyVisits: 0
};

export async function ensureCoachSiteTables(env: CoachSiteStorageEnv) {
  if (!env.ADMIN_DB) return false;

  for (const statement of COACH_SITE_TABLES_SQL) {
    await env.ADMIN_DB.prepare(statement).run();
  }

  for (const statement of COACH_SITE_MIGRATIONS_SQL) {
    try {
      await env.ADMIN_DB.prepare(statement).run();
    } catch {
      // Existing databases already have this column.
    }
  }

  return true;
}

export async function listCoachSitesFromDb(env: CoachSiteStorageEnv) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const result = await env.ADMIN_DB.prepare(
    `SELECT * FROM coach_sites
     WHERE status != 'removed'
     ORDER BY updated_at DESC`
  ).all<CoachSiteRow>();

  return result.results.map(rowToCoachSiteRecord);
}

export async function getPublicCoachSiteFromDb(slug: string, env: CoachSiteStorageEnv) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const normalizedSlug = normalizeCoachSlug(slug);
  const row = await env.ADMIN_DB.prepare(
    `SELECT * FROM coach_sites
     WHERE slug = ?1 AND status IN ('published', 'paused')
     LIMIT 1`
  )
    .bind(normalizedSlug)
    .first<CoachSiteRow>();

  return row ? toPublicCoachSiteRecord(rowToCoachSiteRecord(row)) : null;
}

export async function upsertCoachSiteToDb({
  adminEmail,
  env,
  payload
}: {
  adminEmail: string;
  env: CoachSiteStorageEnv;
  payload: CoachSitePayload;
}) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const site = normalizeCoachSitePayload(payload);
  const now = Math.floor(Date.now() / 1000);
  const existing = await env.ADMIN_DB.prepare(
    `SELECT created_at, created_by, published_at, archived_at
     FROM coach_sites
     WHERE id = ?1 OR slug = ?2
     LIMIT 1`
  )
    .bind(site.id, site.slug)
    .first<{
      archived_at: number | null;
      created_at: number;
      created_by: string;
      published_at: number | null;
    }>();

  const createdAt = existing?.created_at || now;
  const createdBy = existing?.created_by || adminEmail;
  const publishedAt =
    site.status === "published" ? existing?.published_at || now : existing?.published_at || null;
  const archivedAt =
    site.status === "archived" || site.status === "removed" ? existing?.archived_at || now : null;

  await env.ADMIN_DB.prepare(
    `INSERT INTO coach_sites (
      id, coach_id, coach_name, slug, status, niche, location, bio, vision,
      coach_email, coach_phone, whatsapp_link, photo_url, logo_url, video_url,
      google_form_url, hero_media_type, public_url, register_button_text, selected_theme_id,
      support_text,
      content_json, analytics_json, created_at, updated_at, published_at, archived_at,
      created_by, updated_by
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
      ?10, ?11, ?12, ?13, ?14, ?15,
      ?16, ?17, ?18, ?19, ?20,
      ?21, ?22, ?23, ?24, ?25, ?26,
      ?27, ?28, ?29
    )
    ON CONFLICT(id) DO UPDATE SET
      coach_id = excluded.coach_id,
      coach_name = excluded.coach_name,
      slug = excluded.slug,
      status = excluded.status,
      niche = excluded.niche,
      location = excluded.location,
      bio = excluded.bio,
      vision = excluded.vision,
      coach_email = excluded.coach_email,
      coach_phone = excluded.coach_phone,
      whatsapp_link = excluded.whatsapp_link,
      photo_url = excluded.photo_url,
      logo_url = excluded.logo_url,
      video_url = excluded.video_url,
      google_form_url = excluded.google_form_url,
      hero_media_type = excluded.hero_media_type,
      public_url = excluded.public_url,
      register_button_text = excluded.register_button_text,
      selected_theme_id = excluded.selected_theme_id,
      support_text = excluded.support_text,
      content_json = excluded.content_json,
      analytics_json = excluded.analytics_json,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at,
      updated_by = excluded.updated_by`
  )
    .bind(
      site.id,
      site.coachId,
      site.coachName,
      site.slug,
      site.status,
      site.niche,
      site.location,
      site.bio,
      site.vision,
      site.coachEmail,
      site.coachPhone,
      site.whatsappLink,
      stripBrowserOnlyMedia(site.photoUrl),
      stripBrowserOnlyMedia(site.logoUrl),
      stripBrowserOnlyMedia(site.videoUrl),
      site.googleFormUrl,
      site.heroMediaType,
      site.publicUrl,
      site.registerButtonText,
      site.selectedThemeId,
      site.supportText,
      JSON.stringify(site.content),
      JSON.stringify(site.analytics),
      createdAt,
      now,
      publishedAt,
      archivedAt,
      createdBy,
      adminEmail
    )
    .run();

  return site;
}

export async function updateCoachSiteStatusInDb({
  adminEmail,
  env,
  id,
  status
}: {
  adminEmail: string;
  env: CoachSiteStorageEnv;
  id: string;
  status: CoachSiteStatus;
}) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const now = Math.floor(Date.now() / 1000);
  await env.ADMIN_DB.prepare(
    `UPDATE coach_sites
     SET status = ?1,
         updated_at = ?2,
         updated_by = ?3,
         published_at = CASE WHEN ?1 = 'published' AND published_at IS NULL THEN ?2 ELSE published_at END,
         archived_at = CASE WHEN ?1 IN ('archived', 'removed') THEN ?2 ELSE NULL END
     WHERE id = ?4`
  )
    .bind(status, now, adminEmail, id)
    .run();

  const row = await env.ADMIN_DB.prepare(`SELECT * FROM coach_sites WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<CoachSiteRow>();

  return row ? rowToCoachSiteRecord(row) : null;
}

export async function insertCoachSiteMedia({
  adminEmail,
  contentType,
  env,
  fileName,
  mediaType,
  objectKey,
  publicUrl,
  sizeBytes,
  slug
}: {
  adminEmail: string;
  contentType: string;
  env: CoachSiteStorageEnv;
  fileName: string;
  mediaType: "image" | "video";
  objectKey: string;
  publicUrl: string;
  sizeBytes: number;
  slug: string;
}) {
  if (!env.ADMIN_DB) return;
  await ensureCoachSiteTables(env);

  const now = Math.floor(Date.now() / 1000);
  const site = await env.ADMIN_DB.prepare(`SELECT id FROM coach_sites WHERE slug = ?1 LIMIT 1`)
    .bind(slug)
    .first<{ id: string }>();

  await env.ADMIN_DB.prepare(
    `INSERT INTO coach_site_media (
      id, coach_site_id, slug, media_type, object_key, public_url,
      file_name, content_type, size_bytes, uploaded_by, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  )
    .bind(
      createRecordId("coach-media"),
      site?.id || null,
      slug,
      mediaType,
      objectKey,
      publicUrl,
      fileName,
      contentType,
      sizeBytes,
      adminEmail,
      now
    )
    .run();
}

function normalizeCoachSitePayload(payload: CoachSitePayload): CoachSiteRecord {
  const coachName = sanitizeText(payload.coachName, 160);
  const niche = sanitizeText(payload.niche, 160);
  const slug = normalizeCoachSlug(payload.slug || coachName);
  const status = normalizeStatus(payload.status);
  const fallback = createCoachSiteFromForm({
    form: {
      benefitsText: "",
      bio: sanitizeText(payload.bio, 1200),
      coachEmail: sanitizeText(payload.coachEmail, 240),
      coachName,
      coachPhone: sanitizeText(payload.coachPhone, 80),
      coachIntro: "",
      ctaText: "",
      faqText: "",
      googleFormUrl: sanitizeUrl(payload.googleFormUrl),
      heroMediaType: normalizeHeroMediaType(payload.heroMediaType),
      heroHeadline: "",
      location: sanitizeText(payload.location, 160),
      logoUrl: sanitizeUrl(payload.logoUrl),
      niche,
      photoUrl: sanitizeUrl(payload.photoUrl),
      registerButtonText: sanitizeText(payload.registerButtonText, 80) || "Register Now",
      selectedThemeId: normalizeCoachTemplateThemeId(payload.selectedThemeId),
      slug,
      socialCopy: "",
      subheadline: "",
      supportText: sanitizeText(payload.supportText, 300),
      trustText: "",
      videoUrl: sanitizeUrl(payload.videoUrl),
      vision: sanitizeText(payload.vision, 1200),
      visionText: "",
      whatsappLink: sanitizeUrl(payload.whatsappLink)
    },
    id: sanitizeText(payload.id, 120) || createRecordId("coach-site"),
    status
  });

  return {
    ...fallback,
    analytics: normalizeAnalytics(payload.analytics),
    coachId: sanitizeText(payload.coachId, 120) || fallback.coachId,
    content: normalizeContent(payload.content, fallback.content),
    publicUrl: getCoachPublicUrl(slug),
    selectedThemeId: normalizeCoachTemplateThemeId(payload.selectedThemeId)
  };
}

function rowToCoachSiteRecord(row: CoachSiteRow): CoachSiteRecord {
  const fallbackContent = createContentFallbackFromRow(row);
  const parsedContent = safeJson<CoachSitePayload["content"]>(row.content_json, undefined);

  return {
    analytics: safeJson<CoachSiteAnalyticsSummary>(row.analytics_json, DEFAULT_ANALYTICS),
    bio: row.bio,
    coachEmail: row.coach_email,
    coachId: row.coach_id,
    coachName: row.coach_name,
    coachPhone: row.coach_phone,
    content: normalizeContent(parsedContent, fallbackContent),
    googleFormUrl: row.google_form_url,
    heroMediaType: normalizeHeroMediaType(row.hero_media_type),
    id: row.id,
    location: row.location,
    logoUrl: row.logo_url,
    niche: row.niche,
    photoUrl: row.photo_url,
    publicUrl: row.public_url,
    registerButtonText: row.register_button_text,
    selectedThemeId: normalizeCoachTemplateThemeId(row.selected_theme_id),
    slug: row.slug,
    status: normalizeStatus(row.status),
    supportText: row.support_text,
    videoUrl: row.video_url,
    vision: row.vision,
    whatsappLink: row.whatsapp_link
  };
}

function createContentFallbackFromRow(row: CoachSiteRow): CoachSiteContent {
  const coachName = sanitizeText(row.coach_name, 160) || "Coach";
  const niche = sanitizeText(row.niche, 160) || "wellness";
  const slug = normalizeCoachSlug(row.slug || coachName);

  return createCoachSiteFromForm({
    form: {
      benefitsText: "",
      bio: sanitizeText(row.bio, 1200),
      coachEmail: sanitizeText(row.coach_email, 240),
      coachName,
      coachPhone: sanitizeText(row.coach_phone, 80),
      coachIntro: "",
      ctaText: "",
      faqText: "",
      googleFormUrl: sanitizeUrl(row.google_form_url),
      heroMediaType: normalizeHeroMediaType(row.hero_media_type),
      heroHeadline: "",
      location: sanitizeText(row.location, 160),
      logoUrl: sanitizeUrl(row.logo_url),
      niche,
      photoUrl: sanitizeUrl(row.photo_url),
      registerButtonText: sanitizeText(row.register_button_text, 80) || "Register Now",
      selectedThemeId: normalizeCoachTemplateThemeId(row.selected_theme_id),
      slug,
      socialCopy: "",
      subheadline: "",
      supportText: sanitizeText(row.support_text, 300),
      trustText: "",
      videoUrl: sanitizeUrl(row.video_url),
      vision: sanitizeText(row.vision, 1200),
      visionText: "",
      whatsappLink: sanitizeUrl(row.whatsapp_link)
    },
    id: sanitizeText(row.id, 120) || `coach-site-${slug || "draft"}`,
    status: normalizeStatus(row.status)
  }).content;
}

function normalizeContent(
  content: CoachSitePayload["content"],
  fallback: CoachSiteContent
): CoachSiteContent {
  if (!content || typeof content !== "object") return fallback;

  return {
    benefits: Array.isArray(content.benefits)
      ? content.benefits
          .map((item) => sanitizeText(String(item), 280))
          .filter(Boolean)
          .slice(0, 8)
      : fallback.benefits,
    coachIntro: sanitizeText(content.coachIntro, 1200) || fallback.coachIntro,
    ctaText: sanitizeText(content.ctaText, 120) || fallback.ctaText,
    faq: Array.isArray(content.faq)
      ? content.faq
          .map((item) => ({
            answer: sanitizeText(item?.answer, 600),
            question: sanitizeText(item?.question, 240)
          }))
          .filter((item) => item.answer && item.question)
          .slice(0, 8)
      : fallback.faq,
    heroHeadline: sanitizeText(content.heroHeadline, 240) || fallback.heroHeadline,
    socialCopy: sanitizeText(content.socialCopy, 500) || fallback.socialCopy,
    subheadline: sanitizeText(content.subheadline, 500) || fallback.subheadline,
    trustText: sanitizeText(content.trustText, 500) || fallback.trustText,
    visionText: sanitizeText(content.visionText, 1200) || fallback.visionText
  };
}

function normalizeAnalytics(value: CoachSitePayload["analytics"]): CoachSiteAnalyticsSummary {
  if (!value || typeof value !== "object") return DEFAULT_ANALYTICS;

  return {
    averageVisits: normalizeNumber(value.averageVisits),
    conversionRate: sanitizeText(value.conversionRate, 40) || "0%",
    dailyVisits: normalizeNumber(value.dailyVisits),
    deviceBreakdown: {
      desktop: normalizeNumber(value.deviceBreakdown?.desktop),
      mobile: normalizeNumber(value.deviceBreakdown?.mobile),
      tablet: normalizeNumber(value.deviceBreakdown?.tablet)
    },
    lastUpdated: sanitizeText(value.lastUpdated, 80) || "Not connected",
    monthlyVisits: normalizeNumber(value.monthlyVisits),
    region: sanitizeText(value.region, 80) || "Not available",
    source: sanitizeText(value.source, 120) || "Not available",
    totalRegisterClicks: normalizeNumber(value.totalRegisterClicks),
    totalVisits: normalizeNumber(value.totalVisits),
    totalWhatsappClicks: normalizeNumber(value.totalWhatsappClicks),
    videoPlays: normalizeNumber(value.videoPlays),
    weeklyVisits: normalizeNumber(value.weeklyVisits)
  };
}

function normalizeHeroMediaType(value: unknown): CoachHeroMediaType {
  return value === "video" || value === "none" || value === "image" ? value : "image";
}

function normalizeStatus(value: unknown): CoachSiteStatus {
  return value === "archived" ||
    value === "draft" ||
    value === "paused" ||
    value === "published" ||
    value === "removed"
    ? value
    : "draft";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeUrl(value: unknown) {
  const raw = sanitizeText(value, 1200);
  if (!raw || raw.startsWith("data:")) return "";
  if (raw.startsWith("/")) return raw;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function stripBrowserOnlyMedia(value: string) {
  return value.startsWith("data:") || value.startsWith("blob:") ? "" : value;
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createRecordId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
