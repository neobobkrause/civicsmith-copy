/* store-request R15–R20: the world's door, its sign-ins, the shell's boot and the recipes, over the real store (store-assembly's
   world); and the published `storeWorld()` fixture. Ids, hashes and times are read from the acts' answers, never from a literal. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld, doorOf, bootOf, WORLD_UNREACHED, WORLD_TOKENS, WORLD_GROUP } from "./fixtures.mjs";
import { worldAnswers, unreachedOf } from "./door.mjs";
import { innerRequest } from "../../../src/store-request/index.mjs";
import { OPS, OP_ALIASES } from "../../../src/op-declarations/index.mjs";
import { createSha256 } from "../../../src/record-grammar/index.mjs";

const resultOf = (a) => (a.json && a.json.result !== undefined ? a.json.result : a.json);
const get = (op, query = {}) => ({ url: `/api/?${new URLSearchParams({ op, ...query })}` });
const post = (op, body, query = {}) => ({ url: `/api/?${new URLSearchParams({ op, ...query })}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } });

test("storeWorld (fixture): the real store with its producing team recorded by the real act, the door, sign-ins, boot and recipes; two worlds share nothing", async () => {
  const a = await storeWorld(), b = await storeWorld();
  for (const k of ["door", "signIn", "plane", "boot", "session", "admitted", "store", "ctx", "sql", "tick"]) assert.equal(typeof a[k] === "function" || typeof a[k] === "object", true, k);
  for (const k of ["hold", "project", "trail", "profiles"]) assert.equal(typeof a.recipes[k], "function", k);
  const group = a.sql.exec("SELECT slug, source FROM instance_group WHERE id=1").toArray()[0];
  assert.equal(group.slug, WORLD_GROUP);
  const fa = await a.signIn("admin");
  const p = await a.recipes.project(fa, "Only in the first world");
  assert.equal(a.sql.exec("SELECT COUNT(*) AS n FROM bundles WHERE bundle_id=?", p).toArray()[0].n, 1);
  assert.equal(b.sql.exec("SELECT COUNT(*) AS n FROM bundles WHERE bundle_id=?", p).toArray()[0].n, 0);
  const t0 = performance.now(); await storeWorld(); const ms = performance.now() - t0;
  console.log(`store-request storeWorld: copy with the group recorded ${Math.round(ms)} ms (base ${a.timing.base} ms, store-assembly copy ${a.timing.copy} ms)`);
});

test("R16: real sign-ins: the founder by login; a member by memberadd, enroll and login; admin and capabilities by the real acts; a refused act throws naming the op", async () => {
  const w = await storeWorld();
  const founder = await w.signIn("admin");
  assert.equal(founder.member, "admin");
  const fw = resultOf(await w.door(get("whoami"), founder));
  assert.equal(fw.session, true); assert.equal(fw.member, "admin"); assert.equal(fw.rootOfTrust, true);
  assert.deepEqual(Object.keys(founder.session).sort(), ["d", "e", "t", "w"]);
  assert.equal(founder.session.t, founder.token); assert.equal(founder.session.d, "own");
  const ruth = await w.signIn("ruth");
  const rw = resultOf(await w.door(get("whoami"), ruth));
  assert.equal(rw.member, "ruth"); assert.equal(rw.administer, false);
  const ada = await w.signIn("ada", { admin: true });
  assert.equal(resultOf(await w.door(get("whoami"), ada)).administer, true);
  const cy = await w.signIn("cy", { capabilities: ["contribute", "create_projects"] });
  assert.deepEqual(resultOf(await w.door(get("whoami"), cy)).capabilities, ["contribute", "create_projects"]);
  const again = await w.signIn("ruth");
  assert.notEqual(again.token, ruth.token, "a second sign-in is a second real session");
  assert.equal((await ruth.read("whoami")).member, "ruth");
  await assert.rejects(() => ruth.act("memberadd", { body: { memberId: "zed", cover: "c" } }), /memberadd was refused/);
  const unclaimed = await storeWorld({ claimed: false });
  await assert.rejects(() => unclaimed.signIn("admin"), /claimed world/);
});

test("R17: the door's families: unknown op, admission, a store route per stamp kind, the sign-in door, a public read, attest, the module arms, the re-made relays, and WORLD_NO_DOOR_ARM", async () => {
  const w = await storeWorld();
  const door = doorOf(w);
  const f = await w.signIn("admin");
  /* (1) */
  const unknown = await door(get("nosuchop"), f);
  assert.equal(unknown.status, 400); assert.equal(unknown.json.reason, "UNKNOWN_OP"); assert.equal(unknown.json.error, "unknown op");
  /* (2) an unknown session is refused as admission refuses it; an ended one too */
  const stranger = await door({ url: "/api/?op=search", init: { headers: { authorization: `Bearer ${"a".repeat(64)}` } } });
  assert.equal(stranger.status, 401); assert.equal(stranger.json.reason, "NOT_AUTHENTICATED");
  const gone = await w.signIn("gone");
  await gone.act("signout");
  assert.equal((await door(get("search", { q: "x" }), gone)).status, 401);
  /* (3), (4) a store route through innerRequest, enveloped */
  const s = await door(get("search", { q: "water" }), f);
  assert.equal(s.status, 200); assert.equal(s.json.ok, true); assert.equal(s.json.store, "bio"); assert.equal(s.json.tokenClass, "admin");
  /* (5) the sign-in door, a public read, attest, arms, relays */
  const signin = await door(post("subscriptionsignin", { step: "state" }), f);
  assert.equal(signin.json.step, "state"); assert.equal(signin.json.member, "admin");
  const notices = await door(get("noticespublic"));
  assert.equal(notices.json.read, "noticespublic"); assert.equal(notices.json.module, "network-notices");
  const attest = await door(post("attest", {}), f);
  assert.equal(attest.json.reason, "BAD_SHA", "attestation's own refusal, from its arm");
  const queue = await door(get("queue"), f);
  assert.equal(resultOf(queue).member, "admin");
  const aff = await door(get("affordances"), f);
  assert.ok(Array.isArray(resultOf(aff).catalog));
  const boot = await door(get("bootstrap"));
  assert.equal(boot.json.claimed, true);
  const look = await door(post("invitelook", { invite: "none" }));
  assert.notEqual(look.status, 501);
  /* the four ops the door shapes itself are reached through this module's functions (R26–R28), never refused as unreached */
  for (const op of ["textcheck", "readtranslate", "airundispatch", "agentpack"]) assert.notEqual((await door(post(op, { text: "t", subject: "s", run: "r" }), f)).status, 501, op);
  /* control: a stamp in the address reaches the store without it */
  const sent = [];
  const send = w.send;
  w.send = (r) => { sent.push(r); return send(r); };
  await door(get("search", { q: "x", viewer: "admin", identity: "member:ruth", author: "ruth" }), await w.signIn("ruth"));
  const q = new URL(sent.at(-1).url).searchParams;
  assert.equal(q.get("viewer"), "member:ruth"); assert.equal(q.has("identity"), false); assert.equal(q.has("author"), false);
  w.send = send;
});

