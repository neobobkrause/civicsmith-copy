/* provenance: files cut out of a captured archive (N688; K1844, K1852). Their receipts (R15) and the read contract's
   `unpacked` rows (R48); the capture axis a file earns, its archive's answer passed through (R59); and C-18.1's
   `unpacked` document with its `container` block (R42). The receipts are written here as `acquisition.unpack` writes
   them (its R38): `acquisition` is later in the order, so its tests drive the two together. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, provDoc, infoMd } from "./fixture.mjs";
import { ARCHIVE_VIA, DOORBELL_VIA, UPLOAD_VIA, UNPACKED_VIA, UNPACKED_METHOD, UNPACKED_FROM_ARCHIVE, UNPACKED_UNRESOLVED, registerChecks, withRegisterChecks } from "../../../src/provenance/index.mjs";
import * as P from "../../../src/provenance/index.mjs";
import { ARCHIVE_DEPTH_MAX } from "../../../src/ooxml.mjs";
import { EARNED_CAPTURE_CEILING, TESTIMONY_GRADE, parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const T = (h) => `2026-09-27T${String(h).padStart(2, "0")}:00:00Z`;
const ADDR = "https://e.org/minutes.zip", NORM = "e.org/minutes.zip";

/* One file's receipt, as R15 states unpack writes it. */
function cut(w, archiveSha, index, fileSha, { address = ADDR, norm = NORM, at = T(2) } = {}) {
  return w.prov.recordReceipt({ address: `${address}#zip:${index}`, addressNorm: `${norm}#zip:${index}`, captureSha: fileSha,
                                retrieved: at, via: UNPACKED_VIA, retrievalLocator: `zip:${archiveSha}!${index}` });
}
const bare = (g) => { const { why, ...rest } = g; return rest; };

test("R15, R48: an unpacked receipt sits at the archive's address plus #zip:<index>, so a file is never a version of its archive", () => {
  assert.equal(UNPACKED_VIA, "unpacked", "the one spelling");
  const w = world();
  const archive = w.cap("archive", "PK archive bytes"), file = w.cap("member", "a member's bytes");
  w.promoteInfo("INFO-2026-0001-zip", { captures: [archive, file] });
  w.prov.recordReceipt({ address: ADDR, addressNorm: NORM, captureSha: archive.sha, retrieved: T(1) });
  const r = cut(w, archive.sha, 3, file.sha);
  assert.deepEqual([r.recorded, r.via, r.observation, r.address_norm], [true, "unpacked", "new", `${NORM}#zip:3`]);
  /* The read contract's columns, as R48 states them for an unpacked row. */
  assert.deepEqual({ ...w.row(`SELECT * FROM captured_locators WHERE via = 'unpacked'`) }, {
    address_norm: `${NORM}#zip:3`, address: `${ADDR}#zip:3`, capture_sha: file.sha, via: "unpacked",
    retrieval_locator: `zip:${archive.sha}!3`, first_retrieved: T(2), last_retrieved: T(2), observations: 1,
    reputation: null, uploads: null });
  /* A reader seeking the archive's address finds the archive alone; the file answers at its own address. */
  assert.deepEqual(w.prov.receipts({ addressNorm: NORM }).rows.map((x) => x.capture_sha), [archive.sha]);
  assert.deepEqual(w.prov.versionChain({ addressNorm: NORM, viewer: V("x") }).versions.map((v) => v.capture_sha), [archive.sha]);
  const own = w.prov.versionChain({ addressNorm: `${NORM}#zip:3`, viewer: V("x") });
  assert.deepEqual([own.documents, own.versions.map((v) => [v.capture_sha, v.via])], [1, [[file.sha, ["unpacked"]]]]);
  /* The same file found again in a later fetch of the archive widens its one row (R13). */
  cut(w, archive.sha, 3, file.sha, { at: T(5) });
  assert.deepEqual(w.rows(`SELECT observations, last_retrieved FROM captured_locators WHERE via = 'unpacked'`).map((x) => ({ ...x })),
                   [{ observations: 2, last_retrieved: T(5) }]);
});

