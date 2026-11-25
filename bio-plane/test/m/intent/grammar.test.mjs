/* intent's project grammar (R29: C-2.9's `closed_reason` arm, registered in record-grammar's `checkProjectExtension`
   slot, which it claims whole, `C-2.9` alone, through record-core's grammar seam) and its own codes (R30, with R2, R8, R10
   and R22 answering them). The arm is checked over every reason and state the requirement names, and the retired
   fields (`workproduct_state`, `evaluations`, the C-9.1 ladder; K899 (3)) over every rung, shape and value the retired
   arms judged, each drawing nothing; through record-grammar's `checkBundle` called with the grammars the record
   answers, through the promotion, and through record-core's audit. */
import test from "node:test";
import assert from "node:assert/strict";
import { checkBundle, EXTENSION_ARMS } from "../../../src/record-grammar/index.mjs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import * as INTENT from "../../../src/intent/index.mjs";
import { INTENT_CHECKS, PROJECT_GRAMMAR, CLOSED_REASONS, checkProjectExtension, registerProjectGrammar, intentOf }
  from "../../../src/intent/index.mjs";
import { PROGRESSION_CHECKS } from "../../../src/progressions/index.mjs";
import { world, seeded, storage, V, COND } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const TS = "2026-09-01T00:00:00Z";
const ev = (kind, strictness, result, extra = {}) => ({ kind, strictness, result, timestamp: TS, ...extra });
/* A project's front matter in the record's grammar: scalars, and `evaluations` as a list of flat maps. */
function projectDoc(fields = {}, type = "project") {
  const lines = ["---", "id: PROJ-2026-0001-p", `object_type: ${type}`, `schema: ${type}@1`, 'title: "P"',
                 `current_state: ${fields.current_state ?? "forming"}`, 'objective: "Find out."'];
  for (const [k, v] of Object.entries(fields)) {
    if (k === "current_state") continue;
    if (Array.isArray(v)) {
      lines.push(v.length ? `${k}:` : `${k}: []`);
      for (const e of v) Object.entries(e).forEach(([ek, evv], i) => lines.push(`${i ? "    " : "  - "}${ek}: ${JSON.stringify(evv)}`));
    } else lines.push(`${k}: ${v === null ? "null" : JSON.stringify(v)}`);
  }
  return [...lines, "---", "", "## Objective", "", "Find out.", ""].join("\n");
}
const judge = async (w, text) => (await checkBundle({ folderName: "PROJ-2026-0001-p", files: new Map([["bundle.md", text]]),
                                                       sha256: async () => "0" }, { grammars: w.record.grammars() })).findings;
const ours = (findings) => findings.filter((f) => f.check === "C-2.9" || f.check === "C-9.1");
const e29 = (message) => ({ check: "C-2.9", severity: "error", message });
/* The values the retired arms judged (K899 (3)): the four rungs of the old ladder and values outside it, and evaluation
   entries well-formed and not, so a test can show none of them draws a finding any more. */
const RUNGS = ["draft", "internally_checked", "externally_compliant", "distributed"];
const BAD_RUNGS = ["bogus", "Draft", "closed", "", "retracted", "redistributed"];
const EVALS = {
  good: [ev("compliance", "internal", "pass"), ev("argument", "external", "findings", { findings_ref: "INQ-1" })],
  shape: [{ kind: "x" }, { ...ev("compliance", "internal", "pass"), strictness: "casual" }, { ...ev("compliance", "internal", "pass"), result: "fail" },
          { ...ev("compliance", "internal", "pass"), timestamp: "2026-09-01" }, { kind: "compliance", strictness: "internal", result: "pass" }],
  ref: [ev("argument", "internal", "findings"), ev("argument", "internal", "findings", { findings_ref: "" })],
};

