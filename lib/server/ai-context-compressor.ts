export type AiCompressedContext = {
  compactText: string;
  removedCharacters: number;
  sourceCharacters: number;
  truncated: boolean;
};

const FOOTER_NOISE_PATTERNS = [
  /\bprivacy policy\b/i,
  /\brefund policy\b/i,
  /\bterms\b/i,
  /\bdisclaimer\b/i,
  /\bcopyright\b/i,
  /\bfacebook\b/i,
  /\bmeta platforms\b/i
];

export function compressAiContext(value: string, maxTokens = 8_000): AiCompressedContext {
  const sourceCharacters = value.length;
  const safeMaxTokens = Number.isFinite(maxTokens) ? Math.max(1, Math.floor(maxTokens)) : 8_000;
  const maxCharacters = safeMaxTokens * 4;
  const compact = Array.from(
    new Set(
      stripHiddenTechnicalText(value)
        .split(/\n+|(?<=[.!?])\s+/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 12)
        .filter((line) => !FOOTER_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
    )
  )
    .join("\n")
    .trim();
  const compactText = compact.slice(0, maxCharacters).trim();

  return {
    compactText,
    removedCharacters: Math.max(0, sourceCharacters - compactText.length),
    sourceCharacters,
    truncated: compact.length > compactText.length
  };
}

export function stripHiddenTechnicalText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\b(?:token|secret|otp|password|authorization|cookie)\s*[:=]\s*\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
