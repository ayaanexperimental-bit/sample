import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AdminV2AccessProfileClient } from "../../lib/admin-v2-access";
import {
  getAdminAICommandAvailability,
  getAdminAIUnavailableCapabilityReason,
  getAllowedAdminAICommands
} from "../../lib/admin-ai/adminAIPermissions";
import {
  adminAIRegistry,
  getAdminAIRolePersonalization,
  globalAdminAICommands,
  personalizeAdminAICommands,
  type AdminAICommand
} from "../../lib/admin-ai/adminAIRegistry";
import {
  getAdminAIConfirmationCopy,
  requiresAdminAIConfirmation
} from "../../lib/admin-ai/adminAISafety";
import { ADMIN_ROLE_TEMPLATES } from "../../lib/server/admin-rbac";

const allCommands = [
  ...Object.values(adminAIRegistry).flatMap((section) => section.commands),
  ...globalAdminAICommands
];

test.describe("Admin AI role personalization and approval semantics", () => {
  test("provides least-privilege Shop Admin and Support Admin role templates", () => {
    const shop = roleTemplate("shop");
    const support = roleTemplate("support");

    expect(shop.label).toBe("Shop Admin");
    expect(shop.permissions).not.toEqual([]);
    expect(shop.permissions.every((permission) => permission.startsWith("shop."))).toBe(true);

    expect(support.label).toBe("Support Admin");
    expect(support.permissions).toEqual(
      expect.arrayContaining([
        "overview.view",
        "error_reports.view",
        "error_reports.mark_status",
        "settings.view",
        "settings.support"
      ])
    );
    expect(support.permissions).not.toContain("error_reports.technical_details");
    expect(support.permissions).not.toContain("settings.security");
  });

  test("tailors assistance for all five roles without adding inaccessible commands", () => {
    const fixtures: Array<{
      expectedFirst: string;
      expectedLabel: string;
      profile: AdminV2AccessProfileClient;
      roleKey: "analytics" | "owner" | "shop" | "support" | "website_creator";
    }> = [
      {
        expectedFirst: "global.attention",
        expectedLabel: "Owner Assistant",
        profile: {
          email: "owner@example.com",
          isOwner: true,
          permissions: [],
          role: "owner",
          roleKey: "owner"
        },
        roleKey: "owner"
      },
      {
        expectedFirst: "create-coach-site.publish-readiness",
        expectedLabel: "Website Builder Assistant",
        profile: profileFor("website_creator"),
        roleKey: "website_creator"
      },
      {
        expectedFirst: "overview.generate-live-insight",
        expectedLabel: "Analytics Assistant",
        profile: profileFor("analytics"),
        roleKey: "analytics"
      },
      {
        expectedFirst: "shop.recovery-review",
        expectedLabel: "Shop Assistant",
        profile: profileFor("shop"),
        roleKey: "shop"
      },
      {
        expectedFirst: "error-reports.triage",
        expectedLabel: "Support Assistant",
        profile: profileFor("support"),
        roleKey: "support"
      }
    ];
    const prompts = new Set<string>();

    for (const fixture of fixtures) {
      const allowed = getAllowedAdminAICommands(fixture.profile, allCommands);
      const personalized = personalizeAdminAICommands(fixture.profile, allowed);
      const policy = getAdminAIRolePersonalization(fixture.profile);

      expect(policy.id).toBe(fixture.roleKey);
      expect(policy.label).toBe(fixture.expectedLabel);
      expect(policy.focus).not.toBe("");
      expect(policy.promptPlaceholder).not.toBe("");
      expect(personalized[0]?.id).toBe(fixture.expectedFirst);
      expect(personalized.map((command) => command.id).sort()).toEqual(
        allowed.map((command) => command.id).sort()
      );
      expect(
        personalized.every(
          (command) =>
            fixture.profile.isOwner ||
            (command.requiredPermissions || []).every((permission) =>
              fixture.profile.permissions?.includes(permission)
            )
        )
      ).toBe(true);
      prompts.add(policy.promptPlaceholder);
    }

    expect(prompts.size).toBe(fixtures.length);
  });

  test("prioritizes permission-bounded assistance for Owner, Builder, Shop, and Support roles", () => {
    const fixtures: Array<{
      expectedCommandIds: string[];
      profile: AdminV2AccessProfileClient;
    }> = [
      {
        expectedCommandIds: [
          "global.security-role-review",
          "global.financial-platform-health",
          "global.approval-workflow"
        ],
        profile: {
          email: "owner@example.com",
          isOwner: true,
          permissions: [],
          role: "owner",
          roleKey: "owner"
        }
      },
      {
        expectedCommandIds: ["create-coach-site.prepare-create", "create-coach-site.open-preview"],
        profile: profileFor("website_creator")
      },
      {
        expectedCommandIds: ["shop.failed-order-triage"],
        profile: profileFor("shop")
      },
      {
        expectedCommandIds: ["coach-sites.support-review"],
        profile: profileFor("support")
      }
    ];

    for (const fixture of fixtures) {
      const allowed = getAllowedAdminAICommands(fixture.profile, allCommands);
      const personalized = personalizeAdminAICommands(fixture.profile, allowed);
      const policy = getAdminAIRolePersonalization(fixture.profile);

      expect(policy.preferredCommandIds).toEqual(
        expect.arrayContaining(fixture.expectedCommandIds)
      );
      expect(personalized.map((command) => command.id)).toEqual(
        expect.arrayContaining(fixture.expectedCommandIds)
      );
      for (const id of fixture.expectedCommandIds) {
        const item = command(id);
        expect(
          fixture.profile.isOwner ||
            (item.requiredPermissions || []).every((permission) =>
              fixture.profile.permissions?.includes(permission)
            )
        ).toBe(true);
      }
    }

    const nonOwnerWithAdminPermission: AdminV2AccessProfileClient = {
      email: "not-owner@example.com",
      isOwner: false,
      permissions: ["admin_users.manage", "overview.view"],
      role: "admin",
      roleKey: "custom"
    };
    const nonOwnerIds = getAllowedAdminAICommands(nonOwnerWithAdminPermission, allCommands).map(
      (item) => item.id
    );
    expect(nonOwnerIds).not.toContain("global.security-role-review");
    expect(nonOwnerIds).not.toContain("global.financial-platform-health");
    expect(nonOwnerIds).not.toContain("global.approval-workflow");
  });

  test("classifies reports and draft preparation as Level 1 while advisory suggestions stay Level 0", () => {
    const levelOneDrafts = [
      ...allCommands.filter((item) => item.kind === "report" && item.approvalLevel === 1),
      command("settings.prepare-change"),
      command("coach-sites.prepare-bulk-action"),
      command("create-coach-site.prepare-create")
    ];

    for (const item of levelOneDrafts) {
      expect(item.type).toBe("suggest");
      expect(item.approvalLevel).toBe(1);
      expect(item.executionContract.availability).toBe("not-applicable");
      expect(item.handlerId).toBeUndefined();
      expect(requiresAdminAIConfirmation(item)).toBe(true);
      expect(getAdminAIConfirmationCopy(item).confirmLabel).toBe("Apply suggestion");
    }

    const advisorySuggestion = command("overview.next-action");
    expect(advisorySuggestion.approvalLevel).toBe(0);
    expect(requiresAdminAIConfirmation(advisorySuggestion)).toBe(false);
  });

  test("keeps ephemeral previews and validation at Level 0 without weakening formal proposals", () => {
    const levelZero = [
      command("overview.preview-report"),
      command("overview.safe-validation"),
      command("create-coach-site.preview-draft-text"),
      command("overview.next-action")
    ];

    for (const item of levelZero) {
      expect(item.approvalLevel).toBe(0);
      expect(item.executionContract.availability).toBe("not-applicable");
      expect(item.handlerId).toBeUndefined();
      expect(requiresAdminAIConfirmation(item)).toBe(false);
    }

    expect(command("overview.report").approvalLevel).toBe(1);
    expect(requiresAdminAIConfirmation(command("overview.report"))).toBe(true);
  });

  test("keeps Level 0 immediate and Level 2/3 protected even if a payload claims a lower level", () => {
    const level0 = command("overview.summarize");
    const level0Suggestion = command("overview.next-action");
    const level2 = command("error-reports.mark-reviewing");
    const level2Setting = command("settings.update-proactive-suggestions");
    const level3 = command("coach-sites.prepare-archive");

    expect(requiresAdminAIConfirmation(level0)).toBe(false);
    expect(requiresAdminAIConfirmation(level0Suggestion)).toBe(false);
    expect(requiresAdminAIConfirmation(level2)).toBe(true);
    expect(requiresAdminAIConfirmation(level2Setting)).toBe(true);
    expect(requiresAdminAIConfirmation(level3)).toBe(true);
    expect(getAdminAIConfirmationCopy(level2).confirmLabel).toBe("Confirm action");
    expect(getAdminAIConfirmationCopy(level2Setting).confirmLabel).toBe("Confirm action");
    expect(getAdminAIConfirmationCopy(level3).confirmLabel).toBe("Continue to protected workflow");

    expect(requiresAdminAIConfirmation({ ...level2, approvalLevel: 0 })).toBe(true);
    expect(requiresAdminAIConfirmation({ ...level2Setting, approvalLevel: 0 })).toBe(true);
    expect(getAdminAIConfirmationCopy({ ...level3, approvalLevel: 0 }).confirmLabel).toBe(
      "Continue to protected workflow"
    );
  });

  test("exposes the bounded settings mutation only with settings support permission", () => {
    const settingsAction = command("settings.update-proactive-suggestions");
    const support = profileFor("support");
    const noSettingsPermission: AdminV2AccessProfileClient = {
      email: "reports-only@example.com",
      isOwner: false,
      permissions: ["error_reports.view", "error_reports.mark_status"],
      role: "admin",
      roleKey: "custom"
    };

    expect(getAllowedAdminAICommands(support, [settingsAction])).toEqual([settingsAction]);
    expect(getAllowedAdminAICommands(noSettingsPermission, [settingsAction])).toEqual([]);
  });

  test("keeps Level 1 settings and bulk drafts non-executable without registering mutations", () => {
    const prepared = [
      command("settings.prepare-change"),
      command("coach-sites.prepare-bulk-action")
    ];

    for (const item of prepared) {
      expect(item.type).toBe("suggest");
      expect(item.approvalLevel).toBe(1);
      expect(item.executionContract.availability).toBe("not-applicable");
      expect(item.executionContract.maxBatchSize).toBe(0);
      expect(item.handlerId).toBeUndefined();
      expect(requiresAdminAIConfirmation(item)).toBe(true);
      expect(getAdminAIConfirmationCopy(item).confirmLabel).toBe("Apply suggestion");
    }
    expect(command("coach-sites.prepare-bulk-action").inputSchema).toEqual({
      selectedIds: "string[]"
    });
  });

  test("keeps delete and revoke-admin as Owner-only OTP-protected Level 3 navigation", () => {
    const protectedCommands = [
      command("admin-users.prepare-delete-admin"),
      command("admin-users.prepare-revoke-admin")
    ];

    for (const item of protectedCommands) {
      expect(item).toMatchObject({
        approvalLevel: 3,
        confirmationRequired: true,
        destinationView: "admin-users",
        kind: "navigate",
        otpRequired: true,
        ownerOnly: true,
        requiredPermissions: ["admin_users.manage"],
        rollback: "not-available",
        type: "dangerous"
      });
      expect(item.executionContract.availability).toBe("review-only");
      expect(item.handlerId).toBeUndefined();
    }

    const nonOwner = profileFor("custom");
    nonOwner.permissions = ["admin_users.manage"];
    expect(getAllowedAdminAICommands(nonOwner, protectedCommands)).toEqual([]);
    expect(
      getAllowedAdminAICommands(
        {
          email: "owner@example.com",
          isOwner: true,
          permissions: [],
          role: "owner",
          roleKey: "owner"
        },
        protectedCommands
      )
    ).toEqual(protectedCommands);
  });

  test("labels the AI recommendation and impact before approval", () => {
    const protectedRecommendation = command("settings.update-proactive-suggestions");
    const source = readFileSync(
      resolve(process.cwd(), "components/admin/admin-ai/AdminAIActionConfirm.tsx"),
      "utf8"
    );

    expect(protectedRecommendation.approvalLevel).toBe(2);
    expect(source).toContain("<dt>Recommended by AI</dt>");
    expect(source).toContain("<dt>Impact</dt>");
  });

  test("explains unavailable capability boundaries without leaking hidden permissions", () => {
    const hidden = command("global.security-role-review");
    const support = profileFor("support");
    const availability = getAdminAICommandAvailability(support, hidden);
    const reason = getAdminAIUnavailableCapabilityReason(support, [hidden]);

    expect(availability).toEqual({
      available: false,
      reason: "Your current admin role cannot use this capability."
    });
    expect(reason).toBe("Your current admin role cannot use this capability.");
    expect(availability.reason).not.toContain("admin_users.manage");
    expect(availability.reason).not.toContain(hidden.id);
    expect(reason).not.toContain("admin_users.manage");
    expect(reason).not.toContain(hidden.id);
    expect(
      getAdminAIUnavailableCapabilityReason(
        support,
        getAllowedAdminAICommands(support, allCommands)
      )
    ).toBeNull();
  });
});

function command(id: string): AdminAICommand {
  const match = allCommands.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing Admin AI command: ${id}`);
  return match;
}

function profileFor(roleKey: string): AdminV2AccessProfileClient {
  return {
    email: `${roleKey}@example.com`,
    isOwner: false,
    permissions: roleTemplate(roleKey).permissions,
    role: "admin",
    roleKey
  };
}

function roleTemplate(roleKey: string) {
  const template = ADMIN_ROLE_TEMPLATES.find((candidate) => candidate.key === roleKey);
  if (!template) throw new Error(`Missing admin role template: ${roleKey}`);
  return template;
}
