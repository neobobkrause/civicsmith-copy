/* jurisdictions, T50 (T50-54; N1121, N1190; DEC-252, DEC-259, DEC-300 (1)): R93 `records_help` and R94 `forums`. Tested at the
 * module's interface: the exports, validate, combine and the held profiles. Every refusal is shown beside a well-formed control.
 * The first profile's own block and forums wait on a read of the statute's text and the courts' pages (the job's record). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, validate, combine, SECTIONS, FORUM_KINDS, RECORDS_HELP_CITATIONS } from "../index.mjs";
import { walkFacts } from "./helpers.mjs";

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));

const help = (over = {}) => ({ law: "Sample Records Act", days: 10, extra_days: 14,
  extension_reasons: [{ reason: "records kept elsewhere", citation: "Sample Code § 2(b)(1)" }],
  citations: Object.fromEntries(RECORDS_HELP_CITATIONS.map((k) => [k, `Sample Code § 3(${k})`])),
  status: "researched", basis: "2026-10-17", ...over });
const bare = (over) => ({ id: "sample-town", name: "Sample Town", covers: ["Sample Town"], test: false, ...over });
const breakHelp = (fn) => { const p = bare({ records_help: help() }); fn(p.records_help); return validate(p); };
const other = (fn = () => {}) => { const p = get(TEST); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };

test("R93 records_help is a known section; a well-formed block, with and without portal and faster, is accepted", () => {
  assert.ok(SECTIONS.includes("records_help"));
  assert.deepEqual([...RECORDS_HELP_CITATIONS], ["answer", "extend", "assist", "segregate", "refuse_in_writing", "electronic",
    "cost", "cost_electronic", "inspect_photograph", "purpose"]);
  assert.deepEqual(validate(bare({ records_help: help() })).errors, []);
  const full = help({ portal: { name: "Records Portal", url: "https://records.sample.example/" },
    faster: { ordinance: "Sample Ordinance", window: "3 days", request: "quick request", citation: "Sample Ord. § 9" } });
  assert.deepEqual(validate(bare({ records_help: full })).errors, []);
});

test("R93 a block missing days, or with any field of the wrong type, is refused naming the field; each beside the well-formed control", () => {
  assert.ok(validate(bare({ records_help: help() })).ok);
  for (const [field, mut] of [
    ["days", (h) => { delete h.days; }], ["days", (h) => { h.days = "10"; }], ["days", (h) => { h.days = 0; }],
    ["extra_days", (h) => { delete h.extra_days; }], ["extra_days", (h) => { h.extra_days = 1.5; }],
    ["law", (h) => { h.law = ""; }], ["extension_reasons", (h) => { h.extension_reasons = []; }],
    ["extension_reasons[0].citation", (h) => { h.extension_reasons[0].citation = ""; }],
    ["portal.url", (h) => { h.portal = { name: "P", url: "not an address" }; }], ["portal.name", (h) => { h.portal = { name: "", url: "https://a.example/" }; }],
    ["faster.window", (h) => { h.faster = { ordinance: "O", window: "", request: "r", citation: "c" }; }],
    ["citations", (h) => { h.citations = "Sample Code"; }],
    ...RECORDS_HELP_CITATIONS.map((k) => [`citations.${k}`, (h) => { delete h.citations[k]; }]),
  ]) {
    const r = breakHelp(mut);
    assert.ok(!r.ok, field);
    assert.ok(hasError(r, "VALUE_INVALID", `records_help.${field}`), `${field}: ${JSON.stringify(r.errors)}`);
  }
  assert.ok(hasError(breakHelp((h) => { h.surprise = 1; }), "UNKNOWN_SECTION", "records_help.surprise"));
  assert.ok(hasError(breakHelp((h) => { h.citations.surprise = "x"; }), "UNKNOWN_SECTION", "records_help.citations.surprise"));
  assert.ok(hasError(validate(bare({ records_help: "help" })), "VALUE_INVALID", "records_help"));
});

test("R93 a block is researched and rests on a dated read: UNMEASURED, a ruling, a missing basis or another status is refused", () => {
  assert.ok(hasError(breakHelp((h) => { h.basis = "UNMEASURED"; }), "BASIS_INVALID", "records_help.basis"));
  assert.ok(hasError(breakHelp((h) => { h.basis = "K123"; }), "BASIS_INVALID", "records_help.basis"));
  assert.ok(hasError(breakHelp((h) => { h.basis = "M-12"; }), "BASIS_INVALID", "records_help.basis"));
  assert.ok(hasError(breakHelp((h) => { delete h.basis; }), "BASIS_MISSING", "records_help.basis"));
  assert.ok(hasError(breakHelp((h) => { h.status = "ruled"; }), "BASIS_INVALID", "records_help.status"));
  assert.ok(hasError(breakHelp((h) => { h.basis = "TEST"; }), "BASIS_INVALID", "records_help.basis"));
  assert.ok(validate(bare({ records_help: help({ basis: "2026-10-17 CPRA" }) })).ok);
});

test("R93 the test profile holds a block differing from every value a real block would hold; combine with it keeps one profile's block, and two differing blocks give none", () => {
  const t = get(TEST);
  assert.ok(validate(t).ok);
  assert.ok(t.records_help && t.records_help.basis === "TEST");
  assert.equal(t.records_help.faster.request, "quick look");
  const r = combine([TEST]);
  assert.deepEqual(r.view.records_help.days, 7);
  assert.equal(r.view.records_help.profile, TEST);
  /* equal blocks in two profiles: kept once, both bases carried */
  const same = combine([TEST, other()]);
  assert.ok(same.ok); assert.equal(same.view.records_help.days, 7);
  assert.deepEqual(same.view.records_help.bases.map((b) => b.profile), [TEST, "test-other"]);
  assert.equal(same.conflicts.filter((c) => c.at === "records_help").length, 0);
  /* differing: withheld and reported */
  const diff = combine([TEST, other((p) => { p.records_help.days = 9; })]);
  assert.ok(diff.ok);
  assert.equal(diff.view.records_help, undefined);
  const c = diff.conflicts.find((x) => x.at === "records_help");
  assert.ok(c); assert.equal(c.values.length, 2);
  /* a profile with no block beside one with: the block stands */
  const solo = combine([bare({}), TEST]);
  assert.equal(solo.view.records_help.days, 7);
});

