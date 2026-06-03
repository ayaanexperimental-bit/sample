export type WebsiteErrorCategory =
  | "admin_action_issue"
  | "ai_generation_issue"
  | "analytics_issue"
  | "api_error"
  | "authentication_issue"
  | "coach_site_issue"
  | "database_failure"
  | "form_issue"
  | "link_missing"
  | "network_or_server_failure"
  | "payment_flow_issue"
  | "route_not_found"
  | "ui_crash"
  | "unknown"
  | "video_issue";

export type WebsiteErrorCode =
  | "YW-ERR-0001"
  | "YW-ERR-1001"
  | "YW-ERR-2001"
  | "YW-ERR-2002"
  | "YW-ERR-3001"
  | "YW-ERR-4001"
  | "YW-ERR-5001"
  | "YW-ERR-5002"
  | "YW-ERR-5003"
  | "YW-ERR-6001"
  | "YW-ERR-6002"
  | "YW-ERR-7001"
  | "YW-ERR-8001"
  | "YW-ERR-9001"
  | "YW-ERR-404";

export type WebsiteErrorDefinition = {
  category: WebsiteErrorCategory;
  code: WebsiteErrorCode;
  label: string;
  publicMessage: string;
  severity: "high" | "low" | "medium";
};

export const WEBSITE_ERROR_DEFINITIONS: Record<WebsiteErrorCategory, WebsiteErrorDefinition> = {
  admin_action_issue: {
    category: "admin_action_issue",
    code: "YW-ERR-7001",
    label: "Admin action issue",
    publicMessage: "We could not complete this admin action.",
    severity: "medium"
  },
  ai_generation_issue: {
    category: "ai_generation_issue",
    code: "YW-ERR-8001",
    label: "AI generation issue",
    publicMessage: "We could not generate the content right now.",
    severity: "low"
  },
  analytics_issue: {
    category: "analytics_issue",
    code: "YW-ERR-9001",
    label: "Analytics issue",
    publicMessage: "Tracking did not complete, but the page remains usable.",
    severity: "low"
  },
  api_error: {
    category: "api_error",
    code: "YW-ERR-2001",
    label: "API error",
    publicMessage: "We could not complete this step.",
    severity: "medium"
  },
  authentication_issue: {
    category: "authentication_issue",
    code: "YW-ERR-3001",
    label: "Authentication issue",
    publicMessage: "We could not verify this session.",
    severity: "medium"
  },
  coach_site_issue: {
    category: "coach_site_issue",
    code: "YW-ERR-6001",
    label: "Coach site issue",
    publicMessage: "This coach page could not load properly.",
    severity: "high"
  },
  database_failure: {
    category: "database_failure",
    code: "YW-ERR-4001",
    label: "Database failure",
    publicMessage: "We could not load the saved data right now.",
    severity: "high"
  },
  form_issue: {
    category: "form_issue",
    code: "YW-ERR-5002",
    label: "Form issue",
    publicMessage: "We could not open the form right now.",
    severity: "high"
  },
  link_missing: {
    category: "link_missing",
    code: "YW-ERR-5001",
    label: "Link missing",
    publicMessage: "The required link is not configured yet.",
    severity: "high"
  },
  network_or_server_failure: {
    category: "network_or_server_failure",
    code: "YW-ERR-2002",
    label: "Network/server issue",
    publicMessage: "The server could not complete this request.",
    severity: "medium"
  },
  payment_flow_issue: {
    category: "payment_flow_issue",
    code: "YW-ERR-5003",
    label: "Payment flow issue",
    publicMessage: "We could not complete the payment step.",
    severity: "high"
  },
  route_not_found: {
    category: "route_not_found",
    code: "YW-ERR-404",
    label: "Route not found",
    publicMessage: "The page you opened is not available.",
    severity: "low"
  },
  ui_crash: {
    category: "ui_crash",
    code: "YW-ERR-1001",
    label: "UI crash",
    publicMessage: "This page could not load properly.",
    severity: "high"
  },
  unknown: {
    category: "unknown",
    code: "YW-ERR-0001",
    label: "Unknown issue",
    publicMessage: "We could not complete this step.",
    severity: "medium"
  },
  video_issue: {
    category: "video_issue",
    code: "YW-ERR-6002",
    label: "Video issue",
    publicMessage: "The video could not load right now.",
    severity: "low"
  }
};

export function getSupportErrorDefinition(category: WebsiteErrorCategory | string) {
  return WEBSITE_ERROR_DEFINITIONS[normalizeWebsiteErrorCategory(category)];
}

export function getSupportErrorCode(category: WebsiteErrorCategory | string) {
  return getSupportErrorDefinition(category).code;
}

export function createErrorReference(category: WebsiteErrorCategory | string, seed = "") {
  const code = getSupportErrorCode(category);
  const safeSeed = seed.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
      : Math.random().toString(36).slice(2, 8).toUpperCase();

  return safeSeed ? `${code}-${safeSeed}-${randomPart}` : `${code}-${randomPart}`;
}

export function normalizeWebsiteErrorCategory(category: WebsiteErrorCategory | string) {
  return category in WEBSITE_ERROR_DEFINITIONS ? (category as WebsiteErrorCategory) : "unknown";
}
