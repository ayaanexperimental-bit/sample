"use client";

import { useEffect, useState } from "react";

const MIN_DISPLAY_VIEWERS = 128;
const MAX_DISPLAY_VIEWERS = 189;
export const START_DISPLAY_VIEWERS = 141;

export function getNextLiveViewerCount(current: number) {
  const next = current + Math.floor(Math.random() * 7) - 3;
  return Math.max(MIN_DISPLAY_VIEWERS, Math.min(MAX_DISPLAY_VIEWERS, next));
}

export function LiveViewerCount({ viewerCount: controlledViewerCount }: { viewerCount?: number }) {
  const [localViewerCount, setLocalViewerCount] = useState(START_DISPLAY_VIEWERS);

  useEffect(() => {
    if (controlledViewerCount !== undefined) return;

    const timer = window.setInterval(() => {
      setLocalViewerCount(getNextLiveViewerCount);
    }, 4000);

    return () => {
      window.clearInterval(timer);
    };
  }, [controlledViewerCount]);

  const displayCount = controlledViewerCount ?? localViewerCount;

  return (
    <span>
      <strong>{displayCount}</strong> women are viewing this page right now
    </span>
  );
}
