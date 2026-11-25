/* local-facts: the group's own jurisdiction rules (R10–R14, T45): drafted from a held primary source, confirmed by
   another member (a professional's statement for Tier 2, 3 or undetermined), applied in `governingView`, withdrawn,
   offered. Sources are captures the real provenance and content hold (the fixture's `held`). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, sha, TP } from "./fixture.mjs";
import { LOCAL_FACTS_CHECKS, RULE_SECTIONS, RULE_STATES, GROUP_PROFILE, localFactsOps }
  from "../../../src/local-facts/index.mjs";
import { combine, validate, LEGAL_FACT_TRIGGERS, STARTS, COUNTS, UNITS, DIRECTIONS, OWED_BY } from "../../../../jurisdictions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const row = (r, code) => {
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, code);
  assert.equal(r.code, code);
  assert.equal(r.check, LOCAL_FACTS_CHECKS[code].check);
  assert.equal(r.translation, LOCAL_FACTS_CHECKS[code].translation);
};
/* Tier 2 (records_request), Tier 1 (bylaw_complaint) and a claim (undetermined) deadline; a legal fact. */
const DL = { rule: "group_answer", applies_to: "records_request", units: "days", amount: 7, starts: "received", citation: "Test Bylaw § 9", effective_from: "2026-09-01" };
const DL1 = { rule: "group_notice", applies_to: "bylaw_complaint", units: "days", amount: 3, starts: "act", citation: "Test Bylaw § 10", effective_from: "2026-09-01" };
const DLC = { rule: "group_claim", applies_to: "claim", units: "days", amount: 30, starts: "known", citation: "Test Bylaw § 11", effective_from: "2026-09-01" };
const LF = { key: "group_recording", trigger: "recording", statement: "Recording a sitting needs the chair's leave.", citation: "Test Bylaw § 12", effective_from: "2026-09-01" };
/* a rule's entry as a profile holds it: a profile's entry carries no effective_from (R18) */
const profileEntry = ({ effective_from: _from, ...e }) => e;
const QUAL = "Zephyrine counsel of twelve years, practising in local government law";   // a word no profile holds

function setup(opts) {
  const w = world(opts);
  const src = { captureSha: w.held("INFO-2026-0001", sha("the bylaw")), extent: { kind: "document" } };
  const draft = (entry = DL, extra = {}) => w.lf.ruleDraft({ section: "deadlines", entry, source: src, reason: "the bylaw's own text",
                                                            by: V("bob"), viewer: V("bob"), ...extra });
  const confirm = (rule, extra = {}) => w.lf.ruleConfirm({ rule, by: V("carol"), viewer: V("carol"), ...extra });
  const n = () => w.rows(`SELECT COUNT(*) AS n FROM local_rule_acts`)[0].n;
  return { w, src, draft, confirm, n };
}

