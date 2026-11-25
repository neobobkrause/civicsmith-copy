/* bias R33–R41: the bias debt over registered work products, at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, FM, S, source, WHY } from "./world.mjs";
import { viewerPredicate } from "../../../src/membership/index.mjs";

const A = "BIAS-2026-0001-a", P = "PROJ-2026-0001-p", NOW = Date.parse("2026-07-10T00:00:00Z");
const ADMIN = { reason: WHY, author: "admin", identity: "member:admin", viewer: "admin" };

/* A world with an instance lens in force, a project owned by ruth, and the lens's current hash. The project is hidden
   (the world's default), so since D54 (membership R43; K2408) the founder, neither invited nor joined, sees it only at
   EXISTENCE: the lens is read as its owner, and the reads that list every debt use a machine viewer's gate. */
async function debtWorld(env = {}) {
  const w = world({ env });
  await w.group("alice", "ruth", "cora", "gone");
  w.project(P, "ruth");
  w.membership.projectInvite({ projectId: P, handle: "alice", by: "ruth" });
  w.membership.projectJoin({ projectId: P, by: "alice" });
  w.set(A, [S("s1")], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  w.lens = () => w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:ruth" }).statements_sha;
  w.move = (text) => w.promote(A, FM(A, { statements: [S("s1", { text })], current_state: "adopted", prior_state: "proposed" }));
  return w;
}
const run = (lensSha, over = {}) => ({ context: { type: "project", id: P }, principal: "alice",
  lens: { basis: "at_open", statements_sha: lensSha }, ranUnder: lensSha, rerunOf: null, ...over });
const debt = (w, k) => w.row(`SELECT * FROM bias_debts WHERE run=?`, k);

test("R33: registerWorkProducts takes a later module's work products; a malformed or repeated kind is refused", async () => {
  const w = await debtWorld();
  assert.equal(w.bias.registerWorkProducts("ai-run", source({})).ok, true);
  assert.equal(w.bias.registerWorkProducts("ai-run", source({})).reason, "WORK_PRODUCTS_DECLARED");
  assert.equal(w.bias.registerWorkProducts("", source({})).reason, "WORK_PRODUCTS_MALFORMED");
  assert.equal(w.bias.registerWorkProducts("x", { list: () => [] }).reason, "WORK_PRODUCTS_MALFORMED");
});

test("R33: the sweep compares the lens each work product was made under with the lens in force now, read as a machine viewer (D54: a hidden project's lens too): moved raises, changed restates, not moved settles as lens_returned, undetermined raises and clears nothing", async () => {
  const w = await debtWorld();
  const then = w.lens();
  const wps = { "RUN-1": run(then), "RUN-2": run(then, { lens: null }), "RUN-3": run(null, { lens: { basis: "handed", statements_sha: null } }) };
  w.bias.registerWorkProducts("ai-run", source(wps));
  let s = await w.bias.biasDebtSweep(NOW);
  assert.deepEqual([s.read, s.raised, s.unchanged, s.undetermined, s.complete], [3, [], 1, ["RUN-2", "RUN-3"], true]);
  assert.equal(w.count("bias_debts"), 0);
  w.move("The lens moved.");
  const now1 = w.lens();
  s = await w.bias.biasDebtSweep(NOW + 1000);
  assert.deepEqual([s.raised, s.undetermined], [["RUN-1"], ["RUN-2", "RUN-3"]]);
  const d = debt(w, "RUN-1");
  assert.deepEqual([d.context_type, d.context_id, d.moved_basis, d.lens_then, d.lens_now, JSON.parse(d.recipients), d.raised, d.cleared_at],
    ["project", P, "at_open", then, now1, ["alice", "ruth"], "2026-07-10T00:00:01Z", null]);
  /* D54: the founder, not in the hidden project, reads its lens as none in force, and the sweep raised the debt all
     the same: the lens in force is the scope's, not a viewer's (negative control: made discoverable, the founder
     reads the very lens the sweep compared against) */
  assert.equal(w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "admin" }).in_force, false);
  w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", by: "ruth", reason: "open to the team" });
  assert.equal(w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "admin" }).statements_sha, now1);
  w.membership.projectVisibilitySet({ projectId: P, setting: "hidden", by: "ruth", reason: "closed again" });
  assert.equal(w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "admin" }).in_force, false);
  /* moved again: the same debt, restated, keeping its age */
  w.move("The lens moved a second time.");
  s = await w.bias.biasDebtSweep(NOW + 2000);
  assert.deepEqual(s.restated, ["RUN-1"]);
  assert.deepEqual([debt(w, "RUN-1").lens_now, debt(w, "RUN-1").raised, w.count("bias_debts")], [w.lens(), "2026-07-10T00:00:01Z", 1]);
  /* the lens moves back: settled as lens_returned, recorded */
  w.move(S("s1").text);
  assert.equal(w.lens(), then);
  s = await w.bias.biasDebtSweep(NOW + 3000);
  assert.deepEqual(s.cleared, ["RUN-1"]);
  assert.deepEqual([debt(w, "RUN-1").cleared_at, debt(w, "RUN-1").settled_kind], ["2026-07-10T00:00:03Z", "lens_returned"]);
  assert.deepEqual(w.rows(`SELECT kind, actor FROM bias_debt_settlements`), [{ kind: "lens_returned", actor: null }]);
  /* moved once more after settling: NEW debt, aging from now */
  w.move("Moved after the return.");
  s = await w.bias.biasDebtSweep(NOW + 4000);
  assert.deepEqual([s.restated, debt(w, "RUN-1").raised, debt(w, "RUN-1").cleared_at], [["RUN-1"], "2026-07-10T00:00:04Z", null]);
  /* a pin that cannot be read: undetermined, and the open debt is neither cleared nor restated */
  w.sql.exec(`UPDATE bias_adoptions SET bundle_sha='0000'`);
  s = await w.bias.biasDebtSweep(NOW + 5000);
  assert.deepEqual([s.undetermined.includes("RUN-1"), debt(w, "RUN-1").cleared_at], [true, null]);
});

