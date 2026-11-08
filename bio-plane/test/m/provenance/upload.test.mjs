/* provenance R63 (K2425 (4); K509 (3)): a file a member holds and brought in herself (`capture` R86), its receipt route
   `upload`. Graded exactly as R51 grades the doorbell's material, with `route: "upload"`; never fetched (R62); in R59's
   order it stands where `doorbell` stands; and C-18.1 (R42) admits the document R86 writes: origin `upload`, no letter
   on R51's basis, method `uploaded`, and the member's `origin_statement`. Each rule with its negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, infoMd } from "./fixture.mjs";
import * as provenance from "../../../src/provenance/index.mjs";
import { registerChecks, ARCHIVE_VIA, REWRITTEN_REPLAY_GRADE, DOORBELL_VIA, UPLOAD_VIA, UNPACKED_VIA, FETCHED_VIAS,
         RECEIVED_NOT_FETCHED, UPLOAD_ORIGIN, UPLOADED_METHOD } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING, parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { migrateProvenance } from "../../../src/provenance/schema.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { DatabaseSync } from "node:sqlite";
import { wordRx } from "../../word-rx.mjs";

const T = "2026-10-09T01:00:00Z";
const up = (s) => `upload:${s}`;
/* The receipt capture R86 writes: one, at `upload:<sha256>`, via upload. */
const uploaded = (w, s, retrieved = "2026-10-09T04:05:06.789Z") =>
  w.prov.recordReceipt({ address: up(s), addressNorm: up(s), captureSha: s, retrieved, via: UPLOAD_VIA });

test("R63: a capture brought in by a member's upload is graded exactly as R51 grades the doorbell's, route upload", () => {
  assert.equal(UPLOAD_VIA, "upload", "the one spelling, exported for capture R86");
  const w = world();
  const s = sha("a file she holds");
  const r = uploaded(w, s);
  assert.deepEqual([r.recorded, r.via], [true, "upload"]);
  const g = w.prov.captureGrade(s);
  assert.deepEqual({ ...g, why: undefined }, {
    grade: null, route: "upload", determined: false, basis: "CAPTURE_RECEIVED_NOT_FETCHED",
    ceiling: EARNED_CAPTURE_CEILING,
    received: { address: up(s), address_norm: up(s), at: "2026-10-09T04:05:06Z" },
    why: undefined });
  assert.equal(g.basis, RECEIVED_NOT_FETCHED);
  /* Exactly R51's answer: the same bytes received at the doorbell instead answer every field alike but the route, the
     receipt it names, and the words that say how they came. */
  const k = sha("the same kind of file, knocked");
  w.prov.recordReceipt({ address: up(k).replace("upload:", "knock:"), addressNorm: `knock:${k}`, captureSha: k,
                         retrieved: "2026-10-09T04:05:06Z", via: DOORBELL_VIA });
  const d = w.prov.captureGrade(k);
  const same = ({ route, received, why, ...rest }) => rest;
  assert.deepEqual(same(g), same(d));
  assert.deepEqual(Object.keys(g), Object.keys(d), "the same fields, in the same order");
  assert.equal(d.route, "doorbell");
  /* Stated as authored, never as measured; existence proven by the upload's own receipt and its timestamp. */
  assert.match(g.why, wordRx("provenance.brought_member_holds"));
  assert.match(g.why, /2026-10-09T04:05:06Z/);
  assert.match(g.why, new RegExp(up(s)));
  assert.doesNotMatch(g.why, /doorbell/, "an upload is not said to have come through the doorbell");
  /* DEC-149's rule for outward words: the instance is "your group's Civicsmith", never "this instance" or "the plane". */
  assert.equal(g.why, word("provenance.why.bytes_fetched_address", { how: word("provenance.brought_member_holds"),
    earned_capture_ceiling: EARNED_CAPTURE_CEILING, first_retrieved: "2026-10-09T04:05:06Z", address: up(s) }));
  assert.doesNotMatch(g.why, /\b(?:this|the) (?:instance|plane)\b|\bplane's\b|\binstance's\b/i);
  assert.equal(w.prov.captureGrade(`sha256:${s.toUpperCase()}`).route, "upload");
  /* A second sighting (bytes already held, R86's `existed`) writes a later receipt: the earliest still proves existence. */
  w.prov.recordReceipt({ address: up(s), addressNorm: up(s), captureSha: s, retrieved: "2026-10-10T00:00:00Z", via: UPLOAD_VIA });
  assert.deepEqual(w.prov.captureGrade(s).received, { address: up(s), address_norm: up(s), at: "2026-10-09T04:05:06Z" });
  /* Negative control: a spelling that is not the one is a route no ruling names (R26), undetermined, not received. */
  const x = sha("misspelled route");
  w.prov.recordReceipt({ addressNorm: up(x), captureSha: x, retrieved: T, via: "uploaded" });
  assert.deepEqual([w.prov.captureGrade(x).basis, w.prov.captureGrade(x).route], ["CAPTURE_GRADE_VIA_UNRULED", "uploaded"]);
  /* A member's authored observation stays testimony even with an upload receipt naming its bytes (R27). */
  const t = w.prov.testify({ words: "I saw it.", observedAt: "2026-09-20", author: V("ruth") });
  w.prov.recordReceipt({ addressNorm: up(t.capture_sha), captureSha: t.capture_sha, retrieved: T, via: UPLOAD_VIA });
  assert.equal(w.prov.captureGrade(t.capture_sha).basis, "CAPTURE_AXIS_AUTHORED");
});

