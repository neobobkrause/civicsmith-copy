/* answer-envelope, attempt 6: re-tested against the new interface of instance-setup (land 2914227e80, its F2:
   `memberVersions` reads agent-runner from agent-worker's current `/version`). Of instance-setup this module reads only its
   check family (`src/setup.mjs`, at its `build/modules.json` place; R2, R7), and the plane answers setup's reports through
   `json` (R1). F2 moves no row and adds no code, so it is confirmed with no code change: every row setup holds decorates
   with its own code, check and translation (bar the two an earlier family holds), the file sits at its place, and setup's
   real fleet reports (its published fixture, made by its real `bootstrapReport` when the test runs) cross the envelope
   byte for byte with the open origin and no row added. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { M } from "./load.mjs";
import { fleetReports } from "../instance-setup/fixtures.mjs";

// fixtures-run: instance-setup notice-reopen-a6

const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const translated = (r) => !!r && typeof r.translation === "string" && r.translation !== "";
const MODULES = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules.map((m) => m.id);
const moduleOf = (p) => (p === "src/setup.mjs" ? "instance-setup" : p === "src/skilldoctrine.mjs" ? "skills" : p.split("/")[1]);
const SETUP = "src/setup.mjs";
const HELD_EARLIER = { DISCLOSURE_MALFORMED: "src/contradiction/checks.mjs", STAKE_MALFORMED: "src/project-roster/checks.mjs" };

function firstHolder(code, list = M.CHECK_FAMILY_FILES) {
  for (const [p, ns] of list)
    for (const k of Object.keys(ns).sort()) if (isFamily(k, ns[k]) && translated(ns[k][code])) return [p, ns[k][code]];
  return null;
}

test("attempt 6, instance-setup 2914227e80 (R2, R7): setup's family, read from src/setup.mjs at its modules.json place, decorates each of its codes with its own row; DISCLOSURE_MALFORMED and STAKE_MALFORMED alone decorate from the earlier family that holds them (negative control: without setup's file none of its own rows is reached)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const i = paths.indexOf(SETUP);
  assert.ok(i >= 0, "src/setup.mjs is listed");
  const ns = M.CHECK_FAMILY_FILES[i][1];
  assert.equal(ns, await import("../../../src/setup.mjs"));
  const rank = MODULES.indexOf("instance-setup");
  assert.ok(rank >= 0);
  paths.forEach((p, j) => {
    const r = MODULES.indexOf(moduleOf(p));
    if (r < 0 || r === rank) return;
    assert.equal(j < i, r < rank, `${p} against ${SETUP}`);
  });
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => p !== SETUP);
  let own = 0, held = 0;
  for (const [k, rows] of Object.entries(ns)) if (isFamily(k, rows))
    for (const [code, row] of Object.entries(rows)) {
      if (!translated(row)) continue;
      const [p, first] = firstHolder(code);
      if (p === SETUP && first === row) {
        own++;
        assert.deepEqual(M.dec49Attach({ ok: false, reason: code }),
                         { ok: false, reason: code, code, check: row.check ?? null, translation: row.translation }, code);
        assert.deepEqual(M.dec49Attach({ ok: true, result: { ok: false, code } }).result,
                         { ok: false, code, check: row.check ?? null, translation: row.translation }, `${code} in result`);
        assert.notEqual(firstHolder(code, without)?.[1], row, `${code}: reached only through setup's file`);
      } else {
        held++;
        assert.equal(HELD_EARLIER[code], p, `${code} is decorated from ${p}, not setup's row`);
      }
    }
  assert.ok(own > 0);
  assert.equal(held, Object.keys(HELD_EARLIER).length);
});

test("attempt 6, instance-setup 2914227e80 (R1, R2): setup's real fleet reports (its published fixture), agent-runner's reading among them, answered through `json` keep their status and every field byte for byte, carry the open origin and gain no row (control: the same body given a code setup holds gains setup's row)", async () => {
  const reports = await fleetReports();
  assert.ok(Object.keys(reports).length >= 6);
  for (const [name, { status, ...body }] of Object.entries(reports)) {
    const r = M.json(structuredClone(body), status);
    assert.equal(r.status, status, name);
    assert.equal(r.headers.get("access-control-allow-origin"), "*", name);
    const got = await r.json();
    assert.deepEqual(got, JSON.parse(JSON.stringify(body)), name);
    assert.equal("check" in got, false, name);
    if (body.memberVersions) assert.deepEqual(got.memberVersions["agent-runner"], body.memberVersions["agent-runner"], `${name}: agent-runner crosses as setup reads it`);
  }
  assert.ok(reports.serving.memberVersions && reports.serving.memberVersions["agent-runner"], "the serving report names agent-runner");
  const ns = M.CHECK_FAMILY_FILES.find(([p]) => p === SETUP)[1];
  const [code, row] = Object.entries(ns).filter(([k, v]) => isFamily(k, v)).flatMap(([, v]) => Object.entries(v))
    .find(([c, rw]) => translated(rw) && firstHolder(c)?.[1] === rw);
  const { status: _s, ...serving } = reports.serving;
  const coded = M.dec49Attach({ ...structuredClone(serving), ok: false, code });
  assert.equal(coded.check, row.check ?? null);
  assert.equal(coded.translation, row.translation);
});
