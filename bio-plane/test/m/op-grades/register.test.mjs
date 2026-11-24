/* op-grades: the op declaration taken from its owner (R49, R50; K4168). The module is exercised through its exports over
   fixture owner rows, no real module. Each test loads fresh instances of the module, so a registration or a read in one
   never reaches the next; reading a table is what makes a registration late (R50), so the subject instance is never read
   before it registers, and `ref`, an untouched twin, is what the original rows are read from. The words are read from the
   word list (`word`), never typed. */
import test from "node:test";
import assert from "node:assert/strict";
import { hasWord, word, WORD_ROWS } from "../../../src/setup-words/index.mjs";
import { collectDeclaredOps, declaredSentence } from "./declared.mjs";

let n = 0;
const load = () => import(`../../../src/op-grades/index.mjs?instance=${n++}`);
const twins = async () => [await load(), await load()];

const KEY_A = WORD_ROWS[0][0];
const KEY_B = WORD_ROWS[1][0];
const MISSING_KEY = "op-grades.fixture.absent-key";
const SENTENCE = "a fixture sentence that no list holds";

const row = (weight, description, extra = {}) => ({
  classes: ["member"], mutating: weight !== "read", weight, description, fields: { accepts: [], requires: [] }, ...extra,
});

/** The four tables and the family list as plain data (this reads them). */
const state = (m) => JSON.parse(JSON.stringify({
  RUNGS: m.RUNGS, RUNG_ABSENT: m.RUNG_ABSENT, NON_ACTS: m.NON_ACTS, MACHINE_REFUSALS: m.MACHINE_REFUSALS, JUSTIFICATION_REFUSALS: m.JUSTIFICATION_REFUSALS,
}));
const added = (before, after) => Object.fromEntries(Object.keys(before).map((t) => [t,
  Array.isArray(before[t]) ? after[t].slice(before[t].length) : Object.keys(after[t]).filter((op) => !(op in before[t])).sort()]));
const refused = (code, op) => (e) => e.code === code && e.message.includes(op);

test("the fixture keys are real and distinct (the tests below read their words, they hold none)", () => {
  assert.ok(hasWord(KEY_A) && hasWord(KEY_B));
  assert.notEqual(word(KEY_A), word(KEY_B));
  assert.equal(hasWord(MISSING_KEY), false);
});

/* ---- R49 ----------------------------------------------------------------------------------------------------------- */
test("R49: an op with an owner row only is graded: a rung into RUNGS, a ground into RUNG_ABSENT, a read into NON_ACTS alone, "
   + "each with the description's words, and phoneOf answers as the grade says", async () => {
  const [m, ref] = await twins();
  const answer = m.registerDeclaredOps({
    "fixture-a": { fxrung: row("reversible", KEY_A), fxterminal: row("terminal", KEY_B) },
    "fixture-b": { fxground: row("credential", KEY_A), fxread: row("read", KEY_B), fxreasoned: row("reasoned", KEY_A, { refusal: "FIXTURE_NO_REASON" }) },
  });
  assert.deepEqual(answer.registered.sort(), ["fxground", "fxread", "fxreasoned", "fxrung", "fxterminal"]);
  assert.deepEqual(answer.agreed, []);

  assert.equal(m.RUNGS.fxrung, "reversible");
  assert.equal(m.NON_ACTS.fxrung, word(KEY_A));
  assert.equal(Object.hasOwn(m.RUNG_ABSENT, "fxrung"), false, "a rung is no absence");
  assert.equal(m.RUNGS.fxterminal, "terminal");
  assert.equal(m.NON_ACTS.fxterminal, word(KEY_B));

  assert.deepEqual(m.RUNG_ABSENT.fxground, { ground: "credential", is: word(KEY_A) });
  assert.equal(Object.hasOwn(m.RUNGS, "fxground"), false, "an absence is no rung");
  assert.equal(m.NON_ACTS.fxground, word(KEY_A));

  assert.equal(m.NON_ACTS.fxread, word(KEY_B));
  assert.equal(Object.hasOwn(m.RUNGS, "fxread"), false);
  assert.equal(Object.hasOwn(m.RUNG_ABSENT, "fxread"), false);

  assert.equal(m.RUNGS.fxreasoned, "reasoned");
  assert.ok(m.JUSTIFICATION_REFUSALS.includes("FIXTURE_NO_REASON"), "the owner's refusal backs the rung");

  assert.equal(m.phoneOf("fxrung"), true);
  assert.equal(m.phoneOf("fxterminal"), false, "terminal is a larger-screen rung (R18)");
  assert.equal(m.phoneOf("fxground"), false, "a credential ground is a larger-screen ground (R18)");
  assert.equal(m.phoneOf("fxread"), true);

  /* control: everything the tables held is as it was, and only the five ops (and the code) were added */
  const before = state(ref);
  const after = state(m);
  for (const [table, content] of Object.entries(before)) {
    if (Array.isArray(content)) assert.deepEqual(after[table].slice(0, content.length), content, table);
    else for (const [op, value] of Object.entries(content)) assert.deepEqual(after[table][op], value, `${table}.${op}`);
  }
  assert.deepEqual(added(before, after), {
    RUNGS: ["fxreasoned", "fxrung", "fxterminal"],
    RUNG_ABSENT: ["fxground"],
    NON_ACTS: ["fxground", "fxread", "fxreasoned", "fxrung", "fxterminal"],
    MACHINE_REFUSALS: [],
    JUSTIFICATION_REFUSALS: ["FIXTURE_NO_REASON"],
  });
});