test("R63: a later fetch of the same bytes writes its own receipt beside the upload's, and the strongest answer governs", () => {
  const w = world();
  const s = sha("uploaded, then found online");
  uploaded(w, s);
  w.prov.recordReceipt({ addressNorm: "e.org/h", captureSha: s, retrieved: T, via: ARCHIVE_VIA });
  assert.deepEqual([w.prov.captureGrade(s).route, w.prov.captureGrade(s).grade], ["archive", REWRITTEN_REPLAY_GRADE]);
  w.prov.recordReceipt({ addressNorm: "e.org/h", captureSha: s, retrieved: T });
  assert.deepEqual([w.prov.captureGrade(s).route, w.prov.captureGrade(s).grade], ["direct", EARNED_CAPTURE_CEILING]);
  /* The upload's receipt stays; nothing is regraded or removed. */
  assert.deepEqual(w.rows(`SELECT via FROM captured_locators WHERE capture_sha = ? ORDER BY via`, s).map((r) => r.via),
                   ["archive.org", "direct", "upload"]);
});

test("R63 (K2449): an upload's receipt holds each sighting's member and statement, answered wherever receipts are read", () => {
  const w = world({ now: "2026-10-09T09:00:00.000Z" });
  const heard = [];
  w.prov.onReceipt("observation-log", (e) => { heard.push(e); return null; });
  const s = sha("the same file, two members");
  const a = w.prov.recordReceipt({ address: up(s), addressNorm: up(s), captureSha: s, retrieved: "2026-10-09T01:00:00Z",
                                   via: UPLOAD_VIA, by: "member:ruth", statement: "the clerk handed me this" });
  assert.deepEqual([a.recorded, a.observation], [true, "new"]);
  /* A second sighting by another member: the same receipt, its interval widened, her own statement kept beside the first. */
  const b = w.prov.recordReceipt({ address: up(s), addressNorm: up(s), captureSha: s, retrieved: "2026-10-10T02:00:00.500Z",
                                   via: UPLOAD_VIA, by: "member:sam", statement: "found it in a box of council papers" });
  assert.deepEqual([b.recorded, b.observation], [true, "unchanged"]);
  const sightings = [{ by: "member:ruth", statement: "the clerk handed me this", at: "2026-10-09T01:00:00Z" },
                     { by: "member:sam", statement: "found it in a box of council papers", at: "2026-10-10T02:00:00Z" }];
  /* R16 and R60 answer it. */
  const row = w.prov.receipts({ addressNorm: up(s) }).rows;
  assert.equal(row.length, 1);
  assert.deepEqual([row[0].via, row[0].observations, row[0].first_retrieved, row[0].last_retrieved, row[0].uploads],
                   ["upload", 2, "2026-10-09T01:00:00Z", "2026-10-10T02:00:00Z", sightings]);
  assert.deepEqual(w.prov.receiptsOfCapture({ captureSha: s }).rows.map((r) => r.uploads), [sightings]);
  assert.deepEqual(w.prov.receipts({}).rows.find((r) => r.capture_sha === s).uploads, sightings);
  /* R47's payload carries this sighting's member and statement. */
  assert.deepEqual(heard.map((e) => [e.via, e.by, e.statement]),
                   [["upload", "member:ruth", "the clerk handed me this"], ["upload", "member:sam", "found it in a box of council papers"]]);
  /* The same member again, the same words: a third sighting, kept as such (one entry per upload, as observations count). */
  w.prov.recordReceipt({ addressNorm: up(s), captureSha: s, via: UPLOAD_VIA, by: "member:ruth", statement: "the clerk handed me this" });
  const third = w.prov.receiptsOfCapture({ captureSha: s }).rows[0];
  assert.deepEqual([third.observations, third.uploads.length, third.uploads[2]],
                   [3, 3, { by: "member:ruth", statement: "the clerk handed me this", at: "2026-10-09T09:00:00Z" }]);
  /* Given as strings or not at all: anything else is held as null, never coerced. */
  const t = sha("an upload with no words");
  w.prov.recordReceipt({ addressNorm: up(t), captureSha: t, retrieved: T, via: UPLOAD_VIA, by: 7, statement: { text: "x" } });
  assert.deepEqual(w.prov.receiptsOfCapture({ captureSha: t }).rows[0].uploads, [{ by: null, statement: null, at: T }]);
  /* Negative control: any other route takes neither, holds none, and hands the listeners null. */
  for (const via of ["direct", DOORBELL_VIA, ARCHIVE_VIA, UNPACKED_VIA, "some-mirror"]) {
    const o = sha(`other ${via}`);
    heard.length = 0;
    w.prov.recordReceipt({ addressNorm: `e.org/${via}`, captureSha: o, retrieved: T, via, by: "member:ruth", statement: "mine" });
    assert.equal(w.prov.receiptsOfCapture({ captureSha: o }).rows[0].uploads, null, via);
    assert.equal(w.row(`SELECT uploads FROM captured_locators WHERE capture_sha = ?`, o).uploads, null, via);
    assert.deepEqual([heard[0].by, heard[0].statement], [null, null], via);
  }
  /* The grade is R63's whatever the sightings say: words are never evidence (no field of the answer moves). */
  assert.deepEqual([w.prov.captureGrade(s).route, w.prov.captureGrade(s).basis], ["upload", RECEIVED_NOT_FETCHED]);
});

