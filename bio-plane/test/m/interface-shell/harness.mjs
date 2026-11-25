/* interface-shell's tests' harness, imported by the screen modules' tests too (draft-T46-interface §4 (1), (2)): the page
   `interfacePage(screens)` serves, run over the document stand-in (`dom.mjs`) with a scripted plane. Every request the
   page makes is recorded with its address, op, query, headers and body; the plane answers each op from a table (a value,
   a refusal, no answer, or never), with the frame's own reads answered by default. Timers are a fake clock, so the
   explanations' timings (R14) are read exactly. */
import { interfacePage, interfaceScript, NONCE_SLOT } from "../../../src/interface-shell/index.mjs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { declaredOpsOf } from "../../declared-ops.mjs";
import { documentOf, Event, textNodes } from "./dom.mjs";

export { textNodes, Event };

/* A member's session as whoami answers it (control-plane R18). */
export const MEMBER = Object.freeze({ tokenClass: "member", session: true, member: "mai", handle: "mai", administer: false,
  rootOfTrust: false, capabilities: ["contribute"], vocabulary: ["contribute", "create_projects", "publish"], confinedTo: null });
export const ADMIN = Object.freeze({ ...MEMBER, member: "rosa", handle: "rosa", administer: true });

/* answers: a value (`ok`), a refusal at the top level (`refused`) or in `result` (`refusedIn`), an HTTP error with no
   JSON (`httpError`), no answer (`silent`: the fetch throws) and never (`pending`) */
export const ok = (result, status = 200) => ({ status, json: { ok: true, result } });
// fixtures-own: input the refusal envelope this harness builds for the code a test feeds it: the code is the test's input, not a module's answer
export const refused = (code, translation, status = 400, extra = {}) => ({ status, json: { ok: false, reason: code, code, ...(translation ? { translation } : {}), ...extra } });
export const refusedIn = (code, translation) => ({ status: 200, json: { ok: true, result: { ok: false, reason: code, code, ...(translation ? { translation } : {}) } } });
export const httpError = (status = 500) => ({ status, text: "boom" });
export const silent = Object.freeze({ silent: true });
export const ndjson = (events, status = 200) => ({ status, ndjson: events });
export const bytes = (data, type = "application/pdf") => ({ status: 200, bytes: data, type });
export const pending = Object.freeze({ pending: true });

/* R104 (K4164 goal 3, K4168): every op request the page makes is compared with the `fields` its owner declares for that op
   (`DECLARED_OPS`: `{accepts: [...], requires: [...]}`, a `requires` entry that is a list satisfied by any one alternative).
   A field the op does not accept, or a required one missing, throws `FieldMismatch` in the page's `fetch` (the shell shows
   "no answer") and fails the test that pressed the act: the next `settle()` (every `click` and `boot` ends in one) rethrows it.
   An op with no owner declaration is let through and counted. The owners' rows are the collector's (`test-support`'s
   `declaredOpsOf`, R16): `collectOwnerRows` is its one seam here, never a second copy of the collection; a test passes
   fixture rows as `boot({declared})`. */
export class FieldMismatch extends Error {
  constructor(message, detail) { super(message); this.name = "FieldMismatch"; Object.assign(this, detail); }
}
const COLLECTED = await declaredOpsOf(fileURLToPath(new URL("../../../../", import.meta.url)));
/* the owners' rows, `{op: declaration}`, as `test-support`'s one collector finds them; an op it lists as a duplicate fails (`declared.test.mjs`) */
export const collectedDuplicates = () => COLLECTED.duplicates.slice();
export function collectOwnerRows() { return COLLECTED.ops; }
/* a stand-in's `send` for a real op: the fields its owner requires, read through the collector (K3268) and carried into the page as
   data, with `extra` (an expression of view, el and cs) over them. A screen's function is self-contained, so it is built from source. */
export const fitSend = (op, extra = "{}") => new Function("view", "el", "cs", "extra", `return { body: Object.assign(${JSON.stringify(declaredFit(op))}, ${extra}) };`);
/* a request body a stand-in screen sends for a real op: exactly the fields its owner requires (the first alternative of a list), read
   through the collector and never copied by hand (K3268), with `extra` over them */
