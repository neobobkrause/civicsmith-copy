/* provenance-routes: a chain reconstructed only from fields the record holds (R1), and no hop read from a request (R7).
   Moved from `test/m/provenance/chain-route.test.mjs` and `convert-chain-marker.test.mjs` by N512 (provenance R19, R36),
   their assertions unchanged. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, provDoc } from "./fixture.mjs";
import { chainFromEvidence, provenanceRouteOps } from "../../../src/provenance-routes/index.mjs";
import { DOORBELL_ORIGIN, UPLOAD_ORIGIN } from "../../../src/provenance/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const fetched = { locator: "https://e.org/d", retrieved: "2026-09-01T00:00:00Z",
                  capture: { method: "acquire", actor_class: "session", sha256: sha("d") } };

test("R1: a fetched route gives one hop by this instance, a custodian one by the member, else what is missing", () => {
  const a = chainFromEvidence(fetched, { instanceName: "civic", at: "2026-09-27T00:00:00Z" });
  assert.equal(a.ok, true);
  assert.equal(a.hops.length, 1);
  const h = a.hops[0];
  assert.match(h.who, /^instance civic /);
  assert.equal(h.asserts, "these bytes were served for https://e.org/d at 2026-09-01T00:00:00Z");
  assert.equal(h.via, "direct");
  assert.equal(h.bound, false);
  assert.deepEqual(h.reconstructed.from, ["locator", "retrieved", "capture.method", "capture.actor_class", "capture.sha256"]);
  assert.equal(h.reconstructed.at, "2026-09-27T00:00:00Z");
  /* A timestamp is evidence for the bytes and the instant, never the address. */
  const ts = chainFromEvidence({ ...fetched, timestamp: { authority: "tsa.example", token_file: "snapshots/t.tsr" } });
  assert.match(ts.hops[0].evidence, /binds these bytes to their capture instant, not to the address/);
  assert.equal(ts.hops[0].bound, false);
  /* A custodian. */
  const m = chainFromEvidence({ locator: "in hand", capture: { sha256: sha("m") },
                                custody: { holder: "ruth", obtained: "2026-08-01T00:00:00Z", setting: "a meeting" } });
  assert.equal(m.ok, true);
  assert.equal(m.hops[0].via, "member");
  assert.equal(m.hops[0].who, "member ruth");
  assert.equal(m.hops[0].bound, false);
  assert.deepEqual(m.hops[0].reconstructed.from.slice(0, 2), ["custody.holder", "custody.obtained"]);
  assert.equal(m.hops[0].asserts, "this member held these bytes and supplied them to the record at 2026-08-01T00:00:00Z");
  /* Neither: each absent field listed. */
  const none = chainFromEvidence({ locator: "in hand" });
  assert.equal(none.ok, false);
  assert.equal(none.missing.length, 5);
  assert.deepEqual(chainFromEvidence({ ...fetched, retrieved: "" }).missing,
                   [localize("provenance-routes.index.the_instant_it_was", "the instant it was retrieved (`retrieved`)"),
                    localize("provenance-routes.index.a_named_custodian_custody", "a named custodian (`custody.holder`)"),
                    localize("provenance-routes.index.when_the_custodian_obtained", "when the custodian obtained it (`custody.obtained`)")]);
  assert.deepEqual(chainFromEvidence(null), { ok: false, missing: [localize("provenance-routes.index.the_document_entry_is_not", "the document entry is not an object")] });
  /* Negative control: "in hand" is never a fetched address, whatever else the entry records. */
  assert.equal(chainFromEvidence({ ...fetched, locator: "in hand" }).ok, false);
  /* Pure and never throws: odd inputs answer, and the same input answers the same. */
  for (const odd of [undefined, 0, "x", [], { capture: "x", custody: 7, timestamp: "t", origin: "o" }])
    assert.equal(typeof chainFromEvidence(odd).ok, "boolean");
  assert.deepEqual(chainFromEvidence(fetched, { at: "2026-01-01T00:00:00Z" }), chainFromEvidence(fetched, { at: "2026-01-01T00:00:00Z" }));
});

