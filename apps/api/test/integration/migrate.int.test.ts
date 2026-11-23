import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadMigrations, migrateDown, migrateUp, type Migration } from "../../src/migrate.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

let db: FreshDatabase;
let shipped: Migration[];

beforeEach(async () => {
  db = await freshDatabase();
  shipped = await loadMigrations();
});

afterEach(async () => {
  await db.drop();
});

async function tables(): Promise<string[]> {
  const res = await db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
  );
  return res.rows.map((row) => row.table_name);
}

async function versions(): Promise<number[]> {
  const res = await db.query<{ version: number }>(
    "SELECT version FROM schema_migration ORDER BY version",
  );
  return res.rows.map((row) => row.version);
}

const sqlState = (error: unknown): unknown =>
  error instanceof Error && "code" in error ? error.code : undefined;

async function insertJob(columns: Record<string, unknown>): Promise<unknown> {
  const names = ["name", ...Object.keys(columns)];
  const values = ["sample.discogs_release", ...Object.values(columns)];
  const placeholders = values.map((_, i) => `$${String(i + 1)}`).join(", ");
  try {
    await db.query(`INSERT INTO job (${names.join(", ")}) VALUES (${placeholders})`, values);
    return "inserted";
  } catch (error) {
    return sqlState(error);
  }
}

