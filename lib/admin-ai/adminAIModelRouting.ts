import type { AdminAIModelRoute } from "./adminAITypes";

export type AdminAITaskType =
  | "anomaly-analysis"
  | "basic-search"
  | "calculation"
  | "complex-report"
  | "copy-suggestion"
  | "cross-module-investigation"
  | "destructive-action-check"
  | "error-clustering"
  | "field-explanation"
  | "multi-step-action-plan"
  | "otp-check"
  | "page-summary"
  | "payment-status"
  | "permission-check"
  | "requirement-conflict-analysis"
  | "route-protection"
  | "security-recommendation"
  | "validation";

type ModelTarget = {
  maxInputTokens: number;
  maxOutputTokens: number;
  model: string;
  provider: string;
  reasoningEffort: "low" | "medium";
};

export type AdminAIModelRoutingOptions = {
  fast?: Partial<ModelTarget>;
  reasoning?: Partial<ModelTarget>;
};

export type AdminAIOperationalModelRoute = AdminAIModelRoute & {
  maxInputTokens: number;
  maxOutputTokens: number;
  model: string | null;
  provider: string | null;
  reasoningEffort: "low" | "medium" | null;
  task: AdminAITaskType;
};

export type AdminAIProviderRequest = {
  estimatedInputTokens: number;
  input: string;
  maxOutputTokens: number;
  model: string;
  reasoningEffort: "low" | "medium";
  signal?: AbortSignal;
  task: AdminAITaskType;
};

export type AdminAIProviderResponse =
  | string
  | {
      model?: string;
      modelVersion?: string;
      output: string;
      provider?: string;
      usage?: { inputTokens: number; outputTokens: number };
    };

export type AdminAIProviderAdapter = (
  request: AdminAIProviderRequest
) => Promise<AdminAIProviderResponse>;

export type AdminAIModelFallbackReason =
  | "deterministic-task"
  | "input-ceiling-exceeded"
  | "invalid-provider-response"
  | "provider-cancelled"
  | "provider-failure"
  | "provider-timeout"
  | "provider-unavailable";

export type AdminAIModelTelemetry = {
  inputTokens: number;
  model: string;
  modelVersion: string | null;
  outputTokens: number;
  provider: string;
  reasoningEffort: "low" | "medium" | null;
  tokenSource: "estimated" | "provider";
  totalTokens: number;
};

export type AdminAIModelDispatchResult = {
  estimatedInputTokens: number;
  fallbackReason?: AdminAIModelFallbackReason;
  output: string;
  route: AdminAIOperationalModelRoute;
  source: "deterministic" | "provider";
  telemetry: AdminAIModelTelemetry;
};

type DispatchAdminAIModelInput = {
  deterministicFallback: () => Promise<string> | string;
  input: string;
  options?: AdminAIModelRoutingOptions;
  providers: Readonly<Record<string, AdminAIProviderAdapter | undefined>>;
  query: string;
  requestedMaxOutputTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  validateProviderOutput?: (output: string) => boolean;
};

const DEFAULT_TARGETS = {
  fast: {
    maxInputTokens: 4_000,
    maxOutputTokens: 700,
    model: "gpt-5.6-luna",
    provider: "openai",
    reasoningEffort: "low"
  },
  reasoning: {
    maxInputTokens: 8_000,
    maxOutputTokens: 2_400,
    model: "gpt-5.6-luna",
    provider: "openai",
    reasoningEffort: "medium"
  }
} as const;

const TASK_MODES: Record<AdminAITaskType, AdminAIModelRoute["mode"]> = {
  "anomaly-analysis": "reasoning",
  "basic-search": "fast",
  calculation: "deterministic",
  "complex-report": "reasoning",
  "copy-suggestion": "fast",
  "cross-module-investigation": "reasoning",
  "destructive-action-check": "deterministic",
  "error-clustering": "reasoning",
  "field-explanation": "fast",
  "multi-step-action-plan": "reasoning",
  "otp-check": "deterministic",
  "page-summary": "fast",
  "payment-status": "deterministic",
  "permission-check": "deterministic",
  "requirement-conflict-analysis": "reasoning",
  "route-protection": "deterministic",
  "security-recommendation": "reasoning",
  validation: "deterministic"
};

