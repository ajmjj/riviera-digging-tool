// Structured logger (research R3, contracts/telemetry.md#logs). One JSON object per line on
// stdout with `time`, `level`, `service`, `env`, `msg` and the active span's `trace_id` and
// `span_id` (001/FR-001). The message and every field are redacted (001/FR-005) and then
// truncated (001/FR-006) before the line is serialised. Each finished line is also bridged to
// the OpenTelemetry logs API, so the exported record can never hold anything stdout didn't.

import { format } from "node:util";
import {
  context,
  isValidSpanId,
  isValidTraceId,
  logs,
  ROOT_CONTEXT,
  SeverityNumber,
  trace,
  TraceFlags,
  type Context,
} from "@opentelemetry/api";
import {
  pino,
  stdTimeFunctions,
  type Bindings,
  type ChildLoggerOptions,
  type LogFn,
  type Logger,
} from "pino";
import { isSecretName, REDACTED, redactText, sanitize } from "./redact.ts";
import type { ServiceName } from "./sdk.ts";
import { truncateText } from "./truncate.ts";

export interface LoggerOptions {
  readonly service: ServiceName;
  /** `DEPLOYMENT_ENVIRONMENT`, as in the telemetry resource. */
  readonly env: string;
  readonly level: string;
  /** Receives each line, newline included; stdout by default. */
  readonly write?: (line: string) => void;
}

/**
 * Research R4: the only request headers ever logged. `x-request-id` is not on it: the validated
 * ID is logged as `request_id`, and the raw header never is (001/FR-003).
 */
const LOGGED_HEADERS: readonly string[] = ["user-agent", "content-type"];

const SCOPE = "@riviera/telemetry/logger";

const SEVERITY: Readonly<Record<string, SeverityNumber>> = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
  fatal: SeverityNumber.FATAL,
};

// Fields the bridge maps to the record itself; the resource already carries service and env.
const RECORD_FIELDS: ReadonlySet<string> = new Set([
  "time",
  "level",
  "msg",
  "trace_id",
  "span_id",
  "service",
  "env",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(text: string): string {
  return truncateText(redactText(text));
}

/** `{ method, url, headers }` with only the allow-listed headers; no body, no client address. */
function serialiseRequest(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const method: unknown = Reflect.get(value, "method");
  const url: unknown = Reflect.get(value, "url");
  const headers: unknown = Reflect.get(value, "headers");
  const kept: Record<string, string> = {};
  if (isRecord(headers)) {
    for (const name of LOGGED_HEADERS) {
      const header = headers[name];
      if (typeof header === "string") {
        kept[name] = header;
      }
    }
  }
  return {
    ...(typeof method === "string" ? { method } : {}),
    ...(typeof url === "string" ? { url } : {}),
    headers: kept,
  };
}

/** `{ statusCode }` only, so a reply's headers and payload are never logged. */
function serialiseReply(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const statusCode: unknown = Reflect.get(value, "statusCode");
  return typeof statusCode === "number" ? { statusCode } : {};
}

/** `{ type, message, stack }` (contracts/telemetry.md#logs); other fields are dropped. */
function serialiseError(value: unknown): unknown {
  if (!(value instanceof Error)) {
    return value;
  }
  return {
    type: value.name,
    message: value.message,
    ...(value.stack === undefined ? {} : { stack: value.stack }),
  };
}

const SERIALISERS: Readonly<Record<string, (value: unknown) => unknown>> = {
  req: serialiseRequest,
  res: serialiseReply,
  err: serialiseError,
};

// pino applies `serializers` after `formatters.log`, so serialising there would come after
// redaction. The fields are serialised in `formatters.log` instead, and these pass-throughs
// replace Fastify's default serialisers (which would add the client address).
const asIs = (value: unknown): unknown => value;

/** Serialises, then redacts and truncates each field the way `sanitize` does nested ones. */
function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      redactText(key),
      isSecretName(key) ? REDACTED : sanitize(SERIALISERS[key]?.(value) ?? value),
    ]),
  );
}

