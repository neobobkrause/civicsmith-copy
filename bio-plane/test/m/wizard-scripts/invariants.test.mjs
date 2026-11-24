/* wizard-scripts: the invariants: nothing deleted and every table declared to purge (R18), a machine writes only a
   proposal (R19), visibility and the refusal rows (R20), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, draft, approved, discoverable, V, MACHINE, STEPS, step, LIBRARY } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";

const A = V("alice"), B = V("bob"), F = V("frank"), E = V("erin"), D = V("dave");
const row = (c) => wz.WIZARD_SCRIPTS_CHECKS[c];

test("R18 nothing is deleted: every act appends; every name in attribution is held by value; the tables are this module's own, declared to purge, a project's purge clearing its scripts and nothing else (the administrator invited to P, D54)", () => {
  const w = seeded();
  w.join(w.P, "erin", "invited");   /* D54: an invited administrator sees hidden P whole */
  const counts = () => Object.fromEntries(wz.WIZARD_SCRIPTS_TABLES.map((t) => [t, w.count(t)]));
  let prev = counts();
  const grew = (why) => {
    const now = counts();
    for (const t of Object.keys(now)) assert.ok(now[t] >= prev[t], `${why}: ${t} shrank`);
    prev = now;
  };
  const a = approved(w); grew("approve");
  const p = w.wz.wizardPropose({ script: a.script, steps: STEPS, why: "w", proposer: MACHINE, viewer: MACHINE }); grew("propose");
  const n2 = w.wz.wizardDraft({ from: p.proposal.id, author: F, viewer: F }); grew("draft");
  w.wz.wizardRevise({ version: n2.version, steps: [STEPS[0]], author: F, viewer: F }); grew("revise");
  w.wz.wizardRetire({ version: n2.version, reason: "r", by: F, viewer: F }); grew("withdraw");
  w.wz.wizardApprove({ version: a.version, widen: true, by: E, viewer: E }); grew("widen");
  const g = w.wz.wizardEditorGrant({ member: "frank", by: E }); w.wz.wizardEditorRevoke({ grant: g.grant, by: E }); grew("grant");
  w.wz.wizardRetire({ script: a.script, reason: "r", by: E, viewer: E }); grew("retire");
  w.wz.wizardProgress({ script: a.script, version: a.version, event: "start" }); w.wz.tallyRefusal("x", "Y"); grew("tallies");
  /* names by value: a member's handle changed later leaves the record's names as they were */
  w.st.sql.exec(`UPDATE members SET handle='renamed' WHERE member_id='frank'`);
  const v = w.wz.wizardRead({ version: a.version, viewer: A }).version;
  assert.deepEqual([v.author.name, v.contributors[0].name, v.approved.by.name], ["h_frank", "h_frank", "h_alice"]);
  /* every table is declared; a bundle's purge clears that project's rows only */
  assert.ok(wz.WIZARD_SCRIPTS_TABLES.every((t) => wz.wizardScriptsOwns(t)));
  assert.equal(wz.wizardScriptsOwns("tpl_templates"), false);
  /* declared with their classes (record-core R21; plan T33 Rules (6)): cleared by purge, never expunged, stored */
  const declared = w.record.declaredTables().filter((d) => d.module === "wizard-scripts");
  assert.deepEqual(declared.map((d) => d.name), [...wz.WIZARD_SCRIPTS_TABLES]);
  for (const d of declared)
    assert.deepEqual([d.purge, d.expunge, d.export, d.derive], ["clear", "none", "admin-only", "stored"], d.name);
  assert.deepEqual(declared.filter((d) => d.sight === "group").map((d) => d.name),
                   ["wiz_editor_grants", "wiz_editor_revocations", "wiz_tallies", "wiz_refusal_tallies"], "no bundle: group-wide");
  assert.deepEqual(declared.filter((d) => d.version_chain).map((d) => d.name), ["wiz_versions", "wiz_revisions"]);
  const q = draft(w, { who: "dave", project: w.Q, name: "Q's" });
  const r = w.record.purge({ bundleId: w.P });
  assert.equal(r.ok, true);
  for (const t of ["wiz_scripts", "wiz_versions", "wiz_revisions", "wiz_events", "wiz_proposals"])
    assert.equal(w.rows(`SELECT COUNT(*) AS n FROM ${t} WHERE bundle_id=?`, w.P)[0].n, 0, t);
  assert.equal(w.wz.wizardRead({ version: q.version, viewer: V("dave") }).ok, true, "Q's script stays");
  assert.equal(w.count("wiz_editor_grants"), 1, "a grant has no bundle: the whole-store purge only");
  w.record.purge({});
  for (const t of wz.WIZARD_SCRIPTS_TABLES) assert.equal(w.count(t), 0, t);
});

