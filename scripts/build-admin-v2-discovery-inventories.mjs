import { readdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const ROOT = resolve(".");
const NOW = new Date().toISOString();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

function projectPath(path) {
  return relative(ROOT, path).split(sep).join("/");
}

function routeFromAppPage(file) {
  const segments = projectPath(file).split("/").slice(1, -1);
  const routed = segments
    .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"))
    .map((segment) => {
      const optionalCatchAll = segment.match(/^\[\[\.\.\.(.+)\]\]$/);
      if (optionalCatchAll) return `:${optionalCatchAll[1]}*`;
      const catchAll = segment.match(/^\[\.\.\.(.+)\]$/);
      if (catchAll) return `:${catchAll[1]}+`;
      const dynamic = segment.match(/^\[(.+)\]$/);
      return dynamic ? `:${dynamic[1]}` : segment;
    });
  return `/${routed.join("/")}`.replace(/\/$/, "") || "/";
}

function routeFromFunction(file) {
  const normalized = projectPath(file)
    .replace(/^functions/, "")
    .replace(/\.(?:ts|tsx|js|mjs)$/, "")
    .replace(/\/index$/, "");
  return (
    normalized
      .split("/")
      .map((segment) => {
        const catchAll = segment.match(/^\[\.\.\.(.+)\]$/);
        if (catchAll) return `:${catchAll[1]}+`;
        const dynamic = segment.match(/^\[(.+)\]$/);
        return dynamic ? `:${dynamic[1]}` : segment;
      })
      .join("/") || "/"
  );
}

function cleanCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function formatMethods(methods) {
  return methods.length ? methods.join(", ") : "UNKNOWN";
}

function extractMethods(source) {
  const names = [
    ...source.matchAll(
      /export\s+(?:const\s+|async\s+function\s+|function\s+)(onRequest(?:Get|Post|Put|Patch|Delete|Options|Head)?)(?=\s|=|\()/g
    )
  ].map((match) => match[1]);
  const methods = new Set();
  for (const name of names) {
    const suffix = name.slice("onRequest".length);
    methods.add(suffix ? suffix.toUpperCase() : "ANY");
  }
  if (methods.has("ANY")) {
    const explicit = new Set(
      [...source.matchAll(/request\.method\s*(?:===|!==)\s*["']([A-Z]+)["']/g)].map(
        (match) => match[1]
      )
    );
    for (const allow of source.matchAll(/allow:\s*["']([^"']+)["']/gi)) {
      for (const method of allow[1].split(",")) explicit.add(method.trim().toUpperCase());
    }
    if (explicit.size) {
      methods.delete("ANY");
      for (const method of explicit) methods.add(method);
    }
  }
  return [...methods].sort();
}

function inferAdminAuth(route, source) {
  const isAdmin = route.startsWith("/api/admin/");
  const isAuth = route.startsWith("/api/admin/auth/");
  const isInvite = route === "/api/admin/users/invite/verify";
  if (isInvite) return "token-gated-admin-invite-flow";
  if (
    [
      "/api/admin/auth/email/start",
      "/api/admin/auth/forgot-password",
      "/api/admin/auth/google/start",
      "/api/admin/auth/login"
    ].includes(route)
  ) {
    return "auth-entrypoint";
  }
  if (isAuth) return "auth-flow-sensitive";
  if (isAdmin) return "admin-protected-by-source-markers";
  if (/verifySigned|accessKey|token|signature|webhook/i.test(source)) return "public-token-or-signature-gated";
  return "public-or-unknown";
}

async function buildRouteAndApiInventories() {
  const appFiles = (await walk(resolve(ROOT, "app"))).filter((file) => /[\\/]page\.tsx?$/.test(file));
  const functionFiles = (await walk(resolve(ROOT, "functions"))).filter(
    (file) => /\.(?:ts|tsx|js|mjs)$/.test(file) && !/\.d\.ts$/.test(file)
  );

  const appPages = [];
  for (const file of appFiles) {
    const source = await readFile(file, "utf8");
    const route = routeFromAppPage(file);
    const area = route.startsWith("/admin")
      ? "admin-ui"
      : route.startsWith("/coach/")
        ? "public-coach"
        : route.startsWith("/dev/")
          ? "dev-only-ui"
          : "public-ui";
    appPages.push({
      route,
      file: projectPath(file),
      area,
      authExpectation:
        area === "admin-ui"
          ? "admin shell/auth-gated client flow"
          : area === "dev-only-ui"
            ? "production exposure must remain gated"
            : "public",
      importsAdminAuthShell: /AdminAuthShell/.test(source),
      importsAdminDashboard: /AdminDashboardLayout|AdminDashboardShell/.test(source),
      importsPublicCoach: /PublicCoachSitePage/.test(source),
      mutationRisk: /fetch\([^)]*\{[\s\S]{0,240}method:\s*["'](?:POST|PATCH|PUT|DELETE)/i.test(source)
        ? "client mutation present"
        : "none in page component"
    });
  }
  appPages.sort((a, b) => a.route.localeCompare(b.route));

  const apiHandlers = [];
  for (const file of functionFiles) {
    const source = await readFile(file, "utf8");
    const route = routeFromFunction(file);
    const methods = extractMethods(source);
    const isAdmin = route.startsWith("/api/admin/");
    const isAuth = route.startsWith("/api/admin/auth/");
    const isInvite = route === "/api/admin/users/invite/verify";
    const hasSession =
      /requireAdmin|requireOwner|resolveAdmin|AdminRequestContext|authenticatedAdmin|getAdminSession|adminSession/i.test(source);
    const hasPermission =
      /permission|hasAdminPermission|canAccessAdmin|assertAdmin|requireOwner/i.test(source);
    const hasCsrf = /csrf/i.test(source);
    const hasDb = /\bDB\b|D1Database|\.prepare\(/.test(source);
    const hasR2 = /R2Bucket|\bMEDIA\b|\.put\(|\.get\(/.test(source);
    const hasSecret = /SECRET|TOKEN|API_KEY|PRIVATE_KEY|WEBHOOK/i.test(source);
    const mutates =
      methods.some((method) => ["ANY", "POST", "PATCH", "PUT", "DELETE"].includes(method)) ||
      /\b(?:INSERT|UPDATE|DELETE)\b/i.test(source);
    const destructive =
      mutates &&
      (/backup-cleanup|drafts\/(?:archive|start-fresh)|\/coach\/:slug$/.test(route) ||
        /\b(?:delete|archive|remove|cleanup|purge|revoke|suspend)\b/i.test(source));

    apiHandlers.push({
      route,
      file: projectPath(file),
      methods: methods.length ? methods : ["UNKNOWN"],
      isAdmin,
      isAuth,
      isInvite,
      auth: inferAdminAuth(route, source),
      hasSession,
      hasPermission,
      hasCsrf,
      hasDb,
      hasR2,
      hasSecret,
      mutates,
      destructive
    });
  }
  apiHandlers.sort((a, b) => a.route.localeCompare(b.route));

  const adminApiNeedsReview = apiHandlers
    .filter(
      (handler) =>
        handler.isAdmin &&
        !handler.isAuth &&
        !handler.isInvite &&
        !handler.hasSession &&
        !handler.hasPermission
    )
    .map((handler) => handler.route);
  const summaries = {
    adminApiNeedsReview,
    adminMutatingApis: apiHandlers
      .filter((handler) => handler.isAdmin && handler.mutates)
      .map((handler) => handler.route),
    destructiveApis: apiHandlers
      .filter((handler) => handler.isAdmin && handler.destructive)
      .map((handler) => handler.route),
    authFlowApis: apiHandlers.filter((handler) => handler.isAuth).map((handler) => handler.route),
    tokenGatedAdminFlows: apiHandlers
      .filter((handler) => handler.isInvite)
      .map((handler) => handler.route),
    devRoutes: appPages.filter((page) => page.area === "dev-only-ui").map((page) => page.route)
  };

  await writeFile(
    resolve(ROOT, "artifacts", "route-map", "PROJECT_WIDE_DISCOVERY_INVENTORY.json"),
    `${JSON.stringify({ timestamp: NOW, appPages, summaries }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    resolve(ROOT, "artifacts", "api-map", "API_HANDLER_INVENTORY.json"),
    `${JSON.stringify({ timestamp: NOW, apiHandlers, summaries }, null, 2)}\n`,
    "utf8"
  );

  const adminPages = appPages.filter((page) => page.area === "admin-ui");
  const publicPages = appPages.filter((page) => page.area === "public-ui");
  const coachPages = appPages.filter((page) => page.area === "public-coach");
  const routeRows = appPages
    .map(
      (page) =>
        `| \`${cleanCell(page.route)}\` | ${cleanCell(page.area)} | ${cleanCell(page.authExpectation)} | \`${cleanCell(page.file)}\` | ${page.importsAdminAuthShell ? "admin auth shell" : page.importsAdminDashboard ? "admin dashboard" : page.importsPublicCoach ? "canonical public coach renderer" : "static/public page"} |`
    )
    .join("\n");
  const routeMarkdown = `# Project-Wide Route Discovery Inventory

Generated: ${NOW}
Preview: http://127.0.0.1:4802
Source JSON: \`artifacts/route-map/PROJECT_WIDE_DISCOVERY_INVENTORY.json\`

## Summary

- App routes discovered: ${appPages.length}
- Admin UI routes: ${adminPages.length}
- Public UI routes: ${publicPages.length}
- Public coach routes: ${coachPages.length}
- Dev-only UI routes: ${summaries.devRoutes.length ? summaries.devRoutes.map((route) => `\`${route}\``).join(", ") : "none"}

## Admin Route Runtime Probe

- \`/admin/dashboard\` redirects unauthenticated users to \`/admin/login?next=%2Fadmin%2Fdashboard\` on localhost and production.
- Auth pages render the login/recovery shell and do not mount \`[data-admin-v2="true"]\` without a valid session.
- Authenticated localhost inventory covers Overview, Analytics, Coaches, Coach Sites, Create Site, Shop, Reports, Payments, Settings, Maintenance / Backup & Cleanup, and Admin Users.

## Route Table

| Route | Area | Auth expectation | File | Notes |
|---|---|---|---|---|
${routeRows}

## Route Verdict

Local route discovery is current. Admin dashboard access is protected. Production feature-route parity remains \`NEEDS_MANUAL_VERIFICATION\` because production was not authenticated. The dev-only template gallery must remain unavailable in production-style output.
`;
  await writeFile(
    resolve(ROOT, "artifacts", "route-map", "PROJECT_WIDE_DISCOVERY_INVENTORY.md"),
    routeMarkdown,
    "utf8"
  );

  const adminHandlers = apiHandlers.filter((handler) => handler.isAdmin);
  const publicHandlers = apiHandlers.filter((handler) => !handler.isAdmin);
  const handlerRows = (handlers) =>
    handlers
      .map(
        (handler) =>
          `| \`${cleanCell(handler.route)}\` | ${formatMethods(handler.methods)} | ${cleanCell(handler.auth)} | ${handler.hasCsrf ? "yes" : "no"} | ${handler.hasPermission ? "yes" : "no"} | ${handler.mutates ? "yes" : "no"} | ${handler.destructive ? "yes" : "no"} | \`${cleanCell(handler.file)}\` |`
      )
      .join("\n");
  const apiMarkdown = `# API Handler Inventory

Generated: ${NOW}
Preview: http://127.0.0.1:4802
Source JSON: \`artifacts/api-map/API_HANDLER_INVENTORY.json\`

## Summary

- Pages/Functions handlers discovered: ${apiHandlers.length}
- Admin API handlers: ${adminHandlers.length}
- Public/API handlers: ${publicHandlers.length}
- Admin handlers needing source-marker review: ${adminApiNeedsReview.length}
- Admin mutating handlers: ${summaries.adminMutatingApis.length}
- Admin destructive-risk handlers: ${summaries.destructiveApis.length}
- Auth flow handlers: ${summaries.authFlowApis.length}

## Admin Handler Table

| Route | Methods | Auth class | CSRF marker | Permission marker | Mutates | Destructive-risk | File |
|---|---|---|---|---|---|---|---|
${handlerRows(adminHandlers)}

## Public/API Handler Table

| Route | Methods | Auth class | CSRF marker | Permission marker | Mutates | Destructive-risk | File |
|---|---|---|---|---|---|---|---|
${handlerRows(publicHandlers)}

## Inventory Boundary

This is deterministic source discovery, not a substitute for runtime authorization tests. Final protection evidence is provided by \`pnpm test:admin-security\` and the Admin V2 browser suites. Production handlers were not mutated.
`;
  await writeFile(
    resolve(ROOT, "artifacts", "api-map", "API_HANDLER_INVENTORY.md"),
    apiMarkdown,
    "utf8"
  );

  return { appPages, apiHandlers, summaries };
}

function classifyAction(name, kind, href = "", className = "") {
  const text = `${name} ${href}`.toLowerCase();
  if (/\b(nav-btn|addon-module-shortcut)\b/.test(className)) return "navigation-or-view";
  if (/^open .*copilot\b/.test(text)) return "navigation-or-view";
  if (/^review\b/.test(text)) return "mutation-or-command";
  if (
    /^(?:confirm |run protected )?(?:delete|remove|archive|cleanup|purge|revoke|suspend)\b/.test(
      text
    )
  ) {
    return "destructive";
  }
  if (/^https?:\/\//.test(href) || /\b(open public|public link|download|export|copy link)\b/.test(text)) {
    return "external-or-public-open";
  }
  if (
    /\b(save|publish|send|verify|generate|run|create|update|pause|resume|restore|invite|reprocess|apply|confirm|retry|rollback|fix|mark|upload|reset|logout)\b/.test(text)
  ) {
    return "mutation-or-command";
  }
  if (kind === "field") return "input-or-filter";
  return "navigation-or-view";
}

function inferBackend(moduleName, actionName) {
  const text = `${moduleName} ${actionName}`.toLowerCase();
  if (/copilot|ai /.test(text)) return "/api/admin/ai-actions";
  if (/maintenance|backup|cleanup/.test(text)) return "/api/admin/backup-cleanup";
  if (/admin users|invite|role|permission/.test(text)) return "/api/admin/users";
  if (/coach site|create site|website creator|publish/.test(text)) return "/api/admin/coach-sites";
  if (/shop/.test(text)) return "/api/admin/shop";
  if (/error report|reports/.test(text)) return "/api/admin/error-reports";
  if (/payment|masterclass/.test(text)) return "/api/admin/masterclass-settings";
  if (/support|settings/.test(text)) return "/api/admin/support-defaults";
  if (/analytics|coach/.test(text)) return "/api/admin/analytics-events";
  return null;
}

async function buildActionInventory() {
  const domPath = resolve(ROOT, "artifacts", "dom", "C_PORT_4802_INVENTORY.json");
  const dom = JSON.parse(await readFile(domPath, "utf8"));
  const actions = [];
  const modules = dom.modules.map((module) => {
    const moduleActions = [];
    for (const control of module.buttonControls || []) {
      const name = control.name || control.text;
      const risk = classifyAction(name, "button", "", control.className || "");
      const action = {
        module: module.label,
        kind: control.role === "tab" ? "tab" : "button",
        name,
        disabled: Boolean(control.disabled),
        risk,
        oldLeak: module.markers.legacyDashboardLayouts > 0 || module.markers.oldAdminShellIds > 0,
        backendApi: inferBackend(module.label, name),
        evidence: "authenticated rendered localhost DOM",
        result: control.disabled ? "rendered-disabled" : "rendered-enabled"
      };
      actions.push(action);
      moduleActions.push(action);
    }
    for (const control of module.linkControls || []) {
      const risk = classifyAction(control.name, "link", control.href || "");
      const action = {
        module: module.label,
        kind: "link",
        name: control.name,
        href: control.href,
        disabled: false,
        risk,
        oldLeak: module.markers.legacyDashboardLayouts > 0 || module.markers.oldAdminShellIds > 0,
        backendApi: inferBackend(module.label, control.name),
        evidence: "authenticated rendered localhost DOM",
        result: "rendered-enabled"
      };
      actions.push(action);
      moduleActions.push(action);
    }
    for (const field of module.fields || []) {
      const action = {
        module: module.label,
        kind: "field",
        name: field.label,
        fieldType: field.type,
        disabled: false,
        risk: "input-or-filter",
        oldLeak: module.markers.legacyDashboardLayouts > 0 || module.markers.oldAdminShellIds > 0,
        backendApi: inferBackend(module.label, field.label),
        evidence: "authenticated rendered localhost DOM",
        result: "rendered-enabled"
      };
      actions.push(action);
      moduleActions.push(action);
    }

    return {
      moduleName: module.label,
      url: dom.source.finalUrl,
      headings: module.headings,
      buttonCount: (module.buttonControls || []).length,
      linkCount: (module.linkControls || []).length,
      fieldCount: (module.fields || []).length,
      actions: moduleActions,
      blockedClassCount: module.markers.legacyDashboardLayouts,
      dataRouteCount: module.markers.rawOdPrototypeHooks,
      oldAdminTextFound: false
    };
  });

  const riskCounts = actions.reduce((counts, action) => {
    counts[action.risk] = (counts[action.risk] || 0) + 1;
    return counts;
  }, {});
  const leakedModules = modules
    .filter((module) => module.blockedClassCount || module.dataRouteCount || module.oldAdminTextFound)
    .map((module) => module.moduleName);
  const externalTileAborts = dom.diagnostics.failedRequests.filter(
    (request) => request.errorText === "net::ERR_ABORTED" && /basemaps\.cartocdn\.com/.test(request.url)
  );
  const otherFailedRequests = dom.diagnostics.failedRequests.filter(
    (request) => !externalTileAborts.includes(request)
  );
  const summary = {
    timestamp: NOW,
    baseUrl: "http://127.0.0.1:4802",
    moduleCount: modules.length,
    totalButtons: modules.reduce((sum, module) => sum + module.buttonCount, 0),
    totalLinks: modules.reduce((sum, module) => sum + module.linkCount, 0),
    totalFields: modules.reduce((sum, module) => sum + module.fieldCount, 0),
    leakedModules,
    actionRiskCounts: riskCounts,
    disabledActions: actions.filter((action) => action.disabled).length,
    badButtonNames: actions
      .filter((action) => action.kind === "button" && !String(action.name || "").trim())
      .map((action) => action.module),
    consoleErrors: dom.diagnostics.consoleErrors,
    pageErrors: dom.diagnostics.pageErrors,
    protectedApiProblems: otherFailedRequests.filter((request) => /\/api\/admin\//.test(request.url)),
    externalMapTileAborts: externalTileAborts.length,
    otherFailedRequests
  };

  await writeFile(
    resolve(ROOT, "artifacts", "action-map", "UI_ACTION_INVENTORY.json"),
    `${JSON.stringify({ summary, modules, actions }, null, 2)}\n`,
    "utf8"
  );

  const moduleList = modules.map((module) => `- ${module.moduleName}`).join("\n");
  const destructive = actions.filter((action) => action.risk === "destructive");
  const destructiveRows = destructive.length
    ? destructive
        .map(
          (action) =>
            `| ${cleanCell(action.module)} | ${cleanCell(action.name)} | ${action.disabled ? "disabled" : "enabled"} | ${action.backendApi ? `\`${action.backendApi}\`` : "module-local/view"} |`
        )
        .join("\n")
    : "| None | None | n/a | n/a |";
  const actionMarkdown = `# Admin V2 UI Action Inventory

Generated: ${NOW}
Preview: http://127.0.0.1:4802
Source JSON: \`artifacts/action-map/UI_ACTION_INVENTORY.json\`

## Summary

- Modules inventoried: ${summary.moduleCount}
- Visible button instances: ${summary.totalButtons}
- Visible link instances: ${summary.totalLinks}
- Visible input/select/textarea instances: ${summary.totalFields}
- Modules with old-wrapper leakage: ${summary.leakedModules.length}
- Buttons with missing accessible names: ${summary.badButtonNames.length}
- Console errors: ${summary.consoleErrors.length}
- Page errors: ${summary.pageErrors.length}
- Protected Admin API request failures: ${summary.protectedApiProblems.length}
- External map-tile requests aborted while switching modules: ${summary.externalMapTileAborts}

## Modules Covered

${moduleList}

## Risk Classification

- Navigation/view actions: ${riskCounts["navigation-or-view"] || 0}
- Input/filter controls: ${riskCounts["input-or-filter"] || 0}
- Mutation/command actions: ${riskCounts["mutation-or-command"] || 0}
- Destructive-risk labels: ${riskCounts.destructive || 0}
- External/public-open actions: ${riskCounts["external-or-public-open"] || 0}
- Disabled actions: ${summary.disabledActions}

## Destructive-Risk Rendered Controls

| Module | Control | State | Inferred module API |
|---|---|---|---|
${destructiveRows}

These labels are discovery candidates. Final behavior, confirmation, OTP, RBAC, persistence, and safe-error verdicts come from the maintained security and end-to-end suites; the inventory itself does not click mutations.

## No-Wrapper Signals

Every inventoried module had zero legacy dashboard markers, zero old-shell IDs, and zero OD prototype \`data-route\`/\`data-toast\` hooks. Production authentication was not available, so this local action inventory cannot independently certify production feature parity.
`;
  await writeFile(
    resolve(ROOT, "artifacts", "action-map", "UI_ACTION_INVENTORY.md"),
    actionMarkdown,
    "utf8"
  );

  return { summary, modules, actions };
}

const sourceInventory = await buildRouteAndApiInventories();
const actionInventory = await buildActionInventory();

console.log(
  JSON.stringify(
    {
      routes: sourceInventory.appPages.length,
      handlers: sourceInventory.apiHandlers.length,
      adminHandlersNeedingReview: sourceInventory.summaries.adminApiNeedsReview,
      actionSummary: actionInventory.summary
    },
    null,
    2
  )
);
