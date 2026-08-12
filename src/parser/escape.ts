export const ESCAPABLE_CHARACTERS = ["@", "(", ")", ",", "|", "\\"] as const;

export type EscapableCharacter = (typeof ESCAPABLE_CHARACTERS)[number];

export type EscapeScanResult =
  | { readonly kind: "valid"; readonly value: EscapableCharacter; readonly width: 2 }
  | { readonly kind: "invalid"; readonly value: string; readonly width: 2 }
  | { readonly kind: "dangling"; readonly value: "\\"; readonly width: 1 };

const escapableCharacters = new Set<string>(ESCAPABLE_CHARACTERS);

/** Scans one backslash escape without assuming a parser or runtime environment. */
export function scanEscape(text: string, backslashIndex: number): EscapeScanResult {
  const escaped = text[backslashIndex + 1];
  if (escaped === undefined) {
    return { kind: "dangling", value: "\\", width: 1 };
  }

  if (escapableCharacters.has(escaped)) {
    return { kind: "valid", value: escaped as EscapableCharacter, width: 2 };
  }

  return { kind: "invalid", value: `\\${escaped}`, width: 2 };
}