test("R33: a debt settled by a member's act or a re-run stays settled while its lenses are unchanged; batches of 50 by default resume from a cursor", async () => {
  const w = await debtWorld({ BIAS_DEBT_BATCH: "2" });
  const then = w.lens();
  const wps = Object.fromEntries(["RUN-1", "RUN-2", "RUN-3", "RUN-4", "RUN-5"].map((k) => [k, run(then)]));
  w.bias.registerWorkProducts("ai-run", source(wps));
  w.move("The lens moved.");
  const s1 = await w.bias.biasDebtSweep(NOW);
  assert.deepEqual([s1.raised, s1.complete, s1.batch], [["RUN-1", "RUN-2"], false, 2]);
  assert.notEqual(w.bias.biasDebtDue(NOW), null, "a sweep that spans ticks keeps the consumer due");
  const s2 = await w.bias.biasDebtSweep(NOW + 1);
  const s3 = await w.bias.biasDebtSweep(NOW + 2);
  assert.deepEqual([s2.raised, s3.raised, s3.complete], [["RUN-3", "RUN-4"], ["RUN-5"], true]);
  assert.equal(w.bias.biasDebtDue(NOW + 3), null);
  /* resolved by a member: the next sweep over the same delta holds it settled */
  assert.equal(w.bias.biasDebtResolve({ run: "RUN-1", reason: "The change does not bear on this finding.", actor: "alice", viewer: "member:alice" }).ok, true);
  w.sql.exec(`UPDATE bias_debt_sweeps SET fingerprint='stale'`);
  const s4 = await w.bias.biasDebtSweep(NOW + 4);
  assert.deepEqual([s4.held, debt(w, "RUN-1").settled_kind], [["RUN-1"], "resolved"]);
  const d = world({ env: {} });
  await d.group();
  d.bias.registerWorkProducts("x", source(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`K-${String(i).padStart(3, "0")}`, run(null, { lens: null })]))));
  d.set(A, [S("s1")], "adopted");
  d.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  const s5 = await d.bias.biasDebtSweep(NOW);
  assert.deepEqual([s5.read, s5.batch, s5.complete], [50, 50, false]);
});

test("R34: recipients are the member principal and the owners of a project context, each active and able to read the work product", async () => {
  const w = await debtWorld();
  w.membership.projectInvite({ projectId: P, handle: "cora", by: "ruth" });
  w.membership.projectJoin({ projectId: P, by: "cora" });
  /* cora made an owner beside ruth; the owner act is project-roster's (its R3), so the setup writes the flag itself (membership R118) */
  assert.equal(w.membership.participationWrite("ownerOn", { projectId: P, memberId: "cora", by: "ruth" }), true);
  w.membership.memberSet({ memberId: "gone", status: "revoked", by: "admin" });
  const then = w.lens();
  w.bias.registerWorkProducts("ai-run", source({
    "RUN-1": run(then, { readers: ["member:alice", "member:ruth"] }),                       // cora owns and cannot read it
    "RUN-2": run(then, { principal: "gone" }),                                             // revoked principal
    "RUN-3": run(then, { principal: null, context: { type: "inquiry", id: "INQ-2026-0001-q" } }),
  }));
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  assert.deepEqual(JSON.parse(debt(w, "RUN-1").recipients), ["alice", "ruth"]);
  assert.deepEqual(JSON.parse(debt(w, "RUN-2").recipients), ["cora", "ruth"]);
  /* work over an inquiry reads the instance's lens, which moved; it names no member and no owners, and says so */
  assert.deepEqual([debt(w, "RUN-3").context_type, JSON.parse(debt(w, "RUN-3").recipients)], ["inquiry", []]);
});

