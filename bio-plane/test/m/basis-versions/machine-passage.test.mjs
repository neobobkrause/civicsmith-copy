/* basis-versions R49 (T42; N834; K2496) at the module's interface: the `onMachinePassage` slot. A member's revision
   cites as hers a passage a machine proposed only when the registered read lets it stand: R6's check asks it over each
   leg of a version the revision adds (narrow's included) and, at the acceptance of a machine's version, over that
   version's legs. A refusal refuses the act unchanged and writes nothing; a read that throws or answers anything else is
   refused through inquiry's `machinePassageUnchecked` (its R62); a machine's own `suggested` version is never asked;
   with nothing registered no leg is refused. The registered read here is the test's, standing in for run-productions'
   R25: it refuses every leg resting on DOC (the "machine-proposed" passage) unless told to let it stand. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, block, version, merge, inqMd, V, MACHINE } from "./fixture.mjs";
import { listenerRefusal } from "../../../src/membership/index.mjs";
import { machinePassageUnchecked } from "../../../src/inquiry/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", Q = "INQ-2026-0001-q";
const T = "2026-09-27T00:00:00Z", ALICE = "member:alice";
const UNCHECKED = machinePassageUnchecked("probe");

/* The test's read: records each call; refuses a leg on DOC unless `taken` holds it. */
function read({ taken = false } = {}) {
  const calls = [];
  const fn = (a) => {
    calls.push(JSON.parse(JSON.stringify(a)));
    const bad = a.legs.filter((l) => l.target === DOC);
    return bad.length && !fn.taken
      ? { ok: false, reason: "PROPOSAL_NOT_TAKEN_UP", code: "PROPOSAL_NOT_TAKEN_UP", legs: bad.map((l) => [l.version, l.ord]) }
      : null;
  };
  fn.taken = taken;
  fn.calls = calls;
  return fn;
}

function setup() {
  const w = world();
  w.doc(DOC); w.doc(DOC2);
  return w;
}
const state = (w) => ({ sha: w.sha(Q), text: w.text(Q),
                        versions: w.rows(`SELECT name, state FROM inquiry_basis_versions WHERE bundle_id=? ORDER BY name`, Q) });

test("R49: onMachinePassage takes one registration; a malformed or second one is refused through membership's listenerRefusal (LISTENER_MALFORMED; LISTENER_DECLARED naming the holder), and a refused one holds no slot", () => {
  const w = setup();
  const fn = read();
  for (const [m, f] of [["", fn], [null, fn], ["run-productions", "not a function"]]) {
    const bad = w.bv.onMachinePassage(m, f);
    assert.deepEqual(bad, listenerRefusal(null, m, f), "membership's one refusal, unchanged");
    assert.equal(bad.reason, "LISTENER_MALFORMED");
  }
  /* a refused registration holds no slot: the leg on DOC lands */
  assert.equal(w.inquiry(Q, block(version("first", [DOC]))).ok, true);
  assert.deepEqual(fn.calls, []);
  assert.deepEqual(w.bv.onMachinePassage("run-productions", fn), { ok: true, module: "run-productions" });
  const second = w.bv.onMachinePassage("other", fn);
  assert.deepEqual(second, listenerRefusal({ module: "run-productions" }, "other", fn));
  assert.deepEqual([second.reason, second.module], ["LISTENER_DECLARED", "run-productions"], "by any module, naming the holder");
  assert.equal(w.bv.onMachinePassage("run-productions", fn).reason, "LISTENER_DECLARED", "the holder too");
});

