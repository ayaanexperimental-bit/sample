import { expect, test } from "@playwright/test";
import {
  adminV2OptionalFeatureFlagKeys,
  getAdminV2FeatureFlags,
  hasEnabledAdminV2OptionalFeature
} from "../../lib/admin-v2-feature-flags";

const adminV2FlagEnvKeys = [
  "ENABLE_ADMIN_V2",
  "NEXT_PUBLIC_ENABLE_ADMIN_V2",
  "ENABLE_ADMIN_V2_ADVANCED_ANALYTICS",
  "NEXT_PUBLIC_ENABLE_ADMIN_V2_ADVANCED_ANALYTICS",
  "ENABLE_ADMIN_V2_REVENUE_WIDGETS",
  "NEXT_PUBLIC_ENABLE_ADMIN_V2_REVENUE_WIDGETS",
  "ENABLE_ADMIN_V2_QUICK_ACTIONS",
  "NEXT_PUBLIC_ENABLE_ADMIN_V2_QUICK_ACTIONS",
  "ENABLE_ADMIN_V2_AI_INSIGHTS",
  "NEXT_PUBLIC_ENABLE_ADMIN_V2_AI_INSIGHTS",
  "ENABLE_ADMIN_V2_SUPPORT_DEFAULTS",
  "NEXT_PUBLIC_ENABLE_ADMIN_V2_SUPPORT_DEFAULTS",
  "ENABLE_ADMIN_V2_EXPERIMENTAL_CHARTS",
  "NEXT_PUBLIC_ENABLE_ADMIN_V2_EXPERIMENTAL_CHARTS"
] as const;

test.describe("Admin V2 feature flags", () => {
  const originalValues = new Map<string, string | undefined>();

  test.beforeEach(() => {
    for (const key of adminV2FlagEnvKeys) {
      originalValues.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  test.afterEach(() => {
    for (const key of adminV2FlagEnvKeys) {
      const value = originalValues.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    originalValues.clear();
  });

  test("keeps Admin V2 and optional OD-only widgets disabled by default", () => {
    const flags = getAdminV2FeatureFlags();

    expect(flags.enabled).toBe(false);
    for (const key of adminV2OptionalFeatureFlagKeys) {
      expect(flags[key]).toBe(false);
    }
    expect(hasEnabledAdminV2OptionalFeature(flags)).toBe(false);
  });

  test("allows explicitly disabling Admin V2 for rollback checks", () => {
    process.env.ENABLE_ADMIN_V2 = "false";

    const flags = getAdminV2FeatureFlags();

    expect(flags.enabled).toBe(false);
  });

  test("enables optional widgets only through explicit private or public flags", () => {
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2 = "true";
    process.env.ENABLE_ADMIN_V2_QUICK_ACTIONS = "enabled";
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_V2_EXPERIMENTAL_CHARTS = "1";

    const flags = getAdminV2FeatureFlags();

    expect(flags.enabled).toBe(true);
    expect(flags.quickActions).toBe(true);
    expect(flags.experimentalCharts).toBe(true);
    expect(flags.advancedAnalytics).toBe(false);
    expect(flags.aiInsights).toBe(false);
    expect(flags.revenueWidgets).toBe(false);
    expect(flags.supportDefaults).toBe(false);
    expect(hasEnabledAdminV2OptionalFeature(flags)).toBe(true);
  });
});
