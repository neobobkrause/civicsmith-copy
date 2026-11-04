/* machinery-producers over capture-requests PR 182: capture-requests' door now reads a run's paying principal as ai-runs
   answers it (`principal_ai`, ai-runs R28 since PR 96) and keeps it in the request's own `principal_claude` column, so
   the attribution a completed request carries is `principals: {plane, claude}` with `claude` the run's `principal_ai`.
   `capture-completed-unattended`'s request producer (R2, R15; index.mjs `#conditionsCaptureRequested`) reads only
   `attribution.ok`, `at_the_request_of` and `principals.plane`, and passes the attribution through on its basis.
   Confirmed with no change here: a run's request filed and drained by capture-requests' real code, its `completed`
   answer handed to this module, raises the item naming the run's member, its basis carrying both principals. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId } from "./world.mjs";
import { world as crWorld, V } from "../capture-requests/fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const ADDRESS = "https://records.example.org/minutes-2026-10";

async function completedByRun({ plane = "member:ann/tok1", claude = "member:ann" } = {}) {
  const c = crWorld().scene();
  c.run("R-1", { plane, claude });
  const asked = c.ask({ address: ADDRESS }, { caller: plane });
  assert.equal(asked.ok, true, JSON.stringify(asked).slice(0, 300));
  await c.cr.drain({});
  assert.equal(c.req(asked.request).state, "captured", JSON.stringify(c.req(asked.request)).slice(0, 300));
  return { c, request: asked.request, answer: c.cr.completed({ viewer: V("ann") }) };
}

test("notice capture-requests:182 (R2, R15): a run's request filed and drained by capture-requests' real door, with the run's paying principal read from principal_ai, raises capture-completed-unattended naming the run's member; its basis carries both principals; control: a run whose plane principal is no member draws the unnamed forms", async () => {
  const { request, answer } = await completedByRun();
  const real = answer.requests.find((r) => r.request === request);
  assert.ok(real, "the real completed read answers the request");
  assert.deepEqual(real.attribution.principals, { plane: "member:ann/tok1", claude: "member:ann" },
    "capture-requests' attribution: claude is the run's principal_ai");
  const w = world();
  w.member("ann"); w.run(`UPDATE members SET handle=? WHERE member_id=?`, "Ann Lee", "ann");
  w.bundle("INQ-1", "inquiry");
  w.fakes.captureRequests.completed = () => answer;
  const k = (n) => `queue.capture-completed-unattended.request.${n}`;
  const it = byId(w.read("ann"))[`CONDITION::capture-completed-unattended::${request}`];
  assert.ok(it, "the item stands");
  assert.equal(it.summary, word(k("summary"), { member: "Ann Lee", title: word("screen.held.untitled") }));
  assert.ok(it.detail.startsWith(word(k("detail.assistant"), { member: "Ann Lee" })), it.detail);
  assert.deepEqual(it.basis.attribution.principals, { plane: "member:ann/tok1", claude: "member:ann" });
  assert.ok(!/member:|tok1|R-1|CR-/.test(it.summary + it.detail), `no id in: ${it.summary} ${it.detail}`);

  /* control: the run's plane principal is a credential class, no member */
  const ctl = await completedByRun({ plane: "class:ai" });
  const w2 = world();
  w2.member("ann"); w2.bundle("INQ-1", "inquiry");
  w2.fakes.captureRequests.completed = () => ctl.answer;
  const u = byId(w2.read("ann"))[`CONDITION::capture-completed-unattended::${ctl.request}`];
  assert.ok(u, "the item stands");
  assert.equal(u.summary, word(k("summary.unnamed"), { title: word("screen.held.untitled") }));
  assert.ok(u.detail.startsWith(word(k("detail.unnamed"))));
});
