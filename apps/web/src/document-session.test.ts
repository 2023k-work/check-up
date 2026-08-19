import { describe, expect, it } from "vitest";
import { DocumentSession } from "./document-session.js";

const source = `@version(2)
保留這段 GUI 不處理的普通文字
| $month(月份)
| 2026-08

@help(每日填寫)
@repeat(month)
| $day(日) | $text(設備)
| 1 | FE-001
| 2 | FE-002`;

describe("DocumentSession", () => {
  it("uses fill as the default and keeps all modes on one source/document state", () => {
    const session = new DocumentSession(source);
    expect(session.snapshot.mode).toBe("fill");

    session.editCell({
      tableId: "table-2",
      rowId: "table-2-row-2",
      fieldId: "table-2-field-2",
      value: "FE-009",
    });
    session.setMode("source");
    expect(session.snapshot.source).toContain("| 2 | FE-009");

    session.setSource(session.snapshot.source.replace("$text(設備)", "$number(壓力)"));
    session.setMode("design");
    const table = session.snapshot.document.nodes.find((node) => node.kind === "table" && node.id === "table-2");
    expect(table?.kind === "table" ? table.columns[1]?.field?.fieldType : undefined).toBe("number");
  });

  it("supports add, update, reorder, delete, help, and repeat without losing outside source", () => {
    const session = new DocumentSession(source);
    session.mutateSchema("table-2", { kind: "add", fieldType: "check", label: "正常" });
    session.mutateSchema("table-2", {
      kind: "update",
      fieldId: "table-2-field-2",
      fieldType: "number",
      label: "壓力 MPa",
    });
    session.mutateSchema("table-2", { kind: "move", fieldId: "table-2-field-3", direction: -1 });
    session.mutateSchema("table-2", { kind: "delete", fieldId: "table-2-field-1" });
    session.setHelp("table-2", "確認壓力表");
    session.setRepeat("table-2", false);

    expect(session.snapshot.success).toBe(true);
    expect(session.snapshot.source).toContain("保留這段 GUI 不處理的普通文字");
    expect(session.snapshot.source).toContain("@help(確認壓力表)");
    expect(session.snapshot.source).not.toContain("@repeat(month)");
    expect(session.snapshot.source).toContain("| $check(正常) | $number(壓力 MPa)");
    expect(session.snapshot.source).toContain("|  | FE-001");
  });

  it("respects mode permissions", () => {
    const session = new DocumentSession(source, { design: false, source: false });
    expect(session.snapshot.mode).toBe("fill");
    expect(() => session.setMode("design")).toThrow("not permitted");
  });

  it("keeps invalid source verbatim so parser errors are recoverable", () => {
    const session = new DocumentSession(source);
    const invalid = "@version(2)\n| $text(Unclosed label";

    const snapshot = session.setSource(invalid);

    expect(snapshot.success).toBe(false);
    expect(snapshot.source).toBe(invalid);
    expect(snapshot.diagnostics.length).toBeGreaterThan(0);
  });
});
