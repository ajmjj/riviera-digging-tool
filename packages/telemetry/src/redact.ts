// Redaction of personal data and secrets (spec 001/FR-005, research R4). One implementation for
// log lines (T005) and span data at export (T004); `sanitize` adds truncation (001/FR-006) last.

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

// 001/FR-005: names that differ only by separators match too, so the run-together spellings of
// common compound secret names are secret (`ADMINKEY`, `privatekey`, `setcookie`). Matched as
// substrings of the name with separators removed; none occurs in `keyboard` or `monkey`.
const SECRET_COMPOUNDS: readonly string[] = (
  "adminkey apikey accesskey privatekey secretkey signingkey encryptionkey masterkey clientkey " +
  "sharedkey sessionkey sessionid authkey authheader setcookie passwd credential authorization"
).split(" ");

// An unquoted authorization value can hold several words (`Token …`, `Digest …`), so it is
// redacted to the end of the line.
const LINE_VALUE_NAMES: ReadonlySet<string> = new Set(["authorization", "proxyauthorization"]);

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
 * R4), so `adminKey` and `ADMIN_KEY` are secret while `keyboard` and `monkey` are not; the
 * compounds above also catch the same names written without separators (`ADMINKEY`).
 */
export function isSecretName(name: string): boolean {
  const joined = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    splitWords(name).some((word) => SECRET_WORDS.has(word)) ||
    SECRET_SUBSTRINGS.some((part) => joined.includes(part)) ||
    SECRET_COMPOUNDS.some((part) => joined.includes(part))
  );
}

// Every pattern is linear in the input: quantifiers that could rescan the text from each start
// position are bounded (RFC 5321 limits for emails), so a large untruncated value can't stall
// the event loop (US5) before truncation runs.
// Dot-atom email addresses, with any atext character in the local part. Accepted limits of
// the bounds: only the last 64 local-part characters and 9 domain labels are replaced, a label
// over 63 characters or a non-ASCII address does not match.
const EMAIL =
  /[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,8}/g;
// RFC 6750 bearer tokens of 8+ characters, so prose like "the bearer of" keeps its words. The
// look-ahead keeps "Bearer Bearer <token>" from hiding the token.
const BEARER = /\bBearer\s+(?!Bearer\b)[A-Za-z0-9\-._~+/]{8,}=*/gi;
// Basic credentials (scheme in any case): only redacted when the base64 decodes to `user:pass`.
const BASIC = /\bBasic\s+(?!Basic\b)([A-Za-z0-9+/]+={0,2})(?![A-Za-z0-9+/=])/gi;
// `name=` or `name:` after a separator, the name optionally quoted: `?token=…`, `#code=…`,
// `Discogs token=…`, `key=…, secret=…`, `password: …`, `{"token":"…"}`, and nested ones
// such as `next=/login?token=…`.
const PARAM_NAME = /(?<=^|[?&;,\s=#/:([{"'])(["']?)[\w.-]{1,128}\1(?:=|\s=\s?|\s?:\s?)/g;
const PARAM_VALUE_END = /[\s&#,;"'<>)\]}]/g;
const LINE_END = /[\r\n]/g;
// 002 research R10: the tool's own link, session and push tokens (`rdl_`, `rds_`, `rdp_`), found
// by shape wherever they appear. Replaced before emails, so an `@` just before a token can't
// leave the token's tail behind. Linear: a match can't restart inside an earlier one.
const RIVIERA_TOKEN = /\brd[lsp]_[A-Za-z0-9_-]{20,}/g;

/** Redacts emails, the tool's tokens, bearer/basic credentials and secret-named parameters. */
export function redactText(text: string): string {
  const redacted = text
    .replace(RIVIERA_TOKEN, REDACTED)
    .replace(EMAIL, REDACTED)
    .replace(BEARER, REDACTED)
    .replace(BASIC, (match: string, encoded: string) =>
      Buffer.from(encoded, "base64").toString("utf8").includes(":") ? REDACTED : match,
    );
  return redactParams(redacted);
}

// Scans for `name=`; a secret's value is replaced up to its end, while the value of any other
// name is scanned on, so a secret parameter nested inside it is still found. Linear: every
// character is passed at most once by the scan and once by a skipped secret value.
function redactParams(text: string): string {
  const names = new RegExp(PARAM_NAME);
  let output = "";
  let copied = 0;
  for (let match = names.exec(text); match !== null; match = names.exec(text)) {
    const name = match[0].replace(/["'\s:=]/g, "");
    if (!isSecretName(name) && !SECRET_PARAM_NAMES.has(name.toLowerCase())) {
      continue;
    }
    let start = match.index + match[0].length;
    if (text.startsWith(REDACTED, start)) {
      continue; // already redacted by an earlier pattern, e.g. `Authorization: Bearer …`
    }
    let end: number;
    const quote = text.charAt(start);
    // A quoted value ends at its closing quote, an authorization one included:
    // `{"authorization":"Token x","user_id":1}` keeps `"user_id":1`.
    if (quote === '"' || quote === "'") {
      start += 1;
      end = closingQuote(text, quote, start);
    } else if (LINE_VALUE_NAMES.has(name.toLowerCase().replace(/[^a-z]/g, ""))) {
      LINE_END.lastIndex = start;
      end = LINE_END.exec(text)?.index ?? text.length;
    } else {
      PARAM_VALUE_END.lastIndex = start;
      end = PARAM_VALUE_END.exec(text)?.index ?? text.length;
    }
    if (end > start) {
      output += text.slice(copied, start) + REDACTED;
      copied = end;
      names.lastIndex = end;
    }
  }
  return output + text.slice(copied);
}

// Index of the quote closing a quoted value (backslash escapes skipped), or the text's end.
function closingQuote(text: string, quote: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (char === "\\") {
      i += 1;
    } else if (char === quote) {
      return i;
    }
  }
  return text.length;
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
