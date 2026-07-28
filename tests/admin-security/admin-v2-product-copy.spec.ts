import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const shellSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-v2-shell.tsx"),
  "utf8"
);

test("keeps migration and implementation language out of the admin product UI", () => {
  for (const blockedCopy of [
    "YWcoach Admin V2",
    "Admin V2 rail",
    'aria-label="Admin V2 workspace"',
    "No Admin V2 command found.",
    "Admin V2 functional coverage",
    "Open production modules",
    "separate Admin V2 builder",
    "preview generated in Admin V2",
    "without opening old admin panels",
    "native Admin V2 Error Reports",
    "merged into Settings in V2"
  ]) {
    expect(shellSource, `Remove migration copy: ${blockedCopy}`).not.toContain(blockedCopy);
  }
});

test("keeps Admin V2 overview and command controls honest and interactive", () => {
  const compactShellSource = shellSource.replace(/\s+/g, " ");

  expect(shellSource).not.toContain("Search coaches, sites, orders");
  expect(shellSource).not.toContain('placeholder="Search coaches, sites, orders..."');
  expect(shellSource).toContain('aria-label="Search admin modules"');
  expect(shellSource).toContain('placeholder="Search admin modules..."');
  expect(shellSource).toContain("aria-expanded={mobileOpen}");

  expect(shellSource).toContain("onClick={() => onAnalyticsRangeChange(range.id)}");
  expect(shellSource).toContain('onClick={() => onSelect("shop")}');
  expect(shellSource).toContain("value={coachTableQuery}");
  expect(shellSource).toContain("setCoachTableQuery(event.currentTarget.value)");
  expect(shellSource).toContain("value={coachStatusFilter}");
  expect(shellSource).toContain("value={coachSourceFilter}");
  expect(shellSource).toContain("value={coachPaymentFilter}");
  expect(shellSource).toContain("disabled={safeCoachPage <= 0}");
  expect(shellSource).toContain("disabled={safeCoachPage >= coachPageCount - 1}");
  expect(shellSource).toContain("onClick={() => setCoachPage(Math.max(0, safeCoachPage - 1))}");
  expect(compactShellSource).toContain(
    "onClick={() => setCoachPage(Math.min(coachPageCount - 1, safeCoachPage + 1))}"
  );
});
