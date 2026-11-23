import { matchesGlob } from "node:path";

interface AddedLine {
  readonly line: number;
  readonly text: string;
}

export interface FileDiff {
  readonly file: string;
  readonly added: readonly AddedLine[];
  readonly deleted: boolean;
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parses `git diff` / `gh pr diff` unified output into the lines each file adds, numbered
 * as in the new version. Renames report the new path. Deleted files report no lines.
 */
export function parseUnifiedDiff(diff: string): FileDiff[] {
  const files: { file: string; added: AddedLine[]; deleted: boolean }[] = [];
  let current: { file: string; added: AddedLine[]; deleted: boolean } | undefined;
  let next = 0;
  let inHunk = false;

  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      const match = / b\/(.+)$/.exec(raw);
      current = { file: match?.[1] ?? "", added: [], deleted: false };
      files.push(current);
      inHunk = false;
      continue;
    }
    if (current === undefined) {
      continue;
    }
    if (!inHunk) {
      if (raw.startsWith("+++ ")) {
        if (raw === "+++ /dev/null") {
          current.deleted = true;
        } else if (raw.startsWith("+++ b/")) {
          current.file = raw.slice("+++ b/".length);
        }
        continue;
      }
      if (raw.startsWith("deleted file mode")) {
        current.deleted = true;
        continue;
      }
    }
    const hunk = HUNK.exec(raw);
    if (hunk !== null) {
      next = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) {
      continue;
    }
    if (raw.startsWith("+")) {
      current.added.push({ line: next, text: raw.slice(1) });
      next += 1;
    } else if (raw.startsWith(" ")) {
      next += 1;
    }
    // "-" lines and "\ No newline at end of file" do not advance the new-file counter.
  }
  return files;
}

export function matchesAny(file: string, globs: readonly string[]): boolean {
  return globs.some((glob) => matchesGlob(file, glob));
}
