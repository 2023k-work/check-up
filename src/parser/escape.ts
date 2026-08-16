export const ESCAPABLE_CHARACTERS = ["@", "(", ")", ",", "|", "\\"] as const;

export type EscapableCharacter = (typeof ESCAPABLE_CHARACTERS)[number];

export type EscapeScanResult =
  | { readonly kind: "valid"; readonly value: EscapableCharacter; readonly width: 2 }
  | { readonly kind: "invalid"; readonly value: string; readonly width: 2 }
  | { readonly kind: "dangling"; readonly value: "\\"; readonly width: 1 };

const escapableCharacters = new Set<string>(ESCAPABLE_CHARACTERS);

/** Escapes a literal value so it can be stored safely inside a .cup table cell. */
export function escapeCupValue(value: string): string {
  let escaped = "";
  for (const character of value) {
    escaped += escapableCharacters.has(character) ? `\\${character}` : character;
  }
  return escaped;
}

/** Decodes supported v2 escapes in a table value. Invalid escapes are preserved. */
export function unescapeCupValue(value: string): string {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character !== "\\") {
      decoded += character;
      continue;
    }
    const escape = scanEscape(value, index);
    decoded += escape.value;
    index += escape.width - 1;
  }
  return decoded;
}

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
