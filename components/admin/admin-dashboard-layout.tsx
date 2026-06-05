"use client";

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
  mobileOpen,
  nav,
  onCloseMobile,
  onSelect
}: {
  activeView: string;
  mobileOpen: boolean;
  nav: AdminNavSection[];
  onCloseMobile: () => void;
  onSelect: (viewId: string) => void;
}) {
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
  onLogout,
  onMenu,
  sessionEmail
}: {
  activeTitle: string;
  onLogout: () => void;
  onMenu: () => void;
  sessionEmail?: string;
}) {
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
    <section className={styles.pageShell}>
      <div className={styles.pageHeader}>
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
