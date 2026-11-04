/* interface-shell R3, R4, R24, R32: the session record this module keeps in localStorage, its token only in the
   Authorization header, sign-in handed over, sign out, every tab told, and nothing kept of who opened what. */
import { frameAnswers } from "./frame-answers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, refused, silent, MEMBER, settle, tabs, STORE_KEY } from "./harness.mjs";
import { ALL, FRONT, ENTRY } from "./screens.fixture.mjs";
import { SESSION_STORE_KEY, SHELL_OPS } from "../../../src/interface-shell/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const SENTINEL = "SENTINEL-tok-7f3a";
const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "w", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });
const HELD = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }, { id: "h2", title: "Budget", at: "2026-10-02" }] });
const SCREENS = [...ALL, FRONT];
const authorized = (p) => p.requests.filter((r) => r.headers.Authorization !== undefined);
const screenOf = (p) => p.root().querySelector("#cs-main").getAttribute("data-screen");
const stateOf = (p) => (p.doc.getElementById("state") || { textContent: "" }).textContent;

test("R32 the session record is this module's: SESSION_STORE_KEY in localStorage as {t, e, d, w}; a live one is read, by that key", async () => {
  assert.equal(SESSION_STORE_KEY, STORE_KEY);
  const p = await boot({ screens: SCREENS, session: { t: "x", e: Date.now() + 60_000, d: "own", w: "mai" } });
  assert.equal(p.requests.find((r) => r.op === "whoami").headers.Authorization, "Bearer x");
  assert.equal(screenOf(p), "home");
  /* control: a record in sessionStorage alone (setup-page's old place) is no session */
  const q = await boot({ screens: SCREENS, session: null });
  q.store.set(STORE_KEY, JSON.stringify({ t: "x", e: 0, d: "own", w: "mai" }));
  const r = await boot({ screens: SCREENS, session: null });
  assert.equal(authorized(r).length, 0);
  assert.equal(screenOf(r), "front");
});

test("R3 R32 no live record, or an expired one: /app/<working screen> draws front in its place, sending no whoami and no Authorization header, the path kept to return to in sessionStorage", async () => {
  for (const session of [null, { t: "x", e: Date.now() - 1000, d: "own", w: "mai" }, { t: "", e: 0 }]) {
    const p = await boot({ screens: SCREENS, session, path: "/app/held" });
    assert.equal(screenOf(p), "front", JSON.stringify(session));
    assert.equal(p.root().querySelector(".cs-rail"), null, "front's frame, not the working frame");
    assert.equal(authorized(p).length, 0);
    assert.equal(p.byOp("whoami").length, 0);
    assert.equal(p.location.pathname, "/app/held", "the address stays");
    assert.equal(p.store.get(STORE_KEY + ":return"), "/app/held");
    assert.equal(stateOf(p), "fx t state none");
  }
});

test("R32 / with a live record opens Home (the address becomes /app); / without one draws front, keeping no path", async () => {
  const p = await boot({ screens: SCREENS, path: "/" });
  assert.equal(p.location.pathname, "/app");
  assert.equal(screenOf(p), "home");
  const q = await boot({ screens: SCREENS, path: "/", session: null });
  assert.equal(screenOf(q), "front");
  assert.equal(q.location.pathname, "/");
  assert.equal(q.store.has(STORE_KEY + ":return"), false);
});

test("R3 a whoami answer without a member session (session false or member empty), or a refusal, is treated as none: the record cleared and front drawn; no answer is not none (R35)", async () => {
  for (const whoami of [ok({ ...MEMBER, session: false }), ok({ ...MEMBER, member: "" }), ok({ ...MEMBER, member: null }), refused("NOT_AUTHENTICATED")]) {
    const p = await boot({ screens: SCREENS, plane: { whoami } });
    assert.equal(screenOf(p), "front");
    assert.equal(p.local.has(STORE_KEY), false);
  }
  const q = await boot({ screens: SCREENS, plane: { whoami: silent } });
  assert.equal(q.local.has(STORE_KEY), true, "kept: the plane did not answer");
  assert.ok(q.root().querySelector('[data-unavailable="unreachable"]'));
});

