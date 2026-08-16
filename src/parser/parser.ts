import type {
  CommentNode,
  CupDocument,
  CupNode,
  DirectiveNode,
  DirectiveType,
  FieldHelp,
  FieldNode,
  FieldType,
  InvalidNode,
  TableCell,
  TableColumn,
  TableNode,
  TableRow,
} from "../ast/nodes.js";
import {
  createPosition,
  createRange,
  createSingleLineRange,
  type SourceRange,
} from "../ast/source-range.js";
import { createError, type Diagnostic } from "../diagnostics/diagnostic.js";
import { DiagnosticCodes, type DiagnosticCode } from "../diagnostics/diagnostic-codes.js";
import {
  parseCall,
  readLines,
  splitTableCells,
  trimStructuralWhitespace,
  type SourceLine,
} from "./tokenizer.js";
import { scanEscape } from "./escape.js";

const directiveTypes: Readonly<Record<string, DirectiveType>> = {
  version: "version",
  title: "title",
  info: "info",
  repeat: "repeat",
  help: "help",
};

const fieldTypes: Readonly<Record<string, FieldType>> = {
  date: "date",
  month: "month",
  day: "day",
  time: "time",
  check: "check",
  text: "text",
  number: "number",
  photo: "photo",
  signature: "signature",
};

export interface ParseResult {
  readonly document: CupDocument;
  readonly diagnostics: readonly Diagnostic[];
  readonly success: boolean;
}

/** Parses CheckUp Format v2 source into a fault-tolerant document model. */
export function parseCup(source: string): ParseResult {
  if (typeof source !== "string") {
    throw new TypeError("parseCup(source) requires a string.");
  }

  const lines = readLines(source);
  const diagnostics: Diagnostic[] = [];
  const nodes: CupNode[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const trimmedRange = trimStructuralWhitespace(line.text);
    if (trimmedRange.length === 0) {
      continue;
    }

    const trimmed = line.text.slice(trimmedRange.start, trimmedRange.start + trimmedRange.length);
    if (trimmed[0] === "|") {
      const tableLines: ParsedTableLine[] = [];
      const tableStart = createPosition(
        line.startOffset + trimmedRange.start,
        line.number,
        trimmedRange.start + 1,
      );
      let candidateIndex = lineIndex;
      let lastLine = line;

      while (candidateIndex < lines.length) {
        const candidate = lines[candidateIndex]!;
        const candidateTrim = trimStructuralWhitespace(candidate.text);
        if (candidateTrim.length === 0 || candidate.text[candidateTrim.start] !== "|") {
          break;
        }

        tableLines.push(parseTableLine(candidate, candidateTrim.start, diagnostics));
        lastLine = candidate;
        candidateIndex += 1;
      }

      lineIndex = candidateIndex - 1;
      const tableEnd = createPosition(
        lastLine.startOffset + lastLine.text.length,
        lastLine.number,
        lastLine.text.length + 1,
      );
      const tableSource = createRange(tableStart, tableEnd);
      const tableIndex = nodes.filter((node) => node.kind === "table").length + 1;
      const tableId = `table-${tableIndex}`;
      const { columns, rows } = buildTableModel(tableId, tableLines, diagnostics);
      nodes.push({
        id: tableId,
        kind: "table",
        columns,
        rows,
        source: tableSource,
        rawText: source.slice(tableStart.offset, tableEnd.offset),
      });
      continue;
    }

    const position = createPosition(
      line.startOffset + trimmedRange.start,
      line.number,
      trimmedRange.start + 1,
    );
    const sourceRange = createSingleLineRange(position, trimmedRange.length);
    if (trimmed[0] === "@") {
      nodes.push(parseDirective(trimmed, sourceRange, diagnostics));
    } else if (trimmed[0] === "$") {
      const field = parseField(trimmed, sourceRange, diagnostics, `field-${nodes.length + 1}`);
      nodes.push(field ?? createInvalidNode(sourceRange, trimmed));
    } else {
      nodes.push(createCommentNode(trimmed, sourceRange));
    }
  }

  const version = validateDocument(nodes, diagnostics);
  const fields = enumerateFields(nodes);
  bindDirectives(nodes, fields, diagnostics);
  const document: CupDocument = { version, nodes, fields };

  return {
    document,
    diagnostics,
    success: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
  };
}

