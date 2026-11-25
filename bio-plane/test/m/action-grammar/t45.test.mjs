/* action-grammar at T45 (T45-25; N858, N861, N879, N880, N882–N884, N892 (b); `BIO_Action_v0_2.md`): R2's new vocabularies,
   R5's lifecycle for every kind, R7's new audit arms, R8's press holder, R9's rows C-117.30–.58 (C-117.22 retired; K2845, K2849), R11's
   phrasing lists under the test profiles, the override ground (R15), the phrasing lists, finder and resolutions (R16–R19)
   and the action's new fields (R20–R25), each at the module's interface with its negative controls (K874). Pure functions,
   driven with documents and views; the time is handed in. */
import test from "node:test";
import assert from "node:assert/strict";
import * as AG from "../../../src/action-grammar/index.mjs";
import * as J from "../../../../jurisdictions/index.mjs";
import { isCalendarDate } from "../../../src/civil-time/index.mjs";
import { pushed, ZONE } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { DOCS, NOW } from "./corpus.mjs";
import { ROWS_NOW } from "./t45-rows.mjs";

const codes = (list) => list.map((x) => x.code);
const audit = (fm, o = {}) => pushed((f) => AG.checkActionExtension({ fm, nowMs: NOW, zone: ZONE, ...o }, f)).findings;
const OFFICE = { state: "named", role: "Clerk", body: "the Board" };
const PRESS = { state: "named", kind: "press", role: "editor", organisation: "The Paper" };
const SHA = "a".repeat(64);
const base = (o = {}) => ({ ...structuredClone(DOCS["clean-records-request"]), ...o });
const sent = (o = {}) => ({ direction: "sent", at: "2026-06-01", artifact_sha: SHA, ...o });
const recv = (o = {}) => ({ direction: "received", at: "2026-06-10", account: "they wrote back", author: "member:a", ...o });
const TEST_VIEW = (() => { const c = J.combine(["test-port-ellery"]); assert.ok(c.ok); return c.view; })();
const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
const JUNK = [undefined, null, 0, "x", [], {}, [null], { ground: 5 }, { object_type: "action", copied: 5, partners: {}, press_terms: [],
  correspondence: [null, 5, { office_status: 5, found_elsewhere: [], speaker: {} }], reply_owed: [], follows_action: "x" }];

/* ------------------------------------------------------------------------------------------------ R2 */

test("R2 (T45): the new vocabularies are exported frozen, each its one binding with its values in order; PHRASING_KINDS is jurisdictions' own binding (its R86), never a copy; negative control: no earlier export moved (each earlier name still answers its value)", () => {
  const want = {
    OVERRIDE_GROUNDS: ["legal_deadline", "irreversible_act"],
    PHRASING_KINDS: ["assertion", "position", "own_benefit_ask"],
    ASSERTION_RESOLUTIONS: ["only_asks", "breach_claim"],
    PRESS_RECORD_TERMS: ["on_record", "background", "off_record"],
    FOUND_ELSEWHERE_KINDS: ["press", "report", "decision", "statement", "other"],
    BEARINGS: ["new_evidence", "disputed_without_evidence", "not_addressed"],
    PROMISE_KINDS: ["embargo", "anonymity", "other"],
    CLOCK_OWED_BY: ["group", "body", "undetermined"],
  };
  for (const [n, v] of Object.entries(want)) {
    assert.deepEqual([...AG[n]], v, n);
    assert.ok(Object.isFrozen(AG[n]), `${n} frozen`);
    assert.throws(() => AG[n].push("x"), TypeError, n);
  }
  assert.equal(AG.PHRASING_KINDS, J.PHRASING_KINDS);
  assert.deepEqual(AG.PRODUCT_KINDS, ["records_request", "request_for_comment", "other"]);
  assert.deepEqual(AG.RESOLUTIONS, ["complied", "denied", "escalated", "withdrawn", "completed"]);
  assert.deepEqual(AG.CORRESPONDENCE_OUTCOMES, ["granted", "denied", "partial", "reversed", "affirmed", "none_stated", "none_exists"]);
});

/* ------------------------------------------------------------------------------------------------ R5 */

test("R5 (T45): the lifecycle grammar is the same for every kind, its stages keyed by direction: an acknowledgement on a request for comment's received entry is accepted, at the arm, the ledger arm and the audit; negative control: an acknowledgement on a sent entry still pushes STAGE_NOT_OF_DIRECTION", () => {
  const entries = [sent({ stage: "request" }), recv({ stage: "acknowledgement", follows: "0" })];
  for (const kind of [...AG.PRODUCT_KINDS, "bylaw_complaint"]) {
    const fm = { ...structuredClone(DOCS["rfc-clean"]), action_kind: kind, correspondence: entries };
    assert.deepEqual(AG.lifecycleFindings(entries, 1), [], kind);
    assert.deepEqual(pushed((f) => AG.correspondenceFindings(fm, f)).findings, [], kind);
    assert.ok(!audit(fm, { actionKinds: AG.actionKinds(TEST_VIEW) }).some((x) => x.code === "STAGE_NOT_OF_DIRECTION"), kind);
  }
  assert.deepEqual(audit({ ...structuredClone(DOCS["rfc-clean"]), correspondence: entries }), []);
  assert.deepEqual(codes(AG.lifecycleFindings([sent({ stage: "acknowledgement" })], 0)), ["STAGE_NOT_OF_DIRECTION", "FOLLOWS_NO_ENTRY"]);
  assert.deepEqual(codes(AG.lifecycleFindings([sent({ stage: "request" }), sent({ stage: "acknowledgement", follows: "0" })], 1)), ["STAGE_NOT_OF_DIRECTION"]);
});

/* ------------------------------------------------------------------------------------------------ R8 */

test("R8 (T45; K2849): the press arm accepts the reporter who holds the role, in the bytes the flat text holder: \"<name>\" (and as the reads present it, {name}), 1 to 200 characters with no quote, backslash or line break; a malformed holder, or a holder on any other arm, pushes one C-2.10 finding naming the arm holder; negative controls: a press counterparty with a holder pushes nothing, the same holder on an office pushes the finding, and every counterparty without a holder answers as before", () => {
  const cf = (cp) => pushed((f) => AG.counterpartyFindings({ counterparty: cp }, f)).findings;
  assert.equal(AG.HOLDER_NAME_MAX, 200);
  for (const holder of ["Jo Reporter", "j".repeat(200), { name: "Jo Reporter" }, null]) assert.deepEqual(cf({ ...PRESS, holder }), [], JSON.stringify(holder));
  for (const bad of ["", "  ", "j".repeat(201), "Jo \"R\"", "a\\b", "a\nb", {}, { name: "" }, { name: "Jo", phone: "1" }, ["Jo"], 5, true]) {
    const got = cf({ ...PRESS, holder: bad });
    assert.equal(got.length, 1, JSON.stringify(bad));
    assert.equal(got[0].check, "C-2.10");
    assert.match(got[0].message, /\(R9, arm: holder\)$/);
  }
  const arms = [OFFICE, { ...OFFICE, kind: "office" }, { state: "named", kind: "organisation", role: "director", organisation: "A Fund" },
    { state: "named", kind: "group", role: "chair", organisation: "Neighbours" }, { state: "audience", description: "readers" },
    { state: "undetermined", basis: "not yet known" }, { state: "named", name: "City Clerk" }];
  for (const cp of arms) {
    assert.deepEqual(cf(cp), [], JSON.stringify(cp));
    for (const holder of ["Jo Reporter", { name: "Jo Reporter" }]) {
      const got = cf({ ...cp, holder });
      assert.equal(got.length, 1, JSON.stringify(cp));
      assert.match(got[0].message, /carries holder: .*\(R9, arm: holder\)$/);
    }
  }
  assert.deepEqual(audit(base({ counterparty: { ...PRESS, holder: "Jo" } })), []);
  assert.equal(audit(base({ counterparty: { ...OFFICE, holder: "Jo" } })).length, 1);
});

/* ------------------------------------------------------------------------------------------------ R15 */

