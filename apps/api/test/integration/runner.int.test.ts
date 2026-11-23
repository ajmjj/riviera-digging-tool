import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { createInstruments, type Instruments } from "@riviera/telemetry/instruments";
import { createLogger } from "@riviera/telemetry/logger";
import { startTestTelemetry, type TestTelemetry } from "@riviera/telemetry/testing";
import { EventEmitter } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createQueue, type Queue } from "../../src/jobs/queue.ts";
import {
  createRunner,
  registerQueueDepth,
  type JobHandler,
  type RunnerOptions,
} from "../../src/jobs/runner.ts";
import { loadMigrations, migrateUp } from "../../src/migrate.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

const NAME = "sample.discogs_release";
const PAYLOAD = { releaseId: 249504, fail: false };
const STAFF = "staff_test_0001";

type Handler = JobHandler<typeof NAME>;

let db: FreshDatabase;
let harness: TestTelemetry;
let instruments: Instruments;
let queue: Queue;
let lines: Record<string, unknown>[];

beforeEach(async () => {
  db = await freshDatabase();
  await migrateUp(db.url, await loadMigrations());
  harness = startTestTelemetry({ service: "riviera-worker" });
  instruments = createInstruments(harness.telemetry.meterProvider.getMeter("test"), {
    routes: [],
  });
  queue = createQueue({ db, instruments });
  lines = [];
});

afterEach(async () => {
  await harness.shutdown();
  await db.drop();
});

function runner(handler: Handler, overrides: Partial<RunnerOptions> = {}) {
  const log = createLogger({
    service: "riviera-worker",
    env: "ci",
    level: "info",
    write: (line) => {
      const parsed: unknown = JSON.parse(line);
      lines.push(typeof parsed === "object" && parsed !== null ? { ...parsed } : {});
    },
  });
  return createRunner({ queue, handlers: { [NAME]: handler }, instruments, log, ...overrides });
}

const ok: Handler = (_payload, run) => {
  run.log.info("handler ran");
  return Promise.resolve();
};

/** Enqueues inside a request span, as the sample route does; returns the producer context. */
async function enqueueFromRequest(maxAttempts = 3) {
  const request = trace.getTracer("test").startSpan("request");
  const { id } = await context.with(trace.setSpan(context.active(), request), () =>
    queue.enqueue(NAME, PAYLOAD, { maxAttempts, staffId: STAFF }),
  );
  request.end();
  const producer = (await harness.spans()).find((s) => s.name === `job.enqueue ${NAME}`);
  return { id, producer: producer?.spanContext() };
}

async function jobSpans() {
  return (await harness.spans()).filter((s) => s.name === `job.run ${NAME}`);
}

async function row(id: string): Promise<Record<string, unknown>> {
  return (await db.query("SELECT * FROM job WHERE id = $1", [id])).rows[0] ?? {};
}

const makeDue = (id: string): Promise<unknown> =>
  db.query("UPDATE job SET run_after = now() WHERE id = $1", [id]);

async function metric(name: string) {
  return (await harness.metrics()).find((m) => m.descriptor.name === name)?.dataPoints ?? [];
}

async function counter(name: string, attributes: Record<string, string>): Promise<number> {
  const point = (await metric(name)).find((p) =>
    Object.entries(attributes).every(([key, value]) => p.attributes[key] === value),
  );
  return typeof point?.value === "number" ? point.value : 0;
}

async function durationCount(outcome: "succeeded" | "failed"): Promise<number> {
  const point = (await metric("riviera.jobs.duration")).find(
    (p) => p.attributes["outcome"] === outcome && p.attributes["job_name"] === NAME,
  );
  const value: unknown = point?.value;
  return typeof value === "object" && value !== null ? Number(Reflect.get(value, "count")) : 0;
}

async function until(condition: () => Promise<boolean> | boolean): Promise<void> {
  for (let i = 0; i < 500; i += 1) {
    if (await condition()) {
      return;
    }
    await sleep(10);
  }
  throw new Error("condition not met within 5 s");
}

const traceparent = (ctx: { traceId: string; spanId: string } | undefined) =>
  `00-${ctx?.traceId ?? "?"}-${ctx?.spanId ?? "?"}-01`;

