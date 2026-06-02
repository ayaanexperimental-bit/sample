"use client";

import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  MouseEvent,
  ReactNode
} from "react";
import { useRef } from "react";

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

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const element = cardRef.current;

    if (element) {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      element.style.setProperty("--mouse-x", `${x}px`);
      element.style.setProperty("--mouse-y", `${y}px`);
      element.style.setProperty("--spotlight-color", spotlightColor);
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
