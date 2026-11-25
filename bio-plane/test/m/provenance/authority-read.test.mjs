/* provenance: the read a member uses for a document's authority states the standing value once a decision is held (R66's last
   sentence, R80; K5148, WALK-FINAL-04B R146), driven as the door drives it: the ops map (`authority`) over the real modules,
   the decision made through `declareAuthority` (the method `tasks`' `taskdecide` calls, R65). Before the read existed, the
   document's `data/provenance.json` entry was the only thing a member's screen could read, and it states the acquisition-time
   value for ever (the decision lives in `authority_decisions`, never in the bundle's bytes); no test read the document as a
   member after a decision, so the stale `undetermined` went unseen. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, provDoc, infoMd, sha, V } from "./fixture.mjs";
import { PROVENANCE_ACT_CHECKS } from "../../../src/provenance/index.mjs";
import { provenanceOps } from "../../../src/provenance/ops.mjs";

const B = "INFO-2026-0001-a";
const qs = (o) => new URLSearchParams(o).toString();
const ops = (w, query = "", body = null) => provenanceOps(w.prov, new URL(`http://do/?${query}`), body);
const read = (w, body, viewer = V("ruth")) => ops(w, qs(viewer ? { viewer } : {}), body).authority();

/* A record holding one document whose register states authority `undetermined` by acquisition, as a capture writes it. */
function held(over = { authority: undefined, authority_state: "undetermined", authority_basis: "no assertion was supplied at acquisition" }) {
  const w = world({ now: "2026-09-27T03:00:00.000Z" });
  const a = w.cap("a");
  const r = w.promoteInfo(B, { captures: [a], docs: [provDoc(a, over)] });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { w, a };
}
const decide = (w, a, over = {}) => w.prov.declareAuthority({ bundle: B, capture: a.sha, outcome: "determined", authority: "City Clerk",
  basis: "named on the letterhead", by: V("ruth"), viewer: V("ruth"), ...over });
const onlyDoc = (answer) => { assert.equal(answer.ok, true, JSON.stringify(answer)); assert.equal(answer.captures.length, 1); return answer.captures[0]; };

test("R80, R66: with no decision the read states the register's acquisition-time value alone (control)", () => {
  const { w, a } = held();
  const doc = onlyDoc(read(w, { bundleId: B }));
  assert.deepEqual([doc.capture_sha, doc.path], [a.sha, a.path]);
  assert.deepEqual([doc.authority.authority_state, doc.authority.authority, doc.authority.basis, doc.authority.reviewed],
                   ["undetermined", null, "no assertion was supplied at acquisition", false]);
  assert.deepEqual(doc.authority.history.map((e) => e.source), ["register"]);
  /* a document whose register states an issuer reads determined, with it */
  const d = held({}).w;
  const named = onlyDoc(read(d, { bundleId: B })).authority;
  assert.deepEqual([named.authority_state, named.authority], ["determined", "the publisher"]);
});

test("R80, R66: after a decision the read states the standing state, issuer and dated basis, never the acquisition-time undetermined", () => {
  const { w, a } = held();
  const stale = JSON.parse(w.record.readFile(B, "data/provenance.json").text).documents[0];
  assert.equal(stale.authority_state, "undetermined", "the bundle's own entry stays as acquired");
  assert.equal(decide(w, a).ok, true);
  const doc = onlyDoc(read(w, { bundleId: B }));
  assert.deepEqual([doc.authority.authority_state, doc.authority.authority, doc.authority.basis, doc.authority.by, doc.authority.at, doc.authority.reviewed],
                   ["determined", "City Clerk", "named on the letterhead", V("ruth"), "2026-09-27T03:00:00Z", false]);
  assert.deepEqual(doc.authority.history.map((e) => e.source), ["register", "decision"]);
  /* the same answer when the capture is named, and the later decision stands */
  w.clock.now = "2026-09-28T00:00:00.000Z";
  decide(w, a, { by: V("sam"), viewer: V("sam"), outcome: "undetermined_after_review", authority: undefined, basis: "the office did not answer" });
  const later = onlyDoc(read(w, { bundleId: B, capture: a.sha })).authority;
  assert.deepEqual([later.authority_state, later.authority, later.basis, later.by, later.at, later.reviewed],
                   ["undetermined", null, "the office did not answer", V("sam"), "2026-09-28T00:00:00Z", true]);
  assert.equal(later.history.length, 3);
  /* the read is exactly what authorityOf answers: one standing value for every reader */
  assert.deepEqual(later, w.prov.authorityOf(B, a.sha));
});

