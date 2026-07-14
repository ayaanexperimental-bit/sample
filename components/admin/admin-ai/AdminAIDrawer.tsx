import { type ReactNode, useEffect, useRef } from "react";
import styles from "./admin-ai.module.css";

export function AdminAIDrawer({
  children,
  onClose,
  sectionName,
  stateLabel,
  theme,
}: {
  children: ReactNode;
  onClose: () => void;
  sectionName: string;
  stateLabel: string;
  theme: "dark" | "light";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const closeButton = panel?.querySelector<HTMLButtonElement>('[data-copilot-close="true"]');
    closeButton?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (!panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <>
      <button aria-label="Close Admin Copilot" className={styles.scrim} onClick={onClose} type="button" />
      <div
        aria-label={`${sectionName} Admin Copilot`}
        aria-modal="true"
        className={styles.drawer}
        data-theme={theme}
        ref={panelRef}
        role="dialog"
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
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>
        {children}
      </div>
    </>
  );
}
