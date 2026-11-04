/* answer-envelope: the composed catalogue (R2, R7; K585 (1), N245, N272, N414, K704, K717; moved from control-plane's
   `families.test.mjs` at the split, T35-80, K1974, its ids re-pointed: control-plane R22 → R2, R43 → R7).
   `CHECK_FAMILIES` holds every DEC-49 family a product module of the plane exports, each code once, and `dec49Row`
   reads it. The totality arm walks
   every `modules.json` path of the plane (`bio-plane/src`, `bio-plane/checks`), imports each file and requires every
   exported `*_CHECKS` table to be one the list reaches, so a module that opens a new file of families fails here until
   the list names it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { M } from "./load.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const MODULES = JSON.parse(readFileSync(join(REPO, "build/modules.json"), "utf8")).modules;
const isFamily = (k, v) => /_CHECKS$/.test(k) && !!v && typeof v === "object" && !Array.isArray(v);

/* Every plane file of a module, with the module that owns it. */
/* store-assembly is the plane's second composition root (K5164): its register.mjs registers every owner's declarations again,
   which R81 refuses in one process, and it exports no family; skipped until plane's Wave B leaves one root (plan item 80). */
function planeFiles() {
  const out = [];
  const walk = (p, id) => {
    const abs = join(REPO, p);
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) if (!["node_modules", "dist", "test"].includes(f)) walk(join(p, f), id); }
    else if (p.endsWith(".mjs") && !p.startsWith("bio-plane/src/store-assembly/")) out.push([p, id]);
  };
  for (const m of MODULES) for (const p of m.paths || []) if (/^bio-plane\/(src|checks)(\/|$)/.test(p)) walk(p, m.id);
  return out;
}

/* The rows a list of sources reaches, by identity (a view composed of listed rows, `run-rules`' merged `AI_RUN_CHECKS`
   among them, reaches nothing new). */
const reached = (files) => new Set(files.flatMap(([, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v))
  .flatMap(([, v]) => Object.values(v))));

/* The rows exported anywhere in the plane that `files` does not reach: `<file> <family>`, once per family. */
async function unreached(files) {
  /* plane R68: the start registration is the first import of the plane's graph, before any table is read (R81). The walk
     imports plane files that reach it, so it runs here first. */
  await import(join(REPO, "bio-plane/src/store-assembly/register.mjs"));
  const have = reached(files);
  const missing = new Set();
  for (const [p] of planeFiles()) {
    const ns = await import(join(REPO, p));
    for (const [k, v] of Object.entries(ns))
      if (isFamily(k, v) && Object.values(v).some((row) => row && typeof row === "object" && !have.has(row))) missing.add(`${p} ${k}`);
  }
  return [...missing];
}

test("R2, R7 (K585 (1)): CHECK_FAMILIES is total — every DEC-49 row any module of the plane exports is reached by the list (negative control: the list without one module's file misses its families)", async () => {
  assert.deepEqual(await unreached(M.CHECK_FAMILY_FILES), []);
  /* the list names only files that exist, each in a module's paths, each exporting a family; the catalogue first, the module's own last */
  const owned = new Set(planeFiles().map(([p]) => p));
  for (const [path, ns] of M.CHECK_FAMILY_FILES) {
    assert.ok(owned.has(`bio-plane/${path}`), path);
    assert.ok(Object.entries(ns).some(([k, v]) => isFamily(k, v)), path);
  }
  /* R7: the catalogue is no source; record-grammar's shared rows come first, the module's own last */
  assert.equal(M.CHECK_FAMILY_FILES.some(([p]) => p.startsWith("checks/")), false);
  assert.equal(M.CHECK_FAMILY_FILES[0][0], "src/record-grammar/acts.mjs");
  /* R7: this module's own family last, and alone: no other entry is this module's */
  assert.equal(M.CHECK_FAMILY_FILES.at(-1)[0], "src/answer-envelope/checks.mjs");
  assert.equal(M.CHECK_FAMILY_FILES.filter(([p]) => p.startsWith("src/answer-envelope/")).length, 1);
  assert.equal(M.CHECK_FAMILY_FILES.some(([p]) => p.startsWith("src/control-plane/")), false);
  for (const dropped of ["src/textchain.mjs", "src/action-clocks/checks.mjs", "src/monitoring/checks.mjs", "src/connections/checks.mjs"]) {
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== dropped));
    assert.ok(missing.some((m) => m.startsWith(`bio-plane/${dropped} `)), dropped);
  }
});

test("R2: CHECK_FAMILIES holds each code once, the first source's translated row; dec49Row answers exactly its rows — the families T18 moved among them (C-35 text chain, C-74 connections, C-52 content, C-123 and C-117.5 action clocks, C-18.10 and C-48.8/.9 monitoring, C-124 action plans, C-119 instance setup)", async () => {
  const seen = new Map();
  for (const [fam, rows] of Object.entries(M.CHECK_FAMILIES)) {
    assert.ok(/_CHECKS$/.test(fam), fam);
    for (const [code, row] of Object.entries(rows)) {
      assert.equal(seen.has(code), false, `${code} in ${fam} and ${seen.get(code)}`);
      seen.set(code, fam);
      const got = M.dec49Row(code);
      if (typeof row.translation === "string" && row.translation) assert.deepEqual(got, { check: row.check ?? null, translation: row.translation }, code);
      else assert.equal(got, null, code);
    }
  }
  assert.ok(seen.size > 900, String(seen.size));
  /* the first source wins: for every code, no earlier source holds a translated row the composition passed over */
  for (const [code, fam] of seen) {
    const kept = M.CHECK_FAMILIES[fam][code];
    for (const [, ns] of M.CHECK_FAMILY_FILES) {
      const hit = Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]).map(([, v]) => v[code]);
      if (hit.length) { if (kept.translation) assert.ok(hit.some((r) => r === kept) || !hit.some((r) => r.translation), code); break; }
    }
  }
  /* N1073 (K3268): every family is read from its owner's own file, as the list names it, never hand-listed here */
  for (const [file, ns] of M.CHECK_FAMILY_FILES) for (const fam of Object.keys(ns).filter((k) => isFamily(k, ns[k]))) {
    const rows = ns[fam];
    assert.ok(Object.keys(rows).length, `${file} ${fam}`);
    for (const [code, row] of Object.entries(rows)) if (row.translation)
      assert.ok(M.dec49Row(code), `${fam}.${code} reaches the wire`);
  }
  const checksOf = async (file, fam) => Object.values((await import(file))[fam]).map((r) => r.check);
  assert.ok((await checksOf("../../../src/action-clocks/checks.mjs", "ACTION_CLOCK_CHECKS")).some((c) => /^C-123\./.test(c)));
  assert.ok((await checksOf("../../../src/monitoring/checks.mjs", "MONITORING_CHECKS")).some((c) => /^C-48\.[89]$/.test(c)));
  /* negative control: a code no source holds has no row */
  assert.equal(M.dec49Row("NO_SUCH_CODE_ANYWHERE"), null);
  /* the composition is frozen: a reader cannot change what the door decorates with */
  assert.ok(Object.isFrozen(M.CHECK_FAMILIES) && Object.values(M.CHECK_FAMILIES).every(Object.isFrozen));
});

test("R2 (K782, K813, K817, K831, K837): the list reads credentials' three families, basis-versions', inquiry-grammar's, public-read's and action-grammar's (not actions' re-export), and each of their translated rows decorates with its own check and words (negative control: the list without one of them misses its families)", async () => {
  /* N1073 (K3268): each family is read from its owner's file, as the list names it, never hand-listed by name */
  const files = ["src/credentials/checks.mjs", "src/basis-versions/checks.mjs", "src/inquiry-grammar/checks.mjs",
                 "src/public-read/checks.mjs", "src/action-grammar/checks.mjs"];
  const listed = new Map(M.CHECK_FAMILY_FILES.map(([p, ns]) => [p, ns]));
  assert.equal(listed.has("src/actions/checks.mjs"), false, "actions' re-export is not a source of its own");
  let rows = 0;
  for (const path of files) {
    assert.ok(listed.has(path), path);
    const ownFams = Object.keys(listed.get(path)).filter((k) => isFamily(k, listed.get(path)[k]));
    assert.ok(ownFams.length >= 1, path);
    for (const fam of ownFams) {
      const table = listed.get(path)[fam];
      assert.ok(table && Object.keys(table).length, `${path} ${fam}`);
      for (const [code, row] of Object.entries(table)) if (row.translation) {
        rows++;
        assert.deepEqual(M.dec49Row(code), { check: row.check ?? null, translation: row.translation }, `${fam}.${code}`);
      }
    }
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
    assert.ok(missing.some((m) => m.startsWith(`bio-plane/${path} `)), `without ${path}`);
  }
  assert.ok(rows > 40, String(rows));
  /* K850: inquiry-grammar's own table is found by the reserved suffix in its namespace as it is, with no alias */
  const IG = await import("../../../src/inquiry-grammar/checks.mjs");
  assert.equal(listed.get("src/inquiry-grammar/checks.mjs"), IG);
  for (const code of Object.keys(IG.INQUIRY_GRAMMAR_CHECKS))
    assert.deepEqual(M.dec49Row(code), { check: IG.INQUIRY_GRAMMAR_CHECKS[code].check ?? null,
                                         translation: IG.INQUIRY_GRAMMAR_CHECKS[code].translation }, code);
});

