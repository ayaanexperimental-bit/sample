"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminActionDialog } from "./admin-dashboard-layout";
import {
  EMPTY_COACH_SITE_FORM,
  type CoachHeroMediaType,
  type CoachSiteFormState,
  type CoachSiteRecord,
  type CoachSiteStatus,
  createCoachSiteFromForm,
  createFormFromCoachSite,
  demoCoachSites,
  normalizeCoachSlug
} from "../../lib/admin-coach-sites";
import {
  isSupportedVideoSource,
  isUploadedVideoSource,
  normalizeVideoEmbedUrl
} from "../../lib/video-links";
import styles from "./admin-dashboard-shell.module.css";

type AdminCoachSitesManagerProps = {
  csrfToken: string;
  mode?: "create" | "list";
};

type CoachDialog =
  | { type: "analytics"; site: CoachSiteRecord }
  | { type: "copy"; link: string; site: CoachSiteRecord }
  | { type: "creator" }
  | { type: "manage"; site: CoachSiteRecord }
  | { type: "preview"; site: CoachSiteRecord }
  | { nextStatus: "paused" | "published"; site: CoachSiteRecord; type: "status" }
  | { site: CoachSiteRecord; type: "remove" };

type CoachSitesApiPayload = {
  coachSite?: CoachSiteRecord;
  coachSites?: CoachSiteRecord[];
  configured?: boolean;
  error?: string;
  fallbackUsed?: boolean;
  ok?: boolean;
};

type MediaUploadApiPayload = {
  configured?: boolean;
  error?: string;
  media?: {
    publicUrl?: string;
    sizeBytes?: number;
  };
  ok?: boolean;
};

const statusOptions: Array<"all" | CoachSiteStatus> = [
  "all",
  "draft",
  "published",
  "paused",
  "archived",
  "removed"
];

const wizardSteps = [
  "Coach Basic Details",
  "Hero Media",
  "Coach Niche & Content",
  "Links & Contact Support",
  "AI Copy Generation",
  "Preview",
  "Publish"
];

const removalReasons = [
  "inactive coach",
  "duplicate site",
  "wrong details",
  "coach left program",
  "other"
];

const PHOTO_UPLOAD_ACCEPT =
  ".jpg,.jpeg,.jpe,.jfif,.png,.webp,.avif,.gif,.heic,.heif,.bmp,.tif,.tiff,image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,image/bmp,image/tiff";
const PHOTO_ORIGINAL_MAX_BYTES = 20 * 1024 * 1024;
const PHOTO_STORED_MAX_BYTES = 12 * 1024 * 1024;
const VIDEO_MAX_BYTES = 24 * 1024 * 1024;
const IMAGE_OPTIMIZE_MAX_EDGE = 2200;
const IMAGE_OPTIMIZE_QUALITY = 0.92;
const IMAGE_MIN_SAVINGS_RATIO = 0.92;
const ALLOWED_PHOTO_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".jfif",
  ".jpe",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp"
]);
const ALLOWED_PHOTO_MIME_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/tiff",
  "image/webp",
  "image/x-ms-bmp",
  "image/x-png"
]);
const PASSTHROUGH_PHOTO_EXTENSIONS = new Set([".gif", ".heic", ".heif"]);