test("R15: overrideGroundFindings accepts a legal_deadline {citation, date} and an irreversible_act {what, when}; with no ground, a ground not an object, or another kind, OVERRIDE_NO_GROUND naming both grounds; each part missing or malformed, or a key the kind lacks, OVERRIDE_GROUND_REFUSED naming the part; negative controls: each ground well formed pushes nothing, date 2026-02-30 is refused, no ground is OVERRIDE_NO_GROUND", () => {
  const og = (override) => pushed((f) => AG.overrideGroundFindings(override, f));
  const LD = { kind: "legal_deadline", citation: "Test Stat. § 2.1", date: "2026-08-03" };
  const IA = { kind: "irreversible_act", what: "the trees are felled", when: "2026-08-03T09:30" };
  for (const ground of [LD, IA, { ...IA, when: "2026-08-03" }, { ...IA, when: "2024-02-29T23:59" }, { ...LD, citation: "c".repeat(200) },
    { ...IA, what: "w".repeat(500) }, { ...IA, when: "2026-08-03T00:00" }])
    assert.deepEqual(og({ reason: "the window closes", ground }), { findings: [], answered: false }, JSON.stringify(ground));
  for (const override of [undefined, null, "x", {}, { reason: "r" }, { ground: null }, { ground: "legal_deadline" }, { ground: [] },
    { ground: { kind: "urgency" } }, { ground: { citation: "s.1", date: "2026-08-03" } }]) {
    const got = og(override).findings;
    assert.deepEqual(codes(got), ["OVERRIDE_NO_GROUND"], JSON.stringify(override));
    assert.equal(got[0].check, "C-2.10");
    assert.match(got[0].message, /legal_deadline/);
    assert.match(got[0].message, /irreversible_act/);
  }
  const refused = (ground) => og({ ground }).findings.map((x) => [x.code, x.message.match(/ground\.(\w+)/)?.[1]]);
  assert.deepEqual(refused({ ...LD, date: "2026-02-30" }), [["OVERRIDE_GROUND_REFUSED", "date"]]);
  assert.deepEqual(refused({ ...LD, date: "2026-8-3" }), [["OVERRIDE_GROUND_REFUSED", "date"]]);
  assert.deepEqual(refused({ kind: "legal_deadline", date: "2026-08-03" }), [["OVERRIDE_GROUND_REFUSED", "citation"]]);
  for (const c of ["", "  ", "c".repeat(201), "the \"act\"", "a\\b", "a\nb", 5])
    assert.deepEqual(refused({ ...LD, citation: c }), [["OVERRIDE_GROUND_REFUSED", "citation"]], JSON.stringify(c));
  assert.deepEqual(refused({ ...LD, what: "x" }), [["OVERRIDE_GROUND_REFUSED", "what"]], "a key the kind lacks");
  assert.deepEqual(refused({ ...IA, date: "2026-08-03" }), [["OVERRIDE_GROUND_REFUSED", "date"]]);
  for (const w of [undefined, "", "w".repeat(501), "a\"b"]) assert.deepEqual(refused({ ...IA, what: w }), [["OVERRIDE_GROUND_REFUSED", "what"]], String(w));
  for (const w of [undefined, "", "tomorrow", "2026-02-30", "2026-08-03T24:00", "2026-08-03T09:60", "2026-02-30T09:00", "2026-08-03T09:30:00", "2026-08-03 09:30"])
    assert.deepEqual(refused({ ...IA, when: w }), [["OVERRIDE_GROUND_REFUSED", "when"]], String(w));
  assert.deepEqual(refused({ kind: "legal_deadline" }).map(([, p]) => p), ["citation", "date"], "one finding per part");
  assert.ok(isCalendarDate("2026-08-03") && !isCalendarDate("2026-02-30"), "civil-time's reading");
});

test("R15 (K2849): premiseOverrideOf presents a premise_override's flat keys (reason, ground_kind, ground_citation, ground_date, ground_what, ground_when) as {reason, ground}, ground null for an override stating none (one written before T45); an override already presented is answered as given; overrideGroundFindings judges what it presents, and the audit reads the bytes through it; negative controls: a pre-T45 override reads ground null and is not reported, a flat legal deadline with 2026-02-30 is refused", () => {
  assert.deepEqual(AG.premiseOverrideOf({ reason: "written before T45" }), { reason: "written before T45", ground: null });
  assert.deepEqual(AG.premiseOverrideOf({ reason: "r", ground_kind: "legal_deadline", ground_citation: "s.1", ground_date: "2026-08-03" }),
    { reason: "r", ground: { kind: "legal_deadline", citation: "s.1", date: "2026-08-03" } });
  assert.deepEqual(AG.premiseOverrideOf({ reason: "r", ground_kind: "irreversible_act", ground_what: "felled", ground_when: "2026-08-03T09:00" }),
    { reason: "r", ground: { kind: "irreversible_act", what: "felled", when: "2026-08-03T09:00" } });
  assert.deepEqual(AG.premiseOverrideOf({ reason: "r", ground_date: "2026-08-03" }), { reason: "r", ground: { date: "2026-08-03" } }, "a part with no kind: presented, and refused as no ground");
  const presented = { reason: "r", ground: { kind: "legal_deadline", citation: "s.1", date: "2026-08-03" } };
  assert.deepEqual(AG.premiseOverrideOf(presented), presented);
  for (const j of [undefined, null, "x", [], 5]) assert.equal(AG.premiseOverrideOf(j), null, String(j));
  const og = (po) => codes(pushed((f) => AG.overrideGroundFindings(AG.premiseOverrideOf(po), f)).findings);
  assert.deepEqual(og({ reason: "r", ground_kind: "legal_deadline", ground_citation: "s.1", ground_date: "2026-08-03" }), []);
  assert.deepEqual(og({ reason: "r", ground_kind: "legal_deadline", ground_citation: "s.1", ground_date: "2026-02-30" }), ["OVERRIDE_GROUND_REFUSED"]);
  assert.deepEqual(og({ reason: "r", ground_date: "2026-08-03" }), ["OVERRIDE_NO_GROUND"]);
  assert.deepEqual(og({ reason: "r", ground_kind: "legal_deadline", ground_citation: "s.1", ground_date: "2026-08-03", ground_what: "x" }), ["OVERRIDE_GROUND_REFUSED"], "a key the kind lacks");
  assert.deepEqual(audit(base({ premise_override: { reason: "written before T45" } })), []);
  assert.deepEqual(codes(audit(base({ premise_override: { reason: "r", ground_kind: "legal_deadline", ground_citation: "s.1", ground_date: "2026-02-30" } }))), ["OVERRIDE_GROUND_REFUSED"]);
});

test("R6 (T45; K2845, K2849 (5)): a rests_on leg may name a success record by consequences' id, SUC-<year>-<4 digits>, with no canonical-id finding (until record-grammar registers the prefix, N911); negative controls: the same id on an advances leg, a SUC id of another form, and any other unknown target are refused as before", () => {
  const legs = (action_basis) => pushed((f) => AG.actionBasisFindings({ action_kind: "other", action_basis }, f)).findings.map((x) => x.message);
  assert.deepEqual(legs([{ target: "SUC-2026-0042", kind: "rests_on" }]), []);
  assert.ok(AG.SUCCESS_RECORD_ID_RE.test("SUC-2026-0042"));
  assert.deepEqual(legs([{ target: "SUC-2026-0042", kind: "advances" }]), [localize("action-grammar.grammar.basis_leg_i_names_string_which", "basis leg {i} names '{String}', which is not a valid record id", { i: "0", String: "SUC-2026-0042" })]);
  for (const t of ["SUC-2026-42", "SUC-2026-00042", "SUC-26-0042", "SUC-2026-0042-slug", "suc-2026-0042", "XYZ-2026-0042"])
    assert.deepEqual(legs([{ target: t, kind: "rests_on" }]), [localize("action-grammar.grammar.basis_leg_i_names_string_which", "basis leg {i} names '{String}', which is not a valid record id", { i: "0", String: t })], t);
  assert.deepEqual(audit(base({ action_basis: [{ target: "SUC-2026-0042", kind: "rests_on" }, { target: "INQ-2026-0003-question", kind: "advances" }] })), []);
});

/* ------------------------------------------------------------------------------------------------ R16 */

test("R16: PHRASINGS is exported deeply frozen, per language and kind, English alone, each phrasing 2 to 100 characters on one line naming no place; every pinned phrasing is present in its kind; negative control: no kind's English list is empty and no other language is held", () => {
  const PINNED = {
    assertion: ["illegal", "illegally", "unlawful", "unlawfully", "violated", "in violation of", "broke the law", "in breach of", "breached", "failed to comply with", "covered up"],
    position: ["we support", "we oppose", "should adopt", "should pass", "should reject", "vote yes", "vote no", "vote for", "vote against"],
    own_benefit_ask: ["pay us", "pay our", "fund our", "hire us", "contract with us", "donate to us"],
  };
  assert.deepEqual(Object.keys(AG.PHRASINGS), ["en"]);
  assert.ok(Object.isFrozen(AG.PHRASINGS) && Object.isFrozen(AG.PHRASINGS.en));
  assert.deepEqual(Object.keys(AG.PHRASINGS.en), [...AG.PHRASING_KINDS]);
  for (const kind of AG.PHRASING_KINDS) {
    const list = AG.PHRASINGS.en[kind];
    assert.ok(Object.isFrozen(list) && list.length > 0, kind);
    for (const p of PINNED[kind]) assert.ok(list.includes(p), `${kind}: ${p}`);
    for (const p of list) {
      assert.ok(typeof p === "string" && p.length >= AG.PHRASING_MIN && p.length <= AG.PHRASING_MAX && !/[\r\n]/.test(p), p);
      assert.equal(new Set(list.map(AG.readAs)).size, list.length, `${kind}: each phrasing once`);
    }
  }
  /* the own-benefit list is narrow: a remedy of harm is never matched (K2781 (5)) */
  for (const remedy of ["Please reimburse the residents' fees.", "Refund the overcharge to every household.", "Restore the service."])
    assert.deepEqual(AG.pointOut({ sentences: [remedy], language: "en", kind: "own_benefit_ask" }).pointed, [], remedy);
  /* no place, office or person (R11) */
  const places = new Set(["Oakland", "Alameda", "California", "CPRA", "Port Ellery", "Marlow"]);
  for (const p of J.list()) { for (const c of p.covers) places.add(c); places.add(p.name); }
  const text = JSON.stringify(AG.PHRASINGS).toLowerCase();
  for (const p of places) assert.ok(!text.includes(p.toLowerCase()), p);
  assert.ok(!/\b(mayor|council|clerk|city|county|state)\b/.test(text));
});