test("R49: a description is a word key the list holds, or the sentence localize answered; a key the list lacks is refused", async () => {
  const [m] = await twins();
  m.registerDeclaredOps({ fixture: { bykey: row("reversible", KEY_A), bysentence: row("reversible", SENTENCE) } });
  assert.equal(m.NON_ACTS.bykey, word(KEY_A));
  assert.equal(m.NON_ACTS.bysentence, SENTENCE);

  const [m2, ref] = await twins();
  assert.throws(() => m2.registerDeclaredOps({ fixture: { fxok: row("reversible", KEY_A), fxlost: row("reversible", MISSING_KEY) } }),
    refused("DECLARED_OP_BAD_DESCRIPTION", "fxlost"));
  for (const bad of [undefined, "", 7]) {
    assert.throws(() => m2.registerDeclaredOps({ fixture: { fxnone: row("reversible", bad) } }), refused("DECLARED_OP_BAD_DESCRIPTION", "fxnone"));
  }
  assert.throws(() => m2.registerDeclaredOps({ fixture: { fxcapture: row("reversible", "capture-directed: a sentence that enrols a capture act") } }),
    refused("DECLARED_OP_BAD_DESCRIPTION", "fxcapture"));
  assert.deepEqual(state(m2), state(ref), "every call is refused whole: the good row is not added either");
});

test("R49: a weight the module cannot grade is refused naming the op, and nothing changes: irreversible, an unknown word, a "
   + "rung on a read, a read on a writing op, an absence on a read, none", async () => {
  const [m, ref] = await twins();
  const cases = [
    ["fxirreversible", row("irreversible", KEY_A)],
    ["fxunknown", row("heavy", KEY_A)],
    ["fxreadrung", row("reversible", KEY_A, { mutating: false })],
    ["fxwritesread", row("read", KEY_A, { mutating: true })],
    ["fxreadground", row("substrate", KEY_A, { mutating: false })],
    ["fxnoweight", { ...row("reversible", KEY_A), weight: undefined }],
  ];
  for (const [op, r] of cases) {
    assert.throws(() => m.registerDeclaredOps({ fixture: { [op]: r } }), refused("DECLARED_OP_BAD_WEIGHT", op), op);
  }
  assert.throws(() => m.registerDeclaredOps({ fixture: { fxrefusal: row("reversible", KEY_A, { refusal: "FIXTURE_NO_REASON" }) } }),
    refused("DECLARED_OP_BAD_REFUSAL", "fxrefusal"), "a refusal goes only with the rung reasoned");
  assert.throws(() => m.registerDeclaredOps({ fixture: { fxbadcode: row("reasoned", KEY_A, { refusal: "not a code" }) } }),
    refused("DECLARED_OP_BAD_REFUSAL", "fxbadcode"));
  assert.deepEqual(state(m), state(ref));
  /* control: a well-formed row of the same shape is accepted by an instance that has not been read */
  const [fresh] = await twins();
  fresh.registerDeclaredOps({ fixture: { fxfine: row("reversible", KEY_A), fxreasoned: row("reasoned", KEY_A) } });
  assert.equal(fresh.RUNGS.fxfine, "reversible");
  assert.equal(fresh.RUNGS.fxreasoned, "reasoned", "a reasoned row needs no refusal: the owner's code may already be a family member");
});

