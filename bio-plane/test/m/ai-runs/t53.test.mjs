/* ai-runs T53 (K5457): the naming of a run's paying principal (R9, R10, R12, R19, R28), each tested at the module's
   interface over the real modules it uses (./world.mjs). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, ORG, T0, USAGE, ENTRY, LABEL, ENTRIES, PLANS, agentWorker } from "./world.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { readFileSync } from "node:fs";

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

/* ---- R72, R88, R104: a tick's usage entries and their labels ---- */

test("R72 (T53; BR22, BR29): tick takes usage entries {mode, entry_id, label, usage, calls} — two well-formed entries count; control: a label lacking a field is AI_RUN_CONSUME_INVALID, counting nothing", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN())).started, true);
  const before = w.dump();
  for (const field of ["display_name", "provider", "host", "model_version", "effort", "account_level", "owner"]) {
    const { [field]: _gone, ...lacking } = LABEL(ENTRIES.a);
    const r = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, usage: [ENTRY(), { ...ENTRY(), label: lacking }] });
    assert.deepEqual([r.ticked, r.code], [false, "AI_RUN_CONSUME_INVALID"], field);
  }
  assert.equal(w.dump(), before, "nothing counted or written");
  const ok = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, usage: [ENTRY(), ENTRY("check", {}, 2, { entry_id: ENTRIES.b })] });
  assert.deepEqual([ok.ticked, ok.counted], [true, 2], JSON.stringify(ok).slice(0, 300));
});

test("R88 (T53; BR22, BR29): each usage entry is passed to ai-use.countUsage unchanged, entry_id and label beside usage; control: a label.effort that is not a lowercase word (\"Low!\") is AI_RUN_CONSUME_INVALID and countUsage is not asked", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN())).started, true);
  const use = aiUseOf(w.ctx);
  const asked = [];
  const real = use.countUsage.bind(use);
  use.countUsage = (a) => { asked.push(a); return real(a); };
  const e = ENTRY("check", {}, 2, { label: { effort: "low" } });
  assert.equal(w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, usage: [e] }).ticked, true);
  assert.equal(asked.length, 1);
  assert.deepEqual([asked[0].entry_id, asked[0].label, asked[0].usage, asked[0].calls, asked[0].act], [e.entry_id, e.label, e.usage, 2, "R1"]);
  const bad = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, usage: [ENTRY("check", {}, 1, { label: { effort: "Low!" } })] });
  assert.deepEqual([bad.ticked, bad.code], [false, "AI_RUN_CONSUME_INVALID"]);
  assert.equal(asked.length, 1, "nothing counted");
});

test("R104 (T53; BR2, DEC-466 U1): a usage label must name the AI as ai-catalogue names the entry — counted when display_name equals entryOf(entry_id).display_name, the same name whether the team's account or her own served it; control: missing, different, or the account's provider-and-plan name are each AI_RUN_CONSUME_INVALID with nothing counted", async () => {
  const w = world();
  await w.group("ann", "dan", { noAccount: ["dan"] });
  await w.team({ members: ["dan"] });
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN())).started, true);
  assert.equal((await w.runs.open(OPEN({ run: "D1", principalAi: "member:dan" }))).started, true);
  const named = w.catalogue.entryOf(ENTRIES.a).display_name;
  assert.equal(LABEL(ENTRIES.a).display_name, named);
  const own = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, usage: [ENTRY("check", {}, 1, { label: { account_level: "member", owner: "member:ann" } })] });
  const team = w.runs.tick({ run: "D1", caller: ORG, viewer: "admin", at: T0, usage: [ENTRY("check", {}, 1, { label: { account_level: "group", owner: "group" } })] });
  assert.deepEqual([own.counted, team.counted], [1, 1]);
  const before = w.dump();
  for (const display_name of [undefined, "", "Fake claude-b", `${PLANS.provider} ${PLANS.teamApi}`]) {
    const label = display_name === undefined ? (({ display_name: _d, ...rest }) => rest)(LABEL(ENTRIES.a)) : LABEL(ENTRIES.a, { display_name });
    const r = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, usage: [{ ...ENTRY(), label }] });
    assert.deepEqual([r.ticked, r.code], [false, "AI_RUN_CONSUME_INVALID"], String(display_name));
  }
  assert.equal(w.dump(), before, "nothing counted");
});

