import { expect, test } from "@playwright/test";
import {
  attestAdminAINaturalLanguageRead,
  auditAdminAIAction,
  executeRegisteredAdminAIAction,
  rollbackRegisteredAdminAIAction
} from "../../lib/admin-ai/adminAIActions";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import { getAdminAICommand } from "../../lib/admin-ai/adminAIRegistry";

const csrfToken = "csrf-transport";
const command = getAdminAICommand("error-reports.mark-reviewing");
if (!command) throw new Error("Expected registered error-report action.");
const settingsCommand = getAdminAICommand("settings.update-proactive-suggestions");
if (!settingsCommand) throw new Error("Expected registered Settings action.");
const shopRetryCommand = getAdminAICommand("shop.retry-publish");
if (!shopRetryCommand) throw new Error("Expected registered paid-order recovery action.");

test.describe("Admin AI client action transport", () => {
  test("sends only bounded natural-language read attestation fields with CSRF", async () => {
    let request: {
      body: Record<string, unknown>;
      cache?: RequestCache;
      credentials?: RequestCredentials;
      csrf: string;
    } | null = null;

    const result = await attestAdminAINaturalLanguageRead(
      { module: "global", outcome: "success" },
      {
        csrfToken,
        fetcher: async (_url, init) => {
          request = {
            body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown>,
            cache: init?.cache,
            credentials: init?.credentials,
            csrf: String(new Headers(init?.headers).get("x-yw-admin-csrf") || "")
          };
          return Response.json({ ok: true, requestId: "admin-ai-attested-read-1" });
        }
      }
    );

    expect(result).toEqual({ ok: true, requestId: "admin-ai-attested-read-1" });
    expect(request).toEqual({
      body: { mode: "attest-read", module: "global", outcome: "success" },
      cache: "no-store",
      credentials: "include",
      csrf: csrfToken
    });
    expect(request!.body).not.toHaveProperty("actionId");
    expect(request!.body).not.toHaveProperty("phase");
    expect(request!.body).not.toHaveProperty("query");
  });

  test("sends a registered read command identifier without client-authored audit fields", async () => {
    let body: Record<string, unknown> | null = null;

    const result = await attestAdminAINaturalLanguageRead(
      {
        actionId: "overview.summarize",
        module: "overview",
        outcome: "success"
      },
      {
        csrfToken,
        fetcher: async (_url, init) => {
          body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
          return Response.json({ ok: true, requestId: "admin-ai-attested-command-read-1" });
        }
      }
    );

    expect(result).toEqual({ ok: true, requestId: "admin-ai-attested-command-read-1" });
    expect(body).toEqual({
      actionId: "overview.summarize",
      mode: "attest-read",
      module: "overview",
      outcome: "success"
    });
    expect(body!).not.toHaveProperty("actionType");
    expect(body!).not.toHaveProperty("phase");
    expect(body!).not.toHaveProperty("recordIds");
  });

  test("fails audit writes closed without losing denied-confirmation semantics", async () => {
    const input = {
      actionId: command.id,
      actionType: command.type,
      confirmationResult: "declined" as const,
      phase: "denied" as const,
      recordIds: ["ERR-TRANSPORT-1"],
      sectionId: command.sectionId
    };
    let request: {
      body: string;
      cache?: RequestCache;
      credentials?: RequestCredentials;
      csrf: string;
    } | null = null;

    const networkFailure = auditAdminAIAction(input, {
      csrfToken,
      fetcher: async (_url, init) => {
        request = {
          body: String(init?.body || ""),
          cache: init?.cache,
          credentials: init?.credentials,
          csrf: String(new Headers(init?.headers).get("x-yw-admin-csrf") || "")
        };
        throw new TypeError("network unavailable");
      }
    });

    await expect(networkFailure).resolves.toEqual({ ok: false, requestId: "" });
    expect(request).toEqual({
      body: JSON.stringify(input),
      cache: "no-store",
      credentials: "include",
      csrf: csrfToken
    });
    expect(JSON.parse(request!.body)).not.toHaveProperty("mode", "execute");

    await expect(
      auditAdminAIAction(input, {
        csrfToken,
        fetcher: async () => new Response("{", { status: 200 })
      })
    ).resolves.toEqual({ ok: false, requestId: "" });
  });

  test("bounds execute transport and parse failures without claiming success", async () => {
    let request: {
      body: unknown;
      cache?: RequestCache;
      credentials?: RequestCredentials;
      csrf: string;
    } | null = null;
    const expectedFailure = {
      body: "The registered action failed safely. No success is claimed.",
      items: [],
      state: "action-failed",
      title: command.failureMessage
    };

    const networkFailure = executeRegisteredAdminAIAction(command, createContext(), {
      csrfToken,
      fetcher: async (_url, init) => {
        request = {
          body: JSON.parse(String(init?.body || "{}")),
          cache: init?.cache,
          credentials: init?.credentials,
          csrf: String(new Headers(init?.headers).get("x-yw-admin-csrf") || "")
        };
        throw new TypeError("network unavailable");
      }
    });

    await expect(networkFailure).resolves.toEqual(expectedFailure);
    expect(request).toEqual({
      body: {
        actionId: command.id,
        confirmationResult: "accepted",
        mode: "execute",
        referenceId: "ERR-TRANSPORT-1",
        sectionId: command.sectionId
      },
      cache: "no-store",
      credentials: "include",
      csrf: csrfToken
    });
    await expect(
      executeRegisteredAdminAIAction(command, createContext(), {
        csrfToken,
        fetcher: async () => new Response("{", { status: 200 })
      })
    ).resolves.toEqual(expectedFailure);
    await expect(
      executeRegisteredAdminAIAction(command, createContext(), {
        csrfToken,
        fetcher: async () =>
          Response.json(
            {
              ok: false,
              response: {
                body: "Forged success from an HTTP failure.",
                items: [],
                state: "action-complete",
                title: "Forged success"
              }
            },
            { status: 503 }
          )
      })
    ).resolves.toEqual(expectedFailure);
  });

  test("bounds rollback transport and parse failures while preserving the receipt request", async () => {
    const action = {
      label: "Restore status to New",
      receiptId: "admin-ai-receipt-transport-1",
      recordId: "ERR-TRANSPORT-1"
    };
    let request: {
      body: unknown;
      cache?: RequestCache;
      credentials?: RequestCredentials;
      csrf: string;
    } | null = null;
    const expectedFailure = {
      body: "The registered action failed safely. No success is claimed.",
      items: [],
      state: "action-failed",
      title: "Rollback failed"
    };

    const networkFailure = rollbackRegisteredAdminAIAction(action, {
      csrfToken,
      fetcher: async (_url, init) => {
        request = {
          body: JSON.parse(String(init?.body || "{}")),
          cache: init?.cache,
          credentials: init?.credentials,
          csrf: String(new Headers(init?.headers).get("x-yw-admin-csrf") || "")
        };
        throw new TypeError("network unavailable");
      }
    });

    await expect(networkFailure).resolves.toEqual(expectedFailure);
    expect(request).toEqual({
      body: { mode: "rollback", receiptId: action.receiptId },
      cache: "no-store",
      credentials: "include",
      csrf: csrfToken
    });
    await expect(
      rollbackRegisteredAdminAIAction(action, {
        csrfToken,
        fetcher: async () => new Response("{", { status: 200 })
      })
    ).resolves.toEqual(expectedFailure);
  });

  test("executes and receipt-rolls back the zero-selection Settings action", async () => {
    const requests: Array<{ body: unknown; method: string; url: string }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      const requestUrl = String(url);
      const method = init?.method || "GET";
      requests.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
        method,
        url: requestUrl
      });
      if (requestUrl === "/api/admin/ai-settings") {
        return Response.json({
          ok: true,
          settings: { preferences: { proactiveSuggestionsEnabled: true } }
        });
      }
      if (method === "POST" && requests.length === 2) {
        return Response.json({
          ok: true,
          response: {
            body: "proactiveSuggestionsEnabled is now false.",
            items: [],
            rollbackAction: {
              label: "Restore proactiveSuggestionsEnabled to true",
              receiptId: "admin-ai-receipt-settings-1",
              recordId: "settings:proactiveSuggestionsEnabled"
            },
            state: "action-complete",
            title: settingsCommand.successMessage
          }
        });
      }
      return Response.json({
        ok: true,
        response: {
          body: "proactiveSuggestionsEnabled is now true.",
          items: [],
          state: "action-complete",
          title: "Proactive suggestions preference restored"
        }
      });
    };

    const executed = await executeRegisteredAdminAIAction(
      settingsCommand,
      createSettingsContext(),
      { csrfToken, fetcher }
    );
    expect(executed.state).toBe("action-complete");
    expect(requests.slice(0, 2)).toEqual([
      { body: null, method: "GET", url: "/api/admin/ai-settings" },
      {
        body: {
          actionId: settingsCommand.id,
          confirmationResult: "accepted",
          currentValue: true,
          mode: "execute",
          proposedValue: false,
          sectionId: "settings",
          settingKey: "proactiveSuggestionsEnabled"
        },
        method: "POST",
        url: "/api/admin/ai-actions"
      }
    ]);

    await expect(
      rollbackRegisteredAdminAIAction(executed.rollbackAction!, { csrfToken, fetcher })
    ).resolves.toMatchObject({ state: "action-complete" });
    expect(requests[2]).toEqual({
      body: { mode: "rollback", receiptId: "admin-ai-receipt-settings-1" },
      method: "POST",
      url: "/api/admin/ai-actions"
    });
  });

  test("fails the Settings action closed when its current value cannot be verified", async () => {
    let calls = 0;
    await expect(
      executeRegisteredAdminAIAction(settingsCommand, createSettingsContext(), {
        csrfToken,
        fetcher: async () => {
          calls += 1;
          return Response.json({ ok: false }, { status: 503 });
        }
      })
    ).resolves.toMatchObject({
      body: "The current Settings value could not be verified. No data changed.",
      state: "action-failed",
      title: settingsCommand.failureMessage
    });
    expect(calls).toBe(1);
  });

  test("bounds one permission-visible paid-order retry to the registered Shop transport", async () => {
    const requests: Array<{ body: unknown; method: string; url: string }> = [];

    const response = await executeRegisteredAdminAIAction(shopRetryCommand, createShopContext(), {
      csrfToken,
      fetcher: async (url, init) => {
        requests.push({
          body: init?.body ? JSON.parse(String(init.body)) : null,
          method: init?.method || "GET",
          url: String(url)
        });
        return Response.json({
          ok: true,
          response: {
            body: "Paid Shop order SHOP-TRANSPORT-1 is verified published.",
            items: [],
            state: "action-complete",
            title: shopRetryCommand.successMessage
          }
        });
      }
    });

    expect(response).toMatchObject({ state: "action-complete" });
    expect(requests).toEqual([
      {
        body: {
          actionId: "shop.retry-publish",
          confirmationResult: "accepted",
          mode: "execute",
          referenceId: "SHOP-TRANSPORT-1",
          sectionId: "shop"
        },
        method: "POST",
        url: "/api/admin/ai-actions"
      }
    ]);
  });
});