test("R2, R7 (K921): the list reads local-facts' C-126 and filing-templates' C-125, each in its module's place (local-facts after events and before connections, in layer 5 since T33; filing-templates after action-clocks and before filings), and every one of their rows decorates with its own check and words (negative control: the list without either misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const at = (p) => paths.indexOf(p);
  for (const [path, fam, prefix] of [["src/local-facts/checks.mjs", "LOCAL_FACTS_CHECKS", "C-126."],
                                     ["src/filing-templates/checks.mjs", "FILING_TEMPLATE_CHECKS", "C-125."]]) {
    assert.ok(at(path) >= 0, path);
    const table = (await import(`../../../${path}`))[fam];
    assert.ok(Object.values(table).some((r) => r.check.startsWith(prefix)), `${fam} holds ${prefix}`);
    for (const [code, row] of Object.entries(table))
      assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, `${fam}.${code}`);
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
    assert.ok(missing.some((m) => m.startsWith(`bio-plane/${path} `)), `without ${path}`);
  }
  assert.ok(at("src/events/checks.mjs") < at("src/local-facts/checks.mjs") && at("src/local-facts/checks.mjs") < at("src/connections/checks.mjs"));
  assert.ok(at("src/action-clocks/checks.mjs") < at("src/filing-templates/checks.mjs") && at("src/filing-templates/checks.mjs") < at("src/filings/checks.mjs"));
  /* the moved rows C-115.31–.33, .35–.38 are decorated from filing-templates', whichever source holds them too */
  for (const code of ["MACHINE_CANNOT_DRAFT_TEMPLATE", "TEMPLATE_TIER3_FILE", "NO_SUCH_TEMPLATE", "NO_TEMPLATE_GRANT"])
    assert.ok(M.dec49Row(code), code);
});

test("R2, R7 (K1150): the list reads network-notices' C-127 in its module's place (after public-read, before ratification), and every one of its rows decorates with its own check and words (negative control: the list without it misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/network-notices/checks.mjs";
  assert.ok(paths.indexOf("src/public-read/checks.mjs") < paths.indexOf(path) && paths.indexOf(path) < paths.indexOf("src/ratification/checks.mjs"));
  const table = (await import(`../../../${path}`)).NETWORK_NOTICE_CHECKS;
  assert.equal(Object.keys(table).length, 16);
  for (const [code, row] of Object.entries(table)) {
    assert.match(row.check, /^C-127\.\d+$/, code);
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  }
  const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
  assert.ok(missing.includes(`bio-plane/${path} NETWORK_NOTICE_CHECKS`), missing.join(", "));
});

test("R2, R7 (K1207; N506; link-sweep R13 C-18.24, K4189): the list reads link-sweep's C-18.16–C-18.18 and C-18.24 (`SWEEP_CHECKS`) in its module's place (after monitoring, before tasks), and every one of its rows decorates with its own check and words; monitoring's file no longer holds them (negative control: the list without link-sweep's file misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/link-sweep/checks.mjs";
  assert.ok(paths.indexOf("src/monitoring/checks.mjs") < paths.indexOf(path) && paths.indexOf(path) < paths.indexOf("src/tasks/checks.mjs"));
  const table = (await import(`../../../${path}`)).SWEEP_CHECKS;
  assert.deepEqual(Object.values(table).map((r) => r.check).sort(), ["C-18.16", "C-18.17", "C-18.18", "C-18.24"]);
  for (const [code, row] of Object.entries(table)) assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  const MON = await import("../../../src/monitoring/checks.mjs");
  for (const code of Object.keys(table))
    assert.equal(Object.entries(MON).some(([k, v]) => isFamily(k, v) && Object.hasOwn(v, code)), false, `${code} left monitoring's file`);
  const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
  assert.ok(missing.includes(`bio-plane/${path} SWEEP_CHECKS`), missing.join(", "));
});

test("R2, R7 (N512; K1193): the list reads attestation's C-89 (`ATTEST_CHECKS`) and provenance-routes' C-34 (`ROUTE_MARK_CHECKS`) from their own modules' files, in the module order (provenance, attestation, provenance-routes, before capture-sources), every one of their rows decorates with its own check and words, and provenance's file holds neither family (negative control: the list without either file misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const at = (p) => paths.indexOf(p);
  assert.ok(at("src/provenance/checks.mjs") < at("src/attestation/checks.mjs")
            && at("src/attestation/checks.mjs") < at("src/provenance-routes/checks.mjs")
            && at("src/provenance-routes/checks.mjs") < at("src/capture-sources/credentials.mjs"), paths.join(", "));
  const PROV = await import("../../../src/provenance/checks.mjs");
  for (const [path, fam, prefix] of [["src/attestation/checks.mjs", "ATTEST_CHECKS", "C-89."],
                                     ["src/provenance-routes/checks.mjs", "ROUTE_MARK_CHECKS", "C-34."]]) {
    const table = (await import(`../../../${path}`))[fam];
    assert.ok(table && Object.keys(table).length, `${path} ${fam}`);
    for (const [code, row] of Object.entries(table)) {
      assert.ok(row.check.startsWith(prefix), `${fam}.${code} ${row.check}`);
      assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, `${fam}.${code}`);
      assert.equal(Object.entries(PROV).some(([k, v]) => isFamily(k, v) && Object.hasOwn(v, code)), false, `${code} left provenance's file`);
    }
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
    assert.ok(missing.includes(`bio-plane/${path} ${fam}`), missing.join(", "));
  }
  /* the codes are read from their owners' own tables, never copied here (K3268) */
  const { ROUTE_MARK_CHECKS } = await import("../../../src/provenance-routes/checks.mjs");
  const { ATTEST_CHECKS } = await import("../../../src/attestation/checks.mjs");
  for (const code of [...Object.keys(ROUTE_MARK_CHECKS), ...Object.keys(ATTEST_CHECKS)])
    assert.ok(M.dec49Row(code), code);
});

