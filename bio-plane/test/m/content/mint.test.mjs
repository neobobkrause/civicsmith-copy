/* content: the capture a citation addresses (R11), the mint (R12–R14), the credential's mint act (R15, R16), and the
   invariants about rows (R34–R36, R39). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, MIXED, LAYER } from "./fixture.mjs";
import { CONTENT_TABLES, contentIdFor, CONTENT_MINT_STATES, mintLabel } from "../../../src/content/index.mjs";

const DOC = "INFO-2026-0001-a";

test("R11: an authored capture held wins, one not held answers null; otherwise the first-held capture, never the newest; none is null", () => {
  const w = world();
  const a = w.cap("a"), b = w.cap("b");
  w.doc(DOC, [a]);
  w.clock.now = "2026-09-27T04:00:00.000Z";
  w.doc("INFO-2026-0002-b", [b]);
  /* a second capture registered LATER under the first bundle: the first-held one still answers */
  const r2 = w.promotion.promote({ bundleId: DOC, base: w.record.head(DOC).bundleSha, snapKey: "k2", author: "member:alice",
    files: [{ path: "bundle.md", text: w.record.readFile(DOC, "bundle.md").text }, { path: a.path, text: a.text },
            { path: "snapshots/c.txt", text: "bytes of c" },
            { path: "data/provenance.json", text: w.record.readFile(DOC, "data/provenance.json").text }],
    meta: { object_type: "information" },
    register: [{ sha256: w.cap("c").sha, path: "snapshots/c.txt", bytes: Buffer.byteLength("bytes of c") }] });
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(w.content.captureFor(DOC), a.sha, "the first held, never the newest");
  assert.equal(w.content.captureFor(DOC, w.cap("c").sha), w.cap("c").sha, "an authored capture held wins");
  assert.equal(w.content.captureFor(DOC, ` ${a.sha} `), a.sha);
  assert.equal(w.content.captureFor(DOC, b.sha), null, "an authored capture NOT held for this bundle is never replaced");
  assert.equal(w.content.captureFor(DOC, "f".repeat(64)), null);
  w.inquiry("INQ-2026-0001-q");
  assert.equal(w.content.captureFor("INQ-2026-0001-q"), null);
  assert.equal(w.content.captureFor("INFO-2026-0099-none"), null);
  /* provenance holds none: the captures the bundle's readings carry (extraction R51), in their order */
  w.doc("INFO-2026-0003-read", []);
  w.ex.readFor["INFO-2026-0003-read"] = ["1".repeat(64), "2".repeat(64)];
  assert.equal(w.content.captureFor("INFO-2026-0003-read"), "1".repeat(64));
  assert.equal(w.content.captureFor("INFO-2026-0003-read", "2".repeat(64)), "2".repeat(64), "an authored capture a reading carries");
  assert.equal(w.content.captureFor("INFO-2026-0003-read", "3".repeat(64)), null);
  w.ex.readFor[DOC] = ["1".repeat(64)];
  assert.equal(w.content.captureFor(DOC), a.sha, "provenance first: readings are asked only when it holds none");
});

