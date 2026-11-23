// Metric registry (specs/001-observability-baseline/data-model.md §3). Every instrument the
// api and worker register is defined here, once: the SLO catalog's metrics
// (ci/slo-catalog.json) and the service metrics of research R6. `ci/slo-check.ts` imports
// SLO_METRIC_NAMES with plain `node`, so this file has no runtime imports.

/** Label values: a closed list, or "route" (the registered route templates plus `unmatched`). */
type LabelValues = readonly string[] | "route";

export interface InstrumentDef {
  readonly name: `riviera.${string}`;
  readonly kind: "counter" | "histogram" | "gauge";
  /** "s" for durations and Unix times, or an annotation such as "{request}". */
  readonly unit: string;
  readonly description: string;
  readonly labels: Readonly<Record<string, LabelValues>>;
  /** Histograms only: explicit bucket boundaries, ascending. */
  readonly buckets?: readonly number[];
  /** The catalog SLO this instrument feeds. */
  readonly slo?: string;
  /** One of the catalog's minimumMetrics. */
  readonly minimum?: true;
}

const SERVICE = ["common_ground", "discogs"] as const;
const EXTERNAL_OPERATION = ["SampleShopConfig", "GET /releases/{id}"] as const;
const EXTERNAL_OUTCOME = ["success", "failed", "rate_limited"] as const;
const JOB_NAME = ["sample.discogs_release"] as const;
const JOB_OUTCOME = ["succeeded", "failed"] as const;
const SYNC_KIND = ["full", "light"] as const;

export const INSTRUMENTS = [
  // Service metrics (FR-015, FR-016, FR-017; research R6).
  {
    name: "riviera.http.server.duration",
    kind: "histogram",
    unit: "s",
    description: "HTTP server request duration, health endpoints excluded.",
    labels: {
      route: "route",
      method: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      status_class: ["1xx", "2xx", "3xx", "4xx", "5xx"],
    },
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5, 5],
  },
  {
    name: "riviera.external.calls",
    kind: "counter",
    unit: "{call}",
    description: "Calls to Common Ground and Discogs.",
    labels: { service: SERVICE, operation: EXTERNAL_OPERATION, outcome: EXTERNAL_OUTCOME },
    minimum: true,
  },
  {
    name: "riviera.external.duration",
    kind: "histogram",
    unit: "s",
    description: "Duration of calls to Common Ground and Discogs.",
    labels: { service: SERVICE, operation: EXTERNAL_OPERATION, outcome: EXTERNAL_OUTCOME },
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  },
  {
    name: "riviera.jobs.runs",
    kind: "counter",
    unit: "{run}",
    description: "Background job attempts, by outcome.",
    labels: { job_name: JOB_NAME, outcome: JOB_OUTCOME },
  },
  {
    name: "riviera.jobs.duration",
    kind: "histogram",
    unit: "s",
    description: "Background job attempt duration.",
    labels: { job_name: JOB_NAME, outcome: JOB_OUTCOME },
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60, 300],
  },
  {
    name: "riviera.jobs.failures",
    kind: "counter",
    unit: "{failure}",
    description: "Failed background job attempts; each failed attempt counts once.",
    labels: { job_name: JOB_NAME },
    minimum: true,
  },
  {
    name: "riviera.queue.depth",
    kind: "gauge",
    unit: "{job}",
    description: "Queued background jobs.",
    labels: { job_name: JOB_NAME },
    minimum: true,
  },

  // SLO metrics (FR-014), recorded by later features.
  {
    name: "riviera.verdict.requests",
    kind: "counter",
    unit: "{request}",
    description: "Verdict requests, by outcome.",
    labels: { outcome: ["success", "error"] },
    slo: "verdict-saved",
  },
  {
    name: "riviera.verdict.duration",
    kind: "histogram",
    unit: "s",
    description: "Verdict request duration.",
    labels: {},
    buckets: [0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2.5, 5],
    slo: "verdict-saved",
  },
  {
    name: "riviera.dig.next_record.duration",
    kind: "histogram",
    unit: "s",
    description: "Time to return the next record with its audio source.",
    labels: {},
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    slo: "next-record-ready",
  },
  {
    name: "riviera.sync.runs",
    kind: "counter",
    unit: "{run}",
    description: "Inventory sync runs, by kind and outcome.",
    labels: { kind: SYNC_KIND, outcome: ["success", "failed"] },
    slo: "inventory-freshness",
  },
  {
    name: "riviera.sync.duration",
    kind: "histogram",
    unit: "s",
    description: "Inventory sync run duration.",
    labels: { kind: SYNC_KIND },
    buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600, 7200],
    slo: "inventory-freshness",
  },
  {
    name: "riviera.sync.last_success",
    kind: "gauge",
    unit: "s",
    description: "Unix time of the last successful inventory sync.",
    labels: { kind: SYNC_KIND },
    slo: "inventory-freshness",
  },
  {
    name: "riviera.pile.sold_removal.delay",
    kind: "histogram",
    unit: "s",
    description: "Delay between a record selling in Common Ground and it leaving every pile.",
    labels: {},
    buckets: [30, 60, 120, 300, 600, 900, 1200, 1800, 3600],
    slo: "sold-record-removal",
  },
  {
    name: "riviera.checkout.started",
    kind: "counter",
    unit: "{checkout}",
    description: "Staff checkouts started.",
    labels: {},
    slo: "staff-checkout-correctness",
  },
  {
    name: "riviera.checkout.finished",
    kind: "counter",
    unit: "{checkout}",
    description: "Staff checkouts finished, by outcome.",
    labels: { outcome: ["paid", "stopped_safely", "failed"] },
    slo: "staff-checkout-correctness",
  },
  {
    name: "riviera.checkout.mismatches",
    kind: "counter",
    unit: "{checkout}",
    description: "Staff checkouts with a total mismatch.",
    labels: {},
    slo: "staff-checkout-correctness",
  },
  {
    name: "riviera.checkout.paid_after_mismatch",
    kind: "counter",
    unit: "{checkout}",
    description: "Staff checkouts marked paid despite a total mismatch.",
    labels: {},
    slo: "staff-checkout-correctness",
  },
  {
    name: "riviera.audio.resolutions",
    kind: "counter",
    unit: "{record}",
    description: "Audio source resolutions, by source and outcome.",
    labels: { source: ["cg_snippet", "discogs_video"], outcome: ["playable", "unplayable"] },
    slo: "audio-resolvable",
  },
  {
    name: "riviera.notification.delivery.delay",
    kind: "histogram",
    unit: "s",
    description: "Delay between a push notification's trigger and its send.",
    labels: {},
    buckets: [5, 10, 30, 60, 120, 300, 600, 1800],
    slo: "notification-delivery",
  },
] as const satisfies readonly InstrumentDef[];

function isCatalogInstrument(def: InstrumentDef): boolean {
  return def.slo !== undefined || def.minimum === true;
}

/** Names of the catalog instruments (`slo` or `minimum` set); read by ci/slo-check.ts. */
export const SLO_METRIC_NAMES: readonly string[] = INSTRUMENTS.filter(isCatalogInstrument).map(
  (def) => def.name,
);
