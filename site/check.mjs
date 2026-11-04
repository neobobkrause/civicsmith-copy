/* site's deploy check (R17, K5571 (4); test: site/test/site.test.mjs, "R17"). Run before every deploy (`npm run deploy`
 * runs it first, as `predeploy`):
 *   node check.mjs [wrangler.jsonc]    exits non-zero, naming the fault, when a deploy value is malformed
 * It reads the deploy values from the deploy configuration's `vars` and checks each as a request reads it (index.mjs
 * `check`), so a malformed WITHDRAWAL_REGISTER, or any other value, stops the deploy rather than answering 500 on every
 * request. It sends nothing anywhere and prints no value. */
import { readFileSync } from "node:fs";
import { check, ConfigError } from "./src/index.mjs";

/* The deploy configuration, its comments removed (strings kept whole). */
export function deployVars(path = new URL("wrangler.jsonc", import.meta.url)) {
  const src = readFileSync(path, "utf8").replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str ?? "");
  return JSON.parse(src).vars ?? {};
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  try {
    const r = await check(deployVars(process.argv[2] ?? new URL("wrangler.jsonc", import.meta.url)));
    console.log(`site deploy values check: ${r.listed} listed group(s) drawn, ${r.withdrawn} listing withdrawal(s) standing`);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    console.error(`site deploy check failed: ${e.message}`);
    process.exit(1);
  }
}
