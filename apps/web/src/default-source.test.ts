import { describe, expect, it } from "vitest";
import { parseCup } from "@checkup/parser";
import { createRenderModel } from "@checkup/renderer";
import { defaultSource } from "./default-source.js";

describe("default CheckUp source", () => {
  it("runs through the parser and renderer without diagnostics", () => {
    const parsed = parseCup(defaultSource);

    expect(parsed.success, parsed.diagnostics.map((item) => item.message).join("\n")).toBe(true);
    expect(parsed.diagnostics).toEqual([]);

    const rendered = createRenderModel(parsed.document);
    expect(rendered.title).toBe("Monthly Fire Equipment Inspection");
    expect(rendered.blocks.some((block) => block.kind === "table" && block.repeat !== undefined)).toBe(true);
    expect(rendered.blocks.some((block) => block.kind === "table" && block.help !== undefined)).toBe(true);
  });
});
