/* standards: where a standard sits in its law (R18, R19; T33-31, K1446). Every test drives the module at its interface,
   over the test profile (`test-port-ellery`) and profiles the test writes; no place is named in the behaviour. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, BYLAW, REASON, profile, src } from "./fixture.mjs";
import { STANDARDS_CHECKS, instrumentKey, COPY_STATES } from "../../../src/standards/index.mjs";
import { get as profileOf, combine } from "../../../../jurisdictions/index.mjs";

const codeOf = (r) => (r && r.ok === false ? r.reason : "ok");
const testView = () => combine(["test-port-ellery"]).view;

test("R18 instrumentKey composes an ELI-shaped key only from profile data (the view's instrument_key segment, the matched source's key, the cite's number or section path), and answers undetermined with why for a source with no key, no instrument_key, no match, no number or no profile", () => {
  const view = testView();
  assert.deepEqual([instrumentKey({ cite: "PEBL § 12", view }).state, instrumentKey({ cite: "PEBL § 12", view }).key],
                   ["composed", "/eli/xx-port-ellery/selectboard/12"]);
  /* the code's own section-number form wins where the cite states one */
  assert.equal(instrumentKey({ cite: "PEBL § 12-3", view }).key, "/eli/xx-port-ellery/selectboard/12-3");
  /* subsection markers name a portion, never the key */
  assert.equal(instrumentKey({ cite: "PEBL § 14(a)(2)", view }).key, "/eli/xx-port-ellery/selectboard/14");
  const noKey = instrumentKey({ cite: "MCBC 2024-7", view });
  assert.deepEqual([noKey.state, noKey.key], ["undetermined", null]);
  assert.match(noKey.why, /states no key segment/);
  assert.match(instrumentKey({ cite: "Some Code § 4", view }).why, /matches the citation form of no source/);
  assert.match(instrumentKey({ cite: "PEBL § 12", view: null }).why, /no active jurisdiction profile/);
  /* a profile with sources keyed but no instrument_key segment */
  const p = profile("pk", [src("Act K", "\\bAK\\s+\\d+", { key: "assembly" })]);
  assert.match(instrumentKey({ cite: "AK 4", view: combine([p]).view }).why, /no instrument_key segment/);
  const q = { ...p, id: "pk2", instrument_key: { jurisdiction: "zz-elsewhere", basis: "TEST" } };
  assert.equal(instrumentKey({ cite: "AK 4", view: combine([q]).view }).key, "/eli/zz-elsewhere/assembly/4", "another profile, its own segment");
  /* never throws, whatever it is handed */
  for (const cite of [null, 7, {}, "", "PEBL §"]) assert.equal(instrumentKey({ cite, view }).state, "undetermined", String(cite));
  assert.equal(instrumentKey().state, "undetermined");
  /* no place in code: the only segments are the profiles' */
  assert.ok(!/oakland|alameda/i.test(JSON.stringify(instrumentKey({ cite: "PEBL § 12", view }))));
  assert.equal(profileOf("test-port-ellery").instrument_key.jurisdiction, "xx-port-ellery");
});

