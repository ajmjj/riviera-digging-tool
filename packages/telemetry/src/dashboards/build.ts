// Grafana dashboard JSON builders (001/FR-026; research R7). Every query names its metrics by
// registry name through `promName`/`promSeries`, so a dashboard can't query a metric that the api
// and worker don't register, and the OTel → Prometheus name translation lives in one place.

import { INSTRUMENTS, type InstrumentDef } from "../slo-metrics.ts";

type Registry = (typeof INSTRUMENTS)[number];
export type MetricName = Registry["name"];
type HistogramMetric = Extract<Registry, { kind: "histogram" }>["name"];

/** Shown by every panel with no series, instead of a blank panel or "0" (001/FR-025, FR-026). */
export const NO_DATA = "No data recorded yet";

/** The fixed data-source uid provisioned by observability/grafana/provisioning/datasources. */
const PROMETHEUS = { type: "prometheus", uid: "prometheus" } as const;

// OTel UCUM units → Prometheus suffix words (the subset Prometheus' otlptranslator maps that the
// registry can use). A unit outside this list throws, so a new unit gets a tested translation.
const UNIT_WORDS: Readonly<Record<string, string>> = {
  s: "seconds",
  ms: "milliseconds",
  By: "bytes",
};

/**
 * Prometheus' `UnderscoreEscapingWithSuffixes` translation of an OTLP metric name (the default
 * of observability/prometheus.yaml): non-alphanumeric runs become `_`, the unit word is appended
 * unless the name already has it (annotations such as `{call}` add nothing), a gauge with unit
 * `1` gets `ratio`, and a counter ends in `total`. Histogram series add `_bucket` etc. on top.
 */
export function prometheusName(def: Pick<InstrumentDef, "name" | "kind" | "unit">): string {
  const tokens = def.name.split(/[^a-zA-Z0-9]+/).filter((token) => token !== "");
  const unit = unitWord(def);
  if (unit !== undefined && !tokens.includes(unit)) {
    tokens.push(unit);
  }
  if (def.kind === "counter") {
    const withoutTotal = tokens.filter((token) => token !== "total");
    tokens.splice(0, tokens.length, ...withoutTotal, "total");
  }
  // Registry names start with `riviera.`, so the digit-prefix rule never applies.
  return tokens.join("_");
}

function unitWord(def: Pick<InstrumentDef, "name" | "kind" | "unit">): string | undefined {
  const unit = def.unit.replace(/\{[^}]*\}/g, "").trim();
  if (unit === "") {
    return undefined;
  }
  if (unit === "1") {
    return def.kind === "gauge" ? "ratio" : undefined;
  }
  const word = UNIT_WORDS[unit];
  if (word === undefined) {
    throw new TypeError(`${def.name}: no Prometheus translation for unit ${unit}`);
  }
  return word;
}

const registry: readonly InstrumentDef[] = INSTRUMENTS;

/** The registry entry for `name`; throws for a name the registry doesn't have. */
export function definition(name: string): InstrumentDef {
  const def = registry.find((entry) => entry.name === name);
  if (def === undefined) {
    throw new TypeError(`${name} is not a registered instrument`);
  }
  return def;
}

/** The Prometheus name of a registered counter or gauge. */
export function promName(name: Exclude<MetricName, HistogramMetric>): string {
  return prometheusName(definition(name));
}

/** One series of a registered histogram, e.g. `riviera_jobs_duration_seconds_bucket`. */
export function promSeries(name: HistogramMetric, series: "bucket" | "count" | "sum"): string {
  return `${prometheusName(definition(name))}_${series}`;
}

/** Every Prometheus series name the registry can produce (histograms as their three series). */
export function registeredSeries(): ReadonlySet<string> {
  const names = registry.flatMap((def) => {
    const base = prometheusName(def);
    return def.kind === "histogram" ? [`${base}_bucket`, `${base}_count`, `${base}_sum`] : [base];
  });
  return new Set(names);
}

// --- Grafana JSON -------------------------------------------------------------------------