test("R29 the project grammar is registered once at start through record-core's grammar seam, as intent, claiming record-grammar's checkProjectExtension slot (C-2.9) whole and nothing else, its only claimant", async () => {
  const w = world();
  const slot = EXTENSION_ARMS.find((a) => a.name === "checkProjectExtension");
  assert.deepEqual([...slot.ids], ["C-2.9"]);
  assert.deepEqual([PROJECT_GRAMMAR.module, [...PROJECT_GRAMMAR.ids]], ["intent", ["C-2.9"]]);
  assert.equal(PROJECT_GRAMMAR.arm, checkProjectExtension);
  const held = w.record.grammars().filter((g) => g.ids.some((id) => slot.ids.includes(id) || id === "C-9.1"));
  assert.deepEqual(held.map((g) => [g.module, [...g.ids]]), [["intent", ["C-2.9"]]], "intent alone claims the slot, whole, and no one C-9.1");
  /* the registration checkBundle takes (record-grammar R39 judges it whole, before any arm runs) */
  await assert.doesNotReject(checkBundle({ folderName: "PROJ-2026-0001-p", files: new Map(), sha256: async () => "0" },
                                         { grammars: w.record.grammars() }));
  /* once: a second construction on the host, or a second registration on the record, adds nothing */
  assert.equal(intentOf(w.host), w.i);
  assert.equal(registerProjectGrammar(w.record), null);
  assert.equal(w.record.grammars().filter((g) => g.module === "intent").length, 1);
  /* a record with no seam is left alone; a refused registration is a wiring defect and throws */
  assert.equal(registerProjectGrammar({}), null);
  assert.equal(registerProjectGrammar(null), null);
  const st = storage();
  for (const t of RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";")) if (t.trim()) st.db.exec(t);
  const other = recordOf({ storage: st }, { evidence: null, evidencePrefix: "bio/captures/" });
  assert.equal(other.registerGrammar("squatter", { ids: ["C-9.1", "C-2.9", "C-800.1"], arm: () => {} }).ok, true);
  assert.equal(other.registerGrammar("intent", { ids: ["C-800.2"], arm: () => {} }).ok, true);
  assert.throws(() => registerProjectGrammar(other), /intent: record-core refused the project grammar: GRAMMAR_DECLARED/);
});

test("R29 a project carrying any workproduct_state, well-formed or not, draws no finding from this grammar: every rung of the retired ladder and every value outside it, at every state, through checkBundle and the arm alone; the module exports no rung list", async () => {
  const w = world();
  assert.equal(INTENT.WORKPRODUCT_STATES, undefined, "the rung list is retired with its arm");
  assert.deepEqual(ours(await judge(w, projectDoc())), []);
  for (const state of ["forming", "investigating", "matured"])
    for (const workproduct_state of [null, ...RUNGS, ...BAD_RUNGS]) {
      assert.deepEqual(ours(await judge(w, projectDoc({ current_state: state, workproduct_state }))), [], `${state} ${workproduct_state}`);
      const direct = [];
      checkProjectExtension({ fm: { object_type: "project", current_state: state, workproduct_state } }, direct);
      assert.deepEqual(direct, [], `direct ${state} ${workproduct_state}`);
    }
  /* at closed with a reason, still nothing; at closed without one, only the closed_reason finding */
  for (const workproduct_state of [...RUNGS, ...BAD_RUNGS]) {
    assert.deepEqual(ours(await judge(w, projectDoc({ current_state: "closed", closed_reason: "resolved", workproduct_state }))), [], workproduct_state);
    assert.deepEqual(ours(await judge(w, projectDoc({ current_state: "closed", workproduct_state }))),
                     [e29("closed state requires closed_reason in: resolved, superseded, abandoned")], `closed ${workproduct_state}`);
  }
  /* any other type: nothing, however wrong its fields */
  const wrong = { workproduct_state: "bogus", evaluations: [{ kind: "x" }], current_state: "closed" };
  for (const type of ["information", "inquiry", "goal", "aspiration"])
    assert.deepEqual(ours(await judge(w, projectDoc(wrong, type))), [], type);
  const direct = [];
  checkProjectExtension({ fm: { object_type: "inquiry", workproduct_state: "bogus", current_state: "closed" } }, direct);
  checkProjectExtension({}, direct);
  assert.deepEqual(direct, []);
});

