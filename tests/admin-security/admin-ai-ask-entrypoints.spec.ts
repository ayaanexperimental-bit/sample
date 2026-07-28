import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { AdminAIAskButton } from "../../components/admin/admin-ai/AdminAIAskButton";
import { ADMIN_AI_ASK_EVENT, type AdminAIAskEventDetail } from "../../lib/admin-ai/adminAIEvents";

const shellSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-v2-shell.tsx"),
  "utf8"
);
const paritySource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-v2-production-parity.tsx"),
  "utf8"
);

test("exposes contextual read-only Ask Copilot entry points for important tables and forms", () => {
  const builder = getAskButtonSource("Pre-publish AI check");
  const visibleTable = getAskButtonSource("Analyze visible table");
  const selectedSite = getAskButtonSource("Analyze selected Coach Sites");
  const selectedError = getAskButtonSource("Investigate with AI");
  const builderForm = getAskButtonSource("Review Builder form with AI");
  const shopForm = getAskButtonSource("Review Shop settings with AI");
  const supportForm = getAskButtonSource("Review support defaults with AI");
  const tableLabels = [
    "Analyze coach performance table",
    "Analyze coach leaderboard",
    "Analyze coach analytics table",
    "Analyze audience table",
    "Analyze Shop orders",
    "AI Error Review"
  ];

  expect(builder).toContain('query="Run the complete pre-publish Builder inspection."');
  expect(builder).toContain('scope="page"');
  expect(visibleTable).toContain(
    'query="Summarize the visible Coach Sites table using the current filters and explain the safest review-only next steps."'
  );
  expect(visibleTable).toContain('scope="page"');
  expect(selectedSite).toContain(
    'query="Why are these selected Coach Sites still in draft? Explain each selected row using only permission-visible evidence."'
  );
  expect(selectedSite).toContain("selectedEntityIds={selectedTableSiteIds}");
  expect(selectedSite).toContain('scope="selection"');
  expect(selectedError).toContain(
    'query="Investigate the selected error report and prepare an exact developer-ready bug summary."'
  );
  expect(selectedError).toContain("selectedEntityIds={[selectedReport.referenceId]}");
  expect(selectedError).toContain('scope="selection"');

  expect(
    [builder, visibleTable, selectedSite, selectedError, builderForm, shopForm, supportForm].join(
      "\n"
    )
  ).not.toMatch(/adminNotes|coachName|safeMessage|sessionId|technicalDetails|query=\{`/);
  expect(builderForm).toContain('scope="page"');
  expect(shopForm).toContain('scope="page"');
  expect(supportForm).toContain('scope="page"');
  for (const label of tableLabels) {
    expect(getAskButtonSource(label)).toContain('scope="page"');
  }
  expect(shellSource).toContain("selectedIds: selectedTableSiteIds");
  expect(shellSource).toContain("generationFailure: getAdminV2CoachSiteGenerationFailure");
  expect(shellSource).toContain("permissionIssue: getAdminV2CoachSitePermissionIssue");
  expect(shellSource).toContain("table: activeAdminAiTableContext");
});

test("gives paid-masterclass and managed-admin native tables bounded Smart Table entrypoints", () => {
  const paidMasterclass = getAskButtonSource("Analyze paid masterclass table", paritySource);
  const managedAdmins = getAskButtonSource("Analyze managed administrators table", paritySource);

  expect(paidMasterclass).toContain('scope="page"');
  expect(managedAdmins).toContain('scope="page"');
  expect(paritySource).toContain('tableId: "paid-masterclass"');
  expect(paritySource).toContain('tableId: "managed-admins"');
  expect(paritySource).toContain("onAIContextChange(tableAiContext)");
  expect(shellSource).toContain('registerAdminAiTableContext("paid-masterclass-settings"');
  expect(shellSource).toContain('registerAdminAiTableContext("admin-users"');

  const settingsBranchStart = shellSource.indexOf('{activeView === "settings" ? (');
  const adminUsersBranchStart = shellSource.indexOf('{activeView === "admin-users" ? (');
  const settingsBranch = shellSource.slice(settingsBranchStart, adminUsersBranchStart);
  const adminUsersBranch = shellSource.slice(
    adminUsersBranchStart,
    shellSource.indexOf("    </>", adminUsersBranchStart)
  );

  expect(settingsBranch).not.toContain("onTableAIContextChange");
  expect(adminUsersBranch).toContain("onTableAIContextChange={setAdminUsersAiTableContext}");
});

test("wires opt-in advisory Smart Form review into Shop and Support settings", () => {
  const shopStart = shellSource.indexOf("function AdminV2ShopPage(");
  const shopEnd = shellSource.indexOf("function getAdminV2ShopSnapshot", shopStart);
  const settingsStart = shellSource.indexOf("function AdminV2SettingsPage(");
  const settingsEnd = shellSource.indexOf("function AdminV2ModuleShell", settingsStart);
  const shopSource = shellSource.slice(shopStart, shopEnd);
  const settingsSource = shellSource.slice(settingsStart, settingsEnd);

  expect(shopStart).toBeGreaterThan(-1);
  expect(shopEnd).toBeGreaterThan(shopStart);
  expect(settingsStart).toBeGreaterThan(-1);
  expect(settingsEnd).toBeGreaterThan(settingsStart);
  expect(shopSource).toContain("reviewAdminAIForm({");
  expect(shopSource).toContain("assistanceEnabled: shopFormAIEnabled");
  expect(shopSource).toContain('formId: "shop-payment-settings"');
  expect(shopSource).toContain("useState(false)");
  for (const mapping of [
    /id:\s*"paymentPageUrl"[\s\S]*?type:\s*"url"[\s\S]*?value:\s*paymentPageUrl/,
    /id:\s*"providerLabel"[\s\S]*?value:\s*providerLabel/,
    /id:\s*"packageLabel"[\s\S]*?value:\s*packageLabel/,
    /id:\s*"paymentActive"[\s\S]*?type:\s*"setting"[\s\S]*?value:\s*paymentActive/
  ]) {
    expect(shopSource).toMatch(mapping);
  }
  expect(settingsSource).toContain("reviewAdminAIForm({");
  expect(settingsSource).toContain("assistanceEnabled: supportFormAIEnabled");
  expect(settingsSource).toContain('formId: "support-defaults"');
  expect(settingsSource).toContain("useState(false)");
  for (const mapping of [
    /id:\s*"supportName"[\s\S]*?value:\s*supportDefaults\.supportName/,
    /id:\s*"supportEmail"[\s\S]*?type:\s*"email"[\s\S]*?value:\s*supportDefaults\.supportEmail/,
    /id:\s*"supportPhone"[\s\S]*?type:\s*"tel"[\s\S]*?value:\s*supportDefaults\.supportPhone/,
    /id:\s*"supportWhatsapp"[\s\S]*?type:\s*"url"[\s\S]*?value:\s*supportDefaults\.supportWhatsapp/,
    /id:\s*"supportMessage"[\s\S]*?type:\s*"copy"[\s\S]*?value:\s*supportDefaults\.supportMessage/
  ]) {
    expect(settingsSource).toMatch(mapping);
  }
  expect(shellSource).toContain("function AdminV2FormAIReview(");
  expect(shellSource).toContain("review.advisoryOnly");
  expect(shellSource).toContain("Production validation still controls saving.");
  expect(shellSource).not.toContain("applyAdminAIFormSuggestion");
});

test("forwards only normalized query intent, scope, and selected IDs", () => {
  const dispatched: Event[] = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      dispatchEvent(event: Event) {
        dispatched.push(event);
        return true;
      }
    }
  });

  try {
    const element = AdminAIAskButton({
      label: "Investigate with AI",
      query: "  Investigate\u0000 the selected error  ",
      scope: "selection",
      selectedEntityIds: [" ERR-123\u0000 ", "ERR-123"]
    });
    const props = element.props as { onClick: () => void };

    props.onClick();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe(ADMIN_AI_ASK_EVENT);
    expect((dispatched[0] as CustomEvent<AdminAIAskEventDetail>).detail).toEqual({
      query: "Investigate the selected error",
      scope: "selection",
      selectedEntityIds: ["ERR-123"]
    });
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

function getAskButtonSource(label: string, source = shellSource) {
  const labelIndex = source.indexOf(`label="${label}"`);
  expect(labelIndex, `Missing ${label} Ask Copilot entry point`).toBeGreaterThan(-1);
  const start = source.lastIndexOf("<AdminAIAskButton", labelIndex);
  const end = source.indexOf("/>", labelIndex);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(labelIndex);
  return source.slice(start, end + 2);
}
