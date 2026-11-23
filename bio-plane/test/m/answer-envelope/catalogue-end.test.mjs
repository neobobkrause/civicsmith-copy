/* answer-envelope R7 (was control-plane R43; rule 1, K648): the catalogue's end. Every code the door decorated before
   control-plane's R43, read from `rows-before-r43.json` (its check, and a digest of its translation, taken with the
   catalogue still the first source), is decorated with the same check and the same words from the modules' own
   families, but for a translation its owner re-worded under a ruling, whose pin moved with it (`changed.note`), and the
   published machine fences (control-plane R41) keep every code; a code the snapshot never held is not invented. Moved
   from control-plane's `catalogue-end.test.mjs` with the snapshot at the split (T35-80, K1974). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { M } from "./load.mjs";
import { machineFences } from "../../../src/skillpack.mjs";

const SNAP = JSON.parse(readFileSync(new URL("./rows-before-r43.json", import.meta.url), "utf8"));
const digest = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

test("R7, R2, R10, R13: every code decorated before the catalogue's end reads the same check and translation, its owner's re-wordings under a ruling re-pinned (T41's: C-35.13, C-94.5, C-70.1, C-22.9, C-22.14, C-104.2–.5, C-104.8; T46's: C-124.30) and its retired codes held by none (T41's: C-124.52, C-106.1; T45's: C-115.19), its moved rows read at their new numbers with their old ones held by none (T45's: C-117.17, C-117.18 to C-149.6, C-149.7), every pin compared and every difference named, and every published fence (control-plane R41) stays published (negative control: a changed word or a missing code is seen)", () => {
  const codes = Object.keys(SNAP.rows);
  assert.ok(codes.length > 900, String(codes.length));
  /* every pin is compared, and every one that differs is named at once */
  const differs = [];
  for (const code of codes) {
    const got = M.dec49Row(code);
    const now = got ? [got.check, digest(got.translation)] : null;
    if (JSON.stringify(now) !== JSON.stringify(SNAP.rows[code])) differs.push(`${code} ${JSON.stringify(SNAP.rows[code])} → ${JSON.stringify(now)}`);
  }
  assert.deepEqual(differs, []);
  const fences = machineFences(M.CHECK_FAMILIES).map((f) => f.code);
  for (const code of SNAP.fences) assert.ok(fences.includes(code), `fence ${code} is no longer published`);
  /* the changes since, each its owner's under a Bob-approved requirement (`changed.note`): a retired code has no row and
     its number is held by no code; a re-keyed code has no row and its successor holds its number */
  const held = new Set(Object.values(M.CHECK_FAMILIES).flatMap((rows) => Object.values(rows)).map((r) => r.check));
  for (const [code, check] of Object.entries(SNAP.changed.retired)) {
    assert.equal(M.dec49Row(code), null, code);
    assert.equal(held.has(check), false, `${check} is reused`);
  }
  /* a moved row (T45, K2845, K2859): the same code and words at its new owner's number, the old number held by none */
  for (const [code, [was, now]] of Object.entries(SNAP.changed.moved)) {
    assert.equal(M.dec49Row(code).check, now, code);
    assert.deepEqual(SNAP.rows[code], [now, digest(M.dec49Row(code).translation)], code);
    assert.equal(held.has(was), false, `${was} is reused`);
  }
  for (const [was, now] of Object.entries(SNAP.changed.rekeyed)) {
    assert.equal(M.dec49Row(was), null, was);
    assert.ok(SNAP.rows[now] && M.dec49Row(now).check === SNAP.rows[now][0], now);
  }
  /* negative controls: the comparison would see a changed sentence, and a code no source holds has no row */
  const [one] = codes;
  assert.notDeepEqual([M.dec49Row(one).check, digest(M.dec49Row(one).translation + " ")], SNAP.rows[one]);
  assert.equal(M.dec49Row("NO_SUCH_CODE_ANYWHERE"), null);
});

