/* following's checks family C-137 (N620, K1836; DEC-49): every refusal this module answers carries its code, its row and
   the member's translation (R1's "one with a catalogue row carries its `check`, `code` and `translation`"), no code is
   held in another module's family, and no translation names a place (R18) or the group's own system other than as
   "your group's Civicsmith" (DEC-149). One test per row, each driving the act that refuses. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { world, body, MEMBER, BOB, OUTSIDER, MACHINE, T0, DAY } from "./fixture.mjs";
import { FOLLOWING_CHECKS, followRefusal } from "../../../src/following/index.mjs";

/* The walk below imports every plane file; the plane's store imports `cloudflare:workers`, which plain node cannot
   resolve, so that one specifier is answered with a stand-in class, as control-plane's harness does. */
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "cloudflare:workers")
      return { url: "data:text/javascript,export class DurableObject{constructor(c,e){this.ctx=c;this.env=e}};export const env={};", shortCircuit: true };
    return next(spec, ctx);
  },
});

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const REG = "https://registry.ellery.example/permits";
const PORTAL = "https://data.ellery.example/resource/permits.json";
const AGENDA = "https://ellery.example/selectboard/agenda";

/* one followed body per world */
const theBody = (w) => (w.followed ||= body(w));
const follow = (w, x = {}) => w.f.followBody({ body: theBody(w), from: "2026-09-01", author: MEMBER, viewer: MEMBER, ...x });
const reg = (w, x = {}) => w.f.followRegister({ address: REG, author: MEMBER, viewer: MEMBER, ...x });
const cred = { kind: "login", credential: "CRD-1", supplied_by: MEMBER };

