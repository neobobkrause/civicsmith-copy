/* bias R11–R18 (R11, R12 with DEC-88's reason, C-26.21), R22, R24–R28, R30: the adoption, the manifest, the lens's fingerprint and the tables, at the interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, FM, S, T0, WHY } from "./world.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { BIAS_MANIFEST_LIMIT_MAX, BIAS_MANIFEST_LIMIT_DEFAULT, INSTANCE_ADOPTION_ACT,
         INSTANCE_ADOPTION_REMEDY, BIAS_ADOPTION_REASON_MAX, BIAS_CHECKS } from "../../../src/bias/index.mjs";
import { notAnAdmin, MEMBERSHIP_CHECKS } from "../../../src/membership/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = "BIAS-2026-0001-a", B = "BIAS-2026-0002-b", P = "PROJ-2026-0001-p";
const ADMIN = { reason: WHY, author: "admin", identity: "member:admin", viewer: "admin" };
const at = (w) => w.row(`SELECT * FROM bias_adoptions`);

async function adoptWorld(state = "adopted", fm = {}) {
  const w = world();
  await w.group("mo", "owner", "joiner");
  w.project(P, "owner");
  w.membership.projectInvite({ projectId: P, handle: "joiner", by: "owner" });
  w.membership.projectJoin({ projectId: P, by: "joiner" });
  w.set(A, [S("s1")], state, fm);
  return w;
}

test("R11: refusals in order — not authored (C-26.9), not proposed (C-26.10), a project's existence refusal then owner authority, an instance scope's administrator authority (NOT_AN_ADMIN through membership R84, with its remedy); each asked before the reason (C-26.21), so none here sends one", async () => {
  const w = await adoptWorld("proposed");
  w.set(B, [S("t1")], "draft");
  const code = (a) => { const r = w.bias.biasAdopt(a); return r.ok ? "ok" : r.reason; };
  const before = w.dump();
  /* C-26.9: no author, or a machine identity — asked before anything else */
  assert.equal(code({ bundleId: A }), "BIAS_ADOPTION_NOT_AUTHORED");
  assert.equal(code({ bundleId: A, author: "  " }), "BIAS_ADOPTION_NOT_AUTHORED");
  assert.equal(code({ bundleId: A, author: "token:admin", identity: "member:admin" }), "BIAS_ADOPTION_NOT_AUTHORED");
  assert.equal(code({ bundleId: null, author: "token:ai" }), "BIAS_ADOPTION_NOT_AUTHORED");
  assert.equal(code({ bundleId: A, author: "token:ai", identity: "member:mo", viewer: "member:mo" }), "BIAS_ADOPTION_NOT_AUTHORED",
    "not authored is asked before administrator authority");
  const r9 = w.bias.biasAdopt({ reason: WHY, bundleId: A });
  assert.deepEqual([r9.check, typeof r9.translation], ["C-26.9", "string"]);
  /* C-26.10: no bundle id; not a bias set; neither proposed nor adopted; a project scope with no project id — each
     asked before administrator authority, so a non-administrator meets it too */
  assert.equal(code({ ...ADMIN }), "BIAS_ADOPTION_NOT_PROPOSED");
  assert.equal(code({ ...ADMIN, bundleId: "BIAS-2026-0404-none" }), "BIAS_ADOPTION_NOT_PROPOSED");
  assert.equal(code({ ...ADMIN, bundleId: P }), "BIAS_ADOPTION_NOT_PROPOSED");
  assert.equal(code({ ...ADMIN, bundleId: B }), "BIAS_ADOPTION_NOT_PROPOSED");
  assert.equal(code({ ...ADMIN, bundleId: A, scope: "project", scopeId: " " }), "BIAS_ADOPTION_NOT_PROPOSED");
  assert.equal(code({ bundleId: B, author: "mo", identity: "member:mo", viewer: "member:mo" }), "BIAS_ADOPTION_NOT_PROPOSED");
  assert.equal(w.bias.biasAdopt({ ...ADMIN }).check, "C-26.10");
  /* a project scope: the existence refusal (C-70.1), then owner authority */
  w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", by: "owner" });
  const seen = w.bias.biasAdopt({ reason: WHY, bundleId: A, scope: "project", scopeId: P, author: "mo", identity: "member:mo", viewer: "member:mo" });
  assert.deepEqual([seen.reason, seen.check], ["PROJECT_SEEN_NOT_A_PARTICIPANT", "C-70.1"]);
  assert.equal(code({ bundleId: A, scope: "project", scopeId: P, author: "joiner", identity: "member:joiner", viewer: "member:joiner" }),
    "PROJECT_ACT_NOT_THE_OWNER");
  assert.equal(code({ bundleId: A, scope: "project", scopeId: P, ...ADMIN }), "PROJECT_ACT_NOT_THE_OWNER");
  /* an instance scope: administrator authority, not an ordinary member or a project owner — membership's one answer
     (R84, C-96.1): this act's fixed phrase in its detail, the remedy, and the message the standard sentence then it */
  const row = MEMBERSHIP_CHECKS.NOT_AN_ADMIN;
  for (const [who, by] of [["mo", "mo"], ["owner", "owner"], ["x", null]]) {
    const ask = by ? { author: who, identity: `member:${by}`, viewer: `member:${by}` } : { author: who, identity: "class:member", viewer: "class:member" };
    const r = w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ask });
    assert.deepEqual(r, notAnAdmin(by, INSTANCE_ADOPTION_ACT, { remedy: INSTANCE_ADOPTION_REMEDY, scope: "instance" }), who);
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation, r.by, r.scope], [false, "NOT_AN_ADMIN", "NOT_AN_ADMIN", "C-96.1", row.translation, by, "instance"]);
    assert.ok(r.detail.startsWith(INSTANCE_ADOPTION_ACT), r.detail);
    assert.equal(r.remedy, INSTANCE_ADOPTION_REMEDY);
    assert.equal(r.message, `${row.translation} ${INSTANCE_ADOPTION_REMEDY}`);
  }
  assert.match(INSTANCE_ADOPTION_REMEDY, /project you own/);
  assert.match(INSTANCE_ADOPTION_REMEDY, /ask an administrator/);
  assert.equal(w.ops(`bundleId=${A}&author=mo&identity=member:mo&viewer=member:mo`).biasadopt instanceof Function, true);
  assert.equal((await w.ops(`bundleId=${A}&author=mo&identity=member:mo&viewer=member:mo`).biasadopt()).code, "NOT_AN_ADMIN");
  assert.equal(w.dump(), before, "every refusal writes nothing");
  /* who may: the owner for the project, an administrator (the founder or an active admin member) for the instance,
     and the adoption stays signed by its author (R12) */
  assert.equal(code({ bundleId: A, scope: "project", scopeId: P, reason: WHY, author: "owner", identity: "member:owner", viewer: "member:owner" }), "ok");
  assert.equal(code({ bundleId: A, ...ADMIN }), "ok");
  const signed = w.bias.biasAdopt({ reason: WHY, bundleId: A, author: "second", identity: "member:second", viewer: "member:second" });
  assert.deepEqual([signed.ok, signed.author, w.row(`SELECT author FROM bias_adoptions WHERE scope_type = ?`, "instance").author],
    [true, "second", "second"]);
});

