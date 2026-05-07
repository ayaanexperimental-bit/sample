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

  const pressure = document.createElement("span");
  pressure.className = "liquid-button-pool__pressure";

  pool.append(depth, caustics, pressure, meniscus);
  control.prepend(pool);
}

export function ButtonRippleInteractions() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      return;
    }

    document.querySelectorAll<HTMLElement>(LIQUID_RIPPLE_SELECTOR).forEach(ensureWaterSurface);

    function updateWaterOrigin(control: HTMLElement, event: PointerEvent) {
      const rect = control.getBoundingClientRect();
      const originX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
      const originY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

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

      const control = target.closest<HTMLElement>(LIQUID_RIPPLE_SELECTOR);
      if (!control || control.matches("[disabled]")) {
        return;
      }

      ensureWaterSurface(control);

      const { rect, originX, originY } = updateWaterOrigin(control, event);
      const baseSize = Math.max(rect.width, rect.height);
      const size = Math.min(baseSize * 1.86, control.classList.contains("sticky-offer-button") ? 180 : 340);
      const pool = control.querySelector<HTMLElement>(":scope > .liquid-button-pool");
      const ripples = Array.from({ length: 9 }, (_, index) => {
        const ripple = document.createElement("span");
        const rippleSize = size * (0.28 + index * 0.105);

        ripple.className = `liquid-water-ripple liquid-water-ripple--${index + 1}`;
        ripple.style.width = `${rippleSize}px`;
        ripple.style.height = `${rippleSize}px`;
        ripple.style.left = `${originX - rippleSize / 2}px`;
        ripple.style.top = `${originY - rippleSize / 2}px`;
        ripple.style.animationDelay = `${index * 58}ms`;

        return ripple;
      });

      const counterRipples = Array.from({ length: 3 }, (_, index) => {
        const ripple = document.createElement("span");
        const rippleSize = size * (0.5 + index * 0.18);

        ripple.className = `liquid-water-ripple liquid-water-ripple--counter liquid-water-ripple--counter-${index + 1}`;
        ripple.style.width = `${rippleSize}px`;
        ripple.style.height = `${rippleSize}px`;
        ripple.style.left = `${originX - rippleSize / 2}px`;
        ripple.style.top = `${originY - rippleSize / 2}px`;
        ripple.style.animationDelay = `${260 + index * 92}ms`;

        return ripple;
      });

      const droplets = Array.from({ length: 8 }, (_, index) => {
        const droplet = document.createElement("span");
        const angle = (Math.PI * 2 * index) / 8 + (index % 2 ? 0.22 : -0.18);
        const distance = Math.min(baseSize * (0.18 + (index % 3) * 0.07), 58);

        droplet.className = "liquid-water-droplet";
        droplet.style.left = `${originX}px`;
        droplet.style.top = `${originY}px`;
        droplet.style.setProperty("--drop-x", `${Math.cos(angle) * distance}px`);
        droplet.style.setProperty("--drop-y", `${Math.sin(angle) * distance * 0.42}px`);
        droplet.style.animationDelay = `${80 + index * 28}ms`;

        return droplet;
      });

      const lens = document.createElement("span");
      lens.className = "liquid-water-lens";
      lens.style.width = `${size * 0.72}px`;
      lens.style.height = `${size * 0.36}px`;
      lens.style.left = `${originX - (size * 0.72) / 2}px`;
      lens.style.top = `${originY - (size * 0.36) / 2}px`;

      const impact = document.createElement("span");
      impact.className = "liquid-water-impact";
      impact.style.width = `${size * 0.44}px`;
      impact.style.height = `${size * 0.2}px`;
      impact.style.left = `${originX - (size * 0.44) / 2}px`;
      impact.style.top = `${originY - (size * 0.2) / 2}px`;

      control.setPointerCapture?.(event.pointerId);
      control.classList.remove("liquid-cta-releasing");
      control.classList.add("liquid-cta-pressed");
      control.classList.add("liquid-cta-rippling");
      pool?.append(impact, lens, ...ripples, ...counterRipples, ...droplets);
      window.setTimeout(() => {
        impact.remove();
        lens.remove();
        ripples.forEach((ripple) => ripple.remove());
        counterRipples.forEach((ripple) => ripple.remove());
        droplets.forEach((droplet) => droplet.remove());
        control.classList.remove("liquid-cta-rippling");
      }, 1800);
    }

    function handlePointerMove(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const control = target.closest<HTMLElement>(LIQUID_RIPPLE_SELECTOR);
      if (!control) {
        return;
      }

      updateWaterOrigin(control, event);
    }

    function releasePressedControls(event: PointerEvent) {
      document.querySelectorAll<HTMLElement>(".liquid-cta-pressed").forEach((control) => {
        control.releasePointerCapture?.(event.pointerId);
        control.classList.remove("liquid-cta-pressed");
        control.classList.add("liquid-cta-releasing");
        window.setTimeout(() => control.classList.remove("liquid-cta-releasing"), 520);
      });
    }

    document.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerup", releasePressedControls, { passive: true });
    document.addEventListener("pointercancel", releasePressedControls, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", releasePressedControls);
      document.removeEventListener("pointercancel", releasePressedControls);
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
