export type AiModelConfigEnv = {
  AI_ANALYTICS_MODEL?: string;
  AI_COPY_MODEL?: string;
  AI_ENABLE_CACHING?: string;
  AI_EXTRACT_MODEL?: string;
  AI_MAX_INPUT_TOKENS?: string;
  AI_MAX_OUTPUT_TOKENS?: string;
  OPENAI_MODEL?: string;
};

export type AiModelConfig = {
  analyticsModel: string;
  cachingEnabled: boolean;
  copyModel: string;
  extractModel: string;
  maxInputTokens: number;
  maxOutputTokens: number;
};

export function getAiModelConfig(env: AiModelConfigEnv): AiModelConfig {
  return {
    analyticsModel: cleanModelName(env.AI_ANALYTICS_MODEL, "gpt-5-nano"),
    cachingEnabled: env.AI_ENABLE_CACHING !== "false",
    copyModel: cleanModelName(env.AI_COPY_MODEL || env.OPENAI_MODEL, "gpt-5-mini"),
    extractModel: cleanModelName(env.AI_EXTRACT_MODEL, "gpt-5-nano"),
    maxInputTokens: parsePositiveInt(env.AI_MAX_INPUT_TOKENS, 8_000),
    maxOutputTokens: parsePositiveInt(env.AI_MAX_OUTPUT_TOKENS, 1_200)
  };
}

function cleanModelName(value: string | undefined, fallback: string) {
  const model = value?.trim();
  return model || fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
