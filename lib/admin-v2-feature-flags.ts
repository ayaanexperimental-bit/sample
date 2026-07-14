const truthyFlagValues = new Set(["1", "true", "yes", "on", "enabled"]);

export type AdminV2FeatureFlags = {
  advancedAnalytics: boolean;
  aiInsights: boolean;
  enabled: boolean;
  experimentalCharts: boolean;
  quickActions: boolean;
  revenueWidgets: boolean;
  supportDefaults: boolean;
};

export const adminV2OptionalFeatureFlagKeys = [
  "advancedAnalytics",
  "aiInsights",
  "experimentalCharts",
  "quickActions",
  "revenueWidgets",
  "supportDefaults"
] as const satisfies ReadonlyArray<Exclude<keyof AdminV2FeatureFlags, "enabled">>;

export type AdminV2OptionalFeatureFlagKey = (typeof adminV2OptionalFeatureFlagKeys)[number];

function parseFlag(value: string | undefined) {
  return truthyFlagValues.has((value || "").trim().toLowerCase());
}

function resolveFlag(primaryValue: string | undefined, publicValue: string | undefined) {
  return parseFlag(primaryValue) || parseFlag(publicValue);
}

function resolveEnabledFlag(primaryValue: string | undefined, publicValue: string | undefined) {
  return resolveFlag(primaryValue, publicValue);
}

export function getAdminV2FeatureFlags(): AdminV2FeatureFlags {
  return {
    advancedAnalytics: resolveFlag(
      process.env.ENABLE_ADMIN_V2_ADVANCED_ANALYTICS,
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2_ADVANCED_ANALYTICS
    ),
    aiInsights: resolveFlag(
      process.env.ENABLE_ADMIN_V2_AI_INSIGHTS,
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2_AI_INSIGHTS
    ),
    enabled: resolveEnabledFlag(process.env.ENABLE_ADMIN_V2, process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2),
    experimentalCharts: resolveFlag(
      process.env.ENABLE_ADMIN_V2_EXPERIMENTAL_CHARTS,
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2_EXPERIMENTAL_CHARTS
    ),
    quickActions: resolveFlag(
      process.env.ENABLE_ADMIN_V2_QUICK_ACTIONS,
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2_QUICK_ACTIONS
    ),
    revenueWidgets: resolveFlag(
      process.env.ENABLE_ADMIN_V2_REVENUE_WIDGETS,
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2_REVENUE_WIDGETS
    ),
    supportDefaults: resolveFlag(
      process.env.ENABLE_ADMIN_V2_SUPPORT_DEFAULTS,
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2_SUPPORT_DEFAULTS
    )
  };
}

export function isAdminV2Enabled() {
  return getAdminV2FeatureFlags().enabled;
}

export function hasEnabledAdminV2OptionalFeature(flags = getAdminV2FeatureFlags()) {
  return adminV2OptionalFeatureFlagKeys.some((key) => flags[key]);
}
