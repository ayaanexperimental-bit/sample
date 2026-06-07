import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import {
  type CoachHeroMediaType,
  type CoachSiteAnalyticsSummary,
  type CoachSiteContent,
  type CoachSiteRecord,
  type CoachSiteStatus,
  EMPTY_COACH_SITE_FORM,
  createCoachSiteFromForm,
  getCoachPublicUrl,
  normalizeCoachSlug,
  toPublicCoachSiteRecord
} from "../admin-coach-sites";
import { normalizeCoachTemplateThemeId } from "../coach-template-themes";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";

export type CoachSiteStorageEnv = {
  ADMIN_DB?: D1Database;
  COACH_MEDIA_BUCKET?: R2Bucket;
};

type CoachSiteRow = {
  analytics_json: string;
  archived_at: number | null;
  bio: string;
  coach_email: string;
  coach_id: string;
  coach_name: string;
  coach_phone: string;
  content_json: string;
  created_at: number;
  created_by: string;
  existing_paid_funnel_url: string | null;
  google_form_url: string;
  hero_media_type: CoachHeroMediaType;
  id: string;
  location: string;
  logo_url: string;
  niche: string;
  photo_url: string;
  published_at: number | null;
  public_url: string;
  register_button_text: string;
  selected_theme_id: string | null;
  paid_funnel_context: string | null;
  slug: string;
  status: CoachSiteStatus;
  support_text: string;
  updated_at: number;
  video_url: string;
  vision: string;
  whatsapp_link: string;
};

type CoachSitePayload = Partial<CoachSiteRecord> & {
  status?: CoachSiteStatus;
};

export class DuplicateCoachSiteError extends Error {
  duplicateSite: CoachSiteRecord;

  constructor(duplicateSite: CoachSiteRecord) {
    super(
      `A coach site already exists for ${duplicateSite.coachName || duplicateSite.slug}. Use Manage/Edit instead of creating a duplicate.`
    );
    this.name = "DuplicateCoachSiteError";
    this.duplicateSite = duplicateSite;
  }
}

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
    existing_paid_funnel_url TEXT NOT NULL DEFAULT '',
    google_form_url TEXT NOT NULL DEFAULT '',
    hero_media_type TEXT NOT NULL DEFAULT 'image' CHECK (hero_media_type IN ('image', 'none', 'video')),
    public_url TEXT NOT NULL,
    register_button_text TEXT NOT NULL DEFAULT 'Register Now',
    selected_theme_id TEXT NOT NULL DEFAULT 'default-current',
    paid_funnel_context TEXT NOT NULL DEFAULT '',
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
  `CREATE INDEX IF NOT EXISTS idx_coach_sites_updated_at
    ON coach_sites (updated_at DESC)`,
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
  `ALTER TABLE coach_sites ADD COLUMN selected_theme_id TEXT NOT NULL DEFAULT 'default-current'`,
  `ALTER TABLE coach_sites ADD COLUMN existing_paid_funnel_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE coach_sites ADD COLUMN paid_funnel_context TEXT NOT NULL DEFAULT ''`
];
const coachSiteSchemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();

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

  const db = env.ADMIN_DB;
  await runCachedD1SchemaSetup({
    cache: coachSiteSchemaCache,
    db,
    setup: async () => {
      for (const statement of COACH_SITE_TABLES_SQL) {
        await db.prepare(statement).run();
      }

      for (const statement of COACH_SITE_MIGRATIONS_SQL) {
        try {
          await db.prepare(statement).run();
        } catch {
          // Existing databases already have this column.
        }
      }
    }
  });

  return true;
}

export async function listCoachSitesFromDb(env: CoachSiteStorageEnv) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const result = await env.ADMIN_DB.prepare(
    `SELECT * FROM coach_sites
     WHERE status <> 'removed'
     ORDER BY updated_at DESC`
  ).all<CoachSiteRow>();

  return dedupeCoachSites(result.results.map(rowToCoachSiteRecord));
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

export async function getCoachSiteBySlugFromDb(slug: string, env: CoachSiteStorageEnv) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const normalizedSlug = normalizeCoachSlug(slug);
  const row = await env.ADMIN_DB.prepare(
    `SELECT * FROM coach_sites
     WHERE slug = ?1
     LIMIT 1`
  )
    .bind(normalizedSlug)
    .first<CoachSiteRow>();

  return row ? toPublicCoachSiteRecord(rowToCoachSiteRecord(row)) : null;
}

