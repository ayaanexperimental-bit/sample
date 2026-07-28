import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

type CssContainer = {
  parent?: CssContainer;
  type: string;
  name?: string;
};

type CssRule = CssContainer & {
  selector: string;
  selectors: string[];
};

type CssAtRule = CssContainer & {
  params: string;
};

type CssDeclaration = CssContainer & {
  prop: string;
  value: string;
};

type CssRoot = CssContainer & {
  walkAtRules(callback: (rule: CssAtRule) => void): void;
  walkDecls(callback: (declaration: CssDeclaration) => void): void;
  walkRules(callback: (rule: CssRule) => void): void;
};

type ParsedValue = {
  walk(callback: (node: { type: string; value: string }) => void): void;
};

const projectRoot = process.cwd();
const sourceCssPath = resolve(projectRoot, "components/admin/admin-od-v2.source.css");
const generatedCssPath = resolve(projectRoot, "public/assets/admin-v2-od.scoped.css");
const generatorPath = resolve(projectRoot, "scripts/build-admin-od-v2-css.mjs");
const styleComponentPath = resolve(projectRoot, "components/admin/admin-od-v2-style.tsx");
const portalScopePath = resolve(projectRoot, "components/admin/admin-v2-portal-scope.tsx");
const shellPath = resolve(projectRoot, "components/admin/admin-v2-shell.tsx");
const shellModuleCssPath = resolve(projectRoot, "components/admin/admin-v2-shell.module.css");
const parityPath = resolve(projectRoot, "components/admin/admin-v2-production-parity.tsx");
const pillPath = resolve(projectRoot, "components/admin/admin-ai/AdminAIPill.tsx");
const projectRequire = createRequire(resolve(projectRoot, "package.json"));
const requireFromNext = createRequire(projectRequire.resolve("next/package.json"));
const postcss = requireFromNext("postcss") as {
  parse(source: string, options?: { from?: string }): CssRoot;
};
const parseValue = projectRequire("next/dist/compiled/postcss-value-parser") as (
  source: string
) => ParsedValue;
const namespacePrefix = '[data-admin-v2="true"]';

