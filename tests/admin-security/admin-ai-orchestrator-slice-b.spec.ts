import { expect, test } from "@playwright/test";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import { getAdminAIFeatureFlags } from "../../lib/admin-ai/adminAIFeatureFlags";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import {
  getAdminAIReportSizeInput,
  parseAdminAISearchQuery,
  runAdminAINaturalLanguageQuery,
  runAdminAINaturalLanguageQueryWithModel,
  searchAdminAIEntities,
  simulateAdminAIPlan
} from "../../lib/admin-ai/adminAIOrchestrator";
import { getAdminAICommand } from "../../lib/admin-ai/adminAIRegistry";

const NOW = new Date("2026-07-21T12:00:00.000Z");

test.describe("Admin AI Slice B orchestration", () => {
  test("parses and applies bounded typed date, status, module, entity, and required-term filters", () => {
    const context = createContext();
    const parsed = parseAdminAISearchQuery("Show unpublished sites created this month", NOW);

    expect(parsed).toMatchObject({
      dateRange: {
        end: "2026-07-21T12:00:00.000Z",
        start: "2026-07-01T00:00:00.000Z"
      },
      module: "coach-sites",
      statuses: ["unpublished"]
    });
    expect(
      searchAdminAIEntities(context, "Show unpublished sites created this month", "global", {
        now: NOW
      }).map(({ id }) => id)
    ).toEqual(["site-gyana"]);

    const cases = [
      ["Show admins with payment permissions", ["admin-payments"]],
      ["Find backups that failed", ["backup-2026-07-20"]],
      ["Show coaches whose public site returns an error", ["site-gyana"]],
      ["Show errors related to analytics during the last seven days", ["ERR-ANALYTICS"]]
    ] as const;
    for (const [query, ids] of cases) {
      expect(
        searchAdminAIEntities(context, query, "global", { now: NOW }).map(({ id }) => id),
        query
      ).toEqual(ids);
    }
  });

  test("matches high-confidence admin concepts without requiring exact query tokens", () => {
    const context = createContext();
    const cases = [
      ["Find unreleased webpages created this month", ["site-gyana"]],
      ["Find staff authorized to handle billing", ["admin-payments"]],
      ["Find recovery snapshots that did not complete", ["backup-2026-07-20"]],
      ["Find telemetry faults during the last seven days", ["ERR-ANALYTICS"]]
    ] as const;

    for (const [query, ids] of cases) {
      expect(
        searchAdminAIEntities(context, query, "global", { now: NOW }).map(({ id }) => id),
        query
      ).toEqual(ids);
    }
  });

  test("rejects weak semantic matches and filters inaccessible scopes before ranking", () => {
    const context = createContext();

    expect(searchAdminAIEntities(context, "Show operational things", "global")).toEqual([]);
    expect(searchAdminAIEntities(context, "Show billing", "global")).toEqual([]);
    expect(
      searchAdminAIEntities(context, "Find staff authorized to handle billing", "page")
    ).toEqual([]);
    expect(
      searchAdminAIEntities(
        { ...context, selectedRows: ["site-healthy"] },
        "Find unreleased webpages",
        "selection"
      )
    ).toEqual([]);
  });

  test("joins the selected coach site to registration, route, analytics, error, and payment evidence", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: { ...createContext(), selectedRows: ["site-gyana"] },
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Check why this Gyana coach site is not receiving registrations",
      scope: "selection"
    });

    expect(response.title).toBe("Registration workflow investigation");
    expect(response.items).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Site publish status: draft"),
        expect.stringContaining("Public route availability: error"),
        expect.stringContaining("Registration destination: missing"),
        expect.stringContaining("Registration analytics: 0 registration clicks"),
        expect.stringContaining("Recent errors: 1 related error"),
        expect.stringContaining("Related payment state: ORDER-9")
      ])
    );
    expect(response.artifact?.content).not.toContain("Healthy Site");
  });

  test("routes a selected-site performance question through the dedicated evidence analyzer", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: { ...createContext(), selectedRows: ["site-gyana"] },
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Explain why the selected site may not be performing",
      scope: "selection"
    });

    expect(response.title).toBe("Selected-site performance explanation");
    expect(response.items).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Visits changed -20%"),
        expect.stringContaining("publish state")
      ])
    );
    expect(JSON.stringify(response)).not.toContain("Healthy Site");
  });

  test("flags only permission-visible Shop records that identify themselves as mock or test data", () => {
    const context = createContext();
    context.sectionId = "shop";
    context.sectionName = "Shop";
    context.entities.push(
      entity({
        id: "ORDER-TEST-1",
        label: "Sandbox test order",
        matchReason: "Visible sandbox checkout record.",
        module: "shop",
        route: "/admin/dashboard?view=shop&order=ORDER-TEST-1",
        searchableText: "sandbox test order visible checkout",
        status: "test",
        updatedAt: "2026-07-21T10:00:00.000Z"
      })
    );

    const response = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Flag visible mock or test data",
      scope: "page"
    });

    expect(response.title).toBe("Visible Shop test-data review");
    expect(response.items).toEqual(["Sandbox test order (ORDER-TEST-1): test"]);
    expect(JSON.stringify(response)).not.toContain("Payments Admin");
  });

  test("uses approved safe memory to prioritize duplicate-error recommendations and triage", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: {
        ...DEFAULT_ADMIN_AI_PREFERENCES,
        safeLearning: {
          ...DEFAULT_ADMIN_AI_PREFERENCES.safeLearning,
          copyStyle: "direct",
          recommendationPriorities: ["reliability"],
          repeatedIssues: [{ category: "authentication", occurrences: 4 }]
        }
      },
      query: "Recommend the next action for duplicate authentication errors",
      scope: "page"
    });

    expect(response.items[0]).toBe(
      "Triage authentication first (4 approved occurrences; reliability priority)."
    );
  });

  test("prepares a concrete paid-order recovery join but keeps execution behind registered safety", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags({ actions: true, sensitiveActions: true }),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Resolve paid Shop order ORDER-9 that was paid but not published",
      scope: "global"
    });

    expect(response.title).toBe("Review paid-order recovery plan");
    expect(response.plan).toMatchObject({
      confirmationRequired: true,
      executable: true,
      permissions: ["shop.recovery"]
    });
    expect(response.plan?.affectedRecords).toEqual(
      expect.arrayContaining(["ORDER-9", "Gyana Shop Draft", "Publish error / ERR-SHOP"])
    );
    expect(response.plan?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionId: "shop.retry-publish", mutation: true, status: "ready" })
      ])
    );
    expect(response.items).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Server-side payment state: succeeded"),
        expect.stringContaining("Associated draft: Gyana Shop Draft"),
        expect.stringContaining("Publish readiness: ready"),
        expect.stringContaining("Recent errors: 1 related error")
      ])
    );
  });

  test("investigates publish-failure settings from linked allowlisted evidence without a plan", () => {
    const context = createContext();
    const error = context.entities.find(({ id }) => id === "ERR-SHOP")!;
    error.searchableText = [
      "order-9 draft-9 publish retry error",
      "registration URL: https://forms.example/gyana",
      "coach name: Gyana Wellness",
      "niche: sustainable nutrition",
      "slug: gyana-wellness",
      "support email: support@example.com",
      "support WhatsApp: +91 98765 43210",
      "hero media: missing",
      "api key: MUST-NOT-LEAK"
    ].join("; ");

    const response = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags({ actions: true, sensitiveActions: true }),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Find settings that may be causing publish failures",
      scope: "global"
    });

    expect(response.title).toBe("Publish-failure settings investigation");
    expect(response.state).toBe("ready");
    expect(response.body).toContain("evidence-backed correlations");
    expect(response.body).toContain("not proven causation");
    expect(response.items).toEqual(
      expect.arrayContaining([
        "Registration URL: https://forms.example/gyana",
        "Coach name: Gyana Wellness",
        "Niche: sustainable nutrition",
        "Slug: gyana-wellness",
        "Support email: support@example.com",
        "Support phone/WhatsApp: +91 98765 43210",
        "Hero media: missing"
      ])
    );
    expect(response.plan).toBeUndefined();
    expect(response.artifact).toBeUndefined();
    expect(response.approvalReceipt).toBeUndefined();
    expect(response.evidence?.flatMap(({ entityReferences }) => entityReferences || [])).toEqual(
      expect.arrayContaining(["ORDER-9", "ERR-SHOP"])
    );
    expect(response.evidence?.every(({ module }) => ["shop", "error-reports"].includes(module))).toBe(
      true
    );
    expect(JSON.stringify(response)).not.toContain("MUST-NOT-LEAK");
  });

  test("reports missing data when no failed Shop publish has linked error evidence", () => {
    const context = createContext();
    context.entities = context.entities.filter(({ id }) => id !== "ERR-SHOP");

    const response = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Find settings that may be causing publish failures",
      scope: "global"
    });

    expect(response.title).toBe("Publish-failure settings investigation");
    expect(response.state).toBe("missing-data");
    expect(response.body).toContain("No linked permission-visible error evidence");
    expect(response.plan).toBeUndefined();
    expect(response.approvalReceipt).toBeUndefined();
  });

  test("returns exactly three metric-backed worst-performing permission-visible sites", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: continuousWorkflowContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Identify the three worst-performing sites from Analytics",
      scope: "global"
    });

    expect(response.title).toBe("Three worst-performing sites");
    expect(response.state).toBe("ready");
    expect(response.searchResults?.map(({ id }) => id)).toEqual([
      "site-alpha",
      "site-beta",
      "site-gamma"
    ]);
    expect(response.items).toEqual([
      "Alpha: 1% conversion",
      "Beta: 2% conversion",
      "Gamma: 5% conversion"
    ]);
    expect(response.evidence?.flatMap(({ entityReferences }) => entityReferences || [])).toEqual(
      expect.arrayContaining(["analytics-alpha", "analytics-beta", "analytics-gamma"])
    );
    expect(response.plan).toBeUndefined();
  });

  test("refuses to fabricate a top three when fewer metric-backed sites are visible", () => {
    const context = continuousWorkflowContext();
    context.entities = context.entities.filter(
      ({ id }) => !["site-gamma", "analytics-gamma", "site-delta", "analytics-delta"].includes(id)
    );
    const response = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Identify the three worst-performing sites from Analytics",
      scope: "global"
    });

    expect(response.state).toBe("missing-data");
    expect(response.body).toContain("Only 2 metric-backed permission-visible sites are available");
    expect(response.searchResults).toHaveLength(2);
    expect(response.items).toHaveLength(2);
    expect(JSON.stringify(response)).not.toContain("Gamma");
    expect(JSON.stringify(response)).not.toContain("Delta");
  });

  test("reports selected-site form and image readiness without guessing missing facts", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: {
        ...continuousWorkflowContext(),
        selectedRows: ["site-alpha", "site-beta", "site-gamma"]
      },
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Inspect the selected sites' setup",
      scope: "selection"
    });

    expect(response.title).toBe("Selected-site setup inspection");
    expect(response.state).toBe("ready");
    expect(response.items).toEqual([
      "Alpha: form ready; images issue",
      "Beta: form issue; images ready",
      "Gamma: form unverified; images unverified"
    ]);
    expect(response.searchResults?.map(({ id }) => id)).toEqual([
      "site-alpha",
      "site-beta",
      "site-gamma"
    ]);
    expect(response.plan).toBeUndefined();
  });

  test("keeps executive reports bounded to the effective selection and records scope filters", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: { ...createContext(), selectedRows: ["ORDER-9"] },
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Generate the Monthly Growth Report",
      scope: "selection"
    });

    expect(response.artifact?.content).toContain("ORDER-9");
    expect(response.artifact?.content).not.toContain("Healthy Site");
    expect(response.artifact?.content).not.toContain("Coach sites: 2");
    expect(
      response.evidence?.every(({ entityReferences }) => entityReferences?.includes("ORDER-9"))
    ).toBe(true);
  });

  test("cannot bypass large-report confirmation through direct orchestrator callers", async () => {
    const context = createContext();
    const seed = context.entities[0];
    context.entities = Array.from({ length: 500 }, (_, index) => ({
      ...seed,
      id: `site-${index + 1}`,
      label: `Site ${index + 1}`
    }));
    for (const query of [
      "Generate the Monthly Growth Report",
      "Generate health report",
      "Generate a platform briefing"
    ]) {
      let providerCalls = 0;
      const input = {
        context,
        featureFlags: getAdminAIFeatureFlags(),
        preferences: DEFAULT_ADMIN_AI_PREFERENCES,
        providers: {
          openai: async () => {
            providerCalls += 1;
            return "Provider-assisted operational summary.";
          }
        },
        query,
        scope: "page" as const
      };

      const deterministic = runAdminAINaturalLanguageQuery(input);
      expect(deterministic.state, query).toBe("confirmation-required");
      expect(deterministic.title, query).toBe("Large report confirmation");
      expect(deterministic.artifact, query).toBeUndefined();

      const awaitingDecision = await runAdminAINaturalLanguageQueryWithModel(input);
      expect(awaitingDecision.state, query).toBe("confirmation-required");
      expect(awaitingDecision.artifact, query).toBeUndefined();
      expect(providerCalls, query).toBe(0);

      const cancelled = await runAdminAINaturalLanguageQueryWithModel({
        ...input,
        reportDecision: "cancel"
      });
      expect(cancelled.state, query).toBe("cancelled");
      expect(cancelled.artifact, query).toBeUndefined();
      expect(providerCalls, query).toBe(0);

      const continued = await runAdminAINaturalLanguageQueryWithModel({
        ...input,
        reportDecision: "continue"
      });
      expect(continued.artifact, query).toBeTruthy();
      expect(providerCalls, query).toBe(1);
    }
  });

  test("uses the effective output cap to preflight sub-500-record reports", async () => {
    const context = createContext();
    const requestedMaxOutputTokens = 131_072;
    const size = getAdminAIReportSizeInput(
      context,
      DEFAULT_ADMIN_AI_PREFERENCES,
      requestedMaxOutputTokens
    );
    let providerCalls = 0;
    const input = {
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async () => {
          providerCalls += 1;
          return "Provider-assisted operational summary.";
        }
      },
      query: "Generate health report",
      requestedMaxOutputTokens,
      scope: "page" as const
    };

    expect(size.recordCount).toBeLessThan(500);
    expect(size.requestedOutputTokens).toBe(requestedMaxOutputTokens);
    const awaitingDecision = await runAdminAINaturalLanguageQueryWithModel(input);
    expect(awaitingDecision.state).toBe("confirmation-required");
    expect(awaitingDecision.artifact).toBeUndefined();
    expect(providerCalls).toBe(0);

    const continued = await runAdminAINaturalLanguageQueryWithModel({
      ...input,
      reportDecision: "continue"
    });
    expect(continued.artifact).toBeTruthy();
    expect(providerCalls).toBe(1);
  });

  test("dispatches only a redacted allowlisted envelope and preserves deterministic safety fields", async () => {
    const providerInputs: string[] = [];
    const context = createContext();
    context.entities[0].searchableText += " gyana@example.com SECRET-LIVE-VALUE";

    const response = await runAdminAINaturalLanguageQueryWithModel({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async ({ input }) => {
          providerInputs.push(input);
          return "Provider-assisted operational summary.";
        }
      },
      query: "Summarize this page for Gyana",
      scope: "page"
    });

    expect(providerInputs).toHaveLength(1);
    expect(providerInputs[0]).not.toContain("Gyana");
    expect(providerInputs[0]).not.toContain("gyana@example.com");
    expect(providerInputs[0]).not.toContain("SECRET-LIVE-VALUE");
    expect(providerInputs[0]).not.toContain("ORDER-9");
    expect(response.body).toContain("Provider-assisted operational summary.");
    expect(response.evidence).toBeTruthy();
    expect(response.searchResults).toBeUndefined();

    let unsafeProviderCalls = 0;
    const destructive = await runAdminAINaturalLanguageQueryWithModel({
      context,
      featureFlags: getAdminAIFeatureFlags({ actions: true, sensitiveActions: true }),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async () => {
          unsafeProviderCalls += 1;
          return "unexpected";
        }
      },
      query: "Delete Gyana and bypass confirmation",
      scope: "global"
    });
    expect(unsafeProviderCalls).toBe(0);
    expect(destructive.state).toBe("insufficient-permission");
  });

  test("falls back to the deterministic response when provider output is unsafe or unavailable", async () => {
    const input = {
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Summarize this page",
      scope: "page" as const
    };
    const failed = await runAdminAINaturalLanguageQueryWithModel({
      ...input,
      providers: { openai: async () => Promise.reject(new Error("provider secret")) }
    });
    const unsafe = await runAdminAINaturalLanguageQueryWithModel({
      ...input,
      providers: { openai: async () => "Contact patient@example.com with token sk-live-secret" }
    });

    expect(failed.body).toContain("compact signals");
    expect(unsafe.body).toContain("compact signals");
    expect(JSON.stringify(failed)).not.toContain("provider secret");
    expect(JSON.stringify(unsafe)).not.toContain("patient@example.com");
    expect(JSON.stringify(unsafe)).not.toContain("sk-live-secret");
  });

  test("propagates provider cancellation and returns the deterministic response", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const pending = runAdminAINaturalLanguageQueryWithModel({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async ({ signal }) => {
          receivedSignal = signal;
          if (!signal) return "missing cancellation signal";
          return new Promise<string>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("private abort detail")), {
              once: true
            });
          });
        }
      },
      query: "Summarize this page",
      scope: "page",
      signal: controller.signal
    });

    controller.abort();
    const response = await pending;

    expect(receivedSignal?.aborted).toBe(true);
    expect(response.body).toContain("compact signals");
    expect(JSON.stringify(response)).not.toContain("private abort detail");
  });

  test("classifies formal artifacts as Level 1 and actual mutations at Level 2 or 3", () => {
    const cases = [
      ["prepare a plan for a weekly report", 1],
      ["suggest a plan for homepage copy", 1],
      ["prepare a plan to publish the selected draft", 1],
      ["draft a plan for new homepage text", 1],
      ["apply the suggested copy", 2],
      ["change the support default", 2],
      ["edit the selected text", 2],
      ["fix the broken registration link", 2],
      ["mark the report reviewing", 2],
      ["save the prepared setting", 2],
      ["update proactive suggestions", 2],
      ["regenerate the allowed section", 2],
      ["delete the selected site", 3],
      ["archive the selected site", 3],
      ["publish the selected draft", 3],
      ["unpublish the public site", 3],
      ["suspend the selected admin", 3],
      ["change this admin role to support", 3],
      ["cleanup failed backups", 3],
      ["resend the critical OTP", 3],
      ["update the payment settings", 3],
      ["change the public URL", 3]
    ] as const;

    for (const [query, approvalLevel] of cases) {
      const response = runAdminAINaturalLanguageQuery({
        context: createContext(),
        featureFlags: getAdminAIFeatureFlags({ actions: true, sensitiveActions: true }),
        preferences: DEFAULT_ADMIN_AI_PREFERENCES,
        query,
        scope: "page"
      });
      expect(response.plan?.approvalLevel, query).toBe(approvalLevel);
      if (approvalLevel === 1) {
        expect(response.plan?.confirmationRequired, query).toBe(true);
        expect(response.state, query).toBe("confirmation-required");
      }
    }

    const criticalOtp = runAdminAINaturalLanguageQuery({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags({ actions: true, sensitiveActions: true }),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "resend the critical OTP",
      scope: "page"
    });
    expect(criticalOtp.plan).toMatchObject({
      approvalLevel: 3,
      confirmationRequired: true,
      otpRequired: true
    });
  });

  test("keeps actual dangerous commands review-only even when sensitive actions are enabled", () => {
    const response = runAdminAINaturalLanguageQuery({
      context: simulationContext({
        actionId: "admin-users.prepare-role-change",
        filters: { role: "admin" },
        sectionId: "admin-users",
        selectedRows: ["admin-payments"]
      }),
      featureFlags: getAdminAIFeatureFlags({ actions: true, sensitiveActions: true }),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "change this admin role to support",
      scope: "page"
    });

    expect(response.plan).toMatchObject({ approvalLevel: 3, executable: false });
    expect(simulateAdminAIPlan(response.plan!).dryRun).toMatchObject({
      before: ["role (string): admin"],
      proposedAfter: ["role (string): support"],
      validation: "blocked"
    });
  });

  test("builds typed action-specific dry runs for every existing review category", () => {
    const cases = [
      {
        actionId: "settings.update-proactive-suggestions",
        after: "proactiveSuggestionsEnabled (boolean): false",
        before: "proactiveSuggestionsEnabled (boolean): true",
        filters: { proactiveSuggestionsEnabled: "true" },
        query: "update proactive suggestions",
        sectionId: "settings",
        selectedRows: [],
        validation: "requires-review"
      },
      {
        actionId: "coach-sites.prepare-bulk-action",
        after: "visibility (string): private",
        before: "visibility (string): public",
        filters: { visibility: "public" },
        query: "change selected site settings visibility to private",
        sectionId: "coach-sites",
        selectedRows: ["site-gyana"],
        validation: "requires-review"
      },
      {
        actionId: "create-coach-site.prepare-publish",
        after: "status (string): published",
        before: "status (string): draft",
        filters: {},
        query: "publish selected draft",
        sectionId: "create-coach-site",
        selectedRows: ["draft-9"],
        validation: "blocked"
      },
      {
        actionId: "backup-cleanup.prepare-cleanup",
        after: "cleanupMode (string): protected-review-only",
        before: "status (string): failed",
        filters: {},
        query: "cleanup failed backup",
        sectionId: "backup-cleanup",
        selectedRows: ["backup-2026-07-20"],
        validation: "blocked"
      },
      {
        actionId: "coach-sites.prepare-archive",
        after: "status (string): archived",
        before: "status (string): draft",
        filters: {},
        query: "archive selected site",
        sectionId: "coach-sites",
        selectedRows: ["site-gyana"],
        validation: "blocked"
      },
      {
        actionId: "settings.prepare-change",
        after: "supportDefault (string): WhatsApp",
        before: "supportDefault (string): Email",
        filters: { supportDefault: "Email" },
        query: "update support default to WhatsApp",
        sectionId: "settings",
        selectedRows: [],
        validation: "requires-review"
      },
      {
        actionId: null,
        after: "analyticsRetentionDays (number): 60",
        before: "analyticsRetentionDays (number): 30",
        filters: { analyticsRetentionDays: "30" },
        query: "update analytics retention days to 60",
        sectionId: "coach-analytics",
        selectedRows: [],
        validation: "blocked"
      },
      {
        actionId: "coach-sites.prepare-bulk-action",
        after: "registrationUrl (string): https://forms.example/new",
        before: "registrationUrl (string): https://forms.example/old",
        filters: { registrationUrl: "https://forms.example/old" },
        query: "fix broken registration link to https://forms.example/new",
        sectionId: "coach-sites",
        selectedRows: ["site-gyana"],
        validation: "requires-review"
      }
    ] as const;

    for (const item of cases) {
      const response = runAdminAINaturalLanguageQuery({
        context: simulationContext(item),
        featureFlags: getAdminAIFeatureFlags({ actions: true, sensitiveActions: true }),
        preferences: DEFAULT_ADMIN_AI_PREFERENCES,
        query: item.query,
        scope: "page"
      });
      const dryRun = simulateAdminAIPlan(response.plan!).dryRun!;
      expect(dryRun.before, item.query).toContain(item.before);
      expect(dryRun.proposedAfter, item.query).toContain(item.after);
      expect(dryRun.validation, item.query).toBe(item.validation);
    }
  });
});

