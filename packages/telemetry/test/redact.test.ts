import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isSecretName, REDACTED, redact, redactText, sanitize, splitWords } from "../src/redact.ts";
import { TRUNCATION_LIMIT_BYTES, TRUNCATION_MARKER } from "../src/truncate.ts";

// Planted secret-shaped values are assembled at runtime from random parts, so no
// secret-looking literal is committed and gitleaks stays green without an allowlist change.
const tokenPart = fc.stringMatching(/^[A-Za-z0-9]{24,40}$/);
const userPart = fc.stringMatching(/^[a-z][a-z0-9]{2,11}$/);

interface Planted {
  /** The text planted into the JSON. */
  readonly text: string;
  /** The sensitive part, which must not survive redaction. */
  readonly secret: string;
}

const plantedEmail = fc.emailAddress().map((email): Planted => ({ text: email, secret: email }));
const plantedBearer = tokenPart.map((t): Planted => ({ text: ["Bearer", t].join(" "), secret: t }));
const plantedDiscogs = tokenPart.map((t): Planted => ({
  text: ["Discogs", `token=${t}`].join(" "),
  secret: t,
}));
const plantedBasic = fc.tuple(userPart, tokenPart).map(([user, pass]): Planted => {
  const encoded = Buffer.from([user, pass].join(":")).toString("base64");
  return { text: ["Basic", encoded].join(" "), secret: encoded };
});
const plantedQuery = fc
  .tuple(fc.constantFrom("token", "access_token", "key", "code", "client_secret"), tokenPart)
  .map(([name, t]): Planted => ({
    text: `https://shop.example/callback?page=2&${name}=${t}&lang=en`,
    secret: t,
  }));

const planted = fc.oneof(plantedEmail, plantedBearer, plantedDiscogs, plantedBasic, plantedQuery);

type Wrap = (inner: unknown) => unknown;

// Puts a value somewhere in arbitrary JSON: as an array element or an object field.
const wrapper: fc.Arbitrary<Wrap> = fc.oneof(
  fc
    .tuple(fc.array(fc.jsonValue({ maxDepth: 2 }), { maxLength: 3 }), fc.nat())
    .map(([others, at]): Wrap => (inner) => {
      const items: unknown[] = [...others];
      items.splice(at % (items.length + 1), 0, inner);
      return items;
    }),
  fc
    .tuple(fc.dictionary(fc.string(), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 3 }), fc.string())
    .map(([others, key]): Wrap => (inner) => ({ ...others, [key]: inner })),
);

const nested = (leaf: unknown, wraps: readonly Wrap[]): unknown =>
  wraps.reduce((inner, wrap) => wrap(inner), leaf);

const surround = fc.tuple(fc.string(), fc.string());

describe("redaction of planted values (property)", () => {
  it("001/FR-005: a planted email, token or secret anywhere in arbitrary JSON never survives", () => {
    const leaf = fc.oneof(
      // the whole string value
      planted.map((p) => ({ value: p.text, secret: p.secret })),
      // inside free text
      fc.tuple(planted, surround).map(([p, [before, after]]) => ({
        value: `${before} ${p.text} ${after}`,
        secret: p.secret,
      })),
      // inside a field name
      fc.tuple(planted, surround, fc.jsonValue({ maxDepth: 1 })).map(([p, [before], v]) => ({
        value: { [`${before} ${p.text}`]: v },
        secret: p.secret,
      })),
    );
    fc.assert(
      fc.property(leaf, fc.array(wrapper, { maxLength: 4 }), ({ value, secret }, wraps) => {
        const output = JSON.stringify(sanitize(nested(value, wraps)));
        expect(output).not.toContain(secret);
      }),
    );
  });

  // Field names as word lists; each is written in every case style of FR-005.
  const SECRET_NAMES: readonly (readonly string[])[] = [
    ["admin", "key"],
    ["common", "ground", "admin", "key"],
    ["private", "key"],
    ["access", "key"],
    ["x", "api", "key"],
    ["client", "secret"],
    ["access", "token"],
    ["password"],
    ["authorization"],
    ["cookie"],
    ["set", "cookie"],
    ["session", "id"],
    ["api", "key"],
    ["credentials"],
  ];
  const cap = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
  const styles: readonly ((words: readonly string[]) => string)[] = [
    (w) => w.map((word, i) => (i === 0 ? word : cap(word))).join(""), // camelCase
    (w) => w.map(cap).join(""), // PascalCase
    (w) => w.join("_"), // snake_case
    (w) => w.join("-"), // kebab-case
    (w) => w.join("_").toUpperCase(), // UPPER_CASE
    (w) => w.map(cap).join("-"), // Header-Case
  ];
  const secretName = fc
    .tuple(fc.constantFrom(...SECRET_NAMES), fc.constantFrom(...styles))
    .map(([words, style]) => style(words));

  it("001/FR-005: a value under a secret name in any case style is redacted, whatever its type", () => {
    fc.assert(
      fc.property(
        secretName,
        fc.jsonValue(),
        fc.array(wrapper, { maxLength: 4 }),
        (name, value, wraps) => {
          const found: unknown[] = [];
          const walk = (node: unknown): void => {
            if (Array.isArray(node)) {
              node.forEach(walk);
            } else if (typeof node === "object" && node !== null) {
              for (const [key, item] of Object.entries(node)) {
                if (key === name) found.push(item);
                walk(item);
              }
            }
          };
          walk(sanitize(nested({ [name]: value }, wraps)));
          expect(found.length).toBeGreaterThan(0);
          expect(found.every((item) => item === REDACTED)).toBe(true);
        },
      ),
    );
  });

  it("001/FR-005: the example names of the spec and plan are secret names", () => {
    for (const name of [
      "adminKey",
      "admin_key",
      "Admin-Key",
      "ADMIN_KEY",
      "commonGroundAdminKey",
      "privateKey",
      "accessKey",
      "X-Api-Key",
      "CLIENT_SECRET",
      "accesstoken",
      "clientsecret",
      "apikey",
      "APIKey",
      "apiKey2",
    ]) {
      expect({ name, secret: isSecretName(name) }).toEqual({ name, secret: true });
    }
  });
});

