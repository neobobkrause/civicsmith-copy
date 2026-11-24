/* publication — G54 (K4426, K4565, K4566, K4571): the case file's ledger on `published_cases` (`casefile_state`,
   `casefile_attempts`, `casefile_attempted_at`, `casefile_why`), its one writer `recordCaseFileAttempt` (the store-internal
   hop `recordcasefile`), and the one owed rule `caseFilesOwed` / `caseFileNextAt`. Driven at the module's interface: the
   editions are made by the real commit (`signCase`, `signFinding`), the writer is called as the Worker's hop calls it
   (through the op map), and `recordCaseManifest` is the real manifest record. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, NOW, sha, V } from "./fixture.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { migratePublication } from "../../../src/publication/schema.mjs";
import { CASEFILE_MISSING_MAX_ATTEMPTS, CASEFILE_STEPS, CASEFILE_GRACE_MS, CASEFILE_BACKOFF_FIRST_MS, CASEFILE_BACKOFF_MAX_MS,
         CASEFILE_BUILDING_WAIT_MS, CASEFILE_TEXT_MAX, CASEFILE_WHY_BYTES_MAX, CASEFILES_OWED_MAX } from "../../../src/publication/index.mjs";

const T0 = Date.parse(NOW);
const iso = (ms) => new Date(ms).toISOString();
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" }));
const cid = (n) => `CASE-2026-000${n}`;
const fid = (n) => `INQ-2026-000${n}`;

/* A world with one project and `n` cases, each over its own finding; none signed yet. */
function base(n = 1) {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  const cases = [];
  for (let i = 1; i <= n; i++) {
    const doc = `INFO-2026-000${i}-minutes`;
    w.doc(doc);
    w.inquiry(fid(i), { legs: [{ target: doc }] });
    cases.push({ id: cid(i), finding: fid(i), roles: [{ target: fid(i), version_sha: w.head(fid(i)) }] });
  }
  return { w, proj, cases };
}
/* the case edition is committed and COMPLETE when its member is published, the last member landing at `at` */
function complete(w, proj, c, { edition = 1, at = NOW } = {}) {
  w.prepare(c.id, edition, { project: proj, roles: c.roles });
  assert.equal(w.signCase(c.id, edition, { project: proj, roster: roster(c.roles), at }).ok, true);
  assert.equal(w.signFinding(c.finding, { at }).ok, true);
  assert.equal(w.p.caseEditionState(c.id, edition).complete, true);
}
/* the manifest, recorded as the Worker's hop records it */
const manifest = (w, id, ed = 1) => w.p.recordCaseManifest({ caseId: id, edition: ed, manifest: { files: [] }, manifestSha: sha(`manifest ${id} ${ed}`), bytes: 5 });
const ledger = (w, id, ed = 1) => w.row(`SELECT casefile_state AS state, casefile_attempts AS attempts, casefile_attempted_at AS at, casefile_why AS why
                                         FROM published_cases WHERE case_id=? AND edition=?`, id, ed);
const rec = (w, id, state, why, at, extra = {}) => w.op("recordcasefile", {}, { caseId: id, edition: 1, state, why, at: iso(at), ...extra });
const FAIL = { code: "BUCKET_FAILED", step: "bucket_put", error: "put failed" };
const owed = (w, now, limit) => w.p.caseFilesOwed({ now: iso(now), limit });

test("R15 R40 caseFilesOwed: a complete edition with no manifest is owed once its 2 minutes are up, never before; an incomplete edition never; caseFileNextAt is the earliest due", () => {
  const { w, proj, cases } = base(3);
  assert.equal(w.p.caseFileNextAt(), null, "nothing owed in a store with no edition");
  assert.deepEqual(w.p.caseFilesOwed({ now: iso(T0 + 1e9) }), []);
  complete(w, proj, cases[0], { at: iso(T0 + 60000) });
  complete(w, proj, cases[1], { at: iso(T0) });
  /* the third is committed and its member never published: incomplete */
  w.prepare(cases[2].id, 1, { project: proj, roles: cases[2].roles });
  w.signCase(cases[2].id, 1, { project: proj, roster: roster(cases[2].roles) });
  assert.equal(CASEFILE_GRACE_MS, 120000);
  assert.deepEqual(owed(w, T0 + CASEFILE_GRACE_MS - 1), [], "inside the grace");
  const first = owed(w, T0 + CASEFILE_GRACE_MS);
  assert.deepEqual(first.map((x) => [x.case, x.edition, x.state, x.attempts]), [[cases[1].id, 1, null, 0]]);
  assert.equal(first[0].next_at, iso(T0 + CASEFILE_GRACE_MS));
  const both = owed(w, T0 + CASEFILE_GRACE_MS + 60000);
  assert.deepEqual(both.map((x) => x.case), [cases[1].id, cases[0].id], "oldest due first");
  assert.deepEqual(owed(w, T0 + 1e9, 1).map((x) => x.case), [cases[1].id], "limit");
  assert.ok(CASEFILES_OWED_MAX >= 1 && w.p.caseFilesOwed({ now: iso(T0 + 1e9) }).length === 2, "the incomplete edition is never returned, however late");
  assert.equal(w.p.caseFileNextAt(), iso(T0 + CASEFILE_GRACE_MS), "the earliest due, whether or not due yet");
});

