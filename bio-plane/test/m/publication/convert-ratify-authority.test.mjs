/* Converted from `bio-plane/test/ratify-authority.test.mjs` (REC-140 / D-431, BIO_Publication_v0_1.md §3 rule 2), publication's
   share only: R38 "rests on" is the published graph's serve edges (a `relates_to` reference counts, a prepared case
   contributes nothing), and R7/R38 answer byte-identically whether a hidden project has prepared a case (§8c; C-58.3 is
   ratification's refusal, built on these reads). The old suite, kept by K619, was deleted in T20; its authority, delivery, sight and
   catalogue arms are other modules' shares, and its §8 structural arm (counting `publishedGraphEdges(` in the source) is a
   source-text arm and is not converted. Driven at publication's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, SIG } from "./fixture.mjs";
import { publishedGraphEdges, RESTING_PINS_MAX } from "../../../src/publication/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const G = "INQ-2026-9470-lead", INFO = "INFO-2026-9470-memo";
const G2a = "INFO-2026-9470-signer", G2b = "INFO-2026-9470-deliverer", G3 = "INFO-2026-9470-served";
const NOT_CITED = "INFO-2026-9470-uncited";
const roster = (id, pin) => [{ bundle_id: id, version_sha: pin, role: "load_bearing" }];

/* G rests on four bundles: INFO by a basis leg (`cites`) and G2a, G2b, G3 by reference only (`relates_to`, no basis leg). */
function fourResting() {
  const w = world();
  w.member("iris"); w.member("gus");
  const proj = w.project("Transfers", "iris");
  for (const d of [INFO, G2a, G2b, G3, NOT_CITED]) w.doc(d);
  w.inquiry(G, { legs: [{ target: INFO }], refs: [{ target: INFO, rel: "cites" },
    { target: G2a, rel: "relates_to" }, { target: G2b, rel: "relates_to" }, { target: G3, rel: "relates_to" }] });
  const pin = w.head(G);
  w.prepare("CASE-2026-9470", 1, { project: proj, roles: [{ target: G, version_sha: pin }], author: "iris" });
  return { w, proj, pin };
}
const RESTING = [INFO, G2a, G2b, G3];

test("R38 what a ratified case's finding rests on is the published graph's serve edges: every reference counts, a relates_to as a basis leg does, and a prepared (unsigned) case contributes nothing", () => {
  const { w, proj, pin } = fourResting();
  /* the finding's own bytes: one basis leg, four references */
  const fm = parseFrontmatter(w.text(G)).data;
  assert.deepEqual(fm.basis.map((l) => l.target), [INFO]);
  const serve = publishedGraphEdges(fm).filter((e) => e.disclosure === "serve");
  assert.deepEqual(serve.map((e) => [e.to, e.kind]).sort(),
    [[INFO, "cites"], [G2a, "relates_to"], [G2b, "relates_to"], [G3, "relates_to"]].sort());
  const none = { findings: [], limit: RESTING_PINS_MAX, cursor: null };
  /* PREPARED ONLY: nothing rests on anything, for every bundle, and no case pins G */
  for (const id of [...RESTING, NOT_CITED, G]) assert.deepEqual(w.p.ratifiedFindingsRestingOn(id), none, `${id} while prepared`);
  assert.deepEqual(w.p.pinnedCaseEditionsOf(G, pin), []);
  for (const id of RESTING) assert.deepEqual(w.p.caseClaimsOf(id), [], `${id} is in no case`);
  /* RATIFIED: exactly the serve-edge targets answer G, and nothing else does */
  assert.equal(w.signCase("CASE-2026-9470", 1, { project: proj, signer: "iris", roster: roster(G, pin) }).ok, true);
  const rests = { findings: [{ case_id: "CASE-2026-9470", finding: G, project: proj }], limit: RESTING_PINS_MAX, cursor: null };
  for (const id of RESTING) assert.deepEqual(w.p.ratifiedFindingsRestingOn(id), rests, `${id} rests under G`);
  for (const id of [NOT_CITED, G]) assert.deepEqual(w.p.ratifiedFindingsRestingOn(id), none, `${id} does not`);
  const answered = [...RESTING, NOT_CITED].filter((id) => w.p.ratifiedFindingsRestingOn(id).findings.length);
  assert.deepEqual(answered.sort(), serve.map((e) => e.to).sort(), "the rests-on set IS the serve-edge set, not the basis legs");
  assert.deepEqual(w.p.pinnedCaseEditionsOf(G, pin), [{ case_id: "CASE-2026-9470", edition: 1, role: "load_bearing" }]);
  /* the evidence is no case member: no claim on it, before or after */
  for (const id of RESTING) assert.deepEqual(w.p.caseClaimsOf(id), []);
});

