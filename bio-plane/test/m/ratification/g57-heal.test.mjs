/* ratification R57, R6 (T51 fix round 6, G57; K4720): the case-file sweep heals an owed edition's member findings before it
   assembles. A finding whose `bundle.md` the act's copy did not store leaves the edition `failed` `FINDING_MISSING` at every
   try, because the assembly reads each member finding's `bundle.md` by hash from the published bucket and nothing in the
   sweep copies it; only a member re-sending `op=ratify` healed it. The sweep now heads each member finding's bundle part in the
   published bucket, reads an absent one with record-core's `textAtSha` (its R60) and puts it, before the assembly.
   Driven through the real entries: the real `ratifyOp` and `caseRatifyOp` with real signatures over the fixture's world, the
   real record, publication's ledger and public-read's assembly through the store door of g54-paths' SEAM test, and ONE
   published bucket shared by the acts and the sweep, with a `put` that throws (or drops the bytes) for the finding's key only.
   Assertions are on bytes, calls and ledger rows (R-CLOCK), never on a time taken. The bounds cases (f) lay their member rows
   in the state the sweep reads, because 450 signed findings would test the signer, not the sweep; they run over the stand-in
   ledger, which counts the assembly. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, plane, newKey, signBundle, signCase, cleanCase, fmText, CASE_BODY, bucketOver, V } from "./fixture.mjs";
import { caseRatifyOp, ratifyOp } from "../../../src/ratification/ops.mjs";
import * as ratification from "../../../src/ratification/index.mjs";
import { sweepCaseFiles } from "../../../src/ratification/casefile.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import * as publicationWorker from "../../../src/publication/worker.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { publicReadOf, publicReadOps } from "../../../src/public-read/index.mjs";
import { assembleCaseContainerRefusal } from "../public-read/fixtures.mjs";

const { caseConclusionRowLines, CASEFILE_SWEEP_FILES, CASEFILE_SWEEP_BYTES } = ratification;
/* public-read's refusal of the case-file assembly for an edition with a finding's bytes absent, from its published fixture */
const { notAssembled: NOT_ASSEMBLED } = await assembleCaseContainerRefusal();
const OWN = { version: "first", claim: "the transfer was authorised", falsifier: "an adopted resolution forbidding it",
              falsifier_override: null, by: "member:iris", at: "2026-09-27T10:00:00Z" };
const as = (who) => ({ session: { role: `member:${who}` }, viewer: V(who) });
const enc = (t) => new TextEncoder().encode(t);
const hex = async (bytes) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
const HOUR = 3_600_000;
const TITLE = "Was the transfer authorised";

const cleanInqMd = (id) => ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${TITLE} ${id}?"`,
  "current_state: open", "prior_state: null", `created: "2026-07-01T00:00:00Z"`, `last_updated: "2026-07-01T00:00:00Z"`,
  "produced_by:", "  mode: human", "  capability_tier: none", "group: test-group", "references: []",
  "state_history: []", "annotations_open: 0", "reeval_pending: false", "visuals: []", "surfaced_by: human",
  "recheck_triggers:", "  - text: Revisit after the next budget cycle",
  "    description: The adopted budget may restate the transfer basis.",
  "---", "", "## Question", "", `${TITLE} ${id}?`, "", word("conformance.rests"), "", "## Conclusion", "",
  word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");

/* ---- the real world: the real ledger and assembly through the store door, one shared published bucket */

function bindPlane() {
  publicationWorker.bindPublishedPlane({
    json: (o, status = 200) => ({ status, body: o }), STORE_SILENT_REASON: "STORE_DID_NOT_ANSWER", STORE_SILENT_DETAIL: "the store did not answer",
    PUBLISHED_STORE: "s", storeSilent: (op) => ({ status: 502, body: { ok: false, reason: "STORE_DID_NOT_ANSWER", op } }),
    requiredArgument: (op, argument, shape, error) => ({ ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, error }), // fixtures-contract: answer-envelope door-helpers
    doAnswer: async (res) => { let out = null; try { out = await (await res).json(); } catch { out = null; }
                               return out && out.ok === true ? { answered: true, result: out.result } : { answered: false }; } });
}

/* The published bucket as the acts and the sweep share it: what was asked of it, and a `put` that throws (`fail`) or silently
   drops the bytes (`drop`) for chosen keys. */
