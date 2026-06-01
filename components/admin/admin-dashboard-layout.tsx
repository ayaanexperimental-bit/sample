"use client";

import type { ReactNode } from "react";
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
      <button className={styles.menuButton} onClick={onMenu} type="button">
        Menu
      </button>
      <div>
        <span>Admin workspace</span>
        <strong>{activeTitle}</strong>
      </div>
      <div className={styles.topbarActions}>
        {sessionEmail ? <span className={styles.sessionEmail}>{sessionEmail}</span> : null}
        <button className={styles.logoutButton} onClick={onLogout} type="button">
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
      {children}
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

  return (
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
}
