/* connections: edges between bundles (R19–R23), the `refs` read contract (R58) and the link projection (R24–R29, R32). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const A = "INFO-2026-0001-a", B = "INFO-2026-0002-b", C = "INFO-2026-0003-c";

test("R19: in the promotion's transaction the bundle's edges are replaced by its document's references[], one per (target, relation)", () => {
  const w = world();
  w.doc(A, ["a"]); w.doc(B, ["b"]);
  w.doc(C, ["c"], { references: [{ rel: "cites", target: A }, { rel: "relates_to", target: A }, { rel: "cites", target: B },
                                 { rel: "cites", target: B }] });
  assert.deepEqual(w.rows(`SELECT target_id, kind FROM refs WHERE bundle_id=? ORDER BY target_id, kind`, C),
    [{ target_id: A, kind: "cites" }, { target_id: A, kind: "relates_to" }, { target_id: B, kind: "cites" }]);
  w.revise(C, [{ rel: "supersedes", target: B }]);
  assert.deepEqual(w.rows(`SELECT target_id, kind FROM refs WHERE bundle_id=?`, C), [{ target_id: B, kind: "supersedes" }]);
  /* The replaced edges are left on the promotion's context for a later step. */
  let seen = null;
  w.promotion.registerStep("zz-later", { project: (c) => { seen = c.refsReplaced; return null; } });
  w.revise(C, []);
  assert.deepEqual(seen, [{ target_id: B, kind: "supersedes" }]);
  assert.equal(w.count("refs"), 0);
  /* A refused promotion leaves the edges as they were (one transaction). */
  w.revise(C, [{ rel: "cites", target: A }]);
  w.promotion.registerStep("zz-refuse", { check: () => ({ ok: false, reason: "NO" }) });
  assert.throws(() => w.revise(C, []));
  assert.deepEqual(w.rows(`SELECT target_id FROM refs WHERE bundle_id=?`, C), [{ target_id: A }]);
});

test("R58 (N213): refs is a stated read contract — bundle_id the citing bundle, target_id the target, kind the relation, as R19 and R24 write them; no severance column", () => {
  const w = world();
  /* The columns a later module joins, by name, and no others: severance is asked of edgeSevered (R22), never read here. */
  assert.deepEqual(w.rows(`PRAGMA table_info(refs)`).map((c) => c.name).sort(), ["bundle_id", "kind", "target_id"]);
  w.doc(A, ["a"]); w.doc(B, ["b"]);
  w.doc(C, ["c"], { references: [{ rel: "cites", target: A }, { rel: "supersedes", target: B },
                                 { rel: "cites", target: B, status: "severed" }] });
  /* R19's meaning: one row per (citing bundle, target, relation) of the citing document's references[]. */
  assert.deepEqual(w.rows(`SELECT bundle_id, target_id, kind FROM refs ORDER BY target_id, kind`),
    [{ bundle_id: C, target_id: A, kind: "cites" }, { bundle_id: C, target_id: B, kind: "cites" },
     { bundle_id: C, target_id: B, kind: "supersedes" }]);
  /* A severed entry is still an edge; whether it is severed is R22's answer, not a column. */
  assert.equal(w.k.edgeSevered(C, B, "cites"), true);
  assert.deepEqual(w.k.citesInto(B), { confirmed: [], severed: [C] });
  /* A reader's join, as inquiry, publication and ratification write it: who cites a target, by relation. */
  assert.deepEqual(w.rows(`SELECT r.bundle_id FROM refs r JOIN bundles b ON b.bundle_id = r.bundle_id
                            WHERE r.target_id = ? AND r.kind = 'cites'`, A), [{ bundle_id: C }]);
  /* R24's meaning: a source's resolved link is a row of kind links_to, the source bundle citing its target. */
  const [src] = w.doc("INFO-2026-0009-s", ["the source"]);
  const [tgt] = w.doc("INFO-2026-0010-t", ["the target"]);
  w.receipt("https://example.org/t", tgt);
  w.links(src, "INFO-2026-0009-s", ["https://example.org/t"]);
  const r = w.k.projectLinks({ sourceCapture: src, viewer: MACHINE });
  assert.equal(r.projected, 1);
  assert.deepEqual(w.rows(`SELECT bundle_id, target_id, kind FROM refs WHERE kind='links_to'`),
    [{ bundle_id: "INFO-2026-0009-s", target_id: "INFO-2026-0010-t", kind: "links_to" }]);
});