export async function getCoachSiteByIdFromDb(id: string, env: CoachSiteStorageEnv) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const normalizedId = sanitizeText(id, 120);
  if (!normalizedId) return null;

  const row = await env.ADMIN_DB.prepare(`SELECT * FROM coach_sites WHERE id = ?1 LIMIT 1`)
    .bind(normalizedId)
    .first<CoachSiteRow>();

  return row ? rowToCoachSiteRecord(row) : null;
}

export async function upsertCoachSiteToDb({
  allowExistingUpdate = true,
  adminEmail,
  env,
  payload
}: {
  allowExistingUpdate?: boolean;
  adminEmail: string;
  env: CoachSiteStorageEnv;
  payload: CoachSitePayload;
}) {
  if (!env.ADMIN_DB) return null;
  await ensureCoachSiteTables(env);

  const site = normalizeCoachSitePayload(payload);
  const duplicate = await findDuplicateCoachSite(site, env, {
    allowSameId: allowExistingUpdate
  });
  if (duplicate) {
    throw new DuplicateCoachSiteError(duplicate);
  }

  const now = Math.floor(Date.now() / 1000);
  const existing = await env.ADMIN_DB.prepare(
    `SELECT id, coach_id, created_at, created_by, published_at, archived_at
     FROM coach_sites
     WHERE id = ?1 OR slug = ?2
     ORDER BY CASE WHEN id = ?1 THEN 0 ELSE 1 END
     LIMIT 1`
  )
    .bind(site.id, site.slug)
    .first<{
      archived_at: number | null;
      coach_id: string;
      created_at: number;
      created_by: string;
      id: string;
      published_at: number | null;
    }>();

  const canonicalSite = {
    ...site,
    coachId: existing?.coach_id || site.coachId,
    id: existing?.id || site.id
  };
  const createdAt = existing?.created_at || now;
  const createdBy = existing?.created_by || adminEmail;
  const publishedAt =
    canonicalSite.status === "published"
      ? existing?.published_at || now
      : existing?.published_at || null;
  const archivedAt =
    canonicalSite.status === "archived" || canonicalSite.status === "removed"
      ? existing?.archived_at || now
      : null;

  await env.ADMIN_DB.prepare(
    `INSERT INTO coach_sites (
      id, coach_id, coach_name, slug, status, niche, location, bio, vision,
      coach_email, coach_phone, whatsapp_link, photo_url, logo_url, video_url,
      existing_paid_funnel_url, google_form_url, hero_media_type, public_url, register_button_text,
      selected_theme_id, paid_funnel_context, support_text,
      content_json, analytics_json, created_at, updated_at, published_at, archived_at,
      created_by, updated_by
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
      ?10, ?11, ?12, ?13, ?14, ?15,
      ?16, ?17, ?18, ?19, ?20,
      ?21, ?22, ?23, ?24, ?25,
      ?26, ?27, ?28, ?29, ?30,
      ?31
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
      existing_paid_funnel_url = excluded.existing_paid_funnel_url,
      google_form_url = excluded.google_form_url,
      hero_media_type = excluded.hero_media_type,
      public_url = excluded.public_url,
      register_button_text = excluded.register_button_text,
      selected_theme_id = excluded.selected_theme_id,
      paid_funnel_context = excluded.paid_funnel_context,
      support_text = excluded.support_text,
      content_json = excluded.content_json,
      analytics_json = excluded.analytics_json,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at,
      archived_at = excluded.archived_at,
      updated_by = excluded.updated_by`
  )
    .bind(
      canonicalSite.id,
      canonicalSite.coachId,
      canonicalSite.coachName,
      canonicalSite.slug,
      canonicalSite.status,
      canonicalSite.niche,
      canonicalSite.location,
      canonicalSite.bio,
      canonicalSite.vision,
      canonicalSite.coachEmail,
      canonicalSite.coachPhone,
      canonicalSite.whatsappLink,
      stripBrowserOnlyMedia(canonicalSite.photoUrl),
      stripBrowserOnlyMedia(canonicalSite.logoUrl),
      stripBrowserOnlyMedia(canonicalSite.videoUrl),
      canonicalSite.existingPaidFunnelUrl,
      canonicalSite.googleFormUrl,
      canonicalSite.heroMediaType,
      canonicalSite.publicUrl,
      canonicalSite.registerButtonText,
      canonicalSite.selectedThemeId,
      canonicalSite.paidFunnelContext,
      canonicalSite.supportText,
      JSON.stringify(canonicalSite.content),
      JSON.stringify(canonicalSite.analytics),
      createdAt,
      now,
      publishedAt,
      archivedAt,
      createdBy,
      adminEmail
    )
    .run();

  const row = await env.ADMIN_DB.prepare(`SELECT * FROM coach_sites WHERE id = ?1 LIMIT 1`)
    .bind(canonicalSite.id)
    .first<CoachSiteRow>();

  return row
    ? rowToCoachSiteRecord(row)
    : {
        ...canonicalSite,
        archivedAt: secondsToIso(archivedAt || 0),
        createdAt: secondsToIso(createdAt),
        publishedAt: secondsToIso(publishedAt || 0),
        updatedAt: secondsToIso(now)
      };
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
      ...EMPTY_COACH_SITE_FORM,
      benefitsText: "",
      bio: sanitizeText(payload.bio, 1200),
      coachEmail: sanitizeText(payload.coachEmail, 240),
      coachName,
      coachPhone: sanitizeText(payload.coachPhone, 80),
      coachIntro: "",
      coachIntroLabel: "",
      ctaText: "",
      ctaSectionLabel: "",
      existingPaidFunnelUrl: sanitizeUrl(payload.existingPaidFunnelUrl),
      faqText: "",
      faqHeading: "",
      faqSectionLabel: "",
      footerBrandLine: "",
      footerHeadline: "",
      footerText: "",
      googleFormUrl: sanitizeUrl(payload.googleFormUrl),
      heroMediaType: normalizeHeroMediaType(payload.heroMediaType),
      heroHeadline: "",
      heroMediaLabel: "",
      location: sanitizeText(payload.location, 160),
      logoUrl: sanitizeUrl(payload.logoUrl),
      introHeading: "",
      introSectionLabel: "",
      journeyHeading: "",
      journeySectionLabel: "",
      mediaBody: "",
      mediaHeading: "",
      mediaModuleLabel: "",
      mediaSubheading: "",
      niche,
      paidFunnelContext: sanitizeText(payload.paidFunnelContext, 7000),
      photoUrl: sanitizeUrl(payload.photoUrl),
      problemHeading: "",
      problemSectionLabel: "",
      registerButtonText: sanitizeText(payload.registerButtonText, 80) || "Register Now",
      selectedThemeId: normalizeCoachTemplateThemeId(payload.selectedThemeId),
      slug,
      benefitsHeading: "",
      benefitsSectionLabel: "",
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
    existingPaidFunnelUrl: sanitizeUrl(payload.existingPaidFunnelUrl),
    paidFunnelContext: sanitizeText(payload.paidFunnelContext, 7000),
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
    archivedAt: secondsToIso(row.archived_at || 0),
    createdAt: secondsToIso(row.created_at),
    existingPaidFunnelUrl: sanitizeUrl(row.existing_paid_funnel_url || ""),
    googleFormUrl: row.google_form_url,
    heroMediaType: normalizeHeroMediaType(row.hero_media_type),
    id: row.id,
    location: row.location,
    logoUrl: row.logo_url,
    niche: row.niche,
    photoUrl: row.photo_url,
    publishedAt: secondsToIso(row.published_at || 0),
    publicUrl: row.public_url,
    registerButtonText: row.register_button_text,
    selectedThemeId: normalizeCoachTemplateThemeId(row.selected_theme_id),
    slug: row.slug,
    status: normalizeStatus(row.status),
    paidFunnelContext: sanitizeText(row.paid_funnel_context || "", 7000),
    supportText: row.support_text,
    updatedAt: secondsToIso(row.updated_at),
    videoUrl: row.video_url,
    vision: row.vision,
    whatsappLink: row.whatsapp_link
  };
}

