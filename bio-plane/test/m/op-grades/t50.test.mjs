/* op-grades: T50's grades (R45, R47) and the re-taken `MARKS` (R46), at the module's exports. Each of the fifteen ops T50's
   owners add is named here as its own, with a negative control (K874); the four acts DEC-300 (5) weighs Reversible are
   graded here too. R46 reads the design's kit as a file, at the commit the marks name, as t48 does. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT, OP_ALIASES, phoneOf,
         MARKS, MARK_SOURCES } from "../../../src/op-grades/index.mjs";
import { MARKS_KIT_COMMIT } from "../../../src/op-grades/marks.mjs";
import * as T50 from "../../../src/op-grades/t50.mjs";
import { reqText, between, ticked, registeredOpGrades } from "./declared.mjs";

const root = (p) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const gradeOf = (op) => (Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null);

/* the fifteen ops R45 grades: the five reversible acts, the one undetermined act, and the nine reads */
const R45 = reqText(45);
const REVERSIBLE = ticked(between(R45, "`RUNGS` assigns `reversible`", "`RUNG_ABSENT` holds")).filter((op) => T50.T50_RUNGS[op] === "reversible");
const WRITES = [...REVERSIBLE, ...ticked(between(R45, "`RUNG_ABSENT` holds", "R3's tally")).filter((op) => Object.hasOwn(T50.T50_RUNG_ABSENT, op))];
const READS = ticked(between(R45, "naming what it reads:", "Each of the six")).filter((op) => Object.hasOwn(T50.T50_NON_ACTS, op)
  && T50.T50_NON_ACTS[op].startsWith("read: "));
const FIFTEEN = [...WRITES, ...READS];

/* the four acts DEC-300 (5) weighs Reversible, R47 */
const FOUR = ["notewrite", "membertie", "planopen", "wizarddraft"];

/* the `undetermined` count R3 reads, DEC-88's 21 less the two R47 moves and R35's, plus R45's actioninquiry: 19 + 4 + 1 */
const undetermined = () => Object.keys(RUNG_ABSENT).filter((op) => RUNG_ABSENT[op].ground === "undetermined");

test("R45: each of the fifteen ops has one grade (a writing op) or one read row, and each writing op one directed row; "
   + "watchitem, secondlook, secondlookclear, projectstakeset, actionstake and actioninquiry are the six writes, "
   + "lookedat, browse, opencaptures, capturegrade, inquirypartition, instances, projectstake, projectownersgone and "
   + "stakeatpreparation the nine reads", () => {
  for (const op of REVERSIBLE) assert.equal(RUNGS[op], "reversible", op);
  assert.equal(RUNG_ABSENT.actioninquiry.ground, "undetermined");
  for (const op of FIFTEEN) assert.equal(Object.hasOwn(T50.T50_RUNGS, op) || Object.hasOwn(T50.T50_RUNG_ABSENT, op) ? 1 : 0,
    WRITES.includes(op) ? 1 : 0, `${op}: a writing op is graded here, a read is not`);
  for (const op of WRITES) assert.match(NON_ACTS[op], /-directed: /, op);
  for (const op of READS) assert.match(NON_ACTS[op], /^read: /, op);
  /* each op has exactly one row, and the rows sit in the module's tables */
  for (const op of FIFTEEN) assert.ok(NON_ACTS[op] !== undefined, op);
  for (const op of FIFTEEN) assert.equal(Object.hasOwn(T50.T50_NON_ACTS, op), true, `${op}: its reason is in t50.mjs`);
  /* R45's last clause: none is an ACTS row (no machine refusal) and none takes a statement or the Irreversible weight */
  for (const op of FIFTEEN) {
    assert.ok(!Object.hasOwn(MACHINE_REFUSALS, op), `${op} names no machine refusal`);
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
  }
  /* controls: a writing op in both tables, or a read with a grade, is seen */
  const both = Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op));
  assert.deepEqual(both, []);
  assert.ok(!Object.hasOwn(RUNGS, "lookedat") && !Object.hasOwn(RUNG_ABSENT, "lookedat"), "a read is not graded");
  assert.notEqual(gradeOf("browse"), "reversible");
});

