# CheckUp

**A simple, human-readable format for checklists, inspection forms, and structured records.**

CheckUp documents are UTF-8 plain-text files with the `.cup` extension. They are easy to write, review, parse, render as interactive forms, and keep in version control. The format is independent of any particular editor or renderer.

CheckUp is its own format—not a Markdown extension.

Try the [CheckUp Web Editor](https://2023k-work.github.io/check-up/) or continue below for the format overview and Quick Start.

## Why CheckUp?

Checklists and inspection forms often live in spreadsheets, PDFs, word-processing documents, paper forms, or application-specific systems. Those are useful tools, but the form definition itself is not always easy to edit as plain text, compare in version control, parse programmatically, or exchange between renderers.

CheckUp makes that definition a small, portable text document:

- people can read and edit the source;
- parsers can turn it into a structured document;
- renderers can choose the right controls for each field; and
- teams can store and review changes with their existing tools.

See [Why CheckUp—and when to use it](docs/why-checkup.md) for selection criteria, limitations, and a balanced comparison with spreadsheets, CSV, JSON, YAML, Markdown, and XLSForm.

## Quick example

This complete CheckUp Format v2 document describes a daily equipment inspection:

```cup
@version(2)
@title(設備每日巡檢)
@info(每日開機前完成設備檢查，發現異常時通知主管。)

| $date(日期) | $time(時間)
| $check(設備外觀正常) | $check(安全護罩固定)
| $check(緊急停止按鈕正常) | $number(壓力 MPa)
| $text(異常說明)
| $photo(現場照片) | $signature(檢查人員)
```

Save it as `equipment-daily.cup`. A renderer can use the field declarations to produce date and time inputs, checkboxes, a numeric input, text and photo controls, and a signature control.

## How it works

CheckUp source has three visible structural ideas.

### Directives

Directives begin with `@` and describe the document or the behavior of later content:

```cup
@version(2)
@title(每日巡檢)
@info(每天開機前進行檢查)
$check(設備正常)
```

`@version(2)` must be the first meaningful construct. Comments and blank lines may appear before it.

### Fields

Fields begin with `$`. Each field declares a value schema and carries its own label. A declaration never stores the filled value itself:

```cup
@version(2)
$date(日期)
$check(設備外觀)
$text(異常說明)
```

### Tables

A line beginning with `|` belongs to a table. Leading `$field(...)` cells declare the columns; following rows store values in the matching cells:

```cup
@version(2)
| $date(日期) | $time(時間)
| 2026-08-16 | 09:00
| 2026-08-17 | 09:15
```

CheckUp tables are not Markdown tables. Do not add a `| --- |` separator row or trailing `|`. Declaration cells contain exactly one field, and each data row must have the same number of cells as the declared columns. Values that contain syntax characters use the standard CheckUp escapes, such as `A\|B` for a literal `|`.

## Five-minute tutorial

1. Create a UTF-8 text file named `first-check.cup`.
2. Make `@version(2)` its first meaningful construct.
3. Add a visible document name with `@title(我的第一份檢查表)`.
4. Explain when to use it with `@info(開始工作前完成檢查)`.
5. Declare typed table columns such as `$date(日期)`, `$time(時間)`, `$check(工作區域整潔)`, and `$text(備註)`.
6. Add a data row below the declarations; actual values belong in its cells.
7. Add more data rows with the same number of cells when needed.
8. Put `@help(請確認通道沒有障礙物)` immediately before the field or table it should explain.

The result is a complete document:

```cup
@version(2)
@title(我的第一份檢查表)
@info(開始工作前完成檢查)

@help(請確認通道沒有障礙物)
| $date(日期) | $time(時間) | $check(逃生通道暢通) | $text(備註)
| 2026-08-16 | 09:00 | 正常 | 無異常
```

9. For a monthly template, declare a month and place `@repeat(month)` before the table to repeat:

```cup
@version(2)
@title(月度檢查表)

| $month(月份)
| 2026-08

@repeat(month)
| $day(日) | $check(已完成)
| 1 | 正常
| 2 | 異常
```

`@repeat(month)` applies only to the next table. It uses the document's first `$month(...)` field as its month source; it does not repeat standalone fields.

10. Pass the source to a CheckUp parser, then pass the parsed `CupDocument` to a renderer:

```typescript
import { parseCup } from "@checkup/parser";
import { createRenderModel } from "@checkup/renderer";

const result = parseCup(source);
if (!result.success) {
  console.error(result.diagnostics);
}

const renderDocument = createRenderModel(result.document);
```

The parser is fault-tolerant and returns a partial document alongside diagnostics. Applications should check `result.success` before treating a document as valid.

## Common fields

Format v2 supports these field declarations. Every field takes exactly one non-empty label.

| Field | Use | Example |
| --- | --- | --- |
| `$date` | Calendar date | `$date(檢查日期)` |
| `$month` | Calendar month and the month source for repeat | `$month(巡檢月份)` |
| `$day` | Day of the month | `$day(日)` |
| `$time` | Time of day | `$time(檢查時間)` |
| `$check` | Independent checked state | `$check(護罩固定)` |
| `$text` | Free text | `$text(異常說明)` |
| `$number` | Numeric input | `$number(壓力 MPa)` |
| `$photo` | Photo resource reference | `$photo(現場照片)` |
| `$signature` | Handwritten-signature image reference | `$signature(檢查人員)` |

`$photo` and `$signature` refer to resources associated with filled record data. A signature is a handwritten-signature artifact, not cryptographic proof of identity.

## Directives

| Directive | Purpose |
| --- | --- |
| `@version(2)` | Declares Format v2; required exactly once and first among meaningful constructs. |
| `@title(text)` | Sets the visible document title; allowed at most once. |
| `@info(text)` | Adds visible document-level information. Multiple directives remain in source order. |
| `@help(text)` | Attaches help to the next renderable field or table. |
| `@help(text,path.png)` | Adds the same help with an optional image. |
| `@repeat(month)` | Marks the next table as a monthly repeat template. |

For example, this help text and image apply to the following table:

```cup
@version(2)
@help(確認壓力表指針位於綠色區域,images/pressure.png)
| $number(壓力 MPa) | $check(壓力正常)
```

Help image paths are relative to the `.cup` file, use `/`, and must stay inside the document folder tree. Absolute paths, backslashes, `.` segments, and `..` traversal are invalid.

## Real-world examples

### Factory inspection

Factory inspections can combine measurements, independent checks, evidence, and sign-off:

```cup
@version(2)
@title(空壓機每日巡檢)
@info(開機前檢查；任何不合格項目都應記錄於異常說明。)

| $date(日期) | $time(時間) | $text(設備編號)
| $number(壓力 MPa) | $check(壓力正常)
| $check(外觀正常) | $check(安全護罩固定)
| $text(異常說明)
| $photo(現場照片) | $signature(巡檢人員)
```

See the more detailed [monthly equipment example](examples/equipment-monthly-v2.cup), which also demonstrates repeat behavior, help images, and escaping.

### Daily checklist

```cup
@version(2)
@title(旅行前確認)
@info(離家前逐項確認)

| $check(證件) | $check(車票)
| $check(充電器) | $check(藥品)
| $text(補充事項)
```

### Approval and record

```cup
@version(2)
@title(維修完成紀錄)

| $date(完成日期) | $text(工單編號)
| $text(處理摘要)
| $photo(完成照片) | $signature(確認人員)
```

## Design principles

- **Human-readable:** the source remains understandable without a special editor.
- **Minimal syntax:** a small set of constructs covers document metadata, fields, and layout.
- **Plain-text first:** `.cup` files are portable UTF-8 text.
- **Renderer-independent:** the format describes intent, not a particular UI toolkit.
- **Parser-friendly:** directives, fields, and table structure are explicit.
- **Version-control friendly:** source changes are reviewable as text.
- **Portable:** form definitions are not tied to one application.
- **Explicit structure:** visible content and stored values use defined constructs.

Ordinary non-empty text is a source comment. Renderers do not display it. Content intended for users must be expressed with visible syntax such as `@title(...)`, `@info(...)`, field labels, or `@help(...)`.

## Escaping

Backslash (`\`) escapes exactly one following structural character. Format v2 defines only these escapes:

| Source | Parsed character |
| --- | --- |
| `\@` | `@` |
| `\(` | `(` |
| `\)` | `)` |
| `\,` | `,` |
| `\|` | `|` |
| `\\` | `\` |

Escapes are processed before arguments or table cells are split. For example, `$text(區域 A\|B)` has one label containing a literal `|`, `$number(壓力\, MPa)` has one label containing a comma, and a data cell written as `A\|B` stores the value `A|B`. Other sequences such as `\n`, `\t`, and `\uXXXX` are not supported escapes.

## Architecture

```text
.cup source
    ↓
@checkup/parser
    ↓
CupDocument + diagnostics
    ├─ Design mode (Schema mutations)
    ├─ Fill mode → @checkup/renderer → semantic cell edits
    └─ Source mode (complete .cup source)
```

The parser recognizes `.cup` syntax, validates v2 rules, and resolves directive targets. The Web Editor keeps one shared source/document session for Design, Fill, and Source modes; switching modes never creates another document copy. The framework-neutral renderer consumes `CupDocument` for Fill mode, while source-range mutators apply value or Schema edits without a reverse parser. Mode permissions can hide Design and Source for fill-only deployments.

## Packages

| Package | Responsibility | Input → output |
| --- | --- | --- |
| `@checkup/parser` | Fault-tolerant parsing, validation, AST construction, and directive binding | `.cup` string → `ParseResult` with `CupDocument` and diagnostics |
| `@checkup/renderer` | Framework-neutral render model creation and field-control descriptors | `CupDocument` → `RenderDocument` |
| `@checkup/web` | Three-mode browser editor with shared state, Schema design, record filling, source editing, and live diagnostics | Shared `.cup` source ↔ Design / Fill / Source views |

The parser's public API is exported from [`src/index.ts`](src/index.ts); renderer code lives in [`packages/renderer`](packages/renderer), and the Web Editor lives in [`apps/web`](apps/web).

### Local development

Node.js 20 or newer is required.

```sh
npm install
npm run typecheck
npm test
npm run build
```

Additional package checks are available as `npm run typecheck:renderer`, `npm run test:renderer`, `npm run typecheck:web`, `npm run test:web`, and `npm run build:web`. Start the local editor with:

```sh
npm run dev:web
```

## Status

CheckUp is under active development.

- **Format v2:** the repository contains a frozen normative implementation reference.
- **Parser:** implemented in strict TypeScript with validation, diagnostics, recovery, and directive binding.
- **Renderer:** a framework-neutral `RenderDocument` layer and field registry are implemented.
- **Web Editor:** Design, Fill, and Source modes share one document session. Design supports table column add/delete/reorder/type/label edits plus table help and monthly repeat; Fill writes only data-row cells; Source retains complete advanced content. Persistence and submission workflows remain future work.

## Roadmap

```text
Format v2 ✓
    ↓
Parser ✓
    ↓
Renderer core ✓
    ↓
Three-mode Web Editor ✓
    ↓
Complete interactive record workflows
```

Near-term work can build on the current layers with additional renderer implementations, record-value handling, persistence, richer editor workflows, and conformance examples. No release dates are implied by this outline.

## Contributing

Issues and pull requests are welcome. Useful contributions include parser and renderer tests, valid and invalid format examples, diagnostics improvements, UI renderers, and Web Editor improvements. Please keep behavioral changes aligned with the v2 specification and include tests where applicable.

## Specification

The [CheckUp Format v2 specification](CHECKUP_FORMAT_V2.md) is the normative reference for syntax, validation, resource paths, canonicalization, and hashing. This README is an introduction, not the language specification.

## License

CheckUp is available under the [MIT License](LICENSE).
