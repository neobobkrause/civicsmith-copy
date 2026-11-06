/* answer-envelope: the provider notices run-rules:407 (export AI_RUN_IDEM_CHECKS added, C-109.16 AI_RUN_IDEM_INVALID,
   ai-runs F3) and inquiry-grammar:423 (exports FILE_SAYS_* and the file_says leg helpers added; one row added to its
   family INQUIRY_GRAMMAR_CHECKS, C-2.8 FILE_SAYS_LEG_MALFORMED). This module reads only each provider's check
   families, at its place in `build/modules.json` (R2, R7); the grammar's new leg helpers are not used here. Confirmed
   with no code change: the composition takes every `*_CHECKS` export of a listed file, so the new family and the new
   row decorate with their own code, check and translation, and no earlier listed family holds either code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { M } from "./load.mjs";
import * as RUN_RULES from "../../../src/run-rules/checks.mjs";
import * as INQUIRY_GRAMMAR from "../../../src/inquiry-grammar/checks.mjs";
import { fileSaysLegFindings } from "../../../src/inquiry-grammar/index.mjs";

const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);

function holders(code) {
  const out = [];
  for (const [p, ns] of M.CHECK_FAMILY_FILES)
    for (const [k, v] of Object.entries(ns)) if (isFamily(k, v) && Object.hasOwn(v, code)) out.push(`${p} ${k}`);
  return out;
}

function decorates(code, row) {
  assert.ok(Object.values(M.CHECK_FAMILIES).some((rows) => rows[code] === row), `${code} is composed with its row`);
  assert.deepEqual(M.dec49Attach({ ok: false, reason: code }),
                   { ok: false, reason: code, code, check: row.check, translation: row.translation }, code);
  assert.deepEqual(M.dec49Attach({ ok: true, result: { ok: false, code } }).result,
                   { ok: false, code, check: row.check, translation: row.translation }, `${code} in result`);
}

test("notice run-rules:407 (R2, R7): run-rules' new family AI_RUN_IDEM_CHECKS (C-109.16 AI_RUN_IDEM_INVALID) is read from src/run-rules/checks.mjs, listed, and decorates with its own code, check and translation; no other listed file holds the code", () => {
  const listed = M.CHECK_FAMILY_FILES.find(([p]) => p === "src/run-rules/checks.mjs");
  assert.ok(listed);
  assert.equal(listed[1], RUN_RULES);
  const rows = Object.entries(RUN_RULES.AI_RUN_IDEM_CHECKS);
  assert.ok(rows.length > 0);
  for (const [code, row] of rows) {
    assert.match(row.check, /^C-109\.\d+$/, code);
    assert.ok(typeof row.translation === "string" && row.translation, `${code} has its words`);
    /* held only in run-rules' file: its own family and run-rules' aggregate AI_RUNS_CHECKS, the same row */
    const held = holders(code);
    assert.ok(held.includes("src/run-rules/checks.mjs AI_RUN_IDEM_CHECKS"), held.join(", "));
    for (const h of held) {
      assert.ok(h.startsWith("src/run-rules/checks.mjs "), `${code} is also in ${h}`);
      assert.equal(RUN_RULES[h.split(" ")[1]][code], row, h);
    }
    decorates(code, row);
  }
  assert.ok(rows.some(([c]) => c === "AI_RUN_IDEM_INVALID"));
  /* negative control: a code no family holds gains nothing */
  assert.equal(M.dec49Attach({ ok: false, reason: "AI_RUN_IDEM_NO_SUCH_CODE" }).check, undefined);
});

test("notice inquiry-grammar:423 (R2, R7): the grammar's real file_says finding carries FILE_SAYS_LEG_MALFORMED, whose C-2.8 row in INQUIRY_GRAMMAR_CHECKS decorates with its own code, check and translation; no other listed family holds the code (control: a leg with no file_says key gains no finding)", () => {
  const findings = [];
  assert.equal(fileSaysLegFindings("leg 1", { file_says_field: "colour", file_says_value: "red" }, findings), true);
  assert.ok(findings.length > 0);
  const codes = new Set(findings.map((x) => x.code));
  assert.deepEqual([...codes], ["FILE_SAYS_LEG_MALFORMED"]);
  const row = INQUIRY_GRAMMAR.INQUIRY_GRAMMAR_CHECKS.FILE_SAYS_LEG_MALFORMED;
  assert.equal(row.check, "C-2.8");
  assert.deepEqual(holders("FILE_SAYS_LEG_MALFORMED"), ["src/inquiry-grammar/checks.mjs INQUIRY_GRAMMAR_CHECKS"]);
  decorates("FILE_SAYS_LEG_MALFORMED", row);
  const none = [];
  assert.equal(fileSaysLegFindings("leg 2", { grade: "A" }, none), false);
  assert.equal(none.length, 0);
});
