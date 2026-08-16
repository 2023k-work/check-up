import {
  parseCup,
  type CupDocument,
  type FieldType,
  type ParseResult,
  type TableNode,
} from "@checkup/parser";

const editableFieldTypes = [
  "date", "month", "day", "time", "check", "text", "number", "photo", "signature",
] as const satisfies readonly FieldType[];

export type EditableFieldType = (typeof editableFieldTypes)[number];

export type SchemaMutation =
  | { readonly kind: "add"; readonly fieldType: EditableFieldType; readonly label: string }
  | { readonly kind: "delete"; readonly fieldId: string }
  | { readonly kind: "move"; readonly fieldId: string; readonly direction: -1 | 1 }
  | {
      readonly kind: "update";
      readonly fieldId: string;
      readonly fieldType: EditableFieldType;
      readonly label: string;
    };

export interface SourceMutationResult extends ParseResult {
  readonly source: string;
}

/** Rewrites only one recognized table, preserving every source construct outside its range. */
export function mutateTableSchema(
  source: string,
  document: CupDocument,
  tableId: string,
  mutation: SchemaMutation,
): SourceMutationResult {
  const table = findTable(document, tableId);
  const columns = table.columns.map((column) => {
    if (column.field === null || column.field.fieldType === "unknown") {
      throw new Error("Design mode cannot rewrite a table with invalid or unsupported columns.");
    }
    return {
      id: column.id,
      fieldType: column.field.fieldType as EditableFieldType,
      label: column.field.label ?? column.field.typeName,
    };
  });
  const rows = table.rows.map((row) => row.cells.map((cell) => cell.value));

  if (mutation.kind === "add") {
    columns.push({ id: `${table.id}-field-new`, fieldType: mutation.fieldType, label: mutation.label });
    for (const row of rows) row.push("");
  } else {
    const index = columns.findIndex((column) => column.id === mutation.fieldId);
    if (index < 0) throw new Error(`Unknown field: ${mutation.fieldId}`);
    if (mutation.kind === "delete") {
      if (columns.length === 1) throw new Error("A table must keep at least one column.");
      columns.splice(index, 1);
      for (const row of rows) row.splice(index, 1);
    } else if (mutation.kind === "move") {
      const target = index + mutation.direction;
      if (target < 0 || target >= columns.length) return unchanged(source);
      [columns[index], columns[target]] = [columns[target]!, columns[index]!];
      for (const row of rows) [row[index], row[target]] = [row[target]!, row[index]!];
    } else {
      columns[index] = { ...columns[index]!, fieldType: mutation.fieldType, label: mutation.label };
    }
  }

  const replacement = [
    `| ${columns.map((column) => `$${column.fieldType}(${escapeArgument(column.label)})`).join(" | ")}`,
    ...rows.map((row) => `| ${row.map(escapeValue).join(" | ")}`),
  ].join(detectEol(source));
  return replaceAndParse(source, table.source.start.offset, table.source.end.offset, replacement);
}

export function setTableHelp(
  source: string,
  document: CupDocument,
  tableId: string,
  helpText: string,
): SourceMutationResult {
  const table = findTable(document, tableId);
  const directive = table.help?.source;
  const trimmed = helpText.trim();
  if (directive !== undefined) {
    if (trimmed === "") {
      const range = wholeLineRange(source, directive.source.start.offset, directive.source.end.offset);
      return replaceAndParse(source, range.start, range.end, "");
    }
    return replaceAndParse(
      source,
      directive.source.start.offset,
      directive.source.end.offset,
      `@help(${escapeArgument(trimmed)})`,
    );
  }
  if (trimmed === "") return unchanged(source);
  const eol = detectEol(source);
  return replaceAndParse(source, table.source.start.offset, table.source.start.offset, `@help(${escapeArgument(trimmed)})${eol}`);
}

export function setTableRepeat(
  source: string,
  document: CupDocument,
  tableId: string,
  enabled: boolean,
): SourceMutationResult {
  const table = findTable(document, tableId);
  const directive = table.repeat?.source;
  if (enabled && directive === undefined) {
    if (!document.fields.some((field) => field.fieldType === "month")) {
      throw new Error("@repeat(month) requires a $month field in the document.");
    }
    const eol = detectEol(source);
    return replaceAndParse(source, table.source.start.offset, table.source.start.offset, `@repeat(month)${eol}`);
  }
  if (!enabled && directive !== undefined) {
    const range = wholeLineRange(source, directive.source.start.offset, directive.source.end.offset);
    return replaceAndParse(source, range.start, range.end, "");
  }
  return unchanged(source);
}

function findTable(document: CupDocument, tableId: string): TableNode {
  const table = document.nodes.find((node): node is TableNode => node.kind === "table" && node.id === tableId);
  if (table === undefined) throw new Error(`Unknown table: ${tableId}`);
  return table;
}

function replaceAndParse(source: string, start: number, end: number, replacement: string): SourceMutationResult {
  const updated = source.slice(0, start) + replacement + source.slice(end);
  const parsed = parseCup(updated);
  return { source: updated, ...parsed };
}

function unchanged(source: string): SourceMutationResult {
  const parsed = parseCup(source);
  return { source, ...parsed };
}

function wholeLineRange(source: string, start: number, end: number): { start: number; end: number } {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const nextLf = source.indexOf("\n", end);
  return { start: lineStart, end: nextLf < 0 ? source.length : nextLf + 1 };
}

function detectEol(source: string): string {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function escapeArgument(value: string): string {
  return value.replace(/[\\@(),|]/gu, (character) => `\\${character}`);
}

function escapeValue(value: string): string {
  return value.replace(/[\\@(),|]/gu, (character) => `\\${character}`);
}
