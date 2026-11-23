import { readFileSync } from "node:fs";
import { parse } from "yaml";

// Narrowing helpers for the static config tests (compose, collector, Grafana provisioning).

export type Yaml = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is Yaml {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function record(value: unknown, what: string): Yaml {
  if (!isRecord(value)) {
    throw new Error(`${what} is not a mapping`);
  }
  return value;
}

export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export function records(value: unknown, what: string): Yaml[] {
  if (!Array.isArray(value)) {
    throw new Error(`${what} is not a list`);
  }
  return value.map((item: unknown, index) => record(item, `${what}[${String(index)}]`));
}

export function readYaml(path: string): Yaml {
  return record(parse(readFileSync(path, "utf8"), { merge: true }), path);
}
