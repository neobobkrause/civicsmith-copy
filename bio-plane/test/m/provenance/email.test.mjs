/* provenance R82–R84 (T53; N824; K2425, K5504–K5506): a message brought in by email is graded as an upload, an attachment
   earns exactly what its message earns, and C-18.1 (R42, R83) admits the message's document. R81 (JOURNEYS R-24): a testimony
   filed from a project is stamped with it. Each rule with its negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, infoMd } from "./fixture.mjs";
import { registerChecks, ARCHIVE_VIA, REWRITTEN_REPLAY_GRADE, DOORBELL_VIA, UPLOAD_VIA, UNPACKED_VIA, FETCHED_VIAS,
         EMAIL_VIA, EMAIL_ATTACHMENT_VIA, ATTACHMENT_OF_MESSAGE, ATTACHMENT_UNRESOLVED, RECEIVED_NOT_FETCHED,
         EMAIL_ORIGIN, EMAILED_METHOD, EMAILED_ATTACHMENT_METHOD } from "../../../src/provenance/index.mjs";
import { ARCHIVE_DEPTH_MAX } from "../../../src/ooxml.mjs";
import { EARNED_CAPTURE_CEILING, parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const T = "2026-10-28T01:00:00Z";
const em = (s) => `email:${s}`;
const emailed = (w, s, extra = {}) =>
  w.prov.recordReceipt({ address: em(s), addressNorm: em(s), captureSha: s, retrieved: "2026-10-28T04:05:06.789Z", via: EMAIL_VIA, ...extra });
const attach = (w, messageSha, index, fileSha) =>
  w.prov.recordReceipt({ address: `${em(messageSha)}#${index}`, addressNorm: `${em(messageSha)}#${index}`, captureSha: fileSha,
                         retrieved: T, via: EMAIL_ATTACHMENT_VIA, retrievalLocator: `email:${messageSha}!${index}` });

test("R82: a message brought in by email is graded as an upload: route email, undetermined, received not fetched", () => {
  assert.deepEqual([EMAIL_VIA, EMAIL_ATTACHMENT_VIA], ["email", "email-attachment"], "the one spelling, exported for capture");
  const w = world();
  const s = sha("a message she forwarded");
  const r = emailed(w, s, { by: "member:ruth", statement: "the clerk sent it to me" });
  assert.deepEqual([r.recorded, r.via], [true, "email"]);
  const g = w.prov.captureGrade(s);
  assert.deepEqual({ ...g, why: undefined }, {
    grade: null, route: "email", determined: false, basis: RECEIVED_NOT_FETCHED, ceiling: EARNED_CAPTURE_CEILING,
    received: { address: em(s), address_norm: em(s), at: "2026-10-28T04:05:06Z" }, why: undefined });
  /* The sighting's member and statement are held with the receipt, as an upload's are (R83). */
  assert.deepEqual(w.prov.receiptsOfCapture({ captureSha: s }).rows[0].uploads,
                   [{ by: "member:ruth", statement: "the clerk sent it to me", at: "2026-10-28T04:05:06Z" }]);
  /* Control: the same bytes uploaded answer every field alike but the route, the receipt they name and the words. */
  const u = sha("a file she uploaded");
  w.prov.recordReceipt({ addressNorm: `upload:${u}`, captureSha: u, retrieved: "2026-10-28T04:05:06Z", via: UPLOAD_VIA });
  const same = ({ route, received, why, ...rest }) => rest;
  assert.deepEqual(same(g), same(w.prov.captureGrade(u)));
  assert.equal(w.prov.captureGrade(u).route, "upload");
  /* Not fetched (R62); in R59's order it stands with upload and doorbell. */
  assert.equal(FETCHED_VIAS.includes(EMAIL_VIA), false);
  assert.deepEqual(w.prov.fetchedByThisCopy(s), { fetched: false, routes: ["email"], archive: null });
});

