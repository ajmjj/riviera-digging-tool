// Runs `tsc --noEmit` for every TypeScript project in the repo. Fails on the first error.
import { execFileSync } from "node:child_process";

const projects = [
  "tsconfig.json",
  "apps/api/tsconfig.json",
  "apps/web/tsconfig.json",
  "packages/common-ground/tsconfig.json",
];

for (const project of projects) {
  console.log(`tsc -p ${project}`);
  execFileSync("pnpm", ["exec", "tsc", "-p", project, "--noEmit"], { stdio: "inherit" });
}
