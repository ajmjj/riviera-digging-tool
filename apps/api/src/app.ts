import Fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoutes, type HealthDeps } from "./health.ts";

export interface AppOptions extends HealthDeps {
  readonly logLevel: string;
}

/** Builds the HTTP app. The worker uses the same app for its health endpoints. */
export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel } });
  registerHealthRoutes(app, options);
  return app;
}
