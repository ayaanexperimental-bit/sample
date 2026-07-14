import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = process.env.ADMIN_V2_LOCAL_URL || "http://127.0.0.1:4802";
const EMAIL = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke@example.com";
const OTP = process.env.ADMIN_V2_SMOKE_OTP || "123456";
const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
const consoleErrors = [];
const pageErrors = [];
const protectedApiErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes("/api/admin/") && response.status() >= 400) {
    protectedApiErrors.push(`${response.status()} ${response.url()}`);
  }
});

await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "networkidle" });
await page.getByLabel("Admin email").fill(EMAIL);
await page.getByRole("button", { name: "Send one-time code" }).click();
await page.getByRole("heading", { name: "Verify Your Identity" }).waitFor();
await page.getByLabel("6-digit verification code").fill(OTP);
await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();
await page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 });
await page.locator('[data-admin-v2="true"]').waitFor({ state: "visible" });
await page.waitForFunction(() => {
  const mount = document.querySelector('[data-admin-v2="true"]');
  return mount && mount.getAttribute("data-admin-v2-data-status") !== "loading";
});

const results = [];
for (const width of WIDTHS) {
  const height = width <= 414 ? 844 : width <= 1024 ? 1024 : 1000;
  await page.setViewportSize({ height, width });
  await page.evaluate(() => {
    document
      .querySelector('nav[aria-label="Primary admin rail"] button[data-title="Overview"]')
      ?.click();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(180);
  const overview = await page.evaluate((viewportWidth) => {
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
    const visible = (element) => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const blockedClassCount = Array.from(document.querySelectorAll("*")).filter((element) => {
      const className = element.getAttribute("class") || "";
      return blockedClassFragments.some((fragment) => className.includes(fragment));
    }).length;
    const rawOverflowCandidates = Array.from(document.querySelectorAll('[data-admin-v2="true"] *'))
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1;
      });
    const isContainedByOverflowContext = (element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const style = getComputedStyle(parent);
        const overflowX = style.overflowX;
        if (["auto", "scroll", "hidden", "clip"].includes(overflowX)) {
          const rect = parent.getBoundingClientRect();
          if (rect.left >= -1 && rect.right <= viewportWidth + 1) return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };
    const overflowCandidates = rawOverflowCandidates
      .filter((element) => !isContainedByOverflowContext(element))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.getAttribute("class") || "",
        left: Math.round(element.getBoundingClientRect().left * 100) / 100,
        right: Math.round(element.getBoundingClientRect().right * 100) / 100
      }));
    const topbar = document.querySelector(".topbar")?.getBoundingClientRect();
    return {
      blockedClassCount,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      rawOverflowCandidateCount: rawOverflowCandidates.length,
      overflowCandidates,
      topbar: topbar
        ? { top: topbar.top, bottom: topbar.bottom, left: topbar.left, right: topbar.right }
        : null,
      adminV2Mounts: document.querySelectorAll('[data-admin-v2="true"]').length,
      adminV2VersionMarkers: document.querySelectorAll('[data-admin-version="v2"]').length,
      legacyMarkers: document.querySelectorAll(
        '[data-admin-version="v1"], [data-legacy-admin], .legacy-admin-shell, .v2-operational-mount'
      ).length
    };
  }, width);

  const menuButton = page.getByRole("button", { name: /Open (admin )?navigation/i });
  if (await menuButton.isVisible().catch(() => false)) await menuButton.click();
  await page
    .locator('#admin-sidebar button[data-title="Create Site"]')
    .evaluate((element) => element.click());
  await page.getByRole("heading", { exact: true, name: "Create Coach Website" }).waitFor();
  await page.waitForTimeout(120);
  const creator = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll(".v2-creator-page .split > .panel"));
    if (panels.length !== 2) {
      return {
        panelCount: panels.length,
        overlapArea: null,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth
      };
    }
    const [formPanel, previewPanel] = panels.map((element) => element.getBoundingClientRect());
    const overlapWidth = Math.max(
      0,
      Math.min(formPanel.right, previewPanel.right) - Math.max(formPanel.left, previewPanel.left)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(formPanel.bottom, previewPanel.bottom) - Math.max(formPanel.top, previewPanel.top)
    );
    return {
      panelCount: panels.length,
      overlapArea: overlapWidth * overlapHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      formPanel: { left: formPanel.left, right: formPanel.right, width: formPanel.width },
      previewPanel: { left: previewPanel.left, right: previewPanel.right, width: previewPanel.width }
    };
  });

  await page.evaluate(() => {
    document
      .querySelector('nav[aria-label="Primary admin rail"] button[data-title="Reports"]')
      ?.click();
    window.scrollTo(0, 0);
  });
  await page.getByRole("heading", { exact: true, name: "Error Reports" }).waitFor();
  await page.waitForTimeout(120);

  const detailsButton = page.getByRole("button", { name: /View details for/i }).first();
  let reportDetail = {
    available: false,
    boundsWithinViewport: false,
    controlsVisible: [],
    dialogHorizontalOverflow: null,
    pageHorizontalOverflow: null
  };

  if (await detailsButton.isVisible().catch(() => false)) {
    await detailsButton.click();
    const dialog = page.getByRole("dialog", { name: "Error Details" });
    await dialog.waitFor({ state: "visible" });
    reportDetail = await dialog.evaluate(
      (element, viewport) => {
        const rect = element.getBoundingClientRect();
        const visible = (candidate) => {
          if (!(candidate instanceof HTMLElement || candidate instanceof SVGElement)) return false;
          const style = getComputedStyle(candidate);
          const candidateRect = candidate.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) !== 0 &&
            candidateRect.width > 0 &&
            candidateRect.height > 0
          );
        };
        const expectedControls = ["Copy prompt", "Mark Reviewing", "Mark Fixed", "Ignore"];
        const controlsVisible = expectedControls.filter((label) =>
          Array.from(element.querySelectorAll("button")).some(
            (button) => button.textContent?.trim() === label && visible(button)
          )
        );

        return {
          available: true,
          boundsWithinViewport:
            rect.left >= -1 &&
            rect.top >= -1 &&
            rect.right <= viewport.width + 1 &&
            rect.bottom <= viewport.height + 1,
          controlsVisible,
          dialogHorizontalOverflow: element.scrollWidth - element.clientWidth,
          pageHorizontalOverflow:
            Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
            document.documentElement.clientWidth,
          rect: {
            bottom: Math.round(rect.bottom * 100) / 100,
            height: Math.round(rect.height * 100) / 100,
            left: Math.round(rect.left * 100) / 100,
            right: Math.round(rect.right * 100) / 100,
            top: Math.round(rect.top * 100) / 100,
            width: Math.round(rect.width * 100) / 100
          }
        };
      },
      { height, width }
    );
    await dialog.getByRole("button", { name: "Close action dialog" }).click();
  }

  results.push({ width, height, overview, creator, reportDetail });
}

