/* R29 (fix round 9, G135f; K4831 (5)): a reading that ended or stopped is told once for each state to the member it was made for.
   plane's job table is read through `deps.readingsEnded({after, limit})` (plane R98), here a local implementation of the contract
   in the shape plane publishes: `{ok, rows: [{sha, kind, state, why, written, skipped, owed, failed, ended_at, member}], next}`;
   the seam over the real job table is control-plane's (section 11 of its round-9 seam file). */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "../file-safety/fixture.mjs";
import { fresh, reader, ofKind } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { NOTICE_KINDS, READING_ENDED_MAX, READING_ENDED_DAYS } from "../../../src/notice-producers/index.mjs";

const KIND = "reading-ended";
const NOW = Date.parse("2026-10-21T00:00:00Z");
const ENDED = Date.parse("2026-10-20T10:00:00Z");
const sha = (c) => c.repeat(64);
const row = (c, state, over = {}) => ({ sha: sha(c), kind: "reading", state, why: null, written: 12, skipped: 0, owed: 0, failed: 0, ended_at: ENDED, member: "member:m1", ...over });

function setup(rows, over = {}) {
  const w = world({});
  w.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const asked = [];
  const readingsEnded = "readingsEnded" in over ? over.readingsEnded : (a) => { asked.push(a); return { ok: true, rows, next: null }; };
  const n = fresh(w.host, { membership: w.membership, readingsEnded });
  const { read } = reader(n);
  const run = (member) => read(member, { now: NOW });
  return { w, run, asked, items: (m) => ofKind(run(m), KIND) };
}

test("R29: a finished reading, one stopped in part and a refused one each make one notice for the opener, and a second cycle makes the same keys", () => {
  const { items } = setup([row("a", "finished"), row("b", "final", { why: "PASSWORD_REQUIRED", written: 3, owed: 9 }), row("c", "refused", { why: "over the limit", written: 0 })]);
  const first = items("m1");
  assert.deepEqual(first.map((i) => i.id), [`FINDING::reading-ended::${sha("a")}::finished`, `FINDING::reading-ended::${sha("b")}::final`, `FINDING::reading-ended::${sha("c")}::refused`]);
  assert.equal(NOTICE_KINDS[KIND], "FINDING");
  assert.deepEqual(first.map((i) => i.recipients), [["m1"], ["m1"], ["m1"]]);
  assert.deepEqual(first.map((i) => i.subject.state), ["finished", "final", "refused"]);
  assert.deepEqual(items("m1").map((i) => i.id), first.map((i) => i.id), "told once: the same keys, never a second item");
});

test("R29: the sentences are keyed stand-ins filling the document, read and total where the row states them, and the limit where refused", () => {
  const { items } = setup([row("a", "finished"), row("b", "final", { why: "PASSWORD_REQUIRED", written: 3, owed: 9 }), row("c", "refused", { why: "over the limit", written: 0 }),
    row("d", "finished", { written: 0 })]);
  const [fin, part, refused, bare] = items("m1");
  assert.deepEqual(fin.fills, { document: sha("a"), read: "12", total: "12", why: "" });
  assert.equal(fin.summary, localize("notice-producers.reading.finished.counted", "{document} has been read: {read} of {total}.", fin.fills));
  assert.equal(part.summary, localize("notice-producers.reading.partial.counted", "{document} was read in part: {read} of {total}. {why}", part.fills));
  assert.deepEqual([part.fills.read, part.fills.total, part.fills.why], ["3", "12", "PASSWORD_REQUIRED"]);
  assert.equal(refused.summary, localize("notice-producers.reading.refused", "{document} was not taken in: {why}", refused.fills));
  assert.ok(refused.summary.includes("over the limit") && !/\bread\b/i.test(refused.summary), "a refused file is never said to be read");
  assert.equal(bare.summary, localize("notice-producers.reading.finished", "{document} has been read.", bare.fills));
  assert.equal(fin.door, localize("notice-producers.index.open_the_document", "Open the document"));
});

test("R29: a row for another member, a machine or nobody makes none for this one; the producer asks nobody's identity", () => {
  const { items } = setup([row("a", "finished", { member: "member:m2" }), row("b", "finished", { member: null }), row("c", "finished", { member: "agent:x" })]);
  assert.deepEqual(items("m1"), []);
  assert.deepEqual(items(null), []);
  const only = setup([row("a", "finished", { member: "member:m2" })]);
  assert.equal(only.items("m2").length, 1);
});

test("R29: a reading still being read, and a job of another kind, make no notice (control)", () => {
  const { items } = setup([row("a", "reading"), row("b", "queued"), row("c", "fetching"), row("d", "partial"), row("e", "finished", { kind: "scan" }), row("f", "finished")]);
  assert.deepEqual(items("m1").map((i) => i.id), [`FINDING::reading-ended::${sha("f")}::finished`]);
});

test("R29: a member no longer active is told nothing, and a row listed twice is one item", () => {
  const { w, items } = setup([row("a", "finished"), row("a", "finished")]);
  assert.equal(items("m1").length, 1);
  w.exec(`UPDATE members SET status='revoked' WHERE member_id='m1'`);
  assert.deepEqual(items("m1"), []);
});

test("R29: a row that goes on after a stop and ends again raises a fresh key", () => {
  const stopped = setup([row("a", "final", { why: "x" })]).items("m1");
  const done = setup([row("a", "finished")]).items("m1");
  assert.notEqual(stopped[0].id, done[0].id);
});

test("R29 R1: a row older than 90 days is not told, the bound and window are stated in facts, pages are followed, and a read that throws or refuses is named readings", () => {
  const { run, asked } = setup([row("a", "finished"), row("o", "finished", { ended_at: Date.parse("2026-06-01T00:00:00Z") })]);
  const r = run("m1");
  assert.deepEqual(ofKind(r, KIND).map((i) => i.id), [`FINDING::reading-ended::${sha("a")}::finished`]);
  assert.ok(asked[0].limit <= READING_ENDED_MAX);
  assert.deepEqual(r.facts.reading_ended, { bound: READING_ENDED_MAX, days: READING_ENDED_DAYS, truncated: false });
  for (const readingsEnded of [() => { throw new Error("x"); }, () => ({ ok: false })]) {
    const bad = setup([], { readingsEnded }).run("m1");
    assert.deepEqual(ofKind(bad, KIND), []);
    assert.ok(bad.facts.failed.includes("readings"));
  }
  const seen = [];
  const paged = setup([], { readingsEnded: (a) => { seen.push(a.after); return a.after === null ? { ok: true, rows: [row("a", "finished")], next: "c1" } : { ok: true, rows: [row("b", "final")], next: null }; } }).run("m1");
  assert.deepEqual(ofKind(paged, KIND).length, 2);
  assert.deepEqual(seen, [null, "c1"]);
});

test("R29 R1: with no readingsEnded handed it contributes none and names none", () => {
  const r = setup([], { readingsEnded: undefined }).run("m1");
  assert.deepEqual(ofKind(r, KIND), []);
  assert.ok(!r.facts.failed.includes("readings"));
});
