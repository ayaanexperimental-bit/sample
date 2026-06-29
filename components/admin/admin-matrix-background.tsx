"use client";

import { useEffect, useRef } from "react";
import styles from "./admin-matrix-background.module.css";

type MatrixBackgroundProps = {
  className?: string;
};

type MatrixColumn = {
  offset: number;
  secondaryOffset: number;
  speed: number;
  tail: number;
};

type MatrixGrid = {
  ambientCanvas: HTMLCanvasElement;
  cellHeight: number;
  cellWidth: number;
  columns: MatrixColumn[];
  dpr: number;
  font: string;
  glyphs: string[];
  height: number;
  rows: number;
  width: number;
};

const GLYPHS =
  "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const DESKTOP_FRAME_MS = 40;
const MOBILE_FRAME_MS = 48;
const DESKTOP_STARTUP_DELAY_MS = 120;
const MOBILE_STARTUP_DELAY_MS = 650;
const DESKTOP_DPR_LIMIT = 1.25;
const MOBILE_DPR_LIMIT = 1;
const TRACER_SHADOW_BLUR = 14;
const ACTIVE_SHADOW_BLUR = 8;
const ACTIVE_SHADOW_THRESHOLD = 0.34;
const ACTIVE_PULSE_THRESHOLD = 0.045;

