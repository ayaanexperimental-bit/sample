import type { AdminAIModelFallbackReason } from "./adminAIModelRouting";
import type { AdminAIResponse } from "./adminAIService";

export type AdminAIDegradedProviderReason = Exclude<
  AdminAIModelFallbackReason,
  "deterministic-task"
>;

export type AdminAIResponseOutcome = {
  activityDetail: string;
  activityStatus: "error" | "success";
  assistantState: "success" | "warning";
  checkpointReasonCode: "safe-checkpoint" | AdminAIDegradedProviderReason;
  checkpointStatus: "active" | "failed-safe";
  degraded: boolean;
  observationOutcome: "blocked" | "failed" | "success";
};

export function getAdminAIResponseOutcome(
  response: AdminAIResponse,
  scopeLabel: string
): AdminAIResponseOutcome {
  const blocked = response.state === "insufficient-permission";
  const degraded = Boolean(response.providerFallbackReason);
  if (blocked) {
    return {
      activityDetail: "A natural-language request was blocked by safety policy.",
      activityStatus: "error",
      assistantState: "warning",
      checkpointReasonCode: "safe-checkpoint",
      checkpointStatus: "active",
      degraded: false,
      observationOutcome: "blocked"
    };
  }
  if (response.providerFallbackReason) {
    return {
      activityDetail: `Provider result degraded safely (${response.providerFallbackReason}); deterministic fallback remained available.`,
      activityStatus: "error",
      assistantState: "warning",
      checkpointReasonCode: response.providerFallbackReason,
      checkpointStatus: "failed-safe",
      degraded,
      observationOutcome: "failed"
    };
  }
  return {
    activityDetail: `Grounded ${scopeLabel} request completed.`,
    activityStatus: "success",
    assistantState: "success",
    checkpointReasonCode: "safe-checkpoint",
    checkpointStatus: "active",
    degraded: false,
    observationOutcome: "success"
  };
}
