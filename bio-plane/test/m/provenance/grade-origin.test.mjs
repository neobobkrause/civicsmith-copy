/* provenance: the capture axis for one capture, from its route (R24–R27, R51), and a member's declared origin (R29, R30). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V, infoMd } from "./fixture.mjs";
import { ARCHIVE_CAPTURE_GRADE, REWRITTEN_REPLAY_GRADE, ARCHIVE_VIA, DOORBELL_VIA } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING, BASIS_GRADES, TESTIMONY_GRADE } from "../../../src/record-grammar/index.mjs";
import { PROVENANCE_ACT_CHECKS } from "../../../src/provenance/checks.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const T = "2026-09-27T01:00:00Z";
const rank = (g) => BASIS_GRADES.indexOf(g);

test("R24: a capture this instance fetched directly earns the ceiling, measured", () => {
  const w = world();
  const s = sha("direct");
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: s, retrieved: T });
  assert.deepEqual({ ...w.prov.captureGrade(s), why: undefined },
                   { grade: EARNED_CAPTURE_CEILING, route: "direct", determined: true, basis: "measured", why: undefined });
  /* A direct receipt is the strongest route, whatever else served the bytes. */
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: s, retrieved: T, via: ARCHIVE_VIA });
  assert.equal(w.prov.captureGrade(`sha256:${s.toUpperCase()}`).grade, EARNED_CAPTURE_CEILING);
});

test("R25, R85: an archive-only capture earns, from its one definition, the ceiling for a raw replay and one rank below for a rewritten one", () => {
  assert.equal(ARCHIVE_CAPTURE_GRADE, EARNED_CAPTURE_CEILING, "BD-18: a raw replay is B via archive");
  assert.equal(rank(REWRITTEN_REPLAY_GRADE), rank(EARNED_CAPTURE_CEILING) + 1);
  assert.equal(REWRITTEN_REPLAY_GRADE, "C", "BD-18: a rewritten replay is Grade C, reference only");
  const w = world();
  const raw = sha("archived raw"), rew = sha("archived rewritten");
  w.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: raw, retrieved: T, via: ARCHIVE_VIA,
                         retrievalLocator: "https://web.archive.org/web/20240102030405id_/https://e.org/a" });
  w.prov.recordReceipt({ addressNorm: "e.org/b", captureSha: rew, retrieved: T, via: ARCHIVE_VIA,
                         retrievalLocator: "https://web.archive.org/web/20240102030405/https://e.org/b" });
  const g = w.prov.captureGrade(raw), r = w.prov.captureGrade(rew);
  assert.deepEqual([g.grade, g.route, g.determined, g.basis], [ARCHIVE_CAPTURE_GRADE, "archive", true, "measured"]);
  assert.deepEqual([r.grade, r.route, r.determined, r.basis, r.reference_only], [REWRITTEN_REPLAY_GRADE, "archive", true, "measured", true]);
});

test("R26: no recorded route is stated as unrecorded, and a via no ruling names is undetermined", () => {
  const w = world();
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  const u = w.prov.captureGrade(a.sha);
  assert.deepEqual([u.grade, u.route, u.determined, u.basis, u.ceiling],
                   [null, "unrecorded", false, "CAPTURE_ROUTE_UNRECORDED", EARNED_CAPTURE_CEILING]);
  assert.match(u.why, /authored/);
  assert.equal(w.prov.captureGrade(sha("never seen")).route, "unrecorded");
  const s = sha("odd route");
  w.prov.recordReceipt({ addressNorm: "e.org/o", captureSha: s, retrieved: T, via: "some-mirror" });
  const o = w.prov.captureGrade(s);
  assert.deepEqual([o.grade, o.route, o.determined, o.basis], [null, "some-mirror", false, "CAPTURE_GRADE_VIA_UNRULED"]);
});

