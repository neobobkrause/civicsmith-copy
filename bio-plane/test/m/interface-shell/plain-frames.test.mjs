/* interface-shell R8, R30, R35: the frames drawn without the masthead (public, published, setup) and the out-of-reach state, as the Screens
   pages "every-screen" and "getting-started" draw them. Keys only, never a sentence (R70). */
import test from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { boot, ok, refused, silent, pending } from "./harness.mjs";
import { ALL, FRONT, DOORBELL, JOIN } from "./screens.fixture.mjs";

const TEAM = "Lakeshore Tenants";
const named = (name = TEAM) => ok({ display_name: name });
const main = (p) => p.root().querySelector("#cs-main");
const path = (p) => main(p).querySelector("nav.cs-crumbs");
const current = (p) => path(p).querySelector('b[aria-current="page"]').textContent;

/* a published case that states its signature through `place(view)`: the short name and the key's fingerprint, as the case's read answers them */
const SIGNED = {
  id: "published",
  reads(view) { return { group: { op: "groupidentity" }, c: { op: "publishedcase", query: { id: view.subject }, subject: true } }; },
  render(cs, view) { return cs.state("c", view, function (c) { return cs.title(c.title); }); },
  place(view) {
    const c = view.data.c;
    return c && c.state === "ok" && c.value.fingerprint ? { signed: { short: c.value.short, fingerprint: c.value.fingerprint } } : {};
  },
  acts: [],
};
const PRINT = "7c1e0d5a90b2c4f6e8a1b3d5f7092e4c6a8b0d2f4e6a8c0b2d4f6e8a0c2e4a90b";
const CASE = ok({ title: "The lease", short: "lakeshore", fingerprint: PRINT });

test("R35 can't be reached: under its alert the note that it tries again by itself every 30 seconds, and no link; control: Nothing is here draws no note and keeps its way back", async () => {
  for (const plane of [{ image: silent }, { whoami: silent }]) {
    const p = await boot({ screens: ALL, path: "/app/document/zz", plane });
    const note = main(p).querySelector("[data-unreachable-note]");
    assert.ok(note, "the note is drawn");
    assert.equal(note.textContent, word("screen.unavailable.unreachable.note"));
    assert.ok(main(p).querySelector('[data-unavailable="unreachable"][role="alert"]'), "the alert above it");
    assert.equal(main(p).querySelectorAll("a[href]").filter((a) => !a.closest("nav")).length, 0, "no link");
  }
  const p = await boot({ screens: ALL, path: "/app/document/zz", plane: { image: refused("NO_SUCH_CAPTURE") } });
  assert.equal(main(p).querySelector("[data-unreachable-note]"), null);
  assert.ok(main(p).querySelectorAll("a[href]").filter((a) => !a.closest("nav")).length >= 1, "the way back stays");
});

test("R8 a screen of the public frame opens with its path: the team's name, a link back to the team's page, then the screen's own name, current; front is the team's name alone", async () => {
  const p = await boot({ screens: [DOORBELL], session: null, path: "/app/doorbell", plane: { groupidentity: named() } });
  const first = path(p).querySelector("a");
  assert.equal(first.textContent, TEAM);
  assert.equal(first.getAttribute("href"), "/");
  assert.equal(current(p), word("screen.doorbell.name"));
  /* R30: drawn without a session, so the team's name is read with no Authorization header */
  for (const r of p.requests) assert.equal((r.headers || {}).Authorization, undefined, r.op);
  const f = await boot({ screens: [FRONT], session: null, path: "/app/front", plane: { groupidentity: named() } });
  assert.equal(path(f).querySelector("a"), null, "the team's own page links nowhere");
  assert.equal(current(f), TEAM);
});

test("R8 the team's step: the unnamed-team word for a team with none; none while the screen's own read of it is out; control: a screen that reads no name asks none for its path", async () => {
  const none = await boot({ screens: [DOORBELL], session: null, path: "/app/doorbell", plane: { groupidentity: named(null) } });
  assert.equal(path(none).querySelector("a").textContent, word("shell.group.unnamed"));
  const out = await boot({ screens: [DOORBELL], session: null, path: "/app/doorbell", plane: { groupidentity: pending } });
  assert.equal(path(out).querySelector("a"), null, "no team step while the name is out");
  assert.equal(current(out), word("screen.doorbell.name"));
  /* the setup frame's `join` (R45): no name read of its own, none on this device, so the unnamed word, and no request made for it */
  const j = await boot({ screens: [JOIN], session: null, path: "/app/join", plane: {} });
  assert.equal(path(j).querySelector("a").textContent, word("shell.group.unnamed"));
  assert.equal(current(j), word("screen.join.name"));
  assert.equal(j.byOp("groupidentity").length, 0);
});

test("R30 the published frame is headed by the team's name and ended by its foot: the signature line the screen states, and Made with Civicsmith linking to the credit page; control: no line without a signature, and the public frame draws neither", async () => {
  const p = await boot({ screens: [SIGNED], session: null, path: "/app/published/C1", plane: { groupidentity: named(), publishedcase: CASE } });
  const frame = p.root().querySelector('.cs-frame[data-frame="published"]');
  assert.equal(frame.querySelector("header.cs-pubhead .grp").textContent, TEAM);
  assert.ok(frame.querySelector("header.cs-pubhead .grp").getAttribute("data-tip").includes(word("shell.group.signed")));
  const foot = frame.querySelector("footer.cs-pubfoot");
  assert.equal(foot.querySelector(".id").textContent, word("shell.pubfoot.line", { fingerprint: PRINT }).replace("{short name}", "lakeshore"));
  assert.ok(foot.querySelector(".id").getAttribute("data-tip").includes(word("shell.pubfoot.signature").slice(0, 30)));
  const credit = foot.querySelector("a.cs-credit");
  assert.equal(credit.getAttribute("href"), "/api/?op=credit");
  assert.equal(credit.textContent, word("shell.pubfoot.credit"));
  assert.ok(credit.getAttribute("data-tip").includes(word("shell.credit.neither").slice(0, 20)));
  assert.equal(current(p), word("screen.published.name"));
  for (const r of p.requests) assert.equal((r.headers || {}).Authorization, undefined, r.op);
  /* control: a case that states no signature draws the credit alone */
  const bare = await boot({ screens: [SIGNED], session: null, path: "/app/published/C1", plane: { groupidentity: named(), publishedcase: ok({ title: "The lease" }) } });
  assert.equal(bare.root().querySelector("footer.cs-pubfoot .id"), null);
  assert.ok(bare.root().querySelector("footer.cs-pubfoot a.cs-credit"));
  /* control: the public frame has no head and no foot */
  const d = await boot({ screens: [DOORBELL], session: null, path: "/app/doorbell", plane: { groupidentity: named() } });
  assert.equal(d.root().querySelector(".cs-pubhead"), null);
  assert.equal(d.root().querySelector(".cs-pubfoot"), null);
});
