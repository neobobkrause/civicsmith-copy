/* screens-entry's tests at the module's interface: its `SCREENS` (interface-shell R21) driven through a stand-in of the
   shell's kit `cs` as interface-shell R21, R27 and R46 state it, over a fake plane that records every request with its
   op, query, body and whether it carried the session. `open(id, …)` draws a screen with its reads answered from a table
   (an answer, a refusal `{ok: false, code}`, `"none"` for no answer, `"pending"`), `press(op, …)` fills fields and runs
   the act as the shell runs it (`send`, the request, `refusals` or `done`, the re-reads), and `tree`/`text` read what
   was drawn. The words are the shell's: `WORD_ROWS` (interface-shell R5), this module holding none of its own (R21);
   `word` and `hasWord` are `setup-words`' (its R11, R12), which the tests read keys through, never English.
   The real page's frame (no header, no rail, the fragment taken from the address) is tested over the shell's harness
   in `page.test.mjs`.
   The plane behind a screen is `store-request`'s `storeWorld()` (K5054, op-tables §5.3): `open(id, {world, as})` sends every read
   and act through the world's door (R17), as the signed-in member `as` (R16) or as nobody, and the screen is shown what the real
   store answers; a test makes the state it needs by real acts (`act`). `table` holds only what the world cannot say: a read that is
   pending (`"pending"`), unanswered (`"none"`) or refused with no code of its own (`{ ok: false }`), the faults the harness owns. */
import { WORD_ROWS, word, hasWord } from "../../../src/setup-words/index.mjs";
import { OPS, SESSION_OPS, NEEDS } from "../../../src/op-declarations/index.mjs";
import { SCREENS, SCREEN_WORDS } from "../../../src/screens-entry/index.mjs";
import { toSource } from "../../../src/interface-shell/index.mjs";
import { storeWorld } from "../store-request/fixtures.mjs";
import { scanner } from "../file-safety/fixture.mjs";
export { SCREENS, SCREEN_WORDS, word, hasWord };

/** A screen as the served page holds it (interface-shell R21, "self-contained"): every function by its own text, evaluated outside the
 *  module, so a name the module declares at its own scope is not there (a `ReferenceError` when the function runs, as in the page). */
export function served(spec) {
  const back = (v) => {
    if (typeof v === "function") return (0, eval)("(" + toSource(v) + ")");
    if (Array.isArray(v)) return v.map(back);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, back(x)]));
    return v;
  };
  return back(spec);
}

/** A fresh world over the real store (store-request R16–R19): claimed by the founder, or unclaimed when a test walks the claim.
 */
export const worldOf = ({ claimed = true, ...o } = {}) => storeWorld({ claimed, ...o });
/** The binding `FILE_SCANNER` as a platform double: file-safety's own scanner stand-in (its `fixture.mjs`, answering as `file-scanner`'s
 *  Provides state), reached by an address or a `Request` as a service binding is. `script` is that double's (`signatures`, `test`, ...). */
export function scannerBinding(script = {}) {
  const s = scanner(script);
  return { calls: s.calls, fetch: (input, init) => s.fetch(input instanceof Request ? input : new Request(input, init)) };
}
/** The sealing secret a team's keys are kept under (a binding of the platform, which a world is given when a test keeps a key). */
export const SEAL = "a-long-seal-secret-for-the-test-only";
/** A member made by the founder's real acts on a team the page itself claimed (a world's own `signIn` needs a team the world claimed): her
 *  `memberadd` (an administrator's, with the password asked again first), the invitation's `enroll` with a password of her own, then
 *  `login`. Answers `{handle, token, password}`. */
export async function enrol(world, founder, founderPassword, handle, { admin = false } = {}) {
  await act(world, founder, "reauth", { body: { password: founderPassword } });
  const added = await act(world, founder, "memberadd", { body: { memberId: handle, cover: `the world's member ${handle}`, ...(admin ? { role: "admin" } : {}) } });
  const password = `${handle}-world-passphrase`;
  await act(world, null, "enroll", { body: { invite: added.invite, handle, password } });
  const login = await act(world, null, "login", { body: { handle, password, device: "own" } });
  return { handle, token: login.token, password };
}

