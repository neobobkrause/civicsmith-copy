/* interface-shell R127 (fix round 6, G31; A-27): a first sign-in sends each `(op, query)` once. The walker counted 49 requests at the first load after
   sign-in, `queue` twice. Two things were found by driving the real sign-in route (the real `front` screen's `login` act, then the real Queue screen
   over the real screens of the nine modules): the open list and the muted list are two queries of one op by design, and the whole open list asks the
   frame no `count`; but `front` hands the session over twice (once to stay and read `whoami`, once to open the page kept), and the shell took each
   for a new session: `whoami`, `interfacewords` and the six frame reads went out twice. Each test was seen failing first. */
import test from "node:test";
import assert from "node:assert/strict";
import { boot, tabs, STORE_KEY, settle } from "./harness.mjs";
import { inWorld, bootAs, doorAs, obligations, WORLD_FOUNDER_HANDLE, WORLD_PASSWORD } from "./world.mjs";

const MODS = ["screens-settings", "screens-intake", "screens-daily", "screens-inquiry", "screens-entry", "screens-wizards", "screens-investigate", "screens-publish", "screens-action"];
const REAL = []; let GUIDE = null;
for (const m of MODS) { const x = await import(`../../../src/${m}/index.mjs`); REAL.push(...x.SCREENS); if (x.GUIDE) GUIDE = x.GUIDE; }
/* the frame's six reads, as the frame groups them (the team and the level; the four that decide whether the assistant is reachable) */
const TEAM = ["groupidentity", "infolevel"], REACH = ["assistantstate", "aipathready"];
/* the team, its founder and three open obligations of hers are the world's: the sign-in the page makes is the real `login`, the queue the real `queue` */
const WHOLE = 3;
const founderWorld = async () => {
  const { world } = await inWorld({ handle: "rosa" });
  const me = await world.signIn(WORLD_FOUNDER_HANDLE);
  await obligations(world, me, WHOLE);
  return { world, me };
};
const typeIn = (p, handle = WORLD_FOUNDER_HANDLE, password = WORLD_PASSWORD) => {
  p.doc.getElementById("fs-handle").value = handle;
  p.doc.getElementById("fs-pw").value = password;
};
const sig = (r) => r.op + " " + JSON.stringify(Object.fromEntries(Object.entries(r.query).filter(([k]) => k !== "op" && k !== "background"))) + (r.body === undefined ? "" : " " + JSON.stringify(r.body));
const repeats = (reqs) => { const n = new Map(); for (const r of reqs) n.set(sig(r), (n.get(sig(r)) || 0) + 1); return [...n].filter(([, c]) => c > 1).map(([s, c]) => s + " x" + c); };
/* the member signs in on the real `front` screen at `path`: the handle and the password typed, the login act pressed; answers the page and the requests the press caused */
async function signIn(path, o = {}) {
  const { world } = await founderWorld();
  const p = await bootAs(world, null, { screens: REAL, guide: GUIDE, path, session: null, ...o });
  typeIn(p);
  const before = p.requests.length;
  await p.click('button[data-act="login"]');
  await settle(120);
  return { p, after: p.requests.slice(before) };
}

test("R127 (G31, A-27) a first sign-in on the real front screen, returning to Queue, sends each (op, query, body) once: whoami, the words and the six frame reads go out once, not twice", async () => {
  const { p, after } = await signIn("/app/queue");
  assert.equal(p.location.pathname, "/app/queue", "the page kept is opened");
  assert.ok(p.doc.getElementById("cs-main").getAttribute("data-screen") === "queue", "the Queue screen is drawn");
  assert.deepEqual(repeats(after), [], "no request twice");
  for (const op of ["login", "whoami", "interfacewords", ...TEAM, ...REACH]) assert.equal(after.filter((r) => r.op === op).length, 1, op);
  assert.ok(after.length >= 12 && after.length <= 18, "the load's whole set: " + after.length);
});

test("R127 (G31) the same on Home: the first sign-in sends each request once", async () => {
  const { p, after } = await signIn("/app");
  assert.equal(p.location.pathname, "/app");
  assert.deepEqual(repeats(after), []);
  assert.equal(after.filter((r) => r.op === "whoami").length, 1);
});

test("R127 (G31) the session is handed over once: the record is written once, for the other tabs' one storage event, and the sign-in is complete (a member, the Queue's rail count, the masthead's initial)", async () => {
  const { world } = await founderWorld();
  const p = await bootAs(world, null, { screens: REAL, guide: GUIDE, path: "/app/queue", session: null });
  const writes = [], set = p.win.localStorage.setItem;
  p.win.localStorage.setItem = (k, v) => { if (k === STORE_KEY) writes.push(v); return set(k, v); };
  typeIn(p);
  await p.click('button[data-act="login"]');
  await settle(120);
  const records = writes.map((w) => JSON.parse(w));
  assert.equal(records.length, 1, "the record written once");
  assert.deepEqual({ ...records[0], t: typeof records[0].t }, { t: "string", e: records[0].e, d: "own", w: WORLD_FOUNDER_HANDLE });
  assert.equal(p.root().querySelector(".cs-rail a .count").textContent, String(WHOLE));
  assert.equal(p.root().querySelector(".mk-avatar span").textContent, WORLD_FOUNDER_HANDLE[0].toUpperCase());
});

