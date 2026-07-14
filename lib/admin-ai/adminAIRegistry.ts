import type { AdminV2ViewId } from "../admin-v2-access";

export type AdminAIActionType = "dangerous" | "read" | "suggest" | "write";
export type AdminAICommandKind =
  | "external"
  | "find-problems"
  | "navigate"
  | "next-action"
  | "registered-action"
  | "report"
  | "summarize";

export type AdminAICommand = {
  approvalLevel: 0 | 1 | 2 | 3;
  auditLogEnabled: boolean;
  confirmationRequired?: boolean;
  description: string;
  destinationView?: AdminV2ViewId;
  id: string;
  inputSchema: Record<string, "boolean" | "number" | "string" | "string[]">;
  kind: AdminAICommandKind;
  label: string;
  otpRequired?: boolean;
  ownerOnly?: boolean;
  reportTitle?: string;
  requiredPermissions?: string[];
  rollback: "available-after-persist" | "not-applicable" | "not-available";
  sectionId: AdminV2ViewId;
  type: AdminAIActionType;
};

export type AdminAISectionRegistration = {
  commands: AdminAICommand[];
  icon: "chart" | "reports" | "settings" | "users";
  id: AdminV2ViewId;
  name: string;
  relatedAPIs: string[];
};

function command(
  sectionId: AdminV2ViewId,
  input: Omit<
    AdminAICommand,
    "approvalLevel" | "auditLogEnabled" | "inputSchema" | "rollback" | "sectionId"
  > &
    Partial<
      Pick<AdminAICommand, "approvalLevel" | "auditLogEnabled" | "inputSchema" | "rollback">
    >
): AdminAICommand {
  const approvalLevel = input.type === "dangerous" ? 3 : input.type === "write" ? 2 : input.type === "suggest" ? 1 : 0;
  return {
    approvalLevel,
    auditLogEnabled: true,
    inputSchema: {},
    rollback: approvalLevel === 2 ? "available-after-persist" : approvalLevel === 3 ? "not-available" : "not-applicable",
    ...input,
    sectionId,
  };
}

const COMMON = (sectionId: AdminV2ViewId, permission: string, reportTitle: string) => [
  command(sectionId, {
    description: "Summarize only the compact data visible in this section.",
    id: `${sectionId}.summarize`,
    kind: "summarize",
    label: "Summarize this page",
    requiredPermissions: [permission],
    type: "read",
  }),
  command(sectionId, {
    description: "List real warnings, unavailable sources, and missing data.",
    id: `${sectionId}.find-problems`,
    kind: "find-problems",
    label: "Find problems",
    requiredPermissions: [permission],
    type: "read",
  }),
  command(sectionId, {
    description: "Create a source-labelled report that can be copied.",
    id: `${sectionId}.report`,
    kind: "report",
    label: "Generate report",
    reportTitle,
    requiredPermissions: [permission],
    type: "read",
  }),
  command(sectionId, {
    description: "Recommend the next step from current warnings only.",
    id: `${sectionId}.next-action`,
    kind: "next-action",
    label: "Suggest next action",
    requiredPermissions: [permission],
    type: "suggest",
  }),
];

