/* R12: the security level becomes High (N703; K1874 (Q5), K1875; DEC-165 (7)), over the real `credentials` (its R44
   tally and R45 map and level) and the real `membership`, on credentials' own test world: the founder (`admin`), a
   second administrator and a member. The modules' clock (`Date.now`) is set by the test, and counts for earlier hours
   are laid in the tally's own table (kind, hour, country, count), as credentials' own tests lay them. */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "../credentials/fixture.mjs";
import { securityMapRefusal } from "../credentials/fixtures.mjs";
import { fresh, reader, ofKind, texts, notHintFailures, JUDGMENT } from "./fixture.mjs";
import { HINT_MARK, NOTICE_KINDS, SECURITY_LEVELS } from "../../../src/notice-producers/index.mjs";
import { SECURITY_DAYS } from "../../../src/credentials/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const KIND = "security-level-high";
const H = 3600e3;
/* "Now": half past an hour, two days on, so every hour named below is whole. */
const NOW = (Math.floor(Date.now() / H) + 48) * H + 30 * 60e3;
const HOUR = Math.floor(NOW / H);
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const lay = (w, kind, hour, n, country = "") =>
  w.sql.exec(`INSERT INTO security_counts (kind, hour, country, count) VALUES (?,?,?,?)
              ON CONFLICT(kind, hour, country) DO UPDATE SET count=count+excluded.count`, kind, hour, country, n);
const MONTH = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/* an instant as the sentences name a moment in UTC (R25: `time.at` of `date.daymonthyear` and `time.clock`, with "UTC" after it) */
const moment = (ms) => {
  const d = new Date(ms), h = d.getUTCHours();
  const date = word("date.daymonthyear", { day: String(d.getUTCDate()), month: word(`date.month.${MONTH[d.getUTCMonth()]}`), year: String(d.getUTCFullYear()) });
  const time = word("time.clock", { hour: String(h % 12 || 12), minute: String(d.getUTCMinutes()).padStart(2, "0"), ampm: word(h < 12 ? "time.am" : "time.pm") });
  return `${word("time.at", { date, time })} UTC`;
};
function at(t, fn) {
  const real = Date.now;
  Date.now = () => t;
  try { return fn(); } finally { Date.now = real; }
}
async function setup(over = {}) {
  const w = await world().group("alice");
  w.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);   /* duties' table, empty (R5) */
  const n = fresh(w.ctx, { membership: w.m, credentials: w.c, ...over });
  const { read } = reader(n);
  /* a read at `t` (both the read's `now` and the modules' clock), as each member */
  const items = (member, t = NOW) => at(t, () => ofKind(read(member, { now: t }), KIND));
  return { w, n, read, items };
}

test("R12: while the level is Ordinary or Raised no item is raised; when it is High, one FINDING security-level-high to each active administrator and to nobody else", async () => {
  const { w, items } = await setup();
  for (const m of ["admin", "second", "alice"]) assert.deepEqual(items(m), [], `Ordinary: ${m}`);
  lay(w, "rate", HOUR - 20, 40);
  at(NOW, () => assert.equal(w.c.securityLevel().level, "Raised"));
  for (const m of ["admin", "second", "alice"]) assert.deepEqual(items(m), [], `Raised: ${m}`);
  lay(w, "rate", HOUR - 1, 40);
  at(NOW, () => assert.equal(w.c.securityLevel().level, "High"));
  const a = items("admin"), s = items("second");
  assert.equal(a.length, 1);
  assert.equal(s.length, 1);
  assert.equal(a[0].id, s[0].id, "one episode, one key, for each administrator");
  assert.deepEqual(a[0].recipients, ["admin"]);
  assert.deepEqual(s[0].recipients, ["second"]);
  assert.equal(a[0].class, "FINDING");
  assert.equal(NOTICE_KINDS[KIND], "FINDING");
  assert.equal(a[0].label, "noticed");
  assert.deepEqual(a[0].subject.kind, "civicsmith", "the team's Civicsmith, no bundle");
  assert.equal(a[0].subject.id, null);
  assert.deepEqual(a[0].case.ancestors, []);
  for (const m of ["alice", "nobody", null]) assert.deepEqual(items(m), [], `not an administrator: ${m}`);
  /* an administrator who is no longer active receives none */
  w.sql.exec(`UPDATE members SET status='revoked' WHERE member_id='second'`);
  assert.deepEqual(items("second"), []);
});

test("R12: the item is keyed by its episode's start, to the hour, and opens the security screen at that period, from the start to the instant derived", async () => {
  const { w, items } = await setup();
  lay(w, "rate", HOUR - 8, 3);                       /* not unusual: the hour before the episode */
  for (let h = HOUR - 7; h < HOUR; h++) lay(w, "rate", h, 40);
  const [it] = items("admin");
  const start = iso((HOUR - 7) * H);
  assert.equal(it.id, `FINDING::${KIND}::${start}`);
  assert.deepEqual(it.screen, { op: "securitymap", from: start, to: iso(NOW) });
  assert.ok(it.detail.includes(`since ${moment((HOUR - 7) * H)}`), "R25: the instant is written in words");
  /* the screen it opens answers that period */
  const m = at(NOW, () => w.c.securityMap({ from: it.screen.from, to: it.screen.to, by: "admin" }));
  assert.equal(m.ok, true);
  assert.equal(m.level, "High");
});