function parseDirective(text: string, source: SourceRange, diagnostics: Diagnostic[]): CupNode {
  const call = parseCall(text, "@", source.start, DiagnosticCodes.MalformedDirective, diagnostics);
  if (call === null) {
    return createInvalidNode(source, text);
  }

  const directiveType = directiveTypes[call.name] ?? "unknown";
  const node: DirectiveNode = {
    kind: "directive",
    directiveType,
    name: call.name,
    arguments: call.arguments,
    syntacticallyValid: call.valid,
    source,
    rawText: text,
  };

  if (directiveType === "unknown") {
    addError(diagnostics, DiagnosticCodes.UnknownDirective, `Unknown directive '@${call.name}'.`, source);
    return node;
  }

  validateDirective(node, diagnostics);
  return node;
}

function parseField(
  text: string,
  source: SourceRange,
  diagnostics: Diagnostic[],
  id: string,
): FieldNode | null {
  const call = parseCall(text, "$", source.start, DiagnosticCodes.MalformedField, diagnostics);
  if (call === null) {
    return null;
  }

  const fieldType = fieldTypes[call.name] ?? "unknown";
  const node: FieldNode = {
    id,
    kind: "field",
    fieldType,
    typeName: call.name,
    arguments: call.arguments,
    label: call.arguments.length === 1 ? call.arguments[0]! : null,
    syntacticallyValid: call.valid,
    source,
    rawText: text,
  };

  if (fieldType === "unknown") {
    addError(diagnostics, DiagnosticCodes.UnknownField, `Unknown field type '$${call.name}'.`, source);
  }

  if (call.arguments.length !== 1) {
    addError(
      diagnostics,
      DiagnosticCodes.InvalidArgumentCount,
      `$${call.name} requires exactly one label argument.`,
      source,
    );
  } else if (call.arguments[0] === "") {
    addError(diagnostics, DiagnosticCodes.InvalidArgument, `$${call.name} requires a non-empty label.`, source);
  }

  return node;
}

interface ParsedTableCell {
  readonly source: SourceRange;
  readonly rawText: string;
}

interface ParsedTableLine {
  readonly cells: readonly ParsedTableCell[];
  readonly source: SourceRange;
  readonly rawText: string;
}

function parseTableLine(line: SourceLine, leadingPipeIndex: number, diagnostics: Diagnostic[]): ParsedTableLine {
  const segments = splitTableCells(line.text, leadingPipeIndex);
  const cells: ParsedTableCell[] = [];
  const rowStart = createPosition(line.startOffset + leadingPipeIndex, line.number, leadingPipeIndex + 1);
  const rowSource = createSingleLineRange(rowStart, line.text.length - leadingPipeIndex);
  let separatorCandidates = segments;

  const lastSegment = segments[segments.length - 1];
  if (segments.length > 1 && lastSegment !== undefined && lastSegment.text.trim().length === 0) {
    separatorCandidates = segments.slice(0, -1);
  }

  const markdownSeparator =
    separatorCandidates.length > 0 &&
    separatorCandidates.every((segment) => isSeparator(segment.text.trim()));
  if (markdownSeparator) {
    addError(
      diagnostics,
      DiagnosticCodes.MarkdownSeparator,
      "Markdown separator rows are not valid .cup tables.",
      rowSource,
    );
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const cellTrim = trimStructuralWhitespace(segment.text);
    const cellStart = createPosition(
      line.startOffset + segment.startIndex + cellTrim.start,
      line.number,
      segment.startIndex + cellTrim.start + 1,
    );
    const cellEnd = createPosition(
      cellStart.offset + cellTrim.length,
      cellStart.line,
      cellStart.column + cellTrim.length,
    );
    const cellSource = createRange(cellStart, cellEnd);
    const trimmed =
      cellTrim.length === 0
        ? ""
        : segment.text.slice(cellTrim.start, cellTrim.start + cellTrim.length);

    cells.push({ source: cellSource, rawText: trimmed });
  }

  return {
    cells,
    source: rowSource,
    rawText: line.text.slice(leadingPipeIndex),
  };
}

