/* jurisdictions, T35 (T35-1): a standard source's `standard` kind, sector and policy series (R23, R63, R64), the level a
 * policy carries only for a government at one (R31), their refusals (R28, R65) and how they combine (R66), the first
 * profile's Oakland series measured on their primary pages (R67), the test profile (R68), the policy header labels (R69)
 * and the `isLocale` export (R37). Tested at the module's interface: validate, combine, get and the exports. Oakland's
 * series are checked against the citations and header lines measured on 2026-10-07 (`fixtures/policies.mjs`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, validate, combine, isLocale, SOURCE_KINDS, STANDARD_SOURCE_KINDS, SECTORS, LAW_LEVELS, VOCABULARY,
  POLICY_HEADER_FIELDS } from "../index.mjs";
import { applyForm, walkFacts } from "./helpers.mjs";
import { FAMILIES, NOT_CITATIONS, NOT_HEADERS, READ } from "./fixtures/policies.mjs";

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
const breakT = (fn) => { const p = get(TEST); fn(p); return validate(p); };
const other = (fn) => { const p = get(TEST); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const rx = (p) => new RegExp(p.re, p.flags || "");
/* the test profile's entries by series key; the index validate names them by */
const at = (p, sk) => p.standard_sources.findIndex((s) => s.series && s.series.key === sk);
const S = (sk) => `standard_sources[${at(get(TEST), sk)}]`;
const src = (p, sk) => p.standard_sources[at(p, sk)];
/* a citation read as id-spaces reads one (its R30): the cite's number, the normal form (R3's parts over cite's groups,
   else the number as matched), the portion and the edition */
function cites(entry, text) {
  const m = rx(entry.cite).exec(text);
  if (!m) return null;
  const g = m.groups || {};
  const normal = entry.normal ? applyForm({ pattern: { re: `^(?:${entry.cite.re})`, flags: entry.cite.flags }, normal: entry.normal }, m[0]) : g.number;
  return { number: g.number, normal, portion: g.portion, edition: g.edition };
}

/* ============================================================================================== */
/* R23: the seven kinds; SOURCE_KINDS unchanged.                                                    */

test("R23 T35 a standard source's kind is one of the seven, standard among them; SOURCE_KINDS stays the six standards reads", () => {
  assert.deepEqual([...SOURCE_KINDS], ["statute", "regulation", "ordinance", "court", "policy", "commitment"]);
  assert.deepEqual([...STANDARD_SOURCE_KINDS], [...SOURCE_KINDS, "standard"]);
  assert.ok(Object.isFrozen(SOURCE_KINDS) && Object.isFrozen(STANDARD_SOURCE_KINDS));
  const i = at(get(TEST), "coc");
  for (const kind of STANDARD_SOURCE_KINDS) {
    /* a kind of the four levelled ones needs a level, so the company's entry takes one only in a government's shape */
    const ok = breakT((p) => { const s = p.standard_sources[i]; s.kind = kind; if (["statute", "regulation", "ordinance", "court"].includes(kind)) { s.level = "city"; s.sector = "government"; } });
    assert.ok(ok.ok, `${kind}: ${JSON.stringify(ok.errors)}`);
  }
  for (const bad of ["Standard", "guideline", "", undefined])
    assert.ok(hasError(breakT((p) => { p.standard_sources[i].kind = bad; }), "SOURCE_KIND_UNKNOWN", `standard_sources[${i}].kind`), String(bad));
  /* the fields T35 adds are known, never UNKNOWN_SECTION; any other is */
  assert.ok(!validate(get(TEST)).errors.length && !validate(get(FIRST)).errors.length);
  assert.ok(hasError(breakT((p) => { p.standard_sources[i].owner = "x"; }), "UNKNOWN_SECTION", `standard_sources[${i}].owner`));
  /* law ranks read a standard source's kind, so a standard may be ranked (R50) */
  assert.ok(breakT((p) => { p.law_ranks.push({ kind: "standard", level: "city", rank: 4, basis: "TEST" }); }).ok);
  /* the view carries the new kinds and fields as given */
  const v = combine([TEST]).view.standard_sources;
  assert.deepEqual(v.filter((s) => s.kind === "standard").map((s) => [s.issuer, s.sector, s.series.key]), [["Marlow Harbour Safety Institute", "association", "mhs"]]);
});

/* ============================================================================================== */
/* R31, R64: a level for a government at one of the four; otherwise a sector.                      */

