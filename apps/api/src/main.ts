import { loadConfig } from "./config.ts";
import { startService } from "./startup.ts";

// Entrypoint for both the `api` and `worker` containers (same image, different argument).
// Kept thin on purpose: the logic lives in the tested startup.ts, and this file is exercised
// by the compose smoke test.
await startService(loadConfig(process.env, process.argv[2]), process);
