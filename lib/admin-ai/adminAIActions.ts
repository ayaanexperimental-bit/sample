import type { AdminAIActionType } from "./adminAIRegistry";
import type { AdminAICommand } from "./adminAIRegistry";
import type { AdminAISectionContext } from "./adminAIContext";
import type { AdminAIResponse } from "./adminAIService";
import type { AdminAIRollbackAction } from "./adminAITypes";

export type AdminAIActionAuditPhase = "completed" | "confirmed" | "denied" | "failed" | "requested";

export type AdminAIActionAuditInput = {
  actionId: string;
  actionType: AdminAIActionType;
  confirmationResult?: "accepted" | "declined" | "not-required";
  phase: AdminAIActionAuditPhase;
  recordIds?: string[];
  sectionId: string;
};

export type AdminAIActionAuditResult = {
  ok: boolean;
  requestId: string;
};

export type AdminAINaturalLanguageReadAttestationInput = {
  actionId?: string;
  module: string;
  outcome: "blocked" | "failed" | "success";
};

export async function auditAdminAIAction(
  input: AdminAIActionAuditInput,
  options: { csrfToken: string; fetcher?: typeof fetch }
) {
  const fetcher = options.fetcher || fetch;
  const response = await postAdminAIAction(fetcher, options.csrfToken, input);
  return readAdminAIActionAuditResult(response);
}

export async function attestAdminAINaturalLanguageRead(
  input: AdminAINaturalLanguageReadAttestationInput,
  options: { csrfToken: string; fetcher?: typeof fetch }
) {
  const fetcher = options.fetcher || fetch;
  const response = await postAdminAIAction(fetcher, options.csrfToken, {
    ...(input.actionId ? { actionId: input.actionId } : {}),
    mode: "attest-read",
    module: input.module,
    outcome: input.outcome
  });
  return readAdminAIActionAuditResult(response);
}

async function readAdminAIActionAuditResult(response: Response | null) {
  const payload = (await response?.json().catch(() => null)) as {
    ok?: boolean;
    requestId?: string;
  } | null;
  return {
    ok: Boolean(response?.ok && payload?.ok === true),
    requestId:
      typeof payload?.requestId === "string" && /^admin-ai-[a-zA-Z0-9-]+$/.test(payload.requestId)
        ? payload.requestId.slice(0, 120)
        : ""
  } satisfies AdminAIActionAuditResult;
}

export async function executeRegisteredAdminAIAction(
  command: AdminAICommand,
  context: AdminAISectionContext,
  options: {
    csrfToken: string;
    fetcher?: typeof fetch;
  }
): Promise<AdminAIResponse> {
  if (
    command.kind !== "registered-action" ||
    !command.handlerId ||
    !command.successMessage ||
    !command.failureMessage
  ) {
    return {
      body: "No registered execution handler exists for this action. No data changed.",
      items: [],
      state: "action-failed",
      title: "Registered action unavailable"
    };
  }

  const fetcher = options.fetcher || fetch;
  if (command.handlerId === "settings-proactive-suggestions-update") {
    const currentValue = await readProactiveSuggestionsValue(fetcher);
    if (currentValue === null) {
      return {
        body: "The current Settings value could not be verified. No data changed.",
        items: [],
        state: "action-failed",
        title: command.failureMessage
      };
    }
    const response = await postAdminAIAction(fetcher, options.csrfToken, {
      actionId: command.id,
      confirmationResult: "accepted",
      currentValue,
      mode: "execute",
      proposedValue: !currentValue,
      sectionId: command.sectionId,
      settingKey: "proactiveSuggestionsEnabled"
    });
    return readRegisteredActionResponse(response, command.failureMessage);
  }

  if (String(command.handlerId) === "shop-paid-order-publish-retry") {
    const selectedRows = uniqueSelectedRows(context);
    const orderId = selectedRows[0];
    if (selectedRows.length !== 1 || !orderId) {
      return {
        body: "Select exactly one permission-visible paid Shop order before retrying publish.",
        items: [],
        state: "blocked-missing-data",
        title: "No Shop order selected"
      };
    }
    const entity = context.entities.find((item) => item.module === "shop" && item.id === orderId);
    if (!entity) {
      return {
        body: "The selected Shop order is not present in the current permission-filtered context. No data changed.",
        items: [],
        state: "insufficient-permission",
        title: "Selected Shop order is unavailable"
      };
    }
    const response = await postAdminAIAction(fetcher, options.csrfToken, {
      actionId: command.id,
      confirmationResult: "accepted",
      mode: "execute",
      referenceId: orderId,
      sectionId: command.sectionId
    });
    return readRegisteredActionResponse(response, command.failureMessage);
  }

  const selectedRows = uniqueSelectedRows(context);
  const referenceId = selectedRows[0];
  if (selectedRows.length !== 1 || !referenceId) {
    return {
      body: "Select exactly one permission-visible error report before running this action.",
      items: [],
      state: "blocked-missing-data",
      title: "No error report selected"
    };
  }

  const entity = context.entities.find(
    (item) => item.module === "error-reports" && item.id === referenceId
  );
  if (!entity) {
    return {
      body: "The selected record is not present in the current permission-filtered context. No data changed.",
      items: [],
      state: "insufficient-permission",
      title: "Selected report is unavailable"
    };
  }

  const response = await postAdminAIAction(fetcher, options.csrfToken, {
    actionId: command.id,
    confirmationResult: "accepted",
    mode: "execute",
    referenceId,
    sectionId: command.sectionId
  });
  return readRegisteredActionResponse(response, command.failureMessage);
}