export function AdminMatrixBackground({ className = "" }: MatrixBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<MatrixGrid | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) return;

    const activeCanvas = canvas;
    const activeContext = context;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarseQuery = window.matchMedia("(max-width: 700px), (pointer: coarse)");
    let animationFrame = 0;
    let resizeFrame = 0;
    let startupTimer = 0;
    let lastFrameAt = 0;
    let frameIntervalMs = DESKTOP_FRAME_MS;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let canvasDpr = 1;
    let isCanvasVisible = true;
    let isPageVisible = document.visibilityState === "visible";
    let reduceMotion = motionQuery.matches;
    let startupComplete = false;

    function buildGrid(width: number, height: number, dpr: number): MatrixGrid {
      const cellWidth = width < 700 ? 14 : 17;
      const cellHeight = width < 700 ? 17 : 21;
      const columnCount = Math.ceil(width / cellWidth) + 2;
      const rows = Math.ceil(height / cellHeight) + 2;
      const font = `${Math.round(cellHeight * 0.76)}px "Cascadia Code", "IBM Plex Mono", ui-monospace, monospace`;
      const grid: MatrixGrid = {
        ambientCanvas: document.createElement("canvas"),
        cellHeight,
        cellWidth,
        columns: Array.from({ length: columnCount }, () => ({
          offset: Math.random() * rows,
          secondaryOffset: Math.random() * rows,
          speed: 5 + Math.random() * 8,
          tail: 7 + Math.random() * 11
        })),
        dpr,
        glyphs: Array.from({ length: columnCount * rows }, () => {
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }),
        font,
        height,
        rows,
        width
      };

      paintAmbientLayer(grid);
      return grid;
    }

    function paintAmbientLayer(grid: MatrixGrid) {
      const ambientContext = grid.ambientCanvas.getContext("2d", { alpha: true });
      if (!ambientContext) return;

      grid.ambientCanvas.width = Math.floor(grid.width * grid.dpr);
      grid.ambientCanvas.height = Math.floor(grid.height * grid.dpr);
      ambientContext.setTransform(grid.dpr, 0, 0, grid.dpr, 0, 0);
      ambientContext.imageSmoothingEnabled = false;
      ambientContext.clearRect(0, 0, grid.width, grid.height);
      ambientContext.fillStyle = "rgba(2, 8, 10, 0.28)";
      ambientContext.fillRect(0, 0, grid.width, grid.height);
      ambientContext.font = grid.font;
      ambientContext.textAlign = "center";
      ambientContext.textBaseline = "middle";
      ambientContext.fillStyle = `rgba(42, 255, 132, ${reduceMotion ? 0.18 : 0.085})`;

      for (let columnIndex = 0; columnIndex < grid.columns.length; columnIndex += 1) {
        const glyphBaseIndex = columnIndex * grid.rows;
        const x = columnIndex * grid.cellWidth + grid.cellWidth * 0.5;

        for (let row = 0; row < grid.rows; row += 1) {
          const y = row * grid.cellHeight + grid.cellHeight * 0.5;
          ambientContext.fillText(grid.glyphs[glyphBaseIndex + row], x, y);
        }
      }
    }

    function resize() {
      const rect = activeCanvas.getBoundingClientRect();
      const dprLimit = coarseQuery.matches ? MOBILE_DPR_LIMIT : DESKTOP_DPR_LIMIT;
      const dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      frameIntervalMs = coarseQuery.matches ? MOBILE_FRAME_MS : DESKTOP_FRAME_MS;

      if (width === canvasWidth && height === canvasHeight && dpr === canvasDpr) {
        return;
      }

      canvasWidth = width;
      canvasHeight = height;
      canvasDpr = dpr;

      activeCanvas.width = Math.floor(width * dpr);
      activeCanvas.height = Math.floor(height * dpr);
      activeContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      activeContext.imageSmoothingEnabled = false;
      gridRef.current = buildGrid(width, height, dpr);
    }

    function scheduleResize() {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resize();
        draw(performance.now());
      });
    }

    function getPulse(row: number, head: number, tail: number) {
      const distance = row - head;
      if (distance < 0 || distance > tail) return 0;
      return (1 - distance / tail) ** 1.65;
    }

    function draw(time: number) {
      const grid = gridRef.current;
      if (!grid) return;

      const width = activeCanvas.clientWidth;
      const height = activeCanvas.clientHeight;
      const { ambientCanvas, cellHeight, cellWidth, columns, glyphs, rows } = grid;
      const seconds = time / 1000;
      const period = rows + 18;

      activeContext.clearRect(0, 0, width, height);
      activeContext.drawImage(ambientCanvas, 0, 0, width, height);
      activeContext.font = grid.font;
      activeContext.textAlign = "center";
      activeContext.textBaseline = "middle";

      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const column = columns[columnIndex];
        const glyphBaseIndex = columnIndex * rows;
        const x = columnIndex * cellWidth + cellWidth * 0.5;
        const headA = (seconds * column.speed + column.offset) % period;
        const headB = (seconds * (column.speed * 0.68) + column.secondaryOffset + period * 0.45) % period;

        for (let row = 0; row < rows; row += 1) {
          const y = row * cellHeight + cellHeight * 0.5;
          const pulse = Math.max(
            getPulse(row, headA, column.tail),
            getPulse(row, headB, column.tail * 0.72)
          );
          const ambient = reduceMotion ? 0.18 : 0.085;
          const alpha = Math.min(1, ambient + pulse * 0.94);
          if (pulse <= ACTIVE_PULSE_THRESHOLD) {
            continue;
          }

          const glyph = glyphs[glyphBaseIndex + row];
          const tracer = pulse > 0.84;
          const activeAlpha = Math.min(1, pulse * 0.94);

          if (tracer) {
            activeContext.shadowBlur = TRACER_SHADOW_BLUR;
            activeContext.shadowColor = "rgba(191, 255, 217, 1)";
            activeContext.fillStyle = `rgba(221, 255, 231, ${Math.min(1, alpha + 0.3)})`;
          } else if (pulse > ACTIVE_SHADOW_THRESHOLD) {
            activeContext.shadowBlur = ACTIVE_SHADOW_BLUR;
            activeContext.shadowColor = "rgba(44, 255, 137, 0.76)";
            activeContext.fillStyle = `rgba(42, 255, 132, ${activeAlpha})`;
          } else {
            activeContext.shadowBlur = 0;
            activeContext.shadowColor = "rgba(44, 255, 137, 0.76)";
            activeContext.fillStyle = `rgba(42, 255, 132, ${activeAlpha})`;
          }

          activeContext.fillText(glyph, x, y);
        }
      }

      activeContext.shadowBlur = 0;
    }

    function animate(time: number) {
      animationFrame = 0;

      if (!isPageVisible || !isCanvasVisible) {
        return;
      }

      if (!lastFrameAt || time - lastFrameAt >= frameIntervalMs || reduceMotion) {
        draw(time);
        lastFrameAt = time;
      }

      if (!reduceMotion) {
        startAnimation();
      }
    }

    function startAnimation() {
      if (animationFrame || reduceMotion || !startupComplete || !isPageVisible || !isCanvasVisible) {
        return;
      }

      animationFrame = window.requestAnimationFrame(animate);
    }

    function startAnimationAfterFirstPaint() {
      if (reduceMotion) return;

      window.clearTimeout(startupTimer);
      startupTimer = window.setTimeout(
        () => {
          startupComplete = true;
          lastFrameAt = 0;
          startAnimation();
        },
        coarseQuery.matches ? MOBILE_STARTUP_DELAY_MS : DESKTOP_STARTUP_DELAY_MS
      );
    }

    function handleMotionChange(event: MediaQueryListEvent) {
      reduceMotion = event.matches;
      if (!reduceMotion) {
        startupComplete = true;
      }
      const grid = gridRef.current;
      if (grid) {
        paintAmbientLayer(grid);
      }
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrameAt = 0;
      draw(performance.now());
      startAnimation();
    }

    function handleVisibilityChange() {
      isPageVisible = document.visibilityState === "visible";

      if (isPageVisible) {
        lastFrameAt = 0;
        draw(performance.now());
        startAnimation();
      } else {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              isCanvasVisible = entry.isIntersecting;

              if (isCanvasVisible) {
                lastFrameAt = 0;
                startAnimation();
              } else {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
              }
            },
            { threshold: 0.01 }
          )
        : null;

    resize();
    draw(performance.now());
    startAnimationAfterFirstPaint();
    observer?.observe(activeCanvas);
    window.addEventListener("resize", scheduleResize, { passive: true });
    motionQuery.addEventListener("change", handleMotionChange);
    coarseQuery.addEventListener("change", scheduleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      window.clearTimeout(startupTimer);
      window.removeEventListener("resize", scheduleResize);
      motionQuery.removeEventListener("change", handleMotionChange);
      coarseQuery.removeEventListener("change", scheduleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className={`${styles.matrixBackground} ${className}`.trim()} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      <span className={styles.vignette} />
    </div>
  );
}
