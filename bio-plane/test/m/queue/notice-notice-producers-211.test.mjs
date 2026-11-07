/* notice notice-producers:211 (T53; K5571 (2)): `notice-producers` no longer reads `ai-accounts.projectAccountsSuspended`
   (retired with ai-accounts R13), so it mints no `project-account-suspended` item, and an `ai-use.limitsReached` entry
   answering `source: "provider"` was told by none (PR 211); since PR 809 (`notice-producers` R16, ai-use:105) a provider
   limit standing is told again, as one `ai-limit-reached` item keyed by the entry's own key. Queue's R1 and R12 still
   catalogue `project-account-suspended` and its `queuemute` door; an extra catalogued kind that nobody mints changes no
   feed, so this module keeps them until its requirements retire the kind (BOB's text). What this module must hold is that
   the feed it assembles over the real `notice-producers`, on ai-use's own test world (its fixture), still answers: the
   account's own limit and a provider limit are each minted as R1 classes it with R12's door, and the notice-producers
   feed is answered (R60), not failed. With PR 211 reverted, notice-producers asks ai-accounts for the retired read and the
   feed's notice-producers row answers false. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./world.mjs";
import { noticeProducersOf } from "../../../src/notice-producers/index.mjs";
import { NONE } from "../notice-producers/fixture.mjs";
import { standard } from "../ai-use/fixture.mjs";

const AT = "2026-10-09T12:00:00Z";
const UTC = () => ({ time_zone: { value: "UTC" } });

async function setup() {
  const u = await standard();
  const w = world({}, { notices: (host, { membership }) => noticeProducersOf(host, { ...NONE, membership, aiUse: u.u, aiAccounts: u.a, view: UTC }) });
  w.member("ann"); w.member("bob");
  w.now = Date.parse(AT);
  return { u, w };
}
const row = (f) => f.feeds.find((r) => r.feed === "notice-producers");

test("notice notice-producers:211: over the real notice-producers, ann's own limit reached and a provider limit standing beside it are each one ai-limit-reached item with R12's door, and the notice-producers feed answers", async () => {
  const { u, w } = await setup();
  assert.equal(u.u.recordProviderLimit({ owner: "member:ann", account_id: u.acct.ann, entry_id: null, kind: "quota", scope: "account",
                                         resets_at: "2026-11-01T00:00:00Z", at: AT }).ok, true);
  assert.equal(u.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann", at: AT }).ok, true);
  u.count("member:ann", "ann", "ask", { at: "2026-10-09T11:00:00Z" });
  const reached = u.u.limitsReached({ viewer: "ann", at: AT }).reached;
  assert.deepEqual(reached.map((e) => e.source).sort(), ["own", "provider"], "ai-use answers both to ann");
  const keys = reached.map((e) => `FINDING::ai-limit-reached::${e.key}`).sort();
  const f = w.feed("ann");
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 400));
  const limits = f.items.filter((i) => i.kind === "ai-limit-reached");
  assert.deepEqual(limits.map((i) => i.id).sort(), keys, "one item per entry, the provider limit included (PR 809)");
  for (const i of limits) assert.deepEqual([i.class, i.disposition.available, i.disposition.instead], ["FINDING", false, "queuemute"]);
  assert.equal(f.items.some((i) => i.kind === "project-account-suspended"), false);
  assert.deepEqual([row(f).answered, row(f).failed], [true, []], "the notice-producers feed answered, naming no failure");
  assert.equal(f.all_clear.FINDING, false, "an item is held");
  // control: bob is told of neither, and his FINDING class is clear because every feed answered
  const g = w.feed("bob");
  assert.equal(g.items.some((i) => i.kind === "ai-limit-reached"), false);
  assert.deepEqual([row(g).answered, row(g).failed], [true, []]);
});

test("notice notice-producers:211 (PR 809): an entry answering source provider is one item with R12's door, as the same entry as the account's own limit is", async () => {
  const { u } = await setup();
  const entry = { key: "ai-provider-limit:member:ann:quota:2026-11-01T00:00:00Z", owner: "member:ann", scope: "account", kind: "quota",
                  unit: null, period: "day", period_start: "2026-10-09", resets_at: "2026-11-01T00:00:00Z", reached_at: AT, source: "provider" };
  /* ai-use's real answer for ann, with this one entry laid in its `reached` (the answer's shape is ai-use's own) */
  const real = u.u.limitsReached({ viewer: "ann", at: AT });
  const over = (reached) => world({}, { notices: (host, { membership }) => noticeProducersOf(host, { ...NONE, membership, aiAccounts: u.a, view: UTC,
    aiUse: { ...NONE.aiUse, limitsReached: () => ({ ...real, reached }) } }) });
  const run = (reached) => { const v = over(reached); v.member("ann"); v.now = Date.parse(AT); return v.feed("ann"); };
  const f = run([entry]);
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 400));
  assert.deepEqual(f.items.filter((i) => i.kind === "ai-limit-reached").map((i) => [i.id, i.class, i.disposition.instead]),
                   [[`FINDING::ai-limit-reached::${entry.key}`, "FINDING", "queuemute"]]);
  assert.deepEqual(row(f).failed, []);
  // control: the same entry as ann's own limit is minted, classed FINDING
  const g = run([{ ...entry, key: "ai-limit:member:ann:ask:calls:day:2026-10-09", scope: "ask", unit: "calls", source: "own" }]);
  assert.deepEqual(g.items.filter((i) => i.kind === "ai-limit-reached").map((i) => i.class), ["FINDING"]);
});
