import {
  reviewAdminAIForm,
  type AdminAIFormField,
  type AdminAIFormRisk
} from "./adminAIFormCopilot";

export type AdminAIBuilderSuggestion<Field extends string = string> = {
  actions: readonly ["apply", "reject"];
  approvalLevel: 1;
  confirmationRequired: true;
  executionAvailability: "not-applicable";
  field: Field;
  original: string;
  proposed: string;
  reason: string;
  risk: AdminAIFormRisk;
  suggestedValue: string;
};

export function buildAdminAIBuilderSuggestions<State extends object>(
  original: State,
  proposed: State,
  reason: string
): Array<AdminAIBuilderSuggestion<Extract<keyof State, string>>> {
  const safeReason =
    reason
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240) || "Generated from the current permission-visible builder context.";

  const fields = (Object.keys(original) as Array<Extract<keyof State, string>>).flatMap(
    (field): AdminAIFormField[] => {
      const value = original[field];
      if (typeof value !== "string") return [];
      return [
        {
          explanation: `Optional AI assistance for ${formatFieldLabel(field)}.`,
          id: field,
          label: formatFieldLabel(field),
          type: getFieldType(field),
          value
        }
      ];
    }
  );
  const proposals = (Object.keys(original) as Array<Extract<keyof State, string>>).flatMap(
    (field) => {
      const originalValue = original[field];
      const proposedValue = proposed[field];
      if (
        typeof originalValue !== "string" ||
        typeof proposedValue !== "string" ||
        originalValue === proposedValue
      ) {
        return [];
      }
      return [
        {
          fieldId: field,
          proposed: proposedValue,
          reason: safeReason,
          risk: getSuggestionRisk(field)
        }
      ];
    }
  );
  const review = reviewAdminAIForm({
    assistanceEnabled: true,
    fields,
    formId: "coach-site-builder",
    proposals
  });

  return review.suggestions
    .map((suggestion) => ({
      actions: suggestion.actions,
      approvalLevel: suggestion.approvalLevel,
      confirmationRequired: suggestion.confirmationRequired,
      executionAvailability: suggestion.executionAvailability,
      field: suggestion.fieldId as Extract<keyof State, string>,
      original: suggestion.original,
      proposed: suggestion.proposed,
      reason: suggestion.reason,
      risk: suggestion.risk,
      suggestedValue: suggestion.suggestedValue
    }))
    .slice(0, 80);
}

export function applyAdminAIBuilderSuggestions<State extends object>(
  current: State,
  suggestions: ReadonlyArray<AdminAIBuilderSuggestion<Extract<keyof State, string>>>
): State {
  const next = { ...current };
  for (const suggestion of suggestions.slice(0, 80)) {
    if (!Object.prototype.hasOwnProperty.call(current, suggestion.field)) continue;
    if (
      typeof current[suggestion.field] !== "string" ||
      current[suggestion.field] !== suggestion.original
    ) {
      continue;
    }
    (next as Record<string, unknown>)[suggestion.field] = suggestion.suggestedValue;
  }
  return next;
}

function getFieldType(field: string): AdminAIFormField["type"] {
  if (/(?:url|link)$/i.test(field)) return "url";
  if (/email/i.test(field)) return "email";
  if (/phone/i.test(field)) return "tel";
  return "copy";
}

function getSuggestionRisk(field: string): AdminAIFormRisk {
  if (/(?:footer|privacy|trust|disclaimer)/i.test(field)) return "high";
  if (/(?:cta|url|link|email|phone|whatsapp)/i.test(field)) return "medium";
  return "low";
}

function formatFieldLabel(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}
