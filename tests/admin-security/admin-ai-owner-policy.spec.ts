import { expect, test } from "@playwright/test";
import {
  DEFAULT_ADMIN_AI_OWNER_POLICY,
  applyAdminAIResponsePolicy,
  evaluateAdminAIRequestPolicy,
  getAdminAIRetentionCutoff,
  redactAdminAIValue,
  resolveAdminAIModelPolicy,
  scopeAdminAICommandsByOwnerPolicy,
  shouldAuditAdminAIEvent
} from "../../lib/admin-ai/adminAIPolicy";
import {
  DEFAULT_ADMIN_AI_PREFERENCES,
  applyApprovedAdminAIPreferenceCorrections
} from "../../lib/admin-ai/adminAIMemory";
import {
  indexAdminAIKnowledge,
  type AdminAIKnowledgeDocument
} from "../../lib/admin-ai/adminAIKnowledge";

test.describe("Admin AI persisted owner-policy enforcement", () => {
  test("gates commands, features, and both durable usage ceilings", () => {
    const policy = {
      ...DEFAULT_ADMIN_AI_OWNER_POLICY,
      actionPermissions: { dangerousEnabled: false, readEnabled: true, writeEnabled: false },
      featureAvailability: {
        ...DEFAULT_ADMIN_AI_OWNER_POLICY.featureAvailability,
        dailyBriefing: false
      },
      usageLimits: {
        ...DEFAULT_ADMIN_AI_OWNER_POLICY.usageLimits,
        dailyRequestsPerAdmin: 2,
        monthlyRequestsGlobal: 5
      }
    };
    const commands = [
      { id: "read", type: "read" as const },
      { id: "write", type: "write" as const },
      { id: "dangerous", type: "dangerous" as const },
      {
        executionContract: { availability: "review-only" as const },
        id: "dangerous-review-only",
        type: "dangerous" as const
      },
      { id: "briefing", reportTitle: "Daily Admin Briefing", type: "suggest" as const }
    ];

    expect(scopeAdminAICommandsByOwnerPolicy(commands, policy).map(({ id }) => id)).toEqual([
      "read",
      "dangerous-review-only"
    ]);
    expect(
      evaluateAdminAIRequestPolicy(policy, {
        actionType: "read",
        usage: { dailyRequestsPerAdmin: 2, monthlyRequestsGlobal: 4 }
      })
    ).toMatchObject({ allowed: false, code: "daily-limit" });
    expect(
      evaluateAdminAIRequestPolicy(policy, {
        actionType: "read",
        usage: { dailyRequestsPerAdmin: 1, monthlyRequestsGlobal: 5 }
      })
    ).toMatchObject({ allowed: false, code: "monthly-limit" });
    expect(
      evaluateAdminAIRequestPolicy(policy, {
        actionType: "read",
        feature: "dailyBriefing",
        usage: { dailyRequestsPerAdmin: 1, monthlyRequestsGlobal: 4 }
      })
    ).toMatchObject({ allowed: false, code: "feature-disabled" });
  });

  test("applies model, token, audit, artifact, and retention policy deterministically", () => {
    const policy = {
      ...DEFAULT_ADMIN_AI_OWNER_POLICY,
      auditConfiguration: {
        enabled: true,
        recordDeniedAttempts: true,
        recordReadEvents: false,
        retentionDays: 7
      },
      featureAvailability: {
        ...DEFAULT_ADMIN_AI_OWNER_POLICY.featureAvailability,
        artifacts: false
      },
      modelRouting: {
        complexModel: "owner-complex",
        defaultModel: "owner-default",
        fallbackModel: "owner-fallback"
      },
      retentionPeriodDays: 30,
      usageLimits: {
        ...DEFAULT_ADMIN_AI_OWNER_POLICY.usageLimits,
        maxTokensPerRequest: 900
      }
    };

    expect(resolveAdminAIModelPolicy(policy, "fast", 2_000)).toEqual({
      maxOutputTokens: 900,
      model: "owner-default"
    });
    expect(resolveAdminAIModelPolicy(policy, "reasoning", 700)).toEqual({
      maxOutputTokens: 700,
      model: "owner-complex"
    });
    expect(resolveAdminAIModelPolicy(policy, "fast", 500, true).model).toBe("owner-fallback");
    expect(shouldAuditAdminAIEvent(policy, { actionType: "read", phase: "completed" })).toBe(false);
    expect(shouldAuditAdminAIEvent(policy, { actionType: "write", phase: "completed" })).toBe(true);
    expect(shouldAuditAdminAIEvent(policy, { actionType: "read", phase: "denied" })).toBe(true);
    const retentionNow = Date.UTC(2026, 6, 21);
    const fixedRetentionCutoff = retentionNow - 90 * 24 * 60 * 60 * 1000;
    expect(getAdminAIRetentionCutoff(policy, "audit", retentionNow)).toBe(fixedRetentionCutoff);
    expect(getAdminAIRetentionCutoff(policy, "general", retentionNow)).toBe(fixedRetentionCutoff);
    expect(
      applyAdminAIResponsePolicy(
        { artifact: { id: "private-report" }, body: "Safe", items: [], title: "Report" },
        policy
      )
    ).not.toHaveProperty("artifact");
  });

  test("recursively redacts nested secret and PII values without changing safe fields", () => {
    const redacted = redactAdminAIValue({
      authorization: "Bearer owner-secret-token",
      nested: [
        { email: "owner@example.com", note: "Call +91 98765 43210" },
        { card: "4111 1111 1111 1111", safe: "42 active sites" }
      ],
      profile: { apiKey: "sk_live_1234567890123456", name: "Operations" }
    });

    expect(redacted).toEqual({
      authorization: "[REDACTED]",
      nested: [
        { email: "[REDACTED]", note: "Call [REDACTED]" },
        { card: "[REDACTED]", safe: "42 active sites" }
      ],
      profile: { apiKey: "[REDACTED]", name: "Operations" }
    });
  });

  test("preserves server-issued Admin AI identifiers while redacting adjacent PII", () => {
    const auditReference = "admin-ai-62e6bf78-8279-4272-8d32-2758203b868d";
    const receiptId = "admin-ai-receipt-71dd9a8f-0df6-4b42-9dda-a52ec5c440e6";

    expect(
      redactAdminAIValue({
        approvalReceipt: { auditReference, requestedBy: "owner@example.com" },
        rollbackAction: { receiptId }
      })
    ).toEqual({
      approvalReceipt: { auditReference, requestedBy: "[REDACTED]" },
      rollbackAction: { receiptId }
    });
  });

  test("consumes only owner-approved structured corrections for safe preferences", () => {
    const corrected = applyApprovedAdminAIPreferenceCorrections(DEFAULT_ADMIN_AI_PREFERENCES, [
      {
        automaticRetraining: false,
        category: "preferred-wording",
        correction: JSON.stringify({ preferredLanguage: "hi", responseLength: "detailed" }),
        reviewStatus: "approved",
        securityOverride: false
      },
      {
        automaticRetraining: false,
        category: "workflow-preference",
        correction: JSON.stringify({ dailyBriefing: true, notificationPreference: "both" }),
        reviewStatus: "pending",
        securityOverride: false
      },
      {
        automaticRetraining: false,
        category: "workflow-preference",
        correction: JSON.stringify({ enabled: false, memoryEnabled: false }),
        reviewStatus: "approved",
        securityOverride: false
      },
      {
        automaticRetraining: false,
        category: "workflow-preference",
        correction: JSON.stringify({ dailyBriefing: true, notificationPreference: "email" }),
        reviewStatus: "approved",
        securityOverride: false
      }
    ]);

    expect(corrected).toMatchObject({
      dailyBriefing: true,
      enabled: true,
      memoryEnabled: true,
      notificationPreference: "email",
      preferredLanguage: "hi",
      responseLength: "detailed"
    });
  });

  test("indexes only owner-approved local source content and never fetches source URLs", () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("Knowledge indexing must not fetch URLs");
    };
    try {
      const index = indexAdminAIKnowledge(
        [
          knowledgeDocument("approved-internal", "runbooks", "Internal approved content"),
          knowledgeDocument("approved-public", "public-doc", "Public content supplied locally"),
          knowledgeDocument("unapproved", "other-source", "Must not be indexed")
        ],
        {
          approvedSources: [
            { id: "runbooks", label: "Runbooks", type: "internal" },
            {
              id: "public-doc",
              label: "Public docs",
              type: "public-url",
              url: "https://docs.example.com/admin"
            }
          ],
          now: "2026-07-21T00:00:00.000Z"
        }
      );

      expect(index.chunks.map(({ citation }) => citation.sourceId)).toEqual([
        "runbooks",
        "public-doc"
      ]);
      expect(index.rejected).toContainEqual({
        documentId: "unapproved",
        reason: "unapproved-source"
      });
      expect(JSON.stringify(index)).not.toContain("Must not be indexed");
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function knowledgeDocument(
  id: string,
  sourceId: string,
  content: string
): AdminAIKnowledgeDocument {
  return {
    approved: true,
    category: "operational-runbooks",
    content,
    effectiveAt: "2026-07-20T00:00:00.000Z",
    id,
    section: "Operations",
    source: "Locally supplied source content",
    sourceId,
    title: id,
    version: "1.0.0"
  };
}
