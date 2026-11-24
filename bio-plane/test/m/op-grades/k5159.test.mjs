/* op-grades, fix round 10 (T51; K5159, INTERFACE-SHELL #22): `namedrequests`, the read monitoring declares (`weight: "read"`,
   `mutating: false`), was graded Reasoned in `MARKS`, so the design drew a read as a reasoned act (interface-shell R11). A read
   asks no reason and is never above Reversible: it takes the read's mark, as `versionnotice` does (R42, R46; K4259). Every
   declared read is checked, not only the ones this module's tables name, so a read another owner declares is found here too. */
import test from "node:test";
import assert from "node:assert/strict";
import { MARKS, MARK_SOURCES } from "../../../src/op-grades/index.mjs";
import { collectDeclaredOps } from "./declared.mjs";

const here = new URL("../../../../", import.meta.url).pathname;
const { ops, owners } = await collectDeclaredOps(here);

test("R42 (K5159): every read an owner declares that `MARKS` holds is marked Reversible, never Reasoned or above (interface-shell "
   + "R11); control: an act the kit weighs keeps its own mark", () => {
  const reads = Object.keys(ops).filter((op) => ops[op].weight === "read" && Object.hasOwn(MARKS, op));
  assert.ok(reads.length >= 10, "the registry's reads are marked");
  for (const op of reads) assert.equal(MARKS[op], "Reversible", `${op} (${owners[op]}) is a read, so Reversible at most`);
  assert.equal(owners.namedrequests, "monitoring");
  assert.equal(ops.namedrequests.mutating, false);
  assert.match(MARK_SOURCES.namedrequests, /^K4259, a ruling/, "a read takes the read's ruling, as versionnotice does");
  assert.equal(MARKS.namedrequests, "Reversible");
  /* control: an act a declared write holds keeps its weight above Reversible */
  assert.equal(MARKS.memberadd, "Reasoned");
  assert.equal(MARKS.claim, "Signed");
});
