export type PaidFunnelPageAnalysis = {
  cleanText: string;
  coachName?: string;
  faqHints: string[];
  headings: string[];
  keyPoints: string[];
  missingFields: string[];
  niche?: string;
  sourceUrl: string;
  title?: string;
};

export type PaidFunnelPageAnalysisResult =
  | {
      analysis: PaidFunnelPageAnalysis;
      ok: true;
    }
  | {
      message: "Could not analyze existing funnel page.";
      ok: false;
    };

const MAX_HTML_BYTES = 550_000;
const MAX_CLEAN_TEXT_LENGTH = 7_000;
const MAX_HEADING_COUNT = 12;
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export async function analyzePaidFunnelPage(
  urlValue: string
): Promise<PaidFunnelPageAnalysisResult> {
  const url = normalizeAnalyzableUrl(urlValue);
  if (!url) return failedAnalysis();

  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        "user-agent": "YWCoachAdminAnalyzer/1.0"
      },
      redirect: "follow"
    });

    if (!response.ok) return failedAnalysis();

    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
      return failedAnalysis();
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const title = extractTitle(html);
    const headings = extractHeadings(html);
    const cleanText = cleanVisibleHtmlText(html);
    if (!cleanText) return failedAnalysis();

    const analysis: PaidFunnelPageAnalysis = {
      cleanText: cleanText.slice(0, MAX_CLEAN_TEXT_LENGTH),
      coachName: extractCoachName(title, headings, cleanText),
      faqHints: extractFaqHints(cleanText),
      headings,
      keyPoints: extractKeyPoints(cleanText),
      missingFields: [],
      niche: extractNiche(title, headings, cleanText),
      sourceUrl: url.toString(),
      title
    };
    analysis.missingFields = getMissingFields(analysis);

    return {
      analysis,
      ok: true
    };
  } catch {
    return failedAnalysis();
  }
}

export function createPaidFunnelAiContext(analysis?: PaidFunnelPageAnalysis | null) {
  if (!analysis) return "";

  return [
    `Existing paid funnel page URL: ${analysis.sourceUrl}`,
    analysis.title ? `Page title: ${analysis.title}` : "",
    analysis.coachName ? `Coach name found: ${analysis.coachName}` : "",
    analysis.niche ? `Niche/positioning found: ${analysis.niche}` : "",
    analysis.headings.length ? `Visible headings: ${analysis.headings.join(" | ")}` : "",
    analysis.keyPoints.length ? `Key visible points: ${analysis.keyPoints.join(" | ")}` : "",
    analysis.faqHints.length ? `FAQ/context hints: ${analysis.faqHints.join(" | ")}` : "",
    `Clean visible page text: ${analysis.cleanText}`
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeAnalyzableUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (/^(10|127|169\.254|172\.(1[6-9]|2\d|3[0-1])|192\.168)\./.test(url.hostname)) {
      return null;
    }

    url.username = "";
    url.password = "";
    return url;
  } catch {
    return null;
  }
}

function cleanVisibleHtmlText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
      .replace(/<form[\s\S]*?<\/form>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim().slice(0, 180) : "";
}

function extractHeadings(html: string) {
  const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi))
    .map((match) => cleanVisibleHtmlText(match[1]).slice(0, 180))
    .filter(Boolean);

  return Array.from(new Set(headings)).slice(0, MAX_HEADING_COUNT);
}

function extractCoachName(title: string | undefined, headings: string[], text: string) {
  const source = [title, ...headings].filter(Boolean).join(" ");
  const coachMatch =
    source.match(/\b(?:Coach|Dr\.?|Expert|Mentor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/) ||
    text.match(/\b(?:with|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/);

  return coachMatch?.[1]?.trim().slice(0, 120);
}

function extractNiche(title: string | undefined, headings: string[], text: string) {
  const combined = [title, ...headings, text.slice(0, 1200)].filter(Boolean).join(" ");
  const nicheWords = [
    "PCOS",
    "hormone",
    "women",
    "weight",
    "diabetes",
    "nutrition",
    "genetic",
    "fertility",
    "thyroid",
    "wellness",
    "fitness"
  ];
  const matches = nicheWords.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(combined));
  return matches.length ? Array.from(new Set(matches)).slice(0, 4).join(" / ") : undefined;
}

function extractKeyPoints(text: string) {
  const sentences = splitSentences(text).filter((sentence) =>
    /benefit|learn|understand|support|join|program|session|masterclass|result|problem|solution|clarity|coach|health|wellness/i.test(
      sentence
    )
  );

  return sentences.slice(0, 8).map((sentence) => sentence.slice(0, 220));
}

function extractFaqHints(text: string) {
  return splitSentences(text)
    .filter((sentence) =>
      /who is|what if|how|when|can i|faq|question|after|register/i.test(sentence)
    )
    .slice(0, 5)
    .map((sentence) => sentence.slice(0, 220));
}

function getMissingFields(analysis: PaidFunnelPageAnalysis) {
  const missing: string[] = [];
  if (!analysis.coachName) missing.push("coach name");
  if (!analysis.niche) missing.push("coach niche");
  if (!analysis.keyPoints.length) missing.push("key benefits");
  if (!analysis.cleanText) missing.push("visible page text");
  return missing;
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 35);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function failedAnalysis(): PaidFunnelPageAnalysisResult {
  return {
    message: "Could not analyze existing funnel page.",
    ok: false
  };
}
