// End-to-end observability check against the running stack (001/FR-033, research R14 steps 2-3).
// Each step asks the stack's own query interfaces (Tempo, Loki, Prometheus) and fails with a
// message that says what was missing. The CLI is ci/obs-check.ts. The Grafana dashboard steps
// and the SLO samples (R14 steps 1, 4 and 5) follow in the next T023 PR.

export interface ObsUrls {
  readonly api: string;
  readonly tempo: string;
  readonly loki: string;
  readonly prometheus: string;
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
const JOB = "sample.discogs_release";

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

const SERVICE_SERIES = [
  `sum(riviera_http_server_duration_seconds_count{route="/sample/trace"})`,
  `sum(riviera_jobs_runs_total{job_name="${JOB}",outcome="succeeded"})`,
  `sum(riviera_jobs_failures_total{job_name="${JOB}"})`,
  `sum(riviera_external_calls_total{service="common_ground",outcome="success"})`,
  `sum(riviera_external_calls_total{service="discogs",outcome="success"})`,
  `count(riviera_queue_depth{job_name="${JOB}"})`,
];

async function checkMetrics(urls: ObsUrls, deps: ObsDeps) {
  for (const query of SERVICE_SERIES) {
    await poll(deps, `Prometheus series ${query}`, async () => {
      const url = `${urls.prometheus}/api/v1/query?${new URLSearchParams({ query }).toString()}`;
      const body = await getJson(deps, url);
      const value = Number(list(at(list(at(body, "data", "result"))[0], "value"))[1]);
      return value > 0 ? undefined : "no value above 0 yet";
    });
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

/** Runs R14 steps 2-3 in order; stops at the first failure. True if all pass. */
export async function runObsCheck(urls: ObsUrls, deps: ObsDeps): Promise<boolean> {
  let current = "";
  async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
    current = name;
    const value = await run();
    deps.log(`PASS ${name}`);
    return value;
  }
  try {
    const samples = await step("sample request accepted, with and without failJob", async () => [
      { ...(await sendSample(urls, deps, "ok")), failed: false },
      { ...(await sendSample(urls, deps, "fail")), failed: true },
    ]);
    await step("request traces, job traces and their log lines arrive", async () => {
      for (const s of samples) {
        await checkRequestTrace(urls, deps, s.traceId);
        const requestFilter = `| trace_id="${s.traceId}" | request_id="${s.requestId}"`;
        await checkLogs(urls, deps, "request", requestFilter);
        const jobTraceId = await checkJobTrace(urls, deps, s);
        await checkLogs(urls, deps, "job", `| trace_id="${jobTraceId}" | job_id="${s.jobId}"`);
      }
    });
    await step("http, job, external and queue-depth metrics arrive", () =>
      checkMetrics(urls, deps),
    );
    return true;
  } catch (error) {
    deps.log(`FAIL ${current}: ${errorText(error)}`);
    return false;
  }
}