/* Each code, and the act that refuses with it. */
const CASES = {
  MACHINE_CANNOT_FOLLOW: async (w) => [follow(w, { author: MACHINE }),
    w.f.perMeetingBody({ address: AGENDA, body: theBody(w), author: MACHINE })],
  NO_SUCH_HOME: async (w) => [reg(w, { home: "INFO-2026-9999-none" })],
  NO_SUCH_BODY: async (w) => [follow(w, { body: "ENT-2026-0999" })],
  NO_LEGISTAR_ID: async (w) => [w.f.followBody({ body: w.entity("Port Ellery Library Board"), from: "2026-09-01", author: MEMBER, viewer: MEMBER })],
  BAD_PERIOD: async (w) => [follow(w, { from: null }), follow(w, { until: "2026-08-01" })],
  BAD_FOLLOW_CADENCE: async (w) => [follow(w, { cadence: "hourly" }), reg(w, { cadence: "hourly" }),
    w.f.followPortal({ address: PORTAL, key: "id", cadence: "hourly", author: MEMBER, viewer: MEMBER })],
  NO_SUCH_FOLLOW: async (w) => [w.f.unfollow({ follow: 99, author: MEMBER }), await w.f.refreshRegister({ follow: 99, author: MEMBER }),
    w.f.snapshotDiff({ follow: 99, from: 1, to: 2, viewer: MEMBER }), w.f.snapshots({ follow: 99, viewer: MEMBER })],
  NOT_THE_AUTHOR: async (w) => [w.f.unfollow({ follow: reg(w).follow, author: OUTSIDER })],
  NO_LOCATOR: async (w) => [reg(w, { address: "http://registry.ellery.example/p" }),
    w.f.followPortal({ address: "ftp://data.ellery.example/x", key: "id", author: MEMBER, viewer: MEMBER })],
  BAD_RENDER: async (w) => [reg(w, { render: "yes" })],
  BAD_GATE: async (w) => [reg(w, { gated: { kind: "fee" } })],
  PERSON_QUERY_NOT_NAMED: async (w) => [w.f.followPersonQuery({ register: null, scheme: "ellery_licence", value: "L-00042",
    address: "https://licences.ellery.example/search?licence=L-00042", home: "INFO-2026-0002-a", author: MEMBER, viewer: MEMBER })],
  NO_KEY: async (w) => [w.f.followPortal({ address: PORTAL, key: " ", author: MEMBER, viewer: MEMBER })],
  NO_SUCH_MEETING_ADDRESS: async (w) => {
    w.bundle("INFO-2026-0100-agenda");
    w.watched.push({ bundle: "INFO-2026-0100-agenda", address: AGENDA });
    return [w.f.perMeetingBody({ address: "https://ellery.example/other", body: theBody(w), author: MEMBER, viewer: MEMBER })];
  },
  NO_SUCH_SNAPSHOT: async (w) => {
    const f = w.f.followPortal({ address: PORTAL, key: "id", author: MEMBER, viewer: MEMBER }).follow;
    w.serve(PORTAL, [{ id: "1" }]);
    await w.f.followTick(T0);
    return [w.f.snapshotDiff({ follow: f, from: 1, to: 9, viewer: MEMBER })];
  },
  NOT_GATED: async (w) => [await w.f.refreshRegister({ follow: reg(w).follow, author: MEMBER })],
  NOT_THE_FOLLOWER: async (w) => {
    const f = reg(w, { gated: { kind: "account" } }).follow;
    return [await w.f.refreshRegister({ follow: f, author: BOB, credential: cred }), await w.f.refreshRegister({ follow: f, author: MACHINE, credential: cred })];
  },
  PRICE_FIRST: async (w) => [await w.f.refreshRegister({ follow: reg(w, { gated: { kind: "fee", price: "$4.00" } }).follow, author: MEMBER, price: "$3.00" })],
  NO_CREDENTIAL: async (w) => [await w.f.refreshRegister({ follow: reg(w, { gated: { kind: "account" } }).follow, author: MEMBER })],
  /* the address answers nothing, so the member's refresh reads nothing */
  NOT_READ: async (w) => [await w.f.refreshRegister({ follow: reg(w, { gated: { kind: "account" } }).follow, author: MEMBER, credential: cred })],
  /* R22–R25: the watches a plan set running (one plan, PL-1, of the project; set up once per world) */
  WATCH_END_REFUSED: async (w) => {
    const s = watched(w);
    return [reg(w, { ends: "2026-10-06" }), w.f.followEnd({ follow: s.follow, ends: "2026-10-05", by: MEMBER }),
      w.f.watchAnswer({ link: s.asked, keep: { until: "2026-10-06" }, author: MEMBER }), w.f.watchAnswer({ link: s.asked, author: MEMBER })];
  },
  WATCH_ENDED: async (w) => [w.f.watchLink({ plan: "PL-1", watch: { kind: "follow", id: watched(w).ended }, author: MEMBER, viewer: MEMBER }),
    w.f.followEnd({ follow: watched(w).ended, ends: "2026-11-01", by: MEMBER })],
  MACHINE_CANNOT_LINK_WATCH: async (w) => [w.f.watchLink({ plan: "PL-1", watch: { kind: "follow", id: watched(w).follow }, author: MACHINE }),
    w.f.watchAnswer({ link: watched(w).asked, stop: true, author: MACHINE })],
  NO_SUCH_WATCH: async (w) => (watched(w), [w.f.watchLink({ plan: "PL-1", watch: { kind: "follow", id: 99 }, author: MEMBER, viewer: MEMBER }),
    w.f.watchAnswer({ link: 99, stop: true, author: MEMBER })]),
  WATCH_NOT_ASKED: async (w) => [w.f.watchAnswer({ link: watched(w).open, stop: true, author: MEMBER }),
    w.f.watchAnswer({ link: watched(w).asked, stop: true, author: BOB })],
  WATCH_RELIED_ON: async (w) => [w.f.watchAnswer({ link: watched(w).relied, stop: true, author: MEMBER })],
  /* T50 (R32, R33): the marks over a bundle alice sees; `MACHINE_CANNOT_MARK` is sources' row, tested in marks.test.mjs */
  MARK_NO_ITEM: async (w) => [w.f.watchItem({ by: MEMBER, viewer: MEMBER }), w.f.secondLook({ note: "look again", by: MEMBER, viewer: MEMBER }),
    w.f.secondLookClear({ by: MEMBER, viewer: MEMBER })],
  MARK_NO_SUCH_ITEM: async (w) => [w.f.watchItem({ item: "INFO-2026-9999-none", by: MEMBER, viewer: MEMBER }),
    w.f.secondLook({ item: "INFO-2026-9999-none", note: "look again", by: MEMBER, viewer: MEMBER }),
    w.f.secondLookClear({ item: "INFO-2026-9999-none", by: MEMBER, viewer: MEMBER })],
  SECOND_LOOK_NO_NOTE: async (w) => [w.f.secondLook({ item: "INFO-2026-0002-a", note: "  ", by: MEMBER, viewer: MEMBER })],
  SECOND_LOOK_NOT_OPEN: async (w) => [w.f.secondLookClear({ item: "INFO-2026-0002-a", by: MEMBER, viewer: MEMBER })],
  BAD_PROCEEDING_DATES: async (w) => {
    const p = w.proceeding("Ellery v. Marlow");
    return [w.f.proceedingDates({ proceeding: p, from: "October", viewer: MEMBER }),
      w.f.proceedingDates({ proceeding: p, from: "2026-11-01", to: "2026-10-01", viewer: MEMBER })];
  },
};

