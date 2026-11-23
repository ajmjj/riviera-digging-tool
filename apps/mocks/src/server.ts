import { fileURLToPath } from "node:url";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { loadOperationFixtures, registerCommonGroundRoutes } from "./common-ground.ts";
import { Control, registerControlRoutes } from "./control.ts";
import { loadReleaseFixtures, registerDiscogsRoutes } from "./discogs.ts";

export const DEFAULT_FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));

export interface MocksOptions {
  readonly logLevel: string;
  readonly fixturesDir?: string;
}

/** Builds the mocks server (contracts/mocks.md). Fixtures are read and validated up front. */
export function buildMocksServer(options: MocksOptions): FastifyInstance {
  const fixturesDir = options.fixturesDir ?? DEFAULT_FIXTURES_DIR;
  const operations = loadOperationFixtures(join(fixturesDir, "common-ground"));
  const releases = loadReleaseFixtures(join(fixturesDir, "discogs"));
  const control = new Control();

  const app = Fastify({
    logger: { level: options.logLevel, redact: ["req.headers.authorization"] },
  });
  registerControlRoutes(app, control);
  registerCommonGroundRoutes(app, control, operations);
  registerDiscogsRoutes(app, control, releases);
  return app;
}
