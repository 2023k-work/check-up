import type { CupCellEdit, Diagnostic, FieldType, TableNode } from "@checkup/parser";
import {
  createRenderModel,
  type RenderField,
  type RenderHelp,
  type RenderTableBlock,
} from "@checkup/renderer";
import { defaultSource } from "./default-source.js";
import { DocumentSession, type EditorMode } from "./document-session.js";
import {
  explicitSourceFromSearch,
  readEditorDraft,
  resolveInitialSource,
  saveEditorDraft,
} from "./draft-storage.js";
import type { EditableFieldType } from "./schema-mutator.js";
import { formatDiagnostic, isEmptySource, runtimeErrorMessage } from "./editor-state.js";
import "./styles.css";

const editableFieldTypes: readonly EditableFieldType[] = [
  "date", "month", "day", "time", "check", "text", "number", "photo", "signature",
];
type AppView = "home" | EditorMode;
const modeDescriptions: Record<AppView, string> = {
  home: "Learn about CheckUp and the .cup format",
  design: "Edit the schema, field order, and table directives",
  fill: "Fill data rows while field declarations remain locked",
  source: "Edit the complete .cup source in advanced mode",
};

const homeView = requireElement<HTMLElement>("#home-view");
const designView = requireElement<HTMLElement>("#design-view");
const fillView = requireElement<HTMLElement>("#fill-view");
const sourceView = requireElement<HTMLElement>("#source-view");
const sourceEditor = requireElement<HTMLTextAreaElement>("#source-editor");
const diagnosticsPanel = requireElement<HTMLElement>("#diagnostics");
const systemErrorPanel = requireElement<HTMLElement>("#system-error");
const systemErrorMessage = requireElement<HTMLElement>("#system-error-message");
const status = requireElement<HTMLOutputElement>("#status");
const modeDescription = requireElement<HTMLElement>("#mode-description");
const loadExampleButton = requireElement<HTMLButtonElement>("#load-official-example");
const retryApplicationButton = requireElement<HTMLButtonElement>("#retry-application");
const recoverExampleButton = requireElement<HTMLButtonElement>("#recover-official-example");
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-view]")];
const session = new DocumentSession(resolveInitialSource({
  explicitSource: explicitSourceFromSearch(window.location.search, defaultSource),
  draftSource: readEditorDraft(),
  defaultSource,
}));
let activeView: AppView = "home";

sourceEditor.value = session.snapshot.source;
for (const button of viewButtons) {
  const view = button.dataset.view as AppView;
  if (view !== "home") button.hidden = !session.permissions[view];
  button.addEventListener("click", () => {
    openView(view);
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open-view]")) {
  button.addEventListener("click", () => openView(button.dataset.openView as AppView));
}
sourceEditor.addEventListener("input", () => {
  const snapshot = session.setSource(sourceEditor.value);
  saveEditorDraft(snapshot.source);
  renderDiagnostics(snapshot.diagnostics);
  renderStatus(snapshot.success ? "Source synced" : "Source contains format errors", snapshot.success ? "ok" : "error");
  if (snapshot.success) {
    renderDesign();
    renderFill();
  }
});
loadExampleButton.addEventListener("click", loadOfficialExample);
retryApplicationButton.addEventListener("click", () => window.location.reload());
recoverExampleButton.addEventListener("click", loadOfficialExample);
window.addEventListener("error", (event) => showRuntimeError(event.error));
window.addEventListener("unhandledrejection", (event) => showRuntimeError(event.reason));

try {
  renderAll("Welcome to CheckUp");
} catch (error: unknown) {
  showRuntimeError(error);
}

function loadOfficialExample(): void {
  const snapshot = session.setSource(defaultSource);
  saveEditorDraft(snapshot.source);
  systemErrorPanel.hidden = true;
  renderAll("Official example loaded");
}

function openView(view: AppView): void {
  if (view !== "home") session.setMode(view);
  activeView = view;
  renderAll(view === "home" ? "Returned to Home" : "Mode changed");
}

function renderAll(message: string): void {
  const snapshot = session.snapshot;
  for (const button of viewButtons) {
    const view = button.dataset.view as AppView;
    button.classList.toggle("is-active", view === activeView);
    button.setAttribute("aria-pressed", String(view === activeView));
  }
  homeView.hidden = activeView !== "home";
  designView.hidden = activeView !== "design";
  fillView.hidden = activeView !== "fill";
  sourceView.hidden = activeView !== "source";
  modeDescription.textContent = modeDescriptions[activeView];
  if (sourceEditor.value !== snapshot.source) sourceEditor.value = snapshot.source;
  renderDiagnostics(snapshot.diagnostics);
  try {
    renderDesign();
    renderFill();
    systemErrorPanel.hidden = true;
  } catch (error: unknown) {
    showRuntimeError(error);
    return;
  }
  renderStatus(message, snapshot.success ? "ok" : "error");
}

function renderDesign(): void {
  const snapshot = session.snapshot;
  designView.replaceChildren();
  const heading = documentNode("div", undefined, "view-heading");
  heading.append(documentNode("h2", "Form Design"), documentNode("p", "Edit the field schema; data-row values move safely with their fields."));
  designView.append(heading);
  if (isEmptySource(snapshot.source)) {
    designView.append(renderEmptyState(
      "Start a new checklist",
      "Load the official example, or open Source mode and write your first .cup field.",
    ));
    return;
  }
  if (!snapshot.success) {
    designView.append(renderRecoveryState(
      "The source has format errors",
      "Open Source mode to fix the locations listed in the diagnostics. Your text and saved draft are preserved.",
    ));
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
    help.placeholder = "@help(...) (optional)";
    help.addEventListener("change", () => runDesignMutation(() => session.setHelp(table.id, help.value)));
    helpRow.append(help);
    card.append(helpRow);

    const list = element("div", "column-list");
    for (const [columnIndex, column] of table.columns.entries()) {
      const field = column.field;
      if (field === null || field.fieldType === "unknown") {
        list.append(documentNode("p", "Unsupported field. Edit it in Source mode.", "empty-state"));
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
        label: label.value.trim() || "Untitled field",
      }));
      type.addEventListener("change", update);
      label.addEventListener("change", update);
      row.append(type, label);
      row.append(actionButton("↑", "Move field up", columnIndex === 0, () => session.mutateSchema(table.id, { kind: "move", fieldId: column.id, direction: -1 })));
      row.append(actionButton("↓", "Move field down", columnIndex === table.columns.length - 1, () => session.mutateSchema(table.id, { kind: "move", fieldId: column.id, direction: 1 })));
      row.append(actionButton("Delete", "Delete field", table.columns.length === 1, () => session.mutateSchema(table.id, { kind: "delete", fieldId: column.id }), "danger"));
      list.append(row);
    }
    card.append(list);

    const addRow = element("div", "add-column");
    const addType = fieldTypeSelect("text");
    const addLabel = input("text");
    addLabel.placeholder = "New field name";
    const add = documentNode("button", "Add field") as HTMLButtonElement;
    add.type = "button";
    add.addEventListener("click", () => runDesignMutation(() => session.mutateSchema(table.id, {
      kind: "add",
      fieldType: addType.value as EditableFieldType,
      label: addLabel.value.trim() || "New field",
    })));
    addRow.append(addType, addLabel, add);
    card.append(addRow);
    designView.append(card);
  }
}

