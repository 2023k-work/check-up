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
  RenderCellEditTarget,
  RenderDocument,
  RenderField,
  RenderFieldValue,
  RenderHelp,
  RenderRepeatMetadata,
  RenderTableBlock,
} from "./types.js";

/** Converts the parser's resolved semantic document into a UI-oriented model. */
export function createRenderModel(document: CupDocument): RenderDocument {
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
      blocks.push({ kind: "field", field: createRenderField(node, null, node.id) });
    } else if (node.kind === "table") {
      blocks.push(createRenderTable(node));
    }
  }

  return title === undefined
    ? { version: document.version, info, blocks }
    : { version: document.version, title, info, blocks };
}

function createRenderTable(table: TableNode): RenderTableBlock {
  const columns = table.columns.map((column) => ({
    id: column.id,
    label: column.field?.label ?? null,
    fieldType: column.field?.fieldType ?? "unknown" as const,
  }));
  const rows = table.rows.map((row) => ({
    cells: row.cells.map((cell, cellIndex) => {
      const column = table.columns[cellIndex];
      if (column?.field === undefined || column.field === null) {
        return { field: null };
      }
      const edit: RenderCellEditTarget = {
        tableId: table.id,
        rowId: row.id,
        fieldId: column.id,
      };
      return {
        field: createRenderField(
          column.field,
          parseFieldValue(column.field, cell.value),
          cell.id,
          edit,
        ),
      };
    }),
  }));
  const help = table.help === undefined ? undefined : createRenderHelp(table.help);
  const repeat = table.repeat === undefined ? undefined : createRepeatMetadata(table.repeat);

  return {
    kind: "table",
    id: table.id,
    columns,
    rows,
    ...(help === undefined ? {} : { help }),
    ...(repeat === undefined ? {} : { repeat }),
  };
}

function createRenderField(
  field: FieldNode,
  value: RenderFieldValue,
  id: string,
  edit?: RenderCellEditTarget,
): RenderField {
  const help = field.help === undefined ? undefined : createRenderHelp(field.help);
  return {
    id,
    fieldType: field.fieldType,
    label: field.label,
    value,
    descriptor: getFieldRenderDescriptor(field.fieldType),
    ...(help === undefined ? {} : { help }),
    ...(edit === undefined ? {} : { edit }),
  };
}

function parseFieldValue(field: FieldNode, value: string): RenderFieldValue {
  if (field.fieldType === "number" || field.fieldType === "day") {
    const number = Number(value);
    return value.trim() !== "" && Number.isFinite(number) ? number : value;
  }
  if (field.fieldType === "check") {
    return ["true", "1", "yes", "正常", "是", "✓"].includes(value.trim().toLowerCase());
  }
  return value;
}

function createRenderHelp(help: FieldHelp): RenderHelp {
  return help.imagePath === undefined
    ? { text: help.text }
    : { text: help.text, imagePath: help.imagePath };
}

function createRepeatMetadata(repeat: RepeatMetadata): RenderRepeatMetadata {
  return {
    type: repeat.type,
    mode: "template",
    sourceFieldId: repeat.monthSource.id,
  };
}
