export const ADMIN_AI_TABLE_CAPABILITIES = [
  "summarize-visible",
  "analyze-selected",
  "find-anomalies",
  "group-related",
  "identify-duplicates",
  "explain-status-differences",
  "propose-bulk-action",
  "generate-selected-report",
  "identify-attention"
] as const;

export type AdminAITableCapability = (typeof ADMIN_AI_TABLE_CAPABILITIES)[number];

export type AdminAITableRow = {
  duplicateKey?: string;
  generationFailure?: string;
  groupKey?: string;
  id: string;
  imageReady?: boolean;
  label: string;
  linkValid?: boolean;
  permissionIssue?: string;
  requiredDataComplete?: boolean;
  status: string;
  unresolvedErrors?: number;
};

export type AdminAITableContext = {
  filters: Record<string, boolean | number | string>;
  rows: AdminAITableRow[];
  selectedIds: string[];
  sort: { direction: "asc" | "desc"; field: string } | null;
  tableId: string;
};

export function runAdminAITableCopilot(
  input: AdminAITableContext,
  capability: AdminAITableCapability
) {
  const rows = input.rows
    .slice(0, 200)
    .map(normalizeRow)
    .filter((row) => row.id);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const selectedIds = uniqueIdentifiers(input.selectedIds)
    .filter((id) => rowById.has(id))
    .slice(0, 40);
  const selectedRows = selectedIds.map((id) => rowById.get(id)!);
  const selectedCapability =
    capability === "analyze-selected" ||
    capability === "generate-selected-report" ||
    capability === "propose-bulk-action";
  const scopedRows = selectedCapability ? selectedRows : rows;
  const attentionRows = scopedRows.filter((row) => getRowReasons(row).length > 0);
  const rowResults = buildRowResults(capability, scopedRows, attentionRows);
  const groups = buildGroups(capability, rows);
  const filters = normalizeFilters(input.filters);
  const sort = input.sort
    ? {
        direction: input.sort.direction === "desc" ? ("desc" as const) : ("asc" as const),
        field: cleanText(input.sort.field, 80)
      }
    : null;
  const tableId = cleanIdentifier(input.tableId, 80);
  const reportDraft =
    capability === "generate-selected-report" && selectedRows.length
      ? buildSelectedReportDraft({ filters, rowResults, selectedIds, sort, tableId })
      : undefined;

  return {
    capability,
    effectiveScope: selectedCapability ? ("selection" as const) : ("visible" as const),
    filters,
    groups,
    plan:
      capability === "propose-bulk-action"
        ? {
            confirmationRequired: true,
            executable: false,
            recordIds: selectedIds,
            safety: "Review only; this table analysis cannot mutate records."
          }
        : undefined,
    rowResults,
    reportDraft,
    selectedCount: selectedIds.length,
    sort,
    summary: buildSummary(capability, rows, selectedRows, attentionRows, groups),
    tableId,
    visibleCount: rows.length
  };
}

function buildSelectedReportDraft({
  filters,
  rowResults,
  selectedIds,
  sort,
  tableId
}: {
  filters: ReturnType<typeof normalizeFilters>;
  rowResults: ReturnType<typeof buildRowResults>;
  selectedIds: string[];
  sort: { direction: "asc" | "desc"; field: string } | null;
  tableId: string;
}) {
  const title = `${formatTableTitle(tableId)} selected-record report`;
  const filterSummary = Object.entries(filters)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
  const content = [
    title,
    `Table: ${tableId}`,
    `Selected records: ${selectedIds.length}`,
    `Filters: ${filterSummary || "none"}`,
    `Sort: ${sort?.field ? `${sort.field} ${sort.direction}` : "none"}`,
    "",
    ...rowResults.map(
      (row) => `- ${row.label} [${row.status}] (${row.id}): ${row.reasons.join(" ")}`
    )
  ].join("\n");

  return {
    content,
    contentType: "text/plain" as const,
    copyReady: true as const,
    recordIds: selectedIds,
    saveReady: true as const,
    sourceContext: {
      filters,
      scope: "selection" as const,
      sort,
      tableId
    },
    title,
    type: "report" as const
  };
}

function formatTableTitle(tableId: string) {
  const title = tableId
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return title || "Selected table";
}