test("R27: an authored observation earns no capture letter; its grade is testimony, and none is above the ceiling", () => {
  const w = world();
  const t = w.prov.testify({ words: "I was there.", observedAt: "2026-09-20", author: V("ruth") });
  /* Even a receipt naming its bytes does not earn it a capture letter. */
  w.prov.recordReceipt({ addressNorm: "e.org/t", captureSha: t.capture_sha, retrieved: T });
  const g = w.prov.captureGrade(t.capture_sha);
  assert.deepEqual([g.grade, g.determined, g.basis, g.testimony], [null, false, "CAPTURE_AXIS_AUTHORED", TESTIMONY_GRADE]);
  for (const via of ["direct", ARCHIVE_VIA, "x"]) {
    const s = sha(via);
    w.prov.recordReceipt({ addressNorm: `e.org/${via}`, captureSha: s, retrieved: T, via });
    const got = w.prov.captureGrade(s).grade;
    if (got !== null) assert.ok(rank(got) >= rank(EARNED_CAPTURE_CEILING), `${via}: ${got}`);
  }
});

test("R51: a capture received through the doorbell earns no fetched letter; its receipt proves when it was held", () => {
  assert.equal(DOORBELL_VIA, "doorbell", "the via capture R65 writes");
  const w = world();
  const s = sha("handed over");
  /* As capture R65 writes it: one receipt at the knock's address, via doorbell. */
  const k = w.prov.recordReceipt({ address: "knock:KNOCK-20260927-0a1b2c3d", addressNorm: "knock:KNOCK-20260927-0a1b2c3d",
                                   captureSha: s, retrieved: "2026-09-27T04:05:06.789Z", via: DOORBELL_VIA });
  assert.deepEqual([k.recorded, k.via], [true, "doorbell"]);
  const g = w.prov.captureGrade(s);
  assert.deepEqual({ ...g, why: undefined }, {
    grade: null, route: "doorbell", determined: false, basis: "CAPTURE_RECEIVED_NOT_FETCHED",
    ceiling: EARNED_CAPTURE_CEILING,
    received: { address: "knock:KNOCK-20260927-0a1b2c3d", address_norm: "knock:KNOCK-20260927-0a1b2c3d",
                at: "2026-09-27T04:05:06Z" },
    why: undefined });
  /* Stated as authored, never as measured; existence proven by the receipt's timestamp. */
  assert.equal(g.why, word("provenance.why.bytes_fetched_address", { how: word("provenance.handed_group_through"),
    earned_capture_ceiling: EARNED_CAPTURE_CEILING, first_retrieved: "2026-09-27T04:05:06Z", address: "knock:KNOCK-20260927-0a1b2c3d" }));
  assert.match(g.why, /2026-09-27T04:05:06Z/);
  assert.match(g.why, /knock:KNOCK-20260927-0a1b2c3d/);
  assert.equal(w.prov.captureGrade(`sha256:${s.toUpperCase()}`).route, "doorbell");
  /* A second pull of the same bytes under another knock: the earliest receipt is the one that proves existence. */
  w.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260926-ffffffff", captureSha: s, retrieved: "2026-09-26T00:00:00Z",
                         via: DOORBELL_VIA });
  assert.deepEqual(w.prov.captureGrade(s).received,
                   { address: "knock:KNOCK-20260926-ffffffff", address_norm: "knock:KNOCK-20260926-ffffffff",
                     at: "2026-09-26T00:00:00Z" });
  /* A route this instance fetched is measured and answers first; the doorbell never raises or lowers it. */
  w.prov.recordReceipt({ addressNorm: "e.org/h", captureSha: s, retrieved: T, via: ARCHIVE_VIA });
  assert.deepEqual([w.prov.captureGrade(s).route, w.prov.captureGrade(s).grade], ["archive", REWRITTEN_REPLAY_GRADE]);
  w.prov.recordReceipt({ addressNorm: "e.org/h", captureSha: s, retrieved: T });
  assert.deepEqual([w.prov.captureGrade(s).route, w.prov.captureGrade(s).grade], ["direct", EARNED_CAPTURE_CEILING]);
  /* The doorbell is a ruled route: beside a via no ruling names, it still answers as received. */
  const m = sha("handed and mirrored");
  w.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260927-00000001", captureSha: m, retrieved: T, via: DOORBELL_VIA });
  w.prov.recordReceipt({ addressNorm: "e.org/m", captureSha: m, retrieved: T, via: "some-mirror" });
  assert.equal(w.prov.captureGrade(m).basis, "CAPTURE_RECEIVED_NOT_FETCHED");
  /* A member's authored observation stays testimony even with a doorbell receipt naming its bytes (R27). */
  const t = w.prov.testify({ words: "I saw it.", observedAt: "2026-09-20", author: V("ruth") });
  w.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260927-00000002", captureSha: t.capture_sha, retrieved: T, via: DOORBELL_VIA });
  assert.equal(w.prov.captureGrade(t.capture_sha).basis, "CAPTURE_AXIS_AUTHORED");
});

