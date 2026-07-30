import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import styles from "./admin-ai.module.css";

export function AdminAIDrawer({
  children,
  onClose,
  onContentHidden,
  open,
  sectionName,
  stateLabel,
  theme
}: {
  children: ReactNode;
  onClose: () => void;
  onContentHidden?: () => void;
  open: boolean;
  sectionName: string;
  stateLabel: string;
  theme: "dark" | "light";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyHideTimerRef = useRef<number | null>(null);
  const [contentVisible, setContentVisible] = useState(false);

  const dismiss = useCallback(() => {
    if (panelRef.current) {
      panelRef.current.style.pointerEvents = "none";
      panelRef.current.style.visibility = "hidden";
    }
    if (scrimRef.current) {
      scrimRef.current.style.pointerEvents = "none";
      scrimRef.current.style.visibility = "hidden";
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (bodyHideTimerRef.current !== null) {
      window.clearTimeout(bodyHideTimerRef.current);
      bodyHideTimerRef.current = null;
    }
    if (open) return;
    bodyHideTimerRef.current = window.setTimeout(() => {
      if (bodyRef.current) bodyRef.current.dataset.visible = "false";
      setContentVisible(false);
      onContentHidden?.();
      bodyHideTimerRef.current = null;
    }, 100);
    return () => {
      if (bodyHideTimerRef.current !== null) {
        window.clearTimeout(bodyHideTimerRef.current);
        bodyHideTimerRef.current = null;
      }
    };
  }, [onContentHidden, open]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel) {
      panel.scrollTop = 0;
      panel.style.pointerEvents = "";
      panel.style.visibility = "";
    }
    if (scrimRef.current) {
      scrimRef.current.style.pointerEvents = "";
      scrimRef.current.style.visibility = "";
    }
    const contentTimer = window.setTimeout(() => setContentVisible(true), 200);
    const closeButton = panel?.querySelector<HTMLButtonElement>('[data-copilot-close="true"]');
    closeButton?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        const confirmationCancel = panel.querySelector<HTMLButtonElement>(
          '[role="alertdialog"] [data-admin-ai-confirm-cancel="true"]'
        );
        if (confirmationCancel) {
          confirmationCancel.click();
          return;
        }
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(contentTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [dismiss, open]);

  return (
    <>
      <button
        aria-hidden={!open}
        aria-label="Close Admin Copilot"
        className={styles.scrim}
        disabled={!open}
        onClick={dismiss}
        ref={scrimRef}
        style={open ? undefined : { pointerEvents: "none", visibility: "hidden" }}
        tabIndex={open ? undefined : -1}
        type="button"
      />
      <div
        aria-busy={open && !contentVisible}
        aria-hidden={!open}
        aria-label={`${sectionName} Admin Copilot`}
        aria-modal="true"
        className={styles.drawer}
        data-theme={theme}
        id="admin-ai-copilot-dialog"
        inert={!open}
        ref={panelRef}
        role="dialog"
        style={open ? undefined : { pointerEvents: "none", visibility: "hidden" }}
      >
        <header className={styles.drawerHeader}>
          <div>
            <p>Contextual Admin Copilot</p>
            <h3>{sectionName}</h3>
            <span>{stateLabel}</span>
          </div>
          <button
            aria-label="Close Admin Copilot"
            data-copilot-close="true"
            onClick={dismiss}
            type="button"
          >
            Close
          </button>
        </header>
        <div
          aria-hidden={!contentVisible}
          className={styles.drawerBody}
          data-visible={contentVisible ? "true" : "false"}
          ref={bodyRef}
        >
          {children}
        </div>
      </div>
    </>
  );
}
