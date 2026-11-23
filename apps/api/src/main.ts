import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDatabase } from "./db.ts";

// Entrypoint for both the `api` and `worker` containers (same image, different argument).
// Kept thin on purpose: the logic lives in tested modules, and this file is exercised by
// the compose smoke test.
const config = loadConfig(process.env, process.argv[2]);
const db = createDatabase(config.databaseUrl);
const app = buildApp({ logLevel: config.logLevel, pingDatabase: () => db.ping() });

async function shutdown(): Promise<void> {
  await app.close();
  await db.close();
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: config.port });
app.log.info({ role: config.role }, "started");
