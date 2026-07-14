import type { AdminAIScope } from "./adminAITypes";

export const ADMIN_AI_ASK_EVENT = "yw-admin-ai:ask";

export type AdminAIAskEventDetail = {
  query: string;
  scope: AdminAIScope;
};

export function dispatchAdminAIAsk(query: string, scope: AdminAIScope = "page") {
  if (typeof window === "undefined") return false;
  const safeQuery = query
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  if (!safeQuery) return false;
  window.dispatchEvent(
    new CustomEvent<AdminAIAskEventDetail>(ADMIN_AI_ASK_EVENT, {
      detail: { query: safeQuery, scope },
    })
  );
  return true;
}