function createContext(): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: [],
    currentRoute: "/admin/dashboard?view=error-reports",
    dataFreshness: "Fresh",
    dateRange: "Current view",
    emptyState: false,
    entities: [
      {
        id: "ERR-TRANSPORT-1",
        label: "ERR-TRANSPORT-1",
        matchReason: "Selected error report",
        module: "error-reports",
        route: "/admin/dashboard?view=error-reports&referenceId=ERR-TRANSPORT-1",
        searchableText: "ERR-TRANSPORT-1 New",
        source: "/api/admin/error-reports",
        status: "Status / New",
        updatedAt: "2026-07-21T00:00:00.000Z"
      }
    ],
    errors: [],
    filters: {},
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: [],
      registeredActions: [],
      visibleDataSummary: [],
      warnings: []
    },
    knowledge: [],
    lastUpdated: "2026-07-21T00:00:00.000Z",
    loadingState: false,
    permissions: ["error_reports.view", "error_reports.mark_status"],
    relatedAPIs: ["/api/admin/error-reports", "/api/admin/ai-actions"],
    registeredActions: [],
    sectionId: "error-reports",
    sectionName: "Reports",
    selectedRows: ["ERR-TRANSPORT-1"],
    userRole: "owner",
    visibleDataSummary: [],
    warnings: []
  };
}