test("R15 R40 caseFilesOwed: a failed edition is owed after its backoff, 15 s doubling to 1 h; a building after at least 2 minutes", () => {
  assert.deepEqual([CASEFILE_BACKOFF_FIRST_MS, CASEFILE_BACKOFF_MAX_MS, CASEFILE_BUILDING_WAIT_MS], [15000, 3600000, 120000]);
  const { w, proj, cases } = base(1);
  complete(w, proj, cases[0]);
  let t = T0 + CASEFILE_GRACE_MS;
  for (let k = 1; k <= 11; k++) {
    assert.equal(rec(w, cases[0].id, "failed", FAIL, t).attempts, k);
    const wait = Math.min(CASEFILE_BACKOFF_FIRST_MS * 2 ** (k - 1), CASEFILE_BACKOFF_MAX_MS);
    assert.deepEqual(owed(w, t + wait - 1), [], `attempt ${k}: not owed inside ${wait} ms`);
    const due = owed(w, t + wait);
    assert.deepEqual(due.map((x) => [x.case, x.state, x.attempts]), [[cases[0].id, "failed", k]], `attempt ${k}: owed after ${wait} ms`);
    assert.equal(w.p.caseFileNextAt(), iso(t + wait));
    t += wait;
  }
  assert.equal(Math.min(CASEFILE_BACKOFF_FIRST_MS * 2 ** 10, CASEFILE_BACKOFF_MAX_MS), 3600000, "the 11th wait is the 1 h cap");
  /* a building waits at least 2 minutes, longer once the backoff has passed that */
  const b = base(1); complete(b.w, b.proj, b.cases[0]);
  rec(b.w, b.cases[0].id, "building", null, T0);
  assert.deepEqual(owed(b.w, T0 + 119999), []);
  assert.deepEqual(owed(b.w, T0 + 120000).map((x) => [x.state, x.attempts]), [["building", 1]], "a building is an attempt, owed after 2 minutes");
  for (let k = 2; k <= 8; k++) rec(b.w, b.cases[0].id, "failed", FAIL, T0 + k);
  rec(b.w, b.cases[0].id, "building", null, T0 + 10);
  const wait = Math.min(CASEFILE_BACKOFF_FIRST_MS * 2 ** 8, CASEFILE_BACKOFF_MAX_MS);
  assert.deepEqual(owed(b.w, T0 + 10 + wait - 1), [], "a kill loop backs off");
  assert.equal(owed(b.w, T0 + 10 + wait).length, 1);
});

