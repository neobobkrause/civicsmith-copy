/* affordances: provider notice answers:197 (PR 197: answers' ask and standing question now name the chosen account and
   its entry to `useCheck`, and `ownerOf` takes the owner `accountFor` answered). Confirmed, no code change: what this
   module reads of answers is its check family, `ANSWERS_CHECKS`, which the untargeted answer carries whole by reference
   (K1601), and PR 197 changed no row of it; this module's code calls no answers service (`askAccount`, `ownerOf`,
   `accountNamed`, `useCheck`), so the payer an ask names is the owner's, never pre-flighted here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { affordancesAnswer } from "../../../src/affordances/door.mjs";
import { ANSWERS_CHECKS } from "../../../src/answers/index.mjs";

const SRC = new URL("../../../src/", import.meta.url);

test("notice answers:197 (K1601, R17): the untargeted answer carries answers' check family by reference, every row with its check and translation", () => {
  const r = affordancesAnswer({ kinds: null, gate: null });
  assert.equal(r.answer_checks, ANSWERS_CHECKS, "the very object answers holds");
  assert.ok(Object.keys(ANSWERS_CHECKS).length > 0);
  for (const [code, row] of Object.entries(r.answer_checks))
    assert.ok(typeof row.check === "string" && typeof row.translation === "string" && row.translation.length > 0, code);
  /* control: with a target, the family is not carried */
  assert.equal(Object.hasOwn(affordancesAnswer({ target: "INFO-x", facts: { ok: true, object_type: "information" }, kinds: null, gate: null }), "answer_checks"), false);
});

test("notice answers:197: this module's code imports only answers' check family and calls none of the services PR 197 changed", () => {
  const files = ["affordances.mjs", ...readdirSync(new URL("affordances/", SRC)).filter((f) => f.endsWith(".mjs")).map((f) => `affordances/${f}`)];
  const imports = [];
  for (const f of files) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*\/answers\/[^"']*["']/g)) imports.push(...m[1].split(",").map((s) => s.trim()).filter(Boolean));
    for (const name of ["askAccount", "ownerOf", "accountNamed", "useCheck", "standingTick"])
      assert.ok(!new RegExp(`\\b${name}\\s*\\(`).test(text), `${f} calls no ${name}`);
  }
  assert.deepEqual(imports, ["ANSWERS_CHECKS"]);
});