test("R12: mint refuses as R7 against the capture's context, else writes the row with its id, ref, chain, cap, page count, minter, instant and cited_as", () => {
  const w = world();
  const a = w.cap("a");
  w.doc(DOC, [a]);
  const chain = [{ step: "layer", tier: 1, cap: null }, { step: "ocr", engine: "t", version: "1", cap: "C", measured_by: "m" }];
  w.read(a.sha, { chain, pageCount: 4 });
  const refused = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "pdf-page", page: 4 }, mintedBy: V("bo") });
  assert.equal(refused.code, "CONTENT_EXTENT_OUT_OF_RANGE");
  assert.equal(w.count("content"), 0, "a refusal writes nothing");
  const e = { kind: "pdf-page", page: 2, rect: [5, 5, 1, 1] };
  const m = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: e, mintedBy: V("bo"), at: "2026-09-01T00:00:00Z" });
  assert.deepEqual([m.ok, m.minted, m.content_id], [true, true, contentIdFor(a.sha, e, chain)]);
  const row = w.row(`SELECT * FROM content WHERE content_id=?`, m.content_id);
  assert.deepEqual({ ...row, chain: JSON.parse(row.chain), extent: JSON.parse(row.extent) }, {
    content_id: m.content_id, capture_sha: a.sha, bundle_id: DOC, extent_kind: "pdf-page",
    extent: { kind: "pdf-page", page: 2, rect: [1, 1, 5, 5] }, ref: "page 3, a region of it", chain,
    derivation_cap: "C", page_count: 4, minted_by: V("bo"), at: "2026-09-01T00:00:00Z", stale: 0, cited_as: "text",
    chain_kind: "ocr" });
  /* the cap is asked of the extent: a mixed chain's text-layer page is undetermined, stated as NULL */
  const b = w.cap("b"); w.doc("INFO-2026-0002-b", [b]); w.read(b.sha, { chain: MIXED, pageCount: 3 });
  const p0 = w.content.mint({ bundleId: "INFO-2026-0002-b", captureSha: b.sha, extent: { kind: "pdf-page", page: 0 }, mintedBy: "plane" });
  const p2 = w.content.mint({ bundleId: "INFO-2026-0002-b", captureSha: b.sha, extent: { kind: "pdf-page", page: 2 }, mintedBy: "plane" });
  assert.equal(w.row(`SELECT derivation_cap FROM content WHERE content_id=?`, p0.content_id).derivation_cap, null);
  assert.equal(w.row(`SELECT derivation_cap FROM content WHERE content_id=?`, p2.content_id).derivation_cap, "C");
  /* bytes: chain and cap null by meaning */
  w.read(a.sha, { chain, pageCount: 4, containerExtent: { container: "docx", levels: ["images"], images: [{ part: "e".repeat(64) }] }, captureFormat: "docx" });
  const img = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "image", part: "e".repeat(64) }, mintedBy: V("bo") });
  assert.equal(img.ok, true, JSON.stringify(img));
  const ir = w.row(`SELECT chain, derivation_cap, cited_as FROM content WHERE content_id=?`, img.content_id);
  assert.deepEqual({ ...ir }, { chain: null, derivation_cap: null, cited_as: "bytes" });
  assert.equal(img.content_id, contentIdFor(a.sha, { kind: "image", part: "e".repeat(64) }, null));
  /* an admission without its bound held says so */
  w.read(a.sha, { chain, pageCount: 4 });
  const u = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "pdf-page", page: 1, rect: [0, 0, 1, 1] }, mintedBy: V("bo") });
  assert.equal(u.undetermined.level, "page_box");
  /* no `at`: the module's clock */
  const c = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "pdf-page", page: 3 }, mintedBy: V("bo") });
  assert.equal(w.row(`SELECT at FROM content WHERE content_id=?`, c.content_id).at, "2026-09-27T03:00:00.000Z");
});

test("R13: mint or find, never rewrite: a held id answers minted:false and keeps the first minter and instant", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 2 });
  const e = { kind: "pdf-page", page: 1 };
  const first = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: e, mintedBy: V("ann"), at: "2026-01-01T00:00:00Z" });
  const before = w.snapshot();
  const again = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { ...e, ref: "another wording" }, mintedBy: "class:ai", at: "2026-09-01T00:00:00Z" });
  assert.deepEqual([again.ok, again.minted, again.content_id], [true, false, first.content_id]);
  assert.deepEqual(w.snapshot(), before, "byte for byte: the first minter and instant are kept");
});

test("R14: a row's chain_kind is how its extent was read, mixed when the covering steps differ", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { chain: MIXED, pageCount: 3 });
  const kind = (e) => w.row(`SELECT chain_kind FROM content WHERE content_id=?`,
    w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: e, mintedBy: "plane" }).content_id).chain_kind;
  assert.equal(kind({ kind: "pdf-page", page: 1 }), "layer", "a text-layer page of a document OCR also touched");
  assert.equal(kind({ kind: "pdf-page", page: 2 }), "ocr");
  assert.equal(kind({ kind: "document" }), "mixed");
  const b = w.cap("b"); w.doc("INFO-2026-0002-b", [b]); w.read(b.sha, { chain: LAYER, pageCount: 3 });
  assert.equal(w.row(`SELECT chain_kind FROM content WHERE content_id=?`,
    w.content.mint({ bundleId: "INFO-2026-0002-b", captureSha: b.sha, extent: { kind: "document" }, mintedBy: "plane" }).content_id).chain_kind, "layer");
});

