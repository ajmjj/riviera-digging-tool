// Export guard (research R5, spec 001/FR-005, 001/FR-020). Every exporter, OTLP or in-memory,
// is wrapped here: span data is redacted and truncated before it leaves the process, and a
// failed export reports to one `DropWarning` limiter that writes at most one warning a minute
// straight to stdout (not through the bridged logger, so it cannot loop). The warning names
// the signal only: an exporter's error can carry the collector's response body, which is
// never recorded.

import { DiagLogLevel, diag, type Attributes } from "@opentelemetry/api";
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import type { LogRecordExporter, ReadableLogRecord } from "@opentelemetry/sdk-logs";
import type { PushMetricExporter, ResourceMetrics } from "@opentelemetry/sdk-metrics";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace";
import { isSecretName, REDACTED, redactText, sanitize } from "./redact.ts";
import { truncateText } from "./truncate.ts";

type Signal = "traces" | "metrics" | "logs" | "diag";

export interface DropWarningOptions {
  readonly service: string;
  readonly env: string;
  /** Milliseconds since the epoch; injected in tests. */
  readonly now?: () => number;
  /** Receives one JSON line, newline included; stdout by default. */
  readonly write?: (line: string) => void;
}

export interface DropWarning {
  /** Notes that telemetry of `signal` was dropped; writes a warning at most once a minute. */
  readonly warn: (signal: Signal) => void;
}

const DROP_WARNING_INTERVAL_MS = 60_000;
/** The text of contracts/telemetry.md ("Dropped telemetry"). */
export const DROP_WARNING_MESSAGE = "telemetry export failed; dropping data";
/** For `diag` warnings, which are not always about export (e.g. a duplicate registration). */
export const DIAG_WARNING_MESSAGE = "OpenTelemetry SDK reported a problem";

export function createDropWarning(options: DropWarningOptions): DropWarning {
  const now = options.now ?? Date.now;
  const write =
    options.write ??
    ((line: string): void => {
      process.stdout.write(line);
    });
  let last: number | undefined;
  return {
    warn: (signal) => {
      const time = now();
      if (last !== undefined && time - last < DROP_WARNING_INTERVAL_MS) {
        return;
      }
      last = time;
      const line = {
        time: new Date(time).toISOString(),
        level: "warn",
        service: options.service,
        env: options.env,
        msg: signal === "diag" ? DIAG_WARNING_MESSAGE : DROP_WARNING_MESSAGE,
        signal,
      };
      write(`${JSON.stringify(line)}\n`);
    },
  };
}

/** Routes the OpenTelemetry `diag` logger to the limiter at WARN (R5). */
export function routeDiag(limiter: DropWarning): void {
  const warn = (): void => {
    limiter.warn("diag");
  };
  const ignore = (): void => undefined;
  diag.setLogger(
    { error: warn, warn, info: ignore, debug: ignore, verbose: ignore },
    { logLevel: DiagLogLevel.WARN, suppressOverrideMessage: true },
  );
}

function cleanText(text: string): string {
  return truncateText(redactText(text));
}

// Attribute values may be any value (strings, arrays, maps); `sanitize` redacts and truncates
// each the way it does log fields (R4). Byte arrays carry no text and are kept.
function cleanValue(value: unknown): unknown {
  return value instanceof Uint8Array ? value : sanitize(value);
}

/** Redacts secret-named attributes and every value inside the others. */
function cleanAttributes(attributes: Attributes): Attributes {
  const result: Attributes = {};
  // Keys are set by code, so two keys redacting to the same text (the later one wins) would
  // mean a secret-shaped key name, already a bug at the call site.
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      result[redactText(key)] = isSecretName(key) ? REDACTED : cleanValue(value);
    }
  }
  return result;
}

