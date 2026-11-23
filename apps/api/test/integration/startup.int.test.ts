import { EventEmitter } from "node:events";
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
