import {
  DataPointType,
  MeterProvider,
  MetricReader,
  type MetricData,
} from "@opentelemetry/sdk-metrics";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createInstruments,
  type CounterName,
  type HistogramName,
  type Instruments,
  type LabelsOf,
} from "../src/instruments.ts";
import { INSTRUMENTS, SLO_METRIC_NAMES, type InstrumentDef } from "../src/slo-metrics.ts";

class TestReader extends MetricReader {
  protected override onShutdown(): Promise<void> {
    return Promise.resolve();
  }
  protected override onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

const ROUTES = ["POST /sample/trace", "GET /sample/job"];
const registry: readonly InstrumentDef[] = INSTRUMENTS;

function setup(): { instruments: Instruments; collect: () => Promise<MetricData[]> } {
  const reader = new TestReader();
  const provider = new MeterProvider({ readers: [reader] });
  const instruments = createInstruments(provider.getMeter("test"), { routes: ROUTES });
  const collect = async (): Promise<MetricData[]> => {
    const { resourceMetrics, errors } = await reader.collect();
    expect(errors).toEqual([]);
    return resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics);
  };
  return { instruments, collect };
}

function metric(metrics: readonly MetricData[], name: string): MetricData {
  const found = metrics.find((m) => m.descriptor.name === name);
  if (found === undefined) throw new Error(`${name} was not exported`);
  return found;
}

function def(name: string): InstrumentDef {
  const found = registry.find((d) => d.name === name);
  if (found === undefined) throw new Error(`${name} is not in the registry`);
  return found;
}

/** Number of label combinations of a counter, with `route` closed by ROUTES plus `unmatched`. */
function combinationCount(d: InstrumentDef): number {
  return Object.values(d.labels).reduce(
    (n, values) => n * (values === "route" ? ROUTES.length + 1 : values.length),
    1,
  );
}

/** Calls a recorder the way an untyped (JavaScript) caller could. */
function callUntyped(fn: unknown, ...args: unknown[]): void {
  if (typeof fn !== "function") throw new Error("not a function");
  Reflect.apply(fn, undefined, args);
}