test("R15 R40 a built edition, or one with a manifest and no ledger state, is never owed; a manifest with a failed or building ledger is; recordCaseManifest leaves the four columns as they were", () => {
  const { w, proj, cases } = base(2);
  complete(w, proj, cases[0]); complete(w, proj, cases[1]);
  const late = T0 + 1e9;
  assert.equal(manifest(w, cases[0].id).ok, true);
  assert.deepEqual(owed(w, late).map((x) => x.case), [cases[1].id], "a manifest with a null state is built (R-OLD), the other is owed");
  assert.deepEqual(ledger(w, cases[0].id), { state: null, attempts: null, at: null, why: null }, "the manifest record writes none of the four columns");
  assert.equal(rec(w, cases[0].id, "failed", FAIL, T0).state, "failed");
  const before = ledger(w, cases[0].id);
  assert.equal(manifest(w, cases[0].id).existed, true);
  assert.deepEqual(ledger(w, cases[0].id), before, "recordCaseManifest of the same hash leaves them");
  assert.equal(w.p.recordCaseManifest({ caseId: cases[0].id, edition: 1, manifest: {}, manifestSha: sha("other") }).reason, "MANIFEST_EXISTS");
  assert.deepEqual(ledger(w, cases[0].id), before, "a refused manifest record leaves them");
  assert.deepEqual(owed(w, late).map((x) => [x.case, x.state]), [[cases[0].id, "failed"], [cases[1].id, null]].map(([c, s]) => [c, s]),
                   "a manifest is set and the ledger says failed: owed (manifest_put failed)");
  const m1 = manifest(w, cases[1].id);
  assert.equal(m1.ok, true);
  const after1 = ledger(w, cases[1].id);
  assert.deepEqual(after1, { state: null, attempts: null, at: null, why: null });
  assert.equal(rec(w, cases[0].id, "built", null, T0 + 5).state, "built");
  assert.equal(rec(w, cases[1].id, "building", null, T0).state, "building");
  assert.deepEqual(owed(w, T0 + 119999).map((x) => x.case), [], "building inside its 2 minutes");
  assert.deepEqual(owed(w, late).map((x) => [x.case, x.state]), [[cases[1].id, "building"]], "built is never owed again; a building past 2 minutes is");
  assert.equal(rec(w, cases[1].id, "built", null, T0 + 130000).state, "built");
  assert.deepEqual(owed(w, late), [], "after built, never");
  assert.equal(w.p.caseFileNextAt(), null);
});

test("R15 recordCaseFileAttempt: building and failed add one attempt, built adds none and clears the why; a late building or failed never undoes a built; built needs a manifest", () => {
  const { w, proj, cases } = base(1);
  const id = cases[0].id;
  complete(w, proj, cases[0]);
  assert.deepEqual(w.p.recordCaseFileAttempt({ caseId: id, edition: 1, state: "built", at: iso(T0) }), { ok: false, reason: "NO_MANIFEST", caseId: id, edition: 1 });
  assert.deepEqual(ledger(w, id), { state: null, attempts: null, at: null, why: null }, "refused: nothing written");
  assert.deepEqual(rec(w, id, "building", null, T0), { ok: true, caseId: id, edition: 1, state: "building", attempts: 1 });
  assert.deepEqual(rec(w, id, "failed", FAIL, T0 + 1000), { ok: true, caseId: id, edition: 1, state: "failed", attempts: 2 });
  assert.deepEqual(ledger(w, id), { state: "failed", attempts: 2, at: iso(T0 + 1000), why: JSON.stringify(FAIL) });
  manifest(w, id);
  assert.deepEqual(rec(w, id, "built", null, T0 + 2000), { ok: true, caseId: id, edition: 1, state: "built", attempts: 2 });
  assert.deepEqual(ledger(w, id), { state: "built", attempts: 2, at: iso(T0 + 2000), why: null });
  assert.equal(rec(w, id, "built", null, T0 + 9000).existed, true, "built again changes nothing");
  assert.equal(ledger(w, id).at, iso(T0 + 2000));
  const late = rec(w, id, "failed", FAIL, T0 + 3000);
  assert.deepEqual([late.ok, late.state, late.existed], [true, "built", true], "a concurrent assembly's late failure does not undo a built");
  assert.equal(rec(w, id, "building", null, T0 + 3000).state, "built");
  assert.deepEqual(ledger(w, id), { state: "built", attempts: 2, at: iso(T0 + 2000), why: null });
  assert.deepEqual(owed(w, T0 + 1e9), []);
});