function sharedBucket() {
  const published = new Map(), log = { heads: [], puts: [], gets: [] };
  const base = bucketOver(published);
  const f = { fail: () => false, drop: () => false };
  const bucket = {
    head: async (k) => (log.heads.push(k), base.head(k)),
    get: async (k) => (log.gets.push(k), base.get(k)),
    put: async (k, v, o) => { log.puts.push(k); if (f.fail(k)) throw new Error("bucket refused (injected)"); if (f.drop(k)) return; return base.put(k, v, o); },
  };
  return { published, log, f, bucket };
}

async function house({ real = true, bucket = sharedBucket(), worker: extra = {}, steer = {} } = {}) {
  bindPlane();
  const holder = {}, spy = { assembled: [], failures: [] };
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
  const env = { CAPTURES: bucketOver(new Map()), PUBLISHED: bucket.bucket };
  const worker = { env, storeName: "s", stub: door, ...extra };
  if (real) {
    worker.assembleCaseContainer = async (a) => { spy.assembled.push(a); return publicationWorker.assembleCaseContainer(a); };
    worker.recordCaseFileFailure = (a) => publicationWorker.recordCaseFileFailure(a);
  }
  const w = world({ worker, steer });
  holder.w = w;
  const iris = await newKey();
  w.member("iris", { signer: iris });
  w.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], V("iris"));
  w.r.registerHoldReader({ holdsOn: () => ({ held: false }) });
  const P = w.project("Team", "iris");
  const texts = [], stateReads = { n: 0 };
  const realText = w.record.textAtSha.bind(w.record);
  w.record.textAtSha = (b, s) => { texts.push([b, s]); return realText(b, s); };
  const realState = w.publication.caseEditionState;
  w.publication.caseEditionState = (c, ed, g) => { stateReads.n++; return realState(c, ed, g); };
  const act = async (fn, b, tweak = () => {}) => {
    const p = plane(w, as("iris"));
    p.ctx.env = env;                   /* the acts copy to the very bucket the sweep reads */
    if (real) {
      p.ctx.assembleCaseContainer = (a) => publicationWorker.assembleCaseContainer({ ...a, stub: door });
      p.ctx.recordCaseFileFailure = (a) => { spy.failures.push(a); return publicationWorker.recordCaseFileFailure({ ...a, stub: door }); };
    }
    tweak(p);
    return { ...(await fn(p.request(b), p.stub, p.ctx)), p };
  };
  /* a case edition of `k` findings, stored and ready: `caseBody` signs the case alone, `ratifyBody(i)` the i-th finding */
  let nth = 0;
  const lay = async (k = 1) => {
    const n = ++nth, caseId = `CASE-2026-${String(6000 + n)}`, qs = [];
    for (let i = 1; i <= k; i++) { const q = `INQ-2026-${6000 + n}-m${i}`; w.promote(q, cleanInqMd(q)); w.bv.conc.set(w.key(P, q), OWN); qs.push(q); }
    const conc = qs.flatMap((q) => caseConclusionRowLines(q, w.r.caseConclusionFor(P, q, V("iris"), "open")));
    const text = fmText(cleanCase({ caseId, edition: 1, project: P, members: qs.map((q) => ({ id: q, pin: w.sha(q) })) }),
                        { raw: ["case_conclusions:", ...conc], body: CASE_BODY });
    const docSha = w.caseDoc(caseId, 1, text, { owner: P });
    w.pub.facts.set(`${caseId}#1`, { ok: true, doc: { case_id: caseId, edition: 1, doc_sha: docSha, text },
      attribution: { reached: [], legacy: [], stated: [], current: [] }, signers: w.credentials.attestingKeys(),
      memberBasis: null, priorCase: null });
    const sig = await signCase(iris, caseId, 1, docSha);
    const members = [];
    for (const q of qs) members.push({ id: q, sha: w.sha(q), signature: await signBundle(iris, q, w.sha(q)) });
    return { n, caseId, qs, members, docSha, sig,
      key: (i = 0) => `s/published/${members[i].sha}`,
      textOf: (i = 0) => w.record.readFile(qs[i], "bundle.md").text,
      caseBody: { caseId, edition: 1, expectedSha: docSha, sig },
      sitting: { caseId, edition: 1, expectedSha: docSha, sig, members },
      ratifyBody: (i) => ({ bundleId: qs[i], expectedSha: members[i].sha, sig: members[i].signature }) };
  };
  const ledger = (e) => [...w.st.sql.exec(`SELECT casefile_state state, casefile_attempts attempts, casefile_why why, manifest_sha
                                           FROM published_cases WHERE case_id=? AND edition=1`, e.caseId)][0];
  const why = (e) => { const r = ledger(e); return r && r.why ? JSON.parse(r.why) : null; };
  const sweep = (hours) => w.r.caseFileSweep(Date.now() + hours * HOUR);
  return { w, P, iris, act, lay, ledger, why, sweep, bucket, published: bucket.published, log: bucket.log, f: bucket.f, spy, texts, stateReads, door };
}