/** The founder's session on a team she claimed before the handle was asked (credentials R1: a claim with no handle holds none; she signs in as `admin`). */
export async function oldFounder({ env = {}, password = "founder long password" } = {}) {
  const world = await worldOf({ claimed: false, env: { ACCOUNT_SEAL_SECRET: SEAL, ...env } });
  await world.claim({ password });
  const login = await act(world, null, "login", { body: { handle: "admin", password, device: "own" } });
  return { world, as: { token: login.token }, password };
}
/** The password asked again before an act that keeps a key or changes administrators (credentials R66), as the shell asks it. */
export const reauth = (world, as, password) => act(world, as, "reauth", { body: { password: password ?? world.password } });

// ---- every screen in its states, over a team with everything set and a team with nothing ----
const memo = new Map();
/** `scenes(full)`: each screen drawn in the states the module draws it, once (the pages are read-only; a test that presses opens its own),
 *  over the real store: a team with every part the founder can set already set (`full`), or with nothing set. Answers
 *  `{pages: [{label, id, o}], acted: [{label, id, o}] (after an act), places}`; `places` the plane's own place names, record data. */
export function scenes(full, page = false) {
  const key = full + ":" + page;
  if (!memo.has(key)) memo.set(key, buildScenes(full, page));
  return memo.get(key);
}
async function buildScenes(full, served = false) {
  const env = { ACCOUNT_SEAL_SECRET: SEAL, FILE_SCANNER: scannerBinding() };
  const FPW = "a founder long password";
  const mk = async () => {
    const world = await worldOf({ env });
    const admin = await world.signIn("admin");
    if (full) {
      await act(world, admin, "groupnameset", { body: { name: "River Town" } });
      await act(world, admin, "groupdescriptionset", { body: { kinds: [], focus: "Leases", purpose: "Checking terms.", visibility: "public" } });
      await act(world, admin, "grouplanguagesset", { body: { languages: ["en", "es"] } });
      await act(world, admin, "profilesset", { body: { profiles: ["oakland-alameda"] } });
      await act(world, admin, "entitycreate", { body: { kind: "office", label: "City Clerk", note: "Takes our requests" } });
      await act(world, admin, "courtnoticeset", { body: { choice: "tell" } });
      await act(world, admin, "hostingaccessset", { body: { holders: "Someone", note: null } });
      await act(world, admin, "reauth", { body: { password: world.password } });
      const cat = (await act(world, admin, "securitytoolcatalogue", {})).offered[0];
      await act(world, admin, "securitytooladd", { body: { providerId: cat.provider_id, config: { region: "eu1" }, credentials: { api_key: "k", api_secret: "s" }, handlingDigest: cat.handling_digest, confirmRetention: true, use: "on_request" } });
    }
    return { world, admin };
  };
  const { world, admin } = await mk();
  const mai = await world.signIn("mai");
  const dev = await world.signIn("dev", { admin: true });
  const invite = (await act(world, admin, "memberadd", { body: { memberId: "ann", cover: "Ann K." } })).invite;
  const link = (await act(world, admin, "joinlinkenable", { body: { capabilities: ["contribute"], dailyCap: 20 } })).link;
  const reset = (await act(world, admin, "passwordresetlink", { body: { member: "mai" } })).link;
  const unclaimed = await worldOf({ claimed: false, env });
  const old = await oldFounder({ env });
  const pages = [], acted = [];
  const page = async (label, id, opts) => { pages.push({ label, id, o: await open(id, { ...opts, page: served }) }); };
  await page("front", "front", { world });
  await page("front signedout", "front", { world, session: { state: "signedout", handle: "mai" } });
  await page("front ended", "front", { world, session: { state: "ended", handle: "mai" } });
  for (let n = 1; n <= 6; n++) await page("tour " + n, "tour", { subject: String(n), world });
  await page("forgot", "forgot", { world });
  await page("reset live", "reset", { world, fragment: { reset } });
  await page("reset none", "reset", { world });
  await page("setup unclaimed", "setup", { world: unclaimed, fragment: { boot: "otp" } });
  await page("setup founder", "setup", { world, as: admin });
  await page("setup old founder", "setup", { world: old.world, as: old.as });
  await page("setup member", "setup", { world, as: mai });
  await page("setup administrator", "setup", { world, as: dev });
  await page("setup claimed", "setup", { world, fragment: { boot: "otp" } });
  await page("join invitation", "join", { world, fragment: { invite } });
  await page("join link", "join", { world, fragment: { join: link } });
  await page("join none", "join", { world });
  // a session the plane has locked: an own-device session idle for thirty minutes, on a team of its own (its clock moves)
  const lockedTeam = await mk();
  const lou = await lockedTeam.world.signIn("lou");
  await lockedTeam.world.tick(31 * 60e3);
  await page("front locked", "front", { world: lockedTeam.world, as: lou, session: { state: "locked", handle: "lou" } });
  // the states only an act reaches: the codes shown, a handle chosen, an administrator invited, a password set, a member enrolled
  const press = async (label, id, opts, op, values) => { const o = await open(id, { ...opts, page: served }); await o.press(op, { values }); acted.push({ label: id + " after " + op, id, o }); };
  const fresh = await worldOf({ claimed: false, env });
  await press("claim", "setup", { world: fresh, fragment: { boot: "otp" } }, "claim", { "su-handle": "rivera", "su-pw": "a long password!", "su-pw2": "a long password!" });
  const old2 = await oldFounder({ env });
  await press("handle", "setup", { world: old2.world, as: old2.as }, "founderhandleset", { "su-fh": "rivera" });
  const t3 = await mk();
  await reauth(t3.world, t3.admin);
  await press("invite", "setup", { world: t3.world, as: t3.admin }, "memberadd", { "su-adm-id": "dev2", "su-adm-cover": "Dev" });
  const t4 = await mk();
  const codes = (await act(t4.world, t4.admin, "recoverycodesissue", { body: {} })).codes;
  await press("recover", "forgot", { world: t4.world }, "recover", { "fg-handle": "founder", "fg-code": codes[0], "fg-pw": "a long password!", "fg-pw2": "a long password!" });
  const t5 = await mk();
  const inv5 = (await act(t5.world, t5.admin, "memberadd", { body: { memberId: "bob", cover: "Bob" } })).invite;
  await press("enroll", "join", { world: t5.world, fragment: { invite: inv5 } }, "enroll", { "jn-handle": "bob", "jn-pw": "a long password!", "jn-pw2": "a long password!" });
  const choices = (await act(world, admin, "profiles", {})).choices || [];
  return { pages, acted, world, admin, places: choices.flatMap((c) => [c.name, c.id, ...(c.covers || [])]) };
}

