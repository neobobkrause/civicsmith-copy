/* ratification R6, R39, R57 (T51 fix round 6, G54): a complete published edition is never left without a case file and with
   nothing said. Every path that completes an edition (`op=ratify` of the last member, `op=caseratify` with its sitting, the
   scheduled publisher) keeps its outcome and hands the assembly what its own copy found; a copy that throws after the commit
   is stated in the answer and recorded, never a throw out of an act that has committed; and the sweep (`caseFileSweep`,
   `caseFileWake`) builds what is still owed, a few editions a tick, copying the materials first, stopping an edition only
   for a material the evidence store answers absent. Driven at the Worker half over the fixture's world (a real commit, real
   signatures); the assembly (public-read's) and publication's ledger are stand-ins where their jobs have not merged, and the
   SEAM tests name the real ones: red by name until those jobs land (the plan's R-SEAM). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, plane, newKey, signBundle, signCase, cleanCase, cleanInfoMd, fmText, CASE_BODY, bucketOver, V }
  from "./fixture.mjs";
import { caseRatifyOp, ratifyOp, publishAtOp } from "../../../src/ratification/ops.mjs";
import * as ratification from "../../../src/ratification/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import * as publicationWorker from "../../../src/publication/worker.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { publicReadOf, publicReadOps } from "../../../src/public-read/index.mjs";
import { assembleCaseContainerRefusal } from "../public-read/fixtures.mjs";

const { caseConclusionRowLines, CASEFILE_SWEEP_EDITIONS, CASEFILE_SWEEP_FILES, CASEFILE_SWEEP_BYTES } = ratification;
/* public-read's refusals of the case-file assembly, from its published fixture: the real answers, made once for this file */
const REFUSALS = await assembleCaseContainerRefusal();
const REFUSED = { MATERIAL_MISSING: REFUSALS.materialMissing, BUCKET_FAILED: REFUSALS.bucketFailed };
const OWN = { version: "first", claim: "the transfer was authorised", falsifier: "an adopted resolution forbidding it",
              falsifier_override: null, by: "member:iris", at: "2026-09-27T10:00:00Z" };
const AT = { date: "2026-10-09", time: "09:30" };
const as = (who) => ({ session: { role: `member:${who}` }, viewer: V(who) });
const A = "a1".repeat(32), B = "b2".repeat(32);

const cleanInqMd = (id) => ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Was ${id} authorised?"`,
  "current_state: open", "prior_state: null", `created: "2026-07-01T00:00:00Z"`, `last_updated: "2026-07-01T00:00:00Z"`,
  "produced_by:", "  mode: human", "  capability_tier: none", "group: test-group", "references: []",
  "state_history: []", "annotations_open: 0", "reeval_pending: false", "visuals: []", "surfaced_by: human",
  "recheck_triggers:", "  - text: Revisit after the next budget cycle",
  "    description: The adopted budget may restate the transfer basis.",
  "---", "", "## Question", "", `Was ${id} authorised?`, "", word("conformance.rests"), "", "## Conclusion", "",
  word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");

/* iris owns a project and signs; each `edition(n)` is a case of one finding, stored unsigned and ready for a sitting of that
   finding with the case's signature, which is the act that completes it. */
async function house({ worker = null, steer = {} } = {}) {
  const w = world({ worker, steer });
  const iris = await newKey();
  w.member("iris", { signer: iris });
  w.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], V("iris"));
  w.r.registerHoldReader({ holdsOn: () => ({ held: false }) });
  const P = w.project("Team", "iris");
  const editions = [];
  const edition = async (n) => {
    const caseId = `CASE-2026-${String(6000 + n)}`, q = `INQ-2026-${String(6000 + n)}-lead`;
    w.promote(q, cleanInqMd(q)); w.bv.conc.set(w.key(P, q), OWN);
    const conc = caseConclusionRowLines(q, w.r.caseConclusionFor(P, q, V("iris"), "open"));
    const text = fmText(cleanCase({ caseId, edition: 1, project: P, members: [{ id: q, pin: w.sha(q) }] }),
                        { raw: ["case_conclusions:", ...conc], body: CASE_BODY });
    const docSha = w.caseDoc(caseId, 1, text, { owner: P });
    w.pub.facts.set(`${caseId}#1`, { ok: true, doc: { case_id: caseId, edition: 1, doc_sha: docSha, text },
      attribution: { reached: [], legacy: [], stated: [], current: [] }, signers: w.credentials.attestingKeys(),
      memberBasis: null, priorCase: null });
    const sig = await signCase(iris, caseId, 1, docSha);
    const member = { id: q, sha: w.sha(q), signature: await signBundle(iris, q, w.sha(q)) };
    const e = { n, caseId, q, docSha, sig, member, body: (extra = {}) => ({ caseId, edition: 1, expectedSha: docSha, sig, members: [member], ...extra }) };
    editions.push(e);
    return e;
  };
  const act = async (fn, b, o = {}, tweak = () => {}) => {
    const p = plane(w, { ...as("iris"), ...o });
    tweak(p);
    return { ...(await fn(p.request(b), p.stub, p.ctx)), p };
  };
  return { w, P, iris, edition, editions, act };
}

