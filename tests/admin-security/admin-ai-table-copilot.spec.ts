import { expect, test } from "@playwright/test";
import {
  ADMIN_AI_TABLE_CAPABILITIES,
  runAdminAITableCopilot
} from "../../lib/admin-ai/adminAITableCopilot";

const context = {
  filters: { status: "draft" },
  rows: [
    {
      duplicateKey: "gyana",
      generationFailure: "Copy generation failed",
      groupKey: "PCOS",
      id: "site-1",
      imageReady: false,
      label: "Gyana",
      linkValid: false,
      permissionIssue: "Publish permission missing",
      requiredDataComplete: false,
      status: "draft",
      unresolvedErrors: 2
    },
    {
      duplicateKey: "gyana",
      generationFailure: "",
      groupKey: "PCOS",
      id: "site-2",
      imageReady: true,
      label: "Gyana duplicate",
      linkValid: true,
      permissionIssue: "",
      requiredDataComplete: true,
      status: "draft",
      unresolvedErrors: 0
    },
    {
      duplicateKey: "maya",
      generationFailure: "",
      groupKey: "Sleep",
      id: "site-3",
      imageReady: true,
      label: "Maya",
      linkValid: true,
      permissionIssue: "",
      requiredDataComplete: true,
      status: "published",
      unresolvedErrors: 0
    }
  ],
  selectedIds: ["site-1", "site-2"],
  sort: { direction: "asc" as const, field: "label" },
  tableId: "coach-sites"
};

