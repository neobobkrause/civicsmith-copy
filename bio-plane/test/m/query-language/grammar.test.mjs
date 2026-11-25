import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { compile, FIELDS, MEANING, MACHINE_READ_KINDS, CAP_DOES_NOT_APPLY, CHAIN_DOES_NOT_APPLY } from "../../../src/query.mjs";
import { CONTENT_EXTENT_KINDS } from "../../../src/content/index.mjs";
import { STEP_KINDS, CHAIN_KIND_MIXED, MACHINE_READ_KINDS as TEXT_CHAIN_MACHINE_READ_KINDS } from "../../../src/textchain.mjs";
import { normalizeType } from "../../../src/record-grammar/types.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const V = "class:member";
const UNDETERMINED = "undetermined";
const sorted = (a) => [...a].sort();

/* A small corpus over which every operator of R1 has a distinguishable answer. */
function corpus() {
  const w = world();
  w.bundle("A", { title: "water main", body: "the water main broke", current_state: "open", created: "2026-01-05T12:00:00Z",
                  annotations_open: 3, fm: { a: { b: "c d" }, n: 1 } });
  w.bundle("B", { title: "budget", body: "water budget shortfall", current_state: "closed", created: "2026-02-05T12:00:00Z",
                  annotations_open: 0, fm: { a: { b: "x" } } });
  w.bundle("C", { title: "sewer", body: "sewer fund watering", current_state: "open", created: "2026-03-05T12:00:00Z",
                  annotations_open: 7 });
  w.bundle("D", { title: "streets", body: "nothing of note", created: null, annotations_open: null });
  return w;
}

test("R1 the grammar: implicit AND/OR, capital operators, negation, parentheses, phrases, prefixes, fields, comparisons, ranges, presence, fm:, text:, sort:", () => {
  const w = corpus();
  /* A date is a local day in the caller's zone (R27); here UTC, so the days read as the column's. */
  const ids = (q, o = {}) => sorted(w.ids({ q, viewer: V, zone: "UTC", ...o }));
  assert.deepEqual(ids("water main"), ["A"], "bare words join by AND");
  assert.deepEqual(ids("water main", { implicitOp: "or" }), ["A", "B"], "implicitOp or joins them by OR");
  assert.deepEqual(ids("main OR sewer"), ["A", "C"]);
  assert.deepEqual(ids("water AND budget"), ["B"]);
  assert.deepEqual(ids("water AND budget", { implicitOp: "or" }), ["B"], "an explicit AND stays a conjunction");
  assert.deepEqual(ids("water or budget"), [], "lower-case or is a word, not an operator");
  assert.deepEqual(ids("water NOT budget"), ["A"]);
  assert.deepEqual(ids("water -budget"), ["A"], "a leading - negates");
  assert.deepEqual(ids("(main OR sewer) -fund"), ["A"]);
  const unclosed = compile({ q: "(main OR sewer", viewer: V });
  assert.ok(unclosed.warnings.some((x) => /unclosed parenthesis/.test(x)));
  assert.deepEqual(ids("(main OR sewer"), ["A", "C"], "an unclosed parenthesis is read to the end");
  assert.deepEqual(ids('"main broke"'), ["A"], "a quoted run is one phrase");
  assert.deepEqual(ids('"broke main"'), []);
  assert.deepEqual(ids("water*"), ["A", "B", "C"], "term* is a prefix");
  assert.deepEqual(ids('"water*"'), ["A", "B"], "a star inside quotes is not the prefix operator");
  assert.deepEqual(ids("state:open"), ["A", "C"]);
  assert.deepEqual(ids('state:"open"'), ["A", "C"], "a quoted value loses its quotes");
  assert.deepEqual(ids('fm:"a.b"="c d"'), ["A"], "a value is read to its end in as many pieces as it takes");
  assert.deepEqual(ids("created:>2026-02-01"), ["B", "C"]);
  assert.deepEqual(ids("created:>=2026-02-05"), ["B", "C"]);
  assert.deepEqual(ids("created:<2026-02-05"), ["A"]);
  assert.deepEqual(ids("created:<=2026-02-05"), ["A", "B"]);
  assert.deepEqual(ids("annotations:1..5"), ["A"], "a range on a number field");
  assert.deepEqual(ids("created:2026-01-01..2026-02-10"), ["A", "B"], "a range on a time field");
  assert.deepEqual(ids("created:"), ["A", "B", "C"], "field: asks presence");
  assert.deepEqual(ids("created:*"), ["A", "B", "C"], "field:* asks presence");
  assert.deepEqual(ids("has:created"), ["A", "B", "C"]);
  assert.deepEqual(ids("fm:n"), ["A"], "fm:path asks presence");
  assert.deepEqual(ids("fm:a.b=x"), ["B"]);
  const bad = compile({ q: "fm:a;DROP", viewer: V });
  assert.ok(bad.warnings.some((x) => /fm: path "a;DROP" is not a frontmatter path/.test(x)));
  assert.equal(bad.ast, null, "a bad path is dropped");
  assert.equal(compile({ q: `fm:${"a".repeat(121)}`, viewer: V }).ast, null, "a path over 120 characters is dropped");
  assert.deepEqual(ids("text:state"), [], "text: forces free text over a field name");
  w.bundle("E", { body: "the state of things" });
  assert.deepEqual(ids("text:state"), ["E"]);
  assert.deepEqual(compile({ q: "sort:created", viewer: V }).sort, { field: "created", dir: "DESC" });
  assert.deepEqual(compile({ q: "sort:-created", viewer: V }).sort, { field: "created", dir: "DESC" });
  assert.deepEqual(compile({ q: "sort:created:asc", viewer: V }).sort, { field: "created", dir: "ASC" });
  assert.deepEqual(compile({ q: "sort:created:desc", viewer: V }).sort, { field: "created", dir: "DESC" });
  const noword = compile({ q: "water --- ...", viewer: V });
  assert.deepEqual(noword.terms, ["water"], "a term with no letter or digit is dropped");
});

