/* ratification's published fixtures (fix round 10): what a user module's test takes in place of this module's answers (K4990, K5044).
   Each is made by the real code when the test runs, over `world()`, and is never stored. */
import { world, newKey, signCase, cleanCase, fmText, CASE_BODY, V } from "./fixture.mjs";
import { caseConclusionRowLines } from "../../../src/ratification/index.mjs";

const Q1 = "INQ-2026-0001-first";
const CASE = "CASE-2026-0001";
const OWN = { version: "first", claim: "the council approved it", falsifier: "f", falsifier_override: null,
              by: "member:alice", at: "2026-09-27T10:00:00Z" };

/* alice owns the project and holds an administrator-registered key; bo joined it and holds none; eve is in no project. One case
   edition, stored unsigned, pinning one finding whose conclusion the project records. */
async function caseHouse({ edition = 1 } = {}) {
  const w = world();
  const key = await newKey();
  w.member("alice", { signer: key }); w.member("bo"); w.member("eve");
  const P = w.project("Team", "alice", { joined: ["bo"] });
  w.inquiry(Q1);
  w.bv.conc.set(w.key(P, Q1), OWN);
  const conc = w.r.caseConclusionFor(P, Q1, V("alice"), "open");
  const text = fmText(cleanCase({ caseId: CASE, edition, project: P, members: [{ id: Q1, pin: w.sha(Q1) }] }),
                      { raw: ["case_conclusions:", ...caseConclusionRowLines(Q1, conc)], body: CASE_BODY });
  const docSha = w.caseDoc(CASE, edition, text, { owner: P });
  return { w, P, key, text, docSha, edition };
}

/** The R18 pre-flight's answer for a signer who holds no attesting key: `refusal` is its `NO_ATTESTING_KEY` entry as the
 *  pre-flight answers it, `preflight` the whole answer, and `control` the same pre-flight for a signer who holds one (no such
 *  entry in it). `signer` is the member named. */
export async function preflightRefusal() {
  const h = await caseHouse();
  const ask = (signer) => h.w.r.caseRatifyPreflight({ text: h.text, signer, viewer: V(signer) });
  const preflight = ask("bo");
  const refusal = preflight.refusals.find((r) => r.reason === "NO_ATTESTING_KEY");
  if (!refusal) throw new Error(`preflightRefusal: no NO_ATTESTING_KEY in ${JSON.stringify(preflight).slice(0, 300)}`);
  const control = ask("alice");
  return { signer: "bo", preflight, refusal, control };
}

/** The store's `casedocument` read of an unsigned case document, as the real read answers it (publication's `caseDocument`,
 *  which the ratify gate's `casegate` and `caseratify`'s facts share): `holder` for a caller whose digest `secretSha` a live
 *  review grant admits (the grant is the one stand-in, answering for `review`, which is later in the order), `stranger` for
 *  a caller with standing nowhere and no grant, and `wrongSecret` for one whose digest no grant holds. A stranger's answer is the
 *  one for a document that does not exist. `caseId` and `edition` name the document. */
export async function noCaseDocument({ secretSha = "5".repeat(64) } = {}) {
  const h = await caseHouse();
  /* the one stand-in: review's live grant (review is a later module) admits the one digest to this case edition, as `reviewProvider()` is asked */
  const none = () => null;
  const registered = h.w.realPub.registerReviewProvider("review", { draftForMember: none, draftIdentity: none, caseIdentitySentence: none,
    statedEdition: none, liveGrant: none, deadAnswer: none,
    grantAdmitsCaseEdition: (s, c, e) => s === secretSha && c === CASE && Number(e) === h.edition });
  if (registered.ok !== true) throw new Error(`noCaseDocument: ${JSON.stringify(registered)}`);
  const read = (viewer, secret) => h.w.realPub.caseDocument(CASE, h.edition, viewer, secret);
  return { caseId: CASE, edition: h.edition, secretSha,
           holder: read(V("eve"), secretSha),
           stranger: read(V("eve"), null),
           wrongSecret: read(V("eve"), "6".repeat(64)),
           member: read(V("alice"), null),
           missing: h.w.realPub.caseDocument("CASE-2026-9999", 1, V("alice"), null) };
}
