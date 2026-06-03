"use client";

import { ContactSupportFallback } from "../components/support/contact-support-fallback";
import { createSupportErrorReference } from "../lib/error-reporting";

export default function NotFoundPage() {
  return (
    <ContactSupportFallback
      category="route_not_found"
      message="The page you opened is not available. Please contact support for help."
      referenceId={createSupportErrorReference("route_not_found", "not-found")}
      safeMessage="Route not found."
      userAction="route_not_found"
    />
  );
}