test("R32 a 401 answer to any request clears the record and draws front's ended state, keeping the path to return to in sessionStorage, never the token", async () => {
  for (const op of ["whoami", "interfacewords", "heldcaptures", "groupidentity"]) {
    const p = await boot({ screens: SCREENS, path: "/app/held", plane: { [op]: refused("MEMBER_TOKEN_RETIRED", null, 401), heldcaptures: op === "heldcaptures" ? refused("X", null, 401) : HELD } });
    assert.equal(p.local.has(STORE_KEY), false, op);
    assert.equal(screenOf(p), "front", op);
    assert.equal(stateOf(p), "fx t state ended", op);
    assert.equal(p.store.get(STORE_KEY + ":return"), "/app/held", op);
    for (const v of p.store.values()) assert.ok(!v.includes("tok-1"), "no token in sessionStorage");
  }
  /* control: a 403 refusal ends nothing */
  const q = await boot({ screens: SCREENS, path: "/app/held", plane: { heldcaptures: refused("NOT_ALLOWED", null, 403) } });
  assert.equal(q.local.has(STORE_KEY), true);
  assert.equal(screenOf(q), "held");
});

test("R32 R46 front hands a sign-in over: login's answer written as the record {t, e, d, w}, whoami sent, and the page kept to return to opened", async () => {
  const p = await boot({ screens: SCREENS, session: null, path: "/app/held", plane: { login: ok({ token: "tok-new", expires: Date.now() + 3600_000 }), heldcaptures: HELD } });
  assert.equal(screenOf(p), "front");
  p.doc.getElementById("f-handle").value = "mai";
  p.doc.getElementById("f-pass").value = "a-password-123";
  await p.click('button[data-act="login"]');
  const login = p.byOp("login")[0];
  assert.equal(login.headers.Authorization, undefined, "a public act, no header");
  assert.deepEqual(login.body, { handle: "mai", password: "a-password-123", device: "own" });
  const rec = JSON.parse(p.local.get(STORE_KEY));
  assert.deepEqual(Object.keys(rec).sort(), ["d", "e", "t", "w"]);
  assert.deepEqual([rec.t, rec.d, rec.w], ["tok-new", "own", "mai"]);
  assert.equal(p.byOp("whoami").at(-1).headers.Authorization, "Bearer tok-new");
  assert.equal(p.location.pathname, "/app/held");
  assert.equal(screenOf(p), "held");
  assert.equal(p.store.has(STORE_KEY + ":return"), false, "the kept path is spent");
  /* control: with nothing kept, Home */
  const q = await boot({ screens: SCREENS, session: null, path: "/", plane: { login: ok({ token: "tok-new", expires: 0 }) } });
  q.doc.getElementById("f-handle").value = "mai";
  await q.click('button[data-act="login"]');
  assert.equal(q.location.pathname, "/app");
  assert.equal(screenOf(q), "home");
});

test("R32 every tab sees a sign-in, a lock, a sign-out and an end through the storage event (two tabs over one localStorage)", async () => {
  const t = tabs();
  const a = await boot({ screens: SCREENS, tabs: t, path: "/app/held", plane: { heldcaptures: HELD } });
  const b = await boot({ screens: SCREENS, tabs: t, session: null, path: "/app/members" });
  assert.equal(screenOf(b), "members", "the record is shared: b is signed in too");
  /* a sign-out in a */
  await a.click('[data-shell="menu"]');
  await a.click('[data-shell="signout"]');
  await b.settle();
  assert.equal(screenOf(b), "front");
  assert.equal(stateOf(b), "fx t state signedout");
  /* a sign-in in b reaches a */
  const plane = { login: ok({ token: "tok-2", expires: 0 }) };
  const c = await boot({ screens: SCREENS, tabs: t, session: null, path: "/app/held", plane });
  c.doc.getElementById("f-handle").value = "mai";
  await c.click('button[data-act="login"]');
  await a.settle(); await b.settle();
  assert.equal(screenOf(b), "members", "b, signed in again, opens the page it was on");
  /* a lock, then an unlock, in c */
  await c.clock.tick(30 * 60 * 1000);
  await b.settle();
  assert.ok(b.root().querySelector('[data-overlay="lock"]'), "b locked with c");
  c.doc.getElementById("cs-lock-pw").value = "pw";
  await c.click('[data-shell="unlock"]');
  await b.settle();
  assert.equal(b.root().querySelector('[data-overlay="lock"]'), null, "b unlocked with c");
  /* control: no tab's request carries another's token after the change, and the token is in no address, body or storage but the record */
  for (const p of [a, b, c]) for (const r of p.requests) {
    assert.ok(!r.url.includes("tok-"), r.url);
    assert.ok(!JSON.stringify(r.body ?? "").includes("tok-"), r.op);
  }
  for (const [k, v] of t.local) if (k !== STORE_KEY) assert.ok(!String(v).includes("tok-"), k);
  for (const p of [a, b, c]) for (const v of p.store.values()) assert.ok(!String(v).includes("tok-"));
});

