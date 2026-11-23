// Requirement traceability (constitution, Principle III): every FR in specs/**/spec.md is
// named by a test as NNN/FR-###, and every test reference points at a real FR.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { traceRequirements, type SourceFile } from "./lib/fr-trace.ts";
import { summary } from "./io.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", "reports", ".stryker-tmp"]);

function walk(dir: string, keep: (path: string) => boolean, out: SourceFile[] = []): SourceFile[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = dir === "." ? entry.name : join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(path, keep, out);
      }
    } else if (keep(path)) {
      out.push({ path, content: readFileSync(path, "utf8") });
    }
  }
  return out;
}

const specs = walk("specs", (p) => p.endsWith("/spec.md"));
const tests = walk(".", (p) => /\.(?:test|spec)\.ts$/.test(p));
const result = traceRequirements(specs, tests);

console.log(
  `FR traceability: ${String(result.requirements)} requirement(s) in ${String(result.specs)} spec(s), ${String(tests.length)} test file(s).`,
);
if (result.specs === 0) {
  console.log("No specs yet: nothing to trace. This check passes trivially until 001 exists.");
}

const sections: [string, readonly string[]][] = [
  ["Requirements with no test", result.untested],
  ["Tests naming a requirement that does not exist", result.unknown],
  ["FR references without the NNN/ feature prefix (write 002/FR-012)", result.unqualified],
];
let failed = false;
for (const [title, items] of sections) {
  if (items.length > 0) {
    failed = true;
    console.log(`${title}:`);
    for (const item of items) {
      console.log(`  ${item}`);
    }
  }
}
summary(`**FR traceability:** ${failed ? "failed" : "ok"} (${String(result.requirements)} FRs)`);
process.exit(failed ? 1 : 0);
