// End-to-end observability check against the running stack (001/FR-033, research R14). Each step
// asks the stack's own query interfaces (Tempo, Loki, Prometheus, Grafana) and fails with a
// message that says what was missing. The CLI is ci/obs-check.ts.

export interface ObsUrls {
  readonly api: string;
  readonly tempo: string;
  readonly loki: string;
  readonly prometheus: string;
  readonly grafana: string;
  readonly otlp: string;
}

export interface ObsDeps {
  readonly fetch: typeof fetch;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log: (line: string) => void;
}

/** SC-001/SC-002: traces, logs and metrics must be queryable within 30 s. */
export const POLL_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 1_000;
/** Per request, so a service that accepts the connection but never answers can't hang the check. */
export const REQUEST_TIMEOUT_MS = 10_000;
/** The api's metric export interval (METRIC_EXPORT_INTERVAL_MS in packages/telemetry/src/sdk.ts). */
export const EXPORT_INTERVAL_MS = 5_000;
/**
 * Sample points are stamped this far in the past: the freshness SLI is a `[28d:5m]` subquery,
 * whose steps sit on 5-minute boundaries and look back 5 minutes, so a point newer than the last
 * boundary would show nothing until the next one. Prometheus accepts it (30 m out-of-order window).
 */
const SAMPLE_BACKDATE_MS = 6 * 60_000;
const SAMPLE_SERVICE = "riviera-slo-sample";
const JOB = "sample.discogs_release";

/** The subset of a registry instrument (packages/telemetry/src/slo-metrics.ts) samples need. */
export interface SampleInstrument {
  readonly name: string;
  readonly kind: "counter" | "histogram" | "gauge";
  readonly unit: string;
  readonly labels: Readonly<Record<string, readonly string[] | "route">>;
  readonly buckets?: readonly number[];
  readonly slo?: string;
}

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Walks object keys of an untyped JSON value; undefined as soon as one is missing. */
function at(value: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>((v, key) => (isRecord(v) ? v[key] : undefined), value);
}

function errorText(error: unknown): string {
  return String(error).replace(/^Error: /, "");
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function getJson(deps: ObsDeps, url: string, init?: RequestInit): Promise<unknown> {
  const res = await deps.fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) {
    fail(`${init?.method ?? "GET"} ${url} answered HTTP ${String(res.status)}`);
  }
  return res.json();
}

/** Calls `attempt` until it returns undefined (done); a string or an error is the reason to wait. */
async function poll(deps: ObsDeps, what: string, attempt: () => Promise<string | undefined>) {
  const deadline = deps.now() + POLL_TIMEOUT_MS;
  for (;;) {
    let reason: string | undefined;
    try {
      reason = await attempt();
    } catch (error) {
      reason = errorText(error);
    }
    if (reason === undefined) {
      return;
    }
    if (deps.now() >= deadline) {
      fail(`${what}: not there within ${String(POLL_TIMEOUT_MS / 1000)} s (${reason})`);
    }
    await deps.sleep(POLL_INTERVAL_MS);
  }
}

interface Span {
  readonly name: string;
  readonly error: boolean;
  readonly linkTraceIds: readonly string[];
}

/** Tempo's JSON carries ids as base64 (protobuf JSON) or hex; search drops leading zeros. */
function hexId(id: string, length: number): string {
  const hex = /^[0-9a-f]+$/i.test(id) ? id : Buffer.from(id, "base64").toString("hex");
  return hex.toLowerCase().padStart(length, "0");
}

function spansOf(trace: unknown): Span[] {
  // `/api/traces/{id}` answers `{ batches }` (v1) or `{ trace: { resourceSpans } }` (v2).
  const root = at(trace, "trace") ?? trace;
  return [...list(at(root, "batches")), ...list(at(root, "resourceSpans"))]
    .flatMap((batch) => list(at(batch, "scopeSpans")))
    .flatMap((scope) => list(at(scope, "spans")))
    .map((span) => {
      const status = at(span, "status", "code");
      return {
        name: str(at(span, "name")),
        error: status === 2 || status === "STATUS_CODE_ERROR",
        linkTraceIds: list(at(span, "links")).map((link) => hexId(str(at(link, "traceId")), 32)),
      };
    });
}

