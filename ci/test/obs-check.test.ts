import { describe, expect, it } from "vitest";
import { POLL_TIMEOUT_MS, runObsCheck, type ObsUrls } from "../lib/obs-check.ts";

const urls: ObsUrls = {
  api: "http://api",
  tempo: "http://tempo",
  loki: "http://loki",
  prometheus: "http://prom",
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
  metricValue: string;
  requestIds: string[];
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
    metricValue: "1",
    requestIds: [],
  };
  const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    const path = url.pathname;
    if (url.host === "api") {
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
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
  const run = async () => ({ ok: await runObsCheck(urls, deps), lines });
  return { w, run };
}

describe("obs-check (001/FR-033)", () => {
  it("001/FR-033: passes every step when traces, logs and metrics arrive", async () => {
    const { w, run } = world();
    const { ok, lines } = await run();
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.startsWith("PASS"))).toBe(true);
    expect(ok).toBe(true);
    expect(w.requestIds).toHaveLength(2);
    expect(w.requestIds[0]).not.toBe(w.requestIds[1]);
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
    ["a metric still at 0", (w) => (w.metricValue = "0"), "no value above 0 yet"],
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