function renderFill(): void {
  const snapshot = session.snapshot;
  fillView.replaceChildren();
  if (isEmptySource(snapshot.source)) {
    fillView.append(renderEmptyState(
      "There is nothing to fill yet",
      "Load the official example to explore CheckUp, or start a document in Source mode.",
    ));
    return;
  }
  if (!snapshot.success) {
    fillView.append(renderRecoveryState(
      "Preview unavailable because the source is invalid",
      "Fix the reported syntax locations in Source mode. The current source remains untouched.",
    ));
    return;
  }
  const document = createRenderModel(snapshot.document);
  const article = element("article", "render-document");
  article.append(documentNode("h2", document.title ?? "Untitled Checklist", "document-title"));
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
  if (document.blocks.length === 0) form.append(documentNode("p", "This document has no fields to fill yet.", "empty-state"));
  article.append(form);
  fillView.append(article);
}

function renderTable(tableBlock: RenderTableBlock): HTMLElement {
  const section = element("section", "table-block");
  if (tableBlock.repeat !== undefined) section.append(documentNode("p", "Repeats monthly", "metadata-badge"));
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
      tableCell.append(cell.field === null ? documentNode("span", "Invalid field", "invalid-cell") : renderField(cell.field, true));
      tableRow.append(tableCell);
    }
    body.append(tableRow);
  }
  if (tableBlock.rows.length === 0) {
    const row = documentNode("tr");
    const cell = documentNode("td", "No data rows yet", "invalid-cell") as HTMLTableCellElement;
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
  if (field.descriptor.control === "photo-capture") control.placeholder = "Image path";
  if (field.descriptor.control === "signature-pad") control.placeholder = "Signature data";
  if (field.edit === undefined) {
    control.disabled = true;
  } else {
    control.addEventListener("input", () => {
      const value = control.type === "checkbox" ? (control.checked ? "Yes" : "No") : control.value;
      applyFillEdit({ ...field.edit!, value });
    });
  }
  return control;
}

function applyFillEdit(edit: CupCellEdit): void {
  try {
    const snapshot = session.editCell(edit);
    saveEditorDraft(snapshot.source);
    sourceEditor.value = snapshot.source;
    renderDiagnostics(snapshot.diagnostics);
    renderStatus("Filled value synced to source", "ok");
  } catch (error: unknown) {
    showRuntimeError(error);
  }
}

function runDesignMutation(action: () => unknown): void {
  try {
    action();
    saveEditorDraft(session.snapshot.source);
    renderAll("Schema synced to Fill and Source modes");
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
    list.append(documentNode("li", formatDiagnostic(diagnostic)));
  }
  diagnosticsPanel.append(documentNode("strong", "Format diagnostics"), list);
}

function renderStatus(message: string, tone: "ok" | "error"): void {
  status.value = message;
  status.className = tone === "ok" ? "status-ok" : "status-error";
}

function showRuntimeError(error: unknown): void {
  systemErrorMessage.textContent = runtimeErrorMessage(error);
  systemErrorPanel.hidden = false;
  renderStatus("Application error — draft preserved", "error");
}

function renderEmptyState(title: string, description: string): HTMLElement {
  return renderActionState("Empty document", title, description);
}

function renderRecoveryState(title: string, description: string): HTMLElement {
  return renderActionState("Format error", title, description);
}

function renderActionState(kicker: string, title: string, description: string): HTMLElement {
  const state = element("section", "action-state");
  state.append(
    documentNode("p", kicker, "state-kicker"),
    documentNode("h2", title),
    documentNode("p", description),
  );
  const actions = element("div", "state-actions");
  const sourceButton = documentNode("button", "Open Source mode") as HTMLButtonElement;
  sourceButton.type = "button";
  sourceButton.addEventListener("click", () => openView("source"));
  const exampleButton = documentNode("button", "Load official example") as HTMLButtonElement;
  exampleButton.type = "button";
  exampleButton.addEventListener("click", loadOfficialExample);
  actions.append(sourceButton, exampleButton);
  state.append(actions);
  return state;
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
