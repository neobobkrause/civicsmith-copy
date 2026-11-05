/* citation R26, R27 (T53; DEC-464; K5525): a member's typing of a page is citable at once, judged as any held content id,
   and a leg on it names who typed it and who has checked it, by content's keys, as the caller names each member. At the
   module's interface, over the real `content` (its `transcribe`, `transcriptionAttest`) and the real `inquiry` write. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inqMd } from "./fixture.mjs";

const ANN = { viewer: V("ann"), owner: "o", author: "member:ann", identity: V("ann") };
const DOC = "INFO-2026-0001-doc", OTHER = "INFO-2026-0002-doc", Q = "INQ-2026-0001-q";

function setup() {
  const w = world({ inquiry: true });
  w.info(DOC); w.info(OTHER); w.inquiry(Q);
  const typing = (doc, typist = "vera") => {
    const t = w.content.transcribe({ bundleId: doc, extent: { kind: "pdf-page", page: 1 }, text: "Lot 7, Block 3.",
                                     transcriber: typist, viewer: V(typist) });
    assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
    return t.content_id;
  };
  const cite = async (cid, more = {}) => w.cit.cite({ project: Q, handle: await w.select([DOC]), ...ANN, role: "supports",
                                                       extent: { content_id: cid }, ...more });
  return { w, typing, cite };
}

test("R26: a member cites a typing no second member has checked onto a question; the leg is in the basis with that content id", async () => {
  const { w, typing, cite } = setup();
  const cid = typing(DOC);
  const r = await cite(cid);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.deepEqual(r.cited, [DOC]);
  const leg = w.fm(Q).basis.find((l) => l.target === DOC);
  assert.equal(leg.content_id, cid);
  assert.equal(leg.role, "supports");
  assert.equal(leg.grade, undefined, "no capture grade assumed (R8)");
});

test("R26, controls: another document's typing is refused C-45.6; a hidden question answers as an absent one", async () => {
  const { w, typing, cite } = setup();
  const theirs = typing(OTHER);
  const before = w.md(Q);
  const r = await cite(theirs);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "BASIS_REFUSED", JSON.stringify(r).slice(0, 400));
  assert.ok(JSON.stringify(r.findings).includes("C-45.6"), JSON.stringify(r.findings));
  assert.equal(w.md(Q), before, "nothing written");
  const cid = typing(DOC);
  /* A question in ann's hidden case (record-core R34's `project`), so vera may not see it. */
  const HQ = "INQ-2026-0002-q";
  w.put(HQ, inqMd(HQ, [`project: ${w.project("Hidden case", "ann")}`]));
  const VERA = { viewer: V("vera"), owner: "v", author: "member:vera", identity: V("vera") };
  const hv = await w.select([DOC], { viewer: V("vera"), owner: "v" });
  const part = { content_id: cid };
  const hidden = w.cit.cite({ project: HQ, handle: hv, ...VERA, role: "supports", extent: part });
  const absent = w.cit.cite({ project: "INQ-2026-0099-none", handle: hv, ...VERA, role: "supports", extent: part });
  assert.equal(hidden.ok, false);
  assert.deepEqual({ ...hidden, project: null }, { ...absent, project: null }, "a hidden question answers as an absent one");
  assert.equal(w.fm(HQ).basis, undefined, "nothing written");
});

test("R27: an unchecked typing's leg names its typist and no checker; after a second member checks it the leg read again lists the checker; the Session Log names the typist", async () => {
  const { w, typing, cite } = setup();
  const cid = typing(DOC);
  const names = { vera: "Vera", ivy: "Ivy" };
  const r = await cite(cid, { names });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const t = r.legs[0].typed;
  assert.equal(t.label_key, "content.typed.unchecked");
  assert.deepEqual([t.typist.name, t.checkers, t.checked], ["Vera", [], false]);
  assert.ok(w.md(Q).includes(t.label), "the Session Log entry carries the typed label, naming the typist");
  assert.ok(t.label.includes("Vera"));
  const att = w.content.transcriptionAttest({ contentId: cid, attestor: "ivy", viewer: V("ivy"), note: "compared with the page" });
  assert.equal(att.ok, true, JSON.stringify(att).slice(0, 300));
  const after = w.cit.typedOf({ contentId: w.fm(Q).basis[0].content_id, viewer: V("ann"), names });
  assert.equal(after.label_key, "content.typed.checked");
  assert.deepEqual(after.checkers.map((c) => c.name), ["Ivy"]);
  assert.equal(after.typist.name, "Vera");
  for (const v of [JSON.stringify(r.legs[0]), JSON.stringify(after)])
    assert.ok(!/civicsmith|original/i.test(v), "no field calls the words Civicsmith's or the original");
});

test("R27, controls: a machine-text leg has no typed information; a typist passed as \"a member of the team\" is that, and no handle appears", async () => {
  const { w, typing, cite } = setup();
  const plain = w.cit.cite({ project: Q, handle: await w.select([DOC]), ...ANN, role: "supports",
                             extent: { extent_kind: "pdf-page", extent_page: "2" } });
  assert.equal(plain.ok, true, JSON.stringify(plain).slice(0, 300));
  assert.equal(plain.legs[0].typed, undefined);
  const cid = typing(DOC);
  const r = await cite(cid, { names: { vera: "a member of the team" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(r.legs[0].typed.typist.name, "a member of the team");
  assert.ok(!JSON.stringify(r.legs[0].typed).includes("vera"), "the typist's handle appears nowhere");
  assert.ok(!w.md(Q).split("## Session Log")[1].includes("vera"), "nor in the Session Log");
  assert.equal(w.cit.typedOf({ contentId: "0".repeat(64), viewer: V("ann") }), null, "not a typing: null");
});
