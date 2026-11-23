import { randomBytes } from "node:crypto";
import pg from "pg";

// Runs against real Postgres: the CI `integration` job provides one, and locally
// `make test-integration` starts a throwaway container.
const adminUrl = process.env["DATABASE_URL"];
if (adminUrl === undefined) {
  throw new Error("DATABASE_URL must be set for integration tests");
}

export interface FreshDatabase {
  readonly url: string;
  query<R extends pg.QueryResultRow = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<pg.QueryResult<R>>;
  drop(): Promise<void>;
}

async function asAdmin(sql: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Creates an empty database of its own, so tests that create and drop tables don't race
 * other test files running in parallel against the shared one.
 */
export async function freshDatabase(): Promise<FreshDatabase> {
  const name = `test_${randomBytes(6).toString("hex")}`;
  await asAdmin(`CREATE DATABASE ${name}`);
  const url = new URL(adminUrl ?? "");
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 2 });
  return {
    url: url.toString(),
    query: (sql, params = []) => pool.query(sql, [...params]),
    async drop() {
      await pool.end();
      await asAdmin(`DROP DATABASE ${name} WITH (FORCE)`);
    },
  };
}