test("R59: a file earns exactly what its archive earns, every field passed through, route unpacked and the archive named", () => {
  const w = world();
  const cases = [];
  /* An archive fetched directly, through an archive replay, received at the doorbell, with no route, through a
     via no ruling names, and a member's authored observation: six routes, six answers passed through. */
  const A = (name) => sha(`archive ${name}`);
  w.prov.recordReceipt({ addressNorm: "e.org/d.zip", captureSha: A("direct"), retrieved: T(1) });
  cases.push(["direct", A("direct")]);
  w.prov.recordReceipt({ addressNorm: "e.org/r.zip", captureSha: A("replay"), retrieved: T(1), via: ARCHIVE_VIA });
  cases.push(["archive", A("replay")]);
  w.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260927-0a1b2c3d", captureSha: A("knock"), retrieved: T(1), via: DOORBELL_VIA });
  cases.push(["doorbell", A("knock")]);
  cases.push(["unrecorded", A("none")]);
  w.prov.recordReceipt({ addressNorm: "e.org/m.zip", captureSha: A("mirror"), retrieved: T(1), via: "some-mirror" });
  cases.push(["some-mirror", A("mirror")]);
  const t = w.prov.testify({ words: "I wrote this.", observedAt: "2026-09-20", author: V("ruth") });
  cases.push(["authored", t.capture_sha]);
  cases.forEach(([route, a], i) => {
    const f = sha(`file of ${route}`);
    cut(w, a, i, f, { norm: `e.org/${route}`, address: `https://e.org/${route}` });
    const archive = w.prov.captureGrade(a), got = w.prov.captureGrade(f);
    assert.equal(archive.route, route);
    const { route: _r, basis: _b, why: _w, ...fields } = archive;
    assert.deepEqual(bare(got), { ...fields, route: "unpacked", basis: UNPACKED_FROM_ARCHIVE,
                                  archive: { sha256: a, through: [i], route, basis: archive.basis } }, route);
    assert.match(got.why, new RegExp(`^these bytes are entry ${i} of an archive the record holds \\(${a.slice(0, 16)}…\\)`));
    assert.ok(got.why.endsWith(archive.why), "the archive's own account follows");
  });
  /* The letters, never stronger and never weaker. */
  assert.equal(w.prov.captureGrade(sha("file of direct")).grade, EARNED_CAPTURE_CEILING);
  assert.equal(w.prov.captureGrade(sha("file of archive")).grade, P.REWRITTEN_REPLAY_GRADE);
  assert.equal(w.prov.captureGrade(sha("file of authored")).testimony, TESTIMONY_GRADE);
  assert.deepEqual(w.prov.captureGrade(sha("file of doorbell")).received,
                   { address: "knock:KNOCK-20260927-0a1b2c3d", address_norm: "knock:KNOCK-20260927-0a1b2c3d", at: T(1) });
});

test("R59: an archive cut out of an archive is read the same way, to ARCHIVE_DEPTH_MAX archives, and no further", () => {
  const w = world();
  /* outer (direct) › entry 5 is middle › entry 2 is the file. */
  const outer = sha("outer"), middle = sha("middle"), file = sha("file");
  w.prov.recordReceipt({ addressNorm: "e.org/outer.zip", captureSha: outer, retrieved: T(1) });
  cut(w, outer, 5, middle, { norm: "e.org/outer.zip" });
  cut(w, middle, 2, file, { norm: "e.org/outer.zip#zip:5" });
  const g = w.prov.captureGrade(file);
  assert.deepEqual(bare(g), { grade: EARNED_CAPTURE_CEILING, determined: true, route: "unpacked", basis: UNPACKED_FROM_ARCHIVE,
                              archive: { sha256: outer, through: [5, 2], route: "direct", basis: "measured" } });
  /* A chain of exactly ARCHIVE_DEPTH_MAX archives resolves; one more does not. */
  assert.equal(ARCHIVE_DEPTH_MAX, 3, "ooxml R30's bound");
  const chain = [sha("level 0")];
  w.prov.recordReceipt({ addressNorm: "e.org/l0.zip", captureSha: chain[0], retrieved: T(1) });
  for (let k = 1; k <= ARCHIVE_DEPTH_MAX + 1; k++) {
    chain.push(sha(`level ${k}`));
    cut(w, chain[k - 1], k, chain[k], { norm: `e.org/l${k}` });
  }
  const inBound = w.prov.captureGrade(chain[ARCHIVE_DEPTH_MAX]);
  assert.deepEqual([inBound.grade, inBound.archive.sha256, inBound.archive.through], [EARNED_CAPTURE_CEILING, chain[0], [1, 2, 3]]);
  const past = w.prov.captureGrade(chain[ARCHIVE_DEPTH_MAX + 1]);
  assert.deepEqual(bare(past), { grade: null, route: "unpacked", determined: false, basis: UNPACKED_UNRESOLVED });
  assert.match(past.why, /nested more than 3 deep/);
  assert.doesNotMatch(past.why, /\b(?:this|the) (?:instance|plane)\b/i);
  /* A loop (two archives each recorded as cut out of the other) ends at the bound rather than running on. */
  const p = sha("loop p"), q = sha("loop q");
  cut(w, q, 0, p, { norm: "e.org/p" });
  cut(w, p, 0, q, { norm: "e.org/q" });
  assert.equal(w.prov.captureGrade(p).basis, UNPACKED_UNRESOLVED);
});

