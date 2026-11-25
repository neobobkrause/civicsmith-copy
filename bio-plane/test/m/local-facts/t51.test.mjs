/* local-facts, T51 (T51-158; N858 D8; DEC-340, DEC-341): what a drafted rule is made of (R18: `ruleFields`, the
   `effective_from` date a member-drafted rule carries) and what a group rule's row says it is for (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, sha, TP, MACHINE } from "./fixture.mjs";
import { LOCAL_FACTS_CHECKS, RULE_FIELDS, localFactsOps } from "../../../src/local-facts/index.mjs";
import { combine, validate, LEGAL_FACT_TRIGGERS, STARTS, COUNTS, UNITS, DIRECTIONS, OWED_BY } from "../../../../jurisdictions/index.mjs";

const DL = { rule: "group_answer", applies_to: "records_request", units: "days", amount: 7, starts: "received", citation: "Test Bylaw § 9", effective_from: "2026-09-01" };
const DL1 = { rule: "group_notice", applies_to: "bylaw_complaint", units: "days", amount: 3, starts: "act", citation: "Test Bylaw § 10", effective_from: "2026-09-01" };
const DLC = { rule: "group_claim", applies_to: "claim", units: "days", amount: 30, starts: "known", citation: "Test Bylaw § 11", effective_from: "2026-09-01" };
const LF = { key: "group_recording", trigger: "recording", statement: "Recording a sitting needs the chair's leave.", citation: "Test Bylaw § 12", effective_from: "2026-09-01" };
const QUAL = "Zephyrine counsel of twelve years, practising in local government law";
const url = (q) => new URL(`https://plane.example/?${q}`);

function setup(opts) {
  const w = world(opts);
  const src = { captureSha: w.held("INFO-2026-0001", sha("the bylaw")), extent: { kind: "document" } };
  const draft = (entry = DL, extra = {}) => w.lf.ruleDraft({ section: "deadlines", entry, source: src, reason: "the bylaw's own text",
                                                            by: V("bob"), viewer: V("bob"), ...extra });
  const confirm = (rule, extra = {}) => w.lf.ruleConfirm({ rule, by: V("carol"), viewer: V("carol"), ...extra });
  return { w, src, draft, confirm };
}

/* a profile holding one entry of a section alone, over the test profile's own kinds, as `ruleDraft` validates it */
function validates(section, entry) {
  const { effective_from: _from, ...own } = entry;
  const kinds = combine([TP]).view.action_kinds.map((k) => ({ kind: k.kind, label: k.label, tier: k.tier, basis: "TEST" }));
  return validate({ id: "group-rule", name: "Rule", covers: ["the team"], test: true, action_kinds: kinds,
                    [section]: [{ ...own, status: "researched", basis: "TEST" }] });
}

const SECTIONS = { deadlines: DL, legal_facts: LF };

test("R18 ruleFields answers each section's fields in jurisdictions' order, each {field, required, kind, choices?}, effective_from last", () => {
  const { w } = setup();
  const d = w.lf.ruleFields({ section: "deadlines", viewer: V("bob") });
  assert.equal(d.ok, true);
  assert.deepEqual(d.fields.map((f) => [f.field, f.required, f.kind]), [
    ["rule", true, "text"], ["applies_to", true, "choice"], ["units", true, "choice"], ["amount", true, "number"],
    ["count", false, "choice"], ["direction", false, "choice"], ["starts", true, "choice"], ["owed_by", false, "choice"],
    ["due_at", false, "text"], ["citation", true, "text"], ["effective_from", true, "date"]]);
  const l = w.lf.ruleFields({ section: "legal_facts", viewer: V("bob") });
  assert.deepEqual(l.fields.map((f) => [f.field, f.required, f.kind]), [
    ["key", true, "text"], ["trigger", true, "choice"], ["statement", true, "text"], ["citation", true, "text"],
    ["applies_to", false, "choice"], ["effective_from", true, "date"]]);
  assert.deepEqual([d.count, l.count], [d.fields.length, l.fields.length]);
  /* only a choice carries choices */
  for (const f of [...d.fields, ...l.fields]) assert.equal("choices" in f, f.kind === "choice", f.field);
  /* the same through the ops arm, `section` the query's and `viewer` the URL's */
  assert.deepEqual(localFactsOps(w.lf, url("section=deadlines&viewer=member%3Abob"), null).rulefields(), d);
  assert.deepEqual(localFactsOps(w.lf, url("section=legal_facts&viewer=member%3Abob"), { viewer: "nobody" }).rulefields(), l);
});

