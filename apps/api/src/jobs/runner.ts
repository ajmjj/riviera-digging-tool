// The job runner (research R13, contracts/telemetry.md#spans): polls `claim()`, runs each attempt
// in a CONSUMER span `job.run {name}` with a child logger carrying the job's identity
// (001/FR-002, FR-009), links every attempt to the enqueuing request's producer span
// (001/FR-010) and records `riviera.jobs.duration` (001/FR-016). The queue records
// `riviera.jobs.runs` and `riviera.jobs.failures` with each outcome, so the runner doesn't.
//
// The attempt's span ends (and is queued for export) before its outcome and context are stored
// by `complete`/`fail`: a crash between the two leaves no stored parent that never reaches
// Tempo, and the next attempt starts a new root instead (R13).

import {
  context,
  isValidSpanId,
  isValidTraceId,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Link,
  type Span,
  type SpanContext,
} from "@opentelemetry/api";
import type { Instruments } from "@riviera/telemetry/instruments";
import type { FastifyBaseLogger } from "fastify";
import { setTimeout as sleep } from "node:timers/promises";
import {
  JOB_NAMES,
  parsePayload,
  traceparentOf,
  type ClaimedJob,
  type JobName,
  type JobPayload,
  type Queue,
} from "./queue.ts";

interface JobRun {
  readonly id: string;
  readonly attempt: number;
  /** Carries `job_id`, `job_name`, `attempt` and `staff_id`, and the run's trace context. */
  readonly log: FastifyBaseLogger;
}

/** Runs one attempt; throwing (or rejecting) fails it. */
export type JobHandler<N extends JobName> = (payload: JobPayload<N>, run: JobRun) => Promise<void>;

type JobHandlers = { readonly [N in JobName]: JobHandler<N> };

interface SignalSource {
  once(event: "SIGTERM", listener: () => void): unknown;
}

export interface RunnerOptions {
  readonly queue: Pick<Queue, "claim" | "heartbeat" | "complete" | "fail">;
  readonly handlers: JobHandlers;
  readonly instruments: Pick<Instruments, "record">;
  readonly log: FastifyBaseLogger;
  /** Wait after an empty claim; default 500 ms. */
  readonly idleMs?: number;
  /** Lease heartbeat while a job runs; default 30 s. */
  readonly heartbeatMs?: number;
  /** SIGTERM stops the runner after the running attempt. */
  readonly signals?: SignalSource;
  /** Milliseconds; defaults to `performance.now`. */
  readonly now?: () => number;
}

