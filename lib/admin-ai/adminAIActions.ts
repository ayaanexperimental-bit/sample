import type { AdminAIActionType } from "./adminAIRegistry";
import type { AdminAICommand } from "./adminAIRegistry";
import type { AdminAISectionContext } from "./adminAIContext";
import type { AdminAIResponse } from "./adminAIService";

export type AdminAIActionAuditPhase =
  | "completed"
  | "confirmed"
  | "denied"
  | "failed"
  | "requested";

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

export async function auditAdminAIAction(
  input: AdminAIActionAuditInput,
  options: { csrfToken: string; fetcher?: typeof fetch }
) {
  const fetcher = options.fetcher || fetch;
  const response = await fetcher("/api/admin/ai-actions", {
    body: JSON.stringify(input),
    cache: "no-store",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-yw-admin-csrf": options.csrfToken,
    },
    method: "POST",
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; requestId?: string }
    | null;
  return {
    ok: response.ok && payload?.ok !== false,
    requestId:
      typeof payload?.requestId === "string" && /^admin-ai-[a-zA-Z0-9-]+$/.test(payload.requestId)
        ? payload.requestId.slice(0, 120)
        : "",
  } satisfies AdminAIActionAuditResult;
}

export async function executeRegisteredAdminAIAction(
  command: AdminAICommand,
  context: AdminAISectionContext,
  options: {
    csrfToken: string;
    fetcher?: typeof fetch;
    targetStatus?: "Fixed" | "Ignored" | "New" | "Reviewing";
  }
): Promise<AdminAIResponse> {
  if (command.id !== "error-reports.mark-reviewing") {
    return {
      body: "No registered execution handler exists for this action. No data changed.",
      items: [],
      state: "action-failed",
      title: "Registered action unavailable",
    };
  }

  const referenceId = context.selectedRows[0]?.trim();
  if (!referenceId) {
    return {
      body: "Select one permission-visible error report before running this action.",
      items: [],
      state: "blocked-missing-data",
      title: "No error report selected",
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
      title: "Selected report is unavailable",
    };
  }

  const fetcher = options.fetcher || fetch;
  const previousStatus = parseErrorReportStatus(entity.status);
  const targetStatus = options.targetStatus || "Reviewing";
  const response = await fetcher("/api/admin/error-reports", {
    body: JSON.stringify({ referenceId, status: targetStatus }),
    cache: "no-store",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-yw-admin-csrf": options.csrfToken,
    },
    method: "PATCH",
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; ok?: boolean; referenceId?: string; status?: string }
    | null;
  if (!response.ok || !payload?.ok) {
    return {
      body: payload?.error || "The registered status update failed safely. No success is claimed.",
      items: [],
      state: "action-failed",
      title: "Report status update failed",
    };
  }
  return {
    body: `Error report ${payload.referenceId || referenceId} is now ${payload.status || targetStatus}.`,
    evidence: [
      {
        dateRange: context.dateRange,
        freshness: "Verified from the protected API response",
        label: entity.label,
        module: "error-reports",
        recordCount: 1,
        source: "/api/admin/error-reports",
      },
    ],
    items: ["The action used the selected record only.", "The request retained session, CSRF, and server RBAC enforcement."],
    rollbackAction:
      previousStatus && previousStatus !== targetStatus
        ? {
            actionId: command.id,
            label: `Restore status to ${previousStatus}`,
            recordId: referenceId,
            targetStatus: previousStatus,
          }
        : undefined,
    state: "action-complete",
    title:
      targetStatus === "Reviewing"
        ? "Report marked Reviewing"
        : `Report status restored to ${targetStatus}`,
  };
}

function parseErrorReportStatus(value: string) {
  const candidate = value.split("/").pop()?.trim();
  return candidate === "Fixed" ||
    candidate === "Ignored" ||
    candidate === "New" ||
    candidate === "Reviewing"
    ? candidate
    : null;
}