test("R19 a machine writes only a proposal: it never drafts, revises, submits, approves, widens, grants, retires or withdraws; tallies carry no identity; no step submits, signs or files for a member", () => {
  const w = seeded();
  const d = draft(w);
  const a = approved(w, { name: "A" });
  const before = w.snapshot();
  const M = { author: MACHINE, by: MACHINE, viewer: MACHINE };
  const acts = [
    [w.wz.wizardDraft({ project: w.P, name: "N", recorded: [], ...M }), "MACHINE_CANNOT_DRAFT_WIZARD"],
    [w.wz.wizardRevise({ version: d.version, steps: STEPS, ...M }), "MACHINE_CANNOT_DRAFT_WIZARD"],
    [w.wz.wizardSubmit({ version: d.version, ...M }), "MACHINE_CANNOT_DRAFT_WIZARD"],
    [w.wz.wizardApprove({ version: a.version, ...M }), "MACHINE_CANNOT_APPROVE_WIZARD"],
    [w.wz.wizardApprove({ version: a.version, widen: true, ...M }), "MACHINE_CANNOT_APPROVE_WIZARD"],
    [w.wz.wizardRetire({ script: a.script, reason: "r", ...M }), "MACHINE_CANNOT_APPROVE_WIZARD"],
    [w.wz.wizardRetire({ version: d.version, reason: "r", ...M }), "MACHINE_CANNOT_APPROVE_WIZARD"],
    [w.wz.wizardEditorGrant({ member: "frank", by: MACHINE }), "NOT_AN_ADMIN"],
    [w.wz.wizardEditorRevoke({ grant: "WEG-2026-0000", by: MACHINE }), "NOT_AN_ADMIN"],
  ];
  for (const [r, c] of acts) assert.deepEqual([r.ok, r.reason], [false, c]);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  const p = w.wz.wizardPropose({ script: a.script, steps: STEPS, why: "w", ...M, proposer: MACHINE });
  assert.equal(p.ok, true, "a proposal");
  /* no op of this module is a member's act on the record: the op table names only the library's own */
  const url = new URL("https://x/?viewer=member%3Afrank");
  const ops = Object.keys(wz.wizardScriptsOps(w.wz, url, {})).sort();
  assert.equal(ops.length, 17, "the module's seventeen ops, each one the op table declares");
  assert.ok(ops.every((op) => /^wizard/.test(op) || op === "baseupdates" || op === "startfrom"), ops.join(","));
  /* the stamps come from the query, never the body: a body naming an author does not act as one */
  const sneaky = wz.wizardScriptsOps(w.wz, new URL(`https://x/?author=${encodeURIComponent(MACHINE)}&viewer=${encodeURIComponent(MACHINE)}`),
                                     { version: d.version, author: F, by: F, steps: STEPS }).wizardsubmit();
  assert.equal(sneaky.reason, "MACHINE_CANNOT_DRAFT_WIZARD");
});

