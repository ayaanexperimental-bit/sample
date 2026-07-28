import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "@playwright/test";
import ts from "typescript";
import { explainAdminAIAnalytics } from "../../lib/admin-ai/adminAIAnalytics";
import { inspectAdminAIBuilder } from "../../lib/admin-ai/adminAIBuilderInspection";
import { investigateAdminAIError } from "../../lib/admin-ai/adminAIErrorInvestigation";
import { buildAdminAIIncident } from "../../lib/admin-ai/adminAIIncident";
import { getAdminAICommand } from "../../lib/admin-ai/adminAIRegistry";
import {
  ADMIN_AI_REPORT_CLASSIFICATIONS,
  DAILY_ADMIN_BRIEFING_BLOCKS,
  generateAdminAIDailyBriefing,
  generateAdminAIExecutiveReport
} from "../../lib/admin-ai/adminAIReports";
import type { AdminAIResponse } from "../../lib/admin-ai/adminAIService";
import { runAdminAITableCopilot } from "../../lib/admin-ai/adminAITableCopilot";

const runtimeRequire = createRequire(__filename);
const responsePanelPath = resolve(
  process.cwd(),
  "components/admin/admin-ai/AdminAIResponsePanel.tsx"
);
const actionConfirmPath = resolve(
  process.cwd(),
  "components/admin/admin-ai/AdminAIActionConfirm.tsx"
);
const responsePanelSource = readFileSync(responsePanelPath, "utf8");
const originalTsLoader = runtimeRequire.extensions[".ts"];
const originalTsxLoader = runtimeRequire.extensions[".tsx"];
const originalCssLoader = runtimeRequire.extensions[".css"];

function compileTypeScript(module: NodeModule, filename: string) {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: filename
  }).outputText;
  (module as NodeModule & { _compile(source: string, path: string): void })._compile(
    output,
    filename
  );
}

runtimeRequire.extensions[".ts"] = compileTypeScript;
runtimeRequire.extensions[".tsx"] = compileTypeScript;
runtimeRequire.extensions[".css"] = (module) => {
  module.exports = new Proxy({}, { get: (_target, property) => String(property) });
};

const { AdminAIResponsePanel } = runtimeRequire(
  responsePanelPath
) as typeof import("../../components/admin/admin-ai/AdminAIResponsePanel");
const { AdminAIActionConfirm } = runtimeRequire(
  actionConfirmPath
) as typeof import("../../components/admin/admin-ai/AdminAIActionConfirm");

if (originalTsLoader) runtimeRequire.extensions[".ts"] = originalTsLoader;
else delete runtimeRequire.extensions[".ts"];
if (originalTsxLoader) runtimeRequire.extensions[".tsx"] = originalTsxLoader;
else delete runtimeRequire.extensions[".tsx"];
if (originalCssLoader) runtimeRequire.extensions[".css"] = originalCssLoader;
else delete runtimeRequire.extensions[".css"];

const baseResponse: AdminAIResponse = {
  body: "Grounded response body.",
  items: [],
  state: "ready",
  title: "Grounded response"
};

function renderResponse(overrides: Partial<AdminAIResponse>) {
  return renderToStaticMarkup(
    createElement(AdminAIResponsePanel, { response: { ...baseResponse, ...overrides } })
  );
}

