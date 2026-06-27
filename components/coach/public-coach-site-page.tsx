"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";

import {
  getCanonicalCoachSectionCopy,
  getCanonicalCoachInitials,
  getCanonicalCoachName,
  getCanonicalCoachNiche,
  getCanonicalLegalDisclaimer,
  getCanonicalRegisterLabel,
  getCanonicalCoachNavbarSections,
  getSmartBonusVisualCssType,
  getSmartBonusVisualMark,
  getNicheAdaptiveBonusSection,
  type CanonicalHeroInfoCardKind,
  type NicheAdaptiveBonusItem
} from "../../lib/coach-canonical-template";
import { getCoachTemplateTheme } from "../../lib/coach-template-themes";
import type { PublicCoachSiteRecord } from "../../lib/admin-coach-sites";
import {
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

type SmartBonusVisualProps = {
  bonus: NicheAdaptiveBonusItem;
  index: number;
  niche: string;
  themeId: string;
};

type TemplateBackgroundLayerProps = {
  intensity?: number;
  motionLevel?: "none" | "soft" | "dynamic";
  opacity?: number;
  reducedMotion?: boolean;
  themeId: string;
  variant?: "aurora" | "mesh" | "prism" | "spotlight" | "static";
};

function TemplateBackgroundLayer({
  intensity = 1,
  motionLevel = "soft",
  opacity = 1,
  reducedMotion = false,
  themeId,
  variant = "mesh"
}: TemplateBackgroundLayerProps) {
  const backgroundStyle = {
    "--yw-template-background-intensity": String(intensity),
    "--yw-template-background-opacity": String(opacity)
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className="yw-allia-background"
      data-motion-level={reducedMotion ? "none" : motionLevel}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-theme={themeId}
      data-variant={reducedMotion ? "static" : variant}
      id="background"
      style={backgroundStyle}
    />
  );
}

function getTemplateBackgroundVariant(themeId: string): NonNullable<TemplateBackgroundLayerProps["variant"]> {
  if (themeId === "liquid-glass") return "aurora";
  if (themeId === "prism-aurora") return "prism";
  if (themeId === "dark-luxury") return "spotlight";
  if (themeId === "minimal-premium") return "static";
  return "mesh";
}

function getTemplateBackgroundMotionLevel(themeId: string): NonNullable<TemplateBackgroundLayerProps["motionLevel"]> {
  if (themeId === "minimal-premium") return "none";
  if (themeId === "prism-aurora" || themeId === "performance-energy") return "dynamic";
  return "soft";
}

function getTemplateBackgroundIntensity(themeId: string) {
  if (themeId === "minimal-premium") return 0.45;
  if (themeId === "prism-aurora" || themeId === "performance-energy") return 1.12;
  return 0.9;
}

function getTemplateBackgroundOpacity(themeId: string) {
  if (themeId === "dark-luxury") return 0.88;
  if (themeId === "minimal-premium") return 0.54;
  return 1;
}

function SmartBonusVisual({ bonus, index, niche, themeId }: SmartBonusVisualProps) {
  const visualCssType = getSmartBonusVisualCssType(bonus.visualType);
  const mark = getSmartBonusVisualMark(bonus);
  const style = { "--bonus-index": index } as CSSProperties;

  if (bonus.imageUrl) {
    return (
      <div
        aria-label={bonus.imageAlt || `${bonus.typeLabel} bonus visual`}
        className={`yw-bonus-visual yw-smart-bonus-visual yw-bonus-visual--image yw-bonus-visual--${visualCssType}`}
        data-yw-asset-type={bonus.assetType}
        data-yw-bonus-id={bonus.id}
        data-yw-niche={niche}
        data-yw-smart-bonus="true"
        data-yw-smart-visual="configured-image"
        data-yw-template-theme={themeId}
        data-yw-visual-type={bonus.visualType}
        role="img"
        style={{
          ...style,
          backgroundImage: `linear-gradient(135deg, rgba(4, 31, 39, 0.16), rgba(33, 230, 193, 0.18)), url("${bonus.imageUrl}")`
        }}
      >
        <span aria-hidden="true" className="yw-bonus-visual__orb yw-bonus-visual__orb--image" />
        <span aria-hidden="true" className="yw-bonus-visual__micro-lines" />
        <span aria-hidden="true" className="yw-bonus-visual__shine" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`yw-bonus-visual yw-smart-bonus-visual yw-bonus-visual--${visualCssType}`}
      data-yw-asset-type={bonus.assetType}
      data-yw-bonus-id={bonus.id}
      data-yw-fallback-icon={bonus.fallbackIcon}
      data-yw-niche={niche}
      data-yw-smart-bonus="true"
      data-yw-smart-visual="generated"
      data-yw-template-theme={themeId}
      data-yw-visual-type={bonus.visualType}
      style={style}
    >
      <span className="yw-bonus-visual__orb" />
      <span className="yw-bonus-visual__product">
        <span className="yw-bonus-visual__mark">{mark}</span>
      </span>
      <span className="yw-bonus-visual__micro-lines" />
      <span className="yw-bonus-visual__shine" />
    </div>
  );
}

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
  const bonusSection = getNicheAdaptiveBonusSection(site);
  const selectedTheme = getCoachTemplateTheme(site.selectedThemeId);
  const selectedThemeStyle = selectedTheme.cssVars as CSSProperties;
  const sectionCopy = useMemo(() => getCanonicalCoachSectionCopy(site), [site]);
  const coachLandingPath = `/coach/${site.slug}`;
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
    try {
      window.sessionStorage.setItem("ywLastCoachLandingPath", coachLandingPath);
      window.localStorage.setItem("ywLastCoachLandingPath", coachLandingPath);
    } catch {
      // Browser storage can be unavailable; legal links still carry returnTo.
    }
  }, [coachLandingPath]);

  useEffect(() => {
    const bodyClasses = [
      "wp-singular",
      "page-template",
      "page-template-elementor_canvas",
      "wp-embed-responsive",
      "wp-theme-twentytwentythree",
      "elementor-default",
      "elementor-template-canvas",
      "elementor-kit-11",
      "elementor-page",
      "elementor-page-11246",
      "yw-circle-body"
    ];

    document.body.classList.add(...bodyClasses);
    document.documentElement.setAttribute("data-wf-domain", "alliahealth.co");
    document.documentElement.setAttribute("data-wf-page", "6949580ebefd680afac069c3");
    document.documentElement.setAttribute("data-wf-site", "6949580dbefd680afac06955");

    return () => {
      document.body.classList.remove(...bodyClasses);
      document.documentElement.removeAttribute("data-wf-domain");
      document.documentElement.removeAttribute("data-wf-page");
      document.documentElement.removeAttribute("data-wf-site");
    };
  }, []);

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

      const scrollTop = typeof currentScroll === "number" ? currentScroll : getScrollY();
      const triggerRect = stickyRegisterTrigger.getBoundingClientRect();
      const activationPoint = Math.max(120, window.innerHeight - 56);
      const triggerReached = triggerRect.top <= activationPoint;
      const shouldShow = scrollTop > 56 && triggerReached;

      root.classList.toggle("yw-sticky-register-visible", shouldShow);
      stickyRegisterCta.classList.toggle("is-visible", shouldShow);
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
      stickyRegisterCta?.classList.remove("is-visible");
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

  useEffect(() => {
    const accordions = Array.from(document.querySelectorAll<HTMLElement>(".yw-circle-faq .elementor-accordion"));
    const cleanupHandlers: Array<() => void> = [];

    accordions.forEach((accordion) => {
      const items = Array.from(accordion.querySelectorAll<HTMLDetailsElement>(".elementor-accordion-item"));

      function sync(item: HTMLDetailsElement) {
        const isOpen = item.open;
        item.classList.toggle("is-open", isOpen);
        const summary = item.querySelector<HTMLElement>(".elementor-tab-title");
        const content = item.querySelector<HTMLElement>(".elementor-tab-content");
        summary?.setAttribute("aria-expanded", isOpen ? "true" : "false");
        content?.setAttribute("aria-hidden", isOpen ? "false" : "true");
      }

      function setOpen(target: HTMLDetailsElement, shouldOpen: boolean) {
        items.forEach((item) => {
          item.open = false;
          item.classList.remove("is-open");
          sync(item);
        });

        if (shouldOpen) {
          target.open = true;
          sync(target);
        }
      }

      items.forEach((item) => {
        const summary = item.querySelector<HTMLElement>(".elementor-tab-title");
        if (!summary) return;

        summary.setAttribute("role", "button");
        sync(item);

        const handleClick = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(item, !item.open);
        };

        const handleKeydown = (event: globalThis.KeyboardEvent) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(item, !item.open);
        };

        summary.addEventListener("click", handleClick);
        summary.addEventListener("keydown", handleKeydown);
        cleanupHandlers.push(() => {
          summary.removeEventListener("click", handleClick);
          summary.removeEventListener("keydown", handleKeydown);
        });
      });
    });

    return () => {
      cleanupHandlers.forEach((cleanup) => cleanup());
    };
  }, [sectionCopy.faqItems]);

  useEffect(() => {
    const windowWithNavbar = window as Window & { ywSectionSyncedNavbarReady?: boolean };
    if (windowWithNavbar.ywSectionSyncedNavbarReady) return undefined;
    windowWithNavbar.ywSectionSyncedNavbarReady = true;

    const root = document.documentElement;
    const navbar = document.querySelector<HTMLElement>(".navbar14_component");
    const rawLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-yw-nav-link]"));
    const links = rawLinks.flatMap((link) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#") || href.length < 2) return [];

      const id = decodeURIComponent(href.slice(1));
      const target = document.getElementById(id);

      if (!target) {
        link.hidden = true;
        link.setAttribute("aria-hidden", "true");
        link.tabIndex = -1;
        return [];
      }

      return [{ id, link, target }];
    });

    if (!links.length) return undefined;

    let activeId = "";
    let activeFrame = 0;

    function getMenu() {
      return document.querySelector<HTMLElement>("[data-yw-nav-menu]");
    }

    function getToggle() {
      return document.querySelector<HTMLButtonElement>("[data-yw-nav-toggle]");
    }

    function getNavOffset() {
      if (!navbar) return 96;

      const rect = navbar.getBoundingClientRect();
      return Math.max(82, rect.top + rect.height + 18);
    }

    function syncMenuPlacement() {
      const menu = getMenu();
      if (!navbar || !menu) return;

      const container = navbar.querySelector<HTMLElement>(".navbar14_container") || navbar;
      const navRect = navbar.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const localBlock = menu.closest(".navbar14_container") ? containerRect : { left: 0, top: 0 };
      const viewportWidth = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 0);
      const desiredLeft = Math.max(12, Math.min(containerRect.left, viewportWidth - 24));
      const width = Math.max(240, Math.min(containerRect.width, viewportWidth - desiredLeft - 12));
      const desiredTop = Math.max(72, Math.min(navRect.bottom + 12, window.innerHeight - 96));
      const left = Math.max(0, desiredLeft - localBlock.left);
      const top = Math.max(0, desiredTop - localBlock.top);

      root.style.setProperty("--yw-nav-menu-top", `${top.toFixed(1)}px`);
      root.style.setProperty("--yw-nav-menu-left", `${left.toFixed(1)}px`);
      root.style.setProperty("--yw-nav-menu-width", `${width.toFixed(1)}px`);
    }

    function setMenuOpen(isOpen: boolean) {
      const menu = getMenu();
      const toggle = getToggle();
      if (!menu || !toggle) return;

      menu.classList.toggle("is-open", isOpen);
      menu.classList.toggle("w--open", isOpen);
      toggle.classList.toggle("w--open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.setAttribute("aria-label", isOpen ? "Close coach site menu" : "Open coach site menu");
      root.classList.toggle("yw-nav-menu-open", isOpen);

      if (isOpen) {
        window.requestAnimationFrame(syncMenuPlacement);
      }
    }

    function closeMenu() {
      setMenuOpen(false);
    }

    function setActive(nextId: string) {
      if (!nextId || nextId === activeId) return;

      activeId = nextId;
      Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-yw-nav-link]")).forEach((link) => {
        const href = link.getAttribute("href") || "";
        const id = href.startsWith("#") ? decodeURIComponent(href.slice(1)) : "";
        const isActive = id === nextId;
        if (link.classList.contains("navbar14_logo-link")) {
          link.classList.remove("is-active");
          link.removeAttribute("aria-current");
          return;
        }
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function updateActive() {
      const offset = getNavOffset() + 6;
      let next = links[0];

      links.forEach((item) => {
        const rect = item.target.getBoundingClientRect();
        if (rect.top - offset <= 0) {
          next = item;
        }
      });

      setActive(next.id);
      activeFrame = 0;
    }

    function scheduleActiveUpdate() {
      if (activeFrame) return;
      activeFrame = window.requestAnimationFrame(() => {
        if (root.classList.contains("yw-nav-menu-open")) {
          syncMenuPlacement();
        }
        updateActive();
      });
    }

    function scrollToTarget(target: HTMLElement) {
      const top = target.getBoundingClientRect().top + window.scrollY - getNavOffset();
      window.scrollTo({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        top: Math.max(0, top)
      });
    }

    function handleCapturedNavClick(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickedLink = target.closest<HTMLAnchorElement>("[data-yw-nav-link]");
      if (!clickedLink) return;

      const href = clickedLink.getAttribute("href") || "";
      const id = href.startsWith("#") ? decodeURIComponent(href.slice(1)) : "";
      const item = links.find((navItem) => navItem.id === id);
      if (!item) return;

      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      setActive(item.id);
      scrollToTarget(item.target);
      window.setTimeout(scheduleActiveUpdate, 220);
    }

    const handleCapturedToggleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const clickedToggle = target.closest("[data-yw-nav-toggle]");
      if (!clickedToggle) return;

      const menu = getMenu();
      if (!menu) return;

      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(!menu.classList.contains("is-open"));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    const handleDocumentClick = (event: Event) => {
      if (!root.classList.contains("yw-nav-menu-open")) return;
      if (navbar && event.target instanceof Node && navbar.contains(event.target)) return;

      closeMenu();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("click", handleCapturedToggleClick, true);
    document.addEventListener("click", handleCapturedNavClick, true);
    window.addEventListener("scroll", scheduleActiveUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveUpdate);
    window.addEventListener("load", scheduleActiveUpdate);
    updateActive();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("click", handleCapturedToggleClick, true);
      document.removeEventListener("click", handleCapturedNavClick, true);
      window.removeEventListener("scroll", scheduleActiveUpdate);
      window.removeEventListener("resize", scheduleActiveUpdate);
      window.removeEventListener("load", scheduleActiveUpdate);
      if (activeFrame) window.cancelAnimationFrame(activeFrame);
      closeMenu();
      root.style.removeProperty("--yw-nav-menu-top");
      root.style.removeProperty("--yw-nav-menu-left");
      root.style.removeProperty("--yw-nav-menu-width");
      Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-yw-nav-link]")).forEach((link) => {
        link.classList.remove("is-active");
        link.removeAttribute("aria-current");
      });
      windowWithNavbar.ywSectionSyncedNavbarReady = false;
    };
  }, [site.slug]);

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
      safeMessage: "Registration/contact link missing.",
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
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
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
      <link
        href="/external/cdn.prod.website-files.com/6949580dbefd680afac06955/css/allia-health.webflow.shared.d4c5828f3.min.css"
        rel="stylesheet"
        type="text/css"
      />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        data-optimized="2"
        href="/wp-content/litespeed/css/1e2d793fa3c48bae1a09bb06ed182c7e.css"
        rel="stylesheet"
      />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link href="/coach-circle-template.css?v=coach-cutout-optimal-hero-size-20260625" rel="stylesheet" />
      <Script src="/coach-circle-lenis.min.js?v=coach-4176-structural-copy-20260619" strategy="afterInteractive" />
      <Script
        src="/external/d3e54v103j8qbb.cloudfront.net/js/jquery-3.5.1.min.dc5e7f18c8__q_site_6949580dbefd680afac06955.js"
        strategy="afterInteractive"
      />
      <Script
        src="/external/cdn.prod.website-files.com/6949580dbefd680afac06955/js/webflow.schunk.36b8fb49256177c8.js"
        strategy="afterInteractive"
      />
      <Script
        src="/external/cdn.prod.website-files.com/6949580dbefd680afac06955/js/webflow.05ef6ae8.15e2de229fe07c28.js"
        strategy="afterInteractive"
      />
      <Script src="/coach-circle-bonus-section.js?v=coach-bonus-universal-services-20260621" strategy="afterInteractive" />
      <Script src="/coach-circle-motion.js?v=coach-mobile-nav-sheet-20260622" strategy="afterInteractive" />
      <div
        className="yw-circle-site"
        data-coach-site-page={previewMode ? "preview" : "public"}
        data-coach-slug={site.slug}
        data-preview={previewMode ? "true" : "false"}
        data-sticky-scope={stickyMode}
        data-theme={selectedTheme.id}
        data-yw-template-theme={selectedTheme.id}
        id="top"
        style={selectedThemeStyle}
      >
        <TemplateBackgroundLayer
          intensity={getTemplateBackgroundIntensity(selectedTheme.id)}
          motionLevel={getTemplateBackgroundMotionLevel(selectedTheme.id)}
          opacity={getTemplateBackgroundOpacity(selectedTheme.id)}
          themeId={selectedTheme.id}
          variant={getTemplateBackgroundVariant(selectedTheme.id)}
        />
        <div className="yw-scroll-progress" aria-hidden="true">
          <span className="yw-scroll-progress__bar" />
        </div>

        <CoachCircleNavbar
          onMissingRegisterLink={showMissingRegisterFallback}
          registerLabel={registerLabel}
          site={site}
        />

        <main className="yw-circle-main" aria-label="YW Nutritech Circle composite page">
          <div
            className={getPreviewInspectClassName("elementor elementor-11246 yw-circle-hero")}
            data-elementor-post-type="page"
            data-elementor-type="wp-page"
            data-elementor-id="11246"
            data-preview-section="hero"
            data-yw-section-key="hero"
            id="home"
            {...getPreviewInspectProps("hero")}
          >
            {renderInspectHotspot("hero")}
            <section
              className="elementor-section elementor-top-section elementor-element elementor-element-7b3e225 elementor-section-boxed elementor-section-height-default elementor-section-height-default"
              data-e-type="section"
              data-element_type="section"
              data-id="7b3e225"
              data-settings='{"background_background":"classic"}'
            >
              <div className="elementor-container elementor-column-gap-default">
                <div
                  className="elementor-column elementor-col-100 elementor-top-column elementor-element elementor-element-0cbc0ab"
                  data-e-type="column"
                  data-element_type="column"
                  data-id="0cbc0ab"
                >
                  <div className="elementor-widget-wrap elementor-element-populated">
                    <div
                      className="elementor-element elementor-element-175afb4 elementor-widget elementor-widget-heading"
                      data-e-type="widget"
                      data-element_type="widget"
                      data-id="175afb4"
                      data-widget_type="heading.default"
                    >
                      <div className="elementor-widget-container">
                        <h4 className="elementor-heading-title elementor-size-default">
                          {renderInspectableText("hero.brandBadge", sectionCopy.topStrip)}
                        </h4>
                      </div>
                    </div>
                    <div
                      className="elementor-element elementor-element-a2d0984 elementor-widget__width-auto elementor-widget elementor-widget-heading"
                      data-e-type="widget"
                      data-element_type="widget"
                      data-id="a2d0984"
                      data-widget_type="heading.default"
                    >
                      <div className="elementor-widget-container">
                        <h4 className="elementor-heading-title elementor-size-default">
                          {renderInspectableText("hero.brandEyebrow", sectionCopy.heroEyebrow)}
                        </h4>
                      </div>
                    </div>
                    <div
                      className="elementor-element elementor-element-1a369ef elementor-widget elementor-widget-heading"
                      data-e-type="widget"
                      data-element_type="widget"
                      data-id="1a369ef"
                      data-widget_type="heading.default"
                    >
                      <div className="elementor-widget-container">
                        <h1 className="elementor-heading-title elementor-size-default">
                          {renderInspectableText("hero.headline", sectionCopy.heroTitleMain)}
                          {sectionCopy.heroTitleAccent ? (
                            <>
                              {" "}
                              <span className="golden-hoghlight-cu">
                                {renderInspectableText("hero.trustLabel", sectionCopy.heroTitleAccent)}
                              </span>
                            </>
                          ) : null}
                        </h1>
                      </div>
                    </div>
                    <div
                      className="elementor-element elementor-element-7217277 elementor-widget__width-initial elementor-widget-mobile__width-inherit elementor-widget elementor-widget-heading"
                      data-e-type="widget"
                      data-element_type="widget"
                      data-id="7217277"
                      data-widget_type="heading.default"
                    >
                      <div className="elementor-widget-container">
                        <p className="elementor-heading-title elementor-size-default">
                          {renderInspectableText("hero.subheadline", sectionCopy.heroSubheadline)}
                        </p>
                      </div>
                    </div>
                    <section
                      className="elementor-section elementor-inner-section elementor-element elementor-element-6dae30e elementor-section-boxed elementor-section-height-default elementor-section-height-default"
                      data-e-type="section"
                      data-element_type="section"
                      data-id="6dae30e"
                    >
                      <div className="elementor-container elementor-column-gap-default">
                        <div
                          className="elementor-column elementor-col-50 elementor-inner-column elementor-element elementor-element-4da1b83"
                          data-e-type="column"
                          data-element_type="column"
                          data-id="4da1b83"
                        >
                          <div className="elementor-widget-wrap elementor-element-populated">
                            <div
                              className="elementor-element elementor-element-afb23e5 elementor-widget elementor-widget-image"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="afb23e5"
                              data-widget_type="image.default"
                            >
                              <div className="elementor-widget-container">
                                <HeroImageContent heroMedia={heroMedia} site={site} />
                              </div>
                            </div>
                            <div
                              className="elementor-element elementor-element-b1105bd elementor-widget__width-initial elementor-widget elementor-widget-icon-box"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="b1105bd"
                              data-widget_type="icon-box.default"
                            >
                              <div className="elementor-widget-container">
                                <div className="elementor-icon-box-wrapper">
                                  <div className="elementor-icon-box-content">
                                    <h5 className="elementor-icon-box-title">
                                      <span>{renderInspectableText("coach.name", coachName)}</span>
                                    </h5>
                                    <p className="elementor-icon-box-description">
                                      {renderInspectableText("coach.niche", coachNiche)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          className="elementor-column elementor-col-50 elementor-inner-column elementor-element elementor-element-ca06760"
                          data-e-type="column"
                          data-element_type="column"
                          data-id="ca06760"
                        >
                          <div className="elementor-widget-wrap elementor-element-populated">
                            <div
                              className="elementor-element elementor-element-1778ab6 elementor-widget__width-initial elementor-widget-mobile__width-inherit elementor-widget elementor-widget-heading"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="1778ab6"
                              data-widget_type="heading.default"
                            >
                              <div className="elementor-widget-container">
                                <p className="elementor-heading-title elementor-size-default">
                                  {renderInspectableText("hero.detailHeading", sectionCopy.detailHeading)}
                                </p>
                              </div>
                            </div>
                            <div
                              className="elementor-element elementor-element-b0fe8be elementor-widget elementor-widget-image"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="b0fe8be"
                              data-widget_type="image.default"
                            >
                              <div className="elementor-widget-container">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img alt="" decoding="async" height="18" src="/wp-content/uploads/2026/03/Line-11.svg" width="260" />
                              </div>
                            </div>
                            <div
                              className="elementor-element elementor-element-05fe630 elementor-widget__width-initial elementor-widget-mobile__width-inherit elementor-widget elementor-widget-heading"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="05fe630"
                              data-widget_type="heading.default"
                            >
                              <div className="elementor-widget-container">
                                <p className="elementor-heading-title elementor-size-default">
                                  {renderInspectableText("hero.detailSubline", sectionCopy.detailSubline)}
                                </p>
                              </div>
                            </div>
                            {sectionCopy.detailCards.map((card, index) => (
                              <ElementorHeroInfoCard
                                id={card.id}
                                key={card.id}
                                kind={card.kind}
                                label={renderInspectableText(`hero.detailCards.${index}.label`, card.label)}
                                value={renderInspectableText(`hero.detailCards.${index}.value`, card.value)}
                              />
                            ))}
                            <div
                              className="elementor-element elementor-element-d43feaa elementor-align-justify elementor-widget__width-initial main_btn elementor-widget elementor-widget-button"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="d43feaa"
                              data-widget_type="button.default"
                            >
                              <div className="elementor-widget-container">
                                <div className="elementor-button-wrapper">
                                  <RegisterAction
                                    className="elementor-button elementor-button-link elementor-size-sm"
                                    onMissingRegisterLink={showMissingRegisterFallback}
                                    site={site}
                                  >
                                    <ElementorRegisterButtonContent>{registerLabel}</ElementorRegisterButtonContent>
                                  </RegisterAction>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <Marquee coachName={coachName} />

          <section className="yw-story-section" id="story" aria-labelledby="yw-story-title" data-yw-section-key="coach">
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
                  {renderInspectableText("intro.heading", sectionCopy.trustHeading)}{" "}
                  <span>{renderInspectableText("vision.label", sectionCopy.trustLabel)}</span>
                </h2>
                <p>{renderInspectableText("intro.body", sectionCopy.trustIntro)}</p>
                <p>{renderInspectableText("vision.body", sectionCopy.trustMission)}</p>
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

          <section className="yw-growth-suite" aria-label="Coaching blueprint sections">
          <section
            className="yw-sales-section yw-sales-section--cream"
            id="problem"
            aria-labelledby="yw-familiar-title"
            data-yw-section-key="problem"
          >
            <div
              className={getPreviewInspectClassName("yw-sales-shell")}
              data-preview-section="problem"
              {...getPreviewInspectProps("problem")}
            >
              {renderInspectHotspot("problem")}
              <p className="yw-kicker">
                {renderInspectableText("problem.sectionLabel", sectionCopy.problemLabel)}
              </p>
              <h2 id="yw-familiar-title">
                {renderInspectableText("problem.heading", sectionCopy.problemHeading)}
              </h2>
              <div className="yw-check-grid">
                {sectionCopy.problemPoints.map((point, index) => (
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

          <section
            className="yw-sales-section yw-sales-section--mint"
            id="how-it-works"
            aria-labelledby="yw-blueprint-title"
            data-yw-section-key="journey"
          >
            <div
              className={getPreviewInspectClassName("yw-sales-shell")}
              data-preview-section="journey"
              {...getPreviewInspectProps("journey")}
            >
              {renderInspectHotspot("journey")}
              <p className="yw-kicker">
                {renderInspectableText("journey.sectionLabel", sectionCopy.journeyLabel)}
              </p>
              <h2 id="yw-blueprint-title">
                {renderInspectableText("journey.heading", sectionCopy.journeyHeading)}
              </h2>
              <div className="yw-blueprint-grid">
                {sectionCopy.journeySteps.map((step, index) => (
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
            className="yw-sales-section yw-sales-section--dark"
            id="results"
            aria-labelledby="yw-results-title"
            data-yw-section-key="results"
          >
            <div className="yw-sales-shell">
              <p className="yw-kicker">{renderInspectableText("results.sectionLabel", sectionCopy.resultsLabel)}</p>
              <h2 id="yw-results-title">
                {renderInspectableText("results.heading", sectionCopy.resultsHeadingMain)}{" "}
                <span>{renderInspectableText("results.highlight", sectionCopy.resultsHeadingAccent)}</span>
              </h2>
              <p className="yw-section-subcopy">
                {renderInspectableText("results.subcopy", sectionCopy.resultsSubcopy)}
              </p>
              <div className="yw-result-cards">
                {sectionCopy.resultsCards.map((card, index) => (
                  <article key={`${card.title}-${index}`}>
                    <span>{renderInspectableText(`results.cards.${index}.label`, card.label)}</span>
                    <h3>{renderInspectableText(`results.cards.${index}.title`, card.title)}</h3>
                    <p>{renderInspectableText(`results.cards.${index}.body`, card.body)}</p>
                    <strong>{renderInspectableText(`results.cards.${index}.attribution`, card.attribution)}</strong>
                  </article>
                ))}
              </div>
              <RegisterAction
                className="yw-register-strip yw-register-strip--dark"
                onMissingRegisterLink={showMissingRegisterFallback}
                site={site}
              >
                {registerLabel}
              </RegisterAction>
            </div>
          </section>

          <section
            className="yw-sales-section yw-sales-section--cream"
            id="for-you"
            aria-labelledby="yw-fit-title"
            data-yw-section-key="fit"
          >
            <div className="yw-sales-shell">
              <h2 id="yw-fit-title">
                {renderInspectableText("fit.heading", sectionCopy.fitHeadingMain)}{" "}
                <span>{renderInspectableText("fit.highlight", sectionCopy.fitHeadingAccent)}</span>
              </h2>
              <div className="yw-fit-table" aria-label={sectionCopy.fitAriaLabel}>
                <div className="yw-fit-col">
                  <h3>This IS for you if...</h3>
                  {sectionCopy.fitForPoints.map((point, index) => (
                    <p key={`${point}-${index}`}>
                      <span aria-hidden="true">{"\u2713"}</span> {renderInspectableText(`fit.for.${index}`, point)}
                    </p>
                  ))}
                </div>
                <div className="yw-fit-col yw-fit-col--no">
                  <h3>This is NOT for you if...</h3>
                  {sectionCopy.fitNotForPoints.map((point, index) => (
                    <p key={`${point}-${index}`}>
                      <span aria-hidden="true">{"\u00d7"}</span> {renderInspectableText(`fit.notFor.${index}`, point)}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            className="yw-sales-section yw-sales-section--dark yw-sales-section--bonus yw-niche-bonus"
            data-yw-ai-adaptive="true"
            data-yw-bonus-count={bonusSection.items.length}
            data-yw-bonus-source="universalBonusRegistry"
            data-yw-coach-name={coachName}
            data-yw-coach-niche={coachNiche}
            data-yw-editable-slots="bonus.eyebrow,bonus.heading,bonus.subheading,bonus.items[].description,bonus.ctaHelperText"
            data-yw-locked-fields="bonus.id,bonus.lockedAssetId,bonus.items[].displayTitle,bonus.items[].title,bonus.visualType,bonus.assetType,bonus.actualAssetUrl,bonus.actualValue,bonus.actualAvailability,legal.disclaimer,cta.destination,analytics.tracking"
            data-yw-template-rule="nicheAdaptiveBonusSection"
            id="bonus"
            aria-labelledby="yw-bonus-title"
            data-yw-section-key="bonuses"
          >
            <div
              className={getPreviewInspectClassName("yw-sales-shell yw-bonus-shell")}
              data-preview-section="bonus"
              {...getPreviewInspectProps("bonus")}
            >
              {renderInspectHotspot("bonus")}
              <p className="yw-bonus-kicker">{renderInspectableText("bonus.eyebrow", bonusSection.eyebrow)}</p>
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
                    data-bonus-actual-availability={bonus.actualAvailability ? "true" : "false"}
                    data-bonus-locked-asset="true"
                    data-bonus-visual-type={bonus.visualType}
                    data-yw-registry-source="universalBonusRegistry"
                    key={bonus.id}
                  >
                    <div className="yw-bonus-card-top">
                      <div className="yw-bonus-badge">{bonus.badge}</div>
                      <p className="yw-bonus-type">{bonus.typeLabel}</p>
                    </div>
                    <SmartBonusVisual
                      bonus={bonus}
                      index={index}
                      niche={coachNiche}
                      themeId={selectedTheme.id}
                    />
                    <h3>{bonus.displayTitle}</h3>
                    <p>{renderInspectableText(`bonus.items.${index}.description`, bonus.description)}</p>
                    <strong data-yw-locked="actualValue">{bonus.valueDisplay}</strong>
                  </article>
                ))}
              </div>
              <div className="yw-bonus-cta-panel">
                <p className="yw-bonus-total" data-yw-bonus-total>
                  {bonusSection.ctaHeading}
                </p>
                <p className="yw-bonus-cta-copy">
                  {renderInspectableText("bonus.ctaHelperText", bonusSection.ctaHelperText)}
                </p>
                <RegisterAction
                  className="yw-register-strip yw-register-strip--dark yw-bonus-cta"
                  onMissingRegisterLink={showMissingRegisterFallback}
                  site={site}
                >
                  {bonusSection.ctaButtonText}
                </RegisterAction>
              </div>
            </div>
          </section>

          <section className="yw-sales-section yw-sales-section--final" aria-labelledby="yw-final-cta-title" data-yw-section-key="final-cta">
            <div className="yw-sales-shell yw-final-cta">
              <h2 id="yw-final-cta-title">
                {renderInspectableText("cta.heading", sectionCopy.finalHeadingMain)}{" "}
                <span>{renderInspectableText("cta.highlight", sectionCopy.finalHeadingAccent)}</span>
              </h2>
              <p>{renderInspectableText("cta.body", sectionCopy.finalBody)}</p>
              <RegisterAction
                className="yw-register-strip yw-register-strip--dark"
                onMissingRegisterLink={showMissingRegisterFallback}
                site={site}
              >
                {registerLabel}
              </RegisterAction>
            </div>
          </section>
          </section>

          <div
            className={getPreviewInspectClassName("elementor elementor-11246 yw-circle-faq")}
            data-elementor-id="11246"
            data-elementor-post-type="page"
            data-elementor-type="wp-page"
            data-preview-section="faq"
            data-yw-section-key="faq"
            id="faq"
            {...getPreviewInspectProps("faq")}
          >
            {renderInspectHotspot("faq")}
            <section
              className="elementor-section elementor-top-section elementor-element elementor-element-01e9f7a elementor-section-boxed elementor-section-height-default elementor-section-height-default"
              data-e-type="section"
              data-element_type="section"
              data-id="01e9f7a"
              data-settings='{"background_background":"classic"}'
            >
              <div className="elementor-container elementor-column-gap-default">
                <div
                  className="elementor-column elementor-col-100 elementor-top-column elementor-element elementor-element-3db758d"
                  data-e-type="column"
                  data-element_type="column"
                  data-id="3db758d"
                >
                  <div className="elementor-widget-wrap elementor-element-populated">
                    <section
                      className="elementor-section elementor-inner-section elementor-element elementor-element-0d3c8f6 elementor-section-boxed elementor-section-height-default elementor-section-height-default"
                      data-e-type="section"
                      data-element_type="section"
                      data-id="0d3c8f6"
                    >
                      <div className="elementor-container elementor-column-gap-default">
                        <div
                          className="elementor-column elementor-col-100 elementor-inner-column elementor-element elementor-element-07d4fd5"
                          data-e-type="column"
                          data-element_type="column"
                          data-id="07d4fd5"
                        >
                          <div className="elementor-widget-wrap elementor-element-populated">
                            <div
                              className="elementor-element elementor-element-62d1791 elementor-widget__width-initial elementor-widget elementor-widget-heading"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="62d1791"
                              data-widget_type="heading.default"
                            >
                              <div className="elementor-widget-container">
                                <h2 className="elementor-heading-title elementor-size-default" id="yw-faq-title">
                                  {renderInspectableText("faq.heading", sectionCopy.faqHeading)}{" "}
                                  <span className="brown-hoghlight-cu">
                                    {renderInspectableText("faq.sectionLabel", sectionCopy.faqLabel)}
                                  </span>
                                </h2>
                              </div>
                            </div>
                            <div
                              className="elementor-element elementor-element-75413a5 elementor-widget elementor-widget-accordion"
                              data-e-type="widget"
                              data-element_type="widget"
                              data-id="75413a5"
                              data-widget_type="accordion.default"
                            >
                              <div className="elementor-widget-container">
                                <div className="elementor-accordion">
                                  {sectionCopy.faqItems.map((item, index) => (
                                    <details className="elementor-accordion-item" key={`${item.question}-${index}`}>
                                      <summary
                                        aria-controls={`elementor-tab-content-122${index + 1}`}
                                        aria-expanded={false}
                                        className="elementor-tab-title"
                                        data-tab={index + 1}
                                        id={`elementor-tab-title-122${index + 1}`}
                                        role="button"
                                      >
                                        <span className="elementor-accordion-icon elementor-accordion-icon-right" aria-hidden="true">
                                          <span className="elementor-accordion-icon-closed">+</span>
                                          <span className="elementor-accordion-icon-opened">-</span>
                                        </span>
                                        <span className="elementor-accordion-title">
                                          {renderInspectableText(`faq.items.${index}.question`, item.question)}
                                        </span>
                                      </summary>
                                      <div
                                        aria-hidden={true}
                                        aria-labelledby={`elementor-tab-title-122${index + 1}`}
                                        className="elementor-tab-content elementor-clearfix"
                                        data-tab={index + 1}
                                        id={`elementor-tab-content-122${index + 1}`}
                                        role="region"
                                      >
                                        <p>{renderInspectableText(`faq.items.${index}.answer`, item.answer)}</p>
                                      </div>
                                    </details>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer
            id="yw-footer"
            className={getPreviewInspectClassName("yw-brand-footer")}
            data-preview-section="footer"
            data-yw-section-key="contact"
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
                <Link href={`/privacy?returnTo=${encodeURIComponent(coachLandingPath)}`}>Privacy Policy</Link>
                <Link href={`/terms?returnTo=${encodeURIComponent(coachLandingPath)}`}>Terms &amp; Conditions</Link>
                <Link href={`/disclaimer?returnTo=${encodeURIComponent(coachLandingPath)}`}>Disclaimer</Link>
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
        </main>

        {site.googleFormUrl ? (
          <a
            aria-hidden={floatingCtaVisible ? "false" : "true"}
            className="yw-floating-register-cta"
            data-track="coach_register_click"
            data-yw-sticky-register
            href={site.googleFormUrl}
            onClick={() => void recordCoachEvent("coach_register_click", site.slug)}
            rel="noreferrer"
            tabIndex={floatingCtaVisible ? 0 : -1}
            target="_blank"
          >
            <span className="yw-floating-register-cta__eyebrow">{sectionCopy.stickyCtaEyebrow}</span>
            <strong>{registerLabel}</strong>
          </a>
        ) : (
          <button
            aria-hidden={floatingCtaVisible ? "false" : "true"}
            className="yw-floating-register-cta"
            data-missing-link="true"
            data-yw-sticky-register
            onClick={() => {
              void recordCoachEvent("coach_register_missing_link", site.slug);
              showMissingRegisterFallback();
            }}
            tabIndex={floatingCtaVisible ? 0 : -1}
            type="button"
          >
            <span className="yw-floating-register-cta__eyebrow">{sectionCopy.stickyCtaEyebrow}</span>
            <strong>Registration link pending</strong>
          </button>
        )}
      </div>
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

function CoachCircleNavbar({
  onMissingRegisterLink,
  registerLabel,
  site
}: {
  onMissingRegisterLink: () => void;
  registerLabel: string;
  site: PublicCoachSiteRecord;
}) {
  const navbarSections = getCanonicalCoachNavbarSections();

  return (
    <div
      className="navbar14_component w-nav"
      data-animation="default"
      data-collapse="medium"
      data-duration="400"
      data-easing="ease"
      data-easing2="ease"
      data-w-id="ca82c3a1-896f-47be-4f7e-70e88912ab95"
      role="banner"
    >
      <div className="navbar14_container">
        <Link
          aria-label="YW Nutritech home"
          className="navbar14_logo-link w-nav-brand w--current yw-navbar-brand"
          data-yw-nav-link="true"
          data-yw-section-key="hero"
          href="#home"
        >
          <span className="yw-navbar-mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" decoding="async" loading="eager" src="/assets/yw-logo-transparent.png" />
          </span>
          <span className="yw-navbar-wordmark">
            <strong>YWN</strong>
          </span>
        </Link>
        <nav
          aria-label="Coach page sections"
          className="navbar14_menu w-nav-menu"
          data-yw-nav-menu
          id="w-node-ca82c3a1-896f-47be-4f7e-70e88912ab99-8912ab95"
          role="navigation"
        >
          <div className="navbar14_menu-link-wrapper">
            <div className="navbar14_menu-links">
              {navbarSections.map((section) => (
                <a
                  className="navbar14_link w-nav-link"
                  data-yw-nav-link="true"
                  data-yw-section-key={section.sectionKey}
                  href={section.anchorTarget}
                  key={section.sectionKey}
                >
                  {section.navLabel}
                </a>
              ))}
              <RegisterAction
                className="navbar14_register w-nav-link"
                onMissingRegisterLink={onMissingRegisterLink}
                site={site}
              >
                <span aria-hidden="true" className="navbar14_register-icon">
                  <RegisterPointerIcon />
                </span>
                <span>{registerLabel}</span>
              </RegisterAction>
            </div>
          </div>
        </nav>
        <button
          aria-controls="w-node-ca82c3a1-896f-47be-4f7e-70e88912ab99-8912ab95"
          aria-expanded="false"
          aria-label="Open coach site menu"
          className="navbar14_menu-button w-nav-button"
          data-yw-nav-toggle
          type="button"
        >
          <div className="menu-icon2">
            <div className="menu-icon2_line-top" />
            <div className="menu-icon2_line-middle">
              <div className="menu-icon1_line-middle-inner" />
            </div>
            <div className="menu-icon2_line-bottom" />
          </div>
        </button>
      </div>
    </div>
  );
}

function ElementorHeroInfoCard({
  id,
  kind,
  label,
  value
}: {
  id: string;
  kind: CanonicalHeroInfoCardKind;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div
      className={`elementor-element elementor-element-${id} pp-info-box-left elementor-widget__width-initial elementor-widget elementor-widget-pp-info-box`}
      data-e-type="widget"
      data-element_type="widget"
      data-id={id}
      data-widget_type="pp-info-box.default"
    >
      <div className="elementor-widget-container">
        <div className="pp-info-box-container">
          <div className="pp-info-box">
            <div className="pp-info-box-icon-wrap">
              <span className="pp-info-box-icon pp-icon">
                <HeroInfoIcon kind={kind} />
              </span>
            </div>
            <div className="pp-info-box-content">
              <div className="pp-info-box-title-wrap">
                <div className="pp-info-box-title-container">
                  <h4 className="pp-info-box-title">{label}</h4>
                </div>
                <h5 className="pp-info-box-subtitle">{value}</h5>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroInfoIcon({ kind }: { kind: CanonicalHeroInfoCardKind }) {
  if (kind === "date") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <rect className="yw-hero-icon-stroke" height="16" rx="2.25" width="16" x="4" y="5" />
        <line className="yw-hero-icon-stroke" x1="8" x2="8" y1="3.5" y2="7" />
        <line className="yw-hero-icon-stroke" x1="16" x2="16" y1="3.5" y2="7" />
        <line className="yw-hero-icon-stroke" x1="4.75" x2="19.25" y1="9.25" y2="9.25" />
        <circle className="yw-hero-icon-fill" cx="8.15" cy="13.2" r="0.8" />
        <circle className="yw-hero-icon-fill" cx="12" cy="13.2" r="0.8" />
        <circle className="yw-hero-icon-fill" cx="15.85" cy="13.2" r="0.8" />
        <circle className="yw-hero-icon-fill" cx="8.15" cy="16.8" r="0.8" />
        <circle className="yw-hero-icon-fill" cx="12" cy="16.8" r="0.8" />
      </svg>
    );
  }

  if (kind === "time") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <circle className="yw-hero-icon-stroke" cx="12" cy="12" r="8.45" />
        <line className="yw-hero-icon-stroke" x1="12" x2="12" y1="7.2" y2="12.35" />
        <line className="yw-hero-icon-stroke" x1="12" x2="15.3" y1="12.35" y2="15.05" />
      </svg>
    );
  }

  if (kind === "duration") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <line className="yw-hero-icon-stroke" x1="6.2" x2="17.8" y1="4.5" y2="4.5" />
        <line className="yw-hero-icon-stroke" x1="6.2" x2="17.8" y1="19.5" y2="19.5" />
        <path className="yw-hero-icon-stroke" d="M8 4.5v3.1c0 1.4.78 2.68 2.02 3.32L12 12l1.98-1.08A3.72 3.72 0 0 0 16 7.6V4.5" />
        <path className="yw-hero-icon-stroke" d="M8 19.5v-3.1c0-1.4.78-2.68 2.02-3.32L12 12l1.98 1.08A3.72 3.72 0 0 1 16 16.4v3.1" />
      </svg>
    );
  }

  if (kind === "focus") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <circle className="yw-hero-icon-stroke" cx="12" cy="12" r="8.2" />
        <circle className="yw-hero-icon-stroke" cx="12" cy="12" r="3.6" />
        <circle className="yw-hero-icon-fill" cx="12" cy="12" r="1.35" />
      </svg>
    );
  }

  if (kind === "support") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <path className="yw-hero-icon-stroke" d="M7.2 12.5c-1.55 0-2.8-1.25-2.8-2.8s1.25-2.8 2.8-2.8 2.8 1.25 2.8 2.8-1.25 2.8-2.8 2.8Z" />
        <path className="yw-hero-icon-stroke" d="M16.8 12.5c-1.55 0-2.8-1.25-2.8-2.8s1.25-2.8 2.8-2.8 2.8 1.25 2.8 2.8-1.25 2.8-2.8 2.8Z" />
        <path className="yw-hero-icon-stroke" d="M3.7 18.5c.72-2.05 1.95-3.08 3.5-3.08s2.78 1.03 3.5 3.08" />
        <path className="yw-hero-icon-stroke" d="M13.3 18.5c.72-2.05 1.95-3.08 3.5-3.08s2.78 1.03 3.5 3.08" />
      </svg>
    );
  }

  if (kind === "next") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <path className="yw-hero-icon-stroke" d="M5 12h12.5" />
        <path className="yw-hero-icon-stroke" d="m13 7.5 4.5 4.5-4.5 4.5" />
        <path className="yw-hero-icon-stroke" d="M4.8 5.2h14.4v13.6H4.8z" />
      </svg>
    );
  }

  if (kind === "location") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <path className="yw-hero-icon-stroke" d="M12 20.5s6.2-5.15 6.2-10.05A6.2 6.2 0 0 0 5.8 10.45C5.8 15.35 12 20.5 12 20.5Z" />
        <circle className="yw-hero-icon-stroke" cx="12" cy="10.35" r="2.25" />
      </svg>
    );
  }

  if (kind === "format") {
    return (
      <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
        <rect className="yw-hero-icon-stroke" height="12.5" rx="2" width="16" x="4" y="5.5" />
        <path className="yw-hero-icon-stroke" d="M8 18.5h8" />
        <path className="yw-hero-icon-stroke" d="M10 9h4M8.5 12h7" />
      </svg>
    );
  }

  return (
    <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <circle className="yw-hero-icon-stroke" cx="12" cy="12" r="8.5" />
      <path className="yw-hero-icon-stroke" d="M4 12h16" />
      <path className="yw-hero-icon-stroke" d="M12 3.5c2.15 2.35 3.25 5.18 3.25 8.5S14.15 18.15 12 20.5" />
      <path className="yw-hero-icon-stroke" d="M12 3.5C9.85 5.85 8.75 8.68 8.75 12s1.1 6.15 3.25 8.5" />
    </svg>
  );
}