test("R82: the sender's claim adds no letter and removes none; a later fetch of the same bytes writes its own receipt and governs", () => {
  const w = world();
  const a = sha("from the mayor"), b = sha("from nobody");
  emailed(w, a);
  emailed(w, b);
  /* A register row stating a sender changes nothing: the grade reads the receipts alone. */
  const before = JSON.stringify(w.prov.captureGrade(a));
  w.promoteInfo("INFO-2026-0001-msg", { captures: [{ path: "snapshots/m.eml", text: "From: mayor@city.example\n\nhi" }] });
  assert.equal(JSON.stringify(w.prov.captureGrade(a)), before);
  assert.deepEqual([w.prov.captureGrade(a).grade, w.prov.captureGrade(b).grade], [null, null]);
  w.prov.recordReceipt({ addressNorm: "e.org/h", captureSha: a, retrieved: T, via: ARCHIVE_VIA });
  assert.deepEqual([w.prov.captureGrade(a).route, w.prov.captureGrade(a).grade], ["archive", REWRITTEN_REPLAY_GRADE]);
  w.prov.recordReceipt({ addressNorm: "e.org/h", captureSha: a, retrieved: T });
  assert.deepEqual([w.prov.captureGrade(a).route, w.prov.captureGrade(a).grade], ["direct", EARNED_CAPTURE_CEILING]);
  assert.deepEqual(w.rows(`SELECT via FROM captured_locators WHERE capture_sha = ? ORDER BY via`, a).map((r) => r.via),
                   ["archive.org", "direct", "email"]);
  /* Control: the doorbell and an upload answer as before. */
  const d = sha("knocked");
  w.prov.recordReceipt({ addressNorm: `knock:${d}`, captureSha: d, retrieved: T, via: DOORBELL_VIA });
  assert.equal(w.prov.captureGrade(d).route, "doorbell");
});

test("R84: an attachment earns exactly what its message earns; route email-attachment, the message named", () => {
  const w = world();
  const msg = sha("a message"), file = sha("its attachment");
  /* A message graded B (it was also fetched) hands its attachment B, measured. */
  emailed(w, msg);
  w.prov.recordReceipt({ addressNorm: "e.org/msg", captureSha: msg, retrieved: T });
  attach(w, msg, 0, file);
  const g = w.prov.captureGrade(file);
  assert.deepEqual({ ...g, why: undefined }, { grade: EARNED_CAPTURE_CEILING, route: EMAIL_ATTACHMENT_VIA, determined: true,
    basis: ATTACHMENT_OF_MESSAGE, message: { sha256: msg, route: "direct", basis: "measured" }, why: undefined });
  assert.equal(w.prov.captureGrade(msg).grade, EARNED_CAPTURE_CEILING);
  /* A message that is only emailed hands on its undetermined answer unchanged. */
  const m2 = sha("only emailed"), f2 = sha("attachment of only emailed");
  emailed(w, m2);
  attach(w, m2, 3, f2);
  const g2 = w.prov.captureGrade(f2);
  const { route: _r, basis: _b, why: _w, message: _m, ...rest2 } = g2;
  const { route: _r2, basis: _b2, why: _w2, ...restM } = w.prov.captureGrade(m2);
  assert.deepEqual(rest2, restM);
  assert.deepEqual(g2.message, { sha256: m2, route: "email", basis: RECEIVED_NOT_FETCHED });
  assert.equal(g2.grade, null);
  /* Batch reads agree (R71), also for an attachment asked without its message. */
  assert.deepEqual(w.prov.captureGrades([file, f2]).map((x) => x.basis), [ATTACHMENT_OF_MESSAGE, ATTACHMENT_OF_MESSAGE]);
  assert.deepEqual(w.prov.captureGrades([f2])[0], g2);
});

test("R84: a nested chain reads the outermost message's grade; a bad locator or a chain past the bound reads unresolved", () => {
  const w = world();
  const top = sha("outer message"), mid = sha("a message attached to it"), leaf = sha("a file attached to that");
  emailed(w, top);
  w.prov.recordReceipt({ addressNorm: "e.org/top", captureSha: top, retrieved: T });
  attach(w, top, 1, mid);
  attach(w, mid, 0, leaf);
  const g = w.prov.captureGrade(leaf);
  assert.deepEqual([g.grade, g.route, g.basis, g.message.sha256], [EARNED_CAPTURE_CEILING, EMAIL_ATTACHMENT_VIA, ATTACHMENT_OF_MESSAGE, top]);
  /* A locator that names no digest and index. */
  const bad = sha("bad locator");
  for (const loc of ["email:xyz!0", `email:${top}!x`, `email:${top}`, "zip:abc"]) {
    w.prov.recordReceipt({ addressNorm: `bad:${loc}`, captureSha: bad, retrieved: T, via: EMAIL_ATTACHMENT_VIA, retrievalLocator: loc });
    const u = w.prov.captureGrade(bad);
    assert.deepEqual([u.grade, u.route, u.determined, u.basis], [null, EMAIL_ATTACHMENT_VIA, false, ATTACHMENT_UNRESOLVED], loc);
  }
  /* A chain longer than ARCHIVE_DEPTH_MAX containers. */
  const w2 = world();
  const chain = Array.from({ length: ARCHIVE_DEPTH_MAX + 3 }, (_, i) => sha(`link ${i}`));
  emailed(w2, chain[0]);
  w2.prov.recordReceipt({ addressNorm: "e.org/c", captureSha: chain[0], retrieved: T });
  for (let i = 1; i < chain.length; i++) attach(w2, chain[i - 1], 0, chain[i]);
  assert.equal(w2.prov.captureGrade(chain[chain.length - 1]).basis, ATTACHMENT_UNRESOLVED);
  assert.equal(w2.prov.captureGrade(chain[ARCHIVE_DEPTH_MAX]).basis, ATTACHMENT_OF_MESSAGE);
  /* Control: an unpacked file answers as before. */
  const arc = sha("archive"), f = sha("member");
  w2.prov.recordReceipt({ addressNorm: "e.org/a.zip", captureSha: arc, retrieved: T });
  w2.prov.recordReceipt({ addressNorm: "e.org/a.zip#zip:0", captureSha: f, retrieved: T, via: UNPACKED_VIA, retrievalLocator: `zip:${arc}!0` });
  assert.deepEqual([w2.prov.captureGrade(f).route, w2.prov.captureGrade(f).grade], ["unpacked", EARNED_CAPTURE_CEILING]);
});