test("R38 identity: the graph a ratified finding is published with is the same serve set its rests-on reads — the published target served, the unpublished held, nothing dropped", () => {
  const { w, proj, pin } = fourResting();
  assert.equal(w.signCase("CASE-2026-9470", 1, { project: proj, signer: "iris", roster: roster(G, pin) }).ok, true);
  /* G3 is published first (as the evidence before its finding), then G with its graph read at the pinned bytes */
  assert.equal(w.signFinding(G3, { signer: "iris", sig: SIG(3) }).ok, true);
  const edges = publishedGraphEdges(parseFrontmatter(w.text(G)).data);
  const fin = w.signFinding(G, { signer: "iris", edges });
  assert.deepEqual([fin.ok, fin.edges], [true, { serve: 1, name: 0, held: 3, dropped: 0 }]);
  const servedOrHeld = [
    ...w.rows(`SELECT to_bundle FROM published_edges WHERE from_bundle=? AND disclosure='serve'`, G),
    ...w.rows(`SELECT to_bundle FROM published_held_references WHERE from_bundle=? AND linked_at IS NULL`, G)].map((r) => r.to_bundle);
  const restsOn = [...RESTING, NOT_CITED].filter((id) => w.p.ratifiedFindingsRestingOn(id).findings.some((f) => f.finding === G));
  assert.deepEqual(servedOrHeld.sort(), restsOn.sort(), "served + held = what rests-on answers");
  assert.deepEqual(w.rows(`SELECT to_bundle FROM published_edges WHERE from_bundle=? AND disclosure='serve'`, G).map((r) => r.to_bundle), [G3]);
  /* its own basis document published after it: the held reference becomes a served edge; the two others stay held */
  const after = w.signFinding(INFO, { signer: "iris", sig: SIG(4) });
  assert.deepEqual([after.ok, after.heldLinked], [true, 1]);
  assert.deepEqual(w.rows(`SELECT to_bundle FROM published_edges WHERE from_bundle=? AND disclosure='serve' ORDER BY to_bundle`, G)
    .map((r) => r.to_bundle), [G3, INFO].sort());
  for (const id of RESTING) assert.equal(w.p.ratifiedFindingsRestingOn(id).findings.length, 1, `${id} still rests under G`);
});

test("R7 R38 the reads C-58.3 is built on answer byte-identically whether or not a hidden project has prepared a case over a finding resting on the bundle", () => {
  const XB = "INFO-2026-9472-unseen", HF = "INQ-2026-9472-hidden", F = "INQ-2026-9473-other", Y = "INFO-2026-9473-other";
  const w = world();
  w.member("iris"); w.member("vic");
  /* a ratified case over another finding, so the pages read a real pin (the non-empty guard): it rests on Y, not XB */
  const open = w.project("Open", "iris");
  w.doc(Y); w.doc(XB);
  w.inquiry(F, { legs: [{ target: Y }] });
  const fpin = w.head(F);
  w.prepare("CASE-2026-9473", 1, { project: open, roles: [{ target: F, version_sha: fpin }], author: "iris" });
  assert.equal(w.signCase("CASE-2026-9473", 1, { project: open, signer: "iris", roster: roster(F, fpin) }).ok, true);
  assert.equal(w.signFinding(F, { signer: "iris" }).ok, true);
  const xsha = w.head(XB);
  const reads = () => JSON.stringify({
    rests: w.p.ratifiedFindingsRestingOn(XB),
    restsPaged: [1, 2, 1000].map((limit) => w.p.ratifiedFindingsRestingOn(XB, { limit })),
    restsAfter: w.p.ratifiedFindingsRestingOn(XB, { after: `CASE-2026-9473#${F}#${fpin}` }),
    pinned: w.p.pinnedCaseEditionsOf(XB, xsha),
    claims: w.p.caseClaimsOf(XB),
    registry: w.p.publishedRegistryFor(XB, [HF]),
    caseRegistry: w.p.publishedCaseRegistryFor(["CASE-2026-9472", "CASE-2026-9473"]),
    targets: w.p.publishedTargets([XB, HF]),
    editions: w.p.publishedEditionsOf({ finding: XB }),
  });
  const before = reads();
  assert.equal(JSON.parse(before).rests.findings.length, 0);
  assert.deepEqual(Object.keys(JSON.parse(before).caseRegistry), ["CASE-2026-9473"], "the guard: a ratified case answers");
  /* a project vic is in no part of, whose finding cites XB by reference, prepares (does not sign) a case over it */
  const hidden = w.project("Hidden", "iris");
  w.inquiry(HF, { refs: [{ target: XB, rel: "relates_to" }] });
  const hpin = w.head(HF);
  w.prepare("CASE-2026-9472", 1, { project: hidden, roles: [{ target: HF, version_sha: hpin }], author: "iris" });
  assert.deepEqual(w.p.caseClaimsOf(HF), ["CASE-2026-9472"], "the preparation is real: it claims its own finding");
  const after = reads();
  assert.equal(after, before, "byte for byte the answers from before the hidden project existed");
  assert.equal(after.includes(hidden), false, "the hidden project is named nowhere");
  /* the positive control: signed, the same case does count, so the preparation was not ignored for want of an edge */
  assert.equal(w.signCase("CASE-2026-9472", 1, { project: hidden, signer: "iris", sig: SIG(7), roster: roster(HF, hpin) }).ok, true);
  assert.deepEqual(w.p.ratifiedFindingsRestingOn(XB).findings, [{ case_id: "CASE-2026-9472", finding: HF, project: hidden }]);
});