/* the heal's own reads of record-core (the sweep's `stateOf` reads the first member's bytes at its pin for the group too) */
const healReads = (s) => s.texts.length - s.stateReads.n;
const failFor = (s, ...keys) => { s.f.fail = (k) => keys.includes(k); };
const healLines = async (fn) => {
  const lines = [], real = console.log;
  console.log = (...a) => { const t = a.join(" "); try { const j = JSON.parse(t); if (j && j.event === "casefile_heal") lines.push(j); } catch { /* another line */ } };
  try { return { out: await fn(), lines }; } finally { console.log = real; }
};

/* ---------------------------------------------------------------- the cases */

test("R57, R6 (a): op=ratify of the last member whose finding copy fails — the answer states COPY_FAILED, the ledger says failed at step copy (BUCKET_FAILED); the first tick the ledger allows copies the finding's bundle.md from the record, builds the edition and records built; the next tick calls the assembly 0 times and puts 0 times", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  const r = await s.act(ratifyOp, e.ratifyBody(0));
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual([r.body.published.reason, s.published.has(e.key())], ["COPY_FAILED", false]);
  assert.deepEqual([s.ledger(e).state, s.why(e).step, s.why(e).code], ["failed", "copy", "BUCKET_FAILED"]);
  s.f.fail = () => false;
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [e.caseId], JSON.stringify(t1).slice(0, 400));
  const stored = s.published.get(e.key());
  assert.equal(new TextDecoder().decode(stored), e.textOf(), "the bytes in the bucket are the record's text");
  assert.equal(await hex(stored), e.members[0].sha, "and hash to the finding's bundle_sha");
  assert.match(String(s.ledger(e).manifest_sha), /^[0-9a-f]{64}$/);
  assert.equal(s.ledger(e).state, "built");
  assert.deepEqual(t1.healed, [{ case: e.caseId, edition: 1, examined: 1, copied: 1, bytes: stored.length, unreadable: 0 }]);
  const calls = s.spy.assembled.length, puts = s.log.puts.length;
  const t2 = await s.sweep(3);
  assert.deepEqual([t2.built, t2.failed, s.spy.assembled.length, s.log.puts.length], [[], [], calls, puts]);
});

test("R57, R6 (b): op=caseratify with a sitting whose finding copy fails — failed at step copy; the sweep copies the finding's bundle.md and builds the edition", async () => {
  const s = await house();
  const e = await s.lay(1);
  failFor(s, e.key());
  const r = await s.act(caseRatifyOp, e.sitting);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.equal(r.body.sitting[0].published.reason, "COPY_FAILED");
  assert.deepEqual([s.ledger(e).state, s.why(e).step, s.why(e).code], ["failed", "copy", "BUCKET_FAILED"]);
  s.f.fail = () => false;
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [e.caseId], JSON.stringify(t1).slice(0, 400));
  assert.equal(await hex(s.published.get(e.key())), e.members[0].sha);
  assert.equal(s.ledger(e).state, "built");
  assert.equal((await s.sweep(3)).built.length, 0);
});