function buildRowResults(
  capability: AdminAITableCapability,
  scopedRows: NormalizedRow[],
  attentionRows: NormalizedRow[]
) {
  const rows =
    capability === "find-anomalies" || capability === "identify-attention"
      ? attentionRows
      : capability === "analyze-selected" ||
          capability === "generate-selected-report" ||
          capability === "propose-bulk-action"
        ? scopedRows
        : [];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    reasons: getRowReasons(row).length
      ? getRowReasons(row)
      : ["No blocking reason is visible in the allowlisted table facts."],
    status: row.status
  }));
}

function buildGroups(capability: AdminAITableCapability, rows: NormalizedRow[]) {
  if (capability === "group-related") return groupRows(rows, (row) => row.groupKey);
  if (capability === "explain-status-differences") return groupRows(rows, (row) => row.status);
  if (capability === "identify-duplicates") {
    return groupRows(rows, (row) => row.duplicateKey).filter((group) => group.recordIds.length > 1);
  }
  return [];
}

function groupRows(rows: NormalizedRow[], getKey: (row: NormalizedRow) => string) {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const recordIds = groups.get(key) || [];
    recordIds.push(row.id);
    groups.set(key, recordIds);
  }
  return Array.from(groups, ([key, recordIds]) => ({ key, recordIds }));
}

function getRowReasons(row: NormalizedRow) {
  return [
    ...(row.requiredDataComplete === false ? ["Required data is incomplete."] : []),
    ...(row.imageReady === false ? ["Required image or media is missing."] : []),
    ...(row.linkValid === false ? ["Registration or contact link is invalid."] : []),
    ...(row.generationFailure ? [row.generationFailure] : []),
    ...(row.permissionIssue ? [row.permissionIssue] : []),
    ...(row.unresolvedErrors > 0
      ? [
          `${row.unresolvedErrors} unresolved error${row.unresolvedErrors === 1 ? " remains" : "s remain"}.`
        ]
      : [])
  ];
}

function buildSummary(
  capability: AdminAITableCapability,
  rows: NormalizedRow[],
  selectedRows: NormalizedRow[],
  attentionRows: NormalizedRow[],
  groups: Array<{ key: string; recordIds: string[] }>
) {
  if (capability === "summarize-visible") {
    return `${rows.length} visible rows; ${attentionRows.length} need attention.`;
  }
  if (capability === "analyze-selected") {
    return `${selectedRows.length} selected rows analyzed from allowlisted facts only.`;
  }
  if (capability === "generate-selected-report") {
    return `Report prepared for ${selectedRows.length} selected rows.`;
  }
  if (capability === "propose-bulk-action") {
    return `Review-only bulk plan prepared for ${selectedRows.length} selected rows.`;
  }
  return `${groups.length || attentionRows.length} result${(groups.length || attentionRows.length) === 1 ? "" : "s"} found.`;
}

type NormalizedRow = ReturnType<typeof normalizeRow>;

function normalizeRow(row: AdminAITableRow) {
  return {
    duplicateKey: cleanText(row.duplicateKey, 120).toLowerCase(),
    generationFailure: cleanText(row.generationFailure, 240),
    groupKey: cleanText(row.groupKey, 120),
    id: cleanIdentifier(row.id, 120),
    imageReady: typeof row.imageReady === "boolean" ? row.imageReady : undefined,
    label: cleanText(row.label, 160),
    linkValid: typeof row.linkValid === "boolean" ? row.linkValid : undefined,
    permissionIssue: cleanText(row.permissionIssue, 240),
    requiredDataComplete:
      typeof row.requiredDataComplete === "boolean" ? row.requiredDataComplete : undefined,
    status: cleanText(row.status, 80),
    unresolvedErrors: Number.isFinite(row.unresolvedErrors)
      ? Math.max(0, Math.min(999, Math.floor(row.unresolvedErrors || 0)))
      : 0
  };
}

function uniqueIdentifiers(values: string[]) {
  return Array.from(new Set(values.map((value) => cleanIdentifier(value, 120)).filter(Boolean)));
}

function normalizeFilters(filters: AdminAITableContext["filters"]) {
  return Object.fromEntries(
    Object.entries(filters)
      .slice(0, 20)
      .map(([key, value]) => [
        cleanIdentifier(key, 80),
        typeof value === "string" ? cleanText(value, 160) : value
      ])
      .filter(([key]) => key)
  );
}

function cleanIdentifier(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength)
    : "";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}
