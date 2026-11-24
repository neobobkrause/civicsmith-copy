/* screens-action, fix round 4 (C14, this screens' part; K4429; P9, P10): the read set of each screen, asserted. A screen asks for what it
   draws once: no op twice in a load, none of the frame's `bootstrap` (control-plane R122: the page reads it once and hands it to the frame
   and the screen), no per-project repeat (`projectquestions`, `determinations` once on a plan), and the member's `queue` list only where
   the screen draws the member's own items (`dash-action`, R30; queue R93: the frame reads the count). The time of each read on the
   smoke copy is in the job record. */
import test from "node:test";
import assert from "node:assert/strict";
import { SHELL_OPS } from "../../../src/interface-shell/index.mjs";
import { open, ROUTES, DATA_PLANE, PROJECT, ACTION_ID } from "./page.mjs";
import { SCREENS } from "../../../src/screens-action/index.mjs";

const PATHS = { ...ROUTES, "request on a project": `/app/request/${PROJECT}`, "plan on a project": `/app/plan/${PROJECT}`, "start-send on an action": `/app/start-send/${ACTION_ID}` };
/* the ops each load asks for beyond the shell's own, each exactly once (E9, K4557: `projectlist` on the screens that offer the send steps, her place in the action's project) */
const OWN = {
  plan: ["determinations", "list", "memberlist", "plan", "projectquestions", "standards"],
  "start-send": ["affordances", "list", "memberlist", "optionstartpreview", "plan", "projectquestions"],
  request: ["action", "filingsfor", "list", "memberlist", "profiles", "projectlist", "stakeatpreparation", "templatesforaction"],
  action: ["action", "affordances", "filingsfor", "heldcaptures", "list", "memberlist", "pressurefor", "procedureguides", "profiles", "projectlist", "remindersfor", "templatesforaction"],
  matter: ["consequencesof", "determination", "escalation", "escalationstatus", "list", "standards"],
  "help-records": ["profiles"],
  actionnew: ["affordances", "list", "projectquestions"],
  hold: ["action", "holdsdue", "holdsplaced", "list", "memberlist", "projectlist"],
  holdnotice: ["list"],
  counsel: ["action", "list"],
  "dash-action": ["action", "actions", "affordances", "checkpointsdue", "filingsfor", "list", "profiles", "projectlist"],
  "request on a project": ["entitieskind", "list", "peopledirectory", "profiles"],
  "plan on a project": ["list", "plans"],
  "start-send on an action": ["action", "affordances", "filingsfor", "list", "memberlist", "projectlist", "stakeatpreparation"],
};

/* fix round 10 (R3, R18): the language the draft is prepared in is read where a text is prepared; the standards' citations where a determination is named */
const LANGUAGE = ["grouplanguages", "memberlanguage"];
for (const id of ["request", "start-send on an action"]) OWN[id] = [...OWN[id], ...LANGUAGE].sort();

for (const [id, path] of Object.entries(PATHS)) {
  test(`C14 (${id}): the screen asks for each of its reads once, and for none of the frame's again`, async () => {
    const p = await open(path, DATA_PLANE);
    const own = {}, frame = {};
    for (const r of p.requests) if (r.op) (SHELL_OPS.includes(r.op) ? frame : own)[r.op] = ((SHELL_OPS.includes(r.op) ? frame : own)[r.op] || 0) + 1;
    assert.deepEqual(Object.keys(own).sort(), OWN[id], "the screen's own reads");
    for (const [op, n] of Object.entries(own)) assert.equal(n, 1, `${op} once, not ${n} times`);
    assert.equal(frame.bootstrap, 1, "one bootstrap per load");
    // the member's queue is read by the frame (once, until it reads the count) and by no screen but the dashboard of the Action area
    assert.ok((frame.queue || 0) + (own.queue || 0) <= (id === "dash-action" ? 2 : 1), "the queue list is not read again by this screen");
    // the team's name is the frame's; a screen that draws it for the matter's stake (`Sent with`) reads it once more, the one known repeat
    assert.ok(frame.groupidentity <= (/^(request|start-send)/.test(id) && path.includes("ACTN-") ? 2 : 1), "groupidentity");
  });
}

test("C14: no screen's declared reads name `bootstrap`, or the queue except the Action dashboard's own, or one op twice", () => {
  const view = { subject: ACTION_ID, ui: {}, me: {}, reachable: false, parts: {} };
  for (const s of SCREENS) {
    for (const subject of [ACTION_ID, PROJECT, "PLN-2026-aaaaaaaaaaaaaaaa-plan~opt-1", "CONF-2026-dddddddddddddddd-determination~ESC-2026-eeeeeeeeeeeeeeee-escalation"]) {
      let reads;
      try { reads = typeof s.reads === "function" ? s.reads({ ...view, subject }) : s.reads; } catch { continue; }
      const ops = Object.values(reads || {}).map((r) => r.op);
      assert.equal(new Set(ops).size, ops.length, `${s.id} (${subject}): an op declared twice`);
      assert.ok(!ops.includes("bootstrap"), `${s.id}: bootstrap is the frame's`);
      if (s.id !== "dash-action") assert.ok(!ops.includes("queue"), `${s.id}: the queue list is the Queue screen's`);
    }
  }
});
