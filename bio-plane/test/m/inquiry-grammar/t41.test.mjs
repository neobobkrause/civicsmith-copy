/* inquiry-grammar's T41 requirement at the module's interface (T41-13; D59; K2448, K2472, K2474, K2479): R18's bias
   applications on a leg, `[{statement, effect, from?, to?}]`, written in front matter as numbered scalar keys
   (`bias_<n>_statement`, `_effect`, `_from`, `_to`, n from 1, contiguous) by `flattenBiasApplied` and read back by
   `readBiasApplied`; judged for their form only by `biasAppliedFindings` (the statement's being in force is `inquiry`
   R61's, store-side), each departure one C-2.8 error BIAS_APPLICATION_MALFORMED; they move no grade. New at T41, so
   findings are stated by hand, each arm with its negative control (K874); the corpus's golden parity is asserted again
   with well-formed applications on every leg. Pure functions, driven with documents, legs and front-matter text. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as IG from "../../../src/inquiry-grammar/index.mjs";
import { BASIS_GRADES, parseFrontmatter, checkBundle } from "../../../src/record-grammar/index.mjs";
import { derivedId } from "../../../src/connection-grammar/index.mjs";
import { INFO, INQ, REF, LEG_CASES, REGISTRY_VARIANTS, PUBLISHED, EARNED, legFm, inquiryDoc } from "./corpus.mjs";
import { GOLDEN, NOW, run, plain } from "./fixture.mjs";
const fieldKey = (m) => m.replace(/'[^']*'/g, "").split(/ is | names | must | has | states | carries | cannot | lowers | requires | rests | holds | applies | are |[(:,]/)[0].trim();

const { checkInquiryBasis, INQUIRY_GRAMMARS, INQUIRY_GRAMMAR_CHECKS, BIAS_EFFECTS, biasAppliedFindings, flattenBiasApplied,
        readBiasApplied } = IG;
const VARIANTS = Object.keys(REGISTRY_VARIANTS);
const CODE = "BIAS_APPLICATION_MALFORMED";
const STD = "STD-2026-0007-meetings-law", CALC = "CALC-2026-0003", OCC = `occurrence:DUT-2026-0004/OCC-${"0123456789abcdef".repeat(2)}`;
const FIVE = { kind: "acts-for", from: "ENT-2026-0001", to: "ENT-2026-0002", as_of: "2026-10-01", method: "line-walk/1" };
const DER_LEG = { target: derivedId(FIVE), ...Object.fromEntries(Object.entries(FIVE).map(([k, v]) => [`derivation_${k}`, v])) };
const GOOD = [{ statement: "funder-tilt", effect: "grade_lowered", from: "B", to: "C" }, { statement: "s2", effect: "leg_excluded" },
              { statement: "S 3", effect: "inference_refused" }];
const FLAT = { bias_1_statement: "funder-tilt", bias_1_effect: "grade_lowered", bias_1_from: "B", bias_1_to: "C",
               bias_2_statement: "s2", bias_2_effect: "leg_excluded", bias_3_statement: "S 3", bias_3_effect: "inference_refused" };
const shape = (xs) => xs.map((x) => [x.check, x.code ?? null, fieldKey(x.message)]);
/* the findings biasAppliedFindings pushes for a value (a row or a list), and its answer, which must be their number */
const judgeValue = (value, label = "basis leg 2", opts) => {
  const r = run((f) => biasAppliedFindings(label, value, f, opts));
  assert.equal(r.answer, r.findings.length, "answers the number of departures");
  return plain(r.findings);
};
/* a leg row carrying `list` in the encoding */
const leg = (list, over = {}) => ({ target: INFO, role: "supports", ...flattenBiasApplied(list), ...over });
const one = (value, first) => {
  const got = judgeValue(value);
  assert.deepEqual(got.map((x) => [x.check, x.severity, x.code]), [["C-2.8", "error", CODE]], JSON.stringify(value));
  assert.equal(fieldKey(got[0].message), first, got[0].message);
  assert.ok(Array.isArray(got[0].repairs) && got[0].repairs.length >= 1);
  return got[0];
};
/* one departure, the same, whether the application is handed in as a list or written on a leg row */
const oneBoth = (list, listFirst, rowFirst) => { one(list, listFirst); one(leg(list), rowFirst); };
const ofLegs = (legs, refs, pub = PUBLISHED, earned = EARNED) => plain(run((f) => checkInquiryBasis(
  { object_type: "inquiry", references: refs.map((target) => ({ target, rel: "cites" })), basis: legs }, f, pub, earned)).findings);

