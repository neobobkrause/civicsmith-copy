/* run-rules T53 (AIR13, AD7, AD13, K5475, N829, N1258): the test bar read per AI and part. R36, `GATE_PART_OF` and
   `gatePartOf`; R19 as amended, the gate per entry on Gate 1 records with the standing measure that withdraws a part for
   one entry; R29 as amended, `partAdmittedOn(set, part, held, {testInstance, entry_id})`; R30 as amended, the refusal
   read by key `ai.refused.aipartnotdeployed` naming the entry; R37, `PART_WITHDRAWN`. Each has its control beside it. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { GATE_PART_OF, GATE_PARTS, GATE_VERDICTS, gatePartOf, checkGateRecord, partWithdrawnOn, partAdmittedOn,
         partAdmitted, partRefusal, untestedLabel, TEST_BAR_PARTS, DEPLOYMENT_SEQUENCE, AI_RUN_CHECKS, AI_RUN_OWN_CHECKS,
         checkTestBarRecord, deployedModesFor, CIVICSMITH_TEST_SET, PART_REFUSAL_WORDS } from "../../../src/run-rules/index.mjs";
import { PART_OF_KIND } from "../../../src/ai-accounts/index.mjs";
import * as RR from "../../../src/run-rules/index.mjs";
import { PARTS as CATALOGUE_PARTS, gateOf } from "../ai-catalogue/fixture.mjs";

const EMPTY = Object.freeze({ id: "fixture", version: 2, matters: Object.freeze([]) });
const FULL = Object.freeze({ id: "fixture", version: 2, matters: Object.freeze([{ id: "M1" }]) });
/** A Gate 1 record (`ai-gate` R37): the catalogue fixture's `gate[part]` for an entry, with its entry, part and grade. */
const gate = (entry_id, part, verdict = "passes", extra = {}) =>
  ({ ...gateOf(verdict, verdict === "passes_with_limits" ? [{ kind: "output_cap", value: 4096 }] : []),
     part, entry_id, grade: "MEASURED", ...extra });
const r75 = (entry_id, part, passed, at, set = FULL, extra = {}) => ({ part, entry_id, set: set.id, set_version: set.version,
  false_alarm_rate: 0, passed, graded_by: "harness", at, ...extra });
const ver = (mode) => ({ mode, run: `RUN-${mode}`, verified_by: "member:ann", at: "t", evidence: "op=audit clean" });
const IN = Object.freeze({ admitted: true, untested: null });
const OUT = Object.freeze({ admitted: false, untested: null });
const labelled = (part) => ({ admitted: true, untested: untestedLabel(part) });

test("R36: GATE_PART_OF maps every TEST_BAR_PARTS entry to one of the six gate parts, frozen — draft:reading to draft, extract to read, the account drafts to account, the explorer's use to run; the six equal the catalogue's part list and ai-accounts' PART_OF_KIND agrees on the use kinds both name; control: gatePartOf of a name outside TEST_BAR_PARTS is null", () => {
  assert.ok(Object.isFrozen(GATE_PART_OF) && Object.isFrozen(GATE_PARTS));
  assert.deepEqual(Object.keys(GATE_PART_OF), [...TEST_BAR_PARTS]);
  for (const p of TEST_BAR_PARTS) {
    assert.ok(GATE_PARTS.includes(GATE_PART_OF[p]), p);
    assert.equal(gatePartOf(p), GATE_PART_OF[p], p);
  }
  assert.equal(GATE_PARTS.length, 6);
  assert.deepEqual([...GATE_PARTS].sort(), [...CATALOGUE_PARTS].sort(), "the catalogue's part ids");
  assert.deepEqual(new Set(Object.values(GATE_PART_OF)), new Set(GATE_PARTS), "every gate part is some fine part's");
  assert.equal(gatePartOf("draft:reading"), "draft");
  assert.equal(gatePartOf("extract"), "read");
  assert.equal(gatePartOf("read"), "read");
  assert.equal(gatePartOf("enquire"), "draft");
  assert.equal(gatePartOf("explore"), "run");
  assert.equal(gatePartOf("draft:case_account"), "account");
  assert.equal(gatePartOf("draft:account_check"), "account");
  for (const p of ["check", "plan", "investigate"]) assert.equal(gatePartOf(p), "run", p);
  assert.deepEqual(TEST_BAR_PARTS.filter((p) => gatePartOf(p) === "read"), ["extract", "read"], "extract and reading only");
  /* ai-accounts' PART_OF_KIND, on the use kinds that are fine parts here too */
  const both = Object.keys(PART_OF_KIND).filter((k) => TEST_BAR_PARTS.includes(k));
  assert.ok(both.length >= 5, both.join());
  for (const k of both) assert.equal(gatePartOf(k), PART_OF_KIND[k], k);
  /* control */
  for (const x of ["nonsense", "draft", "draft:", "run", "account", "", null, undefined, 3, "__proto__", "toString"])
    assert.equal(gatePartOf(x), null, String(x));
});

