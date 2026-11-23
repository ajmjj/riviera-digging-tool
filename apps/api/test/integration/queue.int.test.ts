import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { createInstruments } from "@riviera/telemetry/instruments";
import { startTestTelemetry, type TestTelemetry } from "@riviera/telemetry/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createQueue, type Queue } from "../../src/jobs/queue.ts";
import { loadMigrations, migrateUp } from "../../src/migrate.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

const NAME = "sample.discogs_release";
const PAYLOAD = { releaseId: 249504, fail: false };
const A_DATE: unknown = expect.any(Date);

let db: FreshDatabase;
let harness: TestTelemetry;
let queue: Queue;

beforeEach(async () => {
  db = await freshDatabase();
  await migrateUp(db.url, await loadMigrations());
  harness = startTestTelemetry();
  const meter = harness.telemetry.meterProvider.getMeter("test");
  queue = createQueue({ db, instruments: createInstruments(meter, { routes: [] }) });
});

afterEach(async () => {
  await harness.shutdown();
  await db.drop();
});

async function row(id: string): Promise<Record<string, unknown>> {
  const res = await db.query("SELECT * FROM job WHERE id = $1", [id]);
  return res.rows[0] ?? {};
}

/** Seconds from the database's now() to a timestamp column. */
async function secondsUntil(id: string, column: "run_after" | "locked_until"): Promise<number> {
  const res = await db.query<{ s: number }>(
    `SELECT extract(epoch FROM ${column} - now())::float AS s FROM job WHERE id = $1`,
    [id],
  );
  return res.rows[0]?.s ?? Number.NaN;
}

const expireLease = (id: string): Promise<unknown> =>
  db.query("UPDATE job SET locked_until = now() - interval '1 second' WHERE id = $1", [id]);
const makeDue = (id: string): Promise<unknown> =>
  db.query("UPDATE job SET run_after = now() WHERE id = $1", [id]);

/** The latest cumulative value of a counter series; 0 when the series was never written. */
async function counter(name: string, attributes: Record<string, string>): Promise<number> {
  const metric = (await harness.metrics()).find((m) => m.descriptor.name === name);
  const points = metric?.dataPoints ?? [];
  const point = points.find((p) =>
    Object.entries(attributes).every(([key, value]) => p.attributes[key] === value),
  );
  return typeof point?.value === "number" ? point.value : 0;
}

const failures = (): Promise<number> => counter("riviera.jobs.failures", { job_name: NAME });
const runs = (outcome: "succeeded" | "failed"): Promise<number> =>
  counter("riviera.jobs.runs", { job_name: NAME, outcome });

async function claimed(): Promise<{ id: string; attempt: number }> {
  const job = await queue.claim();
  if (job === undefined) {
    throw new Error("expected a job to claim");
  }
  return job;
}

describe("001/FR-029: enqueue", () => {
  it("001/FR-029: stores a queued job with its payload and options", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD, { maxAttempts: 5, staffId: "staff_0001" });
    expect(await row(id)).toMatchObject({
      name: NAME,
      payload: PAYLOAD,
      status: "queued",
      attempt: 0,
      max_attempts: 5,
      staff_id: "staff_0001",
    });
    const { id: plain } = await queue.enqueue(NAME, PAYLOAD);
    expect(await row(plain)).toMatchObject({ max_attempts: 3, staff_id: null });
  });

  it("001/FR-029: rejects an unregistered name, an invalid payload or bad maxAttempts", async () => {
    // An untyped caller (e.g. plain JavaScript) passing a name outside the registry.
    const enqueue: unknown = Reflect.get(queue, "enqueue");
    if (typeof enqueue !== "function") {
      throw new Error("enqueue is not a function");
    }
    const untyped: unknown = Reflect.apply(enqueue, queue, ["sample.unknown", PAYLOAD]);
    await expect(untyped).rejects.toThrow("unknown job name");
    const secret = { releaseId: -987654, fail: false };
    const invalid = queue.enqueue(NAME, secret);
    await expect(invalid).rejects.toThrow(
      "invalid payload for sample.discogs_release at releaseId",
    );
    await expect(invalid).rejects.not.toThrow("987654");
    for (const maxAttempts of [0, 1.5]) {
      await expect(queue.enqueue(NAME, PAYLOAD, { maxAttempts })).rejects.toThrow("maxAttempts");
    }
    expect((await db.query("SELECT count(*)::int AS n FROM job")).rows[0]).toEqual({ n: 0 });
  });

  it("001/FR-010: inside a span, a PRODUCER span is created and its context stored", async () => {
    const tracer = trace.getTracer("test");
    const parent = tracer.startSpan("request");
    const ctx = trace.setSpan(context.active(), parent);
    const { id } = await context.with(ctx, () => queue.enqueue(NAME, PAYLOAD));
    parent.end();

    const producer = (await harness.spans()).find((s) => s.name === `job.enqueue ${NAME}`);
    expect(producer?.kind).toBe(SpanKind.PRODUCER);
    expect(producer?.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
    expect(producer?.attributes).toEqual({ "riviera.job.name": NAME, "riviera.job.id": id });
    const ids = producer?.spanContext();
    const traceparent = `00-${ids?.traceId ?? "?"}-${ids?.spanId ?? "?"}-01`;
    expect(await row(id)).toMatchObject({ origin_traceparent: traceparent });
  });

  it("001/FR-010: without an active span there is no producer span and no origin", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    expect(await row(id)).toMatchObject({ origin_traceparent: null });
    expect(await harness.spans()).toEqual([]);
  });

  it("001/FR-010: a failed insert marks the producer span as an error", async () => {
    const broken = createQueue({
      db: { query: () => Promise.reject(new Error("connection lost")) },
      instruments: { add: () => undefined },
    });
    const tracer = trace.getTracer("test");
    await tracer.startActiveSpan("request", async (parent) => {
      await expect(broken.enqueue(NAME, PAYLOAD)).rejects.toThrow("connection lost");
      parent.end();
    });
    const producer = (await harness.spans()).find((s) => s.name === `job.enqueue ${NAME}`);
    expect(producer?.status.code).toBe(SpanStatusCode.ERROR);
  });
});

