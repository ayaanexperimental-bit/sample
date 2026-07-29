import { expect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { adminAIRegistry, type AdminAICommand } from "../../lib/admin-ai/adminAIRegistry";
import {
  createCoachSiteFromForm,
  EMPTY_COACH_SITE_FORM,
  type CoachSiteRecord,
  type CoachSiteStatus
} from "../../lib/admin-coach-sites";

const runCopilotSmoke = process.env.ADMIN_V2_COPILOT_SMOKE === "true";
const smokeEmail = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke@example.com";
const smokeOtp = process.env.ADMIN_V2_SMOKE_OTP || "123456";

const CLS_BUDGET = 0.1;
const FIRST_DRAWER_OPEN_BUDGET_MS = 1_500;
const INTERACTION_BUDGET_MS = 500;
const MODULE_NAVIGATION_BUDGET_MS = 1_000;
const RESPONSIVE_PROJECTS = new Set(["mobile", "tablet", "desktop"]);
const DEVICE_PREFERENCE_KEY = "yw-admin-ai-preferences-v1";

type RegistryModuleId = keyof typeof adminAIRegistry;

type ModuleScenario = {
  heading: string;
  id: RegistryModuleId;
  nav?: string;
  nestedButton?: string;
  parentNav?: string;
  sectionName: string;
};

const MODULE_SCENARIOS: ModuleScenario[] = [
  {
    heading: "Revenue readiness",
    id: "overview",
    nav: "Overview",
    sectionName: "Admin Overview"
  },
  {
    heading: "Referral website control",
    id: "coach-sites",
    nav: "Coach Sites",
    sectionName: "Coach Sites"
  },
  {
    heading: "Create Coach Website",
    id: "create-coach-site",
    nav: "Create Site",
    sectionName: "Website Creator"
  },
  {
    heading: "Coach-specific analytics",
    id: "coach-analytics",
    nav: "Analytics",
    sectionName: "Coach Analytics"
  },
  {
    heading: "Top performers",
    id: "top-coaches",
    nav: "Coaches",
    sectionName: "Coach Performance"
  },
  {
    heading: "Shop Website Builder",
    id: "shop",
    nav: "Shop",
    sectionName: "Shop"
  },
  {
    heading: "Error Reports",
    id: "error-reports",
    nav: "Reports",
    sectionName: "Reports"
  },
  {
    heading: "Backup & Cleanup",
    id: "backup-cleanup",
    nestedButton: "Open maintenance",
    parentNav: "Reports",
    sectionName: "Backup and Cleanup"
  },
  {
    heading: "Link Settings",
    id: "paid-masterclass-settings",
    nav: "Payments",
    sectionName: "Payments"
  },
  {
    heading: "Settings",
    id: "settings",
    nav: "Settings",
    sectionName: "Settings"
  },
  {
    heading: "Admin User Management",
    id: "admin-users",
    nestedButton: "Open users",
    parentNav: "Settings",
    sectionName: "Admin Users"
  }
];

const NON_EXECUTABLE_CONFIRMATIONS = MODULE_SCENARIOS.flatMap((moduleScenario) =>
  adminAIRegistry[moduleScenario.id].commands
    .filter(
      (command) =>
        command.confirmationRequired && command.executionContract.availability !== "executable"
    )
    .map((command) => ({ command, moduleScenario }))
);

test.describe("Admin V2 Copilot resilience and final browser matrix", () => {
  test.skip(!runCopilotSmoke, "Set ADMIN_V2_COPILOT_SMOKE=true for the local Copilot matrix.");

  test("keeps every registry module usable through Copilot failure within responsive budgets", async ({
    page
  }, testInfo) => {
    test.skip(
      !RESPONSIVE_PROJECTS.has(testInfo.project.name),
      "This bounded matrix covers mobile, tablet, and desktop."
    );
    test.setTimeout(240_000);

    expect(MODULE_SCENARIOS.map(({ id }) => id).sort()).toEqual(
      Object.keys(adminAIRegistry).sort()
    );

    const pageErrors: string[] = [];
    const timings: Array<{
      closeMs: number;
      module: RegistryModuleId;
      navigationMs: number;
      openMs: number;
    }> = [];
    const clsMeasurements: Array<{ phase: string; value: number }> = [];
    const assertCurrentCLS = async (phase: string) => {
      const measurement = await readCLSMeasurement(page);
      const { value } = measurement;
      clsMeasurements.push({ phase, value });
      expect(
        value,
        `${phase} Copilot interaction CLS exceeded ${CLS_BUDGET}\n${JSON.stringify(measurement.detail)}`
      ).toBeLessThanOrEqual(CLS_BUDGET);
    };
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ enabled: false, memoryEnabled: true })
      );
    }, DEVICE_PREFERENCE_KEY);
    await page.route("**/api/admin/ai-settings", unavailableAdminAISettings);

    await loginToAdminV2(page);

    let firstDrawerOpen = true;
    const performanceScenarios = [...MODULE_SCENARIOS.slice(1), MODULE_SCENARIOS[0]];
    for (const moduleScenario of performanceScenarios) {
      const navigationMs = await measureModuleNavigation(page, moduleScenario);
      expect(
        navigationMs,
        `${moduleScenario.id} closed-Pill navigation exceeded ${MODULE_NAVIGATION_BUDGET_MS}ms`
      ).toBeLessThanOrEqual(MODULE_NAVIGATION_BUDGET_MS);

      const primaryTarget = getPrimaryTarget(page, moduleScenario.id);
      await expect(primaryTarget).toBeVisible();
      await assertNoOverlap(
        page.getByRole("button", { name: `Open ${moduleScenario.sectionName} Admin Copilot` }),
        primaryTarget,
        moduleScenario.id
      );

      const preserved = await preparePreservedPageState(
        page,
        moduleScenario.id,
        testInfo.project.name
      );
      await startCLSMeasurement(page);
      const pill = page.getByRole("button", {
        name: `Open ${moduleScenario.sectionName} Admin Copilot`
      });
      await pill.focus();
      await expect(pill).toBeFocused();

      const drawerName = `${moduleScenario.sectionName} Admin Copilot`;
      const drawer = page.getByRole("dialog", { name: drawerName });
      const openMs = await measureKeyboardToDialogState(page, "Enter", drawerName, true);
      await expect(drawer).toBeVisible();
      expect(
        openMs,
        `${moduleScenario.id} drawer open exceeded the fixed interaction budget`
      ).toBeLessThanOrEqual(firstDrawerOpen ? FIRST_DRAWER_OPEN_BUDGET_MS : INTERACTION_BUDGET_MS);
      firstDrawerOpen = false;

      await assertReducedMotion(
        drawer,
        page.getByRole("button", { name: /Close .* Admin Copilot/ })
      );
      const summarizeCommand = await revealCopilotCommand(drawer, /Summarize this page/);
      await summarizeCommand.click();
      await expect(drawer.locator('[data-admin-ai-response="true"]')).toHaveAttribute(
        "data-state",
        "offline-error"
      );
      await expect(drawer.getByText(/Copilot is optional/)).toBeVisible();
      await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();

      const closeMs = await measureKeyboardToDialogState(page, "Escape", drawerName, false);
      await expect(drawer).not.toBeVisible();
      expect(
        closeMs,
        `${moduleScenario.id} drawer close exceeded ${INTERACTION_BUDGET_MS}ms`
      ).toBeLessThanOrEqual(INTERACTION_BUDGET_MS);
      await expect(pill).toBeFocused();
      await assertPreservedPageState(preserved);
      await assertCurrentCLS(`${moduleScenario.id} offline-error flow`);
      await exerciseManualControl(page, moduleScenario.id);

      timings.push({ closeMs, module: moduleScenario.id, navigationMs, openMs });
    }

    await enableCopilotForCurrentPage(page);
    await page.unroute("**/api/admin/ai-settings", unavailableAdminAISettings);

    for (const moduleScenario of MODULE_SCENARIOS) {
      await openModule(page, moduleScenario);
      await startCLSMeasurement(page);
      await page
        .getByRole("button", { name: `Open ${moduleScenario.sectionName} Admin Copilot` })
        .click();
      const drawer = page.getByRole("dialog", {
        name: `${moduleScenario.sectionName} Admin Copilot`
      });
      const generateReport = await revealCopilotCommand(drawer, /Generate report/);
      await generateReport.click();
      const copyReport = drawer.getByRole("button", { name: "Copy report" });
      await expect(copyReport).not.toBeVisible();
      const confirmation = drawer.getByRole("alertdialog", {
        name: "Generate report",
        exact: true
      });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Apply suggestion", exact: true }).click();
      await expect(confirmation).not.toBeVisible();
      const largeReportConfirmation = drawer.getByRole("alertdialog", {
        name: "Large report confirmation",
        exact: true
      });
      if (await largeReportConfirmation.isVisible()) {
        await largeReportConfirmation
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await expect(largeReportConfirmation).not.toBeVisible();
      }
      await expect(copyReport).toBeVisible();
      await assertLongReportScrolls(drawer, moduleScenario.id);
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
      await assertCurrentCLS(`${moduleScenario.id} report flow`);
    }

    await startCLSMeasurement(page);
    await assertLiveServiceFailureKeepsOverviewUsable(page);
    await assertCurrentCLS("live-service failure flow");

    if (testInfo.project.name === "mobile") {
      await startCLSMeasurement(page);
      await assertSelectedCoachSiteContext(page);
      await assertCurrentCLS("selected coach-site flow");
      await startCLSMeasurement(page);
      await assertRouteChangeContinuesLongRead(page);
      await assertCurrentCLS("route-change long-read flow");
    }

    const cls = Math.max(0, ...clsMeasurements.map(({ value }) => value));
    expect(pageErrors).toEqual([]);

    await testInfo.attach("admin-copilot-performance-budgets.json", {
      body: Buffer.from(
        JSON.stringify(
          {
            budgets: {
              cls: CLS_BUDGET,
              firstDrawerOpenMs: FIRST_DRAWER_OPEN_BUDGET_MS,
              interactionMs: INTERACTION_BUDGET_MS,
              moduleNavigationMs: MODULE_NAVIGATION_BUDGET_MS
            },
            cls,
            clsMeasurements,
            project: testInfo.project.name,
            timings
          },
          null,
          2
        )
      ),
      contentType: "application/json"
    });
  });

  test("continues a bounded external read across same-permission module navigation", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "One desktop flow proves same-boundary continuity."
    );
    test.setTimeout(90_000);

    await loginToAdminV2(page);
    await enableCopilotForCurrentPage(page);
    await assertRouteChangeContinuesLongRead(page);
  });

  test("keeps Analytics coach-site identity exact and fails closed for unresolved targets", async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Identity handoff runs once on desktop.");
    test.setTimeout(120_000);

    const fixtures = await installCoachIdentityFixtureRoutes(page);
    await loginToAdminV2ViaOtpVerification(page);
    await openModule(page, getModuleScenario("coach-analytics"));

    const analyticsTable = page.locator(".v2-coach-analytics-table");
    const targetRow = analyticsTable
      .locator("tbody tr")
      .filter({ hasText: fixtures.coachB.coachName });
    await expect(targetRow).toHaveCount(1);
    const targetIndex = await analyticsTable
      .locator("tbody tr")
      .evaluateAll(
        (rows, coachName) =>
          rows.findIndex((row) => (row.textContent || "").includes(String(coachName))),
        fixtures.coachB.coachName
      );
    expect(targetIndex, "coach B must not be the first Analytics record").toBeGreaterThan(0);

    await targetRow
      .getByRole("button", {
        name: `Open coach operations for ${fixtures.coachB.coachName}`,
        exact: true
      })
      .click();

    await expectFocusedCoachSite(page, fixtures.coachB);
    await expect.poll(() => new URL(page.url()).searchParams.get("site")).toBe(fixtures.coachB.id);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("coach"))
      .toBe(fixtures.coachB.slug);
    await expectSingleCoachSiteCopilotSelection(page, fixtures.coachB);

    const commandDeck = page.getByLabel("Coach operations command deck");
    await commandDeck.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `${fixtures.coachB.coachName} is now paused.` })
    ).toBeVisible();
    expect(fixtures.statusPatches).toEqual([{ siteId: fixtures.coachB.id, status: "paused" }]);

    await page.goto(
      `/admin/dashboard?view=coach-sites&site=${encodeURIComponent(fixtures.coachB.id)}`
    );
    await page.reload();
    await expectFocusedCoachSite(page, fixtures.coachB);

    await page.goto(
      `/admin/dashboard?view=coach-sites&coach=${encodeURIComponent(fixtures.coachB.slug)}`
    );
    await page.reload();
    await expectFocusedCoachSite(page, fixtures.coachB);
    expect(fixtures.statusPatches.map(({ siteId }) => siteId)).toEqual([fixtures.coachB.id]);

    const cases = [
      {
        label: "invalid",
        url: "/admin/dashboard?view=coach-sites&site=missing-site&coach=missing-coach"
      },
      {
        label: "ambiguous",
        url: `/admin/dashboard?view=coach-sites&coach=${encodeURIComponent(fixtures.ambiguousSlug)}`
      },
      {
        label: "contradictory",
        url: `/admin/dashboard?view=coach-sites&site=${encodeURIComponent(
          fixtures.coachB.id
        )}&coach=${encodeURIComponent(fixtures.coachA.slug)}`
      }
    ];

    for (const identityCase of cases) {
      await test.step(`${identityCase.label} target`, async () => {
        await page.goto(identityCase.url);
        await expectCoachSiteFocusToFailClosed(page);
      });
    }

    expect(fixtures.statusPatches).toEqual([{ siteId: fixtures.coachB.id, status: "paused" }]);
  });

  test("keeps every non-executable confirmation and OTP handoff bounded", async ({
    page
  }, testInfo) => {
    test.skip(
      !RESPONSIVE_PROJECTS.has(testInfo.project.name),
      "This bounded matrix covers mobile, tablet, and desktop."
    );
    test.setTimeout(180_000);

    const protectedMutationRequests: string[] = [];
    page.on("request", (request) => {
      if (isProtectedMutation(request)) {
        protectedMutationRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/admin/ai-settings", exposeReviewOnlyDangerousCommands);
    await loginToAdminV2(page);
    expect(NON_EXECUTABLE_CONFIRMATIONS).toHaveLength(9);
    expect(NON_EXECUTABLE_CONFIRMATIONS.filter(({ command }) => command.otpRequired)).toHaveLength(
      4
    );

    for (const { command, moduleScenario } of NON_EXECUTABLE_CONFIRMATIONS) {
      await openModule(page, moduleScenario);
      const drawer = await openCopilot(page, moduleScenario.sectionName);

      const commandButton = await revealCopilotCommand(
        drawer,
        new RegExp(`^${escapeRegExp(command.label)}(?:\\s|$)`)
      );
      await commandButton.click();
      let confirmation = drawer.getByRole("alertdialog", { name: command.label, exact: true });
      await expect(confirmation).toBeVisible();
      await expect(confirmation).toHaveAttribute(
        "data-execution-availability",
        command.executionContract.availability
      );
      if (command.otpRequired) {
        await expect(confirmation).toContainText("Existing OTP required");
        await expect(confirmation).toContainText(/cannot read, submit, or bypass an OTP/i);
      }
      await assertConfirmationUsable(confirmation, page, testInfo.project.name);
      await confirmation.getByRole("button", { name: "Cancel" }).focus();
      await page.keyboard.press("Enter");
      await expect(drawer.getByRole("heading", { name: "Action cancelled" })).toBeVisible();

      await commandButton.click();
      confirmation = drawer.getByRole("alertdialog", { name: command.label, exact: true });
      const approve = confirmation.getByRole("button", {
        name: confirmationLabel(command),
        exact: true
      });
      await approve.scrollIntoViewIfNeeded();
      await approve.focus();
      await page.keyboard.press("Enter");
      await expect(confirmation).not.toBeVisible();
      await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
      if (command.kind === "navigate" && command.destinationView) {
        const destination = getModuleScenario(command.destinationView as RegistryModuleId);
        await expect(drawer).not.toBeVisible();
        await expect(
          page.getByRole("heading", { name: destination.heading, exact: true }).first()
        ).toBeVisible();
        await expect
          .poll(() => new URL(page.url()).searchParams.get("view"))
          .toBe(command.destinationView);
      } else {
        await expect(drawer.locator('[data-admin-ai-response="true"]')).toHaveAttribute(
          "data-state",
          /^(action-prepared|blocked-missing-data|missing-data|ready)$/
        );
        await page.keyboard.press("Escape");
      }

      await expect(drawer).not.toBeVisible();
    }

    expect(protectedMutationRequests).toEqual([]);
    await page.unroute("**/api/admin/ai-settings", exposeReviewOnlyDangerousCommands);
  });

  test("fails closed and persists both disposable registered actions through refresh", async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Disposable lifecycle runs once on desktop.");
    test.setTimeout(180_000);

    await loginToAdminV2(page);
    const session = await getAdminSession(page);
    const seededReferenceId = await seedErrorReport(page, testInfo.project.name);
    await page.reload();
    await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();

    try {
      await verifyErrorReportActionLifecycle(page, seededReferenceId, session.csrfToken);
      await verifySettingsActionLifecycle(page, session.csrfToken);
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await markErrorReportFixed(page, seededReferenceId, session.csrfToken);
    }
  });

  test("persists section navigation through the view query parameter", async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Deep-link regression runs once on desktop.");

    await loginToAdminV2(page);
    await selectAdminSection(page, "Analytics");
    await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("coach-analytics");

    await page.reload();
    await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coach-specific analytics" })).toBeVisible();
  });
});

