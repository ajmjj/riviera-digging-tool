import { createDropWarning, type DropWarning } from "@riviera/telemetry/export-guard";
import { SHUTDOWN_TIMEOUT_MS, STARTUP_FLUSH_TIMEOUT_MS } from "@riviera/telemetry/sdk";
import { EventEmitter } from "node:events";
import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Secret } from "../../src/config.ts";
import { startService, type Service, type ServiceConfig } from "../../src/startup.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

// Telemetry resilience (tasks.md T022, research R5): the real startup path with the real OTLP
// exporters, pointed at a collector that is down (a closed 127.0.0.1 port) or one that accepts
// connections and never answers. Requests and jobs must not notice (001/FR-020). Real Postgres;
// the mocks are a fake fetch, so nothing leaves the machine.

const ON = {
  enabled: true,
  commonGroundUrl: new URL("http://mocks:4000"),
  discogsUrl: new URL("http://mocks:4000"),
  commonGroundDevApiKey: new Secret(["cg", "dev", "key"].join("-")),
} as const;
const mocks: typeof fetch = (input, init) => {
  const { url } = new Request(input, init);
  const body = url.endsWith("/graphql")
    ? { data: { config: { shopName: "Riviera Records (mock)" } } }
    : { id: 1, title: "Sample release (mock)", year: 1997 };
  return Promise.resolve(Response.json(body));
};
const accepted = z.object({ jobId: z.uuid() });
const REQUESTS = 200;
const WAIT = { timeout: 15_000 };
// Startup waits for the zero-counter flush (research R18) at most STARTUP_FLUSH_TIMEOUT_MS, so a
// collector that is down or silent can't hold `listen` (001/FR-020); migrations take the rest.
const STARTUP_BOUND_MS = STARTUP_FLUSH_TIMEOUT_MS + 2000;

let db: FreshDatabase;
let services: Service[];
let closers: (() => Promise<void>)[];
let stdout: string[];

beforeEach(async () => {
  db = await freshDatabase();
  services = [];
  closers = [];
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => stdout.push(String(chunk)) > 0);
});

afterEach(async () => {
  for (const service of services) await service.stop();
  for (const close of closers) await close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await db.drop();
});

async function listening(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("no TCP address");
  return address.port;
}