test("R1: a co-archive is never a hop, and every derived hop is stamped reconstructed, naming its fields", () => {
  const cap = { path: "snapshots/a.txt", text: "bytes of a" };
  const archive = "https://web.archive.org/web/20260719192109/https://example.org/snapshots/a.txt";
  const r = chainFromEvidence(provDoc(cap, { co_archive: archive }), { instanceName: "civic", at: "2026-09-27T00:00:00Z" });
  assert.equal(r.ok, true);
  assert.equal(r.hops.length, 1, "a direct fetch is one hop, whatever else the entry records");
  assert.equal(JSON.stringify(r.hops).includes("web.archive.org"), false);
  assert.equal(r.hops[0].via, "direct");
  const r2 = chainFromEvidence(provDoc(cap, { co_archive: { service: "archive.org", locator: archive } }));
  assert.deepEqual([r2.hops.length, JSON.stringify(r2.hops).includes("archive.org")], [1, false]);
  const custody = chainFromEvidence({ locator: "in hand", capture: { sha256: sha("m") },
                                      custody: { holder: "ruth", obtained: "2026-08-01T00:00:00Z" } }, { at: "2026-09-27T00:00:00Z" });
  for (const h of [r.hops[0], custody.hops[0]]) {
    assert.equal(h.reconstructed.by, "op=provenancechain (REC-54)");
    assert.equal(h.reconstructed.basis,
      word("provenance-routes.basis.derived_fields_capture"));
    assert.equal(h.reconstructed.at, "2026-09-27T00:00:00Z");
    assert.ok(Array.isArray(h.reconstructed.from) && h.reconstructed.from.length);
  }
  /* With no `at`, the stamp is a whole-second instant. */
  assert.match(chainFromEvidence(fetched).hops[0].reconstructed.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

/* A document received through the doorbell (capture R65's pull) with no chain, with and without the knock's receipt it
   states (K581). */
const knockDoc = (id, { receipt = true, bytes = `handed in ${id}` } = {}) => ({
  file: `snapshots/${id}`, locator: `knock:${id}`, retrieved: "2026-09-30T12:00:00Z",
  authority_state: "undetermined", authority_basis: "handed in at the doorbell; no authority is asserted",
  capture: { method: "knock fixture method", grade: null, grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED",
             actor_class: "member", actor: "member:ruth", sha256: sha(bytes), encoding: "binary", bytes: Buffer.byteLength(bytes) },
  source: { kind: "knocker", named: false, pseudonym: null,
            ...(receipt ? { receipt: { knock_id: id, sha256: sha(bytes), bytes: Buffer.byteLength(bytes), received: "2026-09-30T11:00:00Z" } } : {}) },
  origin: { kind: "doorbell", knock_id: id }, attestation_attempts: [],
});

test("R1 (K581): a doorbell document is never a fetched route: its one hop is read from the knock's receipt, else undetermined", () => {
  assert.equal(DOORBELL_ORIGIN, "doorbell", "the origin kind as provenance exports it (its R51, R58)");
  const d = knockDoc("KNOCK-20260930-0a1b2c3d");
  const r = chainFromEvidence(d, { instanceName: "civic", at: "2026-09-30T13:00:00Z" });
  assert.equal(r.ok, true);
  assert.equal(r.hops.length, 1);
  const h = r.hops[0];
  assert.equal(h.asserts, "these bytes were received for knock:KNOCK-20260930-0a1b2c3d at 2026-09-30T11:00:00Z");
  assert.deepEqual([h.via, h.bound, h.who], ["doorbell", false, "instance civic (doorbell)"]);
  assert.equal(/served for/.test(h.asserts), false, "never a fetched hop, though locator, retrieved and method are all present");
  assert.deepEqual(h.reconstructed.from, ["origin.kind", "source.receipt.knock_id", "source.receipt.received", "source.receipt.sha256"]);
  assert.equal(h.reconstructed.at, "2026-09-30T13:00:00Z");
  assert.match(h.evidence, new RegExp(d.capture.sha256));
  for (const bad of [knockDoc("K1", { receipt: false }), { ...d, source: { ...d.source, receipt: { knock_id: "K" } } },
                     { ...d, source: null }]) {
    const u = chainFromEvidence(bad);
    assert.equal(u.ok, false);
    assert.equal(u.missing.length, 1);
    assert.match(u.missing[0], /source\.receipt/);
  }
  assert.match(chainFromEvidence({ ...d, timestamp: { authority: "tsa.example", token_file: "snapshots/t.tsr" } }).hops[0].evidence,
               /not to the address/);
  /* The arm is the origin's alone: the same fields under a fetched origin are a fetched route. */
  assert.equal(chainFromEvidence({ ...d, origin: { kind: "named_request" } }).hops[0].via, "direct");
});

test("R7: no hop is read from a request: every hop written is derived from fields the record held", () => {
  const w = world();
  const a = w.cap("a"), b = w.cap("b");
  assert.equal(w.promoteInfo("INFO-2026-0001-y", { captures: [a, b] }).ok, true);
  const r = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-y", apply: true, author: V("ruth"), viewer: V("ruth"),
    hops: [{ who: "invented", asserts: "whatever the caller says" }], provenance_chain: [{ who: "invented" }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const text = w.record.readFile("INFO-2026-0001-y", "data/provenance.json").text;
  assert.equal(text.includes("invented"), false);
  for (const d of JSON.parse(text).documents)
    for (const h of d.provenance_chain) assert.ok(h.reconstructed && Array.isArray(h.reconstructed.from) && h.reconstructed.from.length);
  /* The ops map reads only the query, so a body's hops reach nothing either. */
  const w2 = world();
  assert.equal(w2.promoteInfo("INFO-2026-0002-y", { captures: [a] }).ok, true);
  const url = new URL(`http://do/?${new URLSearchParams({ bundleId: "INFO-2026-0002-y", apply: "1", author: V("r"), viewer: V("r") })}`);
  const viaOp = provenanceRouteOps(w2.routes, url, { hops: [{ who: "invented" }], provenance_chain: [{ who: "invented" }] })
    .provenancechain();
  assert.equal(viaOp.applied, true, JSON.stringify(viaOp));
  const text2 = w2.record.readFile("INFO-2026-0002-y", "data/provenance.json").text;
  assert.equal(text2.includes("invented"), false);
  assert.match(JSON.parse(text2).documents[0].provenance_chain[0].who, /^instance test-instance /);
  /* A chain already in the register document is kept as recorded, never rewritten. */
  const w3 = world();
  w3.promoteInfo("INFO-2026-0003-z", { captures: [a], docs: [provDoc(a, { provenance_chain: [{ who: "a named party" }] })] });
  const rep = w3.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0003-z", author: V("r"), viewer: V("r") });
  assert.equal(rep.documents[0].outcome, "already_recorded");
});

/* A document brought in by an upload (capture R86; provenance R63) with no chain, with and without the upload's receipt it
   states (K2457). */
const uploadDoc = (bytes, { receipt = true } = {}) => ({
  file: `snapshots/${sha(bytes)}`, locator: `upload:${sha(bytes)}`, retrieved: "2026-10-09T12:00:00Z",
  authority_state: "undetermined", authority_basis: "brought in by a member; no authority is asserted",
  capture: { method: "uploaded", grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED", actor_class: "member", actor: "member:ruth",
             sha256: sha(bytes), encoding: "binary", bytes: Buffer.byteLength(bytes) },
  source: { kind: "uploader", ...(receipt ? { receipt: { sha256: sha(bytes), bytes: Buffer.byteLength(bytes), received: "2026-10-09T11:00:00Z" } } : {}) },
  origin: { kind: "upload" },
  origin_statement: { text: "handed to me at the counter by the records clerk", words_of: "member:ruth", evidence_of_truth: false },
});

test("R1 (K2457): an upload document is never a fetched route: its one hop is read from the upload's receipt, else undetermined", () => {
  assert.equal(UPLOAD_ORIGIN, "upload", "the origin kind as provenance exports it (its R63)");
  const d = uploadDoc("a file she held");
  const r = chainFromEvidence(d, { instanceName: "civic", at: "2026-10-09T13:00:00Z" });
  assert.equal(r.ok, true);
  assert.equal(r.hops.length, 1);
  const h = r.hops[0];
  assert.equal(h.asserts, localize("provenance-routes.index.these_bytes_were_received_for_2", "these bytes were received for upload:{rsha} at {received}",
    { rsha: sha("a file she held"), received: "2026-10-09T11:00:00Z" }));
  assert.deepEqual([h.via, h.bound, h.who], ["upload", false, "instance civic (upload by member:ruth)"]);
  assert.equal(/served for/.test(h.asserts), false, "never a fetched hop, though locator, retrieved and method are all present");
  assert.deepEqual(h.reconstructed.from, ["origin.kind", "source.receipt.sha256", "source.receipt.received", "capture.actor"]);
  assert.equal(h.reconstructed.at, "2026-10-09T13:00:00Z");
  assert.match(h.evidence, new RegExp(d.capture.sha256));
  assert.equal(JSON.stringify(r).includes("records clerk"), false, "her statement is her words, never read into a hop");
  /* No actor recorded: the hop is still the upload's, naming no one. */
  assert.equal(chainFromEvidence({ ...d, capture: { ...d.capture, actor: undefined } }).hops[0].who, "instance unnamed (upload)");
  for (const bad of [uploadDoc("b", { receipt: false }), { ...d, source: { ...d.source, receipt: { sha256: d.capture.sha256 } } },
                     { ...d, source: { ...d.source, receipt: { received: "2026-10-09T11:00:00Z" } } }, { ...d, source: null }]) {
    const u = chainFromEvidence(bad);
    assert.equal(u.ok, false);
    assert.equal(u.missing.length, 1);
    assert.match(u.missing[0], /upload's receipt/);
  }
  assert.match(chainFromEvidence({ ...d, timestamp: { authority: "tsa.example", token_file: "snapshots/t.tsr" } }).hops[0].evidence,
               /not to the address/);
  /* Negative control: the arm is the origin's alone. The same fields under a fetched origin are a fetched route, and a
     doorbell document is still read from its knock's receipt. */
  assert.equal(chainFromEvidence({ ...d, origin: { kind: "named_request" } }).hops[0].via, "direct");
  assert.equal(chainFromEvidence({ ...d, origin: { kind: "doorbell" } }).ok, false, "no knock_id: the doorbell arm's own missing");
});
