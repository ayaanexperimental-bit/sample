import type { PromptIssue } from "./types";

type RiskRule = {
  pattern: RegExp;
  issue: PromptIssue;
};

export const promptRiskRules: RiskRule[] = [
  {
    pattern: /\b(cure|reverse permanently|guaranteed|100%|stop medicines?)\b/i,
    issue: {
      type: "medical_claim",
      severity: "high",
      explanation: "The prompt includes language that may imply a guaranteed medical result.",
      suggestedFix: "Use education, support, clinician-supervised, and results-vary framing."
    }
  },
  {
    pattern: /\b(fertility|pregnancy|infertility)\b/i,
    issue: {
      type: "medical_claim",
      severity: "high",
      explanation: "Fertility-related claims are sensitive and require careful approved wording.",
      suggestedFix: "Avoid fertility promises and keep copy educational unless legally reviewed."
    }
  },
  {
    pattern: /\b(symptoms?|diagnosis|medical history|patient data)\b/i,
    issue: {
      type: "privacy",
      severity: "medium",
      explanation: "The prompt may involve health-sensitive personal information.",
      suggestedFix:
        "Avoid sending health-sensitive details to analytics or unnecessary AI workflows."
    }
  },
  {
    pattern: /\b(build everything|whole site|complete automation|all at once)\b/i,
    issue: {
      type: "scope",
      severity: "medium",
      explanation: "The prompt scope is too broad for one safe implementation step.",
      suggestedFix: "Break the work into approval-gated micro-tasks."
    }
  }
];
