/** Converts a protected-path glob to the equivalent CODEOWNERS pattern. */
export function toCodeownersPattern(glob: string): string {
  if (glob.startsWith("**/")) {
    return glob;
  }
  if (glob.endsWith("/**")) {
    return `/${glob.slice(0, -"**".length)}`;
  }
  return `/${glob}`;
}

/** The CODEOWNERS file for a list of protected globs, all owned by one person. */
export function renderCodeowners(globs: readonly string[], owner: string): string {
  const header = [
    "# Generated from ci/protected-paths.json. A unit test fails if the two drift apart.",
    "# GitHub does not let Antn approve PRs opened through his own account, so approval is",
    "# enforced by the human-gate check (see the constitution, Human Checkpoints).",
    "",
  ];
  const rules = globs.map((glob) => `${toCodeownersPattern(glob)} @${owner}`);
  return [...header, ...rules, ""].join("\n");
}
