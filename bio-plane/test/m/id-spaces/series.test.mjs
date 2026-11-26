/* recogniseSeries' requirement-named tests (build/requirements/id-spaces.md R30–R33): policy-series citations and
 * standard designations, read from the view's `standard_sources` series (jurisdictions R63) and nothing else. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { recogniseSeries } from "../../../src/idspaces.mjs";
import { HARBOR, LAKESHORE, SERIES, viewOf, withSeries } from "./fixtures.mjs";
/** @import { IdView, SeriesCitation } from "../../../src/idspaces.mjs" */
/** @import { ViewStandardSource, Conflict } from "../../../../jurisdictions/index.mjs" */

const H = viewOf(HARBOR);
const HS = withSeries(H);
const FIELDS = ["key", "series", "label", "kind", "issuer", "number", "normal", "portion", "edition", "start", "end", "basis", "profile"];
/** @param {SeriesCitation | undefined} c */
const read = (c) => [c?.key, c?.series, c?.number, c?.normal, c?.portion ?? null, c?.edition ?? null];
/** The fixture's series entry at `i`. @param {number} i @returns {ViewStandardSource} */
const at = (i) => { const s = SERIES[i]; assert.ok(s, `SERIES[${i}]`); return s; };
/** @typedef {{ readonly [key: string]: unknown }} Fields */
/** @param {unknown} o @returns {o is Fields} */
const isFields = (o) => o !== null && typeof o === "object";
/** @param {unknown} o */
const freezeAll = (o) => { if (isFields(o) && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) freezeAll(v); } };
/** A value and everything in it frozen. @template T @param {T} o @returns {T} */
const deepFreeze = (o) => { freezeAll(o); return o; };

test("R30 every citation of a series the view supplies is found, in reading order, with its entry's fields and offsets", () => {
  const text = "Under AI 4.12 §3 and DGO k-03, see SO 9196; BP 0410 and COC-7 apply; staffing per TSA 1710, 2020 edition and TSA 1221.";
  const r = recogniseSeries(HS, text);
  assert.equal(r.undetermined, undefined, JSON.stringify(r.undetermined));
  assert.deepEqual(r.citations.map(read), [
    ["harbor", "ai", "4.12", "4.12", "3", null], ["harbor-pd", "dgo", "k-03", "K-03", null, null], ["harbor-pd", "so", "9196", "9196", null, null],
    ["harbor-usd", "bp", "0410", "BP 410", null, null], ["tidewater", "coc", "7", "7", null, null], ["tsa", "std", "1710", "1710", null, "2020"],
    ["tsa", "std", "1221", "1221", null, null]]);
  assert.deepEqual(r.citations.map((c) => text.slice(c.start, c.end)),
    ["AI 4.12 §3", "DGO k-03", "SO 9196", "BP 0410", "COC-7", "TSA 1710, 2020 edition", "TSA 1221"]);
  assert.ok(r.citations.every((c, i, all) => i === 0 || (all[i - 1]?.end ?? Infinity) <= c.start), "reading order");
  for (const c of r.citations) {
    const e = SERIES.find((s) => s.key === c.key && s.series?.key === c.series);
    assert.ok(e);
    assert.deepEqual([c.label, c.kind, c.issuer, c.basis, c.profile], [e.series?.label, e.kind, e.issuer, e.basis, e.profile]);
    assert.deepEqual(Object.keys(c).filter((k) => !FIELDS.includes(k)), [], "no field beyond R30's");
  }
  /* the edition written either way the pattern reads it; the normal never changes a digit (R4) */
  assert.deepEqual(read(recogniseSeries(HS, "NFPA? no: TSA 1710-2013").citations[0]), ["tsa", "std", "1710", "1710", null, "2013"]);
  for (const c of r.citations) assert.equal(c.normal.replace(/\D/g, "").replace(/^0+/, ""), c.number.replace(/\D/g, "").replace(/^0+/, ""));
  /* a view without those series recognises none of them, whatever the text */
  assert.deepEqual(recogniseSeries(withSeries(H, SERIES.slice(0, 1)), text).citations.map((c) => c.series), ["ai"]);
});

