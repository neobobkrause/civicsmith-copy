/* case-checker, fix round 6, G50 (K4688): a source captured more than once is several rows of the `materials:` block with one
   `ref`; `bio-case-file/4` (`case-grammar` R13) spells each row's files at its own path, `materials/<ref>/<sha>/<leaf>`, and
   this checker reads each row's file by its capture (R2, R8, R19) and specifies the format (R14). Every case file here is made
   by `public-read`'s real writer, `buildCaseFile` (`./g50-build.mjs`). The tests that need the providers' change (case-grammar's
   path and format, public-read's writer) are red by name until both have merged (R-SEAM); the controls are green now: the
   verdicts recorded at the base (`g50-old-verdicts.json`, made by `make-g50-goldens.mjs`) are byte-equal after the change, and
   a format this checker does not hold departs at `format`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as CC from "../../../src/case-checker/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { canonicalJson } from "../../../src/record-grammar/json.mjs";
import { caseFile, gradingFacts, extracted, sha, A, B, C, MINUTES, MINUTES_SHA, OBSCURED_LABEL } from "./fixture.mjs";
import { buildG50, baseMaterials, u8 } from "./g50-build.mjs";

const V4 = "bio-case-file/4";
const results = (answer) => Object.fromEntries(answer.findings.map((f) => [f.finding, f.result]));
const ALL = { [A]: "recreated", [C]: "recreated", [B]: "recreated" };

/* ---- two included captures of one ref: the second capture in path order is the one a passage is quoted from */
const OTHER_UNITS = [{ extent: { kind: "pdf-page", page: 0 }, ref: "page 1", text: "Item 7 was tabled to the next meeting." }];
const otherBytes = (() => { for (let n = 0; ; n++) { const b = `%PDF-1.7 the minutes, captured again (${n})`; if (sha(b) < MINUTES_SHA) return b; } })();
const OTHER_SHA = sha(otherBytes);
const twoCaptures = {
  fixture: { materialRows: (rows) => [rows[0], { ref: MINUTES, kind: "document", sha: OTHER_SHA, text_sha: sha(extracted(OTHER_UNITS)),
    origin: "https://records.example/minutes-again", archived_copy: null, included: true, rests_under: "load_bearing" }, ...rows.slice(1)] },
  materials: (texts) => {
    const [minutes, ...rest] = baseMaterials(texts);
    return [{ ...minutes, capture: MINUTES_SHA },
            { ref: MINUTES, kind: "document", sha: OTHER_SHA, text_sha: sha(extracted(OTHER_UNITS)), bytes_text: otherBytes, extracted_text: extracted(OTHER_UNITS), capture: OTHER_SHA },
            ...rest];
  },
};

test("R2 R8 R19 (G50): two included captures of one ref are each read by their own capture: the passage quoted only in the later capture's text is found there, and the case recreates", async () => {
  const { built, parts, manifest } = await buildG50(twoCaptures);
  assert.equal(built.ok, true);
  assert.equal(manifest.format, V4);
  const read = CC.readCaseFile(parts);
  assert.deepEqual(read.departures, []);
  const texts = read.files.filter((f) => f.kind === "extracted_text" && f.ref === MINUTES);
  assert.deepEqual(texts.map((f) => f.capture).sort(), [OTHER_SHA, MINUTES_SHA].sort());
  assert.ok(texts.every((f) => f.state === "intact"));
  /* every path of the one-row refs states no capture */
  assert.ok(read.files.filter((f) => f.ref && f.ref !== MINUTES).every((f) => f.capture === null));
  const r = await CC.checkCaseFile({ parts });
  assert.equal(r.integrity.intact, true, JSON.stringify(r.integrity.departures));
  assert.deepEqual(results(r), ALL);
  assert.ok(r.findings.every((f) => f.differs.length === 0 && f.missing.length === 0));
  assert.equal(r.complete_edition.equal, true, r.complete_edition.detail);
});

