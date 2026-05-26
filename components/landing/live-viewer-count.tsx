"use client";

import { useEffect, useState } from "react";

const MIN_DISPLAY_VIEWERS = 128;
const MAX_DISPLAY_VIEWERS = 189;
const START_DISPLAY_VIEWERS = 141;

export function LiveViewerCount() {
  const [viewerCount, setViewerCount] = useState(START_DISPLAY_VIEWERS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setViewerCount((current) => {
        const next = current + Math.floor(Math.random() * 7) - 3;
        return Math.max(MIN_DISPLAY_VIEWERS, Math.min(MAX_DISPLAY_VIEWERS, next));
      });
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <span>
      <strong>{viewerCount}</strong> women are viewing this page right now
    </span>
  );
}