describe("createInstruments", () => {
  it("001/FR-015, 001/FR-016, 001/FR-017: each recorder emits the contract name, unit and labels", async () => {
    const { instruments, collect } = setup();
    instruments.add("riviera.external.calls", 1, {
      service: "discogs",
      operation: "GET /releases/{id}",
      outcome: "rate_limited",
    });
    instruments.record("riviera.external.duration", 0.2, {
      service: "common_ground",
      operation: "SampleShopConfig",
      outcome: "success",
    });
    instruments.add("riviera.jobs.runs", 1, {
      job_name: "sample.discogs_release",
      outcome: "failed",
    });
    instruments.add("riviera.jobs.failures", 1, { job_name: "sample.discogs_release" });
    instruments.record("riviera.jobs.duration", 1.5, {
      job_name: "sample.discogs_release",
      outcome: "failed",
    });
    instruments.record("riviera.http.server.duration", 0.04, {
      route: "POST /sample/trace",
      method: "POST",
      status_class: "2xx",
    });
    instruments.observe("riviera.queue.depth", (report) => {
      report(3, { job_name: "sample.discogs_release" });
    });

    const metrics = await collect();
    for (const name of [
      "riviera.external.calls",
      "riviera.external.duration",
      "riviera.jobs.runs",
      "riviera.jobs.failures",
      "riviera.jobs.duration",
      "riviera.http.server.duration",
      "riviera.queue.depth",
    ]) {
      const exported = metric(metrics, name);
      const expected = def(name);
      expect(exported.descriptor.unit).toBe(expected.unit);
      expect(exported.descriptor.description).toBe(expected.description);
      expect(exported.dataPoints).toHaveLength(1);
      for (const point of exported.dataPoints) {
        expect(Object.keys(point.attributes).sort()).toEqual(Object.keys(expected.labels).sort());
      }
    }
    expect(metric(metrics, "riviera.external.calls").dataPoints[0]?.attributes).toEqual({
      service: "discogs",
      operation: "GET /releases/{id}",
      outcome: "rate_limited",
    });
    expect(metric(metrics, "riviera.queue.depth").dataPoints[0]?.value).toBe(3);
  });

  it("001/FR-014, 001/FR-017: histograms use the registry's bucket boundaries", async () => {
    const { instruments, collect } = setup();
    instruments.record("riviera.verdict.duration", 0.31);
    instruments.record("riviera.http.server.duration", 0.3, {
      route: "unmatched",
      method: "GET",
      status_class: "4xx",
    });
    const metrics = await collect();
    for (const name of ["riviera.verdict.duration", "riviera.http.server.duration"]) {
      const exported = metric(metrics, name);
      expect(exported.dataPointType).toBe(DataPointType.HISTOGRAM);
      if (exported.dataPointType !== DataPointType.HISTOGRAM) return;
      expect(exported.dataPoints[0]?.value.buckets.boundaries).toEqual(def(name).buckets);
    }
  });

  it("001/FR-018: an out-of-set label is a type error", () => {
    expectTypeOf<LabelsOf<"riviera.external.calls">>().toEqualTypeOf<{
      readonly service: "common_ground" | "discogs";
      readonly operation: "SampleShopConfig" | "GET /releases/{id}";
      readonly outcome: "success" | "failed" | "rate_limited";
    }>();
    expectTypeOf<{
      service: "discogs";
      operation: "SampleShopConfig";
      outcome: "timeout";
    }>().not.toExtend<LabelsOf<"riviera.external.calls">>();
    expectTypeOf<{ job_name: string }>().not.toExtend<LabelsOf<"riviera.jobs.failures">>();
    expectTypeOf<"riviera.queue.depth">().not.toExtend<CounterName>();
    expectTypeOf<"riviera.jobs.runs">().not.toExtend<HistogramName>();
  });

  it("001/FR-018: an out-of-set label is a runtime rejection that names the label, not the value", () => {
    const { instruments } = setup();
    const secret = "staff_test_0001";
    const cases: [string, unknown, unknown, RegExp][] = [
      ["riviera.jobs.failures", 1, { job_name: secret }, /label job_name has a value outside/],
      ["riviera.jobs.failures", 1, { job_name: 7 }, /label job_name has a value outside/],
      [
        "riviera.jobs.failures",
        1,
        { job_name: "sample.discogs_release", staff_id: secret },
        /unknown label staff_id/,
      ],
      ["riviera.jobs.failures", 1, {}, /missing label job_name/],
      ["riviera.jobs.failures", 1, undefined, /missing label job_name/],
      ["riviera.jobs.failures", 1, "job_name", /labels must be an object/],
      ["riviera.jobs.failures", 1, null, /missing label job_name/],
      ["riviera.checkout.started", 1, { outcome: "paid" }, /unknown label outcome/],
      ["riviera.checkout.started", 1, { constructor: "x" }, /unknown label constructor/],
      ["riviera.checkout.started", 1, { toString: "x" }, /unknown label toString/],
      [
        "riviera.queue.depth",
        1,
        { job_name: "sample.discogs_release" },
        /not a registered instrument/,
      ],
    ];
    for (const [name, value, labels, message] of cases) {
      expect(() => {
        callUntyped(instruments.add, name, value, labels);
      }).toThrow(message);
      try {
        callUntyped(instruments.add, name, value, labels);
      } catch (error) {
        expect(String(error)).not.toContain(secret);
      }
    }
    expect(() => {
      callUntyped(instruments.record, "riviera.http.server.duration", 1, {
        route: "/sample/trace?id=1",
        method: "GET",
        status_class: "2xx",
      });
    }).toThrow(/label route has a value outside/);
    expect(() => {
      callUntyped(instruments.observe, "riviera.jobs.runs", () => []);
    }).toThrow(/not a registered instrument/);
  });

  it("001/FR-018: a gauge observation with an out-of-set label is rejected and not exported", async () => {
    const reader = new TestReader();
    const provider = new MeterProvider({ readers: [reader] });
    const instruments = createInstruments(provider.getMeter("test"), { routes: ROUTES });
    callUntyped(instruments.observe, "riviera.queue.depth", (report: unknown) => {
      callUntyped(report, 1, { job_name: "job_123" });
    });
    const { resourceMetrics, errors } = await reader.collect();
    expect(errors.map(String).join()).toMatch(/label job_name has a value outside/);
    const points = resourceMetrics.scopeMetrics
      .flatMap((s) => s.metrics)
      .map((m) => m.dataPoints.length);
    expect(points.every((n) => n === 0)).toBe(true);
  });

  it("001/FR-016, 001/FR-014: gauges are exported from their first observation and can stop reporting", async () => {
    const { instruments, collect } = setup();
    expect((await collect()).map((m) => m.descriptor.name)).not.toContain(
      "riviera.sync.last_success",
    );

    let calls = 0;
    const stop = instruments.observe("riviera.sync.last_success", async (report) => {
      calls += 1;
      const lastSuccess = await Promise.resolve(1_790_000_000);
      report(lastSuccess, { kind: "full" });
    });
    const point = metric(await collect(), "riviera.sync.last_success").dataPoints[0];
    expect(point?.attributes).toEqual({ kind: "full" });
    expect(point?.value).toBe(1_790_000_000);
    expect(calls).toBe(1);

    stop();
    await collect();
    expect(calls).toBe(1);
  });

  it("001/FR-014: after zeroInitialise() every counter and label combination is exported at 0, and add(1) exports 1", async () => {
    const { instruments, collect } = setup();
    instruments.zeroInitialise();
    const metrics = await collect();
    const counters = registry.filter((d) => d.kind === "counter");
    for (const counter of counters) {
      const exported = metric(metrics, counter.name);
      expect(exported.dataPoints).toHaveLength(combinationCount(counter));
      expect(exported.dataPoints.every((p) => p.value === 0)).toBe(true);
    }
    // Every catalog counter is among them (SC-004).
    for (const name of SLO_METRIC_NAMES.filter((n) => def(n).kind === "counter")) {
      expect(metrics.map((m) => m.descriptor.name)).toContain(name);
    }

    instruments.add("riviera.checkout.paid_after_mismatch", 1);
    instruments.add("riviera.audio.resolutions", 1, { source: "cg_snippet", outcome: "playable" });
    const later = await collect();
    expect(metric(later, "riviera.checkout.paid_after_mismatch").dataPoints[0]?.value).toBe(1);
    const audio = metric(later, "riviera.audio.resolutions").dataPoints;
    expect(audio).toHaveLength(4);
    for (const point of audio) {
      const hit =
        point.attributes["source"] === "cg_snippet" && point.attributes["outcome"] === "playable";
      expect(point.value).toBe(hit ? 1 : 0);
    }
  });

  it("001/FR-014: histograms are exported from their first observation", async () => {
    const { instruments, collect } = setup();
    instruments.zeroInitialise();
    const histograms = registry.filter((d) => d.kind === "histogram");
    const before = (await collect()).map((m) => m.descriptor.name);
    for (const h of histograms) expect(before).not.toContain(h.name);

    instruments.record("riviera.dig.next_record.duration", 0.1);
    instruments.record("riviera.sync.duration", 12, { kind: "light" });
    const after = await collect();
    expect(metric(after, "riviera.dig.next_record.duration").dataPoints).toHaveLength(1);
    expect(metric(after, "riviera.sync.duration").dataPoints[0]?.attributes).toEqual({
      kind: "light",
    });
  });
});