test("R31 T35 statute, regulation, ordinance and court carry a level; policy, commitment and standard one only for a government at one, never read as local", () => {
  assert.deepEqual([...LAW_LEVELS], ["federal", "state", "county", "city"], "the four levels are not widened");
  const i = at(get(TEST), "coc"), A = `standard_sources[${i}]`;
  for (const kind of ["statute", "regulation", "ordinance", "court"]) {
    assert.ok(hasError(breakT((p) => { p.standard_sources[i].kind = kind; }), "LEVEL_UNKNOWN", `${A}.level`), `${kind} with no level`);
    for (const bad of ["local", "district", "", null])
      assert.ok(hasError(breakT((p) => { Object.assign(p.standard_sources[i], { kind, level: bad, sector: "government" }); }), "LEVEL_UNKNOWN", `${A}.level`), `${kind} ${bad}`);
  }
  for (const kind of ["policy", "commitment", "standard"]) {
    for (const level of LAW_LEVELS) assert.ok(breakT((p) => { Object.assign(p.standard_sources[i], { kind, level, sector: "government" }); }).ok, `${kind} ${level}`);
    assert.ok(breakT((p) => { Object.assign(p.standard_sources[i], { kind, level: "city" }); delete p.standard_sources[i].sector; }).ok, `${kind}: a level alone reads government`);
    for (const sector of SECTORS) assert.ok(breakT((p) => { Object.assign(p.standard_sources[i], { kind, sector }); }).ok, `${kind} ${sector}, no level`);
    for (const bad of ["local", "regional", ""])
      assert.ok(hasError(breakT((p) => { p.standard_sources[i].kind = kind; p.standard_sources[i].level = bad; }), "LEVEL_UNKNOWN", `${A}.level`), `${kind} ${bad}`);
  }
  /* the held profiles: a city's instructions at city; a school district's policies government, no level; a company's none */
  const f = get(FIRST);
  const by = (p, k) => p.standard_sources.find((s) => s.series && s.series.key === k);
  assert.deepEqual([by(f, "ai").level, by(f, "ai").sector], ["city", undefined]);
  assert.deepEqual([own(by(f, "bp"), "level"), by(f, "bp").sector], [false, "government"]);
  assert.deepEqual([own(src(get(TEST), "coc"), "level"), src(get(TEST), "coc").sector], [false, "company"]);
  /* an entry with no level stays without one in the view: never local, nor any level */
  const v = combine([FIRST, TEST]).view.standard_sources;
  for (const s of v.filter((x) => x.sector && x.sector !== "government")) assert.equal(s.level, undefined, s.source);
  assert.ok(v.every((s) => s.level === undefined || LAW_LEVELS.includes(s.level)));
});

test("R64 SECTORS is K1453's eight; a sector outside it, or a policy, commitment or standard with neither level nor sector, is SECTOR_UNKNOWN; a level beside another sector VALUE_INVALID", () => {
  assert.deepEqual([...SECTORS], ["government", "company", "nonprofit", "association", "political", "religious", "education", "other"]);
  assert.ok(Object.isFrozen(SECTORS));
  const i = at(get(TEST), "coc"), A = `standard_sources[${i}]`;
  for (const bad of ["corporate", "Government", "", 3, null]) {
    const r = breakT((p) => { p.standard_sources[i].sector = bad; });
    assert.ok(hasError(r, "SECTOR_UNKNOWN", `${A}.sector`), String(bad));
    assert.ok(r.errors.find((e) => e.code === "SECTOR_UNKNOWN").detail.includes(SECTORS.join(", ")), "names the list");
  }
  for (const kind of ["policy", "commitment", "standard"]) {
    const r = breakT((p) => { p.standard_sources[i].kind = kind; delete p.standard_sources[i].sector; });
    assert.ok(hasError(r, "SECTOR_UNKNOWN", `${A}.sector`), kind);
    assert.ok(r.errors.find((e) => e.code === "SECTOR_UNKNOWN").detail.includes(SECTORS.join(", ")));
  }
  for (const sector of SECTORS.filter((x) => x !== "government"))
    assert.ok(hasError(breakT((p) => { p.standard_sources[i].level = "city"; p.standard_sources[i].sector = sector; }), "VALUE_INVALID", `${A}.sector`), sector);
  /* a levelled kind may name its sector, government only */
  const o = 0; /* the bylaws, an ordinance */
  assert.ok(breakT((p) => { p.standard_sources[o].sector = "government"; }).ok);
  assert.ok(hasError(breakT((p) => { p.standard_sources[o].sector = "company"; }), "VALUE_INVALID", `standard_sources[${o}].sector`));
  /* the view keeps each entry's sector, and one with a level reads government (the view adds nothing it was not given) */
  const v = combine([TEST]).view.standard_sources;
  assert.deepEqual(v.map((s) => s.sector ?? (s.level ? "government" : null)), get(TEST).standard_sources.map((s) => s.sector ?? (s.level ? "government" : null)));
  assert.ok(v.every((s) => s.sector || s.level));
});