test("R31 an edition not written is never supplied; overlapping readings of different families are listed, never chosen; withheld families are named", () => {
  const plain = recogniseSeries(HS, "TSA 1710 governs; TSA 1710, 2020 edition is cited later.").citations;
  assert.equal(plain.length, 2);
  const [first, second] = plain;
  assert.ok(first && second);
  assert.ok(!("edition" in first), "no edition is defaulted, the latest or any other");
  assert.equal(second.edition, "2020");
  const policy = recogniseSeries(HS, "AI 4.12").citations[0];
  assert.ok(policy);
  assert.ok(!("edition" in policy), "a policy carries no edition");
  /* two families read one run of text: ambiguous, every reading listed */
  const { level: _level, ...unlevelled } = at(0);
  /** @type {ViewStandardSource} */
  const rival = { ...unlevelled, key: "tidewater", series: { key: "ai", label: "Tidewater Admin Item" }, issuer: "Tidewater Corp", sector: "company" };
  const amb = recogniseSeries(withSeries(H, [at(0), rival]), "See AI 4.12 §3 and SO 9196.");
  const ambUndetermined = amb.undetermined;
  assert.deepEqual(amb.citations, []);
  assert.deepEqual(ambUndetermined?.ambiguous?.map((a) => [a.text, a.readings.map((x) => `${x.key}/${x.series}`)]),
    [["AI 4.12 §3", ["harbor/ai", "tidewater/ai"]]]);
  assert.match(ambUndetermined?.why ?? "", /never one chosen/);
  /* overlapping with a different number is ambiguous too */
  /** @type {ViewStandardSource} */
  const wide = { ...at(0), series: { key: "ai", label: "Harbor directive" }, key: "harbor", cite: { re: "\\bAI\\s+(?<number>\\d{1,2})" } };
  const differ = recogniseSeries({ ...H, standard_sources: [at(0), { ...wide, key: "harbor2" }] }, "AI 4.12");
  assert.deepEqual(differ.undetermined?.ambiguous?.[0]?.readings.map((x) => x.number), ["4.12", "4"]);
  /* two entries reading the same family and number are one citation */
  const twice = recogniseSeries({ ...H, standard_sources: [at(0), { ...at(0), profile: "test-other", bases: [{ profile: "test-other", basis: "TEST" }] }] }, "AI 4.12 §3");
  assert.deepEqual([twice.citations.length, twice.undetermined], [1, undefined]);
  /* a family withheld as a conflict (jurisdictions R66) is not read, and is named */
  /** @type {Conflict[]} */
  const conflicts = [{ at: "standard_sources[harbor-pd/dgo].cite", values: [{ profile: "a", value: "x", basis: "TEST" }, { profile: "b", value: "y", basis: "TEST" }],
    says: "the active profiles give different patterns for harbor-pd/dgo, so it is withheld" }];
  const withheld = recogniseSeries({ ...HS, standard_sources: (HS.standard_sources ?? []).filter((s) => s.series?.key !== "dgo"), conflicts }, "DGO K-03 and SO 9196");
  const named = withheld.undetermined?.conflicts;
  assert.deepEqual(withheld.citations.map((c) => c.series), ["so"]);
  assert.deepEqual(named?.map((c) => [c.key, c.series]), [["harbor-pd", "dgo"]]);
  assert.match(named?.[0]?.says ?? "", /withheld/);
  const kept = recogniseSeries({ ...HS, conflicts }, "DGO K-03");
  assert.deepEqual([kept.citations, kept.undetermined?.conflicts?.map((c) => c.series)], [[], ["dgo"]], "a reported conflict is never read, even if the entry stays");
  /* a view whose entries of one family disagree, or one kept without its pattern, is withheld the same way */
  const split = recogniseSeries({ ...H, standard_sources: [at(2), { ...at(2), cite: { re: "\\bSpO\\s+(?<number>\\d{4})" } }] }, "SO 9196");
  assert.deepEqual([split.citations, split.undetermined?.conflicts?.map((c) => c.series)], [[], ["so"]]);
  const { cite: _cite, ...bare } = at(2);
  assert.deepEqual(recogniseSeries({ ...H, standard_sources: [bare] }, "SO 9196").undetermined?.conflicts?.map((c) => c.series), ["so"]);
  /* combine's whole result is read with its conflicts too */
  assert.deepEqual(recogniseSeries({ ok: true, view: HS, conflicts }, "DGO K-03").citations, []);
});

