import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isSecretName, REDACTED, redact, redactText, sanitize, splitWords } from "../src/redact.ts";
import { TRUNCATION_LIMIT_BYTES, TRUNCATION_MARKER } from "../src/truncate.ts";

// Planted secret-shaped values are assembled at runtime from random parts, so no
// secret-looking literal is committed and gitleaks stays green without an allowlist change.
const tokenPart = fc.stringMatching(/^[A-Za-z0-9]{24,40}$/);
const userPart = fc.stringMatching(/^[a-z][a-z0-9]{2,11}$/);

/** `text` is planted into the JSON; `secret`, its sensitive part, must not survive. */
interface Planted {
  readonly text: string;
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
  .chain(([name, t]) =>
    fc.constantFrom<Planted>(
      { text: `https://shop.example/callback?page=2&${name}=${t}&lang=en`, secret: t },
      // nested inside another parameter's value, as logfmt messages write it
      { text: `next=/login?${name}=${t}`, secret: t },
      { text: `a=b=${name}=${t}`, secret: t },
      // quoted, after other separators, and as embedded JSON
      { text: `${name}="${t}"`, secret: t },
      { text: `OAuth ${name}='${t}', realm="x"`, secret: t },
      { text: `https://shop.example/cb#${name}=${t}`, secret: t },
      { text: `(${name}=${t})`, secret: t },
      { text: `{"${name}":"${t}","page":2}`, secret: t },
      { text: `${name}: ${t}`, secret: t },
    ),
  );

const planted = fc.oneof(plantedEmail, plantedBearer, plantedDiscogs, plantedBasic, plantedQuery);

type Wrap = (inner: unknown) => unknown;

// A field name without a secret word, so wrapping never hides the planted field itself.
const safeKey = fc
  .string()
  .filter((s) => !/pass|secret|token|key|auth|cookie|session|credential/i.test(s));

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
    .tuple(fc.dictionary(fc.string(), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 3 }), safeKey)
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

  // 002 research R10: link, session and push tokens, assembled at runtime as above.
  const tokenPrefix = fc.constantFrom("rdl", "rds", "rdp");
  const rivieraToken = fc
    .tuple(tokenPrefix, fc.stringMatching(/^[A-Za-z0-9_-]{20,48}$/))
    .map((parts) => parts.join("_"));

  it("002/FR-040: an rdl_, rds_ or rdp_ token anywhere in arbitrary JSON never survives", () => {
    const leaf = fc.oneof(
      rivieraToken.map((t) => ({ value: t, secret: t })),
      // inside free text, a link, a cookie header or a quoted value
      fc
        .tuple(rivieraToken, surround, fc.constantFrom(" ", "/#t=", "; rd_session=", '"'))
        .map(([t, [before, after], sep]) => ({ value: `${before}${sep}${t} ${after}`, secret: t })),
      // inside a field name
      fc.tuple(rivieraToken, surround, fc.jsonValue({ maxDepth: 1 })).map(([t, [before], v]) => ({
        value: { [`${before} ${t}`]: v },
        secret: t,
      })),
    );
    fc.assert(
      fc.property(leaf, fc.array(wrapper, { maxLength: 4 }), ({ value, secret }, wraps) => {
        const output = JSON.stringify(sanitize(nested(value, wraps)));
        expect(output).not.toContain(secret);
      }),
    );
  });

  it("002/FR-040: short look-alikes such as rdl_x stay unchanged", () => {
    const shortToken = fc
      .tuple(tokenPrefix, fc.stringMatching(/^[A-Za-z0-9]{1,19}$/))
      .map((parts) => parts.join("_"));
    expect(redactText("see rdl_x now")).toBe("see rdl_x now");
    // The boundary: 19 characters after the prefix stay, 20 are a token.
    const at = (n: number): string => ["rds", "a".repeat(n)].join("_");
    expect(redactText(`see ${at(19)} now`)).toBe(`see ${at(19)} now`);
    expect(redactText(`see ${at(20)} now`)).toBe(`see ${REDACTED} now`);
    fc.assert(
      fc.property(shortToken, fc.constantFrom(" ", "/#t=", "(", '"'), (t, sep) => {
        const text = `page${sep}${t} ok`;
        expect(redactText(text)).toBe(text);
        expect(redact({ note: text })).toEqual({ note: text });
      }),
    );
  });

  // Field names as word lists; each is written in every case style of 001/FR-005.
  const SECRET_NAMES = [
    "admin key|common ground admin key|private key|access key|x api key|client secret",
    "access token|password|authorization|cookie|set cookie|session id|api key|credentials",
  ]
    .join("|")
    .split("|")
    .map((name) => name.split(" "));
  const cap = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
  const styles: readonly ((words: readonly string[]) => string)[] = [
    (w) => w.map((word, i) => (i === 0 ? word : cap(word))).join(""), // camelCase
    (w) => w.map(cap).join(""), // PascalCase
    (w) => w.join("_"), // snake_case
    (w) => w.join("-"), // kebab-case
    (w) => w.join("_").toUpperCase(), // UPPER_CASE
    (w) => w.map(cap).join("-"), // Header-Case
    (w) => w.join(""), // joined lower case
    (w) => w.join("").toUpperCase(), // JOINED UPPER CASE
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
});