test("R2, R7 (N520, N522, N526, N533; K1310, K1331): the list reads accepted-work's C-21.4 and C-21.5 (after inquiry-grammar, before inquiry), case-import's C-130 (after ratification, before case-authoring) and docket's C-129 (after publication and, since T41, directly after publish-schedule, which directly follows publication (R10); before public-read), each in its module's place, and every one of their rows decorates with its own check and words; case-checker holds no family and has no entry; docket's pressure codes are its own (`MACHINE_CANNOT_MARK_DOCKET_PRESSURE` C-129.10, `DOCKET_PRESSURE_MARKED` C-129.12, `DOCKET_PRESSURE_REFUSED` C-129.13), no code is in both docket's and action-grammar's families, and action-grammar's `PRESSURE_REFUSED` and `MACHINE_CANNOT_MARK_PRESSURE` keep their own rows, `PRESSURE_MARKED` decorating with action-holds' C-149.6 since T45 (K2845, K2859) (negative control: the list without any of the three files misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const at = (p) => paths.indexOf(p);
  assert.ok(at("src/inquiry-grammar/checks.mjs") < at("src/accepted-work/checks.mjs") && at("src/accepted-work/checks.mjs") < at("src/inquiry/index.mjs"), paths.join(", "));
  assert.ok(at("src/ratification/checks.mjs") < at("src/case-import/checks.mjs") && at("src/case-import/checks.mjs") < at("src/case-authoring/checks.mjs"), paths.join(", "));
  assert.equal(at("src/publish-schedule/checks.mjs"), at("src/publication/checks.mjs") + 1, paths.join(", "));
  assert.equal(at("src/docket/checks.mjs"), at("src/publish-schedule/checks.mjs") + 1, paths.join(", "));
  assert.ok(at("src/docket/checks.mjs") < at("src/public-read/checks.mjs"), paths.join(", "));
  assert.equal(paths.some((p) => p.startsWith("src/case-checker/")), false);
  for (const [path, fam, checks] of [["src/accepted-work/checks.mjs", "ACCEPTED_WORK_CHECKS", /^C-21\.[45]$/],
                                     ["src/case-import/checks.mjs", "CASE_IMPORT_CHECKS", /^C-130\.\d+$/],
                                     ["src/docket/checks.mjs", "DOCKET_CHECKS", /^C-129\.\d+$/]]) {
    const table = (await import(`../../../${path}`))[fam];
    assert.ok(Object.keys(table).length >= 2, `${path} ${fam}`);
    for (const [code, row] of Object.entries(table)) {
      assert.match(row.check, checks, code);
      assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
    }
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
    assert.ok(missing.includes(`bio-plane/${path} ${fam}`), missing.join(", "));
  }
  assert.deepEqual(Object.values((await import("../../../src/accepted-work/checks.mjs")).ACCEPTED_WORK_CHECKS).map((r) => r.check).sort(), ["C-21.4", "C-21.5"]);
  /* docket: its own pressure codes, no code shared with action-grammar, whose rows stay its own */
  const AG = (await import("../../../src/action-grammar/checks.mjs"));
  const agFams = Object.entries(AG).filter(([k, v]) => isFamily(k, v)).map(([, v]) => v);
  const agRow = (code) => agFams.filter((v) => v[code]).map((v) => v[code])[0];
  for (const code of ["PRESSURE_REFUSED", "MACHINE_CANNOT_MARK_PRESSURE"])
    assert.deepEqual(M.dec49Row(code), { check: agRow(code).check, translation: agRow(code).translation }, code);
  /* T45 (K2845, K2859): `PRESSURE_MARKED` moved with its raiser to action-holds' C-149.6; action-grammar holds it no longer */
  assert.equal(agRow("PRESSURE_MARKED"), undefined);
  const AH = (await import("../../../src/action-holds/checks.mjs")).ACTION_HOLDS_CHECKS;
  assert.deepEqual(M.dec49Row("PRESSURE_MARKED"), { check: "C-149.6", translation: AH.PRESSURE_MARKED.translation });
  const DK = (await import("../../../src/docket/checks.mjs")).DOCKET_CHECKS;
  for (const code of Object.keys(DK)) assert.equal(agFams.some((v) => Object.hasOwn(v, code)), false, `${code} is in both docket's and action-grammar's families`);
  for (const code of ["MACHINE_CANNOT_MARK_PRESSURE", "PRESSURE_MARKED", "PRESSURE_REFUSED"])
    assert.equal(Object.hasOwn(DK, code), false, `docket's shared ${code} is gone (N526, N533)`);
  for (const [code, check] of [["MACHINE_CANNOT_MARK_DOCKET_PRESSURE", "C-129.10"], ["DOCKET_PRESSURE_MARKED", "C-129.12"], ["DOCKET_PRESSURE_REFUSED", "C-129.13"]])
    assert.deepEqual(M.dec49Row(code), { check, translation: DK[code].translation }, code);
});

test("R2, R7 (N529; K1331, K1333; T38: N788, K2310; T39: N806, K2333; T41: K2428, K2538) .20–.29: the list reads case-disclosures' C-120 (`CASE_DISCLOSURE_CHECKS`) in its module's place (after case-import, directly before case-account since T45, which directly precedes case-inputs and then case-authoring since T47), every one of its rows (C-120.1–C-120.8, C-120.10–C-120.22; .14–.16 since T33, K1638; .17, .18 since T37, K2227; C-120.19 `PHOTO_UNCHECKED` since T38; C-120.20–.22, a member document's copy, since T39; C-120.23–.29, the account's sentences, since T41, K2538) decorates with its own check and words, C-120.17 `PHOTO_NOT_COVERABLE` and C-120.19 `PHOTO_UNCHECKED` with `words.json`'s `photo.refused.format` and `photo.refused.unchecked` verbatim, C-120.21 `DOCUMENT_COPY_PENDING` and C-120.22 `DOCUMENT_NOT_CLEANABLE` with case-disclosures' `DOCUMENT_WORDS` `document.refused.pending` and `document.refused.clean` verbatim (BOB's drafts until `words.json` holds the keys), case-authoring's file no longer holds them, and C-120.9 is held by no code (negative control: the list without case-disclosures' file misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/case-disclosures/checks.mjs";
  assert.ok(paths.indexOf("src/case-import/checks.mjs") < paths.indexOf(path), paths.join(", "));
  assert.equal(paths.indexOf(path) + 1, paths.indexOf("src/case-account/checks.mjs"), paths.join(", "));
  /* since T47 (R15) case-inputs' file stands between case-account's and case-authoring's */
  assert.equal(paths.indexOf(path) + 3, paths.indexOf("src/case-authoring/checks.mjs"), paths.join(", "));
  const table = (await import(`../../../${path}`)).CASE_DISCLOSURE_CHECKS;
  assert.deepEqual(Object.values(table).map((r) => r.check).sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1])),
    ["C-120.1", "C-120.2", "C-120.3", "C-120.4", "C-120.5", "C-120.6", "C-120.7", "C-120.8", "C-120.10", "C-120.11", "C-120.12", "C-120.13",
     "C-120.14", "C-120.15", "C-120.16", "C-120.17", "C-120.18", "C-120.19", "C-120.20", "C-120.21", "C-120.22",
     "C-120.23", "C-120.24", "C-120.25", "C-120.26", "C-120.27", "C-120.28", "C-120.29"]);
  for (const [code, row] of Object.entries(table)) assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  /* T38 (N788, DEC-183): C-120.17 re-worded and C-120.19 new, each decorating with the protected words `words.json` holds */
  const WORDS = JSON.parse(readFileSync(join(REPO, "docs/development/ux-substrate/screens/words.json"), "utf8")).words;
  const en = (key) => WORDS.find((w) => w.key === key)?.en;
  for (const [code, check, key] of [["PHOTO_NOT_COVERABLE", "C-120.17", "photo.refused.format"], ["PHOTO_UNCHECKED", "C-120.19", "photo.refused.unchecked"]]) {
    assert.ok(typeof en(key) === "string" && en(key), key);
    assert.deepEqual(M.dec49Row(code), { check, translation: en(key) }, code);
  }
  /* T39 (N806, K2333): C-120.21 and C-120.22 decorate with the drafts case-disclosures holds under the UX stream's keys */
  const { DOCUMENT_WORDS } = await import(`../../../${path}`);
  for (const [code, check, key] of [["DOCUMENT_COPY_PENDING", "C-120.21", "document.refused.pending"], ["DOCUMENT_NOT_CLEANABLE", "C-120.22", "document.refused.clean"]]) {
    assert.ok(typeof DOCUMENT_WORDS[key] === "string" && DOCUMENT_WORDS[key], key);
    assert.deepEqual(M.dec49Row(code), { check, translation: DOCUMENT_WORDS[key] }, code);
  }
  assert.equal(M.dec49Row("DOCUMENT_COPY_UNDETERMINED").check, "C-120.20");
  const CA = await import("../../../src/case-authoring/checks.mjs");
  for (const code of Object.keys(table))
    assert.equal(Object.entries(CA).some(([k, v]) => isFamily(k, v) && Object.hasOwn(v, code)), false, `${code} left case-authoring's file`);
  const held = Object.values(M.CHECK_FAMILIES).flatMap((rows) => Object.values(rows)).map((r) => r.check);
  assert.equal(held.includes("C-120.9"), false, "C-120.9 is withdrawn and never reused (K1275)");
  const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
  assert.ok(missing.includes(`bio-plane/${path} CASE_DISCLOSURE_CHECKS`), missing.join(", "));
});