test("R12: an episode is an unbroken run: an earlier unusual hour before a quiet one is not part of it; a through starts it at its own hour; a through in the current hour starts it then", async () => {
  {
    const { w, items } = await setup();
    lay(w, "rate", HOUR - 10, 40);                     /* unusual, then a quiet hour */
    for (let h = HOUR - 8; h < HOUR; h++) lay(w, "rate", h, 40);
    assert.equal(items("admin")[0].screen.from, iso((HOUR - 8) * H));
  }
  {
    const { w, items } = await setup();
    lay(w, "through", HOUR - 3, 1);
    const [it] = items("admin");
    assert.equal(it.id, `FINDING::${KIND}::${iso((HOUR - 3) * H)}`);
    assert.ok(it.detail.includes(word("notice-producers.got_through_paused", { through: "1", through_2: word("notice-producers.sign_recovery") })));
  }
  {
    const { w, items } = await setup();
    lay(w, "through", HOUR, 2);
    const [it] = items("admin");
    assert.equal(it.screen.from, iso(HOUR * H));
    assert.ok(it.detail.includes(word("notice-producers.got_through_paused", { through: "2", through_2: word("notice-producers.sign_ins_recoveries") })));
  }
});

test("R12: raised once per episode: while it lasts, later reads answer the same key; once a read answers Raised or Ordinary it has ended, and a later episode raises a fresh one", async () => {
  const { w, items } = await setup();
  for (let h = HOUR - 3; h < HOUR; h++) lay(w, "rate", h, 40);
  const first = items("admin")[0].id;
  lay(w, "rate", HOUR, 40);
  assert.deepEqual(items("admin", NOW + H).map((i) => i.id), [first], "an hour on, the same episode");
  lay(w, "rate", HOUR + 1, 40);
  assert.deepEqual(items("admin", NOW + 2 * H).map((i) => i.id), [first], "two hours on");
  /* the attack stops: the last whole hour is quiet, the level Raised, the item gone */
  at(NOW + 3 * H, () => assert.equal(w.c.securityLevel().level, "Raised"));
  assert.deepEqual(items("admin", NOW + 3 * H), []);
  /* a later episode */
  lay(w, "rate", HOUR + 4, 40);
  const later = items("admin", NOW + 5 * H);
  assert.deepEqual(later.map((i) => i.id), [`FINDING::${KIND}::${iso((HOUR + 4) * H)}`]);
  assert.notEqual(later[0].id, first);
});

test("R12: an episode longer than one securityMap read is read back hour by hour across reads; one reaching the days kept starts at the first hour kept", async () => {
  {
    const { w, items } = await setup();
    for (let h = HOUR - 100; h < HOUR; h++) lay(w, "rate", h, 40);
    assert.equal(items("admin")[0].screen.from, iso((HOUR - 100) * H));
  }
  {
    const { w, read } = await setup();
    const first = HOUR - SECURITY_DAYS * 24;
    for (let h = first; h <= HOUR; h += 20) lay(w, "through", h, 1);
    const r = at(NOW, () => read("admin", { now: NOW }));
    const [it] = ofKind(r, KIND);
    assert.equal(it.screen.from, iso(first * H));
    assert.deepEqual(r.facts.security_level, { days: SECURITY_DAYS, truncated: true });
  }
});

test("R12: its detail is one plain sentence: the level is High, since when, whether anything got through; counts only, naming no address, country, role, handle or member", async () => {
  const { w, items } = await setup();
  for (let h = HOUR - 2; h < HOUR; h++) { lay(w, "signin", h, 30, "NZ"); lay(w, "rate", h, 30, "FR"); }
  const [it] = items("admin");
  /* the sentence's parts are words; the sentence itself is held by the design stream's words (none given yet, so it is not copied here) */
  assert.ok(it.detail.includes(moment((HOUR - 2) * H)) && it.detail.includes(word("notice-producers.nothing_got_through")), "the instant and the count, in words");
  const words = [it.summary, it.detail].join(" ");
  for (const x of ["NZ", "FR", "admin", "second", "alice", "cover of", "member:", "role"]) assert.ok(!words.includes(x), x);
  assert.doesNotMatch(words, JUDGMENT);
  assert.deepEqual(notHintFailures(it, HINT_MARK), [], "not a hint");
  assert.ok(!texts(it).some((t) => /\b(?:NZ|FR)\b/.test(t)), "no country anywhere in the item");
});

