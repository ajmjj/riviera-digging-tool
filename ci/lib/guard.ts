import { matchesAny, type FileDiff } from "./diff.ts";

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly text: string;
}

interface Rule {
  readonly id: string;
  readonly pattern: RegExp;
}

/**
 * Patterns the suppression guard rejects in added lines (constitution, Principle II).
 * The guard's own sources and tests live under ci/, which is exempt here but protected,
 * so changing them always needs Antn's approval.
 */
const SUPPRESSION_RULES: readonly Rule[] = [
  {
    id: "skipped-or-focused-test",
    pattern:
      /\b(?:describe|it|test|suite|bench|context)\s*\.\s*(?:skip|only|todo|fixme|fails?|skipIf|runIf)\b/,
  },
  { id: "skipped-or-focused-test", pattern: /\b(?:xit|xdescribe|xtest|fit|fdescribe)\s*\(/ },
  { id: "skipped-or-focused-test", pattern: /\bpytest\.mark\.(?:skip|skipif|xfail)\b/ },
  { id: "pass-with-no-tests", pattern: /passWithNoTests/ },
  {
    id: "lint-suppression",
    pattern: /eslint-disable|eslint-enable|@ts-ignore|@ts-expect-error|@ts-nocheck/,
  },
  { id: "lint-suppression", pattern: /#\s*type:\s*ignore|\bnoqa\b|prettier-ignore/ },
  { id: "coverage-suppression", pattern: /(?:istanbul|c8|v8)\s+ignore/ },
  { id: "mutation-suppression", pattern: /Stryker\s+disable/ },
  { id: "hook-bypass", pattern: /--no-verify/ },
];

const SUPPRESSION_EXEMPT: readonly string[] = ["ci/**", "**/*.md", ".specify/**", ".claude/**"];

export function findSuppressions(
  files: readonly FileDiff[],
  exempt: readonly string[] = SUPPRESSION_EXEMPT,
): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    if (file.deleted || matchesAny(file.file, exempt)) {
      continue;
    }
    for (const added of file.added) {
      for (const rule of SUPPRESSION_RULES) {
        if (rule.pattern.test(added.text)) {
          violations.push({
            file: file.file,
            line: added.line,
            rule: rule.id,
            text: added.text.trim(),
          });
          break;
        }
      }
    }
  }
  return violations;
}

function leaves(value: unknown, path: string, out: Map<string, unknown>): void {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (!key.startsWith("$")) {
        leaves(child, path === "" ? key : `${path}.${key}`, out);
      }
    }
    return;
  }
  out.set(path, value);
}

/** Threshold keys where a smaller number is the stricter one (limits rather than minimums). */
const LOWER_IS_STRICTER: ReadonlySet<string> = new Set(["composeStartupSeconds"]);

/**
 * Compares ci/thresholds.json before and after. No number may get looser (minimums may only
 * go up, limits only down), and no key may disappear or stop being a number.
 */
export function loweredThresholds(base: unknown, head: unknown): string[] {
  const before = new Map<string, unknown>();
  const after = new Map<string, unknown>();
  leaves(base, "", before);
  leaves(head, "", after);
  const problems: string[] = [];
  for (const [key, old] of before) {
    if (typeof old !== "number") {
      continue;
    }
    const now = after.get(key);
    if (now === undefined) {
      problems.push(`${key} was removed (was ${String(old)})`);
    } else if (typeof now !== "number") {
      problems.push(`${key} is no longer a number (was ${String(old)})`);
    } else if (LOWER_IS_STRICTER.has(key) ? now > old : now < old) {
      problems.push(`${key} loosened from ${String(old)} to ${String(now)}`);
    }
  }
  return problems;
}