async function loginToAdminV2(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Admin email").fill(smokeEmail);
  await page.getByRole("button", { name: "Send one-time code" }).click();
  await expect(page.getByRole("heading", { name: "Verify Your Identity" })).toBeVisible();
  await page.getByLabel("6-digit verification code").fill(smokeOtp);
  await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
}

async function loginToAdminV2ViaOtpVerification(page: Page) {
  const response = await page.request.post("/api/admin/auth/email/verify", {
    data: { email: smokeEmail, otp: smokeOtp }
  });
  const payload = (await response.json()) as {
    admin?: { email?: string };
    authenticated?: boolean;
    error?: string;
    ok?: boolean;
  };

  expect(response.status(), payload.error || "Direct OTP verification failed.").toBe(200);
  expect(payload).toMatchObject({
    admin: { email: smokeEmail },
    authenticated: true,
    ok: true
  });

  await page.goto("/admin/dashboard");
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
}

async function openModule(page: Page, scenario: ModuleScenario) {
  if (scenario.parentNav && scenario.nestedButton) {
    await selectAdminSection(page, scenario.parentNav);
    const parentScenario = getModuleScenarioByNav(scenario.parentNav);
    await expect(
      page.getByRole("heading", { name: parentScenario.heading, exact: true }).first()
    ).toBeVisible();
    await page.getByRole("button", { name: scenario.nestedButton, exact: true }).click();
  } else if (scenario.nav) {
    await selectAdminSection(page, scenario.nav);
  }
  await expect(
    page.getByRole("heading", { name: scenario.heading, exact: true }).first()
  ).toBeVisible();
}

