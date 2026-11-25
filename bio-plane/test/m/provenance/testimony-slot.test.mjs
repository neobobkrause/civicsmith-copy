/* provenance: the testimony path's later work as one slot (R52), and the observation's `content_id` as the slot names
   it (R28). The composition root runs the slot where the legacy store's promotion step ran that work (control-plane's
   promotion step since T19, its R42); here a step registered with the real promotion stands in for that step, its
   check and projection calling the slot's two functions, as control-plane's do. Extraction, content and
   observation-log are later in the order, so their registrations are stood in for. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { TESTIMONY_PATH } from "../../../src/provenance/index.mjs";
import { listenerRefusal, MODULE_ORDER } from "../../../src/membership/index.mjs";

/* A world whose promotion runs the slot from a step at the legacy store's old rank (after every step of layers 1–9),
   as the composition root holds it, under the name it is registered with today, control-plane's (its R42; N497). */
function slotted(opts) {
  const w = world(opts);
  const slot = w.prov.testimonySlot();
  const ran = [];
  w.promotion.registerStep("control-plane", { check: (c) => { ran.push("check"); return slot.check(c); },
                                             project: (c) => { ran.push("project"); return slot.project(c); } });
  return { w, slot, ran };
}
const observe = (w, words = "The clerk read the item twice.") =>
  w.prov.testify({ words, observedAt: "2026-09-20", title: "Read twice", author: V("ruth") });

test("R52: a registration is refused through membership's listenerRefusal, the one site of its two codes; a refused one registers nothing", () => {
  const w = world();
  const fn = () => null;
  assert.deepEqual(w.prov.onTestimony("extraction", { project: fn }), { ok: true, module: "extraction" });
  assert.deepEqual(w.prov.onTestimony("content", { check: fn }), { ok: true, module: "content" });
  assert.deepEqual(w.prov.onTestimony("observation-log", { check: fn, project: fn }), { ok: true, module: "observation-log" });
  const held = [{ module: "extraction" }, { module: "content" }, { module: "observation-log" }];
  /* A second registration by a module, whatever it carries. */
  for (const [m, spec] of [["extraction", { project: fn }], ["content", { check: fn, project: fn }]]) {
    const r = w.prov.onTestimony(m, spec);
    assert.deepEqual(r, listenerRefusal(held, m, fn));
    assert.deepEqual([r.ok, r.reason, r.code, r.module], [false, "LISTENER_DECLARED", "LISTENER_DECLARED", m]);
  }
  /* Malformed: no module name; no registration object; neither function; a check or projection that is not one. */
  const malformed = [["", { check: fn }], [null, { project: fn }], ["capture", null], ["capture", "check"], ["capture", {}],
                     ["capture", { check: null, project: undefined }], ["capture", { check: "x" }],
                     ["capture", { check: fn, project: 3 }], ["capture", { check: {}, project: fn }]];
  for (const [m, spec] of malformed) {
    const r = w.prov.onTestimony(m, spec);
    assert.deepEqual(r, listenerRefusal(held, m, null), JSON.stringify([m, spec]));
    assert.deepEqual([r.ok, r.reason, r.code], [false, "LISTENER_MALFORMED", "LISTENER_MALFORMED"]);
  }
  /* None of the refused registered: `capture` may still register once. */
  assert.deepEqual(w.prov.onTestimony("capture", { check: fn }), { ok: true, module: "capture" });
});

test("R52: on the testimony path the slot runs every check, then every projection, each once, in the modules' total order, with the path's fields and what ran before", () => {
  const { w, ran } = slotted();
  const calls = [];
  const reg = (module, answer) => w.prov.onTestimony(module, {
    check: (x) => { calls.push(["check", module, x]); return null; },
    project: (x) => { calls.push(["project", module, x]); return answer; } });
  /* Registered out of order; they run in MODULE_ORDER: extraction, then content, then observation-log. */
  reg("observation-log", { looked: true });
  reg("content", { content_id: "CNT-0001" });
  reg("extraction", { indexed: 1 });
  assert.deepEqual(["extraction", "content", "observation-log"].map((m) => MODULE_ORDER.indexOf(m) > 0), [true, true, true]);
  const t = observe(w);
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.deepEqual(ran, ["check", "project"], "the slot ran once at each of the step's two places");
  assert.deepEqual(calls.map(([k, m]) => `${k}:${m}`), ["check:extraction", "check:content", "check:observation-log",
    "project:extraction", "project:content", "project:observation-log"], "every check before any projection, each once, in order");
  /* The path's own fields, as R28 wrote them. */
  const fields = { bundleId: t.bundle_id, captureSha: t.capture_sha, words: "The clerk read the item twice.", author: V("ruth"),
                   observedAt: "2026-09-20", recordedAt: t.recorded_at };
  for (const [, , x] of calls) assert.deepEqual(Object.keys(x).sort(), [...Object.keys(fields), "earlier"].sort());
  for (const [, , x] of calls) assert.deepEqual({ ...x, earlier: undefined }, { ...fields, earlier: undefined });
  /* A check is told of no projection; each projection of the ones before it, by module. */
  assert.deepEqual(calls.filter(([k]) => k === "check").map(([, , x]) => x.earlier), [{}, {}, {}]);
  assert.deepEqual(calls.filter(([k]) => k === "project").map(([, , x]) => x.earlier),
                   [{}, { extraction: { indexed: 1 } }, { extraction: { indexed: 1 }, content: { content_id: "CNT-0001" } }]);
  /* R28: the answer's content_id is the one the slot names. */
  assert.equal(t.content_id, "CNT-0001");
});

