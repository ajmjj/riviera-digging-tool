import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.ts";
import type { Config } from "./config.ts";
import { createDatabase } from "./db.ts";
import { loadMigrations, migrateUp, MIGRATIONS_DIR } from "./migrate.ts";

export interface SignalSource {
  once(event: "SIGTERM" | "SIGINT", listener: () => void): unknown;
}

/** The loaded config; the deployment environment labels every log line (001/FR-001). */
export type ServiceConfig = Config & { readonly telemetry: { readonly environment: string } };

export interface Service {
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

/**
 * Starts the api or the worker: migrations first (both roles run them; the advisory lock
 * makes that safe), then the HTTP app. SIGTERM and SIGINT stop it.
 */
export async function startService(
  config: ServiceConfig,
  signals: SignalSource,
  migrationsDir: URL = MIGRATIONS_DIR,
): Promise<Service> {
  const applied = await migrateUp(config.databaseUrl, await loadMigrations(migrationsDir));
  const db = createDatabase(config.databaseUrl);
  const app = buildApp({
    logger: {
      service: config.role === "api" ? "riviera-api" : "riviera-worker",
      env: config.telemetry.environment,
      level: config.logLevel,
    },
    pingDatabase: () => db.ping(),
  });

  let stopping: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    stopping ??= app.close().then(() => db.close());
    return stopping;
  };
  signals.once("SIGTERM", () => void stop());
  signals.once("SIGINT", () => void stop());

  try {
    await app.listen({ host: "0.0.0.0", port: config.port });
  } catch (error) {
    await stop();
    throw error;
  }
  app.log.info({ role: config.role, migrationsApplied: applied }, "started");
  return { app, stop };
}
