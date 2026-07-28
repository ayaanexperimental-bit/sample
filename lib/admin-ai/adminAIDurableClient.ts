import type { AdminAIFeedbackKind } from "./adminAITypes";
import type {
  AdminAIProviderRequest,
  AdminAIProviderResponse
} from "./adminAIModelRouting";

export type AdminAISavedTaskClient = {
  accessChanged?: boolean;
  artifactCount: number;
  conversationId: string | null;
  expiresAt: string;
  goal: string;
  id: string;
  lastActivityAt: string;
  lastSafeStep: string | null;
  scope: {
    allowedSectionIds: string[];
    mode: "global" | "module" | "page" | "record" | "selection";
    module: string;
  };
  status:
    | "active"
    | "awaiting-user"
    | "blocked-access-changed"
    | "cancelled"
    | "completed"
    | "failed-safe"
    | "paused";
  title: string;
  version: number;
};

export type AdminAIDurableArtifactKind =
  | "action-plan"
  | "checklist"
  | "coach-performance-summary"
  | "configuration-comparison"
  | "error-investigation"
  | "incident-summary"
  | "migration-checklist"
  | "publish-readiness-review"
  | "report";

export type AdminAIDurableArtifact = {
  approval: {
    decidedAt: string | null;
    decidedBy: string | null;
    decisionReason: string | null;
    requestedAt: string | null;
    requestedBy: string | null;
    savedAt: string | null;
    savedBy: string | null;
    status: "approved" | "not-requested" | "pending" | "rejected" | "saved";
  };
  content: string;
  createdAt: string;
  creatorEmail: string;
  deletedAt: string | null;
  editorEmails: string[];
  exportFormats: Array<"json" | "md" | "txt">;
  id: string;
  kind: AdminAIDurableArtifactKind;
  sourceContext: {
    module: string;
    referenceIds: string[];
    requestId: string | null;
    scope: "global" | "record" | "section" | "selection";
  };
  title: string;
  updatedAt: string;
  version: number;
  viewerEmails: string[];
};

export type AdminAIOwnerConfigClient = {
  actionPermissions: {
    dangerousEnabled: boolean;
    readEnabled: boolean;
    writeEnabled: boolean;
  };
  approvedKnowledgeSources: Array<{
    id: string;
    label: string;
    type: "internal" | "public-url";
    url?: string;
  }>;
  auditConfiguration: {
    enabled: boolean;
    recordDeniedAttempts: boolean;
    recordReadEvents: boolean;
    retentionDays: number;
  };
  featureAvailability: {
    artifacts: boolean;
    dailyBriefing: boolean;
    proactiveSuggestions: boolean;
    streaming: boolean;
    voice: boolean;
  };
  modelRouting: {
    complexModel: string;
    defaultModel: string;
    fallbackModel: string;
  };
  retentionPeriodDays: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
  usageLimits: {
    dailyRequestsPerAdmin: number;
    maxTokensPerRequest: number;
    monthlyRequestsGlobal: number;
  };
  version: number;
};

export type AdminAISettingsCenterClient = {
  actionHistory: Array<{
    actionOutcome: string;
    command: string;
    createdAt: string;
    id: string;
    outcome: string;
  }>;
  clearSafeMemoryRequestedAt: string | null;
  ownerConfig?: AdminAIOwnerConfigClient;
  preferences: {
    aiPillEnabled: boolean;
    dailyBriefingEnabled: boolean;
    memoryEnabled: boolean;
    notificationPreference: "both" | "email" | "in-app" | "none";
    preferredLanguage: string;
    proactiveSuggestionsEnabled: boolean;
    reportFormat: "json" | "markdown" | "plain-text";
    responseLength: "balanced" | "concise" | "detailed";
  };
  privacy: { memory: string; retention: string; sharing: string };
  updatedAt: string | null;
  updatedBy: string | null;
  usage: {
    approvals: number;
    estimatedCostMicrousd: number;
    requests: number;
    scope: "all-admins" | "self";
    toolCalls: number;
  };
};

export type AdminAIObservabilityDashboardClient = {
  actionSuccess: { attempted: number; rate: number; succeeded: number };
  blockedDangerousActions: number;
  corrections: { approved: number; pending: number; rejected: number; total: number };
  cost: { estimatedMicrousd: number };
  failures: {
    blocked: number;
    cancelled: number;
    errorEvents: number;
    failed: number;
    permissionDenied: number;
    safetyRefusals: number;
  };
  feedback: { responses: number; score: number };
  generatedAt: string;
  latency: { averageMs: number; maximumMs: number };
  topCommands: Array<{ command: string; count: number }>;
  usage: {
    approvals: number;
    byModel: Array<{ count: number; model: string }>;
    byModule: Array<{ count: number; module: string }>;
    requests: number;
    toolCalls: number;
    uniqueAdmins: number;
  };
};