test("R52: the projections' answers are joined, in order, into the slot's answer as `testimony`, present only on the testimony path", () => {
  const w = world();
  const slot = w.prov.testimonySlot();
  const c = (pkg) => ({ bundleId: "INFO-2026-0001-observation", pkg });
  const path = { [TESTIMONY_PATH]: { captureSha: "a".repeat(64), author: V("ruth"), observedAt: "2026-09-20",
                                     recordedAt: "2026-09-27T03:00:00Z", words: "w" } };
  /* With nothing registered the path answers an empty `testimony`, and a check nothing. */
  assert.deepEqual([slot.check(c(path)), slot.project(c(path))], [null, { testimony: {} }]);
  w.prov.onTestimony("extraction", { project: () => ({ indexed: 1, says: "extraction" }) });
  w.prov.onTestimony("content", { project: () => ({ content_id: "CNT-0007", says: "content" }) });
  w.prov.onTestimony("observation-log", { project: () => null });
  assert.deepEqual(slot.project(c(path)), { testimony: { indexed: 1, content_id: "CNT-0007", says: "content" } },
                   "joined in the modules' order, a later answer's key after an earlier's");
  /* A promotion without the testimony path: both answer nothing and nothing registered runs. */
  let asked = 0;
  w.prov.onTestimony("capture", { check: () => { asked++; return null; }, project: () => { asked++; return {}; } });
  for (const pkg of [{}, { testimony: true, "mk1-testimony-path": path[TESTIMONY_PATH] }, null])
    assert.deepEqual([slot.check(c(pkg)), slot.project(c(pkg))], [null, null], JSON.stringify(pkg));
  assert.equal(asked, 0);
  /* The slot is this instance's: a second slot object answers the same registrations. */
  assert.deepEqual(w.prov.testimonySlot().project(c(path)).testimony.content_id, "CNT-0007");
});

test("R52: the first check that refuses refuses the promotion with its refusal as it came, before anything is written; later checks are not asked", () => {
  const { w } = slotted();
  // fixtures-generic: CONTENT_EXTENT_REFUSED
  const refusal = { ok: false, reason: "CONTENT_EXTENT_REFUSED", code: "CONTENT_EXTENT_REFUSED", check: "C-45.1",
                    translation: "a stand-in row", detail: "the extent is not the document's" };
  const asked = [];
  w.prov.onTestimony("content", { check: () => { asked.push("content"); return refusal; }, project: () => { asked.push("content:p"); return {}; } });
  w.prov.onTestimony("observation-log", { check: () => { asked.push("observation-log"); return null; } });
  w.prov.onTestimony("extraction", { check: () => { asked.push("extraction"); return null; } });
  const before = w.snapshot();
  const t = observe(w);
  assert.deepEqual(t, refusal, "the refusal as it came");
  assert.deepEqual(asked, ["extraction", "content"], "in order, stopping at the first refusal; no projection ran");
  assert.deepEqual(w.snapshot(), before, "nothing written, no id spent");
});

test("R52: a projection that throws rolls the whole promotion back; nothing of it is written", () => {
  const { w } = slotted();
  const wrote = [];
  w.prov.onTestimony("extraction", { project: (x) => { w.st.sql.exec(`INSERT INTO settings (name, value, set_by, set_at) VALUES (?, ?, ?, ?)`,
                                                                       `indexed:${x.captureSha}`, "1", "test", "t"); wrote.push(1); return { indexed: 1 }; } });
  w.prov.onTestimony("content", { project: () => { throw new Error("the content row was refused"); } });
  const before = w.snapshot();
  const t = observe(w);
  assert.equal(t.ok, false, JSON.stringify(t));
  assert.match(JSON.stringify(t), /the content row was refused/);
  assert.equal(wrote.length, 1, "the earlier projection ran, and its write went with the rest");
  assert.deepEqual(w.snapshot(), before,
                   "nothing of the promotion written: no bundle, no register row, no projection's row, no id spent");
});

test("R52, R28: this module runs the slot in no step of its own; without the composition root's call, no registration runs and content_id is null", () => {
  const w = world();
  let asked = 0;
  w.prov.onTestimony("extraction", { check: () => { asked++; return null; }, project: () => { asked++; return { indexed: 1 }; } });
  w.prov.onTestimony("content", { project: () => { asked++; return { content_id: "CNT-0001" }; } });
  const t = observe(w);
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.equal(asked, 0, "provenance's own promotion step calls none of them");
  assert.equal(t.content_id, null, "no slot named a content row");
  /* The path writes the register row and the bundle only. */
  assert.equal(w.row(`SELECT authored FROM register WHERE capture_sha=?`, t.capture_sha).authored, 1);
  assert.ok(w.head(t.bundle_id));
  /* With the slot run and nothing registered, the same: content_id null. */
  const { w: w2 } = slotted();
  assert.equal(observe(w2).content_id, null);
});