test("R49: a member's version citing a passage the read refuses is refused with the read's refusal unchanged and nothing is written; negative control: once the read lets it stand, the same promotion lands", () => {
  const w = setup();
  const fn = read();
  w.bv.onMachinePassage("run-productions", fn);
  assert.equal(w.inquiry(Q, block(version("base", [DOC2]))).ok, true, "a leg on nothing a machine proposed stands");
  assert.deepEqual(fn.calls, [{ legs: [{ version: "base", ord: 0, target: DOC2 }], author: V("alice"), viewer: V("alice") }],
    "asked once over the new version's legs, the promoting member as author and viewer");
  const before = state(w);
  const offered = inqMd(Q, block(merge(version("base", [DOC2]), version("second", [DOC2, DOC]))));
  const r = w.revise(Q, offered);
  assert.deepEqual(r, { ok: false, reason: "PROPOSAL_NOT_TAKEN_UP", code: "PROPOSAL_NOT_TAKEN_UP", legs: [["second", 2]] },
    "the read's refusal, unchanged; `ord` is the leg's row in basis_version_legs");
  assert.deepEqual(state(w), before, "nothing written");
  assert.deepEqual(fn.calls[1].legs, [{ version: "second", ord: 1, target: DOC2 }, { version: "second", ord: 2, target: DOC }],
    "only the version the revision adds is asked: the held one is frozen");
  fn.taken = true;
  const ok = w.revise(Q, offered);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual(state(w).versions, [{ name: "base", state: "suggested" }, { name: "second", state: "suggested" }]);
});

test("R49: a held version is never asked again — a revision that adds none asks nothing, even when the read would refuse its legs now", () => {
  const w = setup();
  const fn = read({ taken: true });
  w.bv.onMachinePassage("run-productions", fn);
  assert.equal(w.inquiry(Q, block(version("first", [DOC]))).ok, true);
  assert.equal(fn.calls.length, 1);
  fn.taken = false;
  const r = w.revise(Q, inqMd(Q, [...block(version("first", [DOC])), `note_extra: "a revision of something else"`]));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(fn.calls.length, 1, "not asked");
  /* hiding a held version moves no composition and asks nothing */
  assert.equal(w.bv.versionHide({ target: Q, version: "first", author: ALICE, viewer: V("alice") }).ok, true);
  assert.equal(fn.calls.length, 1);
});

test("R49: a read that throws or answers anything but null or a refusal is refused MACHINE_PASSAGE_UNCHECKED through inquiry's machinePassageUnchecked, and nothing is written (fail closed)", () => {
  const answers = [() => { throw new Error("down"); }, () => undefined, () => true, () => ({ ok: true }), () => ({}),
                   () => "fine", () => Promise.resolve(null), () => Object.assign(Promise.resolve(), { ok: false })];
  for (const [i, f] of answers.entries()) {
    const w = setup();
    w.bv.onMachinePassage("run-productions", f);
    const r = w.inquiry(Q, block(version("first", [DOC2])));
    assert.equal(r.ok, false, `answer ${i}`);
    assert.deepEqual([r.reason, r.code, r.check, r.translation], ["MACHINE_PASSAGE_UNCHECKED", UNCHECKED.code, UNCHECKED.check,
                                                                  UNCHECKED.translation], `answer ${i}: inquiry's one spelling`);
    assert.equal(w.sha(Q), null, `answer ${i}: nothing written`);
    assert.equal(w.count("inquiry_basis_versions"), 0);
  }
  /* negative control: null lets it stand */
  const w = setup();
  w.bv.onMachinePassage("run-productions", () => null);
  assert.equal(w.inquiry(Q, block(version("first", [DOC2]))).ok, true);
});

test("R49: with nothing registered no leg is refused by this rule", () => {
  const w = setup();
  assert.equal(w.inquiry(Q, block(version("first", [DOC]))).ok, true);
  assert.equal(w.revise(Q, inqMd(Q, block(merge(version("first", [DOC]), version("second", [DOC]))))).ok, true);
});

