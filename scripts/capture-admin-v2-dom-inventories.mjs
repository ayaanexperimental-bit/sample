import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const OD_URL =
  process.env.ADMIN_V2_OD_URL ||
  "http://127.0.0.1:56156/api/projects/50769cfd-c70f-4fab-8f06-3acc73cbe3b5/raw/index.html";
const PRODUCTION_URL =
  process.env.ADMIN_V2_PRODUCTION_URL || "https://ywcoach.com/admin/dashboard";
const LOCAL_URL = process.env.ADMIN_V2_LOCAL_URL || "http://127.0.0.1:4802";
const LOCAL_EMAIL = process.env.ADMIN_V2_SMOKE_EMAIL || "admin-v2-smoke@example.com";
const LOCAL_OTP = process.env.ADMIN_V2_SMOKE_OTP || "123456";
const OUTPUT_DIR = resolve("artifacts", "dom");

function createDiagnostics(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    consoleErrors.push(location ? `${message.text()} @ ${location}` : message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push({
      errorText: request.failure()?.errorText || "unknown",
      method: request.method(),
      url: request.url()
    });
  });

  return { consoleErrors, failedRequests, pageErrors };
}

async function collectRenderedDom(page) {
  return page.evaluate(() => {
    const all = (selector) => Array.from(document.querySelectorAll(selector));
    const isVisible = (element) => {
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
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const unique = (values) => [...new Set(values.map(normalize).filter(Boolean))];
    const visibleText = (selector) =>
      unique(all(selector).filter(isVisible).map((element) => element.textContent));
    const accessibleName = (element) => {
      const aria = element.getAttribute("aria-label");
      if (aria) return normalize(aria);
      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const label = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ");
        if (normalize(label)) return normalize(label);
      }
      if (element instanceof HTMLInputElement && element.id) {
        const explicit = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (explicit) return normalize(explicit.textContent);
      }
      const wrappingLabel = element.closest("label");
      if (wrappingLabel) return normalize(wrappingLabel.textContent);
      return normalize(
        element.getAttribute("title") ||
          element.getAttribute("placeholder") ||
          element.getAttribute("name") ||
          element.textContent
      );
    };
    const count = (selector) => all(selector).length;
    const visibleCount = (selector) => all(selector).filter(isVisible).length;
    const interactive = all(
      'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"]'
    );
    const charts = all(
      'canvas, svg[role="img"], [class*="chart" i], [class*="graph" i], [class*="gauge" i], [aria-label*="chart" i], [aria-label*="graph" i], [aria-label*="gauge" i]'
    );

    return {
      title: document.title,
      url: location.href,
      route: location.pathname,
      theme:
        document.querySelector("[data-od-theme]")?.getAttribute("data-od-theme") ||
        document.documentElement.getAttribute("data-theme") ||
        null,
      counts: {
        elements: count("*"),
        visibleElements: visibleCount("body *"),
        sections: count("section"),
        visibleSections: visibleCount("section"),
        buttons: count('button, [role="button"]'),
        visibleButtons: visibleCount('button, [role="button"]'),
        links: count('a[href], [role="link"]'),
        visibleLinks: visibleCount('a[href], [role="link"]'),
        fields: count("input, select, textarea"),
        visibleFields: visibleCount("input, select, textarea"),
        dialogs: count('dialog, [role="dialog"], [aria-modal="true"]'),
        visibleDialogs: visibleCount('dialog, [role="dialog"], [aria-modal="true"]'),
        tables: count('table, [role="table"], [role="grid"]'),
        visibleTables: visibleCount('table, [role="table"], [role="grid"]'),
        forms: count("form"),
        visibleForms: visibleCount("form"),
        charts: charts.length,
        visibleCharts: charts.filter(isVisible).length,
        interactive: interactive.length,
        visibleInteractive: interactive.filter(isVisible).length,
        dataRoutes: count("[data-route]"),
        dataToasts: count("[data-toast]"),
        adminV2Mounts: count('[data-admin-v2="true"]'),
        adminV2VersionMarkers: count('[data-admin-version="v2"]'),
        iframes: count("iframe")
      },
      headings: visibleText("h1, h2, h3, h4, h5, h6, [role=heading]"),
      buttons: unique(
        all('button, [role="button"]')
          .filter(isVisible)
          .map(accessibleName)
      ),
      buttonControls: all('button, [role="button"]')
        .filter(isVisible)
        .map((element, index) => ({
          index,
          name: accessibleName(element),
          text: normalize(element.textContent),
          aria: normalize(element.getAttribute("aria-label")),
          title: normalize(element.getAttribute("title")),
          type: element.getAttribute("type") || null,
          role: element.getAttribute("role") || element.tagName.toLowerCase(),
          disabled:
            element instanceof HTMLButtonElement || element instanceof HTMLInputElement
              ? element.disabled
              : element.getAttribute("aria-disabled") === "true",
          className: normalize(element.getAttribute("class"))
        })),
      links: unique(
        all('a[href], [role="link"]')
          .filter(isVisible)
          .map((element) => accessibleName(element) || element.getAttribute("href"))
      ),
      linkControls: all('a[href], [role="link"]')
        .filter(isVisible)
        .map((element, index) => ({
          index,
          name: accessibleName(element),
          href: element.getAttribute("href") || null,
          target: element.getAttribute("target") || null,
          rel: element.getAttribute("rel") || null,
          className: normalize(element.getAttribute("class"))
        })),
      fields: all("input, select, textarea")
        .filter(isVisible)
        .map((element) => ({
          label: accessibleName(element),
          name: element.getAttribute("name") || null,
          type:
            element instanceof HTMLSelectElement
              ? "select"
              : element instanceof HTMLTextAreaElement
                ? "textarea"
                : element.getAttribute("type") || "text"
        })),
      navigation: unique(
        all('nav button, nav a[href], [role="navigation"] button, [role="navigation"] a[href]')
          .filter(isVisible)
          .map(accessibleName)
      ),
      tabs: unique(
        all('[role="tab"], [role="tablist"] button')
          .filter(isVisible)
          .map(accessibleName)
      ),
      sections: unique(
        all("section, main, aside")
          .filter(isVisible)
          .map((element) => {
            const heading = element.querySelector("h1, h2, h3, h4, h5, h6");
            return element.getAttribute("aria-label") || heading?.textContent || "";
          })
      ),
      tables: all('table, [role="table"], [role="grid"]')
        .filter(isVisible)
        .map((table) => ({
          label: accessibleName(table),
          columns: unique(
            Array.from(table.querySelectorAll('th, [role="columnheader"]')).map(
              (header) => header.textContent
            )
          ),
          rows: table.querySelectorAll('tbody tr, [role="row"]').length
        })),
      routes: unique(all("[data-route]").map((element) => element.getAttribute("data-route"))),
      markers: {
        adminV2: count('[data-admin-v2="true"]'),
        adminV2Version: count('[data-admin-version="v2"]'),
        legacyDashboardLayouts: count(
          '[data-admin-version="v1"], [data-legacy-admin], .admin-dashboard-layout, .legacy-admin-shell, .v2-operational-mount'
        ),
        rawOdPrototypeHooks: count("[data-route], [data-toast]"),
        oldAdminShellIds: count("#admin-dashboard-layout, #legacy-admin-shell, #old-admin-sidebar")
      }
    };
  });
}

