import { createError, type Diagnostic } from "../diagnostics/diagnostic.js";
import { DiagnosticCodes, type DiagnosticCode } from "../diagnostics/diagnostic-codes.js";
import {
  createPosition,
  createSingleLineRange,
  type SourcePosition,
} from "../ast/source-range.js";
import { scanEscape } from "./escape.js";

export interface SourceLine {
  readonly text: string;
  readonly number: number;
  readonly startOffset: number;
}

export interface TrimmedRange {
  readonly start: number;
  readonly length: number;
}

export interface CallSyntax {
  readonly name: string;
  readonly arguments: readonly string[];
  readonly valid: boolean;
}

export interface CellSegment {
  readonly text: string;
  readonly startIndex: number;
}

export function readLines(source: string): readonly SourceLine[] {
  const lines: SourceLine[] = [];
  let lineNumber = 1;
  let lineStart = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character !== "\r" && character !== "\n") {
      continue;
    }

    lines.push({ text: source.slice(lineStart, index), number: lineNumber, startOffset: lineStart });
    lineNumber += 1;
    if (character === "\r" && source[index + 1] === "\n") {
      index += 1;
    }
    lineStart = index + 1;
  }

  if (lineStart < source.length || source.length === 0) {
    lines.push({ text: source.slice(lineStart), number: lineNumber, startOffset: lineStart });
  }

  return lines;
}

export function trimStructuralWhitespace(text: string): TrimmedRange {
  let start = 0;
  while (start < text.length && isWhitespace(text[start]!)) {
    start += 1;
  }

  let end = text.length;
  while (end > start && isWhitespace(text[end - 1]!)) {
    end -= 1;
  }

  return { start, length: end - start };
}

export function parseCall(
  text: string,
  expectedSigil: "@" | "$",
  start: SourcePosition,
  malformedCode: DiagnosticCode,
  diagnostics: Diagnostic[],
): CallSyntax | null {
  if (text.length === 0 || text[0] !== expectedSigil) {
    addError(diagnostics, malformedCode, `Expected '${expectedSigil}' call.`, start, Math.max(1, text.length));
    return null;
  }

  let index = 1;
  const firstNameCharacter = text[index];
  if (firstNameCharacter === undefined || !isIdentifierStart(firstNameCharacter)) {
    addError(diagnostics, malformedCode, "A call name must start with an ASCII letter.", positionAt(start, index), 1);
    return null;
  }

  const nameStart = index;
  index += 1;
  while (index < text.length && isIdentifierPart(text[index]!)) {
    index += 1;
  }

  const name = text.slice(nameStart, index);
  if (text[index] !== "(") {
    addError(diagnostics, malformedCode, `${expectedSigil}${name} must be followed by '('.`, positionAt(start, index), 1);
    return null;
  }

  index += 1;
  const argumentsList: string[] = [];
  let current = "";
  let valid = true;

  while (index < text.length) {
    const character = text[index]!;
    if (character === "\\") {
      const escape = scanEscape(text, index);
      if (escape.kind === "dangling") {
        addError(diagnostics, DiagnosticCodes.InvalidEscape, "A trailing backslash is not a valid escape.", positionAt(start, index), 1);
        current += escape.value;
        valid = false;
      } else if (escape.kind === "invalid") {
        addError(diagnostics, DiagnosticCodes.InvalidEscape, `'${escape.value}' is not a supported v2 escape.`, positionAt(start, index), 2);
        current += escape.value;
        valid = false;
      } else {
        current += escape.value;
      }
      index += escape.width;
      continue;
    }

    if (character === ",") {
      argumentsList.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    if (character === "(") {
      addError(diagnostics, malformedCode, "An unescaped '(' is not allowed inside an argument.", positionAt(start, index), 1);
      current += character;
      valid = false;
      index += 1;
      continue;
    }

    if (character === ")") {
      argumentsList.push(current.trim());
      index += 1;
      while (index < text.length && isWhitespace(text[index]!)) {
        index += 1;
      }

      if (index < text.length) {
        const unexpectedClosing = text[index] === ")";
        addError(
          diagnostics,
          unexpectedClosing ? DiagnosticCodes.UnexpectedClosingParenthesis : malformedCode,
          unexpectedClosing ? "Unexpected closing parenthesis after the call." : "Unexpected characters after the call.",
          positionAt(start, index),
          text.length - index,
        );
        valid = false;
      }

      return { name, arguments: argumentsList, valid };
    }

    current += character;
    index += 1;
  }

  addError(
    diagnostics,
    DiagnosticCodes.UnclosedParenthesis,
    `The ${expectedSigil}${name} call is missing a closing parenthesis.`,
    start,
    text.length,
  );
  return { name, arguments: argumentsList, valid: false };
}

export function splitTableCells(line: string, leadingPipeIndex: number): readonly CellSegment[] {
  const cells: CellSegment[] = [];
  let cellStart = leadingPipeIndex + 1;

  for (let index = cellStart; index < line.length; index += 1) {
    if (line[index] === "\\") {
      const escape = scanEscape(line, index);
      if (escape.width === 2) {
        index += 1;
      }
      continue;
    }

    if (line[index] !== "|") {
      continue;
    }

    cells.push({ text: line.slice(cellStart, index), startIndex: cellStart });
    cellStart = index + 1;
  }

  cells.push({ text: line.slice(cellStart), startIndex: cellStart });
  return cells;
}

function isWhitespace(character: string): boolean {
  return character.trim().length === 0;
}

function isIdentifierStart(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isIdentifierPart(character: string): boolean {
  const code = character.charCodeAt(0);
  return isIdentifierStart(character) || (code >= 48 && code <= 57) || character === "_";
}

function positionAt(start: SourcePosition, relativeOffset: number): SourcePosition {
  return createPosition(start.offset + relativeOffset, start.line, start.column + relativeOffset);
}

function addError(
  diagnostics: Diagnostic[],
  code: DiagnosticCode,
  message: string,
  start: SourcePosition,
  length: number,
): void {
  diagnostics.push(createError(code, message, createSingleLineRange(start, length)));
}
