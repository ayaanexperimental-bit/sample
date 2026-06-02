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
  entryPath: string;
  paidPagePath: string;
  paymentStatus: string;
  privateWhatsappSecretName: string;
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
    | "Form issue"
    | "Link missing"
    | "Payment flow issue"
    | "UI crash"
    | "Unknown"
    | "Video issue";
  coachSlug?: string;
  createdAt: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  funnelStep?: string;
  pagePath: string;
  referenceId: string;
  referrer: string;
  safeMessage: string;
  screenSize: string;
  sessionId: string;
  severity: "high" | "low" | "medium";
  status: AdminErrorReportStatus;
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
  coachAnalytics: [
    {
      averageVisits: "602/day",
      conversionRate: "17.5%",
      dailyVisits: 186,
      deviceBreakdown: "Mobile 81%, Desktop 14%, Tablet 5%",
      lastUpdated: "Demo snapshot",
      monthlyVisits: 4210,
      publicUrl: "/coach/gyana-ranjan",
      recentEvents: [
        "coach_site_view",
        "coach_register_click",
        "coach_whatsapp_click",
        "coach_video_play"
      ],
      registerClicks: 738,
      regionBreakdown: "Bhubaneswar, Cuttack, Kolkata",
      slug: "gyana-ranjan",
      sourceBreakdown: "Instagram, WhatsApp, direct",
      status: "published",
      totalVisits: 4210,
      videoPlays: 318,
      weeklyVisits: 1284,
      whatsappClicks: 246
    },
    {
      averageVisits: "0/day",
      conversionRate: "0%",
      dailyVisits: 0,
      deviceBreakdown: "No recent activity",
      lastUpdated: "Demo snapshot",
      monthlyVisits: 0,
      publicUrl: "/coach/sample-coach-a",
      recentEvents: ["coach_site_paused"],
      registerClicks: 0,
      regionBreakdown: "No recent activity",
      slug: "sample-coach-a",
      sourceBreakdown: "No recent activity",
      status: "paused",
      totalVisits: 0,
      videoPlays: 0,
      weeklyVisits: 0,
      whatsappClicks: 0
    }
  ],
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
      description:
        "Paid WhatsApp group URL must stay server-side and must never be exposed in frontend code.",
      label: "Paid WhatsApp private link",
      status: "Server-side secret only",
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
  errorReports: [
    {
      browser: "Chrome",
      category: "Link missing",
      coachSlug: "sample-coach-a",
      createdAt: "Demo snapshot",
      deviceType: "mobile",
      funnelStep: "coach_register_click",
      pagePath: "/coach/sample-coach-a",
      referenceId: "ERR-20260601-SMPL",
      referrer: "direct",
      safeMessage: "Google Form link missing. Contact Support fallback shown.",
      screenSize: "390x844",
      sessionId: "demo-session",
      severity: "high",
      status: "Reviewing",
      userAction: "Tapped Register Now"
    },
    {
      browser: "Safari",
      category: "Payment flow issue",
      createdAt: "Demo snapshot",
      deviceType: "mobile",
      funnelStep: "payment_redirect",
      pagePath: "/gyana/pcos-51",
      referenceId: "ERR-20260601-PAY1",
      referrer: "instagram",
      safeMessage: "Payment redirect failed once, no sensitive details exposed.",
      screenSize: "414x896",
      sessionId: "demo-session",
      severity: "medium",
      status: "New",
      userAction: "Tapped payment CTA"
    },
    {
      browser: "Chrome",
      category: "AI generation issue",
      createdAt: "Demo snapshot",
      deviceType: "desktop",
      pagePath: "/admin/dashboard",
      referenceId: "ERR-20260601-AI01",
      referrer: "admin",
      safeMessage: "AI generation not configured yet.",
      screenSize: "1280x900",
      sessionId: "admin-demo",
      severity: "low",
      status: "Fixed",
      userAction: "Clicked Generate with AI"
    }
  ],
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
      "Event API scaffold exists. Real analytics storage waits for database/table approval."
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
      status: "API scaffold only"
    },
    {
      name: "error_reports",
      purpose: "Safe user-facing reference IDs with admin-only technical review fields.",
      status: "API scaffold only"
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
        entryPath: `/go/${funnel.entryCode}`,
        paidPagePath: funnel.canonicalPath,
        paymentStatus: funnel.paymentUrl ? "Configured" : "Missing",
        privateWhatsappSecretName:
          funnel.id === "gyana-pcos-51"
            ? "WHATSAPP_GROUP_URL_GYANA_PCOS_51"
            : `WHATSAPP_GROUP_URL_${funnel.id.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`,
        privateWhatsappStatus: "Server-side only",
        status: funnel.status,
        successPath: funnel.successPath || "Not configured"
      };
    });
}

export function createErrorReportBugPrompt(report: AdminErrorReport) {
  return [
    "Fix this bug based on the logged error report.",
    `Error ID: ${report.referenceId}.`,
    `Page: ${report.pagePath}.`,
    `User action: ${report.userAction}.`,
    `Actual error: ${report.safeMessage}.`,
    "Expected behavior: User should see a clean fallback and the underlying issue should be fixed.",
    "Preserve routing, APIs, payment, forms, admin, and responsiveness.",
    "Run lint/type-check/build after fix."
  ].join(" ");
}

export function getMasterclassSettingsWithEnvStatus(env: Record<string, string | undefined>) {
  return adminControlCenterData.masterclassSettings.map((item) => {
    if (item.label !== "Paid WhatsApp private link") return item;

    const configured = Boolean(
      env.WHATSAPP_GROUP_URL_GYANA_PCOS_51?.trim() || env.YW_PRIVATE_FUNNEL_LINKS_JSON?.trim()
    );

    return {
      ...item,
      status: configured ? "Configured server-side" : item.status,
      tone: configured ? ("success" as const) : item.tone
    };
  });
}
