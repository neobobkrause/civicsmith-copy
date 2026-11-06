/* action-plans R36 (DEC-114): every member-facing sentence the module answers calls what a plan addresses a "matter",
   never a "subject": its refusals' translations and details, R19's checks, R32's disclosure and what R37 answers, with
   the plan's other sentences (`says`, `why`, `informs`). The internal names stay: the `subject` keys, the codes and the
   ops. Each code this module mints is driven at the interface, each of its detail's variants with it, and every answer
   is read; a refusal relayed from another module carries that module's words, not this one's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, opened, option, choose, V, MACHINE, AGENT, RUN_PRINCIPAL, by, OFFICE, DAY } from "./fixture.mjs";
import { ACTION_PLAN_CHECKS, DISCLOSURE, actionPlansOps } from "../../../src/action-plans/index.mjs";

const SENTENCES = ["translation", "detail", "says", "why", "disclosure", "informs"];
const SUBJECT = /\bsubjects?\b/i;
const mine = (code) => Object.prototype.hasOwnProperty.call(ACTION_PLAN_CHECKS, code);

/* Every sentence under a member-facing key, with where it was found; a refusal another module minted is its own. */
function sentences(x, path = "", out = []) {
  if (Array.isArray(x)) x.forEach((v, i) => sentences(v, `${path}[${i}]`, out));
  else if (x && typeof x === "object") {
    if (x.ok === false && typeof x.code === "string" && !mine(x.code)) return out;
    for (const [k, v] of Object.entries(x)) {
      if (SENTENCES.includes(k) && typeof v === "string") out.push([`${path}.${k}`, v]);
      else sentences(v, `${path}.${k}`, out);
    }
  }
  return out;
}
const offending = (answers) => answers.flatMap((a) => sentences(a)).filter(([, s]) => SUBJECT.test(s));

// fixtures-generic: SOMEONE_ELSES
test("R36: the words scan finds a sentence calling a matter a subject, and leaves codes, keys and other modules' refusals alone (negative control)", () => {
  assert.deepEqual(offending([{ ok: false, code: "SUBJECT_MALFORMED", detail: "that subject is not one the plan is about" }]),
    [[".detail", "that subject is not one the plan is about"]]);
  assert.deepEqual(offending([{ ok: false, reason: "PLAN_NO_SUBJECT", code: "PLAN_NO_SUBJECT", detail: "a plan is about 1 to 50 matters" },
    { liveness: { state: "subject_removed" }, subjects: [{ kind: "inquiry" }], check: "subjects_not_live" },
    { ok: false, code: "SOMEONE_ELSES", detail: "the subject of another module's sentence" }]), []);
});

test("R36: every translation of this module's rows says matter, never subject", () => {
  const rows = Object.entries(ACTION_PLAN_CHECKS);
  assert.ok(rows.length >= 56);
  for (const [code, row] of rows) assert.equal(SUBJECT.test(row.translation), false, `${code}: ${row.translation}`);
  assert.equal(DISCLOSURE("RUN-1", "planning@1").match(SUBJECT), null);
});