test("R49: MACHINE_REFUSALS, CONSEQUENCE_STATEMENTS and IRREVERSIBLE_WEIGHT take nothing from a row", async () => {
  const [m, ref] = await twins();
  m.registerDeclaredOps({ fixture: { fxone: row("terminal", KEY_A, { machineRefusal: "MACHINE_CANNOT_FIXTURE", consequence: "x" }) } });
  const plain = (x) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(plain(m.MACHINE_REFUSALS), plain(ref.MACHINE_REFUSALS));
  assert.deepEqual(plain(m.CONSEQUENCE_STATEMENTS), plain(ref.CONSEQUENCE_STATEMENTS));
  assert.deepEqual([...m.IRREVERSIBLE_WEIGHT], [...ref.IRREVERSIBLE_WEIGHT]);
  assert.deepEqual([...m.LARGER_SCREEN_ACTS], [...ref.LARGER_SCREEN_ACTS]);
});

test("R49: the owners are an object from module id to rows or a list of [module id, rows] pairs, and the row's other keys "
   + "(op-declarations' stamps, needs, classes, fields) are ignored", async () => {
  const [m, byObject] = await twins();
  const rows = { fxpair: row("reversible", KEY_A, { stamps: ["by"], needs: { a: 1 }, machineClasses: ["ai"] }) };
  m.registerDeclaredOps([["fixture", rows]]);
  byObject.registerDeclaredOps({ fixture: rows });
  assert.equal(m.RUNGS.fxpair, "reversible");
  assert.deepEqual(state(m), state(byObject), "the two input shapes register alike");
  const [dup] = await twins();
  assert.throws(() => dup.registerDeclaredOps([["fixture-a", rows], ["fixture-b", rows]]), refused("DECLARED_OP_DUPLICATE", "fxpair"));
});

test("R49: with no registration two instances hold the same tables, and an empty registration changes nothing", async () => {
  const [one, two] = await twins();
  assert.deepEqual(one.registerDeclaredOps({}), { registered: [], agreed: [] });
  assert.deepEqual(state(one), state(two));
});

/* ---- R50 ----------------------------------------------------------------------------------------------------------- */
test("R50: an owner row that disagrees with a hand row in weight is refused naming the op, for a rung, a ground and a read", async () => {
  const [, ref] = await twins();
  assert.equal(ref.RUNGS.cite, "reversible");
  assert.equal(ref.RUNG_ABSENT.monitor.ground, "observational");
  assert.equal(Object.hasOwn(ref.NON_ACTS, "holdsdue") && !Object.hasOwn(ref.RUNGS, "holdsdue") && !Object.hasOwn(ref.RUNG_ABSENT, "holdsdue"), true);
  for (const [op, wrong, hand] of [["cite", "reasoned", ref.NON_ACTS.cite], ["monitor", "substrate", ref.NON_ACTS.monitor], ["holdsdue", "reversible", ref.NON_ACTS.holdsdue]]) {
    const [m, twin] = await twins();
    /* the description is the hand one, so the weight is all that disagrees */
    assert.throws(() => m.registerDeclaredOps({ fixture: { [op]: row(wrong, hand ?? SENTENCE) } }), refused("DECLARED_OP_DISAGREES", op), op);
    assert.deepEqual(state(m), state(twin), `${op}: nothing changed`);
  }
});