describe("whole-word matching of secret names (research R4)", () => {
  it("001/FR-005: the spec's example names are secret; keyboard and monkey stay unredacted", () => {
    const secret =
      "adminKey admin_key Admin-Key ADMIN_KEY commonGroundAdminKey privateKey accessKey";
    const more = "X-Api-Key CLIENT_SECRET accesstoken clientsecret apikey APIKey apiKey2 ADMINKEY";
    for (const name of `${secret} ${more}`.split(" ")) {
      expect({ name, secret: isSecretName(name) }).toEqual({ name, secret: true });
    }
    const safe = { keyboard: "qwerty", monkey: "Bonobo", Keyboard_Layout: "azerty" };
    expect(redact(safe)).toEqual(safe);
    expect(splitWords("commonGroundAdminKey")).toEqual(["common", "ground", "admin", "key"]);
    expect(splitWords("X-Api-Key PRIVATE_KEY")).toEqual(["x", "api", "key", "private", "key"]);
    expect(splitWords("APIKey job.name2fa")).toEqual(["api", "key", "job", "name", "2", "fa"]);
  });

  it("001/FR-005: every run-together compound listed in research R4 is secret, and so is any name containing password, secret or token", () => {
    const compounds =
      "adminkey apikey accesskey privatekey secretkey signingkey encryptionkey masterkey " +
      "clientkey sharedkey sessionkey sessionid authkey authheader setcookie passwd credential " +
      "authorization";
    for (const compound of compounds.split(" ")) {
      for (const name of [compound, compound.toUpperCase(), `x${compound}`]) {
        expect({ name, secret: isSecretName(name) }).toEqual({ name, secret: true });
      }
    }
    for (const name of ["sessiontoken", "APISECRET", "oldpassword"]) {
      expect({ name, secret: isSecretName(name) }).toEqual({ name, secret: true });
    }
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
    expect(redactText(`authorization: basic ${basic}`)).toBe(`authorization: ${REDACTED}`);
    expect(redactText(`Discogs token=${token}`)).toBe(`Discogs token=${REDACTED}`);
    expect(redactText(`Discogs key=${token}, secret=${token}`)).toBe(
      `Discogs key=${REDACTED}, secret=${REDACTED}`,
    );
    expect(redactText(`/cb?code=${token}&state=7`)).toBe(`/cb?code=${REDACTED}&state=7`);
    expect(redactText(`url=/callback?code=${token}`)).toBe(`url=/callback?code=${REDACTED}`);
    expect(redactText(`token= key=${token}`)).toBe(`token= key=${REDACTED}`);
    expect(redactText(`{"token":"a\\"${token}","n":1}`)).toBe(`{"token":"${REDACTED}","n":1}`);
    expect(redactText(`password: "${token}`)).toBe(`password: "${REDACTED}`);
    expect(redactText(`password = ${token} ok`)).toBe(`password = ${REDACTED} ok`);
    expect(redactText(`Authorization: Token ${token} x\nnext`)).toBe(
      `Authorization: ${REDACTED}\nnext`,
    );
    expect(redactText(`Proxy-Authorization: Digest response="${token}"`)).toBe(
      `Proxy-Authorization: ${REDACTED}`,
    );
    expect(redactText(`Error: not found`)).toBe(`Error: not found`);
  });

  it("001/FR-005: a quoted authorization value is redacted up to its closing quote", () => {
    const token = ["abc", "DEF", "123", "xyz"].join("");
    expect(redactText(`{"authorization":"Bearer x","user_id":1}`)).toBe(
      `{"authorization":"${REDACTED}","user_id":1}`,
    );
    expect(redactText(`{"Authorization": "Token ${token} x", "n": 2}`)).toBe(
      `{"Authorization": "${REDACTED}", "n": 2}`,
    );
    expect(redactText(`proxy_authorization='Digest a=1, b=2' next=3`)).toBe(
      `proxy_authorization='${REDACTED}' next=3`,
    );
  });

  it("001/FR-005: a quoted JSON value with escaped quotes is redacted to its real closing quote", () => {
    expect(
      redactText(String.raw`{"authorization":"Digest username=\"u\", response=\"h\"","n":1}`),
    ).toBe(`{"authorization":"${REDACTED}","n":1}`);
  });

  it("001/FR-005: leaves look-alikes that carry no secret unchanged", () => {
    const texts =
      "Basic validation failed|the bearer of news|status_code=500|GET /x?sort=a&page=3|a@b";
    for (const text of texts.split("|")) {
      expect(redactText(text)).toBe(text);
    }
  });
});

describe("structure", () => {
  it("001/FR-005: keeps non-sensitive data unchanged (property)", () => {
    const safeText = fc.string().filter((s) => !/[@=:]|bearer|basic/i.test(s));
    const anyKey = fc.oneof(
      fc.constantFrom("name", "route", "status", "keyboard", "monkey", "sortOrder", "jobName"),
      safeKey.filter((s) => !/[@=:]|bearer|basic/i.test(s)),
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
        fc.dictionary(anyKey, tie("value")),
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

describe("redaction cost", () => {
  it("001/FR-005: stays linear on large values with no match, so a big log value can't stall (US5)", () => {
    const size = 256 * 1024;
    for (const text of ["a".repeat(size), "a=".repeat(size / 2), `?${"a".repeat(size)}`]) {
      const started = performance.now();
      expect(redactText(text)).toBe(text);
      // Quadratic matching took tens of seconds at this size; linear takes well under 100 ms,
      // so the budget leaves a wide margin for loaded runners and coverage instrumentation.
      expect(performance.now() - started).toBeLessThan(5000);
    }
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
