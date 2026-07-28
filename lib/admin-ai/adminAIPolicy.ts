export type AdminAIActionPolicyType = "dangerous" | "read" | "suggest" | "write";

export type AdminAIApprovedKnowledgeSourcePolicy = {
  id: string;
  label: string;
  type: "internal" | "public-url";
  url?: string;
};

export type AdminAIOwnerPolicy = {
  actionPermissions: {
    dangerousEnabled: boolean;
    readEnabled: boolean;
    writeEnabled: boolean;
  };
  approvedKnowledgeSources: AdminAIApprovedKnowledgeSourcePolicy[];
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
  usageLimits: {
    dailyRequestsPerAdmin: number;
    maxTokensPerRequest: number;
    monthlyRequestsGlobal: number;
  };
};

export type AdminAIPolicyUsage = {
  dailyRequestsPerAdmin: number;
  monthlyRequestsGlobal: number;
};

export const DEFAULT_ADMIN_AI_OWNER_POLICY: AdminAIOwnerPolicy = {
  actionPermissions: { dangerousEnabled: false, readEnabled: true, writeEnabled: true },
  approvedKnowledgeSources: [],
  auditConfiguration: {
    enabled: true,
    recordDeniedAttempts: true,
    recordReadEvents: false,
    retentionDays: 90
  },
  featureAvailability: {
    artifacts: true,
    dailyBriefing: true,
    proactiveSuggestions: true,
    streaming: false,
    voice: false
  },
  modelRouting: {
    complexModel: "gpt-5.6-luna",
    defaultModel: "gpt-5.6-luna",
    fallbackModel: "gpt-5.6-luna"
  },
  retentionPeriodDays: 90,
  usageLimits: {
    dailyRequestsPerAdmin: 200,
    maxTokensPerRequest: 8192,
    monthlyRequestsGlobal: 10_000
  }
};

export function normalizeAdminAIOwnerPolicy(value: unknown): AdminAIOwnerPolicy {
  if (!isRecord(value)) return clonePolicy(DEFAULT_ADMIN_AI_OWNER_POLICY);
  const actionPermissions = value.actionPermissions;
  const auditConfiguration = value.auditConfiguration;
  const featureAvailability = value.featureAvailability;
  const modelRouting = value.modelRouting;
  const usageLimits = value.usageLimits;
  if (
    !isRecord(actionPermissions) ||
    !isRecord(auditConfiguration) ||
    !isRecord(featureAvailability) ||
    !isRecord(modelRouting) ||
    !isRecord(usageLimits) ||
    !Array.isArray(value.approvedKnowledgeSources)
  ) {
    return clonePolicy(DEFAULT_ADMIN_AI_OWNER_POLICY);
  }

  const sources = value.approvedKnowledgeSources
    .map(normalizeKnowledgeSource)
    .filter((source): source is AdminAIApprovedKnowledgeSourcePolicy => Boolean(source))
    .slice(0, 100);
  return {
    actionPermissions: {
      dangerousEnabled: actionPermissions.dangerousEnabled === true,
      readEnabled: actionPermissions.readEnabled !== false,
      writeEnabled: actionPermissions.writeEnabled !== false
    },
    approvedKnowledgeSources: sources,
    auditConfiguration: {
      enabled: auditConfiguration.enabled !== false,
      recordDeniedAttempts: auditConfiguration.recordDeniedAttempts !== false,
      recordReadEvents: auditConfiguration.recordReadEvents === true,
      retentionDays: 90
    },
    featureAvailability: {
      artifacts: featureAvailability.artifacts !== false,
      dailyBriefing: featureAvailability.dailyBriefing !== false,
      proactiveSuggestions: featureAvailability.proactiveSuggestions !== false,
      streaming: featureAvailability.streaming === true,
      voice: featureAvailability.voice === true
    },
    modelRouting: {
      complexModel: identifier(modelRouting.complexModel, "gpt-5.6-luna"),
      defaultModel: identifier(modelRouting.defaultModel, "gpt-5.6-luna"),
      fallbackModel: identifier(modelRouting.fallbackModel, "gpt-5.6-luna")
    },
    retentionPeriodDays: 90,
    usageLimits: {
      dailyRequestsPerAdmin: boundedInteger(usageLimits.dailyRequestsPerAdmin, 1, 100_000, 200),
      maxTokensPerRequest: boundedInteger(usageLimits.maxTokensPerRequest, 256, 131_072, 8192),
      monthlyRequestsGlobal: boundedInteger(
        usageLimits.monthlyRequestsGlobal,
        1,
        10_000_000,
        10_000
      )
    }
  };
}

