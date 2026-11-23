/* basis-version-grammar R3 at the module's interface, the arms grammar.test.mjs leaves out: a relationship that is
   absent is C-25.3 as an unknown one is; every leg of every kind has its role asked against record-grammar's
   BASIS_ROLES (C-25.10), imported, derived and standard included; a lead is refused by name and nothing more is said
   about its target. Pure: the grammar over frontmatter objects. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DOC, fm, codes } from "./helper.mjs";

const leg = (target, more = {}) => ({ version: "first", target, role: "supports", ground: "main", ...more });

test("R3 (C-25.3): a version with no relationship, or a blank one, is VERSION_NO_RELATIONSHIP and nothing else", () => {
  for (const relationship of [undefined, null, "", "  "])
    assert.deepEqual(codes(fm({ v: { relationship } })), ["VERSION_NO_RELATIONSHIP"], String(relationship));
  assert.deepEqual(codes(fm({ v: { relationship: " Or " }, legs: [leg(DOC)] })), ["VERSION_RELATIONSHIP_DISAGREES"],
    "control: trimmed and case-folded, then judged against the partition");
});

test("R3 (C-25.10): every kind of leg has its role asked, a leg on another group's finding, a calculation and a standard among them", () => {
  const targets = { imported: `imported:${"a".repeat(64)}/INQ-2026-0040-x`, calculation: "CALC-2026-0003", standard: "STD-2026-0007-s",
                    information: DOC };
  for (const [kind, target] of Object.entries(targets)) {
    const more = kind === "imported" ? { target_edition: 2 } : {};
    assert.deepEqual(codes(fm({ legs: [leg(target, more)] })), [], `${kind}: control, a supporting leg is clean`);
    assert.ok(codes(fm({ legs: [leg(target, { ...more, role: "maybe" })] })).includes("VERSION_LEG_NOT_CITABLE"), `${kind}: role refused`);
  }
});

test("R3 (C-54.1): a lead leg is refused by name first, and its target, grades and extent draw no second finding", () => {
  /* beside a clean leg in the declared ground, so the ground is not left empty by the refused lead */
  const got = codes(fm({ legs: [leg("LEAD-2026-0001-x", { grade: "E", extent_kind: "dom" }), leg(DOC)] }));
  assert.deepEqual(got, ["LEAD_NOT_EVIDENCE"]);
});