test("R80: the bundle id and the capture are read from the body, else the query, and every capture of the document is listed in the order the record held them", () => {
  const w = world({ now: "2026-09-27T03:00:00.000Z" });
  const a = w.cap("a"), b = w.cap("b");
  assert.equal(w.promoteInfo(B, { captures: [a, b], docs: [provDoc(a), provDoc(b, { authority: "Mayor" })] }).ok, true);
  w.prov.declareAuthority({ bundle: B, capture: b.sha, outcome: "determined", authority: "County Recorder", basis: "signature", by: V("ruth"), viewer: V("ruth") });
  const all = read(w, { bundleId: B });
  assert.deepEqual(all.captures.map((c) => c.capture_sha), w.prov.capturesOf(B).map((c) => c.capture_sha));
  assert.deepEqual(Object.fromEntries(all.captures.map((c) => [c.capture_sha, c.authority.authority])), { [a.sha]: "the publisher", [b.sha]: "County Recorder" });
  assert.equal(ops(w, qs({ viewer: V("ruth"), bundleId: B, capture: b.sha }), null).authority().captures.length, 1, "the query names them when the body does not");
  assert.deepEqual(read(w, { bundleId: B, capture: `sha256:${b.sha.toUpperCase()}` }).captures.map((c) => c.capture_sha), [b.sha], "R5's spelling");
});

test("R80: it refuses as R64 and R65 do: no bundle, an unseen or absent one alike, a capture that is no document of it; control: a viewer who may see it reads", () => {
  const { w, a } = held();
  decide(w, a);
  assert.equal(read(w, {}).reason, "NO_BUNDLE");
  assert.equal(read(w, null).reason, "NO_BUNDLE");
  const absent = read(w, { bundleId: "INFO-2026-0404-x" });
  const unseen = read(w, { bundleId: B }, "stranger");
  assert.deepEqual([absent.ok, absent.reason], [false, "NO_SUCH_BUNDLE"]);
  assert.deepEqual([unseen.ok, unseen.reason, unseen.detail], [false, "NO_SUCH_BUNDLE", absent.detail], "unseen answers as absent");
  assert.equal("captures" in unseen, false, "an unseen document's authority is not read out");
  assert.equal(read(w, { bundleId: B }, null).reason, "NO_SUCH_BUNDLE", "no stamped viewer sees nothing");
  const other = w.cap("other");
  w.promoteInfo("INFO-2026-0002-b", { captures: [other] });
  for (const capture of [sha("nowhere"), other.sha, "not a digest"]) {
    const r = read(w, { bundleId: B, capture });
    assert.deepEqual([r.ok, r.reason, r.check], [false, "AUTHORITY_NOT_A_DOCUMENT", PROVENANCE_ACT_CHECKS.AUTHORITY_NOT_A_DOCUMENT.check], capture);
    assert.equal("captures" in r, false);
  }
  /* control */
  assert.equal(read(w, { bundleId: B, capture: a.sha }).captures[0].authority.authority, "City Clerk");
});

test("R80: it reads a record that holds no register as no captures, and writes nothing", () => {
  const { w, a } = held();
  decide(w, a);
  const before = w.snapshot();
  read(w, { bundleId: B });
  read(w, { bundleId: B, capture: a.sha });
  read(w, { bundleId: "INFO-2026-0404-x" });
  assert.deepEqual(w.snapshot(), before);
  const md = infoMd("INFO-2026-0003-c");
  assert.equal(w.promotion.promote({ bundleId: "INFO-2026-0003-c", base: null, snapKey: "k3", author: V("ruth"), files: [{ path: "bundle.md", text: md }],
    meta: { object_type: "information" }, register: [] }).ok, true);
  assert.deepEqual(read(w, { bundleId: "INFO-2026-0003-c" }), { ok: true, bundleId: "INFO-2026-0003-c", captures: [] });
});