test("R57, R6 (c): an earlier member's op=ratify copy fails and the last member's succeeds — the ledger holds nothing after the first, the last member's act records failed FINDING_MISSING at step build; the sweep copies only the first member's file (the second's head finds it present: 0 record reads, 0 puts for it) and builds", async () => {
  const s = await house();
  const e = await s.lay(2);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key(0));
  const first = await s.act(ratifyOp, e.ratifyBody(0));
  assert.deepEqual([first.status, first.body.published.reason], [200, "COPY_FAILED"]);
  assert.equal(s.ledger(e).state, null, "the first answer is the only statement: the ledger holds nothing for the edition");
  const last = await s.act(ratifyOp, e.ratifyBody(1));
  assert.equal(last.status, 200, JSON.stringify(last.body).slice(0, 300));
  assert.deepEqual([s.ledger(e).state, s.why(e).code, s.why(e).step], ["failed", "FINDING_MISSING", "build"]);
  s.f.fail = () => false;
  const textsBefore = s.texts.length, readsBefore = s.stateReads.n, putsBefore = s.log.puts.length;
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [e.caseId], JSON.stringify(t1).slice(0, 400));
  const heal = s.texts.slice(textsBefore);
  assert.deepEqual(heal.filter(([b]) => b === e.qs[1]), [], "no record read for the finding whose file is present");
  assert.equal(heal.length - (s.stateReads.n - readsBefore), 1, "one record read for the absent one");
  const puts = s.log.puts.slice(putsBefore);
  assert.equal(puts.filter((k) => k === e.key(0)).length, 1);
  assert.equal(puts.filter((k) => k === e.key(1)).length, 0);
  assert.equal(await hex(s.published.get(e.key(0))), e.members[0].sha);
  assert.equal(s.ledger(e).state, "built");
});

test("R57 (d), R-OLD: a published finding row with parts empty (an old row) whose bundle.md is absent is healed by the assembly's own fallback ({path: bundle.md, sha256: bundle_sha}) and the edition built", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  s.f.fail = () => false;
  s.w.st.sql.exec(`UPDATE published_bundles SET parts='[]' WHERE bundle_id=?`, e.qs[0]);
  assert.deepEqual(s.w.realPub.caseEditionState(e.caseId, 1).findings[0].parts, []);
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [e.caseId], JSON.stringify(t1).slice(0, 400));
  assert.equal(await hex(s.published.get(e.key())), e.members[0].sha);
});

test("R57 (e), R-OLD: an edition the real assembly already recorded failed FINDING_MISSING (a put that stored nothing, no error) is built by the sweep with no other change", async () => {
  const s = await house();
  const e = await s.lay(1);
  s.f.drop = (k) => k === e.key();
  const r = await s.act(caseRatifyOp, e.sitting);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.equal(s.published.has(e.key()), false);
  assert.deepEqual([s.ledger(e).state, s.why(e).code, s.why(e).step], ["failed", "FINDING_MISSING", "build"], "the real writer, over the absent finding");
  s.f.drop = () => false;
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [e.caseId], JSON.stringify(t1).slice(0, 400));
  assert.equal(s.ledger(e).state, "built");
});

test("R57 (g): one casefile_heal line per healed edition, none for a healthy one, and none holds document text or a secret", async () => {
  const s = await house();
  const bad = [await s.lay(1), await s.lay(1)], good = await s.lay(1);
  failFor(s, bad[0].key(), bad[1].key());
  for (const e of bad) assert.equal((await s.act(caseRatifyOp, e.sitting)).status, 200);
  s.f.fail = () => false;
  assert.equal((await s.act(caseRatifyOp, good.sitting)).status, 200);
  assert.equal(s.ledger(good).state, "built", "the healthy edition built at its act");
  const { out, lines } = await healLines(() => s.sweep(1));
  assert.deepEqual(out.built.map((b) => b.case), bad.map((e) => e.caseId));
  assert.deepEqual(lines.map((l) => [l.case, l.edition, l.examined, l.copied, l.unreadable]), bad.map((e) => [e.caseId, 1, 1, 1, 0]));
  assert.deepEqual(out.healed.map((h) => h.case), bad.map((e) => e.caseId));
  for (const l of lines) {
    assert.ok(!JSON.stringify(l).includes(TITLE), "no document text");
    assert.ok(!JSON.stringify(l).includes(bad[0].docSha), "no signed bytes");
  }
  const none = await healLines(() => s.sweep(3));
  assert.deepEqual([none.lines, none.out.healed], [[], []], "nothing owed, nothing healed, nothing logged");
});