test("R19 (T53): the gate per entry — an entry with passes for draft admits draft:own_words and draft:reading; control: the same entry not_yet_rated (or not_suitable) admits neither; an entry with passes for ask and none for run admits ask and refuses check", () => {
  const held = (records) => ({ verifications: [], testBars: [], gateRecords: records });
  for (const v of ["passes", "passes_with_limits"]) for (const p of ["draft:own_words", "draft:reading"])
    assert.deepEqual(partAdmittedOn(EMPTY, p, held([gate("e1", "draft", v)]), { entry_id: "e1" }), IN, `${p} ${v}`);
  for (const v of ["not_yet_rated", "not_suitable"]) for (const p of ["draft:own_words", "draft:reading"])
    assert.deepEqual(partAdmittedOn(EMPTY, p, held([gate("e1", "draft", v)]), { entry_id: "e1" }), OUT, `${p} ${v}`);
  const askOnly = held([gate("e1", "ask")]);
  assert.deepEqual(partAdmittedOn(EMPTY, "ask", askOnly, { entry_id: "e1" }), IN);
  assert.deepEqual(partAdmittedOn(EMPTY, "check", askOnly, { entry_id: "e1" }), OUT);
  /* the record is the entry's own: another entry's pass admits nothing for this one */
  assert.deepEqual(partAdmittedOn(EMPTY, "ask", askOnly, { entry_id: "e2" }), OUT);
  /* the latest well-formed record for the entry and gate part stands */
  const later = held([gate("e1", "ask", "passes", { at: "2026-10-01T00:00:00Z" }), gate("e1", "ask", "not_suitable", { at: "2026-10-05T00:00:00Z" })]);
  assert.deepEqual(partAdmittedOn(EMPTY, "ask", later, { entry_id: "e1" }), OUT);
  /* the chain still stands: investigate needs check verified, whatever Gate 1 says */
  const run = held([gate("e1", "run")]);
  assert.deepEqual(partAdmittedOn(EMPTY, "check", run, { entry_id: "e1" }), IN);
  assert.deepEqual(partAdmittedOn(EMPTY, "investigate", run, { entry_id: "e1" }), OUT);
  assert.deepEqual(partAdmittedOn(EMPTY, "investigate", { ...run, verifications: [ver("check")] }, { entry_id: "e1" }), IN);
  /* the deploy flags never move */
  assert.deepEqual([...deployedModesFor()], [...deployedModesFor({})]);
});

test("R19 (T53): checkGateRecord — the shape ai-gate R37 hands in, judged here: an object naming a gate part, an entry, the four suite versions, a verdict of the four, its limits (non-empty for passes_with_limits), a grade and a time; an unfit record admits nothing", () => {
  assert.deepEqual([...GATE_VERDICTS], ["passes", "passes_with_limits", "not_suitable", "not_yet_rated"]);
  for (const p of GATE_PARTS) for (const v of GATE_VERDICTS) assert.equal(checkGateRecord(gate("e1", p, v)), null, `${p} ${v}`);
  const unfit = [null, 3, [], "x", gate("e1", "check"), gate("", "ask"), gate(" ", "ask"), gate(3, "ask"),
    gate("e1", "ask", "fine"), gate("e1", "ask", "passes", { limits: null }),
    gate("e1", "ask", "passes_with_limits", { limits: [] }), gate("e1", "ask", "passes", { suiteVersions: null }),
    gate("e1", "ask", "passes", { suiteVersions: { bank: 1, scorer: 1, thresholds: 1 } }),
    gate("e1", "ask", "passes", { suiteVersions: { bank: "", scorer: 1, thresholds: 1, image: 1 } }),
    gate("e1", "ask", "passes", { grade: "" }), gate("e1", "ask", "passes", { at: "" }), gate("e1", "ask", "passes", { at: 3 })];
  for (const r of unfit) {
    assert.notEqual(checkGateRecord(r), null, JSON.stringify(r));
    assert.deepEqual(partAdmittedOn(EMPTY, "ask", { gateRecords: [r] }, { entry_id: "e1" }), OUT, JSON.stringify(r));
  }
});

