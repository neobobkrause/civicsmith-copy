/* provenance R85 (CR2-6; BD-18, Bob 7 Nov 2026): an archive replay of the publisher's raw bytes is Grade B "via
   archive", its snapshot date its fetch date and the archive its custodian; a rewritten replay is Grade C, reference
   only. The raw mode is read from the receipt's retrieval locator, which only the plane's own fetch writes (R15). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha } from "./fixture.mjs";
import { ARCHIVE_VIA, ARCHIVE_CAPTURE_GRADE, UNPACKED_VIA, UNPACKED_FROM_ARCHIVE } from "../../../src/provenance/index.mjs";
import * as P from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING, BASIS_GRADES } from "../../../src/record-grammar/index.mjs";

const T = "2026-09-27T01:00:00Z";
const RAW = "https://web.archive.org/web/20240102030405id_/https://e.org/report.pdf";
const REWRITTEN = "https://web.archive.org/web/20240102030405/https://e.org/report.pdf";
const archived = (w, s, retrievalLocator, norm = "e.org/report.pdf") =>
  w.prov.recordReceipt({ address: "https://e.org/report.pdf", addressNorm: norm, captureSha: s, retrieved: T, via: ARCHIVE_VIA,
                         ...(retrievalLocator === undefined ? {} : { retrievalLocator }) });

test("R85: the two letters have one definition each, derived from the ceiling", () => {
  assert.equal(ARCHIVE_CAPTURE_GRADE, EARNED_CAPTURE_CEILING, "a raw replay is the ceiling, via archive");
  assert.equal(BASIS_GRADES.indexOf(P.REWRITTEN_REPLAY_GRADE), BASIS_GRADES.indexOf(EARNED_CAPTURE_CEILING) + 1);
  assert.equal(P.REWRITTEN_REPLAY_GRADE, "C", "the Intake Doctrine's Grade C, reference only");
});

test("R85: a raw replay is B via archive, its snapshot date its fetch date and the archive its custodian", () => {
  const w = world();
  const s = sha("raw replay");
  archived(w, s, RAW);
  const g = w.prov.captureGrade(s);
  assert.deepEqual({ ...g, why: undefined }, {
    grade: ARCHIVE_CAPTURE_GRADE, route: "archive", determined: true, basis: "measured", via_archive: true,
    replay: { raw: true, custodian: "web.archive.org", fetched_at: "2024-01-02T03:04:05Z", locator: RAW },
    why: undefined });
  assert.match(g.why, /web\.archive\.org/);
  assert.match(g.why, /2024-01-02T03:04:05Z/);
  /* The batch read answers the same. */
  assert.deepEqual(w.prov.captureGrades([s])[0], g);
});

test("R85: a rewritten replay, or one whose receipt does not show the raw mode, is C, reference only", () => {
  const w = world();
  const cases = {
    rewritten: REWRITTEN,
    frame: "https://web.archive.org/web/20240102030405if_/https://e.org/report.pdf",
    image: "https://web.archive.org/web/20240102030405im_/https://e.org/report.pdf",
    "not an instant": "https://web.archive.org/web/20241332030405id_/https://e.org/report.pdf",
    "not a replay": "https://e.org/report.pdf",
    none: undefined,
  };
  for (const [name, loc] of Object.entries(cases)) {
    const s = sha(`replay ${name}`);
    archived(w, s, loc, `e.org/${name}`);
    const g = w.prov.captureGrade(s);
    assert.deepEqual({ ...g, why: undefined }, {
      grade: P.REWRITTEN_REPLAY_GRADE, route: "archive", determined: true, basis: "measured", via_archive: true,
      reference_only: true, replay: { raw: false, locator: loc ?? null }, why: undefined }, name);
    assert.match(g.why, new RegExp(`\\b${P.REWRITTEN_REPLAY_GRADE}\\b`), name);
  }
});

test("R85: of one capture's archive receipts the raw replay stands, the earliest snapshot first; a direct fetch still governs", () => {
  const w = world();
  const s = sha("served both ways");
  archived(w, s, REWRITTEN, "e.org/a");
  assert.equal(w.prov.captureGrade(s).grade, P.REWRITTEN_REPLAY_GRADE);
  archived(w, s, "https://web.archive.org/web/20250101000000id_/https://e.org/report.pdf", "e.org/b");
  archived(w, s, RAW, "e.org/c");
  const g = w.prov.captureGrade(s);
  assert.deepEqual([g.grade, g.replay.fetched_at, g.replay.locator], [ARCHIVE_CAPTURE_GRADE, "2024-01-02T03:04:05Z", RAW]);
  /* Equal letters: a direct fetch answers before the archive (R59's order), nothing regraded. */
  w.prov.recordReceipt({ addressNorm: "e.org/report.pdf", captureSha: s, retrieved: T });
  assert.deepEqual([w.prov.captureGrade(s).route, w.prov.captureGrade(s).grade], ["direct", EARNED_CAPTURE_CEILING]);
});

test("R85, R59: a file cut out of a raw-replayed archive earns B via archive, the replay passed through", () => {
  const w = world();
  const a = sha("raw-replayed archive"), f = sha("its file");
  archived(w, a, RAW);
  w.prov.recordReceipt({ address: "https://e.org/report.pdf#zip:2", addressNorm: "e.org/report.pdf#zip:2", captureSha: f,
                         retrieved: T, via: UNPACKED_VIA, retrievalLocator: `zip:${a}!2` });
  const g = w.prov.captureGrade(f);
  assert.deepEqual([g.grade, g.route, g.basis, g.via_archive, g.replay.custodian, g.archive.route],
                   [ARCHIVE_CAPTURE_GRADE, "unpacked", UNPACKED_FROM_ARCHIVE, true, "web.archive.org", "archive"]);
});

test("R85: P.rawReplayOf reads a raw replay's custodian and snapshot, and nothing else", () => {
  assert.deepEqual(P.rawReplayOf(RAW), { custodian: "web.archive.org", snapshot_at: "2024-01-02T03:04:05Z", locator: RAW,
                                       original: "https://e.org/report.pdf" });
  assert.equal(P.rawReplayOf("https://archive.example/20240102030405id_/https://e.org/x").custodian, "archive.example");
  for (const no of [REWRITTEN, "https://web.archive.org/web/2024010203id_/https://e.org/x", "", null, 7, "zip:ab!1"])
    assert.equal(P.rawReplayOf(no), null, String(no));
});
