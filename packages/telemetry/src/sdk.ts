// SDK bootstrap (research R1, R2, R5; data-model.md §5). The three providers are assembled by
// hand: every trace is kept (001/FR-023), W3C trace context, AsyncLocalStorage context, and
// OTLP/HTTP export only when an endpoint is given (001/FR-019). Without one the providers still
// exist, so trace and span IDs reach the logs and tests can attach in-memory exporters. Every
// exporter goes through the export guard (001/FR-005, 001/FR-020).

import { context, diag, logs, metrics, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  type LogRecordExporter,
} from "@opentelemetry/sdk-logs";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  type PushMetricExporter,
} from "@opentelemetry/sdk-metrics";
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  TracerProvider,
  type SpanExporter,
} from "@opentelemetry/sdk-trace";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  createDropWarning,
  guardLogExporter,
  guardMetricExporter,
  guardSpanExporter,
  routeDiag,
  type DropWarning,
} from "./export-guard.ts";

export type ServiceName = "riviera-api" | "riviera-worker";

/** One exporter per signal; each is wrapped by the export guard before it is attached. */
export interface Exporters {
  readonly spans: SpanExporter;
  readonly metrics: PushMetricExporter;
  readonly logs: LogRecordExporter;
}

export interface TelemetryOptions {
  readonly service: ServiceName;
  readonly version: string;
  /** `DEPLOYMENT_ENVIRONMENT`, already resolved by the config (unset means `production`). */
  readonly environment: string;
  /** `OTEL_EXPORTER_OTLP_ENDPOINT`; unset or empty turns OTLP export off. */
  readonly endpoint?: string | undefined;
  /** More exporters, e.g. the in-memory ones of `testing.ts`. */
  readonly exporters?: readonly Exporters[];
  /** The limiter for dropped telemetry; one writing to stdout by default. */
  readonly dropWarning?: DropWarning;
}

export interface Telemetry {
  readonly tracerProvider: TracerProvider;
  readonly meterProvider: MeterProvider;
  readonly loggerProvider: LoggerProvider;
  /** Exports everything buffered now (e.g. the zero counters before `listen`, R18). */
  readonly forceFlush: () => Promise<void>;
  /** Flushes and stops within `SHUTDOWN_TIMEOUT_MS`; never rejects. */
  readonly shutdown: () => Promise<void>;
}

export const SPAN_EXPORT_DELAY_MS = 1000;
export const EXPORT_QUEUE_SIZE = 2048;
export const METRIC_EXPORT_INTERVAL_MS = 5000;
export const SHUTDOWN_TIMEOUT_MS = 2000;

// A loop rather than /\/+$/, which backtracks quadratically on a long run of slashes.
function withoutTrailingSlashes(text: string): string {
  let end = text.length;
  while (end > 0 && text.charAt(end - 1) === "/") {
    end -= 1;
  }
  return text.slice(0, end);
}

/** The OTLP/HTTP exporters for `endpoint`, or none when it is unset or blank (001/FR-019). */
export function otlpExporters(endpoint: string | undefined): Exporters[] {
  const base = withoutTrailingSlashes(endpoint?.trim() ?? "");
  if (base === "") {
    return [];
  }
  return [
    {
      spans: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
      metrics: new OTLPMetricExporter({ url: `${base}/v1/metrics` }),
      logs: new OTLPLogExporter({ url: `${base}/v1/logs` }),
    },
  ];
}

/** Builds and registers the global providers. Call once per process (or per test). */
export function startTelemetry(options: TelemetryOptions): Telemetry {
  const limiter =
    options.dropWarning ??
    createDropWarning({ service: options.service, env: options.environment });
  routeDiag(limiter);

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: options.service,
    [ATTR_SERVICE_NAMESPACE]: "riviera",
    [ATTR_SERVICE_VERSION]: options.version,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
  });
  const exporters = [...otlpExporters(options.endpoint), ...(options.exporters ?? [])];
  const batch = { scheduledDelayMillis: SPAN_EXPORT_DELAY_MS, maxQueueSize: EXPORT_QUEUE_SIZE };

  const tracerProvider = new TracerProvider({
    resource,
    sampler: new AlwaysOnSampler(),
    spanProcessors: exporters.map(
      (e) => new BatchSpanProcessor({ ...batch, exporter: guardSpanExporter(e.spans, limiter) }),
    ),
  });
  // No views: the histogram buckets come from each instrument's advice (T003).
  const meterProvider = new MeterProvider({
    resource,
    readers: exporters.map(
      (e) =>
        new PeriodicExportingMetricReader({
          exporter: guardMetricExporter(e.metrics, limiter),
          exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
          exportTimeoutMillis: METRIC_EXPORT_INTERVAL_MS,
        }),
    ),
  });
  const loggerProvider = new LoggerProvider({
    resource,
    processors: exporters.map(
      (e) => new BatchLogRecordProcessor({ ...batch, exporter: guardLogExporter(e.logs, limiter) }),
    ),
  });

  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(tracerProvider);
  metrics.setGlobalMeterProvider(meterProvider);
  logs.setGlobalLoggerProvider(loggerProvider);

  const forceFlush = async (): Promise<void> => {
    await Promise.allSettled([
      tracerProvider.forceFlush(),
      meterProvider.forceFlush(),
      loggerProvider.forceFlush(),
    ]);
  };
  const stop = async (): Promise<void> => {
    await Promise.allSettled([
      tracerProvider.shutdown(),
      meterProvider.shutdown(),
      loggerProvider.shutdown(),
    ]);
  };
  const shutdown = async (): Promise<void> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
      timer.unref();
    });
    await Promise.race([stop(), timeout]);
    clearTimeout(timer);
    trace.disable();
    metrics.disable();
    logs.disable();
    propagation.disable();
    context.disable();
    diag.disable();
  };
  return { tracerProvider, meterProvider, loggerProvider, forceFlush, shutdown };
}
