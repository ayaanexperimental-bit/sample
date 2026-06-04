import { coaches, funnels } from "./coach-platform";

export type AdminStatusTone = "attention" | "disabled" | "neutral" | "success" | "warning";

export type AdminCoachAnalyticsRecord = {
  averageVisits: string;
  conversionRate: string;
  dailyVisits: number;
  deviceBreakdown: string;
  lastUpdated: string;
  monthlyVisits: number;
  publicUrl: string;
  recentEvents: string[];
  registerClicks: number;
  regionBreakdown: string;
  slug: string;
  sourceBreakdown: string;
  status: "archived" | "draft" | "paused" | "published" | "removed";
  totalVisits: number;
  videoPlays: number;
  weeklyVisits: number;
  whatsappClicks: number;
};

export type AdminMasterclassSettingsStatus = {
  description: string;
  label: string;
  status: string;
  tone: AdminStatusTone;
};

export type AdminPaidMasterclassLink = {
  coachName: string;
  displayName: string;
  entryCode: string;
  entryPath: string;
  funnelId: string;
  paidPagePath: string;
  paymentLastChangedAt: string | null;
  paymentLastChangedBy: string;
  paymentStorageSource: "d1_table" | "none";
  paymentStatus: string;
  privateWhatsappLastChangedAt: string | null;
  privateWhatsappLastChangedBy: string;
  privateWhatsappSecretName: string;
  privateWhatsappStorageSource: "d1_table" | "none";
  privateWhatsappStatus: string;
  status: string;
  successPath: string;
};

export type AdminErrorReportStatus = "Fixed" | "Ignored" | "New" | "Reviewing";

export type AdminErrorReport = {
  browser: string;
  category:
    | "Admin action issue"
    | "AI generation issue"
    | "Analytics issue"
    | "API error"
    | "Authentication issue"
    | "Coach site issue"
    | "Database failure"
    | "Form issue"
    | "Link missing"
    | "Network/server issue"
    | "Payment flow issue"
    | "Route not found"
    | "UI crash"
    | "Unknown"
    | "Video issue";
  adminNotes?: string;
  coachSlug?: string;
  createdAt: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  errorCode?: string;
  funnelStep?: string;
  missingSupportFields?: string;
  pagePath: string;
  referenceId: string;
  referrer: string;
  safeMessage: string;
  screenSize: string;
  sessionId: string;
  severity: "high" | "low" | "medium";
  status: AdminErrorReportStatus;
  supportSource?: "coach" | "default";
  technicalDetails?: string;
  updatedAt?: string;
  userAction: string;
};

export type AdminBackupCleanupStatus = {
  backupDestination: "CSV/JSON download" | "Google Sheets" | "Not configured";
  cleanupStatus: string;
  googleSheetsConfigured: boolean;
  lastBackupAt: string;
  lastCleanupAt: string;
  retentionDays: number;
  scheduledCleanup: string;
};

export type AdminEventTrackingPlan = {
  eventNames: string[];
  fields: string[];
  storageStatus: string;
};

export type AdminSecurityStatusItem = {
  label: string;
  status: string;
  tone: AdminStatusTone;
};

export type AdminDataModelPlan = {
  name: string;
  purpose: string;
  status: string;
};

export type AdminControlCenterData = {
  backupCleanup: AdminBackupCleanupStatus;
  coachAnalytics: AdminCoachAnalyticsRecord[];
  dataModels: AdminDataModelPlan[];
  errorReports: AdminErrorReport[];
  eventTracking: AdminEventTrackingPlan;
  masterclassSettings: AdminMasterclassSettingsStatus[];
  paidMasterclassLinks: AdminPaidMasterclassLink[];
  security: AdminSecurityStatusItem[];
};

