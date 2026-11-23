export interface SmokeStep {
  readonly name: string;
  readonly path: string;
  readonly expect: (status: number, body: string) => boolean;
}

export const SMOKE_STEPS: readonly SmokeStep[] = [
  {
    name: "proxy serves the PWA shell",
    path: "/",
    expect: (status, body) => status === 200 && body.includes("<title>Riviera Dig</title>"),
  },
  {
    name: "PWA manifest is served",
    path: "/manifest.webmanifest",
    expect: (status, body) => status === 200 && body.includes('"Riviera Dig"'),
  },
  {
    name: "api is alive through the proxy",
    path: "/api/healthz",
    expect: (status, body) => status === 200 && body.includes('"ok"'),
  },
  {
    name: "api is ready (database reachable) through the proxy",
    path: "/api/readyz",
    expect: (status, body) => status === 200 && body.includes('"ready"'),
  },
];

/** Runs every step and reports each one. Returns true only if all steps pass. */
export async function runSmoke(
  baseUrl: string,
  fetchFn: typeof fetch,
  log: (line: string) => void,
  steps: readonly SmokeStep[] = SMOKE_STEPS,
): Promise<boolean> {
  let allOk = true;
  for (const step of steps) {
    const url = new URL(step.path, baseUrl).href;
    let ok = false;
    let detail: string;
    try {
      const res = await fetchFn(url);
      const body = await res.text();
      ok = step.expect(res.status, body);
      detail = `HTTP ${String(res.status)}`;
    } catch (error) {
      detail = String(error);
    }
    log(`${ok ? "PASS" : "FAIL"} ${step.name} (${url}: ${detail})`);
    allOk &&= ok;
  }
  return allOk;
}
