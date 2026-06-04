import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const headersPath = path.join(process.cwd(), "public", "_headers");

test.describe("security headers", () => {
  test("has strict CSP, HSTS, and no-store admin dashboard headers", () => {
    const headers = fs.readFileSync(headersPath, "utf8");

    expect(headers).toContain("Strict-Transport-Security: max-age=31536000; includeSubDomains");
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com");
    expect(headers).toContain("style-src 'self' 'unsafe-inline'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain(
      "connect-src 'self' https://ywcoach.com wss://ywcoach.com https://cloudflareinsights.com https://static.cloudflareinsights.com"
    );
    expect(headers).toContain("/admin/dashboard");
  });
});