test("R2 an unknown field is free text with a warning; an unknown has: or sort: field is dropped with a warning", () => {
  const w = corpus();
  const p = compile({ q: "sewer:fund", viewer: V });
  assert.ok(p.warnings.includes('unknown field "sewer"; read as free text'));
  assert.deepEqual(w.ids({ q: "sewer:fund", viewer: V }), ["C"]);
  const h = compile({ q: "has:nope water", viewer: V });
  assert.ok(h.warnings.includes('has: unknown field "nope"'));
  assert.deepEqual(h.ast.op, "text", "the has: term is dropped, the rest stands");
  const s = compile({ q: "sort:nope water", viewer: V });
  assert.ok(s.warnings.includes('sort: unknown field "nope"'));
  assert.equal(s.sort.field, "relevance");
});

test("R3 FIELDS is the projection's vocabulary; free-text fields match, the rest are equality with case and type normalised", () => {
  assert.deepEqual(Object.keys(FIELDS), ("id type group title state prior created updated criticality sha schema mode tier "
    + "locator authority retrieved status hash monitored frequency checked annotations reeval since reevalsource "
    + "capture connection legs actionkind risk addressee resolution due overdue "
    + "standard cites person holder post kind phase stage basis period fund party event occurred obligor owed_to").split(" "));
  assert.deepEqual(Object.entries(FIELDS).filter(([, f]) => f.fts).map(([n]) => n), ["title", "locator", "authority"]);
  const w = world();
  w.bundle("A", { type: normalizeType("problem"), title: "Main street water", locator: "https://x.example/doc/7",
                  authority: "Clerk of the council", criticality: "high", group_id: "g1" });
  w.bundle("B", { type: "information", title: "other" });
  const ids = (q) => sorted(w.ids({ q, viewer: V }));
  assert.deepEqual(ids("title:water"), ["A"], "a column-scoped match, not equality on the whole title");
  assert.deepEqual(ids("locator:doc"), ["A"]);
  assert.deepEqual(ids("authority:clerk"), ["A"]);
  assert.deepEqual(ids("criticality:HIGH"), ["A"], "lower-cased argument");
  assert.deepEqual(ids("group:G1"), ["A"]);
  /* type: through record-grammar's type map: a legacy spelling finds the canonical type. */
  assert.notEqual(normalizeType("problem"), "problem");
  assert.deepEqual(ids("type:problem"), ["A"]);
  assert.deepEqual(ids(`type:${normalizeType("problem")}`), ["A"]);
  const p = compile({ q: "id:A title:x", viewer: V });
  assert.equal(p.ast.kids[0].op, "meta");
  assert.equal(p.ast.kids[1].op, "text");
});

