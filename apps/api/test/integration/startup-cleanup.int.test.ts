import type * as Sdk from "@riviera/telemetry/sdk";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as App from "../../src/app.ts";
import { startService, type ServiceConfig } from "../../src/startup.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

// Startup and shutdown close every resource on its own (001/FR-029, startup; hardening from the
// review of T016 on PR #41): a failing telemetry shutdown still closes the pool, and a failure
// while wiring the service still shuts down the telemetry SDK it had started. The real modules run; these wrappers only inject the faults.

const faults = vi.hoisted(() => ({ shutdown: false, buildApp: false, shutdowns: 0 }));

vi.mock("@riviera/telemetry/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof Sdk>();
  const startTelemetry = (options: Sdk.TelemetryOptions): Sdk.Telemetry => {
    const telemetry = actual.startTelemetry(options);
    const shutdown = async (): Promise<void> => {
      faults.shutdowns += 1;
      await telemetry.shutdown();
      if (faults.shutdown) throw new Error("telemetry shutdown failed");
    };
    return { ...telemetry, shutdown };
  };
  return { ...actual, startTelemetry };
});

vi.mock("../../src/app.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof App>();
  return {
    ...actual,
    buildApp: (options: App.AppOptions) => {
      if (faults.buildApp) throw new Error("buildApp failed");
      return actual.buildApp(options);
    },
  };
});

let db: FreshDatabase;

beforeEach(async () => {
  db = await freshDatabase();
});

afterEach(async () => {
  Object.assign(faults, { shutdown: false, buildApp: false, shutdowns: 0 });
  await db.drop();
});

const config = (): ServiceConfig => ({
  role: "api",
  port: 0,
  databaseUrl: db.url,
  appUrl: new URL("http://localhost"),
  logLevel: "silent",
  telemetry: { environment: "ci" },
});

const poolConnections = async (): Promise<unknown> =>
  (
    await db.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND query = 'SELECT 1'",
    )
  ).rows[0];

describe("001/FR-029: startup and shutdown release every resource", () => {
  it("001/FR-029: the pool closes even when the telemetry shutdown rejects", async () => {
    const started = await startService(config(), new EventEmitter());
    expect((await started.app.inject("/readyz")).statusCode).toBe(200);
    expect(await poolConnections()).toEqual({ n: 1 });

    faults.shutdown = true;
    await expect(started.stop()).rejects.toThrow("telemetry shutdown failed");
    await vi.waitFor(async () => {
      expect(await poolConnections()).toEqual({ n: 0 });
    });
  });

  it("001/FR-029: a failure while wiring the service shuts down the telemetry it started", async () => {
    faults.buildApp = true;
    await expect(startService(config(), new EventEmitter())).rejects.toThrow("buildApp failed");
    expect(faults.shutdowns).toBe(1);
  });
});
