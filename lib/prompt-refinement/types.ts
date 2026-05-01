export type PromptRiskLevel = "low" | "medium" | "high";

export type PromptIssueType =
  | "medical_claim"
  | "legal"
  | "privacy"
  | "ambiguity"
  | "scope"
  | "implementation_risk";

export type PromptIssueSeverity = "low" | "medium" | "high";

export type PromptIssue = {
  type: PromptIssueType;
  severity: PromptIssueSeverity;
  explanation: string;
  suggestedFix: string;
};

export type RecommendedMicroTask = {
  id: string;
  title: string;
  goal: string;
  filesLikelyTouched: string[];
  acceptanceCriteria: string[];
};

export type PromptAnalysisResult = {
  summary: string;
  riskLevel: PromptRiskLevel;
  detectedIssues: PromptIssue[];
  missingInputs: string[];
  recommendedMicroTasks: RecommendedMicroTask[];
  safeRewrittenPrompt: string;
  needsUserClarification: boolean;
  clarificationQuestions: string[];
};

export type PromptAnalysisInput = {
  prompt: string;
  context?: string;
};
