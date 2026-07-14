"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./admin-dashboard-shell.module.css";

export type AdminNavItem = {
  description: string;
  id: string;
  label: string;
};

export type AdminNavSection = {
  id: string;
  items: AdminNavItem[];
  label: string;
};

type AdminV2IconName =
  | "chart"
  | "dashboard"
  | "payments"
  | "plus"
  | "reports"
  | "settings"
  | "shield"
  | "shop"
  | "site"
  | "users";

export type AdminActionIconName =
  | "archive"
  | "chart"
  | "check"
  | "copy"
  | "edit"
  | "eye"
  | "open"
  | "pause"
  | "play"
  | "restore"
  | "settings"
  | "trash";

export function AdminActionIcon({ name }: { name: AdminActionIconName }) {
  const paths: Record<AdminActionIconName, ReactNode> = {
    archive: <path d="M4 7h16v13H4V7Zm2-4h12l2 4H4l2-4Zm5 8h2" />,
    chart: <path d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-7" />,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <path d="M8 8h10v12H8V8Zm-4 8V4h10" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4" />,
    eye: <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
    open: <path d="M14 4h6v6m0-6L10 14M20 14v6H4V4h6" />,
    pause: <path d="M8 5v14m8-14v14" />,
    play: <path d="M8 5v14l11-7L8 5Z" />,
    restore: <path d="M5 8a8 8 0 1 1 1 9m-1 0H3v-4m2 4 5-5" />,
    settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3m10-10h-3M5 12H2m17-7-2 2M7 17l-2 2M19 19l-2-2M7 7 5 5" />,
    trash: <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
  };

  return (
    <svg
      aria-hidden="true"
      className={styles.actionIcon}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

export function AdminSidebar({
  activeView,
  adminDisplayName,
  adminRoleLabel,
  mobileOpen,
  nav,
  onCloseMobile,
  onSelect,
  sessionEmail,
  variant = "classic"
}: {
  activeView: string;
  adminDisplayName?: string;
  adminRoleLabel?: string;
  mobileOpen: boolean;
  nav: AdminNavSection[];
  onCloseMobile: () => void;
  onSelect: (viewId: string) => void;
  sessionEmail?: string;
  variant?: "classic" | "v2";
}) {
  if (variant === "v2") {
    const navItems = nav.flatMap((section) => section.items);
    const displayName = adminDisplayName || sessionEmail || "Admin user";
    const roleLabel = adminRoleLabel || "Admin";
    const initials = getAdminInitials(displayName);

    return (
      <>
        {mobileOpen ? (
          <button
            aria-label="Close admin menu"
            className={styles.sidebarScrim}
            onClick={onCloseMobile}
            type="button"
          />
        ) : null}
        <aside
          aria-label="Admin navigation"
          className="sidebar"
          data-open={mobileOpen ? "true" : "false"}
          id="admin-sidebar"
        >
          <div className="brand">
            <div className="brand-mark logo-mark" aria-label="YW Nutritech">
              <Image
                alt="YW Nutritech"
                aria-label="Close navigation panel"
                height={34}
                onClick={onCloseMobile}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onCloseMobile();
                }}
                role="button"
                src="/assets/yw-nutritech-logo.png"
                tabIndex={0}
                title="Close navigation panel"
                unoptimized
                width={34}
              />
            </div>
            <div>
              <strong>YWcoach Admin</strong>
              <span>Production operations</span>
            </div>
          </div>

          <nav className="nav-section" aria-label="Primary admin rail">
            <div className="nav-title">Admin rail</div>
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              const iconName = getAdminV2Icon(item.id);

              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={`nav-btn${isActive ? " is-active" : ""}`}
                  data-subtitle={item.description}
                  data-title={item.label}
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id);
                    onCloseMobile();
                  }}
                  type="button"
                >
                  <span className="nav-icon" data-icon={iconName}>
                    <AdminV2RailIcon name={iconName} />
                  </span>
                  <span className="nav-copy">
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <button
            aria-label={`${displayName} verified session`}
            className="sidebar-footer"
            onClick={onCloseMobile}
            title={`${displayName} - verified session`}
            type="button"
          >
            <span className="sidebar-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="sidebar-user-tip" aria-hidden="true">
              <strong>{displayName}</strong>
              <span>{sessionEmail || "Verified session"}</span>
            </span>
            <span className="secure-row">
              <span>Session</span>
              <strong>Verified</strong>
            </span>
            <span className="secure-row">
              <span>Role</span>
              <strong>{roleLabel}</strong>
            </span>
          </button>
        </aside>
      </>
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Close admin menu"
          className={styles.sidebarScrim}
          onClick={onCloseMobile}
          type="button"
        />
      ) : null}
      <aside className={styles.sidebar} data-open={mobileOpen ? "true" : "false"}>
        <div className={styles.sidebarHeader}>
          <span>YW</span>
          <div>
            <strong>YW Coach</strong>
            <p>Admin Panel</p>
          </div>
        </div>

        <nav className={styles.sidebarNav} aria-label="Admin navigation">
          {nav.map((section) => (
            <div className={styles.navGroup} key={section.id}>
              <p>{section.label}</p>
              {section.items.map((item) => (
                <button
                  aria-current={activeView === item.id ? "page" : undefined}
                  aria-label={`${item.label}: ${item.description}`}
                  className={styles.navButton}
                  data-active={activeView === item.id ? "true" : "false"}
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id);
                    onCloseMobile();
                  }}
                  type="button"
                >
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function AdminHeader({
  activeTitle,
  activityCount = 0,
  adminDisplayName,
  adminRoleLabel,
  canCreateSite = false,
  canOpenReports = false,
  onLogout,
  onMenu,
  onSelect,
  onThemeToggle,
  sessionEmail,
  showQuickActions = false,
  theme,
  variant = "classic"
}: {
  activeTitle: string;
  activityCount?: number;
  adminDisplayName?: string;
  adminRoleLabel?: string;
  canCreateSite?: boolean;
  canOpenReports?: boolean;
  onLogout: () => void;
  onMenu: () => void;
  onSelect?: (viewId: string) => void;
  onThemeToggle?: () => void;
  sessionEmail?: string;
  showQuickActions?: boolean;
  theme?: "dark" | "light";
  variant?: "classic" | "v2";
}) {
  if (variant === "v2") {
    const displayName = adminDisplayName || sessionEmail || "Admin user";
    const roleLabel = adminRoleLabel || "Admin";
    const initials = getAdminInitials(displayName);
    const quickActionsAvailable = showQuickActions && onSelect && (canOpenReports || canCreateSite);

    return (
      <>
        <button
          aria-controls="admin-sidebar"
          aria-expanded="false"
          aria-label="Open navigation"
          className="mobile-menu"
          id="mobile-menu"
          onClick={onMenu}
          title="Open navigation"
          type="button"
        >
          <span className="menu-lines" aria-hidden="true" />
          <span className="sr-only">Open navigation</span>
        </button>
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">
              <div className="page-kicker">Verified admin session</div>
              <div className="page-heading-row">
                <h1 className="page-title">{activeTitle}</h1>
                <span className="page-dropdown" aria-label="Admin workspace">
                  <span>Admin</span>
                  <span className="page-chevron" aria-hidden="true" />
                </span>
              </div>
              <p className="page-subtitle">
                Manage coach pages, reports, payments, and admin actions.
              </p>
            </div>
          </div>
          <div className="top-actions">
            {quickActionsAvailable ? (
              <div className="quick-action-group" aria-label="Quick actions">
                {canOpenReports ? (
                  <button className="btn btn-sm" onClick={() => onSelect?.("error-reports")} type="button">
                    Reports
                  </button>
                ) : null}
                {canCreateSite ? (
                  <button className="btn btn-sm btn-primary" onClick={() => onSelect?.("create-coach-site")} type="button">
                    Create Site
                  </button>
                ) : null}
              </div>
            ) : null}
            {activityCount > 0 ? (
              <button className="btn btn-icon notification-btn" type="button" aria-label="Admin action activity">
                <span>{activityCount}</span>
              </button>
            ) : null}
            <div className="profile-menu" aria-label={`${displayName}, ${roleLabel}`} role="status">
              <span className="profile-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="profile-name">{displayName}</span>
              <span className="sr-only">{roleLabel}</span>
            </div>
            {theme && onThemeToggle ? (
              <button
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} admin theme`}
                aria-pressed={theme === "light"}
                className="btn theme-btn"
                onClick={onThemeToggle}
                type="button"
              >
                <svg className="theme-toggle__within" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="toggle-sun" cx="12" cy="12" r="3.35" />
                  <g className="toggle-rays" strokeLinecap="round">
                    <path d="M12 4.1v1.55" />
                    <path d="M12 18.35v1.55" />
                    <path d="M6.4 6.4l1.1 1.1" />
                    <path d="M16.5 16.5l1.1 1.1" />
                    <path d="M4.1 12h1.55" />
                    <path d="M18.35 12h1.55" />
                    <path d="M6.4 17.6l1.1-1.1" />
                    <path d="M16.5 7.5l1.1-1.1" />
                  </g>
                  <path
                    className="toggle-moon"
                    d="M16.75 15.15A5.75 5.75 0 0 1 8.85 7.25 5.75 5.75 0 1 0 16.75 15.15Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="sr-only">Toggle color theme</span>
              </button>
            ) : null}
            <button className="btn btn-sm logout-action" onClick={onLogout} type="button">
              Logout
            </button>
          </div>
        </header>
      </>
    );
  }

  return (
    <header className={styles.topbar}>
      <button
        aria-label="Open admin navigation"
        className={styles.menuButton}
        data-admin-tooltip="Open admin navigation"
        onClick={onMenu}
        type="button"
      >
        Menu
      </button>
      <div>
        <span>Admin workspace</span>
        <strong>{activeTitle}</strong>
      </div>
      <div className={styles.topbarActions}>
        {sessionEmail ? <span className={styles.sessionEmail}>{sessionEmail}</span> : null}
        {theme && onThemeToggle ? (
          <button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} admin theme`}
            aria-pressed={theme === "light"}
            className={styles.themeToggleButton}
            data-admin-tooltip={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={onThemeToggle}
            type="button"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        ) : null}
        <button
          className={styles.logoutButton}
          data-admin-tooltip="End the current admin session"
          onClick={onLogout}
          type="button"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

function AdminV2RailIcon({ name }: { name: AdminV2IconName }) {
  const commonProps = {
    "aria-hidden": true,
    fill: "none",
    focusable: false,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24"
  };

  if (name === "dashboard") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
        <path d="M6.6 17.2l1.5-1.7 1.4 1 1.9-2.4" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...commonProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <rect x="7" y="13" width="2.8" height="4.2" rx=".8" />
        <rect x="11" y="9" width="2.8" height="8.2" rx=".8" />
        <rect x="15" y="6" width="2.8" height="11.2" rx=".8" />
        <path d="M7 10l3-3 3 2 4-5" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...commonProps}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M14.5 17.8a4.2 4.2 0 0 1 6 2.2" />
      </svg>
    );
  }

  if (name === "site") {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M3.5 9h17" />
        <path d="M8 14h5" />
        <path d="M8 17h8" />
        <circle cx="6.5" cy="6.8" r=".55" />
      </svg>
    );
  }

  if (name === "plus") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="6" width="12" height="14" rx="2" />
        <path d="M7 10h6M7 14h4" />
        <path d="M17.5 3.5l.8 1.8 1.9.8-1.9.8-.8 1.8-.8-1.8-1.9-.8 1.9-.8.8-1.8Z" />
        <path d="M18 13v6M15 16h6" />
      </svg>
    );
  }

  if (name === "shop") {
    return (
      <svg {...commonProps}>
        <path className="shop-handle" d="M8 9.2a4 4 0 0 1 8 0" />
        <path className="shop-basket" d="M5 9.2h14l-1.4 10.3H6.4L5 9.2Z" />
        <path className="shop-basket" d="M8.2 12.2h7.6" />
        <path className="shop-basket" d="M9.1 15.5h5.8" />
        <path className="shop-item" d="M12 4.7l1.1 1.1L12 6.9l-1.1-1.1L12 4.7Z" />
        <path className="shop-item-alt" d="M9.2 5.3l.9.9-.9.9-.9-.9.9-.9Z" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg {...commonProps}>
        <path className="report-page" d="M7 3.8h7l3 3V20H7a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" />
        <path className="report-corner" d="M14 3.8V7h3" />
        <path className="report-line" d="M8 9.4h4.6" />
        <path className="report-line" d="M8 12.8h5.8" />
        <path className="report-line" d="M8 16.2h4.4" />
        <circle className="report-alert" cx="16.6" cy="15.8" r="2" />
        <path className="report-alert-mark" d="M16.6 14.8v1.1" />
        <path className="report-alert-mark" d="M16.6 17.1h.01" />
      </svg>
    );
  }

  if (name === "payments") {
    return (
      <svg {...commonProps}>
        <rect className="payment-card" x="3.8" y="6" width="16.4" height="12" rx="2" />
        <path className="payment-strip" d="M3.8 9.5h16.4" />
        <rect className="payment-chip" x="7" y="12.7" width="3.5" height="2.7" rx=".7" />
        <path className="payment-line" d="M13.2 14.1h4.1" />
        <path className="payment-line" d="M13.2 16.2h2.6" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...commonProps}>
        <path className="settings-gear" d="M10.65 2.65h2.7l.62 2.45c.55.16 1.07.38 1.56.65l2.18-1.3 1.9 1.9-1.3 2.18c.27.49.49 1.01.65 1.56l2.45.62v2.7l-2.45.62a7.42 7.42 0 0 1-.65 1.56l1.3 2.18-1.9 1.9-2.18-1.3c-.49.27-1.01.49-1.56.65l-.62 2.45h-2.7l-.62-2.45a7.42 7.42 0 0 1-1.56-.65l-2.18 1.3-1.9-1.9 1.3-2.18a7.42 7.42 0 0 1-.65-1.56l-2.45-.62v-2.7l2.45-.62c.16-.55.38-1.07.65-1.56l-1.3-2.18 1.9-1.9 2.18 1.3c.49-.27 1.01-.49 1.56-.65l.62-2.45Z" />
        <circle className="settings-core" cx="12" cy="12" r="3.05" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...commonProps}>
        <path d="M12 3.8l7.5 3.1v5.6c0 3.8-2.5 6.4-7.5 7.7-5-1.3-7.5-3.9-7.5-7.7V6.9L12 3.8Z" />
        <circle cx="12" cy="10.3" r="2.1" />
        <path d="M8.5 16.1a3.9 3.9 0 0 1 7 0" />
      </svg>
    );
  }

  return null;
}

