/* case-grammar at its interface: R18, the `calculations:` block, written and read back exactly with its key computed by
   `calc-grammar`, with its negative controls; R19, its PROV-O rendering; R13, the `calculation` kind of the case file and
   its three paths; R1, the block joining `/7` with no `/8`. Driven on the bytes alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { resultKey, checkRecipe } from "../../../src/calc-grammar/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc, sha } from "./helpers.mjs";
import { CALCS, RECIPE, INPUT_BYTES, caseFileFixture, manifestFor } from "./casefile-fixture.mjs";

const V7 = CG.CASE_DOCUMENT_FORMAT_V7;
const V8 = CG.CASE_DOCUMENT_FORMAT;
const OLDER = ["bio-case-document/5", "bio-case-document/4", "bio-case-document/3", "bio-case-document/2",
               "bio-case-document/1", null];
const fmOf = (text) => { const p = parseFrontmatter(text); assert.deepEqual(p.findings, [], "the grammar reads every line"); return p.data; };
const HARD = "It's \"exact\" \\ here # not a comment\nline two — é";
const KEY = (c) => resultKey(c.recipe, c.inputs, { methodVersion: c.method_version });

/* ===== R18 ===== */

test("R18 the calculations: block round-trips every row exactly, its recipe as canonical JSON, its inputs by name and SHA-256, its results by key, and its result key calc-grammar's", () => {
  assert.deepEqual([...CG.CALCULATION_FIELDS], ["calc", "recipe", "inputs", "method_version", "results", "result_key",
    "recompute", "disclosed"]);
  assert.deepEqual([...CG.RECOMPUTE_STATUSES], ["agrees", "differs", "unbound", "not_recomputed"]);
  const rows = [
    ...CALCS,
    { calc: "CALC-2026-0002", recipe: { ...RECIPE, steps: [{ op: "count", as: "n", from: "payments" }], output: "n" },
      inputs: [{ name: "payments", sha256: sha(INPUT_BYTES) }, { name: "b", sha256: sha("b") }], method_version: "bio-calc/1",
      results: { n: 2, note: HARD }, recompute: "agrees", disclosed: null },
    { calc: "CALC-2026-0003", recipe: RECIPE, inputs: { payments: sha("other") }, method_version: "bio-calc/1", results: {},
      recompute: "unbound", disclosed: HARD },
  ];
  for (const r of rows) assert.deepEqual(checkRecipe(r.recipe), { ok: true }, "each a bio-calc/1 recipe calc-grammar accepts");
  const lines = CG.calculationsLines(rows);
  assert.equal(lines[0], "calculations:");
  const fm = fmOf(doc(V7, lines));
  assert.deepEqual(fm.calculations.map((r) => Object.keys(r)), rows.map(() => [...CG.CALCULATION_FIELDS]), "flat rows");
  const back = CG.calculationsOf(fm);
  assert.deepEqual(back, [
    { ...CALCS[0], result_key: KEY(CALCS[0]) },
    { ...rows[1], inputs: { payments: sha(INPUT_BYTES), b: sha("b") }, result_key: KEY({ ...rows[1], inputs: { payments: sha(INPUT_BYTES), b: sha("b") } }) },
    { ...rows[2], result_key: KEY(rows[2]) }]);
  assert.equal(back[1].results.note, HARD, "every value exactly as handed");
  assert.equal(back[2].disclosed, HARD);
  /* the key is calc-grammar's, at the row's method version: another version, another key */
  assert.match(back[0].result_key, /^[0-9a-f]{64}$/);
  assert.notEqual(resultKey(RECIPE, CALCS[0].inputs, { methodVersion: "bio-calc/2" }), back[0].result_key);
  /* the recipe is its canonical JSON in one quoted value */
  assert.equal(lines.some((l) => l.startsWith("    recipe: '{\"inputs\":")), true, "keys sorted: canonical");
});