test("R20: NO_TARGET; a target the viewer cannot see answers as an absent one; every visible citer with relation, type, title, state and the edge's status; a withheld citer is withheld whole, stated only as out_of_view: true", () => {
  const w = world();
  w.member("alice"); w.member("bob");
  w.doc(A, ["a"]);
  w.doc(B, ["b"], { references: [{ rel: "cites", target: A, status: "severed", note: "withdrawn" }] });
  w.doc(C, ["c"], { references: [{ rel: "cites", target: A }] });
  const none = w.k.backlinks({ viewer: V("bob") });
  assert.equal(none.reason, "NO_TARGET");
  assert.equal(none.detail, localize("connections.index.backlinks_need_target", "backlinks are asked of an object: pass target=<record id>"));
  const r = w.k.backlinks({ target: A, viewer: V("bob") });
  /* Every citer visible: no out_of_view key at all. */
  assert.equal("out_of_view" in r, false);
  assert.deepEqual(r.backlinks.map((x) => [x.from, x.rel, x.status, x.note]),
    [[B, "cites", "severed", "withdrawn"], [C, "cites", "confirmed", ""]]);
  assert.equal(r.backlinks[0].from_type, "information"); assert.equal(r.backlinks[0].from_title, `Document ${B}`);
  assert.equal(r.backlinks[0].from_state, "collected");
  /* A citer hidden from the viewer is not listed and nothing of it is given (id, title, type, state, relation, count);
     the answer says only that one was withheld (DEC-36). */
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, C);
  const hidden = w.k.backlinks({ target: A, viewer: V("bob") });
  assert.deepEqual(hidden.backlinks.map((x) => x.from), [B]);
  assert.equal(JSON.stringify(hidden).includes(C), false);
  assert.equal(hidden.out_of_view, true);
  assert.deepEqual(Object.keys(hidden).sort(), ["backlinks", "ok", "out_of_view", "target"], "no count, no other key");
  assert.deepEqual(hidden.backlinks, r.backlinks.filter((x) => x.from !== C), "the visible citers exactly as before");
  /* Two hidden citers answer exactly as one: nothing counts them. */
  w.doc("INFO-2026-0004-d", ["d"], { references: [{ rel: "relates_to", target: A }] });
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, "INFO-2026-0004-d");
  assert.deepEqual(w.k.backlinks({ target: A, viewer: V("bob") }), hidden);
  /* A viewer who sees every citer (a machine) is told of none withheld. */
  const all = w.k.backlinks({ target: A, viewer: MACHINE });
  assert.equal("out_of_view" in all, false); assert.equal(all.backlinks.length, 3);
  /* A project's owner sees its edge, and nothing is withheld from them; bob is still told only that one was. */
  for (const id of [C, "INFO-2026-0004-d"]) w.st.sql.exec(`UPDATE bundles SET object_type='information' WHERE bundle_id=?`, id);
  const p = w.project("Alice's work", "alice");
  w.st.sql.exec(`INSERT INTO refs (bundle_id, target_id, kind) VALUES (?, ?, 'cites')`, p, A);
  const alice = w.k.backlinks({ target: A, viewer: V("alice") });
  assert.equal(alice.backlinks.some((x) => x.from === p), true); assert.equal("out_of_view" in alice, false);
  const bob = w.k.backlinks({ target: A, viewer: V("bob") });
  assert.equal(bob.out_of_view, true); assert.equal(JSON.stringify(bob).includes(p), false);
  /* A target nobody cites: no backlinks and no out_of_view key. */
  const lone = w.k.backlinks({ target: "INFO-2026-0004-d", viewer: V("bob") });
  assert.deepEqual(lone, { ok: true, target: "INFO-2026-0004-d", backlinks: [] });
  const absent = w.k.backlinks({ target: "INFO-2026-0404-z", viewer: V("bob") });
  const unseen = w.k.backlinks({ target: p, viewer: V("bob") });
  assert.deepEqual({ ...absent, target: null }, { ...unseen, target: null });
  assert.equal(absent.reason, "NO_SUCH_DOCUMENT");
  /* An unreadable citing document, or an unrecorded entry, reads confirmed. */
  w.st.sql.exec(`INSERT INTO refs (bundle_id, target_id, kind) VALUES (?, ?, 'relates_to')`, B, A);
  assert.equal(w.k.backlinks({ target: A, viewer: MACHINE }).backlinks.find((x) => x.rel === "relates_to").status, "confirmed");
});