test("R18 a declaration composes and keeps its instrument key; a declared instrument must be that key (STANDARD_FIELD_INVALID otherwise); a portion is {path, content_id} with its extent among the standard's text (STANDARD_PORTION_NOT_IN_TEXT otherwise); standards sharing a key are its versions; R1's refusals come first", () => {
  const w = seeded();
  const a = w.passage().contentId, b = w.passage().contentId, other = w.passage().contentId;
  const r = w.declare({ text: [a, b], portion: { path: "12(a)", content_id: b } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual([r.instrument.state, r.instrument.key], ["composed", "/eli/xx-port-ellery/selectboard/12"]);
  assert.deepEqual(r.portion, { path: "12(a)", content_id: b });
  assert.deepEqual(w.s.standardRead({ id: r.id, viewer: V("carol") }).instrument, r.instrument, "read back");
  /* the declared instrument: the composed key is accepted, any other refused naming the field */
  assert.equal(w.declare({ instrument: "/eli/xx-port-ellery/selectboard/12" }).ok, true);
  const before = w.snapshot();
  const wrong = w.declare({ text: [a], instrument: "/eli/elsewhere/x/12" });
  assert.deepEqual([wrong.reason, wrong.field, wrong.check], ["STANDARD_FIELD_INVALID", "instrument", STANDARDS_CHECKS.STANDARD_FIELD_INVALID.check]);
  assert.match(w.declare({ text: [a], cite: "MCBC 2024-1", kind: "commitment", instrument: "/eli/x/y/1" }).detail, /cannot be given/);
  /* portions */
  const notText = w.declare({ text: [a], portion: { path: "12(b)", content_id: other } });
  assert.deepEqual([notText.reason, notText.check], ["STANDARD_PORTION_NOT_IN_TEXT", STANDARDS_CHECKS.STANDARD_PORTION_NOT_IN_TEXT.check]);
  for (const portion of ["12(a)", { path: "" , content_id: a }, { path: "x".repeat(201), content_id: a }, { path: "1", content_id: a, extra: 1 }, { path: "1" }])
    assert.deepEqual([codeOf(w.declare({ text: [a], portion })), w.declare({ text: [a], portion }).field], ["STANDARD_FIELD_INVALID", "portion"], JSON.stringify(portion));
  assert.deepEqual(w.snapshot(), before, "a refused field writes nothing");
  /* R1's refusals are asked before the fields R18–R19 add */
  assert.equal(codeOf(w.declare({ period: { from: "2020-13-01" }, portion: "bad" })), "STANDARD_PERIOD_INVALID");
  assert.equal(codeOf(w.declare({ reason: "", instrument: "/eli/x" })), "STANDARD_NO_REASON");
  /* versions: every standard declared under one key is a version of it */
  const v2 = w.declare({ cite: "P.E.B.L. § 12", period: { from: "2031-01-01", to: null } });
  assert.equal(v2.instrument.key, r.instrument.key, "another spelling of the cite, one instrument");
  const u = w.declare({ cite: "MCBC 2024-7", kind: "commitment", issuer: "Marlow County Commission" });
  assert.deepEqual([u.instrument.state, u.instrument.key], ["undetermined", null], "no key segment: no key, never one in code");
});

test("R19 requires lists the portion's passages that state what it requires, among the standard's text, quoted as captured; copy is official, codifier or undetermined, defaulting to the source code's copy and stated beside a differing declaration; current_through is a date with its captured basis; period_basis is a cited passage or an enactment event and edge; malformed values are STANDARD_FIELD_INVALID naming the field", () => {
  const w = seeded();
  const words = "The clerk shall post notice of every meeting.";
  const a = w.passage("law", { text: words }), b = w.passage().contentId, banner = w.passage("banner").contentId;
  const r = w.declare({ text: [a.contentId, b], requires: [a.contentId] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(r.requires, [a.contentId]);
  const read = w.s.standardRead({ id: r.id, viewer: V("carol") });
  assert.deepEqual(read.requires_quoted, [{ content_id: a.contentId, text: words }], "quoted, never paraphrased");
  for (const requires of [[w.passage().contentId], [], "x", [7]])
    assert.deepEqual([codeOf(w.declare({ text: [b], requires })), w.declare({ text: [b], requires }).field], ["STANDARD_FIELD_INVALID", "requires"]);
  /* copy: the matched source's code states `official` in the test profile; a source with no code is undetermined */
  assert.deepEqual(COPY_STATES, ["official", "codifier", "in_force", "draft", "superseded", "production", "vendor_model", "undetermined"]);
  assert.deepEqual(r.copy, { copy: "official", source_copy: "official", declared: false });
  const cod = w.declare({ copy: "codifier" });
  assert.deepEqual([cod.copy.copy, cod.copy.source_copy, cod.copy.declared], ["codifier", "official", true]);
  assert.match(cod.copy.says, /recorded as declared; the matched source's code states official/);
  assert.equal(w.declare({ cite: "MCBC 2024-2", kind: "commitment" }).copy.copy, "undetermined", "no code: undetermined");
  assert.equal(w.declare({ cite: "Some Code § 1" }).copy.copy, "undetermined", "no match: undetermined");
  assert.equal(w.declare({ copy: "official" }).copy.says, undefined, "as the source states: nothing said");
  assert.deepEqual([w.declare({ copy: "photocopy" }).reason, w.declare({ copy: "photocopy" }).field], ["COPY_UNKNOWN", "copy"], "R36");
  /* current_through */
  const ct = w.declare({ copy: "codifier", current_through: { date: "2025-06-30", basis: banner } });
  assert.deepEqual(ct.current_through, { date: "2025-06-30", basis: banner });
  for (const current_through of [{ date: "2025-06-31", basis: banner }, { date: "2025-06-30" }, { date: "2025-06-30", basis: "f".repeat(64) }, "2025-06-30"])
    assert.equal(w.declare({ current_through }).field, "current_through", JSON.stringify(current_through));
  assert.equal(w.declare().current_through, null, "not stated");
  /* period_basis */
  const pe = w.declare({ period: { from: null, to: null }, period_basis: { from: { event: "EVT-2026-abcdefghijklmnop", edge: "start" }, to: { passage: b } } });
  assert.equal(pe.ok, true, JSON.stringify(pe).slice(0, 300));
  assert.deepEqual(pe.period_basis, { from: { event: "EVT-2026-abcdefghijklmnop", edge: "start" }, to: { passage: b } });
  const both = w.declare({ period: { from: "2020-01-01" }, period_basis: { from: { event: "EVT-2026-abcdefghijklmnop", edge: "start" } } });
  assert.deepEqual([both.reason, both.field], ["STANDARD_FIELD_INVALID", "period_basis"]);
  assert.match(both.detail, /never both/);
  for (const period_basis of [{ from: { event: "EVT-2026-short", edge: "start" } }, { from: { event: "EVT-2026-abcdefghijklmnop", edge: "middle" } },
                              { since: { passage: b } }, { from: { passage: "f".repeat(64) } }, "a passage", { from: { passage: b, event: "x" } }])
    assert.equal(w.declare({ period: null, period_basis }).field, "period_basis", JSON.stringify(period_basis));
  assert.equal(w.declare().period_basis, null);
});

test("R12 R18 R19 the fields R18–R19 add are the act's own; any other is still refused STANDARD_FIELD_UNKNOWN by name, and an adoption takes them too", () => {
  const w = seeded();
  const t = w.passage().contentId;
  assert.deepEqual(w.declare({ merit: 1 }).rejected, ["merit"]);
  const p = w.s.standardPropose({ cite: BYLAW, why: "w", proposer: V("carol"), text: [t] }).proposal;
  const a = w.s.standardAdopt({ proposal: p.id, author: V("bob"), kind: "ordinance", issuer: "S", reason: REASON,
                                portion: { path: "12(c)", content_id: t }, copy: "codifier" });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  assert.deepEqual([a.portion.path, a.copy.copy, a.instrument.key], ["12(c)", "codifier", "/eli/xx-port-ellery/selectboard/12"]);
});
