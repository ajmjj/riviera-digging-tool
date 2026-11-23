import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  definition,
  layout,
  NO_DATA,
  prometheusName,
  promName,
  promSeries,
  registeredSeries,
  row,
  stat,
  timeseries,
  type Panel,
} from "../src/dashboards/build.ts";
import { OVERVIEW_FILE, overviewDashboard } from "../src/dashboards/overview.ts";
import { INSTRUMENTS, type InstrumentDef } from "../src/slo-metrics.ts";

const registry: readonly InstrumentDef[] = INSTRUMENTS;
const overview = overviewDashboard();
const queryPanels = overview.panels.filter((panel) => panel.type !== "row");
const exprs = queryPanels.flatMap((panel) => (panel.targets ?? []).map((target) => target.expr));

function panel(title: string): Panel {
  const found = overview.panels.find((entry) => entry.title === title);
  if (found === undefined) {
    throw new Error(`no panel titled ${title}`);
  }
  return found;
}

function exprsOf(title: string): string[] {
  return (panel(title).targets ?? []).map((target) => target.expr);
}

// PromQL words the overview may use besides metric and label names.
const PROMQL_WORDS = new Set(["sum", "max", "by", "rate", "increase", "histogram_quantile", "le"]);
const LABEL_NAMES = new Set(registry.flatMap((def) => Object.keys(def.labels)));

/** Identifiers in a PromQL expression, outside string literals and Grafana `$__` variables. */
function identifiers(expr: string): string[] {
  const bare = expr.replace(/"[^"]*"/g, '""').replace(/\$__\w+/g, "");
  return bare.match(/[a-zA-Z_:][a-zA-Z0-9_:]*/g) ?? [];
}

describe("OTel → Prometheus name translation (research R7)", () => {
  it("001/FR-026: matches every Prometheus name in contracts/telemetry.md#metrics", () => {
    const contract = readFileSync(
      "specs/001-observability-baseline/contracts/telemetry.md",
      "utf8",
    );
    const rows = [
      ...contract.matchAll(/^\| `(riviera\.[a-z_.]+)` \|.*\| `(riviera_[a-z_]+\*?)` \|$/gm),
    ];
    expect(rows.length).toBe(7);
    for (const [, otel = "", prom = ""] of rows) {
      const def = definition(otel);
      const expected = def.kind === "histogram" ? `${prometheusName(def)}_*` : prometheusName(def);
      expect(expected, otel).toBe(prom);
    }
  });

  it("001/FR-026: follows UnderscoreEscapingWithSuffixes for each kind and unit", () => {
    const cases: [InstrumentDef["name"], InstrumentDef["kind"], string, string][] = [
      ["riviera.verdict.duration", "histogram", "s", "riviera_verdict_duration_seconds"],
      ["riviera.jobs.failures", "counter", "{failure}", "riviera_jobs_failures_total"],
      ["riviera.queue.depth", "gauge", "{job}", "riviera_queue_depth"],
      ["riviera.sync.last_success", "gauge", "s", "riviera_sync_last_success_seconds"],
      ["riviera.cache.hit", "gauge", "1", "riviera_cache_hit_ratio"],
      ["riviera.cache.hits", "counter", "1", "riviera_cache_hits_total"],
      ["riviera.payload.size", "histogram", "By", "riviera_payload_size_bytes"],
      ["riviera.wait.ms", "histogram", "ms", "riviera_wait_ms_milliseconds"],
      ["riviera.time.seconds", "gauge", "s", "riviera_time_seconds"],
      ["riviera.total.calls", "counter", "", "riviera_calls_total"],
      ["riviera.http-server..x", "gauge", "{x} ", "riviera_http_server_x"],
    ];
    for (const [name, kind, unit, expected] of cases) {
      expect(prometheusName({ name, kind, unit }), name).toBe(expected);
    }
  });

  it("001/FR-026: rejects a unit it has no translation for", () => {
    expect(() => prometheusName({ name: "riviera.speed", kind: "gauge", unit: "m/s" })).toThrow(
      /riviera\.speed: no Prometheus translation for unit m\/s/,
    );
  });

  it("001/FR-026: names registered metrics and series only", () => {
    expect(promName("riviera.jobs.runs")).toBe("riviera_jobs_runs_total");
    expect(promSeries("riviera.http.server.duration", "bucket")).toBe(
      "riviera_http_server_duration_seconds_bucket",
    );
    expect(() => definition("riviera.not.registered")).toThrow(/not a registered instrument/);
    const series = registeredSeries();
    expect(series.has("riviera_jobs_duration_seconds_sum")).toBe(true);
    expect(series.has("riviera_queue_depth")).toBe(true);
    expect(series.has("riviera_queue_depth_bucket")).toBe(false);
  });
});

