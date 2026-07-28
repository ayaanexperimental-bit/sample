import type { AdminV2AccessProfileClient, AdminV2ViewId } from "../admin-v2-access";

export type AdminAIActionType = "dangerous" | "read" | "suggest" | "write";
export type AdminAIReportFormat = "operations" | "summary";
export type AdminAIRegisteredActionHandlerId =
  | "error-report-status-reviewing"
  | "settings-proactive-suggestions-update"
  | "shop-paid-order-publish-retry";
export type AdminAIExecutionAvailability = "executable" | "not-applicable" | "review-only";
export type AdminAIIssueClassification =
  | "analysis"
  | "error-report-status"
  | "protected-workflow"
  | "recommendation";
export type AdminAIExecutionContract = {
  availability: AdminAIExecutionAvailability;
  blockedReason: string | null;
  currentStateLabel: string;
  dependencies: string[];
  issueClassification: AdminAIIssueClassification;
  maxBatchSize: number;
  maxSelectedRecords: number;
  minSelectedRecords: number;
  proposedStateLabel: string;
};
export type AdminAICommandKind =
  | "external"
  | "find-problems"
  | "navigate"
  | "next-action"
  | "registered-action"
  | "report"
  | "summarize";
export type AdminAIResponseHandlerId = AdminAICommandKind;

export type AdminAICommand = {
  approvalLevel: 0 | 1 | 2 | 3;
  auditLogEnabled: boolean;
  confirmationRequired?: boolean;
  description: string;
  destinationView?: AdminV2ViewId;
  executionContract: AdminAIExecutionContract;
  failureMessage: string;
  handlerId?: AdminAIRegisteredActionHandlerId;
  id: string;
  inputSchema: Record<string, "boolean" | "number" | "string" | "string[]">;
  kind: AdminAICommandKind;
  label: string;
  otpRequired?: boolean;
  ownerOnly?: boolean;
  reportTitle?: string;
  responseHandlerId: AdminAIResponseHandlerId;
  requiredPermissions?: string[];
  rollback: "available-after-persist" | "not-applicable" | "not-available";
  sectionId: AdminV2ViewId;
  successMessage: string;
  type: AdminAIActionType;
};

export type AdminAIRegisteredActionContract = {
  actionId: string;
  executionContract: AdminAIExecutionContract;
  failureMessage: string;
  handlerId: AdminAIRegisteredActionHandlerId;
  inputSchema: Record<string, "boolean" | "number" | "string" | "string[]">;
  requiredPermissions: string[];
  sectionId: AdminV2ViewId;
  successMessage: string;
};

export const ADMIN_AI_REGISTERED_ACTION_CONTRACTS: Record<
  AdminAIRegisteredActionHandlerId,
  AdminAIRegisteredActionContract
> = {
  "error-report-status-reviewing": {
    actionId: "error-reports.mark-reviewing",
    executionContract: {
      availability: "executable",
      blockedReason: null,
      currentStateLabel: "Error report status",
      dependencies: [
        "Authenticated admin session and CSRF validation",
        "Permission: error_reports.mark_status",
        "Durable ADMIN_DB action receipt",
        "Atomic admin audit persistence"
      ],
      issueClassification: "error-report-status",
      maxBatchSize: 1,
      maxSelectedRecords: 1,
      minSelectedRecords: 1,
      proposedStateLabel: "Error report status: Reviewing"
    },
    failureMessage: "Report status update failed",
    handlerId: "error-report-status-reviewing",
    inputSchema: { referenceId: "string" },
    requiredPermissions: ["error_reports.mark_status"],
    sectionId: "error-reports",
    successMessage: "Report marked Reviewing"
  },
  "settings-proactive-suggestions-update": {
    actionId: "settings.update-proactive-suggestions",
    executionContract: {
      availability: "executable",
      blockedReason: null,
      currentStateLabel: "Current proactive suggestions preference",
      dependencies: [
        "Authenticated admin session and CSRF validation",
        "Permission: settings.support",
        "Durable ADMIN_DB action receipt",
        "Atomic admin audit persistence"
      ],
      issueClassification: "recommendation",
      maxBatchSize: 1,
      maxSelectedRecords: 0,
      minSelectedRecords: 0,
      proposedStateLabel: "Approved proactive suggestions preference"
    },
    failureMessage: "Proactive suggestions update failed",
    handlerId: "settings-proactive-suggestions-update",
    inputSchema: {
      currentValue: "boolean",
      proposedValue: "boolean",
      settingKey: "string"
    },
    requiredPermissions: ["settings.support"],
    sectionId: "settings",
    successMessage: "Proactive suggestions preference updated"
  },
  "shop-paid-order-publish-retry": {
    actionId: "shop.retry-publish",
    executionContract: {
      availability: "executable",
      blockedReason: null,
      currentStateLabel: "Paid Shop order awaiting publish retry",
      dependencies: [
        "Authenticated admin session and CSRF validation",
        "Permission: shop.recovery",
        "Durable ADMIN_DB action receipt",
        "Verified existing Shop publish path"
      ],
      issueClassification: "protected-workflow",
      maxBatchSize: 1,
      maxSelectedRecords: 1,
      minSelectedRecords: 1,
      proposedStateLabel: "Verified published Shop order"
    },
    failureMessage: "Paid-order publish retry failed",
    handlerId: "shop-paid-order-publish-retry",
    inputSchema: { orderId: "string" },
    requiredPermissions: ["shop.recovery"],
    sectionId: "shop",
    successMessage: "Paid Shop order published"
  }
};