/* ============================================================================================== */
/* R63, R65: a family of documents, its cite, its normal form; their refusals.                      */

test("R63 series {key, label} with the issuer's key; cite with a number group, a portion, an edition on a standard; normal over cite's groups", () => {
  const t = get(TEST);
  /* the entries read their citations, number as written and normal form */
  assert.deepEqual(cites(src(t, "hso"), "see HSO 03/07 para 4"), { number: "03/07", normal: "HSO-3/07", portion: "4", edition: undefined });
  assert.deepEqual(cites(src(t, "hso"), "hso 3/07"), { number: "3/07", normal: "HSO-3/07", portion: undefined, edition: undefined }, "two writings, one normal form");
  assert.deepEqual(cites(src(t, "rule"), "under Board Rule K03"), { number: "K03", normal: "K03", portion: undefined, edition: undefined }, "absent normal: the number as matched");
  assert.deepEqual(cites(src(t, "mhs"), "MHS 101, 2020 edition"), { number: "101", normal: "101", portion: undefined, edition: "2020" });
  assert.deepEqual(cites(src(t, "mhs"), "MHS 101-2020"), { number: "101", normal: "101", portion: undefined, edition: "2020" });
  assert.equal(cites(src(t, "mhs"), "MHS 101").edition, undefined);
  for (const no of ["HSO 3", "Board Rule 3", "EF Code 4"]) assert.equal([src(t, "hso"), src(t, "rule"), src(t, "coc")].some((e) => cites(e, no)), false, no);
  /* one entry per family; one issuer may publish several (the first profile's OPD: dgo, so, tb) */
  const f = get(FIRST);
  assert.deepEqual(f.standard_sources.filter((s) => s.key === "opd").map((s) => s.series.key), ["dgo", "so", "tb"]);
  assert.ok(breakT((p) => { p.standard_sources.push({ ...src(p, "hso"), source: "Port Ellery Harbour Notices", series: { key: "hn", label: "Harbour Notice" } }); }).ok);
  /* the view carries the family whole, its key and series key composing the family's key (R50) */
  const v = combine([TEST]).view.standard_sources.find((s) => s.series && s.series.key === "hso");
  assert.deepEqual([v.key, v.series, v.normal, v.profile], ["harbour-master", { key: "hso", label: "Harbour Standing Order" }, src(t, "hso").normal, TEST]);
});

