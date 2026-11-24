import { describe, expect, it } from "vitest";
import { SAMPLES, WARM_UP, allowedP95, compare, measure, p95 } from "../lib/latency.ts";

describe("SC-006 latency rule (001/FR-020, research R15)", () => {
  it("001/FR-020: p95 is the nearest-rank 95th percentile", () => {
    const hundred = Array.from({ length: 100 }, (_, i) => 100 - i);
    expect(p95(hundred)).toBe(95);
    expect(p95([7])).toBe(7);
    expect(p95([3, 1, 2])).toBe(3);
    expect(() => p95([])).toThrow("no samples");
  });

  it("001/FR-020: allows the larger of 110% of the baseline and baseline + 5 ms", () => {
    expect(allowedP95(10)).toBe(15); // +5 ms wins for a fast request
    expect(allowedP95(100)).toBeCloseTo(110); // 110% wins above 50 ms
    expect(allowedP95(50)).toBeCloseTo(55); // both give the same
  });

  it("001/FR-020: passes at the limit and fails just above it", () => {
    expect(compare(10, 15).ok).toBe(true);
    expect(compare(10, 15.01).ok).toBe(false);
    expect(compare(200, 220).ok).toBe(true);
    expect(compare(200, 221).ok).toBe(false);
    expect(compare(10, 4).ok).toBe(true);
  });

  it("001/FR-020: the message gives both p95s, the limit and the verdict", () => {
    expect(compare(10, 16).message).toBe(
      "p95 with the collector stopped 16.0 ms, baseline 10.0 ms, allowed 15.0 ms " +
        "(max of 110% and +5 ms): FAIL",
    );
    expect(compare(10, 12).message).toMatch(/: PASS$/);
  });
});

describe("measuring the sample request (001/FR-020, research R15)", () => {
  function fakeStack(status: (n: number) => number) {
    let clock = 0;
    let n = 0;
    const calls: { url: string; method: string | undefined }[] = [];
    const deps = {
      now: () => clock,
      fetch: (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        calls.push({ url, method: init?.method });
        n += 1;
        clock += n; // request n takes n ms
        return Promise.resolve(new Response("{}", { status: status(n) }));
      },
    };
    return { deps, calls };
  }

  it("001/FR-020: sends 30 warm-up then 300 measured sequential POSTs, keeping only the 300", async () => {
    const { deps, calls } = fakeStack(() => 202);
    const durations = await measure("http://proxy:8080", deps);
    expect(calls).toHaveLength(WARM_UP + SAMPLES);
    expect(calls.every((c) => c.url === "http://proxy:8080/api/sample/trace")).toBe(true);
    expect(calls.every((c) => c.method === "POST")).toBe(true);
    expect(durations).toHaveLength(SAMPLES);
    expect(durations[0]).toBe(WARM_UP + 1);
    expect(durations.at(-1)).toBe(WARM_UP + SAMPLES);
  });

  it("001/FR-020: fails on any answer other than 202, naming the request", async () => {
    const { deps } = fakeStack((n) => (n === 42 ? 502 : 202));
    await expect(measure("http://proxy:8080", deps)).rejects.toThrow(
      "http://proxy:8080/api/sample/trace answered HTTP 502 on request 42",
    );
  });
});