/* ------------------------------------------------------------------------------------------------ R17 */

test("R17: phrasingsFor answers the product's phrasings, then the view's well-formed items whose locale applies (the whole tag case-insensitive, else its primary subtag) and whose kind is asked, each once, a profile phrasing equal to a product one answered once as product, a malformed item named in ignored; undetermined language_malformed, kind_unknown or no_list, never an empty read; negative controls: en with a view adding one phrasing answers both origins, es with no view is undetermined no_list, es with a view holding a Spanish phrasing is read", () => {
  const view = { phrasings: [
    { locale: "en", kind: "assertion", phrase: "acted outside the law", basis: "TEST" },
    { locale: "EN-us", kind: "assertion", phrase: "ILLEGAL", basis: "TEST" },
    { locale: "en", kind: "position", phrase: "we back the measure", basis: "TEST" },
    { locale: "es", kind: "assertion", phrase: "de forma ilegal", basis: "TEST" },
    { locale: "en", kind: "assertion", phrase: "acted outside the law", basis: "TEST" },
    null, { locale: "not a tag!", kind: "assertion", phrase: "x y" }, { locale: "en", kind: "praise", phrase: "well done" },
    { locale: "en", kind: "assertion", phrase: "x" }, { locale: "en", kind: "assertion", phrase: "a\nb" }, { locale: "en", kind: "assertion", phrase: "p".repeat(101) },
  ] };
  const en = AG.phrasingsFor({ language: "en", kind: "assertion", view });
  assert.equal(en.state, "read");
  assert.equal(en.language, "en");
  const prod = AG.PHRASINGS.en.assertion;
  assert.deepEqual(en.phrases, [...prod.map((phrase) => ({ phrase, origin: "product" })), { phrase: "acted outside the law", origin: "profile" }]);
  assert.deepEqual(en.ignored, [{ index: 5, why: "not_an_entry" }, { index: 6, why: "locale_malformed" }, { index: 7, why: "kind_unknown" },
    { index: 8, why: "phrase_malformed" }, { index: 9, why: "phrase_malformed" }, { index: 10, why: "phrase_malformed" }]);
  /* the whole tag, else its primary subtag: en-GB reads the en list and the en profile items */
  const gb = AG.phrasingsFor({ language: "en-GB", kind: "assertion", view });
  assert.deepEqual(gb.phrases, en.phrases);
  assert.deepEqual(AG.phrasingsFor({ language: "en", kind: "assertion" }), { state: "read", language: "en", phrases: prod.map((phrase) => ({ phrase, origin: "product" })), ignored: [] });
  /* undetermined, never an empty read */
  assert.deepEqual(AG.phrasingsFor({ language: "es", kind: "assertion" }), { state: "undetermined", why: "no_list" });
  assert.equal(AG.phrasingsFor({ language: "es", kind: "position", view }).why, "no_list");
  assert.deepEqual(AG.phrasingsFor({ language: "es", kind: "assertion", view }).phrases, [{ phrase: "de forma ilegal", origin: "profile" }]);
  assert.equal(AG.phrasingsFor({ language: "es-MX", kind: "assertion", view }).state, "read");
  for (const language of [undefined, null, "", "not a tag!", 5, "en_US"]) assert.deepEqual(AG.phrasingsFor({ language, kind: "assertion" }), { state: "undetermined", why: "language_malformed" }, String(language));
  for (const kind of [undefined, "praise", "ASSERTION", 5]) assert.deepEqual(AG.phrasingsFor({ language: "en", kind }), { state: "undetermined", why: "kind_unknown" }, String(kind));
  assert.deepEqual(AG.phrasingsFor({ language: "en", kind: "assertion", view: { phrasings: "x" } }).ignored, [{ index: null, why: "not_a_list" }]);
  for (const j of JUNK) assert.doesNotThrow(() => AG.phrasingsFor(j));
  /* a profile only extends: nothing in a view removes a product phrasing */
  assert.ok(prod.every((p) => en.phrases.some((x) => x.phrase === p && x.origin === "product")));
});

/* ------------------------------------------------------------------------------------------------ R18 */

test("R18: pointOut answers every match in sentence order then position, with its offsets in the sentence as given, read in NFC, case-folded, typographic quotes plain and white space collapsed, a match bounded by no letter, mark or digit; a question is not exempt; undetermined not_sentences for anything but 0 to 5,000 strings of at most 10,000 characters, and R17's undetermined passes through; negative controls: the canon's five", () => {
  const read = (sentences, kind = "assertion", o = {}) => AG.pointOut({ sentences, language: "en", kind, ...o });
  /* the controls */
  const one = read(["Staff illegally split the contract."]);
  assert.deepEqual(one, { state: "read", language: "en", kind: "assertion", pointed: [{ index: 0, phrase: "illegally", origin: "product", start: 6, end: 15 }] });
  assert.deepEqual(read(["We ask the Auditor to examine five purchase orders."]).pointed, []);
  assert.deepEqual(read(["Illegality was found."]).pointed, []);
  assert.deepEqual(read(["They acted IN  BREACH OF the rule."]).pointed.map((p) => [p.phrase, p.start, p.end]), [["in breach of", 11, 24]]);
  assert.deepEqual(read("text"), { state: "undetermined", why: "not_sentences" });
  /* the offsets index the sentence as given */
  const s = "Why does the office keep ‘breaking the law’?\tThey VIOLATED it, unlawfully.";
  const got = read([s]).pointed;
  for (const p of got) assert.equal(AG.readAs(s.slice(p.start, p.end)), AG.readAs(p.phrase), p.phrase);
  assert.deepEqual(got.map((p) => p.phrase), ["breaking the law", "violated", "unlawfully"], "a question is not exempt");
  /* NFC: a decomposed letter reads as its composed form, and a mark after a match is a boundary */
  const viewE = { phrasings: [{ locale: "en", kind: "assertion", phrase: "café fraud", basis: "TEST" }] };
  assert.deepEqual(read(["A café fraud occurred."], "assertion", { view: viewE }).pointed.map((p) => [p.phrase, p.origin, p.start, p.end]), [["café fraud", "profile", 2, 13]]);
  assert.deepEqual(read(["illegaĺ"]).pointed, [], "a mark after it");
  assert.deepEqual(read(["illegal2", "2illegal", "_illegal_", "(illegal)"]).pointed.map((p) => p.index), [2, 3]);
  /* apostrophes: a typographic one reads as the plain */
  const viewA = { phrasings: [{ locale: "en", kind: "assertion", phrase: "didn't comply", basis: "TEST" }] };
  assert.equal(read(["They didn’t comply."], "assertion", { view: viewA }).pointed.length, 1);
  /* every match, sentence order then position; several in one sentence and the same phrasing twice */
  const many = read(["Fine.", "It was illegal, and illegal again; they covered up.", "We support it and vote for it."], "assertion").pointed;
  assert.deepEqual(many.map((p) => [p.index, p.phrase, p.start]), [[1, "illegal", 7], [1, "illegal", 20], [1, "covered up", 40]]);
  assert.deepEqual(read(["We support it and vote for it."], "position").pointed.map((p) => p.phrase), ["we support", "vote for"]);
  assert.deepEqual(read(["Please pay us now."], "own_benefit_ask").pointed.map((p) => p.phrase), ["pay us"]);
  /* bounds */
  assert.equal(read(Array(5000).fill("x")).state, "read");
  assert.equal(read(["y".repeat(10000)]).state, "read");
  assert.deepEqual(read([]).pointed, []);
  for (const bad of [undefined, null, 5, {}, [5], ["ok", null], Array(5001).fill("x"), ["y".repeat(10001)]])
    assert.deepEqual(read(bad), { state: "undetermined", why: "not_sentences" }, Array.isArray(bad) ? `list of ${bad.length}` : String(bad));
  /* R17's undetermined passes through, with no pointed */
  assert.deepEqual(AG.pointOut({ sentences: ["ilegal"], language: "es", kind: "assertion" }), { state: "undetermined", why: "no_list" });
  assert.deepEqual(AG.pointOut({ sentences: ["x"], language: "en", kind: "praise" }), { state: "undetermined", why: "kind_unknown" });
  for (const j of JUNK) assert.doesNotThrow(() => AG.pointOut(j));
});

/* ------------------------------------------------------------------------------------------------ R19 */

