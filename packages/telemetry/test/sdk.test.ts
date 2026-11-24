import { createServer, type Server } from "node:http";
import {
  context,
  logs,
  metrics,
  propagation,
  SeverityNumber,
  TraceFlags,
  trace,
} from "@opentelemetry/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDropWarning } from "../src/export-guard.ts";
import { createInstruments } from "../src/instruments.ts";
import {
  otlpExporters,
  SHUTDOWN_TIMEOUT_MS,
  startTelemetry,
  within,
  type Exporters,
} from "../src/sdk.ts";
import { INSTRUMENTS } from "../src/slo-metrics.ts";
import { startTestTelemetry, type TestTelemetry } from "../src/testing.ts";

interface Sink {
  readonly url: string;
  readonly paths: string[];
  readonly close: () => Promise<void>;
}

/** A local stand-in for the collector that records request paths and answers `status`. */
async function sink(status = 200, body = ""): Promise<Sink> {
  const paths: string[] = [];
  const server: Server = createServer((req, res) => {
    paths.push(req.url ?? "");
    req.resume();
    req.on("end", () => res.writeHead(status).end(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no TCP address");
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    paths,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** Emits one span, one metric point and one log record through the global providers. */
function emitEach(): void {
  trace.getTracer("test").startSpan("work").end();
  metrics.getMeter("test").createCounter("test.count").add(1);
  logs.getLogger("test").emit({ severityNumber: SeverityNumber.INFO, body: "hello" });
}

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const step of cleanup.reverse()) await step();
  cleanup = [];
  delete process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];
});

function harness(options: Parameters<typeof startTestTelemetry>[0] = {}): TestTelemetry {
  const h = startTestTelemetry(options);
  cleanup.push(() => h.shutdown());
  return h;
}

describe("startTelemetry", () => {
  it("001/FR-019: no exporter is created when the endpoint is unset, empty or blank", () => {
    expect(otlpExporters(undefined)).toEqual([]);
    expect(otlpExporters("")).toEqual([]);
    expect(otlpExporters("  ")).toEqual([]);
    expect(otlpExporters("http://collector:4318/")).toHaveLength(1);
    expect(otlpExporters("///")).toEqual([]);
  });

  it("001/FR-019: without an endpoint nothing is sent, even with the OTLP env var set", async () => {
    const collector = await sink();
    cleanup.push(() => collector.close());
    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] = collector.url;
    for (const endpoint of [undefined, ""]) {
      const telemetry = startTelemetry({
        service: "riviera-api",
        version: "1.0.0",
        environment: "ci",
        endpoint,
      });
      emitEach();
      await telemetry.forceFlush();
      await telemetry.shutdown();
    }
    expect(collector.paths).toEqual([]);
  });

  it("001/FR-019: with an endpoint, traces, metrics and logs go to it over OTLP/HTTP", async () => {
    const collector = await sink();
    cleanup.push(() => collector.close());
    const telemetry = startTelemetry({
      service: "riviera-worker",
      version: "1.0.0",
      environment: "ci",
      endpoint: `${collector.url}/`,
    });
    emitEach();
    await telemetry.forceFlush();
    await telemetry.shutdown();
    expect([...new Set(collector.paths)].sort()).toEqual(["/v1/logs", "/v1/metrics", "/v1/traces"]);
  });

  it("001/FR-020: an unreachable collector drops telemetry with one warning and no body", async () => {
    const secret = ["abc", "DEF", "123", "xyz"].join("");
    const collector = await sink(400, `token=${secret}`);
    cleanup.push(() => collector.close());
    const lines: string[] = [];
    const telemetry = startTelemetry({
      service: "riviera-api",
      version: "1.0.0",
      environment: "ci",
      endpoint: collector.url,
      dropWarning: createDropWarning({
        service: "riviera-api",
        env: "ci",
        write: (l) => {
          lines.push(l);
        },
      }),
    });
    emitEach();
    await telemetry.forceFlush();
    await telemetry.shutdown();
    expect(collector.paths.length).toBeGreaterThan(0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(secret);
  });

  it("001/FR-020: shutdown returns within its timeout when an exporter hangs", async () => {
    const never = new Promise<void>(() => undefined);
    const hanging: Exporters = {
      spans: { export: () => undefined, shutdown: () => never, forceFlush: () => never },
      metrics: { export: () => undefined, shutdown: () => never, forceFlush: () => never },
      logs: { export: () => undefined, shutdown: () => never, forceFlush: () => never },
    };
    const telemetry = startTelemetry({
      service: "riviera-api",
      version: "1.0.0",
      environment: "ci",
      exporters: [hanging],
    });
    const started = Date.now();
    await telemetry.shutdown();
    expect(Date.now() - started).toBeLessThan(SHUTDOWN_TIMEOUT_MS + 500);
  });

  it("001/FR-020: within() stops waiting for pending work after its bound", async () => {
    vi.useFakeTimers();
    try {
      let settled = false;
      const waiting = within(new Promise<void>(() => undefined), 1000).then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("001/FR-020: within() settles as soon as the work does, rejections included", async () => {
    await expect(within(Promise.resolve(), 60_000)).resolves.toBeUndefined();
    await expect(within(Promise.reject(new Error("flush failed")), 60_000)).rejects.toThrow(
      "flush failed",
    );
  });

  it("001/FR-019: the test harness receives spans, metrics and logs", async () => {
    const h = harness();
    emitEach();
    expect((await h.spans()).map((s) => s.name)).toEqual(["work"]);
    expect((await h.metrics()).map((m) => m.descriptor.name)).toContain("test.count");
    expect((await h.logs()).map((l) => l.body)).toEqual(["hello"]);
  });

  it("001/FR-023: a parent with sampled=0 is still kept, in the same trace", async () => {
    const h = harness();
    const parent = {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: TraceFlags.NONE,
      isRemote: true,
    };
    const ctx = trace.setSpanContext(context.active(), parent);
    trace.getTracer("test").startSpan("child", {}, ctx).end();
    const [span] = await h.spans();
    expect(span?.spanContext().traceId).toBe(parent.traceId);
    expect(span?.parentSpanContext?.spanId).toBe(parent.spanId);
    expect(span?.spanContext().traceFlags).toBe(TraceFlags.SAMPLED);
  });

  it("001/FR-019: resource attributes follow data-model §5", async () => {
    const h = harness({ service: "riviera-worker", version: "2.3.4", environment: "development" });
    trace.getTracer("test").startSpan("work").end();
    const [span] = await h.spans();
    expect(span?.resource.attributes).toMatchObject({
      "service.name": "riviera-worker",
      "service.namespace": "riviera",
      "service.version": "2.3.4",
      "deployment.environment.name": "development",
    });
  });

  it("001/FR-019: W3C trace context propagates, and the active span survives an await", async () => {
    const h = harness();
    const tracer = trace.getTracer("test");
    await tracer.startActiveSpan("outer", async (outer) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(trace.getActiveSpan()).toBe(outer);
      const carrier: Record<string, string> = {};
      propagation.inject(context.active(), carrier);
      const { traceId, spanId } = outer.spanContext();
      expect(carrier["traceparent"]).toBe(`00-${traceId}-${spanId}-01`);
      outer.end();
    });
    expect(await h.spans()).toHaveLength(1);
  });

  it("001/FR-014, 001/FR-017: the registry's histogram buckets survive the real provider", async () => {
    const h = harness();
    const instruments = createInstruments(h.telemetry.meterProvider.getMeter("test"), {
      routes: ["POST /sample/trace"],
    });
    instruments.record("riviera.http.server.duration", 0.2, {
      route: "POST /sample/trace",
      method: "POST",
      status_class: "2xx",
    });
    const exported = (await h.metrics()).find(
      (m) => m.descriptor.name === "riviera.http.server.duration",
    );
    const point = exported?.dataPoints[0]?.value;
    const boundaries =
      typeof point === "object" && "buckets" in point ? point.buckets.boundaries : undefined;
    const def = INSTRUMENTS.find((d) => d.name === "riviera.http.server.duration");
    expect(boundaries).toEqual(def?.buckets);
  });
});