test("R59: a retrieval locator that does not name a 64-hex digest and a whole index answers unresolved, with the reason", () => {
  const w = world();
  const a = sha("archive");
  w.prov.recordReceipt({ addressNorm: "e.org/a.zip", captureSha: a, retrieved: T(1) });
  for (const loc of [null, "", "zip:abc!1", `zip:${a}!`, `zip:${a}!x`, `zip:${a}!-1`, `zip:${a}!1.5`, `${a}!1`, `zip:${a}`]) {
    const f = sha(`file at ${loc}`);
    w.prov.recordReceipt({ addressNorm: `e.org/a.zip#zip:${loc}`, captureSha: f, retrieved: T(2), via: UNPACKED_VIA, retrievalLocator: loc });
    const g = w.prov.captureGrade(f);
    assert.deepEqual(bare(g), { grade: null, route: "unpacked", determined: false, basis: UNPACKED_UNRESOLVED }, String(loc));
    assert.match(g.why, /not as zip:<the archive's 64-hex digest>!<the entry's number>/);
  }
  /* The digest's case is not a second identity. */
  const f = sha("upper");
  w.prov.recordReceipt({ addressNorm: "e.org/a.zip#zip:9", captureSha: f, retrieved: T(2), via: UNPACKED_VIA,
                         retrievalLocator: `zip:${a.toUpperCase()}!9` });
  assert.deepEqual(w.prov.captureGrade(f).archive, { sha256: a, through: [9], route: "direct", basis: "measured" });
});