test("R20 visibility: a project's script is seen by whoever may see the project; a group-wide or Civicsmith script by every member; every read and act answers a script the viewer may not see as absent, and no count names one; D54: to an administrator neither invited nor joined, a hidden project's scripts are absent everywhere, a discoverable project's seen whole", () => {
  const w = seeded();
  const a = approved(w);
  const s = draft(w, { name: "Sub" }); w.wz.wizardSubmit({ version: s.version, author: F, viewer: F });
  const absent = (r, why) => assert.deepEqual([r.ok, r.reason], [false, "NO_SUCH_WIZARD"], why);
  absent(w.wz.wizardRead({ script: a.script, viewer: D }), "read");
  absent(w.wz.wizardRevise({ version: s.version, steps: STEPS, author: D, viewer: D }), "revise");
  absent(w.wz.wizardSubmit({ version: s.version, author: D, viewer: D }), "submit");
  absent(w.wz.wizardApprove({ version: s.version, by: D, viewer: D }), "approve");
  absent(w.wz.wizardRetire({ script: a.script, reason: "r", by: D, viewer: D }), "retire");
  absent(w.wz.wizardDraft({ from: a.version, author: D, viewer: D }), "draft from");
  absent(w.wz.wizardPropose({ script: a.script, steps: STEPS, why: "w", proposer: D, viewer: D }), "propose");
  absent(w.wz.wizardUse({ script: a.script, viewer: D }), "use");
  absent(w.wz.wizardProgress({ script: a.script, version: a.version, event: "start", viewer: D }), "progress");
  /* the unseen answer is the absent one, byte for byte apart from the id asked */
  const strip = (r) => ({ ...r, script: null });
  assert.deepEqual(strip(w.wz.wizardRead({ script: a.script, viewer: D })), strip(w.wz.wizardRead({ script: "WIZ-2026-0000", viewer: D })));
  assert.ok(!w.wz.wizardsAt({ screen: "case-home", viewer: D }).scripts.some((x) => x.id === a.script));
  assert.deepEqual(w.wz.wizards({ viewer: D }).scripts.map((x) => x.id), [LIBRARY[1].id, LIBRARY[0].id], "the library's only: no count or script of P (R39)");
  assert.deepEqual(w.wz.submittedFor({ viewer: D }).entries, []);
  assert.deepEqual(w.wz.brokenScripts({ viewer: D }).entries, []);
  const dc = w.wz.wizardCandidates({ viewer: V("dave") });
  assert.ok(!JSON.stringify(dc).includes(a.script), "dave owns Q: candidates name no script he cannot see");
  assert.deepEqual(w.wz.wizardCheck({ steps: STEPS, viewer: D }).warnings, [], "no duplicate warning names a script he cannot see");
  /* D54 (K2408): P is hidden and erin, an administrator, neither invited nor joined: every read and act answers absent */
  absent(w.wz.wizardRead({ script: a.script, viewer: E }), "D54 read");
  absent(w.wz.wizardApprove({ version: s.version, by: E, viewer: E }), "D54 approve");
  absent(w.wz.wizardApprove({ version: a.version, widen: true, by: E, viewer: E }), "D54 widen");
  absent(w.wz.wizardRetire({ script: a.script, reason: "r", by: E, viewer: E }), "D54 retire");
  absent(w.wz.wizardUse({ script: a.script, viewer: E }), "D54 use");
  absent(w.wz.wizardProgress({ script: a.script, version: a.version, event: "start", viewer: E }), "D54 progress");
  assert.deepEqual(w.wz.wizards({ viewer: E }).scripts.map((x) => x.id), [LIBRARY[1].id, LIBRARY[0].id], "D54: the library's only");
  assert.deepEqual(w.wz.submittedFor({ viewer: E }).entries, [], "D54");
  assert.ok(!w.wz.wizardsAt({ screen: "case-home", viewer: E }).scripts.some((x) => x.id === a.script), "D54");
  assert.ok(!JSON.stringify(w.wz.wizardCandidates({ viewer: E })).includes(a.script), "D54: candidates name none of P's");
  assert.deepEqual(w.wz.wizardCheck({ steps: STEPS, viewer: E }).warnings, [], "D54: no duplicate warning names P's script");
  /* control: P discoverable, an administrator sees it whole */
  discoverable(w);
  assert.equal(w.wz.wizardRead({ script: a.script, viewer: E }).ok, true, "D54 control: a discoverable project");
  assert.ok(w.wz.wizards({ viewer: E }).scripts.some((x) => x.id === a.script));
  assert.deepEqual(w.wz.wizardCheck({ steps: STEPS, viewer: E }).warnings.map((x) => x.code), ["WIZARD_DUPLICATE"]);
  absent(w.wz.wizardRead({ script: a.script, viewer: D }), "a member outside a discoverable project sees no script of it");
  /* group-wide and Civicsmith: every member */
  w.wz.wizardApprove({ version: a.version, widen: true, by: E, viewer: E });
  assert.equal(w.wz.wizardRead({ script: a.script, viewer: D }).ok, true);
  assert.equal(w.wz.wizardRead({ script: LIBRARY[0].id, viewer: D }).ok, true);
  assert.equal(w.wz.wizardRead({ script: LIBRARY[0].id, viewer: "nobody" }).reason, "NO_SUCH_WIZARD", "a viewer the rule admits to nothing");
});

