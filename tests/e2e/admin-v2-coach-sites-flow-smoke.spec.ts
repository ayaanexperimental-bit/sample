import { expect, test } from "@playwright/test";
import { join } from "node:path";

const runCoachSitesSmoke = process.env.ADMIN_V2_COACH_SITES_SMOKE === "true";
const smokeEmail = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke@example.com";
const smokeOtp = process.env.ADMIN_V2_SMOKE_OTP || "123456";

test.describe("Admin V2 Coach Sites production flow smoke", () => {
  test.skip(
    !runCoachSitesSmoke,
    "Set ADMIN_V2_COACH_SITES_SMOKE=true for local Admin V2 Coach Sites flow smoke."
  );

  test("creates, previews, saves, publishes, and toggles a disposable coach site in native V2", async ({
    page,
    request
  }) => {
    test.setTimeout(240_000);
    const suffix = Date.now().toString(36);
    const coachName = `Codex V2 Native Coach ${suffix}`;
    const slug = `codex-v2-native-coach-${suffix}`;
    const registrationUrl = `https://example.com/register-${suffix}`;
    const consoleProblems: string[] = [];
    const pageErrors: string[] = [];
    const protectedResponseProblems: string[] = [];
    let expectingWrongDangerOtp = false;

    page.on("console", (message) => {
      if (message.type() !== "error") return;

      const text = message.text();
      if (expectingWrongDangerOtp && text.includes("status of 401")) return;
      const locationUrl = message.location().url;
      if (isLocalCspRscUpgradeNoise(text, locationUrl)) return;
      consoleProblems.push(locationUrl ? `${text} @ ${locationUrl}` : text);
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/admin/") && response.status() >= 400) {
        if (
          expectingWrongDangerOtp &&
          url.includes("/api/admin/coach-sites") &&
          response.status() === 401
        ) {
          return;
        }
        protectedResponseProblems.push(`${response.status()} ${url}`);
      }
    });

    await loginToAdminV2(page);
    await openCreateSiteModule(page);
    await assertSeparateV2Surface(page);
    await assertCreatorPanelsDoNotOverlap(page);

    const creator = page.locator('section[aria-label="Coach Website Creator"]');
    await expect(creator).toBeVisible();
    await expect(creator.getByRole("heading", { name: "Create Coach Website" })).toBeVisible();

    await creator.getByLabel(/^Coach name/i).fill(coachName);
    await creator.getByLabel(/^Coach location/i).fill("Pune");
    await creator.getByLabel(/^Public slug/i).fill(slug);
    await creator
      .getByLabel(/^Coach short bio/i)
      .fill("Disposable local coach site used only for Admin V2 production-flow smoke.");
    await creator.getByRole("button", { name: "Next" }).click();

    await creator.getByLabel(/^Hero media type/i).selectOption("image");
    const mediaUploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/coach-sites/media") &&
        !response.url().includes("media-reprocess") &&
        response.request().method() === "POST"
    );
    await creator
      .getByLabel("Upload coach photo")
      .setInputFiles(join(process.cwd(), "public", "assets", "yw-nutritech-logo.png"));
    const mediaUpload = await mediaUploadResponse;
    expect(mediaUpload.status()).toBe(200);
    await expect(mediaUpload.json()).resolves.toMatchObject({
      media: {
        processingProvider: "already-transparent",
        processingStatus: "cutout_ready"
      },
      ok: true
    });
    const mediaResult = creator.locator('.v2-media-result[data-status="cutout_ready"]');
    await expect(mediaResult).toBeVisible();
    await expect(mediaResult.getByText("Cutout ready")).toBeVisible();
    await expect(mediaResult.getByRole("button", { name: "Use cutout" })).toBeVisible();
    await expect(mediaResult.getByRole("button", { name: "Use original frame" })).toBeVisible();

    const mediaReprocessResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/coach-sites/media-reprocess") &&
        response.request().method() === "POST"
    );
    await mediaResult.getByRole("button", { name: "Reprocess image" }).click();
    const mediaReprocess = await mediaReprocessResponse;
    expect(mediaReprocess.status()).toBe(200);
    await expect(mediaReprocess.json()).resolves.toMatchObject({
      media: { processingStatus: "cutout_ready" },
      ok: true
    });
    await creator.getByRole("button", { name: "Next" }).click();

    await creator.getByLabel(/^Coach niche/i).fill("Admin V2 smoke testing");
    await creator
      .getByLabel(/^Coach vision\/mission/i)
      .fill("Keep the native Admin V2 builder, preview, publish, and status controls intact.");
    await creator
      .getByLabel(/^Primary benefits/i)
      .fill("Native V2 preview\nProduction API save\nPublic page publish");
    await creator.getByRole("button", { name: "Next" }).click();

    await creator.getByLabel(/^Registration\/contact link/i).fill(registrationUrl);
    await creator.getByLabel("Support email", { exact: true }).fill("support@example.com");
    await creator.getByLabel("Support phone", { exact: true }).fill("9876543210");
    await creator.getByLabel(/^Register button text/i).fill("Reserve slot");

    await creator.getByRole("button", { name: "Save Draft" }).click();
    await expectV2InlineStatus(page, `${coachName} draft saved.`);
    await assertSeparateV2Surface(page);

    await creator.getByRole("button", { name: "Go to preview" }).click();
    await expectV2InlineStatus(page, "Preview ready. Review it before publishing.");
    await expect(creator.getByText(coachName).first()).toBeVisible();
    await creator.getByRole("button", { name: "Generate Preview" }).click();
    await expect(creator.getByText("Check the coach page before publishing")).toBeVisible();
    await assertSeparateV2Surface(page);

    await creator.getByRole("button", { name: "Continue to publish" }).click();
    await creator.getByRole("button", { name: "Publish", exact: true }).click();
    await expectV2InlineStatus(page, `Successfully published. Stable public link: /coach/${slug}`);
    await assertSeparateV2Surface(page);

    const publicResponse = await request.get(`/coach/${slug}`);
    expect(publicResponse.ok()).toBeTruthy();
    const publicHtml = await publicResponse.text();
    expect(publicHtml).toContain(coachName);
    expect(publicHtml).toContain(registrationUrl);
    expect(publicHtml).toContain("%2Fimage%2Fcutout%2F");
    expect(publicHtml).toContain('data-track="coach_register_click"');

    await creator.getByRole("button", { name: "Back to Coach Sites" }).first().click();
    await expect(
      page.getByRole("heading", { exact: true, name: "Referral website control" })
    ).toBeVisible();
    await page.getByLabel(/^Find coach/i).fill(coachName);
    const coachRow = page.getByRole("row", { name: new RegExp(escapeRegExp(coachName)) });
    await expect(coachRow).toBeVisible();

    await coachRow.getByRole("button", { name: "Manage", exact: true }).click();
    const manageDialog = page.getByRole("dialog", {
      name: new RegExp(`Manage ${escapeRegExp(coachName)}`)
    });
    await expect(manageDialog).toBeVisible();
    await expect(manageDialog.getByRole("button", { name: "Edit full site" })).toBeVisible();
    await expect(manageDialog.getByRole("button", { name: "Open public preview" })).toBeVisible();
    await expect(manageDialog.getByRole("button", { name: "Open analytics" })).toBeVisible();
    await manageDialog.getByRole("button", { name: "Edit full site" }).click();

    const editCreator = page.locator('section[aria-label="Coach Website Creator"]');
    await expect(editCreator.getByRole("heading", { name: `Edit ${coachName}` })).toBeVisible();
    await editCreator.getByRole("button", { name: /3 Program content/ }).click();
    await expect(editCreator.getByRole("button", { name: "Analyze paid funnel" })).toBeVisible();
    await expect(editCreator.getByRole("button", { name: "Generate complete copy" })).toBeVisible();
    await expect(editCreator.getByLabel("Analyzed paid-funnel context")).toBeVisible();
    const originalIntroHeading = "Original builder heading";
    const suggestedIntroHeading = "Reviewed AI builder heading";
    await editCreator.getByLabel("Intro heading").fill(originalIntroHeading);
    await page.route("**/api/admin/coach-sites/generate-copy", async (route) => {
      await route.fulfill({
        json: {
          configured: true,
          content: { introHeading: suggestedIntroHeading },
          ok: true
        }
      });
    });

    await editCreator.getByRole("button", { name: "Generate complete copy" }).click();
    const copyReview = editCreator.getByRole("region", { name: "AI copy suggestion review" });
    await expect(copyReview).toBeVisible();
    await expect(editCreator.getByRole("button", { name: "Generate complete copy" })).toBeDisabled();
    await expect(editCreator.getByLabel("Intro heading")).toHaveValue(originalIntroHeading);
    await copyReview.getByText("Intro heading", { exact: true }).click();
    await expect(copyReview.getByText(originalIntroHeading, { exact: true })).toBeVisible();
    await expect(copyReview.getByText(suggestedIntroHeading, { exact: true })).toBeVisible();
    await expect(copyReview.getByText("Reason", { exact: true }).first()).toBeVisible();
    await copyReview.getByRole("button", { name: "Reject all", exact: true }).click();
    await expect(copyReview).toBeHidden();
    await expect(editCreator.getByLabel("Intro heading")).toHaveValue(originalIntroHeading);

    await editCreator.getByRole("button", { name: "Generate complete copy" }).click();
    await editCreator.getByLabel("Intro heading").fill("Manual edit after generation");
    await expect(copyReview).toBeVisible();
    await expect(
      copyReview.getByRole("heading", { name: "4 AI copy suggestions are staged", exact: true })
    ).toBeVisible();
    await copyReview.getByRole("button", { name: "Apply 4 suggestions", exact: true }).click();
    await expect(editCreator.getByLabel("Intro heading")).toHaveValue(
      "Manual edit after generation"
    );
    await expectStaleSuggestionBatchResult(page, 4);

    await editCreator.getByRole("button", { name: "Generate complete copy" }).click();
    await copyReview.getByText("Intro heading", { exact: true }).click();
    await copyReview.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(editCreator.getByLabel("Intro heading")).toHaveValue(suggestedIntroHeading);
    await page.unroute("**/api/admin/coach-sites/generate-copy");
    await editCreator.getByRole("button", { name: /5 Preview/ }).click();
    const canonicalPreview = editCreator.locator(".v2-canonical-preview-panel");
    await expect(canonicalPreview.getByText("Exact public-page preview")).toBeVisible();
    await canonicalPreview.getByRole("button", { name: "Inspect", exact: true }).click();
    await canonicalPreview.locator('[data-inspect-target="hero"]').first().click();
    await expect(editCreator.getByText("Selected preview slot")).toBeVisible();
    await expect(editCreator.getByLabel("Hero headline")).toBeVisible();
    await editCreator.getByRole("button", { name: "Save Changes" }).click();
    await expectV2InlineStatus(page, `${coachName} changes saved with published status preserved.`);
    await editCreator.getByRole("button", { name: "Back to Coach Sites" }).first().click();
    await page.getByLabel(/^Find coach/i).fill(coachName);
    await expect(coachRow).toBeVisible();

    await coachRow.getByRole("button", { name: "Pause" }).click();
    await expectV2InlineStatus(page, `${coachName} is now paused.`);
    await expect(coachRow.getByText("Paused")).toBeVisible();
    await assertSeparateV2Surface(page);

    await coachRow.getByRole("button", { name: "Resume" }).click();
    await expectV2InlineStatus(page, `${coachName} is now published.`);
    await expect(coachRow.getByText("Published")).toBeVisible();
    await assertSeparateV2Surface(page);

    await coachRow.getByRole("button", { name: "Archive", exact: true }).click();
    const archiveDialog = page.getByRole("dialog", {
      name: new RegExp(`Archive: ${escapeRegExp(coachName)}`)
    });
    await expect(archiveDialog).toBeVisible();
    await archiveDialog
      .getByLabel("Reason for archiving")
      .fill("Disposable archive lifecycle test");
    await archiveDialog.getByRole("button", { name: "Send OTP" }).click();
    await expect(archiveDialog.getByRole("button", { name: "Resend OTP" })).toBeVisible();

    const wrongOtp = smokeOtp === "000000" ? "999999" : "000000";
    await archiveDialog.getByLabel("6-digit verification code").fill(wrongOtp);
    expectingWrongDangerOtp = true;
    const wrongOtpResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/coach-sites") &&
        response.request().method() === "PATCH" &&
        response.status() === 401
    );
    await archiveDialog.getByRole("button", { name: "Archive site" }).click();
    expect((await wrongOtpResponse).status()).toBe(401);
    expectingWrongDangerOtp = false;
    await expect(archiveDialog.getByRole("alert")).toContainText(
      "OTP is invalid, expired, or not configured."
    );

    const resendResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/coach-sites") &&
        response.request().postData()?.includes('"action":"send_otp"') === true
    );
    await archiveDialog.getByRole("button", { name: "Resend OTP" }).click();
    expect((await resendResponse).ok()).toBeTruthy();
    await expect(archiveDialog.getByRole("button", { name: "Resend OTP" })).toBeEnabled();

    await archiveDialog.getByLabel("6-digit verification code").fill(smokeOtp);
    await archiveDialog.getByRole("button", { name: "Archive site" }).click();
    await expectV2InlineStatus(page, `${coachName} archived.`);
    await expect(archiveDialog).not.toBeVisible();
    await expect(coachRow.getByText("Archived")).toBeVisible();
    await expect(coachRow.getByRole("button", { name: "Restore" })).toBeVisible();

    const archivedPublicResponse = await request.get(`/coach/${slug}`);
    expect(archivedPublicResponse.ok()).toBeTruthy();
    const archivedPublicHtml = await archivedPublicResponse.text();
    expect(archivedPublicHtml).toContain("This coach page is temporarily unavailable.");

    await coachRow.getByRole("button", { name: "Restore" }).click();
    await expectV2InlineStatus(page, `${coachName} restored as published.`);
    await expect(coachRow.getByText("Published")).toBeVisible();

    await coachRow.getByRole("button", { name: "Remove", exact: true }).click();
    const removeDialog = page.getByRole("dialog", {
      name: new RegExp(`Remove: ${escapeRegExp(coachName)}`)
    });
    await removeDialog
      .getByLabel("Reason for removal")
      .fill("Disposable cleanup after lifecycle test");
    await removeDialog.getByRole("button", { name: "Send OTP" }).click();
    await expect(removeDialog.getByRole("button", { name: "Resend OTP" })).toBeVisible();
    await removeDialog.getByLabel("6-digit verification code").fill(smokeOtp);
    await removeDialog.getByRole("button", { name: "Remove site" }).click();
    await expectV2InlineStatus(page, `${coachName} removed.`);
    await expect(coachRow).not.toBeVisible();

    const draftName = `${coachName} Draft`;
    const draftSlug = `${slug}-draft`;
    await openCreateSiteModule(page);
    const draftCreator = page.locator('section[aria-label="Coach Website Creator"]');
    await draftCreator.getByLabel(/^Coach name/i).fill(draftName);
    await draftCreator.getByLabel(/^Coach location/i).fill("Pune");
    await draftCreator.getByLabel(/^Public slug/i).fill(draftSlug);
    await draftCreator.getByLabel(/^Coach short bio/i).fill("Disposable draft deletion test.");
    await draftCreator.getByRole("button", { name: "Next" }).click();
    await draftCreator.getByLabel(/^Hero media type/i).selectOption("none");
    await draftCreator.getByRole("button", { name: "Next" }).click();
    await draftCreator.getByLabel(/^Coach niche/i).fill("Draft lifecycle testing");
    await draftCreator.getByLabel(/^Coach vision\/mission/i).fill("Verify native draft deletion.");
    await draftCreator
      .getByLabel(/^Primary benefits/i)
      .fill("Disposable draft\nNative confirmation\nList refresh");
    await draftCreator.getByRole("button", { name: "Next" }).click();
    await draftCreator.getByLabel(/^Registration\/contact link/i).fill(`${registrationUrl}-draft`);
    await draftCreator.getByLabel("Support email", { exact: true }).fill("support@example.com");
    await draftCreator.getByLabel("Support phone", { exact: true }).fill("9876543210");
    await draftCreator.getByRole("button", { name: "Save Draft" }).click();
    await expectV2InlineStatus(page, `${draftName} draft saved.`);
    await draftCreator.getByRole("button", { name: "Back to Coach Sites" }).first().click();
    await page.getByLabel(/^Find coach/i).fill(draftName);
    const draftRow = page.getByRole("row", { name: new RegExp(escapeRegExp(draftName)) });
    await expect(draftRow).toBeVisible();
    await draftRow.getByRole("button", { name: "Delete draft", exact: true }).click();
    const deleteDraftDialog = page.getByRole("dialog", {
      name: new RegExp(`Delete draft: ${escapeRegExp(draftName)}`)
    });
    await expect(deleteDraftDialog).toBeVisible();
    await deleteDraftDialog.getByRole("button", { name: "Delete draft", exact: true }).click();
    await expectV2InlineStatus(page, `${draftName} draft deleted.`);
    await expect(draftRow).not.toBeVisible();
    await assertSeparateV2Surface(page);

    expect(pageErrors).toEqual([]);
    expect(protectedResponseProblems).toEqual([]);
    expect(consoleProblems).toEqual([]);
  });
});

