/* R59, R60 (T53; DEC-464): a version's leg on a member's typing says who typed and checked it as of the reading
   (`typed_at_freeze`) and as of now (`typed`, content R64's block), derived at the read; a later check changes no frozen
   composition and is no difference between two readings (R55's `legs` dimension). Driven on inquiry's real world, the
   typing and its check made through content's own `transcribe` and `transcriptionAttest` (K4990). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { inqMd, block } from "./fixture.mjs";
import { basisVersionsOf, TYPED_FROZEN_UNCHECKED_KEY, TYPED_FROZEN_CHECKED_KEY } from "../../../src/basis-versions/index.mjs";

const T0 = "2026-09-27T00:00:00Z", T_CHECK = "2026-09-27T01:00:00Z", T2 = "2026-09-27T02:00:00Z";
const Q = "INQ-2026-5391-typed";

const setup = () => {
  const w = world(); w.member("ruth"); w.member("sam"); w.member("alice");
  const bv = basisVersionsOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content });
  bv.migrate();
  return { w, bv };
};
const type = (w, doc, page = 0) => {
  const tx = w.content.transcribe({ bundleId: doc, extent: { kind: "pdf-page", page }, text: `Lot 7, Block ${page + 3}.`,
                                    transcriber: "ruth", viewer: V("ruth"), at: T0 });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  return tx.content_id;
};
const check = (w, cid, member = "sam") => {
  const r = w.content.transcriptionAttest({ contentId: cid, attestor: member, viewer: V(member), at: T_CHECK,
                                           note: "The typing matches the page." });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
};
const reading = (name, at, legs) => ({
  versions: [{ name, description: `the reading called ${name}`, relationship: "and", state: "suggested", hidden: false,
               derived_from: null, author: "member:alice", at }],
  grounds: [{ version: name, ground: "main", asserted_by: "member:alice", at }],
  legs: legs.map((l) => ({ version: name, target: l.target, role: "supports", ground: "main", ...(l.cid ? { content_id: l.cid } : {}) })),
});
const promote = (w, readings) => {
  const targets = [...new Set(readings.flatMap((r) => r.legs.map((l) => l.target)))];
  const lines = block({ refs: targets, versions: readings.flatMap((r) => r.versions),
                        grounds: readings.flatMap((r) => r.grounds), legs: readings.flatMap((r) => r.legs) });
  const r = w.promote(Q, inqMd(Q, lines));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 600));
};
const versionsOf = (bv) => {
  const r = bv.basisVersions({ id: Q, viewer: "admin" });
  assert.equal(r.ok !== false, true, JSON.stringify(r).slice(0, 300));
  return Object.fromEntries(r.versions.map((v) => [v.name, v]));
};

test("R59: a typed leg says who typed and checked it as of the reading and as of now — a version written before a check lists no checker at freeze and the checker now; one written after lists her in both", () => {
  const { w, bv } = setup();
  const DOC = "INFO-2026-5391-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const cid = type(w, DOC);
  const before = reading("before", T0, [{ target: DOC, cid }]);
  promote(w, [before]);
  let v = versionsOf(bv).before;
  assert.deepEqual(v.legs[0].typed_at_freeze, { typist: "ruth", checked_by: [], label_key: TYPED_FROZEN_UNCHECKED_KEY });
  assert.deepEqual([v.legs[0].typed.label_key, v.legs[0].typed.checkers.length], ["content.typed.unchecked", 0]);
  const composition = v.composition;
  check(w, cid);
  /* a second reading of the same typing, written after the check */
  promote(w, [before, reading("after", T2, [{ target: DOC, cid }])]);
  const vs = versionsOf(bv);
  v = vs.before;
  assert.deepEqual(v.legs[0].typed_at_freeze, { typist: "ruth", checked_by: [], label_key: TYPED_FROZEN_UNCHECKED_KEY },
    "the reading written before the check keeps its state at freeze");
  assert.deepEqual(v.legs[0].typed.checkers.map((c) => c.at), [T_CHECK], "typed lists the check now");
  assert.equal(v.legs[0].typed.label_key, "content.typed.checked");
  assert.equal(v.composition, composition, "the check changes no composition (R29)");
  const a = vs.after.legs[0];
  assert.deepEqual(a.typed_at_freeze, { typist: "ruth", checked_by: [{ checker: "sam", at: T_CHECK }], label_key: TYPED_FROZEN_CHECKED_KEY });
  assert.deepEqual(a.typed.checkers.map((c) => c.at), [T_CHECK]);
});

test("R59 control: a leg on a machine-read document carries neither typed_at_freeze nor typed", () => {
  const { w, bv } = setup();
  const DOC = "INFO-2026-5392-plain";
  w.doc(DOC, ["publisher-typed"], { chain: null });
  promote(w, [reading("plain", T0, [{ target: DOC }])]);
  const [leg] = versionsOf(bv).plain.legs;
  assert.deepEqual([Object.hasOwn(leg, "typed_at_freeze"), Object.hasOwn(leg, "typed")], [false, false]);
});

test("R60: two readings citing one typing, before and after its check, are no different in R55's compare — legs same while typed_at_freeze differs", () => {
  const { w, bv } = setup();
  const DOC = "INFO-2026-5393-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const cid = type(w, DOC);
  const before = reading("before", T0, [{ target: DOC, cid }]);
  promote(w, [before]);
  check(w, cid);
  promote(w, [before, reading("after", T2, [{ target: DOC, cid }])]);
  const c = bv.compareVersions({ target: Q, a: "before", b: "after", viewer: "admin" });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
  assert.equal(c.dimensions.legs.same, true, "a check between two readings is no difference in their legs");
  assert.equal(c.differs, 0, "no dimension differs");
  const vs = versionsOf(bv);
  assert.notDeepEqual(vs.before.legs[0].typed_at_freeze, vs.after.legs[0].typed_at_freeze, "the state at freeze differs");
  assert.equal(vs.before.composition_grades, "authored");
  assert.equal(vs.after.composition_grades, "authored");
});

test("R60 control: another typing, or the same document at another extent, is a difference in legs", () => {
  const { w, bv } = setup();
  const DOC = "INFO-2026-5394-typed";
  w.doc(DOC, ["a scanned deed", "page two"], { chain: null });
  const cid = type(w, DOC, 0), cid2 = type(w, DOC, 1);
  promote(w, [reading("one", T0, [{ target: DOC, cid }]), reading("two", T0, [{ target: DOC, cid: cid2 }])]);
  const c = bv.compareVersions({ target: Q, a: "one", b: "two", viewer: "admin" });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
  assert.equal(c.dimensions.legs.same, false);
});
