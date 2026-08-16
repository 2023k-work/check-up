import type { CupCellEdit, Diagnostic, FieldType, TableNode } from "@checkup/parser";
import {
  createRenderModel,
  type RenderField,
  type RenderHelp,
  type RenderTableBlock,
} from "@checkup/renderer";
import { defaultSource } from "./default-source.js";
import { DocumentSession, type EditorMode } from "./document-session.js";
import type { EditableFieldType } from "./schema-mutator.js";
import "./styles.css";

const editableFieldTypes: readonly EditableFieldType[] = [
  "date", "month", "day", "time", "check", "text", "number", "photo", "signature",
];
const modeDescriptions: Record<EditorMode, string> = {
  design: "設計 Schema、欄位順序與 table directives",
  fill: "填寫資料列；欄位宣告保持鎖定",
  source: "完整 .cup source；進階模式",
};

const designView = requireElement<HTMLElement>("#design-view");
const fillView = requireElement<HTMLElement>("#fill-view");
const sourceView = requireElement<HTMLElement>("#source-view");
const sourceEditor = requireElement<HTMLTextAreaElement>("#source-editor");
const diagnosticsPanel = requireElement<HTMLElement>("#diagnostics");
const status = requireElement<HTMLOutputElement>("#status");
const modeDescription = requireElement<HTMLElement>("#mode-description");
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-mode]")];
const session = new DocumentSession(defaultSource);

sourceEditor.value = session.snapshot.source;
for (const button of modeButtons) {
  const mode = button.dataset.mode as EditorMode;
  button.hidden = !session.permissions[mode];
  button.addEventListener("click", () => {
    session.setMode(mode);
    renderAll("模式已切換");
  });
}
sourceEditor.addEventListener("input", () => {
  const snapshot = session.setSource(sourceEditor.value);
  renderDiagnostics(snapshot.diagnostics);
  renderStatus(snapshot.success ? "原始碼已同步" : "原始碼含格式錯誤", snapshot.success ? "ok" : "error");
  if (snapshot.success) {
    renderDesign();
    renderFill();
  }
});

renderAll("已載入，預設進入填寫模式");

function renderAll(message: string): void {
  const snapshot = session.snapshot;
  for (const button of modeButtons) {
    const mode = button.dataset.mode as EditorMode;
    button.classList.toggle("is-active", mode === snapshot.mode);
    button.setAttribute("aria-pressed", String(mode === snapshot.mode));
  }
  designView.hidden = snapshot.mode !== "design";
  fillView.hidden = snapshot.mode !== "fill";
  sourceView.hidden = snapshot.mode !== "source";
  modeDescription.textContent = modeDescriptions[snapshot.mode];
  if (sourceEditor.value !== snapshot.source) sourceEditor.value = snapshot.source;
  renderDiagnostics(snapshot.diagnostics);
  renderDesign();
  renderFill();
  renderStatus(message, snapshot.success ? "ok" : "error");
}