export const adminAIRegistry: Record<AdminV2ViewId, AdminAISectionRegistration> = {
  overview: {
    commands: [
      ...COMMON("overview", "overview.view", "Daily Admin Briefing"),
      command("overview", {
        description: "Use the protected aggregate analytics endpoint when configured.",
        id: "overview.generate-live-insight",
        kind: "external",
        label: "Generate live insight",
        requiredPermissions: ["coach_analytics.ai_insights"],
        type: "read",
      }),
      command("overview", {
        description: "Open the real error-report queue for triage.",
        destinationView: "error-reports",
        id: "overview.open-reports",
        kind: "navigate",
        label: "Open attention queue",
        requiredPermissions: ["error_reports.view"],
        type: "read",
      }),
    ],
    icon: "chart",
    id: "overview",
    name: "Admin Overview",
    relatedAPIs: ["/api/admin/dashboard/overview", "/api/admin/analytics-events", "/api/admin/error-reports"],
  },
  "coach-sites": {
    commands: [
      ...COMMON("coach-sites", "coach_sites.view", "Coach Site Status Report"),
      command("coach-sites", {
        description: "Find active sites without a real registration or contact link.",
        id: "coach-sites.check-links",
        kind: "find-problems",
        label: "Check registration links",
        requiredPermissions: ["coach_sites.view"],
        type: "read",
      }),
      command("coach-sites", {
        confirmationRequired: true,
        description: "Open the protected archive workflow. Existing OTP remains mandatory.",
        destinationView: "coach-sites",
        id: "coach-sites.prepare-archive",
        kind: "navigate",
        label: "Prepare archive review",
        otpRequired: true,
        requiredPermissions: ["coach_sites.archive"],
        type: "dangerous",
      }),
    ],
    icon: "users",
    id: "coach-sites",
    name: "Coach Sites",
    relatedAPIs: ["/api/admin/coach-sites", "/coach/[slug]"],
  },
  "create-coach-site": {
    commands: [
      ...COMMON("create-coach-site", "website_creator.create", "Website Readiness Report"),
      command("create-coach-site", {
        description: "Check required fields, media readiness, preview state, and CTA readiness.",
        id: "create-coach-site.publish-readiness",
        kind: "find-problems",
        label: "Check publish readiness",
        requiredPermissions: ["website_creator.create"],
        type: "read",
      }),
      command("create-coach-site", {
        confirmationRequired: true,
        description: "Prepare the existing protected publish workflow without publishing automatically.",
        destinationView: "create-coach-site",
        id: "create-coach-site.prepare-publish",
        kind: "navigate",
        label: "Prepare publish review",
        requiredPermissions: ["website_creator.publish"],
        type: "dangerous",
      }),
    ],
    icon: "settings",
    id: "create-coach-site",
    name: "Website Creator",
    relatedAPIs: ["/api/admin/coach-sites", "/api/admin/coach-copy", "/coach/[slug]"],
  },
  "coach-analytics": {
    commands: COMMON("coach-analytics", "coach_analytics.view", "Coach Analytics Report"),
    icon: "chart",
    id: "coach-analytics",
    name: "Coach Analytics",
    relatedAPIs: ["/api/admin/analytics-events", "/api/admin/analytics-insights"],
  },
  "top-coaches": {
    commands: COMMON("top-coaches", "coach_analytics.top_performers", "Coach Performance Report"),
    icon: "users",
    id: "top-coaches",
    name: "Coach Performance",
    relatedAPIs: ["/api/admin/analytics-events", "/api/admin/coach-sites"],
  },
  shop: {
    commands: [
      ...COMMON("shop", "shop.view", "Shop Sales Summary"),
      command("shop", {
        description: "Review current failed payment and publish counts and suggest the next recovery screen.",
        id: "shop.recovery-review",
        kind: "find-problems",
        label: "Review failed publish",
        requiredPermissions: ["shop.recovery"],
        type: "read",
      }),
    ],
    icon: "reports",
    id: "shop",
    name: "Shop",
    relatedAPIs: ["/api/admin/shop", "/api/shop/payment", "/shop"],
  },
  "error-reports": {
    commands: [
      ...COMMON("error-reports", "error_reports.view", "Developer-ready Error Summary"),
      command("error-reports", {
        description: "Group currently loaded issues by real severity and category counts.",
        id: "error-reports.triage",
        kind: "find-problems",
        label: "Triage visible errors",
        requiredPermissions: ["error_reports.view"],
        type: "read",
      }),
      command("error-reports", {
        confirmationRequired: true,
        description: "Mark one explicitly selected error report as Reviewing through the existing protected status endpoint.",
        id: "error-reports.mark-reviewing",
        inputSchema: { referenceId: "string" },
        kind: "registered-action",
        label: "Mark selected report Reviewing",
        requiredPermissions: ["error_reports.mark_status"],
        rollback: "available-after-persist",
        type: "write",
      }),
    ],
    icon: "reports",
    id: "error-reports",
    name: "Reports",
    relatedAPIs: ["/api/admin/error-reports"],
  },
  "backup-cleanup": {
    commands: [
      ...COMMON("backup-cleanup", "backup_cleanup.view", "Backup and Cleanup Safety Report"),
      command("backup-cleanup", {
        confirmationRequired: true,
        description: "Open cleanup controls after an explicit safety confirmation. No cleanup runs from Copilot.",
        destinationView: "backup-cleanup",
        id: "backup-cleanup.prepare-cleanup",
        kind: "navigate",
        label: "Prepare cleanup review",
        requiredPermissions: ["backup_cleanup.run_cleanup"],
        type: "dangerous",
      }),
    ],
    icon: "settings",
    id: "backup-cleanup",
    name: "Backup and Cleanup",
    relatedAPIs: ["/api/admin/backup-cleanup"],
  },
  "paid-masterclass-settings": {
    commands: [
      ...COMMON(
        "paid-masterclass-settings",
        "paid_masterclass.view_settings",
        "Payment Configuration Report"
      ),
      command("paid-masterclass-settings", {
        confirmationRequired: true,
        description: "Open protected payment settings. Copilot never reads or writes payment secrets.",
        destinationView: "paid-masterclass-settings",
        id: "paid-masterclass-settings.prepare-change",
        kind: "navigate",
        label: "Prepare settings review",
        requiredPermissions: ["paid_masterclass.edit_settings"],
        type: "dangerous",
      }),
    ],
    icon: "settings",
    id: "paid-masterclass-settings",
    name: "Payments",
    relatedAPIs: ["/api/admin/masterclass-private-link", "/api/admin/masterclass-settings"],
  },
  settings: {
    commands: COMMON("settings", "settings.view", "Admin Configuration Report"),
    icon: "settings",
    id: "settings",
    name: "Settings",
    relatedAPIs: ["/api/admin/support-defaults", "/api/admin/auth/session"],
  },
  "admin-users": {
    commands: [
      ...COMMON("admin-users", "admin_users.manage", "Admin Access and Least-Privilege Report"),
      command("admin-users", {
        confirmationRequired: true,
        description: "Open owner-only role controls. Existing owner-protection rules remain enforced.",
        destinationView: "admin-users",
        id: "admin-users.prepare-role-change",
        kind: "navigate",
        label: "Prepare role review",
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        type: "dangerous",
      }),
    ],
    icon: "users",
    id: "admin-users",
    name: "Admin Users",
    relatedAPIs: ["/api/admin/users", "/api/admin/auth/session"],
  },
};

