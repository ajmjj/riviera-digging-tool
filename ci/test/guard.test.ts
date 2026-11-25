import { describe, expect, it } from "vitest";
import type { FileDiff } from "../lib/diff.ts";
import { findScanExceptions, findSuppressions, loweredThresholds } from "../lib/guard.ts";

function file(path: string, ...lines: string[]): FileDiff {
  return { file: path, deleted: false, added: lines.map((text, i) => ({ line: i + 1, text })) };
}

// The forbidden markers are assembled from parts so this test file does not itself look
// like a suppression to tools that scan the repo.
const dot = (a: string, b: string): string => `${a}.${b}`;

describe("findSuppressions", () => {
  it.each([
    [`${dot("it", "skip")}("x", () => {})`, "skipped-or-focused-test"],
    [`${dot("test", "only")}("x", () => {})`, "skipped-or-focused-test"],
    [`${dot("describe", "skip")}("x", () => {})`, "skipped-or-focused-test"],
    [`${dot("it", "todo")}("x")`, "skipped-or-focused-test"],
    [`${dot("test", "fixme")}("x", () => {})`, "skipped-or-focused-test"],
    [`${dot("it", "fails")}("x", () => {})`, "skipped-or-focused-test"],
    [`${dot("test", "skipIf")}(ci)("x", () => {})`, "skipped-or-focused-test"],
    [`${dot("describe", " only")}("x", () => {})`, "skipped-or-focused-test"],
    ["xit('x', () => {})", "skipped-or-focused-test"],
    ["fdescribe('x', () => {})", "skipped-or-focused-test"],
    ["@pytest.mark.skip(reason='x')", "skipped-or-focused-test"],
    ["passWith" + "NoTests: true", "pass-with-no-tests"],
    ["// eslint-" + "disable-next-line", "lint-suppression"],
    ["/* eslint-" + "disable */", "lint-suppression"],
    ["// @ts-" + "ignore", "lint-suppression"],
    ["// @ts-" + "expect-error", "lint-suppression"],
    ["// @ts-" + "nocheck", "lint-suppression"],
    ["x = 1  # type: " + "ignore", "lint-suppression"],
    ["import os  # no" + "qa", "lint-suppression"],
    ["// prettier-" + "ignore", "lint-suppression"],
    ["/* istanbul " + "ignore next */", "coverage-suppression"],
    ["/* v8 " + "ignore next */", "coverage-suppression"],
    ["/* c8 " + "ignore start */", "coverage-suppression"],
    ["// Stryker " + "disable all", "mutation-suppression"],
    ["git commit --no-" + "verify", "hook-bypass"],
  ])("flags %j as %s", (text, rule) => {
    expect(findSuppressions([file("apps/api/src/x.ts", text)])).toEqual([
      { file: "apps/api/src/x.ts", line: 1, rule, text },
    ]);
  });

  it.each([
    ["it('skips nothing', () => {})"],
    ["const skipped = items.filter((i) => i.only);"],
    ["describe('only the first box', () => {})"],
    ["const fit = 3;"],
    ["const ignore = true;"],
  ])("does not flag ordinary code %j", (text) => {
    expect(findSuppressions([file("apps/api/src/x.ts", text)])).toEqual([]);
  });

  it("reports the line number of each offending added line, once per line", () => {
    const diff: FileDiff = {
      file: "apps/web/test/a.test.ts",
      deleted: false,
      added: [
        { line: 7, text: "fine();" },
        { line: 9, text: `${dot("it", "only")}("x", () => {}) // @ts-` + "ignore" },
      ],
    };
    expect(findSuppressions([diff])).toEqual([
      {
        file: "apps/web/test/a.test.ts",
        line: 9,
        rule: "skipped-or-focused-test",
        text: `${dot("it", "only")}("x", () => {}) // @ts-ignore`,
      },
    ]);
  });

  it("exempts the guard's own files, docs and Spec Kit files, and deleted files", () => {
    const marker = `${dot("it", "skip")}("x")`;
    expect(
      findSuppressions([
        file("ci/test/guard.test.ts", marker),
        file("docs/notes.md", marker),
        file(".specify/templates/x.md", marker),
        file(".claude/skills/x/SKILL.md", marker),
        { file: "apps/a.test.ts", deleted: true, added: [{ line: 1, text: marker }] },
      ]),
    ).toEqual([]);
  });

  it("accepts a custom exemption list", () => {
    const marker = `${dot("it", "skip")}("x")`;
    expect(findSuppressions([file("ci/x.ts", marker)], [])).toHaveLength(1);
  });
});