function renderDesign(): void {
  const snapshot = session.snapshot;
  designView.replaceChildren();
  const heading = documentNode("div", undefined, "view-heading");
  heading.append(documentNode("h2", "表單設計"), documentNode("p", "修改欄位 Schema；資料列值會跟著欄位順序安全搬移。"));
  designView.append(heading);
  if (!snapshot.success) {
    designView.append(documentNode("p", "請先在原始碼模式修正格式錯誤。", "empty-state"));
    return;
  }

  const tables = snapshot.document.nodes.filter((node): node is TableNode => node.kind === "table");
  for (const [tableIndex, table] of tables.entries()) {
    const card = element("section", "design-card");
    const cardHeader = element("div", "design-card-header");
    cardHeader.append(documentNode("h3", `Table ${tableIndex + 1}`));
    const repeatLabel = element("label", "toggle-label");
    const repeat = input("checkbox");
    repeat.checked = table.repeat !== undefined;
    repeat.disabled = !snapshot.document.fields.some((field) => field.fieldType === "month") && !repeat.checked;
    repeat.addEventListener("change", () => runDesignMutation(() => session.setRepeat(table.id, repeat.checked)));
    repeatLabel.append(repeat, document.createTextNode(" @repeat(month)"));
    cardHeader.append(repeatLabel);
    card.append(cardHeader);

    const helpRow = element("label", "design-help");
    helpRow.append(documentNode("span", "Table help"));
    const help = input("text");
    help.value = table.help?.text ?? "";
    help.placeholder = "@help(...)（選填）";
    help.addEventListener("change", () => runDesignMutation(() => session.setHelp(table.id, help.value)));
    helpRow.append(help);
    card.append(helpRow);

    const list = element("div", "column-list");
    for (const [columnIndex, column] of table.columns.entries()) {
      const field = column.field;
      if (field === null || field.fieldType === "unknown") {
        list.append(documentNode("p", "不支援的欄位，請使用原始碼模式處理。", "empty-state"));
        continue;
      }
      const row = element("div", "column-editor");
      row.append(documentNode("span", String(columnIndex + 1), "column-index"));
      const type = fieldTypeSelect(field.fieldType);
      const label = input("text");
      label.value = field.label ?? field.typeName;
      const update = (): void => runDesignMutation(() => session.mutateSchema(table.id, {
        kind: "update",
        fieldId: column.id,
        fieldType: type.value as EditableFieldType,
        label: label.value.trim() || "未命名欄位",
      }));
      type.addEventListener("change", update);
      label.addEventListener("change", update);
      row.append(type, label);
      row.append(actionButton("↑", "上移欄位", columnIndex === 0, () => session.mutateSchema(table.id, { kind: "move", fieldId: column.id, direction: -1 })));
      row.append(actionButton("↓", "下移欄位", columnIndex === table.columns.length - 1, () => session.mutateSchema(table.id, { kind: "move", fieldId: column.id, direction: 1 })));
      row.append(actionButton("刪除", "刪除欄位", table.columns.length === 1, () => session.mutateSchema(table.id, { kind: "delete", fieldId: column.id }), "danger"));
      list.append(row);
    }
    card.append(list);

    const addRow = element("div", "add-column");
    const addType = fieldTypeSelect("text");
    const addLabel = input("text");
    addLabel.placeholder = "新欄位名稱";
    const add = documentNode("button", "新增欄位") as HTMLButtonElement;
    add.type = "button";
    add.addEventListener("click", () => runDesignMutation(() => session.mutateSchema(table.id, {
      kind: "add",
      fieldType: addType.value as EditableFieldType,
      label: addLabel.value.trim() || "新欄位",
    })));
    addRow.append(addType, addLabel, add);
    card.append(addRow);
    designView.append(card);
  }
}

function renderFill(): void {
  const snapshot = session.snapshot;
  fillView.replaceChildren();
  if (!snapshot.success) {
    fillView.append(documentNode("p", "原始碼含錯誤，修正後才能填寫。", "empty-state"));
    return;
  }
  const document = createRenderModel(snapshot.document);
  const article = element("article", "render-document");
  article.append(documentNode("h2", document.title ?? "未命名檢查表", "document-title"));
  if (document.info.length > 0) {
    const info = element("div", "document-info");
    for (const text of document.info) info.append(documentNode("p", text));
    article.append(info);
  }
  const form = documentNode("form") as HTMLFormElement;
  form.addEventListener("submit", (event) => event.preventDefault());
  for (const block of document.blocks) {
    form.append(block.kind === "field" ? renderField(block.field) : renderTable(block));
  }
  if (document.blocks.length === 0) form.append(documentNode("p", "這份文件目前沒有可填寫欄位。", "empty-state"));
  article.append(form);
  fillView.append(article);
}

function renderTable(tableBlock: RenderTableBlock): HTMLElement {
  const section = element("section", "table-block");
  if (tableBlock.repeat !== undefined) section.append(documentNode("p", "每月重複", "metadata-badge"));
  if (tableBlock.help !== undefined) section.append(renderHelp(tableBlock.help));
  const scroller = element("div", "table-scroll");
  const table = documentNode("table");
  const head = documentNode("thead");
  const headerRow = documentNode("tr");
  for (const column of tableBlock.columns) headerRow.append(documentNode("th", column.label ?? column.fieldType));
  head.append(headerRow);
  const body = documentNode("tbody");
  for (const row of tableBlock.rows) {
    const tableRow = documentNode("tr");
    for (const cell of row.cells) {
      const tableCell = documentNode("td");
      tableCell.append(cell.field === null ? documentNode("span", "無效欄位", "invalid-cell") : renderField(cell.field, true));
      tableRow.append(tableCell);
    }
    body.append(tableRow);
  }
  if (tableBlock.rows.length === 0) {
    const row = documentNode("tr");
    const cell = documentNode("td", "尚無資料列", "invalid-cell") as HTMLTableCellElement;
    cell.colSpan = Math.max(1, tableBlock.columns.length);
    row.append(cell);
    body.append(row);
  }
  table.append(head, body);
  scroller.append(table);
  section.append(scroller);
  return section;
}