test("R19 (T53), R37: the standing measure withdraws a part for one entry — a failed R75 record for entry A on the current set refuses check for A though A passed Gate 1, a later passed record restores it, and entry B with no failed record still admits check; control: a part never measured on the real set is not withdrawn", () => {
  const gates = [gate("A", "run"), gate("B", "run")];
  const failed = { gateRecords: gates, testBars: [r75("A", "check", false, "2026-10-10T00:00:00Z")] };
  assert.deepEqual(partAdmittedOn(FULL, "check", failed, { entry_id: "A" }), OUT);
  assert.deepEqual(partAdmittedOn(FULL, "check", failed, { entry_id: "B" }), IN, "other entries are unaffected");
  assert.deepEqual(partAdmittedOn(FULL, "plan", failed, { entry_id: "A" }), IN, "only the measured fine part is withdrawn");
  /* withdrawal is not the test bar: a test instance does not lift it */
  assert.deepEqual(partAdmittedOn(FULL, "check", { ...failed, gateRecords: [] }, { entry_id: "A", testInstance: true }), OUT);
  const w = partWithdrawnOn(FULL, "check", "A", failed.testBars);
  assert.deepEqual(w, { part: "check", entry_id: "A", set: "fixture", set_version: 2 });
  assert.ok(Object.isFrozen(w));
  const restored = { gateRecords: gates, testBars: [...failed.testBars, r75("A", "check", true, "2026-10-11T00:00:00Z")] };
  assert.deepEqual(partAdmittedOn(FULL, "check", restored, { entry_id: "A" }), IN);
  assert.equal(partWithdrawnOn(FULL, "check", "A", restored.testBars), null);
  /* an earlier version's, another set's, an unfit or an entry-less failure withdraws nothing */
  for (const r of [r75("A", "check", false, "t", { ...FULL, version: 1 }), r75("A", "check", false, "t", { ...FULL, id: "group:x" }),
                   r75("A", "check", false, "t", FULL, { false_alarm_rate: 7 }), r75(undefined, "check", false, "t")])
    assert.equal(partWithdrawnOn(FULL, "check", "A", [r]), null, JSON.stringify(r));
  /* control: never measured on the real set, nothing is withdrawn; Civicsmith's own set (no matters) withdraws nothing */
  assert.equal(partWithdrawnOn(FULL, "check", "A", []), null);
  assert.equal(partWithdrawnOn(FULL, "ask", "A", failed.testBars), null);
  assert.equal(partWithdrawnOn(EMPTY, "check", "A", [r75("A", "check", false, "t", EMPTY)]), null);
  /* R37: the refusal names the part, the entry and the set version, read by key */
  const r = partRefusal("check", "A", { set: FULL, held: failed });
  assert.equal(r.code, "PART_WITHDRAWN");
  assert.deepEqual([r.ok, r.part, r.entry_id, r.set, r.set_version, r.words], [false, "check", "A", "fixture", 2, "ai.refused.partwithdrawn"]);
  assert.equal(r.check, AI_RUN_CHECKS.PART_WITHDRAWN.check);
  assert.equal(r.translation, AI_RUN_CHECKS.PART_WITHDRAWN.translation);
  assert.equal(AI_RUN_OWN_CHECKS.PART_WITHDRAWN, AI_RUN_CHECKS.PART_WITHDRAWN);
  /* control: entry B, or a part never measured, is refused as not deployed, never withdrawn */
  assert.equal(partRefusal("check", "B", { set: FULL, held: failed }).code, "AI_PART_NOT_DEPLOYED");
  assert.equal(partRefusal("ask", "A", { set: FULL, held: failed }).code, "AI_PART_NOT_DEPLOYED");
  /* R75's record carries its entry: a blank one is unfit */
  assert.equal(checkTestBarRecord(r75("A", "check", true, "t")), null);
  assert.equal(checkTestBarRecord(r75("", "check", true, "t")).field, "entry_id");
  assert.equal(checkTestBarRecord(r75(3, "check", true, "t")).field, "entry_id");
});

