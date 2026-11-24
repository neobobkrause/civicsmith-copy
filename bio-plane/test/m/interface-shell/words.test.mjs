/* interface-shell R5, R6, R10: every drawn string a word read by key (or the record's own data), dates by their words,
   and every read in one of four states. */
import { frameAnswers } from "./frame-answers.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { WORD_ROWS, word } from "../../../src/setup-words/index.mjs";
import { wordsOf } from "../../../src/interface-shell/index.mjs";
import { boot, ok, refused, refusedIn, httpError, silent, pending, textNodes } from "./harness.mjs";
import { ALL, FIXTURE_WORDS } from "./screens.fixture.mjs";
import { inWorld, bootAs, translated } from "./world.mjs";

const DATA = ["A lease", "3 pages", "B", "withheld", "Pothole repairs", "Closed", "Minutes", "Budget", "River Town", "Pothole", "2 questions", "M", "mai", "R"];
const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "withheld", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });
const HELD = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }, { id: "h2", title: "Budget", at: "2026-10-02" }] });
const FRAME_ANSWERS = await frameAnswers();
const PLANE = { image: IMAGE, heldcaptures: HELD, projectdirectory: ok({ projects: [{ id: "P1", title: "Pothole", questions: 2, due: "2026-10-20" }] }) };
const PATHS_ = ["/app", "/app/held", "/app/document/c1", "/app/members", "/app/settings", "/app/people", "/app/more", "/app/nowhere"];

/* the words a page may draw, as patterns: each `{name}` any filling; a text node is one word filled, a piece of one
   between its placeholders, or the record's own data */
