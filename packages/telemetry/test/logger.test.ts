import { readFileSync } from "node:fs";
import { SeverityNumber, trace, type SpanContext } from "@opentelemetry/api";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger, type LoggerOptions } from "../src/logger.ts";
import { REDACTED } from "../src/redact.ts";
import { startTestTelemetry, type TestTelemetry } from "../src/testing.ts";
import { TRUNCATION_MARKER } from "../src/truncate.ts";

const schemaUrl = new URL(
  "../../../specs/001-observability-baseline/contracts/log-line.schema.json",
  import.meta.url,
);
const ajv = new Ajv2020({ strict: false });
addFormats.default(ajv);
const validateLine = ajv.compile(JSON.parse(readFileSync(schemaUrl, "utf8")));

const token = ["abc", "DEF", "123", "xyz", "789"].join("");
const email = ["staff", "example.com"].join("@");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A logger writing into an array, and the lines it wrote, parsed. */
function capture(options: Partial<LoggerOptions> = {}): {
  log: ReturnType<typeof createLogger>;
  raw: string[];
  lines: () => Record<string, unknown>[];
} {
  const raw: string[] = [];
  const log = createLogger({
    service: "riviera-api",
    env: "ci",
    level: "trace",
    write: (line) => {
      raw.push(line);
    },
    ...options,
  });
  const lines = (): Record<string, unknown>[] =>
    raw.map((line) => {
      const parsed: unknown = JSON.parse(line);
      if (!isRecord(parsed)) {
        throw new Error(`not an object: ${line}`);
      }
      return parsed;
    });
  return { log, raw, lines };
}

let harness: TestTelemetry | undefined;
afterEach(async () => {
  await harness?.shutdown();
  harness = undefined;
});

describe("log line shape", () => {
  it("001/FR-001: every level writes one JSON line that validates against the contract", () => {
    const { log, raw, lines } = capture({ service: "riviera-worker", env: "development" });
    log.trace("t");
    log.debug("d");
    log.info({ job_id: "6f1c1c1e-8a4a-4c55-9a35-3c3c7d1d2f10", attempt: 1 }, "i");
    log.warn("w");
    log.error(new Error("boom"));
    log.fatal("f");
    expect(raw.every((line) => line.endsWith("\n") && !line.slice(0, -1).includes("\n"))).toBe(
      true,
    );
    for (const line of lines()) {
      expect(validateLine(line), JSON.stringify(validateLine.errors)).toBe(true);
    }
    expect(lines().map((l) => l["level"])).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
    ]);
    expect(lines()[0]).toMatchObject({ service: "riviera-worker", env: "development", msg: "t" });
    expect(lines()[0]).not.toHaveProperty("pid");
    expect(lines()[0]).not.toHaveProperty("hostname");
  });

  it("001/FR-001: time is ISO 8601 UTC", () => {
    const { log, lines } = capture();
    log.info("now");
    const time = lines()[0]?.["time"];
    expect(typeof time === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(time)).toBe(
      true,
    );
  });

  it("001/FR-001: an error is logged as { type, message, stack } with its message as msg", () => {
    const { log, lines } = capture();
    log.error(new TypeError("bad input"));
    log.error({ err: new Error("inner") }, "outer");
    const [first, second] = lines();
    expect(first).toMatchObject({
      msg: "bad input",
      err: { type: "TypeError", message: "bad input" },
    });
    expect(first?.["err"]).toHaveProperty("stack");
    expect(second).toMatchObject({ msg: "outer", err: { type: "Error", message: "inner" } });
    const bare = new Error("no stack");
    delete bare.stack;
    log.error(bare);
    expect(lines()[2]?.["err"]).toEqual({ type: "Error", message: "no stack" });
  });

  it('001/FR-001: format arguments are applied, and a line without a message has msg ""', () => {
    const { log, lines } = capture();
    log.info("%s has %d items", "cart", 3);
    log.info({ n: 1 });
    log.info({ msg: "from the object" });
    log.info(42);
    expect(lines().map((l) => l["msg"])).toEqual(["cart has 3 items", "", "from the object", "42"]);
    for (const line of lines()) {
      expect(validateLine(line), JSON.stringify(validateLine.errors)).toBe(true);
    }
  });

  it("001/FR-001: levels below the configured one are not written", () => {
    const { log, lines } = capture({ level: "warn" });
    log.info("hidden");
    log.warn("shown");
    expect(lines().map((l) => l["msg"])).toEqual(["shown"]);
  });
});

