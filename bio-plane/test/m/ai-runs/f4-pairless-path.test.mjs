/* ai-runs F4 (CR2-8; interface-shell R20): op=aipathready asked with no pair is the cascade read. For some act of the viewer
   on any account the cascade chooses (her own, a joined project's, the team's: ai-accounts R11's choice, without
   unsealing), the path source is asked for the head pair, and the read answers ready when one pair is ready. It names no
   account. Each account here is made by its owner's own act through the world (ai-accounts' real acts); the path source is
   the world's replaceable stand-in (the plane's source, which no module registers yet). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, PROJ } from "./world.mjs";

const READ = (w, viewer, q = {}) => w.runs.pathReadyRead({ viewer, ...q });
const asking = (w, answer) => {
  const asked = [];
  w.setPath((a) => { asked.push(a.account_id); return { state: typeof answer === "function" ? answer(a) : answer }; });
  return asked;
};

test("F4 (interface-shell R20): a member whose only account is a joined project's, with a ready path, reads ready with no pair named; the answer names no account; control: the same member when the path answers auth_failed reads not ready with that reason", async () => {
  const w = world();
  await w.group("ann", "bob", { noAccount: ["ann", "bob"] });
  w.project(PROJ, "ann", { joined: ["bob"] });
  const pa = await w.projectAccount(PROJ, "ann", { members: ["bob"] });
  const asked = asking(w, "ok");
  const r = await READ(w, "member:bob");
  assert.deepEqual(r, { ok: true, state: "ready", ready: true, reason: "ok", reset_at: null });
  assert.deepEqual(asked, [pa], "only the joined project's account was asked, once");
  assert.equal(JSON.stringify(r).includes(pa), false, "the answer names no account");
  asking(w, "auth_failed");
  assert.deepEqual(await READ(w, "member:bob"), { ok: true, state: "not_ready", ready: false, reason: "auth_failed", reset_at: null });
});

test("F4 (interface-shell R20): a member with the team's account only reads ready; control: with no source registered she reads not ready unregistered", async () => {
  const w = world();
  await w.group("dan", { noAccount: ["dan"] });
  const team = await w.team({ members: ["dan"] });
  const asked = asking(w, "half_open");
  assert.deepEqual(await READ(w, "member:dan"), { ok: true, state: "ready", ready: true, reason: "half_open", reset_at: null });
  assert.deepEqual(asked, [team]);
  const bare = world({ pathReady: null });
  await bare.group("dan", { noAccount: ["dan"] });
  await bare.team({ members: ["dan"] });
  assert.deepEqual(await READ(bare, "member:dan"), { ok: true, state: "not_ready", ready: false, reason: "unregistered", reset_at: null });
});

test("F4: the cascade asks each distinct pair until one is ready — her own account down, a joined project's ready, reads ready; control: every pair down reads the first pair's reason", async () => {
  const w = world();
  await w.group("ann", "bob", { noAccount: ["ann"] });
  w.project(PROJ, "ann", { joined: ["bob"] });
  const pa = await w.projectAccount(PROJ, "ann", { members: ["bob"] });
  const own = w.accountsOf("member:bob")[0];
  const asked = asking(w, (a) => (a.account_id === pa ? "ok" : "open"));
  assert.deepEqual(await READ(w, "member:bob"), { ok: true, state: "ready", ready: true, reason: "ok", reset_at: null });
  assert.deepEqual(asked, [own, pa], "her own first (no project), then the joined project's");
  asking(w, (a) => (a.account_id === pa ? "retired" : "open"));
  assert.deepEqual(await READ(w, "member:bob"), { ok: true, state: "not_ready", ready: false, reason: "open", reset_at: null });
});

test("F4 controls: no account at any level reads not ready no_account and asks nothing; another member's personal subscription is not hers; a project only invited to is not joined; a machine viewer is no_account; one half of a pair is still no_pair", async () => {
  const w = world();
  await w.group("ann", "bob", "cy", { noAccount: ["ann", "bob", "cy"] });
  await w.signin("ann");
  w.project(PROJ, "ann", { invited: ["cy"] });
  await w.projectAccount(PROJ, "ann", { members: ["cy"] });
  const asked = asking(w, "ok");
  const none = { ok: true, state: "not_ready", ready: false, reason: "no_account", reset_at: null };
  assert.deepEqual(await READ(w, "member:bob"), none, "ann's personal subscription serves no act of bob's");
  assert.deepEqual(await READ(w, "member:cy"), none, "an invitation is not a joined project");
  assert.deepEqual(await READ(w, "class:ai/tok-org"), none);
  assert.deepEqual(asked, []);
  assert.deepEqual(await READ(w, "member:bob", { entry_id: "e" }), { ok: true, state: "not_ready", ready: false, reason: "no_pair", reset_at: null });
});
