/* answer-envelope, attempt 4: re-tested against the new interfaces of admission (land a37e42fa05), instance-setup (land
   f5828a4d4d) and queue (PR 833), and the provider notices investigation:628, publication:632, network-notices:633,
   case-import:635, case-disclosures:636, public-read:642, case-carriage:658, case-authoring:681, filing-templates:712,
   action-plans:726, filings:727, monitoring:743 and following:744. Of each provider this module reads only its check
   family, at its place in `build/modules.json` (R2, R7), and decorates its refusals with it; the exports the notices name
   (Investigation.*, Publication.renderingsByPixels, NetworkNotices.listingRequest, CaseDisclosures.content, Following.*)
   are not read here. Each is confirmed with no code change: every row of the provider's family decorates with its own
   code, check and translation, unless an earlier listed family holds the code (R2's composition, named below), and the
   provider's file sits at its modules.json place. queue's and instance-setup's real answers (their published fixtures)
   cross the envelope unchanged (R1). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { M } from "./load.mjs";
import { feedWithItem, emptyCount } from "../queue/fixtures.mjs";
import { selftestAnswer, instanceGroupAnswer } from "../instance-setup/fixtures.mjs";

// fixtures-run: queue notice-reopen-a4
// fixtures-run: instance-setup notice-reopen-a4

const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);
const translated = (r) => !!r && typeof r.translation === "string" && r.translation !== "";
const MODULES = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules.map((m) => m.id);
const moduleOf = (p) => (p === "src/setup.mjs" ? "instance-setup" : p === "src/skilldoctrine.mjs" ? "skills" : p.split("/")[1]);

function firstHolder(code) {
  for (const [p, ns] of M.CHECK_FAMILY_FILES)
    for (const k of Object.keys(ns).sort()) if (isFamily(k, ns[k]) && translated(ns[k][code])) return [p, ns[k][code]];
  return null;
}

async function confirm(id, file, shadowed = {}) {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const i = paths.indexOf(file);
  assert.ok(i >= 0, `${file} is listed`);
  const ns = M.CHECK_FAMILY_FILES[i][1];
  assert.equal(ns, await import(`../../../${file}`));
  const rank = MODULES.indexOf(id);
  assert.ok(rank >= 0, id);
  paths.forEach((p, j) => {
    const r = MODULES.indexOf(moduleOf(p));
    if (r < 0 || r === rank) return;
    assert.equal(j < i, r < rank, `${p} against ${file}`);
  });
  let own = 0, all = 0;
  for (const [k, rows] of Object.entries(ns)) if (isFamily(k, rows))
    for (const [code, row] of Object.entries(rows)) {
      if (!translated(row)) continue;
      all++;
      const [p, first] = firstHolder(code);
      if (p === file && first === row) {
        own++;
        assert.deepEqual(M.dec49Attach({ ok: false, reason: code }),
                         { ok: false, reason: code, code, check: row.check ?? null, translation: row.translation }, `${id} ${code}`);
        assert.deepEqual(M.dec49Attach({ ok: true, result: { ok: false, code } }).result,
                         { ok: false, code, check: row.check ?? null, translation: row.translation }, `${id} ${code} in result`);
      } else {
        assert.equal(shadowed[code], p, `${id} ${code} is decorated from ${p}, not its own row`);
        assert.deepEqual(M.dec49Row(code), { check: first.check ?? null, translation: first.translation }, code);
      }
    }
  assert.ok(all > 0 && own > 0, `${id}: ${own} of ${all}`);
  assert.equal(all - own, Object.keys(shadowed).length, `${id}: the rows held earlier are exactly those named`);
  /* negative control: without the provider's file, none of its own rows is the one a code resolves to */
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => p !== file);
  const firstIn = (list, code) => {
    for (const [, o] of list) for (const kk of Object.keys(o).sort()) if (isFamily(kk, o[kk]) && translated(o[kk][code])) return o[kk][code];
    return null;
  };
  for (const [k, rows] of Object.entries(ns)) if (isFamily(k, rows))
    for (const code of Object.keys(rows)) if (!shadowed[code] && translated(rows[code]))
      assert.notEqual(firstIn(without, code), rows[code], `${id} ${code}`);
}