test("R7 (rule 1, K786): the catalogue file and legacy-checks' tests are gone, CHECK_FAMILIES has no catalogue source, and no product module's file or module test imports `checks/bio-checks.mjs` — text-chain's parity test alone excepted, accepted red by name until its T20 job (N446) (negative control: the scan finds an import written in either quote form)", async () => {
  const { existsSync, readdirSync, statSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  assert.equal(existsSync(join(REPO, "bio-plane/checks/bio-checks.mjs")), false);
  assert.equal(existsSync(join(REPO, "bio-plane/test/m/legacy-checks")), false);
  assert.equal(M.CHECK_FAMILY_FILES.some(([p]) => /bio-checks/.test(p)), false);
  const IMPORT = /(?:from\s*|import\s*\(\s*|import\s+)["'][^"']*bio-checks(?:\.mjs)?["']/;
  const ACCEPTED = new Set(["bio-plane/test/m/text-chain/extent.test.mjs"]);   /* N446, K786 */
  const MODULES = JSON.parse(readFileSync(join(REPO, "build/modules.json"), "utf8")).modules.filter((m) => !m.legacy);
  const found = [];
  const walk = (p) => {
    const abs = join(REPO, p);
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) if (!["node_modules", "dist"].includes(f)) walk(join(p, f)); }
    else if (/\.(mjs|js)$/.test(p) && IMPORT.test(readFileSync(abs, "utf8"))) found.push(p);
  };
  for (const m of MODULES) for (const p of [...(m.paths || []), ...(m.tests || [])]) walk(p);
  assert.deepEqual(found.filter((p) => !ACCEPTED.has(p)), []);
  /* negative control: the pattern sees both quote forms and a dynamic import */
  const NAME = ["bio", "checks"].join("-");   /* assembled, so this file is not itself an importer */
  for (const t of [`import * as c from "../../checks/${NAME}.mjs";`, `import { a } from '../checks/${NAME}.mjs'`, `await import("../checks/${NAME}.mjs")`])
    assert.ok(IMPORT.test(t), t);
  assert.equal(IMPORT.test("/* moved from `checks/bio-checks.mjs` */"), false);
});