test("R2, R7 (T33-89; K1581, K1585, K1607, K1609, K1643): the list reads T33's new families in their modules' places, in the order of `build/modules.json` — events' (after entities), local-facts' and standards' (moved into layer 5: local-facts after events, standards after observation-log, which follows connections), money-checks' and duties' C-133 (after progressions, before bias), hypotheses' C-134 (after inquiry), answers' C-135 (after skills and, since T41, question-explorer) and case-tensions' C-92 (moved from publication; directly before publication) — and every one of their translated rows decorates with its own check and words (negative control: the list without any one file misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const order = JSON.parse(readFileSync(join(REPO, "build/modules.json"), "utf8")).modules.map((m) => m.id);
  const owner = (p) => MODULES.find((m) => (m.paths || []).some((q) => `bio-plane/${p}`.startsWith(q.endsWith("/") ? q : `${q}/`) || `bio-plane/${p}` === q));
  /* the whole list is in the module order (a module's files kept together), the module's own last */
  const ranks = paths.map((p) => order.indexOf(owner(p)?.id));
  assert.ok(ranks.every((r) => r >= 0), paths.filter((p, i) => ranks[i] < 0).join(", "));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), paths.join(", "));
  const at = (p) => paths.indexOf(p);
  assert.ok(at("src/entities/checks.mjs") < at("src/events/checks.mjs") && at("src/events/checks.mjs") < at("src/local-facts/checks.mjs"));
  assert.ok(at("src/connections/checks.mjs") < at("src/observation-log/checks.mjs") && at("src/observation-log/checks.mjs") < at("src/standards/checks.mjs")
            && at("src/standards/checks.mjs") < at("src/progressions/checks.mjs"));
  assert.ok(at("src/progressions/checks.mjs") < at("src/money-checks/checks.mjs") && at("src/money-checks/checks.mjs") < at("src/duties/checks.mjs")
            && at("src/duties/checks.mjs") < at("src/bias/checks.mjs"));
  assert.equal(at("src/hypotheses/checks.mjs"), at("src/inquiry/index.mjs") + 1);
  assert.ok(at("src/skilldoctrine.mjs") < at("src/answers/checks.mjs"));
  assert.equal(at("src/answers/checks.mjs"), at("src/question-explorer/checks.mjs") + 1);
  assert.equal(at("src/case-tensions/checks.mjs") + 1, at("src/publication/checks.mjs"));
  for (const [path, fam, checks] of [["src/events/checks.mjs", "EVENT_CHECKS", null],
                                     ["src/money-checks/checks.mjs", "MONEY_CHECKS_CHECKS", null],
                                     ["src/duties/checks.mjs", "DUTIES_CHECKS", /^C-133\.\d+$/],
                                     ["src/hypotheses/checks.mjs", "HYPOTHESES_CHECKS", /^C-134\.\d+$/],
                                     ["src/answers/checks.mjs", "ANSWERS_CHECKS", /^C-135\.\d+$/],
                                     ["src/case-tensions/checks.mjs", "ATTRIBUTION_ACT_CHECKS", /^C-92\.\d+$/]]) {
    const table = (await import(`../../../${path}`))[fam];
    assert.ok(table && Object.keys(table).length >= 2, `${path} ${fam}`);
    let own = 0;
    for (const [code, row] of Object.entries(table)) {
      if (checks) assert.match(row.check, checks, `${fam}.${code}`);
      /* each code decorates with the row of the first source holding it with words (R2's composition): its own, unless an
         earlier module's family holds the same code, which is that family's to keep (DEC-49 arm A) */
      const first = M.CHECK_FAMILY_FILES.flatMap(([, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]?.translation)
        .map(([, v]) => v[code]))[0];
      assert.deepEqual(M.dec49Row(code), { check: first.check ?? null, translation: first.translation }, `${fam}.${code}`);
      if (first === row) own++;
    }
    assert.ok(own >= Object.keys(table).length - 3, `${fam}: ${own} of its rows decorate with its own words`);
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
    assert.ok(missing.includes(`bio-plane/${path} ${fam}`), missing.join(", "));
  }
  /* C-92 is case-tensions' (K1643): publication's file holds none of it */
  const PUB = await import("../../../src/publication/checks.mjs");
  assert.equal(Object.entries(PUB).some(([k, v]) => isFamily(k, v) && Object.keys(v).some((c) => /^ATTRIBUTION_/.test(c))), false);
});

test("R7, R2 (K1961, K1974; red 26): the list reads law-relations' rows (`LAW_RELATIONS_CHECKS`: the nine C-112 rows split from standards, C-112.23, .24, .26–.32, and its own C-112.53) from its own file, directly before standards' (its place in `build/modules.json`), every one of them decorates with its own check and words, and standards' file holds none of them (negative control: the list without law-relations' file misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/law-relations/checks.mjs";
  assert.equal(paths.indexOf(path) + 1, paths.indexOf("src/standards/checks.mjs"), paths.join(", "));
  const order = MODULES.map((m) => m.id);
  assert.equal(order.indexOf("law-relations") + 1, order.indexOf("standards"));
  const table = (await import(`../../../${path}`)).LAW_RELATIONS_CHECKS;
  assert.deepEqual(Object.values(table).map((r) => r.check).sort((a, b) => +a.split(".")[1] - +b.split(".")[1]),
                   ["C-112.23", "C-112.24", "C-112.26", "C-112.27", "C-112.28", "C-112.29", "C-112.30", "C-112.31", "C-112.32", "C-112.53"]);
  for (const [code, row] of Object.entries(table)) {
    assert.match(row.check, /^C-112\.\d+$/, code);
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  }
  const ST = await import("../../../src/standards/checks.mjs");
  for (const code of Object.keys(table))
    assert.equal(Object.entries(ST).some(([k, v]) => isFamily(k, v) && Object.hasOwn(v, code)), false, `${code} left standards' file`);
  const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
  assert.ok(missing.includes(`bio-plane/${path} LAW_RELATIONS_CHECKS`), missing.join(", "));
});

test("R7, R2 (T36; K2130, K2103; red 11; T43: R12, N851): the list reads file-safety's rows (`FILE_SAFETY_CHECKS`, C-140) from its own file, directly after doorbell's (since T43; capture's before it) and before sources' (its place in `build/modules.json`), every one of them decorates with its own check and words, and no row of an earlier family moves: no file-safety code is held by any other listed family, so `FILE_NOT_HELD` decorates with C-140.1 while `NO_SUCH_CAPTURE` keeps sources' row and `MACHINE_CANNOT_RELEASE` ratification's (negative control: the list without file-safety's file misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/file-safety/checks.mjs";
  /* since T53 (K5448) `build/modules.json` puts file-safety directly after capture and before doorbell */
  assert.equal(paths.indexOf("src/capture/checks.mjs") + 1, paths.indexOf(path), paths.join(", "));
  assert.equal(paths.indexOf(path) + 1, paths.indexOf("src/doorbell/checks.mjs"), paths.join(", "));
  const order = MODULES.map((m) => m.id);
  assert.ok(order.indexOf("capture") < order.indexOf("file-safety") && order.indexOf("file-safety") < order.indexOf("doorbell")
            && order.indexOf("doorbell") < order.indexOf("sources"), order.join(", "));
  const table = (await import(`../../../${path}`)).FILE_SAFETY_CHECKS;
  assert.ok(Object.keys(table).length >= 39, String(Object.keys(table).length));
  for (const [code, row] of Object.entries(table)) {
    assert.match(row.check, /^C-140\.\d+$/, code);
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  }
  /* no earlier (or later) family holds a file-safety code, so adding the family moves no other row */
  for (const [p, ns] of M.CHECK_FAMILY_FILES) if (p !== path)
    for (const [k, v] of Object.entries(ns)) if (isFamily(k, v))
      for (const code of Object.keys(table)) assert.equal(Object.hasOwn(v, code), false, `${code} is also in ${p} ${k}`);
  assert.equal(M.dec49Row("FILE_NOT_HELD").check, "C-140.1");
  const own = async (p, code) => { const ns = await import(`../../../${p}`);
    const r = Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]?.translation).map(([, v]) => v[code])[0];
    return { check: r.check ?? null, translation: r.translation }; };
  assert.deepEqual(M.dec49Row("NO_SUCH_CAPTURE"), await own("src/sources/checks.mjs", "NO_SUCH_CAPTURE"));
  assert.deepEqual(M.dec49Row("MACHINE_CANNOT_RELEASE"), await own("src/ratification/checks.mjs", "MACHINE_CANNOT_RELEASE"));
  const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
  assert.ok(missing.includes(`bio-plane/${path} FILE_SAFETY_CHECKS`), missing.join(", "));
});

