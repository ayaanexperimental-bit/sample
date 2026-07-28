const ADMIN_AI_BUG_CATEGORIES = [
  "authentication",
  "builder-validation",
  "data-quality",
  "payment",
  "performance",
  "publishing",
  "role-permission",
  "ui-regression"
] as const;
const ADMIN_AI_UI_PAIN_POINTS = [
  "form-validation",
  "mobile-navigation",
  "table-filtering",
  "unclear-error",
  "workflow-navigation"
] as const;
const ADMIN_AI_REJECTED_PHRASING_PATTERNS = [
  "generic-intro",
  "unsupported-certainty",
  "vague-action",
  "verbose-summary"
] as const;
const ADMIN_AI_COACH_REPORT_STYLES = ["concise-actions-first", "concise-metrics-first"] as const;
const ADMIN_AI_COPY_STYLES = ["concise", "direct", "professional"] as const;
const ADMIN_AI_RECOMMENDATION_PRIORITIES = [
  "data-quality",
  "reliability",
  "recovery",
  "safety"
] as const;
const MAX_LEARNED_ITEMS = 8;
const MAX_REPEATED_ISSUE_OCCURRENCES = 99;

export type AdminAIBugCategory = (typeof ADMIN_AI_BUG_CATEGORIES)[number];
export type AdminAIUIPainPoint = (typeof ADMIN_AI_UI_PAIN_POINTS)[number];
export type AdminAIRejectedPhrasingPattern = (typeof ADMIN_AI_REJECTED_PHRASING_PATTERNS)[number];
export type AdminAICoachReportStyle = (typeof ADMIN_AI_COACH_REPORT_STYLES)[number];
export type AdminAICopyStyle = (typeof ADMIN_AI_COPY_STYLES)[number];
export type AdminAIRecommendationPriority = (typeof ADMIN_AI_RECOMMENDATION_PRIORITIES)[number];

export type AdminAIRepeatedIssueMemory = {
  category: AdminAIBugCategory;
  occurrences: number;
};

export type AdminAISafeLearningMemory = {
  bugCategories: AdminAIBugCategory[];
  coachReportStyle: AdminAICoachReportStyle;
  copyStyle: AdminAICopyStyle;
  recommendationPriorities: AdminAIRecommendationPriority[];
  rejectedPhrasingPatterns: AdminAIRejectedPhrasingPattern[];
  repeatedIssues: AdminAIRepeatedIssueMemory[];
  uiPainPoints: AdminAIUIPainPoint[];
};

export type AdminAIPreferences = {
  dailyBriefing: boolean;
  enabled: boolean;
  includeActionItems: boolean;
  memoryEnabled: boolean;
  notificationPreference: "both" | "email" | "in-app" | "none";
  preferredLanguage: "en" | "hi";
  proactiveSuggestions: boolean;
  reportFormat: "operations" | "summary";
  reportStyle: "concise" | "detailed";
  responseLength: "concise" | "detailed";
  safeLearning: AdminAISafeLearningMemory;
};

const STORAGE_KEY = "yw-admin-ai-preferences-v1";
export const DEFAULT_ADMIN_AI_PREFERENCES: AdminAIPreferences = {
  dailyBriefing: false,
  enabled: true,
  includeActionItems: true,
  memoryEnabled: true,
  notificationPreference: "in-app",
  preferredLanguage: "en",
  proactiveSuggestions: true,
  reportFormat: "operations",
  reportStyle: "concise",
  responseLength: "concise",
  safeLearning: defaultSafeLearningMemory()
};

export type AdminAIApprovedPreferenceCorrection = {
  automaticRetraining: boolean;
  category:
    | "known-issue-classification"
    | "preferred-wording"
    | "report-interpretation"
    | "workflow-preference";
  correction: string;
  reviewStatus: "approved" | "pending" | "rejected";
  securityOverride: boolean;
};

export function loadAdminAIPreferences(storage: Pick<Storage, "getItem"> | null | undefined) {
  if (!storage) return DEFAULT_ADMIN_AI_PREFERENCES;

  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || "{}") as Partial<AdminAIPreferences>;
    return normalizeAdminAIPreferences(value);
  } catch {
    return DEFAULT_ADMIN_AI_PREFERENCES;
  }
}

