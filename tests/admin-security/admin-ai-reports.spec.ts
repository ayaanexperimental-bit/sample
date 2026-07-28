import { expect, test } from "@playwright/test";
import {
  ADMIN_AI_EXECUTIVE_REPORT_TYPES,
  ADMIN_AI_REPORT_CLASSIFICATIONS,
  DAILY_ADMIN_BRIEFING_BLOCKS,
  evaluateAdminAIReportPreflight,
  estimateAdminAIReportSize,
  formatAdminAIReportJson,
  formatAdminAIReportText,
  generateAdminAICoachSitePerformanceReport,
  generateAdminAIDailyBriefing,
  generateAdminAIExecutiveReport,
  generateAdminAIWebsiteReadinessReport,
  runAdminAIReportGenerationWithPreflight,
  type AdminAIReportEntryInput
} from "../../lib/admin-ai/adminAIReports";

const context = {
  dateRange: "2026-07-20T00:00:00.000Z to 2026-07-20T23:59:59.999Z",
  filters: { region: "all", status: "active" },
  freshness: "2026-07-21T05:30:00.000Z",
  generatedAt: "2026-07-21T06:00:00.000Z"
};

const classifiedEntries: AdminAIReportEntryInput[] = [
  {
    classification: "observed",
    label: "Published sites observed",
    source: "coach-sites",
    value: 12
  },
  {
    classification: "computed",
    label: "Registration conversion",
    source: "analytics-events",
    value: "8.4%"
  },
  {
    classification: "interpretation",
    label: "Performance interpretation",
    source: "analytics-events",
    value: "Conversion improved while visits stayed flat."
  },
  {
    classification: "recommendation",
    label: "Recommended follow-up",
    source: "analytics-events",
    value: "Review the two lowest-converting published sites."
  },
  {
    classification: "missing",
    label: "Payment exception details",
    missingReason: "The payment exception feed was not loaded.",
    source: "shop-orders",
    value: null
  }
];

