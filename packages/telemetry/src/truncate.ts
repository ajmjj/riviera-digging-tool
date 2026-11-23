// Truncation of long strings (spec FR-006, research R4). Runs after redaction (see redact.ts
// `sanitize`), so a value lengthened by a redaction marker is still cut back to the limit.

export const TRUNCATION_LIMIT_BYTES = 8192;
export const TRUNCATION_MARKER = "…[truncated]";

/**
 * Cuts `text` to at most `limitBytes` UTF-8 bytes at a character (code point) boundary and
 * appends the truncation marker. Text within the limit is returned unchanged.
 */
export function truncateText(text: string, limitBytes: number = TRUNCATION_LIMIT_BYTES): string {
  if (Buffer.byteLength(text, "utf8") <= limitBytes) {
    return text;
  }
  let bytes = 0;
  let end = 0;
  for (const char of text) {
    const size = Buffer.byteLength(char, "utf8");
    if (bytes + size > limitBytes) {
      break;
    }
    bytes += size;
    end += char.length;
  }
  return text.slice(0, end) + TRUNCATION_MARKER;
}

/** Truncates every string inside arrays and plain objects; other values are returned as is. */
export function truncate(value: unknown, limitBytes: number = TRUNCATION_LIMIT_BYTES): unknown {
  if (typeof value === "string") {
    return truncateText(value, limitBytes);
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => truncate(item, limitBytes));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, truncate(item, limitBytes)]),
    );
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