test("R35: biasDebtResolve refuses in order — no run, no actor, a machine, no reason, a reason over 4,000, no open or visible debt, already settled — and appends a resolved settlement", async () => {
  const w = await debtWorld();
  const then = w.lens();
  w.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(then) }));
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  const r = (a) => w.bias.biasDebtResolve({ viewer: "member:alice", ...a });
  const code = (a) => { const x = r(a); return x.ok ? "ok" : `${x.reason} ${x.check}`; };
  assert.equal(code({ reason: "x", actor: "alice" }), "BIAS_DEBT_NO_RUN C-26.13");
  assert.equal(code({ run: "RUN-1", reason: "x" }), "BIAS_DEBT_NO_ACTOR C-26.14");
  assert.equal(code({ run: "RUN-1", reason: "x", actor: "token:ai" }), "BIAS_DEBT_MACHINE_CANNOT_RESOLVE C-26.15");
  assert.equal(code({ run: "RUN-1", reason: "x", actor: "class:daemon" }), "BIAS_DEBT_MACHINE_CANNOT_RESOLVE C-26.15");
  assert.equal(code({ run: "RUN-1", reason: "  ", actor: "alice" }), "BIAS_DEBT_NO_REASON C-26.16");
  const long = r({ run: "RUN-1", reason: "y".repeat(4001), actor: "alice" });
  assert.deepEqual([long.reason, long.check, long.limit, long.length], ["BIAS_DEBT_REASON_TOO_LONG", "C-26.17", 4000, 4001]);
  assert.equal(code({ run: "RUN-9", reason: "x", actor: "alice" }), "BIAS_DEBT_NO_SUCH_DEBT C-26.18");
  const unseen = w.bias.biasDebtResolve({ run: "RUN-1", reason: "x", actor: "cora", viewer: "member:cora" });
  const absent = w.bias.biasDebtResolve({ run: "RUN-9", reason: "x", actor: "cora", viewer: "member:cora" });
  assert.deepEqual([unseen.reason, { ...unseen, run: 0 }], [absent.reason, { ...absent, run: 0 }], "an invisible debt answers as an absent one");
  assert.equal(w.count("bias_debt_settlements"), 0, "no refusal wrote");
  const ok = r({ run: "RUN-1", reason: "  The change does not bear on it.  ", actor: "alice", at: "2026-07-11T00:00:00Z" });
  assert.deepEqual(ok, { ok: true, run: "RUN-1", settled: { run: "RUN-1", kind: "resolved", at: "2026-07-11T00:00:00Z", actor: "alice",
    reason: "The change does not bear on it.", by_run: null, lens_then: then, lens_now: w.lens() } });
  const again = r({ run: "RUN-1", reason: "x", actor: "alice" });
  assert.deepEqual([again.reason, again.check, again.settled.kind], ["BIAS_DEBT_ALREADY_SETTLED", "C-26.19", "resolved"]);
  assert.match(w.ops("viewer=member:alice", { run: "RUN-1", reason: "x", actor: "alice" }).biasdebtresolve().reason, /ALREADY_SETTLED/);
});

test("R36: biasDebt answers a visible debt with its settled state and settlements (at most 50); an invisible one answers as absent; an unattributed settlement reads undetermined", async () => {
  const w = await debtWorld();
  const then = w.lens();
  w.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(then) }));
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  const open = w.bias.biasDebt({ run: "RUN-1", viewer: "member:alice" });
  assert.deepEqual([open.found, open.open, open.context, open.settled, open.settlements, open.limit, open.truncated],
    [true, true, { type: "project", id: P }, { settled: false }, [], 50, false]);
  const absent = w.bias.biasDebt({ run: "RUN-9", viewer: "member:alice" });
  const unseen = w.bias.biasDebt({ run: "RUN-1", viewer: "member:cora" });
  assert.deepEqual({ ...unseen, run: 0 }, { ...absent, run: 0 });
  assert.equal(unseen.found, false);
  w.sql.exec(`UPDATE bias_debts SET cleared_at='2026-01-01T00:00:00Z', settled_kind=NULL WHERE run='RUN-1'`);
  assert.deepEqual(w.bias.biasDebt({ run: "RUN-1", viewer: "member:alice" }).settled.kind_state, "undetermined");
  /* D54: the founder, not in the hidden project, is answered as if no debt were held; a machine viewer sees it */
  assert.deepEqual({ ...w.bias.biasDebt({ run: "RUN-1", viewer: "admin" }), run: 0 }, { ...absent, run: 0 });
  assert.equal(w.bias.biasDebt({ run: "RUN-1", viewer: "class:daemon" }).found, true);
  for (let i = 0; i < 55; i++) w.sql.exec(`INSERT INTO bias_debt_settlements (run, kind, at) VALUES ('RUN-1','resolved',?)`, `t${i}`);
  const many = w.bias.biasDebt({ run: "RUN-1", viewer: "member:alice", limit: 500 });
  assert.deepEqual([many.settlements.length, many.limit, many.truncated, many.settlements[0].at], [50, 50, true, "t0"]);
  assert.equal(w.ops("run=RUN-1&viewer=member:alice&limit=3").biasdebt().settlements.length, 3);
});

test("R37: every settlement is appended, never rewritten; a debt is disclosed and blocks nothing", async () => {
  const w = await debtWorld();
  const then = w.lens();
  w.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(then) }));
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  w.move(S("s1").text);
  await w.bias.biasDebtSweep(NOW + 1);
  const first = w.rows(`SELECT * FROM bias_debt_settlements`);
  w.move("Moved again.");
  await w.bias.biasDebtSweep(NOW + 2);
  w.bias.biasDebtResolve({ run: "RUN-1", reason: "Not bearing.", actor: "alice", viewer: "member:alice" });
  const all = w.rows(`SELECT * FROM bias_debt_settlements ORDER BY seq`);
  assert.deepEqual(all.slice(0, 1), first, "the earlier row is untouched");
  assert.deepEqual(all.map((x) => x.kind), ["lens_returned", "resolved"]);
  /* blocks nothing: a promotion of anything, and an adoption, still go through with a debt open */
  w.move("And again, with a debt open.");
  await w.bias.biasDebtSweep(NOW + 3);
  assert.equal(debt(w, "RUN-1").cleared_at, null);
  assert.equal(w.move("Promotions are not refused because a debt is open.").ok, true);
});

