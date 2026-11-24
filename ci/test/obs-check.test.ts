import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  POLL_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  runObsCheck,
  type ObsUrls,
} from "../lib/obs-check.ts";
import { parseCatalog } from "../lib/slo.ts";

function sloIds(): string[] {
  const raw: unknown = JSON.parse(
    readFileSync(new URL("../slo-catalog.json", import.meta.url), "utf8"),
  );
  const catalog = parseCatalog(raw);
  if (Array.isArray(catalog)) {
    throw new Error(`ci/slo-catalog.json is invalid: ${catalog.join("; ")}`);
  }
  return catalog.slos.map((s) => s.id);
}
const SLO_IDS = sloIds();

const urls: ObsUrls = {
  api: "http://api",
  tempo: "http://tempo",
  loki: "http://loki",
  prometheus: "http://prom",
  grafana: "http://grafana",
};
const REQ = ["0af7651916cd43dd8448eb211c80319c", "1af7651916cd43dd8448eb211c80319c"];
const JOB_TRACE = ["00f067aa0ba902b7a1b2c3d4e5f60718", "00e067aa0ba902b7a1b2c3d4e5f60718"];
const REQUEST_SPANS = [
  "POST /sample/trace",
  "db SELECT",
  "common_ground SampleShopConfig",
  "job.enqueue sample.discogs_release",
];
const DISCOGS = "discogs GET /releases/{id}";

interface World {
  clock: number;
  sampleStatus: number;
  sampleBody: (i: number) => unknown;
  requestSpans: readonly string[];
  traceStatus: number;
  tempoDown: boolean;
  jobFound: boolean;
  jobLinks: boolean;
  jobErrors: boolean[];
  discogsSpan: boolean;
  logLines: number;
  /** Counter values before and after the sample requests; undefined = no series yet. */
  metricBefore: string | undefined;
  metricAfter: string;
  queueExported: boolean;
  requestIds: string[];
  unsignalled: number;
  sloFolder: string[];
  overview: boolean;
  dataBeforeSamples: boolean;
  queryError: string | undefined;
}

/** A stack where everything arrives; tests break one part at a time. */
function world() {
  const w: World = {
    clock: 1_800_000_000_000,
    sampleStatus: 202,
    sampleBody: (i) => ({ requestId: `r${String(i)}`, traceId: REQ[i], jobId: `j${String(i)}` }),
    requestSpans: REQUEST_SPANS,
    traceStatus: 200,
    tempoDown: false,
    jobFound: true,
    jobLinks: true,
    jobErrors: [false, true],
    discogsSpan: true,
    logLines: 1,
    metricBefore: undefined,
    metricAfter: "2",
    queueExported: true,
    requestIds: [],
    unsignalled: 0,
    sloFolder: SLO_IDS.map((id) => `slo-${id}`),
    overview: true,
    dataBeforeSamples: false,
    queryError: undefined,
  };
  const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    const path = url.pathname;
    w.unsignalled += init?.signal instanceof AbortSignal ? 0 : 1;
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    if (url.host === "grafana") {
      return grafana(path);
    }
    if (url.host === "api") {
      w.requestIds.push(new Headers(init?.headers).get("x-request-id") ?? "");
      const i = Reflect.get(Object(body), "failJob") === true ? 1 : 0;
      return json(w.sampleBody(i), w.sampleStatus);
    }
    if (url.host === "tempo" && w.tempoDown) {
      return Promise.reject(new Error("connection refused"));
    }
    if (path === "/api/search") {
      const i = (url.searchParams.get("q") ?? "").includes('"j1"') ? 1 : 0;
      return json({ traces: w.jobFound ? [{ traceID: JOB_TRACE[i]?.replace(/^0+/, "") }] : [] });
    }
    if (path.startsWith("/api/traces/")) {
      const i = JOB_TRACE.indexOf(path.slice("/api/traces/".length));
      if (i < 0) {
        const spans = w.requestSpans.map((name) => ({ name }));
        return json({ batches: [{ scopeSpans: [{ spans }] }] }, w.traceStatus);
      }
      const link = { traceId: Buffer.from(REQ[i] ?? "", "hex").toString("base64") };
      const run = {
        name: "job.run sample.discogs_release",
        links: w.jobLinks ? [link] : [],
        status: { code: w.jobErrors[i] === true ? "STATUS_CODE_ERROR" : "STATUS_CODE_UNSET" },
      };
      const spans = w.discogsSpan ? [run, { name: DISCOGS }] : [run];
      return json({ trace: { resourceSpans: [{ scopeSpans: [{ spans }] }] } });
    }
    if (url.host === "loki") {
      const values = Array.from({ length: w.logLines }, () => ["1", "{}"]);
      return json({ data: { result: [{ values }] } });
    }
    const query = url.searchParams.get("query") ?? "";
    if (query.includes("riviera_queue_depth")) {
      return json({ data: { result: w.queueExported ? [{ value: [1, "1"] }] : [] } });
    }
    const value = w.requestIds.length > 0 ? w.metricAfter : w.metricBefore;
    return json({ data: { result: value === undefined ? [] : [{ value: [1, value] }] } });
  };
  const grafana = (path: string): Promise<Response> => {
    if (path === "/api/search") {
      const slos = w.sloFolder.map((uid) => ({ uid, folderTitle: "SLOs" }));
      const overview = w.overview ? [{ uid: "service-overview", folderTitle: "Service" }] : [];
      return json([...slos, ...overview]);
    }
    if (path.startsWith("/api/dashboards/uid/")) {
      const stat = (title: string, expr: string) => ({
        type: "stat",
        title,
        targets: [{ expr, instant: true }],
      });
      const graph = { type: "timeseries", title: "graph", targets: [{ expr: "sli" }] };
      const panels = [{ type: "row" }, stat("Target", "vector(0.99)"), stat("SLI", "sli"), graph];
      return json({ dashboard: { panels } });
    }
    const frame = { data: { values: [[1], [w.dataBeforeSamples ? 0.5 : null]] } };
    const error = w.queryError === undefined ? {} : { error: w.queryError };
    return json({ results: { A: { frames: [frame], ...error } } });
  };
  const lines: string[] = [];
  const deps = {
    fetch: fetchFn,
    now: () => w.clock,
    sleep: (ms: number) => {
      w.clock += ms;
      return Promise.resolve();
    },
    log: (line: string) => {
      lines.push(line);
    },
  };
  const run = async () => ({
    ok: await runObsCheck(urls, deps, SLO_IDS),
    lines,
  });
  return { w, run };
}