test("R3 driving every screen and act with a sentinel token, the token is in each request's Authorization header and nowhere else: no address, query, body, link drawn, history entry or storage but the record", async () => {
  const pushed = [];
  for (const path of ["/app", "/app/held", "/app/document/c1", "/app/members", "/app/settings", "/app/people", "/app/nowhere"]) {
    const p = await boot({ screens: SCREENS, path, session: { t: SENTINEL, e: 0, d: "own", w: "mai" },
      plane: { image: IMAGE, heldcaptures: HELD, whoami: ok({ ...MEMBER, administer: true }), assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
    const ph = p.win.history.pushState;
    p.win.history.pushState = (s, t, u) => { pushed.push(u); ph(s, t, u); };
    for (const b of p.root().querySelectorAll("button[data-act]")) { await p.click(b); for (const c of p.root().querySelectorAll('[data-shell="confirm"], [data-shell="reason-send"]')) { const ta = p.root().querySelector("textarea"); if (ta) ta.value = "because"; await p.click(c); } }
    for (const a of p.root().querySelectorAll("a[data-nav]").slice(0, 4)) await p.click(a);
    for (const r of p.requests) {
      if (r.op === "bootstrap") { assert.equal(r.headers.Authorization, "Bearer " + SENTINEL, "R71: the bootstrap carries the page's session"); assert.ok(!r.url.includes(SENTINEL)); continue; }
      assert.equal(r.headers.Authorization, "Bearer " + SENTINEL, r.op);
      assert.ok(!r.url.includes(SENTINEL), r.url);
      assert.ok(!JSON.stringify(r.body ?? "").includes(SENTINEL), r.op);
    }
    /* R92: the version poll is public and carries no session at all */
    for (const r of p.polls) { assert.equal(r.headers.Authorization, undefined, "the poll carries no session token"); assert.ok(!r.url.includes(SENTINEL)); }
    assert.ok(!p.root().innerHTML.includes(SENTINEL));
    assert.ok(!pushed.some((u) => u.includes(SENTINEL)));
    for (const [k, v] of p.local) if (k !== STORE_KEY) assert.ok(!String(v).includes(SENTINEL), k);
    for (const v of p.store.values()) assert.ok(!String(v).includes(SENTINEL));
    assert.ok(p.requests.length > 5);
  }
});

test("R3 (K2998) cs.call with a bearer sends that credential alone, for that request only; without one, the session", async () => {
  const screen = { id: "assistant", reads: () => ({}), acts: [{ op: "airunopen", async send(view, el, cs) { await cs.call("airun", { query: { run: "r1" }, bearer: "AI-CRED-1" }); await cs.call("airunlog", {}); return null; } }],
    render: (cs) => cs.act("airunopen") };
  const p = await boot({ screens: [screen], plane: { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
  await p.click('[data-shell="dock"]');
  await p.click('button[data-act="airunopen"]');
  const [run] = p.byOp("airun"), [log] = p.byOp("airunlog");
  assert.equal(run.headers.Authorization, "Bearer AI-CRED-1");
  assert.ok(!JSON.stringify(run).includes("tok-1"), "no session token on it");
  assert.equal(log.headers.Authorization, "Bearer tok-1");
  /* a 401 to the bearer's own request ends no session */
  const q = await boot({ screens: [screen], plane: { airun: refused("AI_CREDENTIAL_EXPIRED", null, 401), assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
  await q.click('[data-shell="dock"]');
  await q.click('button[data-act="airunopen"]');
  assert.equal(q.local.has(STORE_KEY), true);
});

test("R4 the member's initial opens a menu with Sign out: it sends op=signout, then clears the record and draws front's signed-out state, whatever the answer", async () => {
  for (const signout of [ok({ ok: true }), refused("NO"), silent]) {
    const p = await boot({ screens: SCREENS, plane: { signout } });
    const menu = p.root().querySelector('[data-shell="menu"]');
    assert.equal(menu.textContent.trim().startsWith("M"), true, "the initial");
    assert.equal(p.root().querySelector("#cs-menu").hidden, true);
    await p.click(menu);
    assert.equal(p.root().querySelector("#cs-menu").hidden, false);
    const so = p.root().querySelector('[data-shell="signout"]');
    assert.equal(so.textContent, word("shell.signout"));
    await p.click(so);
    assert.equal(p.byOp("signout").length, 1);
    assert.equal(p.byOp("signout")[0].headers.Authorization, "Bearer tok-1");
    assert.equal(p.local.has(STORE_KEY), false);
    assert.equal(screenOf(p), "front");
    assert.equal(stateOf(p), "fx t state signedout");
  }
  /* control: with no front registered, the shell's own page says the state */
  const q = await boot({ screens: ALL });
  await q.click('[data-shell="menu"]');
  await q.click('[data-shell="signout"]');
  assert.equal(q.root().querySelector("#cs-main").getAttribute("data-screen"), null);
  assert.ok(q.root().querySelector("#cs-main").textContent.includes(word("session.signedout")));
});

const FRAME_ANSWERS = await frameAnswers();
test("R24 nothing the shell does records who opened what: no storage holds a read or a screen visited, and no request but the screens' own reads and acts and the frame's", async () => {
  const p = await boot({ screens: SCREENS, path: "/app/held", plane: { ...FRAME_ANSWERS, heldcaptures: HELD, image: IMAGE } });
  for (const a of p.root().querySelectorAll("a[data-nav]")) await p.click(a);
  await p.click(p.root().querySelector('a[href="/app/held"]') || p.root().querySelector("a[data-nav]"));
  for (const k of p.local.keys()) assert.match(k, /^(cs-(level|theme|railw|level-asked|group|first:[\w-]*)|bio-session(:active)?)$/, k);
  for (const [k, v] of p.local) if (k !== STORE_KEY) assert.doesNotMatch(v, /held|document|home|members|\/app/);
  /* R124 (G12b): the tab keeps the frame's six constants for the session, and nothing else: no read of a screen, no route (R24 holds) */
  assert.deepEqual([...p.store.keys()], [STORE_KEY + ":frame"]);
  assert.deepEqual(Object.keys(JSON.parse(p.store.get(STORE_KEY + ":frame")).reads).sort(), [...["groupidentity", "infolevel"], ...["assistantstate", "aipathready"]].sort());
  assert.doesNotMatch(p.store.get(STORE_KEY + ":frame"), /heldcaptures|document|home|members|\/app/);
  /* the ops the frame and the fixture screens declare they call: the shell's own list, and each fixture screen's reads (R24) */
  const ALLOWED = new Set([...SHELL_OPS, ...SCREENS.flatMap((x) => (x.reads ? Object.values(x.reads({ subject: "s", data: {}, ui: {} })).map((r) => r.op) : []))]);
  /* R20 (T53): `aipathready` is the plane's read over the Worker, declared by `surface-declarations` R15, not yet in `OPS` on the tranche */
  for (const op of ALLOWED) if (op !== "aipathready") assert.ok(Object.hasOwn(OPS, op), op + ": declared by its owner");
  for (const r of p.requests) assert.ok(ALLOWED.has(r.op), r.op);
  await settle();
  assert.ok(ENTRY.length);
});