test("R19: a resolution names the exact text of a pointed-out sentence with only_asks (and the member's words, 1 to 500 characters on one line) or breach_claim (no words); a resolution naming no pointed-out sentence, a second of one sentence, or a malformed one pushes ASSERTION_RESOLUTION_REFUSED naming the item; assertionsUnresolved answers the unresolved indexes and breach_claim, undetermined when pointed is; negative controls: only_asks with words resolves, without words is refused, an edited sentence is unresolved again, one breach_claim answers breach_claim: true", () => {
  const sentences = ["Staff illegally split the contract.", "We ask the Auditor to examine it.", "They covered up the report."];
  const pointed = AG.pointOut({ sentences, language: "en", kind: "assertion" });
  assert.deepEqual(pointed.pointed.map((p) => p.index), [0, 2]);
  const R = (resolutions, s = sentences, p = pointed) => ({ sentences: s, pointed: p, resolutions });
  const refusedAt = (resolutions) => pushed((f) => AG.assertionResolutionFindings(R(resolutions), f)).findings.map((x) => [x.code, x.message.match(/^resolutions\[(\d+)\]/)?.[1] ?? null]);
  const ONLY = { sentence: sentences[0], resolution: "only_asks", words: "We only ask the Auditor to look at the split." };
  /* nothing resolved */
  assert.deepEqual(AG.assertionsUnresolved(R([])), { state: "read", unresolved: [0, 2], breach_claim: false });
  assert.deepEqual(AG.assertionsUnresolved(R(undefined)), { state: "read", unresolved: [0, 2], breach_claim: false });
  /* only_asks with words resolves */
  assert.deepEqual(refusedAt([ONLY]), []);
  assert.deepEqual(AG.assertionsUnresolved(R([ONLY])), { state: "read", unresolved: [2], breach_claim: false });
  /* one breach_claim */
  const BREACH = { sentence: sentences[2], resolution: "breach_claim" };
  assert.deepEqual(refusedAt([ONLY, BREACH]), []);
  assert.deepEqual(AG.assertionsUnresolved(R([ONLY, BREACH])), { state: "read", unresolved: [], breach_claim: true });
  /* refusals, each naming its item */
  const bad = [
    { sentence: sentences[0], resolution: "only_asks" },
    { sentence: sentences[0], resolution: "only_asks", words: "  " },
    { sentence: sentences[0], resolution: "only_asks", words: "w".repeat(501) },
    { sentence: sentences[0], resolution: "only_asks", words: "a\nb" },
    { sentence: sentences[2], resolution: "breach_claim", words: "it is a breach" },
    { sentence: sentences[1], resolution: "only_asks", words: "asks" },
    { sentence: "Staff illegally split the contract", resolution: "only_asks", words: "asks" },
    { sentence: sentences[0], resolution: "rewrite" },
    { sentence: sentences[0], resolution: "only_asks", words: "asks", by: "member:a" },
    null, "x",
  ];
  for (const item of bad) assert.deepEqual(refusedAt([item]), [["ASSERTION_RESOLUTION_REFUSED", "0"]], JSON.stringify(item));
  assert.deepEqual(refusedAt([ONLY, { ...ONLY, words: "again" }]), [["ASSERTION_RESOLUTION_REFUSED", "1"]], "a second resolution of one sentence");
  assert.deepEqual(refusedAt("x"), [["ASSERTION_RESOLUTION_REFUSED", null]]);
  assert.deepEqual(AG.assertionsUnresolved(R([{ sentence: sentences[0], resolution: "only_asks" }])).unresolved, [0, 2], "a refused resolution resolves nothing");
  assert.deepEqual(AG.assertionsUnresolved(R([ONLY, { ...ONLY, resolution: "breach_claim", words: undefined }])).breach_claim, false, "the second is refused");
  for (const x of pushed((f) => AG.assertionResolutionFindings(R([null]), f)).findings) assert.equal(x.check, "C-2.10");
  /* an edited sentence is unresolved again; a rewritten one no longer pointed out needs none */
  const edited = [...sentences]; edited[0] = "Staff illegally split the big contract.";
  assert.deepEqual(AG.assertionsUnresolved(R([ONLY], edited, AG.pointOut({ sentences: edited, language: "en", kind: "assertion" }))).unresolved, [0, 2]);
  assert.deepEqual(pushed((f) => AG.assertionResolutionFindings(R([ONLY], edited, AG.pointOut({ sentences: edited, language: "en", kind: "assertion" })), f)).findings.map((x) => x.code), ["ASSERTION_RESOLUTION_REFUSED"]);
  const rewritten = [...sentences]; rewritten[0] = "We ask whether the contract was split.";
  assert.deepEqual(AG.assertionsUnresolved(R([], rewritten, AG.pointOut({ sentences: rewritten, language: "en", kind: "assertion" }))).unresolved, [2]);
  /* the same text twice: one resolution binds both */
  const twice = [sentences[0], sentences[0]];
  assert.deepEqual(AG.assertionsUnresolved(R([ONLY], twice, AG.pointOut({ sentences: twice, language: "en", kind: "assertion" }))).unresolved, []);
  /* undetermined pointed: undetermined, never unresolved: [] */
  for (const p of [AG.pointOut({ sentences, language: "es", kind: "assertion" }), AG.pointOut({ sentences, language: "en", kind: "position" }), undefined, {}, { state: "read" }]) {
    const args = { sentences, pointed: p, resolutions: [ONLY] };
    assert.deepEqual(AG.assertionsUnresolved(args), { state: "undetermined", why: "not_pointed" }, String(JSON.stringify(p)));
    assert.deepEqual(pushed((f) => AG.assertionResolutionFindings(args, f)).findings, []);
  }
  for (const j of JUNK) assert.doesNotThrow(() => { AG.assertionsUnresolved(j); AG.assertionResolutionFindings(j, []); });
});

/* ------------------------------------------------------------------------------------------------ R20 */

test("R20: copied, absent or 0 to 20 named addressees each checked as R8 checks a named counterparty (COUNTERPARTY_REFUSED naming copied[i]), never an audience or undetermined, none twice; the addressee's office COPIED_IS_ADDRESSEE; partners, absent or 0 to 20 {role, organisation, entity_id?}, any other key or a repeated organisation PARTNERS_REFUSED naming the entry; negative controls: a distinct copied office and a well-formed partner push nothing, the addressee's office copied is COPIED_IS_ADDRESSEE, {name: Jo Smith} is PARTNERS_REFUSED", () => {
  const cf = (copied, cp = OFFICE) => pushed((f) => AG.copiedFindings({ counterparty: cp, copied }, f)).findings;
  const OTHER = { state: "named", role: "Auditor", body: "the Council" };
  assert.equal(AG.COPIED_MAX, 20); assert.equal(AG.PARTNERS_MAX, 20);
  assert.deepEqual(cf([OTHER, PRESS, { ...PRESS, holder: { name: "Jo" } }].slice(0, 2)), []);
  for (const v of [undefined, null, []]) assert.deepEqual(cf(v), [], String(v));
  assert.deepEqual(cf(Array.from({ length: 20 }, (_, i) => ({ state: "named", role: `Officer ${i}`, body: "the Board" }))), []);
  /* the addressee's office */
  for (const same of [OFFICE, { ...OFFICE, role: " clerk ", body: "THE BOARD" }, { ...OTHER, entity_id: "ENT-2026-0001" }]) {
    const cp = same === OFFICE || same.role === " clerk " ? OFFICE : { ...OFFICE, entity_id: "ENT-2026-0001" };
    assert.deepEqual(codes(cf([same], cp)), ["COPIED_IS_ADDRESSEE"], JSON.stringify(same));
  }
  assert.deepEqual(cf([{ ...OFFICE, entity_id: "ENT-2026-0002" }], { ...OFFICE, entity_id: "ENT-2026-0001" }), [], "two offices by their ids");
  assert.deepEqual(cf([OFFICE], PRESS), [], "an action to the press copies an office");
  /* refused, naming copied[i] */
  const named = (copied) => cf(copied).map((x) => [x.code, x.message.match(/^copied(\[\d+\])?/)?.[0]]);
  assert.deepEqual(named("x"), [["COUNTERPARTY_REFUSED", "copied"]]);
  assert.deepEqual(named([OTHER, { state: "audience", description: "readers" }]), [["COUNTERPARTY_REFUSED", "copied[1]"]]);
  assert.deepEqual(named([{ state: "undetermined", basis: "x" }]), [["COUNTERPARTY_REFUSED", "copied[0]"]]);
  assert.deepEqual(named([OTHER, { state: "named", role: "Clerk" }]), [["COUNTERPARTY_REFUSED", "copied[1]"]]);
  assert.deepEqual(named([{ state: "named", kind: "person", role: "x" }]), [["COUNTERPARTY_REFUSED", "copied[0]"]]);
  assert.deepEqual(named([OTHER, { ...OTHER, holder: { name: "Jo" } }]), [["COUNTERPARTY_REFUSED", "copied[1]"]]);
  assert.deepEqual(named([OTHER, { ...OTHER }]), [["COUNTERPARTY_REFUSED", "copied[1]"]]);
  assert.deepEqual(named([PRESS, { ...PRESS, organisation: "the paper" }]), [["COUNTERPARTY_REFUSED", "copied[1]"]]);
  assert.deepEqual(named([null, 5]), [["COUNTERPARTY_REFUSED", "copied[0]"], ["COUNTERPARTY_REFUSED", "copied[1]"]]);
  assert.deepEqual(codes(cf(Array.from({ length: 21 }, (_, i) => ({ state: "named", role: `Officer ${i}`, body: "the Board" })))), ["COUNTERPARTY_REFUSED"]);
  /* partners */
  const pf = (partners) => pushed((f) => AG.partnersFindings({ partners }, f)).findings;
  const P = { role: "co-signer", organisation: "Neighbours United" };
  assert.deepEqual(pf([P, { role: "lead", organisation: "A Fund", entity_id: "ENT-2026-0003" }]), []);
  for (const v of [undefined, null, []]) assert.deepEqual(pf(v), [], String(v));
  const at = (partners) => pf(partners).map((x) => [x.code, x.message.match(/^partners(\[\d+\])?/)?.[0]]);
  assert.deepEqual(at([{ name: "Jo Smith" }]), [["PARTNERS_REFUSED", "partners[0]"]]);
  assert.deepEqual(at([P, { ...P, name: "Jo Smith" }]), [["PARTNERS_REFUSED", "partners[1]"]]);
  for (const bad of [{ role: "", organisation: "x" }, { role: "r", organisation: "o".repeat(201) }, { role: "r\"", organisation: "x" },
    { role: "r", organisation: "x", entity_id: "ENT-1" }, { organisation: "x" }, null, "Neighbours"])
    assert.deepEqual(at([bad]), [["PARTNERS_REFUSED", "partners[0]"]], JSON.stringify(bad));
  assert.deepEqual(at([P, { role: "other", organisation: " NEIGHBOURS united" }]), [["PARTNERS_REFUSED", "partners[1]"]], "a repeated organisation");
  assert.deepEqual(at([{ ...P, entity_id: "ENT-2026-0003" }, { role: "x", organisation: "Other name", entity_id: "ENT-2026-0003" }]), [["PARTNERS_REFUSED", "partners[1]"]]);
  assert.deepEqual(pf([{ ...P, entity_id: "ENT-2026-0003" }, { ...P, entity_id: "ENT-2026-0004" }]), [], "equal names, distinct entities");
  assert.deepEqual(at("x"), [["PARTNERS_REFUSED", "partners"]]);
  assert.deepEqual(codes(pf(Array.from({ length: 21 }, (_, i) => ({ role: "r", organisation: `Org ${i}` })))), ["PARTNERS_REFUSED"]);
  for (const j of JUNK) assert.doesNotThrow(() => { AG.copiedFindings(j, []); AG.partnersFindings(j, []); });
});

