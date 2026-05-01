import { promptRiskRules } from "./risk-rules";
import type { PromptAnalysisInput, PromptAnalysisResult, PromptRiskLevel } from "./types";

function getRiskLevel(matches: number, hasHighSeverityIssue: boolean): PromptRiskLevel {
  if (hasHighSeverityIssue) {
    return "high";
  }

  if (matches > 0) {
    return "medium";
  }

  return "low";
}

export function analyzePrompt(input: PromptAnalysisInput): PromptAnalysisResult {
  const detectedIssues = promptRiskRules
    .filter((rule) => rule.pattern.test(input.prompt))
    .map((rule) => rule.issue);

  const riskLevel = getRiskLevel(
    detectedIssues.length,
    detectedIssues.some((issue) => issue.severity === "high")
  );

  return {
    summary: "Initial rule-based analysis stub. This does not call an AI model yet.",
    riskLevel,
    detectedIssues,
    missingInputs: [],
    recommendedMicroTasks: [],
    safeRewrittenPrompt: input.prompt,
    needsUserClarification: false,
    clarificationQuestions: []
  };
}
