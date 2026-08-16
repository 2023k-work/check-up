import { describe, expect, it } from "vitest";
import { parseCup } from "@checkup/parser";
import { applyPreviewEdits } from "./edit-session.js";

describe("Preview edit session", () => {
  it("writes multiple semantic edits back through Parser and Mutator", () => {
    const source = `@version(2)
| $day(日) | $text(設備) | $check(正常)
| 1 | FE-001 | 正常
| 2 | FE-002 | 正常`;
    const parsed = parseCup(source);
    const result = applyPreviewEdits(source, parsed.document, [
      { tableId: "table-1", rowId: "table-1-row-1", fieldId: "table-1-field-2", value: "FE-A|1" },
      { tableId: "table-1", rowId: "table-1-row-2", fieldId: "table-1-field-3", value: "異常" },
    ]);

    expect(result.success).toBe(true);
    expect(result.source).toContain("| 1 | FE-A\\|1 | 正常");
    expect(result.source).toContain("| 2 | FE-002 | 異常");
    expect(result.document.nodes.find((node) => node.kind === "table")).toMatchObject({
      rows: [
        { cells: [{ value: "1" }, { value: "FE-A|1" }, { value: "正常" }] },
        { cells: [{ value: "2" }, { value: "FE-002" }, { value: "異常" }] },
      ],
    });
  });
});
