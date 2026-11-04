/* interface-shell, fix round 3 (T51; cause-shell-3): R1 and R2 (the versioned script, C15 P2.4), R5 (`interfacewords` with `v`, C15 P1),
   R113 (an act re-reads only what it changes, C14 P6; `loadReach` makes no screen read, P2.1), R96 (the badge adds the band, C70),
   R68 (the tip closes on the press, C78), R111 (`memberHref`, C94) and the kit's key-file helper (D3). Each test was seen failing first. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { interfacePage, interfaceScript, interfaceScriptHash, scriptPath, versionOfScriptPath } from "../../../src/interface-shell/index.mjs";
import { boot, ok, refused, ADMIN, MEMBER, fitSend, scriptOf, settle, queueOf } from "./harness.mjs";

const WHO = { ...ADMIN, capabilities: ["contribute", "administer", "create_projects", "publish"] };
const SCREEN = { id: "members", words: [], reads: () => ({}), acts: [], render: () => "" };

/* ---------- R1, R2: the versioned script ---------- */
test("R1, R2 the page carries one external script addressed by the release version, no inline script and no nonce slot; the exported hash is the served script's", () => {
  const html = interfacePage([SCREEN], { version: "2026.10.21-7" });
  const tags = html.match(/<script\b[^>]*>/gi) || [];
  assert.equal(tags.length, 1, "one script element");
  assert.match(tags[0], /\bsrc="([^"]+)"/);
  const src = /\bsrc="([^"]+)"/.exec(tags[0])[1];
  assert.equal(src, scriptPath("2026.10.21-7"), "addressed by the version");
  assert.ok(src.includes("2026.10.21-7"));
  assert.equal(versionOfScriptPath(src), "2026.10.21-7");
  assert.equal(versionOfScriptPath("/app/home"), null, "control: a screen address is no script address");
  assert.equal(/<script\b[^>]*>[^<]+<\/script>/i.test(html), false, "no inline script text");
  assert.equal(html.includes("__CSP_NONCE__"), false, "no nonce slot");
  assert.equal(/\bnonce=/.test(html), false);
  const source = interfaceScript([SCREEN], { version: "2026.10.21-7" });
  const hash = "sha256-" + createHash("sha256").update(source).digest("base64");
  assert.equal(interfaceScriptHash([SCREEN], { version: "2026.10.21-7" }), hash, "the hash is the script's bytes' SHA-256");
  assert.ok(tags[0].includes(`integrity="${hash}"`), "the page names the same hash");
  /* the script is the same for a release whatever the response (served unchanged) and holds no version-specific bytes */
  assert.equal(interfaceScript([SCREEN], { version: "other" }), source);
  assert.equal(interfaceScript([SCREEN], { version: "2026.10.21-7", testInstance: true }), source, "the test band is the page's, not the script's");
});

test("R5 the page carries the release version and the shell asks interfacewords with v from it on the first load; control: a page with no version asks with no v and is answered", async () => {
  const p = await boot({ screens: [SCREEN], version: "rel-9" });
  const reqs = p.byOp("interfacewords");
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].query.v, "rel-9", "v from the served page, not from bootstrap's answer");
  const none = await boot({ screens: [SCREEN] });
  assert.equal(none.byOp("interfacewords").length, 1, "still asked");
  assert.equal(none.byOp("interfacewords")[0].query.v, undefined, "no v in the request when the page names none");
});

/* ---------- R113 ---------- */
const THREE = (acts) => ({
  id: "members", words: [],
  reads: (view) => ({
    a: { op: "memberlist" },
    b: { op: "browse", after: ["adminendorse"] },
    c: { op: "projectlist", query: view.ui.n ? { n: view.ui.n } : undefined },
  }),
  acts,
  render: (cs) => cs.act("adminendorse", { label: "act.adminendorse.label.members" }),
});
const act = (extra = {}) => ({ op: "adminendorse", send: fitSend("adminendorse"), ...extra });
const press = async (p, reason = "because") => {
  await p.click(p.root().querySelector('button[data-act="adminendorse"]'));
  const box = p.root().querySelector(".mk-slot textarea");
  if (box) { box.value = reason; await p.click(p.root().querySelector('[data-shell="reason-send"]')); }
};
const counts = (p) => Object.fromEntries(["memberlist", "browse", "projectlist"].map((o) => [o, p.byOp(o).length]));
const delta = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, b[k] - a[k]]));
const plane = { whoami: ok(WHO), adminendorse: ok({ memberId: "x" }), memberlist: ok({ members: [] }), browse: ok({ items: [] }), projectlist: ok({ projects: [] }) };

test("R113 an act re-reads the reads its screen marks as depending on it (a read's `after` naming the act's op), and no other", async () => {
  const p = await boot({ screens: [THREE([act()])], path: "/app/members", plane });
  const before = counts(p);
  await press(p);
  assert.deepEqual(delta(before, counts(p)), { memberlist: 0, browse: 1, projectlist: 0 });
});