export function declaredFit(op, extra = {}) {
  const row = COLLECTED.ops[op];
  const body = {};
  if (row && row.fields) for (const need of row.fields.requires || []) { const f = Array.isArray(need) ? need[0] : need; body[f] = "x"; }
  return { ...body, ...extra };
}
const isRow = (r) => !!(r && typeof r === "object" && r.fields && typeof r.fields === "object");
const flat = (list) => (Array.isArray(list) ? list : []).flatMap((x) => (Array.isArray(x) ? x : [x]));
/* the field names a request carries: its query (less the marks the shell adds) and a JSON object body */
export function fieldsOf(req) {
  const names = new Set(Object.keys(req.query || {}).filter((k) => k !== "op" && k !== "background"));
  const b = req.body;
  if (b && typeof b === "object" && !Array.isArray(b) && !(b instanceof Uint8Array) && !(typeof Blob !== "undefined" && b instanceof Blob)) for (const k of Object.keys(b)) names.add(k);
  return names;
}
/* `[{kind: "unknown" | "missing", field}]` for one request against one owner row */
export function fieldMismatches(req, row) {
  const sent = fieldsOf(req);
  const accepted = new Set([...flat(row.fields.accepts), ...flat(row.fields.requires)]);
  const present = (f) => (req.body && typeof req.body === "object" && req.body[f] !== undefined) || (req.query && req.query[f] !== undefined);
  const out = [];
  /* B18: the `reason` the shell adds to a Reasoned act's body (R11, R107) is a shell mark like `op` and `background`, never an
     unknown field; when the owner declares `reason` (an act's own `reasonField`) it is checked as any field is */
  for (const f of sent) if (!accepted.has(f) && f !== "reason") out.push({ kind: "unknown", field: f });
  for (const need of Array.isArray(row.fields.requires) ? row.fields.requires : []) {
    const alt = Array.isArray(need) ? need : [need];
    if (!alt.some(present)) out.push({ kind: "missing", field: alt.join(" or ") });
  }
  return out;
}
const unsettled = [];
const undeclared = new Map();
/* the ops that went out with no owner declaration, counted over the process (R104: `declared N of M ops`) */
export const undeclaredOps = () => new Map(undeclared);

/* a plane's `queue` answer for a list of items: the count (R93) when asked for it, else the list, as the queue answers both */
export const queueOf = (items) => (req) => (req.query && req.query.count ? ok({ ok: true, member: "mai", count: items.length }) : ok({ items }));
export const FRAME = Object.freeze({
  whoami: ok(MEMBER),
  infolevel: ok({ level: "prompt", set_at: null, asked_at: null }),
  assistantstate: ok({ on: false }),
  accountreference: ok({ held: false }),
  subscriptionsignin: ok({ connected: false }),
  groupkeystate: ok({ on: false }),
  version: { status: 200, text: "build-1\n" },
});
/* The session record interface-shell R32 keeps in localStorage under `SESSION_STORE_KEY`: `{t, e, d, w}`. */
export const SESSION = Object.freeze({ t: "tok-1", e: 0, d: "own", w: "mai" });
export const STORE_KEY = "bio-session";

/* One response as the door makes it (answer-envelope R6): a fresh nonce in every slot. */
export function served(html, nonce = "n0nce") { return html.split(NONCE_SLOT).join(nonce); }
/* the shell's script of a page: the external script (R1, fix round 3) is `interfaceScript` over the screens and guide the page was built from;
   a page that still holds an inline script (another module's HTML) gives that text */
export const scriptOf = (html, screens, options = {}) => {
  if (screens !== undefined) return interfaceScript(screens, options);
  const at = html.lastIndexOf("<script");
  if (/<script\b[^>]*\bsrc=/i.test(html.slice(at, html.indexOf(">", at) + 1))) throw new Error("scriptOf: the page's script is external; pass the screens it was built from");
  return html.slice(html.indexOf(">", at) + 1, html.lastIndexOf("</script>"));
};

const tick = () => new Promise((r) => setImmediate(r));
/* a world's door answers after real asynchronous work (hashing, the store's SQL), which a count of ticks does not wait for: `settle` also waits
   while a `door` call is in flight, and until none was started in the last ten ticks */
