/* screens-settings' tests over the real served page (B6, K3007): `interface-shell`'s `interfacePage(SCREENS)` booted by its
   harness (`test/m/interface-shell/harness.mjs`) over its document stand-in (`dom.mjs`), with a fake plane answering each
   op in its owner's shape. `open` boots the page at a screen and answers what the main area drew; `press` fills the
   fields, clicks the act's button as a member would, answers the shell's friction (a reason asked), and settles.

   `html(s)` reads an HTML string into a small tree (elements, attributes, text), so the tests can find what a screen
   drew: its text nodes, its acts (`[data-act]`), its fields and its links. `w`/`said` give a word's expected text. */
import { storeWorld } from "../store-request/fixtures.mjs";   // the world registers every owner's declarations once, as the plane does at start-up (store-assembly R83)
export { storeWorld };
import { wordsOf } from "../../../src/interface-shell/index.mjs";
import { boot, ok, pending, silent, counted } from "../interface-shell/harness.mjs";
import { decode } from "../interface-shell/dom.mjs";
import { SCREENS } from "../../../src/screens-settings/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
export { SCREENS };

// ---- reading HTML ----

const VOID = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
export const unescape = (s) => String(s).replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (ENT[e] !== undefined) return ENT[e];
  if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return m;
});

/** An HTML string as `{tag: "#root", children}`; each element `{tag, attrs, children, parent}`, each text `{text}`. */
export function html(s) {
  const root = { tag: "#root", attrs: {}, children: [] };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|(<)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) {
      const tag = m[1].toLowerCase();
      let c = cur;
      while (c !== root && c.tag !== tag) c = c.parent;
      if (c === root) throw new Error(`a closing </${tag}> with no element open`);
      cur = c.parent;
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const attrs = {};
      for (const a of m[3].matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
        attrs[a[1].toLowerCase()] = unescape(a[2] ?? a[3] ?? a[4] ?? "");
      const el = { tag, attrs, children: [], parent: cur };
      cur.children.push(el);
      if (!VOID.has(tag) && !m[4]) cur = el;
    } else if (m[5] !== undefined) cur.children.push({ text: unescape(m[5]), parent: cur });
    else if (m[6]) throw new Error("a bare '<' in the drawn HTML");
  }
  if (cur !== root) throw new Error(`<${cur.tag}> left open`);
  return root;
}

export function* walk(n) { for (const c of n.children || []) { yield c; if (c.tag) yield* walk(c); } }
export const all = (n, pred) => [...walk(n)].filter((c) => c.tag && pred(c));
export const textOf = (n) => (n.text !== undefined ? n.text : (n.children || []).map(textOf).join(""));
export const squash = (s) => s.replace(/\s+/g, " ").trim();
/** Every non-blank text node, trimmed. */
export const texts = (n) => [...walk(n)].filter((c) => c.text !== undefined && c.text.trim()).map((c) => squash(c.text));
export const acts = (n) => all(n, (e) => e.tag === "button" && e.attrs["data-act"]);
export const actOps = (n) => [...new Set(acts(n).map((e) => e.attrs["data-act"]))].sort();
export const fields = (n) => all(n, (e) => ["input", "textarea", "select"].includes(e.tag));
export const ancestor = (e, pred) => { for (let p = e.parent; p; p = p.parent) if (p.tag && pred(p)) return p; return null; };

// ---- the words ----

/* The words the served page carries (interface-shell R5, R70): `WORD_ROWS` and the shell's own, each screen's keys among them. */
const ROWS = new Map(wordsOf(SCREENS));
export const WORDS = ROWS;
/** A word as the shell's `w(key, fills)` draws it (R5, R70): `setup-words`' `word`, which throws for a key the list lacks and for a
 *  `{name}` the fills do not fill, each fill escaped. */
export function w(key, fills = {}) {
  used.add(key);
  return esc(word(key, fills));
}
const used = new Set();
export const usedKeys = () => new Set(used);
export const resetUsed = () => used.clear();
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** A word's text with its fills, as a drawn text node reads it (unescaped), for comparison. */
export const said = (key, fills = {}) => squash(unescape(w(key, fills)));
/** A word's text, unescaped, for a fill (the kit's `t`). */
export const t = (key, fills = {}) => unescape(w(key, fills));
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** A date as the shell draws it (its R6): `date.daymonthyear` with `date.month.*`. */
export const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return said("date.daymonthyear", { day: String(d), month: t("date.month." + MONTHS[m - 1]), year: String(y) }); };

// ---- the served page, over the shell's harness ----

const SHELL_REASON = "Because the team agreed to it.";