export function scopeAdminAICommandsByOwnerPolicy<
  T extends {
    executionContract?: { availability?: "executable" | "not-applicable" | "review-only" };
    id?: string;
    reportTitle?: string;
    type: AdminAIActionPolicyType;
  }
>(commands: readonly T[], policy: AdminAIOwnerPolicy): T[] {
  return commands.filter(
    (command) =>
      (actionAllowed(policy, command.type) ||
        (command.type === "dangerous" &&
          command.executionContract?.availability === "review-only")) &&
      (policy.featureAvailability.dailyBriefing || !isDailyBriefing(command))
  );
}

export function evaluateAdminAIRequestPolicy(
  policy: AdminAIOwnerPolicy,
  input: {
    actionType: AdminAIActionPolicyType;
    feature?: keyof AdminAIOwnerPolicy["featureAvailability"];
    usage: AdminAIPolicyUsage;
  }
):
  | { allowed: true; code: "allowed" }
  | {
      allowed: false;
      code: "action-disabled" | "daily-limit" | "feature-disabled" | "monthly-limit";
      reason: string;
    } {
  if (!actionAllowed(policy, input.actionType)) {
    return {
      allowed: false,
      code: "action-disabled",
      reason: `The owner policy disables ${input.actionType} Admin AI actions.`
    };
  }
  if (input.feature && !policy.featureAvailability[input.feature]) {
    return {
      allowed: false,
      code: "feature-disabled",
      reason: `The owner policy disables the ${input.feature} Admin AI feature.`
    };
  }
  if (input.usage.dailyRequestsPerAdmin >= policy.usageLimits.dailyRequestsPerAdmin) {
    return {
      allowed: false,
      code: "daily-limit",
      reason: "The owner-approved daily Admin AI request limit has been reached."
    };
  }
  if (input.usage.monthlyRequestsGlobal >= policy.usageLimits.monthlyRequestsGlobal) {
    return {
      allowed: false,
      code: "monthly-limit",
      reason: "The owner-approved monthly Admin AI request limit has been reached."
    };
  }
  return { allowed: true, code: "allowed" };
}

export function resolveAdminAIModelPolicy(
  policy: AdminAIOwnerPolicy,
  mode: "deterministic" | "fast" | "reasoning",
  requestedMaxOutputTokens?: number,
  fallback = false
) {
  if (mode === "deterministic") return { maxOutputTokens: 0, model: null };
  const requested = Number.isFinite(requestedMaxOutputTokens)
    ? Math.max(1, Math.trunc(Number(requestedMaxOutputTokens)))
    : policy.usageLimits.maxTokensPerRequest;
  return {
    maxOutputTokens: Math.min(requested, policy.usageLimits.maxTokensPerRequest),
    model: fallback
      ? policy.modelRouting.fallbackModel
      : mode === "reasoning"
        ? policy.modelRouting.complexModel
        : policy.modelRouting.defaultModel
  };
}