function createContext(): AdminAISectionContext {
  return {
    analyticsSeries: [{ current: 40, label: "2026-07-20", previous: 50, registerClicks: 0 }],
    availableActions: ["Summarize this page", "Find problems", "Generate report"],
    currentRoute: "/admin/dashboard?view=coach-sites",
    dataFreshness: "Updated less than a minute ago",
    dateRange: "2026-07-01 to 2026-07-21",
    emptyState: false,
    entities: [
      entity({
        id: "site-gyana",
        label: "Gyana",
        matchReason:
          "Draft site has a missing registration link and its public route returns an error.",
        module: "coach-sites",
        route: "/admin/dashboard?view=coach-sites&coach=gyana",
        searchableText:
          "gyana draft missing registration link public route error mobile unchecked order-9",
        status: "draft",
        updatedAt: "2026-07-10T09:00:00.000Z"
      }),
      entity({
        id: "site-healthy",
        label: "Healthy Site",
        matchReason: "Published and registration ready.",
        module: "coach-sites",
        route: "/admin/dashboard?view=coach-sites&coach=healthy",
        searchableText: "healthy published registration ready public route available",
        status: "published",
        updatedAt: "2026-06-20T09:00:00.000Z"
      }),
      entity({
        id: "analytics:gyana:free",
        label: "Gyana analytics",
        matchReason: "40 visits and 0 registration clicks in the loaded range.",
        module: "coach-analytics",
        route: "/admin/dashboard?view=coach-analytics&coach=gyana",
        searchableText: "gyana visits 40 registrations 0 order-9",
        status: "active",
        updatedAt: "2026-07-20T09:00:00.000Z"
      }),
      entity({
        id: "ERR-ANALYTICS",
        label: "Analytics route error / ERR-ANALYTICS",
        matchReason: "Gyana public route returned 404.",
        module: "error-reports",
        route: "/admin/dashboard?view=error-reports&report=ERR-ANALYTICS",
        searchableText: "gyana analytics public route error 404",
        status: "high / New",
        updatedAt: "2026-07-19T09:00:00.000Z"
      }),
      entity({
        id: "ORDER-9",
        label: "ORDER-9",
        matchReason: "Payment succeeded but publish failed.",
        module: "shop",
        route: "/admin/dashboard?view=shop&order=ORDER-9",
        searchableText: "order-9 gyana payment succeeded publish failed draft-9",
        status: "payment_succeeded_publish_failed",
        updatedAt: "2026-07-20T10:00:00.000Z"
      }),
      entity({
        id: "draft-9",
        label: "Gyana Shop Draft",
        matchReason: "Draft is present and publish readiness is ready.",
        module: "coach-sites",
        route: "/admin/dashboard?view=website-creator&draft=draft-9",
        searchableText: "order-9 draft-9 gyana publish readiness ready",
        status: "draft",
        updatedAt: "2026-07-20T10:01:00.000Z"
      }),
      entity({
        id: "ERR-SHOP",
        label: "Publish error / ERR-SHOP",
        matchReason: "ORDER-9 publish retry failed.",
        module: "error-reports",
        route: "/admin/dashboard?view=error-reports&report=ERR-SHOP",
        searchableText: "order-9 draft-9 publish retry error",
        status: "high / New",
        updatedAt: "2026-07-20T10:02:00.000Z"
      }),
      entity({
        id: "admin-payments",
        label: "Payments Admin",
        matchReason: "Admin has payment permissions.",
        module: "admin-users",
        route: "/admin/dashboard?view=admin-users&admin=admin-payments",
        searchableText: "admin payment permissions active",
        status: "active",
        updatedAt: "2026-07-18T09:00:00.000Z"
      }),
      entity({
        id: "backup-2026-07-20",
        label: "Backup 2026-07-20",
        matchReason: "Backup failed.",
        module: "backup-cleanup",
        route: "/admin/dashboard?view=backup-cleanup",
        searchableText: "backup failed recovery",
        status: "failed",
        updatedAt: "2026-07-20T03:00:00.000Z"
      })
    ],
    errors: [],
    filters: { status: "all" },
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: ["/api/admin/coach-sites", "/api/admin/shop", "/api/admin/error-reports"],
      registeredActions: [],
      visibleDataSummary: [
        { label: "Coach sites", source: "coach-sites", value: 2 },
        { label: "Shop failures", source: "shop", value: 1 }
      ],
      warnings: []
    },
    lastUpdated: "2026-07-21T11:59:00.000Z",
    loadingState: false,
    knowledge: [],
    permissions: [
      "coach_sites.view",
      "coach_analytics.view",
      "error_reports.view",
      "shop.recovery"
    ],
    relatedAPIs: ["/api/admin/coach-sites", "/api/admin/shop", "/api/admin/error-reports"],
    registeredActions: [
      {
        id: "shop.retry-publish",
        label: "Retry paid-order publish",
        relatedAPI: "/api/shop/retry-publish",
        requiredPermissions: ["shop.recovery"],
        searchText: "shop retry publish paid order recovery",
        type: "write"
      }
    ],
    sectionId: "coach-sites",
    sectionName: "Coach Sites",
    selectedRows: [],
    userRole: "owner",
    visibleDataSummary: [
      { label: "Coach sites", source: "coach-sites", value: 2 },
      { label: "Published", source: "coach-sites", value: 1 },
      { label: "Shop failures", source: "shop", value: 1 }
    ],
    warnings: []
  };
}