function activeSpanIds(): Record<string, string> {
  const span = trace.getSpanContext(context.active());
  return span === undefined || !isValidTraceId(span.traceId) || !isValidSpanId(span.spanId)
    ? {}
    : { trace_id: span.traceId, span_id: span.spanId };
}

// The message never reaches pino's own interpolation: it is formatted here, then redacted and
// truncated as one string. An error logged without a message gets its (redacted) message.
function logMethod(this: Logger, args: Parameters<LogFn>, method: LogFn): void {
  const input: readonly unknown[] = args;
  const [first, ...rest] = input;
  if (typeof first !== "object" || first === null) {
    method.call(this, cleanText(format(...input)));
    return;
  }
  let text = "";
  if (rest.length > 0) {
    text = format(...rest);
  } else if (first instanceof Error) {
    text = first.message;
  } else if (isRecord(first) && typeof first["msg"] === "string") {
    text = first["msg"];
  }
  method.call(this, first, cleanText(text));
}

function traceContext(traceId: unknown, spanId: unknown): Context {
  return typeof traceId === "string" &&
    typeof spanId === "string" &&
    isValidTraceId(traceId) &&
    isValidSpanId(spanId)
    ? trace.setSpanContext(ROOT_CONTEXT, { traceId, spanId, traceFlags: TraceFlags.SAMPLED })
    : ROOT_CONTEXT;
}

/** Emits one serialised line as an OTel log record: body, severity, trace context, fields. */
function bridge(line: string): void {
  // pino writes one object per line, always with `time` and a `level` label.
  const parsed: unknown = JSON.parse(line);
  const fields = isRecord(parsed) ? parsed : {};
  const level = String(fields["level"]);
  logs.getLogger(SCOPE).emit({
    timestamp: new Date(String(fields["time"])),
    severityText: level,
    severityNumber: SEVERITY[level] ?? SeverityNumber.UNSPECIFIED,
    body: fields["msg"],
    attributes: Object.fromEntries(
      Object.entries(fields).filter(([key]) => !RECORD_FIELDS.has(key)),
    ),
    context: traceContext(fields["trace_id"], fields["span_id"]),
  });
}

// pino serialises a child's bindings once, without `formatters.log`, and resets the bindings
// formatter for children. The returned logger is a child of the configured one whose `child`
// cleans the bindings first; every descendant (Fastify's per-request children included)
// inherits that override, while the configured logger keeps pino's own `child` to call.
function redactChildBindings(base: Logger): Logger {
  const root = base.child({});
  root.child = function <L extends string = never>(
    this: Logger,
    bindings: Bindings,
    childOptions?: ChildLoggerOptions<L>,
  ): Logger<L> {
    const clean = cleanFields(bindings);
    return childOptions === undefined
      ? base.child.call<Logger, [Bindings], Logger<L>>(this, clean)
      : base.child.call<Logger, [Bindings, ChildLoggerOptions<L>], Logger<L>>(
          this,
          clean,
          childOptions,
        );
  };
  return root;
}

/** The api's and worker's logger; pass it to Fastify as `loggerInstance`. */
export function createLogger(options: LoggerOptions): Logger {
  const write =
    options.write ??
    ((line: string): void => {
      process.stdout.write(line);
    });
  const logger = pino(
    {
      level: options.level,
      base: { service: options.service, env: options.env },
      timestamp: stdTimeFunctions.isoTime,
      mixin: activeSpanIds,
      formatters: {
        level: (label) => ({ level: label }),
        // Root bindings (`base`) only; see redactChildBindings for the children's.
        bindings: cleanFields,
        log: cleanFields,
      },
      serializers: { req: asIs, res: asIs, err: asIs },
      hooks: { logMethod },
    },
    {
      write: (line: string): void => {
        write(line);
        bridge(line);
      },
    },
  );
  return redactChildBindings(logger);
}
