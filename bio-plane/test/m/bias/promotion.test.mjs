/* bias R8–R10 (its share of a promotion) and R23 (the notice a promotion sends), through the real promotion. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, FM, S, sha, biasMd, WHY } from "./world.mjs";

const A = "BIAS-2026-0001-a";

test("R8: a bias set moves only along the bias machine; any other move is BIAS_ILLEGAL_TRANSITION (C-26.12) naming from, to and the legal moves, before any write", () => {
  const legal = { draft: ["proposed", "retired"], proposed: ["draft", "adopted", "retired"], adopted: ["retired"], retired: [] };
  const states = ["draft", "proposed", "adopted", "retired"];
  for (const from of states) for (const to of states) {
    if (from === to) continue;
    const w = world();
    const path = { draft: ["draft"], proposed: ["draft", "proposed"], adopted: ["draft", "proposed", "adopted"],
                   retired: ["draft", "retired"] }[from];
    let prior = null;
    for (const st of path) { assert.equal(w.promote(A, FM(A, { current_state: st, prior_state: prior })).ok, true); prior = st; }
    const before = w.dump();
    const r = w.promote(A, FM(A, { current_state: to, prior_state: from }));
    if (legal[from].includes(to)) { assert.equal(r.ok, true, `${from} -> ${to}`); continue; }
    assert.equal(r.ok, false, `${from} -> ${to}`);
    assert.equal(r.reason, "BIAS_ILLEGAL_TRANSITION");
    assert.equal(r.check, "C-26.12");
    assert.deepEqual([r.from, r.to, r.legal_from], [from, to, legal[from]]);
    assert.equal(w.dump(), before, "refused before any write");
  }
});

test("R8: a revision that keeps the state is not a move — it lands in every state of the bias machine, retired included, and the head moves to it", () => {
  const path = { draft: ["draft"], proposed: ["draft", "proposed"], adopted: ["draft", "proposed", "adopted"],
                 retired: ["draft", "retired"] };
  for (const st of ["draft", "proposed", "adopted", "retired"]) {
    const w = world();
    let prior = null;
    for (const s of path[st]) { assert.equal(w.promote(A, FM(A, { current_state: s, prior_state: prior })).ok, true, `${st}: walk to ${s}`); prior = s; }
    const before = w.record.head(A).bundleSha;
    const r = w.promote(A, FM(A, { current_state: st, prior_state: prior, title: `Retitled at ${st}`,
                                   statements: [S("s1", { text: `Statement s1, amended while the set stands at ${st}.` })] }));
    assert.equal(r.ok, true, `${st} -> ${st}: ${JSON.stringify(r)}`);
    assert.notEqual(r.bundleSha, before, `${st}: a new revision was minted`);
    assert.deepEqual([w.record.head(A).bundleSha, w.record.head(A).currentState], [r.bundleSha, st], `${st}: the head moved and kept its state`);
  }
});

test("R9: a bias set with any R2–R7 finding is BIAS_REFUSED (C-26.11), each finding named by its code, before any write; a replay is not judged", () => {
  const w = world();
  const bad = FM(A, { statements: [S("s1", { text: "The spokesman is a liar." }), S("s2", { subject: "the mayor" }), S("s3", { justification: "" })] });
  const before = w.dump();
  const r = w.promote(A, bad);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "BIAS_REFUSED");
  assert.equal(r.check, "C-26.11");
  assert.ok(typeof r.translation === "string" && r.translation.length > 20);
  assert.deepEqual(r.findings.map((f) => [f.check, f.code]),
    [["C-26.5", "BIAS_STATEMENT_ISSUES_A_VERDICT"], ["C-26.2", "BIAS_STATEMENT_SUBJECT_NOT_REGISTERED"],
     ["C-26.3", "BIAS_STATEMENT_NO_JUSTIFICATION"]]);
  assert.ok(r.findings.every((f) => typeof f.translation === "string" && typeof f.detail === "string"));
  assert.equal(w.dump(), before, "nothing was written");
  /* the document's type is asked as well as the envelope's (D-526) */
  const r2 = w.promote(A, bad, { meta: { object_type: "bias" } });
  assert.equal(r2.reason, "BIAS_REFUSED");
  /* a residue missing at adopted is refused at the promotion too (R7 through R9) */
  const w3 = world();
  w3.set(A, [S("s1")], "proposed");
  const r3 = w3.promote(A, FM(A, { current_state: "adopted", prior_state: "proposed" }), { residue: null });
  assert.deepEqual([r3.reason, r3.findings.map((f) => f.check)], ["BIAS_REFUSED", ["C-26.7"]]);
  /* a replay is not judged */
  const w4 = world();
  assert.equal(w4.promote(A, bad, { replay: true }).ok, true);
  /* another type is not asked */
  const w5 = world();
  const info = "INFO-2026-0001-x";
  assert.equal(w5.promote(info, { ...bad, object_type: "information", current_state: "collected" }).reason === "BIAS_REFUSED", false);
});