/** A copy of the span whose name, attributes, events, links and status are redacted. */
function cleanSpan(span: ReadableSpan): ReadableSpan {
  const { status } = span;
  return {
    name: cleanText(span.name),
    kind: span.kind,
    spanContext: () => span.spanContext(),
    ...(span.parentSpanContext === undefined ? {} : { parentSpanContext: span.parentSpanContext }),
    startTime: span.startTime,
    endTime: span.endTime,
    status:
      status.message === undefined
        ? status
        : { code: status.code, message: cleanText(status.message) },
    attributes: cleanAttributes(span.attributes),
    links: span.links.map((link) =>
      link.attributes === undefined
        ? link
        : { ...link, attributes: cleanAttributes(link.attributes) },
    ),
    events: span.events.map((event) => ({
      ...event,
      name: cleanText(event.name),
      ...(event.attributes === undefined ? {} : { attributes: cleanAttributes(event.attributes) }),
    })),
    duration: span.duration,
    ended: span.ended,
    resource: span.resource,
    instrumentationScope: span.instrumentationScope,
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
  };
}

// Wraps an exporter's `export`: a failed result or a throw warns, and the caller's callback
// gets exactly one result, so a failing exporter never stalls a batch processor (an exporter
// that calls back and then throws is settled once).
function guardExport<T>(
  signal: Signal,
  limiter: DropWarning,
  run: (items: T, done: (result: ExportResult) => void) => void,
): (items: T, callback: (result: ExportResult) => void) => void {
  return (items, callback) => {
    let settled = false;
    const done = (result: ExportResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (result.code !== ExportResultCode.SUCCESS) {
        limiter.warn(signal);
      }
      callback(result);
    };
    try {
      run(items, done);
    } catch (error: unknown) {
      done({ code: ExportResultCode.FAILED, ...(error instanceof Error ? { error } : {}) });
    }
  };
}

export function guardSpanExporter(inner: SpanExporter, limiter: DropWarning): SpanExporter {
  return {
    export: guardExport("traces", limiter, (spans: ReadableSpan[], done) => {
      inner.export(spans.map(cleanSpan), done);
    }),
    shutdown: () => inner.shutdown(),
    forceFlush: () => inner.forceFlush?.() ?? Promise.resolve(),
  };
}

/** A copy of the log record whose event name, body and attributes are redacted. */
function cleanLogRecord(record: ReadableLogRecord): ReadableLogRecord {
  return {
    hrTime: record.hrTime,
    hrTimeObserved: record.hrTimeObserved,
    ...(record.spanContext === undefined ? {} : { spanContext: record.spanContext }),
    ...(record.severityText === undefined ? {} : { severityText: record.severityText }),
    ...(record.severityNumber === undefined ? {} : { severityNumber: record.severityNumber }),
    ...(record.body === undefined ? {} : { body: cleanValue(record.body) }),
    ...(record.eventName === undefined ? {} : { eventName: cleanText(record.eventName) }),
    resource: record.resource,
    instrumentationScope: record.instrumentationScope,
    attributes: cleanAttributes(record.attributes),
    droppedAttributesCount: record.droppedAttributesCount,
  };
}

/**
 * The logger redacts every line before it is bridged (logger.ts); log records are redacted
 * again here, so a record emitted any other way can't leak either. Failures warn.
 */
export function guardLogExporter(
  inner: LogRecordExporter,
  limiter: DropWarning,
): LogRecordExporter {
  return {
    export: guardExport("logs", limiter, (logs: ReadableLogRecord[], done) => {
      inner.export(logs.map(cleanLogRecord), done);
    }),
    shutdown: () => inner.shutdown(),
    forceFlush: () => inner.forceFlush(),
  };
}

/** Metric labels are closed sets (001/FR-018), so metrics are only guarded for failures. */
export function guardMetricExporter(
  inner: PushMetricExporter,
  limiter: DropWarning,
): PushMetricExporter {
  return {
    export: guardExport("metrics", limiter, (metrics: ResourceMetrics, done) => {
      inner.export(metrics, done);
    }),
    shutdown: () => inner.shutdown(),
    forceFlush: () => inner.forceFlush(),
    // The reader reads temporality and aggregation from its exporter, so keep the inner ones.
    ...(inner.selectAggregationTemporality === undefined
      ? {}
      : { selectAggregationTemporality: inner.selectAggregationTemporality.bind(inner) }),
    ...(inner.selectAggregation === undefined
      ? {}
      : { selectAggregation: inner.selectAggregation.bind(inner) }),
  };
}
