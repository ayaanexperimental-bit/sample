import type {
  AdminV2AccessProfileClient,
  AdminV2ActionActivity,
  AdminV2ViewId
} from "../admin-v2-access";
import type { AdminErrorReport } from "../admin-control-center";
import type { CoachSiteRecord } from "../admin-coach-sites";
import type { AdminAIHealthEvidenceInput, AdminAIHealthScoreDimensionInput } from "./adminAIHealth";
import type { AdminAIEntity } from "./adminAITypes";

const ADMIN_ROLE_LABELS = {
  analytics: "Analytics",
  co_owner: "Co-owner operational",
  custom: "Custom",
  owner: "Owner",
  reports: "Reports",
  shop: "Shop Admin",
  support: "Support Admin",
  website_creator: "Website Creator"
} as const;

const OWNER_ONLY_PERMISSION_LABELS = {
  "admin_users.manage": "Manage admin users",
  "security.strict_roles": "Manage strict roles"
} as const;

export const ADMIN_AI_SETTINGS_FIELD_DEFINITIONS = [
  {
    effect: "Sets the public support contact name shown with help details.",
    key: "supportName",
    label: "Support name",
    purpose: "Identifies the approved support contact.",
    required: true,
    risk: "An incorrect name can misidentify the support team in public help states."
  },
  {
    effect: "Sets the public support email used by help and fallback states.",
    key: "supportEmail",
    label: "Support email",
    purpose: "Provides the primary written support route.",
    required: true,
    risk: "An incorrect email can route support requests to the wrong destination."
  },
  {
    effect: "Adds an optional public phone support route.",
    key: "supportPhone",
    label: "Support phone",
    purpose: "Provides an optional voice support contact.",
    required: false,
    risk: "A stale phone number can expose an unintended public contact."
  },
  {
    effect: "Adds an optional approved WhatsApp support link.",
    key: "supportWhatsapp",
    label: "Support WhatsApp URL",
    purpose: "Provides an optional messaging support route.",
    required: false,
    risk: "A changed WhatsApp URL can redirect public support traffic."
  },
  {
    effect: "Sets the fallback help copy shown when an operation cannot complete.",
    key: "supportMessage",
    label: "Support message",
    purpose: "Explains how users can obtain help after an error.",
    required: true,
    risk: "Missing or inaccurate copy can leave users without an approved recovery path."
  }
] as const;

export type AdminAISettingsFieldKey =
  (typeof ADMIN_AI_SETTINGS_FIELD_DEFINITIONS)[number]["key"];

export type AdminAISettingsSnapshot = Readonly<{
  configuredFieldCount: number;
  fieldCount: number;
  fieldPresence: Readonly<Record<AdminAISettingsFieldKey, boolean>>;
  status: "idle" | "loading" | "saving";
}>;

export type AdminAIOperationalContext = Readonly<{
  entities: readonly AdminAIEntity[];
  healthEvidence: readonly AdminAIHealthEvidenceInput[];
  scoreDimensions: readonly AdminAIHealthScoreDimensionInput[];
}>;

