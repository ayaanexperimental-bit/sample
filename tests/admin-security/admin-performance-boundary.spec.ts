import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const authShellPath = resolve(process.cwd(), "components/admin/admin-auth-shell.tsx");
const artifactCheckerPath = resolve(process.cwd(), "scripts/check-admin-performance-artifacts.mjs");
const packageJsonPath = resolve(process.cwd(), "package.json");

test("keeps classic and V2 dashboards behind the authenticated dashboard boundary", () => {
  const source = readFileSync(authShellPath, "utf8");

  expect(source).not.toContain('import { AdminDashboardShell } from "./admin-dashboard-shell"');
  expect(source).not.toContain('import { AdminV2DashboardShell } from "./admin-v2-shell"');
  expect(source).toContain("const LazyAdminDashboardShell = lazy");
  expect(source).toContain("const LazyAdminV2DashboardShell = lazy");

  const renderDashboardStart = source.indexOf("function renderDashboard()");
  const renderDashboardEnd = source.indexOf("function renderAccessIssue", renderDashboardStart);
  const renderDashboard = source.slice(renderDashboardStart, renderDashboardEnd);

  expect(renderDashboardStart).toBeGreaterThan(0);
  expect(renderDashboard).toMatch(
    /isAdminV2Enabled\(\)\s*\?\s*LazyAdminV2DashboardShell\s*:\s*LazyAdminDashboardShell/
  );
  expect(renderDashboard).toContain("<Suspense fallback={<AdminDashboardLoading />}>");
  expect(renderDashboard).toContain("requestedCoachSiteFocus={requestedCoachSiteFocus}");
  expect(renderDashboard).toContain("onActiveViewChange={handleActiveViewChange}");
});

test("defines a deterministic post-build budget for every unauthenticated admin export", () => {
  expect(existsSync(artifactCheckerPath)).toBe(true);
  if (!existsSync(artifactCheckerPath)) return;

  const checker = readFileSync(artifactCheckerPath, "utf8");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  for (const outputPath of [
    "admin.html",
    "admin/login.html",
    "admin/verify.html",
    "admin/forgot-password.html",
    "admin/reset-password.html",
    "admin/dashboard.html"
  ]) {
    expect(checker).toContain(`"${outputPath}"`);
  }

  for (const forbiddenMarker of [
    "Open production modules",
    "Only production records are shown.",
    "yw-admin-ai:response:v1"
  ]) {
    expect(checker).toContain(forbiddenMarker);
  }

  expect(checker).toMatch(/const MAX_INITIAL_ADMIN_JS_BYTES = 2_[0-9]{3}_[0-9]{3};/);
  expect(packageJson.scripts?.["check:admin-performance"]).toBe(
    "node scripts/check-admin-performance-artifacts.mjs"
  );
});
