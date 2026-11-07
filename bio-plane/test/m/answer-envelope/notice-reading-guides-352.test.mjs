/* answer-envelope: notice reading-guides:352 (reading-guides' T53 job, PR 352). reading-guides changed R17-R20 and added
   the exports `NOT_REVIEWED_LABEL` and `ReadingGuides.guideOptOut`, with three rows in its family C-144 for R20's opt-out
   (C-144.20 `OPT_OUT_NOT_SOLE_MEMBER`, C-144.21 `MACHINE_CANNOT_OPT_OUT`, C-144.22 `OPT_OUT_NOT_OWN_GUIDE`). This module
   reads only reading-guides' family, at its place in `build/modules.json` (R7, R10), and decorates its refusals (R2);
   `NOT_REVIEWED_LABEL` is a statement on an answer, not a refusal, and `guideOptOut` is reading-guides' op, routed by its
   owner, so neither is read here. Confirmed with no code change: every C-144 row, the three new ones among them,
   decorates with reading-guides' own code, check and translation, and its real opt-out refusals (its published fixture,
   driving `guideOptOut`) cross the envelope with them unchanged. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { M } from "./load.mjs";
import * as READING_GUIDES from "../../../src/reading-guides/checks.mjs";
import { world, ANN, MACHINE } from "../reading-guides/fixture.mjs";

// fixtures-run: reading-guides notice-reading-guides-352

const FILE = "src/reading-guides/checks.mjs";
const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const MODULES = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules.map((m) => m.id);
const OWN_ROWS = Object.entries(READING_GUIDES).filter(([k, v]) => isFamily(k, v)).flatMap(([, v]) => Object.entries(v));

test("notice reading-guides:352 (R2, R7, R10): every row of reading-guides' family C-144, R20's C-144.20 OPT_OUT_NOT_SOLE_MEMBER, C-144.21 MACHINE_CANNOT_OPT_OUT and C-144.22 OPT_OUT_NOT_OWN_GUIDE among them, decorates a bare refusal with reading-guides' own code, check and translation, read from its file at its modules.json place, and no other listed family holds a C-144 code (negative control: the list without its file leaves them bare)", () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const i = paths.indexOf(FILE);
  assert.ok(i > 0, paths.join(", "));
  assert.equal(paths[i - 1], "src/capture-requests/checks.mjs");
  assert.equal(paths[i + 1], "src/skilldoctrine.mjs");
  assert.ok(MODULES.indexOf("capture-requests") < MODULES.indexOf("reading-guides"));
  assert.equal(M.CHECK_FAMILY_FILES[i][1], READING_GUIDES);
  const codes = OWN_ROWS.map(([c]) => c);
  for (const [code, check] of [["OPT_OUT_NOT_SOLE_MEMBER", "C-144.20"], ["MACHINE_CANNOT_OPT_OUT", "C-144.21"], ["OPT_OUT_NOT_OWN_GUIDE", "C-144.22"]]) {
    assert.ok(codes.includes(code), code);
    assert.equal(M.dec49Row(code).check, check, code);
  }
  for (const [code, row] of OWN_ROWS) {
    if (typeof row?.translation !== "string" || !row.translation) continue;
    assert.match(row.check, /^C-144\.\d+$/, code);
    assert.deepEqual(M.dec49Attach({ ok: false, reason: code }),
                     { ok: false, reason: code, code, check: row.check, translation: row.translation }, code);
    assert.deepEqual(M.dec49Attach({ ok: true, result: { ok: false, code } }).result,
                     { ok: false, code, check: row.check, translation: row.translation }, `${code} in result`);
    for (const [p, ns] of M.CHECK_FAMILY_FILES) if (p !== FILE)
      for (const [k, v] of Object.entries(ns)) if (isFamily(k, v)) assert.equal(Object.hasOwn(v, code), false, `${code} is also in ${p} ${k}`);
  }
  /* negative control: without reading-guides' file none of R20's codes is reached by any family */
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => p !== FILE);
  for (const code of ["OPT_OUT_NOT_SOLE_MEMBER", "MACHINE_CANNOT_OPT_OUT", "OPT_OUT_NOT_OWN_GUIDE"])
    assert.equal(without.some(([, ns]) => Object.entries(ns).some(([k, v]) => isFamily(k, v) && v[code]?.translation)), false, code);
});

test("notice reading-guides:352 (R1, R2): reading-guides' real opt-out refusals (its published fixture driving `guideOptOut`: a machine, and a team's reading guide) answered through `json` keep their code, check, translation and fields, at their status with the open origin; stripped of their decoration, the envelope gives each back the same row (negative control: an unknown code gains no row)", async () => {
  const w = world({ members: [["ann", "member", "active"]] });
  const reading = w.draft();
  const refusals = [w.g.guideOptOut({ guide: reading, viewer: MACHINE }), w.g.guideOptOut({ guide: reading, viewer: ANN })];
  assert.deepEqual(refusals.map((r) => r.code), ["MACHINE_CANNOT_OPT_OUT", "OPT_OUT_NOT_OWN_GUIDE"]);
  for (const real of refusals) {
    assert.equal(real.ok, false);
    const r = M.json(structuredClone(real), 409);
    assert.equal(r.status, 409);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
    const body = await r.json();
    assert.deepEqual(body, JSON.parse(JSON.stringify(real)));
    const row = READING_GUIDES.READING_GUIDES_CHECKS[real.code];
    assert.equal(body.check, row.check);
    assert.equal(body.translation, row.translation);
    const { check, translation, ...bare } = structuredClone(real);
    const again = M.dec49Attach(bare);
    assert.equal(again.check, row.check);
    assert.equal(again.translation, row.translation);
    assert.equal(again.code, real.code);
  }
  assert.equal(M.dec49Attach({ ok: false, reason: "NO_SUCH_READING_GUIDES_CODE" }).check, undefined);
});