/* ------------------------------------------------------------------------------------------------ R21 */

test("R21: press_terms, absent or {on_record, embargo_until?, release_at?, note?}, on_record one of PRESS_RECORD_TERMS, the times local date-times with a real date, note at most 500 characters by R8's text rule; malformed or another key PRESS_TERMS_REFUSED; not on the press arm PRESS_TERMS_NOT_PRESS; negative controls: well-formed terms on a press action push nothing, on an office action PRESS_TERMS_NOT_PRESS", () => {
  const tf = (press_terms, counterparty = PRESS) => codes(pushed((f) => AG.pressTermsFindings({ counterparty, press_terms }, f)).findings);
  const T = { on_record: "background", embargo_until: "2026-08-03T09:00", release_at: "2026-08-04T06:00", note: "quote as a council source" };
  for (const t of [T, { on_record: "on_record" }, { on_record: "off_record", note: "" }, { ...T, note: "n".repeat(500) }]) assert.deepEqual(tf(t), [], JSON.stringify(t));
  for (const v of [undefined, null]) { assert.deepEqual(tf(v), []); assert.deepEqual(tf(v, OFFICE), []); }
  assert.deepEqual(tf(T, OFFICE), ["PRESS_TERMS_NOT_PRESS"]);
  assert.deepEqual(tf(T, { state: "audience", description: "readers" }), ["PRESS_TERMS_NOT_PRESS"]);
  assert.deepEqual(codes(pushed((f) => AG.pressTermsFindings({ press_terms: T }, f)).findings), ["PRESS_TERMS_NOT_PRESS"], "no counterparty");
  for (const bad of [{}, { on_record: "maybe" }, { ...T, embargo_until: "2026-02-30T09:00" }, { ...T, release_at: "2026-08-04" },
    { ...T, release_at: "2026-08-04T25:00" }, { ...T, note: "n".repeat(501) }, { ...T, note: "a\nb" }, { ...T, note: 5 }, { ...T, speaker: "x" }])
    assert.deepEqual(tf(bad), ["PRESS_TERMS_REFUSED"], JSON.stringify(bad));
  for (const bad of ["on_record", [], 5]) assert.deepEqual(tf(bad), ["PRESS_TERMS_REFUSED"], JSON.stringify(bad));
  assert.deepEqual(tf({ on_record: "x", speaker: "y" }, OFFICE), ["PRESS_TERMS_NOT_PRESS", "PRESS_TERMS_REFUSED", "PRESS_TERMS_REFUSED"]);
});

/* ------------------------------------------------------------------------------------------------ R22 */

test("R22 (K2849): entryFieldFindings over the entry's flat keys: office_words (and office_status, the status token) only on a received entry carrying an outcome, office_words 1 to 500 characters with no quotation mark, backslash or line break (K2859), else OFFICE_STATUS_WITHOUT_OUTCOME; office_status one of facts.responseStatuses, else (or with none handed in) OFFICE_STATUS_UNKNOWN; found_elsewhere (a kind of FOUND_ELSEWHERE_KINDS) and found_elsewhere_note (at most 500 characters, none of those three) only on a received entry, else FOUND_ELSEWHERE_REFUSED, and with no artifact_sha FOUND_ELSEWHERE_NEEDS_CAPTURE; speaker only on a sent entry, a member id of 1 to 200 characters, else SPEAKER_REFUSED; negative controls: an entry with none of them pushes nothing, words with an outcome and a held status push nothing, without outcome are refused, found_elsewhere on sent and speaker on received are refused", () => {
  const ef = (entry, facts, prior = [sent({ stage: "request" })]) => codes(AG.entryFieldFindings([...prior, entry], prior.length, facts));
  const FACTS = { responseStatuses: ["implemented", "declined"] };
  const WORDS = "Will be implemented in the next fiscal year";
  const decided = (o) => recv({ stage: "denial", follows: "0", outcome: "partial", ...o });
  assert.deepEqual(ef(decided({ office_words: WORDS, office_status: "implemented" }), FACTS), []);
  assert.deepEqual(ef(decided({ office_words: WORDS, office_status: "implemented" }), { responseStatuses: TEST_VIEW.vocabulary.response_statuses }), [], "the profile's entries as jurisdictions holds them");
  assert.deepEqual(ef(decided({ office_words: WORDS })), [], "words alone with no statuses held");
  assert.deepEqual(ef(decided({ office_words: "w".repeat(500) })), []);
  assert.deepEqual(ef(decided({ office_words: WORDS, office_status: "implemented" })), ["OFFICE_STATUS_UNKNOWN"], "a status with none handed in");
  assert.deepEqual(ef(decided({ office_words: WORDS, office_status: "upheld" }), FACTS), ["OFFICE_STATUS_UNKNOWN"]);
  assert.deepEqual(ef(recv({ office_words: WORDS }), FACTS), ["OFFICE_STATUS_WITHOUT_OUTCOME"]);
  assert.deepEqual(ef(decided({ outcome: " ", office_words: WORDS }), FACTS), ["OFFICE_STATUS_WITHOUT_OUTCOME"]);
  assert.deepEqual(ef(sent({ outcome: "granted", office_words: WORDS }), FACTS), ["OFFICE_STATUS_WITHOUT_OUTCOME"]);
  assert.deepEqual(ef(decided({ office_status: "implemented" }), FACTS), ["OFFICE_STATUS_WITHOUT_OUTCOME"], "a status with no words");
  for (const bad of ["", "  ", "w".repeat(501), "a\nb", "the \"plan\"", "a\\b", 5, {}])
    assert.deepEqual(ef(decided({ office_words: bad }), FACTS), ["OFFICE_STATUS_WITHOUT_OUTCOME"], JSON.stringify(bad));
  /* found_elsewhere */
  const capture = (o) => recv({ account: undefined, author: undefined, artifact_sha: SHA, ...o });
  for (const kind of AG.FOUND_ELSEWHERE_KINDS) assert.deepEqual(ef(capture({ found_elsewhere: kind })), [], kind);
  assert.deepEqual(ef(capture({ found_elsewhere: "press", found_elsewhere_note: "quoted in Tuesday's paper" })), []);
  assert.deepEqual(ef(capture({ found_elsewhere: "press", found_elsewhere_note: "n".repeat(500) })), []);
  assert.deepEqual(ef(recv({ found_elsewhere: "press" })), ["FOUND_ELSEWHERE_NEEDS_CAPTURE"]);
  assert.deepEqual(ef(sent({ found_elsewhere: "press" })), ["FOUND_ELSEWHERE_REFUSED"]);
  assert.deepEqual(ef({ direction: "no_response", at: "2026-06-20", account: "none", author: "member:a", found_elsewhere: "press" }), ["FOUND_ELSEWHERE_REFUSED", "FOUND_ELSEWHERE_NEEDS_CAPTURE"]);
  for (const bad of [{ found_elsewhere: "rumour" }, { found_elsewhere: "press", found_elsewhere_note: "n".repeat(501) }, { found_elsewhere: "press", found_elsewhere_note: 5 },
    { found_elsewhere: "press", found_elsewhere_note: "said \"no\"" }, { found_elsewhere: "press", found_elsewhere_note: "a\\b" },
    { found_elsewhere: "press", found_elsewhere_note: "a\nb" },
    { found_elsewhere_note: "a note with no kind" }, { found_elsewhere: { kind: "press" } }])
    assert.deepEqual(ef(capture(bad)), ["FOUND_ELSEWHERE_REFUSED"], JSON.stringify(bad));
  /* speaker */
  for (const sp of ["member:abc", "abc", "m".repeat(200)]) assert.deepEqual(ef(sent({ speaker: sp })), [], sp);
  assert.deepEqual(ef(recv({ speaker: "member:abc" })), ["SPEAKER_REFUSED"]);
  for (const sp of ["", " ", "member:", "m".repeat(201), "a\"b", 5, {}]) assert.deepEqual(ef(sent({ speaker: sp })), ["SPEAKER_REFUSED"], JSON.stringify(sp));
  /* none of them */
  for (const e of [sent(), recv(), decided(), { direction: "no_response", at: "2026-06-20", account: "x", author: "member:a" },
    { speaker: null, office_words: null, office_status: null, found_elsewhere: null, found_elsewhere_note: null }])
    assert.deepEqual(ef(e, FACTS), [], JSON.stringify(e));
  for (const x of AG.entryFieldFindings([recv({ speaker: "m" })], 0)) assert.equal(x.check, "C-2.10");
  for (const j of JUNK) assert.doesNotThrow(() => { AG.entryFieldFindings(j, 0, j); AG.entryFieldFindings([j], 0, j); });
});