test("R65 a malformed series is SERIES_INVALID, naming the field; a normal naming a group cite lacks is NORMAL_INVALID; series, sector and normal are known fields", () => {
  const A = S("hso"), i = at(get(TEST), "hso");
  const e = (fn) => breakT((p) => fn(p.standard_sources[i], p));
  assert.ok(hasError(e((s) => { delete s.key; }), "SERIES_INVALID", `${A}.series`), "a series on an entry with no key");
  for (const bad of ["HSO", "1x", "", "a-b", 3, undefined]) assert.ok(hasError(e((s) => { s.series.key = bad; }), "SERIES_INVALID", `${A}.series.key`), String(bad));
  for (const bad of ["", "  ", 3, undefined]) assert.ok(hasError(e((s) => { s.series.label = bad; }), "SERIES_INVALID", `${A}.series.label`), String(bad));
  for (const bad of ["hso", null, [], 3]) assert.ok(hasError(e((s) => { s.series = bad; }), "SERIES_INVALID", `${A}.series`), JSON.stringify(bad));
  assert.ok(hasError(e((s) => { s.series.edition = "2020"; }), "UNKNOWN_SECTION", `${A}.series.edition`));
  assert.ok(hasError(e((s) => { s.cite = { re: "\\bHSO\\s+(\\d+)" }; s.normal = [{ group: 1 }]; }), "SERIES_INVALID", `${A}.cite`), "no number group");
  assert.ok(hasError(e((s) => { s.cite = { re: "\\bHSO\\s+(?<num>\\d+)" }; delete s.normal; }), "SERIES_INVALID", `${A}.cite`), "a group by another name");
  assert.ok(hasError(e((s) => { s.cite = { re: "\\bHSO\\s+(?<number>\\d+)(?:-(?<edition>\\d{4}))?" }; delete s.normal; }), "SERIES_INVALID", `${A}.cite`), "an edition on a policy");
  assert.ok(breakT((p) => { const s = src(p, "mhs"); s.cite = { re: "\\bMHS\\s+(?<number>\\d{3})" }; }).ok, "a standard's edition group is optional");
  assert.ok(hasError(breakT((p) => { p.standard_sources.push({ ...src(p, "hso") }); }), "SERIES_INVALID", `standard_sources[${get(TEST).standard_sources.length}].series`), "a key and series key twice");
  assert.ok(breakT((p) => { p.standard_sources.push({ ...src(p, "hso"), key: "pilot-master" }); }).ok, "the same series key under another issuer");
  /* normal: R3's parts over cite's groups */
  for (const bad of [[{ group: 5 }], [{ group: 0 }], [{ group: "number" }], [{ group: 2, pad: true }], [], "HSO-1"])
    assert.ok(e((s) => { s.normal = bad; }).errors.some((x) => x.code === "NORMAL_INVALID" && x.path.startsWith(`${A}.normal`)), JSON.stringify(bad));
  assert.ok(hasError(e((s) => { s.normal = [{ group: 5 }]; }), "NORMAL_INVALID", `${A}.normal[0]`));
  assert.ok(breakT((p) => { delete src(p, "hso").normal; }).ok, "normal is optional");
  assert.ok(hasError(breakT((p) => { src(p, "rule").normal = [{ group: 2 }]; }), "NORMAL_INVALID", `${S("rule")}.normal[0]`), "a cite with one group, number (index 1): none beyond it");
  assert.ok(breakT((p) => { src(p, "rule").normal = [{ group: 1, upper: true }]; }).ok);
  assert.ok(hasError(breakT((p) => { p.standard_sources[0].normal = [{ group: 1 }]; }), "SERIES_INVALID", "standard_sources[0].normal"), "a normal with no series");
  /* every fault is reported, not only the first */
  const all = e((s) => { s.series = { key: "X", label: "" }; s.cite = { re: "HSO (\\d+)" }; s.normal = [{ group: 7 }]; });
  assert.deepEqual(all.errors.map((x) => [x.path, x.code]).sort(), [[`${A}.cite`, "SERIES_INVALID"], [`${A}.normal[0]`, "NORMAL_INVALID"],
    [`${A}.series.key`, "SERIES_INVALID"], [`${A}.series.label`, "SERIES_INVALID"]]);
});

test("R28 T35 SECTOR_UNKNOWN and SERIES_INVALID are reported for their faults; LEVEL_UNKNOWN for a levelled kind with no level", () => {
  const cases = {
    SECTOR_UNKNOWN: [(p) => { src(p, "coc").sector = "firm"; }, `${S("coc")}.sector`],
    SERIES_INVALID: [(p) => { src(p, "coc").series.key = "Code"; }, `${S("coc")}.series.key`],
    LEVEL_UNKNOWN: [(p) => { src(p, "coc").kind = "regulation"; }, `${S("coc")}.level`],
  };
  for (const [code, [fn, path]] of Object.entries(cases)) assert.ok(hasError(breakT(fn), code, path), code);
  assert.ok(!hasError(breakT((p) => { delete src(p, "rule").level; }), "LEVEL_UNKNOWN"), "a government policy at no level is no LEVEL_UNKNOWN");
});

/* ============================================================================================== */
/* R66: how they combine.                                                                           */