test("R12 R20: the security-level item keeps its plain sentence: words.json holds no key for it and it answers none (control: R15's item, beside it, answers its keys)", async () => {
  const { w, items } = await setup();
  for (let h = HOUR - 2; h < HOUR; h++) { lay(w, "signin", h, 30, "NZ"); lay(w, "rate", h, 30, "FR"); }
  const [it] = items("admin");
  assert.equal("summary_key" in it, false);
  assert.equal("detail_key" in it, false);
  const { WORDS } = await import("../ai-use/fixture.mjs");
  assert.equal(Object.keys(WORDS).some((k) => k.startsWith("queue.security-level-high")), false);
  assert.equal(typeof WORDS["queue.security-tool-off.detail"], "string", "control: R15's key is held");
});

test("R12: a securityLevel or securityMap that throws or does not answer contributes no item and is named in facts.failed, never read as Ordinary; the read writes nothing", async () => {
  const boom = () => { throw new Error("down"); };
  for (const securityLevel of [boom, () => null, () => ({}), () => ({ level: "Unknown" }), () => ({ level: null, levelAt: null })]) {
    const { read } = await setup({ credentials: { securityLevel, securityMap: boom } });
    const r = at(NOW, () => read("admin", { now: NOW }));
    assert.deepEqual(ofKind(r, KIND), []);
    assert.deepEqual(r.facts.failed, ["credentials"], String(securityLevel));
  }
  assert.deepEqual([...SECURITY_LEVELS], ["Ordinary", "Raised", "High"]);
  const refusals = await securityMapRefusal();
  for (const securityMap of [boom, () => refusals.invalidPeriod, () => null]) {
    const { read } = await setup({ credentials: { securityLevel: () => ({ level: "High", levelAt: iso(NOW) }), securityMap } });
    const r = at(NOW, () => read("admin", { now: NOW }));
    assert.deepEqual(ofKind(r, KIND), []);
    assert.deepEqual(r.facts.failed, ["credentials"]);
  }
  /* a non-administrator's read never asks the level or the map, so their failure is none of theirs (R16's own reads, ai-use's,
     are every member's, and none of credentials') */
  let asked = 0;
  const counted = () => { asked += 1; throw new Error("down"); };
  const quiet = await setup({ credentials: { securityLevel: counted, securityMap: counted } });
  assert.equal(at(NOW, () => quiet.read("alice", { now: NOW })).facts.failed.includes("credentials"), false);
  assert.equal(asked, 0);
  /* writes nothing */
  const { w } = await setup();
  for (let h = HOUR - 3; h < HOUR; h++) lay(w, "rate", h, 40);
  const n = fresh(w.ctx, { membership: w.m, credentials: w.c });
  const before = w.snapshot();
  assert.equal(at(NOW, () => ofKind(reader(n).read("admin", { now: NOW }), KIND)).length, 1);
  assert.equal(w.snapshot(), before);
});

test("R25 (T51; DEC-299, DEC-333, DEC-335) the security item's instant is a plain date and time in the team's zone: an episode starting 2026-10-16T16:00:00Z for a team in the Pacific zone reads 9:00 AM; with no zone the UTC reading and UTC; control: id and screen.from stay ISO, and a second read in the episode keeps the id", async () => {
  const START = Date.parse("2026-10-16T16:00:00Z"), NOW_R25 = Date.parse("2026-10-17T12:30:00Z");
  const episode = async (over) => {
    const { w, items } = await setup(over);
    lay(w, "rate", START / H - 1, 3);                  /* not unusual: the hour before the episode */
    for (let h = START / H; h < NOW_R25 / H; h++) lay(w, "rate", h, 40);
    return { items: (member) => items(member, NOW_R25) };
  };
  const PACIFIC = () => ({ time_zone: { value: "America/Los_Angeles" } });
  const pac = await episode({ view: PACIFIC });
  const [it] = pac.items("admin");
  const date = word("date.daymonthyear", { day: "16", month: word("date.month.october"), year: "2026" });
  const time = word("time.clock", { hour: "9", minute: "00", ampm: word("time.am") });
  assert.ok(it.detail.includes(`since ${word("time.at", { date, time })}, `), "the Pacific reading, 9:00 AM");
  assert.doesNotMatch(it.detail, /\d{4}-\d{2}-\d{2}T|Z\b/, "no ISO instant in the words");
  /* control: the same episode with no zone held reads the UTC reading (4:00 PM), with UTC after it */
  const none = await episode({});
  const [utc] = none.items("admin");
  assert.ok(utc.detail.includes(`since ${moment(START)}, `), "no zone: the UTC reading and UTC");
  assert.ok(utc.detail.includes(word("time.clock", { hour: "4", minute: "00", ampm: word("time.pm") })), "4:00 PM in UTC");
  /* the identifiers keep the ISO instant, and a second read in the episode answers the same id */
  assert.equal(it.id, `FINDING::${KIND}::2026-10-16T16:00:00Z`);
  assert.equal(it.screen.from, "2026-10-16T16:00:00Z");
  assert.equal(pac.items("admin")[0].id, it.id);
});