interface GridPos {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Panel {
  readonly id: number;
  readonly type: "timeseries" | "stat" | "row";
  readonly title: string;
  readonly gridPos: GridPos;
  readonly description?: string;
  readonly datasource?: typeof PROMETHEUS;
  readonly targets?: readonly { readonly datasource: typeof PROMETHEUS; readonly expr: string }[];
  readonly fieldConfig?: {
    readonly defaults: { readonly unit: string; readonly noValue: string; readonly min: number };
    readonly overrides: readonly never[];
  };
  readonly options?: object;
}

export interface Dashboard {
  readonly [field: string]: unknown;
  readonly uid: string;
  readonly title: string;
  readonly panels: readonly Panel[];
}

/** A query: PromQL plus the legend Grafana shows for each of its series. */
interface Query {
  readonly expr: string;
  readonly legend: string;
}

interface QuerySpec {
  readonly kind: "timeseries" | "stat";
  readonly title: string;
  readonly description: string;
  readonly unit: string;
  readonly queries: readonly Query[];
}

/** A panel before layout: query panels are half the width, two to a line. */
export type PanelSpec = QuerySpec | { readonly kind: "row"; readonly title: string };

type Args = [title: string, description: string, unit: string, queries: readonly Query[]];

export function timeseries(...[title, description, unit, queries]: Args): PanelSpec {
  return { kind: "timeseries", title, description, unit, queries };
}

export function stat(...[title, description, unit, queries]: Args): PanelSpec {
  return { kind: "stat", title, description, unit, queries };
}

export function row(title: string): PanelSpec {
  return { kind: "row", title };
}

const COLUMNS = 24;
const WIDTH = 12;
const HEIGHT = 8;

const STAT_OPTIONS = {
  reduceOptions: { calcs: ["lastNotNull"], fields: "", values: false },
  colorMode: "value",
  graphMode: "none",
  textMode: "value_and_name",
};
const TIMESERIES_OPTIONS = {
  legend: { displayMode: "table", placement: "bottom", calcs: ["lastNotNull", "max"] },
  tooltip: { mode: "multi", sort: "desc" },
};

/** Lays panels out two to a line; a row (a section heading) starts a new line. */
export function layout(specs: readonly PanelSpec[]): Panel[] {
  const panels: Panel[] = [];
  let x = 0;
  let y = 0;
  let lineHeight = 0;
  for (const spec of specs) {
    const id = panels.length + 1;
    if (spec.kind === "row" || x + WIDTH > COLUMNS) {
      y += lineHeight;
      x = 0;
      lineHeight = 0;
    }
    if (spec.kind === "row") {
      panels.push({ id, type: "row", title: spec.title, gridPos: { x, y, w: COLUMNS, h: 1 } });
      y += 1;
      continue;
    }
    panels.push(queryPanel(spec, id, { x, y, w: WIDTH, h: HEIGHT }));
    x += WIDTH;
    lineHeight = HEIGHT;
  }
  return panels;
}

function queryPanel(spec: QuerySpec, id: number, gridPos: GridPos): Panel {
  if (spec.queries.length === 0) {
    throw new RangeError(`${spec.title}: a panel needs at least one query`);
  }
  return {
    id,
    type: spec.kind,
    title: spec.title,
    description: spec.description,
    gridPos,
    datasource: PROMETHEUS,
    targets: spec.queries.map((query, index) => ({
      refId: String.fromCharCode(65 + index),
      datasource: PROMETHEUS,
      expr: query.expr,
      legendFormat: query.legend,
      // A stat shows one value per series, so it runs one instant query, not a range of them.
      range: spec.kind === "timeseries",
      instant: spec.kind === "stat",
    })),
    fieldConfig: { defaults: { unit: spec.unit, noValue: NO_DATA, min: 0 }, overrides: [] },
    options: spec.kind === "stat" ? STAT_OPTIONS : TIMESERIES_OPTIONS,
  };
}

export interface DashboardSpec {
  readonly uid: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly panels: readonly PanelSpec[];
  /** The default time range, e.g. `now-28d` for an SLO window; `now-1h` when omitted. */
  readonly from?: string;
}

/** A provisioned, read-only dashboard (Grafana schema 41) over the Prometheus data source. */
export function dashboard(spec: DashboardSpec): Dashboard {
  const { panels, from = "now-1h", ...meta } = spec;
  return {
    ...meta,
    editable: false,
    schemaVersion: 41,
    version: 1,
    time: { from, to: "now" },
    refresh: "30s",
    timezone: "utc",
    graphTooltip: 1,
    panels: layout(panels),
  };
}
