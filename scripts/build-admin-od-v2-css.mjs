import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), "..");
const sourcePath = resolve(projectRoot, "components/admin/admin-od-v2.source.css");
const generatedPath = resolve(projectRoot, "public/assets/admin-v2-od.scoped.css");
const projectRequire = createRequire(resolve(projectRoot, "package.json"));
const requireFromNext = createRequire(projectRequire.resolve("next/package.json"));
const postcss = requireFromNext("postcss");
const parseValue = projectRequire("next/dist/compiled/postcss-value-parser");

const SCOPE = '[data-admin-v2="true"]';
const KEYFRAME_PREFIX = "admin-v2-od-";
const CORRUPTED_FONT_TOKEN = '--font-[data-admin-v2="true"]';
const CORRUPTED_RADIAL_SELECTOR = '.radial-[data-admin-v2="true"]';
const CORRUPTED_TABLE_SELECTOR = '[data-table-[data-admin-v2="true"]]';
const LEGACY_CORRUPTION_TOKENS = [
  CORRUPTED_FONT_TOKEN,
  CORRUPTED_RADIAL_SELECTOR,
  CORRUPTED_TABLE_SELECTOR
];

function isInsideKeyframes(rule) {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && /keyframes$/i.test(parent.name || "")) return true;
    parent = parent.parent;
  }
  return false;
}

function assertNoLegacyCorruption(source, label) {
  for (const token of LEGACY_CORRUPTION_TOKENS) {
    if (source.includes(token)) {
      throw new Error(`${label} still contains malformed legacy token: ${token}`);
    }
  }
}

function assertNoRootViewTransitions(root, label) {
  const violations = [];
  root.walkRules((rule) => {
    if (rule.selector.includes("::view-transition")) violations.push(rule.selector);
  });
  if (violations.length) {
    throw new Error(
      `${label} must not own root view-transition pseudo-elements: ${violations.join(", ")}`
    );
  }
}

export function compileAdminOdV2Css(source) {
  assertNoLegacyCorruption(source, "Admin V2 OD source");
  const root = postcss.parse(source, { from: sourcePath });
  assertNoRootViewTransitions(root, "Admin V2 OD source");

  const keyframes = new Map();
  root.walkAtRules((atRule) => {
    if (!/keyframes$/i.test(atRule.name)) return;
    const originalName = atRule.params.trim();
    if (originalName.startsWith(KEYFRAME_PREFIX)) {
      throw new Error(`Source keyframe is already generated: ${originalName}`);
    }
    if (keyframes.has(originalName)) {
      throw new Error(`Duplicate Admin V2 OD keyframe: ${originalName}`);
    }
    const scopedName = `${KEYFRAME_PREFIX}${originalName}`;
    keyframes.set(originalName, scopedName);
    atRule.params = scopedName;
  });

  root.walkDecls((declaration) => {
    if (declaration.prop !== "animation" && declaration.prop !== "animation-name") return;
    const parsed = parseValue(declaration.value);
    parsed.walk((node) => {
      if (node.type === "word" && keyframes.has(node.value)) {
        node.value = keyframes.get(node.value);
      }
    });
    declaration.value = parsed.toString();
  });

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    const scopedSelectors = [];
    for (const selector of rule.selectors) {
      if (selector === ":root") {
        scopedSelectors.push(SCOPE);
      } else if (selector.startsWith(SCOPE)) {
        scopedSelectors.push(selector);
      } else if (selector === "*") {
        scopedSelectors.push(`:where(${SCOPE})`, `:where(${SCOPE}) *`);
      } else {
        scopedSelectors.push(`:where(${SCOPE}) ${selector}`);
      }
    }
    rule.selectors = [...new Set(scopedSelectors)];
  });

  const scopeViolations = [];
  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    for (const selector of rule.selectors) {
      if (!selector.startsWith(SCOPE) && !selector.startsWith(`:where(${SCOPE})`)) {
        scopeViolations.push(selector);
      }
    }
  });
  if (scopeViolations.length) {
    throw new Error(`Unscoped Admin V2 OD selectors: ${scopeViolations.join(", ")}`);
  }

  const generated = root.toString().trim();
  assertNoLegacyCorruption(generated, "Generated Admin V2 OD CSS");
  assertNoRootViewTransitions(root, "Generated Admin V2 OD CSS");
  return `/* Generated from components/admin/admin-od-v2.source.css. Do not edit directly. */\n${generated}\n`;
}

function main() {
  const checkOnly = process.argv.includes("--check");

  if (!existsSync(sourcePath)) {
    throw new Error(`${sourcePath} is missing.`);
  }

  const generated = compileAdminOdV2Css(readFileSync(sourcePath, "utf8"));
  if (checkOnly) {
    if (!existsSync(generatedPath)) {
      throw new Error(`${generatedPath} is missing`);
    }
    const current = readFileSync(generatedPath, "utf8");
    if (current !== generated) {
      throw new Error(
        "Admin V2 OD generated CSS is stale. Run node scripts/build-admin-od-v2-css.mjs."
      );
    }
    process.stdout.write("Admin V2 OD scoped CSS is current.\n");
    return;
  }

  mkdirSync(dirname(generatedPath), { recursive: true });
  writeFileSync(generatedPath, generated, "utf8");
  process.stdout.write(
    `Wrote ${generatedPath} (${Buffer.byteLength(generated).toLocaleString()} bytes).\n`
  );
}

if (resolve(process.argv[1] || "") === scriptPath) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