async function collectOdInventory(browser) {
  const page = await browser.newPage({ viewport: { height: 1100, width: 1440 } });
  const diagnostics = createDiagnostics(page);
  const response = await page.goto(OD_URL, { waitUntil: "networkidle", timeout: 45_000 });
  await page.waitForTimeout(400);
  const rendered = await collectRenderedDom(page);
  const routes = await page.locator("[data-route]").evaluateAll((elements) => [
    ...new Set(elements.map((element) => element.getAttribute("data-route")).filter(Boolean))
  ]);
  const routeViews = [];

  for (const route of routes) {
    const trigger = page.locator(`[data-route="${route.replaceAll('"', '\\"')}"]`).first();
    if ((await trigger.count()) === 0) continue;
    await trigger.evaluate((element) => element.click());
    await page.waitForTimeout(80);
    const routeDom = await collectRenderedDom(page);
    routeViews.push({
      route,
      headings: routeDom.headings,
      buttons: routeDom.buttons,
      fields: routeDom.fields,
      sections: routeDom.sections,
      tables: routeDom.tables,
      visibleCounts: {
        buttons: routeDom.counts.visibleButtons,
        charts: routeDom.counts.visibleCharts,
        fields: routeDom.counts.visibleFields,
        sections: routeDom.counts.visibleSections,
        tables: routeDom.counts.visibleTables
      }
    });
  }

  await page.close();
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    target: "A_OD_ANALYTICS",
    source: {
      projectId: "50769cfd-c70f-4fab-8f06-3acc73cbe3b5",
      projectName: "Analytics",
      entry: "index.html",
      requestedUrl: OD_URL,
      finalUrl: rendered.url,
      httpStatus: response?.status() || null
    },
    access: "local OpenDesign reference preview",
    rendered,
    routeViews,
    diagnostics
  };
}

