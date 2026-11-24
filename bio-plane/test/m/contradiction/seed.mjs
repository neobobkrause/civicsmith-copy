/* Candidates laid down through the module's own doors (the pairing forms them, `propose` writes them), for the tests of
   PRESENT, RESOLVE and DEC-85. Ids are canonical (a slug tail), so a contradiction inquiry taken up from them passes
   inquiry's grammar at promotion. */
import { world, sha, MACHINE } from "./fixture.mjs";

export const RUN = "RUN-2026-0001";
export const PRINCIPAL = "member:m1";
export const M1 = "member:m1", M2 = "member:m2", M3 = "member:m3", OUT = "member:outsider";

/* Two inquiries on subject E1 with accepted claims (K2), each resting on its own passage of its own document (K1 and
   K4 material too), and two passages of one inquiry, one supporting and one cutting against it (K1). */
export const IQ = { a: "INQ-2026-0001-rose", b: "INQ-2026-0002-fell", c: "INQ-2026-0003-legs" };
export const INFO = { a: "INFO-2026-0001-rule", b: "INFO-2026-0002-act" };
export const CID = { a: sha("passage a"), b: sha("passage b") };

export function seeded(opts = {}) {
  const w = world(opts);
  w.runs.set(RUN, { status: "running", principal: PRINCIPAL });
  w.inquiry(IQ.a, { subject: "E1" }); w.version(IQ.a, "v1", { claim: "the fee rose" });
  w.inquiry(IQ.b, { subject: "E1" }); w.version(IQ.b, "v1", { claim: "the fee fell" });
  w.content(CID.a, "capA", INFO.a);
  w.content(CID.b, "capB", INFO.b);
  w.inquiry(IQ.c);
  w.leg(IQ.c, 0, "supports", { content: CID.a, target: INFO.a });
  w.leg(IQ.c, 1, "cuts_against", { content: CID.b, target: INFO.b });
  w.resolution("capA", INFO.a, "E1");
  w.resolution("capB", INFO.b, "E1");
  w.reading("capA", INFO.a, { contentType: "rule", date: "2026-01-01" });
  w.reading("capB", INFO.b, { contentType: "act", date: "2026-03-01" });
  return w;
}

/** Propose the first pair `key` forms (for the machine's sight) with `label`; answers the candidate id. */
export function cand(w, key, label, { reason = "the machine's reason", viewer = MACHINE, index = 0 } = {}) {
  const p = w.c.pairs({ key, viewer }).pairs[index];
  if (!p) throw new Error(`no ${key} pair formed`);
  const r = w.c.propose({ run: RUN, proposedBy: "class:ai/tok1", viewer, caller: PRINCIPAL,
                          proposals: [{ key, a: p.a, b: p.b, label, reason }] });
  if (!r.ok) throw new Error(`propose refused: ${JSON.stringify(r).slice(0, 300)}`);
  return r.candidates[0].candidate;
}

/** The recommendation door (R37) for a candidate, with the fixture's run. */
export function recommend(w, candidate, coordinates, extra = {}) {
  return w.c.recommend({ run: RUN, candidate, coordinates, proposedBy: "class:ai/tok1", viewer: MACHINE, caller: PRINCIPAL,
                         ...extra });
}

/** Assert a refusal carries its code and its row. */
export function refusedWith(assert, rows, r, code) {
  assert.equal(r.ok, false, JSON.stringify(r).slice(0, 400));
  assert.equal(r.code, code, JSON.stringify(r).slice(0, 400));
  assert.equal(r.reason, code);
  assert.equal(r.check, rows[code].check);
  assert.equal(r.translation, rows[code].translation);
}