async function measureModuleNavigation(page: Page, scenario: ModuleScenario) {
  let trigger: Locator;
  if (scenario.parentNav && scenario.nestedButton) {
    await selectAdminSection(page, scenario.parentNav);
    const parentScenario = getModuleScenarioByNav(scenario.parentNav);
    await expect(
      page.getByRole("heading", { name: parentScenario.heading, exact: true }).first()
    ).toBeVisible();
    trigger = page.getByRole("button", { name: scenario.nestedButton, exact: true });
  } else if (scenario.nav) {
    const menuButton = page.getByRole("button", { name: /Open (admin )?navigation/i });
    if (await menuButton.isVisible().catch(() => false)) {
      await menuButton.click();
    }
    trigger = page
      .locator("#admin-sidebar")
      .getByRole("button", { name: new RegExp(`^${escapeRegExp(scenario.nav)}$`, "i") })
      .first();
  } else {
    throw new Error(`Missing navigation trigger for ${scenario.id}`);
  }

  const navigationMs = await measureClickToVisibleHeading(page, trigger, scenario.heading);
  await expect(
    page.getByRole("heading", { name: scenario.heading, exact: true }).first()
  ).toBeVisible();
  return navigationMs;
}

async function selectAdminSection(page: Page, label: string) {
  const sidebar = page.locator("#admin-sidebar");
  const menuButton = page.getByRole("button", { name: /Open (admin )?navigation/i });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
  await sidebar
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}$`, "i") })
    .first()
    .click();
}

async function openCopilot(page: Page, sectionName: string) {
  await page.getByRole("button", { name: `Open ${sectionName} Admin Copilot` }).click();
  const drawer = page.getByRole("dialog", { name: `${sectionName} Admin Copilot` });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function revealCopilotCommand(drawer: Locator, name: RegExp | string) {
  const command = drawer.getByRole("button", { name });
  if (!(await command.isVisible().catch(() => false))) {
    await drawer.locator("details").filter({ hasText: "More commands" }).locator("summary").click();
  }
  await expect(command).toBeVisible();
  return command;
}

function getPrimaryTarget(page: Page, moduleId: RegistryModuleId): Locator {
  switch (moduleId) {
    case "overview":
      return page
        .getByLabel("Overview analytics")
        .getByRole("button", { name: "Open Analytics", exact: true });
    case "coach-sites":
      return page.getByRole("button", { name: /^Reset filters/ });
    case "create-coach-site":
      return page.getByLabel("Coach name");
    case "coach-analytics":
      return page.getByLabel("Search coach analytics");
    case "top-coaches":
      return page.getByRole("heading", { name: "Coach leaderboard", exact: true });
    case "shop":
      return page.getByLabel("Payment page URL");
    case "error-reports":
      return page.getByLabel("Cleanup target");
    case "backup-cleanup":
      return page.getByLabel("Include Shop records in backup");
    case "paid-masterclass-settings":
      return page.getByRole("button", { name: "Manage", exact: true }).first();
    case "settings":
      return page.getByLabel("Support name");
    case "admin-users":
      return page.getByRole("button", { name: "Invite admin", exact: true });
  }
}

async function exerciseManualControl(page: Page, moduleId: RegistryModuleId) {
  const control = getPrimaryTarget(page, moduleId);
  if (moduleId === "top-coaches") {
    await expect(page.getByRole("table").first()).toBeVisible();
    return;
  }

  await control.focus();
  await expect(control).toBeFocused();

  if (moduleId === "overview") {
    await control.click();
    await expect(page.getByRole("heading", { name: "Coach-specific analytics" })).toBeVisible();
    return;
  }
  if (moduleId === "coach-sites") {
    await control.click();
    await expect(page.getByLabel("Filter coach sites by status")).toHaveValue("all");
    return;
  }
  if (moduleId === "paid-masterclass-settings") {
    await control.click();
    const dialog = page.getByRole("dialog", { name: "Manage paid masterclass" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();
    return;
  }
  if (moduleId === "admin-users") {
    await control.click();
    const dialog = page.getByRole("dialog", { name: "Invite administrator" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
  }
}

async function preparePreservedPageState(page: Page, moduleId: RegistryModuleId, project: string) {
  if (moduleId === "create-coach-site") {
    const field = page.getByLabel("Coach name");
    const value = `Unsaved Copilot failure ${project}`;
    await field.fill(value);
    return { field, value };
  }
  if (moduleId === "coach-sites") {
    const field = page.getByLabel("Find coach sites");
    const value = "wellness";
    await field.fill(value);
    return { field, value };
  }
  return null;
}

async function assertPreservedPageState(preserved: { field: Locator; value: string } | null) {
  if (!preserved) return;
  await expect(preserved.field).toHaveValue(preserved.value);
}

async function enableCopilotForCurrentPage(page: Page) {
  const settingsScenario = getModuleScenario("settings");
  await openModule(page, settingsScenario);
  const drawer = await openCopilot(page, settingsScenario.sectionName);
  await drawer.getByRole("button", { name: "AI settings and privacy" }).click();
  const enabled = drawer.getByLabel("Enable Admin Copilot commands");
  if (!(await enabled.isChecked())) {
    await enabled.check();
  }
  await expect(enabled).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
}

async function unavailableAdminAISettings(route: Route) {
  await route.fulfill({
    body: JSON.stringify({ error: "Injected local Admin AI settings outage", ok: false }),
    contentType: "application/json",
    status: 503
  });
}

async function exposeReviewOnlyDangerousCommands(route: Route) {
  if (route.request().method() !== "GET") {
    await route.fallback();
    return;
  }
  const response = await route.fetch();
  const payload = (await response.json()) as {
    settings?: {
      effectivePolicy?: { actionPermissions?: { dangerousEnabled?: boolean } };
    };
  };
  const permissions = payload.settings?.effectivePolicy?.actionPermissions;
  if (permissions) permissions.dangerousEnabled = true;
  await route.fulfill({ json: payload, response });
}

async function assertLiveServiceFailureKeepsOverviewUsable(page: Page) {
  const overview = getModuleScenario("overview");
  await openModule(page, overview);
  let requestCount = 0;
  const handler = async (route: Route) => {
    requestCount += 1;
    await route.fulfill({
      body: JSON.stringify({
        failure: { retryable: true },
        message: "Injected local provider outage",
        ok: false
      }),
      contentType: "application/json",
      status: 503
    });
  };
  await page.route("**/api/admin/analytics-insights", handler);

  const drawer = await openCopilot(page, overview.sectionName);
  const generateLiveInsight = await revealCopilotCommand(drawer, /^Generate live insight(?:\s|$)/);
  await generateLiveInsight.click();
  const liveInsightUnavailable = drawer.getByRole("heading", {
    name: /^Live AI insight (?:is disabled|unavailable)$/
  });
  await expect(liveInsightUnavailable).toBeVisible();
  await expect(drawer.locator('[data-admin-ai-response="true"]')).toHaveAttribute(
    "data-state",
    "offline-error"
  );
  const retry = drawer.getByRole("button", { name: /Retry request/ });
  await expect(retry).toBeVisible();
  const liveModelDisabled = await drawer
    .getByRole("heading", { name: "Live AI insight is disabled" })
    .isVisible();
  if (liveModelDisabled) {
    expect(requestCount).toBe(0);
    await retry.click();
    await expect(drawer.locator('[data-admin-ai-response="true"]')).toHaveAttribute(
      "data-state",
      "offline-error"
    );
    expect(requestCount).toBe(0);
  } else {
    const retryResponse = page.waitForResponse("**/api/admin/analytics-insights");
    await retry.click();
    await retryResponse;
    await expect.poll(() => requestCount).toBe(2);
  }
  await expect(drawer.getByRole("button", { name: "Cancel", exact: true })).not.toBeVisible();
  await page.keyboard.press("Escape");
  await page.unroute("**/api/admin/analytics-insights", handler);

  await page
    .getByLabel("Overview analytics")
    .getByRole("button", { name: "Open Analytics", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Coach-specific analytics" })).toBeVisible();
}

async function assertSelectedCoachSiteContext(page: Page) {
  const coachSites = getModuleScenario("coach-sites");
  await openModule(page, coachSites);
  const rowSelection = page.getByRole("checkbox", { name: /^Select (?!all visible)/ }).first();
  await rowSelection.check();
  const drawer = await openCopilot(page, coachSites.sectionName);
  await expect(drawer.getByText(/1 selected \/ \d+ indexed records/)).toBeVisible();
  const selectionScope = drawer.getByRole("button", { name: "Selected Records", exact: true });
  await expect(selectionScope).toBeEnabled();
  await selectionScope.click();
  await expect(selectionScope).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await rowSelection.uncheck();
  const reopened = await openCopilot(page, coachSites.sectionName);
  await expect(
    reopened.getByRole("button", { name: "Selected Records", exact: true })
  ).toBeDisabled();
  await page.keyboard.press("Escape");
}

type CoachIdentityFixtureHarness = {
  ambiguousSlug: string;
  coachA: CoachSiteRecord;
  coachB: CoachSiteRecord;
  statusPatches: Array<{ siteId?: string; status?: string }>;
};

async function installCoachIdentityFixtureRoutes(page: Page): Promise<CoachIdentityFixtureHarness> {
  const ambiguousSlug = "copilot-ambiguous-coach";
  const coachA = createCoachIdentityFixture({
    coachId: "copilot-coach-a",
    coachName: "Alpha Copilot Coach A",
    id: "copilot-site-a",
    slug: "copilot-coach-a"
  });
  const coachB = createCoachIdentityFixture({
    coachId: "copilot-coach-b",
    coachName: "Zulu Copilot Coach B",
    id: "copilot-site-b",
    slug: "copilot-coach-b"
  });
  const ambiguousOne = createCoachIdentityFixture({
    coachId: "copilot-ambiguous-one",
    coachName: "Copilot Ambiguous Coach One",
    id: "copilot-ambiguous-site-one",
    slug: ambiguousSlug
  });
  const ambiguousTwo = createCoachIdentityFixture({
    coachId: "copilot-ambiguous-two",
    coachName: "Copilot Ambiguous Coach Two",
    id: "copilot-ambiguous-site-two",
    slug: ambiguousSlug
  });
  let sites = [coachA, coachB, ambiguousOne, ambiguousTwo];
  const statusPatches: Array<{ siteId?: string; status?: string }> = [];

  await page.route("**/api/admin/coach-sites", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          coachSites: sites,
          configured: true,
          ok: true
        })
      });
      return;
    }

    if (request.method() === "PATCH") {
      const body = parseCoachSiteStatusPatch(request.postData());
      statusPatches.push(body);
      const current = sites.find((site) => site.id === body.siteId);
      if (!current || !isCoachSiteStatus(body.status)) {
        await route.fulfill({
          contentType: "application/json",
          status: 400,
          body: JSON.stringify({ error: "Invalid test coach-site target.", ok: false })
        });
        return;
      }

      const updated: CoachSiteRecord = {
        ...current,
        status: body.status,
        updatedAt: "2026-07-27T12:00:00.000Z"
      };
      sites = sites.map((site) => (site.id === updated.id ? updated : site));
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({ coachSite: updated, ok: true })
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      status: 405,
      body: JSON.stringify({ error: "Unexpected coach-site mutation in identity test.", ok: false })
    });
  });

  return { ambiguousSlug, coachA, coachB, statusPatches };
}

function createCoachIdentityFixture({
  coachId,
  coachName,
  id,
  slug
}: {
  coachId: string;
  coachName: string;
  id: string;
  slug: string;
}) {
  const site = createCoachSiteFromForm({
    form: {
      ...EMPTY_COACH_SITE_FORM,
      bio: "Permission-visible disposable browser identity fixture.",
      coachEmail: `${slug}@example.com`,
      coachName,
      coachPhone: "9876543210",
      googleFormUrl: `https://example.com/register/${slug}`,
      heroMediaType: "none",
      location: "Pune",
      niche: "Copilot identity verification",
      slug,
      supportText: "Test support",
      vision: "Keep Analytics and Coach Sites identity exact."
    },
    id,
    status: "published"
  });

  return {
    ...site,
    coachId,
    analytics: {
      ...site.analytics,
      lastUpdated: "2026-07-27T10:00:00.000Z",
      region: "Pune",
      source: "copilot-identity-fixture"
    }
  };
}