function ElementorRegisterButtonContent({ children }: { children: ReactNode }) {
  return (
    <span className="elementor-button-content-wrapper">
      <span className="elementor-button-icon" aria-hidden="true">
        <RegisterPointerIcon />
      </span>
      <span className="elementor-button-text">{children}</span>
    </span>
  );
}

function RegisterPointerIcon() {
  return (
    <svg fill="none" height="24" viewBox="0 0 227 159" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M135.53 61.9503C141.303 70.1296 139.577 81.3622 131.807 87.4932H136.935C145.051 87.4932 151.653 80.8898 151.653 72.7738C151.653 64.6579 145.05 58.0544 136.935 58.0544H132.784L135.53 61.9503Z" fill="black" />
      <path d="M104.84 83.5986L91.3346 64.4136C89.6418 66.8553 88.7175 69.746 88.7175 72.774C88.7175 80.891 95.321 87.4934 103.437 87.4934H108.524C107.134 86.3899 105.891 85.0877 104.84 83.5986Z" fill="black" />
      <path d="M103.436 91.5522C95.319 91.5522 88.7166 98.1557 88.7166 106.272C88.7166 114.389 95.32 120.991 103.436 120.991H133.584C141.701 120.991 148.303 114.388 148.303 106.272C148.303 98.1547 141.7 91.5522 133.584 91.5522H103.436Z" fill="black" />
      <path d="M103.436 125.051C95.3191 125.051 88.7166 131.654 88.7166 139.77C88.7166 147.887 95.3201 154.489 103.436 154.489H130.233C138.35 154.489 144.953 147.886 144.953 139.77C144.953 131.653 138.349 125.051 130.233 125.051H103.436Z" fill="black" />
      <path d="M39.8686 14.1858C33.795 15.5357 28.3915 18.5335 24.2424 22.8549C20.854 26.3836 17.7851 30.2463 15.1213 34.3389C6.91087 46.9477 2.57094 61.6019 2.57094 76.7177C2.57094 119.602 37.459 154.49 80.3433 154.49H91.8106C87.461 151.048 84.6569 145.735 84.6569 139.771C84.6569 132.455 88.8703 126.12 94.9896 123.021C88.8703 119.923 84.6569 113.588 84.6569 106.272C84.6569 98.957 88.8703 92.6224 94.9896 89.5232C88.8703 86.4251 84.6569 80.0895 84.6569 72.7741C84.6569 68.4098 86.1471 64.2647 88.8751 60.922L83.7804 53.6846C82.5639 51.9568 80.654 50.977 78.5415 50.9974C76.426 51.0179 74.5327 52.0357 73.3474 53.7907C63.3614 68.5666 48.4968 79.8304 31.4916 85.5057C30.428 85.8602 29.2788 85.2865 28.9233 84.223C28.5648 83.1575 29.1434 82.0101 30.206 81.6546C46.3688 76.2599 60.496 65.5571 69.9843 51.5175C71.9 48.6823 75.0839 46.9711 78.5025 46.938C81.9172 46.9049 85.1312 48.5528 87.0996 51.3471L108.158 81.2592C110.423 84.4703 113.805 86.6082 117.679 87.2773C121.553 87.9464 125.457 87.0669 128.669 84.8005C135.303 80.1207 136.89 70.9168 132.212 64.288L94.8075 11.2405C91.3753 6.37269 85.3991 4.0615 79.5855 5.35394L39.8686 14.1858Z" fill="black" />
      <path d="M209.281 53.9952C217.398 53.9952 224 47.3918 224 39.2758C224 31.1598 217.397 24.5564 209.281 24.5564L109.164 24.5564L129.922 53.9952L209.281 53.9952Z" fill="black" />
    </svg>
  );
}