test("R63 (K2449): a store written before the column existed gains `uploads` at boot, every earlier receipt null", () => {
  const db = new DatabaseSync(":memory:");
  const sql = { exec(q, ...a) { const st = db.prepare(q); return st.columns().length ? st.all(...a) : (st.run(...a), []); } };
  db.exec(`CREATE TABLE captured_locators (address_norm TEXT NOT NULL, address TEXT NOT NULL, capture_sha TEXT NOT NULL,
             via TEXT NOT NULL DEFAULT 'direct', retrieval_locator TEXT, first_retrieved TEXT NOT NULL,
             last_retrieved TEXT NOT NULL, observations INTEGER NOT NULL DEFAULT 1, reputation TEXT,
             PRIMARY KEY (address_norm, capture_sha, via))`);
  db.prepare(`INSERT INTO captured_locators VALUES (?,?,?,?,?,?,?,?,?)`).run("knock:K", "knock:K", sha("k"), "doorbell",
    null, T, T, 1, null);
  migrateProvenance(sql);
  migrateProvenance(sql);
  assert.deepEqual({ ...db.prepare(`SELECT * FROM captured_locators`).get() },
    { address_norm: "knock:K", address: "knock:K", capture_sha: sha("k"), via: "doorbell", retrieval_locator: null,
      first_retrieved: T, last_retrieved: T, observations: 1, reputation: null, uploads: null });
});