test("R15 R40 stopped: the MATERIAL_MISSING failure that is the bound-th in a row, with the absence confirmed, is stored stopped; never owed; not rewritten; any other code resets the run", () => {
  assert.equal(CASEFILE_MISSING_MAX_ATTEMPTS, 6);
  const MISS = { code: "MATERIAL_MISSING", step: "materials", detail: "d299837e" };
  const { w, proj, cases } = base(1);
  const id = cases[0].id;
  complete(w, proj, cases[0]);
  let t = T0 + CASEFILE_GRACE_MS;
  for (let k = 1; k < CASEFILE_MISSING_MAX_ATTEMPTS; k++) {
    const r = rec(w, id, "failed", MISS, t, { absent: true });
    assert.equal(r.state, "failed", `failure ${k} is not yet the bound`);
    assert.equal(JSON.parse(ledger(w, id).why).run, k, "the run is counted in the why");
    rec(w, id, "building", null, t + 1);
    assert.equal(JSON.parse(ledger(w, id).why).run, k, "a building keeps the run it interrupts");
    t += 3600000;
  }
  const last = rec(w, id, "failed", MISS, t, { absent: true });
  assert.equal(last.state, "stopped");
  assert.equal(JSON.parse(ledger(w, id).why).code, "MATERIAL_MISSING");
  assert.deepEqual(owed(w, t + 1e12), [], "a stopped edition is never owed");
  assert.equal(w.p.caseFileNextAt(), null, "caseFileNextAt ignores it");
  const frozen = ledger(w, id);
  for (const s of ["building", "failed"]) assert.equal(rec(w, id, s, MISS, t + 1, { absent: true }).state, "stopped");
  assert.deepEqual(ledger(w, id), frozen, "a stopped edition is not rewritten by a tick");
  /* the absence unconfirmed: never stopped, however many in a row */
  const u = base(1); complete(u.w, u.proj, u.cases[0]);
  for (let k = 1; k <= CASEFILE_MISSING_MAX_ATTEMPTS + 3; k++) assert.equal(rec(u.w, u.cases[0].id, "failed", MISS, T0 + k).state, "failed");
  assert.equal(owed(u.w, T0 + 1e12).length, 1, "retried by the backoff");
  /* another code between resets the run */
  const r = base(1); complete(r.w, r.proj, r.cases[0]);
  for (let k = 1; k < CASEFILE_MISSING_MAX_ATTEMPTS; k++) rec(r.w, r.cases[0].id, "failed", MISS, T0 + k, { absent: true });
  rec(r.w, r.cases[0].id, "failed", FAIL, T0 + 100, { absent: true });
  assert.equal(rec(r.w, r.cases[0].id, "failed", MISS, T0 + 200, { absent: true }).state, "failed", "the run started again");
  /* a built is accepted over a stopped (the edition was rebuilt by a person re-sending the signature) */
  manifest(w, id);
  assert.equal(rec(w, id, "built", null, t + 5).state, "built");
  assert.deepEqual(owed(w, t + 1e12), []);
});

test("R15 the why is reduced to its keys and cut: the error to 160 characters, the row under 1 KB; an unknown step, a bad state, a missing why or a missing edition writes nothing", () => {
  const { w, proj, cases } = base(1);
  const id = cases[0].id;
  complete(w, proj, cases[0]);
  assert.equal(CASEFILE_TEXT_MAX, 160);
  assert.equal(CASEFILE_WHY_BYTES_MAX, 1024);
  const long = "é".repeat(5000);
  const r = rec(w, id, "failed", { code: "UNKNOWN", step: "build", error: long, detail: long, bytes: 7, files: 3, secret: "must not be kept", text: "nor this" }, T0);
  assert.equal(r.ok, true);
  const why = JSON.parse(ledger(w, id).why);
  assert.ok([...why.error].length <= 160 && [...(why.detail ?? "")].length <= 160);
  assert.ok(Buffer.byteLength(ledger(w, id).why) <= 1024, "under 1 KB, whatever the characters");
  assert.deepEqual(Object.keys(why).filter((k) => !["code", "step", "error", "detail", "bytes", "files", "run"].includes(k)), [], "only the known keys");
  assert.deepEqual([why.code, why.step, why.bytes, why.files], ["UNKNOWN", "build", 7, 3]);
  const snap = JSON.stringify(w.snapshot());
  for (const bad of [{ caseId: id, edition: 1, state: "failed", why: { code: "X_Y", step: "nowhere" } },
                     { caseId: id, edition: 1, state: "failed", why: { code: "lower", step: "build" } },
                     { caseId: id, edition: 1, state: "failed" },
                     { caseId: id, edition: 1, state: "stopped", why: FAIL },
                     { caseId: id, edition: 1, state: "sideways", why: FAIL },
                     { caseId: "", edition: 1, state: "failed", why: FAIL },
                     { caseId: id, edition: 0, state: "failed", why: FAIL },
                     { caseId: id, edition: 1, state: "failed", why: FAIL, at: "not a time" },
                     { caseId: id, edition: 1, state: "building", why: { code: "X", step: "bad" } }])
    assert.equal(w.op("recordcasefile", {}, bad).reason, "MALFORMED", JSON.stringify(bad));
  assert.equal(w.op("recordcasefile", {}, null).reason, "MALFORMED");
  assert.equal(w.op("recordcasefile", {}, { caseId: id, edition: 9, state: "building" }).reason, "NO_SUCH_CASE_EDITION");
  assert.equal(JSON.stringify(w.snapshot()), snap, "every refusal writes nothing");
  for (const step of CASEFILE_STEPS) assert.equal(rec(w, id, "failed", { code: "UNKNOWN", step }, T0).ok, true, step);
  assert.deepEqual(CASEFILE_STEPS, ["facts", "copy", "materials", "build", "bucket_put", "quartet", "record", "manifest_put"]);
});