export function buildAdminAIOperationalContext(input: {
  actionActivity: readonly AdminV2ActionActivity[];
  backupData: unknown;
  backupStatus: string;
  calculatedAt: string;
  coachSites: readonly CoachSiteRecord[];
  errorReports: readonly AdminErrorReport[];
  profile?: AdminV2AccessProfileClient | null;
  settingsSnapshot?: AdminAISettingsSnapshot | null;
  settingsStatus: string;
  usersData: unknown;
  usersStatus: string;
}): AdminAIOperationalContext {
  const calculatedAt = timestamp(input.calculatedAt) || new Date().toISOString();
  const owner = Boolean(input.profile?.isOwner);
  const permissions = new Set(input.profile?.permissions || []);
  const can = (...required: string[]) => owner || required.some((item) => permissions.has(item));
  const backup = readBackup(input.backupData);
  const users = readUsers(input.usersData);
  const entities: AdminAIEntity[] = [];

  if (can("backup_cleanup.view")) {
    entities.push({
      id: "backup:latest",
      label: "Latest backup",
      matchReason: backup
        ? `${backup.recordCount} records; email delivery ${
            backup.emailConfigured === null
              ? "configuration unavailable"
              : backup.emailConfigured
                ? "configured"
                : "not configured"
          }.`
        : "No allowlisted backup facts are available from the current source.",
      module: "backup-cleanup",
      route: "/admin/dashboard?view=backup-cleanup",
      searchableText: `backup cleanup retention ${backup?.state || sourceState(input.backupStatus)}`,
      source: "backup-cleanup",
      status: backup?.state || sourceState(input.backupStatus),
      updatedAt: backup?.lastBackupAt || calculatedAt
    });
  }

  if (can("settings.view")) {
    const configured = input.settingsSnapshot?.configuredFieldCount;
    const total = input.settingsSnapshot?.fieldCount;
    entities.push({
      id: "settings:configuration",
      label: "Settings configuration",
      matchReason:
        Number.isInteger(configured) && Number.isInteger(total)
          ? `${configured} of ${total} support-default fields are configured; values remain private.`
          : "Settings source status is available; private setting values are excluded.",
      module: "settings",
      route: "/admin/dashboard?view=settings",
      searchableText: "settings security support defaults configuration",
      source: "settings",
      status: sourceState(input.settingsStatus),
      updatedAt: calculatedAt
    });
    for (const definition of ADMIN_AI_SETTINGS_FIELD_DEFINITIONS) {
      const present = input.settingsSnapshot?.fieldPresence?.[definition.key] === true;
      const status = present
        ? "configured"
        : definition.required
          ? "missing-required"
          : "missing-optional";
      entities.push({
        id: `settings:${definition.key}`,
        label: definition.label,
        matchReason: `${definition.label} is ${status.replace("-", " ")}; values remain private.`,
        module: "settings",
        route: "/admin/dashboard?view=settings",
        searchableText: `settings support defaults ${definition.key} ${status}`,
        source: "settings",
        status,
        updatedAt: calculatedAt
      });
    }
  }

  if (owner && users) {
    entities.push({
      id: "admin-users:directory",
      label: "Admin user directory",
      matchReason: `${users.adminCount} managed admins and ${users.pendingInviteCount} pending invites are visible to the owner.`,
      module: "admin-users",
      route: "/admin/dashboard?view=admin-users",
      searchableText: `admin users roles permissions active ${users.activeAdminCount} pending invites ${users.pendingInviteCount}`,
      source: "admin-users",
      status: sourceState(input.usersStatus),
      updatedAt: calculatedAt
    });
  }

  if (can("coach_sites.view")) {
    input.coachSites.slice(0, 120).forEach((site) => {
      const publicPath = safePublicPath(site.publicUrl || `/coach/${site.slug}`);
      if (!publicPath) return;
      entities.push({
        id: `public-route:${stableHash(publicPath)}`,
        label: "Coach public route",
        matchReason: `The loaded coach-site record reports status ${safeState(site.status)}; no live HTTP result is implied.`,
        module: "coach-sites",
        route: `/admin/dashboard?view=coach-sites&site=${encodeURIComponent(site.id)}`,
        searchableText:
          `public route ${site.slug} ${safeState(site.status)} ${publicPath}`.toLowerCase(),
        source: "coach-sites",
        status: safeState(site.status),
        updatedAt: timestamp(site.updatedAt || site.createdAt) || calculatedAt
      });
    });
  }

  const visibleActivity = input.actionActivity
    .slice(0, 40)
    .map((activity) => ({ activity, access: activityAccess(activity.label) }))
    .filter(({ access }) => (access.ownerOnly ? owner : can(...access.permissions)));
  visibleActivity.forEach(({ activity, access }) => {
    const observedAt = timestamp(activity.timestamp) || calculatedAt;
    entities.push({
      id: `audit:${safeId(activity.id) || stableHash(`${access.module}:${observedAt}`)}`,
      label: `${access.label} activity`,
      matchReason: `A current-session Admin action recorded status ${safeActivityStatus(activity.status)}. Raw details are excluded.`,
      module: access.module,
      route: `/admin/dashboard?view=${access.module}`,
      searchableText:
        `audit admin action ${access.label} ${safeActivityStatus(activity.status)}`.toLowerCase(),
      source: "admin-action-activity",
      status: safeActivityStatus(activity.status),
      updatedAt: observedAt
    });
    if (isOtpActivity(activity)) {
      entities.push({
        id: `otp:${safeId(activity.id) || stableHash(`${access.module}:${observedAt}`)}`,
        label: `${access.label} OTP signal`,
        matchReason: `A current-session OTP workflow recorded status ${safeActivityStatus(activity.status)}; codes and raw details are excluded.`,
        module: access.module,
        route: `/admin/dashboard?view=${access.module}`,
        searchableText:
          `otp verification ${access.label} ${safeActivityStatus(activity.status)}`.toLowerCase(),
        source: "admin-action-activity",
        status: safeActivityStatus(activity.status),
        updatedAt: observedAt
      });
    }
  });

  const healthEvidence = buildOperationalHealthEvidence({
    backup,
    calculatedAt,
    canBackup: can("backup_cleanup.view"),
    canReports: can("error_reports.view"),
    canUsers: owner,
    errorReports: input.errorReports,
    users,
    visibleActivity
  });
  const scoreDimensions = [
    can("backup_cleanup.view") ? backupScore(backup, calculatedAt) : null,
    owner ? securityScore(users, calculatedAt) : null
  ].filter((item): item is AdminAIHealthScoreDimensionInput => item !== null);

  return {
    entities: entities.slice(0, 300),
    healthEvidence: healthEvidence.slice(0, 100),
    scoreDimensions
  };
}