test("R18 every choices list equals the vocabulary it names; applies_to's are the active view's kinds (a deadline's also claim)", () => {
  const { w } = setup();
  const by = (section) => Object.fromEntries(w.lf.ruleFields({ section, viewer: V("bob") }).fields.map((f) => [f.field, f]));
  const d = by("deadlines"), l = by("legal_facts");
  const kinds = combine([TP]).view.action_kinds.map((k) => k.kind);
  assert.deepEqual(d.units.choices, [...UNITS]);
  assert.deepEqual(d.count.choices, [...COUNTS]);
  assert.deepEqual(d.direction.choices, [...DIRECTIONS]);
  assert.deepEqual(d.starts.choices, ["received", "filed", "act", "known", "entered", "served", "hearing"], "K3997: the design's seven");
  assert.deepEqual(d.starts.choices, STARTS.filter((x) => x !== "third_party"), "every start but third_party, which needs a starter no field draws");
  assert.deepEqual(d.owed_by.choices, [...OWED_BY]);
  assert.deepEqual(l.trigger.choices, [...LEGAL_FACT_TRIGGERS]);
  assert.deepEqual(d.applies_to.choices, ["claim", ...kinds]);
  assert.deepEqual(l.applies_to.choices, kinds);
  assert.equal(l.applies_to.many, true, "a legal fact names a list of kinds");
  assert.equal("many" in d.applies_to, false);
  /* the negative control: the choices follow the active profiles, not a fixed list */
  const none = world({ profiles: [] });
  assert.deepEqual(none.lf.ruleFields({ section: "deadlines", viewer: V("bob") }).fields.find((f) => f.field === "applies_to").choices, ["claim"]);
  /* a copy: changing an answer changes no later one */
  d.units.choices.push("weeks");
  assert.deepEqual(by("deadlines").units.choices, [...UNITS]);
  assert.ok(Object.isFrozen(RULE_FIELDS) && Object.isFrozen(RULE_FIELDS.deadlines));
});

test("R18 for each section an entry holding every required field validates through jurisdictions.validate, and one lacking a required field is refused by it", () => {
  const { w } = setup();
  for (const [section, entry] of Object.entries(SECTIONS)) {
    const fields = w.lf.ruleFields({ section, viewer: V("bob") }).fields;
    const required = fields.filter((f) => f.required).map((f) => f.field);
    assert.deepEqual(required.slice().sort(), Object.keys(entry).sort().filter((k) => required.includes(k)).sort(), `${section}: the fixture holds every required field`);
    assert.equal(validates(section, entry).ok, true, JSON.stringify(validates(section, entry).errors));
    for (const field of required.filter((f) => f !== "effective_from")) {
      const { [field]: _gone, ...lacking } = entry;
      assert.equal(validates(section, lacking).ok, false, `${section} lacking ${field}`);
    }
    /* the control: no field of the table is one validate would refuse, every optional one given a value it takes */
    for (const f of fields) assert.ok(["text", "number", "date", "choice"].includes(f.kind), f.field);
  }
  const optional = { ...DL, count: "calendar", direction: "forward", owed_by: "group", due_at: "17:00" };
  assert.equal(validates("deadlines", optional).ok, true, JSON.stringify(validates("deadlines", optional).errors));
  assert.equal(validates("legal_facts", { ...LF, applies_to: ["bylaw_complaint"] }).ok, true);
  /* and every field of the table is one validate knows: a value from its choices is never refused for being unknown */
  for (const section of Object.keys(SECTIONS)) for (const f of w.lf.ruleFields({ section, viewer: V("bob") }).fields) {
    if (f.kind !== "choice" || f.field === "applies_to" || f.field === "starts") continue;
    for (const c of f.choices) {
      const entry = { ...SECTIONS[section], [f.field]: c };
      const v = validates(section, entry);
      assert.ok(v.ok || !v.errors.some((e) => e.path.endsWith(`.${f.field}`) && /UNKNOWN/.test(e.code)), `${section}.${f.field}=${c}`);
    }
  }
});