function getAdminV2Icon(viewId: string): AdminV2IconName {
  const icons: Record<string, AdminV2IconName> = {
    "coach-analytics": "chart",
    "coach-sites": "site",
    "create-coach-site": "plus",
    "error-reports": "reports",
    overview: "dashboard",
    "paid-masterclass-settings": "payments",
    settings: "settings",
    shop: "shop",
    "top-coaches": "users"
  };

  return icons[viewId] || "dashboard";
}

function getAdminInitials(value: string) {
  const parts = value
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);

  return (parts.map((part) => part.charAt(0)).join("") || "A").slice(0, 2).toUpperCase();
}

export function AdminPageShell({
  actions,
  children,
  eyebrow,
  title
}: {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className={`${styles.pageShell} panel od-page-shell`}>
      <div className={`${styles.pageHeader} section-head`}>
        <div>
          <p className={styles.kicker}>{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        {actions ? <div className={styles.pageActions}>{actions}</div> : null}
      </div>
      <div className={styles.pageBody}>{children}</div>
    </section>
  );
}

export function AdminSubmenu({
  activeView,
  items,
  onSelect
}: {
  activeView: string;
  items: AdminNavItem[];
  onSelect: (viewId: string) => void;
}) {
  return (
    <div className={styles.submenuTabs} role="tablist">
      {items.map((item) => (
        <button
          aria-selected={activeView === item.id}
          data-active={activeView === item.id ? "true" : "false"}
          key={item.id}
          onClick={() => onSelect(item.id)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AdminActionDialog({
  children,
  footer,
  onClose,
  open,
  size = "standard",
  title,
  tone = "standard"
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: "large" | "standard";
  title: string;
  tone?: "danger" | "standard";
}) {
  if (!open) return null;

  const dialog = (
    <div className={styles.dialogLayer} role="presentation">
      <button aria-label="Close dialog" className={styles.dialogScrim} onClick={onClose} type="button" />
      <section
        aria-labelledby="admin-action-dialog-title"
        aria-modal="true"
        className={styles.dialogPanel}
        data-size={size}
        data-tone={tone}
        role="dialog"
      >
        <header className={styles.dialogHeader}>
          <h2 id="admin-action-dialog-title">{title}</h2>
          <button aria-label="Close dialog" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
        {footer ? <footer className={styles.dialogFooter}>{footer}</footer> : null}
      </section>
    </div>
  );

  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}