export const ADMIN_AI_SCHEDULE_REPORT_TYPES_CLIENT = [
  "Daily Briefing",
  "Weekly Admin Operations Report",
  "Monthly Growth Report",
  "Coach Site Performance Report",
  "Shop Performance Report",
  "Error and Reliability Report",
  "Admin Security and Permissions Review",
  "Backup and Recovery Report"
] as const;

export type AdminAIScheduleClient = {
  cadence: {
    dayOfMonth?: number;
    frequency: "daily" | "monthly" | "weekly";
    localTime: string;
    timeZone: string;
    weekday?: "friday" | "monday" | "saturday" | "sunday" | "thursday" | "tuesday" | "wednesday";
  };
  createdAt: string;
  createdBy: string;
  delivery: {
    attemptedAt: string | null;
    channel: "email" | "in-app";
    deliveredAt: string | null;
    detail: string | null;
    recipientEmails: string[];
    status: "blocked" | "delivered" | "failed" | "not-attempted";
  };
  enabled: boolean;
  id: string;
  nextRunAt: string | null;
  reportType: (typeof ADMIN_AI_SCHEDULE_REPORT_TYPES_CLIENT)[number];
  updatedAt: string;
  updatedBy: string;
  version: number;
};

export type AdminAIObservationClientInput = {
  actionOutcome: "blocked" | "failed" | "not-applicable" | "success";
  approvals?: Array<{
    level: 1 | 2 | 3;
    outcome: "approved" | "cancelled" | "denied" | "not-required";
  }>;
  command: string;
  dangerousActionBlocked?: boolean;
  errorCodes?: string[];
  estimatedCostMicrousd?: number;
  latencyMs: number;
  model: string;
  module: string;
  outcome: "blocked" | "cancelled" | "failed" | "success";
  permissionDenied?: boolean;
  requestId: string;
  safetyRefusal?: boolean;
  toolCalls?: string[];
};

type ApiResult<T> = {
  code?: string;
  error?: string;
  ok: boolean;
  payload: T;
  status: number;
};

export async function loadAdminAISettings(signal?: AbortSignal) {
  return requestJson<{ ok?: boolean; settings?: AdminAISettingsCenterClient }>(
    "/api/admin/ai-settings",
    { method: "GET", signal }
  );
}

export async function updateAdminAISettings(input: Record<string, unknown>, csrfToken: string) {
  return requestJson<{ ok?: boolean; settings?: AdminAISettingsCenterClient }>(
    "/api/admin/ai-settings",
    writeRequest("PATCH", input, csrfToken)
  );
}

export async function mutateAdminAIArtifact(input: Record<string, unknown>, csrfToken: string) {
  return requestJson<{ artifact?: AdminAIDurableArtifact; ok?: boolean }>(
    "/api/admin/ai-artifacts",
    writeRequest("POST", input, csrfToken)
  );
}

export async function loadAdminAIArtifact(id: string, signal?: AbortSignal) {
  return requestJson<{ artifact?: AdminAIDurableArtifact; ok?: boolean }>(
    `/api/admin/ai-artifacts?id=${encodeURIComponent(id)}`,
    { method: "GET", signal }
  );
}

export async function loadAdminAIArtifacts(signal?: AbortSignal) {
  return requestJson<{ artifacts?: AdminAIDurableArtifact[]; ok?: boolean }>(
    "/api/admin/ai-artifacts",
    { method: "GET", signal }
  );
}

export async function recordAdminAIObservationDurably(
  observation: AdminAIObservationClientInput,
  csrfToken: string
) {
  return requestJson<{ ok?: boolean }>(
    "/api/admin/ai-observability",
    writeRequest("POST", { mode: "observe", observation }, csrfToken)
  );
}

export async function recordAdminAIFeedbackDurably(
  feedbackKind: AdminAIFeedbackKind,
  requestId: string,
  csrfToken: string
) {
  return requestJson<{ ok?: boolean }>(
    "/api/admin/ai-observability",
    writeRequest("POST", { feedbackKind, mode: "feedback", requestId }, csrfToken)
  );
}

export async function submitAdminAICorrectionDurably(
  correction: {
    category:
      | "known-issue-classification"
      | "preferred-wording"
      | "report-interpretation"
      | "workflow-preference";
    command: string;
    correction: string;
    feedbackKind?: AdminAIFeedbackKind;
    module: string;
    requestId: string;
  },
  csrfToken: string
) {
  return requestJson<{ correction?: { id: string; reviewStatus: string }; ok?: boolean }>(
    "/api/admin/ai-observability",
    writeRequest("POST", { correction, mode: "correct" }, csrfToken)
  );
}

export async function loadAdminAIObservability(signal?: AbortSignal) {
  return requestJson<{ dashboard?: AdminAIObservabilityDashboardClient; ok?: boolean }>(
    "/api/admin/ai-observability",
    { method: "GET", signal }
  );
}

export async function loadAdminAISchedules(signal?: AbortSignal) {
  return requestJson<{ ok?: boolean; schedules?: AdminAIScheduleClient[] }>(
    "/api/admin/ai-schedules",
    { method: "GET", signal }
  );
}

