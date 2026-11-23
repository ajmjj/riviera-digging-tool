import "./style.css";
import { probeApi, shellHtml } from "./shell.ts";

// Thin browser entrypoint; logic lives in shell.ts and is unit tested. Exercised by e2e.
const root = document.getElementById("app");
if (root !== null) {
  const status = await probeApi(fetch.bind(window));
  root.innerHTML = shellHtml(status);
}