test("R127 (G31) control: another member signing in over a live session is a new session, whoami and the frame read again; and a hand-over of a different handle or device rewrites the record", async () => {
  /* a front of its own with two fields: whoever is typed signs in, and the page stays (the original's two scripted tokens are two real members' sign-ins) */
  const stand = { id: "front", words: [], reads: () => ({}),
    acts: [{ op: "login", rereads: [], send: new Function("view", "el", "cs", 'return { body: { handle: cs.value("sx-handle"), password: cs.value("sx-pw"), device: "own" } };'),
      done: new Function("view", "answer", "cs", 'var a = answer.result !== undefined ? answer.result : answer; return cs.signin(a, { device: "own", handle: cs.value("sx-handle"), stay: true }).then(function () { return { stay: true }; });') }],
    render: new Function("cs", "view", 'return cs.field("sx-handle", "screen.entry.password") + cs.field("sx-pw", "screen.entry.password", { type: "password" }) + cs.act("login");') };
  const { world } = await founderWorld();
  const dev = await world.signIn("dev");
  const devPassword = world.__passwords.get("dev");
  const p = await bootAs(world, null, { screens: [stand], path: "/app", session: null });
  const as = async (handle, password) => { p.doc.getElementById("sx-handle").value = handle; p.doc.getElementById("sx-pw").value = password; await p.click('button[data-act="login"]'); await settle(60); };
  await as(WORLD_FOUNDER_HANDLE, WORLD_PASSWORD);
  assert.equal(p.byOp("whoami").length, 1);
  const first = JSON.parse(p.local.get(STORE_KEY)).t;
  await as(dev.handle, devPassword);
  assert.equal(p.byOp("whoami").length, 2, "a different token is a new session");
  assert.notEqual(JSON.parse(p.local.get(STORE_KEY)).t, first);
  assert.equal(JSON.parse(p.local.get(STORE_KEY)).w, dev.handle);
  assert.ok(p.byOp("groupidentity").length >= 2, "the frame is read again for it");
});

test("R127 (G31) control: two tabs on one browser: the tab that did not sign in routes once on the sign-in, and the tab that did sends its own set once", async (t) => {
  const group = tabs();
  const { world } = await founderWorld();
  /* the page reads the record's expiry against its own clock (R32): the world's clock is pinned (WORLD_NOW), so the page runs on it too; on the
     machine's clock the record the world wrote expired on 31 Oct 2026 and the other tab took it for none (attempt 8: failing from that day) */
  t.mock.method(Date, "now", () => world.now());
  const a = await bootAs(world, null, { screens: REAL, guide: GUIDE, path: "/app/queue", session: null, tabs: group });
  const b = await bootAs(world, null, { screens: REAL, guide: GUIDE, path: "/app/queue", session: null, tabs: group });
  typeIn(a);
  const nb = b.requests.length, na = a.requests.length;
  await a.click('button[data-act="login"]');
  await settle(120);
  assert.deepEqual(repeats(a.requests.slice(na)), []);
  assert.deepEqual(repeats(b.requests.slice(nb)), [], "the other tab's one set, nothing twice");
  assert.equal(b.requests.slice(nb).filter((r) => r.op === "whoami").length, 1);
});

test("R7 R123 (G31, A-27) the Queue draws the real op's whole open list and asks no count: the open list and the muted list are two queries of one op by design, each sent once, and the frame's number is the list's", async () => {
  const { world, me } = await founderWorld();
  const p = await bootAs(world, me, { screens: REAL, guide: GUIDE, path: "/app/queue" });
  const q = p.byOp("queue").map(sig);
  assert.deepEqual(q.sort(), ['queue {"muted":"true"}', "queue {}"].sort(), "the open list and the muted list, once each");
  assert.equal(p.byOp("queue").filter((r) => r.query.count).length, 0, "no count read");
  assert.equal(p.root().querySelector(".cs-rail a .count").textContent, String((await me.read("queue")).items.length));
});

test("R7 R123 (G31) control: an open list the op cut (truncated true) is the one case the frame asks for the count, once", async () => {
  const { world, me } = await founderWorld();
  const door = doorAs(world, me).door;
  /* the world's own answer with `truncated` set, as an open list longer than the op's limit is answered */
  const cut = async (req) => { const a = await door(req); if (!req.query.count && !req.query.muted) a.json.result.truncated = true; return a; };
  const p = await bootAs(world, me, { screens: REAL, guide: GUIDE, path: "/app/queue", plane: { queue: cut } });
  assert.equal(p.byOp("queue").filter((r) => r.query.count).length, 1);
  assert.deepEqual(repeats(p.requests), []);
});
