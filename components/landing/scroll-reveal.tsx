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

export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const elements = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTORS));

    elements.forEach((element, index) => {
      element.classList.add("scroll-reveal");
      element.style.setProperty("--reveal-delay", `${Math.min(index % 5, 4) * 70}ms`);
    });

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("is-revealed");
      });

      return () => {
        elements.forEach((element) => {
          element.classList.remove("scroll-reveal", "is-revealed");
          element.style.removeProperty("--reveal-delay");
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
            observer.unobserve(element);
          }
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();

      elements.forEach((element) => {
        element.classList.remove("scroll-reveal", "is-revealed");
        element.style.removeProperty("--reveal-delay");
      });
    };
  }, []);

  return null;
}
