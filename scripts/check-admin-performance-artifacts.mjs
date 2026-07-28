import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const MAX_INITIAL_ADMIN_JS_BYTES = 2_100_000;
const outputDirectory = resolve(process.cwd(), process.env.ADMIN_PERFORMANCE_OUTPUT_DIR || "out");
const adminExports = [
  "admin.html",
  "admin/login.html",
  "admin/verify.html",
  "admin/forgot-password.html",
  "admin/reset-password.html",
  "admin/dashboard.html"
];
const forbiddenInitialMarkers = [
  {
    label: "Admin V2 dashboard",
    value: "Open production modules"
  },
  {
    label: "classic admin dashboard",
    value: "Only production records are shown."
  },
  {
    label: "Admin Copilot controller",
    value: "yw-admin-ai:response:v1"
  }
];

const failures = [];
const results = [];

for (const exportPath of adminExports) {
  const htmlPath = resolve(outputDirectory, exportPath);
  if (!existsSync(htmlPath)) {
    failures.push(`${exportPath}: missing built HTML at ${htmlPath}`);
    continue;
  }

  const html = readFileSync(htmlPath, "utf8");
  const assetReferences = collectInitialJavaScriptReferences(html);
  if (!assetReferences.length) {
    failures.push(`${exportPath}: no initial JavaScript assets were found`);
    continue;
  }

  let initialBytes = 0;
  let assetCount = 0;
  const markerHits = [];

  for (const assetReference of assetReferences) {
    const assetPath = resolveOutputAsset(assetReference);
    if (!assetPath) {
      failures.push(`${exportPath}: unsafe JavaScript asset path ${assetReference}`);
      continue;
    }
    if (!existsSync(assetPath)) {
      failures.push(`${exportPath}: missing JavaScript asset ${assetReference}`);
      continue;
    }

    const bytes = statSync(assetPath).size;
    const source = readFileSync(assetPath, "utf8");
    initialBytes += bytes;
    assetCount += 1;

    for (const marker of forbiddenInitialMarkers) {
      if (source.includes(marker.value)) {
        markerHits.push({
          asset: assetReference,
          label: marker.label,
          marker: marker.value
        });
      }
    }
  }

  if (initialBytes > MAX_INITIAL_ADMIN_JS_BYTES) {
    failures.push(
      `${exportPath}: ${initialBytes.toLocaleString()} initial JS bytes exceed ` +
        `${MAX_INITIAL_ADMIN_JS_BYTES.toLocaleString()}`
    );
  }
  for (const hit of markerHits) {
    failures.push(
      `${exportPath}: initial asset ${hit.asset} contains forbidden ${hit.label} marker ` +
        JSON.stringify(hit.marker)
    );
  }

  results.push({
    assetCount,
    exportPath,
    initialBytes,
    markerHits
  });
}

if (failures.length) {
  console.error("Admin performance artifact gate failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        budget: {
          maxInitialAdminJsBytes: MAX_INITIAL_ADMIN_JS_BYTES
        },
        outputDirectory,
        results
      },
      null,
      2
    )
  );
}

function collectInitialJavaScriptReferences(html) {
  const references = new Set();

  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    const source = getHtmlAttribute(tag, "src");
    if (source && isJavaScriptReference(source)) {
      references.add(source);
    }
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const relation = getHtmlAttribute(tag, "rel")?.toLowerCase() || "";
    const resourceType = getHtmlAttribute(tag, "as")?.toLowerCase() || "";
    const href = getHtmlAttribute(tag, "href");
    const preloadsScript =
      relation.split(/\s+/).includes("modulepreload") ||
      (relation.split(/\s+/).includes("preload") && resourceType === "script");
    if (preloadsScript && href && isJavaScriptReference(href)) {
      references.add(href);
    }
  }

  return Array.from(references).sort();
}

function getHtmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2] ?? null;
}

function isJavaScriptReference(value) {
  try {
    return new URL(value, "https://artifact.invalid/").pathname.endsWith(".js");
  } catch {
    return false;
  }
}

function resolveOutputAsset(reference) {
  try {
    const pathname = decodeURIComponent(new URL(reference, "https://artifact.invalid/").pathname);
    const assetPath = resolve(outputDirectory, pathname.replace(/^\/+/, ""));
    const outputPrefix = outputDirectory.endsWith(sep)
      ? outputDirectory
      : `${outputDirectory}${sep}`;
    return assetPath.startsWith(outputPrefix) ? assetPath : null;
  } catch {
    return null;
  }
}