function wordChecker(words, data) {
  const pats = [], pieces = new Set();
  for (const [, en] of words) {
    const parts = en.split(/\{\w+\}/);
    if (/^\{\w+\}$/.test(en.trim())) continue; /* a word that is only a placeholder names no text */
    pats.push(new RegExp("^" + parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$"));
    for (const p of parts) if (p.trim()) pieces.add(p.trim());
  }
  return (t) => data.includes(t) || pieces.has(t) || pats.some((re) => re.test(t)) || [...pieces].some((p) => p.length > 3 && p.includes(t));
}

test("R5 every screen in every state (data, loading, empty, failed): each drawn text node, and each explanation's, is a word of WORD_ROWS, the shell's or a screen's own, filled, or the record's own data", async () => {
  const words = wordsOf(ALL);
  const isWord = wordChecker(words, DATA);
  const states = [PLANE, Object.fromEntries(Object.keys(PLANE).map((k) => [k, pending])), Object.fromEntries(Object.keys(PLANE).map((k) => [k, ok(null)])), Object.fromEntries(Object.keys(PLANE).map((k) => [k, refused("NOT_ALLOWED", "You may not read this.")]))];
  let n = 0;
  for (const plane of states) for (const path of PATHS_) for (const phone of [false, true]) {
    const p = await boot({ screens: ALL, path, plane, phone });
    for (const node of textNodes(p.root())) { const t = node.data.trim(); if (!t) continue; n++; assert.ok(isWord(t), `${path}: "${t}"`); }
    for (const el of p.root().querySelectorAll("[data-tip]")) {
      const tip = p.doc.createElement("div"); tip.innerHTML = el.getAttribute("data-tip");
      for (const node of textNodes(tip)) { const t = node.data.trim(); if (t) assert.ok(isWord(t), `${path} tip: "${t}"`); }
    }
  }
  assert.ok(n > 500);
});

test("R5 a key no list holds fails the check (control), and is drawn as its key", async () => {
  const bad = { id: "home", reads: () => ({}), acts: [], render: (cs) => cs.title() + "<p>" + cs.w("screen.home.no.such.key") + "</p>" };
  const p = await boot({ screens: [bad] });
  const isWord = wordChecker(wordsOf([bad]), DATA);
  const texts = textNodes(p.root()).map((x) => x.data.trim()).filter(Boolean);
  assert.ok(texts.includes("screen.home.no.such.key"));
  assert.equal(isWord("screen.home.no.such.key"), false);
});

test("R5 after whoami the shell reads op=interfacewords: the group's shown translation where held, the English of WORD_ROWS or SCREEN_WORDS for a key it does not answer or when the read fails", async () => {
  /* the team keeps "Cola" for the Queue place in es; the Home place it keeps nothing for */
  const { world, me } = await inWorld({ founder: true });
  const held = await translated(me, "es", [["rail.queue.name", "Cola"]]);
  assert.deepEqual(held.map((x) => x.key), ["rail.queue.name"], "the store shows the one adopted word");
  const p = await bootAs(world, me, { screens: ALL, plane: PLANE });
  const ops = p.requests.map((r) => r.op);
  assert.ok(ops.indexOf("interfacewords") > ops.indexOf("whoami"));
  const rail = p.root().querySelector(".cs-rail").textContent;
  assert.ok(rail.includes("Cola") && !rail.includes("Queue"));
  assert.ok(rail.includes("Home") && rail.includes("Settings"));
  for (const fail of [refused("NOT_ALLOWED"), silent, httpError(500)]) {
    const q = await boot({ screens: ALL, plane: { ...PLANE, interfacewords: fail } });
    assert.ok(q.root().querySelector(".cs-rail").textContent.includes("Queue"));
  }
});

test("R5 a failed interfacewords read is retried once on the next screen change, and no more", async () => {
  let n = 0;
  const p = await boot({ screens: ALL, plane: { ...PLANE, interfacewords: () => (++n, silent) } });
  assert.equal(n, 1);
  await p.click('a[href="/app/settings"]');
  assert.equal(n, 2);
  await p.click('a[href="/app/people"]');
  assert.equal(n, 2);
});

test("R5 a screen's own row under a WORD_ROWS key is drawn in place of WORD_ROWS' English (DEC-149's conformed form), and `w` fills each {name} HTML-escaped", async () => {
  const key = "act.groupkeyremove.does";
  assert.ok(WORD_ROWS.some((r) => r[0] === key));
  const s = { id: "home", reads: () => ({}), acts: [], words: [[key, "Removes your group's key from your team's Civicsmith.", false], ["screen.home.t.fill", "Hello {who}", false]],
    render: (cs) => "<p id=a>" + cs.w("act.groupkeyremove.does") + "</p><p id=b>" + cs.w("screen.home.t.fill", { who: "<b>x</b>" }) + "</p>" };
  const p = await boot({ screens: [s] });
  assert.equal(p.doc.getElementById("a").textContent, "Removes your group's key from your team's Civicsmith.");
  assert.equal(p.doc.getElementById("b").textContent, "Hello <b>x</b>");
  assert.equal(p.doc.getElementById("b").querySelectorAll("b").length, 0);
  assert.ok(FIXTURE_WORDS.length);
});

test("R6 dates are drawn by date.daymonthyear and date.daymonth with date.month.*, never in ISO form", async () => {
  const s = { id: "home", reads: () => ({}), acts: [], render: (cs) => `<p id=a>${cs.date("2026-03-07")}</p><p id=b>${cs.date("2026-12-25T10:00:00Z", { year: false })}</p><p id=c>${cs.due("2026-10-20", "near")}</p><p id=d>${cs.date(Date.UTC(2025, 0, 2))}</p>` };
  const p = await boot({ screens: [s] });
  const t = (id) => p.doc.getElementById(id).textContent;
  const en = (k) => WORD_ROWS.find((r) => r[0] === k)[1];
  assert.equal(t("a"), en("date.daymonthyear").replace("{day}", "7").replace("{month}", en("date.month.march")).replace("{year}", "2026"));
  assert.equal(t("b"), en("date.daymonth").replace("{day}", "25").replace("{month}", en("date.month.december")));
  const day = (d, m, y) => en("date.daymonthyear").replace("{day}", d).replace("{month}", en("date.month." + m)).replace("{year}", y);
  assert.equal(t("c"), day("20", "october", "2026"));
  assert.equal(t("d"), day("2", "january", "2025"));
  for (const id of ["a", "b", "c", "d"]) assert.doesNotMatch(t(id), /\d{4}-\d{2}-\d{2}/);
});

test("R10 R61 every read of every screen answered in turn as pending, empty, refused and failed (no answer) draws still loading, empty (or the screen's own sentence), a refusal's own words alone or, with none, \"could not be read\" naming no code, never one for another", async () => {
  const reads = [["/app", "projectdirectory", FIXTURE_WORDS.find((r) => r[0] === "screen.home.t.empty")[1]], ["/app/held", "heldcaptures", word("state.empty")]];
  for (const [path, op, emptyText] of reads) {
    const st = async (answer) => { const p = await boot({ screens: ALL, path, plane: { ...FRAME_ANSWERS, ...PLANE, [op]: answer } }); return p.root().querySelector("#cs-main"); };
    const loading = await st(pending);
    assert.ok(loading.querySelector('[data-state="loading"]'), path);
    assert.ok(loading.textContent.includes(word("state.loading")));
    const empty = await st(ok(op === "heldcaptures" ? { items: [] } : { projects: [] }));
    assert.ok(empty.querySelector('[data-state="empty"]').textContent.includes(emptyText), path);
    assert.equal(empty.querySelector('[data-state="failed"]'), null);
    for (const [answer, words] of [[refused("NOT_ALLOWED", "You may not read this."), "You may not read this."], [refusedIn("NOT_ALLOWED", "Not yours."), "Not yours."], [httpError(500), word("shell.unread")], [silent, word("shell.unread")]]) {
      const failed = await st(answer);
      const f = failed.querySelector('[data-state="failed"]');
      assert.ok(f, path);
      assert.equal(f.textContent, words, "R61: the words alone, never wrapped in state.failed");
      assert.doesNotMatch(f.textContent, /NOT_ALLOWED|500/, "no code named");
      assert.equal(failed.querySelector('[data-state="empty"]'), null, "a failed read is never drawn as empty");
    }
    const data = await st(PLANE[op]);
    assert.equal(data.querySelector("[data-state]"), null);
  }
});

test("R10 R61 a refusal's words: refusal.<code> when held, else the answer's translation, each alone; else \"could not be read\" with its reference, never the code", async () => {
  const code = WORD_ROWS.find((r) => r[0].startsWith("refusal.") && !/\{/.test(r[1]))[0].slice(8);
  const en = WORD_ROWS.find((r) => r[0] === "refusal." + code)[1];
  const st = async (answer) => (await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: answer } })).root().querySelector('[data-state="failed"]').textContent;
  assert.equal(await st(refused(code, "ignored")), en);
  assert.equal(await st(refused("ZZ_UNHELD", "Its own words.")), "Its own words.");
  /* R83: a code with neither word nor translation is refusal.uncatalogued and the code; no code at all is shell.unread */
  assert.equal(await st(refused("ZZ_UNHELD")), word("refusal.uncatalogued") + " ZZ_UNHELD");
  assert.equal(await st(httpError(500)), word("shell.unread"));
  assert.equal(await st(refused("ZZ_UNHELD", null, 400, { trace: "abcdef0123456789" })), word("refusal.uncatalogued") + " ZZ_UNHELD " + word("refusal.reference", { ref: "abcdef01" }), "R39's reference beside it");
});
