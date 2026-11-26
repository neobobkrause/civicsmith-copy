/* record-grammar at its interface: the one accepting act's record (R52; T41-1, N820; D3). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { ACCEPTANCE_FORMS, ACCEPT_MUST_REAUTHOR, acceptanceRecord, isMachineIdentity, NON_MEMBER_AUTHORS, ACTOR_CLASSES,
  SHARED_ACT_CHECKS }
  from "../../../src/record-grammar/index.mjs";

const OK = { proposal: "STP-2026-a1b2c3d4e5f6g7h8", form: "edited", by: "alice", at: "2026-10-09T18:00:00Z", kind: "step" };

test("R52 ACCEPTANCE_FORMS is exactly [as_proposed, edited, own_instead], frozen", () => {
  assert.deepEqual([...ACCEPTANCE_FORMS], ["as_proposed", "edited", "own_instead"]);
  assert.ok(Object.isFrozen(ACCEPTANCE_FORMS));
  assert.throws(() => { "use strict"; /** @type {any} */ (ACCEPTANCE_FORMS).push("x"); }, TypeError);
  assert.equal(ACCEPTANCE_FORMS.length, 3);
});

test("R52 ACCEPT_MUST_REAUTHOR is the one spelling of the code an act's owner refuses as_proposed with, answered with the one shared row C-33.54 (K231, K2426)", () => {
  assert.equal(ACCEPT_MUST_REAUTHOR, "ACCEPT_MUST_REAUTHOR");
  const row = SHARED_ACT_CHECKS[ACCEPT_MUST_REAUTHOR];
  assert.ok(Object.isFrozen(SHARED_ACT_CHECKS) && row, "the row exists, keyed by the code");
  assert.deepEqual(Object.keys(row), ["check", "where", "translation"]);
  assert.equal(row.check, "C-33.54");
  /* Its translation states the meaning: accepting would make you vouch for what the machine proposed, so write it in
     your own words instead. */
  assert.equal(row.translation, word("refusal.ACCEPT_MUST_REAUTHOR"));
  /* The owners are named in its where, and no other shared row holds its number or its code. */
  for (const owner of ["steps R24", "hypotheses R17", "run-productions R22", "question-explorer R6", "investigation R12",
    "case-account R4"]) assert.ok(row.where.includes(owner), owner);
  const others = Object.entries(SHARED_ACT_CHECKS).filter(([k]) => k !== ACCEPT_MUST_REAUTHOR);
  assert.ok(others.every(([, r]) => r.check !== "C-33.54"));
  /* Control: the other rows keep their own numbers. */
  assert.deepEqual(others.map(([k, r]) => [k, r.check]), [["NO_BASIS", "C-33.40"], ["NO_CITATION", "C-33.41"]]);
});

test("R52 acceptanceRecord: the one shape {proposal, form, by, at, kind}, frozen, for every form and any kind; extra keys dropped", () => {
  for (const form of ACCEPTANCE_FORMS)
    for (const kind of ["step", "hypothesis", "passage", "connection", "question", "find", "account"]) {
      const input = { ...OK, form, kind, extra: 1, viewer: "x" };
      const r = acceptanceRecord(input);
      assert.deepEqual(r, { ...OK, form, kind });
      assert.deepEqual(Object.keys(r), ["proposal", "form", "by", "at", "kind"]);
      assert.ok(Object.isFrozen(r));
    }
  /* The same input gives the same record (R24), and the input is not changed. */
  const input = { ...OK };
  assert.deepEqual(acceptanceRecord(input), acceptanceRecord(input));
  assert.deepEqual(input, OK);
});

test("R52 acceptanceRecord refuses, naming the field, anything that is not an acceptance (negative controls)", () => {
  /** @param {{[key: string]: unknown}} over @param {string} field */
  const refused = (over, field) =>
    assert.throws(() => acceptanceRecord({ ...OK, ...over }), (/** @type {unknown} */ e) => e instanceof TypeError && e.message.includes(field),
      `${field} ${JSON.stringify(over)}`);
  for (const proposal of [undefined, null, "", "  ", 1, {}, ["p"]]) refused({ proposal }, "proposal");
  for (const form of [undefined, null, "", "As_Proposed", "accepted", "rejected", "own", "constructor", "toString", 0, ["edited"]])
    refused({ form }, "form");
  /* Accepting is a member's act: blank or any machine identity is refused (R15). */
  const machines = ["token:assistant", "class:daemon", " TOKEN:x ", ...NON_MEMBER_AUTHORS, ...ACTOR_CLASSES];
  for (const by of machines) assert.ok(isMachineIdentity(by), by);
  for (const by of [undefined, null, "", "   ", 7, ...machines]) refused({ by }, "by");
  for (const at of [undefined, null, "", "2026-10-09", "2026-10-09T18:00:00.000Z", "2026-10-09T18:00:00+00:00", 1780000000000,
    "2026-10-09T18:00:00Z\n"]) refused({ at }, "at");
  for (const kind of [undefined, null, "", " ", 3, {}]) refused({ kind }, "kind");
  for (const bad of [undefined, null, "x", 1, []]) assert.throws(() => acceptanceRecord(bad), TypeError);
  /* Control: the same record with each field put right lands. */
  assert.deepEqual(acceptanceRecord(OK), OK);
});

/* T42 (R55; N839, K2608): the account drafts move from case-authoring to case-account at L8, so the shared row names
   case-account R4 in place of case-authoring R64. */
test("R55 ACCEPT_MUST_REAUTHOR's where names case-account R4 in place of case-authoring R64, the other owners unchanged", () => {
  const w = SHARED_ACT_CHECKS[ACCEPT_MUST_REAUTHOR].where;
  assert.match(w, /\bcase-account R4\b/);
  assert.doesNotMatch(w, /case-authoring/, "negative control: the old owner is gone");
  assert.equal(w, "raised by the owner of each accepting act that would make a member vouch for a legal or authored statement "
    + "(steps R24, hypotheses R17, run-productions R22, question-explorer R6, investigation R12 and R20, case-account R4), "
    + "from this shared row (record-grammar R52)");
  assert.equal(SHARED_ACT_CHECKS[ACCEPT_MUST_REAUTHOR].check, "C-33.54");
});
