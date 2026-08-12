/** Source locations use one-based lines/columns and UTF-16 code-unit offsets. */
export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

/** The end position is exclusive, matching String.prototype.slice semantics. */
export interface SourceRange {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
  readonly length: number;
}

export function createPosition(offset: number, line: number, column: number): SourcePosition {
  return { offset, line, column };
}

export function createSingleLineRange(start: SourcePosition, length: number): SourceRange {
  const normalizedLength = Math.max(1, length);
  return {
    start,
    end: createPosition(start.offset + normalizedLength, start.line, start.column + normalizedLength),
    length: normalizedLength,
  };
}

export function createRange(start: SourcePosition, end: SourcePosition): SourceRange {
  return {
    start,
    end,
    length: Math.max(0, end.offset - start.offset),
  };
}
