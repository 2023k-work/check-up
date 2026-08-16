import { describe, expect, it } from "vitest";
import { parseCup, updateCupCell } from "../src/index.js";

describe("updateCupCell", () => {
  it("updates only the selected data-row cell and keeps declarations unchanged", () => {
    const source = `@version(2)
$month(月份)
@repeat(month)
| $day(日) | $text(設備編號) | $check(外觀)
| 1 | FE-001 | 正常
| 2 | FE-002 | 正常`;
    const parsed = parseCup(source);
    expect(parsed.success).toBe(true);

    const result = updateCupCell(source, parsed.document, {
      tableId: "table-1",
      rowId: "table-1-row-2",
      fieldId: "table-1-field-2",
      value: "FE-009",
    });

    expect(result.success).toBe(true);
    expect(result.source).toContain("| $day(日) | $text(設備編號) | $check(外觀)");
    expect(result.source).toContain("| 1 | FE-001 | 正常");
    expect(result.source).toContain("| 2 | FE-009 | 正常");
  });

  it("escapes special characters and produces source that parses again", () => {
    const source = "@version(2)\n| $text(備註)\n| 初始值";
    const parsed = parseCup(source);
    const result = updateCupCell(source, parsed.document, {
      tableId: "table-1",
      rowId: "table-1-row-1",
      fieldId: "table-1-field-1",
      value: "A|B\\C,@(x)",
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe("@version(2)\n| $text(備註)\n| A\\|B\\\\C\\,\\@\\(x\\)");
    const table = result.document.nodes.find((node) => node.kind === "table");
    expect(table?.kind === "table" ? table.rows[0]?.cells[0]?.value : undefined).toBe("A|B\\C,@(x)");
  });

  it("can insert a value into an empty data cell", () => {
    const source = "@version(2)\n| $day(日) | $text(備註)\n| 1 | ";
    const parsed = parseCup(source);
    const result = updateCupCell(source, parsed.document, {
      tableId: "table-1",
      rowId: "table-1-row-1",
      fieldId: "table-1-field-2",
      value: "完成",
    });

    expect(result.source).toBe("@version(2)\n| $day(日) | $text(備註)\n| 1 | 完成");
    expect(result.success).toBe(true);
  });
});
