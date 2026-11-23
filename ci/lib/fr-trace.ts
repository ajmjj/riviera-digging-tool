export interface SourceFile {
  readonly path: string;
  readonly content: string;
}

export interface TraceResult {
  /** Requirements defined in a spec that no test names, as `NNN/FR-###`. */
  readonly untested: readonly string[];
  /** Test references to requirements that no spec defines. */
  readonly unknown: readonly string[];
  /** `FR-###` in a test without the `NNN/` feature prefix. */
  readonly unqualified: readonly string[];
  readonly specs: number;
  readonly requirements: number;
}

const SPEC_PATH = /^specs\/(\d{3})-[^/]+\/spec\.md$/;
// Spec Kit writes requirements as "- **FR-001**: System MUST …".
const DEFINITION = /^\s*[-*]\s+\*\*FR-(\d{3})\*\*/gm;
const QUALIFIED = /\b(\d{3})\/FR-(\d{3})\b/g;
const ANY_FR = /(?<![\d/])FR-\d{3}\b/g;

export function featureOf(specPath: string): string | undefined {
  return SPEC_PATH.exec(specPath)?.[1];
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/** Checks that every spec FR has a test and every test FR exists (constitution, III). */
export function traceRequirements(
  specs: readonly SourceFile[],
  tests: readonly SourceFile[],
): TraceResult {
  const defined = new Set<string>();
  let specCount = 0;
  for (const spec of specs) {
    const feature = featureOf(spec.path);
    if (feature === undefined) {
      continue;
    }
    specCount += 1;
    for (const match of spec.content.matchAll(DEFINITION)) {
      defined.add(`${feature}/FR-${match[1] ?? ""}`);
    }
  }

  const referenced = new Set<string>();
  const unknown: string[] = [];
  const unqualified: string[] = [];
  for (const test of tests) {
    for (const match of test.content.matchAll(QUALIFIED)) {
      const id = `${match[1] ?? ""}/FR-${match[2] ?? ""}`;
      referenced.add(id);
      if (!defined.has(id)) {
        unknown.push(`${id} (${test.path}:${String(lineOf(test.content, match.index))})`);
      }
    }
    for (const match of test.content.matchAll(ANY_FR)) {
      unqualified.push(`${match[0]} (${test.path}:${String(lineOf(test.content, match.index))})`);
    }
  }

  const untested = [...defined].filter((id) => !referenced.has(id)).sort();
  return {
    untested,
    unknown,
    unqualified,
    specs: specCount,
    requirements: defined.size,
  };
}
