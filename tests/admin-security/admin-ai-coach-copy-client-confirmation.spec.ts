import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { requestAdminCoachCopyWithConfirmation } from "../../lib/admin-ai/adminAICoachCopyRequest";

const originalFetch = globalThis.fetch;

test.describe("Admin AI coach-copy client confirmation", () => {
  test.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("retries the preserved payload only after explicit approval", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const requestHeaders: string[] = [];
    globalThis.fetch = async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      requestHeaders.push(new Headers(init?.headers).get("x-yw-admin-csrf") || "");
      return requestBodies.length === 1
        ? Response.json(
            {
              code: "large_input_confirmation_required",
              confirmationRequired: true,
              configured: true,
              message: "This AI copy request is large.",
              ok: false,
              usageEstimate: { estimatedInputTokens: 4200, estimatedOutputTokens: 300 }
            },
            { status: 409 }
          )
        : Response.json({ content: { visionText: "Approved copy" }, ok: true });
    };

    const body: Record<string, unknown> = {
      coachName: "Asha Coach",
      paidFunnelContext: "Original analyzed context",
      scope: "vision"
    };
    const confirmationMessages: string[] = [];
    const result = await requestAdminCoachCopyWithConfirmation<{ visionText: string }>({
      body,
      confirmLargeRequest: (message) => {
        confirmationMessages.push(message);
        body.coachName = "Changed while confirmation was open";
        return true;
      },
      csrfToken: "csrf-test"
    });

    expect(result.cancelled).toBe(false);
    expect(result.response.status).toBe(200);
    expect(result.payload.content).toEqual({ visionText: "Approved copy" });
    expect(confirmationMessages).toEqual([
      "This AI copy request is large.\n\nEstimated usage: 4,200 input tokens and up to 300 output tokens.\n\nContinue with AI copy generation?"
    ]);
    expect(requestHeaders).toEqual(["csrf-test", "csrf-test"]);
    expect(requestBodies).toEqual([
      {
        coachName: "Asha Coach",
        paidFunnelContext: "Original analyzed context",
        scope: "vision"
      },
      {
        coachName: "Asha Coach",
        confirmLargeRequest: true,
        paidFunnelContext: "Original analyzed context",
        scope: "vision"
      }
    ]);
  });

  test("does not retry when the admin declines confirmation", async () => {
    let providerCalls = 0;
    globalThis.fetch = async () => {
      providerCalls += 1;
      return Response.json(
        {
          code: "large_input_confirmation_required",
          confirmationRequired: true,
          message: "Large request confirmation required.",
          ok: false
        },
        { status: 409 }
      );
    };

    const result = await requestAdminCoachCopyWithConfirmation({
      body: { coachName: "Asha Coach", scope: "all" },
      confirmLargeRequest: () => false,
      csrfToken: "csrf-test"
    });

    expect(result.cancelled).toBe(true);
    expect(providerCalls).toBe(1);
  });

  test("does not prompt or retry for a different provider failure", async () => {
    let confirmationCalls = 0;
    let providerCalls = 0;
    globalThis.fetch = async () => {
      providerCalls += 1;
      return Response.json(
        { code: "provider_rejected_request", message: "Provider rejected request.", ok: false },
        { status: 409 }
      );
    };

    const result = await requestAdminCoachCopyWithConfirmation({
      body: { coachName: "Asha Coach", scope: "vision" },
      confirmLargeRequest: () => {
        confirmationCalls += 1;
        return true;
      },
      csrfToken: "csrf-test"
    });

    expect(result.cancelled).toBe(false);
    expect(confirmationCalls).toBe(0);
    expect(providerCalls).toBe(1);
  });

  test("both coach-site callers use the explicit confirmation helper", () => {
    for (const path of [
      "components/admin/admin-v2-shell.tsx",
      "components/admin/admin-coach-sites-manager.tsx"
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).toContain("requestAdminCoachCopyWithConfirmation");
      expect(source).toContain("confirmLargeRequest: (message) => window.confirm(message)");
      expect(source).toMatch(/if \((?:result\.)?cancelled\)/);
    }
  });
});
