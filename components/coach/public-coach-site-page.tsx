"use client";

import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode
} from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ContactSupportFallback } from "../support/contact-support-fallback";
import type { PublicCoachSiteRecord } from "../../lib/admin-coach-sites";
import {
  coachTemplateThemes,
  getCoachTemplateCssVariables,
  getCoachTemplateTheme,
  type CoachTemplateThemeId
} from "../../lib/coach-template-themes";
import {
  DEFAULT_SUPPORT_EMAIL,
  createSupportErrorReference,
  getPublicSupportErrorCode,
  logWebsiteError,
  type PublicWebsiteErrorCategory
} from "../../lib/error-reporting";
import { isUploadedVideoSource, normalizeVideoEmbedUrl } from "../../lib/video-links";
import { SpotlightCard } from "./spotlight-card";
import styles from "./public-coach-site-page.module.css";

type PublicCoachSitePageProps = {
  enableTracking?: boolean;
  forcedThemeId?: CoachTemplateThemeId;
  inspectMode?: boolean;
  onPreviewThemeChange?: (value: CoachTemplateThemeId) => void;
  onSelectInspectScope?: (value: CoachTemplatePreviewInspectSection) => void;
  previewMode?: boolean;
  selectedInspectScope?: CoachTemplatePreviewInspectSection | null;
  showThemeSwitcher?: boolean;
  site: PublicCoachSiteRecord;
};

export type CoachTemplatePreviewInspectSection =
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

const DEFAULT_SUPPORT_NAME = "Yours Wellness Support";
const DEFAULT_SUPPORT_TEXT = "Need help? Contact Yours Wellness support.";

