import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static checks of proxy/nginx.conf. nginx resolves a literal `proxy_pass` host once, at startup,
// so when compose recreates the api (for example `make up-dev` turning the sample flows on,
// research R17) the proxy would keep the old container address and answer 502. Upstreams are
// therefore variables, resolved through Docker's DNS. `make up` + `make smoke` prove it serves.

const conf = readFileSync("proxy/nginx.conf", "utf8");
const proxyPasses = [...conf.matchAll(/^\s*proxy_pass\s+([^;]+);/gm)].map((m) => m[1]);

describe("proxy/nginx.conf", () => {
  it("001/FR-027: resolves upstreams through Docker's DNS with a short validity", () => {
    expect(conf).toMatch(/^\s*resolver 127\.0\.0\.11 valid=\d+s\b[^;]*;/m);
  });

  it("001/FR-027: every proxy_pass names its upstream by variable, so a recreated api is found", () => {
    expect(proxyPasses).toEqual(["$api_upstream", "$web_upstream"]);
    expect(conf).toMatch(/set \$api_upstream http:\/\/api:3000;/);
    expect(conf).toMatch(/set \$web_upstream http:\/\/web:8080;/);
  });

  it("001/FR-027: /api/ still has its prefix stripped before it reaches the api", () => {
    expect(conf).toMatch(/location \/api\/ \{[^}]*rewrite \^\/api\/\(\.\*\)\$ \/\$1 break;/);
  });
});
