/* interface-shell R70 (T49; K3366; DEC-257, DEC-258): words by key. The module holds no member-facing English: every key it
   reads is a word of `setup-words`, and what it draws for a key is that word filled (`word(key, vars)`). This file holds
   keys only, never a sentence. */
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as shellModule from "../../../src/interface-shell/index.mjs";
import { wordsOf } from "../../../src/interface-shell/index.mjs";
import { WORD_ROWS, word, hasWord } from "../../../src/setup-words/index.mjs";
import { boot, ok, refused, httpError, textNodes } from "./harness.mjs";
import { ALL, FIXTURE_WORDS } from "./screens.fixture.mjs";
import { inWorld, bootAs, obligations } from "./world.mjs";

/* the keys the module reads: the design's list for it (`words-reads.json`, DEC-258: this module's own declaration of what it
   reads), and the families it builds a key from */
const KEYS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8")).modules["interface-shell"].reads;
const RAIL = ["home", "queue", "find", "add", "projects", "people", "settings"];
const WEIGHTS = ["reversible", "reasoned", "terminal", "signed", "irreversible"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const FAMILIES = [...RAIL.flatMap((k) => ["rail." + k + ".name", "rail." + k + ".holds"]), ...WEIGHTS.flatMap((w) => ["weight." + w + ".name", "weight." + w + ".means"]),
  ...MONTHS.map((m) => "date.month." + m), ...["projects", "people", "settings"].map((k) => "rail." + k + ".line")];

test("R70 each key the module reads is a word of setup-words (hasWord); control: a key no word holds is not", () => {
  for (const k of [...KEYS, ...FAMILIES]) assert.ok(hasWord(k), k);
  assert.equal(hasWord("shell.no.such.word"), false);
  assert.throws(() => word("shell.no.such.word"), /UNKNOWN_WORD/);
});

test("R70 the module holds no English of its own: it exports no word rows, and the words its page carries are setup-words' rows, word for word", () => {
  assert.equal(shellModule.SHELL_WORDS, undefined);
  const rows = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
  const page = new Map(wordsOf([]));
  assert.equal(page.size, rows.size);
  for (const k of [...KEYS, ...FAMILIES]) assert.equal(page.get(k), rows.get(k), k);
});

/* every text, label and explanation a fixture page draws */
function drawn(p) {
  const out = new Set();
  for (const n of textNodes(p.root())) { const t = n.data.trim(); if (t) out.add(t); }
  for (const el of p.root().querySelectorAll("[aria-label], [data-tip]")) {
    if (el.getAttribute("aria-label")) out.add(el.getAttribute("aria-label"));
    if (el.getAttribute("data-tip")) { const d = p.doc.createElement("div"); d.innerHTML = el.getAttribute("data-tip"); for (const n of textNodes(d)) { const t = n.data.trim(); if (t) out.add(t); } }
  }
  return out;
}
const HELD = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }] });

test("R70 over fixtures, what the page draws for a sample of its keys equals word(key, vars): the frame, the masthead, the rail, the tabs and the band", async () => {
  const { world, me } = await inWorld();
  const items = await obligations(world, me, 2);
  const p = await bootAs(world, me, { screens: ALL });
  const seen = drawn(p);
  const has = (key, vars) => assert.ok(seen.has(word(key, vars)), key);
  for (const k of ["shell.sections", "shell.path", "shell.search", "shell.menu.signout", "shell.appearance", "shell.appearance.device", "shell.appearance.light", "shell.appearance.dark",
    "shell.width", "shell.level.button.prompt", "tab.more.name", "mark.path.working.name", "shell.band.working", "shell.mark"]) has(k);
  for (const k of RAIL) has("rail." + k + ".name");
  has("shell.todo", { n: items.length });
  has("shell.you", { handle: me.handle });
  assert.equal(p.root().querySelector(".cs-mast .mk-grp").textContent, word("shell.group.unnamed"));
});

test("R70 over fixtures: a list's picks, sort and row controls, the lock and the unavailable states draw word(key, vars)", async () => {
  const p = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: HELD } });
  await p.click('[data-shell="pick"]');
  const seen = drawn(p);
  const has = (key, vars) => assert.ok(seen.has(word(key, vars)), key);
  has("shell.picked", { n: 1 });
  has("shell.unpick");
  has("shell.pick", { name: "Minutes" });
  has("shell.row.open", { name: "Minutes" });
  const column = FIXTURE_WORDS.find((r) => r[0] === "screen.held.t.col.name")[1];
  has("shell.sort", { column });
  /* the unavailable states */
  const gone = await boot({ screens: ALL, path: "/app/document/c9", plane: { image: refused("NO_SUCH_CAPTURE", null, 404) } });
  const nothing = drawn(gone);
  for (const k of ["shell.unavailable.nothing.title", "shell.unavailable.nothing.says"]) assert.ok(nothing.has(word(k)), k);
  const down = await boot({ screens: ALL, path: "/app/document/c9", plane: { image: refused("BOOM", null, 503) } });
  for (const k of ["shell.unavailable.unreachable.title", "shell.unavailable.unreachable.says"]) assert.ok(drawn(down).has(word(k)), k);
  const notYours = await boot({ screens: ALL, path: "/app/document/c9", plane: { image: refused("NOT_VISIBLE", null, 403) } });
  for (const k of ["shell.unavailable.notyours.title", "shell.unavailable.notyours.says"]) assert.ok(drawn(notYours).has(word(k)), k);
});

test("R70 a refusal's reference and a failure without words are drawn by their keys (refusal.reference with the trace's first 8 characters, shell.unread)", async () => {
  const p = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: refused("ZZ_NO_WORDS", null, 400, { trace: "0123456789abcdef" }) } });
  const text = p.root().querySelector('#cs-main [data-state="failed"]').textContent;
  /* R83: a coded refusal with neither word nor translation is refusal.uncatalogued, its code and the reference; a failure with no code is shell.unread */
  assert.equal(text, word("refusal.uncatalogued") + " ZZ_NO_WORDS " + word("refusal.reference", { ref: "01234567" }));
  const q = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: httpError(500) } });
  assert.equal(q.root().querySelector('#cs-main [data-state="failed"]').textContent, word("shell.unread"));
});
