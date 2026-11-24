import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { METRIC_EXPORT_INTERVAL_MS } from "../../packages/telemetry/src/sdk.ts";
import { INSTRUMENTS } from "../../packages/telemetry/src/slo-metrics.ts";
import {
  EXPORT_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  runObsCheck,
  sampleRequest,
  type ObsUrls,
  type OtlpMetric,
  type OtlpMetricsRequest,
} from "../lib/obs-check.ts";
import { parseCatalog } from "../lib/slo.ts";

const catalog = parseCatalog(
  JSON.parse(readFileSync(new URL("../slo-catalog.json", import.meta.url), "utf8")),
);
const SLO_IDS = Array.isArray(catalog) ? [] : catalog.slos.map((s) => s.id);
const urls: ObsUrls = {
  api: "http://api",
  tempo: "http://tempo",
  loki: "http://loki",
  prometheus: "http://prom",
  grafana: "http://grafana",
  otlp: "http://otlp",
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

/** A stack where everything arrives; tests break one part at a time. */
interface World {
  clock: number;
  otlpBodies: unknown[];
  sloFolder: string[];
  overview: boolean;
  dataBeforeSamples: boolean;
  valuesAfterSamples: boolean;
  queryError: string | undefined;
  sampleStatus: number;
  sampleBody: (i: number) => unknown;
  requestSpans: readonly string[];
  traceStatus: number;
  jobFound: boolean;
  jobLinks: boolean;
  jobErrors: boolean[];
  logLines: number;
  metricValue: string;
  calls: string[];
  tempoDown: boolean;
  discogsSpan: boolean;
}

function world() {
  const w: World = {
    clock: 1_800_000_000_000,
    otlpBodies: [],
    sloFolder: SLO_IDS.map((id) => `slo-${id}`),
    overview: true,
    dataBeforeSamples: false,
    valuesAfterSamples: true,
    queryError: undefined,
    sampleStatus: 202,
    sampleBody: (i: number): unknown => ({
      requestId: `r${String(i)}`,
      traceId: REQ[i],
      jobId: `j${String(i)}`,
    }),
    requestSpans: REQUEST_SPANS,
    traceStatus: 200,
    jobFound: true,
    jobLinks: true,
    jobErrors: [false, true],
    logLines: 1,
    metricValue: "1",
    calls: [],
    tempoDown: false,
    discogsSpan: true,
  };
  const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    w.calls.push(`${init?.method ?? "GET"} ${url.host}${url.pathname}`);
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const path = url.pathname;
    if (w.tempoDown && url.host === "tempo") {
      return Promise.reject(new Error("connection refused"));
    }
    if (url.host === "api") {
      const i = Reflect.get(Object(body), "failJob") === true ? 1 : 0;
      return json(w.sampleBody(i), w.sampleStatus);
    }
    if (url.host === "otlp") {
      w.otlpBodies.push(body);
      return json({});
    }
    if (path === "/api/search" && url.host === "grafana") {
      const slos = w.sloFolder.map((uid) => ({ uid, folderTitle: "SLOs" }));
      return json([
        ...slos,
        ...(w.overview ? [{ uid: "service-overview", folderTitle: "Service" }] : []),
      ]);
    }
    if (path.startsWith("/api/dashboards/uid/")) {
      const stat = (title: string, expr: string) => ({
        type: "stat",
        title,
        targets: [{ expr, instant: true }],
      });
      return json({
        dashboard: {
          panels: [
            { type: "row", title: "row" },
            stat("Target", "vector(0.99)"),
            stat("SLI (28d)", "sli"),
            { type: "timeseries", title: "graph", targets: [{ expr: "sli" }] },
          ],
        },
      });
    }
    if (path === "/api/ds/query") {
      const sent = w.otlpBodies.length === 2 ? w.valuesAfterSamples : w.dataBeforeSamples;
      const frame = { data: { values: [[1], [sent ? 0.5 : null]] } };
      return json({
        results: { A: { frames: [frame], ...(w.queryError ? { error: w.queryError } : {}) } },
      });
    }
    if (path === "/api/search" && url.host === "tempo") {
      const i = (url.searchParams.get("q") ?? "").includes('"j1"') ? 1 : 0;
      return json({ traces: w.jobFound ? [{ traceID: JOB_TRACE[i]?.replace(/^0+/, "") }] : [] });
    }
    if (path.startsWith("/api/traces/")) {
      const id = path.slice("/api/traces/".length);
      const i = JOB_TRACE.indexOf(id);
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
      return json({
        trace: {
          resourceSpans: [
            { scopeSpans: [{ spans: w.discogsSpan ? [run, { name: DISCOGS }] : [run] }] },
          ],
        },
      });
    }
    if (url.host === "loki") {
      return json({
        data: { result: [{ values: Array.from({ length: w.logLines }, () => ["1", "{}"]) }] },
      });
    }
    return json({ data: { result: [{ value: [1, w.metricValue] }] } });
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
  const run = async () => ({ ok: await runObsCheck(urls, deps, SLO_IDS, INSTRUMENTS), lines });
  return { w, run };
}

describe("obs-check (001/FR-033)", () => {
  it("001/FR-033: passes every step when traces, logs, metrics and dashboards arrive", async () => {
    const { w, run } = world();
    const { ok, lines } = await run();
    expect(lines.every((l) => l.startsWith("PASS"))).toBe(true);
    expect(lines).toHaveLength(6);
    expect(ok).toBe(true);
    expect(w.otlpBodies).toHaveLength(2);
    expect(w.calls).toContain("POST api/api/sample/trace");
  });

  it.each<[string, (w: ReturnType<typeof world>["w"]) => void, string]>([
    ["a missing SLO dashboard", (w) => w.sloFolder.pop(), 'folder "SLOs" holds'],
    ["an extra SLO dashboard", (w) => w.sloFolder.push("slo-extra"), "expected exactly"],
    ["no overview dashboard", (w) => (w.overview = false), "overview dashboard"],
    ["data before samples", (w) => (w.dataBeforeSamples = true), "shows data before any samples"],
    ["sample flows off", (w) => (w.sampleStatus = 404), "sample flows are off"],
    ["no Common Ground key", (w) => (w.sampleStatus = 502), "COMMON_GROUND_DEV_API_KEY"],
    ["a sample answer without ids", (w) => (w.sampleBody = () => ({})), "HTTP 202 without"],
    ["a sample request error", (w) => (w.sampleStatus = 500), "HTTP 500 without"],
    ["an unreachable Tempo", (w) => (w.tempoDown = true), "(connection refused)"],
    [
      "a missing request span",
      (w) => (w.requestSpans = REQUEST_SPANS.slice(1)),
      "missing spans: POST /sample/trace",
    ],
    ["no request trace", (w) => (w.traceStatus = 404), "answered HTTP 404"],
    [
      "a job trace without its Discogs span",
      (w) => (w.discogsSpan = false),
      `missing spans: ${DISCOGS}`,
    ],
    ["no job trace", (w) => (w.jobFound = false), "no trace with that riviera.job.id"],
    [
      "no link to the request",
      (w) => (w.jobLinks = false),
      `no link to request trace ${REQ[0] ?? ""}`,
    ],
    ["an ok job marked as error", (w) => (w.jobErrors = [true, true]), "error status is true"],
    [
      "a failed job not marked as error",
      (w) => (w.jobErrors = [false, false]),
      "error status is false",
    ],
    ["no log lines", (w) => (w.logLines = 0), "no line matches"],
    ["a metric still at 0", (w) => (w.metricValue = "0"), "no value above 0 yet"],
    [
      "SLO panels without values",
      (w) => (w.valuesAfterSamples = false),
      'panel "SLI (28d)": not there',
    ],
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

describe("SLO samples over OTLP/JSON (001/FR-033, research R14 step 4)", () => {
  const metricsOf = (body: OtlpMetricsRequest): OtlpMetric[] =>
    body.resourceMetrics.flatMap((r) => r.scopeMetrics.flatMap((s) => s.metrics));
  const points = (m: OtlpMetric | undefined) =>
    (m?.sum ?? m?.gauge ?? m?.histogram)?.dataPoints ?? [];
  const start = 1_800_000_000_000;
  const first = sampleRequest(INSTRUMENTS, 0, start, start + 1000);
  const second = sampleRequest(INSTRUMENTS, 1, start, start + 1000 + EXPORT_INTERVAL_MS);
  const byName = (body: OtlpMetricsRequest, name: string) =>
    metricsOf(body).find((m) => m.name === name);

  it("001/FR-033: covers every SLO metric of the registry under service riviera-slo-sample", () => {
    const sloMetrics = INSTRUMENTS.filter((d) => "slo" in d).map((d) => d.name);
    expect(metricsOf(first).map((m) => m.name)).toEqual(sloMetrics);
    expect(first.resourceMetrics[0]?.resource.attributes).toEqual([
      { key: "service.name", value: { stringValue: "riviera-slo-sample" } },
    ]);
  });

  it("001/FR-033: counters go 0 → 1 for every label combination, with one start time", () => {
    const [a, b] = [first, second].map((body) => points(byName(body, "riviera.audio.resolutions")));
    expect(a?.map((p) => p.asDouble)).toEqual([0, 0, 0, 0]);
    expect(b?.map((p) => p.asDouble)).toEqual([1, 1, 1, 1]);
    expect(a?.[0]?.startTimeUnixNano).toBe(b?.[0]?.startTimeUnixNano);
    const gap = Number(b?.[0]?.timeUnixNano) - Number(a?.[0]?.timeUnixNano);
    expect(gap).toBeGreaterThanOrEqual(EXPORT_INTERVAL_MS * 1e6);
    expect(EXPORT_INTERVAL_MS).toBe(METRIC_EXPORT_INTERVAL_MS);
  });

  it("001/FR-033: histograms get one then two observations; gauges a Unix time", () => {
    const [h1, h2] = [first, second].map((b) => points(byName(b, "riviera.verdict.duration"))[0]);
    expect([h1?.count, h2?.count]).toEqual(["1", "2"]);
    expect(h2?.bucketCounts).toEqual(["2", "0", "0", "0", "0", "0", "0", "0", "0", "0"]);
    const gauge = points(byName(first, "riviera.sync.last_success"))[0];
    expect(gauge?.asDouble).toBe(Math.floor((start + 1000) / 1000));
  });

  it("001/FR-033: a route label gets the unmatched value; a histogram may lack buckets", () => {
    const def = {
      name: "riviera.x",
      kind: "counter",
      unit: "1",
      labels: { route: "route" },
      slo: "x",
    } as const;
    const histogram = {
      name: "riviera.y",
      kind: "histogram",
      unit: "s",
      labels: {},
      slo: "x",
    } as const;
    const [counter, noBuckets] = metricsOf(sampleRequest([def, histogram], 0, 0, 0));
    expect(points(counter)[0]?.attributes).toEqual([
      { key: "route", value: { stringValue: "unmatched" } },
    ]);
    expect(points(noBuckets)[0]?.bucketCounts).toEqual(["1"]);
  });
});