test("R7, R2 (T37; K2226): the list reads case-carriage's rows (`CASE_CARRIAGE_CHECKS`, C-141, the refusals of `obscuremark` and, since T38, `obscuremarkwithdraw`) from its own file, directly after reevaluation's and before case-tensions' (its place in `build/modules.json`), so the catalogue is total again; every one of its codes decorates with its own check and words, no earlier or later family holding any (T38, K2311: its machine refusal is its own `MACHINE_CANNOT_MARK_PHOTO`, C-141.1), and no row of an earlier family moves: sources' `MACHINE_CANNOT_MARK` keeps C-121.7 (negative control: the list without case-carriage's file misses its family)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/case-carriage/checks.mjs";
  assert.equal(paths.indexOf("src/reevaluation/checks.mjs") + 1, paths.indexOf(path), paths.join(", "));
  assert.equal(paths.indexOf(path) + 1, paths.indexOf("src/case-tensions/checks.mjs"), paths.join(", "));
  const order = MODULES.map((m) => m.id);
  assert.ok(order.indexOf("reevaluation") < order.indexOf("case-carriage") && order.indexOf("case-carriage") < order.indexOf("case-tensions"), order.join(", "));
  /* the catalogue is total with it */
  assert.deepEqual(await unreached(M.CHECK_FAMILY_FILES), []);
  const table = (await import(`../../../${path}`)).CASE_CARRIAGE_CHECKS;
  assert.ok(Object.keys(table).length >= 6, String(Object.keys(table).length));
  const before = M.CHECK_FAMILY_FILES.slice(0, paths.indexOf(path));
  const after = M.CHECK_FAMILY_FILES.slice(paths.indexOf(path) + 1);
  const holders = (files, code) => files.flatMap(([, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]?.translation)
    .map(([, v]) => v[code]));
  for (const [code, row] of Object.entries(table)) {
    assert.match(row.check, /^C-141\.\d+$/, code);
    assert.ok(typeof row.translation === "string" && row.translation, code);
    /* no later family holds it, so adding this family takes no row from one */
    assert.deepEqual(holders(after, code), [], `${code} is also held after case-carriage`);
    assert.deepEqual(holders(before, code), [], `${code} is also held before case-carriage`);
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
  }
  assert.deepEqual(M.dec49Row("MACHINE_CANNOT_MARK_PHOTO"), { check: "C-141.1", translation: table.MACHINE_CANNOT_MARK_PHOTO.translation });
  assert.equal(Object.hasOwn(table, "MACHINE_CANNOT_MARK"), false, "case-carriage no longer holds sources' code (K2311)");
  assert.equal(M.dec49Row("NO_SUCH_PHOTO").check, "C-141.2");
  assert.equal(M.dec49Row("MACHINE_CANNOT_MARK").check, "C-121.7");
  const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
  assert.ok(missing.includes(`bio-plane/${path} CASE_CARRIAGE_CHECKS`), missing.join(", "));
});

/* T41's new families (R10): `[path, family, check prefix, the module before it, the file directly before it, the file
   directly after it]`, each its module's place in `build/modules.json`. */
const T41_FAMILIES = [
  ["src/steps/checks.mjs", "STEPS_CHECKS", "C-142.", "steps", "src/hypotheses/checks.mjs", "src/citation/checks.mjs"],
  ["src/ai-use/checks.mjs", "AI_USE_CHECKS", "C-143.", "ai-use", "src/run-rules/checks.mjs", "src/run-productions/checks.mjs"],
  ["src/reading-guides/checks.mjs", "READING_GUIDES_CHECKS", "C-144.", "reading-guides", "src/capture-requests/checks.mjs", "src/skilldoctrine.mjs"],
  ["src/question-explorer/checks.mjs", "EXPLORE_CHECKS", "C-145.", "question-explorer", "src/skilldoctrine.mjs", "src/answers/checks.mjs"],
  ["src/investigation/checks.mjs", "INVESTIGATION_CHECKS", "C-146.", "investigation", "src/intent/checks.mjs", "src/reevaluation/checks.mjs"],
  ["src/publish-schedule/checks.mjs", "PUBLISH_SCHEDULE_CHECKS", "C-122.5", "publish-schedule", "src/publication/checks.mjs", "src/docket/checks.mjs"],
];
/* The rows of a T41 family whose code an earlier family already holds, which keep that family's row (K2566): since
   N843's re-codings (R11; K2651, K2656) only these two, C-142.28, C-146.21 and C-146.26 having left. `[path, code, its
   own check]`. */
const HELD_EARLIER = [["src/steps/checks.mjs", "NO_SUCH_BUNDLE", "C-142.3"],
                      ["src/investigation/checks.mjs", "NO_SUCH_QUESTION", "C-146.10"]];

test("R10, R11, R7, R2 (T41; K2418, K2480, K2487, K2488, K2532, K2566; N820; T42: N843, K2651, K2656): CHECK_FAMILY_FILES lists T41's new families at their `modules.json` places — steps' C-142 after hypotheses' and before citation's, ai-use's C-143 after run-rules' and before run-productions', reading-guides' C-144 after capture-requests' and before skilldoctrine.mjs, question-explorer's C-145 after skilldoctrine.mjs and before answers', investigation's C-146 after intent's and before reevaluation's, publish-schedule's C-122.5 (moved from publication) directly after publication's and before docket's — so CHECK_FAMILIES is total again; every one of their codes decorates with its own row unless an earlier family holds the code (steps' C-142.3 and investigation's C-146.10 alone since N843's re-codings, R11), no later family holds a code one of them decorates, and no code decorated before them moves (negative control: the list without any one of the six files misses its family, and the totality test fails)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const at = (p) => paths.indexOf(p);
  const order = MODULES.map((m) => m.id);
  /* the catalogue is total with them */
  assert.deepEqual(await unreached(M.CHECK_FAMILY_FILES), []);
  const holders = (files, code) => files.flatMap(([, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]?.translation)
    .map(([, v]) => v[code]));
  const keptEarlier = [];
  for (const [path, fam, prefix, id, before, after] of T41_FAMILIES) {
    /* its place: directly between its neighbours in the list, and its module between theirs in `modules.json` */
    assert.ok(at(path) > 0, path);
    assert.equal(at(before) + 1, at(path), `${path} directly after ${before}: ${paths.join(", ")}`);
    assert.equal(at(path) + 1, at(after), `${path} directly before ${after}: ${paths.join(", ")}`);
    const owner = (p) => MODULES.find((m) => (m.paths || []).some((q) => `bio-plane/${p}` === q || `bio-plane/${p}`.startsWith(q)))?.id;
    assert.equal(owner(path), id, path);
    assert.ok(order.indexOf(owner(before)) < order.indexOf(id) && order.indexOf(id) < order.indexOf(owner(after)), `${id} in modules.json`);
    /* its rows: each its own family's check, and each decorates with its own row unless an earlier family holds the code */
    const ns = M.CHECK_FAMILY_FILES[at(path)][1];
    const table = ns[fam];
    assert.ok(table && Object.keys(table).length >= 1, `${path} ${fam}`);
    const earlier = M.CHECK_FAMILY_FILES.slice(0, at(path)), later = M.CHECK_FAMILY_FILES.slice(at(path) + 1);
    for (const [code, row] of Object.entries(table)) {
      assert.ok(row.check.startsWith(prefix), `${fam}.${code} ${row.check}`);
      assert.ok(typeof row.translation === "string" && row.translation, code);
      const first = holders(earlier, code)[0];
      if (first) {
        keptEarlier.push(`${path} ${code} ${row.check}`);
        assert.deepEqual(M.dec49Row(code), { check: first.check ?? null, translation: first.translation }, `${code} keeps the earlier row`);
        assert.notEqual(M.dec49Row(code).check, row.check, code);
      } else {
        /* it takes no row from a later family */
        assert.deepEqual(holders(later, code), [], `${code} is also held after ${path}`);
        assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, `${fam}.${code}`);
      }
    }
    /* negative control: the list without its file misses its family, and the totality arm sees it */
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
    assert.ok(missing.includes(`bio-plane/${path} ${fam}`), `without ${path}: ${missing.join(", ")}`);
  }
  /* exactly the codes K2566 names that N843 did not re-code keep an earlier family's row (R11) */
  assert.deepEqual(keptEarlier.sort(), HELD_EARLIER.map((h) => h.join(" ")).sort());
  /* C-122.5 moved: publish-schedule's row decorates it, and publication's file holds it no longer */
  const PUB = await import("../../../src/publication/checks.mjs");
  assert.equal(Object.entries(PUB).some(([k, v]) => isFamily(k, v) && Object.hasOwn(v, "SCHEDULED_CHECK_UNAVAILABLE")), false);
  assert.equal(M.dec49Row("SCHEDULED_CHECK_UNAVAILABLE").check, "C-122.5");
  /* no code decorated without the six moves: the list without all six decorates every other code exactly as with them */
  const six = new Set(T41_FAMILIES.map(([p]) => p));
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => !six.has(p));
  for (const rows of Object.values(M.CHECK_FAMILIES))
    for (const code of Object.keys(rows)) {
      const was = holders(without, code)[0];
      if (was) assert.deepEqual(M.dec49Row(code), { check: was.check ?? null, translation: was.translation }, `${code} moved`);
    }
  /* negative control: the totality test fails with any one of them left out */
  const [one] = T41_FAMILIES;
  assert.notDeepEqual(await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== one[0])), []);
});