test("R15 R40 controls: the ledger writes touch no other column or table, and a store migrated from the old table adds the columns once and a second boot adds nothing", () => {
  const { w, proj, cases } = base(1);
  const id = cases[0].id;
  complete(w, proj, cases[0]);
  manifest(w, id);
  const OLD = `case_id, edition, scope, completeness, bias_acknowledgement, ratified_at, signed_at, published_at, bar, opened, manifest_sha, manifest, criteria`;
  const others = () => { const s = w.snapshot(); delete s.published_cases; return JSON.stringify(s); };
  const pc = () => JSON.stringify(w.rows(`SELECT ${OLD} FROM published_cases ORDER BY case_id, edition`));
  const [o0, p0] = [others(), pc()];
  rec(w, id, "building", null, T0); rec(w, id, "failed", FAIL, T0 + 1); rec(w, id, "built", null, T0 + 2);
  assert.equal(others(), o0, "no other table, and so no registration, changes");
  assert.equal(pc(), p0, "every existing column of the edition is as it was");
  /* an old store: the four columns dropped, a row kept */
  const sql = w.st.sql;
  for (const c of ["casefile_state", "casefile_attempts", "casefile_attempted_at", "casefile_why"]) sql.exec(`ALTER TABLE published_cases DROP COLUMN ${c}`);
  const cols = () => w.rows(`PRAGMA table_info(published_cases)`).map((r) => r.name);
  assert.ok(!cols().includes("casefile_state"));
  const rowOld = pc();
  migratePublication(sql);
  const once = cols();
  for (const c of ["casefile_state", "casefile_attempts", "casefile_attempted_at", "casefile_why"]) assert.equal(once.filter((x) => x === c).length, 1, c);
  assert.equal(pc(), rowOld, "the row is as it was");
  assert.deepEqual(ledger(w, id), { state: null, attempts: null, at: null, why: null }, "never back-filled");
  migratePublication(sql);
  assert.deepEqual(cols(), once, "a second boot adds nothing");
  assert.deepEqual(owed(w, T0 + 1e12), [], "an old row with a manifest and a null state reads built");
  /* an old row with no manifest and no ledger is owed as never attempted */
  const n = base(1); complete(n.w, n.proj, n.cases[0]);
  for (const c of ["casefile_state", "casefile_attempts", "casefile_attempted_at", "casefile_why"]) n.w.st.sql.exec(`ALTER TABLE published_cases DROP COLUMN ${c}`);
  migratePublication(n.w.st.sql);
  assert.deepEqual(owed(n.w, T0 + CASEFILE_GRACE_MS).map((x) => [x.case, x.state, x.attempts]), [[n.cases[0].id, null, 0]]);
});

test("R31 R40 published_cases is declared as before: exempt from purge, admin-only export, no expunge, stored, seen as the group", () => {
  const { w } = base(1);
  const d = w.record.declaredTables().find((x) => x.name === "published_cases");
  assert.deepEqual([d.module, d.purge, d.export, d.expunge, d.derive, d.sight], ["publication", "exempt", "admin-only", "none", "stored", "group"]);
});