test("R20 each refusal carries its row from this module's own family C-131, each with a translation and a where in this module; every refusal answered carries its row; no place, law or venue in the outward text", () => {
  const rows = Object.entries(wz.WIZARD_SCRIPTS_CHECKS);
  const nums = rows.map(([, r]) => r.check);
  for (const [code, r] of rows) {
    assert.match(r.check, /^C-131\.\d+$/, code);
    assert.ok(typeof r.translation === "string" && r.translation.length > 10, code);
    assert.match(r.where, /^src\/wizard-scripts\/(index|writing-help|start)\.mjs \S+ > is-[a-z-]+$/, code);
  }
  assert.equal(new Set(nums).size, nums.length, "each number once");
  assert.deepEqual(nums.map((c) => Number(c.split(".")[1])).sort((x, y) => x - y), nums.map((_, i) => i + 1));
  /* every refusal the module answers, driven at its interface, carries its code's own row */
  const w = seeded();
  const d = draft(w);
  const answers = [
    w.wz.wizardDraft({ project: w.P, name: "", recorded: [], author: F, viewer: F }),
    w.wz.wizardDraft({ project: w.P, name: "N", recorded: [{ screen: "x", value: 1 }], author: F, viewer: F }),
    w.wz.wizardDraft({ project: w.P, name: "N", author: F, viewer: F }),
    w.wz.wizardRevise({ version: d.version, steps: [{ screen: "case-home", act: "casenote", what: "x".repeat(400) }], author: F, viewer: F }),
    w.wz.wizardPropose({ project: w.P, steps: STEPS, why: "", proposer: F, viewer: F }),
    w.wz.wizardPropose({ project: w.P, steps: STEPS, why: "w", proposer: null, viewer: F }),
    w.wz.wizards({ state: "x", viewer: A }), w.wz.wizardRegister({}), w.wz.wizardProgress({ script: d.script, version: d.version, event: "abandon" }),
    w.wz.wizardCandidates({ viewer: F }), w.wz.wizardEditorRevoke({ grant: "WEG-2026-0000", by: E }),
    w.wz.wizardEditorGrant({ member: "nobody", by: E }), w.wz.wizardApprove({ version: d.version, by: A, viewer: A }),
    w.wz.wizardRetire({ script: LIBRARY[0].id, reason: "r", by: E, viewer: E }), w.wz.wizardRead({ script: "WIZ-2026-0000", viewer: A }),
  ];
  for (const r of answers) {
    assert.equal(r.ok, false);
    assert.deepEqual([r.code, r.check, r.translation], [r.reason, row(r.reason).check, row(r.reason).translation], r.reason);
  }
  /* no place, law or venue in what the module says */
  const outward = JSON.stringify([wz.WIZARD_SCRIPTS_CHECKS, answers, w.wz.wizardRead({ version: d.version, viewer: F })]);
  for (const local of [/oakland/i, /alameda/i, /california/i, /brown act/i, /superior court/i, /city council/i]) assert.ok(!local.test(outward), String(local));
});