test("R18 the key is computed, never copied: a row handed a key its recipe does not give is written with calc-grammar's", () => {
  const forged = CG.calculationsOf(fmOf(doc(V7, CG.calculationsLines([{ ...CALCS[0], result_key: sha("forged") }]))));
  assert.equal(forged[0].result_key, KEY(CALCS[0]));
  /* a row that cannot be keyed states its key undetermined */
  for (const bad of [{ recipe: null }, { inputs: { payments: "not-a-hash" } }, { method_version: null }, { inputs: [{ name: "a", sha256: sha("x") }, { name: "a", sha256: sha("y") }] }])
    assert.equal(CG.calculationsOf(fmOf(doc(V7, CG.calculationsLines([{ ...CALCS[0], ...bad }]))))[0].result_key, null, JSON.stringify(bad));
});

test("R18 R6 negative controls: no block, an older format and odd input answer an empty list; a value outside its words reads null; the writer never throws", () => {
  assert.deepEqual(CG.calculationsLines([]), ["calculations: []"]);
  for (const odd of [null, undefined, 7, "x", {}, [null, 7]]) assert.deepEqual(CG.calculationsLines(odd), ["calculations: []"]);
  assert.deepEqual(CG.calculationsOf(fmOf(doc(V7, CG.calculationsLines([])))), []);
  assert.deepEqual(CG.calculationsOf(fmOf(doc(V7))), [], "a document without the block answers an empty list");
  for (const format of OLDER)
    assert.deepEqual(CG.calculationsOf(fmOf(doc(format, CG.calculationsLines(CALCS)))), [], `format ${format}`);
  for (const odd of [null, undefined, 7, "x", {}, [], { get format() { throw new Error("boom"); } },
                     { format: V7, get calculations() { throw new Error("boom"); } }])
    assert.deepEqual(CG.calculationsOf(odd), []);
  const odd = CG.calculationsOf(fmOf(doc(V7, CG.calculationsLines([{ calc: "CALC-2026-0009", recipe: "sum it", recompute: "maybe",
                                                                       results: [1], disclosed: "" }]))));
  assert.deepEqual(odd, [{ calc: "CALC-2026-0009", recipe: null, inputs: null, method_version: null, results: null,
                           result_key: null, recompute: null, disclosed: null }], "undetermined, never guessed");
  /* bytes another hand wrote that this writer could not have: read null */
  assert.deepEqual(CG.calculationsOf({ format: V7, calculations: [{ calc: "x", result_key: "ABC", recompute: "agrees", inputs: '{"a":"b"}' }] }),
                   [{ calc: null, recipe: null, inputs: null, method_version: null, results: null, result_key: null,
                      recompute: null, disclosed: null }]);
});

test("R1 R18 R20 R33 the blocks joined /7 and /8 states them as /7 does: every predicate as before, and a /7 or /8 document without them reads none", () => {
  /* R35 (T53): the format in force is /10; /8 and /7 stay accepted */
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  assert.equal(CG.CASE_DOCUMENT_FORMATS_ACCEPTED.includes("bio-case-document/8"), true);
  assert.equal(CG.CASE_DOCUMENT_FORMATS_ACCEPTED.includes("bio-case-document/7"), true);
  const text = doc(V7, [...CG.calculationsLines(CALCS), ...CG.timelineLines([]), ...CG.methodBlockLines({ grading: "bio-grading/1" })]);
  const fm = fmOf(text);
  assert.deepEqual([CG.caseDocumentRequiresMaterials(fm), CG.caseDocumentRequiresTensionSection(fm)], [true, true]);
  assert.equal(CG.calculationsOf(fm).length, 1);
  assert.deepEqual(CG.methodOf(fm), { grading: "bio-grading/1", checks: null }, "the earlier blocks read as before");
  assert.deepEqual([CG.calculationsOf(fmOf(doc(V7))), CG.timelineOf(fmOf(doc(V7)))], [[], { they_did: [], we_did: [] }]);
  /* /8 reads the same blocks the same way (R33: it differs from /7 in words only) */
  const text8 = doc(V8, [...CG.calculationsLines(CALCS), ...CG.timelineLines([]), ...CG.methodBlockLines({ grading: "bio-grading/3" })]);
  assert.deepEqual([CG.calculationsOf(fmOf(text8)), CG.methodOf(fmOf(text8))], [CG.calculationsOf(fm), { grading: "bio-grading/3", checks: null }]);
  assert.deepEqual([CG.calculationsOf(fmOf(doc(V8))), CG.timelineOf(fmOf(doc(V8)))], [[], { they_did: [], we_did: [] }]);
  /* /6 is read the same way (R17's precedent) */
  assert.equal(CG.calculationsOf(fmOf(doc("bio-case-document/6", CG.calculationsLines(CALCS)))).length, 1);
});

