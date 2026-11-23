import { describe, expect, it } from "vitest";
import { probeApi, shellHtml } from "../src/shell.ts";

describe("shell", () => {
  it("says the backend is reachable when the api is up", () => {
    expect(shellHtml({ api: "up" })).toContain(">Backend reachable<");
  });

  it("says the backend is unreachable when the api is down", () => {
    expect(shellHtml({ api: "down" })).toContain(">Backend unreachable<");
  });

  it("probes /api/healthz and maps ok to up", async () => {
    const calls: string[] = [];
    const fakeFetch: typeof fetch = (input) => {
      calls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      return Promise.resolve(new Response("{}", { status: 200 }));
    };
    await expect(probeApi(fakeFetch)).resolves.toEqual({ api: "up" });
    expect(calls).toEqual(["/api/healthz"]);
  });

  it("maps a non-2xx response to down", async () => {
    const fakeFetch: typeof fetch = () => Promise.resolve(new Response("", { status: 502 }));
    await expect(probeApi(fakeFetch)).resolves.toEqual({ api: "down" });
  });

  it("maps a network error to down", async () => {
    const fakeFetch: typeof fetch = () => Promise.reject(new TypeError("network"));
    await expect(probeApi(fakeFetch)).resolves.toEqual({ api: "down" });
  });
});