test("R113 an act's own list adds to the declared dependants; a read whose request the act's success changed is read too", async () => {
  const listed = await boot({ screens: [THREE([act({ rereads: ["a"] })])], path: "/app/members", plane });
  let before = counts(listed);
  await press(listed);
  assert.deepEqual(delta(before, counts(listed)), { memberlist: 1, browse: 1, projectlist: 0 }, "the listed read and the declared dependant");
  const changed = await boot({ screens: [THREE([act({ rereads: [], done: (view, answer, cs) => { view.ui.n = "7"; } })])], path: "/app/members", plane });
  before = counts(changed);
  await press(changed);
  assert.deepEqual(delta(before, counts(changed)), { memberlist: 0, browse: 1, projectlist: 1 }, "c's request changed");
  assert.equal(changed.byOp("projectlist").at(-1).query.n, "7");
});

test("R113 an act that says all re-reads every read; an act that declares nothing (no list, no read naming its op) keeps R21's rule: every read", async () => {
  const all = await boot({ screens: [THREE([act({ rereads: "all" })])], path: "/app/members", plane });
  let before = counts(all);
  await press(all);
  assert.deepEqual(delta(before, counts(all)), { memberlist: 1, browse: 1, projectlist: 1 });
  const undeclared = { id: "members", words: [], reads: () => ({ a: { op: "memberlist" }, b: { op: "browse" }, c: { op: "projectlist" } }), acts: [act()],
    render: (cs) => cs.act("adminendorse", { label: "act.adminendorse.label.members" }) };
  const u = await boot({ screens: [undeclared], path: "/app/members", plane });
  before = counts(u);
  await press(u);
  assert.deepEqual(delta(before, counts(u)), { memberlist: 1, browse: 1, projectlist: 1 });
});

test("R113 control: a refused act sends no read", async () => {
  const p = await boot({ screens: [THREE([act()])], path: "/app/members", plane: { ...plane, adminendorse: refused("NOT_AN_ADMIN", "No.") } });
  const before = counts(p);
  await press(p);
  assert.deepEqual(delta(before, counts(p)), { memberlist: 0, browse: 0, projectlist: 0 });
});

test("R113 (P2.1) loadReach makes no screen read: the assistant becoming reachable redraws and re-reads nothing; control: a read whose request now differs by reachability is read", async () => {
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  const screen = { id: "members", words: [], reads: () => ({ a: { op: "memberlist" }, b: { op: "browse" } }), acts: [], render: () => "<p>x</p>" };
  const p = await boot({ screens: [screen], path: "/app/members", plane: { ...plane, ...reach } });
  assert.equal(p.root().querySelector('[data-shell="dock"]') !== null, true, "the assistant became reachable");
  assert.equal(p.byOp("memberlist").length, 1, "the screen was read once");
  assert.equal(p.byOp("browse").length, 1);
  const dep = { id: "members", words: [], reads: (view) => ({ a: { op: "memberlist", query: view.reachable ? { r: "1" } : undefined } }), acts: [], render: () => "<p>x</p>" };
  const q = await boot({ screens: [dep], path: "/app/members", plane: { ...plane, ...reach } });
  assert.ok(q.byOp("memberlist").some((r) => r.query.r === "1"), "its request changed, so it was read again");
});

/* ---------- R96 / C70: the badge ---------- */
const badge = (p) => (p.root().querySelector('.mk-hide-phone[data-kind="todo"]') || { textContent: "" }).textContent;
test("R114 R96 (C70) the number the masthead and the rail's Queue place draw is the queue's three kinds plus the count a screen reports with cs.band; control: with none reported it is unchanged", async () => {
  const band = { id: "members", words: [], reads: () => ({}), acts: [], render: (cs) => { cs.band(28); return "<p>x</p>"; } };
  const queue = { queue: queueOf([{ id: "a", class: "OBLIGATION" }, { id: "b", class: "FINDING" }, { id: "c", class: "OBLIGATION" }]) };
  const none = await boot({ screens: [SCREEN], path: "/app/members", plane: queue });
  const base = none.root().querySelector('.cs-rail a .count').textContent;
  assert.equal(base, "3", "the queue's three items");
  const p = await boot({ screens: [band], path: "/app/members", plane: queue });
  assert.equal(p.root().querySelector('.cs-rail a .count').textContent, "31");
  assert.ok(/31/.test(badge(p)), "the masthead draws the same number");
});