describe("trace context", () => {
  it("001/FR-001: a line inside a span carries its trace and span IDs, outside none", () => {
    harness = startTestTelemetry();
    const { log, lines } = capture();
    const span = trace.getTracer("test").startSpan("work");
    trace.getTracer("test").startActiveSpan("work", (active) => {
      log.info("inside");
      active.end();
    });
    span.end();
    log.info("outside");
    const [inside, outside] = lines();
    expect(inside?.["trace_id"]).toMatch(/^[0-9a-f]{32}$/);
    expect(inside?.["span_id"]).toMatch(/^[0-9a-f]{16}$/);
    expect(validateLine(inside)).toBe(true);
    expect(outside).not.toHaveProperty("trace_id");
    expect(outside).not.toHaveProperty("span_id");
  });

  it("001/FR-001: without a registered SDK no trace IDs are added", () => {
    const { log, lines } = capture();
    trace.getTracer("test").startActiveSpan("noop", (span) => {
      log.info("inside a non-recording span");
      span.end();
    });
    expect(lines()[0]).not.toHaveProperty("trace_id");
  });
});

describe("redaction (001/FR-005)", () => {
  it("001/FR-005: the message, format arguments, fields and errors are redacted", () => {
    const { log, raw, lines } = capture();
    log.info({ password: "hunter2", note: `mail ${email}`, nested: { apiKey: 7 } }, `to ${email}`);
    log.info("auth %s", `Bearer ${token}`);
    log.error(new Error(`failed for ${email}`));
    log.child({ session: token }).child({ note: email }).info("child");
    const text = raw.join("");
    expect(text).not.toContain(email);
    expect(text).not.toContain(token);
    expect(text).not.toContain("hunter2");
    const [fields, formatted, error, child] = lines();
    expect(fields).toMatchObject({
      msg: `to ${REDACTED}`,
      password: REDACTED,
      note: `mail ${REDACTED}`,
      nested: { apiKey: REDACTED },
    });
    expect(formatted?.["msg"]).toBe(`auth ${REDACTED}`);
    expect(error).toMatchObject({ msg: `failed for ${REDACTED}` });
    expect(error?.["err"]).toMatchObject({ message: `failed for ${REDACTED}` });
    expect(child).toMatchObject({ session: REDACTED, note: REDACTED });
  });

  it("001/FR-005: a child created with options keeps them and still has redacted bindings", () => {
    const { log, lines } = capture();
    const child = log.child({ token }, { level: "error" });
    child.warn("hidden");
    child.error("shown");
    expect(lines()).toEqual([expect.objectContaining({ token: REDACTED, msg: "shown" })]);
  });

  it("001/FR-005: a request logs only method, url and the allow-listed headers (R4)", () => {
    const { log, raw, lines } = capture();
    const request = {
      method: "POST",
      url: `/sample?token=${token}`,
      ip: "203.0.113.7",
      body: { password: "hunter2" },
      headers: {
        authorization: `Bearer ${token}`,
        cookie: `sid=${token}`,
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "curl/8.0",
        "content-type": "application/json",
        "x-request-id": "req_1",
        "content-language": ["en", "fr"],
      },
    };
    log.info({ req: request, res: { statusCode: 202, headers: { "set-cookie": "a" } } }, "done");
    expect(raw.join("")).not.toContain(token);
    expect(raw.join("")).not.toContain("203.0.113.7");
    expect(raw.join("")).not.toContain("hunter2");
    expect(lines()[0]).toMatchObject({
      req: {
        method: "POST",
        url: `/sample?token=${REDACTED}`,
        headers: {
          "user-agent": "curl/8.0",
          "content-type": "application/json",
        },
      },
      res: { statusCode: 202 },
    });
    expect(Object.keys(lines()[0]?.["req"] ?? {})).toEqual(["method", "url", "headers"]);
    // The planted `x-request-id` (req_1) is off the allow-list: only the validated ID is ever
    // logged, as `request_id` (001/FR-003).
    expect(lines()[0]?.["req"]).toHaveProperty("headers", {
      "user-agent": "curl/8.0",
      "content-type": "application/json",
    });
    expect(raw.join("")).not.toContain("req_1");
    expect(lines()[0]?.["res"]).toEqual({ statusCode: 202 });
  });

  it("001/FR-005: odd req, res and err values are kept as data and still redacted", () => {
    const { log, lines } = capture();
    log.info({ req: `GET /?key=${token}`, res: null, err: { message: email } }, "odd");
    log.info(
      { req: { headers: { "user-agent": ["a", "b"] } }, res: { statusCode: "200" } },
      "odder",
    );
    log.info({ req: { method: "GET" } }, "no headers");
    const [odd, odder, bare] = lines();
    expect(odd).toMatchObject({
      req: `GET /?key=${REDACTED}`,
      res: null,
      err: { message: REDACTED },
    });
    expect(odder).toMatchObject({ req: { headers: {} }, res: {} });
    expect(bare?.["req"]).toEqual({ method: "GET", headers: {} });
  });
});