export type AdminAISectionRegistration = {
  commands: AdminAICommand[];
  contextBuilder: AdminV2ViewId;
  icon: "chart" | "reports" | "settings" | "users";
  id: AdminV2ViewId;
  name: string;
  relatedAPIs: string[];
  reportFormats: AdminAIReportFormat[];
};

export type AdminAIRolePersonalization = {
  focus: string;
  id: "analytics" | "custom" | "owner" | "shop" | "support" | "website_creator";
  label: string;
  preferredCommandIds: string[];
  preferredKinds: AdminAICommandKind[];
  promptPlaceholder: string;
};

export const ADMIN_AI_SECTION_ALIASES = {
  analytics: "coach-analytics",
  "coach analytics": "coach-analytics",
  payments: "paid-masterclass-settings",
  reports: "error-reports",
  revenue: "paid-masterclass-settings",
  "support defaults": "settings"
} as const satisfies Record<string, AdminV2ViewId>;

export function getMinimumAdminAIApprovalLevel(type: AdminAIActionType): 0 | 1 | 2 | 3 {
  return type === "dangerous" ? 3 : type === "write" ? 2 : 0;
}

function command(
  sectionId: AdminV2ViewId,
  input: Omit<
    AdminAICommand,
    | "approvalLevel"
    | "auditLogEnabled"
    | "executionContract"
    | "failureMessage"
    | "inputSchema"
    | "responseHandlerId"
    | "rollback"
    | "sectionId"
    | "successMessage"
  > &
    Partial<
      Pick<
        AdminAICommand,
        | "approvalLevel"
        | "auditLogEnabled"
        | "failureMessage"
        | "inputSchema"
        | "rollback"
        | "successMessage"
      >
    > & { executionContract?: Partial<AdminAIExecutionContract> }
): AdminAICommand {
  const minimumApprovalLevel = getMinimumAdminAIApprovalLevel(input.type);
  const approvalLevel = Math.max(
    minimumApprovalLevel,
    input.approvalLevel ?? minimumApprovalLevel
  ) as 0 | 1 | 2 | 3;
  const executionContract = {
    ...buildDefaultExecutionContract(input),
    ...input.executionContract
  };
  return {
    auditLogEnabled: true,
    inputSchema: {},
    ...input,
    approvalLevel,
    executionContract,
    failureMessage: input.failureMessage || `${input.label} failed`,
    responseHandlerId: input.kind,
    rollback: input.rollback ?? (approvalLevel === 3 ? "not-available" : "not-applicable"),
    sectionId,
    successMessage: input.successMessage || `${input.label} completed`
  };
}

