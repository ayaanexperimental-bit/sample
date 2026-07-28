import { expect, test } from "@playwright/test";
import {
  buildAdminAIIncident,
  buildAdminAIIncidentProvenance,
  type AdminAIIncident
} from "../../lib/admin-ai/adminAIIncident";

const NOW = "2026-07-21T10:00:00.000Z";

test("keeps restored provenance tied to the durable incident snapshot", () => {
  const restored = restoreIncident();
  const evidence = buildAdminAIIncidentProvenance(restored, {
    dataFreshness: "Refreshed 5 minutes ago",
    dateRange: "July 1-21",
    entities: [
      {
        id: "site-42",
        module: "coach-sites",
        route: "/admin/dashboard?view=coach-sites&coach=site-42&status=failed"
      }
    ],
    filters: { region: "west", status: "failed" }
  });

  expect(evidence).toEqual([
    {
      dateRange: `${NOW} to ${NOW}`,
      entityReferences: ["site-42"],
      entityRoutes: {
        "site-42": "/admin/dashboard?view=coach-sites&coach=site-42"
      },
      filters: {
        alertId: "incident-mass-publish",
        incidentKind: "mass-publish-failures",
        minimumSeverity: "high"
      },
      freshness: `Last observed at ${NOW}`,
      label: "Multiple coach-site publishes failed",
      module: "coach-sites",
      observedAt: NOW,
      recordCount: 1,
      source: "admin-observability",
      sourceRoute: "/admin/dashboard?view=coach-sites&coach=site-42"
    }
  ]);
  expect(restored.evidence[0]).toMatchObject({
    dateRange: `${NOW} to ${NOW}`,
    entityRoute: "/admin/dashboard?view=coach-sites&coach=site-42",
    freshness: `Last observed at ${NOW}`,
    recordCount: 1
  });
});

test("derives complete provenance for a legacy snapshot without borrowing current context", () => {
  const legacy = restoreIncident() as unknown as {
    evidence: Array<Record<string, unknown>>;
  };
  for (const key of [
    "dateRange",
    "entityReference",
    "entityRoute",
    "filters",
    "freshness",
    "recordCount",
    "sourceRoute"
  ]) {
    delete legacy.evidence[0][key];
  }

  const [evidence] = buildAdminAIIncidentProvenance(legacy as unknown as AdminAIIncident, {
    dataFreshness: "Current page refreshed seconds ago",
    dateRange: "Current page window",
    entities: [
      {
        id: "site-42",
        module: "coach-sites",
        route: "/admin/dashboard?view=coach-sites&coach=site-42&current=true"
      }
    ],
    filters: { currentPageOnly: "true" }
  });

  expect(evidence).toEqual({
    dateRange: `${NOW} to ${NOW}`,
    entityReferences: ["site-42"],
    entityRoutes: {
      "site-42": "/admin/dashboard?view=coach-sites&coach=site-42"
    },
    filters: {
      alertId: "incident-mass-publish",
      incidentKind: "mass-publish-failures",
      minimumSeverity: "high"
    },
    freshness: `Last observed at ${NOW}`,
    label: "Multiple coach-site publishes failed",
    module: "coach-sites",
    observedAt: NOW,
    recordCount: 1,
    source: "admin-observability",
    sourceRoute: "/admin/dashboard?view=coach-sites&coach=site-42"
  });
});

test("derives the durable entity but never restores an untrusted route", () => {
  const restored = restoreIncident() as unknown as {
    alerts: Array<{ directRoute: string }>;
    evidence: Array<{ entityReference: string; entityRoute?: string; sourceRoute: string }>;
  };
  restored.evidence[0].entityReference = "";
  restored.evidence[0].entityRoute = "https://attacker.example/admin/dashboard?view=coach-sites";
  restored.evidence[0].sourceRoute = "https://attacker.example/admin/dashboard?view=coach-sites";
  restored.alerts[0].directRoute = "https://attacker.example/admin/dashboard?view=coach-sites";

  const [evidence] = buildAdminAIIncidentProvenance(restored as unknown as AdminAIIncident, {
    dataFreshness: "Restored durable snapshot",
    dateRange: "Current incident window",
    entities: [],
    filters: {}
  });

  expect(evidence.entityReferences).toEqual(["site-42"]);
  expect(evidence.entityRoutes).toEqual({});
  expect(evidence.sourceRoute).toBeUndefined();
});

test("rejects a safe internal entity route when it targets a different record", () => {
  const restored = restoreIncident() as unknown as {
    evidence: Array<{ entityReference: string; entityRoute?: string; sourceRoute: string }>;
  };
  restored.evidence[0].entityRoute =
    "/admin/dashboard?view=coach-sites&coach=site-99";
  restored.evidence[0].sourceRoute = "/admin/dashboard?view=coach-sites";

  const [evidence] = buildAdminAIIncidentProvenance(restored as unknown as AdminAIIncident, {
    dataFreshness: "Current incident context",
    dateRange: "Current incident window",
    entities: [],
    filters: {}
  });

  expect(evidence.entityReferences).toEqual(["site-42"]);
  expect(evidence.entityRoutes).toEqual({});
  expect(evidence.sourceRoute).toBe("/admin/dashboard?view=coach-sites");
});

test("keeps a safe incident source route without inventing a visible record route", () => {
  const legacy = restoreIncident() as unknown as {
    alerts: Array<{ directRoute: string }>;
    evidence: Array<{ entityRoute?: string; sourceRoute: string }>;
  };
  delete legacy.evidence[0].entityRoute;
  legacy.evidence[0].sourceRoute = "/admin/dashboard?view=coach-sites";
  legacy.alerts[0].directRoute = "/admin/dashboard?view=coach-sites";

  const [evidence] = buildAdminAIIncidentProvenance(legacy as unknown as AdminAIIncident, {
    dataFreshness: "Restored durable snapshot",
    dateRange: "Current incident window",
    entities: [],
    filters: {}
  });

  expect(evidence.entityRoutes).toEqual({});
  expect(evidence.sourceRoute).toBe("/admin/dashboard?view=coach-sites");
});

function restoreIncident() {
  const incident = buildAdminAIIncident({
    evidence: [
      {
        affectedEntity: "site-42",
        category: "failed-publishes",
        directRoute: "/admin/dashboard?view=coach-sites&coach=site-42",
        evidence: [
          {
            observedAt: NOW,
            source: "admin-observability",
            summary: "Multiple coach-site publishes failed",
            value: 5
          }
        ],
        firstDetected: NOW,
        id: "incident-mass-publish",
        impact: "Publishing is unavailable for affected coach sites.",
        lastDetected: NOW,
        module: "coach-sites",
        recurrenceCount: 5,
        severity: "critical",
        suggestedNextStep: "Verify Coach Sites and follow the existing recovery runbook.",
        whatHappened: "Multiple coach-site publishes failed"
      }
    ],
    query: "Mass publish failures",
    requestedAt: NOW
  });

  return JSON.parse(JSON.stringify(incident)) as AdminAIIncident;
}