test("R45: the five reversible rows are reversible and each is phone-true (R3's rule, as declaredstakeset); the undetermined "
   + "row actioninquiry is phone-true; none is a Reasoned act (watchitem, secondlook, secondlookclear, projectstakeset, "
   + "actionstake, actioninquiry)", () => {
  for (const op of WRITES) assert.equal(phoneOf(op), true, op);
  for (const op of READS) assert.equal(phoneOf(op), true, op);
  for (const op of WRITES) assert.notEqual(gradeOf(op), "reasoned", op);
  /* control: a reversible row is not a rung the design would weigh above Reversible (the kit's 1 for projectstakeset and actionstake) */
  assert.equal(gradeOf("projectstakeset"), "reversible");
  assert.equal(gradeOf("actionstake"), "reversible");
});

test("R45 R3: the `undetermined` tally rises by one for actioninquiry, and R47's two moves are counted in it; the new "
   + "undetermined op is the one T50 adds", () => {
  assert.ok(undetermined().includes("actioninquiry"));
  assert.equal(undetermined().filter((op) => op === "actioninquiry").length, 1);
  assert.ok(!undetermined().includes("planopen") && !undetermined().includes("wizarddraft"), "R47's two left the ground");
  assert.equal(undetermined().length, 109, "R3's tally after T50: 110 before, less planopen and wizarddraft, plus actioninquiry");
});

test("R46: MARKS_KIT_COMMIT is the design commit the tree holds, and MARKS holds the kit's weight for every rungless "
   + "registered act at that commit; the five R45 grades and actioninquiry hold no mark", () => {
  assert.equal(MARKS_KIT_COMMIT, "0310c4953d");
  for (const op of [...REVERSIBLE, "actioninquiry", "planopen", "wizarddraft", "membertie", "declaretie"])
    assert.ok(!Object.hasOwn(MARKS, op), `${op} is graded, so it takes no mark`);
  /* K4206: DEC-386's owed act, a rungless act of the registry at this commit, the kit's weight 2 (Reasoned); its row is the one
     the previous table lacked, so without it the totality below names it */
  assert.equal(MARKS.expertisewithdraw, "Reasoned", "expertisewithdraw: the kit's 2, DEC-386");
  assert.equal(MARK_SOURCES.expertisewithdraw, `mock-kit.js WEIGHT at ${MARKS_KIT_COMMIT}`, "its source is the kit, not a ruling");
  /* controls: a graded op left in MARKS is seen; an op the kit does not name is Reasoned, not absent */
  assert.notDeepEqual(Object.keys({ ...MARKS, watchitem: "Reasoned" }).sort(), Object.keys(MARKS).sort());
  assert.equal(MARKS.claim, "Signed");
  assert.equal(MARKS.projectrequest, "Reversible", "projectrequest is credential-graded and rungless: the kit weighs it 1");
  assert.equal(MARKS.projectrequestanswer, "Reasoned", "the kit's 2 for the owner's answer");
  assert.equal(MARKS.installupdate, "Reversible", "owed by the install and update: the kit's 1");
});

test("R46: MARKS equals the kit's WEIGHT at that commit for every rungless registered act, except notewrite, whose weight DEC-300 "
   + "(5) sets (its source names the ruling); no registered act lacks an entry", () => {
  const KIT = readFileSync(root("docs/development/ux-substrate/screens/mock-kit.js"), "utf8");
  const KIT_WEIGHT = Object.fromEntries([...KIT.match(/const WEIGHT = \{([\s\S]*?)\n\};/)[1].matchAll(/([A-Za-z_0-9]+):(\d)/g)]
    .map(([, k, v]) => [k, Number(v)]));
  const WNAME = ["", "Reversible", "Reasoned", "Terminal", "Signed", "Irreversible"];
  for (const op of Object.keys(MARKS)) {
    if (op === "notewrite" || MARK_SOURCES[op].startsWith("K4259, a ruling")) continue;
    const w = KIT_WEIGHT[op] ?? KIT_WEIGHT[`owed_${op}`];
    assert.equal(MARKS[op], WNAME[w ?? 2], op);
  }
  /* fix round 2, C76: a read carries no mark above Reversible, so `bootstrap` ("Show what each part runs", which the kit weighs
     Irreversible) and the eight other reads whose kit weight said more take the read's mark by the same ruling */
  const byRuling = Object.keys(MARKS).filter((op) => MARK_SOURCES[op].startsWith("K4259, a ruling"));
  assert.ok(byRuling.length >= 10 && byRuling.every((op) => MARKS[op] === "Reversible"), "every op the read ruling sets is Reversible");
  assert.ok(KIT_WEIGHT.bootstrap > 1 && MARKS.bootstrap === "Reversible" && byRuling.includes("bootstrap"), "bootstrap: the kit's weight over-ruled for a read");
  /* control: an act (not a read) keeps the kit's weight above Reversible */
  assert.equal(MARKS.memberadd, "Reasoned");
  assert.equal(MARKS.claim, "Signed");
  /* versionnotice is a read (op-declarations, mutating false) and asks no reason: its mark is a read's, by a ruling (K4259) */
  assert.equal(MARKS.versionnotice, "Reversible");
  assert.equal(KIT_WEIGHT.versionnotice, undefined, "the kit does not name versionnotice: the ruling sets it");
  assert.match(MARK_SOURCES.versionnotice, /^K4259, a ruling/);
  assert.equal(MARKS.notewrite, "Reversible");
  assert.match(MARK_SOURCES.notewrite, /^DEC-300 \(5\)/);
  assert.equal(KIT_WEIGHT.notewrite, undefined, "the kit names no notewrite: the ruling sets it");
  /* control: a notewrite weight that the kit named would still be the ruling's source, so the exception is only notewrite's */
  assert.ok(Object.keys(MARKS).filter((op) => op !== "notewrite").every((op) => !MARK_SOURCES[op].startsWith("DEC-300")));
});

