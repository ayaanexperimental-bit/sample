"use client";

export type AdaptiveVisualCapability = "full" | "reduced" | "static";

type NavigatorWithPerformanceHints = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
  deviceMemory?: number;
};

const CAPABILITY_QUERIES = [
  "(prefers-reduced-motion: reduce)",
  "(hover: hover) and (pointer: fine)",
  "(hover: none), (pointer: coarse)",
  "(min-width: 1024px)"
];

export function getAdaptiveVisualCapability(win: Window = window): AdaptiveVisualCapability {
  const nav = win.navigator as NavigatorWithPerformanceHints;
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = win.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const coarsePointer = win.matchMedia("(hover: none), (pointer: coarse)").matches;
  const wideViewport = win.matchMedia("(min-width: 1024px)").matches;
  const cores = nav.hardwareConcurrency || 0;
  const memory = nav.deviceMemory || 0;
  const saveData = Boolean(nav.connection?.saveData);
  const effectiveType = nav.connection?.effectiveType || "";
  const slowNetwork = /(^|-)2g$/.test(effectiveType) || effectiveType === "slow-2g";
  const dpr = win.devicePixelRatio || 1;
  const strictWebgl2 = supportsWebgl2(win, true);
  const basicWebgl2 = strictWebgl2 || supportsWebgl2(win, false);

  if (reducedMotion || saveData || slowNetwork || nav.webdriver || !basicWebgl2) {
    return "static";
  }

  const memoryKnown = memory > 0;
  const coresKnown = cores > 0;
  const clearlyConstrained =
    (memoryKnown && memory <= 2) ||
    (coresKnown && cores <= 2) ||
    (coarsePointer && memoryKnown && memory < 3) ||
    (coarsePointer && coresKnown && cores < 4) ||
    (coarsePointer &&
      dpr >= 3.5 &&
      ((memoryKnown && memory < 4) || (coresKnown && cores < 6)));

  if (clearlyConstrained) {
    return "static";
  }

  if (finePointer && wideViewport && strictWebgl2) {
    return "full";
  }

  if (coarsePointer) {
    return "reduced";
  }

  return "reduced";
}

export function watchAdaptiveVisualCapability(
  onChange: (capability: AdaptiveVisualCapability) => void,
  win: Window = window
) {
  const mediaQueries = CAPABILITY_QUERIES.map((query) => win.matchMedia(query));
  let lastCapability: AdaptiveVisualCapability | null = null;

  const sync = () => {
    const capability = getAdaptiveVisualCapability(win);
    if (capability === lastCapability) {
      return;
    }

    lastCapability = capability;
    onChange(capability);
  };

  sync();
  mediaQueries.forEach((query) => query.addEventListener("change", sync));

  return () => {
    mediaQueries.forEach((query) => query.removeEventListener("change", sync));
  };
}

function supportsWebgl2(win: Window, requireNoMajorPerformanceCaveat: boolean) {
  try {
    const canvas = win.document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      failIfMajorPerformanceCaveat: requireNoMajorPerformanceCaveat,
      powerPreference: "low-power"
    });

    if (!gl) {
      return false;
    }

    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
