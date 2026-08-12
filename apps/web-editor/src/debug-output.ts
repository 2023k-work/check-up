import type { CupDocument } from "@checkup/parser";

/** Serializes the cyclic AST for a developer-facing debug panel. */
export function stringifyDocument(document: CupDocument): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    document,
    (_key, value: unknown) => {
      if (typeof value !== "object" || value === null) {
        return value;
      }
      if (seen.has(value)) {
        return "[Circular reference]";
      }
      seen.add(value);
      return value;
    },
    2,
  );
}