test("R4 capture: and connection: are two fields over two columns, each marked cached, never one strength", () => {
  assert.notEqual(FIELDS.capture.col, FIELDS.connection.col);
  assert.equal(FIELDS.strength, undefined);
  assert.ok(FIELDS.capture.asOf && FIELDS.connection.asOf);
  const w = world();
  w.bundle("Q1", { type: "inquiry", inquiry_capture_strength: "A", inquiry_connection_strength: "C" });
  w.bundle("Q2", { type: "inquiry", inquiry_capture_strength: "C", inquiry_connection_strength: "A" });
  assert.deepEqual(w.ids({ q: "capture:a", viewer: V }), ["Q1"], "upper-cased argument");
  assert.deepEqual(w.ids({ q: "connection:a", viewer: V }), ["Q2"]);
  assert.deepEqual(sorted(w.ids({ q: "capture:<=B", viewer: V })), ["Q1"]);
  const p = compile({ q: "capture:A connection:A", viewer: V });
  assert.deepEqual(Object.keys(p.cached).sort(), [FIELDS.capture.col, FIELDS.connection.col].sort());
});

function legCorpus() {
  const w = world();
  w.bundle("Q1", { type: "inquiry" });
  w.bundle("Q2", { type: "inquiry" });
  w.insert("inquiry_basis", { bundle_id: "Q1", ord: 0, role: "supports", grade: "B", grade_axis: "capture",
                              grade_source: "hunch", ground: "g", target_id: "X" });
  w.insert("inquiry_basis", { bundle_id: "Q2", ord: 0, role: "cuts_against", grade: "D", grade_axis: "connection",
                              grade_source: "documented", ground: null, target_id: "X" });
  w.insert("resolutions", { bundle_id: "Q1", capture_sha: "s1", ref: "r", entity_id: "ENT-1", grade: "C" });
  return w;
}

test("R5 meaning selectors: bare words from record-grammar, qualified sub-fields, comparisons; every bad spelling dropped with a warning", () => {
  const w = legCorpus();
  const ids = (q) => sorted(w.ids({ q, viewer: V }));
  assert.deepEqual(ids("leg:hunch"), ["Q1"], "a bare vocabulary word finds its column");
  assert.deepEqual(ids("leg:role=cuts_against"), ["Q2"]);
  assert.deepEqual(ids("leg:ground=*"), ["Q1"]);
  assert.deepEqual(ids("leg:grade>=C"), ["Q2"], "a comparison on a named sub-field");
  assert.deepEqual(ids("leg:<=B"), ["Q1"], "a comparison on the bare field");
  assert.deepEqual(ids("resolves:>=B"), ["Q1"]);
  assert.deepEqual(ids("concerns:ENT-1"), ["Q1"]);
  const drops = {
    "leg:capture": /leg: "capture" is both .* say leg:.*=capture or leg:.*=capture/,
    "leg:bogus=x": /leg: unknown sub-field "bogus"; known: /,
    "leg:grade>=": /compares grade against nothing/,
    "passage:>=bar": /compares a full-text field/,
    "passage:text>=bar": /compares a full-text field/,
    "passage:---": /has no word in it to match/,
  };
  for (const [q, re] of Object.entries(drops)) {
    const p = compile({ q: `${q} leg:*`, viewer: V });
    assert.ok(p.warnings.some((x) => re.test(x)), `${q}: ${p.warnings}`);
    assert.deepEqual(p.meaningArms.map((a) => a.arm), ["leg"], `${q} did not compile`);
    assert.deepEqual(sorted(w.ids({ q: `${q} leg:*`, viewer: V })), ["Q1", "Q2"], `${q} widens, never narrows`);
  }
  assert.deepEqual(compile({ q: "leg:hunch resolves:C", viewer: V }).meaningArms.map((a) => a.arm), ["leg", "resolves"]);
  /* Bare words are record-grammar's own: every word of every sub-field's vocabulary is in the index. */
  for (const [arm, m] of Object.entries(MEANING))
    for (const [sub, s] of Object.entries(m.sub))
      for (const word of s.vocab || []) {
        const p = compile({ q: `${arm}:${word}`, viewer: V });
        const claimed = Object.entries(m.sub).filter(([, x]) => (x.vocab || []).map(String).map((y) => y.toLowerCase())
          .includes(String(word).toLowerCase())).length;
        if (claimed === 1) assert.equal(p.ast.field, sub, `${arm}:${word}`);
        else assert.equal(p.ast, null, `${arm}:${word} is ambiguous and dropped`);
      }
});