let doorBusy = 0, doorStarted = 0;
/** A function of the request that reaches a world's door (a test's wrapper of its answer): `settle` waits for it while it works. */
export const counted = (f) => async (...args) => { doorBusy++; doorStarted++; try { return await f(...args); } finally { doorBusy--; } };
export async function settle(n = 40) {
  for (let i = 0; i < n; i++) await tick();
  for (let seen = -1; doorBusy > 0 || seen !== doorStarted;) { seen = doorStarted; for (let i = 0; i < 10; i++) await tick(); }
  /* R104: a request that did not match its owner's declaration fails the test that sent it */
  if (unsettled.length) { const e = unsettled[0]; unsettled.length = 0; throw e; }
}

/* A small IndexedDB stand-in (R40): databases kept in `dbs` (a Map shared across boots to stand for a reload), each a
   Map of object stores; values are structured clones, so a CryptoKey is kept as the browser keeps it. */
export function fakeIndexedDB(dbs = new Map()) {
  const later = (f) => setImmediate(f);
  const request = (fn) => { const r = { result: undefined, onsuccess: null, onerror: null }; later(() => { try { r.result = fn(); if (r.onsuccess) r.onsuccess(); } catch (e) { r.error = e; if (r.onerror) r.onerror(); } }); return r; };
  return {
    dbs,
    open(name) {
      const r = { result: undefined, onsuccess: null, onerror: null, onupgradeneeded: null };
      later(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, new Map());
        const stores = dbs.get(name);
        r.result = {
          createObjectStore(n) { if (!stores.has(n)) stores.set(n, new Map()); return {}; },
          transaction(n) {
            if (!stores.has(n)) throw new Error("no store " + n);
            const m = stores.get(n);
            return { objectStore: () => ({
              get: (k) => request(() => (m.has(k) ? structuredClone(m.get(k)) : undefined)),
              put: (v, k) => request(() => { m.set(k, structuredClone(v)); return k; }),
              delete: (k) => request(() => { m.delete(k); return undefined; }),
            }) };
          },
        };
        if (fresh && r.onupgradeneeded) r.onupgradeneeded();
        if (r.onsuccess) r.onsuccess();
      });
      return r;
    },
  };
}

/**
 * Boot the page at `path` with `screens` registered, over `plane` (an op's answer, or `(req) => answer`).
 * `door` is the world's door (a function of the request); `session` is the record R32 keeps in localStorage (null for none); `testInstance` is `interfacePage`'s option (R58); `tabs` (from `tabs()`) shares one localStorage
 * among pages, each told of the others' writes by the storage event; `idb` is the IndexedDB stand-in's store.
 * Answers `{doc, win, requests, root, clock, settle, click, choose, fire, back, assigned, store, local, byOp, location, ...}`:
 * `store` is the tab's sessionStorage, `local` its localStorage.
 */