test("R38: told of a close that re-made another, the debt is discharged only when the lens it ran under equals the lens now in force; otherwise no_open_debt, lens_undetermined or other_lens, and nothing is settled", async () => {
  const w = await debtWorld();
  const then = w.lens();
  const wps = { "RUN-1": run(then) };
  w.bias.registerWorkProducts("ai-run", source(wps));
  assert.equal(await w.bias.biasDebtRerun({ kind: "ai-run", key: "RUN-1", at: "t" }), null, "no link to follow");
  wps["RUN-2"] = run(then, { rerunOf: "RUN-1" });
  assert.equal((await w.bias.biasDebtRerun({ kind: "ai-run", key: "RUN-2" })).outcome, "no_open_debt");
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  const now = w.lens();
  assert.deepEqual(await w.bias.biasDebtRerun({ kind: "ai-run", key: "RUN-2" }), { re_ran: "RUN-1", discharged: false,
    outcome: "other_lens", lens_ran_under: then, lens_in_force: now,
    stated: "this work was made under a lens other than the one now in force, so it discharges nothing (BOB #32: a re-run under any other lens discharges nothing)" });
  wps["RUN-3"] = run(now, { rerunOf: "RUN-1", ranUnder: null });
  assert.equal((await w.bias.biasDebtRerun({ kind: "ai-run", key: "RUN-3" })).outcome, "lens_undetermined");
  assert.equal(w.count("bias_debt_settlements"), 0);
  wps["RUN-4"] = run(now, { rerunOf: "RUN-1" });
  const ok = await w.bias.biasDebtRerun({ kind: "ai-run", key: "RUN-4", at: "2026-07-12T00:00:00Z" });
  assert.deepEqual([ok.discharged, ok.settled.kind, ok.settled.by_run, ok.settled.lens_now, ok.settled.at],
    [true, "rerun", "RUN-4", now, "2026-07-12T00:00:00Z"]);
  assert.equal(debt(w, "RUN-1").settled_kind, "rerun");
  /* the re-run's settlement holds on the next sweep over the same delta */
  w.sql.exec(`UPDATE bias_debt_sweeps SET fingerprint='stale'`);
  assert.deepEqual((await w.bias.biasDebtSweep(NOW + 1)).held, ["RUN-1"]);
  /* no lens in force now: undetermined */
  w.sql.exec(`DELETE FROM bias_adoptions`);
  wps["RUN-5"] = run(now, { rerunOf: "RUN-1" });
  w.sql.exec(`UPDATE bias_debts SET cleared_at=NULL, settled_kind=NULL`);
  assert.equal((await w.bias.biasDebtRerun({ kind: "ai-run", key: "RUN-5" })).outcome, "lens_undetermined");
});

test("R39: a sweep is idempotent by the work product's key — a second sweep over unchanged lenses raises, restates and settles nothing", async () => {
  const w = await debtWorld();
  const then = w.lens();
  w.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(then), "RUN-2": run(then) }));
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  const before = w.rows(`SELECT * FROM bias_debts ORDER BY run`).concat(w.rows(`SELECT * FROM bias_debt_settlements`));
  const s = await w.bias.biasDebtSweep(NOW + 1000);
  assert.deepEqual([s.raised, s.restated, s.cleared, s.held, s.unchanged], [[], [], [], [], 2]);
  assert.deepEqual(w.rows(`SELECT * FROM bias_debts ORDER BY run`).concat(w.rows(`SELECT * FROM bias_debt_settlements`)), before);
});

test("R40: a question's findings made under a project lens are work products too, registered by a second kind, and carry a debt when that lens changes", async () => {
  const w = await debtWorld();
  const B = "BIAS-2026-0002-proj";
  w.set(B, [S("p1")], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: B, scope: "project", scopeId: P, author: "ruth", identity: "member:ruth", viewer: "member:ruth" });
  const then = w.lens();
  w.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(then) }));
  assert.equal(w.bias.registerWorkProducts("finding", source({ "FIND-1": run(then, { principal: "ruth" }) })).ok, true);
  w.promote(B, FM(B, { statements: [S("p1", { text: "The project's lens changed." })], current_state: "adopted", prior_state: "proposed" }));
  const s = await w.bias.biasDebtSweep(NOW);
  assert.deepEqual(s.raised, ["RUN-1", "FIND-1"]);
  assert.deepEqual(JSON.parse(debt(w, "FIND-1").recipients), ["ruth"]);
  assert.equal(w.bias.biasDebtResolve({ run: "FIND-1", reason: "Not bearing.", actor: "ruth", viewer: "member:ruth" }).ok, true);
});

