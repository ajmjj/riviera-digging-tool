// Independent reviewer, step 1 of 3 (see .github/workflows/review.yml). Runs main's code.
// Reads the PR only through the API and writes the material Claude will review to
// .review/input.md. Writes the prompt and JSON schema to the step outputs. If the PR is
// too large to review whole, writes a blocking review to .review/precheck.json instead.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { changedFilenames } from "./lib/github.ts";
import {
  blocked,
  buildReviewInput,
  featureDirs,
  INPUT_PATH,
  reviewerPrompt,
  reviewJsonSchema,
} from "./lib/review.ts";
import { env, githubFromEnv, prop } from "./io.ts";

const gh = githubFromEnv();
const number = env("PR_NUMBER");
const pr = await gh.get(`/repos/${gh.repo}/pulls/${number}`);
const headSha = String(prop(prop(pr, "head"), "sha"));
const branch = String(prop(prop(pr, "head"), "ref"));
const diff = await gh.getText(`/repos/${gh.repo}/pulls/${number}`, "application/vnd.github.diff");
const changed = changedFilenames(await gh.getAll(`/repos/${gh.repo}/pulls/${number}/files`));

// Spec documents come from the PR head (they may be part of the PR), read through the API.
const specDocuments: { path: string; content: string }[] = [];
for (const dir of featureDirs(changed, branch)) {
  for (const name of ["spec.md", "plan.md", "tasks.md"]) {
    const path = `${dir}/${name}`;
    try {
      const content = await gh.getText(
        `/repos/${gh.repo}/contents/${path}?ref=${headSha}`,
        "application/vnd.github.raw+json",
      );
      specDocuments.push({ path, content });
    } catch {
      // Not every document exists at every stage of a feature.
    }
  }
}

mkdirSync(".review", { recursive: true });
let ready = true;
try {
  const body = prop(pr, "body");
  writeFileSync(
    INPUT_PATH,
    buildReviewInput({
      // The constitution is read from the base branch checkout, never from the PR.
      constitution: readFileSync(".specify/memory/constitution.md", "utf8"),
      prTitle: String(prop(pr, "title")),
      prBody: typeof body === "string" ? body : "",
      diff,
      specDocuments,
    }),
  );
  console.log(`Wrote ${INPUT_PATH} (${String(specDocuments.length)} spec document(s)).`);
} catch (error) {
  ready = false;
  const review = blocked("The reviewer could not review this PR.", "Principle V", String(error));
  writeFileSync(".review/precheck.json", JSON.stringify(review));
  console.log(String(error));
}

const outputFile = env("GITHUB_OUTPUT");
const delimiter = `EOF_${randomUUID()}`;
appendFileSync(
  outputFile,
  [
    `ready=${String(ready)}`,
    `head_sha=${headSha}`,
    `schema=${reviewJsonSchema()}`,
    `prompt<<${delimiter}`,
    reviewerPrompt(),
    delimiter,
    "",
  ].join("\n"),
);