/* ------------------------------------------------------------------------------------------------ R23 */

test("R23 (K2859): reply_owed absent, true or false, else REPLY_OWED_REFUSED, and stated together with reply_owed_reason (1 to 500 characters with no quotation mark, backslash or line break), the reason never alone, else REPLY_OWED_REFUSED (the one site of that condition, actions R82 answering through it); follows_action absent or {action, ord?}, action an action's record id, ord a non-negative integer, else FOLLOWS_ACTION_REFUSED; equal to ctx.bundleId FOLLOWS_ACTION_SELF; negative controls: reply_owed false with a reason and a link to another action push nothing, reply_owed 'no', a reply_owed with no reason and a self-link push their codes", () => {
  const SELF = "ACTN-2026-0009-this";
  const WHY = "the board answers to nobody here";
  const af = (o, ctx = { bundleId: SELF }) => codes(pushed((f) => AG.actionFieldFindings(base(o), ctx, f)).findings);
  assert.equal(AG.REPLY_OWED_REASON_MAX, 500);
  for (const v of [true, false]) assert.deepEqual(af({ reply_owed: v, reply_owed_reason: WHY }), [], String(v));
  for (const v of [undefined, null]) assert.deepEqual(af({ reply_owed: v }), [], String(v));
  assert.deepEqual(af({ reply_owed: false, reply_owed_reason: "w".repeat(500) }), []);
  for (const v of ["no", "false", 0, 1, [], {}]) assert.deepEqual(af({ reply_owed: v, reply_owed_reason: WHY }), ["REPLY_OWED_REFUSED"], JSON.stringify(v));
  for (const why of [undefined, null, "", "  ", "w".repeat(501), "a \"b\"", "a\\b", "a\nb", 5])
    assert.deepEqual(af({ reply_owed: false, reply_owed_reason: why }), ["REPLY_OWED_REFUSED"], JSON.stringify(why));
  assert.deepEqual(af({ reply_owed_reason: WHY }), ["REPLY_OWED_REFUSED"], "a reason alone");
  assert.equal(pushed((f) => AG.actionFieldFindings({ reply_owed: "no" }, {}, f)).findings.length, 1, "one finding per write");
  const LINK = { action: "ACTN-2026-0005-earlier" };
  for (const v of [LINK, { ...LINK, ord: 0 }, { ...LINK, ord: 7 }, null, undefined])
    assert.deepEqual(af({ reply_owed: false, reply_owed_reason: WHY, follows_action: v }), [], JSON.stringify(v));
  for (const v of [{ action: "INQ-2026-0003-question" }, { action: "ACTN-1" }, { action: 5 }, {}, { ...LINK, ord: -1 }, { ...LINK, ord: 1.5 },
    { ...LINK, ord: "1" }, { ...LINK, entry: 1 }, "ACTN-2026-0005-earlier", [LINK]])
    assert.deepEqual(af({ follows_action: v }), ["FOLLOWS_ACTION_REFUSED"], JSON.stringify(v));
  assert.deepEqual(af({ reply_owed: "no", follows_action: { action: SELF } }), ["REPLY_OWED_REFUSED", "FOLLOWS_ACTION_SELF"]);
  assert.deepEqual(af({ follows_action: { action: SELF } }, null), [], "no id handed in: not judged");
  assert.deepEqual(af({ follows_action: { action: SELF } }, {}), []);
  /* the audit judges the same */
  assert.deepEqual(codes(audit(base({ reply_owed: false }))), ["REPLY_OWED_REFUSED"]);
  assert.deepEqual(audit(base({ reply_owed: false, reply_owed_reason: WHY })), []);
  for (const j of JUNK) assert.doesNotThrow(() => AG.actionFieldFindings(j, j, []));
});

/* ------------------------------------------------------------------------------------------------ R24 */

test("R24: bearingFindings: claims, 1 to 50 {claim, bearing, note?}, each claim one of the action's leg targets, none twice, a bearing of BEARINGS, a note of at most 500 characters; each fault BEARING_REFUSED naming the item; negative controls: one claim per leg with a listed bearing pushes nothing, a claim not among the legs is refused", () => {
  const LEGS = ["INQ-2026-0003-question", "INQ-2026-0004-second", "INFO-2026-0001-source"];
  const bf = (claims, legs = LEGS) => pushed((f) => AG.bearingFindings(claims, legs, f)).findings.map((x) => [x.code, x.message.match(/^claims(\[\d+\])?/)?.[0]]);
  assert.equal(AG.BEARING_CLAIMS_MAX, 50);
  assert.deepEqual(bf(LEGS.map((claim, i) => ({ claim, bearing: AG.BEARINGS[i], ...(i ? {} : { note: "n".repeat(500) }) }))), []);
  assert.deepEqual(bf([{ claim: LEGS[0], bearing: "new_evidence" }]), []);
  assert.deepEqual(bf([{ claim: "INQ-2026-0099-other", bearing: "new_evidence" }]), [["BEARING_REFUSED", "claims[0]"]]);
  assert.deepEqual(bf([{ claim: LEGS[0], bearing: "new_evidence" }, { claim: LEGS[0], bearing: "not_addressed" }]), [["BEARING_REFUSED", "claims[1]"]]);
  for (const bad of [{ claim: LEGS[0], bearing: "agreed" }, { claim: LEGS[0] }, { claim: LEGS[0], bearing: "new_evidence", note: "n".repeat(501) },
    { claim: LEGS[0], bearing: "new_evidence", who: "x" }, null, LEGS[0]])
    assert.deepEqual(bf([bad]), [["BEARING_REFUSED", "claims[0]"]], JSON.stringify(bad));
  for (const bad of [[], undefined, "x", Array.from({ length: 51 }, () => ({ claim: LEGS[0], bearing: "new_evidence" }))])
    assert.deepEqual(bf(bad), [["BEARING_REFUSED", "claims"]], Array.isArray(bad) ? `list of ${bad.length}` : String(bad));
  assert.deepEqual(bf([{ claim: LEGS[0], bearing: "new_evidence" }], null), [["BEARING_REFUSED", "claims[0]"]], "no legs handed in");
  for (const j of JUNK) assert.doesNotThrow(() => AG.bearingFindings(j, j, []));
});

/* ------------------------------------------------------------------------------------------------ R25 */

test("R25: lawStagesFindings reports one LAW_STAGE_UNKNOWN per item whose stage is not a records-request stage of either direction, [] for a well-formed list; stageInLaw answers in_law, not_in_law, or undetermined when the stages are not a list, never in_law for a stage lawStagesFindings reports; negative controls: a list without fee_waiver_request answers not_in_law for it and in_law for appeal, no list undetermined, {stage: mediation} reported", () => {
  const LAW = [{ stage: "request", label: "application", citation: "s.1" }, { stage: "denial", label: "refusal", citation: "s.2" },
    { stage: "appeal", label: "internal review", citation: "s.3" }, { stage: "appeal_decision", label: "review decision", citation: "s.4" }];
  assert.deepEqual(AG.lawStagesFindings(LAW), []);
  assert.equal(AG.stageInLaw("appeal", LAW), "in_law");
  assert.equal(AG.stageInLaw("fee_waiver_request", LAW), "not_in_law");
  for (const v of [undefined, null, "request", {}]) assert.equal(AG.stageInLaw("appeal", v), "undetermined", String(v));
  assert.equal(AG.stageInLaw("appeal", []), "not_in_law");
  const withBad = [...LAW, { stage: "mediation", label: "mediation", citation: "s.9" }, null, { label: "x" }];
  const got = AG.lawStagesFindings(withBad);
  assert.deepEqual(codes(got), ["LAW_STAGE_UNKNOWN", "LAW_STAGE_UNKNOWN", "LAW_STAGE_UNKNOWN"]);
  assert.match(got[0].message, /^stages\[4\]\.stage 'mediation'/);
  assert.equal(AG.stageInLaw("mediation", withBad), "not_in_law", "a reported stage is never in the law");
  for (const v of [undefined, null, "x", {}]) assert.deepEqual(AG.lawStagesFindings(v), [], String(v));
  /* every stage of either direction is known */
  const all = [...AG.CORRESPONDENCE_STAGES.sent, ...AG.CORRESPONDENCE_STAGES.received].map((stage) => ({ stage }));
  assert.deepEqual(AG.lawStagesFindings(all), []);
  /* the test profile's records laws, as jurisdictions R76 holds them: one omits a stage */
  for (const law of TEST_VIEW.records_laws.filter((l) => Array.isArray(l.stages))) {
    assert.deepEqual(AG.lawStagesFindings(law.stages), [], law.name);
    assert.equal(AG.stageInLaw("fee_waiver_request", law.stages), "not_in_law", law.name);
  }
  assert.ok(TEST_VIEW.records_laws.some((l) => !Array.isArray(l.stages) && AG.stageInLaw("appeal", l.stages) === "undetermined"));
});

