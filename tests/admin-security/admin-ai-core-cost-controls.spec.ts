import { expect, test } from "@playwright/test";
import {
  createStableAiHash,
  getCachedAiResult,
  invalidateCachedAiResults,
  setCachedAiResult
} from "../../lib/server/ai-cache-service";
import { compressAiContext } from "../../lib/server/ai-context-compressor";

test.describe("Admin AI shared context and cache controls", () => {
  test("enforces the requested context ceiling and filters repeated footer noise deterministically", () => {
    const compressed = compressAiContext(
      [
        "Keep this verified analytics signal for the model.",
        "Privacy policy navigation footer content.",
        "Privacy policy navigation footer content.",
        "Keep this second verified signal for the model."
      ].join("\n"),
      20
    );

    expect(compressed.compactText.length).toBeLessThanOrEqual(80);
    expect(compressed.compactText).not.toContain("Privacy policy");
    expect(compressed.truncated).toBe(true);
  });

  test("isolates tenant cache entries and supports scoped invalidation", () => {
    const tenantA = { namespace: "analytics", tenantId: "tenant-a" };
    const tenantB = { namespace: "analytics", tenantId: "tenant-b" };

    invalidateCachedAiResults(tenantA);
    invalidateCachedAiResults(tenantB);
    setCachedAiResult("weekly-summary", { visits: 42 }, tenantA);

    expect(getCachedAiResult("weekly-summary", tenantA)).toEqual({ visits: 42 });
    expect(getCachedAiResult("weekly-summary", tenantB)).toBeNull();
    expect(createStableAiHash("source-version-1")).not.toBe(createStableAiHash("source-version-2"));

    expect(invalidateCachedAiResults(tenantA)).toBe(1);
    expect(getCachedAiResult("weekly-summary", tenantA)).toBeNull();
  });
});
