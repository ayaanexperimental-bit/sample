"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  CANONICAL_COACH_TEMPLATE_ID,
  getCanonicalCoachInitials,
  getCanonicalCoachName,
  getCanonicalCoachNiche,
  getCanonicalHeroDetailCards,
  getCanonicalHeroPackage,
  getCanonicalLegalDisclaimer,
  getCanonicalRegisterLabel,
  getSafeCoachTemplateCopy,
  getNicheAdaptiveBonusSection
} from "../../lib/coach-canonical-template";
import type { PublicCoachSiteRecord } from "../../lib/admin-coach-sites";
import {
  DEFAULT_SUPPORT_EMAIL,
  createSupportErrorReference,
  getPublicSupportErrorCode,
  logWebsiteError,
  type PublicWebsiteErrorCategory
} from "../../lib/error-reporting";
import { isUploadedVideoSource, normalizeVideoEmbedUrl } from "../../lib/video-links";
import { ContactSupportFallback } from "../support/contact-support-fallback";
import styles from "./public-coach-site-page.module.css";

type PublicCoachSitePageProps = {
  enableTracking?: boolean;
  inspectMode?: boolean;
  onSelectInspectScope?: (value: CoachTemplatePreviewInspectTarget) => void;
  previewMode?: boolean;
  selectedInspectScope?: CoachTemplatePreviewInspectTarget | null;
  site: PublicCoachSiteRecord;
  stickyMode?: "page" | "contained";
};

export type CoachTemplatePreviewInspectSection =
  | "benefits"
  | "bonus"
  | "cta"
  | "faq"
  | "footer"
  | "hero"
  | "intro"
  | "journey"
  | "media"
  | "problem"
  | "vision";

export type CoachTemplatePreviewInspectTarget = CoachTemplatePreviewInspectSection | string;

const DEFAULT_SUPPORT_NAME = "Yours Wellness Support";
const DEFAULT_SUPPORT_TEXT = "Need help? Contact Yours Wellness support.";