export async function boot({ screens = [], plane = {}, session = SESSION, path = "/app", hash = "", phone = false, local = {}, localThrows = false, tabStore = null, tabThrows = false, html, run = true, tabs: group = null, idb = new Map(), guide = null, testInstance = false, version = null, door = null, declared = collectOwnerRows() } = {}) {
  const options = { ...(guide ? { guide } : {}), ...(testInstance ? { testInstance } : {}), ...(version ? { version } : {}) };
  html = html || served(interfacePage(screens, options));
  const doc = documentOf(html);
  const requests = [], polls = [];
  /* `door` (store-request R18: `storeWorld().boot(as).door`) answers every op the `plane` table does not; with a door the frame's
     defaults are not used, the world answers `whoami`, `groupidentity` and the rest itself (op-tables §2); only the version poll is the harness's */
  const answers = { ...(door ? { version: FRAME.version } : FRAME), ...plane };
  const fetch = async (url, init = {}) => {
    const u = new URL(url, "https://group.example");
    /* R92: the version poll is a plain-text address of its own, not an op */
    const op = u.pathname === "/version" ? "version" : u.searchParams.get("op");
    const req = { url: String(url), op, at: performance.now(), query: Object.fromEntries(u.searchParams), init, headers: { ...(init.headers || {}) },
      body: init.body === undefined ? undefined : typeof init.body === "string" ? safeJson(init.body) : init.body, method: init.method || "GET" };
    /* R92: the version poll is a plain-text address of its own, no op: kept apart from `requests`, which are the op door's */
    (op === "version" ? polls : requests).push(req);
    /* R104: the request against its owner's declaration; an op with none is let through and counted */
    if (op && op !== "version") {
      const row = declared[op];
      if (!isRow(row)) undeclared.set(op, (undeclared.get(op) || 0) + 1);
      else {
        const bad = fieldMismatches(req, row);
        if (bad.length) {
          const screen = (/^\/app\/([^/]+)/.exec(location.pathname) || [])[1] || "home";
          const err = new FieldMismatch(`${screen}: ${op} ` + bad.map((b) => (b.kind === "unknown" ? `sent ${b.field}, which the op does not accept` : `is missing the required ${b.field}`)).join("; "), { screen, op, mismatches: bad });
          unsettled.push(err);
          throw err;
        }
      }
    }
    let a = answers[op];
    if (typeof a === "function") a = await a(req);
    if (a === undefined && door) a = await counted(door)(req);
    if (a === undefined) a = ok(null);
    if (a.pending) return new Promise(() => {});
    if (a.silent) throw new TypeError("Failed to fetch");
    return { status: a.status, ok: a.status >= 200 && a.status < 300,
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? (a.ndjson !== undefined ? "application/x-ndjson" : a.bytes !== undefined ? a.type : a.json !== undefined ? "application/json" : "text/plain") : null) },
      text: async () => (a.text !== undefined ? a.text : a.ndjson !== undefined ? a.ndjson.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("\n") + "\n" : JSON.stringify(a.json ?? "")),
      blob: async () => new Blob([a.bytes ?? ""], { type: a.type || "" }),
      json: async () => { if (a.json === undefined) throw new SyntaxError("not JSON"); return JSON.parse(JSON.stringify(a.json)); } };
  };
  const timers = [];
  let now = 0;
  const clock = {
    setTimeout: (f, ms = 0) => { const t = { f, at: now + ms, id: timers.length + 1 }; timers.push(t); return t.id; },
    at: () => now,
    clearTimeout: (id) => { const t = timers.find((x) => x.id === id); if (t) t.f = null; },
    pending: () => timers.filter((t) => t.f).length,
    async tick(ms) { const end = now + ms; for (;;) { const due = timers.filter((t) => t.f && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; now = due.at; const f = due.f; due.f = null; f(); await settle(5); } now = end; },
  };
  const assigned = [];
  /* `tabStore` (a Map, from an earlier page's `store`) is the same tab's sessionStorage carried to a page load that follows; `tabThrows` a sessionStorage that denies every use (G12b) */
  const store = tabStore || new Map();
  const localMap = group ? group.local : new Map();
  for (const [k, v] of Object.entries(local)) localMap.set(k, v);
  if (session) localMap.set(STORE_KEY, JSON.stringify(session));
  else if (!group) localMap.delete(STORE_KEY);
  const location = { pathname: path, hash, origin: "https://group.example", assign: (u) => assigned.push(u) };
  const go = (u) => { const at = String(u).indexOf("#"); location.pathname = at < 0 ? String(u) : String(u).slice(0, at); location.hash = at < 0 ? "" : String(u).slice(at); };
  const listeners = {};
  const objectUrls = [], files = [];
  const tell = (key) => { if (group) for (const other of group.pages) if (other.win !== win) for (const f of other.win.listeners.storage || []) f({ key }); };
  const throwsFor = typeof localThrows === "function" ? localThrows : localThrows ? (k) => /^cs-/.test(k) : () => false;
  const win = {
    document: doc, fetch, location,
    history: { pushState: (s, t, u) => go(u), replaceState: (s, t, u) => go(u) },
    sessionStorage: { getItem: (k) => { if (tabThrows) throw new Error("denied"); return store.get(k) ?? null; }, setItem: (k, v) => { if (tabThrows) throw new Error("denied"); store.set(k, String(v)); }, removeItem: (k) => { if (tabThrows) throw new Error("denied"); store.delete(k); } },
    localStorage: {
      getItem: (k) => { if (throwsFor(k)) throw new Error("denied"); return localMap.get(k) ?? null; },
      setItem: (k, v) => { if (throwsFor(k)) throw new Error("denied"); localMap.set(k, String(v)); tell(k); },
      removeItem: (k) => { if (throwsFor(k)) throw new Error("denied"); localMap.delete(k); tell(k); },
    },
    indexedDB: fakeIndexedDB(idb),
    matchMedia: () => ({ matches: phone, addEventListener() {} }),
    addEventListener: (t, f) => (listeners[t] ||= []).push(f),
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
    listeners,
    crypto: webcrypto, btoa, atob,
    URL: { createObjectURL: (blob) => { const url = "blob:https://group.example/" + (objectUrls.length + 1); objectUrls.push({ url, blob, released: false }); return url; },
           revokeObjectURL: (url) => { const u = objectUrls.find((x) => x.url === url); if (u) u.released = true; } },
  };
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = (t) => { const el = origCreate(t); if (t === "a") el.click = () => files.push({ name: el.getAttribute("download"), url: el.getAttribute("href"), blob: (objectUrls.find((u) => u.url === el.getAttribute("href")) || {}).blob, released: false }); return el; };
  doc.defaultView = win;
  const root = () => doc.getElementById("cs-root");
  /* the browser's radio-group semantics (G77, fix round 7): a radio that is chosen unchecks the others of its name; `choose` is a member's click
     on a box, which fires `change` only when the box was not already checked (a checked radio pressed again changes nothing) */
  const fire = (el, type, init = {}) => {
    if ((type === "change" || type === "click") && el.localName === "input" && el.type === "radio" && el.getAttribute("name") && (type === "change" || !el.checked)) {
      for (const o of doc.querySelectorAll('input[type="radio"]')) if (o !== el && o.getAttribute("name") === el.getAttribute("name")) o.checked = false;
      el.checked = true;
    }
    return el.dispatchEvent(new Event(type, { bubbles: true, target: el, ...init }));
  };
  const choose = async (el) => {
    if (typeof el === "string") el = root().querySelector(el);
    if (!el) throw new Error("nothing to choose");
    if (!(el.type === "radio" && el.checked)) { if (el.type !== "radio") el.checked = !el.checked; else fire(el, "click"); fire(el, "change"); }
    await settle();
    return el;
  };
  const click = async (el) => { if (typeof el === "string") el = root().querySelector(el); if (!el) throw new Error("nothing to click"); fire(el, "click"); await settle(); return el; };
  const back = async (path2) => { go(path2); for (const f of listeners.popstate || []) f({}); await settle(); };
  const page = { doc, win, html, requests, polls, root, clock, settle, click, choose, fire, back, assigned, store, local: localMap, location, objectUrls, files, idb };
  if (group) group.pages.push(page);
  if (run) {
    /* the page's clock is the fake one: `Date.now()` advances with `clock.tick` (cs.now, K3002) */
    const base = Date.now();
    const FakeDate = class extends Date { static now() { return base + clock.at(); } };
    new Function("window", "setTimeout", "clearTimeout", "Date", scriptOf(html, screens, options))(win, clock.setTimeout, clock.clearTimeout, FakeDate);
    await settle();
  }
  page.byOp = (op) => (op === "version" ? polls : requests).filter((r) => r.op === op);
  /* R33: the clock run while the member keeps working (a key pressed every ten minutes), so a test that runs the page
     for days is not locked or signed out by the idle limits */
  clock.tickActive = async (ms) => { let left = ms; while (left > 0) { const step = Math.min(left, 10 * 60 * 1000); doc.body.dispatchEvent(new Event("keydown", { bubbles: true, key: "Shift" })); await clock.tick(step); left -= step; } };
  return page;
}
/* Pages sharing one browser's localStorage, as tabs do (R32). */
export const tabs = () => ({ local: new Map(), pages: [] });
const safeJson = (s) => { try { return JSON.parse(s); } catch { return s; } };

/* R15: every element carrying an explanation inside another that carries one */
export const nestedTips = (root) => root.querySelectorAll("[data-tip]").filter((e) => e.parentElement && e.parentElement.closest("[data-tip]"));

/* R22: a control's accessible name: its aria-label, its text, or its label */
export function accessibleName(el, doc) {
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
  if (el.getAttribute("aria-labelledby")) return el.getAttribute("aria-labelledby").split(/\s+/).map((id) => (doc.getElementById(id) || { textContent: "" }).textContent).join(" ").trim();
  if (["input", "select", "textarea"].includes(el.localName)) {
    const l = el.id ? doc.querySelectorAll("label").find((x) => x.getAttribute("for") === el.id) : null;
    const wrap = el.closest("label");
    return ((l || wrap || { textContent: "" }).textContent || "").trim();
  }
  return (el.textContent || "").trim();
}
export const controls = (root) => root.querySelectorAll("a[href], button, input, select, textarea, [role=separator]");