function renderField(field: RenderField, compact = false): HTMLElement {
  const wrapper = element("div", compact ? "field field-compact" : "field");
  const controlId = `control-${field.id}`;
  const label = documentNode("label", field.label ?? field.fieldType, "field-label") as HTMLLabelElement;
  label.htmlFor = controlId;
  wrapper.append(label, createFieldControl(field, controlId));
  if (field.help !== undefined) wrapper.append(renderHelp(field.help));
  return wrapper;
}

function createFieldControl(field: RenderField, id: string): HTMLInputElement {
  const typeByControl: Partial<Record<RenderField["descriptor"]["control"], string>> = {
    "date-picker": "date", "month-picker": "month", "day-input": "number", "time-picker": "time",
    checkbox: "checkbox", "text-input": "text", "number-input": "number",
    "photo-capture": "text", "signature-pad": "text", unsupported: "text",
  };
  const control = input(typeByControl[field.descriptor.control] ?? "text");
  control.id = id;
  if (field.descriptor.control === "checkbox") control.checked = field.value === true;
  else control.value = field.value === null ? "" : String(field.value);
  if (field.descriptor.control === "day-input") { control.min = "1"; control.max = "31"; }
  if (field.descriptor.control === "photo-capture") control.placeholder = "圖片路徑";
  if (field.descriptor.control === "signature-pad") control.placeholder = "簽名資料";
  if (field.edit === undefined) {
    control.disabled = true;
  } else {
    control.addEventListener("input", () => {
      const value = control.type === "checkbox" ? (control.checked ? "正常" : "異常") : control.value;
      applyFillEdit({ ...field.edit!, value });
    });
  }
  return control;
}

function applyFillEdit(edit: CupCellEdit): void {
  try {
    const snapshot = session.editCell(edit);
    sourceEditor.value = snapshot.source;
    renderDiagnostics(snapshot.diagnostics);
    renderStatus("填寫值已同步到原始碼", "ok");
  } catch (error: unknown) {
    showRuntimeError(error);
  }
}

function runDesignMutation(action: () => unknown): void {
  try {
    action();
    renderAll("Schema 已同步到填寫與原始碼模式");
  } catch (error: unknown) {
    showRuntimeError(error);
  }
}

function fieldTypeSelect(value: FieldType): HTMLSelectElement {
  const select = documentNode("select");
  for (const fieldType of editableFieldTypes) {
    const option = documentNode("option", `$${fieldType}`) as HTMLOptionElement;
    option.value = fieldType;
    option.selected = fieldType === value;
    select.append(option);
  }
  return select;
}

function actionButton(
  text: string,
  title: string,
  disabled: boolean,
  action: () => unknown,
  variant?: "danger",
): HTMLButtonElement {
  const button = documentNode("button", text) as HTMLButtonElement;
  button.type = "button";
  button.title = title;
  button.disabled = disabled;
  if (variant !== undefined) button.className = variant;
  button.addEventListener("click", () => runDesignMutation(action));
  return button;
}

function renderHelp(help: RenderHelp): HTMLElement {
  const aside = element("aside", "field-help");
  aside.append(documentNode("span", help.text));
  if (help.imagePath !== undefined) aside.append(documentNode("code", help.imagePath));
  return aside;
}

function renderDiagnostics(diagnostics: readonly Diagnostic[]): void {
  diagnosticsPanel.replaceChildren();
  diagnosticsPanel.hidden = diagnostics.length === 0;
  if (diagnostics.length === 0) return;
  const list = documentNode("ul");
  for (const diagnostic of diagnostics) {
    list.append(documentNode("li", `第 ${diagnostic.source.start.line} 行 · ${diagnostic.code}: ${diagnostic.message}`));
  }
  diagnosticsPanel.append(documentNode("strong", "格式診斷"), list);
}

function renderStatus(message: string, tone: "ok" | "error"): void {
  status.value = message;
  status.className = tone === "ok" ? "status-ok" : "status-error";
}

function showRuntimeError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  diagnosticsPanel.hidden = false;
  diagnosticsPanel.replaceChildren(documentNode("strong", "操作失敗"), documentNode("p", message));
  renderStatus("無法同步", "error");
}

function input(type: string): HTMLInputElement {
  const node = documentNode("input") as HTMLInputElement;
  node.type = type;
  return node;
}

function element<K extends keyof HTMLElementTagNameMap>(tagName: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  node.className = className;
  return node;
}

function documentNode<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}

function requireElement<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (node === null) throw new Error(`Missing required element: ${selector}`);
  return node;
}
