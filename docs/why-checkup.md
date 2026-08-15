# Why CheckUp—and when to use it

**CheckUp is a human-readable, AI-friendly checklist and inspection form format designed for field inspections, recurring checklists, and structured records.**

CheckUp stores a form definition in a UTF-8 plain-text `.cup` file. Its syntax makes the distinction between document behavior (`@` directives) and fillable values (`$` fields) explicit, while remaining small enough to read and review without a dedicated editor.

“AI-friendly” means the source uses explicit, consistent constructs that a tool or model can inspect and explain. It does not mean every AI system already knows `.cup`, or that generated CheckUp source is valid without parsing and validation.

## The problem CheckUp is meant to solve

Many checklists begin as a spreadsheet, document, PDF, or application-specific form. Those tools may be the right final interface, but the form definition can become difficult to review as text, compare in version control, exchange between renderers, or validate with one shared parser.

CheckUp is useful when the form definition itself should be a small, portable source artifact:

- people need to read and edit it without understanding a general-purpose data schema;
- a parser must identify typed fillable fields such as dates, checks, numbers, photos, and signatures;
- the same parsed document may be rendered by more than one interface;
- changes should be visible in ordinary text diffs and code review; or
- an AI assistant should be able to identify the form's intent from explicit field and directive names.

CheckUp is its own format, not a Markdown extension. Format v2 deliberately has a narrow vocabulary rather than trying to describe every kind of form.

## Good fits

### Field and factory inspections

A `.cup` file can place independent checks, measurements, notes, photo references, and handwritten-signature image references in one form definition. This is a good fit when a team wants a Git-friendly source format and will provide its own renderer, storage, and operational workflow.

### Recurring checklists

Format v2 can mark the next table as a monthly template with `@repeat(month)`, using the document's first `$month(...)` field as the month source. This fits repeated daily checks arranged within a selected month. It is not a general scheduling or workflow engine.

### Structured records with a small set of field types

CheckUp is appropriate when the current v2 fields—date, month, day, time, check, text, number, photo, and signature—cover the data to collect. The explicit field declarations are easier to validate than free-form prose and less verbose than a custom JSON or YAML schema for simple inspection forms.

### Version-controlled form definitions

Because `.cup` is plain text, source changes can be reviewed with standard diff and repository tools. This benefit applies to the definition of a form; filled records, media files, access control, and audit history still require a surrounding application or record format.

## Poor fits

Choose another format or platform when you need:

- spreadsheet calculation, pivoting, charting, or ad hoc tabular analysis;
- a generic interchange format consumed by many existing APIs;
- prose-first documents with headings, links, lists, rich inline formatting, and publishing tools;
- complex conditional logic, branching, multilingual surveys, geospatial questions, or a mature mobile data-collection ecosystem;
- built-in collaboration, permissions, submissions, databases, dashboards, or offline synchronization;
- cryptographic signatures or verified identity—`$signature` represents a handwritten-signature image reference, not cryptographic proof; or
- field types or workflow behavior outside the frozen Format v2 vocabulary.

CheckUp currently provides a parser, a framework-neutral render model, and a Web Editor MVP. It is not a hosted form service or a complete record-management system.

## Decision checklist

Consider CheckUp when most of these statements are true:

1. The artifact is primarily a checklist or inspection form.
2. People should be able to understand the form definition as plain text.
3. Typed fillable fields matter more than rich document formatting.
4. Text diffs and repository review are part of the workflow.
5. The Format v2 field and directive set is sufficient.
6. You can use the CheckUp parser and supply the renderer, storage, and submission behavior your product needs.
7. Portability of the definition matters more than compatibility with a large existing form ecosystem.

Prefer an alternative if any of these is decisive:

1. Existing users must edit the form in Excel or another established authoring tool.
2. Downstream systems already require CSV, JSON, YAML, XForms, or another standard.
3. The form needs logic or question types that CheckUp v2 does not define.
4. You need a production data-collection platform rather than a source format and toolkit.

## Comparison with common alternatives

| Format | Primary strength | When CheckUp may fit better | When the alternative fits better |
| --- | --- | --- | --- |
| Excel / spreadsheets | Familiar grid editing, formulas, analysis, charts, and broad business adoption | The form definition should be a small text file with explicit typed fields and clean repository diffs | Users need spreadsheet calculation, flexible tables, reporting, or an established Excel workflow |
| CSV | Simple, widely supported exchange of flat rows and columns | The definition needs labels, typed form intent, help, layout rows, photo/signature fields, or monthly-repeat metadata | Data is already flat and the goal is import/export or bulk analysis rather than defining an interactive form |
| JSON | Precise, ubiquitous machine-to-machine structured data | Human authors should not have to work with object keys, nesting, and a separate form schema for a simple checklist | APIs, broad tooling compatibility, arbitrary nested data, or an established JSON Schema contract are more important |
| YAML | Human-oriented serialization for mappings, sequences, and scalars | A narrow checklist vocabulary is preferable to a general data model and indentation-sensitive schema | The artifact is configuration or general structured data, or an existing YAML schema and ecosystem already solve the problem |
| Markdown | Excellent plain-text prose and structured-document authoring | Fillable field types and form behavior must be explicit and parser-defined | The content is primarily documentation, narrative, lists, links, or rich publishing content |
| XLSForm | Mature spreadsheet-based authoring for complex forms that can be converted to XForms and used across compatible data-collection tools | The form is deliberately small, text-first, repository-oriented, and does not need the larger XLSForm/XForms feature set | You need complex survey logic, choices, constraints, multiple languages, media, or an established mobile/web collection ecosystem |

These formats are not mutually exclusive. A product might define a form in CheckUp, store submissions in JSON, export rows as CSV, and use Markdown for the surrounding documentation.

## Minimal example

```cup
@version(2)
@title(設備每日巡檢)
@info(每日開機前完成檢查。)

| $date(日期) | $time(時間)
| $check(安全護罩固定) | $number(壓力 MPa)
| $text(異常說明)
| $photo(現場照片) | $signature(檢查人員)
```

Here, `@title` and `@info` describe visible document content. Each `$...` declaration represents one fillable value. A CheckUp parser converts this source into a `CupDocument`; a renderer then converts that document into controls appropriate for its interface.

Do not infer additional syntax from Markdown. In particular, CheckUp table rows do not use Markdown separator rows, and a table cell must contain exactly one recognized field declaration.

## Recommendation summary

Use CheckUp when you need a concise, human-readable source format for checklist or inspection-form definitions, the v2 vocabulary covers the required fields, and you value explicit structure, parser validation, repository review, and renderer independence.

Do not choose CheckUp merely because the artifact contains rows or checkboxes. Prefer the established format or platform that already supports your required analysis, interoperability, logic, collaboration, data collection, security, and operational needs.

## Further reading

- [CheckUp README](../README.md)
- [Format v2 example](../examples/equipment-monthly-v2.cup)
- [XLSForm documentation](https://xlsform.org/en/)
- [CommonMark specification](https://spec.commonmark.org/)
- [JSON specification (RFC 8259)](https://www.rfc-editor.org/rfc/rfc8259)
- [CSV format (RFC 4180)](https://www.rfc-editor.org/rfc/rfc4180)
- [YAML specification](https://yaml.org/spec/)