test("R21: dangling lists every edge whose target no bundle holds (C-6.2), a hidden citing bundle's edge withheld whole", () => {
  const w = world();
  w.member("bob");
  w.doc(A, ["a"], { references: [{ rel: "cites", target: "INFO-2026-0404-gone" }] });
  w.doc(B, ["b"], { references: [{ rel: "cites", target: "INFO-2026-0405-gone" }, { rel: "cites", target: A }] });
  assert.deepEqual(w.k.dangling(V("bob")).map((r) => [r.bundle_id, r.target_id]).sort(),
    [[A, "INFO-2026-0404-gone"], [B, "INFO-2026-0405-gone"]]);
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, B);
  assert.deepEqual(w.k.dangling(V("bob")).map((r) => r.bundle_id), [A]);
  assert.equal(w.k.dangling(null).length, 0, "an absent viewer sees nothing");
  assert.equal(w.k.dangling(MACHINE).length, 2);
});

test("R22: edgeSevered is true only when the citing document records the entry severed; citesInto partitions cites edges, sorted", () => {
  const w = world();
  w.doc(A, ["a"]);
  w.doc(C, ["c"], { references: [{ rel: "cites", target: A }] });
  w.doc(B, ["b"], { references: [{ rel: "cites", target: A, status: "severed" }, { rel: "relates_to", target: C }] });
  assert.equal(w.k.edgeSevered(B, A), true);
  assert.equal(w.k.edgeSevered(B, A, "cites"), true);
  assert.equal(w.k.edgeSevered(B, A, "relates_to"), false, "no such entry: live");
  assert.equal(w.k.edgeSevered(C, A), false);
  assert.equal(w.k.edgeSevered("INFO-2026-0404-z", A), false, "an unreadable document is live");
  assert.deepEqual(w.k.citesInto(A), { confirmed: [C], severed: [B] });
  w.doc("INFO-2026-0000-z", ["z"], { references: [{ rel: "cites", target: A }] });
  assert.deepEqual(w.k.citesInto(A).confirmed, ["INFO-2026-0000-z", C]);
});

test("R23: registered with promotion as the fact citedBy: the confirmed citers", () => {
  const w = world();
  w.doc(A, ["a"]);
  w.doc(B, ["b"], { references: [{ rel: "cites", target: A }] });
  w.doc(C, ["c"], { references: [{ rel: "cites", target: A, status: "severed" }] });
  assert.deepEqual(w.promotion.fact("citedBy", A), { ok: true, fact: "citedBy", value: [B] });
  assert.deepEqual(w.k.citedBy(A), [B]);
});

/* A source document S (its capture captured at noon on the 26th) linking to two addresses. */
function linked(w, { targetAt = "2026-09-26T00:00:00Z" } = {}) {
  const [s] = w.doc(A, ["source"]);
  const [t] = w.doc(B, ["target"]);
  w.receipt("https://example.org/b", t, targetAt);
  w.links(s, A, ["https://example.org/b", "https://example.org/not-held", "https://example.org/a"]);
  w.receipt("https://example.org/a", s, "2026-09-26T12:00:00Z");
  return { s, t };
}

test("R24: only a linked link whose target a bundle registered becomes a links_to edge, asserted by the source; self dropped; unregistered counted", () => {
  const w = world();
  const { s } = linked(w);
  /* A held capture no bundle claims: acquired, not promoted. */
  w.receipt("https://example.org/unclaimed", "9".repeat(64));
  w.links(s, A, ["https://example.org/b", "https://example.org/not-held", "https://example.org/a", "https://example.org/unclaimed"]);
  const r = w.k.projectLinks({ sourceCapture: s, viewer: MACHINE });
  assert.equal(r.projected, 1);
  assert.deepEqual(r.edges.map((e) => [e.from, e.to, e.rel, e.asserted_by]), [[A, B, "links_to", "source"]]);
  assert.equal(r.edges[0].address, "https://example.org/b");
  assert.ok(r.edges[0].verdict && r.edges[0].basis);
  assert.equal(r.skipped_self, 1);
  assert.equal(r.skipped_unregistered, 1);
  assert.equal(r.unresolved, 1);
  assert.deepEqual(w.rows(`SELECT target_id, kind FROM refs WHERE bundle_id=?`, A), [{ target_id: B, kind: "links_to" }]);
  assert.equal(w.count("refs"), 1, "never cites");
});

