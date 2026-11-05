/* inquiry-grammar F1 (citation R29, citation.md:61; DEC-460): a leg citing what a photograph's file says, its time taken
   or its place, carrying the field and its value with from "the file" and checked false. The file's own statement is
   read from `file-safety`'s real `fileSays` (its R61), never built by hand. Pure; no network, no clock. */
import test from "node:test";
import assert from "node:assert/strict";
import * as IG from "../../../src/inquiry-grammar/index.mjs";
import { FILE_SAYS_FIELDS } from "../../../src/file-safety/index.mjs";
import { fileSays } from "../../../src/file-safety/picture.mjs";
import { INFO, INQ } from "./corpus.mjs";
import { run, plain } from "./fixture.mjs";

/* what a JPEG's file says, as file-safety answers it */
const SAID = fileSays({ time_taken: "2026:07:01 10:14:03", gps_latitude: 51.5007, gps_longitude: -0.1246, place_name: "Market Square", make: "Camera Co" }).file_says;
const fileLeg = (field, extra = {}) => ({ target: INFO, role: "supports", ...IG.fileSaysLeg(field, SAID[field].value), ...extra });
const basisOf = (legs, references = [{ target: INFO }, { target: INQ }]) =>
  plain(run((f) => IG.checkInquiryBasis({ object_type: "inquiry", references, basis: legs }, f, null, null)).findings);
const own = (fs) => fs.filter((x) => x.code === "FILE_SAYS_LEG_MALFORMED");

test("F1 a leg citing a JPEG's time taken carries the field and the file's value with from 'the file' and checked false, and the basis is clean", () => {
  const l = fileLeg("time_taken");
  assert.deepEqual(IG.readFileSaysLeg(l), { field: "time_taken", value: SAID.time_taken.value, from: SAID.time_taken.from, checked: SAID.time_taken.checked });
  assert.equal(IG.FILE_SAYS_FROM, SAID.time_taken.from);
  assert.deepEqual(basisOf([l]), []);
  for (const field of ["gps_latitude", "gps_longitude", "place_name"]) assert.deepEqual(basisOf([fileLeg(field)]), [], field);
  assert.equal(run((f) => IG.fileSaysLegFindings("basis leg 0", l, f, "information")).answer, true);
});

test("F1 the citable fields are the time taken and the place, each a field file-safety's file says names", () => {
  for (const k of IG.FILE_SAYS_CITABLE_FIELDS) assert.ok(FILE_SAYS_FIELDS.includes(k), k);
  assert.deepEqual([...IG.FILE_SAYS_CITABLE_FIELDS], ["time_taken", "gps_latitude", "gps_longitude", "place_name"]);
});

test("F1 control: citing a field outside time and place is refused by name, with the code; and fileSaysLeg spells no leg for it", () => {
  assert.equal(IG.fileSaysLeg("make", SAID.make.value), null);
  const l = { target: INFO, role: "supports", file_says_field: "make", file_says_value: SAID.make.value, file_says_from: "the file", file_says_checked: false };
  const fs = own(basisOf([l]));
  assert.equal(fs.length, 1);
  assert.equal(fs[0].check, "C-2.8");
  assert.equal(fs[0].severity, "error");
  assert.match(fs[0].message, /basis leg 0/);
  assert.match(fs[0].message, /\bmake\b/);
  assert.equal(IG.INQUIRY_GRAMMAR_CHECKS.FILE_SAYS_LEG_MALFORMED.check, "C-2.8");
});

test("F1 each departure is one finding with the code: a checked value, another source, no value, a grade, a part, a stray key, a target that is not a capture", () => {
  const cases = [
    [{ file_says_checked: true }, 1],
    [{ file_says_from: "the record" }, 1],
    [{ file_says_value: "" }, 1],
    [{ file_says_field: undefined }, 1],
    [{ grade: "C", grade_axis: "capture", grade_source: "capture" }, 3],
    [{ content_id: "a".repeat(64) }, 1],
    [{ file_says_note: "x" }, 1],
  ];
  for (const [extra, n] of cases) assert.equal(own(basisOf([fileLeg("time_taken", extra)])).length, n, JSON.stringify(extra));
  assert.equal(own(basisOf([fileLeg("time_taken", { target: INQ })])).length, 1);
});

test("F1 control: a leg with no file-says key gains nothing from the arm and answers false; it changes no other finding of the basis", () => {
  const plainLeg = { target: INFO, role: "supports" };
  assert.deepEqual(run((f) => IG.fileSaysLegFindings("basis leg 0", plainLeg, f, "information")), { findings: [], answer: false });
  assert.equal(IG.readFileSaysLeg(plainLeg), null);
  assert.deepEqual(basisOf([plainLeg]), basisOf([fileLeg("time_taken")]));
});

test("F1 its words name no field, stored code or decision id (R69)", () => {
  const NAMES = [/[a-z]+_[a-z_]+/, /\[|\]/, /\b(DEC|REC|CASE|C|D|R|K|N)-\d/, /\bop=/, /\bkind:/, /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/];
  const l = { target: INQ, role: "supports", file_says_field: "body_serial", file_says_value: [], file_says_from: 1, file_says_checked: "no",
              file_says_extra: 1, grade: "C", grade_axis: "capture", grade_source: "capture", content_id: "a".repeat(64) };
  const fs = own(basisOf([l]));
  assert.ok(fs.length >= 8);
  for (const x of fs) for (const t of [x.message, ...(x.repairs ?? [])]) assert.equal(NAMES.find((rx) => rx.test(t)), undefined, t);
});