/* A plan PL-1 of the project, open, and PL-C closed: a follow linked to PL-C (asked), one linked to PL-1 (not yet asked), one
   linked to both a closed and an open plan (relied on), and an ended follow. */
function watched(w) {
  if (w.watchedSetup) return w.watchedSetup;
  w.st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES ('PRJ-2026-0001-a', 'bob', 'joined', 0, '2026-01-02', '2026-01-02')`);
  w.plan("PL-1", { project: "PRJ-2026-0001-a" });
  w.plan("PL-C", { project: "PRJ-2026-0001-a" });
  const mk = (n) => w.f.followRegister({ address: `${REG}/${n}`, author: MEMBER, viewer: MEMBER }).follow;
  const ln = (plan, id) => w.f.watchLink({ plan, watch: { kind: "follow", id }, author: MEMBER, viewer: MEMBER }).link;
  const follow = mk("a"), other = mk("b"), shared = mk("c"), ended = mk("d");
  const asked = ln("PL-C", follow), open = ln("PL-1", other), relied = ln("PL-C", shared);
  ln("PL-1", shared);
  w.f.unfollow({ follow: ended, author: MEMBER });
  w.close("PL-C", "2026-10-06T10:00:00Z");
  return (w.watchedSetup = { follow, ended, asked, open, relied });
}

for (const [code, row] of Object.entries(FOLLOWING_CHECKS)) {
  test(`R1 ${row.check} ${code}: the refusal carries its code, its row and the member's translation (DEC-49), and writes nothing`, async () => {
    const w = world();
    w.project("PRJ-2026-0001-a");
    w.bundle("INFO-2026-0002-a", { project: "PRJ-2026-0001-a" });
    assert.ok(CASES[code], `a case drives ${code}`);
    const before = (t) => w.rows(`SELECT count(*) AS n FROM ${t}`)[0].n;
    const counts = () => ["follows", "per_meeting_links", "follow_ends", "watch_links", "watch_answers", "watch_marks", "second_looks"].map(before);
    const answers = await CASES[code](w);
    const held = counts();
    for (const r of answers) {
      assert.equal(r.ok, false, JSON.stringify(r));
      assert.deepEqual([r.reason, r.code, r.check, r.translation], [code, code, row.check, row.translation], JSON.stringify(r));
      assert.equal(typeof r.detail, "string");
      assert.ok(r.detail.length > 0);
    }
    /* a refusal writes nothing beyond what the case itself set up */
    const again = await CASES[code](w);
    assert.equal(again.every((r) => r.ok === false && r.code === code), true);
    if (!["NOT_THE_AUTHOR", "NOT_GATED", "NOT_THE_FOLLOWER", "PRICE_FIRST", "NO_CREDENTIAL", "NOT_READ", "NO_SUCH_SNAPSHOT"].includes(code))
      assert.deepEqual(counts(), held);
  });
}

/* Every exported `*_CHECKS` family of every other plane module (the walk control-plane's composed catalogue makes). */
async function otherFamilies() {
  const modules = JSON.parse(readFileSync(join(REPO, "build/modules.json"), "utf8")).modules;
  const out = [];
  /* plane R68: the start registration is the first import of the plane's graph, before any table is read (R81). The walk
     imports plane files that reach it, so it runs here first. */
  await import(join(REPO, "bio-plane/src/store-assembly/register.mjs"));
  const walk = async (p) => {
    const abs = join(REPO, p);
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) if (!["node_modules", "dist", "test"].includes(f)) await walk(join(p, f)); return; }
    if (!p.endsWith(".mjs") || p.startsWith("bio-plane/src/store-assembly/")) return; // K5164: a second composition root (plan item 80)
    const ns = await import(abs);
    for (const [k, v] of Object.entries(ns))
      if (/_CHECKS$/.test(k) && v && typeof v === "object" && !Array.isArray(v)) out.push({ file: p, family: k, rows: v });
  };
  for (const m of modules) if (m.id !== "following") for (const p of m.paths || []) if (/^bio-plane\/(src|checks)(\/|$)/.test(p)) await walk(p);
  return out;
}

