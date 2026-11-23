import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { startTestTelemetry } from "@riviera/telemetry/testing";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db.ts";

// Runs against real Postgres: the CI `integration` job provides one, and locally
// `make test-integration` starts the compose `db` service.
const url = process.env["DATABASE_URL"];
if (url === undefined) {
  throw new Error("DATABASE_URL must be set for integration tests");
}

describe("database (real Postgres)", () => {
  it("ping succeeds against a running database", async () => {
    const db = createDatabase(url);
    try {
      await expect(db.ping()).resolves.toBeUndefined();
    } finally {
      await db.close();
    }
  });

  it("ping rejects when nothing is listening", async () => {
    const db = createDatabase("postgres://nobody:nothing@127.0.0.1:1/none");
    try {
      await expect(db.ping()).rejects.toThrow();
    } finally {
      await db.close();
    }
  });

  it("001/FR-008: a query under an active span records a child `db SELECT` span without values", async () => {
    const telemetry = startTestTelemetry();
    const db = createDatabase(url);
    try {
      const result = await trace.getTracer("test").startActiveSpan("parent", async (parent) => {
        try {
          return await db.query("test.echo", "SELECT $1::text AS v", ["ann@example.com"]);
        } finally {
          parent.end();
        }
      });
      expect(result.rows).toEqual([{ v: "ann@example.com" }]);

      const spans = await telemetry.spans();
      const parent = spans.find((s) => s.name === "parent");
      const span = spans.find((s) => s.name === "db SELECT");
      expect(span?.kind).toBe(SpanKind.CLIENT);
      expect(span?.parentSpanContext?.spanId).toBe(parent?.spanContext().spanId);
      expect(span?.attributes).toEqual({
        "db.system.name": "postgresql",
        "db.operation.name": "SELECT",
        "db.query.summary": "test.echo",
      });
      expect(JSON.stringify(spans)).not.toContain("ann@example.com");
    } finally {
      await db.close();
      await telemetry.shutdown();
    }
  });

  it("001/FR-008: a failed query marks its span ERROR with the SQLSTATE", async () => {
    const telemetry = startTestTelemetry();
    const db = createDatabase(url);
    try {
      await expect(
        trace.getTracer("test").startActiveSpan("parent", async (parent) => {
          try {
            return await db.query("test.missing", "SELECT * FROM no_such_table_t011");
          } finally {
            parent.end();
          }
        }),
      ).rejects.toThrow();
      const span = (await telemetry.spans()).find((s) => s.name === "db SELECT");
      expect(span?.status.code).toBe(SpanStatusCode.ERROR);
      expect(span?.attributes["error.type"]).toBe("42P01");
    } finally {
      await db.close();
      await telemetry.shutdown();
    }
  });

  it("001/FR-008: ping and queries without an active span record no span", async () => {
    const telemetry = startTestTelemetry();
    const db = createDatabase(url);
    try {
      await db.ping();
      await db.query("test.one", "SELECT 1");
      expect(await telemetry.spans()).toEqual([]);
    } finally {
      await db.close();
      await telemetry.shutdown();
    }
  });
});
