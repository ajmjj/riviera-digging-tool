import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { memoryExporters } from "@riviera/telemetry/testing";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Secret } from "../../src/config.ts";
import { startService, type Service, type ServiceConfig } from "../../src/startup.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

// POST /sample/trace → the worker's sample job, end to end on the real startup path: real
// Postgres, a fake of the mocks' fetch (no network) and in-memory exporters for each role (a
// stopped service shuts its metric exporter down). The api and the worker run one after the
// other, since each installs the global OTel providers.

const RELEASE_ID = 1_234_567;
const ON = {
  enabled: true,
  commonGroundUrl: new URL("http://mocks:4000"),
  discogsUrl: new URL("http://mocks:4000"),
  commonGroundDevApiKey: new Secret(["cg", "dev", "key"].join("-")),
} as const;
const RELEASE = { id: RELEASE_ID, title: "Sample release (mock)", year: 1997 };
const SHOP = { data: { config: { shopName: "Riviera Records (mock)" } } };

const accepted = z.object({ traceId: z.string(), jobId: z.uuid() });
const logLine = z.record(z.string(), z.unknown());

let db: FreshDatabase;
let apiMemory: ReturnType<typeof memoryExporters>;
let memory: ReturnType<typeof memoryExporters>;
let service: Service | undefined;
let stdout: string[];
let sent: string[];

beforeEach(async () => {
  db = await freshDatabase();
  apiMemory = memoryExporters();
  memory = memoryExporters();
  stdout = [];
  sent = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => stdout.push(String(chunk)) > 0);
});

afterEach(async () => {
  await service?.stop();
  service = undefined;
  vi.restoreAllMocks();
  await db.drop();
});

/** Like the mocks: the Common Ground GraphQL endpoint and Discogs `GET /releases/:id`. */
const mocks: typeof fetch = (input, init) => {
  const request = new Request(input, init);
  sent.push(`${request.method} ${new URL(request.url).pathname}`);
  return Promise.resolve(Response.json(request.url.endsWith("/graphql") ? SHOP : RELEASE));
};

async function start(role: ServiceConfig["role"]): Promise<Service> {
  const config: ServiceConfig = {
    role,
    port: 0,
    databaseUrl: db.url,
    appUrl: new URL("http://localhost"),
    logLevel: "info",
    telemetry: { environment: "ci" },
    sampleFlows: ON,
  };
  service = await startService(config, new EventEmitter(), {
    exporters: [(role === "api" ? apiMemory : memory).exporters],
    fetch: mocks,
    idleMs: 20,
  });
  return service;
}

/** Sends the sample request on the api, then runs the worker until the job has finished. */
async function requestThenJob(failJob: boolean) {
  const api = await start("api");
  const res = await api.app.inject({
    method: "POST",
    url: "/sample/trace",
    payload: { releaseId: RELEASE_ID, failJob },
  });
  expect(res.statusCode).toBe(202);
  const body = accepted.parse(res.json());
  await api.stop();

  await start("worker");
  await vi.waitFor(async () => {
    const row = await db.query("SELECT status FROM job WHERE id = $1", [body.jobId]);
    expect(row.rows[0]).toEqual({ status: failJob ? "failed" : "succeeded" });
  });
  await service?.stop();

  const lines = stdout
    .map((line) => logLine.parse(JSON.parse(line)))
    .filter((line) => line["job_id"] === body.jobId);
  const spans = [...apiMemory.spans(), ...memory.spans()];
  const run = spans.find((s) => s.name === "job.run sample.discogs_release");
  return { ...body, lines, run, spans };
}

/** Non-zero counter values or histogram counts of `metric`, keyed by the `keys` labels. */
function points(metric: string, keys: readonly string[]): Record<string, number> {
  const found = memory.metrics().find((m) => m.descriptor.name === metric);
  const result: Record<string, number> = {};
  for (const { attributes, value } of found?.dataPoints ?? []) {
    const n = typeof value === "number" ? value : "count" in value ? value.count : NaN;
    if (n > 0) result[keys.map((key) => String(attributes[key])).join(" ")] = n;
  }
  return result;
}

describe("001/FR-028 001/FR-031: the worker runs the sample job", () => {
  it("001/FR-028 001/FR-031: span tree, producer link, log lines and job metrics", async () => {
    const { traceId, jobId, lines, run, spans } = await requestThenJob(false);
    expect(sent).toEqual(["POST /graphql", `GET /releases/${String(RELEASE_ID)}`]);

    // job.run is its own root, linked to the request's producer span (job.enqueue).
    const producer = spans.find((s) => s.kind === SpanKind.PRODUCER);
    expect(producer?.spanContext().traceId).toBe(traceId);
    expect(run?.kind).toBe(SpanKind.CONSUMER);
    expect(run?.parentSpanContext).toBeUndefined();
    expect(run?.links.map((l) => l.context.spanId)).toEqual([producer?.spanContext().spanId]);
    expect(run?.attributes).toMatchObject({
      "riviera.job.id": jobId,
      "riviera.job.outcome": "succeeded",
    });
    const jobTrace = run?.spanContext().traceId;
    const children = spans.filter((s) => s.parentSpanContext?.spanId === run?.spanContext().spanId);
    expect(children.map((s) => [s.name, s.kind])).toEqual([
      ["discogs GET /releases/{id}", SpanKind.CLIENT],
    ]);

    // The handler's line and the runner's outcome line, both with the job's identity and trace.
    const identity = { job_name: "sample.discogs_release", trace_id: jobTrace };
    expect(lines.map((l) => l["msg"])).toEqual(["sample job fetched release", "job succeeded"]);
    for (const line of lines) expect(line).toMatchObject(identity);

    const job = ["job_name", "outcome"];
    expect(points("riviera.jobs.runs", job)).toEqual({ "sample.discogs_release succeeded": 1 });
    expect(points("riviera.jobs.duration", job)).toEqual({
      "sample.discogs_release succeeded": 1,
    });
    expect(points("riviera.jobs.failures", ["job_name"])).toEqual({});
    const external = { "discogs GET /releases/{id} success": 1 };
    expect(points("riviera.external.calls", ["service", "operation", "outcome"])).toEqual(external);
    // The worker reports the depth gauge too, back to 0 once the job has run.
    const depth = memory.metrics().find((m) => m.descriptor.name === "riviera.queue.depth");
    expect(depth?.dataPoints.map((p) => p.value)).toEqual([0]);
  });

  it("001/FR-028 001/FR-031: fail mode: error span, one error line, failures +1", async () => {
    const { jobId, lines, run } = await requestThenJob(true);
    // The Discogs call still happens; the failure comes after it, on purpose.
    expect(sent).toEqual(["POST /graphql", `GET /releases/${String(RELEASE_ID)}`]);
    expect(run?.status.code).toBe(SpanStatusCode.ERROR);
    expect(run?.attributes["riviera.job.outcome"]).toBe("failed");
    const errors = lines.filter((l) => l["level"] === "error");
    expect(errors).toEqual([
      expect.objectContaining({ job_id: jobId, msg: "job attempt failed", next: "failed" }),
    ]);
    expect(points("riviera.jobs.failures", ["job_name"])).toEqual({ "sample.discogs_release": 1 });
    expect(points("riviera.jobs.runs", ["outcome"])).toEqual({ failed: 1 });
  });
});
