/* The provider notice interface-shell:172 (PR 172: R20, Routes). The assistant is reachable for a member when `op=assistantstate` answers
   `on: true` and `op=aipathready` answers `ready` (the plane's one combined read over every account the cascade can choose); the alpha's
   `groupkeystate`, `accountreference` and `subscriptionsignin` are no longer asked. This module's screens offer writing help only while
   `view.reachable` (notes R6, group R40, identity, bias, grouprules, translations), which the shell now derives from those two reads, so the
   screens are confirmed unchanged: each follows the shell's reachability. The tests' frame (the kit) answers the new reads and filters
   them where a screen's own reads are counted. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, open } from "./kit.mjs";
import { assistantTeam, writingHelp } from "./seed-account.mjs";
import { R95_RETIRED } from "./r95.mjs";

const help = (o) => acts(o.tree).filter((b) => b.attrs["data-act"] === "writinghelp");

test("notice interface-shell:172 (R6; interface-shell R20): with the team's account on, notes offers writing help while aipathready answers ready, and none when the path answers a not-ready state or the assistant is off; the frame asks assistantstate and aipathready and no retired read", async () => {
  const { w, dev } = await assistantTeam();
  const ready = await open("notes", { world: w, as: dev, table: writingHelp("dev") });
  assert.ok(help(ready).length >= 1, "reachable: writing help is offered");
  const asked = new Set(ready.p.all.map((r) => r.op));
  assert.ok(asked.has("assistantstate") && asked.has("aipathready"), [...asked].join(", "));
  for (const op of R95_RETIRED) assert.ok(!asked.has(op), `${op} is not asked`);
  for (const [why, table] of [["the path is not ready", { aipathready: { ok: true, result: { state: "auth_failed" } } }], ["the assistant is off", { assistantstate: { ok: true, result: { ok: true, on: false } } }],
    ["aipathready does not answer", { aipathready: "none" }]]) {
    const o = await open("notes", { world: w, as: dev, table: { ...writingHelp("dev"), ...table } });
    assert.equal(help(o).length, 0, `${why}: no writing help`);
  }
});
