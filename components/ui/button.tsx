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
    const anchorProps = { ...(props as AnchorButtonProps) };
    delete anchorProps.children;
    delete anchorProps.variant;
    delete anchorProps.size;
    delete anchorProps.className;

    return (
      <a className={classes} {...anchorProps}>
        <span className="ui-button__content">{children}</span>
      </a>
    );
  }

  const buttonProps = { ...(props as NativeButtonProps) };
  delete buttonProps.children;
  delete buttonProps.variant;
  delete buttonProps.size;
  delete buttonProps.className;

  return (
    <button className={classes} {...buttonProps}>
      <span className="ui-button__content">{children}</span>
    </button>
  );
}