test("R18 BIAS_EFFECTS is grade_lowered, leg_excluded, inference_refused, frozen; a well-formed application of each effect is clean, as a list and written on a leg; none, an empty list or a row with no key of the encoding applies nothing", () => {
  assert.deepEqual([...BIAS_EFFECTS], ["grade_lowered", "leg_excluded", "inference_refused"]);
  assert.ok(Object.isFrozen(BIAS_EFFECTS));
  assert.deepEqual(judgeValue(GOOD), []);
  assert.deepEqual(judgeValue(leg(GOOD)), []);
  for (const a of GOOD) { assert.deepEqual(judgeValue([a]), [], JSON.stringify(a)); assert.deepEqual(judgeValue(leg([a])), [], JSON.stringify(a)); }
  for (const v of [undefined, null, "", [], {}, { target: INFO, role: "supports" }]) assert.deepEqual(judgeValue(v), [], JSON.stringify(v));
  /* negative control: one item broken is no longer clean, and only that item is named */
  assert.deepEqual(shape(judgeValue([GOOD[0], { ...GOOD[1], effect: "leg_dropped" }, GOOD[2]])), [["C-2.8", CODE, "the effect on application 2 of the bias applications on basis leg 2"]]);
  assert.deepEqual(shape(judgeValue(leg(GOOD, { bias_2_effect: "leg_dropped" }))), [["C-2.8", CODE, "the effect on application 2 of basis leg 2"]]);
});

test("R18 the one encoding (K2479): flattenBiasApplied writes numbered scalar keys from 1 in list order, readBiasApplied reads them back in number order; absent writes {}, an unwritable value null; a non-row reads []", () => {
  assert.deepEqual(flattenBiasApplied(GOOD), FLAT);
  assert.deepEqual(Object.keys(flattenBiasApplied(GOOD)), Object.keys(FLAT), "statement, effect, from, to, item by item");
  assert.deepEqual(readBiasApplied(FLAT), GOOD);
  assert.deepEqual(readBiasApplied(leg(GOOD)), GOOD, "beside the leg's own fields");
  for (const v of [undefined, null, "", []]) assert.deepEqual(flattenBiasApplied(v), {}, JSON.stringify(v));
  for (const v of ["s", 5, { statement: "s" }, [GOOD[0], "s"], [null], [["s"]], [{ statement: "s", effect: "leg_excluded", note: "x" }]])
    assert.equal(flattenBiasApplied(v), null, JSON.stringify(v));
  /* a field as handed in is written as it is, so the grammar judges what was handed in */
  assert.deepEqual(flattenBiasApplied([{ effect: "x", from: null }]), { bias_1_effect: "x", bias_1_from: null });
  for (const v of [undefined, null, "row", 5, [FLAT]]) assert.deepEqual(readBiasApplied(v), [], JSON.stringify(v));
  /* the reader reads the encoding's keys only, in number order, and never other keys */
  assert.deepEqual(readBiasApplied({ bias_10_statement: "t", bias_10_effect: "leg_excluded", bias_2_statement: "s", bias_01_statement: "z",
    bias_0_statement: "z", bias_3_reason: "z", bias_statements_sha: "f".repeat(64), bias_applied: GOOD, statement: "z" }),
    [{ statement: "s" }, { statement: "t", effect: "leg_excluded" }]);
});