test("R84, R62: an attachment is fetched when its message was; one past the bound or with a bad locator ends not fetched", () => {
  const w = world();
  const msg = sha("fetched message"), file = sha("attachment"), lone = sha("emailed message"), lonefile = sha("its attachment");
  w.prov.recordReceipt({ addressNorm: "e.org/m", captureSha: msg, retrieved: T });
  attach(w, msg, 0, file);
  assert.deepEqual(w.prov.fetchedByThisCopy(file), { fetched: true, routes: ["email-attachment"], archive: msg });
  emailed(w, lone);
  attach(w, lone, 0, lonefile);
  assert.deepEqual(w.prov.fetchedByThisCopy(lonefile), { fetched: false, routes: ["email-attachment"], archive: lone });
  const odd = sha("odd");
  w.prov.recordReceipt({ addressNorm: "x", captureSha: odd, retrieved: T, via: EMAIL_ATTACHMENT_VIA, retrievalLocator: "email:nope" });
  assert.deepEqual(w.prov.fetchedByThisCopy(odd), { fetched: false, routes: ["email-attachment"], archive: null });
});

/* ---- R83: C-18.1's message document ---- */

/* The document `capture` R116 writes, as its text describes it: R63's upload document with the message's differences.
   Copied, not imported: `capture` is later in the order than this module (P4). */
function emailDoc({ bytes = "From: a\n\nbody", by = "member:ruth", at = "2026-10-28T12:00:00Z" } = {}) {
  const s = sha(bytes);
  return {
    file: `snapshots/${s}`, locator: em(s), retrieved: at,
    authority_state: "undetermined", authority_basis: `not established; recorded ${at}`,
    provenance_chain: [{ who: "instance test (CivicOS/0.0.0)", asserts: `${by} brought this message in at ${at}`, evidence: "email receipt", bound: false, via: "email" }],
    capture: { method: EMAILED_METHOD, grade_basis: RECEIVED_NOT_FETCHED, actor_class: "member", actor: by, sha256: s, encoding: "binary", bytes: Buffer.byteLength(bytes) },
    origin_statement: { text: "the clerk sent it to me", words_of: by, evidence_of_truth: false },
    message: { from: "clerk@city.example", to: ["group@x.example"], cc: null, date: "2026-10-27T09:00:00Z", subject: "Minutes", message_id: "<1@city.example>",
               received: null, authentication_results: null, stated: true },
    origin: { kind: EMAIL_ORIGIN },
    attestation_attempts: [],
  };
}
const at2 = (id, opts) => infoMd(id, opts).replace("schema: information@1", "schema: information@2");
const runE = (docs, md = at2("INFO-2026-0001-mail")) => registerChecks({
  files: new Map([["bundle.md", md], ["data/provenance.json", JSON.stringify({ documents: docs })]]),
  elided: docs.map((d) => d.file), fm: parseFrontmatter(md).data });
const one = (d) => {
  const f = runE([d]);
  assert.equal(f.length, 1, JSON.stringify(f));
  assert.deepEqual([f[0].check, f[0].severity], ["C-18.1", "error"]);
  return f[0].message;
};

