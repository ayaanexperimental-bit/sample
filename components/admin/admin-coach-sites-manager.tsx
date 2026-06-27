"use client";

import {
  memo,
  type ClipboardEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AdminActionDialog, AdminActionIcon } from "./admin-dashboard-layout";
import {
  PublicCoachSitePage,
  type CoachTemplatePreviewInspectSection,
  type CoachTemplatePreviewInspectTarget
} from "../coach/public-coach-site-page";
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
  getCoachTemplateTheme,
  type CoachTemplateThemeId
} from "../../lib/coach-template-themes";
import {
  isSupportedVideoSource,
  isUploadedVideoSource,
  normalizeVideoEmbedUrl
} from "../../lib/video-links";
import {
  prepareCoachHeroPhotoForUpload,
  preloadCoachHeroPhotoBackgroundRemoval
} from "../../lib/client/coach-photo-background-removal";
import {
  createSupportErrorReference,
  getPublicSupportErrorCode,
  logWebsiteError,
  type PublicWebsiteErrorCategory
} from "../../lib/error-reporting";
import styles from "./admin-dashboard-shell.module.css";

type AdminCoachSitesManagerProps = {
  csrfToken: string;
  initialSites?: CoachSiteRecord[];
  initialSource?: string;
  mode?: "create" | "list";
  onAdminActivity?: (activity: AdminActionActivityInput) => void;
  onSitesChange?: (sites: CoachSiteRecord[]) => void;
};

