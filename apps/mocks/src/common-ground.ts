import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Control } from "./control.ts";

// Common Ground mock: `POST /graphql` answers known operations from recorded fixtures
// (contracts/mocks.md; 001/FR-013). Nothing here ever reaches the real Common Ground API.

const graphqlRequest = z.object({
  operationName: z.string(),
  query: z.string(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

/** Reads every `<OperationName>.json` in `dir`, keyed by operation name. */
export function loadOperationFixtures(dir: string): ReadonlyMap<string, unknown> {
  const fixtures = new Map<string, unknown>();
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".json")) {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
      fixtures.set(file.slice(0, -".json".length), parsed);
    }
  }
  return fixtures;
}

export function registerCommonGroundRoutes(
  app: FastifyInstance,
  control: Control,
  fixtures: ReadonlyMap<string, unknown>,
): void {
  app.post("/graphql", async (request, reply) => {
    // Like the real Admin API, a request without credentials is refused. The value is
    // never inspected or logged.
    if (request.headers.authorization === undefined) {
      return reply.code(401).send({ errors: [{ message: "mock: missing Authorization header" }] });
    }
    if (control.intercept("common_ground", reply)) {
      return reply;
    }
    const parsed = graphqlRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ errors: [{ message: "mock: invalid GraphQL request" }] });
    }
    const { operationName } = parsed.data;
    const fixture = fixtures.get(operationName);
    if (fixture === undefined) {
      return reply
        .code(400)
        .send({ errors: [{ message: `mock: unknown operation ${operationName}` }] });
    }
    return reply.send(fixture);
  });
}