/** An answer as the fake plane gives it (`fixtures.mjs`), turned into the harness's response. */
function toResponse(a) {
  if (a === "pending") return pending;
  if (a === "none" || a === null) return silent;
  if (a && a.ok === false && a.result === undefined) return { status: a.status || 409, json: a };
  return { status: 200, json: a };
}

export const screen = (id) => SCREENS.find((s) => s.id === id);

/** Boots the page at `/app/<id>[/<subject>]` as `me`, over `table` (op → answer or `(query, body) => answer`).
 *  `reachable` answers the frame's reads so the assistant is reachable (interface-shell R20). `words` answers
 *  `interfacewords` (the member's shown words). */
export async function open(id, { me, table = {}, subject = null, reachable = false, words = null, screens = SCREENS, world = null, as = null } = {}) {
  const plane = {};
  for (const [op, a] of Object.entries(table)) plane[op] = async (req) => { const q = { ...req.query }; delete q.op; return toResponse(typeof a === "function" ? await a(q, req.body) : a); };
  /* over a world (store-request R18): the real store answers every op the table does not hold, `as` is the session that asks, and the frame's
     reads (`whoami`, `groupidentity`, the queue, the words, the assistant's state) are the world's own */
  const door = world ? world.boot(as) : null;
  if (!world) {
    if (reachable) {
      if (!table.assistantstate) plane.assistantstate = ok({ ok: true, on: true });
      if (!table.groupkeystate) plane.groupkeystate = ok({ ok: true, on: true });
    }
    plane.whoami = ok({ ...me, session: true });
    if (words) plane.interfacewords = ok({ ok: true, language: "en", words });
  }
  const b = await boot({ screens, plane, ...(door ? { door: counted(door.door), session: door.session } : {}), path: "/app/" + id + (subject !== null ? "/" + encodeURIComponent(subject) : "") });
  await b.settle(80);
  const main = () => b.doc.getElementById("cs-main");
  // the shell's own reads, `bootstrap` among them (sent once, public, for the test-instance band; interface-shell R36). The shell exports
  // no list of its frame's reads (SHELL_OPS holds its acts and the reads screens share), so these stay listed: deferred, N1073
  const SHELL = new Set(["whoami", "interfacewords", "groupidentity", "queue", "infolevel", "bootstrap"]);
  const reqs = () => b.requests.map((r) => { const q = { ...r.query }; delete q.op; return { op: r.op, query: q, body: r.body, headers: r.headers, method: r.method }; });
  const out = { b, s: screen(id) || screens.find((x) => x.id === id), refused: null, cs: { w } };
  out.p = { get requests() { return reqs().filter((r) => !SHELL.has(r.op)); }, get all() { return reqs(); } };
  out.redraw = () => { const m = main(); out.html = m ? m.innerHTML : ""; out.tree = html(out.html); out.text = squash(decode(textOf(out.tree))); return out; };
  out.redraw();
  /** Fills the fields (`values`: id → text, or true/false for a box), clicks the act's button whose `data-*` match
   *  `data`, answers the shell's reason when it asks one (`reason`), and settles. Answers the requests the act made and
   *  what the shell drew beside the act. */
  /** Picks an option of a choice the screen drew (`cs.choice`), as a member would, and settles with the screen drawn again. */
  out.choose = async (fid, value) => {
    const el = b.doc.getElementById(fid);
    if (!el) throw new Error(`${id}: no choice ${fid} drawn`);
    el.value = value;
    b.fire(el, "change");
    await b.settle(40);
    out.redraw();
  };
  /** Ticks (or unticks) a box or picks a radio the screen drew, as a member would, and settles with the screen drawn again (a `redraw` choice). */
  out.tick = async (fid, on = true) => {
    const el = b.doc.getElementById(fid);
    if (!el) throw new Error(`${id}: no box ${fid} drawn`);
    if (el.type === "radio" && on) for (const r of b.doc.querySelectorAll('input[type="radio"]')) if (r.getAttribute("name") === el.getAttribute("name")) r.checked = false;
    el.checked = on;
    b.fire(el, "change");
    await b.settle(40);
    out.redraw();
  };
  out.press = async (op, { data = {}, values = {}, reason, wait = false, choose = {} } = {}) => {
    const doc = b.doc;
    for (const [cid, v] of Object.entries(choose)) await out.choose(cid, v);
    for (const [fid, v] of Object.entries(values)) {
      const el = doc.getElementById(fid);
      if (!el) continue;
      if (typeof v === "boolean") {
        if (el.type === "radio" && v) for (const r of doc.querySelectorAll('input[type="radio"]')) if (r.getAttribute("name") === el.getAttribute("name")) r.checked = false;
        el.checked = v;
      } else el.value = v;
    }
    // a `data` value of null asks for the button that does not carry that attribute (two buttons of one act on a screen)
    const want = Object.entries(data).map(([k, v]) => ["data-" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), v === null ? null : String(v)]);
    const btn = main().querySelectorAll(`button[data-act="${op}"]`).find((e) => want.every(([a, v]) => (v === null ? e.getAttribute(a) == null : e.getAttribute(a) === v)));
    if (!btn) throw new Error(`${id}: no ${op} button drawn for ${JSON.stringify(data)}`);
    const ai = btn.getAttribute("data-ai");
    const before = b.requests.length;
    b.fire(btn, "click");
    await b.settle(80);
    // an act whose send awaits the browser's own work (the signer's key, WebCrypto) is waited for until its request is sent,
    // bounded by time: a fixed number of polls gives up before a slow key is made
    const until = Date.now() + 20000;
    while (wait && Date.now() < until && !b.requests.slice(before).some((r) => r.op === op)) {
      await new Promise((res) => setTimeout(res, 5));
      await b.settle(10);
    }
    const ta = doc.getElementById("cs-reason-" + String(ai).replace(":", "-"));
    // a member gives the reason an act asks (interface-shell R107); a test that means to leave it unanswered passes `reason: null`
    const give = reason === undefined ? SHELL_REASON : reason;
    if (ta && give !== null) { ta.value = give; b.fire(doc.querySelector(`[data-shell="reason-send"][data-for="${ai}"]`), "click"); await b.settle(80); }
    // the reason the harness gave in the shell's box is the shell's mark, not a declared field (B18): it is left out of `sent` unless the test gave its own
    const sent = b.requests.slice(before).map((r) => { const q = { ...r.query }; delete q.op; let body = r.body;
      if (reason === undefined && ta && body && body.reason === SHELL_REASON) { body = { ...body }; delete body.reason; }
      return { op: r.op, query: q, body, headers: r.headers, method: r.method }; });
    const slot = main().querySelector(`[data-slot="${ai}"]`);
    const said2 = slot ? squash(decode(slot.textContent)) : "";
    out.refused = said2 ? { text: said2, key: keyOf(said2) } : null;
    out.redraw();
    return { sent, refused: !!said2 && (!ta || give !== null), asked: !!ta };
  };
  return out;
}

