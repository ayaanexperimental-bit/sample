"use client";

import { ContactSupportFallback } from "../components/support/contact-support-fallback";
import { createSupportErrorReference } from "../lib/error-reporting";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <ContactSupportFallback
      category="ui_crash"
      onReset={reset}
      referenceId={createSupportErrorReference("ui_crash", error.digest || "page")}
      safeMessage="This page could not load properly."
      technicalDetails={error.digest || error.message}
      userAction="page_render"
    />
  );
}
