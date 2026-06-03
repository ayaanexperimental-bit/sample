"use client";

import type { ComponentPropsWithoutRef, CSSProperties, MouseEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

import styles from "./spotlight-card.module.css";

type SpotlightBaseProps = {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
};

type SpotlightCardProps =
  | (SpotlightBaseProps & ComponentPropsWithoutRef<"div"> & { as?: "div" })
  | (SpotlightBaseProps & ComponentPropsWithoutRef<"article"> & { as: "article" })
  | (SpotlightBaseProps & ComponentPropsWithoutRef<"details"> & { as: "details" });

function getClassName(className = "") {
  return `${styles.cardSpotlight} ${className}`.trim();
}

function getStyle(style: CSSProperties | undefined, spotlightColor: string) {
  return {
    ...style,
    "--spotlight-color": spotlightColor
  } as CSSProperties;
}

export function SpotlightCard(props: SpotlightCardProps) {
  const {
    as = "div",
    children,
    className = "",
    spotlightColor = "rgba(255, 255, 255, 0.25)",
    style,
    onMouseMove,
    ...rest
  } = props;
  const cardRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const spotlightEnabledRef = useRef(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
    const syncSpotlightMode = () => {
      spotlightEnabledRef.current = !reducedMotion.matches && !coarsePointer.matches;
    };

    syncSpotlightMode();
    reducedMotion.addEventListener("change", syncSpotlightMode);
    coarsePointer.addEventListener("change", syncSpotlightMode);

    return () => {
      reducedMotion.removeEventListener("change", syncSpotlightMode);
      coarsePointer.removeEventListener("change", syncSpotlightMode);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (spotlightEnabledRef.current) {
      pointerRef.current = {
        x: event.clientX,
        y: event.clientY
      };

      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null;
          const element = cardRef.current;
          const pointer = pointerRef.current;
          if (!element || !pointer) return;

          const rect = element.getBoundingClientRect();
          const x = pointer.x - rect.left;
          const y = pointer.y - rect.top;

          element.style.setProperty("--mouse-x", `${x}px`);
          element.style.setProperty("--mouse-y", `${y}px`);
          element.style.setProperty("--spotlight-color", spotlightColor);
        });
      }
    }

    onMouseMove?.(event as never);
  };

  const sharedProps = {
    className: getClassName(className),
    onMouseMove: handleMouseMove,
    style: getStyle(style, spotlightColor)
  };

  if (as === "article") {
    return (
      <article
        {...(rest as ComponentPropsWithoutRef<"article">)}
        {...sharedProps}
        ref={(node) => {
          cardRef.current = node;
        }}
      >
        {children}
      </article>
    );
  }

  if (as === "details") {
    return (
      <details
        {...(rest as ComponentPropsWithoutRef<"details">)}
        {...sharedProps}
        ref={(node) => {
          cardRef.current = node;
        }}
      >
        {children}
      </details>
    );
  }

  return (
    <div
      {...(rest as ComponentPropsWithoutRef<"div">)}
      {...sharedProps}
      ref={(node) => {
        cardRef.current = node;
      }}
    >
      {children}
    </div>
  );
}