function dedupeCoachSites(sites: CoachSiteRecord[]) {
  const selected: CoachSiteRecord[] = [];
  const sorted = [...sites].sort(compareCoachSitesForDeduping);

  for (const site of sorted) {
    if (site.status === "removed") continue;
    if (selected.some((current) => isDuplicateCoachIdentity(site, current))) continue;

    selected.push(site);
  }

  return selected.sort((left, right) => getSiteTimestamp(right) - getSiteTimestamp(left));
}

async function findDuplicateCoachSite(
  site: CoachSiteRecord,
  env: CoachSiteStorageEnv,
  options: { allowSameId: boolean }
) {
  const existingSites = await listCoachSitesFromDb(env);
  if (!existingSites) return null;

  return (
    existingSites.find(
      (existingSite) =>
        existingSite.status !== "removed" &&
        (!options.allowSameId || existingSite.id !== site.id) &&
        isDuplicateCoachIdentity(existingSite, site)
    ) || null
  );
}

function isDuplicateCoachIdentity(left: CoachSiteRecord, right: CoachSiteRecord) {
  const leftSlug = normalizeCoachSlug(left.slug);
  const rightSlug = normalizeCoachSlug(right.slug);
  const leftName = normalizeCoachSlug(left.coachName);
  const rightName = normalizeCoachSlug(right.coachName);

  return Boolean(
    (leftSlug && rightSlug && leftSlug === rightSlug) ||
    (leftName && rightName && leftName === rightName)
  );
}

