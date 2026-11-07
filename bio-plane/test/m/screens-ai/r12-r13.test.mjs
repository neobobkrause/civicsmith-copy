/* R12 (words by key) and R13 (re-read after an act; a failed read drawn failed; no act a viewer may not take; Worker-only ops in no
   act list), over every screen this module serves, as the shell serves them. */
import test from "node:test";
import assert from "node:assert/strict";
import { hasWord, word } from "../../../src/setup-words/index.mjs";
import { checkScreens, interfaceScript } from "../../../src/interface-shell/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { storeWorld } from "../store-request/fixtures.mjs";
import { open, aiTeam, holdKey, byOp, said, all, textOf, squash, actOps, SCREENS } from "./kit.mjs";

test("the shell serves the screens: each passes interface-shell's R21 check, and its acts are in the page's script", async () => {
  await storeWorld({ ai: true });   // every owner's declarations registered, as the plane does at start-up
  assert.equal(checkScreens(SCREENS), true);
  const script = interfaceScript(SCREENS);
  for (const s of SCREENS) for (const a of s.acts) assert.ok(script.includes(a.op), `${s.id}'s ${a.op}`);
});

test("R12 every key a screen lists is a word of setup-words, and what a screen draws for a sample equals word(key, vars)", async () => {
  for (const s of SCREENS) for (const k of s.words) assert.ok(hasWord(k), `${s.id}: ${k}`);
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const a = await open(t, "aiproviders", t.founder);
  const on = (await t.founder.read("accountsof", { query: { owner: "group" } })).accounts.filter((x) => x.on);
  const card = all(a.tree, (e) => e.attrs["data-card"] === "stands")[0];
  const expect = word("screen.aiproviders.stands.on", { n: String(on.length), order: on.map((x) => `${x.provider} · ${x.plan}`).join(", ") });
  assert.equal(squash(textOf(card)), squash(expect));
  // a word the screen does not list is never drawn in its place: every heading is one of its words
  for (const h of all(a.tree, (e) => e.tag === "h2")) assert.ok(SCREENS[0].words.some((k) => { try { return squash(word(k)) === squash(textOf(h)); } catch { return false; } }), squash(textOf(h)));
});

test("R13 after aiaccountswitch the accounts are read again, and nothing is drawn as done before the answer", async () => {
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const a = await open(t, "aiproviders", t.founder);
  const id = (await t.founder.read("accountsof", { query: { owner: "group" } })).accounts[0].account_id;
  const before = byOp(a, "accountsof").length;
  const r = await a.press("aiaccountswitch", { data: { account: id, to: "off" } });
  assert.deepEqual(r.sent.filter((x) => x.op === "aiaccountswitch").map((x) => x.body), [{ account_id: id, on: false }]);
  assert.ok(byOp(a, "accountsof").length > before, "re-read");
  assert.equal((await t.founder.read("accountsof", { query: { owner: "group" } })).accounts[0].on, false);
  const row = all(a.tree, (e) => e.tag === "li" && e.attrs["data-account"] === id)[0];
  assert.equal(all(row, (e) => e.attrs["data-on"])[0].attrs["data-on"], "off", "drawn from the owner's answer");
});

test("R13 a read that failed is drawn state.failed, never as none or zero", async () => {
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const a = await open(t, "aiproviders", t.founder, { table: { accountsof: "none", aiusebymember: "none" } });
  assert.ok(all(a.tree, (e) => e.attrs["data-state"] === "failed").length >= 2);
  assert.ok(!a.text.includes(said("screen.aiproviders.stands.none")), "never drawn as no account");
  const m = await open(t, "aimine", t.dev, { table: { aichecks: "none" } });
  assert.ok(all(m.tree, (e) => e.attrs["data-state"] === "failed").length >= 1);
});

test("R13 an act the viewer may not take is not drawn; every act is refused to a machine; the Worker-only ops are in no screen's act list", async () => {
  await storeWorld({ ai: true });
  const worker = ["aicredential", "aigatewayserved", "aicredentialfailed"];
  for (const s of SCREENS) {
    for (const a of s.acts) {
      assert.ok(!worker.includes(a.op), `${s.id}: ${a.op}`);
      assert.deepEqual(OPS[a.op].machineClasses ?? [], [], `${s.id}: ${a.op} is refused to a machine`);
      assert.ok(!(OPS[a.op].classes || []).includes("machine"), `${s.id}: ${a.op}`);
    }
  }
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const d = await open(t, "aiproviders", t.dev);
  assert.deepEqual(actOps(d.tree), [], "a member who does not administer is offered none of the team's acts");
});