describe("dashboard builders", () => {
  it("001/FR-026: lays panels out two to a line, with rows on their own line", () => {
    const q = [{ expr: "up", legend: "" }];
    const panels = layout([
      row("A"),
      timeseries("t1", "", "s", q),
      timeseries("t2", "", "s", q),
      stat("s1", "", "short", q),
      row("B"),
      stat("s2", "", "short", q),
    ]);
    expect(panels.map((entry) => [entry.id, entry.title, entry.gridPos])).toEqual([
      [1, "A", { x: 0, y: 0, w: 24, h: 1 }],
      [2, "t1", { x: 0, y: 1, w: 12, h: 8 }],
      [3, "t2", { x: 12, y: 1, w: 12, h: 8 }],
      [4, "s1", { x: 0, y: 9, w: 12, h: 8 }],
      [5, "B", { x: 0, y: 17, w: 24, h: 1 }],
      [6, "s2", { x: 0, y: 18, w: 12, h: 8 }],
    ]);
    expect(panels[3]?.options).toHaveProperty("reduceOptions");
    expect(panels[1]?.options).toHaveProperty("legend");
  });

  it("001/FR-026: rejects a panel with no query", () => {
    expect(() => layout([stat("empty", "", "short", [])])).toThrow(/at least one query/);
  });
});

describe("service overview dashboard", () => {
  it("001/FR-026: has the request, job and external-call panels", () => {
    expect(overview.uid).toBe("service-overview");
    expect(overview.title).toBe("Service overview");
    expect(
      overview.panels.filter((entry) => entry.type === "row").map((entry) => entry.title),
    ).toEqual(["Requests", "Jobs", "Common Ground and Discogs"]);

    // Request rate, errors and latency per route.
    expect(exprsOf("Request rate by route")).toEqual([
      "sum by (route) (rate(riviera_http_server_duration_seconds_count[$__rate_interval]))",
    ]);
    expect(exprsOf("Errors by route").join("\n")).toContain('status_class="5xx"');
    for (const expr of exprsOf("Latency by route")) {
      expect(expr).toMatch(
        /^histogram_quantile\(0\.\d+, sum by \(route, le\) \(rate\(riviera_http_server_duration_seconds_bucket\[\$__rate_interval\]\)\)\)$/,
      );
    }

    // Job runs, failures and queue depth.
    expect(exprsOf("Job runs by outcome")).toEqual([
      "sum by (job_name, outcome) (rate(riviera_jobs_runs_total[$__rate_interval]))",
    ]);
    expect(exprsOf("Job failures in range")).toEqual([
      "sum by (job_name) (increase(riviera_jobs_failures_total[$__range]))",
    ]);
    expect(exprsOf("Queue depth")).toEqual(["max by (job_name) (riviera_queue_depth)"]);

    // Common Ground and Discogs calls by outcome.
    expect(exprsOf("Calls by outcome")).toEqual([
      "sum by (service, outcome) (rate(riviera_external_calls_total[$__rate_interval]))",
    ]);
  });

  it("001/FR-026: every query names only registered metrics and labels", () => {
    const series = registeredSeries();
    expect(exprs.length).toBeGreaterThan(0);
    for (const expr of exprs) {
      const words = identifiers(expr);
      const metrics = words.filter((word) => !PROMQL_WORDS.has(word) && !LABEL_NAMES.has(word));
      expect(metrics.length, expr).toBeGreaterThan(0);
      for (const metric of metrics) {
        expect(series.has(metric), `${metric} in ${expr}`).toBe(true);
      }
    }
  });

  it("001/FR-026: each query's labels and label values belong to the metric it queries", () => {
    const defs = new Map(
      registry.flatMap((def): [string, InstrumentDef][] => {
        const base = prometheusName(def);
        const names =
          def.kind === "histogram" ? ["bucket", "count", "sum"].map((s) => `${base}_${s}`) : [base];
        return names.map((name) => [name, def]);
      }),
    );
    for (const expr of exprs) {
      const metrics = identifiers(expr).filter((word) => defs.has(word));
      expect(metrics.length, expr).toBe(1);
      const [metric = ""] = metrics;
      const labels = defs.get(metric)?.labels ?? {};
      const known = (key: string): boolean =>
        Object.hasOwn(labels, key) || (key === "le" && metric.endsWith("_bucket"));
      for (const [, list = ""] of expr.matchAll(/\bby \(([^)]*)\)/g)) {
        for (const key of list.split(", ")) {
          expect(known(key), `${key} in ${expr}`).toBe(true);
        }
      }
      for (const [, key = "", value = ""] of expr.matchAll(/(\w+)="([^"]*)"/g)) {
        const values = labels[key];
        expect(
          Array.isArray(values) && values.includes(value),
          `${key}="${value}" in ${expr}`,
        ).toBe(true);
      }
    }
  });

  it("001/FR-026: queue depth is always `max by (job_name)`", () => {
    for (const expr of exprs.filter((entry) => entry.includes("riviera_queue_depth"))) {
      expect(expr).toBe("max by (job_name) (riviera_queue_depth)");
    }
  });

  it("001/FR-026: every panel says no data was recorded instead of showing a blank", () => {
    for (const entry of queryPanels) {
      expect(entry.fieldConfig?.defaults.noValue, entry.title).toBe(NO_DATA);
      expect(entry.datasource, entry.title).toEqual({ type: "prometheus", uid: "prometheus" });
      for (const target of entry.targets ?? []) {
        expect(target.datasource, entry.title).toEqual({ type: "prometheus", uid: "prometheus" });
      }
    }
    expect(NO_DATA).toBe("No data recorded yet");
  });

  it("001/FR-026: the committed JSON equals the generator output (run `make dashboards`)", () => {
    const committed: unknown = JSON.parse(
      readFileSync(`observability/grafana/dashboards/${OVERVIEW_FILE}`, "utf8"),
    );
    expect(committed).toEqual(JSON.parse(JSON.stringify(overview)));
  });
});