test("R29 a project carrying any evaluations, well-formed or not, draws no finding from this grammar: well-formed entries, every shape the retired arm refused, a findings result with no findings_ref, a null entry, and a value that is not a list", async () => {
  const w = world();
  const cases = [EVALS.good, EVALS.shape, EVALS.ref, [...EVALS.good, ...EVALS.shape, ...EVALS.ref], []];
  for (const evaluations of cases)
    for (const workproduct_state of [undefined, ...RUNGS, "bogus"]) {
      const fields = workproduct_state === undefined ? { evaluations } : { evaluations, workproduct_state };
      assert.deepEqual(ours(await judge(w, projectDoc(fields))), [], JSON.stringify(fields));
    }
  for (const evaluations of [[null, EVALS.good[0]], "none", 3, { kind: "compliance" }, null]) {
    const out = [];
    checkProjectExtension({ fm: { object_type: "project", current_state: "forming", evaluations } }, out);
    assert.deepEqual(out, [], JSON.stringify(evaluations));
  }
});

test("R29 at closed, a closed_reason not one of resolved, superseded, abandoned is one C-2.9 error; at any other state it is not asked", async () => {
  const w = world();
  assert.deepEqual([...CLOSED_REASONS], ["resolved", "superseded", "abandoned"]);
  const msg = e29("closed state requires closed_reason in: resolved, superseded, abandoned");
  for (const reason of CLOSED_REASONS)
    assert.deepEqual(ours(await judge(w, projectDoc({ current_state: "closed", closed_reason: reason }))), [], reason);
  assert.deepEqual(ours(await judge(w, projectDoc({ current_state: "closed" }))), [msg], "absent");
  for (const reason of ["done", "", null, "Resolved"])
    assert.deepEqual(ours(await judge(w, projectDoc({ current_state: "closed", closed_reason: reason }))), [msg], String(reason));
  for (const state of ["forming", "active", "paused"])
    assert.deepEqual(ours(await judge(w, projectDoc({ current_state: state, closed_reason: "whatever" }))), [], state);
});

test("R29 C-9.1, the retired readiness ladder: no C-9.1 finding at any rung, over every rung and every combination of passes, and none from a value outside the rungs; neither the slot nor this grammar holds the id C-9.1", async () => {
  const w = world();
  /* each kind may hold: nothing, a findings result, an internal pass, an external pass (the combinations the ladder judged) */
  const options = (kind) => [[], [ev(kind, "external", "findings", { findings_ref: "R" })], [ev(kind, "internal", "pass")],
                             [ev(kind, "external", "pass")]];
  let checked = 0;
  for (const ws of [...RUNGS, "bogus"])
    for (const c of options("compliance"))
      for (const a of options("argument")) {
        const evals = [...c, ...a];
        const found = await judge(w, projectDoc({ workproduct_state: ws, evaluations: evals }));
        assert.deepEqual(found.filter((f) => f.check === "C-9.1"), [], `${ws} ${JSON.stringify(evals)}`);
        assert.deepEqual(ours(found), [], `${ws} ${JSON.stringify(evals)}`);
        checked += 1;
      }
  assert.equal(checked, 80);
  /* the rungs with no evaluation at all, which the ladder answered 0, 2, 4, 4 */
  for (const ws of RUNGS) assert.deepEqual(ours(await judge(w, projectDoc({ workproduct_state: ws }))), [], ws);
  /* the id is claimed by no one: record-grammar's slot dropped it (K930), and this grammar claims the slot as it stands */
  assert.ok(!PROJECT_GRAMMAR.ids.includes("C-9.1"));
  assert.ok(!w.record.grammars().some((g) => g.ids.includes("C-9.1")));
});

