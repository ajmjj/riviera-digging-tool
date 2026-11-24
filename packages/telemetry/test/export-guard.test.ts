import { readFileSync } from "node:fs";
import {
  diag,
  logs,
  ROOT_CONTEXT,
  SeverityNumber,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import {
  AggregationTemporality,
  AggregationType,
  InMemoryMetricExporter,
  InstrumentType,
} from "@opentelemetry/sdk-metrics";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDropWarning,
  DIAG_WARNING_MESSAGE,
  DROP_WARNING_MESSAGE,
  guardMetricExporter,
  guardSpanExporter,
  routeDiag,
  type DropWarning,
} from "../src/export-guard.ts";
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

function recorder(start = 0): { limiter: DropWarning; lines: string[]; at: (ms: number) => void } {
  const lines: string[] = [];
  let time = start;
  const limiter = createDropWarning({
    service: "riviera-worker",
    env: "ci",
    now: () => time,
    write: (line) => {
      lines.push(line);
    },
  });
  return { limiter, lines, at: (ms) => (time = start + ms) };
}

function failing(result: () => ExportResult): SpanExporter {
  return {
    export: (_spans, callback) => {
      callback(result());
    },
    shutdown: () => Promise.resolve(),
  };
}

function exportOnce(exporter: SpanExporter): Promise<ExportResult> {
  return new Promise((resolve) => {
    exporter.export([], resolve);
  });
}

describe("DropWarning", () => {
  it("001/FR-020: failed exports write at most one warning per minute", async () => {
    const { limiter, lines, at } = recorder(Date.UTC(2026, 0, 1));
    const exporter = guardSpanExporter(
      failing(() => ({ code: ExportResultCode.FAILED })),
      limiter,
    );
    for (const ms of [0, 1, 30_000, 59_999]) {
      at(ms);
      expect((await exportOnce(exporter)).code).toBe(ExportResultCode.FAILED);
    }
    expect(lines).toHaveLength(1);
    at(60_000);
    await exportOnce(exporter);
    at(60_001);
    await exportOnce(exporter);
    expect(lines).toHaveLength(2);
  });

  it("001/FR-020: a throwing exporter fails the export and warns, it never throws", async () => {
    const { limiter, lines } = recorder();
    const exporter = guardSpanExporter(
      failing(() => {
        throw new Error("boom");
      }),
      limiter,
    );
    expect((await exportOnce(exporter)).code).toBe(ExportResultCode.FAILED);
    expect(lines).toHaveLength(1);
  });

  it("001/FR-020: an exporter that calls back and then throws settles once", () => {
    const { limiter, lines } = recorder();
    const results: ExportResult[] = [];
    const exporter = guardSpanExporter(
      {
        export: (_spans, callback) => {
          callback({ code: ExportResultCode.FAILED });
          throw new Error("after callback");
        },
        shutdown: () => Promise.resolve(),
      },
      limiter,
    );
    exporter.export([], (result) => {
      results.push(result);
    });
    expect(results).toHaveLength(1);
    expect(lines).toHaveLength(1);
  });

  it("001/FR-019: the metric guard keeps the exporter's temporality and aggregation", () => {
    const { limiter } = recorder();
    const guarded = guardMetricExporter(
      new InMemoryMetricExporter(AggregationTemporality.DELTA),
      limiter,
    );
    expect(guarded.selectAggregationTemporality?.(InstrumentType.COUNTER)).toBe(
      AggregationTemporality.DELTA,
    );
    const withAggregation = guardMetricExporter(
      {
        export: (_metrics, callback) => {
          callback({ code: ExportResultCode.SUCCESS });
        },
        selectAggregation: () => ({ type: AggregationType.DROP }),
        forceFlush: () => Promise.resolve(),
        shutdown: () => Promise.resolve(),
      },
      limiter,
    );
    expect(withAggregation.selectAggregation?.(InstrumentType.COUNTER)).toEqual({
      type: AggregationType.DROP,
    });
    expect("selectAggregationTemporality" in withAggregation).toBe(false);
  });

  it("001/FR-020: successful exports never warn", async () => {
    const { limiter, lines } = recorder();
    await exportOnce(
      guardSpanExporter(
        failing(() => ({ code: ExportResultCode.SUCCESS })),
        limiter,
      ),
    );
    expect(lines).toEqual([]);
  });

  it("001/FR-020: the warning is a valid log line with time, service and env, and no error body", async () => {
    const { limiter, lines } = recorder(Date.UTC(2026, 10, 23, 12));
    const secret = ["abc", "DEF", "123", "xyz"].join("");
    const body = `upstream said token=${secret}`;
    await exportOnce(
      guardSpanExporter(
        failing(() => ({ code: ExportResultCode.FAILED, error: new Error(body) })),
        limiter,
      ),
    );
    const line: unknown = JSON.parse(lines[0] ?? "");
    expect(validateLine(line), JSON.stringify(validateLine.errors)).toBe(true);
    expect(line).toEqual({
      time: "2026-11-23T12:00:00.000Z",
      level: "warn",
      service: "riviera-worker",
      env: "ci",
      msg: DROP_WARNING_MESSAGE,
      signal: "traces",
    });
    // The text of contracts/telemetry.md ("Dropped telemetry"), literally.
    expect(DROP_WARNING_MESSAGE).toBe("telemetry export failed; dropping data");
    expect(lines[0]).not.toContain("upstream");
    expect(lines[0]).not.toContain(secret);
  });

  it("001/FR-020: diag warnings and errors go to the limiter, info does not", () => {
    const { limiter, lines, at } = recorder();
    routeDiag(limiter);
    try {
      diag.info("ignored");
      expect(lines).toEqual([]);
      diag.warn("export failed");
      at(60_000);
      diag.error("still failing");
      expect(lines.map((l): unknown => JSON.parse(l))).toMatchObject([
        { signal: "diag", msg: DIAG_WARNING_MESSAGE },
        { signal: "diag", msg: DIAG_WARNING_MESSAGE },
      ]);
    } finally {
      diag.disable();
    }
  });
});

