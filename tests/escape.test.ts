import { describe, expect, it } from "vitest";
import { ESCAPABLE_CHARACTERS, scanEscape } from "../src/parser/escape.js";

describe("scanEscape", () => {
  it.each(ESCAPABLE_CHARACTERS)("unescapes frozen v2 character %s", (character) => {
    expect(scanEscape(`\\${character}`, 0)).toEqual({ kind: "valid", value: character, width: 2 });
  });

  it("preserves an unsupported escape for diagnostic recovery", () => {
    expect(scanEscape("\\n", 0)).toEqual({ kind: "invalid", value: "\\n", width: 2 });
  });

  it("reports a dangling backslash", () => {
    expect(scanEscape("\\", 0)).toEqual({ kind: "dangling", value: "\\", width: 1 });
  });
});