/* What the stand-in assembly leaves in the ledger (a model of public-read's R6 and publication's writer, only as much as the
   sweep reads): the state, the attempts, and `manifest_sha` once built. */
function ledgerOn(w) {
  const rows = new Map();
  const key = (c, e) => `${c}#${e}`;
  const ledger = {
    rows, calls: [], recorded: [], clock: 0,
    /* publication's `caseFilesOwed` (its ledger, as the plan states the rule): complete, manifest null or the ledger not
       `built`, never `stopped`, due; oldest first. */
    owed({ now, limit }) {
      ledger.owedAsked.push({ now, limit });
      const out = [];
      for (const r of w.st.sql.exec(`SELECT case_id, edition FROM published_cases ORDER BY opened, case_id`)) {
        const cs = w.realPub.caseEditionState(r.case_id, r.edition);
        const row = rows.get(key(r.case_id, r.edition)) || {};
        if (!cs || !cs.complete || row.state === "stopped" || row.state === "built") continue;
        if (cs.manifest_sha && !row.state) continue;
        if (row.next_at && row.next_at > now) continue;
        out.push({ case: r.case_id, edition: r.edition, attempts: row.attempts ?? 0, state: row.state ?? null,
                   why: row.why ?? null, next_at: new Date(row.next_at ?? 0).toISOString() });
      }
      return out.slice(0, limit);
    },
    owedAsked: [],
    nextAt: () => { const t = [...rows.values()].map((r) => r.next_at).filter(Boolean); return t.length ? new Date(Math.min(...t)).toISOString() : null; },
    record({ caseId, edition, state, why, at }) { ledger.recorded.push({ caseId, edition, state, why, at });
      const row = rows.get(key(caseId, edition)) || { attempts: 0 };
      rows.set(key(caseId, edition), { ...row, state, why, attempts: row.attempts + (state === "stopped" ? 0 : 1), at });
      return { ok: true }; },
    /* public-read's assembly: it builds when nothing is missing and says why not when something is; it records every attempt */
    assemble: async (a) => {
      ledger.calls.push({ ...a, prior: a.prior });
      const cs = a.cs, id = cs.caseId ?? cs.case_id;
      const row = rows.get(key(id, cs.edition)) || { attempts: 0 };
      const miss = a.prior && a.prior.materials_missing && a.prior.materials_missing.length;
      ledger.absentSeen = a.prior && a.prior.absent;
      const next = ledger.next?.(a);
      if (next) { rows.set(key(id, cs.edition), { ...row, state: "failed", why: { code: next.code, step: "build" },
                                                  attempts: row.attempts + 1, next_at: ledger.clock + 1000 * 2 ** row.attempts });
                  return REFUSED[next.code]; }
      if (miss || (a.prior && a.prior.copy_error)) {
        const code = miss ? "MATERIAL_MISSING" : "BUCKET_FAILED";
        rows.set(key(id, cs.edition), { ...row, state: "failed", why: { code, step: miss ? "materials" : "copy" },
                                        attempts: row.attempts + 1, next_at: ledger.clock + 1000 * 2 ** row.attempts });
        return REFUSED[code];
      }
      const sha = `${String(a.cs.edition)}${"f".repeat(63)}`;
      w.st.sql.exec(`UPDATE published_cases SET manifest_sha=? WHERE case_id=? AND edition=?`, sha, id, cs.edition);
      rows.set(key(id, cs.edition), { ...row, state: "built", attempts: row.attempts + 1 });
      return { manifest_sha: sha, files: ledger.files ?? 12, part_addresses: [{ index: 1, bytes: ledger.bytes ?? 1000 }] };
    },
  };
  return ledger;
}

/* ============================================================== the completing paths */

const throwingPut = (p) => { p.ctx.env.PUBLISHED.put = async () => { throw new Error("bucket refused (injected)"); }; };

