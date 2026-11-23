import type { FastifyInstance } from "fastify";

export interface HealthDeps {
  readonly pingDatabase: () => Promise<void>;
}

/**
 * `/healthz`: the process is alive.
 * `/readyz`: the database is reachable. The "last sync recent" condition joins this check
 * when the Common Ground sync lands.
 */
export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.get("/healthz", () => ({ status: "ok" }));

  app.get("/readyz", async (_request, reply) => {
    try {
      await deps.pingDatabase();
      return { status: "ready", checks: { database: "ok" } };
    } catch {
      return reply.code(503).send({ status: "not_ready", checks: { database: "unreachable" } });
    }
  });
}
