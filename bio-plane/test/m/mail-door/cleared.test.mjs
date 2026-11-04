/* mail-door R15: the clearing's owners kept as counts until the producer (notice-producers) has read them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, addressFor, plain, eml, STANDARD, T0, DAY } from "./fixture.mjs";

/* a machine identity the control plane mints (record-grammar's `class:` prefix), as an unattended producer reads */
const PRODUCER = "class:daemon";

async function two() {
  const env = fresh();
  const ann = await addressFor(env.d, "ann"), bo = await addressFor(env.d, "bo");
  return { ...env, ann, bo };
}

test("R15 a clearing of two owners' mail keeps two entries, answered by cleared_at with a cursor", async () => {
  const { d, ann, bo } = await two();
  await d.receiveMail({ raw: plain("a1"), envelope_to: ann, now: T0 });
  await d.receiveMail({ raw: plain("a2"), envelope_to: ann, now: T0 + 1000 });
  await d.receiveMail({ raw: plain("b1"), envelope_to: bo, now: T0 + 2000 });
  await d.receiveMail({ raw: plain("b2"), envelope_to: bo, now: T0 + 3 * DAY });
  const at1 = T0 + 15 * DAY, at2 = T0 + 18 * DAY;
  await d.clearWaitingMail({ now: at1 });
  await d.clearWaitingMail({ now: at2 });
  const all = d.clearedOwners({ viewer: PRODUCER, now: at2 });
  assert.deepEqual(all.entries, [
    { owner: "ann", count: 2, received_dates: [new Date(T0).toISOString(), new Date(T0 + 1000).toISOString()], cleared_at: new Date(at1).toISOString() },
    { owner: "bo", count: 1, received_dates: [new Date(T0 + 2000).toISOString()], cleared_at: new Date(at1).toISOString() },
    { owner: "bo", count: 1, received_dates: [new Date(T0 + 3 * DAY).toISOString()], cleared_at: new Date(at2).toISOString() },
  ]);
  assert.equal(all.truncated, false);
  const p1 = d.clearedOwners({ viewer: PRODUCER, limit: 2, now: at2 });
  assert.deepEqual([p1.entries.map((e) => e.owner), p1.truncated], [["ann", "bo"], true]);
  const p2 = d.clearedOwners({ viewer: PRODUCER, limit: 2, after: p1.cursor, now: at2 });
  assert.deepEqual([p2.entries, p2.truncated], [all.entries.slice(2), false]);
  const p3 = d.clearedOwners({ viewer: PRODUCER, after: p2.cursor, now: at2 });
  assert.deepEqual(p3.entries, []);
  assert.equal(d.clearedOwners({ viewer: PRODUCER, limit: 0, now: at2 }).entries.length, 1, "limit clamped to 1");
});

test("R15 an entry 31 days old is gone; one 29 days old is still answered", async () => {
  const { d, rows, ann } = await two();
  await d.receiveMail({ raw: plain("old"), envelope_to: ann, now: T0 });
  const at = T0 + 15 * DAY;
  await d.clearWaitingMail({ now: at });
  assert.equal(d.clearedOwners({ viewer: PRODUCER, now: at + 29 * DAY }).entries.length, 1);
  assert.deepEqual(d.clearedOwners({ viewer: PRODUCER, now: at + 31 * DAY }).entries, []);
  await d.clearWaitingMail({ now: at + 31 * DAY });
  assert.equal(rows(`SELECT COUNT(*) AS n FROM mail_cleared`)[0].n, 0, "dropped from the store at the next clearing");
});

test("R15 a viewer who is a member, or no viewer, is answered nothing; the read writes nothing and never throws", async () => {
  const { d, ann, everything } = await two();
  await d.receiveMail({ raw: plain("x"), envelope_to: ann, now: T0 });
  await d.clearWaitingMail({ now: T0 + 15 * DAY });
  const before = JSON.stringify(everything());
  for (const viewer of ["member:ann", "member:bo", "ann", null, undefined, 42])
    assert.deepEqual(d.clearedOwners({ viewer, now: T0 + 15 * DAY }), { ok: true, entries: [], cursor: null, truncated: false }, String(viewer));
  assert.equal(d.clearedOwners({ viewer: PRODUCER, now: T0 + 15 * DAY }).entries.length, 1);
  assert.deepEqual(d.clearedOwners({ viewer: PRODUCER, after: "not-a-cursor" }).entries, []);
  assert.doesNotThrow(() => d.clearedOwners());
  assert.equal(JSON.stringify(everything()), before);
});

test("R15 control: a clearing that removed nothing keeps no entry; no entry holds a header or text", async () => {
  const { d, rows, ann } = await two();
  await d.receiveMail({ raw: eml(STANDARD, "secret subject body"), envelope_to: ann, now: T0 });
  await d.clearWaitingMail({ now: T0 + DAY });
  assert.equal(rows(`SELECT COUNT(*) AS n FROM mail_cleared`)[0].n, 0);
  await d.clearWaitingMail({ now: T0 + 15 * DAY });
  const kept = rows(`SELECT * FROM mail_cleared`);
  assert.equal(kept.length, 1);
  assert.deepEqual(Object.keys(kept[0]).sort(), ["cleared_at", "cleared_ms", "count", "owner", "received_dates", "seq"]);
  const text = JSON.stringify(kept) + JSON.stringify(d.clearedOwners({ viewer: PRODUCER, now: T0 + 15 * DAY }));
  for (const h of ["Ada Lane", "ada@example.org", "Records request", "secret", "@"]) assert.equal(text.includes(h), false, h);
});
