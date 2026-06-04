import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const outputDir = "out";
const workerTempDir = ".cloudflare-pages-worker";
const workerSource = join(workerTempDir, "index.js");
const workerTarget = join(outputDir, "_worker.js");

rmSync(workerTarget, { force: true });
rmSync(workerTempDir, { recursive: true, force: true });
mkdirSync(workerTempDir, { recursive: true });

const wranglerCli = join("node_modules", "wrangler", "bin", "wrangler.js");

const result = spawnSync(
  process.execPath,
  [
    wranglerCli,
    "pages",
    "functions",
    "build",
    "functions",
    "--outdir",
    workerTempDir,
    "--build-output-directory",
    outputDir
  ],
  {
    stdio: "inherit",
    shell: false
  }
);

if (result.error || result.status !== 0) {
  rmSync(workerTempDir, { recursive: true, force: true });
  if (result.error) {
    console.error(result.error);
  }
  process.exit(result.status ?? 1);
}

if (!existsSync(workerSource) || !statSync(workerSource).isFile()) {
  rmSync(workerTempDir, { recursive: true, force: true });
  console.error("Cloudflare Pages Functions build did not produce index.js.");
  process.exit(1);
}

cpSync(workerSource, workerTarget);
rmSync(workerTempDir, { recursive: true, force: true });
