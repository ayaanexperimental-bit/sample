"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useEffect } from "react";

import type { PublicCoachSiteRecord } from "../../lib/admin-coach-sites";
import {
  coachTemplateThemes,
  getCoachTemplateCssVariables,
  getCoachTemplateTheme,
  type CoachTemplateThemeId
} from "../../lib/coach-template-themes";
import { DEFAULT_SUPPORT_EMAIL } from "../../lib/error-reporting";
import { isUploadedVideoSource, normalizeVideoEmbedUrl } from "../../lib/video-links";
import { SpotlightCard } from "./spotlight-card";
import styles from "./public-coach-site-page.module.css";

type PublicCoachSitePageProps = {
  enableTracking?: boolean;
  forcedThemeId?: CoachTemplateThemeId;
  previewMode?: boolean;
  site: PublicCoachSiteRecord;
};

const DEFAULT_SUPPORT_NAME = "Yours Wellness Support";
const DEFAULT_SUPPORT_TEXT = "Need help? Contact Yours Wellness support.";

export function PublicCoachSitePage({
  enableTracking = true,
  forcedThemeId,
  previewMode = false,
  site
}: PublicCoachSitePageProps) {
  const referenceId = createCoachFallbackReferenceId(site.slug);
  const theme = getCoachTemplateTheme(forcedThemeId || site.selectedThemeId);
  const themeStyle = getCoachTemplateCssVariables(theme.id) as CSSProperties;
  const hasRegisterLink = Boolean(site.googleFormUrl);
  const heroMedia = getHeroMedia(site);
  const problemPoints = createProblemPoints(site);

  useEffect(() => {
    if (enableTracking) {
      void recordCoachEvent("coach_site_view", site.slug);
    }
  }, [enableTracking, site.slug]);

  if (site.status === "paused") {
    return (
      <main className={styles.page} data-theme={theme.id} style={themeStyle}>
        <div className={styles.auroraLayer} aria-hidden="true" />
        <section className={styles.unavailablePanel}>
          <p className={styles.kicker}>Coach Page</p>
          <h1>This coach page is temporarily unavailable.</h1>
          <p>The public link remains stable. Please contact support if you need help.</p>
          <CoachContactSupport referenceId={referenceId} site={site} tone="compact" />
        </section>
      </main>
    );
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
      <StickyRegisterAction site={site} />

      {previewMode ? <ThemePreviewSwitcher activeThemeId={theme.id} /> : null}

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
        <RegisterAction className={styles.navCta} site={site}>
          {site.registerButtonText || site.content.ctaText || "Register"}
        </RegisterAction>
      </nav>

      <section className={styles.hero} data-media={site.heroMediaType || "image"}>
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
            <RegisterAction site={site}>
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
          <TemplateCard spotlightColor="rgba(216, 181, 111, 0.24)">
            <span>Who the coach is</span>
            <h3>{site.coachName}</h3>
            <p>{site.content.coachIntro}</p>
          </TemplateCard>
          <TemplateCard spotlightColor="rgba(200, 184, 255, 0.24)">
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

      <section className={`${styles.section} ${styles.benefitsSection}`} id="benefits">
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

      <section className={`${styles.section} ${styles.registerSection}`} id="register">
        <div>
          <span>Register</span>
          <h2>{site.content.ctaText || "Ready to take the first step with this coach?"}</h2>
          <p>{site.content.trustText}</p>
        </div>
        <RegisterAction site={site}>{site.registerButtonText || "Register Now"}</RegisterAction>
      </section>

      <section className={`${styles.section} ${styles.faqSection}`}>
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
    <main
      className={styles.page}
      data-theme={getCoachTemplateTheme(site?.selectedThemeId).id}
      style={getCoachTemplateCssVariables(site?.selectedThemeId) as CSSProperties}
    >
      <div className={styles.auroraLayer} aria-hidden="true" />
      <section className={styles.unavailablePanel}>
        <p className={styles.kicker}>Contact Support</p>
        <h1>Something went wrong</h1>
        <p>We could not complete this step. Please contact support for help.</p>
        <CoachContactSupport referenceId={referenceId} site={site} tone="compact" />
        {reset ? (
          <button className={styles.retryButton} onClick={reset} type="button">
            Try Again
          </button>
        ) : null}
      </section>
    </main>
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
  spotlightColor
}: {
  children: ReactNode;
  spotlightColor: string;
}) {
  return (
    <SpotlightCard as="article" className={styles.card} spotlightColor={spotlightColor}>
      {children}
    </SpotlightCard>
  );
}

function ThemePreviewSwitcher({ activeThemeId }: { activeThemeId: CoachTemplateThemeId }) {
  return (
    <div className={styles.themeSwitcher} aria-label="Choose Template Theme">
      <span>Choose Template Theme</span>
      <div>
        {coachTemplateThemes.map((theme) => (
          <Link
            data-active={theme.id === activeThemeId ? "true" : "false"}
            href={`/coach-template-preview?theme=${theme.id}`}
            key={theme.id}
            prefetch={false}
          >
            {theme.previewLabel}
          </Link>
        ))}
      </div>
    </div>
  );
}

function StickyRegisterAction({ site }: { site: PublicCoachSiteRecord }) {
  return (
    <RegisterAction className={styles.stickyRegister} site={site}>
      {site.registerButtonText || "Register Now"}
    </RegisterAction>
  );
}

function RegisterAction({
  children,
  className,
  site
}: {
  children: ReactNode;
  className?: string;
  site: PublicCoachSiteRecord;
}) {
  if (!site.googleFormUrl) {
    return (
      <span
        aria-disabled="true"
        className={className || styles.primaryAction}
        data-disabled="true"
        role="link"
      >
        Registration link pending
      </span>
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
  if (heroMedia.embedVideoUrl) {
    return (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        src={heroMedia.embedVideoUrl}
        title={`${site.coachName} hero video`}
      />
    );
  }

  if (heroMedia.uploadedVideoUrl) {
    return <video controls src={heroMedia.uploadedVideoUrl} title={`${site.coachName} hero video`} />;
  }

  if (heroMedia.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={`${site.coachName} profile`} src={heroMedia.imageUrl} />
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

export function createCoachFallbackReferenceId(slug: string) {
  const suffix = slug
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");

  // TODO: Replace this deterministic placeholder with a logged error_reports reference id.
  return `ERR-20260601-${suffix}`;
}

async function recordCoachEvent(eventName: string, coachSlug: string) {
  try {
    await fetch("/api/coach-events", {
      body: JSON.stringify({
        coachSlug,
        eventName,
        pagePath: window.location.pathname
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
