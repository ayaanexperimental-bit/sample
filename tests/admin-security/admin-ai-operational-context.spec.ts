import { expect, test } from "@playwright/test";
import type { AdminV2ActionActivity } from "../../lib/admin-v2-access";
import type { CoachSiteRecord } from "../../lib/admin-coach-sites";
import type { AdminErrorReport } from "../../lib/admin-control-center";
import {
  buildAdminAIIntelligenceContext,
  buildAdminAISectionContext
} from "../../lib/admin-ai/adminAIContext";
import {
  buildAdminAIHealthAlerts,
  buildAdminAIHealthScore
} from "../../lib/admin-ai/adminAIHealth";
import { buildAdminAIOperationalContext } from "../../lib/admin-ai/adminAIOperationalContext";
import { inspectSelectedCoachSiteSetup } from "../../lib/admin-ai/adminAIContinuousWorkflow";

const NOW = "2026-07-21T08:00:00.000Z";

test.describe("Admin AI operational context", () => {
  test("allowlists operational facts, redacts raw values, and permission-bounds entities", () => {
    const owner = operationalContext({ isOwner: true, permissions: [] });
    const serialized = JSON.stringify(owner);

    expect(serialized).not.toContain("owner@example.com");
    expect(serialized).not.toContain("admin@example.com");
    expect(serialized).not.toContain("+919999999999");
    expect(serialized).not.toContain("private-note");
    expect(serialized).not.toContain("signed-backup-token");
    expect(serialized).not.toContain("public-route-token");
    expect(serialized).not.toContain("https://private.example/backup.csv");
    expect(owner.entities.map(({ module }) => module)).toEqual(
      expect.arrayContaining(["admin-users", "backup-cleanup", "coach-sites", "settings"])
    );

    const settingsOnly = operationalContext({
      isOwner: false,
      permissions: ["settings.view"]
    });
    expect(settingsOnly.entities).toHaveLength(6);
    expect(new Set(settingsOnly.entities.map(({ module }) => module))).toEqual(
      new Set(["settings"])
    );
  });

  test("emits the existing operational health categories when corresponding real facts exist", () => {
    const operational = operationalContext({ isOwner: true, permissions: [] });
    const intelligence = buildAdminAIIntelligenceContext({
      analyticsStatus: "failed",
      calculatedAt: NOW,
      coachSites: healthCoachSites(),
      errorReportStatus: "ready",
      errorReports: healthErrorReports(),
      operational,
      shop: {
        failedPublishCount: 2,
        paidCount: 2,
        purchaseCount: 2,
        records: [
          {
            id: "shop-failed",
            label: "Failed publish",
            status: "failed",
            updatedAt: NOW,
            workflowStage: "publish failed"
          },
          {
            id: "shop-pending",
            label: "Paid pending",
            status: "paid",
            updatedAt: NOW,
            workflowStage: "publish pending"
          }
        ],
        siteCount: 2
      },
      timeSeries: []
    });

    expect(new Set(intelligence.healthEvidence.map(({ category }) => category))).toEqual(
      new Set([
        "admin-action-failure-spikes",
        "analytics-ingestion-failures",
        "backup-failures",
        "broken-public-routes",
        "failed-publishes",
        "invalid-cta-links",
        "missing-registration-links",
        "payment-success-publish-pending-mismatches",
        "repeated-api-failures",
        "repeated-failed-otp-attempts",
        "sites-without-recent-analytics",
        "stale-drafts",
        "unusual-permission-changes",
        "unusually-high-error-count"
      ])
    );
  });

  test("emits a countable missing-backup-destination alert only from permission-visible configuration", () => {
    const backupData = {
      backupCleanup: {
        backupDownloadUrl: "https://private.example/backup.csv?token=destination-secret",
        backupEmailConfigured: false,
        destinationEmail: "private-destination@example.com",
        lastBackupAt: "2026-07-21T07:00:00.000Z",
        lastBackupStatus: "success"
      }
    };
    const visible = focusedOperationalContext({
      backupData,
      profile: { isOwner: false, permissions: ["backup_cleanup.view"] }
    });

    const alert = buildAdminAIHealthAlerts(visible.healthEvidence).find(
      ({ category }) => category === "missing-backup-destination"
    );

    expect(alert).toMatchObject({
      affectedEntity: "Backup delivery configuration",
      category: "missing-backup-destination",
      directRoute: "/admin/dashboard?view=backup-cleanup",
      id: "backup-destination-missing",
      module: "backup-cleanup",
      recurrenceCount: 1,
      safeActionId: "backup-cleanup.find-problems",
      severity: "medium",
      whatHappened: "Backup destination is missing"
    });
    expect(alert?.evidence).toEqual([
      {
        observedAt: NOW,
        source: "backup-cleanup",
        summary: "Backup delivery is not configured in the permission-visible backup status.",
        value: false
      }
    ]);
    expect(JSON.stringify(alert)).not.toContain("private-destination@example.com");
    expect(JSON.stringify(alert)).not.toContain("destination-secret");

    const hidden = focusedOperationalContext({
      backupData,
      profile: { isOwner: false, permissions: [] }
    });
    expect(
      hidden.healthEvidence.some(({ category }) => category === "missing-backup-destination")
    ).toBe(false);

    const unknown = focusedOperationalContext({
      backupData: {
        backupCleanup: {
          lastBackupAt: "2026-07-21T07:00:00.000Z",
          lastBackupStatus: "success"
        }
      },
      profile: { isOwner: false, permissions: ["backup_cleanup.view"] }
    });
    expect(
      unknown.healthEvidence.some(({ category }) => category === "missing-backup-destination")
    ).toBe(false);
  });

  test("derives backup-delay severity from lastBackupAt rather than failure counts", () => {
    const cases = [
      { ageMs: 24 * 3_600_000, expectedSeverity: null, failureCount: 99 },
      { ageMs: 24 * 3_600_000 + 1, expectedSeverity: "medium", failureCount: 0 },
      { ageMs: 72 * 3_600_000, expectedSeverity: "medium", failureCount: 99 },
      { ageMs: 72 * 3_600_000 + 1, expectedSeverity: "high", failureCount: 0 }
    ] as const;

    for (const fixture of cases) {
      const context = focusedOperationalContext({
        backupData: {
          backupCleanup: {
            backupEmailConfigured: true,
            backupFailureCount: fixture.failureCount,
            lastBackupAt: new Date(Date.parse(NOW) - fixture.ageMs).toISOString(),
            lastBackupStatus: "success"
          }
        },
        profile: { isOwner: false, permissions: ["backup_cleanup.view"] }
      });
      const delay = buildAdminAIHealthAlerts(context.healthEvidence).find(
        ({ category }) => category === "backup-delay"
      );

      if (fixture.expectedSeverity === null) {
        expect(delay).toBeUndefined();
      } else {
        expect(delay).toMatchObject({
          category: "backup-delay",
          id: "backup-latest-delayed",
          safeActionId: "backup-cleanup.find-problems",
          severity: fixture.expectedSeverity
        });
        expect(delay?.evidence[0]).toMatchObject({
          observedAt: NOW,
          source: "backup-cleanup"
        });
        expect(typeof delay?.evidence[0]?.value).toBe("number");
      }
    }

    const failedButFresh = focusedOperationalContext({
      backupData: {
        backupCleanup: {
          backupEmailConfigured: true,
          backupFailureCount: 99,
          lastBackupAt: "2026-07-21T07:00:00.000Z",
          lastBackupStatus: "failed"
        }
      },
      profile: { isOwner: false, permissions: ["backup_cleanup.view"] }
    });
    const categories = buildAdminAIHealthAlerts(failedButFresh.healthEvidence).map(
      ({ category }) => category
    );
    expect(categories).toContain("backup-failures");
    expect(categories).not.toContain("backup-delay");
  });

  test("emits owner-only risky-role evidence using allowlisted labels and hides it from limited profiles", () => {
    const usersData = {
      admins: [
        {
          displayName: "Private Admin",
          email: "private-admin@example.com",
          isOwner: false,
          note: "private-role-note",
          permissions: ["coach_sites.view", "admin_users.manage", "security.strict_roles"],
          roleKey: "website_creator",
          status: "active"
        },
        {
          email: "false-owner@example.com",
          isOwner: false,
          permissions: ["overview.view"],
          roleKey: "owner",
          status: "active"
        },
        {
          email: "real-owner@example.com",
          isOwner: true,
          permissions: ["admin_users.manage", "security.strict_roles"],
          roleKey: "owner",
          status: "active"
        },
        {
          email: "unknown-owner-state@example.com",
          permissions: ["admin_users.manage"],
          roleKey: "website_creator",
          status: "active"
        },
        {
          email: "malformed-owner-state@example.com",
          isOwner: "false",
          permissions: ["overview.view"],
          roleKey: "owner",
          status: "active"
        }
      ]
    };
    const owner = focusedOperationalContext({
      profile: { isOwner: true, permissions: [] },
      usersData
    });
    const roleAlerts = buildAdminAIHealthAlerts(owner.healthEvidence).filter(({ id }) =>
      id.startsWith("risky-role-")
    );

    expect(roleAlerts).toHaveLength(2);
    expect(roleAlerts.map(({ evidence }) => evidence[0]?.summary)).toEqual([
      "Owner role is assigned to a non-owner admin record.",
      "Website Creator role includes owner-only permissions: Manage admin users, Manage strict roles."
    ]);
    expect(roleAlerts.map(({ category }) => category)).toEqual([
      "unusual-permission-changes",
      "unusual-permission-changes"
    ]);
    const serialized = JSON.stringify(roleAlerts);
    for (const restrictedValue of [
      "private-admin@example.com",
      "false-owner@example.com",
      "real-owner@example.com",
      "unknown-owner-state@example.com",
      "malformed-owner-state@example.com",
      "private-role-note",
      "admin_users.manage",
      "security.strict_roles",
      "website_creator"
    ]) {
      expect(serialized).not.toContain(restrictedValue);
    }

    const limited = focusedOperationalContext({
      profile: { isOwner: false, permissions: ["admin_users.manage"] },
      usersData
    });
    expect(limited.healthEvidence.some(({ id }) => id.startsWith("risky-role-"))).toBe(false);
  });

  test("covers all eight score dimensions and keeps unavailable facts null", () => {
    const available = buildAdminAIIntelligenceContext({
      analyticsStatus: "ready",
      calculatedAt: NOW,
      coachSites: healthCoachSites(),
      errorReportStatus: "ready",
      errorReports: [],
      operational: operationalContext({ isOwner: true, permissions: [] }),
      shop: {
        failedPublishCount: 0,
        paidCount: 2,
        purchaseCount: 2,
        siteCount: 2
      },
      timeSeries: []
    });
    const availableScore = buildAdminAIHealthScore(available.healthScore);

    expect(availableScore.components).toHaveLength(8);
    expect(availableScore.components.find(({ id }) => id === "backup-freshness")?.score).toBe(0);
    expect(availableScore.components.find(({ id }) => id === "security-configuration")?.score).toBe(
      100
    );

    const unavailable = buildAdminAIIntelligenceContext({
      analyticsStatus: "loading",
      calculatedAt: NOW,
      coachSites: [],
      errorReportStatus: "loading",
      errorReports: [],
      operational: buildAdminAIOperationalContext({
        actionActivity: [],
        backupData: null,
        backupStatus: "unavailable",
        calculatedAt: NOW,
        coachSites: [],
        errorReports: [],
        profile: { email: "limited@example.com", permissions: [] },
        settingsStatus: "unavailable",
        usersData: null,
        usersStatus: "not-authorized"
      }),
      timeSeries: []
    });
    const unavailableScore = buildAdminAIHealthScore(unavailable.healthScore);

    expect(unavailable.healthScore.dimensions).toHaveLength(8);
    expect(
      unavailableScore.components.find(({ id }) => id === "backup-freshness")?.score
    ).toBeNull();
    expect(
      unavailableScore.components.find(({ id }) => id === "security-configuration")?.score
    ).toBeNull();
    expect(unavailableScore.score).toBeNull();
  });

  test("preserves the actual filters and selections while adding operational entities", () => {
    const operational = operationalContext({
      isOwner: false,
      permissions: ["backup_cleanup.view", "coach_sites.view", "settings.view"]
    });
    const context = buildAdminAISectionContext({
      activeView: "coach-sites",
      analytics: [],
      coachSites: healthCoachSites(),
      currentRoute: "/admin/dashboard?view=coach-sites",
      dateRange: "7D",
      errorReports: [],
      filters: { query: "  women's wellness  ", siteType: "paid", status: "published" },
      highRiskCount: 0,
      lastUpdated: NOW,
      loading: false,
      metrics: [],
      operational,
      profile: {
        email: "limited@example.com",
        permissions: ["backup_cleanup.view", "coach_sites.view", "settings.view"]
      },
      relatedAPIs: [],
      sectionName: "Coach Sites",
      selectedRows: ["site-published", "site-invalid"],
      sourceStatuses: {},
      timeSeries: []
    });

    expect(context.filters).toEqual({
      query: "women's wellness",
      siteType: "paid",
      status: "published"
    });
    expect(context.selectedRows).toEqual(["site-published", "site-invalid"]);
    expect(context.entities.map(({ module }) => module)).toEqual(
      expect.arrayContaining(["backup-cleanup", "coach-sites", "settings"])
    );
    expect(context.entities.map(({ module }) => module)).not.toContain("admin-users");
  });

  test("carries real per-site form and image readiness into continuous setup inspection", () => {
    const coachSites = healthCoachSites();
    Object.assign(coachSites[0], {
      googleFormUrl: "https://forms.example/published",
      heroMediaType: "image",
      photoUrl: "https://cdn.example/published.jpg"
    });
    Object.assign(coachSites[1], {
      googleFormUrl: "",
      heroMediaType: "image",
      photoUrl: ""
    });
    const context = buildAdminAISectionContext({
      activeView: "coach-sites",
      analytics: [],
      coachSites,
      currentRoute: "/admin/dashboard?view=coach-sites",
      dateRange: "7D",
      errorReports: [],
      highRiskCount: 0,
      lastUpdated: NOW,
      loading: false,
      metrics: [],
      profile: { email: "owner@example.com", isOwner: true, permissions: [] },
      relatedAPIs: [],
      sectionName: "Coach Sites",
      selectedRows: ["site-published", "site-invalid", "site-draft"],
      sourceStatuses: {},
      timeSeries: []
    });

    expect(inspectSelectedCoachSiteSetup(context.entities, context.selectedRows)).toEqual([
      expect.objectContaining({ form: "ready", images: "ready", siteId: "site-published" }),
      expect.objectContaining({ form: "issue", images: "issue", siteId: "site-invalid" }),
      expect.objectContaining({ form: "ready", images: "unverified", siteId: "site-draft" })
    ]);
  });
});

