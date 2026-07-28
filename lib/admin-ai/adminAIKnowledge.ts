import type { AdminAIDurableArtifact } from "./adminAIDurableClient";

export const ADMIN_AI_KNOWLEDGE_CATEGORIES = [
  "admin-documentation",
  "platform-rules",
  "website-builder-rules",
  "payment-publish-rules",
  "bonus-service-rules",
  "faq-rules",
  "otp-destructive-action-rules",
  "settings-descriptions",
  "known-error-resolutions",
  "operational-runbooks",
  "prior-approved-reports",
  "product-documentation"
] as const;

export type AdminAIKnowledgeCategory = (typeof ADMIN_AI_KNOWLEDGE_CATEGORIES)[number];

export const ADMIN_AI_APPROVED_REPORT_ARTIFACT_SOURCE_ID = "approved-report-artifacts";

export type AdminAIKnowledgeSourceContext = {
  module: string;
  referenceIds: string[];
  requestId: string | null;
  scope: "global" | "record" | "section" | "selection";
};

export type AdminAIKnowledgeDocument = {
  approved: boolean;
  artifactId?: string;
  category: AdminAIKnowledgeCategory;
  content: string;
  effectiveAt: string;
  expiresAt?: string;
  id: string;
  ownerOnly?: boolean;
  requiredPermissions?: string[];
  section: string;
  source: string;
  sourceContext?: AdminAIKnowledgeSourceContext;
  sourceId?: string;
  title: string;
  version: string;
};

export type AdminAIKnowledgeCitation = {
  artifactId?: string;
  documentId: string;
  effectiveAt: string;
  section: string;
  source: string;
  sourceContext?: AdminAIKnowledgeSourceContext;
  sourceId: string;
  version: string;
};

type AdminAIKnowledgeChunk = {
  category: AdminAIKnowledgeCategory;
  citation: AdminAIKnowledgeCitation;
  content: string;
  id: string;
  ownerOnly: boolean;
  requiredPermissions: string[];
  searchableText: string;
  stale: boolean;
  title: string;
};

export type AdminAIKnowledgeIndex = {
  chunks: AdminAIKnowledgeChunk[];
  rejected: Array<{
    documentId: string;
    reason: "invalid-document" | "sensitive-content" | "unapproved-source";
  }>;
};

export type AdminAIKnowledgeMatch = {
  category: AdminAIKnowledgeCategory;
  citation: AdminAIKnowledgeCitation;
  content: string;
  stale: boolean;
  title: string;
  usableAsCurrent: boolean;
};

export type AdminAIApprovedKnowledgeSource = {
  id: string;
  label?: string;
  type?: "internal" | "public-url";
  url?: string;
};