test("R18 the encoding is storable: a leg written with flattenBiasApplied's keys in a bundle's front matter is parsed by record-grammar back to the same applications, and checkBundle with this module's grammar answers no finding; a list on the leg cannot be written so (negative control)", async () => {
  const statements = ["funder-tilt", "S 3", "null", "123", " padded ", "a:b", "[x]", "Déclaration № 2", "\u{1F4DC}".repeat(200)];
  const list = statements.map((statement, j) => (j === 0 ? { statement, effect: "grade_lowered", from: "A", to: "D" }
    : { statement, effect: j % 2 ? "leg_excluded" : "inference_refused" }));
  const id = "INQ-2026-0300-bias";
  const text = inquiryDoc(id, { basis: [{ target: INFO, role: "supports", ...flattenBiasApplied(list) }] });
  const parsed = parseFrontmatter(text);
  assert.deepEqual(parsed.findings, []);
  assert.deepEqual(readBiasApplied(parsed.data.basis[0]), list, "every value round-trips, padding, digits and null-like words included");
  const sha256 = async (b) => createHash("sha256").update(Buffer.from(b)).digest("hex");
  const judgeText = async (t) => plain((await checkBundle({ folderName: id, files: new Map([["bundle.md", t]]), sha256, nowMs: NOW,
    publishedRegistry: PUBLISHED, earnedRegistry: EARNED }, { grammars: INQUIRY_GRAMMARS })).findings);
  const bare = await judgeText(inquiryDoc(id, { basis: [{ target: INFO, role: "supports" }] }));
  assert.deepEqual(await judgeText(text), bare, "the applications add no finding");
  /* negative control: a statement with a #, written as a bare scalar, comes back cut at the comment (record-grammar R8),
     which is why R18 refuses one */
  const bare1 = inquiryDoc(id, { basis: [{ target: INFO, role: "supports", bias_1_statement: "PLACEHOLDER", bias_1_effect: "leg_excluded" }] });
  const hashed = parseFrontmatter(bare1.replace("PLACEHOLDER", "a #b"));
  assert.equal(readBiasApplied(hashed.data.basis[0])[0].statement, "a");
  assert.match(judgeValue([{ statement: "a #b", effect: "leg_excluded" }])[0].message, /cannot be written in the record/);
  /* negative control: a list of objects on a leg is not front matter's: the list item holds scalars only */
  const nested = parseFrontmatter(inquiryDoc(id, { basis: [{ target: INFO, role: "supports", bias_applied: "[funder-tilt, leg_excluded]" }] }));
  assert.ok(!Array.isArray(nested.data.basis[0].bias_applied) || nested.data.basis[0].bias_applied.every((x) => typeof x !== "object"));
});