const TEXT_KEY = new Map();
function keyOf(text) {
  if (!TEXT_KEY.size) for (const [k, en] of WORDS) if (!/\{\w+\}/.test(en) && !TEXT_KEY.has(en)) TEXT_KEY.set(en, k);
  return TEXT_KEY.get(text) || null;
}

// ---- what the page drew ----

/** A row the shell's `cs.rows` drew (its R19), by its key: the row, and its panel (the next row, `cs-panel`). */
export function rowOf(tree, key, name = key) {
  const b = all(tree, (e) => e.attrs["data-shell"] === "row" && e.attrs["data-id"] === String(key))[0];
  if (b) return ancestor(b, (e) => e.tag === "tr");
  // a row with no acts has no button: found by its first cell, its name
  return all(tree, (e) => e.tag === "tr" && /cs-r\b/.test(e.attrs.class || "") && squash(decode(textOf(e.children.filter((c) => c.tag)[0] || { children: [] }))) === String(name))[0] || null;
}
export function panelOf(tree, key) {
  const r = rowOf(tree, key);
  if (!r) return { tag: "tr", attrs: {}, children: [] };
  const sib = r.parent.children.filter((c) => c.tag);
  const next = sib[sib.indexOf(r) + 1];
  return next && /cs-panel/.test(next.attrs.class || "") ? next : { tag: "tr", attrs: {}, children: [] };
}
/** Whether the main area says a word, filled (its text, as the member reads it). */
export const has = (o, key, fills) => { if (!o.text.includes(said(key, fills))) throw new Error(`not drawn: ${key} "${said(key, fills)}"`); };
export const lacks = (o, key, fills) => { if (o.text.includes(said(key, fills))) throw new Error(`drawn: ${key}`); };

/** The ops the design's registry lists for a screen (an owed act by the op it owes): the owner's declaration of a screen's acts (N1073). */
import { readFileSync } from "node:fs";
export const registryOps = (id) => {
  const reg = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8")).screens.find((x) => x.id === id);
  return reg.acts.map((a) => (/^owed:/.test(a.op) ? a.op.slice(5).split(" ")[0] : a.op)).sort();
};