test("R32 with no series in the view the answer is undetermined, never 'cites nothing'; a reading names no force", () => {
  /** @type {IdView[]} */
  const views = [H, viewOf(), viewOf(LAKESHORE), {}, { standard_sources: [{ source: "x", kind: "statute", issuer: "x", cite: { re: "S (?<number>\\d+)" }, basis: "TEST", profile: "test-harbor", bases: [] }] }];
  for (const view of views) {
    const r = recogniseSeries(view, "AI 4.12 §3, DGO K-03, SO 9196 and TSA 1710, 2020 edition");
    assert.deepEqual(r.citations, []);
    assert.match(r.undetermined?.why ?? "", /the active profiles supply no policy series or standard designation/);
    assert.match(r.undetermined?.why ?? "", /finding none says nothing about whether the text cites a policy or a standard/);
  }
  assert.deepEqual(recogniseSeries(HS, "Nothing here cites anything."), { citations: [] }, "with series, an empty finding is a finding");
  for (const c of recogniseSeries(HS, "AI 4.12 §3; TSA 1710, 2020 edition").citations)
    for (const k of ["force", "binding", "bindingness", "resolved", "version", "in_force", "held"]) assert.ok(!(k in c), `${k}: a reading is never a resolution`);
});

test("R33 pure and place-free: every series comes from the view, the inputs are unchanged, and nothing makes it throw", () => {
  /* the module knows no family of its own: the same text in another view's series reads that view's */
  /** @type {ViewStandardSource[]} */
  const other = [{ source: "Lakeshore bylaws manual", kind: "policy", issuer: "Lakeshore Clerk", level: "city", key: "lake", series: { key: "man", label: "Manual item" },
    cite: { re: "\\bMAN\\s+(?<number>\\d+)" }, basis: "TEST", profile: "test-lakeshore", bases: [] }];
  const L = withSeries(viewOf(LAKESHORE), other);
  assert.deepEqual(recogniseSeries(L, "AI 4.12 §3, DGO K-03, SO 9196, MAN 12").citations.map((c) => [c.key, c.number]), [["lake", "12"]]);
  assert.deepEqual(recogniseSeries(HS, "MAN 12").citations, []);
  const frozen = deepFreeze(structuredClone(HS));
  const before = JSON.stringify(frozen);
  const text = "AI 4.12 §3 and TSA 1710-2020";
  assert.equal(JSON.stringify(recogniseSeries(frozen, text)), JSON.stringify(recogniseSeries(structuredClone(HS), text)), "same inputs, same answer");
  assert.equal(JSON.stringify(frozen), before, "the view is not changed");
  for (const t of [undefined, null, 5, {}, [], Symbol("s"), new String("AI 4.12")]) {
    const r = recogniseSeries(HS, t);
    assert.deepEqual(r.citations, []);
    assert.match(r.undetermined?.why ?? "", /no text was given/);
  }
  /** Views of every wrong kind. @type {unknown[]} */
  const junkViews = [undefined, null, 0, "x", [], { standard_sources: 5 }, { standard_sources: [null, 3, { series: 5 }, { series: {}, key: "k" },
    { series: { key: "s" }, key: "k", cite: { re: "(" } }, { series: { key: "z" }, key: "k", cite: { re: "" } }, { series: { key: "n" }, key: "k", cite: { re: "(?<number>\\d+)" }, normal: [{ group: "missing" }] }] },
    { conflicts: [null, { at: 5 }, { at: "standard_sources[" }], standard_sources: SERIES }, new Proxy({}, { get() { throw new Error("boom"); } })];
  for (const v of junkViews) for (const t of ["", "AI 4.12 1 2 3", "x".repeat(100000), "\uD800 AI 4.12"])
    assert.doesNotThrow(() => assert.ok(Array.isArray(recogniseSeries(v, t).citations)), "never throws");
  assert.doesNotThrow(() => assert.ok(Array.isArray(recogniseSeries(junkViews[6], "s 12").undetermined?.unreadable)),
    "a series that cannot be read is named, never dropped");
  const huge = "AI 4.12 ".repeat(5000);
  assert.equal(recogniseSeries(HS, huge).citations.length, 5000);
});
