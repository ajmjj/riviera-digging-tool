import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  TRUNCATION_LIMIT_BYTES,
  TRUNCATION_MARKER,
  truncate,
  truncateText,
} from "../src/truncate.ts";

const markerBytes = Buffer.byteLength(TRUNCATION_MARKER);

describe("truncation", () => {
  it("001/FR-006: the limit is 8 KB", () => {
    expect(TRUNCATION_LIMIT_BYTES).toBe(8192);
  });

  it("001/FR-006: text within the limit is unchanged", () => {
    const exact = "a".repeat(TRUNCATION_LIMIT_BYTES);
    expect(truncateText(exact)).toBe(exact);
    expect(truncateText("")).toBe("");
  });

  it("001/FR-006: longer text is cut to the limit and marked", () => {
    const output = truncateText("a".repeat(TRUNCATION_LIMIT_BYTES + 1));
    expect(output).toBe("a".repeat(TRUNCATION_LIMIT_BYTES) + TRUNCATION_MARKER);
  });

  it("001/FR-006: never splits a multi-byte character", () => {
    // "é" is 2 bytes and "😀" 4 bytes (a surrogate pair), so the limit falls inside one.
    expect(truncateText(`a${"é".repeat(5)}`, 4)).toBe(`aé${TRUNCATION_MARKER}`);
    expect(truncateText(`ab${"😀".repeat(3)}`, 9)).toBe(`ab😀${TRUNCATION_MARKER}`);
  });

  it("001/FR-006: output is a marked prefix at a character boundary within the limit (property)", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", maxLength: 300 }),
        fc.integer({ min: 0, max: 400 }),
        (text, limit) => {
          const output = truncateText(text, limit);
          if (Buffer.byteLength(text) <= limit) {
            expect(output).toBe(text);
            return;
          }
          expect(output.endsWith(TRUNCATION_MARKER)).toBe(true);
          const kept = output.slice(0, output.length - TRUNCATION_MARKER.length);
          expect(text.startsWith(kept)).toBe(true);
          expect(Buffer.byteLength(kept)).toBeLessThanOrEqual(limit);
          expect(Buffer.byteLength(output)).toBeLessThanOrEqual(limit + markerBytes);
          // Adding the next character would have gone over the limit.
          const next = String.fromCodePoint(text.codePointAt(kept.length) ?? 0);
          expect(Buffer.byteLength(kept + next)).toBeGreaterThan(limit);
        },
      ),
    );
  });

  it("001/FR-006: truncates every string in nested arrays and objects", () => {
    const long = "x".repeat(10);
    const input = { msg: long, list: [long, 3, { deep: long }], ok: true, none: null };
    const cut = `${"x".repeat(4)}${TRUNCATION_MARKER}`;
    expect(truncate(input, 4)).toEqual({
      msg: cut,
      list: [cut, 3, { deep: cut }],
      ok: true,
      none: null,
    });
    expect(truncate({ __proto__: null, msg: long }, 4)).toEqual({ msg: cut });
    const date = new Date(0);
    expect(truncate(date)).toBe(date);
  });
});