test("R6, R57: op=caseratify — a sitting member's copy that throws after the commit is stated in the answer (200), handed to the assembly as prior.copy_error, and the edition is assembled all the same; control: no failure, no copy_error", async () => {
  const s = await house();
  const e = await s.edition(1);
  const bad = await s.act(caseRatifyOp, e.body(), {}, throwingPut);
  assert.equal(bad.status, 200, JSON.stringify(bad.body).slice(0, 400));
  assert.equal(bad.body.ok, true);
  assert.deepEqual([bad.body.sitting[0].published.r2, bad.body.sitting[0].published.reason], ["COPY_FAILED", "COPY_FAILED"],
                   "the answer states the copy that failed where it would have counted");
  assert.equal(bad.p.assembled.length, 1);
  assert.match(bad.p.assembled[0].prior.copy_error, /bucket refused/);
  assert.deepEqual([bad.p.assembled[0].prior.materials_missing, bad.p.assembled[0].prior.copy_code], [[], "BUCKET_FAILED"]);
  const s2 = await house();
  const e2 = await s2.edition(1);
  const ok = await s2.act(caseRatifyOp, e2.body());
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.p.assembled[0].prior, { materials_missing: [], copy_error: null, copy_code: null, absent: false }, "control: nothing failed");
  assert.equal("reason" in ok.body.sitting[0].published, false);
});

test("R6, R39, R57: op=caseratify — the materials copyMaterials could not copy reach the assembly as prior.materials_missing; the answer's materials_copied is as it was; control: all copied, none missing", async () => {
  for (const present of [false, true]) {
    const s = await house();
    const e = await s.edition(1);
    const real = s.w.publication.commitCaseEdition;
    s.w.publication.commitCaseEdition = (a) => ({ ...real(a), materials: [{ sha: A, held: "evidence" }] });
    const r = await s.act(caseRatifyOp, e.body(), {}, (p) => { if (present) p.captures.set(`s/captures/${A}`, new TextEncoder().encode("document A")); });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.deepEqual(r.body.materials_copied, present ? { copied: 1, present: 0, missing: [] } : { copied: 0, present: 0, missing: [A] });
    assert.deepEqual(r.p.assembled[0].prior, { materials_missing: present ? [] : [{ sha: A, absent: true }], copy_error: null, copy_code: null, absent: !present }, present ? "control" : "missing");
  }
});

test("R6, R57: op=caseratify and op=ratify — an assembly that throws after the commit never throws out of the act: the answer states ASSEMBLY_FAILED, the failure is recorded for the edition (step build); a recorder that throws changes nothing; control: an assembly that answers records nothing here", async () => {
  const boom = async () => { throw new Error("assembly blew up (injected)"); };
  const s = await house();
  const e = await s.edition(1);
  const recorded = [];
  const r = await s.act(caseRatifyOp, e.body(), {}, (p) => { p.ctx.assembleCaseContainer = boom;
                                                            p.ctx.recordCaseFileFailure = async (a) => { recorded.push(a); return { ok: true, code: "UNKNOWN" }; }; });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual([r.body.container.ok, r.body.container.reason, r.body.container.code], [false, "ASSEMBLY_FAILED", "UNKNOWN"]);
  assert.deepEqual(recorded.map((a) => [a.cs.caseId ?? a.cs.case_id, a.via, a.step]), [[e.caseId, "caseratify", "build"]]);
  assert.match(String(recorded[0].error.message), /assembly blew up/);
  assert.equal(typeof recorded[0].stub.fetch, "function", "the recorder is handed the object's door");
  const s2 = await house();
  const e2 = await s2.edition(1);
  const silent = await s2.act(caseRatifyOp, e2.body(), {}, (p) => { p.ctx.assembleCaseContainer = boom;
                                                                  p.ctx.recordCaseFileFailure = async () => { throw new Error("recorder down"); }; });
  assert.deepEqual([silent.status, silent.body.ok, silent.body.container.reason], [200, true, "ASSEMBLY_FAILED"], "a recorder that throws changes nothing");
  const s3 = await house();
  const e3 = await s3.edition(1);
  const fine = await s3.act(caseRatifyOp, e3.body(), {}, (p) => { p.ctx.recordCaseFileFailure = async (a) => { recorded.push(a); }; });
  assert.deepEqual([fine.body.container.manifest_sha], ["m".repeat(64)]);
  assert.equal(recorded.length, 1, "control: the answering assembly recorded nothing here");
});