test("R14: a store holding REC-104's generated chain_kind is rebuilt once, every row recomputed, nothing else changed", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { chain: MIXED, pageCount: 3 });
  const m = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "pdf-page", page: 0 }, mintedBy: "plane" });
  const kept = w.row(`SELECT content_id, extent, chain, minted_by, at FROM content`);
  /* put the old shape back: the generated column over the whole chain's last step */
  w.st.db.exec(`DROP INDEX content_chain_kind`);
  w.st.db.exec(`CREATE TABLE old AS SELECT content_id,capture_sha,bundle_id,extent_kind,extent,ref,chain,derivation_cap,page_count,minted_by,at,stale,cited_as FROM content`);
  w.st.db.exec(`DROP TABLE content`);
  w.st.db.exec(`CREATE TABLE content (content_id TEXT PRIMARY KEY, capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL,
    extent_kind TEXT NOT NULL, extent TEXT NOT NULL, ref TEXT NOT NULL, chain TEXT, derivation_cap TEXT, page_count INTEGER,
    minted_by TEXT NOT NULL, at TEXT NOT NULL, stale INTEGER NOT NULL DEFAULT 0, cited_as TEXT NOT NULL DEFAULT 'text',
    chain_kind TEXT GENERATED ALWAYS AS (json_extract(chain, '$[#-1].step')) VIRTUAL)`);
  w.st.db.exec(`INSERT INTO content SELECT * FROM old`); w.st.db.exec(`DROP TABLE old`);
  assert.equal(w.row(`SELECT chain_kind FROM content`).chain_kind, "ocr", "the old column: the whole chain's last step");
  w.content.migrate();
  assert.equal(w.row(`SELECT chain_kind FROM content WHERE content_id=?`, m.content_id).chain_kind, "layer");
  assert.deepEqual({ ...w.row(`SELECT content_id, extent, chain, minted_by, at FROM content`) }, { ...kept });
  assert.equal([...w.st.sql.exec(`PRAGMA table_xinfo(content)`)].find((c) => c.name === "chain_kind").hidden, 0);
  w.content.migrate();
  assert.equal(w.count("content"), 1, "a second boot changes nothing");
});

test("R15: contentMint's refusals in order, the extent defaulting to document, the minter the stamp", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 2 });
  const b = w.cap("b"); w.doc("INFO-2026-0002-b", []);
  w.inquiry("INQ-2026-0001-q");
  const mint = (o) => w.content.contentMint({ bundleId: DOC, mintedBy: V("bo"), viewer: V("bo"), ...o });
  assert.equal(mint({ mintedBy: "" }).reason, "NO_MINTER");
  assert.equal(mint({ mintedBy: null, bundleId: "" }).reason, "NO_MINTER", "the minter is asked first");
  assert.equal(mint({ bundleId: " " }).reason, "NO_TARGET");
  assert.equal(mint({ bundleId: "INFO-2026-0404-x" }).reason, "NO_SUCH_BUNDLE");
  const hidden = mint({ viewer: "nobody" }), absent = mint({ bundleId: "INFO-2026-0404-x", viewer: "nobody" });
  assert.deepEqual([hidden.reason, hidden.detail.replace(DOC, "X")], [absent.reason, absent.detail.replace("INFO-2026-0404-x", "X")],
    "absent and not visible are the same answer");
  assert.equal(mint({ bundleId: "INQ-2026-0001-q" }).reason, "NOT_A_DOCUMENT");
  assert.equal(mint({ bundleId: "INFO-2026-0002-b" }).reason, "NO_BYTES_HELD");
  assert.equal(mint({ extent: { kind: "pdf-page", page: 9 } }).code, "CONTENT_EXTENT_OUT_OF_RANGE");
  const ok = mint({ extent: null });
  assert.deepEqual([ok.ok, ok.minted, ok.extent_kind, ok.capture_sha, ok.minted_by], [true, true, "document", a.sha, V("bo")]);
  assert.equal(w.count("content"), 1);
  void b;
});

test("R16: every read of a row carries its mint label, member, plane, machine or unstated; a machine-marked row is machine work", () => {
  assert.deepEqual(Object.keys(CONTENT_MINT_STATES).sort(), ["machine_marked", "member_marked", "plane_minted", "unstated"]);
  assert.deepEqual(mintLabel(V("bo")), { by: V("bo"), state: "member_marked", machine_work: false, says: CONTENT_MINT_STATES.member_marked });
  assert.equal(mintLabel("plane").state, "plane_minted");
  assert.deepEqual([mintLabel("class:ai").state, mintLabel("class:ai").machine_work], ["machine_marked", true]);
  assert.equal(mintLabel("").state, "unstated");
  assert.equal(mintLabel(null).by, null);
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 2 });
  const m = w.content.contentMint({ bundleId: DOC, extent: { kind: "pdf-page", page: 0 }, mintedBy: "class:ai", viewer: "class:ai" });
  assert.deepEqual(m.mint, mintLabel("class:ai"));
  assert.deepEqual(w.content.contentRow(m.content_id).mint, mintLabel("class:ai"));
  assert.deepEqual(w.content.contentRead({ id: m.content_id, viewer: V("bo"), extras: ["id", "viewer"] }).mint, mintLabel("class:ai"));
  assert.deepEqual(w.content.standings([m.content_id])[m.content_id].mint, mintLabel("class:ai"));
  const rows = [{ content_id: m.content_id }]; w.content.projectStandings(rows);
  assert.deepEqual(rows[0].mint, mintLabel("class:ai"));
  /* never attested by a machine: the capture's attestation refuses a machine credential */
  const t = w.content.attestText({ note: "compared with the page", captureSha: a.sha, viewer: V("bo"), member: "class:ai", extent: { kind: "document" } });
  assert.equal(t.code, "TEXT_ATTEST_MACHINE");
});

