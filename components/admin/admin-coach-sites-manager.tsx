"use client";

import {
  memo,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AdminActionDialog } from "./admin-dashboard-layout";
import {
  EMPTY_COACH_SITE_FORM,
  type CoachHeroMediaType,
  type CoachSiteFormState,
  type CoachSiteRecord,
  type CoachSiteStatus,
  createCoachSiteFromForm,
  createFormFromCoachSite,
  normalizeCoachSlug
} from "../../lib/admin-coach-sites";
import {
  coachTemplateThemes,
  type CoachTemplateThemeId,
  getCoachTemplateTheme
} from "../../lib/coach-template-themes";
import {
  isSupportedVideoSource,
  isUploadedVideoSource,
  normalizeVideoEmbedUrl
} from "../../lib/video-links";
import {
  createSupportErrorReference,
  getPublicSupportErrorCode,
  logWebsiteError,
  type PublicWebsiteErrorCategory
} from "../../lib/error-reporting";
import styles from "./admin-dashboard-shell.module.css";

type AdminCoachSitesManagerProps = {
  csrfToken: string;
  mode?: "create" | "list";
};

type CoachDialog =
  | { type: "analytics"; site: CoachSiteRecord }
  | { type: "copy"; link: string; site: CoachSiteRecord }
  | { type: "creator" }
  | { site: CoachSiteRecord; type: "delete-draft" }
  | { type: "manage"; site: CoachSiteRecord }
  | { type: "preview"; site: CoachSiteRecord }
  | { site: CoachSiteRecord; type: "reactivate" }
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

type CoachSitePublishVerification = {
  listHasSite: boolean;
  publicPageHasRegisterLink: boolean;
  publicPageHasTemplateMarker: boolean;
  publicPageOk: boolean;
};

type PublishProgressState = {
  message: string;
  phase: "error" | "idle" | "publishing" | "success";
  progress: number;
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

type GeneratedCoachCopy = {
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

type GeneratedCoachCopyUsage = {
  approximateCostLevel: "High" | "Low" | "Medium";
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  warning: string;
};

type PaidFunnelAnalysis = {
  cleanText: string;
  coachName?: string;
  faqHints: string[];
  headings: string[];
  keyPoints: string[];
  missingFields: string[];
  niche?: string;
  sourceUrl: string;
  title?: string;
};

type CopyRegenerationScope = "all" | "benefits" | "cta" | "faq" | "hero" | "intro" | "vision";
type PreviewInspectSection = Exclude<CopyRegenerationScope, "all">;
type CoachSiteDangerStatus = "archived" | "removed";
type CurrentCoachSiteStatus = Exclude<CoachSiteStatus, "archived" | "removed">;

const statusOptions: Array<"all" | CurrentCoachSiteStatus> = [
  "all",
  "draft",
  "published",
  "paused"
];

function getCoachSiteStatusFilterLabel(status: "all" | CurrentCoachSiteStatus) {
  if (status === "all") return "current records";
  return status;
}

function matchesCoachSiteSearch(site: CoachSiteRecord, query: string) {
  if (!query) return true;

  return (
    site.coachName.toLowerCase().includes(query) ||
    site.niche.toLowerCase().includes(query) ||
    site.slug.toLowerCase().includes(query)
  );
}

function getCoachSitePhotoUrl(site: CoachSiteRecord) {
  return site.photoUrl.trim() || site.logoUrl.trim();
}

function getCoachSiteInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "YW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function CoachSiteAvatar({ site }: { site: CoachSiteRecord }) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState("");
  const photoUrl = getCoachSitePhotoUrl(site);
  const showPhoto = Boolean(photoUrl && failedPhotoUrl !== photoUrl);
  const coachName = site.coachName || "Unnamed coach";

  return (
    <span aria-hidden="true" className={styles.coachAvatar}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- Coach images can be R2/external URLs and need safe fallback behavior.
        <img alt="" loading="lazy" onError={() => setFailedPhotoUrl(photoUrl)} src={photoUrl} />
      ) : (
        <span>{getCoachSiteInitials(coachName)}</span>
      )}
    </span>
  );
}

function CoachSiteIdentityCell({ site }: { site: CoachSiteRecord }) {
  return (
    <div className={styles.tableCoachCell}>
      <CoachSiteAvatar site={site} />
      <div className={styles.tableCoachText}>
        <strong>{site.coachName || "Unnamed coach"}</strong>
        <span>{site.niche || site.slug || "Coach details pending"}</span>
      </div>
    </div>
  );
}

const wizardSteps = [
  "Coach Basic Details",
  "Hero Media",
  "Coach Niche & Content",
  "Links & Contact Support",
  "Preview & Edit",
  "Publish"
];

