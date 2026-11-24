/* R29 (fix round 10; the marked clause, the seam over the real job table: control-plane seam section 11, job 43): the `reading-ended` producer
   built from `readingsEnded` over the rows the REAL job table answers. The job table is plane's (`plane/pending.mjs`, `readingsEnded`, plane R98), later in the
   order than this module, so its answer is not built here: `READING_ROWS` below, handed in as `readingsEnded`'s answer (marked `fixtures-contract: plane reading-ended`), is the contract, stated as data exactly as plane's own `Store` answers it (member as
   `member:<id>`, `ended_at` in epoch milliseconds, `why` the refusal's bound key or the reader's final reason, the cursor `<ended_at>\u0001<sha>\u0001<kind>`), and the
   plane's test runs it against its real table (the `fixtures-run` line it carries). This test drives `noticeItems` at its interface over those rows. */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "../file-safety/fixture.mjs";
import { fresh, reader, ofKind } from "./fixture.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { READING_ENDED_MAX, READING_ENDED_DAYS } from "../../../src/notice-producers/index.mjs";

const KIND = "reading-ended";
const NOW = Date.parse("2026-10-25T00:00:00Z");
const sha = (c) => c.repeat(64);
const AT = NOW - 3600e3;

const READING_ROWS = Object.freeze([
  Object.freeze({ id: "refused", sha: sha("3"), kind: "reading", state: "refused", why: "pdf.bytes", written: 0, skipped: 0, owed: 0, failed: 0, ended_at: AT, member: "member:m1" }),
  Object.freeze({ id: "finished", sha: sha("1"), kind: "reading", state: "finished", why: null, written: 5, skipped: 0, owed: 0, failed: 0, ended_at: AT + 15, member: "member:m1" }),
  Object.freeze({ id: "final", sha: sha("2"), kind: "reading", state: "final", why: "PASSWORD_REQUIRED", written: 0, skipped: 0, owed: 0, failed: 0, ended_at: AT + 25, member: "member:m2" }),
  Object.freeze({ id: "final-unopened", sha: sha("4"), kind: "reading", state: "final", why: "NO_PROGRESS", written: 3, skipped: 0, owed: 2, failed: 1, ended_at: AT + 35, member: null }),
]);
/** the cursor the real table gives for a page that ended on `row` (a full page) */
const cursorOf = (row) => `${row.ended_at}\u0001${row.sha}\u0001${row.kind}`;

function setup(rows) {
  const w = world({});
  w.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const asked = [];
  const readingsEnded = ({ after = null, limit = 100 } = {}) => {
    asked.push({ after, limit });
    const start = after === null ? 0 : rows.findIndex((r) => cursorOf(r) === after) + 1;
    const page = rows.slice(start, start + limit);
    const last = page[page.length - 1];
    // fixtures-contract: plane reading-ended
    return { ok: true, rows: page.map(({ id, ...r }) => ({ ...r })), next: page.length === limit && start + limit < rows.length ? cursorOf(last) : null };
  };
  const n = fresh(w.host, { membership: w.membership, readingsEnded });
  const { read } = reader(n);
  return { asked, run: (m) => read(m, { now: NOW }), items: (m) => ofKind(read(m, { now: NOW }), KIND) };
}
const by = (items, row) => items.find((i) => i.id === `FINDING::reading-ended::${row.sha}::${row.state}`);

test("R29 (seam, real job table): each ended row the real table answers makes one notice for the member it names as its opener, in the real table's shapes, and nobody else's", () => {
  const { items } = setup(READING_ROWS);
  const [refused, finished, final, unopened] = READING_ROWS;
  const m1 = items("m1"), m2 = items("m2");
  assert.deepEqual(m1.map((i) => i.id), [`FINDING::reading-ended::${refused.sha}::refused`, `FINDING::reading-ended::${finished.sha}::finished`], "the member:m1 rows, in the table's order");
  assert.deepEqual(m2.map((i) => i.id), [`FINDING::reading-ended::${final.sha}::final`]);
  assert.deepEqual(items("m3"), [], "a member that opened none is told none; a row with no opener (null) is nobody's");
  assert.equal(by([...m1, ...m2], unopened), undefined);
  for (const i of [...m1, ...m2]) assert.deepEqual(i.recipients, [i.id.includes(sha("2")) ? "m2" : "m1"]);
});

test("R29 (seam, real job table): the sentences fill the real rows' counts and reasons, and a refused file is never said to be read", () => {
  const { items } = setup(READING_ROWS);
  const [refused, finished, final] = READING_ROWS;
  const m1 = items("m1");
  const f = by(m1, finished), r = by(m1, refused), p = by(items("m2"), final);
  assert.deepEqual(f.fills, { document: finished.sha, read: "5", total: "5", why: "" });
  assert.equal(f.summary, localize("notice-producers.reading.finished.counted", "{document} has been read: {read} of {total}.", f.fills));
  assert.deepEqual(r.fills, { document: refused.sha, read: "0", total: "0", why: "pdf.bytes" });
  assert.equal(r.summary, localize("notice-producers.reading.refused", "{document} was not taken in: {why}", r.fills));
  assert.ok(!/\bread\b/i.test(r.summary), "a refused file is never said to be read");
  assert.equal(p.summary, localize("notice-producers.reading.partial", "{document} was read in part. {why}", p.fills));
  assert.ok(p.summary.includes("PASSWORD_REQUIRED"));
  assert.deepEqual([f.subject.state, r.subject.state, p.subject.state], ["finished", "refused", "final"]);
});

test("R29 (seam, real job table): the real table's cursor is followed to its end in pages the table's cap allows, each row told once, and the bound and window are stated", () => {
  const many = Array.from({ length: 450 }, (_, i) => ({ ...READING_ROWS[1], sha: i.toString(16).padStart(64, "0"), ended_at: AT + i }));
  const { asked, run } = setup(many);
  const r = run("m1");
  assert.equal(ofKind(r, KIND).length, 450);
  assert.deepEqual(r.facts.reading_ended, { bound: READING_ENDED_MAX, days: READING_ENDED_DAYS, truncated: false });
  assert.deepEqual(asked.map((a) => a.after === null ? null : a.after.split("\u0001")[1]), [null, many[199].sha, many[399].sha], "each page follows `next` from the last row");
  assert.ok(asked.every((a) => a.limit > 0 && a.limit <= 500), "no ask beyond the table's own cap of 500");
  assert.equal(setup(READING_ROWS).asked.length, 0, "nothing is asked until a member is read");
});

test("R29 (seam, real job table): a row ended past the window is not told, and a row the table gives twice (same digest and state) is one notice", () => {
  const old = { ...READING_ROWS[1], sha: sha("9"), ended_at: Date.parse("2026-06-01T00:00:00Z") };
  const { items } = setup([...READING_ROWS, old, { ...READING_ROWS[1], ended_at: AT + 99 }]);
  assert.deepEqual(items("m1").map((i) => i.id), [`FINDING::reading-ended::${sha("3")}::refused`, `FINDING::reading-ended::${sha("1")}::finished`]);
});
