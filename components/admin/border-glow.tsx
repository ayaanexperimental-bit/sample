"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useRef
} from "react";
import styles from "./border-glow.module.css";

type BorderGlowStyle = CSSProperties & Record<`--${string}`, string | number>;

export type BorderGlowProps = HTMLAttributes<HTMLDivElement> & {
  animationDelayMs?: number;
  backgroundColor?: string;
  borderRadius?: number;
  colors?: string[];
  coneSpread?: number;
  edgeSensitivity?: number;
  fillOpacity?: number;
  glowColor?: string;
  glowIntensity?: number;
  glowRadius?: number;
  animated?: boolean;
};

function parseHsl(hsl: string) {
  const match = hsl.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 40, l: 80, s: 80 };

  return {
    h: Number.parseFloat(match[1]),
    l: Number.parseFloat(match[3]),
    s: Number.parseFloat(match[2])
  };
}

function buildGlowVars(glowColor: string, intensity: number): BorderGlowStyle {
  const { h, l, s } = parseHsl(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ["", "-60", "-50", "-40", "-30", "-20", "-10"];
  const vars: BorderGlowStyle = {};

  for (let index = 0; index < opacities.length; index += 1) {
    vars[`--glow-color${keys[index]}`] =
      `hsl(${base} / ${Math.min(opacities[index] * intensity, 100)}%)`;
  }

  return vars;
}

const GRADIENT_POSITIONS = [
  "80% 55%",
  "69% 34%",
  "8% 6%",
  "41% 38%",
  "86% 85%",
  "82% 18%",
  "51% 4%"
];

const GRADIENT_KEYS = [
  "--gradient-one",
  "--gradient-two",
  "--gradient-three",
  "--gradient-four",
  "--gradient-five",
  "--gradient-six",
  "--gradient-seven"
] as const;

const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors: string[]): BorderGlowStyle {
  const vars: BorderGlowStyle = {};

  for (let index = 0; index < GRADIENT_KEYS.length; index += 1) {
    const color = colors[Math.min(COLOR_MAP[index], colors.length - 1)];
    vars[GRADIENT_KEYS[index]] =
      `radial-gradient(at ${GRADIENT_POSITIONS[index]}, ${color} 0px, transparent 50%)`;
  }

  vars["--gradient-base"] = `linear-gradient(${colors[0]} 0 100%)`;
  return vars;
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function easeInCubic(value: number) {
  return value ** 3;
}

function animateValue({
  delay = 0,
  duration = 1000,
  ease = easeOutCubic,
  end = 100,
  onEnd,
  onUpdate,
  start = 0
}: {
  delay?: number;
  duration?: number;
  ease?: (value: number) => number;
  end?: number;
  onEnd?: () => void;
  onUpdate: (value: number) => void;
  start?: number;
}) {
  const startTime = performance.now() + delay;
  let animationFrame = 0;
  let timeout = 0;
  let cancelled = false;

  function tick() {
    if (cancelled) return;

    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(progress));

    if (progress < 1) {
      animationFrame = window.requestAnimationFrame(tick);
    } else {
      onEnd?.();
    }
  }

  timeout = window.setTimeout(() => {
    animationFrame = window.requestAnimationFrame(tick);
  }, delay);

  return () => {
    cancelled = true;
    window.clearTimeout(timeout);
    window.cancelAnimationFrame(animationFrame);
  };
}