export function shouldAuditAdminAIEvent(
  policy: AdminAIOwnerPolicy,
  input: {
    actionType: AdminAIActionPolicyType;
    phase: "completed" | "confirmed" | "denied" | "failed" | "requested";
  }
) {
  if (!policy.auditConfiguration.enabled) return false;
  if (input.phase === "denied" || input.phase === "failed") {
    return policy.auditConfiguration.recordDeniedAttempts;
  }
  if (input.actionType === "read" || input.actionType === "suggest") {
    return policy.auditConfiguration.recordReadEvents;
  }
  return true;
}

export function getAdminAIRetentionCutoff(
  _policy: AdminAIOwnerPolicy,
  _scope: "audit" | "general",
  now = Date.now()
) {
  return now - 90 * 24 * 60 * 60 * 1000;
}

export function applyAdminAIResponsePolicy<T extends Record<string, unknown>>(
  response: T,
  policy: AdminAIOwnerPolicy
): T {
  const safe = redactAdminAIValue(response);
  if (policy.featureAvailability.artifacts || !("artifact" in safe)) return safe;
  const withoutArtifact = { ...safe };
  delete withoutArtifact.artifact;
  return withoutArtifact;
}

export function redactAdminAIValue<T>(value: T): T {
  return redactValue(value, "") as T;
}

export function redactAdminAIText(value: string) {
  return value
    .replace(
      /\bauthorization\s*[:=]\s*bearer\s+[a-z0-9._~+/=-]{8,}/gi,
      "authorization=[REDACTED]"
    )
    .replace(
      /\b(api[_ -]?key|password|passwd|secret|session[_ -]?token|token|otp|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]"
    )
    .replace(/\bbearer\s+[a-z0-9._~+/=-]{8,}/gi, "[REDACTED]")
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED]")
    .replace(/(?:\+?\d[\s().-]*){10,15}/g, "[REDACTED]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED]");
}

function redactValue(value: unknown, key: string): unknown {
  if (sensitiveKey(key)) return "[REDACTED]";
  if (typeof value === "string" && isServerIssuedAdminAIReference(key, value)) return value;
  if (typeof value === "string") return redactAdminAIText(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, ""));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactValue(childValue, childKey)
    ])
  );
}

function isServerIssuedAdminAIReference(key: string, value: string) {
  if (!/^(?:auditReference|receiptId|requestId)$/.test(key)) return false;
  return /^admin-ai-(?:receipt-)?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function sensitiveKey(key: string) {
  return /(?:api.?key|authorization|card|cookie|email|otp|pass(?:word|wd)?|phone|secret|session|token)/i.test(
    key
  );
}

function actionAllowed(policy: AdminAIOwnerPolicy, type: AdminAIActionPolicyType) {
  if (type === "dangerous") return policy.actionPermissions.dangerousEnabled;
  if (type === "write") return policy.actionPermissions.writeEnabled;
  return policy.actionPermissions.readEnabled;
}

function isDailyBriefing(command: { id?: string; reportTitle?: string }) {
  return /daily[- ](?:admin[- ])?briefing/i.test(
    `${command.id || ""} ${command.reportTitle || ""}`
  );
}

function normalizeKnowledgeSource(value: unknown): AdminAIApprovedKnowledgeSourcePolicy | null {
  if (!isRecord(value)) return null;
  const id = identifier(value.id, "");
  const label = typeof value.label === "string" ? value.label.trim().slice(0, 120) : "";
  if (!id || !label || (value.type !== "internal" && value.type !== "public-url")) return null;
  if (value.type === "internal") return { id, label, type: "internal" };
  if (typeof value.url !== "string") return null;
  try {
    const url = new URL(value.url);
    return url.protocol === "https:"
      ? { id, label, type: "public-url", url: url.toString() }
      : null;
  } catch {
    return null;
  }
}

function identifier(value: unknown, fallback: string) {
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{1,80}$/.test(value.trim())
    ? value.trim()
    : fallback;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : fallback;
}

function clonePolicy(policy: AdminAIOwnerPolicy): AdminAIOwnerPolicy {
  return JSON.parse(JSON.stringify(policy)) as AdminAIOwnerPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