test("R66 combine: standard sources unioned; a family's label, cite and normal, and an entry's level and sector, one value per key, withheld when profiles disagree", () => {
  const same = combine([TEST, other(() => {})]);
  assert.deepEqual(same.conflicts.filter((c) => c.at.startsWith("standard_sources")), []);
  assert.equal(same.view.standard_sources.length, get(TEST).standard_sources.length, "equal entries kept once");
  assert.deepEqual(same.view.standard_sources.find((s) => s.series && s.series.key === "hso").bases.map((b) => b.profile), [TEST, "test-other"]);
  const changes = {
    "standard_sources[harbour-master/hso].series.label": (b) => { src(b, "hso").series.label = "Standing Order"; },
    "standard_sources[harbour-master/hso].cite": (b) => { src(b, "hso").cite = { re: "\\bHSO\\s+(?<number>(\\d{1,2})\\/(\\d{2}))" }; },
    "standard_sources[harbour-master/hso].normal": (b) => { delete src(b, "hso").normal; },
    "standard_sources[Ellery Ferries Code of Conduct/Ellery Ferries Ltd].sector": (b) => { src(b, "coc").sector = "nonprofit"; },
    "standard_sources[Port Ellery Harbour Standing Orders/Harbour Master].level": (b) => { src(b, "hso").level = "county"; },
  };
  for (const [where, fn] of Object.entries(changes)) {
    const c = combine([TEST, other(fn)]);
    assert.ok(c.ok, where);
    const mine = c.conflicts.filter((x) => x.at.startsWith("standard_sources"));
    assert.deepEqual(mine.map((x) => x.at), [where], where);
    assert.ok(mine[0].values.length === 2 && mine[0].values.every((v) => v.profile && v.basis && "value" in v), where);
    assert.ok(/withheld/.test(mine[0].says), where);
    const field = where.split("].")[1];
    /* K1916 (2): a family withheld is dropped from the view whole */
    if (field.startsWith("series") || field === "cite" || field === "normal") {
      assert.equal(c.view.standard_sources.filter((s) => s.key === "harbour-master" && s.series && s.series.key === "hso").length, 0, `${where}: dropped`);
      assert.equal(c.view.standard_sources.length, get(TEST).standard_sources.length - 1, `${where}: the other entries stand`);
      continue;
    }
    const entries = c.view.standard_sources.filter((s) => s.source === (field === "sector" ? "Ellery Ferries Code of Conduct" : "Port Ellery Harbour Standing Orders"));
    assert.ok(entries.length >= 1, `${where}: the entry stands`);
    const read = { sector: (s) => s.sector, level: (s) => s.level }[field];
    for (const s of entries) assert.equal(read(s), undefined, `${where}: withheld from every entry, never chosen`);
  }
  /* a citation of a family whose cite is withheld is recognised by no profile's choice: no entry of the view reads it */
  const c = combine([TEST, other(changes["standard_sources[harbour-master/hso].cite"])]).view;
  assert.ok(!c.standard_sources.some((s) => s.cite && rx(s.cite).test("HSO 03/07")));
  /* a level written beside government and the same level alone agree: a level reads government (R64) */
  const g = combine([TEST, other((b) => { src(b, "hso").sector = "government"; })]);
  assert.deepEqual(g.conflicts.filter((x) => x.at.startsWith("standard_sources")), []);
  /* a family only one profile gives is kept as given */
  const add = combine([TEST, other((b) => { b.standard_sources.push({ ...src(b, "hso"), key: "pilot-master", source: "Pilotage Orders", issuer: "Pilot Master" }); })]);
  assert.deepEqual(add.conflicts.filter((x) => x.at.startsWith("standard_sources")), []);
  assert.equal(add.view.standard_sources.filter((s) => s.key === "pilot-master").length, 1);
  /* the two held profiles share no family, so nothing is withheld between them */
  assert.deepEqual(combine([FIRST, TEST]).conflicts.filter((x) => x.at.startsWith("standard_sources")), []);
});

/* ============================================================================================== */
/* R67: the first profile's Oakland series, measured.                                               */

