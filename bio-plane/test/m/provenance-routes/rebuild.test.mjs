/* provenance-routes: `provenanceChainRebuild` (R2) and its named member (R3). Moved from
   `test/m/provenance/chain-route.test.mjs` and `convert-chain-marker.test.mjs` by N512 (provenance R20, R21), their
   assertions unchanged, with the refusal-as-it-came and read-nothing controls added. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, provDoc, infoMd } from "./fixture.mjs";
import { ROUTE_MARK_NOTE } from "../../../src/provenance-routes/index.mjs";
import { registerChecks, PROVENANCE_ACT_CHECKS } from "../../../src/provenance/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

/* An information bundle with two documents: one with a fetched route, and one whose route the record lacks. */
function twoDocs(w, id, { secondRouted = false, state = "collected" } = {}) {
  const a = w.cap(`${id}-a`), b = w.cap(`${id}-b`);
  const docs = [provDoc(a), { ...provDoc(b), ...(secondRouted ? {} : { locator: "in hand", custody: undefined }) }];
  const r = w.promoteInfo(id, { captures: [a, b], docs, state });
  assert.equal(r.ok, true, JSON.stringify(r));
  return { a, b };
}

test("R2: the rebuild reports, refuses whole when any document is undetermined, and applies through promote", () => {
  const w = world();
  twoDocs(w, "INFO-2026-0001-x");
  const before = w.snapshot();
  const refused = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-x", apply: true, author: V("ruth"), viewer: V("ruth") });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "EVIDENCE_INSUFFICIENT");
  assert.deepEqual(refused.documents.map((d) => d.outcome), ["reconstructed", "undetermined"]);
  assert.ok(refused.documents[1].missing.length);
  assert.equal(refused.route.finding, "NEVER_LOOKED", "the bundle's route finding rides on the refusal");
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* Every document derivable: a report first, then an apply that changes only data/provenance.json. */
  const w2 = world();
  twoDocs(w2, "INFO-2026-0002-y", { secondRouted: true });
  const head0 = w2.head("INFO-2026-0002-y");
  const crit0 = w2.row(`SELECT criticality, created, last_updated FROM bundles WHERE bundle_id=?`, "INFO-2026-0002-y");
  const snap0 = w2.snapshot();
  const report = w2.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0002-y", author: V("ruth"), viewer: V("ruth") });
  assert.deepEqual([report.ok, report.applied, report.changed], [true, false, 2]);
  assert.deepEqual(report.documents.map((d) => d.outcome), ["reconstructed", "reconstructed"]);
  assert.equal(report.route.finding, "NEVER_LOOKED");
  assert.deepEqual(w2.snapshot(), snap0, "a report writes nothing");
  const files0 = Object.fromEntries(w2.record.livePaths("INFO-2026-0002-y").map((p) => [p, w2.record.readFile("INFO-2026-0002-y", p).sha256]));
  const applied = w2.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0002-y", apply: true, author: V("ruth"), viewer: V("ruth") });
  assert.deepEqual([applied.ok, applied.applied, applied.changed], [true, true, 2], JSON.stringify(applied));
  const files1 = Object.fromEntries(w2.record.livePaths("INFO-2026-0002-y").map((p) => [p, w2.record.readFile("INFO-2026-0002-y", p).sha256]));
  assert.deepEqual(Object.keys(files1).sort(), Object.keys(files0).sort(), "no file added or dropped");
  for (const p of Object.keys(files0)) if (p !== "data/provenance.json") assert.equal(files1[p], files0[p], `${p} carried byte for byte`);
  assert.notEqual(files1["data/provenance.json"], files0["data/provenance.json"]);
  const h1 = w2.head("INFO-2026-0002-y");
  assert.deepEqual([h1.type, h1.groupId, h1.currentState, h1.priorState, h1.title],
                   [head0.type, head0.groupId, head0.currentState, head0.priorState, head0.title]);
  assert.equal(h1.rowVersion, head0.rowVersion + 1, "promoted once");
  assert.equal(applied.sha, h1.bundleSha, "the answer names the promoted bundle's digest");
  assert.deepEqual({ ...w2.row(`SELECT criticality, created, last_updated FROM bundles WHERE bundle_id=?`, "INFO-2026-0002-y") }, { ...crit0 });
  const entry = w2.rows(`SELECT author FROM manifest WHERE bundle_id=? ORDER BY rowid DESC LIMIT 1`, "INFO-2026-0002-y")[0];
  assert.equal(entry.author, V("ruth"), "the promotion is the member's");
  const chains = JSON.parse(w2.record.readFile("INFO-2026-0002-y", "data/provenance.json").text).documents.map((d) => d.provenance_chain.length);
  assert.deepEqual(chains, [1, 1]);
  /* Already recorded: nothing to apply. */
  const again = w2.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0002-y", apply: true, author: V("ruth"), viewer: V("ruth") });
  assert.deepEqual([again.applied, again.changed, again.documents[0].outcome], [false, 0, "already_recorded"]);
  /* Refusals. */
  const r = (args) => w2.routes.provenanceChainRebuild({ author: V("ruth"), viewer: V("ruth"), ...args }).reason;
  assert.equal(r({ author: "", bundleId: "INFO-2026-0002-y" }), "NO_AUTHOR");
  assert.equal(r({ bundleId: "" }), "NO_BUNDLE");
  const nb = w2.routes.provenanceChainRebuild({ bundleId: "", author: V("r"), viewer: V("r") });
  assert.deepEqual([nb.check, nb.translation], [PROVENANCE_ACT_CHECKS.NO_BUNDLE.check, PROVENANCE_ACT_CHECKS.NO_BUNDLE.translation],
                   "NO_BUNDLE carries provenance's C-103.3 row: its sentence is true at both sites");
  assert.equal(nb.check, "C-103.3");
  assert.equal(r({ bundleId: "INFO-2026-0404-none" }), "NO_SUCH_BUNDLE");
  assert.equal(r({ bundleId: "INFO-2026-0002-y", viewer: "stranger" }), "NO_SUCH_BUNDLE", "unseen answers as absent");
  const unseen = w2.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0002-y", author: V("r"), viewer: "stranger" });
  const absent = w2.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0404-none", author: V("r"), viewer: V("r") });
  assert.deepEqual({ ...unseen, bundleId: null }, { ...absent, bundleId: null }, "the two answers differ only by the id asked");
  const w3 = world();
  const c = w3.cap("c");
  const mk = (id, prov) => w3.promotion.promote({ bundleId: id, base: null, snapKey: id, author: "member:alice", replay: true,
    meta: { object_type: "information" }, files: [{ path: "bundle.md", text: infoMd(id) }, { path: c.path, text: c.text },
      ...(prov === null ? [] : [{ path: "data/provenance.json", text: prov }])] });
  mk("INFO-2026-0003-n", null); mk("INFO-2026-0004-u", "{x"); mk("INFO-2026-0005-d", JSON.stringify({ nope: 1 }));
  const r3 = (id) => w3.routes.provenanceChainRebuild({ bundleId: id, author: V("r"), viewer: V("r") }).reason;
  assert.equal(r3("INFO-2026-0003-n"), "NO_REGISTER");
  assert.equal(r3("INFO-2026-0004-u"), "UNPARSABLE_REGISTER");
  assert.equal(r3("INFO-2026-0005-d"), "NO_DOCUMENTS");
});