export function PublicCoachSitePage({
  enableTracking = true,
  inspectMode = false,
  onSelectInspectScope,
  previewMode = false,
  selectedInspectScope = null,
  site,
  stickyMode = "page"
}: PublicCoachSitePageProps) {
  const coachName = getCanonicalCoachName(site);
  const coachNiche = getCanonicalCoachNiche(site);
  const heroMedia = getHeroMedia(site);
  const registerLabel = getCanonicalRegisterLabel(site);
  const support = getSupportDetails(site);
  const bonusSection = getNicheAdaptiveBonusSection(site);
  const heroPackage = useMemo(() => getCanonicalHeroPackage(site), [site]);
  const detailCards = useMemo(() => getCanonicalHeroDetailCards(site), [site]);
  const referenceId = createCoachFallbackReferenceId(site.slug);
  const [activeFallback, setActiveFallback] = useState<{
    category: PublicWebsiteErrorCategory;
    message: string;
    referenceId: string;
    safeMessage: string;
    userAction: string;
  } | null>(null);
  const [floatingCtaVisible, setFloatingCtaVisible] = useState(false);

  useEffect(() => {
    if (enableTracking) {
      void recordCoachEvent("coach_site_view", site.slug);
    }
  }, [enableTracking, site.slug]);

  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const progressBar = document.querySelector<HTMLElement>(".yw-scroll-progress__bar");
    const stickyRegisterCta = document.querySelector<HTMLElement>(".yw-floating-register-cta");
    const stickyRegisterTrigger = document.querySelector<HTMLElement>(".circle-marquee");
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    let ctaIsVisible = false;
    let progressFrame = 0;
    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const observers: IntersectionObserver[] = [];

    function getScrollY() {
      return window.scrollY || root.scrollTop || document.body.scrollTop || 0;
    }

    function updateStickyRegister(currentScroll: number) {
      if (!stickyRegisterCta || !stickyRegisterTrigger) return;

      const triggerTop = stickyRegisterTrigger.getBoundingClientRect().top;
      const footer = document.querySelector<HTMLElement>(".yw-brand-footer");
      const footerTop = footer ? footer.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
      const activationPoint = Math.min(140, window.innerHeight * 0.24);
      const footerIsEntering = footerTop <= window.innerHeight * 0.92;
      const shouldShow = currentScroll > 24 && triggerTop <= activationPoint && !footerIsEntering;

      root.classList.toggle("yw-sticky-register-visible", shouldShow);
      stickyRegisterCta.setAttribute("aria-hidden", shouldShow ? "false" : "true");
      stickyRegisterCta.tabIndex = shouldShow ? 0 : -1;

      if (shouldShow !== ctaIsVisible) {
        ctaIsVisible = shouldShow;
        setFloatingCtaVisible(shouldShow);
      }
    }

    function updateAlliaSectionVars() {
      const hero = document.querySelector<HTMLElement>(".yw-circle-hero");
      const footer = document.querySelector<HTMLElement>(".yw-brand-footer");

      if (hero) {
        const rect = hero.getBoundingClientRect();
        const travel = Math.max(1, rect.height - window.innerHeight * 0.2);
        root.style.setProperty("--yw-hero-progress", clamp(-rect.top / travel).toFixed(4));
      }

      if (footer) {
        const rect = footer.getBoundingClientRect();
        root.style.setProperty(
          "--yw-footer-progress",
          clamp((window.innerHeight - rect.top) / (window.innerHeight + rect.height)).toFixed(4)
        );
      }
    }

    function updateAlliaBackground(scrollTop: number) {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".yw-circle-hero,.yw-story-section,.yw-sales-section,.yw-circle-faq,.yw-brand-footer"
        )
      ).filter((section) => section.offsetHeight > 0);
      if (!sections.length) return;

      const viewportCenter = scrollTop + window.innerHeight / 2;
      const sectionIndex = Math.max(
        0,
        sections.findIndex((section, index) => {
          const top = section.offsetTop;
          const next = sections[index + 1];
          const bottom = next ? next.offsetTop : top + section.offsetHeight;
          return viewportCenter >= top && viewportCenter < bottom;
        })
      );
      const keyframes = [
        ["50%", "50%", "88%", "92%", "#cdf0e8", "#08aaa6", "#153747", "18%", "64%"],
        ["50%", "0%", "112%", "104%", "#cdef63", "#21e6c1", "#d0f5f0", "20%", "66%"],
        ["0%", "50%", "70%", "108%", "#f4f8fa", "#d0f5f0", "#e8f5d6", "15%", "55%"],
        ["50%", "50%", "100%", "100%", "#f4f8fa", "#f4f8fa", "#f4f8fa", "0%", "0%"],
        ["100%", "50%", "112%", "180%", "#d0f5f0", "#d0f5f0", "#e8f5d6", "0%", "0%"]
      ][sectionIndex % 5];
      const names = [
        "--yw-grad-x",
        "--yw-grad-y",
        "--yw-grad-size-x",
        "--yw-grad-size-y",
        "--yw-color-1",
        "--yw-color-2",
        "--yw-color-3",
        "--yw-stop-1",
        "--yw-stop-2"
      ];
      names.forEach((name, index) => root.style.setProperty(name, keyframes[index]));
    }

    function updateProgress() {
      progressFrame = 0;
      const scrollTop = getScrollY();
      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      const progress = clamp(scrollTop / maxScroll);

      root.style.setProperty("--yw-scroll-progress", progress.toFixed(4));
      root.style.setProperty("--yw-scroll-y", `${scrollTop.toFixed(1)}px`);
      root.classList.toggle("yw-nav-condensed", scrollTop > 36);
      if (progressBar) progressBar.style.transform = `scaleX(${progress})`;

      updateStickyRegister(scrollTop);
      updateAlliaSectionVars();
      updateAlliaBackground(scrollTop);
    }

    function scheduleProgressUpdate() {
      if (progressFrame) return;
      progressFrame = window.requestAnimationFrame(updateProgress);
    }

    function revealTargets() {
      const revealTargets = Array.from(
        document.querySelectorAll<HTMLElement>(
          [
            ".circle-marquee",
            ".yw-circle-hero",
            ".yw-story-section",
            ".yw-story-media",
            ".yw-story-copy",
            ".yw-sales-section",
            ".yw-check-grid",
            ".yw-blueprint-grid",
            ".yw-result-cards",
            ".yw-fit-table",
            ".yw-bonus-grid",
            ".yw-circle-faq",
            ".yw-brand-footer",
            ".yw-footer-content",
            ".yw-footer-about",
            ".yw-footer-stats",
            ".yw-footer-brand"
          ].join(",")
        )
      );
      const effectTargets = Array.from(
        document.querySelectorAll<HTMLElement>(
          [
            ".yw-hero-kicker",
            ".yw-hero-pill",
            ".yw-circle-title",
            ".yw-circle-subtitle",
            ".yw-coach-photo-frame",
            ".yw-coach-card",
            ".yw-details-heading",
            ".yw-audience-label",
            ".yw-detail-card",
            ".yw-register-strip",
            ".yw-register-button",
            ".yw-check-row",
            ".yw-blueprint-grid article",
            ".yw-result-cards article",
            ".yw-bonus-grid article",
            ".yw-fit-col",
            ".yw-circle-faq details",
            ".yw-footer-stat",
            ".yw-footer-legal",
            ".yw-footer-legal-links a"
          ].join(",")
        )
      );

      revealTargets.forEach((target) => target.classList.add("yw-reveal"));
      effectTargets.forEach((target, index) => {
        target.classList.add("yw-allia-effect");
        target.style.setProperty("--yw-reveal-delay", `${Math.min(520, index * 36)}ms`);
      });
      document.querySelectorAll<HTMLElement>(".yw-coach-photo-frame,.yw-story-video-card,.yw-footer-brand")
        .forEach((target) => target.classList.add("yw-allia-float"));

      const allTargets = [...revealTargets, ...effectTargets];
      if (!("IntersectionObserver" in window) || reducedMotion.matches) {
        allTargets.forEach((target) => target.classList.add("is-visible", "is-allia-visible"));
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible", "is-allia-visible");
            observer.unobserve(entry.target);
          });
        },
        { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
      );
      observers.push(observer);
      allTargets.forEach((target) => observer.observe(target));
    }

    function commitPointer() {
      root.style.setProperty("--yw-pointer-x", pointerX.toFixed(4));
      root.style.setProperty("--yw-pointer-y", pointerY.toFixed(4));
      pointerFrame = 0;
    }

    function updatePointer(event: PointerEvent) {
      if (reducedMotion.matches) return;
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2;
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(commitPointer);
    }

    function resetPointer() {
      pointerX = 0;
      pointerY = 0;
      if (!pointerFrame) pointerFrame = window.requestAnimationFrame(commitPointer);
    }

    revealTargets();
    updateProgress();
    window.addEventListener("scroll", scheduleProgressUpdate, { passive: true });
    window.addEventListener("resize", scheduleProgressUpdate);
    window.addEventListener("load", scheduleProgressUpdate);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerleave", resetPointer, { passive: true });

    return () => {
      window.removeEventListener("scroll", scheduleProgressUpdate);
      window.removeEventListener("resize", scheduleProgressUpdate);
      window.removeEventListener("load", scheduleProgressUpdate);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerleave", resetPointer);
      observers.forEach((observer) => observer.disconnect());
      if (progressFrame) window.cancelAnimationFrame(progressFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      root.classList.remove("yw-nav-condensed", "yw-sticky-register-visible");
      [
        "--yw-scroll-progress",
        "--yw-scroll-y",
        "--yw-hero-progress",
        "--yw-footer-progress",
        "--yw-pointer-x",
        "--yw-pointer-y"
      ].forEach((property) => root.style.removeProperty(property));
    };
  }, []);

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

  function getPreviewInspectProps(target: CoachTemplatePreviewInspectTarget) {
    const selected = selectedInspectScope === target;

    if (!previewMode) return {};

    const shared = {
      "data-inspect-target": String(target),
      "data-selected": selected ? "true" : "false"
    };

    if (!inspectMode) return shared;

    return {
      ...shared,
      "aria-label": `Select ${getPreviewInspectLabel(target)} for editing`,
      "data-inspect-mode": "true",
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectInspectScope?.(target);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        onSelectInspectScope?.(target);
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

  function renderInspectableText(target: CoachTemplatePreviewInspectTarget, children: ReactNode) {
    if (!previewMode) return children;

    return (
      <span className={styles.previewInspectableText} {...getPreviewInspectProps(target)}>
        {children}
      </span>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link href="/coach-circle-template.css?v=coach-footer-legal-local-style-20260618" rel="stylesheet" />
      <main
        className="yw-circle-site"
        data-coach-site-page={previewMode ? "preview" : "public"}
        data-coach-slug={site.slug}
        data-preview={previewMode ? "true" : "false"}
        data-sticky-scope={stickyMode}
        data-theme={CANONICAL_COACH_TEMPLATE_ID}
        id="top"
      >
        <div className="yw-allia-background" aria-hidden="true" />
        <div className="yw-scroll-progress" aria-hidden="true">
          <span className="yw-scroll-progress__bar" />
        </div>

        <nav className="navbar14_component w-nav" aria-label="Coach page navigation">
          <div className="navbar14_container">
            <Link className="navbar14_logo-link w-nav-brand yw-navbar-brand" href="#top">
              <span className="yw-navbar-mark" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" decoding="async" loading="eager" src="/assets/yw-logo-transparent.png" />
              </span>
              <span className="yw-navbar-wordmark">
                <strong>YWN</strong>
              </span>
            </Link>
            <div className="navbar14_menu w-nav-menu">
              <div className="navbar14_menu-links">
                <a href="#story">About Us</a>
                <a href="#story">How It Works</a>
                <a href="#bonus">Quality &amp; Innovation</a>
                <a href="#bonus">Our Brands</a>
                <a href="#faq">FAQ</a>
                <a href="#coach-contact-support">Careers</a>
                <a href="#coach-contact-support">Contact Us</a>
              </div>
            </div>
            <div className="navbar14_menu-button w-nav-button" aria-hidden="true">
              <div className="menu-icon2" />
            </div>
          </div>
        </nav>

        <div className="yw-circle-main">
          <section
            className={getPreviewInspectClassName("yw-circle-hero")}
            data-preview-section="hero"
            {...getPreviewInspectProps("hero")}
          >
            {renderInspectHotspot("hero")}
            <div className="yw-circle-hero__shell">
              <p className="yw-hero-kicker">
                {renderInspectableText(
                  "hero.brandBadge",
                  heroPackage.eyebrow
                )}
              </p>
              <p className="yw-hero-pill">
                {renderInspectableText(
                  "hero.brandEyebrow",
                  site.content.brandEyebrow || `Free coach guidance with ${coachName}`
                )}
              </p>
              <h1 className="yw-circle-title">
                {renderInspectableText("hero.headline", heroPackage.headline)}{" "}
                <span>{renderInspectableText("hero.trustLabel", heroPackage.highlight)}</span>
              </h1>
              <p className="yw-circle-subtitle">
                {renderInspectableText(
                  "hero.subheadline",
                  heroPackage.subheadline
                )}
              </p>
              <RegisterAction
                className="yw-register-button yw-hero-top-register"
                onMissingRegisterLink={showMissingRegisterFallback}
                site={site}
              >
                {renderInspectableText("cta.registerButtonText", registerLabel)}
              </RegisterAction>

              <div className="yw-hero-grid">
                <div className="yw-coach-visual" data-media={site.heroMediaType || "image"}>
                  <div className="yw-coach-photo-frame" data-empty={!heroMedia.imageUrl ? "true" : "false"}>
                    <HeroImageContent heroMedia={heroMedia} site={site} />
                  </div>
                  <div className="yw-coach-card">
                    <h2>{renderInspectableText("coach.name", coachName)}</h2>
                    <p>{renderInspectableText("coach.niche", coachNiche)}</p>
                  </div>
                </div>

                <div className="yw-details-panel">
                  <h2 className="yw-details-heading">Coach Support Details</h2>
                  <span className="yw-details-line" aria-hidden="true" />
                  <p className="yw-audience-label">{renderInspectableText("hero.trustCopy", heroPackage.helperText)}</p>
                  <div className="yw-details-grid">
                    {detailCards.map((card, index) => (
                      <DetailCard
                        icon={String(index + 1).padStart(2, "0")}
                        key={`${card.label}-${card.value}`}
                        label={card.label}
                        value={card.value}
                      />
                    ))}
                  </div>
                  <RegisterAction
                    className="yw-register-button"
                    onMissingRegisterLink={showMissingRegisterFallback}
                    site={site}
                  >
                    {renderInspectableText("cta.registerButtonText", registerLabel)}
                  </RegisterAction>
                </div>
              </div>
            </div>
          </section>

          <Marquee coachName={coachName} />

          <section className="yw-story-section" id="story" aria-labelledby="yw-story-title">
            <div className="yw-story-grid">
              <div className="yw-story-media">
                <div className="yw-story-video-card">
                  <HeroVideoContent heroMedia={heroMedia} site={site} />
                  {!heroMedia.embedVideoUrl && !heroMedia.uploadedVideoUrl ? (
                    <div className="yw-story-video-placeholder" aria-hidden="true">
                      <span className="yw-story-play">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <path d="M9 6.75L17 12L9 17.25V6.75Z" />
                        </svg>
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="yw-story-media-footer">
                  <strong>{coachName}</strong>
                  <span>{coachNiche}</span>
                </div>
              </div>

              <div
                className={getPreviewInspectClassName("yw-story-copy")}
                data-preview-section="intro"
                {...getPreviewInspectProps("intro")}
              >
                {renderInspectHotspot("intro")}
                <h2 id="yw-story-title">
                  {renderInspectableText(
                    "intro.heading",
                    site.content.introHeading || `Meet Coach ${coachName}`
                  )}{" "}
                  <span>{renderInspectableText("vision.label", site.content.visionLabel || "with clarity.")}</span>
                </h2>
                <p>{renderInspectableText("intro.body", site.content.coachIntro || site.bio)}</p>
                <p>{renderInspectableText("vision.body", site.content.visionText || site.vision)}</p>
                <div className="yw-story-stats" aria-label="YW Nutritech coach highlights">
                  <div>
                    <strong>50K+</strong>
                    <span>Community Members</span>
                  </div>
                  <div>
                    <strong>1Cr+</strong>
                    <span>People Mission</span>
                  </div>
                  <div>
                    <strong>YW</strong>
                    <span>Coach Network</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="yw-sales-section yw-sales-section--cream" aria-labelledby="yw-familiar-title">
            <div
              className={getPreviewInspectClassName("yw-sales-shell")}
              data-preview-section="problem"
              {...getPreviewInspectProps("problem")}
            >
              {renderInspectHotspot("problem")}
              <p className="yw-kicker">
                {renderInspectableText("problem.sectionLabel", site.content.problemSectionLabel || "Does this sound familiar?")}
              </p>
              <h2 id="yw-familiar-title">
                {renderInspectableText(
                  "problem.heading",
                  getSafeCoachTemplateCopy(
                    site.content.problemHeading,
                    `You want clearer ${coachNiche} guidance.`
                  )
                )}
              </h2>
              <div className="yw-check-grid">
                {getProblemPoints(site).map((point, index) => (
                  <div className="yw-check-row" key={`${point}-${index}`}>
                    <span aria-hidden="true">✓</span>
                    <p>{renderInspectableText(`problem.points.${index}`, point)}</p>
                  </div>
                ))}
              </div>
              <RegisterAction
                className="yw-register-strip"
                onMissingRegisterLink={showMissingRegisterFallback}
                site={site}
              >
                {registerLabel}
              </RegisterAction>
            </div>
          </section>

          <section className="yw-sales-section yw-sales-section--mint" aria-labelledby="yw-blueprint-title">
            <div
              className={getPreviewInspectClassName("yw-sales-shell")}
              data-preview-section="journey"
              {...getPreviewInspectProps("journey")}
            >
              {renderInspectHotspot("journey")}
              <p className="yw-kicker">
                {renderInspectableText("journey.sectionLabel", site.content.journeySectionLabel || "What you will walk away with")}
              </p>
              <h2 id="yw-blueprint-title">
                {renderInspectableText(
                  "journey.heading",
                  getSafeCoachTemplateCopy(
                    site.content.journeyHeading,
                    "A complete practical coach-support blueprint."
                  )
                )}
              </h2>
              <div className="yw-blueprint-grid">
                {getJourneySteps(site).map((step, index) => (
                  <article key={`${step.label}-${step.title}`}>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    <h3>{renderInspectableText(`journey.steps.${index}.title`, step.title)}</h3>
                    <p>{renderInspectableText(`journey.steps.${index}.description`, step.description)}</p>
                  </article>
                ))}
              </div>
              <RegisterAction
                className="yw-register-strip"
                onMissingRegisterLink={showMissingRegisterFallback}
                site={site}
              >
                {registerLabel}
              </RegisterAction>
            </div>
          </section>

          <section
            className="yw-sales-section yw-sales-section--dark yw-sales-section--bonus yw-niche-bonus"
            data-yw-ai-adaptive="true"
            data-yw-bonus-count={bonusSection.items.length}
            data-yw-bonus-source="universalBonusRegistry"
            data-yw-editable-slots="bonus.heading,bonus.subheading,bonus.items[].title,bonus.items[].description,bonus.ctaText"
            data-yw-locked-fields="bonus.id,bonus.actualAssetUrl,bonus.actualValue,legal.disclaimer,cta.destination"
            data-yw-template-rule="nicheAdaptiveBonusSection"
            id="bonus"
            aria-labelledby="yw-bonus-title"
          >
            <div
              className={getPreviewInspectClassName("yw-sales-shell yw-bonus-shell")}
              data-preview-section="bonus"
              {...getPreviewInspectProps("bonus")}
            >
              {renderInspectHotspot("bonus")}
              <p className="yw-bonus-kicker">Niche-adaptive bonuses</p>
              <h2 id="yw-bonus-title">{renderInspectableText("bonus.heading", bonusSection.heading)}</h2>
              <p className="yw-section-subcopy">
                {renderInspectableText("bonus.subheading", bonusSection.subheading)}
              </p>
              <div className="yw-bonus-grid" data-yw-bonus-grid>
                {bonusSection.items.map((bonus, index) => (
                  <article
                    className="yw-niche-bonus__card"
                    data-bonus-asset-type={bonus.assetType}
                    data-bonus-id={bonus.id}
                    data-bonus-locked-asset="true"
                    key={bonus.id}
                  >
                    <div className="yw-bonus-badge">Bonus {index + 1}</div>
                    <div className={`yw-bonus-visual yw-bonus-visual--${bonus.assetType}`} aria-hidden="true" />
                    <p className="yw-bonus-type">{bonus.assetType === "video" ? "Video Training" : "Digital Guide"}</p>
                    <h3>{renderInspectableText(`bonus.items.${index}.title`, bonus.title)}</h3>
                    <p>{renderInspectableText(`bonus.items.${index}.description`, bonus.description)}</p>
                    <strong data-yw-locked="actualValue">{bonus.valueLabel} - Included Free</strong>
                  </article>
                ))}
              </div>
              <p className="yw-bonus-total" data-yw-bonus-total>
                {bonusSection.totalValueLabel}
              </p>
              <p className="yw-bonus-cta-copy">{bonusSection.ctaSupportCopy}</p>
              <RegisterAction
                className="yw-register-strip yw-register-strip--dark yw-bonus-cta"
                onMissingRegisterLink={showMissingRegisterFallback}
                site={site}
              >
                {renderInspectableText("bonus.ctaText", bonusSection.ctaText)}
              </RegisterAction>
            </div>
          </section>

          <section className="yw-sales-section yw-sales-section--cream" aria-labelledby="yw-fit-title">
            <div className="yw-sales-shell">
              <h2 id="yw-fit-title">
                Is this <span>coach support right for you?</span>
              </h2>
              <div className="yw-fit-table" aria-label="Who this coach support is for">
                <div className="yw-fit-col">
                  <h3>This IS for you if...</h3>
                  <p><span aria-hidden="true">{"\u2713"}</span> You want education-first guidance before taking the next step.</p>
                  <p><span aria-hidden="true">{"\u2713"}</span> You are open to practical lifestyle habits and consistency.</p>
                  <p><span aria-hidden="true">{"\u2713"}</span> You want to understand the coach&apos;s method before registering.</p>
                </div>
                <div className="yw-fit-col yw-fit-col--no">
                  <h3>This is NOT for you if...</h3>
                  <p><span aria-hidden="true">{"\u00d7"}</span> You are looking for instant results or guaranteed outcomes.</p>
                  <p><span aria-hidden="true">{"\u00d7"}</span> You need emergency, diagnosis, or treatment advice.</p>
                  <p><span aria-hidden="true">{"\u00d7"}</span> You do not want to take action after learning.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="yw-circle-faq" id="faq" aria-labelledby="yw-faq-title">
            <div
              className={getPreviewInspectClassName("yw-faq-shell")}
              data-preview-section="faq"
              {...getPreviewInspectProps("faq")}
            >
              {renderInspectHotspot("faq")}
              <h2 id="yw-faq-title">
                {renderInspectableText("faq.heading", site.content.faqHeading || "Frequently Asked Questions")}
              </h2>
              <div className="yw-faq-list">
                {getFaq(site).map((item, index) => (
                  <details key={`${item.question}-${index}`}>
                    <summary>{renderInspectableText(`faq.items.${index}.question`, item.question)}</summary>
                    <p>{renderInspectableText(`faq.items.${index}.answer`, item.answer)}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="yw-sales-section yw-sales-section--mint" id="coach-contact-support">
            <div
              className={getPreviewInspectClassName("yw-sales-shell")}
              data-preview-section="cta"
              {...getPreviewInspectProps("cta")}
            >
              {renderInspectHotspot("cta")}
              <p className="yw-kicker">{renderInspectableText("support.heading", site.content.supportHeading || "Contact Support")}</p>
              <h2>
                {renderInspectableText(
                  "cta.heading",
                  getSafeCoachTemplateCopy(
                    site.content.ctaText,
                    `Ready to connect with ${coachName}?`
                  )
                )}
              </h2>
              <p className="yw-section-subcopy">
                {renderInspectableText(
                  "cta.trustText",
                  getSafeCoachTemplateCopy(
                    site.content.trustText,
                    "This page is education-first and does not replace medical advice, diagnosis, or treatment."
                  )
                )}
              </p>
              <RegisterAction
                className="yw-register-strip"
                onMissingRegisterLink={showMissingRegisterFallback}
                site={site}
              >
                {registerLabel}
              </RegisterAction>
              <a
                className="yw-register-strip"
                data-track={support.whatsappLink ? "coach_whatsapp_click" : undefined}
                href={support.primaryHref}
                onClick={
                  support.whatsappLink
                    ? () => void recordCoachEvent("coach_whatsapp_click", site.slug)
                    : undefined
                }
                rel={support.primaryHref.startsWith("mailto:") ? undefined : "noreferrer"}
                target={support.primaryHref.startsWith("mailto:") ? undefined : "_blank"}
              >
                {site.content.supportPrimaryButton || site.content.stickyCtaContactButton || "Contact Support"}
              </a>
            </div>
          </section>

          <footer
            className={getPreviewInspectClassName("yw-brand-footer")}
            data-preview-section="footer"
            {...getPreviewInspectProps("footer")}
          >
            {renderInspectHotspot("footer")}
            <div className="yw-footer-watermark" aria-hidden="true">
              <span>Y</span>
              <span>W</span>
              <span>N</span>
            </div>
            <div className="yw-footer-content">
              <section className="yw-footer-about" aria-labelledby="yw-footer-title">
                <h2 id="yw-footer-title">
                  About <span>YW Nutritech</span>
                </h2>
                <p>
                  YW Nutritech builds practical wellness education, coach-led support, and
                  nutrition-first guidance for people who want healthier everyday routines.
                </p>
                <p>
                  Through community learning, simple health-tech tools, and coach referral
                  experiences, YW Nutritech helps coaches connect with people in a clearer,
                  more trusted way.
                </p>
                <p>
                  We aim to make wellness support more accessible, consistent, and human while
                  keeping every coach visible at the center of the journey.
                </p>
              </section>
              <div className="yw-footer-stats" aria-label="YW Nutritech community proof">
                <div className="yw-footer-stat">
                  <strong>50K+</strong>
                  <span>Community Members</span>
                </div>
                <div className="yw-footer-stat">
                  <strong>1Cr+</strong>
                  <span>People Mission</span>
                </div>
                <div className="yw-footer-stat">
                  <strong>YW</strong>
                  <span>Coach Network</span>
                </div>
              </div>
              <p className="yw-footer-legal">
                {renderInspectableText(
                  "footer.text",
                  getCanonicalLegalDisclaimer(site)
                )}
              </p>
              <nav className="yw-footer-legal-links" aria-label="Coach site legal links">
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/terms">Terms &amp; Conditions</Link>
                <Link href="/disclaimer">Disclaimer</Link>
              </nav>
              <div className="yw-footer-brand">
                <span className="yw-footer-mark" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" decoding="async" loading="lazy" src="/assets/yw-logo-transparent.png" />
                </span>
                <span className="yw-footer-brand-text">
                  <strong>YW Nutritech</strong>
                  <small>Coach Circle</small>
                </span>
              </div>
            </div>
          </footer>
        </div>

        <aside
          aria-label="Register for free"
          aria-hidden={floatingCtaVisible ? "false" : "true"}
          className={`yw-floating-register-cta ${floatingCtaVisible ? "is-visible" : ""}`}
          data-yw-sticky-register
          tabIndex={floatingCtaVisible ? 0 : -1}
        >
          <RegisterAction
            className="yw-register-button"
            onMissingRegisterLink={showMissingRegisterFallback}
            site={site}
          >
            {registerLabel}
          </RegisterAction>
        </aside>
      </main>
    </>
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
  site
}: {
  inspectMode?: boolean;
  onSelectInspectScope?: (value: CoachTemplatePreviewInspectTarget) => void;
  previewMode?: boolean;
  referenceId: string;
  selectedInspectScope?: CoachTemplatePreviewInspectTarget | null;
  site: PublicCoachSiteRecord | null;
  tone?: "compact" | "embedded" | "standard";
}) {
  const support = getSupportDetails(site);
  return (
    <section className="yw-sales-section yw-sales-section--mint" id="coach-contact-support">
      <div className="yw-sales-shell">
        <p className="yw-kicker">Contact Support</p>
        <h2>{support.name}</h2>
        <p className="yw-section-subcopy">
          {support.text} Reference: {referenceId}
        </p>
        <a
          className="yw-register-strip"
          href={support.primaryHref}
          rel={support.primaryHref.startsWith("mailto:") ? undefined : "noreferrer"}
          target={support.primaryHref.startsWith("mailto:") ? undefined : "_blank"}
        >
          Contact Support
        </a>
      </div>
    </section>
  );
}

function DetailCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <article className="yw-detail-card">
      <span className="yw-detail-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <h3>{label}</h3>
        <p>{value}</p>
      </span>
    </article>
  );
}

function Marquee({ coachName }: { coachName: string }) {
  const star = "\u2605";

  return (
    <section
      className="circle-marquee"
      aria-label="YW Nutritech Circle marquee"
      data-yw-circle-marquee
      data-yw-marquee-brand="YW NUTRITECH CIRCLE"
      data-yw-marquee-name={coachName}
    >
      <div className="circle-marquee__track">
        {Array.from({ length: 16 }).map((_, index) => (
          <span className="circle-marquee__item" key={index}>
            <span className="circle-marquee__brand">YW NUTRITECH CIRCLE</span>
            <span className="circle-marquee__star">{star}</span>
            <span className="circle-marquee__name">{coachName}</span>
            <span className="circle-marquee__star">{star}</span>
          </span>
        ))}
      </div>
    </section>
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
        aria-disabled="true"
        className={className || "yw-register-button"}
        data-missing-link="true"
        onClick={() => {
          void recordCoachEvent("coach_register_missing_link", site.slug);
          onMissingRegisterLink?.();
        }}
        type="button"
      >
        Registration link pending
      </button>
    );
  }

  return (
    <a
      className={className || "yw-register-button"}
      data-track="coach_register_click"
      href={site.googleFormUrl}
      onClick={() => void recordCoachEvent("coach_register_click", site.slug)}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function HeroImageContent({
  heroMedia,
  site
}: {
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

  if (heroMedia.imageUrl && !mediaFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={`${site.coachName} profile`} decoding="async" onError={handleMediaError} src={heroMedia.imageUrl} />
    );
  }

  return <span>{getCanonicalCoachInitials(site)}</span>;
}

function HeroVideoContent({
  heroMedia,
  site
}: {
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
      safeMessage: "Coach video could not load.",
      userAction: "coach_video_load"
    });
  }

  if (mediaFailed) return null;

  if (heroMedia.embedVideoUrl) {
    return (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; compute-pressure; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onError={handleMediaError}
        src={heroMedia.embedVideoUrl}
        title={`${site.coachName} story video`}
      />
    );
  }

  if (heroMedia.uploadedVideoUrl) {
    return (
      <video
        controls
        onError={handleMediaError}
        playsInline
        preload="metadata"
        src={heroMedia.uploadedVideoUrl}
        title={`${site.coachName} story video`}
      />
    );
  }

  return null;
}

function getHeroMedia(site: PublicCoachSiteRecord) {
  const heroMediaType = site.heroMediaType || "image";
  const imageUrl = heroMediaType === "image" ? site.photoUrl || site.logoUrl : site.photoUrl || site.logoUrl;
  const embedVideoUrl = heroMediaType === "video" ? normalizeVideoEmbedUrl(site.videoUrl) : "";
  const uploadedVideoUrl =
    heroMediaType === "video" && isUploadedVideoSource(site.videoUrl) ? site.videoUrl : "";

  return {
    embedVideoUrl,
    imageUrl,
    uploadedVideoUrl
  };
}

function getProblemPoints(site: PublicCoachSiteRecord) {
  const points = site.content.problemPoints.filter(Boolean);

  return points.length > 0
    ? points
    : [
        `Too much scattered ${site.niche || "wellness"} advice and not enough structure.`,
        "Unclear next steps before booking or registering.",
        "A need for trust before starting a coaching relationship.",
        "A preference for education-first guidance alongside proper professional care."
      ];
}

function getJourneySteps(site: PublicCoachSiteRecord) {
  return site.content.journeySteps.length > 0
    ? site.content.journeySteps
    : [
        {
          description: "Understand the coach's niche, story, and support style without guessing.",
          label: "Discover",
          title: "Meet the coach"
        },
        {
          description: "Review the practical ideas and decide whether this guidance fits your goal.",
          label: "Evaluate",
          title: "Check the fit"
        },
        {
          description: "Use the registration or contact link when you are ready for the next step.",
          label: "Connect",
          title: "Take the next step"
        }
      ];
}

function getFaq(site: PublicCoachSiteRecord) {
  return site.content.faq.length > 0
    ? site.content.faq
    : [
        {
          answer: "Use the register button on this page. It opens the coach-specific registration form when configured.",
          question: "How do I attend?"
        },
        {
          answer:
            "No. This page is for education and lifestyle coaching information only. It is not medical advice, diagnosis, or treatment.",
          question: "Is this medical advice?"
        },
        {
          answer: "Use the Contact Support section if you need help with registration or coach details.",
          question: "Who should I contact for help?"
        }
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
  const code = getPublicSupportErrorCode(category);
  const safeSeed = slug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();

  return safeSeed ? `${code}-${safeSeed}-SUPPORT` : `${code}-SUPPORT`;
}

function getPreviewInspectLabel(target: CoachTemplatePreviewInspectTarget) {
  const section = String(target).split(".")[0];
  const labels: Record<string, string> = {
    benefits: "Benefits",
    bonus: "Bonus",
    cta: "CTA",
    faq: "FAQ",
    footer: "Footer",
    hero: "Hero",
    intro: "Intro",
    journey: "Journey",
    media: "Media",
    problem: "Problem",
    support: "Support",
    vision: "Mission"
  };

  return labels[section] || "Content";
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