function buildDefaultExecutionContract(input: {
  destinationView?: AdminV2ViewId;
  kind: AdminAICommandKind;
  requiredPermissions?: string[];
  type: AdminAIActionType;
}): AdminAIExecutionContract {
  const availability: AdminAIExecutionAvailability =
    input.kind === "registered-action"
      ? "executable"
      : input.type === "dangerous"
        ? "review-only"
        : "not-applicable";
  const dependencies = [
    "Authenticated admin session",
    ...(input.requiredPermissions || []).map((permission) => `Permission: ${permission}`),
    ...(input.destinationView ? [`Protected ${input.destinationView} workflow`] : [])
  ];

  return {
    availability,
    blockedReason:
      availability === "review-only"
        ? "Direct Copilot execution is disabled; continue in the existing protected workflow."
        : availability === "not-applicable"
          ? "No server mutation is registered because this command is read-only or advisory."
          : null,
    currentStateLabel:
      input.type === "dangerous"
        ? "Current protected workflow state"
        : "Current permission-filtered state",
    dependencies,
    issueClassification:
      input.type === "dangerous"
        ? "protected-workflow"
        : input.type === "suggest"
          ? "recommendation"
          : "analysis",
    maxBatchSize: availability === "executable" ? 1 : 0,
    maxSelectedRecords: availability === "executable" ? 1 : 12,
    minSelectedRecords: availability === "executable" ? 1 : 0,
    proposedStateLabel:
      input.type === "dangerous"
        ? "No state change in Copilot"
        : input.type === "suggest"
          ? "Reviewable recommendation only"
          : "No mutation proposed"
  };
}