describe("obs-check (001/FR-033)", () => {
  it("001/FR-033: reads the 7 SLOs of the catalog", () => {
    expect(SLO_IDS).toHaveLength(7);
  });

  it("001/FR-033: passes every step when traces, logs, metrics and dashboards arrive", async () => {
    const { w, run } = world();
    const { ok, lines } = await run();
    expect(lines).toHaveLength(5);
    expect(lines.every((l) => l.startsWith("PASS"))).toBe(true);
    expect(ok).toBe(true);
    expect(w.requestIds).toHaveLength(2);
    expect(w.requestIds[0]).not.toBe(w.requestIds[1]);
  });

  it("001/FR-033: every request carries a timeout signal, so a silent service can't hang it", async () => {
    const { w, run } = world();
    await run();
    expect(w.unsignalled).toBe(0);
    expect(REQUEST_TIMEOUT_MS).toBeLessThan(POLL_TIMEOUT_MS);
  });

  it.each<[string, (w: World) => void, string]>([
    ["sample flows off", (w) => (w.sampleStatus = 404), "sample flows are off"],
    ["no Common Ground key", (w) => (w.sampleStatus = 502), "COMMON_GROUND_DEV_API_KEY"],
    ["a sample answer without ids", (w) => (w.sampleBody = () => ({})), "HTTP 202 without"],
    ["a sample request error", (w) => (w.sampleStatus = 500), "HTTP 500 without"],
    ["a missing request span", (w) => (w.requestSpans = REQUEST_SPANS.slice(1)), "missing spans"],
    ["no request trace", (w) => (w.traceStatus = 404), "answered HTTP 404"],
    ["an unreachable Tempo", (w) => (w.tempoDown = true), "(connection refused)"],
    ["no job trace", (w) => (w.jobFound = false), "no trace with that riviera.job.id"],
    ["a job trace without its Discogs span", (w) => (w.discogsSpan = false), DISCOGS],
    ["no link to the request", (w) => (w.jobLinks = false), "no link to request trace"],
    ["an ok job marked as error", (w) => (w.jobErrors = [true, true]), "error status is true"],
    ["a failed job not marked", (w) => (w.jobErrors = [false, false]), "error status is false"],
    ["no log lines", (w) => (w.logLines = 0), "no line matches"],
    ["a counter that did not rise", (w) => (w.metricBefore = "2"), "not above 2, its value before"],
    ["no queue-depth series", (w) => (w.queueExported = false), "not exported yet"],
    ["a missing SLO dashboard", (w) => w.sloFolder.pop(), 'folder "SLOs" holds'],
    ["an extra SLO dashboard", (w) => w.sloFolder.push("slo-extra"), "expected exactly"],
    ["no overview dashboard", (w) => (w.overview = false), "uid service-overview"],
    ["data before samples", (w) => (w.dataBeforeSamples = true), "needs fresh volumes"],
    ["a failing Grafana query", (w) => (w.queryError = "bad expr"), "Grafana query for"],
  ])("001/FR-033: fails with a clear message on %s", async (_, breakIt, message) => {
    const { w, run } = world();
    breakIt(w);
    const { ok, lines } = await run();
    expect(ok).toBe(false);
    expect(lines.at(-1)).toMatch(/^FAIL /);
    expect(lines.at(-1)).toContain(message);
  });

  it("001/FR-033: waits the full 30 s before giving up on a signal", async () => {
    const { w, run } = world();
    w.logLines = 0;
    const start = w.clock;
    await run();
    expect(w.clock - start).toBeGreaterThanOrEqual(POLL_TIMEOUT_MS);
    expect(w.clock - start).toBeLessThan(POLL_TIMEOUT_MS + 2_000);
  });
});
