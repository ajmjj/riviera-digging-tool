import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { startTestTelemetry, type TestTelemetry } from "@riviera/telemetry/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databaseFromPool, operationOf, type Pool, type QueryResult } from "../src/db.ts";

interface Call {
  readonly text: string;
  readonly values: unknown[] | undefined;
}

/** A fake pool that records calls and answers with `result`, or rejects with `failure`. */
function fakePool(failure?: Error): Pool & { calls: Call[]; ended: boolean } {
  const result: QueryResult = { rows: [{ n: 1 }], rowCount: 1 };
  const calls: Call[] = [];
  const pool = {
    calls,
    ended: false,
    query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return failure === undefined ? Promise.resolve(result) : Promise.reject(failure);
    },
    end() {
      pool.ended = true;
      return Promise.resolve();
    },
  };
  return pool;
}

/** Runs `work` inside an active `parent` span, then ends it. */
async function underParent<T>(work: () => Promise<T>): Promise<T> {
  return trace.getTracer("test").startActiveSpan("parent", async (parent) => {
    try {
      return await work();
    } finally {
      parent.end();
    }
  });
}

let telemetry: TestTelemetry;
beforeEach(() => {
  telemetry = startTestTelemetry();
});
afterEach(async () => {
  await telemetry.shutdown();
});

