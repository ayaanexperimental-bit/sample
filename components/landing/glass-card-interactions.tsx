"use client";

import { useEffect } from "react";

const LIQUID_RIPPLE_SELECTOR = [
  ".ui-button",
  ".checkout-button",
  ".sticky-offer-button",
  ".pricing-button",
  "button[data-ripple='liquid']",
  "a[data-ripple='liquid']"
].join(",");

const GLASS_TOUCH_SELECTOR = [
  ".ui-button",
  ".checkout-button",
  ".sticky-offer-button",
  ".pricing-button",
  "button[data-ripple='liquid']",
  "a[data-ripple='liquid']",
  ".site-header",
  ".site-nav a",
  ".ui-badge",
  ".funnel-status__urgency",
  ".funnel-status__live",
  ".sticky-offer-bar",
  ".glass-card",
  "[data-slot='card']",
  ".audience-panel",
  ".learning-card",
  ".method-pillar",
  ".outcomes-card",
  ".testimonial-card",
  ".bonus-item",
  ".logistics-item",
  ".pricing-card",
  ".faq-item",
  ".hero-details li",
  ".hero-photo-slot",
  ".hero-media-caption",
  ".credibility-item",
  ".success-panel",
  ".success-document",
  ".policy-document",
  ".prompt-lab-shell",
  ".prompt-example-card",
  ".liquid-lab-panel",
  ".liquid-lab-grid article"
].join(",");

const MOBILE_GLASS_FILTER = "none";
const DISABLED_CONTROL_SELECTOR = "[disabled], [aria-disabled='true'], [data-loading='true'], .is-loading";
const NON_RIPPLE_GLASS_SELECTOR = ".hero-details li";
const DESKTOP_RIPPLE_COUNT = 2;

function stabilizeMobileGlassSurfaces() {
  const isMobileViewport = window.matchMedia("(max-width: 760px)").matches;

  document.querySelectorAll<HTMLElement>(GLASS_TOUCH_SELECTOR).forEach((surface) => {
    if (!isMobileViewport) {
      surface.style.removeProperty("backdrop-filter");
      surface.style.removeProperty("-webkit-backdrop-filter");
      surface.style.removeProperty("background-clip");
      surface.style.removeProperty("outline");
      surface.style.removeProperty("overflow");
      return;
    }

    surface.style.setProperty("backdrop-filter", MOBILE_GLASS_FILTER, "important");
    surface.style.setProperty("-webkit-backdrop-filter", MOBILE_GLASS_FILTER, "important");
    surface.style.setProperty("background-clip", "padding-box", "important");
    surface.style.setProperty("overflow", "hidden", "important");
    surface.style.setProperty("outline", "0", "important");
  });
}

function ensureWaterSurface(control: HTMLElement) {
  if (control.querySelector(":scope > .liquid-button-pool")) {
    return;
  }

  const pool = document.createElement("span");
  pool.className = "liquid-button-pool";
  pool.setAttribute("aria-hidden", "true");

  const depth = document.createElement("span");
  depth.className = "liquid-button-pool__depth";

  const caustics = document.createElement("span");
  caustics.className = "liquid-button-pool__caustics";

  const meniscus = document.createElement("span");
  meniscus.className = "liquid-button-pool__meniscus";

  const pressure = document.createElement("span");
  pressure.className = "liquid-button-pool__pressure";

  pool.append(depth, caustics, pressure, meniscus);
  control.prepend(pool);
}

function isUnavailableControl(control: HTMLElement) {
  return control.matches(DISABLED_CONTROL_SELECTOR);
}

function resetLiquidControl(control: HTMLElement) {
  control.classList.remove(
    "liquid-cta-pressed",
    "liquid-cta-rippling",
    "liquid-cta-releasing",
    "liquid-cta-settling"
  );
  control.style.removeProperty("--water-x");
  control.style.removeProperty("--water-y");
  control.querySelectorAll(":scope .liquid-water-ripple").forEach((effect) => effect.remove());
}

