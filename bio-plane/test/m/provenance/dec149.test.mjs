/* provenance: DEC-149's sweep rows (T35-18; `build/plan/draft-T35-dec149-l1-l7.md`, plan rule 4). Member-facing text
   says "your group's Civicsmith" or names the thing; "the plane", "this plane" and "the instance" go. Each test names
   the row's string and reads it where a member reads it: the catalogue row, `captureGrade`'s `why`, and the files
   `testify` writes. Field and identifier names stay. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, V } from "./fixture.mjs";
import { PROVENANCE_ACT_CHECKS } from "../../../src/provenance/checks.mjs";
import { ARCHIVE_VIA, REWRITTEN_REPLAY_GRADE, DOORBELL_VIA } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const T = "2026-09-27T01:00:00Z";
const OLD = /\b(?:this|the) (?:instance|plane)\b|\bplane's\b|\binstance's\b/i;

test("R58, DEC-149 (checks.mjs:138, :139, C-103.7): 'Your group's Civicsmith holds no key to sign its receipts with' and 'Whoever hosts your group's Civicsmith can add one.'", () => {
  const t = PROVENANCE_ACT_CHECKS.RECEIPT_NO_KEY.translation;
  assert.equal(t, word("refusal.RECEIPT_NO_KEY"));
  assert.equal(PROVENANCE_ACT_CHECKS.RECEIPT_NO_KEY.check, "C-103.7", "the number is unchanged");
  for (const [code, row] of Object.entries(PROVENANCE_ACT_CHECKS)) assert.doesNotMatch(row.translation, OLD, code);
});

test("R24, DEC-149 (index.mjs:899): 'your group's Civicsmith fetched these bytes directly from their address, …'", () => {
  const w = world();
  const s = sha("direct");
  w.prov.recordReceipt({ addressNorm: "e.org/d", captureSha: s, retrieved: T });
  const why = w.prov.captureGrade(s).why;
  assert.equal(why, word("provenance.why.group_civicsmith_fetched", { earned_capture_ceiling: EARNED_CAPTURE_CEILING }));
  assert.doesNotMatch(why, OLD);
});

test("R25, R85, DEC-149: an archive replay's why names your team's Civicsmith, the archive as custodian and the snapshot as fetch date", () => {
  const w = world();
  const s = sha("archived"), r = sha("archived rewritten");
  w.prov.recordReceipt({ addressNorm: "e.org/a", captureSha: s, retrieved: T, via: ARCHIVE_VIA,
                         retrievalLocator: "https://web.archive.org/web/20240102030405id_/https://e.org/a" });
  w.prov.recordReceipt({ addressNorm: "e.org/b", captureSha: r, retrieved: T, via: ARCHIVE_VIA });
  for (const why of [w.prov.captureGrade(s).why, w.prov.captureGrade(r).why]) {
    assert.match(why, /your team's Civicsmith/);
    assert.doesNotMatch(why, OLD);
  }
  assert.match(w.prov.captureGrade(s).why, /web\.archive\.org.*2024-01-02T03:04:05Z/);
  assert.match(w.prov.captureGrade(r).why, new RegExp(`\\b${REWRITTEN_REPLAY_GRADE}\\b`));
});

test("R51, DEC-149 (index.mjs:923): '… is proven by the receipt your group's Civicsmith itself made at ${address}'", () => {
  const w = world();
  const s = sha("handed over");
  w.prov.recordReceipt({ addressNorm: "knock:KNOCK-20260927-0a1b2c3d", captureSha: s, retrieved: T, via: DOORBELL_VIA });
  const why = w.prov.captureGrade(s).why;
  assert.match(why, / is proven by the receipt your team's Civicsmith itself made at knock:KNOCK-20260927-0a1b2c3d$/);
  assert.doesNotMatch(why, OLD);
});

test("R28, DEC-149 (index.mjs:1387, :1402): 'The author is taken from the signed-in session, not from the request.' and 'the signed-in member taken from the session at op=testify, …'", () => {
  const w = world();
  const t = w.prov.testify({ words: "I was there.", observedAt: "2026-09-20", author: V("ruth") });
  assert.equal(t.ok, true, JSON.stringify(t));
  const md = w.record.readFile(t.bundle_id, "bundle.md").text;
  assert.ok(md.includes(word("provenance.testify.provenance_notes", { obs: "2026-09-20", recorded: t.recorded_at })));
  const doc = JSON.parse(w.record.readFile(t.bundle_id, "data/provenance.json").text).documents[0];
  assert.equal(doc.authority_basis, word("provenance.testify.authority_basis", { recorded: t.recorded_at }));
  assert.doesNotMatch(md, OLD);
  assert.doesNotMatch(doc.authority_basis, OLD);
});