function missingSpans(spans: readonly Span[], names: readonly string[]): string | undefined {
  const have = new Set(spans.map((s) => s.name));
  const missing = names.filter((n) => !have.has(n));
  return missing.length === 0 ? undefined : `missing spans: ${missing.join(", ")}`;
}

const REQUEST_SPANS = [
  "POST /sample/trace",
  "db SELECT",
  "common_ground SampleShopConfig",
  `job.enqueue ${JOB}`,
];

async function checkRequestTrace(urls: ObsUrls, deps: ObsDeps, traceId: string) {
  await poll(deps, `request trace ${traceId} in Tempo`, async () =>
    missingSpans(
      spansOf(await getJson(deps, `${urls.tempo}/api/traces/${traceId}`)),
      REQUEST_SPANS,
    ),
  );
}

/** Finds the job's trace by its `riviera.job.id`, checks its spans and link; returns its id. */
async function checkJobTrace(
  urls: ObsUrls,
  deps: ObsDeps,
  job: { readonly jobId: string; readonly traceId: string; readonly failed: boolean },
): Promise<string> {
  let jobTraceId = "";
  await poll(deps, `job ${job.jobId} trace in Tempo`, async () => {
    const end = Math.floor(deps.now() / 1000);
    const q = `{ span.riviera.job.id = "${job.jobId}" }`;
    const search = new URLSearchParams({ q, start: String(end - 3600), end: String(end) });
    const found = await getJson(deps, `${urls.tempo}/api/search?${search.toString()}`);
    const first = list(at(found, "traces"))[0];
    if (first === undefined) {
      return "no trace with that riviera.job.id yet";
    }
    jobTraceId = hexId(str(at(first, "traceID")), 32);
    const spans = spansOf(await getJson(deps, `${urls.tempo}/api/traces/${jobTraceId}`));
    const missing = missingSpans(spans, [`job.run ${JOB}`, "discogs GET /releases/{id}"]);
    if (missing !== undefined) {
      return missing;
    }
    const runs = spans.filter((s) => s.name === `job.run ${JOB}`);
    if (!runs.every((run) => run.linkTraceIds.includes(job.traceId))) {
      return `job span has no link to request trace ${job.traceId}`;
    }
    const wrong = runs.find((run) => run.error !== job.failed);
    return wrong === undefined ? undefined : `job span error status is ${String(wrong.error)}`;
  });
  return jobTraceId;
}

async function checkLogs(urls: ObsUrls, deps: ObsDeps, what: string, filters: string) {
  await poll(deps, `${what} log lines in Loki`, async () => {
    const end = deps.now();
    const search = new URLSearchParams({
      query: `{service_name=~".+"} ${filters}`,
      start: String((end - 3_600_000) * 1e6),
      end: String(end * 1e6),
      limit: "10",
    });
    const body = await getJson(deps, `${urls.loki}/loki/api/v1/query_range?${search.toString()}`);
    const lines = list(at(body, "data", "result")).flatMap((stream) => list(at(stream, "values")));
    return lines.length > 0 ? undefined : `no line matches ${filters}`;
  });
}

/** Counters this run's samples must raise; read once before the sample requests. */
const RISING_SERIES = [
  `sum(riviera_http_server_duration_seconds_count{route="/sample/trace"})`,
  `sum(riviera_jobs_runs_total{job_name="${JOB}",outcome="succeeded"})`,
  `sum(riviera_jobs_failures_total{job_name="${JOB}"})`,
  `sum(riviera_external_calls_total{service="common_ground",outcome="success"})`,
  `sum(riviera_external_calls_total{service="discogs",outcome="success"})`,
];
/** A gauge: it only has to be exported (0 for an empty queue is a value). */
const QUEUE_DEPTH = `count(riviera_queue_depth{job_name="${JOB}"})`;

/** The first result of an instant query; 0 when there is no series yet. */
async function promValue(urls: ObsUrls, deps: ObsDeps, query: string): Promise<number> {
  const url = `${urls.prometheus}/api/v1/query?${new URLSearchParams({ query }).toString()}`;
  const value = Number(
    list(at(list(at(await getJson(deps, url), "data", "result"))[0], "value"))[1],
  );
  return Number.isFinite(value) ? value : 0;
}

