/* R21: the deploy check on this Worker's wrangler.jsonc. Exit 1, naming each problem, when it may not be deployed. */
import { readFileSync } from "node:fs";
import { deployCheck, readJsonc } from "../src/deploy-check.mjs";

const problems = deployCheck(readJsonc(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8")));
for (const p of problems) console.error(`ai-issuer deploy check: ${p}`);
process.exit(problems.length ? 1 : 0);
