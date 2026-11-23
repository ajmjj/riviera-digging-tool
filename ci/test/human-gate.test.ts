import { describe, expect, it } from "vitest";
import { evaluateGate, LABELS, verifyLabel, type LabelEvent } from "../lib/human-gate.ts";

const OWNER = "ajmjj";
const PROTECTED = [".github/**", "ci/**", "CODEOWNERS", "**/tsconfig*.json"];

function added(label: string, actor: string, viaApp: string | null, createdAt: string): LabelEvent {
  return { event: "labeled", label, actor, viaApp, createdAt };
}

const byOwner = added(LABELS.approved, OWNER, null, "2026-11-23T10:00:00Z");

describe("verifyLabel", () => {
  it("is not present when the label is not on the PR, even with past events", () => {
    expect(verifyLabel(LABELS.approved, [], [byOwner], OWNER)).toEqual({
      present: false,
      byOwner: false,
      detail: '"human-approved" is not on the PR',
    });
  });

  it("accepts the owner adding it in person (case-insensitive login)", () => {
    expect(verifyLabel(LABELS.approved, [LABELS.approved], [byOwner], "AJMJJ").byOwner).toBe(true);
  });

  it("rejects the owner's account acting through a GitHub App (an agent)", () => {
    const viaClaude = added(LABELS.approved, OWNER, "claude", "2026-11-23T10:00:00Z");
    const verdict = verifyLabel(LABELS.approved, [LABELS.approved], [viaClaude], OWNER);
    expect(verdict.byOwner).toBe(false);
    expect(verdict.detail).toContain('GitHub App "claude"');
  });

  it("rejects someone else adding it", () => {
    const other = added(LABELS.approved, "someone", null, "2026-11-23T10:00:00Z");
    const verdict = verifyLabel(LABELS.approved, [LABELS.approved], [other], OWNER);
    expect(verdict.byOwner).toBe(false);
    expect(verdict.detail).toContain("@someone");
  });

  it("judges only the most recent add, whatever order the events arrive in", () => {
    const laterByApp = added(LABELS.approved, OWNER, "claude", "2026-11-23T11:00:00Z");
    const removed: LabelEvent = {
      ...byOwner,
      event: "unlabeled",
      createdAt: "2026-11-23T10:30:00Z",
    };
    expect(
      verifyLabel(LABELS.approved, [LABELS.approved], [laterByApp, removed, byOwner], OWNER)
        .byOwner,
    ).toBe(false);
    const laterByOwner = added(LABELS.approved, OWNER, null, "2026-11-23T12:00:00Z");
    expect(
      verifyLabel(LABELS.approved, [LABELS.approved], [laterByOwner, laterByApp], OWNER).byOwner,
    ).toBe(true);
  });

  it("ignores events for other labels", () => {
    const other = added(LABELS.needsHuman, OWNER, null, "2026-11-23T10:00:00Z");
    const verdict = verifyLabel(LABELS.approved, [LABELS.approved], [other], OWNER);
    expect(verdict).toMatchObject({ present: true, byOwner: false });
    expect(verdict.detail).toContain("no timeline event");
  });
});

describe("evaluateGate", () => {
  const base = { labels: [], events: [], protectedPaths: PROTECTED, owner: OWNER };

  it("passes PRs that touch no protected path and carry no human labels", () => {
    const result = evaluateGate({ ...base, changedFiles: ["apps/api/src/app.ts"] });
    expect(result.pass).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("requires approval when a protected path is touched", () => {
    const result = evaluateGate({
      ...base,
      changedFiles: ["apps/api/src/app.ts", ".github/workflows/ci.yml", "apps/web/tsconfig.json"],
    });
    expect(result.pass).toBe(false);
    expect(result.reasons).toEqual([
      "touches protected paths: .github/workflows/ci.yml, apps/web/tsconfig.json",
    ]);
    expect(result.lines.at(-1)).toContain('adds "human-approved"');
  });

  it("requires approval for needs-human even without protected paths", () => {
    const result = evaluateGate({ ...base, changedFiles: ["a.ts"], labels: [LABELS.needsHuman] });
    expect(result.pass).toBe(false);
    expect(result.reasons).toEqual(['labelled "needs-human"']);
  });

  it("passes once the owner has approved in person", () => {
    const result = evaluateGate({
      ...base,
      changedFiles: ["CODEOWNERS"],
      labels: [LABELS.needsHuman, LABELS.approved],
      events: [byOwner],
    });
    expect(result.pass).toBe(true);
  });

  it("does not pass when the approval label came through an app", () => {
    const result = evaluateGate({
      ...base,
      changedFiles: ["CODEOWNERS"],
      labels: [LABELS.approved],
      events: [added(LABELS.approved, OWNER, "claude", "2026-11-23T10:00:00Z")],
    });
    expect(result.pass).toBe(false);
  });

  it("needs both approval and a verified exception when an exception is requested", () => {
    const exceptionByApp = added(LABELS.exception, OWNER, "claude", "2026-11-23T10:00:00Z");
    const exceptionByOwner = added(LABELS.exception, OWNER, null, "2026-11-23T10:00:00Z");
    const labels = [LABELS.exception, LABELS.approved];
    const changedFiles = ["apps/a.ts"];

    const fake = evaluateGate({ ...base, changedFiles, labels, events: [byOwner, exceptionByApp] });
    expect(fake.pass).toBe(false);
    expect(fake.reasons).toEqual(['requests an exception ("approved-exception")']);

    const real = evaluateGate({
      ...base,
      changedFiles,
      labels,
      events: [byOwner, exceptionByOwner],
    });
    expect(real.pass).toBe(true);
  });
});
