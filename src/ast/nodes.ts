import type { SourceRange } from "./source-range.js";

export type DirectiveType = "version" | "title" | "info" | "repeat" | "help" | "unknown";

export type FieldType =
  | "date"
  | "month"
  | "day"
  | "time"
  | "check"
  | "text"
  | "number"
  | "photo"
  | "signature"
  | "unknown";

interface NodeBase {
  readonly source: SourceRange;
  readonly rawText: string;
}

export interface CommentNode extends NodeBase {
  readonly kind: "comment";
  readonly text: string;
}

export interface InvalidNode extends NodeBase {
  readonly kind: "invalid";
}

export interface DirectiveNode extends NodeBase {
  readonly kind: "directive";
  readonly directiveType: DirectiveType;
  readonly name: string;
  readonly arguments: readonly string[];
  readonly syntacticallyValid: boolean;
  target?: FieldNode | TableNode;
}

export interface FieldHelp {
  readonly text: string;
  readonly imagePath?: string;
  readonly source: DirectiveNode;
}

export interface FieldNode extends NodeBase {
  readonly kind: "field";
  readonly fieldType: FieldType;
  readonly typeName: string;
  readonly arguments: readonly string[];
  readonly label: string | null;
  readonly syntacticallyValid: boolean;
  help?: FieldHelp;
}

export interface TableCell {
  readonly field: FieldNode | null;
  readonly source: SourceRange;
  readonly rawText: string;
}

export interface TableRow {
  readonly cells: readonly TableCell[];
  readonly source: SourceRange;
  readonly rawText: string;
}

export interface RepeatMetadata {
  readonly type: "month";
  readonly source: DirectiveNode;
  readonly monthSource: FieldNode;
}

export interface TableNode extends NodeBase {
  readonly kind: "table";
  readonly rows: readonly TableRow[];
  repeat?: RepeatMetadata;
  help?: FieldHelp;
}

export type CupNode = DirectiveNode | FieldNode | TableNode | CommentNode | InvalidNode;

export interface CupDocument {
  readonly version: number | null;
  readonly nodes: readonly CupNode[];
  readonly fields: readonly FieldNode[];
}
