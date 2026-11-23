import { describe, expect, it } from "vitest";
import { matchesAny, parseUnifiedDiff } from "../lib/diff.ts";

const DIFF = `diff --git a/apps/api/src/a.ts b/apps/api/src/a.ts
index 111..222 100644
--- a/apps/api/src/a.ts
+++ b/apps/api/src/a.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a };
@@ -10,0 +12,1 @@
+// later
\\ No newline at end of file
diff --git a/old/name.ts b/new/name.ts
similarity index 90%
rename from old/name.ts
rename to new/name.ts
--- a/old/name.ts
+++ b/new/name.ts
@@ -5 +5 @@
-x
+y
diff --git a/gone.ts b/gone.ts
deleted file mode 100644
--- a/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-one
-two
diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
++++ looks like a header but is content
+second
`;

describe("parseUnifiedDiff", () => {
  const files = parseUnifiedDiff(DIFF);

  it("numbers added lines as in the new file, across hunks", () => {
    expect(files[0]).toEqual({
      file: "apps/api/src/a.ts",
      deleted: false,
      added: [
        { line: 2, text: "const b = 3;" },
        { line: 3, text: "const c = 4;" },
        { line: 12, text: "// later" },
      ],
    });
  });

  it("reports renames under the new path", () => {
    expect(files[1]).toEqual({
      file: "new/name.ts",
      deleted: false,
      added: [{ line: 5, text: "y" }],
    });
  });

  it("marks deleted files and reports no added lines", () => {
    expect(files[2]).toMatchObject({ file: "gone.ts", deleted: true, added: [] });
  });

  it("treats '+++' inside a hunk as content, not a header", () => {
    expect(files[3]).toEqual({
      file: "new.ts",
      deleted: false,
      added: [
        { line: 1, text: "+++ looks like a header but is content" },
        { line: 2, text: "second" },
      ],
    });
  });

  it("ignores text before the first file header", () => {
    expect(parseUnifiedDiff("garbage\n+not a file\n")).toEqual([]);
  });

  it("returns nothing for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});

describe("matchesAny", () => {
  it("matches globs including ** and leading dot directories", () => {
    expect(matchesAny(".github/workflows/ci.yml", [".github/**"])).toBe(true);
    expect(matchesAny("apps/web/tsconfig.json", ["**/tsconfig*.json"])).toBe(true);
    expect(matchesAny("tsconfig.base.json", ["**/tsconfig*.json"])).toBe(true);
    expect(matchesAny("apps/api/src/a.ts", ["ci/**", "CODEOWNERS"])).toBe(false);
    expect(matchesAny("anything", [])).toBe(false);
  });
});