test("R1 C-137.1–C-137.20: following's own family, each row numbered once with its check, its site and its translation; no code of it is held in another module's family (NO_SUCH_ADDRESS re-keyed NO_SUCH_MEETING_ADDRESS, K1836), and followRefusal answers a row's fields", async () => {
  const rows = Object.entries(FOLLOWING_CHECKS);
  assert.deepEqual(rows.map(([, r]) => r.check), Array.from({ length: rows.length }, (_, i) => `C-137.${i + 1}`));
  for (const [code, r] of rows) {
    assert.match(code, /^[A-Z][A-Z_]+$/);
    assert.deepEqual(Object.keys(r).sort(), ["check", "translation", "where"]);
    assert.match(r.where, /^src\/following\/index\.mjs \S+ > is-[a-z-]+$/, code);
    assert.ok(typeof r.translation === "string" && r.translation.length > 20, code);
    assert.ok(Object.isFrozen(r), code);
  }
  assert.equal("NO_SUCH_ADDRESS" in FOLLOWING_CHECKS, false);
  const others = await otherFamilies();
  assert.ok(others.length > 50, String(others.length));
  for (const code of Object.keys(FOLLOWING_CHECKS)) {
    const held = others.filter((f) => Object.prototype.hasOwnProperty.call(f.rows, code)).map((f) => `${f.file} ${f.family}`);
    assert.deepEqual(held, [], `${code} is held elsewhere`);
  }
  assert.ok(others.every((f) => !Object.values(f.rows).some((r) => r && r.check && /^C-137\./.test(r.check))), "C-137 is following's alone");
  assert.deepEqual(followRefusal("NO_KEY", "d", { x: 1 }), { ok: false, reason: "NO_KEY", code: "NO_KEY", check: "C-137.13",
    translation: FOLLOWING_CHECKS.NO_KEY.translation, detail: "d", x: 1 });
});

test("R18 (DEC-149): no row's translation names a place, and none names the group's own system except as \"your group's Civicsmith\"", () => {
  for (const [code, r] of Object.entries(FOLLOWING_CHECKS)) {
    assert.doesNotMatch(r.translation, /oakland|alameda|california|ellery/i, code);
    const t = r.translation.replace(/your team's Civicsmith/g, "");
    assert.doesNotMatch(t, /\b(?:this|the|your|your own|our|its)\s+(?:Civicsmith\s+|group's\s+)?(?:instance|copy|plane)\b|\bservers?\b|Civicsmith/i, code);
  }
});

test("R4 the per-meeting link's refusals: MACHINE_CANNOT_FOLLOW, NO_SUCH_MEETING_ADDRESS (its own code, never monitoring's C-18.12), NO_SUCH_BODY, each with its C-137 row", () => {
  const w = world();
  const b = body(w);
  w.bundle("INFO-2026-0100-agenda");
  w.watched.push({ bundle: "INFO-2026-0100-agenda", address: AGENDA });
  for (const author of [MACHINE, ""]) {
    const m = w.f.perMeetingBody({ address: AGENDA, body: b, author, viewer: MEMBER });
    assert.deepEqual([m.code, m.check], ["MACHINE_CANNOT_FOLLOW", "C-137.1"]);
  }
  assert.equal(w.rows(`SELECT count(*) AS n FROM per_meeting_links`)[0].n, 0, "nothing written");
  const a = w.f.perMeetingBody({ address: "https://ellery.example/none", body: b, author: MEMBER, viewer: MEMBER });
  assert.deepEqual([a.code, a.check], ["NO_SUCH_MEETING_ADDRESS", "C-137.14"]);
  const n = w.f.perMeetingBody({ address: AGENDA, body: "ENT-2026-0999", author: MEMBER, viewer: MEMBER });
  assert.deepEqual([n.code, n.check], ["NO_SUCH_BODY", "C-137.3"]);
  assert.equal(w.f.perMeetingBody({ address: AGENDA, body: b, notice: "notice_of_sitting", author: MEMBER, viewer: MEMBER, at: T0 + DAY }).ok, true);
});