test("R15 the hop `recordcasefile` is served through the real dispatcher beside `recordcasemanifest`, and is reachable from no op a caller can name", () => {
  const { w, proj, cases } = base(1);
  const id = cases[0].id;
  complete(w, proj, cases[0]);
  const viaOp = w.op("recordcasefile", {}, { caseId: id, edition: 1, state: "failed", why: FAIL, at: iso(T0) });
  assert.deepEqual(viaOp, { ok: true, caseId: id, edition: 1, state: "failed", attempts: 1 });
  assert.equal(w.op("recordcasemanifest", {}, { caseId: id, edition: 1, manifest: { files: [] }, manifestSha: sha("m"), bytes: 1 }).ok, true);
  /* a body's own copy of a stamp never reaches it; the query is not read at all */
  assert.deepEqual(w.op("recordcasefile", { case: "OTHER", edition: 7, state: "built" }, { caseId: id, edition: 1, state: "building", at: iso(T0 + 1) }).state, "building");
  /* the census: the hop is a store-internal route beside the manifest's. No other op of the map (the two hops aside) can
     write the ledger, whatever a caller's query or body carries: each is run with the ledger's own keys and the four
     columns are read after. */
  const keys = Object.keys(publicationOps(w.p, new URL("http://do/x"), {}));
  assert.ok(keys.includes("recordcasefile") && keys.includes("recordcasemanifest"));
  const fixed = ledger(w, id);
  const body = { caseId: id, edition: 1, case: id, state: "built", why: FAIL, at: iso(T0 + 7), absent: true, manifest: { files: [] }, manifestSha: sha("zzz") };
  for (const k of keys.filter((x) => !["recordcasefile", "recordcasemanifest"].includes(x))) {
    try { w.op(k, { case: id, edition: 1, id, viewer: V("olive"), by: V("olive"), state: "built" }, body); } catch { /* a refusal or a throw is no write */ }
    assert.deepEqual(ledger(w, id), fixed, `${k} leaves the ledger`);
  }
});

test("R15 recordCaseManifest built:true: one call leaves the manifest recorded and the case file built, no longer owed; without it still owed; a retry with it builds a manifest recorded without it; a malformed built is MALFORMED and writes nothing", () => {
  const { w, proj, cases } = base(3);
  for (const c of cases) complete(w, proj, c);
  const at = T0 + CASEFILE_GRACE_MS;
  const call = (c, extra = {}) => w.p.recordCaseManifest({ caseId: c.id, edition: 1, manifest: { files: [] }, manifestSha: sha(`manifest ${c.id} 1`), bytes: 5, ...extra });

  const r = call(cases[0], { built: true });
  assert.equal(r.ok, true);
  assert.equal(r.manifest_sha, sha(`manifest ${cases[0].id} 1`));
  assert.equal(ledger(w, cases[0].id).state, "built", "the case file is built by the one call");
  assert.equal(w.row(`SELECT manifest_sha FROM published_cases WHERE case_id=?`, cases[0].id).manifest_sha, r.manifest_sha);
  assert.equal(owed(w, at).some((x) => x.case === cases[0].id), false, "a built case file is no longer owed");

  /* control: without it, as before: the manifest is recorded and the file is still owed */
  assert.equal(call(cases[1]).ok, true);
  assert.equal(ledger(w, cases[1].id).state, null);
  assert.equal(owed(w, at).some((x) => x.case === cases[1].id), false, "a manifest with no ledger state is built, as before");
  assert.equal(call(cases[1], { built: false }).ok, true, "built:false is as without it");
  assert.equal(ledger(w, cases[1].id).state, null);
  /* a failing ledger with a manifest and no built stays owed */
  assert.equal(rec(w, cases[1].id, "failed", FAIL, at).ok, true);
  assert.equal(owed(w, at + CASEFILE_BACKOFF_MAX_MS * 2).some((x) => x.case === cases[1].id), true, "without built the file is still owed");
  assert.equal(call(cases[1], { built: true }).ok, true, "the same manifest again with built:true builds the file");
  assert.equal(ledger(w, cases[1].id).state, "built");
  assert.equal(owed(w, at + CASEFILE_BACKOFF_MAX_MS * 2).some((x) => x.case === cases[1].id), false);

  /* a malformed built writes nothing */
  for (const bad of ["true", 1, 0, "yes", {}, []]) {
    const m = call(cases[2], { built: bad });
    assert.equal(m.ok, false); assert.equal(m.reason, "MALFORMED");
  }
  assert.equal(w.row(`SELECT manifest_sha FROM published_cases WHERE case_id=?`, cases[2].id).manifest_sha, null, "nothing written");
  assert.equal(ledger(w, cases[2].id).state, null);
  /* refusals keep their reasons and write no ledger */
  assert.equal(w.p.recordCaseManifest({ caseId: "CASE-2026-0404", edition: 1, manifest: { files: [] }, manifestSha: sha("x"), built: true }).reason, "NO_SUCH_CASE_EDITION");
  assert.equal(call(cases[0], { manifestSha: sha("another"), built: true }).reason, "MANIFEST_EXISTS");
});
