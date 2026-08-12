import type { SourceRange } from "../ast/source-range.js";
import type { DiagnosticCode } from "./diagnostic-codes.js";

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly source: SourceRange;
}

export function createError(code: DiagnosticCode, message: string, source: SourceRange): Diagnostic {
  return { severity: "error", code, message, source };
}
