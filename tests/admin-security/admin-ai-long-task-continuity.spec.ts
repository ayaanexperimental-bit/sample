import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const pillSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-ai/AdminAIPill.tsx"),
  "utf8"
);
const authShellSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-auth-shell.tsx"),
  "utf8"
);

test("keeps a bounded read task alive across same-admin module navigation", () => {
  expect(pillSource).toContain('const ADMIN_AI_SESSION_TASK_KEY = "yw-admin-ai:task:v1"');
  expect(pillSource).toContain("activeLongTaskRef");
  expect(pillSource).toContain('operationModeRef.current === "read"');
  expect(pillSource).toContain("activeLongTaskRef.current?.boundaryKey === sessionBoundaryKey");
  expect(pillSource).toContain("const taskContext = getCachedPolicyContext()");
  expect(pillSource).toContain("context: taskContext");
});

test("persists only task identity and safely marks an interrupted reload as non-resumable", () => {
  expect(pillSource).toContain("persistAdminAILongTask(getAdminAISessionStorage()");
  expect(pillSource).toContain("loadAdminAILongTask(");
  expect(pillSource).toContain("clearPersistedAdminAILongTask(getAdminAISessionStorage())");
  expect(pillSource).toContain("function getAdminAISessionStorage(): Storage | null");
  expect(pillSource).toMatch(
    /function getAdminAISessionStorage\(\)[\s\S]*?try \{[\s\S]*?window\.sessionStorage[\s\S]*?catch \{[\s\S]*?return null/
  );
  expect(pillSource).toContain("requestFingerprint");
  expect(pillSource).toContain("The prior read task was interrupted before completion");
  expect(pillSource).toContain("mountedRef.current &&");
  expect(pillSource).toContain("operationRef.current === operationId &&");
  expect(pillSource).toContain("!controller.signal.aborted");
  expect(pillSource).toContain("clearActiveLongTask(requestFingerprint)");
  expect(authShellSource).toContain('const ADMIN_AI_SESSION_STORAGE_PREFIX = "yw-admin-ai:"');
  expect(authShellSource).toContain("key?.startsWith(ADMIN_AI_SESSION_STORAGE_PREFIX)");
  expect(authShellSource).toContain("window.sessionStorage.removeItem(key)");

  const unmountStart = pillSource.indexOf("mountedRef.current = false");
  const unmountEnd = pillSource.indexOf("}, []);", unmountStart);
  expect(unmountStart).toBeGreaterThan(-1);
  expect(pillSource.slice(unmountStart, unmountEnd)).not.toContain(
    "clearPersistedAdminAILongTask"
  );

  const snapshotStart = pillSource.indexOf("type PersistedAdminAILongTask");
  const snapshotEnd = pillSource.indexOf("};", snapshotStart);
  expect(snapshotStart).toBeGreaterThan(-1);
  expect(pillSource.slice(snapshotStart, snapshotEnd)).not.toMatch(/\bquery\b|\brequest\s*:/i);
});