/* R11's re-coded rows (N843): `[path, family, code, its check, the code it held before, the earlier code's own row]`. */
const N843 = [
  ["src/hypotheses/checks.mjs", "HYPOTHESES_CHECKS", "HYPOTHESIS_PROPOSAL_NO_RUN", "C-134.22", "PROPOSAL_NO_RUN", "C-124.47"],
  ["src/hypotheses/checks.mjs", "HYPOTHESES_CHECKS", "NO_SUCH_HYPOTHESIS_PROPOSAL", "C-134.23", "NO_SUCH_PROPOSAL", "C-111.22"],
  ["src/steps/checks.mjs", "STEPS_CHECKS", "NO_SUCH_STEP_PROPOSAL", "C-142.28", "NO_SUCH_PROPOSAL", "C-111.22"],
  ["src/investigation/checks.mjs", "INVESTIGATION_CHECKS", "NO_SUCH_PLANNING_PROPOSAL", "C-146.21", "NO_SUCH_PROPOSAL", "C-111.22"],
  ["src/investigation/checks.mjs", "INVESTIGATION_CHECKS", "INTERVIEW_NOT_A_LEG", "C-146.26", "NARRATIVE_NOT_A_LEG", "C-134.28"],
];

test("R11 (T42; N843, K238, K2566, K2651, K2656; R7, R10): N843's re-codings decorate with their own families' rows — C-134.22 HYPOTHESIS_PROPOSAL_NO_RUN, C-134.23 NO_SUCH_HYPOTHESIS_PROPOSAL, C-142.28 NO_SUCH_STEP_PROPOSAL, C-146.21 NO_SUCH_PLANNING_PROPOSAL, C-146.26 INTERVIEW_NOT_A_LEG, each held by its own family alone, no other listed family holding the code; none of the three families holds the code it held before, so PROPOSAL_NO_RUN (C-124.47) and NO_SUCH_PROPOSAL (C-111.22) read R7's pinned rows again (check and translation digest) and NARRATIVE_NOT_A_LEG keeps hypotheses' C-134.28; of R10's rows an earlier family held only C-142.3 and C-146.10 stay; the snapshot's changed.note names the five re-codings and no longer names the two codes red (negative control: an earlier family holding a re-coded code would take its row, and the comparison sees it)", async () => {
  const { createHash } = await import("node:crypto");
  const SNAP = JSON.parse(readFileSync(new URL("./rows-before-r43.json", import.meta.url), "utf8"));
  const digest = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
  const holders = (files, code) => files.flatMap(([p, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]?.translation)
    .map(([k, v]) => [p, k, v[code]]));
  const listed = new Map(M.CHECK_FAMILY_FILES.map(([p, ns]) => [p, ns]));
  for (const [path, fam, code, check, was, wasCheck] of N843) {
    const own = listed.get(path)?.[fam]?.[code];
    assert.ok(own && own.check === check && typeof own.translation === "string" && own.translation, `${path} ${fam}.${code}`);
    /* its own family's row, and no other listed family holds the code */
    assert.deepEqual(holders(M.CHECK_FAMILY_FILES, code).map(([p, k]) => `${p} ${k}`), [`${path} ${fam}`], code);
    assert.deepEqual(M.dec49Row(code), { check, translation: own.translation }, code);
    /* the code it held before has left its family, and decorates with its earlier owner's row */
    assert.equal(Object.entries(listed.get(path)).some(([k, v]) => isFamily(k, v) && Object.hasOwn(v, was)), false, `${was} left ${path}`);
    assert.equal(M.dec49Row(was).check, wasCheck, was);
    assert.notEqual(M.dec49Row(was).check, check, was);
  }
  /* the two pins of rule 4 (6): R7's pinned rows again, check and words */
  for (const code of ["PROPOSAL_NO_RUN", "NO_SUCH_PROPOSAL"]) {
    assert.ok(SNAP.rows[code], code);
    const got = M.dec49Row(code);
    assert.deepEqual([got.check, digest(got.translation)], SNAP.rows[code], code);
  }
  assert.deepEqual([SNAP.rows.PROPOSAL_NO_RUN[0], SNAP.rows.NO_SUCH_PROPOSAL[0]], ["C-124.47", "C-111.22"]);
  /* R10's rows an earlier family holds: C-142.3 and C-146.10 stay, and only they */
  assert.deepEqual(HELD_EARLIER.map(([, , c]) => c), ["C-142.3", "C-146.10"]);
  for (const [path, code, check] of HELD_EARLIER) {
    const first = holders(M.CHECK_FAMILY_FILES, code)[0];
    assert.notEqual(first[0], path, code);
    assert.notEqual(M.dec49Row(code).check, check, code);
  }
  /* the snapshot's note: the five re-codings named, the sentence naming the two codes red gone */
  const note = SNAP.changed.note;
  for (const [, , code, check] of N843) assert.ok(note.includes(`${check} ${code}`), `${check} ${code} in changed.note`);
  assert.equal(/red by name \(T41 rule 4 \(21\)\)/.test(note), false, "the red sentence is replaced");
  assert.equal(/are not re-pinned/.test(note), false, "the red sentence is replaced");
  /* negative control: a family listed earlier holding a re-coded code would take its row, and the comparison sees it */
  const intruder = ["src/record-grammar/acts.mjs", { INTRUDER_CHECKS: { NO_SUCH_STEP_PROPOSAL: { check: "C-0.1", translation: "x" } } }];
  const withIntruder = [intruder, ...M.CHECK_FAMILY_FILES];
  assert.notDeepEqual(holders(withIntruder, "NO_SUCH_STEP_PROPOSAL").map(([p, k]) => `${p} ${k}`), ["src/steps/checks.mjs STEPS_CHECKS"]);
  assert.equal(holders(withIntruder, "NO_SUCH_STEP_PROPOSAL")[0][2].check, "C-0.1");
});

/* R12's rows (N851): the codes doorbell's family holds (nine at T43; C-85.6 since T53, doorbell R31), `[family, code, check]`. */
const DOORBELL_ROWS = [
  ["KNOCK_CHECKS", "RATE_IP", "C-85.1"], ["KNOCK_CHECKS", "RATE_GLOBAL", "C-85.2"],
  ["KNOCK_CHECKS", "KNOCK_ENVELOPE_TOO_LARGE", "C-85.3"], ["KNOCK_CHECKS", "KNOCK_PAYLOAD_TOO_LARGE", "C-85.4"],
  ["KNOCK_CHECKS", "KNOCK_EMPTY", "C-85.5"], ["KNOCK_CHECKS", "KNOCK_BYTES_CHANGED", "C-85.6"],
  ["DOORBELL_CHECKS", "NO_SUCH_KNOCK", "C-118.2"], ["DOORBELL_CHECKS", "KNOCKER_SECRET_WEAK", "C-118.3"],
  ["DOORBELL_CHECKS", "KNOCK_DISCARDED", "C-118.4"], ["DOORBELL_CHECKS", "RESOLVE_NO_REASON", "C-118.7"],
];

/* C-118.7 `RESOLVE_NO_REASON` (DEC-88) came after the snapshot: its check and the digest of the translation capture's
   table held for it on `main` at T43's opening (0b28d3b32d), which doorbell's row keeps. */
const AFTER_SNAPSHOT = { RESOLVE_NO_REASON: ["C-118.7", "f109af9836597e65"] };
/* C-85.6 `KNOCK_BYTES_CHANGED` (doorbell R31, T53; DEC-479, K5693) was minted after the snapshot and after T43's opening:
   no earlier decoration to pin, so it is held to doorbell's own row alone. */
const UNPINNED = new Set(["KNOCK_BYTES_CHANGED"]);