/* ---- R99, R100: a log entry's read and disagree ---- */

test("R99 (T53; N1219): a tick passes each log entry's read and disagree through — three entries read 1, 2 and 3 of 3 append three rows each with its field; control: an entry with n above total is returned in refused as OBSERVATION_FIELD_MALFORMED and the other two are appended", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  assert.equal((await w.runs.open(OPEN())).started, true);
  const look = (n, total = 3) => ({ level: "document", subject: INQ, state: "LOOKED_ABSENT", detail: `read ${n}`,
                                    read: { record: INQ, n, total, outcome: "answered" } });
  const t = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, log: [look(1), look(2), look(3)] });
  assert.deepEqual([t.ticked, t.appended, t.refused.length], [true, 3, 0]);
  assert.deepEqual(w.rows(`SELECT read FROM observation_log WHERE authority='R1' ORDER BY seq`).map((r) => JSON.parse(r.read).n), [1, 2, 3]);
  const bad = w.runs.tick({ run: "R1", caller: ORG, viewer: "admin", at: T0, log: [look(1), look(4), look(3)] });
  assert.deepEqual([bad.ticked, bad.appended, bad.refused.map((r) => r.code)], [true, 2, ["OBSERVATION_FIELD_MALFORMED"]]);
});

test("R100 (T53; N1219): op=airunlog serves each entry's read and disagree as stored, in order — a read entry and a disagreement entry answer both fields; control: an entry with neither answers both null, and a viewer outside the run's sight gets found: false with no entries", async () => {
  const w = world();
  await w.group("ann", "bob");
  w.project(PROJ, "ann");
  const mine = { principalPlane: "member:ann", principalAi: "member:ann", actor: "member:ann", viewer: "member:ann" };
  assert.equal((await w.runs.open(OPEN({ contextType: "project", contextId: PROJ, ...mine }))).started, true);
  const read = { record: PROJ, n: 1, total: 2, outcome: "answered" };
  const disagree = { record: PROJ, levels: ["document", "meaning"] };
  const t = w.runs.tick({ run: "R1", caller: "member:ann", viewer: "member:ann", actor: "member:ann", at: T0, log: [
    { level: "document", subject: PROJ, state: "LOOKED_ABSENT", detail: "plain" },
    { level: "document", subject: PROJ, state: "LOOKED_ABSENT", detail: "a read", read },
    { level: "meaning", subject: PROJ, state: "LOOKED_INDETERMINATE", detail: "a disagreement", disagree }] });
  assert.equal(t.appended, 3, JSON.stringify(t).slice(0, 300));
  const log = await w.op("airunlog", { run: "R1", viewer: "member:ann" });
  assert.deepEqual(log.entries.map((e) => [e.read, e.disagree]), [[null, null], [read, null], [null, disagree]]);
  const unseen = await w.op("airunlog", { run: "R1", viewer: "member:bob" });
  assert.deepEqual([unseen.found, unseen.entries], [false, []]);
});

/* ---- R54 ---- */

test("R54 (T53; K3472): the five rows call the team's own Civicsmith by their word-table keys — each key's sentence names your team's Civicsmith and never your group's; control: no member-facing sentence this module writes holds the old English", () => {
  const ROWS = ["ai-runs.note.mode_deployed_group", "ai-runs.says.resumption_handed_agent", "ai-runs.says.resumption_dispatched",
                "ai-runs.text.principal_opened_organization", "ai-runs.text.group_civicsmith_resume"];
  const vars = { mode: "m", deployed: "d", are: "is", token_id: "t", why: "w", withheld: "x" };
  for (const key of ROWS) {
    assert.equal(hasWord(key), true, key);
    assert.doesNotMatch(word(key, vars), /group's Civicsmith/i, key);
  }
  for (const key of ROWS.filter((k) => k !== "ai-runs.says.resumption_dispatched"))
    assert.match(word(key, vars), /team's Civicsmith/, key);
  const src = readFileSync(new URL("../../../src/ai-runs/index.mjs", import.meta.url), "utf8");
  const sentences = [...src.matchAll(/localize\(\s*"[^"]+",\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  assert.ok(sentences.length > 20);
  assert.equal(sentences.filter((t) => /group's Civicsmith/i.test(t)).length, 0);
});
