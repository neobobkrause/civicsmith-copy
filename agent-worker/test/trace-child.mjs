/* R87 — WHAT EACH `agent-model` CONVERSATION RECEIVES OF THE DOOR'S TRACE, on the API-key path. Run as a child by
 * `t48.test.mjs` with `--experimental-test-module-mocks`: `agent-model`'s `converse` is replaced by its real self
 * wrapped in a recorder (every importer, `agent-steps`' run code included, sees the wrapper), then the door's world is
 * loaded and each case driven at the member's interface. It prints `OUT <json>`: per case, the status and, per
 * conversation, the `trace` and `memberRef` `converse` was handed (absent when not handed). NOT a `.test.mjs`. */
import { mock } from "node:test";

const MODEL = new URL("../../agent-model/src/model.mjs", import.meta.url).href;
const real = { ...(await import(`${MODEL}?real`)) };
const seen = [];
mock.module(MODEL, { namedExports: { ...real,
  converse: async (args) => {
    seen.push({ ...("trace" in args ? { trace: args.trace } : {}), ...("memberRef" in args ? { memberRef: args.memberRef } : {}) });
    return real.converse(args);
  } } });
const world = await import("./door-world.mjs");

const out = [];
for (const c of JSON.parse(process.argv[2])) {
  seen.length = 0;
  const r = await world.drive(world.pathOf(c.k), world.BODIES[c.k](world.KEY), c.headers ?? {});
  out.push({ k: c.k, status: r.status, seen: [...seen] });
}
process.stdout.write(`OUT ${JSON.stringify(out)}\n`);