test("R41: biasDebtDue answers now and biasDebtWake now + the delay while pending, else null; synchronous, writing nothing, never throwing", async () => {
  const w = await debtWorld();
  assert.deepEqual([w.bias.biasDebtDue(NOW), w.bias.biasDebtWake(NOW)], [null, null], "no work product registered");
  const wps = {};
  w.bias.registerWorkProducts("ai-run", source(wps));
  assert.equal(w.bias.biasDebtDue(NOW), null, "registered, but none held");
  wps["RUN-1"] = run(w.lens());
  assert.deepEqual([w.bias.biasDebtDue(NOW), w.bias.biasDebtWake(NOW)], [NOW, NOW + 1000], "no sweep yet complete, an adoption held");
  const before = w.dump();
  w.bias.biasDebtDue(NOW); w.bias.biasDebtWake(NOW);
  assert.equal(w.dump(), before, "writes nothing");
  await w.bias.biasDebtSweep(NOW);
  assert.deepEqual([w.bias.biasDebtDue(NOW), w.bias.biasDebtWake(NOW)], [null, null], "the last complete sweep read these inputs");
  w.move("Moved.");
  assert.deepEqual([w.bias.biasDebtDue(NOW + 5), w.bias.biasDebtWake(NOW + 5)], [NOW + 5, NOW + 1005]);
  /* no adoption and no sweep: not pending */
  const v = world();
  v.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(null) }));
  assert.equal(v.bias.biasDebtDue(NOW), null);
  /* the delay binding: a number >= 0, else the default */
  for (const [binding, delay] of [["0", 0], ["250", 250], [" ", 1000], ["-5", 1000], ["soon", 1000], [null, 1000]]) {
    const x = await debtWorld({ BIAS_DEBT_DELAY_MS: binding });
    x.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(null) }));
    assert.equal(x.bias.biasDebtWake(NOW), NOW + delay, String(binding));
  }
  /* never throws: a source that throws, or storage that fails */
  const t = await debtWorld();
  t.bias.registerWorkProducts("ai-run", { list: () => { throw new Error("down"); }, read: async () => null, visible: async () => false });
  assert.deepEqual([t.bias.biasDebtDue(NOW), t.bias.biasDebtWake(NOW)], [null, null]);
});

test("R33: given the scheduler's rank, each batch is compared in the rank's order, offered as {kind: bundle, id: context id, waitingSince}; cursor, batch and outcomes unchanged; without rank, or a rank that fails, the cursor's order", async () => {
  const w = await debtWorld({ BIAS_DEBT_BATCH: "3" });
  const then = w.lens();
  const wps = { "RUN-1": run(then, { registered: "2026-07-01T00:00:00Z" }), "RUN-2": run(then, { registered: 1000 }),
                "RUN-3": run(then), "RUN-4": run(then) };
  w.bias.registerWorkProducts("ai-run", source(wps));
  w.move("Moved.");
  const offered = [];
  const reverse = (items, now) => { offered.push({ items: items.map((x) => JSON.parse(JSON.stringify(x))), now, keys: items.map((x) => Object.keys(x)) }); return [...items].reverse(); };
  const s1 = await w.bias.biasDebtSweep(NOW, reverse);
  assert.deepEqual(offered[0].keys, [["kind", "id", "waitingSince"], ["kind", "id", "waitingSince"], ["kind", "id", "waitingSince"]]);
  delete offered[0].keys;
  assert.deepEqual(offered, [{ now: NOW, items: [
    { kind: "bundle", id: P, waitingSince: Date.parse("2026-07-01T00:00:00Z") },
    { kind: "bundle", id: P, waitingSince: 1000 }, { kind: "bundle", id: P, waitingSince: null }] }]);
  assert.deepEqual([s1.raised, s1.complete, s1.batch], [["RUN-3", "RUN-2", "RUN-1"], false, 3], "the rank's order; the cursor's batch");
  const s2 = await w.bias.biasDebtSweep(NOW + 1, reverse);
  assert.deepEqual([s2.raised, s2.complete], [["RUN-4"], true], "the cursor resumes after the batch, whatever the order");
  /* the same outcomes as an unranked sweep over the same world */
  const u = await debtWorld({ BIAS_DEBT_BATCH: "3" });
  u.bias.registerWorkProducts("ai-run", source(Object.fromEntries(Object.keys(wps).map((k) => [k, run(u.lens())]))));
  u.move("Moved.");
  const plain = await u.bias.biasDebtSweep(NOW);
  assert.deepEqual(plain.raised, ["RUN-1", "RUN-2", "RUN-3"], "no rank: the cursor's order");
  const cols = "run, context_type, context_id, moved_basis, lens_now, recipients, raised, cleared_at";
  await u.bias.biasDebtSweep(NOW + 1);
  assert.deepEqual(u.rows(`SELECT ${cols} FROM bias_debts ORDER BY run`).map((r) => ({ ...r, lens_now: 0 })),
    w.rows(`SELECT ${cols} FROM bias_debts ORDER BY run`).map((r) => ({ ...r, lens_now: 0 })));
  /* a rank that throws, answers nothing usable, or drops items: the cursor's order, every item still compared */
  for (const bad of [() => { throw new Error("down"); }, () => null, (items) => [items[2]], (items) => [{ kind: "bundle" }, ...items]]) {
    const x = await debtWorld();
    const t = x.lens();
    x.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(t), "RUN-2": run(t), "RUN-3": run(t) }));
    x.move("Moved.");
    const s = await x.bias.biasDebtSweep(NOW, bad);
    assert.equal(s.read, 3);
    assert.deepEqual([...s.raised].sort(), ["RUN-1", "RUN-2", "RUN-3"]);
  }
  const dropped = await debtWorld();
  const t = dropped.lens();
  dropped.bias.registerWorkProducts("ai-run", source({ "RUN-1": run(t), "RUN-2": run(t), "RUN-3": run(t) }));
  dropped.move("Moved.");
  assert.deepEqual((await dropped.bias.biasDebtSweep(NOW, (items) => [items[2]])).raised, ["RUN-3", "RUN-1", "RUN-2"]);
});