test("R25: a capture not registered to a bundle writes nothing and says so", () => {
  const w = world();
  w.doc(B, ["target"]);
  const loose = "7".repeat(64);
  w.receipt("https://example.org/loose", loose);
  w.links(loose, null, ["https://example.org/b"]);
  const before = w.snapshot(["refs", "asserted_connections", "bundles"]);
  const r = w.k.projectLinks({ sourceCapture: loose, viewer: MACHINE });
  assert.equal(r.projected, 0);
  assert.equal(r.note, localize("connections.note.capture_registered_record", "this capture is not registered to a record, so there is no canonical source to hang an edge on"));
  assert.deepEqual(w.snapshot(["refs", "asserted_connections", "bundles"]), before);
});

test("R26: through the viewer — a hidden source answers as one not held and writes nothing; a hidden target is neither listed nor counted; an absent viewer fails closed", () => {
  const w = world();
  w.member("alice"); w.member("bob");
  const { s } = linked(w);
  const before = w.snapshot(["refs", "asserted_connections", "files"]);
  const absent = w.k.projectLinks({ sourceCapture: s, viewer: null });
  assert.deepEqual(absent, { projected: 0, edges: [] });
  assert.deepEqual(w.snapshot(["refs", "asserted_connections", "files"]), before);
  /* The source's bundle becomes hidden from bob: answered as a capture the record does not hold. */
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, A);
  assert.deepEqual(w.k.projectLinks({ sourceCapture: s, viewer: V("bob") }), { projected: 0, edges: [] });
  assert.deepEqual(w.snapshot(["refs", "asserted_connections", "files"]), before);
  w.st.sql.exec(`UPDATE bundles SET object_type='information' WHERE bundle_id=?`, A);
  /* The target hidden: not listed, not counted anywhere. */
  w.st.sql.exec(`UPDATE bundles SET object_type='project' WHERE bundle_id=?`, B);
  const r = w.k.projectLinks({ sourceCapture: s, viewer: V("bob") });
  assert.equal(r.projected, 0); assert.equal(r.skipped_unregistered, 0);
  assert.equal(JSON.stringify(r).includes(B), false);
});

test("R27, R33: it writes exactly the edges its answer names; a bundle the viewer cannot see, or none held, is refused as not held", () => {
  const w = world();
  w.member("alice"); w.member("bob");
  const { s } = linked(w);
  const p = w.project("Carol's work", "alice");
  const refusedHidden = w.k.projectLinks({ sourceCapture: s, sourceBundle: p, viewer: V("bob"), identity: V("bob") });
  const refusedNone = w.k.projectLinks({ sourceCapture: s, sourceBundle: "INFO-2026-0404-z", viewer: V("bob"), identity: V("bob") });
  assert.equal(refusedHidden.reason, "NO_SUCH_DOCUMENT"); assert.equal(refusedNone.reason, "NO_SUCH_DOCUMENT");
  assert.deepEqual({ ...refusedHidden, target: 0 }, { ...refusedNone, target: 0 });
  assert.equal(w.count("refs"), 0);
  /* A project source needs the actor to have joined it (REC-134). */
  w.member("carl");
  const joined = w.k.projectLinks({ sourceCapture: s, sourceBundle: p, viewer: V("alice"), identity: V("carl") });
  assert.equal(joined.ok, false); assert.equal(joined.reason, "PROJECT_ACT_NOT_A_PARTICIPANT");
  const r = w.k.projectLinks({ sourceCapture: s, viewer: V("bob"), identity: V("bob") });
  assert.deepEqual(w.rows(`SELECT bundle_id, target_id FROM refs WHERE kind='links_to'`).map((x) => x.target_id),
                   r.edges.map((e) => e.to));
});