export function AdminCoachSitesManager({ csrfToken, mode = "list" }: AdminCoachSitesManagerProps) {
  const [sites, setSites] = useState<CoachSiteRecord[]>(demoCoachSites);
  const [form, setForm] = useState<CoachSiteFormState>(EMPTY_COACH_SITE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewSite, setPreviewSite] = useState<CoachSiteRecord | null>(null);
  const [publishedSite, setPublishedSite] = useState<CoachSiteRecord | null>(null);
  const [dialog, setDialog] = useState<CoachDialog | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CoachSiteStatus>("all");
  const [message, setMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removeReason, setRemoveReason] = useState(removalReasons[0]);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    if (mode === "create") {
      openCreatorDialog();
    }
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedCoachSites() {
      try {
        const response = await fetch("/api/admin/coach-sites", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as CoachSitesApiPayload;

        if (cancelled || !response.ok || !payload.ok || !payload.coachSites) return;

        setSites(payload.coachSites);
        setStorageReady(Boolean(payload.configured));
        setStorageMessage(
          payload.fallbackUsed
            ? "Coach-site database connected. Showing fallback records until the first admin save."
            : "Coach-site database connected."
        );
      } catch {
        if (!cancelled) {
          setStorageReady(false);
          setStorageMessage("Using local fallback. Admin API is not reachable in this preview.");
        }
      }
    }

    void loadPersistedCoachSites();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sites.filter((site) => {
      const matchesStatus = statusFilter === "all" || site.status === statusFilter;
      const matchesSearch =
        !query ||
        site.coachName.toLowerCase().includes(query) ||
        site.niche.toLowerCase().includes(query) ||
        site.slug.toLowerCase().includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [search, sites, statusFilter]);

  function updateFormField<Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleCoachNameChange(value: string) {
    setForm((current) => ({
      ...current,
      coachName: value,
      slug: editingId ? current.slug || normalizeCoachSlug(value) : normalizeCoachSlug(value)
    }));
  }

  function openCreatorDialog(site?: CoachSiteRecord, step = 0) {
    if (site) {
      setEditingId(site.id);
      setForm(createFormFromCoachSite(site));
      setPreviewSite(site);
      setMessage(`Editing ${site.coachName}. Public link stays stable after future edits.`);
    } else {
      setEditingId(null);
      setForm(EMPTY_COACH_SITE_FORM);
      setPreviewSite(null);
      setPublishedSite(null);
      setMessage("");
    }
    setWizardStep(step);
    setDialog({ type: "creator" });
  }

  function buildPreviewSite(status: CoachSiteStatus) {
    const slug = normalizeCoachSlug(form.slug || form.coachName);

    return createCoachSiteFromForm({
      form: {
        ...form,
        slug
      },
      id: editingId || `coach-site-${slug || "draft"}`,
      status
    });
  }

  function preparePreview() {
    const slug = normalizeCoachSlug(form.slug || form.coachName);
    if (!form.coachName.trim() || !form.niche.trim() || !slug) {
      setMessage("Coach name and coach niche are required.");
      return false;
    }

    if (form.heroMediaType === "video" && !isSupportedVideoSource(form.videoUrl)) {
      setMessage("Enter a valid YouTube/video URL, upload a video file, or choose No Media.");
      return false;
    }

    const site = buildPreviewSite(previewSite?.status || "draft");
    setPreviewSite(site);
    setForm((current) => ({
      ...current,
      slug: site.slug
    }));
    setMessage("Preview prepared. Review before publishing.");
    return true;
  }

  async function upsertSite(status: CoachSiteStatus) {
    const site = { ...buildPreviewSite(status), status };
    const existingIndex = sites.findIndex((item) => item.id === site.id || item.slug === site.slug);
    const nextSites =
      existingIndex >= 0
        ? sites.map((item, index) => (index === existingIndex ? site : item))
        : [site, ...sites];

    setSites(nextSites);
    setPreviewSite(site);
    setEditingId(site.id);
    setPublishedSite(status === "published" ? site : null);
    setMessage(
      status === "published"
        ? `Successfully Published. Stable public link: ${site.publicUrl}. Saving to database...`
        : `Draft saved. Stable public link reserved: ${site.publicUrl}. Saving to database...`
    );

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({ site }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as CoachSitesApiPayload;

      if (!response.ok || !payload.ok || !payload.coachSite) {
        setStorageReady(Boolean(payload.configured));
        setStorageMessage(
          payload.error || "Could not save to coach-site database. Local preview is still updated."
        );
        return site;
      }

      setStorageReady(true);
      setStorageMessage("Saved in coach-site database.");
      setSites((current) =>
        current.map((item) =>
          item.id === site.id || item.slug === site.slug ? payload.coachSite! : item
        )
      );
      setPreviewSite(payload.coachSite);
      setPublishedSite(status === "published" ? payload.coachSite : null);
      setMessage(
        status === "published"
          ? `Successfully Published. Stable public link: ${payload.coachSite.publicUrl}`
          : `Draft saved. Stable public link reserved: ${payload.coachSite.publicUrl}`
      );
      return payload.coachSite;
    } catch {
      setStorageReady(false);
      setStorageMessage("Could not reach coach-site database API. Local preview is still updated.");
    }

    return site;
  }

  async function handleGenerateWithAi() {
    setAiMessage("");
    setMessage("");

    if (!form.coachName.trim() || !form.niche.trim()) {
      setAiMessage("Coach name and coach niche are required before AI generation.");
      return;
    }

    setAiSubmitting(true);
    setAiMessage("Generating niche-based content...");

    window.setTimeout(() => {
      setAiMessage((current) =>
        current === "Generating niche-based content..." ? "Preparing coach site copy..." : current
      );
    }, 450);

    try {
      const response = await fetch("/api/admin/coach-sites/generate-copy", {
        body: JSON.stringify({
          bio: form.bio,
          coachName: form.coachName,
          location: form.location,
          niche: form.niche,
          vision: form.vision
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        content?: {
          benefits?: string[];
          coachIntro?: string;
          ctaText?: string;
          faq?: Array<{
            answer: string;
            question: string;
          }>;
          heroHeadline?: string;
          socialCopy?: string;
          subheadline?: string;
          trustText?: string;
          visionText?: string;
        };
        message?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.content) {
        setAiMessage(payload.message || "AI generation not configured yet.");
        return;
      }

      setForm((current) => ({
        ...current,
        benefitsText: payload.content?.benefits?.join("\n") || current.benefitsText,
        coachIntro: payload.content?.coachIntro || current.coachIntro,
        ctaText: payload.content?.ctaText || current.ctaText,
        faqText:
          payload.content?.faq?.map((item) => `${item.question}\n${item.answer}`).join("\n\n") ||
          current.faqText,
        heroHeadline: payload.content?.heroHeadline || current.heroHeadline,
        registerButtonText: payload.content?.ctaText || current.registerButtonText,
        socialCopy: payload.content?.socialCopy || current.socialCopy,
        subheadline: payload.content?.subheadline || current.subheadline,
        trustText: payload.content?.trustText || current.trustText,
        visionText: payload.content?.visionText || current.visionText
      }));
      setAiMessage("AI copy prepared. Review and edit before publishing.");
    } catch {
      setAiMessage("AI copy generation failed.");
    } finally {
      setAiSubmitting(false);
    }
  }

  function updateSiteStatus(site: CoachSiteRecord, status: "paused" | "published") {
    setSites((current) =>
      current.map((item) => (item.id === site.id ? { ...item, status } : item))
    );
    setPreviewSite((current) => (current?.id === site.id ? { ...current, status } : current));
    setMessage(
      status === "paused"
        ? `${site.coachName} paused. Public link remains ${site.publicUrl}.`
        : `${site.coachName} resumed with the same public link: ${site.publicUrl}.`
    );
    setDialog(null);

    void persistSiteStatus(site, status);
  }

  async function persistSiteStatus(site: CoachSiteRecord, status: "paused" | "published") {
    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({ siteId: site.id, status }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json().catch(() => ({}))) as CoachSitesApiPayload;

      if (!response.ok || !payload.ok || !payload.coachSite) {
        setStorageMessage(payload.error || "Status changed locally, but database update failed.");
        return;
      }

      setStorageReady(true);
      setStorageMessage("Coach-site status saved in database.");
      setSites((current) =>
        current.map((item) => (item.id === site.id ? payload.coachSite! : item))
      );
    } catch {
      setStorageReady(false);
      setStorageMessage("Status changed locally, but admin API was not reachable.");
    }
  }

  async function copyPublicLink(site: CoachSiteRecord) {
    const link =
      typeof window === "undefined"
        ? site.publicUrl
        : new URL(site.publicUrl, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // The confirmation dialog still shows the stable link if clipboard is blocked.
    }

    setDialog({ link, site, type: "copy" });
  }

  return (
    <section className={styles.managerSurface} data-mode={mode} aria-label="Coach site manager">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>Coach Sites</p>
          <h2>{mode === "create" ? "Website creator" : "Referral websites"}</h2>
        </div>
        <button className={styles.primaryAction} onClick={() => openCreatorDialog()} type="button">
          Open Website Creator
        </button>
      </div>
      <p className={styles.inlineNote}>
        Coach public links are shareable. Editing, analytics, and settings remain admin-only.
      </p>

      {mode === "list" ? (
        <>
          <div className={styles.coachFilters}>
            <label className={styles.compactField}>
              <span>Search coaches</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, niche, or slug"
                type="search"
                value={search}
              />
            </label>
            <label className={styles.compactField}>
              <span>Status</span>
              <select
                onChange={(event) => setStatusFilter(event.target.value as "all" | CoachSiteStatus)}
                value={statusFilter}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table} data-density="compact">
              <thead>
                <tr>
                  <th>Coach</th>
                  <th>Status</th>
                  <th>Public link</th>
                  <th>Performance</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      <strong>{site.coachName}</strong>
                      <span>{site.niche}</span>
                    </td>
                    <td>
                      <span className={styles.statusBadge} data-status={site.status}>
                        {site.status}
                      </span>
                    </td>
                    <td>
                      <code>{site.publicUrl}</code>
                    </td>
                    <td>
                      <span>{site.analytics.totalVisits.toLocaleString()} visits</span>
                      <span>
                        {site.analytics.totalRegisterClicks.toLocaleString()} clicks /{" "}
                        {site.analytics.conversionRate}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.secondaryAction}
                        onClick={() => setDialog({ site, type: "manage" })}
                        type="button"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <span>{filteredSites.length} coach sites</span>
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <h3>Creator opens in a clean wizard</h3>
          <p>
            Use the modal to enter only the fixed-template content, media, links, and support
            details.
          </p>
        </div>
      )}

      {message ? <p className={styles.inlineStatus}>{message}</p> : null}
      {storageMessage ? (
        <p className={storageReady ? styles.inlineStatus : styles.linkWarning}>{storageMessage}</p>
      ) : null}

      <CoachDialogRenderer
        aiMessage={aiMessage}
        aiSubmitting={aiSubmitting}
        csrfToken={csrfToken}
        dialog={dialog}
        form={form}
        onClose={() => setDialog(null)}
        onCopyAgain={(site) => void copyPublicLink(site)}
        onEditSite={openCreatorDialog}
        onGenerateAi={() => void handleGenerateWithAi()}
        onOpenDialog={setDialog}
        onPreparePreview={preparePreview}
        onPublish={() => upsertSite("published")}
        onRemoveCancel={() => {
          setRemoveConfirm("");
          setDialog(null);
        }}
        onSaveDraft={() => upsertSite("draft")}
        onStatusConfirm={updateSiteStatus}
        onUpdateCoachName={handleCoachNameChange}
        onUpdateField={updateFormField}
        previewSite={previewSite}
        publishedSite={publishedSite}
        removeConfirm={removeConfirm}
        removeReason={removeReason}
        setRemoveConfirm={setRemoveConfirm}
        setRemoveReason={setRemoveReason}
        setWizardStep={setWizardStep}
        wizardStep={wizardStep}
      />
    </section>
  );
}

function CoachDialogRenderer({
  aiMessage,
  aiSubmitting,
  csrfToken,
  dialog,
  form,
  onClose,
  onCopyAgain,
  onEditSite,
  onGenerateAi,
  onOpenDialog,
  onPreparePreview,
  onPublish,
  onRemoveCancel,
  onSaveDraft,
  onStatusConfirm,
  onUpdateCoachName,
  onUpdateField,
  previewSite,
  publishedSite,
  removeConfirm,
  removeReason,
  setRemoveConfirm,
  setRemoveReason,
  setWizardStep,
  wizardStep
}: {
  aiMessage: string;
  aiSubmitting: boolean;
  csrfToken: string;
  dialog: CoachDialog | null;
  form: CoachSiteFormState;
  onClose: () => void;
  onCopyAgain: (site: CoachSiteRecord) => void;
  onEditSite: (site?: CoachSiteRecord, step?: number) => void;
  onGenerateAi: () => void;
  onOpenDialog: (dialog: CoachDialog) => void;
  onPreparePreview: () => boolean;
  onPublish: () => Promise<CoachSiteRecord>;
  onRemoveCancel: () => void;
  onSaveDraft: () => Promise<CoachSiteRecord>;
  onStatusConfirm: (site: CoachSiteRecord, status: "paused" | "published") => void;
  onUpdateCoachName: (value: string) => void;
  onUpdateField: <Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) => void;
  previewSite: CoachSiteRecord | null;
  publishedSite: CoachSiteRecord | null;
  removeConfirm: string;
  removeReason: string;
  setRemoveConfirm: (value: string) => void;
  setRemoveReason: (value: string) => void;
  setWizardStep: (step: number) => void;
  wizardStep: number;
}) {
  if (!dialog) return null;

  if (dialog.type === "creator") {
    return (
      <AdminActionDialog
        footer={
          <WizardFooter
            onClose={onClose}
            onPreparePreview={onPreparePreview}
            onPublish={onPublish}
            onSaveDraft={onSaveDraft}
            setWizardStep={setWizardStep}
            wizardStep={wizardStep}
          />
        }
        onClose={onClose}
        open
        size="large"
        title="Coach Website Creator"
      >
        <div className={styles.wizardShell}>
          <div className={styles.stepIndicator}>
            {wizardSteps.map((step, index) => (
              <button
                data-active={wizardStep === index ? "true" : "false"}
                key={step}
                onClick={() => setWizardStep(index)}
                type="button"
              >
                <span>{index + 1}</span>
                {step}
              </button>
            ))}
          </div>

          <div className={styles.wizardPanel}>
            {wizardStep === 0 ? (
              <>
                <div className={styles.formGrid}>
                  <TextField
                    helper="Used for the public coach page, support card, and stable link."
                    label="Coach name"
                    onChange={onUpdateCoachName}
                    required
                    value={form.coachName}
                  />
                  <TextField
                    label="Coach location"
                    onChange={(value) => onUpdateField("location", value)}
                    value={form.location}
                  />
                </div>
                <p className={styles.inlineNote}>
                  The public link slug is generated from the coach name and stays stable after
                  future edits.
                </p>
              </>
            ) : null}

            {wizardStep === 1 ? (
              <HeroMediaStep csrfToken={csrfToken} form={form} onUpdateField={onUpdateField} />
            ) : null}

            {wizardStep === 2 ? (
              <div className={styles.copyEditorGrid}>
                <TextField
                  label="Coach niche"
                  onChange={(value) => onUpdateField("niche", value)}
                  required
                  value={form.niche}
                />
                <TextAreaField
                  label="Coach short bio"
                  onChange={(value) => onUpdateField("bio", value)}
                  value={form.bio}
                />
                <TextAreaField
                  label="Coach vision/mission"
                  onChange={(value) => onUpdateField("vision", value)}
                  value={form.vision}
                />
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className={styles.formGrid}>
                <TextField
                  label="Google Form registration link"
                  helper="Register buttons open this link after the click is tracked."
                  onChange={(value) => onUpdateField("googleFormUrl", value)}
                  type="url"
                  value={form.googleFormUrl}
                />
                <TextField
                  label="WhatsApp/contact link"
                  onChange={(value) => onUpdateField("whatsappLink", value)}
                  type="url"
                  value={form.whatsappLink}
                />
                <TextField
                  label="Coach email"
                  onChange={(value) => onUpdateField("coachEmail", value)}
                  type="email"
                  value={form.coachEmail}
                />
                <TextField
                  label="Coach phone"
                  onChange={(value) => onUpdateField("coachPhone", value)}
                  value={form.coachPhone}
                />
                <TextField
                  label="Register button text"
                  onChange={(value) => onUpdateField("registerButtonText", value)}
                  value={form.registerButtonText}
                />
                <TextAreaField
                  label="Contact support text"
                  onChange={(value) => onUpdateField("supportText", value)}
                  placeholder="Need help? Contact your coach directly."
                  value={form.supportText}
                />
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.kicker}>AI Copy Generation</p>
                    <h2>Niche-based coach copy</h2>
                  </div>
                  <button
                    className={styles.secondaryAction}
                    disabled={aiSubmitting}
                    onClick={onGenerateAi}
                    type="button"
                  >
                    {aiSubmitting ? "Generating..." : "Generate with AI"}
                  </button>
                </div>
                {aiMessage ? <p className={styles.inlineStatus}>{aiMessage}</p> : null}
                <div className={styles.copyEditorGrid}>
                  <TextAreaField
                    label="Hero headline"
                    onChange={(value) => onUpdateField("heroHeadline", value)}
                    value={form.heroHeadline}
                  />
                  <TextAreaField
                    label="Subheadline"
                    onChange={(value) => onUpdateField("subheadline", value)}
                    value={form.subheadline}
                  />
                  <TextAreaField
                    label="Benefits section"
                    onChange={(value) => onUpdateField("benefitsText", value)}
                    placeholder="One benefit per line"
                    value={form.benefitsText}
                  />
                  <TextAreaField
                    label="FAQ"
                    onChange={(value) => onUpdateField("faqText", value)}
                    placeholder={"Question\nAnswer\n\nQuestion\nAnswer"}
                    value={form.faqText}
                  />
                </div>
                <p className={styles.inlineNote}>
                  Coach introduction, mission, CTA, and contact support come from the previous
                  steps. AI only prepares fixed-template copy for admin review.
                </p>
              </>
            ) : null}

            {wizardStep === 5 ? (
              previewSite ? (
                <CoachSitePreview site={previewSite} />
              ) : (
                <div className={styles.emptyState}>
                  <h3>Preview not prepared yet</h3>
                  <p>
                    Use the Preview button to generate a fixed-template preview before publishing.
                  </p>
                </div>
              )
            ) : null}

            {wizardStep === 6 ? (
              <PublishPanel
                onCopyLink={onCopyAgain}
                publishedSite={publishedSite}
                previewSite={previewSite}
              />
            ) : null}
          </div>
        </div>
      </AdminActionDialog>
    );
  }

  if (dialog.type === "manage") {
    return (
      <AdminActionDialog onClose={onClose} open title="Manage Coach Site">
        <div className={styles.manageDialog}>
          <div>
            <p className={styles.kicker}>Coach Site</p>
            <h3>{dialog.site.coachName}</h3>
            <p>{dialog.site.niche}</p>
            <code>{dialog.site.publicUrl}</code>
          </div>
          <div className={styles.manageMetrics}>
            <span>{dialog.site.analytics.totalVisits.toLocaleString()} visits</span>
            <span>
              {dialog.site.analytics.totalRegisterClicks.toLocaleString()} register clicks
            </span>
            <span>{dialog.site.analytics.conversionRate} conversion</span>
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryAction}
              onClick={() => onOpenDialog({ site: dialog.site, type: "preview" })}
              type="button"
            >
              Preview
            </button>
            <button
              className={styles.secondaryAction}
              onClick={() => onEditSite(dialog.site)}
              type="button"
            >
              Edit
            </button>
            <button
              className={styles.secondaryAction}
              onClick={() => onEditSite(dialog.site, 3)}
              type="button"
            >
              Contact Support
            </button>
            <button
              className={styles.secondaryAction}
              onClick={() => onOpenDialog({ site: dialog.site, type: "analytics" })}
              type="button"
            >
              Analytics
            </button>
            <button
              className={styles.secondaryAction}
              onClick={() => onCopyAgain(dialog.site)}
              type="button"
            >
              Copy Link
            </button>
            <button
              className={styles.secondaryAction}
              onClick={() =>
                onOpenDialog({
                  nextStatus: dialog.site.status === "paused" ? "published" : "paused",
                  site: dialog.site,
                  type: "status"
                })
              }
              type="button"
            >
              {dialog.site.status === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              className={styles.dangerAction}
              onClick={() => onOpenDialog({ site: dialog.site, type: "remove" })}
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      </AdminActionDialog>
    );
  }

  if (dialog.type === "preview") {
    return (
      <AdminActionDialog onClose={onClose} open size="large" title="Preview Coach Site">
        <CoachSitePreview site={dialog.site} />
      </AdminActionDialog>
    );
  }

  if (dialog.type === "analytics") {
    return (
      <AdminActionDialog onClose={onClose} open title="View Coach Analytics">
        <dl className={styles.definitionGrid}>
          <div>
            <dt>Total visits</dt>
            <dd>{dialog.site.analytics.totalVisits.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Register clicks</dt>
            <dd>{dialog.site.analytics.totalRegisterClicks.toLocaleString()}</dd>
          </div>
          <div>
            <dt>WhatsApp clicks</dt>
            <dd>{dialog.site.analytics.totalWhatsappClicks.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Conversion</dt>
            <dd>{dialog.site.analytics.conversionRate}</dd>
          </div>
        </dl>
      </AdminActionDialog>
    );
  }

  if (dialog.type === "copy") {
    return (
      <AdminActionDialog
        footer={
          <>
            <button className={styles.secondaryAction} onClick={onClose} type="button">
              Close
            </button>
            <button
              className={styles.primaryAction}
              onClick={() => onCopyAgain(dialog.site)}
              type="button"
            >
              Copy Again
            </button>
          </>
        }
        onClose={onClose}
        open
        title="Copy Link Confirmation"
      >
        <p className={styles.inlineStatus}>Stable public link copied or ready to copy.</p>
        <code className={styles.linkCode}>{dialog.link}</code>
      </AdminActionDialog>
    );
  }

  if (dialog.type === "status") {
    const action = dialog.nextStatus === "paused" ? "Pause Site" : "Resume Site";
    return (
      <AdminActionDialog
        footer={
          <>
            <button className={styles.secondaryAction} onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className={styles.primaryAction}
              onClick={() => onStatusConfirm(dialog.site, dialog.nextStatus)}
              type="button"
            >
              Confirm {action}
            </button>
          </>
        }
        onClose={onClose}
        open
        title={action}
      >
        <p className={styles.dialogCopy}>
          The public link stays the same: {dialog.site.publicUrl}.{" "}
          {dialog.nextStatus === "paused"
            ? "Visitors will see the temporarily unavailable support fallback."
            : "Visitors will see the public coach site again."}
        </p>
      </AdminActionDialog>
    );
  }

  return (
    <AdminActionDialog
      footer={
        <>
          <button className={styles.secondaryAction} onClick={onRemoveCancel} type="button">
            Cancel
          </button>
          <button
            className={styles.dangerAction}
            disabled={removeConfirm !== dialog.site.slug && removeConfirm !== dialog.site.coachName}
            type="button"
          >
            Verify OTP & Archive
          </button>
        </>
      }
      onClose={onRemoveCancel}
      open
      title="Remove Coach Site"
      tone="danger"
    >
      <p className={styles.dialogCopy}>
        This action may permanently remove this coach website. OTP verification is not configured,
        so permanent removal is disabled.
      </p>
      <dl className={styles.removeDetails}>
        <div>
          <dt>Coach</dt>
          <dd>{dialog.site.coachName}</dd>
        </div>
        <div>
          <dt>Slug</dt>
          <dd>{dialog.site.slug}</dd>
        </div>
        <div>
          <dt>Public link</dt>
          <dd>{dialog.site.publicUrl}</dd>
        </div>
        <div>
          <dt>Visits</dt>
          <dd>{dialog.site.analytics.totalVisits.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Clicks</dt>
          <dd>{dialog.site.analytics.totalRegisterClicks.toLocaleString()}</dd>
        </div>
      </dl>
      <div className={styles.formGrid}>
        <label className={styles.compactField}>
          <span>Type coach slug or coach name</span>
          <input onChange={(event) => setRemoveConfirm(event.target.value)} value={removeConfirm} />
        </label>
        <label className={styles.compactField}>
          <span>Removal reason</span>
          <select onChange={(event) => setRemoveReason(event.target.value)} value={removeReason}>
            {removalReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={styles.linkWarning}>
        OTP verification not configured. Permanent removal is disabled.
      </p>
    </AdminActionDialog>
  );
}

function HeroMediaStep({
  csrfToken,
  form,
  onUpdateField
}: {
  csrfToken: string;
  form: CoachSiteFormState;
  onUpdateField: <Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) => void;
}) {
  const [uploadMessage, setUploadMessage] = useState("");
  const imagePreviewUrl = form.photoUrl || form.logoUrl;
  const videoPreviewUrl = normalizeVideoEmbedUrl(form.videoUrl);
  const uploadedVideoUrl = isUploadedVideoSource(form.videoUrl) ? form.videoUrl : "";
  const videoInvalid =
    form.heroMediaType === "video" && form.videoUrl.trim() && !videoPreviewUrl && !uploadedVideoUrl;

  async function handleMediaUpload(file: File | undefined, mediaType: "image" | "video") {
    if (!file) return;

    const maxOriginalBytes = mediaType === "image" ? PHOTO_ORIGINAL_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > maxOriginalBytes) {
      setUploadMessage(
        mediaType === "image"
          ? "Photo is too large. Upload a photo under 20 MB so it can be optimized before saving."
          : "Video is too large. Use a video under 24 MB or add a video URL."
      );
      return;
    }

    if (mediaType === "image" && !isAllowedPhotoFile(file)) {
      setUploadMessage("Upload JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, or TIFF.");
      return;
    }

    if (mediaType === "video" && !file.type.startsWith("video/")) {
      setUploadMessage("Upload a video file.");
      return;
    }

    setUploadMessage(mediaType === "image" ? `Optimizing ${file.name}...` : `Uploading ${file.name}...`);

    const preparedMedia =
      mediaType === "image"
        ? await preparePhotoForUpload(file).catch(() => ({
            file,
            message: "Could not optimize this photo safely. Saving the original file.",
            optimized: false
          }))
        : { file, message: "", optimized: false };
    const uploadFile = preparedMedia.file;

    if (mediaType === "image" && uploadFile.size > PHOTO_STORED_MAX_BYTES) {
      setUploadMessage(
        "Photo is still too large after optimization. Use a smaller image or convert it to JPEG/WebP first."
      );
      return;
    }

    const previewUrl = URL.createObjectURL(uploadFile);
    onUpdateField(mediaType === "image" ? "photoUrl" : "videoUrl", previewUrl);
    setUploadMessage(
      preparedMedia.message
        ? `${preparedMedia.message} Uploading...`
        : `Uploading ${uploadFile.name}...`
    );

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("mediaType", mediaType);
      formData.append("slug", normalizeCoachSlug(form.slug || form.coachName) || "draft-coach");

      const response = await fetch("/api/admin/coach-sites/media", {
        body: formData,
        cache: "no-store",
        credentials: "include",
        headers: {
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as MediaUploadApiPayload;

      if (!response.ok || !payload.ok || !payload.media?.publicUrl) {
        const fallbackPreview = await readFileAsDataUrl(uploadFile);
        onUpdateField(mediaType === "image" ? "photoUrl" : "videoUrl", fallbackPreview);
        setUploadMessage(
          payload.error ||
            `${uploadFile.name} is preview-only until Cloudflare R2 media storage is enabled.`
        );
        return;
      }

      onUpdateField(mediaType === "image" ? "photoUrl" : "videoUrl", payload.media.publicUrl);
      setUploadMessage(
        mediaType === "image"
          ? `${uploadFile.name} uploaded to R2 (${formatBytes(uploadFile.size)}). ${preparedMedia.message}`
          : `${uploadFile.name} uploaded and saved for this coach site.`
      );
    } catch {
      const fallbackPreview = await readFileAsDataUrl(uploadFile);
      onUpdateField(mediaType === "image" ? "photoUrl" : "videoUrl", fallbackPreview);
      setUploadMessage(`${uploadFile.name} is preview-only because the upload API was not reachable.`);
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  }

  return (
    <div className={styles.mediaStep}>
      <label className={styles.compactField}>
        <span>Hero Media Type</span>
        <select
          onChange={(event) =>
            onUpdateField("heroMediaType", event.target.value as CoachHeroMediaType)
          }
          value={form.heroMediaType}
        >
          <option value="image">Photo/Image</option>
          <option value="video">Video Link</option>
          <option value="none">No Media</option>
        </select>
        <small>Choose one mode. The fixed template will only show the fields for that mode.</small>
      </label>

      {form.heroMediaType === "image" ? (
        <div className={styles.formGrid}>
          <label className={styles.compactField}>
            <span>Upload photo/image</span>
            <input
              accept={PHOTO_UPLOAD_ACCEPT}
              onChange={(event) => void handleMediaUpload(event.target.files?.[0], "image")}
              type="file"
            />
            <small>JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, and TIFF are supported.</small>
          </label>
          <TextField
            helper="Use a coach photo, logo, or hero image URL."
            label="Coach photo / hero image URL"
            onChange={(value) => onUpdateField("photoUrl", value)}
            type="url"
            value={form.photoUrl}
          />
          <TextField
            helper="Optional. Used as fallback image if no photo is added."
            label="Coach logo URL"
            onChange={(value) => onUpdateField("logoUrl", value)}
            type="url"
            value={form.logoUrl}
          />
          <div className={styles.mediaPreview} data-state={imagePreviewUrl ? "ready" : "empty"}>
            {imagePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="Hero media preview" src={imagePreviewUrl} />
            ) : (
              <span>Image preview</span>
            )}
          </div>
          {imagePreviewUrl ? (
            <button
              className={styles.secondaryAction}
              onClick={() => onUpdateField("photoUrl", "")}
              type="button"
            >
              Remove Image
            </button>
          ) : null}
        </div>
      ) : null}

      {form.heroMediaType === "video" ? (
        <div className={styles.formGrid}>
          <label className={styles.compactField}>
            <span>Upload video</span>
            <input
              accept="video/*"
              onChange={(event) => void handleMediaUpload(event.target.files?.[0], "video")}
              type="file"
            />
            <small>Use upload for a local video, or paste a YouTube/video URL below.</small>
          </label>
          <TextField
            helper="YouTube watch, shorts, share, and embed links are supported."
            label="Hero video URL"
            onChange={(value) => onUpdateField("videoUrl", value)}
            type="url"
            value={form.videoUrl}
          />
          <div className={styles.mediaPreview} data-state={videoPreviewUrl ? "ready" : "empty"}>
            {videoPreviewUrl ? (
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                src={videoPreviewUrl}
                title="Hero video preview"
              />
            ) : uploadedVideoUrl ? (
              <video controls src={uploadedVideoUrl} />
            ) : (
              <span>Video preview</span>
            )}
          </div>
          {videoInvalid ? (
            <p className={styles.linkWarning}>
              This video URL is not valid. Add a supported link or choose No Media.
            </p>
          ) : null}
          {form.videoUrl ? (
            <button
              className={styles.secondaryAction}
              onClick={() => onUpdateField("videoUrl", "")}
              type="button"
            >
              Remove Video
            </button>
          ) : null}
        </div>
      ) : null}

      {form.heroMediaType === "none" ? (
        <div className={styles.emptyState}>
          <h3>Text-only hero selected</h3>
          <p>No image or video field is needed. The public page will use a clean text-only hero.</p>
        </div>
      ) : null}
      {uploadMessage ? <p className={styles.inlineStatus}>{uploadMessage}</p> : null}
    </div>
  );
}

function WizardFooter({
  onClose,
  onPreparePreview,
  onPublish,
  onSaveDraft,
  setWizardStep,
  wizardStep
}: {
  onClose: () => void;
  onPreparePreview: () => boolean;
  onPublish: () => Promise<CoachSiteRecord>;
  onSaveDraft: () => Promise<CoachSiteRecord>;
  setWizardStep: (step: number) => void;
  wizardStep: number;
}) {
  return (
    <>
      <button className={styles.secondaryAction} onClick={onClose} type="button">
        Close
      </button>
      <button
        className={styles.secondaryAction}
        disabled={wizardStep === 0}
        onClick={() => setWizardStep(Math.max(wizardStep - 1, 0))}
        type="button"
      >
        Back
      </button>
      <button
        className={styles.secondaryAction}
        onClick={() => {
          const prepared = onPreparePreview();
          if (prepared) setWizardStep(5);
        }}
        type="button"
      >
        Preview
      </button>
      <button
        className={styles.secondaryAction}
        onClick={() => {
          void onSaveDraft();
          setWizardStep(6);
        }}
        type="button"
      >
        Save Draft
      </button>
      {wizardStep < wizardSteps.length - 1 ? (
        <button
          className={styles.primaryAction}
          onClick={() => setWizardStep(Math.min(wizardStep + 1, wizardSteps.length - 1))}
          type="button"
        >
          Next
        </button>
      ) : (
        <button
          className={styles.primaryAction}
          onClick={() => {
            void onPublish();
            setWizardStep(6);
          }}
          type="button"
        >
          Publish
        </button>
      )}
    </>
  );
}

function PublishPanel({
  onCopyLink,
  previewSite,
  publishedSite
}: {
  onCopyLink: (site: CoachSiteRecord) => void;
  previewSite: CoachSiteRecord | null;
  publishedSite: CoachSiteRecord | null;
}) {
  const site = publishedSite || previewSite;

  if (!site) {
    return (
      <div className={styles.emptyState}>
        <h3>No preview ready</h3>
        <p>Prepare a preview before publishing this coach site.</p>
      </div>
    );
  }

  return (
    <div className={styles.publishPanel}>
      <span className={styles.statusBadge} data-status={publishedSite ? "published" : site.status}>
        {publishedSite ? "Successfully Published" : site.status}
      </span>
      <h3>{site.coachName}</h3>
      <p>
        Stable public link stays the same after future edits unless the slug is intentionally
        changed.
      </p>
      <code>{site.publicUrl}</code>
      <button className={styles.primaryAction} onClick={() => onCopyLink(site)} type="button">
        Copy Public Link
      </button>
      {!site.googleFormUrl ? (
        <p className={styles.linkWarning}>
          Google Form link missing. The public page will show Contact Support fallback instead of a
          broken register link.
        </p>
      ) : null}
    </div>
  );
}

function CoachSitePreview({ site }: { site: CoachSiteRecord }) {
  const canRegister = Boolean(site.googleFormUrl);
  const previewImageUrl = site.heroMediaType === "image" ? site.photoUrl || site.logoUrl : "";
  const previewVideoUrl =
    site.heroMediaType === "video" ? normalizeVideoEmbedUrl(site.videoUrl) : "";
  const previewUploadedVideoUrl =
    site.heroMediaType === "video" && isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  return (
    <article className={styles.coachPreview}>
      <div className={styles.previewHero} data-media={site.heroMediaType}>
        <div>
          <div className={styles.previewTemplateMark}>
            <span>Yours Wellness Coach</span>
            <span>{site.location || site.niche}</span>
          </div>
          <p className={styles.previewNiche}>{site.niche}</p>
          <h3>{site.content.heroHeadline}</h3>
          <p>{site.content.subheadline}</p>
          <div className={styles.previewActions}>
            {canRegister ? (
              <a href={site.googleFormUrl} rel="noreferrer" target="_blank">
                {site.registerButtonText || site.content.ctaText}
              </a>
            ) : (
              <button disabled type="button">
                {site.registerButtonText || "Register Now"}
              </button>
            )}
            <code>{site.publicUrl}</code>
          </div>
          {!canRegister ? (
            <p className={styles.linkWarning}>
              Google Form link missing. Public users should see Contact Support fallback instead of
              a broken register link.
            </p>
          ) : null}
          <dl className={styles.previewFacts}>
            <div>
              <dt>Coach</dt>
              <dd>{site.coachName}</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd>{site.niche}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{site.location || "Yours Wellness"}</dd>
            </div>
          </dl>
        </div>
        {site.heroMediaType !== "none" ? (
          <div className={styles.previewMedia} data-media={site.heroMediaType}>
            {previewVideoUrl ? (
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                src={previewVideoUrl}
                title={`${site.coachName} hero video preview`}
              />
            ) : null}
            {previewUploadedVideoUrl ? (
              <video
                controls
                src={previewUploadedVideoUrl}
                title={`${site.coachName} hero video preview`}
              />
            ) : null}
            {previewImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${site.coachName} profile`} src={previewImageUrl} />
            ) : null}
            {!previewVideoUrl && !previewUploadedVideoUrl && !previewImageUrl ? (
              <span>{site.coachName.slice(0, 2).toUpperCase()}</span>
            ) : null}
            <div className={styles.previewMediaCaption}>
              <strong>{site.coachName}</strong>
              <span>{site.niche}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.previewGrid}>
        <section>
          <h4>Coach introduction</h4>
          <p>{site.content.coachIntro}</p>
        </section>
        <section>
          <h4>Vision</h4>
          <p>{site.content.visionText}</p>
        </section>
        <section>
          <h4>What guests can expect</h4>
          <ul>
            {site.content.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4>FAQ</h4>
          {site.content.faq.map((item) => (
            <div key={item.question}>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
            </div>
          ))}
        </section>
        <section>
          <h4>Contact Support</h4>
          <strong>{site.coachName}</strong>
          <p>{site.supportText || "Need help? Contact your coach directly."}</p>
          <p>
            {site.coachPhone || site.whatsappLink || site.coachEmail
              ? [site.coachPhone, site.whatsappLink, site.coachEmail].filter(Boolean).join(" / ")
              : "Default Yours Wellness support will be shown until coach contact details are added."}
          </p>
        </section>
      </div>

      <section className={styles.previewRegisterBand}>
        <div>
          <p className={styles.previewNiche}>Register</p>
          <h4>{site.content.ctaText || "Register Now"}</h4>
          <p>{site.content.trustText}</p>
        </div>
        {canRegister ? (
          <a href={site.googleFormUrl} rel="noreferrer" target="_blank">
            {site.registerButtonText || "Register Now"}
          </a>
        ) : (
          <button disabled type="button">
            Contact Support
          </button>
        )}
      </section>
    </article>
  );
}

function TextField({
  helper,
  label,
  onChange,
  required = false,
  type = "text",
  value
}: {
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "email" | "text" | "url";
  value: string;
}) {
  return (
    <label className={styles.compactField}>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function TextAreaField({
  helper,
  label,
  onChange,
  placeholder,
  value
}: {
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className={styles.compactField}>
      <span>{label}</span>
      <textarea
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function isAllowedPhotoFile(file: File) {
  const contentType = file.type.trim().toLowerCase();
  const extension = getClientFileExtension(file.name);

  if (contentType === "image/svg+xml") return false;
  if (ALLOWED_PHOTO_MIME_TYPES.has(contentType)) return true;

  return (
    Boolean(extension) &&
    ALLOWED_PHOTO_EXTENSIONS.has(extension) &&
    (contentType === "" || contentType === "application/octet-stream")
  );
}

async function preparePhotoForUpload(file: File) {
  const extension = getClientFileExtension(file.name);

  if (PASSTHROUGH_PHOTO_EXTENSIONS.has(extension) || file.type === "image/gif") {
    return {
      file,
      message: "Saved original format to preserve HEIC/HEIF/GIF quality.",
      optimized: false
    };
  }

  const decoded = await decodeImageForCanvas(file).catch(() => null);
  if (!decoded) {
    return {
      file,
      message: "Saved original because this browser cannot safely optimize that format.",
      optimized: false
    };
  }

  try {
    const largestEdge = Math.max(decoded.width, decoded.height);
    const scale = largestEdge > IMAGE_OPTIMIZE_MAX_EDGE ? IMAGE_OPTIMIZE_MAX_EDGE / largestEdge : 1;
    const targetWidth = Math.max(1, Math.round(decoded.width * scale));
    const targetHeight = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      return {
        file,
        message: "Saved original because browser image optimization was unavailable.",
        optimized: false
      };
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);

    const blob = await canvasToBlob(canvas, "image/webp", IMAGE_OPTIMIZE_QUALITY);
    if (!blob || blob.type !== "image/webp") {
      return {
        file,
        message: "Saved original because WebP optimization was unavailable.",
        optimized: false
      };
    }

    const compressionRequired = file.size > PHOTO_STORED_MAX_BYTES;
    const hasMeaningfulSavings = blob.size <= file.size * IMAGE_MIN_SAVINGS_RATIO;
    if ((!compressionRequired && !hasMeaningfulSavings) || blob.size >= file.size) {
      return {
        file,
        message: "Saved original because it was already efficiently compressed.",
        optimized: false
      };
    }

    const optimizedFile = new File([blob], replaceFileExtension(file.name, ".webp"), {
      lastModified: file.lastModified,
      type: "image/webp"
    });

    return {
      file: optimizedFile,
      message: `Optimized from ${formatBytes(file.size)} to ${formatBytes(blob.size)} with high-quality WebP.`,
      optimized: true
    };
  } finally {
    decoded.cleanup();
  }
}

async function decodeImageForCanvas(file: File): Promise<{
  cleanup: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        cleanup: () => bitmap.close(),
        height: bitmap.height,
        source: bitmap,
        width: bitmap.width
      };
    } catch {
      return loadImageElement(file);
    }
  }

  return loadImageElement(file);
}

function loadImageElement(file: File) {
  return new Promise<{
    cleanup: () => void;
    height: number;
    source: CanvasImageSource;
    width: number;
  }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      resolve({
        cleanup: () => URL.revokeObjectURL(objectUrl),
        height: image.naturalHeight || image.height,
        source: image,
        width: image.naturalWidth || image.width
      });
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be decoded."));
    });
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, contentType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, contentType, quality);
  });
}

function getClientFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

function replaceFileExtension(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[a-z0-9]+$/i, "") || "coach-photo";
  return `${baseName}${extension}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}