test("R13 (T46; DEC-194, N913; K2953, K2959, K2960): C-124.30 SCENARIO_OUT_OF_RANGE is re-pinned to the translation action-plans reads by key from words.json's refusal.SCENARIO_OUT_OF_RANGE, its code, check and where unmoved; C-113.7 FINDING_NOT_PUBLISHED and C-116.27 NOT_OPEN keep their pins (their owners keep their words in T46); changed.note names DEC-194's re-wording as C-124.30's reason; CHECK_FAMILY_FILES holds no T46 file (control: every other pinned code decorates with the same code, check and translation as before; negative control: the old pin would be seen)", async () => {
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const WORDS = JSON.parse(readFileSync(join(REPO, "docs/development/ux-substrate/screens/words.json"), "utf8")).words;
  const en = (key) => WORDS.find((w) => w.key === key)?.en;
  const AP = (await import("../../../src/action-plans/checks.mjs")).ACTION_PLAN_CHECKS;
  /* C-124.30: words.json's sentence, as action-plans' row holds it, and the pin moved with it */
  const sentence = en("refusal.SCENARIO_OUT_OF_RANGE");
  assert.ok(typeof sentence === "string" && sentence, "words.json holds refusal.SCENARIO_OUT_OF_RANGE");
  assert.equal(AP.SCENARIO_OUT_OF_RANGE.translation, sentence);
  assert.deepEqual(M.dec49Row("SCENARIO_OUT_OF_RANGE"), { check: "C-124.30", translation: sentence });
  assert.equal(M.CHECK_FAMILIES.ACTION_PLAN_CHECKS.SCENARIO_OUT_OF_RANGE, AP.SCENARIO_OUT_OF_RANGE);
  assert.match(AP.SCENARIO_OUT_OF_RANGE.where, /scenarioSet > is-scenario-numbered/);
  assert.deepEqual(SNAP.rows.SCENARIO_OUT_OF_RANGE, ["C-124.30", digest(sentence)]);
  assert.deepEqual(M.dec49Attach({ ok: false, reason: "SCENARIO_OUT_OF_RANGE" }),
                   { ok: false, reason: "SCENARIO_OUT_OF_RANGE", code: "SCENARIO_OUT_OF_RANGE", check: "C-124.30", translation: sentence });
  /* C-113.7 and C-116.27: their pins as T45 left them, which the rows still read (not words.json's unadopted sentences) */
  for (const [code, pin, key] of [["FINDING_NOT_PUBLISHED", ["C-113.7", "cf5ceb7e8f1b877b"], "refusal.FINDING_NOT_PUBLISHED"],
                                  ["NOT_OPEN", ["C-116.27", "80ea63ad3225e138"], "refusal.NOT_OPEN"]]) {
    assert.deepEqual(SNAP.rows[code], pin, code);
    const got = M.dec49Row(code);
    assert.deepEqual([got.check, digest(got.translation)], pin, code);
    if (en(key)) assert.notEqual(got.translation, en(key), `${code} keeps its own words in T46`);
  }
  /* changed.note: one sentence naming DEC-194 as C-124.30's reason, and the two kept rows */
  const note = SNAP.changed.note;
  assert.match(note, /T46 \(answer-envelope R13; DEC-194, N913[^)]*\): action-plans C-124\.30 SCENARIO_OUT_OF_RANGE re-worded under DEC-194/);
  assert.match(note, /C-113\.7 FINDING_NOT_PUBLISHED and escalation C-116\.27 NOT_OPEN keep their translations in T46/);
  /* CHECK_FAMILY_FILES unchanged: T46 adds no family, so no file of a module new in T46 is listed */
  for (const id of ["interface-assets", "interface-shell", "screens-settings", "screens-intake", "screens-daily", "screens-inquiry"])
    assert.equal(M.CHECK_FAMILY_FILES.some(([p]) => p.startsWith(`src/${id}/`)), false, id);
  /* T46 added none; T47 adds case-inputs' file alone (R15) and T48 ai-accounts' alone (R17), so 87, then 88, now 89, and T50 translations' file makes 90 (answer-envelope J2/B3) */
  assert.equal(M.CHECK_FAMILY_FILES.length, 90);
  assert.equal(M.CHECK_FAMILY_FILES.filter(([p]) => p !== "src/case-inputs/checks.mjs" && p !== "src/ai-accounts/checks.mjs" && p !== "src/translations/checks.mjs").length, 87);
  /* control: every other pinned code decorates exactly as pinned */
  for (const [code, pin] of Object.entries(SNAP.rows)) if (code !== "SCENARIO_OUT_OF_RANGE") {
    const got = M.dec49Row(code);
    assert.deepEqual(got ? [got.check, digest(got.translation)] : null, pin, code);
  }
  /* negative control: T45's pin of C-124.30 would read red */
  assert.notDeepEqual([M.dec49Row("SCENARIO_OUT_OF_RANGE").check, digest(M.dec49Row("SCENARIO_OUT_OF_RANGE").translation)], ["C-124.30", "13524823f3e8dd74"]);
});

test("R7, N1128 (K3765): a row that reads its words by key is pinned by that key's sentence, so a re-word of the words moves the pin with it; a row whose words are still inline keeps its digest (negative control: a row that reads a key, reworded, is seen)", async () => {
  const WORDS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8")).words;
  const en = (code) => WORDS.find((w) => w.key === `refusal.${code}`)?.en;
  let keyed = 0;
  for (const code of Object.keys(SNAP.rows)) {
    const sentence = en(code);
    if (sentence === undefined || M.dec49Row(code).translation !== sentence) continue;
    keyed++;
    assert.deepEqual([M.dec49Row(code).check, digest(sentence)], SNAP.rows[code], `${code} is pinned by its key`);
  }
  assert.ok(keyed >= 70, String(keyed));
  /* negative control: a sentence the row reads from its key, changed, is no longer its pin */
  const [one] = Object.keys(SNAP.rows).filter((c) => en(c) !== undefined && M.dec49Row(c).translation === en(c));
  assert.notDeepEqual([M.dec49Row(one).check, digest(en(one) + " ")], SNAP.rows[one]);
});
