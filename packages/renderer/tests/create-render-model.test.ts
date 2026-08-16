import { describe, expect, it } from "vitest";
import { parseCup } from "@checkup/parser";
import {
  createRenderModel,
  fieldRenderRegistry,
  type RenderField,
  type RenderTableBlock,
} from "../src/index.js";

describe("createRenderModel", () => {
  it("converts a CupDocument into document metadata and renderable blocks", () => {
    const model = render(`@version(2)
@title(設備點檢)
@info(每天執行)
$date(日期)
| $check(正常)`);

    expect(model).toMatchObject({
      version: 2,
      title: "設備點檢",
      info: ["每天執行"],
    });
    expect(model.blocks.map((block) => block.kind)).toEqual(["field", "table"]);
  });

  it("keeps multiple info directives in source order", () => {
    const model = render("@version(2)\n@info(第一則)\n@info(第二則)");
    expect(model.info).toEqual(["第一則", "第二則"]);
  });

  it("preserves table row and cell structure", () => {
    const table = onlyTable(render("@version(2)\n| $date(日期) | $text(設備)\n| 2026-08-16 | FE-001\n| 2026-08-17 | FE-002"));
    expect(table.columns.map((column) => column.label)).toEqual(["日期", "設備"]);
    expect(table.rows.map((row) => row.cells.length)).toEqual([2, 2]);
    expect(table.rows[0]?.cells[1]?.field?.value).toBe("FE-001");
    expect(table.rows[1]?.cells[1]?.field?.edit).toEqual({
      tableId: "table-1",
      rowId: "table-1-row-2",
      fieldId: "table-1-field-2",
    });
  });

  it("preserves time values for editable controls", () => {
    const table = onlyTable(render("@version(2)\n| $time(時間)\n| 09:00\n| 09:15"));
    expect(table.rows.map((row) => row.cells[0]?.field?.value)).toEqual(["09:00", "09:15"]);
  });

  it("maps every v2 field through the registry", () => {
    const types = ["date", "month", "day", "time", "check", "text", "number", "photo", "signature"] as const;
    const source = ["@version(2)", ...types.map((type) => `$${type}(${type})`)].join("\n");
    const fields = renderFields(render(source));

    expect(fields.map((field) => field.fieldType)).toEqual(types);
    expect(fields.map((field) => field.descriptor)).toEqual(types.map((type) => fieldRenderRegistry[type]));
    expect(fields.every((field) => field.value === null)).toBe(true);
  });

  it("copies resolved field help without exposing its directive", () => {
    const field = only(renderFields(render("@version(2)\n@help(請確認內容)\n$text(備註)")));
    expect(field.help).toEqual({ text: "請確認內容" });
    expect(field).not.toHaveProperty("source");
  });

  it("copies resolved help text and image", () => {
    const field = only(renderFields(render("@version(2)\n@help(拍攝銘牌,images/nameplate.png)\n$photo(照片)")));
    expect(field.help).toEqual({ text: "拍攝銘牌", imagePath: "images/nameplate.png" });
  });

  it("keeps repeat as template metadata linked to the resolved month field", () => {
    const model = render("@version(2)\n$month(月份)\n@repeat(month)\n| $day(日) | $check(正常)");
    const month = renderFields(model).find((field) => field.fieldType === "month");
    const table = onlyTable(model);

    expect(table.repeat).toEqual({ type: "month", mode: "template", sourceFieldId: month?.id });
    expect(table.rows).toHaveLength(0);
  });

  it("copies table-scoped help onto the table block", () => {
    const table = onlyTable(render("@version(2)\n@help(逐欄確認)\n| $check(正常)"));
    expect(table.help).toEqual({ text: "逐欄確認" });
    expect(table.columns[0]?.label).toBe("正常");
  });

  it("does not render comments or directives as content blocks", () => {
    const model = render("@version(2)\n這只是註解\n@info(說明)\n$text(內容)");
    expect(model.blocks).toHaveLength(1);
    expect(model.blocks[0]?.kind).toBe("field");
  });

  it("does not modify the input CupDocument", () => {
    const document = parseCup("@version(2)\n@help(說明)\n$text(內容)").document;
    deepFreeze(document);

    expect(() => createRenderModel(document)).not.toThrow();
    expect(document.nodes[1]).toHaveProperty("target");
  });
});

function render(source: string) {
  return createRenderModel(parseCup(source).document);
}

function renderFields(model: ReturnType<typeof createRenderModel>): RenderField[] {
  return model.blocks.flatMap((block) =>
    block.kind === "field"
      ? [block.field]
      : block.rows.flatMap((row) => row.cells.flatMap((cell) => cell.field === null ? [] : [cell.field])),
  );
}

function onlyTable(model: ReturnType<typeof createRenderModel>): RenderTableBlock {
  return only(model.blocks.filter((block): block is RenderTableBlock => block.kind === "table"));
}

function only<T>(items: readonly T[]): T {
  expect(items).toHaveLength(1);
  return items[0]!;
}

function deepFreeze(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }
  Object.freeze(value);
}
