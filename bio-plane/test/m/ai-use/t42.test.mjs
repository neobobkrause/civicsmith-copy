/* ai-use T42 (T42-17): R2's drop of `ai_ceilings` after the carry (N848, K2592) and R3's `explore` read through
   `ai-accounts.accountUsesOf` (N831, K2620; T48: was credentials'; T53: by the account's id), at the interface, each with a
   negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, standard } from "./fixture.mjs";
import { AiUse } from "../../../src/ai-use/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const CEILINGS = `CREATE TABLE ai_ceilings (holder TEXT PRIMARY KEY, tokens INTEGER, calls INTEGER, set_by TEXT NOT NULL, set_at TEXT NOT NULL)`;
const tables = (w) => w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).map((r) => r.name);

/* ===== R2 (T42; N848) ===== */

test("R2 (T42) once carried, ai_ceilings is dropped in the same migration, so a migrated store holds no table a fresh one lacks; a table it does not own is kept (control)", async () => {
  const fresh = await world();
  const w = await world({ before: (db) => {
    db.exec(CEILINGS);
    db.exec(`INSERT INTO ai_ceilings VALUES ('member:ann', 5000, 20, 'member:ann', '2026-09-01T00:00:00Z'),
             ('copy', 9000, 40, 'member:second', '2026-09-01T00:00:00Z')`);
    db.exec(`CREATE TABLE not_ai_use (x TEXT)`);
  } });
  assert.equal(w.rows(`SELECT * FROM ai_limits`).length, 4, "the ceilings were carried first");
  assert.ok(!tables(w).includes("ai_ceilings"), "dropped after the carry");
  assert.deepEqual(tables(w).filter((t) => t !== "not_ai_use"), tables(fresh), "no table a fresh store lacks");
  assert.ok(tables(w).includes("not_ai_use"), "control: only ai_ceilings is dropped");
});

test("R2 (T42) a store whose carry already ran but which still holds ai_ceilings drops it at its next migration, carrying nothing again; idempotent", async () => {
  const w = await world();
  w.db.exec(CEILINGS);
  w.db.exec(`INSERT INTO ai_ceilings VALUES ('member:ann', 5000, 20, 'member:ann', '2026-09-01T00:00:00Z')`);
  assert.ok(tables(w).includes("ai_ceilings"), "control: the table is held before the next migration");
  w.u.migrate();
  assert.ok(!tables(w).includes("ai_ceilings"));
  assert.equal(w.rows(`SELECT * FROM ai_limits`).length, 0, "the carry already ran: nothing carried again");
  const before = w.snapshot();
  assert.doesNotThrow(() => w.u.migrate());
  assert.equal(w.snapshot(), before, "a second migration changes nothing");
});

/* ===== R3 (T42; N831) ===== */

/* An AiUse over `w`'s store whose `accounts` (ai-accounts) records every call made to it and may answer `accountUsesOf` itself. */
function spied(w, accountUsesOf = null) {
  const calls = [];
  const accounts = new Proxy(w.a, { get(target, name) {
    const v = target[name];
    if (typeof v !== "function") return v;
    return (...args) => {
      calls.push([name, args[0]]);
      return name === "accountUsesOf" && accountUsesOf ? accountUsesOf(...args) : v.apply(target, args);
    };
  } });
  const u = new AiUse(w.ctx, { record: w.rc, membership: w.m, accounts, connections: { citesInto: () => ({ confirmed: [], severed: [] }) }, zone: "UTC" });
  return { u, calls };
}