test("R59: with several routes the strongest answer stands; a later direct capture lands beside the first, nothing regraded", () => {
  const w = world();
  const direct = sha("a direct archive"), replay = sha("a replayed archive"), knock = sha("a knocked archive");
  w.prov.recordReceipt({ addressNorm: "e.org/d.zip", captureSha: direct, retrieved: T(1) });
  w.prov.recordReceipt({ addressNorm: "e.org/r.zip", captureSha: replay, retrieved: T(1), via: ARCHIVE_VIA });
  w.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260927-00000001", captureSha: knock, retrieved: T(1), via: DOORBELL_VIA });
  const route = (s) => { const g = w.prov.captureGrade(s); return [g.route, g.grade, g.archive ? g.archive.sha256 : null]; };
  /* K1852 (3): a file cut out of a replayed archive (C), then fetched directly: the direct letter beside it. */
  const f1 = sha("f1");
  cut(w, replay, 0, f1, { norm: "e.org/r.zip" });
  assert.deepEqual(route(f1), ["unpacked", P.REWRITTEN_REPLAY_GRADE, replay]);
  w.prov.recordReceipt({ addressNorm: "e.org/f1.pdf", captureSha: f1, retrieved: T(3) });
  assert.deepEqual(route(f1), ["direct", EARNED_CAPTURE_CEILING, null]);
  assert.equal(w.rows(`SELECT * FROM captured_locators WHERE capture_sha = ?`, f1).length, 2, "both receipts stand");
  /* A higher letter before a lower one: unpacked from a direct archive (B) over an archive replay (C). */
  const f2 = sha("f2");
  w.prov.recordReceipt({ addressNorm: "e.org/f2", captureSha: f2, retrieved: T(1), via: ARCHIVE_VIA });
  cut(w, direct, 1, f2, { norm: "e.org/d.zip" });
  assert.deepEqual(route(f2), ["unpacked", EARNED_CAPTURE_CEILING, direct]);
  /* The same bytes in two archives: the stronger archive's answer stands, in either order of receipts. */
  for (const [x, y] of [[replay, direct], [direct, replay]]) {
    const f = sha(`two archives ${x}`);
    cut(w, x, 4, f, { norm: `e.org/x-${x.slice(0, 4)}` });
    cut(w, y, 4, f, { norm: `e.org/y-${y.slice(0, 4)}` });
    assert.deepEqual(route(f), ["unpacked", EARNED_CAPTURE_CEILING, direct]);
  }
  /* A determined grade before an undetermined one: an archive replay (C) over a file of a knocked archive (none). */
  const f3 = sha("f3");
  cut(w, knock, 0, f3, { norm: "knock:KNOCK-20260927-00000001" });
  w.prov.recordReceipt({ addressNorm: "e.org/f3", captureSha: f3, retrieved: T(1), via: ARCHIVE_VIA });
  assert.deepEqual(route(f3), ["archive", P.REWRITTEN_REPLAY_GRADE, null]);
  /* Between equal (undetermined) answers the order direct, archive.org, unpacked, doorbell: unpacked before doorbell. */
  const f4 = sha("f4");
  w.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260927-00000002", captureSha: f4, retrieved: T(1), via: DOORBELL_VIA });
  cut(w, knock, 2, f4, { norm: "knock:KNOCK-20260927-00000001" });
  assert.deepEqual(route(f4), ["unpacked", null, knock]);
  /* A route no ruling grades never outranks a ruled one, even an unresolved unpacked answer. */
  const f5 = sha("f5");
  w.prov.recordReceipt({ addressNorm: "e.org/f5", captureSha: f5, retrieved: T(1), via: "some-mirror" });
  w.prov.recordReceipt({ addressNorm: "e.org/f5#zip:0", captureSha: f5, retrieved: T(1), via: UNPACKED_VIA, retrievalLocator: "zip:bad!0" });
  assert.equal(w.prov.captureGrade(f5).basis, UNPACKED_UNRESOLVED);
  /* With no unpacked receipt the earlier answers stand as before (R24–R26, R51 hold their own tests). */
  assert.deepEqual(route(direct), ["direct", EARNED_CAPTURE_CEILING, null]);
});

/* ---- R42: C-18.1's unpacked document ---- */

const ARCHIVE_BYTES = "PK the archive's bytes", FILE_BYTES = "the member's bytes";
const archiveCap = { path: "snapshots/minutes.zip", text: ARCHIVE_BYTES };
const fileCap = { path: "snapshots/minutes.zip.d/0003-agenda.pdf", text: FILE_BYTES };
const ORIGIN = { kind: "named_request" };
function container(extra = {}) {
  return { archive_sha256: sha(ARCHIVE_BYTES), index: 3, compressed: 12, uncompressed: Buffer.byteLength(FILE_BYTES),
           local_offset: 1024, path: "agenda.pdf", name_raw: Buffer.from("agenda.pdf").toString("hex"), method: 8,
           crc32: 305419896, member_sha256: sha(FILE_BYTES), dos_time_stated: "2026-09-01T10:00:00", ...extra };
}
/* The file's register document, as unpack writes it (acquisition R39). */
function fileDoc({ grade = "B", basis, origin = ORIGIN, block = container(), noBlock = false, method = UNPACKED_METHOD } = {}) {
  const d = provDoc(fileCap, { locator: `${ADDR}#zip:3`, origin });
  d.capture = { ...d.capture, method, grade, ...(basis !== undefined ? { grade_basis: basis } : {}) };
  if (!noBlock) d.container = block;
  return d;
}
const archiveDoc = (extra = {}) => provDoc(archiveCap, { locator: ADDR, origin: ORIGIN, ...extra });
const runPure = (docs) => registerChecks({
  files: new Map([["bundle.md", infoMd("INFO-2026-0001-zip")], ["data/provenance.json", JSON.stringify({ documents: docs })],
                  [archiveCap.path, ARCHIVE_BYTES], [fileCap.path, FILE_BYTES]]),
  fm: parseFrontmatter(infoMd("INFO-2026-0001-zip")).data });
const msgs = (f) => f.map((x) => `${x.check}/${x.severity}: ${x.message}`);