test("R13, R16, R28 (N201): a member's leg on a machine-minted row lands on the machine's row, never a second one; the row keeps the machine's mark and says it is machine work", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 3 });
  const machine = w.content.contentMint({ bundleId: DOC, extent: { kind: "pdf-page", page: 1 }, mintedBy: "class:ai", viewer: "class:ai",
                                          at: "2026-09-10T00:00:00Z" });
  assert.deepEqual([machine.ok, machine.minted, machine.mint.state], [true, true, "machine_marked"]);
  const before = w.snapshot();
  /* the member's leg cites the same passage by its extent, or names the machine's row outright */
  const byExtent = { target: DOC, extent_kind: "pdf-page", extent_page: 1, at: "2026-09-20T00:00:00Z" };
  const byId = { target: DOC, content_id: machine.content_id };
  assert.deepEqual(w.content.citationRefusals([byExtent, byId], (i) => `leg[${i}]`), [], "the leg is not refused");
  const r1 = w.content.resolveCitation(byExtent), r2 = w.content.resolveCitation(byId);
  assert.deepEqual([r1.content_id, r1.minted], [machine.content_id, false], "the machine's row, found, not minted again");
  assert.deepEqual([r2.content_id, r2.minted], [machine.content_id, false]);
  assert.deepEqual(w.snapshot(), before, "no second row, and the machine's row byte for byte: its minter and instant kept");
  assert.equal(w.count("content"), 1);
  /* every read of the row the member's leg now points at labels it machine work, never the member's or the plane's */
  const row = w.content.contentRow(r1.content_id);
  assert.deepEqual([row.minted_by, row.at, row.mint], ["class:ai", "2026-09-10T00:00:00Z", mintLabel("class:ai")]);
  assert.equal(row.mint.machine_work, true);
  assert.deepEqual(w.content.contentRead({ id: r1.content_id, viewer: V("bo"), extras: ["id", "viewer"] }).mint, mintLabel("class:ai"));
  const legs = [{ content_id: r1.content_id }]; w.content.projectStandings(legs);
  assert.deepEqual([legs[0].minted_by, legs[0].mint], ["class:ai", mintLabel("class:ai")]);
  /* the over-strictness arm: a leg on a passage nothing marked mints the plane's row (R28), never labelled machine work */
  const own = w.content.resolveCitation({ target: DOC, extent_kind: "pdf-page", extent_page: 2 });
  assert.deepEqual([own.minted, w.content.contentRow(own.content_id).mint.state], [true, "plane_minted"]);
});

test("R34: a row is never rewritten or deleted but by its bundle's purge, and nothing moves a reference by itself", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 2 });
  const m = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "pdf-page", page: 1 }, mintedBy: V("bo") });
  const row = { ...w.row(`SELECT * FROM content`) };
  /* a re-read, a re-mint, a stale mark: the row stands, byte for byte but for the one-way stale flag */
  w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "pdf-page", page: 1 }, mintedBy: "plane" });
  w.content.markStale(a.sha, [{ step: "ocr", engine: "x" }]);
  assert.deepEqual({ ...w.row(`SELECT * FROM content`), stale: 0 }, { ...row, stale: 0 });
  assert.equal(w.content.contentRow(m.content_id).resolves, true);
  w.record.purge({ bundleId: "INFO-2026-0404-other" });
  assert.equal(w.count("content"), 1);
  w.record.purge({ bundleId: DOC });
  assert.equal(w.count("content"), 0);
});

test("R35: the capture grade is the document's and the cap the row's; no capture grade on a row", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 2, chain: [{ step: "layer", tier: 1, cap: "B", measured_by: "m" }] });
  const m = w.content.mint({ bundleId: DOC, captureSha: a.sha, extent: { kind: "pdf-page", page: 0 }, mintedBy: V("bo") });
  const s = w.content.standings([m.content_id])[m.content_id];
  assert.deepEqual(Object.keys(s.capture).sort(), ["from", "grain", "why"]);
  assert.equal(s.capture.grain, "document");
  assert.equal(s.capture.from, `earned.capture[${DOC}]`);
  assert.equal(s.derivation_cap, "B");
  assert.equal(s.transcription.ceiling, "B");
  assert.equal(JSON.stringify(s).includes("capture_grade"), false);
});