test("R57 (h): a put that throws for good — each due tick records failed BUCKET_FAILED at step copy once and backs off; a tick before the backoff is due does nothing (no spin without a record)", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  const a0 = s.ledger(e).attempts;
  const t1 = await healLines(() => s.sweep(1));
  assert.deepEqual([t1.out.failed.map((f) => f.code), s.ledger(e).state, s.why(e).code, s.why(e).step], [["BUCKET_FAILED"], "failed", "BUCKET_FAILED", "copy"]);
  assert.equal(s.ledger(e).attempts, a0 + 1, "one attempt recorded by the tick");
  assert.equal(t1.out.healed[0].copied, 0);
  assert.equal(t1.lines.length, 1);
  const calls = s.spy.assembled.length, puts = s.log.puts.length;
  const at = Date.parse([...s.w.st.sql.exec(`SELECT casefile_attempted_at a FROM published_cases WHERE case_id=?`, e.caseId)][0].a);
  const inside = await s.w.r.caseFileSweep(at + 1000);
  assert.deepEqual([inside.built, inside.failed, s.log.puts.length, s.spy.assembled.length], [[], [], puts, calls], "inside the backoff: nothing owed, nothing tried");
  const t2 = await s.sweep(2);
  assert.equal(s.ledger(e).attempts, a0 + 2);
  assert.equal(t2.failed.length, 1);
  assert.equal(s.ledger(e).state, "failed", "never built, never stopped");
});

/* ---------------------------------------------------------------- controls */

test("R57 C1: a healthy edition (the finding's bytes present) — built, the heal reads the record 0 times and puts the finding 0 times", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  assert.equal((await s.act(ratifyOp, e.ratifyBody(0))).status, 200);
  s.w.st.sql.exec(`UPDATE published_cases SET casefile_state='failed', casefile_attempts=1, casefile_attempted_at=?`, new Date(0).toISOString());
  const reads = s.texts.length, state = s.stateReads.n, puts = s.log.puts.length;
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [e.caseId], JSON.stringify(t1).slice(0, 300));
  assert.equal((s.texts.length - reads) - (s.stateReads.n - state), 0, "textAtSha called 0 times for the heal");
  assert.equal(s.log.puts.slice(puts).filter((k) => k === e.key()).length, 0);
  assert.deepEqual(t1.healed ?? [], []);
});

test("R57 C2, R6: the edition healed today — a re-sent op=ratify (a retry, existed) copies the finding, and the bytes equal the record's (the heal's source is right)", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  s.f.fail = () => false;
  const again = await s.act(ratifyOp, e.ratifyBody(0));
  assert.equal(again.body.existed, true);
  assert.equal(new TextDecoder().decode(s.published.get(e.key())), e.textOf());
  assert.equal(s.ledger(e).state, "built");
});

test("R57 C3: the record holds no text for the part's hash — the sweep puts nothing, records FINDING_MISSING, retries the edition at its backoff, never stops it, and records no manifest", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  s.f.fail = () => false;
  s.w.st.sql.exec(`DELETE FROM files WHERE bundle_id=? AND path='bundle.md'`, e.qs[0]);
  s.w.st.sql.exec(`DELETE FROM history WHERE bundle_id=? AND path='bundle.md'`, e.qs[0]);
  const puts = s.log.puts.length;
  const t1 = await s.sweep(1);
  assert.deepEqual(s.log.puts.slice(puts).filter((k) => k === e.key()), []);
  assert.deepEqual([s.ledger(e).state, s.why(e).code], ["failed", "FINDING_MISSING"]);
  assert.equal(s.ledger(e).manifest_sha, null);
  for (let h = 2; h < 12; h += 2) await s.sweep(h);
  assert.notEqual(s.ledger(e).state, "stopped", "FINDING_MISSING is never stopped");
  assert.equal(s.ledger(e).manifest_sha, null);
  assert.equal(s.published.has(e.key()), false);
});

test("R57 (i): a part the record cannot read is listed unreadable in the tick's answer and logged, never put, and the assembly runs and states FINDING_MISSING", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  s.f.fail = () => false;
  s.w.st.sql.exec(`DELETE FROM files WHERE bundle_id=? AND path='bundle.md'`, e.qs[0]);
  s.w.st.sql.exec(`DELETE FROM history WHERE bundle_id=? AND path='bundle.md'`, e.qs[0]);
  const { out, lines } = await healLines(() => s.sweep(1));
  assert.deepEqual(out.healed, [{ case: e.caseId, edition: 1, examined: 1, copied: 0, bytes: 0, unreadable: 1 }]);
  assert.equal(lines.length, 1);
  assert.deepEqual([s.ledger(e).state, s.why(e).code], ["failed", "FINDING_MISSING"]);
});