async function expectFocusedCoachSite(page: Page, site: CoachSiteRecord) {
  await expect(
    page.getByRole("heading", { name: "Referral website control", exact: true })
  ).toBeVisible();
  const coachSitesPage = page.locator('section[aria-label="Coach Sites"]');
  const focusCard = coachSitesPage.locator(".v2-sites-focus");
  await expect(focusCard.getByRole("heading", { name: site.coachName, exact: true })).toBeVisible();

  const selectedRow = coachSitesPage
    .locator(".v2-sites-table tbody tr")
    .filter({ hasText: site.coachName });
  await expect(selectedRow).toHaveCount(1);
  await expect(selectedRow).toHaveAttribute("data-selected", "true");
  await expect(
    selectedRow.getByRole("checkbox", { name: `Select ${site.coachName}`, exact: true })
  ).toBeChecked();
  await expect(
    coachSitesPage.locator('.v2-sites-table tbody input[type="checkbox"]:checked')
  ).toHaveCount(1);
}

async function expectSingleCoachSiteCopilotSelection(page: Page, site: CoachSiteRecord) {
  const drawer = await openCopilot(page, "Coach Sites");
  await expect(drawer.getByText(/1 selected \/ \d+ indexed records/)).toBeVisible();
  await drawer.locator("details").filter({ hasText: "Context details" }).locator("summary").click();
  await expect(
    drawer.getByText(`Selected entity: ${site.coachName}`, { exact: true })
  ).toBeVisible();
  const selectionScope = drawer.getByRole("button", { name: "Selected Records", exact: true });
  await expect(selectionScope).toBeEnabled();
  await selectionScope.click();
  await expect(selectionScope).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
}