function operationalContext(profile: { isOwner?: boolean; permissions: string[] }) {
  return buildAdminAIOperationalContext({
    actionActivity: operationalActivity(),
    backupData: {
      backupCleanup: {
        backupDownloadUrl: "https://private.example/backup.csv?token=signed-backup-token",
        backupEmailConfigured: true,
        cleanupStatus: "Ready",
        failedRecipients: ["owner@example.com"],
        lastBackupAt: "2026-07-21T07:30:00.000Z",
        lastBackupStatus: "failed",
        maskedRecipients: ["ow****@example.com"]
      }
    },
    backupStatus: "ready",
    calculatedAt: NOW,
    coachSites: healthCoachSites(),
    errorReports: healthErrorReports(),
    profile: { email: "owner@example.com", ...profile },
    settingsStatus: "ready",
    usersData: {
      admins: [
        {
          displayName: "Root Owner",
          email: "owner@example.com",
          isOwner: true,
          note: "private-note",
          permissions: ["overview.view"],
          phone: "+919999999999",
          roleKey: "owner",
          status: "active"
        },
        {
          displayName: "Admin",
          email: "admin@example.com",
          permissions: ["coach_sites.view"],
          phone: "+918888888888",
          roleKey: "website_creator",
          status: "active"
        }
      ],
      invites: [{ email: "invite@example.com", id: "invite-secret", status: "sent" }],
      strictRolePreflight: {
        currentAdminEmail: "owner@example.com",
        dbConfigured: true,
        ownerVerified: true,
        strictDbRolesEnabled: true
      }
    },
    usersStatus: "ready"
  });
}