describe("001/FR-009: job.run spans", () => {
  it("001/FR-009: a run is a CONSUMER span with the job's name, ID, attempt and outcome", async () => {
    const { id, producer } = await enqueueFromRequest();
    expect(await runner(ok).runOnce()).toBe(true);

    const [span, ...rest] = await jobSpans();
    expect(rest).toEqual([]);
    expect(span?.kind).toBe(SpanKind.CONSUMER);
    expect(span?.status.code).toBe(SpanStatusCode.UNSET);
    expect(span?.attributes).toEqual({
      "riviera.job.name": NAME,
      "riviera.job.id": id,
      "riviera.job.attempt": 1,
      "riviera.job.outcome": "succeeded",
      "riviera.staff_id": STAFF,
    });
    // Attempt 1 is a root of its own trace, linked to the producer (001/FR-010).
    expect(span?.parentSpanContext).toBeUndefined();
    expect(span?.spanContext().traceId).not.toBe(producer?.traceId);
    expect(span?.links.map((l) => l.context.spanId)).toEqual([producer?.spanId]);
    expect(await row(id)).toMatchObject({
      status: "succeeded",
      trace_parent: traceparent(span?.spanContext()),
    });
  });

  it("001/FR-009: a failed attempt is an ERROR span with an exception event", async () => {
    const { id } = await enqueueFromRequest(1);
    await runner(() => Promise.reject(new Error("release lookup failed"))).runOnce();

    const [span] = await jobSpans();
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.attributes["riviera.job.outcome"]).toBe("failed");
    expect(span?.events.map((e) => e.attributes?.["exception.message"])).toEqual([
      "release lookup failed",
    ]);
    expect(await row(id)).toMatchObject({ status: "failed", last_error: "release lookup failed" });
  });

  it("001/FR-009: a payload that fails its schema fails the attempt, naming only the path", async () => {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO job (id, name, payload, max_attempts)
       VALUES (gen_random_uuid(), $1, '{"releaseId": -987654, "fail": false}', 1) RETURNING id`,
      [NAME],
    );
    let ran = false;
    await runner(() => {
      ran = true;
      return Promise.resolve();
    }).runOnce();
    expect(ran).toBe(false);
    const stored = await row(rows[0]?.id ?? "");
    expect(stored["last_error"]).toBe(`invalid payload for ${NAME} at releaseId`);
    expect(JSON.stringify(lines)).not.toContain("987654");
  });
});

describe("001/FR-010: retries stay in the job's trace", () => {
  it("001/FR-010: later attempts are children of attempt 1, each linked to the producer", async () => {
    const { id, producer } = await enqueueFromRequest();
    let calls = 0;
    const flaky = runner(() => {
      calls += 1;
      return calls < 3 ? Promise.reject(new Error(`attempt ${String(calls)}`)) : Promise.resolve();
    });
    await flaky.runOnce();
    await makeDue(id);
    await flaky.runOnce();
    await makeDue(id);
    await flaky.runOnce();

    const [first, second, third] = await jobSpans();
    const root = first?.spanContext();
    expect(first?.parentSpanContext).toBeUndefined();
    for (const retry of [second, third]) {
      expect(retry?.spanContext().traceId).toBe(root?.traceId);
      expect(retry?.parentSpanContext?.spanId).toBe(root?.spanId);
      expect(retry?.links.map((l) => l.context.spanId)).toEqual([producer?.spanId]);
    }
    expect([first, second, third].map((s) => s?.attributes["riviera.job.attempt"])).toEqual([
      1, 2, 3,
    ]);
    expect(await row(id)).toMatchObject({ status: "succeeded", trace_parent: traceparent(root) });
  });

  it("001/FR-010: a job enqueued without a request starts its own trace, with no link", async () => {
    await queue.enqueue(NAME, PAYLOAD);
    await runner(ok).runOnce();
    const [span] = await jobSpans();
    expect(span?.parentSpanContext).toBeUndefined();
    expect(span?.links).toEqual([]);
    expect(span?.attributes["riviera.staff_id"]).toBeUndefined();
  });

  it("001/FR-010: a retry after a crashed first attempt is a new root, not an orphan child", async () => {
    const { id, producer } = await enqueueFromRequest();
    // Attempt 1 is claimed and its worker dies: no span is exported, no context is stored.
    await queue.claim();
    await db.query("UPDATE job SET locked_until = now() - interval '1 second' WHERE id = $1", [id]);
    await queue.claim(); // sweeps the expired lease
    await makeDue(id);
    await runner(ok).runOnce();

    const [span, ...rest] = await jobSpans();
    expect(rest).toEqual([]);
    expect(span?.attributes["riviera.job.attempt"]).toBe(2);
    expect(span?.parentSpanContext).toBeUndefined();
    expect(span?.links.map((l) => l.context.spanId)).toEqual([producer?.spanId]);
    expect(await row(id)).toMatchObject({ trace_parent: traceparent(span?.spanContext()) });
  });
});

describe("001/FR-002: job log lines", () => {
  it("001/FR-002: every line of a run carries job_id, job_name, attempt, staff_id and trace", async () => {
    const { id } = await enqueueFromRequest();
    await runner(ok).runOnce();
    const [span] = await jobSpans();
    const ran = lines.filter((l) => l["job_id"] === id);
    expect(ran.map((l) => l["msg"])).toEqual(["handler ran", "job succeeded"]);
    for (const line of ran) {
      expect(line).toMatchObject({
        job_name: NAME,
        attempt: 1,
        staff_id: STAFF,
        trace_id: span?.spanContext().traceId,
        span_id: span?.spanContext().spanId,
      });
    }
  });

  it("001/FR-002: a failed attempt writes one error line with the job's identity", async () => {
    const { id } = await enqueueFromRequest(1);
    await runner(() => Promise.reject(new Error("boom"))).runOnce();
    expect(lines.filter((l) => l["level"] === "error")).toEqual([
      expect.objectContaining({
        msg: "job attempt failed",
        job_id: id,
        job_name: NAME,
        next: "failed",
        error: "boom",
      }),
    ]);
  });
});

describe("001/FR-016: job metrics", () => {
  it("001/FR-016: each attempt is counted once, with its duration; each failure once", async () => {
    const { id } = await enqueueFromRequest();
    let calls = 0;
    const flaky = runner(() => {
      calls += 1;
      return calls < 3 ? Promise.reject(new Error("flaky")) : Promise.resolve();
    });
    await flaky.runOnce();
    expect(await counter("riviera.jobs.failures", { job_name: NAME })).toBe(1);
    await makeDue(id);
    await flaky.runOnce();
    expect(await counter("riviera.jobs.failures", { job_name: NAME })).toBe(2);
    await makeDue(id);
    await flaky.runOnce();

    expect(await counter("riviera.jobs.failures", { job_name: NAME })).toBe(2);
    expect(await counter("riviera.jobs.runs", { job_name: NAME, outcome: "failed" })).toBe(2);
    expect(await counter("riviera.jobs.runs", { job_name: NAME, outcome: "succeeded" })).toBe(1);
    expect(await durationCount("failed")).toBe(2);
    expect(await durationCount("succeeded")).toBe(1);
  });

  it("001/FR-016: queue depth reports queued jobs per name, and 0 once the queue drains", async () => {
    const stop = registerQueueDepth(instruments, queue);
    const depth = async () =>
      (await metric("riviera.queue.depth")).map((p) => [p.attributes, p.value]);
    expect(await depth()).toEqual([[{ job_name: NAME }, 0]]);
    await queue.enqueue(NAME, PAYLOAD);
    await queue.enqueue(NAME, PAYLOAD);
    expect(await depth()).toEqual([[{ job_name: NAME }, 2]]);
    const worker = runner(ok);
    await worker.runOnce();
    await worker.runOnce();
    expect(await depth()).toEqual([[{ job_name: NAME }, 0]]);
    stop();
  });

  it("001/FR-016: queue depth skips a failed read and fills in 0 for names left out", async () => {
    const unreadable = registerQueueDepth(instruments, {
      queuedCounts: () => Promise.reject(new Error("database unreachable")),
    });
    expect(await metric("riviera.queue.depth")).toEqual([]);
    unreadable();
    const stop = registerQueueDepth(instruments, {
      queuedCounts: () => Promise.resolve(new Map()),
    });
    expect((await metric("riviera.queue.depth")).map((p) => p.value)).toEqual([0]);
    stop();
  });
});

describe("001/FR-009: the poll loop", () => {
  it("001/FR-009: runs queued jobs, keeps the lease with heartbeats, and stops on SIGTERM", async () => {
    const signals = new EventEmitter();
    let heartbeats = 0;
    const watched: Queue = {
      ...queue,
      heartbeat: async (id, attempt) => {
        heartbeats += 1;
        return queue.heartbeat(id, attempt);
      },
    };
    const worker = runner(
      async () => {
        await sleep(80);
      },
      { queue: watched, idleMs: 5, heartbeatMs: 10, signals },
    );
    worker.start();
    worker.start();
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    await until(async () => (await row(id))["status"] === "succeeded");
    expect(heartbeats).toBeGreaterThan(0);

    signals.emit("SIGTERM");
    await worker.stop();
    worker.start(); // a stopped runner stays stopped
    const { id: later } = await queue.enqueue(NAME, PAYLOAD);
    await sleep(30);
    expect(await row(later)).toMatchObject({ status: "queued" });
  });

  it("001/FR-009: a failed poll is logged and the loop goes on", async () => {
    let first = true;
    const worker = runner(ok, {
      idleMs: 5,
      queue: {
        ...queue,
        claim: () => {
          if (first) {
            first = false;
            return Promise.reject(new Error("connection reset"));
          }
          return queue.claim();
        },
      },
    });
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    worker.start();
    await until(async () => (await row(id))["status"] === "succeeded");
    await worker.stop();
    expect(lines.find((l) => l["msg"] === "job runner poll failed")).toMatchObject({
      level: "error",
      error: "connection reset",
    });
  });

  it("001/FR-009: a heartbeat still in flight when the attempt ends lands before complete", async () => {
    const order: string[] = [];
    const worker = runner(() => sleep(15), {
      heartbeatMs: 10,
      queue: {
        ...queue,
        heartbeat: async (id, attempt) => {
          await sleep(40);
          order.push("heartbeat");
          return queue.heartbeat(id, attempt);
        },
        complete: (id, attempt, traceParent) => {
          order.push("complete");
          return queue.complete(id, attempt, traceParent);
        },
      },
    });
    await queue.enqueue(NAME, PAYLOAD);
    await worker.runOnce();
    expect(order).toEqual(["heartbeat", "complete"]);
    expect(lines.filter((l) => l["level"] === "warn")).toEqual([]);
  });

  it("001/FR-009: a heartbeat slower than its interval is never overlapped and lands before complete", async () => {
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const worker = runner(() => sleep(60), {
      heartbeatMs: 10,
      queue: {
        ...queue,
        heartbeat: async (id, attempt) => {
          calls += 1;
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          // The first heartbeat stalls past the end of the attempt; any later one would be fast.
          await sleep(calls === 1 ? 100 : 1);
          const owned = await queue.heartbeat(id, attempt);
          inFlight -= 1;
          order.push("heartbeat");
          return owned;
        },
        complete: (id, attempt, traceParent) => {
          order.push("complete");
          return queue.complete(id, attempt, traceParent);
        },
      },
    });
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    await worker.runOnce();
    expect(maxInFlight).toBe(1);
    expect(order.at(-1)).toBe("complete");
    await sleep(120); // a heartbeat left behind would land, and warn, by now
    expect(order.at(-1)).toBe("complete");
    expect(lines.filter((l) => l["level"] === "warn")).toEqual([]);
    expect(await row(id)).toMatchObject({ status: "succeeded" });
  });

  it("001/FR-009: stop() waits for an attempt started with runOnce()", async () => {
    let started = false;
    const worker = runner(async () => {
      started = true;
      await sleep(50);
    });
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    const once = worker.runOnce();
    await until(() => started);
    await worker.stop();
    expect(await row(id)).toMatchObject({ status: "succeeded" });
    expect(await once).toBe(true);
  });

  it("001/FR-009: stop() during a runOnce() claim still waits for the claimed attempt", async () => {
    let claiming = false;
    const worker = runner(() => sleep(30), {
      queue: {
        ...queue,
        claim: async () => {
          claiming = true;
          await sleep(30);
          return queue.claim();
        },
      },
    });
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    const once = worker.runOnce();
    await until(() => claiming);
    await worker.stop();
    expect(await row(id)).toMatchObject({ status: "succeeded" });
    expect(await once).toBe(true);
  });

  it("001/FR-009: a lost lease, a failing heartbeat and a stale complete are logged", async () => {
    let beat = 0;
    const worker = runner(
      async () => {
        await sleep(60);
      },
      {
        heartbeatMs: 10,
        queue: {
          ...queue,
          heartbeat: () => {
            beat += 1;
            return beat === 1 ? Promise.resolve(false) : Promise.reject(new Error("timeout"));
          },
          complete: () => Promise.resolve(false),
        },
      },
    );
    await queue.enqueue(NAME, PAYLOAD);
    await worker.runOnce();
    const warnings = lines.filter((l) => l["level"] === "warn").map((l) => l["msg"]);
    expect(warnings).toContain("job lease lost");
    expect(warnings).toContain("job heartbeat failed");
    expect(warnings.at(-1)).toBe("job succeeded after its lease was lost");
    expect(await runner(ok).runOnce()).toBe(false);
  });
});