test("R3 (T42; T53) the owner's explore is read through ai-accounts.accountUsesOf({account_id}) with no viewer, never through accountUses asked as an owner, on every kind of account", async () => {
  const w = await standard();
  const ids = { group: w.acct.group, "project:P": w.acct.P, "member:ann": w.acct.ann };
  w.explore(w.acct.group, "yes", "admin");
  w.explore(w.acct.P, "yes", "ann");
  w.explore(w.acct.ann, "yes", "ann");
  const { u, calls } = spied(w);
  for (const owner of ["group", "project:P", "member:ann"]) {
    calls.length = 0;
    assert.equal(u.useCheck({ owner, member: null, use: "explore", at: AT, account_id: ids[owner] }), null, owner);
    assert.deepEqual(calls.filter(([n]) => n === "accountUsesOf"), [["accountUsesOf", { account_id: ids[owner] }]], owner);
    assert.deepEqual(calls.filter(([n]) => n === "accountUses"), [], `${owner}: never accountUses`);
  }
  /* control: another use than explore reads no explore value at all */
  calls.length = 0;
  assert.equal(u.useCheck({ owner: "group", member: "ann", use: "ask", at: AT }), null);
  assert.deepEqual(calls.filter(([n]) => n === "accountUsesOf"), []);
});

test("R3 (T42; T53) held is read, never uses alone: an account not held, unreadable, holding another value, another owner's, or whose read throws, reads as no (EXPLORE_NOT_ENABLED); held at yes it passes (control)", async () => {
  const w = await standard();
  const g = { account_id: w.acct.group };
  const cases = [
    [{ ok: true, owner: "member:ann", held: true, uses: { explore: "yes" } }, "another owner's account"],
    [{ ok: true, owner: "group", held: false, uses: { explore: "yes" } }, "held false, uses still carrying yes"],
    [{ ok: true, owner: "group", held: null, uses: null, unreadable: true }, "unreadable"],
    [{ ok: true, owner: "group", held: true, uses: { explore: "maybe" } }, "another value"],
    [{ ok: true, owner: "group", held: true, uses: null }, "no uses"],
    [() => { throw new Error("down"); }, "throws"],
  ];
  for (const [answer, why] of cases) {
    const { u } = spied(w, typeof answer === "function" ? answer : () => answer);
    assert.equal(u.useCheck({ owner: "group", use: "explore", at: AT, ...g }).code, "EXPLORE_NOT_ENABLED", why);
    assert.equal(u.exploreAllowed({ owner: "group", question: "INQ-1", at: AT, ...g }).code, "EXPLORE_NOT_ENABLED", `R6: ${why}`);
    assert.equal(u.exploreAsk({ owner: "group", at: AT, what: "INQ-1", ...g }).code, "EXPLORE_NOT_ENABLED", `R9: ${why}`);
  }
  for (const v of ["yes", "ask"]) {
    const { u } = spied(w, () => ({ ok: true, owner: "group", held: true, uses: { explore: v } }));
    assert.equal(u.useCheck({ owner: "group", use: "explore", at: AT, ...g }), null, `control: held at ${v}`);
  }
});

test("R3 (T42; T53) on the real ai-accounts: the team's account at yes whose credential failed (held false) reads as no; a revoked member's account reads as no; held, each passes (control)", async () => {
  const w = await (await world()).group("ann");
  const team = await w.account("group", "admin");
  assert.equal(w.explore(team, "yes", "admin").ok, true);
  assert.equal(w.u.useCheck({ owner: "group", use: "explore", at: AT, account_id: team }), null, "control: held, at yes");
  w.a.accountCredentialFailed({ account_id: team, why: "unresolved" });
  const of = w.a.accountUsesOf({ account_id: team });
  assert.deepEqual([of.held, of.uses.explore], [false, "yes"], "the K2620 shape: not held, its uses still carrying yes");
  assert.equal(w.u.useCheck({ owner: "group", use: "explore", at: AT, account_id: team }).code, "EXPLORE_NOT_ENABLED", "not held");

  const anns = await w.account("member:ann", "ann");
  w.explore(anns, "yes", "ann");
  assert.equal(w.u.useCheck({ owner: "member:ann", use: "explore", at: AT, account_id: anns }), null, "control: ann's own account, at yes");
  assert.equal(w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" }).ok, true);
  assert.equal(w.u.useCheck({ owner: "member:ann", use: "explore", at: AT, account_id: anns }).code, "EXPLORE_NOT_ENABLED", "revoked");
});
