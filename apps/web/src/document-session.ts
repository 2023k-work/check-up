import { parseCup, updateCupCell, type CupCellEdit, type ParseResult } from "@checkup/parser";
import {
  mutateTableSchema,
  setTableHelp,
  setTableRepeat,
  type SchemaMutation,
  type SourceMutationResult,
} from "./schema-mutator.js";

export type EditorMode = "design" | "fill" | "source";
export type ModePermissions = Readonly<Record<EditorMode, boolean>>;

export interface DocumentSnapshot extends ParseResult {
  readonly source: string;
  readonly mode: EditorMode;
}

export class DocumentSession {
  readonly permissions: ModePermissions;
  #source: string;
  #parsed: ParseResult;
  #mode: EditorMode;

  constructor(source: string, permissions: Partial<ModePermissions> = {}) {
    this.permissions = { design: true, fill: true, source: true, ...permissions };
    this.#source = source;
    this.#parsed = parseCup(source);
    this.#mode = this.permissions.fill ? "fill" : this.firstAllowedMode();
  }

  get snapshot(): DocumentSnapshot {
    return { source: this.#source, mode: this.#mode, ...this.#parsed };
  }

  setMode(mode: EditorMode): DocumentSnapshot {
    if (!this.permissions[mode]) throw new Error(`Mode '${mode}' is not permitted.`);
    this.#mode = mode;
    return this.snapshot;
  }

  setSource(source: string): DocumentSnapshot {
    this.#source = source;
    this.#parsed = parseCup(source);
    return this.snapshot;
  }

  editCell(edit: CupCellEdit): DocumentSnapshot {
    this.requireValidDocument();
    const result = updateCupCell(this.#source, this.#parsed.document, edit);
    return this.accept(result);
  }

  mutateSchema(tableId: string, mutation: SchemaMutation): DocumentSnapshot {
    this.requireValidDocument();
    return this.accept(mutateTableSchema(this.#source, this.#parsed.document, tableId, mutation));
  }

  setHelp(tableId: string, helpText: string): DocumentSnapshot {
    this.requireValidDocument();
    return this.accept(setTableHelp(this.#source, this.#parsed.document, tableId, helpText));
  }

  setRepeat(tableId: string, enabled: boolean): DocumentSnapshot {
    this.requireValidDocument();
    return this.accept(setTableRepeat(this.#source, this.#parsed.document, tableId, enabled));
  }

  private accept(result: SourceMutationResult): DocumentSnapshot {
    this.#source = result.source;
    this.#parsed = result;
    return this.snapshot;
  }

  private requireValidDocument(): void {
    if (!this.#parsed.success) throw new Error("Fix source diagnostics before using GUI mutations.");
  }

  private firstAllowedMode(): EditorMode {
    const mode = (["design", "source"] as const).find((candidate) => this.permissions[candidate]);
    if (mode === undefined) throw new Error("At least one editor mode must be permitted.");
    return mode;
  }
}