export function ButtonRippleInteractions() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const managedTimeouts = new Set<number>();
    let activeControl: HTMLElement | null = null;
    let pendingMove: { control: HTMLElement; clientX: number; clientY: number } | null = null;
    let pointerMoveFrame = 0;
    let stabilizeFrame = 0;
    let hydrateFrame = 0;

    stabilizeMobileGlassSurfaces();

    if (reduceMotion) {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const hydrateVisibleControls = () => {
      document.querySelectorAll<HTMLElement>(LIQUID_RIPPLE_SELECTOR).forEach((control) => {
        const rect = control.getBoundingClientRect();

        if (rect.bottom >= 0 && rect.top <= window.innerHeight + 160) {
          ensureWaterSurface(control);
        }
      });
    };

    const scheduleHydrateVisibleControls = () => {
      if (hydrateFrame !== 0) {
        return;
      }

      hydrateFrame = window.requestAnimationFrame(() => {
        hydrateFrame = 0;
        hydrateVisibleControls();
      });
    };

    const idleHandle =
      idleWindow.requestIdleCallback?.(hydrateVisibleControls, { timeout: coarsePointer ? 900 : 1400 }) ??
      window.setTimeout(hydrateVisibleControls, coarsePointer ? 500 : 1000);

    function scheduleManagedTimeout(callback: () => void, delay: number) {
      const timeoutId = window.setTimeout(() => {
        managedTimeouts.delete(timeoutId);
        callback();
      }, delay);

      managedTimeouts.add(timeoutId);
      return timeoutId;
    }

    function scheduleMobileGlassStabilization() {
      if (stabilizeFrame !== 0) {
        return;
      }

      stabilizeFrame = window.requestAnimationFrame(() => {
        stabilizeFrame = 0;
        stabilizeMobileGlassSurfaces();
      });
    }

    function updateWaterOrigin(control: HTMLElement, clientX: number, clientY: number) {
      const rect = control.getBoundingClientRect();
      const originX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const originY = Math.max(0, Math.min(rect.height, clientY - rect.top));

      control.style.setProperty("--water-x", `${originX}px`);
      control.style.setProperty("--water-y", `${originY}px`);

      return { rect, originX, originY };
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 && event.pointerType === "mouse") {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (coarsePointer) {
        const touchedCard = target.closest<HTMLElement>(GLASS_TOUCH_SELECTOR);

        if (
          touchedCard &&
          !touchedCard.matches(NON_RIPPLE_GLASS_SELECTOR) &&
          !target.closest(LIQUID_RIPPLE_SELECTOR)
        ) {
          const rect = touchedCard.getBoundingClientRect();
          const originX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
          const originY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
          const rippleSize = Math.min(Math.max(rect.width, rect.height) * 1.25, 260);
          const ripple = document.createElement("i");

          ripple.className = "glass-card-ripple";
          ripple.setAttribute("aria-hidden", "true");
          ripple.style.width = `${rippleSize}px`;
          ripple.style.height = `${rippleSize}px`;
          ripple.style.left = `${originX - rippleSize / 2}px`;
          ripple.style.top = `${originY - rippleSize / 2}px`;

          touchedCard.classList.remove("is-touch-releasing");
          touchedCard.classList.add("is-touch-active");
          touchedCard.querySelectorAll(":scope > .glass-card-ripple").forEach((activeRipple) => activeRipple.remove());
          touchedCard.append(ripple);

          scheduleManagedTimeout(() => ripple.remove(), 700);
          scheduleManagedTimeout(() => {
            touchedCard.classList.remove("is-touch-active");
            touchedCard.classList.add("is-touch-releasing");
            scheduleManagedTimeout(() => touchedCard.classList.remove("is-touch-releasing"), 240);
          }, 260);
        }
      }

      const control = target.closest<HTMLElement>(LIQUID_RIPPLE_SELECTOR);
      if (!control || isUnavailableControl(control)) {
        return;
      }

      ensureWaterSurface(control);
      resetLiquidControl(control);

      const { rect, originX, originY } = updateWaterOrigin(control, event.clientX, event.clientY);
      const baseSize = Math.max(rect.width, rect.height);
      const size = Math.min(baseSize * 1.32, control.classList.contains("sticky-offer-button") ? 140 : 240);
      const pool = control.querySelector<HTMLElement>(":scope > .liquid-button-pool");
      const rippleCount = coarsePointer ? 1 : DESKTOP_RIPPLE_COUNT;
      const ripples = Array.from({ length: rippleCount }, (_, index) => {
        const ripple = document.createElement("span");
        const rippleSize = size * (0.32 + index * 0.14);

        ripple.className = `liquid-water-ripple liquid-water-ripple--${index + 1}`;
        ripple.style.width = `${rippleSize}px`;
        ripple.style.height = `${rippleSize}px`;
        ripple.style.left = `${originX - rippleSize / 2}px`;
        ripple.style.top = `${originY - rippleSize / 2}px`;
        ripple.style.animationDelay = `${index * 46}ms`;

        return ripple;
      });

      if (!coarsePointer) {
        control.setPointerCapture?.(event.pointerId);
      }
      activeControl = control;
      control.classList.add("liquid-cta-pressed");
      control.classList.add("liquid-cta-rippling");
      pool?.append(...ripples);
      scheduleManagedTimeout(() => {
        ripples.forEach((ripple) => ripple.remove());
        resetLiquidControl(control);
      }, coarsePointer ? 520 : 620);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!activeControl) {
        return;
      }

      pendingMove = {
        control: activeControl,
        clientX: event.clientX,
        clientY: event.clientY
      };

      if (pointerMoveFrame !== 0) {
        return;
      }

      pointerMoveFrame = window.requestAnimationFrame(() => {
        pointerMoveFrame = 0;

        if (!pendingMove) {
          return;
        }

        updateWaterOrigin(pendingMove.control, pendingMove.clientX, pendingMove.clientY);
        pendingMove = null;
      });
    }

    function releasePressedControls(event: PointerEvent) {
      const control = activeControl;
      activeControl = null;
      pendingMove = null;

      if (!control) {
        return;
      }

      control.releasePointerCapture?.(event.pointerId);
      control.classList.remove("liquid-cta-pressed");
      control.classList.add("liquid-cta-releasing");
      scheduleManagedTimeout(() => control.classList.remove("liquid-cta-releasing"), 220);
    }

    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    if (!coarsePointer) {
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
    }
    document.addEventListener("pointerup", releasePressedControls, { passive: true });
    document.addEventListener("pointercancel", releasePressedControls, { passive: true });
    document.addEventListener("scroll", scheduleHydrateVisibleControls, { passive: true });
    window.addEventListener("resize", scheduleMobileGlassStabilization, { passive: true });
    window.addEventListener("orientationchange", scheduleMobileGlassStabilization, { passive: true });

    return () => {
      if (idleHandle && idleWindow.cancelIdleCallback && typeof idleHandle === "number") {
        idleWindow.cancelIdleCallback(idleHandle);
      } else if (idleHandle) {
        window.clearTimeout(idleHandle);
      }

      managedTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      managedTimeouts.clear();
      if (pointerMoveFrame !== 0) {
        window.cancelAnimationFrame(pointerMoveFrame);
      }
      if (stabilizeFrame !== 0) {
        window.cancelAnimationFrame(stabilizeFrame);
      }
      if (hydrateFrame !== 0) {
        window.cancelAnimationFrame(hydrateFrame);
      }

      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", releasePressedControls);
      document.removeEventListener("pointercancel", releasePressedControls);
      document.removeEventListener("scroll", scheduleHydrateVisibleControls);
      window.removeEventListener("resize", scheduleMobileGlassStabilization);
      window.removeEventListener("orientationchange", scheduleMobileGlassStabilization);
    };
  }, []);

  return null;
}

export { ButtonRippleInteractions as GlassCardInteractions };
