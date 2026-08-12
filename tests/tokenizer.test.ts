import { describe, expect, it } from "vitest";
import { createPosition } from "../src/ast/source-range.js";
import type { Diagnostic } from "../src/diagnostics/diagnostic.js";
import { DiagnosticCodes } from "../src/diagnostics/diagnostic-codes.js";
import { parseCall, readLines, splitTableCells } from "../src/parser/tokenizer.js";

describe("tokenizer", () => {
  it("tracks CRLF, LF, and CR offsets without filesystem input", () => {
    expect(readLines("A\r\nB\nC\rD")).toEqual([
      { text: "A", number: 1, startOffset: 0 },
      { text: "B", number: 2, startOffset: 3 },
      { text: "C", number: 3, startOffset: 5 },
      { text: "D", number: 4, startOffset: 7 },
    ]);
  });

  it("parses escaped delimiters before splitting arguments", () => {
    const diagnostics: Diagnostic[] = [];
    const call = parseCall(
      "$text(設備\\,名稱 A\\|B)",
      "$",
      createPosition(0, 1, 1),
      DiagnosticCodes.MalformedField,
      diagnostics,
    );

    expect(call).toEqual({ name: "text", arguments: ["設備,名稱 A|B"], valid: true });
    expect(diagnostics).toEqual([]);
  });

  it("splits only unescaped table pipes", () => {
    expect(splitTableCells("| $text(A\\|B) | $check(正常)", 0).map((cell) => cell.text)).toEqual([
      " $text(A\\|B) ",
      " $check(正常)",
    ]);
  });
});
