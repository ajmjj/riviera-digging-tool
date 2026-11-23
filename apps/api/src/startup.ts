import { createInstruments } from "@riviera/telemetry/instruments";
import { startTelemetry, type Exporters, type Telemetry } from "@riviera/telemetry/sdk";
import type { FastifyInstance } from "fastify";
import pkg from "../package.json" with { type: "json" };
import { buildApp } from "./app.ts";
import type { Config, SampleFlows } from "./config.ts";
import { createPool, databaseFromPool } from "./db.ts";
import { createExternalClient } from "./external/client.ts";
import { createCommonGround } from "./external/common-ground.ts";
import { createDiscogs } from "./external/discogs.ts";
import { createQueue } from "./jobs/queue.ts";
import { createRunner, registerQueueDepth, type Runner } from "./jobs/runner.ts";
import { loadMigrations, migrateUp, MIGRATIONS_DIR } from "./migrate.ts";
import { sampleDiscogsRelease } from "./sample/job.ts";

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
  /** The worker's idle wait between empty claims; default 500 ms. */
  readonly idleMs?: number;
}

export interface Service {
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

/** Runs every step, in order, even after one fails; rejects with the first failure. */
async function closeEach(steps: readonly (() => Promise<void> | undefined)[]): Promise<void> {
  const failures: unknown[] = [];
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw failures[0];
  }
}

/**
 * Starts the api or the worker, in this order (research R18): migrations (both roles run them;
 * the advisory lock makes that safe), then every counter at 0 and a flush, so the zeros are
 * exported before anything is served (001/FR-014), then `listen`. SIGTERM and SIGINT stop it.
 * Both roles report the queue depth. With sample flows on, the api gets the sample route
 * (001/FR-027); the worker always runs the job runner, whose sample job calls the Discogs mock
 * (001/FR-028). One function serves both roles (tasks.md T016, T018).
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
  const api = config.role === "api";
  const flows = config.sampleFlows?.enabled === true ? config.sampleFlows : undefined;

  // Whatever has been created so far; stop() closes each on its own, so a failure in one step
  // (or in setup) never leaves the others open. The runner and server go first, so no job or
  // request is cut off; then telemetry, whose last export can still read the queue depth; the
  // pool last.
  let telemetry: Telemetry | undefined;
  let db: { close(): Promise<void> } | undefined;
  let app: FastifyInstance | undefined;
  let runner: Runner | undefined;
  let stopping: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    stopping ??= closeEach([
      () => runner?.stop(),
      () => app?.close(),
      () => telemetry?.shutdown(),
      () => db?.close(),
    ]);
    return stopping;
  };
  // A signal during setup can't stop what doesn't exist yet: it is noted, and setup gives up at
  // its next step, closing what it had created. Once started, a signal stops the service.
  let started = false;
  let signalled: string | undefined;
  const onSignal = (signal: "SIGTERM" | "SIGINT") => () => {
    if (started) void stop();
    else signalled ??= signal;
  };
  const giveUpIfSignalled = (): void => {
    if (signalled !== undefined) throw new Error(`startup stopped by ${signalled}`);
  };
  signals.once("SIGTERM", onSignal("SIGTERM"));
  signals.once("SIGINT", onSignal("SIGINT"));

  try {
    telemetry = startTelemetry({
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
    const database = databaseFromPool(pool);
    db = database;
    const queue = createQueue({ db: pool, instruments });
    registerQueueDepth(instruments, queue);
    const client = createExternalClient({
      instruments,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
    app = buildApp({
      logger: { service, env: environment, level: config.logLevel },
      pingDatabase: () => database.ping(),
      telemetry: { tracer: telemetry.tracerProvider.getTracer("@riviera/api"), meter },
      ...(flows === undefined || !api
        ? {}
        : {
            sample: {
              db: database,
              queue,
              commonGround: createCommonGround({
                client,
                url: flows.commonGroundUrl,
                apiKey: flows.commonGroundDevApiKey,
              }),
            },
          }),
    });
    if (!api) {
      const discogs =
        flows === undefined ? undefined : createDiscogs({ client, url: flows.discogsUrl });
      runner = createRunner({
        queue,
        handlers: { "sample.discogs_release": sampleDiscogsRelease(discogs) },
        instruments,
        log: app.log,
        ...(options.idleMs === undefined ? {} : { idleMs: options.idleMs }),
      });
    }

    instruments.zeroInitialise();
    await telemetry.forceFlush();
    giveUpIfSignalled();
    await app.listen({ host: "0.0.0.0", port: config.port });
    giveUpIfSignalled();
    started = true;
    // After listen: jobs run only once the zeros are exported and the health checks answer.
    runner?.start();
  } catch (error) {
    await stop();
    throw error;
  }
  app.log.info({ role: config.role, migrationsApplied: applied }, "started");
  return { app, stop };
}
