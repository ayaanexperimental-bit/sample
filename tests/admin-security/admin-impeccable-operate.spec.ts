import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const readSource = (path: string) => readFileSync(resolve(projectRoot, path), "utf8");

test.describe("Admin Impeccable Operate refinements", () => {
  test("keeps desktop branding non-interactive and gives mobile navigation an explicit close control", () => {
    const shell = readSource("components/admin/admin-v2-shell.tsx");

    expect(shell).not.toContain('aria-label="Close navigation panel"\n              height={34}');
    expect(shell).toContain('aria-label="Close navigation panel"');
    expect(shell).toContain("styles.v2SidebarClose");
  });

  test("removes faux header controls and progressively discloses duplicate module shortcuts", () => {
    const shell = readSource("components/admin/admin-v2-shell.tsx");

    expect(shell).not.toContain('<div className="page-kicker">Verified admin session</div>');
    expect(shell).toContain("<span>Verified session</span>");
    expect(shell).toContain('<details className="console-card dashboard-admin-addon admin-more">');
    expect(shell).toContain("<summary");
    expect(shell).toContain("More Admin modules");
  });

  test("keeps AI decisions concise while retaining commands and technical evidence on demand", () => {
    const confirmation = readSource("components/admin/admin-ai/AdminAIActionConfirm.tsx");
    const commandList = readSource("components/admin/admin-ai/AdminAICommandList.tsx");
    const copilot = readSource("components/admin/admin-ai/AdminAIPill.tsx");

    expect(confirmation).toContain("Decision summary");
    expect(confirmation).toContain("Technical contract and safeguards");
    expect(confirmation).toContain("<details");
    expect(commandList).toContain("commands.slice(0, 4)");
    expect(commandList).toContain("More commands");
    expect(copilot).toContain("AI observability");
    expect(copilot).toContain("<details");
  });

  test("applies the restrained Operate visual floor to auth and Admin V2 shared surfaces", () => {
    const authCss = readSource("components/admin/admin-auth-shell.module.css");
    const shell = readSource("components/admin/admin-v2-shell.tsx");

    expect(authCss).toContain("Impeccable Operate refinement");
    expect(authCss).toContain(".logoAura");
    expect(authCss).toContain("display: none;");
    expect(shell).toContain("Impeccable Operate refinement");
    expect(shell).toContain('[data-admin-v2="true"] .dashboard-console');
    expect(shell).toContain("box-shadow: none;");
  });
});
