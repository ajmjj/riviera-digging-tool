// SLO dashboards (001/FR-024, FR-025; data-model.md §4): one per catalog SLO, with each
// objective's target, its SLI over the 28-day window, the remaining error budget and a graph.
// SLIs follow contracts/telemetry.md#slis. Counters are zero-initialised (research R18), so
// `increase` counts the first event, and "no data" is decided by each objective's `hasData`
// count, not by a missing series.

import catalog from "../../../../ci/slo-catalog.json" with { type: "json" };
import { dashboard, definition, promName, promSeries, row, stat, timeseries } from "./build.ts";
import type { Dashboard, PanelSpec } from "./build.ts";

/** The SLO window (spec clarification Q3): SLI and budget panels always use it. */
export const SLO_WINDOW = "28d";

export interface Objective {
  readonly label: string;
  /** The share of good events the SLO promises, 0 < target ≤ 1. */
  readonly target: number;
  /** PromQL: the SLI over the window, a share in [0, 1]. */
  readonly sli: string;
  /** PromQL: events in the window; the SLI and budget show no value while it is 0 (FR-025). */
  readonly hasData: string;
  /** PromQL, for a 100% target only: bad events in the window. */
  readonly bad?: string;
}

export interface SloQueries {
  readonly id: string;
  readonly objectives: readonly Objective[];
  readonly extra?: readonly PanelSpec[];
}

type Histogram = Parameters<typeof promSeries>[0];

function increase(series: string, selector = ""): string {
  return `sum(increase(${series}${selector}[${SLO_WINDOW}]))`;
}

function ratio(label: string, target: number, good: string, total: string): Objective {
  return { label, target, sli: `clamp(${good} / ${total}, 0, 1)`, hasData: total };
}

/** The share of a histogram's observations at or under `seconds`, a bucket boundary. */
function within(label: string, target: number, name: Histogram, seconds: number): Objective {
  if (definition(name).buckets?.includes(seconds) !== true) {
    throw new RangeError(`${name} has no bucket at ${String(seconds)}`);
  }
  // OTLP bucket bounds may arrive as `1200` or `1200.0`, depending on the Prometheus version.
  const le = Number.isInteger(seconds)
    ? `=~"${String(seconds)}|${String(seconds)}.0"`
    : `="${String(seconds)}"`;
  const good = increase(promSeries(name, "bucket"), `{le${le}}`);
  return ratio(label, target, good, increase(promSeries(name, "count")));
}

const verdicts = promName("riviera.verdict.requests");
const syncSuccess = `max(${promName("riviera.sync.last_success")}{kind="full"})`;
const finished = promName("riviera.checkout.finished");
const paid = increase(finished, '{outcome="paid"}');
const paidAfterMismatch = increase(promName("riviera.checkout.paid_after_mismatch"));
const audio = promName("riviera.audio.resolutions");
const verdictCount = promSeries("riviera.verdict.duration", "count");
const verdictBucket = promSeries("riviera.verdict.duration", "bucket");
const FRESH_SECONDS = 26 * 3600;

export const SLO_QUERIES: readonly SloQueries[] = [
  {
    id: "verdict-saved",
    objectives: [
      ratio(
        "Verdict requests succeed",
        0.999,
        increase(verdicts, '{outcome="success"}'),
        increase(verdicts),
      ),
      within("Verdicts within 300 ms", 0.95, "riviera.verdict.duration", 0.3),
    ],
    extra: [
      timeseries(
        "Verdict latency p95",
        "p95 of verdict request duration; the target is under 300 ms.",
        "s",
        [
          {
            expr: `histogram_quantile(0.95, sum by (le) (rate(${verdictBucket}[$__rate_interval]))) and on() (sum(rate(${verdictCount}[$__rate_interval])) > 0)`,
            legend: "p95",
          },
        ],
      ),
    ],
  },
  {
    id: "next-record-ready",
    objectives: [
      within("Next record within 500 ms", 0.95, "riviera.dig.next_record.duration", 0.5),
    ],
  },
  {
    id: "inventory-freshness",
    objectives: [
      {
        label: "Last full sync under 26 h old",
        target: 0.99,
        sli: `avg_over_time((time() - ${syncSuccess} < bool ${String(FRESH_SECONDS)})[${SLO_WINDOW}:5m])`,
        hasData: `sum(count_over_time(${promName("riviera.sync.last_success")}{kind="full"}[${SLO_WINDOW}]))`,
      },
    ],
  },
  {
    id: "sold-record-removal",
    objectives: [
      within("Sold records removed within 20 min", 0.99, "riviera.pile.sold_removal.delay", 1200),
    ],
  },
  {
    id: "staff-checkout-correctness",
    objectives: [
      {
        label: "Paid checkouts with zero mismatch",
        target: 1,
        sli: `clamp(1 - ${paidAfterMismatch} / ${paid}, 0, 1)`,
        hasData: paid,
        bad: paidAfterMismatch,
      },
      ratio(
        "Started checkouts complete or stop safely",
        0.99,
        increase(finished, '{outcome=~"paid|stopped_safely"}'),
        increase(promName("riviera.checkout.started")),
      ),
    ],
  },
  {
    id: "audio-resolvable",
    objectives: [
      ratio(
        "Audio sources playable",
        0.95,
        increase(audio, '{outcome="playable"}'),
        increase(audio),
      ),
    ],
  },
  {
    id: "notification-delivery",
    objectives: [
      within("Notifications sent within 5 min", 0.99, "riviera.notification.delivery.delay", 300),
    ],
  },
];