test("R50: an owner row that disagrees with a hand row in description is refused naming the op; the hand row's own words are "
   + "accepted and change nothing; an op with no hand description has none to compare", async () => {
  const [m, ref] = await twins();
  assert.throws(() => m.registerDeclaredOps({ fixture: { monitor: row("observational", SENTENCE) } }), refused("DECLARED_OP_DISAGREES", "monitor"));
  assert.throws(() => m.registerDeclaredOps({ fixture: { holdsdue: row("read", SENTENCE) } }), refused("DECLARED_OP_DISAGREES", "holdsdue"));
  assert.deepEqual(state(m), state(ref));

  const [m2, ref2] = await twins();
  const ok = m2.registerDeclaredOps({ fixture: {
    monitor: row("observational", ref2.NON_ACTS.monitor), holdsdue: row("read", ref2.NON_ACTS.holdsdue), cite: row("reversible", SENTENCE),
  } });
  assert.deepEqual(ok.registered, [], "every op had a hand row, which stands (K4168)");
  assert.deepEqual(ok.agreed.sort(), ["cite", "holdsdue", "monitor"]);
  assert.deepEqual(state(m2), state(ref2), "an agreeing row changes nothing");
});

test("R50: an op in the rows of two modules is refused naming it and both modules, and the call adds none of its other ops", async () => {
  const [m, ref] = await twins();
  assert.throws(() => m.registerDeclaredOps({
    "fixture-a": { fxuniq: row("reversible", KEY_A), fxtwice: row("reversible", KEY_A) },
    "fixture-b": { fxtwice: row("reversible", KEY_A) },
  }), (e) => e.code === "DECLARED_OP_DUPLICATE" && e.message.includes("fxtwice") && e.message.includes("fixture-a") && e.message.includes("fixture-b"));
  assert.deepEqual(state(m), state(ref));
  const [fresh] = await twins();
  fresh.registerDeclaredOps({ "fixture-a": { fxuniq: row("reversible", KEY_A) } });
  assert.equal(fresh.RUNGS.fxuniq, "reversible", "control: the same rows register once the duplicate is gone");
});

test("R50: a registration after a read of any of the four tables or of phoneOf, or after a registration, is refused naming the op", async () => {
  const reads = {
    RUNGS: (m) => m.RUNGS.cite,
    RUNG_ABSENT: (m) => Object.hasOwn(m.RUNG_ABSENT, "monitor"),
    NON_ACTS: (m) => Object.keys(m.NON_ACTS).length,
    MACHINE_REFUSALS: (m) => "release" in m.MACHINE_REFUSALS,
    phoneOf: (m) => m.phoneOf("cite"),
  };
  for (const [name, read] of Object.entries(reads)) {
    const [m] = await twins();
    read(m);
    assert.throws(() => m.registerDeclaredOps({ fixture: { fxlate: row("reversible", KEY_A) } }), refused("DECLARED_OPS_LATE", "fxlate"), name);
    assert.equal(Object.hasOwn(m.RUNGS, "fxlate"), false, `${name}: nothing was added`);
  }
  const [m] = await twins();
  m.registerDeclaredOps({ fixture: { fxfirst: row("reversible", KEY_A) } });
  assert.throws(() => m.registerDeclaredOps({ fixture: { fxsecond: row("reversible", KEY_A) } }), refused("DECLARED_OPS_LATE", "fxsecond"));
  assert.equal(Object.hasOwn(m.RUNGS, "fxsecond"), false);
  /* control: importing the module and handing it the rows before any read is the order that works */
  const [fresh] = await twins();
  assert.doesNotThrow(() => fresh.registerDeclaredOps({ fixture: { fxok: row("reversible", KEY_A) } }));
  /* the exports other than the four tables and phoneOf are no read */
  const [other] = await twins();
  void other.RUNG_LADDER; void other.JUSTIFICATION_REFUSALS; void other.CONSEQUENCE_STATEMENTS; void other.IRREVERSIBLE_WEIGHT;
  assert.doesNotThrow(() => other.registerDeclaredOps({ fixture: { fxok: row("reversible", KEY_A) } }));
});

