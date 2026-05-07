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
      const size = isStickyControl ? Math.min(baseSize * 0.95, 112) : Math.min(baseSize * 1.18, 220);
      const originX = event.clientX - rect.left;
      const originY = event.clientY - rect.top;
      const ripple = document.createElement("span");
      const ring = document.createElement("span");
      const glint = document.createElement("span");
      const wave = document.createElement("span");

      ripple.className = "liquid-cta-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${originX - size / 2}px`;
      ripple.style.top = `${originY - size / 2}px`;

      ring.className = "liquid-cta-ripple liquid-cta-ripple--ring";
      ring.style.width = `${size * 0.72}px`;
      ring.style.height = `${size * 0.72}px`;
      ring.style.left = `${originX - (size * 0.72) / 2}px`;
      ring.style.top = `${originY - (size * 0.72) / 2}px`;

      glint.className = "liquid-cta-ripple liquid-cta-ripple--glint";
      glint.style.width = `${Math.max(size * 0.34, 34)}px`;
      glint.style.height = `${Math.max(size * 0.16, 18)}px`;
      glint.style.left = `${originX - Math.max(size * 0.34, 34) / 2}px`;
      glint.style.top = `${originY - Math.max(size * 0.16, 18) / 2}px`;

      wave.className = "liquid-button-wave";
      wave.style.setProperty("--wave-x", `${originX}px`);
      wave.style.setProperty("--wave-y", `${originY}px`);

      control.classList.add("liquid-cta-rippling");
      control.append(wave, ripple, ring, glint);
      window.setTimeout(() => {
        wave.remove();
        ripple.remove();
        ring.remove();
        glint.remove();
        control.classList.remove("liquid-cta-rippling");
      }, 980);
    }

    document.addEventListener("pointerdown", handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <svg
      className="liquid-button-filter"
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
    >
      <filter id="liquid-button-water-filter" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.018 0.052"
          numOctaves="2"
          seed="7"
          result="waterNoise"
        >
          <animate
            attributeName="baseFrequency"
            dur="1.6s"
            values="0.018 0.052;0.028 0.038;0.018 0.052"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="waterNoise" scale="8" xChannelSelector="R" yChannelSelector="G">
          <animate attributeName="scale" dur="0.9s" values="11;4;0" repeatCount="1" fill="freeze" />
        </feDisplacementMap>
      </filter>
    </svg>
  );
}

export { ButtonRippleInteractions as GlassCardInteractions };