async function collectProductionInventory(browser) {
  const page = await browser.newPage({ viewport: { height: 1100, width: 1440 } });
  const diagnostics = createDiagnostics(page);
  const response = await page.goto(PRODUCTION_URL, {
    waitUntil: "networkidle",
    timeout: 45_000
  });
  await page.getByRole("heading", { name: "Admin Login" }).waitFor({ timeout: 15_000 });
  const rendered = await collectRenderedDom(page);
  const finalUrl = page.url();
  await page.close();

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    target: "B_PRODUCTION_ADMIN",
    source: {
      requestedUrl: PRODUCTION_URL,
      finalUrl,
      httpStatus: response?.status() || null
    },
    access: finalUrl.includes("/admin/login")
      ? "unauthenticated login surface only"
      : "unexpected non-login surface",
    authenticatedProductionCoverage: false,
    mutationPolicy: "No production form was filled or submitted.",
    rendered,
    diagnostics,
    blocker:
      "No authenticated production session or production OTP authority is available; feature-level production DOM comparison requires manual verification."
  };
}

async function loginToLocalAdmin(page) {
  await page.goto(`${LOCAL_URL}/admin/login`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByLabel("Admin email").fill(LOCAL_EMAIL);
  await page.getByRole("button", { name: "Send one-time code" }).click();
  await page.getByRole("heading", { name: "Verify Your Identity" }).waitFor();
  await page.getByLabel("6-digit verification code").fill(LOCAL_OTP);
  await page.getByRole("button", { name: "Verify & Enter Admin Panel" }).click();
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 });
  await page.locator('[data-admin-v2="true"]').waitFor({ state: "visible", timeout: 20_000 });
}