test("R6 the content: arm's sub-fields over the content table, and passage: over the indexed text", () => {
  assert.deepEqual(MEANING.content.sub.kind.vocab, Object.keys(CONTENT_EXTENT_KINDS));
  assert.ok(MEANING.content.sub.kind.vocab.includes("envelope"), "the content extent kinds, envelope included");
  assert.ok(!MEANING.content.sub.kind.vocab.includes("dom"), "dom is not a word");
  assert.deepEqual(MEANING.content.sub.chain.vocab, [...Object.keys(STEP_KINDS), CHAIN_KIND_MIXED]);
  const w = world();
  for (const id of ["D1", "D2", "D3", "D4", "D5", "D6"]) w.bundle(id, { type: "information" });
  const row = (id, b, o) => w.insert("content", { content_id: id, capture_sha: "s", bundle_id: b, extent_kind: "pdf-page",
    extent: `{"p":"${id}"}`, ref: id, chain: "[]", derivation_cap: "B", minted_by: "ann", stale: 0, cited_as: "text",
    chain_kind: "layer", ...o });
  row("c1", "D1", { extent_kind: "envelope", chain_kind: "ocr", derivation_cap: "C", minted_by: "plane" });
  row("c2", "D2", { chain_kind: CHAIN_KIND_MIXED, minted_by: "class:ai", stale: 1 });
  row("c3", "D3", { cited_as: "bytes", chain: null, chain_kind: null, derivation_cap: null, extent_kind: "image" });
  row("c4", "D4", { chain: null, chain_kind: null, derivation_cap: null });
  row("c5", "D5", { chain_kind: "ai", derivation_cap: "A" });
  w.insert("inquiry_basis", { bundle_id: "D6", ord: 0, content_id: "c5" });
  w.insert("inquiry_basis_version_legs", { bundle_id: "D6", version: 1, ord: 0, content_id: "c4" });
  const ids = (q) => sorted(w.ids({ q, viewer: V }));
  assert.deepEqual(ids("content:envelope"), ["D1"]);
  assert.deepEqual(ids("content:kind=pdf-page"), ["D2", "D4", "D5"]);
  assert.deepEqual(ids("content:stale"), ["D2"]);
  assert.deepEqual(ids("content:current"), ["D1", "D3", "D4", "D5"]);
  assert.deepEqual(ids("content:plane"), ["D1"]);
  assert.deepEqual(ids("content:machine"), ["D2"]);
  assert.deepEqual(ids("content:member"), ["D3", "D4", "D5"]);
  assert.deepEqual(ids("content:minted=ann"), ["D3", "D4", "D5"], "any other value is equality on the minter");
  assert.deepEqual(ids("content:cap=B"), ["D2"]);
  assert.deepEqual(ids("content:cap<C"), ["D2", "D5"], "a comparison never matches undetermined or does-not-apply");
  assert.deepEqual(ids("content:cap=undetermined"), ["D4"], "a null cap over text rows");
  assert.deepEqual(ids(`content:cap=${CAP_DOES_NOT_APPLY}`), ["D3"], "the rows cited as bytes");
  assert.deepEqual(ids(`content:chain=${UNDETERMINED}`), ["D4"]);
  assert.deepEqual(ids(`content:chain=${CHAIN_DOES_NOT_APPLY}`), ["D3"]);
  assert.deepEqual(ids("content:chain=*"), ["D1", "D2", "D5"], "presence");
  assert.deepEqual(ids("content:layer"), [], "a kind no row holds");
  /* content R14, DEC-4: a machine reading also finds the units read in more than one way. */
  assert.equal(MACHINE_READ_KINDS, TEXT_CHAIN_MACHINE_READ_KINDS, "text-chain's list, re-exported (N104)");
  assert.deepEqual(MACHINE_READ_KINDS, Object.keys(STEP_KINDS).filter((k) => STEP_KINDS[k].machine),
    "the step kinds text-chain marks machine readings (its R91), never a list of this module's");
  assert.ok(MACHINE_READ_KINDS.length >= 2);
  /* Every machine reading, whatever text-chain lists, also selects the mixed units; a kind that is not one does not. */
  for (const k of MACHINE_READ_KINDS) {
    const own = { ocr: ["D1"], ai: ["D5"] }[k] || [];
    assert.deepEqual(ids(`content:chain=${k}`), sorted([...own, "D2"]), `content:chain=${k}`);
  }
  assert.deepEqual(ids("content:ocr"), ["D1", "D2"]);
  assert.deepEqual(ids("content:chain=ai"), ["D2", "D5"]);
  assert.deepEqual(ids("content:mixed"), ["D2"]);
  assert.deepEqual(ids("-content:ocr content:*"), ["D3", "D4", "D5"]);
  assert.deepEqual(ids("content:cited"), ["D4", "D5"], "a live or a version leg names the row");
  assert.deepEqual(ids("content:uncited"), ["D1", "D2", "D3"]);
  /* passage: is the indexed text of captures; text: the group's own notes. */
  w.bundle("P", { body: "our notes on a culvert" });
  w.insert("capture_text", { capture_sha: "s9", bundle_id: "D1", extent_kind: "pdf-page", extent: "{}", ref: "p1",
                             seq: 0, text: "the culvert failed in spring", chain_kind: "ocr" });
  assert.deepEqual(ids("passage:culvert"), ["D1"]);
  assert.deepEqual(ids("text:culvert"), ["P"]);
});