type AdminActionActivityInput = {
  detail: string;
  label: string;
  status: "error" | "success" | "working";
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
  duplicateCoachSite?: {
    id?: string;
    publicUrl?: string;
    slug?: string;
    status?: string;
  };
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

type CoachSiteActionProgressVariant = "delete" | "restore" | "standard";

type MediaUploadApiPayload = {
  configured?: boolean;
  error?: string;
  media?: {
    cutoutUrl?: string;
    fallbackMode?: "cutout" | "framed" | "original";
    mediaType?: "image" | "video";
    objectKey?: string;
    originalObjectKey?: string;
    originalUrl?: string;
    processingAttemptErrorCodes?: string[];
    processingErrorCode?: string;
    processingProvider?: "already-transparent" | "photoroom" | "removebg";
    processingStatus?: "cutout_ready" | "disabled" | "framed_fallback" | "not_configured";
    publicUrl?: string;
    qualityStatus?: "failed" | "passed" | "skipped";
    safeMessage?: string;
    sizeBytes?: number;
  };
  ok?: boolean;
};

type CoachImageMediaResult = NonNullable<MediaUploadApiPayload["media"]>;

type GeneratedCoachCopy = {
  benefitDescriptions?: string[];
  benefits?: string[];
  benefitsHeading?: string;
  brandBadge?: string;
  brandEyebrow?: string;
  coachIntro?: string;
  coachIntroLabel?: string;
  ctaText?: string;
  ctaSectionLabel?: string;
  faqHeading?: string;
  faqSectionLabel?: string;
  faq?: Array<{
    answer: string;
    question: string;
  }>;
  footerBrandLine?: string;
  footerHeadline?: string;
  footerText?: string;
  heroMediaLabel?: string;
  heroMicroTrustText?: string;
  heroHeadline?: string;
  heroTrustLine?: string;
  introHeading?: string;
  introSectionLabel?: string;
  journeyHeading?: string;
  journeySectionLabel?: string;
  journeySteps?: Array<{
    description: string;
    label: string;
    title: string;
  }>;
  mediaBody?: string;
  mediaHeading?: string;
  mediaModuleLabel?: string;
  mediaSubheading?: string;
  problemHeading?: string;
  problemSectionLabel?: string;
  problemPoints?: string[];
  benefitsSectionLabel?: string;
  socialCopy?: string;
  stickyCtaContactButton?: string;
  stickyCtaContext?: string;
  stickyCtaHeading?: string;
  stickyCtaLabel?: string;
  subheadline?: string;
  supportEmailLabel?: string;
  supportHeading?: string;
  supportPhoneLabel?: string;
  supportPrimaryButton?: string;
  supportPrivacyNote?: string;
  supportWhatsappButton?: string;
  supportWhatsappLabel?: string;
  trustText?: string;
  visionLabel?: string;
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

type CopyRegenerationScope =
  | "all"
  | "benefits"
  | "cta"
  | "faq"
  | "footer"
  | "hero"
  | "intro"
  | "journey"
  | "media"
  | "problem"
  | "vision";
type PreviewInspectSection = CoachTemplatePreviewInspectSection;
type PreviewInspectTarget = CoachTemplatePreviewInspectTarget;
type PreviewInspectSlotConfig = {
  aiRegenerationScope: CopyRegenerationScope;
  apply: (
    value: string,
    onUpdateField: <Key extends keyof CoachSiteFormState>(
      key: Key,
      fieldValue: CoachSiteFormState[Key]
    ) => void
  ) => void;
  fallbackRule: string;
  fieldType: "text" | "textarea";
  label: string;
  required: boolean;
  section: PreviewInspectSection;
  slotKey: string;
  validationRule: string;
  value: string;
};
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
    <span
      aria-label={`${coachName} avatar`}
      className={styles.coachAvatar}
      data-has-photo={showPhoto ? "true" : "false"}
      role="img"
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- Coach images can be R2/external URLs and need safe fallback behavior.
        <img
          alt={`${coachName} coach photo`}
          loading="lazy"
          onError={() => setFailedPhotoUrl(photoUrl)}
          src={photoUrl}
        />
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

function dedupeCoachSiteRecords(sites: CoachSiteRecord[]) {
  const selected: CoachSiteRecord[] = [];
  const sorted = [...sites].sort(compareCoachSitesForDeduping);

  for (const site of sorted) {
    if (site.status === "removed") continue;
    if (selected.some((current) => isDuplicateCoachSiteIdentity(site, current))) continue;

    selected.push(site);
  }

  return selected.sort((left, right) => getCoachSiteTimestamp(right) - getCoachSiteTimestamp(left));
}

function getDuplicateCoachSite(
  candidate: CoachSiteRecord,
  sites: CoachSiteRecord[],
  options: { allowSameId: boolean }
) {
  return (
    sites.find(
      (site) =>
        site.status !== "removed" &&
        (!options.allowSameId || site.id !== candidate.id) &&
        isDuplicateCoachSiteIdentity(site, candidate)
    ) || null
  );
}

function isDuplicateCoachSiteIdentity(left: CoachSiteRecord, right: CoachSiteRecord) {
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

  return getCoachSiteTimestamp(right) - getCoachSiteTimestamp(left);
}

function getCoachSiteStatusPriority(status: CoachSiteStatus) {
  if (status === "published" || status === "paused") return 0;
  if (status === "draft") return 1;
  if (status === "archived") return 2;
  return 3;
}

function getCoachSiteTimestamp(site: CoachSiteRecord) {
  const updatedAt = site.updatedAt ? Date.parse(site.updatedAt) : 0;
  const createdAt = site.createdAt ? Date.parse(site.createdAt) : 0;

  return Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : createdAt || 0;
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
  "problem",
  "journey",
  "benefits",
  "bonus",
  "media",
  "faq",
  "footer",
  "cta"
];

function getPreviewInspectSectionFromTarget(target: PreviewInspectTarget): PreviewInspectSection {
  const section = String(target).split(".")[0];
  if (previewInspectSections.includes(section as PreviewInspectSection)) {
    return section as PreviewInspectSection;
  }
  if (section === "coach" || section === "brand" || section === "stickyCta") return "hero";
  if (section === "support") return "footer";
  return "hero";
}

function getPreviewInspectSlotConfig(
  target: PreviewInspectTarget,
  form: CoachSiteFormState
): PreviewInspectSlotConfig {
  const slotKey = String(target);
  const section = getPreviewInspectSectionFromTarget(target);
  const scalar = getScalarPreviewInspectSlot(slotKey, form);
  if (scalar) return scalar;

  const benefitMatch = slotKey.match(
    /^(benefits|bonus)\.items\.(\d+)\.(displayTitle|title|description)$/
  );
  if (benefitMatch) {
    const sectionName = benefitMatch[1] === "bonus" ? "bonus" : "benefits";
    const index = Number(benefitMatch[2]);
    const isDescription = benefitMatch[3] === "description";
    if (sectionName === "bonus" && !isDescription) {
      return createSlotConfig({
        aiRegenerationScope: "benefits",
        apply: () => undefined,
        fallbackRule:
          "Universal service titles are locked by the canonical bonus registry. Edit only the supporting description copy.",
        fieldType: "textarea",
        label: `Bonus ${index + 1} Service Title`,
        required: false,
        section: sectionName,
        slotKey,
        validationRule:
          "Locked service title. The canonical section always uses Life-Long Health Calculators, Lifetime Support Sessions, and Lifestyle Success Toolkit.",
        value: ""
      });
    }
    const field = isDescription ? "benefitDescriptionsText" : "benefitsText";
    const lines = getEditableLines(form[field]);
    return createSlotConfig({
      aiRegenerationScope: "benefits",
      apply: (value, onUpdateField) =>
        onUpdateField(field, replaceEditableLine(form[field], index, value)),
      fieldType: "textarea",
      label: `${sectionName === "bonus" ? "Bonus" : "Benefit"} ${index + 1} ${isDescription ? "Description" : "Title"}`,
      section: sectionName,
      slotKey,
      validationRule:
        sectionName === "bonus"
          ? "Editable bonus description only. The canonical section keeps 3 fixed services; actual service titles, assets, availability, values, and CTA destination stay locked."
          : undefined,
      value: lines[index] || ""
    });
  }

  const problemMatch = slotKey.match(/^problem\.points\.(\d+)$/);
  if (problemMatch) {
    const index = Number(problemMatch[1]);
    const lines = getEditableLines(form.problemPointsText);
    return createSlotConfig({
      aiRegenerationScope: "problem",
      apply: (value, onUpdateField) =>
        onUpdateField(
          "problemPointsText",
          replaceEditableLine(form.problemPointsText, index, value)
        ),
      fieldType: "textarea",
      label: `Pain Point ${index + 1}`,
      section: "problem",
      slotKey,
      value: lines[index] || ""
    });
  }

  const journeyMatch = slotKey.match(/^journey\.steps\.(\d+)\.(label|title|description)$/);
  if (journeyMatch) {
    const index = Number(journeyMatch[1]);
    const part = journeyMatch[2] as "description" | "label" | "title";
    const step = getJourneyStepSlot(form.journeyStepsText, index);
    return createSlotConfig({
      aiRegenerationScope: "journey",
      apply: (value, onUpdateField) =>
        onUpdateField(
          "journeyStepsText",
          replaceJourneyStepSlot(form.journeyStepsText, index, part, value)
        ),
      fieldType: part === "description" ? "textarea" : "text",
      label: `Journey Step ${index + 1} ${part}`,
      section: "journey",
      slotKey,
      value: step[part] || ""
    });
  }

  const faqMatch = slotKey.match(/^faq\.items\.(\d+)\.(question|answer)$/);
  if (faqMatch) {
    const index = Number(faqMatch[1]);
    const part = faqMatch[2] as "answer" | "question";
    const item = getFaqSlot(form.faqText, index);
    return createSlotConfig({
      aiRegenerationScope: "faq",
      apply: (value, onUpdateField) =>
        onUpdateField("faqText", replaceFaqSlot(form.faqText, index, part, value)),
      fieldType: "textarea",
      label: `FAQ ${index + 1} ${part}`,
      section: "faq",
      slotKey,
      value: item[part] || ""
    });
  }

  return createSlotConfig({
    aiRegenerationScope: getCopyRegenerationScopeForInspectSection(section),
    apply: () => undefined,
    fallbackRule: "Static platform-controlled content is not changed from Inspect mode.",
    fieldType: "textarea",
    label: formatInspectSlotLabel(slotKey),
    required: false,
    section,
    slotKey,
    validationRule: "Locked platform-controlled slot.",
    value: ""
  });
}

function getCopyRegenerationScopeForInspectSection(
  section: PreviewInspectSection
): CopyRegenerationScope {
  return section === "bonus" ? "benefits" : section;
}

function getScalarPreviewInspectSlot(
  slotKey: string,
  form: CoachSiteFormState
): PreviewInspectSlotConfig | null {
  const scalarSlots: Record<
    string,
    {
      aiRegenerationScope: CopyRegenerationScope;
      field: keyof CoachSiteFormState;
      fieldType?: "text" | "textarea";
      label: string;
      required?: boolean;
      section: PreviewInspectSection;
    }
  > = {
    "brand.referralLabel": {
      aiRegenerationScope: "hero",
      field: "brandEyebrow",
      label: "Coach Referral Label",
      section: "hero"
    },
    "coach.location": {
      aiRegenerationScope: "hero",
      field: "location",
      label: "Coach Location",
      section: "hero"
    },
    "coach.name": {
      aiRegenerationScope: "hero",
      field: "coachName",
      label: "Coach Name",
      section: "hero"
    },
    "coach.niche": {
      aiRegenerationScope: "hero",
      field: "niche",
      label: "Niche Label",
      section: "hero"
    },
    "cta.heading": {
      aiRegenerationScope: "cta",
      field: "ctaText",
      fieldType: "textarea",
      label: "CTA Heading",
      section: "cta"
    },
    "cta.registerButtonText": {
      aiRegenerationScope: "cta",
      field: "registerButtonText",
      label: "Register Button Text",
      section: "cta"
    },
    "cta.sectionLabel": {
      aiRegenerationScope: "cta",
      field: "ctaSectionLabel",
      label: "CTA Section Label",
      section: "cta"
    },
    "cta.trustText": {
      aiRegenerationScope: "cta",
      field: "trustText",
      fieldType: "textarea",
      label: "CTA Support Text",
      section: "cta"
    },
    "benefits.heading": {
      aiRegenerationScope: "benefits",
      field: "benefitsHeading",
      fieldType: "textarea",
      label: "Benefits Heading",
      section: "benefits"
    },
    "benefits.sectionLabel": {
      aiRegenerationScope: "benefits",
      field: "benefitsSectionLabel",
      label: "Benefits Section Label",
      section: "benefits"
    },
    "bonus.ctaHelperText": {
      aiRegenerationScope: "benefits",
      field: "trustText",
      fieldType: "textarea",
      label: "Bonus CTA Helper Text",
      section: "bonus"
    },
    "bonus.eyebrow": {
      aiRegenerationScope: "benefits",
      field: "benefitsSectionLabel",
      label: "Bonus Eyebrow",
      section: "bonus"
    },
    "bonus.heading": {
      aiRegenerationScope: "benefits",
      field: "benefitsHeading",
      fieldType: "textarea",
      label: "Bonus Section Heading",
      section: "bonus"
    },
    "bonus.subheading": {
      aiRegenerationScope: "benefits",
      field: "benefitDescriptionsText",
      fieldType: "textarea",
      label: "Bonus Section Subheading",
      section: "bonus"
    },
    "faq.heading": {
      aiRegenerationScope: "faq",
      field: "faqHeading",
      fieldType: "textarea",
      label: "FAQ Heading",
      section: "faq"
    },
    "faq.sectionLabel": {
      aiRegenerationScope: "faq",
      field: "faqSectionLabel",
      label: "FAQ Section Label",
      section: "faq"
    },
    "footer.brandLine": {
      aiRegenerationScope: "footer",
      field: "footerBrandLine",
      label: "Footer Brand Line",
      section: "footer"
    },
    "footer.headline": {
      aiRegenerationScope: "footer",
      field: "footerHeadline",
      fieldType: "textarea",
      label: "Footer Headline",
      section: "footer"
    },
    "footer.text": {
      aiRegenerationScope: "footer",
      field: "footerText",
      fieldType: "textarea",
      label: "Footer Legal Copy",
      section: "footer"
    },
    "hero.brandBadge": {
      aiRegenerationScope: "hero",
      field: "brandBadge",
      label: "Hero Badge",
      section: "hero"
    },
    "hero.brandEyebrow": {
      aiRegenerationScope: "hero",
      field: "brandEyebrow",
      label: "Hero Support Line",
      section: "hero"
    },
    "hero.headline": {
      aiRegenerationScope: "hero",
      field: "heroHeadline",
      fieldType: "textarea",
      label: "Hero Headline",
      section: "hero"
    },
    "hero.mediaLabel": {
      aiRegenerationScope: "media",
      field: "heroMediaLabel",
      label: "Media Caption Label",
      section: "media"
    },
    "hero.subheadline": {
      aiRegenerationScope: "hero",
      field: "subheadline",
      fieldType: "textarea",
      label: "Hero Subheadline",
      section: "hero"
    },
    "hero.trustCopy": {
      aiRegenerationScope: "hero",
      field: "heroMicroTrustText",
      fieldType: "textarea",
      label: "Hero Trust Copy",
      section: "hero"
    },
    "hero.trustLabel": {
      aiRegenerationScope: "hero",
      field: "heroTrustLine",
      label: "Hero Trust Label",
      section: "hero"
    },
    "intro.body": {
      aiRegenerationScope: "intro",
      field: "coachIntro",
      fieldType: "textarea",
      label: "Coach Introduction",
      section: "intro"
    },
    "intro.cardLabel": {
      aiRegenerationScope: "intro",
      field: "coachIntroLabel",
      label: "Intro Card Label",
      section: "intro"
    },
    "intro.heading": {
      aiRegenerationScope: "intro",
      field: "introHeading",
      fieldType: "textarea",
      label: "Intro Heading",
      section: "intro"
    },
    "intro.sectionLabel": {
      aiRegenerationScope: "intro",
      field: "introSectionLabel",
      label: "Intro Section Label",
      section: "intro"
    },
    "journey.heading": {
      aiRegenerationScope: "journey",
      field: "journeyHeading",
      fieldType: "textarea",
      label: "Journey Heading",
      section: "journey"
    },
    "journey.sectionLabel": {
      aiRegenerationScope: "journey",
      field: "journeySectionLabel",
      label: "Journey Section Label",
      section: "journey"
    },
    "media.body": {
      aiRegenerationScope: "media",
      field: "mediaBody",
      fieldType: "textarea",
      label: "Media Body",
      section: "media"
    },
    "media.heading": {
      aiRegenerationScope: "media",
      field: "mediaHeading",
      fieldType: "textarea",
      label: "Media Heading",
      section: "media"
    },
    "media.moduleLabel": {
      aiRegenerationScope: "media",
      field: "mediaModuleLabel",
      label: "Media Module Label",
      section: "media"
    },
    "media.sectionLabel": {
      aiRegenerationScope: "media",
      field: "mediaSubheading",
      label: "Media Section Label",
      section: "media"
    },
    "problem.heading": {
      aiRegenerationScope: "problem",
      field: "problemHeading",
      fieldType: "textarea",
      label: "Problem Heading",
      section: "problem"
    },
    "problem.sectionLabel": {
      aiRegenerationScope: "problem",
      field: "problemSectionLabel",
      label: "Problem Section Label",
      section: "problem"
    },
    "problem.trustText": {
      aiRegenerationScope: "problem",
      field: "trustText",
      fieldType: "textarea",
      label: "Problem Support Text",
      section: "problem"
    },
    "stickyCta.contactButton": {
      aiRegenerationScope: "cta",
      field: "stickyCtaContactButton",
      label: "Sticky Contact Button Text",
      section: "cta"
    },
    "stickyCta.context": {
      aiRegenerationScope: "hero",
      field: "stickyCtaContext",
      label: "Sticky CTA Context",
      section: "hero"
    },
    "stickyCta.heading": {
      aiRegenerationScope: "cta",
      field: "stickyCtaHeading",
      fieldType: "textarea",
      label: "Sticky CTA Heading",
      section: "cta"
    },
    "stickyCta.label": {
      aiRegenerationScope: "cta",
      field: "stickyCtaLabel",
      label: "Sticky CTA Label",
      section: "cta"
    },
    "stickyCta.registerButton": {
      aiRegenerationScope: "cta",
      field: "registerButtonText",
      label: "Sticky Register Text",
      section: "cta"
    },
    "support.email": {
      aiRegenerationScope: "cta",
      field: "coachEmail",
      label: "Support Email",
      section: "cta"
    },
    "support.emailLabel": {
      aiRegenerationScope: "cta",
      field: "supportEmailLabel",
      label: "Support Email Label",
      section: "cta"
    },
    "support.heading": {
      aiRegenerationScope: "cta",
      field: "supportHeading",
      label: "Support Heading",
      section: "cta"
    },
    "support.name": {
      aiRegenerationScope: "intro",
      field: "coachName",
      label: "Support Name",
      section: "intro"
    },
    "support.phone": {
      aiRegenerationScope: "cta",
      field: "coachPhone",
      label: "Support Phone",
      section: "cta"
    },
    "support.phoneLabel": {
      aiRegenerationScope: "cta",
      field: "supportPhoneLabel",
      label: "Support Phone Label",
      section: "cta"
    },
    "support.primaryButton": {
      aiRegenerationScope: "cta",
      field: "supportPrimaryButton",
      label: "Support Button Label",
      section: "cta"
    },
    "support.privacyNote": {
      aiRegenerationScope: "footer",
      field: "supportPrivacyNote",
      fieldType: "textarea",
      label: "Support Privacy Note",
      section: "footer"
    },
    "support.text": {
      aiRegenerationScope: "cta",
      field: "supportText",
      fieldType: "textarea",
      label: "Support Text",
      section: "cta"
    },
    "support.whatsappButton": {
      aiRegenerationScope: "cta",
      field: "supportWhatsappButton",
      label: "WhatsApp Button Label",
      section: "cta"
    },
    "support.whatsappLabel": {
      aiRegenerationScope: "cta",
      field: "supportWhatsappLabel",
      label: "WhatsApp Helper Label",
      section: "cta"
    },
    "vision.body": {
      aiRegenerationScope: "vision",
      field: "visionText",
      fieldType: "textarea",
      label: "Mission Copy",
      section: "vision"
    },
    "vision.label": {
      aiRegenerationScope: "vision",
      field: "visionLabel",
      label: "Mission Label",
      section: "vision"
    }
  };
  const meta = scalarSlots[slotKey];
  if (!meta) return null;
  return createSlotConfig({
    aiRegenerationScope: meta.aiRegenerationScope,
    apply: (value, onUpdateField) => onUpdateField(meta.field, value as never),
    fieldType: meta.fieldType || "text",
    label: meta.label,
    required: meta.required !== false,
    section: meta.section,
    slotKey,
    value: String(form[meta.field] || "")
  });
}

function createSlotConfig(input: {
  aiRegenerationScope: CopyRegenerationScope;
  apply: PreviewInspectSlotConfig["apply"];
  fallbackRule?: string;
  fieldType: "text" | "textarea";
  label: string;
  required?: boolean;
  section: PreviewInspectSection;
  slotKey: string;
  validationRule?: string;
  value: string;
}): PreviewInspectSlotConfig {
  return {
    aiRegenerationScope: input.aiRegenerationScope,
    apply: input.apply,
    fallbackRule: input.fallbackRule || "Falls back to generated coach-template copy if empty.",
    fieldType: input.fieldType,
    label: input.label,
    required: input.required !== false,
    section: input.section,
    slotKey: input.slotKey,
    validationRule: input.validationRule || "Required content must not be empty.",
    value: input.value
  };
}

function getEditableLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function replaceEditableLine(value: string, index: number, nextValue: string) {
  const lines = getEditableLines(value);
  lines[index] = nextValue.trim();
  return lines.filter(Boolean).join("\n");
}

function getJourneyBlocks(value: string) {
  const blocks = value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.map((block) => {
    const [label = "", title = "", ...descriptionLines] = block.split(/\r?\n/);
    return {
      description: descriptionLines.join(" ").trim(),
      label: label.trim(),
      title: title.trim()
    };
  });
}

function getJourneyStepSlot(value: string, index: number) {
  return getJourneyBlocks(value)[index] || { description: "", label: "", title: "" };
}

function replaceJourneyStepSlot(
  value: string,
  index: number,
  part: "description" | "label" | "title",
  nextValue: string
) {
  const blocks = getJourneyBlocks(value);
  blocks[index] = {
    ...(blocks[index] || { description: "", label: "", title: "" }),
    [part]: nextValue.trim()
  };
  return blocks
    .map((step) => [step.label, step.title, step.description].filter(Boolean).join("\n"))
    .join("\n\n");
}

function getFaqBlocks(value: string) {
  return value.split(/\n\s*\n/).map((block) => {
    const [question = "", ...answerLines] = block.trim().split(/\r?\n/);
    return {
      answer: answerLines.join(" ").trim(),
      question: question.trim()
    };
  });
}

function getFaqSlot(value: string, index: number) {
  return getFaqBlocks(value)[index] || { answer: "", question: "" };
}

function replaceFaqSlot(
  value: string,
  index: number,
  part: "answer" | "question",
  nextValue: string
) {
  const blocks = getFaqBlocks(value);
  blocks[index] = {
    ...(blocks[index] || { answer: "", question: "" }),
    [part]: nextValue.trim()
  };
  return blocks
    .filter((item) => item.question || item.answer)
    .map((item) => `${item.question}\n${item.answer}`.trim())
    .join("\n\n");
}

function formatInspectSlotLabel(slotKey: string) {
  return slotKey
    .split(".")
    .filter((part) => !/^\d+$/.test(part))
    .slice(-2)
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const removalReasons = [
  "inactive coach",
  "duplicate site",
  "wrong details",
  "coach left program",
  "other"
];

const PHOTO_UPLOAD_ACCEPT =
  ".jpg,.jpeg,.jpe,.jfif,.png,.webp,.avif,.gif,.heic,.heif,.bmp,.tif,.tiff,image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif,image/bmp,image/tiff";
const VIDEO_UPLOAD_ACCEPT =
  ".mp4,.m4v,.mov,.webm,.ogv,.ogg,.3gp,.3g2,.mpeg,.mpg,.avi,.wmv,.mkv,video/mp4,application/mp4,video/x-m4v,video/quicktime,video/webm,video/ogg,application/ogg,video/3gpp,video/3gpp2,video/mpeg,video/x-msvideo,video/msvideo,video/x-ms-wmv,video/x-matroska";
const PHOTO_ORIGINAL_MAX_BYTES = 12 * 1024 * 1024;
const VIDEO_MAX_BYTES = 70 * 1024 * 1024;
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
const ALLOWED_VIDEO_EXTENSIONS = new Set([
  ".3g2",
  ".3gp",
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogg",
  ".ogv",
  ".webm",
  ".wmv"
]);
const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "application/mp4",
  "application/ogg",
  "video/3gpp",
  "video/3gpp2",
  "video/mp4",
  "video/mpeg",
  "video/msvideo",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "video/x-ms-wmv",
  "video/x-msvideo"
]);
function applyGeneratedCopyToForm(
  current: CoachSiteFormState,
  content: GeneratedCoachCopy,
  scope: CopyRegenerationScope
): CoachSiteFormState {
  const faqText =
    content.faq?.map((item) => `${item.question}\n${item.answer}`).join("\n\n") || current.faqText;
  const benefitsText = content.benefits?.join("\n") || current.benefitsText;
  const benefitDescriptionsText =
    content.benefitDescriptions?.join("\n") || current.benefitDescriptionsText;
  const journeyStepsText =
    content.journeySteps
      ?.map((step) => `${step.label}\n${step.title}\n${step.description}`)
      .join("\n\n") || current.journeyStepsText;
  const problemPointsText = content.problemPoints?.join("\n") || current.problemPointsText;

  if (scope === "hero") {
    return {
      ...current,
      brandBadge: content.brandBadge || current.brandBadge,
      brandEyebrow: content.brandEyebrow || current.brandEyebrow,
      heroHeadline: content.heroHeadline || current.heroHeadline,
      heroMediaLabel: content.heroMediaLabel || current.heroMediaLabel,
      heroMicroTrustText: content.heroMicroTrustText || current.heroMicroTrustText,
      heroTrustLine: content.heroTrustLine || current.heroTrustLine,
      subheadline: content.subheadline || current.subheadline
    };
  }

  if (scope === "benefits") {
    return {
      ...current,
      benefitDescriptionsText,
      benefitsSectionLabel: content.benefitsSectionLabel || current.benefitsSectionLabel,
      benefitsHeading: content.benefitsHeading || current.benefitsHeading,
      benefitsText
    };
  }

  if (scope === "faq") {
    return {
      ...current,
      faqHeading: content.faqHeading || current.faqHeading,
      faqSectionLabel: content.faqSectionLabel || current.faqSectionLabel,
      faqText
    };
  }

  if (scope === "intro") {
    return {
      ...current,
      coachIntroLabel: content.coachIntroLabel || current.coachIntroLabel,
      coachIntro: content.coachIntro || current.coachIntro,
      introHeading: content.introHeading || current.introHeading,
      introSectionLabel: content.introSectionLabel || current.introSectionLabel
    };
  }

  if (scope === "vision") {
    return {
      ...current,
      visionLabel: content.visionLabel || current.visionLabel,
      visionText: content.visionText || current.visionText
    };
  }

  if (scope === "cta") {
    return {
      ...current,
      ctaSectionLabel: content.ctaSectionLabel || current.ctaSectionLabel,
      ctaText: content.ctaText || current.ctaText,
      socialCopy: content.socialCopy || current.socialCopy,
      stickyCtaContactButton: content.stickyCtaContactButton || current.stickyCtaContactButton,
      stickyCtaContext: content.stickyCtaContext || current.stickyCtaContext,
      stickyCtaHeading: content.stickyCtaHeading || current.stickyCtaHeading,
      stickyCtaLabel: content.stickyCtaLabel || current.stickyCtaLabel,
      supportEmailLabel: content.supportEmailLabel || current.supportEmailLabel,
      supportHeading: content.supportHeading || current.supportHeading,
      supportPhoneLabel: content.supportPhoneLabel || current.supportPhoneLabel,
      supportPrimaryButton: content.supportPrimaryButton || current.supportPrimaryButton,
      supportWhatsappButton: content.supportWhatsappButton || current.supportWhatsappButton,
      supportWhatsappLabel: content.supportWhatsappLabel || current.supportWhatsappLabel,
      trustText: content.trustText || current.trustText
    };
  }

  if (scope === "problem") {
    return {
      ...current,
      problemHeading: content.problemHeading || current.problemHeading,
      problemSectionLabel: content.problemSectionLabel || current.problemSectionLabel,
      problemPointsText,
      trustText: content.trustText || current.trustText
    };
  }

  if (scope === "journey") {
    return {
      ...current,
      journeyHeading: content.journeyHeading || current.journeyHeading,
      journeySectionLabel: content.journeySectionLabel || current.journeySectionLabel,
      journeyStepsText
    };
  }

  if (scope === "media") {
    return {
      ...current,
      mediaBody: content.mediaBody || current.mediaBody,
      mediaHeading: content.mediaHeading || current.mediaHeading,
      mediaModuleLabel: content.mediaModuleLabel || current.mediaModuleLabel,
      mediaSubheading: content.mediaSubheading || current.mediaSubheading
    };
  }

  if (scope === "footer") {
    return {
      ...current,
      footerBrandLine: content.footerBrandLine || current.footerBrandLine,
      footerHeadline: content.footerHeadline || current.footerHeadline,
      footerText: content.footerText || current.footerText,
      supportPrivacyNote: content.supportPrivacyNote || current.supportPrivacyNote
    };
  }

  return {
    ...current,
    benefitDescriptionsText,
    benefitsHeading: content.benefitsHeading || current.benefitsHeading,
    benefitsText,
    brandBadge: content.brandBadge || current.brandBadge,
    brandEyebrow: content.brandEyebrow || current.brandEyebrow,
    coachIntroLabel: content.coachIntroLabel || current.coachIntroLabel,
    coachIntro: content.coachIntro || current.coachIntro,
    ctaSectionLabel: content.ctaSectionLabel || current.ctaSectionLabel,
    ctaText: content.ctaText || current.ctaText,
    faqHeading: content.faqHeading || current.faqHeading,
    faqSectionLabel: content.faqSectionLabel || current.faqSectionLabel,
    faqText,
    footerBrandLine: content.footerBrandLine || current.footerBrandLine,
    footerHeadline: content.footerHeadline || current.footerHeadline,
    footerText: content.footerText || current.footerText,
    heroHeadline: content.heroHeadline || current.heroHeadline,
    heroMediaLabel: content.heroMediaLabel || current.heroMediaLabel,
    heroMicroTrustText: content.heroMicroTrustText || current.heroMicroTrustText,
    heroTrustLine: content.heroTrustLine || current.heroTrustLine,
    introHeading: content.introHeading || current.introHeading,
    introSectionLabel: content.introSectionLabel || current.introSectionLabel,
    journeyHeading: content.journeyHeading || current.journeyHeading,
    journeySectionLabel: content.journeySectionLabel || current.journeySectionLabel,
    journeyStepsText,
    mediaBody: content.mediaBody || current.mediaBody,
    mediaHeading: content.mediaHeading || current.mediaHeading,
    mediaModuleLabel: content.mediaModuleLabel || current.mediaModuleLabel,
    mediaSubheading: content.mediaSubheading || current.mediaSubheading,
    problemHeading: content.problemHeading || current.problemHeading,
    problemSectionLabel: content.problemSectionLabel || current.problemSectionLabel,
    problemPointsText,
    registerButtonText: current.registerButtonText || content.ctaText || "Register Now",
    benefitsSectionLabel: content.benefitsSectionLabel || current.benefitsSectionLabel,
    socialCopy: content.socialCopy || current.socialCopy,
    stickyCtaContactButton: content.stickyCtaContactButton || current.stickyCtaContactButton,
    stickyCtaContext: content.stickyCtaContext || current.stickyCtaContext,
    stickyCtaHeading: content.stickyCtaHeading || current.stickyCtaHeading,
    stickyCtaLabel: content.stickyCtaLabel || current.stickyCtaLabel,
    subheadline: content.subheadline || current.subheadline,
    supportEmailLabel: content.supportEmailLabel || current.supportEmailLabel,
    supportHeading: content.supportHeading || current.supportHeading,
    supportPhoneLabel: content.supportPhoneLabel || current.supportPhoneLabel,
    supportPrimaryButton: content.supportPrimaryButton || current.supportPrimaryButton,
    supportPrivacyNote: content.supportPrivacyNote || current.supportPrivacyNote,
    supportWhatsappButton: content.supportWhatsappButton || current.supportWhatsappButton,
    supportWhatsappLabel: content.supportWhatsappLabel || current.supportWhatsappLabel,
    trustText: content.trustText || current.trustText,
    visionLabel: content.visionLabel || current.visionLabel,
    visionText: content.visionText || current.visionText
  };
}

function getCopyScopeLabel(scope: CopyRegenerationScope) {
  if (scope === "benefits") return "Benefits";
  if (scope === "cta") return "CTA section";
  if (scope === "faq") return "FAQ";
  if (scope === "footer") return "Footer";
  if (scope === "hero") return "Hero copy";
  if (scope === "intro") return "Coach introduction";
  if (scope === "journey") return "Journey";
  if (scope === "media") return "Media";
  if (scope === "problem") return "Problem";
  if (scope === "vision") return "Mission / vision";
  return "All copy";
}

export function AdminCoachSitesManager({
  csrfToken,
  initialSites,
  initialSource,
  mode = "list",
  onAdminActivity,
  onSitesChange
}: AdminCoachSitesManagerProps) {
  const externalSites = useMemo(() => dedupeCoachSiteRecords(initialSites || []), [initialSites]);
  const [localSites, setLocalSites] = useState<CoachSiteRecord[] | null>(null);
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
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [previewPersistenceRevision, setPreviewPersistenceRevision] = useState(0);
  const [publishProgress, setPublishProgress] = useState<PublishProgressState>({
    message: "",
    phase: "idle",
    progress: 0
  });
  const [mediaProcessingMessage, setMediaProcessingMessage] = useState("");
  const [paidFunnelAnalysis, setPaidFunnelAnalysis] = useState<PaidFunnelAnalysis | null>(null);
  const [paidFunnelAnalysisBusy, setPaidFunnelAnalysisBusy] = useState(false);
  const [paidFunnelAnalysisMessage, setPaidFunnelAnalysisMessage] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removeMessage, setRemoveMessage] = useState("");
  const [removeOtp, setRemoveOtp] = useState("");
  const [removeOtpSending, setRemoveOtpSending] = useState(false);
  const [removeReason, setRemoveReason] = useState(removalReasons[0]);
  const [removeSubmitting, setRemoveSubmitting] = useState<CoachSiteDangerStatus | null>(null);
  const [removeActionStep, setRemoveActionStep] = useState("");
  const [deletingDraftId, setDeletingDraftId] = useState("");
  const [deleteDraftStep, setDeleteDraftStep] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState<"" | "paused" | "published">("");
  const [statusActionStep, setStatusActionStep] = useState("");
  const [reactivatingSiteId, setReactivatingSiteId] = useState("");
  const [reactivateStep, setReactivateStep] = useState("");
  const [highlightedSiteId, setHighlightedSiteId] = useState("");
  const [storageErrorCode, setStorageErrorCode] = useState("");
  const [storageMessage, setStorageMessage] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const sites = localSites || externalSites;
  const sourceStorageMessage =
    initialSource === "loading"
      ? "Loading coach-site records..."
      : initialSource === "live-database"
        ? "Coach-site database connected."
        : initialSource === "not-configured"
          ? "Coach-site database is not configured. No production records are shown."
          : initialSource
            ? "Coach-site records are unavailable right now."
            : "";
  const displayStorageMessage = storageMessage || sourceStorageMessage;
  const displayStorageReady = storageMessage
    ? storageReady
    : initialSource
      ? initialSource === "live-database"
      : storageReady;
  const publishProgressTimerRef = useRef<number | null>(null);
  const previewSyncTimeoutRef = useRef<number | null>(null);
  const previewSyncFormRef = useRef<CoachSiteFormState | null>(null);
  const draftSubmittingRef = useRef(false);
  const siteHighlightTimerRef = useRef<number | null>(null);

  function recordActivity(activity: AdminActionActivityInput) {
    onAdminActivity?.(activity);
  }

  const commitSites = useCallback(
    (nextSites: CoachSiteRecord[]) => {
      const dedupedSites = dedupeCoachSiteRecords(nextSites);
      setLocalSites(dedupedSites);
      onSitesChange?.(dedupedSites);

      return dedupedSites;
    },
    [onSitesChange]
  );

  const updateCommittedSites = useCallback(
    (updater: (current: CoachSiteRecord[]) => CoachSiteRecord[]) => {
      setLocalSites((current) => {
        const dedupedSites = dedupeCoachSiteRecords(updater(current || externalSites));
        onSitesChange?.(dedupedSites);

        return dedupedSites;
      });
    },
    [externalSites, onSitesChange]
  );

  useEffect(() => {
    if (mode === "create") {
      openCreatorDialog();
    }
    // The create page should open the wizard only when the route mode changes.
    // Adding openCreatorDialog would re-open/reset the wizard after every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (initialSource) return;

    let cancelled = false;

    async function loadPersistedCoachSites() {
      try {
        const response = await fetch("/api/admin/coach-sites", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as CoachSitesApiPayload;

        if (cancelled || !response.ok || !payload.ok || !payload.coachSites) return;

        commitSites(payload.coachSites);
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
  }, [commitSites, initialSource]);

  useEffect(() => {
    return () => {
      clearPublishProgressTimer();

      if (previewSyncTimeoutRef.current !== null) {
        window.clearTimeout(previewSyncTimeoutRef.current);
      }

      if (siteHighlightTimerRef.current !== null) {
        window.clearTimeout(siteHighlightTimerRef.current);
      }
    };
  }, []);

  function highlightCoachSite(siteId: string) {
    if (!siteId) return;

    if (siteHighlightTimerRef.current !== null) {
      window.clearTimeout(siteHighlightTimerRef.current);
    }

    setHighlightedSiteId(siteId);
    siteHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedSiteId("");
      siteHighlightTimerRef.current = null;
    }, 2200);
  }

  function waitForCoachSiteActionFeedback(ms = 650) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

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

  function clearPendingPreviewSync() {
    previewSyncFormRef.current = null;

    if (previewSyncTimeoutRef.current !== null) {
      window.clearTimeout(previewSyncTimeoutRef.current);
      previewSyncTimeoutRef.current = null;
    }
  }

  function applyFormAndPreviewSite(sourceForm: CoachSiteFormState, status: CoachSiteStatus) {
    clearPendingPreviewSync();

    const site = buildPreviewSite(status, sourceForm);
    const syncedForm = {
      ...sourceForm,
      slug: site.slug
    };

    previewSyncFormRef.current = syncedForm;
    setForm(syncedForm);
    setPreviewSite(site);

    return site;
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

    if (
      sourceForm.googleFormUrl.trim() &&
      !isSingleRegistrationContactUrl(sourceForm.googleFormUrl)
    ) {
      setMessage("Use one valid HTTPS registration/contact link.");
      return null;
    }

    if (sourceForm.coachEmail.trim() && !isSingleEmailAddress(sourceForm.coachEmail)) {
      setMessage("Use one valid support email.");
      return null;
    }

    if (sourceForm.coachPhone.trim() && !isValidIndianPhoneNumber(sourceForm.coachPhone)) {
      setMessage("Use one valid 10-digit Indian support phone/WhatsApp number.");
      return null;
    }

    if (status === "published") {
      if (!sourceForm.googleFormUrl.trim()) {
      setMessage("Registration/contact link is required before publishing.");
        setStorageMessage("Save as draft until the coach-specific registration/contact link is added.");
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
      coachPhone: sourceForm.coachPhone.trim()
        ? normalizeIndianPhoneDigits(sourceForm.coachPhone)
        : "",
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
      benefitDescriptionsText:
        sourceForm.benefitDescriptionsText || fallbackSite.content.benefitDescriptions.join("\n"),
      benefitsSectionLabel:
        sourceForm.benefitsSectionLabel || fallbackSite.content.benefitsSectionLabel,
      benefitsHeading: sourceForm.benefitsHeading || fallbackSite.content.benefitsHeading,
      benefitsText: sourceForm.benefitsText || fallbackSite.content.benefits.join("\n"),
      brandBadge: sourceForm.brandBadge || fallbackSite.content.brandBadge,
      brandEyebrow: sourceForm.brandEyebrow || fallbackSite.content.brandEyebrow,
      coachIntroLabel: sourceForm.coachIntroLabel || fallbackSite.content.coachIntroLabel,
      coachIntro: sourceForm.coachIntro || fallbackSite.content.coachIntro,
      ctaSectionLabel: sourceForm.ctaSectionLabel || fallbackSite.content.ctaSectionLabel,
      ctaText: sourceForm.ctaText || fallbackSite.content.ctaText,
      faqHeading: sourceForm.faqHeading || fallbackSite.content.faqHeading,
      faqSectionLabel: sourceForm.faqSectionLabel || fallbackSite.content.faqSectionLabel,
      faqText:
        sourceForm.faqText ||
        fallbackSite.content.faq.map((item) => `${item.question}\n${item.answer}`).join("\n\n"),
      footerBrandLine: sourceForm.footerBrandLine || fallbackSite.content.footerBrandLine,
      footerHeadline: sourceForm.footerHeadline || fallbackSite.content.footerHeadline,
      footerText: sourceForm.footerText || fallbackSite.content.footerText,
      heroHeadline: sourceForm.heroHeadline || fallbackSite.content.heroHeadline,
      heroMediaLabel: sourceForm.heroMediaLabel || fallbackSite.content.heroMediaLabel,
      heroMicroTrustText: sourceForm.heroMicroTrustText || fallbackSite.content.heroMicroTrustText,
      heroTrustLine: sourceForm.heroTrustLine || fallbackSite.content.heroTrustLine,
      introHeading: sourceForm.introHeading || fallbackSite.content.introHeading,
      introSectionLabel: sourceForm.introSectionLabel || fallbackSite.content.introSectionLabel,
      journeyHeading: sourceForm.journeyHeading || fallbackSite.content.journeyHeading,
      journeySectionLabel:
        sourceForm.journeySectionLabel || fallbackSite.content.journeySectionLabel,
      journeyStepsText:
        sourceForm.journeyStepsText ||
        fallbackSite.content.journeySteps
          .map((step) => `${step.label}\n${step.title}\n${step.description}`)
          .join("\n\n"),
      mediaBody: sourceForm.mediaBody || fallbackSite.content.mediaBody,
      mediaHeading: sourceForm.mediaHeading || fallbackSite.content.mediaHeading,
      mediaModuleLabel: sourceForm.mediaModuleLabel || fallbackSite.content.mediaModuleLabel,
      mediaSubheading: sourceForm.mediaSubheading || fallbackSite.content.mediaSubheading,
      problemHeading: sourceForm.problemHeading || fallbackSite.content.problemHeading,
      problemSectionLabel:
        sourceForm.problemSectionLabel || fallbackSite.content.problemSectionLabel,
      problemPointsText:
        sourceForm.problemPointsText || fallbackSite.content.problemPoints.join("\n"),
      socialCopy: sourceForm.socialCopy || fallbackSite.content.socialCopy,
      stickyCtaContactButton:
        sourceForm.stickyCtaContactButton ||
        fallbackSite.content.stickyCtaContactButton ||
        "Register Now",
      stickyCtaContext:
        sourceForm.stickyCtaContext ||
        fallbackSite.content.stickyCtaContext ||
        `${fallbackSite.niche || "Coach referral"} through YW Nutritech`,
      stickyCtaHeading:
        sourceForm.stickyCtaHeading ||
        fallbackSite.content.stickyCtaHeading ||
        `Ready to connect with Coach ${fallbackSite.coachName}?`,
      stickyCtaLabel:
        sourceForm.stickyCtaLabel || fallbackSite.content.stickyCtaLabel || "Registration",
      subheadline: sourceForm.subheadline || fallbackSite.content.subheadline,
      supportEmailLabel:
        sourceForm.supportEmailLabel || fallbackSite.content.supportEmailLabel || "Email",
      supportHeading:
        sourceForm.supportHeading || fallbackSite.content.supportHeading || "Contact Support",
      supportPhoneLabel:
        sourceForm.supportPhoneLabel || fallbackSite.content.supportPhoneLabel || "Phone",
      supportPrimaryButton:
        sourceForm.supportPrimaryButton ||
        fallbackSite.content.supportPrimaryButton ||
        "Contact Support",
      supportPrivacyNote:
        sourceForm.supportPrivacyNote ||
        fallbackSite.content.supportPrivacyNote ||
        "Contact details shown here are public coach-site support details, not admin-only data.",
      supportWhatsappButton:
        sourceForm.supportWhatsappButton ||
        fallbackSite.content.supportWhatsappButton ||
        "Message coach",
      supportWhatsappLabel:
        sourceForm.supportWhatsappLabel || fallbackSite.content.supportWhatsappLabel || "WhatsApp",
      trustText: sourceForm.trustText || fallbackSite.content.trustText,
      visionLabel: sourceForm.visionLabel || fallbackSite.content.visionLabel,
      visionText: sourceForm.visionText || fallbackSite.content.visionText
    };
  }

  async function upsertSite(status: CoachSiteStatus) {
    const validatedForm = validatePreviewForm(form, status);
    if (!validatedForm) return null;

    if (status === "draft" && draftSubmittingRef.current) return null;

    const site = { ...buildPreviewSite(status, validatedForm), status };
    const duplicateSite = getDuplicateCoachSite(site, sites, { allowSameId: Boolean(editingId) });
    if (duplicateSite) {
      setPreviewSite(duplicateSite);
      setMessage(
        `Duplicate blocked. ${duplicateSite.coachName || "This coach"} already exists as ${duplicateSite.status}. Use Manage/Edit instead of creating another entry.`
      );
      resetPublishProgress();
      return null;
    }

    const existingIndex = sites.findIndex((item) => item.id === site.id || item.slug === site.slug);
    const previousSites = sites;
    const nextSites =
      existingIndex >= 0
        ? sites.map((item, index) => (index === existingIndex ? site : item))
        : [site, ...sites];

    setForm(validatedForm);
    commitSites(nextSites);
    setPreviewSite(site);
    setEditingId(site.id);
    setPublishedSite(null);
    if (status === "published") {
      startPublishProgress("Please wait. Site is being published...");
    } else {
      draftSubmittingRef.current = true;
      setDraftSubmitting(true);
      resetPublishProgress();
    }
    setMessage(status === "published" ? "Publishing site..." : "Saving draft...");
    recordActivity({
      detail:
        status === "published"
          ? `${site.coachName} publish started.`
          : `${site.coachName} draft save started.`,
      label: "Coach Sites",
      status: "working"
    });

    try {
      if (status === "published") {
        updatePublishProgress("Saving coach website content...", 38);
      }

      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({ mode: editingId ? "edit" : "create", site }),
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
        commitSites(previousSites);
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
          response.status === 409 && payload.error
            ? payload.error
            : status === "published"
              ? "Site was not published. Fix the database/API issue and try again."
              : "Draft was not saved. Reusable drafts require the coach-site database."
        );
        if (status === "published") {
          finishPublishProgressError(
            "Publishing stopped because the coach-site database did not save this website."
          );
        }
        recordActivity({
          detail:
            status === "published"
              ? `${site.coachName} publish could not complete.`
              : `${site.coachName} draft could not be saved.`,
          label: "Coach Sites",
          status: "error"
        });
        return site;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setStorageMessage("Saved in coach-site database.");
      const savedSite = payload.coachSite;
      updateCommittedSites((current) =>
        current.some((item) => item.id === site.id || item.slug === site.slug)
          ? current.map((item) =>
              item.id === site.id || item.slug === site.slug ? savedSite! : item
            )
          : [savedSite!, ...current]
      );
      setPreviewSite(savedSite);
      setEditingId(savedSite.id);
      highlightCoachSite(savedSite.id);

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
          recordActivity({
            detail: `${savedSite.coachName} saved, but public verification failed.`,
            label: "Coach Sites",
            status: "error"
          });
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
      setPreviewPersistenceRevision((revision) => revision + 1);
      recordActivity({
        detail:
          status === "published"
            ? `${savedSite.coachName} published and verified.`
            : `${savedSite.coachName} draft saved successfully.`,
        label: "Coach Sites",
        status: "success"
      });
      return savedSite;
    } catch {
      commitSites(previousSites);
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
      recordActivity({
        detail:
          status === "published"
            ? `${site.coachName} publish failed safely.`
            : `${site.coachName} draft save failed safely.`,
        label: "Coach Sites",
        status: "error"
      });
    } finally {
      if (status === "draft") {
        draftSubmittingRef.current = false;
        setDraftSubmitting(false);
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
      benefitsHeading:
        sourceForm.benefitsHeading ||
        `Practical ${analysis.niche || sourceForm.niche || "wellness"} support without clutter.`,
      benefitsText: sourceForm.benefitsText || keyPointsText,
      coachName: sourceForm.coachName || analysis.coachName || "",
      existingPaidFunnelUrl: analysis.sourceUrl,
      faqText: sourceForm.faqText || faqText,
      heroHeadline: sourceForm.heroHeadline || analysis.headings[0] || analysis.title || "",
      introHeading:
        sourceForm.introHeading ||
        `Personal ${analysis.niche || sourceForm.niche || "wellness"} guidance with a calm, practical first step.`,
      niche: sourceForm.niche || analysis.niche || "",
      paidFunnelContext: context,
      problemHeading:
        sourceForm.problemHeading ||
        `For guests who need direction before committing to a bigger ${analysis.niche || sourceForm.niche || "wellness"} program.`,
      problemPointsText: sourceForm.problemPointsText || keyPointsText,
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
    applyFormAndPreviewSite(validatedForm, status);

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

      applyFormAndPreviewSite(nextForm, status);
      setMessage("Preview prepared. Review generated copy before publishing.");
      return true;
    } catch {
      nextForm = fillMissingCopyFromTemplateFallback(nextForm, status);
      const site = applyFormAndPreviewSite(nextForm, status);
      reportAiCopyIssue({
        coachSlug: site.slug,
        safeMessage: "AI copy generation failed.",
        userAction: "Generate coach website preview copy"
      });
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
      applyFormAndPreviewSite(nextForm, previewSite?.status || "draft");
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
    if (statusSubmitting) return;

    setStatusSubmitting(status);
    setStatusActionStep(
      status === "paused" ? "Preparing pause request" : "Preparing resume request"
    );
    setMessage(status === "paused" ? "Pausing coach site..." : "Resuming coach site...");
    recordActivity({
      detail:
        status === "paused"
          ? `${site.coachName} pause started.`
          : `${site.coachName} resume started.`,
      label: "Coach Sites",
      status: "working"
    });

    setStatusActionStep("Saving status in coach-site database");
    const updatedSite = await persistSiteStatus(site, status);
    if (!updatedSite) {
      setStatusActionStep("Status update failed safely");
      setStatusSubmitting("");
      setMessage(
        status === "paused"
          ? "Coach site was not paused. Fix the database/API issue and try again."
          : "Coach site was not resumed. Fix the database/API issue and try again."
      );
      recordActivity({
        detail:
          status === "paused"
            ? `${site.coachName} could not be paused.`
            : `${site.coachName} could not be resumed.`,
        label: "Coach Sites",
        status: "error"
      });
      return;
    }

    setPreviewSite((current) => (current?.id === site.id ? updatedSite : current));
    highlightCoachSite(updatedSite.id);
    setStatusActionStep(status === "paused" ? "Paused successfully" : "Resumed successfully");
    setMessage(
      status === "paused"
        ? `${updatedSite.coachName} paused. Public link remains ${updatedSite.publicUrl}.`
        : `${updatedSite.coachName} resumed with the same public link: ${updatedSite.publicUrl}.`
    );
    recordActivity({
      detail:
        status === "paused"
          ? `${updatedSite.coachName} paused successfully.`
          : `${updatedSite.coachName} resumed successfully.`,
      label: "Coach Sites",
      status: "success"
    });
    await waitForCoachSiteActionFeedback();
    setStatusSubmitting("");
    setStatusActionStep("");
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
    recordActivity({
      detail: `${site.coachName} draft publish started.`,
      label: "Coach Sites",
      status: "working"
    });

    const publishedDraft = await persistSiteStatus(site, "published");
    if (!publishedDraft) {
      setMessage("Draft was not published. Fix the database/API issue and try again.");
      recordActivity({
        detail: `${site.coachName} draft publish failed.`,
        label: "Coach Sites",
        status: "error"
      });
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
      recordActivity({
        detail: `${publishedDraft.coachName} draft saved as published but verification failed.`,
        label: "Coach Sites",
        status: "error"
      });
      return;
    }

    setPreviewSite((current) => (current?.id === site.id ? publishedDraft : current));
    setPublishedSite(publishedDraft);
    highlightCoachSite(publishedDraft.id);
    setMessage(`Successfully Published. Stable public link: ${publishedDraft.publicUrl}`);
    recordActivity({
      detail: `${publishedDraft.coachName} draft published and verified.`,
      label: "Coach Sites",
      status: "success"
    });
    setDialog(null);
  }

  async function reactivateArchivedSite(site: CoachSiteRecord) {
    if (reactivatingSiteId) return;

    setReactivatingSiteId(site.id);
    setReactivateStep("Restoring saved coach-site record");
    setMessage("Reactivating coach site...");
    recordActivity({
      detail: `${site.coachName} reactivation started.`,
      label: "Coach Sites",
      status: "working"
    });

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
        setReactivateStep("Reactivate failed safely");
        setStorageReady(Boolean(payload.configured));
        setStorageMessage(payload.error || "Could not reactivate this coach site.");
        reportAdminStorageIssue({
          category: payload.configured === false ? "database_failure" : "admin_action_issue",
          coachSlug: site.slug,
          safeMessage: payload.error || "Archived coach site could not be reactivated.",
          technicalDetails: `PATCH /api/admin/coach-sites reactivate failed with ${response.status}`,
          userAction: "Reactivate archived coach site"
        });
        recordActivity({
          detail: `${site.coachName} could not be reactivated.`,
          label: "Coach Sites",
          status: "error"
        });
        return;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setStorageMessage("Coach site reactivated successfully.");
      updateCommittedSites((current) =>
        current.map((item) => (item.id === site.id ? payload.coachSite! : item))
      );
      setPreviewSite((current) => (current?.id === site.id ? payload.coachSite! : current));
      highlightCoachSite(payload.coachSite.id);
      setReactivateStep("Reactivated successfully");
      recordActivity({
        detail: `${payload.coachSite.coachName} reactivated successfully.`,
        label: "Coach Sites",
        status: "success"
      });
      await waitForCoachSiteActionFeedback();
      setDialog(null);
    } catch {
      setReactivateStep("Reactivate failed safely");
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
      recordActivity({
        detail: `${site.coachName} reactivation failed safely.`,
        label: "Coach Sites",
        status: "error"
      });
    } finally {
      setReactivatingSiteId("");
    }
  }

  async function deleteDraftSite(site: CoachSiteRecord) {
    if (deletingDraftId) return;

    setDeletingDraftId(site.id);
    setDeleteDraftStep("Sending protected draft delete request");
    setStorageMessage("Deleting draft...");
    recordActivity({
      detail: `${site.coachName || "Coach"} draft deletion started.`,
      label: "Coach Sites",
      status: "working"
    });

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
        setDeleteDraftStep("Draft delete failed safely");
        setStorageReady(Boolean(payload.configured));
        reportAdminStorageIssue({
          category: payload.configured === false ? "database_failure" : "admin_action_issue",
          coachSlug: site.slug,
          safeMessage: payload.error || "Could not delete this draft.",
          technicalDetails: `PATCH /api/admin/coach-sites delete_draft failed with ${response.status}`,
          userAction: "Delete coach site draft"
        });
        recordActivity({
          detail: `${site.coachName || "Coach"} draft could not be deleted.`,
          label: "Coach Sites",
          status: "error"
        });
        return;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      updateCommittedSites((current) => current.filter((item) => item.id !== site.id));
      setPreviewSite((current) => (current?.id === site.id ? null : current));
      setPublishedSite((current) => (current?.id === site.id ? null : current));
      setStorageMessage("Draft deleted.");
      setMessage(`${site.coachName || "Coach"} draft deleted.`);
      setDeleteDraftStep("Draft deleted successfully");
      recordActivity({
        detail: `${site.coachName || "Coach"} draft deleted.`,
        label: "Coach Sites",
        status: "success"
      });
      await waitForCoachSiteActionFeedback();
      setDialog(null);
    } catch {
      setDeleteDraftStep("Draft delete failed safely");
      setStorageReady(false);
      reportAdminStorageIssue({
        category: "network_or_server_failure",
        coachSlug: site.slug,
        safeMessage: "Could not reach admin API to delete this draft.",
        technicalDetails: "PATCH /api/admin/coach-sites delete_draft network failure",
        userAction: "Delete coach site draft"
      });
      recordActivity({
        detail: `${site.coachName || "Coach"} draft delete failed safely.`,
        label: "Coach Sites",
        status: "error"
      });
    } finally {
      setDeletingDraftId("");
      setDeleteDraftStep("");
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
    setRemoveActionStep(
      status === "archived" ? "Sending archive request" : "Sending permanent remove request"
    );
    recordActivity({
      detail:
        status === "archived"
          ? `${site.coachName} archive confirmation submitted.`
          : `${site.coachName} permanent remove confirmation submitted.`,
      label: "Coach Sites",
      status: "working"
    });

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
        setRemoveActionStep(
          status === "archived" ? "Archive failed safely" : "Remove failed safely"
        );
        setRemoveMessage(payload.error || "Could not update this coach site.");
        setStorageReady(Boolean(payload.configured));
        recordActivity({
          detail:
            status === "archived"
              ? `${site.coachName} could not be archived.`
              : `${site.coachName} could not be removed.`,
          label: "Coach Sites",
          status: "error"
        });
        return;
      }

      setStorageReady(true);
      setStorageErrorCode("");
      setStorageMessage(
        status === "archived"
          ? `${payload.coachSite.coachName} archived. It moved behind Archived Coaches and can be reactivated later.`
          : `${payload.coachSite.coachName} removed. Removed records are hidden from Admin lists and analytics.`
      );
      updateCommittedSites((current) =>
        current.map((item) => (item.id === site.id ? payload.coachSite! : item))
      );
      setPreviewSite((current) => (current?.id === site.id ? payload.coachSite! : current));
      if (status === "archived") {
        highlightCoachSite(payload.coachSite.id);
      }
      setRemoveConfirm("");
      setRemoveOtp("");
      setRemoveMessage("");
      setRemoveActionStep(status === "archived" ? "Archived successfully" : "Removed successfully");
      recordActivity({
        detail:
          status === "archived"
            ? `${payload.coachSite.coachName} archived successfully.`
            : `${payload.coachSite.coachName} removed and hidden from active admin lists.`,
        label: "Coach Sites",
        status: "success"
      });
      await waitForCoachSiteActionFeedback();
      setDialog(null);
    } catch {
      setRemoveActionStep(status === "archived" ? "Archive failed safely" : "Remove failed safely");
      setRemoveMessage("Could not reach admin API for this coach-site action.");
      recordActivity({
        detail:
          status === "archived"
            ? `${site.coachName} archive failed safely.`
            : `${site.coachName} remove failed safely.`,
        label: "Coach Sites",
        status: "error"
      });
    } finally {
      setRemoveSubmitting(null);
      setRemoveActionStep("");
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
      updateCommittedSites((current) =>
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
      result.publicPageHasTemplateMarker =
        html.includes("YW Nutritech") &&
        html.includes(site.coachName) &&
        html.includes('data-track="coach_register_click"');
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

    if (!site.googleFormUrl.trim()) {
      return "Registration/contact link is required before publishing this draft.";
    }

    if (!isSingleRegistrationContactUrl(site.googleFormUrl)) {
      return "Use a valid HTTPS registration/contact link before publishing this draft.";
    }

    if (site.coachEmail.trim() && !isSingleEmailAddress(site.coachEmail)) {
      return "Use one valid support email before publishing this draft.";
    }

    if (site.coachPhone.trim() && !isValidIndianPhoneNumber(site.coachPhone)) {
      return "Use one valid 10-digit Indian support phone/WhatsApp number before publishing this draft.";
    }

    if (site.heroMediaType === "image" && !site.photoUrl.trim() && !site.logoUrl.trim()) {
      return "Add a coach photo/logo or choose No Media before publishing this draft.";
    }

    if (site.heroMediaType === "video" && !site.videoUrl.trim()) {
      return "Add a video URL/upload or choose No Media before publishing this draft.";
    }

    return "";
  }

  function isSingleRegistrationContactUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) return false;
    if ((trimmed.match(/https?:\/\//gi) || []).length !== 1) return false;

    try {
      const url = new URL(trimmed);
      if (url.protocol !== "https:") return false;
      if (url.hostname.includes("localhost")) return false;
      return url.pathname.length > 0;
    } catch {
      return false;
    }
  }

  function isSingleEmailAddress(value: string) {
    const trimmed = value.trim();
    if (!trimmed || /[\s,;]/.test(trimmed)) return false;
    if ((trimmed.match(/@/g) || []).length !== 1) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  function isValidIndianPhoneNumber(value: string) {
    return /^[6-9]\d{9}$/.test(normalizeIndianPhoneDigits(value));
  }

  function normalizeIndianPhoneDigits(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    return digits;
  }

  async function copyPublicLink(site: CoachSiteRecord) {
    const link =
      typeof window === "undefined"
        ? site.publicUrl
        : new URL(site.publicUrl, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(link);
      recordActivity({
        detail: `${site.coachName} public link copied.`,
        label: "Coach Sites",
        status: "success"
      });
    } catch {
      // The confirmation dialog still shows the stable link if clipboard is blocked.
      recordActivity({
        detail: `${site.coachName} link copy was blocked by the browser.`,
        label: "Coach Sites",
        status: "error"
      });
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
        <button
          className={styles.primaryAction}
          data-admin-tooltip="Open the multi-step website builder"
          onClick={() => openCreatorDialog()}
          type="button"
        >
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
              data-admin-tooltip="Show archived coach sites"
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
                          <tr
                            data-highlight={highlightedSiteId === site.id ? "true" : undefined}
                            key={site.id}
                          >
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
                                  aria-label={`View ${site.coachName}`}
                                  className={styles.iconAction}
                                  data-admin-tooltip="View details"
                                  onClick={() => setDialog({ site, type: "manage" })}
                                  type="button"
                                >
                                  <AdminActionIcon name="eye" />
                                  <span className={styles.visuallyHidden}>View</span>
                                </button>
                                <button
                                  aria-label={`Preview ${site.coachName}`}
                                  className={styles.iconAction}
                                  data-admin-tooltip="Preview site"
                                  onClick={() => setDialog({ site, type: "preview" })}
                                  type="button"
                                >
                                  <AdminActionIcon name="open" />
                                  <span className={styles.visuallyHidden}>Preview</span>
                                </button>
                                <button
                                  aria-label={`Reactivate ${site.coachName}`}
                                  className={styles.iconAction}
                                  data-admin-tooltip="Restore this archived site"
                                  data-tone="success"
                                  onClick={() => setDialog({ site, type: "reactivate" })}
                                  type="button"
                                >
                                  <AdminActionIcon name="restore" />
                                  <span className={styles.visuallyHidden}>Reactivate</span>
                                </button>
                                <button
                                  aria-label={`Delete ${site.coachName} permanently`}
                                  className={styles.iconAction}
                                  data-admin-tooltip="Delete permanently"
                                  data-tone="danger"
                                  onClick={() => setDialog({ site, type: "remove" })}
                                  type="button"
                                >
                                  <AdminActionIcon name="trash" />
                                  <span className={styles.visuallyHidden}>Delete Permanently</span>
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
                      <tr
                        data-highlight={highlightedSiteId === site.id ? "true" : undefined}
                        key={site.id}
                      >
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
                            <button
                              aria-label={`Continue editing ${site.coachName}`}
                              className={styles.iconAction}
                              data-admin-tooltip="Continue editing draft"
                              onClick={() => openCreatorDialog(site, 0)}
                              type="button"
                            >
                              <AdminActionIcon name="edit" />
                              <span className={styles.visuallyHidden}>Continue Editing</span>
                            </button>
                            <button
                              aria-label={`Preview ${site.coachName}`}
                              className={styles.iconAction}
                              data-admin-tooltip="Preview draft"
                              onClick={() => setDialog({ site, type: "preview" })}
                              type="button"
                            >
                              <AdminActionIcon name="eye" />
                              <span className={styles.visuallyHidden}>Preview</span>
                            </button>
                            <button
                              aria-label={`Publish ${site.coachName}`}
                              className={styles.iconAction}
                              data-admin-tooltip="Publish draft"
                              onClick={() => {
                                void publishDraftSite(site);
                              }}
                              type="button"
                            >
                              <AdminActionIcon name="check" />
                              <span className={styles.visuallyHidden}>Publish</span>
                            </button>
                            <button
                              aria-label={`Delete draft for ${site.coachName}`}
                              className={styles.iconAction}
                              data-admin-tooltip="Delete draft"
                              data-tone="danger"
                              onClick={() => setDialog({ site, type: "delete-draft" })}
                              type="button"
                            >
                              <AdminActionIcon name="trash" />
                              <span className={styles.visuallyHidden}>Delete Draft</span>
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
                    <tr
                      data-highlight={highlightedSiteId === site.id ? "true" : undefined}
                      key={site.id}
                    >
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
                          aria-label={`Manage ${site.coachName}`}
                          className={styles.iconAction}
                          data-admin-tooltip="Manage coach site"
                          onClick={() => setDialog({ site, type: "manage" })}
                          type="button"
                        >
                          <AdminActionIcon name="settings" />
                          <span className={styles.visuallyHidden}>Manage</span>
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
      {displayStorageMessage ? (
        <p className={displayStorageReady ? styles.inlineStatus : styles.linkWarning}>
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
          {displayStorageMessage}
        </p>
      ) : null}

      <CoachDialogRenderer
        aiMessage={aiMessage}
        aiSubmitting={aiSubmitting}
        csrfToken={csrfToken}
        dialog={dialog}
        form={form}
        onAnalyzePaidFunnel={() => requestPaidFunnelAnalysis(form)}
        onAdminActivity={onAdminActivity}
        onClose={() => setDialog(null)}
        onCopyAgain={(site) => void copyPublicLink(site)}
        onDeleteDraft={(site) => void deleteDraftSite(site)}
        onEditSite={openCreatorDialog}
        onGeneratePreview={generatePreviewFromDetails}
        onOpenDialog={setDialog}
        onPublish={() => upsertSite("published")}
        onPublishDraft={publishDraftSite}
        onRegenerateCopy={handleRegenerateCopy}
        onRemoveAction={confirmDangerousCoachSiteStatus}
        onRemoveCancel={() => {
          setRemoveConfirm("");
          setRemoveMessage("");
          setRemoveOtp("");
          setRemoveSubmitting(null);
          setRemoveActionStep("");
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
        mediaProcessingMessage={mediaProcessingMessage}
        previewSite={previewSite}
        previewPersistenceRevision={previewPersistenceRevision}
        publishProgress={publishProgress}
        publishedSite={publishedSite}
        deletingDraftId={deletingDraftId}
        deleteDraftStep={deleteDraftStep}
        draftSubmitting={draftSubmitting}
        reactivatingSiteId={reactivatingSiteId}
        reactivateStep={reactivateStep}
        removeConfirm={removeConfirm}
        removeActionStep={removeActionStep}
        removeMessage={removeMessage}
        removeOtp={removeOtp}
        removeOtpSending={removeOtpSending}
        removeReason={removeReason}
        removeSubmitting={removeSubmitting}
        statusActionStep={statusActionStep}
        statusSubmitting={statusSubmitting}
        setRemoveConfirm={setRemoveConfirm}
        setRemoveOtp={setRemoveOtp}
        setRemoveReason={setRemoveReason}
        setMediaProcessingMessage={setMediaProcessingMessage}
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
  deletingDraftId,
  deleteDraftStep,
  dialog,
  draftSubmitting,
  form,
  onAnalyzePaidFunnel,
  onAdminActivity,
  onClose,
  onCopyAgain,
  onDeleteDraft,
  onEditSite,
  onGeneratePreview,
  onOpenDialog,
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
  mediaProcessingMessage,
  paidFunnelAnalysis,
  paidFunnelAnalysisBusy,
  paidFunnelAnalysisMessage,
  previewSite,
  previewPersistenceRevision,
  publishProgress,
  publishedSite,
  reactivatingSiteId,
  reactivateStep,
  removeConfirm,
  removeActionStep,
  removeMessage,
  removeOtp,
  removeOtpSending,
  removeReason,
  removeSubmitting,
  statusActionStep,
  statusSubmitting,
  setRemoveConfirm,
  setMediaProcessingMessage,
  setRemoveOtp,
  setRemoveReason,
  setWizardStep,
  wizardStep
}: {
  aiMessage: string;
  aiSubmitting: boolean;
  csrfToken: string;
  deletingDraftId: string;
  deleteDraftStep: string;
  dialog: CoachDialog | null;
  draftSubmitting: boolean;
  form: CoachSiteFormState;
  mediaProcessingMessage: string;
  onAnalyzePaidFunnel: () => Promise<PaidFunnelAnalysis | null>;
  onAdminActivity?: (activity: AdminActionActivityInput) => void;
  onClose: () => void;
  onCopyAgain: (site: CoachSiteRecord) => void;
  onDeleteDraft: (site: CoachSiteRecord) => void;
  onEditSite: (site?: CoachSiteRecord, step?: number) => void;
  onGeneratePreview: () => Promise<boolean>;
  onOpenDialog: (dialog: CoachDialog) => void;
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
  previewPersistenceRevision: number;
  publishProgress: PublishProgressState;
  publishedSite: CoachSiteRecord | null;
  reactivatingSiteId: string;
  reactivateStep: string;
  removeConfirm: string;
  removeActionStep: string;
  removeMessage: string;
  removeOtp: string;
  removeOtpSending: boolean;
  removeReason: string;
  removeSubmitting: CoachSiteDangerStatus | null;
  statusActionStep: string;
  statusSubmitting: "" | "paused" | "published";
  setRemoveConfirm: (value: string) => void;
  setMediaProcessingMessage: (value: string) => void;
  setRemoveOtp: (value: string) => void;
  setRemoveReason: (value: string) => void;
  setWizardStep: (step: number) => void;
  wizardStep: number;
}) {
  if (!dialog) return null;

  if (dialog.type === "creator") {
    const mediaProcessing = Boolean(mediaProcessingMessage);

    return (
      <AdminActionDialog
        footer={
          <WizardFooter
            aiSubmitting={aiSubmitting}
            mediaProcessing={mediaProcessing}
            onClose={onClose}
            onGeneratePreview={onGeneratePreview}
            onPublish={onPublish}
            onSaveDraft={onSaveDraft}
            mediaProcessingMessage={mediaProcessingMessage}
            draftSubmitting={draftSubmitting}
            publishSubmitting={publishProgress.phase === "publishing"}
            setWizardStep={setWizardStep}
            wizardStep={wizardStep}
          />
        }
        onClose={mediaProcessing ? () => undefined : onClose}
        open
        size="large"
        title="Coach Website Creator"
      >
        <div
          aria-busy={mediaProcessing}
          className={styles.wizardShell}
          data-media-busy={mediaProcessing ? "true" : undefined}
        >
          {mediaProcessing ? <MediaProcessingOverlay message={mediaProcessingMessage} /> : null}
          <div className={styles.stepIndicator}>
            {wizardSteps.map((step, index) => (
              <button
                data-active={wizardStep === index ? "true" : "false"}
                key={step}
                disabled={aiSubmitting || mediaProcessing}
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
              </>
            ) : null}

            {wizardStep === 1 ? (
              <HeroMediaStep
                csrfToken={csrfToken}
                form={form}
                onAdminActivity={onAdminActivity}
                onMediaProcessingMessage={setMediaProcessingMessage}
                onUpdateField={onUpdateField}
              />
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
                  label="Registration/contact link"
                  helper="Paste one Google Form, WhatsApp, or HTTPS registration/contact link."
                  onChange={(value) => onUpdateField("googleFormUrl", value)}
                  sanitizeMode="url"
                  type="url"
                  value={form.googleFormUrl}
                />
                <TextField
                  helper="Hidden from the normal public page. Used only on error/unavailable fallback pages."
                  label="Error support WhatsApp link"
                  onChange={(value) => onUpdateField("whatsappLink", value)}
                  sanitizeMode="url"
                  type="url"
                  value={form.whatsappLink}
                />
                <TextField
                  helper="Hidden from the normal public page. Used only on error/unavailable fallback pages."
                  label="Error support email"
                  onChange={(value) => onUpdateField("coachEmail", value)}
                  sanitizeMode="email"
                  type="email"
                  value={form.coachEmail}
                />
                <TextField
                  helper="Hidden from the normal public page. Used only on error/unavailable fallback pages."
                  label="Error support phone"
                  onChange={(value) => onUpdateField("coachPhone", value)}
                  sanitizeMode="phone"
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
                onRegenerateCopy={onRegenerateCopy}
                onUpdateField={onUpdateField}
                persistedRevision={previewPersistenceRevision}
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
    const deletingCurrentDraft = deletingDraftId === dialog.site.id;

    return (
      <AdminActionDialog
        footer={
          <>
            <button
              className={styles.secondaryAction}
              disabled={deletingCurrentDraft}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.primaryAction}
              disabled={deletingCurrentDraft}
              onClick={() => {
                void onPublishDraft(dialog.site);
              }}
              type="button"
            >
              Publish Instead
            </button>
            <button
              className={styles.dangerAction}
              disabled={deletingCurrentDraft}
              onClick={() => onDeleteDraft(dialog.site)}
              type="button"
            >
              {deletingCurrentDraft ? "Deleting..." : "Delete Draft"}
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
        {deletingCurrentDraft ? (
          <CoachSiteActionProgressCard
            label={
              deleteDraftStep.includes("successfully") ? "Deleted successfully" : "Deleting draft"
            }
            progress={deleteDraftStep.includes("successfully") ? 100 : 62}
            steps={[
              "Protected admin request started",
              deleteDraftStep || "Removing draft from reusable list",
              "Published sites remain untouched"
            ]}
            variant="delete"
          />
        ) : null}
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
    const reactivateBusy = reactivatingSiteId === dialog.site.id;

    return (
      <AdminActionDialog
        footer={
          <>
            <button
              className={styles.secondaryAction}
              disabled={reactivateBusy}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.primaryAction}
              disabled={reactivateBusy}
              onClick={() => onReactivateSite(dialog.site)}
              type="button"
            >
              {reactivateBusy ? "Restoring..." : "Restore Site"}
            </button>
          </>
        }
        onClose={() => {
          if (!reactivateBusy) onClose();
        }}
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
        {reactivateBusy ? (
          <CoachSiteActionProgressCard
            label={
              reactivateStep.includes("successfully")
                ? "Reactivated successfully"
                : "Restoring coach site"
            }
            progress={reactivateStep.includes("successfully") ? 100 : 58}
            steps={[
              "Archived record found",
              reactivateStep || "Restoring saved coach-site record",
              "Same public link stays active"
            ]}
            variant="restore"
          />
        ) : null}
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
    const statusBusy = statusSubmitting === dialog.nextStatus;
    return (
      <AdminActionDialog
        footer={
          <>
            <button
              className={styles.secondaryAction}
              disabled={statusBusy}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={styles.primaryAction}
              disabled={statusBusy}
              onClick={() => {
                void onStatusConfirm(dialog.site, dialog.nextStatus);
              }}
              type="button"
            >
              {statusBusy
                ? dialog.nextStatus === "paused"
                  ? "Pausing..."
                  : "Resuming..."
                : `Confirm ${action}`}
            </button>
          </>
        }
        onClose={() => {
          if (!statusBusy) onClose();
        }}
        open
        title={action}
      >
        <p className={styles.dialogCopy}>
          The public link stays the same: {dialog.site.publicUrl}.{" "}
          {dialog.nextStatus === "paused"
            ? "Visitors will see the temporarily unavailable page with the hidden support fallback."
            : "Visitors will see the public coach site again."}
        </p>
        {statusBusy ? (
          <CoachSiteActionProgressCard
            label={
              statusActionStep.includes("successfully")
                ? dialog.nextStatus === "paused"
                  ? "Paused successfully"
                  : "Resumed successfully"
                : dialog.nextStatus === "paused"
                  ? "Pausing coach site"
                  : "Resuming coach site"
            }
            progress={statusActionStep.includes("successfully") ? 100 : 58}
            steps={[
              "Status change confirmed",
              statusActionStep || "Saving status in coach-site database",
              "Coach Sites list updates automatically"
            ]}
          />
        ) : null}
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
          <button
            className={styles.secondaryAction}
            disabled={removeBusy}
            onClick={onRemoveCancel}
            type="button"
          >
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
      onClose={() => {
        if (!removeBusy) onRemoveCancel();
      }}
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
      {removeBusy ? (
        <CoachSiteActionProgressCard
          label={
            removeActionStep.includes("successfully")
              ? removeSubmitting === "archived"
                ? "Archived successfully"
                : "Removed successfully"
              : removeSubmitting === "archived"
                ? "Archiving coach site"
                : "Removing coach site"
          }
          progress={removeActionStep.includes("successfully") ? 100 : 62}
          steps={[
            "OTP and coach confirmation checked",
            removeActionStep ||
              (removeSubmitting === "archived"
                ? "Moving site into Archived Coaches"
                : "Hiding removed site from Admin lists"),
            removeSubmitting === "archived"
              ? "Coach data remains restorable"
              : "Removed records stay hidden from normal lists"
          ]}
          variant={removeSubmitting === "archived" ? "restore" : "delete"}
        />
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

function CoachSiteActionProgressCard({
  label,
  progress,
  steps,
  variant = "standard"
}: {
  label: string;
  progress: number;
  steps: string[];
  variant?: CoachSiteActionProgressVariant;
}) {
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const isDelete = variant === "delete";

  return (
    <div
      className={styles.actionProgressCard}
      data-variant={isDelete ? "delete" : undefined}
      role="status"
      aria-live="polite"
    >
      <div>
        {isDelete ? (
          <span className={styles.deleteProgressIcon} aria-hidden="true">
            <i />
            <i />
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        <strong>{label}</strong>
      </div>
      <div
        aria-label={`${label} progress`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={normalizedProgress}
        className={styles.actionProgressBar}
        role="progressbar"
      >
        <span style={{ width: `${normalizedProgress}%` }} />
      </div>
      <ul>
        {steps.map((step, index) => (
          <li data-active={index === Math.max(0, steps.length - 2) ? "true" : undefined} key={step}>
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
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
  onRegenerateCopy,
  onUpdateField,
  persistedRevision,
  previewSite
}: {
  aiMessage: string;
  aiSubmitting: boolean;
  form: CoachSiteFormState;
  onRegenerateCopy: (scope: CopyRegenerationScope) => Promise<void>;
  onUpdateField: <Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) => void;
  persistedRevision: number;
  previewSite: CoachSiteRecord | null;
}) {
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedInspectTarget, setSelectedInspectTarget] = useState<PreviewInspectTarget | null>(
    null
  );
  const [inspectDirtyRevision, setInspectDirtyRevision] = useState(0);
  const inspectDirty = inspectDirtyRevision > persistedRevision;
  const selectedInspectSlot = selectedInspectTarget
    ? getPreviewInspectSlotConfig(selectedInspectTarget, form)
    : null;

  useEffect(() => {
    if (!inspectMode) return;

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSelectedInspectTarget(null);
      setInspectMode(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [inspectMode]);

  const handleSelectInspectScope = useStableCallback((target: PreviewInspectTarget) => {
    setSelectedInspectTarget(target);
  });
  const handleRegenerateCopy = useStableCallback(async (scope: CopyRegenerationScope) => {
    await onRegenerateCopy(scope);
    setInspectDirtyRevision(persistedRevision + 1);
  });
  const handleInspectApply = useStableCallback((value: string) => {
    if (!selectedInspectSlot) return;
    selectedInspectSlot.apply(value, onUpdateField);
    setInspectDirtyRevision(persistedRevision + 1);
  });

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
            onClick={() => void handleRegenerateCopy("all")}
            type="button"
          >
            Regenerate All Copy
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
      {inspectDirty ? (
        <p className={styles.inlineStatus} role="status">
          Unsaved inspect edits are visible in the preview. Use Save Draft or Publish to persist
          them.
        </p>
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
        <AdminTemplateSkinPicker
          onChange={(selectedThemeId) => onUpdateField("selectedThemeId", selectedThemeId)}
          value={form.selectedThemeId}
        />
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
          <TextField
            label="Hero brand badge"
            onChange={(value) => onUpdateField("brandBadge", value)}
            value={form.brandBadge}
          />
          <TextField
            label="Hero brand support line"
            onChange={(value) => onUpdateField("brandEyebrow", value)}
            value={form.brandEyebrow}
          />
          <TextField
            label="Hero trust label"
            onChange={(value) => onUpdateField("heroTrustLine", value)}
            value={form.heroTrustLine}
          />
          <TextField
            label="Hero trust copy"
            onChange={(value) => onUpdateField("heroMicroTrustText", value)}
            value={form.heroMicroTrustText}
          />
          <TextField
            label="Hero media label"
            onChange={(value) => onUpdateField("heroMediaLabel", value)}
            value={form.heroMediaLabel}
          />
          <TextField
            label="Intro section label"
            onChange={(value) => onUpdateField("introSectionLabel", value)}
            value={form.introSectionLabel}
          />
          <TextAreaField
            label="Intro section heading"
            onChange={(value) => onUpdateField("introHeading", value)}
            value={form.introHeading}
          />
          <TextField
            label="Coach intro card label"
            onChange={(value) => onUpdateField("coachIntroLabel", value)}
            value={form.coachIntroLabel}
          />
          <TextAreaField
            label="Coach introduction"
            onChange={(value) => onUpdateField("coachIntro", value)}
            value={form.coachIntro}
          />
          <TextField
            label="Mission card label"
            onChange={(value) => onUpdateField("visionLabel", value)}
            value={form.visionLabel}
          />
          <TextAreaField
            label="Mission / vision copy"
            onChange={(value) => onUpdateField("visionText", value)}
            value={form.visionText}
          />
          <TextField
            label="Problem section label"
            onChange={(value) => onUpdateField("problemSectionLabel", value)}
            value={form.problemSectionLabel}
          />
          <TextAreaField
            label="Problem section heading"
            onChange={(value) => onUpdateField("problemHeading", value)}
            value={form.problemHeading}
          />
          <TextAreaField
            label="Problem bullets"
            onChange={(value) => onUpdateField("problemPointsText", value)}
            placeholder="One problem point per line"
            value={form.problemPointsText}
          />
          <TextAreaField
            label="Journey section heading"
            onChange={(value) => onUpdateField("journeyHeading", value)}
            value={form.journeyHeading}
          />
          <TextField
            label="Journey section label"
            onChange={(value) => onUpdateField("journeySectionLabel", value)}
            value={form.journeySectionLabel}
          />
          <TextAreaField
            helper="Each step uses three lines: label, title, description. Separate steps with a blank line."
            label="Journey steps"
            onChange={(value) => onUpdateField("journeyStepsText", value)}
            placeholder={
              "Profile\nMeet the coach\nGuests understand the coach story.\n\nFocus\nSee the wellness focus\nThe page explains the coach approach."
            }
            value={form.journeyStepsText}
          />
          <TextAreaField
            label="Bonus section heading"
            onChange={(value) => onUpdateField("benefitsHeading", value)}
            value={form.benefitsHeading}
          />
          <TextField
            label="Bonus section label"
            onChange={(value) => onUpdateField("benefitsSectionLabel", value)}
            value={form.benefitsSectionLabel}
          />
          <TextAreaField
            helper="One description per fixed service card. Service titles are locked to Life-Long Health Calculators, Lifetime Support Sessions, and Lifestyle Success Toolkit."
            label="Bonus service descriptions"
            onChange={(value) => onUpdateField("benefitDescriptionsText", value)}
            placeholder="One service description per line"
            value={form.benefitDescriptionsText}
          />
          <TextField
            label="Media section label"
            onChange={(value) => onUpdateField("mediaSubheading", value)}
            value={form.mediaSubheading}
          />
          <TextField
            label="Media module label"
            onChange={(value) => onUpdateField("mediaModuleLabel", value)}
            value={form.mediaModuleLabel}
          />
          <TextAreaField
            label="Media section heading"
            onChange={(value) => onUpdateField("mediaHeading", value)}
            value={form.mediaHeading}
          />
          <TextAreaField
            label="Media section text"
            onChange={(value) => onUpdateField("mediaBody", value)}
            value={form.mediaBody}
          />
          <TextAreaField
            label="CTA section text"
            onChange={(value) => onUpdateField("ctaText", value)}
            value={form.ctaText}
          />
          <TextField
            label="CTA section label"
            onChange={(value) => onUpdateField("ctaSectionLabel", value)}
            value={form.ctaSectionLabel}
          />
          <TextAreaField
            label="FAQ section heading"
            onChange={(value) => onUpdateField("faqHeading", value)}
            value={form.faqHeading}
          />
          <TextField
            label="FAQ section label"
            onChange={(value) => onUpdateField("faqSectionLabel", value)}
            value={form.faqSectionLabel}
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
          <TextAreaField
            label="Footer headline"
            onChange={(value) => onUpdateField("footerHeadline", value)}
            value={form.footerHeadline}
          />
          <TextField
            label="Footer brand line"
            onChange={(value) => onUpdateField("footerBrandLine", value)}
            value={form.footerBrandLine}
          />
          <TextAreaField
            label="Footer legal/support text"
            onChange={(value) => onUpdateField("footerText", value)}
            value={form.footerText}
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
          aiSubmitting={aiSubmitting}
          inspectMode={inspectMode}
          onApplyInspectEdit={handleInspectApply}
          onClearInspectSelection={() => setSelectedInspectTarget(null)}
          onRegenerateCopy={handleRegenerateCopy}
          onSelectInspectScope={handleSelectInspectScope}
          onToggleInspect={() => {
            if (inspectMode) setSelectedInspectTarget(null);
            setInspectMode(!inspectMode);
          }}
          selectedInspectSlot={selectedInspectSlot}
          selectedInspectScope={selectedInspectTarget}
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

function AdminTemplateSkinPicker({
  onChange,
  value
}: {
  onChange: (value: CoachTemplateThemeId) => void;
  value: CoachTemplateThemeId;
}) {
  return (
    <label className={styles.skinPicker}>
      <span>Visual skin</span>
      <select
        onChange={(event) => onChange(event.target.value as CoachTemplateThemeId)}
        value={value}
      >
        {coachTemplateThemes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
      <small>
        Presentation only. The canonical renderer keeps the same sections, CTA destination, Google
        Form behavior, support, legal links, analytics, inspect rules, and bonus services.
      </small>
    </label>
  );
}

// Kept as a fallback section editor while the preview inspector migrates to slot-level editing.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function InspectSectionEditor({
  aiSubmitting,
  form,
  onRegenerateCopy,
  onUpdateField,
  scope
}: {
  aiSubmitting: boolean;
  form: CoachSiteFormState;
  onRegenerateCopy: (scope: CopyRegenerationScope) => Promise<void>;
  onUpdateField: <Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) => void;
  scope: PreviewInspectSection;
}) {
  const regenerationScope = getCopyRegenerationScopeForInspectSection(scope);
  const scopeLabel = getCopyScopeLabel(regenerationScope);

  return (
    <section className={styles.inspectSectionEditor} aria-live="polite">
      <div className={styles.inspectSectionEditorHeader}>
        <div>
          <p className={styles.kicker}>Selected Section</p>
          <h3>{scopeLabel} editor</h3>
          <p>
            Edits apply to the live preview immediately and are included when the draft is saved or
            the site is published.
          </p>
        </div>
        <button
          className={styles.primaryAction}
          disabled={aiSubmitting}
          onClick={() => void onRegenerateCopy(regenerationScope)}
          type="button"
        >
          {aiSubmitting ? "Regenerating..." : `Regenerate ${scopeLabel}`}
        </button>
      </div>
      <div className={styles.inspectSectionEditorGrid}>
        {scope === "hero" ? (
          <>
            <TextField
              label="Hero brand badge"
              onChange={(value) => onUpdateField("brandBadge", value)}
              value={form.brandBadge}
            />
            <TextField
              label="Hero brand support line"
              onChange={(value) => onUpdateField("brandEyebrow", value)}
              value={form.brandEyebrow}
            />
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
            <TextField
              label="Hero trust label"
              onChange={(value) => onUpdateField("heroTrustLine", value)}
              value={form.heroTrustLine}
            />
            <TextField
              label="Hero trust copy"
              onChange={(value) => onUpdateField("heroMicroTrustText", value)}
              value={form.heroMicroTrustText}
            />
            <TextField
              label="Hero media label"
              onChange={(value) => onUpdateField("heroMediaLabel", value)}
              value={form.heroMediaLabel}
            />
          </>
        ) : null}

        {scope === "intro" ? (
          <>
            <TextField
              label="Intro section label"
              onChange={(value) => onUpdateField("introSectionLabel", value)}
              value={form.introSectionLabel}
            />
            <TextAreaField
              label="Intro heading"
              onChange={(value) => onUpdateField("introHeading", value)}
              value={form.introHeading}
            />
            <TextField
              label="Coach intro card label"
              onChange={(value) => onUpdateField("coachIntroLabel", value)}
              value={form.coachIntroLabel}
            />
            <TextAreaField
              label="Coach introduction"
              onChange={(value) => onUpdateField("coachIntro", value)}
              value={form.coachIntro}
            />
          </>
        ) : null}

        {scope === "vision" ? (
          <>
            <TextField
              label="Mission card label"
              onChange={(value) => onUpdateField("visionLabel", value)}
              value={form.visionLabel}
            />
            <TextAreaField
              label="Mission / vision copy"
              onChange={(value) => onUpdateField("visionText", value)}
              value={form.visionText}
            />
          </>
        ) : null}

        {scope === "problem" ? (
          <>
            <TextField
              label="Problem section label"
              onChange={(value) => onUpdateField("problemSectionLabel", value)}
              value={form.problemSectionLabel}
            />
            <TextAreaField
              label="Problem section heading"
              onChange={(value) => onUpdateField("problemHeading", value)}
              value={form.problemHeading}
            />
            <TextAreaField
              label="Problem bullets"
              onChange={(value) => onUpdateField("problemPointsText", value)}
              placeholder="One problem point per line"
              value={form.problemPointsText}
            />
            <TextAreaField
              label="Trust note"
              onChange={(value) => onUpdateField("trustText", value)}
              value={form.trustText}
            />
          </>
        ) : null}

        {scope === "journey" ? (
          <>
            <TextField
              label="Journey section label"
              onChange={(value) => onUpdateField("journeySectionLabel", value)}
              value={form.journeySectionLabel}
            />
            <TextAreaField
              label="Journey heading"
              onChange={(value) => onUpdateField("journeyHeading", value)}
              value={form.journeyHeading}
            />
            <TextAreaField
              helper="Each step uses three lines: label, title, description. Separate steps with a blank line."
              label="Journey steps"
              onChange={(value) => onUpdateField("journeyStepsText", value)}
              placeholder={
                "Profile\nMeet the coach\nGuests understand the coach story.\n\nFocus\nSee the wellness focus\nThe page explains the coach approach."
              }
              value={form.journeyStepsText}
            />
          </>
        ) : null}

        {scope === "benefits" ? (
          <>
            <TextField
              label="Bonus section label"
              onChange={(value) => onUpdateField("benefitsSectionLabel", value)}
              value={form.benefitsSectionLabel}
            />
            <TextAreaField
              label="Bonus heading"
              onChange={(value) => onUpdateField("benefitsHeading", value)}
              value={form.benefitsHeading}
            />
            <TextAreaField
              helper="One description per fixed service card. Service titles are locked to Life-Long Health Calculators, Lifetime Support Sessions, and Lifestyle Success Toolkit."
              label="Bonus service descriptions"
              onChange={(value) => onUpdateField("benefitDescriptionsText", value)}
              placeholder="One service description per line"
              value={form.benefitDescriptionsText}
            />
          </>
        ) : null}

        {scope === "media" ? (
          <>
            <TextField
              label="Media label"
              onChange={(value) => onUpdateField("mediaSubheading", value)}
              value={form.mediaSubheading}
            />
            <TextField
              label="Media module label"
              onChange={(value) => onUpdateField("mediaModuleLabel", value)}
              value={form.mediaModuleLabel}
            />
            <TextAreaField
              label="Media heading"
              onChange={(value) => onUpdateField("mediaHeading", value)}
              value={form.mediaHeading}
            />
            <TextAreaField
              label="Media text"
              onChange={(value) => onUpdateField("mediaBody", value)}
              value={form.mediaBody}
            />
          </>
        ) : null}

        {scope === "cta" ? (
          <>
            <TextField
              label="CTA section label"
              onChange={(value) => onUpdateField("ctaSectionLabel", value)}
              value={form.ctaSectionLabel}
            />
            <TextAreaField
              label="CTA copy"
              onChange={(value) => onUpdateField("ctaText", value)}
              value={form.ctaText}
            />
            <TextField
              label="Register button text"
              onChange={(value) => onUpdateField("registerButtonText", value)}
              value={form.registerButtonText}
            />
            <TextAreaField
              label="Trust note"
              onChange={(value) => onUpdateField("trustText", value)}
              value={form.trustText}
            />
            <TextAreaField
              helper="Hidden from normal public pages. Used only if a support fallback page is needed."
              label="Fallback support text"
              onChange={(value) => onUpdateField("supportText", value)}
              value={form.supportText}
            />
          </>
        ) : null}

        {scope === "faq" ? (
          <>
            <TextField
              label="FAQ section label"
              onChange={(value) => onUpdateField("faqSectionLabel", value)}
              value={form.faqSectionLabel}
            />
            <TextAreaField
              label="FAQ heading"
              onChange={(value) => onUpdateField("faqHeading", value)}
              value={form.faqHeading}
            />
            <TextAreaField
              label="FAQ"
              onChange={(value) => onUpdateField("faqText", value)}
              placeholder={"Question\nAnswer\n\nQuestion\nAnswer"}
              value={form.faqText}
            />
          </>
        ) : null}

        {scope === "footer" ? (
          <>
            <TextField
              label="Footer brand line"
              onChange={(value) => onUpdateField("footerBrandLine", value)}
              value={form.footerBrandLine}
            />
            <TextAreaField
              label="Footer headline"
              onChange={(value) => onUpdateField("footerHeadline", value)}
              value={form.footerHeadline}
            />
            <TextAreaField
              label="Footer legal/support text"
              onChange={(value) => onUpdateField("footerText", value)}
              value={form.footerText}
            />
            <TextAreaField
              label="Social caption"
              onChange={(value) => onUpdateField("socialCopy", value)}
              value={form.socialCopy}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function useStableCallback<Args extends unknown[], Return>(callback: (...args: Args) => Return) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Args) => {
    return callbackRef.current(...args);
  }, []);
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

function MediaProcessingOverlay({ message }: { message: string }) {
  return (
    <div className={styles.mediaProcessingOverlay} role="status" aria-live="polite">
      <div className={styles.mediaProcessingCard}>
        <span className={styles.mediaProcessingSpinner} aria-hidden="true" />
        <p>Preparing transparent coach photo</p>
        <strong>Please wait. Keep this builder open.</strong>
        <small>{message || "Creating a clean cutout and saving it securely..."}</small>
        <ul>
          <li>Removing the photo background</li>
          <li>Saving the processed cutout</li>
          <li>Updating preview and publish data</li>
        </ul>
      </div>
    </div>
  );
}

function HeroMediaStep({
  csrfToken,
  form,
  onAdminActivity,
  onMediaProcessingMessage,
  onUpdateField
}: {
  csrfToken: string;
  form: CoachSiteFormState;
  onAdminActivity?: (activity: AdminActionActivityInput) => void;
  onMediaProcessingMessage: (message: string) => void;
  onUpdateField: <Key extends keyof CoachSiteFormState>(
    key: Key,
    value: CoachSiteFormState[Key]
  ) => void;
}) {
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadingMediaType, setUploadingMediaType] = useState<"" | "image" | "video">("");
  const [coachImageResult, setCoachImageResult] = useState<CoachImageMediaResult | null>(null);
  const [temporaryImagePreviewUrl, setTemporaryImagePreviewUrl] = useState("");
  const [temporaryVideoPreviewUrl, setTemporaryVideoPreviewUrl] = useState("");
  const imagePreviewUrl = temporaryImagePreviewUrl || form.photoUrl || form.logoUrl;
  const videoPreviewUrl = normalizeVideoEmbedUrl(form.videoUrl);
  const uploadedVideoUrl =
    temporaryVideoPreviewUrl || (isUploadedVideoSource(form.videoUrl) ? form.videoUrl : "");
  const videoInvalid =
    form.heroMediaType === "video" && form.videoUrl.trim() && !videoPreviewUrl && !uploadedVideoUrl;
  const setImageUploadProgress = useCallback(
    (nextMessage: string) => {
      setUploadMessage(nextMessage);
      onMediaProcessingMessage(nextMessage);
    },
    [onMediaProcessingMessage]
  );

  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      void preloadCoachHeroPhotoBackgroundRemoval();
    }, 180000);

    return () => window.clearTimeout(preloadTimer);
  }, []);

  async function handleMediaUpload(file: File | undefined, mediaType: "image" | "video") {
    if (!file) return;

    const maxOriginalBytes = mediaType === "image" ? PHOTO_ORIGINAL_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > maxOriginalBytes) {
      setUploadMessage(
        mediaType === "image"
          ? "Photo is too large. Upload an optimized photo under 12 MB."
          : "Video is too large. Use a video under 70 MB or add a YouTube/video URL."
      );
      return;
    }

    if (mediaType === "image" && !isAllowedPhotoFile(file)) {
      setUploadMessage("Upload JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, or TIFF.");
      return;
    }

    if (mediaType === "video" && !isAllowedVideoFile(file)) {
      setUploadMessage("Upload a supported video file up to 70 MB, or paste a YouTube/video URL.");
      return;
    }

    setUploadingMediaType(mediaType);
    if (mediaType === "image") setCoachImageResult(null);
    const initialMessage =
      mediaType === "image" ? "Preparing your coach photo..." : `Uploading ${file.name}...`;
    setUploadMessage(initialMessage);
    if (mediaType === "image") onMediaProcessingMessage(initialMessage);
    onAdminActivity?.({
      detail:
        mediaType === "image"
          ? `${file.name} coach photo processing started.`
          : `${file.name} video upload started.`,
      label: "Coach Sites",
      status: "working"
    });

    const previewUrl = URL.createObjectURL(file);
    const uploadedFile = file;
    let cutoutFile: File | null = null;
    if (mediaType === "image") {
      setTemporaryImagePreviewUrl(previewUrl);
      onUpdateField("heroMediaType", "image");
    } else {
      setTemporaryVideoPreviewUrl(previewUrl);
      onUpdateField("heroMediaType", "video");
    }
    setUploadMessage(initialMessage);
    if (mediaType === "image") onMediaProcessingMessage(initialMessage);

    try {
      if (mediaType === "image") {
        const preparedPhoto = await prepareCoachHeroPhotoForUpload(file, {
          maxBytes: PHOTO_ORIGINAL_MAX_BYTES,
          onProgress: setImageUploadProgress
        });
        cutoutFile = preparedPhoto.file;
        setImageUploadProgress("Saving transparent coach photo...");
      }

      const formData = new FormData();
      formData.append("file", uploadedFile);
      if (cutoutFile) formData.append("cutoutFile", cutoutFile);
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
        setUploadMessage(payload.error || `${file.name} could not be saved. Please try again.`);
        onAdminActivity?.({
          detail:
            payload.error ||
            `${file.name} could not be saved because permanent media storage did not respond.`,
          label: "Coach Sites",
          status: "error"
        });
        return;
      }

      const stableMediaUrl =
        mediaType === "image"
          ? payload.media.cutoutUrl || payload.media.publicUrl
          : payload.media.publicUrl;

      onUpdateField(mediaType === "image" ? "photoUrl" : "videoUrl", stableMediaUrl);
      if (mediaType === "image") {
        setCoachImageResult(payload.media);
        setTemporaryImagePreviewUrl("");
        onMediaProcessingMessage("");
      } else {
        setTemporaryVideoPreviewUrl("");
      }
      setUploadMessage(
        mediaType === "image"
          ? getCoachImageUploadMessage(payload.media, file)
          : `${uploadedFile.name} uploaded and saved for this coach site.`
      );
      onAdminActivity?.({
        detail:
          mediaType === "image"
            ? getCoachImageAdminActivityMessage(payload.media, file)
            : `${uploadedFile.name} video uploaded and saved.`,
        label: "Coach Sites",
        status: "success"
      });
    } catch (error) {
      setTemporaryImagePreviewUrl("");
      setTemporaryVideoPreviewUrl("");
      if (mediaType === "image") onMediaProcessingMessage("");
      setUploadMessage(
        error instanceof Error
          ? error.message
          : `${file.name} could not be saved. Please try again.`
      );
      onAdminActivity?.({
        detail:
          error instanceof Error ? error.message : `${file.name} upload API was not reachable.`,
        label: "Coach Sites",
        status: "error"
      });
    } finally {
      URL.revokeObjectURL(previewUrl);
      if (mediaType === "image") {
        setTemporaryImagePreviewUrl((current) => (current === previewUrl ? "" : current));
      } else {
        setTemporaryVideoPreviewUrl((current) => (current === previewUrl ? "" : current));
      }
      setUploadingMediaType("");
      if (mediaType === "image") onMediaProcessingMessage("");
    }
  }

  function handleUseImageUrl(url: string | undefined, label: "cutout" | "original") {
    if (!url) return;
    setTemporaryImagePreviewUrl("");
    onUpdateField("heroMediaType", "image");
    onUpdateField("photoUrl", url);
    setUploadMessage(
      label === "cutout"
        ? "Using the transparent coach cutout."
        : "Using the original photo in the portrait frame."
    );
  }

  function handleResetImage() {
    setCoachImageResult(null);
    setTemporaryImagePreviewUrl("");
    onUpdateField("photoUrl", "");
    setUploadMessage("Coach photo cleared. Upload another image when ready.");
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
          <option value="video">Video Upload/Link</option>
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
              disabled={uploadingMediaType === "image"}
              onChange={(event) => void handleMediaUpload(event.target.files?.[0], "image")}
              type="file"
            />
            <small>
              {uploadingMediaType === "image"
                ? "Uploading photo. Please wait..."
                : "JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, BMP, and TIFF are supported."}
            </small>
          </label>
          <TextField
            helper="Use a coach photo, logo, or hero image URL."
            label="Coach photo / hero image URL"
            onChange={(value) => {
              setCoachImageResult(null);
              onUpdateField("photoUrl", value);
            }}
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
          {coachImageResult ? (
            <CoachImageResultPanel
              activeUrl={form.photoUrl}
              disabled={uploadingMediaType === "image"}
              media={coachImageResult}
              onReset={handleResetImage}
              onUse={handleUseImageUrl}
            />
          ) : imagePreviewUrl ? (
            <button className={styles.secondaryAction} onClick={handleResetImage} type="button">
              Reset image
            </button>
          ) : null}
        </div>
      ) : null}

      {form.heroMediaType === "video" ? (
        <div className={styles.formGrid}>
          <label className={styles.compactField}>
            <span>Upload video</span>
            <input
              accept={VIDEO_UPLOAD_ACCEPT}
              disabled={uploadingMediaType === "video"}
              onChange={(event) => void handleMediaUpload(event.target.files?.[0], "video")}
              type="file"
            />
            <small>
              {uploadingMediaType === "video"
                ? "Uploading video. Please wait..."
                : "Upload a supported video up to 70 MB, or paste a YouTube/video URL below."}
            </small>
          </label>
          <TextField
            helper="YouTube watch, shorts, share, and embed links are supported."
            label="Hero video URL"
            onChange={(value) => onUpdateField("videoUrl", value)}
            type="url"
            value={form.videoUrl}
          />
          <div
            className={styles.mediaPreview}
            data-state={videoPreviewUrl || uploadedVideoUrl ? "ready" : "empty"}
          >
            {videoPreviewUrl ? (
              <iframe
                allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture"
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
  draftSubmitting,
  mediaProcessing,
  mediaProcessingMessage,
  onClose,
  onGeneratePreview,
  onPublish,
  onSaveDraft,
  publishSubmitting,
  setWizardStep,
  wizardStep
}: {
  aiSubmitting: boolean;
  draftSubmitting: boolean;
  mediaProcessing: boolean;
  mediaProcessingMessage: string;
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
        data-admin-tooltip="Close the website creator"
        disabled={publishSubmitting || mediaProcessing}
        onClick={onClose}
        type="button"
      >
        Close
      </button>
      <button
        className={styles.secondaryAction}
        data-admin-tooltip="Go back one builder step"
        disabled={wizardStep === 0 || aiSubmitting || publishSubmitting || mediaProcessing}
        onClick={() => setWizardStep(Math.max(wizardStep - 1, 0))}
        type="button"
      >
        Back
      </button>
      <button
        className={styles.secondaryAction}
        data-admin-tooltip="Save progress and continue later from Drafts"
        aria-busy={draftSubmitting}
        disabled={aiSubmitting || publishSubmitting || draftSubmitting || mediaProcessing}
        onClick={() => {
          void onSaveDraft();
        }}
        type="button"
      >
        {draftSubmitting ? "Saving..." : "Save Draft"}
      </button>
      {wizardStep < wizardSteps.length - 1 ? (
        <button
          className={styles.primaryAction}
          data-admin-tooltip={
            wizardStep === 3
              ? "Generate copy and open the preview step"
              : "Continue to the next builder step"
          }
          disabled={aiSubmitting || publishSubmitting || mediaProcessing}
          aria-describedby={mediaProcessing ? "admin-media-processing-message" : undefined}
          onClick={() => {
            if (mediaProcessing) return;
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
          data-admin-tooltip="Publish after validation and public-page verification"
          disabled={aiSubmitting || publishSubmitting || mediaProcessing}
          onClick={() => {
            if (mediaProcessing) return;
            void onPublish();
            setWizardStep(5);
          }}
          type="button"
        >
          {publishSubmitting ? "Publishing..." : "Publish"}
        </button>
      )}
      {mediaProcessing ? (
        <span className={styles.footerBusyHint} id="admin-media-processing-message">
          {mediaProcessingMessage || "Please wait for the photo cutout to finish."}
        </span>
      ) : null}
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
          Registration/contact link missing. Public register buttons stay disabled until a link is
          added.
        </p>
      ) : null}
    </div>
  );
}

const CoachSitePreview = memo(function CoachSitePreview({
  aiSubmitting = false,
  inspectMode = false,
  onApplyInspectEdit,
  onClearInspectSelection,
  onRegenerateCopy,
  onSelectInspectScope,
  onToggleInspect,
  selectedInspectSlot,
  selectedInspectScope,
  site
}: {
  aiSubmitting?: boolean;
  inspectMode?: boolean;
  onApplyInspectEdit?: (value: string) => void;
  onClearInspectSelection?: () => void;
  onRegenerateCopy?: (scope: CopyRegenerationScope) => Promise<void>;
  onSelectInspectScope?: (value: PreviewInspectTarget) => void;
  onToggleInspect?: () => void;
  selectedInspectSlot?: PreviewInspectSlotConfig | null;
  selectedInspectScope?: PreviewInspectTarget | null;
  site: CoachSiteRecord;
}) {
  const selectedTheme = getCoachTemplateTheme(site.selectedThemeId);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile" | "tablet">(
    "desktop"
  );
  const [inspectEditorPosition, setInspectEditorPosition] = useState<{
    left: number;
    target: PreviewInspectTarget;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!inspectMode || !selectedInspectScope) {
      return;
    }

    const frame = previewFrameRef.current;
    if (!frame) return;

    const activeInspectScope = selectedInspectScope;
    let animationFrame = 0;

    function measureSelectedTarget() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const activeFrame = previewFrameRef.current;
        if (!activeFrame) return;

        const selectedTargets = Array.from(
          activeFrame.querySelectorAll<HTMLElement>("[data-selected='true'][data-inspect-target]")
        );
        const frameRect = activeFrame.getBoundingClientRect();
        const selectedTarget =
          selectedTargets.find((target) => {
            const rect = target.getBoundingClientRect();
            return (
              rect.bottom > frameRect.top &&
              rect.top < frameRect.bottom &&
              rect.right > frameRect.left &&
              rect.left < frameRect.right
            );
          }) || selectedTargets[0];

        if (!selectedTarget) {
          setInspectEditorPosition(null);
          return;
        }

        const targetRect = selectedTarget.getBoundingClientRect();
        const editorWidth = Math.min(448, Math.max(280, activeFrame.clientWidth - 24));
        const gap = 12;
        const minLeft = activeFrame.scrollLeft + gap;
        const maxLeft =
          activeFrame.scrollLeft + Math.max(gap, activeFrame.clientWidth - editorWidth - gap);
        const preferredLeft = activeFrame.scrollLeft + targetRect.right - frameRect.left + gap;
        const fallbackLeft = activeFrame.scrollLeft + targetRect.left - frameRect.left;
        const left = Math.min(Math.max(minLeft, preferredLeft), maxLeft);
        const top = Math.max(
          activeFrame.scrollTop + gap,
          activeFrame.scrollTop + targetRect.bottom - frameRect.top + gap,
          activeFrame.scrollTop + targetRect.top - frameRect.top + gap
        );

        setInspectEditorPosition({
          left: Math.round(Number.isFinite(left) ? left : fallbackLeft),
          target: activeInspectScope,
          top: Math.round(top)
        });
      });
    }

    measureSelectedTarget();
    frame.addEventListener("scroll", measureSelectedTarget, { passive: true });
    window.addEventListener("resize", measureSelectedTarget);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      frame.removeEventListener("scroll", measureSelectedTarget);
      window.removeEventListener("resize", measureSelectedTarget);
    };
  }, [inspectMode, selectedInspectScope, site]);

  const inspectEditorStyle =
    inspectEditorPosition && inspectEditorPosition.target === selectedInspectScope
      ? ({
          "--inspect-editor-left": `${inspectEditorPosition.left}px`,
          "--inspect-editor-top": `${inspectEditorPosition.top}px`
        } as CSSProperties)
      : undefined;

  return (
    <article className={styles.productionPreview} data-theme={selectedTheme.id}>
      <div className={styles.productionPreviewHeader}>
        <div>
          <p className={styles.kicker}>Public Website Preview</p>
          <h3>{site.coachName}</h3>
        </div>
        <div className={styles.productionPreviewHeaderActions}>
          <div className={styles.productionPreviewViewportTools} aria-label="Preview device size">
            {(["desktop", "tablet", "mobile"] as const).map((item) => (
              <button
                data-active={previewViewport === item ? "true" : undefined}
                key={item}
                onClick={() => setPreviewViewport(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <span>{site.publicUrl}</span>
        </div>
      </div>
      <div
        className={styles.productionPreviewFrame}
        data-size={previewViewport}
        ref={previewFrameRef}
      >
        <div
          className={styles.previewFloatingInspectWidget}
          data-active={inspectMode ? "true" : "false"}
        >
          <button
            aria-pressed={inspectMode}
            className={styles.inspectToggleButton}
            onClick={onToggleInspect}
            title="Select visible website copy to edit"
            type="button"
          >
            <CursorInspectIcon />
            <span>{inspectMode ? "Inspect On" : "Inspect"}</span>
          </button>
          {inspectMode ? (
            <small>Click any highlighted text to edit the mapped content slot.</small>
          ) : null}
        </div>
        <PublicCoachSitePage
          enableTracking={false}
          inspectMode={inspectMode}
          onSelectInspectScope={onSelectInspectScope}
          previewMode
          selectedInspectScope={selectedInspectScope}
          site={site}
          stickyMode="contained"
        />
        {inspectMode && selectedInspectSlot ? (
          <FloatingInspectEditor
            aiSubmitting={aiSubmitting}
            key={`${selectedInspectSlot.slotKey}:${selectedInspectSlot.value}`}
            onApply={onApplyInspectEdit}
            onCancel={() => onClearInspectSelection?.()}
            onRegenerateCopy={onRegenerateCopy}
            positionStyle={inspectEditorStyle}
            slot={selectedInspectSlot}
          />
        ) : inspectMode ? (
          <div className={styles.floatingInspectHint}>
            <span>01</span>
            <strong>Select website text</strong>
            <small>
              Hero, benefits, FAQ, CTA, support, and footer copy are editable content slots.
            </small>
          </div>
        ) : null}
      </div>
    </article>
  );
});

function FloatingInspectEditor({
  aiSubmitting,
  onApply,
  onCancel,
  onRegenerateCopy,
  positionStyle,
  slot
}: {
  aiSubmitting: boolean;
  onApply?: (value: string) => void;
  onCancel: () => void;
  onRegenerateCopy?: (scope: CopyRegenerationScope) => Promise<void>;
  positionStyle?: CSSProperties;
  slot: PreviewInspectSlotConfig;
}) {
  const [draftValue, setDraftValue] = useState(() => slot.value);
  const [error, setError] = useState("");

  function apply() {
    const trimmed = draftValue.trim();
    if (slot.required && !trimmed) {
      setError(`${slot.label} cannot be empty.`);
      return;
    }
    onApply?.(trimmed);
    setError("");
  }

  return (
    <section
      aria-live="polite"
      className={styles.floatingInspectEditor}
      data-positioned={positionStyle ? "true" : "false"}
      style={positionStyle}
    >
      <div className={styles.floatingInspectHeader}>
        <span>{slot.section}</span>
        <strong>{slot.label}</strong>
        <code>{slot.slotKey}</code>
      </div>
      <label>
        <span>{slot.fieldType === "textarea" ? "Content" : "Text"}</span>
        {slot.fieldType === "textarea" ? (
          <textarea value={draftValue} onChange={(event) => setDraftValue(event.target.value)} />
        ) : (
          <input value={draftValue} onChange={(event) => setDraftValue(event.target.value)} />
        )}
      </label>
      {error ? <p className={styles.inlineError}>{error}</p> : null}
      <div className={styles.inspectSlotMeta}>
        <small>Validation: {slot.validationRule}</small>
        <small>Fallback: {slot.fallbackRule}</small>
      </div>
      <div className={styles.floatingInspectActions}>
        <button className={styles.primaryAction} onClick={apply} type="button">
          Apply
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          disabled={aiSubmitting}
          onClick={() => void onRegenerateCopy?.(slot.aiRegenerationScope)}
          type="button"
        >
          {aiSubmitting
            ? "Regenerating..."
            : `Regenerate ${getCopyScopeLabel(slot.aiRegenerationScope)}`}
        </button>
      </div>
    </section>
  );
}

function TextField({
  helper,
  label,
  onChange,
  required = false,
  sanitizeMode,
  type = "text",
  value
}: {
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  sanitizeMode?: "email" | "phone" | "url";
  type?: "email" | "text" | "url";
  value: string;
}) {
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    if (!sanitizeMode) return;
    const pasted = event.clipboardData.getData("text");
    const sanitized = sanitizeSingleFieldPaste(pasted, sanitizeMode, value);
    event.preventDefault();
    if (sanitized === null) return;
    onChange(sanitized);
  }

  return (
    <label className={styles.compactField}>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        onPaste={handlePaste}
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

function sanitizeSingleFieldPaste(
  pasted: string,
  mode: "email" | "phone" | "url",
  currentValue: string
) {
  const raw = pasted.trim();
  if (!raw) return "";

  if (mode === "url") {
    const matches = raw.match(/https:\/\/(?:(?!https?:\/\/)[^\s,;])+/gi) || [];
    const unique = Array.from(new Set(matches.map((item) => item.trim())));
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return null;
    return raw;
  }

  if (mode === "email") {
    const matches = raw.match(/[^\s,;@]+@[^\s,;@]+\.[^\s,;@]+/gi) || [];
    const unique = Array.from(new Set(matches.map((item) => item.trim().toLowerCase())));
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return null;
    return raw.toLowerCase();
  }

  const digits = raw.replace(/\D/g, "");
  const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const currentDigits = currentValue.replace(/\D/g, "");
  const normalizedCurrent =
    currentDigits.length === 12 && currentDigits.startsWith("91")
      ? currentDigits.slice(2)
      : currentDigits;
  if (normalized.length === 10 && normalized === normalizedCurrent) return normalized;
  if (normalized.length === 10) return normalized;
  return null;
}

function CoachImageResultPanel({
  activeUrl,
  disabled,
  media,
  onReset,
  onUse
}: {
  activeUrl: string;
  disabled: boolean;
  media: CoachImageMediaResult;
  onReset: () => void;
  onUse: (url: string | undefined, label: "cutout" | "original") => void;
}) {
  const hasCutout = Boolean(media.cutoutUrl);

  return (
    <div className={styles.imageResultPanel} data-status={media.processingStatus || "unknown"}>
      <div>
        <strong>{getCoachImageResultTitle(media)}</strong>
        <span>{getCoachImageResultDescription(media)}</span>
      </div>
      <div className={styles.imageResultActions}>
        {hasCutout ? (
          <button
            data-active={activeUrl === media.cutoutUrl ? "true" : undefined}
            disabled={disabled}
            onClick={() => onUse(media.cutoutUrl, "cutout")}
            type="button"
          >
            Use cutout
          </button>
        ) : null}
        {media.originalUrl ? (
          <button
            data-active={activeUrl === media.originalUrl ? "true" : undefined}
            disabled={disabled}
            onClick={() => onUse(media.originalUrl, "original")}
            type="button"
          >
            Use original frame
          </button>
        ) : null}
        <button disabled={disabled} onClick={onReset} type="button">
          Reset image
        </button>
      </div>
    </div>
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

function isAllowedVideoFile(file: File) {
  const contentType = file.type.trim().toLowerCase();
  const extension = getClientFileExtension(file.name);

  if (ALLOWED_VIDEO_MIME_TYPES.has(contentType)) return true;

  return (
    Boolean(extension) &&
    ALLOWED_VIDEO_EXTENSIONS.has(extension) &&
    (contentType === "" ||
      contentType === "application/octet-stream" ||
      contentType.startsWith("video/"))
  );
}

function getClientFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

function getCoachImageUploadMessage(
  media: NonNullable<MediaUploadApiPayload["media"]>,
  file?: File
) {
  if (media.processingStatus === "cutout_ready") {
    return `Coach photo is ready${media.sizeBytes || file?.size ? ` (${formatBytes(media.sizeBytes || file?.size || 0)})` : ""}.`;
  }

  if (media.processingStatus === "not_configured") {
    return "Photo uploaded, but the transparent cutout was not created. Upload a clearer photo and try again.";
  }

  if (media.safeMessage) {
    return media.safeMessage;
  }

  return `Coach photo uploaded${file?.size ? ` (${formatBytes(file.size)})` : ""}.`;
}

function getCoachImageAdminActivityMessage(
  media: NonNullable<MediaUploadApiPayload["media"]>,
  file?: File
) {
  if (media.processingStatus === "cutout_ready") {
    return file
      ? `${file.name} coach photo cutout processed and saved.`
      : "Coach photo cutout processed and saved.";
  }

  if (media.processingStatus === "not_configured") {
    return file
      ? `${file.name} uploaded, but the transparent cutout was not created.`
      : "Coach photo uploaded, but the transparent cutout was not created.";
  }

  return file ? `${file.name} coach photo uploaded.` : "Coach photo uploaded.";
}

function getCoachImageResultTitle(media: CoachImageMediaResult) {
  if (media.processingStatus === "cutout_ready") return "Cutout ready";
  if (media.processingStatus === "framed_fallback") return "Original frame active";
  if (media.processingStatus === "not_configured") return "Cutout not created";
  if (media.processingStatus === "disabled") return "Original uploaded";
  return "Coach photo uploaded";
}

function getCoachImageResultDescription(media: CoachImageMediaResult) {
  if (media.processingStatus === "cutout_ready") {
    return "A transparent coach photo is saved. You can still switch back to the original photo.";
  }

  if (media.safeMessage) return media.safeMessage;

  return "The original photo is stored for this coach site.";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(2)} MB`;
}
