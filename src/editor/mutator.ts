import type { CupDocument } from "../ast/nodes.js";
import type { Diagnostic } from "../diagnostics/diagnostic.js";
import { escapeCupValue } from "../parser/escape.js";
import { parseCup } from "../parser/parser.js";

export interface CupCellEdit {
  readonly tableId: string;
  readonly rowId: string;
  readonly fieldId: string;
  readonly value: string | number | boolean;
}

export interface CupMutationResult {
  readonly source: string;
  readonly document: CupDocument;
  readonly diagnostics: readonly Diagnostic[];
  readonly success: boolean;
}

/** Applies one semantic table-cell edit without parsing or rebuilding .cup syntax in the UI. */
export function updateCupCell(
  source: string,
  document: CupDocument,
  edit: CupCellEdit,
): CupMutationResult {
  const table = document.nodes.find(
    (node) => node.kind === "table" && node.id === edit.tableId,
  );
  if (table === undefined || table.kind !== "table") {
    throw new Error(`Unknown table: ${edit.tableId}`);
  }

  const row = table.rows.find((candidate) => candidate.id === edit.rowId);
  if (row === undefined) {
    throw new Error(`Unknown row: ${edit.rowId}`);
  }

  const cell = row.cells.find((candidate) => candidate.fieldId === edit.fieldId);
  if (cell === undefined) {
    throw new Error(`Unknown field '${edit.fieldId}' in row '${edit.rowId}'.`);
  }

  const serialized = serializeCellValue(edit.value);
  const updatedSource =
    source.slice(0, cell.source.start.offset) + serialized + source.slice(cell.source.end.offset);
  const parsed = parseCup(updatedSource);
  return {
    source: updatedSource,
    document: parsed.document,
    diagnostics: parsed.diagnostics,
    success: parsed.success,
  };
}

function serializeCellValue(value: CupCellEdit["value"]): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("A .cup cell number must be finite.");
    }
    return String(value);
  }

  const text = typeof value === "boolean" ? String(value) : value;
  if (text.includes("\n") || text.includes("\r")) {
    throw new TypeError("A .cup table cell cannot contain a line break.");
  }
  return escapeCupValue(text);
}
