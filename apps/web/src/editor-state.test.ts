import { describe, expect, it } from "vitest";
import { formatDiagnostic, isEmptySource, runtimeErrorMessage } from "./editor-state.js";

describe("editor recovery state", () => {
  it("recognizes truly empty source without treating invalid source as empty", () => {
    expect(isEmptySource(" \n\t")).toBe(true);
    expect(isEmptySource("@version(2)\n| $text(Unclosed")).toBe(false);
  });

  it("formats parser diagnostics with a precise source location", () => {
    expect(formatDiagnostic({
      severity: "error",
      code: "CUP002",
      message: "Unclosed directive",
      source: {
        start: { offset: 3, line: 2, column: 4 },
        end: { offset: 4, line: 2, column: 5 },
        length: 1,
      },
    })).toBe("Line 2, column 4 · CUP002: Unclosed directive");
  });

  it("normalizes thrown application values into a useful fallback message", () => {
    expect(runtimeErrorMessage(new Error("Renderer failed"))).toBe("Renderer failed");
    expect(runtimeErrorMessage(null)).toBe("An unexpected application error occurred.");
  });
});