/** A 1×1 PNG, the logo a team sets. */
export const LOGO_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==";
/** The world's team as the founder's real acts make it: a name, a public description, a logo (each only when asked), the founder
 *  signed in (`admin`). */
export async function team({ name = "River Town Tenants", description = { focus: "Leases on public land", purpose: "We check the public body's own terms." }, logo = true, visibility = "public", claimed = true } = {}) {
  const world = await worldOf({ claimed });
  const admin = claimed ? await world.signIn("admin") : null;
  if (name) await act(world, admin, "groupnameset", { body: { name } });
  if (description) await act(world, admin, "groupdescriptionset", { body: { kinds: [], ...description, visibility } });
  if (logo) await act(world, admin, "grouplogoset", { body: { raw: LOGO_PNG, rawType: "image/png" } });
  return { world, admin };
}
/** The page's request to the world's door, as the shell sends it (interface-shell `send`): the op and query in the address, a
 *  body as JSON, the bearer token only when the request is not public. */
export async function viaDoor(world, op, req = {}, token = null) {
  const qs = new URLSearchParams({ op, ...Object.fromEntries(Object.entries(req.query || {}).filter(([, v]) => v !== undefined && v !== null)) });
  const init = req.body === undefined ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req.body) };
  return world.door({ url: `/api/?${qs}`, init }, token ? { token } : null);
}
/** An act or read made by real means, answered as the result it gave: `act(world, as, op, body)` (a refused one throws, naming the op). */
export async function act(world, as, op, { body, query } = {}) {
  const a = await viaDoor(world, op, { body, query }, as ? as.token : null);
  const r = a.json && a.json.result !== undefined ? a.json.result : a.json;
  if (a.status >= 400 || !a.json || a.json.ok === false || (r && r.ok === false)) throw new Error(`${op} was refused: ${JSON.stringify(a.json).slice(0, 300)}`);
  return r;
}

