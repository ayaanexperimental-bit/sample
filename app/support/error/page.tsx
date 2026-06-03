"use client";

import { ContactSupportFallback } from "../../../components/support/contact-support-fallback";
import { createSupportErrorReference } from "../../../lib/error-reporting";

export default function SupportErrorPage() {
  return (
    <ContactSupportFallback
      category="unknown"
      referenceId={createSupportErrorReference("unknown", "support")}
      safeMessage="Support fallback route opened."
      userAction="support_error_route"
    />
  );
}