test("R67 the first profile holds Oakland's AI, DGO, Special Order and Training Bulletin families and OUSD's BP/AR, each read on its primary pages", () => {
  const f = get(FIRST);
  const fam = f.standard_sources.filter((s) => s.series);
  assert.deepEqual(fam.map((s) => `${s.key}/${s.series.key}`), ["city-administrator/ai", "opd/dgo", "opd/so", "opd/tb", "ousd/bp", "ousd/ar",
    "calea/standards"]);
  const LEVEL = { ai: ["city", undefined], dgo: ["city", undefined], so: ["city", undefined], tb: ["city", undefined], bp: [undefined, "government"],
    ar: [undefined, "government"], standards: [undefined, "association"] };
  for (const s of fam) {
    const k = s.series.key;
    assert.equal(s.kind, k === "standards" ? "standard" : "policy", k);
    assert.deepEqual([s.level, s.sector], LEVEL[k], k);
    assert.equal(s.basis, `${READ} policies`, `${k}: the dated measurement`);
    assert.ok(FAMILIES[k].pages.length && FAMILIES[k].pages.every((u) => new URL(u).protocol === "https:"), `${k}: each page's address`);
    assert.ok(typeof s.issuer === "string" && s.issuer.length > 5, `${k}: the office that owns the family (DEC-145 (8))`);
    /* every citation measured is recognised, with its number as written and its normal form */
    for (const [line, number, normal = number] of FAMILIES[k].citations) {
      const c = cites(s, line);
      assert.ok(c, `${k}: ${line}`);
      assert.deepEqual([c.number, c.normal], [number, normal], `${k}: ${line}`);
    }
    for (const [line, number, portion] of FAMILIES[k].portions || []) assert.deepEqual([cites(s, line).number, cites(s, line).portion], [number, portion], line);
    /* the lines that cite no item: no family takes them */
    for (const line of [...NOT_CITATIONS, ...(FAMILIES[k].not || [])]) assert.equal(cites(s, line), null, `${k}: ${line}`);
    assert.equal(rx(s.cite).flags.includes("i") || false, false, `${k}: as printed, case kept`);
  }
  /* each family recognises its own citations only, apart from BP/AR, which cites both families at once */
  for (const s of fam) for (const [k, F] of Object.entries(FAMILIES)) {
    if (k === s.series.key) continue;
    for (const [line] of F.citations) {
      if (/^BP\/AR/.test(line) && ["bp", "ar"].includes(s.series.key)) continue;
      assert.equal(cites(s, line), null, `${s.series.key} takes ${k}'s ${line}`);
    }
  }
  /* one standard designation: the CALEA standards OPD's General Orders cite (K1930); no edition is printed, so none is read */
  assert.deepEqual(f.standard_sources.filter((s) => s.kind === "standard").map((s) => s.issuer), ["Commission on Accreditation for Law Enforcement Agencies (CALEA)"]);
  assert.equal(cites(fam.at(-1), "Ref: CALEA\nStandards 15.1.1;").edition, undefined);
  assert.ok(!f.standard_sources.some((s) => s.basis === "UNMEASURED"));
  /* the view carries them, each tagged with the first profile */
  const v = combine([FIRST]).view.standard_sources.filter((s) => s.series);
  assert.deepEqual(v.map((s) => [s.series.key, s.profile]), fam.map((s) => [s.series.key, FIRST]));
});

/* ============================================================================================== */
/* R68: the test profile.                                                                           */