test("R29 the closed_reason finding is this grammar's only finding: a project at closed with no reason, carrying every retired field, draws it alone, once, at the slot's place", async () => {
  const w = world();
  const evals = [{ kind: "x" }, ev("compliance", "internal", "findings")];
  const text = projectDoc({ current_state: "closed", workproduct_state: "distributed", evaluations: evals });
  const fs = await judge(w, text);
  const mine = ours(fs);
  assert.deepEqual(mine, [e29("closed state requires closed_reason in: resolved, superseded, abandoned")]);
  const bad = ours(await judge(w, projectDoc({ current_state: "closed", workproduct_state: "bogus", evaluations: evals })));
  assert.deepEqual(bad, mine, "an illegal rung and ill-formed evaluations add nothing");
  /* the arm on its own answers what checkBundle runs */
  const direct = [];
  checkProjectExtension({ fm: { object_type: "project", current_state: "closed", workproduct_state: "distributed", evaluations: evals } }, direct);
  assert.deepEqual(direct, mine);
  /* at the slot's place: after the C-2.8 slot before it, before every grammar claiming no slot (record-grammar R39, R40) */
  const marker = (check) => (ctx, out) => { if (ctx.fm?.object_type === "project") out.push({ check, severity: "warning", message: "probe" }); };
  const probed = await checkBundle({ folderName: "PROJ-2026-0001-p", files: new Map([["bundle.md", text]]), sha256: async () => "0" },
    { grammars: [{ module: "probe-after", ids: ["C-800.1"], arm: marker("C-800.1") }, ...w.record.grammars(),
                 { module: "probe-before", ids: ["C-2.8"], arm: marker("C-2.8") }] });
  const order = probed.findings.map((f) => f.check).filter((c) => ["C-2.8", "C-2.9", "C-800.1"].includes(c));
  assert.deepEqual(order, ["C-2.8", "C-2.9", "C-800.1"], "run in the slot's place, whatever the list's order");
  /* with no grammar for the slot, the bundle grammar runs nothing there */
  const bare = await checkBundle({ folderName: "PROJ-2026-0001-p", files: new Map([["bundle.md", text]]), sha256: async () => "0" },
                                 { grammars: w.record.grammars().filter((g) => g.module !== "intent") });
  assert.deepEqual(ours(bare.findings), []);
});

test("R29 a document carrying workproduct_state or evaluations is neither refused nor corrected for them: a project's creation and revision through promotion carry them as written", () => {
  const w = world();
  w.member("alice");
  const P = w.project("Carrying", "alice");
  const lines = ["workproduct_state: bogus", "evaluations:", "  - kind: x", "    strictness: casual", "  - kind: argument",
                 "    strictness: internal", "    result: findings"];
  const text = w.text(P).replace("references: []", `references: []\n${lines.join("\n")}`);
  const r = w.revise(P, text, V("alice"));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(w.text(P), text, "kept byte for byte");
  for (const ws of RUNGS) {
    const next = w.text(P).replace(/^workproduct_state: .*$/m, `workproduct_state: ${ws}`);
    assert.equal(w.revise(P, next, V("alice")).ok, true, ws);
    assert.equal(w.fm(P).workproduct_state, ws);
  }
});

test("R29 R22 the audit runs the grammar over every project held, beside R1's objective arm, through the registrations record-core holds: the retired fields draw nothing, the closed_reason arm and the objective arm each count", async () => {
  const w = world();
  w.member("alice");
  const P = w.project("Audited", "alice");
  const Q = w.project("Closed", "alice");
  const text = w.text(P).replace("references: []", "references: []\nworkproduct_state: externally_compliant\nevaluations:\n"
    + `  - kind: compliance\n    strictness: internal\n    result: pass\n    timestamp: "${TS}"`).replace(/^objective: .*\n/m, "");
  w.st.sql.exec(`UPDATE files SET content=? WHERE bundle_id=? AND path='bundle.md'`, text, P);
  let pass = await w.record.auditPass({ limit: 50 });
  /* the ladder would have found 3 (C-9.1); the objective is missing (R1, C-2.9) */
  assert.equal(pass.tally["C-9.1"], undefined, "no C-9.1 finding");
  assert.equal(pass.tally["C-2.9"], 1);
  assert.equal(pass.tallyDetail["C-2.9/NO_OBJECTIVE"], 1);
  /* a project at closed with no reason: the grammar's one arm counts too */
  const closed = w.text(Q).replace("current_state: forming", "current_state: closed").replace("references: []", "references: []\nworkproduct_state: bogus");
  w.st.sql.exec(`UPDATE files SET content=? WHERE bundle_id=? AND path='bundle.md'`, closed, Q);
  pass = await w.record.auditPass({ limit: 50 });
  assert.equal(pass.tally["C-9.1"], undefined);
  assert.equal(pass.tally["C-2.9"], 2, "the objective arm on P, the closed_reason arm on Q");
});

