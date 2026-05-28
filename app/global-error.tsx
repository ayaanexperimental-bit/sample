"use client";

import type { CSSProperties } from "react";

type GlobalErrorPageProps = {
  reset: () => void;
};

const pageStyle = {
  margin: 0,
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#fff7fb",
  color: "#251126",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  padding: "1rem"
} satisfies CSSProperties;

const cardStyle = {
  width: "min(92vw, 34rem)",
  padding: "2rem",
  border: "1px solid rgba(201, 33, 126, 0.18)",
  borderRadius: "1.25rem",
  background: "rgba(255, 255, 255, 0.88)",
  boxShadow: "0 1rem 3rem rgba(99, 25, 70, 0.12)"
} satisfies CSSProperties;

const titleStyle = {
  margin: "0 0 0.75rem",
  fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
  lineHeight: 1.05
} satisfies CSSProperties;

const copyStyle = {
  margin: "0 0 1.5rem",
  color: "#60445e",
  fontSize: "1rem",
  lineHeight: 1.6
} satisfies CSSProperties;

const buttonStyle = {
  minHeight: "3rem",
  border: 0,
  borderRadius: "999px",
  background: "#c9217e",
  color: "#fff",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 800,
  padding: "0.8rem 1.35rem"
} satisfies CSSProperties;

export default function GlobalErrorPage({ reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body style={pageStyle}>
        <main style={cardStyle}>
          <h1 style={titleStyle}>This page could not load properly</h1>
          <p style={copyStyle}>
            Please try again. If the issue continues, return to the main page and reopen this section.
          </p>
          <button onClick={reset} style={buttonStyle} type="button">
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