interface Baseline {
  readonly query: string;
  readonly before: number;
}

async function readBaselines(urls: ObsUrls, deps: ObsDeps): Promise<Baseline[]> {
  const baselines: Baseline[] = [];
  for (const query of RISING_SERIES) {
    baselines.push({ query, before: await promValue(urls, deps, query) });
  }
  return baselines;
}

async function checkMetrics(urls: ObsUrls, deps: ObsDeps, baselines: readonly Baseline[]) {
  for (const { query, before } of baselines) {
    await poll(deps, `Prometheus series ${query}`, async () =>
      (await promValue(urls, deps, query)) > before
        ? undefined
        : `not above ${String(before)}, its value before the sample requests`,
    );
  }
  await poll(deps, `Prometheus series ${QUEUE_DEPTH}`, async () =>
    (await promValue(urls, deps, QUEUE_DEPTH)) > 0 ? undefined : "not exported yet",
  );
}

interface PanelQuery {
  readonly panel: string;
  readonly expr: string;
  readonly instant: boolean;
  readonly stat: boolean;
  /** The target's datasource, else its panel's, as the dashboard JSON gives it. */
  readonly datasource: unknown;
}

async function checkSearch(urls: ObsUrls, deps: ObsDeps, sloIds: readonly string[]) {
  const found = list(await getJson(deps, `${urls.grafana}/api/search?type=dash-db&limit=5000`));
  const items = found.filter(isRecord);
  const slos = items.filter((d) => d["folderTitle"] === "SLOs").map((d) => str(d["uid"]));
  const expected = sloIds.map((id) => `slo-${id}`);
  if ([...slos].sort().join() !== [...expected].sort().join()) {
    fail(`folder "SLOs" holds [${slos.join(", ")}], expected exactly [${expected.join(", ")}]`);
  }
  if (!items.some((d) => d["uid"] === "service-overview")) {
    fail("the overview dashboard (uid service-overview) is not provisioned");
  }
}

/** Every Prometheus query of a dashboard except constant targets such as `vector(0.999)`. */
async function panelQueries(urls: ObsUrls, deps: ObsDeps, uid: string): Promise<PanelQuery[]> {
  const body = await getJson(deps, `${urls.grafana}/api/dashboards/uid/${uid}`);
  const top = list(at(body, "dashboard", "panels"));
  // A collapsed row keeps its panels in `row.panels` instead of the top level.
  return [...top, ...top.flatMap((row) => list(at(row, "panels")))]
    .flatMap((panel) =>
      list(at(panel, "targets")).map((t) => ({
        panel: str(at(panel, "title")),
        expr: str(at(t, "expr")),
        instant: at(t, "instant") === true,
        stat: at(panel, "type") === "stat",
        datasource: at(t, "datasource") ?? at(panel, "datasource"),
      })),
    )
    .filter((q) => !/^vector\([\d.]+\)$/.test(q.expr));
}