test("R68 the test profile supplies R63–R64's fields and R69's policy_headers, unlike the first profile's", () => {
  const t = get(TEST), f = get(FIRST);
  const fam = t.standard_sources.filter((s) => s.series);
  assert.ok(fam.some((s) => LAW_LEVELS.includes(s.level) && (s.sector ?? "government") === "government"), "a government's series at a level");
  assert.ok(fam.some((s) => !own(s, "level") && s.sector === "government"), "a government's at no level");
  assert.ok(fam.some((s) => s.sector === "company"), "a company's");
  const std = fam.find((s) => s.kind === "standard");
  assert.ok(std && /\(\?<edition>/.test(std.cite.re), "a standard whose designation reads an edition");
  const n = fam.find((s) => s.normal);
  assert.ok(n && cites(n, "HSO 03/07").normal === cites(n, "HSO 3/07").normal, "a series whose normal removes formatting");
  assert.ok(t.vocabulary.policy_headers.length);
  assert.deepEqual([...new Set(t.vocabulary.policy_headers.map((h) => h.field))].sort(), [...POLICY_HEADER_FIELDS].sort());
  /* unlike the first profile's: no family key, cite or header pattern shared */
  const fk = new Set(f.standard_sources.filter((s) => s.series).map((s) => `${s.key}/${s.series.key}`));
  for (const s of fam) assert.ok(!fk.has(`${s.key}/${s.series.key}`), s.source);
  const fc = new Set(f.standard_sources.map((s) => s.cite.re));
  for (const s of fam) assert.ok(!fc.has(s.cite.re), s.source);
  const fh = new Set(f.vocabulary.policy_headers.map((h) => h.pattern.re));
  for (const h of t.vocabulary.policy_headers) assert.ok(!fh.has(h.pattern.re), h.pattern.re);
  walkFacts(t, (fact, path) => assert.equal(fact.basis, "TEST", path));
  assert.ok(validate(t).ok);
});

/* ============================================================================================== */
/* R69: the policy header labels.                                                                   */

test("R69 vocabulary.policy_headers {field, pattern, basis}: a field from doctypes R26's nine, a known key, unioned in combine; the first profile's labels as measured", () => {
  assert.ok(VOCABULARY.includes("policy_headers"));
  assert.deepEqual([...POLICY_HEADER_FIELDS], ["type", "number", "title", "effective", "supersedes", "reference", "coordinator", "review_due", "revision_cycle"]);
  const A = "vocabulary.policy_headers[0]";
  for (const field of POLICY_HEADER_FIELDS) assert.ok(breakT((p) => { p.vocabulary.policy_headers[0].field = field; }).ok, field);
  for (const bad of ["author", "Effective", "", undefined, 3])
    assert.ok(hasError(breakT((p) => { p.vocabulary.policy_headers[0].field = bad; }), "VALUE_INVALID", `${A}.field`), String(bad));
  assert.ok(hasError(breakT((p) => { p.vocabulary.policy_headers[0].pattern = { re: "(" }; }), "PATTERN_INVALID", `${A}.pattern`));
  assert.ok(hasError(breakT((p) => { delete p.vocabulary.policy_headers[0].basis; }), "BASIS_MISSING", `${A}.basis`));
  assert.ok(hasError(breakT((p) => { p.vocabulary.policy_headers[0].label = "x"; }), "UNKNOWN_SECTION", `${A}.label`));
  assert.ok(!hasError(validate(get(TEST)), "UNKNOWN_VOCABULARY"));
  /* unioned (R14): an equal entry kept once with both bases, a new one added in order */
  const u = combine([TEST, other((b) => { b.vocabulary.policy_headers.push({ field: "title", pattern: { re: "^Subject:" }, basis: "TEST" }); })]);
  assert.deepEqual(u.conflicts, []);
  const v = u.view.vocabulary.policy_headers;
  assert.equal(v.length, get(TEST).vocabulary.policy_headers.length + 1);
  assert.deepEqual(v[0].bases.map((b) => b.profile), [TEST, "test-other"]);
  assert.equal(v.at(-1).pattern.re, "^Subject:");
  /* the first profile: every header line measured is read as its field, the lines that are not are read as none */
  const f = get(FIRST).vocabulary.policy_headers;
  const fieldsOf = (line) => new Set(f.filter((e) => rx(e.pattern).test(line)).map((e) => e.field));
  for (const [k, F] of Object.entries(FAMILIES)) for (const [field, line, hit = true] of F.headers)
    assert.equal(fieldsOf(line).has(field), hit, `${k} ${field}: ${JSON.stringify(line)}`);
  for (const line of NOT_HEADERS) assert.deepEqual([...fieldsOf(line)], [], line);
  for (const e of f) assert.equal(e.basis, `${READ} policies`);
  /* each label the profile holds was measured: every entry reads some measured line */
  const lines = Object.values(FAMILIES).flatMap((F) => F.headers.filter((h) => h[2] !== false).map((h) => h[1]));
  for (const e of f) assert.ok(lines.some((l) => rx(e.pattern).test(l)), e.pattern.re);
});

/* ============================================================================================== */
/* R37: isLocale, the one reading of a BCP 47 tag.                                                  */

test("R37 T35 isLocale(value) is true exactly when validate accepts it as locale.value; never throws", () => {
  const values = ["en", "en-US", "fr-CA", "zh-Hant-TW", "es-419", "en-GB", "", "en_US", "en-US,fr", "en US", "e", "en--US",
    "toolonglanguage", " en", "EN-us", 3, null, undefined, {}, [], ["en"], true, Symbol("en")];
  for (const v of values) {
    const p = get(TEST); p.locale.value = v;
    const accepted = !validate(p).errors.some((e) => e.path === "locale.value");
    assert.equal(isLocale(v), accepted, String(typeof v === "symbol" ? "symbol" : JSON.stringify(v)));
    assert.equal(typeof isLocale(v), "boolean");
  }
  assert.equal(isLocale("en-US"), true);
  assert.equal(isLocale("en_US"), false);
  const trap = new Proxy({}, { get() { throw new Error("boom"); } });
  assert.equal(isLocale(trap), false);
  assert.equal(isLocale(), false);
});
