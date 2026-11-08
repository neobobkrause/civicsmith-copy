/* R15's drawer of an account's use over time, as built: closed on load (no `aiuseovertime` read), opened once (one read, drawn by
   `screens-settings`' `aiUsageBars`), opened again (no second read); on `aiproviders` to an administrator, on `aimine` for her own account,
   on `aiproject` to an owner and not to a participant. R15's mark stays until the design gives the drawer's heading its own key
   (`docs/requirements-notes/screens-ai.md`); these tests hold the behaviour meanwhile. */
import test from "node:test";
import assert from "node:assert/strict";
import { open, aiTeam, holdKey, byOp, all } from "./kit.mjs";

const bars = (o, id) => all(o.tree, (e) => e.attrs["data-drawer"] === id);

test("R15 (built; its heading key owed by design) an administrator's team account draws a closed drawer, read only once opened, and not read again when opened a second time", async () => {
  const t = await aiTeam();
  await holdKey(t.founder, t.w);
  const id = (await t.founder.read("accountsof", { query: { owner: "group" } })).accounts[0].account_id;
  const a = await open(t, "aiproviders", t.founder);
  assert.equal(byOp(a, "aiuseovertime").length, 0, "nothing read on load");
  assert.equal(bars(a, id).length, 0, "closed");
  await a.tick("aiuse-" + id + "-0", true);
  assert.deepEqual(byOp(a, "aiuseovertime").map((r) => r.query.owner), ["group"], "one read, with the account's owner");
  assert.equal(bars(a, id).length, 1, "drawn open");
  await a.tick("aiuse-" + id + "-0", false);
  assert.equal(bars(a, id).length, 0, "closed again");
  await a.tick("aiuse-" + id + "-0", true);
  assert.equal(byOp(a, "aiuseovertime").length, 1, "a second opening makes no second read");
});

test("R15 (built) control: a participant who does not own the project is drawn no drawer on aiproject, and nothing of its use is read for her", async () => {
  const t = await aiTeam();
  const pid = await t.w.recipes.project(t.founder, "Coliseum lease");
  await t.founder.act("projectinvite", { query: { projectId: pid, handle: "dev" }, body: {} });
  await t.dev.act("projectjoin", { query: { projectId: pid }, body: {} });
  const p = await open(t, "aiproject", t.dev, { subject: pid });
  assert.equal(all(p.tree, (e) => String(e.attrs.id || "").startsWith("aiuse-")).length, 0);
  assert.equal(byOp(p, "aiuseovertime").length, 0);
});
