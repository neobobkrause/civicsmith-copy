/* site's generator (R9, R11, R12, R14, R18; tests: site/test/site.test.mjs, "R9", "R11", "R12"). Run from the repository root:
 *   node site/build.mjs            writes site/src/pages.mjs
 *   node site/build.mjs --check    exits non-zero, naming the first difference, when site/src/pages.mjs is stale
 * It is not imported by the Worker, so it is not bundled. It reads the design's `SCR.site` at SITE_COMMIT from git
 * (mock-kit.js and mock-screens.js, evaluated in a sandbox), removes the mock's controls, makes the menu's links real,
 * puts the deploy values' slots in place of the mock's samples and placeholder (R4–R7), and draws every sentence as
 * setup-words' `word(key, vars)` for the keys in KEYS (R12): a drawn sentence no key holds stops the generation, so no
 * English is ever written here. The places ready now are read from the released `jurisdictions` profiles as data,
 * never imported (R11). The look is not generated here: the pages link interface-assets' files (R8, R9). */
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { word } from "../bio-plane/src/setup-words/index.mjs";

export const SITE_COMMIT = "1b6f2bc383";
const ROOT = new URL("../", import.meta.url);
const SCREENS = "docs/development/ux-substrate/screens/";
const OUT = new URL("src/pages.mjs", import.meta.url);

/* Every key the site reads, with the placeholders each fills (R12). */
export const KEYS = Object.freeze({
  "shell.mark": [], "screen.site.name": [],
  "screen.site.nav.home": [], "screen.site.nav.start": [], "screen.site.nav.groups": [],
  "screen.site.hold": [], "screen.site.line1": [], "screen.site.line2": [], "screen.site.start": [], "screen.site.seegroups": [],
  "screen.site.uses.head": [], "screen.site.uses.gather": [], "screen.site.uses.ask": ["example"], "screen.site.uses.ask.example": [],
  "screen.site.uses.weigh": [], "screen.site.uses.finding": [], "screen.site.uses.publish": [],
  "screen.site.gets.head": [], "screen.site.gets.copy": [], "screen.site.gets.check": [], "screen.site.gets.help": [], "screen.site.gets.free": [],
  "screen.site.not.head": [], "screen.site.not.side": [], "screen.site.not.legal": [], "screen.site.not.unsigned": [],
  "screen.site.onecase.head": [], "screen.site.onecase.title": ["case", "edition"], "screen.site.onecase.meta": ["group", "place", "signer", "date"],
  "screen.site.onecase.open": [],
  "screen.site.member.head": [], "screen.site.member.where": [],
  "screen.site.questions.head": [], "screen.site.questions.write": ["address"], "screen.site.questions.unset": [],
  "screen.site.start.lede": [], "screen.site.fit.head": [], "screen.site.fit.what": [],
  "screen.site.need.head": [], "screen.site.need.cloudflare": [], "screen.site.need.time": [], "screen.site.need.nothing": [], "screen.site.start.noaccount": [],
  "screen.site.hold.head": [], "screen.site.hold.what": [],
  "screen.site.steps.head": [], "screen.site.steps.name": ["places"], "screen.site.steps.name.noplace": [], "screen.site.steps.permission": [], "screen.site.steps.install": [],
  "screen.site.steps.claim": [], "screen.site.steps.setup": [], "screen.site.steps.invite": [],
  "screen.site.costs.head": [], "screen.site.costs.what": [], "screen.site.create": [], "screen.site.back": [],
  "screen.site.groups.lede": [], "screen.site.groups.listing": [], "screen.site.groups.none": [], "site.groups.rule": [], "site.groups.rule.head": [], "site.groups.rule.text": [],
  "screen.site.groups.visit": [],
  "screen.site.groups.case.one": [], "screen.site.groups.cases.one": ["editions", "date"],
  "screen.site.groups.case.many": ["cases"], "screen.site.groups.cases.many": ["cases", "editions", "date"],
  "screen.site.notfound": [],
});

/* The design's states, the page each becomes and its path (R1). */
export const STATES = Object.freeze({ a: ["home", "/"], b: ["start", "/start"], c: ["groups", "/groups"], d: ["groupsEmpty", "/groups"] });

// ---- the design, read at SITE_COMMIT ----

export function designMain(commit = SITE_COMMIT) {
  const ctx = vm.createContext({});
  for (const f of ["mock-kit.js", "mock-screens.js"]) {
    const src = execFileSync("git", ["-C", ROOT.pathname, "show", `${commit}:${SCREENS}${f}`], { encoding: "utf8", maxBuffer: 1 << 26 });
    vm.runInContext(src, ctx, { filename: f });
  }
  return vm.runInContext("SCR.site({})", ctx).main;
}

// ---- a small HTML tree, enough for the mock's own markup ----

