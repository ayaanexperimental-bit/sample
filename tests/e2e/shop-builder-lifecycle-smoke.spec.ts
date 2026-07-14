import { expect, test } from "@playwright/test";

const runShopBuilderSmoke = process.env.SHOP_BUILDER_SMOKE === "true";

test.describe("Shop builder disposable lifecycle", () => {
  test.skip(!runShopBuilderSmoke, "Set SHOP_BUILDER_SMOKE=true for local Shop lifecycle smoke.");

  test("persists identity, skin, device preview, Inspect edits, secure resume, and unpaid protection", async ({
    browser,
    page,
  }, testInfo) => {
    const errors: string[] = [];
    const token = `${testInfo.project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const coachName = `Audit ${testInfo.project.name} Coach ${token.slice(-5)}`;
    const email = `shop-audit-${token}@example.com`;
    const inspectHeadline = `Persistent ${testInfo.project.name} wellness headline`;
    let accessKey = "";
    let orderId = "";
    let publicUrl = "";
    let resumeContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;

    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    try {
      await page.goto("/shop");
      await expect(page.getByRole("heading", { name: "Start your coach website" })).toBeVisible();
      await page.getByLabel("Email").fill(email);

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/shop/drafts/find-or-create") &&
          response.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Start Builder" }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);
      const created = (await createResponse.json()) as {
        accessKey?: string;
        order?: { orderId?: string; publicUrl?: string };
      };
      accessKey = created.accessKey || "";
      orderId = created.order?.orderId || "";
      publicUrl = created.order?.publicUrl || "";
      expect(accessKey).toBeTruthy();
      expect(orderId).toMatch(/^shop-order-/);
      await expect(page.getByRole("heading", { name: "Create your coach website" })).toBeVisible();

      await page.getByLabel("Coach name").fill(coachName);
      await page.getByLabel("Niche").fill("Preventive nutrition and lifestyle coaching");
      await page.getByLabel("Location").fill("Mumbai, India");
      const bio = page.getByLabel("Short bio");
      await bio.fill("Evidence-led");
      await bio.press("Space");
      await bio.type("wellness support for sustainable daily routines.");
      await expect(bio).toHaveValue("Evidence-led wellness support for sustainable daily routines.");

      const skinPicker = page.getByLabel("Visual skin");
      const skinValue = (await skinPicker.locator("option").nth(1).getAttribute("value")) || "";
      expect(skinValue).toBeTruthy();
      await skinPicker.selectOption(skinValue);
      await expect(
        page.locator(`[data-coach-site-page="preview"][data-yw-template-theme="${skinValue}"]`)
      ).toBeVisible();

      const firstSave = await saveDraftAndRead(page);
      publicUrl = firstSave.order?.publicUrl || publicUrl;
      expect(publicUrl).toMatch(/^\/coach\/audit-/);
      expect(publicUrl).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}/i);

      await page.getByRole("button", { exact: true, name: "Next" }).click();
      await expect(page.getByRole("heading", { name: "Add media and client contact" })).toBeVisible();
      await page.getByRole("button", { name: "Text only" }).click();
      await page.getByLabel("Phone/WhatsApp").fill("9876543210");
      await page.getByLabel("Registration/contact link").fill("https://example.com/register");
      await page.getByRole("button", { exact: true, name: "Next" }).click();
      await expect(page.getByRole("heading", { name: "Edit directly on the preview" })).toBeVisible();

      const previewFrame = page.locator('[aria-label="Live website preview"] [data-size]');
      const editPanel = page.getByRole("heading", { name: "Edit directly on the preview" }).locator("..");
      await editPanel.getByRole("button", { exact: true, name: "mobile" }).click();
      await expect(previewFrame).toHaveAttribute("data-size", "mobile");
      const mobileWidth = (await previewFrame.boundingBox())?.width || 0;
      await editPanel.getByRole("button", { exact: true, name: "tablet" }).click();
      await expect(previewFrame).toHaveAttribute("data-size", "tablet");
      const tabletWidth = (await previewFrame.boundingBox())?.width || 0;
      expect(mobileWidth).toBeGreaterThan(300);
      expect(tabletWidth).toBeGreaterThan(mobileWidth);
      await editPanel.getByRole("button", { exact: true, name: "desktop" }).click();
      await expect(previewFrame).toHaveAttribute("data-size", "desktop");

      await editPanel.getByRole("button", { name: "Turn Inspect On" }).click();
      const inspectTarget = page.locator('[data-inspect-target="hero.headline"]');
      await expect(inspectTarget).toHaveAttribute("role", "button");
      await inspectTarget.focus();
      await inspectTarget.press("Space");
      const inspectEditor = editPanel.locator("textarea");
      await expect(inspectEditor).toBeVisible();
      await inspectEditor.fill("Persistent");
      await inspectEditor.press("Space");
      await inspectEditor.type(`${testInfo.project.name} wellness headline`);
      await expect(inspectEditor).toHaveValue(inspectHeadline);
      await editPanel.getByRole("button", { exact: true, name: "Apply" }).click();
      await expect(page.locator('[data-preview-section="hero"] h1')).toContainText(inspectHeadline);

      const saved = await saveDraftAndRead(page);
      expect(saved.order?.state).toMatchObject({
        coachName,
        currentStep: 3,
        selectedThemeId: skinValue,
        slug: publicUrl.split("/").pop(),
      });
      expect(saved.order?.state?.content?.heroHeadline).toBe(inspectHeadline);

      const unpaidResponse = await page.request.get(publicUrl);
      expect(unpaidResponse.status()).toBe(404);

      await page.goto("/shop");
      await expect(page.getByText("Saved draft found")).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue Draft" })).toBeVisible();
      await page.getByRole("button", { name: "Continue Draft" }).click();
      await expect(
        page.locator(`[data-coach-site-page="preview"][data-yw-template-theme="${skinValue}"]`)
      ).toBeVisible();
      await expect(page.locator('[data-preview-section="hero"] h1')).toContainText(inspectHeadline);

      const origin = new URL(page.url()).origin;
      resumeContext = await browser.newContext({ viewport: page.viewportSize() || undefined });
      const resumePage = await resumeContext.newPage();
      await resumePage.goto(
        `${origin}/shop?order=${encodeURIComponent(orderId)}&key=${encodeURIComponent(accessKey)}`
      );
      await expect(resumePage.getByText("Secure resume link loaded.")).toBeVisible();
      await resumePage.getByRole("button", { name: "Continue Draft" }).click();
      await expect(
        resumePage.locator(
          `[data-coach-site-page="preview"][data-yw-template-theme="${skinValue}"]`
        )
      ).toBeVisible();
      await expect(resumePage.locator('[data-preview-section="hero"] h1')).toContainText(
        inspectHeadline
      );

      expect(errors).toEqual([]);
    } finally {
      await resumeContext?.close().catch(() => undefined);
      if (orderId && accessKey) {
        const cleanup = await page.request.post("/api/shop/drafts/archive", {
          data: { accessKey, orderId },
        });
        expect(cleanup.status()).toBe(200);
      }
    }
  });
});

async function saveDraftAndRead(page: import("@playwright/test").Page) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/shop/drafts/save") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save Draft" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(page.getByText("Draft saved. You can continue safely.")).toBeVisible();
  return (await response.json()) as {
    order?: {
      publicUrl?: string;
      state?: {
        coachName?: string;
        content?: { heroHeadline?: string };
        currentStep?: number;
        selectedThemeId?: string;
        slug?: string;
      };
    };
  };
}