describe("findScanExceptions", () => {
  it.each([
    [".trivyignore"],
    ["docker/.trivyignore"],
    [".trivyignore.yaml"],
    ["trivy.yaml"],
    ["ci/trivy.yml"],
    [".trivy.yaml"],
    ["docker/.trivy.yml"],
    ["ci/trivy-exceptions/grafana.yaml"],
    ["ci/trivy-exceptions/new-image.yaml"],
  ])("flags an added or changed Trivy ignore file, also under ci/: %s", (path) => {
    expect(findScanExceptions([file(path, "CVE-2026-0001", "CVE-2026-0002")])).toEqual([
      {
        file: path,
        line: 1,
        rule: "scan-exception",
        text: "Trivy ignore or config file added or changed",
      },
    ]);
  });

  it.each([
    ['trivy image --exit-code 1 --severity HIGH,CRITICAL --ignorefile x.yaml "$image"'],
    ["trivy image --exit-code 1 --severity HIGH,CRITICAL --skip-files /usr/bin/grafana img"],
    ["trivy image --exit-code 1 --severity HIGH,CRITICAL --skip-dirs /usr/share img"],
    ["trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-policy p.rego img"],
    ["TRIVY_IGNOREFILE=x.yaml trivy image --exit-code 1 --severity HIGH,CRITICAL img"],
    ["  TRIVY_SKIP_DIRS: /usr"],
    ["trivy image --exit-code 1 --severity HIGH,CRITICAL --vex openvex.json img"],
    ["TRIVY_VEX=openvex.json trivy image --exit-code 1 --severity HIGH,CRITICAL img"],
    ["  TRIVY_SEVERITY: CRITICAL"],
    ["TRIVY_EXIT_CODE=0 ci/trivy-scan.sh"],
    ["TRIVY_CONFIG=trivy.yaml ci/trivy-scan.sh"],
  ])("flags an added line that points Trivy at exceptions, also under ci/: %s", (text) => {
    expect(findScanExceptions([file(".github/workflows/ci.yml", "ok", text)])).toEqual([
      { file: ".github/workflows/ci.yml", line: 2, rule: "scan-exception", text: text.trim() },
    ]);
    expect(findScanExceptions([file("ci/trivy-scan.sh", text)])).toHaveLength(1);
  });

  it.each([
    ['"$trivy" image --severity HIGH,CRITICAL --no-progress "$image"', "without --exit-code 1"],
    ["trivy image --exit-code 0 --severity HIGH,CRITICAL img", "without --exit-code 1"],
    ["/tmp/trivy image --exit-code 1 --severity CRITICAL img", "leaves out HIGH or CRITICAL"],
    ["trivy image --exit-code=1 img", "leaves out HIGH or CRITICAL"],
    ["${trivy} image --exit-code 1 --severity=HIGH,CRITICAL -c trivy.yml img", "a config file"],
    ["trivy image --exit-code 1 --severity HIGH,CRITICAL --config ci/t.yaml img", "a config file"],
  ])("flags a trivy image command weaker than the gate, also under ci/: %s", (text, why) => {
    const found = findScanExceptions([file("ci/trivy-scan.sh", text)]);
    expect(found).toHaveLength(1);
    expect(found[0]?.text).toContain(why);
    expect(found[0]?.text).toContain(text.trim());
  });

  it("accepts plain scans, deleted ignore files, files with no added lines and the guard itself", () => {
    expect(
      findScanExceptions([
        file(
          "ci/trivy-scan.sh",
          "trivy image --exit-code 1 --severity HIGH,CRITICAL img",
          '"$trivy" image --exit-code 1 --severity CRITICAL,HIGH --ignore-unfixed --no-progress \\',
          "# trivy image --exit-code 0 in a comment is not a scan",
          "// trivy image --severity LOW in a comment is not a scan",
          "curl -o /tmp/trivy.tgz https://github.com/aquasecurity/trivy/releases/x.tar.gz",
        ),
        { file: "ci/trivy-exceptions/grafana.yaml", deleted: true, added: [] },
        { file: ".trivyignore", deleted: false, added: [] },
        file("ci/lib/guard.ts", "const OPTION = /--ignorefile/;"),
        file("ci/test/guard.test.ts", "TRIVY_IGNOREFILE=x"),
      ]),
    ).toEqual([]);
  });
});

describe("loweredThresholds", () => {
  const base = {
    $comment: "ignored",
    coverage: { overall: { branches: 90, lines: 90 }, domain: { branches: 95 } },
    mutation: { break: 80 },
    composeStartupSeconds: 120,
  };

  it("accepts identical and raised thresholds", () => {
    expect(loweredThresholds(base, structuredClone(base))).toEqual([]);
    expect(
      loweredThresholds(base, {
        ...base,
        mutation: { break: 85 },
        coverage: { ...base.coverage, overall: { branches: 91, lines: 90 } },
      }),
    ).toEqual([]);
  });

  it("flags a lowered minimum", () => {
    expect(loweredThresholds(base, { ...base, mutation: { break: 79 } })).toEqual([
      "mutation.break loosened from 80 to 79",
    ]);
  });

  it("treats a raised time limit as loosening and a lowered one as tightening", () => {
    expect(loweredThresholds(base, { ...base, composeStartupSeconds: 121 })).toEqual([
      "composeStartupSeconds loosened from 120 to 121",
    ]);
    expect(loweredThresholds(base, { ...base, composeStartupSeconds: 90 })).toEqual([]);
  });

  it("flags removed keys and values that stop being numbers", () => {
    expect(
      loweredThresholds(base, {
        coverage: { overall: { branches: "90" }, domain: {} },
        mutation: { break: 80 },
        composeStartupSeconds: 120,
      }),
    ).toEqual([
      "coverage.overall.branches is no longer a number (was 90)",
      "coverage.overall.lines was removed (was 90)",
      "coverage.domain.branches was removed (was 95)",
    ]);
  });

  it("flags everything when the head file is missing or not an object", () => {
    expect(loweredThresholds(base, {})).toHaveLength(5);
    expect(loweredThresholds(base, null)).toHaveLength(5);
    expect(loweredThresholds(base, [1, 2])).toHaveLength(5);
  });

  it("ignores non-numeric leaves in the base and $-prefixed keys", () => {
    expect(loweredThresholds({ $note: 1, name: "x", list: [1] }, {})).toEqual([]);
  });

  it("allows new keys", () => {
    expect(loweredThresholds({}, base)).toEqual([]);
  });
});
