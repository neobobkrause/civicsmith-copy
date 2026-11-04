/* The screens draw no text of their own outside their words (interface-shell R5, DEC-179, as this module's share of
   it), on the real served page: `interfacewords` answers every word's text between two invisible marks, the first
   carrying its key, so each text node the main area draws reads as words (marked) and what remains, the record's own
   data (handles, covers, reasons, notes, dates, counts) or punctuation. Each key a screen draws is one it lists in its
   `words`, or one the shell draws itself. Over the world (store-request): the record's data is what the owners answered the page. */
import test from "node:test";
import assert from "node:assert/strict";
import { open, walk, WORDS, SCREENS } from "./kit.mjs";
import { env } from "./fixtures.mjs";
import { RUNS, teamNamed, fullTeam } from "./seed-common.mjs";
import { recorded } from "./seed-members.mjs";
import { REFUSED, writingHelp } from "./seed-account.mjs";

const MARKED = [...WORDS.keys()].map((key) => ({ key, text: "⁠" + key + "⁢" + WORDS.get(key) + "⁡", en: WORDS.get(key), fallback: false }));
/* the words the page is shown, each between its marks (the instrument of this test: the real answer carries no marks) */
// fixtures-own: harness the marked words that let the test tell a word from the record's data
const marking = { interfacewords: env({ ok: true, language: "en", words: MARKED }) };
// the record's data: everything the owners answered the page, and the languages' names (R31), derived from the tags the record holds, in the member's language
const LANGUAGES = ["en", "es"].flatMap((l) => ["en", "en-US", "es", "vi", "zh", "yue", "tl", "ko", "ja", "fr", "ar", "ru", "pt", "hi", "so", "am", "ti", "fa", "uk", "hy", "km", "th", "ht", "de", "it", "pl", "sw", "mn", "lo"].map((t) => { const n = new Intl.DisplayNames([l], { type: "language" }).of(t); return n.charAt(0).toUpperCase() + n.slice(1); })).join(" ");
const strip = (t) => { let s = t, prev; do { prev = s; s = s.replace(/⁠[^⁠⁡]*⁡/g, " "); } while (s !== prev); return s; };
const keysIn = (t) => [...t.matchAll(/⁠([^⁠⁡⁢]+)⁢/g)].map((m) => m[1]);
const PUNCT = /^[\s·:,…$\d.()\-–/%›]*$/;
const SHELL = new Set(); // the shell reads its own words by key; its families are SHELLS
const SHELLS = ["rail.", "tab.", "state.", "weight.", "mark.", "date.", "level.", "shell.", "refusal."];

/** The world's door recording what it answers (the page's reads and its acts' answers), once for each team. */
const recorders = new Map();
const recording = (t) => { if (!recorders.has(t)) recorders.set(t, recorded(t.w)); return recorders.get(t); };
/** The data of the record the page was handed by the owners, as one text. */
const textsOf = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") { const pretty = JSON.stringify(v, null, 2); if (pretty.length < 2000) out.push(pretty); for (const x of Object.values(v)) textsOf(x, out); } return out; };
/* an invitation and a join link are drawn as the address the member opens: the team's address, the mark that carries each, then the code the owner made */
const addressed = (strings) => strings.filter((x) => /^[0-9a-f]{32,}$/.test(x)).flatMap((x) => ["https://group.example/#invite=" + x, "https://group.example/#join=" + x]);
const dataOf = (rec, extra) => { const a = rec.answers.map((x) => x.answer); const strings = textsOf([a, extra]); return [...strings, ...addressed(strings)].join("\n") + JSON.stringify([a, extra || ""]) + JSON.stringify([a, extra || ""], null, 2) + LANGUAGES; };

async function check(id, { t, who, subject, table = {}, screens }, what, extra) {
  const rec = recording(t);
  const o = await open(id, { world: rec.world, as: t[who], subject: subject ?? null, table: { ...marking, ...table }, ...(screens ? { screens } : {}) });
  const DATA = dataOf(rec, extra);
  const listed = new Set(o.s.words.map((x) => (Array.isArray(x) ? x[0] : x)));
  // the text of the main area with a break wherever an element begins or ends: a word's fill may be an element (a code, a link), and its marks then enclose the break
  const flat = (n) => (n.text !== undefined ? n.text : n.tag ? "\u0001" + n.children.map(flat).join("") + "\u0001" : n.children.map(flat).join(""));
  const drawn = flat(o.tree);
  for (const k of keysIn(drawn)) assert.ok(listed.has(k) || SHELL.has(k) || SHELLS.some((f) => k.startsWith(f)), `${id} (${what}): ${k} drawn but not in its words`);
  for (const piece of strip(drawn).split("\u0001")) {
    const rest = piece.trim();
    if (!rest || PUNCT.test(rest)) continue;
    for (const part of rest.split(/\s*[·,]\s*|\s{2,}/).map((x) => x.trim()).filter((x) => x && !PUNCT.test(x)))
      assert.ok(DATA.includes(part.replace(/^…/, "")), `${id} (${what}): "${part}" is neither a word nor the record's data`);
  }
  return o;
}

/* Each screen as a member finds it, and some states a team gets into: an account whose infolevel is not answered, a member who sees security
   (T53: `connect`'s states are gone with it, R95). */
const RUNS_ALL = [
  ...RUNS,
  ["account", { team: "full", who: "dev", table: (t) => REFUSED("infolevel", "UNKNOWN_OP") }],
  ["security", { team: "security", who: "dev" }],
];

test("every text drawn by every screen, in every state, is a word or the record's data; every key drawn is listed in the screen's words", async () => {
  for (const [id, run] of RUNS_ALL) {
    const t = await teamNamed(run.team);
    const base = { t, who: run.who, subject: run.subject, table: run.table ? run.table(t) : {} };
    const ok = await check(id, base, "ok", run.table ? await run.table(t).translations?.({ language: "es" }) : undefined);
    // what the screen asked: every read of it (the frame's among them, `whoami` apart) answered late, and not at all
    const asks = [...new Set(ok.p.all.map((r) => r.op))].filter((op) => op !== "whoami" && !(op in marking));
    for (const [what, answer] of [["loading", "pending"], ["failed", "none"]])
      await check(id, { ...base, table: { ...base.table, ...Object.fromEntries(asks.map((k) => [k, answer])) } }, what);
  }
  // what the acts draw after answering, too: the invitation, the key, the link
  const t = await fullTeam();
  const rec = recording(t);
  const m = await open("members", { world: rec.world, as: t.founder, table: marking });
  await m.press("memberadd", { values: { "mi-id": "x", "mi-cover": "y", "mi-cap-contribute": true } });
  await m.press("websitekeycreate", { values: { "mw-cap": "2" } });
  await m.press("joinlinkenable", { values: { "mw-cap": "2" } });
  const DATA = dataOf(rec);
  for (const n of walk(m.tree)) if (n.text !== undefined) { const r = strip(n.text).trim(); if (r && !PUNCT.test(r)) assert.ok(DATA.includes(r) || r === "x", r); }
});

test("control: a text written into a render, not a word, is found", async () => {
  const s = SCREENS.find((x) => x.id === "notes");
  const bad = { ...s, render(cs) { return cs.title() + "<p>Saved!</p>"; } };
  const t = await teamNamed("full");
  await assert.rejects(check("notes", { t, who: "dev", screens: SCREENS.map((x) => (x.id === "notes" ? bad : x)) }, "control"), /Saved!/);
});