async function loginToAdminV2(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Admin email").fill(smokeEmail);
  await page.getByRole("button", { name: "Send one-time code" }).click();
  await expect(page.getByRole("heading", { name: "Verify Your Identity" })).toBeVisible();
  await page.getByLabel("6-digit verification code").fill(smokeOtp);
  await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
  await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();
}

async function openCreateSiteModule(page: import("@playwright/test").Page) {
  const sidebar = page.locator("#admin-sidebar");
  const menuButton = page.getByRole("button", { name: /Open (admin )?navigation/i });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
    await sidebar
      .getByRole("button", { name: /^Create Site$/i })
      .first()
      .click();
  } else {
    await sidebar
      .getByRole("button", { name: /^Create Site$/i })
      .first()
      .click();
  }
  await expect(
    page.getByRole("heading", { exact: true, name: "Create Coach Website" })
  ).toBeVisible();
}

async function assertSeparateV2Surface(page: import("@playwright/test").Page) {
  await expect(page.locator('[data-admin-v2="true"]')).toBeVisible();
  await expect(page.locator('[data-admin-version="v2"]')).toBeVisible();

  const blockedClassFragments = [
    "manager" + "Surface",
    "page" + "Shell",
    "page" + "Body",
    "wizard" + "Shell",
    "dialog" + "Panel",
    "dialog" + "Layer",
    "primary" + "Action",
    "secondary" + "Action",
    "operational" + "Mount"
  ];
  const blockedCount = await page.evaluate((fragments) => {
    return Array.from(document.querySelectorAll("*")).filter((element) => {
      const className =
        typeof element.className === "string" ? element.className : String(element.className || "");
      return fragments.some((fragment) => className.includes(fragment));
    }).length;
  }, blockedClassFragments);

  expect(blockedCount).toBe(0);
}