const TASK_RULES: ReadonlyArray<readonly [AdminAITaskType, RegExp]> = [
  ["otp-check", /\botp\b|one[- ]time pass(?:word|code)/i],
  [
    "payment-status",
    /\b(payment status|paid status|payment verification)\b|\b(?:payment succeeded|paid)\b.{0,40}\b(?:publish failed|not published|publish pending)\b/i
  ],
  ["permission-check", /\b(permissions?|rbac|role access|access control)\b/i],
  ["validation", /\b(validate|validation|schema check|required fields?)\b/i],
  ["route-protection", /\b(route protection|protect(?:ed)?.{0,24}\broute|route guard)\b/i],
  ["destructive-action-check", /\b(delete|archive|remove|revoke|suspend|publish|unpublish)\b/i],
  ["calculation", /\b(calculate|calculation|compute|sum|total|percentage|conversion rate)\b/i],
  [
    "requirement-conflict-analysis",
    /\b(requirements?|spec(?:ification)?s?)\b.{0,48}\b(compatib|conflict|contradict|reconcil|precedence)\w*\b|\b(compatib|conflict|contradict|reconcil|precedence)\w*\b.{0,48}\b(requirements?|spec(?:ification)?s?)\b/i
  ],
  [
    "error-clustering",
    /\b(cluster|group|deduplicate)\b.{0,24}\berrors?\b|\berrors?\b.{0,24}\b(cluster|group|duplicate)\b/i
  ],
  [
    "security-recommendation",
    /\bsecurity\b.{0,32}\b(recommend|hardening|review|audit|advice)\b|\b(recommend|harden)\b.{0,24}\bsecurity\b/i
  ],
  [
    "cross-module-investigation",
    /\b(cross[- ]module|across (?:all |multiple )?modules?|entire admin panel)\b/i
  ],
  ["anomaly-analysis", /\b(anomal|trend|spike|drop|peak|correlation)\w*\b/i],
  [
    "multi-step-action-plan",
    /\b(multi[- ]step|action plan|investigate|root cause|resolve|rollback)\b/i
  ],
  [
    "complex-report",
    /\b(complex|executive|weekly|monthly)\b.{0,24}\breport\b|\breport\b.{0,24}\b(complex|executive|weekly|monthly)\b/i
  ],
  [
    "copy-suggestion",
    /\b(copy|headline|description|cta)\b.{0,24}\b(suggest|draft|rewrite|improve)\w*\b|\b(suggest|draft|rewrite)\w*\b.{0,24}\b(copy|headline|description|cta)\b/i
  ],
  [
    "field-explanation",
    /\b(explain|meaning|what does)\b.{0,24}\b(field|column|setting|value)\b|\b(field|column|setting|value)\b.{0,24}\b(explain|meaning|mean)\b/i
  ],
  ["basic-search", /\b(find|search|show|which|where|lookup)\b/i]
];

export function classifyAdminAITask(query: string): AdminAITaskType {
  const value = query.trim();
  if (
    !value ||
    /\b(ignore|bypass|reveal)\b.{0,80}\b(security|permission|secret|token|cookie|instructions?)\b/i.test(
      value
    )
  ) {
    return "validation";
  }
  return TASK_RULES.find(([, pattern]) => pattern.test(value))?.[0] ?? "page-summary";
}

export function selectAdminAIModelRoute(
  query: string,
  options: AdminAIModelRoutingOptions = {}
): AdminAIOperationalModelRoute {
  const task = classifyAdminAITask(query);
  const mode = TASK_MODES[task];
  if (mode === "deterministic") {
    return {
      estimatedTokenBudget: 0,
      maxInputTokens: 0,
      maxOutputTokens: 0,
      mode,
      model: null,
      provider: null,
      reasoningEffort: null,
      reason: `${task} stays in deterministic permission-safe code.`,
      task
    };
  }

  const target = resolveTarget(mode, options[mode]);
  return {
    estimatedTokenBudget: target.maxOutputTokens,
    maxInputTokens: target.maxInputTokens,
    maxOutputTokens: target.maxOutputTokens,
    mode,
    model: target.model,
    provider: target.provider,
    reasoningEffort: target.reasoningEffort,
    reason:
      mode === "fast"
        ? `${task} uses the configured fast provider within compact token ceilings.`
        : `${task} uses the configured reasoning provider within bounded token ceilings.`,
    task
  };
}