function buildOperationalHealthEvidence(input: {
  backup: BackupFacts | null;
  calculatedAt: string;
  canBackup: boolean;
  canReports: boolean;
  canUsers: boolean;
  errorReports: readonly AdminErrorReport[];
  users: UsersFacts | null;
  visibleActivity: Array<{
    access: ActivityAccess;
    activity: AdminV2ActionActivity;
  }>;
}) {
  const evidence: AdminAIHealthEvidenceInput[] = [];
  if (input.canBackup && input.backup?.state === "failed") {
    evidence.push(
      healthEvidence({
        affectedEntity: "Latest backup",
        calculatedAt: input.calculatedAt,
        category: "backup-failures",
        id: "backup-latest-failed",
        impact: "The latest recorded backup did not complete successfully.",
        module: "backup-cleanup",
        observedAt: input.backup.lastBackupAt,
        recurrenceCount: 1,
        route: "/admin/dashboard?view=backup-cleanup",
        safeActionId: "backup-cleanup.find-problems",
        severity: "high",
        source: "backup-cleanup",
        summary: "The allowlisted latest-backup status is failed.",
        value: "failed",
        whatHappened: "Latest backup failed"
      })
    );
  }

  if (input.canBackup && input.backup?.emailConfigured === false) {
    evidence.push(
      healthEvidence({
        affectedEntity: "Backup delivery configuration",
        calculatedAt: input.calculatedAt,
        category: "missing-backup-destination",
        id: "backup-destination-missing",
        impact: "Backup email delivery has no configured destination.",
        module: "backup-cleanup",
        recurrenceCount: 1,
        route: "/admin/dashboard?view=backup-cleanup",
        safeActionId: "backup-cleanup.find-problems",
        severity: "medium",
        source: "backup-cleanup",
        summary: "Backup delivery is not configured in the permission-visible backup status.",
        value: false,
        whatHappened: "Backup destination is missing"
      })
    );
  }

  if (input.canBackup && input.backup?.lastBackupAt) {
    const ageHours = backupAgeHours(input.backup.lastBackupAt, input.calculatedAt);
    if (ageHours > 24) {
      const highSeverity = ageHours > 72;
      evidence.push(
        healthEvidence({
          affectedEntity: "Latest backup",
          calculatedAt: input.calculatedAt,
          category: "backup-delay",
          id: "backup-latest-delayed",
          impact: "Recovery data may be older than the default backup freshness SLA.",
          module: "backup-cleanup",
          recurrenceCount: 1,
          route: "/admin/dashboard?view=backup-cleanup",
          safeActionId: "backup-cleanup.find-problems",
          severity: highSeverity ? "high" : "medium",
          source: "backup-cleanup",
          summary: highSeverity
            ? "The allowlisted last-backup timestamp is more than 72 hours old."
            : "The allowlisted last-backup timestamp is more than 24 hours old.",
          value: ageHours,
          whatHappened: "Latest backup exceeded the default freshness SLA"
        })
      );
    }
  }

  if (input.canReports) {
    const openReports = input.errorReports.filter(
      (report) => report.status !== "Fixed" && report.status !== "Ignored"
    );
    if (openReports.length >= 10) {
      const reportTimes = openReports.map((report) => timestamp(report.createdAt)).filter(Boolean);
      evidence.push(
        healthEvidence({
          affectedEntity: "Permission-visible error reports",
          calculatedAt: input.calculatedAt,
          category: "unusually-high-error-count",
          id: "error-count-operational-threshold",
          impact: "A large current error backlog can hide repeated or high-priority failures.",
          module: "error-reports",
          observedAt: latest(reportTimes) || input.calculatedAt,
          recurrenceCount: openReports.length,
          route: "/admin/dashboard?view=error-reports",
          safeActionId: "error-reports.triage",
          severity: "high",
          source: "error-reports",
          summary: `${openReports.length} permission-visible reports are currently open; the review threshold is 10.`,
          value: openReports.length,
          whatHappened: "Open error count crossed the review threshold"
        })
      );
    }

    const brokenRoutes = new Map<string, AdminErrorReport[]>();
    openReports.forEach((report) => {
      const route = safePublicPath(report.pagePath);
      const signal = `${report.category} ${report.errorCode || ""} ${report.safeMessage}`;
      if (!route || /^\/(?:admin|api)(?:\/|$)/.test(route) || !/404|not[\s_-]*found/i.test(signal))
        return;
      brokenRoutes.set(route, [...(brokenRoutes.get(route) || []), report]);
    });
    brokenRoutes.forEach((reports, route) => {
      const reportTimes = reports.map((report) => timestamp(report.createdAt)).filter(Boolean);
      evidence.push(
        healthEvidence({
          affectedEntity: route,
          calculatedAt: input.calculatedAt,
          category: "broken-public-routes",
          firstDetected: earliest(reportTimes),
          id: `broken-route-${stableHash(route)}`,
          impact: "Visitors may be unable to open the reported public route.",
          module: "coach-sites",
          observedAt: latest(reportTimes) || input.calculatedAt,
          recurrenceCount: reports.length,
          route: `/admin/dashboard?view=error-reports&report=${encodeURIComponent(reports[0].referenceId)}`,
          severity: "high",
          source: "error-reports",
          summary: `${reports.length} permission-visible route-not-found report${reports.length === 1 ? "" : "s"} reference this public path.`,
          value: reports.length,
          whatHappened: "Public route was reported not found"
        })
      );
    });
  }

  const failures = input.visibleActivity.filter(({ activity }) => activity.status === "error");
  if (failures.length >= 3) {
    const times = failures.map(({ activity }) => timestamp(activity.timestamp)).filter(Boolean);
    evidence.push(
      healthEvidence({
        affectedEntity: "Current Admin session",
        calculatedAt: input.calculatedAt,
        category: "admin-action-failure-spikes",
        firstDetected: earliest(times),
        id: "admin-action-session-failures",
        impact:
          "Repeated failures in the current session may indicate an unavailable Admin workflow.",
        module: "overview",
        observedAt: latest(times) || input.calculatedAt,
        recurrenceCount: failures.length,
        route: "/admin/dashboard?view=overview",
        severity: "high",
        source: "admin-action-activity",
        summary: `${failures.length} allowlisted Admin actions failed in the current bounded activity window.`,
        value: failures.length,
        whatHappened: "Admin action failures crossed the session review threshold"
      })
    );
  }

  const otpFailures = failures.filter(({ activity }) => isOtpActivity(activity));
  if (otpFailures.length >= 2) {
    const times = otpFailures.map(({ activity }) => timestamp(activity.timestamp)).filter(Boolean);
    evidence.push(
      healthEvidence({
        affectedEntity: "Current-session OTP workflows",
        calculatedAt: input.calculatedAt,
        category: "repeated-failed-otp-attempts",
        firstDetected: earliest(times),
        id: "otp-session-failures",
        impact: "Repeated OTP failures can block protected Admin actions or indicate misuse.",
        module: otpFailures[0].access.module,
        observedAt: latest(times) || input.calculatedAt,
        recurrenceCount: otpFailures.length,
        route: `/admin/dashboard?view=${otpFailures[0].access.module}`,
        safeActionId: "admin-users.find-problems",
        severity: "high",
        source: "admin-action-activity",
        summary: `${otpFailures.length} OTP workflows failed in the current bounded activity window; codes are excluded.`,
        value: otpFailures.length,
        whatHappened: "Repeated current-session OTP failures"
      })
    );
  }

  const permissionChanges = failures.filter(({ activity }) =>
    /(?:unexpected|unusual|unauthori[sz]ed).*(?:permission|role)|(?:permission|role).*(?:unexpected|unusual|unauthori[sz]ed)/i.test(
      `${activity.label} ${activity.detail}`
    )
  );
  if (permissionChanges.length) {
    const times = permissionChanges
      .map(({ activity }) => timestamp(activity.timestamp))
      .filter(Boolean);
    evidence.push(
      healthEvidence({
        affectedEntity: "Admin role configuration",
        calculatedAt: input.calculatedAt,
        category: "unusual-permission-changes",
        firstDetected: earliest(times),
        id: "permission-change-session-signal",
        impact: "An explicitly reported unexpected role or permission change needs owner review.",
        module: "admin-users",
        observedAt: latest(times) || input.calculatedAt,
        recurrenceCount: permissionChanges.length,
        route: "/admin/dashboard?view=admin-users",
        safeActionId: "admin-users.find-problems",
        severity: "critical",
        source: "admin-action-activity",
        summary:
          "A current-session Admin action explicitly reported an unexpected permission or role change; raw details are excluded.",
        value: permissionChanges.length,
        whatHappened: "Unexpected permission change was reported"
      })
    );
  }

  if (input.canUsers) {
    for (const risk of input.users?.roleRisks || []) {
      const ownerRoleClaim = risk.kind === "non-owner-owner-role";
      const summary = ownerRoleClaim
        ? "Owner role is assigned to a non-owner admin record."
        : `${risk.roleLabel} role includes owner-only permissions: ${risk.permissionLabels.join(", ")}.`;
      evidence.push(
        healthEvidence({
          affectedEntity: `${risk.roleLabel} role`,
          calculatedAt: input.calculatedAt,
          category: "unusual-permission-changes",
          id: ownerRoleClaim
            ? "risky-role-owner-on-non-owner"
            : `risky-role-owner-only-${stableHash(`${risk.roleLabel}:${risk.permissionLabels.join("|")}`)}`,
          impact: ownerRoleClaim
            ? "A non-owner record with the Owner role can conflict with the protected owner boundary."
            : "Owner-only controls assigned to a non-owner role conflict with least-privilege access.",
          module: "admin-users",
          recurrenceCount: risk.recurrenceCount,
          route: "/admin/dashboard?view=admin-users",
          safeActionId: "admin-users.find-problems",
          severity: ownerRoleClaim ? "critical" : "high",
          source: "admin-users",
          summary,
          value: risk.recurrenceCount,
          whatHappened: ownerRoleClaim
            ? "Non-owner admin record claims the Owner role"
            : "Non-owner role includes owner-only permissions"
        })
      );
    }
  }

  return evidence;
}