test("R10 a member drafts a rule from its primary source, answered {ok, rule, state: drafted}; each refusal in order writes nothing, each with its negative control", () => {
  const { w, src, draft, n } = setup();
  /* MACHINE_CANNOT_DRAFT_RULE first: a machine, an unstamped `by`, before even an unknown section */
  for (const by of [MACHINE, "", undefined]) row(draft(DL, { by, section: "weather" }), "MACHINE_CANNOT_DRAFT_RULE");
  /* RULE_SECTION_UNKNOWN before the entry */
  for (const section of ["weather", "holidays", undefined, 3]) row(draft({}, { section }), "RULE_SECTION_UNKNOWN");
  /* RULE_ENTRY_INVALID with validate's errors, before the source */
  let r = draft({ ...DL, units: "weeks" }, { source: null });
  row(r, "RULE_ENTRY_INVALID");
  assert.deepEqual(r.errors.map((e) => [e.path, e.code]), [["deadlines[0].units", "UNIT_UNKNOWN"]]);
  r = draft({ ...DL, applies_to: "no_such_kind" });
  row(r, "RULE_ENTRY_INVALID");
  assert.equal(r.errors[0].code, "DEADLINE_KIND_UNKNOWN");
  row(draft("not an entry"), "RULE_ENTRY_INVALID");
  row(w.lf.ruleDraft({ section: "legal_facts", entry: { ...LF, trigger: "gossip" }, source: src, reason: "x", by: V("bob") }), "RULE_ENTRY_INVALID");
  /* RULE_NO_SOURCE: none, malformed, a capture not held, an extent the capture cannot hold (content's refusal) */
  for (const source of [undefined, null, {}, { captureSha: "abc", extent: { kind: "document" } }, { captureSha: src.captureSha },
                        { captureSha: sha("never held"), extent: { kind: "document" } }])
    row(draft(DL, { source, entry: { ...DL, rule: "records_answer" } }), "RULE_NO_SOURCE");
  r = draft(DL, { source: { ...src, extent: { kind: "pdf-page", page: 3 } } });
  row(r, "RULE_NO_SOURCE");
  assert.equal(r.source_code, "CONTENT_EXTENT_NO_CHAIN", "content's own extent refusal, named");
  row(draft(DL, { source: { ...src, extent: { kind: "nonsense" } } }), "RULE_NO_SOURCE");
  /* RULE_IN_PROFILE against the test profile, before the reason, naming the entry it already holds */
  r = draft({ ...DL, rule: "records_answer" }, { reason: "" });
  row(r, "RULE_IN_PROFILE");
  assert.deepEqual(r.held, { section: "deadlines", rule: "records_answer", applies_to: "records_request", profile: TP });
  r = w.lf.ruleDraft({ section: "legal_facts", entry: { ...LF, key: "sitting_recordings" }, source: src, reason: "", by: V("bob") });
  row(r, "RULE_IN_PROFILE");
  assert.deepEqual(r.held, { section: "legal_facts", key: "sitting_recordings", profile: TP });
  /* NO_REASON: none, blank, over 500 characters */
  for (const reason of [undefined, "  ", "x".repeat(501)]) row(draft(DL, { reason }), "RULE_NO_REASON");
  assert.equal(n(), 0, "no refusal wrote anything");
  /* the controls: each lands */
  assert.deepEqual(draft(DL, { reason: "x".repeat(500) }), { ok: true, rule: "GR-1", state: "drafted", at: "2026-09-28T01:00:00Z" });
  assert.equal(w.lf.ruleDraft({ section: "legal_facts", entry: LF, source: src, reason: "the bylaw", by: V("bob"), viewer: V("bob") }).rule, "GR-2");
  assert.equal(draft({ ...DL, rule: "other_answer" }, { source: { captureSha: src.captureSha.toUpperCase(), extent: { kind: "document" } } }).ok, true,
               "a capture sha in any case names the capture");
  assert.equal(n(), 3);
  /* the entry is kept as drafted, its basis and status supplied here, never the member's */
  const drafted = draft({ ...DL, rule: "with_basis", basis: "M-1", status: "ruled" });
  const kept = w.lf.groupRules({ viewer: V("bob") }).rules.find((x) => x.rule === drafted.rule);
  assert.deepEqual(kept.entry, { ...DL, rule: "with_basis" });
  assert.deepEqual(kept.source, { captureSha: src.captureSha, extent: { kind: "document" } });
});

test("R10 an unseen capture is answered as absent: a source homed in a hidden project the drafter is not in is RULE_NO_SOURCE, as one never held", () => {
  const { w, draft } = setup();
  const hidden = w.project("PROJ-2026-0001", "carol");
  const s = w.held("INFO-2026-0002", sha("hidden source"), { project: hidden });
  const unseen = draft(DL, { source: { captureSha: s, extent: { kind: "document" } } });
  const never = draft(DL, { source: { captureSha: sha("never"), extent: { kind: "document" } } });
  row(unseen, "RULE_NO_SOURCE");
  assert.equal(unseen.detail, never.detail, "the same answer as a capture never held");
  /* the negative control: the participant drafts from it */
  assert.equal(draft(DL, { by: V("carol"), viewer: V("carol"), source: { captureSha: s, extent: { kind: "document" } } }).ok, true);
});