async function expectCoachSiteFocusToFailClosed(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Referral website control", exact: true })
  ).toBeVisible();
  const coachSitesPage = page.locator('section[aria-label="Coach Sites"]');
  await expect(
    coachSitesPage
      .getByRole("status")
      .filter({ hasText: "has no unique permission-visible coach-site match" })
  ).toBeVisible();
  await expect(
    coachSitesPage.locator('.v2-sites-table tbody input[type="checkbox"]:checked')
  ).toHaveCount(0);

  const focusCard = coachSitesPage.locator(".v2-sites-focus");
  await expect(focusCard.getByRole("button", { name: "Manage", exact: true })).toHaveCount(0);
  const commandDeck = coachSitesPage.getByLabel("Coach operations command deck");
  await expect(
    commandDeck.getByRole("button", { name: /^(Pause|Publish|Restore|Resume)$/ })
  ).toHaveCount(0);

  const drawer = await openCopilot(page, "Coach Sites");
  await expect(drawer.getByText(/0 selected \/ \d+ indexed records/)).toBeVisible();
  await drawer.locator("details").filter({ hasText: "Context details" }).locator("summary").click();
  await expect(drawer.getByText("Selected entity: None", { exact: true })).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Selected Records", exact: true })
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
}

function parseCoachSiteStatusPatch(value: string | null) {
  try {
    return JSON.parse(value || "{}") as { siteId?: string; status?: string };
  } catch {
    return {};
  }
}

function isCoachSiteStatus(value: string | undefined): value is CoachSiteStatus {
  return ["archived", "draft", "paused", "published", "removed"].includes(value || "");
}

