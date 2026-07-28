export const ADMIN_AI_FORM_CAPABILITIES = [
  "explain-field",
  "validate-completeness",
  "identify-conflicts",
  "suggest-copy",
  "normalize-input",
  "flag-unsafe-claims",
  "check-url-format",
  "prepare-field-values",
  "compare-current-configuration",
  "warn-risky-changes"
] as const;

export type AdminAIFormCapability = (typeof ADMIN_AI_FORM_CAPABILITIES)[number];
export type AdminAIFormRisk = "high" | "low" | "medium";

export type AdminAIFormField = {
  conflictsWith?: string[];
  currentConfiguration?: string;
  explanation: string;
  id: string;
  label: string;
  required?: boolean;
  riskyChange?: boolean;
  type: "copy" | "email" | "setting" | "tel" | "text" | "url";
  value: string;
};

export type AdminAIFormProposal = {
  fieldId: string;
  proposed: string;
  reason: string;
  risk?: AdminAIFormRisk;
};

export type AdminAIFormSuggestion = {
  actions: readonly ["apply", "reject"];
  approvalLevel: 1;
  confirmationRequired: true;
  executionAvailability: "not-applicable";
  fieldId: string;
  original: string;
  proposed: string;
  reason: string;
  risk: AdminAIFormRisk;
  suggestedValue: string;
};

export type AdminAIFormReviewInput = {
  assistanceEnabled: boolean;
  fields: AdminAIFormField[];
  formId: string;
  proposals?: AdminAIFormProposal[];
};

export function reviewAdminAIForm(input: AdminAIFormReviewInput) {
  const formId = cleanIdentifier(input.formId, 100);
  const fields = input.fields
    .slice(0, 120)
    .map(normalizeField)
    .filter((field) => field.id);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const originalValues = Object.fromEntries(fields.map((field) => [field.id, field.originalValue]));
  const disabled = {
    advisoryOnly: true as const,
    assistanceEnabled: false as const,
    capabilities: ADMIN_AI_FORM_CAPABILITIES,
    comparisons: [],
    conflicts: [],
    diagnostics: [],
    explanations: [],
    formId,
    invalidUrls: [],
    missingRequired: [],
    originalValues,
    suggestions: [] as AdminAIFormSuggestion[],
    unsafeClaims: [],
    values: { ...originalValues },
    warnings: []
  };

  if (!input.assistanceEnabled) return disabled;

  const explanations = fields.map((field) => ({ fieldId: field.id, text: field.explanation }));
  const missingRequired = fields
    .filter((field) => field.required && !field.normalizedValue)
    .map((field) => field.id);
  const conflicts = findConflicts(fields, fieldById);
  const invalidUrls = fields
    .filter((field) => field.type === "url" && field.normalizedValue)
    .filter((field) => !isSafeHttpsUrl(field.normalizedValue))
    .map((field) => ({
      fieldId: field.id,
      reason: "URL must use HTTPS and contain a valid public hostname.",
      value: field.normalizedValue
    }));
  const unsafeClaims = fields.flatMap((field) => {
    if (field.type !== "copy" && field.type !== "text") return [];
    const terms = findUnsafeClaimTerms(field.normalizedValue);
    return terms.length ? [{ fieldId: field.id, terms }] : [];
  });
  const comparisons = fields.flatMap((field) =>
    field.currentConfiguration !== undefined &&
    normalizeText(field.currentConfiguration, 500) !== field.normalizedValue
      ? [
          {
            currentConfiguration: normalizeText(field.currentConfiguration, 500),
            fieldId: field.id,
            formValue: field.normalizedValue
          }
        ]
      : []
  );
  const suggestions = buildSuggestions(fields, fieldById, input.proposals || []);
  const warnings = [
    ...suggestions
      .filter((suggestion) => suggestion.risk !== "low")
      .map(
        (suggestion) =>
          `${suggestion.fieldId} is a ${suggestion.risk}-risk proposed change and requires explicit review.`
      ),
    ...fields
      .filter((field) => field.riskyChange)
      .map((field) => `${field.id} is configured as a risky field and requires explicit review.`)
  ];
  const diagnostics = [
    ...missingRequired.map((fieldId) => `Required field ${fieldId} is incomplete.`),
    ...conflicts.map((conflict) => conflict.reason),
    ...invalidUrls.map((url) => `${url.fieldId}: ${url.reason}`),
    ...unsafeClaims.map(
      (claim) => `${claim.fieldId} contains unsafe claim terms: ${claim.terms.join(", ")}.`
    )
  ];

  return {
    advisoryOnly: true as const,
    assistanceEnabled: true as const,
    capabilities: ADMIN_AI_FORM_CAPABILITIES,
    comparisons,
    conflicts,
    diagnostics,
    explanations,
    formId,
    invalidUrls,
    missingRequired,
    originalValues,
    suggestions,
    unsafeClaims,
    values: { ...originalValues },
    warnings
  };
}

export function applyAdminAIFormSuggestion(
  current: Record<string, string>,
  suggestion: AdminAIFormSuggestion
) {
  if (!Object.prototype.hasOwnProperty.call(current, suggestion.fieldId)) {
    return { applied: false as const, reason: "unknown-field" as const, values: { ...current } };
  }
  if (current[suggestion.fieldId] !== suggestion.original) {
    return { applied: false as const, reason: "stale-original" as const, values: { ...current } };
  }
  return {
    applied: true as const,
    reason: "applied" as const,
    values: { ...current, [suggestion.fieldId]: suggestion.proposed }
  };
}

