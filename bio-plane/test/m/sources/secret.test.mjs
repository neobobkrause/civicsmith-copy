/* sources: consent by the knocker's own secret, with no account (R11). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, SECRET, OTHER_SECRET, T0 } from "./fixture.mjs";
import { SOURCES_CHECKS, SECRET_NOT_RECOGNISED_ANSWER, CONSENT_STATEMENT, WITHDRAWAL_STATEMENT } from "../../../src/sources/index.mjs";

const KNOCK_WINDOW = 10 * 60 * 1000;
/* A ceiling on guesses, far above any bound the doorbell's rate could state; reaching it means the rate never refused. */
const GUESS_CEILING = 100;

/** Wrong guesses from one source, at the module's clock, until an attempt is refused: every attempt before it must be
 *  answered SECRET_NOT_RECOGNISED. Answers the refusal, with `admitted`, how many guesses the window let through first.
 *  Fails if no attempt is refused under the ceiling. */
async function guessUntilRefused(w, entry, sourceAddress) {
  for (let i = 0; i < GUESS_CEILING; i++) {
    const r = await w.s.consentBySecret({ knockerSecret: "a wrong guess of sufficient length " + i, entry, audience: "public", sourceAddress });
    if (r.reason !== "SECRET_NOT_RECOGNISED") return { ...r, admitted: i };
  }
  assert.fail(`${GUESS_CEILING} attempts from one source in one window, and the knock's rate never refused one`);
}

test("R11 a source proves who they are by presenting their knocker secret and consents to, or withdraws from, one entry for one audience, as R7 records a consent", async () => {
  const w = seeded();
  const { sourceId } = await w.pulled({ secret: SECRET });
  const e = w.disclose(sourceId);
  w.tick();
  const c = await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "public", sourceAddress: "198.51.100.7" });
  assert.equal(c.ok, true);
  assert.equal(c.act, "consent");
  assert.equal(c.statement, CONSENT_STATEMENT);
  const row = w.rows(`SELECT * FROM source_consents ORDER BY seq DESC LIMIT 1`)[0];
  assert.equal(row.via, "secret");
  assert.equal(row.entry_id, e.entry);
  assert.equal(row.audience, "public");
  assert.equal(w.s.publishableAt({ source: sourceId, audience: "public" }).entries.find((x) => x.entry === e.entry).basis, "consent",
               "recorded as R7 records a consent");
  assert.ok(!JSON.stringify(w.snapshot()).includes(SECRET), "the secret is held nowhere");
  assert.ok(!JSON.stringify(c).includes(SECRET));
  /* the same consent again writes nothing; a withdrawal binds later publications */
  const n = w.count("source_consents");
  assert.equal((await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "public", sourceAddress: "x" })).existed, true);
  assert.equal(w.count("source_consents"), n);
  w.tick();
  const wd = await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "public", withdraw: true, sourceAddress: "x" });
  assert.equal(wd.ok, true); assert.equal(wd.act, "withdraw"); assert.equal(wd.statement, WITHDRAWAL_STATEMENT);
  w.tick();
  assert.equal(w.s.publishableAt({ source: sourceId, audience: "public" }).entries.some((x) => x.entry === e.entry), false);
});

test("R11 SECRET_NOT_RECOGNISED is answered identically for every failure: a wrong secret, a short one, none, another source's entry, an unknown entry, a bad audience, a lower audience than stands, a malformed call", async () => {
  const w = seeded();
  const a = await w.pulled({ secret: SECRET }), b = await w.pulled({ secret: OTHER_SECRET }), bare = await w.pulled();
  const e = w.disclose(a.sourceId), eb = w.disclose(b.sourceId), ebare = w.disclose(bare.sourceId);
  w.tick();
  await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "public", sourceAddress: "s0" });
  const before = w.snapshot();
  const good = { knockerSecret: SECRET, entry: e.entry, audience: "group", sourceAddress: "s1" };
  const answers = [];
  for (const [bad, why] of [
    [{ knockerSecret: "a wrong secret of enough length" }, "a wrong secret"],
    [{ knockerSecret: SECRET.slice(0, 19) }, "a secret under 20 characters"],
    [{ knockerSecret: undefined }, "no secret"], [{ knockerSecret: 12345678901234567890 }, "a number"],
    [{ entry: eb.entry }, "another source's entry"], [{ entry: ebare.entry }, "an entry of a source without a secret"],
    [{ entry: "SRCE-none" }, "an unknown entry"], [{ entry: undefined }, "no entry"],
    [{ audience: "world" }, "a bad audience"], [{ audience: undefined }, "no audience"],
    [{ audience: "member" }, "lower than the public consent that stands"],
    [{ withdraw: "yes" }, "a malformed withdraw flag"],
  ]) {
    w.tick(KNOCK_WINDOW);   // one attempt per window: the doorbell's instance limit (its R2) never answers in its place
    const r = await w.s.consentBySecret({ ...good, ...bad, sourceAddress: `s-${answers.length}` });
    assert.equal(r.reason, "SECRET_NOT_RECOGNISED", why);
    answers.push(JSON.stringify(r));
  }
  for (const args of [undefined, null, {}, "text"]) { w.tick(KNOCK_WINDOW); answers.push(JSON.stringify(await w.s.consentBySecret(args))); }
  assert.equal(new Set(answers).size, 1, "byte for byte the same answer");
  const r = JSON.parse(answers[0]);
  assert.equal(r.check, SOURCES_CHECKS.SECRET_NOT_RECOGNISED.check);
  assert.equal(r.translation, SOURCES_CHECKS.SECRET_NOT_RECOGNISED.translation);
  assert.equal(answers[0], JSON.stringify(SECRET_NOT_RECOGNISED_ANSWER));
  assert.deepEqual(w.snapshot(), before, "a failure records nothing");
  /* the negative control */
  w.tick();
  assert.equal((await w.s.consentBySecret({ ...good, audience: "public", entry: e.entry, withdraw: true })).ok, true);
});

