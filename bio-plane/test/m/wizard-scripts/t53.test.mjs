/* wizard-scripts at T53: the requirements file consolidated under the cap (its non-requirement text moved to
   `docs/requirements-notes/wizard-scripts.md`), and the provider notices of `run-rules` PR 72 (R19, R29, R30, R36, R37)
   and `membership` PR 77 (R154), each confirmed at this module's interface over the providers' real code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seeded, approved, V } from "./fixture.mjs";
import * as wz from "../../../src/wizard-scripts/index.mjs";
import { untestedLabel, TEST_BAR_PARTS, gatePartOf } from "../../../src/run-rules/index.mjs";

const F = V("frank"), E = V("erin");
const REQ = new URL("../../../../build/requirements/wizard-scripts.md", import.meta.url);
const NOTES = new URL("../../../../docs/requirements-notes/wizard-scripts.md", import.meta.url);

/* The requirement ids, in file order, and the unmet marks of build/requirements/wizard-scripts.md at the job's start
   commit (811e4ebf), before the move. */
const IDS_AT_START = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13", "R29", "R30", "R31",
  "R32", "R33", "R34", "R14", "R15", "R16", "R21", "R22", "R23", "R28", "R26", "R24", "R25", "R27", "R17", "R35", "R36",
  "R37", "R38", "R39", "R40", "R41", "R42", "R43", "R44", "R45", "R46", "R47", "R48", "R51", "R52", "R53", "R18", "R19",
  "R20", "R49", "R50"];
const UNMET_AT_START = [];
/* BOB's ruling (a), 4 Nov 2026: this job re-takes the registry at the tranche's design commit and states it as R54, after R53. */
/* Attempt 3 (store-assembly PR 242, interface-shell PR 172): F1, this module's own found mark on ADMIN_ACTS, after R54. */
/* Attempt 6 (the coordinator's ruling 17:24 on screens-ai): F2, the registry's added acts, after F1. */
const IDS_NOW = [...IDS_AT_START.slice(0, IDS_AT_START.indexOf("R53") + 1), "R54", "F1", "F2", ...IDS_AT_START.slice(IDS_AT_START.indexOf("R53") + 1)];

const idsOf = (text) => [...text.matchAll(/^\s*- \*\*([RF]\d+)\*\*/gm)].map((m) => m[1]);
const unmetOf = (text) => text.split("\n").filter((l) => /^\s*- \*\*[RF]\d+\*\*/.test(l))
  .flatMap((l) => [...l.matchAll(/\*\(not yet met: [^)]*\)\*/g)].map((m) => `${/\*\*([RF]\d+)\*\*/.exec(l)[1]} ${m[0]}`));

test("T53 consolidation: the requirement ids and unmet marks of build/requirements/wizard-scripts.md are those of the start commit, in order, and the file is under the 70000-byte cap; the moved text is in the notes file", () => {
  const text = readFileSync(REQ, "utf8");
  assert.deepEqual(idsOf(text), IDS_NOW, "every R and F id kept, none lost, order unchanged; only R54 (BOB's ruling (a)), F1 (attempt 3) and F2 (attempt 6) added");
  assert.deepEqual(unmetOf(text), UNMET_AT_START, "the unmet marks unchanged by the move");
  assert.ok(Buffer.byteLength(text) < 70000, `under the cap: ${Buffer.byteLength(text)} bytes`);
  const notes = readFileSync(NOTES, "utf8");
  for (const h of ["## Status history", "## Settled readings", "## Satisfies", "## Suggestions"]) assert.ok(notes.includes(h), h);
  assert.deepEqual(idsOf(notes), [], "the notes hold no requirement line");
  /* control: an id dropped from the file is seen */
  assert.notDeepEqual(idsOf(text.replace(/^- \*\*R52\*\*/m, "- R52")), IDS_NOW);
});

const ON = { on: true, account: { kind: "own", level: "member" } };
const TEST_ENV = Object.freeze({ CIVICSMITH_TEST_INSTANCE: "biotest1", INSTANCE_NAME: "biotest1" });
const ask = (w, x = {}) => w.wz.writingHelp({ op: "notewrite", field: "text", told: "The gate was locked.", assistant: ON, by: F, viewer: F, ...x });