test("R13 widenable only for an implicit conjunction of more than one atom; implicitOp or is its wider reading", () => {
  const w = corpus();
  assert.equal(compile({ q: "water budget", viewer: V }).widenable, true);
  assert.equal(compile({ q: "water", viewer: V }).widenable, false);
  assert.equal(compile({ q: "water OR budget", viewer: V }).widenable, false);
  assert.equal(compile({ q: "water AND budget", viewer: V }).widenable, false, "an explicit AND");
  assert.equal(compile({ q: "water budget", viewer: V, implicitOp: "or" }).widenable, false);
  assert.equal(compile({ q: "NEAR(water x, y)", viewer: V }).widenable, false, "a NEAR read as AND is explicit");
  assert.deepEqual(w.ids({ q: "main shortfall", viewer: V }), []);
  assert.deepEqual(sorted(w.ids({ q: "main shortfall", viewer: V, implicitOp: "or" })), ["A", "B"]);
});

test("R13 the OR reading keeps a NOT atom a restriction (F-B10 c)", () => {
  const w = corpus();
  const or = (q) => sorted(w.ids({ q, viewer: V, implicitOp: "or" }));
  /* water is in A and B; main in A; budget in B; sewer in C; D holds none of them. */
  assert.deepEqual(or("water NOT main"), ["B"], "a negated word excludes in the wider reading");
  assert.deepEqual(or("main budget NOT water"), [], "the positives are ORed, then the exclusion applies");
  assert.deepEqual(or("main sewer -budget"), ["A", "C"], "a leading - is the same restriction");
  assert.deepEqual(or("main NOT sewer NOT budget zzzqqq"), ["A"], "every NOT restricts; a word that matches nothing adds nothing");
  assert.deepEqual(or("NOT water"), ["C", "D"], "a lone NOT is still a restriction");
  assert.deepEqual(or("NOT water NOT sewer"), ["D"], "several NOT atoms without a positive");
  /* The widened query is the case F-B10 (c) met: nothing in the strict reading, and the wider one must not be the whole record. */
  assert.deepEqual(sorted(w.ids({ q: "main sewer NOT budget water", viewer: V })), []);
  assert.deepEqual(or("main sewer NOT budget water"), ["A", "C"], "the OR reading counts what no NOT excludes");
  assert.equal(compile({ q: "main sewer NOT budget water", viewer: V }).widenable, true);
});

