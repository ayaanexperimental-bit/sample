import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/class-names";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "glass"
  | "outline"
  | "success"
  | "danger"
  | "soft"
  | "neon"
  | "stickyCTA"
  | "icon"
  | "tab";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "ui-button--primary",
  secondary: "ui-button--secondary",
  ghost: "ui-button--ghost",
  glass: "ui-button--glass",
  outline: "ui-button--outline",
  success: "ui-button--success",
  danger: "ui-button--danger",
  soft: "ui-button--soft",
  neon: "ui-button--neon",
  stickyCTA: "ui-button--sticky-cta",
  icon: "ui-button--icon",
  tab: "ui-button--tab"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "ui-button--sm",
  md: "ui-button--md",
  lg: "ui-button--lg"
};

type SharedButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

type NativeButtonProps = SharedButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type AnchorButtonProps = SharedButtonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

export type ButtonProps = NativeButtonProps | AnchorButtonProps;

export function Button(props: ButtonProps) {
  const { children, variant = "primary", size = "md", className } = props;
  const classes = cn("ui-button", variantClasses[variant], sizeClasses[size], className);

  if ("href" in props && props.href) {
    const {
      children: _children,
      variant: _variant,
      size: _size,
      className: _className,
      ...anchorProps
    } = props as AnchorButtonProps;

    return (
      <a className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const {
    children: _children,
    variant: _variant,
    size: _size,
    className: _className,
    ...buttonProps
  } = props as NativeButtonProps;

  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
