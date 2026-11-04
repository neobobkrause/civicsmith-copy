/* ratification's world for a /10 case document's passage blocks (R62, R63; `case-catalogue` R7, R8; `case-grammar`
   R35–R37): the module's own case of `preflight.test.mjs`, signed by alice (the project's owner, with an attesting key),
   its `passages:`, `grading_facts:`, `ungraded_passages:` and `typed_passages:` blocks written by `case-grammar`'s own
   writers, as op=publish would sign them. `act` is `op=caseratify` through the Worker half, `preflight` R18's
   pre-flight over the same bytes, and `scheduled` R42's scheduled publisher over a waiting entry signed over them. */
import assert from "node:assert/strict";
import { world, plane, newKey, signCase, cleanCase, fmText, CASE_BODY, V } from "./fixture.mjs";
import { caseRatifyOp, publishAtOp } from "../../../src/ratification/ops.mjs";
import { caseConclusionRowLines } from "../../../src/ratification/index.mjs";
import { CASE_DOCUMENT_FORMAT, passagesLines, gradingFactsLines, ungradedPassagesLines, typedPassagesLines }
  from "../../../src/case-grammar/index.mjs";

export const Q1 = "INQ-2026-0001-first", CASE = "CASE-2026-0001";
export const V10 = CASE_DOCUMENT_FORMAT;
const OWN = { version: "first", claim: "the council approved it", falsifier: "f", falsifier_override: null,
              by: "member:alice", at: "2026-09-27T10:00:00Z" };
export const LATER = "2026-10-09T13:30:00.000Z";
const AT = { date: "2026-10-09", time: "09:30" };

export const P1 = { finding: Q1, ord: 1, content_id: "c".repeat(64), capture_sha: "d".repeat(64), extent: null, chain: null, quoted: null };
export const P2 = { ...P1, ord: 2, content_id: "e".repeat(64) };
export const TYPED = { ...P1, chain: [{ step: "typed", member: "bo" }] };
export const keyOf = (p) => ({ finding: p.finding, ord: p.ord, content_id: p.content_id });
export const ungraded = (...ps) => ungradedPassagesLines(ps.map(keyOf));
export const typedRow = (p, o = {}) => typedPassagesLines([{ ...keyOf(p), typed_at: "2026-10-02T10:00:00Z", typist_level: "group", checkers: [], ...o }]);

/* `passages`, their grading facts and `lines` (the statement blocks) on the module's clean case, at `format`. With
   `passages` null the document carries no passage block at all (a pre-format document is the fixture's own /6). */