describe("db query spans", () => {
  it("001/FR-008: a query under an active span records a CLIENT child span `db {operation}`", async () => {
    const pool = fakePool();
    const db = databaseFromPool(pool);
    const result = await underParent(() =>
      db.query("sample.count_jobs", "SELECT count(*) FROM job WHERE name = $1", ["secret-name"]),
    );

    expect(result.rows).toEqual([{ n: 1 }]);
    expect(pool.calls).toEqual([
      { text: "SELECT count(*) FROM job WHERE name = $1", values: ["secret-name"] },
    ]);
    const spans = await telemetry.spans();
    const parent = spans.find((s) => s.name === "parent");
    const span = spans.find((s) => s.name === "db SELECT");
    expect(span?.kind).toBe(SpanKind.CLIENT);
    expect(span?.parentSpanContext?.spanId).toBe(parent?.spanContext().spanId);
    expect(span?.spanContext().traceId).toBe(parent?.spanContext().traceId);
    expect(span?.attributes).toEqual({
      "db.system.name": "postgresql",
      "db.operation.name": "SELECT",
      "db.query.summary": "sample.count_jobs",
    });
    expect(span?.status.code).not.toBe(SpanStatusCode.ERROR);
  });

  it("001/FR-008: parameter values and the query text are never recorded", async () => {
    const db = databaseFromPool(fakePool());
    await underParent(() =>
      db.query("staff.by_email", "SELECT id FROM staff WHERE email = $1", ["ann@example.com"]),
    );
    const exported = JSON.stringify(await telemetry.spans());
    expect(exported).not.toContain("ann@example.com");
    expect(exported).not.toContain("WHERE email");
  });

  it("001/FR-008: without an active span a query records no span", async () => {
    const pool = fakePool();
    const db = databaseFromPool(pool);
    await db.query("sample.count_jobs", "SELECT 1");
    await db.ping();
    expect(pool.calls).toEqual([
      { text: "SELECT 1", values: [] },
      { text: "SELECT 1", values: undefined },
    ]);
    expect(await telemetry.spans()).toEqual([]);
  });

  it("001/FR-008: ping records no span even under an active span", async () => {
    const db = databaseFromPool(fakePool());
    await underParent(() => db.ping());
    expect((await telemetry.spans()).map((s) => s.name)).toEqual(["parent"]);
  });

  it("001/FR-008: a failed query marks its span ERROR with the SQLSTATE, not the message", async () => {
    const failure = Object.assign(new Error('invalid input syntax for type integer: "ann"'), {
      code: "22P02",
    });
    const db = databaseFromPool(fakePool(failure));
    await expect(
      underParent(() => db.query("sample.bad", "UPDATE job SET n = $1", ["ann"])),
    ).rejects.toBe(failure);

    const spans = await telemetry.spans();
    const span = spans.find((s) => s.name === "db UPDATE");
    expect(span?.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span?.attributes["error.type"]).toBe("22P02");
    expect(span?.events).toEqual([]);
    expect(JSON.stringify(spans)).not.toContain("invalid input syntax");
  });

  it("001/FR-008: a failure without a SQLSTATE records the error name", async () => {
    const db = databaseFromPool(fakePool(new TypeError("boom")));
    await expect(underParent(() => db.query("sample.x", "DELETE FROM job"))).rejects.toThrow(
      "boom",
    );
    const db2 = databaseFromPool(
      fakePool(Object.assign(new RangeError("x"), { code: "not a sqlstate" })),
    );
    await expect(
      underParent(() => db2.query("sample.y", "INSERT INTO job DEFAULT VALUES")),
    ).rejects.toThrow(RangeError);

    const types = (await telemetry.spans())
      .filter((s) => s.name.startsWith("db "))
      .map((s) => [s.name, s.attributes["error.type"]]);
    expect(types).toEqual([
      ["db DELETE", "TypeError"],
      ["db INSERT", "RangeError"],
    ]);
  });

  it("001/FR-008: a rejection that is not an Error records error.type `Error`", async () => {
    // A thenable lets the fake reject with a plain string, as a misbehaving driver could.
    const rejectsWithString = {
      then(_onFulfilled: (value: QueryResult) => void, onRejected: (reason: unknown) => void) {
        onRejected("plain");
      },
    };
    const db = databaseFromPool({
      query: async () => await rejectsWithString,
      end: () => Promise.resolve(),
    });
    await expect(underParent(() => db.query("sample.plain", "SELECT 1"))).rejects.toBe("plain");
    const span = (await telemetry.spans()).find((s) => s.name === "db SELECT");
    expect(span?.attributes["error.type"]).toBe("Error");
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it("001/FR-008: the db span is active while the query runs", async () => {
    let activeDuringQuery: string | undefined;
    const db = databaseFromPool({
      query: () => {
        activeDuringQuery = trace.getActiveSpan()?.spanContext().spanId;
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
      end: () => Promise.resolve(),
    });
    await underParent(() => db.query("sample.nested", "SELECT 1"));
    const span = (await telemetry.spans()).find((s) => s.name === "db SELECT");
    expect(activeDuringQuery).toBe(span?.spanContext().spanId);
  });

  it("001/FR-008: a summary that is not a statement name is rejected before querying", async () => {
    const pool = fakePool();
    const db = databaseFromPool(pool);
    for (const summary of [
      "",
      "Count",
      "count jobs",
      "ann@example.com",
      "a..b",
      "a.",
      "x".repeat(65),
    ]) {
      await expect(db.query(summary, "SELECT 1")).rejects.toThrow("summary");
    }
    await expect(db.query("a".repeat(64), "SELECT 1")).resolves.toBeDefined();
    expect(pool.calls).toHaveLength(1);
  });

  it("001/FR-008: close ends the pool", async () => {
    const pool = fakePool();
    await databaseFromPool(pool).close();
    expect(pool.ended).toBe(true);
  });
});

describe("operationOf", () => {
  it("001/FR-008: the operation is the leading keyword from a closed set", () => {
    expect(operationOf("select 1")).toBe("SELECT");
    expect(operationOf("  \n\tInsert INTO t VALUES (1)")).toBe("INSERT");
    expect(operationOf("-- note\n/* block\n comment */ WITH x AS (SELECT 1) SELECT * FROM x")).toBe(
      "WITH",
    );
    expect(operationOf("-- only a comment")).toBe("OTHER");
    expect(operationOf("VACUUM job")).toBe("OTHER");
    expect(operationOf("SELECTED")).toBe("OTHER");
    expect(operationOf("")).toBe("OTHER");
    for (const op of [
      "UPDATE",
      "DELETE",
      "BEGIN",
      "COMMIT",
      "ROLLBACK",
      "CREATE",
      "ALTER",
      "DROP",
      "TRUNCATE",
      "LOCK",
    ]) {
      expect(operationOf(`${op.toLowerCase()} x`)).toBe(op);
    }
  });
});