function focusedOperationalContext(input: {
  backupData?: unknown;
  profile: { isOwner?: boolean; permissions: string[] };
  usersData?: unknown;
}) {
  return buildAdminAIOperationalContext({
    actionActivity: [],
    backupData: input.backupData ?? null,
    backupStatus: input.backupData ? "ready" : "unavailable",
    calculatedAt: NOW,
    coachSites: [],
    errorReports: [],
    profile: { email: "viewer@example.com", ...input.profile },
    settingsStatus: "unavailable",
    usersData: input.usersData ?? null,
    usersStatus: input.usersData ? "ready" : "unavailable"
  });
}

function operationalActivity(): AdminV2ActionActivity[] {
  return [
    ...Array.from({ length: 3 }, (_, index) => ({
      detail: `OTP verification failed for owner@example.com token-${index}`,
      id: `otp-${index}`,
      label: "Coach Sites security",
      status: "error" as const,
      timestamp: `2026-07-21T07:0${index}:00.000Z`
    })),
    {
      detail: "Unexpected permission change detected for admin@example.com",
      id: "permission-change",
      label: "Admin users",
      status: "error",
      timestamp: "2026-07-21T07:10:00.000Z"
    }
  ];
}

function healthCoachSites(): CoachSiteRecord[] {
  return [
    {
      analytics: { lastUpdated: "2026-07-21T07:00:00.000Z" },
      bio: "Complete bio",
      coachName: "Published Coach",
      googleFormUrl: "",
      heroMediaType: "none",
      id: "site-published",
      niche: "Wellness",
      publicUrl: "/coach/published-coach?token=public-route-token",
      slug: "published-coach",
      status: "published",
      updatedAt: "2026-07-20T08:00:00.000Z",
      vision: "Complete vision",
      whatsappLink: ""
    },
    {
      analytics: { lastUpdated: "2026-05-01T00:00:00.000Z" },
      bio: "Complete bio",
      coachName: "Invalid Coach",
      googleFormUrl: "http://unsafe.example/register",
      heroMediaType: "none",
      id: "site-invalid",
      niche: "Wellness",
      slug: "invalid-coach",
      status: "published",
      updatedAt: "2026-07-20T08:00:00.000Z",
      vision: "Complete vision",
      whatsappLink: ""
    },
    {
      bio: "Draft bio",
      coachName: "Draft Coach",
      googleFormUrl: "https://example.com/register",
      heroMediaType: "none",
      id: "site-draft",
      niche: "Wellness",
      slug: "draft-coach",
      status: "draft",
      updatedAt: "2026-05-01T00:00:00.000Z",
      vision: "Draft vision",
      whatsappLink: ""
    }
  ] as CoachSiteRecord[];
}

function healthErrorReports(): AdminErrorReport[] {
  const reports = Array.from({ length: 10 }, (_, index) => ({
    category: index < 2 ? "API error" : "Application error",
    createdAt: `2026-07-21T0${index}:00:00.000Z`,
    errorCode: index < 2 ? "API_FAILED" : `APP_${index}`,
    pagePath: index === 2 ? "/coach/missing-coach" : "/api/admin/coach-sites",
    referenceId: `ERR-${index}`,
    safeMessage: index === 2 ? "Public route returned 404." : "Safe application failure.",
    severity: "high" as const,
    status: "New" as const
  }));
  reports[2].errorCode = "404";
  return reports as AdminErrorReport[];
}
