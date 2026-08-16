import {
  parseCup,
  type CupCellEdit,
  type CupDocument,
  type Diagnostic,
} from "@checkup/parser";
import {
  createRenderModel,
  type RenderDocument,
  type RenderField,
  type RenderHelp,
  type RenderTableBlock,
} from "@checkup/renderer";
import { defaultSource } from "./default-source.js";
import { applyPreviewEdits } from "./edit-session.js";
import "./styles.css";

const editor = requireElement<HTMLTextAreaElement>("#source-editor");
const preview = requireElement<HTMLElement>("#preview");
const diagnosticsPanel = requireElement<HTMLElement>("#diagnostics");
const status = requireElement<HTMLOutputElement>("#status");
const renderButton = requireElement<HTMLButtonElement>("#render-button");
const writeBackButton = requireElement<HTMLButtonElement>("#write-back-button");

let parsedDocument: CupDocument | null = null;
const pendingEdits = new Map<string, CupCellEdit>();

editor.value = defaultSource;
editor.addEventListener("input", () => {
  parsedDocument = null;
  pendingEdits.clear();
  writeBackButton.disabled = true;
  status.value = "Source 已變更，按 > 更新 Preview";
  status.className = "status-warning";
});
renderButton.addEventListener("click", updatePreview);
writeBackButton.addEventListener("click", writeBack);
updatePreview();

function updatePreview(): void {
  clearDiagnostics();

  try {
    const result = parseCup(editor.value);
    if (!result.success) {
      showEmptyPreview("修正格式錯誤後，Preview 會在這裡更新。");
      showDiagnostics(result.diagnostics);
      status.value = "解析失敗";
      status.className = "status-error";
      return;
    }

    const renderDocument = createRenderModel(result.document);
    parsedDocument = result.document;
    pendingEdits.clear();
    writeBackButton.disabled = true;
    renderPreview(renderDocument);

    if (result.diagnostics.length > 0) {
      showDiagnostics(result.diagnostics);
      status.value = "已更新（含診斷）";
      status.className = "status-warning";
    } else {
      status.value = "已更新";
      status.className = "status-ok";
    }
  } catch (error: unknown) {
    showEmptyPreview("目前無法產生 Preview。");
    showRuntimeError(error);
    status.value = "無法更新";
    status.className = "status-error";
  }
}

function showEmptyPreview(message: string): void {
  preview.replaceChildren(documentNode("p", message, "empty-state"));
}

function renderPreview(document: RenderDocument): void {
  preview.replaceChildren();

  const article = element("article", "render-document");
  const heading = element("h2", "document-title");
  heading.textContent = document.title ?? "未命名檢查表";
  article.append(heading);

  if (document.info.length > 0) {
    const info = element("div", "document-info");
    for (const text of document.info) {
      const paragraph = documentNode("p", text);
      info.append(paragraph);
    }
    article.append(info);
  }

  const form = documentNode("form") as HTMLFormElement;
  form.addEventListener("submit", (event) => event.preventDefault());
  for (const block of document.blocks) {
    if (block.kind === "field") {
      form.append(renderField(block.field));
    } else {
      form.append(renderTable(block));
    }
  }

  if (document.blocks.length === 0) {
    form.append(documentNode("p", "這份文件目前沒有可顯示的欄位。", "empty-state"));
  }

  article.append(form);
  preview.append(article);
}