test("R12, R7, R2 (T43; N851, K2609, K2697): CHECK_FAMILY_FILES lists doorbell's file (`DOORBELL_CHECKS`, `KNOCK_CHECKS`) directly after capture's and before file-safety's, its place in `build/modules.json`, so the catalogue is total again; C-85.1–C-85.5 and C-118.2, .3, .4, .7 are held by doorbell's family alone and each decorates with the code, check and translation R7 pins, read from doorbell's family; no other code moves (negative controls: the list without doorbell's file misses its two families and leaves the nine codes bare, and a code of capture's family still decorates from capture's)", async () => {
  const { createHash } = await import("node:crypto");
  const SNAP = JSON.parse(readFileSync(new URL("./rows-before-r43.json", import.meta.url), "utf8"));
  const digest = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/doorbell/checks.mjs";
  /* its place in `modules.json`: since T53 (K5448) directly after file-safety's, which follows capture's */
  assert.equal(paths.indexOf("src/file-safety/checks.mjs") + 1, paths.indexOf(path), paths.join(", "));
  assert.ok(paths.indexOf("src/capture/checks.mjs") < paths.indexOf(path) && paths.indexOf(path) < paths.indexOf("src/sources/checks.mjs"), paths.join(", "));
  const order = MODULES.map((m) => m.id);
  assert.equal(order.indexOf("capture") + 1, order.indexOf("file-safety"), order.join(", "));
  assert.equal(order.indexOf("file-safety") + 1, order.indexOf("doorbell"), order.join(", "));
  assert.ok(MODULES.find((m) => m.id === "answer-envelope").uses.includes("doorbell"), "answer-envelope uses doorbell");
  /* the catalogue is total with it */
  assert.deepEqual(await unreached(M.CHECK_FAMILY_FILES), []);
  const DB = M.CHECK_FAMILY_FILES[paths.indexOf(path)][1];
  assert.equal(DB, await import(`../../../${path}`));
  /* exactly its rows, in their two families */
  const own = Object.entries(DB).filter(([k, v]) => isFamily(k, v)).flatMap(([k, v]) => Object.entries(v).map(([c, r]) => [k, c, r.check]));
  assert.deepEqual(own.map((x) => x.join(" ")).sort(), DOORBELL_ROWS.map((x) => x.join(" ")).sort());
  const holders = (files, code) => files.flatMap(([p, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && Object.hasOwn(v, code))
    .map(([k]) => `${p} ${k}`));
  for (const [fam, code, check] of DOORBELL_ROWS) {
    const row = DB[fam][code];
    /* doorbell's family alone holds the code: capture's file and every other listed file hold none of the nine */
    assert.deepEqual(holders(M.CHECK_FAMILY_FILES, code), [`${path} ${fam}`], code);
    /* the composed catalogue keeps doorbell's row, by identity */
    assert.equal(M.CHECK_FAMILIES[fam][code], row, code);
    /* R7's pin: the same check and translation the door decorated before (the snapshot's, or for C-118.7, minted after
       it under DEC-88, the row capture's table held at T43's opening) */
    const pin = SNAP.rows[code] ?? AFTER_SNAPSHOT[code];
    assert.ok(pin || UNPINNED.has(code), `${code} is pinned`);
    assert.deepEqual(M.dec49Row(code), { check, translation: row.translation }, code);
    if (pin) assert.deepEqual([M.dec49Row(code).check, digest(M.dec49Row(code).translation)], pin, code);
    /* and what the door puts on the wire */
    assert.deepEqual(M.dec49Attach({ ok: false, reason: code }), { ok: false, reason: code, code, check, translation: row.translation }, code);
  }
  /* no other code moves: without doorbell's file every other code decorates exactly as with it */
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => p !== path);
  const nine = new Set(DOORBELL_ROWS.map(([, c]) => c));
  for (const rows of Object.values(M.CHECK_FAMILIES))
    for (const code of Object.keys(rows)) if (!nine.has(code)) {
      const was = without.flatMap(([, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]?.translation).map(([, v]) => v[code]))[0];
      if (was) assert.deepEqual(M.dec49Row(code), { check: was.check ?? null, translation: was.translation }, `${code} moved`);
    }
  /* negative control: the list without doorbell's file misses its two families, and the nine codes would go bare */
  const missing = await unreached(without);
  assert.deepEqual(missing.filter((m) => m.startsWith(`bio-plane/${path} `)).sort(),
                   [`bio-plane/${path} DOORBELL_CHECKS`, `bio-plane/${path} KNOCK_CHECKS`]);
  for (const code of nine) assert.deepEqual(holders(without, code), [], `${code} held without doorbell's file`);
  /* control: a code of capture's family still decorates from capture's */
  const CAP = M.CHECK_FAMILY_FILES[paths.indexOf("src/capture/checks.mjs")][1];
  for (const code of ["EVIDENCE_NOT_HELD", ...Object.keys(CAP.CAPTURE_CHECKS)]) {
    const row = CAP.CAPTURE_CHECKS[code];
    assert.ok(row, code);
    assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
    assert.equal(M.CHECK_FAMILIES.CAPTURE_CHECKS[code], row, code);
  }
  assert.equal(M.dec49Row("EVIDENCE_NOT_HELD").check, "C-118.1");
});

/* T45's new families (T45-49; K2834): `[path, family, check prefix, module, the file directly before it, the file directly
   after it]`, each its module's place in `build/modules.json`. action-producers' C-152 joins when its file exists (BOB's
   CHANGE). */
const T45_FAMILIES = [
  ["src/case-account/checks.mjs", "CASE_ACCOUNT_CHECKS", "C-153.", "case-account", "src/case-disclosures/checks.mjs", "src/case-inputs/checks.mjs"],
  ["src/case-check/checks.mjs", "CASE_CHECK_CHECKS", "C-148.", "case-check", "src/review/checks.mjs", "src/conformance/checks.mjs"],
  ["src/action-holds/checks.mjs", "ACTION_HOLDS_CHECKS", "C-149.", "action-holds", "src/action-grammar/checks.mjs", "src/action-clocks/checks.mjs"],
  ["src/action-replies/checks.mjs", "ACTION_REPLY_CHECKS", "C-150.", "action-replies", "src/action-clocks/checks.mjs", "src/filing-templates/checks.mjs"],
  ["src/plan-work/checks.mjs", "PLAN_WORK_CHECKS", "C-151.", "plan-work", "src/action-plans/checks.mjs", "src/monitoring/checks.mjs"],
];

