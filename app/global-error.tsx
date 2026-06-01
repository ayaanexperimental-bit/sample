"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
import {
  createErrorReferenceId,
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_PHONE,
  DEFAULT_SUPPORT_WHATSAPP,
  logWebsiteError
} from "../lib/error-reporting";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
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

const actionStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.7rem"
} satisfies CSSProperties;

const supportLinkStyle = {
  ...buttonStyle,
  alignItems: "center",
  display: "inline-flex",
  textDecoration: "none"
} satisfies CSSProperties;

const referenceStyle = {
  display: "inline-flex",
  marginTop: "1rem",
  borderRadius: "999px",
  background: "rgba(126, 87, 116, 0.1)",
  color: "#64415f",
  padding: "0.42rem 0.72rem",
  fontSize: "0.86rem",
  fontWeight: 800
} satisfies CSSProperties;

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  const referenceId = useMemo(
    () => createErrorReferenceId(error.digest || "ROOT"),
    [error.digest]
  );

  useEffect(() => {
    void logWebsiteError({
      category: "ui_crash",
      digest: error.digest,
      referenceId,
      safeMessage: "The site shell could not load properly.",
      userAction: "global_render"
    });
  }, [error.digest, referenceId]);

  return (
    <html lang="en">
      <body style={pageStyle}>
        <main style={cardStyle}>
          <h1 style={titleStyle}>Something went wrong</h1>
          <p style={copyStyle}>
            We could not complete this step. Please contact support for help.
          </p>
          <p style={copyStyle}>
            Email: <a href={`mailto:${DEFAULT_SUPPORT_EMAIL}`}>{DEFAULT_SUPPORT_EMAIL}</a>
            {DEFAULT_SUPPORT_PHONE ? ` | Phone: ${DEFAULT_SUPPORT_PHONE}` : ""}
          </p>
          <div style={actionStyle}>
            <button onClick={reset} style={buttonStyle} type="button">
              Try Again
            </button>
            <a href={`mailto:${DEFAULT_SUPPORT_EMAIL}`} style={supportLinkStyle}>
              Contact Support
            </a>
            {DEFAULT_SUPPORT_WHATSAPP ? (
              <a
                href={DEFAULT_SUPPORT_WHATSAPP}
                rel="noreferrer"
                style={supportLinkStyle}
                target="_blank"
              >
                WhatsApp Support
              </a>
            ) : null}
            <Link href="/" style={supportLinkStyle}>
              Go Back Home
            </Link>
          </div>
          <code style={referenceStyle}>Reference ID: {referenceId}</code>
        </main>
      </body>
    </html>
  );
}
