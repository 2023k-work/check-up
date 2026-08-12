import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCup, type CupNode, type Diagnostic, type FieldNode } from "../src/index.js";

describe("C# reference parity fixtures", () => {
  it("matches the normalized valid fixture semantics", async () => {
    const normalized = await parseNormalized("valid.cup");

    expect(normalized).toEqual({
      version: 2,
      fields: ["month:月份", "day:日", "text:A|B"],
      nodes: [
        "comment:這是註解",
        "directive:version:2",
        "table:month:月份",
        "directive:repeat:month",
        "directive:help:逐欄確認|images/help.png",
        "table:day:日,text:A|B:repeat=month:help=逐欄確認|images/help.png",
      ],
      diagnostics: [],
    });
  });

  it("matches the normalized invalid fixture semantics and locations", async () => {
    const normalized = await parseNormalized("invalid.cup");

    expect(normalized).toEqual({
      version: 2,
      fields: ["unknown:值"],
      nodes: [
        "directive:version:2",
        "directive:repeat:month",
        "directive:help:A",
        "directive:help:B",
        "table:<invalid>,unknown:值,<invalid>",
      ],
      diagnostics: [
        "CUP010@5:3",
        "CUP007@5:8",
        "CUP012@5:21",
        "CUP015@2:1",
        "CUP018@3:1",
        "CUP018@4:1",
      ],
    });
  });
});

interface NormalizedParseResult {
  readonly version: number | null;
  readonly fields: readonly string[];
  readonly nodes: readonly string[];
  readonly diagnostics: readonly string[];
}

async function parseNormalized(name: string): Promise<NormalizedParseResult> {
  const source = await readFile(new URL(`./fixtures/parity/${name}`, import.meta.url), "utf8");
  const result = parseCup(source);
  return {
    version: result.document.version,
    fields: result.document.fields.map(normalizeField),
    nodes: result.document.nodes.map(normalizeNode),
    diagnostics: result.diagnostics.map(normalizeDiagnostic),
  };
}

function normalizeNode(node: CupNode): string {
  switch (node.kind) {
    case "comment":
      return `comment:${node.text}`;
    case "invalid":
      return "invalid";
    case "field":
      return `field:${normalizeField(node)}`;
    case "directive":
      return `directive:${node.directiveType}:${node.arguments.join("|")}`;
    case "table": {
      const fields = node.rows
        .flatMap((row) => row.cells)
        .map((cell) => (cell.field === null ? "<invalid>" : normalizeField(cell.field)))
        .join(",");
      const repeat = node.repeat === undefined ? "" : `:repeat=${node.repeat.type}`;
      const help = node.help === undefined
        ? ""
        : `:help=${node.help.text}${node.help.imagePath === undefined ? "" : `|${node.help.imagePath}`}`;
      return `table:${fields}${repeat}${help}`;
    }
  }
}

function normalizeField(field: FieldNode): string {
  return `${field.fieldType}:${field.label ?? "<null>"}`;
}

function normalizeDiagnostic(diagnostic: Diagnostic): string {
  return `${diagnostic.code}@${diagnostic.source.start.line}:${diagnostic.source.start.column}`;
}