const PROVIDERS = [
  ["admission", "src/admission/checks.mjs", {}, "land a37e42fa05"],
  ["instance-setup", "src/setup.mjs",
   { DISCLOSURE_MALFORMED: "src/contradiction/checks.mjs", STAKE_MALFORMED: "src/project-roster/checks.mjs" }, "land f5828a4d4d"],
  ["queue", "src/queue/checks.mjs", {}, "PR 833"],
  ["investigation", "src/investigation/checks.mjs", { NO_SUCH_QUESTION: "src/citation/checks.mjs" }, "investigation:628"],
  ["publication", "src/publication/checks.mjs", {}, "publication:632"],
  ["network-notices", "src/network-notices/checks.mjs", {}, "network-notices:633"],
  ["case-import", "src/case-import/checks.mjs", {}, "case-import:635"],
  ["case-disclosures", "src/case-disclosures/checks.mjs", {}, "case-disclosures:636"],
  ["public-read", "src/public-read/checks.mjs", {}, "public-read:642"],
  ["case-carriage", "src/case-carriage/checks.mjs", {}, "case-carriage:658"],
  ["case-authoring", "src/case-authoring/checks.mjs", {}, "case-authoring:681"],
  ["filing-templates", "src/filing-templates/checks.mjs", {}, "filing-templates:712"],
  ["action-plans", "src/action-plans/checks.mjs", {}, "action-plans:726"],
  ["filings", "src/filings/checks.mjs", { NO_SUCH_BUNDLE: "src/hypotheses/checks.mjs" }, "filings:727"],
  ["monitoring", "src/monitoring/checks.mjs", {}, "monitoring:743"],
  ["following", "src/following/checks.mjs", {}, "following:744"],
];

for (const [id, file, shadowed, why] of PROVIDERS) {
  const held = Object.keys(shadowed);
  test(`attempt 4, ${why} (R2, R7): ${id}'s family decorates with its own code, check and translation, read from ${file} at its modules.json place${held.length ? `; ${held.join(", ")} alone decorate from the earlier family that holds the code` : ""} (negative control: the list without its file reaches none of its own codes)`, async () => {
    await confirm(id, file, shadowed);
  });
}

test("attempt 4, queue PR 833 (R1, R2): queue's real feed and count answers (its published fixtures) answered through `json` are byte for byte the provider's, with the open origin and no row added", async () => {
  for (const real of [feedWithItem(), emptyCount()]) {
    assert.equal(real.ok, true);
    const r = M.json(structuredClone(real));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
    const body = await r.json();
    assert.deepEqual(body, JSON.parse(JSON.stringify(real)));
    assert.equal("check" in body, false);
  }
});

test("attempt 4, instance-setup f5828a4d4d (R1, R2): instance-setup's real selftest refusal and instancegroup answers (its published fixtures) answered through `json` keep their status, fields and open origin; the selftest refusal carries no code, so it gains no row (control: given a code setup holds, the same body gains setup's row)", async () => {
  const { status, ...self } = await selftestAnswer();
  assert.equal(status, 500);
  assert.equal(self.ok, false);
  const r = M.json(structuredClone(self), status);
  assert.equal(r.status, 500);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  const body = await r.json();
  assert.deepEqual(body, JSON.parse(JSON.stringify(self)));
  assert.equal(body.check, undefined);
  const SETUP = M.CHECK_FAMILY_FILES.find(([p]) => p === "src/setup.mjs")[1];
  const [code, row] = Object.entries(SETUP).filter(([k, v]) => isFamily(k, v)).flatMap(([, v]) => Object.entries(v))
    .find(([c, rw]) => translated(rw) && firstHolder(c)?.[1] === rw);
  const coded = M.dec49Attach({ ...structuredClone(self), code });
  assert.equal(coded.check, row.check ?? null);
  assert.equal(coded.translation, row.translation);
  const { recorded, none } = await instanceGroupAnswer();
  for (const a of [recorded, none]) {
    const res = M.json(structuredClone(a));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), JSON.parse(JSON.stringify(a)));
  }
});