test("R24 NEAR: proximity in free text, text: and passage:, capitals only, with its fallbacks and clamp", () => {
  const w = world();
  w.bundle("A", { body: "alpha one two three beta" });                 // three tokens between
  w.bundle("B", { body: "alpha " + "x ".repeat(20) + "beta" });         // 21 apart
  w.bundle("C", { body: "the water main gamma broke" });
  const ids = (q) => sorted(w.ids({ q, viewer: V }));
  assert.deepEqual(ids("NEAR(alpha beta)"), ["A"], "n is 10 when absent");
  assert.deepEqual(ids("NEAR(alpha beta, 2)"), [], "within n tokens");
  assert.deepEqual(ids("NEAR(alpha beta, 3)"), ["A"]);
  assert.deepEqual(ids("NEAR(alpha beta, 30)"), ["A", "B"]);
  assert.deepEqual(ids('NEAR("water main" broke, 1)'), ["C"], "a quoted phrase is one term");
  assert.deepEqual(ids("NEAR(wat* broke, 2)"), ["C"], "a prefix term");
  assert.deepEqual(ids("text:NEAR(alpha beta)"), ["A"], "inside text:");
  assert.deepEqual(ids("near(alpha beta)"), [], "lower-case near is a word, ANDed with the rest");
  const p = compile({ q: "NEAR(alpha beta, 3)", viewer: V });
  assert.deepEqual(p.warnings, []);
  const clamp = compile({ q: "NEAR(alpha beta, 500)", viewer: V });
  assert.ok(clamp.warnings.some((x) => /distance 500 is outside 0–100; read as 100/.test(x)));
  assert.deepEqual(ids("NEAR(alpha beta, 500)"), ["A", "B"]);
  assert.ok(compile({ q: "NEAR(alpha beta, -2)", viewer: V }).warnings.some((x) => /read as 0/.test(x)));
  for (const [q, whyKey, vars] of [["NEAR(alpha)", "query.why.proximity_needs_two", { kept: "one term" }],
                                   ["NEAR(alpha beta, 2.5)", "query.why.distance_whole_number", { dist: '"2.5"' }],
                                   ["NEAR(alpha beta, x)", "query.why.distance_whole_number", { dist: '"x"' }],
                                   ["NEAR(alpha beta", "query.why.closing_parenthesis", {}],
                                   ["NEAR(alpha --- , 3)", "query.why.proximity_needs_two", { kept: "one term" }]]) {
    const c = compile({ q, viewer: V });
    assert.ok(hasWord("query.read_terms_joined"), "the joined-by-AND wrapper is held");
    assert.ok(c.warnings.some((x) => x.endsWith(word(whyKey, vars))), `${q}: ${c.warnings}`);
  }
  assert.deepEqual(ids("NEAR(alpha beta, 2.5)"), ["A", "B"], "distance reads as AND");
  assert.deepEqual(ids("NEAR(alpha beta, 2.5)"), ids("alpha AND beta"));
  /* passage: over the indexed text of captures. */
  w.insert("capture_text", { capture_sha: "s1", bundle_id: "A", extent_kind: "pdf-page", extent: "{\"page\":0}",
                             ref: "p1", seq: 0, text: "culvert one two three four five six failed", chain_kind: "ocr" });
  w.insert("capture_text", { capture_sha: "s1", bundle_id: "A", extent_kind: "pdf-page", extent: "{\"page\":1}",
                             ref: "p2", seq: 1, text: "culvert failed", chain_kind: "ocr" });
  const pr = w.run({ q: "passage:NEAR(culvert failed, 1)", viewer: V, rows: "passage" }, "meaning");
  assert.deepEqual(pr.rows.map((r) => r.ref), ["p2"]);
  assert.deepEqual(pr.plan.meaningArms.map((a) => a.arm), ["passage"]);
  assert.deepEqual(w.run({ q: "passage:NEAR(culvert failed)", viewer: V, rows: "passage" }, "meaning").rows
    .map((r) => r.ref), ["p1", "p2"]);
  const fb = compile({ q: "passage:NEAR(culvert failed, x)", viewer: V, rows: "passage" });
  assert.deepEqual(fb.meaningArms.map((a) => a.arm), ["passage", "passage"], "its terms as passage: terms");
  /* R7: the terms and the distance move only in args. */
  const base = compile({ q: "NEAR(a b, 3)", viewer: V }).statements;
  const other = compile({ q: `NEAR("x'); DROP TABLE bundles; --" y*, 99)`, viewer: V }).statements;
  for (const k of ["page", "count", "ids"]) assert.equal(base[k]().sql, other[k]().sql);
  assert.ok(base.count().args.includes('NEAR("a" "b", 3)'));
});