const VOID = new Set(["use", "br", "img", "input", "meta", "link", "path", "circle"]);
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const unent = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => ENT[e] ?? (e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : m));
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function parse(html) {
  const root = { tag: "#root", attrs: {}, kids: [] }, stack = [root];
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.kids.push(unent(m[5])); continue; }
    const [, close, tag, rawAttrs, self] = m;
    if (close) {
      if (top.tag !== tag) throw new Error(`site build: </${tag}> closes <${top.tag}>`);
      stack.pop(); continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = unent(a[2] ?? a[3] ?? a[4] ?? "");
    const el = { tag, attrs, kids: [] };
    top.kids.push(el);
    if (!self && !VOID.has(tag)) stack.push(el);
  }
  if (stack.length !== 1) throw new Error(`site build: <${stack[stack.length - 1].tag}> is not closed`);
  return root;
}

const classes = (el) => (el.attrs.class || "").split(/\s+/).filter(Boolean);
const textOf = (n) => (typeof n === "string" ? n : n.kids.map(textOf).join(""));
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
export function find(n, pred, out = []) {
  if (typeof n === "string") return out;
  if (pred(n)) out.push(n);
  for (const k of n.kids) find(k, pred, out);
  return out;
}

// ---- words: every drawn sentence is a key's (R12) ----

const SENT = (name) => `\u0001${name}\u0001`;
/* word(key) with each placeholder named by `fill`: a string is drawn as given (already HTML), absent names stay slots. */
export function words(key, fill = {}) {
  if (!(key in KEYS)) throw new Error(`site build: ${key} is not one of KEYS`);
  const vars = Object.fromEntries(KEYS[key].map((n) => [n, SENT(n)]));
  return esc(word(key, vars)).replace(/\u0001(\w+)\u0001/g, (_, n) => (n in fill ? fill[n] : `{{${n}}}`));
}
/* The keys' English as patterns, longest first, so a drawn text is matched to the key whose sentence it is. */
function patterns() {
  return Object.keys(KEYS).map((key) => {
    const vars = Object.fromEntries(KEYS[key].map((n) => [n, SENT(n)]));
    const en = norm(word(key, vars));
    const src = en.split(/\u0001\w+\u0001/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)");
    return { key, en, re: new RegExp(`^${src}(?= |$)`) };
  }).sort((a, b) => b.en.length - a.en.length);
}
/* The keys whose sentences, joined by spaces, are exactly `text`; null when none. */
function matchText(text, pats) {
  if (text === "") return [];
  for (const p of pats) {
    const m = p.re.exec(text);
    if (!m) continue;
    const rest = matchText(text.slice(m[0].length).replace(/^ /, ""), pats);
    if (rest) return [{ key: p.key, en: p.en }, ...rest];
  }
  return null;
}

// ---- the places ready now: the released jurisdictions profiles, read as data (R11, R14) ----

/* Joined as DEC-247 (3) joins them: commas, "and" before the last, no serial comma; "" when none is ready (R14). */
export function joinPlaces(names) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function placesReady(dir = new URL("jurisdictions/profiles/", ROOT)) {
  const names = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort()) {
    const src = readFileSync(new URL(f, dir), "utf8");
    const name = /^\s*name:\s*"((?:[^"\\]|\\.)*)"/m.exec(src), test = /^\s*test:\s*(true|false)\b/m.exec(src);
    if (!name || !test) throw new Error(`site build: ${f} has no top-level name or test`);
    if (test[1] === "false") names.push(JSON.parse(`"${name[1]}"`));
  }
  return joinPlaces(names);
}

// ---- the transform ----

const KEEP = new Set(["class", "href", "viewBox", "aria-hidden", "aria-label", "aria-current", "data-tone"]);
const DROP_CLASS = new Set(["mk-data", "st"]);

