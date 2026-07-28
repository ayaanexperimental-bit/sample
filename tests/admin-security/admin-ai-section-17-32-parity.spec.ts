import { expect, test } from "@playwright/test";
import type {
  AdminAIRegisteredActionView,
  AdminAISectionContext
} from "../../lib/admin-ai/adminAIContext";
import { getAdminAIFeatureFlags } from "../../lib/admin-ai/adminAIFeatureFlags";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import { runAdminAINaturalLanguageQuery } from "../../lib/admin-ai/adminAIOrchestrator";
import { getAdminAICommand } from "../../lib/admin-ai/adminAIRegistry";
import type { AdminAIEntity } from "../../lib/admin-ai/adminAITypes";

const NOW = "2026-07-22T08:00:00.000Z";

test.describe("Admin AI Sections 17-32 parity", () => {
  test("finds metric-backed high-traffic sites with below-baseline registration", () => {
    const context = createContext({
      entities: [
        site("site-alpha", "Alpha", "published registration form ready public route healthy"),
        analytics("analytics-alpha", "Alpha", 200, 2),
        site("site-beta", "Beta", "published registration form ready public route healthy"),
        analytics("analytics-beta", "Beta", 50, 10)
      ]
    });
    const response = ask(context, "Which coach sites have high traffic but low registration clicks?");

    expect(response.title).toBe("High-traffic low-registration sites");
    expect(response.searchResults?.map(({ id }) => id)).toEqual(["site-alpha"]);
    expect(response.items).toEqual([
      expect.stringContaining("Alpha: 200 visits; 2 registration clicks; 1% conversion")
    ]);
  });

  test("returns only unresolved high-severity Shop-linked errors", () => {
    const context = createContext({
      entities: [
        entity("ORDER-9", "Paid Shop order", "shop", "paid publish failed"),
        entity(
          "ERR-9",
          "Shop publish exception",
          "error-reports",
          "unresolved high severity Shop ORDER-9 publish error"
        ),
        entity(
          "ERR-FIXED",
          "Resolved Shop exception",
          "error-reports",
          "fixed high severity Shop ORDER-9"
        )
      ]
    });
    context.entities[2].status = "Fixed";
    const response = ask(context, "Show me unresolved high-severity errors connected to Shop.");

    expect(response.title).toBe("Unresolved high-severity Shop errors");
    expect(response.searchResults?.map(({ id }) => id)).toEqual(["ERR-9"]);
    expect(JSON.stringify(response)).not.toContain("ERR-FIXED");
  });

  test("finds sites with a missing form, broken public route, or no linked analytics", () => {
    const context = createContext({
      entities: [
        site("site-alpha", "Alpha", "registration form missing public route healthy"),
        analytics("analytics-alpha", "Alpha", 20, 1),
        site("site-beta", "Beta", "registration form ready public route 404 error"),
        analytics("analytics-beta", "Beta", 20, 1),
        site("site-gamma", "Gamma", "registration form ready public route healthy"),
        site("site-delta", "Delta", "registration form ready public route healthy"),
        analytics("analytics-delta", "Delta", 20, 1)
      ]
    });
    const response = ask(
      context,
      "Find sites with missing forms, broken public links, or no analytics."
    );

    expect(response.title).toBe("Coach-site health exceptions");
    expect(response.searchResults?.map(({ id }) => id)).toEqual([
      "site-alpha",
      "site-beta",
      "site-gamma"
    ]);
    expect(JSON.stringify(response)).not.toContain("Delta");
  });

  test("creates a grounded generic checklist without preparing a mutation", () => {
    const context = createContext({
      errors: ["Shop publish failed"],
      warnings: ["Registration form is missing"]
    });
    const response = ask(context, "Create a checklist for this page", "module");

    expect(response.artifact).toMatchObject({ type: "checklist" });
    expect(response.artifact?.content).toContain("- [ ] Registration form is missing");
    expect(response.artifact?.content).toContain("- [ ] Shop publish failed");
    expect(response.plan).toBeUndefined();
  });

  test("enumerates safe and confirmation-required actions in the registration workflow", () => {
    const context = createContext({
      entities: [
        site("site-alpha", "Alpha", "registration form missing public route healthy"),
        analytics("analytics-alpha", "Alpha", 100, 0),
        entity("ORDER-ALPHA", "Alpha Shop order", "shop", "alpha paid publish failed")
      ],
      registeredActions: [
        registeredAction("coach-sites.check-links"),
        registeredAction("shop.retry-publish")
      ]
    });
    const response = ask(context, "Check why Alpha is not receiving registrations.");

    expect(response.items).toContain("Registration destination: missing");
    expect(response.items).toContain("Safe actions available: Check registration links.");
    expect(response.items).toContain(
      "Actions requiring confirmation: Retry paid-order publish."
    );
  });

  test("recommends a verified backup for a relevant irreversible cleanup plan", () => {
    const context = createContext({
      registeredActions: [registeredAction("backup-cleanup.prepare-cleanup")],
      sectionId: "backup-cleanup",
      sectionName: "Backup and Cleanup"
    });
    const response = ask(context, "Cleanup old analytics records", "module");

    expect(response.plan?.reversible).toBe(false);
    expect(response.plan?.rollback).toContain("Verify a current backup before approval");
    expect(response.plan?.risks).toContain("Verify a current backup before approval.");
  });
});