function backupScore(
  backup: BackupFacts | null,
  calculatedAt: string
): AdminAIHealthScoreDimensionInput {
  if (!backup?.lastBackupAt) {
    return missingScore("backup-freshness", "Latest backup timestamp from backup-cleanup");
  }
  const rawAgeHours = backupAgeHours(backup.lastBackupAt, calculatedAt);
  const ageHours = Math.round(rawAgeHours * 100) / 100;
  const score =
    backup.state === "failed" ? 0 : rawAgeHours <= 24 ? 100 : rawAgeHours <= 72 ? 50 : 0;
  return {
    calculation:
      "The latest failed backup scores 0; otherwise a backup at most 24 hours old scores 100, at most 72 hours old scores 50, and an older backup scores 0.",
    dimension: "backup-freshness",
    exactInputs: [
      {
        label: "Latest backup age in hours",
        observedAt: calculatedAt,
        source: "backup-cleanup",
        value: ageHours
      },
      {
        label: "Latest backup state",
        observedAt: backup.lastBackupAt,
        source: "backup-cleanup",
        value: backup.state
      }
    ],
    howToImprove: ["Run and verify a current backup before protected cleanup."],
    missingInputs: [],
    score,
    weight: 1
  };
}

function securityScore(
  users: UsersFacts | null,
  calculatedAt: string
): AdminAIHealthScoreDimensionInput {
  if (!users?.strictRolePreflight) {
    return missingScore(
      "security-configuration",
      "Owner-only strict-role preflight from admin-users"
    );
  }
  const checks = users.strictRolePreflight;
  const values = [checks.dbConfigured, checks.ownerVerified, checks.strictDbRolesEnabled];
  return {
    calculation:
      "Enabled database, verified owner, and strict-role checks divided by the three allowlisted security checks, multiplied by 100.",
    dimension: "security-configuration",
    exactInputs: [
      {
        label: "Admin database configured",
        observedAt: calculatedAt,
        source: "admin-users",
        value: checks.dbConfigured
      },
      {
        label: "Owner verified",
        observedAt: calculatedAt,
        source: "admin-users",
        value: checks.ownerVerified
      },
      {
        label: "Strict database roles enabled",
        observedAt: calculatedAt,
        source: "admin-users",
        value: checks.strictDbRolesEnabled
      }
    ],
    howToImprove: [
      "Configure the Admin database, verify the owner row, and enable strict database roles."
    ],
    missingInputs: [],
    score: Math.round((values.filter(Boolean).length / values.length) * 10_000) / 100,
    weight: 1
  };
}

