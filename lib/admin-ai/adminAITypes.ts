import type { AdminV2ViewId } from "../admin-v2-access";

export type AdminAIScope = "global" | "module" | "page" | "selection";
export type AdminAIConfidenceLevel = "high" | "insufficient-data" | "low" | "medium";
export type AdminAIApprovalLevel = 0 | 1 | 2 | 3;

export type AdminAIEntity = {
  id: string;
  label: string;
  matchReason: string;
  module: AdminV2ViewId;
  route: string;
  searchableText: string;
  source: string;
  status: string;
  updatedAt: string;
};

export type AdminAIEvidence = {
  dateRange: string;
  entityReferences?: string[];
  entityRoutes?: Record<string, string>;
  filters?: Record<string, string>;
  freshness: string;
  label: string;
  module: string;
  observedAt?: string;
  recordCount: number;
  source: string;
  sourceRoute?: string;
};

export type AdminAISearchResult = {
  id: string;
  label: string;
  matchReason: string;
  module: AdminV2ViewId;
  route: string;
  status: string;
  updatedAt: string;
};

export type AdminAIHealthSignal = {
  affectedEntity: string;
  confidence: AdminAIConfidenceLevel;
  directRoute: string;
  evidence: string;
  firstDetected: string;
  id: string;
  impact: string;
  lastDetected: string;
  module: string;
  recurrenceCount: number;
  severity: "critical" | "high" | "informational" | "low" | "medium";
  suggestedNextStep: string;
  title: string;
};

export type AdminAIHealthScoreComponent = {
  calculation?: string | null;
  howToImprove: string[];
  id: string;
  inputs: string[];
  label: string;
  missingInputs: string[];
  score: number | null;
  weight?: number | null;
};

export type AdminAIHealthScore = {
  calculatedAt: string;
  calculation?: string | null;
  components: AdminAIHealthScoreComponent[];
  missingInputs: string[];
  score: number | null;
};

export type AdminAIPlanStep = {
  actionId: string | null;
  api: string | null;
  id: string;
  label: string;
  mutation: boolean;
  status: "blocked" | "pending" | "ready";
};

export type AdminAIDryRun = {
  before: string[];
  dependencies: string[];
  errors: string[];
  generatedAt: string;
  proposedAfter: string[];
  publicOutputChanges: boolean;
  recordsSkipped: string[];
  validation: "blocked" | "ready" | "requires-review";
};

export type AdminAIDryRunPreview = Omit<AdminAIDryRun, "generatedAt">;

export type AdminAIPlan = {
  affectedRecords: string[];
  approvalLevel: AdminAIApprovalLevel;
  confirmationRequired: boolean;
  dryRun?: AdminAIDryRun;
  dryRunPreview?: AdminAIDryRunPreview;
  executable: boolean;
  expectedOutcome: string;
  id: string;
  otpRequired: boolean;
  permissions: string[];
  request: string;
  reversible: boolean;
  risks: string[];
  rollback: string;
  sectionId: AdminV2ViewId;
  steps: AdminAIPlanStep[];
  title: string;
};

export type AdminAIApprovalReceipt = {
  action: string;
  affectedRecords: string[];
  approvalLevel: AdminAIApprovalLevel;
  auditReference: string | null;
  confirmationTimestamp: string;
  currentState: string;
  executionStatus?: "failure" | "success";
  impact: string;
  impactLabel?: "Impact";
  outcome: string;
  otpRequired: boolean;
  permissionCheck: string;
  proposedState: string;
  recommendedByAI?: string;
  recordsChanged: number;
  requestedBy: string;
  reversible: boolean;
  rollbackAvailable?: boolean;
};

export type AdminAIRollbackAction = {
  label: string;
  receiptId: string;
  recordId: string;
};

export type AdminAIArtifact = {
  content: string;
  createdAt: string;
  id: string;
  sourceContext: string;
  title: string;
  type:
    | "action-plan"
    | "checklist"
    | "configuration-comparison"
    | "error-investigation"
    | "health-report"
    | "incident-summary"
    | "performance-summary"
    | "publish-readiness"
    | "report";
};

export type AdminAIModelRoute = {
  estimatedTokenBudget: number;
  mode: "deterministic" | "fast" | "reasoning";
  reason: string;
};

export type AdminAIProgressStep = {
  id: string;
  label: string;
  status: "complete" | "pending" | "working";
};

export type AdminAIFeedbackKind =
  | "helpful"
  | "incorrect-data"
  | "missing-context"
  | "not-helpful"
  | "unsafe-suggestion";