test.describe("Admin AI structured response rendering", () => {
  test("renders Level 1 draft confirmation without exposing a mutation handler", () => {
    const command = getAdminAICommand("overview.report");
    if (!command) throw new Error("Expected the overview report command.");
    const markup = renderToStaticMarkup(
      createElement(AdminAIActionConfirm, {
        affectedRecords: [],
        command,
        currentState: "Current permission-filtered overview",
        onCancel: () => undefined,
        onConfirm: () => undefined,
        proposedState: "Prepared report draft",
        requestedBy: "owner@example.com"
      })
    );

    expect(markup).toContain("Level 1");
    expect(markup).toContain("Apply suggestion");
    expect(markup).toContain("No server handler (review only)");
    expect(markup).toContain("No direct mutation");
  });

  test("renders the exact action contract and bounded selection before confirmation", () => {
    const command = getAdminAICommand("error-reports.mark-reviewing");
    if (!command) throw new Error("Expected the registered error-report action.");
    const markup = renderToStaticMarkup(
      createElement(AdminAIActionConfirm, {
        affectedRecords: ["ERR-1", "ERR-2"],
        command,
        currentState: "Status: New",
        onCancel: () => undefined,
        onConfirm: () => undefined,
        proposedState: "Status: Reviewing",
        requestedBy: "owner@example.com"
      })
    );

    for (const text of [
      "Action ID",
      "error-reports.mark-reviewing",
      "Handler ID",
      "error-report-status-reviewing",
      "Issue classification",
      "error report status",
      "Execution availability",
      "Registered execution available",
      "Selection limit",
      "1-1 records",
      "Batch limit",
      "1 record per execution",
      "Dependencies",
      "Blocked / skipped reason",
      "1 selected record is outside this bounded action"
    ]) {
      expect(markup).toContain(text);
    }
  });

  test("renders plan identity, disabled execution reasons, records, and complete dry-run facts", () => {
    const markup = renderResponse({
      plan: {
        affectedRecords: ["ERR-1", "ERR-2"],
        approvalLevel: 2,
        confirmationRequired: true,
        dryRun: {
          before: ["ERR-1: New", "ERR-2: New"],
          dependencies: ["Durable ADMIN_DB", "Audit persistence"],
          errors: ["Only one record can be changed per execution."],
          generatedAt: "2026-07-21T12:00:00.000Z",
          proposedAfter: ["ERR-1: Reviewing"],
          publicOutputChanges: false,
          recordsSkipped: ["ERR-2"],
          validation: "blocked"
        },
        executable: false,
        expectedOutcome: "One selected report is prepared for review.",
        id: "plan-error-review",
        otpRequired: false,
        permissions: ["error_reports.mark_status"],
        request: "Mark selected report reviewing",
        reversible: true,
        risks: ["Selection exceeds the registered single-record action."],
        rollback: "Durable receipt required.",
        sectionId: "error-reports",
        steps: [
          {
            actionId: "error-reports.mark-reviewing",
            api: "/api/admin/ai-actions",
            id: "prepare",
            label: "Prepare status change",
            mutation: true,
            status: "blocked"
          }
        ],
        title: "Error report action plan"
      }
    });

    for (const text of [
      "Decision summary",
      "What changes",
      "Records",
      "Main risk",
      "Undo",
      "Review technical plan and safeguards",
      "Plan ID",
      "plan-error-review",
      "Action ID",
      "error-reports.mark-reviewing",
      "Handler ID",
      "error-report-status-reviewing",
      "Direct execution disabled",
      "Selection exceeds the registered single-record action.",
      "ERR-1",
      "ERR-2",
      "Dry-run dependencies",
      "Durable ADMIN_DB",
      "Before state",
      "ERR-1: New",
      "Proposed state",
      "ERR-1: Reviewing",
      "Skipped records",
      "Only one record can be changed per execution.",
      "2026-07-21T12:00:00.000Z"
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup.indexOf("Decision summary")).toBeLessThan(markup.indexOf("Plan ID"));
    expect(responsePanelSource).toContain("<details className={styles.planDetails}>");
  });

  test("presents Luna reasoning levels before optional routing diagnostics", () => {
    const routine = renderResponse({
      modelRoute: {
        estimatedTokenBudget: 700,
        mode: "fast",
        reason: "Routine language request."
      }
    });
    const complex = renderResponse({
      modelRoute: {
        estimatedTokenBudget: 2400,
        mode: "reasoning",
        reason: "Cross-module analysis."
      }
    });

    expect(routine).toContain("Luna · Low reasoning");
    expect(complex).toContain("Luna · Medium reasoning");
    expect(complex).toContain("Why this route?");
    expect(complex).toContain("2,400 output-token ceiling");
    expect(complex.indexOf("Luna · Medium reasoning")).toBeLessThan(
      complex.indexOf("Why this route?")
    );
  });

  test("resets transient rollback and artifact controls when response identities change", () => {
    expect(responsePanelSource).toContain("key={response.rollbackAction.receiptId}");
    expect(responsePanelSource).toContain("key={response.artifact.id}");
    expect(responsePanelSource).toMatch(
      /function AdminAIRollbackPanel[\s\S]*?const \[rollbackConfirm, setRollbackConfirm\] = useState\(false\);/
    );
    expect(responsePanelSource).toMatch(
      /function AdminAIArtifactPanel[\s\S]*?const \[artifactStatus, setArtifactStatus\] = useState\(""\);[\s\S]*?const \[artifactBusy, setArtifactBusy\] = useState\(false\);/
    );
  });

  test("uses a concise live-status node inside a normally labelled response region", () => {
    const readyMarkup = renderResponse({});
    const failedMarkup = renderResponse({
      state: "offline-error",
      title: "AI service unavailable"
    });

    expect(readyMarkup).toContain('aria-label="Admin AI response: Grounded response"');
    expect(readyMarkup).toContain('role="region"');
    expect(readyMarkup).toContain(
      '<small aria-atomic="true" role="status">Ready: Grounded response</small>'
    );
    expect(failedMarkup).toContain(
      '<small aria-atomic="true" role="alert">Unavailable: AI service unavailable</small>'
    );
    expect(failedMarkup).not.toContain('aria-live="polite"');
  });

  test("gives repeated record and action controls contextual accessible names", () => {
    const markup = renderToStaticMarkup(
      createElement(AdminAIResponsePanel, {
        onApprovePlan: () => undefined,
        onCancelPlan: () => undefined,
        onDeleteArtifact: () => undefined,
        onDryRun: () => undefined,
        onEditPlan: () => undefined,
        onRegenerate: () => undefined,
        onRollback: () => undefined,
        onSaveArtifact: () => undefined,
        onToggleSearchResult: () => undefined,
        response: {
          ...baseResponse,
          artifact: {
            content: "Grounded report content",
            createdAt: "2026-07-21T12:00:00.000Z",
            id: "artifact-report-1",
            sourceContext: "Reports / selected period",
            title: "Selected period report",
            type: "report"
          },
          plan: {
            affectedRecords: ["site-1"],
            approvalLevel: 2,
            confirmationRequired: true,
            executable: true,
            expectedOutcome: "Selected site is ready for review.",
            id: "plan-site-1",
            otpRequired: false,
            permissions: ["coach-sites.edit"],
            request: "Prepare selected coach site",
            reversible: false,
            risks: [],
            rollback: "No rollback claimed.",
            sectionId: "coach-sites",
            steps: [],
            title: "Prepare selected coach site"
          },
          rollbackAction: {
            label: "Undo reviewing status",
            receiptId: "receipt-1",
            recordId: "ERR-1"
          },
          searchResults: [
            {
              id: "site-1",
              label: "Gyana",
              matchReason: "Selected coach site",
              module: "coach-sites",
              route: "/admin/dashboard?view=coach-sites",
              status: "draft",
              updatedAt: "2026-07-21T12:00:00.000Z"
            },
            {
              id: "site-2",
              label: "Maya",
              matchReason: "Another selected coach site",
              module: "coach-sites",
              route: "/admin/dashboard?view=coach-sites",
              status: "ready",
              updatedAt: "2026-07-21T12:05:00.000Z"
            }
          ]
        },
        selectedSearchResultIds: ["site-2"]
      })
    );

    for (const name of [
      "Select Gyana record site-1",
      "Deselect Maya record site-2",
      "Approve plan Prepare selected coach site",
      "Edit plan Prepare selected coach site",
      "Run dry test for plan Prepare selected coach site",
      "Cancel plan Prepare selected coach site",
      "Undo status change for record ERR-1",
      "Copy artifact Selected period report",
      "Download artifact Selected period report",
      "Save artifact Selected period report to Reports",
      "Regenerate artifact Selected period report",
      "Delete artifact Selected period report"
    ]) {
      expect(markup).toContain(`aria-label="${name}"`);
    }
  });

  test("renders an actionable retry state without replacing core admin controls", () => {
    const markup = renderToStaticMarkup(
      createElement(AdminAIResponsePanel, {
        onRetry: () => undefined,
        response: {
          ...baseResponse,
          body: "The AI service is temporarily unavailable. Core admin actions remain available.",
          state: "offline-error",
          title: "AI service unavailable"
        }
      })
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Retry request");
    expect(markup).toContain("Core admin actions remain available");
    expect(markup).toContain("Continue with this page&#x27;s manual admin controls");
  });

  test("renders clear human labels for every advanced response state", () => {
    const states = {
      analyzing: "Thinking",
      "action-complete": "Success",
      "action-failed": "Error",
      "action-prepared": "Plan ready",
      "blocked-missing-data": "Blocked by missing data",
      cancelled: "Cancelled",
      "confirmation-required": "Confirmation required",
      executing: "Executing",
      "insufficient-permission": "Blocked by permission",
      loading: "Loading",
      "missing-data": "Missing data",
      "offline-error": "Unavailable",
      "partial-success": "Partial success",
      "preparing-plan": "Preparing plan",
      ready: "Ready",
      "retrieving-data": "Retrieving data",
      "streaming-response": "Streaming response",
      "verifying-result": "Verifying result",
      "waiting-approval": "Waiting for approval"
    } as const;

    for (const [state, label] of Object.entries(states)) {
      const markup = renderResponse({
        state: state as AdminAIResponse["state"],
        title: "State contract"
      });
      expect(markup).toContain(`${label}: State contract`);
    }
  });

  test("renders reusable artifact lifecycle controls and creation time", () => {
    const markup = renderToStaticMarkup(
      createElement(AdminAIResponsePanel, {
        onDeleteArtifact: () => undefined,
        onRegenerate: () => undefined,
        onSaveArtifact: () => undefined,
        response: {
          ...baseResponse,
          artifact: {
            content: "Grounded report content",
            createdAt: "2026-07-21T12:00:00.000Z",
            id: "artifact-report-1",
            sourceContext: "Reports / selected period",
            title: "Selected period report",
            type: "report"
          }
        }
      })
    );

    for (const text of [
      "Created",
      "2026-07-21T12:00:00.000Z",
      "Copy",
      "Download",
      "Save to Reports",
      "Regenerate",
      "Delete"
    ]) {
      expect(markup).toContain(text);
    }
  });

  test("renders complete success and failure approval receipt fields", () => {
    const markup = renderResponse({
      approvalReceipt: {
        action: "Prepare selected report",
        affectedRecords: ["report-1"],
        approvalLevel: 2,
        auditReference: null,
        confirmationTimestamp: "2026-07-21T12:00:00.000Z",
        currentState: "Draft",
        executionStatus: "failure",
        impact: "No report record changed.",
        impactLabel: "Impact",
        outcome: "Durable storage unavailable",
        otpRequired: false,
        permissionCheck: "reports.edit",
        proposedState: "Saved report",
        recommendedByAI: "Review the report before saving",
        recordsChanged: 0,
        requestedBy: "owner@example.com",
        reversible: false,
        rollbackAvailable: false
      }
    });

    for (const text of [
      "Recommended by AI",
      "Review the report before saving",
      "Impact:",
      "No report record changed.",
      "Execution status",
      "failure",
      "Rollback availability",
      "Unavailable",
      "Not persisted; failure receipt only"
    ]) {
      expect(markup).toContain(text);
    }
  });

  test("renders mixed confidence for each important conclusion and preserves overall confidence", () => {
    const markup = renderResponse({
      conclusions: [
        {
          confidence: {
            level: "high",
            reason: "Payment state and three matching error events agree."
          },
          id: "payment-state",
          text: "Four paid sites are waiting in the publish queue."
        },
        {
          confidence: {
            level: "low",
            reason: "The likely cause has not been reproduced."
          },
          id: "likely-cause",
          text: "A stale publish worker may be causing the delay."
        },
        {
          confidence: {
            level: "insufficient-data",
            reason: "No previous-period queue snapshot is available."
          },
          id: "historical-comparison",
          text: "The queue is worse than the previous period."
        }
      ],
      confidence: {
        level: "medium",
        reason: "The response mixes observed facts with an unverified hypothesis."
      }
    });

    for (const text of [
      "Important conclusions",
      "Medium confidence",
      "The response mixes observed facts with an unverified hypothesis.",
      "Four paid sites are waiting in the publish queue.",
      "High confidence",
      "Payment state and three matching error events agree.",
      "A stale publish worker may be causing the delay.",
      "Low confidence",
      "The likely cause has not been reproduced.",
      "The queue is worse than the previous period.",
      "Insufficient data",
      "No previous-period queue snapshot is available."
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain('aria-label="Important conclusions"');
  });

  test("does not repeat the response body as an auto-generated primary conclusion", () => {
    const body = "No data was exposed and no action ran.";
    const markup = renderResponse({
      body,
      conclusions: [
        {
          confidence: {
            level: "high",
            reason: "A deterministic safety rule blocked the request."
          },
          id: "primary-conclusion",
          text: body
        }
      ]
    });

    expect(markup.match(/No data was exposed and no action ran\./g)).toHaveLength(1);
    expect(markup).not.toContain('aria-label="Important conclusions"');
  });

  test("renders an evidence-backed critical Incident Mode banner and freeze contract", () => {
    const observedAt = "2026-07-21T10:00:00.000Z";
    const incident = buildAdminAIIncident({
      evidence: [
        {
          affectedEntity: "coach-sites",
          category: "failed-publishes",
          directRoute: "/admin/dashboard?view=coach-sites",
          evidence: [
            {
              observedAt,
              source: "admin-observability",
              summary: "Multiple coach-site publishes failed",
              value: 5
            }
          ],
          firstDetected: observedAt,
          id: "incident-mass-publish",
          impact: "Publishing is unavailable for affected coach sites.",
          lastDetected: observedAt,
          module: "coach-sites",
          recurrenceCount: 5,
          severity: "critical",
          suggestedNextStep: "Verify Coach Sites and follow the existing recovery runbook.",
          whatHappened: "Multiple coach-site publishes failed"
        }
      ],
      query: "Mass publish failures",
      requestedAt: observedAt
    });
    const markup = renderResponse({ incident, state: "partial-success" });

    for (const text of [
      "Critical Incident Mode",
      "Mass publish failures",
      "Dangerous action freeze",
      "admin-ai-optional-dangerous-actions",
      "Affected modules",
      "coach-sites",
      "Validated incident evidence",
      "admin-observability",
      "incidentKind=mass-publish-failures",
      "Open supporting record coach-sites",
      "Investigation checklist",
      "Incident timeline",
      "Audit trail",
      "advisory-only"
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('href="/admin/dashboard?view=coach-sites"');
  });

  test("renders complete evidence provenance and supporting navigation", () => {
    const markup = renderResponse({
      evidence: [
        {
          dateRange: "July 1-7",
          entityReferences: ["site-1", "site-2"],
          entityRoutes: {
            "site-1": "/admin/dashboard?view=coach-sites&coach=site-1",
            "site-2": "/admin/dashboard?view=coach-sites&coach=site-2"
          },
          filters: { status: "draft" },
          freshness: "Refreshed 5 minutes ago",
          label: "Coach Sites",
          module: "coach-sites",
          observedAt: "2026-07-21T10:00:00.000Z",
          recordCount: 2,
          source: "/api/admin/coach-sites",
          sourceRoute: "/admin/dashboard?view=coach-sites"
        }
      ]
    });

    for (const text of [
      "/api/admin/coach-sites",
      "Module",
      "coach-sites",
      "July 1-7",
      "Records analyzed",
      "2",
      "site-1, site-2",
      "status=draft",
      "2026-07-21T10:00:00.000Z",
      "Freshness",
      "Refreshed 5 minutes ago",
      "View supporting records",
      "View supporting record site-1",
      "View supporting record site-2",
      "Open source module",
      "View applied filters"
    ]) {
      expect(markup).toContain(text);
    }
    expect(markup).toContain('href="/admin/dashboard?view=coach-sites"');
    expect(markup).toContain('href="/admin/dashboard?view=coach-sites&amp;coach=site-1"');
  });

  test("renders an explicit empty applied-filter state", () => {
    const markup = renderResponse({
      evidence: [
        {
          dateRange: "Current",
          entityReferences: [],
          filters: {},
          freshness: "Current",
          label: "Admin Overview",
          module: "overview",
          observedAt: "2026-07-21T10:00:00.000Z",
          recordCount: 0,
          source: "/api/admin/dashboard/overview",
          sourceRoute: "/admin/dashboard?view=overview"
        }
      ]
    });

    expect(markup).toContain("View applied filters");
    expect(markup).toContain(">None<");
  });

  test("renders the complete analytics explanation contract", () => {
    const analyticsExplanation = explainAdminAIAnalytics({
      now: "2026-07-21T12:00:00.000Z",
      points: [
        {
          bucketEnd: "2026-07-02T00:00:00.000Z",
          bucketStart: "2026-07-01T00:00:00.000Z",
          currentRegistrationClicks: 5,
          currentVisits: 100,
          previousRegistrationClicks: 20,
          previousVisits: 200,
          source: "search",
          sourceAttributed: true
        },
        {
          bucketEnd: "2026-07-03T00:00:00.000Z",
          bucketStart: "2026-07-02T00:00:00.000Z",
          currentRegistrationClicks: 30,
          currentVisits: 300,
          previousRegistrationClicks: 10,
          previousVisits: 100,
          source: "social",
          sourceAttributed: true
        },
        {
          bucketEnd: "2026-07-04T00:00:00.000Z",
          bucketStart: "2026-07-03T00:00:00.000Z",
          currentRegistrationClicks: 1,
          currentVisits: 50,
          previousRegistrationClicks: 10,
          previousVisits: 100,
          source: "search",
          sourceAttributed: true
        }
      ],
      refreshedAt: "2026-07-21T11:55:00.000Z"
    });
    const markup = renderResponse({ analyticsExplanation });

    for (const text of [
      "Analytics explanation",
      "Trend",
      "Current visits",
      "Previous visits",
      "Important windows",
      "Source performance",
      "Highest traffic source",
      "Overall conversion",
      "Anomalies",
      "Detection method",
      "Recommended verification",
      "Correlation",
      "does not establish causation",
      "Data warnings",
      "Investigation steps",
      "search",
      "social"
    ]) {
      expect(markup).toContain(text);
    }
  });

  test("renders nullable health scoring and every alert field", () => {
    const markup = renderResponse({
      healthScore: {
        calculatedAt: "2026-07-21T11:50:00.000Z",
        calculation: "Weighted average of all available component scores.",
        components: [
          {
            calculation:
              "Latest successful backup age is compared with the backup freshness policy.",
            howToImprove: ["Run and verify a current backup."],
            id: "backup-freshness",
            inputs: ["Last successful backup: unavailable"],
            label: "Backup freshness",
            missingInputs: ["Last successful backup timestamp"],
            score: null,
            weight: 1
          }
        ],
        missingInputs: ["Backup freshness"],
        score: null
      } as never,
      anomalyAnalysis: {
        anomalies: [
          {
            affectedEntity: "analytics-events",
            baseline: {
              description: "Three prior hourly event counts",
              minimumSampleSize: 3,
              sampleSize: 3
            },
            category: "analytics-event-interruption",
            confidence: "medium",
            dataRange: {
              from: "2026-07-21T08:00:00.000Z",
              to: "2026-07-21T11:00:00.000Z"
            },
            detectionMethod:
              "Observed value compared with the mean of 3 source-backed observations",
            deviation: "80% below baseline",
            evidence: [
              {
                observedAt: "2026-07-21T11:00:00.000Z",
                source: "analytics-events",
                summary: "Current event count fell to 2.",
                value: 2
              }
            ],
            id: "anomaly-analytics-interruption",
            module: "coach-analytics",
            observedValue: 2,
            recommendedVerification: "Compare the raw event stream with the aggregate."
          }
        ],
        insufficientBaselineCategories: ["backup-delay"],
        message: "Insufficient baseline",
        status: "partial"
      },
      healthSignals: [
        {
          affectedEntity: "coach:gyana",
          confidence: "high",
          directRoute: "/admin/dashboard?view=error-reports",
          evidence: "Three failures observed in five minutes.",
          firstDetected: "2026-07-21T11:40:00.000Z",
          id: "alert-api-1",
          impact: "Analytics refresh is delayed.",
          lastDetected: "2026-07-21T11:45:00.000Z",
          module: "coach-analytics",
          recurrenceCount: 3,
          severity: "high",
          suggestedNextStep: "Open the safe investigation view.",
          title: "Repeated API failures"
        }
      ]
    });

    for (const text of [
      "Unavailable",
      "Calculated at",
      "Weighted average of all available component scores.",
      "Weight",
      "Latest successful backup age is compared with the backup freshness policy.",
      "How to improve",
      "Run and verify a current backup.",
      "backup-freshness",
      "Last successful backup timestamp",
      "Affected entity",
      "coach:gyana",
      "Confidence",
      "First detected",
      "Last detected",
      "Recurrence count",
      "Module",
      "coach-analytics",
      "Impact",
      "Analytics refresh is delayed.",
      "Evidence",
      "Three failures observed in five minutes.",
      "Suggested next step",
      "Open the safe investigation view.",
      "alert-api-1",
      "Source-backed anomaly analysis",
      "analytics-event-interruption",
      "80% below baseline",
      "Insufficient baseline categories",
      "backup-delay"
    ]) {
      expect(markup).toContain(text);
    }
  });

  test("renders source-backed improvement guidance for all eight health components and a safe blank fallback", () => {
    const components = [
      ["site-health", "Site health", "Repair the verified broken public routes."],
      ["publish-health", "Publish health", "Review the failed publish records before retrying."],
      [
        "payment-reconciliation",
        "Payment reconciliation",
        "Reconcile verified payment and publish-state mismatches."
      ],
      [
        "analytics-reliability",
        "Analytics reliability",
        "Restore the verified analytics ingestion source."
      ],
      ["error-backlog", "Error backlog", "Triage the oldest verified unresolved errors."],
      ["backup-freshness", "Backup freshness", "Run and verify a current backup."],
      [
        "security-configuration",
        "Security configuration",
        "Review the verified security configuration gaps."
      ],
      ["data-completeness", "Data completeness", "Provide the verified missing source fields."]
    ].map(([id, label, step]) => ({
      calculation: `Source-backed calculation for ${label}.`,
      howToImprove: [step],
      id,
      inputs: [`Verified ${label} input`],
      label,
      missingInputs: [],
      score: 75,
      weight: 1
    }));
    const markup = renderResponse({
      healthScore: {
        calculatedAt: "2026-07-22T00:00:00.000Z",
        calculation: "Weighted average of all available component scores.",
        components,
        missingInputs: [],
        score: 75
      } as never
    });

    expect(markup.match(/How to improve/g)).toHaveLength(8);
    for (const component of components) {
      expect(markup).toContain(component.label);
      expect(markup).toContain(component.howToImprove[0]);
    }

    const fallbackMarkup = renderResponse({
      healthScore: {
        calculatedAt: "2026-07-22T00:00:00.000Z",
        calculation: null,
        components: [
          {
            calculation: null,
            howToImprove: ["", "   "],
            id: "backup-freshness",
            inputs: [],
            label: "Backup freshness",
            missingInputs: ["Last successful backup timestamp"],
            score: null,
            weight: null
          }
        ],
        missingInputs: ["Backup freshness"],
        score: null
      } as never
    });

    expect(fallbackMarkup).toContain("No source-backed remediation step is available.");
  });

  test("preserves ordered Daily Briefing and executive report sections with provenance", () => {
    const daily = generateAdminAIDailyBriefing({
      blocks: {
        "platform-health": [
          {
            classification: "computed",
            label: "Admin health score",
            source: "platform-health",
            value: 84
          }
        ]
      },
      dateRange: "2026-07-20 to 2026-07-21",
      filters: { region: "all" },
      freshness: "5 minutes old",
      generatedAt: "2026-07-21T12:00:00.000Z"
    });
    const dailyMarkup = renderResponse({ structuredReport: daily });
    const dailyPositions = DAILY_ADMIN_BRIEFING_BLOCKS.map(({ title }) =>
      dailyMarkup.indexOf(title)
    );

    expect(dailyPositions.every((position) => position >= 0)).toBe(true);
    expect(dailyPositions).toEqual([...dailyPositions].sort((left, right) => left - right));
    expect(dailyMarkup).toContain("Missing reason");
    expect(dailyMarkup).toContain("No real platform data was supplied");

    const executive = generateAdminAIExecutiveReport({
      dateRange: "2026-07-01 to 2026-07-21",
      entries: ADMIN_AI_REPORT_CLASSIFICATIONS.map((classification, index) => ({
        classification,
        label: `${classification} entry`,
        missingReason: classification === "missing" ? "Source feed unavailable." : undefined,
        source: classification === "missing" ? "unavailable" : `source-${index}`,
        value: classification === "missing" ? null : index
      })),
      filters: { region: "all", status: "active" },
      freshness: "10 minutes old",
      generatedAt: "2026-07-21T12:00:00.000Z",
      reportType: "Monthly Growth Report"
    });
    const executiveMarkup = renderResponse({ structuredReport: executive });
    const executivePositions = executive.sections.map(({ title }) =>
      executiveMarkup.indexOf(title)
    );

    expect(executivePositions.every((position) => position >= 0)).toBe(true);
    expect(executivePositions).toEqual([...executivePositions].sort((left, right) => left - right));
    for (const text of [
      "Monthly Growth Report",
      "Generated at",
      "Date range",
      "Filters",
      "Freshness",
      "Classification",
      "Source feed unavailable."
    ]) {
      expect(executiveMarkup).toContain(text);
    }
  });

  test("renders smart-table scope, filters, selections, row reasoning, groups, and review-only plan", () => {
    const context = {
      filters: { query: "gyana", status: "draft" },
      rows: [
        {
          duplicateKey: "gyana",
          groupKey: "PCOS",
          id: "site-1",
          imageReady: false,
          label: "Gyana",
          linkValid: false,
          requiredDataComplete: false,
          status: "draft",
          unresolvedErrors: 2
        },
        {
          duplicateKey: "gyana",
          groupKey: "PCOS",
          id: "site-2",
          imageReady: true,
          label: "Gyana duplicate",
          linkValid: true,
          requiredDataComplete: true,
          status: "draft",
          unresolvedErrors: 0
        }
      ],
      selectedIds: ["site-1", "site-2"],
      sort: { direction: "asc" as const, field: "label" },
      tableId: "coach-sites"
    };
    const planMarkup = renderResponse({
      tableAnalysis: runAdminAITableCopilot(context, "propose-bulk-action")
    });

    for (const text of [
      "Smart-table analysis",
      "Table scope",
      "coach-sites",
      "Visible rows",
      "Selected rows",
      "Filters",
      "status",
      "draft",
      "Sort",
      "Row reasoning",
      "site-1",
      "Required data is incomplete.",
      "Review-only plan",
      "Review only; this table analysis cannot mutate records.",
      "Executable",
      "No"
    ]) {
      expect(planMarkup).toContain(text);
    }

    const groupsMarkup = renderResponse({
      tableAnalysis: runAdminAITableCopilot(context, "identify-duplicates")
    });
    expect(groupsMarkup).toContain("Groups");
    expect(groupsMarkup).toContain("gyana");
    expect(groupsMarkup).toContain("site-1");
    expect(groupsMarkup).toContain("site-2");
  });

  test("renders every Builder check and the authoritative validation message", () => {
    const builderInspection = inspectAdminAIBuilder({
      bonusServiceTitles: [
        "Life-Long Health Calculators",
        "Lifetime Support Sessions",
        "Lifestyle Success Toolkit"
      ],
      copyText: "PCOS wellness education with practical habit coaching and ongoing support.",
      ctaText: "Register with this coach",
      faq: Array.from({ length: 5 }, (_, index) => ({
        answer: `Education-first answer ${index + 1} with no medical promise.`,
        question: `Helpful question ${index + 1}?`
      })),
      footer: {
        brandLine: "YW Nutritech coach referral page",
        privacyNote: "Only public support details are shown.",
        text: "Education only; not diagnosis or treatment."
      },
      media: { height: 1200, ready: true, width: 1200 },
      missingFields: [],
      mobileContentLength: 900,
      navbarSections: ["hero", "intro", "faq", "footer"],
      niche: "PCOS wellness coaching",
      previewDigest: "same-render-v1",
      productionValidationError: "",
      publicDigest: "same-render-v1",
      registrationUrl: "https://forms.example.com/coach-registration",
      visibleSections: ["hero", "intro", "problem", "faq", "footer"]
    });
    const markup = renderResponse({ builderInspection });

    expect(markup).toContain("Builder pre-publish inspection");
    expect(markup).toContain(builderInspection.authoritativeValidation);
    expect(markup).toContain("Advisory only");
    for (const check of builderInspection.checks) {
      expect(markup).toContain(check.id);
      expect(markup).toContain(check.detail);
    }
  });

  test("renders the exact selected-error investigation fields", () => {
    const errorInvestigation = investigateAdminAIError({
      reports: [
        {
          affectedEntity: "coach:gyana",
          changeSummary: "Analytics route validation changed",
          createdAt: "2026-07-20T09:00:00.000Z",
          deployId: "deploy-123",
          errorCode: "YW-API-001",
          module: "coach-analytics",
          referenceId: "ERR-1",
          route: "/admin/dashboard?view=coach-analytics",
          safeMessage: "Analytics request returned a safe API failure.",
          severity: "high",
          sourceFiles: ["functions/api/admin/analytics-events.ts"],
          sourceFilesTrusted: true
        },
        {
          affectedEntity: "coach:maya",
          createdAt: "2026-07-20T09:10:00.000Z",
          errorCode: "YW-API-001",
          module: "coach-analytics",
          referenceId: "ERR-2",
          route: "/admin/dashboard?view=coach-analytics",
          safeMessage: "The same analytics request failed.",
          severity: "medium",
          sourceFiles: [],
          sourceFilesTrusted: false
        }
      ],
      selectedReferenceId: "ERR-1"
    });
    const markup = renderResponse({ errorInvestigation });

    for (const text of [
      "Selected-error investigation",
      "Summary",
      errorInvestigation.summary,
      "Status",
      errorInvestigation.status,
      "Severity",
      errorInvestigation.severity,
      "Impact",
      errorInvestigation.impactSummary,
      "Resolution status",
      errorInvestigation.resolutionStatus,
      "Affected users or entities",
      "coach:gyana",
      "Related errors",
      "ERR-2",
      "Evidence",
      "Likely cause",
      errorInvestigation.likelyCause.replaceAll('"', "&quot;"),
      "Recommended fix",
      errorInvestigation.recommendedFix,
      "Reproduction",
      "Safe temporary action",
      errorInvestigation.safeTemporaryAction
    ]) {
      expect(markup).toContain(text);
    }
  });
});