test("R11 a member other than the drafter confirms; refusals in order (machine, no such rule, self-confirmation, not drafted, qualification), each with a control", () => {
  const { w, draft, confirm, n } = setup();
  const r1 = draft().rule;                         // Tier 2
  const before = n();
  for (const by of [MACHINE, "", undefined]) row(confirm("GR-99", { by }), "MACHINE_CANNOT_CONFIRM");
  for (const rule of ["GR-99", "GR-0", "gr-1", "", undefined, 7]) row(confirm(rule), "NO_SUCH_GROUP_RULE");
  row(confirm(r1, { viewer: "nobody" }), "NO_SUCH_GROUP_RULE");
  /* a self-confirmation refused, in either spelling of the same member, with a statement or without */
  row(confirm(r1, { by: V("bob"), viewer: V("bob"), statement: QUAL }), "RULE_SELF_CONFIRM");
  const founder = draft({ ...DL, rule: "founders" }, { by: "admin", viewer: "admin" }).rule;
  row(confirm(founder, { by: "member:admin", viewer: "member:admin", statement: QUAL }), "RULE_SELF_CONFIRM");
  /* a Tier 2 rule without the statement refused: none, blank, over 500 characters */
  for (const statement of [undefined, "   ", "q".repeat(501)]) row(confirm(r1, { statement }), "RULE_NEEDS_QUALIFICATION");
  assert.equal(n(), before + 1, "only the founder's draft was written");
  /* the control: with the statement it is confirmed */
  assert.deepEqual(confirm(r1, { statement: QUAL }), { ok: true, rule: r1, state: "confirmed", at: "2026-09-28T01:00:00Z", tier: 2, with_statement: true });
  /* RULE_NOT_DRAFTED: confirmed, or withdrawn */
  row(confirm(r1, { by: V("dan"), viewer: V("dan"), statement: QUAL }), "RULE_NOT_DRAFTED");
  const gone = draft({ ...DL, rule: "gone" }).rule;
  w.lf.ruleWithdraw({ rule: gone, reason: "drafted in error", by: V("bob"), viewer: V("bob") });
  row(confirm(gone, { statement: QUAL }), "RULE_NOT_DRAFTED");
});

test("R11 the tier decides the statement: Tier 1 asks none and records none given; a claim rule and a legal fact naming no kind are undetermined and ask it", () => {
  const { w, src, draft, confirm } = setup();
  const t1 = draft(DL1).rule;
  assert.deepEqual(confirm(t1, { statement: QUAL }), { ok: true, rule: t1, state: "confirmed", at: "2026-09-28T01:00:00Z", tier: 1, with_statement: false });
  const stored = w.rows(`SELECT statement FROM local_rule_acts WHERE act='confirm'`);
  assert.deepEqual(stored, [{ statement: null }], "a Tier 1 rule's given statement is not recorded");
  assert.equal(w.lf.groupRules({ viewer: V("dan") }).rules[0].statement, undefined);
  assert.equal(w.lf.ruleOffer({ rule: t1, viewer: V("dan") }).offer.confirmed.with_statement, false);
  /* undetermined: a claim rule; a legal fact with no applies_to; one naming a kind without a tier is never Tier 1 */
  const claim = draft(DLC).rule;
  row(confirm(claim), "RULE_NEEDS_QUALIFICATION");
  assert.equal(confirm(claim).tier, null);
  const lf = (entry) => w.lf.ruleDraft({ section: "legal_facts", entry, source: src, reason: "the bylaw", by: V("bob"), viewer: V("bob") }).rule;
  const bare = lf(LF);
  row(confirm(bare), "RULE_NEEDS_QUALIFICATION");
  assert.equal(confirm(bare, { statement: QUAL }).tier, null);
  /* a legal fact naming only Tier 1 kinds is Tier 1; naming a Tier 3 kind among them, Tier 3 */
  assert.equal(confirm(lf({ ...LF, key: "t1_only", applies_to: ["bylaw_complaint", "recognition_letter"] })).tier, 1);
  const mixed = lf({ ...LF, key: "mixed", applies_to: ["bylaw_complaint", "commitment_claim"] });
  row(confirm(mixed), "RULE_NEEDS_QUALIFICATION");
  assert.equal(confirm(mixed, { statement: QUAL }).tier, 3);
  /* a kind's tier withheld as a conflict of the active profiles reads undetermined */
  const other = { id: "test-tier", name: "Tier", covers: ["Tier"], test: true,
    action_kinds: [{ kind: "bylaw_complaint", label: "Bylaw complaint", tier: 2, basis: "TEST" }] };
  const c = setup({ profiles: [TP, "test-tier"], own: [other] });
  const r = c.draft({ ...DL1, rule: "tier_conflict" }).rule;
  row(c.confirm(r), "RULE_NEEDS_QUALIFICATION");
  assert.equal(c.confirm(r, { statement: QUAL }).tier, null);
});

