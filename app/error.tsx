"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import {
  createErrorReferenceId,
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_PHONE,
  DEFAULT_SUPPORT_WHATSAPP,
  logWebsiteError
} from "../lib/error-reporting";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const referenceId = useMemo(
    () => createErrorReferenceId(error.digest || "PAGE"),
    [error.digest]
  );

  useEffect(() => {
    void logWebsiteError({
      category: "ui_crash",
      digest: error.digest,
      referenceId,
      safeMessage: "This page could not load properly.",
      userAction: "page_render"
    });
  }, [error.digest, referenceId]);

  return (
    <main className="success-page">
      <article className="success-document success-thank-you" aria-labelledby="error-title">
        <p className="policy-kicker success-kicker">Contact Support</p>
        <h1 id="error-title">Something went wrong</h1>
        <p className="success-subtitle">
          We could not complete this step. Please contact support for help.
        </p>
        <p className="success-subtitle">
          Email: <a href={`mailto:${DEFAULT_SUPPORT_EMAIL}`}>{DEFAULT_SUPPORT_EMAIL}</a>
          {DEFAULT_SUPPORT_PHONE ? ` | Phone: ${DEFAULT_SUPPORT_PHONE}` : ""}
        </p>
        <div className="success-actions">
          <button className="success-whatsapp-button" onClick={reset} type="button">
            Try Again
          </button>
          <a className="success-whatsapp-button" href={`mailto:${DEFAULT_SUPPORT_EMAIL}`}>
            Contact Support
          </a>
          {DEFAULT_SUPPORT_WHATSAPP ? (
            <a
              className="success-whatsapp-button"
              href={DEFAULT_SUPPORT_WHATSAPP}
              rel="noreferrer"
              target="_blank"
            >
              WhatsApp Support
            </a>
          ) : null}
          <Link className="success-whatsapp-button" href="/">
            Go Back Home
          </Link>
        </div>
        <code>Reference ID: {referenceId}</code>
      </article>
    </main>
  );
}
