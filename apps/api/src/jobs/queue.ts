// The job queue (001/FR-029; research R12, R13; data-model.md §2): a Postgres table claimed with
// `FOR UPDATE SKIP LOCKED` under a lease. Every transition out of `running` is one conditional
// UPDATE on `id AND attempt AND status = 'running'`, so a worker that lost its lease can't
// overwrite a newer attempt. The queue records `riviera.jobs.runs` and `riviera.jobs.failures`
// for those transitions (including expired leases, which only the queue sees); the runner (T017)
// records the duration.

import { context, SpanKind, SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import type { Instruments, LabelsOf } from "@riviera/telemetry/instruments";
import { REDACTED, sanitize } from "@riviera/telemetry/redact";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import { z } from "zod";
import { isStaffId } from "../staff-id.ts";

/** Registered job names: exactly the `job_name` label values of the job metrics. */
export type JobName = LabelsOf<"riviera.jobs.failures">["job_name"];

const JOBS = {
  "sample.discogs_release": z.strictObject({
    releaseId: z.number().int().positive(),
    fail: z.boolean(),
  }),
} satisfies Record<JobName, z.ZodType>;

export type JobPayload<N extends JobName> = z.infer<(typeof JOBS)[N]>;

function isJobName(value: string): value is JobName {
  return Object.hasOwn(JOBS, value);
}

export const JOB_NAMES: readonly JobName[] = Object.keys(JOBS).filter(isJobName);

/** Issue paths only: the issues could quote payload values. */
function issuePaths(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
}

/** Validates a stored payload against its job's schema before a run (data-model.md §2). */
export function parsePayload<N extends JobName>(name: N, payload: unknown): JobPayload<N> {
  const parsed = JOBS[name].safeParse(payload);
  if (!parsed.success) {
    throw new TypeError(`invalid payload for ${name} at ${issuePaths(parsed.error)}`);
  }
  return parsed.data;
}

/** The part of `pg.Pool` the queue uses; any pool or client will do. */
interface Queryable {
  query<R extends pg.QueryResultRow>(text: string, values: unknown[]): Promise<pg.QueryResult<R>>;
}

interface EnqueueOptions {
  /** Default 3 (data-model.md §2). */
  readonly maxAttempts?: number;
  /** The pseudonymous staff ID the job acts for (001/FR-004); never an email. */
  readonly staffId?: string;
}

export interface ClaimedJob {
  readonly id: string;
  readonly name: JobName;
  /** As stored; the runner validates it against the job's schema before running. */
  readonly payload: unknown;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly originTraceparent: string | null;
  readonly traceParent: string | null;
  readonly staffId: string | null;
}

/** `retry`: queued again with backoff; `failed`: no attempts left; `stale`: nothing changed. */
type FailOutcome = "retry" | "failed" | "stale";

export interface Queue {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: EnqueueOptions,
  ): Promise<{ readonly id: string }>;
  /** Sweeps expired leases, then claims the next due job, if any. */
  claim(): Promise<ClaimedJob | undefined>;
  /** Extends the lease while this attempt still owns the job. */
  heartbeat(id: string, attempt: number): Promise<boolean>;
  /**
   * Marks the attempt succeeded. `traceParent` (the attempt's span context) is stored only if
   * no earlier attempt stored one. False when the attempt no longer owns the job.
   */
  complete(id: string, attempt: number, traceParent?: string): Promise<boolean>;
  /**
   * Records a failed attempt: queued again after 2^attempt s while attempts are left, else
   * `failed`. `traceParent` is stored with the outcome as in `complete`, so only an attempt
   * whose span ended (and was exported) can become the parent of later attempts (R13).
   */
  fail(id: string, attempt: number, error: unknown, traceParent?: string): Promise<FailOutcome>;
  /** Queued rows per registered job name, 0 for names with none (riviera.queue.depth). */
  queuedCounts(): Promise<ReadonlyMap<JobName, number>>;
}

export interface QueueOptions {
  readonly db: Queryable;
  readonly instruments: Pick<Instruments, "add">;
}

const LEASE = "interval '2 minutes'";
const LEASE_EXPIRED = "lease expired";
const DEFAULT_MAX_ATTEMPTS = 3;

// Shared by `fail` and the sweep: retry with backoff while attempts are left, else `failed`.
const AFTER_FAILURE = `
  status = CASE WHEN attempt < max_attempts THEN 'queued' ELSE 'failed' END,
  run_after = CASE WHEN attempt < max_attempts
    THEN now() + make_interval(secs => power(2, attempt)) ELSE run_after END,
  finished_at = CASE WHEN attempt < max_attempts THEN NULL ELSE now() END,
  locked_until = NULL,
  updated_at = now()`;

// Rows another sweeper or claimer holds are skipped, so each expired attempt is counted once.
const SWEEP = `
  UPDATE job SET ${AFTER_FAILURE}, last_error = '${LEASE_EXPIRED}'
  WHERE id IN (
    SELECT id FROM job
    WHERE status = 'running' AND locked_until < now() AND name = ANY($1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING name`;

const CLAIM = `
  UPDATE job SET status = 'running', attempt = attempt + 1, locked_until = now() + ${LEASE},
    started_at = now(), updated_at = now()
  WHERE id = (
    SELECT id FROM job
    WHERE status = 'queued' AND run_after <= now() AND name = ANY($1)
    ORDER BY run_after, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING id, name, payload, attempt, max_attempts, origin_traceparent, trace_parent, staff_id`;

