import { describe, expect, it } from "vitest";
import {
  EDITOR_DRAFT_KEY,
  explicitSourceFromSearch,
  readEditorDraft,
  resolveInitialSource,
  saveEditorDraft,
  type DraftStorage,
} from "./draft-storage.js";

class MemoryStorage implements DraftStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("editor draft storage", () => {
  it("round-trips raw invalid source without parsing or normalization", () => {
    const storage = new MemoryStorage();
    const invalidSource = "@version(2)\n| $text(Unclosed label";

    expect(saveEditorDraft(invalidSource, storage)).toBe(true);
    expect(storage.values.get(EDITOR_DRAFT_KEY)).toBe(invalidSource);
    expect(readEditorDraft(storage)).toBe(invalidSource);
  });

  it("prefers an explicit source, then a draft, then the official default", () => {
    expect(resolveInitialSource({
      explicitSource: "from URL",
      draftSource: "draft",
      defaultSource: "default",
    })).toBe("from URL");
    expect(resolveInitialSource({ draftSource: "draft", defaultSource: "default" })).toBe("draft");
    expect(resolveInitialSource({ defaultSource: "default" })).toBe("default");
  });

  it("treats an explicitly requested official example as higher priority than a draft", () => {
    const explicitSource = explicitSourceFromSearch("?example=official", "official example");

    expect(resolveInitialSource({
      explicitSource,
      draftSource: "old draft",
      defaultSource: "official example",
    })).toBe("official example");
  });

  it("supports source text supplied directly in the URL", () => {
    expect(explicitSourceFromSearch("?source=%40version%282%29%0Ainvalid", "default"))
      .toBe("@version(2)\ninvalid");
  });

  it("keeps the editor usable when storage reads or writes throw", () => {
    const unavailable: DraftStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota exceeded"); },
    };

    expect(readEditorDraft(unavailable)).toBeUndefined();
    expect(saveEditorDraft("source", unavailable)).toBe(false);
  });
});
