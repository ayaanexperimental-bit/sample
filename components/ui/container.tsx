import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/class-names";

type ContainerSize = "default" | "narrow" | "wide";

const sizeClasses: Record<ContainerSize, string> = {
  default: "ui-container--default",
  narrow: "ui-container--narrow",
  wide: "ui-container--wide"
};

export type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  size?: ContainerSize;
};

export function Container({ children, className, size = "default", ...props }: ContainerProps) {
  return (
    <div className={cn("ui-container", sizeClasses[size], className)} {...props}>
      {children}
    </div>
  );
}
