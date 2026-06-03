"use client";

import { ContactSupportFallback } from "../components/support/contact-support-fallback";
import { createSupportErrorReference } from "../lib/error-reporting";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body>
        <ContactSupportFallback
          category="ui_crash"
          onReset={reset}
          referenceId={createSupportErrorReference("ui_crash", error.digest || "root")}
          safeMessage="The site shell could not load properly."
          technicalDetails={error.digest || error.message}
          userAction="global_render"
        />
      </body>
    </html>
  );
}