async function assertRouteChangeContinuesLongRead(page: Page) {
  const overview = getModuleScenario("overview");
  await openModule(page, overview);
  let finishHandler!: () => void;
  let releaseRoute!: () => void;
  const handlerFinished = new Promise<void>((resolve) => {
    finishHandler = resolve;
  });
  const routeReleased = new Promise<void>((resolve) => {
    releaseRoute = resolve;
  });
  const handler = async (route: Route) => {
    await routeReleased;
    await route
      .fulfill({
        body: JSON.stringify({
          cache: "miss",
          insight: {
            keyTrends: ["Same-boundary continuity proof"],
            recommendations: [],
            summary: "Delayed provider response completed after navigation",
            warnings: []
          },
          ok: true
        }),
        contentType: "application/json",
        status: 200
      })
      .catch(() => undefined);
    finishHandler();
  };
  await page.route("**/api/admin/analytics-insights", handler);

  const drawer = await openCopilot(page, overview.sectionName);
  const requestStarted = page.waitForRequest("**/api/admin/analytics-insights").catch(() => null);
  const generateLiveInsight = await revealCopilotCommand(drawer, /^Generate live insight(?:\s|$)/);
  await generateLiveInsight.click();
  const disabledResponse = drawer.getByRole("heading", {
    name: "Live AI insight is disabled"
  });
  const liveModelDisabled = await disabledResponse
    .waitFor({ state: "visible", timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  if (liveModelDisabled) {
    releaseRoute();
    await page.unroute("**/api/admin/analytics-insights", handler);
    await page.keyboard.press("Escape");
    await openModule(page, getModuleScenario("coach-analytics"));
    await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
    const analyticsDrawer = await openCopilot(page, "Coach Analytics");
    await expect(analyticsDrawer.locator('[data-admin-ai-response="true"]')).toHaveAttribute(
      "data-state",
      "offline-error"
    );
    await expect(
      analyticsDrawer.getByRole("heading", { name: "Live AI insight is disabled" })
    ).toBeVisible();
    await expect(analyticsDrawer).not.toContainText(/cancelled because the admin context changed/i);
    await page.keyboard.press("Escape");
    return;
  }
  expect(await requestStarted).not.toBeNull();
  const menuButton = page.getByRole("button", { name: /Open (admin )?navigation/i });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.focus();
    await page.keyboard.press("Enter");
  }
  const analyticsNavigation = page
    .locator("#admin-sidebar")
    .getByRole("button", { name: /^Analytics$/i })
    .first();
  await analyticsNavigation.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Coach-specific analytics" })).toBeVisible();
  releaseRoute();
  await handlerFinished;

  await page.unroute("**/api/admin/analytics-insights", handler);
  await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
  const analyticsDrawer = await openCopilot(page, "Coach Analytics");
  await expect(analyticsDrawer.locator('[data-admin-ai-response="true"]')).toHaveAttribute(
    "data-state",
    "ready"
  );
  await expect(analyticsDrawer).toContainText(
    "Delayed provider response completed after navigation"
  );
  await expect(analyticsDrawer).not.toContainText(/cancelled because the admin context changed/i);
  await page.keyboard.press("Escape");
}

async function verifyErrorReportActionLifecycle(
  page: Page,
  referenceId: string,
  csrfToken: string
) {
  const reports = getModuleScenario("error-reports");
  await openModule(page, reports);
  await expect(page.getByRole("cell", { name: referenceId, exact: true })).toBeVisible();
  let drawer = await openCopilot(page, reports.sectionName);
  const query = drawer.getByLabel("Ask, search, investigate, report, or prepare an action");
  await query.fill(`Find ${referenceId}`);
  await drawer.getByRole("button", { name: "Run", exact: true }).click();
  const result = drawer.locator("article").filter({ hasText: referenceId });
  await expect(result).toBeVisible();
  const selectResult = result.getByRole("button", {
    name: new RegExp(`^Select .* record ${escapeRegExp(referenceId)}$`)
  });
  await selectResult.click();
  await expect(
    result.getByRole("button", {
      name: new RegExp(`^Deselect .* record ${escapeRegExp(referenceId)}$`)
    })
  ).toHaveAttribute("aria-pressed", "true");
  const pageScope = drawer.getByRole("button", { name: "This Page", exact: true });
  const selectionScope = drawer.getByRole("button", { name: "Selected Records", exact: true });
  await expect(pageScope).toHaveAttribute("aria-pressed", "true");
  await expect(selectionScope).toHaveAttribute("aria-pressed", "false");
  await expect(drawer.getByText(/0 selected \/ \d+ indexed records/)).toBeVisible();
  await expect(selectionScope).toBeEnabled();
  await selectionScope.click();
  await expect(selectionScope).toHaveAttribute("aria-pressed", "true");
  await expect(drawer.getByText(/1 selected \/ \d+ indexed records/)).toBeVisible();

  await openAndCancelRegisteredAction(drawer, "Mark selected report Reviewing");
  await expectErrorReportStatus(page, referenceId, "New");

  const failureHandler = failRegisteredAction("error-reports.mark-reviewing");
  await page.route("**/api/admin/ai-actions", failureHandler);
  await confirmRegisteredAction(drawer, "Mark selected report Reviewing");
  await expect(drawer.getByRole("heading", { name: "Report status update failed" })).toBeVisible();
  await expect(drawer.locator('[data-admin-ai-response="true"]')).toHaveAttribute(
    "data-state",
    "action-failed"
  );
  await expectErrorReportStatus(page, referenceId, "New");
  await page.unroute("**/api/admin/ai-actions", failureHandler);

  const actionResponse = waitForRegisteredActionResponse(page, "error-reports.mark-reviewing");
  await confirmRegisteredAction(drawer, "Mark selected report Reviewing");
  const payload = await actionResponse;
  await expect(drawer.getByRole("heading", { name: "Report marked Reviewing" })).toBeVisible();
  await expectErrorReportStatus(page, referenceId, "Reviewing");

  await page.reload();
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
  await expectErrorReportStatus(page, referenceId, "Reviewing");

  await rollbackRegisteredAction(page, payload, csrfToken);
  await page.reload();
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
  await expectErrorReportStatus(page, referenceId, "New");

  await openModule(page, reports);
  drawer = await openCopilot(page, reports.sectionName);
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
}

async function verifySettingsActionLifecycle(page: Page, csrfToken: string) {
  const initialValue = await getProactiveSuggestionsValue(page);
  const settings = getModuleScenario("settings");
  await openModule(page, settings);
  const drawer = await openCopilot(page, settings.sectionName);

  await openAndCancelRegisteredAction(drawer, "Update proactive suggestions");
  expect(await getProactiveSuggestionsValue(page)).toBe(initialValue);

  const failureHandler = failRegisteredAction("settings.update-proactive-suggestions");
  await page.route("**/api/admin/ai-actions", failureHandler);
  await confirmRegisteredAction(drawer, "Update proactive suggestions");
  await expect(
    drawer.getByRole("heading", { name: "Proactive suggestions update failed" })
  ).toBeVisible();
  expect(await getProactiveSuggestionsValue(page)).toBe(initialValue);
  await page.unroute("**/api/admin/ai-actions", failureHandler);

  const actionResponse = waitForRegisteredActionResponse(
    page,
    "settings.update-proactive-suggestions"
  );
  await confirmRegisteredAction(drawer, "Update proactive suggestions");
  const payload = await actionResponse;
  await expect(
    drawer.getByRole("heading", { name: "Proactive suggestions preference updated" })
  ).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
  expect(await getProactiveSuggestionsValue(page)).toBe(!initialValue);

  await rollbackRegisteredAction(page, payload, csrfToken);
  await page.reload();
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
  expect(await getProactiveSuggestionsValue(page)).toBe(initialValue);
}

async function openAndCancelRegisteredAction(drawer: Locator, label: string) {
  const command = await revealCopilotCommand(
    drawer,
    new RegExp(`^${escapeRegExp(label)}(?:\\s|$)`)
  );
  await command.click();
  const confirmation = drawer.getByRole("alertdialog", { name: label, exact: true });
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(drawer.getByRole("heading", { name: "Action cancelled" })).toBeVisible();
}

async function confirmRegisteredAction(drawer: Locator, label: string) {
  const command = await revealCopilotCommand(
    drawer,
    new RegExp(`^${escapeRegExp(label)}(?:\\s|$)`)
  );
  await command.click();
  const confirmation = drawer.getByRole("alertdialog", { name: label, exact: true });
  await confirmation.getByRole("button", { name: "Confirm action" }).click();
}

function failRegisteredAction(actionId: string) {
  return async (route: Route) => {
    const body = parseRequestBody(route.request().postData());
    if (body.mode !== "execute" || body.actionId !== actionId) {
      await route.continue();
      return;
    }
    await route.fulfill({
      body: JSON.stringify({ error: "Injected disposable action failure", ok: false }),
      contentType: "application/json",
      status: 503
    });
  };
}

async function waitForRegisteredActionResponse(page: Page, actionId: string) {
  const response = await page.waitForResponse((candidate) => {
    if (!candidate.url().includes("/api/admin/ai-actions")) return false;
    const body = parseRequestBody(candidate.request().postData());
    return body.mode === "execute" && body.actionId === actionId;
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as RegisteredActionPayload;
}

async function rollbackRegisteredAction(
  page: Page,
  payload: RegisteredActionPayload,
  csrfToken: string
) {
  const receiptId = payload.response?.rollbackAction?.receiptId;
  expect(receiptId).toMatch(/^admin-ai-receipt-[a-zA-Z0-9-]+$/);
  const response = await page.request.post("/api/admin/ai-actions", {
    data: { mode: "rollback", receiptId },
    headers: { "x-yw-admin-csrf": csrfToken }
  });
  expect(response.status()).toBe(200);
}

type RegisteredActionPayload = {
  response?: {
    rollbackAction?: { receiptId?: string };
  };
};

async function seedErrorReport(page: Page, project: string) {
  const response = await page.request.post("/api/error-report", {
    data: {
      category: "api_error",
      pagePath: "/admin/copilot-resilience-matrix",
      safeMessage: `Disposable Copilot lifecycle ${project} ${Date.now()}`,
      userAction: "admin_copilot_resilience_test"
    }
  });
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as { referenceId: string };
  expect(payload.referenceId).toMatch(/^YW-ERR-/);
  return payload.referenceId;
}

async function markErrorReportFixed(page: Page, referenceId: string, csrfToken: string) {
  const response = await page.request.patch("/api/admin/error-reports", {
    data: { referenceId, status: "Fixed" },
    headers: { "x-yw-admin-csrf": csrfToken }
  });
  expect(response.status()).toBe(200);
}

async function expectErrorReportStatus(page: Page, referenceId: string, expectedStatus: string) {
  const response = await page.request.get("/api/admin/error-reports");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    errorReports: Array<{ referenceId: string; status: string }>;
  };
  expect(payload.errorReports.find((item) => item.referenceId === referenceId)?.status).toBe(
    expectedStatus
  );
}

async function getProactiveSuggestionsValue(page: Page) {
  const response = await page.request.get("/api/admin/ai-settings");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    settings?: { preferences?: { proactiveSuggestionsEnabled?: unknown } };
  };
  const value = payload.settings?.preferences?.proactiveSuggestionsEnabled;
  expect(typeof value).toBe("boolean");
  return Boolean(value);
}

async function getAdminSession(page: Page) {
  const response = await page.request.get("/api/admin/auth/session");
  expect(response.status()).toBe(200);
  return (await response.json()) as { csrfToken: string };
}

async function assertLongReportScrolls(drawer: Locator, moduleId: RegistryModuleId) {
  const before = await drawer.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop
  }));
  expect(before.scrollHeight, `${moduleId} report did not overflow vertically`).toBeGreaterThan(
    before.clientHeight
  );
  await drawer.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect
    .poll(() => drawer.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before.scrollTop);
}