describe("001/FR-004: staff ID on jobs", () => {
  it("001/FR-004: an email-shaped staffId is rejected by enqueue", async () => {
    for (const staffId of ["antn@example.com", "", "a".repeat(65), "Antn Name"]) {
      await expect(queue.enqueue(NAME, PAYLOAD, { staffId })).rejects.toThrow(
        "pseudonymous staff ID",
      );
    }
    expect((await db.query("SELECT count(*)::int AS n FROM job")).rows[0]).toEqual({ n: 0 });
  });

  it("001/FR-004: an email-shaped staff_id is rejected by the CHECK", async () => {
    const insert = db.query("INSERT INTO job (name, staff_id) VALUES ($1, $2)", [
      NAME,
      "antn@example.com",
    ]);
    await expect(insert).rejects.toMatchObject({ code: "23514" });
  });
});

describe("001/FR-029: claim, heartbeat, complete, fail", () => {
  it("001/FR-029: claim takes the next due job under a 2 minute lease", async () => {
    expect(await queue.claim()).toBeUndefined();
    const { id } = await queue.enqueue(NAME, PAYLOAD, { staffId: "staff_0001" });
    const later = await queue.enqueue(NAME, PAYLOAD);
    await db.query("UPDATE job SET run_after = now() + interval '1 hour' WHERE id = $1", [
      later.id,
    ]);

    expect(await queue.claim()).toEqual({
      id,
      name: NAME,
      payload: PAYLOAD,
      attempt: 1,
      maxAttempts: 3,
      originTraceparent: null,
      traceParent: null,
      staffId: "staff_0001",
    });
    expect(await row(id)).toMatchObject({ status: "running", started_at: A_DATE });
    expect(await secondsUntil(id, "locked_until")).toBeGreaterThan(115);
    expect(await secondsUntil(id, "locked_until")).toBeLessThanOrEqual(120);
    expect(await queue.claim()).toBeUndefined(); // not due yet
  });

  it("001/FR-029: complete marks the attempt succeeded and stores its trace parent", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    const job = await claimed();
    expect(await queue.complete(id, job.attempt, "00-trace-span-01")).toBe(true);
    expect(await row(id)).toMatchObject({
      status: "succeeded",
      locked_until: null,
      finished_at: A_DATE,
      trace_parent: "00-trace-span-01",
    });
    expect(await runs("succeeded")).toBe(1);
    expect(await failures()).toBe(0);
    expect(await queue.complete(id, job.attempt)).toBe(false); // terminal
  });

  it("001/FR-029: fail retries with 2^attempt s backoff until max_attempts, then fails", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD, { maxAttempts: 2 });
    const first = await claimed();
    const error = new Error("Discogs said no to antn@example.com");
    expect(await queue.fail(id, first.attempt, error, "00-first-span-01")).toBe("retry");
    expect(await row(id)).toMatchObject({
      status: "queued",
      locked_until: null,
      finished_at: null,
      last_error: "Discogs said no to [REDACTED]",
      trace_parent: "00-first-span-01",
    });
    const wait = await secondsUntil(id, "run_after");
    expect(wait).toBeGreaterThan(1);
    expect(wait).toBeLessThanOrEqual(2);
    expect(await queue.claim()).toBeUndefined(); // backing off

    await makeDue(id);
    const second = await claimed();
    expect(second.attempt).toBe(2);
    expect(await queue.fail(id, second.attempt, "x".repeat(10_000), "00-second-span-01")).toBe(
      "failed",
    );
    const failed = await row(id);
    expect(failed).toMatchObject({ status: "failed", finished_at: A_DATE });
    // Later attempts keep the first stored parent (R13); the message is truncated.
    expect(failed["trace_parent"]).toBe("00-first-span-01");
    expect(String(failed["last_error"])).toMatch(/^x{8192}…\[truncated]$/);
    expect(await failures()).toBe(2);
    expect(await runs("failed")).toBe(2);
    await makeDue(id);
    expect(await queue.claim()).toBeUndefined(); // terminal
  });

  it("001/FR-029: two concurrent claimers never get the same job", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      ids.add((await queue.enqueue(NAME, PAYLOAD)).id);
    }
    const worker = async (): Promise<string[]> => {
      const got: string[] = [];
      for (let job = await queue.claim(); job !== undefined; job = await queue.claim()) {
        got.push(job.id);
      }
      return got;
    };
    const [a, b] = await Promise.all([worker(), worker()]);
    const all = [...a, ...b];
    expect(all).toHaveLength(12);
    expect(new Set(all)).toEqual(ids);

    // Two due jobs, two claimers at once: each gets a different one, neither waits or misses.
    for (let round = 0; round < 5; round += 1) {
      const pair = [await queue.enqueue(NAME, PAYLOAD), await queue.enqueue(NAME, PAYLOAD)];
      const race = await Promise.all([queue.claim(), queue.claim()]);
      expect(new Set(race.map((job) => job?.id))).toEqual(new Set(pair.map((job) => job.id)));
    }
  });

  it("001/FR-029: a heartbeat keeps a long job's lease", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    const job = await claimed();
    await db.query("UPDATE job SET locked_until = now() + interval '1 second' WHERE id = $1", [id]);
    expect(await queue.heartbeat(id, job.attempt)).toBe(true);
    expect(await secondsUntil(id, "locked_until")).toBeGreaterThan(115);
    expect(await queue.heartbeat(id, job.attempt + 1)).toBe(false);
    expect(await queue.claim()).toBeUndefined(); // lease held: not swept, not re-claimed
    expect(await row(id)).toMatchObject({ status: "running", attempt: 1 });
  });
});

