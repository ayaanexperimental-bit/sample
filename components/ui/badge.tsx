import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/class-names";

type BadgeTone = "neutral" | "accent" | "success" | "warning";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "ui-badge--neutral",
  accent: "ui-badge--accent",
  success: "ui-badge--success",
  warning: "ui-badge--warning"
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={cn("ui-badge", toneClasses[tone], className)} {...props}>
      {children}
    </span>
  );
}
