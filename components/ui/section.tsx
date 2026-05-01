import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/class-names";

type SectionTone = "default" | "soft" | "strong";

const toneClasses: Record<SectionTone, string> = {
  default: "ui-section--default",
  soft: "ui-section--soft",
  strong: "ui-section--strong"
};

export type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  tone?: SectionTone;
};

export function Section({ children, className, tone = "default", ...props }: SectionProps) {
  return (
    <section className={cn("ui-section", toneClasses[tone], className)} {...props}>
      {children}
    </section>
  );
}
