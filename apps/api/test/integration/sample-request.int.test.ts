import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { memoryExporters } from "@riviera/telemetry/testing";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Secret } from "../../src/config.ts";
import { startService, type Service, type ServiceConfig } from "../../src/startup.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

// POST /sample/trace end to end (contracts/http.md) on the real startup path: real Postgres, a
// fake of the Common Ground mock's fetch (no network) and in-memory exporters.

const ROUTE = "/sample/trace";
const KEY = ["cg", "dev", "key", "93ab"].join("-"); // built at runtime: no secret-shaped literal
const SHOP = { data: { config: { shopName: "Riviera Records (mock)" } } };
const RELEASE_ID = 1_234_567; // not the Discogs mock's fixed 249504
const ON = {
  enabled: true,
  commonGroundUrl: new URL("http://mocks:4000"),
  discogsUrl: new URL("http://mocks:4000"),
  commonGroundDevApiKey: new Secret(KEY),
} as const;

const accepted = z.strictObject({
  requestId: z.string(),
  traceId: z.string().regex(/^[0-9a-f]{32}$/),
  jobId: z.uuid(),
  shopName: z.string(),
  queued: z.number(),
});
const logLine = z.record(z.string(), z.unknown());

let db: FreshDatabase;
let memory: ReturnType<typeof memoryExporters>;
let service: Service | undefined;
let stdout: string[];
let sent: Request[];

beforeEach(async () => {
  db = await freshDatabase();
  memory = memoryExporters();
  stdout = [];
  sent = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => stdout.push(String(chunk)) > 0);
});

afterEach(async () => {
  await service?.stop();
  vi.restoreAllMocks();
  await db.drop();
});

/** Like the Common Ground mock: 401 without Authorization, else `status` with the shop. */
const mock =
  (status: number): typeof fetch =>
  (input, init) => {
    const request = new Request(input, init);
    sent.push(request);
    const auth = request.headers.get("authorization") !== null;
    return Promise.resolve(Response.json(SHOP, { status: auth ? status : 401 }));
  };

async function start(
  sampleFlows: ServiceConfig["sampleFlows"],
  status = 200,
  role: ServiceConfig["role"] = "api",
) {
  const config: ServiceConfig = {
    role,
    port: 0,
    databaseUrl: db.url,
    appUrl: new URL("http://localhost"),
    logLevel: "info",
    telemetry: { environment: "ci" },
    sampleFlows,
  };
  service = await startService(config, new EventEmitter(), {
    exporters: [memory.exporters],
    fetch: mock(status),
  });
  return service.app;
}

const jobs = async () => (await db.query("SELECT payload, max_attempts FROM job")).rows;

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

describe("001/FR-030: POST /sample/trace", () => {
  it("001/FR-030: span tree, log line, metrics and enqueued job of one sample request", async () => {
    const app = await start(ON);
    const res = await app.inject({
      method: "POST",
      url: ROUTE,
      payload: { releaseId: RELEASE_ID },
      headers: { "x-request-id": "req_sample_1" },
    });
    expect(res.statusCode).toBe(202);
    const body = accepted.parse(res.json());
    expect(body).toMatchObject({ requestId: "req_sample_1", shopName: SHOP.data.config.shopName });
    expect(body.queued).toBe(0);
    const payload = { releaseId: RELEASE_ID, fail: false };
    expect(await jobs()).toEqual([{ payload, max_attempts: 3 }]);
    expect(sent.map((r) => [r.url, r.headers.get("authorization")])).toEqual([
      ["http://mocks:4000/graphql", `Bearer ${KEY}`],
    ]);
    await service?.stop();

    // Span tree: server → db SELECT, common_ground SampleShopConfig, job.enqueue.
    const spans = memory.spans().filter((s) => s.spanContext().traceId === body.traceId);
    const server = spans.find((s) => s.kind === SpanKind.SERVER);
    expect(server?.name).toBe(`POST ${ROUTE}`);
    const children = spans.filter(
      (s) => s.parentSpanContext?.spanId === server?.spanContext().spanId,
    );
    expect(children.map((s) => s.name)).toEqual([
      "db SELECT",
      "common_ground SampleShopConfig",
      "job.enqueue sample.discogs_release",
    ]);
    expect(spans).toHaveLength(4);

    // One "request completed" line with the request ID and trace ID; the key appears nowhere.
    const completed = stdout
      .map((line) => logLine.parse(JSON.parse(line)))
      .filter((l) => l["msg"] === "request completed" && l["request_id"] === body.requestId);
    expect(completed).toEqual([expect.objectContaining({ trace_id: body.traceId })]);
    const exported = JSON.stringify([memory.spans().map((s) => s.attributes), memory.logs()]);
    expect(stdout.join("") + exported).not.toContain(KEY);

    const http = ["route", "method", "status_class"];
    expect(points("riviera.http.server.duration", http)).toEqual({ [`${ROUTE} POST 2xx`]: 1 });
    const external = ["service", "operation", "outcome"];
    const success = { "common_ground SampleShopConfig success": 1 };
    expect(points("riviera.external.calls", external)).toEqual(success);
    expect(points("riviera.external.duration", external)).toEqual(success);
  });

  it("001/FR-030: failJob enqueues fail mode with one attempt; an invalid body is a 400", async () => {
    const app = await start(ON);
    for (const payload of [{ releaseId: -1 }, { failJob: "yes" }, { extra: true }]) {
      expect((await app.inject({ method: "POST", url: ROUTE, payload })).statusCode).toBe(400);
    }
    expect(sent).toEqual([]);
    const res = await app.inject({ method: "POST", url: ROUTE, payload: { failJob: true } });
    expect(res.statusCode).toBe(202);
    expect(await jobs()).toEqual([{ payload: { releaseId: 249504, fail: true }, max_attempts: 1 }]);
  });

  const noKey = { ...ON, commonGroundDevApiKey: undefined };
  const failures = [
    { label: "HTTP 500", flows: ON, status: 500, outcome: "failed" },
    { label: "HTTP 429", flows: ON, status: 429, outcome: "rate_limited" },
    { label: "401 (no dev key)", flows: noKey, status: 200, outcome: "failed" },
  ];
  for (const { label, flows, status, outcome } of failures) {
    it(`001/FR-030: Common Ground ${label} answers 502 and enqueues nothing`, async () => {
      const res = await (await start(flows, status)).inject({ method: "POST", url: ROUTE });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ error: "common_ground_unavailable" });
      expect(await jobs()).toEqual([]);
      await service?.stop();
      const names = memory.spans().map((s) => s.name);
      expect(names).not.toContain("job.enqueue sample.discogs_release");
      const client = memory.spans().find((s) => s.name === "common_ground SampleShopConfig");
      expect(client?.status.code).toBe(SpanStatusCode.ERROR);
      expect(points("riviera.external.calls", ["outcome"])).toEqual({ [outcome]: 1 });
      expect(points("riviera.http.server.duration", ["status_class"])).toEqual({ "5xx": 1 });
    });
  }
});

describe("001/FR-027: the sample route exists only with sample flows on", () => {
  it("001/FR-027: flag off, flag absent, or the worker role: 404 like any unknown path", async () => {
    const cases = [
      [{ enabled: false }, "api"],
      [undefined, "api"],
      [ON, "worker"],
    ] as const;
    for (const [flows, role] of cases) {
      const app = await start(flows, 200, role);
      expect((await app.inject({ method: "POST", url: ROUTE })).statusCode).toBe(404);
      await service?.stop();
    }
    expect(sent).toEqual([]);
  });
});