test("R10: the statement rows are replaced by the promoted document's, removed for every type; adopting re-pins every adoption of the bundle to the revision minted, source fields from the same bytes, adopter and instant kept", async () => {
  const w = world();
  await w.group();
  const P = w.project("PROJ-2026-0001-p", "admin");
  w.set(A, [S("s1"), S("s2")], "proposed", { policy_source: "https://example.org/policy-v1", policy_sha256: "AA" });
  assert.deepEqual(w.rows(`SELECT statement_id, ord FROM bias_statements WHERE bundle_id=? ORDER BY ord`, A),
    [{ statement_id: "s1", ord: 0 }, { statement_id: "s2", ord: 1 }]);
  const inst = w.bias.biasAdopt({ reason: WHY, bundleId: A, author: "admin", identity: "member:admin", at: "2026-07-05T00:00:00Z" });
  const proj = w.bias.biasAdopt({ reason: WHY, bundleId: A, scope: "project", scopeId: P, author: "admin", identity: "member:admin",
                                  viewer: "member:admin", at: "2026-07-06T00:00:00Z" });
  assert.equal(inst.ok && proj.ok, true);
  const proposedSha = w.record.head(A).bundleSha;
  const r = w.promote(A, FM(A, { current_state: "adopted", prior_state: "proposed", statements: [S("s3")],
                                 policy_source: "https://example.org/policy-v2", policy_retrieved: "2026-07-01",
                                 policy_sha256: "ABCDEF" }));
  assert.equal(r.ok, true);
  assert.notEqual(r.bundleSha, proposedSha);
  assert.deepEqual(w.rows(`SELECT statement_id FROM bias_statements WHERE bundle_id=?`, A), [{ statement_id: "s3" }]);
  const pins = w.rows(`SELECT scope_type, bundle_sha, source_url, retrieved, source_sha256, author, at FROM bias_adoptions ORDER BY scope_type`);
  assert.deepEqual(pins, [
    { scope_type: "instance", bundle_sha: r.bundleSha, source_url: "https://example.org/policy-v2", retrieved: "2026-07-01",
      source_sha256: "abcdef", author: "admin", at: "2026-07-05T00:00:00Z" },
    { scope_type: "project", bundle_sha: r.bundleSha, source_url: "https://example.org/policy-v2", retrieved: "2026-07-01",
      source_sha256: "abcdef", author: "admin", at: "2026-07-06T00:00:00Z" }]);
  /* a revision that is not to `adopted` does not re-pin; one that changes type drops the projection */
  const r2 = w.promote(A, FM(A, { current_state: "retired", prior_state: "adopted", statements: [S("s4")] }));
  assert.equal(r2.ok, true);
  assert.equal(w.row(`SELECT bundle_sha FROM bias_adoptions WHERE scope_type='instance'`).bundle_sha, r.bundleSha);
  assert.deepEqual(w.rows(`SELECT statement_id FROM bias_statements WHERE bundle_id=?`, A), [{ statement_id: "s4" }]);
  const B = "BIAS-2026-0002-b";
  assert.equal(w.promote(B, FM(B, { statements: [S("t1")] }), { replay: true }).ok, true);
  assert.equal(w.count("bias_statements"), 2);
  const retyped = w.promotion.promote({ bundleId: B, base: w.record.head(B).bundleSha, snapKey: "retype", author: "member:ann",
    replay: true, meta: {}, files: [{ path: "bundle.md", text: biasMd({ ...FM(B), object_type: "information" }) }] });
  assert.equal(retyped.ok, true, JSON.stringify(retyped));
  assert.deepEqual(w.rows(`SELECT statement_id FROM bias_statements WHERE bundle_id=?`, B), []);
  assert.equal(sha(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("R23: a promotion that moves a bias set's head notifies each registered module once, after the write", async () => {
  const w = world();
  const seen = [];
  assert.equal(w.bias.onLensChange("scheduler", () => seen.push(w.count("bias_statements"))).ok, true);
  let thrown = 0;
  w.bias.onLensChange("queue", () => { thrown++; throw new Error("a listener that fails"); });
  const r = w.promote(A, FM(A));
  assert.equal(r.ok, true);
  assert.deepEqual(seen, [], "not inside the promotion's transaction");
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual([seen, thrown], [[1], 1], "once each, after the write, a throwing listener changing nothing");
  /* a refused promotion notifies nobody; another type's promotion notifies nobody */
  w.promote(A, FM(A, { statements: [S("s1", { text: "The spokesman is a liar." })] }));
  w.promotion.promote({ bundleId: "INFO-2026-0001-x", base: null, snapKey: "i1", author: "member:ann", meta: {},
    files: [{ path: "bundle.md", text: "---\nid: INFO-2026-0001-x\nobject_type: information\ntitle: x\ncurrent_state: collected\ncreated: 2026-07-01T00:00:00Z\nlast_updated: 2026-07-01T00:00:00Z\ngroup: test-group\n---\n" }] });
  await new Promise((res) => setTimeout(res, 0));
  assert.deepEqual(seen, [1]);
});

test("R23: registrations are refused through membership's listenerRefusal (LISTENER_MALFORMED, LISTENER_DECLARED); listeners run in the modules' total order (MODULE_ORDER)", async () => {
  const { listenerRefusal, MODULE_ORDER } = await import("../../../src/membership/index.mjs");
  const w = world();
  const order = [];
  const f = (m) => () => order.push(m);
  for (const m of ["queue", "scheduler", "tasks", "ai-runs"]) assert.deepEqual(w.bias.onLensChange(m, f(m)), { ok: true, module: m });
  assert.deepEqual(w.bias.onLensChange("scheduler", () => {}), listenerRefusal([{ module: "scheduler" }], "scheduler", () => {}));
  assert.equal(w.bias.onLensChange("scheduler", () => {}).reason, "LISTENER_DECLARED");
  for (const [m, fn] of [["", () => {}], [null, () => {}], ["x", "not a function"]]) {
    const r = w.bias.onLensChange(m, fn);
    assert.deepEqual(r, listenerRefusal([], m, fn));
    assert.equal(r.reason, "LISTENER_MALFORMED");
  }
  w.promote(A, FM(A));
  await w.bias.noticesDelivered();
  const at = (m) => MODULE_ORDER.indexOf(m);
  assert.deepEqual(order, ["ai-runs", "scheduler", "tasks", "queue"]);
  assert.ok(order.every((m, i) => i === 0 || at(order[i - 1]) < at(m)));
});