test("R42: counts answers the bias statements and adoptions held; hid leaves out rows naming a hidden bundle (a statement by its bundle, an adoption by its bundle or project); synchronous, writing nothing, never throwing", async () => {
  const w = await debtWorld();
  const B = "BIAS-2026-0002-proj";
  w.set(B, [S("p1"), S("p2")], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: B, scope: "project", scopeId: P, author: "ruth", identity: "member:ruth", viewer: "member:ruth" });
  const before = w.dump();
  assert.deepEqual(w.bias.counts(), { biasStatements: 3, biasAdoptions: 2 });
  const hid = (...ids) => ({ sql: `(${ids.map(() => "?").join(",")})`, args: ids });
  assert.deepEqual(w.bias.counts(hid(B)), { biasStatements: 1, biasAdoptions: 1 });
  assert.deepEqual(w.bias.counts(hid(P)), { biasStatements: 3, biasAdoptions: 1 }, "an adoption naming a hidden project");
  assert.deepEqual(w.bias.counts(hid(A)), { biasStatements: 2, biasAdoptions: 1 });
  assert.deepEqual(w.bias.counts({ sql: "(SELECT bundle_id FROM bundles WHERE object_type='project')", args: [] }),
    { biasStatements: 3, biasAdoptions: 1 });
  assert.equal(w.dump(), before, "writes nothing");
  assert.deepEqual(w.bias.counts({ sql: "(((", args: [] }), { biasStatements: null, biasAdoptions: null }, "never throws");
});

test("R43: uncleared answers the open debts the gate admits, newest raised first then by run, with their fields and recipients, at most limit (1–1,000, default 200), truncated by one more; writes nothing, never throws", async () => {
  const w = await debtWorld({ BIAS_DEBT_BATCH: "500" });
  const then = w.lens();
  const wps = { "RUN-1": run(then), "RUN-2": run(then), "RUN-3": run(then, { context: { type: "inquiry", id: "INQ-2026-0001-q" }, principal: null }) };
  w.bias.registerWorkProducts("ai-run", source(wps));
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  const now = w.lens();
  w.sql.exec(`UPDATE bias_debts SET raised='2026-07-11T00:00:00Z' WHERE run='RUN-2'`);
  /* every debt: a machine viewer's gate (since D54 the founder's no longer admits a hidden project it is not in) */
  const admin = viewerPredicate("class:daemon");
  const all = w.bias.uncleared({ gate: admin });
  assert.deepEqual([all.limit, all.truncated, all.debts.map((d) => d.run)], [200, false, ["RUN-2", "RUN-1", "RUN-3"]]);
  assert.deepEqual(all.debts[1], { run: "RUN-1", context_type: "project", context_id: P, moved_basis: "at_open", lens_then: then,
    lens_now: now, observed: "2026-07-10T00:00:00Z", raised: "2026-07-10T00:00:00Z", recipients: ["alice", "ruth"] });
  assert.deepEqual(all.debts[2].recipients, [], "a debt naming nobody carries an empty list");
  /* the gate: a member outside the project sees the inquiry's debt only (its context is not a held bundle, so it is not
     admitted either); a participant sees the project's; a denied viewer and a malformed gate see none */
  assert.deepEqual(w.bias.uncleared({ gate: viewerPredicate("member:cora") }).debts.map((d) => d.run), []);
  assert.deepEqual(w.bias.uncleared({ gate: viewerPredicate("member:alice") }).debts.map((d) => d.run), ["RUN-2", "RUN-1"]);
  assert.deepEqual(w.bias.uncleared({ gate: viewerPredicate("nobody") }).debts, []);
  /* D54: the founder's gate and an administrator's admit none of the hidden project's debts (nor the inquiry's, no held
     bundle); made discoverable, both admit the project's (negative control) */
  for (const v of ["admin", "member:second"]) assert.deepEqual(w.bias.uncleared({ gate: viewerPredicate(v) }).debts, [], v);
  w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", by: "ruth", reason: "open to the team" });
  for (const v of ["admin", "member:second"])
    assert.deepEqual(w.bias.uncleared({ gate: viewerPredicate(v) }).debts.map((d) => d.run), ["RUN-2", "RUN-1"], v);
  w.membership.projectVisibilitySet({ projectId: P, setting: "hidden", by: "ruth", reason: "closed again" });
  for (const gate of [null, {}, { sql: 1, args: [] }, "admin"]) assert.deepEqual(w.bias.uncleared({ gate }).debts, [], String(gate));
  /* cleared debts are not listed */
  w.bias.biasDebtResolve({ run: "RUN-2", reason: "Not bearing.", actor: "alice", viewer: "member:alice" });
  assert.deepEqual(w.bias.uncleared({ gate: admin }).debts.map((d) => d.run), ["RUN-1", "RUN-3"]);
  /* the bound */
  assert.deepEqual([w.bias.uncleared({ gate: admin, limit: 1 }).debts.length, w.bias.uncleared({ gate: admin, limit: 1 }).truncated], [1, true]);
  for (let i = 0; i < 1005; i++)
    w.sql.exec(`INSERT INTO bias_debts (run, context_type, context_id, recipients, raised, observed) VALUES (?,'project',?,'[]','t','t')`,
      `X-${String(i).padStart(4, "0")}`, P);
  const big = w.bias.uncleared({ gate: admin, limit: 5000 });
  assert.deepEqual([big.limit, big.debts.length, big.truncated], [1000, 1000, true]);
  assert.deepEqual([w.bias.uncleared({ gate: admin }).debts.length, w.bias.uncleared({ gate: admin, limit: 0 }).limit], [200, 200]);
  const before = w.dump();
  w.bias.uncleared({ gate: admin });
  assert.equal(w.dump(), before, "writes nothing");
  w.sql.exec(`DROP TABLE bias_debt_settlements`);
  w.sql.exec(`ALTER TABLE bias_debts RENAME TO gone`);
  const failed = w.bias.uncleared({ gate: admin });
  assert.deepEqual([failed.debts, failed.undetermined], [[], true], "never throws");
});

