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

  pool.append(depth, caustics, meniscus);
  control.prepend(pool);
}

export function ButtonRippleInteractions() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      return;
    }

    document.querySelectorAll<HTMLElement>(LIQUID_RIPPLE_SELECTOR).forEach(ensureWaterSurface);

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

      ensureWaterSurface(control);

      const rect = control.getBoundingClientRect();
      const baseSize = Math.max(rect.width, rect.height);
      const size = Math.min(baseSize * 1.55, control.classList.contains("sticky-offer-button") ? 150 : 280);
      const originX = event.clientX - rect.left;
      const originY = event.clientY - rect.top;
      const pool = control.querySelector<HTMLElement>(":scope > .liquid-button-pool");
      const ripples = Array.from({ length: 5 }, (_, index) => {
        const ripple = document.createElement("span");
        const rippleSize = size * (0.42 + index * 0.16);

        ripple.className = `liquid-water-ripple liquid-water-ripple--${index + 1}`;
        ripple.style.width = `${rippleSize}px`;
        ripple.style.height = `${rippleSize}px`;
        ripple.style.left = `${originX - rippleSize / 2}px`;
        ripple.style.top = `${originY - rippleSize / 2}px`;
        ripple.style.animationDelay = `${index * 72}ms`;

        return ripple;
      });

      const lens = document.createElement("span");
      lens.className = "liquid-water-lens";
      lens.style.width = `${size * 0.72}px`;
      lens.style.height = `${size * 0.36}px`;
      lens.style.left = `${originX - (size * 0.72) / 2}px`;
      lens.style.top = `${originY - (size * 0.36) / 2}px`;

      control.style.setProperty("--water-x", `${originX}px`);
      control.style.setProperty("--water-y", `${originY}px`);
      control.classList.add("liquid-cta-rippling");
      pool?.append(lens, ...ripples);
      window.setTimeout(() => {
        lens.remove();
        ripples.forEach((ripple) => ripple.remove());
        control.classList.remove("liquid-cta-rippling");
      }, 1450);
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
          baseFrequency="0.012 0.038"
          numOctaves="3"
          seed="11"
          result="waterNoise"
        >
          <animate
            attributeName="baseFrequency"
            dur="2.4s"
            values="0.012 0.038;0.018 0.028;0.012 0.038"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="waterNoise" scale="10" xChannelSelector="R" yChannelSelector="G">
          <animate attributeName="scale" dur="1.35s" values="12;7;3;0" repeatCount="1" fill="freeze" />
        </feDisplacementMap>
      </filter>
    </svg>
  );
}

export { ButtonRippleInteractions as GlassCardInteractions };
