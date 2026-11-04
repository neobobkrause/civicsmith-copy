/* question-explorer over four provider notices that change nothing it calls, each confirmed on the provider's real code:
   ai-use PR 105 (R6 `exploreAllowed`, R9 `exploreAsk`, R10 `estimate`, now on the account's `account_id`), ai-accounts
   PR 124 (the seam: the old `accountUsesOf({owner})` form this module reads, over the T53 accounts), ai-accounts PR 188
   (F2, the door arms' member owner, which this module never reaches) and basis-versions PR 177 (R60, a leg's grade in
   `basisVersions`; this module reads only `currentOf`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { world, Q, PROJ, CAP } from "./fixture.mjs";
import { world as bvWorld, block, version, V } from "../basis-versions/fixture.mjs";
import { PLANS } from "../ai-accounts/catalogue.mjs";
import { EXPLORE_PRINCIPAL } from "../../../src/question-explorer/index.mjs";

const SRC = new URL("../../../src/question-explorer/", import.meta.url);
const source = () => readdirSync(SRC).filter((f) => f.endsWith(".mjs")).map((f) => readFileSync(new URL(f, SRC), "utf8")).join("\n");

test("notice ai-use:105 (R1, R3, R12): ai-use's real exploreAllowed and estimate are asked on the account ai-accounts names for the owner, and the account's explore switch, set on that account_id by its owner's T53 act, decides: on, a run opens; off, ai-use refuses and nothing opens", async () => {
  const w = await world().standard();
  const head = w.aiAccounts.accountUsesOf({ owner: "group" });
  assert.equal(typeof head.account_id, "string");
  const set = (on) => {
    const r = w.aiAccounts.accountUsesSet({ account_id: head.account_id, switch: "explore", on, by: "member:dana" });
    assert.equal(r.ok, true, JSON.stringify(r));
  };
  set("yes");
  const t = await w.p.exploreTick(w.clock.now);
  assert.deepEqual(t.opened.map((o) => o.owner), ["group"]);
  const asked = w.calledAs("exploreAllowed").filter((a) => a.owner === "group");
  assert.ok(asked.length && asked.every((a) => a.account_id === head.account_id), JSON.stringify(asked));
  assert.equal(w.calledAs("estimate")[0].owner, "group");
  /* Off on the same account, the next day: ai-use refuses, nothing opens. */
  w.clock.now = "2026-10-11T09:00:00Z";
  set("no");
  const before = w.calledAs("open").length;
  assert.equal((await w.p.exploreTick(w.clock.now)).opened.length, 0);
  assert.equal(w.calledAs("open").length, before);
});

test("notice ai-accounts:124 (R3): the owner's account is read through ai-accounts' in-plane accountUsesOf({owner}), the seam's old form over the T53 accounts: a member's T53 account, set by her own act, is answered with its account_id and uses, never as unreadable", async () => {
  const w = await world().standard();
  const own = await w.aiAccounts.accountSet({ owner: "member:alice", provider: PLANS.provider, plan: PLANS.memberApi,
                                              means: "sealed", secret: "sk-ant-alice-own-key-0123456789", by: "alice" });
  assert.equal(own.ok, true, JSON.stringify(own));
  const u = w.aiAccounts.accountUsesOf({ owner: "member:alice" });
  assert.deepEqual([u.ok, u.account_id, u.owner, u.unreadable], [true, own.account_id, "member:alice", undefined]);
  assert.equal(typeof u.uses, "object");
  assert.equal(u.uses.explore, "no", "explore off by default (ai-accounts R14)");
  /* The tick reads the same answer and asks ai-use on that account. */
  await w.p.exploreTick(w.clock.now);
  const asked = w.calledAs("exploreAllowed").filter((a) => a.owner === "member:alice");
  assert.ok(asked.every((a) => a.account_id === own.account_id), JSON.stringify(asked));
});

test("notice ai-accounts:188 (R1, R3): this module reaches ai-accounts in-plane only, never through its door arms, and spells a member owner member:<id> once, so F2's door fix changes nothing here", async () => {
  assert.equal(/aiAccountsOps|aiownadd|aimineuse|aimycheckset|aipersonalchoose/.test(source()), false);
  const w = await world().standard();
  await w.p.exploreTick(w.clock.now);
  const owners = w.calledAs("exploreAllowed").map((a) => a.owner);
  assert.ok(owners.includes("member:alice"), JSON.stringify(owners));
  assert.equal(owners.some((o) => o.startsWith("member:member:")), false);
});

test("notice basis-versions:177 (R4): a find's live basis records each drawing project's current version as basis-versions' real currentOf answers it (its `version`), unchanged by PR 177, which grades legs in basisVersions alone", async () => {
  /* basis-versions' own world: a question with an accepted reading, a project drawing on it made current on that reading. */
  const b = bvWorld();
  b.doc("INFO-2026-0001-a");
  b.member("alice");
  const BQ = "INQ-2026-0001-q";
  const made = b.inquiry(BQ, block(version("opening account", ["INFO-2026-0001-a"],
    { state: "accepted", state_by: "member:alice", state_at: "2026-09-27T00:00:00Z", state_reason: "" })));
  assert.equal(made.ok, true, JSON.stringify(made).slice(0, 300));
  const A = b.project("Oversight", "alice", [BQ]);
  const cur = b.bv.versionCurrent({ target: BQ, version: "opening account", project: A, author: "member:alice",
                                    viewer: V("alice"), identity: "member:alice" });
  assert.equal(cur.ok, true, JSON.stringify(cur).slice(0, 300));
  const seen = [];
  /* The explorer's project and question moved to that world's; its viewer passed as it sent it. */
  const basisVersions = { currentOf: (p, q, viewer) => { seen.push({ p, q, viewer }); return b.bv.currentOf(A, BQ, viewer); } };
  const w = await world({ basisVersions }).standard();
  w.gate1();
  w.project(PROJ, ["alice"], { owners: ["alice"], setting: "discoverable" });
  w.draw(Q, PROJ);
  const o = await w.openRun("group");
  const f = w.p.find({ run: o.run, kind: "capture", ref: CAP, bearing: "supports", how: "the minutes", caller: EXPLORE_PRINCIPAL });
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  assert.deepEqual(seen.at(-1), { p: PROJ, q: Q, viewer: EXPLORE_PRINCIPAL });
  assert.deepEqual(f.against.currents, [{ project: PROJ, current: "opening account" }]);
});