test("notice run-rules:72 (R19, R29, R30, R36, R37): writing help's part is still a test-bar part (gate part `draft`); on a test instance its draft carries run-rules' own untestedLabel, read through ai-runs' admission with no entry id; off one it carries none; no admission refusal (AI_PART_NOT_DEPLOYED, PART_WITHDRAWN) replaces this module's answer", () => {
  assert.ok(TEST_BAR_PARTS.includes(wz.WRITING_HELP_PART), "R29's label exists only for a TEST_BAR_PARTS part");
  assert.equal(gatePartOf(wz.WRITING_HELP_PART), "draft", "R36: judged on the gate part `draft`");
  const label = untestedLabel(wz.WRITING_HELP_PART);
  assert.ok(label && Object.isFrozen(label));
  const on = ask(seeded({ env: TEST_ENV }));
  assert.deepEqual([on.ok, on.code], [false, "ASSISTANT_DRAFT_UNAVAILABLE"]);
  assert.deepEqual(on.untested, label, "R29 as amended: Gate 1 not met with no entry id, test instance: labelled");
  const off = ask(seeded({ env: { CIVICSMITH_TEST_INSTANCE: "a", INSTANCE_NAME: "b" } }));
  assert.deepEqual([off.code, "untested" in off], ["ASSISTANT_DRAFT_UNAVAILABLE", false], "control: off a test instance, none");
  for (const r of [on, off]) assert.ok(!["AI_PART_NOT_DEPLOYED", "PART_WITHDRAWN"].includes(r.code), "R30, R37 are the deploy gates' codes, not this module's");
});

test("notice membership:77 (R154): the membership names this module reads answer through the real Membership, its delegates to member-roster included: a plain member's startFrom omits the administrator's scripts and an administrator's lists them (sessionRights); a widened script's approvers are the administrators (activeAdmins); ADMIN_ACTS gains neither of R154's new ops", () => {
  const w = seeded();
  for (const n of ["positionalMember", "memberFacts", "isAdministrator", "isProjectOwner", "isJoinedParticipant", "projectOwners",
                   "activeAdmins", "inSight", "sessionRights"])
    assert.equal(typeof w.membership[n], "function", n);
  const ids = (viewer) => w.wz.startFrom({ viewer }).scripts.map((s) => s.id);
  assert.equal(w.membership.sessionRights(E).administer, true);
  assert.equal(w.membership.sessionRights(F).administer, false);
  const extra = ids(E).filter((id) => !ids(F).includes(id));
  assert.ok(extra.length > 0 || ids(E).length === ids(F).length, "an administrator sees at least what a member sees");
  assert.ok(ids(F).every((id) => ids(E).includes(id)));
  /* a widened script's approvers are the active administrators (activeAdmins, a member-roster delegate) */
  const a = approved(w, { name: "Widen me" });
  w.join(w.P, "erin", "invited");   /* P is hidden: she must see it to widen its script (D54) */
  const widened = w.wz.wizardApprove({ version: a.version, widen: true, by: E, viewer: E });
  assert.equal(widened.ok, true, JSON.stringify(widened));
  assert.deepEqual(w.membership.activeAdmins(), ["erin"]);
  const notAdmin = w.wz.wizardApprove({ version: a.version, widen: true, by: V("alice"), viewer: V("alice") });
  assert.equal(notAdmin.ok, false, "control: an owner who does not administer cannot widen");
  for (const op of ["adminproposalcancel", "adminremovals"]) assert.equal(wz.ADMIN_ACTS.has(op), false, `${op}: R51's list is fixed`);
});

test("notice answers:103 (answers R1): the writing help's draft (WRITING_HELP_PART, kind own_words) reaches what answers' draftAdmits admits, the whole ASK_SCOPE and never the agent Worker's own credential read aicredential, so no such read can enter the readLog checkDraft is given (R25); checkDraft is unchanged by it: a fact found only in an admitted read is kept with suggestions on, withheld with them off", async () => {
  const { ASK_SCOPE, askAdmits, draftAdmits } = await import("../../../src/answers/index.mjs");
  const kind = wz.WRITING_HELP_PART.split(":")[1];
  assert.equal(kind, "own_words");
  for (const { op } of ASK_SCOPE) assert.ok(draftAdmits(op, kind), `the draft reads ${op} as an ask does`);
  assert.equal(askAdmits("aicredential"), false, "answers R1 (T53): aicredential is not an ask's read");
  assert.equal(draftAdmits("aicredential", kind), false, "nor the writing help draft's");
  const told = ["The gate was locked."];
  const readLog = ["Budget line: 2000 dollars, council minutes."];
  const on = wz.checkDraft("The council spent 2,000 dollars on it.", { told, readLog, suggestions: true });
  const off = wz.checkDraft("The council spent 2,000 dollars on it.", { told, readLog, suggestions: false });
  assert.deepEqual(on.withheld, [], "with suggestions on, a fact from an admitted read stays");
  assert.notDeepEqual(off.withheld, [], "control: with suggestions off the same fact is withheld");
});