test("R63, R62: upload is not in FETCHED_VIAS; an uploaded capture is not fetched until a fetch of its bytes is recorded", () => {
  assert.equal(FETCHED_VIAS.includes(UPLOAD_VIA), false);
  assert.deepEqual([...FETCHED_VIAS], ["direct", "archive.org", "capture-request"]);
  const w = world();
  const s = sha("held by a member");
  uploaded(w, s);
  assert.deepEqual(w.prov.fetchedByThisCopy(s), { fetched: false, routes: ["upload"], archive: null });
  /* A file cut out of an uploaded archive is not fetched either. */
  const f = sha("a file inside the uploaded archive");
  w.prov.recordReceipt({ addressNorm: `${up(s)}#zip:0`, captureSha: f, retrieved: T, via: UNPACKED_VIA,
                         retrievalLocator: `zip:${s}!0` });
  assert.deepEqual(w.prov.fetchedByThisCopy(f), { fetched: false, routes: ["unpacked"], archive: s });
  /* Negative control: one fetched receipt beside the upload's suffices, both routes named. */
  w.prov.recordReceipt({ addressNorm: "e.org/found", captureSha: s, retrieved: T });
  assert.deepEqual(w.prov.fetchedByThisCopy(s), { fetched: true, routes: ["direct", "upload"], archive: null });
  assert.deepEqual(w.prov.fetchedByThisCopy(f), { fetched: true, routes: ["unpacked"], archive: s });
});

test("R63, R59: among equal answers an upload stands where the doorbell stands; a file of an uploaded archive earns its answer", () => {
  const w = world();
  const route = (s) => { const g = w.prov.captureGrade(s); return [g.route, g.grade, g.basis]; };
  const arch = sha("an uploaded archive");
  uploaded(w, arch);
  /* A file cut out of an uploaded archive earns exactly the upload's answer (R59), the archive's route named. */
  const f = sha("entry 2 of the uploaded archive");
  w.prov.recordReceipt({ addressNorm: `${up(arch)}#zip:2`, captureSha: f, retrieved: T, via: UNPACKED_VIA,
                         retrievalLocator: `zip:${arch}!2` });
  const g = w.prov.captureGrade(f);
  assert.deepEqual([g.grade, g.determined, g.route, g.basis, g.archive],
                   [null, false, "unpacked", "CAPTURE_UNPACKED_FROM_ARCHIVE",
                    { sha256: arch, through: [2], route: "upload", basis: RECEIVED_NOT_FETCHED }]);
  assert.deepEqual(g.received, w.prov.captureGrade(arch).received);
  /* Between equal (undetermined) answers, unpacked before upload, as before doorbell. */
  w.prov.recordReceipt({ addressNorm: up(f), captureSha: f, retrieved: T, via: UPLOAD_VIA });
  assert.equal(route(f)[0], "unpacked");
  /* Upload and doorbell together: one rank, both received; the answer is received either way, never a letter. */
  const b = sha("knocked and uploaded");
  w.prov.recordReceipt({ addressNorm: `knock:${b}`, captureSha: b, retrieved: T, via: DOORBELL_VIA });
  uploaded(w, b);
  assert.deepEqual(route(b).slice(1), [null, RECEIVED_NOT_FETCHED]);
  assert.ok(["doorbell", "upload"].includes(route(b)[0]));
  /* A route no ruling grades never outranks an upload (R26, R59). */
  const m = sha("uploaded and mirrored");
  uploaded(w, m);
  w.prov.recordReceipt({ addressNorm: "e.org/m", captureSha: m, retrieved: T, via: "some-mirror" });
  assert.deepEqual(route(m), ["upload", null, RECEIVED_NOT_FETCHED]);
  /* Negative control: any measured letter outranks it. */
  w.prov.recordReceipt({ addressNorm: "e.org/m2", captureSha: m, retrieved: T, via: ARCHIVE_VIA });
  assert.deepEqual(route(m), ["archive", REWRITTEN_REPLAY_GRADE, "measured"]);
});

/* ---- R63, R42: C-18.1's upload document ---- */

/* Capture R86's document, field for field as its text describes it: R65's pulled-knock document with R86's
   differences. Copied, not imported: `capture` is later in the order than this module, so its tests cannot load it (P4). */