async function assertReducedMotion(drawer: Locator, pill: Locator) {
  const styles = await Promise.all(
    [drawer, pill].map((locator) =>
      locator.evaluate((element) => {
        const computed = window.getComputedStyle(element);
        return {
          animationDuration: computed.animationDuration,
          animationIterationCount: computed.animationIterationCount,
          animationName: computed.animationName,
          transitionDuration: computed.transitionDuration
        };
      })
    )
  );
  for (const style of styles) {
    expect(maxCssDurationMs(style.animationDuration)).toBeLessThanOrEqual(1);
    expect(maxCssIterationCount(style.animationIterationCount)).toBeLessThanOrEqual(2);
    expect(maxCssDurationMs(style.transitionDuration)).toBeLessThanOrEqual(1);
  }
}

function maxCssDurationMs(value: string) {
  return Math.max(
    ...value.split(",").map((token) => {
      const duration = token.trim();
      if (duration.endsWith("ms")) return Number.parseFloat(duration);
      if (duration.endsWith("s")) return Number.parseFloat(duration) * 1_000;
      return Number.POSITIVE_INFINITY;
    })
  );
}

function maxCssIterationCount(value: string) {
  return Math.max(
    ...value.split(",").map((token) => {
      const count = Number.parseFloat(token.trim());
      return Number.isFinite(count) ? count : Number.POSITIVE_INFINITY;
    })
  );
}

async function assertConfirmationUsable(confirmation: Locator, page: Page, project: string) {
  const buttons = confirmation.getByRole("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (project === "mobile") expect(box?.height || 0).toBeGreaterThanOrEqual(44);
  }
  const horizontal = await confirmation.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(horizontal.scrollWidth).toBeLessThanOrEqual(horizontal.clientWidth + 1);
  await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
}

function confirmationLabel(command: AdminAICommand) {
  if (command.approvalLevel >= 3) return "Continue to protected workflow";
  if (command.approvalLevel === 1) return "Apply suggestion";
  return "Confirm action";
}

function isProtectedMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return false;
  const pathname = new URL(request.url()).pathname;
  if (pathname === "/api/admin/ai-actions") return false;
  return [
    "/api/admin/backup-cleanup",
    "/api/admin/coach-sites",
    "/api/admin/masterclass-private-link",
    "/api/admin/masterclass-settings",
    "/api/admin/users"
  ].some((prefix) => pathname.startsWith(prefix));
}

async function assertNoOverlap(pill: Locator, target: Locator, moduleId: RegistryModuleId) {
  await target.scrollIntoViewIfNeeded();
  const [pillBox, targetBox] = await Promise.all([pill.boundingBox(), target.boundingBox()]);
  expect(pillBox, `${moduleId} Copilot Pill is not rendered`).not.toBeNull();
  expect(targetBox, `${moduleId} primary target is not rendered`).not.toBeNull();
  if (!pillBox || !targetBox) return;
  const overlaps =
    pillBox.x < targetBox.x + targetBox.width &&
    pillBox.x + pillBox.width > targetBox.x &&
    pillBox.y < targetBox.y + targetBox.height &&
    pillBox.y + pillBox.height > targetBox.y;
  expect(overlaps, `${moduleId} Copilot Pill overlaps its primary target`).toBe(false);
}

async function measureKeyboardToDialogState(
  page: Page,
  key: "Enter" | "Escape",
  dialogName: string,
  visible: boolean
) {
  const metricKey = `${dialogName}-${key}-${Date.now()}-${Math.random()}`;
  await page.evaluate(
    ({ expectedDialogName, expectedKey, expectedVisible, key }) => {
      type InteractionMetricWindow = Window & {
        __adminCopilotInteractionMetrics?: Record<string, number | null>;
      };
      const metricWindow = window as InteractionMetricWindow;
      metricWindow.__adminCopilotInteractionMetrics ||= {};
      metricWindow.__adminCopilotInteractionMetrics[key] = null;

      const isVisible = (element: HTMLElement) => {
        const styles = window.getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          styles.display !== "none" &&
          styles.visibility !== "hidden" &&
          bounds.width > 0 &&
          bounds.height > 0
        );
      };
      const dialogStateReached = () => {
        const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
          (candidate) => candidate.getAttribute("aria-label") === expectedDialogName
        );
        const rendered = Boolean(dialog && isVisible(dialog));
        return expectedVisible ? rendered : !rendered;
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== expectedKey) return;
        document.removeEventListener("keydown", handleKeyDown, true);
        const startedAt = performance.now();
        let animationFrame = 0;
        let settling = false;
        let timeout = 0;
        const observer = new MutationObserver(() => scheduleCheck());

        const finish = () => {
          window.clearTimeout(timeout);
          observer.disconnect();
          metricWindow.__adminCopilotInteractionMetrics![key] =
            Math.round((performance.now() - startedAt) * 100) / 100;
        };
        const checkState = () => {
          if (!dialogStateReached() || settling) return;
          settling = true;
          animationFrame = window.requestAnimationFrame(() => {
            animationFrame = window.requestAnimationFrame(finish);
          });
        };
        function scheduleCheck() {
          if (settling) return;
          window.cancelAnimationFrame(animationFrame);
          animationFrame = window.requestAnimationFrame(checkState);
        }

        observer.observe(document.documentElement, {
          attributes: true,
          childList: true,
          subtree: true
        });
        timeout = window.setTimeout(() => {
          observer.disconnect();
          window.cancelAnimationFrame(animationFrame);
        }, 15_000);
        scheduleCheck();
      };

      document.addEventListener("keydown", handleKeyDown, true);
    },
    {
      expectedDialogName: dialogName,
      expectedKey: key,
      expectedVisible: visible,
      key: metricKey
    }
  );

  await page.keyboard.press(key);
  await expect
    .poll(
      () =>
        page.evaluate(
          (key) =>
            (
              window as Window & {
                __adminCopilotInteractionMetrics?: Record<string, number | null>;
              }
            ).__adminCopilotInteractionMetrics?.[key] ?? null,
          metricKey
        ),
      { timeout: 15_000 }
    )
    .not.toBeNull();
  const measurement = await page.evaluate(
    (key) =>
      (
        window as Window & {
          __adminCopilotInteractionMetrics?: Record<string, number | null>;
        }
      ).__adminCopilotInteractionMetrics?.[key] ?? null,
    metricKey
  );
  if (measurement === null) throw new Error(`Missing ${dialogName} ${key} interaction metric.`);
  return measurement;
}