test("R42: C-18.1 asks an unpacked document's container block, its shape and its pairing with the method", () => {
  assert.equal(UNPACKED_METHOD, "unpacked");
  assert.deepEqual(runPure([archiveDoc(), fileDoc()]), [], "the document as unpack writes it");
  assert.deepEqual(runPure([archiveDoc(), fileDoc({ block: container({ path: null, dos_time_stated: null, method: 0, name_raw: "" }) })]), []);
  const one = (doc) => { const f = runPure([archiveDoc(), doc]); assert.equal(f.length, 1, JSON.stringify(msgs(f))); assert.equal(f[0].check, "C-18.1"); assert.equal(f[0].severity, "error"); return f[0].message; };
  assert.equal(one(fileDoc({ noBlock: true })), word("provenance.register.unpacked_no_container", { i: "1", method: UNPACKED_METHOD }));
  for (const block of [null, [], "zip"]) assert.equal(one(fileDoc({ block })), word("provenance.register.unpacked_no_container", { i: "1", method: UNPACKED_METHOD }));
  assert.match(one(fileDoc({ method: "acquire" })), /carries a container block but its capture\.method is 'acquire', not 'unpacked'/);
  for (const [k, v, said] of [
    ["archive_sha256", sha(ARCHIVE_BYTES).toUpperCase(), "archive_sha256"], ["archive_sha256", undefined, "archive_sha256"],
    ["index", -1, "index"], ["index", 1.5, "index"], ["compressed", "12", "compressed"], ["uncompressed", null, "uncompressed"],
    ["local_offset", undefined, "local_offset"], ["path", 7, "path"], ["name_raw", "ABCD", "name_raw"], ["name_raw", "abc", "name_raw"],
    ["method", 9, "method"], ["crc32", -1, "crc32"], ["member_sha256", sha("other"), "member_sha256"],
    ["dos_time_stated", "", "dos_time_stated"], ["dos_time_stated", 5, "dos_time_stated"]])
    assert.match(one(fileDoc({ block: container({ [k]: v }) })), new RegExp(`container is malformed: ${said} \\(`), `${k}=${v}`);
  /* Without the record (the ratify gate's pure call), a letter must be one of the capture grades, or the basis stated. */
  assert.equal(one(fileDoc({ grade: "A+" })), word("provenance.register.grade_not_one_of", { i: "1", grade: "A+", grades: "A, B, C" }));
  assert.equal(one(fileDoc({ grade: null })), word("provenance.register.unpacked_no_basis", { i: "1" }));
  assert.deepEqual(runPure([archiveDoc(), fileDoc({ grade: null, basis: "CAPTURE_RECEIVED_NOT_FETCHED" })]), []);
});

/* As unpack files them (K1940 (1)): the archive in its own bundle, each file its own Information document in its own
   bundle beside it, so the archive's document is read through the record, never from the file's own register. */
const ARCHIVE_ID = "INFO-2026-0001-zip", FILE_ID = "INFO-2026-0002-member";
const fileArchive = (w, doc = archiveDoc()) => w.promoteInfo(ARCHIVE_ID, { captures: [archiveCap], docs: [doc] });
const fileMember = (w, doc, opts = {}) => w.promoteInfo(FILE_ID, { captures: [fileCap], docs: [doc], ...opts });