export function generate({ commit = SITE_COMMIT, places = placesReady() } = {}) {
  const pats = patterns();
  /* R14: with no place ready, the places step is the key that says so, never "Places ready now:" with nothing after it. */
  const NOPLACE = "screen.site.steps.name.noplace";
  const keyed = (m) => (m && !places ? m.map((k) => (k.key === "screen.site.steps.name" ? { key: NOPLACE, en: norm(word(NOPLACE)) } : k)) : m);
  const tree = parse(designMain(commit));
  const unkeyed = [];
  const fills = { example: words("screen.site.uses.ask.example"), places: esc(places), address: "{{stewards}}" };

  const attrsOf = (el, extra = {}) => {
    let s = "";
    const a = { ...el.attrs, ...extra };
    if (a.class !== undefined) a.class = classes({ attrs: a }).filter((c) => !DROP_CLASS.has(c) && !/^st-/.test(c)).join(" ");
    for (const [k, v] of Object.entries(a)) {
      if (!KEEP.has(k) || v === null) continue;
      if (k === "class" && !v) continue;
      s += k === "href" && v.startsWith("{{") ? v : ` ${k}="${k === "aria-label" ? sentence(v) : esc(v)}"`;
    }
    return s;
  };
  const sentence = (text) => {
    const m = keyed(matchText(norm(text), pats));
    if (!m) { unkeyed.push(norm(text)); return ""; }
    return m.map((k) => words(k.key, fills)).join(" ");
  };
  const hrefOf = (el) => {
    const go = /dataset\.st='(\w)'/.exec(el.attrs.onclick || "");
    if (go) return STATES[go[1]][1];
    if (el.attrs["data-goto"] === "install") return "{{installer}}";
    throw new Error(`site build: a link with no place to go: ${norm(textOf(el))}`);
  };
  /* The design's emphasis kept over the same words: when the keys' English is the drawn text, each <b> of the drawing
     is drawn over the same span; otherwise a leading <b> stays bold while the English still begins with its words. */
  const RAW = { example: word("screen.site.uses.ask.example"), places };
  const emphasised = (body, m) => {
    if (!m.every((k) => KEYS[k.key].every((v) => v in RAW))) return null;
    if (!body.every((k) => typeof k === "string" || (k.tag === "b" && k.kids.every((x) => typeof x === "string")))) return null;
    const raw = m.map((k) => word(k.key, Object.fromEntries(KEYS[k.key].map((v) => [v, RAW[v]])))).join(" ");
    const segs = body.map((k) => [(typeof k === "string" ? k : textOf(k)).replace(/\s+/g, " "), typeof k !== "string"]);
    const joined = segs.map((x) => x[0]).join("");
    if (norm(joined) !== norm(raw)) return null;
    let pos = joined.trimStart().length - joined.length, out = "";
    for (const [t, b] of segs) {
      const piece = raw.slice(Math.max(pos, 0), Math.max(pos + t.length, 0));
      pos += t.length;
      out += b ? `<b>${esc(piece)}</b>` : esc(piece);
    }
    return out;
  };
  const leadBold = (body, m) => m.map((k, i) => {
    const w = words(k.key, fills), lead = body.find((x) => typeof x !== "string" || norm(x));
    if (i === 0 && lead && typeof lead !== "string" && lead.tag === "b") {
      const b = norm(textOf(lead));
      if (k.en.startsWith(b) && !/\u0001/.test(k.en.slice(0, b.length))) {
        const cut = esc(word(k.key, Object.fromEntries(KEYS[k.key].map((x) => [x, SENT(x)]))).slice(0, b.length)).length;
        return `<b>${w.slice(0, cut)}</b>${w.slice(cut)}`;
      }
    }
    return w;
  }).join(" ");
  /* An element whose whole text is keys' sentences is drawn as them: a leading <b> stays bold over the same words, and
     leading icons stay; otherwise its children are drawn one by one. */
  const draw = (n) => {
    if (typeof n === "string") { if (norm(n)) unkeyed.push(norm(n)); return n.trim() ? "" : n.replace(/\s+/g, " "); }
    if (n.repl !== undefined) return n.repl;
    const cl = classes(n);
    if (cl.includes("mk-mockctl")) return "";
    const extra = {};
    if (n.tag === "a") extra.href = hrefOf(n);
    /* R18: "Create your team" is /start's one clear action, the front page's primary button's control kind, never an
       inline link beside a button. */
    if (n.tag === "a" && n.attrs["data-goto"] === "install") Object.assign(extra, { class: "cs-btn", "data-tone": "primary" });
    if (n.tag === "use") extra.href = `/app/assets/icons.svg${n.attrs.href}`;
    const open = `<${n.tag}${attrsOf(n, extra)}${VOID.has(n.tag) ? "/" : ""}>`;
    if (VOID.has(n.tag)) return open;
    const text = norm(textOf(n));
    const icons = [];
    for (const k of n.kids) { if (typeof k !== "string" && !norm(textOf(k))) icons.push(k); else if (typeof k !== "string" || norm(k)) break; }
    const m = text && n.kids.some((k) => typeof k === "string" && norm(k)) ? keyed(matchText(text, pats)) : null;
    let inner;
    if (m) inner = icons.map(draw).join("") + (emphasised(n.kids.slice(icons.length), m) ?? leadBold(n.kids.slice(icons.length), m));
    else inner = n.kids.map(draw).join("");
    return open + inner + `</${n.tag}>`;
  };

  const states = Object.fromEntries(find(tree, (e) => classes(e).includes("st")).map((e) => [classes(e).find((c) => /^st-/.test(c)).slice(3), e]));
  for (const s of Object.keys(STATES)) if (!states[s]) throw new Error(`site build: the design has no state ${s}`);
  const head = find(tree, (e) => classes(e).includes("mk-setuphead"))[0];

  /* R5: the featured case's section, drawn only while FEATURED_CASE is set. */
  const pub = find(states.a, (e) => e.attrs["data-goto"] === "published")[0];
  const featSec = find(states.a, (e) => e.tag === "section" && find(e, (x) => x === pub).length)[0];
  const featRow = find(featSec, (e) => classes(e).includes("cs-row"))[0];
  const featIcon = draw(featRow.kids.find((k) => typeof k !== "string" && k.tag === "svg"));
  featRow.repl = `<div class="cs-row">${featIcon}<span><b><a class="cs-ref" href="{{href}}">${words("screen.site.onecase.title")}</a></b>`
    + `<span class="meta">${words("screen.site.onecase.meta")}</span></span></div>`;
  const featured = draw(featSec);
  featSec.repl = "{{featured}}";

  /* R4: the listed groups' rows. */
  const sheet = find(states.c, (e) => classes(e).includes("cs-sheet"))[0];
  const gRow = find(sheet, (e) => classes(e).includes("cs-row"))[0];
  const gIcon = draw(gRow.kids.find((k) => typeof k !== "string" && k.tag === "svg"));
  const groupRow = `<div class="cs-row">${gIcon}<span><b>{{name}}</b> · {{place}}<span class="meta"><span>{{focus}}</span> · {{cases}}</span></span>`
    + `<a class="cs-ref" href="{{href}}">${words("screen.site.groups.visit")}</a></div>`;
  sheet.repl = '<div class="cs-sheet">{{rows}}</div>';

  /* R7: "Create your group" opens INSTALLER_ADDRESS; until it is set, it is drawn with nowhere to go. */
  const headHtml = draw(head);
  const title = (s) => (s === "a" ? words("screen.site.name") : `${sentence(norm(textOf(find(states[s], (e) => e.attrs["aria-current"] === "page")[0])))} · ${words("screen.site.name")}`);
  const doc = (t, body) => `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>${t}</title><link rel="stylesheet" href="/app/assets/civicsmith.css"><link rel="stylesheet" href="/app/assets/shell.css"><link rel="icon" type="image/svg+xml" href="/favicon.svg"></head>`
    + `<body class="cs"><div class="cs-frame mk-plain" data-frame="setup"><main class="mk-plainmain">${headHtml}${body}</main></div></body></html>\n`;
  const pages = {};
  for (const [s, [name]] of Object.entries(STATES)) pages[name] = doc(title(s), states[s].kids.map(draw).join("").trim());

  /* R1: the 404 page in the same frame: the menu with no page marked, the sentence, and the way back. */
  const nav = find(states.a, (e) => e.tag === "nav")[0];
  for (const a of nav.kids) if (typeof a !== "string") delete a.attrs["aria-current"];
  pages.notFound = doc(words("screen.site.name"), `${draw(nav)}<div class="mk-h"><h1 class="t-title">${words("screen.site.notfound")}</h1></div>`
    + `<div class="mk-acts"><a href="/" class="cs-btn">${words("screen.site.back")}</a></div>`);

  if (unkeyed.length) {
    const e = new Error(`site build: the design draws sentences no key in KEYS holds (R12; a REPORT to BOB):\n  ${[...new Set(unkeyed)].join("\n  ")}`);
    e.code = "UNKEYED"; e.unkeyed = [...new Set(unkeyed)]; throw e;
  }
  const parts = {
    featured, groupRow,
    caseOne: words("screen.site.groups.case.one"), casesOne: words("screen.site.groups.cases.one"),
    caseMany: words("screen.site.groups.case.many"), casesMany: words("screen.site.groups.cases.many"),
    stewardsUnset: `<b>${words("screen.site.questions.unset")}</b>`, stewardsSet: '<a href="mailto:{{address}}">{{address}}</a>',
  };
  return { pages, parts };
}

export function render({ pages, parts }, commit = SITE_COMMIT) {
  const o = (x) => `Object.freeze({\n${Object.entries(x).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join("\n")}\n})`;
  return `/* GENERATED by site/build.mjs from the design's SCR.site at ${commit} and setup-words' words (R9, R12); never edit by hand.\n`
    + ` * Regenerate: node site/build.mjs (from the repository root); check: node site/build.mjs --check. */\n`
    + `export const SITE_COMMIT = ${JSON.stringify(commit)};\nexport const PAGES = ${o(pages)};\nexport const PARTS = ${o(parts)};\n`;
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const text = render(generate());
  if (process.argv.includes("--check")) {
    const old = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (old !== text) {
      const a = old.split("\n"), b = text.split("\n"), i = b.findIndex((l, j) => l !== a[j]);
      console.error(`site/src/pages.mjs is stale at line ${i + 1}`); process.exit(1);
    }
    console.log("site/src/pages.mjs is fresh");
  } else { writeFileSync(OUT, text); console.log(`wrote site/src/pages.mjs (${text.length} bytes)`); }
}