/* ------------------------------------------------------------------------------------------------ R7 */

test("R7 (T45): the audit also reports the override's ground (only for a premise_override stating one, read from its flat keys), the press holder, copied and partners, press terms, each entry's new fields (no facts handed: words and outcome only), reply_owed and follows_action (with ctx.bundleId), and C-11.1's owed_by arm; negative controls: owed_by us is reported, group and none are not; an override written before T45 with no ground is not reported; the corpus written before T45 is unchanged (grammar.test.mjs, R7)", () => {
  const clock = (o) => base({ clock: [{ ...DOCS["clean-records-request"].clock[0], ...o }] });
  for (const owed of [undefined, null, ...AG.CLOCK_OWED_BY]) assert.deepEqual(audit(clock({ owed_by: owed })), [], String(owed));
  const us = audit(clock({ owed_by: "us" }));
  assert.deepEqual(us.map((x) => [x.check, x.message]), [["C-11.1", "clock[0].owed_by 'us' is not one of: group, body, undetermined"]]);
  /* the override */
  assert.deepEqual(audit(base({ premise_override: { reason: "written before T45" } })), [], "no ground: read as written");
  assert.deepEqual(audit(base({ premise_override: { reason: "r", ground_kind: "legal_deadline", ground_citation: "s.1", ground_date: "2026-08-03" } })), []);
  assert.deepEqual(codes(audit(base({ premise_override: { reason: "r", ground_kind: "legal_deadline", ground_citation: "s.1", ground_date: "2026-02-30" } }))), ["OVERRIDE_GROUND_REFUSED"]);
  assert.deepEqual(codes(audit(base({ premise_override: { reason: "r", ground_kind: "urgency" } }))), ["OVERRIDE_NO_GROUND"]);
  /* the fields, each reported */
  const SELF = "ACTN-2026-0009-this";
  const doc = base({ counterparty: { ...OFFICE, holder: "Jo" }, copied: [OFFICE], partners: [{ name: "Jo Smith" }],
    press_terms: { on_record: "background" }, reply_owed: "no", follows_action: { action: SELF },
    correspondence: [sent({ stage: "request", speaker: "" }), recv({ stage: "denial", follows: "0", outcome: "denied", office_words: "Refused", office_status: "declined", found_elsewhere: "press" })] });
  assert.deepEqual(codes(audit(doc, { bundleId: SELF })), [undefined, "COPIED_IS_ADDRESSEE", "PARTNERS_REFUSED", "PRESS_TERMS_NOT_PRESS",
    "SPEAKER_REFUSED", "FOUND_ELSEWHERE_NEEDS_CAPTURE", "REPLY_OWED_REFUSED", "FOLLOWS_ACTION_SELF"]);
  assert.match(audit(doc, { bundleId: SELF })[0].message, /arm: holder/);
  assert.ok(!codes(audit(doc, { bundleId: SELF })).includes("OFFICE_STATUS_UNKNOWN"), "status is judged at the act, never over history");
  assert.ok(!codes(audit(doc)).includes("FOLLOWS_ACTION_SELF"), "no id handed in");
  assert.deepEqual(codes(audit(base({ correspondence: [sent(), recv({ office_words: "In hand" })] }))), ["OFFICE_STATUS_WITHOUT_OUTCOME"]);
  /* well formed, nothing */
  const clean = base({ counterparty: { ...PRESS, holder: "Jo" }, copied: [OFFICE], partners: [{ role: "co-signer", organisation: "Neighbours" }],
    press_terms: { on_record: "on_record", embargo_until: "2026-08-03T09:00" }, reply_owed: false, reply_owed_reason: "an outlet owes us nothing", follows_action: { action: "ACTN-2026-0005-earlier", ord: 1 },
    clock: [{ ...DOCS["clean-records-request"].clock[0], owed_by: "group" }],
    correspondence: [sent({ stage: "request", speaker: "member:a" }), recv({ account: undefined, author: undefined, artifact_sha: SHA, stage: "denial", follows: "0", outcome: "denied",
      office_words: "Refused", office_status: "declined", found_elsewhere: "press", found_elsewhere_note: "in the paper" })] });
  assert.deepEqual(audit(clean, { bundleId: SELF }), []);
  /* any other document: nothing */
  assert.deepEqual(audit({ ...doc, object_type: "inquiry" }), []);
});

/* ------------------------------------------------------------------------------------------------ R9 */

test("R9 (T45; K2845, K2849): the rows C-117.30–.58 are held in ACTION_CATALOGUE_CHECKS after C-117.29, in R9's order, each {check, where, translation} exactly; the codes actions mints (its R8, R74, R77–R88, its copied fence) name actions' sites, as its job names them, and those action-records now raises its sites (R28); the shape codes this module's arms push name the arm that pushes them; action-holds' and action-replies' codes are no C-117 row (C-149, C-150), BEARING_REFUSED among them; no translation names an op, ruling, check number, record id or place; negative control: no other table holds them", () => {
  const C = AG.ACTION_CATALOGUE_CHECKS;
  const keys = Object.keys(C);
  const t45 = keys.slice(keys.indexOf("SEEKS_REFUSED") + 1);
  assert.deepEqual(t45, ["DETERMINATION_NOT_NONCOMPLIANT", "OVERRIDE_NO_GROUND", "OVERRIDE_GROUND_REFUSED", "COPIED_IS_ADDRESSEE",
    "MACHINE_CANNOT_SET_PARTNERS", "PARTNERS_REFUSED", "MACHINE_CANNOT_SET_PRESS_TERMS", "PRESS_TERMS_NOT_PRESS", "PRESS_TERMS_REFUSED",
    "RECEIPT_NOT_ON_SENT", "OFFICE_STATUS_UNKNOWN", "OFFICE_STATUS_WITHOUT_OUTCOME", "MACHINE_CANNOT_SET_REPLY_OWED", "NO_REPLY_OWED",
    "FOUND_ELSEWHERE_NEEDS_CAPTURE", "STAGE_NOT_IN_LAW", "FOLLOWS_ACTION_REWRITTEN", "FOLLOWS_ACTION_SELF", "MACHINE_CANNOT_SET_SCOPE",
    "SCOPE_NO_REASON", "SCOPE_UNCHANGED", "MACHINE_CANNOT_RECORD_PROMISE", "PROMISE_REFUSED", "FOUND_ELSEWHERE_REFUSED", "SPEAKER_REFUSED",
    "REPLY_OWED_REFUSED", "FOLLOWS_ACTION_REFUSED", "LAW_STAGE_UNKNOWN", "MACHINE_CANNOT_SET_COPIED",
    "MINUTES_NOT_PUBLIC_COMMENT", "BAD_MINUTES"]);
  /* each row as it reads since T46 (R26: twenty-four translate by words.json; t46-words.test.mjs) */
  t45.forEach((code, i) => {
    assert.deepEqual(C[code], ROWS_NOW[code], code);
    assert.equal(C[code].check, `C-117.${30 + i}`, code);
    assert.doesNotMatch(C[code].translation, /\b(bundle|op=|DEC-|C-\d|ENT-|ACTN-|Oakland|Alameda|California)/, code);
  });
  /* actions' sites, as K2849 (2), (3) name them */
  const ACTIONS = {
    DETERMINATION_NOT_NONCOMPLIANT: "#breachRefusal > is-breach-not-noncompliant", OVERRIDE_NO_GROUND: "#overrideAndAddressee > is-override-ground",
    OVERRIDE_GROUND_REFUSED: "#overrideAndAddressee > is-override-ground", MACHINE_CANNOT_SET_PARTNERS: "#t45Fields > is-machine-set-partners",
    MACHINE_CANNOT_SET_PRESS_TERMS: "#t45Fields > is-machine-set-press-terms", MACHINE_CANNOT_SET_REPLY_OWED: "#t45Fields > is-machine-set-reply-owed",
    PARTNERS_REFUSED: "#t45Fields > is-partners-entity", FOLLOWS_ACTION_REWRITTEN: "#t45Fields > is-follows-action-rewritten",
    NO_REPLY_OWED: "actionCorrespond > is-no-reply-owed", STAGE_NOT_IN_LAW: "actionCorrespond > is-stage-in-law",
    MACHINE_CANNOT_SET_COPIED: "#t45Fields > is-machine-set-copied",
  };
  for (const [code, site] of Object.entries(ACTIONS)) assert.equal(C[code].where, `src/actions/index.mjs ${site}`, code);
  /* R28 (T47; N961): the receipt, scope and promise acts moved to action-records, and their rows' sites with them. */
  const RECORDS = {
    RECEIPT_NOT_ON_SENT: "actionReceipt > is-receipt-on-sent", MACHINE_CANNOT_SET_SCOPE: "actionScope > is-scope", SCOPE_NO_REASON: "actionScope > is-scope",
    SCOPE_UNCHANGED: "actionScope > is-scope", MACHINE_CANNOT_RECORD_PROMISE: "actionPromise > is-promise", PROMISE_REFUSED: "actionPromise > is-promise",
  };
  for (const [code, site] of Object.entries(RECORDS)) assert.equal(C[code].where, `src/action-records/index.mjs ${site}`, code);
  const tables = ["ACTION_FENCE_CHECKS", "ACTION_ACT_CHECKS", "GOVERNING_LAW_CHECKS", "QUOTE_CHECKS", "LIFECYCLE_CHECKS", "RISK_TIER_REVISION_CHECKS", "RECORDS_LAW_FENCE_CHECKS"];
  for (const t of tables) for (const code of t45) assert.ok(!(code in AG[t]), `${code} in ${t}`);
  const ALL = Object.assign({}, ...tables.map((t) => AG[t]), C);
  /* the rows held here are the C-117 family, each naming its site in this module or in actions' files; a row of action-holds or
     action-replies names its own, so none of theirs is held here */
  for (const [code, row] of Object.entries(ALL)) assert.match(row.where, /^src\/(actions\/index|action-grammar\/checks|action-records\/index)\.mjs /, code);
  /* the codes this module's arms push, each with its row: the shape codes by the arm its where names */
  const ARMS = {
    overrideGroundFindings: pushed((f) => { AG.overrideGroundFindings({}, f); AG.overrideGroundFindings({ ground: { kind: "legal_deadline" } }, f); }).findings,
    copiedFindings: pushed((f) => AG.copiedFindings({ counterparty: OFFICE, copied: [OFFICE, null] }, f)).findings,
    partnersFindings: pushed((f) => AG.partnersFindings({ partners: [{}] }, f)).findings,
    pressTermsFindings: pushed((f) => AG.pressTermsFindings({ counterparty: OFFICE, press_terms: {} }, f)).findings,
    entryFieldFindings: AG.entryFieldFindings([sent({ office_words: "x", office_status: "y", found_elsewhere: "press" }), recv({ speaker: "m" })], 0)
      .concat(AG.entryFieldFindings([recv({ speaker: "m", outcome: "granted", office_words: "x", office_status: "y", found_elsewhere: "press" })], 0)),
    actionFieldFindings: pushed((f) => AG.actionFieldFindings({ reply_owed: 1, follows_action: 1 }, {}, f)).findings
      .concat(pushed((f) => AG.actionFieldFindings({ follows_action: { action: "ACTN-2026-0001-x" } }, { bundleId: "ACTN-2026-0001-x" }, f)).findings),
    lawStagesFindings: AG.lawStagesFindings([{ stage: "x" }]),
  };
  const pushedCodes = new Set();
  for (const [fn, found] of Object.entries(ARMS)) {
    assert.ok(found.length, fn);
    for (const x of found) {
      assert.equal(x.check, "C-2.10", x.code); assert.equal(x.severity, "error", x.code);
      if (x.code === "COUNTERPARTY_REFUSED") { assert.equal(fn, "copiedFindings"); continue; }
      assert.ok(x.code in C, `${fn}: ${x.code}`);
      pushedCodes.add(x.code);
      if (!(x.code in ACTIONS) && !(x.code in RECORDS)) assert.equal(C[x.code].where.split(" > ")[0], `src/action-grammar/checks.mjs ${fn}`, x.code);
    }
  }
  assert.deepEqual([...pushedCodes].sort(), ["COPIED_IS_ADDRESSEE", "FOLLOWS_ACTION_REFUSED", "FOLLOWS_ACTION_SELF", "FOUND_ELSEWHERE_NEEDS_CAPTURE",
    "FOUND_ELSEWHERE_REFUSED", "LAW_STAGE_UNKNOWN", "OFFICE_STATUS_UNKNOWN", "OFFICE_STATUS_WITHOUT_OUTCOME", "OVERRIDE_GROUND_REFUSED", "OVERRIDE_NO_GROUND",
    "PARTNERS_REFUSED", "PRESS_TERMS_NOT_PRESS", "PRESS_TERMS_REFUSED", "REPLY_OWED_REFUSED", "SPEAKER_REFUSED"]);
  assert.deepEqual(codes(pushed((f) => AG.bearingFindings([], [], f)).findings), ["BEARING_REFUSED"], "R24's code, action-replies' row");
  /* C-117.19, the override's reason (K2849 (4)) */
  assert.match(C.PREMISE_OVERRIDE_REFUSED.translation, /^The reason the team acts without a determination/);
});