test("R30 R2 R8 R10 R22 intent's own codes: a progression the record has not declared is INTENT_NO_SUCH_PROGRESSION (C-111.4), a stage it does not declare INTENT_BAD_STAGE (C-111.6), a missing reason INTENT_NO_REASON (C-111.13), numbers and translations unchanged; never progressions' NO_SUCH_PROGRESSION, BAD_STAGE or NO_REASON", async () => {
  /* the rows: one per code, numbers and translations as before the rename; progressions' codes held by progressions alone */
  const rows = {
    INTENT_NO_SUCH_PROGRESSION: ["C-111.4", word("refusal.INTENT_NO_SUCH_PROGRESSION")],
    INTENT_BAD_STAGE: ["C-111.6", word("refusal.INTENT_BAD_STAGE")],
    INTENT_NO_REASON: ["C-111.13", word("refusal.INTENT_NO_REASON")],
  };
  for (const [code, [check, translation]] of Object.entries(rows))
    assert.deepEqual([INTENT_CHECKS[code].check, INTENT_CHECKS[code].translation], [check, translation], code);
  for (const [code, check] of [["NO_SUCH_PROGRESSION", "C-100.11"], ["BAD_STAGE", "C-100.14"], ["NO_REASON", "C-100.18"]]) {
    assert.equal(INTENT_CHECKS[code], undefined, `intent holds no ${code}`);
    assert.equal(PROGRESSION_CHECKS[code].check, check, `${code} is progressions' one row`);
  }
  const w = seeded();
  w.entity("ENT-1");
  w.define();
  const answered = (r, code, label) => {
    assert.equal(r.ok, false, label);
    assert.deepEqual([r.reason, r.code, r.check, r.translation], [code, code, ...rows[code]], label);
  };
  const snap = w.snapshot();
  /* R2: a condition naming an undeclared progression, or a stage its progression does not declare */
  answered(w.i.setCondition({ reason: "Measured by the record.", project: w.P, condition: { ...COND, progression: "nope" }, author: V("bob"), viewer: V("bob") }),
           "INTENT_NO_SUCH_PROGRESSION", "setCondition progression");
  answered(w.i.setCondition({ reason: "Measured by the record.", project: w.P, condition: { ...COND, required: { grade: "B", stages: ["signoff"] } }, author: V("bob"),
                              viewer: V("bob") }), "INTENT_BAD_STAGE", "setCondition stage");
  /* R30: declareAspiration naming an undeclared progression */
  answered(w.i.declareAspiration({ scope: "group", statement: "s", progressions: ["proc", "nope"], author: V("alice") }),
           "INTENT_NO_SUCH_PROGRESSION", "declareAspiration");
  /* R8: closeGoal with no reason; R10: departFrom with no reason; R16's defer and dismiss */
  const g = w.i.declareGoal({ statement: "s", bounds: "b", author: V("bob") }).goal;
  const a = w.i.declareAspiration({ scope: "group", statement: "s", author: V("alice") }).aspiration;
  w.i.registerSource("monitoring", () => [{ key: "c-1", kind: "k", basis: null }]);
  const snap2 = w.snapshot();
  for (const reason of [undefined, "", "   "]) {
    answered(w.i.closeGoal({ goal: g, reason, author: V("bob") }), "INTENT_NO_REASON", `closeGoal ${reason}`);
    answered(w.i.departFrom({ project: w.P, aspiration: a, reason, author: V("bob") }), "INTENT_NO_REASON", `departFrom ${reason}`);
    for (const act of ["defer", "dismiss"])
      answered(w.i.triage({ proposal: "monitoring::c-1", act, reason, author: V("bob") }), "INTENT_NO_REASON", `${act} ${reason}`);
  }
  /* R26's registered check: a goal closed through a raw promotion with no reason */
  const closed = w.text(g).replace("current_state: open", "current_state: closed");
  answered(w.revise(g, closed, V("bob")), "INTENT_NO_REASON", "a raw close");
  /* a raw promotion of a project carrying a condition naming what the record does not declare */
  const raw = (c) => w.revise(w.P, w.text(w.P).replace("references: []", `references: []\nobjective_condition:\n${c}`), V("bob"));
  answered(raw("  progression: nope\n  entity: ENT-1\n  required_grade: B\n  required_stages: []\n  share: 50"),
           "INTENT_NO_SUCH_PROGRESSION", "a raw condition's progression");
  answered(raw("  progression: proc\n  entity: ENT-1\n  required_grade: B\n  required_stages: [signoff]\n  share: 50"),
           "INTENT_BAD_STAGE", "a raw condition's stage");
  assert.deepEqual(w.snapshot(), snap2, "no refusal wrote anything");
  void snap;
});