/** PromQL: the remaining error budget, the formula `remainingBudget` states in TypeScript. */
export function budgetQuery(objective: Objective): string {
  return objective.bad === undefined
    ? `1 - (1 - ${objective.sli}) / (1 - ${String(objective.target)})`
    : `${objective.bad} == bool 0`;
}

/**
 * Remaining error budget for `bad` of `total` events (data-model.md §4): `1 - (1 - SLI) / (1 -
 * target)`; for a 100% target, 1 while no event is bad and 0 from the first. No events: none.
 */
export function remainingBudget(target: number, total: number, bad: number): number | undefined {
  if (total === 0) {
    return undefined;
  }
  if (target === 1) {
    return bad === 0 ? 1 : 0;
  }
  const sli = Math.min(Math.max(1 - bad / total, 0), 1);
  return 1 - (1 - sli) / (1 - target);
}

function guarded(expr: string, objective: Objective): string {
  return `(${expr}) and on() (${objective.hasData} > 0)`;
}

function objectivePanels(objective: Objective): PanelSpec[] {
  const percent = `${String(objective.target * 100)}%`;
  const sli = [{ expr: guarded(objective.sli, objective), legend: "SLI" }];
  return [
    row(objective.label),
    stat("Target", `${objective.label}: ${percent} over ${SLO_WINDOW}.`, "percentunit", [
      { expr: `vector(${String(objective.target)})`, legend: "target" },
    ]),
    stat(`SLI (${SLO_WINDOW})`, `Measured share over the last ${SLO_WINDOW}.`, "percentunit", sli),
    stat(
      `Error budget remaining (${SLO_WINDOW})`,
      objective.bad === undefined
        ? "1 − (1 − SLI) / (1 − target); below 0 means the budget is spent."
        : "100% while no event in the window is bad; exhausted (0%) from the first one.",
      "percentunit",
      [{ expr: guarded(budgetQuery(objective), objective), legend: "budget" }],
    ),
    timeseries(
      `SLI over time (rolling ${SLO_WINDOW})`,
      "Each point is the SLI of the 28 days before it.",
      "percentunit",
      sli,
    ),
  ];
}

export interface SloDashboardFile {
  readonly file: string;
  readonly dashboard: Dashboard;
}

/** One dashboard per catalog SLO, joined by id; throws if the catalog and the queries differ. */
export function sloDashboards(): SloDashboardFile[] {
  const ids = SLO_QUERIES.map((entry) => entry.id);
  const catalogIds = catalog.slos.map((slo) => slo.id);
  if (ids.join() !== catalogIds.join()) {
    throw new RangeError(`SLO queries ${ids.join()} differ from catalog ${catalogIds.join()}`);
  }
  return catalog.slos.map((slo, index) => {
    const queries = SLO_QUERIES[index] ?? { id: slo.id, objectives: [] };
    return {
      file: `slo/${slo.id}.json`,
      dashboard: dashboard({
        uid: `slo-${slo.id}`,
        title: slo.name,
        description: `${slo.objective}. SLI and budget over a rolling ${SLO_WINDOW}. Generated by packages/telemetry/src/dashboards (make dashboards); do not edit in Grafana.`,
        tags: ["riviera", "slo"],
        from: `now-${SLO_WINDOW}`,
        panels: [...queries.objectives.flatMap(objectivePanels), ...(queries.extra ?? [])],
      }),
    };
  });
}
