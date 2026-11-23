import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isRecord, readYaml, record, strings, type Yaml } from "./yaml.ts";

// Static checks of docker-compose.yml and the collector config (tasks T014, T015, research R7–R10, R17).
// `make up-observability` and the CI stack job prove the same stack actually comes up healthy.

const compose = readYaml("docker-compose.yml");
const services = record(compose["services"], "services");
const serviceNames = Object.keys(services);
const service = (name: string): Yaml => record(services[name], `service ${name}`);
const profilesOf = (name: string): string[] => strings(service(name)["profiles"]);

const OBSERVABILITY = ["otel-collector", "loki", "tempo", "prometheus", "grafana"];
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
    const published: unknown[] = serviceNames.flatMap((name) => {
      const ports: unknown = service(name)["ports"];
      return Array.isArray(ports) ? ports.map((port: unknown) => port) : [];
    });
    expect(published.length).toBeGreaterThan(OBSERVABILITY.length);
    for (const port of published) {
      // Long-syntax entries (objects) are rejected, so none can slip past the address check.
      expect(typeof port).toBe("string");
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

  it("001/FR-021: Loki and Tempo keep 7 days (research R10) on named volumes", () => {
    const volumes = Object.keys(record(compose["volumes"], "volumes"));
    for (const name of ["loki", "tempo", "prometheus"]) {
      const mounts = strings(service(name)["volumes"]);
      const named = mounts.filter((mount) => volumes.includes(mount.split(":")[0] ?? ""));
      expect(named, name).toHaveLength(1);
    }
    const loki = readYaml("observability/loki.yaml");
    expect(record(loki["limits_config"], "limits_config")["retention_period"]).toBe("168h");
    expect(record(loki["compactor"], "compactor")["retention_enabled"]).toBe(true);
    const tempoCompactor = record(readYaml("observability/tempo.yaml")["compactor"], "compactor");
    expect(record(tempoCompactor["compaction"], "compaction")["block_retention"]).toBe("168h");
  });

  it("001/FR-024: Prometheus keeps 30 days, enough for the 28-day SLO window", () => {
    expect(strings(service("prometheus")["command"])).toContain(
      "--storage.tsdb.retention.time=30d",
    );
  });

  it("001/FR-013: mocks run only in the profile dev, and nothing else does", () => {
    expect(serviceNames).toContain("mocks");
    expect(profilesOf("mocks")).toEqual(["dev"]);
    expect(serviceNames.filter((n) => profilesOf(n).includes("dev"))).toEqual(["mocks"]);
  });

  it("001/FR-019: api and worker default to no export endpoint", () => {
    for (const name of ["api", "worker"]) {
      expect(environment(name)["OTEL_EXPORTER_OTLP_ENDPOINT"], name).toBe(
        "${OTEL_EXPORTER_OTLP_ENDPOINT:-}",
      );
    }
  });

  it("001/FR-027: api and worker default to sample flows off, outside development", () => {
    for (const name of ["api", "worker"]) {
      const env = environment(name);
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