/* ===== R19 ===== */

test("R19 provOf renders the rows as W3C PROV-O JSON-LD: each calculation an Activity that used each input (named by its SHA-256) and generated each result (named by the calculation and its key), the recipe and method version its Plan", () => {
  assert.equal(CG.PROV_NAMESPACE, "http://www.w3.org/ns/prov#");
  const text = CG.provOf(CALCS);
  const ld = JSON.parse(text);
  assert.equal(ld["@context"].prov, CG.PROV_NAMESPACE);
  const byId = new Map(ld["@graph"].map((n) => [n["@id"], n]));
  const c = CALCS[0];
  const act = byId.get(CG.provIds.calculation(c.calc));
  assert.equal(act["@type"], "prov:Activity");
  assert.deepEqual(act["prov:used"], [{ "@id": `urn:sha256:${sha(INPUT_BYTES)}` }]);
  assert.deepEqual(act["prov:qualifiedUsage"][0]["prov:hadRole"], { "@id": "bio:input/payments" });
  assert.deepEqual(act["prov:generated"], [{ "@id": CG.provIds.result(c.calc, "total") }]);
  assert.deepEqual(act["prov:qualifiedAssociation"]["prov:hadPlan"], { "@id": CG.provIds.plan(c.calc) });
  assert.equal(act["bio:resultKey"], KEY(c));
  const plan = byId.get(CG.provIds.plan(c.calc));
  assert.deepEqual(plan["@type"], ["prov:Entity", "prov:Plan"]);
  assert.deepEqual(JSON.parse(plan["bio:recipe"]), RECIPE);
  assert.equal(plan["bio:methodVersion"], "bio-calc/1");
  const result = byId.get(CG.provIds.result(c.calc, "total"));
  assert.deepEqual([result["@type"], result["prov:wasGeneratedBy"], JSON.parse(result["prov:value"])],
                   ["prov:Entity", { "@id": act["@id"] }, c.results.total]);
  assert.equal(byId.get(`urn:sha256:${sha(INPUT_BYTES)}`)["@type"], "prov:Entity");
  /* it adds no fact: nothing in it that is not in a row (no time, no agent) */
  for (const added of ["prov:startedAtTime", "prov:endedAtTime", "prov:wasAssociatedWith", "prov:Agent", "prov:generatedAtTime"])
    assert.equal(text.includes(added), false, added);
  assert.equal(ld["@graph"].length, 4, "the activity, its plan, its result and its input; nothing else");
});

test("R19 the same rows always give the same bytes, read back or as handed; an input two calculations share is one entity; odd input renders an empty graph and never throws", () => {
  const two = [...CALCS, { ...CALCS[0], calc: "CALC-2026-0002", results: { total: "1" } }];
  assert.equal(CG.provOf(two), CG.provOf(two));
  assert.equal(CG.provOf(CG.calculationsOf(fmOf(doc(V7, CG.calculationsLines(two))))), CG.provOf(two), "the carried rows give the same bytes");
  const graph = JSON.parse(CG.provOf(two))["@graph"];
  assert.equal(graph.filter((n) => n["@id"] === `urn:sha256:${sha(INPUT_BYTES)}`).length, 1);
  const empty = CG.provOf([]);
  for (const odd of [null, undefined, 7, "x", {}, [null, 7], [{ recipe: RECIPE }]]) assert.equal(CG.provOf(odd), empty, "a row with no calc is not rendered");
  assert.deepEqual(JSON.parse(empty)["@graph"], []);
});

/* ===== R13: the calculation kind ===== */