/** A port nothing listens on: bound once to get a free one, then closed again. */
async function closedPort(): Promise<number> {
  const server = createServer();
  const port = await listening(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** A collector that reads each export request and never answers it. */
async function silentCollector() {
  const received: string[] = [];
  const sockets = new Set<Socket>();
  const server = createHttpServer((req: IncomingMessage) => {
    received.push(req.url ?? "");
    req.resume();
  });
  server.on("connection", (socket) => sockets.add(socket));
  const port = await listening(server);
  closers.push(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  return { endpoint: new URL(`http://127.0.0.1:${String(port)}`), received };
}

/** Starts a service and records how long `startService` took. */
async function start(
  role: ServiceConfig["role"],
  endpoint: URL | undefined,
  dropWarning?: DropWarning,
): Promise<Service & { readonly startMs: number }> {
  const config: ServiceConfig = {
    role,
    port: 0,
    databaseUrl: db.url,
    appUrl: new URL("http://localhost"),
    logLevel: "info",
    telemetry: { environment: "ci", endpoint },
    sampleFlows: ON,
  };
  const started = performance.now();
  const service = await startService(config, new EventEmitter(), {
    fetch: mocks,
    idleMs: 5,
    ...(dropWarning === undefined ? {} : { dropWarning }),
  });
  const startMs = performance.now() - started;
  services.push(service);
  return { ...service, startMs };
}

/** Stops a service the test itself stops, so `afterEach` doesn't stop it a second time. */
async function stopNow(service: Service): Promise<void> {
  services = services.filter((s) => s.app !== service.app);
  await service.stop();
}

/** Sends one sample request; returns its status, the job ID and how long it took. */
async function sample(api: Service) {
  const started = performance.now();
  const res = await api.app.inject({ method: "POST", url: "/sample/trace", payload: {} });
  const ms = performance.now() - started;
  return { status: res.statusCode, jobId: accepted.parse(res.json()).jobId, ms };
}

/** The real limiter with a fake clock; `attempts` counts every dropped export it was told of. */
function clockedWarning() {
  const clock = { now: Date.parse("2026-11-24T12:00:00Z"), attempts: 0 };
  const lines: string[] = [];
  const limiter = createDropWarning({
    service: "riviera-api",
    env: "ci",
    now: () => clock.now,
    write: (line) => lines.push(line),
  });
  const counting: DropWarning = {
    warn: (signal) => {
      clock.attempts += 1;
      limiter.warn(signal);
    },
  };
  return { clock, lines, limiter: counting };
}

describe("001/FR-020: telemetry export never blocks or fails requests and jobs", () => {
  it("001/FR-020: with the collector down, startup is bounded and 200 sample requests and their jobs all succeed", async () => {
    const endpoint = new URL(`http://127.0.0.1:${String(await closedPort())}`);
    const { clock, lines, limiter } = clockedWarning();

    const api = await start("api", endpoint, limiter);
    expect(api.startMs).toBeLessThan(STARTUP_BOUND_MS);
    const results = [];
    for (let i = 0; i < REQUESTS; i += 1) results.push(await sample(api));
    expect(results.map((r) => r.status)).toEqual(Array<number>(REQUESTS).fill(202));
    const worker = await start("worker", endpoint, limiter);
    expect(worker.startMs).toBeLessThan(STARTUP_BOUND_MS);
    await vi.waitFor(async () => {
      const { rows } = await db.query("SELECT status, count(*)::int AS n FROM job GROUP BY 1");
      expect(rows).toEqual([{ status: "succeeded", n: REQUESTS }]);
    }, WAIT);

    // Many exports were dropped while the clock stood still, yet one warning was written.
    await vi.waitFor(() => {
      expect(clock.attempts).toBeGreaterThan(1);
    }, WAIT);
    expect(lines).toHaveLength(1);
    // A minute later the next dropped export warns again, once.
    clock.now += 60_000;
    const seen = clock.attempts;
    await sample(api);
    await vi.waitFor(() => {
      expect(clock.attempts).toBeGreaterThan(seen);
    }, WAIT);
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => z.object({ level: z.string() }).parse(JSON.parse(line)))).toEqual([
      { level: "warn" },
      { level: "warn" },
    ]);
  });

  it("001/FR-020: a collector that never answers holds neither startup, requests nor shutdown", async () => {
    const collector = await silentCollector();
    const { limiter } = clockedWarning();
    const api = await start("api", collector.endpoint, limiter);
    expect(api.startMs).toBeLessThan(STARTUP_BOUND_MS);
    await sample(api);
    // An export is now in flight and will never be answered.
    await vi.waitFor(() => {
      expect(collector.received).toContain("/v1/traces");
    }, WAIT);

    const results = [];
    for (let i = 0; i < 50; i += 1) results.push(await sample(api));
    expect(results.every((r) => r.status === 202)).toBe(true);
    // Each request is served long before any export could time out.
    expect(Math.max(...results.map((r) => r.ms))).toBeLessThan(SHUTDOWN_TIMEOUT_MS / 2);

    // Shutdown waits for the hanging exports only until its timeout, and never rejects.
    const started = performance.now();
    await expect(stopNow(api)).resolves.toBeUndefined();
    const elapsed = performance.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(SHUTDOWN_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(SHUTDOWN_TIMEOUT_MS + 1000);
  });
});

describe("001/FR-019: without an endpoint", () => {
  it("001/FR-019: JSON log lines still go to stdout and nothing is exported", async () => {
    const collector = await silentCollector();
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", collector.endpoint.href);
    const { clock, limiter } = clockedWarning();
    const api = await start("api", undefined, limiter);
    expect((await sample(api)).status).toBe(202);
    await stopNow(api);

    const line = z.object({ time: z.string(), level: z.string(), msg: z.string() });
    const lines = stdout.map((text) => line.parse(JSON.parse(text)));
    expect(lines.map((l) => l.msg)).toEqual(
      expect.arrayContaining(["started", "request completed"]),
    );
    expect(collector.received).toEqual([]);
    expect(clock.attempts).toBe(0);
  });
});