function buildTableModel(
  tableId: string,
  lines: readonly ParsedTableLine[],
  diagnostics: Diagnostic[],
): { readonly columns: readonly TableColumn[]; readonly rows: readonly TableRow[] } {
  const columns: TableColumn[] = [];
  let dataStart = lines.length;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const declarationLine =
      lineIndex === 0 || line.cells.every((cell) => cell.rawText.startsWith("$"));
    if (!declarationLine) {
      dataStart = lineIndex;
      break;
    }

    for (const cell of line.cells) {
      const columnIndex = columns.length + 1;
      const fieldId = `${tableId}-field-${columnIndex}`;
      let field: FieldNode | null = null;
      if (cell.rawText.startsWith("$")) {
        field = parseField(cell.rawText, cell.source, diagnostics, fieldId);
      } else {
        const trailingCell = cell.rawText === "" && cell === line.cells[line.cells.length - 1];
        addError(
          diagnostics,
          trailingCell ? DiagnosticCodes.TrailingTableCell : DiagnosticCodes.InvalidTableCell,
          trailingCell
            ? "A trailing '|' creates an empty table column."
            : "Every table column must contain exactly one field declaration.",
          cell.source,
        );
      }
      columns.push({ id: fieldId, field });
    }
  }

  if (columns.length === 0 && lines.length > 0) {
    addError(
      diagnostics,
      DiagnosticCodes.MissingTableColumns,
      "A .cup table must begin with one or more $field(...) column declarations.",
      lines[0]!.source,
    );
  }

  const rows: TableRow[] = [];
  for (let lineIndex = dataStart; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    const rowIndex = rows.length + 1;
    const rowId = `${tableId}-row-${rowIndex}`;
    if (line.cells.length !== columns.length) {
      addError(
        diagnostics,
        DiagnosticCodes.InconsistentTableRow,
        `Table row has ${line.cells.length} cells but ${columns.length} columns are declared.`,
        line.source,
      );
    }

    const cells: TableCell[] = line.cells.map((cell, cellIndex) => ({
      id: `${rowId}-cell-${cellIndex + 1}`,
      fieldId: columns[cellIndex]?.id ?? `${tableId}-field-${cellIndex + 1}`,
      value: parseTableValue(cell, diagnostics),
      source: cell.source,
      rawText: cell.rawText,
    }));
    rows.push({ id: rowId, cells, source: line.source, rawText: line.rawText });
  }

  return { columns, rows };
}

function parseTableValue(cell: ParsedTableCell, diagnostics: Diagnostic[]): string {
  let value = "";
  for (let index = 0; index < cell.rawText.length; index += 1) {
    const character = cell.rawText[index]!;
    if (character !== "\\") {
      value += character;
      continue;
    }

    const escape = scanEscape(cell.rawText, index);
    if (escape.kind === "dangling") {
      addError(
        diagnostics,
        DiagnosticCodes.InvalidEscape,
        "A trailing backslash is not a valid escape.",
        createSingleLineRange(
          createPosition(cell.source.start.offset + index, cell.source.start.line, cell.source.start.column + index),
          1,
        ),
      );
    } else if (escape.kind === "invalid") {
      addError(
        diagnostics,
        DiagnosticCodes.InvalidEscape,
        `'${escape.value}' is not a supported v2 escape.`,
        createSingleLineRange(
          createPosition(cell.source.start.offset + index, cell.source.start.line, cell.source.start.column + index),
          2,
        ),
      );
    }
    value += escape.value;
    index += escape.width - 1;
  }
  return value;
}