test("R46: every rungless registered act has an entry, and the registry's watchitem, secondlook, secondlookclear, "
   + "projectstakeset, actionstake and actioninquiry hold no mark", async () => {
  const REGISTRY = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
  const nameOf = (a) => (a.startsWith("owed:") ? a.slice(5).split(" ")[0] : a);
  const ops = [...new Set(REGISTRY.screens.flatMap((s) => s.acts.map((a) => nameOf(a.op))))];
  /* rungless over the registered tables (R49): an op its owner grades (strengthbarset, reasoned) needs no mark of its own */
  const reg = await registeredOpGrades();
  const rungless = ops.filter((op) => !Object.hasOwn(reg.RUNGS, op) && !(Object.hasOwn(reg.RUNG_ABSENT, op)
    && reg.RUNG_ABSENT[op].ground === "undetermined"));
  for (const op of rungless) assert.ok(Object.hasOwn(MARKS, op), `${op} is rungless and has no mark`);
  /* control: the table without `login` leaves exactly that act unmarked, so the check names it. (K4206's control named
     expertisewithdraw; its owner grades it once registered, B27, so it is no longer rungless here.) */
  const { login: _marked, ...WITHOUT_LOGIN } = MARKS;
  assert.deepEqual(rungless.filter((op) => !Object.hasOwn(WITHOUT_LOGIN, op)), ["login"]);
  /* the writes T50 grades hold no mark: the five reversible ones have a rung, actioninquiry is undetermined */
  for (const op of WRITES) assert.ok(!Object.hasOwn(MARKS, op), op);
});

test("R47: planopen and wizarddraft leave the `undetermined` ground for `reversible`, and membertie (alias declaretie) is "
   + "reversible in place of reasoned; notewrite stays caller-owned and weighs Reversible; each answers phoneOf true", () => {
  assert.equal(RUNGS.planopen, "reversible");
  assert.equal(RUNGS.wizarddraft, "reversible");
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "planopen") && !Object.hasOwn(RUNG_ABSENT, "wizarddraft"));
  assert.equal(RUNGS.membertie, "reversible");
  assert.equal(OP_ALIASES.declaretie, "membertie");
  assert.equal(RUNGS.declaretie, "reversible", "the alias takes the grade (R17)");
  assert.equal(RUNG_ABSENT.notewrite.ground, "caller-owned");
  for (const op of FOUR) assert.equal(phoneOf(op), true, op);
  assert.equal(phoneOf("declaretie"), true);
  /* the four and their MARKS: notewrite's is Reversible; the three rung ops take no mark */
  assert.equal(MARKS.notewrite, "Reversible");
  for (const op of ["planopen", "wizarddraft", "membertie"]) assert.ok(!Object.hasOwn(MARKS, op), op);
  /* controls: wizardrevise and planclose keep their grades; membertiewithdraw stays reasoned */
  assert.equal(RUNG_ABSENT.wizardrevise.ground, "undetermined");
  assert.equal(RUNGS.planclose, "reasoned");
  assert.equal(RUNGS.membertiewithdraw, "reasoned");
  assert.notEqual(RUNGS.planopen, "reasoned", "a control: planopen is not reasoned");
});
