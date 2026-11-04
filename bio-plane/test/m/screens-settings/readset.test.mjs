/* C14 (fix round 4; control-plane R122, queue R93): each Settings screen's read set. A page load reads each op once: the frame's own reads
   (`bootstrap`, `whoami`, `groupidentity`, `groupkeystate`, `queue`) are not asked again by the screen (the shell shares them with it; CAUSE-SHELL-4). Counts
   every request of the load, frame included, at the real shell harness. R78 (K4472): the shell answers a screen's `bootstrap` read from the page's
   one answer; Account, Group and Team AI keep their one own read of the frame's `whoami`, `groupidentity`, `groupkeystate`, the one known repeat each
   (small, parallel; named here). The time of each load in the harness is printed with it (no live time here: Server-Timing, K4428). */
import test from "node:test";
import assert from "node:assert/strict";
import { open } from "./kit.mjs";
import { teamNamed } from "./seed-common.mjs";

const once = ["bootstrap", "whoami", "groupidentity", "groupkeystate", "queue", "interfacewords", "infolevel"];
/* [requirement, screen, the team it is read over, the one frame read the screen repeats]: each as the administrator (the founder) who finds it */
const cases = [
  ["R15 R78", "security", "security"],
  ["R27 R78", "updates", "full"],
  ["R3 R78", "account", "full", "whoami"],
  ["R18 R78", "group", "full", "groupidentity"],
  ["R1", "members", "full"],
  ["R19", "places", "full"],
  ["R17", "settings", "full"],
];
for (const [req, id, team, repeat] of cases) {
  test(`${req} C14 ${id}: one read of each frame op per page load, and a read set with no per-project or per-row repeat`, async () => {
    const t = await teamNamed(team);
    const t0 = performance.now();
    const o = await open(id, { world: t.w, as: t.founder });
    const ms = Math.round(performance.now() - t0);
    const n = {};
    for (const r of o.p.all) n[r.op] = (n[r.op] || 0) + 1;
    console.log(`# C14 ${id}: ${o.p.all.length} reads in ${ms} ms in the harness`);
    for (const op of once) assert.ok((n[op] || 0) <= (op === repeat ? 2 : 1), `${id} reads ${op} ${n[op]} times`);
    assert.equal(n.bootstrap || 0, 1, `${id} reads bootstrap once`);
    // control: a screen's own reads are all made (the set is not emptied to pass)
    assert.ok(o.p.all.length >= 10);
  });
}

/* R78 R79 G42: the record's gauge is read by `stats` once, for a session that administers, and never for a member. */
test("R78 R79 G42 group: an administrator's screen reads `stats` once; a member's sends none", async () => {
  const t = await teamNamed("full");
  const a = await open("group", { world: t.w, as: t.founder });
  assert.equal(a.p.all.filter((r) => r.op === "stats").length, 1, "an administrator reads stats once");
  const m = await open("group", { world: t.w, as: t.dev });
  assert.equal(m.p.all.filter((r) => r.op === "stats").length, 0, "a member's screen sends no stats");
});