function ask(
  context: AdminAISectionContext,
  query: string,
  scope: "global" | "module" = "global"
) {
  return runAdminAINaturalLanguageQuery({
    context,
    featureFlags: getAdminAIFeatureFlags(),
    preferences: DEFAULT_ADMIN_AI_PREFERENCES,
    query,
    scope
  });
}

function createContext(
  overrides: Partial<AdminAISectionContext> = {}
): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: [],
    currentRoute: "/admin/dashboard?view=overview",
    dataFreshness: `Fresh as of ${NOW}`,
    dateRange: "Last 7 days",
    emptyState: false,
    entities: [],
    errors: [],
    filters: {},
    globalContext: {
      emptyState: false,
      errors: [],
      registeredActions: [],
      relatedAPIs: [],
      visibleDataSummary: [],
      warnings: []
    },
    isOwner: true,
    lastUpdated: NOW,
    loadingState: false,
    knowledge: [],
    permissions: [],
    registeredActions: [],
    relatedAPIs: [],
    sectionId: "overview",
    sectionName: "Admin Overview",
    selectedRows: [],
    userRole: "owner",
    visibleDataSummary: [{ label: "Visible records", source: "test", value: 1 }],
    warnings: [],
    ...overrides
  };
}

function registeredAction(id: string): AdminAIRegisteredActionView {
  const command = getAdminAICommand(id);
  if (!command) throw new Error(`Missing registered command: ${id}`);
  return {
    id: command.id,
    label: command.label,
    relatedAPI: command.kind === "registered-action" ? "/api/admin/ai-actions" : null,
    requiredPermissions: command.requiredPermissions || [],
    searchText: `${command.id} ${command.label} ${command.description}`,
    type: command.type
  };
}

function site(id: string, label: string, facts: string) {
  return entity(id, label, "coach-sites", facts);
}

function analytics(id: string, label: string, visits: number, registrations: number) {
  return entity(
    id,
    `${label} analytics`,
    "coach-analytics",
    `${label} ${visits} visits and ${registrations} registration clicks`
  );
}

function entity(
  id: string,
  label: string,
  module: AdminAIEntity["module"],
  facts: string
): AdminAIEntity {
  return {
    id,
    label,
    matchReason: facts,
    module,
    route: `/admin/dashboard?view=${module}`,
    searchableText: facts.toLowerCase(),
    source: module,
    status: facts,
    updatedAt: NOW
  };
}
