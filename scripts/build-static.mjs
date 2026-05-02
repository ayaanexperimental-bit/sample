import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const exportWorkspace = ".cloudflare-pages-build";
const copiedItems = [
  "app",
  "components",
  "lib",
  "public",
  "next-env.d.ts",
  "next.config.ts",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.mjs",
  "tsconfig.json"
];

const command = process.execPath;
let result;

try {
  if (existsSync(exportWorkspace)) {
    rmSync(exportWorkspace, { recursive: true, force: true });
  }

  mkdirSync(exportWorkspace, { recursive: true });

  for (const item of copiedItems) {
    if (existsSync(item)) {
      cpSync(item, join(exportWorkspace, item), { recursive: true });
    }
  }

  rmSync(join(exportWorkspace, "app", "api"), { recursive: true, force: true });
  removeForceDynamicFromStaticHome();

  result = spawnSync(command, ["../node_modules/next/dist/bin/next", "build"], {
    cwd: exportWorkspace,
    env: {
      ...process.env,
      NEXT_OUTPUT_EXPORT: "true"
    },
    stdio: "inherit",
    shell: false
  });
  rmSync("out", { recursive: true, force: true });
  cpSync(join(exportWorkspace, "out"), "out", { recursive: true });
} finally {
  rmSync(exportWorkspace, { recursive: true, force: true });
}

if (result?.error) {
  console.error(result.error);
}

process.exit(result?.status ?? 1);

function removeForceDynamicFromStaticHome() {
  const pagePath = join(exportWorkspace, "app", "page.tsx");
  const source = readFileSync(pagePath, "utf8");
  writeFileSync(pagePath, source.replace('export const dynamic = "force-dynamic";', ""));
}
