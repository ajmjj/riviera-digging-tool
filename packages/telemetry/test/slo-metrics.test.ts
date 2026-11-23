import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalog, requiredMetrics, type SloCatalog } from "../../../ci/lib/slo.ts";
import { INSTRUMENTS, SLO_METRIC_NAMES, type InstrumentDef } from "../src/slo-metrics.ts";

function loadCatalog(): SloCatalog {
  const catalog = parseCatalog(JSON.parse(readFileSync("ci/slo-catalog.json", "utf8")));
  if (Array.isArray(catalog)) {
    throw new Error(`ci/slo-catalog.json is invalid: ${catalog.join("; ")}`);
  }
  return catalog;
}

const registry: readonly InstrumentDef[] = INSTRUMENTS;
const catalog = loadCatalog();

// Research R6: the instruments the spec needs beyond the catalog.
const SERVICE_INSTRUMENTS = [
  "riviera.http.server.duration",
  "riviera.external.duration",
  "riviera.jobs.runs",
  "riviera.jobs.duration",
];

// Latency SLO thresholds in seconds (constitution, Principle VII; contracts/telemetry.md).
const LATENCY_THRESHOLDS: Readonly<Record<string, number>> = {
  "riviera.verdict.duration": 0.3,
  "riviera.dig.next_record.duration": 0.5,
  "riviera.pile.sold_removal.delay": 1200,
  "riviera.notification.delivery.delay": 300,
};

const FORBIDDEN_LABEL = /(?:^|_)(?:id|email|ip|token|user|staff)$/;

describe("metric registry", () => {
  it("001/FR-014: SLO_METRIC_NAMES is exactly the catalog's metrics", () => {
    expect([...SLO_METRIC_NAMES].sort()).toEqual(requiredMetrics(catalog).sort());
  });

  it("001/FR-014: registers every catalog metric, and only the R6 service metrics besides", () => {
    const names = registry.map((def) => def.name);
    expect(new Set(names).size).toBe(names.length);
    const others = names.filter((name) => !SLO_METRIC_NAMES.includes(name));
    expect(others.sort()).toEqual([...SERVICE_INSTRUMENTS].sort());
  });

  it("001/FR-014: tags each catalog metric with the SLO it feeds, or as a minimum metric", () => {
    for (const def of registry) {
      const owner = catalog.slos.find((slo) => slo.metrics.includes(def.name));
      expect(def.slo, def.name).toBe(owner?.id);
      expect(def.minimum === true, def.name).toBe(catalog.minimumMetrics.includes(def.name));
    }
  });

  it.each(Object.entries(LATENCY_THRESHOLDS))(
    "001/FR-014: %s has a bucket boundary at its SLO threshold %s s",
    (name, threshold) => {
      const def = registry.find((d) => d.name === name);
      expect(def?.kind).toBe("histogram");
      expect(def?.buckets).toContain(threshold);
    },
  );

  it("001/FR-018: no label carries an identity or other unbounded value", () => {
    const labels = registry.flatMap((def) => Object.keys(def.labels));
    for (const name of ["staff_id", "request_id", "job_id", "trace_id", "span_id", "email"]) {
      expect(labels).not.toContain(name);
    }
    expect(labels.filter((label) => FORBIDDEN_LABEL.test(label))).toEqual([]);
  });

  it("001/FR-018: every label is a closed set of values", () => {
    for (const def of registry) {
      for (const [label, values] of Object.entries(def.labels)) {
        if (values === "route") {
          // Closed by the registered route templates plus `unmatched` (T010).
          expect(label, def.name).toBe("route");
          continue;
        }
        expect(values.length, `${def.name} ${label}`).toBeGreaterThan(0);
        expect(new Set(values).size, `${def.name} ${label}`).toBe(values.length);
        expect(
          values.every((v) => v !== ""),
          `${def.name} ${label}`,
        ).toBe(true);
      }
    }
  });

  it("001/FR-018: the HTTP method label is the known methods plus _OTHER for any other", () => {
    const http = registry.find((def) => def.name === "riviera.http.server.duration");
    expect(http?.labels["method"]).toEqual([
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "_OTHER",
    ]);
  });

  it.each(registry.map((def) => [def.name, def] as const))(
    "001/FR-014: %s is well-formed",
    (name, def) => {
      expect(name).toMatch(/^riviera(?:\.[a-z][a-z0-9_]*)+$/);
      expect(def.description).not.toBe("");
      for (const label of Object.keys(def.labels)) {
        expect(label).toMatch(/^[a-z][a-z0-9_]*$/);
      }
      if (def.kind === "counter") {
        expect(def.unit).toMatch(/^\{[a-z]+\}$/);
      } else if (def.kind === "histogram") {
        expect(def.unit).toBe("s");
      } else {
        expect(def.unit).toMatch(/^(?:s|\{[a-z]+\})$/);
      }
      if (def.kind === "histogram") {
        const buckets = def.buckets ?? [];
        expect(buckets.length).toBeGreaterThan(0);
        expect(buckets[0]).toBeGreaterThan(0);
        expect(buckets.every((b, i) => i === 0 || b > (buckets[i - 1] ?? b))).toBe(true);
      } else {
        expect(def.buckets).toBeUndefined();
      }
    },
  );
});