test("R36: every refusal this module mints, each detail's variants with it, and every sentence the reads, the checks, the disclosure and the preview answer, say matter, never subject; the internal names stay", async () => {
  const w = seeded();
  const said = [];
  const keep = (r) => { said.push(r); return r; };
  const m = { author: MACHINE, viewer: MACHINE };
  const o = (extra = {}) => keep(w.ap.planOpen({ project: w.P, subjects: [w.SI, w.S1], title: "Words", ...by("bob"), ...extra }));
  /* R1: opening */
  o(m); o({ title: "" }); o({ subjects: [] }); o({ subjects: [{ kind: "wish" }] }); o({ subjects: [w.SI, w.SI] });
  o({ subjects: [{ kind: "outcome", determination: w.D, standard: "STD-2026-0999-z" }] });
  o({ subjects: [{ kind: "inquiry", inquiry: "INQ-2026-0999-x" }] });
  o({ subjects: [{ kind: "inquiry", inquiry: w.inquiry([w.Q]) }] });
  w.join(w.Q, "bob");
  o({ subjects: [{ kind: "outcome", determination: w.determine({ project: w.Q, outcomes: [{ standard: "S", outcome: "noncompliant" }] }), standard: "S" }] });
  o({ subjects: [{ kind: "inquiry", inquiry: w.inquiry([w.P], "dismissed") }] });
  const old = w.determine({ project: w.P, outcomes: [{ standard: "S", outcome: "noncompliant" }] });
  w.supersede(old, w.D);
  o({ subjects: [{ kind: "outcome", determination: old, standard: "S" }] });
  const opened1 = o();
  assert.equal(opened1.ok, true);
  w.PL = opened1.id;
  o();
  /* R4: matters added and removed */
  const sub = (kind, extra) => keep(w.ap[kind === "add" ? "planSubjectAdd" : "planSubjectRemove"]({ plan: w.PL, reason: "r", ...by("bob"), ...extra }));
  sub("add", { subject: w.S2, reason: "" }); sub("add", { subject: w.S2, ...m }); sub("add", { subject: w.S2, plan: "PLN-2026-0999-plan" });
  sub("add", { subject: w.S2 }); sub("remove", { subject: w.S3 }); sub("remove", { subject: w.S2 });
  /* R9–R12: options */
  const add = (extra = {}) => keep(w.ap.optionAdd({ plan: w.PL, summary: "Write", category: "awareness", subjects: [w.S1], ...by("bob"), ...extra }));
  add(m); add({ summary: "" }); add({ detail: "x".repeat(5001) }); add({ category: "x" }); add({ subjects: [] }); add({ subjects: [w.S3] });
  add({ addressee: { state: "named", name: "A Person" } }); add({ addressee: { state: "named", kind: "press", role: "", organisation: "" } }); add({ dates: [{ date: "2026-13-01", basis: "b" }] }); add({ tier: 1 });
  add({ category: "legal", tier: 9 }); add({ lobbying: true }); add({ budget: 1 }); add({ ...by("carol") });
  const a = add({ subjects: [w.SI, w.S1], addressee: OFFICE, dates: [{ date: "2026-09-01", basis: "the order" }] }).option;
  const b = add({ subjects: [w.SI], addressee: OFFICE, lobbying: true, enforces: w.S1 }).option;
  keep(w.ap.optionRevise({ plan: w.PL, option: "opt-99", reason: "r", ...by("bob") }));
  /* R11, R31: proposals */
  const prop = (extra = {}) => w.ap.optionPropose({ plan: w.PL, summary: "P", category: "other", subjects: [w.S1], why: "w", ...by("bob"),
                                                    proposer: V("bob"), ...extra }).then(keep);
  await prop({ proposer: undefined }); await prop({ why: "" }); await prop({ produced_by: "not a list" });
  const p = await prop();
  keep(w.ap.optionAdopt({ proposal: "PLN-x/proposal/9", ...by("bob") }));
  keep(w.ap.optionAdopt({ proposal: p.proposal.id, ...by("bob") }));
  keep(w.ap.optionAdopt({ proposal: p.proposal.id, ...by("bob") }));
  const machine = (run, extra = {}) => prop({ proposer: AGENT, principal: RUN_PRINCIPAL, viewer: MACHINE, run, sources: [w.D], ...extra });
  const { run } = w.openRun({ plan: w.PL, project: w.P, proposals: 1 });
  await machine(undefined);
  w.runs.get(run).status = "stopped"; await machine(run); w.runs.get(run).status = "running";
  await machine(w.openRun({ plan: w.PL, project: w.P, mode: "check" }).run);
  await machine(run, { sources: [] }); await machine(run, { sources: ["CONF-2026-0999-x"] });
  const mp = await machine(run);
  assert.equal(mp.ok, true, JSON.stringify(mp));
  await machine(run);
  keep(w.ap.optionAdopt({ proposal: mp.proposal.id, ...by("bob") }));
  /* R13, R29: dispositions */
  const dispose = (extra) => keep(w.ap.optionDispose({ plan: w.PL, options: [a], disposition: "chosen", ...by("bob"), ...extra }));
  dispose(m); dispose({ disposition: "maybe" }); dispose({ options: [] }); dispose({ options: ["opt-99"] }); dispose({ disposition: "declined" });
  dispose({});
  /* R14–R16: scenarios and checkpoints */
  const set = (phases, extra = {}) => keep(w.ap.scenarioSet({ plan: w.PL, scenario: 1, name: "S", phases, ...by("bob"), ...extra }));
  const ph = (extra = {}) => ({ id: "p", name: "P", options: [a], starts: "plan_start", ...extra });
  set([ph()], m); set([ph()], { scenario: 0 }); set([ph()], { name: "" }); set([]);
  for (const bad of [{ id: "" }, { name: "" }, { options: "x" }, { starts: "whenever" },
                     { starts: { when_subject: { kind: "wish" }, reaches: "resolved" } },
                     { starts: { when_subject: w.S1, reaches: "stage" } }, { starts: { when_subject: w.S1, reaches: "resolved", stage: 2 } },
                     { checkpoint: { after_days: 0 } }, { condition: "" }, { branches: { met: "p" } }, { branches: { maybe: "p" }, checkpoint: { after_days: 1 } }])
    set([ph(bad)]);
  set([ph(), ph({ id: "p" })]);
  set([ph({ options: [b] })]);
  set([ph(), { id: "q", name: "Q", options: [], starts: { after: "nope" } }]);
  set([ph(), { id: "q", name: "Q", options: [], starts: { when_subject: w.S3, reaches: "resolved" } }]);
  set([ph(), { id: "q", name: "Q", options: [], starts: { branch_of: "p", when: "met" } }]);
  set([ph({ checkpoint: { after_days: 1 }, branches: { met: "nope" } })]);
  set([{ id: "x", name: "X", options: [], starts: { after: "y" } }, { id: "y", name: "Y", options: [], starts: { after: "x" } }]);
  set([ph({ checkpoint: { after_days: 1 }, condition: "They answered" }),
       { id: "q", name: "Q", options: [], starts: { when_subject: w.S1, reaches: "stage", stage: 5 }, checkpoint: { after_days: 1 } }]);
  const judge = (extra) => keep(w.ap.checkpointRecord({ plan: w.PL, scenario: 1, phase: "p", judged: "met", ...by("bob"), ...extra }));
  judge(m); judge({ scenario: 2 }); judge({ phase: "z" }); judge({ judged: "maybe" }); judge({ note: "x".repeat(501) });
  judge({}); judge({ phase: "q" });
  w.clock.now = new Date(Date.parse(w.clock.now) + 2 * DAY).toISOString().replace(/\.\d{3}Z$/, "Z");
  judge({}); judge({});
  set([ph({ checkpoint: { after_days: 1 } })], { scenario: 2 });
  /* R18, R37: starting, and its preview */
  const startArgs = (extra) => ({ plan: w.PL, option: a, kind: "other", ...by("bob"), why_first: "A deadline comes first", ...extra });
  /* R42: an outward step ahead of the documentation, with no reason given */
  keep(w.ap.optionStartPreview(startArgs({ why_first: undefined }))); keep(w.ap.optionStart(startArgs({ why_first: undefined })));
  for (const extra of [m, { option: "opt-99" }, { contact: "nobody" }, { kind: "summon_dragons" }, {}]) {
    keep(w.ap.optionStartPreview(startArgs(extra)));
    keep(w.ap.optionStart(startArgs(extra)));
  }
  keep(w.ap.optionStartPreview(startArgs({}))); keep(w.ap.optionStart(startArgs({})));
  keep(w.ap.optionStartPreview(startArgs({ option: b }))); keep(w.ap.optionStart(startArgs({ option: b })));
  /* R39, R40 (T45): scenarios set aside and restored, the plan paused and resumed */
  const aside = (kind, extra) => keep(w.ap[kind]({ plan: w.PL, scenario: 2, reason: "r", ...by("bob"), ...extra }));
  aside("scenarioSetAside", m); aside("scenarioSetAside", { scenario: 9 }); aside("scenarioRestore", {});
  aside("scenarioSetAside", {}); aside("scenarioSetAside", {});
  const pause = (kind, extra) => keep(w.ap[kind]({ id: w.PL, reason: "r", ...by("bob"), ...extra }));
  pause("planResume", {}); pause("planPause", { look_again: "soon" }); pause("planPause", m); pause("planPause", {});
  pause("planPause", {}); pause("planResume", {});
  /* R41: an offer the plan does not stand ready to make */
  keep(w.ap.optionAdopt({ plan: w.PL, offer: { subject: w.S2, kind: "chance_to_fix" }, ...by("bob") }));
  /* R30, R34: the run check and the tray */
  const check = w.reg.checks.find((c) => c.mode === "plan").fn;
  keep(check({ contextType: "project", contextId: w.Q, plan: w.PL, actor: V("bob"), viewer: V("bob") }));
  keep(w.ap.planProposals({ plan: w.PL, run: "RUN-404", viewer: V("bob") }));
  keep(w.ap.planProposals({ plan: w.PL, run, viewer: V("bob") }));
  /* R21: the project's kinds of work */
  keep(w.reviseProject(w.P, "Budget watch", ["work_kinds: [reporting, lobbying]"], V("alice")));
  keep(w.reviseProject(w.P, "Budget watch", ["work_kinds: [reporting]"], MACHINE));
  /* R27: the plan's record, written outside its acts, and one that cannot be extended in place */
  const head = w.record.head(w.PL);
  const raw = (author) => keep(w.promotion.promote({ bundleId: w.PL, base: head.bundleSha, snapKey: `raw-${author}`, author,
    files: [{ path: "bundle.md", text: w.text(w.PL) + "\nedited\n" }], meta: { object_type: "action_plan" } }));
  raw(MACHINE); raw(V("bob"));
  /* R6–R8, R19, R32, R35: the reads, with checks, liveness, support and the disclosure all answering */
  w.setInquiryState(w.I, "concluded");
  w.standard("STD-2026-0001-a");
  keep(w.ap.planRead({ id: w.PL, viewer: V("bob") }));
  keep(w.ap.planRead({ id: w.PL, viewer: V("dave") }));
  keep(w.ap.plansFor({ viewer: V("bob") }));
  keep(w.ap.checkpointsDue({}));
  /* R20: closing, then every act a closed plan refuses */
  keep(w.ap.planClose({ id: w.PL, reason: "done", ...m }));
  keep(w.ap.planClose({ id: w.PL, reason: "done", note: "x".repeat(4001), ...by("bob") }));
  keep(w.ap.planClose({ id: w.PL, ...by("bob") }));
  keep(w.ap.planClose({ id: w.PL, reason: "done", ...by("bob") }));
  keep(w.ap.planClose({ id: w.PL, reason: "done", ...by("bob") }));
  /* the record's own refusal of an act that cannot extend the plan's document (R27): a plan whose log section is gone */
  const w2 = seeded();
  opened(w2);
  const text = w2.text(w2.PL).replace("## Plan Log", "## Not The Log");
  w2.record.transact(() => w2.record.commit({ bundleId: w2.PL, type: "action_plan", title: w2.PL, project: null, snapKey: "broken",
    kind: "promotion", base: w2.record.head(w2.PL).bundleSha, author: V("bob"), writer: null, operation: null,
    files: [{ path: "bundle.md", text, sha256: "0".repeat(64), bytes: text.length }], state: "open", priorState: null,
    group: "test-group", created: w2.clock.now, lastUpdated: w2.clock.now, criticality: null, at: w2.clock.now }));
  keep(w2.ap.planSubjectAdd({ plan: w2.PL, subject: w2.S2, reason: "r", ...by("bob") }));
  /* a provider this host was not given */
  const w3 = seeded({ omit: ["conformance"] });
  keep(w3.ap.planOpen({ project: w3.P, subjects: [w3.S1], title: "t", ...by("bob") }));

  /* Every code this module mints was answered here, but the one no act can reach: PLAN_HISTORY_REWRITTEN guards the log
     against an act that rewrote it, and every act only appends (R27's own test). Its translation is read above. */
  const codes = new Set(said.flatMap((r) => { const out = []; const walk = (x) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") { if (x.ok === false && typeof x.code === "string") out.push(x.code); Object.values(x).forEach(walk); }
  }; walk(r); return out; }));
  const unreached = Object.keys(ACTION_PLAN_CHECKS).filter((c) => !codes.has(c));
  assert.deepEqual(unreached, ["PLAN_HISTORY_REWRITTEN"]);
  /* the reads answered their sentences: checks, liveness, the disclosure, the preview */
  const all = sentences(said).map(([, s]) => s).join("\n");
  const SUGGESTED = DISCLOSURE("RUN", "planning@1").split(" in run")[0];
  for (const words of ["no longer live", "suspected matter", SUGGESTED, "a check informs", "a preview of starting",
                       "when_subject names a matter of the plan", "that matter is not one the plan is about"])
    assert.ok(all.includes(words), words);
  assert.deepEqual(offending(said), [], "no member-facing sentence calls a matter a subject");
  /* the internal names stay: keys, codes, states and ops */
  const read = said.find((r) => r && r.ok === true && Array.isArray(r.subjects) && r.history);
  assert.ok(read.subjects.every((s) => "subject" in s));
  assert.ok(read.options.some((x) => x.subjects_liveness.some((l) => l.liveness.state !== undefined)));
  assert.ok(codes.has("PLAN_NO_SUBJECT") && codes.has("SUBJECT_MALFORMED") && codes.has("OPTION_NO_SUBJECT"));
  assert.ok(read.history.some((h) => h.kind === "subject_add") && read.history.some((h) => h.kind === "subject_remove"));
  const ops = Object.keys(actionPlansOps(w.ap, new URL("https://plane.test/"), {}));
  assert.ok(ops.includes("plansubjectadd") && ops.includes("plansubjectremove"));
});