function createSettingsContext(): AdminAISectionContext {
  return {
    ...createContext(),
    currentRoute: "/admin/dashboard?view=settings",
    entities: [],
    permissions: ["settings.view", "settings.support"],
    relatedAPIs: ["/api/admin/ai-settings", "/api/admin/ai-actions"],
    sectionId: "settings",
    sectionName: "Settings",
    selectedRows: []
  };
}

function createShopContext(): AdminAISectionContext {
  return {
    ...createContext(),
    currentRoute: "/admin/dashboard?view=shop",
    entities: [
      {
        id: "SHOP-TRANSPORT-1",
        label: "Paid order awaiting publish retry",
        matchReason: "Selected paid Shop order",
        module: "shop",
        route: "/admin/dashboard?view=shop&orderId=SHOP-TRANSPORT-1",
        searchableText: "SHOP-TRANSPORT-1 paid publish_failed",
        source: "/api/admin/shop",
        status: "paid / publish_failed",
        updatedAt: "2026-07-21T00:00:00.000Z"
      }
    ],
    permissions: ["shop.view", "shop.recovery"],
    relatedAPIs: ["/api/admin/shop", "/api/admin/ai-actions"],
    sectionId: "shop",
    sectionName: "Shop",
    selectedRows: ["SHOP-TRANSPORT-1"]
  };
}
