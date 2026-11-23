import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../../src/config.ts";
import { startService, type Service } from "../../src/startup.ts";
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

function config(role: Config["role"]): Config {
  return {
    role,
    port: 0,
    databaseUrl: db.url,
    appUrl: new URL("http://localhost"),
    logLevel: "silent",
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
      await started.stop();
      expect(started.app.server.listening).toBe(false);
    }
  });
});
