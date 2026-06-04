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
  | "hero"
  | "intro"
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
  const problemPoints = createProblemPoints(site);
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
      data-preview={previewMode ? "true" : "false"}
      data-theme={theme.id}
      id="top"
      style={themeStyle}
    >
      <div className={styles.auroraLayer} aria-hidden="true" />
      {previewMode ? null : (
        <StickyRegisterAction onMissingRegisterLink={showMissingRegisterFallback} site={site} />
      )}

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
            <span>YW Nutritech coach network</span>
            <span>Education-first wellness pathway</span>
          </div>
          <p className={styles.kicker}>{site.niche}</p>
          <h1>{site.content.heroHeadline}</h1>
          <p className={styles.lead}>{site.content.subheadline}</p>
          <div className={styles.brandAssurance}>
            <span>YW care lens</span>
            <strong>Nutrition, habits, lifestyle, education</strong>
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
                <span>Coach</span>
                <strong>{site.coachName}</strong>
                <small>{site.niche}</small>
              </div>
            </div>
            <div className={styles.signalPanel}>
              <span>YW Nutritech lens</span>
              <strong>Coach-led wellness pathway</strong>
              <small>Built for education-first nutrition and lifestyle support</small>
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
          <span>Coach Introduction</span>
          <h2>Personal coach guidance inside a premium wellness-tech ecosystem.</h2>
        </div>
        <div className={styles.introGrid}>
          <TemplateCard
            className={previewMode ? styles.previewInspectable : ""}
            spotlightColor="rgba(216, 181, 111, 0.24)"
            {...getPreviewInspectProps("intro")}
          >
            {renderInspectHotspot("intro")}
            <span>Who the coach is</span>
            <h3>{site.coachName}</h3>
            <p>{site.content.coachIntro}</p>
          </TemplateCard>
          <TemplateCard
            className={previewMode ? styles.previewInspectable : ""}
            spotlightColor="rgba(200, 184, 255, 0.24)"
            {...getPreviewInspectProps("vision")}
          >
            {renderInspectHotspot("vision")}
            <span>Coach mission</span>
            <h3>{site.location || "Yours Wellness Coach"}</h3>
            <p>{site.content.visionText || site.vision}</p>
          </TemplateCard>
        </div>
      </section>

      <section className={`${styles.section} ${styles.problemSection}`}>
        <div className={styles.problemCopy}>
          <span>Problem to solution</span>
          <h2>For guests who need direction before committing to a bigger program.</h2>
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

      <section className={`${styles.section} ${styles.journeySection}`} id="journey">
        <div className={styles.sectionHead}>
          <span>YW Nutritech pathway</span>
          <h2>One page that moves from trust to action.</h2>
        </div>
        <div className={styles.journeyGrid}>
          <TemplateCard spotlightColor="rgba(183, 93, 120, 0.16)">
            <small>01</small>
            <span>Profile</span>
            <h3>Meet the coach</h3>
            <p>Guests first understand the coach story, niche, mission, and guidance style.</p>
          </TemplateCard>
          <TemplateCard spotlightColor="rgba(183, 93, 120, 0.16)">
            <small>02</small>
            <span>Focus</span>
            <h3>See the wellness focus</h3>
            <p>The page explains the coach lens in a clear, trustworthy tone.</p>
          </TemplateCard>
          <TemplateCard spotlightColor="rgba(183, 93, 120, 0.16)">
            <small>03</small>
            <span>Action</span>
            <h3>Open the registration step</h3>
            <p>The CTA sends visitors to the coach registration form when configured.</p>
          </TemplateCard>
        </div>
      </section>

      <section
        className={getPreviewInspectClassName(`${styles.section} ${styles.benefitsSection}`)}
        id="benefits"
        {...getPreviewInspectProps("benefits")}
      >
        {renderInspectHotspot("benefits")}
        <div className={styles.sectionHead}>
          <span>Benefits</span>
          <h2>Clean nutrition-tech cards without clutter.</h2>
        </div>
        <div className={styles.benefitGrid}>
          {site.content.benefits.map((benefit, index) => (
            <TemplateCard key={benefit} spotlightColor="rgba(200, 184, 255, 0.22)">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{benefit}</h3>
              <p>Coach-led education designed to make the next step calmer and clearer.</p>
            </TemplateCard>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.mediaSection}`}>
        <div className={styles.videoFrame} data-media={site.heroMediaType || "none"}>
          <HeroMediaContent heroMedia={heroMedia} site={site} compact />
          <span>Coach media module</span>
          <strong>Coach image / video-ready area</strong>
          <p>Media stays inside the fixed YW Nutritech template while keeping the coach visible.</p>
        </div>
        <div className={styles.mediaNotes}>
          <span>YW Nutritech ready</span>
          <h2>Image, video, and no-media states stay consistent.</h2>
          <p>
            Each coach can feel individual without leaving the premium YW Nutritech visual system.
          </p>
        </div>
      </section>

      <section
        className={getPreviewInspectClassName(`${styles.section} ${styles.registerSection}`)}
        id="register"
        {...getPreviewInspectProps("cta")}
      >
        {renderInspectHotspot("cta")}
        <div>
          <span>Register</span>
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
          <span>FAQ</span>
          <h2>Clean answers before registration.</h2>
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

      <footer className={styles.footer}>
        <div>
          <span>YW Nutritech Coach Referral</span>
          <h2>A refined wellness-tech template that keeps the coach at the center.</h2>
          <p>
            This page is for wellness education and lifestyle coaching support. It is not a
            substitute for medical advice, diagnosis, or treatment.
          </p>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refund Policy</Link>
          <Link href="/disclaimer">Disclaimer</Link>
        </div>
      </footer>
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
    case "hero":
      return "Hero";
    case "intro":
      return "Coach Intro";
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
            <Link
              data-active={theme.id === activeThemeId ? "true" : "false"}
              href={`/coach-template-preview?theme=${theme.id}`}
              key={theme.id}
              prefetch={false}
            >
              {theme.previewLabel}
            </Link>
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
  return (
    <RegisterAction
      className={styles.stickyRegister}
      onMissingRegisterLink={onMissingRegisterLink}
      site={site}
    >
      {site.registerButtonText || "Register Now"}
    </RegisterAction>
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
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
