import type { AdminAIFeedbackKind } from "./adminAITypes";

export type AdminAIFeedbackRecord = {
  commandId: string;
  kind: AdminAIFeedbackKind;
  sectionId: string;
  timestamp: string;
};

const STORAGE_KEY = "yw-admin-ai-feedback-v1";
const MAX_FEEDBACK_RECORDS = 80;

export function loadAdminAIFeedback(storage: Pick<Storage, "getItem"> | null | undefined) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeFeedback).filter(Boolean).slice(0, MAX_FEEDBACK_RECORDS) as AdminAIFeedbackRecord[];
  } catch {
    return [];
  }
}

export function saveAdminAIFeedback(
  storage: Pick<Storage, "setItem"> | null | undefined,
  records: AdminAIFeedbackRecord[]
) {
  if (!storage) return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(records.map(normalizeFeedback).filter(Boolean).slice(0, MAX_FEEDBACK_RECORDS))
    );
    return true;
  } catch {
    return false;
  }
}

export function clearAdminAIFeedback(storage: Pick<Storage, "removeItem"> | null | undefined) {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function normalizeFeedback(value: unknown): AdminAIFeedbackRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<AdminAIFeedbackRecord>;
  const allowed = new Set<AdminAIFeedbackKind>([
    "helpful",
    "incorrect-data",
    "missing-context",
    "not-helpful",
    "unsafe-suggestion",
  ]);
  if (!item.kind || !allowed.has(item.kind)) return null;
  return {
    commandId: clean(item.commandId, 120),
    kind: item.kind,
    sectionId: clean(item.sectionId, 80),
    timestamp: Number.isFinite(Date.parse(item.timestamp || ""))
      ? new Date(item.timestamp as string).toISOString()
      : new Date().toISOString(),
  };
}

function clean(value: string | undefined, max: number) {
  return String(value || "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, max);
}