const OWNED = "id = $1 AND attempt = $2 AND status = 'running'";

interface ClaimRow {
  id: string;
  name: string;
  payload: unknown;
  attempt: number;
  max_attempts: number;
  origin_traceparent: string | null;
  trace_parent: string | null;
  staff_id: string | null;
}

/** W3C `traceparent` of a span context. */
export function traceparentOf(span: Span): string {
  const { traceId, spanId, traceFlags } = span.spanContext();
  return `00-${traceId}-${spanId}-${traceFlags.toString(16).padStart(2, "0")}`;
}

function errorText(error: unknown): string {
  const sanitized = sanitize(error instanceof Error ? error.message : String(error));
  return typeof sanitized === "string" ? sanitized : REDACTED;
}

function validate(name: JobName, payload: unknown, options: EnqueueOptions): number {
  if (!isJobName(name)) {
    throw new TypeError("enqueue: unknown job name");
  }
  const parsed = JOBS[name].safeParse(payload);
  if (!parsed.success) {
    throw new TypeError(`enqueue: invalid payload for ${name} at ${issuePaths(parsed.error)}`);
  }
  if (options.staffId !== undefined && !isStaffId(options.staffId)) {
    throw new TypeError("enqueue: staffId must be a pseudonymous staff ID");
  }
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("enqueue: maxAttempts must be an integer of at least 1");
  }
  return maxAttempts;
}

export function createQueue({ db, instruments }: QueueOptions): Queue {
  const tracer = trace.getTracer("@riviera/api");
  const names = [...JOB_NAMES];

  const recordFailure = (name: string): void => {
    if (isJobName(name)) {
      instruments.add("riviera.jobs.runs", 1, { job_name: name, outcome: "failed" });
      instruments.add("riviera.jobs.failures", 1, { job_name: name });
    }
  };

  const insert = async (
    id: string,
    name: JobName,
    payload: unknown,
    maxAttempts: number,
    staffId: string | undefined,
    origin: string | null,
  ): Promise<void> => {
    await db.query(
      `INSERT INTO job (id, name, payload, max_attempts, staff_id, origin_traceparent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, JSON.stringify(payload), maxAttempts, staffId ?? null, origin],
    );
  };

  return {
    async enqueue(name, payload, options = {}) {
      const maxAttempts = validate(name, payload, options);
      const id = randomUUID();
      // Without an active span (e.g. a scheduled job) there is no producer to link to (R13).
      if (trace.getSpan(context.active()) === undefined) {
        await insert(id, name, payload, maxAttempts, options.staffId, null);
        return { id };
      }
      const attributes = { "riviera.job.name": name, "riviera.job.id": id };
      return tracer.startActiveSpan(
        `job.enqueue ${name}`,
        { kind: SpanKind.PRODUCER, attributes },
        async (span) => {
          try {
            await insert(id, name, payload, maxAttempts, options.staffId, traceparentOf(span));
            return { id };
          } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    },

    async claim() {
      const swept = await db.query<{ name: string }>(SWEEP, [names]);
      for (const row of swept.rows) {
        recordFailure(row.name);
      }
      const claimed = await db.query<ClaimRow>(CLAIM, [names]);
      const row = claimed.rows[0];
      if (row === undefined) {
        return undefined;
      }
      if (!isJobName(row.name)) {
        throw new TypeError("claim: claimed a job with an unregistered name");
      }
      return {
        id: row.id,
        name: row.name,
        payload: row.payload,
        attempt: row.attempt,
        maxAttempts: row.max_attempts,
        originTraceparent: row.origin_traceparent,
        traceParent: row.trace_parent,
        staffId: row.staff_id,
      };
    },

    async heartbeat(id, attempt) {
      const res = await db.query(
        `UPDATE job SET locked_until = now() + ${LEASE}, updated_at = now() WHERE ${OWNED}`,
        [id, attempt],
      );
      return res.rowCount === 1;
    },

    async complete(id, attempt, traceParent) {
      const res = await db.query<{ name: string }>(
        `UPDATE job SET status = 'succeeded', locked_until = NULL, finished_at = now(),
           updated_at = now(), trace_parent = COALESCE(trace_parent, $3)
         WHERE ${OWNED} RETURNING name`,
        [id, attempt, traceParent ?? null],
      );
      const name = res.rows[0]?.name;
      if (name === undefined) {
        return false;
      }
      if (isJobName(name)) {
        instruments.add("riviera.jobs.runs", 1, { job_name: name, outcome: "succeeded" });
      }
      return true;
    },

    async fail(id, attempt, error, traceParent) {
      const res = await db.query<{ name: string; status: string }>(
        `UPDATE job SET ${AFTER_FAILURE}, last_error = $3,
           trace_parent = COALESCE(trace_parent, $4)
         WHERE ${OWNED} RETURNING name, status`,
        [id, attempt, errorText(error), traceParent ?? null],
      );
      const row = res.rows[0];
      if (row === undefined) {
        return "stale";
      }
      recordFailure(row.name);
      return row.status === "queued" ? "retry" : "failed";
    },

    async queuedCounts() {
      const res = await db.query<{ name: string; n: number }>(
        "SELECT name, count(*)::int AS n FROM job WHERE status = 'queued' GROUP BY name",
        [],
      );
      const queued = new Map(res.rows.map((row) => [row.name, row.n]));
      return new Map(names.map((name) => [name, queued.get(name) ?? 0]));
    },
  };
}