export async function mutateAdminAISchedule(
  input: Record<string, unknown>,
  csrfToken: string,
  method: "PATCH" | "POST"
) {
  return requestJson<{ ok?: boolean; schedule?: AdminAIScheduleClient }>(
    "/api/admin/ai-schedules",
    writeRequest(method, input, csrfToken)
  );
}

export async function loadAdminAISavedTasks(signal?: AbortSignal) {
  return requestJson<{ ok?: boolean; tasks?: AdminAISavedTaskClient[] }>(
    "/api/admin/ai-tasks",
    { method: "GET", signal }
  );
}

export async function loadAdminAISavedTask(id: string, signal?: AbortSignal) {
  return requestJson<{ ok?: boolean; task?: AdminAISavedTaskClient }>(
    `/api/admin/ai-tasks/${encodeURIComponent(id)}`,
    { method: "GET", signal }
  );
}

export async function createAdminAISavedTask(
  input: {
    goal: string;
    scope: AdminAISavedTaskClient["scope"];
    selectedEntityRefs?: Array<{
      id: string;
      requiredPermissions: string[];
      sourceVersion: string | null;
      type: string;
    }>;
  },
  csrfToken: string,
  idempotencyKey: string
) {
  return requestJson<{ ok?: boolean; task?: AdminAISavedTaskClient }>(
    "/api/admin/ai-tasks",
    taskWriteRequest("POST", input, csrfToken, idempotencyKey)
  );
}

export async function mutateAdminAISavedTask(
  task: Pick<AdminAISavedTaskClient, "id" | "version">,
  operation: "cancel" | "clear-context" | "resume" | "retry",
  csrfToken: string,
  idempotencyKey: string
) {
  return requestJson<{ ok?: boolean; task?: AdminAISavedTaskClient }>(
    `/api/admin/ai-tasks/${encodeURIComponent(task.id)}/${operation}`,
    taskWriteRequest(
      "POST",
      { expectedVersion: task.version },
      csrfToken,
      idempotencyKey
    )
  );
}

export async function deleteAdminAISavedTask(
  task: Pick<AdminAISavedTaskClient, "id" | "version">,
  csrfToken: string,
  idempotencyKey: string
) {
  return requestJson<{ deleted?: boolean; ok?: boolean }>(
    `/api/admin/ai-tasks/${encodeURIComponent(task.id)}?expectedVersion=${task.version}`,
    {
      headers: {
        "x-idempotency-key": idempotencyKey,
        "x-yw-admin-csrf": csrfToken
      },
      method: "DELETE"
    }
  );
}

export async function requestAdminAIProviderDurably(
  task: Pick<AdminAISavedTaskClient, "id" | "version"> | null,
  query: string,
  request: AdminAIProviderRequest,
  csrfToken: string,
  idempotencyKey: string
) {
  const url = task
    ? `/api/admin/ai-tasks/${encodeURIComponent(task.id)}/messages`
    : "/api/admin/ai-provider";
  const body = task
    ? {
        expectedVersion: task.version,
        input: request.input,
        mode: "provider",
        query,
        requestedMaxOutputTokens: request.maxOutputTokens
      }
    : {
        input: request.input,
        query,
        requestedMaxOutputTokens: request.maxOutputTokens
      };
  return requestJson<{
    ok?: boolean;
    response?: AdminAIProviderResponse;
    task?: AdminAISavedTaskClient;
  }>(url, taskWriteRequest("POST", body, csrfToken, idempotencyKey));
}

export async function checkpointAdminAISavedTask(
  task: Pick<AdminAISavedTaskClient, "id" | "version">,
  input: { assistantSummary: string; query: string },
  csrfToken: string,
  idempotencyKey: string
) {
  return requestJson<{ ok?: boolean; task?: AdminAISavedTaskClient }>(
    `/api/admin/ai-tasks/${encodeURIComponent(task.id)}/messages`,
    taskWriteRequest(
      "POST",
      {
        assistantSummary: input.assistantSummary,
        expectedVersion: task.version,
        mode: "checkpoint",
        query: input.query
      },
      csrfToken,
      idempotencyKey
    )
  );
}

function writeRequest(method: "PATCH" | "POST", body: unknown, csrfToken: string): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-yw-admin-csrf": csrfToken
    },
    method
  };
}

function taskWriteRequest(
  method: "POST",
  body: unknown,
  csrfToken: string,
  idempotencyKey: string
): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": idempotencyKey,
      "x-yw-admin-csrf": csrfToken
    },
    method
  };
}

async function requestJson<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      credentials: "include"
    });
    const payload = (await response.json().catch(() => ({}))) as T & {
      code?: string;
      error?: string;
      ok?: boolean;
    };
    return {
      code: payload.code,
      error: payload.error,
      ok: response.ok && payload.ok !== false,
      payload,
      status: response.status
    };
  } catch {
    return {
      error: "The durable Admin AI service is unavailable.",
      ok: false,
      payload: {} as T,
      status: 503
    };
  }
}
