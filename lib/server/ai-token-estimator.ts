export type AiUsageEstimate = {
  approximateCostLevel: "Low" | "Medium" | "High";
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  warning: string;
};

export function estimateAiTokens(input: string, estimatedOutputTokens: number): AiUsageEstimate {
  const estimatedInputTokens = Math.max(1, Math.ceil(input.length / 4));
  const total = estimatedInputTokens + estimatedOutputTokens;

  return {
    approximateCostLevel: total >= 10_000 ? "High" : total >= 4_000 ? "Medium" : "Low",
    estimatedInputTokens,
    estimatedOutputTokens,
    warning:
      estimatedInputTokens > 8_000
        ? "Context is large. The server compacted it before generation."
        : ""
  };
}