test("R49: a machine's own suggested version (appendVersion, R28) is never asked; a member's appended version is", () => {
  const w = setup();
  const fn = read();
  w.bv.onMachinePassage("run-productions", fn);
  assert.equal(w.inquiry(Q, block({})).ok, true);
  const leg = { target: DOC, role: "supports", ground: "main", extent_kind: "document" };
  const ground = { ground: "main", asserted_by: "none:independent-sufficiency", at: T };
  const m = w.bv.appendVersion({ target: Q, author: MACHINE, at: T, version: { name: "machine", description: "a machine's proposal",
    relationship: "and" }, grounds: [ground], legs: [leg] });
  assert.equal(m.ok, true, JSON.stringify(m).slice(0, 300));
  assert.deepEqual(fn.calls, [], "a machine's promotion is not asked");
  const before = state(w);
  const h = w.bv.appendVersion({ target: Q, author: ALICE, at: T, version: { name: "hers", description: "her own reading",
    relationship: "and" }, grounds: [{ ...ground, asserted_by: ALICE }], legs: [leg] });
  assert.deepEqual([h.ok, h.reason], [false, "PROPOSAL_NOT_TAKEN_UP"]);
  assert.deepEqual(fn.calls.map((c) => [c.author, c.legs.map((l) => [l.version, l.target, l.extent_kind])]),
                   [[ALICE, [["hers", DOC, "document"]]]]);
  assert.deepEqual(state(w), before, "nothing written");
});

test("R49: versionAccept of a version a machine authored asks the read over its legs with the accepting member as author; a refusal refuses the act and its preview unchanged and nothing is written; negative control: once taken up it is accepted", () => {
  const w = setup();
  const fn = read();
  w.bv.onMachinePassage("run-productions", fn);
  assert.equal(w.inquiry(Q, block({})).ok, true);
  const ground = { ground: "main", asserted_by: "none:independent-sufficiency", at: T };
  assert.equal(w.bv.appendVersion({ target: Q, author: MACHINE, at: T, version: { name: "machine", description: "a machine's proposal",
    relationship: "and", author: MACHINE }, grounds: [ground],
    legs: [{ target: DOC2, role: "supports", ground: "main" }, { target: DOC, role: "supports", ground: "main" }] }).ok, true);
  assert.deepEqual(fn.calls, []);
  const before = state(w);
  const args = { target: Q, version: "machine", author: ALICE, viewer: V("alice") };
  const pre = w.bv.versionAccept({ ...args, preview: true });
  assert.deepEqual([pre.ok, pre.reason, pre.legs, pre.wrote], [false, "PROPOSAL_NOT_TAKEN_UP", [["machine", 1]], false]);
  const r = w.bv.versionAccept(args);
  assert.deepEqual(r, { ok: false, reason: "PROPOSAL_NOT_TAKEN_UP", code: "PROPOSAL_NOT_TAKEN_UP", legs: [["machine", 1]],
                        act: "accept", target: Q, version: "machine" }, "the read's refusal, unchanged");
  assert.deepEqual(state(w), before, "nothing written");
  assert.deepEqual(fn.calls.map((c) => [c.author, c.legs.map((l) => [l.version, l.ord, l.target])]),
                   [[ALICE, [["machine", 0, DOC2], ["machine", 1, DOC]]], [ALICE, [["machine", 0, DOC2], ["machine", 1, DOC]]]],
                   "once for the preview, once for the act");
  /* the other acts on a machine's version move nothing it cites as hers, and are not asked */
  assert.equal(w.bv.versionConsider({ ...args, reason: "looking at it first" }).ok, true);
  assert.equal(fn.calls.length, 2);
  fn.taken = true;
  const ok = w.bv.versionAccept(args);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.equal(w.row(`SELECT state FROM inquiry_basis_versions WHERE name='machine'`).state, "accepted");
});

test("R49: versionAccept of a member's own version is not asked by this arm (her legs were asked when written)", () => {
  const w = setup();
  const fn = read({ taken: true });
  w.bv.onMachinePassage("run-productions", fn);
  assert.equal(w.inquiry(Q, block(version("hers", [DOC]))).ok, true);
  assert.equal(fn.calls.length, 1);
  fn.taken = false;
  assert.equal(w.bv.versionAccept({ target: Q, version: "hers", author: ALICE, viewer: V("alice") }).ok, true);
  assert.equal(fn.calls.length, 1);
});