test("R13 the calculation kind: the row, each input named by its hash, and the PROV-O file, each read back from its path; a manifest listing an input with another hash departs", () => {
  const C = "CALC-2026-0001";
  const h = sha(INPUT_BYTES);
  assert.equal(CG.caseFilePath("calculation", C), `calculations/${C}/calculation.json`);
  assert.equal(CG.caseFilePath("calculation", [C, h]), `calculations/${C}/inputs/${h}`);
  assert.equal(CG.caseFilePath("calculation", "prov"), CG.CASE_FILE_PROV_PATH);
  assert.equal(CG.CASE_FILE_PROV_PATH, "calculations/prov.jsonld");
  assert.deepEqual(CG.caseFileEntryOf(`calculations/${C}/calculation.json`), { kind: "calculation", calc: C });
  assert.deepEqual(CG.caseFileEntryOf(`calculations/${C}/inputs/${h}`), { kind: "calculation", calc: C, input: h });
  assert.deepEqual(CG.caseFileEntryOf("calculations/prov.jsonld"), { kind: "calculation", prov: true });
  for (const [key, why] of [[[C, "nothex"], "an input not named by a hash"], [["../x", h], "a bad id"], [null, "no key"], ["a/b", "a path"]])
    assert.equal(CG.caseFilePath("calculation", key), null, why);
  for (const path of [`calculations/${C}/other.json`, `calculations/${C}/inputs/${h}/x`, `calculations/${C}/inputs/${h.toUpperCase()}`,
                      "calculations/prov.json", `calculations/../inputs/${h}`])
    assert.equal(CG.caseFileEntryOf(path), null, path);
  /* the row's file is its canonical JSON, key computed */
  assert.deepEqual(JSON.parse(CG.calculationFileText(CALCS[0])), { ...CALCS[0], result_key: KEY(CALCS[0]) });
  /* a whole case file carrying them meets the rule */
  const { manifest } = caseFileFixture({ t33: true });
  assert.deepEqual(manifest.files.filter((f) => f.kind === "calculation").map((f) => f.path),
                   [`calculations/${C}/calculation.json`, `calculations/${C}/inputs/${h}`, "calculations/prov.jsonld"]);
  assert.deepEqual(CG.caseFileManifestCheck(manifest), []);
  /* an input file listed with a hash its path does not name */
  const i = manifest.files.findIndex((f) => f.path.includes("/inputs/"));
  const wrong = manifestFor(manifest.files.map((f, j) => (j === i ? { ...f, sha256: sha("other bytes") } : f)));
  assert.equal(CG.caseFileManifestCheck(wrong).some((d) => d.rule === "input_sha" && d.at === `files[${i}].sha256`), true);
  const kindWrong = manifestFor(manifest.files.map((f, j) => (j === i ? { ...f, kind: "document" } : f)));
  assert.equal(CG.caseFileManifestCheck(kindWrong).some((d) => d.rule === "path_kind"), true);
});

test("R18 K1639 a workbook row states recompute: not_recomputed, its calc the capture's SHA-256, its inputs empty and its result key null; written, read back and rendered", () => {
  const capture = sha("the workbook's bytes");
  const workbook = { calc: capture, recipe: null, inputs: {}, method_version: "ironcalc/0.5", results: { "Sheet1!B7": "14.75" },
                     recompute: "not_recomputed", disclosed: null };
  const lines = CG.calculationsLines([workbook, CALCS[0]]);
  assert.equal(lines.includes("    recompute: '\"not_recomputed\"'"), true, "written");
  const back = CG.calculationsOf(fmOf(doc(V7, lines)));
  assert.deepEqual(back[0], { ...workbook, result_key: null }, "read back, its key null");
  assert.equal(back[1].recompute, CALCS[0].recompute, "beside a recipe row, each as written");
  /* its file in a case file is at its capture's SHA-256 */
  assert.equal(CG.caseFilePath("calculation", capture), `calculations/${capture}/calculation.json`);
  assert.deepEqual(JSON.parse(CG.calculationFileText(workbook)), { ...workbook, result_key: null });
  /* the complete edition states it in words, and it is never a gate: the row is rendered like any other */
  assert.equal(sha(CG.RECOMPUTE_WORDS.not_recomputed.slice(0, 19)), "00857f75962bb3c0f960c11fa9872d553806441b14abe8ab32565a2a96d2e7e2", "the status begins with its pinned words");
  /* negative control: a status outside the five words still reads null */
  assert.equal(CG.calculationsOf(fmOf(doc(V7, CG.calculationsLines([{ ...workbook, recompute: "not recomputed" }]))))[0].recompute, null);
});