export function BorderGlow({
  animated = false,
  animationDelayMs = 0,
  backgroundColor = "#120f17",
  borderRadius = 28,
  children,
  className = "",
  colors = ["#c084fc", "#f472b6", "#38bdf8"],
  coneSpread = 25,
  edgeSensitivity = 30,
  fillOpacity = 0.5,
  glowColor = "40 80 80",
  glowIntensity = 1,
  glowRadius = 40,
  style,
  ...props
}: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const getCenterOfElement = useCallback((element: HTMLElement) => {
    const { height, width } = element.getBoundingClientRect();
    return [width / 2, height / 2] as const;
  }, []);

  const getEdgeProximity = useCallback(
    (element: HTMLElement, x: number, y: number) => {
      const [centerX, centerY] = getCenterOfElement(element);
      const deltaX = x - centerX;
      const deltaY = y - centerY;
      const scaleX = deltaX === 0 ? Infinity : centerX / Math.abs(deltaX);
      const scaleY = deltaY === 0 ? Infinity : centerY / Math.abs(deltaY);

      return Math.min(Math.max(1 / Math.min(scaleX, scaleY), 0), 1);
    },
    [getCenterOfElement]
  );

  const getCursorAngle = useCallback(
    (element: HTMLElement, x: number, y: number) => {
      const [centerX, centerY] = getCenterOfElement(element);
      const deltaX = x - centerX;
      const deltaY = y - centerY;

      if (deltaX === 0 && deltaY === 0) return 0;

      const radians = Math.atan2(deltaY, deltaX);
      const degrees = radians * (180 / Math.PI) + 90;
      return degrees < 0 ? degrees + 360 : degrees;
    },
    [getCenterOfElement]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const edge = getEdgeProximity(card, x, y);
      const angle = getCursorAngle(card, x, y);

      card.style.setProperty("--edge-proximity", `${(edge * 100).toFixed(3)}`);
      card.style.setProperty("--cursor-angle", `${angle.toFixed(3)}deg`);
    },
    [getCursorAngle, getEdgeProximity]
  );

  useEffect(() => {
    if (!animated || !cardRef.current) return;

    const card = cardRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
    if (reducedMotion) return;

    const angleStart = 110;
    const angleEnd = 465;
    const startDelay = coarsePointer ? Math.max(animationDelayMs, 360) : animationDelayMs;
    const introDuration = coarsePointer ? 420 : 500;
    const angleIntroDuration = coarsePointer ? 1100 : 1500;
    const angleExitDuration = coarsePointer ? 1500 : 2250;
    const fadeDuration = coarsePointer ? 900 : 1500;
    const fadeDelay = startDelay + (coarsePointer ? 1700 : 2500);
    const peakEdge = 100;
    const cancelAnimations: Array<() => void> = [];
    card.classList.add(styles.sweepActive);
    card.style.setProperty("--cursor-angle", `${angleStart}deg`);

    cancelAnimations.push(animateValue({
      delay: startDelay,
      duration: introDuration,
      end: peakEdge,
      onUpdate: (value) => card.style.setProperty("--edge-proximity", `${value}`)
    }));
    cancelAnimations.push(animateValue({
      delay: startDelay,
      duration: angleIntroDuration,
      ease: easeInCubic,
      end: 50,
      onUpdate: (value) => {
        card.style.setProperty(
          "--cursor-angle",
          `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`
        );
      }
    }));
    cancelAnimations.push(animateValue({
      delay: startDelay + angleIntroDuration,
      duration: angleExitDuration,
      ease: easeOutCubic,
      end: peakEdge,
      start: 50,
      onUpdate: (value) => {
        card.style.setProperty(
          "--cursor-angle",
          `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`
        );
      }
    }));
    cancelAnimations.push(animateValue({
      delay: fadeDelay,
      duration: fadeDuration,
      ease: easeInCubic,
      end: 0,
      onEnd: () => card.classList.remove(styles.sweepActive),
      onUpdate: (value) => card.style.setProperty("--edge-proximity", `${value}`),
      start: peakEdge
    }));

    return () => {
      for (const cancel of cancelAnimations) {
        cancel();
      }
      card.classList.remove(styles.sweepActive);
    };
  }, [animated, animationDelayMs]);

  const glowVars = buildGlowVars(glowColor, glowIntensity);
  const gradientVars = buildGradientVars(colors);
  const borderGlowStyle: BorderGlowStyle = {
    ...style,
    "--border-radius": `${borderRadius}px`,
    "--card-bg": backgroundColor,
    "--cone-spread": coneSpread,
    "--edge-sensitivity": edgeSensitivity,
    "--fill-opacity": fillOpacity,
    "--glow-padding": `${glowRadius}px`,
    ...glowVars,
    ...gradientVars
  };

  return (
    <div
      {...props}
      ref={cardRef}
      className={`${styles.card} ${className}`.trim()}
      onPointerMove={handlePointerMove}
      style={borderGlowStyle}
    >
      <span className={styles.edgeLight} aria-hidden="true" />
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