test("R6, R57: op=ratify — the last member's copy that throws is stated in the 200 answer (published.reason COPY_FAILED), the edition's failure is recorded at step copy and its assembly is not reached; control: no failure, one assembly, nothing recorded", async () => {
  const DOC = "INFO-2026-0001-report", Q = "INQ-2026-0001-finding";
  const w = world();
  const key = await newKey();
  w.member("alice", { signer: key });
  const P = w.project("Team", "alice");
  w.promote(DOC, cleanInfoMd(DOC), "information");
  w.pub.resting.set(DOC, [{ case_id: "CASE-2026-0001", finding: Q, project: P }]);
  const sha = w.sha(DOC), sig = await signBundle(key, DOC, sha);
  const cs = { case_id: "CASE-2026-0001", edition: 1, complete: true, manifest_sha: null, awaiting: [], findings: [{ bundle_id: DOC }] };
  w.publication.commitEdition = () => ({ ok: true, existed: false, edition: 1, caseId: "CASE-2026-0001", case: cs });
  const run = async (tweak = () => {}) => { const p = plane(w); tweak(p);
    const res = await ratifyOp(p.request({ bundleId: DOC, expectedSha: sha, sig }), p.stub, p.ctx); return { ...res, p }; };
  const recorded = [];
  const recorder = async (a) => { recorded.push(a); return { ok: true, code: "BUCKET_FAILED" }; };
  const bad = await run((p) => { throwingPut(p); p.ctx.recordCaseFileFailure = recorder; });
  assert.equal(bad.status, 200, JSON.stringify(bad.body).slice(0, 300));
  assert.deepEqual([bad.body.published.r2, bad.body.published.reason], ["COPY_FAILED", "COPY_FAILED"]);
  assert.match(bad.body.published.detail, /bucket refused/);
  assert.equal(bad.p.assembled.length, 0, "the assembly is not reached over a copy that failed");
  assert.deepEqual(recorded.map((a) => [a.via, a.step, a.cs.case_id]), [["ratify", "copy", "CASE-2026-0001"]]);
  assert.deepEqual([bad.body.container.ok, bad.body.container.reason, bad.body.container.code], [false, "COPY_FAILED", "BUCKET_FAILED"]);
  const good = await run((p) => { p.ctx.recordCaseFileFailure = recorder; });
  assert.deepEqual([good.p.assembled.length, recorded.length], [1, 1], "control: one assembly, nothing more recorded");
  assert.deepEqual(good.p.assembled[0].prior, { materials_missing: [], copy_error: null, copy_code: null, absent: false });
  assert.equal("reason" in good.body.published, false);
});

/* ============================================================== the scheduled publisher */

