import {
  explainAdminAIAnalytics,
  type AdminAIAnalyticsPoint
} from "./adminAIAnalytics";
import {
  buildAdminAIHealthAlerts,
  type AdminAIHealthEvidenceInput
} from "./adminAIHealth";

export type AdminAIProactiveSignalContext = {
  errors: readonly string[];
  intelligence?: {
    analyticsPoints: readonly AdminAIAnalyticsPoint[];
    healthEvidence: readonly AdminAIHealthEvidenceInput[];
  };
  lastUpdated: string;
  warnings: readonly string[];
};

export function countAdminAIProactiveSignals(context: AdminAIProactiveSignalContext) {
  const signalIds = new Set<string>();
  context.errors.forEach((_, index) => signalIds.add(`error:${index}`));
  context.warnings.forEach((_, index) => signalIds.add(`warning:${index}`));

  for (const alert of buildAdminAIHealthAlerts([...(context.intelligence?.healthEvidence || [])])) {
    signalIds.add(`health:${alert.id}`);
  }

  const analytics = explainAdminAIAnalytics({
    points: [...(context.intelligence?.analyticsPoints || [])],
    refreshedAt: context.lastUpdated
  });
  for (const anomaly of analytics.anomalies) {
    signalIds.add(`analytics:${anomaly.type}:${anomaly.dataRange}`);
  }

  return signalIds.size;
}
