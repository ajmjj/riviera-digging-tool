// Independent reviewer, step 3 of 3 (see .github/workflows/review.yml). Runs main's code.
// Validates Claude's structured output (failing closed on anything unusable), posts it as a
// PR review on the head commit, and fails the `review` check on any blocking finding.
import { existsSync, readFileSync } from "node:fs";
import { parseUnifiedDiff } from "./lib/diff.ts";
import { parseReviewOutput, toReviewPost } from "./lib/review.ts";
import { env, githubFromEnv, summary } from "./io.ts";

const gh = githubFromEnv();
const number = env("PR_NUMBER");
const headSha = env("HEAD_SHA");

const review = existsSync(".review/precheck.json")
  ? parseReviewOutput(readFileSync(".review/precheck.json", "utf8"))
  : parseReviewOutput(process.env["STRUCTURED_OUTPUT"]);

const diff = parseUnifiedDiff(
  await gh.getText(`/repos/${gh.repo}/pulls/${number}`, "application/vnd.github.diff"),
);
const post = toReviewPost(review, diff, headSha);
await gh.send("POST", `/repos/${gh.repo}/pulls/${number}/reviews`, {
  commit_id: headSha,
  event: "COMMENT",
  body: post.body,
  comments: post.comments,
});
console.log(post.body);
summary(post.body);
process.exit(post.blocking === 0 ? 0 : 1);