export const globalAdminAICommands: AdminAICommand[] = [
  command("overview", {
    description: "Search the bounded permission-filtered entity index across allowed modules.",
    id: "global.search",
    kind: "summarize",
    label: "Search the platform",
    requiredPermissions: ["overview.view"],
    type: "read",
  }),
  command("overview", {
    description: "Prioritize real source failures, operational warnings, stale records, and unresolved errors.",
    id: "global.attention",
    kind: "find-problems",
    label: "What needs attention today?",
    requiredPermissions: ["overview.view"],
    type: "read",
  }),
  command("overview", {
    description: "Generate a source-labelled weekly platform health and operations report.",
    id: "global.weekly-report",
    kind: "report",
    label: "Weekly platform report",
    reportTitle: "Weekly Admin Operations Report",
    requiredPermissions: ["overview.view"],
    type: "read",
  }),
  command("overview", {
    description: "Prepare a bounded cross-module investigation without executing mutations.",
    id: "global.investigate",
    kind: "next-action",
    label: "Investigate across modules",
    requiredPermissions: ["overview.view"],
    type: "suggest",
  }),
];

export function getAdminAISection(sectionId: AdminV2ViewId) {
  return adminAIRegistry[sectionId];
}

export function getAdminAICommand(actionId: string) {
  return [...Object.values(adminAIRegistry)
    .flatMap((section) => section.commands)
    , ...globalAdminAICommands]
    .find((item) => item.id === actionId);
}
