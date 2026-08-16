import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  DiagnosticCodes,
  parseCup,
  type CupNode,
  type Diagnostic,
  type DirectiveNode,
  type FieldNode,
  type ParseResult,
  type TableNode,
} from "../src/index.js";

describe("parseCup", () => {
  it("reads basic directives", () => {
    const result = parseCup(`@version(2)
@title(消防設備月檢表)
@info(每月執行消防設備檢查)`);

    expect(result.success).toBe(true);
    expect(result.document.version).toBe(2);
    const directives = directiveNodes(result.document.nodes);
    expect(directives).toHaveLength(3);
    expect(directives[1]?.arguments[0]).toBe("消防設備月檢表");
    expect(directives[2]?.arguments[0]).toBe("每月執行消防設備檢查");
  });

  it("preserves ordinary text as a non-rendering comment", () => {
    const result = parseCup("這是註解\n@version(2)");

    expect(result.document.nodes[0]).toMatchObject({ kind: "comment", text: "這是註解" });
    expect(result.success).toBe(true);
  });

  it("reads a single-cell table without a trailing pipe", () => {
    const result = parseCup("@version(2)\n| $date(日期)");

    const table = only(tableNodes(result.document.nodes));
    const field = only(table.columns).field;
    expect(field).toMatchObject({ fieldType: "date", label: "日期" });
    expect(result.success).toBe(true);
  });

  it("groups contiguous table rows and cells", () => {
    const result = parseCup("@version(2)\n| $date(日期)\n| $text(設備名稱) | $number(壓力)");

    const table = only(tableNodes(result.document.nodes));
    expect(table.rows).toHaveLength(0);
    expect(table.columns.map((column) => column.field?.fieldType)).toEqual([
      "date",
      "text",
      "number",
    ]);
    expect(result.success).toBe(true);
  });

  it.each(["| --- |", "| — |"])("rejects Markdown separator row %s", (row) => {
    const result = parseCup(`@version(2)\n${row}`);

    expectDiagnostic(result, DiagnosticCodes.MarkdownSeparator);
    expect(result.success).toBe(false);
  });

  it("rejects literal label cells", () => {
    const result = parseCup("@version(2)\n| 日期 | $date(日期)");

    expectDiagnostic(result, DiagnosticCodes.InvalidTableCell);
    const table = only(tableNodes(result.document.nodes));
    expect(table.columns[0]?.field).toBeNull();
    expect(table.columns[1]?.field).not.toBeNull();
  });

  it("diagnoses a trailing pipe as an empty cell", () => {
    expectDiagnostic(parseCup("@version(2)\n| $date(日期) |"), DiagnosticCodes.TrailingTableCell);
  });

  it("binds repeat to the next table without expanding rows", () => {
    const result = parseCup(`@version(2)
| $month(月份)

@repeat(month)
| $day(日) | $check(正常)`);

    const tables = tableNodes(result.document.nodes);
    expect(tables).toHaveLength(2);
    const repeatedTable = tables[1]!;
    expect(repeatedTable.repeat?.type).toBe("month");
    expect(repeatedTable.repeat?.monthSource.fieldType).toBe("month");
    expect(repeatedTable.rows).toHaveLength(0);
    expect(repeatedTable.repeat?.source.target).toBe(repeatedTable);
    expect(result.success).toBe(true);
  });

  it("allows repeat to skip comments and blank lines", () => {
    const result = parseCup("@version(2)\n$month(月份)\n@repeat(month)\n這是註解\n\n| $day(日)");

    expect(only(tableNodes(result.document.nodes)).repeat).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("diagnoses repeat without a following table", () => {
    expectDiagnostic(
      parseCup("@version(2)\n$month(月份)\n@repeat(month)"),
      DiagnosticCodes.MissingRepeatTarget,
    );
  });

  it("diagnoses an unsupported repeat type", () => {
    expectDiagnostic(
      parseCup("@version(2)\n@repeat(week)\n| $day(日)"),
      DiagnosticCodes.UnsupportedRepeatType,
    );
  });

  it("diagnoses a missing month source", () => {
    const result = parseCup("@version(2)\n@repeat(month)\n| $day(日)");

    expectDiagnostic(result, DiagnosticCodes.MissingMonthSource);
    expect(only(tableNodes(result.document.nodes)).repeat).toBeUndefined();
  });

  it("does not bind an ambiguous repeat target", () => {
    const result = parseCup("@version(2)\n$month(月份)\n@repeat(month)\n@repeat(month)\n| $day(日)");

    expect(result.diagnostics.filter((item) => item.code === DiagnosticCodes.AmbiguousTableDirective)).toHaveLength(2);
    expect(only(tableNodes(result.document.nodes)).repeat).toBeUndefined();
  });

  it("binds help text and image to a standalone field", () => {
    const result = parseCup("@version(2)\n@help(確認壓力表,images/pressure.png)\n$number(壓力)");

    const field = only(fieldNodes(result.document.nodes));
    expect(field.help?.text).toBe("確認壓力表");
    expect(field.help?.imagePath).toBe("images/pressure.png");
    expect(field.help?.source.target).toBe(field);
    expect(result.success).toBe(true);
  });

  it("binds help to the next table as required by the v2 specification", () => {
    const result = parseCup("@version(2)\n@help(逐欄確認)\n| $check(正常)");

    const table = only(tableNodes(result.document.nodes));
    expect(table.help?.text).toBe("逐欄確認");
    expect(table.columns[0]?.field?.help).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it("diagnoses help without a target", () => {
    expectDiagnostic(parseCup("@version(2)\n@help(沒有目標)"), DiagnosticCodes.MissingHelpTarget);
  });

  it("does not guess between ambiguous help directives", () => {
    const result = parseCup("@version(2)\n@help(A)\n@help(B)\n$text(值)");

    expect(result.diagnostics.filter((item) => item.code === DiagnosticCodes.AmbiguousHelpTarget)).toHaveLength(2);
    expect(only(fieldNodes(result.document.nodes)).help).toBeUndefined();
  });

  it("unescapes all frozen v2 escapes", () => {
    const result = parseCup(
      "@version(2)\n$text(設備\\,名稱)\n$text(A\\|B)\n$text(請輸入 \\(必要\\) 資料)\n$text(字面 \\@)\n$text(C:\\\\CheckUp)",
    );

    expect(fieldNodes(result.document.nodes).map((field) => field.label)).toEqual([
      "設備,名稱",
      "A|B",
      "請輸入 (必要) 資料",
      "字面 @",
      "C:\\CheckUp",
    ]);
    expect(result.success).toBe(true);
  });

  it("splits only on unescaped table pipes", () => {
    const result = parseCup("@version(2)\n| $text(A\\|B) | $check(正常)");

    const table = only(tableNodes(result.document.nodes));
    expect(table.columns).toHaveLength(2);
    expect(table.columns[0]?.field?.label).toBe("A|B");
    expect(result.success).toBe(true);
  });

  it("separates table column declarations from editable data rows", () => {
    const result = parseCup("@version(2)\n| $text(代碼) | $text(金額)\n| A\\|B | $100");
    const table = only(tableNodes(result.document.nodes));

    expect(table.id).toBe("table-1");
    expect(table.columns.map((column) => column.id)).toEqual(["table-1-field-1", "table-1-field-2"]);
    expect(table.rows[0]).toMatchObject({
      id: "table-1-row-1",
      cells: [
        { id: "table-1-row-1-cell-1", fieldId: "table-1-field-1", value: "A|B" },
        { id: "table-1-row-1-cell-2", fieldId: "table-1-field-2", value: "$100" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("diagnoses unsupported escapes in table data values", () => {
    expectDiagnostic(
      parseCup("@version(2)\n| $text(備註)\n| 不支援\\nescape"),
      DiagnosticCodes.InvalidEscape,
    );
  });

  it("diagnoses an unescaped comma as multiple field arguments", () => {
    const result = parseCup("@version(2)\n$text(設備,名稱)");

    expectDiagnostic(result, DiagnosticCodes.InvalidArgumentCount);
    expect(only(fieldNodes(result.document.nodes)).arguments).toEqual(["設備", "名稱"]);
  });

  it.each(["$text(A\\nB)", "$text(A\\$B)", "$text(A\\"])(
    "diagnoses invalid or dangling escape in %s",
    (field) => {
      expectDiagnostic(parseCup(`@version(2)\n${field}`), DiagnosticCodes.InvalidEscape);
    },
  );

  it("diagnoses an unclosed parenthesis", () => {
    const diagnostic = expectDiagnostic(
      parseCup("@version(2)\n$text(未關閉"),
      DiagnosticCodes.UnclosedParenthesis,
    );
    expect(diagnostic.source.start.line).toBe(2);
  });

  it("diagnoses an unexpected closing parenthesis", () => {
    expectDiagnostic(
      parseCup("@version(2)\n$text(值))"),
      DiagnosticCodes.UnexpectedClosingParenthesis,
    );
  });

  it("diagnoses unknown directive and field names case-sensitively", () => {
    const result = parseCup("@version(2)\n@unknown(value)\n$Date(日期)");

    expectDiagnostic(result, DiagnosticCodes.UnknownDirective);
    expectDiagnostic(result, DiagnosticCodes.UnknownField);
  });

  it("diagnoses a malformed directive", () => {
    const result = parseCup("@version(2)\n@title 缺少左括號");

    expectDiagnostic(result, DiagnosticCodes.MalformedDirective);
    expect(result.document.nodes[1]?.kind).toBe("invalid");
  });

  it("diagnoses a malformed field", () => {
    const result = parseCup("@version(2)\n$text 缺少左括號");

    expectDiagnostic(result, DiagnosticCodes.MalformedField);
    expect(result.document.nodes[1]?.kind).toBe("invalid");
  });

  it("recovers after malformed syntax", async () => {
    const source = await readFixture("invalid/recovery.cup");
    const result = parseCup(source);

    expect(result.success).toBe(false);
    const table = only(tableNodes(result.document.nodes));
    expect(table.columns).toHaveLength(2);
    expect(table.columns.every((column) => column.field !== null)).toBe(true);
  });

  it("preserves one-based line/column and absolute UTF-16 offset", () => {
    const source = "@version(2)\r\n  |   $date(日期)";
    const field = only(only(tableNodes(parseCup(source).document.nodes)).columns).field;

    expect(field?.source.start).toMatchObject({ line: 2, column: 7, offset: source.indexOf("$") });
  });

  it("diagnoses version and title document constraints", () => {
    const result = parseCup("@title(A)\n@version(2)\n@version(2)\n@title(B)");

    expectDiagnostic(result, DiagnosticCodes.VersionMustBeFirst);
    expectDiagnostic(result, DiagnosticCodes.DuplicateVersion);
    expectDiagnostic(result, DiagnosticCodes.DuplicateTitle);
  });

  it.each(["../pressure.png", "images\\pressure.png", "/images/pressure.png", "C:/images/pressure.png"])(
    "diagnoses unsafe help image path %s",
    (path) => {
      expectDiagnostic(
        parseCup(`@version(2)\n@help(說明,${path})\n$text(欄位)`),
        DiagnosticCodes.InvalidResourcePath,
      );
    },
  );

  it("parses the complete TypeScript fixture", async () => {
    const result = parseCup(await readFixture("valid/fire-equipment-monthly-v2.cup"));

    expect(result.success, result.diagnostics.map((item) => item.message).join("\n")).toBe(true);
    expect(result.document.fields).toHaveLength(8);
    expect(tableNodes(result.document.nodes)).toHaveLength(5);
    expect(tableNodes(result.document.nodes).filter((table) => table.repeat !== undefined)).toHaveLength(1);
  });

  it("parses the repository equipment example", async () => {
    const source = await readFile(new URL("../examples/equipment-monthly-v2.cup", import.meta.url), "utf8");
    const result = parseCup(source);

    expect(result.success, result.diagnostics.map((item) => item.message).join("\n")).toBe(true);
    expect(tableNodes(result.document.nodes).filter((table) => table.repeat !== undefined)).toHaveLength(1);
    expect(tableNodes(result.document.nodes).filter((table) => table.help !== undefined)).toHaveLength(1);
  });
});

function directiveNodes(nodes: readonly CupNode[]): DirectiveNode[] {
  return nodes.filter((node): node is DirectiveNode => node.kind === "directive");
}

function fieldNodes(nodes: readonly CupNode[]): FieldNode[] {
  return nodes.filter((node): node is FieldNode => node.kind === "field");
}

function tableNodes(nodes: readonly CupNode[]): TableNode[] {
  return nodes.filter((node): node is TableNode => node.kind === "table");
}

function only<T>(items: readonly T[]): T {
  expect(items).toHaveLength(1);
  return items[0]!;
}

function expectDiagnostic(result: ParseResult, code: Diagnostic["code"]): Diagnostic {
  const diagnostics = result.diagnostics.filter((diagnostic) => diagnostic.code === code);
  expect(diagnostics).toHaveLength(1);
  return diagnostics[0]!;
}

async function readFixture(path: string): Promise<string> {
  return readFile(new URL(`./fixtures/${path}`, import.meta.url), "utf8");
}