test("R42: at the write, the archive is held, the letter is the archive's (R59) and the origin is the archive's document's", () => {
  const refused = (r, re) => {
    assert.deepEqual([r.ok, r.reason], [false, "PROVENANCE_REGISTER_REFUSED"], JSON.stringify(r));
    assert.ok(r.findings.some((x) => x.check === "C-18.1" && re.test(x.detail)), JSON.stringify(r.findings));
  };
  /* The archive fetched directly (B), filed in its bundle. */
  const w = world();
  w.prov.recordReceipt({ address: ADDR, addressNorm: NORM, captureSha: sha(ARCHIVE_BYTES), retrieved: T(1) });
  assert.equal(fileArchive(w).ok, true);
  const before = w.snapshot();
  refused(fileMember(w, fileDoc({ grade: "C" })), /states capture\.grade 'C', but a file earns exactly what its archive earns, B/);
  refused(fileMember(w, fileDoc({ origin: { kind: "sweep", matched_sweep: "s", deeming_actor: "d" } })),
          /its origin is .*"sweep".*, not its archive's, \{"kind":"named_request"\}/);
  /* Origins are compared as values: the same origin with its keys in another order is the archive's. */
  const w0 = world();
  w0.prov.recordReceipt({ addressNorm: NORM, captureSha: sha(ARCHIVE_BYTES), retrieved: T(1) });
  assert.equal(fileArchive(w0, archiveDoc({ origin: { kind: "sweep", matched_sweep: "s", deeming_actor: "d" } })).ok, true);
  assert.equal(fileMember(w0, fileDoc({ origin: { deeming_actor: "d", kind: "sweep", matched_sweep: "s" } })).ok, true);
  /* An archive the record neither registers nor holds a receipt for. */
  const other = sha("an archive nobody holds");
  refused(fileMember(w, fileDoc({ block: container({ archive_sha256: other }) })),
          /names archive [0-9a-f]{16}…, which the record neither registers nor holds a receipt for/);
  assert.deepEqual(w.snapshot(), before, "no refusal wrote anything");
  assert.equal(fileMember(w, fileDoc()).ok, true, "filed beside its archive, as unpack writes it");
  /* An archive replayed from an archive (C): the file states C. */
  const w2 = world();
  w2.prov.recordReceipt({ addressNorm: NORM, captureSha: sha(ARCHIVE_BYTES), retrieved: T(1), via: ARCHIVE_VIA });
  assert.equal(fileArchive(w2, archiveDoc({ capture: { ...archiveDoc().capture, grade: "C" } })).ok, true);
  assert.equal(fileMember(w2, fileDoc({ grade: "C" })).ok, true);
  /* An archive received at the doorbell: no letter, and the basis is the archive's. */
  const w3 = world();
  w3.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260927-0a1b2c3d", captureSha: sha(ARCHIVE_BYTES), retrieved: T(1), via: DOORBELL_VIA });
  const knockOrigin = { kind: "doorbell", knock_id: "KNOCK-20260927-0a1b2c3d" };
  const knocked = archiveDoc({ origin: knockOrigin });
  knocked.capture = { ...knocked.capture, grade: null, grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED" };
  assert.equal(fileArchive(w3, knocked).ok, true);
  refused(fileMember(w3, fileDoc({ grade: "B", origin: knockOrigin })),
          /states capture\.grade 'B', but its archive earns no letter \(CAPTURE_RECEIVED_NOT_FETCHED\)/);
  refused(fileMember(w3, fileDoc({ grade: null, basis: "measured", origin: knockOrigin })),
          /grade_basis is 'measured', not its archive's, 'CAPTURE_RECEIVED_NOT_FETCHED'/);
  assert.equal(fileMember(w3, fileDoc({ grade: null, basis: "CAPTURE_RECEIVED_NOT_FETCHED", origin: knockOrigin })).ok, true);
});

test("R63, R42: a file cut out of an uploaded archive carries the archive's origin and basis, and owes no statement of its own", () => {
  const w = world();
  w.prov.recordReceipt({ addressNorm: `upload:${sha(ARCHIVE_BYTES)}`, captureSha: sha(ARCHIVE_BYTES), retrieved: T(1), via: UPLOAD_VIA });
  const upOrigin = { kind: "upload" };
  const held = archiveDoc({ origin: upOrigin });
  held.capture = { ...held.capture, method: "uploaded", grade: null, grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED", actor_class: "member" };
  held.origin_statement = { text: "the clerk handed me this archive", words_of: "member:ruth", evidence_of_truth: false };
  assert.equal(fileArchive(w, held).ok, true);
  const before = w.snapshot();
  /* Negative controls: a letter, or another basis, on the file of an archive that earns none. */
  for (const [doc, re] of [[fileDoc({ grade: "B", origin: upOrigin }), /but its archive earns no letter \(CAPTURE_RECEIVED_NOT_FETCHED\)/],
                           [fileDoc({ grade: null, basis: "measured", origin: upOrigin }), /not its archive's, 'CAPTURE_RECEIVED_NOT_FETCHED'/]]) {
    const r = fileMember(w, doc);
    assert.deepEqual([r.ok, r.reason], [false, "PROVENANCE_REGISTER_REFUSED"], JSON.stringify(r));
    assert.ok(r.findings.some((x) => x.check === "C-18.1" && re.test(x.detail)), JSON.stringify(r.findings));
  }
  assert.deepEqual(w.snapshot(), before, "no refusal wrote anything");
  /* As unpack writes it: method unpacked, the archive's origin, no statement: filed, earning the upload's answer. */
  const r = fileMember(w, fileDoc({ grade: null, basis: "CAPTURE_RECEIVED_NOT_FETCHED", origin: upOrigin }));
  assert.equal(r.ok, true, JSON.stringify(r));
});

test("R42: an archive held with no document of it to read is a finding: its origin cannot be shown", () => {
  /* Held by its receipt only: acquired, never filed. */
  const w = world();
  w.prov.recordReceipt({ address: ADDR, addressNorm: NORM, captureSha: sha(ARCHIVE_BYTES), retrieved: T(1) });
  const r = fileMember(w, fileDoc());
  assert.equal(r.reason, "PROVENANCE_REGISTER_REFUSED");
  assert.deepEqual(r.findings.map((x) => x.check), ["C-18.1"]);
  assert.equal(r.findings[0].detail, word("provenance.register.unpacked_archive_unread", { i: "0", archive: sha(ARCHIVE_BYTES).slice(0, 16) }));
  /* Filed in the archive's bundle under another digest's document only: still none of the archive's. */
  const w2 = world();
  w2.prov.recordReceipt({ addressNorm: NORM, captureSha: sha(ARCHIVE_BYTES), retrieved: T(1) });
  const elsewhere = provDoc({ path: archiveCap.path, text: "some other bytes" });
  const filed = w2.promotion.promote({ bundleId: ARCHIVE_ID, base: null, snapKey: "z", author: "member:alice", meta: { object_type: "information" },
    files: [{ path: "bundle.md", text: infoMd(ARCHIVE_ID) }, { path: archiveCap.path, text: ARCHIVE_BYTES },
            { path: "data/provenance.json", text: JSON.stringify({ documents: [elsewhere] }) }],
    register: [{ sha256: sha(ARCHIVE_BYTES), path: archiveCap.path, encoding: "utf8", bytes: Buffer.byteLength(ARCHIVE_BYTES) }] });
  assert.equal(filed.ok, true, JSON.stringify(filed));
  assert.equal(fileMember(w2, fileDoc()).findings[0].detail, word("provenance.register.unpacked_archive_unread", { i: "0", archive: sha(ARCHIVE_BYTES).slice(0, 16) }));
});

test("R42: the audit and a gate holding the record ask the same; a later direct capture of the file regrades nothing", async () => {
  const w = world();
  w.prov.recordReceipt({ address: ADDR, addressNorm: NORM, captureSha: sha(ARCHIVE_BYTES), retrieved: T(1), via: ARCHIVE_VIA });
  assert.equal(fileArchive(w, archiveDoc({ capture: { ...archiveDoc().capture, grade: "C" } })).ok, true);
  assert.equal(fileMember(w, fileDoc({ grade: "C" })).ok, true);
  /* K1852 (3): the file fetched directly later earns B beside it; the document's C stays the archive's, and is sound. */
  w.prov.recordReceipt({ addressNorm: "e.org/agenda.pdf", captureSha: sha(FILE_BYTES), retrieved: T(4) });
  assert.equal(w.prov.captureGrade(sha(FILE_BYTES)).grade, EARNED_CAPTURE_CEILING);
  const pass = async () => (await w.record.auditPass({ after: "", limit: 10, visible: () => true })).tally["C-18.1"] ?? 0;
  assert.equal(await pass(), 0);
  /* A file held with a wrong letter (a replay) is found by the audit, which holds the record. */
  const replayed = fileMember(w, fileDoc({ grade: "B" }), { base: w.head(FILE_ID).bundleSha, pkg: { replay: true } });
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.equal(await pass(), 1);
  /* The gate: with the module's resolver the record's facts are asked; without one, the shape alone. */
  const image = { "bundle.md": infoMd(FILE_ID), "data/provenance.json": JSON.stringify({ documents: [fileDoc({ grade: "B" })] }),
                  [fileCap.path]: FILE_BYTES };
  const gate = { gateVersion: "g", ok: true, findings: [], warnings: 0 };
  const held = withRegisterChecks(image, gate, w.prov.containerResolver());
  assert.deepEqual([held.ok, held.findings.map((x) => x.check)], [false, ["C-18.1"]]);
  assert.match(held.findings[0].detail, /states capture\.grade 'B', but a file earns exactly what its archive earns, C/);
  assert.deepEqual([withRegisterChecks(image, gate).ok, withRegisterChecks(image, gate).findings], [true, []]);
});