function missingScore(
  dimension: AdminAIHealthScoreDimensionInput["dimension"],
  missing: string
): AdminAIHealthScoreDimensionInput {
  return {
    calculation: "",
    dimension,
    exactInputs: [],
    howToImprove: [`Provide ${missing.toLowerCase()}.`],
    missingInputs: [missing],
    score: null,
    weight: 1
  };
}

function healthEvidence(input: {
  affectedEntity: string;
  calculatedAt: string;
  category: AdminAIHealthEvidenceInput["category"];
  firstDetected?: string;
  id: string;
  impact: string;
  module: string;
  observedAt?: string;
  recurrenceCount: number;
  route: string;
  safeActionId?: AdminAIHealthEvidenceInput["safeActionId"];
  severity: AdminAIHealthEvidenceInput["severity"];
  source: string;
  summary: string;
  value: boolean | number | string;
  whatHappened: string;
}): AdminAIHealthEvidenceInput {
  const observedAt = input.observedAt || input.calculatedAt;
  return {
    affectedEntity: input.affectedEntity,
    category: input.category,
    directRoute: input.route,
    evidence: [{ observedAt, source: input.source, summary: input.summary, value: input.value }],
    firstDetected: input.firstDetected || observedAt,
    id: input.id,
    impact: input.impact,
    lastDetected: observedAt,
    module: input.module,
    recurrenceCount: input.recurrenceCount,
    safeActionId: input.safeActionId,
    severity: input.severity,
    suggestedNextStep: "Open the permission-safe source view and verify the underlying records.",
    whatHappened: input.whatHappened
  };
}

