import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadMigrations } from "../src/migrate.ts";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true })));
});

async function dirWith(files: Record<string, string>): Promise<URL> {
  const dir = await mkdtemp(join(tmpdir(), "migrations-"));
  dirs.push(dir);
  await Promise.all(Object.entries(files).map(([name, sql]) => writeFile(join(dir, name), sql)));
  return pathToFileURL(`${dir}/`);
}

describe("001/FR-029: loading migrations", () => {
  it("001/FR-029: the shipped migrations start with 0001_job, each with up and down", async () => {
    const migrations = await loadMigrations();
    expect(migrations[0]).toMatchObject({ version: 1, name: "job" });
    expect(migrations[0]?.up).toContain("CREATE TABLE job");
    expect(migrations[0]?.down).toContain("DROP TABLE job");
  });

  it("001/FR-029: pairs are sorted by version", async () => {
    const dir = await dirWith({
      "0010_b.up.sql": "b",
      "0010_b.down.sql": "-b",
      "0002_a.up.sql": "a",
      "0002_a.down.sql": "-a",
    });
    expect(await loadMigrations(dir)).toEqual([
      { version: 2, name: "a", up: "a", down: "-a" },
      { version: 10, name: "b", up: "b", down: "-b" },
    ]);
  });

  it("001/FR-029: rejects a file that is not NNNN_name.up|down.sql", async () => {
    const dir = await dirWith({ "1_job.sql": "" });
    await expect(loadMigrations(dir)).rejects.toThrow("Unexpected file in migrations: 1_job.sql");
  });

  it("001/FR-029: rejects a version used by two names", async () => {
    const dir = await dirWith({ "0001_a.up.sql": "", "0001_b.down.sql": "" });
    await expect(loadMigrations(dir)).rejects.toThrow('version 0001 is used by "a" and "b"');
  });

  it("001/FR-029: rejects a migration without its down or up half", async () => {
    await expect(loadMigrations(await dirWith({ "0001_a.up.sql": "" }))).rejects.toThrow(
      "Migration 1_a has no .down.sql",
    );
    await expect(loadMigrations(await dirWith({ "0001_a.down.sql": "" }))).rejects.toThrow(
      "Migration 1_a has no .up.sql",
    );
  });
});
