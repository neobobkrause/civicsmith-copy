/* affordances F2 (T53; reading-guides R20, K5508; op-declarations R34): `guideoptout`, the sole member's opt-out of review that
   reading-guides declares (PR 352), is explained in act help once it is declared, under `act.guideoptout.does`: that row's text
   once the word list holds it, until then reading-guides' own declared description, read by reference (no sentence here, K3810).
   Before it is declared it is not held (R48). The declaration is read from reading-guides itself, never built here (K3268). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as READING_GUIDES from "../../../src/reading-guides/index.mjs";
import { hasWord, word } from "../../../src/setup-words/index.mjs";
import { ACT_HELP, ACT_HELP_OPS, T53_STANDIN_OPS } from "../../../src/affordances/act-help.mjs";

const OP = "guideoptout";
const decl = READING_GUIDES.DECLARED_OPS?.[OP];

test("F2: guideoptout is held in act help exactly when reading-guides declares it, explained by its .does row or the owner's declared description", () => {
  assert.equal(T53_STANDIN_OPS.includes(OP), Boolean(decl));
  assert.equal(ACT_HELP_OPS.includes(OP), Boolean(decl));
  assert.equal(Object.hasOwn(ACT_HELP, OP), Boolean(decl));
  if (!decl) return;
  assert.equal(typeof ACT_HELP[OP], "string");
  assert.ok(ACT_HELP[OP].length > 0);
  assert.equal(ACT_HELP[OP], hasWord(`act.${OP}.does`) ? word(`act.${OP}.does`) : decl.description);
  /* held once: no second entry under an alias or an owed_ tag */
  assert.equal(ACT_HELP_OPS.filter((op) => op === OP).length, 1);
  /* negative control: an op no module declares is not held */
  assert.ok(!Object.hasOwn(ACT_HELP, "nosuchop"));
});