/* ---------- C78: the tip closes on the press and does not come back under a still pointer ---------- */
test("R68 (C78) a press closes the open tip and a redraw under the still pointer does not open it again; control: hover opens it", async () => {
  const s = { id: "members", words: [], reads: () => ({ a: { op: "memberlist" } }), acts: [act({ rereads: "all" })], render: (cs) => cs.act("adminendorse", { label: "act.adminendorse.label.members" }) };
  const p = await boot({ screens: [s], path: "/app/members", plane });
  const tip = () => p.doc.getElementById("cs-tip");
  let btn = p.root().querySelector('button[data-act="adminendorse"]');
  p.fire(btn, "pointerover", { pointerType: "mouse" });
  await p.clock.tick(500);
  assert.equal(tip().hidden, false, "hover opens it");
  await press(p);
  assert.equal(tip().hidden, true, "the press closed it");
  btn = p.root().querySelector('button[data-act="adminendorse"]');
  p.fire(btn, "pointerover", { pointerType: "mouse" });
  await p.clock.tick(2000);
  assert.equal(tip().hidden, true, "the redrawn button under the same pointer does not open it again");
  p.fire(btn, "pointerout", { relatedTarget: p.root() });
  p.fire(btn, "pointerover", { pointerType: "mouse" });
  await p.clock.tick(500);
  assert.equal(tip().hidden, false, "after the pointer has left and come back, hover opens it");
});

/* ---------- R111 / C94 ---------- */
const HREFS = { id: "home", words: [], reads: () => ({}), acts: [], render: new Function("cs", "return ['admin', 'u-2', 'nobody', ''].map(function (id) { return '<p data-h=\"1\">' + cs.esc(cs.memberHref(id)) + '</p>'; }).join('');") };
test("R111 (C94) memberHref names a member by handle in the link, the founder included; an unknown id by the fallback, never the id; control: a member with a handle is unchanged", async () => {
  const p = await boot({ screens: [HREFS], plane: { whoami: ok({ ...MEMBER, member: "u-1", handle: "mai" }), memberlist: ok({ members: [{ member_id: "admin", handle: "rosa" }, { member_id: "u-2", handle: "bo" }] }) } });
  await settle();
  const hrefs = p.root().querySelectorAll("[data-h]").map((e) => e.textContent);
  assert.equal(hrefs[0], "/app/members/rosa", "the founder's id is named by the handle");
  assert.equal(hrefs[1], "/app/members/bo");
  assert.equal(hrefs[2], "/app/members", "an unknown id gets the list, not the id");
  assert.equal(hrefs[3], "/app/members");
  for (const h of hrefs) assert.equal(/admin|u-2|nobody/.test(h), false, h);
});

/* ---------- the key-file helper ---------- */
const KEYS = { id: "home", words: [], reads: () => ({}), acts: [],
  render: new Function("cs", "window.__cs = cs; return cs.field('kf', 'shell.signer.loadfile', { type: 'file' });") };
const fileOf = (text, { fail = false } = {}) => ({ name: "k.txt", size: text.length, text: async () => { if (fail) throw new Error("denied"); return text; } });
test("R115 the key-file helper answers a chosen file's text and refuses an unchosen, unreadable or empty one in a word by key; control: it sends nothing and changes no screen", async () => {
  const p = await boot({ screens: [KEYS] });
  const input = p.doc.getElementById("kf");
  const html = p.root().innerHTML;
  const before = p.requests.length;
  assert.deepEqual(await p.win.__cs.keyFile("kf"), { ok: false, word: "shell.keyfile.none" }, "nothing chosen");
  input.files = [fileOf("BIOKEY1.x.y.z")];
  assert.deepEqual(await p.win.__cs.keyFile("kf"), { ok: true, text: "BIOKEY1.x.y.z" });
  input.files = [fileOf("  \n")];
  assert.deepEqual(await p.win.__cs.keyFile("kf"), { ok: false, word: "shell.keyfile.empty" });
  input.files = [fileOf("x", { fail: true })];
  assert.deepEqual(await p.win.__cs.keyFile("kf"), { ok: false, word: "shell.keyfile.unreadable" });
  assert.equal(p.requests.length, before, "it sends nothing");
  assert.equal(p.root().innerHTML, html, "it changes no screen");
});

test("R113 a partial re-read (a read that appears once the assistant is reachable) does not discard the answer of a full read still on its way", async () => {
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  const screen = { id: "members", words: [], reads: (view) => (view.reachable ? { a: { op: "memberlist" }, b: { op: "browse" } } : { a: { op: "memberlist" } }), acts: [],
    render: (cs) => cs.state("a", () => '<b id="drawn">a</b>') };
  let release;
  const p = await boot({ screens: [screen], path: "/app/members", plane: { ...plane, ...reach, memberlist: () => new Promise((r) => { release = () => r(ok({ members: [] })); }) } });
  assert.equal(p.byOp("browse").length, 1, "the new read was read");
  assert.equal(p.doc.getElementById("drawn"), null, "the first read has not answered");
  release();
  await settle();
  assert.ok(p.doc.getElementById("drawn"), "its answer, arriving after the partial re-read, is drawn");
});
