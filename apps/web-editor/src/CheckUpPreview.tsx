import type { CupDocument, FieldNode, TableNode } from "@checkup/parser";

export interface CheckUpPreviewProps {
  readonly document: CupDocument;
}

/** Renders only the parser's structured document. It never receives .cup source text. */
export function CheckUpPreview({ document }: CheckUpPreviewProps) {
  const title = document.nodes.find(
    (node) => node.kind === "directive" && node.directiveType === "title",
  );
  const infoNodes = document.nodes.filter(
    (node) => node.kind === "directive" && node.directiveType === "info",
  );

  return (
    <article className="preview-sheet" aria-label="表單預覽">
      <header className="preview-header">
        <p className="preview-eyebrow">CHECKUP FORM · V{document.version ?? "?"}</p>
        <h2>{title?.kind === "directive" ? title.arguments[0] : "未命名檢查表"}</h2>
        {infoNodes.map((node) => (
          <p className="preview-info" key={`${node.source.start.offset}-${node.rawText}`}>
            {node.kind === "directive" ? node.arguments[0] : null}
          </p>
        ))}
      </header>

      <div className="preview-content">
        {document.nodes.map((node) => {
          if (node.kind === "table") {
            return <PreviewTable key={`table-${node.source.start.offset}`} table={node} />;
          }
          if (node.kind === "field") {
            return (
              <div className="standalone-field" key={`field-${node.source.start.offset}`}>
                <PreviewField field={node} />
              </div>
            );
          }
          return null;
        })}
      </div>
    </article>
  );
}

function PreviewTable({ table }: { readonly table: TableNode }) {
  return (
    <section className="preview-table-wrap">
      {table.repeat !== undefined ? <span className="repeat-badge">月度重複表格</span> : null}
      {table.help !== undefined ? <p className="table-help">說明：{table.help.text}</p> : null}
      <table className="preview-table">
        <tbody>
          {table.rows.map((row) => (
            <tr key={`row-${row.source.start.offset}`}>
              {row.cells.map((cell) => (
                <td key={`cell-${cell.source.start.offset}`}>
                  {cell.field === null ? <span className="invalid-cell">無效欄位</span> : <PreviewField field={cell.field} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PreviewField({ field }: { readonly field: FieldNode }) {
  const id = `field-${field.source.start.offset}`;
  const label = field.label ?? field.typeName;

  switch (field.fieldType) {
    case "date":
      return <LabeledInput id={id} label={label} type="date" />;
    case "month":
      return <LabeledInput id={id} label={label} type="month" />;
    case "day":
      return <LabeledInput id={id} label={label} type="number" min="1" max="31" />;
    case "time":
      return <LabeledInput id={id} label={label} type="time" />;
    case "check":
      return (
        <label className="check-field" htmlFor={id}>
          <input id={id} type="checkbox" disabled />
          <span>{label}</span>
        </label>
      );
    case "text":
      return <LabeledInput id={id} label={label} type="text" />;
    case "number":
      return <LabeledInput id={id} label={label} type="number" />;
    case "photo":
    case "signature":
    case "unknown":
      return null;
  }
}

interface LabeledInputProps {
  readonly id: string;
  readonly label: string;
  readonly type: "date" | "month" | "number" | "time" | "text";
  readonly min?: string;
  readonly max?: string;
}

function LabeledInput({ id, label, type, min, max }: LabeledInputProps) {
  return (
    <label className="input-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type={type} min={min} max={max} disabled />
    </label>
  );
}
