import { expect, test, type Page } from "@playwright/test";

const ignoredConsoleErrors = [
  /Permissions policy violation: compute-pressure is not allowed in this document\./i
];

type VisualState = {
  brokenImages: string[];
  ctaTapTarget: { height: number; width: number } | null;
  ctaVisibleInitially: boolean;
  finalUrl: string;
  frameworkOverlay: boolean;
  heroVisibleInitially: boolean;
  horizontalOverflow: boolean;
  meaningfulText: number;
};

async function getVisualState(page: Page): Promise<VisualState> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const pageText = body.innerText || "";
    const hero = document.querySelector('main section, main [class*="hero"], section');
    const heroRect = hero?.getBoundingClientRect() ?? null;
    const ctaCandidates = Array.from(document.querySelectorAll("a,button")).filter((element) => {
      const label = (element.textContent || "").trim().toLowerCase();
      return (
        label.includes("register") ||
        label.includes("join") ||
        label.includes("start") ||
        label.includes("book")
      );
    });
    const ctaRect = ctaCandidates[0]?.getBoundingClientRect() ?? null;
    const brokenImages = Array.from(document.images)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.src.slice(0, 160));

    return {
      brokenImages,
      ctaTapTarget: ctaRect
        ? { height: Math.round(ctaRect.height), width: Math.round(ctaRect.width) }
        : null,
      ctaVisibleInitially: !!ctaRect && ctaRect.bottom > 0 && ctaRect.top < window.innerHeight,
      finalUrl: window.location.href,
      frameworkOverlay:
        /Unhandled Runtime Error|Build Error|Application error|Next\.js|webpack/i.test(pageText),
      heroVisibleInitially:
        !!heroRect && heroRect.bottom > 0 && heroRect.top < window.innerHeight * 0.9,
      horizontalOverflow:
        doc.scrollWidth > window.innerWidth + 2 || body.scrollWidth > window.innerWidth + 2,
      meaningfulText: pageText.trim().length
    };
  });
}

test.describe("Gyana guest funnel", () => {
  test("blocks direct coach URL without the guest entry link", async ({ page }) => {
    await page.goto("/gyana", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/Link Not Available/i);
    await expect(page.getByText("Access blocked")).toBeVisible();
    await expect(page.getByText("Please use the link shared by your coach.")).toBeVisible();

    const state = await getVisualState(page);
    expect(state.horizontalOverflow).toBe(false);
    expect(state.frameworkOverlay).toBe(false);
  });

  test("renders the guest entry page first viewport correctly", async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (
        message.type() === "error" &&
        !ignoredConsoleErrors.some((pattern) => pattern.test(text))
      ) {
        consoleErrors.push(text);
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto("/go/gyana-guest", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    await expect(page).toHaveURL(/\/gyana$/);
    await expect(page).toHaveTitle(/Gyana Ranjan PMOS Guest Session/i);
    await expect(
      page
        .locator("a,button")
        .filter({ hasText: /Join Guest Session/i })
        .first()
    ).toBeVisible();

    const state = await getVisualState(page);
    expect(state.meaningfulText).toBeGreaterThan(1_000);
    expect(state.frameworkOverlay).toBe(false);
    expect(state.horizontalOverflow).toBe(false);
    expect(state.heroVisibleInitially).toBe(true);
    expect(state.ctaVisibleInitially).toBe(true);
    expect(state.ctaTapTarget?.height).toBeGreaterThanOrEqual(44);
    expect(state.ctaTapTarget?.width).toBeGreaterThanOrEqual(120);
    expect(state.brokenImages).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath(`gyana-guest-${testInfo.project.name}.png`)
    });
  });
});
