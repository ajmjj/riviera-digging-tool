import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalog from "../../../ci/slo-catalog.json" with { type: "json" };
import { NO_DATA, prometheusName, type Dashboard } from "../src/dashboards/build.ts";
import {
  budgetQuery,
  remainingBudget,
  SLO_QUERIES,
  SLO_WINDOW,
  sloDashboards,
} from "../src/dashboards/slo-queries.ts";
import { INSTRUMENTS, type InstrumentDef } from "../src/slo-metrics.ts";

const repo = new URL("../../../", import.meta.url);

const generated = sloDashboards();
const registry: readonly InstrumentDef[] = INSTRUMENTS;

// Prometheus series name → registry definition (histograms as their three series).
const seriesDefs = new Map(
  registry.flatMap((def): [string, InstrumentDef][] => {
    const base = prometheusName(def);
    const names =
      def.kind === "histogram" ? ["bucket", "count", "sum"].map((s) => `${base}_${s}`) : [base];
    return names.map((name) => [name, def]);
  }),
);

function exprs(dashboard: Dashboard): string[] {
  return dashboard.panels.flatMap((panel) => (panel.targets ?? []).map((target) => target.expr));
}

function metricsIn(expr: string): string[] {
  const bare = expr.replace(/"[^"]*"/g, '""');
  return (bare.match(/[a-zA-Z_:][a-zA-Z0-9_:]*/g) ?? []).filter((word) => seriesDefs.has(word));
}

