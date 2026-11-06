/* case-carriage R1, R8, R9, R13 (K5148; WALK-FINAL-10A R172): a photo a member uploaded is a photo. An upload records no
   `capture.content_type` (capture R86); only the profile of its bytes (`profile.format.format`). The provenance document of
   each upload is capture's published `uploadProvenance` (capture's fixtures, K4990), which its real `uploadCapture` writes when
   the test runs; this file holds only the bundle the upload is filed in and the bytes it is held by. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, makePng, sha } from "./fixture.mjs";
import { V } from "./fixture.mjs";
import { uploadProvenance } from "../capture/fixtures.mjs";

const OLIVE = V("olive");
const area = (rect, kind = "person") => ({ rect, kind });

/** An uploaded file: one bundle, the bytes only in the evidence store, filed where the upload's own provenance says it is
 *  (`snapshots/upload-<sha>`), its provenance document capture's `uploadProvenance` for those bytes. `filedAs` files it under
 *  a name instead (a bundle's register path), the document's `file` following it. */
async function uploaded(w, id, bytes, { name = "street.png", filedAs = null } = {}) {
  const b = Buffer.from(bytes);
  const real = await uploadProvenance({ bytes: b, name });
  const s = real.capture.sha256;
  const path = filedAs ? `snapshots/${filedAs}` : real.file;
  const doc = { ...real, file: path };
  w.doc(id, { text: `the page about ${id}` });
  w.st.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, ?, ?, 'binary', ?, ?)`, s, id, path, b.length, "2026-09-28T01:00:00Z");
  w.st.sql.exec(`INSERT INTO files (bundle_id, path, content, blob_sha, bytes, sha256) VALUES (?, ?, NULL, ?, ?, ?)`, id, path, s, b.length, s);
  w.st.sql.exec(`UPDATE files SET content=? WHERE bundle_id=? AND path='data/provenance.json'`, JSON.stringify({ documents: [doc] }), id);
  w.evidence.held.set(s, b);
  return s;
}

test("R1 R9 R13 an uploaded photo (no content type, the profile names the PNG) is a photo: obscuremark records nothing_to_obscure and the photo's marks answer a photo", async () => {
  const w = world();
  w.member("olive");
  const p = await uploaded(w, "INFO-2026-0030-street", makePng(20, 20));
  const r = await w.cc.obscureMark({ captureSha: p, areas: [], by: OLIVE });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.state, "nothing_to_obscure");
  assert.equal(w.cc.photoMarks({ captureSha: p, viewer: OLIVE }).ok, true);
  assert.equal(w.cc.documentCopy(p).state, "photo", "R8: it is carried only as its copy, never as a document");
});

test("R1 R9 an upload is a photo by its profile alone: a PNG the member named as a document still answers nothing_to_obscure", async () => {
  const w = world();
  w.member("olive");
  const a = await uploaded(w, "INFO-2026-0031-a", makePng(12, 12), { name: "a.txt" });
  const b = await uploaded(w, "INFO-2026-0032-b", makePng(14, 14), { name: "b.pdf" });
  for (const s of [a, b]) {
    const r = await w.cc.obscureMark({ captureSha: s, areas: [], by: OLIVE });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.state, "nothing_to_obscure");
  }
});

test("R1 R9 R13 (controls) the format decides: a text upload named notes.png is not a photo; a named .png whose bytes state no format is by its extension; no format, no type, no extension: not a photo", async () => {
  const w = world();
  w.member("olive");
  const text = await uploaded(w, "INFO-2026-0033-notes", "just some notes", { name: "notes.png" });
  const r = await w.cc.obscureMark({ captureSha: text, areas: [], by: OLIVE });
  assert.equal(r.ok, false);
  assert.equal(r.code ?? r.reason, "NOT_A_PHOTO");
  assert.notEqual(w.cc.documentCopy(text).state, "photo");
  // Bytes no signature names: format-registry answers them `unlisted`, naming no kind (its R38), so nothing states a format.
  const undetermined = await uploaded(w, "INFO-2026-0034-x", [0, 1, 2, 3, 250, 251, 252, 7, 9, 0, 13], { name: "x.png", filedAs: "x.png" });
  assert.equal(w.cc.documentCopy(undetermined).state, "photo", "nothing states a format: the extension decides");
  const named = await uploaded(w, "INFO-2026-0034-z", "plain words", { name: "z.png", filedAs: "z.png" });
  assert.notEqual(w.cc.documentCopy(named).state, "photo", "a stated format that is not an image wins over the extension");
  const plain = await uploaded(w, "INFO-2026-0035-y", "more plain words", { name: "y.txt" });
  assert.equal((await w.cc.obscureMark({ captureSha: plain, areas: [], by: OLIVE })).ok, false, "no format, no type, no extension: not a photo");
});

test("R1 R9 a fetched photo is still a photo by its recorded content type,", async () => {
  const w = world();
  w.member("olive");
  const p = w.photo("INFO-2026-0036-fetched", makePng(16, 16));
  assert.equal((await w.cc.obscureMark({ captureSha: p, areas: [area([1, 1, 5, 5])], by: OLIVE })).ok, true);
});
