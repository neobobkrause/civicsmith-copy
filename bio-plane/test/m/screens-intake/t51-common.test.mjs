/* screens-intake R43, R44, R46 (T51 fix round): the writing help the registry lists on the three new screens is drawn only while the
 * assistant is reachable (interface-shell R20), under the own-words field it helps. Fix round 10 (K5054): over the REAL store. The assistant is
 * reachable by the administrator's real acts (her password again, the team's account added and switched on: T53 retired `groupkeyset` and
 * `groupkeyswitch`, ai-accounts R35, op-declarations PR 95, so `aiaccountadd` and `aiaccountswitch`, ai-accounts R61) and made unreachable by
 * switching the account off; the knocker's source is the real one (a knock at the public door, pulled into the record by the member).
 * WORLD GAP (as screens-settings' kit): the shell reaches the assistant on `assistantstate` and `aipathready` (interface-shell R20); `aipathready`
 * is read over the agent Worker and no store answers it, so it answers `ready` while the team's account is on by those real acts, else `no_account`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, btn, ok } from "./page.mjs";

test("R43 R44 R46 writing help is drawn on about-knocker, leads and watching only while the assistant is reachable", async () => {
  const t = await members({ mai: ["contribute"] }, { ai: true });
  const admin = await t.world.signIn("admin");
  const knocked = (await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentText: "A tip about the garage.", fileName: "tip.txt", mediaType: "text/plain", knockerSecret: "k".repeat(24) }) } }, null)).json;
  assert.equal(knocked.ok, true);
  await t.mai.act("inboxpull", { query: { id: knocked.knockId } });
  const paths = [`/app/about-knocker/${knocked.sha256}`, "/app/leads", "/app/watching"];
  let on = false;
  const page = (path) => openWorld(path, { world: t.world, as: t.mai, plane: { aipathready: async () => ok({ state: on ? "ready" : "no_account" }) } });
  /* the team's account not yet held: the assistant is not reachable */
  for (const path of paths) assert.equal(btn(await page(path), "writinghelp"), null, `${path}: not reachable`);
  await admin.act("reauth", { body: { password: admin.password } });
  const added = await admin.act("aiaccountadd", { body: { owner: "group", provider: "anthropic", plan: "api-team", means: "sealed", secret: "sk-ant-api03-" + "w".repeat(40) } });
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.equal((await admin.act("aiaccountswitch", { body: { account_id: added.account_id, on: true } })).ok, true);
  on = true;
  for (const path of paths) assert.ok(btn(await page(path), "writinghelp"), `${path}: reachable`);
  assert.equal((await admin.act("aiaccountswitch", { body: { account_id: added.account_id, on: false } })).ok, true);
  on = false;
  for (const path of paths) assert.equal(btn(await page(path), "writinghelp"), null, `${path}: switched off again`);
});
