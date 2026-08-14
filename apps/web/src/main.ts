import { parseCup, type Diagnostic } from "@checkup/parser";
import {
  createRenderModel,
  type RenderDocument,
  type RenderField,
  type RenderHelp,
  type RenderTableBlock,
} from "@checkup/renderer";
import { defaultSource } from "./default-source.js";
import "./styles.css";

const editor = requireElement<HTMLTextAreaElement>("#source-editor");
const preview = requireElement<HTMLElement>("#preview");
const diagnosticsPanel = requireElement<HTMLElement>("#diagnostics");
const status = requireElement<HTMLOutputElement>("#status");

editor.value = defaultSource;
editor.addEventListener("input", debounce(updatePreview, 180));
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
  table.append(body);
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
    return input(id, "checkbox");
  }
  if (control === "date-picker") {
    return input(id, "date");
  }
  if (control === "month-picker") {
    return input(id, "month");
  }
  if (control === "time-picker") {
    return input(id, "time");
  }
  if (control === "day-input") {
    const day = input(id, "number");
    day.min = "1";
    day.max = "31";
    day.placeholder = "1–31";
    return day;
  }
  if (control === "number-input") {
    return input(id, "number");
  }
  if (control === "text-input") {
    return input(id, "text");
  }
  if (control === "photo-capture") {
    const photo = input(id, "file");
    photo.accept = "image/*";
    photo.setAttribute("capture", "environment");
    return photo;
  }
  if (control === "signature-pad") {
    const signature = documentNode("button", "簽名欄（預覽）", "signature-placeholder") as HTMLButtonElement;
    signature.id = id;
    signature.type = "button";
    signature.disabled = true;
    return signature;
  }

  const unsupported = input(id, "text");
  unsupported.disabled = true;
  unsupported.placeholder = `不支援的欄位：${field.fieldType}`;
  return unsupported;
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

function debounce(callback: () => void, delay: number): () => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(callback, delay);
  };
}
