/* screens-intake R43, R44, R46 (T51 fix round): the writing help the registry lists on the three new screens is drawn only while the
 * assistant is reachable (interface-shell R20), under the own-words field it helps. Fix round 10 (K5054): over the REAL store. The assistant is
 * reachable by the administrator's real acts (her password again, the team's account added and switched on: T53 retired `groupkeyset` and
 * `groupkeyswitch`, ai-accounts R35, op-declarations PR 95, so `aiaccountadd` and `aiaccountswitch`, ai-accounts R61) and made unreachable by
 * switching the account off; the knocker's source is the real one (a knock at the public door, pulled into the record by the member).
 * (`teamAccountOn`, page.mjs, which names the world gap of `aipathready`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, btn, teamAccountOn } from "./page.mjs";

test("R43 R44 R46 writing help is drawn on about-knocker, leads and watching only while the assistant is reachable", async () => {
  const t = await members({ mai: ["contribute"] }, { ai: true });
  const admin = await t.world.signIn("admin");
  const knocked = (await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentText: "A tip about the garage.", fileName: "tip.txt", mediaType: "text/plain", knockerSecret: "k".repeat(24) }) } }, null)).json;
  assert.equal(knocked.ok, true);
  await t.mai.act("inboxpull", { query: { id: knocked.knockId } });
  const paths = [`/app/about-knocker/${knocked.sha256}`, "/app/leads", "/app/watching"];
  const page = (path) => openWorld(path, { world: t.world, as: t.mai });
  /* the team's account not yet held: the assistant is not reachable */
  for (const path of paths) assert.equal(btn(await page(path), "writinghelp"), null, `${path}: not reachable`);
  await teamAccountOn(t.world, admin);
  for (const path of paths) assert.ok(btn(await page(path), "writinghelp"), `${path}: reachable`);
  await teamAccountOn(t.world, admin, { on: false });
  for (const path of paths) assert.equal(btn(await page(path), "writinghelp"), null, `${path}: switched off again`);
});
