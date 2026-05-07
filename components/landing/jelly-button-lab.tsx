"use client";

import type { PointerEvent } from "react";
import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
  baseY: number;
  velocity: number;
};

function drawRoundedRect(ctx: CanvasRenderingContext2D, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
}

export function JellyCanvasButton() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false, impact: 0 });

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) {
      return;
    }

    const maybeContext = canvasElement.getContext("2d");
    if (!maybeContext) {
      return;
    }
    const canvas = canvasElement;
    const context = maybeContext;

    let frame = 0;
    let animation = 0;
    const pointCount = 18;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      context.setTransform(scale, 0, 0, scale, 0, 0);
      pointsRef.current = Array.from({ length: pointCount }, (_, index) => {
        const x = (rect.width * index) / (pointCount - 1);
        const baseY = rect.height * 0.48;
        return { x, y: baseY, baseY, velocity: 0 };
      });
    }

    function render() {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const pointer = pointerRef.current;
      frame += 1;
      context.clearRect(0, 0, width, height);

      const points = pointsRef.current;
      points.forEach((point, index) => {
        const distance = Math.abs(point.x / Math.max(width, 1) - pointer.x);
        const pressure = pointer.active ? Math.max(0, 1 - distance * 4.8) * pointer.impact : 0;
        const neighbour =
          ((points[index - 1]?.y ?? point.baseY) + (points[index + 1]?.y ?? point.baseY)) / 2;
        const spring = (point.baseY - point.y) * 0.08;
        const spread = (neighbour - point.y) * 0.035;

        point.velocity += spring + spread + pressure * 2.2;
        point.velocity *= 0.82;
        point.y += point.velocity;
      });

      pointer.impact *= 0.88;

      context.save();
      drawRoundedRect(context, width, height, height / 2);
      context.clip();

      const shell = context.createLinearGradient(0, 0, width, height);
      shell.addColorStop(0, "#ff8bc7");
      shell.addColorStop(0.45, "#d62688");
      shell.addColorStop(1, "#7b5cff");
      context.fillStyle = shell;
      context.fillRect(0, 0, width, height);

      const water = context.createLinearGradient(0, 0, width, height);
      water.addColorStop(0, "rgba(255,255,255,0.76)");
      water.addColorStop(0.38, "rgba(176,236,255,0.28)");
      water.addColorStop(0.7, "rgba(255,160,220,0.24)");
      water.addColorStop(1, "rgba(69,39,170,0.34)");

      context.beginPath();
      context.moveTo(0, height);
      context.lineTo(0, points[0]?.y ?? height * 0.5);
      points.forEach((point, index) => {
        const next = points[index + 1];
        if (next) {
          context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
        } else {
          context.lineTo(point.x, point.y);
        }
      });
      context.lineTo(width, height);
      context.closePath();
      context.fillStyle = water;
      context.fill();

      for (let i = 0; i < 4; i += 1) {
        const y = height * (0.24 + i * 0.16) + Math.sin(frame / 18 + i) * 3;
        const caustic = context.createLinearGradient(0, y, width, y + 18);
        caustic.addColorStop(0, "rgba(255,255,255,0)");
        caustic.addColorStop(0.5, "rgba(255,255,255,0.22)");
        caustic.addColorStop(1, "rgba(255,255,255,0)");
        context.strokeStyle = caustic;
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(-20, y);
        context.bezierCurveTo(width * 0.25, y - 14, width * 0.62, y + 22, width + 20, y - 6);
        context.stroke();
      }

      const highlight = context.createRadialGradient(
        pointer.x * width,
        pointer.y * height,
        2,
        pointer.x * width,
        pointer.y * height,
        width * 0.62
      );
      highlight.addColorStop(0, "rgba(255,255,255,0.5)");
      highlight.addColorStop(0.22, "rgba(208,248,255,0.2)");
      highlight.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = highlight;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = "rgba(255,255,255,0.72)";
      context.lineWidth = 1.5;
      drawRoundedRect(context, width - 1.5, height - 1.5, height / 2 - 1);
      context.stroke();
      context.restore();

      animation = requestAnimationFrame(render);
    }

    resize();
    animation = requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
    };
  }, []);

  function updatePointer(event: PointerEvent<HTMLButtonElement>, active: boolean) {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    pointerRef.current.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    pointerRef.current.active = active;
    pointerRef.current.impact = active ? 1 : Math.max(pointerRef.current.impact, 0.38);
  }

  return (
    <button
      className="jelly-lab-button jelly-lab-button--canvas"
      type="button"
      onPointerDown={(event) => updatePointer(event, true)}
      onPointerMove={(event) => updatePointer(event, pointerRef.current.active)}
      onPointerUp={(event) => updatePointer(event, false)}
      onPointerCancel={(event) => updatePointer(event, false)}
      onPointerLeave={(event) => updatePointer(event, false)}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <span>Canvas Jelly Button</span>
    </button>
  );
}

export function CssWaterButton() {
  return (
    <button className="ui-button ui-button--primary ui-button--lg jelly-lab-css-button" type="button" data-ripple="liquid">
      <span className="ui-button__content">CSS Water Button</span>
    </button>
  );
}
