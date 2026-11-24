/* basis-version-grammar R13 at the module's interface: every sentence this module writes about a version leg names it
   "Leg {n} of version '{name}'" (the key `basis-version-grammar.grammar.leg_of_version`), never the field spelling
   `basis_version_legs[i]`. Each test reads the finding's code and asserts its message begins with the leg's place, read by
   key through `localize`; no test holds a sentence whole. Driven over frontmatter objects, as grammar.test.mjs is. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { basisVersionFindings } from "../../../src/basis-version-grammar/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { DOC, Q, fm, findingsOf } from "./helper.mjs";

/** The place of leg `n` (counted from one) in version `name`, as the module words it: read by key. */
const place = (n, name) => localize("basis-version-grammar.grammar.leg_of_version", "Leg {n} of version '{name}'", { n: String(n), name });

/** The findings of `legs` over the helper's frontmatter, for `code`. */
const withCode = (code, legs, over = {}) => findingsOf(fm({ legs, ...over })).filter((y) => y.code === code);

test("R13: a lead leg names its place in plain words, never basis_version_legs (C-54.1, through leadLegFindings)", () => {
  const found = withCode("LEAD_NOT_EVIDENCE", [{ version: "first", target: "LEAD-2026-0001-x", role: "supports", ground: "main" }]);
  assert.equal(found.length, 1, "control: the lead refusal is still raised");
  assert.ok(found[0].message.startsWith(place(1, "first")), found[0].message);
  assert.doesNotMatch(found[0].message, /basis_version_legs/);
});

test("R13: an extent the record cannot evaluate names the leg's place (C-25.10, through checkLegExtentGrammar)", () => {
  const found = withCode("CONTENT_EXTENT_NO_PRODUCER", [{ version: "first", target: DOC, role: "supports", ground: "main", extent_kind: "dom" }]);
  assert.equal(found.length, 1, "control: the extent refusal is still raised");
  assert.ok(found[0].message.startsWith(place(1, "first")), found[0].message);
  assert.doesNotMatch(found[0].message, /basis_version_legs/);
});

test("R13: a leg whose target is not a canonical record id names its place", () => {
  const found = withCode("VERSION_LEG_NOT_CITABLE", [{ version: "first", target: "not-an-id", role: "supports", ground: "main" }]);
  assert.equal(found.length, 1);
  assert.ok(found[0].message.startsWith(place(1, "first")), found[0].message);
  assert.doesNotMatch(found[0].message, /basis_version_legs/);
});

test("R13: a leg whose target is of a kind a leg may not rest on names its place, the second leg of the version", () => {
  const found = withCode("VERSION_LEG_NOT_CITABLE", [{ version: "first", target: DOC, role: "supports", ground: "main" },
                                                     { version: "first", target: "PROJ-2026-0001-p", role: "supports", ground: "main" }]);
  assert.equal(found.length, 1);
  assert.ok(found[0].message.startsWith(place(2, "first")), found[0].message);
  assert.doesNotMatch(found[0].message, /basis_version_legs/);
});

test("R13: a leg that names this inquiry names its place (VERSION_LEG_SELF)", () => {
  const found = withCode("VERSION_LEG_SELF", [{ version: "first", target: Q, role: "supports", ground: "main" }]);
  assert.equal(found.length, 1);
  assert.ok(found[0].message.startsWith(place(1, "first")), found[0].message);
  assert.doesNotMatch(found[0].message, /basis_version_legs/);
});

test("R13: a role, a grade, a grade_axis and a grade_source each outside its vocabulary name the leg's place", () => {
  for (const [k, bad] of [["role", "maybe"], ["grade", "E"], ["grade_axis", "vibes"], ["grade_source", "rumour"]]) {
    const leg = { version: "first", target: DOC, role: "supports", ground: "main", [k]: bad };
    const found = withCode("VERSION_LEG_NOT_CITABLE", [leg]);
    assert.equal(found.length, 1, `${k}: control`);
    assert.ok(found[0].message.startsWith(place(1, "first")), `${k}: ${found[0].message}`);
    assert.doesNotMatch(found[0].message, /basis_version_legs/, k);
  }
});

test("R13: a ground that is not a ground label names the leg's place (VERSION_GROUND_UNASSERTED)", () => {
  const found = withCode("VERSION_GROUND_UNASSERTED", [{ version: "first", target: DOC, role: "supports", ground: "not a label!" }]);
  assert.equal(found.length, 1);
  assert.ok(found[0].message.startsWith(place(1, "first")), found[0].message);
  assert.doesNotMatch(found[0].message, /basis_version_legs/);
});

test("R13: a ground that no grounds row declares names the leg's place (VERSION_GROUND_UNASSERTED)", () => {
  const found = withCode("VERSION_GROUND_UNASSERTED", [{ version: "first", target: DOC, role: "supports", ground: "other" }]);
  assert.ok(found.length >= 1);
  const undeclared = found.find((y) => y.message.includes("'other'"));
  assert.ok(undeclared.message.startsWith(place(1, "first")), undeclared.message);
  assert.doesNotMatch(undeclared.message, /basis_version_legs/);
});

test("R13: a leg naming a version that is not in basis_versions[] names its place (VERSION_ORPHAN_ROW)", () => {
  const found = withCode("VERSION_ORPHAN_ROW", [{ version: "zz", target: DOC, role: "supports", ground: "main" }]);
  const leg = found.find((y) => y.message.includes("'zz'"));
  assert.ok(leg, "control: the orphan leg is still raised");
  assert.ok(leg.message.startsWith(place(1, "zz")), leg.message);
  assert.doesNotMatch(leg.message, /basis_version_legs/);
});

test("R13: a leg naming a version when the frontmatter has no basis_versions[] block names its place (VERSION_ORPHAN_ROW)", () => {
  const out = [];
  basisVersionFindings({ id: Q, object_type: "inquiry", basis_version_legs: [{ version: "zz", target: DOC, role: "supports", ground: "main" }] }, out);
  const leg = out.find((y) => y.code === "VERSION_ORPHAN_ROW");
  assert.ok(leg, "control: the orphan row is still raised");
  assert.ok(leg.message.startsWith(place(1, "zz")), leg.message);
  assert.doesNotMatch(leg.message, /basis_version_legs/);
});