export async function passagesWorld({ format = V10, passages = [P1, P2], facts = [], lines = [], edition = 1 } = {}) {
  const queued = [];
  const ps = { registerScheduledPublisher: () => ({ ok: true }), scheduledEditions: () => ({ editions: [], cursor: null }),
               scheduleEdition: (a) => (queued.push(a), { ok: true, case: a.case, edition: a.edition, state: "waiting",
                                                         at: { ...a.at, zone: "America/Halifax" }, publish_at: LATER }) };
  const w = world({ schedule: ps });
  const key = await newKey();
  w.member("alice", { signer: key }); w.member("bo");
  const P = w.project("Team", "alice", { joined: ["bo"] });
  w.inquiry(Q1);
  w.bv.conc.set(w.key(P, Q1), OWN);
  const conc = w.r.caseConclusionFor(P, Q1, V("alice"), "open");
  const doc = { ...cleanCase({ caseId: CASE, edition, project: P, members: [{ id: Q1, pin: w.sha(Q1) }] }), ...(format ? { format } : {}) };
  w.publication.stampsOf = () => ({ ok: true, stamps: [] });
  w.r.registerHoldReader({ holdsOn: () => ({ held: false }) });
  const s = { w, P };
  /* (re)prepares the document at this edition with `lines` (and `facts`), as op=publish would store new bytes, and
     signs them */
  s.prepare = async (lines_, facts__ = facts) => {
    const blocks = passages ? [...passagesLines(passages), ...gradingFactsLines(facts__), ...lines_] : lines_;
    s.text = fmText(doc, { raw: ["case_conclusions:", ...caseConclusionRowLines(Q1, conc), ...blocks], body: CASE_BODY });
    s.docSha = w.caseDoc(CASE, edition, s.text);
    s.sig = await signCase(key, CASE, edition, s.docSha);
    return s;
  };
  await s.prepare(lines);
  const facts_ = () => ({ ok: true, doc: { case_id: CASE, edition, doc_sha: s.docSha, text: s.text },
                          attribution: w.caseTensions.attributionFacts({ text: s.text, case_id: CASE, edition }),
                          signers: w.credentials.attestingKeys(), memberBasis: {}, priorCase: null });
  s.act = async () => {
    w.pub.facts.set(`${CASE}#${edition}`, facts_());
    const p = plane(w, {});
    return caseRatifyOp(p.request({ caseId: CASE, edition, expectedSha: s.docSha, sig: s.sig }), p.stub, p.ctx);
  };
  s.preflight = () => w.r.caseRatifyPreflight({ text: s.text, signer: "alice", viewer: V("alice") });
  /* `op=publishat` (R40) through the Worker half, at a set time; what it held is `queued` (publish-schedule's stand-in) */
  s.publishAt = async () => {
    w.pub.facts.set(`${CASE}#${edition}`, facts_());
    const p = plane(w, {});
    return publishAtOp(p.request({ caseId: CASE, edition, expectedSha: s.docSha, sig: s.sig, at: AT }), p.stub, p.ctx);
  };
  s.queued = queued;
  /* R42 at the set time, over a waiting entry signed over these bytes, holding `checked` (what the signing recorded) */
  s.scheduled = (checked = null) => w.r.publishScheduled({ case: CASE, edition, doc_sha: s.docSha, signature: s.sig, signer: "alice",
    delivered_by: "member:alice", at: { ...AT, zone: "America/Halifax" }, publish_at: LATER, state: "waiting", checked }, LATER);
  s.signed = () => w.row(`SELECT ratified_at FROM case_documents WHERE case_id=? AND edition=?`, CASE, edition)?.ratified_at ?? null;
  return s;
}

export const gateChecks = (refusal) => (refusal && Array.isArray(refusal.findings) ? refusal.findings.map((x) => x.check) : []);
export const gateOf = (pf) => pf.refusals.find((r) => r.reason === "GATE_REFUSED") || null;
export const envelopeless = ({ store, tokenClass, ...rest }) => rest;

/* The act refuses GATE_REFUSED naming exactly `checks`, the pre-flight lists the same refusal less the act's envelope,
   and nothing was signed. */
export async function refusedAlike(s, checks, what) {
  const pf = s.preflight();
  assert.deepEqual(pf.refusals.map((r) => r.reason), ["GATE_REFUSED"], `${what}: the pre-flight`);
  assert.deepEqual(gateChecks(gateOf(pf)), checks, `${what}: the pre-flight's findings`);
  const r = await s.act();
  assert.deepEqual([r.status, r.body.reason], [409, "GATE_REFUSED"], `${what}: the act`);
  assert.deepEqual(gateOf(pf), envelopeless(r.body), `${what}: the act's refusal, less its envelope`);
  assert.equal(s.signed(), null, `${what}: nothing was signed`);
}

/* The pre-flight is ready and the act commits. */
export async function signs(s, what) {
  assert.deepEqual(s.preflight().refusals, [], `${what}: the pre-flight`);
  const r = await s.act();
  assert.deepEqual([r.status, r.body.ok], [200, true], `${what}: ${JSON.stringify(r.body).slice(0, 400)}`);
  assert.notEqual(s.signed(), null, `${what}: signed`);
}