type BackupFacts = {
  emailConfigured: boolean | null;
  lastBackupAt: string;
  recordCount: number;
  state: "failed" | "pending" | "success" | "unknown";
};

function readBackup(value: unknown): BackupFacts | null {
  const root = record(value);
  const backup = record(root?.backupCleanup) || root;
  if (!backup) return null;
  return {
    emailConfigured:
      typeof backup.backupEmailConfigured === "boolean" ? backup.backupEmailConfigured : null,
    lastBackupAt: timestamp(backup.lastBackupAt),
    recordCount: count(backup.lastBackupRecordCount),
    state: operationState(backup.lastBackupStatus)
  };
}

type UsersFacts = {
  activeAdminCount: number;
  adminCount: number;
  pendingInviteCount: number;
  roleRisks: readonly UserRoleRisk[];
  strictRolePreflight: {
    dbConfigured: boolean;
    ownerVerified: boolean;
    strictDbRolesEnabled: boolean;
  } | null;
};

function readUsers(value: unknown): UsersFacts | null {
  const root = record(value);
  if (!root) return null;
  const admins = records(root.admins);
  const invites = records(root.invites);
  const preflight = record(root.strictRolePreflight);
  return {
    activeAdminCount: admins.filter((admin) => safeState(admin.status) === "active").length,
    adminCount: admins.length,
    pendingInviteCount: invites.filter(
      (invite) => !["active", "revoked", "verified"].includes(safeState(invite.status))
    ).length,
    roleRisks: readUserRoleRisks(admins),
    strictRolePreflight:
      typeof preflight?.dbConfigured === "boolean" &&
      typeof preflight.ownerVerified === "boolean" &&
      typeof preflight.strictDbRolesEnabled === "boolean"
        ? {
            dbConfigured: preflight.dbConfigured,
            ownerVerified: preflight.ownerVerified,
            strictDbRolesEnabled: preflight.strictDbRolesEnabled
          }
        : null
  };
}

