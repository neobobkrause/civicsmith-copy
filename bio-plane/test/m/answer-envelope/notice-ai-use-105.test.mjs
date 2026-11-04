/* answer-envelope: notice ai-use:105 (ai-use's T53 job, PR 105). ai-use changed its requirements and exports and added
   two rows to its family C-143 (C-143.7 `AI_THRESHOLD_INVALID`, R23; C-143.8 `NOT_A_PAYING_ACCOUNT`, R27). This module
   reads ai-use's family at its place in `build/modules.json` (R7, R10) and decorates its refusals (R2); nothing else of
   ai-use is read here. Confirmed with no code change: every C-143 row, the two new ones among them, decorates with
   ai-use's own code, check and translation, and ai-use's real refusal (its published fixture) crosses the envelope with
   them unchanged. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { M } from "./load.mjs";
import * as AI_USE from "../../../src/ai-use/checks.mjs";
import { ceilingRefusal } from "../ai-use/fixtures.mjs";

// fixtures-run: ai-use notice-ai-use-105

const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const MODULES = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules.map((m) => m.id);

test("notice ai-use:105 (R2, R7, R10): every row of ai-use's family C-143, the T53 rows C-143.7 AI_THRESHOLD_INVALID and C-143.8 NOT_A_PAYING_ACCOUNT among them, decorates a bare refusal with ai-use's own code, check and translation, read from ai-use's file at its modules.json place, and no other listed family holds a C-143 code (negative control: the list without ai-use's file leaves them bare)", () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const i = paths.indexOf("src/ai-use/checks.mjs");
  assert.ok(i > 0, paths.join(", "));
  assert.equal(paths[i - 1], "src/run-rules/checks.mjs");
  assert.equal(paths[i + 1], "src/run-productions/checks.mjs");
  assert.ok(MODULES.indexOf("run-rules") < MODULES.indexOf("ai-use") && MODULES.indexOf("ai-use") < MODULES.indexOf("run-productions"));
  assert.equal(M.CHECK_FAMILY_FILES[i][1], AI_USE);
  const rows = Object.entries(AI_USE.AI_USE_CHECKS);
  const codes = rows.map(([c]) => c);
  for (const code of ["AI_THRESHOLD_INVALID", "NOT_A_PAYING_ACCOUNT"]) assert.ok(codes.includes(code), code);
  for (const [code, row] of rows) {
    assert.match(row.check, /^C-143\.\d+$/, code);
    assert.ok(typeof row.translation === "string" && row.translation, `${code} has its words`);
    assert.equal(M.CHECK_FAMILIES.AI_USE_CHECKS[code], row, code);
    assert.deepEqual(M.dec49Attach({ ok: false, reason: code }),
                     { ok: false, reason: code, code, check: row.check, translation: row.translation }, code);
    assert.deepEqual(M.dec49Attach({ ok: true, result: { ok: false, code } }).result,
                     { ok: false, code, check: row.check, translation: row.translation }, `${code} in result`);
    for (const [p, ns] of M.CHECK_FAMILY_FILES) if (p !== "src/ai-use/checks.mjs")
      for (const [k, v] of Object.entries(ns)) if (isFamily(k, v)) assert.equal(Object.hasOwn(v, code), false, `${code} is also in ${p} ${k}`);
  }
  assert.equal(M.dec49Row("AI_THRESHOLD_INVALID").check, "C-143.7");
  assert.equal(M.dec49Row("NOT_A_PAYING_ACCOUNT").check, "C-143.8");
  /* negative control: without ai-use's file none of its codes is reached by any family */
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => p !== "src/ai-use/checks.mjs");
  for (const code of codes)
    assert.equal(without.some(([, ns]) => Object.entries(ns).some(([k, v]) => isFamily(k, v) && v[code]?.translation)), false, code);
});

test("notice ai-use:105 (R1, R2): ai-use's real refusal (its published fixture `ceilingRefusal`, AI_LIMIT_REACHED C-143.1) answered through `json` keeps its code, check, translation and fields, at its status with the open origin; with its decoration stripped, the envelope gives it back the same row (negative control: an unknown code gains no row)", async () => {
  const real = await ceilingRefusal();
  assert.equal(real.ok, false);
  assert.equal(real.code, "AI_LIMIT_REACHED");
  const r = M.json(structuredClone(real), 429);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const body = await r.json();
  assert.deepEqual(body, JSON.parse(JSON.stringify(real)));
  const row = AI_USE.AI_USE_CHECKS.AI_LIMIT_REACHED;
  assert.equal(body.check, row.check);
  const { check, translation, ...bare } = structuredClone(real);
  const again = M.dec49Attach(bare);
  assert.equal(again.check, "C-143.1");
  assert.equal(again.translation, row.translation);
  assert.equal(again.code, "AI_LIMIT_REACHED");
  assert.equal(M.dec49Attach({ ok: false, reason: "NO_SUCH_AI_USE_CODE" }).check, undefined);
});
