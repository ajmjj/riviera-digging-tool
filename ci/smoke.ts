// Smoke test against the running compose stack (through the proxy, like a phone would).
// Steps join as features land: sign-in (002), dig a record, add to pile, pull, staff
// checkout in dry-run mode. Until then it checks the stack is wired end to end.
import { runSmoke } from "./lib/smoke.ts";

const baseUrl = process.env["SMOKE_BASE_URL"] ?? "http://127.0.0.1:8080";
const ok = await runSmoke(baseUrl, fetch, (line) => {
  console.log(line);
});
process.exit(ok ? 0 : 1);
