"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/landing/use-reduced-motion";

type AmbientStyle = CSSProperties & {
  "--pointer-x": string;
  "--pointer-y": string;
};

export function AmbientBackground() {
  const reducedMotion = useReducedMotion();
  const [position, setPosition] = useState({ x: 50, y: 18 });

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") {
        return;
      }

      setPosition({
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100
      });
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [reducedMotion]);

  const style: AmbientStyle = {
    "--pointer-x": `${position.x}%`,
    "--pointer-y": `${position.y}%`
  };

  return (
    <div className="ambient-background" aria-hidden="true" style={style}>
      <span className="ambient-background__veil ambient-background__veil--rose" />
      <span className="ambient-background__veil ambient-background__veil--aqua" />
      <span className="ambient-background__veil ambient-background__veil--peach" />
      <span className="ambient-background__glow" />
      <span className="ambient-background__dust" />
    </div>
  );
}