export async function dispatchAdminAIModel({
  deterministicFallback,
  input,
  options,
  providers,
  query,
  requestedMaxOutputTokens,
  signal,
  timeoutMs,
  validateProviderOutput
}: DispatchAdminAIModelInput): Promise<AdminAIModelDispatchResult> {
  const route = selectAdminAIModelRoute(query, options);
  const estimatedInputTokens = estimateTokens(input);
  const fallback = async (fallbackReason: AdminAIModelFallbackReason) => {
    const output = await deterministicFallback();
    const outputTokens = estimateTokens(output);
    return {
      estimatedInputTokens,
      fallbackReason,
      output,
      route,
      source: "deterministic" as const,
      telemetry: {
        inputTokens: estimatedInputTokens,
        model: "deterministic",
        modelVersion: null,
        outputTokens,
        provider: "deterministic",
        reasoningEffort: null,
        tokenSource: "estimated" as const,
        totalTokens: estimatedInputTokens + outputTokens
      }
    };
  };

  if (route.mode === "deterministic") return fallback("deterministic-task");
  if (estimatedInputTokens > route.maxInputTokens) {
    return fallback("input-ceiling-exceeded");
  }

  const provider = route.provider ? providers[route.provider] : undefined;
  if (typeof provider !== "function" || !route.model) {
    return fallback("provider-unavailable");
  }
  if (signal?.aborted) return fallback("provider-cancelled");

  const request = createAbortableProviderRequest(signal, timeoutMs);
  try {
    const requested = positiveInteger(requestedMaxOutputTokens, route.maxOutputTokens);
    const response = await raceProviderWithAbort(
      provider({
        estimatedInputTokens,
        input,
        maxOutputTokens: Math.min(requested, route.maxOutputTokens),
        model: route.model,
        reasoningEffort: route.reasoningEffort || (route.mode === "fast" ? "low" : "medium"),
        signal: request.signal,
        task: route.task
      }),
      request.signal
    );
    if (signal?.aborted) return fallback("provider-cancelled");
    if (request.timedOut()) return fallback("provider-timeout");
    const normalized = normalizeProviderResponse(response, route, estimatedInputTokens);
    const normalizedOutput = normalized?.output || "";
    if (
      !normalizedOutput ||
      (validateProviderOutput && !validateProviderOutput(normalizedOutput))
    ) {
      return fallback("invalid-provider-response");
    }
    return {
      estimatedInputTokens,
      output: normalizedOutput,
      route,
      source: "provider",
      telemetry: normalized!.telemetry
    };
  } catch {
    if (signal?.aborted) return fallback("provider-cancelled");
    if (request.timedOut()) return fallback("provider-timeout");
    return fallback("provider-failure");
  } finally {
    request.dispose();
  }
}

function normalizeProviderResponse(
  response: AdminAIProviderResponse,
  route: AdminAIOperationalModelRoute,
  estimatedInputTokens: number
) {
  const value = typeof response === "string" ? { output: response } : response;
  if (!value || typeof value.output !== "string") return null;
  const output = value.output.trim();
  if (!output) return null;

  const usage = "usage" in value ? value.usage : undefined;
  const hasProviderUsage = Boolean(
    usage && validTokenCount(usage.inputTokens) && validTokenCount(usage.outputTokens)
  );
  const inputTokens = hasProviderUsage ? usage!.inputTokens : estimatedInputTokens;
  const outputTokens = hasProviderUsage ? usage!.outputTokens : estimateTokens(output);
  const provider =
    cleanOptionalName("provider" in value ? value.provider : undefined) || route.provider;
  const model = cleanOptionalName("model" in value ? value.model : undefined) || route.model;
  if (!provider || !model) return null;

  return {
    output,
    telemetry: {
      inputTokens,
      model,
      modelVersion:
        cleanOptionalName("modelVersion" in value ? value.modelVersion : undefined) || null,
      outputTokens,
      provider,
      reasoningEffort: route.reasoningEffort,
      tokenSource: hasProviderUsage ? ("provider" as const) : ("estimated" as const),
      totalTokens: inputTokens + outputTokens
    }
  };
}

function createAbortableProviderRequest(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined
) {
  const controller = new AbortController();
  let timeoutTriggered = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = validTimeout(timeoutMs)
    ? setTimeout(() => {
        timeoutTriggered = true;
        controller.abort(new DOMException("Provider request timed out.", "TimeoutError"));
      }, timeoutMs)
    : null;

  return {
    dispose() {
      if (timeout !== null) clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    },
    signal: controller.signal,
    timedOut: () => timeoutTriggered
  };
}

function raceProviderWithAbort<T>(provider: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason || new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    provider.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function resolveTarget(
  mode: "fast" | "reasoning",
  override: Partial<ModelTarget> | undefined
): ModelTarget {
  const fallback = DEFAULT_TARGETS[mode];
  return {
    maxInputTokens: positiveInteger(override?.maxInputTokens, fallback.maxInputTokens),
    maxOutputTokens: positiveInteger(override?.maxOutputTokens, fallback.maxOutputTokens),
    model: cleanName(override?.model, fallback.model),
    provider: cleanName(override?.provider, fallback.provider),
    reasoningEffort:
      override?.reasoningEffort === "low" || override?.reasoningEffort === "medium"
        ? override.reasoningEffort
        : fallback.reasoningEffort
  };
}

function cleanName(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function cleanOptionalName(value: string | undefined) {
  const normalized = value?.trim() || "";
  return normalized && normalized.length <= 120 && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(normalized)
    ? normalized
    : "";
}

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
}

function estimateTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function validTokenCount(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000;
}

function validTimeout(value: number | undefined): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 3_600_000;
}