test("R83, R42: C-18.1 admits the message's document and holds its marks to their origin", () => {
  assert.deepEqual([EMAIL_ORIGIN, EMAILED_METHOD, EMAILED_ATTACHMENT_METHOD], ["email", "emailed", "emailed-attachment"]);
  const doc = emailDoc();
  assert.deepEqual(runE([doc]), []);
  assert.deepEqual(runE([doc], infoMd("INFO-2026-0001-mail")), []);
  /* A letter on a message, the basis absent or another, a wrong method, no statement, no message block, a malformed one. */
  assert.equal(one({ ...doc, capture: { ...doc.capture, grade: "B" } }), word("provenance.register.email_has_letter", { i: "0", grade: "B" }));
  assert.equal(one({ ...doc, capture: { ...doc.capture, grade_basis: undefined } }),
               word("provenance.register.email_basis_wrong", { i: "0", stated: "undefined", basis: RECEIVED_NOT_FETCHED }));
  assert.equal(one({ ...doc, capture: { ...doc.capture, method: "uploaded" } }),
               word("provenance.register.email_wrong_method", { i: "0", stated: "uploaded", method: EMAILED_METHOD }));
  const { origin_statement: _s, ...noStatement } = doc;
  assert.equal(one(noStatement), word("provenance.register.email_no_statement", { i: "0" }));
  const { message: _m, ...noMessage } = doc;
  assert.equal(one(noMessage), word("provenance.register.email_no_message", { i: "0" }));
  assert.equal(one({ ...doc, message: { ...doc.message, subject: undefined } }), word("provenance.register.message_malformed", { i: "0", fields: "subject" }));
  assert.equal(one({ ...doc, message: { ...doc.message, stated: false } }), word("provenance.register.message_malformed", { i: "0", fields: "stated" }));
  assert.equal(runE([{ ...doc, origin_statement: { ...doc.origin_statement, evidence_of_truth: true } }]).length, 1);
});

test("R83: a message block or method emailed on a document whose origin is not email is an error; an upload keeps its own rules", () => {
  const doc = emailDoc();
  const fetched = { ...doc, origin: { kind: "named_request" }, capture: { ...doc.capture, method: "GET", grade: "B", grade_basis: undefined } };
  const { origin_statement: _s, ...fetchedNoStatement } = fetched;
  assert.equal(one(fetchedNoStatement), word("provenance.register.message_wrong_origin", { i: "0", origin: EMAIL_ORIGIN }));
  const { message: _m, ...noBlock } = fetchedNoStatement;
  assert.deepEqual(runE([noBlock]), [], "the same document without the block passes");
  assert.equal(one({ ...noBlock, capture: { ...noBlock.capture, method: EMAILED_METHOD } }),
               word("provenance.register.emailed_wrong_origin", { i: "0", method: EMAILED_METHOD, origin: EMAIL_ORIGIN }));
  /* An upload document is not a message: the block on it is an error, the method on it an error. */
  const up = { ...doc, origin: { kind: "upload" }, capture: { ...doc.capture, method: "uploaded" } };
  assert.equal(one(up), word("provenance.register.message_wrong_origin", { i: "0", origin: EMAIL_ORIGIN }));
  /* The list of kinds names email. */
  assert.ok(runE([{ ...doc, origin: { kind: "emails" } }]).map((x) => x.message).includes(word("provenance.register.origin_kind_one_of",
    { i: "0", kinds: "named_request, sweep, member, doorbell, upload, email" })));
});

test("R83, R42: a document with method emailed-attachment carries a container block and owes neither statement nor message block", () => {
  const a = emailDoc({ bytes: "attached bytes" });
  const { origin_statement: _s, message: _m, ...base } = a;
  const att = { ...base, capture: { ...base.capture, method: EMAILED_ATTACHMENT_METHOD },
    container: { message_sha256: sha("From: a\n\nbody"), index: 0, name: "minutes.pdf" } };
  assert.deepEqual(runE([att]), []);
  /* No block: an error. Control: the block on a document of another method is still an error. */
  const { container: _c, ...noBlock } = att;
  assert.equal(one(noBlock), word("provenance.register.attachment_no_container", { i: "0", method: EMAILED_ATTACHMENT_METHOD }));
  assert.equal(runE([{ ...emailDoc(), container: {} }]).length, 1, "a container block on a message is an error");
});

/* ---- R81 (T53; JOURNEYS R-24) ---- */

test("R81: a testimony filed from a project is stamped with it, and one filed from none is not", () => {
  const w = world();
  const PROJ = "PROJ-2026-0001";
  const t = w.prov.testify({ words: "I saw it.", observedAt: "2026-09-20", author: V("ruth"), project: PROJ });
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.equal(w.record.bundleInfo(t.bundle_id).project, PROJ);
  assert.match(w.record.readFile(t.bundle_id, "bundle.md").text, new RegExp(`^project: ${PROJ}$`, "m"));
  /* Control: with no project, none; a value that is no id adds nothing to the front matter. */
  const n = w.prov.testify({ words: "I saw it too.", observedAt: "2026-09-20", author: V("ruth") });
  assert.equal(w.record.bundleInfo(n.bundle_id).project ?? null, null);
  const x = w.prov.testify({ words: "and again", observedAt: "2026-09-20", author: V("ruth"), project: "PROJ-1\nobject_type: project" });
  assert.equal(x.ok, true, JSON.stringify(x));
  assert.equal(w.record.bundleInfo(x.bundle_id).project ?? null, null);
});
