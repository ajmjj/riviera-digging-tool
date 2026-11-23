// Typed recorders over the metric registry (specs/001-observability-baseline/data-model.md §3,
// contracts/telemetry.md#metrics). Label parameters are the registry's closed value lists, so an
// out-of-set label is a type error; values are also checked at runtime, so an untyped caller
// can't add a series either (001/FR-018). The recorders use no `this`, so they can be passed
// around unbound.

import type {
  Attributes,
  Counter,
  Histogram,
  Meter,
  ObservableGauge,
  ObservableResult,
} from "@opentelemetry/api";
import { INSTRUMENTS, type InstrumentDef } from "./slo-metrics.ts";

type Registry = (typeof INSTRUMENTS)[number];
type DefOf<N extends Registry["name"]> = Extract<Registry, { name: N }>;

export type CounterName = Extract<Registry, { kind: "counter" }>["name"];
export type HistogramName = Extract<Registry, { kind: "histogram" }>["name"];
export type GaugeName = Extract<Registry, { kind: "gauge" }>["name"];

/** "route" accepts any string at type level; the runtime check closes it to the given routes. */
type LabelValue<V> = V extends readonly (infer U)[] ? U : string;
type LabelDefs<N extends Registry["name"]> = DefOf<N>["labels"];

/** The labels an instrument takes: exactly its registry labels, each from its closed list. */
export type LabelsOf<N extends Registry["name"]> = keyof LabelDefs<N> extends never
  ? Readonly<Record<string, never>>
  : { readonly [K in keyof LabelDefs<N>]: LabelValue<LabelDefs<N>[K]> };

/** Instruments without labels take no labels argument. */
type LabelArgs<N extends Registry["name"]> = keyof LabelDefs<N> extends never
  ? []
  : [labels: LabelsOf<N>];

/** Called at each collection; reports the gauge's current value(s) through `report`. */
export type GaugeCallback<N extends GaugeName> = (
  report: (value: number, ...labels: LabelArgs<N>) => void,
) => void | Promise<void>;

export interface Instruments {
  readonly add: <N extends CounterName>(
    name: N,
    value: number,
    ...labels: LabelArgs<NoInfer<N>>
  ) => void;
  readonly record: <N extends HistogramName>(
    name: N,
    value: number,
    ...labels: LabelArgs<NoInfer<N>>
  ) => void;
  /** Reports a gauge at each collection; returns a function that stops reporting. */
  readonly observe: <N extends GaugeName>(name: N, callback: GaugeCallback<N>) => () => void;
  /** Adds 0 to every counter for every combination of its closed label values (research R18). */
  readonly zeroInitialise: () => void;
}

export interface InstrumentOptions {
  /** Registered route templates; `unmatched` is always allowed (contracts/telemetry.md#spans). */
  readonly routes: readonly string[];
}

const UNMATCHED_ROUTE = "unmatched";

interface Entry<I> {
  readonly def: InstrumentDef;
  readonly instrument: I;
}

export function createInstruments(meter: Meter, options: InstrumentOptions): Instruments {
  const routes: readonly string[] = [...new Set([...options.routes, UNMATCHED_ROUTE])];
  const counters = new Map<string, Entry<Counter>>();
  const histograms = new Map<string, Entry<Histogram>>();
  const gauges = new Map<string, Entry<ObservableGauge>>();

  const registry: readonly InstrumentDef[] = INSTRUMENTS;
  for (const def of registry) {
    const base = { description: def.description, unit: def.unit };
    switch (def.kind) {
      case "counter":
        counters.set(def.name, { def, instrument: meter.createCounter(def.name, base) });
        break;
      case "histogram": {
        const advice =
          def.buckets === undefined ? {} : { explicitBucketBoundaries: [...def.buckets] };
        histograms.set(def.name, {
          def,
          instrument: meter.createHistogram(def.name, { ...base, advice }),
        });
        break;
      }
      case "gauge":
        gauges.set(def.name, { def, instrument: meter.createObservableGauge(def.name, base) });
        break;
    }
  }

  const allowed = (values: InstrumentDef["labels"][string]): readonly string[] =>
    values === "route" ? routes : values;

  return {
    add(name, value, ...labels) {
      const { def, instrument } = lookup(counters, name);
      instrument.add(value, checkLabels(def, labels[0], allowed));
    },
    record(name, value, ...labels) {
      const { def, instrument } = lookup(histograms, name);
      instrument.record(value, checkLabels(def, labels[0], allowed));
    },
    observe(name, callback) {
      const { def, instrument } = lookup(gauges, name);
      const observer = (result: ObservableResult): void | Promise<void> =>
        callback((value, ...labels) => {
          result.observe(value, checkLabels(def, labels[0], allowed));
        });
      instrument.addCallback(observer);
      return () => {
        instrument.removeCallback(observer);
      };
    },
    zeroInitialise() {
      for (const { def, instrument } of counters.values()) {
        for (const attributes of combinations(def, allowed)) {
          instrument.add(0, attributes);
        }
      }
    },
  };
}

function lookup<I>(entries: ReadonlyMap<string, Entry<I>>, name: string): Entry<I> {
  const entry = entries.get(name);
  if (entry === undefined) {
    throw new TypeError(`${name} is not a registered instrument of this kind`);
  }
  return entry;
}

/** Validates labels against the registry; error messages name the label, never the value. */
function checkLabels(
  def: InstrumentDef,
  labels: unknown,
  allowed: (values: InstrumentDef["labels"][string]) => readonly string[],
): Attributes {
  const given: unknown = labels ?? {};
  if (typeof given !== "object" || given === null) {
    throw new TypeError(`${def.name}: labels must be an object`);
  }
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(given)) {
    // Own keys only, so an inherited name such as `constructor` is an unknown label too.
    const values = Object.hasOwn(def.labels, key) ? def.labels[key] : undefined;
    if (values === undefined) {
      throw new TypeError(`${def.name}: unknown label ${key}`);
    }
    if (typeof value !== "string" || !allowed(values).includes(value)) {
      throw new TypeError(`${def.name}: label ${key} has a value outside its closed set`);
    }
    attributes[key] = value;
  }
  for (const key of Object.keys(def.labels)) {
    if (!(key in attributes)) {
      throw new TypeError(`${def.name}: missing label ${key}`);
    }
  }
  return attributes;
}

function combinations(
  def: InstrumentDef,
  allowed: (values: InstrumentDef["labels"][string]) => readonly string[],
): Attributes[] {
  let result: Attributes[] = [{}];
  for (const [key, values] of Object.entries(def.labels)) {
    result = result.flatMap((partial) =>
      allowed(values).map((value) => ({ ...partial, [key]: value })),
    );
  }
  return result;
}
