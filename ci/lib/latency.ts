// SC-006 latency comparison (research R15): the sample request's p95 with the collector stopped
// may be no higher than the larger of 110% of, or 5 ms above, its p95 with the collector running.
// The CLI is ci/latency.ts.

export const WARM_UP = 30;
export const SAMPLES = 300;

export interface LatencyDeps {
  readonly fetch: typeof fetch;
  /** Milliseconds, monotonic (performance.now). */
  readonly now: () => number;
}

/** Nearest-rank 95th percentile, in the samples' unit. */
export function p95(samples: readonly number[]): number {
  if (samples.length === 0) {
    throw new Error("p95 of no samples");
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return Number(sorted[Math.ceil(0.95 * sorted.length) - 1]);
}

/** The largest p95 (ms) allowed with the collector stopped, given the baseline p95. */
export function allowedP95(baselineMs: number): number {
  return Math.max(1.1 * baselineMs, baselineMs + 5);
}

export function compare(baselineMs: number, downMs: number): { ok: boolean; message: string } {
  const allowed = allowedP95(baselineMs);
  const ok = downMs <= allowed;
  const fmt = (ms: number) => `${ms.toFixed(1)} ms`;
  return {
    ok,
    message:
      `p95 with the collector stopped ${fmt(downMs)}, baseline ${fmt(baselineMs)}, ` +
      `allowed ${fmt(allowed)} (max of 110% and +5 ms): ${ok ? "PASS" : "FAIL"}`,
  };
}

/**
 * Sends WARM_UP then SAMPLES sequential `POST /api/sample/trace` requests and returns the
 * durations (ms) of the SAMPLES. Any answer other than 202 fails, since the latency of an
 * error says nothing about SC-006.
 */
export async function measure(baseUrl: string, deps: LatencyDeps): Promise<number[]> {
  const url = new URL("/api/sample/trace", baseUrl).href;
  const durations: number[] = [];
  for (let i = 0; i < WARM_UP + SAMPLES; i += 1) {
    const start = deps.now();
    const res = await deps.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    await res.arrayBuffer();
    const elapsed = deps.now() - start;
    if (res.status !== 202) {
      throw new Error(`${url} answered HTTP ${String(res.status)} on request ${String(i + 1)}`);
    }
    if (i >= WARM_UP) {
      durations.push(elapsed);
    }
  }
  return durations;
}
