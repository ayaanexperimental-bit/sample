export type AdminAIFeatureFlags = {
  actions: boolean;
  copilot: boolean;
  globalMode: boolean;
  incidentMode: boolean;
  memory: boolean;
  proactiveAlerts: boolean;
  scheduledBriefings: boolean;
  sensitiveActions: boolean;
  voice: boolean;
};

type AdminAIFeatureFlagInput = Partial<Record<keyof AdminAIFeatureFlags, boolean | string | undefined>>;

export function getAdminAIFeatureFlags(overrides: AdminAIFeatureFlagInput = {}): AdminAIFeatureFlags {
  const env: AdminAIFeatureFlagInput = {
    actions: process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_ACTIONS || process.env.ENABLE_ADMIN_AI_ACTIONS,
    copilot: process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_COPILOT || process.env.ENABLE_ADMIN_AI_COPILOT,
    globalMode:
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_GLOBAL_MODE || process.env.ENABLE_ADMIN_AI_GLOBAL_MODE,
    incidentMode:
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_INCIDENT_MODE || process.env.ENABLE_ADMIN_AI_INCIDENT_MODE,
    memory: process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_MEMORY || process.env.ENABLE_ADMIN_AI_MEMORY,
    proactiveAlerts:
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_PROACTIVE_ALERTS ||
      process.env.ENABLE_ADMIN_AI_PROACTIVE_ALERTS,
    scheduledBriefings:
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_SCHEDULED_BRIEFINGS ||
      process.env.ENABLE_ADMIN_AI_SCHEDULED_BRIEFINGS,
    sensitiveActions:
      process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_SENSITIVE_ACTIONS ||
      process.env.ENABLE_ADMIN_AI_SENSITIVE_ACTIONS,
    voice: process.env.NEXT_PUBLIC_ENABLE_ADMIN_AI_VOICE || process.env.ENABLE_ADMIN_AI_VOICE,
  };

  return {
    actions: readFlag(overrides.actions ?? env.actions, false),
    copilot: readFlag(overrides.copilot ?? env.copilot, true),
    globalMode: readFlag(overrides.globalMode ?? env.globalMode, true),
    incidentMode: readFlag(overrides.incidentMode ?? env.incidentMode, false),
    memory: readFlag(overrides.memory ?? env.memory, true),
    proactiveAlerts: readFlag(overrides.proactiveAlerts ?? env.proactiveAlerts, true),
    scheduledBriefings: readFlag(overrides.scheduledBriefings ?? env.scheduledBriefings, false),
    sensitiveActions: readFlag(overrides.sensitiveActions ?? env.sensitiveActions, false),
    voice: readFlag(overrides.voice ?? env.voice, false),
  };
}

export function scopeAdminAIExperimentalFlags(
  flags: AdminAIFeatureFlags,
  isOwner: boolean
): AdminAIFeatureFlags {
  return isOwner
    ? flags
    : { ...flags, incidentMode: false, scheduledBriefings: false, voice: false };
}

function readFlag(value: boolean | string | undefined, fallback: boolean) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "on", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}