const SENSITIVE_CONTENT = [
  /\b(?:account[_ -]?key|api[_ -]?key|aws[_ -]?secret[_ -]?access[_ -]?key|client[_ -]?secret|password|private[_ -]?key|secret|session[_ -]?token|token|otp)\s*[:=]\s*["']?[a-z0-9_./+=-]{4,}/i,
  /\bbearer\s+[a-z0-9._~+/=-]{8,}/i,
  /\b(?:cookie|set-cookie)\s*:\s*[^\s;]{8,}/i,
  /-----BEGIN (?:DSA |EC |OPENSSH |PGP |RSA )?PRIVATE KEY-----/i,
  /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/i,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bAIza[a-z0-9_-]{30,40}\b/i,
  /\b(?:gh[pousr]_[a-z0-9]{30,}|github_pat_[a-z0-9_]{30,}|sk-(?:proj-)?[a-z0-9_-]{20,}|sk_(?:live|test)_[a-z0-9]{16,}|xox[baprs]-[a-z0-9-]{20,})\b/i
];

export function buildAdminAIApprovedReportKnowledgeDocuments(
  artifacts: readonly AdminAIDurableArtifact[]
): AdminAIKnowledgeDocument[] {
  const seen = new Set<string>();
  const documents: AdminAIKnowledgeDocument[] = [];

  for (const artifact of artifacts.slice(0, 100)) {
    if (
      !artifact ||
      artifact.deletedAt ||
      !["approved", "saved"].includes(artifact.approval?.status)
    ) {
      continue;
    }
    const artifactId = clean(artifact.id, 120);
    const sourceContext = normalizeKnowledgeSourceContext(artifact.sourceContext);
    const version = Number(artifact.version);
    if (!artifactId || !sourceContext || !Number.isInteger(version) || version < 1) continue;
    const key = `${artifactId}:${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    documents.push({
      approved: true,
      artifactId,
      category: "prior-approved-reports",
      content: artifact.content,
      effectiveAt: artifact.updatedAt,
      id: `approved-report-artifact:${artifactId}`,
      requiredPermissions: [],
      section: sourceContext.module,
      source: `/api/admin/ai-artifacts?id=${encodeURIComponent(artifactId)}`,
      sourceContext,
      sourceId: ADMIN_AI_APPROVED_REPORT_ARTIFACT_SOURCE_ID,
      title: artifact.title,
      version: String(version)
    });
  }

  return documents;
}

export function indexAdminAIApprovedReportArtifacts(
  artifacts: readonly AdminAIDurableArtifact[],
  options: {
    approvedSources?: readonly AdminAIApprovedKnowledgeSource[];
    now?: string;
  } = {}
) {
  return indexAdminAIKnowledge(buildAdminAIApprovedReportKnowledgeDocuments(artifacts), {
    approvedSources: options.approvedSources ?? [],
    now: options.now
  });
}

export function mergeAdminAIKnowledgeIndexes(
  ...indexes: Array<AdminAIKnowledgeIndex | null | undefined>
): AdminAIKnowledgeIndex {
  const chunks = new Map<string, AdminAIKnowledgeChunk>();
  const rejected = new Map<string, AdminAIKnowledgeIndex["rejected"][number]>();
  for (const index of indexes) {
    for (const chunk of index?.chunks ?? []) chunks.set(chunk.id, chunk);
    for (const item of index?.rejected ?? []) {
      rejected.set(`${item.documentId}:${item.reason}`, item);
    }
  }
  return { chunks: Array.from(chunks.values()), rejected: Array.from(rejected.values()) };
}

export function indexAdminAIKnowledge(
  documents: readonly AdminAIKnowledgeDocument[],
  options: {
    approvedSources?: readonly AdminAIApprovedKnowledgeSource[];
    now?: string;
  } = {}
): AdminAIKnowledgeIndex {
  const now = timestamp(options.now) ?? new Date().getTime();
  const approvedSourceIds = options.approvedSources
    ? new Set(options.approvedSources.map(({ id }) => clean(id, 80)).filter(Boolean))
    : null;
  const accepted: AdminAIKnowledgeDocument[] = [];
  const rejected: AdminAIKnowledgeIndex["rejected"] = [];

  for (const document of documents.slice(0, 500)) {
    if (!validDocument(document)) {
      rejected.push({
        documentId: clean(document?.id, 120) || "unknown",
        reason: "invalid-document"
      });
      continue;
    }
    if (approvedSourceIds && !approvedSourceIds.has(clean(document.sourceId || document.id, 80))) {
      rejected.push({ documentId: document.id, reason: "unapproved-source" });
      continue;
    }
    if (containsSensitiveContent(document.content)) {
      rejected.push({ documentId: document.id, reason: "sensitive-content" });
      continue;
    }
    accepted.push(document);
  }

  const newestById = new Map<string, number>();
  for (const document of accepted) {
    const effectiveAt = timestamp(document.effectiveAt)!;
    newestById.set(document.id, Math.max(newestById.get(document.id) ?? 0, effectiveAt));
  }

  const chunks = accepted.flatMap((document) => {
    const effectiveAt = timestamp(document.effectiveAt)!;
    const expiresAt = timestamp(document.expiresAt);
    const stale =
      effectiveAt < newestById.get(document.id)! || (expiresAt !== null && expiresAt <= now);
    return chunk(document.content).map((content, index) => ({
      category: document.category,
      citation: {
        ...(document.artifactId ? { artifactId: clean(document.artifactId, 120) } : {}),
        documentId: document.id,
        effectiveAt: new Date(effectiveAt).toISOString(),
        section: document.section,
        source: document.source,
        ...(document.sourceContext
          ? { sourceContext: normalizeKnowledgeSourceContext(document.sourceContext)! }
          : {}),
        sourceId: clean(document.sourceId || document.id, 80),
        version: document.version
      },
      content,
      id: `${document.id}:${document.version}:${index + 1}`,
      ownerOnly: Boolean(document.ownerOnly),
      requiredPermissions: unique(document.requiredPermissions ?? [], 40),
      searchableText: clean(
        `${document.category} ${document.title} ${document.section} ${document.sourceId || document.id} ${document.source} ${content}`,
        12_000
      ).toLowerCase(),
      stale,
      title: document.title
    }));
  });

  return { chunks, rejected };
}

export function retrieveAdminAIKnowledge(
  index: AdminAIKnowledgeIndex,
  input: {
    includeStale?: boolean;
    isOwner: boolean;
    limit?: number;
    permissions: readonly string[];
    query: string;
  }
): { matches: AdminAIKnowledgeMatch[]; staleMatches: AdminAIKnowledgeMatch[] } {
  const terms = tokens(input.query);
  if (!terms.length) return { matches: [], staleMatches: [] };

  const permissions = new Set(input.permissions);
  const limit = Math.max(1, Math.min(10, Math.trunc(input.limit ?? 5)));
  const visible = index.chunks.filter(
    (item) =>
      (input.isOwner || !item.ownerOnly) &&
      (input.isOwner || item.requiredPermissions.every((permission) => permissions.has(permission)))
  );
  const candidates = visible.map((item) => ({
    item,
    words: new Set(words(item.searchableText, 2_000))
  }));
  const frequency = new Map(
    terms.map((term) => [term, candidates.filter(({ words }) => words.has(term)).length])
  );
  const rareThreshold = Math.max(1, Math.floor(candidates.length / 3));
  const minimumMatches = Math.min(2, terms.length);
  const scored = candidates
    .map(({ item, words }) => {
      const matchedTerms = terms.filter((term) => words.has(term));
      return {
        item,
        matchedTerms,
        score: matchedTerms.reduce(
          (total, term) =>
            total + Math.log((candidates.length + 1) / ((frequency.get(term) || 0) + 1)) + 1,
          0
        )
      };
    })
    .filter(
      ({ matchedTerms }) =>
        matchedTerms.length >= minimumMatches ||
        matchedTerms.some((term) => (frequency.get(term) || 0) <= rareThreshold)
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        Date.parse(right.item.citation.effectiveAt) - Date.parse(left.item.citation.effectiveAt) ||
        left.item.id.localeCompare(right.item.id)
    );
  const bestScore = scored[0]?.score || 0;
  const ranked = scored.filter(({ score }) => score >= bestScore * 0.5);

  return {
    matches: ranked
      .filter(({ item }) => !item.stale)
      .slice(0, limit)
      .map(({ item }) => match(item)),
    staleMatches: input.includeStale
      ? ranked
          .filter(({ item }) => item.stale)
          .slice(0, limit)
          .map(({ item }) => match(item))
      : []
  };
}

export function scopeAdminAIKnowledgeIndexByApprovedSources(
  index: AdminAIKnowledgeIndex,
  approvedSources: readonly AdminAIApprovedKnowledgeSource[]
): AdminAIKnowledgeIndex {
  const approved = new Set(approvedSources.map(({ id }) => clean(id, 80)).filter(Boolean));
  return {
    ...index,
    chunks: index.chunks.filter(({ citation }) => approved.has(citation.sourceId))
  };
}

export function isAdminAIKnowledgeSourceApproved(
  sourceId: string,
  approvedSources: readonly AdminAIApprovedKnowledgeSource[]
) {
  const normalized = clean(sourceId, 80);
  return Boolean(normalized && approvedSources.some(({ id }) => clean(id, 80) === normalized));
}

function match(chunk: AdminAIKnowledgeChunk): AdminAIKnowledgeMatch {
  return {
    category: chunk.category,
    citation: chunk.citation,
    content: chunk.content,
    stale: chunk.stale,
    title: chunk.title,
    usableAsCurrent: !chunk.stale
  };
}

function validDocument(document: AdminAIKnowledgeDocument) {
  return Boolean(
    document?.approved &&
    ADMIN_AI_KNOWLEDGE_CATEGORIES.includes(document.category) &&
    clean(document.id, 120) &&
    clean(document.title, 240) &&
    clean(document.section, 240) &&
    clean(document.source, 500) &&
    (!document.artifactId || clean(document.artifactId, 120)) &&
    (!document.sourceContext || normalizeKnowledgeSourceContext(document.sourceContext)) &&
    (!document.sourceId || clean(document.sourceId, 80)) &&
    clean(document.version, 80) &&
    clean(document.content, 50_000) &&
    timestamp(document.effectiveAt) !== null &&
    (!document.expiresAt || timestamp(document.expiresAt) !== null)
  );
}

function normalizeKnowledgeSourceContext(value: unknown): AdminAIKnowledgeSourceContext | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AdminAIKnowledgeSourceContext>;
  const moduleId = clean(candidate.module, 120);
  const requestId = candidate.requestId === null ? null : clean(candidate.requestId, 120);
  const scope = candidate.scope;
  if (
    !moduleId ||
    (candidate.requestId !== null && !requestId) ||
    !["global", "record", "section", "selection"].includes(scope || "") ||
    !Array.isArray(candidate.referenceIds)
  ) {
    return null;
  }
  return {
    module: moduleId,
    referenceIds: unique(candidate.referenceIds, 40),
    requestId,
    scope: scope as AdminAIKnowledgeSourceContext["scope"]
  };
}

function chunk(value: string) {
  const normalized = clean(value, 50_000);
  const chunks: string[] = [];
  for (let start = 0; start < normalized.length && chunks.length < 40; start += 1_200) {
    chunks.push(normalized.slice(start, start + 1_200));
  }
  return chunks;
}

function tokens(value: string) {
  return words(clean(value, 500), 20);
}

function words(value: string, limit: number) {
  const stop = new Set(["a", "and", "for", "from", "in", "is", "of", "on", "the", "to", "with"]);
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 1 && !stop.has(term))
    )
  ).slice(0, limit);
}

function containsSensitiveContent(value: string) {
  return (
    SENSITIVE_CONTENT.some((pattern) => pattern.test(value)) || hasHighEntropyCredential(value)
  );
}

function hasHighEntropyCredential(value: string) {
  const candidates = value.match(/[a-z0-9_+/=-]{32,256}/gi) || [];
  return candidates.some((candidate) => {
    const token = candidate.replace(/=+$/, "");
    if (/^[a-f0-9]{32,128}$/i.test(token)) return false;
    if (!/[a-z]/.test(token) || !/[A-Z]/.test(token) || !/\d/.test(token)) return false;
    const counts = new Map<string, number>();
    for (const character of token) counts.set(character, (counts.get(character) || 0) + 1);
    const entropy = Array.from(counts.values()).reduce((total, count) => {
      const probability = count / token.length;
      return total - probability * Math.log2(probability);
    }, 0);
    return entropy >= 4.5;
  });
}

function unique(values: readonly string[], limit: number) {
  return Array.from(new Set(values.map((value) => clean(value, 160)).filter(Boolean))).slice(
    0,
    limit
  );
}

function clean(value: unknown, limit: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit)
    : "";
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