test.describe("Admin AI Smart Table Copilot", () => {
  test("implements all nine bounded table capabilities", () => {
    expect(ADMIN_AI_TABLE_CAPABILITIES).toEqual([
      "summarize-visible",
      "analyze-selected",
      "find-anomalies",
      "group-related",
      "identify-duplicates",
      "explain-status-differences",
      "propose-bulk-action",
      "generate-selected-report",
      "identify-attention"
    ]);

    for (const capability of ADMIN_AI_TABLE_CAPABILITIES) {
      const result = runAdminAITableCopilot(context, capability);
      expect(result.capability).toBe(capability);
      expect(result.tableId).toBe("coach-sites");
      expect(result.filters).toEqual({ status: "draft" });
      expect(result.sort).toEqual({ direction: "asc", field: "label" });
    }
  });

  test("keeps selected analysis isolated and explains each selected row", () => {
    const result = runAdminAITableCopilot(context, "analyze-selected");

    expect(result.rowResults.map((row) => row.id)).toEqual(["site-1", "site-2"]);
    expect(result.rowResults[0].reasons).toEqual([
      "Required data is incomplete.",
      "Required image or media is missing.",
      "Registration or contact link is invalid.",
      "Copy generation failed",
      "Publish permission missing",
      "2 unresolved errors remain."
    ]);
    expect(result.rowResults[1].reasons).toEqual([
      "No blocking reason is visible in the allowlisted table facts."
    ]);
    expect(JSON.stringify(result)).not.toContain("site-3");
  });

  test("summarizes the exact visible set and identifies exact attention records with reasons", () => {
    const summary = runAdminAITableCopilot(context, "summarize-visible");
    const attention = runAdminAITableCopilot(context, "identify-attention");

    expect(summary).toMatchObject({
      effectiveScope: "visible",
      selectedCount: 2,
      summary: "3 visible rows; 1 need attention.",
      visibleCount: 3
    });
    expect(attention.rowResults).toEqual([
      {
        id: "site-1",
        label: "Gyana",
        reasons: [
          "Required data is incomplete.",
          "Required image or media is missing.",
          "Registration or contact link is invalid.",
          "Copy generation failed",
          "Publish permission missing",
          "2 unresolved errors remain."
        ],
        status: "draft"
      }
    ]);
    expect(attention.summary).toBe("1 result found.");
  });

  test("finds duplicates, anomalies, related groups, and status differences", () => {
    expect(runAdminAITableCopilot(context, "identify-duplicates").groups).toEqual([
      { key: "gyana", recordIds: ["site-1", "site-2"] }
    ]);
    expect(runAdminAITableCopilot(context, "group-related").groups).toEqual([
      { key: "PCOS", recordIds: ["site-1", "site-2"] },
      { key: "Sleep", recordIds: ["site-3"] }
    ]);
    expect(runAdminAITableCopilot(context, "find-anomalies").rowResults).toEqual([
      expect.objectContaining({ id: "site-1" })
    ]);
    expect(runAdminAITableCopilot(context, "explain-status-differences").groups).toEqual([
      { key: "draft", recordIds: ["site-1", "site-2"] },
      { key: "published", recordIds: ["site-3"] }
    ]);
  });

  test("keeps bulk actions review-only and derives changed records from selected IDs", () => {
    const result = runAdminAITableCopilot(context, "propose-bulk-action");

    expect(result.plan).toMatchObject({
      confirmationRequired: true,
      executable: false,
      recordIds: ["site-1", "site-2"],
      safety: "Review only; this table analysis cannot mutate records."
    });
    expect(result.rowResults).toHaveLength(2);
  });

  test("bounds rows and selection IDs before analysis", () => {
    const large = {
      ...context,
      rows: Array.from({ length: 250 }, (_, index) => ({
        ...context.rows[1],
        duplicateKey: `row-${index}`,
        id: `row-${index}`,
        label: `Row ${index}`
      })),
      selectedIds: Array.from({ length: 80 }, (_, index) => `row-${index}`)
    };
    const result = runAdminAITableCopilot(large, "analyze-selected");

    expect(result.visibleCount).toBe(200);
    expect(result.selectedCount).toBe(40);
    expect(result.rowResults).toHaveLength(40);
  });

  test("explains five selected draft sites row by row without widening selection", () => {
    const fiveDrafts = {
      ...context,
      rows: [
        {
          ...context.rows[1],
          id: "draft-required",
          label: "Required data draft",
          requiredDataComplete: false
        },
        {
          ...context.rows[1],
          id: "draft-image",
          imageReady: false,
          label: "Image draft"
        },
        {
          ...context.rows[1],
          id: "draft-link",
          label: "Link draft",
          linkValid: false
        },
        {
          ...context.rows[1],
          generationFailure: "COPY_GENERATION_FAILED: protected generation endpoint failed",
          id: "draft-generation",
          label: "Generation draft"
        },
        {
          ...context.rows[1],
          id: "draft-permission",
          label: "Permission draft",
          permissionIssue: "Current role lacks website_creator.publish permission.",
          unresolvedErrors: 1
        }
      ],
      selectedIds: [
        "draft-required",
        "draft-image",
        "draft-link",
        "draft-generation",
        "draft-permission"
      ]
    };

    const result = runAdminAITableCopilot(fiveDrafts, "analyze-selected");

    expect(result.effectiveScope).toBe("selection");
    expect(result.selectedCount).toBe(5);
    expect(result.rowResults).toEqual([
      expect.objectContaining({
        id: "draft-required",
        reasons: ["Required data is incomplete."]
      }),
      expect.objectContaining({
        id: "draft-image",
        reasons: ["Required image or media is missing."]
      }),
      expect.objectContaining({
        id: "draft-link",
        reasons: ["Registration or contact link is invalid."]
      }),
      expect.objectContaining({
        id: "draft-generation",
        reasons: ["COPY_GENERATION_FAILED: protected generation endpoint failed"]
      }),
      expect.objectContaining({
        id: "draft-permission",
        reasons: [
          "Current role lacks website_creator.publish permission.",
          "1 unresolved error remains."
        ]
      })
    ]);
  });

  test("prepares a copy/save artifact handoff from selected rows only", () => {
    const result = runAdminAITableCopilot(context, "generate-selected-report");

    expect(result.effectiveScope).toBe("selection");
    expect(result.reportDraft).toMatchObject({
      contentType: "text/plain",
      copyReady: true,
      recordIds: ["site-1", "site-2"],
      saveReady: true,
      sourceContext: {
        filters: { status: "draft" },
        scope: "selection",
        sort: { direction: "asc", field: "label" },
        tableId: "coach-sites"
      },
      title: "Coach Sites selected-record report",
      type: "report"
    });
    expect(result.reportDraft?.content).toContain(
      "Gyana [draft] (site-1): Required data is incomplete."
    );
    expect(result.reportDraft?.content).toContain(
      "Gyana duplicate [draft] (site-2): No blocking reason is visible"
    );
    expect(result.reportDraft?.content).not.toContain("Maya");
    expect(result.reportDraft).not.toHaveProperty("id");
    expect(result.reportDraft).not.toHaveProperty("createdAt");
  });
});
