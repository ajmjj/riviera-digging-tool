// Regenerates CODEOWNERS from ci/protected-paths.json: node ci/render-codeowners.ts
import { writeFileSync } from "node:fs";
import { renderCodeowners } from "./lib/codeowners.ts";
import { prop, readJson, stringList } from "./io.ts";

const config = readJson("ci/protected-paths.json");
const paths = stringList(prop(config, "paths"), "ci/protected-paths.json paths");
writeFileSync("CODEOWNERS", renderCodeowners(paths, String(prop(config, "owner"))));
console.log("CODEOWNERS written.");