export function saveAdminAIPreferences(
  storage: Pick<Storage, "setItem"> | null | undefined,
  preferences: AdminAIPreferences
) {
  if (!storage) return false;

  try {
    const normalized = normalizeAdminAIPreferences(preferences);
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalized.memoryEnabled ? normalized : { memoryEnabled: false })
    );
    return true;
  } catch {
    return false;
  }
}

export function normalizeAdminAIPreferences(value: Partial<AdminAIPreferences>) {
  const memoryEnabled = value.memoryEnabled !== false;
  const responseLength =
    value.responseLength === "detailed" || value.reportStyle === "detailed"
      ? "detailed"
      : "concise";
  return {
    dailyBriefing: value.dailyBriefing === true,
    enabled: value.enabled !== false,
    includeActionItems: value.includeActionItems !== false,
    memoryEnabled,
    notificationPreference:
      value.notificationPreference === "both" ||
      value.notificationPreference === "email" ||
      value.notificationPreference === "none"
        ? value.notificationPreference
        : "in-app",
    preferredLanguage: value.preferredLanguage === "hi" ? "hi" : "en",
    proactiveSuggestions: value.proactiveSuggestions !== false,
    reportFormat: value.reportFormat === "summary" ? "summary" : "operations",
    reportStyle: responseLength,
    responseLength,
    safeLearning: memoryEnabled
      ? normalizeSafeLearningMemory(value.safeLearning)
      : defaultSafeLearningMemory()
  } satisfies AdminAIPreferences;
}

export function applyApprovedAdminAIPreferenceCorrections(
  preferences: AdminAIPreferences,
  corrections: readonly AdminAIApprovedPreferenceCorrection[]
) {
  let next = normalizeAdminAIPreferences(preferences);
  if (!next.memoryEnabled) return next;

  for (const correction of corrections) {
    if (
      correction.reviewStatus !== "approved" ||
      correction.securityOverride ||
      correction.automaticRetraining
    ) {
      continue;
    }
    const parsed = parsePreferenceCorrection(correction);
    if (!parsed) continue;
    next = applyParsedPreferenceCorrection(next, parsed);
  }
  return normalizeAdminAIPreferences(next);
}

export function buildAdminAIMemoryGuidance(preferences: AdminAIPreferences) {
  const learning = normalizeAdminAIPreferences(preferences).safeLearning;
  const repeatedErrorTriage = [...learning.repeatedIssues].sort(
    (left, right) =>
      right.occurrences - left.occurrences || left.category.localeCompare(right.category)
  );
  const recommendationPriorities = [...learning.recommendationPriorities];
  for (const issue of repeatedErrorTriage) {
    appendUnique(recommendationPriorities, recommendationPriorityForIssue(issue.category));
  }

  return {
    coachReportStyle: learning.coachReportStyle,
    copyStyle: learning.copyStyle,
    duplicateIssueCategories: repeatedErrorTriage
      .filter(({ occurrences }) => occurrences >= 2)
      .map(({ category }) => category),
    recommendationPriorities,
    rejectedPhrasingPatterns: [...learning.rejectedPhrasingPatterns],
    repeatedErrorTriage,
    uiPainPoints: [...learning.uiPainPoints]
  };
}