test("R50: a refused registration leaves the module open, so the corrected rows are then accepted", async () => {
  const [m] = await twins();
  assert.throws(() => m.registerDeclaredOps({ fixture: { fxbad: row("heavy", KEY_A) } }), refused("DECLARED_OP_BAD_WEIGHT", "fxbad"));
  assert.doesNotThrow(() => m.registerDeclaredOps({ fixture: { fxbad: row("reversible", KEY_A) } }));
  assert.equal(m.RUNGS.fxbad, "reversible");
});

/** Every owner's rows registered on a fresh instance, as `{ m, owed }`. An owner's own row the module cannot grade (a
    write-less op weighed as an act, `rung-on-read`) is that owner's to correct and is reported to BOB; the op is set aside
    so the rest are still checked against their hand rows. A disagreement is never set aside (R50). */
const registerOwners = async (ops, owners) => {
  const byOwner = {};
  for (const [op, d] of Object.entries(ops)) (byOwner[owners[op]] ??= {})[op] = d;
  const owed = [];
  for (let i = 0; i <= Object.keys(ops).length; i++) {
    const m = await load();
    try { m.registerDeclaredOps(byOwner); return { m, owed }; } catch (e) {
      assert.notEqual(e.code, "DECLARED_OP_DISAGREES", e.message);
      assert.equal(e.code, "DECLARED_OP_BAD_WEIGHT", e.message);
      assert.ok(e.message.includes("rung-on-read"), e.message);
      assert.ok(e.op, e.message);
      owed.push(e.op);
      delete byOwner[owners[e.op]][e.op];
    }
  }
  throw new Error("registerOwners: no registration of the owners' rows was accepted");
};

test("R50 (B21): registering every owner's DECLARED_OPS meets no DECLARED_OP_DISAGREES and no DECLARED_OP_DUPLICATE; a hand row follows its owner's declaration (K4168)", async () => {
  const { ops, owners, duplicates } = await collectDeclaredOps(new URL("../../../../", import.meta.url).pathname);
  assert.deepEqual(duplicates, []);
  const { owed } = await registerOwners(ops, owners);
  assert.deepEqual(owed, [], "no owner row is set aside: link-sweep and store-door have merged (K4252)");
});

/* ---- R51 ----------------------------------------------------------------------------------------------------------- */
/** A text as the owner declared it: a word key the list holds, or the sentence itself (R49's rule, read here). */
const sentenceOf = (text) => (hasWord(text) ? word(text) : text);

test("R51 (K4247): a declared op's NON_ACTS reason is its owner's word: after the owners register, each such reason equals the "
   + "owner's declared description; control: a read whose hand reason differs from its owner's is refused, and the owner's "
   + "own word is accepted", async () => {
  /* The absences' `is` (RUNG_ABSENT) are not yet compared here: they disagree with their owners on 108 ops, open to BOB (K4247). */
  const { ops, owners } = await collectDeclaredOps(new URL("../../../../", import.meta.url).pathname);
  const { m, owed } = await registerOwners(ops, owners);
  const compared = [];
  for (const [op, d] of Object.entries(ops)) {
    if (owed.includes(op) || !Object.hasOwn(m.NON_ACTS, op)) continue;
    assert.equal(m.NON_ACTS[op], sentenceOf(d.description), op);
    compared.push(op);
  }
  assert.ok(compared.length > 0, "some declared op's reason was compared");
  /* control: a reason that differs from the owner's is refused naming the op; the owner's own word is accepted. Each
     instance is registered before any of its tables is read (R50), so the reads are of the untouched twin. */
  const [refuse, twin, accept] = [await load(), await load(), await load()];
  const word_of_owner = declaredSentence("store-door", "groupdescriptiondraft");
  assert.throws(() => refuse.registerDeclaredOps({ "store-door": { groupdescriptiondraft: row("read", SENTENCE) } }),
    refused("DECLARED_OP_DISAGREES", "groupdescriptiondraft"));
  assert.deepEqual(state(refuse), state(twin), "nothing changed");
  const ok = accept.registerDeclaredOps({ "store-door": { groupdescriptiondraft: row("read", word_of_owner) } });
  assert.deepEqual(ok.agreed, ["groupdescriptiondraft"]);
  assert.equal(accept.NON_ACTS.groupdescriptiondraft, word_of_owner);
});