function uploadDoc({ bytes = "a file she holds", by = "member:ruth", at = "2026-10-09T12:00:00Z" } = {}) {
  const s = sha(bytes);
  return {
    file: `snapshots/${s}`, locator: up(s), retrieved: at,
    profile: { digests: { determined: false, evidentiary: null } },
    authority_state: "undetermined",
    authority_basis: word("capture.authority_basis", { at: String(at) }),
    provenance_chain: [{
      who: "instance test-instance (CivicOS/0.0.0)",
      asserts: `${by} brought these bytes in at ${at}`,
      evidence: `upload receipt ${s}: digest and instant`,
      bound: false, via: "upload",
    }],
    capture: {
      method: "uploaded", grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED",
      actor_class: "member", actor: by,
      sha256: s, encoding: "binary", bytes: Buffer.byteLength(bytes),
    },
    source: { kind: "uploader", receipt: { sha256: s, bytes: Buffer.byteLength(bytes), received: at } },
    origin_statement: { text: "the clerk handed me this at the counter", words_of: by, evidence_of_truth: false },
    name_stated: "minutes.pdf",
    origin: { kind: "upload" },
    attestation_attempts: [],
  };
}
const at2 = (id, opts) => infoMd(id, opts).replace("schema: information@1", "schema: information@2");
const runUp = (docs, md = at2("INFO-2026-0001-upload")) => registerChecks({
  files: new Map([["bundle.md", md], ["data/provenance.json", JSON.stringify({ documents: docs })]]),
  elided: docs.map((d) => d.file), fm: parseFrontmatter(md).data });
const one = (d) => {
  const f = runUp([d]);
  assert.equal(f.length, 1, JSON.stringify(f));
  assert.deepEqual([f[0].check, f[0].severity], ["C-18.1", "error"]);
  return f[0].message;
};

test("R63, R42: C-18.1 admits capture R86's upload document: no letter on R51's basis, method uploaded, her statement", () => {
  assert.deepEqual([UPLOAD_ORIGIN, UPLOADED_METHOD, provenance.UPLOAD_ORIGIN], ["upload", "uploaded", "upload"]);
  const doc = uploadDoc();
  /* As R86 writes it: every arm passes, at information@1 and @2, collected and verified by a named member. */
  assert.deepEqual(runUp([doc]), []);
  assert.deepEqual(runUp([doc], infoMd("INFO-2026-0001-upload")), []);
  const hist = `  - timestamp: "2026-10-09T13:00:00Z"\n    from_state: collected\n    to_state: verified\n    author: member:sam`;
  assert.deepEqual(runUp([doc], at2("INFO-2026-0001-upload", { state: "verified", history: hist })), []);
  assert.deepEqual(runUp([{ ...doc, capture: { ...doc.capture, grade: null } }]), [], "grade null stated is no letter too");
  /* Negative controls, each the one finding its rule names. A letter; the basis absent or another. */
  for (const g of ["B", "A", "C", "D", ""])
    assert.equal(one({ ...doc, capture: { ...doc.capture, grade: g } }), word("provenance.register.upload_has_letter", { i: "0", grade: g }));
  assert.equal(one({ ...doc, capture: { ...doc.capture, grade_basis: undefined } }), word("provenance.register.upload_basis_wrong", { i: "0", stated: "undefined", basis: RECEIVED_NOT_FETCHED }));
  assert.equal(one({ ...doc, capture: { ...doc.capture, grade_basis: "CAPTURE_ROUTE_UNRECORDED" } }), word("provenance.register.upload_basis_wrong", { i: "0", stated: "CAPTURE_ROUTE_UNRECORDED", basis: RECEIVED_NOT_FETCHED }));
  /* The method is `uploaded`. */
  assert.match(one({ ...doc, capture: { ...doc.capture, method: "knock-received-fixture" } }),
               /capture.method is 'knock-received-fixture', not 'uploaded'/);
  /* Her statement: present, an object, its text and whose words they are not blank, never evidence of truth. */
  const { origin_statement: _s, ...noStatement } = doc;
  assert.equal(one(noStatement), word("provenance.register.upload_no_statement", { i: "0" }));
  for (const st of [null, "the clerk", ["the clerk"]]) assert.equal(one({ ...doc, origin_statement: st }), word("provenance.register.upload_no_statement", { i: "0" }));
  const bad = (patch) => one({ ...doc, origin_statement: { ...doc.origin_statement, ...patch } });
  for (const t of [undefined, "", "   ", 7]) assert.match(bad({ text: t }), /origin_statement is malformed: text/);
  for (const t of [undefined, "", " "]) assert.match(bad({ words_of: t }), /origin_statement is malformed: words_of/);
  for (const e of [undefined, true, "false", 0, null]) assert.match(bad({ evidence_of_truth: e }), /origin_statement is malformed: evidence_of_truth/);
  /* The pairing: the method or a statement on a document of another origin is an error, and that origin keeps its own
     rules (a fetched document still owes a letter). */
  const fetched = { ...doc, origin: { kind: "named_request" }, capture: { ...doc.capture, method: "GET", grade: "B", grade_basis: undefined } };
  assert.match(one(fetched), /carries an origin_statement but its origin.kind is not 'upload'/);
  const { origin_statement: _t, ...fetchedNoStatement } = fetched;
  assert.deepEqual(runUp([fetchedNoStatement]), [], "the same document without the statement passes");
  assert.match(one({ ...fetchedNoStatement, capture: { ...fetchedNoStatement.capture, method: "uploaded" } }),
               /states capture.method 'uploaded' but its origin.kind is not 'upload'/);
  /* A knock is not an upload: its own note is not an origin_statement. */
  assert.match(runUp([{ ...doc, origin: { kind: "doorbell", knock_id: "KNOCK-20261009-0a1b2c3d" } }]).map((x) => x.message).join("\n"),
               /states capture.method 'uploaded' but its origin.kind is not 'upload'/);
  /* A kind the register does not know is no upload: it owes a letter, and the list of kinds names upload. */
  assert.ok(runUp([{ ...doc, origin: { kind: "uploads" } }]).map((x) => x.message)
    .includes(word("provenance.register.origin_kind_one_of", { i: "0", kinds: "named_request, sweep, member, doorbell, upload, email" })));
  /* An upload is not a member's authored observation: an authored claim keeps the authored arm's rules. */
  assert.match(runUp([{ ...doc, authored: true }]).map((x) => x.message).join("\n"), /origin.kind is 'upload', not 'member'/);
});