test("R6, R42, R57: the scheduled publisher completing two editions keeps both outcomes (after.containers, one {case, edition, built, code?} each), the last as after.container as before; a copy that throws goes to the assembly as prior; control: one edition, one entry", async () => {
  for (const two of [true, false]) {
    const captures = new Map(), published = new Map();
    const env = { CAPTURES: bucketOver(captures), PUBLISHED: bucketOver(published) };
    const calls = [];
    const worker = { env, storeName: "s", stub: { fetch: async () => { throw new Error("not reached"); } },
      assembleCaseContainer: async (a) => { calls.push(a); const id = a.cs.caseId ?? a.cs.case_id;
        return id === "CASE-2026-6001" ? { manifest_sha: "9".repeat(64), files: 3 } : { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_SILENT" }; } };
    const s = await house({ worker });
    const e = await s.edition(1);
    const real = s.w.r.publish.bind(s.w.r);
    /* a sha several cases pin ratifies with no sole case (`containerCases`, IC-74): here the edition and one more */
    s.w.r.publish = (m) => { const p = real(m);
      return two ? { ...p, case: undefined, containerCases: [p.case, { case_id: "CASE-2026-9999", caseId: "CASE-2026-9999", edition: 1, complete: true, manifest_sha: null }] } : p; };
    let spied = null;
    const publisher = s.w.r.publishScheduled.bind(s.w.r);
    s.w.r.publishScheduled = async (entry, now) => (spied = await publisher(entry, now));
    const r = await s.act(publishAtOp, e.body({ at: AT }));
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
    const due = await s.w.schedule.publishDue(new Date(Date.parse(r.body.publish_at) + 3600e3).toISOString());
    assert.equal(due.taken[0].state, "published", JSON.stringify(due.taken[0]).slice(0, 400));
    assert.equal(spied.published, true);
    const containers = spied.after.containers;
    assert.deepEqual(containers.map((c) => [c.case, c.edition, c.built, c.code ?? null]),
      two ? [[e.caseId, 1, true, null], ["CASE-2026-9999", 1, false, "STORE_SILENT"]] : [[e.caseId, 1, true, null]],
      two ? "both editions' outcomes are kept, the built one and the one that was not" : "control: one edition, one entry");
    assert.equal(calls.length, containers.length);
    assert.deepEqual(spied.after.container, two ? { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_SILENT" } : { manifest_sha: "9".repeat(64), files: 3 },
                     "after.container stays the last edition's statement, as before");
    assert.deepEqual(calls[0].prior, { materials_missing: [], copy_error: null, copy_code: null, absent: false });
  }
});

test("R6, R57: the scheduled publisher's assembly that throws is recorded for the edition and stated (ASSEMBLY_FAILED, built false); a copy of a member that throws reaches the assembly as prior.copy_error", async () => {
  const captures = new Map(), published = new Map();
  const env = { CAPTURES: bucketOver(captures), PUBLISHED: bucketOver(published) };
  env.PUBLISHED.put = async () => { throw new Error("bucket refused (injected)"); };
  const recorded = [], seen = [];
  const worker = { env, storeName: "s", stub: { fetch: async () => { throw new Error("not reached"); } },
    assembleCaseContainer: async (a) => { seen.push(a.prior); throw new Error("assembly blew up (injected)"); },
    recordCaseFileFailure: async (a) => { recorded.push(a); return { ok: true, code: "UNKNOWN" }; } };
  const s = await house({ worker });
  const e = await s.edition(1);
  let spied = null;
  const publisher = s.w.r.publishScheduled.bind(s.w.r);
  s.w.r.publishScheduled = async (entry, now) => (spied = await publisher(entry, now));
  const r = await s.act(publishAtOp, e.body({ at: AT }));
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  await s.w.schedule.publishDue(new Date(Date.parse(r.body.publish_at) + 3600e3).toISOString());
  assert.equal(spied.published, true);
  assert.deepEqual(spied.after.containers.map((c) => [c.case, c.built, c.code]), [[e.caseId, false, "UNKNOWN"]]);
  assert.deepEqual(recorded.map((a) => [a.via, a.step]), [["publishscheduled", "build"]]);
  assert.match(seen[0].copy_error, /bucket refused/, "the member's copy that threw reached the assembly");
});

/* ============================================================== the retry's state names the publishing group */

test("R6, R57: a re-sent op=caseratify on a complete edition without a case file reads the edition's state with its publishing group (the first member's bytes at its pin), as the commit reads it; a manifest recorded whose ledger says not built is owed too", async () => {
  const s = await house();
  const e = await s.edition(1);
  const first = await s.act(caseRatifyOp, e.body());
  assert.equal(first.status, 200);
  const asked = [];
  const stateOf = s.w.publication.caseEditionState;
  s.w.publication.caseEditionState = (c, ed, group) => { asked.push([c, ed, group]); return stateOf(c, ed, group); };
  const retry = e.body({ members: undefined });   /* the case's own signature again, without its sitting */
  const again = await s.act(caseRatifyOp, retry);
  assert.equal(again.body.existed, true);
  assert.deepEqual(asked.at(-1), [e.caseId, 1, "test-group"], "the group is the member's own, as the commit passes it");
  assert.equal(again.p.assembled.length, 1, "complete, no manifest: assembled at the retry");
  /* a manifest was recorded but the ledger says the attempt did not end built (publication's casefile_state): still owed */
  s.w.publication.caseEditionState = (c, ed, group) => ({ ...stateOf(c, ed, group), manifest_sha: "d".repeat(64), casefile_state: "failed" });
  const owed = await s.act(caseRatifyOp, retry);
  assert.equal(owed.p.assembled.length, 1, "manifest_sha set, state failed: owed");
  s.w.publication.caseEditionState = (c, ed, group) => ({ ...stateOf(c, ed, group), manifest_sha: "d".repeat(64), casefile_state: "built" });
  const built = await s.act(caseRatifyOp, retry);
  assert.equal(built.p.assembled.length, 0, "control: built is not owed");
});

/* ============================================================== the sweep */

/* three complete editions with no case file, laid by the real commit (a sitting of the case and its finding whose assembly
   never ran), as 4783 and 6227 were */
async function owedHouse(n = 3, { worker: extra = {}, steer: steerExtra = {} } = {}) {
  const captures = new Map(), published = new Map();
  const env = { CAPTURES: bucketOver(captures), PUBLISHED: bucketOver(published) };
  const holder = {};
  const worker = { env, storeName: "s", stub: { fetch: async () => { throw new Error("not reached"); } },
    assembleCaseContainer: (a) => holder.ledger.assemble(a), recordCaseFileFailure: async () => ({ ok: true }), ...extra };
  const steer = { caseFilesOwed: (a) => holder.ledger.owed(a), caseFileNextAt: () => holder.ledger.nextAt(),
                  recordCaseFileAttempt: (a) => holder.ledger.record(a), ...steerExtra };
  const s = await house({ worker, steer });
  holder.ledger = ledgerOn(s.w);
  for (let i = 1; i <= n; i++) {
    const e = await s.edition(i);
    const r = await s.act(caseRatifyOp, e.body(), {}, (p) => { p.ctx.assembleCaseContainer = async () => REFUSALS.notAssembled; });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  }
  for (const e of s.editions) assert.deepEqual(s.w.realPub.caseEditionState(e.caseId, 1).complete, true);
  return { ...s, ledger: holder.ledger, captures, published, env, worker };
}

test("R57: the sweep takes the oldest owed editions, two a tick (a third waits), and builds each; a second tick builds the third; a tick after that calls the assembly 0 times", async () => {
  const s = await owedHouse(3);
  const t1 = await s.w.r.caseFileSweep(1_000);
  assert.equal(t1.ok, true);
  assert.deepEqual(s.ledger.calls.map((c) => c.cs.caseId ?? c.cs.case_id), [s.editions[0].caseId, s.editions[1].caseId], "oldest first, two");
  assert.deepEqual(t1.built.map((b) => [b.case, b.edition, b.built]), [[s.editions[0].caseId, 1, true], [s.editions[1].caseId, 1, true]]);
  assert.deepEqual(s.ledger.owedAsked[0], { now: 1_000, limit: CASEFILE_SWEEP_EDITIONS });
  const t2 = await s.w.r.caseFileSweep(2_000);
  assert.deepEqual(t2.built.map((b) => b.case), [s.editions[2].caseId]);
  const calls = s.ledger.calls.length;
  const t3 = await s.w.r.caseFileSweep(3_000);
  assert.deepEqual([t3.built, t3.failed, s.ledger.calls.length], [[], [], calls], "idempotent: nothing owed, no assembly");
  assert.equal(s.w.r.caseFileWake(3_000), null, "nothing owed: no wake");
});

test("R57: a failed assembly is recorded with its code by the assembly and retried only when the ledger says it is due; the sweep hands the assembly the edition's state with its publishing group", async () => {
  const s = await owedHouse(1);
  s.ledger.next = () => ({ code: "BUCKET_FAILED" });
  s.ledger.clock = 1_000;   /* the first try is at 1,000: the ledger owes it again at 2,000 */
  const asked = [];
  const stateOf = s.w.publication.caseEditionState;
  s.w.publication.caseEditionState = (c, ed, g) => (asked.push(g), stateOf(c, ed, g));
  const t1 = await s.w.r.caseFileSweep(1_000);
  assert.deepEqual(t1.failed, [{ case: s.editions[0].caseId, edition: 1, built: false, code: "BUCKET_FAILED" }]);
  assert.equal(asked.at(-1), "test-group");
  const inside = await s.w.r.caseFileSweep(1_500);
  assert.deepEqual([inside.failed, inside.built], [[], []], "inside its backoff the ledger owes nothing");
  assert.equal(s.w.r.caseFileWake(1_500), 2_000, "the wake is the ledger's earliest next try, in ms");
  s.ledger.next = null;
  const after = await s.w.r.caseFileSweep(2_500);
  assert.deepEqual(after.built.map((b) => b.case), [s.editions[0].caseId]);
});

test("R39, R57: the sweep copies the materials first — one the evidence store holds is copied to the published bucket before the assembly, one it lacks keeps the edition failed MATERIAL_MISSING (the assembly told which) and is copied once it is there; the next tick builds", async () => {
  const s = await owedHouse(1);
  s.w.publication.heldMaterialsOf = () => [{ sha: A, held: "evidence" }, { sha: B, held: "evidence" }, { sha: "c3".repeat(32), held: "inline" }];
  s.captures.set(`s/captures/${A}`, new TextEncoder().encode("document A"));
  const t1 = await s.w.r.caseFileSweep(1_000);
  assert.equal(s.published.has(`s/published/${A}`), true, "copied first");
  assert.equal(s.published.has(`s/published/${"c3".repeat(32)}`), false, "inline material is never copied");
  assert.deepEqual(s.ledger.calls[0].prior, { materials_missing: [{ sha: B, absent: true }], copy_error: null, copy_code: null, absent: true });
  assert.deepEqual(t1.failed.map((f) => f.code), ["MATERIAL_MISSING"]);
  assert.equal(s.w.realPub.caseEditionState(s.editions[0].caseId, 1).manifest_sha, null, "no manifest recorded over a missing material");
  s.captures.set(`s/captures/${B}`, new TextEncoder().encode("document B"));
  s.ledger.clock = 1_000;
  const t2 = await s.w.r.caseFileSweep(10_000);
  assert.equal(s.published.has(`s/published/${B}`), true);
  assert.deepEqual(t2.built.map((b) => b.case), [s.editions[0].caseId], "tick 2: the material is there, the case file builds");
  assert.deepEqual(s.ledger.calls[1].prior, { materials_missing: [], copy_error: null, copy_code: null, absent: false });
});

test("R57: the sweep never records stopped itself — a material the evidence store ANSWERS absent is told to the assembly (prior.absent true, each item {sha, absent}), and the ledger's writer holds the count and the stop; a copy that failed is not an absence (prior.absent false)", async () => {
  const lacking = [{ sha: B, held: "evidence" }];
  const run = async ({ fail = false } = {}) => {
    const s = await owedHouse(1);
    s.w.publication.heldMaterialsOf = () => lacking;
    if (fail) s.env.CAPTURES.get = async () => { throw new Error("read failed (injected)"); };
    await s.w.r.caseFileSweep(1_000);
    return s;
  };
  const gone = await run();
  assert.deepEqual(gone.ledger.calls[0].prior, { materials_missing: [{ sha: B, absent: true }], copy_error: null, copy_code: null, absent: true });
  assert.deepEqual(gone.ledger.recorded, [], "the sweep records no state itself");
  const failed = await run({ fail: true });
  assert.deepEqual(failed.ledger.calls[0].prior, { materials_missing: [{ sha: B, absent: false }], copy_error: null, copy_code: null, absent: false });
  const mixed = await owedHouse(1);
  mixed.w.publication.heldMaterialsOf = () => [{ sha: A, held: "evidence" }, { sha: B, held: "evidence" }];
  mixed.env.CAPTURES.get = async (k) => { if (k.endsWith(A)) throw new Error("read failed (injected)"); return null; };
  await mixed.w.r.caseFileSweep(1_000);
  assert.equal(mixed.ledger.calls[0].prior.absent, false, "absent only when every missing material is confirmed gone");
});

test("R57: the tick is bounded — it takes no further edition once it has pulled the files or the bytes constant; the constants are the named ones; no stop or size constant here (publication's writer and public-read's assembly own those)", async () => {
  assert.deepEqual([CASEFILE_SWEEP_EDITIONS, CASEFILE_SWEEP_FILES, CASEFILE_SWEEP_BYTES], [2, 400, 16 * 1024 * 1024],
                   "provisional until the platform check P measured them");
  assert.equal("CASEFILE_MISSING_MAX_ATTEMPTS" in ratification, false);
  assert.equal("CASEFILE_TOO_LARGE_FILES" in ratification, false);
  for (const [name, set] of [["files", (l) => { l.files = CASEFILE_SWEEP_FILES; }], ["bytes", (l) => { l.bytes = CASEFILE_SWEEP_BYTES; }]]) {
    const s = await owedHouse(2);
    set(s.ledger);
    const t = await s.w.r.caseFileSweep(1_000);
    assert.deepEqual([t.built.length, s.ledger.calls.length], [1, 1], `after the first edition passes the ${name} bound the tick stops`);
  }
});

test("R57: caseFileWake is now while an edition is due, else the ledger's earliest next try, else null; with no reach to the published bucket from here it is null; the sweep never throws", async () => {
  const s = await owedHouse(1);
  assert.equal(s.w.r.caseFileWake(5_000), 5_000, "an edition is due: now");
  s.ledger.rows.set(`${s.editions[0].caseId}#1`, { state: "failed", attempts: 1, next_at: 9_000 });
  assert.equal(s.w.r.caseFileWake(5_000), 9_000, "none due: the earliest next try");
  const none = await house();
  assert.equal(none.w.r.caseFileWake(5_000), null, "no worker reach: null");
  assert.deepEqual((await none.w.r.caseFileSweep(5_000)).ran, false);
  s.w.publication.caseFilesOwed = () => { throw new Error("ledger down (injected)"); };
  const t = await s.w.r.caseFileSweep(5_000);
  assert.deepEqual([t.ok, t.reason], [false, "OWED_UNREADABLE"]);
  assert.equal(s.w.r.caseFileWake(5_000), null);
});

/* ============================================================== the seams: the real providers (red by name until they merge) */

test("G54 SEAM (publication, PUBLICATION #37): publication provides the owed reads and the one writer — caseFilesOwed, caseFileNextAt, recordCaseFileAttempt", async () => {
  const s = await house();
  for (const m of ["caseFilesOwed", "caseFileNextAt", "recordCaseFileAttempt"])
    assert.equal(typeof s.w.realPub[m], "function", `publication.${m}`);
});

test("G54 SEAM (public-read, PUBLIC-READ #31): public-read provides recordCaseFileFailure beside its assembly, which takes the caller's prior", async () => {
  assert.equal(typeof publicationWorker.recordCaseFileFailure, "function", "recordCaseFileFailure");
  assert.equal(typeof publicationWorker.assembleCaseContainer, "function");
});

test("G54 SEAM (publication, public-read): the real ledger and the real assembly — editions laid by the real commit with no case file are owed, one tick builds two of them through the real assembly (copying first), the next builds the third, and a tick after that calls the assembly 0 times", async () => {
  /* the real providers: publication's ledger (steer nothing), public-read's assembly over a store door that answers the ops the
     assembly asks, a published bucket holding each finding's bytes as the act's copy left them */
  const holder = {};
  const captures = new Map(), published = new Map();
  const env = { CAPTURES: bucketOver(captures), PUBLISHED: bucketOver(published) };
  const door = { async fetch(u, init) {
    const req = u instanceof Request ? u : new Request(u, init);
    const url = new URL(req.url), op = url.pathname.slice(1);
    const body = req.method === "POST" ? JSON.parse((await req.text()) || "{}") : null;
    const w = holder.w;
    const pr = publicReadOf(w.host, { publication: w.realPub, docket: {} });
    const ops = { ...publicationOps(w.realPub, url, body), ...publicReadOps(pr, url) };
    if (!ops[op]) return Response.json({ ok: false, error: `unknown op ${op}` }, { status: 400 });
    return Response.json({ ok: true, result: await ops[op]() });
  } };
  publicationWorker.bindPublishedPlane({
    json: (o, status = 200) => ({ status, body: o }), STORE_SILENT_REASON: "STORE_DID_NOT_ANSWER", STORE_SILENT_DETAIL: "the store did not answer",
    PUBLISHED_STORE: "s", storeSilent: (op) => ({ status: 502, body: { ok: false, reason: "STORE_DID_NOT_ANSWER", op } }),
    requiredArgument: (op, argument, shape, error) => ({ ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, error }), // fixtures-contract: answer-envelope door-helpers
    doAnswer: async (res) => { let out = null; try { out = await (await res).json(); } catch { out = null; }
                               return out && out.ok === true ? { answered: true, result: out.result } : { answered: false }; } });
  const s = await house({ worker: { env, storeName: "s", stub: door } });
  holder.w = s.w;
  for (let i = 1; i <= 3; i++) {
    const e = await s.edition(i);
    const r = await s.act(caseRatifyOp, e.body(), {}, (p) => { p.ctx.assembleCaseContainer = async () => REFUSALS.notAssembled; });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    published.set(`s/published/${e.member.sha}`, new TextEncoder().encode(s.w.record.readFile(e.q, "bundle.md").text));
  }
  const owedNow = s.w.realPub.caseFilesOwed({ now: Date.now() + 3_600_000, limit: 10 });
  assert.equal(owedNow.length, 3, "all three are owed past their grace");
  const t1 = await s.w.r.caseFileSweep(Date.now() + 3_600_000);
  assert.deepEqual(t1.built.map((b) => b.case), s.editions.slice(0, 2).map((e) => e.caseId), JSON.stringify(t1));
  for (const e of s.editions.slice(0, 2)) assert.match(String(s.w.realPub.caseEditionState(e.caseId, 1).manifest_sha), /^[0-9a-f]{64}$/);
  const t2 = await s.w.r.caseFileSweep(Date.now() + 3_600_000);
  assert.deepEqual(t2.built.map((b) => b.case), [s.editions[2].caseId]);
  const t3 = await s.w.r.caseFileSweep(Date.now() + 3_600_000);
  assert.deepEqual([t3.built, t3.failed], [[], []], "nothing owed: the assembly called 0 times");
  assert.equal(s.w.r.caseFileWake(Date.now() + 3_600_000), null);
});
