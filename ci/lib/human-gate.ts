import { matchesAny } from "./diff.ts";

export const LABELS = {
  needsHuman: "needs-human",
  approved: "human-approved",
  exception: "approved-exception",
} as const;

/** One `labeled` / `unlabeled` event from the issue timeline API. */
export interface LabelEvent {
  readonly event: "labeled" | "unlabeled";
  readonly label: string;
  readonly actor: string;
  /** Slug of the GitHub App the action went through, or null if a person did it directly. */
  readonly viaApp: string | null;
  readonly createdAt: string;
}

export interface LabelVerdict {
  readonly present: boolean;
  /** Present, and the last time it was added, Antn added it himself (not through an app). */
  readonly byOwner: boolean;
  readonly detail: string;
}

/**
 * Decides whether a label currently on the PR was applied by the owner in person. Agents act
 * through Antn's account via a GitHub App, so the actor alone proves nothing; the action
 * must also not have gone through any app.
 */
export function verifyLabel(
  label: string,
  currentLabels: readonly string[],
  events: readonly LabelEvent[],
  owner: string,
): LabelVerdict {
  if (!currentLabels.includes(label)) {
    return { present: false, byOwner: false, detail: `"${label}" is not on the PR` };
  }
  const lastAdd = events
    .filter((e) => e.event === "labeled" && e.label === label)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .at(-1);
  if (lastAdd === undefined) {
    return { present: true, byOwner: false, detail: `no timeline event found for "${label}"` };
  }
  if (lastAdd.actor.toLowerCase() !== owner.toLowerCase()) {
    return {
      present: true,
      byOwner: false,
      detail: `"${label}" was added by @${lastAdd.actor}, not @${owner}`,
    };
  }
  if (lastAdd.viaApp !== null) {
    return {
      present: true,
      byOwner: false,
      detail: `"${label}" was added through the GitHub App "${lastAdd.viaApp}", not by @${owner} in person`,
    };
  }
  return { present: true, byOwner: true, detail: `"${label}" added by @${owner} in person` };
}

export interface GateInput {
  readonly changedFiles: readonly string[];
  readonly labels: readonly string[];
  readonly events: readonly LabelEvent[];
  readonly protectedPaths: readonly string[];
  readonly owner: string;
}

export interface GateResult {
  readonly pass: boolean;
  readonly reasons: readonly string[];
  readonly lines: readonly string[];
}

/** The `human-gate` decision (constitution, Human Checkpoints). */
export function evaluateGate(input: GateInput): GateResult {
  const reasons: string[] = [];
  const touched = input.changedFiles.filter((f) => matchesAny(f, input.protectedPaths));
  if (touched.length > 0) {
    reasons.push(`touches protected paths: ${touched.join(", ")}`);
  }
  if (input.labels.includes(LABELS.needsHuman)) {
    reasons.push(`labelled "${LABELS.needsHuman}"`);
  }
  if (input.labels.includes(LABELS.exception)) {
    reasons.push(`requests an exception ("${LABELS.exception}")`);
  }

  const lines: string[] = [];
  if (reasons.length === 0) {
    lines.push("No human approval needed: no protected paths, no needs-human label.");
    return { pass: true, reasons, lines };
  }

  lines.push("Antn's approval is required because this PR:", ...reasons.map((r) => `  - ${r}`));
  const approval = verifyLabel(LABELS.approved, input.labels, input.events, input.owner);
  lines.push(`Approval: ${approval.detail}.`);

  let pass = approval.byOwner;
  if (input.labels.includes(LABELS.exception)) {
    const exception = verifyLabel(LABELS.exception, input.labels, input.events, input.owner);
    lines.push(`Exception: ${exception.detail}.`);
    pass &&= exception.byOwner;
  }
  if (!pass) {
    lines.push(
      `To approve: @${input.owner} adds "${LABELS.approved}" in the GitHub web UI or with his own gh login, after the last commit.`,
    );
  }
  return { pass, reasons, lines };
}