async function measureClickToVisibleHeading(page: Page, trigger: Locator, heading: string) {
  await trigger.evaluate((element, expectedHeading) => {
    type NavigationMeasurementWindow = Window & {
      __adminModuleNavigationMeasurement?: Promise<number>;
    };
    const measurementWindow = window as NavigationMeasurementWindow;
    measurementWindow.__adminModuleNavigationMeasurement = new Promise<number>(
      (resolve, reject) => {
        let animationFrame = 0;
        let observer: MutationObserver | null = null;
        let timeout = 0;

        const finish = (value: number) => {
          window.clearTimeout(timeout);
          window.cancelAnimationFrame(animationFrame);
          observer?.disconnect();
          resolve(Math.round(value * 100) / 100);
        };

        const onClick = () => {
          const startedAt = performance.now();
          const checkHeading = () => {
            const target = Array.from(
              document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,[role='heading']")
            ).find((candidate) => candidate.textContent?.trim() === expectedHeading);
            if (!target) return;
            const styles = window.getComputedStyle(target);
            const bounds = target.getBoundingClientRect();
            if (
              styles.display !== "none" &&
              styles.visibility !== "hidden" &&
              bounds.width > 0 &&
              bounds.height > 0
            ) {
              finish(performance.now() - startedAt);
            }
          };
          const scheduleCheck = () => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(checkHeading);
          };

          observer = new MutationObserver(scheduleCheck);
          observer.observe(document.body, { attributes: true, childList: true, subtree: true });
          timeout = window.setTimeout(() => {
            observer?.disconnect();
            reject(new Error(`Timed out waiting for visible heading: ${expectedHeading}`));
          }, 15_000);
          scheduleCheck();
        };

        element.addEventListener("click", onClick, { capture: true, once: true });
      }
    );
  }, heading);

  await trigger.click();
  return page.evaluate(async () => {
    const measurement = (
      window as Window & { __adminModuleNavigationMeasurement?: Promise<number> }
    ).__adminModuleNavigationMeasurement;
    if (!measurement) throw new Error("Module navigation measurement was not initialized.");
    return measurement;
  });
}

async function startCLSMeasurement(page: Page) {
  await page.evaluate(() => {
    type LayoutShiftSource = {
      currentRect: DOMRectReadOnly;
      node: Node | null;
      previousRect: DOMRectReadOnly;
    };
    type LayoutShiftEntry = PerformanceEntry & {
      hadRecentInput: boolean;
      sources?: LayoutShiftSource[];
      value: number;
    };
    type LayoutShiftDetail = {
      entries: Array<{
        at: number;
        sources: Array<{
          current: { height: number; width: number; x: number; y: number };
          node: string;
          previous: { height: number; width: number; x: number; y: number };
        }>;
        value: number;
      }>;
      value: number;
    };
    const metricsWindow = window as Window & {
      __adminCopilotCLS?: number;
      __adminCopilotCLSDetail?: LayoutShiftDetail;
      __adminCopilotCLSObserver?: PerformanceObserver;
    };
    metricsWindow.__adminCopilotCLSObserver?.disconnect();
    metricsWindow.__adminCopilotCLS = 0;
    metricsWindow.__adminCopilotCLSDetail = { entries: [], value: 0 };
    let currentSessionValue = 0;
    let currentSessionStartedAt = 0;
    let previousEntryAt = 0;
    let currentSessionEntries: LayoutShiftDetail["entries"] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (entry.hadRecentInput) continue;

        if (
          currentSessionValue > 0 &&
          entry.startTime - previousEntryAt < 1_000 &&
          entry.startTime - currentSessionStartedAt < 5_000
        ) {
          currentSessionValue += entry.value;
        } else {
          currentSessionValue = entry.value;
          currentSessionStartedAt = entry.startTime;
          currentSessionEntries = [];
        }

        previousEntryAt = entry.startTime;
        currentSessionEntries.push({
          at: Math.round(entry.startTime * 100) / 100,
          sources: (entry.sources || []).slice(0, 5).map((source) => ({
            current: copyLayoutShiftRect(source.currentRect),
            node: describeLayoutShiftNode(source.node),
            previous: copyLayoutShiftRect(source.previousRect)
          })),
          value: Math.round(entry.value * 100_000) / 100_000
        });
        currentSessionEntries = currentSessionEntries.slice(-12);
        if (currentSessionValue > (metricsWindow.__adminCopilotCLS || 0)) {
          metricsWindow.__adminCopilotCLS = currentSessionValue;
          metricsWindow.__adminCopilotCLSDetail = {
            entries: currentSessionEntries.map((item) => ({
              ...item,
              sources: item.sources.map((source) => ({ ...source }))
            })),
            value: Math.round(currentSessionValue * 100_000) / 100_000
          };
        }
      }
    });
    metricsWindow.__adminCopilotCLSObserver = observer;
    observer.observe({ type: "layout-shift" });

    function copyLayoutShiftRect(rect: DOMRectReadOnly) {
      return {
        height: Math.round(rect.height * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        x: Math.round(rect.x * 10) / 10,
        y: Math.round(rect.y * 10) / 10
      };
    }

    function describeLayoutShiftNode(node: Node | null) {
      if (!(node instanceof Element)) return node?.nodeName || "unknown";
      const id = node.id ? `#${node.id}` : "";
      const classes = Array.from(node.classList)
        .slice(0, 3)
        .map((className) => `.${className}`)
        .join("");
      const label = node.getAttribute("aria-label");
      return `${node.tagName.toLowerCase()}${id}${classes}${label ? `[aria-label="${label}"]` : ""}`;
    }
  });
}

async function readCLSMeasurement(page: Page) {
  return page.evaluate(() => {
    const metricsWindow = window as Window & {
      __adminCopilotCLS?: number;
      __adminCopilotCLSDetail?: unknown;
    };
    const value = metricsWindow.__adminCopilotCLS || 0;
    return {
      detail: metricsWindow.__adminCopilotCLSDetail,
      value: Math.round(value * 100_000) / 100_000
    };
  });
}

function getModuleScenario(id: RegistryModuleId) {
  const scenario = MODULE_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Missing browser scenario for ${id}`);
  return scenario;
}

function getModuleScenarioByNav(nav: string) {
  const scenario = MODULE_SCENARIOS.find((candidate) => candidate.nav === nav);
  if (!scenario) throw new Error(`Missing browser parent scenario for ${nav}`);
  return scenario;
}

function parseRequestBody(value: string | null) {
  try {
    return JSON.parse(value || "{}") as { actionId?: string; mode?: string };
  } catch {
    return {};
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
