export type AdminAIPreferences = {
  dailyBriefing: boolean;
  enabled: boolean;
  includeActionItems: boolean;
  memoryEnabled: boolean;
  preferredLanguage: "en" | "hi";
  proactiveSuggestions: boolean;
  reportFormat: "operations" | "summary";
  reportStyle: "concise" | "detailed";
  responseLength: "concise" | "detailed";
};

const STORAGE_KEY = "yw-admin-ai-preferences-v1";
export const DEFAULT_ADMIN_AI_PREFERENCES: AdminAIPreferences = {
  dailyBriefing: false,
  enabled: true,
  includeActionItems: true,
  memoryEnabled: true,
  preferredLanguage: "en",
  proactiveSuggestions: true,
  reportFormat: "operations",
  reportStyle: "concise",
  responseLength: "concise",
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
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizeAdminAIPreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}

export function normalizeAdminAIPreferences(value: Partial<AdminAIPreferences>) {
  const responseLength = value.responseLength === "detailed" || value.reportStyle === "detailed"
    ? "detailed"
    : "concise";
  return {
    dailyBriefing: value.dailyBriefing === true,
    enabled: value.enabled !== false,
    includeActionItems: value.includeActionItems !== false,
    memoryEnabled: value.memoryEnabled !== false,
    preferredLanguage: value.preferredLanguage === "hi" ? "hi" : "en",
    proactiveSuggestions: value.proactiveSuggestions !== false,
    reportFormat: value.reportFormat === "summary" ? "summary" : "operations",
    reportStyle: responseLength,
    responseLength,
  } satisfies AdminAIPreferences;
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