// ---- the words: WORD_ROWS, as the shell carries them to the page (interface-shell R5) ----
const WORDS = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
export { WORDS };
/** A key's sentence read through `word`, each placeholder given as its own `{name}`. */
const NAMES = new Proxy({}, {
  get: (t, n) => (typeof n === "string" ? "{" + n + "}" : undefined),
  has: () => true,
  getOwnPropertyDescriptor: (t, n) => ({ value: "{" + String(n) + "}", writable: false, enumerable: true, configurable: true }),
});
export const sentence = (key) => word(key, NAMES);

export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };
export const unescape = (s) => String(s).replace(/&(amp|lt|gt|quot|#39|apos);/g, (m, e) => ENT[e]);
export const squash = (s) => String(s).replace(/\s+/g, " ").trim();
const usedKeys = new Set();
export const used = () => new Set(usedKeys);
/** The shell's `w(key, fills)`: escaped, each `{name}` filled (a `{html}` fill inserted as it is); an unknown key draws
 *  as itself (interface-shell R5's fallback). */
export function w(key, fills) {
  usedKeys.add(key);
  const t = WORDS.has(key) ? WORDS.get(key) : key;
  return esc(t).replace(/\{(\w+)\}/g, (m, n) => {
    if (!fills || !(n in fills)) return m;
    const v = fills[n];
    return v && typeof v === "object" && "html" in v ? v.html : esc(v);
  });
}
/** A word's text as the member reads it. */
export const said = (key, fills) => squash(unescape(w(key, fills)));
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export function date(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  return w("date.daymonthyear", { day: String(+m[3]), month: { html: w("date.month." + MONTHS[+m[2] - 1]) }, year: m[1] });
}
export const day = (iso) => squash(unescape(date(iso)));

// ---- reading HTML (as screens-settings' kit reads it) ----
const VOID = new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
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
      for (const a of m[3].matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = unescape(a[2] ?? a[3] ?? a[4] ?? "");
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
export const texts = (n) => [...walk(n)].filter((c) => c.text !== undefined && c.text.trim()).map((c) => squash(c.text));
export const acts = (n) => all(n, (e) => e.tag === "button" && e.attrs["data-act"]);
export const actOps = (n) => [...new Set(acts(n).map((e) => e.attrs["data-act"]))].sort();
export const links = (n) => all(n, (e) => e.tag === "a").map((e) => e.attrs.href);

// ---- the plane ----
const answerOf = (a) => {
  if (a === "none" || a === null) return { kind: "silent" };
  if (a === "pending") return { kind: "pending" };
  if (a && a.ok === false) return { kind: "refused", code: String(a.code || a.reason), fields: a };
  // the shell's reading: an `ok: true` answer whose result carries `ok: false` is refused (interface-shell R13; D29)
  if (a && a.result && typeof a.result === "object" && a.result.ok === false) return { kind: "refused", code: String(a.result.code || a.result.reason), fields: a.result };
  return { kind: "ok", value: a && a.result !== undefined ? a.result : a, json: a && a.result !== undefined ? a : { ok: true, result: a } };
};
const NOT_FOUND = /^NO_SUCH_|_NOT_FOUND$|^NOT_FOUND$/;

/**
 * Draws screen `id` as the shell would: `session` the record's state (`view.session`), `fragment` what the shell took
 * from the address (`view.fragment`), `world` the plane behind it and `as` the member signed in (her whoami is `view.me`),
 * `table` the faults only (op → `"pending"`, `"none"`), `subject` the address's subject.
 */
export async function open(id, { table = {}, session = { state: "none" }, fragment = {}, me = null, subject = null, world = null, as = null, page = false } = {}) {
  const found = SCREENS.find((s) => s.id === id);
  if (!found) throw new Error("no screen " + id);
  const spec = page ? served(found) : found;
  const o = { spec, requests: [], signins: [], gone: [], wizards: [], saves: [], copies: [], timers: [], now: 0, refused: null, token: as ? as.token : session.state === "live" || session.state === "locked" ? "tok-locked" : null };
  const ui = {};
  const data = {};
  if (world && as && !me) me = (await viaDoor(world, "whoami", {}, as.token)).json.result;
  const view = { subject, data, ui, me, session, fragment: { ...fragment }, origin: "https://group.example", parts: {} };
  o.view = view;
  let drawn = [];
  const isPublic = (op) => OPS[op] && OPS[op].classes === null;
  // interface-shell R12, R46: before a session only public ops are drawn; with one, R12's gate
  const can = (op) => {
    if (!OPS[op]) return false;
    if (!view.me) return isPublic(op) || (op === "unlock" && session.state === "locked");
    if (isPublic(op)) return true;
    const need = NEEDS[op];
    if (need && !(view.me.capabilities || []).includes(need)) return false;
    const set = view.me.tokenClass === "admin" ? SESSION_OPS.admin : SESSION_OPS.member;
    return set.has(op) || op === "unlock";
  };
  let inflight = 0;
  async function request(op, req = {}) {
    inflight++;
    try { return await send(op, req); } finally { inflight--; }
  }
  async function send(op, req = {}) {
    const header = !!(o.token && !isPublic(op));
    const rec = { op, query: req.query || {}, body: req.body, header, token: header ? o.token : null, answer: null };
    o.requests.push(rec);
    let a = table[op];
    if (typeof a === "function") a = a(req.body, req.query || {});
    if (a === undefined) {
      if (!world) throw new Error(`${id}: ${op} asked, and no plane behind the screen (open it with a world)`);
      a = (await viaDoor(world, op, req, header ? o.token : null)).json;
    }
    return (rec.answer = answerOf(a));
  }
  const kitOf = () => {
    const cs = {
      w, esc, date: (iso) => date(iso),
      get me() { return view.me; },
      can,
      value(fid) {
        const f = o.fields[fid];
        if (f === undefined) { const el = all(o.tree, (e) => e.attrs.id === fid)[0]; if (!el) return null; if (el.attrs.type === "checkbox" || el.attrs.type === "radio") return el.attrs.checked !== undefined; return el.attrs.value ?? ""; }
        return f;
      },
      set(k, v) { ui[k] = v; draw(); },
      fill(fid, v) { o.fields[fid] = v; },
      go(screen, sub) { o.gone.push(screen + (sub ? "/" + sub : "")); },
      later(ms, fn) { o.timers.push({ at: o.now + ms, fn }); },
      now: () => o.now,
      async call(op, req = {}) { const a = await request(op, req); return a.kind === "ok" ? a.json : a.kind === "refused" ? a.fields : null; },
      async signin(answer, opts = {}) {
        o.signins.push({ answer, opts }); if (!(answer && answer.token)) return false; o.token = answer.token;
        // the member the shell reads once the session is handed over (whoami, interface-shell R32): the world's own answer
        const r = await viaDoor(world, "whoami", {}, o.token);
        view.me = r.json && r.json.result ? r.json.result : null;
        return true;
      },
      wizard(...a) { o.wizards.push(a); },
      // interface-shell R47: each answers its own control, bound by the shell
      save(name, text, opt = {}) { o.saves.push({ name, text }); return `<button type="button" class="cs-btn" data-shell="save" data-name="${esc(name)}">${w(opt.label)}</button>`; },
      copy(text, opt = {}) { o.copies.push(text); return `<button type="button" class="cs-btn" data-shell="copy">${w(opt.label)}</button>`; },
      signout(opt = {}) { return `<button type="button" class="cs-btn" data-shell="signout">${w(opt.label)}</button>`; },
      state(r, inner, opt = {}) {
        if (typeof r === "string") r = data[r];
        if (!r || r.state === "loading") return `<p class="cs-state" data-state="loading">${w("state.loading")}</p>`;
        if (r.state === "failed") return `<p class="cs-state" data-state="failed">${w("state.failed", { reason: { html: r.refusal ? r.refusal.words : "" } })}</p>`;
        if (r.state === "empty") return `<p class="cs-state" data-state="empty">${w(opt.empty || "state.empty")}</p>`;
        return inner(r.value);
      },
      act(op, opt = {}) {
        const a = spec.acts.find((x) => x.op === op);
        if (!a || !can(op)) return "";
        const dat = Object.entries(opt.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
        return `<button type="button" class="cs-btn" data-act="${op}"${dat}>${w(opt.label || a.label || "act." + op + ".label." + id, opt.fills)}</button>`;
      },
      title(t) { return `<h1 class="t-title">${t === undefined || t === null ? w("screen." + id + ".name") : esc(t)}</h1>`; },
      sec(k, inner, opt = {}) { return `<section class="cs-section"><h2>${w(k, opt.fills)}</h2>${inner}</section>`; },
      field(fid, k, opt = {}) {
        const type = opt.type || (opt.area ? null : "text");
        const input = opt.area ? `<textarea id="${esc(fid)}" class="cs-input">${esc(opt.value || "")}</textarea>`
          : `<input id="${esc(fid)}" class="cs-input" type="${esc(type)}"${type === "password" ? "" : ` value="${esc(opt.value || "")}"`}>`;
        return `<div class="cs-field"><label for="${esc(fid)}">${w(k, opt.fills)}</label>${opt.help ? `<span class="help">${w(opt.help)}</span>` : ""}${input}</div>`;
      },
      // interface-shell R27 (N986): options by key `[value, key]`, or record data `{value, text}` drawn escaped
      choice(fid, k, options, opt = {}) {
        const opt1 = (x) => (Array.isArray(x) ? [x[0], w(x[1], x[2])] : [x.value, esc(x.text)]);
        return `<div class="cs-field"><label for="${esc(fid)}">${w(k)}</label><select id="${esc(fid)}" class="cs-input">${options.map((x) => { const [v, t] = opt1(x); return `<option value="${esc(v)}"${opt.value === v ? " selected" : ""}>${t}</option>`; }).join("")}</select></div>`;
      },
      checks(fid, k, options, opt = {}) {
        return `<fieldset class="cs-field" id="${esc(fid)}"><legend>${w(k)}</legend>${options.map(([v, kk, on], i) => `<label><input type="${opt.radio ? "radio" : "checkbox"}" name="${esc(fid)}" id="${esc(fid)}-${i}" value="${esc(v)}"${on ? " checked" : ""}> ${w(kk)}</label>`).join("")}</fieldset>`;
      },
    };
    return cs;
  };
  o.fields = {};
  function draw() {
    o.html = spec.render(kitOf(), view);
    o.tree = html(o.html);
    o.text = squash(textOf(o.tree));
    drawn.push(o.html);
  }
  async function readAll(names) {
    const specs = spec.reads ? spec.reads(view) || {} : {};
    for (const [n, r] of Object.entries(specs)) {
      if (names && !names.includes(n)) continue;
      const a = await request(r.op, { query: r.query, body: r.body });
      if (a.kind === "pending") { data[n] = { state: "loading", value: null, refusal: null }; continue; }
      if (a.kind === "ok") {
        const v = a.value;
        const empty = r.empty ? !!r.empty(v) : v === null || v === undefined || (Array.isArray(v) && !v.length);
        data[n] = { state: empty ? "empty" : "ok", value: v, refusal: null };
      } else if (a.kind === "refused") data[n] = { state: "failed", value: null, refusal: { code: a.code, get words() { return WORDS.has("refusal." + a.code) ? w("refusal." + a.code) : esc(a.code); } } };   // read, so drawn, only by a screen that draws the failure
      else data[n] = { state: "failed", value: null, refusal: { code: null, words: w("state.failed", { reason: "" }) } };
      if (r.subject && a.kind === "refused" && NOT_FOUND.test(a.code)) o.notFound = true;
    }
    draw();
  }
  o.readAll = readAll;
  draw();
  await readAll(null);
  /** Runs act `op` as the shell does: the fields filled (`values`), the button's `data-*` matched (`data`). Answers the
   *  requests it made, and whether it was refused (`o.refused` the words drawn beside it). */
  o.press = async (op, { data: d = {}, values = {} } = {}) => {
    Object.assign(o.fields, values);
    const btn = acts(o.tree).find((b) => b.attrs["data-act"] === op && Object.entries(d).every(([k, v]) => b.attrs["data-" + k] === String(v)));
    if (!btn) throw new Error(`${id}: no ${op} drawn for ${JSON.stringify(d)}`);
    const a = spec.acts.find((x) => x.op === op);
    const before = o.requests.length;
    o.refused = null;
    const el = { dataset: Object.fromEntries(Object.entries(btn.attrs).filter(([k]) => k.startsWith("data-") && k !== "data-act").map(([k, v]) => [k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase()), v])) };
    const cs = kitOf();
    let req;
    try { req = a.send ? await a.send(view, el, cs, {}) : { body: {} }; } catch (e) { throw new Error(`${id}: ${op}'s send threw: ${e.message}`); }
    if (!req) return { sent: o.requests.slice(before), refused: false };
    if (req.refuse) { o.refused = { key: req.refuse, text: said(req.refuse, req.fills) }; draw(); return { sent: o.requests.slice(before), refused: true }; }
    const ans = await request(op, req);
    if (ans.kind !== "ok") {
      const own = a.refusals && a.refusals[ans.code];
      const words = typeof own === "function" ? own({ code: ans.code, ...(ans.fields || {}) }, cs) : typeof own === "string" ? w(own) : WORDS.has("refusal." + ans.code) ? w("refusal." + ans.code) : esc(ans.code);
      o.refused = { code: ans.code, text: squash(unescape(String(words))) };
      draw();
      return { sent: o.requests.slice(before), refused: true };
    }
    // interface-shell R21 (K3009): every password field cleared after a successful act
    for (const e of all(o.tree, (x) => x.tag === "input" && x.attrs.type === "password")) delete o.fields[e.attrs.id];
    let after = null;
    if (a.done) after = await a.done(view, ans.value, cs);
    if (after && after.stay) draw(); else await readAll(a.rereads || null);
    return { sent: o.requests.slice(before), refused: false };
  };
  /** The page clock moved on: `cs.later` timers due run in order. */
  o.tick = async (ms) => {
    const end = o.now + ms;
    for (;;) {
      const due = o.timers.filter((t) => t.fn && t.at <= end).sort((x, y) => x.at - y.at)[0];
      if (!due) break;
      o.now = due.at; const fn = due.fn; due.fn = null;
      await fn(kitOf(), view);
      // the real plane answers over several turns: wait until every request this timer made has been answered
      for (let i = 0; i < 5 || inflight > 0; i++) await new Promise((r) => setImmediate(r));
    }
    o.now = end;
    draw();
  };
  o.drawn = () => drawn.join("\n");
  return o;
}

export const has = (o, key, fills) => { if (!o.text.includes(said(key, fills))) throw new Error(`not drawn: ${key} "${said(key, fills)}"\nin: ${o.text.slice(0, 600)}`); };
export const lacks = (o, key, fills) => { if (o.text.includes(said(key, fills))) throw new Error(`drawn: ${key}`); };
