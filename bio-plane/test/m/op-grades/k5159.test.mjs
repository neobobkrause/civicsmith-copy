/* op-grades, fix round 10 (T51; K5159, INTERFACE-SHELL #22): `namedrequests`, the read monitoring declares (`weight: "read"`,
   `mutating: false`), was graded Reasoned in `MARKS`, so the design drew a read as a reasoned act (interface-shell R11). A read
   asks no reason and is never above Reversible: it takes the read's mark, as `versionnotice` does (R42, R46; K4259). Every
   read the tables hold is checked, a read an owner registers among them: `monitoring` comes after this module, so its row is
   scripted from its declaration's weight and registered here. */
import test from "node:test";
import assert from "node:assert/strict";
import { MARKS, MARK_SOURCES } from "../../../src/op-grades/index.mjs";
import { registeredWith, ownerRow } from "./declared.mjs";

/* the owner's row, scripted: `monitoring` declares namedrequests a read (its words are not under test here) */
const OWNER = { monitoring: { namedrequests: ownerRow("read", "a fixture sentence for a read the owner declares") } };
/** The ops `MARKS` holds that the tables of `m` hold as a read: a NON_ACTS row with no rung, no ground and no machine refusal. */
const markedReads = (m) => Object.keys(MARKS).filter((op) => Object.hasOwn(m.NON_ACTS, op)
  && !Object.hasOwn(m.RUNGS, op) && !Object.hasOwn(m.RUNG_ABSENT, op) && !Object.hasOwn(m.MACHINE_REFUSALS, op));

test("R42 (K5159): every read the tables hold that `MARKS` holds is marked Reversible, never Reasoned or above (interface-shell "
   + "R11), namedrequests among them once its owner registers it; control: an act the kit weighs keeps its own mark", async () => {
  const m = await registeredWith(OWNER);
  const reads = markedReads(m);
  assert.ok(reads.length >= 10, "the registry's reads are marked");
  assert.ok(reads.includes("namedrequests"), "the owner's registered read is found");
  for (const op of reads) assert.equal(MARKS[op], "Reversible", `${op} is a read, so Reversible at most`);
  assert.match(MARK_SOURCES.namedrequests, /^K4259, a ruling/, "a read takes the read's ruling, as versionnotice does");
  /* control: an act a declared write holds keeps its weight above Reversible */
  assert.equal(MARKS.memberadd, "Reasoned");
  assert.equal(MARKS.claim, "Signed");
});
