import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

// Failure injection for the mocks (contracts/mocks.md, "Control"; 001/FR-013). Tests and the
// obs-check tell the mocks to fail; the api itself carries no test hooks.

export type MockService = "common_ground" | "discogs";
type Outcome = "fail" | "rate_limited";

const nextRequest = z.object({
  service: z.enum(["common_ground", "discogs"]),
  outcome: z.enum(["fail", "rate_limited"]),
  times: z.int().min(1).max(100).default(1),
});

/** Pending outcomes per service, consumed one request at a time. */
export class Control {
  readonly #pending = new Map<MockService, Outcome[]>();

  schedule(service: MockService, outcome: Outcome, times: number): void {
    const queue = this.#pending.get(service) ?? [];
    queue.push(...Array.from({ length: times }, () => outcome));
    this.#pending.set(service, queue);
  }

  reset(): void {
    this.#pending.clear();
  }

  /**
   * Answers the request with the next pending outcome for `service`, if any. Returns true
   * when it did, so the route stops there.
   */
  intercept(service: MockService, reply: FastifyReply): boolean {
    const outcome = this.#pending.get(service)?.shift();
    if (outcome === undefined) {
      return false;
    }
    if (outcome === "fail") {
      void reply.code(500).send({ message: "mock failure" });
    } else {
      void reply
        .code(429)
        .header("retry-after", "60")
        .send({ message: "You are making requests too quickly." });
    }
    return true;
  }
}

export function registerControlRoutes(app: FastifyInstance, control: Control): void {
  app.get("/healthz", () => ({ status: "ok" }));

  app.post("/_mock/next", async (request, reply) => {
    const parsed = nextRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "mock: invalid _mock/next request" });
    }
    control.schedule(parsed.data.service, parsed.data.outcome, parsed.data.times);
    return reply.code(204).send();
  });

  app.post("/_mock/reset", async (_request, reply) => {
    control.reset();
    return reply.code(204).send();
  });
}