function compareCoachSitesForDeduping(left: CoachSiteRecord, right: CoachSiteRecord) {
  const statusDelta =
    getCoachSiteStatusPriority(left.status) - getCoachSiteStatusPriority(right.status);
  if (statusDelta !== 0) return statusDelta;

  return getSiteTimestamp(right) - getSiteTimestamp(left);
}

function getCoachSiteStatusPriority(status: CoachSiteStatus) {
  if (status === "published" || status === "paused") return 0;
  if (status === "draft") return 1;
  if (status === "archived") return 2;
  return 3;
}

function getSiteTimestamp(site: CoachSiteRecord) {
  const updatedAt = site.updatedAt ? Date.parse(site.updatedAt) : 0;
  const createdAt = site.createdAt ? Date.parse(site.createdAt) : 0;

  return Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : createdAt || 0;
}

function secondsToIso(seconds: number) {
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined;
}

function createContentFallbackFromRow(row: CoachSiteRow): CoachSiteContent {
  const coachName = sanitizeText(row.coach_name, 160) || "Coach";
  const niche = sanitizeText(row.niche, 160) || "wellness";
  const slug = normalizeCoachSlug(row.slug || coachName);

  return createCoachSiteFromForm({
    form: {
      ...EMPTY_COACH_SITE_FORM,
      benefitsText: "",
      bio: sanitizeText(row.bio, 1200),
      coachEmail: sanitizeText(row.coach_email, 240),
      coachName,
      coachPhone: sanitizeText(row.coach_phone, 80),
      coachIntro: "",
      coachIntroLabel: "",
      ctaText: "",
      ctaSectionLabel: "",
      existingPaidFunnelUrl: sanitizeUrl(row.existing_paid_funnel_url || ""),
      faqText: "",
      faqHeading: "",
      faqSectionLabel: "",
      footerBrandLine: "",
      footerHeadline: "",
      footerText: "",
      googleFormUrl: sanitizeUrl(row.google_form_url),
      heroMediaType: normalizeHeroMediaType(row.hero_media_type),
      heroHeadline: "",
      heroMediaLabel: "",
      location: sanitizeText(row.location, 160),
      logoUrl: sanitizeUrl(row.logo_url),
      introHeading: "",
      introSectionLabel: "",
      journeyHeading: "",
      journeySectionLabel: "",
      mediaBody: "",
      mediaHeading: "",
      mediaModuleLabel: "",
      mediaSubheading: "",
      niche,
      paidFunnelContext: sanitizeText(row.paid_funnel_context || "", 7000),
      photoUrl: sanitizeUrl(row.photo_url),
      problemHeading: "",
      problemSectionLabel: "",
      registerButtonText: sanitizeText(row.register_button_text, 80) || "Register Now",
      selectedThemeId: normalizeCoachTemplateThemeId(row.selected_theme_id),
      slug,
      benefitsHeading: "",
      benefitsSectionLabel: "",
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
    benefitDescriptions: Array.isArray(content.benefitDescriptions)
      ? content.benefitDescriptions
          .map((item) => sanitizeText(String(item), 360))
          .filter(Boolean)
          .slice(0, 8)
      : fallback.benefitDescriptions,
    benefits: Array.isArray(content.benefits)
      ? content.benefits
          .map((item) => sanitizeText(String(item), 280))
          .filter(Boolean)
          .slice(0, 8)
      : fallback.benefits,
    benefitsHeading: sanitizeText(content.benefitsHeading, 240) || fallback.benefitsHeading,
    brandBadge: sanitizeText(content.brandBadge, 160) || fallback.brandBadge,
    brandEyebrow: sanitizeText(content.brandEyebrow, 160) || fallback.brandEyebrow,
    coachIntro: sanitizeText(content.coachIntro, 1200) || fallback.coachIntro,
    coachIntroLabel: sanitizeText(content.coachIntroLabel, 160) || fallback.coachIntroLabel,
    ctaText: sanitizeText(content.ctaText, 120) || fallback.ctaText,
    ctaSectionLabel: sanitizeText(content.ctaSectionLabel, 120) || fallback.ctaSectionLabel,
    faq: Array.isArray(content.faq)
      ? content.faq
          .map((item) => ({
            answer: sanitizeText(item?.answer, 600),
            question: sanitizeText(item?.question, 240)
          }))
          .filter((item) => item.answer && item.question)
          .slice(0, 8)
      : fallback.faq,
    faqHeading: sanitizeText(content.faqHeading, 240) || fallback.faqHeading,
    faqSectionLabel: sanitizeText(content.faqSectionLabel, 120) || fallback.faqSectionLabel,
    footerBrandLine: sanitizeText(content.footerBrandLine, 180) || fallback.footerBrandLine,
    footerHeadline: sanitizeText(content.footerHeadline, 240) || fallback.footerHeadline,
    footerText: sanitizeText(content.footerText, 900) || fallback.footerText,
    heroHeadline: sanitizeText(content.heroHeadline, 240) || fallback.heroHeadline,
    heroMediaLabel: sanitizeText(content.heroMediaLabel, 120) || fallback.heroMediaLabel,
    heroMicroTrustText:
      sanitizeText(content.heroMicroTrustText, 240) || fallback.heroMicroTrustText,
    heroTrustLine: sanitizeText(content.heroTrustLine, 160) || fallback.heroTrustLine,
    introHeading: sanitizeText(content.introHeading, 240) || fallback.introHeading,
    introSectionLabel:
      sanitizeText(content.introSectionLabel, 160) || fallback.introSectionLabel,
    journeyHeading: sanitizeText(content.journeyHeading, 240) || fallback.journeyHeading,
    journeySectionLabel:
      sanitizeText(content.journeySectionLabel, 160) || fallback.journeySectionLabel,
    journeySteps: Array.isArray(content.journeySteps)
      ? content.journeySteps
          .map((item) => ({
            description: sanitizeText(item?.description, 500),
            label: sanitizeText(item?.label, 120),
            title: sanitizeText(item?.title, 180)
          }))
          .filter((item) => item.description && item.label && item.title)
          .slice(0, 5)
      : fallback.journeySteps,
    mediaBody: sanitizeText(content.mediaBody, 700) || fallback.mediaBody,
    mediaHeading: sanitizeText(content.mediaHeading, 240) || fallback.mediaHeading,
    mediaModuleLabel: sanitizeText(content.mediaModuleLabel, 160) || fallback.mediaModuleLabel,
    mediaSubheading: sanitizeText(content.mediaSubheading, 240) || fallback.mediaSubheading,
    problemHeading: sanitizeText(content.problemHeading, 260) || fallback.problemHeading,
    problemSectionLabel:
      sanitizeText(content.problemSectionLabel, 160) || fallback.problemSectionLabel,
    problemPoints: Array.isArray(content.problemPoints)
      ? content.problemPoints
          .map((item) => sanitizeText(String(item), 280))
          .filter(Boolean)
          .slice(0, 8)
      : fallback.problemPoints,
    benefitsSectionLabel:
      sanitizeText(content.benefitsSectionLabel, 160) || fallback.benefitsSectionLabel,
    socialCopy: sanitizeText(content.socialCopy, 500) || fallback.socialCopy,
    subheadline: sanitizeText(content.subheadline, 500) || fallback.subheadline,
    trustText: sanitizeText(content.trustText, 500) || fallback.trustText,
    visionLabel: sanitizeText(content.visionLabel, 160) || fallback.visionLabel,
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
