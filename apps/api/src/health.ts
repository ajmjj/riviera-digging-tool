import type { FastifyInstance, FastifyRequest } from "fastify";

export interface HealthDeps {
  readonly pingDatabase: () => Promise<void>;
}

export const HEALTHZ = "/healthz";
export const READYZ = "/readyz";
const HEALTH_ROUTES: ReadonlySet<string> = new Set([HEALTHZ, READYZ]);

/**
 * 001/FR-007: healthchecks write no per-request lines (the app turns Fastify's request logging
 * off for these), while a failing check still writes its own warn line.
 */
export function isHealthRequest(request: FastifyRequest): boolean {
  const route = request.routeOptions.url;
  return route !== undefined && HEALTH_ROUTES.has(route);
}

/**
 * `/healthz`: the process is alive.
 * `/readyz`: the database is reachable. The "last sync recent" condition joins this check
 * when the Common Ground sync lands.
 */
export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.get(HEALTHZ, () => ({ status: "ok" }));

  app.get(READYZ, async (request, reply) => {
    try {
      await deps.pingDatabase();
      return { status: "ready", checks: { database: "ok" } };
    } catch (error) {
      request.log.warn({ err: error, check: "database" }, "readiness check failed");
      return reply.code(503).send({ status: "not_ready", checks: { database: "unreachable" } });
    }
  });
}