test("R44: settled answers the debts settled at or after since that the gate admits, newest settled first then by run, each with its kind, when, and the settling settlement's actor and reason; a since that is no instant answers none and says so", async () => {
  const w = await debtWorld({ BIAS_DEBT_BATCH: "500" });
  const then = w.lens();
  const wps = { "RUN-1": run(then), "RUN-2": run(then), "RUN-3": run(then),
                "RUN-4": run(then, { context: { type: "inquiry", id: "INQ-2026-0001-q" }, principal: null }) };
  w.bias.registerWorkProducts("ai-run", source(wps));
  w.move("Moved.");
  await w.bias.biasDebtSweep(NOW);
  const now = w.lens();
  /* three acts settle: a member's resolve, a re-run under the lens in force, the lens moving back */
  assert.equal(w.bias.biasDebtResolve({ run: "RUN-1", reason: "The change does not bear on this finding.", actor: "alice",
                                        viewer: "member:alice", at: "2026-07-11T00:00:00Z" }).ok, true);
  wps["RUN-5"] = run(now, { rerunOf: "RUN-2", lens: null });
  assert.equal((await w.bias.biasDebtRerun({ kind: "ai-run", key: "RUN-5", at: "2026-07-12T00:00:00.700Z" })).discharged, true);
  w.move(S("s1").text);
  const back = await w.bias.biasDebtSweep(NOW + 5000);
  assert.deepEqual(back.cleared, ["RUN-3", "RUN-4"]);
  const admin = viewerPredicate("class:daemon");   // every debt (D54: not the founder's gate)
  const before = w.dump();
  const all = w.bias.settled({ gate: admin, since: "2026-07-01T00:00:00Z" });
  assert.deepEqual(all, { limit: 200, truncated: false, since: "2026-07-01T00:00:00Z", debts: [
    { run: "RUN-2", context_type: "project", context_id: P, settled_kind: "rerun", settled_at: "2026-07-12T00:00:00Z", actor: null, reason: null },
    { run: "RUN-1", context_type: "project", context_id: P, settled_kind: "resolved", settled_at: "2026-07-11T00:00:00Z", actor: "alice",
      reason: "The change does not bear on this finding." },
    { run: "RUN-3", context_type: "project", context_id: P, settled_kind: "lens_returned", settled_at: "2026-07-10T00:00:05Z", actor: null, reason: null },
    { run: "RUN-4", context_type: "inquiry", context_id: "INQ-2026-0001-q", settled_kind: "lens_returned", settled_at: "2026-07-10T00:00:05Z",
      actor: null, reason: null }] }, "newest settled first, ties by run; a lens_returned or rerun settlement has no actor and no reason");
  assert.equal(w.dump(), before, "writes nothing");
  /* since excludes an earlier settlement, compared as an instant: at or after, in either spelling or as ms */
  const runs = (a) => w.bias.settled({ gate: admin, ...a }).debts.map((d) => d.run);
  assert.deepEqual(runs({ since: "2026-07-11T00:00:00Z" }), ["RUN-2", "RUN-1"], "at since is included");
  assert.deepEqual(runs({ since: "2026-07-11T00:00:00.001Z" }), ["RUN-2"]);
  assert.deepEqual(runs({ since: "2026-07-10T00:00:05.500Z" }), ["RUN-2", "RUN-1"], "a settlement in the second before since is earlier");
  assert.deepEqual(runs({ since: Date.parse("2026-07-10T00:00:05Z") }), ["RUN-2", "RUN-1", "RUN-3", "RUN-4"]);
  assert.deepEqual(runs({ since: "2026-07-13T00:00:00Z" }), []);
  /* the gate hides a debt on an unseen context: cora is outside the project, and the inquiry's context is no held bundle */
  assert.deepEqual(runs({ gate: viewerPredicate("member:alice"), since: "2026-07-01T00:00:00Z" }), ["RUN-2", "RUN-1", "RUN-3"]);
  assert.deepEqual(runs({ gate: viewerPredicate("member:cora"), since: "2026-07-01T00:00:00Z" }), []);
  assert.deepEqual(runs({ gate: viewerPredicate("nobody"), since: "2026-07-01T00:00:00Z" }), []);
  /* D54: the founder's gate admits none of the hidden project's settled debts; made discoverable, it admits them */
  assert.deepEqual(runs({ gate: viewerPredicate("admin"), since: "2026-07-01T00:00:00Z" }), []);
  w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", by: "ruth", reason: "open to the team" });
  assert.deepEqual(runs({ gate: viewerPredicate("admin"), since: "2026-07-01T00:00:00Z" }), ["RUN-2", "RUN-1", "RUN-3"]);
  w.membership.projectVisibilitySet({ projectId: P, setting: "hidden", by: "ruth", reason: "closed again" });
  for (const gate of [null, {}, { sql: 1, args: [] }, "admin"]) assert.deepEqual(runs({ gate, since: "2026-07-01T00:00:00Z" }), [], String(gate));
  /* a since that is not an instant answers none, and says so */
  for (const since of [null, undefined, "", "  ", "soon", NaN, Infinity, {}, ["2026-07-01T00:00:00Z"]]) {
    const x = w.bias.settled({ gate: admin, since });
    assert.deepEqual([x.debts, x.truncated, x.since, x.limit], [[], false, null, 200], String(since));
    assert.match(x.stated, /not an instant/);
    assert.equal("undetermined" in x, false, "a since that is no instant is not a failed read");
  }
  /* a debt settled before the kind was kept: null kind, and no actor or reason attributed to it */
  w.sql.exec(`UPDATE bias_debts SET settled_kind = NULL WHERE run = 'RUN-1'`);
  assert.deepEqual(w.bias.settled({ gate: admin, since: "2026-07-11T00:00:00Z" }).debts[1],
    { run: "RUN-1", context_type: "project", context_id: P, settled_kind: null, settled_at: "2026-07-11T00:00:00Z", actor: null, reason: null });
  w.sql.exec(`UPDATE bias_debts SET settled_kind = 'resolved' WHERE run = 'RUN-1'`);
  /* re-raised, a debt is open and not listed; settled again, the latest settlement is the one read */
  w.move("Moved once more.");
  await w.bias.biasDebtSweep(NOW + 6000);
  assert.deepEqual(runs({ since: "2026-07-01T00:00:00Z" }), []);
  w.bias.biasDebtResolve({ run: "RUN-1", reason: "A second, later judgement.", actor: "ruth", viewer: "member:ruth", at: "2026-07-14T00:00:00Z" });
  assert.deepEqual(w.bias.settled({ gate: admin, since: "2026-07-01T00:00:00Z" }).debts.map((d) => [d.run, d.actor, d.reason, d.settled_at]),
    [["RUN-1", "ruth", "A second, later judgement.", "2026-07-14T00:00:00Z"]]);
  /* never throws: a read that fails answers none, undetermined */
  w.sql.exec(`ALTER TABLE bias_debts RENAME TO gone`);
  const failed = w.bias.settled({ gate: admin, since: "2026-07-01T00:00:00Z" });
  assert.deepEqual([failed.debts, failed.truncated, failed.undetermined], [[], false, true]);
  assert.match(failed.stated, /could not be read/);
});