test("R29: a member's attributed, dated, append-only declaration of a document's system", () => {
  const w = world({ now: "2026-09-27T02:00:00.000Z" });
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  const d1 = w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "  The  clerk's agenda system ", by: V("ruth"), viewer: V("ruth") });
  assert.deepEqual(d1, { ok: true, bundleId: "INFO-2026-0001-a", system: "The clerk's agenda system", by: V("ruth"),
                         at: "2026-09-27T02:00:00Z", seq: 1 });
  w.clock.now = "2026-09-27T03:00:00.000Z";
  const d2 = w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "The records portal", by: V("sam"), viewer: V("sam") });
  assert.equal(d2.seq, 2);
  assert.equal(w.count("origin_declarations"), 2, "append-only: the first stays");
  /* Each refusal carries its catalogue row (C-103), but NO_SUCH_BUNDLE, which has none (REC-64). */
  const row = (r, code) => assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation],
    [false, code, code, PROVENANCE_ACT_CHECKS[code].check, PROVENANCE_ACT_CHECKS[code].translation], code);
  for (const who of ["token:member", "class:admin", "", null]) {
    const r = w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "x", by: who, viewer: V("x") });
    row(r, "ORIGIN_NOT_A_MEMBER");
  }
  assert.equal(w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "x", by: V("r"), viewer: "stranger" }).reason, "NO_SUCH_BUNDLE",
               "a bundle the viewer may not see answers as absent");
  assert.equal(w.prov.declareOrigin({ bundleId: "INFO-2026-0404-x", system: "x", by: V("r"), viewer: V("r") }).reason, "NO_SUCH_BUNDLE");
  row(w.prov.declareOrigin({ bundleId: "", system: "x", by: V("r"), viewer: V("r") }), "NO_BUNDLE");
  row(w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: " ", by: V("r"), viewer: V("r") }), "ORIGIN_NO_SYSTEM");
  row(w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "x".repeat(201), by: V("r"), viewer: V("r") }), "ORIGIN_NO_SYSTEM");
  assert.equal(w.prov.declareOrigin({ bundleId: "INFO-2026-0404-x", system: "x", by: V("r"), viewer: V("r") }).check, undefined);
  assert.equal(w.count("origin_declarations"), 2, "no refusal wrote a declaration");
  w.record.transact(() => w.record.commit({ bundleId: "INQ-2026-0001-q", type: "inquiry", title: "Q", project: null, snapKey: "q",
    kind: "promotion", base: "", author: V("r"), writer: null, operation: null,
    files: [{ path: "bundle.md", text: infoMd("INQ-2026-0001-q"), sha256: sha(infoMd("INQ-2026-0001-q")), bytes: 1 }],
    state: "open", priorState: null, group: "g", created: T, lastUpdated: T, criticality: null, at: T }));
  row(w.prov.declareOrigin({ bundleId: "INQ-2026-0001-q", system: "x", by: V("r"), viewer: V("r") }), "ORIGIN_NOT_A_DOCUMENT");
});

test("R30: originOf answers the standing (latest) declaration, or null", () => {
  const w = world();
  const a = w.cap("a");
  w.promoteInfo("INFO-2026-0001-a", { captures: [a] });
  assert.equal(w.prov.originOf("INFO-2026-0001-a"), null);
  w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "First", by: V("ruth"), viewer: V("ruth") });
  w.clock.now = "2026-09-28T00:00:00.000Z";
  w.prov.declareOrigin({ bundleId: "INFO-2026-0001-a", system: "Second", by: V("sam"), viewer: V("sam") });
  assert.deepEqual(w.prov.originOf("INFO-2026-0001-a"), { system: "Second", by: V("sam"), at: "2026-09-28T00:00:00Z" });
  assert.equal(w.prov.originOf("INFO-2026-0404-x"), null);
});