test.describe("Admin AI report engine", () => {
  test("publishes the exact briefing blocks, report types, and classifications from the spec", () => {
    expect(DAILY_ADMIN_BRIEFING_BLOCKS.map((block) => block.title)).toEqual([
      "Platform health",
      "New coach sites",
      "Sites published",
      "Shop purchases",
      "Payment/publish exceptions",
      "Top-performing sites",
      "Low-performing sites",
      "New high-priority errors",
      "Pending admin actions",
      "Backup status",
      "Recommended focus for today"
    ]);
    expect(ADMIN_AI_EXECUTIVE_REPORT_TYPES).toEqual([
      "Weekly Admin Operations Report",
      "Monthly Growth Report",
      "Coach Site Performance Report",
      "Shop Performance Report",
      "Error and Reliability Report",
      "Admin Security and Permissions Review",
      "Backup and Recovery Report"
    ]);
    expect(ADMIN_AI_REPORT_CLASSIFICATIONS).toEqual([
      "observed",
      "computed",
      "interpretation",
      "recommendation",
      "missing"
    ]);
  });

  test("always generates all 11 Daily Briefing blocks in the required order", () => {
    const report = generateAdminAIDailyBriefing({
      ...context,
      blocks: {
        "platform-health": [
          {
            classification: "observed",
            label: "Healthy services",
            source: "platform-health",
            value: 8
          }
        ]
      }
    });

    expect(report.kind).toBe("daily-briefing");
    expect(report.title).toBe("Daily Briefing");
    expect(report.sections).toHaveLength(11);
    expect(report.sections.map((section) => section.title)).toEqual(
      DAILY_ADMIN_BRIEFING_BLOCKS.map((block) => block.title)
    );
    expect(report.sections[0].entries[0]).toEqual({
      classification: "observed",
      dateRange: context.dateRange,
      filters: { region: "all", status: "active" },
      freshness: context.freshness,
      label: "Healthy services",
      missingReason: null,
      source: "platform-health",
      value: 8
    });
    for (const section of report.sections.slice(1)) {
      expect(section.entries).toEqual([
        expect.objectContaining({
          classification: "missing",
          dateRange: context.dateRange,
          filters: { region: "all", status: "active" },
          freshness: context.freshness,
          missingReason: `No real platform data was supplied for ${section.title}.`,
          value: null
        })
      ]);
    }
  });

  test("preserves real zeroes but converts absent conclusions into honest missing data", () => {
    const report = generateAdminAIDailyBriefing({
      ...context,
      blocks: {
        "new-coach-sites": [
          {
            classification: "observed",
            label: "New coach sites",
            source: "coach-sites",
            value: 0
          }
        ],
        "recommended-focus": [
          {
            classification: "recommendation",
            label: "Recommended focus",
            source: "admin-ai-report-engine",
            value: null
          }
        ]
      }
    });

    expect(
      report.sections.find((section) => section.id === "new-coach-sites")?.entries[0]
    ).toMatchObject({
      classification: "observed",
      missingReason: null,
      value: 0
    });
    expect(
      report.sections.find((section) => section.id === "recommended-focus")?.entries[0]
    ).toMatchObject({
      classification: "missing",
      missingReason: "No value was supplied for Recommended focus.",
      value: null
    });
  });

  test("generates all seven exact executive report types with five distinct classification sections", () => {
    for (const reportType of ADMIN_AI_EXECUTIVE_REPORT_TYPES) {
      const report = generateAdminAIExecutiveReport({
        ...context,
        entries: classifiedEntries,
        reportType
      });

      expect(report.kind).toBe("executive");
      expect(report.reportType).toBe(reportType);
      expect(report.title).toBe(reportType);
      expect(report.sections.map((section) => section.classification)).toEqual(
        ADMIN_AI_REPORT_CLASSIFICATIONS
      );
      expect(report.sections.flatMap((section) => section.entries)).toHaveLength(5);
      for (const section of report.sections) {
        expect(
          section.entries.every((entry) => entry.classification === section.classification)
        ).toBe(true);
      }
    }
  });

  test("attaches source, range, sorted filters, and freshness to every metric and conclusion", () => {
    const report = generateAdminAIExecutiveReport({
      ...context,
      entries: classifiedEntries.map((entry) => ({
        ...entry,
        filters: { zeta: "last", alpha: "first" }
      })),
      reportType: "Monthly Growth Report"
    });

    for (const entry of report.sections.flatMap((section) => section.entries)) {
      expect(entry.source).not.toBe("");
      expect(entry.dateRange).toBe(context.dateRange);
      expect(Object.keys(entry.filters)).toEqual(["alpha", "zeta"]);
      expect(entry.freshness).toBe(context.freshness);
      expect(ADMIN_AI_REPORT_CLASSIFICATIONS).toContain(entry.classification);
    }
  });

  test("downgrades entries with unavailable provenance instead of presenting them as facts", () => {
    const report = generateAdminAIExecutiveReport({
      ...context,
      entries: [
        {
          classification: "computed",
          dateRange: "",
          freshness: "",
          label: "Unproven growth",
          source: "",
          value: "18%"
        }
      ],
      reportType: "Monthly Growth Report"
    });
    const entry = report.sections.flatMap((section) => section.entries)[0];

    expect(entry).toMatchObject({
      classification: "missing",
      dateRange: "unavailable",
      freshness: "unavailable",
      missingReason: "Required provenance is unavailable: source, date range, freshness.",
      source: "unavailable",
      value: null
    });
  });

  test("returns an explicit missing-data executive report when no entries are supplied", () => {
    const report = generateAdminAIExecutiveReport({
      ...context,
      entries: [],
      reportType: "Backup and Recovery Report"
    });

    expect(report.sections.flatMap((section) => section.entries)).toEqual([
      expect.objectContaining({
        classification: "missing",
        label: "Report data",
        missingReason: "No real platform data was supplied for Backup and Recovery Report.",
        source: "unavailable",
        value: null
      })
    ]);
  });

  test("formats deterministic text and JSON for copy or download without side effects", () => {
    const input = {
      ...context,
      entries: classifiedEntries,
      reportType: "Weekly Admin Operations Report" as const
    };
    const snapshot = JSON.stringify(input);
    const report = generateAdminAIExecutiveReport(input);
    const text = formatAdminAIReportText(report);
    const json = formatAdminAIReportJson(report);

    expect(text).toContain("Weekly Admin Operations Report");
    expect(text).toContain("[computed] Registration conversion: 8.4%");
    expect(text).toContain(`Date range: ${context.dateRange}`);
    expect(text).toContain("Filters: region=all, status=active");
    expect(text).toContain(`Freshness: ${context.freshness}`);
    expect(text).toContain("[missing] Payment exception details: unavailable");
    expect(text).toContain("Missing: The payment exception feed was not loaded.");
    expect(formatAdminAIReportText(report)).toBe(text);
    expect(formatAdminAIReportJson(report)).toBe(json);
    expect(JSON.parse(json)).toEqual(report);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  test("binds readiness and performance reports to one selected coach and site", () => {
    const selected = {
      selectedCoach: { id: "coach-7", name: "Asha" },
      selectedSite: { id: "site-9", name: "Asha Wellness" }
    };
    const reportInput = {
      ...context,
      ...selected,
      entries: classifiedEntries
    };

    for (const report of [
      generateAdminAIWebsiteReadinessReport(reportInput),
      generateAdminAICoachSitePerformanceReport(reportInput)
    ]) {
      expect(report.kind).toBe("selected-coach-report");
      expect(report.selectedCoach).toEqual(selected.selectedCoach);
      expect(report.selectedSite).toEqual(selected.selectedSite);
      expect(report.filters).toEqual({
        region: "all",
        selectedCoachId: "coach-7",
        selectedSiteId: "site-9",
        status: "active"
      });
      for (const entry of report.sections.flatMap((section) => section.entries)) {
        expect(entry.dateRange).toBe(context.dateRange);
        expect(entry.freshness).toBe(context.freshness);
        expect(entry.source).not.toBe("unavailable");
        expect(entry.filters).toMatchObject({
          selectedCoachId: "coach-7",
          selectedSiteId: "site-9"
        });
      }
      const text = formatAdminAIReportText(report);
      expect(text).toContain("Selected coach: Asha (coach-7)");
      expect(text).toContain("Selected site: Asha Wellness (site-9)");
    }
  });

  test("rejects dedicated coach reports without an exact selected identity", () => {
    expect(() =>
      generateAdminAICoachSitePerformanceReport({
        ...context,
        entries: classifiedEntries,
        selectedCoach: { id: "", name: "Asha" },
        selectedSite: { id: "site-9", name: "Asha Wellness" }
      })
    ).toThrow("Selected coach and site identity are required");

    expect(() =>
      generateAdminAIWebsiteReadinessReport({
        ...context,
        entries: classifiedEntries,
        selectedCoach: { id: "coach-7", name: "Asha" },
        selectedSite: { id: "", name: "Asha Wellness" }
      })
    ).toThrow("Selected coach and site identity are required");
  });

  test("warns before a very large report and makes zero provider calls until continue", async () => {
    let providerCalls = 0;
    let logicalRequestCount = 19;
    const size = {
      contextCharacters: 4_000,
      recordCount: 1_000,
      requestedOutputTokens: 2_400
    };
    const estimate = estimateAdminAIReportSize(size);
    const generate = async () => {
      logicalRequestCount += 1;
      providerCalls += 1;
      return { id: "generated-report" };
    };

    expect(estimate.veryLarge).toBe(true);
    expect(estimate.estimatedTotalTokens).toBeGreaterThan(8_000);
    expect(evaluateAdminAIReportPreflight(size).status).toBe("confirmation-required");

    const awaitingDecision = await runAdminAIReportGenerationWithPreflight({
      generate,
      size
    });
    expect(awaitingDecision).toMatchObject({
      status: "confirmation-required",
      warning: expect.stringMatching(/very large report.*continue or cancel/i)
    });
    expect(providerCalls).toBe(0);
    expect(logicalRequestCount).toBe(19);

    const cancelled = await runAdminAIReportGenerationWithPreflight({
      decision: "cancel",
      generate,
      size
    });
    expect(cancelled.status).toBe("cancelled");
    expect(providerCalls).toBe(0);
    expect(logicalRequestCount).toBe(19);

    const continued = await runAdminAIReportGenerationWithPreflight({
      decision: "continue",
      generate,
      size
    });
    expect(continued).toEqual({
      estimate,
      report: { id: "generated-report" },
      status: "generated",
      warning: null
    });
    expect(providerCalls).toBe(1);
    expect(logicalRequestCount).toBe(20);
  });
});