test("R12: one adoption per (scope, project, bundle), replaced on re-adoption, pinning the head and the source fields, with author, instant and the adopter's reason; the answer's pin, author, instant, reason, in_force, pins_proposed and note", async () => {
  const w = await adoptWorld("proposed", { policy_source: "https://example.org/p", policy_retrieved: "2026-06-30", policy_sha256: "ABC123" });
  const head = w.record.head(A).bundleSha;
  const r = w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN, at: T0 });
  assert.deepEqual({ ...r, note: undefined }, { ok: true, adopted: true, bundleId: A, scope: "instance", scope_id: "", author: "admin",
    at: T0, reason: WHY, pinned: { bundle_sha: head, source_url: "https://example.org/p", retrieved: "2026-06-30", source_sha256: "abc123" },
    in_force: false, pins_proposed: true, note: undefined });
  assert.match(r.note, /PINS A PROPOSED REVISION/);
  assert.match(r.note, /REPLACES this scope's lens/);
  assert.deepEqual(at(w), { scope_type: "instance", scope_id: "", bundle_id: A, bundle_sha: head, author: "admin", at: T0,
    source_url: "https://example.org/p", retrieved: "2026-06-30", source_sha256: "abc123", reason: WHY });
  /* adopted, then re-adopted: replaced, never a second row */
  w.promote(A, FM(A, { statements: [S("s1")], current_state: "adopted", prior_state: "proposed" }));
  const r2 = w.bias.biasAdopt({ reason: "  Re-adopted once the group accepted the revision.  ", bundleId: A, author: "second",
                                identity: "member:second", at: "2026-08-01T00:00:00Z" });
  assert.deepEqual([r2.in_force, r2.pins_proposed, r2.note, r2.reason],
    [true, false, word("bias.note.set_force_scope"), "Re-adopted once the group accepted the revision."]);
  assert.deepEqual([w.count("bias_adoptions"), at(w).author, at(w).bundle_sha, at(w).source_url, at(w).reason],
    [1, "second", w.record.head(A).bundleSha, null, "Re-adopted once the group accepted the revision."],
    "the reason is replaced with the row, trimmed");
  /* absent source fields are null */
  assert.deepEqual([at(w).retrieved, at(w).source_sha256], [null, null]);
  /* a project scope keeps its own row beside the instance's */
  w.bias.biasAdopt({ reason: WHY, bundleId: A, scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" });
  assert.equal(w.count("bias_adoptions"), 2);
});

test("R11, R12: BIAS_ADOPTION_NO_REASON (C-26.21) — a reason absent, not a string, blank or over 2,000 characters is refused, on a re-adoption too, with nothing written and nobody told; every earlier refusal is still answered before it; a reasoned adoption is kept with its reason and answered", async () => {
  const w = await adoptWorld("adopted");
  const told = [];
  w.bias.onLensChange("scheduler", () => told.push(1));
  const row = BIAS_CHECKS.BIAS_ADOPTION_NO_REASON;
  assert.deepEqual([row.check, typeof row.where, typeof row.translation], ["C-26.21", "string", "string"]);
  const bad = [undefined, null, 42, true, {}, ["a reason"], "", "   ", "\n\t ", "y".repeat(BIAS_ADOPTION_REASON_MAX + 1),
               ` ${"y".repeat(BIAS_ADOPTION_REASON_MAX + 1)} `];
  const asks = [{ ...ADMIN },
                { scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" }];
  const refusedAll = async () => {
    const before = w.dump();
    for (const ask of asks) for (const reason of bad) {
      const r = w.bias.biasAdopt({ bundleId: A, ...ask, reason });
      assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "BIAS_ADOPTION_NO_REASON", "BIAS_ADOPTION_NO_REASON",
        "C-26.21", row.translation], `${ask.scope || "instance"}: ${JSON.stringify(reason)?.slice(0, 20)}`);
      assert.equal(typeof r.detail, "string");
    }
    const long = w.bias.biasAdopt({ bundleId: A, ...ADMIN, reason: "y".repeat(BIAS_ADOPTION_REASON_MAX + 1) });
    assert.deepEqual([long.limit, long.length], [BIAS_ADOPTION_REASON_MAX, BIAS_ADOPTION_REASON_MAX + 1]);
    /* the op: from the body, else the query; a body's reason wins over the query's */
    const op = (q, body) => w.ops(`bundleId=${A}&author=admin&identity=member:admin&viewer=admin${q}`, body).biasadopt();
    assert.equal((await op("", null)).reason, "BIAS_ADOPTION_NO_REASON");
    assert.equal((await op("&reason=%20%20", null)).reason, "BIAS_ADOPTION_NO_REASON");
    assert.equal((await op(`&reason=${encodeURIComponent(WHY)}`, { reason: " " })).reason, "BIAS_ADOPTION_NO_REASON");
    assert.equal((await op("", { reason: 7 })).reason, "BIAS_ADOPTION_NO_REASON");
    await w.bias.noticesDelivered();
    assert.equal(w.dump(), before, "nothing written: no bias_adoptions row, an existing adoption unchanged");
    assert.deepEqual(told, [], "no notice told");
  };
  /* a first adoption: no row is written */
  await refusedAll();
  assert.equal(w.count("bias_adoptions"), 0);
  /* each earlier refusal is answered before the reason's */
  const first = (a) => w.bias.biasAdopt({ bundleId: A, ...a }).reason;
  assert.equal(first({ author: "token:admin", identity: "member:admin" }), "BIAS_ADOPTION_NOT_AUTHORED");
  assert.equal(first({ ...ADMIN, reason: undefined, bundleId: null }), "BIAS_ADOPTION_NOT_PROPOSED");
  assert.equal(first({ ...ADMIN, reason: undefined, scope: "project", scopeId: "" }), "BIAS_ADOPTION_NOT_PROPOSED");
  w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", by: "owner" });
  assert.equal(first({ scope: "project", scopeId: P, author: "mo", identity: "member:mo", viewer: "member:mo" }), "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.equal(first({ scope: "project", scopeId: P, author: "joiner", identity: "member:joiner", viewer: "member:joiner" }), "PROJECT_ACT_NOT_THE_OWNER");
  assert.equal(first({ author: "mo", identity: "member:mo", viewer: "member:mo" }), "NOT_AN_ADMIN");
  /* reasoned: kept with its reason (trimmed) and answered with the pin, author and instant */
  const ok = w.bias.biasAdopt({ bundleId: A, ...ADMIN, reason: `  ${WHY}  `, at: T0 });
  assert.deepEqual([ok.ok, ok.reason, ok.author, ok.at, ok.pinned.bundle_sha], [true, WHY, "admin", T0, w.record.head(A).bundleSha]);
  assert.deepEqual([at(w).reason, at(w).author, at(w).at], [WHY, "admin", T0]);
  const edge = "z".repeat(BIAS_ADOPTION_REASON_MAX);
  const ownerOk = w.bias.biasAdopt({ bundleId: A, scope: "project", scopeId: P, author: "owner", identity: "member:owner",
                                     viewer: "member:owner", reason: edge, at: T0 });
  assert.deepEqual([ownerOk.ok, ownerOk.reason], [true, edge], "exactly 2,000 characters is kept");
  await w.bias.noticesDelivered();
  told.length = 0;
  /* a re-adoption without a reason: refused the same way, the adoption held unchanged */
  await refusedAll();
  assert.deepEqual(w.rows(`SELECT scope_type, reason FROM bias_adoptions ORDER BY scope_type`),
    [{ scope_type: "instance", reason: WHY }, { scope_type: "project", reason: edge }]);
  /* the op carries the reason from the query when the body has none (a GET), and from the body */
  assert.equal((await w.ops(`bundleId=${A}&reason=${encodeURIComponent("From the query.")}&author=admin&identity=member:admin&viewer=admin`).biasadopt()).reason,
    "From the query.");
  assert.equal((await w.ops(`bundleId=${A}&reason=q&author=admin&identity=member:admin&viewer=admin`, { reason: "From the body." }).biasadopt()).reason,
    "From the body.");
  assert.equal(w.row(`SELECT reason FROM bias_adoptions WHERE scope_type = ?`, "instance").reason, "From the body.");
});

test("R13: a project scope with no id, or one the viewer may not see, answers in_force false and 'no manifest was in force', identically", async () => {
  const w = await adoptWorld();
  w.bias.biasAdopt({ reason: WHY, bundleId: A, scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" });
  const noId = w.bias.biasManifest({ scope: "project", viewer: "member:owner" });
  const unseen = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:mo" });
  const absent = w.bias.biasManifest({ scope: "project", scopeId: "PROJ-2026-0404-none", viewer: "member:owner" });
  for (const m of [noId, unseen, absent]) {
    assert.deepEqual([m.in_force, m.stated, m.statements, m.statements_sha], [false, word("bias.manifest_force"), [], null]);
  }
  assert.deepEqual({ ...unseen, scope_id: null }, { ...absent, scope_id: null });
  assert.equal(w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" }).in_force, true);
  /* the op reads its scope and the stamped viewer from the query */
  assert.equal(w.ops(`scope=project&scopeId=${P}&viewer=member:owner`).biasmanifest().in_force, true);
  assert.equal(w.ops(`scope=project&scopeId=${P}&viewer=member:mo`).biasmanifest().in_force, false);
});

test("R14: instance adoptions, and a project's too, of sets not retired and visible, each read from its PINNED revision's bytes; a pin at proposed is listed, not in force; an unreadable pin is undetermined", async () => {
  const w = await adoptWorld();
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  const pinned = w.record.head(A).bundleSha;
  /* read from the pinned revision: a later retitle moves the head, never the statements read */
  const m1 = w.bias.biasManifest({ viewer: "admin" });
  assert.deepEqual([m1.in_force, m1.bundles.map((b) => b.revision)], [true, [pinned]]);
  w.promote(A, FM(A, { statements: [S("s1", { text: "Rewritten under the same id, which the pin must not follow." })],
                       current_state: "adopted", prior_state: "proposed" }));
  assert.equal(w.row(`SELECT bundle_sha FROM bias_adoptions`).bundle_sha, w.record.head(A).bundleSha, "an adopted revision re-pins (R10)");
  w.sql.exec(`UPDATE bias_adoptions SET bundle_sha=?`, pinned);        // an adoption pinned to the earlier revision
  const m2 = w.bias.biasManifest({ viewer: "admin" });
  assert.equal(m2.statements[0].text, m1.statements[0].text, "the pinned bytes, from history, not the head");
  /* a pin at a proposed revision: listed with its own state, adopter and instant, and nothing in force */
  w.set(B, [S("t1")], "proposed");
  w.bias.biasAdopt({ reason: WHY, bundleId: B, scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner",
                     at: "2026-07-09T00:00:00Z" });
  const m3 = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" });
  assert.deepEqual(m3.pins_proposed, [{ bundle_id: B, revision: w.record.head(B).bundleSha, scope: "project",
    pinned_state: "proposed", adopted_by: "owner", adopted_at: "2026-07-09T00:00:00Z" }]);
  assert.match(m3.pins_proposed_stated, /puts no lens in force/);
  assert.deepEqual(m3.bundles.map((b) => b.bundle_id), [A], "the proposed pin puts nothing in force");
  assert.equal("pins_proposed" in w.bias.biasManifest({ viewer: "admin" }), false, "absent when there is none");
  /* retired sets are not read; an invisible set is not read (a member sees every non-project bundle, so the gate is
     shown with a viewer the predicate denies) */
  assert.equal(w.bias.biasManifest({ viewer: "nobody" }).in_force, false);
  /* a pin whose bytes the record cannot produce: in_force null, unresolved_pins, the sentence */
  w.sql.exec(`UPDATE bias_adoptions SET bundle_sha='0000' WHERE bundle_id=?`, A);
  const m4 = w.bias.biasManifest({ viewer: "admin" });
  assert.deepEqual([m4.in_force, m4.unresolved_pins, m4.statements_sha], [null, [{ bundle_id: A, revision: "0000", scope: "instance" }], null]);
  assert.match(m4.stated, /cannot be computed/);
  w.sql.exec(`UPDATE bias_adoptions SET bundle_sha=? WHERE bundle_id=?`, w.record.head(A).bundleSha, A);
  w.promote(A, FM(A, { statements: [S("s1")], current_state: "retired", prior_state: "adopted" }));
  assert.equal(w.bias.biasManifest({ viewer: "admin" }).in_force, false, "a retired set is out of force");
});

test("R15: with nothing in force the answer is in_force false and 'no manifest was in force', never an empty lens", async () => {
  const w = await adoptWorld();
  const m = w.bias.biasManifest({ viewer: "admin" });
  assert.deepEqual([m.in_force, m.stated, m.statements_sha, m.bundles], [false, word("bias.manifest_force"), null, []]);
  assert.equal("interactions" in m, false);
});

test("R16: group statements then the project's; a nullification of an unlocked statement removes it, of a locked one keeps it and reports it, text adds or replaces; ordered by bundle then statement id", async () => {
  const w = await adoptWorld("adopted");
  w.set("BIAS-2026-0003-inst", [S("s2"), S("s3", { locked: true }), S("s4")], "adopted");
  w.set("BIAS-2026-0000-proj", [S("p1"), S("n2", { text: "", nullifies: "s2" }), S("n3", { text: "", nullifies: "s3" }),
                                S("r4", { nullifies: "s4", text: "A replacement lens for s4, stated in full." })], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  w.bias.biasAdopt({ reason: WHY, bundleId: "BIAS-2026-0003-inst", ...ADMIN });
  w.bias.biasAdopt({ reason: WHY, bundleId: "BIAS-2026-0000-proj", scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" });
  const m = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" });
  assert.deepEqual(m.statements.map((s) => [s.bundle_id, s.statement_id, s.scope]), [
    ["BIAS-2026-0000-proj", "p1", "project"], ["BIAS-2026-0000-proj", "r4", "project"],
    ["BIAS-2026-0001-a", "s1", "instance"], ["BIAS-2026-0003-inst", "s3", "instance"]]);
  assert.deepEqual(m.lock_violations.map((v) => [v.statement_id, v.nullifies, v.instance_bundle]), [["n3", "s3", "BIAS-2026-0003-inst"]]);
  /* the instance scope alone is untouched by the project's layer */
  assert.deepEqual(w.bias.biasManifest({ viewer: "admin" }).statements.map((s) => s.statement_id), ["s1", "s2", "s3", "s4"]);
});

test("R17: statements_sha is SHA-256 over the whole effective set before any paging — the same at limit 1, any offset, any page", async () => {
  const w = await adoptWorld("adopted");
  w.set(B, [S("t1"), S("t2"), S("t3")], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  w.bias.biasAdopt({ reason: WHY, bundleId: B, ...ADMIN });
  const whole = w.bias.biasManifest({ viewer: "admin" });
  for (const [limit, offset] of [[1, 0], [1, 3], [2, 1], [2000, 0], [null, 9]])
    assert.equal(w.bias.biasManifest({ viewer: "admin", limit, offset }).statements_sha, whole.statements_sha);
  assert.match(whole.statements_sha, /^[0-9a-f]{64}$/);
  const { createHash } = await import("node:crypto");
  const expect = createHash("sha256").update(JSON.stringify(whole.statements.map((s) =>
    [s.bundle_id, s.statement_id, s.kind, s.subject, s.text, s.justification, s.locked]))).digest("hex");
  assert.equal(whole.statements_sha, expect);
  /* a text rewritten under the same id moves the hash */
  w.promote(B, FM(B, { statements: [S("t1"), S("t2"), S("t3", { text: "Changed text for t3, which changes meaning." })],
                       current_state: "adopted", prior_state: "proposed" }));
  assert.notEqual(w.bias.biasManifest({ viewer: "admin" }).statements_sha, whole.statements_sha);
});

test("R18: bundles with their pins, each adoption's residue with whether it is stated, the page (200 default, at most 2,000, offset), total and truncated", async () => {
  const w = await adoptWorld("adopted", { policy_source: "https://example.org/p" });
  const many = Array.from({ length: 2005 }, (_, i) => S(`x${String(i).padStart(4, "0")}`));
  w.set(B, many, "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN, at: T0 });
  w.bias.biasAdopt({ reason: WHY, bundleId: B, ...ADMIN, at: T0 });
  const m = w.bias.biasManifest({ viewer: "admin" });
  assert.deepEqual(m.bundles[0], { bundle_id: A, revision: w.record.head(A).bundleSha, scope: "instance", adopted_by: "admin",
    adopted_at: T0, source_url: "https://example.org/p", retrieved: null, source_sha256: null });
  assert.deepEqual(m.residue.map((r) => [r.bundle_id, r.stated, r.text.startsWith("BIO checks")]), [[A, true, true], [B, true, true]]);
  assert.deepEqual([m.count, m.total, m.limit, m.offset, m.truncated], [BIAS_MANIFEST_LIMIT_DEFAULT, 2006, 200, 0, true]);
  const big = w.bias.biasManifest({ viewer: "admin", limit: 99999 });
  assert.deepEqual([big.count, big.limit, big.truncated], [BIAS_MANIFEST_LIMIT_MAX, 2000, true]);
  const tail = w.bias.biasManifest({ viewer: "admin", limit: 10, offset: 2000 });
  assert.deepEqual([tail.count, tail.offset, tail.truncated], [6, 2000, false]);
  assert.equal(m.statements_sha_covers, word("bias.whole_effective_set"));
});

test("R22: the fingerprint changes when any lens input changes, and is synchronous and small", async () => {
  const w = await adoptWorld("proposed");
  const f0 = w.bias.lensFingerprint();
  assert.equal(typeof f0, "string");
  assert.equal(f0, JSON.stringify([0]));
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  const f1 = w.bias.lensFingerprint();
  assert.notEqual(f1, f0, "the number of adoptions");
  assert.deepEqual(JSON.parse(f1), [1, ["instance", "", A, w.record.head(A).bundleSha, "proposed"]]);
  w.promote(A, FM(A, { statements: [S("s1")], current_state: "adopted", prior_state: "proposed" }));
  const f2 = w.bias.lensFingerprint();
  assert.notEqual(f2, f1, "the head's sha and state");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" });
  assert.notEqual(w.bias.lensFingerprint(), f2, "the scope and project id");
  assert.equal(w.bias.lensFingerprint(), w.bias.lensFingerprint(), "a read writes nothing and is stable");
  /* bounded: at most the first 1,000 adoptions are itemised, and the count covers the rest */
  for (let i = 0; i < 1003; i++)
    w.sql.exec(`INSERT INTO bias_adoptions (scope_type, scope_id, bundle_id, bundle_sha, author, at) VALUES ('project', ?, ?, 'x', 'a', 't')`,
      `PROJ-X-${String(i).padStart(4, "0")}`, A);
  const big = JSON.parse(w.bias.lensFingerprint());
  assert.deepEqual([big[0], big.length - 1], [1005, 1000]);
});

test("R23: a successful adoption notifies each registered module once, after the write; a refused one notifies nobody", async () => {
  const w = await adoptWorld("proposed");
  const seen = [];
  w.bias.onLensChange("scheduler", () => seen.push(w.count("bias_adoptions")));
  w.bias.biasAdopt({ reason: WHY, bundleId: A, author: "mo", identity: "member:mo" });
  assert.deepEqual(seen, []);
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  await w.bias.noticesDelivered();
  assert.deepEqual(seen, [1]);
  /* the op awaits the notice, so an arm lands inside the request */
  let armed = false;
  w.bias.onLensChange("queue", async () => { await new Promise((r) => setTimeout(r, 5)); armed = true; });
  await w.ops(`bundleId=${A}&reason=${encodeURIComponent(WHY)}&author=admin&identity=member:admin&viewer=member:admin`).biasadopt();
  assert.equal(armed, true);
});

test("R24: a project statement on a group statement's subject that names no override is listed as an interaction, with both justifications; it refuses nothing", async () => {
  const w = await adoptWorld();
  w.set("BIAS-2026-0000-proj", [S("p1", { subject: "ENT-2026-0007", justification: "We hold the office to a higher bar here." }),
                                S("p2", { subject: "ENT-2026-0099" }),
                                S("r1", { subject: "ENT-2026-0007", nullifies: "s1", text: "A named replacement of s1, stated." })], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  w.bias.biasAdopt({ reason: WHY, bundleId: "BIAS-2026-0000-proj", scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" });
  const m = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" });
  assert.equal(m.in_force, true);
  /* r1 names its override (and removes s1), so nothing is left to interact with */
  assert.deepEqual(m.interactions, []);
  w.promote("BIAS-2026-0000-proj", FM("BIAS-2026-0000-proj", { current_state: "adopted", prior_state: "proposed",
    statements: [S("p1", { subject: "ENT-2026-0007", justification: "We hold the office to a higher bar here." }), S("p2", { subject: "ENT-2026-0099" })] }));
  const m2 = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: "member:owner" });
  assert.deepEqual(m2.interactions, [{ statement_id: "p1", bundle_id: "BIAS-2026-0000-proj", subject: "ENT-2026-0007",
    justification: "We hold the office to a higher bar here.",
    instance: [{ statement_id: "s1", bundle_id: A, justification: S("s1").justification }] }]);
  assert.match(m2.interactions_stated, /refuses nothing/);
  assert.equal(m2.statements.length, 3, "listed, never removed or refused");
});

test("R25: a statement whose subject is not in the registry is listed for review; with no registry to ask it is undetermined and says so", async () => {
  const registry = new Set(["ENT-2026-0007"]);
  const w = world({ entities: { has: (id) => registry.has(id) } });
  await w.group();
  w.set(A, [S("s1"), S("s2", { subject: "ENT-2026-0404" })], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  const m = w.bias.biasManifest({ viewer: "admin" });
  assert.deepEqual(m.unregistered_subjects, [{ statement_id: "s2", bundle_id: A, scope: "instance", subject: "ENT-2026-0404" }]);
  assert.match(m.unregistered_subjects_stated, /does not hold/);
  registry.add("ENT-2026-0404");
  assert.deepEqual(w.bias.biasManifest({ viewer: "admin" }).unregistered_subjects, []);
  const none = await adoptWorld();
  none.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  const u = none.bias.biasManifest({ viewer: "admin" });
  assert.deepEqual([u.in_force, u.unregistered_subjects], [true, null]);
  assert.match(u.unregistered_subjects_stated, /^undetermined/);
  const failing = world({ entities: { has: () => { throw new Error("registry down"); } } });
  await failing.group();
  failing.set(A, [S("s1")], "adopted");
  failing.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  assert.equal(failing.bias.biasManifest({ viewer: "admin" }).unregistered_subjects, null);
  /* the real registry: `entitiesOf` on the same storage, reached by default */
  const real = world({ entities: undefined });
  await real.group();
  const reg = entitiesOf(real.ctx);
  reg.migrate();
  const made = reg.createEntity({ kind: "office", label: "The records office", declaredBy: "admin",
    note: "The office these statements scrutinise, registered so they can name it." });
  assert.equal(made.ok, true, JSON.stringify(made));
  real.set(A, [S("s1", { subject: made.entity_id }), S("s2", { subject: "ENT-2026-0404" })], "adopted");
  real.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  assert.deepEqual(real.bias.biasManifest({ viewer: "admin" }).unregistered_subjects.map((u) => u.statement_id), ["s2"]);
});

test.todo("R26: a project statement that loosens a group statement on the same subject is an override whatever it calls itself, and the strictest applies (deferred by K102 until evaluation findings exist)");

test("R27: nothing puts a lens in force but a member's authored adoption whose pinned revision stands at adopted", async () => {
  const w = await adoptWorld();
  assert.equal(w.bias.biasManifest({ viewer: "admin" }).in_force, false, "an adopted set with no adoption is not in force");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, author: "token:admin", identity: "member:admin" });
  w.bias.biasInhale({ policy: "Verify every claim with direct knowledge.", adopt: true });
  assert.equal(w.bias.biasManifest({ viewer: "admin" }).in_force, false, "no machine adopts, and reading a policy installs nothing");
  w.set(B, [S("t1")], "proposed");
  w.bias.biasAdopt({ reason: WHY, bundleId: B, ...ADMIN });
  assert.equal(w.bias.biasManifest({ viewer: "admin" }).in_force, false, "a pin at proposed is not in force");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  assert.equal(w.bias.biasManifest({ viewer: "admin" }).in_force, true);
});

test("R28: bias is disclosed and never blocks — no promotion of another type is refused because a lens exists or changed", async () => {
  const w = await adoptWorld();
  w.bias.biasAdopt({ reason: WHY, bundleId: A, ...ADMIN });
  const info = "INFO-2026-0001-x";
  const md = (st) => `---\nid: ${info}\nobject_type: information\ntitle: x\ncurrent_state: ${st}\ncreated: ${T0}\nlast_updated: ${T0}\ngroup: test-group\n---\n`;
  assert.equal(w.promotion.promote({ bundleId: info, base: null, snapKey: "i1", author: "member:ann", meta: {}, files: [{ path: "bundle.md", text: md("collected") }] }).ok, true);
  w.promote(A, FM(A, { statements: [S("s1", { text: "A different lens entirely, now in force." })], current_state: "adopted", prior_state: "proposed" }));
  assert.equal(w.promotion.promote({ bundleId: info, base: w.record.head(info).bundleSha, snapKey: "i2", author: "member:ann", meta: {},
                                     files: [{ path: "bundle.md", text: md("collected") + "\nmore" }] }).ok, true);
});

test("R30: the tables are declared to record-core's purge — statements by bundle, adoptions by bundle and project, the debt whole-store, the sweep exempt", async () => {
  const w = await adoptWorld();
  w.set(B, [S("t1")], "adopted");
  w.bias.biasAdopt({ reason: WHY, bundleId: A, scope: "project", scopeId: P, author: "owner", identity: "member:owner", viewer: "member:owner" });
  w.bias.biasAdopt({ reason: WHY, bundleId: B, ...ADMIN });
  w.sql.exec(`INSERT INTO bias_debts (run, context_type, context_id, recipients, raised, observed) VALUES ('RUN-1','project',?,'[]','t','t')`, P);
  w.sql.exec(`INSERT INTO bias_debt_settlements (run, kind, at) VALUES ('RUN-1','resolved','t')`);
  w.sql.exec(`INSERT INTO bias_debt_sweeps (k, fingerprint, target, cursor, at) VALUES ('lens','f','f','','t')`);
  const p1 = w.record.purge({ bundleId: P });
  assert.deepEqual([p1.removed.bias_adoptions, w.count("bias_adoptions"), w.count("bias_statements")], [1, 1, 2]);
  const p2 = w.record.purge({ bundleId: A });
  assert.deepEqual([p2.removed.bias_statements, w.count("bias_statements"), w.count("bias_debts")], [1, 1, 1]);
  w.record.purge({});
  assert.deepEqual(["bias_statements", "bias_adoptions", "bias_debts", "bias_debt_settlements", "bias_debt_sweeps"].map((t) => w.count(t)),
    [0, 0, 0, 0, 1]);
});

test("R47: the five tables are declared explicitly through record-core's declareTable, with R30's keying and sight and the default form's other classes", async () => {
  const w = await adoptWorld();
  const mine = w.record.declaredTables().filter((d) => d.module === "bias");
  const base = { module: "bias", purge: "clear", expunge: "none", export: "admin-only", derive: "stored", version_chain: false };
  assert.deepEqual(mine, [
    { ...base, name: "bias_statements", keys: ["bundle_id"], sight: "bundle" },
    { ...base, name: "bias_adoptions", keys: ["bundle_id", "scope_id"], sight: "bundle" },
    { ...base, name: "bias_debts", keys: [], sight: "group" },
    { ...base, name: "bias_debt_settlements", keys: [], sight: "group" },
    { ...base, name: "bias_debt_sweeps", purge: "exempt", sight: "group" },
  ]);
  /* explicit, not the default form's: no entry's sight is decided by its keying when read */
  assert.ok(mine.every((d) => ["bundle", "group"].includes(d.sight)));
  /* declared once: a second declaration of any of them is refused, naming this module */
  const again = w.record.declareTable("other", [{ ...base, name: "bias_debts", sight: "group" }]);
  assert.deepEqual([again.ok, again.reason, again.declaredBy], [false, "TABLE_DECLARED", "bias"]);
});