test("R93 the first profile gives no default: it holds a block only as researched, and a held block validates with every citation naming a section", () => {
  const f = get(FIRST);
  assert.ok(validate(f).ok);
  if (f.records_help) {
    assert.equal(f.records_help.status, "researched");
    for (const k of RECORDS_HELP_CITATIONS) assert.match(f.records_help.citations[k], /§|section/i, k);
  }
  const t = get(TEST);
  for (const k of RECORDS_HELP_CITATIONS) assert.match(t.records_help.citations[k], /§/, k);
});

test("R94 forums is a known section; FORUM_KINDS is R51's vocabulary; a well-formed forum with and without ids is accepted", () => {
  assert.ok(SECTIONS.includes("forums"));
  assert.deepEqual([...FORUM_KINDS], ["court", "commission", "grand_jury", "auditor", "other"]);
  const ok = (forums, extra = {}) => validate(bare({ forums, ...extra }));
  assert.deepEqual(ok([{ label: "Sample Superior Court", forum_kind: "court", basis: "2026-10-17" }]).errors, []);
  assert.deepEqual(ok([{ label: "Sample Court", forum_kind: "court", ids: [{ scheme: "court_no", id: "7" }], basis: "2026-10-17" }], {
    spaces: { institution: { label: "Registry numbers", forms: [{ form: "n", pattern: { re: "^\\d+$" }, normal: ["x"], basis: "2026-10-17" }] } },
    identifier_schemes: [{ scheme: "court_no", label: "Court number", entity_kinds: ["forum"], space: "institution", form: "n", basis: "2026-10-17" }],
  }).errors, []);
});

test("R94 a forum with an unknown forum_kind is refused naming it; so are a missing label, a duplicate, empty ids, an unknown scheme and a scheme not identifying a forum", () => {
  const good = { label: "Sample Court", forum_kind: "court", basis: "2026-10-17" };
  assert.ok(validate(bare({ forums: [good] })).ok);
  const bad = (f, extra) => validate(bare({ forums: [{ ...good, ...f }], ...extra }));
  assert.ok(hasError(bad({ forum_kind: "tribunal" }), "VALUE_INVALID", "forums[0].forum_kind"));
  assert.ok(hasError(bad({ label: "" }), "VALUE_INVALID", "forums[0].label"));
  assert.ok(hasError(validate(bare({ forums: [good, good] })), "VALUE_INVALID", "forums[1].label"));
  assert.ok(hasError(bad({ ids: [] }), "VALUE_INVALID", "forums[0].ids"));
  assert.ok(hasError(bad({ ids: [{ scheme: "nope", id: "1" }] }), "SCHEME_INVALID", "forums[0].ids[0].scheme"));
  assert.ok(hasError(bad({ ids: [{ scheme: "p", id: "1" }] }, {
    spaces: { person: { label: "People", forms: [{ form: "n", pattern: { re: "^\\d+$" }, normal: ["x"], basis: "2026-10-17" }] } },
    identifier_schemes: [{ scheme: "p", label: "Person", entity_kinds: ["person"], space: "person", form: "n", basis: "2026-10-17" }] }),
    "SCHEME_INVALID", "forums[0].ids[0].scheme"));
  assert.ok(hasError(bad({ basis: undefined }), "BASIS_MISSING", "forums[0].basis"));
  assert.ok(hasError(bad({ basis: "UNKNOWN" }), "BASIS_INVALID", "forums[0].basis"));
  assert.ok(hasError(bad({ surprise: 1 }), "UNKNOWN_SECTION", "forums[0].surprise"));
  assert.ok(hasError(validate(bare({ forums: "court" })), "VALUE_INVALID", "forums"));
});

test("R94 the test profile holds a court and a commission with proceeding kinds for them; combine keeps the union and a forum given twice once", () => {
  const t = get(TEST);
  assert.ok(validate(t).ok);
  assert.ok(t.forums.some((f) => f.forum_kind === "court") && t.forums.some((f) => f.forum_kind === "commission"));
  for (const f of t.forums) assert.ok(t.proceeding_kinds.some((k) => k.forum_kind === f.forum_kind), f.label);
  const twice = combine([TEST, other()]);
  assert.equal(twice.view.forums.length, t.forums.length);
  assert.deepEqual(twice.view.forums[0].bases.map((b) => b.profile), [TEST, "test-other"]);
  const union = combine([TEST, other((p) => { p.forums.push({ label: "Another Bench (test)", forum_kind: "court", basis: "TEST" }); })]);
  assert.equal(union.view.forums.length, t.forums.length + 1);
  assert.equal(union.view.forums.at(-1).label, "Another Bench (test)");
});

test("R94 the first profile validates; any forum it holds is a court or other forum of a kind its proceeding_kinds serve, with a basis", () => {
  const f = get(FIRST);
  assert.ok(validate(f).ok);
  for (const x of f.forums || []) {
    assert.ok(x.basis); assert.ok(f.proceeding_kinds.some((k) => k.forum_kind === x.forum_kind), x.label);
  }
  let facts = 0;
  walkFacts(f, (o) => { if (o && o.basis) facts++; });
  assert.ok(facts > 0);
});