test("R29 (T53): on an empty real set, an entry with passes for ask and testInstance false admits ask unlabelled; control: no entry_id admits nothing outside a test instance; the R29 controls of today hold with gateRecords empty", () => {
  const held = { verifications: [], testBars: [], gateRecords: [gate("e1", "ask")] };
  assert.deepEqual(partAdmittedOn(CIVICSMITH_TEST_SET, "ask", held, { testInstance: false, entry_id: "e1" }), IN);
  assert.deepEqual(partAdmitted("ask", held, { entry_id: "e1" }), IN);
  /* control: no entry, or one that is not a string */
  for (const opts of [{ testInstance: false }, {}, undefined, { entry_id: 3 }, { entry_id: "" }, { entry_id: ["e1"] },
                      Object.create({ entry_id: "e1" })])
    assert.deepEqual(partAdmittedOn(CIVICSMITH_TEST_SET, "ask", held, opts), OUT, JSON.stringify(opts));
  /* on a test instance with no entry the exception still labels; with the entry's pass it is unlabelled */
  assert.deepEqual(partAdmittedOn(EMPTY, "ask", held, { testInstance: true }), labelled("ask"));
  assert.deepEqual(partAdmittedOn(EMPTY, "ask", held, { testInstance: true, entry_id: "e1" }), IN);
  /* today's controls with gateRecords empty: only the literal true is a test instance; the chain stands */
  const none = { verifications: [], testBars: [], gateRecords: [] };
  for (const p of TEST_BAR_PARTS) {
    for (const opts of [{ testInstance: false, entry_id: "e1" }, { entry_id: "e1" }, { testInstance: "yes", entry_id: "e1" }])
      assert.deepEqual(partAdmittedOn(EMPTY, p, none, opts), OUT, `${p} ${JSON.stringify(opts)}`);
    const chainBlocked = DEPLOYMENT_SEQUENCE.order.indexOf(p) > 0 && p !== "plan";
    assert.deepEqual(partAdmittedOn(EMPTY, p, none, { testInstance: true, entry_id: "e1" }), chainBlocked ? OUT : labelled(p), p);
  }
  /* a passed R75 record no longer opens the gate (the real set is the standing measure, not Gate 1) */
  const old = { testBars: [{ part: "ask", entry_id: "e1", set: FULL.id, set_version: FULL.version, false_alarm_rate: 0, passed: true,
                             graded_by: "harness", at: "t" }] };
  assert.deepEqual(partAdmittedOn(FULL, "ask", old, { entry_id: "e1" }), OUT);
  assert.deepEqual(partAdmittedOn(FULL, "ask", old, { entry_id: "e1", testInstance: true }), labelled("ask"));
});

