import type { AdminAIEntity } from "./adminAITypes";

export type AdminAIWorstPerformingSite = {
  analyticsEntityIds: string[];
  label: string;
  score: number;
  siteId: string;
  siteRoute: string;
};

export type AdminAICoachSiteSetupInspection = {
  form: "issue" | "ready" | "unverified";
  images: "issue" | "ready" | "unverified";
  label: string;
  siteId: string;
  siteRoute: string;
};

export function rankWorstPerformingCoachSites(
  entities: AdminAIEntity[],
  limit = 3
): AdminAIWorstPerformingSite[] {
  return entities
    .filter((entity) => entity.module === "coach-sites")
    .map((site) => {
      const analytics = entities.filter(
        (entity) => entity.module === "coach-analytics" && isLinkedToSite(entity, site)
      );
      const scores = analytics
        .map(performanceScore)
        .filter((score): score is number => score !== null);
      return scores.length
        ? {
            analyticsEntityIds: analytics.map(({ id }) => id),
            label: site.label,
            score: Math.min(...scores),
            siteId: site.id,
            siteRoute: site.route
          }
        : null;
    })
    .filter((site): site is AdminAIWorstPerformingSite => site !== null)
    .sort((left, right) => left.score - right.score || left.label.localeCompare(right.label))
    .slice(0, Math.max(0, limit));
}

export function inspectSelectedCoachSiteSetup(
  entities: AdminAIEntity[],
  selectedSiteIds: string[]
): AdminAICoachSiteSetupInspection[] {
  const selected = new Set(selectedSiteIds.map((id) => id.toLowerCase()));
  return entities
    .filter(
      (entity) =>
        entity.module === "coach-sites" &&
        (selected.has(entity.id.toLowerCase()) || selected.has(entity.label.toLowerCase()))
    )
    .map((site) => {
      const text = entityText(site);
      return {
        form: classifyReadiness(
          text,
          /\b(?:form|registration form)\s+(?:configured|healthy|ready|valid)\b/,
          /\b(?:broken|invalid|missing)\s+(?:form|registration form)\b|\b(?:form|registration form)\s+(?:broken|invalid|missing)\b/
        ),
        images: classifyReadiness(
          text,
          /\b(?:image|images|media)\s+(?:available|healthy|ready|valid)\b/,
          /\b(?:broken|invalid|missing)\s+(?:image|images|media)\b|\b(?:image|images|media)\s+(?:broken|invalid|missing|failed)\b/
        ),
        label: site.label,
        siteId: site.id,
        siteRoute: site.route
      };
    });
}

function performanceScore(entity: AdminAIEntity) {
  const text = entityText(entity);
  const conversion = text.match(/\bconversion(?: rate)?\s*(?::|is|=)?\s*(\d+(?:\.\d+)?)\s*%/)?.[1];
  if (conversion !== undefined) return Number(conversion);
  const visits = text.match(/\b(\d+)\s+(?:visits?|visitors?|sessions?)\b/)?.[1];
  const registrations =
    text.match(/\b(\d+)\s+registration clicks?\b/)?.[1] ||
    text.match(/\bregistrations?\s*(?::|is|=)?\s*(\d+)\b/)?.[1];
  if (visits === undefined || registrations === undefined || Number(visits) <= 0) return null;
  return (Number(registrations) / Number(visits)) * 100;
}

function isLinkedToSite(entity: AdminAIEntity, site: AdminAIEntity) {
  const text = entityText(entity);
  const id = site.id.toLowerCase();
  const label = site.label.toLowerCase();
  return text.includes(id) || (label.length >= 3 && text.includes(label));
}

function classifyReadiness(text: string, ready: RegExp, issue: RegExp) {
  if (issue.test(text)) return "issue" as const;
  if (ready.test(text)) return "ready" as const;
  return "unverified" as const;
}

function entityText(entity: AdminAIEntity) {
  return `${entity.id} ${entity.label} ${entity.status} ${entity.matchReason} ${entity.searchableText}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}