export function clearAdminAIPreferences(storage: Pick<Storage, "removeItem"> | null | undefined) {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function parsePreferenceCorrection(
  correction: AdminAIApprovedPreferenceCorrection
): ParsedPreferenceCorrection | null {
  let value: unknown;
  try {
    value = JSON.parse(correction.correction);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const allowed = allowedCorrectionKeys(correction.category);
  if (!Object.keys(record).length || Object.keys(record).some((key) => !allowed.has(key))) {
    return null;
  }

  const parsed: ParsedPreferenceCorrection = { preferencePatch: {} };
  if (record.preferredLanguage !== undefined) {
    if (record.preferredLanguage !== "en" && record.preferredLanguage !== "hi") return null;
    parsed.preferencePatch.preferredLanguage = record.preferredLanguage;
  }
  if (record.responseLength !== undefined) {
    if (record.responseLength !== "concise" && record.responseLength !== "detailed") return null;
    parsed.preferencePatch.responseLength = record.responseLength;
    parsed.preferencePatch.reportStyle = record.responseLength;
  }
  if (record.dailyBriefing !== undefined) {
    if (typeof record.dailyBriefing !== "boolean") return null;
    parsed.preferencePatch.dailyBriefing = record.dailyBriefing;
  }
  if (record.notificationPreference !== undefined) {
    if (!["both", "email", "in-app", "none"].includes(String(record.notificationPreference))) {
      return null;
    }
    parsed.preferencePatch.notificationPreference =
      record.notificationPreference as AdminAIPreferences["notificationPreference"];
  }
  if (record.reportFormat !== undefined) {
    if (record.reportFormat !== "operations" && record.reportFormat !== "summary") return null;
    parsed.preferencePatch.reportFormat = record.reportFormat;
  }
  if (record.bugCategory !== undefined) {
    if (!isAllowedValue(record.bugCategory, ADMIN_AI_BUG_CATEGORIES)) return null;
    if (
      typeof record.occurrences !== "number" ||
      !Number.isInteger(record.occurrences) ||
      record.occurrences < 1
    ) {
      return null;
    }
    parsed.bugCategory = record.bugCategory;
    parsed.occurrences = Math.min(record.occurrences, MAX_REPEATED_ISSUE_OCCURRENCES);
  }
  if (record.uiPainPoint !== undefined) {
    if (!isAllowedValue(record.uiPainPoint, ADMIN_AI_UI_PAIN_POINTS)) return null;
    parsed.uiPainPoint = record.uiPainPoint;
  }
  if (record.rejectedPhrasingPattern !== undefined) {
    if (!isAllowedValue(record.rejectedPhrasingPattern, ADMIN_AI_REJECTED_PHRASING_PATTERNS)) {
      return null;
    }
    parsed.rejectedPhrasingPattern = record.rejectedPhrasingPattern;
  }
  if (record.coachReportStyle !== undefined) {
    if (!isAllowedValue(record.coachReportStyle, ADMIN_AI_COACH_REPORT_STYLES)) return null;
    parsed.coachReportStyle = record.coachReportStyle;
  }
  if (record.copyStyle !== undefined) {
    if (!isAllowedValue(record.copyStyle, ADMIN_AI_COPY_STYLES)) return null;
    parsed.copyStyle = record.copyStyle;
  }
  if (record.recommendationPriority !== undefined) {
    if (!isAllowedValue(record.recommendationPriority, ADMIN_AI_RECOMMENDATION_PRIORITIES)) {
      return null;
    }
    parsed.recommendationPriority = record.recommendationPriority;
  }
  return parsed;
}

type ParsedPreferenceCorrection = {
  bugCategory?: AdminAIBugCategory;
  coachReportStyle?: AdminAICoachReportStyle;
  copyStyle?: AdminAICopyStyle;
  occurrences?: number;
  preferencePatch: Partial<Omit<AdminAIPreferences, "safeLearning">>;
  recommendationPriority?: AdminAIRecommendationPriority;
  rejectedPhrasingPattern?: AdminAIRejectedPhrasingPattern;
  uiPainPoint?: AdminAIUIPainPoint;
};

function allowedCorrectionKeys(category: AdminAIApprovedPreferenceCorrection["category"]) {
  if (category === "known-issue-classification") {
    return new Set(["bugCategory", "occurrences"]);
  }
  if (category === "preferred-wording") {
    return new Set(["copyStyle", "preferredLanguage", "rejectedPhrasingPattern", "responseLength"]);
  }
  if (category === "report-interpretation") {
    return new Set(["coachReportStyle", "recommendationPriority"]);
  }
  return new Set(["dailyBriefing", "notificationPreference", "reportFormat", "uiPainPoint"]);
}

function applyParsedPreferenceCorrection(
  preferences: AdminAIPreferences,
  parsed: ParsedPreferenceCorrection
) {
  const safeLearning = normalizeSafeLearningMemory(preferences.safeLearning);
  if (parsed.bugCategory && parsed.occurrences) {
    appendUnique(safeLearning.bugCategories, parsed.bugCategory);
    const existing = safeLearning.repeatedIssues.find(
      ({ category }) => category === parsed.bugCategory
    );
    if (existing) {
      existing.occurrences = Math.min(
        existing.occurrences + parsed.occurrences,
        MAX_REPEATED_ISSUE_OCCURRENCES
      );
    } else if (safeLearning.repeatedIssues.length < MAX_LEARNED_ITEMS) {
      safeLearning.repeatedIssues.push({
        category: parsed.bugCategory,
        occurrences: parsed.occurrences
      });
    }
  }
  if (parsed.uiPainPoint) appendUnique(safeLearning.uiPainPoints, parsed.uiPainPoint);
  if (parsed.rejectedPhrasingPattern) {
    appendUnique(safeLearning.rejectedPhrasingPatterns, parsed.rejectedPhrasingPattern);
  }
  if (parsed.recommendationPriority) {
    appendUnique(safeLearning.recommendationPriorities, parsed.recommendationPriority);
  }
  if (parsed.coachReportStyle) safeLearning.coachReportStyle = parsed.coachReportStyle;
  if (parsed.copyStyle) safeLearning.copyStyle = parsed.copyStyle;
  return { ...preferences, ...parsed.preferencePatch, safeLearning };
}

function defaultSafeLearningMemory(): AdminAISafeLearningMemory {
  return {
    bugCategories: [],
    coachReportStyle: "concise-actions-first",
    copyStyle: "concise",
    recommendationPriorities: [],
    rejectedPhrasingPatterns: [],
    repeatedIssues: [],
    uiPainPoints: []
  };
}

function normalizeSafeLearningMemory(value: unknown): AdminAISafeLearningMemory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSafeLearningMemory();
  }
  const record = value as Record<string, unknown>;
  return {
    bugCategories: normalizeAllowedList(record.bugCategories, ADMIN_AI_BUG_CATEGORIES),
    coachReportStyle: isAllowedValue(record.coachReportStyle, ADMIN_AI_COACH_REPORT_STYLES)
      ? record.coachReportStyle
      : "concise-actions-first",
    copyStyle: isAllowedValue(record.copyStyle, ADMIN_AI_COPY_STYLES)
      ? record.copyStyle
      : "concise",
    recommendationPriorities: normalizeAllowedList(
      record.recommendationPriorities,
      ADMIN_AI_RECOMMENDATION_PRIORITIES
    ),
    rejectedPhrasingPatterns: normalizeAllowedList(
      record.rejectedPhrasingPatterns,
      ADMIN_AI_REJECTED_PHRASING_PATTERNS
    ),
    repeatedIssues: normalizeRepeatedIssues(record.repeatedIssues),
    uiPainPoints: normalizeAllowedList(record.uiPainPoints, ADMIN_AI_UI_PAIN_POINTS)
  };
}

