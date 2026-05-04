"use client";

import type { ReactNode } from "react";
import { LiquidProgressLayer } from "@/components/landing/liquid-progress-layer";

type ScrollLiquidCoursePanelProps = {
  children: ReactNode;
  className?: string;
  variant?: "default" | "nav";
};

export function ScrollLiquidCoursePanel({
  children,
  className = "",
  variant = "default"
}: ScrollLiquidCoursePanelProps) {
  return (
    <div className={`scroll-liquid-course-panel ${className}`.trim()}>
      <LiquidProgressLayer variant={variant} />
      <div className="scroll-liquid-course-panel__content">{children}</div>
    </div>
  );
}