type UserRoleRisk = Readonly<{
  kind: "non-owner-owner-role" | "owner-only-permissions";
  permissionLabels: readonly string[];
  recurrenceCount: number;
  roleLabel: string;
}>;

function readUserRoleRisks(admins: readonly Record<string, unknown>[]): UserRoleRisk[] {
  const risks = new Map<string, UserRoleRisk>();
  const addRisk = (
    kind: UserRoleRisk["kind"],
    roleLabel: string,
    permissionLabels: readonly string[]
  ) => {
    const key = `${kind}:${roleLabel}:${permissionLabels.join("|")}`;
    const existing = risks.get(key);
    risks.set(key, {
      kind,
      permissionLabels,
      recurrenceCount: (existing?.recurrenceCount || 0) + 1,
      roleLabel
    });
  };

  for (const admin of admins) {
    if (admin.isOwner !== false) continue;
    const roleLabel = allowlistedRoleLabel(admin.roleKey);
    if (!roleLabel) continue;
    if (admin.roleKey === "owner") {
      addRisk("non-owner-owner-role", roleLabel, []);
    }
    const permissionLabels = allowlistedOwnerOnlyPermissionLabels(admin.permissions);
    if (permissionLabels.length) {
      addRisk("owner-only-permissions", roleLabel, permissionLabels);
    }
  }

  return [...risks.values()];
}

function allowlistedRoleLabel(value: unknown) {
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(ADMIN_ROLE_LABELS, value)
  ) {
    return "";
  }
  return ADMIN_ROLE_LABELS[value as keyof typeof ADMIN_ROLE_LABELS];
}

function allowlistedOwnerOnlyPermissionLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((permission) =>
        typeof permission === "string" &&
        Object.prototype.hasOwnProperty.call(OWNER_ONLY_PERMISSION_LABELS, permission)
          ? [OWNER_ONLY_PERMISSION_LABELS[permission as keyof typeof OWNER_ONLY_PERMISSION_LABELS]]
          : []
      )
    )
  ].sort();
}

type ActivityAccess = {
  label: string;
  module: AdminV2ViewId;
  ownerOnly?: boolean;
  permissions: string[];
};

function activityAccess(label: string): ActivityAccess {
  if (/admin users/i.test(label))
    return { label: "Admin users", module: "admin-users", ownerOnly: true, permissions: [] };
  if (/backup|cleanup/i.test(label))
    return { label: "Backup", module: "backup-cleanup", permissions: ["backup_cleanup.view"] };
  if (/payment|masterclass/i.test(label))
    return {
      label: "Payments",
      module: "paid-masterclass-settings",
      permissions: ["paid_masterclass.view_settings"]
    };
  if (/coach site/i.test(label))
    return { label: "Coach Sites", module: "coach-sites", permissions: ["coach_sites.view"] };
  return { label: "Admin", module: "overview", permissions: ["overview.view"] };
}

function isOtpActivity(activity: AdminV2ActionActivity) {
  return /\botp\b|verification code/i.test(`${activity.label} ${activity.detail}`);
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

function timestamp(value: unknown) {
  if (typeof value !== "string") return "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function safePublicPath(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, "https://ywcoach.com");
    if (url.protocol !== "https:") return "";
    return url.pathname.slice(0, 240);
  } catch {
    return "";
  }
}

function sourceState(value: unknown) {
  const normalized = safeState(value);
  return ["empty", "loading", "not-authorized", "ready", "unavailable"].includes(normalized)
    ? normalized
    : "unknown";
}

function operationState(value: unknown): BackupFacts["state"] {
  const normalized = safeState(value);
  if (/fail|error/.test(normalized)) return "failed";
  if (/success|complete|created|ready/.test(normalized)) return "success";
  if (/pending|running|start/.test(normalized)) return "pending";
  return "unknown";
}

function safeActivityStatus(value: unknown) {
  return value === "error" || value === "success" || value === "working" ? value : "unknown";
}

function safeState(value: unknown) {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
    : "unknown";
}

function safeId(value: unknown) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) : "";
}

function count(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0;
}

function backupAgeHours(lastBackupAt: string, calculatedAt: string) {
  return Math.max(0, (Date.parse(calculatedAt) - Date.parse(lastBackupAt)) / 3_600_000);
}

function earliest(values: string[]) {
  return [...values].sort()[0] || "";
}

function latest(values: string[]) {
  return [...values].sort().at(-1) || "";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
