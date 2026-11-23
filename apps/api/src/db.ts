import { SpanKind, SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import pg from "pg";

/** What a query returns. Rows are unknown: callers narrow them with a type guard. */
export interface QueryResult {
  readonly rows: readonly unknown[];
  readonly rowCount: number | null;
}

export interface Database {
  /**
   * Runs `text` with `params`. Under an active span (a request or a job) it records a CLIENT
   * span `db {operation}`; without one it records nothing (001/FR-008). `summary` names the
   * statement (e.g. `sample.count_jobs`) and is the only part of the query that is recorded:
   * never the text with values, never the parameters.
   */
  query(summary: string, text: string, params?: readonly unknown[]): Promise<QueryResult>;
  /** Resolves when the database answers a trivial query, rejects otherwise. No span. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

/** The part of `pg.Pool` the wrapper uses, so unit tests can pass a fake. */
export interface Pool {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
  end(): Promise<void>;
}

const TRACER = "@riviera/api/db";
const SUMMARY = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const MAX_SUMMARY = 64;
const OPERATIONS = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "WITH",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "LOCK",
]);

/**
 * The statement's leading keyword, from a closed set (`OTHER` otherwise), so span names and
 * attributes stay bounded. Leading whitespace and SQL comments are skipped.
 */
export function operationOf(text: string): string {
  const stripped = text.replace(/^(\s+|--[^\n]*(\n|$)|\/\*[\s\S]*?\*\/)*/, "");
  const keyword = /^[A-Za-z]+/.exec(stripped)?.[0].toUpperCase() ?? "";
  return OPERATIONS.has(keyword) ? keyword : "OTHER";
}

function errorType(error: unknown): string {
  // A Postgres SQLSTATE such as `42P01`; never the message, which can quote values.
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    if (/^[0-9A-Z]{5}$/.test(error.code)) return error.code;
  }
  return error instanceof Error ? error.name : "Error";
}

async function traced(span: Span, run: () => Promise<QueryResult>): Promise<QueryResult> {
  try {
    return await run();
  } catch (error) {
    span.setAttribute("error.type", errorType(error));
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}

export function databaseFromPool(pool: Pool): Database {
  return {
    query(summary, text, params = []) {
      if (summary.length > MAX_SUMMARY || !SUMMARY.test(summary)) {
        return Promise.reject(new Error("db query summary must be a dotted snake_case name"));
      }
      const values = [...params];
      if (trace.getActiveSpan() === undefined) return pool.query(text, values);
      const operation = operationOf(text);
      const span = trace.getTracer(TRACER).startSpan(`db ${operation}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          "db.system.name": "postgresql",
          "db.operation.name": operation,
          "db.query.summary": summary,
        },
      });
      return traced(span, () => pool.query(text, values));
    },
    async ping() {
      await pool.query("SELECT 1");
    },
    close() {
      return pool.end();
    },
  };
}

export function createDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 2_000 });
  // An idle client error must not crash the process; readiness reports it instead.
  pool.on("error", () => undefined);
  return databaseFromPool(pool);
}