test("R63, R42: at the write, an upload's bundle is filed with its register row; a letter on it is refused, nothing written", () => {
  const w = world();
  const bytes = "a file she holds, filed";
  const id = "INFO-2026-0001-upload-filed";
  const file = (doc) => ({
    bundleId: id, base: null, snapKey: `k${Math.random().toString(16).slice(2)}`, author: "member:ruth",
    meta: { object_type: "information" },
    files: [{ path: "bundle.md", text: at2(id) }, { path: "data/provenance.json", text: JSON.stringify({ documents: [doc] }, null, 2) },
            { path: doc.file, blobSha: sha(bytes), sha256: sha(bytes), bytes: Buffer.byteLength(bytes) }],
    register: [{ sha256: sha(bytes), path: doc.file, encoding: "binary", bytes: Buffer.byteLength(bytes) }] });
  const before = w.snapshot();
  const lettered = uploadDoc({ bytes });
  const refused = w.promotion.promote(file({ ...lettered, capture: { ...lettered.capture, grade: "B" } }));
  assert.deepEqual([refused.ok, refused.reason, refused.findings.map((x) => x.check)], [false, "PROVENANCE_REGISTER_REFUSED", ["C-18.1"]]);
  assert.equal(refused.findings[0].detail, word("provenance.register.upload_has_letter", { i: "0", grade: "B" }));
  const unstated = uploadDoc({ bytes });
  delete unstated.origin_statement;
  const refused2 = w.promotion.promote(file(unstated));
  assert.deepEqual([refused2.ok, refused2.findings.map((x) => x.check)], [false, ["C-18.1"]]);
  assert.equal(refused2.findings[0].detail, word("provenance.register.upload_no_statement", { i: "0" }));
  assert.deepEqual(w.snapshot(), before, "nothing written");
  const doc = uploadDoc({ bytes });
  const r = w.promotion.promote(file(doc));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.prov.homeOf(sha(bytes)).bundleId, id);
  /* With the upload's receipt, the capture's grade is R63's, on the same basis the document states. */
  w.prov.recordReceipt({ address: doc.locator, addressNorm: doc.locator, captureSha: sha(bytes), retrieved: doc.retrieved, via: UPLOAD_VIA });
  const g = w.prov.captureGrade(sha(bytes));
  assert.deepEqual([g.grade, g.route, g.basis], [null, "upload", doc.capture.grade_basis]);
});