test("R2 R8 (G50): a carried capture is read by its row: the earlier capture's text, carried with other bytes, is that capture's alone; the passage's capture is still found", async () => {
  const { manifest, parts } = await buildG50({ ...twoCaptures, edit: (carried, built) => {
    const p = built.manifest.files.find((f) => f.kind === "extracted_text" && f.sha256 === sha(extracted(OTHER_UNITS))).path;
    carried.set(p, u8("not the text the row names"));
  } });
  const r = await CC.checkCaseFile({ parts });
  const other = manifest.files.find((f) => f.sha256 === sha(extracted(OTHER_UNITS)));
  /* the chain reaches only the capture the leg names, so the other capture's tampered file is a case-level difference of the
     file itself (R2) and no finding's passage is lost */
  assert.equal(r.integrity.files.find((f) => f.path === other.path).state, "differs");
  assert.equal(r.integrity.intact, false);
  assert.ok(r.findings.every((f) => !f.differs.some((e) => e.check === "passage")));
});

/* ---- two copies of one ref */
const PHOTO = "INFO-2026-0070-photo";
const PA = sha("the first capture of the photo"), PB = sha("the second capture of the photo");
const COPY_A = "%PDF-1.7 the first photo, faces covered", COPY_B = "%PDF-1.7 the second photo, plates covered";
const twoCopies = (over = {}) => ({
  fixture: { facts: (() => { const f = gradingFacts();
      f[A].legs.push({ target: PHOTO, kind: "document", role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture", ground: null, captures: [PA, PB] });
      return f; })(),
    materialRows: (rows) => [...rows, ...[[PA, COPY_A], [PB, COPY_B]].map(([s, copy]) => ({ ref: PHOTO, kind: "document", sha: s, text_sha: null,
      origin: "a member's photograph", archived_copy: null, included: false, rests_under: "load_bearing", obscured: { copy: sha(copy), label: OBSCURED_LABEL } }))] },
  obscured: [{ ref: PHOTO, sha: PA, bytes: COPY_A, capture: PA }, { ref: PHOTO, sha: PB, bytes: COPY_B, capture: PB }],
  ...over,
});
const pathOf = (manifest, bytes) => manifest.files.find((f) => f.sha256 === sha(bytes)).path;

test("R8 R19 (G50): two copies of one ref are each found by their row, and the answer states both", async () => {
  const { built, parts, manifest } = await buildG50(twoCopies());
  assert.equal(built.ok, true);
  assert.equal(manifest.format, V4);
  assert.notEqual(pathOf(manifest, COPY_A), pathOf(manifest, COPY_B));
  const r = await CC.checkCaseFile({ parts });
  assert.deepEqual(r.integrity.departures, []);
  assert.deepEqual(results(r), ALL);
  assert.deepEqual(r.obscured.map((o) => [o.ref, o.sha, o.copy]), [[PHOTO, PA, sha(COPY_A)], [PHOTO, PB, sha(COPY_B)]]);
});

test("R2 R8 (G50): a tampered copy B is reported against B only; a copy A not carried is missing for A alone", async () => {
  const bad = await buildG50(twoCopies({ edit: (carried, built) => carried.set(pathOf(built.manifest, COPY_B), u8("tampered")) }));
  const pathA = pathOf(bad.manifest, COPY_A), pathB = pathOf(bad.manifest, COPY_B);
  const r = await CC.checkCaseFile({ parts: bad.parts });
  const lead = r.findings.find((f) => f.finding === A);
  assert.equal(lead.result, "did_not_recreate");
  assert.ok(lead.differs.some((e) => e.check === "integrity" && e.about === pathB && e.sha256 === sha(COPY_B)));
  assert.equal(lead.differs.some((e) => e.about === pathA), false);
  assert.equal(r.integrity.files.find((f) => f.path === pathA).state, "intact");
  assert.equal(r.integrity.files.find((f) => f.path === pathB).state, "differs");
  const gone = await buildG50(twoCopies({ edit: (carried, built) => carried.delete(pathOf(built.manifest, COPY_A)) }));
  const g = await CC.checkCaseFile({ parts: gone.parts });
  const lead2 = g.findings.find((f) => f.finding === A);
  assert.equal(lead2.result, "recreated_in_part");
  assert.deepEqual(lead2.missing.filter((e) => e.copy).map((e) => e.copy), [sha(COPY_A)]);
});

test("R14 (G50): the specification of bio-case-file/4 is held, names its format, the capture path and the five departures, and keeps every rule of /3", () => {
  const SPEC = CC.CASE_FILE_SPECS[V4];
  assert.ok(SPEC.startsWith(`# The case file, format ${V4}\n`));
  assert.ok(SPEC.includes(`\`format\`: \`${V4}\`.`));
  assert.ok(SPEC.includes("`materials/<ref>/<sha>/<leaf>`"));
  assert.ok(SPEC.includes("`materials/<ref>/<sha>/obscured`"));
  const named = new Set([...SPEC.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
  for (const d of ["path_format", "format_unused", "capture_missing", "capture_needless", "capture_unnamed", "path_twice"]) assert.ok(named.has(d), d);
  for (const h of ["Integrity", "Signatures", "Passages", "Grades", "The bar", "Publication checks", "Presentability", "Completion",
                   "The complete edition", "Another team's work", "Calculations", "Standards' use"]) assert.match(SPEC, new RegExp(`\\n\\d+\\. ${h}\\.`), h);
  /* /3 says nothing of it, and still names its own format */
  assert.equal(CC.CASE_FILE_SPECS["bio-case-file/3"].includes("capture_unnamed"), false);
  assert.ok(CC.CASE_FILE_SPECS["bio-case-file/3"].includes("`format`: `bio-case-file/3`."));
  assert.equal(CC.caseFileSpec(V4).text, SPEC);
});

/* ---- controls, green now */
test("R14 R19 (G50 control): a format this checker does not hold (bio-case-file/5) departs at format, and every finding is did_not_recreate", async () => {
  const cf = caseFile({ manifest: (m) => { m.format = "bio-case-file/5"; } });
  const r = await CC.checkCaseFile({ parts: cf.parts });
  assert.equal(r.integrity.intact, false);
  const named = CG.caseFileManifestCheck({ ...cf.manifest, format: "bio-case-file/5" });
  assert.ok(named.length > 0);
  assert.ok(r.integrity.departures.length >= 1);
  assert.deepEqual(new Set(Object.values(results(r))), new Set(["did_not_recreate"]));
  assert.ok(r.findings.every((f) => f.differs.some((e) => e.check === "integrity")));
});

test("R19 (G50 control): a one-capture case file's files state no capture, and its verdict is as before", async () => {
  const cf = caseFile();
  const read = CC.readCaseFile(cf.parts);
  assert.ok(read.files.every((f) => f.capture === null));
  assert.deepEqual(results(await CC.checkCaseFile({ parts: cf.parts })), ALL);
});

test("R2 R8 R19 (G50 control, R-OLD): the verdicts recorded at the G50 base over two stored /3 case files are byte-equal now, g1's original_carried departure included", async () => {
  const golden = JSON.parse(readFileSync(new URL("./g50-old-verdicts.json", import.meta.url), "utf8"));
  for (const g of ["g1", "g2"]) {
    const parts = golden[g].parts_b64.map((b) => new Uint8Array(Buffer.from(b, "base64")));
    assert.equal(golden[g].format, "bio-case-file/3", g);
    const now = await CC.checkCaseFile({ parts });
    assert.equal(canonicalJson(now), canonicalJson(golden[g].verdict), g);
    assert.equal(now.format, "bio-case-file/3");
  }
  /* g1 departs for the included row's document beside the copy (the departure is judged by ref in /3), g2 does not */
  assert.ok(golden.g1.verdict.integrity.departures.length > 0);
  assert.ok(golden.g1.paths.some((p) => p.endsWith("/document")) && golden.g1.paths.some((p) => p.endsWith("/obscured")));
  assert.deepEqual(golden.g2.verdict.integrity.departures, []);
});