describe("whole-word matching of secret names (research R4)", () => {
  it("001/FR-005: keyboard and monkey are not secret names and stay unredacted", () => {
    expect(isSecretName("keyboard")).toBe(false);
    expect(isSecretName("monkey")).toBe(false);
    expect(redact({ keyboard: "qwerty", monkey: "Bonobo", Keyboard_Layout: "azerty" })).toEqual({
      keyboard: "qwerty",
      monkey: "Bonobo",
      Keyboard_Layout: "azerty",
    });
  });

  it("001/FR-005: names split at separators, camelCase and digits", () => {
    expect(splitWords("commonGroundAdminKey")).toEqual(["common", "ground", "admin", "key"]);
    expect(splitWords("X-Api-Key")).toEqual(["x", "api", "key"]);
    expect(splitWords("PRIVATE_KEY")).toEqual(["private", "key"]);
    expect(splitWords("APIKey")).toEqual(["api", "key"]);
    expect(splitWords("job.name 2fa")).toEqual(["job", "name", "2", "fa"]);
  });
});

describe("redaction of free text", () => {
  it("001/FR-005: replaces each kind of sensitive value with the marker", () => {
    const token = ["abc", "DEF", "123", "xyz"].join("");
    const basic = Buffer.from(["user", token].join(":")).toString("base64");
    const email = ["staff", "example.com"].join("@");
    expect(redactText(`sent to ${email} ok`)).toBe(`sent to ${REDACTED} ok`);
    expect(redactText(`Authorization: Bearer ${token}`)).toBe(`Authorization: ${REDACTED}`);
    expect(redactText(`Bearer Bearer ${token}`)).toBe(`Bearer ${REDACTED}`);
    expect(redactText(`Basic ${basic}`)).toBe(REDACTED);
    expect(redactText(`Discogs token=${token}`)).toBe(`Discogs token=${REDACTED}`);
    expect(redactText(`Discogs key=${token}, secret=${token}`)).toBe(
      `Discogs key=${REDACTED}, secret=${REDACTED}`,
    );
    expect(redactText(`/cb?code=${token}&state=7`)).toBe(`/cb?code=${REDACTED}&state=7`);
  });

  it("001/FR-005: leaves look-alikes that carry no secret unchanged", () => {
    for (const text of [
      "Basic validation failed",
      "status_code=500 page=2",
      "GET /records?sort=price&page=3",
      "keyboard=qwerty",
      "a@b",
    ]) {
      expect(redactText(text)).toBe(text);
    }
  });
});

describe("structure", () => {
  it("001/FR-005: keeps non-sensitive data unchanged (property)", () => {
    const safeText = fc.string().filter((s) => !/[@=]|bearer|basic/i.test(s));
    const safeKey = fc.oneof(
      fc.constantFrom("name", "route", "status", "keyboard", "monkey", "sortOrder", "jobName"),
      safeText.filter((s) => !/pass|secret|token|key|auth|cookie|session|credential/i.test(s)),
    );
    const safeJson = fc.letrec((tie) => ({
      value: fc.oneof(
        { depthSize: "small" },
        safeText,
        fc.integer(),
        fc.double({ noNaN: true }),
        fc.boolean(),
        fc.constant(null),
        fc.array(tie("value")),
        fc.dictionary(safeKey, tie("value")),
      ),
    })).value;
    fc.assert(
      fc.property(safeJson, (value) => {
        expect(sanitize(value)).toEqual(value);
      }),
    );
  });

  it("001/FR-005: errors become plain objects with redacted fields", () => {
    const email = ["ops", "example.com"].join("@");
    const error = Object.assign(new Error(`no staff ${email}`, { cause: "upstream" }), {
      apiKey: "k",
    });
    const output = redact({ err: error, at: new Date(0), n: 1, missing: undefined });
    expect(output).toEqual({
      err: {
        name: "Error",
        message: `no staff ${REDACTED}`,
        stack: redactText(error.stack ?? ""),
        cause: "upstream",
        apiKey: REDACTED,
      },
      at: new Date(0),
      n: 1,
      missing: undefined,
    });
    expect(JSON.stringify(output)).not.toContain(email);
  });

  it("001/FR-005: replaces circular references instead of recursing forever", () => {
    const node: Record<string, unknown> = { name: "a" };
    node["self"] = node;
    expect(redact([node, node])).toEqual([
      { name: "a", self: "[Circular]" },
      { name: "a", self: "[Circular]" },
    ]);
  });
});

describe("redaction before truncation", () => {
  it("001/FR-006: output stays within the limit plus marker even when redaction lengthens it", () => {
    const email = ["a", "b.co"].join("@");
    const fill = fc.integer({ min: 0, max: 40 }).map((n) => "x".repeat(n));
    fc.assert(
      fc.property(fill, fc.integer({ min: 1100, max: 1400 }), (pad, count) => {
        const input = Array.from({ length: count }, () => `${pad}${email}`).join(" ");
        const output = sanitize(input);
        expect(typeof output).toBe("string");
        const text = String(output);
        expect(text).not.toContain(email);
        expect(text.endsWith(TRUNCATION_MARKER)).toBe(true);
        expect(Buffer.byteLength(text)).toBeLessThanOrEqual(
          TRUNCATION_LIMIT_BYTES + Buffer.byteLength(TRUNCATION_MARKER),
        );
      }),
    );
  });
});
