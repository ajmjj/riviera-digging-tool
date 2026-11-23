import { createInstruments } from "@riviera/telemetry/instruments";
import { startTelemetry, type Exporters } from "@riviera/telemetry/sdk";
import type { FastifyInstance } from "fastify";
import pkg from "../package.json" with { type: "json" };
import { buildApp } from "./app.ts";
import type { Config, SampleFlows } from "./config.ts";
import { createPool, databaseFromPool } from "./db.ts";
import { createExternalClient } from "./external/client.ts";
import { createCommonGround } from "./external/common-ground.ts";
import { createQueue } from "./jobs/queue.ts";
import { registerQueueDepth } from "./jobs/runner.ts";
import { loadMigrations, migrateUp, MIGRATIONS_DIR } from "./migrate.ts";

export interface SignalSource {
  once(event: "SIGTERM" | "SIGINT", listener: () => void): unknown;
}

/** The loaded config. No `endpoint` turns export off (001/FR-019); no `sampleFlows`, the route. */
export type ServiceConfig = Config & {
  readonly telemetry: { readonly environment: string; readonly endpoint?: URL | undefined };
  readonly sampleFlows?: SampleFlows | undefined;
};

export interface StartOptions {
  readonly migrationsDir?: URL;
  /** Exporters besides OTLP, e.g. in-memory ones in tests. */
  readonly exporters?: readonly Exporters[];
  /** The outbound client's fetch; tests pass a fake of the mocks. */
  readonly fetch?: typeof fetch;
}

export interface Service {
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

/**
 * Starts the api or the worker, in this order (research R18): migrations (both roles run them;
 * the advisory lock makes that safe), then every counter at 0 and a flush, so the zeros are
 * exported before anything is served (001/FR-014), then `listen`. SIGTERM and SIGINT stop it.
 * The api also gets the queue depth gauge and, with sample flows on, the sample route
 * (001/FR-027); the worker's runner joins in T018.
 */
export async function startService(
  config: ServiceConfig,
  signals: SignalSource,
  options: StartOptions = {},
): Promise<Service> {
  const migrations = await loadMigrations(options.migrationsDir ?? MIGRATIONS_DIR);
  const applied = await migrateUp(config.databaseUrl, migrations);
  const service = config.role === "api" ? "riviera-api" : "riviera-worker";
  const { environment } = config.telemetry;
  const telemetry = startTelemetry({
    service,
    version: pkg.version,
    environment,
    endpoint: config.telemetry.endpoint?.href,
    exporters: options.exporters ?? [],
  });
  const meter = telemetry.meterProvider.getMeter("@riviera/api");
  // No routes: only the telemetry plugin records the route-labelled histogram.
  const instruments = createInstruments(meter, { routes: [] });
  const pool = createPool(config.databaseUrl);
  const db = databaseFromPool(pool);
  const queue = createQueue({ db: pool, instruments });

  const api = config.role === "api";
  if (api) registerQueueDepth(instruments, queue);
  const flows = api && config.sampleFlows?.enabled === true ? config.sampleFlows : undefined;
  const client = createExternalClient({
    instruments,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  const app = buildApp({
    logger: { service, env: environment, level: config.logLevel },
    pingDatabase: () => db.ping(),
    telemetry: { tracer: telemetry.tracerProvider.getTracer("@riviera/api"), meter },
    ...(flows === undefined
      ? {}
      : {
          sample: {
            db,
            queue,
            commonGround: createCommonGround({
              client,
              url: flows.commonGroundUrl,
              apiKey: flows.commonGroundDevApiKey,
            }),
          },
        }),
  });

  let stopping: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    // Telemetry and the pool close even if closing the server fails; telemetry first, so its
    // last export can still read the queue depth.
    stopping ??= app.close().finally(async () => {
      await telemetry.shutdown();
      await db.close();
    });
    return stopping;
  };
  signals.once("SIGTERM", () => void stop());
  signals.once("SIGINT", () => void stop());

  try {
    instruments.zeroInitialise();
    await telemetry.forceFlush();
    await app.listen({ host: "0.0.0.0", port: config.port });
  } catch (error) {
    await stop();
    throw error;
  }
  app.log.info({ role: config.role, migrationsApplied: applied }, "started");
  return { app, stop };
}