export const adminControlCenterData: AdminControlCenterData = {
  coachAnalytics: [],
  masterclassSettings: [
    {
      description: "Public Razorpay payment destination is used only through the server redirect.",
      label: "Payment link",
      status: "Server-managed",
      tone: "success"
    },
    {
      description:
        "Success video remains configured in code until a database settings table is approved.",
      label: "Success video",
      status: "Current page config",
      tone: "neutral"
    },
    {
      description: "Paid WhatsApp group URLs are stored server-side in D1 only.",
      label: "Paid WhatsApp private link",
      status: "D1 server table",
      tone: "success"
    },
    {
      description:
        "Future paid Zoom/session/private resource links should be encrypted or server-only.",
      label: "Paid-only resources",
      status: "Planned secure storage",
      tone: "attention"
    }
  ],
  paidMasterclassLinks: getPaidMasterclassLinks(),
  errorReports: [],
  backupCleanup: {
    backupDestination: "Not configured",
    cleanupStatus: "Disabled until backup storage is configured",
    googleSheetsConfigured: false,
    lastBackupAt: "No backup created yet",
    lastCleanupAt: "No cleanup run yet",
    retentionDays: 90,
    scheduledCleanup: "Manual only until cron/storage approval"
  },
  eventTracking: {
    eventNames: [
      "page_view",
      "cta_click",
      "register_click",
      "payment_click",
      "payment_initiated",
      "payment_success",
      "success_page_view",
      "whatsapp_join_click",
      "coach_site_view",
      "coach_register_click",
      "coach_whatsapp_click",
      "coach_video_play",
      "referral_page_view",
      "referral_lead_submit",
      "coach_site_created",
      "coach_site_updated",
      "coach_site_published",
      "coach_site_unpublished",
      "coach_site_paused",
      "coach_site_resumed",
      "coach_site_remove_requested",
      "coach_site_removed",
      "error_report_created"
    ],
    fields: [
      "event name",
      "timestamp",
      "page path",
      "coach slug",
      "referral slug",
      "session id",
      "visitor id",
      "device type",
      "safe approximate region",
      "source/referrer",
      "UTM params",
      "safe metadata"
    ],
    storageStatus:
      "D1 analytics_events storage is active for public coach and paid funnel event counters."
  },
  dataModels: [
    {
      name: "coaches",
      purpose: "Coach public profile fields and contact details.",
      status: "Typed service layer only"
    },
    {
      name: "coach_sites",
      purpose: "Stable slug, public URL, status, Google Form URL, video, and published content.",
      status: "Typed service layer only"
    },
    {
      name: "analytics_events",
      purpose: "Coach and paid funnel event stream for dashboard reporting.",
      status: "D1 table configured"
    },
    {
      name: "error_reports",
      purpose: "Safe user-facing reference IDs with admin-only technical review fields.",
      status: "D1 table configured"
    },
    {
      name: "analytics_backups",
      purpose: "Backup metadata before 90-day raw analytics cleanup.",
      status: "Planned after storage approval"
    },
    {
      name: "cleanup_logs",
      purpose: "Audit trail for backup and cleanup runs.",
      status: "Planned after storage approval"
    }
  ],
  security: [
    {
      label: "Admin session cookies",
      status: "httpOnly, SameSite, Secure in production",
      tone: "success"
    },
    {
      label: "Admin write CSRF",
      status: "Required on new protected write APIs",
      tone: "success"
    },
    {
      label: "Strict DB admin roles",
      status: "Do not enable until real admin row is verified",
      tone: "warning"
    },
    {
      label: "AI API key",
      status: "Server-side env only",
      tone: "success"
    },
    {
      label: "Paid WhatsApp/Zoom/private resources",
      status: "Server-side only",
      tone: "success"
    },
    {
      label: "OTP-protected permanent removal",
      status: "Permanent removal disabled until OTP provider is configured",
      tone: "attention"
    }
  ]
};

function getPaidMasterclassLinks(): AdminPaidMasterclassLink[] {
  return funnels
    .filter((funnel) => funnel.type === "paidProgram")
    .map((funnel) => {
      const coach = coaches.find((item) => item.id === funnel.coachId);

      return {
        coachName: coach?.displayName || funnel.coachId,
        displayName: funnel.displayName,
        entryCode: funnel.entryCode,
        entryPath: `/go/${funnel.entryCode}`,
        funnelId: funnel.id,
        paidPagePath: funnel.canonicalPath,
        paymentLastChangedAt: null,
        paymentLastChangedBy: "Not recorded yet",
        paymentStorageSource: "none",
        paymentStatus: "Server redirect configured",
        privateWhatsappSecretName: "private_funnel_links",
        privateWhatsappLastChangedAt: null,
        privateWhatsappLastChangedBy: "Not recorded yet",
        privateWhatsappStorageSource: "none",
        privateWhatsappStatus: "D1 server table",
        status: funnel.status,
        successPath: funnel.successPath || "Not configured"
      };
    });
}

export function createErrorReportBugPrompt(report: AdminErrorReport) {
  return [
    "Fix this bug based on the logged error report.",
    `Public error code: ${report.errorCode || "not recorded"}.`,
    `Error ID: ${report.referenceId}.`,
    `Page: ${report.pagePath}.`,
    `User action: ${report.userAction}.`,
    `Actual error: ${report.safeMessage}.`,
    `Support shown: ${report.supportSource || "default"}.`,
    report.coachSlug ? `Coach slug: ${report.coachSlug}.` : "",
    report.missingSupportFields ? `Missing support fields: ${report.missingSupportFields}.` : "",
    "Expected behavior: User should see a clean fallback and the underlying issue should be fixed.",
    "Prevent this failure where possible with validation, safe defaults, retries, or graceful inline fallback.",
    "Preserve routing, APIs, payment, forms, admin, and responsiveness.",
    "Run lint/type-check/build after fix."
  ]
    .filter(Boolean)
    .join(" ");
}

export function getMasterclassSettingsWithEnvStatus() {
  return adminControlCenterData.masterclassSettings.map((item) => {
    if (item.label !== "Paid WhatsApp private link") return item;

    return {
      ...item,
      status: "D1 server table only",
      tone: "success" as const
    };
  });
}