const COMMON = (sectionId: AdminV2ViewId, permission: string, reportTitle: string) => [
  command(sectionId, {
    description: "Summarize only the compact data visible in this section.",
    id: `${sectionId}.summarize`,
    kind: "summarize",
    label: "Summarize this page",
    requiredPermissions: [permission],
    type: "read"
  }),
  command(sectionId, {
    description: "Explain the current permission-visible data and its source without widening scope.",
    id: `${sectionId}.explain-data`,
    kind: "summarize",
    label: "Explain this data",
    requiredPermissions: [permission],
    type: "read"
  }),
  command(sectionId, {
    description: "List real warnings, unavailable sources, and missing data.",
    id: `${sectionId}.find-problems`,
    kind: "find-problems",
    label: "Find problems",
    requiredPermissions: [permission],
    type: "read"
  }),
  command(sectionId, {
    description: "Preview a source-labelled report without creating an applyable proposal.",
    id: `${sectionId}.preview-report`,
    kind: "report",
    label: "Preview report",
    reportTitle,
    requiredPermissions: [permission],
    type: "read"
  }),
  command(sectionId, {
    approvalLevel: 1,
    description: "Create a source-labelled report that can be copied.",
    id: `${sectionId}.report`,
    kind: "report",
    label: "Generate report",
    reportTitle,
    requiredPermissions: [permission],
    type: "suggest"
  }),
  command(sectionId, {
    description: "Recommend the next step from current warnings only.",
    id: `${sectionId}.next-action`,
    kind: "next-action",
    label: "Suggest next action",
    requiredPermissions: [permission],
    type: "suggest"
  }),
  command(sectionId, {
    description: "Validate the current permission-visible section data without saving changes.",
    id: `${sectionId}.safe-validation`,
    kind: "find-problems",
    label: "Run safe validation",
    requiredPermissions: [permission],
    type: "read"
  })
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
        type: "read"
      }),
      command("overview", {
        description: "Open the real error-report queue for triage.",
        destinationView: "error-reports",
        id: "overview.open-reports",
        kind: "navigate",
        label: "Open attention queue",
        requiredPermissions: ["error_reports.view"],
        type: "read"
      })
    ],
    contextBuilder: "overview",
    icon: "chart",
    id: "overview",
    name: "Admin Overview",
    relatedAPIs: [
      "/api/admin/dashboard/overview",
      "/api/admin/analytics-events",
      "/api/admin/error-reports"
    ],
    reportFormats: ["operations", "summary"]
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
        type: "read"
      }),
      command("coach-sites", {
        description:
          "Triage coach and site support needs from visible records without exposing restricted fields.",
        id: "coach-sites.support-review",
        kind: "find-problems",
        label: "Review coach and site support",
        requiredPermissions: ["coach_sites.view"],
        type: "read"
      }),
      command("coach-sites", {
        approvalLevel: 1,
        description:
          "Prepare a bounded plan for the explicitly selected rows without changing any record.",
        destinationView: "coach-sites",
        executionContract: {
          currentStateLabel: "Selected coach-site rows",
          maxSelectedRecords: 12,
          minSelectedRecords: 1,
          proposedStateLabel: "Prepared bulk-action plan only"
        },
        id: "coach-sites.prepare-bulk-action",
        inputSchema: { selectedIds: "string[]" },
        kind: "next-action",
        label: "Prepare selected-row action",
        requiredPermissions: ["coach_sites.edit"],
        type: "suggest"
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
        type: "dangerous"
      })
    ],
    contextBuilder: "coach-sites",
    icon: "users",
    id: "coach-sites",
    name: "Coach Sites",
    relatedAPIs: ["/api/admin/coach-sites", "/coach/[slug]"],
    reportFormats: ["operations", "summary"]
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
        type: "read"
      }),
      command("create-coach-site", {
        description:
          "Preview the current permission-visible unsaved Builder text without creating an applyable proposal.",
        id: "create-coach-site.preview-draft-text",
        kind: "summarize",
        label: "Preview draft text",
        requiredPermissions: ["website_creator.create"],
        type: "read"
      }),
      command("create-coach-site", {
        approvalLevel: 1,
        confirmationRequired: true,
        description:
          "Prepare a field-by-field site creation plan in the existing form without changing it.",
        destinationView: "create-coach-site",
        id: "create-coach-site.prepare-create",
        kind: "next-action",
        label: "Prepare site creation",
        requiredPermissions: ["website_creator.create"],
        type: "suggest"
      }),
      command("create-coach-site", {
        description: "Open the existing draft preview without publishing or changing the site.",
        destinationView: "create-coach-site",
        id: "create-coach-site.open-preview",
        kind: "navigate",
        label: "Open site preview",
        requiredPermissions: ["website_creator.create"],
        type: "read"
      }),
      command("create-coach-site", {
        confirmationRequired: true,
        description:
          "Prepare the existing protected publish workflow without publishing automatically.",
        destinationView: "create-coach-site",
        id: "create-coach-site.prepare-publish",
        kind: "navigate",
        label: "Prepare publish review",
        requiredPermissions: ["website_creator.publish"],
        type: "dangerous"
      })
    ],
    contextBuilder: "create-coach-site",
    icon: "settings",
    id: "create-coach-site",
    name: "Website Creator",
    relatedAPIs: ["/api/admin/coach-sites", "/api/admin/coach-copy", "/coach/[slug]"],
    reportFormats: ["operations", "summary"]
  },
  "coach-analytics": {
    commands: [
      ...COMMON("coach-analytics", "coach_analytics.view", "Coach Analytics Report"),
      command("coach-analytics", {
        description:
          "Review only the selected coach analytics record and explain its permission-visible status.",
        executionContract: { maxSelectedRecords: 1, minSelectedRecords: 1 },
        id: "coach-analytics.review-selected-coach",
        kind: "summarize",
        label: "Review selected coach",
        requiredPermissions: ["coach_analytics.view"],
        type: "read"
      }),
      command("coach-analytics", {
        approvalLevel: 1,
        description: "Create a source-labelled copyable report for only the selected coach.",
        executionContract: { maxSelectedRecords: 1, minSelectedRecords: 1 },
        id: "coach-analytics.copyable-coach-report",
        kind: "report",
        label: "Create copyable coach report",
        reportTitle: "Coach Analytics Report",
        requiredPermissions: ["coach_analytics.view"],
        type: "suggest"
      })
    ],
    contextBuilder: "coach-analytics",
    icon: "chart",
    id: "coach-analytics",
    name: "Coach Analytics",
    relatedAPIs: ["/api/admin/analytics-events", "/api/admin/analytics-insights"],
    reportFormats: ["operations", "summary"]
  },
  "top-coaches": {
    commands: COMMON("top-coaches", "coach_analytics.top_performers", "Coach Performance Report"),
    contextBuilder: "top-coaches",
    icon: "users",
    id: "top-coaches",
    name: "Coach Performance",
    relatedAPIs: ["/api/admin/analytics-events", "/api/admin/coach-sites"],
    reportFormats: ["operations", "summary"]
  },
  shop: {
    commands: [
      ...COMMON("shop", "shop.view", "Shop Sales Summary"),
      command("shop", {
        description:
          "Review current failed payment and publish counts and suggest the next recovery screen.",
        id: "shop.recovery-review",
        kind: "find-problems",
        label: "Review failed publish",
        requiredPermissions: ["shop.recovery"],
        type: "read"
      }),
      command("shop", {
        description:
          "Triage visible failed orders against their payment and publish state without retrying them.",
        id: "shop.failed-order-triage",
        kind: "find-problems",
        label: "Triage failed orders",
        requiredPermissions: ["shop.recovery"],
        type: "read"
      }),
      command("shop", {
        confirmationRequired: true,
        description:
          "Retry one permission-visible paid Shop order through the existing protected publish path.",
        executionContract:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["shop-paid-order-publish-retry"].executionContract,
        failureMessage:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["shop-paid-order-publish-retry"].failureMessage,
        handlerId: ADMIN_AI_REGISTERED_ACTION_CONTRACTS["shop-paid-order-publish-retry"].handlerId,
        id: ADMIN_AI_REGISTERED_ACTION_CONTRACTS["shop-paid-order-publish-retry"].actionId,
        inputSchema:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["shop-paid-order-publish-retry"].inputSchema,
        kind: "registered-action",
        label: "Retry paid-order publish",
        requiredPermissions:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["shop-paid-order-publish-retry"].requiredPermissions,
        rollback: "not-available",
        successMessage:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["shop-paid-order-publish-retry"].successMessage,
        type: "write"
      })
    ],
    contextBuilder: "shop",
    icon: "reports",
    id: "shop",
    name: "Shop",
    relatedAPIs: ["/api/admin/shop", "/api/shop/payment", "/shop"],
    reportFormats: ["operations", "summary"]
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
        type: "read"
      }),
      command("error-reports", {
        confirmationRequired: true,
        description:
          "Mark one explicitly selected error report as Reviewing through the existing protected status endpoint.",
        executionContract:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["error-report-status-reviewing"].executionContract,
        failureMessage:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["error-report-status-reviewing"].failureMessage,
        handlerId: ADMIN_AI_REGISTERED_ACTION_CONTRACTS["error-report-status-reviewing"].handlerId,
        id: ADMIN_AI_REGISTERED_ACTION_CONTRACTS["error-report-status-reviewing"].actionId,
        inputSchema:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["error-report-status-reviewing"].inputSchema,
        kind: "registered-action",
        label: "Mark selected report Reviewing",
        requiredPermissions:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["error-report-status-reviewing"].requiredPermissions,
        rollback: "available-after-persist",
        successMessage:
          ADMIN_AI_REGISTERED_ACTION_CONTRACTS["error-report-status-reviewing"].successMessage,
        type: "write"
      })
    ],
    contextBuilder: "error-reports",
    icon: "reports",
    id: "error-reports",
    name: "Reports",
    relatedAPIs: ["/api/admin/error-reports"],
    reportFormats: ["operations", "summary"]
  },
  "backup-cleanup": {
    commands: [
      ...COMMON("backup-cleanup", "backup_cleanup.view", "Backup and Cleanup Safety Report"),
      command("backup-cleanup", {
        confirmationRequired: true,
        description:
          "Open cleanup controls after an explicit safety confirmation. No cleanup runs from Copilot.",
        destinationView: "backup-cleanup",
        id: "backup-cleanup.prepare-cleanup",
        kind: "navigate",
        label: "Prepare cleanup review",
        requiredPermissions: ["backup_cleanup.run_cleanup"],
        type: "dangerous"
      })
    ],
    contextBuilder: "backup-cleanup",
    icon: "settings",
    id: "backup-cleanup",
    name: "Backup and Cleanup",
    relatedAPIs: ["/api/admin/backup-cleanup"],
    reportFormats: ["operations", "summary"]
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
        description:
          "Open protected payment settings. Copilot never reads or writes payment secrets.",
        destinationView: "paid-masterclass-settings",
        id: "paid-masterclass-settings.prepare-change",
        kind: "navigate",
        label: "Prepare settings review",
        requiredPermissions: ["paid_masterclass.edit_settings"],
        type: "dangerous"
      })
    ],
    contextBuilder: "paid-masterclass-settings",
    icon: "settings",
    id: "paid-masterclass-settings",
    name: "Payments",
    relatedAPIs: ["/api/admin/masterclass-private-link", "/api/admin/masterclass-settings"],
    reportFormats: ["operations", "summary"]
  },
  settings: {
    commands: [
      ...COMMON("settings", "settings.view", "Admin Configuration Report"),
      command("settings", {
        description:
          "Explain the purpose, current permission-visible value, dependencies, and operational effect of one selected setting without changing it.",
        id: "settings.explain-setting",
        inputSchema: { settingKey: "string" },
        kind: "summarize",
        label: "Explain this setting",
        requiredPermissions: ["settings.view"],
        type: "read"
      }),
      command("settings", {
        description:
          "Analyze permission-visible configuration for risky combinations, public impact, and protected-workflow requirements without exposing secrets.",
        id: "settings.analyze-risk",
        kind: "find-problems",
        label: "Analyze setting risks",
        requiredPermissions: ["settings.view"],
        type: "read"
      }),
      command("settings", {
        description:
          "Validate permission-visible Settings fields, formats, dependencies, and safe defaults without saving any value.",
        id: "settings.validate-configuration",
        kind: "find-problems",
        label: "Validate configuration safely",
        requiredPermissions: ["settings.view"],
        type: "read"
      }),
      command("settings", {
        description:
          "Identify required permission-visible configuration that is missing or unavailable while treating secrets as presence-only signals.",
        id: "settings.find-required-configuration",
        kind: "find-problems",
        label: "Find required configuration",
        requiredPermissions: ["settings.view"],
        type: "read"
      }),
      command("settings", {
        approvalLevel: 1,
        description:
          "Prepare a before-and-after review for one support setting without saving the change.",
        destinationView: "settings",
        executionContract: {
          currentStateLabel: "Current selected setting value",
          proposedStateLabel: "Prepared setting change for review only"
        },
        id: "settings.prepare-change",
        inputSchema: {
          currentValue: "string",
          proposedValue: "string",
          settingKey: "string"
        },
        kind: "next-action",
        label: "Prepare settings change",
        requiredPermissions: ["settings.support"],
        type: "suggest"
      }),
      command("settings", {
        confirmationRequired: true,
        description:
          "Update only the approved non-critical proactive suggestions preference after exact before-and-after confirmation.",
        executionContract: {
          availability: "executable",
          blockedReason: null,
          currentStateLabel: "Current proactive suggestions preference",
          dependencies: [
            "Authenticated admin session and CSRF validation",
            "Permission: settings.support",
            "Durable ADMIN_DB action receipt",
            "Atomic admin audit persistence"
          ],
          issueClassification: "recommendation",
          maxBatchSize: 1,
          maxSelectedRecords: 0,
          minSelectedRecords: 0,
          proposedStateLabel: "Approved proactive suggestions preference"
        },
        failureMessage: "Proactive suggestions update failed",
        handlerId: "settings-proactive-suggestions-update",
        id: "settings.update-proactive-suggestions",
        inputSchema: {
          currentValue: "boolean",
          proposedValue: "boolean",
          settingKey: "string"
        },
        kind: "registered-action",
        label: "Update proactive suggestions",
        requiredPermissions: ["settings.support"],
        rollback: "available-after-persist",
        successMessage: "Proactive suggestions preference updated",
        type: "write"
      })
    ],
    contextBuilder: "settings",
    icon: "settings",
    id: "settings",
    name: "Settings",
    relatedAPIs: ["/api/admin/support-defaults", "/api/admin/auth/session"],
    reportFormats: ["operations", "summary"]
  },
  "admin-users": {
    commands: [
      ...COMMON("admin-users", "admin_users.manage", "Admin Access and Least-Privilege Report"),
      command("admin-users", {
        description:
          "Check permission-visible role assignments for risky combinations and least-privilege conflicts without exposing hidden user data.",
        id: "admin-users.check-permission-risk",
        kind: "find-problems",
        label: "Check permission risks",
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        type: "read"
      }),
      command("admin-users", {
        description:
          "Explain the account, session, and access impact of suspending or removing an admin before opening the protected workflow.",
        id: "admin-users.explain-suspend-remove",
        kind: "summarize",
        label: "Explain suspend or remove impact",
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        type: "read"
      }),
      command("admin-users", {
        confirmationRequired: true,
        description:
          "Open the existing owner-only suspension workflow. Existing session revocation and OTP protections remain mandatory.",
        destinationView: "admin-users",
        executionContract: {
          currentStateLabel: "Selected active admin account",
          maxSelectedRecords: 1,
          minSelectedRecords: 1,
          proposedStateLabel: "No suspension in Copilot; protected workflow review only"
        },
        id: "admin-users.prepare-suspend-admin",
        inputSchema: { email: "string" },
        kind: "navigate",
        label: "Prepare admin suspension review",
        otpRequired: true,
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        type: "dangerous"
      }),
      command("admin-users", {
        confirmationRequired: true,
        description:
          "Open owner-only role controls. Existing owner-protection rules remain enforced.",
        destinationView: "admin-users",
        id: "admin-users.prepare-role-change",
        kind: "navigate",
        label: "Prepare role review",
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        type: "dangerous"
      }),
      command("admin-users", {
        confirmationRequired: true,
        description:
          "Open the existing owner-only delete workflow; Copilot cannot delete the admin.",
        destinationView: "admin-users",
        executionContract: {
          currentStateLabel: "Selected admin account",
          maxSelectedRecords: 1,
          minSelectedRecords: 1,
          proposedStateLabel: "No deletion in Copilot; protected workflow review only"
        },
        id: "admin-users.prepare-delete-admin",
        inputSchema: { email: "string" },
        kind: "navigate",
        label: "Prepare admin deletion review",
        otpRequired: true,
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        type: "dangerous"
      }),
      command("admin-users", {
        confirmationRequired: true,
        description:
          "Open the existing owner-only revoke workflow; Copilot cannot revoke the admin.",
        destinationView: "admin-users",
        executionContract: {
          currentStateLabel: "Selected active admin account",
          maxSelectedRecords: 1,
          minSelectedRecords: 1,
          proposedStateLabel: "No revocation in Copilot; protected workflow review only"
        },
        id: "admin-users.prepare-revoke-admin",
        inputSchema: { email: "string" },
        kind: "navigate",
        label: "Prepare admin revocation review",
        otpRequired: true,
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        type: "dangerous"
      })
    ],
    contextBuilder: "admin-users",
    icon: "users",
    id: "admin-users",
    name: "Admin Users",
    relatedAPIs: ["/api/admin/users", "/api/admin/auth/session"],
    reportFormats: ["operations", "summary"]
  }
};