function validateDirective(node: DirectiveNode, diagnostics: Diagnostic[]): void {
  switch (node.directiveType) {
    case "version":
      requireArgumentCount(node, 1, diagnostics);
      if (node.arguments.length === 1 && node.arguments[0] !== "2") {
        addError(diagnostics, DiagnosticCodes.UnsupportedVersion, "Only CheckUp version 2 is supported.", node.source);
      }
      return;

    case "title":
      requireArgumentCount(node, 1, diagnostics);
      if (node.arguments.length === 1 && node.arguments[0] === "") {
        addError(diagnostics, DiagnosticCodes.InvalidArgument, "@title requires non-empty text.", node.source);
      }
      return;

    case "info":
      requireArgumentCount(node, 1, diagnostics);
      return;

    case "repeat":
      requireArgumentCount(node, 1, diagnostics);
      if (node.arguments.length === 1 && node.arguments[0] !== "month") {
        addError(diagnostics, DiagnosticCodes.UnsupportedRepeatType, "Only @repeat(month) is supported.", node.source);
      }
      return;

    case "help":
      if (node.arguments.length < 1 || node.arguments.length > 2) {
        addError(
          diagnostics,
          DiagnosticCodes.InvalidArgumentCount,
          "@help accepts text and an optional image path.",
          node.source,
        );
      } else {
        if (node.arguments[0] === "") {
          addError(diagnostics, DiagnosticCodes.InvalidArgument, "@help requires non-empty help text.", node.source);
        }
        if (node.arguments.length === 2 && !isSafeResourcePath(node.arguments[1]!)) {
          addError(
            diagnostics,
            DiagnosticCodes.InvalidResourcePath,
            "Help image paths must be relative, use '/', and remain inside the document folder tree.",
            node.source,
          );
        }
      }
      return;

    case "unknown":
      return;
  }
}

function validateDocument(nodes: readonly CupNode[], diagnostics: Diagnostic[]): number | null {
  const versions = nodes.filter(
    (node): node is DirectiveNode => node.kind === "directive" && node.directiveType === "version",
  );

  if (versions.length === 0) {
    addError(
      diagnostics,
      DiagnosticCodes.MissingVersion,
      "A document must contain exactly one @version(2) directive.",
      createSingleLineRange(createPosition(0, 1, 1), 1),
    );
  } else {
    for (const duplicate of versions.slice(1)) {
      addError(diagnostics, DiagnosticCodes.DuplicateVersion, "@version may occur only once.", duplicate.source);
    }

    const firstMeaningful = nodes.find((node) => node.kind !== "comment");
    if (firstMeaningful !== versions[0]) {
      addError(
        diagnostics,
        DiagnosticCodes.VersionMustBeFirst,
        "@version(2) must be the first meaningful construct.",
        versions[0]!.source,
      );
    }
  }

  const titles = nodes.filter(
    (node): node is DirectiveNode => node.kind === "directive" && node.directiveType === "title",
  );
  for (const duplicate of titles.slice(1)) {
    addError(diagnostics, DiagnosticCodes.DuplicateTitle, "@title may occur at most once.", duplicate.source);
  }

  const versionArgument = versions[0]?.arguments.length === 1 ? versions[0].arguments[0] : undefined;
  if (versionArgument !== undefined && /^[+-]?\d+$/u.test(versionArgument)) {
    const version = Number(versionArgument);
    return Number.isSafeInteger(version) ? version : null;
  }
  return null;
}

function bindDirectives(nodes: readonly CupNode[], fields: readonly FieldNode[], diagnostics: Diagnostic[]): void {
  const firstMonth = fields.find((field) => field.fieldType === "month") ?? null;
  bindRepeatDirectives(nodes, firstMonth, diagnostics);
  bindHelpDirectives(nodes, diagnostics);
}

