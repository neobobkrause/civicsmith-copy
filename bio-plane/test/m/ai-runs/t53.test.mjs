/* ai-runs T53 (K5457): the naming of a run's paying principal (R9, R10, R12, R19, R28), each tested at the module's
   interface over the real modules it uses (./world.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, T0, USAGE, agentWorker } from "./world.mjs";

const OLD = "principal_" + "claude";
const columns = (w) => w.rows(`PRAGMA table_info(ai_runs)`).map((c) => c.name);

test("R9 (T53; K3472, BR29): the run's paying principal is principal_ai and its member principal_ai_ref — a table made before the rename is migrated in place with every row kept, and nothing names claude after the migration", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN())).started, true);
  assert.equal(columns(w).some((c) => /claude/i.test(c)), false, "a fresh table names no claude");
  /* a table as it stood before T53: the two columns under their old names, its rows held */
  w.sql.exec(`ALTER TABLE ai_runs RENAME COLUMN principal_ai TO ${OLD}`);
  w.sql.exec(`ALTER TABLE ai_runs RENAME COLUMN principal_ai_ref TO ${OLD}_ref`);
  const held = w.rows(`SELECT * FROM ai_runs ORDER BY run`);
  w.runs.migrate();
  assert.equal(columns(w).some((c) => /claude/i.test(c)), false, "nothing names claude after the migration");
  const after = w.rows(`SELECT * FROM ai_runs ORDER BY run`);
  assert.equal(after.length, held.length, "every row kept");
  assert.deepEqual(after.map((r) => [r.run, r.principal_ai, r.principal_ai_ref]),
                   held.map((r) => [r.run, r[OLD], r[`${OLD}_ref`]]), "no meaning changed");
  /* a second migration changes nothing */
  w.runs.migrate();
  assert.deepEqual(w.rows(`SELECT * FROM ai_runs ORDER BY run`), after);
});

test("R9 (T53) control: a stale principalClaude (or principalClaudeRef) argument is refused AI_RUN_CAPABILITY_UNAVAILABLE with nothing written, though principalAi is given too", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  const before = w.dump();
  for (const stale of [{ ["principal" + "Claude"]: "member:ann" }, { ["principal" + "ClaudeRef"]: "member:ann" }]) {
    const r = await w.runs.open(OPEN(stale));
    assert.deepEqual([r.started, r.code, r.check], [false, "AI_RUN_CAPABILITY_UNAVAILABLE", "C-33.29"], JSON.stringify(stale));
  }
  assert.equal(w.dump(), before, "nothing written");
  assert.equal((await w.runs.open(OPEN())).started, true, "control: the new names open");
});

test("R9, R10, R19, R28, R12 (T53): the answers name the principals so — the open's answer carries untested, read's principal is {plane, ai, ref, skill}, runFor answers principal_ai, and a tick's entries are appended with the run's AI principal as actor", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  const o = await w.runs.open(OPEN());
  assert.equal(o.started, true);
  assert.equal("untested" in o, true, "R10's answer carries untested");
  const s = (await w.runs.read({ run: "R1", viewer: "admin" })).session;
  assert.deepEqual(Object.keys(s.principal), ["plane", "ai", "ref", "skill"]);
  assert.deepEqual(s.principal, { plane: ORG, ai: "member:ann", ref: "member:ann", skill: "bio@1" });
  const f = w.runs.runFor("R1", "admin");
  assert.equal(f.principal_ai, "member:ann");
  assert.equal(Object.keys(f).some((k) => /claude/i.test(k)), false);
  const t = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0,
    log: [{ level: "document", subject: INQ, state: "LOOKED_ABSENT", detail: "looked" }] });
  assert.equal(t.ticked, true, JSON.stringify(t).slice(0, 300));
  assert.deepEqual(w.rows(`SELECT actor FROM observation_log WHERE authority_kind='run' AND authority='R1'`).map((r) => r.actor),
                   ["member:ann"], "R12: the actor is the run's AI principal");
  void USAGE;
});

test("R18 (T53; AIR41) control: a member's personal subscription never serves another member's run — bob's run, with only ann holding one, is withheld NO_ACCOUNT at bob's act with no call; on his own account it is dispatched once with it, no secret", async () => {
  const aw = agentWorker();
  const w = world({ env: { AGENT_WORKER: aw, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await w.group("ann", "bob", { noAccount: ["ann", "bob"] });
  await w.signin("ann");
  w.ctx.id = { equals: (x) => x === "id:bio" };
  w.bundle(INQ);
  const bob = { principalPlane: "member:bob", principalAi: "member:bob", actor: "member:bob", viewer: "member:bob" };
  /* opened while bob held an account of his own, then removed: the run is his act */
  await w.account("bob");
  assert.equal((await w.runs.open(OPEN(bob))).started, true);
  await w.removeAll("member:bob", "bob");
  const r = await w.runs.dispatchMemberRun({ run: "R1", by: "member:bob" });
  assert.deepEqual([r.dispatched, r.withheld, aw.calls.length], [false, "NO_ACCOUNT", 0]);
  await w.account("bob");
  const d = await w.runs.dispatchMemberRun({ run: "R1", by: "member:bob" });
  assert.equal(d.dispatched, true, JSON.stringify(d).slice(0, 300));
  assert.deepEqual(aw.calls.map((c) => c.body.account), [await w.served("bob")]);
  assert.equal(aw.calls[0].body.account.personal, false);
  assert.equal(JSON.stringify(aw.calls[0].body.account).includes("secret"), false);
});
