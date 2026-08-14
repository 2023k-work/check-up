import type { FieldType } from "@checkup/parser";

export type FieldRenderControl =
  | "date-picker"
  | "month-picker"
  | "day-input"
  | "time-picker"
  | "checkbox"
  | "text-input"
  | "number-input"
  | "photo-capture"
  | "signature-pad"
  | "unsupported";

export type FieldValueKind = "string" | "number" | "boolean" | "asset" | "unknown";

/** Framework-neutral instructions a UI can use to select its field component. */
export interface FieldRenderDescriptor {
  readonly fieldType: FieldType;
  readonly control: FieldRenderControl;
  readonly valueKind: FieldValueKind;
}

export interface RenderHelp {
  readonly text: string;
  readonly imagePath?: string;
}

export type RenderFieldValue = string | number | boolean | null;

export interface RenderField {
  readonly id: string;
  readonly fieldType: FieldType;
  readonly label: string | null;
  /** Parsed documents are templates, so a newly created model has no captured value. */
  readonly value: RenderFieldValue;
  readonly descriptor: FieldRenderDescriptor;
  readonly help?: RenderHelp;
}

export interface RenderFieldBlock {
  readonly kind: "field";
  readonly field: RenderField;
}

export interface RenderTableCell {
  /** Null preserves a recoverable invalid/empty parser cell without exposing its AST. */
  readonly field: RenderField | null;
}

export interface RenderTableRow {
  readonly cells: readonly RenderTableCell[];
}

export interface RenderRepeatMetadata {
  readonly type: "month";
  /** The table remains a template; consumers decide how many instances to show. */
  readonly mode: "template";
  readonly sourceFieldId: string;
}

export interface RenderTableBlock {
  readonly kind: "table";
  readonly rows: readonly RenderTableRow[];
  readonly help?: RenderHelp;
  readonly repeat?: RenderRepeatMetadata;
}

export type RenderBlock = RenderFieldBlock | RenderTableBlock;

export interface RenderDocument {
  readonly version: number | null;
  readonly title?: string;
  readonly info: readonly string[];
  readonly blocks: readonly RenderBlock[];
}
