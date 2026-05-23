"use client";

import { useEffect } from "react";

const REVEAL_SELECTORS = [
  ".hero-copy",
  ".hero-media",
  ".hero-actions",
  ".hero-details li",
  ".section-heading",
  ".credibility-item",
  ".audience-panel",
  ".learning-card",
  ".method-pillar",
  ".outcomes-card",
  ".outcomes-list li",
  ".testimonial-card",
  ".logistics-item",
  ".bonus-item",
  ".pricing-copy",
  ".pricing-card",
  ".faq-item",
  ".footer-compliance"
].join(",");

const MORPH_SELECTORS = [
  ".section-heading",
  ".credibility-item",
  ".audience-panel",
  ".learning-card",
  ".method-pillar",
  ".outcomes-card",
  ".outcomes-list li",
  ".testimonial-card",
  ".logistics-item",
  ".bonus-item",
  ".pricing-copy",
  ".pricing-card",
  ".faq-item",
  ".footer-compliance"
].join(",");

const SCROLL_MORPH_PROPERTIES = [
  "--morph-y",
  "--morph-scale",
  "--morph-blur",
  "--morph-opacity",
  "--morph-rotate"
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const elements = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTORS));
    const morphElements = elements.filter((element) => element.matches(MORPH_SELECTORS));
    let animationFrame = 0;
    let viewportHeight = window.innerHeight;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

    elements.forEach((element, index) => {
      element.classList.add("scroll-reveal");
      element.style.setProperty("--reveal-delay", `${Math.min(index % 5, 4) * 70}ms`);
    });

    morphElements.forEach((element) => element.classList.add("scroll-morph"));

    const updateMorph = () => {
      animationFrame = 0;
      viewportHeight = window.innerHeight;

      morphElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const rawProgress = (viewportHeight - rect.top) / (viewportHeight + rect.height * 0.7);
        const progress = easeOutCubic(clamp(rawProgress, 0, 1));
        const depth = 18;
        const mobileMultiplier = coarsePointer ? 0.58 : 1;
        const translate = (1 - progress) * depth * mobileMultiplier;
        const scale = 0.94 + progress * 0.06;
        const blur = (1 - progress) * (coarsePointer ? 2.4 : 4.8);
        const rotate = (1 - progress) * (coarsePointer ? 0.18 : 0.36);
        const opacity = 0.76 + progress * 0.24;

        element.style.setProperty("--morph-y", `${translate.toFixed(2)}px`);
        element.style.setProperty("--morph-scale", scale.toFixed(4));
        element.style.setProperty("--morph-blur", `${blur.toFixed(2)}px`);
        element.style.setProperty("--morph-rotate", `${rotate.toFixed(3)}deg`);
        element.style.setProperty("--morph-opacity", opacity.toFixed(3));
      });
    };

    const scheduleMorphUpdate = () => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(updateMorph);
      }
    };

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("is-revealed");
        SCROLL_MORPH_PROPERTIES.forEach((property) => element.style.removeProperty(property));
      });

      return () => {
        elements.forEach((element) => {
          element.classList.remove("scroll-reveal", "scroll-morph", "is-revealed");
          element.style.removeProperty("--reveal-delay");
          SCROLL_MORPH_PROPERTIES.forEach((property) => element.style.removeProperty(property));
        });
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const element = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            element.classList.add("is-revealed");
          }
        });

        scheduleMorphUpdate();
      },
      {
        root: null,
        rootMargin: "18% 0px 18% 0px",
        threshold: [0, 0.1, 0.35, 0.65, 1]
      }
    );

    elements.forEach((element) => observer.observe(element));
    window.addEventListener("scroll", scheduleMorphUpdate, { passive: true });
    window.addEventListener("resize", scheduleMorphUpdate);
    scheduleMorphUpdate();

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }

      observer.disconnect();
      window.removeEventListener("scroll", scheduleMorphUpdate);
      window.removeEventListener("resize", scheduleMorphUpdate);

      elements.forEach((element) => {
        element.classList.remove("scroll-reveal", "scroll-morph", "is-revealed");
        element.style.removeProperty("--reveal-delay");
        SCROLL_MORPH_PROPERTIES.forEach((property) => element.style.removeProperty(property));
      });
    };
  }, []);

  return null;
}
