/* control-plane-door-reading R130 (fix round 9, G126c): THE UPLOAD REGISTERS ITS READING'S ROW, AND A FAILED REGISTRATION IS NEVER SWALLOWED.
   Through the door (`makeFetch`), `captureupload` of a document the gate refuses inline (a 22 MiB text kept in three parts): its `reading` row is
   written through `pendingadd` before any inline read. With the `STORE` binding's stub broken for `pendingadd`, the row is written through a fresh stub
   (`env.STORE.get` again); when no stub writes it, the answer says no `reading_pending` and states the refusal. Controls throughout. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, call, opCalls } from "../control-plane/harness.mjs";

const MB = 1024 * 1024, SHA = "d".repeat(64);
const ok = (result) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });
const asked = (env, route) => opCalls(env).filter((c) => c.route === route);
const partsOf = (n) => Array.from({ length: n }, (_, i) => ({ sha256: i.toString(16).padStart(64, "1"), bytes: 8 * MB }));
const doc = { file: "snapshots/x", locator: "upload:x", profile: {}, capture: { sha256: SHA, bytes: 22 * MB }, parts: partsOf(3) };
const landed = { ok: true, existed: false, capture: { sha256: SHA, bytes: 22 * MB }, receipt: { address: `upload:${SHA}` }, document: doc };

/* `pendingadd` answers by `broken(n)` on its n-th call: "throw" rejects the stub's fetch, anything else is kept */
function uploadWorld(broken) {
  let n = 0;
  const w = world({ answer: (c) => {
    if (c.route === "captureupload") return ok(landed);
    if (c.route === "pendingadd") { n += 1; if (broken(n) === "throw") return Promise.reject(new Error("the stub is broken: a reset closed it")); return ok({ ok: true }); }
    if (c.route === "readheldfor") return ok({ ok: true, read: false, why: "NO_HOME" });
    if (c.route === "extractread") return ok({ reading: { found: true }, text_units: [{ text: "x" }] });
    return null;
  } });
  return w;
}
const upload = (w) => call(w.env, { op: "captureupload", token: w.S.ann, method: "POST", body: "bytes", params: { statement: "s", name: "n", type: "text/plain" } });
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

test("R130 (G98, through the door): with the store's stub broken for the first registration, the reading's row is written through a fresh stub and the answer says reading_pending; with every try broken the answer says no reading_pending and carries a stated refusal", async () => {
  const once = uploadWorld((n) => (n === 1 ? "throw" : "ok"));
  const getsBefore = once.env.gets.length;
  const r = await quiet(() => upload(once));
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.result.reading_pending, true, "the row is held");
  const rows = asked(once.env, "pendingadd");
  assert.equal(rows.length, 2, "tried once more");
  assert.deepEqual(rows.map((c) => [c.params.kind, c.params.sha]), [["reading", SHA], ["reading", SHA]]);
  assert.ok(once.env.gets.length > getsBefore + 1, "the second try went through a fresh stub (env.STORE.get again)");
  assert.equal(asked(once.env, "extractread").length, 0, "no inline read of what the gate refuses");

  const never = uploadWorld(() => "throw");
  const n = await quiet(() => upload(never));
  assert.equal(n.status, 200, n.text);
  assert.equal(n.json.result.reading_pending, undefined, "no reading_pending while no row is held");
  assert.equal(n.json.result.reading_refused?.reason, "READING_NOT_REGISTERED", "a stated refusal");
  assert.equal(asked(never.env, "pendingadd").length, 2, "two tries, no more");
});

test("R130 (control): a registration that succeeds the first time makes no second call to pendingadd", async () => {
  const w = uploadWorld(() => "ok");
  const r = await quiet(() => upload(w));
  assert.equal(r.json.result.reading_pending, true);
  assert.equal(asked(w.env, "pendingadd").length, 1);
});
