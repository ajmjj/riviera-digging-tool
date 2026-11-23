import { relative } from "node:path";
import { matchesAny, type FileDiff } from "./diff.ts";

/** file (repo-relative) → line → hit count, from an lcov report. */
export type LineHits = Map<string, Map<number, number>>;

export function parseLcov(lcov: string, repoRoot: string): LineHits {
  const result: LineHits = new Map();
  let current: Map<number, number> | undefined;
  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      const path = line.slice(3).trim();
      const rel = path.startsWith("/") ? relative(repoRoot, path) : path;
      current = new Map();
      result.set(rel, current);
    } else if (line.startsWith("DA:") && current !== undefined) {
      const [lineNo, hits] = line.slice(3).split(",");
      current.set(Number(lineNo), Number(hits));
    } else if (line === "end_of_record") {
      current = undefined;
    }
  }
  return result;
}

export interface Scope {
  readonly source: readonly string[];
  readonly domain: readonly string[];
  readonly entrypoints: readonly string[];
  readonly generated: readonly string[];
  readonly typeOnly: readonly string[];
}

export interface Bucket {
  covered: number;
  total: number;
  readonly uncovered: string[];
}

export interface DiffCoverage {
  readonly domain: Bucket;
  readonly other: Bucket;
  /** Changed source files with no coverage data at all (never loaded by any test). */
  readonly unmeasured: readonly string[];
}

/**
 * Coverage of the lines a PR adds or changes. Only executable lines count (lines in the
 * lcov report); comments and blank lines are ignored. A changed source file that no test
 * loads at all counts every changed line as uncovered.
 */
export function diffCoverage(
  diff: readonly FileDiff[],
  hits: LineHits,
  scope: Scope,
): DiffCoverage {
  const domain: Bucket = { covered: 0, total: 0, uncovered: [] };
  const other: Bucket = { covered: 0, total: 0, uncovered: [] };
  const unmeasured: string[] = [];
  const excluded = [...scope.entrypoints, ...scope.generated, ...scope.typeOnly];

  for (const file of diff) {
    if (file.deleted || !matchesAny(file.file, scope.source) || matchesAny(file.file, excluded)) {
      continue;
    }
    const bucket = matchesAny(file.file, scope.domain) ? domain : other;
    const fileHits = hits.get(file.file);
    if (fileHits === undefined) {
      if (file.added.length > 0) {
        unmeasured.push(file.file);
        bucket.total += file.added.length;
        bucket.uncovered.push(...file.added.map((a) => `${file.file}:${String(a.line)}`));
      }
      continue;
    }
    for (const added of file.added) {
      const count = fileHits.get(added.line);
      if (count === undefined) {
        continue;
      }
      bucket.total += 1;
      if (count > 0) {
        bucket.covered += 1;
      } else {
        bucket.uncovered.push(`${file.file}:${String(added.line)}`);
      }
    }
  }
  return { domain, other, unmeasured };
}

/** Percentage covered, where an empty bucket counts as 100%. */
export function percent(bucket: Bucket): number {
  return bucket.total === 0 ? 100 : (bucket.covered / bucket.total) * 100;
}
