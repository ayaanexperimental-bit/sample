"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

type LegalLink = {
  href: string;
  label: string;
};

type CoachLegalPageProps = {
  children: ReactNode;
  kicker?: string;
  links: LegalLink[];
  title: string;
};

const storageKey = "ywLastCoachLandingPath";

function getSafeCoachPath(value: string, origin: string) {
  let path = value.trim();
  if (!path) return "";

  try {
    if (/^https?:\/\//i.test(path)) {
      const url = new URL(path);
      if (url.origin !== origin) return "";
      path = url.pathname + url.search + url.hash;
    }
  } catch {
    return "";
  }

  if (
    !/^\/(coach|r)\/[A-Za-z0-9][A-Za-z0-9_-]*(?:[/?#].*)?$/.test(path) ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /%5c/i.test(path)
  ) {
    return "";
  }

  return path;
}

function getLandingPathSnapshot() {
  if (typeof window === "undefined") return "";

  const origin = window.location.origin;
  const params = new URLSearchParams(window.location.search);
  const queryReturnTo = getSafeCoachPath(params.get("returnTo") || "", origin);
  const storedReturnTo = (() => {
    try {
      return getSafeCoachPath(
        window.sessionStorage.getItem(storageKey) || window.localStorage.getItem(storageKey) || "",
        origin
      );
    } catch {
      return "";
    }
  })();
  const referrerReturnTo = getSafeCoachPath(document.referrer || "", origin);

  return queryReturnTo || storedReturnTo || referrerReturnTo;
}

function getServerLandingPathSnapshot() {
  return "";
}

function subscribeToLandingPath(onStoreChange: () => void) {
  const timeoutId = window.setTimeout(onStoreChange, 0);
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.clearTimeout(timeoutId);
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function CoachLegalPage({
  children,
  kicker = "YW Nutritech Coach Circle",
  links,
  title
}: CoachLegalPageProps) {
  const landingPath = useSyncExternalStore(
    subscribeToLandingPath,
    getLandingPathSnapshot,
    getServerLandingPathSnapshot
  );

  useEffect(() => {
    if (!landingPath) return;

    try {
      window.sessionStorage.setItem(storageKey, landingPath);
      window.localStorage.setItem(storageKey, landingPath);
    } catch {
      // Browser storage can be disabled; rendered links still use state.
    }
  }, [landingPath]);

  const returnHref = landingPath || "#";

  const getPeerHref = useCallback(
    (href: string) => {
      if (!landingPath) return href;

      const next = new URL(href, "https://ywcoach.local");
      next.searchParams.set("returnTo", landingPath);
      return next.pathname + next.search + next.hash;
    },
    [landingPath]
  );

  const handleReturnClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (landingPath) return;

      event.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      }
    },
    [landingPath]
  );

  const renderedLinks = useMemo(
    () => links.map((link) => ({ ...link, href: getPeerHref(link.href) })),
    [getPeerHref, links]
  );

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/coach-circle-template.css?v=coach-legal-4176-copy-20260620" />
      <main className="yw-legal-body">
        <div className="yw-legal-shell">
          <header className="yw-legal-header">
            <a
              className="yw-legal-brand"
              data-yw-return-link
              href={returnHref}
              onClick={handleReturnClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" decoding="async" loading="eager" src="/assets/yw-logo-transparent.png" />
              <span>YW Nutritech</span>
            </a>
            <a
              className="yw-legal-back"
              data-yw-return-link
              href={returnHref}
              onClick={handleReturnClick}
            >
              Back to landing page
            </a>
          </header>

          <article className="yw-legal-card">
            <p className="yw-legal-kicker">{kicker}</p>
            <h1>{title}</h1>
            {children}

            <nav className="yw-legal-links-bar" aria-label="Other legal pages">
              {renderedLinks.map((link) => (
                <a data-yw-legal-peer href={link.href} key={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          </article>
        </div>
      </main>
    </>
  );
}
