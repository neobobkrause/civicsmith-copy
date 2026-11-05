/* publication — F1 (citation R29; DEC-460, K5514, K5523): the author's switch that shows a photo's "the file says" place
   in a published edition, off by default and settable only before signing, and the view of a "the file says" citation,
   read by key, always `checked: false`. The file_says entries are made by file-safety's real `fileSays` (its R61); the
   leg carries one as `inquiry-grammar` F1 states its shape (PR 423, not merged: the leg is read by key). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world } from "./fixture.mjs";
import { fileSays } from "../../../src/file-safety/picture.mjs";

const F = "INQ-2026-0001", CASE = "CASE-2026-0001", CAP = "a".repeat(64);
/* the facts a camera wrote, through file-safety's own R61 reader */
const SAID = fileSays({ time_taken: "2026-10-08T07:00:00", gps_latitude: 37.8083333, make: "Cam" }).file_says;
const legOf = (field) => ({ capture: CAP, file_says: { field, ...SAID[field] } });

function base() {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  const roles = [{ target: F, version_sha: w.head(F) }];
  const roster = roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" }));
  w.prepare(CASE, 1, { project: proj, roles });
  return { w, proj, roster };
}
const at = { case: CASE, edition: 1 };

test("F1 a cited time reads by the 'the file says' key with checked false; a cited place with the photo's place off prints no figure and says it is withheld", () => {
  const { w } = base();
  const time = w.p.fileSaysCitationView({ ...at, leg: legOf("time_taken") });
  assert.deepEqual([time.ok, time.key, time.value, time.from, time.checked, time.withheld],
                   [true, "publication.file_says", SAID.time_taken.value, "the file", false, false]);
  assert.equal(w.p.photoPlaceShown({ ...at, capture: CAP }), false, "off by default");
  const place = w.p.fileSaysCitationView({ ...at, leg: legOf("gps_latitude") });
  assert.deepEqual([place.ok, place.key, place.value, place.withheld, place.checked],
                   [true, "publication.file_says.place_withheld", null, true, false]);
  assert.ok(!place.text.includes(String(SAID.gps_latitude.value)), "no coordinate printed");
});

test("F1 the author turns the photo's place on before signing: the place shows, still checked false; after signing the switch is frozen", () => {
  const { w, proj, roster } = base();
  const on = w.p.setPhotoPlaceShown({ ...at, capture: CAP, shown: true });
  assert.deepEqual([on.ok, on.set, on.shown], [true, true, true]);
  const place = w.p.fileSaysCitationView({ ...at, leg: legOf("gps_latitude") });
  assert.deepEqual([place.key, place.value, place.withheld, place.checked],
                   ["publication.file_says", SAID.gps_latitude.value, false, false]);
  assert.equal(w.signCase(CASE, 1, { project: proj, roster }).ok, true);
  const off = w.p.setPhotoPlaceShown({ ...at, capture: CAP, shown: false });
  assert.deepEqual([off.ok, off.set, off.shown], [true, false, true], "a signed edition keeps what was set");
  /* control: another photo of the same edition is still off */
  assert.equal(w.p.photoPlaceShown({ ...at, capture: "b".repeat(64) }), false);
});

test("F1 control: a field outside time and place is refused by name; the view writes nothing", () => {
  const { w } = base();
  const before = w.snapshot();
  const r = w.p.fileSaysCitationView({ ...at, leg: legOf("make") });
  assert.deepEqual([r.ok, r.reason, r.field], [false, "FILE_SAYS_FIELD_NOT_CITABLE", "make"]);
  w.p.fileSaysCitationView({ ...at, leg: legOf("time_taken") });
  assert.deepEqual(w.snapshot(), before, "nothing written, no grade or date moved");
});