describe("SLO dashboards", () => {
  it("001/FR-024: one dashboard per catalog SLO, ids equal the catalog ids (exactly seven)", () => {
    expect(catalog.slos).toHaveLength(7);
    expect(SLO_QUERIES.map((entry) => entry.id)).toEqual(catalog.slos.map((slo) => slo.id));
    expect(
      generated.map((entry) => [entry.file, entry.dashboard.uid, entry.dashboard.title]),
    ).toEqual(catalog.slos.map((slo) => [`slo/${slo.id}.json`, `slo-${slo.id}`, slo.name]));
  });

  it("001/FR-024: every queried metric is in that SLO's catalog metrics", () => {
    for (const [index, slo] of catalog.slos.entries()) {
      const dashboard = generated[index]?.dashboard;
      expect(dashboard, slo.id).toBeDefined();
      const named = exprs(dashboard ?? { uid: "", title: "", panels: [] }).flatMap(metricsIn);
      expect(named.length, slo.id).toBeGreaterThan(0);
      for (const metric of named) {
        expect(slo.metrics, `${metric} on ${slo.id}`).toContain(seriesDefs.get(metric)?.name);
      }
    }
  });

  it("001/FR-024: each objective shows target, SLI and budget over 28 days, and a graph", () => {
    expect(SLO_WINDOW).toBe("28d");
    for (const { dashboard } of generated) {
      expect(dashboard["time"]).toEqual({ from: "now-28d", to: "now" });
      const titles = dashboard.panels.map((panel) => panel.title);
      const objectives = dashboard.panels.filter((panel) => panel.type === "row").length;
      expect(objectives, dashboard.uid).toBeGreaterThan(0);
      for (const title of [
        "Target",
        "SLI (28d)",
        "Error budget remaining (28d)",
        "SLI over time (rolling 28d)",
      ]) {
        expect(titles.filter((entry) => entry === title).length, `${dashboard.uid} ${title}`).toBe(
          objectives,
        );
      }
    }
    const verdict = SLO_QUERIES[0]?.objectives ?? [];
    expect(verdict.map((objective) => objective.target)).toEqual([0.999, 0.95]);
    expect(verdict[1]?.sli).toBe(
      'clamp(sum(increase(riviera_verdict_duration_seconds_bucket{le="0.3"}[28d])) / sum(increase(riviera_verdict_duration_seconds_count[28d])), 0, 1)',
    );
  });

  it("001/FR-025: every stat panel says no data was recorded yet instead of a value", () => {
    for (const { dashboard } of generated) {
      for (const panel of dashboard.panels.filter((entry) => entry.type !== "row")) {
        expect(panel.fieldConfig?.defaults.noValue, `${dashboard.uid} ${panel.title}`).toBe(
          NO_DATA,
        );
      }
    }
  });

  it("001/FR-025: SLI and budget return no value while the window has no events", () => {
    for (const { objectives } of SLO_QUERIES) {
      for (const objective of objectives) {
        expect(objective.hasData).toMatch(/^sum\((increase|count_over_time)\(/);
        const panels = generated.flatMap(({ dashboard }) => exprs(dashboard));
        for (const expr of [objective.sli, budgetQuery(objective)]) {
          expect(panels).toContain(`(${expr}) and on() (${objective.hasData} > 0)`);
        }
      }
    }
    // The data rule: no events → no value; paid checkouts with zero mismatches → 100%.
    expect(remainingBudget(0.99, 0, 0)).toBeUndefined();
    expect(remainingBudget(1, 0, 0)).toBeUndefined();
    expect(remainingBudget(1, 12, 0)).toBe(1);
  });

  it("001/FR-024: budget formula on worked examples", () => {
    // 1 − (1 − SLI) / (1 − target)
    expect(remainingBudget(0.999, 10_000, 0)).toBe(1);
    expect(remainingBudget(0.999, 10_000, 5)).toBeCloseTo(0.5, 9);
    expect(remainingBudget(0.999, 10_000, 10)).toBeCloseTo(0, 9);
    expect(remainingBudget(0.99, 1000, 20)).toBeCloseTo(-1, 9);
    expect(remainingBudget(0.95, 200, 1)).toBeCloseTo(0.9, 9);
    // The 100% target: count 0 → 100%, count ≥ 1 → 0%, never NaN or ±Inf.
    for (const bad of [1, 2, 50]) {
      expect(remainingBudget(1, 50, bad)).toBe(0);
    }
    const checkout = SLO_QUERIES.find((entry) => entry.id === "staff-checkout-correctness");
    const [zero] = checkout?.objectives ?? [];
    expect(zero?.target).toBe(1);
    expect(budgetQuery(zero ?? { label: "", target: 1, sli: "", hasData: "" })).toBe(
      "sum(increase(riviera_checkout_paid_after_mismatch_total[28d])) == bool 0",
    );
    expect(budgetQuery({ label: "", target: 0.99, sli: "S", hasData: "" })).toBe(
      "1 - (1 - S) / (1 - 0.99)",
    );
  });

  it("001/FR-024: a counter series going 0 → 1 counts the first event (R18)", () => {
    // Counters are zero-initialised, so the window holds 0 then 1, and `increase` over the
    // window sees that one event: each counter is read only through `increase(…[28d])`.
    for (const { dashboard } of generated) {
      for (const expr of exprs(dashboard)) {
        for (const metric of metricsIn(expr).filter((m) => seriesDefs.get(m)?.kind === "counter")) {
          const uses = expr.split(metric).length - 1;
          const increases = expr.split(`increase(${metric}`).length - 1;
          expect(increases, `${metric} in ${expr}`).toBe(uses);
        }
      }
    }
    const [zero] =
      SLO_QUERIES.find((entry) => entry.id === "staff-checkout-correctness")?.objectives ?? [];
    expect(zero?.bad).toBe("sum(increase(riviera_checkout_paid_after_mismatch_total[28d]))");
    // increase([0, 1]) = 1 → the 100% target's budget is exhausted.
    expect(remainingBudget(1, 1, 1)).toBe(0);
  });

  it("001/FR-024: the committed JSON equals the generator output (run `make dashboards`)", () => {
    for (const { file, dashboard } of generated) {
      const path = new URL(`observability/grafana/dashboards/${file}`, repo);
      const committed: unknown = JSON.parse(readFileSync(path, "utf8"));
      expect(committed, file).toEqual(JSON.parse(JSON.stringify(dashboard)));
    }
  });
});