test("R18 statement: any non-empty string a scalar can carry is the statement's id as its lens holds it, no minted form (K2474); missing, blank or not a string is one error; over 200 characters (counted as characters) or with a quote, backslash, newline or # is one error", () => {
  for (const s of ["funder-tilt", "BIA-1", "bia 7", "x", "Déclaration № 2", "a".repeat(200), "\u{1F4DC}".repeat(200), "a:b", "[x]"]) {
    assert.deepEqual(judgeValue([{ statement: s, effect: "leg_excluded" }]), [], s);
    assert.deepEqual(judgeValue(leg([{ statement: s, effect: "leg_excluded" }])), [], s);
  }
  for (const s of [undefined, null, "", "   ", "\t", 5, true, ["s"], { id: "s" }]) {
    oneBoth([{ statement: s, effect: "leg_excluded" }], "the statement on application 1 of the bias applications on basis leg 2", "the statement on application 1 of basis leg 2");
    assert.match(judgeValue([{ statement: s, effect: "leg_excluded" }])[0].message, /is missing or empty/);
  }
  one([{ effect: "leg_excluded" }], "the statement on application 1 of the bias applications on basis leg 2");
  one({ bias_1_effect: "leg_excluded" }, "the statement on application 1 of basis leg 2");
  for (const s of ["a".repeat(201), "\u{1F4DC}".repeat(201), 'say "x"', "it's", "a\\b", "a\nb", "a\rb", "a#b", "#1"]) {
    oneBoth([{ statement: s, effect: "leg_excluded" }], "the statement on application 1 of the bias applications on basis leg 2", "the statement on application 1 of basis leg 2");
    assert.match(judgeValue([{ statement: s, effect: "leg_excluded" }])[0].message, /cannot be written in the record: .* at most 200 characters, with no quote, backslash, newline or #$/);
  }
});

test("R18 effect: exactly one of the three; anything else (another lens's effect, a case variant, blank, absent, not a string) is one error, and from and to are then not asked", () => {
  for (const e of BIAS_EFFECTS) {
    const a = e === "grade_lowered" ? { statement: "s", effect: e, from: "A", to: "D" } : { statement: "s", effect: e };
    assert.deepEqual(judgeValue(leg([a])), [], e);
  }
  for (const e of ["scrutiny_raised", "GRADE_LOWERED", "grade-lowered", " leg_excluded", "", undefined, null, 3, ["leg_excluded"]]) {
    oneBoth([{ statement: "s", effect: e, from: "Z" }], "the effect on application 1 of the bias applications on basis leg 2", "the effect on application 1 of basis leg 2");
    assert.match(judgeValue([{ statement: "s", effect: e }])[0].message, /is not one of: grade lowered, leg excluded, inference refused$/);
  }
});

test("R18 grade_lowered names from and to, each a grade letter, to weaker than from: of every pair of letters exactly the lowerings are clean; an unknown or absent letter is one error naming it", () => {
  let clean = 0;
  for (const from of BASIS_GRADES) for (const to of BASIS_GRADES) {
    const list = [{ statement: "s", effect: "grade_lowered", from, to }];
    if (BASIS_GRADES.indexOf(to) > BASIS_GRADES.indexOf(from)) {
      assert.deepEqual(judgeValue(list), [], `${from}->${to}`); assert.deepEqual(judgeValue(leg(list)), [], `${from}->${to}`); clean++;
    } else {
      oneBoth(list, "application 1 of the bias applications on basis leg 2", "application 1 of basis leg 2");
      assert.match(judgeValue(leg(list))[0].message, new RegExp(`^application 1 of basis leg 2 lowers the grade from ${from} to ${to}, which is not lower`));
    }
  }
  assert.equal(clean, 6, "A>B, A>C, A>D, B>C, B>D, C>D");
  for (const bad of [undefined, null, "", "E", "b", "A+", 1]) {
    oneBoth([{ statement: "s", effect: "grade_lowered", from: bad, to: "D" }], "the grade it started from on application 1 of the bias applications on basis leg 2", "the grade it started from on application 1 of basis leg 2");
    oneBoth([{ statement: "s", effect: "grade_lowered", from: "A", to: bad }], "the grade it moved to on application 1 of the bias applications on basis leg 2", "the grade it moved to on application 1 of basis leg 2");
  }
  assert.deepEqual(shape(judgeValue(leg([{ statement: "s", effect: "grade_lowered" }]))),
    [["C-2.8", CODE, "the grade it started from on application 1 of basis leg 2"], ["C-2.8", CODE, "the grade it moved to on application 1 of basis leg 2"]]);
});

test("R18 from or to on leg_excluded or inference_refused is one error each naming it; absent, null or '' is no letter", () => {
  for (const effect of ["leg_excluded", "inference_refused"]) {
    oneBoth([{ statement: "s", effect, from: "B" }], "the grade it started from on application 1 of the bias applications on basis leg 2", "the grade it started from on application 1 of basis leg 2");
    oneBoth([{ statement: "s", effect, to: "C" }], "the grade it moved to on application 1 of the bias applications on basis leg 2", "the grade it moved to on application 1 of basis leg 2");
    assert.deepEqual(shape(judgeValue(leg([{ statement: "s", effect, from: "B", to: "C" }]))),
      [["C-2.8", CODE, "the grade it started from on application 1 of basis leg 2"], ["C-2.8", CODE, "the grade it moved to on application 1 of basis leg 2"]]);
    assert.deepEqual(judgeValue(leg([{ statement: "s", effect, from: null, to: "" }])), [], effect);
  }
});

test("R18 the encoding's own departures on a row: a bias_applied key, a number not written 1, 2, … plainly, a field outside the four, and numbers not contiguous from 1 are one error each; a bias_ key outside the encoding's form is not this arm's", () => {
  one({ ...FLAT, bias_applied: GOOD }, "the bias applications on basis leg 2");
  one({ target: INFO, bias_applied: "[s, leg_excluded]" }, "the bias applications on basis leg 2");
  assert.match(judgeValue({ bias_applied: GOOD })[0].message, /are not written the way the record holds them: each one is recorded beside the leg/);
  for (const k of ["bias_0_statement", "bias_01_statement", "bias_00_effect"]) {
    const x = one({ ...FLAT, [k]: "s" }, "a numbered entry on basis leg 2");
    assert.match(x.message, /its number is written as 1, 2, 3/);
  }
  for (const k of ["bias_1_reason", "bias_2_Statement", "bias_1_", "bias_3_statement_x"]) {
    const x = one({ ...FLAT, [k]: "s" }, "an entry on basis leg 2");
    assert.match(x.message, /which records statement, effect, from, to only$/);
  }
  /* a gap: one error naming the missing numbers, and the applications present still judged by their own numbers */
  const gap = { bias_1_statement: "a", bias_1_effect: "leg_excluded", bias_3_statement: "c", bias_3_effect: "leg_excluded",
                bias_5_statement: "", bias_5_effect: "leg_excluded" };
  const got = judgeValue(gap);
  assert.deepEqual(shape(got), [["C-2.8", CODE, "basis leg 2's bias applications"], ["C-2.8", CODE, "the statement on application 5 of basis leg 2"]]);
  assert.match(got[0].message, /numbered up to 5 with 2, 4 missing/);
  one({ bias_2_statement: "b", bias_2_effect: "leg_excluded" }, "basis leg 2's bias applications");
  /* not the encoding's: other bias_ keys (a conclusion row's bias_statements_sha), and keys with no number */
  for (const k of ["bias_statements_sha", "bias_note", "bias_x_statement", "biased", "bias__statement"])
    assert.deepEqual(judgeValue({ ...FLAT, [k]: "z" }), [], k);
});

test("R18 the caps: at most 32 applications, one error beyond; a statement applied with the same effect twice is one error naming the second, the same statement with another effect is not", () => {
  const many = (k) => Array.from({ length: k }, (_, j) => ({ statement: `s${j}`, effect: "leg_excluded" }));
  assert.deepEqual(judgeValue(many(32)), []);
  assert.deepEqual(judgeValue(leg(many(32))), []);
  for (const v of [many(33), leg(many(33)), many(40)]) {
    const x = one(v, "basis leg 2");
    assert.match(x.message, /carries (33|40) bias applications: at most 32/);
  }
  const twice = [GOOD[1], GOOD[2], { ...GOOD[1] }];
  oneBoth(twice, "application 3 of the bias applications on basis leg 2", "application 3 of basis leg 2");
  assert.match(judgeValue(leg(twice))[0].message, /applies the statement s2 as leg excluded a second time \(application 1 of basis leg 2 already does\)/);
  assert.deepEqual(judgeValue(leg([GOOD[1], { statement: "s2", effect: "inference_refused" }])), [], "another effect of the same statement");
  assert.deepEqual(judgeValue(leg([GOOD[1], { statement: "S2", effect: "leg_excluded" }])), [], "statements are compared as stated");
  oneBoth([{ statement: "s", effect: "grade_lowered", from: "A", to: "B" }, { statement: "s", effect: "grade_lowered", from: "C", to: "D" }],
    "application 2 of the bias applications on basis leg 2", "application 2 of basis leg 2");
});

test("R18 a list handed in (flattenBiasApplied's input) is judged as such: not a list, an item not an object, a field outside the four are one error each, the rest of the list still judged", () => {
  for (const v of ["funder-tilt", 5, true]) one(v, "the bias applications on basis leg 2");
  for (const item of ["s", 5, null, ["s", "leg_excluded"], true])
    assert.deepEqual(shape(judgeValue([GOOD[1], item, { statement: "", effect: "leg_excluded" }])),
      [["C-2.8", CODE, "application 2 of the bias applications on basis leg 2"], ["C-2.8", CODE, "the statement on application 3 of the bias applications on basis leg 2"]], JSON.stringify(item));
  one([{ statement: "s", effect: "leg_excluded", reason: "x" }], "application 1 of the bias applications on basis leg 2");
  assert.deepEqual(shape(judgeValue([{ statement: " ", effect: "grade_lowered", from: "C", to: "B", note: 1 }])), [
    ["C-2.8", CODE, "application 1 of the bias applications on basis leg 2"], ["C-2.8", CODE, "the statement on application 1 of the bias applications on basis leg 2"],
    ["C-2.8", CODE, "application 1 of the bias applications on basis leg 2"]]);
});

test("R18 in checkInquiryBasis: a leg carrying well-formed applications is judged exactly as the same leg without them, for every leg case of the corpus under every registry variant (it moves no grade, and every other finding is the catalogue's)", () => {
  const withBias = (legs) => legs.map((l) => (l && typeof l === "object" && !Array.isArray(l) ? { ...l, ...FLAT } : l));
  let legs = 0;
  for (const [name, cases] of Object.entries(LEG_CASES)) for (const v of VARIANTS) {
    const [pub, earned] = REGISTRY_VARIANTS[v];
    assert.deepEqual(plain(run((f) => checkInquiryBasis(legFm(name, withBias(cases)), f, pub, earned)).findings), GOLDEN.legs[name][v], `${name} (${v})`);
    legs += cases.length;
  }
  assert.ok(legs > 50);
  /* a grade_lowered whose letters disagree with the leg's own grade is not compared with it: the leg's grade is the member's */
  const graded = { target: INFO, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" };
  assert.deepEqual(ofLegs([{ ...graded, ...flattenBiasApplied([{ statement: "s", effect: "grade_lowered", from: "A", to: "D" }]) }], [INFO]), []);
  assert.deepEqual(ofLegs([graded], [INFO]), [], "the same leg without it");
  /* negative control: the earned rule still judges the leg's stated grade with applications beside it */
  assert.match(ofLegs([{ ...graded, grade: "A", ...FLAT }], [INFO])[0].message, /the record earns B/);
});

test("R18 in checkInquiryBasis a malformed application is one C-2.8 BIAS_APPLICATION_MALFORMED error per departure, naming basis[i] and the key, on every kind of leg (information, inquiry, standard, calculation, occurrence, derived connection, imported finding); a lead or a theme is refused first and alone", () => {
  const bad = { bias_1_statement: "", bias_1_effect: "scrutiny_raised" };
  const kinds = [[{ target: INFO, role: "supports" }, [INFO]], [{ target: INQ, role: "supports" }, [INQ]], [{ target: STD, role: "supports" }, [STD]],
                 [{ target: CALC, role: "supports" }, []], [{ target: OCC, role: "supports" }, []], [{ ...DER_LEG, role: "supports" }, []],
                 [{ target: REF, role: "supports", target_edition: 1 }, []]];
  for (const v of VARIANTS) {
    const [pub, earned] = REGISTRY_VARIANTS[v];
    for (const [l, refs] of kinds) {
      assert.deepEqual(ofLegs([{ target: INFO, role: "supports" }, { ...l, ...FLAT }], [INFO, ...refs], pub, earned), [], `${v} ${l.target}: clean`);
      const got = ofLegs([{ target: INFO, role: "supports" }, { ...l, ...bad }], [INFO, ...refs], pub, earned);
      assert.deepEqual(shape(got), [["C-2.8", CODE, "the statement on application 1 of basis leg 1"], ["C-2.8", CODE, "the effect on application 1 of basis leg 1"]], `${v} ${l.target}: ${JSON.stringify(got)}`);
      assert.ok(got.every((x) => x.check === INQUIRY_GRAMMAR_CHECKS[x.code].check));
    }
  }
  /* beside the leg's other departures: after role and note, before the extent */
  assert.deepEqual(shape(ofLegs([{ target: INFO, role: "maybe", note: 5, extent_kind: "dom", bias_applied: "s" }], [INFO])), [
    ["C-2.8", null, "the role of basis leg 0"], ["C-2.8", null, "the note on basis leg 0"], ["C-2.8", CODE, "the bias applications on basis leg 0"],
    ["C-2.8", "CONTENT_EXTENT_NO_PRODUCER", "basis leg 0"]]);
  assert.deepEqual(shape(ofLegs([{ target: CALC, role: "maybe", grade: "B", bias_1_statement: "s" }], [])), [
    ["C-2.8", "CALCULATION_LEG_MALFORMED", "the grade on basis leg 0"], ["C-2.8", null, "the role of basis leg 0"], ["C-2.8", CODE, "the effect on application 1 of basis leg 0"]]);
  /* a lead or a theme is refused by name before any other complaint, the applications included */
  assert.deepEqual(shape(ofLegs([{ target: "LEAD-2026-0101-abc", role: "supports", ...bad }], [])), [["C-54.1", "LEAD_NOT_EVIDENCE", "the target on basis leg 0"]]);
  assert.deepEqual(ofLegs([{ target: INFO, role: "supports", theme: "x", ...bad }], [INFO]).map((x) => x.check), ["C-81.1"]);
  /* negative control: the same keys at the document's top level are not a leg's, and are not judged here */
  assert.deepEqual(plain(run((f) => checkInquiryBasis({ object_type: "inquiry", references: [{ target: INFO }], basis: [{ target: INFO, role: "supports" }],
    ...bad, bias_applied: "s" }, f, PUBLISHED, EARNED)).findings), []);
});

test("R18 through this module's three slot arms (INQUIRY_GRAMMARS): a concluded inquiry whose legs carry applications has no finding; a malformed one answers exactly its code", () => {
  const doc = (basis) => ({ object_type: "inquiry", current_state: "concluded", conclusion: "it is", falsifier: "a ledger", surfaced_by: "human",
    recheck_triggers: [{ text: "x", description: "y", date: "2026-10-09" }], references: [{ target: INFO, rel: "cites", status: "confirmed" }], basis });
  const mine = (fm) => shape(plain(run((f) => { for (const g of INQUIRY_GRAMMARS) g.arm({ fm, publishedRegistry: PUBLISHED, earnedRegistry: EARNED }, f); }).findings));
  assert.deepEqual(mine(doc([leg(GOOD), { target: CALC, role: "cuts_against", ...flattenBiasApplied([GOOD[1]]) }])), []);
  assert.deepEqual(mine(doc([leg([{ statement: "s", effect: "grade_lowered", from: "D", to: "A" }])])), [["C-2.8", CODE, "application 1 of basis leg 0"]]);
});

test("R18 the shape at another grain: effects and checkId are the caller's (basis-versions R48's conclusion row: inference_refused, scrutiny_raised, beside its bias_statements_sha), the code and its row this module's", () => {
  const R48 = { effects: ["inference_refused", "scrutiny_raised"], checkId: "C-25.15" };
  const row = { conclusion: "it is", bias_statements_sha: "f".repeat(64),
    ...flattenBiasApplied([{ statement: "s", effect: "scrutiny_raised" }, { statement: "t", effect: "inference_refused" }]) };
  assert.deepEqual(judgeValue(row, "conclusion", R48), []);
  const got = judgeValue({ ...row, bias_3_statement: "u", bias_3_effect: "grade_lowered", bias_3_from: "A", bias_3_to: "B" }, "conclusion", R48);
  assert.deepEqual(shape(got), [["C-25.15", CODE, "the effect on application 3 of conclusion"]]);
  assert.match(got[0].message, /is not one of: inference refused, scrutiny raised$/);
  /* negative control: at a leg, with the defaults, scrutiny_raised is no effect */
  one(leg([{ statement: "s", effect: "scrutiny_raised" }]), "the effect on application 1 of basis leg 2");
  assert.deepEqual(judgeValue(leg([{ statement: "s", effect: "grade_lowered", from: "A", to: "B" }]), "basis leg 2", {}), [], "an empty options object is the defaults");
});

test("R18 the row: BIAS_APPLICATION_MALFORMED is {check: C-2.8, where, translation}, the where naming the one site that mints it, the translation member text naming no place", () => {
  const row = INQUIRY_GRAMMAR_CHECKS[CODE];
  assert.deepEqual(Object.keys(row), ["check", "where", "translation"]);
  assert.equal(row.check, "C-2.8");
  assert.equal(row.where, "src/inquiry-grammar/grammar.mjs biasApplicationRefusal > is-bias-application-form");
  assert.ok(row.translation.length > 80 && /Nothing was written\.$/.test(row.translation));
  assert.ok(!/\b(oakland|alameda|berkeley|california|san francisco|bay area|sacramento|los angeles|new york|port of)\b/i.test(row.translation));
  /* every finding the arm pushes carries this row's code and number */
  const xs = judgeValue({ bias_applied: [], bias_0_x: 1, bias_2_statement: 1, bias_2_effect: "x" });
  assert.equal(xs.length, 5);
  assert.ok(xs.every((x) => x.code === CODE && x.check === row.check && x.severity === "error"));
});

test("R18 R9 the arm is pure: it reads no record, lens, clock or network, changes nothing handed in, gives the same findings twice, and never throws", () => {
  const realNow = Date.now, realFetch = globalThis.fetch;
  Date.now = () => { throw new Error("the clock was read"); };
  globalThis.fetch = () => { throw new Error("the network was used"); };
  try {
    const freeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
    const fm = freeze({ object_type: "inquiry", references: [{ target: INFO }],
      basis: [leg([...GOOD, { statement: "", effect: "grade_lowered", from: "C", to: "C" }])] });
    const a = plain(run((f) => checkInquiryBasis(fm, f, null, null)).findings);
    assert.deepEqual(a, plain(run((f) => checkInquiryBasis(fm, f, null, null)).findings));
    assert.deepEqual(shape(a), [["C-2.8", CODE, "the statement on application 4 of basis leg 0"], ["C-2.8", CODE, "application 4 of basis leg 0"]]);
    const list = freeze(structuredClone(GOOD));
    assert.deepEqual(readBiasApplied(freeze(flattenBiasApplied(list))), GOOD);
    const hostile = Object.create(null); hostile.statement = "s"; hostile.effect = "leg_excluded";
    const weirds = [undefined, null, 0, "x", Symbol.iterator, () => 1, [Symbol.iterator], [{ statement: Symbol.iterator, effect: Symbol.iterator }],
      [{ statement: "s", effect: "grade_lowered", from: Symbol.iterator, to: { toString: () => "D" } }], [hostile], [() => 1],
      { bias_1_statement: Symbol.iterator, bias_1_effect: { toString: () => "x" }, bias_1_from: Symbol.iterator }, hostile,
      { bias_99999999999999999999_statement: "s" }, Object.assign(Object.create(null), { bias_1_statement: "s" })];
    for (const weird of weirds) {
      assert.doesNotThrow(() => biasAppliedFindings("x", weird, []), String(typeof weird));
      assert.doesNotThrow(() => flattenBiasApplied(weird));
      assert.doesNotThrow(() => readBiasApplied(weird));
    }
    assert.doesNotThrow(() => checkInquiryBasis({ object_type: "inquiry", basis: [{ target: INFO, role: "supports", bias_1_statement: Symbol.iterator }] }, [], null, null));
  } finally { Date.now = realNow; globalThis.fetch = realFetch; }
});