test("R11 R12 the statement is read by nothing else: only groupRules' read of the rule answers it; no view, offer, other read or member-keyed read carries it", () => {
  const { w, draft, confirm } = setup();
  const r = draft().rule;
  confirm(r, { statement: QUAL });
  /* R12's read of the rule answers it, to a viewer naming a member */
  const read = w.lf.groupRules({ viewer: V("dan") });
  assert.equal(read.rules[0].statement, QUAL);
  assert.equal(read.rules[0].confirmer, V("carol"));
  /* every other answer of the module, whole, never holds its words */
  const answers = [w.lf.governingView(), w.lf.ruleOffer({ rule: r, viewer: V("dan") }), w.lf.factStatus({ viewer: V("carol") }),
    w.lf.factsDue({ viewer: V("carol") }), w.lf.groupRules({ viewer: "nobody" }), w.lf.groupRules({ viewer: "class:ai" }),
    w.lf.groupRules({}), w.lf.ruleConfirm({ rule: r, by: V("dan"), viewer: V("dan"), statement: "x" }),
    w.lf.ruleWithdraw({ rule: "GR-99", reason: "x", by: V("dan"), viewer: V("dan") })];
  for (const a of answers) assert.ok(!JSON.stringify(a).includes("Zephyrine"), JSON.stringify(a).slice(0, 200));
  /* no read keyed by member: groupRules takes no member key, so asking by the confirmer answers every rule, never hers */
  const byMember = w.lf.groupRules({ viewer: V("dan"), member: V("carol"), by: V("carol"), confirmer: V("carol") });
  assert.deepEqual(byMember, read, "a member key is no filter: the same read of the group's rules");
  /* nothing counts statements */
  assert.equal(JSON.stringify(read).match(/statement/g).length, 1, "one rule, one statement field, no count");
});

test("R12 groupRules: every rule with state, source, drafter, confirmer and dates, to a viewer naming a member, by section", () => {
  const { w, src, draft, confirm } = setup();
  const a = draft().rule;
  const b = w.lf.ruleDraft({ section: "legal_facts", entry: LF, source: src, reason: "the bylaw", by: V("bob"), viewer: V("bob") }).rule;
  w.at("2026-10-02T12:00:00Z");
  confirm(a, { statement: QUAL });
  w.lf.ruleWithdraw({ rule: b, reason: "superseded", by: V("dan"), viewer: V("dan") });
  const all = w.lf.groupRules({ viewer: V("bob") });
  assert.equal(all.count, 2);
  assert.deepEqual(all.rules.map((x) => [x.rule, x.section, x.state]), [[a, "deadlines", "confirmed"], [b, "legal_facts", "withdrawn"]]);
  assert.deepEqual([all.rules[0].drafter, all.rules[0].drafted_at, all.rules[0].confirmer, all.rules[0].confirmed_at],
                   [V("bob"), "2026-09-28T01:00:00Z", V("carol"), "2026-10-02T12:00:00Z"]);
  assert.deepEqual(all.rules[1].withdrawn, { by: V("dan"), at: "2026-10-02T12:00:00Z", reason: "superseded" });
  assert.equal(all.rules[1].confirmer, null);
  assert.deepEqual(w.lf.groupRules({ section: "legal_facts", viewer: V("bob") }).rules.map((x) => x.rule), [b]);
  row(w.lf.groupRules({ section: "holidays", viewer: V("bob") }), "RULE_SECTION_UNKNOWN");
  /* a viewer naming no member sees none */
  for (const viewer of ["nobody", "class:ai", undefined]) assert.deepEqual(w.lf.groupRules({ viewer }), { ok: true, rules: [], count: 0 });
  assert.deepEqual([...RULE_SECTIONS], ["deadlines", "legal_facts"]);
  assert.deepEqual([...RULE_STATES], ["drafted", "confirmed", "withdrawn"]);
});

