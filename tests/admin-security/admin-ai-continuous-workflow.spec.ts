import { expect, test } from "@playwright/test";
import {
  inspectSelectedCoachSiteSetup,
  rankWorstPerformingCoachSites
} from "../../lib/admin-ai/adminAIContinuousWorkflow";
import type { AdminAIEntity } from "../../lib/admin-ai/adminAITypes";

test("ranks exactly three worst-performing permission-visible coach sites from analytics", () => {
  const entities = [
    site("site-a", "Alpha", "published form ready images ready"),
    site("site-b", "Beta", "published form ready images ready"),
    site("site-c", "Gamma", "published form ready images ready"),
    site("site-d", "Delta", "published form ready images ready"),
    analytics("analytics-a", "Alpha", "100 visits 8 registration clicks conversion 8%"),
    analytics("analytics-b", "Beta", "100 visits 1 registration click conversion 1%"),
    analytics("analytics-c", "Gamma", "100 visits 3 registration clicks conversion 3%"),
    analytics("analytics-d", "Delta", "100 visits 12 registration clicks conversion 12%")
  ];

  expect(rankWorstPerformingCoachSites(entities)).toEqual([
    expect.objectContaining({ analyticsEntityIds: ["analytics-b"], label: "Beta", score: 1 }),
    expect.objectContaining({ analyticsEntityIds: ["analytics-c"], label: "Gamma", score: 3 }),
    expect.objectContaining({ analyticsEntityIds: ["analytics-a"], label: "Alpha", score: 8 })
  ]);
});

test("does not rank a site without concrete linked analytics", () => {
  expect(
    rankWorstPerformingCoachSites([
      site("site-a", "Alpha", "published"),
      analytics("analytics-other", "Other", "100 visits 1 registration click conversion 1%")
    ])
  ).toEqual([]);
});

test("inspects selected site forms and images without fabricating unknown readiness", () => {
  const inspections = inspectSelectedCoachSiteSetup(
    [
      site("site-a", "Alpha", "registration form missing broken image"),
      site("site-b", "Beta", "form configured images ready"),
      site("site-c", "Gamma", "published")
    ],
    ["site-a", "site-b", "site-c"]
  );

  expect(inspections).toEqual([
    expect.objectContaining({ form: "issue", images: "issue", siteId: "site-a" }),
    expect.objectContaining({ form: "ready", images: "ready", siteId: "site-b" }),
    expect.objectContaining({ form: "unverified", images: "unverified", siteId: "site-c" })
  ]);
});

function site(id: string, label: string, facts: string): AdminAIEntity {
  return entity({ id, label, module: "coach-sites", searchableText: `${label} ${facts}` });
}

function analytics(id: string, label: string, facts: string): AdminAIEntity {
  return entity({
    id,
    label: `${label} analytics`,
    module: "coach-analytics",
    searchableText: `${label} ${facts}`
  });
}

function entity(
  input: Pick<AdminAIEntity, "id" | "label" | "module" | "searchableText">
): AdminAIEntity {
  return {
    ...input,
    matchReason: input.searchableText,
    route: `/admin/dashboard?view=${input.module}`,
    source: "focused continuous-workflow fixture",
    status: "active",
    updatedAt: "2026-07-21T00:00:00.000Z"
  };
}
