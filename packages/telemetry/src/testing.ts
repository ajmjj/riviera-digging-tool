// Test harness: the real SDK of sdk.ts with in-memory exporters attached the same way as the
// OTLP ones, through the export guard, so tests see exactly what would leave the process.

import { InMemoryLogRecordExporter, type ReadableLogRecord } from "@opentelemetry/sdk-logs";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  type MetricData,
} from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace";
import { startTelemetry, type Exporters, type Telemetry, type TelemetryOptions } from "./sdk.ts";

export interface TestTelemetry {
  readonly telemetry: Telemetry;
  /** Flushes, then returns every span exported so far. */
  readonly spans: () => Promise<ReadableSpan[]>;
  /** Flushes, then returns every log record exported so far. */
  readonly logs: () => Promise<ReadableLogRecord[]>;
  /** Flushes, then returns the metrics of the latest export (cumulative). */
  readonly metrics: () => Promise<MetricData[]>;
  readonly shutdown: () => Promise<void>;
}

export function startTestTelemetry(options: Partial<TelemetryOptions> = {}): TestTelemetry {
  const spans = new InMemorySpanExporter();
  const logs = new InMemoryLogRecordExporter();
  const metrics = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const telemetry = startTelemetry({
    service: "riviera-api",
    version: "0.0.0-test",
    environment: "ci",
    ...options,
    exporters: [...(options.exporters ?? []), { spans, logs, metrics }],
  });
  return {
    telemetry,
    spans: async () => {
      await telemetry.forceFlush();
      return spans.getFinishedSpans();
    },
    logs: async () => {
      await telemetry.forceFlush();
      return logs.getFinishedLogRecords();
    },
    metrics: async () => {
      await telemetry.forceFlush();
      return (
        metrics
          .getMetrics()
          .at(-1)
          ?.scopeMetrics.flatMap((scope) => scope.metrics) ?? []
      );
    },
    shutdown: () => telemetry.shutdown(),
  };
}

export interface MemoryExporters {
  readonly exporters: Exporters;
  readonly spans: () => ReadableSpan[];
  readonly logs: () => ReadableLogRecord[];
  /** The metrics of the latest export (cumulative). */
  readonly metrics: () => MetricData[];
}

/**
 * In-memory exporters to hand to code that starts its own SDK (the api's startup). Their
 * shutdown keeps what was exported, so it stays readable once the service has stopped.
 */
export function memoryExporters(): MemoryExporters {
  const spans = new InMemorySpanExporter();
  const logs = new InMemoryLogRecordExporter();
  const metrics = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const kept = { shutdown: () => Promise.resolve() };
  const exporters: Exporters = {
    spans: { ...kept, export: spans.export.bind(spans), forceFlush: () => spans.forceFlush() },
    logs: { ...kept, export: logs.export.bind(logs), forceFlush: () => logs.forceFlush() },
    metrics,
  };
  return {
    exporters,
    spans: () => spans.getFinishedSpans(),
    logs: () => logs.getFinishedLogRecords(),
    metrics: () =>
      metrics
        .getMetrics()
        .at(-1)
        ?.scopeMetrics.flatMap((scope) => scope.metrics) ?? [],
  };
}