function readRequired(path: string) {
  expect(existsSync(path), `${path} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

function isInsideKeyframes(rule: CssRule) {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && /keyframes$/i.test(parent.name || "")) return true;
    parent = parent.parent;
  }
  return false;
}

function collectKeyframes(root: CssRoot) {
  const names: string[] = [];
  root.walkAtRules((rule) => {
    if (/keyframes$/i.test(rule.name || "")) names.push(rule.params.trim());
  });
  return names;
}

test.describe("Admin V2 OD stylesheet containment", () => {
  test("ships a generated scoped asset instead of the inline 179KB payload", () => {
    for (const path of [sourceCssPath, generatedCssPath, generatorPath, portalScopePath]) {
      expect(existsSync(path), `${path} must exist`).toBe(true);
    }

    expect(() =>
      execFileSync(process.execPath, [generatorPath, "--check"], {
        cwd: projectRoot,
        stdio: "pipe"
      })
    ).not.toThrow();

    const styleSource = readRequired(styleComponentPath);
    expect(styleSource).toContain('href="/assets/admin-v2-od.scoped.css"');
    expect(styleSource).toContain('precedence="admin-v2-od"');
    expect(styleSource).not.toContain("dangerouslySetInnerHTML");
    expect(styleSource).not.toContain("ADMIN_OD_V2_CSS");
  });

  test("scopes every ordinary selector and repairs legacy body-token corruption", () => {
    const sourceCss = readRequired(sourceCssPath);
    const generatedCss = readRequired(generatedCssPath);
    const root = postcss.parse(generatedCss, { from: generatedCssPath });
    const scopeViolations: string[] = [];

    root.walkRules((rule) => {
      if (isInsideKeyframes(rule)) return;
      for (const selector of rule.selectors) {
        if (
          !selector.startsWith(namespacePrefix) &&
          !selector.startsWith(`:where(${namespacePrefix})`)
        ) {
          scopeViolations.push(selector);
        }
      }
    });

    expect(scopeViolations).toEqual([]);
    for (const malformed of [
      '--font-[data-admin-v2="true"]',
      '.radial-[data-admin-v2="true"]',
      '[data-table-[data-admin-v2="true"]]'
    ]) {
      expect(sourceCss).not.toContain(malformed);
      expect(generatedCss).not.toContain(malformed);
    }
    expect(sourceCss).toContain("--font-body:");
    expect(sourceCss).toContain(".radial-body");
    expect(sourceCss).toContain("[data-table-body]");
  });

  test("namespaces every OD keyframe and leaves root view transitions to runtime CSS", () => {
    const sourceCss = readRequired(sourceCssPath);
    const generatedCss = readRequired(generatedCssPath);
    const sourceRoot = postcss.parse(sourceCss, { from: sourceCssPath });
    const generatedRoot = postcss.parse(generatedCss, { from: generatedCssPath });
    const sourceKeyframes = collectKeyframes(sourceRoot);
    const generatedKeyframes = collectKeyframes(generatedRoot);
    const staleAnimationReferences: string[] = [];

    expect(generatedKeyframes).toEqual(sourceKeyframes.map((name) => `admin-v2-od-${name}`));
    generatedRoot.walkDecls((declaration) => {
      if (declaration.prop !== "animation" && declaration.prop !== "animation-name") return;
      parseValue(declaration.value).walk((node) => {
        if (node.type === "word" && sourceKeyframes.includes(node.value)) {
          staleAnimationReferences.push(`${declaration.prop}: ${declaration.value}`);
        }
      });
    });

    expect(staleAnimationReferences).toEqual([]);
    expect(generatedCss).not.toContain("::view-transition");
    const shellSource = readRequired(shellPath);
    expect(shellSource.match(/@supports \(view-transition-name: root\)/g)).toHaveLength(1);
  });

  test("keeps Admin V2 feedback and motion free of detector anti-patterns", () => {
    const shellSource = readRequired(shellPath);
    const shellModuleCss = readRequired(shellModuleCssPath);
    const sourceCss = readRequired(sourceCssPath);

    expect(shellSource).not.toMatch(
      /\.console-mini\s*\{[\s\S]*?border-(?:left|right):\s*[2-9]\d*px/
    );
    expect(shellModuleCss).not.toMatch(/border-(?:left|right):\s*[2-9]\d*px/);
    expect(shellModuleCss).not.toMatch(/animation:[^;]*(?:bounce|elastic)/i);
    expect(sourceCss).not.toMatch(
      /cubic-bezier\(\s*-?\d*\.?\d+\s*,\s*(?:1\.\d+|[2-9]\d*(?:\.\d+)?)/
    );
  });

  test("keeps all native Admin V2 portals inside the stylesheet namespace", () => {
    const portalScopeSource = readRequired(portalScopePath);
    expect(portalScopeSource).toContain('data-admin-v2="true"');
    expect(portalScopeSource).toContain("data-od-theme={theme}");
    expect(portalScopeSource).toContain('display: "contents"');

    for (const [path, importPath] of [
      [shellPath, "./admin-v2-portal-scope"],
      [parityPath, "./admin-v2-portal-scope"],
      [pillPath, "../admin-v2-portal-scope"]
    ] as const) {
      const source = readRequired(path);
      expect(source).toContain(`from "${importPath}"`);
      expect(source).toContain("<AdminV2PortalScope");
    }
  });

  test("does not style controls outside Admin V2 and preserves scoped portal animations", async ({
    page
  }) => {
    await page.setContent(`
      <button id="outside">Outside</button>
      <div data-admin-v2="true">
        <button id="inside">Inside</button>
        <div class="nav-btn is-activating"><span class="nav-icon" id="icon"></span></div>
      </div>
      <div data-admin-v2="true" data-od-theme="dark" style="display: contents">
        <div><button id="portal">Portal</button></div>
      </div>
    `);
    await page.addStyleTag({ path: generatedCssPath });

    const computed = await page.evaluate(() => ({
      animationName: getComputedStyle(document.querySelector("#icon")!).animationName,
      insideCursor: getComputedStyle(document.querySelector("#inside")!).cursor,
      outsideCursor: getComputedStyle(document.querySelector("#outside")!).cursor,
      portalCursor: getComputedStyle(document.querySelector("#portal")!).cursor
    }));

    expect(computed).toEqual({
      animationName: "admin-v2-od-rail-icon-pop",
      insideCursor: "pointer",
      outsideCursor: "default",
      portalCursor: "pointer"
    });
  });
});