test("R44: at most limit (1–1,000, default 200), truncated measured by reading one more — 201 settlements give truncated", async () => {
  const w = await debtWorld({ BIAS_DEBT_BATCH: "500" });
  const then = w.lens();
  const keys = Array.from({ length: 201 }, (_, i) => `RUN-${String(i).padStart(3, "0")}`);
  w.bias.registerWorkProducts("ai-run", source(Object.fromEntries(keys.map((k) => [k, run(then)]))));
  w.move("Moved.");
  assert.equal((await w.bias.biasDebtSweep(NOW)).raised.length, 201);
  w.move(S("s1").text);
  assert.equal((await w.bias.biasDebtSweep(NOW + 1000)).cleared.length, 201);
  const admin = viewerPredicate("class:daemon");   // every debt (D54: not the founder's gate)
  const since = "2026-07-10T00:00:00Z";
  const d = w.bias.settled({ gate: admin, since });
  assert.deepEqual([d.limit, d.debts.length, d.truncated], [200, 200, true]);
  assert.deepEqual(d.debts.map((x) => x.run), keys.slice(0, 200), "one instant: ties broken by run");
  assert.ok(d.debts.every((x) => x.settled_kind === "lens_returned" && x.actor === null && x.reason === null));
  assert.deepEqual([w.bias.settled({ gate: admin, since, limit: 201 }).truncated, w.bias.settled({ gate: admin, since, limit: 201 }).debts.length], [false, 201]);
  assert.deepEqual([w.bias.settled({ gate: admin, since, limit: 1 }).debts.length, w.bias.settled({ gate: admin, since, limit: 1 }).truncated], [1, true]);
  for (const [limit, cap] of [[5000, 1000], [0, 200], [-3, 200], ["x", 200], [null, 200], ["7", 7], [2.9, 2]])
    assert.equal(w.bias.settled({ gate: admin, since, limit }).limit, cap, String(limit));
});
