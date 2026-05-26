"use client";

import { useEffect, useState } from "react";

export const START_DISPLAY_VIEWERS = 1;
const LIVE_VIEWER_ID_STORAGE_KEY = "ywc-live-viewer-id";

type LiveViewerPayload = {
  viewers?: unknown;
};

export function getLiveViewerCopy(count: number) {
  return count === 1
    ? "woman is viewing this page right now"
    : "women are viewing this page right now";
}

function normalizeViewerCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return START_DISPLAY_VIEWERS;
  }

  return Math.max(START_DISPLAY_VIEWERS, Math.round(parsed));
}

function liveViewerApiUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
    return null;
  }

  const url = new URL("/api/live-viewers", window.location.origin);
  const viewerId = getLiveViewerId();

  if (viewerId) {
    url.searchParams.set("viewerId", viewerId);
  }

  return url.toString();
}

function liveViewerSocketUrl(apiUrl: string) {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
}

function createViewerId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getLiveViewerId() {
  try {
    const existingViewerId = window.localStorage.getItem(LIVE_VIEWER_ID_STORAGE_KEY);

    if (existingViewerId) {
      return existingViewerId;
    }

    const viewerId = createViewerId();
    window.localStorage.setItem(LIVE_VIEWER_ID_STORAGE_KEY, viewerId);
    return viewerId;
  } catch {
    return null;
  }
}

export function useLiveViewerCount(initialViewerCount = START_DISPLAY_VIEWERS) {
  const [viewerCount, setViewerCount] = useState(() => normalizeViewerCount(initialViewerCount));

  useEffect(() => {
    const apiUrl = liveViewerApiUrl();

    if (!apiUrl) {
      return;
    }

    const endpoint = apiUrl;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const applyViewerCount = (payload: LiveViewerPayload) => {
      setViewerCount(normalizeViewerCount(payload.viewers));
    };

    const connectSocket = () => {
      if (cancelled || !("WebSocket" in window)) {
        return;
      }

      socket = new WebSocket(liveViewerSocketUrl(endpoint));

      socket.addEventListener("message", (event) => {
        try {
          applyViewerCount(JSON.parse(event.data) as LiveViewerPayload);
        } catch {
          // Ignore malformed live-viewer messages without interrupting the page.
        }
      });

      socket.addEventListener("close", () => {
        if (cancelled) {
          return;
        }

        reconnectTimer = window.setTimeout(connectSocket, 5000);
      });
    };

    async function loadSnapshot() {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });

        if (!response.ok || cancelled) {
          return;
        }

        applyViewerCount((await response.json()) as LiveViewerPayload);
        connectSocket();
      } catch {
        // Local Next.js dev does not serve the Cloudflare Pages Function.
        // Keep the honest single-viewer fallback instead of simulating demand.
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return viewerCount;
}

export function LiveViewerCount({ viewerCount: controlledViewerCount }: { viewerCount?: number }) {
  const localViewerCount = useLiveViewerCount();
  const displayCount = normalizeViewerCount(controlledViewerCount ?? localViewerCount);

  return (
    <span>
      <strong>{displayCount}</strong> {getLiveViewerCopy(displayCount)}
    </span>
  );
}