export function applyAdminAIFormSuggestions(
  current: Record<string, string>,
  suggestions: ReadonlyArray<AdminAIFormSuggestion>
) {
  let values = { ...current };
  const appliedFieldIds: string[] = [];
  const skippedFieldIds: string[] = [];

  for (const suggestion of suggestions.slice(0, 120)) {
    const result = applyAdminAIFormSuggestion(values, suggestion);
    values = result.values;
    (result.applied ? appliedFieldIds : skippedFieldIds).push(suggestion.fieldId);
  }

  return { appliedFieldIds, skippedFieldIds, values };
}

export function rejectAdminAIFormSuggestion(
  current: Record<string, string>,
  _suggestion: AdminAIFormSuggestion
) {
  void _suggestion;
  return { applied: false as const, reason: "rejected" as const, values: { ...current } };
}

type NormalizedField = ReturnType<typeof normalizeField>;

function normalizeField(field: AdminAIFormField) {
  const type = ["copy", "email", "setting", "tel", "text", "url"].includes(field.type)
    ? field.type
    : "text";
  return {
    conflictsWith: Array.from(
      new Set((field.conflictsWith || []).map((id) => cleanIdentifier(id, 100)).filter(Boolean))
    ),
    currentConfiguration:
      typeof field.currentConfiguration === "string" ? field.currentConfiguration : undefined,
    explanation: normalizeText(field.explanation, 300),
    id: cleanIdentifier(field.id, 100),
    label: normalizeText(field.label, 160),
    normalizedValue: normalizeFieldValue(field.value, type),
    originalValue: cleanControlCharacters(field.value, 2_000),
    required: field.required === true,
    riskyChange: field.riskyChange === true,
    type: type as AdminAIFormField["type"]
  };
}

function buildSuggestions(
  fields: NormalizedField[],
  fieldById: Map<string, NormalizedField>,
  proposals: AdminAIFormProposal[]
) {
  const proposalByField = new Map<string, AdminAIFormSuggestion>();
  for (const proposal of proposals.slice(0, 120)) {
    const fieldId = cleanIdentifier(proposal.fieldId, 100);
    const field = fieldById.get(fieldId);
    if (!field || proposalByField.has(fieldId)) continue;
    const proposed = cleanControlCharacters(proposal.proposed, 2_000);
    if (proposed === field.originalValue) continue;
    proposalByField.set(fieldId, {
      actions: ["apply", "reject"] as const,
      approvalLevel: 1,
      confirmationRequired: true,
      executionAvailability: "not-applicable",
      fieldId,
      original: field.originalValue,
      proposed,
      reason:
        normalizeText(proposal.reason, 300) ||
        "Optional suggestion generated from the current permission-visible form context.",
      risk: normalizeRisk(proposal.risk),
      suggestedValue: proposed
    });
  }

  for (const field of fields) {
    if (proposalByField.has(field.id) || field.normalizedValue === field.originalValue) continue;
    proposalByField.set(field.id, {
      actions: ["apply", "reject"] as const,
      approvalLevel: 1,
      confirmationRequired: true,
      executionAvailability: "not-applicable",
      fieldId: field.id,
      original: field.originalValue,
      proposed: field.normalizedValue,
      reason: "Normalize whitespace and formatting without changing the field meaning.",
      risk: "low",
      suggestedValue: field.normalizedValue
    });
  }

  return fields.flatMap((field) => {
    const suggestion = proposalByField.get(field.id);
    return suggestion ? [suggestion] : [];
  });
}

function findConflicts(fields: NormalizedField[], fieldById: Map<string, NormalizedField>) {
  const seen = new Set<string>();
  return fields.flatMap((field) =>
    field.conflictsWith.flatMap((otherId) => {
      const other = fieldById.get(otherId);
      if (
        !other ||
        !isEnabledValue(field.normalizedValue) ||
        !isEnabledValue(other.normalizedValue)
      ) {
        return [];
      }
      const fieldIds = [field.id, other.id].sort();
      const key = fieldIds.join(":");
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          fieldIds,
          reason: `${fieldIds[0]} and ${fieldIds[1]} are both enabled but are configured as conflicting settings.`
        }
      ];
    })
  );
}

function normalizeFieldValue(value: unknown, type: AdminAIFormField["type"]) {
  const text = cleanControlCharacters(value, 2_000).trim();
  if (type === "copy" || type === "text" || type === "setting") {
    return text.replace(/\s+/g, " ");
  }
  if (type === "email") return text.toLowerCase();
  if (type === "tel") return text.replace(/[^+\d]/g, "");
  return text;
}

function findUnsafeClaimTerms(value: string) {
  const unsafeTerms = ["cure", "guaranteed", "diagnose", "diagnosis", "treatment"];
  return unsafeTerms.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(value));
}

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isEnabledValue(value: string) {
  return Boolean(value) && !/^(?:0|false|no|off|disabled|inactive)$/i.test(value);
}

function normalizeRisk(value: AdminAIFormRisk | undefined): AdminAIFormRisk {
  return value === "high" || value === "medium" ? value : "low";
}

function cleanIdentifier(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength)
    : "";
}

function cleanControlCharacters(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, maxLength)
    : "";
}

function normalizeText(value: unknown, maxLength: number) {
  return cleanControlCharacters(value, maxLength).replace(/\s+/g, " ").trim();
}