test("R15: the world's door makes every store request by innerRequest and by no rule of its own: one op of each row, for each kind of caller", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin"), m = await w.signIn("mia", { capabilities: ["contribute", "create_projects"] });
  const minted = await w.door(post("aicredentialmint", { tokenId: "bot1", principalKind: "organisation", writes: [] }), f);
  const ai = { token: minted.json.result.token };
  const sent = [];
  const send = w.send;
  w.send = (r) => { sent.push(r); return send(r); };
  const door = doorOf(w);
  let compared = 0;
  const cases = [["search", { q: "x", viewer: "admin" }, null], ["list", {}, null], ["memberlist", { administer: "1" }, null], ["stats", {}, null],
    ["projectparticipants", { project: "P" }, null], ["resolve", {}, { resolvedBy: "x", entity: "E" }], ["thread", {}, { threadedBy: "x" }],
    ["biasadopt", { author: "x" }, {}], ["leadlist", { identity: "x" }, null], ["queuemute", { member: "x" }, {}], ["promote", { project: "P" },
    { base: "B", files: [], author: "x", actorIdentity: "x" }], ["allocid", { prefix: "INFO", year: "2026" }, null]];
  for (const [who, as] of [["founder", f], ["member", m], ["ai", ai]]) for (const [op, query, body] of cases) {
    sent.length = 0;
    const req = body === null ? get(op, query) : post(op, body, query);
    await door(req, as);
    if (!sent.length) continue;   /* refused before the store (admission), so no request was made */
    const caller = await w.admitted(as.token, op).catch(() => null);
    if (!caller) continue;
    const url = new URL(req.url, "https://group.example");
    const expected = innerRequest({ op, url, method: body === null ? "GET" : "POST", body: body === null ? undefined : JSON.stringify(body), caller,
                                    origin: url.origin, length: body === null ? null : new TextEncoder().encode(JSON.stringify(body)).length });
    compared++;
    assert.equal(sent[0].url, expected.url, `${who} ${op}`);
    assert.equal(sent[0].body ?? undefined, expected.body, `${who} ${op} body`);
    assert.deepEqual(sent[0].headers, expected.headers, `${who} ${op} headers`);
  }
  w.send = send;
  assert.ok(compared >= 20, `compared ${compared}`);
});