test("R49: narrow's new version is asked over its legs, the narrowed one carrying its part; a refusal refuses the narrowing and writes nothing; negative control: let stand, it lands", () => {
  const w = setup();
  const fn = read({ taken: true });
  w.bv.onMachinePassage("run-productions", fn);
  assert.equal(w.inquiry(Q, block(version("first", [DOC]))).ok, true);
  fn.taken = false;
  const before = state(w);
  const args = { target: Q, version: "first", ord: 0, author: ALICE, viewer: V("alice"), name: "first narrowed",
                 description: "points at page three, where the vote is recorded",
                 extent: { extent_kind: "pdf-page", extent_page: "2" } };
  const r = w.bv.narrow(args);
  assert.deepEqual([r.ok, r.reason, r.legs], [false, "PROPOSAL_NOT_TAKEN_UP", [["first narrowed", 1]]]);
  assert.deepEqual(state(w), before, "nothing written");
  const asked = fn.calls[1];
  assert.equal(asked.author, ALICE);
  assert.deepEqual(asked.legs.map((l) => [l.version, l.ord, l.target, l.extent_kind, l.extent_page, typeof l.extent_capture]),
                   [["first narrowed", 1, DOC, "pdf-page", 2, "string"]], "the new version's leg with its part and pin");
  fn.taken = true;
  const ok = w.bv.narrow(args);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
});

test("R49: only a machine identity is exempt — a promotion naming no author is asked (fail closed), a replay is not asked, and a raw promote by a member that moves a held machine-authored version to accepted is asked as versionAccept is", () => {
  const w = setup();
  const fn = read();
  w.bv.onMachinePassage("run-productions", fn);
  /* a blank author is asked, and refused here like a member */
  const blank = w.inquiry(Q, block(version("first", [DOC])), { author: "" });
  assert.equal(blank.reason, "PROPOSAL_NOT_TAKEN_UP", JSON.stringify(blank).slice(0, 200));
  assert.equal(fn.calls.length, 1);
  assert.equal(fn.calls[0].author, "");
  assert.equal(w.record.head(Q), null, "nothing written");
  /* a replay is not asked: the record re-stating what it said */
  const n = fn.calls.length;
  const rep = w.promotion.promote({ bundleId: Q, base: null, snapKey: "replay1", author: ALICE, replay: true,
    files: [{ path: "bundle.md", text: inqMd(Q, block(version("first", [DOC]))) }], meta: { object_type: "inquiry" } });
  assert.equal(rep.ok, true, JSON.stringify(rep).slice(0, 300));
  assert.equal(fn.calls.length, n, "a replay asks nothing");
  /* a machine's version, then a member's raw promote moving it to accepted: asked, the member as author */
  const Q2 = "INQ-2026-0002-r";
  fn.taken = true;
  assert.equal(w.inquiry(Q2, block(version("m", [DOC], { author: MACHINE })), { author: MACHINE }).ok, true);
  fn.taken = false;
  const before = fn.calls.length;
  const raw = w.revise(Q2, inqMd(Q2, block(version("m", [DOC], { author: MACHINE, state: "accepted", state_by: ALICE, state_at: T, state_reason: "" }))));
  assert.equal(raw.reason, "PROPOSAL_NOT_TAKEN_UP", JSON.stringify(raw).slice(0, 200));
  assert.deepEqual(fn.calls.slice(before).map((c) => [c.author, c.legs.map((l) => l.version)]), [[ALICE, ["m"]]]);
  /* control: once taken up, the same raw promote lands */
  fn.taken = true;
  assert.equal(w.revise(Q2, inqMd(Q2, block(version("m", [DOC], { author: MACHINE, state: "accepted", state_by: ALICE, state_at: T, state_reason: "" })))).ok, true);
});
