# CheckUp (`.cup`) Format v2

Status: frozen implementation reference  
Document language: Traditional Chinese  
File type: UTF-8 plain text (`.cup`)

This document is the normative reference for implementing a CheckUp v2 parser, validator, renderer, and canonical hash calculator. The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative.

## 1. Design model

CheckUp v2 has four source-level constructs:

1. `@name(...)` — a **directive**. It controls document or rendering behavior and never stores user-entered data.
2. `$name(...)` — a **field declaration**. It declares a renderable, fillable value.
3. A line whose first structural character is `|` — a **table declaration row** containing one or more fields.
4. Any other non-empty text — a **comment** for source readers. It MUST NOT be rendered.

`@` and `$` are deliberately separate namespaces. A parser MUST NOT interpret an `@` directive as a field or a `$` field as a directive.

Blank lines are insignificant except that they make the source easier to read. Comments and blank lines do not break the association between a pending table directive and the next table.

## 2. Lexical rules

### 2.1 Calls and arguments

Directives and fields use the form:

```text
@name(argument1,argument2)
$name(argument1,argument2)
```

Names are case-sensitive ASCII identifiers. v2 recognizes only the names listed in this document. Arguments are comma-separated text. Structural whitespace around a complete directive, field, table cell, or argument SHOULD be trimmed; whitespace inside an argument MUST otherwise be preserved.

### 2.2 Escape