export const globalAdminAICommands: AdminAICommand[] = [
  command("overview", {
    description: "Search the bounded permission-filtered entity index across allowed modules.",
    id: "global.search",
    kind: "summarize",
    label: "Search the platform",
    requiredPermissions: ["overview.view"],
    type: "read"
  }),
  command("overview", {
    description:
      "Prioritize real source failures, operational warnings, stale records, and unresolved errors.",
    id: "global.attention",
    kind: "find-problems",
    label: "What needs attention today?",
    requiredPermissions: ["overview.view"],
    type: "read"
  }),
  command("overview", {
    approvalLevel: 1,
    description: "Generate a source-labelled weekly platform health and operations report.",
    id: "global.weekly-report",
    kind: "report",
    label: "Weekly platform report",
    reportTitle: "Weekly Admin Operations Report",
    requiredPermissions: ["overview.view"],
    type: "suggest"
  }),
  command("overview", {
    description: "Prepare a bounded cross-module investigation without executing mutations.",
    id: "global.investigate",
    kind: "next-action",
    label: "Investigate across modules",
    requiredPermissions: ["overview.view"],
    type: "suggest"
  }),
  command("overview", {
    description:
      "Recommend least-privilege role and security checks, then open the existing owner controls.",
    destinationView: "admin-users",
    id: "global.security-role-review",
    kind: "next-action",
    label: "Review security and roles",
    ownerOnly: true,
    requiredPermissions: ["admin_users.manage"],
    type: "suggest"
  }),
  command("overview", {
    description:
      "Review source-backed financial warnings and platform health without exposing payment secrets.",
    id: "global.financial-platform-health",
    kind: "find-problems",
    label: "Review financial and platform health",
    ownerOnly: true,
    requiredPermissions: ["overview.view", "shop.view", "paid_masterclass.view_settings"],
    type: "read"
  }),
  command("overview", {
    description:
      "Prepare the approval, confirmation, and OTP requirements for a protected workflow without approving it.",
    destinationView: "admin-users",
    id: "global.approval-workflow",
    kind: "next-action",
    label: "Review approval workflow",
    ownerOnly: true,
    requiredPermissions: ["admin_users.manage"],
    type: "suggest"
  })
];

