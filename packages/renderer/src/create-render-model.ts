import type {
  CupDocument,
  DirectiveNode,
  FieldHelp,
  FieldNode,
  RepeatMetadata,
  TableNode,
} from "@checkup/parser";
import { getFieldRenderDescriptor } from "./field-registry.js";
import type {
  RenderBlock,
  RenderDocument,
  RenderField,
  RenderHelp,
  RenderRepeatMetadata,
  RenderTableBlock,
} from "./types.js";

/** Converts the parser's resolved semantic document into a UI-oriented model. */
export function createRenderModel(document: CupDocument): RenderDocument {
  const fieldIds = new Map<FieldNode, string>();
  document.fields.forEach((field, index) => fieldIds.set(field, `field-${index + 1}`));

  const directives = document.nodes.filter(
    (node): node is DirectiveNode => node.kind === "directive" && node.syntacticallyValid,
  );
  const title = directives.find((directive) => directive.directiveType === "title")?.arguments[0];
  const info = directives
    .filter((directive) => directive.directiveType === "info")
    .flatMap((directive) => directive.arguments.slice(0, 1));
  const blocks: RenderBlock[] = [];

  for (const node of document.nodes) {
    if (node.kind === "field") {
      blocks.push({ kind: "field", field: createRenderField(node, fieldIds) });
    } else if (node.kind === "table") {
      blocks.push(createRenderTable(node, fieldIds));
    }
  }

  return title === undefined
    ? { version: document.version, info, blocks }
    : { version: document.version, title, info, blocks };
}

function createRenderTable(
  table: TableNode,
  fieldIds: Map<FieldNode, string>,
): RenderTableBlock {
  const rows = table.rows.map((row) => ({
    cells: row.cells.map((cell) => ({
      field: cell.field === null ? null : createRenderField(cell.field, fieldIds),
    })),
  }));
  const help = table.help === undefined ? undefined : createRenderHelp(table.help);
  const repeat = table.repeat === undefined ? undefined : createRepeatMetadata(table.repeat, fieldIds);

  return {
    kind: "table",
    rows,
    ...(help === undefined ? {} : { help }),
    ...(repeat === undefined ? {} : { repeat }),
  };
}

function createRenderField(field: FieldNode, fieldIds: Map<FieldNode, string>): RenderField {
  const id = getOrCreateFieldId(field, fieldIds);
  const help = field.help === undefined ? undefined : createRenderHelp(field.help);
  return {
    id,
    fieldType: field.fieldType,
    label: field.label,
    value: null,
    descriptor: getFieldRenderDescriptor(field.fieldType),
    ...(help === undefined ? {} : { help }),
  };
}

function createRenderHelp(help: FieldHelp): RenderHelp {
  return help.imagePath === undefined
    ? { text: help.text }
    : { text: help.text, imagePath: help.imagePath };
}

function createRepeatMetadata(
  repeat: RepeatMetadata,
  fieldIds: Map<FieldNode, string>,
): RenderRepeatMetadata {
  return {
    type: repeat.type,
    mode: "template",
    sourceFieldId: getOrCreateFieldId(repeat.monthSource, fieldIds),
  };
}

function getOrCreateFieldId(field: FieldNode, fieldIds: Map<FieldNode, string>): string {
  const existing = fieldIds.get(field);
  if (existing !== undefined) {
    return existing;
  }

  const id = `field-${fieldIds.size + 1}`;
  fieldIds.set(field, id);
  return id;
}
