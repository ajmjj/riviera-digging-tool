import { createLogger, type LoggerOptions } from "@riviera/telemetry/logger";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { isHealthRequest, registerHealthRoutes, type HealthDeps } from "./health.ts";
import { registerRequestContext, requestContextOptions } from "./http/request-context.ts";
import { registerTelemetry, type TelemetryPluginOptions } from "./http/telemetry-plugin.ts";
import { registerSampleRoutes, type SampleDeps } from "./sample/routes.ts";

export interface AppOptions extends HealthDeps {
  /** The structured logger of 001/FR-001, FR-005, FR-006 (`@riviera/telemetry/logger`). */
  readonly logger: LoggerOptions;
  /** Server spans and HTTP metrics (001/FR-007, FR-017); startup always passes them. */
  readonly telemetry?: TelemetryPluginOptions;
  /** The sample route's dependencies; the route exists only when given (001/FR-027). */
  readonly sample?: SampleDeps;
}

/** Builds the HTTP app. The worker uses the same app for its health endpoints. */
export function buildApp(options: AppOptions): FastifyInstance {
  const logger: FastifyBaseLogger = createLogger(options.logger);
  const app = Fastify({ loggerInstance: logger, ...requestContextOptions(isHealthRequest) });
  registerRequestContext(app);
  // Before any route: the plugin collects the route templates as they are added.
  if (options.telemetry !== undefined) {
    registerTelemetry(app, options.telemetry);
  }
  registerHealthRoutes(app, options);
  if (options.sample !== undefined) {
    registerSampleRoutes(app, options.sample);
  }
  return app;
}