test("R18: bootOf answers the door bound to the member and the session record interface-shell's boot takes", async () => {
  const w = await storeWorld();
  const ruth = await w.signIn("ruth");
  const b = bootOf(w, ruth);
  assert.deepEqual(Object.keys(b).sort(), ["door", "session"]);
  assert.deepEqual(b.session, ruth.session);
  const who = await b.door({ url: "/api/?op=whoami", op: "whoami", query: { op: "whoami" }, headers: {}, init: {}, method: "GET" });
  assert.equal(resultOf(who).member, "ruth");
  assert.deepEqual(w.boot(ruth).session, ruth.session);
  assert.equal(bootOf(w, null).session, null);
});

test("R19: the recipes perform real acts and answer what the acts answered", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const p = await w.recipes.project(f, "Stormwater");
  const stage = resultOf(await w.door(get("projectstage", { project: p }), f));
  assert.notEqual(stage.ok, false, JSON.stringify(stage).slice(0, 200));
  const text = "the council met on a Tuesday";
  const h = await w.recipes.hold(f, "Minutes", text, p);
  assert.equal(h.sha, createSha256().update(new TextEncoder().encode(text)).hex());
  assert.equal(w.sql.exec("SELECT project FROM bundles WHERE bundle_id=?", h.bundle).toArray()[0].project, p);
  const t = await w.recipes.trail(f, p);
  assert.equal(typeof t, "string");
  assert.equal(w.sql.exec("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").toArray()[0].n > 0, true);
  const pr = await w.recipes.profiles(f, []);
  assert.notEqual(pr.ok, false);
  const ruth = await w.signIn("ruth");
  await assert.rejects(() => w.recipes.project(ruth, "Not hers to start"), /promote was refused/);
});

test("R20: every declared op is a key of the route map or answered by the world's door; the unreachable set is closed, each with its cause", async () => {
  const w = await storeWorld();
  assert.deepEqual(unreachedOf(w, Object.keys(OPS)), []);
  const routes = new Set(Object.keys(w.store.routes(new URL("http://x/"), null)));
  for (const [op, cause] of Object.entries(WORLD_UNREACHED)) {
    assert.ok(Object.hasOwn(OPS, op), `${op} is declared`);
    assert.equal(routes.has(op) || worldAnswers(op), false, `${op} is listed unreachable but is answered`);
    assert.ok(cause.length > 20);
  }
  assert.ok(worldAnswers("selftest") && worldAnswers("runtime") && worldAnswers("attest"));
  const f = await w.signIn("admin");
  for (const op of ["selftest", "runtime"]) assert.notEqual((await w.door(get(op), f)).status, 501, op);
  // fixtures-generic: WORLD_NO_DOOR_ARM (store-request R17, R20)
  for (const op of Object.keys(WORLD_UNREACHED)) assert.equal((await w.door(get(op), f)).json.reason, "WORLD_NO_DOOR_ARM", op);
  /* control: an op declared and answered nowhere is named */
  assert.deepEqual(unreachedOf(w, [...Object.keys(OPS), "worldprobeop"]), ["worldprobeop"]);
});

test("R17: the binding classes the world's env holds are admitted as the Worker admits them", async () => {
  const w = await storeWorld();
  const probe = await w.door({ url: "/api/?op=whoami", init: { headers: { authorization: `Bearer ${WORLD_TOKENS.PROBE_TOKEN}` } } });
  assert.equal(resultOf(probe).tokenClass, "probe");
});

test("storeWorld (fixture), R17: the world binds the published plane as plane's Worker does, so R70's case-file sweep builds an edition's case file in a world", async () => {
  const { memoryBucket } = await import("../store-assembly/world.mjs");
  const { seedEdition, completeEdition, stateOf, NOW } = await import("../store-assembly/g54-seed.mjs");
  const w = await storeWorld({ now: Date.parse(NOW), env: { PUBLISHED: memoryBucket(), INSTANCE_NAME: "town" } });
  const s = await seedEdition(w.ctx, "CASE-2026-4780");
  await completeEdition(w.ctx, w.env, s);
  assert.equal(stateOf(w.ctx, s).manifest_sha ?? null, null, "complete, no case file");
  const swept = (await w.tick(10 * 60_000)).casefilesweep;
  assert.equal(swept.finished, 1);
  assert.match(stateOf(w.ctx, s).manifest_sha, /^[0-9a-f]{64}$/);
  assert.equal((await w.door(get("publishedbytes", { sha256: "a".repeat(64) }))).json.reason, "NO_PUBLISHED_PART");
});
