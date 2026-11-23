// Independent reviewer (constitution, Quality Gates). Runs under `pull_request_target` from
// the base branch's code, with a fresh context: one Messages API call that sees only the
// constitution (from the base branch), the feature's spec documents and the diff.
// It posts a PR review and fails the `review` check on any blocking finding.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { readFileSync } from "node:fs";
import { parseUnifiedDiff } from "./lib/diff.ts";
import { changedFilenames } from "./lib/github.ts";
import {
  buildReviewPrompt,
  featureDirs,
  ReviewSchema,
  SYSTEM_PROMPT,
  toReviewPost,
  type Review,
} from "./lib/review.ts";
import { env, githubFromEnv, prop, summary } from "./io.ts";

const gh = githubFromEnv();
const number = env("PR_NUMBER");
const pr = await gh.get(`/repos/${gh.repo}/pulls/${number}`);
const headSha = String(prop(prop(pr, "head"), "sha"));
const branch = String(prop(prop(pr, "head"), "ref"));
const diffText = await gh.getText(
  `/repos/${gh.repo}/pulls/${number}`,
  "application/vnd.github.diff",
);
const diff = parseUnifiedDiff(diffText);
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

function blocked(summaryText: string, rule: string, message: string): Review {
  return {
    summary: summaryText,
    findings: [{ file: "", line: null, severity: "blocking", rule, message }],
  };
}

async function review(): Promise<Review> {
  let prompt: string;
  try {
    const body = prop(pr, "body");
    prompt = buildReviewPrompt({
      // The constitution is read from the base branch checkout, never from the PR.
      constitution: readFileSync(".specify/memory/constitution.md", "utf8"),
      prTitle: String(prop(pr, "title")),
      prBody: typeof body === "string" ? body : "",
      diff: diffText,
      specDocuments,
    });
  } catch (error) {
    return blocked("The reviewer could not review this PR.", "Principle V", String(error));
  }

  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16_000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(ReviewSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  console.log(`model: ${response.model}, stop_reason: ${String(response.stop_reason)}`);

  // Fail closed: a refusal, a truncated answer or unparseable output is not a pass.
  if (response.stop_reason !== "end_turn" || response.parsed_output === null) {
    return blocked(
      "The reviewer did not return a usable review.",
      "Independent review",
      `Review ended with stop_reason "${String(response.stop_reason)}". Push a new commit to retry.`,
    );
  }
  return response.parsed_output;
}

const post = toReviewPost(await review(), diff, headSha);
await gh.send("POST", `/repos/${gh.repo}/pulls/${number}/reviews`, {
  commit_id: headSha,
  event: "COMMENT",
  body: post.body,
  comments: post.comments,
});
console.log(post.body);
summary(post.body);
process.exit(post.blocking === 0 ? 0 : 1);