test("R57 C4: a record row whose text does not hash to the part is never put", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  s.f.fail = () => false;
  s.w.st.sql.exec(`UPDATE files SET content='something else' WHERE bundle_id=? AND path='bundle.md'`, e.qs[0]);
  s.w.st.sql.exec(`UPDATE history SET content='something else' WHERE bundle_id=? AND path='bundle.md'`, e.qs[0]);
  const puts = s.log.puts.length;
  await s.sweep(1);
  assert.deepEqual(s.log.puts.slice(puts).filter((k) => k === e.key()), []);
  assert.equal(s.published.has(e.key()), false);
  assert.equal(s.why(e).code, "FINDING_MISSING");
});

test("R57 C5: a tick with a heal error and a missing material records BUCKET_FAILED (the materials information is not read) and does not advance the run count toward stopped", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  s.w.publication.heldMaterialsOf = () => [{ sha: "d4".repeat(32), held: "evidence" }];
  for (const h of [1, 2, 3]) {
    await s.sweep(h);
    assert.deepEqual([s.ledger(e).state, s.why(e).code, s.why(e).step], ["failed", "BUCKET_FAILED", "copy"], `tick ${h}`);
    assert.ok(!s.why(e).run, "no MATERIAL_MISSING run is counted");
  }
  s.f.fail = () => false;
  const t = await s.sweep(5);
  assert.equal(t.failed[0].code, "MATERIAL_MISSING", "the heal now succeeds; the materials are read again");
  assert.notEqual(s.ledger(e).state, "stopped");
});

test("R57 C6: a world whose record provides no textAtSha (the dependency absent) heals nothing, asks the bucket nothing, and the assembly states FINDING_MISSING as today", async () => {
  const s = await house();
  const e = await s.lay(1);
  assert.equal((await s.act(caseRatifyOp, e.caseBody)).status, 200);
  failFor(s, e.key());
  await s.act(ratifyOp, e.ratifyBody(0));
  s.f.fail = () => false;
  const calls = [];
  const out = await sweepCaseFiles({ publication: s.w.publication, stateOf: (id, ed) => s.w.publication.caseEditionState(id, ed, "test-group"),
    materialsOf: () => [], worker: { env: { PUBLISHED: s.bucket.bucket, CAPTURES: bucketOver(new Map()) }, storeName: "s", stub: s.door }, now: Date.now() + HOUR,
    assemble: async (a) => { calls.push(a); return publicationWorker.assembleCaseContainer(a); }, recordFailure: publicationWorker.recordCaseFileFailure });
  assert.equal(calls.length, 1);
  assert.deepEqual([out.healed ?? [], s.published.has(e.key())], [[], false]);
  assert.equal(s.why(e).code, "FINDING_MISSING");
});

/* ---------------------------------------------------------------- the bounds (f), over the stand-in ledger */

function standLedger(w) {
  const rows = new Map(), key = (c, e) => `${c}#${e}`;
  const L = { rows, calls: [],
    owed({ now, limit }) {
      const out = [];
      for (const r of w.st.sql.exec(`SELECT case_id, edition FROM published_cases ORDER BY opened, case_id`)) {
        const cs = w.realPub.caseEditionState(r.case_id, r.edition);
        const row = rows.get(key(r.case_id, r.edition)) || {};
        if (!cs || !cs.complete || row.state === "built") continue;
        out.push({ case: r.case_id, edition: r.edition });
      }
      return out.slice(0, limit);
    },
    nextAt: () => null, record: () => ({ ok: true }),
    assemble: async (a) => { L.calls.push(a); const id = a.cs.caseId ?? a.cs.case_id;
      rows.set(key(id, a.cs.edition), { state: "built" });
      return { manifest_sha: `${a.cs.edition}${"f".repeat(63)}`, files: 12, part_addresses: [{ bytes: 1000 }] }; } };
  return L;
}

/* two complete editions laid by the real commit; the first's state, as the sweep reads it, gains `extra` synthetic member
   findings whose texts the record answers by hash, and `absent(i)` says which of the first's findings the bucket lacks */
