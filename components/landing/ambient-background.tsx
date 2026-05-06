"use client";

import type { CSSProperties } from "react";

type AmbientStyle = CSSProperties & {
  "--pointer-x": string;
  "--pointer-y": string;
};

export function AmbientBackground() {
  const style: AmbientStyle = {
    "--pointer-x": "52%",
    "--pointer-y": "18%"
  };

  return (
    <div className="ambient-background" aria-hidden="true" style={style}>
      <span className="ambient-background__veil ambient-background__veil--rose" />
      <span className="ambient-background__veil ambient-background__veil--aqua" />
      <span className="ambient-background__veil ambient-background__veil--peach" />
      <span className="ambient-background__glow" />
    </div>
  );
}
