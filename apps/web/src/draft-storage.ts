export const EDITOR_DRAFT_KEY = "checkup.editor.draft.v1";

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface InitialSourceOptions {
  readonly defaultSource: string;
  readonly draftSource?: string | undefined;
  readonly explicitSource?: string | undefined;
}

export function readEditorDraft(storage: DraftStorage | undefined = browserStorage()): string | undefined {
  if (storage === undefined) return undefined;

  try {
    return storage.getItem(EDITOR_DRAFT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveEditorDraft(
  source: string,
  storage: DraftStorage | undefined = browserStorage(),
): boolean {
  if (storage === undefined) return false;

  try {
    storage.setItem(EDITOR_DRAFT_KEY, source);
    return true;
  } catch {
    return false;
  }
}

export function resolveInitialSource(options: InitialSourceOptions): string {
  return options.explicitSource ?? options.draftSource ?? options.defaultSource;
}

export function explicitSourceFromSearch(search: string, officialExample: string): string | undefined {
  const parameters = new URLSearchParams(search);
  if (parameters.has("source")) return parameters.get("source") ?? "";

  const example = parameters.get("example");
  return example === "official" || example === "default" ? officialExample : undefined;
}

function browserStorage(): DraftStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
