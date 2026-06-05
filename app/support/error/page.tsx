"use client";

import { useEffect, useState } from "react";
import { ContactSupportFallback } from "../../../components/support/contact-support-fallback";
import {
  createSupportErrorReference,
  normalizePublicErrorCategory,
  type PublicWebsiteErrorCategory
} from "../../../lib/error-reporting";

const CODE_TO_CATEGORY: Record<string, PublicWebsiteErrorCategory> = {
  "YW-ERR-0001": "unknown",
  "YW-ERR-1001": "ui_crash",
  "YW-ERR-2001": "api_error",
  "YW-ERR-2002": "network_or_server_failure",
  "YW-ERR-3001": "authentication_issue",
  "YW-ERR-4001": "database_failure",
  "YW-ERR-404": "route_not_found",
  "YW-ERR-5001": "link_missing",
  "YW-ERR-5002": "form_issue",
  "YW-ERR-5003": "payment_flow_issue",
  "YW-ERR-6001": "coach_site_issue",
  "YW-ERR-6002": "video_issue",
  "YW-ERR-7001": "admin_action_issue",
  "YW-ERR-8001": "ai_generation_issue",
  "YW-ERR-9001": "analytics_issue"
};

export default function SupportErrorPage() {
  const [category, setCategory] = useState<PublicWebsiteErrorCategory | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCategory(getCategoryFromSearch(new URLSearchParams(window.location.search)));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!category) {
    return (
      <ContactSupportFallback
        category="unknown"
        logOnMount={false}
        referenceId={createSupportErrorReference("unknown", "support")}
        safeMessage="Support fallback route opened."
        userAction="support_error_route"
      />
    );
  }

  return (
    <ContactSupportFallback
      category={category}
      referenceId={createSupportErrorReference(category, "support")}
      safeMessage="Support fallback route opened."
      userAction="support_error_route"
    />
  );
}

function getCategoryFromSearch(searchParams: URLSearchParams) {
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  if (CODE_TO_CATEGORY[code]) return CODE_TO_CATEGORY[code];

  return normalizePublicErrorCategory(searchParams.get("category") || "unknown");
}