export function getAdminAISection(sectionId: AdminV2ViewId) {
  return adminAIRegistry[sectionId];
}

export function getAdminAISectionByAlias(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const aliased = ADMIN_AI_SECTION_ALIASES[normalized as keyof typeof ADMIN_AI_SECTION_ALIASES];
  if (aliased) return adminAIRegistry[aliased];
  const directId = normalized.replace(/\s+/g, "-") as AdminV2ViewId;
  return Object.prototype.hasOwnProperty.call(adminAIRegistry, directId)
    ? adminAIRegistry[directId]
    : undefined;
}

export function getAdminAICommand(actionId: string) {
  return [
    ...Object.values(adminAIRegistry).flatMap((section) => section.commands),
    ...globalAdminAICommands
  ].find((item) => item.id === actionId);
}

const ADMIN_AI_ROLE_PERSONALIZATIONS: Record<
  AdminAIRolePersonalization["id"],
  AdminAIRolePersonalization
> = {
  owner: {
    focus: "Cross-module risk, governance, and operational health.",
    id: "owner",
    label: "Owner Assistant",
    preferredCommandIds: [
      "global.attention",
      "global.security-role-review",
      "global.financial-platform-health",
      "global.approval-workflow",
      "global.weekly-report",
      "global.investigate"
    ],
    preferredKinds: ["find-problems", "report", "next-action", "summarize"],
    promptPlaceholder: "What needs owner attention across the platform?"
  },
  website_creator: {
    focus: "Coach-site readiness, content, links, and safe publishing.",
    id: "website_creator",
    label: "Website Builder Assistant",
    preferredCommandIds: [
      "create-coach-site.publish-readiness",
      "create-coach-site.prepare-create",
      "create-coach-site.open-preview",
      "coach-sites.check-links",
      "create-coach-site.report"
    ],
    preferredKinds: ["find-problems", "next-action", "summarize", "report"],
    promptPlaceholder: "Check this coach site for publish readiness."
  },
  analytics: {
    focus: "Evidence, trends, anomalies, and source-labelled reporting.",
    id: "analytics",
    label: "Analytics Assistant",
    preferredCommandIds: [
      "overview.generate-live-insight",
      "coach-analytics.report",
      "top-coaches.report"
    ],
    preferredKinds: ["external", "report", "find-problems", "summarize"],
    promptPlaceholder: "Explain the strongest verified analytics trend."
  },
  shop: {
    focus: "Orders, payment failures, publishing, and recovery.",
    id: "shop",
    label: "Shop Assistant",
    preferredCommandIds: [
      "shop.recovery-review",
      "shop.failed-order-triage",
      "shop.report",
      "shop.next-action"
    ],
    preferredKinds: ["find-problems", "report", "next-action", "summarize"],
    promptPlaceholder: "What Shop issue needs recovery first?"
  },
  support: {
    focus: "Customer-impacting issues, triage, and support settings.",
    id: "support",
    label: "Support Assistant",
    preferredCommandIds: [
      "error-reports.triage",
      "coach-sites.support-review",
      "error-reports.report",
      "error-reports.mark-reviewing"
    ],
    preferredKinds: ["find-problems", "next-action", "report", "registered-action"],
    promptPlaceholder: "Triage the highest-impact support issue."
  },
  custom: {
    focus: "Only the modules and records allowed by the current permission set.",
    id: "custom",
    label: "Permission-Bounded Assistant",
    preferredCommandIds: [],
    preferredKinds: ["summarize", "find-problems", "report", "next-action"],
    promptPlaceholder: "What can I safely help with in this module?"
  }
};