test("R30 (T53): partRefusal(part, entry_id) is AI_PART_NOT_DEPLOYED carrying the key ai.refused.aipartnotdeployed and the entry; control: no English literal in src/ for it", () => {
  assert.equal(PART_REFUSAL_WORDS.AI_PART_NOT_DEPLOYED, "ai.refused.aipartnotdeployed");
  assert.equal(PART_REFUSAL_WORDS.PART_WITHDRAWN, "ai.refused.partwithdrawn");
  const r = partRefusal("ask", "e1");
  assert.deepEqual([r.ok, r.code, r.part, r.entry_id, r.words], [false, "AI_PART_NOT_DEPLOYED", "ask", "e1", "ai.refused.aipartnotdeployed"]);
  assert.equal(r.check, "C-22.29");
  assert.equal(r.translation, AI_RUN_CHECKS.AI_PART_NOT_DEPLOYED.translation);
  assert.equal(r.detail, r.translation, "the detail is the sentence read by key");
  /* no entry: named null; a non-string is never echoed */
  assert.equal(partRefusal("ask").entry_id, null);
  assert.equal(partRefusal("ask", { x: 1 }).entry_id, null);
  assert.equal(partRefusal("ask", "e".repeat(99)).entry_id.length, 40);
  /* control: the module's source holds no English sentence of either refusal; its words are read by key */
  const dir = new URL("../../../src/run-rules/", import.meta.url);
  const src = readdirSync(dir).filter((f) => f.endsWith(".mjs")).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  const fn = src.slice(src.indexOf("export function partRefusal"));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.ok(body.length > 0);
  assert.equal(/localize\(/.test(body), false, "partRefusal composes no sentence");
  assert.equal(/["'`][A-Z][a-z]+ [a-z]+ [a-z]+/.test(body), false, "partRefusal holds no English literal");
  assert.equal(/has not passed its bar on Civicsmith's test investigations/.test(src), false);
});

test("F2: PART_NOT_PASSED is a run-rules row beside AI_RUN_MODE_NOT_DEPLOYED, C-109.15, the next free number in C-109, minted by ai-runs at the open (its R40) and read here by key; control: C-109.1 keeps its code, number and site", () => {
  const row = RR.AI_RUN_OPEN_CHECKS.PART_NOT_PASSED;
  assert.deepEqual(Object.keys(RR.AI_RUN_OPEN_CHECKS), ["AI_RUN_MODE_NOT_DEPLOYED", "PART_NOT_PASSED"], "beside C-109.1");
  assert.equal(row.check, "C-109.15");
  assert.equal(row.where, "src/ai-runs/index.mjs open > is-airun-open-part, reached from op=airunopen");
  assert.equal(AI_RUN_CHECKS.PART_NOT_PASSED, row);
  assert.equal(RR.translationOf("PART_NOT_PASSED"), row.translation);
  assert.ok(typeof row.translation === "string" && row.translation.length >= 40);
  /* the next free number: above every held and retired C-109 number, and none taken twice */
  const held = [...Object.values(AI_RUN_CHECKS), ...Object.values(RR.RETIRED_CHECKS)].map((r) => r.check).filter((c) => c.startsWith("C-109."));
  assert.equal(new Set(held).size, held.length);
  const others = held.filter((c) => c !== "C-109.15" && c !== "C-109.16").map((c) => Number(c.split(".")[1]));
  assert.equal(Math.max(...others) + 1, 15);
  /* control: C-109.1 keeps its code, number and site, and its sentence is not this one */
  assert.deepEqual([RR.AI_RUN_OPEN_CHECKS.AI_RUN_MODE_NOT_DEPLOYED.check, RR.AI_RUN_OPEN_CHECKS.AI_RUN_MODE_NOT_DEPLOYED.where],
                   ["C-109.1", "src/ai-runs/index.mjs open > is-airun-open-mode, reached from op=airunopen"]);
  assert.notEqual(row.translation, RR.AI_RUN_OPEN_CHECKS.AI_RUN_MODE_NOT_DEPLOYED.translation);
});

test("F3: AI_RUN_IDEM_INVALID is a run-rules row, C-109.16, the number after F2's, minted by ai-runs at spawnPayload, tick and close (its R106) and read here by key; control: no other code holds C-109.16", () => {
  const row = RR.AI_RUN_IDEM_CHECKS.AI_RUN_IDEM_INVALID;
  assert.equal(row.check, "C-109.16");
  assert.equal(row.where, "src/ai-runs/index.mjs spawnPayload, tick, close > is-airun-idem, reached from op=airunspawn, op=airuntick, op=airunclose");
  assert.equal(AI_RUN_CHECKS.AI_RUN_IDEM_INVALID, row);
  assert.equal(RR.translationOf("AI_RUN_IDEM_INVALID"), row.translation);
  assert.ok(typeof row.translation === "string" && row.translation.length >= 40);
  assert.notEqual(row.translation, RR.AI_RUN_OPEN_CHECKS.PART_NOT_PASSED.translation, "each names its own condition");
  /* control */
  assert.deepEqual(Object.entries(AI_RUN_CHECKS).filter(([, r]) => r.check === "C-109.16").map(([c]) => c), ["AI_RUN_IDEM_INVALID"]);
});
