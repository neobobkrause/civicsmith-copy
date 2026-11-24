/* interface-shell: the browser program (R3–R22, R24, R26–R51). `shellProgram(D, SCREENS, win, GUIDE)` is serialized whole
   into the page's one script by `interfacePage` (draft-T46-interface §1.3): it refers only to its parameters and to the
   language's own globals, so the same function runs in node over the tests' document stand-in. `D` is the page's frozen
   data (words, the act gate's tables, the grades, the paths, the frames), `SCREENS` the registered screens (R21), `win`
   the window and `GUIDE` the dock's wizard guide (R31) or null. It reads no table and writes nothing of the record: every
   read and act is an op the plane serves, under the session record this module keeps (R32); it keeps no log of reads or
   of screens visited (R24). */
export function shellProgram(D, SCREENS, win, GUIDE) {
  "use strict";
  const doc = win.document;
  const store = (name) => ({
    get(k) { try { return win[name].getItem(k); } catch { return null; } },
    set(k, v) { try { win[name].setItem(k, v); } catch { /* R26, R18: a storage that cannot be written keeps the default */ } },
    del(k) { try { win[name].removeItem(k); } catch { /* nothing kept to remove */ } },
  });
  const local = store("localStorage"), tab = store("sessionStorage");

  /* ---------- words (R5, R6) ---------- */
  const BASE = new Map(D.words);
  let SHOWN = new Map();
  let wordsRead = false, wordsRetry = false;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* R68 (nothing clipped at 390 px): text with a run of 25 or more unbroken characters (a digest, a long name) is escaped
     and given a break opportunity every 16 characters (`<wbr>`, which is no character, so a copy of the text is whole) */
  const soft = (s) => String(s == null ? "" : s).split(/(\s+)/).map((t) => (t.length > 24 ? t.match(/[\s\S]{1,16}/g).map(esc).join("<wbr>") : esc(t))).join("");
  const unesc = (s) => String(s).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
  const textOf = (h) => unesc(String(h == null ? "" : h).replace(/<[^>]*>/g, "")).trim();
  const has = (key) => BASE.has(key);
  const text = (key) => (SHOWN.has(key) ? SHOWN.get(key) : BASE.has(key) ? BASE.get(key) : key);
  /* `w(key, fills)`: the word, HTML-escaped, each `{name}` filled with its value escaped; a value `{html}` is a fragment
     the kit itself made (a date, a refusal's words), inserted as it is. */
  /* R5 (C59): a string `w` itself returned is already escaped, so one handed to another word as a fill (`state.failed` over
     `shell.noanswer`) is inserted as it is and not escaped a second time; any other string, a record's own text whatever it holds, is
     escaped once. The set is bounded: the oldest half goes when it is full. */
  const MADE = new Set();
  const w = (key, fills) => {
    const out = esc(text(key)).replace(/\{(\w+)\}/g, (m, n) => {
      if (!fills || !(n in fills)) return m;
      const v = fills[n];
      return v && typeof v === "object" && "html" in v ? v.html : typeof v === "string" && MADE.has(v) ? v : esc(v);
    });
    if (MADE.size >= 4000) { let drop = 2000; for (const x of MADE) { MADE.delete(x); if (--drop <= 0) break; } }
    MADE.add(out);
    return out;
  };
  const html = (s) => ({ html: s });
  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  /* R6: a date by `date.daymonthyear` (or `date.daymonth` with `{year: false}`) and `date.month.*`, never ISO. */
  function date(iso, o = {}) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    let y, mo, d;
    if (m) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
    else {
      const t = new Date(typeof iso === "number" ? iso : String(iso || ""));
      if (isNaN(t.getTime())) return "";
      y = t.getUTCFullYear(); mo = t.getUTCMonth(); d = t.getUTCDate();
    }
    if (!(mo >= 0 && mo < 12)) return "";
    const month = html(w("date.month." + MONTHS[mo]));
    return o.year === false ? w("date.daymonth", { day: String(d), month }) : w("date.daymonthyear", { day: String(d), month, year: String(y) });
  }

  /* ---------- frames (R30, R45) ---------- */
  const frameOf = (id) => D.frames[id] || "working";
  const sessionless = (id) => frameOf(id) === "public" || frameOf(id) === "published";

  /* ---------- the session record (R32) ---------- */
  /* Beside the record, never holding the token: why it last changed, for the other tabs (`locked`, `ended`,
     `signedout`); the last instant of the member's own activity, shared by the tabs (R33); and, in this tab's
     sessionStorage, the path to return to. */
  const STATE_KEY = D.storeKey + ":state", ACTIVE_KEY = D.storeKey + ":active", RETURN_KEY = D.storeKey + ":return";
  let S = null, ME = null, LOCKED = false, ENTRY = { state: null, handle: null }, STARTED = false;
  /* R46: the fragment, read once on load and removed from the address before any request; page memory only */
  let FRAGMENT = {}, RECORD_READ = false;
  function readRecord() {
    try {
      const s = JSON.parse(local.get(D.storeKey) || "null");
      if (s && typeof s.t === "string" && s.t && (!s.e || s.e > Date.now())) return { t: s.t, e: Number(s.e) || 0, d: s.d === "own" ? "own" : "shared", w: typeof s.w === "string" ? s.w : "" };
    } catch { /* an unreadable record is none */ }
    return null;
  }
  function writeRecord(r) { BOOT_STALE = true; newEpoch(); frameDrop(); local.set(D.storeKey, JSON.stringify({ t: r.t, e: r.e || 0, d: r.d, w: r.w || "" })); local.del(STATE_KEY); }
  function clearRecord(why) { BOOT_STALE = true; newEpoch(); frameDrop(); if (why) local.set(STATE_KEY, why); else local.del(STATE_KEY); local.del(D.storeKey); }
  const working = () => ROUTE && frameOf(ROUTE.screen) === "working" && !ROUTE.root;
  /* R32: the path to return to, the address alone (never a query, a fragment or the token) */
  function keepReturn() { if (working()) tab.set(RETURN_KEY, win.location.pathname); }
  function takeReturn() { const r = tab.get(RETURN_KEY); tab.del(RETURN_KEY); return r && /^\/app(\/|$)/.test(r) ? r : "/app"; }
  /* The session is over (R3, R32, R33): the record cleared, the other tabs told why, and `front` drawn in that state. */
  function over(why) {
    if (!S) return;
    keepReturn();
    const handle = S.w || (ME && ME.handle) || null;
    /* a dialog still open over the screen answers no */
    if (REAUTH) { const r = REAUTH; REAUTH = null; r.resolve(false); }
    if (DIALOG) { const d = DIALOG; DIALOG = null; if (d.resolve) d.resolve(d.kind === "register" ? null : false); }
    OVERLAY_REFUSAL = "";
    S = null; ME = null; LOCKED = false; BAND = 0; stopIdle(); stopVersion();
    clearRecord(why);
    ENTRY = { state: why, handle };
    route();
  }

  /* The op client: the token only in the Authorization header (R3); a 401 to any request ends the session (R32); the
     plane's `SESSION_LOCKED` locks the page (R33). A request with no session, or for a screen drawn without one,
     carries no Authorization header and is sent only for a public op (R30, R45). Answers `{kind: "ok", value}`,
     `{kind: "refused", code, translation, fields, server}` (R13) or `{kind: "silent"}` (no answer). */
  /* R123 (fix round 5, E12; P9): one request per `(op, query, body)` per load. A read (an op `OPS` declares not mutating, or a call that says
     `read: true`: every read a screen's `reads` names, and the frame's `subscriptionsignin` state) identical to one still in flight, or answered during this load, is that
     one request: the second reader waits for it and is handed its own copy of the answer. A load is a `route()`; every act, every call of
     a mutating op, a change of the session record and a new route opens a new epoch, so an act's re-reads, a re-visit and a refresh still
     ask. A completed answer is shared only while the load is open (until the screen's first reads settle) and for 5 seconds at most. */
  let EPOCH = 0, LOADING = false;
  const SHARED = new Map(), LOAD_MS = 5000, READ_OPS = new Set(D.readOps);
  const newEpoch = () => { EPOCH++; SHARED.clear(); };
  function closeLoad() { LOADING = false; for (const [k, e] of [...SHARED]) if (e.done && !e.hold) SHARED.delete(k); }
  function copyOf(x) {
    const a = x.a;
    if (x.raw === null) return a;
    if (a.kind === "ok") { const json = JSON.parse(x.raw); return { kind: "ok", json, value: json && typeof json === "object" && "result" in json ? json.result : json }; }
    return Object.assign({}, a, { fields: JSON.parse(x.raw) });
  }
  /* R125 (G12b): `hold: true` keeps the request's answer for its one later reader, past the end of the load and the 5 seconds: the guide's marks
     are asked at the route's start and handed to `entered` when the route settles. The first reader to ask takes it, and it is then shared as any. */
  function call(op, req = {}) {
    const read = req.act !== true && (req.read === true || READ_OPS.has(op));
    if (!read) { newEpoch(); return send(op, req).finally(newEpoch); }
    if ((typeof req.bearer === "string" && req.bearer !== "") || req.bytes || req.raw !== undefined || typeof req.onEvent === "function") return send(op, req);
    const asked = Object.entries(req.query || {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
    const key = EPOCH + "|" + (req.public ? "p" : "s") + "|" + op + "|" + JSON.stringify([asked, req.body === undefined ? null : req.body]);
    const hit = SHARED.get(key);
    if (hit && (hit.hold || !hit.done || (LOADING && Date.now() - hit.at < LOAD_MS))) { hit.hold = false; return hit.snap.then(copyOf); }
    const entry = { done: false, at: 0, snap: null, hold: req.hold === true };
    entry.snap = send(op, req).then((a) => {
      /* the answer's own copy is taken before anyone is handed it, so a reader that changes what it was handed changes nobody else's */
      let raw = null;
      try { raw = a.kind === "ok" ? JSON.stringify(a.json) : a.kind === "refused" ? JSON.stringify(a.fields) : null; } catch { raw = null; }
      entry.done = true; entry.at = Date.now();
      if (!LOADING && !entry.hold && SHARED.get(key) === entry) SHARED.delete(key);
      return { a, raw };
    });
    SHARED.set(key, entry);
    return entry.snap.then((x) => x.a);
  }
  async function send(op, req = {}) {
    const own = typeof req.bearer === "string" && req.bearer !== "";
    /* R46: `unlock` is sent under the locked session's token, from whichever frame */
    const pub = !own && (!S || (!!req.public && op !== "unlock"));
    if (pub && !D.publicOps.includes(op)) return { kind: "refused", code: "NOT_SIGNED_IN", translation: null, fields: {} };
    const qs = new URLSearchParams();
    qs.set("op", op);
    for (const [k, v] of Object.entries(req.query || {})) if (v !== undefined && v !== null) qs.set(k, String(v));
    /* R33: a read the shell makes on its own timers is marked background, so the plane counts it as no activity */
    if (req.background) qs.set("background", "1");
    const init = { headers: {} };
    if (!pub) init.headers.Authorization = "Bearer " + (own ? req.bearer : S.t);
    if (req.raw !== undefined) { init.method = "POST"; init.body = req.raw; if (req.rawType) init.headers["content-type"] = req.rawType; }
    else if (req.body !== undefined) { init.method = "POST"; init.body = JSON.stringify(req.body); init.headers["content-type"] = "application/json"; }
    const held = S;
    let r;
    try { r = await win.fetch("/api/?" + qs.toString(), init); } catch { return { kind: "silent" }; }
    let j = null, read = false;
    if (r.status === 401 && !own && !pub) {
      /* R33: the store answers a locked session 401 with its own `SESSION_LOCKED` (admission R24); that session is locked, not ended, and falls to the lock below */
      try { j = await r.json(); } catch { j = null; }
      read = true;
      if (!(j && typeof j === "object" && (j.code === "SESSION_LOCKED" || j.reason === "SESSION_LOCKED"))) { if (S && S === held) over("ended"); return { kind: "silent" }; }
    }
    if (req.bytes) return { kind: "response", r };
    const type = r.headers && typeof r.headers.get === "function" ? String(r.headers.get("content-type") || "") : "";
    const server = r.status >= 500;
    const refusedOf = (o) => {
      /* R83: `coded` marks a refusal that answered with a code (`ok: false` with `code` or `reason`) */
      const a = { kind: "refused", code: String((o && (o.code || o.reason)) || r.status), coded: !!(o && (o.code || o.reason)), translation: o && typeof o.translation === "string" ? o.translation : null, fields: o || {}, server };
      if (a.code === "SESSION_LOCKED" && !own && !pub && !req.noLock && S === held) lock(false);
      return a;
    };
    if (/ndjson/i.test(type)) {
      /* R21 (K3011): a streamed answer (application/x-ndjson, `agent-worker` R54) is its list of parsed events, the
         answer the last; a line that does not parse is no answer */
      let events = null;
      const lineOf = (l) => JSON.parse(l);
      try {
        if (typeof req.onEvent === "function" && r.body && typeof r.body.getReader === "function") {
          /* R78 (N1195, DEC-298): the body read as it arrives; each complete line parsed and handed to `onEvent` at once and
             in order, the page redrawing the screen that asked; the whole list still answered, the answer the last event */
          const reader = r.body.getReader(), dec = new TextDecoder();
          events = [];
          let buf = "";
          const take = (l) => { if (!l.trim()) return; const ev = lineOf(l); events.push(ev); try { req.onEvent(ev); } catch { /* a screen's own handler never stops the stream */ } draw(); };
          for (;;) {
            const { done, value } = await reader.read();
            if (value) buf += dec.decode(value, { stream: !done });
            const cut = buf.lastIndexOf("\n");
            if (cut >= 0) { const head = buf.slice(0, cut); buf = buf.slice(cut + 1); for (const l of head.split("\n")) take(l); }
            if (done) { if (buf.trim()) take(buf); break; }
          }
        } else events = String(await r.text()).split("\n").filter((l) => l.trim()).map(lineOf);
      } catch { events = null; }
      if (!events || !events.length) return { kind: "silent" };
      const last = events[events.length - 1];
      if (!r.ok || (last && typeof last === "object" && last.ok === false)) return refusedOf(last && typeof last === "object" ? last : null);
      return { kind: "ok", value: events, json: events };
    }
    if (!read) { try { j = await r.json(); } catch { j = null; } }
    if (j && typeof j === "object" && j.ok === false) return refusedOf(j);
    const value = j && typeof j === "object" && "result" in j ? j.result : j;
    if (value && typeof value === "object" && value.ok === false) return refusedOf(value);
    if (!r.ok) return j && typeof j === "object" ? refusedOf(j) : { kind: "refused", code: String(r.status), translation: null, fields: {}, server };
    if (j === null) return { kind: "silent" };
    return { kind: "ok", value, json: j };
  }
  const unreachable = (a) => a.kind === "silent" || (a.kind === "refused" && a.server);

  /* ---------- the act gate (R12, R30, R45) and the weights (R11) ---------- */
  const ADMIN = new Set(D.adminActs);
  const SESSION = { member: new Set(D.sessionOps.member), admin: new Set(D.sessionOps.admin) };
  /* R100: an act the page does alone (`op-declarations` R76), of the screen the table names it for: drawn to any session and to
     none, never an op (no weight, no friction, no phone hold, no request) */
  const browserAct = (op, inst) => !!(inst && inst.spec && inst.spec.id && Object.hasOwn(D.browserActs, op) && D.browserActs[op] === inst.spec.id);
  function can(op, inst) {
    if (browserAct(op, inst)) return true;
    if (!(op in D.ops)) return false;
    /* R30, R45: a screen drawn without a session offers only the public ops */
    if (inst && inst.pub) return D.publicOps.includes(op) || (op === "unlock" && !!S);
    if (!ME) return false;
    const need = D.needs[op];
    const caps = Array.isArray(ME.capabilities) ? ME.capabilities : [];
    if (need !== undefined && need !== null && !caps.includes(need)) return false;
    const set = ME.tokenClass === "admin" ? SESSION.admin : SESSION.member;
    /* K4237: a read is served to any session whose class its op lists; `SESSION_OPS` gates mutating ops alone */
    const rc = D.readClasses[op];
    if (!set.has(op) && !(rc === null || (Array.isArray(rc) && rc.includes(ME.tokenClass)))) return false;
    if (ADMIN.has(op) && ME.administer !== true) return false;
    return true;
  }
  const WEIGHTS = ["reversible", "reasoned", "terminal", "signed", "irreversible"];
  const weightOf = (op) => { const r = D.rungs[op]; const n = r === "attested" ? "signed" : r; return n === "none" || WEIGHTS.includes(n) ? n : "reasoned"; };

  /* ---------- an act button's answer to the press (R74) and the Sounds setting ---------- */
  /* act key -> {busy, done, lock, gen}: `busy` while the request is out, `done` after success (cleared after about two
     seconds, or `lock` it: disabled until the screen is redrawn from a read, `gen` the read that redraws it) */
  const ACTSTATE = new Map();
  let SOUNDS = local.get("cs-sounds") === "on", AUDIO = null;
  function say(text) { const el = doc.getElementById("cs-live"); if (el) el.textContent = text || ""; }
  /* R74 (DEC-280, "C"): with Sounds on, a press plays a soft click and a refusal drawn beside an act a low tone, both made in
     the page (no sound file, no other origin, R2); with it off nothing sounds */
  function sound(kind) {
    if (!SOUNDS) return;
    try {
      const Ctx = win.AudioContext || win.webkitAudioContext;
      if (!Ctx) return;
      AUDIO = AUDIO || new Ctx();
      const osc = AUDIO.createOscillator(), gain = AUDIO.createGain();
      const low = kind === "refused";
      osc.type = "sine";
      osc.frequency.value = low ? 180 : 880;
      gain.gain.value = low ? 0.08 : 0.04;
      osc.connect(gain); gain.connect(AUDIO.destination);
      osc.start();
      osc.stop(AUDIO.currentTime + (low ? 0.25 : 0.05));
    } catch { /* no audio: nothing sounds */ }
  }
  function setSounds(on) { SOUNDS = !!on; local.set("cs-sounds", SOUNDS ? "on" : "off"); }

  /* ---------- explanation level (R17), appearance (R18), the rail's width (R26) ---------- */
  let LEVEL = local.get("cs-level") === "pause" ? "pause" : "prompt";
  let LEVEL_INFO = null;
  let THEME = ["light", "dark"].includes(local.get("cs-theme")) ? local.get("cs-theme") : "device";
  const RAIL_DEFAULT = 184;
  const clampW = (n) => Math.max(64, Math.min(320, Math.round(n)));
  let RAILW = (() => { const n = Number(local.get("cs-railw")); return Number.isFinite(n) && n >= 64 && n <= 320 ? n : RAIL_DEFAULT; })();
  function applyTheme() {
    const root = doc.documentElement;
    if (THEME === "device") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", THEME);
  }
  async function setLevel(v, asked) {
    LEVEL = v === "pause" ? "pause" : "prompt";
    local.set("cs-level", LEVEL);
    const body = asked ? { level: LEVEL, asked: true } : { level: LEVEL };
    frameForget("infolevel");
    if (can("infolevelset")) {
      const a = await call("infolevelset", { body });
      if (a.kind === "ok" && asked) LEVEL_INFO = Object.assign({}, LEVEL_INFO || {}, { asked_at: "now" });
    }
    draw();
  }
  function setTheme(v) { THEME = ["light", "dark"].includes(v) ? v : "device"; local.set("cs-theme", THEME); applyTheme(); draw(); }

  /* ---------- the phone width ---------- */
  const mq = typeof win.matchMedia === "function" ? win.matchMedia("(max-width: " + D.phoneWidth + "px)") : null;
  const phone = () => !!(mq && mq.matches);

  /* ---------- the frame's reads ---------- */
  /* R60 (fix round 2, C80): the team's name as `groupidentity` answered (`GROUP_KNOWN` once it has answered), else the last one this
     device was shown (public information, kept under `cs-group` like the other device conveniences), else nothing */
  const GROUP_KEY = "cs-group";
  let GROUP_KNOWN = false, LAST_GROUP = (() => { const v = local.get(GROUP_KEY); return typeof v === "string" && v.trim() ? v : null; })();
  /* R96 (fix round 3, C70): the count a screen reports with `cs.band(n)` (the vouch rows it counts), added to the queue's for the number the
     masthead and the rail draw; page memory only */
  let BAND = 0;
  let GROUP = null, TODO = null, QUEUE_COUNTS = null, REACHABLE = false, DOCK = false, ASK_LEVEL = false, KEEP_LATER = false, BOOT = null, BOOT_READ = false;
  const screenOf = (id) => SCREENS.find((s) => s.id === id) || null;
  /* R111 (fix round 2, C94): the members as `memberlist` names them, id to handle, so a screen names a member by handle and never by
     id; read when a screen first asks for a name not held, then at most every two minutes (a background read, R33) */
  const MEMBERS = new Map();
  let MEMBERS_AT = 0;
  /* the handle a member id (or a stamp, `{member_id|member|id|by|handle}`) names, else null; the roster is read only when a screen first
     needs a name it does not hold (a screen that names no member sends no read), and again after two minutes; the screen redraws
     when it answers */
  function knownHandle(id) {
    const raw = id && typeof id === "object" ? (id.member_id ?? id.member ?? id.id ?? id.by ?? id.handle) : id;
    const key = String(raw == null ? "" : raw).trim();
    if (key) {
      if (MEMBERS.has(key)) return MEMBERS.get(key);
      if (ME && key === ME.member && typeof ME.handle === "string" && ME.handle) return ME.handle;
      for (const h of MEMBERS.values()) if (h === key) return h;
      if (ME && key === ME.handle) return key;
    }
    if (ME && Date.now() - MEMBERS_AT > 120000) loadMembers();
    return null;
  }
  const noteMember = (id, handle) => { if (typeof id === "string" && id && typeof handle === "string" && handle.trim()) MEMBERS.set(id, handle.trim()); };
  async function loadMembers() {
    MEMBERS_AT = Date.now();
    const a = await call("memberlist", { background: true });
    if (!ME || a.kind !== "ok" || !a.value || !Array.isArray(a.value.members)) return;
    for (const m of a.value.members) if (m && typeof m === "object") noteMember(String(m.member_id ?? m.member ?? m.id ?? ""), m.handle);
    draw();
  }

  /* ---------- screen instances: reads, states, acts ---------- */
  let MAIN = null, DOCKI = null, GUIDEI = null, ROUTE = null, RING = null, UNREACHED = false;
  function emptyOf(spec, v) {
    if (spec && typeof spec.empty === "function") return !!spec.empty(v);
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") for (const k of ["items", "results", "list", "rows", "words"]) if (Array.isArray(v[k])) return v[k].length === 0;
    return false;
  }
  /* R39 (N1001): a refusal's trace, drawn as a short reference beside its words and kept nowhere */
  const traceOf = (a) => (a && a.fields && typeof a.fields.trace === "string" && a.fields.trace
    ? ' <span class="muted">' + w("refusal.reference", { ref: a.fields.trace.slice(0, 8) }) + "</span>" : "");
  /* R13: `refusal.<code>` (or the screen's own key for the code) when held; else the answer's translation. R61: a refusal
     with its own words is drawn as those words alone; one without is "could not be read" with R39's reference, naming no
     code. Answers `{words, own}`. */
  function refusalOf(a, own, inst) {
    /* R21 (K3002): a screen's own word for the code, or its own function `(refusal, cs)` → HTML */
    if (own && typeof own[a.code] === "function") {
      try { return { words: String(own[a.code]({ code: a.code, translation: a.translation, ...(a.fields || {}) }, inst ? kit(inst) : null)) + traceOf(a), own: true }; } catch { /* falls to the words below */ }
    }
    const key = own && typeof own[a.code] === "string" ? own[a.code] : "refusal." + a.code;
    if (has(key)) return { words: w(key, a.fields || {}) + traceOf(a), own: true };
    if (a.translation) return { words: esc(a.translation) + traceOf(a), own: true };
    /* R83 (N1192): a refusal that answered with a code, with neither a word nor a translation, is drawn as `refusal.uncatalogued`
       followed by the code as the act gave it and R39's reference: the one place a code is drawn to a member. `shell.unread`
       is for an answer that was no refusal at all (no answer, a 5xx without a code). */
    if (a.coded) return { words: w("refusal.uncatalogued") + " <code>" + esc(a.code) + "</code>" + traceOf(a), own: true };
    return { words: w("shell.unread") + traceOf(a), own: false };
  }
  const refusalWords = (a, own, inst) => refusalOf(a, own, inst).words;
  function outcome(spec, a, inst) {
    if (a.kind === "ok") return emptyOf(spec, a.value) ? { state: "empty", value: a.value, refusal: null } : { state: "ok", value: a.value, refusal: null };
    if (a.kind === "refused") { const r = refusalOf(a, spec && spec.refusals, inst || null); return { state: "failed", value: null, refusal: { code: a.code, words: r.words, own: r.own } }; }
    return { state: "failed", value: null, refusal: { code: null, words: w("shell.unread"), own: false } };
  }
  /* R46: the session as a screen sees it: `none`, `signedout`, `ended`, `locked` or `live`, with the handle */
  function sessionView() {
    if (S && !LOCKED && ENTRY.state !== "locked") return { state: "live", handle: S.w || (ME && ME.handle) || null };
    if (ENTRY.state) return { state: ENTRY.state, handle: ENTRY.handle };
    if (S && LOCKED) return { state: "locked", handle: S.w || null };
    return { state: "none", handle: null };
  }
  function instance(spec, subject, key, serves, project) {
    const inst = { key, spec, subject, serves: serves || null, data: {}, ui: {}, acts: [], binds: [], gen: 0, unavail: null, timers: [], fills: {}, labels: {}, stash: null, retry: null, images: {}, areas: {}, words: {}, fresh: {}, refreshT: {}, ro: false, sig: {}, typing: {}, typingT: {} };
    inst.view = key === "g"
      /* K3143: the guide's one view for the page's life: `{ui, me, reachable, screen, subject}` */
      ? { ui: inst.ui, get me() { return ME; }, get reachable() { return REACHABLE; }, get screen() { return ROUTE ? ROUTE.screen : null; },
        get subject() { return ROUTE ? ROUTE.subject : null; }, get project() { return ROUTE && ROUTE.project ? ROUTE.project : null; }, parts: spec.parts || {}, origin: win.location.origin }
      : { subject, project: typeof project === "string" && project ? project : null, data: inst.data, ui: inst.ui, get me() { return ME; }, get reachable() { return REACHABLE; }, serves: inst.serves,
        get session() { return sessionView(); }, get fragment() { return Object.assign({}, FRAGMENT); },
        parts: spec.parts || {}, origin: win.location.origin };
    /* R30, R45: a screen of the public or published frame is drawn without a session, whatever the record holds */
    Object.defineProperty(inst, "pub", { get: () => key !== "g" && (sessionless(spec.id) || !S) });
    return inst;
  }
  /* R61: the absence codes, and those a screen lists as its own (`ABSENT_CODES`) */
  const ABSENCE = new RegExp(D.absence);
  const absent = (inst, code) => ABSENCE.test(code) || (Array.isArray(inst.spec.ABSENT_CODES) && inst.spec.ABSENT_CODES.includes(code));
  /* R61: a screen whose reads name a subject (`subject: true`), opened with none */
  const subjectless = (inst, specs) => (inst.subject === null || inst.subject === undefined || inst.subject === "") && Object.values(specs).some((x) => x && x.subject);
  /* R90 (K4072): a choice or checks that redraws re-runs the screen's `reads` with the new value in page memory: a read whose
     request changed is read once more (with the new query); with none changed the redraw sends nothing */
  const sigOf = (sp) => JSON.stringify([sp.op, sp.query || null, sp.body || null]);
  const readsOf = (inst) => { try { return inst.spec.reads ? inst.spec.reads(inst.view) || {} : {}; } catch { return {}; } };
  /* R113: the reads whose request differs from the one last sent for them */
  const changedReads = (inst) => Object.entries(readsOf(inst)).filter(([n, sp]) => inst.sig[n] !== sigOf(sp)).map(([n]) => n);
  function rereadChanged(inst, more) {
    const names = [...new Set(changedReads(inst).concat(more || []))];
    if (names.length && (inst.pub || ME)) return readAll(inst, names);
    draw();
  }
  function redrawAfter(inst, name, value) {
    inst.ui[name] = value;
    rereadChanged(inst);
  }
  const live = (inst) => inst === MAIN || inst === DOCKI || inst === GUIDEI;
  /* R122 (P9): `bootstrap` is asked once per page load (`start`); a screen's own read of it (`{op: "bootstrap"}`, no query, no body) is answered from
     that one answer, waiting for it if it is still out. A change of session or a successful act makes it stale, and a read after either asks again
     (a screen that re-reads after `claim` sees the new state); a first answer that was no answer is asked for again. */
  let BOOT_CALL = null, BOOT_STALE = false, BOOT_ARGS = null;
  async function readOne(spec, inst, background) {
    if (spec.op === "bootstrap" && !spec.query && !spec.body && !BOOT_STALE && startBoot()) {
      const b = await BOOT_CALL;
      if (b.kind === "ok" && !BOOT_STALE) return b;
      BOOT_STALE = true;
    }
    return call(spec.op, { query: spec.query, body: spec.body, public: inst.pub, background, read: true });
  }
  /* R96, R93 (P9): the frame's number is `queue`'s count (`loadFrame`); the open list a screen reads (at most a `limit` and a `sort`), when the
     answer is the whole list (not cut by its limit), also gives the frame the three kinds for its explanation and keeps its number equal to the
     list; a cut list, or a read of anything else the queue holds (muted, answered, aside, a project's), gives neither */
  function noteQueue(spec, a) {
    if (spec.op !== "queue" || a.kind !== "ok" || !a.value || !Array.isArray(a.value.items) || a.value.truncated === true) return;
    if (!Object.keys(spec.query || {}).every((k) => k === "limit" || k === "sort")) return;
    const count = (c) => a.value.items.filter((x) => x && x.class === c).length;
    QUEUE_COUNTS = { todo: count("OBLIGATION"), noticed: count("FINDING"), status: count("CONDITION") };
    TODO = QUEUE_COUNTS.todo + QUEUE_COUNTS.noticed + QUEUE_COUNTS.status;
    QUEUE_NOTED = true;
  }
  /* R7, R93, R96 (E12; K4530): the number the masthead and the rail's Queue place draw is the queue's count of the member's open items (the design's
     sum of the three kinds). When the screen being loaded reads the whole open list (`queue` with at most a `limit` and a `sort`), its answer gives the
     number and the three kinds (`noteQueue`) and the frame sends no read of its own; the frame asks `queue` with `count: true`, once, in the background
     (R33), when the screen reads no such list, or when its answer was cut, refused or not given. */
  let COUNT_DUE = false, QUEUE_NOTED = false;
  const openList = (sp) => !!(sp && sp.op === "queue" && sp.body === undefined && Object.keys(sp.query || {}).every((k) => k === "limit" || k === "sort"));
  function countQueue(inst, reads) {
    COUNT_DUE = false; QUEUE_NOTED = false;
    const ask = () => call("queue", { query: { count: true }, background: true }).then((q) => {
      if (ME && q.kind === "ok" && q.value && typeof q.value.count === "number") { TODO = q.value.count; draw(); }
    });
    if (!inst || !Object.values(readsOf(inst)).some(openList)) return ask();
    return reads.then(() => { if (ME && !QUEUE_NOTED) return ask(); });
  }
  async function readAll(inst, names, background) {
    let specs = {};
    try { specs = inst.spec.reads ? inst.spec.reads(inst.view) || {} : {}; } catch { specs = {}; }
    const gen = ++inst.gen;
    /* R113: a partial re-read must not discard the answers of a full read still in flight: only a newer full read does */
    if (!names) inst.fullGen = gen;
    if (inst.key === "m" && subjectless(inst, specs)) { inst.unavail = "nothing"; return draw(); }
    const todo = Object.entries(specs).filter(([n]) => !names || names.includes(n));
    /* R113: a read's request is remembered only when it is read, so a read left alone is compared with the last request it was sent */
    for (const [n, sp] of todo) inst.sig[n] = sigOf(sp);
    for (const [n] of todo) if (!inst.data[n] || !names) inst.data[n] = { state: "loading", value: null, refusal: null };
    if (!names && !background) inst.unavail = null;
    draw();
    await Promise.all(todo.map(async ([n, spec]) => {
      const a = await readOne(spec, inst, background);
      if (!names && gen !== inst.fullGen) return;
      inst.data[n] = outcome(spec, a, inst);
      noteQueue(spec, a);
      noteFrame(spec, a);
      /* R93: a read marked `refresh: true` is re-read every 45 seconds; its answer is stamped for `cs.fresh()` */
      if (spec.refresh === true) { inst.fresh[n] = a.kind === "ok" ? Date.now() : 0; armRefresh(inst, n); }
      /* R74: a locked act is enabled again once a read started after it has redrawn the screen */
      for (const [k, v] of ACTSTATE) if (v.lock && k.startsWith(inst.key + "|") && gen >= v.gen) ACTSTATE.delete(k);
      /* R9, R35: the subject's read decides whether the screen can be drawn at all */
      if (spec.subject) {
        const was = inst.unavail;
        if (unreachable(a)) inst.unavail = "unreachable";
        else if (a.kind === "refused" && D.notYours.includes(a.code)) inst.unavail = "notyours";
        else if (inst.data[n].state === "empty" || (a.kind === "refused" && absent(inst, a.code))) inst.unavail = "nothing";
        else inst.unavail = null;
        if (inst.unavail === "unreachable") retryLater(inst);
        if (was === "unreachable" && !inst.unavail && inst.stash) { inst.pending = inst.stash; inst.stash = null; }
      }
      draw();
    }));
  }
  /* R93 (A10): a read a screen marks `refresh: true` is read again by the shell every 45 seconds, as a background read (R33),
     while the page is visible, no lock, password, signer or other overlay is open, no act of the screen has its reason field or
     confirmation open, and the member's focus is not in a text field; the screen redraws in place (draw keeps focus, scroll,
     open panels, picks and typed text); a re-read that fails keeps the list from the last answer; the timers go with the screen */
  function armRefresh(inst, n) {
    if (inst.refreshT[n] !== undefined) clearTimeout(inst.refreshT[n]);
    inst.refreshT[n] = setTimeout(() => refreshNow(inst, n), REFRESH_MS);
    /* the line expires on its own: a redraw once the answer is older than `list.fresh` may claim */
    if (inst.refreshT["fresh:" + n] !== undefined) clearTimeout(inst.refreshT["fresh:" + n]);
    inst.refreshT["fresh:" + n] = setTimeout(() => {
      if (!live(inst) || !inst.fresh[n] || Date.now() - inst.fresh[n] <= FRESH_MS) return;
      /* patched out in place, never redrawn: a redraw would empty an act's open reason field */
      for (const el of doc.getElementById("cs-root").querySelectorAll("[data-fresh]")) if (el.parentNode) el.parentNode.removeChild(el);
    }, FRESH_MS + 1000);
  }
  const typingNow = () => {
    const el = doc.activeElement, root = doc.getElementById("cs-root");
    if (!el || !root || !root.contains(el)) return false;
    return el.localName === "textarea" || (el.localName === "input" && !["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"].includes(el.type));
  };
  const formOpen = () => { const root = doc.getElementById("cs-root"); return !!(root.querySelector(".mk-slot .cs-reason") || root.querySelector(".mk-slot .cs-dialog")); };
  async function refreshNow(inst, n) {
    delete inst.refreshT[n];
    if (!live(inst) || (inst.unavail && inst.unavail !== "nothing")) return;
    if (doc.hidden === true || LOCKED || REAUTH || DIALOG || formOpen() || typingNow()) { inst.refreshT[n] = setTimeout(() => refreshNow(inst, n), REFRESH_MS); return; }
    let spec = null;
    try { spec = (inst.spec.reads ? inst.spec.reads(inst.view) || {} : {})[n] || null; } catch { spec = null; }
    if (!spec || spec.refresh !== true) return;
    const a = await call(spec.op, { query: spec.query, body: spec.body, public: inst.pub, background: true, read: true });
    if (!live(inst)) return;
    if (a.kind === "ok") { inst.data[n] = outcome(spec, a, inst); inst.fresh[n] = Date.now(); noteQueue(spec, a); } else inst.fresh[n] = 0;
    armRefresh(inst, n);
    draw();
  }
  /* R35: an unreachable screen is tried again every 30 seconds, in the background, while it is the one shown */
  function retryLater(inst) {
    if (inst.retry !== null) return;
    inst.retry = setTimeout(() => { inst.retry = null; if (live(inst)) readAll(inst, null, true); }, D.retry);
  }

  /* ---------- the kit `cs` (draft §2.2 Suggestions; the screen contract, R21) ---------- */
  const I = (n) => '<svg class="i" aria-hidden="true"><use href="' + D.icons + "#i-" + n + '"/></svg>';
  const tipAttr = (tip, level) => (tip ? ' data-level="' + level + '" data-tip="' + esc(tip) + '"' : "");
  const kw = (key) => (has(key) ? w(key) : "");
  const MARK = {
    kind: { cls: "cs-kind", attr: "data-kind", icon: (v) => v },
    gap: { cls: "cs-gap", attr: "data-gap", icon: (v) => v },
    origin: { cls: "cs-origin", attr: "data-origin", icon: (v) => v },
    hint: { cls: "cs-hint", attr: null, icon: () => "hint" },
    hunch: { cls: "cs-hunch", attr: null, icon: () => "hunch" },
    outward: { cls: "cs-tag-outward", attr: null, icon: () => "outward" },
    path: { cls: "cs-path", attr: null, icon: null },
    tag: { cls: "cs-kind", attr: null, icon: null },
    scale: { cls: "cs-grade", attr: "data-scale", icon: (v) => v },
  };
  /* R95: the kinds `cs.stateChip` draws; R93: a refreshing read is fresh for 90 seconds, re-read every 45 */
  const STATE_KINDS = ["review", "reviewed", "retired", "open", "concluded", "published", "waiting", "flagged", "watched",
    "deferred", "dismissed", "divided", "planned", "active", "resolved", "abandoned"];
  const FRESH_MS = 90 * 1000, REFRESH_MS = 45 * 1000;
  const wordOrData = (o) => (o && typeof o === "object" ? (typeof o.key === "string" ? w(o.key, o.fills) : esc(o.text)) : typeof o === "string" ? w(o) : "");
  function kit(inst, bg) {
    const cs = {
      w, esc, date,
      get me() { return ME; },
      get reachable() { return REACHABLE; },
      /* R111: the handle of the member an id (or a stamp, `{member_id|member|id|by|handle}`) names, the founder included; an id with no
         handle known, or none, a plain word by key (the founder's own when it is her id), never the id. Text, for a screen to place
         through `cs.w` fills or `cs.esc`. */
      memberName(id) {
        const h = knownHandle(id);
        if (h) return h;
        const raw = id && typeof id === "object" ? (id.member_id ?? id.member ?? id.id ?? id.by ?? id.handle) : id;
        return textOf(w(String(raw == null ? "" : raw).trim() === "admin" ? "member.founder.unnamed" : "shell.card.member"));
      },
      /* R111 (fix round 3, C94): the address of the member an id names, by handle (`/app/members/<handle>`), the founder included; an id
         with no handle known, the members list, never the id */
      memberHref(id) {
        const h = knownHandle(id);
        return h ? hrefOf("members", h) : hrefOf("members");
      },
      /* R96 (fix round 3, C70): the count of the band a screen draws (the vouch rows), added to the queue's in the frame's number */
      band(n) {
        const k = Math.max(0, Math.floor(Number(n)) || 0);
        if (k !== BAND) { BAND = k; Promise.resolve().then(() => draw()); }
        return "";
      },
      /* the kit's load-key-file helper (D3; screens-settings, screens-publish): the text of the file chosen in the input `inputId`, or a
         refusal in a word by key (none chosen, unreadable, empty); it sends nothing */
      async keyFile(inputId) {
        const el = doc.getElementById(String(inputId));
        const f = el && el.files && el.files[0] ? el.files[0] : null;
        if (!f) return { ok: false, word: "shell.keyfile.none" };
        let t;
        try { t = typeof f.text === "function" ? await f.text() : null; } catch { t = null; }
        if (typeof t !== "string") return { ok: false, word: "shell.keyfile.unreadable" };
        return t.trim() ? { ok: true, text: t } : { ok: false, word: "shell.keyfile.empty" };
      },
      can: (op) => can(op, inst),
      level: () => LEVEL,
      setLevel: (v) => setLevel(v),
      theme: () => THEME,
      setTheme: (v) => setTheme(v),
      go: (screen, subject) => navigate(hrefOf(screen, subject)),
      now: () => Date.now(),
      /* R21 (K3002): the lowercase hex SHA-256 of the text's UTF-8 bytes */
      async digest(t) {
        const buf = await win.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(t)));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      },
      /* R21 (K2998): one op, its parsed answer (null when none came); `bearer` replaces the session for this request only;
         R33: a call made from `cs.later` is background */
      async call(op, o = {}) {
        const a = await call(op, { query: o.query, body: o.body, raw: o.raw, rawType: o.rawType, bearer: o.bearer, public: inst.pub, background: !!(bg || o.background), onEvent: o.onEvent });
        return a.kind === "ok" ? a.json : a.kind === "refused" ? a.fields : null;
      },
      /* R21 (K2999): a byte answer handed to the browser as a file, its object address released once the download starts */
      async download(op, o = {}) {
        const a = await call(op, { query: o.query, body: o.body, bytes: true, public: inst.pub });
        if (a.kind !== "response") return { ok: false, answer: null };
        const r = a.r;
        const type = r.headers && r.headers.get ? r.headers.get("content-type") || "" : "";
        if (!r.ok || /json/i.test(type)) { let j = null; try { j = await r.json(); } catch { j = null; } return { ok: false, answer: j }; }
        const blob = await r.blob();
        /* R98 (A28): with `verify`, the bytes are hashed here before any file is made; a difference saves nothing */
        if (typeof o.verify === "string" && o.verify) {
          const got = Array.from(new Uint8Array(await win.crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))).map((b) => b.toString(16).padStart(2, "0")).join("");
          const expected = o.verify.toLowerCase();
          if (got !== expected) return { ok: false, answer: { code: "DIGEST_MISMATCH", expected, got } };
        }
        saveFile(blob, o.name || "");
        return { ok: true, answer: { type, size: blob.size } };
      },
      set: (name, value) => { inst.ui[name] = value; draw(); },
      value(id) {
        /* R91: a words control answers the text and extents of the units selected, in order; null when none */
        if (Object.hasOwn(inst.words, id)) {
          const st = inst.words[id], on = new Set(st.sel);
          const picked = (st.units || []).filter((u) => on.has(u.extent));
          return picked.length ? { text: picked.map((u) => u.text).join(" "), extents: picked.map((u) => u.extent) } : null;
        }
        /* R49: an areas control answers its rectangles in the image's pixels */
        if (Object.hasOwn(inst.areas, id)) return inst.areas[id].map((r) => ({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }));
        const el = doc.getElementById(id);
        if (!el) return null;
        if (el.tagName === "FIELDSET") return Array.from(el.querySelectorAll("input")).filter((i) => i.checked).map((i) => i.value);
        if (el.type === "checkbox" || el.type === "radio") return !!el.checked;
        return el.value;
      },
      /* R27 (K3014): a field the screen drew set to `value` over what was typed there, kept by later redraws */
      fill(id, value, o = {}) {
        const el = doc.getElementById(id);
        const owner = inst.key === "g" ? MAIN || inst : inst;
        /* K3143: a draft's label, drawn beside the field as `field`'s draft label is */
        if (o && o.label) owner.labels[id] = o.label; else delete owner.labels[id];
        if (el && !(el.type === "file")) { if (el.type === "checkbox" || el.type === "radio") el.checked = !!value; else el.value = String(value == null ? "" : value); draw(); }
        else owner.fills[id] = value;
      },
      /* K3143: the text field the control for `op` sends: the nearest textarea, else text input, before the control
         inside its enclosing section or row panel; null when none */
      fieldOf(op) {
        const main = doc.getElementById("cs-main");
        const ctl = main ? main.querySelector('[data-act="' + String(op).replace(/"/g, "") + '"]') : null;
        if (!ctl) return null;
        const scope = ctl.closest("tr.cs-panel") || ctl.closest("section") || main;
        let best = null;
        for (const el of scope.querySelectorAll("textarea, input")) {
          if (el.localName === "input" && el.type !== "text") continue;
          if (!el.id) continue;
          if (precedes(el, ctl)) best = el.localName === "textarea" || !best || best.localName !== "textarea" ? el : best;
        }
        return best ? best.id : null;
      },
      /* K3143: the device's own note under `cs-guide:`, wrapped as R26's (an unreadable storage answers null) */
      kept: (k) => local.get("cs-guide:" + String(k)),
      keep: (k, v) => { if (v === null || v === undefined) local.del("cs-guide:" + String(k)); else local.set("cs-guide:" + String(k), String(v)); },
      /* R27 (K3013): `fn(cs, view)` once after `ms` on the page's clock, cancelled when the member leaves the screen or
         the page; the calls it makes are background (R33) */
      later(ms, fn) {
        const t = setTimeout(() => {
          inst.timers = inst.timers.filter((x) => x !== t);
          if (!live(inst) || typeof fn !== "function") return;
          try { fn(kit(inst, true), inst.view); } catch { /* a screen's own timer never stops the shell */ }
        }, Math.max(0, Number(ms) || 0));
        inst.timers.push(t);
        return t;
      },
      file(id) { const el = doc.getElementById(id); return el && el.files && el.files[0] ? el.files[0] : null; },
      /* R10: a read in one of four states; `inner(value)` draws its data */
      state(r, inner, o) {
        if (typeof r === "string" && inner && typeof inner === "object" && typeof o === "function") { const f = o; o = {}; inner = f; }
        if (typeof r === "string") r = inst.data[r];
        o = o || {};
        if (!r || r.state === "loading") return '<p class="cs-state" data-state="loading" role="status"><span class="bar" aria-hidden="true"></span>' + w("state.loading") + "</p>";
        /* R61: a refusal's own words alone; without words, "could not be read", naming no code */
        if (r.state === "failed") return '<p class="cs-state" data-state="failed" role="alert">' + (r.refusal && r.refusal.words ? r.refusal.words : w("shell.unread")) + "</p>";
        if (r.state === "empty") return '<p class="cs-state" data-state="empty">' + w(o.empty || "state.empty") + "</p>";
        return typeof inner === "function" ? inner(r.value) : "";
      },
      /* R11, R12: the act's button, gated, labeled, weighted; "" when the session may not do it */
      act(op, o = {}) {
        const spec = (inst.spec.acts || []).find((a) => a.op === op);
        if (!spec || !can(op, inst)) return "";
        const browser = browserAct(op, inst);
        const weight = browser ? "none" : weightOf(op);
        /* R100: the table holds a browser act's rows under the registry's owed name, `act.owed_<act>.label.<screen>` and `.does` */
        const base = browser ? "act.owed_" + op : "act." + op;
        const label = w(o.label || spec.label || base + ".label." + (inst.spec.id || "guide"), o.fills);
        /* R90: where the screen draws the button, `act.<op>.here.<place>` explains it in place of `.does`; a `here` word the
           table lacks falls back to `.does`, and no empty explanation is drawn */
        const hereKey = typeof o.here === "string" && o.here ? "act." + op + ".here." + o.here : "";
        const doesKey = hereKey && has(hereKey) ? hereKey : base + ".does";
        const does = has(doesKey) ? w(doesKey) : "";
        const outward = !!(spec.outward || o.outward);
        /* R11 (DEC-181), R50 (K3156): a signed or irreversible act, or any weighed act `op-grades.phoneOf` answers false for,
         is held at the phone width */
        if (phone() && (weight === "signed" || weight === "irreversible" || D.larger.includes(op)))
          return '<div class="cs-reason" data-phone-act="' + esc(op) + '"><b>' + label + "</b>" + (does ? "<p>" + does + "</p>" : "") + "<p>" + w("shell.phone.larger") + "</p></div>";
        const key = inst.key + "|" + op + "|" + JSON.stringify(o.data || {});
        /* R107: an act drawn with no weight but carrying the Reasoned mark, and listed in `D.markAsks`, asks its reason before it runs */
        const asks = weight === "none" && D.marks[op] === "reasoned" && D.markAsks.includes(op) && !inst.pub && !browser;
        const idx = inst.acts.push({ op, spec, data: o.data || {}, table: inst.holding || o.table || null, key, weight, outward, browser, asks, here: hereKey && has(hereKey) ? hereKey : null }) - 1;
        const data = Object.entries(o.data || {}).map(([k, v]) => " data-" + k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()) + '="' + esc(v) + '"').join("");
        /* R64 (`op-grades` R42): an act drawn with no weight carries the design kit's mark, as a mark and its explanation
           only; its friction stays R11's (it runs on press). R77 (U2c; DEC-295): only an act above Reversible draws dots and a
           weight name, on its button and in its explanation; public pages carry no weight marks (R30, R84). */
        const mark = weight === "none" && WEIGHTS.includes(D.marks[op]) ? D.marks[op] : null;
        const shown = mark || weight;
        const weighed = shown !== "none" && shown !== "reversible" && !inst.pub && !D.publicPages.includes(inst.spec.id);
        const pips = '<span class="cs-pips" aria-hidden="true">' + [1, 2, 3, 4, 5].map((i) => "<i" + (i <= WEIGHTS.indexOf(shown) + 1 ? ' class="on"' : "") + "></i>").join("") + "</span>";
        /* R76: an explanation never repeats the button's label: it is the act's own sentence (the label leading it, as the
           design draws it), and an act with none draws none of its own */
        const tip = (does ? "<b>" + label + "</b>: " + does : "") + (weighed ? '<span class="why">' + w("weight." + shown + ".means") + "</span>" : "")
          + (outward ? '<span class="why">' + w("mark.outward.means") + "</span>" : "");
        /* R74 (U2): the button answers the press: busy while the request is out, done after, locked when the act cannot be
           repeated */
        const st = ACTSTATE.get(key) || {};
        return '<span class="mk-actwrap"><button type="button" class="cs-btn"' + (o.tone ? ' data-tone="' + esc(o.tone) + '"' : "")
          + ' data-act="' + esc(op) + '" data-ai="' + inst.key + ":" + idx + '"' + data + (weighed ? ' data-weighed="1"' : "")
          + (st.busy ? ' aria-busy="true"' : "") + (st.done ? " data-done" : "") + (st.lock ? " disabled data-locked" : "") + tipAttr(tip, 2) + ">"
          + (o.icon ? I(o.icon) : "") + (outward ? I("outward") : "") + label
          + (weighed ? '<span class="w"' + (mark ? ' data-mark="' + esc(mark) + '"' : "") + ">" + pips + w("weight." + shown + ".name") + "</span>" : "") + "</button>"
          + '<span class="mk-slot" data-slot="' + inst.key + ":" + idx + '"></span></span>';
      },
      /* R16: an item the record holds, a link to its screen where one is built, with its card */
      ref(kind, id, label, facts) {
        const screen = D.refScreens[kind];
        const target = screen && screenOf(screen) && id !== undefined && id !== null && id !== "" ? hrefOf(screen, id) : null;
        /* R81, R88: a `published` or `archive` card is the kind's word alone; a kind with no word held (`theme`, `objective`, ...) is the
           item's own facts alone, nothing if it has none (R106) */
        const lead = kw("shell.card." + kind);
        const card = (lead ? "<b>" + lead + "</b>" : "") + (D.cardWordOnly.includes(kind) ? "" : (facts || []).filter((f) => f !== null && f !== undefined && f !== "")
          .map((f) => '<span class="why">' + soft(f) + "</span>").join("")) + (target ? '<span class="more">' + w("shell.card.open") + "</span>" : "");
        return target
          ? '<a class="cs-ref" href="' + esc(target) + '" data-nav' + tipAttr(card, 1) + ">" + soft(label) + "</a>"
          : '<span class="cs-card" tabindex="0"' + tipAttr(card, 1) + ">" + soft(label) + "</span>";
      },
      /* level 1: a mark explains itself; its name is the word `mark.<family>.<value>.name` (or `.label`) */
      mark(family, value, fills) {
        const m = MARK[family] || { cls: "cs-kind", attr: null, icon: null };
        const base = "mark." + family + (value ? "." + value : "");
        const nameKey = [base + ".name", base + ".label"].find(has);
        const meansKey = [base + ".means", "mark." + family + ".means"].find(has);
        const extra = fills && fills.reason !== undefined && fills.reason !== null ? "<span>" + soft(fills.reason) + "</span>" : "";
        const name = nameKey ? (extra ? "<b>" + w(nameKey, fills) + "</b>" : w(nameKey, fills)) : "";
        return '<span class="' + m.cls + '"' + (m.attr && value ? " " + m.attr + '="' + esc(value) + '"' : "") + ' tabindex="0"'
          + tipAttr(meansKey ? w(meansKey, fills) : "", 1) + ">" + (m.icon ? I(m.icon(value)) : "") + name + extra + "</span>";
      },
      grade(scale, letter) {
        const tip = "<b>" + kw("mark.scale." + scale + ".name") + "</b>: " + kw("mark.scale." + scale + ".means") + '<span class="why">' + kw("mark.grade.reading") + "</span>";
        return '<span class="cs-grade" data-scale="' + esc(scale) + '" tabindex="0"' + tipAttr(tip, 1) + ">" + I(scale) + '<span class="sr">' + kw("mark.scale." + scale + ".name") + "</span>" + esc(letter) + "</span>";
      },
      due(iso, state) {
        return '<span class="cs-due"' + (state ? ' data-due="' + esc(state) + '"' : "") + ' tabindex="0"' + tipAttr(kw("mark.due.means"), 1) + ">"
          + I(state === "met" ? "accepted" : "clock") + date(iso) + "</span>";
      },
      hint(label) {
        return '<span class="cs-hint" tabindex="0"' + tipAttr(kw("mark.hint.means"), 1) + ">" + I("hint") + (label ? soft(label) : kw("mark.hint.label")) + "</span>";
      },
      title(label, o = {}) {
        if (o.thing) o = typeof o.thing === "string" ? { kind: o.thing, facts: o.facts } : { kind: o.thing.kind, facts: o.thing.facts };
        const purpose = kw("screen." + inst.spec.id + ".purpose");
        const t = label === undefined || label === null ? kw("screen." + inst.spec.id + ".name") : soft(label);
        const tip = o.kind
          ? "<b>" + kw("shell.card." + o.kind) + "</b>" + (o.facts || []).map((f) => '<span class="why">' + esc(f) + "</span>").join("") + (purpose ? '<span class="more">' + purpose + "</span>" : "")
          : purpose;
        return '<h1 class="t-title" tabindex="0"' + tipAttr(tip, o.kind ? 1 : 2) + ">" + t + "</h1>";
      },
      sec(titleKey, inner, o = {}) {
        const help = o.help || (has(titleKey + ".holds") ? titleKey + ".holds" : null);
        /* K4073: `help` is one key or a list, each drawn as its own sentence */
        const helpHtml = Array.isArray(help) ? help.map((k, i) => (i ? '<span class="why">' + w(k) + "</span>" : w(k))).join("") : help ? w(help) : "";
        return '<section class="cs-section"' + (o.id ? ' id="' + esc(o.id) + '"' : "") + '><h2 tabindex="0"' + tipAttr(helpHtml, 2) + ">" + w(titleKey, o.fills) + "</h2>" + inner + "</section>";
      },
      sheet: (inner) => '<div class="cs-sheet">' + inner + "</div>",
      /* R120 (C81): a row whose first part is empty has no lead element, and the design's grid (lead, text, act) would give the text the
         first column and the act what is left of it; such a row says so (`data-lead="none"`), and the shell's layout draws it as text and
         act, the act sized to its content */
      row: (a, b, c = "", meta = "") => '<div class="cs-row"' + (String(a == null ? "" : a).trim() === "" ? ' data-lead="none"' : "") + ">" + (a == null ? "" : a) + "<span>" + b + "</span>" + c + (meta ? '<span class="meta">' + meta + "</span>" : "") + "</div>",
      /* R22: every field has its label. R62: the label bold with its help beneath, tied by `aria-describedby`, each its
         own block of the field's grid, so the two never run together */
      field(id, labelKey, o = {}) {
        const cls = "cs-input" + (o.rec ? " rec" : "") + (o.draft ? " cs-draft" : "");
        const attrs = (o.type ? ' type="' + esc(o.type) + '"' : o.area ? "" : ' type="text"') + (o.max ? ' maxlength="' + esc(o.max) + '"' : "")
          + (o.accept ? ' accept="' + esc(o.accept) + '"' : "") + (o.capture ? ' capture="' + esc(o.capture) + '"' : "")
          + (o.help ? ' aria-describedby="' + (Array.isArray(o.help) ? o.help.map((k, i) => esc(id) + "-help" + (i ? i + 1 : "")).join(" ") : esc(id) + "-help") + '"' : "") + (o.autocomplete ? ' autocomplete="' + esc(o.autocomplete) + '"' : "")
          + (o.placeholder ? ' placeholder="' + wordOrData(o.placeholder) + '"' : "") + (typeof o.typing === "function" ? ' data-typing="1"' : "") + (o.enter ? ' data-enter="' + esc(o.enter) + '"' : "");
        if (typeof o.typing === "function") inst.typing[id] = o.typing;
        const input = o.area ? '<textarea id="' + esc(id) + '" class="' + cls + '"' + attrs + ">" + esc(o.value || "") + "</textarea>"
          : "<input id=\"" + esc(id) + '" class="' + cls + '"' + attrs + (o.type === "file" || o.type === "password" ? "" : ' value="' + esc(o.value || "") + '"') + ">";
        return '<div class="cs-field"><label for="' + esc(id) + '">' + w(labelKey, o.fills) + "</label>"
          + (o.help ? (Array.isArray(o.help) ? o.help : [o.help]).map((k, i) => '<span class="help" id="' + esc(id) + "-help" + (i ? i + 1 : "") + '">' + w(k) + "</span>").join("") : "") + input
          + (o.draft ? '<span class="cs-draftlabel">' + I("machine") + w(o.draft, o.draftFills) + "</span>" : "") + "</div>";
      },
      /* R27 (N986): options are words by key, `[value, key, fills]`, or record data, `{value, text}`, the text drawn as
         data, HTML-escaped and never read as a key */
      choice(id, labelKey, options, o = {}) {
        const valueOf = (x) => (Array.isArray(x) ? x[0] : x && typeof x === "object" ? x.value : x);
        /* R49 (K3150): `{acts: {<value>: op}}`: the choice drives the act it governs, one button following it */
        const drives = !!(o.acts && typeof o.acts === "object");
        /* R90: `{redraw: <name>}`: the value chosen is `view.ui[<name>]` and the screen redraws at once; no op, no address;
           `o.value` seeds the draw only until the member chooses */
        const redraw = typeof o.redraw === "string" && o.redraw ? o.redraw : "";
        const values = (options || []).map(valueOf);
        /* R90 (K4245): a choice the member made is kept in page memory, so a whole-draw redraw (every read loading again, the choice
           gone from the tree for a moment) draws it again as chosen; `o.value` seeds it only until the member chooses */
        const made = Object.hasOwn(inst.ui, "choice:" + id) ? values.find((v) => String(v) === String(inst.ui["choice:" + id])) : undefined;
        const chosen = drives ? (values.includes(inst.ui["choice:" + id]) ? inst.ui["choice:" + id] : values.includes(o.value) ? o.value : values[0])
          : redraw && Object.hasOwn(inst.ui, redraw) ? inst.ui[redraw] : made !== undefined ? made : o.value;
        if (drives) inst.ui["choice:" + id] = chosen;
        const opt = (x) => {
          const [v, t] = Array.isArray(x) ? [x[0], w(x[1], x[2])] : x && typeof x === "object" ? [x.value, typeof x.key === "string" ? w(x.key, x.fills) : esc(x.text)] : [x, esc(x)];
          return '<option value="' + esc(v) + '"' + (chosen === v ? " selected" : "") + ">" + t + "</option>";
        };
        const field = '<div class="cs-field"><label for="' + esc(id) + '">' + w(labelKey) + '</label><select id="' + esc(id) + '" class="cs-input"' + (drives ? ' data-shell="choice" data-choice="' + esc(id) + '"' : redraw ? ' data-shell="choice" data-redraw="' + esc(redraw) + '"' : ' data-keep="' + esc(id) + '"') + ">"
          + (options || []).map(opt).join("") + "</select></div>";
        return drives && Object.hasOwn(o.acts, chosen) ? field + cs.act(o.acts[chosen], o.act || {}) : field;
      },
      /* R49 (K3147, K3150): an image an op answers, fetched with the session's header and drawn from an object address
         the page made (never a credential in an address); `alt` a word key or `{text}` */
      image(op, params, o = {}) {
        const key = op + "?" + JSON.stringify(params || {});
        let im = inst.images[key];
        if (!im) { im = inst.images[key] = { url: null, state: "loading" }; loadImage(inst, im, op, params); }
        return '<img class="mk-image" alt="' + wordOrData(o.alt) + '" data-image="' + im.state + '"' + (im.url ? ' src="' + esc(im.url) + '"' : "") + ">";
      },
      /* R49: rectangles drawn over an image by pointer, touch or keyboard, each moved and resized; read by `cs.value(id)`
         as `[{left, top, width, height}]` in the image's pixels */
      areas(imageHtml, o = {}) {
        const id = String(o.id || "areas");
        if (!Object.hasOwn(inst.areas, id)) inst.areas[id] = (o.areas || []).map((r) => ({ left: +r.left || 0, top: +r.top || 0, width: +r.width || 0, height: +r.height || 0 }));
        const list = inst.areas[id];
        const nat = inst.ui["areas-size:" + id] || null;
        const pos = (r) => (nat ? "left:" + (100 * r.left / nat.w) + "%;top:" + (100 * r.top / nat.h) + "%;width:" + (100 * r.width / nat.w) + "%;height:" + (100 * r.height / nat.h) + "%"
          : "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px");
        const label = o.label ? wordOrData(o.label) : w("shell.areas");
        return '<div id="' + esc(id) + '" role="group" aria-label="' + label + '"><div class="mk-imgareas" data-shell="areas-box" data-areas="' + esc(id) + '">' + imageHtml
          + list.map((r, i) => '<button type="button" class="mk-imgarea" data-shell="area" data-areas="' + esc(id) + '" data-i="' + i + '" style="' + pos(r) + '" aria-label="'
            + w("shell.areas.one", { n: String(i + 1), left: String(Math.round(r.left)), top: String(Math.round(r.top)), width: String(Math.round(r.width)), height: String(Math.round(r.height)) }) + '"></button>').join("")
          + '</div><p class="mk-note">' + w("shell.areas.help") + '</p><span class="mk-acts"><button type="button" class="cs-btn" data-tone="quiet" data-shell="area-add" data-areas="' + esc(id) + '">' + w("shell.areas.add") + "</button>"
          + (list.length ? '<button type="button" class="cs-btn" data-tone="quiet" data-shell="area-clear" data-areas="' + esc(id) + '">' + w("shell.areas.clear") + "</button>" : "") + "</span></div>";
      },
      /* R80 (N1083; K3297): options as words by key, `[value, key, on]`, or as record data, `{value, text, on}`, the text drawn as data,
         HTML-escaped and never read as a key; the legend a word key or `{text}`; each box sits beside its own words */
      checks(id, legendKey, options, o = {}) {
        const opt = (x, i) => {
          const [v, text, on] = Array.isArray(x) ? [x[0], w(x[1]), x[2]] : [x.value, typeof x.key === "string" ? w(x.key, x.fills) : esc(x.text), x.on];
          return '<label><input type="' + (o.radio ? "radio" : "checkbox") + '" name="' + esc(id) + '" id="' + esc(id) + "-" + i + '" value="' + esc(v) + '"' + (on ? " checked" : "") + "> <span>" + text + "</span></label>";
        };
        const redraw = typeof o.redraw === "string" && o.redraw ? ' data-shell="choice" data-redraw="' + esc(o.redraw) + '"' : "";
        /* R135: `typing` (as `field`'s) is handed `(cs, view, value)` at once when a box or radio changes, `value` the chosen value of a radio group or the list of values ticked */
        if (typeof o.typing === "function") inst.typing[id] = o.typing;
        return '<fieldset class="cs-field" id="' + esc(id) + '"' + redraw + (typeof o.typing === "function" ? ' data-typing-group="1"' : "") + '><legend>' + wordOrData(legendKey) + "</legend>" + (options || []).map(opt).join("") + "</fieldset>";
      },
      /* R74: the Sounds setting's control, drawn as `appearance()` draws R18's, so `screens-settings` draws none of its own */
      sounds() {
        return '<div class="mk-acts" role="group" aria-label="' + w("screen.account.sounds") + '"' + tipAttr(w("screen.account.sounds.help"), 2) + ">" + ["on", "off"].map((t) =>
          '<button type="button" class="cs-btn" data-tone="quiet" aria-pressed="' + (SOUNDS === (t === "on")) + '" data-shell="sounds" data-sounds-to="' + t + '">' + w("screen.account.sounds." + t) + "</button>").join("") + "</div>";
      },
      /* R82 (DEC-275): a row's icon, explained by `shell.icon.<kind>` */
      icon(kind) {
        const key = "shell.icon." + kind;
        return '<span class="cs-card" tabindex="0"' + tipAttr(has(key) ? w(key) : "", 1) + ">" + I(kind) + "</span>";
      },
      /* R27 (N985): R18's control, drawn by the kit, so no screen draws the shell's own buttons */
      appearance() {
        return '<div class="mk-acts" role="group" aria-label="' + w("shell.appearance") + '">' + ["device", "light", "dark"].map((t) =>
          '<button type="button" class="cs-btn" data-tone="quiet" aria-pressed="' + (THEME === t) + '" data-shell="theme" data-theme-to="' + t + '">' + w("shell.appearance." + t) + "</button>").join("") + "</div>";
      },
      /* R19: rows, each row's acts in a panel beneath it; picks bring the hold strip. R27: the row's name (`name(item)`,
         its HTML, a reference where the item has a screen) is drawn with the panel's control beside it, never around
         it. With `cells(item)` one short of `cols`, the name is the first column; with as many, `cells(item)[0]` is.
         R62: drawn as the design's table (`mk-table mk-rows`); at the phone width each row is the design's one-line row,
         the name and its first value on one line and the rest beneath, labeled, with no label for an empty cell and no
         column that is empty in every row. */
      rows(t) {
        const id = t.id || "rows";
        const open = inst.ui["open:" + id] || (inst.ui["open:" + id] = []);
        const picked = inst.ui["pick:" + id] || (inst.ui["pick:" + id] = []);
        const sort = inst.ui["sort:" + id] || null;
        let items = (t.items || []).slice();
        if (sort && typeof t.sortKey === "function") {
          items.sort((a, b) => { const x = t.sortKey(a, sort.col), y = t.sortKey(b, sort.col); return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === "desc" ? -1 : 1); });
        }
        const cols = t.cols || [];
        const narrow = phone();
        const blank = (c) => textOf(c) === "" && !/<(img|svg|input|button|select|textarea)\b/i.test(String(c == null ? "" : c));
        const drawn = items.map((it) => {
          let cells = t.cells(it).map((c) => String(c == null ? "" : c));
          const nameHtml = t.name ? String(t.name(it)) : null;
          if (nameHtml !== null && cells.length === cols.length - 1) cells = [nameHtml].concat(cells);
          return { it, cells, nameHtml };
        });
        /* R62: at the phone width a column empty in every row is not drawn */
        const shownCols = cols.map((c, i) => i === 0 || !narrow || drawn.some((d) => !blank(d.cells[i])));
        /* R84: at the phone width a table restacks as cards with no header row */
        const head = narrow ? "" : "<thead><tr>" + (t.pick ? '<th class="mk-pickc"></th>' : "") + cols.map((c, i) => {
          if (!shownCols[i]) return "";
          const s = sort && sort.col === i ? (sort.dir === "desc" ? "descending" : "ascending") : "none";
          return '<th aria-sort="' + s + '">' + (typeof t.sortKey === "function"
            ? '<button type="button" class="mk-sort" data-shell="sort" data-table="' + esc(id) + '" data-col="' + i + '" aria-label="' + w("shell.sort", { column: html(w(c)) }) + '"' + tipAttr(w("shell.sort.holds"), 2) + ">" + w(c) + "</button>" : w(c)) + "</th>";
        }).join("") + "</tr></thead>";
        const width = (t.pick ? 1 : 0) + shownCols.filter(Boolean).length;
        const body = drawn.map(({ it, cells, nameHtml }) => {
          const key = String(t.key(it));
          const name = nameHtml !== null ? textOf(nameHtml) : textOf(cells[0]) || key;
          const isOpen = open.includes(key);
          const acts = t.acts ? t.acts(it) : "";
          const control = acts ? '<button type="button" class="mk-open" data-shell="row" data-table="' + esc(id) + '" data-id="' + esc(key) + '" aria-expanded="' + isOpen
            + '" aria-label="' + w("shell.row.open", { name }) + '"' + tipAttr(w("shell.row.open.holds"), 2) + ">" + w("shell.row.acts") + "</button>" : "";
          const pick = t.pick ? '<td><input type="checkbox" class="mk-pick" id="pick-' + esc(id) + "-" + esc(key) + '" data-shell="pick" data-table="' + esc(id) + '" data-id="' + esc(key) + '"'
            + (picked.includes(key) ? " checked" : "") + ' aria-label="' + w("shell.pick", { name }) + '"></td>' : "";
          let tds;
          if (narrow) {
            /* the name and its first value on one line; the rest beneath, each labeled unless empty */
            const rest = cells.map((c, i) => [c, i]).filter(([, i]) => i > 1 && shownCols[i]);
            tds = '<td><span class="mk-rowname">' + cells[0] + control + (cells.length > 1 && shownCols[1] && !blank(cells[1]) ? '<span class="muted">' + cells[1] + "</span>" : "") + "</span></td>"
              + rest.map(([c, i]) => (blank(c) ? "" : '<td data-label="' + w(cols[i] || "state.empty") + '"><span>' + c + "</span></td>")).join("");
          } else {
            tds = cells.map((c, i) => (i === 0 ? '<td><span class="mk-rowname">' + c + control + "</span></td>" : shownCols[i] ? "<td>" + c + "</td>" : "")).join("");
          }
          return '<tr class="cs-r mk-r"' + (narrow && !t.pick ? ' style="grid-template-columns:minmax(0,1fr)"' : "") + ">" + pick + tds + "</tr>"
            + (acts ? '<tr class="cs-panel mk-detail"' + (isOpen ? "" : " hidden") + '><td colspan="' + width + '"><div class="mk-detailbox"><div class="mk-acts">' + acts + "</div></div></td></tr>" : "");
        }).join("");
        const keep = picked.filter((k) => items.some((it) => String(t.key(it)) === k));
        inst.ui["pick:" + id] = keep;
        const hold = t.pick && keep.length
          ? '<div class="cs-hold mk-rowhold" role="region" aria-label="' + w("shell.picked", { n: String(keep.length) }) + '"><span class="n">' + w("shell.picked", { n: String(keep.length) }) + '</span><span class="acts">'
            + (t.hold ? (inst.holding = id, (() => { try { return t.hold(keep); } finally { inst.holding = null; } })()) : "") + '<button type="button" class="cs-btn" data-tone="quiet" data-shell="unpick" data-table="' + esc(id) + '">' + w("shell.unpick") + "</button></span></div>"
          : "";
        return '<table class="cs-rows mk-table mk-rows">' + head + "<tbody>" + body + "</tbody></table>" + hold;
      },
      /* R44 (DEC-214 (2)): the at-a-glance elements, each drawn once, as the visual language draws them */
      reading(o = {}) {
        return '<div class="mk-tile"><span class="k">' + wordOrData(o.label) + '</span><b class="v">' + esc(o.value) + "</b>"
          + (o.change ? '<span class="d">' + wordOrData(o.change) + "</span>" : "") + (Array.isArray(o.bars) ? spark(o.bars, null) : "") + "</div>";
      },
      activity: (weeks, word) => spark(weeks, word || null),
      initials(names) {
        const list = (names || []).map((n) => String(n));
        return '<span class="mk-people" role="img" aria-label="' + w("shell.glance.people", { n: String(list.length), names: list.join(", ") }) + '">'
          + list.slice(0, 4).map((n) => "<i>" + esc(n.slice(0, 1).toUpperCase()) + "</i>").join("")
          + (list.length > 4 ? '<i class="more">' + w("shell.glance.more", { n: String(list.length - 4) }) + "</i>" : "") + "<span>" + esc(list.length) + "</span></span>";
      },
      path(steps) {
        return '<ol class="mk-next">' + (steps || []).map((s) => "<li" + (s.now ? ' aria-current="step"' : "") + "><span>" + wordOrData(s.text) + "</span>" + (s.act || "") + "</li>").join("") + "</ol>";
      },
      storyline(events, o = {}) {
        const dated = (events || []).filter((e) => e && e.date && date(e.date));
        const ev = (e) => {
          const t = "<b>" + date(e.date) + "</b>" + wordOrData(e.text);
          return '<div class="ev' + (e.us ? " us" : "") + '" role="listitem"><span class="t">' + (e.us ? "" : t) + '</span><i></i><span class="t">' + (e.us ? t : "") + "</span></div>";
        };
        return '<div class="mk-tl" role="list">' + dated.map(ev).join("") + "</div>"
          + (o.open ? '<a class="cs-btn" data-tone="quiet" href="' + esc(hrefOf(o.open.screen, o.open.subject)) + '" data-nav>' + w("shell.glance.timeline") + "</a>" : "");
      },
      strip(readings) {
        const four = (readings || []).slice(0, 4);
        if (phone()) {
          const n = four.reduce((a, r) => a + (Number(r.n) || 0), 0);
          /* C81 (fix round 3): the design's stylesheet hides a link directly inside the strip at the phone width and shows the one inside
             `.mk-strip-sum`, so the chip is drawn there */
          return '<div class="mk-strip" role="region" aria-label="' + w("shell.glance.strip") + '"><span class="mk-strip-sum"><a class="cs-ref" href="' + esc(placeHref("queue")) + '" data-nav><b>' + esc(n) + "</b> "
            + w("shell.glance.strip.sum", { n: "" }).trim() + "</a></span></div>";
        }
        /* R90: a reading's `says` (a word key or `{text}`) closes that reading's own explanation, after its label in bold */
        return '<div class="mk-strip" role="region" aria-label="' + w("shell.glance.strip") + '">' + four.map((r) =>
          '<a class="cs-ref" href="' + esc(hrefOf(r.screen || "queue", r.subject)) + '" data-nav'
          + (r.says ? tipAttr("<b>" + wordOrData(r.label) + '</b><span class="more">' + wordOrData(r.says) + "</span>", 1) : "") + "><b>" + esc(r.n) + "</b> " + wordOrData(r.label) + "</a>").join("") + "</div>";
      },
      /* R91 (N1236): a document's words for choosing a passage on a form: `units` `{extent, text}` in order (text is data);
         selected by pointer or touch, or by keyboard (each unit takes focus, Space toggles, Shift with the arrows extends);
         `cs.value(id)` answers `{text, extents}` or null; the control sends nothing and reads no op */
      words(id, o = {}) {
        const units = (Array.isArray(o.units) ? o.units : []).filter((u) => u && typeof u === "object").map((u) => ({ extent: String(u.extent == null ? "" : u.extent), text: String(u.text == null ? "" : u.text) }));
        const label = o.label ? wordOrData(o.label) : w("form.choose.passage");
        const st = inst.words[id] || (inst.words[id] = { sel: [], anchor: null });
        st.units = units;
        if (!units.length) return '<p class="cs-state" data-state="empty" id="' + esc(id) + '">' + w("state.empty") + "</p>";
        const on = new Set(st.sel);
        return '<div id="' + esc(id) + '" class="mk-pagetext" role="group" aria-label="' + label + '" data-words="' + esc(id) + '">' + units.map((u, i) => {
          const sel = on.has(u.extent);
          const attrs = ' role="checkbox" aria-checked="' + sel + '" tabindex="0" data-shell="word" data-id="' + esc(id) + '" data-i="' + i + '"';
          return (sel ? '<mark class="mk-sel"' : "<span") + attrs + ">" + esc(u.text) + (sel ? "</mark>" : "</span>");
        }).join(" ") + "</div>";
      },
      /* R93 (A10): `list.fresh` as a polite status line, only while the screen's refreshing read last answered no more than 90
         seconds ago on the page's clock; none before its first answer or after a failed re-read */
      fresh(name) {
        const stamps = Object.entries(inst.fresh).filter(([n]) => !name || n === name).map(([, t]) => t);
        if (!stamps.length || stamps.some((t) => !t) || Date.now() - Math.min(...stamps) > FRESH_MS) return "";
        return '<p class="mk-note" role="status" aria-live="polite" data-fresh>' + w("list.fresh") + "</p>";
      },
      /* R94 (A13): a member who may read and not act is told so, once on a screen; "" for one who holds Contribute */
      readonly(noun) {
        if (!ME || ME.administer === true || (Array.isArray(ME.capabilities) && ME.capabilities.includes("contribute")) || inst.ro) return "";
        inst.ro = true;
        const n = noun && typeof noun === "object" ? wordOrData(noun) : typeof noun === "string" && has(noun) ? w(noun) : esc(noun == null ? "" : noun);
        /* K4084: the path "Settings › Members" is drawn as the reference it names, where `members` is a screen */
        const members = screenOf("members") ? '<a class="cs-ref" href="' + esc(hrefOf("members")) + '" data-nav>' + w("shell.readonly.members") + "</a>" : w("shell.readonly.members");
        return '<p class="mk-note" role="note">' + w("shell.readonly", { noun: html(n), members: html(members) }) + "</p>";
      },
      /* R95 (A11): the design's state chip for a kind, explained at level 1 by what it means, can and cannot (separate lines
         of the one explanation); a kind outside the list draws nothing */
      stateChip(kind) {
        if (!STATE_KINDS.includes(kind)) return "";
        const base = "state.item." + kind;
        if (!has(base + ".name")) return "";
        const tip = "<b>" + w(base + ".name") + "</b>" + (has(base + ".means") ? ": " + w(base + ".means") : "")
          + [".can", ".cannot"].filter((x) => has(base + x)).map((x) => '<span class="why">' + w(base + x) + "</span>").join("");
        return '<span class="mk-chip" tabindex="0"' + tipAttr(tip, 1) + ">" + w(base + ".name") + "</span>";
      },
      /* R95: a glossary term as a card: its name, explained by its definition then `shell.card.open`, a click opening `glossary`;
         until the design gives the term a name (`<definition key>.name`), no term is drawn as a term */
      term(termKey) {
        const def = "screen.glossary." + String(termKey == null ? "" : termKey);
        if (!has(def) || !has(def + ".name")) return "";
        const target = screenOf("glossary") ? hrefOf("glossary") : null;
        const tip = w(def) + (target ? '<span class="more">' + w("shell.card.open") + "</span>" : "");
        return target ? '<a class="cs-ref" href="' + esc(target) + '" data-nav' + tipAttr(tip, 1) + ">" + w(def + ".name") + "</a>"
          : '<span class="cs-card" tabindex="0"' + tipAttr(tip, 1) + ">" + w(def + ".name") + "</span>";
      },
      /* R99 (A79): the page printed now; `printed(cs, view)` follows when printing ends or is cancelled */
      print() { try { win.print(); } catch { /* the browser refused to print: nothing printed */ } return true; },
    };
    /* R46 (screens-entry R2, R6, R7): the session handed over by a screen, and its end */
    cs.signin = (answer, o = {}) => signedIn(answer, o);
    cs.signedOut = () => signedOut();
    /* R46, R47: controls the shell binds: R4's sign-out, a file made in the page, the clipboard */
    const bound = (kind, o, extra) => {
      const i = inst.binds.push(Object.assign({ kind }, extra)) - 1;
      const key = o && o.label ? o.label : { signout: "shell.signout", save: "shell.save", copy: "shell.copy" }[kind];
      return '<button type="button" class="cs-btn" data-tone="quiet" data-shell="bind" data-bi="' + inst.key + ":" + i + '">' + (kind === "save" ? I("add") : "") + w(key, o && o.fills) + "</button>";
    };
    cs.signout = (o = {}) => bound("signout", o, {});
    cs.save = (name, content, o = {}) => bound("save", o, { name: String(name || ""), text: String(content == null ? "" : content) });
    cs.copy = (content, o = {}) => bound("copy", o, { text: String(content == null ? "" : content) });
    /* R34: the password asked again, for a screen that sends its act by `cs.call` */
    cs.reauth = () => reauthAsk();
    /* R31, K3143: the dock's wizard guide started, and the ring */
    cs.wizard = (script, version, o = {}) => startWizard(script, version, o);
    cs.ring = (op, label) => ring(op, label);
    /* R40–R42, R47: the signer */
    cs.signer = SIGNER;
    return cs;
  }
  /* whether `a` comes before `b` in the document's order */
  function precedes(a, b) {
    if (typeof a.compareDocumentPosition === "function") return !!(a.compareDocumentPosition(b) & 4);
    const order = [];
    const walk = (n) => { for (const c of n.children || []) { order.push(c); walk(c); } };
    walk(doc.getElementById("cs-root"));
    return order.indexOf(a) < order.indexOf(b);
  }
  /* R44: eight weeks of bars in the stage hue, the newest darker, with the word they say */
  function spark(vals, word) {
    const v = (vals || []).map((x) => Math.max(0, Number(x) || 0));
    const m = Math.max(1, ...v);
    const said = word ? w(word) : "";
    return '<span class="mk-spark" role="img" aria-label="' + w("shell.glance.weeks", { word: html(said), weeks: v.join(", ") }) + '">'
      + v.map((x, i) => '<i style="height:' + Math.max(2, Math.round(18 * x / m)) + 'px"' + (i === v.length - 1 ? ' class="now"' : "") + "></i>").join("")
      + (said ? "<b>" + said + "</b>" : "") + "</span>";
  }
  async function loadImage(inst, im, op, params) {
    const a = await call(op, { query: params || {}, bytes: true, public: inst.pub });
    const r = a.kind === "response" ? a.r : null;
    const type = r && r.headers && r.headers.get ? String(r.headers.get("content-type") || "") : "";
    if (!r || !r.ok || /json/i.test(type)) { im.state = "failed"; if (live(inst)) draw(); return; }
    const blob = await r.blob();
    if (!live(inst)) return;
    im.url = win.URL.createObjectURL(blob);
    im.state = "ok";
    draw();
  }
  /* R49: the areas control's own handling: the image's natural size learned once drawn, a rectangle drawn by the
     pointer, and each moved (arrows), resized (Shift and arrows) or removed (Delete) from the keyboard */
  function areasOf(id) { return MAIN && Object.hasOwn(MAIN.areas, id) ? MAIN : DOCKI && Object.hasOwn(DOCKI.areas, id) ? DOCKI : null; }
  function areasSize(inst, id) {
    const box = doc.getElementById("cs-root").querySelector('[data-shell="areas-box"][data-areas="' + id.replace(/"/g, "") + '"]');
    const img = box ? box.querySelector("img") : null;
    const w0 = img ? Number(img.naturalWidth) : 0, h0 = img ? Number(img.naturalHeight) : 0;
    if (w0 > 0 && h0 > 0) inst.ui["areas-size:" + id] = { w: w0, h: h0 };
    const nat = inst.ui["areas-size:" + id] || null;
    const rect = box && box.getBoundingClientRect ? box.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    return { nat, rect, sx: nat && rect.width ? nat.w / rect.width : 1, sy: nat && rect.height ? nat.h / rect.height : 1 };
  }
  const clampArea = (r, nat) => {
    const W = nat ? nat.w : Infinity, H = nat ? nat.h : Infinity;
    r.width = Math.max(1, Math.min(r.width, W)); r.height = Math.max(1, Math.min(r.height, H));
    r.left = Math.max(0, Math.min(r.left, W - r.width)); r.top = Math.max(0, Math.min(r.top, H - r.height));
    return r;
  };
  function saveFile(blob, name) {
    const url = win.URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", name || "");
    doc.body.appendChild(link);
    link.click();
    doc.body.removeChild(link);
    win.URL.revokeObjectURL(url);
  }

  /* ---------- routes (R9, R32, R36) and paths (R8) ---------- */
  function hrefOf(screen, subject) {
    if (screen === "home") return "/app";
    const at = Object.keys(D.addresses).find((k) => D.addresses[k] === screen);
    if (at) screen = at;
    /* R105: a screen that takes the project as a second part has a subject written `<id>/<project>` drawn as two parts of the address */
    const enc = (x) => (D.projectPart.includes(screen) ? String(x).split("/").map(encodeURIComponent).join("/") : encodeURIComponent(x));
    return "/app/" + encodeURIComponent(screen) + (subject !== undefined && subject !== null && subject !== "" ? "/" + enc(subject) : "");
  }
  function parse(pathname) {
    const p = String(pathname || "");
    /* R32: `/` opens Home with a live record and `front` without one */
    if (p === "" || p === "/") return { screen: S ? "home" : "front", subject: null, root: true };
    if (!/^\/app(\/|$)/.test(p)) {
      /* R79 (N1174; DEC-299 (11); DEC-301 (3)): `/doorbell` and `/tour` draw their screens in the public frame at that address;
         any other path outside `/` and `/app` draws `unavailable` in the public frame, reading no session */
      const one = /^\/([^/]+)\/?$/.exec(p);
      if (one && Object.hasOwn(D.publicAddresses, one[1])) return { screen: D.publicAddresses[one[1]], subject: null, root: false };
      return { screen: "unavailable", subject: null, root: false, outside: true };
    }
    const rest = p.replace(/^\/app\/?/, "");
    const [s, ...sub] = rest.split("/").filter((x) => x !== "");
    let subject = sub.length ? sub.join("/") : null;
    try { subject = subject === null ? null : decodeURIComponent(subject); } catch { /* kept as written */ }
    const screen = s ? (Object.hasOwn(D.addresses, s) ? D.addresses[s] : s) : "home";
    /* R105: the question's address may carry the project it is opened from as a second part; the project part is not an id
       space of the shell's, so a part that is empty, holds a space, control character, backslash, `?` or `#`, or a third part,
       is malformed and draws `unavailable` */
    let project = null, malformed = false;
    if (D.projectPart.includes(screen) && subject !== null) {
      const bits = subject.split("/");
      if (bits.length > 1) {
        const fit = (x) => x.length > 0 && x.length <= 200 && !/[\s\\?#\u0000-\u001f]/.test(x);
        if (bits.length > 2 || !bits.every(fit)) malformed = true;
        else { subject = bits[0]; project = bits[1]; }
      }
    }
    return { screen, subject, project, malformed, root: false };
  }
  const placeOf = (id) => (D.paths[id] && D.places.includes(D.paths[id][0]) ? D.paths[id][0] : ["settings", "people", "more", "projects"].includes(id) ? id : null);
  /* R7, R37: a place opens the first of its screens registered, else the shell's own page for it */
  function placeHref(k) {
    const target = (D.placeScreens[k] || []).find(screenOf);
    return target === "home" ? "/app" : target ? hrefOf(target) : "/app/" + k;
  }
  function pathNav(route, inst, kind) {
    /* R61: an absent subject keeps the way back to its place */
    if (kind) {
      const place = placeOf(route.screen);
      return crumbs((kind === "nothing" && place && place !== "more" ? [{ label: w("rail." + place + ".name"), href: placeHref(place) }] : []).concat([{ label: w(unavailKey(kind) + ".title") }]));
    }
    const steps = [];
    const p = D.paths[route.screen] || null;
    if (p) {
      let proj = null, last = null, projKey = null;
      /* R110: `place` answers `{project, last}`; `last` (data: the one the member is on) is the final crumb's `{name}` where the path holds the design's `.crumb` word, else the screen's own name stays */
      try { const pl = inst && inst.spec.place ? inst.spec.place(inst.view) || {} : {}; proj = pl.project; last = typeof pl.last === "string" && pl.last ? pl.last : null; projKey = typeof pl.projectKey === "string" && has(pl.projectKey) ? pl.projectKey : null; } catch { proj = null; last = null; projKey = null; }
      p.forEach((step, i) => {
        if (step === "@project") { if (proj && proj.title) steps.push({ label: projKey ? w(projKey, { name: String(proj.title) }) : soft(proj.title), href: route.screen === "project" ? null : hrefOf("project", proj.id) }); }
        else if (i === 0 && D.places.includes(step)) steps.push({ label: w("rail." + step + ".name"), href: placeHref(step) });
        else if (i === p.length - 1 && /\.crumb$/.test(step)) steps.push({ label: last ? w(step, { name: last }) : w(step.replace(/\.crumb$/, ".name")) });
        else steps.push({ label: w(step) });
      });
      if (route.screen === "project" && !(proj && proj.title)) steps.push({ label: w("screen.project.name") });
    } else if (D.places.includes(route.screen)) steps.push({ label: w(route.screen === "more" ? "shell.more" : "rail." + route.screen + ".name") });
    else steps.push({ label: inst && has("screen." + route.screen + ".name") ? w("screen." + route.screen + ".name") : w("screen.unavailable.name") });
    return crumbs(steps);
  }
  /* R8, R56: the path as the design draws it (`mk-crumbs`): each earlier step a link, "›" between, the screen's own name
     last, the current page */
  function crumbs(steps) {
    if (steps.length) steps[steps.length - 1].href = null;
    return '<nav class="cs-crumbs mk-crumbs" aria-label="' + w("shell.path") + '">' + steps.map((s, i) => (i === steps.length - 1
      ? '<b aria-current="page">' + s.label + "</b>"
      /* R82 (DEC-275): an earlier step says where it goes back to, by `shell.crumb.back` with the step's own name */
      : (s.href ? '<a href="' + esc(s.href) + '" data-nav' + tipAttr(w("shell.crumb.back", { place: html(s.label) }), 1) + ">" + s.label + "</a>" : "<span>" + s.label + "</span>"))).join(' <i aria-hidden="true">›</i> ') + "</nav>";
  }

  /* ---------- drawing ---------- */
  /* R35 (DEC-201 (8)): unavailable, in its three states */
  /* K3177 (b): one state's words, its heading and its sentence, never another state's ("Can't open this" heads none
     but `notyours`) */
  const unavailKey = (kind) => (kind === "notyours" ? "shell.unavailable.notyours" : kind === "unreachable" ? "shell.unavailable.unreachable" : "shell.unavailable.nothing");
  function unavailableHtml(kind, route) {
    const key = unavailKey(kind);
    /* R61: "Nothing is here" leads back to the screen's place (Home when it has none) */
    const place = route ? placeOf(route.screen) : null;
    const back = place && place !== "home" && place !== "more"
      ? '<a class="cs-btn" data-tone="quiet" href="' + esc(placeHref(place)) + '" data-nav>' + I("back") + w("rail." + place + ".name") + "</a>"
      : '<a class="cs-btn" data-tone="quiet" href="/app" data-nav>' + w("shell.unavailable.home") + "</a>";
    return '<h1 class="t-title" tabindex="0"' + tipAttr(kw("screen.unavailable.purpose"), 2) + ">" + w(key + ".title") + "</h1>"
      + '<p class="cs-state" data-state="' + (kind === "unreachable" ? "failed" : "empty") + '" data-unavailable="' + esc(kind) + '"' + (kind === "unreachable" ? ' role="alert"' : "") + ">" + w(key + ".says") + "</p>"
      + (kind === "unreachable" ? "" : "<p>" + back + "</p>");
  }
  const shellPage = (route) => {
    const k = route.screen;
    const titled = (key) => '<h1 class="t-title">' + w(key) + "</h1>";
    /* R63: a list of places or screens drawn as the design draws rail rows: the icon, the name as its reference, and
       what it holds beneath */
    const rowOf = (href, icon, name, holds) => '<div class="cs-row">' + I(icon) + '<span><a class="cs-ref" href="' + esc(href) + '" data-nav>' + name + "</a></span>"
      + (holds ? '<span class="meta">' + holds + "</span>" : "") + "</div>";
    if (k === "settings") {
      /* R37: until `settings` is registered, the settings screens registered, and no link to `/`; R54: `updates` only for
         a member who administers */
      const rows = D.settingsScreens.filter(screenOf).filter((s) => !D.adminScreens.includes(s) || (ME && ME.administer === true))
        .map((s) => rowOf(hrefOf(s), "settings", w("screen." + s + ".name"), kw("screen." + s + ".purpose"))).join("");
      return titled("shell.settings.title") + '<div class="cs-sheet">' + rows + "</div>";
    }
    if (k === "more") {
      /* R63, R69: the rail's places the tabs do not hold, as the design's more rows: the place's icon and name as its
         reference (explained by what it holds), and the line it says beneath */
      return '<div class="mk-h"><h1 class="t-title">' + w("shell.more") + '</h1><p class="mk-sub">' + w("screen.more.sub") + "</p></div>"
        + '<div class="mk-morerows">' + RAIL.filter((p) => !TABS.includes(p)).map((p) => '<div class="mk-morerow"><a class="cs-ref" href="' + esc(placeHref(p)) + '" data-nav'
          + tipAttr(w("rail." + p + ".holds"), 1) + ">" + I(RAIL_ICON[p]) + w("rail." + p + ".name") + "</a><p>" + w("rail." + p + ".line") + "</p></div>").join("") + "</div>";
    }
    return titled("rail." + k + ".name") + '<p class="cs-state" data-state="empty">' + w("shell.later", { place: html(w("rail." + k + ".name")) }) + "</p>";
  };
  function renderOf(inst) {
    if (inst.key !== "g") { inst.acts = []; inst.binds = []; }
    inst.ro = false;
    try { return inst.spec.render(kit(inst), inst.view); } catch { return inst.key === "g" ? "" : '<p class="cs-state" data-state="failed" role="alert">' + w("shell.unread") + "</p>"; }
  }
  /* K3143: the guide's marks, on each draw of a working screen; R51: held in one element that says they are the guide's,
     so its `data-guide` controls are known from a screen's; R59: placed in the screen's title row, after its heading
     (`placeMarks`) */
  function marksHtml() {
    if (!GUIDEI || typeof GUIDE.marks !== "function") return "";
    let h = "";
    try { h = String(GUIDE.marks(kit(GUIDEI), GUIDEI.view) || ""); } catch { h = ""; }
    return h;
  }
  /* R59: the marks inside the title row (the design's `mk-titlerow`), after the heading: the heading's own row when the
     screen drew one, else a row made around the first heading; never a block above the path or the heading. With no
     heading they follow the path. A screen with no marks keeps its title row unchanged. */
  function placeMarks(root, h) {
    const main = root.querySelector("#cs-main");
    if (!h || !main) return;
    const chip = doc.createElement("span");
    chip.setAttribute("data-guide-from", "marks");
    chip.innerHTML = h;
    const h1 = main.querySelector("h1");
    if (!h1 || !h1.parentElement) {
      const path = main.querySelector("nav.cs-crumbs");
      if (path && path.parentElement) path.parentElement.insertBefore(chip, path.nextElementSibling);
      else main.insertBefore(chip, main.children[0] || null);
      return;
    }
    let row = h1.parentElement.classList && h1.parentElement.classList.contains("mk-titlerow") ? h1.parentElement : null;
    if (!row) {
      row = doc.createElement("div");
      row.setAttribute("class", "mk-titlerow");
      h1.parentElement.insertBefore(row, h1);
      row.appendChild(h1);
    }
    row.insertBefore(chip, h1.nextElementSibling);
  }
  function mainHtml(route) {
    if (OUTSIDE) return '<h1 class="t-title" tabindex="0">' + w("screen.unavailable.name") + '</h1><p class="cs-state" data-state="empty" data-unavailable="public">' + w("unavailable.public")
      + '</p><p><a class="cs-btn" data-tone="quiet" href="/">' + w("unavailable.public.go") + "</a></p>";
    if (UNREACHED) return unavailableHtml("unreachable");
    if (!MAIN && !ENTRY_PAGE && !ME) return '<p class="cs-state" data-state="loading" role="status"><span class="bar" aria-hidden="true"></span>' + w("state.loading") + "</p>";
    if (ENTRY_PAGE) return entryPage();
    if (!MAIN) {
      if (D.places.includes(route.screen)) return pathNav(route, null) + shellPage(route);
      return pathNav(route, null, "nothing") + unavailableHtml("nothing", route);
    }
    if (MAIN.unavail) return pathNav(route, MAIN, MAIN.unavail) + unavailableHtml(MAIN.unavail, route);
    const body = renderOf(MAIN);
    return (frameOf(MAIN.spec.id) === "working" ? pathNav(route, MAIN) : "") + body;
  }
  /* R32: with no `front` registered, the state the session ended in, drawn by the shell */
  let ENTRY_PAGE = false, OUTSIDE = false;
  const entryPage = () => '<h1 class="t-title">' + w("screen.unavailable.name") + "</h1>"
    + '<p class="cs-state" data-state="empty">' + w(ENTRY.state ? "session." + ENTRY.state : "shell.unavailable.notyours.says") + "</p>";
  function dockHtml() {
    /* R31, K3143: one panel at a time: the guide's while it draws one (a wizard runs), else the assistant's */
    const guideBody = GUIDEI ? renderOf(GUIDEI) : "";
    const guide = !!guideBody;
    const inst = guide ? GUIDEI : REACHABLE && DOCK && DOCKI ? DOCKI : null;
    if (!inst) return "";
    const body = guide ? guideBody : renderOf(inst);
    const name = guide ? "shell.guide" : "shell.assistant";
    return '<aside class="cs-dock" aria-label="' + w(name) + '" data-panel="' + (guide ? "guide" : "assistant") + '"><header>' + I(guide ? "wizard" : "machine") + w(name) + '<span class="spacer"></span>'
      + (guide ? "" : '<button type="button" class="cs-btn" data-tone="quiet" data-shell="dock" aria-label="' + w("shell.assistant.close") + '">' + I("close") + "</button>") + "</header>"
      + '<div class="body">' + body + "</div></aside>";
  }
  /* K3177 (c): the signed-in member's handle: `whoami`'s, else the one signed in with. R60: never the member's record id */
  const handleOf = () => String((ME && ME.handle) || (S && S.w) || "");
  /* R7, R57, R60: the masthead, the design's at both widths: the mark and the group's name; search; the explanation level
     by its own name; the assistant while reachable; the To do count, never at zero; the member's avatar opening the
     menu. At the phone width it shows icons only, each label kept as the control's accessible name. */
  function mastHtml() {
    const narrow = phone();
    /* R60: the group's display name; answered with none, "Your team", never its slug; not yet answered, the last name this device
       was shown, else nothing (C80: no placeholder is drawn while the read is out) */
    const shown = GROUP || (GROUP_KNOWN ? null : LAST_GROUP);
    const haveName = shown || GROUP_KNOWN;
    const name = shown ? esc(shown) : GROUP_KNOWN ? w("shell.group.unnamed") : "";
    /* R76 (U2b; DEC-292 D9, D17): the explanations button names itself and its setting */
    const level = w("shell.level.button." + (LEVEL === "pause" ? "pause" : "prompt"));
    const handle = handleOf();
    const label = (text) => (narrow ? "" : '<span class="mk-hide-phone">' + text + "</span>");
    /* R76: every masthead icon keeps its accessible name, said on a tap: at the phone width the explanation leads with it */
    const named = (nm, says) => tipAttr((narrow ? "<b>" + nm + "</b>" + (says ? ": " : "") : "") + (says || ""), 2);
    /* R75 (N1106; DEC-251 (1)): the member's initial opens "Your menu": who is signed in, the account, sign out, appearance */
    const accountHref = screenOf("account") ? hrefOf("account") : "/app";
    const signout = can("signout") ? '<button type="button" class="cs-btn" data-tone="quiet" data-shell="signout" role="menuitem"' + tipAttr(w("shell.menu.signout_does"), 2) + ">" + w("shell.menu.signout") + "</button>" : "";
    const themes = ["device", "light", "dark"].map((t) => '<button type="button" class="cs-btn" data-tone="quiet" role="menuitemradio" aria-checked="' + (THEME === t) + '" data-shell="theme" data-theme-to="' + t + '">' + w("shell.appearance." + t) + "</button>").join("");
    /* R43 (DEC-214 (1)): the mark opens the masthead, before the team's name */
    const mark = '<span class="cs-mark" role="img" aria-label="' + w("shell.mark") + '" tabindex="0"' + tipAttr("<b>" + w("shell.mark") + "</b>: " + w("shell.mark.means"), 1)
      + '><svg viewBox="0 0 60 90" aria-hidden="true"><use href="' + D.icons + '#i-mark"/></svg></span>';
    /* R82 (DEC-273): the team's name opens who the team is, and says so; the To do count says what waits, with every fill
       answered or no sentence */
    const groupHref = screenOf("group-identity") ? hrefOf("group-identity") : "/app";
    const waiting = QUEUE_COUNTS ? w("shell.queue.waiting", { n: String(badge()), todo: String(QUEUE_COUNTS.todo),
      noticed: String(QUEUE_COUNTS.noticed), status: String(QUEUE_COUNTS.status) }) + '<span class="more">' + w("shell.queue.open") + "</span>" : "";
    return '<header class="cs-mast">' + mark + (haveName ? '<a class="mk-grp" href="' + esc(groupHref) + '" data-nav' + tipAttr("<b>" + (shown ? soft(shown) : w("shell.group.unnamed")) + "</b>" + '<span class="more">' + w("shell.group.open") + "</span>", 1) + ">" + name + "</a>" : "") + '<span class="spacer"></span>'
      + '<a class="mk-mastsearch" href="' + placeHref("find") + '" data-nav aria-label="' + w("shell.search") + '"' + named(w("shell.search"), w("shell.search.holds")) + ">" + I("search") + (narrow ? "" : "<span>" + w("shell.search") + "</span>") + "</a>"
      + '<button type="button" class="cs-btn mk-lvlbtn" data-tone="quiet" data-shell="level" aria-label="' + level + '"' + named(level, w("shell.level.holds")) + ">" + I("question") + label(level) + "</button>"
      + (REACHABLE ? '<button type="button" class="cs-btn" data-tone="quiet" data-shell="dock" aria-expanded="' + DOCK + '" aria-label="' + w("shell.assistant") + '"' + named(w("shell.assistant"), w("shell.assistant.holds")) + ">" + I("machine") + label(w("shell.assistant")) + "</button>" : "")
      + (badge() && !narrow ? '<a class="cs-kind mk-hide-phone" data-kind="todo" href="' + placeHref("queue") + '" data-nav' + tipAttr(waiting, 1) + ">" + I("queue") + w("shell.todo", { n: String(badge()) }) + "</a>" : "")
      + '<span class="mk-menuwrap"><button type="button" class="mk-avatar" data-shell="menu" aria-haspopup="menu" aria-expanded="' + !!MENU + '" aria-controls="cs-menu"'
      + ' aria-label="' + (handle ? w("shell.you", { handle }) : w("shell.you.holds")) + '"' + named(handle ? w("shell.you", { handle }) : w("shell.you.holds"), w("shell.you.holds")) + ">"
      + (handle ? '<span aria-hidden="true">' + esc(handle.slice(0, 1).toUpperCase()) + "</span>" : I("subject")) + "</button>"
      + '<div class="cs-dialog mk-menu" id="cs-menu" role="menu" aria-label="' + w("shell.menu.name") + '"' + (MENU ? "" : " hidden") + ">"
      + '<h2 class="eyebrow" tabindex="0"' + tipAttr(w("shell.menu.says"), 2) + ">" + w("shell.menu.name") + "</h2>"
      + (haveName ? '<p class="muted">' + w("shell.menu.who", { name: shown ? shown : html(w("shell.group.unnamed")), handle }) + "</p>" : "")
      + '<a class="cs-btn" data-tone="quiet" role="menuitem" href="' + esc(accountHref) + '" data-nav>' + w("shell.menu.account") + "</a>" + signout
      + '<div role="group" aria-label="' + w("shell.appearance") + '"><span class="eyebrow">' + w("shell.appearance") + "</span>" + themes + "</div></div></span></header>";
  }
  /* R48: the main frame's root names the registered screen it drew; the shell's own fallbacks name none */
  const screenAttr = () => (MAIN && !MAIN.unavail && !UNREACHED && !ENTRY_PAGE ? ' data-screen="' + esc(MAIN.spec.id) + '"' : "");
  /* R36, R53, R58: the test-instance band, above every frame and spanning it: served in the page while the instance is a
     test one (from first paint, so nothing moves when `bootstrap` answers), drawn by the page when `bootstrap` answers
     `test_instance: true` and it was not served, removed when it answers otherwise; its words follow the member's */
  /* R67: the design's `.cs-band[data-band="test"]`: the machine icon, `instance.test.band`, then `instance.test.notice` */
  const testBandHtml = () => I("machine") + "<b>" + w("instance.test.band") + "</b> <span>" + w("instance.test.notice") + "</span>";
  function testBand() {
    const root = doc.getElementById("cs-root");
    let band = doc.getElementById("cs-testband");
    if (!BOOT_READ && band) { band.innerHTML = testBandHtml(); return; }
    if (!(BOOT && BOOT.test_instance === true)) { if (band && band.parentElement) band.parentElement.removeChild(band); return; }
    if (!band && root && root.parentElement) {
      band = doc.createElement("div");
      band.setAttribute("class", "cs-band");
      band.setAttribute("data-band", "test");
      band.setAttribute("id", "cs-testband");
      band.setAttribute("role", "note");
      root.parentElement.insertBefore(band, root);
    }
    if (band) band.innerHTML = testBandHtml();
  }
  /* R96, R60: the number the masthead and the rail's Queue place draw: the queue's three kinds and the band a screen reports, drawn only
     once the queue read has answered and never at zero */
  const badge = () => (TODO === null ? 0 : TODO + BAND);
  const RAIL = ["home", "queue", "find", "add", "projects", "people", "settings"];
  const TABS = ["home", "queue", "add", "find", "more"];
  const RAIL_ICON = { home: "home", queue: "queue", find: "search", add: "add", projects: "project", people: "subject", settings: "settings", more: "settings" };
  function frameHtml(route) {
    if (GUIDEI) { GUIDEI.acts = []; GUIDEI.binds = []; }
    const shown = MAIN ? MAIN.spec.id : route.screen;
    const frame = ENTRY_PAGE || OUTSIDE ? "public" : MAIN ? frameOf(shown) : "working";
    if (frame !== "working") {
      /* R30, R45: the public, published and setup frames: no rail, tabs, dock or member menu */
      return '<div class="cs-frame" data-frame="' + esc(frame) + '" id="cs-frame"><main class="cs-main" id="cs-main"' + screenAttr() + ">" + mainHtml(route) + "</main></div>";
    }
    const place = placeOf(route.screen);
    const rail = RAIL.map((k) => '<a href="' + placeHref(k) + '" data-nav' + (place === k ? ' aria-current="page"' : "") + tipAttr(w("rail." + k + ".holds"), RAILW < 120 ? 1 : 2) + ">"
      + I(RAIL_ICON[k]) + w("rail." + k + ".name") + (k === "queue" && badge() ? '<span class="count">' + esc(badge()) + "</span>" : "") + "</a>").join("")
      + '<button type="button" class="cs-grip" data-shell="grip" role="separator" aria-orientation="vertical" aria-label="' + w("shell.width") + '" aria-valuemin="64" aria-valuemax="320" aria-valuenow="' + RAILW + '"' + tipAttr(w("shell.width.holds"), 2) + "></button>";
    const tabs = TABS.map((k) => '<a href="' + (k === "more" ? "/app/more" : placeHref(k)) + '" data-nav'
      + ((place === k || (k === "more" && ["projects", "people", "settings", "more"].includes(place))) ? ' aria-current="page"' : "")
      + tipAttr(k === "more" ? w("tab.more.holds") : w("rail." + k + ".holds"), 2) + ">" + I(RAIL_ICON[k]) + w(k === "more" ? "tab.more.name" : "rail." + k + ".name") + "</a>").join("");
    const main = mainHtml(route);
    const dock = dockHtml();
    /* R57: the band as drawn: "Working" and who sees it */
    const band = '<div class="cs-band" data-band="working"><span tabindex="0"' + tipAttr(w("mark.band.means") + '<span class="why">' + w("mark.path.working.means") + "</span>", 1) + "><b>" + w("mark.path.working.name") + "</b> " + w("shell.band.working") + "</span></div>";
    /* R75 (2) (N1106; DEC-251 (2)): after the first month the question is asked once, on Home only, of a member whose level is
       still the default: one note at the top of Home, above everything else on it; after either answer `level.keep.later` once */
    const onHome = route.screen === "home" && !!MAIN && !MAIN.unavail;
    const ask = onHome && ASK_LEVEL ? '<div class="cs-reason" role="region" data-level-note="ask"><p>' + w("level.keep.ask") + '</p><div class="mk-acts">'
      + '<button type="button" class="cs-btn" data-shell="level-keep" data-level-to="prompt">' + w("level.keep.prompt") + "</button>"
      + '<button type="button" class="cs-btn" data-shell="level-keep" data-level-to="pause">' + w("level.keep.pause") + "</button></div></div>"
      : onHome && KEEP_LATER ? '<div class="cs-reason" role="status" data-level-note="later"><p>' + w("level.keep.later") + "</p></div>" : "";
    /* R92 (A9): a newer version is ready, across the top of the frame, above the masthead and below the test-instance band; the
       button reloads, nothing reloads by itself */
    const update = NEWER ? '<div class="cs-testband mk-updband" role="status"><b>' + w("shell.update.title") + "</b><span>" + w("shell.update.says") + '</span><button type="button" class="cs-btn" data-tone="quiet" data-shell="reload"'
      + tipAttr("<b>" + w("shell.reload") + "</b>: " + w("shell.update.reload.does") + " " + w("shell.update.reload.warn"), 2) + ">" + w("shell.reload") + "</button></div>" : "";
    return '<div class="cs-frame cs-shell' + (dock ? " with-dock" : "") + (RAILW < 120 ? " rail-icons" : "") + '" data-frame="working" id="cs-frame" style="--rail:' + RAILW + 'px">'
      + update + mastHtml() + band + '<nav class="cs-rail" aria-label="' + w("shell.sections") + '">' + rail + "</nav>"
      + '<main class="cs-main" id="cs-main"' + screenAttr() + ">" + ask + main + "</main>" + dock
      + '<nav class="cs-tabs" aria-label="' + w("shell.sections") + '">' + tabs + "</nav></div>";
  }
  /* R33, R34: the lock over the screen, and the password asked again; R41: what the key signs, exactly */
  let REAUTH = null, DIALOG = null, OVERLAY_REFUSAL = "";
  function overlayHtml() {
    const field = (id) => '<span class="cs-field"><label for="' + id + '">' + w("shell.password") + '</label><input id="' + id + '" class="cs-input" type="password" autocomplete="current-password"></span>';
    const slot = '<span class="mk-slot" data-overlay-refusal>' + OVERLAY_REFUSAL + "</span>";
    if (LOCKED) {
      const who = S ? S.w || (ME && ME.handle) || "" : "";
      return '<div class="mk-scrim"><div class="cs-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-lock-t" data-overlay="lock"><h2 id="cs-lock-t">' + w("shell.lock.title") + "</h2><p>" + w("session.locked") + "</p>"
        + field("cs-lock-pw") + slot + '<span class="mk-acts"><button type="button" class="cs-btn" data-tone="primary" data-shell="unlock">' + w("shell.lock.unlock") + "</button>"
        + '<button type="button" class="cs-btn" data-tone="quiet" data-shell="lock-other">' + w("shell.lock.other", { handle: who }) + "</button></span></div></div>";
    }
    if (REAUTH) {
      return '<div class="mk-scrim"><div class="cs-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-reauth-t" data-overlay="reauth"><h2 id="cs-reauth-t">' + w("session.reauth.head") + "</h2><p>" + w("session.reauth") + "</p>"
        + field("cs-reauth-pw") + slot + '<span class="mk-acts"><button type="button" class="cs-btn" data-tone="primary" data-shell="reauth"' + tipAttr(w("session.reauth.go_does"), 2) + ">" + w("session.reauth.go") + "</button>"
        + '<button type="button" class="cs-btn" data-tone="quiet" data-shell="reauth-cancel"' + tipAttr(w("session.reauth.cancel_does"), 2) + ">" + w("shell.cancel") + "</button></span></div></div>";
    }
    if (DIALOG && DIALOG.kind === "register") {
      return '<div class="mk-scrim"><div class="cs-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-key-t" data-overlay="register"><h2 id="cs-key-t">' + w("shell.signer.passphrase") + "</h2>"
        + '<span class="cs-field"><label for="cs-key-pass">' + w("shell.signer.passphrase") + '</label><span class="help" id="cs-key-pass-help">' + w("shell.signer.passphrase.help")
        + '</span><input id="cs-key-pass" class="cs-input" type="password" autocomplete="new-password" aria-describedby="cs-key-pass-help"></span>'
        + '<span class="cs-field"><label for="cs-key-again">' + w("shell.signer.passphrase.again") + '</label><input id="cs-key-again" class="cs-input" type="password" autocomplete="new-password"></span>'
        + slot + '<span class="mk-acts"><button type="button" class="cs-btn" data-tone="primary" data-shell="dialog-yes">' + w("shell.signer.makefile") + "</button>"
        + '<button type="button" class="cs-btn" data-tone="quiet" data-shell="dialog-no">' + w("shell.cancel") + "</button></span></div></div>";
    }
    if (DIALOG && DIALOG.kind === "sign") {
      const fileBox = DIALOG.fileGiven ? "" : '<span class="cs-field"><label for="cs-key-file">' + w("shell.signer.loadfile")
        + '</label><textarea id="cs-key-file" class="cs-input" spellcheck="false" autocomplete="off"></textarea></span>';
      const load = DIALOG.needKey ? '<fieldset class="cs-field"><legend>' + w("shell.signer.load") + '</legend>' + fileBox + '<span class="cs-field"><label for="cs-key-filepass">' + w("shell.signer.loadpass")
        + '</label><input id="cs-key-filepass" class="cs-input" type="password" autocomplete="off"></span></fieldset>' : "";
      return '<div class="mk-scrim"><div class="cs-dialog" role="dialog" aria-modal="true" aria-labelledby="cs-sign-t" data-overlay="sign"><h2 id="cs-sign-t">' + w("shell.signer.exactly") + "</h2><ol>"
        + DIALOG.list.map((s) => "<li><b>" + soft(s.label) + "</b><code>" + soft(s.line) + "</code></li>").join("") + "</ol>" + load + "<p>" + w("signing.ceremony.device") + "</p>"
        + slot + '<span class="mk-acts"><button type="button" class="cs-btn" data-tone="primary" data-shell="dialog-yes">' + w("shell.signer.sign") + "</button>"
        + '<button type="button" class="cs-btn" data-tone="quiet" data-shell="dialog-no">' + w("shell.signer.decline") + "</button></span></div></div>";
    }
    return "";
  }
  /* R15 (DEC-177 (1)): no explaining element inside another: an explaining element absorbs those inside it, said after
     its own, so whatever a screen draws, one element carries one explanation. */
  function absorb(root) {
    for (const el of root.querySelectorAll("[data-tip]")) {
      const outer = el.parentElement ? el.parentElement.closest("[data-tip]") : null;
      if (!outer) continue;
      outer.setAttribute("data-tip", outer.getAttribute("data-tip") + '<span class="why">' + el.getAttribute("data-tip") + "</span>");
      el.removeAttribute("data-tip");
      el.removeAttribute("data-level");
    }
  }
  let MENU = false, DRAWN = {}, SHOWN_FOR = null, QUIET_FOCUS = false;
  /* R133 (T51 fix round 10, C-M12, C-M16): a fold is known across a redraw by its own name (its id, `data-fold`, `data-start`, else its
     summary) and its place among those of that name */
  function foldsOf(root) {
    const seen = {};
    return Array.from(root.querySelectorAll("details")).map((d) => {
      const s = d.querySelector("summary");
      const k = d.id || d.getAttribute("data-fold") || d.getAttribute("data-start") || (s ? s.textContent : "");
      seen[k] = (seen[k] || 0) + 1;
      return [d, k + "#" + seen[k]];
    });
  }
  /* every fold enclosing an element is opened, so what is drawn in it is seen (R133; the ring's rule, B3) */
  function openAround(el) {
    for (let d = el && el.closest ? el.closest("details") : null; d; d = d.parentElement && d.parentElement.closest ? d.parentElement.closest("details") : null) d.setAttribute("open", "");
  }
  const focusKey = (el) => (!el || !el.getAttribute ? null : el.id ? "#" + el.id
    : ["data-shell", "data-ai", "data-table", "data-id", "data-col", "data-theme-to", "data-areas", "data-i"].map((a) => (el.getAttribute(a) !== null ? "[" + a + '="' + el.getAttribute(a) + '"]' : "")).join("") || null);
  function draw() {
    const root = doc.getElementById("cs-root");
    if (!root || !ROUTE) return;
    closeTip();
    const values = {};
    for (const el of root.querySelectorAll("input, textarea, select")) if (el.id && el.type !== "file") values[el.id] = el.type === "checkbox" || el.type === "radio" ? { checked: el.checked } : { value: el.value };
    /* R35: what was typed is kept while the screen cannot be reached, and comes back with it */
    if (MAIN && MAIN.unavail === "unreachable" && Object.keys(values).length) MAIN.stash = Object.assign({}, MAIN.stash || {}, values);
    /* K4194 (B15): a file input cannot be given its file again, so the node itself is carried into the new tree */
    const chosen = {};
    for (const el of root.querySelectorAll("input")) if (el.id && el.type === "file" && el.files && el.files.length) chosen[el.id] = el;
    /* R9 (fix round 2, C79): a redraw of the screen already shown keeps its scroll and its focus (R93); a navigation opens the
       screen at the top with nothing carried over from the one left */
    const shownFor = MAIN || ROUTE, same = SHOWN_FOR === shownFor;
    SHOWN_FOR = shownFor;
    const fk = same ? focusKey(doc.activeElement) : null;
    /* R133: the folds the member had open, of the screen already shown */
    const openFolds = same ? new Set(foldsOf(root).filter((f) => f[0].hasAttribute("open")).map((f) => f[1])) : new Set();
    /* R93: a redraw in place leaves the main column where it was scrolled to */
    const before = doc.getElementById("cs-main"), top = same && before ? before.scrollTop : 0;
    root.innerHTML = frameHtml(ROUTE) + overlayHtml();
    const after = doc.getElementById("cs-main");
    if (after && top) after.scrollTop = top;
    /* R59: the guide's marks in the title row of a working screen that is drawn */
    if (!UNREACHED && !ENTRY_PAGE && (MAIN ? !MAIN.unavail && frameOf(MAIN.spec.id) === "working" : D.places.includes(ROUTE.screen))) placeMarks(root, marksHtml());
    absorb(root);
    for (const [id, old] of Object.entries(chosen)) {
      const fresh = doc.getElementById(id);
      if (fresh && fresh !== old && fresh.type === "file" && fresh.parentNode) { fresh.parentNode.insertBefore(old, fresh); fresh.parentNode.removeChild(fresh); }
    }
    /* K4195 (B16): what the member typed is put back only into a field the new draw left empty, or drew as the previous draw did;
       a value the screen drew since (from a read that arrived) is never written over. `DRAWN` is what each field held as drawn. */
    const restore = (id, v) => {
      const el = doc.getElementById(id);
      if (!el || el.getAttribute("data-shell") === "pick") return;
      /* G77 (fix round 7): a group of boxes that redraws on a change (`data-redraw`) is drawn from the screen's own state; what the member
         had checked is put back nowhere, or a box the member pressed would be checked again in the screen it just changed */
      if (el.closest && el.closest("fieldset[data-redraw]")) return;
      if ("checked" in v) { if (el.checked === !!DRAWN[id]) el.checked = v.checked; }
      else { const d = drawnValue(el); if (d === "" || d === (DRAWN[id] === undefined ? "" : DRAWN[id])) el.value = v.value; }
    };
    /* a select's value is drawn only when the screen marked an option `selected`; the browser's default first option is no choice */
    function drawnValue(el) {
      if (el.localName !== "select") return el.value;
      const o = Array.from(el.querySelectorAll("option")).find((x) => x.hasAttribute("selected"));
      return o ? o.getAttribute("value") || "" : "";
    }
    const asDrawn = {};
    for (const el of root.querySelectorAll("input, textarea, select")) if (el.id && el.type !== "file") asDrawn[el.id] = el.type === "checkbox" || el.type === "radio" ? !!el.checked : drawnValue(el);
    for (const [id, v] of Object.entries(values)) restore(id, v);
    DRAWN = asDrawn;
    for (const inst of [MAIN, DOCKI, GUIDEI]) {
      if (!inst) continue;
      if (inst.pending) { for (const [id, v] of Object.entries(inst.pending)) restore(id, v); inst.pending = null; }
      /* R27: a field filled before it was drawn takes its value once it is */
      for (const [id, v] of Object.entries(inst.fills)) { const el = doc.getElementById(id); if (el) { if (el.type === "checkbox" || el.type === "radio") el.checked = !!v; else el.value = String(v == null ? "" : v); delete inst.fills[id]; } }
      /* K3143: a filled draft's label beside its field */
      for (const [id, l] of Object.entries(inst.labels)) {
        const el = doc.getElementById(id);
        if (!el || !el.parentElement) continue;
        const span = doc.createElement("span");
        span.setAttribute("class", "cs-draftlabel");
        span.innerHTML = I("machine") + wordOrData(l);
        el.parentElement.insertBefore(span, el.nextElementSibling);
      }
    }
    ringDraw(root);
    testBand();
    /* R68, R9 (fix round 2, C78, C79): the focus put back after a redraw neither scrolls the column nor opens the explanation of
       the control the member has just pressed */
    if (fk) {
      let el = null;
      try { el = root.querySelector(fk); } catch { el = null; }
      if (el && el.focus) { QUIET_FOCUS = true; try { el.focus({ preventScroll: true }); } finally { QUIET_FOCUS = false; } }
    }
    restoreRefusals();
    /* R133: a fold stays open that the member had open, that holds an act's answer or refusal (or its open reason box), or a control whose
       value the member set; a fold with none of these is as the screen drew it */
    for (const [d, k] of foldsOf(root)) {
      let hold = openFolds.has(k);
      if (!hold) for (const s of d.querySelectorAll("[data-slot]")) if (String(s.innerHTML).trim() !== "") { hold = true; break; }
      if (!hold) for (const el of d.querySelectorAll("input, textarea, select")) {
        if (!el.id || el.type === "file" || el.getAttribute("data-shell") === "pick") continue;
        const box = el.type === "checkbox" || el.type === "radio", first = el.localName === "select" ? el.querySelector("option") : null;
        const drew = box ? !!asDrawn[el.id] : el.localName === "select" ? (asDrawn[el.id] || (first ? first.getAttribute("value") || "" : "")) : asDrawn[el.id];
        if ((box ? !!el.checked : el.value) !== drew) { hold = true; break; }
      }
      if (hold) d.setAttribute("open", "");
    }
    doc.title = titleOf();
  }
  /* R84 (N1184; DEC-299 (12)): the browser tab's title: `page.title` ({screen}, {team}), and on a public page `page.title.public`
     ({page}, {team}); the screen by its `screen.<id>.name`, the team by R60's name */
  function titleOf() {
    const team = GROUP || (GROUP_KNOWN ? null : LAST_GROUP) || textOf(w("shell.group.unnamed"));
    const id = OUTSIDE || ROUTE.malformed ? "unavailable" : MAIN && !MAIN.unavail ? MAIN.spec.id : ROUTE.screen;
    const name = has("screen." + id + ".name") ? textOf(w("screen." + id + ".name"))
      : D.places.includes(ROUTE.screen) ? textOf(w(ROUTE.screen === "more" ? "shell.more" : "rail." + ROUTE.screen + ".name")) : textOf(w("screen.unavailable.name"));
    const plain = OUTSIDE || ENTRY_PAGE || (MAIN && D.publicPages.includes(MAIN.spec.id));
    return plain ? textOf(w("page.title.public", { page: name, team })) : textOf(w("page.title", { screen: name, team }));
  }

  /* ---------- navigation ---------- */
  function navigate(href, replace) {
    if (replace) win.history.replaceState({}, "", href); else win.history.pushState({}, "", href);
    route();
  }
  /* R21 (K2998): a screen's `closed(cs, view)` when the member leaves it or the page; R27: its timers cancelled */
  function closing(inst) {
    if (!inst) return;
    for (const t of inst.timers) clearTimeout(t);
    inst.timers = [];
    /* R93: a refreshing read's timers are cancelled with the screen (R27's rule); R91: a selection is page memory only */
    for (const t of Object.values(inst.typingT)) clearTimeout(t);
    inst.typingT = {};
    for (const t of Object.values(inst.refreshT)) clearTimeout(t);
    inst.refreshT = {};
    inst.words = {};
    for (const k of [...ACTSTATE.keys()]) if (k.startsWith(inst.key + "|")) ACTSTATE.delete(k);
    for (const k of [...REFUSED.keys()]) if (k.startsWith(inst.key + "|")) REFUSED.delete(k);
    if (inst.retry !== null) { clearTimeout(inst.retry); inst.retry = null; }
    /* R49: the images' object addresses released with the screen */
    for (const im of Object.values(inst.images)) if (im.url) { try { win.URL.revokeObjectURL(im.url); } catch { /* released */ } im.url = null; }
    if (typeof inst.spec.closed !== "function") return;
    try { inst.spec.closed(kit(inst), inst.view); } catch { /* a screen's own leave-taking never stops the shell */ }
  }
  let ROUTING = 0;
  /* R127 (G31): `keep` continues the load that is open (the session handed over a second time, `signedIn`): the route opens no new epoch, so the
     frame's reads sent for the first hand-over are the reads the screen's identical ones share */
  async function route(keep) {
    const n = ++ROUTING;
    if (keep !== true) newEpoch();
    LOADING = true;
    closing(MAIN);
    closing(DOCKI);
    MAIN = null; DOCKI = null; ENTRY_PAGE = false; RING = null; KEEP_LATER = false;
    ROUTE = parse(win.location.pathname);
    /* R7, R9 (fix round 2, C24): the address of a place that holds one built screen (`/app/find`) is that screen's own, so
       "comes later" is drawn only for a place with no built screen */
    if (!ROUTE.root && !ROUTE.outside && !ROUTE.malformed && !screenOf(ROUTE.screen) && Object.hasOwn(D.placeScreens, ROUTE.screen)) {
      const to = placeHref(ROUTE.screen);
      if (to !== "/app/" + ROUTE.screen) { win.history.replaceState({}, "", to); ROUTE = parse(win.location.pathname); }
    }
    OUTSIDE = !!ROUTE.outside;
    MENU = false;
    /* R79: an address outside the team's pages draws `unavailable` in the public frame, reading no session */
    if (OUTSIDE) return draw();
    let id = ROUTE.screen;
    /* R30: a screen of the public or published frame, drawn without a session, asking no record */
    if (sessionless(id) && !ROUTE.root) return show(id);
    if (!S && !RECORD_READ) {
      RECORD_READ = true;
      S = readRecord();
      if (S && ROUTE.root) { win.history.replaceState({}, "", "/app"); ROUTE = parse(win.location.pathname); id = ROUTE.screen; }
    }
    if (sessionless(id)) return show(id);
    if (!S) {
      /* R45: a screen of the setup frame asks no session before one exists */
      if (frameOf(id) === "setup") return show(id);
      /* R32: no live record: `front`, keeping the path to return to */
      keepReturn();
      return showFront();
    }
    const signedAlready = !!ME;
    if (!ME) {
      draw();
      const got = await whoami();
      if (n !== ROUTING) return;
      /* R45: a screen of the setup frame stays, whatever the record turns out to hold */
      if (frameOf(id) === "setup" && got !== "ok") { UNREACHED = false; LOCKED = false; return show(id); }
      if (got === "unreachable") return draw();
      if (got === "locked") {
        /* R32, R33: a page opened on a locked session draws `front` locked (the shell's own lock without `front`) */
        keepReturn();
        if (screenOf("front")) { ENTRY = { state: "locked", handle: S.w || null }; return showFront(); }
        return lock(false);
      }
      if (got === "none") { keepReturn(); ENTRY = { state: null, handle: null }; return showFront(); }
    }
    /* R5's Suggestions: a failed `interfacewords` read is tried once more, on the next screen change */
    if (signedAlready && !wordsRead && wordsRetry) { wordsRetry = false; loadWords(); }
    show(id);
  }
  function show(id, subject) {
    const spec = ROUTE.malformed ? null : screenOf(id);
    MAIN = spec && spec.id !== "assistant" ? instance(spec, subject !== undefined ? subject : ROUTE.subject, "m", null, subject !== undefined ? null : ROUTE.project) : null;
    if (ME && S && frameOf(id) === "working") startVersion();
    DOCKI = !MAIN || frameOf(MAIN.spec.id) === "working" ? (REACHABLE && screenOf("assistant") ? instance(screenOf("assistant"), ROUTE.subject, "d", { screen: ROUTE.screen, subject: ROUTE.subject }) : null) : null;
    draw();
    const n = ROUTING;
    const reads = MAIN && (MAIN.pub || ME) ? readAll(MAIN) : Promise.resolve();
    if (DOCKI && DOCK && ME) readAll(DOCKI);
    if (COUNT_DUE && ME && S && frameOf(id) === "working") countQueue(MAIN, reads);
    /* G12b: the guide's marks are asked now, beside the screen's reads, and `bootstrap` after them, so neither waits for the other */
    marksAhead();
    startBoot();
    if (doc.getElementById("cs-main") && doc.getElementById("cs-main").scrollTo) doc.getElementById("cs-main").scrollTo(0, 0);
    /* K3143: the guide told the screen it is on, once the screen's reads have settled */
    reads.then(() => { if (n === ROUTING) closeLoad(); });
    reads.then(frameRevalidate);
    reads.then(() => { if (n === ROUTING && ROUTE) guideCall("entered", { screen: ROUTE.screen, subject: ROUTE.subject }); });
  }
  function showFront() {
    if (screenOf("front")) return show("front", null);
    ENTRY_PAGE = true;
    draw();
    if (ROUTE) guideCall("entered", { screen: ROUTE.screen, subject: ROUTE.subject });
  }

  /* ---------- the session's start, hand-over and end (R3, R32, R33) ---------- */
  /* `whoami` for the record held: "ok", a member session; "locked", the plane's lock; "none", no member session (the
     record cleared); "unreachable", no answer or a 5xx (tried again every 30 seconds, R35) */
  async function whoami(background) {
    const who = await call("whoami", { background, noLock: true });
    if (!S) return "none";
    if (who.kind === "ok" && who.value && who.value.session && who.value.member) {
      UNREACHED = false;
      ME = who.value;
      armIdle();
      /* R86 (N1161 F11): what the frame needs is asked at once, together and with the screen's own reads (the caller shows the
         screen on this answer): the words, the team's name, the queue, the level and the assistant's four reads; none waits
         for another, and a screen's first draw never waits for the words (they redraw it when they arrive, R5) */
      loadWords().then(() => { wordsRetry = !wordsRead; });
      frameBoot();
      return "ok";
    }
    if (unreachable(who)) {
      UNREACHED = true;
      setTimeout(async () => { if (S && UNREACHED && (await whoami(true)) !== "unreachable") { UNREACHED = false; route(); } }, D.retry);
      return "unreachable";
    }
    if (who.kind === "refused" && who.code === "SESSION_LOCKED") return "locked";
    S = null; ME = null; clearRecord(null);
    return "none";
  }
  /* R32 (screens-entry R2, R6, R7): a screen hands over the session `login` answered: the record written for every tab,
     then the page kept to return to, else Home; `stay` keeps the screen (a setup or join that goes on) */
  async function signedIn(answer, o = {}) {
    const a = answer && typeof answer === "object" && answer.result && typeof answer.result === "object" ? answer.result : answer;
    if (!(a && typeof a.token === "string" && a.token)) return false;
    const e = typeof a.expires === "number" ? a.expires : Date.parse(a.expires) || 0;
    const next = { t: a.token, e, d: o.device === "own" ? "own" : "shared", w: typeof o.handle === "string" ? o.handle : "" };
    /* R127 (G31, A-27): the session handed over again, as it is (`front` hands it over to stay and read `whoami`, then to open the page kept),
       is the one session: its record is not written again and `whoami`, the words and the frame's reads are not sent again; only the page kept
       is opened. A different token, handle or device, or a session whose `whoami` has not answered, is a new hand-over. */
    const again = !!(S && ME && !LOCKED && S.t === next.t && S.e === next.e && S.d === next.d && S.w === next.w);
    if (!again) {
      S = next;
      writeRecord(S);
      ME = null; LOCKED = false; ENTRY = { state: null, handle: null };
    }
    activity();
    /* a hand-over that stays is the first half of one sign-in load: its reads stay shared for the second (R123, R127) */
    if (o.stay) { LOADING = true; const got = again ? "ok" : await whoami(); draw(); return got === "ok"; }
    win.history.replaceState({}, "", takeReturn());
    await route(again);
    return !!ME;
  }
  /* R46: a screen that sent `signout` (or `signouteverywhere`) itself: the record cleared, `front` signed out */
  function signedOut() {
    if (S) over("signedout");
    else { ENTRY = { state: "signedout", handle: null }; route(); }
  }
  /* R33, R46: `front`'s locked state unlocked by its own `unlock` act: back to the page kept, as it was */
  async function unlocked() {
    LOCKED = false; local.del(STATE_KEY); ENTRY = { state: null, handle: null };
    activity();
    ME = null;
    win.history.replaceState({}, "", takeReturn());
    await route();
  }
  /* R4: sign out, whatever the answer: the record cleared for every tab, `front` drawn signed out */
  async function signOut() {
    if (S) { try { await call("signout", { body: {} }); } catch { /* whatever the answer */ } }
    if (S) over("signedout");
    else { ENTRY = { state: "signedout", handle: null }; route(); }
  }
  /* R33 (K3061 D3): the member's own input and acts are activity; the page's clock locks an own device at 30 minutes
     idle and signs a shared one out at 15, the plane's answer governing over it */
  let LAST = Date.now(), SHARED_AT = 0, idleT = null;
  function activity() {
    /* R33 (K3156): only while a session record exists; with none (the public frame before sign-in) nothing is stored */
    if (!S && !readRecord()) return;
    LAST = Date.now();
    if (LAST - SHARED_AT >= 10000 || SHARED_AT > LAST) { SHARED_AT = LAST; local.set(ACTIVE_KEY, String(LAST)); }
  }
  const lastActive = () => Math.max(LAST, Number(local.get(ACTIVE_KEY)) || 0);
  function stopIdle() { if (idleT !== null) clearTimeout(idleT); idleT = null; }
  function armIdle() {
    stopIdle();
    if (!S || LOCKED) return;
    const limit = S.d === "own" ? D.idleLock : D.idleEnd;
    idleT = setTimeout(idleCheck, Math.max(0, lastActive() + limit - Date.now()));
  }
  async function idleCheck() {
    idleT = null;
    if (!S || LOCKED) return;
    const limit = S.d === "own" ? D.idleLock : D.idleEnd;
    if (Date.now() - lastActive() < limit) return armIdle();
    if (S.d === "own") return lock(false);
    try { await call("signout", { body: {}, background: true }); } catch { /* the page's clock ends it whatever the answer */ }
    over("ended");
  }
  function lock(elsewhere) {
    if (!S || LOCKED) return;
    LOCKED = true; OVERLAY_REFUSAL = ""; stopIdle(); frameDrop();
    if (!elsewhere) local.set(STATE_KEY, "locked");
    closeTip();
    draw();
    const pw = doc.getElementById("cs-lock-pw");
    if (pw && pw.focus) pw.focus();
  }
  async function unlockNow() {
    const pw = doc.getElementById("cs-lock-pw");
    const password = pw ? String(pw.value || "") : "";
    if (!password) return;
    const a = await call("unlock", { body: { password } });
    const field = doc.getElementById("cs-lock-pw");
    if (field) field.value = "";
    if (a.kind === "ok") {
      LOCKED = false; OVERLAY_REFUSAL = ""; local.del(STATE_KEY);
      activity();
      if (!ME) return route();
      armIdle(); draw();
      return;
    }
    if (!S) return;
    OVERLAY_REFUSAL = refusalHtml(a.kind === "refused" ? refusalWords(a, null, null) : w("shell.noanswer"));
    draw();
  }
  /* R34: the password asked again; answers whether `reauth` opened its window */
  function reauthAsk() {
    if (!S) return Promise.resolve(false);
    if (REAUTH) return REAUTH.promise;
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    REAUTH = { promise, resolve };
    OVERLAY_REFUSAL = "";
    draw();
    const pw = doc.getElementById("cs-reauth-pw");
    if (pw && pw.focus) pw.focus();
    return promise;
  }
  async function reauthNow(go) {
    const r = REAUTH;
    if (!r) return;
    if (!go) { REAUTH = null; OVERLAY_REFUSAL = ""; draw(); return r.resolve(false); }
    const pw = doc.getElementById("cs-reauth-pw");
    const password = pw ? String(pw.value || "") : "";
    if (!password) return;
    const a = await call("reauth", { body: { password } });
    const field = doc.getElementById("cs-reauth-pw");
    if (field) field.value = "";
    if (a.kind === "ok") { REAUTH = null; OVERLAY_REFUSAL = ""; draw(); return r.resolve(true); }
    if (!S || LOCKED) { REAUTH = null; return r.resolve(false); }
    /* R75 (3): a refusal of the password is `session.reauth.wrong` beside the field; nothing is resent and the act is not lost */
    OVERLAY_REFUSAL = refusalHtml(a.kind === "refused" ? w("session.reauth.wrong") : w("shell.noanswer"));
    draw();
  }

  /* ---------- the dock's wizard guide and the ring (R31) ---------- */
  /* K3143: `cs.wizard(script, version, o)` hands the start to the guide; it draws itself in the dock while it runs */
  function startWizard(script, version, o) {
    if (!GUIDEI || typeof GUIDE.start !== "function") return false;
    try { GUIDE.start(kit(GUIDEI), GUIDEI.view, Object.assign({}, o || {}, { script, version: version === undefined ? null : version })); } catch { return false; }
    draw();
    return true;
  }
  function guideCall(name, arg) {
    if (!GUIDEI || typeof GUIDE[name] !== "function") return;
    try { GUIDE[name](kit(GUIDEI), GUIDEI.view, arg); } catch { /* the guide's own work never stops the shell */ }
  }
  /* R51 (K3156): a control the guide drew (in its panel or its marks) carrying `data-guide="<control>"`, pressed by click,
     Enter or Space: handed to `GUIDE.control(cs, view, control, dataset)`, its `data-*` as the dataset; no op is sent */
  const guideControl = (t) => {
    const el = GUIDEI && t && t.closest ? t.closest("[data-guide]") : null;
    return el && el.closest('.cs-dock[data-panel="guide"], [data-guide-from]') ? el : null;
  };
  let GUIDE_KEYED = null;
  function guidePress(el) {
    if (typeof GUIDE.control !== "function") return;
    const dataset = Object.assign({}, el.dataset || {});
    const control = el.getAttribute("data-guide");
    let r;
    try { r = GUIDE.control(kit(GUIDEI), GUIDEI.view, control, dataset); } catch { return draw(); }
    if (r && typeof r.then === "function") r.then(() => draw(), () => draw()); else draw();
  }
  /* `cs.ring(op, label)`: the control the current screen drew for `op` rung, its row panel opened, scrolled to and
     focused; answers whether there was one. The shell never presses it. */
  function ring(op, label) {
    if (!MAIN) return false;
    const main = () => doc.getElementById("cs-main");
    const find = () => (main() ? main().querySelector('[data-act="' + String(op).replace(/"/g, "") + '"]') : null);
    let el = find();
    if (!el) return false;
    const panel = el.closest ? el.closest("tr.cs-panel") : null;
    if (panel && panel.hidden) {
      const row = panel.previousElementSibling;
      const ctl = row ? row.querySelector('[data-shell="row"]') : null;
      if (ctl) {
        const table = ctl.getAttribute("data-table"), id = ctl.getAttribute("data-id");
        const open = MAIN.ui["open:" + table] || (MAIN.ui["open:" + table] = []);
        if (!open.includes(id)) open.push(id);
      }
    }
    RING = { op: String(op), label: typeof label === "string" && label ? label : null };
    draw();
    el = find();
    if (!el) return false;
    if (el.scrollIntoView) { try { el.scrollIntoView({ block: "center", behavior: "auto" }); } catch { /* best effort */ } }
    if (el.focus) el.focus();
    return true;
  }
  function ringDraw(root) {
    if (!RING || !MAIN) return;
    const main = root.querySelector("#cs-main");
    const el = main ? main.querySelector('[data-act="' + RING.op.replace(/"/g, "") + '"]') : null;
    if (!el) return;
    /* B3: a closed fold around the control is opened, every one enclosing it, so the ring is never on a hidden control */
    openAround(el);
    /* the design's ring (`cs-target`) and its label */
    el.classList.add("cs-target");
    const label = doc.createElement("span");
    label.setAttribute("class", "cs-target-label mk-ringlabel");
    label.setAttribute("id", "cs-ringlabel");
    label.innerHTML = w(RING.label || (el.tagName === "BUTTON" ? "shell.ring.ready" : "shell.ring.here"));
    if (el.parentElement) el.parentElement.insertBefore(label, el);
  }

  /* ---------- a newer version (R92; DEC-330 A9) ---------- */
  /* `GET /version` (plain text, a public address: no Authorization header, no session, no activity, no log) once when the
     working frame opens and every five minutes while the page is visible, on the page's clock; the first answer is the version
     the page runs, a later one that differs draws the band, which stays until its button is pressed. */
  const VERSION_MS = 5 * 60 * 1000;
  let VERSION = null, NEWER = false, VT = null, VSTARTED = false;
  async function pollVersion() {
    VT = null;
    if (doc.hidden !== true) {
      let v = null;
      try {
        const r = await win.fetch("/version", { cache: "no-store" });
        const type = r && r.headers && typeof r.headers.get === "function" ? String(r.headers.get("content-type") || "") : "";
        if (r && r.ok && /^text\//i.test(type)) v = String(await r.text()).trim();
      } catch { v = null; }
      if (v) { if (VERSION === null) VERSION = v; else if (v !== VERSION && !NEWER) { NEWER = true; draw(); } }
    }
    if (VSTARTED) VT = setTimeout(pollVersion, VERSION_MS);
  }
  function startVersion() { if (VSTARTED) return; VSTARTED = true; pollVersion(); }
  function stopVersion() { VSTARTED = false; if (VT !== null) clearTimeout(VT); VT = null; }

  /* ---------- the signer (R40–R42; DEC-207, DEC-208, DEC-210; K3079 (a), K3080) ---------- */
  /* The member's Ed25519 key, made in this browser and never sent: kept, by the member's choice, as a non-extractable key
     in this origin's IndexedDB; otherwise given out once as a key file (`signatures` R43's `BIOKEY1.`, made here) and held
     in page memory for this sitting only. A key file already held is loaded for the sitting only. Signatures are
     SSHSIG (version 1, `ssh-ed25519`, `sha512`), the exact form `ssh-keygen -Y sign` makes. */
  const enc = new TextEncoder();
  const u8 = (...a) => { let n = 0; for (const p of a) n += p.length; const o = new Uint8Array(n); let i = 0; for (const p of a) { o.set(p, i); i += p.length; } return o; };
  const b64 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return win.btoa(s); };
  const unb64 = (s) => Uint8Array.from(win.atob(String(s).replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const sshStr = (v) => { const b = typeof v === "string" ? enc.encode(v) : v; return u8(u32(b.length), b); };
  const wirePub = (raw32) => u8(sshStr("ssh-ed25519"), sshStr(raw32));
  const LABEL = "bio-ratify";
  const PKCS8_HEAD = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
  const KDF_ITER = 600000;
  let SITTING = null;
  const subtle = () => win.crypto.subtle;
  const lineOf = (raw32, comment) => { const keyB64 = b64(wirePub(raw32)); return { line: "ssh-ed25519 " + keyB64 + " " + comment, keyB64, comment }; };
  function idb(mode, fn) {
    return new Promise((resolve) => {
      let req;
      try { req = win.indexedDB.open("civicsmith-signer", 1); } catch { return resolve(null); }
      req.onupgradeneeded = () => { try { req.result.createObjectStore("keys"); } catch { /* already made */ } };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction("keys", mode);
          const r = fn(tx.objectStore("keys"));
          r.onsuccess = () => resolve(r.result === undefined ? null : r.result);
          r.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    });
  }
  const kept = () => idb("readonly", (st) => st.get("own"));
  async function seedKeys(seed) {
    const pkcs8 = u8(PKCS8_HEAD, seed);
    const priv = await subtle().importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
    const jwk = await subtle().exportKey("jwk", await subtle().importKey("pkcs8", pkcs8, { name: "Ed25519" }, true, ["sign"]));
    return { priv, raw32: unb64(jwk.x.replace(/-/g, "+").replace(/_/g, "/")) };
  }
  async function wrapSeed(seed, pass) {
    const salt = win.crypto.getRandomValues(new Uint8Array(16));
    const iv = win.crypto.getRandomValues(new Uint8Array(12));
    const base = await subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    const key = await subtle().deriveKey({ name: "PBKDF2", salt, iterations: KDF_ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, seed));
    return ["BIOKEY1", LABEL, b64(salt), b64(iv), b64(ct), KDF_ITER].join(".");
  }
  async function unwrapKey(s, pass) {
    s = String(s || "").trim();
    if (s.startsWith("BIOKEY-RAW1.")) { const [, , seed] = s.split("."); const b = unb64(seed); if (b.length !== 32) throw new Error("not a key"); return b; }
    if (!s.startsWith("BIOKEY1.") || !pass) throw new Error("not a key");
    const [, , salt, iv, ct, iter] = s.split(".");
    if (!/^[1-9][0-9]{0,6}$/.test(iter || "")) throw new Error("not a key");
    const base = await subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    const key = await subtle().deriveKey({ name: "PBKDF2", salt: unb64(salt), iterations: Number(iter), hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const seed = new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct)));
    if (seed.length !== 32) throw new Error("not a key");
    return seed;
  }
  async function sshsig(priv, raw32, namespace, message) {
    const h = new Uint8Array(await subtle().digest("SHA-512", message));
    const signed = u8(enc.encode("SSHSIG"), sshStr(namespace), sshStr(""), sshStr("sha512"), sshStr(h));
    const sig = new Uint8Array(await subtle().sign("Ed25519", priv, signed));
    const blob = u8(enc.encode("SSHSIG"), u32(1), sshStr(wirePub(raw32)), sshStr(namespace), sshStr(""), sshStr("sha512"), sshStr(u8(sshStr("ssh-ed25519"), sshStr(sig))));
    return "-----BEGIN SSH SIGNATURE-----\n" + b64(blob).replace(/(.{70})/g, "$1\n") + "\n-----END SSH SIGNATURE-----\n";
  }
  const bytesOf = (b) => (b instanceof Uint8Array ? b : b instanceof ArrayBuffer ? new Uint8Array(b) : enc.encode(String(b == null ? "" : b)));
  const clear = (...ids) => { for (const id of ids) { const el = doc.getElementById(id); if (el) el.value = ""; } };
  const valueOf = (id) => { const el = doc.getElementById(id); return el ? String(el.value || "") : ""; };
  async function heldKey() {
    if (SITTING) return SITTING;
    const k = await kept();
    return k && k.priv && k.raw32 ? { priv: k.priv, raw32: new Uint8Array(k.raw32) } : null;
  }
  /* R40, R47, R97: the key made in the browser; kept on the device only when `keep`, else made as a key file: under the
     `passphrase` typed on the page (no dialog), unprotected (`BIOKEY-RAW1.`) when that is the empty string, else under a
     passphrase the member types twice in the kit's own dialog. The file is downloaded, or with `defer` answered as `file` and
     held in page memory for the sitting only. Answers `{ok, keyB64, line, kept, file?}` or `{ok: false, declined: true}` when
     the member stops. */
  async function register(o = {}) {
    if (o.keep) {
      const pair = await subtle().generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
      const raw32 = new Uint8Array(await subtle().exportKey("raw", pair.publicKey));
      await idb("readwrite", (st) => st.put({ priv: pair.privateKey, raw32: raw32.buffer.slice(0), label: LABEL }, "own"));
      if (!(await kept())) return { ok: false, declined: true };
      SITTING = null;
      return { ok: true, kept: true, ...lineOf(raw32, LABEL) };
    }
    let pass;
    if (typeof o.passphrase === "string") pass = o.passphrase;
    else {
      pass = await new Promise((resolve) => { DIALOG = { kind: "register", resolve }; OVERLAY_REFUSAL = ""; draw(); });
      if (pass === null) return { ok: false, declined: true };
    }
    const seed = win.crypto.getRandomValues(new Uint8Array(32));
    const { priv, raw32 } = await seedKeys(seed);
    const file = pass === "" ? ["BIOKEY-RAW1", LABEL, b64(seed)].join(".") : await wrapSeed(seed, pass);
    seed.fill(0);
    if (!o.defer) saveFile(new Blob([file + "\n"], { type: "text/plain" }), "bio-signing-key.txt");
    SITTING = { priv, raw32 };
    return { ok: true, kept: false, ...lineOf(raw32, LABEL), ...(o.defer ? { file } : {}) };
  }
  const SIGNER = {
    /* the key this browser holds: kept on the device, or loaded for this sitting */
    async held() {
      const key = await heldKey();
      return key ? { held: true, kept: !SITTING, ...lineOf(key.raw32, LABEL) } : { held: false };
    },
    register: (o) => register(o),
    /* R46: the signer's `ssh-ed25519` public line, the key made (and kept or filed as `keep` says) when none is held;
       null when the member stops */
    async publicLine(o = {}) {
      const key = await heldKey();
      if (key) return lineOf(key.raw32, LABEL).line;
      const r = await register(o);
      return r.ok ? r.line : null;
    },
    /* the kept key removed from this device (its revocation is the screen's act) */
    async forget() { SITTING = null; await idb("readwrite", (st) => st.delete("own")); return true; },
    /* R41, R47: "What your key signs, exactly", one confirmation for the whole list; one SSHSIG per statement in list
       order, or `{ok: false, declined: true}` signing nothing. With no key held, the dialog offers "Use a key file you
       already have", loaded for this sitting only. R116: `{keyFile}`, the text `cs.keyFile` answered (or its answer), is
       that key file handed over by the screen: with no key held the dialog then asks only its passphrase; with a key held
       it is not used. */
    async sign(statements, o = {}) {
      const list = (Array.isArray(statements) ? statements : []).map((s) => ({ label: String((s && s.label) || ""), bytes: bytesOf(s && s.bytes), namespace: String((s && s.namespace) || "") }));
      if (!list.length || list.some((s) => !s.namespace)) return { ok: false, declined: true };
      let key = await heldKey();
      const given = o && o.keyFile && typeof o.keyFile === "object" ? o.keyFile.text : o && o.keyFile;
      const keyFile = typeof given === "string" && given.trim() ? given : "";
      const shown = list.map((s) => ({ label: s.label, line: new TextDecoder().decode(s.bytes) }));
      let refusal = "";
      for (;;) {
        const yes = await new Promise((resolve) => { DIALOG = { kind: "sign", resolve, list: shown, needKey: !key, fileGiven: !!keyFile }; OVERLAY_REFUSAL = refusal; draw(); });
        if (!yes) return { ok: false, declined: true };
        if (!key) {
          try {
            const seed = await unwrapKey(keyFile || yes.file, yes.pass);
            key = await seedKeys(seed);
            seed.fill(0);
            SITTING = key;
          } catch { key = null; }
          if (!key) { refusal = refusalHtml(w("shell.signer.notkey")); continue; }
        }
        break;
      }
      const signatures = [];
      for (const s of list) signatures.push(await sshsig(key.priv, key.raw32, s.namespace, s.bytes));
      return { ok: true, signatures, ...lineOf(key.raw32, LABEL) };
    },
  };
  /* the kit's own signing dialogs answered: the register dialog's passphrase (twice alike), the sign dialog's yes (with
     a key file and its passphrase when no key is held), or no */
  function dialogAnswer(yes) {
    const d = DIALOG;
    if (!d) return;
    if (!yes) { DIALOG = null; OVERLAY_REFUSAL = ""; draw(); return d.resolve && d.resolve(d.kind === "register" ? null : false); }
    if (d.kind === "register") {
      const pass = valueOf("cs-key-pass"), again = valueOf("cs-key-again");
      clear("cs-key-pass", "cs-key-again");
      if (!pass || pass !== again) { OVERLAY_REFUSAL = refusalHtml(w("shell.signer.passphrase.differ")); return draw(); }
      DIALOG = null; OVERLAY_REFUSAL = ""; draw();
      return d.resolve(pass);
    }
    if (d.needKey) {
      const file = d.fileGiven ? "given" : valueOf("cs-key-file"), pass = valueOf("cs-key-filepass");
      clear("cs-key-file", "cs-key-filepass");
      if (!file.trim()) { OVERLAY_REFUSAL = refusalHtml(w("shell.signer.nokey")); return draw(); }
      DIALOG = null; OVERLAY_REFUSAL = ""; draw();
      return d.resolve({ file, pass });
    }
    DIALOG = null; OVERLAY_REFUSAL = ""; draw();
    return d.resolve(true);
  }

  /* ---------- acts: friction (R11), sending, refusals beside the act (R13), the password asked again (R34) ---------- */
  const instOf = (k) => (k === "m" ? MAIN : k === "d" ? DOCKI : k === "g" ? GUIDEI : null);
  /* the screen instance that drew an element: the guide's panel, the assistant's, else the main screen */
  const ownerOf = (el) => (el.closest && el.closest('.cs-dock[data-panel="guide"]') ? GUIDEI : el.closest && el.closest(".cs-dock") ? DOCKI : MAIN);
  function slotOf(ai) { return doc.getElementById("cs-root").querySelector('[data-slot="' + ai + '"]'); }
  /* R13 (fix round 2, C11): the refusal drawn beside an act is kept by the act's key, so a redraw (the re-read that follows the
     press, a refresh) draws it again; whatever else is drawn in the slot, or the act's next press, or leaving the screen, ends it */
  const REFUSED = new Map();
  const actOf = (ai) => { const [k, i] = String(ai).split(":"); const ins = instOf(k); return ins ? ins.acts[Number(i)] || null : null; };
  function besideAct(ai, inner) { const s = slotOf(ai); if (s) { s.innerHTML = inner; if (inner) openAround(s); } const d = actOf(ai); if (d) REFUSED.delete(d.key); }
  function restoreRefusals() {
    if (!REFUSED.size) return;
    for (const inst of [MAIN, DOCKI, GUIDEI]) if (inst) inst.acts.forEach((d, i) => { const h = REFUSED.get(d.key); const s = h ? slotOf(inst.key + ":" + i) : null; if (s) s.innerHTML = h; });
  }
  const refusalHtml = (words) => '<span class="cs-gap" data-gap="refused" role="alert">' + I("refused") + "<span>" + words + "</span></span>";
  /* R119 (K4410): the fills an act's `ready` answered, handed to its send when the act runs */
  const READY_FILLS = new Map();
  async function readyFirst(inst, d, btn, ai) {
    let r = null;
    try { r = await d.spec.ready(inst.view, btn, kit(inst)); } catch { r = null; }
    if (r && typeof r === "object" && r.refuse) return refuseBeside(ai, w(r.refuse, r.fills));
    if (r && typeof r === "object" && r.fills) READY_FILLS.set(d.key, r.fills); else READY_FILLS.delete(d.key);
    return press(btn, true);
  }
  function press(btn, readied) {
    const ai = btn.getAttribute("data-ai");
    const [k, i] = String(ai).split(":");
    const inst = instOf(k);
    const d = inst && inst.acts[Number(i)];
    if (!d) return;
    /* R74: a second press while the request is out, or on a locked act, does nothing */
    const st = ACTSTATE.get(d.key);
    if (st && (st.busy || st.lock)) return;
    /* R119: an act's `ready` runs on the press before any reason box opens; nothing is drawn or asked before it answers */
    if (d.spec.ready && !readied) return readyFirst(inst, d, btn, ai);
    activity();
    sound("click");
    /* R68 (fix round 3, C78): the press closes the explanation, and the redrawn button under the still pointer does not open it again
       until the pointer has left it */
    closeTip(); QUIETED = focusKey(btn);
    if (RING && RING.op === d.op) RING = null;
    /* R31, K3143: the guide hears each act pressed on the screen, by its op and screen only, never a value */
    if (inst === MAIN) guideCall("pressed", { op: d.op, screen: MAIN.spec.id });
    const weight = d.asks ? "reasoned" : d.weight;
    if (weight === "reversible" || weight === "none") return run(inst, d, btn, ai, {});
    /* R11 (DEC-88): an act whose own field carries the member's authored words sends them as its reason, asking none */
    if (weight === "reasoned" && d.spec.reasonField) return run(inst, d, btn, ai, { own: true });
    if (weight === "reasoned") {
      const rid = "cs-reason-" + ai.replace(":", "-");
      return besideAct(ai, '<span class="cs-reason" role="group"><span class="cs-field"><label for="' + rid + '">' + w("shell.reason") + '</label><span class="help" id="' + rid + '-help">'
        + w("shell.reason.help") + '</span><textarea id="' + rid + '" class="cs-input" aria-describedby="' + rid + '-help"></textarea></span><span class="mk-acts">'
        + '<button type="button" class="cs-btn" data-shell="reason-send" data-for="' + esc(ai) + '">' + w("shell.reason.send") + "</button>"
        + '<button type="button" class="cs-btn" data-tone="quiet" data-shell="cancel" data-for="' + esc(ai) + '">' + w("shell.cancel") + '</button></span><span data-reason-refusal="' + esc(ai) + '"></span></span>');
    }
    const label = btn.childNodes ? btn.textContent : "";
    const fields = (d.spec.dialog || []).map((f, j) => '<span class="cs-field"><label for="cs-dlg-' + ai.replace(":", "-") + "-" + j + '">' + w(f.label) + '</label><textarea class="cs-input" id="cs-dlg-' + ai.replace(":", "-") + "-" + j + '"></textarea></span>').join("");
    /* R90, R11 (B4): the place word the screen gave the act explains it here too, in place of `.does` */
    const doesKey = d.here || "act." + d.op + ".does";
    const does = has(doesKey) ? "<p>" + w(doesKey) + "</p>" : "";
    besideAct(ai, '<span class="cs-dialog" role="dialog" aria-label="' + esc(label) + '"><span class="ends">' + does + "</span><p>"
      + w(weight === "signed" ? "shell.dialog.signed" : "shell.dialog.signs", { handle: ME ? ME.handle || "" : "" }) + "</p>" + fields + '<span class="mk-acts">'
      + '<button type="button" class="cs-btn" data-tone="primary" data-shell="confirm" data-for="' + esc(ai) + '">' + w("shell.confirm") + "</button>"
      + '<button type="button" class="cs-btn" data-tone="quiet" data-shell="cancel" data-for="' + esc(ai) + '">' + w("shell.cancel") + "</button></span></span>");
  }
  /* R13, R74: a refusal drawn beside its act, with the low tone when Sounds is on */
  function refuseBeside(ai, words) {
    const h = refusalHtml(words);
    besideAct(ai, h);
    const d = actOf(ai);
    if (d) REFUSED.set(d.key, h);
    sound("refused");
  }
  /* R74: the act button's state: busy while the request is out; done after, locked for a terminal, signed or irreversible
     or outward act until a read redraws the screen, cleared after about two seconds for any other; a refusal clears both */
  function actState(inst, d, st) {
    if (st === null) ACTSTATE.delete(d.key); else ACTSTATE.set(d.key, st);
    say(st && st.busy ? textOf(w("shell.working")) : "");
    paint(inst, d.key);
  }
  /* the buttons of one act patched in place, never redrawn: a redraw would drop what the act's own `done` still reads from the
     page (a chosen file, a typed field), which the screen may read after the request has been answered */
  function paint(inst, key) {
    const st = ACTSTATE.get(key) || {};
    const root = doc.getElementById("cs-root");
    if (!root || !live(inst)) return;
    for (const b of root.querySelectorAll("button[data-ai]")) {
      const [k, i] = String(b.getAttribute("data-ai")).split(":");
      const a = instOf(k) && instOf(k).acts[Number(i)];
      if (!a || a.key !== key) continue;
      if (st.busy) b.setAttribute("aria-busy", "true"); else b.removeAttribute("aria-busy");
      if (st.done) b.setAttribute("data-done", ""); else b.removeAttribute("data-done");
      /* only the shell's own lock is touched: a screen may disable its button itself */
      if (st.lock) { b.setAttribute("disabled", ""); b.setAttribute("data-locked", ""); } else if (b.hasAttribute("data-locked")) { b.removeAttribute("disabled"); b.removeAttribute("data-locked"); }
    }
  }
  async function run(inst, d, btn, ai, extra) {
    let req;
    /* R119: the fills the act's `ready` answered reach its send, once */
    extra.fills = READY_FILLS.get(d.key);
    READY_FILLS.delete(d.key);
    if (d.table) extra.picked = (inst.ui["pick:" + d.table] || []).slice();
    /* R100: a browser act does its work in `send` and sends no request: no header, no op door, no read; its `done` and
       `rereads` do not run. The button answers the press as any act's does (R74), a refusal drawn in its slot (R13). */
    if (d.browser) {
      besideAct(ai, "");
      actState(inst, d, { busy: true });
      let out;
      try { out = d.spec.send ? await d.spec.send(inst.view, btn, kit(inst), extra) : null; } catch { return actState(inst, d, null); }
      if (out && typeof out === "object" && out.refuse) { actState(inst, d, null); return refuseBeside(ai, w(out.refuse, out.fills)); }
      actState(inst, d, { done: true });
      setTimeout(() => { const now = ACTSTATE.get(d.key); if (now && now.done && !now.lock) { ACTSTATE.delete(d.key); paint(inst, d.key); } }, 2000);
      return;
    }
    try {
      req = d.spec.send ? await d.spec.send(inst.view, btn, kit(inst), extra) : { body: Object.assign({}, d.data) };
    } catch { req = null; }
    if (!req) return;
    if (req.refuse) return refuseBeside(ai, w(req.refuse, req.fills));
    if (extra.own) {
      const words = req.raw !== undefined ? (req.query || {})[d.spec.reasonField] : (req.body || {})[d.spec.reasonField];
      if (!(typeof words === "string" && words.trim())) return refuseBeside(ai, w("shell.reason.needed"));
    }
    if (extra.reason !== undefined) {
      if (req.raw !== undefined) req.query = Object.assign({}, req.query, { [d.spec.reasonField || "reason"]: extra.reason });
      else req.body = Object.assign({}, req.body || {}, { [d.spec.reasonField || "reason"]: extra.reason });
    }
    besideAct(ai, "");
    req.public = inst.pub;
    /* R109 (fix round 2, C77): the password fields as typed when the request goes out; only those whose value the request carries
       are emptied by the act's success */
    const typedSecrets = Array.from(doc.getElementById("cs-root").querySelectorAll('input[type="password"]')).map((el) => [el, String(el.value || "")]).filter(([, v]) => v);
    actState(inst, d, { busy: true });
    req.act = true;
    let a = await call(d.op, req);
    /* R34: an act answered `REAUTH_DUE` asks the password again and, on `reauth`'s success, is sent once more */
    if (a.kind === "refused" && a.code === "REAUTH_DUE" && S) {
      if (!(await reauthAsk())) return actState(inst, d, null);
      a = await call(d.op, req);
    }
    /* R112 (K4334): an answer that is a refusal in form but whose code the act names in `successCodes` is the act's success: it goes
       the way of any success below, and its sentence (the code's own row, R13's words) is drawn beside the act as done */
    let said = null;
    if (a.kind === "refused" && !a.server && a.coded && Array.isArray(d.spec.successCodes) && d.spec.successCodes.includes(a.code)) {
      said = refusalWords(a, d.spec.refusals, inst);
      a = { kind: "ok", value: a.fields, json: a.fields };
    }
    if (a.kind !== "ok") {
      actState(inst, d, null);
      /* R21 (K4245): the act's optional `failed(view, answer, cs)` runs at once when its request is refused or not answered, so a
         line the screen raised for the press (a working line) is cleared before the refusal is drawn beside the act */
      if (d.spec.failed) { try { await d.spec.failed(inst.view, a, kit(inst)); } catch { /* a screen's own hook never stops the shell */ } }
      if (a.kind === "silent" && !S && !inst.pub) return;
      const words = a.kind === "refused" ? refusalWords(a, d.spec.refusals, inst) : w("shell.noanswer");
      return refuseBeside(ai, words);
    }
    BOOT_STALE = true;
    if (d.op === "unlock" && inst === MAIN && frameOf(MAIN.spec.id) !== "working") { ACTSTATE.delete(d.key); for (const el of doc.getElementById("cs-root").querySelectorAll('input[type="password"]')) el.value = ""; return unlocked(); }
    let after = null;
    /* R21 (K3009), R109 (C77): no secret survives the act that sent it: a password field whose typed value the request carried is
       cleared, so no redraw restores one; an act that sent none (a handle check) leaves what was typed */
    if (typedSecrets.length) {
      const carried = new Set();
      const leaves = (v) => { if (typeof v === "string") carried.add(v); else if (Array.isArray(v)) v.forEach(leaves); else if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) Object.values(v).forEach(leaves); };
      leaves(req.body); leaves(req.query); leaves(req.raw);
      for (const [el, v] of typedSecrets) if (carried.has(v) || (typeof req.raw === "string" && req.raw.includes(v))) el.value = "";
    }
    /* R74: done; a terminal, signed or irreversible or outward act stays disabled until a read redraws the screen (`gen`), any
       other clears about two seconds later on the page clock */
    const heavy = d.weight === "terminal" || d.weight === "signed" || d.weight === "irreversible" || d.outward;
    /* a read (an op that is no act on the record, weight `none`) is busy while it runs and carries no `data-done` */
    actState(inst, d, d.weight === "none" ? null : heavy ? { done: true, lock: true, gen: inst.gen + 1 } : { done: true });
    if (!heavy && d.weight !== "none") setTimeout(() => { const now = ACTSTATE.get(d.key); if (now && now.done && !now.lock) { ACTSTATE.delete(d.key); paint(inst, d.key); } }, 2000);
    /* R112: the success sentence, kept by the act's key as a refusal is (R13), so the re-read's redraw draws it again */
    if (said !== null) {
      const note = '<span class="cs-state" data-state="done" role="status">' + said + "</span>";
      besideAct(ai, note);
      REFUSED.set(d.key, note);
    }
    /* R21 (K3009): a `done` that answers a promise is awaited before the re-reads, so a follow-up act does not race them */
    try { after = d.spec.done ? await d.spec.done(inst.view, a.value, kit(inst)) : null; } catch { after = null; }
    if (after && after.stay) return draw();
    if (live(inst)) readAll(inst, repeatSet(inst, d));
  }
  /* R113 (C14, P6): the reads an act repeats once it has succeeded: those it lists, those the screen marks as depending on its op (a
     read's `after`), and those whose request its success changed; every read for an act that says "all", and for one that declares
     nothing (no list, and no read names its op), as R21 says. Answers the names, or null for all. */
  function repeatSet(inst, d) {
    if (d.spec.rereads === "all") return null;
    const specs = readsOf(inst);
    const dependants = Object.entries(specs).filter(([, sp]) => Array.isArray(sp.after) && sp.after.includes(d.op)).map(([n]) => n);
    if (d.spec.rereads == null && !dependants.length) return null;
    const listed = Array.isArray(d.spec.rereads) ? d.spec.rereads : [];
    return [...new Set(listed.concat(dependants, changedReads(inst)))];
  }

  /* ---------- explanations (R14) ---------- */
  let QUIETED = null, TIP = null, openT = null, closeT = null, DOTS_SAID = local.get("cs-dots-said") === "1";
  const tipEl = () => doc.getElementById("cs-tip");
  function openTip(el) {
    clearTimeout(closeT); clearTimeout(openT);
    if (TIP && TIP !== el) closeTip();
    const t = tipEl();
    if (!t || !el.getAttribute("data-tip")) return;
    /* R77 (U2c): `weight.dots.means` is said once for a member, the first time a marked button's explanation opens, and kept
       on the device with the explanation settings */
    let inner = el.getAttribute("data-tip");
    if (el.getAttribute("data-weighed") && !DOTS_SAID && has("weight.dots.means")) { DOTS_SAID = true; local.set("cs-dots-said", "1"); inner += '<span class="why">' + w("weight.dots.means") + "</span>"; }
    t.innerHTML = inner;
    t.hidden = false;
    TIP = el;
    el.setAttribute("aria-describedby", "cs-tip");
    if (el.getBoundingClientRect && t.style) {
      /* R103 (R84; T-10): below what it explains, else above it: the first that covers no other control and stays inside the page;
         failing that, the first inside the page, else below. Never beside it. */
      const r = el.getBoundingClientRect();
      const tw = Number(t.offsetWidth) || 0, th = Number(t.offsetHeight) || 0, vw = Number(win.innerWidth) || 0, vh = Number(win.innerHeight) || 0, gap = 6;
      const at = [
        { left: Math.max(8, Math.round(r.left)), top: Math.round(r.bottom + gap) },
        { left: Math.max(8, Math.round(r.left)), top: Math.round(r.top - gap - th) },
      ];
      const inside = (c) => c.left >= 0 && c.top >= 0 && (!vw || c.left + tw <= vw) && (!vh || c.top + th <= vh);
      const others = [];
      for (const c of doc.getElementById("cs-root").querySelectorAll(["a[href]", "button", "input", "select", "textarea", "[tabindex]"].join(","))) {
        if (c === el || (el.contains && (el.contains(c) || c.contains(el))) || typeof c.getBoundingClientRect !== "function") continue;
        const b = c.getBoundingClientRect();
        if (b && b.right > b.left && b.bottom > b.top) others.push(b);
      }
      const covers = (c) => others.some((b) => c.left < b.right && c.left + tw > b.left && c.top < b.bottom && c.top + th > b.top);
      const pick = at.find((c) => inside(c) && !covers(c)) || at.find(inside) || at[0];
      t.style.left = pick.left + "px";
      t.style.top = pick.top + "px";
    }
  }
  function closeTip() {
    clearTimeout(openT); clearTimeout(closeT);
    const t = tipEl();
    if (t) { t.hidden = true; t.innerHTML = ""; }
    if (TIP && TIP.removeAttribute) TIP.removeAttribute("aria-describedby");
    TIP = null;
  }
  const delayOf = (el) => (el.getAttribute("data-level") === "2" && LEVEL === "pause" ? 1500 : 500);
  const onTipOrEl = (n) => !!(n && ((TIP && (n === TIP || (TIP.contains && TIP.contains(n)))) || (tipEl() && (n === tipEl() || (tipEl().contains && tipEl().contains(n))))));

  /* ---------- events, bound once by delegation (no inline handler, R2) ---------- */
  const blocked = (t) => (LOCKED || REAUTH || DIALOG) && !(t.closest && t.closest(".mk-scrim"));
  function bind() {
    const root = doc.getElementById("cs-root");
    root.addEventListener("click", (e) => {
      const t = e.target;
      /* R33, R34, R41: under the lock or a dialog over the screen, nothing beneath it answers */
      if (blocked(t)) { e.preventDefault(); return; }
      /* R68: an explanation opened by a control closes when that control is pressed, whether or not the press redraws */
      if (TIP && t.closest && t.closest("[data-tip]") === TIP && TIP.matches && TIP.matches("a,button,input,select,textarea,summary")) closeTip();
      /* R51: the guide's own control; a click the browser makes of the Enter or Space just handled is not a second press */
      const gc = guideControl(t);
      if (gc) {
        e.preventDefault();
        const keyed = GUIDE_KEYED && GUIDE_KEYED.el === gc && e.detail === 0 && Date.now() - GUIDE_KEYED.at < 1000;
        GUIDE_KEYED = null;
        return keyed ? undefined : guidePress(gc);
      }
      const nav = t.closest ? t.closest("a[data-nav]") : null;
      if (nav && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) { e.preventDefault(); activity(); return navigate(nav.getAttribute("href")); }
      const act = t.closest ? t.closest("button[data-act]") : null;
      if (act) return press(act);
      const sh = t.closest ? t.closest("[data-shell]") : null;
      if (sh) return shell(sh, e);
      const tipped = t.closest ? t.closest("[data-tip]") : null;
      if (tipped && !tipped.matches("a,button,input,select,textarea")) openTip(tipped);
    });
    /* K4076: a field carrying `typing` hands its value to the screen's handler `fn(cs, view, value)` about half a second after
       the last key, on the page's clock, cancelled with the screen; it is the member's own input, so activity */
    root.addEventListener("input", (e) => {
      const el = e.target;
      if (blocked(el) || !el.getAttribute || el.getAttribute("data-typing") !== "1") return;
      const inst = ownerOf(el), id = el.id;
      if (!inst || typeof inst.typing[id] !== "function") return;
      activity();
      clearTimeout(inst.typingT[id]);
      inst.typingT[id] = setTimeout(() => {
        delete inst.typingT[id];
        if (!live(inst) || typeof inst.typing[id] !== "function") return;
        try { inst.typing[id](kit(inst), inst.view, el.value); } catch { /* a screen's own handler never stops the shell */ }
      }, 500);
    });
    root.addEventListener("change", (e) => {
      if (blocked(e.target)) return;
      /* R135: a group of boxes or radios tells its screen of the change, as a typed field does (K4076) */
      const grp = e.target.closest ? e.target.closest('fieldset[data-typing-group="1"]') : null;
      if (grp) {
        const inst = ownerOf(grp);
        if (inst && live(inst) && typeof inst.typing[grp.id] === "function") {
          activity();
          const boxes = Array.from(grp.querySelectorAll("input"));
          const value = boxes[0] && boxes[0].type === "radio" ? (boxes.find((i) => i.checked) || { value: "" }).value : boxes.filter((i) => i.checked).map((i) => i.value);
          try { inst.typing[grp.id](kit(inst), inst.view, value); } catch { /* a screen's own handler never stops the shell */ }
        }
      }
      const sh = e.target.closest ? e.target.closest('[data-shell="pick"]') : null;
      if (sh) return shell(sh, e);
      /* R49: a choice that drives its act redraws with the act following it */
      const ch = e.target.closest ? e.target.closest('[data-shell="choice"]') : null;
      /* R90 (K4245): a plain choice records what the member chose in page memory and redraws nothing */
      const kept = e.target.closest ? e.target.closest("[data-keep]") : null;
      if (kept) {
        const inst = ownerOf(kept);
        if (inst) { activity(); inst.ui["choice:" + kept.getAttribute("data-keep")] = kept.value; }
        return;
      }
      if (ch && ch.getAttribute("data-redraw")) {
        /* R90: a choice that redraws sets its value in `view.ui` and redraws; it sends nothing */
        const name = ch.getAttribute("data-redraw");
        const inst = ownerOf(ch);
        if (inst) {
          activity();
          const boxes = ch.localName === "fieldset" ? Array.from(ch.querySelectorAll("input")) : null;
          redrawAfter(inst, name, boxes ? (boxes[0] && boxes[0].type === "radio" ? (boxes.find((i) => i.checked) || { value: "" }).value : boxes.filter((i) => i.checked).map((i) => i.value)) : ch.value);
        }
        return;
      }
      if (ch) { const inst = [MAIN, DOCKI, GUIDEI].find((i) => i && Object.hasOwn(i.ui, "choice:" + ch.getAttribute("data-choice"))); if (inst) { inst.ui["choice:" + ch.getAttribute("data-choice")] = ch.value; draw(); } }
    });
    root.addEventListener("pointerover", (e) => {
      const wd = WORDDRAG && e.target.closest ? e.target.closest('[data-shell="word"]') : null;
      if (wd && wd.getAttribute("data-id") === WORDDRAG.id) {
        const j = Number(wd.getAttribute("data-i"));
        if (j !== WORDDRAG.from || WORDDRAG.st.dragged) { WORDDRAG.st.dragged = true; WORDDRAG.st.anchor = WORDDRAG.from; wordRange(WORDDRAG.st, WORDDRAG.from, j, false); draw(); }
      }
      const el = e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!el) return;
      if (QUIETED && focusKey(el) === QUIETED) return;
      clearTimeout(closeT);
      if (el === TIP) return;
      if (e.pointerType === "touch") return openTip(el);
      clearTimeout(openT);
      openT = setTimeout(() => openTip(el), delayOf(el));
    });
    root.addEventListener("pointerout", (e) => {
      const el = e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!el) return;
      if (QUIETED && focusKey(el) === QUIETED) QUIETED = null;
      if (el !== TIP) { clearTimeout(openT); return; }
      if (onTipOrEl(e.relatedTarget)) return;
      clearTimeout(closeT);
      closeT = setTimeout(closeTip, 500);
    });
    /* R14, R68: an explanation opens at once on keyboard focus; and it closes when the focus moves to anything that is
       not it, so a card is never left open over the next field */
    root.addEventListener("focusin", (e) => {
      if (QUIET_FOCUS) return;
      const el = e.target.closest ? e.target.closest("[data-tip]") : null;
      if (el) return openTip(el);
      if (TIP && !onTipOrEl(e.target)) closeTip();
    });
    root.addEventListener("focusout", (e) => { if (TIP && e.target.closest && e.target.closest("[data-tip]") === TIP) closeTip(); });
    const t = tipEl();
    if (t) {
      t.addEventListener("pointerover", () => clearTimeout(closeT));
      t.addEventListener("pointerout", (e) => { if (!onTipOrEl(e.relatedTarget)) closeT = setTimeout(closeTip, 500); });
    }
    root.addEventListener("pointerdown", (e) => {
      if (blocked(e.target)) return;
      /* R91: a sweep over the words begins on a unit */
      const wd = e.target.closest ? e.target.closest('[data-shell="word"]') : null;
      if (wd) { const x = wordAt(wd); if (x) WORDDRAG = { id: x.id, st: x.st, from: x.i }; return; }
      /* R49: a rectangle drawn over the image, or one moved, by the pointer or a finger */
      const box = e.target.closest ? e.target.closest('[data-shell="areas-box"]') : null;
      if (box) {
        const id = box.getAttribute("data-areas"), inst = areasOf(id);
        if (!inst) return;
        e.preventDefault();
        const at = areasSize(inst, id), list = inst.areas[id];
        const px = (m) => ({ x: (m.clientX - at.rect.left) * at.sx, y: (m.clientY - at.rect.top) * at.sy });
        const p0 = px(e);
        const hit = e.target.closest('[data-shell="area"]');
        const r = hit ? list[Number(hit.getAttribute("data-i"))] : { left: p0.x, top: p0.y, width: 0, height: 0 };
        const from = { left: r.left, top: r.top };
        if (!hit) list.push(r);
        const move = (m) => {
          const p = px(m);
          if (hit) { r.left = from.left + p.x - p0.x; r.top = from.top + p.y - p0.y; clampArea(r, at.nat); }
          else { r.left = Math.min(p0.x, p.x); r.top = Math.min(p0.y, p.y); r.width = Math.abs(p.x - p0.x); r.height = Math.abs(p.y - p0.y); }
        };
        const up = (m) => {
          win.removeEventListener("pointermove", move); win.removeEventListener("pointerup", up);
          if (m && m.clientX !== undefined) move(m);
          if (!hit && (r.width < 2 || r.height < 2)) list.splice(list.indexOf(r), 1); else clampArea(r, at.nat);
          activity(); draw();
        };
        win.addEventListener("pointermove", move);
        win.addEventListener("pointerup", up);
        return;
      }
      const g = e.target.closest ? e.target.closest('[data-shell="grip"]') : null;
      if (!g) return;
      e.preventDefault();
      const rail = g.parentElement;
      const left = rail && rail.getBoundingClientRect ? rail.getBoundingClientRect().left : 0;
      const move = (m) => { RAILW = clampW(m.clientX - left); const f = doc.getElementById("cs-frame"); if (f && f.style) f.style.setProperty("--rail", RAILW + "px"); g.setAttribute("aria-valuenow", String(RAILW)); };
      const up = () => { win.removeEventListener("pointermove", move); win.removeEventListener("pointerup", up); local.set("cs-railw", String(RAILW)); draw(); };
      win.addEventListener("pointermove", move);
      win.addEventListener("pointerup", up);
    });
    /* R132 (DEC-155): a double-click on the rail's edge restores the default width and keeps it; delegated on the root because the grip is redrawn after a drag */
    root.addEventListener("dblclick", (e) => {
      if (blocked(e.target) || !(e.target.closest && e.target.closest('[data-shell="grip"]'))) return;
      e.preventDefault();
      RAILW = RAIL_DEFAULT;
      local.set("cs-railw", String(RAILW));
      draw();
    });
    root.addEventListener("keydown", (e) => {
      if (blocked(e.target)) return;
      /* R130: Enter in a one-line field of a screen presses the primary act of the section that holds it (or the act the field names), once, as a click would */
      if (e.key === "Enter" && !e.repeat && !e.isComposing && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.target.matches && e.target.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit])") && e.target.closest && e.target.closest("#cs-main")) {
        const box = e.target.closest("section") || e.target.closest("#cs-main");
        const named = e.target.getAttribute("data-enter");
        const acts = [...box.querySelectorAll("button[data-act]")].filter((b) => !b.hasAttribute("disabled"));
        const go = named ? acts.find((b) => b.getAttribute("data-act") === named) : acts.find((b) => b.getAttribute("data-tone") === "primary");
        if (go) { e.preventDefault(); return press(go); }
      }
      const gc = (e.key === "Enter" || e.key === " ") && !e.repeat && !(e.target.matches && e.target.matches("input, textarea, select")) ? guideControl(e.target) : null;
      if (gc) { e.preventDefault(); GUIDE_KEYED = { el: gc, at: Date.now() }; return guidePress(gc); }
      if (e.target.closest && e.target.closest('[data-shell="word"]') && wordKey(e.target.closest('[data-shell="word"]'), e)) return;
      const g = e.target.closest ? e.target.closest('[data-shell="grip"]') : null;
      if (g && ["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) {
        e.preventDefault();
        RAILW = e.key === "Home" ? RAIL_DEFAULT : clampW(RAILW + (e.key === "ArrowRight" ? 8 : -8));
        local.set("cs-railw", String(RAILW));
        draw();
      }
      const row = e.target.closest ? e.target.closest('[data-shell="row"]') : null;
      if (row && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); shell(row, e); }
      /* R49: an area moved by the arrow keys, resized with Shift, removed by Delete */
      const area = e.target.closest ? e.target.closest('[data-shell="area"]') : null;
      if (area && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(e.key)) {
        e.preventDefault();
        const id = area.getAttribute("data-areas"), inst = areasOf(id);
        if (!inst) return;
        const at = areasSize(inst, id), list = inst.areas[id], i = Number(area.getAttribute("data-i")), r = list[i];
        if (!r) return;
        if (e.key === "Delete" || e.key === "Backspace") { list.splice(i, 1); draw(); return; }
        const step = at.nat ? Math.max(1, Math.round(Math.max(at.nat.w, at.nat.h) / 100)) : 10;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (e.shiftKey) { r.width += dx; r.height += dy; } else { r.left += dx; r.top += dy; }
        clampArea(r, at.nat);
        draw();
      }
    });
    /* R33: the member's own input is activity */
    for (const type of ["keydown", "pointerdown", "touchstart", "wheel"]) doc.addEventListener(type, () => { if (!LOCKED) activity(); });
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeTip(); if (MENU) { MENU = false; draw(); } if (REAUTH) reauthNow(false); if (DIALOG) dialogAnswer(false); }
      if (LOCKED || REAUTH || DIALOG) return;
      if (e.altKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.code === "KeyI")) { e.preventDefault(); setLevel(LEVEL === "prompt" ? "pause" : "prompt"); }
      /* R31: Alt+Shift+W asks the running guide to ring its step again */
      if (e.altKey && e.shiftKey && (e.key === "W" || e.key === "w" || e.code === "KeyW") && GUIDEI) { e.preventDefault(); guideCall("ring"); }
    });
    win.addEventListener("pointerup", () => { WORDDRAG = null; });
    /* R103 (T-10): an explanation closes on the next tap anywhere but on it, and on any scroll */
    doc.addEventListener("pointerdown", (e) => { if (TIP && !onTipOrEl(e.target)) closeTip(); }, true);
    doc.addEventListener("scroll", () => { if (TIP) closeTip(); }, true);
    win.addEventListener("popstate", () => route());
    win.addEventListener("pagehide", () => { closing(MAIN); closing(DOCKI); closing(GUIDEI); SITTING = null; stopVersion(); });
    /* R32: every tab sees a sign-in, a lock, a sign-out or an end through the storage event */
    win.addEventListener("storage", (e) => {
      if (!e || (e.key !== D.storeKey && e.key !== STATE_KEY && e.key !== null)) return;
      const rec = readRecord();
      const why = local.get(STATE_KEY);
      if (S && !rec) return over(why === "ended" ? "ended" : "signedout");
      if (rec && (!S || rec.t !== S.t)) {
        S = rec; ME = null; LOCKED = false; ENTRY = { state: null, handle: null };
        /* a public, published or setup screen stays as it is (R30, R45; screens-entry R11); `front` opens the page kept */
        if (ROUTE && ROUTE.root) win.history.replaceState({}, "", takeReturn());
        if (ROUTE && (ROUTE.root || working())) route(); else draw();
        return;
      }
      if (S && rec && why === "locked" && !LOCKED) return lock(true);
      if (S && LOCKED && why !== "locked") { LOCKED = false; OVERLAY_REFUSAL = ""; activity(); armIdle(); draw(); }
    });
    if (mq && mq.addEventListener) mq.addEventListener("change", () => draw());
    /* R99: the printout is the light theme, the frame, the main column and the body lifted off their fixed height by inline
       style (a stylesheet rule would cut it at one page), all restored after; then the screen's `printed(cs, view)` */
    let LIFTED = null;
    win.addEventListener("beforeprint", () => {
      doc.documentElement.setAttribute("data-theme", "light");
      if (LIFTED) return;
      LIFTED = [doc.getElementById("cs-frame"), doc.getElementById("cs-main"), doc.body].filter((el) => el && el.style).map((el) => ({ el, height: el.style.height, overflow: el.style.overflow }));
      for (const { el } of LIFTED) { el.style.height = "auto"; el.style.overflow = "visible"; }
    });
    win.addEventListener("afterprint", () => {
      applyTheme();
      if (LIFTED) { for (const { el, height, overflow } of LIFTED) { el.style.height = height || ""; el.style.overflow = overflow || ""; } LIFTED = null; }
      for (const inst of [MAIN, DOCKI]) if (inst && typeof inst.spec.printed === "function") { try { inst.spec.printed(kit(inst), inst.view); } catch { /* a screen's own work never stops the shell */ } }
    });
  }
  /* R91: the words control's selection: a unit toggled by a click, extended from the last one by Shift with a click or the arrows,
     or swept by the pointer; page memory only (`inst.words`), dropped with the screen */
  function wordAt(el) {
    const inst = ownerOf(el), id = el.getAttribute("data-id"), i = Number(el.getAttribute("data-i"));
    const st = inst && inst.words[id];
    return st && st.units && st.units[i] ? { inst, id, st, i } : null;
  }
  function wordRange(st, a, b, add) {
    const ex = st.units.slice(Math.min(a, b), Math.max(a, b) + 1).map((u) => u.extent);
    st.sel = add ? [...new Set(st.sel.concat(ex))] : ex;
  }
  function wordPress(el, e) {
    const x = wordAt(el);
    if (!x) return;
    const { st, i } = x;
    if (st.dragged) { st.dragged = false; return; }
    if (e && e.shiftKey && st.anchor !== null && st.units[st.anchor]) wordRange(st, st.anchor, i, true);
    else { const ex = st.units[i].extent; st.sel = st.sel.includes(ex) ? st.sel.filter((v) => v !== ex) : st.sel.concat(ex); st.anchor = i; }
    draw();
  }
  /* Space toggles the focused unit; the arrows move the focus along the units, and with Shift extend the run to the one reached */
  function wordKey(el, e) {
    const x = wordAt(el);
    if (!x) return false;
    const { id, st, i } = x;
    if (e.key === " ") { e.preventDefault(); wordPress(el, {}); return true; }
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return false;
    e.preventDefault();
    const j = Math.max(0, Math.min(st.units.length - 1, i + step));
    if (e.shiftKey) { if (st.anchor === null || !st.units[st.anchor]) st.anchor = i; wordRange(st, st.anchor, j, true); draw(); }
    const next = doc.getElementById("cs-root").querySelector('[data-shell="word"][data-id="' + String(id).replace(/"/g, "") + '"][data-i="' + j + '"]');
    if (next && next.focus) next.focus();
    return true;
  }
  let WORDDRAG = null;
  function shell(el, e) {
    const what = el.getAttribute("data-shell");
    const inst = MAIN;
    const table = el.getAttribute("data-table"), id = el.getAttribute("data-id");
    activity();
    if (what === "unlock") return unlockNow();
    if (what === "lock-other") return signOut();
    if (what === "reauth") return reauthNow(true);
    if (what === "reauth-cancel") return reauthNow(false);
    if (what === "dialog-yes") return dialogAnswer(true);
    if (what === "dialog-no") return dialogAnswer(false);
    if (what === "bind") {
      const [k, i] = String(el.getAttribute("data-bi") || "").split(":");
      const ins = instOf(k);
      const b = ins && ins.binds[Number(i)];
      if (!b) return;
      if (b.kind === "signout") return signOut();
      if (b.kind === "save") return saveFile(new Blob([b.text], { type: "text/plain" }), b.name);
      if (b.kind === "copy") { try { const c = win.navigator && win.navigator.clipboard; if (c && c.writeText) c.writeText(b.text); } catch { /* the clipboard refused: nothing copied */ } return; }
      return;
    }
    if (what === "area-add" || what === "area-clear") {
      const id = el.getAttribute("data-areas"), ins = areasOf(id);
      if (!ins) return;
      const at = areasSize(ins, id);
      if (what === "area-clear") ins.areas[id].length = 0;
      else ins.areas[id].push(clampArea(at.nat ? { left: at.nat.w * 0.4, top: at.nat.h * 0.4, width: at.nat.w * 0.2, height: at.nat.h * 0.2 } : { left: 10, top: 10, width: 100, height: 60 }, at.nat));
      return draw();
    }
    if (what === "area" || what === "areas-box") return;
    if (what === "word") return wordPress(el, e);
    if (what === "reload") { try { win.location.reload(); } catch { /* the browser refused: the page stays */ } return; }
    if (what === "menu") { MENU = !MENU; return draw(); }
    if (what === "signout") return signOut();
    if (what === "theme") { MENU = false; return setTheme(el.getAttribute("data-theme-to")); }
    if (what === "level") return setLevel(LEVEL === "prompt" ? "pause" : "prompt");
    if (what === "level-keep") { ASK_LEVEL = false; KEEP_LATER = true; local.set("cs-level-asked", "1"); return setLevel(el.getAttribute("data-level-to") === "pause" ? "pause" : "prompt", true); }
    if (what === "sounds") { setSounds(el.getAttribute("data-sounds-to") === "on"); draw(); return sound("click"); }
    if (what === "dock") {
      if (DOCK) closing(DOCKI);
      DOCK = !DOCK;
      if (DOCK && DOCKI && !Object.keys(DOCKI.data).length) readAll(DOCKI);
      return draw();
    }
    if (what === "cancel") return besideAct(el.getAttribute("data-for"), "");
    if (what === "reason-send" || what === "confirm") {
      const ai = el.getAttribute("data-for");
      const [k, i] = ai.split(":");
      const ins = instOf(k);
      const d = ins && ins.acts[Number(i)];
      const btn = doc.getElementById("cs-root").querySelector('button[data-ai="' + ai + '"]');
      if (!d || !btn) return;
      if (what === "reason-send") {
        const ta = doc.getElementById("cs-reason-" + ai.replace(":", "-"));
        const reason = ta ? String(ta.value || "").trim() : "";
        if (!reason) { const r = doc.getElementById("cs-root").querySelector('[data-reason-refusal="' + ai + '"]'); if (r) r.innerHTML = refusalHtml(w("shell.reason.needed")); return; }
        return run(ins, d, btn, ai, { reason });
      }
      const fields = {};
      (d.spec.dialog || []).forEach((f, j) => { const t = doc.getElementById("cs-dlg-" + ai.replace(":", "-") + "-" + j); fields[f.name] = t ? t.value : ""; });
      return run(ins, d, btn, ai, { fields });
    }
    if (!inst) return;
    if (what === "row") {
      const open = inst.ui["open:" + table] || (inst.ui["open:" + table] = []);
      const at = open.indexOf(id);
      if (at >= 0) open.splice(at, 1); else open.push(id);
      return draw();
    }
    if (what === "pick") {
      const picked = inst.ui["pick:" + table] || (inst.ui["pick:" + table] = []);
      const at = picked.indexOf(id);
      if (at >= 0) picked.splice(at, 1); else picked.push(id);
      return draw();
    }
    if (what === "unpick") { inst.ui["pick:" + table] = []; return draw(); }
    if (what === "sort") {
      const col = Number(el.getAttribute("data-col"));
      const s = inst.ui["sort:" + table];
      inst.ui["sort:" + table] = { col, dir: s && s.col === col && s.dir === "asc" ? "desc" : "asc" };
      return draw();
    }
  }

  /* ---------- start ---------- */
  /* R128 (fix round 8, G114; K4814 (1), K4817): the words request names the release, the viewer's language and the team's adoptions stamp in
     `v` (`<release>~<language>~<stamp>`; the language an empty part when the viewer has none; never a `language` field, which asks every word).
     `loadWords` is sent at `whoami`'s answer, before `bootstrap`, which carries the language and the stamp (`instance-setup` R103) and goes after
     the screen's first reads (R122); so a load names the release alone until the device holds the member's note of them (`cs-words:<member>`,
     written when `bootstrap` answers, a device convenience as `cs-group` is; never the tab's one key, R24). When `bootstrap` answers with
     a note other than the one the last load named, the words are asked once more with the full `v`, so that fetch is the one the browser
     keeps. A stale note is asked and answered without the year, with the viewer's current words (the door's). */
  let WORDS_SENT = null;
  const wordsNoteKey = () => (ME && ME.member ? "cs-words:" + String(ME.member) : null);
  function wordsNote() {
    const k = wordsNoteKey();
    let o = null;
    try { o = k ? JSON.parse(local.get(k) || "null") : null; } catch { o = null; }
    return o && typeof o === "object" && typeof o.s === "string" && o.s && typeof o.l === "string" ? { l: o.l, s: o.s } : null;
  }
  function wordsRelease() {
    const meta = doc.querySelector ? doc.querySelector('meta[name="cs-version"]') : null;
    const named = meta && meta.getAttribute ? meta.getAttribute("content") : null;
    return typeof named === "string" && named ? named : null;
  }
  const wordsV = () => { const r = wordsRelease(), n = wordsNote(); return r && n ? r + "~" + n.l + "~" + n.s : r; };
  /* `bootstrap`'s answer, kept for the loads that follow; the words asked again when the full `v` is not the one the last load named */
  function noteWords(b) {
    const k = wordsNoteKey();
    if (!k || !S || !b || typeof b !== "object" || typeof b.words_version !== "string" || !b.words_version) return;
    const next = { l: typeof b.language === "string" ? b.language : "", s: b.words_version };
    const had = wordsNote();
    if (!had || had.l !== next.l || had.s !== next.s) local.set(k, JSON.stringify(next));
    if (wordsRelease() && WORDS_SENT !== wordsV()) loadWords();
  }
  async function loadWords() {
    const v = wordsV();
    WORDS_SENT = v;
    const a = await call("interfacewords", v ? { query: { v } } : {});
    if (a.kind !== "ok" || !a.value || !Array.isArray(a.value.words)) return;
    wordsRead = true;
    const shown = new Map();
    for (const x of a.value.words) if (x && typeof x.key === "string" && typeof x.text === "string" && x.text && x.fallback === false) shown.set(x.key, x.text);
    SHOWN = shown;
    if (typeof a.value.language === "string" && a.value.language) doc.documentElement.setAttribute("lang", a.value.language);
    draw();
  }
  /* G12b (fix round 6; walkers A and B; diagnosis-R6-speed §2): twelve of a screen's fifteen to thirty-three reads were the frame's, almost all of
     them constant for a session. Six are kept for the session in this tab's `sessionStorage` (R124), under the member and the session, and drawn from
     it; each is asked again, once, when the screen's first reads have settled, and the frame follows the answer. Kept or not, each is read by the same
     requests as before. */
  const FRAME_KEY = D.storeKey + ":frame";
  /* what the frame uses of each answer, and the request that reads it (`subscriptionsignin`'s `state` step is a read though its op is declared
     mutating); `min` answers null for an answer of no use, and is applied to what is read back from the store too, so a stored value is never taken as it is */
  const FRAME_READS = {
    groupidentity: { req: {}, min: (v) => ({ display_name: typeof v.display_name === "string" && v.display_name.trim() ? v.display_name : null }) },
    infolevel: { req: {}, min: (v) => (v.level === "prompt" || v.level === "pause" ? { level: v.level, set_at: v.set_at || null, asked_at: v.asked_at || null } : null) },
    assistantstate: { req: {}, min: (v) => ({ on: v.on === true }) },
    accountreference: { req: {}, min: (v) => ({ held: v.held === true }) },
    subscriptionsignin: { req: { body: { step: "state" }, read: true }, min: (v) => ({ connected: v.connected === true }) },
    groupkeystate: { req: {}, min: (v) => ({ on: v.on === true && v.held !== false }) },
  };
  const FRAME_NAMES = Object.keys(FRAME_READS), FRAME_REACH = ["assistantstate", "accountreference", "subscriptionsignin", "groupkeystate"];
  /* FRAME_VAL: what the frame holds of each (kept or answered); FRAME_DONE: settled (held, answered, or answered with nothing of use); FRAME_KEPT: those
     drawn from the store; FRAME_FRESH: those the plane has answered in this page; FRAME_CHECKED: the one asking-again of the kept ones is done */
  let FRAME_VAL = {}, FRAME_DONE = new Set(), FRAME_KEPT = new Set(), FRAME_FRESH = new Set(), FRAME_CHECKED = false;
  /* G81 (fix round 7; BOB's decision): of the six, two are constants of the team (`groupidentity`, `infolevel`): a page load in the tab that holds one
     answered less than a day ago draws from it and asks it no more; the other four are asked again once on every load, as they can change under the
     member (another administrator turns the assistant off, a subscription lapses, the group key is turned on). FRAME_AT: when the plane last answered each
     (page clock, kept with the answer); a kept answer without a time, or from the future, is asked again. */
  const FRAME_CONSTANT = ["groupidentity", "infolevel"], FRAME_DAY = 24 * 3600 * 1000;
  let FRAME_AT = {};
  /* a short tag of the session's token, so the store names the session without holding anything that opens it (R3: the token is held by the record alone) */
  function tagOf(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const frameWho = () => (S && ME && ME.member ? String(ME.member) + "|" + tagOf(S.t) : null);
  /* R124: the store is cleared when the record is written or cleared (sign-in, sign-out, an end) and when the page locks; what the page holds goes with it */
  function frameDrop() { FRAME_VAL = {}; FRAME_DONE = new Set(); FRAME_KEPT = new Set(); FRAME_FRESH = new Set(); FRAME_AT = {}; tab.del(FRAME_KEY); }
  /* a kept level is dropped when the member changes it, so the next load asks */
  function frameForget(name) { delete FRAME_VAL[name]; delete FRAME_AT[name]; FRAME_KEPT.delete(name); frameSave(); }
  function frameSave() {
    const who = frameWho();
    if (!who) return;
    const reads = {};
    const at = {};
    for (const n of FRAME_NAMES) if (FRAME_VAL[n]) { reads[n] = FRAME_VAL[n]; if (Number.isFinite(FRAME_AT[n])) at[n] = FRAME_AT[n]; }
    if (Object.keys(reads).length) tab.set(FRAME_KEY, JSON.stringify({ who, reads, at })); else tab.del(FRAME_KEY);
  }
  /* what the store holds for this member and this session, each read through `min`; a store of another member or session is dropped, and so is one that is not ours */
  function frameKept() {
    const who = frameWho();
    if (!who) return {};
    let o = null;
    try { o = JSON.parse(tab.get(FRAME_KEY) || "null"); } catch { o = null; }
    if (o === null) return {};
    if (!o || typeof o !== "object" || o.who !== who || !o.reads || typeof o.reads !== "object") { tab.del(FRAME_KEY); return {}; }
    const out = {};
    for (const n of FRAME_NAMES) { const v = o.reads[n]; const m = v && typeof v === "object" ? FRAME_READS[n].min(v) : null; if (m) out[n] = m; }
    /* when each was answered, for the constants only; anything but a number is none */
    FRAME_AT = {};
    for (const n of FRAME_CONSTANT) { const t = o.at && typeof o.at === "object" ? o.at[n] : null; if (out[n] && typeof t === "number" && Number.isFinite(t)) FRAME_AT[n] = t; }
    return out;
  }
  /* R7, R17, R20, R60: the frame's state from what it holds of one read */
  function frameApply(name) {
    if (name === "groupidentity") {
      if (!FRAME_VAL.groupidentity) return;
      /* R60: the display name only; the slug is never drawn as the group's name */
      GROUP = FRAME_VAL.groupidentity.display_name;
      GROUP_KNOWN = true;
      if (GROUP) local.set(GROUP_KEY, GROUP); else local.del(GROUP_KEY);
    } else if (name === "infolevel") {
      const lv = FRAME_VAL.infolevel;
      if (lv) {
        LEVEL_INFO = lv;
        if (lv.set_at) { LEVEL = lv.level; local.set("cs-level", LEVEL); }
      }
      /* R17 (DEC-162 (2)): after the member's first month (from the first day this device served her, or the level's first setting), the shell asks once
         whether to keep the level */
      const firstKey = "cs-first:" + (ME.member || "");
      if (!local.get(firstKey)) local.set(firstKey, String(Date.now()));
      const first = Math.min(Number(local.get(firstKey)) || Date.now(), LEVEL_INFO && LEVEL_INFO.set_at ? Date.parse(LEVEL_INFO.set_at) || Date.now() : Date.now());
      const asked = (LEVEL_INFO && LEVEL_INFO.asked_at) || local.get("cs-level-asked");
      /* R75 (2): a member whose level is still the default, and of no other */
      ASK_LEVEL = !asked && LEVEL === "prompt" && Date.now() - first >= 30 * 24 * 3600 * 1000;
    } else if (FRAME_REACH.includes(name)) {
      /* R20: reachable when the assistant is on and the member holds her own reference, is connected or the group holds a key; a read that did not answer is "not reachable" */
      if (!FRAME_REACH.every((n) => FRAME_DONE.has(n))) return;
      const v = FRAME_VAL, was = REACHABLE;
      REACHABLE = !!((v.assistantstate && v.assistantstate.on) && ((v.accountreference && v.accountreference.held) || (v.subscriptionsignin && v.subscriptionsignin.connected) || (v.groupkeystate && v.groupkeystate.on)));
      if (REACHABLE !== was) {
        DOCKI = REACHABLE && screenOf("assistant") && ROUTE && (!MAIN || frameOf(MAIN.spec.id) === "working") ? instance(screenOf("assistant"), ROUTE.subject, "d", { screen: ROUTE.screen, subject: ROUTE.subject }) : null;
        if (!REACHABLE) DOCK = false;
        draw();
        /* R113 (P2.1): no screen read of its own: only a read whose request now differs (it reads `view.reachable`) is read again */
        if (MAIN) rereadChanged(MAIN);
      }
    }
  }
  /* an answer of the plane for one frame read, from the frame's own request or from a screen's identical one (`noteFrame`); the frame follows it when it
     is the read's first or differs from what the frame held, and is drawn again for it */
  function frameTake(name, a) {
    if (!ME) return;
    const m = a.kind === "ok" && a.value && typeof a.value === "object" ? FRAME_READS[name].min(a.value) : null;
    const was = FRAME_VAL[name] === undefined ? null : JSON.stringify(FRAME_VAL[name]), first = !FRAME_DONE.has(name);
    if (m) { FRAME_VAL[name] = m; FRAME_DONE.add(name); FRAME_FRESH.add(name); if (FRAME_CONSTANT.includes(name)) FRAME_AT[name] = Date.now(); frameSave(); }
    /* a first read that answered nothing of use is settled; a kept one that is asked again and does not answer keeps what it held */
    else FRAME_DONE.add(name);
    if (!first && (!m || JSON.stringify(m) === was)) return;
    frameApply(name);
    if (name === "groupidentity" || name === "infolevel") draw();
  }
  const frameAsk = (name) => call(name, Object.assign({}, FRAME_READS[name].req)).then((a) => frameTake(name, a));
  /* a screen's read of exactly a frame read (no query; `subscriptionsignin`'s `state` step) is that read's answer as well */
  function noteFrame(spec, a) {
    if (a.kind !== "ok" || !Object.hasOwn(FRAME_READS, spec.op) || !ME) return;
    const q = spec.query || {};
    if (Object.keys(q).some((k) => q[k] !== undefined && q[k] !== null)) return;
    const body = FRAME_READS[spec.op].req.body;
    if ((body === undefined) !== (spec.body === undefined) || (body !== undefined && JSON.stringify(spec.body) !== JSON.stringify(body))) return;
    frameTake(spec.op, a);
  }
  /* the frame's reads at `whoami`'s answer: those the store holds are drawn at once and asked again once the screen's reads have settled
     (`frameRevalidate`); the others are asked now, together, as the frame always did (R86) */
  function frameBoot() {
    /* R7 (E12; K4530 ruling on J21): the queue count is asked once the screen's own reads are known (`countQueue`, from `show`), not here */
    COUNT_DUE = true;
    FRAME_VAL = {}; FRAME_DONE = new Set(); FRAME_KEPT = new Set(); FRAME_FRESH = new Set(); FRAME_CHECKED = false; FRAME_AT = {};
    const kept = frameKept();
    for (const n of FRAME_NAMES) if (kept[n]) { FRAME_VAL[n] = kept[n]; FRAME_DONE.add(n); FRAME_KEPT.add(n); }
    /* G81: a constant kept less than a day is as good as answered in this page: never asked again by this load */
    for (const n of FRAME_CONSTANT) if (FRAME_KEPT.has(n) && Date.now() - FRAME_AT[n] >= 0 && Date.now() - FRAME_AT[n] < FRAME_DAY) FRAME_FRESH.add(n);
    for (const n of FRAME_NAMES) if (FRAME_KEPT.has(n)) frameApply(n);
    for (const n of FRAME_NAMES) if (!FRAME_DONE.has(n)) frameAsk(n);
  }
  /* once the screen's first reads have settled, the kept reads the page has not itself had answered are asked again, once */
  function frameRevalidate() {
    if (FRAME_CHECKED || !ME || !S) return;
    FRAME_CHECKED = true;
    for (const n of FRAME_KEPT) if (!FRAME_FRESH.has(n)) frameAsk(n);
  }
  /* G12b: the guide's marks (`screens-wizards`' `marksFor`, one `wizardsat` for the screen) asked at the route's start, in the same breath as the screen's
     reads, and held for `entered`, which asks for the very same read when the route has settled and is handed this answer */
  function marksAhead() {
    if (!GUIDEI || typeof GUIDE.entered !== "function" || !Array.isArray(GUIDE.ops) || !GUIDE.ops.includes("wizardsat") || !S || !ROUTE || !ROUTE.screen) return;
    call("wizardsat", { query: { screen: ROUTE.screen }, public: false, hold: true });
  }

  /* R36: old addresses forwarded, the fragment carried and nothing else */
  function forward() {
    const p = String(win.location.pathname || "/"), h = String(win.location.hash || "");
    if (p !== "/" && p !== "") return;
    if (/^#(invite|join)=/.test(h)) win.history.replaceState({}, "", "/app/join" + h);
    else if (/^#boot=/.test(h)) win.history.replaceState({}, "", "/app/setup" + h);
  }
  /* R46: the fragment read once (`boot`, `invite`, `join`, `reset`, and `grant` for `review-outside`, K3147), then removed
     from the address before any request */
  function takeFragment() {
    const h = String(win.location.hash || "");
    if (!h || h === "#") return;
    const out = {};
    for (const part of h.slice(1).split("&")) {
      const at = part.indexOf("=");
      if (at < 0) continue;
      const k = part.slice(0, at);
      if (!["boot", "invite", "join", "reset", "grant"].includes(k)) continue;
      try { out[k] = decodeURIComponent(part.slice(at + 1)); } catch { out[k] = part.slice(at + 1); }
    }
    FRAGMENT = out;
    win.history.replaceState({}, "", win.location.pathname);
  }
  async function start() {
    if (STARTED) return;
    STARTED = true;
    applyTheme();
    bind();
    forward();
    takeFragment();
    if (GUIDE) GUIDEI = instance(GUIDE, null, "g", null);
    /* R32: the record read when a screen first needs it (never for a public or published one, R30); `/` with a live
       record opens Home */
    /* R36, R71: the test-instance band, read once; under the page's session when it holds one (so the load is counted in her window), else without.
       G12b: the request is sent after the first screen's reads (`startBoot`, from `show`), never before them, so the object answers the screen first. */
    BOOT_ARGS = (() => {
      /* R30, R79: a page of the public or published frame, or an address outside the team's pages, sends no Authorization header */
      const at = parse(win.location.pathname);
      const rec = at.outside || (sessionless(at.screen) && !at.root) ? null : readRecord();
      return rec ? { bearer: rec.t } : { public: true };
    })();
    await route();
    startBoot();
  }
  function startBoot() {
    if (BOOT_CALL || !BOOT_ARGS) return BOOT_CALL;
    BOOT_CALL = call("bootstrap", BOOT_ARGS);
    BOOT_CALL.then((b) => { if (b.kind === "ok" && b.value && typeof b.value === "object") { BOOT = b.value; BOOT_READ = true; testBand(); noteWords(b.value); } });
    return BOOT_CALL;
  }
  return { start, state: () => ({ ME, ROUTE, LEVEL, THEME, RAILW, REACHABLE, DOCK, TODO, GROUP, MAIN, DOCKI, LOCKED, S: !!S }), absorb, date, w };
}
