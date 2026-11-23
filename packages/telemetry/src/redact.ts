// Redaction of personal data and secrets (spec FR-005, research R4). One implementation for
// log lines (T005) and span data at export (T004); `sanitize` adds truncation (FR-006) last.

import { truncate } from "./truncate.ts";

export const REDACTED = "[REDACTED]";

// R4: a field name is secret when one of its words is one of these.
const SECRET_WORDS: ReadonlySet<string> = new Set(
  "password passwd pass secret token key apikey auth authorization cookie session credential credentials".split(
    " ",
  ),
);

// R4: …or when the unsplit name contains one of these (`accesstoken`, `clientsecret`).
const SECRET_SUBSTRINGS: readonly string[] = ["password", "secret", "token"];

// R4: query or `name=value` parameters that carry secrets without a secret word in the name.
const SECRET_PARAM_NAMES: ReadonlySet<string> = new Set(["code"]);

/**
 * Splits a field name into lower-case words at `-`, `_`, `.`, whitespace, camelCase and
 * letter/digit boundaries: `commonGroundAdminKey` → `common ground admin key`,
 * `X-Api-Key` → `x api key`, `PRIVATE_KEY` → `private key`.
 */
export function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[-_.\s]+/)
    .filter((word) => word.length > 0);
}

/**
 * Whether a field name names a secret. Secret words match whole words of the name (research
 * R4), so `adminKey` and `ADMIN_KEY` are secret while `keyboard` and `monkey` are not.
 */
export function isSecretName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    splitWords(name).some((word) => SECRET_WORDS.has(word)) ||
    SECRET_SUBSTRINGS.some((part) => lower.includes(part))
  );
}

// Dot-atom email addresses, with any atext character in the local part.
const EMAIL = /[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// RFC 6750 bearer tokens. The look-ahead keeps "Bearer Bearer <token>" from hiding the token.
const BEARER = /\bBearer\s+(?!Bearer\b)[A-Za-z0-9\-._~+/]+=*/gi;
// Basic credentials: only redacted when the base64 decodes to `user:password`.
const BASIC = /\bBasic\s+(?!Basic\b)([A-Za-z0-9+/]+={0,2})(?![A-Za-z0-9+/=])/g;
// `name=value` after a query, list or whitespace separator: `?token=…`, `&code=…`,
// `Discogs token=…`, `key=…, secret=…`.
const PARAM = /(^|[?&;,\s])([\w.-]+)=([^\s&#,;"'<>]+)/g;

/** Redacts emails, bearer/basic credentials and secret-named parameters in free text. */
export function redactText(text: string): string {
  return text
    .replace(EMAIL, REDACTED)
    .replace(BEARER, REDACTED)
    .replace(BASIC, (match: string, encoded: string) =>
      Buffer.from(encoded, "base64").toString("utf8").includes(":") ? REDACTED : match,
    )
    .replace(PARAM, (match: string, separator: string, name: string) =>
      isSecretName(name) || SECRET_PARAM_NAMES.has(name.toLowerCase())
        ? `${separator}${name}=${REDACTED}`
        : match,
    );
}

/**
 * Returns a copy of `value` in which every secret-named field's value is the redaction
 * marker and every string (keys included) has passed through `redactText`. Arrays stay
 * arrays; errors and other objects become plain objects of their own enumerable fields (an
 * error also keeps `name`, `message`, `stack` and `cause`); dates and primitives are kept.
 */
export function redact(value: unknown): unknown {
  return redactValue(value, new Set());
}

/** Redaction first, truncation last (R4), so a redaction marker can't exceed the limit. */
export function sanitize(value: unknown): unknown {
  return truncate(redact(value));
}

function redactValue(value: unknown, ancestors: Set<object>): unknown {
  if (typeof value === "string") {
    return redactText(value);
  }
  if (typeof value !== "object" || value === null || value instanceof Date) {
    return value;
  }
  if (ancestors.has(value)) {
    return "[Circular]";
  }
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map((item: unknown) => redactValue(item, ancestors))
    : Object.fromEntries(
        fieldsOf(value).map(([key, item]) => [
          redactText(key),
          isSecretName(key) ? REDACTED : redactValue(item, ancestors),
        ]),
      );
  ancestors.delete(value);
  return result;
}

function fieldsOf(value: object): [string, unknown][] {
  const fields = Object.entries(value);
  if (!(value instanceof Error)) {
    return fields;
  }
  const own = new Set(fields.map(([key]) => key));
  const extra: [string, unknown][] = [
    ["name", value.name],
    ["message", value.message],
    ["stack", value.stack],
    ["cause", value.cause],
  ];
  return [...extra.filter(([key, item]) => item !== undefined && !own.has(key)), ...fields];
}
