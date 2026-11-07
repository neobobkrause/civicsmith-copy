/* wizard-scripts F2 (T53; the coordinator's ruling 17:24 on screens-ai's receipt; amends R54): the carried registry registers
   `aioptinset` on `aiproviders` and `aimine` (screens-ai R1, R6) and `projectrequest` and `projectjoin` on `aiproject`
   (screens-ai R16), acts the design file at the pinned commit does not list, each declared by its owner. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { OWNERS } from "../../../src/store-assembly/declarations.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/screen-registry.mjs";
import { SCREEN_ACTS_ADDED, screensFromFile } from "../../../src/wizard-scripts/data.mjs";

const ADDED = { aiproviders: ["aioptinset"], aimine: ["aioptinset"], aiproject: ["projectrequest", "projectjoin"] };
const DECLARED = new Set([...Object.keys(OPS), ...Object.values(OWNERS).flatMap((ops) => Object.keys(ops ?? {}))]);
const FILE = JSON.parse(readFileSync(new URL("./source/registry.json", import.meta.url), "utf8"));
const screen = (list, id) => list.find((s) => s.id === id);

test("F2 the carried registry registers aioptinset on aiproviders and aimine, projectrequest and projectjoin on aiproject, each once, after the file's own acts, owed acts unchanged", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SCREEN_ACTS_ADDED).map(([k, v]) => [k, [...v]])), ADDED);
  for (const [id, ops] of Object.entries(ADDED)) {
    const s = screen(SCREEN_REGISTRY, id);
    assert.ok(s, id);
    for (const op of ops) assert.equal(s.acts.filter((a) => a === op).length, 1, `${id}: ${op} once`);
    assert.deepEqual(s.acts.slice(-ops.length), ops, `${id}: after the file's own acts`);
    const f = screen(FILE.screens, id);
    assert.deepEqual(s.owed.map((o) => o.op), f.acts.filter((a) => a.status === "owed").map((a) => /^owed:(\S+)/.exec(a.op)[1]), `${id}: owed unchanged`);
  }
});

test("F2 every added act is an op the assembled registration declares; the carried registry is screensFromFile over the vendored file; control: the design file itself lists none of the four", () => {
  for (const op of new Set(Object.values(ADDED).flat())) assert.ok(DECLARED.has(op), `${op} declared`);
  assert.deepEqual(JSON.parse(JSON.stringify(SCREEN_REGISTRY)), screensFromFile(FILE));
  for (const [id, ops] of Object.entries(ADDED)) {
    const listed = screen(FILE.screens, id).acts.filter((a) => a.status !== "owed").map((a) => a.op);
    for (const op of ops) assert.ok(!listed.includes(op), `${id}: the file does not list ${op}`);
  }
});