test("R36: a machine credential may mark a passage citable, labelled, and never attests or types; authorship is the stamp", () => {
  const w = world();
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 2 });
  assert.equal(w.content.contentMint({ bundleId: DOC, mintedBy: "class:ai", viewer: "class:ai" }).mint.machine_work, true);
  assert.equal(w.content.attestText({ note: "compared with the page", captureSha: a.sha, viewer: V("bo"), member: "class:member", extent: { kind: "document" } }).code, "TEXT_ATTEST_MACHINE");
  assert.equal(w.content.transcribe({ bundleId: DOC, extent: { kind: "document" }, text: "x", transcriber: "class:ai", viewer: "class:ai" }).code,
    "TRANSCRIBE_NOT_A_MEMBER");
  const t = w.content.transcribe({ bundleId: DOC, extent: { kind: "document" }, text: "x", transcriber: V("bo"), viewer: V("bo") });
  assert.equal(w.content.transcriptionAttest({ note: "compared with the page", contentId: t.content_id, attestor: "class:ai", viewer: "class:ai" }).code, "TEXT_ATTEST_MACHINE");
  /* authorship is the parameter the control plane stamps: no body field names it */
  const m = w.content.contentMint({ bundleId: DOC, extent: { kind: "pdf-page", page: 1 }, mintedBy: V("bo"), viewer: V("bo"), minted_by: V("mallory") });
  assert.equal(m.minted_by, V("bo"));
});

test("R39: the four tables carry bundle_id and are declared to record-core's purge", () => {
  const w = world();
  assert.deepEqual([...CONTENT_TABLES].sort(), ["content", "text_attestations", "transcription_attestations", "transcriptions"]);
  for (const t of CONTENT_TABLES)
    assert.ok([...w.st.sql.exec(`PRAGMA table_info(${t})`)].some((c) => c.name === "bundle_id"), t);
  const a = w.cap("a"); w.doc(DOC, [a]); w.read(a.sha, { pageCount: 2 });
  const b = w.cap("b"); w.doc("INFO-2026-0002-b", [b]); w.read(b.sha, { pageCount: 2 });
  for (const [id, s] of [[DOC, a.sha], ["INFO-2026-0002-b", b.sha]]) {
    const t = w.content.transcribe({ bundleId: id, extent: { kind: "pdf-page", page: 0 }, text: "words", transcriber: V("bo"), viewer: V("bo") });
    w.content.transcriptionAttest({ note: "compared with the page", contentId: t.content_id, attestor: V("cy"), viewer: V("cy") });
    w.content.attestText({ note: "compared with the page", captureSha: s, viewer: V("bo"), member: V("cy"), extent: { kind: "page", page: 0 } });
  }
  const report = w.record.purge({ bundleId: DOC });
  for (const t of CONTENT_TABLES) assert.equal(report.removed ? report.removed[t] >= 1 : true, true, t);
  for (const t of CONTENT_TABLES) assert.equal(w.count(t), 1, `${t}: only the other bundle's row is left`);
  assert.deepEqual(w.record.declarePurge("other", ["content"]).reason, "TABLE_DECLARED");
});

test("R54: the four tables are declared explicitly through declareTable, each with every class named", () => {
  const w = world();
  const mine = w.record.declaredTables().filter((d) => d.module === "content");
  assert.deepEqual(mine.map((d) => d.name).sort(), ["content", "text_attestations", "transcription_attestations", "transcriptions"]);
  for (const d of mine) {
    /* R39's purge on bundle_id, the sight of the bundle it names (R37), the rest as declarePurge's default form. */
    assert.deepEqual({ purge: d.purge, expunge: d.expunge, export: d.export, sight: d.sight, derive: d.derive,
                       version_chain: d.version_chain },
                     { purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored",
                       version_chain: false }, d.name);
    assert.equal(d.keys, undefined, `${d.name} is keyed by its bundle_id column`);
  }
  /* Negative control: a second declaration of one of them, by any module, is refused, so the declaration is held. */
  assert.equal(w.record.declareTable("other", [{ name: "transcriptions", purge: "clear", expunge: "none",
    export: "admin-only", sight: "bundle", derive: "stored", version_chain: false }]).reason, "TABLE_DECLARED");
});