const output = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  widths: WIDTHS,
  results,
  diagnostics: { consoleErrors, pageErrors, protectedApiErrors },
  verdict:
    results.every(
      (result) =>
        result.overview.scrollWidth === result.overview.clientWidth &&
        result.overview.bodyScrollWidth === result.overview.clientWidth &&
        result.overview.blockedClassCount === 0 &&
        result.overview.legacyMarkers === 0 &&
        result.creator.panelCount === 2 &&
        result.creator.overlapArea === 0 &&
        result.creator.scrollWidth === result.creator.clientWidth &&
        result.creator.bodyScrollWidth === result.creator.clientWidth &&
        result.reportDetail.available &&
        result.reportDetail.boundsWithinViewport &&
        result.reportDetail.controlsVisible.length === 4 &&
        result.reportDetail.dialogHorizontalOverflow <= 1 &&
        result.reportDetail.pageHorizontalOverflow <= 1
    ) &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0 &&
    protectedApiErrors.length === 0
      ? "PASS"
      : "FAIL"
};

await mkdir(resolve("artifacts", "dom"), { recursive: true });
await writeFile(
  resolve("artifacts", "dom", "C_PORT_4802_RESPONSIVE_AUDIT.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      verdict: output.verdict,
      widths: results.map((result) => ({
        width: result.width,
        overflow: result.overview.scrollWidth - result.overview.clientWidth,
        rawOverflowCandidates: result.overview.rawOverflowCandidateCount,
        overflowCandidates: result.overview.overflowCandidates.length,
        creatorOverflow: result.creator.scrollWidth - result.creator.clientWidth,
        blockedClassCount: result.overview.blockedClassCount,
        legacyMarkers: result.overview.legacyMarkers,
        creatorOverlapArea: result.creator.overlapArea,
        reportDetail: result.reportDetail
      })),
      diagnostics: output.diagnostics
    },
    null,
    2
  )
);

await browser.close();