export interface Runner {
  /** Claims and runs at most one job; false when none was due. */
  runOnce(): Promise<boolean>;
  /** Starts the poll loop; calling it again does nothing. */
  start(): void;
  /** Stops polling and resolves once every running attempt (poll loop or `runOnce`) has finished. */
  stop(): Promise<void>;
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

/** A stored W3C `traceparent` as a remote span context; undefined when absent or invalid. */
function spanContextOf(traceparent: string | null): SpanContext | undefined {
  const match = TRACEPARENT.exec(traceparent ?? "");
  const [, traceId = "", spanId = "", flags = "00"] = match ?? [];
  if (match === null || !isValidTraceId(traceId) || !isValidSpanId(spanId)) {
    return undefined;
  }
  return { traceId, spanId, traceFlags: Number.parseInt(flags, 16), isRemote: true };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function dispatch<N extends JobName>(
  handler: JobHandler<N>,
  name: N,
  payload: unknown,
  run: JobRun,
): Promise<void> {
  await handler(parsePayload(name, payload), run);
}

export function createRunner(options: RunnerOptions): Runner {
  const { queue, handlers, instruments, log } = options;
  const idleMs = options.idleMs ?? 500;
  const heartbeatMs = options.heartbeatMs ?? 30_000;
  const now = options.now ?? (() => performance.now());
  const tracer = trace.getTracer("@riviera/api");
  const idle = new AbortController();
  let loop: Promise<void> | undefined;
  let stopping = false;
  // Attempts still running, from the poll loop or a direct `runOnce()`; `stop()` waits for them.
  const running = new Set<Promise<void>>();

  const attempt = async (job: ClaimedJob): Promise<void> => {
    const origin = spanContextOf(job.originTraceparent);
    const parent = spanContextOf(job.traceParent);
    const links: Link[] = origin === undefined ? [] : [{ context: origin }];
    const attributes: Attributes = {
      "riviera.job.name": job.name,
      "riviera.job.id": job.id,
      "riviera.job.attempt": job.attempt,
      ...(job.staffId === null ? {} : { "riviera.staff_id": job.staffId }),
    };
    // Attempt 1, or any attempt after a crashed one: a new root. Later: a child of the first.
    const parentContext =
      parent === undefined ? ROOT_CONTEXT : trace.setSpanContext(ROOT_CONTEXT, parent);
    const span: Span = tracer.startSpan(
      `job.run ${job.name}`,
      { kind: SpanKind.CONSUMER, attributes, links, root: parent === undefined },
      parentContext,
    );
    const runLog = log.child({
      job_id: job.id,
      job_name: job.name,
      attempt: job.attempt,
      ...(job.staffId === null ? {} : { staff_id: job.staffId }),
    });
    // The heartbeat in flight, if any; awaited before the outcome is stored, so a heartbeat that
    // lands after `complete`/`fail` can't report a lease lost for an attempt that finished. A tick
    // that comes while one is still in flight (a slow database) is skipped, so there is never more
    // than one and awaiting `beating` covers them all.
    let beating: Promise<void> | undefined;
    const heartbeat = setInterval(() => {
      beating ??= queue
        .heartbeat(job.id, job.attempt)
        .then(
          (owned) => {
            if (!owned) {
              runLog.warn("job lease lost");
            }
          },
          (error: unknown) => {
            runLog.warn({ error: errorMessage(error) }, "job heartbeat failed");
          },
        )
        .finally(() => {
          beating = undefined;
        });
    }, heartbeatMs);
    const started = now();
    let failure: { error: unknown } | undefined;
    try {
      await context.with(trace.setSpan(ROOT_CONTEXT, span), () =>
        dispatch(handlers[job.name], job.name, job.payload, {
          id: job.id,
          attempt: job.attempt,
          log: runLog,
        }),
      );
    } catch (error) {
      failure = { error };
    } finally {
      clearInterval(heartbeat);
    }
    const seconds = (now() - started) / 1000;
    await beating;
    const outcome = failure === undefined ? "succeeded" : "failed";
    span.setAttribute("riviera.job.outcome", outcome);
    if (failure !== undefined) {
      span.recordException(
        failure.error instanceof Error ? failure.error : errorMessage(failure.error),
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    span.end();
    instruments.record("riviera.jobs.duration", seconds, { job_name: job.name, outcome });
    const traceParent = traceparentOf(span);
    const logContext = trace.setSpan(ROOT_CONTEXT, span);
    if (failure === undefined) {
      const owned = await queue.complete(job.id, job.attempt, traceParent);
      context.with(logContext, () => {
        if (owned) {
          runLog.info({ duration_s: seconds }, "job succeeded");
        } else {
          runLog.warn({ duration_s: seconds }, "job succeeded after its lease was lost");
        }
      });
      return;
    }
    const { error } = failure;
    const next = await queue.fail(job.id, job.attempt, error, traceParent);
    context.with(logContext, () => {
      runLog.error({ duration_s: seconds, next, error: errorMessage(error) }, "job attempt failed");
    });
  };

  const runOnce = async (): Promise<boolean> => {
    const job = await queue.claim();
    if (job === undefined) {
      return false;
    }
    const run = attempt(job);
    running.add(run);
    try {
      await run;
    } finally {
      running.delete(run);
    }
    return true;
  };

  const poll = async (): Promise<void> => {
    while (!stopping) {
      let worked = false;
      try {
        worked = await runOnce();
      } catch (error) {
        log.error({ error: errorMessage(error) }, "job runner poll failed");
      }
      // Returns at once when stop() has aborted the idle wait.
      if (!worked) {
        await sleep(idleMs, undefined, { signal: idle.signal }).catch(() => undefined);
      }
    }
  };

  const stop = async (): Promise<void> => {
    stopping = true;
    idle.abort();
    await loop;
    await Promise.allSettled(running);
  };

  options.signals?.once("SIGTERM", () => void stop());

  return {
    runOnce,
    start() {
      if (!stopping) {
        loop ??= poll();
      }
    },
    stop,
  };
}

/**
 * Registers `riviera.queue.depth` (api and worker both call this): queued rows per registered
 * job name, 0 for a name with none, so the series drops back once its queue drains. Returns a
 * function that stops reporting.
 */
export function registerQueueDepth(
  instruments: Pick<Instruments, "observe">,
  queue: Pick<Queue, "queuedCounts">,
): () => void {
  return instruments.observe("riviera.queue.depth", async (report) => {
    // Nothing is reported when the database can't be read, rather than a made-up 0.
    const counts = await queue.queuedCounts().catch(() => undefined);
    if (counts === undefined) {
      return;
    }
    for (const name of JOB_NAMES) {
      report(counts.get(name) ?? 0, { job_name: name });
    }
  });
}