function Marquee({ coachName }: { coachName: string }) {
  const star = "\u2605";

  return (
    <section
      id="circle-marquee"
      className="circle-marquee"
      aria-label="Coach circle marquee"
      data-yw-circle-marquee
      data-yw-marquee-brand="YW NUTRITECH CIRCLE"
      data-yw-marquee-name={coachName}
      data-yw-marquee-repeats="20"
    >
      <div className="circle-marquee__track">
        {Array.from({ length: 20 }).map((_, index) => (
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
    const imageModeClass =
      heroMedia.imageMode === "cutout" ? "yw-coach-hero-image--cutout" : "yw-coach-hero-image--framed";

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${site.coachName} profile`}
        className={`attachment-full size-full yw-coach-hero-image ${imageModeClass}`}
        data-image-mode={heroMedia.imageMode}
        data-yw-coach-image
        decoding="async"
        fetchPriority="high"
        height="2200"
        onError={handleMediaError}
        src={heroMedia.imageUrl}
        width="1650"
      />
    );
  }

  return <span className="yw-coach-hero-image yw-coach-hero-image--empty">{getCanonicalCoachInitials(site)}</span>;
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
        className="yw-story-video"
        onError={handleMediaError}
        src={heroMedia.embedVideoUrl}
        title={`${site.coachName} story video`}
      />
    );
  }

  if (heroMedia.uploadedVideoUrl) {
    return (
      <video
        className="yw-story-video"
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
    imageMode: getHeroImageMode(imageUrl),
    imageUrl,
    uploadedVideoUrl
  };
}

function getHeroImageMode(imageUrl: string) {
  if (!imageUrl) return "avatarFallback";

  const normalizedUrl = safeDecodeUriComponent(imageUrl).toLowerCase();
  if (normalizedUrl.includes("/cutout/") || normalizedUrl.includes("-cutout.")) {
    return "cutout";
  }

  return "framed";
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