describe("001/FR-029: migration runner (real Postgres)", () => {
  it("001/FR-029: every migration runs up, down and up again", async () => {
    const all = shipped.map((m) => m.version);
    expect(await migrateUp(db.url, shipped)).toEqual(all);
    expect(await tables()).toEqual(["job", "schema_migration"]);
    expect(await versions()).toEqual(all);

    expect(await migrateDown(db.url, shipped)).toEqual([...all].reverse());
    expect(await tables()).toEqual(["schema_migration"]);
    expect(await versions()).toEqual([]);

    expect(await migrateUp(db.url, shipped)).toEqual(all);
    expect(await tables()).toEqual(["job", "schema_migration"]);
  });

  it("001/FR-029: a second run applies nothing", async () => {
    await migrateUp(db.url, shipped);
    expect(await migrateUp(db.url, shipped)).toEqual([]);
  });

  it("001/FR-029: concurrent runs don't conflict and apply each migration once", async () => {
    const runs = await Promise.all([1, 2, 3, 4].map(() => migrateUp(db.url, shipped)));
    expect(runs.flat().sort()).toEqual(shipped.map((m) => m.version));
    expect(await versions()).toEqual(shipped.map((m) => m.version));
  });

  it("001/FR-029: migrateDown stops at the given version", async () => {
    const extra: Migration = {
      version: 2,
      name: "extra",
      up: "CREATE TABLE extra (id int)",
      down: "DROP TABLE extra",
    };
    const set = [...shipped, extra];
    await migrateUp(db.url, set);
    expect(await migrateDown(db.url, set, 1)).toEqual([2]);
    expect(await tables()).toEqual(["job", "schema_migration"]);
  });

  it("001/FR-029: a failing migration is rolled back and not recorded", async () => {
    const broken: Migration = {
      version: 2,
      name: "broken",
      up: "CREATE TABLE half (id int); SELECT no_such_function()",
      down: "",
    };
    await expect(migrateUp(db.url, [...shipped, broken])).rejects.toThrow(
      "Migration 2_broken up failed",
    );
    expect(await tables()).toEqual(["job", "schema_migration"]);
    expect(await versions()).toEqual([1]);
  });

  it("001/FR-029: a failed ROLLBACK still reports the migration that failed", async () => {
    // Ending its own connection makes the migration fail and the ROLLBACK after it fail too.
    const lost: Migration = {
      version: 2,
      name: "lost",
      up: "SELECT pg_terminate_backend(pg_backend_pid())",
      down: "",
    };
    const run = migrateUp(db.url, [...shipped, lost]);
    await expect(run).rejects.toThrow("Migration 2_lost up failed");
    await expect(run).rejects.toHaveProperty("cause.code", "57P01");
    expect(await versions()).toEqual([1]);
  });

  it("001/FR-029: refuses to start when the database has versions not on disk", async () => {
    const newer: Migration = {
      version: 2,
      name: "newer",
      up: "CREATE TABLE newer (id int)",
      down: "DROP TABLE newer",
    };
    await migrateUp(db.url, [...shipped, newer]);
    await expect(migrateUp(db.url, shipped)).rejects.toThrow(
      "schema_migration has versions not on disk: 2",
    );
    expect(await versions()).toEqual([1, 2]);
  });

  it("001/FR-029: a migration directory on disk runs end to end", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrations-"));
    try {
      await writeFile(join(dir, "0001_t.up.sql"), "CREATE TABLE t (id int)");
      await writeFile(join(dir, "0001_t.down.sql"), "DROP TABLE t");
      const fromDisk = await loadMigrations(pathToFileURL(`${dir}/`));
      expect(await migrateUp(db.url, fromDisk)).toEqual([1]);
      expect(await tables()).toEqual(["schema_migration", "t"]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe("001/FR-029: job table (0001_job)", () => {
  beforeEach(async () => {
    await migrateUp(db.url, shipped);
  });

  it("001/FR-029: a minimal row gets the documented defaults", async () => {
    await db.query("INSERT INTO job (name) VALUES ('sample.discogs_release')");
    const res = await db.query("SELECT * FROM job");
    expect(res.rows[0]).toMatchObject({
      payload: {},
      status: "queued",
      attempt: 0,
      max_attempts: 3,
      locked_until: null,
      origin_traceparent: null,
      trace_parent: null,
      staff_id: null,
      last_error: null,
      started_at: null,
      finished_at: null,
    });
    expect(res.rows[0]).toHaveProperty("id", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(Object.keys(res.rows[0] ?? {}).sort()).toEqual(
      [
        "attempt",
        "created_at",
        "finished_at",
        "id",
        "last_error",
        "locked_until",
        "max_attempts",
        "name",
        "origin_traceparent",
        "payload",
        "run_after",
        "staff_id",
        "started_at",
        "status",
        "trace_parent",
        "updated_at",
      ].sort(),
    );
  });

  it("001/FR-029: CHECK rejects an unknown status", async () => {
    for (const status of ["queued", "running", "succeeded", "failed"]) {
      expect(await insertJob({ status })).toBe("inserted");
    }
    expect(await insertJob({ status: "done" })).toBe("23514");
  });

  it("001/FR-029: CHECK rejects max_attempts below 1", async () => {
    expect(await insertJob({ max_attempts: 1 })).toBe("inserted");
    expect(await insertJob({ max_attempts: 0 })).toBe("23514");
  });

  it("001/FR-029: CHECK rejects an email-shaped or over-long staff_id", async () => {
    expect(await insertJob({ staff_id: "staff_test_0001" })).toBe("inserted");
    expect(await insertJob({ staff_id: "antn@example.com" })).toBe("23514");
    expect(await insertJob({ staff_id: "" })).toBe("23514");
    expect(await insertJob({ staff_id: "a".repeat(65) })).toBe("23514");
  });

  it("001/FR-029: CHECK rejects a malformed job name", async () => {
    const res = await db
      .query("INSERT INTO job (name) VALUES ('Sample job')")
      .then(() => "inserted", sqlState);
    expect(res).toBe("23514");
  });

  it("001/FR-029: the partial claim index covers queued and running rows", async () => {
    const res = await db.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname = 'job_claimable_idx'",
    );
    expect(res.rows[0]).toHaveProperty(
      "indexdef",
      expect.stringMatching(
        /ON public\.job USING btree \(run_after, created_at\) WHERE \(status = ANY \(ARRAY\['queued'::text, 'running'::text\]\)\)/,
      ),
    );
  });
});