describe("001/FR-029: expired leases (crashed workers)", () => {
  it("001/FR-029: an expired lease with attempts left is requeued and counted once as failed", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD, { maxAttempts: 3 });
    const first = await claimed();
    expect(await queue.fail(id, first.attempt, new Error("boom"), "00-first-span-01")).toBe(
      "retry",
    );
    await makeDue(id);
    await claimed(); // attempt 2 crashes
    await expireLease(id);

    expect(await queue.claim()).toBeUndefined(); // swept, backing off
    expect(await row(id)).toMatchObject({
      status: "queued",
      attempt: 2,
      locked_until: null,
      last_error: "lease expired",
      // Stored by attempt 1, whose span ended: still a valid parent for attempt 3 (R13).
      trace_parent: "00-first-span-01",
    });
    expect(await secondsUntil(id, "run_after")).toBeGreaterThan(3);
    expect(await failures()).toBe(2);
    expect(await queue.claim()).toBeUndefined();
    expect(await failures()).toBe(2); // the sweep counts each expired attempt once

    await makeDue(id);
    expect(await claimed()).toMatchObject({ attempt: 3, traceParent: "00-first-span-01" });
  });

  it("001/FR-029: an expired lease with no attempts left is failed and never runs again", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD, { maxAttempts: 1 });
    await claimed();
    await expireLease(id);

    expect(await queue.claim()).toBeUndefined();
    expect(await row(id)).toMatchObject({
      status: "failed",
      attempt: 1,
      finished_at: A_DATE,
      last_error: "lease expired",
      // The crashed attempt's span was never exported, so it left no parent behind (R13).
      trace_parent: null,
    });
    await makeDue(id);
    expect(await queue.claim()).toBeUndefined();
    expect(await failures()).toBe(1);
    expect(await runs("failed")).toBe(1);
  });

  it("001/FR-029: a stale worker's complete or fail after its lease was swept changes nothing", async () => {
    const { id } = await queue.enqueue(NAME, PAYLOAD);
    const stale = await claimed();
    await expireLease(id);
    expect(await queue.claim()).toBeUndefined(); // swept
    await makeDue(id);
    const current = await claimed();
    expect(current.attempt).toBe(2);
    const before = await row(id);
    const failuresBefore = await failures();

    expect(await queue.complete(id, stale.attempt, "00-stale-span-01")).toBe(false);
    expect(await queue.fail(id, stale.attempt, new Error("late"), "00-stale-span-01")).toBe(
      "stale",
    );
    expect(await queue.heartbeat(id, stale.attempt)).toBe(false);

    expect(await row(id)).toEqual(before);
    expect(await failures()).toBe(failuresBefore);
    expect(await runs("succeeded")).toBe(0);
  });
});

describe("001/FR-029: queue depth", () => {
  it("001/FR-029: queuedCounts reports every registered name, 0 when none are queued", async () => {
    expect(await queue.queuedCounts()).toEqual(new Map([[NAME, 0]]));
    await queue.enqueue(NAME, PAYLOAD);
    await queue.enqueue(NAME, PAYLOAD);
    expect(await queue.queuedCounts()).toEqual(new Map([[NAME, 2]]));
    await claimed();
    expect(await queue.queuedCounts()).toEqual(new Map([[NAME, 1]]));
  });
});