function renderTable(tableBlock: RenderTableBlock): HTMLElement {
  const section = element("section", "table-block");

  if (tableBlock.repeat !== undefined) {
    const repeat = element("p", "metadata-badge");
    repeat.textContent = `每月重複範本 · 來源 ${tableBlock.repeat.sourceFieldId}`;
    section.append(repeat);
  }
  if (tableBlock.help !== undefined) {
    section.append(renderHelp(tableBlock.help));
  }

  const scroller = element("div", "table-scroll");
  const table = documentNode("table");
  const head = documentNode("thead");
  const headerRow = documentNode("tr");
  for (const column of tableBlock.columns) {
    headerRow.append(documentNode("th", column.label ?? column.fieldType));
  }
  head.append(headerRow);
  const body = documentNode("tbody");
  for (const row of tableBlock.rows) {
    const tableRow = documentNode("tr");
    for (const cell of row.cells) {
      const tableCell = documentNode("td");
      if (cell.field === null) {
        tableCell.append(documentNode("span", "無效欄位", "invalid-cell"));
      } else {
        tableCell.append(renderField(cell.field, true));
      }
      tableRow.append(tableCell);
    }
    body.append(tableRow);
  }
  if (tableBlock.rows.length === 0) {
    const emptyRow = documentNode("tr");
    const emptyCell = documentNode("td", "尚無資料列", "invalid-cell") as HTMLTableCellElement;
    emptyCell.colSpan = Math.max(1, tableBlock.columns.length);
    emptyRow.append(emptyCell);
    body.append(emptyRow);
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

  if (field.help !== undefined) {
    wrapper.append(renderHelp(field.help));
  }
  return wrapper;
}

function createFieldControl(field: RenderField, id: string): HTMLElement {
  const control = field.descriptor.control;
  if (control === "checkbox") {
    const checkbox = input(id, "checkbox");
    checkbox.checked = field.value === true;
    bindEdit(checkbox, field, () => checkbox.checked ? "正常" : "異常");
    return checkbox;
  }
  if (control === "date-picker") {
    return editableInput(field, id, "date");
  }
  if (control === "month-picker") {
    return editableInput(field, id, "month");
  }
  if (control === "time-picker") {
    return editableInput(field, id, "time");
  }
  if (control === "day-input") {
    const day = input(id, "number");
    day.min = "1";
    day.max = "31";
    day.placeholder = "1–31";
    initializeInput(day, field);
    return day;
  }
  if (control === "number-input") {
    return editableInput(field, id, "number");
  }
  if (control === "text-input") {
    return editableInput(field, id, "text");
  }
  if (control === "photo-capture") {
    const photo = editableInput(field, id, "text");
    photo.placeholder = "圖片路徑";
    return photo;
  }
  if (control === "signature-pad") {
    const signature = editableInput(field, id, "text");
    signature.className = "signature-placeholder";
    signature.placeholder = "簽名資料";
    return signature;
  }

  const unsupported = input(id, "text");
  unsupported.disabled = true;
  unsupported.placeholder = `不支援的欄位：${field.fieldType}`;
  return unsupported;
}

function editableInput(field: RenderField, id: string, type: string): HTMLInputElement {
  const control = input(id, type);
  initializeInput(control, field);
  return control;
}

function initializeInput(control: HTMLInputElement, field: RenderField): void {
  control.value = field.value === null ? "" : String(field.value);
  bindEdit(control, field, () => control.value);
}

function bindEdit(
  control: HTMLInputElement,
  field: RenderField,
  readValue: () => string,
): void {
  if (field.edit === undefined) {
    control.disabled = true;
    control.title = "欄位宣告不儲存資料；請在 table 資料列中填寫。";
    return;
  }
  control.addEventListener("input", () => {
    const edit: CupCellEdit = { ...field.edit!, value: readValue() };
    pendingEdits.set(`${edit.tableId}/${edit.rowId}/${edit.fieldId}`, edit);
    writeBackButton.disabled = false;
    status.value = `Preview 有 ${pendingEdits.size} 項修改，按 < 回寫`;
    status.className = "status-warning";
  });
}

function writeBack(): void {
  if (parsedDocument === null || pendingEdits.size === 0) {
    return;
  }
  try {
    const result = applyPreviewEdits(editor.value, parsedDocument, [...pendingEdits.values()]);
    if (!result.success) {
      showDiagnostics(result.diagnostics);
      status.value = "回寫後驗證失敗";
      status.className = "status-error";
      return;
    }
    editor.value = result.source;
    parsedDocument = result.document;
    pendingEdits.clear();
    writeBackButton.disabled = true;
    renderPreview(createRenderModel(result.document));
    clearDiagnostics();
    status.value = "已回寫並重新驗證";
    status.className = "status-ok";
  } catch (error: unknown) {
    showRuntimeError(error);
    status.value = "無法回寫";
    status.className = "status-error";
  }
}

function renderHelp(help: RenderHelp): HTMLElement {
  const aside = element("aside", "field-help");
  aside.append(documentNode("span", help.text));
  if (help.imagePath !== undefined) {
    aside.append(documentNode("code", help.imagePath));
  }
  return aside;
}

function showDiagnostics(diagnostics: readonly Diagnostic[]): void {
  diagnosticsPanel.replaceChildren();
  diagnosticsPanel.hidden = false;
  const heading = documentNode("strong", "格式診斷");
  const list = documentNode("ul");
  for (const diagnostic of diagnostics) {
    const location = `第 ${diagnostic.source.start.line} 行，第 ${diagnostic.source.start.column} 欄`;
    const item = documentNode(
      "li",
      `${location} · ${diagnostic.code}: ${diagnostic.message}`,
      `diagnostic-${diagnostic.severity}`,
    );
    list.append(item);
  }
  diagnosticsPanel.append(heading, list);
}

function showRuntimeError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  diagnosticsPanel.hidden = false;
  diagnosticsPanel.replaceChildren(
    documentNode("strong", "Renderer 錯誤"),
    documentNode("p", message),
  );
}

function clearDiagnostics(): void {
  diagnosticsPanel.hidden = true;
  diagnosticsPanel.replaceChildren();
}

function input(id: string, type: string): HTMLInputElement {
  const field = documentNode("input") as HTMLInputElement;
  field.id = id;
  field.type = type;
  return field;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
): HTMLElementTagNameMap[K] {
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
  if (text !== undefined) {
    node.textContent = text;
  }
  if (className !== undefined) {
    node.className = className;
  }
  return node;
}

function requireElement<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (node === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return node;
}
