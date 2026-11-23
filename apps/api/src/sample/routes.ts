// The sample request (contracts/http.md#post-sampletrace, 001/FR-027, FR-030): one db query, one
// mocked Common Ground call and one enqueue under the request's server span, so a developer can
// follow a request end to end. Registered only when sample flows are on (config, research R17).

import { trace } from "@opentelemetry/api";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "../db.ts";
import type { CommonGround } from "../external/common-ground.ts";
import type { Queue } from "../jobs/queue.ts";

const SAMPLE_TRACE_ROUTE = "/sample/trace";

const DEFAULT_RELEASE_ID = 249504;

const requestBody = z
  .strictObject({
    failJob: z.boolean().default(false),
    releaseId: z.number().int().positive().default(DEFAULT_RELEASE_ID),
  })
  .default({ failJob: false, releaseId: DEFAULT_RELEASE_ID });

const countRow = z.object({ n: z.number().int() });

export interface SampleDeps {
  readonly db: Pick<Database, "query">;
  readonly commonGround: CommonGround;
  readonly queue: Pick<Queue, "enqueue">;
}

export function registerSampleRoutes(app: FastifyInstance, deps: SampleDeps): void {
  app.post(SAMPLE_TRACE_ROUTE, async (request, reply) => {
    const parsed = requestBody.safeParse(request.body);
    if (!parsed.success) {
      // Paths only: the issues could quote body values.
      const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
      return reply.code(400).send({ error: "invalid_body", fields });
    }
    const { failJob, releaseId } = parsed.data;

    const counted = await deps.db.query(
      "sample.count_queued_jobs",
      "SELECT count(*)::int AS n FROM job WHERE status = 'queued'",
    );
    const queued = countRow.parse(counted.rows[0]).n;

    let shopName: string | null;
    try {
      shopName = (await deps.commonGround.sampleShopConfig()).config?.shopName ?? null;
    } catch (error) {
      // The client span and metrics already record the outcome; nothing is enqueued.
      request.log.warn({ err: error }, "sample request: Common Ground call failed");
      return reply.code(502).send({ error: "common_ground_unavailable" });
    }

    const job = await deps.queue.enqueue(
      "sample.discogs_release",
      { releaseId, fail: failJob },
      failJob ? { maxAttempts: 1 } : {},
    );
    return reply.code(202).send({
      requestId: request.id,
      traceId: trace.getActiveSpan()?.spanContext().traceId,
      jobId: job.id,
      shopName,
      queued,
    });
  });
}