function normalizeRepeatedIssues(value: unknown) {
  if (!Array.isArray(value)) return [];
  const result: AdminAIRepeatedIssueMemory[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const record = candidate as Record<string, unknown>;
    if (
      !isAllowedValue(record.category, ADMIN_AI_BUG_CATEGORIES) ||
      typeof record.occurrences !== "number" ||
      !Number.isInteger(record.occurrences) ||
      record.occurrences < 1
    ) {
      continue;
    }
    const existing = result.find(({ category }) => category === record.category);
    const occurrences = Math.min(record.occurrences, MAX_REPEATED_ISSUE_OCCURRENCES);
    if (existing) {
      existing.occurrences = Math.min(
        existing.occurrences + occurrences,
        MAX_REPEATED_ISSUE_OCCURRENCES
      );
    } else if (result.length < MAX_LEARNED_ITEMS) {
      result.push({ category: record.category, occurrences });
    }
  }
  return result;
}

function normalizeAllowedList<T extends string>(value: unknown, allowed: readonly T[]) {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const candidate of value) {
    if (isAllowedValue(candidate, allowed)) appendUnique(result, candidate);
  }
  return result;
}

function isAllowedValue<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function appendUnique<T>(values: T[], value: T) {
  if (!values.includes(value) && values.length < MAX_LEARNED_ITEMS) values.push(value);
}

function recommendationPriorityForIssue(
  category: AdminAIBugCategory
): AdminAIRecommendationPriority {
  if (category === "authentication" || category === "role-permission") return "safety";
  if (category === "payment" || category === "publishing") return "recovery";
  if (category === "performance") return "reliability";
  return "data-quality";
}