test("R12 governingView: combine's view with each confirmed, unwithdrawn group rule added, tagged profile group with a basis naming its id and day; none drafted or withdrawn; equal to combine's with none", () => {
  const { w, src, draft, confirm } = setup();
  const base = combine([TP]);
  assert.deepEqual(w.lf.governingView(), base, "no group rule: equal to combine's answer");
  const drafted = draft({ ...DL, rule: "only_drafted" }).rule;
  assert.deepEqual(w.lf.governingView(), base, "a drafted rule is not in it");
  const r = draft().rule;
  w.at("2026-11-02T03:30:00Z");                               // 2026-11-01 in the view's zone (UTC-4)
  confirm(r, { statement: QUAL });
  const f = w.lf.ruleDraft({ section: "legal_facts", entry: LF, source: src, reason: "the bylaw", by: V("bob"), viewer: V("bob") }).rule;
  confirm(f, { statement: QUAL });
  const gv = w.lf.governingView();
  assert.equal(gv.ok, true);
  assert.deepEqual(gv.view.deadlines.slice(0, -1), base.view.deadlines, "the profiles' entries unchanged, the rule added last");
  const added = gv.view.deadlines.at(-1);
  const { effective_from: _from, ...DLP } = DL;
  assert.deepEqual(added, { ...DLP, status: "researched", basis: `2026-11-01 ${r}`, profile: GROUP_PROFILE,
                            bases: [{ profile: GROUP_PROFILE, basis: `2026-11-01 ${r}` }] });
  assert.equal(gv.view.legal_facts.at(-1).key, LF.key);
  assert.equal(gv.view.legal_facts.at(-1).profile, "group");
  assert.ok(!gv.view.deadlines.some((e) => e.rule === "only_drafted"));
  for (const k of Object.keys(base.view)) if (k !== "deadlines" && k !== "legal_facts") assert.deepEqual(gv.view[k], base.view[k], k);
  /* withdrawn, it leaves the view from then on */
  w.lf.ruleWithdraw({ rule: r, reason: "the bylaw was repealed", by: V("dan"), viewer: V("dan") });
  w.lf.ruleWithdraw({ rule: f, reason: "the bylaw was repealed", by: V("dan"), viewer: V("dan") });
  w.lf.ruleWithdraw({ rule: drafted, reason: "never needed", by: V("dan"), viewer: V("dan") });
  assert.deepEqual(w.lf.governingView(), base);
  /* writes nothing; never throws */
  const n = w.rows(`SELECT COUNT(*) AS n FROM local_rule_acts`)[0].n;
  w.lf.governingView();
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM local_rule_acts`)[0].n, n);
  const broken = world();
  broken.lf.combine = () => { throw new Error("boom"); };
  assert.doesNotThrow(() => broken.lf.governingView());
  assert.equal(broken.lf.governingView().ok, false);
});

test("R12 governingView keeps one value per key: a confirmed rule whose key a profile activated later holds is not added, the profile's entry standing, and is reported in conflicts", () => {
  const later = { id: "test-later", name: "Later", covers: ["Later"], test: true,
    action_kinds: [{ kind: "records_request", label: "Records request", tier: 2, basis: "TEST" }],
    deadlines: [{ ...profileEntry(DL), status: "researched", basis: "TEST" }] };
  const { w, draft, confirm } = setup({ profiles: [TP], own: [later] });
  const r = draft().rule;
  confirm(r, { statement: QUAL });
  assert.equal(w.lf.governingView().view.deadlines.at(-1).profile, "group", "applied while no profile holds its key");
  w.record.setSetting("jurisdiction_profiles", [TP, "test-later"], "admin");
  const gv = w.lf.governingView();
  const same = gv.view.deadlines.filter((e) => e.rule === DL.rule && e.applies_to === DL.applies_to);
  assert.deepEqual(same.map((e) => e.profile), ["test-later"]);
  assert.equal(gv.conflicts.at(-1).says, word("local-facts.says.group_rule_holds", { rule: r }));
  /* the negative control: a second confirmed rule of its own key is added beside it */
  const r2 = draft({ ...DL, rule: "another_answer" }).rule;
  confirm(r2, { statement: QUAL });
  assert.equal(w.lf.governingView().view.deadlines.at(-1).basis.endsWith(r2), true);
});

test("R13 ruleWithdraw by any member with a reason: kept, never deleted; a repeat answers already; refusals with controls", () => {
  const { w, draft, confirm, n } = setup();
  const r = draft().rule;
  confirm(r, { statement: QUAL });
  for (const by of [MACHINE, ""]) row(w.lf.ruleWithdraw({ rule: r, reason: "x", by }), "MACHINE_CANNOT_DRAFT_RULE");
  row(w.lf.ruleWithdraw({ rule: "GR-42", reason: "x", by: V("dan") }), "NO_SUCH_GROUP_RULE");
  row(w.lf.ruleWithdraw({ rule: r, reason: "x", by: V("dan"), viewer: "nobody" }), "NO_SUCH_GROUP_RULE");
  for (const reason of [undefined, " ", "y".repeat(501)]) row(w.lf.ruleWithdraw({ rule: r, reason, by: V("dan") }), "RULE_NO_REASON");
  const before = n();
  assert.deepEqual(w.lf.ruleWithdraw({ rule: r, reason: "repealed", by: V("dan"), viewer: V("dan") }),
                   { ok: true, rule: r, state: "withdrawn", already: false, at: "2026-09-28T01:00:00Z" });
  assert.deepEqual(w.lf.ruleWithdraw({ rule: r, reason: "again", by: V("bob"), viewer: V("bob") }),
                   { ok: true, rule: r, state: "withdrawn", already: true, at: "2026-09-28T01:00:00Z" });
  assert.equal(n(), before + 1, "the repeat wrote nothing");
  /* kept: the draft, its confirmation and its withdrawal are all still read */
  const kept = w.lf.groupRules({ viewer: V("bob") }).rules[0];
  assert.deepEqual([kept.state, kept.confirmer, kept.withdrawn.reason], ["withdrawn", V("carol"), "repealed"]);
  assert.deepEqual(w.rows(`SELECT act FROM local_rule_acts ORDER BY seq`).map((x) => x.act), ["draft", "confirm", "withdraw"]);
});

test("R13 ruleOffer: a confirmed rule's entry, source and confirmed {at, with_statement} as canonical bytes with their digest, never the statement or a handle; refusals with controls", async () => {
  const { w, draft, confirm } = setup();
  const r = draft().rule;
  row(w.lf.ruleOffer({ rule: r, viewer: V("dan") }), "RULE_NOT_CONFIRMED");
  confirm(r, { statement: QUAL });
  row(w.lf.ruleOffer({ rule: "GR-9", viewer: V("dan") }), "NO_SUCH_GROUP_RULE");
  row(w.lf.ruleOffer({ rule: r, viewer: "nobody" }), "NO_SUCH_GROUP_RULE");
  const o = w.lf.ruleOffer({ rule: r, by: V("dan"), viewer: V("dan") });
  assert.equal(o.ok, true);
  assert.deepEqual(JSON.parse(o.bytes), { section: "deadlines", entry: DL,
    source: w.lf.groupRules({ viewer: V("dan") }).rules[0].source, confirmed: { at: "2026-09-28T01:00:00Z", with_statement: true } });
  assert.deepEqual(JSON.parse(o.bytes), o.offer);
  const { createHash } = await import("node:crypto");
  assert.equal(o.digest, createHash("sha256").update(o.bytes, "utf8").digest("hex"));
  for (const word of ["Zephyrine", V("bob"), V("carol"), "member:", "\"statement\""]) assert.ok(!o.bytes.includes(word), word);
  assert.equal(o.note, word("local-facts.note.carry_bytes_shared"));
  /* withdrawn, it is no longer offered */
  w.lf.ruleWithdraw({ rule: r, reason: "repealed", by: V("dan"), viewer: V("dan") });
  row(w.lf.ruleOffer({ rule: r, viewer: V("dan") }), "RULE_NOT_CONFIRMED");
});

test("R14 the rules' table: append-only, declared through declareTable (sight group, version_chain), purged only with the whole store; a machine never drafts, confirms or withdraws", () => {
  const { w, draft, confirm } = setup();
  const mine = w.record.declaredTables().filter((d) => d.module === "local-facts" && d.name === "local_rule_acts");
  assert.deepEqual(mine, [{ module: "local-facts", name: "local_rule_acts", keys: [], purge: "clear", expunge: "none",
                            export: "admin-only", sight: "group", derive: "stored", version_chain: true }]);
  const r = draft().rule;
  confirm(r, { statement: QUAL });
  w.lf.ruleWithdraw({ rule: r, reason: "repealed", by: V("dan"), viewer: V("dan") });
  const rows = JSON.stringify(w.rows(`SELECT * FROM local_rule_acts ORDER BY seq`));
  /* no act rewrites an earlier row */
  w.lf.ruleWithdraw({ rule: r, reason: "again", by: V("dan"), viewer: V("dan") });
  w.lf.groupRules({ viewer: V("dan") }); w.lf.governingView(); w.lf.ruleOffer({ rule: r, viewer: V("dan") });
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM local_rule_acts ORDER BY seq`)), rows);
  /* a machine: no draft, no confirmation, no withdrawal */
  const r2 = draft({ ...DL, rule: "second" }).rule;
  row(draft({ ...DL, rule: "third" }, { by: "class:ai" }), "MACHINE_CANNOT_DRAFT_RULE");
  row(confirm(r2, { by: "class:ai", statement: QUAL }), "MACHINE_CANNOT_CONFIRM");
  row(w.lf.ruleWithdraw({ rule: r2, reason: "x", by: "class:ai" }), "MACHINE_CANNOT_DRAFT_RULE");
  /* purge: a single bundle's leaves it, the whole store's clears it; an id is never reissued */
  assert.equal(w.record.purge({ bundleId: "INFO-2026-0001" }).removed.local_rule_acts, 0);
  assert.equal(w.record.purge({}).removed.local_rule_acts, 4);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM local_rule_acts`)[0].n, 0);
  const s = w.held("INFO-2026-0003", sha("after purge"));
  assert.equal(w.lf.ruleDraft({ section: "deadlines", entry: DL, source: { captureSha: s, extent: { kind: "document" } },
                                reason: "x", by: V("bob"), viewer: V("bob") }).rule, "GR-5", "never GR-1 again");
});

test("R10 R11 R13 the ops map: ruledraft, ruleconfirm, rulewithdraw and ruleoffer reach the services, the viewer read from the URL", () => {
  const { w, src } = setup();
  const url = (q) => new URL(`https://plane.example/?${q}`);
  const d = localFactsOps(w.lf, url("viewer=member%3Abob"), { section: "deadlines", entry: DL, source: src, reason: "x", by: V("bob"), viewer: "nobody" }).ruledraft();
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.equal(localFactsOps(w.lf, url("viewer=nobody"), { rule: d.rule, by: V("carol"), statement: QUAL }).ruleconfirm().reason, "NO_SUCH_GROUP_RULE",
               "the URL's viewer, not the body's");
  assert.equal(localFactsOps(w.lf, url("viewer=member%3Acarol"), { rule: d.rule, by: V("carol"), statement: QUAL, viewer: "nobody" }).ruleconfirm().ok, true);
  assert.equal(localFactsOps(w.lf, url(`rule=${d.rule}&viewer=member%3Adan`), null).ruleoffer().ok, true);
  assert.equal(localFactsOps(w.lf, url("viewer=member%3Adan"), { rule: d.rule, reason: "repealed", by: V("dan") }).rulewithdraw().state, "withdrawn");
});

test("R10 R11 R12 R13 DEC-149: every rule answer a member reads names the group's Civicsmith or needs no name, and names no place", () => {
  const NAMES_THE_COPY = /\b(this|the) instance\b|\bcopy\b|\bplane\b|\bserver\b|Oakland|Alameda/i;
  const { w, draft, confirm } = setup();
  const r = draft().rule;
  const answers = [r, draft({ ...DL, rule: "records_answer" }), draft(DL, { by: MACHINE }), draft(DL, { section: "x" }),
    draft({ ...DL, units: "x" }), draft(DL, { source: null }), draft({ ...DL, rule: "z" }, { reason: "" }),
    confirm(r), confirm(r, { by: V("bob") }), confirm("GR-77"), confirm(r, { statement: QUAL }), confirm(r, { statement: QUAL }),
    w.lf.groupRules({ viewer: V("dan") }), w.lf.ruleOffer({ rule: r, viewer: V("dan") }), w.lf.governingView().conflicts,
    w.lf.ruleWithdraw({ rule: r, reason: "x", by: V("dan") }), w.lf.ruleOffer({ rule: r, viewer: V("dan") })];
  for (const a of answers) assert.doesNotMatch(JSON.stringify(a), NAMES_THE_COPY);
});
