import type { AdminAIScope } from "./adminAITypes";

export const ADMIN_AI_ASK_EVENT = "yw-admin-ai:ask";

export type AdminAIAskEventDetail = {
  query: string;
  selectedEntityIds?: string[];
  scope: AdminAIScope;
};

export function normalizeAdminAISelectedEntityIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120))
    .filter(Boolean)))
    .slice(0, 40);
}

export function dispatchAdminAIAsk(
  query: string,
  scope: AdminAIScope = "page",
  selectedEntityIds: string[] = []
) {
  if (typeof window === "undefined") return false;
  const safeQuery = query
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  if (!safeQuery) return false;
  const safeSelectedEntityIds = normalizeAdminAISelectedEntityIds(selectedEntityIds);
  window.dispatchEvent(
    new CustomEvent<AdminAIAskEventDetail>(ADMIN_AI_ASK_EVENT, {
      detail: {
        query: safeQuery,
        scope,
        ...(safeSelectedEntityIds.length ? { selectedEntityIds: safeSelectedEntityIds } : {}),
      },
    })
  );
  return true;
}