function uniqueSelectedRows(context: AdminAISectionContext) {
  return Array.from(new Set(context.selectedRows.map((value) => value.trim()).filter(Boolean)));
}

async function readProactiveSuggestionsValue(fetcher: typeof fetch) {
  try {
    const response = await fetcher("/api/admin/ai-settings", {
      cache: "no-store",
      credentials: "include",
      method: "GET"
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      settings?: { preferences?: { proactiveSuggestionsEnabled?: unknown } };
    } | null;
    const value = payload?.settings?.preferences?.proactiveSuggestionsEnabled;
    return typeof value === "boolean" ? value : null;
  } catch {
    return null;
  }
}

export async function rollbackRegisteredAdminAIAction(
  action: AdminAIRollbackAction,
  options: { csrfToken: string; fetcher?: typeof fetch }
): Promise<AdminAIResponse> {
  if (!/^admin-ai-receipt-[a-zA-Z0-9-]+$/.test(action.receiptId)) {
    return {
      body: "The rollback receipt is invalid. No data changed.",
      items: [],
      state: "action-failed",
      title: "Rollback failed"
    };
  }
  const fetcher = options.fetcher || fetch;
  const response = await postAdminAIAction(fetcher, options.csrfToken, {
    mode: "rollback",
    receiptId: action.receiptId
  });
  return readRegisteredActionResponse(response, "Rollback failed");
}

async function postAdminAIAction(fetcher: typeof fetch, csrfToken: string, body: object) {
  try {
    return await fetcher("/api/admin/ai-actions", {
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-yw-admin-csrf": csrfToken
      },
      method: "POST"
    });
  } catch {
    return null;
  }
}

async function readRegisteredActionResponse(response: Response | null, fallbackTitle: string) {
  const failure = {
    body: "The registered action failed safely. No success is claimed.",
    items: [],
    state: "action-failed",
    title: fallbackTitle
  } satisfies AdminAIResponse;
  if (!response?.ok) return failure;
  const payload = (await response?.json().catch(() => null)) as {
    response?: AdminAIResponse;
  } | null;
  if (isAdminAIResponse(payload?.response)) return payload.response;
  return failure;
}

function isAdminAIResponse(value: unknown): value is AdminAIResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AdminAIResponse>;
  return (
    typeof candidate.body === "string" &&
    Array.isArray(candidate.items) &&
    typeof candidate.state === "string" &&
    typeof candidate.title === "string"
  );
}
