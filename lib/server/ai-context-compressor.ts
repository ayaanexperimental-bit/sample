export type AiCompressedContext = {
  compactText: string;
  removedCharacters: number;
  sourceCharacters: number;
};

const FOOTER_NOISE_PATTERNS = [
  /\bprivacy policy\b/gi,
  /\brefund policy\b/gi,
  /\bterms\b/gi,
  /\bdisclaimer\b/gi,
  /\bcopyright\b/gi,
  /\bfacebook\b/gi,
  /\bmeta platforms\b/gi
];

export function compressAiContext(value: string, maxTokens = 8_000): AiCompressedContext {
  const sourceCharacters = value.length;
  const maxCharacters = Math.max(1_000, maxTokens * 4);
  const compactText = Array.from(
    new Set(
      stripHiddenTechnicalText(value)
        .split(/\n+|(?<=[.!?])\s+/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 12)
        .filter((line) => !FOOTER_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
    )
  )
    .join("\n")
    .slice(0, maxCharacters)
    .trim();

  return {
    compactText,
    removedCharacters: Math.max(0, sourceCharacters - compactText.length),
    sourceCharacters
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
