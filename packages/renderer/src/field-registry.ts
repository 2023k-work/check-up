import type { FieldType } from "@checkup/parser";
import type { FieldRenderDescriptor } from "./types.js";

export const fieldRenderRegistry: Readonly<Record<FieldType, FieldRenderDescriptor>> = Object.freeze({
  date: descriptor("date", "date-picker", "string"),
  month: descriptor("month", "month-picker", "string"),
  day: descriptor("day", "day-input", "number"),
  time: descriptor("time", "time-picker", "string"),
  check: descriptor("check", "checkbox", "boolean"),
  text: descriptor("text", "text-input", "string"),
  number: descriptor("number", "number-input", "number"),
  photo: descriptor("photo", "photo-capture", "asset"),
  signature: descriptor("signature", "signature-pad", "asset"),
  unknown: Object.freeze({
    fieldType: "unknown",
    control: "unsupported",
    valueKind: "unknown",
  }),
});

export function getFieldRenderDescriptor(fieldType: FieldType): FieldRenderDescriptor {
  return fieldRenderRegistry[fieldType];
}

function descriptor(
  fieldType: Exclude<FieldType, "unknown">,
  control: Exclude<FieldRenderDescriptor["control"], "unsupported">,
  valueKind: Exclude<FieldRenderDescriptor["valueKind"], "unknown">,
): FieldRenderDescriptor {
  return Object.freeze({ fieldType, control, valueKind });
}