test("R18 an unknown section is RULE_SECTION_UNKNOWN through R17's one site; a viewer naming no member is answered none; it writes nothing and never throws", () => {
  const { w, draft } = setup();
  const before = w.rows(`SELECT COUNT(*) AS n FROM local_rule_acts`)[0].n;
  for (const section of ["weather", "holidays", undefined, null, 3]) {
    const r = w.lf.ruleFields({ section, viewer: V("bob") });
    assert.equal(r.code, "RULE_SECTION_UNKNOWN");
    assert.equal(r.check, LOCAL_FACTS_CHECKS.RULE_SECTION_UNKNOWN.check);
    assert.equal(r.translation, LOCAL_FACTS_CHECKS.RULE_SECTION_UNKNOWN.translation);
  }
  assert.deepEqual(w.lf.ruleFields({ section: "weather", viewer: V("bob") }), w.lf.ruleDraft({ section: "weather", entry: DL, source: null, reason: "r", by: V("bob") }),
                   "the same refusal a draft answers");
  for (const viewer of ["nobody", "class:ai", undefined]) assert.deepEqual(w.lf.ruleFields({ section: "deadlines", viewer }), { ok: true, section: "deadlines", fields: [], count: 0 });
  assert.doesNotThrow(() => w.lf.ruleFields());
  assert.doesNotThrow(() => w.lf.ruleFields(null));
  const broken = world();
  broken.lf.combine = () => { throw new Error("boom"); };
  assert.doesNotThrow(() => broken.lf.ruleFields({ section: "deadlines", viewer: V("bob") }));
  assert.equal(broken.lf.ruleFields({ section: "deadlines", viewer: V("bob") }).ok, true);
  draft();
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM local_rule_acts`)[0].n, before + 1, "only the draft wrote");
});

test("R18 effective_from: a draft without a valid day is RULE_ENTRY_INVALID naming the field, writing nothing; a valid one is kept on the rule", () => {
  const { w, draft } = setup();
  const n = () => w.rows(`SELECT COUNT(*) AS n FROM local_rule_acts`)[0].n;
  const { effective_from: _from, ...lacking } = DL;
  for (const bad of [lacking, { ...DL, effective_from: "" }, { ...DL, effective_from: "2026-02-30" }, { ...DL, effective_from: "1 Sept 2026" },
                     { ...DL, effective_from: 20260901 }, { ...DL, effective_from: null }]) {
    const r = draft(bad);
    assert.equal(r.code, "RULE_ENTRY_INVALID", JSON.stringify(bad.effective_from));
    assert.deepEqual(r.errors.map((e) => [e.path, e.code]), [["deadlines[0].effective_from", "VALUE_INVALID"]]);
  }
  const l = w.lf.ruleDraft({ section: "legal_facts", entry: (({ effective_from, ...e }) => e)(LF), source: { captureSha: sha("x"), extent: {} }, reason: "r", by: V("bob") });
  assert.equal(l.code, "RULE_ENTRY_INVALID");
  assert.deepEqual(l.errors.map((e) => e.path), ["legal_facts[0].effective_from"]);
  assert.equal(n(), 0, "nothing written");
  /* the control: with a valid day it is drafted, and the day is the rule's own */
  const ok = draft(DL);
  assert.equal(ok.ok, true);
  assert.equal(w.lf.groupRules({ viewer: V("bob") }).rules[0].entry.effective_from, "2026-09-01");
  /* an entry's other errors are reported beside it, in the entry's order of path */
  const both = draft({ ...DL, rule: "other", units: "weeks", effective_from: "soon" });
  assert.deepEqual(both.errors.map((e) => e.path).sort(), ["deadlines[0].effective_from", "deadlines[0].units"]);
});

test("R18 a rule is listed and never applied before its effective_from, from that local day in the view's zone it joins governingView without the field", () => {
  const { w, draft, confirm } = setup();
  const base = combine([TP]);
  const r = draft({ ...DL, effective_from: "2026-10-05" }).rule;
  confirm(r, { statement: QUAL });
  /* 2026-09-28 now: confirmed, listed, not applied */
  assert.equal(w.lf.groupRules({ viewer: V("dan") }).rules[0].state, "confirmed");
  assert.deepEqual(w.lf.governingView(), base);
  /* the day before in the zone (Halifax, UTC-3 in ADT): 2026-10-05T02:59Z is still 2026-10-04 local */
  w.at("2026-10-05T02:59:00Z");
  assert.deepEqual(w.lf.governingView(), base, "not yet, by the zone's local day");
  w.at("2026-10-05T03:00:00Z");
  const gv = w.lf.governingView();
  const added = gv.view.deadlines.at(-1);
  assert.equal(added.rule, DL.rule);
  assert.equal(added.profile, "group");
  assert.equal("effective_from" in added, false, "a profile's entry carries none");
  /* the control: a rule effective on the local day itself (2026-09-27 in Halifax at 01:00Z) is applied at once */
  const { w: w2, draft: d2, confirm: c2 } = setup();
  c2(d2({ ...DL, effective_from: "2026-09-27" }).rule, { statement: QUAL });
  assert.equal(w2.lf.governingView().view.deadlines.at(-1).profile, "group");
  /* the offer carries the entry as drafted, the day included, and nothing about the statement */
  const offer = w.lf.ruleOffer({ rule: r, viewer: V("dan") });
  assert.equal(offer.offer.entry.effective_from, "2026-10-05");
  assert.equal(JSON.stringify(offer).includes(QUAL), false);
});

test("R19 each row of groupRules says what it is for: applies_to, tier of that kind in the active view (or null), and source {captureSha, extent}", () => {
  const { w, src, draft, confirm } = setup();
  const t2 = draft(DL).rule, t1 = draft(DL1).rule, claim = draft(DLC).rule;
  const lf = w.lf.ruleDraft({ section: "legal_facts", entry: { ...LF, applies_to: ["bylaw_complaint", "commitment_claim"] }, source: src,
                              reason: "the bylaw", by: V("bob"), viewer: V("bob") }).rule;
  const lfNone = w.lf.ruleDraft({ section: "legal_facts", entry: { ...LF, key: "no_kind" }, source: src, reason: "the bylaw", by: V("bob"), viewer: V("bob") }).rule;
  const rows = Object.fromEntries(w.lf.groupRules({ viewer: V("dan") }).rules.map((x) => [x.rule, x]));
  assert.deepEqual([rows[t2].applies_to, rows[t2].tier], ["records_request", 2], "a deadline for a Tier 2 kind");
  assert.deepEqual([rows[t1].applies_to, rows[t1].tier], ["bylaw_complaint", 1]);
  assert.deepEqual([rows[claim].applies_to, rows[claim].tier], ["claim", null], "a claim has no tier");
  assert.deepEqual([rows[lf].applies_to, rows[lf].tier], [["bylaw_complaint", "commitment_claim"], 3], "a legal fact's highest tier");
  assert.deepEqual([rows[lfNone].applies_to, rows[lfNone].tier], [null, null], "a rule naming no kind");
  for (const x of Object.values(rows)) assert.deepEqual(x.source, src.captureSha ? { captureSha: src.captureSha.toLowerCase(), extent: { kind: "document" } } : null);
  /* a kind the active view does not hold has no tier */
  const other = world({ profiles: [] });
  assert.equal(other.lf.groupRules({ viewer: V("dan") }).rules.length, 0);
  const lone = setup({ profiles: [TP] });
  lone.w.lf.combine = () => ({ ok: false, errors: [] });
  assert.deepEqual(lone.w.lf.groupRules({ viewer: V("dan") }).rules.map((x) => x.tier), []);
  /* the row follows the view: the same rule reads another tier once the active profiles say so */
  confirm(t2, { statement: QUAL });
  assert.equal(w.lf.groupRules({ viewer: V("dan") }).rules.find((x) => x.rule === t2).tier, 2);
});

test("R19 the confirmer's statement is in no other read, and no row of a viewer naming no member; R12's existing rows are unchanged", () => {
  const { w, draft, confirm } = setup();
  const r = draft(DL).rule;
  confirm(r, { statement: QUAL });
  const row = w.lf.groupRules({ viewer: V("dan") }).rules[0];
  assert.equal(row.statement, QUAL, "answered with the rule, to a member");
  assert.deepEqual(Object.keys(row).sort(), ["applies_to", "confirmed_at", "confirmer", "drafted_at", "drafter", "entry", "reason", "rule", "section", "source", "state", "statement", "tier"]);
  for (const viewer of ["nobody", "class:ai", undefined]) assert.deepEqual(w.lf.groupRules({ viewer }), { ok: true, rules: [], count: 0 });
  const other = [w.lf.governingView(), w.lf.ruleOffer({ rule: r, viewer: V("dan") }), w.lf.factStatus({ viewer: V("dan") }), w.lf.factsDue({ viewer: V("dan") }),
                 w.lf.ruleFields({ section: "deadlines", viewer: V("dan") }), w.lf.ruleFields({ section: "legal_facts", viewer: V("dan") }),
                 w.lf.groupRules({ viewer: V("dan"), member: V("carol") }).rules.map(({ statement, ...x }) => x)];
  assert.equal(JSON.stringify(other).includes(QUAL), false);
  assert.equal(w.lf.groupRules({ viewer: V("dan") }).rules[0].confirmer, V("carol"));
  /* a machine's draft writes nothing, so no row appears */
  assert.equal(draft(DL, { by: MACHINE }).code, "MACHINE_CANNOT_DRAFT_RULE");
});