const previewInspectSections: PreviewInspectSection[] = [
  "hero",
  "intro",
  "vision",
  "benefits",
  "faq",
  "cta"
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
const PREVIEW_SYNC_DELAY_MS = 180;
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

function applyGeneratedCopyToForm(
  current: CoachSiteFormState,
  content: GeneratedCoachCopy,
  scope: CopyRegenerationScope
): CoachSiteFormState {
  const faqText =
    content.faq?.map((item) => `${item.question}\n${item.answer}`).join("\n\n") || current.faqText;
  const benefitsText = content.benefits?.join("\n") || current.benefitsText;

  if (scope === "hero") {
    return {
      ...current,
      heroHeadline: content.heroHeadline || current.heroHeadline,
      subheadline: content.subheadline || current.subheadline
    };
  }

  if (scope === "benefits") {
    return {
      ...current,
      benefitsText
    };
  }

  if (scope === "faq") {
    return {
      ...current,
      faqText
    };
  }

  if (scope === "intro") {
    return {
      ...current,
      coachIntro: content.coachIntro || current.coachIntro
    };
  }

  if (scope === "vision") {
    return {
      ...current,
      visionText: content.visionText || current.visionText
    };
  }

  if (scope === "cta") {
    return {
      ...current,
      ctaText: content.ctaText || current.ctaText,
      trustText: content.trustText || current.trustText
    };
  }

  return {
    ...current,
    benefitsText,
    coachIntro: content.coachIntro || current.coachIntro,
    ctaText: content.ctaText || current.ctaText,
    faqText,
    heroHeadline: content.heroHeadline || current.heroHeadline,
    registerButtonText: current.registerButtonText || content.ctaText || "Register Now",
    socialCopy: content.socialCopy || current.socialCopy,
    subheadline: content.subheadline || current.subheadline,
    trustText: content.trustText || current.trustText,
    visionText: content.visionText || current.visionText
  };
}

function getCopyScopeLabel(scope: CopyRegenerationScope) {
  if (scope === "benefits") return "Benefits";
  if (scope === "cta") return "CTA section";
  if (scope === "faq") return "FAQ";
  if (scope === "hero") return "Hero copy";
  if (scope === "intro") return "Coach introduction";
  if (scope === "vision") return "Mission / vision";
  return "All copy";
}

export function AdminCoachSitesManager({ csrfToken, mode = "list" }: AdminCoachSitesManagerProps) {
  const [sites, setSites] = useState<CoachSiteRecord[]>([]);
  const [form, setForm] = useState<CoachSiteFormState>(EMPTY_COACH_SITE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewSite, setPreviewSite] = useState<CoachSiteRecord | null>(null);
  const [publishedSite, setPublishedSite] = useState<CoachSiteRecord | null>(null);
  const [dialog, setDialog] = useState<CoachDialog | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CurrentCoachSiteStatus>("all");
  const [archivedMenuOpen, setArchivedMenuOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [publishProgress, setPublishProgress] = useState<PublishProgressState>({
    message: "",
    phase: "idle",
    progress: 0
  });
  const [paidFunnelAnalysis, setPaidFunnelAnalysis] = useState<PaidFunnelAnalysis | null>(null);
  const [paidFunnelAnalysisBusy, setPaidFunnelAnalysisBusy] = useState(false);
  const [paidFunnelAnalysisMessage, setPaidFunnelAnalysisMessage] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removeMessage, setRemoveMessage] = useState("");
  const [removeOtp, setRemoveOtp] = useState("");
  const [removeOtpSending, setRemoveOtpSending] = useState(false);
  const [removeReason, setRemoveReason] = useState(removalReasons[0]);
  const [removeSubmitting, setRemoveSubmitting] = useState<CoachSiteDangerStatus | null>(null);
  const [storageErrorCode, setStorageErrorCode] = useState("");
  const [storageMessage, setStorageMessage] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const publishProgressTimerRef = useRef<number | null>(null);
  const previewSyncTimeoutRef = useRef<number | null>(null);
  const previewSyncFormRef = useRef<CoachSiteFormState | null>(null);

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
        setStorageErrorCode("");
        setStorageReady(Boolean(payload.configured));
        setStorageMessage(
          payload.configured
            ? "Coach-site database connected."
            : "Coach-site database is not configured. No production records are shown."
        );
      } catch {
        if (!cancelled) {
          setStorageReady(false);
          setStorageErrorCode("");
          setStorageMessage("Admin API is not reachable. No production records are shown.");
        }
      }
    }

    void loadPersistedCoachSites();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearPublishProgressTimer();

      if (previewSyncTimeoutRef.current !== null) {
        window.clearTimeout(previewSyncTimeoutRef.current);
      }
    };
  }, []);

  const visibleSites = useMemo(() => sites.filter((site) => site.status !== "removed"), [sites]);

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();

    return visibleSites.filter((site) => {
      const matchesStatus =
        site.status !== "archived" && (statusFilter === "all" || site.status === statusFilter);
      const matchesSearch = matchesCoachSiteSearch(site, query);

      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, visibleSites]);

  const draftSites = useMemo(
    () => filteredSites.filter((site) => site.status === "draft"),
    [filteredSites]
  );
  const archivedSites = useMemo(() => {
    const query = search.trim().toLowerCase();

    return visibleSites.filter(
      (site) => site.status === "archived" && matchesCoachSiteSearch(site, query)
    );
  }, [search, visibleSites]);
  const managedSites = useMemo(
    () =>
      filteredSites.filter(
        (site) => site.status !== "draft" && site.status !== "archived" && site.status !== "removed"
      ),
    [filteredSites]
  );

  function updateFormField<Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) {
    const nextForm = {
      ...form,
      [key]: value
    };

    if (key === "existingPaidFunnelUrl") {
      setPaidFunnelAnalysis(null);
      setPaidFunnelAnalysisMessage("");
    }

    setForm(nextForm);
    syncPreviewFromForm(nextForm);
  }

  function handleCoachNameChange(value: string) {
    const nextForm = {
      ...form,
      coachName: value,
      slug: editingId ? form.slug || normalizeCoachSlug(value) : normalizeCoachSlug(value)
    };

    setForm(nextForm);
    syncPreviewFromForm(nextForm);
  }

  function openCreatorDialog(site?: CoachSiteRecord, step = 0) {
    setAiMessage("");
    setAiSubmitting(false);
    resetPublishProgress();
    setPublishedSite(null);
    setPaidFunnelAnalysisMessage("");
    setPaidFunnelAnalysisBusy(false);
    if (site) {
      setEditingId(site.id);
      setForm(createFormFromCoachSite(site));
      setPreviewSite(site);
      setPaidFunnelAnalysis(
        site.existingPaidFunnelUrl && site.paidFunnelContext
          ? {
              cleanText: site.paidFunnelContext,
              faqHints: [],
              headings: [],
              keyPoints: [],
              missingFields: [],
              sourceUrl: site.existingPaidFunnelUrl
            }
          : null
      );
      setMessage(`Editing ${site.coachName}. Publish again to confirm the latest live version.`);
    } else {
      setEditingId(null);
      setForm(EMPTY_COACH_SITE_FORM);
      setPreviewSite(null);
      setPaidFunnelAnalysis(null);
      setMessage("");
    }
    setWizardStep(step);
    setDialog({ type: "creator" });
  }

  function buildPreviewSite(status: CoachSiteStatus, sourceForm = form) {
    const slug = normalizeCoachSlug(sourceForm.slug || sourceForm.coachName);

    return createCoachSiteFromForm({
      form: {
        ...sourceForm,
        slug
      },
      id: editingId || `coach-site-${slug || "draft"}`,
      status
    });
  }

  function syncPreviewFromForm(sourceForm: CoachSiteFormState) {
    previewSyncFormRef.current = sourceForm;

    if (previewSyncTimeoutRef.current !== null) {
      window.clearTimeout(previewSyncTimeoutRef.current);
    }

    previewSyncTimeoutRef.current = window.setTimeout(() => {
      const queuedForm = previewSyncFormRef.current;
      previewSyncTimeoutRef.current = null;

      if (!queuedForm) return;

      setPreviewSite((current) =>
        current ? buildPreviewSite(current.status, queuedForm) : current
      );
    }, PREVIEW_SYNC_DELAY_MS);
  }

  function validatePreviewForm(sourceForm: CoachSiteFormState, status: CoachSiteStatus = "draft") {
    const slug = normalizeCoachSlug(sourceForm.slug || sourceForm.coachName);
    if (!sourceForm.coachName.trim() || !sourceForm.niche.trim() || !slug) {
      setMessage("Coach name and coach niche are required.");
      return null;
    }

    if (sourceForm.heroMediaType === "video" && !isSupportedVideoSource(sourceForm.videoUrl)) {
      setMessage("Enter a valid YouTube/video URL, upload a video file, or choose No Media.");
      return null;
    }

    if (status === "published") {
      if (!sourceForm.selectedThemeId.trim()) {
        setMessage("Select the coach-site template/theme before publishing.");
        return null;
      }

      if (!sourceForm.googleFormUrl.trim()) {
        setMessage("Google Form registration link is required before publishing.");
        setStorageMessage("Save as draft until the coach-specific Google Form link is added.");
        return null;
      }

      if (!/^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(sourceForm.googleFormUrl)) {
        setMessage("Use a valid Google Form registration link before publishing.");
        return null;
      }

      if (
        sourceForm.heroMediaType === "image" &&
        !sourceForm.photoUrl.trim() &&
        !sourceForm.logoUrl.trim()
      ) {
        setMessage("Add a coach photo/logo or choose No Media before publishing.");
        return null;
      }
    }

    return {
      ...sourceForm,
      slug
    };
  }

  function fillMissingCopyFromTemplateFallback(
    sourceForm: CoachSiteFormState,
    status: CoachSiteStatus
  ): CoachSiteFormState {
    const fallbackSite = buildPreviewSite(status, sourceForm);

    return {
      ...sourceForm,
      benefitsText: sourceForm.benefitsText || fallbackSite.content.benefits.join("\n"),
      coachIntro: sourceForm.coachIntro || fallbackSite.content.coachIntro,
      ctaText: sourceForm.ctaText || fallbackSite.content.ctaText,
      faqText:
        sourceForm.faqText ||
        fallbackSite.content.faq.map((item) => `${item.question}\n${item.answer}`).join("\n\n"),
      heroHeadline: sourceForm.heroHeadline || fallbackSite.content.heroHeadline,
      socialCopy: sourceForm.socialCopy || fallbackSite.content.socialCopy,
      subheadline: sourceForm.subheadline || fallbackSite.content.subheadline,
      trustText: sourceForm.trustText || fallbackSite.content.trustText,
      visionText: sourceForm.visionText || fallbackSite.content.visionText
    };
  }

  async function upsertSite(status: CoachSiteStatus) {
    const validatedForm = validatePreviewForm(form, status);
    if (!validatedForm) return null;

    const site = { ...buildPreviewSite(status, validatedForm), status };
    const existingIndex = sites.findIndex((item) => item.id === site.id || item.slug === site.slug);
    const previousSites = sites;
    const nextSites =
      existingIndex >= 0
        ? sites.map((item, index) => (index === existingIndex ? site : item))
        : [site, ...sites];

    setForm(validatedForm);
    setSites(nextSites);
    setPreviewSite(site);
    setEditingId(site.id);
    setPublishedSite(null);
    if (status === "published") {
      startPublishProgress("Please wait. Site is being published...");
    } else {
      resetPublishProgress();
    }
    setMessage(status === "published" ? "Publishing site..." : "Saving draft...");

    try {
      if (status === "published") {
        updatePublishProgress("Saving coach website content...", 38);
      }

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
        setSites(previousSites);
        setStorageReady(Boolean(payload.configured));
        reportAdminStorageIssue({
          category: payload.configured === false ? "database_failure" : "admin_action_issue",
          coachSlug: site.slug,
          safeMessage:
            payload.error ||
            "Could not save to coach-site database. Local preview is still updated.",
          technicalDetails: `POST /api/admin/coach-sites failed with ${response.status}`,
          userAction: status === "published" ? "Publish coach site" : "Save coach site draft"
        });
        setMessage(
          status === "published"
            ? "Site was not published. Fix the database/API issue and try again."
            : "Draft was not saved. Reusable drafts require the coach-site database."
        );
        if (status === "published") {
          finishPublishProgressError(
            "Publishing stopped because the coach-site database did not save this website."
          );
        }
        return site;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setStorageMessage("Saved in coach-site database.");
      const savedSite = payload.coachSite;
      setSites((current) =>
        current.some((item) => item.id === site.id || item.slug === site.slug)
          ? current.map((item) =>
              item.id === site.id || item.slug === site.slug ? savedSite! : item
            )
          : [savedSite!, ...current]
      );
      setPreviewSite(savedSite);
      setEditingId(savedSite.id);

      if (status === "published") {
        updatePublishProgress("Verifying public website and registration link...", 78);
        setMessage("Verifying published site...");
        const verification = await verifyPublishedCoachSite(savedSite);

        if (!isPublishVerificationComplete(verification)) {
          reportAdminStorageIssue({
            category: "admin_action_issue",
            coachSlug: savedSite.slug,
            safeMessage:
              "Coach site was saved, but post-publish verification failed. Do not share the link yet.",
            technicalDetails: `Post-publish verification failed: ${JSON.stringify(verification)}`,
            userAction: "Verify newly published coach site"
          });
          setPublishedSite(null);
          setMessage(
            "Saved, but publish verification failed. Refresh Coach Sites and try publishing again."
          );
          finishPublishProgressError(
            "The website was saved, but final public verification failed. Do not share the link yet."
          );
          return savedSite;
        }
      }

      if (status === "published") {
        finishPublishProgressSuccess(savedSite);
      } else {
        setPublishedSite(null);
      }
      setMessage(
        status === "published"
          ? `Successfully Published. Stable public link: ${savedSite.publicUrl}`
          : "Draft saved successfully."
      );
      return savedSite;
    } catch {
      setSites(previousSites);
      setStorageReady(false);
      reportAdminStorageIssue({
        category: "network_or_server_failure",
        coachSlug: site.slug,
        safeMessage: "Could not reach coach-site database API. Local preview is still updated.",
        technicalDetails: "POST /api/admin/coach-sites network failure",
        userAction: status === "published" ? "Publish coach site" : "Save coach site draft"
      });
      setMessage(
        status === "published"
          ? "Site was not published. Fix the admin API connection and try again."
          : "Draft was not saved. Reusable drafts require the admin API and database."
      );
      if (status === "published") {
        finishPublishProgressError(
          "Publishing stopped because the admin API connection did not respond."
        );
      }
    }

    return site;
  }

  function clearPublishProgressTimer() {
    if (publishProgressTimerRef.current !== null) {
      window.clearInterval(publishProgressTimerRef.current);
      publishProgressTimerRef.current = null;
    }
  }

  function resetPublishProgress() {
    clearPublishProgressTimer();
    setPublishProgress({ message: "", phase: "idle", progress: 0 });
  }

  function startPublishProgress(messageText: string) {
    clearPublishProgressTimer();
    setPublishProgress({
      message: messageText,
      phase: "publishing",
      progress: 12
    });
    publishProgressTimerRef.current = window.setInterval(() => {
      setPublishProgress((current) => {
        if (current.phase !== "publishing") return current;

        const nextProgress =
          current.progress < 44
            ? current.progress + 7
            : current.progress < 72
              ? current.progress + 4
              : current.progress + 2;

        return {
          ...current,
          progress: Math.min(88, nextProgress)
        };
      });
    }, 340);
  }

  function updatePublishProgress(messageText: string, progress?: number) {
    setPublishProgress((current) =>
      current.phase === "publishing"
        ? {
            ...current,
            message: messageText,
            progress:
              typeof progress === "number" ? Math.max(current.progress, progress) : current.progress
          }
        : current
    );
  }

  function finishPublishProgressSuccess(site: CoachSiteRecord) {
    clearPublishProgressTimer();
    setPublishedSite(site);
    setPublishProgress({
      message: `Congratulations, ${site.coachName} now has his/her website live.`,
      phase: "success",
      progress: 100
    });
  }

  function finishPublishProgressError(messageText: string) {
    clearPublishProgressTimer();
    setPublishProgress({
      message: messageText,
      phase: "error",
      progress: 100
    });
  }

  function startAiProgress() {
    setAiSubmitting(true);
    setAiMessage("Generating coach website copy...");

    const timers = [
      window.setTimeout(() => {
        setAiMessage((current) =>
          current === "Generating coach website copy..." ? "Preparing preview..." : current
        );
      }, 500),
      window.setTimeout(() => {
        setAiMessage((current) =>
          current === "Preparing preview..."
            ? "Filling template with coach-specific content..."
            : current
        );
      }, 1050)
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }

  async function requestGeneratedCopy(
    sourceForm: CoachSiteFormState,
    scope: CopyRegenerationScope = "all"
  ) {
    const response = await fetch("/api/admin/coach-sites/generate-copy", {
      body: JSON.stringify({
        bio: sourceForm.bio,
        coachName: sourceForm.coachName,
        existingPaidFunnelUrl: sourceForm.existingPaidFunnelUrl,
        hasGoogleFormUrl: Boolean(sourceForm.googleFormUrl.trim()),
        hasSupportContact: Boolean(
          sourceForm.whatsappLink.trim() ||
          sourceForm.coachEmail.trim() ||
          sourceForm.coachPhone.trim()
        ),
        heroMediaType: sourceForm.heroMediaType,
        location: sourceForm.location,
        niche: sourceForm.niche,
        paidFunnelContext: sourceForm.paidFunnelContext,
        registerButtonText: sourceForm.registerButtonText,
        scope,
        supportText: sourceForm.supportText,
        vision: sourceForm.vision
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
      cache?: "hit" | "miss";
      configured?: boolean;
      content?: GeneratedCoachCopy;
      error?: string;
      message?: string;
      ok?: boolean;
      usageEstimate?: GeneratedCoachCopyUsage;
    };

    if (!response.ok || !payload.ok || !payload.content) {
      return {
        content: null,
        message:
          payload.message ||
          payload.error ||
          (payload.configured === false
            ? "AI generation not configured yet."
            : "AI copy generation failed.")
      };
    }

    return {
      content: payload.content,
      message: formatAiUsageMessage(payload.usageEstimate, payload.cache)
    };
  }

  function formatAiUsageMessage(usageEstimate?: GeneratedCoachCopyUsage, cache?: "hit" | "miss") {
    if (!usageEstimate) return "";

    return `Estimate: ${usageEstimate.estimatedInputTokens.toLocaleString()} input tokens / ${usageEstimate.estimatedOutputTokens.toLocaleString()} output tokens, ${usageEstimate.approximateCostLevel.toLowerCase()} cost${cache === "hit" ? ", cached result reused" : ""}.${usageEstimate.warning ? ` ${usageEstimate.warning}` : ""}`;
  }

  async function requestPaidFunnelAnalysis(sourceForm: CoachSiteFormState) {
    const url = sourceForm.existingPaidFunnelUrl.trim();
    if (!url) return null;

    setPaidFunnelAnalysisBusy(true);
    setPaidFunnelAnalysisMessage("Analyzing existing paid funnel page...");

    try {
      const response = await fetch("/api/admin/coach-sites/analyze-paid-funnel", {
        body: JSON.stringify({ url }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        analysis?: PaidFunnelAnalysis;
        error?: string;
        message?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.analysis) {
        reportAiCopyIssue({
          coachSlug: normalizeCoachSlug(sourceForm.slug || sourceForm.coachName || "paid-funnel"),
          safeMessage:
            payload.message || payload.error || "Could not analyze existing funnel page.",
          userAction: "Analyze existing paid funnel page"
        });
        setPaidFunnelAnalysisMessage(
          "Could not analyze existing funnel page. Manual entry and AI generation from manual fields are still available."
        );
        return null;
      }

      setPaidFunnelAnalysis(payload.analysis);
      setPaidFunnelAnalysisMessage(
        "Existing paid funnel page analyzed. Review the extracted preview."
      );
      return payload.analysis;
    } catch {
      reportAiCopyIssue({
        coachSlug: normalizeCoachSlug(sourceForm.slug || sourceForm.coachName || "paid-funnel"),
        safeMessage: "Could not analyze existing funnel page.",
        userAction: "Analyze existing paid funnel page"
      });
      setPaidFunnelAnalysisMessage(
        "Could not analyze existing funnel page. Manual entry and AI generation from manual fields are still available."
      );
      return null;
    } finally {
      setPaidFunnelAnalysisBusy(false);
    }
  }

  async function preparePaidFunnelContext(sourceForm: CoachSiteFormState) {
    if (!sourceForm.existingPaidFunnelUrl.trim()) return sourceForm;
    if (sourceForm.paidFunnelContext.trim()) return sourceForm;

    const analysis = paidFunnelAnalysis || (await requestPaidFunnelAnalysis(sourceForm));
    if (!analysis) return sourceForm;

    return applyPaidFunnelAnalysisToForm(sourceForm, analysis);
  }

  function applyPaidFunnelAnalysisToForm(
    sourceForm: CoachSiteFormState,
    analysis: PaidFunnelAnalysis
  ): CoachSiteFormState {
    const context = createPaidFunnelContextText(analysis);
    const keyPointsText = analysis.keyPoints.slice(0, 5).join("\n");
    const faqText = analysis.faqHints
      .slice(0, 4)
      .map((hint, index) => `Question ${index + 1}\n${hint}`)
      .join("\n\n");

    return {
      ...sourceForm,
      benefitsText: sourceForm.benefitsText || keyPointsText,
      coachName: sourceForm.coachName || analysis.coachName || "",
      existingPaidFunnelUrl: analysis.sourceUrl,
      faqText: sourceForm.faqText || faqText,
      heroHeadline: sourceForm.heroHeadline || analysis.headings[0] || analysis.title || "",
      niche: sourceForm.niche || analysis.niche || "",
      paidFunnelContext: context,
      subheadline: sourceForm.subheadline || analysis.headings[1] || "",
      vision: sourceForm.vision || analysis.keyPoints[0] || ""
    };
  }

  function createPaidFunnelContextText(analysis: PaidFunnelAnalysis) {
    return [
      `Source URL: ${analysis.sourceUrl}`,
      analysis.title ? `Title: ${analysis.title}` : "",
      analysis.coachName ? `Coach name found: ${analysis.coachName}` : "",
      analysis.niche ? `Niche found: ${analysis.niche}` : "",
      analysis.headings.length ? `Headings: ${analysis.headings.join(" | ")}` : "",
      analysis.keyPoints.length ? `Key points: ${analysis.keyPoints.join(" | ")}` : "",
      analysis.faqHints.length ? `FAQ hints: ${analysis.faqHints.join(" | ")}` : "",
      `Clean visible text: ${analysis.cleanText}`
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 7000);
  }

  async function generatePreviewFromDetails() {
    setAiMessage("");
    setMessage("");

    const preparedForm = await preparePaidFunnelContext(form);
    setForm(preparedForm);

    const validatedForm = validatePreviewForm(preparedForm);
    if (!validatedForm) return false;

    const status = previewSite?.status || "draft";
    setWizardStep(4);
    setPreviewSite(buildPreviewSite(status, validatedForm));
    setForm(validatedForm);

    const stopProgress = startAiProgress();
    let nextForm = validatedForm;

    try {
      const result = await requestGeneratedCopy(validatedForm, "all");

      if (result.content) {
        nextForm = applyGeneratedCopyToForm(validatedForm, result.content, "all");
        setAiMessage(
          `AI copy prepared. Review and edit before publishing.${result.message ? ` ${result.message}` : ""}`
        );
      } else {
        nextForm = fillMissingCopyFromTemplateFallback(validatedForm, status);
        reportAiCopyIssue({
          coachSlug: normalizeCoachSlug(validatedForm.slug || validatedForm.coachName),
          safeMessage: result.message,
          userAction: "Generate coach website preview copy"
        });
        setAiMessage(`${result.message} Preview opened for manual editing.`);
      }

      const site = buildPreviewSite(status, nextForm);
      setForm({
        ...nextForm,
        slug: site.slug
      });
      setPreviewSite(site);
      setMessage("Preview prepared. Review generated copy before publishing.");
      return true;
    } catch {
      nextForm = fillMissingCopyFromTemplateFallback(nextForm, status);
      const site = buildPreviewSite(status, nextForm);
      reportAiCopyIssue({
        coachSlug: site.slug,
        safeMessage: "AI copy generation failed.",
        userAction: "Generate coach website preview copy"
      });
      setForm({
        ...nextForm,
        slug: site.slug
      });
      setPreviewSite(site);
      setAiMessage("AI copy generation failed. Preview opened for manual editing.");
      setMessage("Preview prepared. Review and edit manually before publishing.");
      return true;
    } finally {
      stopProgress();
      setAiSubmitting(false);
    }
  }

  async function handleRegenerateCopy(scope: CopyRegenerationScope) {
    setAiMessage("");
    setMessage("");

    const preparedForm = await preparePaidFunnelContext(form);
    setForm(preparedForm);

    const validatedForm = validatePreviewForm(preparedForm);
    if (!validatedForm) return;

    const stopProgress = startAiProgress();
    const label = getCopyScopeLabel(scope);

    try {
      const result = await requestGeneratedCopy(validatedForm, scope);
      if (!result.content) {
        reportAiCopyIssue({
          coachSlug: normalizeCoachSlug(validatedForm.slug || validatedForm.coachName),
          safeMessage: result.message,
          userAction: `Regenerate ${label}`
        });
        setAiMessage(`${result.message} Manual editing remains available.`);
        return;
      }

      const nextForm = applyGeneratedCopyToForm(validatedForm, result.content, scope);
      const site = buildPreviewSite(previewSite?.status || "draft", nextForm);
      setForm({
        ...nextForm,
        slug: site.slug
      });
      setPreviewSite(site);
      setAiMessage(
        `${label} regenerated. Review before publishing.${result.message ? ` ${result.message}` : ""}`
      );
    } catch {
      reportAiCopyIssue({
        coachSlug: normalizeCoachSlug(validatedForm.slug || validatedForm.coachName),
        safeMessage: `${label} regeneration failed.`,
        userAction: `Regenerate ${label}`
      });
      setAiMessage(`${label} regeneration failed. Manual editing remains available.`);
    } finally {
      stopProgress();
      setAiSubmitting(false);
    }
  }

  async function updateSiteStatus(site: CoachSiteRecord, status: "paused" | "published") {
    setMessage(status === "paused" ? "Pausing coach site..." : "Resuming coach site...");

    const updatedSite = await persistSiteStatus(site, status);
    if (!updatedSite) {
      setMessage(
        status === "paused"
          ? "Coach site was not paused. Fix the database/API issue and try again."
          : "Coach site was not resumed. Fix the database/API issue and try again."
      );
      return;
    }

    setPreviewSite((current) => (current?.id === site.id ? updatedSite : current));
    setMessage(
      status === "paused"
        ? `${updatedSite.coachName} paused. Public link remains ${updatedSite.publicUrl}.`
        : `${updatedSite.coachName} resumed with the same public link: ${updatedSite.publicUrl}.`
    );
    setDialog(null);
  }

  async function publishDraftSite(site: CoachSiteRecord) {
    const publishError = getCoachSitePublishValidationMessage(site);
    if (publishError) {
      setMessage(publishError);
      setStorageMessage("Continue editing the draft and complete the required publish fields.");
      return;
    }

    setMessage("Publishing draft...");

    const publishedDraft = await persistSiteStatus(site, "published");
    if (!publishedDraft) {
      setMessage("Draft was not published. Fix the database/API issue and try again.");
      return;
    }

    setMessage("Verifying published draft...");
    const verification = await verifyPublishedCoachSite(publishedDraft);
    if (!isPublishVerificationComplete(verification)) {
      reportAdminStorageIssue({
        category: "admin_action_issue",
        coachSlug: publishedDraft.slug,
        safeMessage:
          "Draft was saved as published, but post-publish verification failed. Do not share the link yet.",
        technicalDetails: `Post-publish draft verification failed: ${JSON.stringify(verification)}`,
        userAction: "Verify published draft coach site"
      });
      setMessage(
        "Published status saved, but public verification failed. Reopen and verify before sharing."
      );
      return;
    }

    setPreviewSite((current) => (current?.id === site.id ? publishedDraft : current));
    setPublishedSite(publishedDraft);
    setMessage(`Successfully Published. Stable public link: ${publishedDraft.publicUrl}`);
    setDialog(null);
  }

  async function reactivateArchivedSite(site: CoachSiteRecord) {
    const restoredStatus: CoachSiteStatus = site.publishedAt ? "published" : "draft";
    const restoredSite = {
      ...site,
      archivedAt: undefined,
      status: restoredStatus,
      updatedAt: new Date().toISOString()
    };

    setSites((current) => current.map((item) => (item.id === site.id ? restoredSite : item)));
    setPreviewSite((current) => (current?.id === site.id ? restoredSite : current));
    setDialog(null);
    setMessage("Coach site reactivated successfully.");

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({
          action: "reactivate",
          siteId: site.id
        }),
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
        setSites((current) => current.map((item) => (item.id === site.id ? site : item)));
        setPreviewSite((current) => (current?.id === site.id ? site : current));
        setStorageReady(Boolean(payload.configured));
        setStorageMessage(payload.error || "Could not reactivate this coach site.");
        reportAdminStorageIssue({
          category: payload.configured === false ? "database_failure" : "admin_action_issue",
          coachSlug: site.slug,
          safeMessage: payload.error || "Archived coach site could not be reactivated.",
          technicalDetails: `PATCH /api/admin/coach-sites reactivate failed with ${response.status}`,
          userAction: "Reactivate archived coach site"
        });
        return;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setStorageMessage("Coach site reactivated successfully.");
      setSites((current) =>
        current.map((item) => (item.id === site.id ? payload.coachSite! : item))
      );
      setPreviewSite((current) => (current?.id === site.id ? payload.coachSite! : current));
    } catch {
      setSites((current) => current.map((item) => (item.id === site.id ? site : item)));
      setPreviewSite((current) => (current?.id === site.id ? site : current));
      setStorageReady(false);
      setStorageMessage("Could not reach admin API to reactivate this coach site.");
      reportAdminStorageIssue({
        category: "network_or_server_failure",
        coachSlug: site.slug,
        safeMessage:
          "Archived coach site could not be reactivated because the admin API was not reachable.",
        technicalDetails: "PATCH /api/admin/coach-sites reactivate network failure",
        userAction: "Reactivate archived coach site"
      });
    }
  }

  async function deleteDraftSite(site: CoachSiteRecord) {
    setStorageMessage("Deleting draft...");

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({
          action: "delete_draft",
          siteId: site.id,
          status: "removed"
        }),
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
        setStorageReady(Boolean(payload.configured));
        reportAdminStorageIssue({
          category: payload.configured === false ? "database_failure" : "admin_action_issue",
          coachSlug: site.slug,
          safeMessage: payload.error || "Could not delete this draft.",
          technicalDetails: `PATCH /api/admin/coach-sites delete_draft failed with ${response.status}`,
          userAction: "Delete coach site draft"
        });
        return;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setSites((current) => current.filter((item) => item.id !== site.id));
      setPreviewSite((current) => (current?.id === site.id ? null : current));
      setPublishedSite((current) => (current?.id === site.id ? null : current));
      setStorageMessage("Draft deleted.");
      setMessage(`${site.coachName || "Coach"} draft deleted.`);
      setDialog(null);
    } catch {
      setStorageReady(false);
      reportAdminStorageIssue({
        category: "network_or_server_failure",
        coachSlug: site.slug,
        safeMessage: "Could not reach admin API to delete this draft.",
        technicalDetails: "PATCH /api/admin/coach-sites delete_draft network failure",
        userAction: "Delete coach site draft"
      });
    }
  }

  async function sendCoachSiteDangerOtp(site: CoachSiteRecord) {
    setRemoveMessage("");
    setRemoveOtpSending(true);

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({
          action: "send_otp",
          siteId: site.id,
          status: "removed"
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json().catch(() => ({}))) as CoachSitesApiPayload & {
        localOtpMode?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        setRemoveMessage(payload.error || "Could not send OTP for this coach-site action.");
        return;
      }

      setRemoveMessage(
        payload.localOtpMode
          ? "Local OTP is available for this action."
          : payload.message || "OTP sent to the current admin email."
      );
    } catch {
      setRemoveMessage("Could not reach admin API to send OTP.");
    } finally {
      setRemoveOtpSending(false);
    }
  }

  async function confirmDangerousCoachSiteStatus(
    site: CoachSiteRecord,
    status: CoachSiteDangerStatus
  ) {
    const confirmationMatches = isRemovalConfirmationMatch(removeConfirm, site);
    if (!confirmationMatches) {
      setRemoveMessage("Type the exact coach slug or coach name before continuing.");
      return;
    }

    if (!/^\d{6}$/.test(removeOtp.trim())) {
      setRemoveMessage("Enter the 6-digit OTP before continuing.");
      return;
    }

    setRemoveMessage("");
    setRemoveSubmitting(status);

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({
          otp: removeOtp.trim(),
          removalReason: removeReason,
          siteId: site.id,
          status
        }),
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
        setRemoveMessage(payload.error || "Could not update this coach site.");
        setStorageReady(Boolean(payload.configured));
        return;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setStorageMessage(
        status === "archived"
          ? `${payload.coachSite.coachName} archived. It moved behind Archived Coaches and can be reactivated later.`
          : `${payload.coachSite.coachName} removed. Removed records are hidden from Admin lists and analytics.`
      );
      setSites((current) =>
        current.map((item) => (item.id === site.id ? payload.coachSite! : item))
      );
      setPreviewSite((current) => (current?.id === site.id ? payload.coachSite! : current));
      setRemoveConfirm("");
      setRemoveOtp("");
      setRemoveMessage("");
      setDialog(null);
    } catch {
      setRemoveMessage("Could not reach admin API for this coach-site action.");
    } finally {
      setRemoveSubmitting(null);
    }
  }

  async function persistSiteStatus(
    site: CoachSiteRecord,
    status: CoachSiteStatus
  ): Promise<CoachSiteRecord | null> {
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
        reportAdminStorageIssue({
          category: payload.configured === false ? "database_failure" : "admin_action_issue",
          coachSlug: site.slug,
          safeMessage: payload.error || "Status was not saved in the database.",
          technicalDetails: `PATCH /api/admin/coach-sites status failed with ${response.status}`,
          userAction: `Update coach site status to ${status}`
        });
        return null;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setStorageMessage("Coach-site status saved in database.");
      setSites((current) =>
        current.map((item) => (item.id === site.id ? payload.coachSite! : item))
      );
      return payload.coachSite;
    } catch {
      setStorageReady(false);
      reportAdminStorageIssue({
        category: "network_or_server_failure",
        coachSlug: site.slug,
        safeMessage: "Status was not saved because the admin API was not reachable.",
        technicalDetails: "PATCH /api/admin/coach-sites status network failure",
        userAction: `Update coach site status to ${status}`
      });
      return null;
    }
  }

  async function verifyPublishedCoachSite(
    site: CoachSiteRecord
  ): Promise<CoachSitePublishVerification> {
    const result: CoachSitePublishVerification = {
      listHasSite: false,
      publicPageHasRegisterLink: false,
      publicPageHasTemplateMarker: false,
      publicPageOk: false
    };

    try {
      const listResponse = await fetch("/api/admin/coach-sites", {
        cache: "no-store",
        credentials: "include"
      });
      const listPayload = (await listResponse.json().catch(() => ({}))) as CoachSitesApiPayload;
      result.listHasSite = Boolean(
        listResponse.ok &&
        listPayload.ok &&
        listPayload.coachSites?.some(
          (item) => item.id === site.id && item.slug === site.slug && item.status === "published"
        )
      );
    } catch {
      result.listHasSite = false;
    }

    try {
      const publicResponse = await fetch(site.publicUrl, {
        cache: "no-store",
        credentials: "same-origin"
      });
      const html = await publicResponse.text();
      result.publicPageOk = publicResponse.ok && !html.includes("Something went wrong");
      result.publicPageHasTemplateMarker = html.includes("YW Nutritech coach network");
      result.publicPageHasRegisterLink = html.includes(site.googleFormUrl);
    } catch {
      result.publicPageOk = false;
    }

    return result;
  }

  function isPublishVerificationComplete(verification: CoachSitePublishVerification) {
    return (
      verification.listHasSite &&
      verification.publicPageOk &&
      verification.publicPageHasTemplateMarker &&
      verification.publicPageHasRegisterLink
    );
  }

  function getCoachSitePublishValidationMessage(site: CoachSiteRecord) {
    if (!site.coachName.trim() || !site.niche.trim() || !site.slug.trim()) {
      return "Coach name, niche, and slug are required before publishing.";
    }

    if (!site.selectedThemeId.trim()) {
      return "Select the coach-site template/theme before publishing.";
    }

    if (!site.googleFormUrl.trim()) {
      return "Google Form registration link is required before publishing this draft.";
    }

    if (!/^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(site.googleFormUrl)) {
      return "Use a valid Google Form registration link before publishing this draft.";
    }

    if (site.heroMediaType === "image" && !site.photoUrl.trim() && !site.logoUrl.trim()) {
      return "Add a coach photo/logo or choose No Media before publishing this draft.";
    }

    if (site.heroMediaType === "video" && !site.videoUrl.trim()) {
      return "Add a video URL/upload or choose No Media before publishing this draft.";
    }

    return "";
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

  function reportAdminStorageIssue({
    category,
    coachSlug,
    safeMessage,
    technicalDetails,
    userAction
  }: {
    category: PublicWebsiteErrorCategory;
    coachSlug?: string;
    safeMessage: string;
    technicalDetails: string;
    userAction: string;
  }) {
    const errorCode = getPublicSupportErrorCode(category);
    const referenceId = createSupportErrorReference(category, coachSlug || userAction);

    setStorageErrorCode(errorCode);
    setStorageMessage(safeMessage);

    void logWebsiteError({
      category,
      coachSlug,
      errorCode,
      funnelStep: "admin-coach-site-draft-flow",
      referenceId,
      safeMessage,
      supportSource: "default",
      technicalDetails,
      userAction
    });
  }

  function reportAiCopyIssue({
    coachSlug,
    safeMessage,
    userAction
  }: {
    coachSlug?: string;
    safeMessage: string;
    userAction: string;
  }) {
    const errorCode = getPublicSupportErrorCode("ai_generation_issue");
    const referenceId = createSupportErrorReference("ai_generation_issue", coachSlug || userAction);

    void logWebsiteError({
      category: "ai_generation_issue",
      coachSlug,
      errorCode,
      funnelStep: "admin-coach-site-ai-copy",
      referenceId,
      safeMessage,
      supportSource: "default",
      technicalDetails: safeMessage,
      userAction
    });
  }

  async function copyStorageErrorCode() {
    if (!storageErrorCode) return;

    try {
      await navigator.clipboard.writeText(storageErrorCode);
    } catch {
      // The visible code remains available if clipboard permission is blocked.
    }
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
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | CurrentCoachSiteStatus)
                }
                value={statusFilter}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {getCoachSiteStatusFilterLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.archiveMenuShell}>
            <button
              aria-controls="archived-coaches-menu"
              aria-expanded={archivedMenuOpen}
              className={styles.secondaryAction}
              onClick={() => setArchivedMenuOpen((current) => !current)}
              type="button"
            >
              Archived Coaches ({archivedSites.length})
            </button>
            {archivedMenuOpen ? (
              <div
                className={styles.archiveMenu}
                id="archived-coaches-menu"
                role="region"
                aria-label="Archived coach sites"
              >
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.kicker}>Archived Coaches</p>
                    <h2>Hidden coach websites</h2>
                  </div>
                  <span className={styles.statusBadge} data-status="archived">
                    {archivedSites.length} Archived
                  </span>
                </div>
                {archivedSites.length > 0 ? (
                  <div className={styles.tableWrap}>
                    <table className={styles.table} data-density="compact">
                      <thead>
                        <tr>
                          <th>Coach</th>
                          <th>Niche</th>
                          <th>Public URL</th>
                          <th>Archived date</th>
                          <th>Last activity</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedSites.map((site) => (
                          <tr key={site.id}>
                            <td>
                              <CoachSiteIdentityCell site={site} />
                            </td>
                            <td>{site.niche || "Niche pending"}</td>
                            <td>
                              <code>{site.publicUrl}</code>
                            </td>
                            <td>{formatCoachArchivedDate(site)}</td>
                            <td>{formatCoachLastActivity(site)}</td>
                            <td>
                              <div className={styles.rowActions}>
                                <button
                                  onClick={() => setDialog({ site, type: "manage" })}
                                  type="button"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => setDialog({ site, type: "preview" })}
                                  type="button"
                                >
                                  Preview
                                </button>
                                <button
                                  data-tone="success"
                                  onClick={() => setDialog({ site, type: "reactivate" })}
                                  type="button"
                                >
                                  Reactivate
                                </button>
                                <button
                                  data-tone="danger"
                                  onClick={() => setDialog({ site, type: "remove" })}
                                  type="button"
                                >
                                  Delete Permanently
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.emptyState} data-compact="true">
                    <h3>No archived coach sites</h3>
                    <p>Archived coach websites will appear here only after opening this menu.</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <section className={styles.draftsPanel} aria-label="Coach site drafts">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Drafts</p>
                <h2>Saved coach website drafts</h2>
              </div>
              <span className={styles.statusBadge} data-status="draft">
                {draftSites.length} Draft{draftSites.length === 1 ? "" : "s"}
              </span>
            </div>
            {draftSites.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.table} data-density="compact">
                  <thead>
                    <tr>
                      <th>Coach</th>
                      <th>Niche</th>
                      <th>Status</th>
                      <th>Last edited</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftSites.map((site) => (
                      <tr key={site.id}>
                        <td>
                          <CoachSiteIdentityCell site={site} />
                        </td>
                        <td>{site.niche || "Niche pending"}</td>
                        <td>
                          <span className={styles.statusBadge} data-status="draft">
                            Draft
                          </span>
                        </td>
                        <td>{formatCoachLastEdited(site)}</td>
                        <td>
                          <div className={styles.rowActions}>
                            <button onClick={() => openCreatorDialog(site, 0)} type="button">
                              Continue Editing
                            </button>
                            <button
                              onClick={() => setDialog({ site, type: "preview" })}
                              type="button"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => {
                                void publishDraftSite(site);
                              }}
                              type="button"
                            >
                              Publish
                            </button>
                            <button
                              data-tone="danger"
                              onClick={() => setDialog({ site, type: "delete-draft" })}
                              type="button"
                            >
                              Delete Draft
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyState} data-compact="true">
                <h3>No drafts saved yet</h3>
                <p>Saved drafts will appear here after the creator stores them in the database.</p>
              </div>
            )}
          </section>

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
                {managedSites.length > 0 ? (
                  managedSites.map((site) => (
                    <tr key={site.id}>
                      <td>
                        <CoachSiteIdentityCell site={site} />
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
                          {site.analytics.totalRegisterClicks.toLocaleString()} CTA clicks /{" "}
                          {site.analytics.conversionRate} click-through
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No published or paused coach sites available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <span>{managedSites.length} managed coach sites</span>
            <span>{draftSites.length} reusable drafts</span>
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
        <p className={storageReady ? styles.inlineStatus : styles.linkWarning}>
          {storageErrorCode ? (
            <>
              <button
                className={styles.inlineErrorCode}
                onClick={() => void copyStorageErrorCode()}
                type="button"
              >
                {storageErrorCode}
              </button>
              <a className={styles.inlineSupportLink} href="/support/error">
                Contact Support
              </a>
            </>
          ) : null}
          {storageMessage}
        </p>
      ) : null}

      <CoachDialogRenderer
        aiMessage={aiMessage}
        aiSubmitting={aiSubmitting}
        csrfToken={csrfToken}
        dialog={dialog}
        form={form}
        onAnalyzePaidFunnel={() => requestPaidFunnelAnalysis(form)}
        onClose={() => setDialog(null)}
        onCopyAgain={(site) => void copyPublicLink(site)}
        onDeleteDraft={(site) => void deleteDraftSite(site)}
        onEditSite={openCreatorDialog}
        onGeneratePreview={generatePreviewFromDetails}
        onOpenDialog={setDialog}
        onPreviewSiteChange={setPreviewSite}
        onPublish={() => upsertSite("published")}
        onPublishDraft={publishDraftSite}
        onRegenerateCopy={handleRegenerateCopy}
        onRemoveAction={confirmDangerousCoachSiteStatus}
        onRemoveCancel={() => {
          setRemoveConfirm("");
          setRemoveMessage("");
          setRemoveOtp("");
          setRemoveSubmitting(null);
          setDialog(null);
        }}
        onReactivateSite={(site) => void reactivateArchivedSite(site)}
        onSendRemoveOtp={sendCoachSiteDangerOtp}
        onSaveDraft={() => upsertSite("draft")}
        onStatusConfirm={updateSiteStatus}
        onUpdateCoachName={handleCoachNameChange}
        onUpdateField={updateFormField}
        paidFunnelAnalysis={paidFunnelAnalysis}
        paidFunnelAnalysisBusy={paidFunnelAnalysisBusy}
        paidFunnelAnalysisMessage={paidFunnelAnalysisMessage}
        previewSite={previewSite}
        publishProgress={publishProgress}
        publishedSite={publishedSite}
        removeConfirm={removeConfirm}
        removeMessage={removeMessage}
        removeOtp={removeOtp}
        removeOtpSending={removeOtpSending}
        removeReason={removeReason}
        removeSubmitting={removeSubmitting}
        setRemoveConfirm={setRemoveConfirm}
        setRemoveOtp={setRemoveOtp}
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
  onAnalyzePaidFunnel,
  onClose,
  onCopyAgain,
  onDeleteDraft,
  onEditSite,
  onGeneratePreview,
  onOpenDialog,
  onPreviewSiteChange,
  onPublish,
  onPublishDraft,
  onReactivateSite,
  onRegenerateCopy,
  onRemoveAction,
  onRemoveCancel,
  onSendRemoveOtp,
  onSaveDraft,
  onStatusConfirm,
  onUpdateCoachName,
  onUpdateField,
  paidFunnelAnalysis,
  paidFunnelAnalysisBusy,
  paidFunnelAnalysisMessage,
  previewSite,
  publishProgress,
  publishedSite,
  removeConfirm,
  removeMessage,
  removeOtp,
  removeOtpSending,
  removeReason,
  removeSubmitting,
  setRemoveConfirm,
  setRemoveOtp,
  setRemoveReason,
  setWizardStep,
  wizardStep
}: {
  aiMessage: string;
  aiSubmitting: boolean;
  csrfToken: string;
  dialog: CoachDialog | null;
  form: CoachSiteFormState;
  onAnalyzePaidFunnel: () => Promise<PaidFunnelAnalysis | null>;
  onClose: () => void;
  onCopyAgain: (site: CoachSiteRecord) => void;
  onDeleteDraft: (site: CoachSiteRecord) => void;
  onEditSite: (site?: CoachSiteRecord, step?: number) => void;
  onGeneratePreview: () => Promise<boolean>;
  onOpenDialog: (dialog: CoachDialog) => void;
  onPreviewSiteChange: (site: CoachSiteRecord) => void;
  onPublish: () => Promise<CoachSiteRecord | null>;
  onPublishDraft: (site: CoachSiteRecord) => Promise<void>;
  onReactivateSite: (site: CoachSiteRecord) => void;
  onRegenerateCopy: (scope: CopyRegenerationScope) => Promise<void>;
  onRemoveAction: (site: CoachSiteRecord, status: CoachSiteDangerStatus) => Promise<void>;
  onRemoveCancel: () => void;
  onSendRemoveOtp: (site: CoachSiteRecord) => Promise<void>;
  onSaveDraft: () => Promise<CoachSiteRecord | null>;
  onStatusConfirm: (site: CoachSiteRecord, status: "paused" | "published") => Promise<void>;
  onUpdateCoachName: (value: string) => void;
  onUpdateField: <Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) => void;
  paidFunnelAnalysis: PaidFunnelAnalysis | null;
  paidFunnelAnalysisBusy: boolean;
  paidFunnelAnalysisMessage: string;
  previewSite: CoachSiteRecord | null;
  publishProgress: PublishProgressState;
  publishedSite: CoachSiteRecord | null;
  removeConfirm: string;
  removeMessage: string;
  removeOtp: string;
  removeOtpSending: boolean;
  removeReason: string;
  removeSubmitting: CoachSiteDangerStatus | null;
  setRemoveConfirm: (value: string) => void;
  setRemoveOtp: (value: string) => void;
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
            aiSubmitting={aiSubmitting}
            onClose={onClose}
            onGeneratePreview={onGeneratePreview}
            onPublish={onPublish}
            onSaveDraft={onSaveDraft}
            publishSubmitting={publishProgress.phase === "publishing"}
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
                disabled={aiSubmitting}
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
                    helper="Used for the public coach page, hidden error-support fallback, and stable link."
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
                <ThemeChoiceField
                  onChange={(value) => onUpdateField("selectedThemeId", value)}
                  selectedThemeId={form.selectedThemeId}
                />
              </>
            ) : null}

            {wizardStep === 1 ? (
              <HeroMediaStep csrfToken={csrfToken} form={form} onUpdateField={onUpdateField} />
            ) : null}

            {wizardStep === 2 ? (
              <div className={styles.copyEditorGrid}>
                <div className={styles.analysisPanel}>
                  <TextField
                    helper="Optional. Use this when creating a free guest website from an existing paid funnel page."
                    label="Existing Paid Funnel Page URL"
                    onChange={(value) => onUpdateField("existingPaidFunnelUrl", value)}
                    type="url"
                    value={form.existingPaidFunnelUrl}
                  />
                  <div className={styles.formActions}>
                    <button
                      className={styles.secondaryAction}
                      disabled={!form.existingPaidFunnelUrl.trim() || paidFunnelAnalysisBusy}
                      onClick={() => void onAnalyzePaidFunnel()}
                      type="button"
                    >
                      {paidFunnelAnalysisBusy ? "Analyzing..." : "Analyze Existing Page"}
                    </button>
                  </div>
                  {paidFunnelAnalysisMessage ? (
                    <p className={styles.inlineNote}>{paidFunnelAnalysisMessage}</p>
                  ) : null}
                  {paidFunnelAnalysis ? (
                    <ExtractedPaidFunnelPreview analysis={paidFunnelAnalysis} />
                  ) : null}
                </div>
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
                  helper="Hidden from the normal public page. Used only on error/unavailable fallback pages."
                  label="Error support WhatsApp link"
                  onChange={(value) => onUpdateField("whatsappLink", value)}
                  type="url"
                  value={form.whatsappLink}
                />
                <TextField
                  helper="Hidden from the normal public page. Used only on error/unavailable fallback pages."
                  label="Error support email"
                  onChange={(value) => onUpdateField("coachEmail", value)}
                  type="email"
                  value={form.coachEmail}
                />
                <TextField
                  helper="Hidden from the normal public page. Used only on error/unavailable fallback pages."
                  label="Error support phone"
                  onChange={(value) => onUpdateField("coachPhone", value)}
                  value={form.coachPhone}
                />
                <TextField
                  label="Register button text"
                  onChange={(value) => onUpdateField("registerButtonText", value)}
                  value={form.registerButtonText}
                />
                <TextAreaField
                  helper="Hidden from the normal public page. Shown with the error/reference code only."
                  label="Error support text"
                  onChange={(value) => onUpdateField("supportText", value)}
                  placeholder="Need help? Contact your coach directly."
                  value={form.supportText}
                />
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <PreviewAndEditStep
                aiMessage={aiMessage}
                aiSubmitting={aiSubmitting}
                form={form}
                onPreviewSiteChange={onPreviewSiteChange}
                onRegenerateCopy={onRegenerateCopy}
                onUpdateField={onUpdateField}
                previewSite={previewSite}
              />
            ) : null}

            {wizardStep === 5 ? (
              <PublishPanel
                onCopyLink={onCopyAgain}
                publishProgress={publishProgress}
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
              {dialog.site.analytics.totalRegisterClicks.toLocaleString()} register CTA clicks
            </span>
            <span>{dialog.site.analytics.conversionRate} click-through</span>
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
            {dialog.site.status === "published" || dialog.site.status === "paused" ? (
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
            ) : null}
            {dialog.site.status === "archived" ? (
              <button
                className={styles.primaryAction}
                onClick={() => onOpenDialog({ site: dialog.site, type: "reactivate" })}
                type="button"
              >
                Reactivate
              </button>
            ) : null}
            <button
              className={styles.dangerAction}
              onClick={() => onOpenDialog({ site: dialog.site, type: "remove" })}
              type="button"
            >
              {dialog.site.status === "archived" ? "Delete Permanently" : "Archive / Remove"}
            </button>
          </div>
        </div>
      </AdminActionDialog>
    );
  }

  if (dialog.type === "delete-draft") {
    return (
      <AdminActionDialog
        footer={
          <>
            <button className={styles.secondaryAction} onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className={styles.primaryAction}
              onClick={() => {
                void onPublishDraft(dialog.site);
              }}
              type="button"
            >
              Publish Instead
            </button>
            <button
              className={styles.dangerAction}
              onClick={() => onDeleteDraft(dialog.site)}
              type="button"
            >
              Delete Draft
            </button>
          </>
        }
        onClose={onClose}
        open
        title="Delete Draft"
        tone="danger"
      >
        <p className={styles.dialogCopy}>
          This removes the saved draft from the Drafts list. It is not public right now, and
          published coach sites are not affected.
        </p>
        <dl className={styles.definitionGrid}>
          <div>
            <dt>Coach</dt>
            <dd>{dialog.site.coachName || "Unnamed coach"}</dd>
          </div>
          <div>
            <dt>Niche</dt>
            <dd>{dialog.site.niche || "Niche pending"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Draft</dd>
          </div>
          <div>
            <dt>Last edited</dt>
            <dd>{formatCoachLastEdited(dialog.site)}</dd>
          </div>
        </dl>
      </AdminActionDialog>
    );
  }

  if (dialog.type === "reactivate") {
    const restoredStatus = dialog.site.publishedAt ? "Published" : "Draft";

    return (
      <AdminActionDialog
        footer={
          <>
            <button className={styles.secondaryAction} onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className={styles.primaryAction}
              onClick={() => onReactivateSite(dialog.site)}
              type="button"
            >
              Restore Site
            </button>
          </>
        }
        onClose={onClose}
        open
        title="Reactivate Coach Site"
      >
        <p className={styles.dialogCopy}>
          This restores the same saved coach website and keeps the same public link:{" "}
          {dialog.site.publicUrl}. The restored status will be {restoredStatus}.
        </p>
        <dl className={styles.definitionGrid}>
          <div>
            <dt>Coach</dt>
            <dd>{dialog.site.coachName || "Unnamed coach"}</dd>
          </div>
          <div>
            <dt>Niche</dt>
            <dd>{dialog.site.niche || "Niche pending"}</dd>
          </div>
          <div>
            <dt>Archived date</dt>
            <dd>{formatCoachArchivedDate(dialog.site)}</dd>
          </div>
          <div>
            <dt>Public link</dt>
            <dd>{dialog.site.publicUrl}</dd>
          </div>
        </dl>
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
            <dt>Register CTA clicks</dt>
            <dd>{dialog.site.analytics.totalRegisterClicks.toLocaleString()}</dd>
          </div>
          <div>
            <dt>WhatsApp clicks</dt>
            <dd>{dialog.site.analytics.totalWhatsappClicks.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Click-through rate</dt>
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
              onClick={() => {
                void onStatusConfirm(dialog.site, dialog.nextStatus);
              }}
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
            ? "Visitors will see the temporarily unavailable page with the hidden support fallback."
            : "Visitors will see the public coach site again."}
        </p>
      </AdminActionDialog>
    );
  }

  const removeConfirmationMatches = isRemovalConfirmationMatch(removeConfirm, dialog.site);
  const removeOtpValid = /^\d{6}$/.test(removeOtp.trim());
  const removeBusy = Boolean(removeSubmitting);
  const removeActionsReady = removeConfirmationMatches && removeOtpValid && !removeBusy;
  const archiveAlreadyDone = dialog.site.status === "archived";
  const removeMessageIsSuccess =
    removeMessage.toLowerCase().includes("otp sent") ||
    removeMessage.toLowerCase().includes("local otp");

  return (
    <AdminActionDialog
      footer={
        <>
          <button className={styles.secondaryAction} onClick={onRemoveCancel} type="button">
            Cancel
          </button>
          <button
            className={styles.secondaryAction}
            disabled={removeOtpSending || removeBusy}
            onClick={() => void onSendRemoveOtp(dialog.site)}
            type="button"
          >
            {removeOtpSending ? "Sending OTP..." : "Send OTP"}
          </button>
          {!archiveAlreadyDone ? (
            <button
              className={removeActionsReady ? styles.primaryAction : styles.secondaryAction}
              disabled={!removeConfirmationMatches || !removeOtpValid || removeBusy}
              onClick={() => void onRemoveAction(dialog.site, "archived")}
              type="button"
            >
              {removeSubmitting === "archived" ? "Archiving..." : "Archive Site"}
            </button>
          ) : null}
          <button
            className={`${styles.dangerAction} ${removeActionsReady ? styles.dangerActionReady : ""}`}
            disabled={!removeConfirmationMatches || !removeOtpValid || removeBusy}
            onClick={() => void onRemoveAction(dialog.site, "removed")}
            type="button"
          >
            {removeSubmitting === "removed" ? "Removing..." : "Remove Site"}
          </button>
        </>
      }
      onClose={onRemoveCancel}
      open
      title="Archive or Remove Coach Site"
      tone="danger"
    >
      <p className={styles.dialogCopy}>
        {archiveAlreadyDone
          ? "This coach site is already archived. Permanent removal is separate, destructive, and still requires OTP."
          : "Archive hides this coach site from normal lists and keeps it restorable from Archived Coaches. Remove marks it removed, hides it from Admin lists and analytics, and prevents static fallback from reappearing for the same slug."}
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
      <div className={styles.removalChoiceGrid}>
        {!archiveAlreadyDone ? (
          <article>
            <strong>Archive</strong>
            <p>Use this when the coach may return later. The admin record stays manageable.</p>
          </article>
        ) : null}
        <article data-tone="danger">
          <strong>Remove</strong>
          <p>
            Use this when the site should disappear from Admin lists and analytics. OTP is required.
          </p>
        </article>
      </div>
      <div className={styles.formGrid}>
        <label className={styles.compactField}>
          <span>Type coach slug or coach name</span>
          <input
            onChange={(event) => setRemoveConfirm(event.target.value)}
            placeholder={`${dialog.site.slug} or ${dialog.site.coachName}`}
            value={removeConfirm}
          />
          <small>
            Type <strong>{dialog.site.slug}</strong> or <strong>{dialog.site.coachName}</strong>.
            Spaces and uppercase/lowercase are ignored.
          </small>
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
        <label className={styles.compactField}>
          <span>OTP</span>
          <input
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setRemoveOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            value={removeOtp}
          />
          <small>Send OTP first, then enter the code sent to the current admin email.</small>
        </label>
      </div>
      <div
        className={styles.removeUnlockChecklist}
        data-ready={removeActionsReady ? "true" : "false"}
      >
        <span data-complete={removeConfirmationMatches ? "true" : "false"}>
          {removeConfirmationMatches ? "Coach confirmation matched" : "Coach confirmation pending"}
        </span>
        <span data-complete={removeOtpValid ? "true" : "false"}>
          {removeOtpValid ? "6-digit OTP entered" : "6-digit OTP pending"}
        </span>
        <strong>
          {removeActionsReady
            ? "Archive and Remove buttons are unlocked."
            : "Both checks must pass before Archive or Remove becomes active."}
        </strong>
      </div>
      {removeMessage ? (
        <p className={removeMessageIsSuccess ? styles.inlineStatus : styles.linkWarning}>
          {removeMessage}
        </p>
      ) : null}
    </AdminActionDialog>
  );
}

function isRemovalConfirmationMatch(value: string, site: CoachSiteRecord) {
  const confirmation = normalizeRemovalConfirmation(value);

  return (
    confirmation === normalizeRemovalConfirmation(site.slug) ||
    confirmation === normalizeRemovalConfirmation(site.coachName)
  );
}

function normalizeRemovalConfirmation(value: string) {
  return value.trim().toLowerCase();
}

function formatCoachLastEdited(site: CoachSiteRecord) {
  const rawValue = site.updatedAt || site.createdAt;
  if (!rawValue) return "Not saved yet";

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "Not saved yet";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatCoachArchivedDate(site: CoachSiteRecord) {
  const rawValue = site.archivedAt || site.updatedAt;
  if (!rawValue) return "Not archived yet";

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "Not archived yet";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatCoachLastActivity(site: CoachSiteRecord) {
  const analyticsUpdated = site.analytics.lastUpdated;
  if (analyticsUpdated && analyticsUpdated !== "Not connected") {
    return analyticsUpdated;
  }

  return formatCoachLastEdited(site);
}

function ExtractedPaidFunnelPreview({ analysis }: { analysis: PaidFunnelAnalysis }) {
  return (
    <div className={styles.extractedPreview}>
      <div>
        <p className={styles.kicker}>Extracted Information Preview</p>
        <h3>{analysis.coachName || "Coach name not found yet"}</h3>
        <p>{analysis.niche || "Niche not found yet"}</p>
      </div>
      {analysis.title ? <span>Title: {analysis.title}</span> : null}
      {analysis.headings.length > 0 ? (
        <span>Headings: {analysis.headings.slice(0, 4).join(" / ")}</span>
      ) : null}
      {analysis.keyPoints.length > 0 ? (
        <ul>
          {analysis.keyPoints.slice(0, 4).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
      {analysis.missingFields.length > 0 ? (
        <p>Missing fields: {analysis.missingFields.join(", ")}</p>
      ) : (
        <p>Enough page context was extracted for AI copy generation.</p>
      )}
    </div>
  );
}

function PreviewAndEditStep({
  aiMessage,
  aiSubmitting,
  form,
  onPreviewSiteChange,
  onRegenerateCopy,
  onUpdateField,
  previewSite
}: {
  aiMessage: string;
  aiSubmitting: boolean;
  form: CoachSiteFormState;
  onPreviewSiteChange: (site: CoachSiteRecord) => void;
  onRegenerateCopy: (scope: CopyRegenerationScope) => Promise<void>;
  onUpdateField: <Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) => void;
  previewSite: CoachSiteRecord | null;
}) {
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedInspectScope, setSelectedInspectScope] = useState<PreviewInspectSection | null>(
    null
  );
  const selectedInspectLabel = selectedInspectScope ? getCopyScopeLabel(selectedInspectScope) : "";

  return (
    <div className={styles.previewEditStep}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>Preview & Edit</p>
          <h2>Review generated coach website copy</h2>
        </div>
        <div className={styles.regenerateActions}>
          <button
            className={styles.secondaryAction}
            disabled={aiSubmitting}
            onClick={() => void onRegenerateCopy("all")}
            type="button"
          >
            Regenerate All Copy
          </button>
          <button
            aria-pressed={inspectMode}
            className={styles.inspectToggleButton}
            disabled={aiSubmitting}
            onClick={() => {
              if (inspectMode) {
                setSelectedInspectScope(null);
              }
              setInspectMode(!inspectMode);
            }}
            title="Select a preview section to regenerate"
            type="button"
          >
            <CursorInspectIcon />
            <span>{inspectMode ? "Selecting" : "Inspect"}</span>
          </button>
        </div>
      </div>

      {aiSubmitting ? (
        <div className={styles.aiProgressCard}>
          <strong>{aiMessage || "Generating coach website copy..."}</strong>
          <ul>
            <li>Generating coach website copy...</li>
            <li>Preparing preview...</li>
            <li>Filling template with coach-specific content...</li>
          </ul>
        </div>
      ) : null}

      {!aiSubmitting && aiMessage ? <p className={styles.inlineStatus}>{aiMessage}</p> : null}

      {inspectMode ? (
        <div className={styles.previewInspectTray}>
          <div>
            {previewInspectSections.map((scope) => (
              <button
                data-active={selectedInspectScope === scope ? "true" : "false"}
                key={scope}
                onClick={() => setSelectedInspectScope(scope)}
                type="button"
              >
                {getCopyScopeLabel(scope)}
              </button>
            ))}
          </div>
          <button
            className={styles.primaryAction}
            disabled={!selectedInspectScope || aiSubmitting}
            onClick={() => selectedInspectScope && void onRegenerateCopy(selectedInspectScope)}
            type="button"
          >
            {selectedInspectLabel ? `Regenerate ${selectedInspectLabel}` : "Select Section"}
          </button>
        </div>
      ) : null}

      <div className={styles.copyEditorPanel}>
        <div>
          <p className={styles.kicker}>Editable Copy</p>
          <h3>Fixed-template content only</h3>
          <p>
            AI and manual edits change copy only. Design, routes, security, and the public template
            structure stay fixed.
          </p>
        </div>
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
            label="Coach introduction"
            onChange={(value) => onUpdateField("coachIntro", value)}
            value={form.coachIntro}
          />
          <TextAreaField
            label="Mission / vision copy"
            onChange={(value) => onUpdateField("visionText", value)}
            value={form.visionText}
          />
          <TextAreaField
            label="Benefits"
            onChange={(value) => onUpdateField("benefitsText", value)}
            placeholder="One benefit per line"
            value={form.benefitsText}
          />
          <TextAreaField
            label="CTA section text"
            onChange={(value) => onUpdateField("ctaText", value)}
            value={form.ctaText}
          />
          <TextAreaField
            label="FAQ"
            onChange={(value) => onUpdateField("faqText", value)}
            placeholder={"Question\nAnswer\n\nQuestion\nAnswer"}
            value={form.faqText}
          />
          <TextAreaField
            helper="Hidden from the normal public coach page. Used only on error/unavailable support pages."
            label="Contact support text"
            onChange={(value) => onUpdateField("supportText", value)}
            value={form.supportText}
          />
          <TextAreaField
            label="Trust note"
            onChange={(value) => onUpdateField("trustText", value)}
            value={form.trustText}
          />
          <TextField
            label="Register button text"
            onChange={(value) => onUpdateField("registerButtonText", value)}
            value={form.registerButtonText}
          />
        </div>
      </div>

      {previewSite ? (
        <CoachSitePreview
          onThemeChange={(selectedThemeId) => {
            onUpdateField("selectedThemeId", selectedThemeId);
            onPreviewSiteChange({
              ...previewSite,
              selectedThemeId
            });
          }}
          inspectMode={inspectMode}
          onSelectInspectScope={setSelectedInspectScope}
          selectedInspectScope={selectedInspectScope}
          site={previewSite}
        />
      ) : (
        <div className={styles.emptyState}>
          <h3>Preview not prepared yet</h3>
          <p>Complete Links & Contact Support, then use Generate Preview.</p>
        </div>
      )}
    </div>
  );
}

function CursorInspectIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="M5.5 3.8 18.8 10l-5.2 1.7 3.1 5.8-2.8 1.5-3-5.8-4 4.2L5.5 3.8Z"
        fill="currentColor"
      />
      <path
        d="M16.4 4.1 18 2.5M19.5 7.2h2.2M16.8 14.5l1.6 1.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
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

    setUploadMessage(
      mediaType === "image" ? `Optimizing ${file.name}...` : `Uploading ${file.name}...`
    );

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
      setUploadMessage(
        `${uploadFile.name} is preview-only because the upload API was not reachable.`
      );
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
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
  aiSubmitting,
  onClose,
  onGeneratePreview,
  onPublish,
  onSaveDraft,
  publishSubmitting,
  setWizardStep,
  wizardStep
}: {
  aiSubmitting: boolean;
  onClose: () => void;
  onGeneratePreview: () => Promise<boolean>;
  onPublish: () => Promise<CoachSiteRecord | null>;
  onSaveDraft: () => Promise<CoachSiteRecord | null>;
  publishSubmitting: boolean;
  setWizardStep: (step: number) => void;
  wizardStep: number;
}) {
  return (
    <>
      <button
        className={styles.secondaryAction}
        disabled={publishSubmitting}
        onClick={onClose}
        type="button"
      >
        Close
      </button>
      <button
        className={styles.secondaryAction}
        disabled={wizardStep === 0 || aiSubmitting || publishSubmitting}
        onClick={() => setWizardStep(Math.max(wizardStep - 1, 0))}
        type="button"
      >
        Back
      </button>
      <button
        className={styles.secondaryAction}
        disabled={aiSubmitting || publishSubmitting}
        onClick={() => {
          void onSaveDraft();
        }}
        type="button"
      >
        Save Draft
      </button>
      {wizardStep < wizardSteps.length - 1 ? (
        <button
          className={styles.primaryAction}
          disabled={aiSubmitting || publishSubmitting}
          onClick={() => {
            if (wizardStep === 3) {
              void onGeneratePreview();
              return;
            }

            setWizardStep(Math.min(wizardStep + 1, wizardSteps.length - 1));
          }}
          type="button"
        >
          {wizardStep === 3 ? "Generate Preview" : "Next"}
        </button>
      ) : (
        <button
          className={styles.primaryAction}
          disabled={aiSubmitting || publishSubmitting}
          onClick={() => {
            void onPublish();
            setWizardStep(5);
          }}
          type="button"
        >
          {publishSubmitting ? "Publishing..." : "Publish"}
        </button>
      )}
    </>
  );
}

function PublishPanel({
  onCopyLink,
  previewSite,
  publishProgress,
  publishedSite
}: {
  onCopyLink: (site: CoachSiteRecord) => void;
  previewSite: CoachSiteRecord | null;
  publishProgress: PublishProgressState;
  publishedSite: CoachSiteRecord | null;
}) {
  const site = previewSite || publishedSite;

  if (!site) {
    return (
      <div className={styles.emptyState}>
        <h3>No preview ready</h3>
        <p>Prepare a preview before publishing this coach site.</p>
      </div>
    );
  }

  if (publishProgress.phase === "publishing") {
    return (
      <div className={styles.publishPanel} data-phase="publishing">
        <span className={styles.statusBadge} data-status="draft">
          Publishing
        </span>
        <h3>Please wait. Site is being published.</h3>
        <p>
          We are saving the coach website, verifying the public page, and keeping the link stable.
        </p>
        <div
          aria-label="Publishing progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(publishProgress.progress)}
          className={styles.publishProgress}
          role="progressbar"
        >
          <span style={{ width: `${publishProgress.progress}%` }} />
        </div>
        <p>{publishProgress.message || "Publishing coach website..."}</p>
      </div>
    );
  }

  if (publishProgress.phase === "error") {
    return (
      <div className={styles.publishPanel} data-phase="error">
        <span className={styles.statusBadge} data-status="paused">
          Needs Attention
        </span>
        <h3>Publishing needs one more check</h3>
        <p>{publishProgress.message}</p>
        <p className={styles.linkWarning}>
          Copy Link is hidden until publishing and verification complete successfully.
        </p>
      </div>
    );
  }

  if (publishedSite && publishProgress.phase === "success") {
    return (
      <div className={styles.publishPanel} data-phase="success">
        <span className={styles.statusBadge} data-status="published">
          Successfully Published
        </span>
        <h3>{publishedSite.coachName}</h3>
        <p>{publishProgress.message}</p>
        <p>
          Stable public link stays the same after future edits unless the slug is intentionally
          changed.
        </p>
        <code>{publishedSite.publicUrl}</code>
        <button
          className={styles.primaryAction}
          onClick={() => onCopyLink(publishedSite)}
          type="button"
        >
          Copy Public Link
        </button>
      </div>
    );
  }

  return (
    <div className={styles.publishPanel}>
      <span className={styles.statusBadge} data-status={site.status}>
        {site.status}
      </span>
      <h3>{site.coachName}</h3>
      <p>
        Review the final details, then press Publish. Copy Link appears only after this site is
        published and verified.
      </p>
      <code>{site.publicUrl}</code>
      {!site.googleFormUrl ? (
        <p className={styles.linkWarning}>
          Google Form link missing. Public register buttons stay disabled until a registration link
          is added.
        </p>
      ) : null}
    </div>
  );
}

function ThemeChoiceField({
  onChange,
  selectedThemeId
}: {
  onChange: (value: CoachTemplateThemeId) => void;
  selectedThemeId: CoachTemplateThemeId;
}) {
  return (
    <div className={styles.themeChoicePanel}>
      <div>
        <p className={styles.kicker}>Choose Template Theme</p>
        <h3>{getCoachTemplateTheme(selectedThemeId).name}</h3>
        <p>Same coach content, different premium YW Nutritech visual skin.</p>
      </div>
      <div className={styles.themeChoiceGrid}>
        {coachTemplateThemes.map((theme) => (
          <button
            data-active={theme.id === selectedThemeId ? "true" : "false"}
            key={theme.id}
            onClick={() => onChange(theme.id)}
            type="button"
          >
            <span>{theme.previewLabel}</span>
            <strong>{theme.mood}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

const CoachSitePreview = memo(function CoachSitePreview({
  inspectMode = false,
  onThemeChange,
  onSelectInspectScope,
  selectedInspectScope,
  site
}: {
  inspectMode?: boolean;
  onThemeChange?: (value: CoachTemplateThemeId) => void;
  onSelectInspectScope?: (value: PreviewInspectSection) => void;
  selectedInspectScope?: PreviewInspectSection | null;
  site: CoachSiteRecord;
}) {
  const canRegister = Boolean(site.googleFormUrl);
  const previewImageUrl = site.heroMediaType === "image" ? site.photoUrl || site.logoUrl : "";
  const previewVideoUrl =
    site.heroMediaType === "video" ? normalizeVideoEmbedUrl(site.videoUrl) : "";
  const previewUploadedVideoUrl =
    site.heroMediaType === "video" && isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";
  const selectedTheme = getCoachTemplateTheme(site.selectedThemeId);

  function getInspectProps(scope: PreviewInspectSection) {
    const selected = selectedInspectScope === scope;

    if (!inspectMode) {
      return {
        "data-selected": selected ? "true" : "false"
      };
    }

    return {
      "aria-label": `Select ${getCopyScopeLabel(scope)} for regeneration`,
      "data-inspect-mode": "true",
      "data-selected": selected ? "true" : "false",
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectInspectScope?.(scope);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        onSelectInspectScope?.(scope);
      },
      role: "button",
      tabIndex: 0
    };
  }

  return (
    <article className={styles.coachPreview} data-theme={selectedTheme.id}>
      <div className={styles.previewThemeBar}>
        <div>
          <span>Template Theme</span>
          <strong>{selectedTheme.previewLabel}</strong>
        </div>
        {onThemeChange ? (
          <div>
            {coachTemplateThemes.map((theme) => (
              <button
                data-active={theme.id === selectedTheme.id ? "true" : "false"}
                key={theme.id}
                onClick={() => onThemeChange(theme.id)}
                type="button"
              >
                {theme.previewLabel}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div
        className={`${styles.previewHero} ${inspectMode ? styles.previewInspectable : ""}`}
        data-media={site.heroMediaType}
        {...getInspectProps("hero")}
      >
        {inspectMode ? (
          <span className={styles.inspectHotspot}>{getCopyScopeLabel("hero")}</span>
        ) : null}
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
              Google Form link missing. Public register buttons stay disabled until a registration
              link is added.
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
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
        <section
          className={inspectMode ? styles.previewInspectable : ""}
          {...getInspectProps("intro")}
        >
          {inspectMode ? (
            <span className={styles.inspectHotspot}>{getCopyScopeLabel("intro")}</span>
          ) : null}
          <h4>Coach introduction</h4>
          <p>{site.content.coachIntro}</p>
        </section>
        <section
          className={inspectMode ? styles.previewInspectable : ""}
          {...getInspectProps("vision")}
        >
          {inspectMode ? (
            <span className={styles.inspectHotspot}>{getCopyScopeLabel("vision")}</span>
          ) : null}
          <h4>Vision</h4>
          <p>{site.content.visionText}</p>
        </section>
        <section
          className={inspectMode ? styles.previewInspectable : ""}
          {...getInspectProps("benefits")}
        >
          {inspectMode ? (
            <span className={styles.inspectHotspot}>{getCopyScopeLabel("benefits")}</span>
          ) : null}
          <h4>What guests can expect</h4>
          <ul>
            {site.content.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </section>
        <section
          className={inspectMode ? styles.previewInspectable : ""}
          {...getInspectProps("faq")}
        >
          {inspectMode ? (
            <span className={styles.inspectHotspot}>{getCopyScopeLabel("faq")}</span>
          ) : null}
          <h4>FAQ</h4>
          {site.content.faq.map((item) => (
            <div key={item.question}>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
            </div>
          ))}
        </section>
      </div>

      <section
        className={`${styles.previewRegisterBand} ${inspectMode ? styles.previewInspectable : ""}`}
        {...getInspectProps("cta")}
      >
        {inspectMode ? (
          <span className={styles.inspectHotspot}>{getCopyScopeLabel("cta")}</span>
        ) : null}
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
            Registration link pending
          </button>
        )}
      </section>
    </article>
  );
});

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