describe("guard defaults", () => {
  it("001/FR-020: the warning goes to stdout by default", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      createDropWarning({ service: "riviera-api", env: "ci" }).warn("logs");
      expect(write).toHaveBeenCalledTimes(1);
      expect(String(write.mock.calls[0]?.[0])).toContain('"signal":"logs"');
    } finally {
      write.mockRestore();
    }
  });

  it("001/FR-020: flushing an exporter without forceFlush resolves", async () => {
    const { limiter } = recorder();
    const exporter = guardSpanExporter(
      failing(() => ({ code: ExportResultCode.SUCCESS })),
      limiter,
    );
    await expect(exporter.forceFlush?.()).resolves.toBeUndefined();
  });
});

describe("span redaction at export", () => {
  let harness: TestTelemetry | undefined;
  afterEach(async () => {
    await harness?.shutdown();
    harness = undefined;
  });

  it("001/FR-005: exported span name, attributes, events, links and status are redacted", async () => {
    harness = startTestTelemetry();
    const token = ["abc", "DEF", "123", "xyz", "789"].join("");
    const email = ["staff", "example.com"].join("@");
    const tracer = trace.getTracer("test");
    const linked = tracer.startSpan("linked");
    linked.end();
    const span = tracer.startSpan(`mail ${email}`, {
      links: [{ context: linked.spanContext(), attributes: { note: `for ${email}` } }],
    });
    span.setAttributes({
      "http.request.header.authorization": "short",
      "riviera.note": `sent to ${email}`,
      "riviera.list": [`Bearer ${token}`, "ok"],
      "riviera.count": 3,
      "riviera.flags": [true, false],
      apiKey: 42,
    });
    span.addEvent("retry", { reason: `token=${token}` });
    span.recordException(new Error(`failed for ${email}`));
    span.setStatus({ code: SpanStatusCode.ERROR, message: `Bearer ${token}` });
    span.end();

    const exported = (await harness.spans()).find((s) => s.name.startsWith("mail"));
    expect(exported).toBeDefined();
    const text = JSON.stringify(exported, (_k, v: unknown) =>
      typeof v === "bigint" ? String(v) : v,
    );
    expect(text).not.toContain(email);
    expect(text).not.toContain(token);
    expect(exported).toMatchObject({
      name: `mail ${REDACTED}`,
      attributes: {
        "http.request.header.authorization": REDACTED,
        "riviera.note": `sent to ${REDACTED}`,
        "riviera.list": [REDACTED, "ok"],
        "riviera.count": 3,
        "riviera.flags": [true, false],
        apiKey: REDACTED,
      },
      status: { code: SpanStatusCode.ERROR, message: REDACTED },
      links: [{ attributes: { note: `for ${REDACTED}` } }],
    } satisfies Partial<Record<keyof ReadableSpan, unknown>>);
    expect(exported?.events.map((e) => e.attributes)).toEqual([
      { reason: `token=${REDACTED}` },
      expect.objectContaining({ "exception.message": `failed for ${REDACTED}` }),
    ]);
    expect(exported?.spanContext()).toEqual(span.spanContext());
  });

  it("001/FR-005: long attribute values are truncated after redaction", async () => {
    harness = startTestTelemetry();
    const span = trace.getTracer("test").startSpan("long");
    span.setAttribute("riviera.text", "x".repeat(9000));
    span.end();
    const value = (await harness.spans())[0]?.attributes["riviera.text"];
    expect(typeof value === "string" && value.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(typeof value === "string" && Buffer.byteLength(value)).toBeLessThan(8300);
  });
});

describe("log record redaction at export", () => {
  let harness: TestTelemetry | undefined;
  afterEach(async () => {
    await harness?.shutdown();
    harness = undefined;
  });

  it("001/FR-005: a log record emitted around the logger is still redacted and truncated", async () => {
    harness = startTestTelemetry();
    const token = ["abc", "DEF", "123", "xyz", "789"].join("");
    const email = ["staff", "example.com"].join("@");
    logs.getLogger("test").emit({
      eventName: `mail ${email}`,
      severityNumber: SeverityNumber.WARN,
      severityText: "warn",
      body: `sent to ${email}`,
      attributes: { password: "hunter2", note: `Bearer ${token}`, long: "x".repeat(9000), n: 1 },
    });
    const [record, ...others] = await harness.logs();
    expect(others).toEqual([]);
    expect(record).toMatchObject({
      eventName: `mail ${REDACTED}`,
      severityNumber: SeverityNumber.WARN,
      severityText: "warn",
      body: `sent to ${REDACTED}`,
      attributes: { password: REDACTED, note: REDACTED, n: 1 },
    });
    const long = record?.attributes["long"];
    expect(typeof long === "string" && long.endsWith(TRUNCATION_MARKER)).toBe(true);
  });

  it("001/FR-005: a record without body or event name keeps its trace context", async () => {
    harness = startTestTelemetry();
    const span = trace.getTracer("test").startSpan("work");
    logs
      .getLogger("test")
      .emit({ attributes: { n: 1 }, context: trace.setSpan(ROOT_CONTEXT, span) });
    span.end();
    const [record] = await harness.logs();
    expect(record?.body).toBeUndefined();
    expect(record?.eventName).toBeUndefined();
    expect(record?.spanContext).toEqual(span.spanContext());
  });
});
