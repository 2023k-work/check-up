import {
  updateCupCell,
  type CupCellEdit,
  type CupDocument,
  type CupMutationResult,
} from "@checkup/parser";

/** Applies Preview edits through the parser-owned mutator boundary. */
export function applyPreviewEdits(
  source: string,
  document: CupDocument,
  edits: readonly CupCellEdit[],
): CupMutationResult {
  let result: CupMutationResult = {
    source,
    document,
    diagnostics: [],
    success: true,
  };

  for (const edit of edits) {
    result = updateCupCell(result.source, result.document, edit);
    if (!result.success) {
      break;
    }
  }
  return result;
}