export function PublicCoachSitePage({
  enableTracking = true,
  forcedThemeId,
  inspectMode = false,
  onPreviewThemeChange,
  onSelectInspectScope,
  previewMode = false,
  selectedInspectScope = null,
  showThemeSwitcher = true,
  site
}: PublicCoachSitePageProps) {
  const referenceId = createCoachFallbackReferenceId(site.slug);
  const theme = getCoachTemplateTheme(forcedThemeId || site.selectedThemeId);
  const themeStyle = getCoachTemplateCssVariables(theme.id) as CSSProperties;
  const hasRegisterLink = Boolean(site.googleFormUrl);
  const heroMedia = getHeroMedia(site);
  const benefitDescriptions = getBenefitDescriptions(site);
  const journeySteps = getJourneySteps(site);
  const problemPoints = getProblemPoints(site);
  const [activeFallback, setActiveFallback] = useState<{
    category: PublicWebsiteErrorCategory;
    message: string;
    referenceId: string;
    safeMessage: string;
    userAction: string;
  } | null>(null);

  useEffect(() => {
    if (enableTracking) {
      void recordCoachEvent("coach_site_view", site.slug);
    }
  }, [enableTracking, site.slug]);

  if (site.status === "paused" || site.status === "archived") {
    return (
      <ContactSupportFallback
        category="coach_site_issue"
        coachSlug={site.slug}
        contact={getFallbackSupportContact(site)}
        message="This coach page is temporarily unavailable. Please contact support for help."
        referenceId={referenceId}
        safeMessage={
          site.status === "archived" ? "Coach page is archived." : "Coach page is paused."
        }
        userAction={site.status === "archived" ? "coach_site_archived" : "coach_site_paused"}
      />
    );
  }

  if (activeFallback && !previewMode) {
    return (
      <ContactSupportFallback
        category={activeFallback.category}
        coachSlug={site.slug}
        contact={getFallbackSupportContact(site)}
        message={activeFallback.message}
        referenceId={activeFallback.referenceId}
        safeMessage={activeFallback.safeMessage}
        userAction={activeFallback.userAction}
      />
    );
  }

  function showMissingRegisterFallback() {
    setActiveFallback({
      category: "link_missing",
      message: "We could not open the registration step. Please contact support for help.",
      referenceId: createSupportErrorReference("link_missing", site.slug),
      safeMessage: "Google Form registration link missing.",
      userAction: "coach_register_link_missing"
    });
  }

  function getPreviewInspectProps(scope: CoachTemplatePreviewInspectSection) {
    const selected = selectedInspectScope === scope;

    if (!previewMode) return {};

    const shared = {
      "data-selected": selected ? "true" : "false"
    };

    if (!inspectMode) return shared;

    return {
      ...shared,
      "aria-label": `Select ${getPreviewInspectLabel(scope)} for regeneration`,
      "data-inspect-mode": "true",
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
      role: "button" as const,
      tabIndex: 0
    };
  }

  function getPreviewInspectClassName(className: string) {
    if (!previewMode) return className;

    return `${className} ${styles.previewInspectable}`;
  }

  function renderInspectHotspot(scope: CoachTemplatePreviewInspectSection) {
    if (!previewMode || !inspectMode) return null;

    return <span className={styles.inspectHotspot}>{getPreviewInspectLabel(scope)}</span>;
  }

  return (
    <main
      className={styles.page}
      data-coach-site-page={previewMode ? "preview" : "public"}
      data-preview={previewMode ? "true" : "false"}
      data-theme={theme.id}
      id="top"
      style={themeStyle}
    >
      <div className={styles.auroraLayer} aria-hidden="true" />

      {previewMode && showThemeSwitcher ? (
        <ThemePreviewSwitcher activeThemeId={theme.id} onThemeChange={onPreviewThemeChange} />
      ) : null}

      <nav className={styles.nav} aria-label="Coach page navigation">
        <Link className={styles.brand} href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="YW Nutritech" src="/images/yw-nutritech-logo.png" />
          <span>
            <strong>YW Nutritech</strong>
            <small>Coach Referral</small>
          </span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="#journey">Journey</Link>
          <Link href="#benefits">Benefits</Link>
        </div>
        <RegisterAction
          className={styles.navCta}
          onMissingRegisterLink={showMissingRegisterFallback}
          site={site}
        >
          {site.registerButtonText || site.content.ctaText || "Register"}
        </RegisterAction>
      </nav>

      <section
        className={getPreviewInspectClassName(styles.hero)}
        data-media={site.heroMediaType || "image"}
        {...getPreviewInspectProps("hero")}
      >
        {renderInspectHotspot("hero")}
        <div className={styles.heroCopy}>
          <div className={styles.trustRow}>
            <span>{site.content.brandBadge}</span>
            <span>{site.content.brandEyebrow}</span>
          </div>
          <p className={styles.kicker}>{site.niche}</p>
          <h1>{site.content.heroHeadline}</h1>
          <p className={styles.lead}>{site.content.subheadline}</p>
          <div className={styles.brandAssurance}>
            <span>{site.content.heroTrustLine}</span>
            <strong>{site.content.heroMicroTrustText}</strong>
          </div>
          <div className={styles.heroActions}>
            <RegisterAction onMissingRegisterLink={showMissingRegisterFallback} site={site}>
              {site.registerButtonText || site.content.ctaText || "Register Now"}
            </RegisterAction>
          </div>
        </div>

        {site.heroMediaType !== "none" ? (
          <div className={styles.mediaStage}>
            <div className={styles.heroMedia} data-media={site.heroMediaType || "image"}>
              <HeroMediaContent heroMedia={heroMedia} site={site} />
              <div className={styles.mediaCaption}>
                <span>{site.content.heroMediaLabel}</span>
                <strong>{site.coachName}</strong>
                <small>{site.niche}</small>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <dl className={styles.heroMetrics}>
        <div>
          <dt>Coach</dt>
          <dd>{site.coachName}</dd>
        </div>
        <div>
          <dt>Niche</dt>
          <dd>{site.niche}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{site.location || "Yours Wellness"}</dd>
        </div>
        <div>
          <dt>Referral action</dt>
          <dd>{hasRegisterLink ? "Google Form registration" : "Registration link pending"}</dd>
        </div>
      </dl>

      <section className={`${styles.section} ${styles.introSection}`}>
        <div className={styles.sectionHead}>
          <span>{site.content.introSectionLabel}</span>
          <h2>{site.content.introHeading}</h2>
        </div>
        <div className={styles.introGrid}>
          <TemplateCard
            className={previewMode ? styles.previewInspectable : ""}
            spotlightColor="rgba(216, 181, 111, 0.24)"
            {...getPreviewInspectProps("intro")}
          >
            {renderInspectHotspot("intro")}
            <span>{site.content.coachIntroLabel}</span>
            <h3>{site.coachName}</h3>
            <p>{site.content.coachIntro}</p>
          </TemplateCard>
          <TemplateCard
            className={previewMode ? styles.previewInspectable : ""}
            spotlightColor="rgba(200, 184, 255, 0.24)"
            {...getPreviewInspectProps("vision")}
          >
            {renderInspectHotspot("vision")}
            <span>{site.content.visionLabel}</span>
            <h3>{site.location || "Yours Wellness Coach"}</h3>
            <p>{site.content.visionText || site.vision}</p>
          </TemplateCard>
        </div>
      </section>

      <section
        className={getPreviewInspectClassName(`${styles.section} ${styles.problemSection}`)}
        {...getPreviewInspectProps("problem")}
      >
        {renderInspectHotspot("problem")}
        <div className={styles.problemCopy}>
          <span>{site.content.problemSectionLabel}</span>
          <h2>{site.content.problemHeading}</h2>
          <p>{site.content.trustText}</p>
        </div>
        <div className={styles.problemList}>
          {problemPoints.map((point) => (
            <TemplateCard key={point} spotlightColor="rgba(242, 210, 138, 0.18)">
              <span aria-hidden="true">+</span>
              <p>{point}</p>
            </TemplateCard>
          ))}
        </div>
      </section>

      <section
        className={getPreviewInspectClassName(`${styles.section} ${styles.journeySection}`)}
        id="journey"
        {...getPreviewInspectProps("journey")}
      >
        {renderInspectHotspot("journey")}
        <div className={styles.sectionHead}>
          <span>{site.content.journeySectionLabel}</span>
          <h2>{site.content.journeyHeading}</h2>
        </div>
        <div className={styles.journeyGrid}>
          {journeySteps.map((step, index) => (
            <TemplateCard key={`${step.label}-${step.title}`} spotlightColor="rgba(183, 93, 120, 0.16)">
              <small>{String(index + 1).padStart(2, "0")}</small>
              <span>{step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </TemplateCard>
          ))}
        </div>
      </section>

      <section
        className={getPreviewInspectClassName(`${styles.section} ${styles.benefitsSection}`)}
        id="benefits"
        {...getPreviewInspectProps("benefits")}
      >
        {renderInspectHotspot("benefits")}
        <div className={styles.sectionHead}>
          <span>{site.content.benefitsSectionLabel}</span>
          <h2>{site.content.benefitsHeading}</h2>
        </div>
        <div className={styles.benefitGrid}>
          {site.content.benefits.map((benefit, index) => (
            <TemplateCard key={benefit} spotlightColor="rgba(200, 184, 255, 0.22)">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{benefit}</h3>
              <p>{benefitDescriptions[index] || benefitDescriptions[0]}</p>
            </TemplateCard>
          ))}
        </div>
      </section>

      <section
        className={getPreviewInspectClassName(`${styles.section} ${styles.registerSection}`)}
        id="register"
        {...getPreviewInspectProps("cta")}
      >
        {renderInspectHotspot("cta")}
        <div>
          <span>{site.content.ctaSectionLabel}</span>
          <h2>{site.content.ctaText || "Ready to take the first step with this coach?"}</h2>
          <p>{site.content.trustText}</p>
        </div>
        <RegisterAction onMissingRegisterLink={showMissingRegisterFallback} site={site}>
          {site.registerButtonText || "Register Now"}
        </RegisterAction>
      </section>

      <section
        className={getPreviewInspectClassName(`${styles.section} ${styles.faqSection}`)}
        {...getPreviewInspectProps("faq")}
      >
        {renderInspectHotspot("faq")}
        <div className={styles.sectionHead}>
          <span>{site.content.faqSectionLabel}</span>
          <h2>{site.content.faqHeading}</h2>
        </div>
        <div className={styles.faqList}>
          {site.content.faq.map((item) => (
            <details className={styles.card} key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <CoachContactSupport referenceId={referenceId} site={site} />

      <footer
        className={getPreviewInspectClassName(styles.footer)}
        {...getPreviewInspectProps("footer")}
      >
        {renderInspectHotspot("footer")}
        <div>
          <span>{site.content.footerBrandLine}</span>
          <h2>{site.content.footerHeadline}</h2>
          <p>{site.content.footerText}</p>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refund Policy</Link>
          <Link href="/disclaimer">Disclaimer</Link>
        </div>
      </footer>

      <StickyRegisterAction onMissingRegisterLink={showMissingRegisterFallback} site={site} />
    </main>
  );
}

export function CoachRouteErrorFallback({
  referenceId,
  reset,
  site
}: {
  referenceId: string;
  reset?: () => void;
  site: PublicCoachSiteRecord | null;
}) {
  return (
    <ContactSupportFallback
      category="coach_site_issue"
      coachSlug={site?.slug}
      contact={getFallbackSupportContact(site)}
      onReset={reset}
      referenceId={referenceId}
      safeMessage="Coach page could not load properly."
      userAction="coach_page_render"
    />
  );
}

export function CoachContactSupport({
  referenceId,
  site,
  tone = "standard"
}: {
  referenceId: string;
  site: PublicCoachSiteRecord | null;
  tone?: "compact" | "embedded" | "standard";
}) {
  const support = getSupportDetails(site);

  return (
    <section className={styles.coachSupport} data-tone={tone} id="coach-contact-support">
      <SpotlightCard className={styles.supportCard} spotlightColor="rgba(242, 185, 166, 0.2)">
        <div className={styles.supportIdentity}>
          <div className={styles.supportAvatar}>
            {support.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${support.name} support profile`} src={support.imageUrl} />
            ) : (
              <span>{support.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className={styles.kicker}>Contact Support</p>
            <h2>{support.name}</h2>
            <p>{support.text}</p>
          </div>
        </div>

        <div className={styles.supportCredentialGrid}>
          {support.phone ? (
            <a href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}>
              <span>Phone</span>
              <strong>{support.phone}</strong>
            </a>
          ) : null}
          {support.whatsappLink ? (
            <a href={support.whatsappLink} rel="noreferrer" target="_blank">
              <span>WhatsApp</span>
              <strong>Message coach</strong>
            </a>
          ) : null}
          <a href={support.emailHref}>
            <span>Email</span>
            <strong>{support.email}</strong>
          </a>
        </div>

        {tone !== "standard" ? (
          <div className={styles.supportActions}>
            <a href={support.primaryHref}>Contact Support</a>
            <Link href="/">Go Back Home</Link>
          </div>
        ) : null}
        <p className={styles.supportPrivacyNote}>
          Contact details shown here are public coach-site support details, not admin-only data.
          {referenceId ? ` Reference ID: ${referenceId}` : ""}
        </p>
      </SpotlightCard>
    </section>
  );
}

function TemplateCard({
  children,
  className = "",
  spotlightColor,
  ...rest
}: {
  children: ReactNode;
  spotlightColor: string;
} & ComponentPropsWithoutRef<"article">) {
  const cardClassName = `${styles.card} ${className}`.trim();

  return (
    <SpotlightCard
      as="article"
      className={cardClassName}
      spotlightColor={spotlightColor}
      {...rest}
    >
      {children}
    </SpotlightCard>
  );
}

function getPreviewInspectLabel(scope: CoachTemplatePreviewInspectSection) {
  switch (scope) {
    case "benefits":
      return "Benefits";
    case "cta":
      return "CTA";
    case "faq":
      return "FAQ";
    case "footer":
      return "Footer";
    case "hero":
      return "Hero";
    case "intro":
      return "Coach Intro";
    case "journey":
      return "Journey";
    case "media":
      return "Media";
    case "problem":
      return "Problem";
    case "vision":
      return "Mission";
    default:
      return "Section";
  }
}

function ThemePreviewSwitcher({
  activeThemeId,
  onThemeChange
}: {
  activeThemeId: CoachTemplateThemeId;
  onThemeChange?: (value: CoachTemplateThemeId) => void;
}) {
  return (
    <div className={styles.themeSwitcher} aria-label="Choose Template Theme">
      <span>Choose Template Theme</span>
      <div>
        {coachTemplateThemes.map((theme) =>
          onThemeChange ? (
            <button
              data-active={theme.id === activeThemeId ? "true" : "false"}
              key={theme.id}
              onClick={() => onThemeChange(theme.id)}
              type="button"
            >
              {theme.previewLabel}
            </button>
          ) : (
            <a
              data-active={theme.id === activeThemeId ? "true" : "false"}
              href={`/coach-template-preview?theme=${theme.id}`}
              key={theme.id}
            >
              {theme.previewLabel}
            </a>
          )
        )}
      </div>
    </div>
  );
}

function StickyRegisterAction({
  onMissingRegisterLink,
  site
}: {
  onMissingRegisterLink?: () => void;
  site: PublicCoachSiteRecord;
}) {
  const support = getSupportDetails(site);
  const hasCoachContact = support.name !== DEFAULT_SUPPORT_NAME;

  return (
    <aside className={styles.stickyCoachCta} aria-label="Coach registration">
      <div className={styles.stickyCoachContext}>
        <span>Free guest registration</span>
        <strong>Ready to connect with Coach {site.coachName}?</strong>
        <small>{site.niche || "Coach referral"} through YW Nutritech</small>
      </div>
      <div className={styles.stickyCoachActions}>
        <RegisterAction
          className={styles.stickyCoachRegister}
          onMissingRegisterLink={onMissingRegisterLink}
          site={site}
        >
          {site.registerButtonText || "Register Now"}
        </RegisterAction>
        {hasCoachContact ? (
          <a
            className={styles.stickyCoachContact}
            href={support.primaryHref}
            onClick={
              support.whatsappLink
                ? () => void recordCoachEvent("coach_whatsapp_click", site.slug)
                : undefined
            }
            rel="noreferrer"
            target={
              support.primaryHref.startsWith("mailto:") || support.primaryHref.startsWith("tel:")
                ? undefined
                : "_blank"
            }
          >
            Contact Coach
          </a>
        ) : null}
      </div>
    </aside>
  );
}

function RegisterAction({
  children,
  className,
  onMissingRegisterLink,
  site
}: {
  children: ReactNode;
  className?: string;
  onMissingRegisterLink?: () => void;
  site: PublicCoachSiteRecord;
}) {
  if (!site.googleFormUrl) {
    return (
      <button
        className={className || styles.primaryAction}
        data-missing-link="true"
        onClick={() => {
          void recordCoachEvent("coach_register_missing_link", site.slug);
          onMissingRegisterLink?.();
        }}
        type="button"
      >
        {children}
      </button>
    );
  }

  return (
    <a
      className={className || styles.primaryAction}
      href={site.googleFormUrl}
      onClick={() => void recordCoachEvent("coach_register_click", site.slug)}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function HeroMediaContent({
  compact = false,
  heroMedia,
  site
}: {
  compact?: boolean;
  heroMedia: ReturnType<typeof getHeroMedia>;
  site: PublicCoachSiteRecord;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);

  function handleMediaError() {
    if (mediaFailed) return;

    setMediaFailed(true);
    void logWebsiteError({
      category: "video_issue",
      coachSlug: site.slug,
      errorCode: getPublicSupportErrorCode("video_issue"),
      referenceId: createSupportErrorReference("video_issue", site.slug),
      safeMessage: "Coach media could not load.",
      userAction: "coach_media_load"
    });
  }

  if (mediaFailed) {
    return (
      <div className={styles.mediaError}>
        <span>Media unavailable</span>
        <strong>Coach media could not load right now.</strong>
        <code>{getPublicSupportErrorCode("video_issue")}</code>
      </div>
    );
  }

  if (heroMedia.embedVideoUrl) {
    return (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onError={handleMediaError}
        src={heroMedia.embedVideoUrl}
        title={`${site.coachName} hero video`}
      />
    );
  }

  if (heroMedia.uploadedVideoUrl) {
    return (
      <video
        controls
        onError={handleMediaError}
        src={heroMedia.uploadedVideoUrl}
        title={`${site.coachName} hero video`}
      />
    );
  }

  if (heroMedia.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={`${site.coachName} profile`} onError={handleMediaError} src={heroMedia.imageUrl} />
    );
  }

  if (compact) return null;

  return <span>{site.coachName.slice(0, 2).toUpperCase()}</span>;
}

function getHeroMedia(site: PublicCoachSiteRecord) {
  const heroMediaType = site.heroMediaType || "image";
  const imageUrl = heroMediaType === "image" ? site.photoUrl || site.logoUrl : "";
  const embedVideoUrl = heroMediaType === "video" ? normalizeVideoEmbedUrl(site.videoUrl) : "";
  const uploadedVideoUrl =
    heroMediaType === "video" && isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  return {
    embedVideoUrl,
    imageUrl,
    uploadedVideoUrl
  };
}

function createProblemPoints(site: PublicCoachSiteRecord) {
  return [
    `Too much conflicting ${site.niche || "wellness"} advice`,
    "Unsure what daily routine changes matter first",
    "Need a coach-led starting point before a deeper program",
    "Want education-friendly guidance that can sit alongside medical care"
  ];
}

function getBenefitDescriptions(site: PublicCoachSiteRecord) {
  const descriptions = site.content.benefitDescriptions.filter(Boolean);

  return descriptions.length > 0
    ? descriptions
    : site.content.benefits.map(
        () => "Coach-led education designed to make the next step calmer and clearer."
      );
}

function getJourneySteps(site: PublicCoachSiteRecord) {
  return site.content.journeySteps.length > 0
    ? site.content.journeySteps
    : [
        {
          description:
            "Guests understand the coach story, niche, mission, and guidance style.",
          label: "Profile",
          title: `Meet ${site.coachName || "the coach"}`
        },
        {
          description: "The page explains the coach lens in a clear, trustworthy tone.",
          label: "Focus",
          title: `See the ${site.niche || "wellness"} focus`
        },
        {
          description:
            "The CTA sends visitors to the coach registration form when configured.",
          label: "Action",
          title: "Open registration"
        }
      ];
}

function getProblemPoints(site: PublicCoachSiteRecord) {
  const points = site.content.problemPoints.filter(Boolean);

  return points.length > 0 ? points : createProblemPoints(site);
}

function getSupportDetails(site: PublicCoachSiteRecord | null) {
  const hasCoachContact = Boolean(site?.coachEmail || site?.coachPhone || site?.whatsappLink);
  const email = site?.coachEmail || DEFAULT_SUPPORT_EMAIL;
  const subject = encodeURIComponent(`Coach page support ${site?.slug || "unknown-coach"}`);
  const emailHref = `mailto:${email}?subject=${subject}`;
  const whatsappLink = site?.whatsappLink || "";

  return {
    email,
    emailHref,
    imageUrl: hasCoachContact ? site?.logoUrl || site?.photoUrl || "" : "",
    name: hasCoachContact && site ? site.coachName : DEFAULT_SUPPORT_NAME,
    phone: site?.coachPhone || "",
    primaryHref: whatsappLink || emailHref,
    text:
      site?.supportText ||
      (hasCoachContact ? "Need help? Contact your coach directly." : DEFAULT_SUPPORT_TEXT),
    whatsappLink
  };
}

function getFallbackSupportContact(site: PublicCoachSiteRecord | null) {
  if (!site) return null;

  return {
    email: site.coachEmail,
    imageUrl: site.logoUrl || site.photoUrl,
    name: site.coachName,
    phone: site.coachPhone,
    supportText: site.supportText,
    whatsappLink: site.whatsappLink
  };
}

export function createCoachFallbackReferenceId(
  slug: string,
  category: PublicWebsiteErrorCategory = "coach_site_issue"
) {
  return createSupportErrorReference(category, slug);
}

async function recordCoachEvent(eventName: string, coachSlug: string) {
  try {
    const sessionId = getAnalyticsSessionId();

    await fetch("/api/coach-events", {
      body: JSON.stringify({
        coachSlug,
        eventName,
        pagePath: `${window.location.pathname}${window.location.search}`,
        pageUrl: window.location.href,
        referrer: document.referrer,
        sessionId
      }),
      cache: "no-store",
      headers: {
        "content-type": "application/json"
      },
      keepalive: true,
      method: "POST"
    });
  } catch {
    // Analytics tracking must never block public registration.
  }
}

function getAnalyticsSessionId() {
  try {
    const key = "yw_analytics_session_id";
    const current = window.sessionStorage.getItem(key);
    if (current) return current;

    const next =
      window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36)}`;
    window.sessionStorage.setItem(key, next);

    return next;
  } catch {
    return "";
  }
}
