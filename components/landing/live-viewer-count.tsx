"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "hyh_live_viewer_session";
const HEARTBEAT_INTERVAL_MS = 30000;

function getSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }

    const next =
      window.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

export function LiveViewerCount() {
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    let disposed = false;

    async function heartbeat(active = true) {
      try {
        const response = await fetch("/api/live-viewers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, active }),
          cache: "no-store",
          keepalive: !active
        });

        if (!response.ok || disposed) {
          return;
        }

        const payload = (await response.json()) as { viewers?: unknown };
        if (typeof payload.viewers === "number" && Number.isFinite(payload.viewers)) {
          setViewerCount(Math.max(1, payload.viewers));
        }
      } catch {
        // Keep the static fallback copy if the live endpoint is unavailable.
      }
    }

    heartbeat();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        heartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        heartbeat();
      }
    }

    function handlePageHide() {
      heartbeat(false);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      heartbeat(false);
    };
  }, []);

  if (viewerCount === null) {
    return <span>Live viewers are updating now</span>;
  }

  return (
    <span>
      <strong>{viewerCount}</strong> {viewerCount === 1 ? "woman is" : "women are"} viewing this
      page right now
    </span>
  );
}
