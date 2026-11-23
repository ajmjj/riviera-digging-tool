import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: string;
  readonly down: string;
}

/** `apps/api/migrations`, next to `src/` in the repository and in the image. */
export const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

// Any fixed key works; it only has to differ from other advisory locks the app takes.
const LOCK_KEY = 7_310_001;
const FILE_NAME = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;

/**
 * Reads `NNNN_name.up.sql` / `NNNN_name.down.sql` pairs, sorted by version. Throws on a
 * file that doesn't match the pattern, a missing half of a pair or a reused version.
 */
export async function loadMigrations(dir: URL = MIGRATIONS_DIR): Promise<Migration[]> {
  const halves = new Map<number, { name: string; up?: string; down?: string }>();
  for (const file of (await readdir(dir)).sort()) {
    const match = FILE_NAME.exec(file);
    if (match === null) {
      throw new Error(`Unexpected file in migrations: ${file}`);
    }
    const [, versionText = "", name = "", direction] = match;
    const version = Number(versionText);
    const entry = halves.get(version) ?? { name };
    if (entry.name !== name) {
      throw new Error(`Migration version ${versionText} is used by "${entry.name}" and "${name}"`);
    }
    const sql = await readFile(new URL(file, dir), "utf8");
    if (direction === "up") {
      entry.up = sql;
    } else {
      entry.down = sql;
    }
    halves.set(version, entry);
  }
  return [...halves.entries()]
    .sort(([a], [b]) => a - b)
    .map(([version, { name, up, down }]) => {
      if (up === undefined || down === undefined) {
        const missing = up === undefined ? "up" : "down";
        throw new Error(`Migration ${String(version)}_${name} has no .${missing}.sql`);
      }
      return { version, name, up, down };
    });
}

async function withLock<T>(
  connectionString: string,
  work: (client: pg.Client, applied: ReadonlySet<number>) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Session-level lock: a second api or worker starting at the same time waits here.
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migration (
         version integer PRIMARY KEY,
         name text NOT NULL,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const rows = await client.query<{ version: number }>("SELECT version FROM schema_migration");
    return await work(client, new Set(rows.rows.map((row) => row.version)));
  } finally {
    await client.end();
  }
}

async function inTransaction(
  client: pg.Client,
  label: string,
  sql: string,
  record: () => Promise<unknown>,
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await record();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`Migration ${label} failed`, { cause: error });
  }
}

/** Applies every migration not yet recorded, in order, one transaction each. Returns their versions. */
export async function migrateUp(
  connectionString: string,
  migrations: readonly Migration[],
): Promise<number[]> {
  return withLock(connectionString, async (client, applied) => {
    const done: number[] = [];
    for (const m of migrations) {
      if (applied.has(m.version)) {
        continue;
      }
      await inTransaction(client, `${String(m.version)}_${m.name} up`, m.up, () =>
        client.query("INSERT INTO schema_migration (version, name) VALUES ($1, $2)", [
          m.version,
          m.name,
        ]),
      );
      done.push(m.version);
    }
    return done;
  });
}

/** Reverts every applied migration newest first, down to (not including) `toVersion`. */
export async function migrateDown(
  connectionString: string,
  migrations: readonly Migration[],
  toVersion = 0,
): Promise<number[]> {
  return withLock(connectionString, async (client, applied) => {
    const done: number[] = [];
    for (const m of [...migrations].reverse()) {
      if (m.version <= toVersion || !applied.has(m.version)) {
        continue;
      }
      await inTransaction(client, `${String(m.version)}_${m.name} down`, m.down, () =>
        client.query("DELETE FROM schema_migration WHERE version = $1", [m.version]),
      );
      done.push(m.version);
    }
    return done;
  });
}
