import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { createGitHub, type GitHub } from "./lib/github.ts";

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Reads a property of an untyped JSON value; undefined if it is not an object. */
export function prop(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;
}

export function stringList(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new Error(`${what} must be a list of strings`);
  }
  return value.map(String);
}

export function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export function git(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Base commit for local and `pull_request` runs: BASE_SHA if set, else origin/main. */
export function baseRef(): string {
  return process.env["BASE_SHA"] ?? "origin/main";
}

export function githubFromEnv(): GitHub {
  return createGitHub(env("GITHUB_TOKEN"), env("GITHUB_REPOSITORY"), fetch);
}

/** Writes a line to the GitHub Actions job summary when running in Actions. */
export function summary(markdown: string): void {
  const file = process.env["GITHUB_STEP_SUMMARY"];
  if (file !== undefined) {
    appendFileSync(file, `${markdown}\n`);
  }
}
