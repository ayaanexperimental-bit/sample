import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/admin-security",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  outputDir: "test-results/admin-security",
  reporter: [["list"]],
  workers: 1,
  use: {
    browserName: "chromium",
    trace: "retain-on-failure"
  }
});
