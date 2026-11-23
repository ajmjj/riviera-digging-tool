import { INSTRUMENTS, type InstrumentDef } from "@riviera/telemetry/slo-metrics";
import { memoryExporters } from "@riviera/telemetry/testing";
import { EventEmitter, once } from "node:events";
import { createServer } from "node:http";
import { connect } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startService, type Service, type ServiceConfig } from "../../src/startup.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

let db: FreshDatabase;
let service: Service | undefined;

beforeEach(async () => {
  db = await freshDatabase();
});

afterEach(async () => {
  await service?.stop();
  service = undefined;
  vi.unstubAllEnvs();
  await db.drop();
});

function config(role: ServiceConfig["role"]): ServiceConfig {
  return {
    role,
    port: 0,
    databaseUrl: db.url,
    appUrl: new URL("http://localhost"),
    logLevel: "silent",
    telemetry: { environment: "ci" },
  };
}

describe("001/FR-029: startup (real Postgres)", () => {
  it("001/FR-029: api and worker both run migrations before they listen", async () => {
    service = await startService(config("api"), new EventEmitter());
    const jobTable = await db.query("SELECT to_regclass('public.job') AS t");
    expect(jobTable.rows[0]).toEqual({ t: "job" });
    const ready = await service.app.inject("/readyz");
    expect(ready.statusCode).toBe(200);

    const worker = await startService(config("worker"), new EventEmitter());
    await worker.stop();
    const applied = await db.query("SELECT count(*)::int AS n FROM schema_migration");
    expect(applied.rows[0]).toEqual({ n: 1 });
  });

  it("001/FR-029: SIGTERM or SIGINT stops the service once", async () => {
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      const signals = new EventEmitter();
      const started = await startService(config("api"), signals);
      signals.emit(signal);
      // No explicit stop() first: the signal alone must close the server.
      await vi.waitFor(() => {
        expect(started.app.server.listening).toBe(false);
      });
      // Once: the listeners are gone and a later stop() returns the same shutdown.
      expect(signals.listenerCount(signal)).toBe(0);
      expect(started.stop()).toBe(started.stop());
      await started.stop();
    }
  });

  it("001/FR-029: the database pool closes even when closing the server fails", async () => {
    const started = await startService(config("api"), new EventEmitter());
    expect((await started.app.inject("/readyz")).statusCode).toBe(200);
    const poolConnections = async (): Promise<unknown> =>
      (
        await db.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND query = 'SELECT 1'",
        )
      ).rows[0];
    expect(await poolConnections()).toEqual({ n: 1 });

    const close = started.app.close.bind(started.app);
    vi.spyOn(started.app, "close").mockRejectedValueOnce(new Error("close failed"));
    await expect(started.stop()).rejects.toThrow("close failed");
    await vi.waitFor(async () => {
      expect(await poolConnections()).toEqual({ n: 0 });
    });
    await close();
  });

  it("001/FR-029: a failed listen (port taken) rejects instead of leaving a half-started service", async () => {
    service = await startService(config("api"), new EventEmitter());
    const address = service.app.server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const taken = { ...config("worker"), port };
    await expect(startService(taken, new EventEmitter())).rejects.toThrow(/EADDRINUSE/);
  });
});

/** Whether something accepts connections on 127.0.0.1:`port`. */
function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}

/**
 * A stand-in OTLP/HTTP collector. Before answering each export it records the path, whether the
 * migrations had run and whether the api was already listening on `apiPort`.
 */
async function collector(apiPort: number) {
  const received: { path: string; migrated: unknown; apiListening: boolean }[] = [];
  const server = createServer((request, response) => {
    request.resume();
    void (async () => {
      const migrated = (await db.query("SELECT count(*)::int AS n FROM schema_migration")).rows[0];
      const apiListening = await listening(apiPort);
      received.push({ path: request.url ?? "", migrated, apiListening });
      response.writeHead(200).end();
    })();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { url: new URL(`http://127.0.0.1:${String(port)}`), received, close };
}

describe("001/FR-014: startup exports every counter as 0 before it listens (research R18)", () => {
  it("001/FR-014 001/FR-019 001/FR-029: migrations, then zero counters exported, then listen", async () => {
    // A port that is free now; the api must not be listening on it until the export is in.
    const probe = createServer().listen(0, "127.0.0.1");
    await once(probe, "listening");
    const address = probe.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    await new Promise((resolve) => probe.close(resolve));

    const sink = await collector(port);
    const memory = memoryExporters();
    const telemetry = { environment: "ci", endpoint: sink.url };
    service = await startService({ ...config("api"), port, telemetry }, new EventEmitter(), {
      exporters: [memory.exporters],
    });
    // The OTLP export reached the collector after the migrations and before listen; the same
    // flush put every counter, at 0 for each label combination, in the in-memory export.
    expect(sink.received.find((r) => r.path === "/v1/metrics")).toEqual({
      path: "/v1/metrics",
      migrated: { n: 1 },
      apiListening: false,
    });
    const exported = new Map(memory.metrics().map((m) => [m.descriptor.name, m.dataPoints]));
    const registry: readonly InstrumentDef[] = INSTRUMENTS;
    for (const def of registry.filter((d) => d.kind === "counter")) {
      // Counters have closed label lists only; "route" belongs to the HTTP histogram.
      const sizes = Object.values(def.labels).map((v) => (v === "route" ? NaN : v.length));
      const zeros = Array.from({ length: sizes.reduce((n, size) => n * size, 1) }, () => 0);
      expect(
        exported.get(def.name)?.map((p) => p.value),
        def.name,
      ).toEqual(zeros);
    }
    expect(await listening(port)).toBe(true);
    await service.stop();
    await sink.close();
  });

  it("001/FR-019: without a configured endpoint nothing is exported, even with the OTLP env var set", async () => {
    const sink = await collector(0);
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", sink.url.href);
    service = await startService(config("api"), new EventEmitter());
    await service.app.inject("/no/such/path");
    await service.stop();
    await sink.close();
    expect(sink.received).toEqual([]);
  });
});
