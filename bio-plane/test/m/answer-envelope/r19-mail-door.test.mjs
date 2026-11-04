/* answer-envelope R19 (T53; N824, K5692 (4); mail-door R13; amends R7, R17): mail-door's family C-157 is listed at its
   place in `build/modules.json`, so every one of its refusals carries its envelope. Also R7's totality with T53's other
   new family, ai-catalogue's C-156, whose rows carry a word key and no translation: listed, decorating nothing. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { M } from "./load.mjs";
import * as MAIL from "../../../src/mail-door/checks.mjs";
import * as CAT from "../../../src/ai-catalogue/checks.mjs";

const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const MODULES = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules.map((m) => m.id);
const C157 = ["MAIL_OFF", "MAIL_NOT_SET_UP", "MAIL_NO_SUCH_ADDRESS", "MAIL_TOO_LARGE", "MAIL_EMPTY", "MAIL_RATE_MEMBER",
              "MAIL_RATE_TEAM", "MAIL_ALREADY_IN", "NO_SUCH_MAIL"];

test("R19 (T53; N824, K5692 (4)): CHECK_FAMILY_FILES lists src/mail-door/checks.mjs at its modules.json place (after doorbell's, before sources'), and every C-157 code, C-157.1 to C-157.9, answered through the door carries mail-door's own code, check and translation; control: MAIL_NO_STATEMENT is capture's C-118.12 and not in C-157, MAIL_WITHIN_FAILED carries no row; negative control: the list without mail-door's file leaves every C-157 code bare", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const i = paths.indexOf("src/mail-door/checks.mjs");
  assert.ok(i > 0, paths.join(", "));
  assert.equal(paths[i - 1], "src/doorbell/checks.mjs");
  assert.equal(paths[i + 1], "src/sources/checks.mjs");
  assert.ok(MODULES.indexOf("doorbell") < MODULES.indexOf("mail-door") && MODULES.indexOf("mail-door") < MODULES.indexOf("sources"));
  assert.equal(M.CHECK_FAMILY_FILES[i][1], MAIL);
  assert.deepEqual(Object.keys(MAIL.MAIL_CHECKS).sort(), [...C157].sort());
  for (const code of C157) {
    const row = MAIL.MAIL_CHECKS[code];
    assert.match(row.check, /^C-157\.[1-9]$/, code);
    assert.equal(M.CHECK_FAMILIES.MAIL_CHECKS[code], row, code);
    const r = M.json({ ok: false, reason: code }, 400);
    assert.equal(r.status, 400);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await r.json(), { ok: false, reason: code, code, check: row.check, translation: row.translation }, code);
    for (const [p, ns] of M.CHECK_FAMILY_FILES) if (p !== "src/mail-door/checks.mjs")
      for (const [k, v] of Object.entries(ns)) if (isFamily(k, v)) assert.equal(Object.hasOwn(v, code), false, `${code} is also in ${p} ${k}`);
  }
  assert.deepEqual(C157.map((c) => M.dec49Row(c).check).sort(), Array.from({ length: 9 }, (_, n) => `C-157.${n + 1}`).sort());
  /* controls */
  assert.equal(M.dec49Row("MAIL_NO_STATEMENT").check, "C-118.12");
  assert.equal(Object.hasOwn(MAIL.MAIL_CHECKS, "MAIL_NO_STATEMENT"), false);
  assert.equal(M.dec49Row("MAIL_WITHIN_FAILED"), null);
  /* a code with no row fails loud in mail-door (its R13), never reaching the door bare */
  assert.throws(() => MAIL.rowOf("MAIL_NO_SUCH_CODE"));
  /* negative control */
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => p !== "src/mail-door/checks.mjs");
  for (const code of C157)
    assert.equal(without.some(([, ns]) => Object.entries(ns).some(([k, v]) => isFamily(k, v) && v[code]?.translation)), false, code);
});

test("R7 (T53; K5457): ai-catalogue's file is listed at its modules.json place, directly before ai-accounts', so CATALOGUE_CHECKS (C-156) is reached and the catalogue stays total; its rows carry a word key and no translation, so R2 decorates none of them with C-156 (negative control: the list without its file does not reach CATALOGUE_CHECKS)", () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const i = paths.indexOf("src/ai-catalogue/checks.mjs");
  assert.ok(i > 0, paths.join(", "));
  assert.equal(paths[i + 1], "src/ai-accounts/checks.mjs");
  assert.equal(MODULES.indexOf("ai-catalogue") + 1, MODULES.indexOf("ai-accounts"));
  assert.equal(M.CHECK_FAMILY_FILES[i][1], CAT);
  const reached = (files) => files.some(([, ns]) => ns.CATALOGUE_CHECKS === CAT.CATALOGUE_CHECKS);
  assert.equal(reached(M.CHECK_FAMILY_FILES), true);
  assert.equal(reached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== "src/ai-catalogue/checks.mjs")), false);
  for (const [code, row] of Object.entries(CAT.CATALOGUE_CHECKS)) {
    assert.match(row.check, /^C-156\.\d+$/, code);
    assert.equal(row.translation, undefined, code);
    assert.notEqual(M.dec49Row(code)?.check, row.check, `${code} is not decorated with C-156`);
  }
});