describe("truncation (001/FR-006)", () => {
  it("001/FR-006: a long message and a long field are cut to 8 KB plus the marker", () => {
    const { log, lines } = capture();
    log.info({ detail: "y".repeat(9000) }, "x".repeat(9000));
    const [line] = lines();
    const msg = line?.["msg"];
    const detail = line?.["detail"];
    expect(typeof msg === "string" && msg.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(
      typeof msg === "string" && Buffer.byteLength(msg) - Buffer.byteLength(TRUNCATION_MARKER),
    ).toBe(8192);
    expect(typeof detail === "string" && detail.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(validateLine(line), JSON.stringify(validateLine.errors)).toBe(true);
  });
});

describe("OTLP bridge", () => {
  it("001/FR-001: the exported record has the line's body, severity, trace context and fields", async () => {
    harness = startTestTelemetry();
    const { log, lines } = capture();
    let spanContext: SpanContext | undefined;
    trace.getTracer("test").startActiveSpan("work", (span) => {
      spanContext = span.spanContext();
      log.warn({ request_id: "req_1", password: "hunter2" }, `for ${email}`);
      span.end();
    });
    log.info("outside");
    const [record, outside] = await harness.logs();
    const [line] = lines();
    expect(record?.body).toBe(line?.["msg"]);
    expect(record?.body).toBe(`for ${REDACTED}`);
    expect(record?.severityText).toBe("warn");
    expect(record?.severityNumber).toBe(SeverityNumber.WARN);
    expect(record?.spanContext).toMatchObject({
      traceId: line?.["trace_id"],
      spanId: line?.["span_id"],
    });
    expect(record?.spanContext).toMatchObject({
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
    });
    expect(record?.attributes).toEqual({ request_id: "req_1", password: REDACTED });
    expect(record?.hrTime[0]).toBe(Math.floor(Date.parse(String(line?.["time"])) / 1000));
    expect(outside?.spanContext).toBeUndefined();
    expect(outside?.severityNumber).toBe(SeverityNumber.INFO);
  });

  it("001/FR-001: every level maps to its OTel severity", async () => {
    harness = startTestTelemetry();
    const { log } = capture();
    log.trace("t");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    log.fatal("f");
    expect((await harness.logs()).map((r) => r.severityNumber)).toEqual([
      SeverityNumber.TRACE,
      SeverityNumber.DEBUG,
      SeverityNumber.INFO,
      SeverityNumber.WARN,
      SeverityNumber.ERROR,
      SeverityNumber.FATAL,
    ]);
  });

  it("001/FR-001: the default destination is stdout", () => {
    const written: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      written.push(String(chunk));
      return true;
    };
    try {
      createLogger({ service: "riviera-api", env: "ci", level: "info" }).info("to stdout");
    } finally {
      process.stdout.write = original;
    }
    expect(written.join("")).toContain('"msg":"to stdout"');
  });
});