test("R2: a promotion's refusal is returned as it came, with the bundle and the report, and nothing is written", () => {
  const w = world();
  twoDocs(w, "INFO-2026-0001-x", { secondRouted: true });
  /* A later module's check that refuses every revision of this bundle (promotion R39). */
  let refuse = true;
  w.promotion.registerStep("test-refuser", { check: (c) => (refuse && c.bundleId === "INFO-2026-0001-x"
    ? { ok: false, reason: "TEST_REFUSED", detail: "refused by a test step", marker: 42 } : null) });
  const before = w.snapshot();
  const r = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-x", apply: true, author: V("ruth"), viewer: V("ruth") });
  assert.deepEqual([r.ok, r.reason, r.detail, r.marker, r.bundleId], [false, "TEST_REFUSED", "refused by a test step", 42, "INFO-2026-0001-x"]);
  assert.deepEqual(r.documents.map((d) => d.outcome), ["reconstructed", "reconstructed"]);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* Negative control: the same call without the refusing step applies. */
  refuse = false;
  assert.equal(w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-x", apply: true, author: V("ruth"), viewer: V("ruth") }).applied, true);
});

test("R2: a relabel keeps the document's own stated values; the row's are sent only where the document states none", () => {
  const w = world();
  const a = w.cap("a");
  assert.equal(w.promoteInfo("INFO-2026-0001-x", { captures: [a], title: "As the document says" }).ok, true);
  /* The row drifts from the document (an envelope once wrote it apart from its bytes, M-172). */
  w.st.sql.exec(`UPDATE bundles SET title = 'a row title' WHERE bundle_id = ?`, "INFO-2026-0001-x");
  const r = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-x", apply: true, author: V("ruth"), viewer: V("ruth") });
  assert.equal(r.applied, true, JSON.stringify(r));
  assert.equal(w.head("INFO-2026-0001-x").title, "As the document says", "the document's stated title, never the row's");
});

test("R2: a witnessed chain survives an applied rebuild byte for byte, and the register is clean for C-18.9 afterwards", () => {
  const cap = { path: "snapshots/a.txt", text: "bytes of a" };
  const w = world();
  const id = "INFO-2026-0002-w";
  const b = { path: "snapshots/b.txt", text: "bytes of b" };
  const witnessed = [{ who: word("capture-sources.name.internet_archive_wayback"), asserts: "served the replay", evidence: "CDX record",
                       bound: false, via: "archive.org" }];
  assert.equal(w.promoteInfo(id, { captures: [cap, b], docs: [provDoc(cap, { provenance_chain: witnessed }), provDoc(b)] }).ok, true);
  const before = JSON.parse(w.record.readFile(id, "data/provenance.json").text).documents[0];
  const r = w.routes.provenanceChainRebuild({ bundleId: id, apply: true, author: V("riley"), viewer: V("riley") });
  assert.deepEqual([r.ok, r.applied, r.documents.map((d) => d.outcome)], [true, true, ["already_recorded", "reconstructed"]], JSON.stringify(r));
  const after = JSON.parse(w.record.readFile(id, "data/provenance.json").text).documents[0];
  assert.equal(JSON.stringify(after), JSON.stringify(before), "the witnessed document is carried byte for byte");
  /* A verified register with no chain: found by C-18.9 (provenance's arm) before, clean after the applied rebuild. */
  const w2 = world();
  const v = "INFO-2026-0001-x";
  const archive = "https://web.archive.org/web/20260719192109/https://example.org/snapshots/a.txt";
  assert.equal(w2.promoteInfo(v, { captures: [cap], state: "verified", docs: [provDoc(cap, { co_archive: archive })], pkg: { replay: true } }).ok, true);
  const findingsOf = () => {
    const img = w2.record.readImage(v);
    return registerChecks({ files: new Map(Object.entries(img)), fm: parseFrontmatter(img["bundle.md"]).data })
      .filter((x) => x.check === "C-18.9");
  };
  assert.deepEqual(findingsOf().map((x) => x.code), ["chain-absent"], "found before the rebuild");
  const applied = w2.routes.provenanceChainRebuild({ bundleId: v, apply: true, author: V("riley"), viewer: V("riley") });
  assert.deepEqual([applied.ok, applied.applied, applied.changed], [true, true, 1], JSON.stringify(applied));
  const doc = JSON.parse(w2.record.readFile(v, "data/provenance.json").text).documents[0];
  assert.equal(JSON.stringify(doc.provenance_chain).includes("web.archive.org"), false, "the co-archive did not become a hop");
  assert.equal(doc.co_archive, archive, "the co-archive is still recorded on the document, untouched");
  assert.match(doc.provenance_chain[0].who, /^instance test-instance /);
  assert.equal(doc.provenance_chain[0].asserts, `these bytes were served for https://example.org/${cap.path} at 2026-09-27T00:00:00Z`);
  assert.deepEqual(findingsOf(), [], "C-18.9 is satisfied afterwards");
});

test("R2: the rebuild's refusal and report carry the bundle's standing route mark", () => {
  const w = world();
  const cap = w.cap("a");
  const id = "INFO-2026-0001-n";
  assert.equal(w.promoteInfo(id, { captures: [cap], docs: [{ ...provDoc(cap), locator: "in hand" }] }).ok, true);
  w.routes.provenanceRouteAssess({ bundleId: id, author: V("riley"), viewer: V("riley") });
  const chain = w.routes.provenanceChainRebuild({ bundleId: id, author: V("riley"), viewer: V("riley") });
  assert.deepEqual([chain.reason, chain.route.marked, chain.route.note], ["EVIDENCE_INSUFFICIENT", true, ROUTE_MARK_NOTE]);
  assert.match(chain.detail, /op=provenanceroute records a standing marker/);
});

test("R1, R2, R4 (K581): the rebuild reconstructs a chainless doorbell document from its receipt, and the route mark reads it derivable; without the receipt both say undetermined", () => {
  const w = world();
  const knockDoc = (k, receipt) => {
    const bytes = `handed in ${k}`;
    return { bytes, doc: { file: `snapshots/${k}`, locator: `knock:${k}`, retrieved: "2026-09-30T12:00:00Z",
      authority_state: "undetermined", authority_basis: "handed in at the doorbell; no authority is asserted",
      capture: { method: "doorbell knock", grade: null, grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED", actor_class: "member",
                 sha256: sha(bytes), encoding: "binary", bytes: Buffer.byteLength(bytes) },
      source: { kind: "knocker", ...(receipt ? { receipt: { knock_id: k, sha256: sha(bytes), received: "2026-09-30T11:00:00Z" } } : {}) },
      origin: { kind: "doorbell", knock_id: k } } };
  };
  const file = (id, { bytes, doc }) => {
    const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `s-${id}`, author: "member:ruth",
      meta: { object_type: "information" },
      files: [{ path: "bundle.md", text: infoMd(id) }, { path: "data/provenance.json", text: JSON.stringify({ documents: [doc] }) },
              { path: doc.file, blobSha: sha(bytes), sha256: sha(bytes), bytes: Buffer.byteLength(bytes) }] });
    assert.equal(r.ok, true, JSON.stringify(r));
  };
  file("INFO-2026-0001-knock", knockDoc("KNOCK-A", true));
  file("INFO-2026-0002-knock", knockDoc("KNOCK-B", false));
  const ask = (id) => ({ rebuild: w.routes.provenanceChainRebuild({ bundleId: id, author: V("ruth"), viewer: V("ruth") }),
                         mark: w.routes.provenanceRouteAssess({ bundleId: id, author: V("ruth"), viewer: V("ruth") }) });
  const a = ask("INFO-2026-0001-knock");
  assert.deepEqual([a.rebuild.ok, a.rebuild.changed, a.rebuild.documents[0].outcome], [true, 1, "reconstructed"]);
  assert.deepEqual([a.mark.route.finding, a.mark.documents[0].outcome], ["PRESENT", "derivable"]);
  const applied = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-knock", apply: true, author: V("ruth"), viewer: V("ruth") });
  assert.equal(applied.applied, true, JSON.stringify(applied));
  const chain = JSON.parse(w.record.readFile("INFO-2026-0001-knock", "data/provenance.json").text).documents[0].provenance_chain;
  assert.deepEqual(chain.map((h) => [h.via, h.asserts]), [["doorbell", "these bytes were received for knock:KNOCK-A at 2026-09-30T11:00:00Z"]]);
  const b = ask("INFO-2026-0002-knock");
  assert.deepEqual([b.rebuild.ok, b.rebuild.reason, b.rebuild.documents[0].outcome], [false, "EVIDENCE_INSUFFICIENT", "undetermined"]);
  assert.match(b.rebuild.documents[0].missing[0], /source\.receipt/);
  assert.deepEqual([b.mark.route.finding, b.mark.documents[0].outcome], ["LOOKED_INDETERMINATE", "undetermined"]);
});