async function collectLocalInventory(browser) {
  const page = await browser.newPage({ viewport: { height: 1100, width: 1440 } });
  const diagnostics = createDiagnostics(page);
  await loginToLocalAdmin(page);
  await page.waitForFunction(() => {
    const mount = document.querySelector('[data-admin-v2="true"]');
    return mount && mount.getAttribute("data-admin-v2-data-status") !== "loading";
  });
  await page.waitForTimeout(500);
  const rendered = await collectRenderedDom(page);
  const nav = page.locator('nav[aria-label="Primary admin rail"] button.nav-btn');
  const navLabels = await nav.evaluateAll((buttons) =>
    buttons.map(
      (button) =>
        button.getAttribute("data-title") ||
        button.getAttribute("aria-label") ||
        button.textContent?.trim() ||
        ""
    )
  );
  const modules = [];

  for (const label of navLabels) {
    const button = page.locator('nav[aria-label="Primary admin rail"] button.nav-btn', {
      has: page.locator(`[data-title="${label.replaceAll('"', '\\"')}"]`)
    });
    const exactButton = page
      .locator('nav[aria-label="Primary admin rail"] button.nav-btn')
      .filter({ hasText: label })
      .first();
    const target = (await button.count()) > 0 ? button.first() : exactButton;
    if ((await target.count()) === 0) continue;
    await target.click();
    await page.waitForTimeout(350);
    const moduleDom = await collectRenderedDom(page);
    modules.push({
      label,
      headings: moduleDom.headings,
      buttons: moduleDom.buttons,
      buttonControls: moduleDom.buttonControls,
      links: moduleDom.links,
      linkControls: moduleDom.linkControls,
      fields: moduleDom.fields,
      sections: moduleDom.sections,
      tabs: moduleDom.tabs,
      tables: moduleDom.tables,
      counts: moduleDom.counts,
      markers: moduleDom.markers
    });
  }

  const nestedViews = [
    {
      moduleLabel: "Reports",
      triggerLabel: "Open maintenance",
      label: "Maintenance / Backup & Cleanup"
    },
    {
      moduleLabel: "Settings",
      triggerLabel: "Open users",
      label: "Admin Users"
    }
  ];

  for (const nested of nestedViews) {
    const moduleButton = page
      .locator('nav[aria-label="Primary admin rail"] button.nav-btn')
      .filter({ hasText: nested.moduleLabel })
      .first();
    if ((await moduleButton.count()) === 0) continue;
    await moduleButton.click();
    await page.waitForTimeout(250);
    const trigger = page.getByRole("button", { name: nested.triggerLabel, exact: true });
    if ((await trigger.count()) === 0) continue;
    await trigger.click();
    await page.waitForTimeout(350);
    const moduleDom = await collectRenderedDom(page);
    modules.push({
      label: nested.label,
      headings: moduleDom.headings,
      buttons: moduleDom.buttons,
      buttonControls: moduleDom.buttonControls,
      links: moduleDom.links,
      linkControls: moduleDom.linkControls,
      fields: moduleDom.fields,
      sections: moduleDom.sections,
      tabs: moduleDom.tabs,
      tables: moduleDom.tables,
      counts: moduleDom.counts,
      markers: moduleDom.markers
    });
  }

  const sourceStatus = await page
    .locator('[data-admin-v2="true"]')
    .getAttribute("data-admin-v2-data-status");
  await page.close();

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    target: "C_LOCALHOST_4802_ADMIN_V2",
    source: {
      requestedUrl: `${LOCAL_URL}/admin/login`,
      finalUrl: rendered.url,
      httpStatus: 200,
      dataStatus: sourceStatus
    },
    access: "authenticated local demo owner session",
    credentials: {
      email: LOCAL_EMAIL,
      otp: "local demo code supplied via environment/default; value intentionally omitted"
    },
    rendered,
    modules,
    diagnostics
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const [od, production, local] = await Promise.all([
      collectOdInventory(browser),
      collectProductionInventory(browser),
      collectLocalInventory(browser)
    ]);

    const outputs = [
      ["A_OD_INVENTORY.json", od],
      ["B_PRODUCTION_INVENTORY.json", production],
      ["C_PORT_4802_INVENTORY.json", local]
    ];

    for (const [name, value] of outputs) {
      const outputPath = resolve(OUTPUT_DIR, name);
      if (name === "B_PRODUCTION_INVENTORY.json" && !value.authenticatedProductionCoverage) {
        const existing = await readExistingJson(outputPath);
        if (existing?.authenticatedProductionCoverage === true) {
          console.log(
            "Preserved authenticated B_PRODUCTION_INVENTORY.json; the fresh browser had only the login surface."
          );
          continue;
        }
      }

      await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }

    console.log(
      JSON.stringify(
        {
          od: {
            counts: od.rendered.counts,
            routes: od.routeViews.length,
            diagnostics: od.diagnostics
          },
          production: {
            access: production.access,
            counts: production.rendered.counts,
            finalUrl: production.source.finalUrl,
            diagnostics: production.diagnostics
          },
          local: {
            counts: local.rendered.counts,
            modules: local.modules.map((module) => module.label),
            diagnostics: local.diagnostics
          }
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

async function readExistingJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

await main();