export function getAdminAIRolePersonalization(
  profile: AdminV2AccessProfileClient | null | undefined
): AdminAIRolePersonalization {
  if (profile?.isOwner || profile?.roleKey === "owner" || profile?.role === "owner") {
    return ADMIN_AI_ROLE_PERSONALIZATIONS.owner;
  }
  const roleKey = profile?.roleKey === "reports" ? "support" : profile?.roleKey;
  if (
    roleKey === "website_creator" ||
    roleKey === "analytics" ||
    roleKey === "shop" ||
    roleKey === "support"
  ) {
    return ADMIN_AI_ROLE_PERSONALIZATIONS[roleKey];
  }
  return ADMIN_AI_ROLE_PERSONALIZATIONS.custom;
}

export function personalizeAdminAICommands(
  profile: AdminV2AccessProfileClient | null | undefined,
  allowedCommands: AdminAICommand[]
) {
  const policy = getAdminAIRolePersonalization(profile);
  const commandRanks = new Map(policy.preferredCommandIds.map((id, index) => [id, index]));
  const kindRanks = new Map(policy.preferredKinds.map((kind, index) => [kind, index]));
  const fallbackRank = policy.preferredCommandIds.length + policy.preferredKinds.length;

  return allowedCommands
    .map((command, index) => ({
      command,
      index,
      rank:
        commandRanks.get(command.id) ??
        policy.preferredCommandIds.length + (kindRanks.get(command.kind) ?? fallbackRank)
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ command }) => command);
}
