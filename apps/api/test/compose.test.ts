import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// Static checks of docker-compose.yml and the collector config (tasks T014, research R7–R10, R17).
// `make up-observability` and the CI stack job prove the same stack actually comes up healthy.

type Yaml = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Yaml {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, what: string): Yaml {
  if (!isRecord(value)) {
    throw new Error(`${what} is not a mapping`);
  }
  return value;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function readYaml(path: string): Yaml {
  return record(parse(readFileSync(path, "utf8"), { merge: true }), path);
}

const compose = readYaml("docker-compose.yml");
const services = record(compose["services"], "services");
const serviceNames = Object.keys(services);
const service = (name: string): Yaml => record(services[name], `service ${name}`);
const profilesOf = (name: string): string[] => strings(service(name)["profiles"]);

const OBSERVABILITY = ["otel-collector", "loki", "tempo", "prometheus"];
const APP_SERVICES = ["db", "api", "worker", "web", "proxy"];

function dependsOn(name: string): string[] {
  const value = service(name)["depends_on"];
  if (Array.isArray(value)) {
    return strings(value);
  }
  return isRecord(value) ? Object.keys(value) : [];
}

function environment(name: string): Yaml {
  return record(service(name)["environment"], `${name} environment`);
}

/** Every image a service uses: its `image:`, or for a build, the FROM lines of its Dockerfile. */
function upstreamImages(name: string): string[] {
  const build = service(name)["build"];
  if (isRecord(build) && typeof build["dockerfile"] === "string") {
    const dockerfile = readFileSync(build["dockerfile"], "utf8");
    return [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((match) => match[1] ?? "");
  }
  const image = service(name)["image"];
  return typeof image === "string" ? [image] : [];
}

describe("compose profile observability", () => {
  it("001/FR-021: the observability services exist and sit only behind the profile observability", () => {
    for (const name of OBSERVABILITY) {
      expect(profilesOf(name), name).toEqual(["observability"]);
    }
  });

  it("001/FR-021: the default stack has no profile, so `make up` starts none of it", () => {
    for (const name of APP_SERVICES) {
      expect(profilesOf(name), name).toEqual([]);
    }
  });

  it("001/FR-021: every observability service has a healthcheck that runs a probe", () => {
    for (const name of OBSERVABILITY) {
      const healthcheck = record(service(name)["healthcheck"], `${name} healthcheck`);
      const test = strings(healthcheck["test"]);
      expect(test[0], name).toBe("CMD");
      expect(test.join(" "), name).toMatch(/wget -q --spider http:\/\/127\.0\.0\.1:\d+\//);
    }
  });

  it("001/FR-021: every published port of every service binds to 127.0.0.1", () => {
    const published = serviceNames.flatMap((name) => strings(service(name)["ports"]));
    expect(published.length).toBeGreaterThan(OBSERVABILITY.length);
    for (const port of published) {
      expect(port).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it("001/FR-021: no service outside the profile depends on an observability service", () => {
    for (const name of serviceNames.filter((n) => !profilesOf(n).includes("observability"))) {
      for (const dependency of dependsOn(name)) {
        expect(OBSERVABILITY, `${name} depends on ${dependency}`).not.toContain(dependency);
      }
    }
  });

  it("001/FR-021: every upstream image of the profile is pinned by tag and digest", () => {
    for (const name of OBSERVABILITY) {
      const images = upstreamImages(name);
      expect(images.length, name).toBeGreaterThan(0);
      for (const image of images) {
        expect(image, name).toMatch(/^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
      }
    }
  });

  it("001/FR-023: Loki and Tempo keep 7 days and Prometheus 30 days, on named volumes", () => {
    const volumes = Object.keys(record(compose["volumes"], "volumes"));
    for (const name of ["loki", "tempo", "prometheus"]) {
      const mounts = strings(service(name)["volumes"]);
      const named = mounts.filter((mount) => volumes.includes(mount.split(":")[0] ?? ""));
      expect(named, name).toHaveLength(1);
    }
    expect(readFileSync("observability/loki.yaml", "utf8")).toMatch(/retention_period: 168h/);
    expect(readFileSync("observability/tempo.yaml", "utf8")).toMatch(/block_retention: 168h/);
    expect(strings(service("prometheus")["command"])).toContain(
      "--storage.tsdb.retention.time=30d",
    );
  });

  it("001/FR-021: mocks, when defined, run only in the profile dev", () => {
    for (const name of serviceNames.filter((n) => profilesOf(n).includes("dev"))) {
      expect(profilesOf(name), name).toEqual(["dev"]);
    }
    if (serviceNames.includes("mocks")) {
      expect(profilesOf("mocks")).toEqual(["dev"]);
    }
  });

  it("001/FR-021: api and worker default to no export endpoint and sample flows off", () => {
    for (const name of ["api", "worker"]) {
      const env = environment(name);
      expect(env["OTEL_EXPORTER_OTLP_ENDPOINT"], name).toBe("${OTEL_EXPORTER_OTLP_ENDPOINT:-}");
      expect(env["SAMPLE_FLOWS_ENABLED"], name).toBe("${SAMPLE_FLOWS_ENABLED:-false}");
      expect(env["DEPLOYMENT_ENVIRONMENT"], name).toBe("${DEPLOYMENT_ENVIRONMENT:-production}");
      expect(env["COMMON_GROUND_URL"], name).toBe("${COMMON_GROUND_URL:-}");
      expect(env["DISCOGS_URL"], name).toBe("${DISCOGS_URL:-}");
    }
  });
});

describe("collector config", () => {
  const config = readYaml("observability/otel-collector.yaml");
  const processors = record(config["processors"], "processors");
  const pipelines = record(record(config["service"], "service")["pipelines"], "pipelines");

  it("001/FR-021: has traces, metrics and logs pipelines from OTLP through memory_limiter and batch", () => {
    expect(Object.keys(pipelines).sort()).toEqual(["logs", "metrics", "traces"]);
    for (const [name, value] of Object.entries(pipelines)) {
      const pipeline = record(value, `pipeline ${name}`);
      expect(strings(pipeline["receivers"]), name).toEqual(["otlp"]);
      expect(strings(pipeline["processors"]), name).toEqual(["memory_limiter", "batch"]);
    }
    expect(strings(record(pipelines["traces"], "traces")["exporters"])).toEqual(["otlp/tempo"]);
    expect(strings(record(pipelines["logs"], "logs")["exporters"])).toEqual(["otlphttp/loki"]);
    expect(strings(record(pipelines["metrics"], "metrics")["exporters"])).toEqual([
      "otlphttp/prometheus",
    ]);
  });

  it("001/FR-023: defines no sampling processor, so every trace is kept", () => {
    expect(Object.keys(processors).sort()).toEqual(["batch", "memory_limiter"]);
    for (const name of Object.keys(processors)) {
      expect(name).not.toMatch(/sampl/i);
    }
  });
});
