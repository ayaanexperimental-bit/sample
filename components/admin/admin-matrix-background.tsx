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
  cellHeight: number;
  cellWidth: number;
  columns: MatrixColumn[];
  glyphs: string[];
  rows: number;
};

const GLYPHS =
  "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function AdminMatrixBackground({ className = "" }: MatrixBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<MatrixGrid | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const activeCanvas = canvas;
    const activeContext = context;

    let animationFrame = 0;
    let lastFrameAt = 0;
    let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function buildGrid(width: number, height: number): MatrixGrid {
      const cellWidth = width < 700 ? 14 : 17;
      const cellHeight = width < 700 ? 17 : 21;
      const columnCount = Math.ceil(width / cellWidth) + 2;
      const rows = Math.ceil(height / cellHeight) + 2;

      return {
        cellHeight,
        cellWidth,
        columns: Array.from({ length: columnCount }, () => ({
          offset: Math.random() * rows,
          secondaryOffset: Math.random() * rows,
          speed: 5 + Math.random() * 8,
          tail: 7 + Math.random() * 11
        })),
        glyphs: Array.from({ length: columnCount * rows }, () => {
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }),
        rows
      };
    }

    function resize() {
      const rect = activeCanvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      activeCanvas.width = Math.floor(width * dpr);
      activeCanvas.height = Math.floor(height * dpr);
      activeContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      gridRef.current = buildGrid(width, height);
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
      const seconds = time / 1000;
      const period = grid.rows + 18;

      activeContext.clearRect(0, 0, width, height);
      activeContext.fillStyle = "rgba(2, 8, 10, 0.28)";
      activeContext.fillRect(0, 0, width, height);
      activeContext.font = `${Math.round(grid.cellHeight * 0.76)}px "Cascadia Code", "IBM Plex Mono", ui-monospace, monospace`;
      activeContext.textAlign = "center";
      activeContext.textBaseline = "middle";

      for (let columnIndex = 0; columnIndex < grid.columns.length; columnIndex += 1) {
        const column = grid.columns[columnIndex];
        const x = columnIndex * grid.cellWidth + grid.cellWidth * 0.5;
        const headA = (seconds * column.speed + column.offset) % period;
        const headB = (seconds * (column.speed * 0.68) + column.secondaryOffset + period * 0.45) % period;

        for (let row = 0; row < grid.rows; row += 1) {
          const y = row * grid.cellHeight + grid.cellHeight * 0.5;
          const pulse = Math.max(
            getPulse(row, headA, column.tail),
            getPulse(row, headB, column.tail * 0.72)
          );
          const ambient = reduceMotion ? 0.18 : 0.085;
          const alpha = Math.min(1, ambient + pulse * 0.94);
          const glyph = grid.glyphs[columnIndex * grid.rows + row];
          const tracer = pulse > 0.84;

          if (tracer) {
            activeContext.shadowBlur = 18;
            activeContext.shadowColor = "rgba(191, 255, 217, 1)";
            activeContext.fillStyle = `rgba(221, 255, 231, ${Math.min(1, alpha + 0.3)})`;
          } else {
            activeContext.shadowBlur = pulse > 0.18 ? 11 : 0;
            activeContext.shadowColor = "rgba(44, 255, 137, 0.76)";
            activeContext.fillStyle = `rgba(42, 255, 132, ${alpha})`;
          }

          activeContext.fillText(glyph, x, y);
        }
      }

      activeContext.shadowBlur = 0;
    }

    function animate(time: number) {
      if (!lastFrameAt || time - lastFrameAt >= 33 || reduceMotion) {
        draw(time);
        lastFrameAt = time;
      }

      if (!reduceMotion) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    }

    function handleMotionChange(event: MediaQueryListEvent) {
      reduceMotion = event.matches;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(animate);
    }

    resize();
    animationFrame = window.requestAnimationFrame(animate);
    window.addEventListener("resize", resize);
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return (
    <div className={`${styles.matrixBackground} ${className}`.trim()} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      <span className={styles.vignette} />
    </div>
  );
}