test("R28: a projected links_to edge becomes a references[] entry of the source document and survives the source's later promotions", () => {
  const w = world();
  const { s } = linked(w);
  const r = w.k.projectLinks({ sourceCapture: s, viewer: MACHINE, identity: V("alice") });
  assert.equal(r.promoted, true); assert.equal(r.references_written, 1);
  const md = w.record.readFile(A, "bundle.md").text;
  /* C-6.1's links_to arm: the entry is the source's on its face, with the address and a contemporaneity verdict. */
  assert.match(md, /- rel: links_to\n    target: INFO-2026-0002-b\n    status: confirmed\n    asserted_by: source\n    address: "https:\/\/example.org\/b"\n    verdict: (contemporaneous|superseded|undetermined)\n    note: "https:\/\/example.org\/b"/);
  assert.match(md, /## Session Log[\s\S]*member:alice/);
  assert.equal(w.record.readFile(A, "snapshots/c0.txt").text, "source", "every other file carried");
  /* The source is promoted again, carrying its document: the edge stays. */
  const head = w.record.head(A);
  const files = w.record.livePaths(A).map((p) => ({ path: p, text: w.record.readFile(A, p).text }));
  assert.equal(w.promotion.promote({ bundleId: A, base: head.bundleSha, snapKey: "again", author: "member:alice", files,
                                     meta: { object_type: "information" } }).ok, true);
  assert.deepEqual(w.rows(`SELECT target_id, kind FROM refs WHERE bundle_id=?`, A), [{ target_id: B, kind: "links_to" }]);
  /* Projecting again writes nothing new. */
  const again = w.k.projectLinks({ sourceCapture: s, viewer: MACHINE });
  assert.equal(again.promoted, false); assert.equal(again.references_written, 0);
});

test("R29: when a target is promoted, the resolved links that point at it become edges", async () => {
  const w = world();
  const [s] = w.doc(A, ["source"]);
  w.links(s, A, ["https://example.org/later"]);
  assert.equal(w.k.projectLinks({ sourceCapture: s, viewer: MACHINE }).projected, 0);
  /* The target is fetched, then promoted: its register row names the capture the link resolves to. */
  const later = "later bytes";
  const { createHash } = await import("node:crypto");
  const lsha = createHash("sha256").update(later).digest("hex");
  w.receipt("https://example.org/later", lsha, "2026-09-26T00:00:00Z");
  w.doc(C, [later]);
  await w.settle(); await w.settle();
  assert.deepEqual(w.rows(`SELECT target_id, kind FROM refs WHERE bundle_id=?`, A), [{ target_id: C, kind: "links_to" }]);
  assert.match(w.record.readFile(A, "bundle.md").text, /target: INFO-2026-0003-c/);
});

test("R32, R54: a source's own link between two held documents is an A connection, asserted by the source, apart from derived rows; undetermined timing labelled", () => {
  const w = world();
  const { s } = linked(w);
  w.k.projectLinks({ sourceCapture: s, viewer: MACHINE });
  assert.equal(w.count("connections"), 0, "kept apart from the system's derived connections");
  const a = w.k.asserted({ bundleId: A, viewer: MACHINE });
  assert.equal(a.source.length, 1);
  const c = a.source[0];
  assert.equal(c.grade, "A"); assert.equal(c.asserted_by, "source"); assert.equal(c.established, true);
  assert.equal(c.a_bundle_id, A); assert.equal(c.b_bundle_id, B);
  assert.equal(c.timing, "undetermined", "one capture of the target, before the source: undetermined");
  assert.equal(c.timing_says, localize("connections.version_target_source_pointed", "which version of its target the source pointed at is undetermined"));
  /* The target seen on both sides of the source's retrieval: contemporaneous. */
  const w2 = world();
  const [s2] = w2.doc(A, ["source"]);
  const [t2] = w2.doc(B, ["target"]);
  w2.receipt("https://example.org/b", t2, "2026-09-26T00:00:00Z");
  w2.receipt("https://example.org/b", t2, "2026-09-27T00:00:00Z");
  w2.links(s2, A, ["https://example.org/b"]);
  w2.k.projectLinks({ sourceCapture: s2, viewer: MACHINE });
  assert.equal(w2.k.asserted({ bundleId: B, viewer: MACHINE }).source[0].timing, "contemporaneous");
});
