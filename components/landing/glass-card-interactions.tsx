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

export function ButtonRippleInteractions() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0 && event.pointerType === "mouse") {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const control = target.closest<HTMLElement>(LIQUID_RIPPLE_SELECTOR);
      if (!control || control.matches("[disabled]")) {
        return;
      }

      const rect = control.getBoundingClientRect();
      const baseSize = Math.max(rect.width, rect.height);
      const isStickyControl = control.classList.contains("sticky-offer-button");
      const size = isStickyControl ? Math.min(baseSize * 0.82, 86) : Math.min(baseSize * 1.02, 180);
      const ripple = document.createElement("span");
      const ring = document.createElement("span");

      ripple.className = "liquid-cta-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

      ring.className = "liquid-cta-ripple liquid-cta-ripple--ring";
      ring.style.width = `${size * 0.48}px`;
      ring.style.height = `${size * 0.48}px`;
      ring.style.left = `${event.clientX - rect.left - (size * 0.48) / 2}px`;
      ring.style.top = `${event.clientY - rect.top - (size * 0.48) / 2}px`;

      control.classList.add("liquid-cta-rippling");
      control.append(ripple, ring);
      window.setTimeout(() => {
        ripple.remove();
        ring.remove();
        control.classList.remove("liquid-cta-rippling");
      }, 820);
    }

    document.addEventListener("pointerdown", handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return null;
}

export { ButtonRippleInteractions as GlassCardInteractions };