/** Runs one panel query through Grafana; true if any frame holds a finite value. */
async function hasValue(urls: ObsUrls, deps: ObsDeps, q: PanelQuery): Promise<boolean> {
  const query = {
    refId: "A",
    datasource: q.datasource,
    expr: q.expr,
    instant: q.instant,
    range: !q.instant,
    maxDataPoints: 100,
  };
  const body = await getJson(deps, `${urls.grafana}/api/ds/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ queries: [query], from: "now-28d", to: "now" }),
  });
  const error = at(body, "results", "A", "error");
  if (typeof error === "string") {
    fail(`Grafana query for "${q.panel}" failed: ${error}`);
  }
  // Each frame's first column is the time; any finite number in the others is a value.
  return list(at(body, "results", "A", "frames"))
    .flatMap((frame) => list(at(frame, "data", "values")).slice(1))
    .some((column) => list(column).some((v) => typeof v === "number" && Number.isFinite(v)));
}

async function checkNoData(urls: ObsUrls, deps: ObsDeps, sloIds: readonly string[]) {
  for (const id of sloIds) {
    for (const q of await panelQueries(urls, deps, `slo-${id}`)) {
      if (await hasValue(urls, deps, q)) {
        fail(
          `slo-${id} panel "${q.panel}" shows data before any samples were sent (the check ` +
            "needs fresh volumes: docker compose --profile dev --profile observability down --volumes)",
        );
      }
    }
  }
}

async function checkSloValues(urls: ObsUrls, deps: ObsDeps, sloIds: readonly string[]) {
  for (const id of sloIds) {
    for (const q of (await panelQueries(urls, deps, `slo-${id}`)).filter((p) => p.stat)) {
      await poll(deps, `slo-${id} panel "${q.panel}"`, async () =>
        (await hasValue(urls, deps, q)) ? undefined : "no value yet",
      );
    }
  }
}

function combinations(labels: SampleInstrument["labels"]): Record<string, string>[] {
  return Object.entries(labels).reduce<Record<string, string>[]>(
    (acc, [key, values]) =>
      acc.flatMap((combo) =>
        (values === "route" ? ["unmatched"] : values).map((v) => ({ ...combo, [key]: v })),
      ),
    [{}],
  );
}

interface OtlpPoint {
  readonly attributes: readonly { key: string; value: { stringValue: string } }[];
  readonly startTimeUnixNano: string;
  readonly timeUnixNano: string;
  readonly asDouble?: number;
  readonly count?: string;
  readonly sum?: number;
  readonly explicitBounds?: readonly number[];
  readonly bucketCounts?: readonly string[];
}

interface OtlpData {
  /** 2 = cumulative. */
  readonly aggregationTemporality?: 2;
  readonly isMonotonic?: boolean;
  readonly dataPoints: readonly OtlpPoint[];
}

export interface OtlpMetric {
  readonly name: string;
  readonly unit: string;
  readonly sum?: OtlpData;
  readonly gauge?: OtlpData;
  readonly histogram?: OtlpData;
}

/** OTLP/JSON `ExportMetricsServiceRequest` with one resource and one scope. */
export interface OtlpMetricsRequest {
  readonly resourceMetrics: readonly {
    readonly resource: { readonly attributes: OtlpPoint["attributes"] };
    readonly scopeMetrics: readonly {
      readonly scope: { readonly name: string };
      readonly metrics: readonly OtlpMetric[];
    }[];
  }[];
}

/**
 * One OTLP/JSON metrics request with point `n` (0 or 1) of every series of every SLO instrument:
 * counters at 0 then 1, histograms one then two observations of 0 s (first bucket), gauges the time
 * of the point (a Unix time in seconds, for `riviera.sync.last_success`).
 */
export function sampleRequest(
  instruments: readonly SampleInstrument[],
  n: 0 | 1,
  startMs: number,
  timeMs: number,
): OtlpMetricsRequest {
  const start = String((startMs - SAMPLE_BACKDATE_MS) * 1e6);
  const time = String((timeMs - SAMPLE_BACKDATE_MS) * 1e6);
  const metrics = instruments
    .filter((def) => def.slo !== undefined)
    .map((def): OtlpMetric => {
      const points = combinations(def.labels).map((combo) => ({
        attributes: Object.entries(combo).map(([key, v]) => ({ key, value: { stringValue: v } })),
        startTimeUnixNano: start,
        timeUnixNano: time,
      }));
      const head = { name: def.name, unit: def.unit };
      if (def.kind === "counter") {
        const dataPoints = points.map((p) => ({ ...p, asDouble: n }));
        return { ...head, sum: { aggregationTemporality: 2, isMonotonic: true, dataPoints } };
      }
      if (def.kind === "gauge") {
        // The Unix time of the (backdated) point itself, so the sync never "succeeds" after it.
        const unixSeconds = Math.floor((timeMs - SAMPLE_BACKDATE_MS) / 1000);
        const dataPoints = points.map((p) => ({ ...p, asDouble: unixSeconds }));
        return { ...head, gauge: { dataPoints } };
      }
      const bounds = def.buckets ?? [];
      const dataPoints = points.map((p) => ({
        ...p,
        count: String(n + 1),
        sum: 0,
        explicitBounds: bounds,
        bucketCounts: [String(n + 1), ...bounds.map(() => "0")],
      }));
      return { ...head, histogram: { aggregationTemporality: 2, dataPoints } };
    });
  const resource = {
    attributes: [{ key: "service.name", value: { stringValue: SAMPLE_SERVICE } }],
  };
  return {
    resourceMetrics: [{ resource, scopeMetrics: [{ scope: { name: "obs-check" }, metrics }] }],
  };
}

/** Research R14 step 4: two points per series, at least one export interval apart. */
export async function emitSloSamples(
  urls: ObsUrls,
  deps: ObsDeps,
  instruments: readonly SampleInstrument[],
): Promise<void> {
  const start = deps.now() - 1000;
  for (const n of [0, 1] as const) {
    if (n === 1) {
      await deps.sleep(EXPORT_INTERVAL_MS);
    }
    const body = JSON.stringify(sampleRequest(instruments, n, start, deps.now()));
    const init = { method: "POST", headers: { "content-type": "application/json" }, body };
    await getJson(deps, `${urls.otlp}/v1/metrics`, init);
  }
}

async function sendSample(urls: ObsUrls, deps: ObsDeps, flow: "ok" | "fail") {
  const url = `${urls.api}/api/sample/trace`;
  const res = await deps.fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": `obs-check-${flow}-${String(deps.now())}`,
    },
    body: JSON.stringify({ failJob: flow === "fail" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 404) {
    fail(
      `${url} answered 404: sample flows are off (start the stack with make up-dev, or set ` +
        "SAMPLE_FLOWS_ENABLED=true, DEPLOYMENT_ENVIRONMENT=ci and the mock URLs)",
    );
  }
  if (res.status === 502) {
    fail(
      `${url} answered 502: the Common Ground mock call failed. Is COMMON_GROUND_DEV_API_KEY ` +
        "set for the api? make up-dev sets it; without it the mock answers 401",
    );
  }
  const body: unknown = res.status === 202 ? await res.json() : undefined;
  const result = {
    requestId: str(at(body, "requestId")),
    traceId: str(at(body, "traceId")),
    jobId: str(at(body, "jobId")),
  };
  if (result.requestId === "" || !/^[0-9a-f]{32}$/.test(result.traceId) || result.jobId === "") {
    fail(`${url} answered HTTP ${String(res.status)} without requestId, traceId and jobId`);
  }
  return result;
}

/** Runs every step of research R14 in order; stops at the first failure. True if all pass. */
export async function runObsCheck(
  urls: ObsUrls,
  deps: ObsDeps,
  sloIds: readonly string[],
  instruments: readonly SampleInstrument[],
): Promise<boolean> {
  let current = "";
  async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
    current = name;
    const value = await run();
    deps.log(`PASS ${name}`);
    return value;
  }
  try {
    await step(`Grafana has the ${String(sloIds.length)} SLO dashboards and the overview`, () =>
      checkSearch(urls, deps, sloIds),
    );
    await step("SLO panels show no data before samples", () => checkNoData(urls, deps, sloIds));
    const { baselines, samples } = await step(
      "sample request accepted, with and without failJob",
      async () => ({
        baselines: await readBaselines(urls, deps),
        samples: [
          { ...(await sendSample(urls, deps, "ok")), failed: false },
          { ...(await sendSample(urls, deps, "fail")), failed: true },
        ],
      }),
    );
    await step("request traces, job traces and their log lines arrive", async () => {
      for (const s of samples) {
        await checkRequestTrace(urls, deps, s.traceId);
        const requestFilter = `| trace_id="${s.traceId}" | request_id="${s.requestId}"`;
        await checkLogs(urls, deps, "request", requestFilter);
        const jobTraceId = await checkJobTrace(urls, deps, s);
        await checkLogs(urls, deps, "job", `| trace_id="${jobTraceId}" | job_id="${s.jobId}"`);
      }
    });
    await step("http, job and external counters rise; queue depth is exported", () =>
      checkMetrics(urls, deps, baselines),
    );
    await step("SLO samples sent; SLI and budget panels show values", async () => {
      await emitSloSamples(urls, deps, instruments);
      await checkSloValues(urls, deps, sloIds);
    });
    return true;
  } catch (error) {
    deps.log(`FAIL ${current}: ${errorText(error)}`);
    return false;
  }
}