test("R11 the act is rate-bound as a knock is, in the same windows as knocks: a consent attempt counts as a knock from its source (doorbell R2, R17; K530)", async () => {
  const w = seeded();
  const { sourceId } = await w.pulled({ secret: SECRET });
  const e = w.disclose(sourceId);
  /* every attempt, whatever its outcome, is counted in the knock windows with its source */
  const n0 = w.spy.attempts.length, counted = () => w.rows(`SELECT coalesce(sum(count), 0) AS n FROM knock_rate WHERE bucket LIKE 'all:%'`)[0].n;
  const c0 = counted();
  await w.s.consentBySecret({ knockerSecret: "wrong, but long enough to count", entry: e.entry, audience: "group", sourceAddress: "203.0.113.9", now: w.clock.now });
  await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "group", sourceAddress: "203.0.113.9", now: w.clock.now });
  await w.s.consentBySecret(null);
  assert.equal(w.spy.attempts.length, n0 + 3);
  assert.equal(counted(), c0 + 3, "each attempt is counted in the instance's knock window, as a knock is");
  assert.deepEqual(w.spy.attempts.slice(n0, n0 + 2).map((x) => x.sourceAddress), ["203.0.113.9", "203.0.113.9"]);
  /* guesses from one source, in one window, until the window refuses: each guess the window admits is not recognised,
     and the first refusal is the knock's per-source rate refusal (the doorbell's bound, whatever it is, never stated here) */
  const refused = await guessUntilRefused(w, e.entry, "192.0.2.1");
  assert.equal(refused.reason, "RATE_IP", "the first refusal from one source is the knock's per-source rate, never SECRET_NOT_RECOGNISED");
  /* once refused, even the right secret from that source is refused by the rate, and nothing is recorded */
  const n = w.count("source_consents");
  const r = await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "public", sourceAddress: "192.0.2.1" });
  assert.equal(r.reason, "RATE_IP", "the right secret past the source's bound is refused by the rate");
  assert.equal(w.count("source_consents"), n, "a rate refusal records nothing");
  /* another source is not bound by that one's count */
  assert.equal((await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "public", sourceAddress: "192.0.2.2" })).ok, true);
  /* a doorbell that cannot count answers the one refusal, never an uncounted consent */
  const w2 = seeded();
  const s2 = await w2.pulled({ secret: SECRET });
  const e2 = w2.disclose(s2.sourceId);
  w2.bell.knockAttempt = async () => { throw new Error("store silent"); };
  assert.equal((await w2.s.consentBySecret({ knockerSecret: SECRET, entry: e2.entry, audience: "group", sourceAddress: "z" })).reason,
               "SECRET_NOT_RECOGNISED");
  assert.equal(w2.count("source_consents"), 0);
});

test("R11 the rate is counted on one clock: an attempt the control plane sends no instant for is counted at this module's clock, never the wall clock, and the knock window holds across its edge (doorbell R2, R17)", async () => {
  const W = 10 * 60 * 1000;
  for (const offset of [-1, 0, 1, W / 2]) {
    const w = seeded();
    const edge = Math.ceil(T0 / W) * W + 7 * W;          // a window's edge, far from the wall clock's window
    w.clock.now = edge - 2000;
    const { sourceId } = await w.pulled({ secret: SECRET });
    const e = w.disclose(sourceId);
    w.clock.now = edge + offset;
    const all = () => w.rows(`SELECT coalesce(sum(count), 0) AS n FROM knock_rate WHERE bucket LIKE 'all:%'`)[0].n;
    const before = all();
    await w.s.consentBySecret({ knockerSecret: "a wrong guess of sufficient length", entry: e.entry, audience: "group", sourceAddress: "x1" });
    await w.s.consentBySecret(null);
    await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "group", sourceAddress: "x1", now: String(w.clock.now) });
    assert.equal(all(), before + 3, `offset ${offset}: three attempts, counted in the window, the earlier bucket kept`);
    assert.ok(w.spy.attempts.slice(-3).every((a) => Number(a.now) === w.clock.now), `offset ${offset}: every attempt at the module's clock`);
    /* the per-source bound holds at the edge: the two attempts already counted from this source stand in its window,
       so it is refused two guesses sooner than a source with none counted (the same clock, a fresh store), and the
       refusal is the knock's per-source rate, never SECRET_NOT_RECOGNISED in its place */
    const fresh = seeded();
    fresh.clock.now = edge - 2000;
    const f = fresh.disclose((await fresh.pulled({ secret: SECRET })).sourceId);
    fresh.clock.now = edge + offset;
    const baseline = await guessUntilRefused(fresh, f.entry, "x1");
    assert.equal(baseline.reason, "RATE_IP", `offset ${offset}: a source with nothing counted is refused by the rate too`);
    const refused = await guessUntilRefused(w, e.entry, "x1");
    assert.equal(refused.reason, "RATE_IP", `offset ${offset}: the first refusal from one source is the knock's per-source rate`);
    assert.equal(refused.admitted, baseline.admitted - 2, `offset ${offset}: the attempts counted before stand in the window`);
    assert.equal((await w.s.consentBySecret({ knockerSecret: SECRET, entry: e.entry, audience: "public", sourceAddress: "x1" })).reason, "RATE_IP",
                 `offset ${offset}: the right secret from that source, past its bound, is refused by the rate`);
  }
});

