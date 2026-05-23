"use client";

import { useEffect, useState } from "react";

const INITIAL_RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 30000;

type ViewerCountMessage = {
  type?: unknown;
  viewers?: unknown;
};

function getLiveViewerUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/live-viewers`;
}

function parseViewerPayload(payload: ViewerCountMessage) {
  if (
    payload.type === "viewer_count" &&
    typeof payload.viewers === "number" &&
    Number.isInteger(payload.viewers) &&
    payload.viewers >= 0
  ) {
    return payload.viewers;
  }

  return null;
}

function parseViewerCountMessage(message: string) {
  try {
    const payload = JSON.parse(message) as ViewerCountMessage;
    return parseViewerPayload(payload);
  } catch {
    return null;
  }
}

export function LiveViewerCount() {
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    let connecting = false;
    let disposed = false;

    function setViewerCountIfChanged(count: number) {
      setViewerCount((current) => (current === count ? current : count));
    }

    function clearReconnectTimer() {
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    }

    function scheduleReconnect() {
      clearReconnectTimer();

      if (disposed || document.visibilityState !== "visible") {
        return;
      }

      const delay = reconnectDelay;
      reconnectDelay = Math.min(Math.round(reconnectDelay * 1.6), MAX_RECONNECT_DELAY_MS);
      reconnectTimer = window.setTimeout(connect, delay);
    }

    function closeSocket() {
      clearReconnectTimer();

      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;

        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, "Viewer left page");
        }
      }

      socket = null;
    }

    async function fetchViewerCountSnapshot() {
      const response = await fetch("/api/live-viewers", {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as { viewers?: unknown };
      if (typeof payload.viewers === "number" && Number.isInteger(payload.viewers) && payload.viewers >= 0) {
        setViewerCountIfChanged(payload.viewers);
      }

      return true;
    }

    async function connectSocket() {
      if (
        disposed ||
        connecting ||
        document.visibilityState !== "visible" ||
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }

      connecting = true;

      try {
        const isEndpointReady = await fetchViewerCountSnapshot();

        if (!isEndpointReady || disposed || document.visibilityState !== "visible") {
          scheduleReconnect();
          return;
        }

        socket = new WebSocket(getLiveViewerUrl());
      } catch {
        scheduleReconnect();
        return;
      } finally {
        connecting = false;
      }

      reconnectDelay = INITIAL_RECONNECT_DELAY_MS;

      socket.onmessage = (event) => {
        if (typeof event.data !== "string") {
          return;
        }

        const count = parseViewerCountMessage(event.data);

        if (count !== null) {
          setViewerCountIfChanged(count);
        }
      };

      socket.onclose = () => {
        socket = null;
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket?.close(3001, "Viewer connection error");
      };
    }

    function connect() {
      void connectSocket();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        connect();
      } else {
        closeSocket();
      }
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", connect);
    window.addEventListener("pagehide", closeSocket);

    return () => {
      disposed = true;
      connecting = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", connect);
      window.removeEventListener("pagehide", closeSocket);
      closeSocket();
    };
  }, []);

  if (viewerCount === null) {
    return <span>Live viewer count is connecting</span>;
  }

  return (
    <span>
      <strong>{viewerCount}</strong> {viewerCount === 1 ? "woman is" : "women are"} viewing this
      page right now
    </span>
  );
}