async function assertCreatorPanelsDoNotOverlap(page: import("@playwright/test").Page) {
  const panels = page.locator(".v2-creator-page .split > .panel");
  await expect(panels).toHaveCount(2);

  const overlapArea = await panels.evaluateAll((elements) => {
    const [formPanel, previewPanel] = elements.map((element) => element.getBoundingClientRect());
    const overlapWidth = Math.max(
      0,
      Math.min(formPanel.right, previewPanel.right) - Math.max(formPanel.left, previewPanel.left)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(formPanel.bottom, previewPanel.bottom) - Math.max(formPanel.top, previewPanel.top)
    );
    return overlapWidth * overlapHeight;
  });

  expect(overlapArea).toBe(0);
}

async function expectV2InlineStatus(page: import("@playwright/test").Page, text: string) {
  await expect(page.locator('p[role="status"]').filter({ hasText: text })).toBeVisible({
    timeout: 30_000
  });
}

async function expectStaleSuggestionBatchResult(
  page: import("@playwright/test").Page,
  expectedTotal: number
) {
  const status = page
    .locator('p[role="status"]')
    .filter({
      hasText: /approved AI copy suggestions? applied.*stale suggestions? (?:was|were) skipped/i
    });
  await expect(status).toBeVisible({ timeout: 30_000 });
  const text = (await status.textContent()) || "";
  const counts = text.match(
    /(\d+) approved AI copy suggestions? applied.*?(\d+) stale suggestions? (?:was|were) skipped/i
  );
  expect(counts, `Unexpected stale-suggestion status: ${text}`).not.toBeNull();
  const applied = Number(counts?.[1] || 0);
  const skipped = Number(counts?.[2] || 0);
  expect(applied).toBeGreaterThan(0);
  expect(skipped).toBeGreaterThan(0);
  expect(applied + skipped).toBe(expectedTotal);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLocalCspRscUpgradeNoise(message: string, locationUrl: string) {
  if (
    message !== "Failed to load resource: net::ERR_CONNECTION_CLOSED" &&
    message !== "Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR"
  ) {
    return false;
  }

  try {
    const baseUrl = new URL(
      process.env.PLAYWRIGHT_BASE_URL ?? process.env.SITE_URL ?? "https://ywcoach.com"
    );
    const failedUrl = new URL(locationUrl);
    return (
      baseUrl.protocol === "http:" &&
      failedUrl.protocol === "https:" &&
      failedUrl.hostname === baseUrl.hostname &&
      failedUrl.port === baseUrl.port &&
      failedUrl.pathname === "/admin/dashboard" &&
      failedUrl.searchParams.has("_rsc")
    );
  } catch {
    return false;
  }
}
