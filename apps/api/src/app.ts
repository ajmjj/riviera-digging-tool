import { createLogger, type LoggerOptions } from "@riviera/telemetry/logger";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { isHealthRequest, registerHealthRoutes, type HealthDeps } from "./health.ts";
import { registerRequestContext, requestContextOptions } from "./http/request-context.ts";

export interface AppOptions extends HealthDeps {
  /** The structured logger of 001/FR-001, FR-005, FR-006 (`@riviera/telemetry/logger`). */
  readonly logger: LoggerOptions;
}

/** Builds the HTTP app. The worker uses the same app for its health endpoints. */
export function buildApp(options: AppOptions): FastifyInstance {
  const logger: FastifyBaseLogger = createLogger(options.logger);
  const app = Fastify({ loggerInstance: logger, ...requestContextOptions(isHealthRequest) });
  registerRequestContext(app);
  registerHealthRoutes(app, options);
  return app;
}
