import type { Diagnostic } from "@checkup/parser";

export function isEmptySource(source: string): boolean {
  return source.trim().length === 0;
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const { line, column } = diagnostic.source.start;
  return `Line ${line}, column ${column} · ${diagnostic.code}: ${diagnostic.message}`;
}

export function runtimeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  if (typeof error === "string" && error.trim() !== "") return error;
  return "An unexpected application error occurred.";
}