function entity(input: Omit<AdminAISectionContext["entities"][number], "source">) {
  return { ...input, source: input.module };
}

function simulationContext(input: {
  actionId: string | null;
  filters: Record<string, string>;
  sectionId: AdminAISectionContext["sectionId"];
  selectedRows: readonly string[];
}): AdminAISectionContext {
  const command = input.actionId ? getAdminAICommand(input.actionId) : null;
  return {
    ...createContext(),
    filters: input.filters,
    permissions: command?.requiredPermissions || [],
    registeredActions: command
      ? [
          {
            id: command.id,
            label: command.label,
            relatedAPI: "/api/admin/ai-actions",
            requiredPermissions: command.requiredPermissions || [],
            searchText: `${command.id} ${command.label} ${command.description}`.toLowerCase(),
            type: command.type
          }
        ]
      : [],
    sectionId: input.sectionId,
    sectionName: input.sectionId,
    selectedRows: [...input.selectedRows]
  };
}

function continuousWorkflowContext(): AdminAISectionContext {
  const context = createContext();
  context.entities = [
    entity({
      id: "site-alpha",
      label: "Alpha",
      matchReason: "Registration form ready; images missing.",
      module: "coach-sites",
      route: "/admin/dashboard?view=coach-sites&coach=alpha",
      searchableText: "alpha form ready images missing",
      status: "published",
      updatedAt: "2026-07-21T08:00:00.000Z"
    }),
    entity({
      id: "analytics-alpha",
      label: "Alpha analytics",
      matchReason: "100 visits and 1 registration click.",
      module: "coach-analytics",
      route: "/admin/dashboard?view=coach-analytics&coach=alpha",
      searchableText: "site-alpha 100 visits 1 registration click",
      status: "active",
      updatedAt: "2026-07-21T08:01:00.000Z"
    }),
    entity({
      id: "site-beta",
      label: "Beta",
      matchReason: "Registration form missing; images ready.",
      module: "coach-sites",
      route: "/admin/dashboard?view=coach-sites&coach=beta",
      searchableText: "beta form missing; images ready",
      status: "draft",
      updatedAt: "2026-07-21T08:02:00.000Z"
    }),
    entity({
      id: "analytics-beta",
      label: "Beta analytics",
      matchReason: "100 visits and 2 registration clicks.",
      module: "coach-analytics",
      route: "/admin/dashboard?view=coach-analytics&coach=beta",
      searchableText: "site-beta 100 visits 2 registration clicks",
      status: "active",
      updatedAt: "2026-07-21T08:03:00.000Z"
    }),
    entity({
      id: "site-gamma",
      label: "Gamma",
      matchReason: "Setup facts were not loaded.",
      module: "coach-sites",
      route: "/admin/dashboard?view=coach-sites&coach=gamma",
      searchableText: "gamma setup status unavailable",
      status: "draft",
      updatedAt: "2026-07-21T08:04:00.000Z"
    }),
    entity({
      id: "analytics-gamma",
      label: "Gamma analytics",
      matchReason: "100 visits and 5 registration clicks.",
      module: "coach-analytics",
      route: "/admin/dashboard?view=coach-analytics&coach=gamma",
      searchableText: "site-gamma 100 visits 5 registration clicks",
      status: "active",
      updatedAt: "2026-07-21T08:05:00.000Z"
    }),
    entity({
      id: "site-delta",
      label: "Delta",
      matchReason: "Registration form ready; images ready.",
      module: "coach-sites",
      route: "/admin/dashboard?view=coach-sites&coach=delta",
      searchableText: "delta form ready images ready",
      status: "published",
      updatedAt: "2026-07-21T08:06:00.000Z"
    }),
    entity({
      id: "analytics-delta",
      label: "Delta analytics",
      matchReason: "100 visits and 20 registration clicks.",
      module: "coach-analytics",
      route: "/admin/dashboard?view=coach-analytics&coach=delta",
      searchableText: "site-delta 100 visits 20 registration clicks",
      status: "active",
      updatedAt: "2026-07-21T08:07:00.000Z"
    })
  ];
  return context;
}