function bindRepeatDirectives(
  nodes: readonly CupNode[],
  firstMonth: FieldNode | null,
  diagnostics: Diagnostic[],
): void {
  const targets = new Map<TableNode, DirectiveNode[]>();
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (
      node.kind !== "directive" ||
      node.directiveType !== "repeat" ||
      !node.syntacticallyValid ||
      node.arguments.length !== 1 ||
      node.arguments[0] !== "month"
    ) {
      continue;
    }

    const target = nodes.slice(index + 1).find((candidate): candidate is TableNode => candidate.kind === "table");
    if (target === undefined) {
      addError(
        diagnostics,
        DiagnosticCodes.MissingRepeatTarget,
        "@repeat(month) has no following table.",
        node.source,
      );
      continue;
    }

    const directives = targets.get(target) ?? [];
    directives.push(node);
    targets.set(target, directives);
  }

  for (const [table, directives] of targets) {
    if (directives.length > 1) {
      for (const directive of directives) {
        addError(
          diagnostics,
          DiagnosticCodes.AmbiguousTableDirective,
          "Multiple table-scoped directives target the same table.",
          directive.source,
        );
      }
      continue;
    }

    const source = directives[0]!;
    if (firstMonth === null) {
      addError(
        diagnostics,
        DiagnosticCodes.MissingMonthSource,
        "@repeat(month) requires a $month field in the document.",
        source.source,
      );
      continue;
    }

    table.repeat = { type: "month", source, monthSource: firstMonth };
    source.target = table;
  }
}

function bindHelpDirectives(nodes: readonly CupNode[], diagnostics: Diagnostic[]): void {
  const targets = new Map<FieldNode | TableNode, DirectiveNode[]>();
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    if (
      node.kind !== "directive" ||
      node.directiveType !== "help" ||
      !node.syntacticallyValid ||
      node.arguments.length < 1 ||
      node.arguments.length > 2 ||
      node.arguments[0] === ""
    ) {
      continue;
    }

    const target = nodes
      .slice(index + 1)
      .find((candidate): candidate is FieldNode | TableNode => candidate.kind === "field" || candidate.kind === "table");
    if (target === undefined) {
      addError(
        diagnostics,
        DiagnosticCodes.MissingHelpTarget,
        "@help has no following field or table.",
        node.source,
      );
      continue;
    }

    const directives = targets.get(target) ?? [];
    directives.push(node);
    targets.set(target, directives);
  }

  for (const [target, directives] of targets) {
    if (directives.length > 1) {
      for (const directive of directives) {
        addError(
          diagnostics,
          DiagnosticCodes.AmbiguousHelpTarget,
          "Multiple @help directives target the same renderable node.",
          directive.source,
        );
      }
      continue;
    }

    const source = directives[0]!;
    const imagePath = source.arguments.length === 2 ? source.arguments[1]! : undefined;
    const help: FieldHelp = imagePath === undefined
      ? { text: source.arguments[0]!, source }
      : { text: source.arguments[0]!, imagePath, source };
    target.help = help;
    source.target = target;
  }
}

function enumerateFields(nodes: readonly CupNode[]): readonly FieldNode[] {
  const fields: FieldNode[] = [];
  for (const node of nodes) {
    if (node.kind === "field") {
      fields.push(node);
    } else if (node.kind === "table") {
      fields.push(...node.columns.flatMap((column) => column.field === null ? [] : [column.field]));
    }
  }
  return fields;
}

function createCommentNode(text: string, source: SourceRange): CommentNode {
  return { kind: "comment", text, source, rawText: text };
}

function createInvalidNode(source: SourceRange, rawText: string): InvalidNode {
  return { kind: "invalid", source, rawText };
}

function isSeparator(text: string): boolean {
  return text.length > 0 && [...text].every((character) => character === "-" || character === "—");
}

function isSafeResourcePath(path: string): boolean {
  const firstCode = path.charCodeAt(0);
  const hasWindowsDrivePrefix =
    path.length >= 2 &&
    ((firstCode >= 65 && firstCode <= 90) || (firstCode >= 97 && firstCode <= 122)) &&
    path[1] === ":";
  if (path.length === 0 || path.startsWith("/") || hasWindowsDrivePrefix || path.includes("\\")) {
    return false;
  }
  return path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function requireArgumentCount(node: DirectiveNode, expected: number, diagnostics: Diagnostic[]): void {
  if (node.arguments.length !== expected) {
    addError(
      diagnostics,
      DiagnosticCodes.InvalidArgumentCount,
      `@${node.name} requires exactly ${expected} argument${expected === 1 ? "" : "s"}.`,
      node.source,
    );
  }
}

function addError(
  diagnostics: Diagnostic[],
  code: DiagnosticCode,
  message: string,
  source: SourceRange,
): void {
  diagnostics.push(createError(code, message, source));
}