test("R1, R2, R4 (K2457): the rebuild reconstructs a chainless upload document from its receipt, and the route mark reads it derivable; without the receipt both say undetermined", () => {
  const w = world();
  const upload = (bytes, receipt) => ({ file: `snapshots/${sha(bytes)}`, locator: `upload:${sha(bytes)}`, retrieved: "2026-10-09T12:00:00Z",
    authority_state: "undetermined", authority_basis: "brought in by a member; no authority is asserted",
    capture: { method: "uploaded", grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED", actor_class: "member", actor: "member:ruth",
               sha256: sha(bytes), encoding: "binary", bytes: Buffer.byteLength(bytes) },
    source: { kind: "uploader", ...(receipt ? { receipt: { sha256: sha(bytes), bytes: Buffer.byteLength(bytes), received: "2026-10-09T11:00:00Z" } } : {}) },
    origin: { kind: "upload" },
    origin_statement: { text: "from the clerk", words_of: "member:ruth", evidence_of_truth: false } });
  const file = (id, bytes, doc) => {
    const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `s-${id}`, author: "member:ruth",
      meta: { object_type: "information" },
      files: [{ path: "bundle.md", text: infoMd(id) }, { path: "data/provenance.json", text: JSON.stringify({ documents: [doc] }) },
              { path: doc.file, blobSha: sha(bytes), sha256: sha(bytes), bytes: Buffer.byteLength(bytes) }] });
    assert.equal(r.ok, true, JSON.stringify(r));
  };
  file("INFO-2026-0001-up", "held A", upload("held A", true));
  file("INFO-2026-0002-up", "held B", upload("held B", false));
  const ask = (id) => ({ rebuild: w.routes.provenanceChainRebuild({ bundleId: id, author: V("ruth"), viewer: V("ruth") }),
                         mark: w.routes.provenanceRouteAssess({ bundleId: id, author: V("ruth"), viewer: V("ruth") }) });
  const a = ask("INFO-2026-0001-up");
  assert.deepEqual([a.rebuild.ok, a.rebuild.changed, a.rebuild.documents[0].outcome], [true, 1, "reconstructed"]);
  assert.deepEqual([a.mark.route.finding, a.mark.documents[0].outcome], ["PRESENT", "derivable"]);
  const applied = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-up", apply: true, author: V("ruth"), viewer: V("ruth") });
  assert.equal(applied.applied, true, JSON.stringify(applied));
  const doc = JSON.parse(w.record.readFile("INFO-2026-0001-up", "data/provenance.json").text).documents[0];
  assert.deepEqual(doc.provenance_chain.map((h) => [h.via, h.asserts]),
                   [["upload", localize("provenance-routes.index.these_bytes_were_received_for_2", "these bytes were received for upload:{rsha} at {received}",
                                        { rsha: sha("held A"), received: "2026-10-09T11:00:00Z" })]]);
  assert.deepEqual(doc.origin_statement, { text: "from the clerk", words_of: "member:ruth", evidence_of_truth: false },
                   "her statement is carried as it was, never moved into the chain");
  /* Negative control: without the receipt, neither reconstructs. */
  const b = ask("INFO-2026-0002-up");
  assert.deepEqual([b.rebuild.ok, b.rebuild.reason, b.rebuild.documents[0].outcome], [false, "EVIDENCE_INSUFFICIENT", "undetermined"]);
  assert.match(b.rebuild.documents[0].missing[0], /upload's receipt/);
  assert.deepEqual([b.mark.route.finding, b.mark.documents[0].outcome], ["LOOKED_INDETERMINATE", "undetermined"]);
});

test("R3: a machine identity is refused by name before anything is read", () => {
  const w = world();
  twoDocs(w, "INFO-2026-0001-x", { secondRouted: true });
  const exec = w.st.sql.exec.bind(w.st.sql);
  let reads = 0;
  w.st.sql.exec = (q, ...a) => { reads++; return exec(q, ...a); };
  for (const who of ["token:member", "class:admin", "ai", "daemon", "session", "member"]) {
    const r = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-x", author: who, viewer: V("x") });
    assert.equal(r.reason, "NO_AUTHOR", who);
    assert.match(r.detail, /machine credential/, who);
  }
  for (const who of ["", "   ", null, undefined]) {
    const r = w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-x", author: who, viewer: V("x") });
    assert.deepEqual([r.reason, /named act/.test(r.detail)], ["NO_AUTHOR", true], String(who));
  }
  assert.equal(reads, 0, "nothing was read for a refused author");
  w.st.sql.exec = exec;
  /* Negative control: a named member goes on to the bundle. */
  assert.equal(w.routes.provenanceChainRebuild({ bundleId: "INFO-2026-0001-x", author: V("ruth"), viewer: V("ruth") }).ok, true);
});