async function boundsHouse({ extra, absent }) {
  const holder = {}, bucket = sharedBucket();
  const s = await house({ real: false, bucket,
    worker: { assembleCaseContainer: (a) => holder.L.assemble(a), recordCaseFileFailure: async () => ({ ok: true }) },
    steer: { caseFilesOwed: (a) => holder.L.owed(a), caseFileNextAt: () => holder.L.nextAt(), recordCaseFileAttempt: (a) => holder.L.record(a) } });
  holder.L = standLedger(s.w);
  const editions = [await s.lay(1), await s.lay(1)];
  for (const e of editions) assert.equal((await s.act(caseRatifyOp, e.sitting, (p) => { p.ctx.assembleCaseContainer = async () => NOT_ASSEMBLED; })).status, 200);
  for (const e of editions) assert.equal(s.w.realPub.caseEditionState(e.caseId, 1).complete, true);
  const [A] = editions, syn = new Map(), findings = [];
  for (let i = 1; i <= extra; i++) {
    const text = `---\nid: INQ-SYN-${i}\n---\nsynthetic finding ${i}\n`;
    const sha = await hex(enc(text));
    syn.set(`INQ-SYN-${i}@${sha}`, text);
    findings.push({ bundle_id: `INQ-SYN-${i}`, bundle_sha: sha, version_sha: sha, parts: [{ path: "bundle.md", sha256: sha, kind: "bundle", bytes: enc(text).length }] });
  }
  const realState = s.w.publication.caseEditionState;
  s.w.publication.caseEditionState = (c, ed, g) => { const st = realState(c, ed, g); return st && c === A.caseId ? { ...st, findings: [...st.findings, ...findings] } : st; };
  const realText = s.w.record.textAtSha;
  s.w.record.textAtSha = (b, h) => syn.get(`${b}@${h}`) ?? realText(b, h);
  const all = [{ key: A.key(0), text: A.textOf(0) }, ...findings.map((f) => ({ key: `s/published/${f.bundle_sha}`, text: syn.get(`${f.bundle_id}@${f.bundle_sha}`) }))];
  all.forEach((f, i) => { if (absent(i, all.length)) s.published.delete(f.key); else s.published.set(f.key, enc(f.text)); });
  for (const k of ["heads", "puts", "gets"]) s.log[k].length = 0;   /* count only what the sweep asks */
  return { ...s, L: holder.L, editions, A, B: editions[1], total: all.length, all };
}

test("R57 (f): bounds — an edition of 450 member findings with only the last 3 bundle.md absent is healed and built in one tick (no livelock past finding 400); its heads count into the tick's files, so the second owed edition's assembly is called 0 times", async () => {
  const s = await boundsHouse({ extra: 449, absent: (i, n) => i >= n - 3 });
  assert.equal(s.total, 450);
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [s.A.caseId], JSON.stringify(t1).slice(0, 300));
  assert.equal(s.log.heads.length, 450, "every member finding headed once");
  assert.equal(s.log.puts.length, 3);
  assert.deepEqual(s.L.calls.map((c) => c.cs.caseId), [s.A.caseId], "the second edition is not assembled in this tick");
  assert.ok(t1.files >= 450, `the heads are counted into the tick's files (${t1.files})`);
  assert.deepEqual(t1.healed.map((h) => [h.examined, h.copied, h.unreadable]), [[450, 3, 0]]);
  const t2 = await s.sweep(2);
  assert.deepEqual(t2.built.map((b) => b.case), [s.B.caseId], "the next tick takes the second");
});

test("R57 (f): bounds — a 450-finding edition with every bundle.md absent is healed over ticks of at most 400 puts each, not assembled until complete, built once", async () => {
  const s = await boundsHouse({ extra: 449, absent: () => true });
  const t1 = await s.sweep(1);
  assert.equal(CASEFILE_SWEEP_FILES, 400);
  assert.equal(s.log.puts.length, 400, "a tick stops its puts at the constant");
  assert.deepEqual([t1.built, s.L.calls.length], [[], 0], "not assembled while a bundle.md is absent");
  const t2 = await s.sweep(2);
  assert.equal(s.log.puts.length, 450);
  assert.deepEqual(t2.built.map((b) => b.case), [s.A.caseId]);
  assert.equal(s.L.calls.length, 1);
});

test("R57 (f) control: two small editions are both taken in one tick (two a tick)", async () => {
  const s = await boundsHouse({ extra: 0, absent: () => true });
  const t1 = await s.sweep(1);
  assert.deepEqual(t1.built.map((b) => b.case), [s.A.caseId, s.B.caseId].sort());
  assert.ok(CASEFILE_SWEEP_BYTES > 0);
});
