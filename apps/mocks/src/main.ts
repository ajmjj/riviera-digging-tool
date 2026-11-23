import { buildMocksServer } from "./server.ts";

// Entry point of the local Common Ground and Discogs mocks (specs/001-observability-baseline,
// contracts/mocks.md; 001/FR-013). Runs only behind the compose profile `dev`. Kept thin: the
// logic lives in tested modules.
const port = Number(process.env["PORT"] ?? "4000");
const app = buildMocksServer({ logLevel: process.env["LOG_LEVEL"] ?? "info" });

process.once("SIGTERM", () => void app.close());
process.once("SIGINT", () => void app.close());

await app.listen({ host: "0.0.0.0", port });