/* ------------------------------------------------------------------------------------------------ R11 */

test("R11 (T45): the phrasing lists name no place, office or person; the test profile extends them with a phrasing per kind in English, and a second test profile in a second language does the same: a text in that language is undetermined with no profile's phrasings and pointed out with them; the English test-profile phrasings are pointed out only with the profile", () => {
  /* the test profile's own phrasings (jurisdictions R86, R84), one per kind */
  const own = TEST_VIEW.phrasings;
  assert.deepEqual([...new Set(own.map((p) => p.kind))].sort(), [...AG.PHRASING_KINDS].sort());
  for (const p of own) {
    assert.equal(p.locale.split("-")[0].toLowerCase(), "en", p.phrase);
    const sentence = `It is said that ${p.phrase} here.`;
    assert.deepEqual(AG.pointOut({ sentences: [sentence], language: "en", kind: p.kind }).pointed.filter((x) => x.phrase === p.phrase), [], `${p.phrase} without the profile`);
    assert.deepEqual(AG.pointOut({ sentences: [sentence], language: "en", kind: p.kind, view: TEST_VIEW }).pointed.filter((x) => x.phrase === p.phrase)
      .map((x) => x.origin), ["profile"], `${p.phrase} with the profile`);
  }
  /* a second language, from a second test profile beside it (jurisdictions combines a profile object; R86's shape) */
  const second = { id: "test-second-language", name: "Second-language test profile", covers: ["Test Town"], test: true,
    phrasings: [{ locale: "es", kind: "assertion", phrase: "de forma ilegal", basis: "TEST" }, { locale: "es", kind: "position", phrase: "votad en contra", basis: "TEST" },
      { locale: "es", kind: "own_benefit_ask", phrase: "páguennos", basis: "TEST" }] };
  assert.deepEqual(J.validate(second), { ok: true, errors: [] });
  const both = J.combine(["test-port-ellery", second]);
  assert.ok(both.ok);
  const es = ["El personal dividió el contrato de forma ilegal.", "Pedimos al Auditor que examine las órdenes.", "¡Votad en contra!", "Páguennos ya."];
  for (const kind of AG.PHRASING_KINDS)
    assert.deepEqual(AG.pointOut({ sentences: es, language: "es", kind }), { state: "undetermined", why: "no_list" }, `${kind} without a profile`);
  assert.deepEqual(AG.pointOut({ sentences: es, language: "es", kind: "assertion", view: both.view }).pointed.map((x) => [x.index, x.phrase, x.origin]), [[0, "de forma ilegal", "profile"]]);
  assert.deepEqual(AG.pointOut({ sentences: es, language: "es", kind: "position", view: both.view }).pointed.map((x) => x.index), [2]);
  assert.deepEqual(AG.pointOut({ sentences: es, language: "es-MX", kind: "own_benefit_ask", view: both.view }).pointed.map((x) => x.index), [3]);
  /* the English lists still apply under the combined view, and the Spanish ones do not reach English */
  assert.deepEqual(AG.pointOut({ sentences: ["Votad en contra.", "It was illegal."], language: "en", kind: "assertion", view: both.view }).pointed.map((x) => x.index), [1]);
});

/* ------------------------------------------------------------------------------------------------ R10 */

test("R10 (T45): every T45 function is pure: deeply frozen inputs are read without change, the same inputs give the same answers, and none throws on junk", () => {
  const sentences = freeze(["Staff illegally split the contract.", "We support it."]);
  const view = freeze(structuredClone(TEST_VIEW));
  const p1 = AG.pointOut({ sentences, language: "en-GB", kind: "assertion", view });
  assert.deepEqual(AG.pointOut({ sentences, language: "en-GB", kind: "assertion", view }), p1);
  const res = freeze([{ sentence: sentences[0], resolution: "breach_claim" }]);
  assert.deepEqual(AG.assertionsUnresolved({ sentences, pointed: freeze(p1), resolutions: res }), AG.assertionsUnresolved({ sentences, pointed: p1, resolutions: res }));
  const doc = freeze(base({ copied: [OFFICE], partners: [{ name: "x" }], press_terms: {}, reply_owed: 1, premise_override: { ground: {} },
    correspondence: [sent({ speaker: 5 }), recv({ office_status: {} })] }));
  const a1 = audit(doc);
  assert.deepEqual(audit(doc), a1);
  assert.ok(a1.length > 0);
  for (const j of JUNK) assert.doesNotThrow(() => {
    AG.overrideGroundFindings(j, []); AG.copiedFindings(j, []); AG.partnersFindings(j, []); AG.pressTermsFindings(j, []);
    AG.entryFieldFindings(j, 0, j); AG.actionFieldFindings(j, j, []); AG.bearingFindings(j, j, []); AG.lawStagesFindings(j);
    AG.stageInLaw(j, j); AG.phrasingsFor(j); AG.pointOut(j); AG.assertionResolutionFindings(j, []); AG.assertionsUnresolved(j);
    AG.checkActionExtension({ fm: j, nowMs: NOW }, []); AG.checkActionExtension({ fm: { ...(j && typeof j === "object" ? j : {}), object_type: "action" }, nowMs: NOW }, []);
    AG.readAs(j);
  }, JSON.stringify(j));
});