Backslash (`\`) is the only escape character. It escapes exactly the immediately following structural character. The complete v2 escape set is:

| Source | Parsed character |
| --- | --- |
| `\@` | `@` |
| `\(` | `(` |
| `\)` | `)` |
| `\,` | `,` |
| `\|` | `|` |
| `\\` | `\` |

The table above is explanatory Markdown; it is not `.cup` syntax.

No other escape sequences exist. In particular, `\n`, `\t`, and `\uXXXX` MUST NOT be decoded. A validator SHOULD reject an unsupported or dangling escape rather than guess its meaning.

Escapes are processed while scanning, before splitting arguments on `,` or table cells on `|`. For example, `A\,B` is one argument with value `A,B`, and `A\|B` remains one cell with value `A|B`.

### 2.3 Comments

Ordinary text is a non-rendering comment:

```text
這行只協助原始檔閱讀者，不會出現在表單中。
```

A renderer MUST discard comments. Comments MUST NOT become headings, paragraphs, labels, table cells, or stored values. Markdown markers such as `#` and `>` have no special v2 meaning.

## 3. Directives

### 3.1 `@version(2)`

- Declares the source format version.
- MUST be the first meaningful construct (comments and blank lines may precede it).
- MUST occur exactly once.
- Its only valid v2 argument is `2`.

### 3.2 `@title(text)`

- Declares the visible document title.
- Takes exactly one non-empty text argument.
- MUST occur at most once.
- A renderer displays it as the document title.

### 3.3 `@info(text)`

- Declares visible document-level explanatory text.
- Takes exactly one text argument.
- A renderer displays it as information, not as an editable field.

### 3.4 `@repeat(month)`

- Takes exactly the literal argument `month`.
- Applies only to the **next table** in source order.
- Comments and blank lines between the directive and that table are ignored.
- The month source is the document's **first `$month(...)` field**.
- The validator MUST report an error if there is no `$month` field, if no following table exists, or if another table-scoped directive makes the target ambiguous.
- The renderer uses the selected month to create the target table's monthly day instances. `@repeat(month)` is behavior; it is not copied into each generated row and stores no value.

### 3.5 `@help(text,path.png)`

- Attaches help content to the next renderable field or table, according to source order.
- The first argument is required explanatory text.
- The second argument is an optional image resource path.
- Valid arities are therefore `@help(text)` and `@help(text,path.png)`.
- The image is help content, not a `$photo` value.
- A validator MUST report an error if no following renderable target exists.

## 4. Fields

All v2 fields use `$type(label)`. The label is carried by the field itself and is rendered with its input control. A table cell MUST contain exactly one field declaration; literal label cells are forbidden.

| Field | Intended value/control |
| --- | --- |
| `$date(label)` | Calendar date |
| `$month(label)` | Calendar month; the first instance also supplies `@repeat(month)` |
| `$day(label)` | Day of month |
| `$time(label)` | Time of day |
| `$check(label)` | Independent check state |
| `$text(label)` | Free text |
| `$number(label)` | Numeric input |
| `$photo(label)` | Photo resource reference |
| `$signature(label)` | Handwritten-signature image resource reference |

Each field takes exactly one non-empty label argument. Separate facts require separate fields. For example, pressure, appearance, and seal are three `$check` fields, not extra arguments packed into one field.

`$photo` and `$signature` store references to resource files located in the same document folder tree as the `.cup` file. Paths are relative to the `.cup` file, use `/`, and MUST remain inside that folder tree; absolute paths and traversal such as `../` are invalid. A signature image is a handwritten signature artifact, not a cryptographic digital signature or identity proof.

## 5. Tables

A table is one or more contiguous declaration rows. Every row:

- MUST start with an unescaped `|` after optional indentation;
- contains one or more cells separated by unescaped `|`;
- MUST NOT use a Markdown separator row such as `| --- |`;
- does **not** require, and canonical source SHOULD omit, a trailing `|`;
- MUST contain exactly one recognized `$field(...)` in every cell;
- MUST NOT contain extra literal label cells.

Valid:

```text
| $day(日) | $time(時間)
| $check(壓力)
```

Invalid:

```text
| --- | ---
| 日期 | $date(日期)
| $check(壓力) |
```

The last line is invalid canonical v2 because it creates an empty trailing cell. Parsers SHOULD diagnose it rather than silently discard the cell.

For the v2 declaration format, a table describes layout and fields; filled values belong to the document/runtime data model associated with those fields. Implementations MUST NOT reinterpret ordinary source text as filled table data.

## 6. Parsing and validation order

A conforming implementation SHOULD follow this order:

1. Decode as UTF-8 and normalize source line endings for parsing.
2. Scan each line while honoring backslash escapes.
3. Classify the line as blank, comment, directive, standalone field, or table row.
4. Parse names and arguments without prematurely splitting escaped delimiters.
5. Build an AST that keeps directives distinct from fields and tables.
6. Bind `@help` and `@repeat(month)` to their next eligible target.
7. Run document constraints (`@version`, uniqueness, known names, arity).
8. Run table and resource-path validation.
9. Render only directives with visible meaning, fields, and tables; omit comments.

Unknown directives and unknown field types are validation errors in v2. Implementations MUST NOT silently render or store them as known constructs.

A minimal AST may use:

```text
Document
  version
  title?
  info[]
  blocks[]
    Help
    RepeatMonth
    Field
    Table
      Row[]
        Field[]
    Comment
```

Bindings SHOULD be resolved explicitly in the validated model so the renderer does not need to infer source adjacency again.

## 7. Canonical form and hash

The source format version and canonical-hash version are independent. CheckUp Format v2 retains the established canonical hash profile whose fixed first line is:

```text
checkup-hash-v1
```

There is no `$sha256` field or `@sha256` directive in the v2 vocabulary. Hashes are computed and verified by the implementation or surrounding record format; they are not represented by inventing an extra v2 source tag.

### 7.1 Scope

Hash the parsed record data in field order, not the raw `.cup` bytes and not the file's storage location. For each field, emit its one-based index and type, followed by either its normalized value or resource digest:

```text
checkup-hash-v1
1.type=day
1.value=01
2.type=time
2.value=08:15
3.type=check
3.value=1
4.type=photo
4.sha256=<64-lowercase-hex-resource-digest>
5.type=signature
5.sha256=<64-lowercase-hex-resource-digest>
```

Canonical lines are joined with LF (`\n`), including a final LF. Encode the result as UTF-8 without BOM, then compute SHA-256. The output is exactly 64 lowercase hexadecimal characters.

### 7.2 Value normalization

Before emitting `.value=`:

1. Use the parsed/unescaped value, not its source escape spelling.
2. Normalize Unicode to NFC.
3. Normalize CRLF and CR inside values to LF.
4. Remove outer cell whitespace.
5. Preserve internal whitespace and case.
6. Emit an empty field as `N.value=`; never omit it.

Validators SHOULD require canonical representations for typed values instead of accepting multiple spellings and silently converting them. Established representations include `YYYY-MM` for month, two-digit `DD` for day, `HH:MM` for time, and `0`, `1`, or empty for check state.

### 7.3 Resources

For `$photo` and `$signature`:

1. Resolve the relative reference within the `.cup` document folder tree.
2. Require the file to exist and be readable.
3. Compute SHA-256 over the resource's exact bytes.
4. Emit `N.sha256=<digest>`; do not emit its path in canonical data.

If a required resource is missing or unreadable, hash computation MUST fail with a `Missing Resource` error. Moving or renaming a resource while updating its reference leaves the record hash unchanged; changing its bytes changes the hash.

### 7.4 Exclusions

The canonical hash excludes:

- the `.cup` file path and file name;
- photo and signature path strings (their byte digests are included instead);
- comments;
- display-only title, info, and help content;
- the hash output itself and any external storage metadata.

Thus identical parsed data and identical resource bytes produce the same hash regardless of where the document folder is stored.

## 8. Conformance checklist

A v2 implementation is conforming only if it:

- keeps `@` directives separate from `$` fields;
- supports exactly the directives and fields listed above;
- never renders ordinary comments;
- rejects Markdown table separator rows and literal label cells;
- binds monthly repeat to the next table and the first `$month`;
- handles only the six frozen escape sequences;
- resolves resources safely relative to the `.cup` folder;
- calculates canonical hashes from parsed values and resource bytes, not paths or raw source formatting.

See [`examples/equipment-monthly-v2.cup`](examples/equipment-monthly-v2.cup) for a valid source example.