test("R7, R2 (T45-49; K2834, K2845, K2859): CHECK_FAMILY_FILES lists T45's new families at their `modules.json` places — case-account's C-153 directly after case-disclosures' and before case-inputs' (since T47, R15; case-authoring's after it), case-check's C-148 after review's and before conformance's, action-holds' C-149 after action-grammar's (actions holding no file) and before action-clocks', action-replies' C-150 after action-clocks' and before filing-templates', plan-work's C-151 after action-plans' and before monitoring's — so CHECK_FAMILIES is total again; every one of their codes decorates with its own family's row unless an earlier family holds the code, no later family holds a code one of them decorates, the moved PRESSURE_MARKED and PRESSURE_NO_ENTRY read C-149.6 and C-149.7, and no code decorated without them moves (negative control: the list without any one of the five files misses its family, and the totality test fails)", async () => {
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const at = (p) => paths.indexOf(p);
  const order = MODULES.map((m) => m.id);
  const owner = (p) => MODULES.find((m) => (m.paths || []).some((q) => `bio-plane/${p}` === q || `bio-plane/${p}`.startsWith(q)))?.id;
  /* the catalogue is total with them */
  assert.deepEqual(await unreached(M.CHECK_FAMILY_FILES), []);
  const holders = (files, code) => files.flatMap(([, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && v[code]?.translation)
    .map(([, v]) => v[code]));
  const keptEarlier = [];
  for (const [path, fam, prefix, id, before, after] of T45_FAMILIES) {
    /* its place: directly between its neighbours in the list, its module between theirs in `modules.json` */
    assert.equal(at(before) + 1, at(path), `${path} directly after ${before}: ${paths.join(", ")}`);
    assert.equal(at(path) + 1, at(after), `${path} directly before ${after}: ${paths.join(", ")}`);
    assert.equal(owner(path), id, path);
    assert.ok(order.indexOf(owner(before)) < order.indexOf(id) && order.indexOf(id) < order.indexOf(owner(after)), `${id} in modules.json`);
    assert.ok(MODULES.find((m) => m.id === "answer-envelope").uses.includes(id), `answer-envelope uses ${id}`);
    /* the list reads the module's own file, the namespace its index re-exports from */
    const ns = M.CHECK_FAMILY_FILES[at(path)][1];
    assert.equal(ns, await import(`../../../${path}`), path);
    const table = ns[fam];
    assert.ok(table && Object.keys(table).length >= 1, `${path} ${fam}`);
    const earlier = M.CHECK_FAMILY_FILES.slice(0, at(path)), later = M.CHECK_FAMILY_FILES.slice(at(path) + 1);
    for (const [code, row] of Object.entries(table)) {
      assert.ok(row.check.startsWith(prefix), `${fam}.${code} ${row.check}`);
      assert.ok(typeof row.translation === "string" && row.translation, code);
      const first = holders(earlier, code)[0];
      if (first) {
        keptEarlier.push(`${path} ${code}`);
        assert.deepEqual(M.dec49Row(code), { check: first.check ?? null, translation: first.translation }, `${code} keeps the earlier row`);
      } else {
        assert.deepEqual(holders(later, code), [], `${code} is also held after ${path}`);
        assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, `${fam}.${code}`);
        assert.equal(M.CHECK_FAMILIES[fam][code], row, `${fam}.${code} by identity`);
        assert.deepEqual(M.dec49Attach({ ok: false, reason: code }), { ok: false, reason: code, code, check: row.check, translation: row.translation }, code);
      }
    }
    /* negative control: the list without its file misses its family */
    const missing = await unreached(M.CHECK_FAMILY_FILES.filter(([p]) => p !== path));
    assert.ok(missing.includes(`bio-plane/${path} ${fam}`), `without ${path}: ${missing.join(", ")}`);
  }
  /* none of T45's codes is held by an earlier family */
  assert.deepEqual(keptEarlier, []);
  /* the moved rows (K2845, K2859): action-holds' alone, at their new numbers */
  for (const [code, check] of [["PRESSURE_MARKED", "C-149.6"], ["PRESSURE_NO_ENTRY", "C-149.7"]]) {
    assert.equal(M.dec49Row(code).check, check, code);
    assert.equal(holders(M.CHECK_FAMILY_FILES, code).length, 1, code);
  }
  /* no code decorated without the five moves: the list without all five decorates every other code exactly as with them */
  const five = new Set(T45_FAMILIES.map(([p]) => p));
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => !five.has(p));
  const theirs = new Set(T45_FAMILIES.flatMap(([p, f]) => Object.keys(M.CHECK_FAMILY_FILES[at(p)][1][f])));
  for (const rows of Object.values(M.CHECK_FAMILIES))
    for (const code of Object.keys(rows)) {
      const was = holders(without, code)[0];
      if (was) assert.deepEqual(M.dec49Row(code), { check: was.check ?? null, translation: was.translation }, `${code} moved`);
      else if (M.dec49Row(code)) assert.ok(theirs.has(code), `${code} decorates only with a T45 family`);
    }
  /* negative control: the totality test fails with any one of them left out */
  for (const [p] of T45_FAMILIES) assert.notDeepEqual(await unreached(M.CHECK_FAMILY_FILES.filter(([q]) => q !== p)), []);
});

/* R15's rows (N908 §5; case-inputs R12): `[family, check prefix]`; C-82.2–C-82.8 pinned by R7's snapshot. */
const CASE_INPUTS_FAMILIES = [["STATEMENT_ACK_CHECKS", /^C-82\.[2-8]$/], ["CARRIED_OUTCOME_CHECKS", /^C-136\.[3-8]$/]];

test("R15, R7, R2 (T47; N908 §5; case-inputs R12, R17): CHECK_FAMILY_FILES reads case-inputs' file (`STATEMENT_ACK_CHECKS` C-82.2–C-82.8, `CARRIED_OUTCOME_CHECKS` C-136.3–C-136.8) directly before case-authoring's (after case-account's), its place in `build/modules.json`, so the catalogue is total again; every one of its codes is held by its family alone and decorates with its own check and translation, the pinned C-82 rows reading R7's pins; action-records holds no family and has no entry; control: every code R7 pins other than C-136.5 (pinned by none) decorates as before (negative control: the list without case-inputs' file misses its two families and leaves its codes bare)", async () => {
  const { createHash } = await import("node:crypto");
  const SNAP = JSON.parse(readFileSync(new URL("./rows-before-r43.json", import.meta.url), "utf8"));
  const digest = (x) => createHash("sha256").update(x).digest("hex").slice(0, 16);
  const paths = M.CHECK_FAMILY_FILES.map(([p]) => p);
  const path = "src/case-inputs/checks.mjs";
  /* its place: directly between case-account's and case-authoring's, as case-inputs stands between them in modules.json */
  assert.equal(paths.indexOf("src/case-account/checks.mjs") + 1, paths.indexOf(path), paths.join(", "));
  assert.equal(paths.indexOf(path) + 1, paths.indexOf("src/case-authoring/checks.mjs"), paths.join(", "));
  const order = MODULES.map((m) => m.id);
  assert.ok(order.indexOf("case-account") < order.indexOf("case-inputs") && order.indexOf("case-inputs") < order.indexOf("case-authoring"), order.join(", "));
  assert.ok(MODULES.find((m) => m.id === "answer-envelope").uses.includes("case-inputs"), "answer-envelope uses case-inputs");
  /* action-records holds no family of its own (action-records R14) */
  assert.equal(paths.some((p) => p.startsWith("src/action-records/")), false);
  /* the catalogue is total with it, and reads the module's own file */
  assert.deepEqual(await unreached(M.CHECK_FAMILY_FILES), []);
  const CI = M.CHECK_FAMILY_FILES[paths.indexOf(path)][1];
  assert.equal(CI, await import(`../../../${path}`));
  const holders = (files, code) => files.flatMap(([p, ns]) => Object.entries(ns).filter(([k, v]) => isFamily(k, v) && Object.hasOwn(v, code))
    .map(([k]) => `${p} ${k}`));
  const codes = new Set();
  assert.deepEqual(Object.entries(CI).filter(([k, v]) => isFamily(k, v)).map(([k]) => k).sort(), CASE_INPUTS_FAMILIES.map(([f]) => f).sort());
  for (const [fam, prefix] of CASE_INPUTS_FAMILIES) {
    const table = CI[fam];
    assert.ok(Object.keys(table).length >= 6, fam);
    for (const [code, row] of Object.entries(table)) {
      codes.add(code);
      assert.match(row.check, prefix, `${fam}.${code}`);
      assert.ok(typeof row.translation === "string" && row.translation, code);
      assert.deepEqual(holders(M.CHECK_FAMILY_FILES, code), [`${path} ${fam}`], code);
      assert.equal(M.CHECK_FAMILIES[fam][code], row, `${fam}.${code} by identity`);
      assert.deepEqual(M.dec49Row(code), { check: row.check, translation: row.translation }, code);
      assert.deepEqual(M.dec49Attach({ ok: false, reason: code }), { ok: false, reason: code, code, check: row.check, translation: row.translation }, code);
      if (SNAP.rows[code]) assert.deepEqual([row.check, digest(row.translation)], SNAP.rows[code], `${code} reads R7's pin`);
    }
  }
  /* the C-82 rows are pinned, every one of them */
  for (const code of Object.keys(CI.STATEMENT_ACK_CHECKS)) if (CI.STATEMENT_ACK_CHECKS[code].check !== "C-82.8") assert.ok(SNAP.rows[code], `${code} pinned`);
  assert.equal(Object.values(SNAP.rows).some(([c]) => /^C-136\./.test(c)), false, "no C-136 row is pinned");
  /* control: every other pinned code decorates exactly as pinned */
  for (const [code, pin] of Object.entries(SNAP.rows)) if (!codes.has(code)) {
    const got = M.dec49Row(code);
    assert.deepEqual(got ? [got.check, digest(got.translation)] : null, pin, code);
  }
  /* negative control: without the file its two families are unreached and its codes bare */
  const without = M.CHECK_FAMILY_FILES.filter(([p]) => p !== path);
  const missing = (await unreached(without)).filter((m) => m.startsWith(`bio-plane/${path} `)).sort();
  assert.deepEqual(missing, CASE_INPUTS_FAMILIES.map(([f]) => `bio-plane/${path} ${f}`).sort());
  for (const code of codes) assert.deepEqual(holders(without, code), [], code);
});
