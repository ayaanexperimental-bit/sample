import type { AdminAIFeedbackKind } from "./adminAITypes";

export type AdminAIObservation = {
  command: string;
  feedback?: AdminAIFeedbackKind;
  id: string;
  latencyMs: number;
  model: "deterministic" | "fast" | "reasoning";
  module: string;
  outcome: "blocked" | "cancelled" | "failed" | "success";
  safetyRefusal: boolean;
  timestamp: string;
};

export type AdminAIObservationSummary = {
  averageLatencyMs: number;
  blocked: number;
  cancelled: number;
  failed: number;
  requests: number;
  successRate: number;
  topCommands: Array<{ command: string; count: number }>;
};

export function createAdminAIObservation(
  input: Omit<AdminAIObservation, "id" | "timestamp">
): AdminAIObservation {
  const timestamp = new Date().toISOString();
  return {
    ...input,
    id: `ai-${stableHash(`${input.module}:${input.command}:${timestamp}`)}`,
    timestamp,
  };
}

export function summarizeAdminAIObservations(
  observations: AdminAIObservation[]
): AdminAIObservationSummary {
  const commands = new Map<string, number>();
  observations.forEach((item) => commands.set(item.command, (commands.get(item.command) || 0) + 1));
  const successful = observations.filter((item) => item.outcome === "success").length;
  return {
    averageLatencyMs: observations.length
      ? Math.round(observations.reduce((total, item) => total + item.latencyMs, 0) / observations.length)
      : 0,
    blocked: observations.filter((item) => item.outcome === "blocked").length,
    cancelled: observations.filter((item) => item.outcome === "cancelled").length,
    failed: observations.filter((item) => item.outcome === "failed").length,
    requests: observations.length,
    successRate: observations.length ? Math.round((successful / observations.length) * 100) : 0,
    topCommands: Array.from(commands, ([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

function stableHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 33) ^ value.charCodeAt(index);
  return (hash >>> 0).toString(36);
}
