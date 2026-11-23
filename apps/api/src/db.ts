import pg from "pg";

export interface Database {
  /** Resolves when the database answers a trivial query, rejects otherwise. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 2_000 });
  // An idle client error must not crash the process; readiness reports it instead.
  pool.on("error", () => undefined);
  return {
    async ping() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
}
