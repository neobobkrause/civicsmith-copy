/* interface-shell (T46-54; N897 (1); DEC-87, -98, -99, -122, -138, -139, -154, -155, -159–-163, -175–-177, -179, -181;
   N672, N673; K2893): the member interface's page and frame. `interfacePage(screens)` composes one HTML document from the
   shell's browser program (`browser.mjs`) and each registered screen's self-contained functions (draft-T46-interface
   §1.3), with the data they read: the words (R5, R70: keys only; the sentences are `setup-words`'), the act gate's tables (R12), the grades (R11) and the paths (R8). It
   checks the screen contract (R21) before it composes anything, so a broken screen is never served. Pure: it reads no
   table and writes nothing; every read and act is an op the plane serves, from the browser. */
import { ASSET_FILES } from "../interface-assets/index.mjs";
import { WORD_ROWS, word } from "../setup-words/index.mjs";
import * as DECLARATIONS from "../op-declarations/index.mjs";
import { OPS, NEEDS, SESSION_OPS } from "../op-declarations/index.mjs";
import { RUNGS, RUNG_ABSENT, IRREVERSIBLE_WEIGHT, MARKS, phoneOf } from "../op-grades/index.mjs";
import { SCREEN_REGISTRY, ADMIN_ACTS, ADMIN_SCREENS } from "../wizard-scripts/index.mjs";
import { sha256HexSync } from "../record-grammar/index.mjs";
import { shellProgram } from "./browser.mjs";

/* R32 (N999; K3052; replaces setup-page R31): the session record's key in the browser's `localStorage`, this module's:
   `{t, e, d, w}`, `t` the token `login` answered, `e` its expiry in milliseconds (0 when none), `d` the device kind
   (`own` or `shared`), `w` the handle signed in with. Every tab reads it; nothing else holds the token. */
export const SESSION_STORE_KEY = "bio-session";

/* R2 (setup-page R28's rule; answer-envelope R6): the literal each script element's nonce holds, filled per response. The interface
   page no longer holds it (R1: no inline script, no nonce slot, fix round 3); other pages' slots are `answer-envelope`'s. */
export const NONCE_SLOT = "__CSP_NONCE__";

/* The phone width (the Terms): `civicsmith.css`' breakpoint, a viewport of 760 px or less. */
export const PHONE_WIDTH = 760;

/* R1, R2: the stylesheet and the icon sprite, `interface-assets`' files, served on the page's own origin. */
const ASSET = (name) => {
  if (!Object.hasOwn(ASSET_FILES, name)) throw new Error(`interface-shell: interface-assets holds no ${name}`);
  return "/app/assets/" + name;
};
export const STYLESHEET = ASSET("civicsmith.css");
/* R56 (K3254 (2); `interface-assets` R7): the design page's product rules, linked after the stylesheet */
export const SHELL_STYLESHEET = ASSET("shell.css");
export const ICONS = ASSET("icons.svg");

/* R8 (DEC-154; N672): each screen's path, `mock-shell.js`' `PATH` at 3f40899950, from its rail place to its own name;
   `@project` is the project's step, its title as read (the screen's `place(view)`). R28 (T47): the new screen modules'
   screens from `PATH` at a0fab7abf0, and L11's (R37) from `PATH` at PR #33's head; a step that is not a screen's own name
   is a `shell.step.*` word. A screen of the public, published or setup frame has no path (R30, R45). R54: the screens
   PR #34's registry adds, from `PATH` at its merge (4664e8efd4): `elsewhere` (Home) and `updates` (Settings). */
export const PATHS = Object.freeze({
  home: ["home"], elsewhere: ["home", "screen.elsewhere.name"], queue: ["queue"], inbox: ["queue", "screen.inbox.name"], "due-date": ["queue", "shell.step.due-date"],
  finder: ["find"], answers: ["find", "screen.answers.name"],
  capture: ["add"], held: ["add", "screen.held.name"], archive: ["add", "screen.held.name", "screen.archive.name"],
  "open-file": ["projects", "@project", "screen.open-file.name"], "find-in": ["projects", "@project", "screen.find-in.name"],
  projects: ["projects"], project: ["projects", "@project"], document: ["projects", "@project", "screen.document.name"],
  question: ["projects", "@project", "screen.question.name"], assistant: ["projects", "@project", "screen.question.name"],
  projectai: ["projects", "@project", "screen.projectai.name"],
  calculation: ["projects", "@project", "screen.calculation.name"], standard: ["projects", "@project", "screen.standard.crumb"],
  plan: ["projects", "@project", "screen.plan.name"], "start-send": ["projects", "@project", "screen.plan.name", "screen.start-send.name"],
  request: ["projects", "@project", "screen.request.name"], action: ["projects", "@project", "screen.action.name"],
  timeline: ["projects", "@project", "screen.timeline.name"], money: ["projects", "@project", "screen.money.name"],
  proceeding: ["projects", "@project", "screen.proceeding.name"], matter: ["projects", "@project", "screen.matter.name"],
  "case-editor": ["projects", "@project", "screen.case-editor.name"], "review-copy": ["projects", "@project", "screen.review-copy.name"],
  ceremony: ["projects", "@project", "shell.step.ceremony"], docket: ["projects", "@project", "screen.docket.name"],
  imported: ["projects", "shell.step.imported", "screen.imported.name"],
  people: ["people"], person: ["people", "screen.person.name"], explore: ["people", "screen.person.name", "screen.explore.name"],
  settings: ["settings"], members: ["settings", "screen.members.name"], account: ["settings", "screen.account.name"],
  connect: ["settings", "screen.connect.name"], notes: ["settings", "screen.notes.name"], ties: ["settings", "screen.ties.name"],
  "group-identity": ["settings", "screen.group-identity.name"], security: ["settings", "screen.security.name"],
  translations: ["settings", "screen.translations.name"], wizards: ["settings", "screen.wizards.name"],
  updates: ["settings", "screen.updates.name"],
  /* R101 (T51): `glossary` and `actionnew` from the rail place and the screen's title (the drawings' `crumbs`), `teamai` from `PATH` */
  glossary: ["settings", "screen.glossary.name"], teamai: ["settings", "screen.teamai.name"],
  actionnew: ["projects", "@project", "screen.actionnew.name"],
  /* R106 (T51 fix round; DEC-374 to DEC-377): the six screens the design adds, from the drawings' `crumbs` (`mock-screens.js`
     `SCR.<id>`): `bias` under Settings, `contradiction` and `objective` under the project, `about-knocker` under the Inbox, `leads`
     and `watching` under Add */
  bias: ["settings", "screen.bias.name"], contradiction: ["projects", "@project", "screen.contradiction.name"],
  objective: ["projects", "@project", "screen.objective.name"], "about-knocker": ["queue", "screen.inbox.name", "screen.about-knocker.name"],
  leads: ["add", "screen.leads.name"], watching: ["add", "screen.watching.name"],
  /* K4078: the two dashboards Home opens, as `PATH` draws them: the action dashboard by its name, the project's by the project's title */
  "dash-action": ["screen.dash-action.name"], "dash-project": ["projects", "@project"],
  group: ["settings", "screen.group.name"], places: ["settings", "screen.places.name"], recovery: ["settings", "screen.recovery.name"],
  unavailable: ["screen.unavailable.name"],
});
Object.values(PATHS).forEach(Object.freeze);

/* R7: the rail's places and the screens each opens, the first registered; a place none of whose screens is registered
   opens the shell's own page (R37: People opens `people`, Settings opens `settings`; until either is registered the
   shell says People comes later and lists the settings screens registered, never linking `/`). */
export const PLACE_SCREENS = Object.freeze({
  home: Object.freeze(["home"]), queue: Object.freeze(["queue"]), find: Object.freeze(["finder"]), add: Object.freeze(["capture"]),
  projects: Object.freeze(["projects", "project"]), people: Object.freeze(["people"]), settings: Object.freeze(["settings"]),
});

/* R37's fallback: the settings screens the shell lists while `settings` is not registered (R28's list; R54: `updates`
   after Security, drawn only while `whoami`'s `administer` is true, `ADMIN_SCREENS`; R106: `bias` last, the drawing's "For every member"). */
export const SETTINGS_SCREENS = Object.freeze(["members", "account", "connect", "notes", "ties", "group-identity", "security",
  "updates", "translations", "wizards", "group", "places", "recovery", "bias"]);

/* R16: the screen an item of each kind opens (R27: a knock opens `inbox` at that knock; R47: a person or organisation
   the record follows opens `person`, a proceeding `proceeding`, a standard `standard`; R66: a project's plan, timeline,
   money, calculation, case editor, review copy, ceremony and docket open their screens), each card its
   `shell.card.<kind>` word. */
export const REF_SCREENS = Object.freeze({ document: "document", passage: "document", question: "question", project: "project",
  member: "members", capture: "open-file", knock: "inbox", person: "person", proceeding: "proceeding", standard: "standard",
  plan: "plan", timeline: "timeline", money: "money", calculation: "calculation", "case-editor": "case-editor",
  "review-copy": "review-copy", ceremony: "ceremony", docket: "docket",
  /* R81 (N1180; DEC-299 (1); DEC-310 (4), (5)): more doors; `published` opens in the public frame (R30), `archive` at a held
     ZIP's capture digest; `dash-action` is not added: nothing links it in T50 */
  request: "request", matter: "matter", action: "action", "dash-project": "dash-project", theme: "theme", published: "published", archive: "archive",
  /* R106 (DEC-374 to DEC-377): a contradiction item opens `contradiction`, a bias-debt item and the lens `bias`, a source
     `about-knocker`; the objective, the leads and the watched addresses their own screens. A kind with no `shell.card.<kind>` word
     is drawn with the item's own facts alone, as `theme` is. */
  contradiction: "contradiction", "bias-debt": "bias", bias: "bias", source: "about-knocker", objective: "objective", leads: "leads", watching: "watching" });
/* R81, R88: the kinds whose card is the kind's word alone (`shell.card.published`, `shell.card.archive`), not the item's facts */
export const CARD_WORD_ONLY = Object.freeze(["published", "archive"]);

/* R30, R45: the frames of `registry.json` other than `working` that the shell draws: `public` and `published` without a
   session, `setup` with or without one; the dock's panel is `dock`. A screen not named here is drawn in the working
   frame. */
export const FRAMES = Object.freeze({
  front: "public", tour: "public", reset: "public", forgot: "public", doorbell: "public",
  published: "published", "review-outside": "published", "docket-public": "published",
  setup: "setup", join: "setup", site: "setup", install: "setup", update: "setup",
  assistant: "dock",
});
const sessionless = (id) => FRAMES[id] === "public" || FRAMES[id] === "published";

/* R9 (K3137): addresses whose first part is not the screen's id: `/app/review` is `review-outside` (`screens-publish` R17). */
export const ADDRESSES = Object.freeze({ review: "review-outside" });
/* R105 (T51 fix round; C52): the screens whose address takes the project as a second part, `/app/<screen>/<id>/<project>`: the screen
   is handed `view.subject` the first part and `view.project` the second (`null` for the bare address); for every other screen the
   subject is the whole of what follows the screen's id. */
export const PROJECT_PART = Object.freeze(["question"]);
/* R79 (N1174; DEC-299 (11); DEC-301 (3)): the two addresses outside `/app` that draw a screen in its public frame, at that
   address: `/doorbell` and `/tour`. Every other path outside `/` and `/app` draws `unavailable` in the public frame. */
export const PUBLIC_ADDRESSES = Object.freeze({ doorbell: "doorbell", tour: "tour" });

/* R102 (T51; N1184 B-19, B-22; DEC-340): the nine named pages: the registry's `public` and `published` frames and the setup
   frame's `join`. The tab title of each is `page.title.public`, and none draws a weight mark, in the frame or the page. */
export const PUBLIC_PAGES = Object.freeze(["front", "tour", "reset", "forgot", "doorbell", "published", "docket-public", "review-outside", "join"]);

/* R100 (T51; `op-declarations` R76): the acts done in the page alone, read from `op-declarations`' table (`{screen, census,
   registry}` per act; the table is that module's and none is kept here). An absent table is the empty one. */
export function browserActs() {
  const t = DECLARATIONS.BROWSER_ACTS;
  return t && typeof t === "object" ? t : {};
}
const isBrowserAct = (op, screenId) => Object.hasOwn(browserActs(), op) && browserActs()[op].screen === screenId;

/* R21, R73 (T50): the ops a screen may name beyond the registry's acts (its declared, function and owed acts, each owed one
   under its op name, `wizard-scripts` R13, R41): `infolevelset` on any screen (`ANY_SCREEN_OPS`), and the one op a screen
   needs that the registry does not list for it, until it does: `stepsourcewithdraw` on `explore` (R55). A test fails on an
   entry the registry lists for that screen. `unlock` on a screen drawn without a session is R46's, under the locked
   session's token (`LOCKED_OPS`), not a re-point. */
export const RE_POINTS = Object.freeze({
  explore: Object.freeze(["stepsourcewithdraw"]),
  /* G53 (fix round 6; K4699): `scanmirror` (on `security`) and `officeconfirm` (on `places`), R117's two, left this table: the
     design's registry lists both now, so the one screen-registry check admits them */
  /* B3 (K4467; screens-inquiry J21, N5): the read of a record stored unread, until the registry lists `readheld` on `document` */
  document: Object.freeze(["readheld", "resolve"]),
  /* K5178 (screens-investigate R1, screens-investigate J28 (1)): `linecurrentthrough` on a person's page, stating a holder current through a day, until the registry lists it for `person` */
  person: Object.freeze(["linecurrentthrough"]),
  /* R134 (K5308; screens-entry R34, screens-inquiry R139): `factconfirm` on `setup` (DEC-439 D-B1, the time-zone step), `leggrade` on
     `question` (citation R24), and `resolve` on `document` (entities' resolve, "Find the people and offices it names"), each until
     the registry lists the op on that screen (the registry lists `factconfirm` on `group` and `resolve` on `person` only) */
  setup: Object.freeze(["factconfirm"]),
  question: Object.freeze(["leggrade"]),
  /* R134 (K5310; credentials R83, screens-daily R107): `signerknown` on `queue`, until the registry lists it there */
  queue: Object.freeze(["signerknown"]),
});
export const LOCKED_OPS = Object.freeze(["unlock"]);
export const ANY_SCREEN_OPS = Object.freeze(["infolevelset"]);


/* R107 (T51 fix round; K4197 T-07): the acts that carry the Reasoned mark and no weight (`op-grades` `MARKS`, R64) and that the
   walk found asking no reason: the administrator's acts on a member or the team (`ADMIN_ACTS`), a project's owner added, and a
   review granted. The shell asks their reason before they run, as it does for a Reasoned weight (R11). */
export const MARK_ASKS_EXTRA = Object.freeze(["projectowneradd", "reviewgrant"]);
/* R11, R107: whether the shell asks the reason of an act drawn with the Reasoned mark and no weight */
const asksReason = (op) => ADMIN_ACTS.has(op) || MARK_ASKS_EXTRA.includes(op);

/* The shell's own reads and acts (R3, R4, R7, R17, R20, R33, R34, R36). */
export const SHELL_OPS = Object.freeze(["whoami", "interfacewords", "groupidentity", "queue", "infolevel", "infolevelset",
  "assistantstate", "accountreference", "subscriptionsignin", "groupkeystate", "signout", "unlock", "reauth", "bootstrap"]);

/* R21: the screen contract. Throws, naming the screen, for a screen whose id the registry does not hold, an act naming
   an op `OPS` does not hold, or an op that is neither the registry's for that screen nor a named re-point. */
export function checkScreens(screens) {
  if (!Array.isArray(screens)) throw new Error("interface-shell: screens is not a list");
  const seen = new Set();
  for (const s of screens) {
    const id = s && s.id;
    const reg = SCREEN_REGISTRY.find((r) => r.id === id);
    if (!reg) throw new Error(`interface-shell: screen ${String(id)} is not in SCREEN_REGISTRY`);
    if (seen.has(id)) throw new Error(`interface-shell: screen ${id} is registered twice`);
    seen.add(id);
    if (typeof s.render !== "function") throw new Error(`interface-shell: screen ${id} has no render`);
    if (s.reads !== undefined && typeof s.reads !== "function") throw new Error(`interface-shell: screen ${id}'s reads is not a function`);
    if (!Array.isArray(s.acts)) throw new Error(`interface-shell: screen ${id} has no acts list`);
    const allowed = new Set([...reg.acts, ...(reg.owed || []).map((o) => o.op), ...(RE_POINTS[id] || []), ...ANY_SCREEN_OPS]);
    for (const a of s.acts) {
      const op = a && a.op;
      /* R100: an act the page does alone is admitted for the screen `BROWSER_ACTS` names it for, and for no other */
      if (typeof op === "string" && !Object.hasOwn(OPS, op) && Object.hasOwn(browserActs(), op)) {
        if (!isBrowserAct(op, id)) throw new Error(`interface-shell: screen ${id}'s act ${op} is a browser act of another screen (BROWSER_ACTS), not of this one`);
        continue;
      }
      if (typeof op !== "string" || !Object.hasOwn(OPS, op)) throw new Error(`interface-shell: screen ${id}'s act names ${String(op)}, which OPS does not hold`);
      if (!allowed.has(op)) throw new Error(`interface-shell: screen ${id}'s act ${op} is not the registry's for it, nor a named re-point`);
      /* R30: a screen drawn without a session calls only public ops (R46: `unlock`, under the locked session's token) */
      if (sessionless(id) && OPS[op].classes !== null && !(RE_POINTS[id] || []).includes(op) && !LOCKED_OPS.includes(op)) throw new Error(`interface-shell: screen ${id} is drawn without a session, and its act ${op} is not a public op`);
    }
    /* R87: the shell asks a Reasoned act's reason, or sends the member's own words in the act's `reasonField`; a screen that
       names a `reasonField` that is no field's name supplies neither, so it is never served */
    for (const a of s.acts) if (a && a.reasonField !== undefined && !(typeof a.reasonField === "string" && a.reasonField)) throw new Error(`interface-shell: screen ${id}'s act ${String(a.op)} names a reasonField that is no field's name, so it would send without a reason`);
    /* R113: an act's `rereads` is a list of read names or "all"; a read's `after` is a list of ops */
    for (const a of s.acts) if (a && a.rereads != null && a.rereads !== "all" && !(Array.isArray(a.rereads) && a.rereads.every((n) => typeof n === "string"))) throw new Error(`interface-shell: screen ${id}'s act ${String(a.op)} names rereads that are neither a list of reads nor "all"`);
    /* R112: the codes an act names as its success are a list of codes */
    for (const a of s.acts) if (a && a.successCodes !== undefined && !(Array.isArray(a.successCodes) && a.successCodes.every((c) => typeof c === "string" && c))) throw new Error(`interface-shell: screen ${id}'s act ${String(a.op)} names successCodes that are not a list of codes`);
    if (s.words !== undefined && !Array.isArray(s.words)) throw new Error(`interface-shell: screen ${id}'s words is not a list`);
    if (s.ABSENT_CODES !== undefined && !(Array.isArray(s.ABSENT_CODES) && s.ABSENT_CODES.every((c) => typeof c === "string"))) throw new Error(`interface-shell: screen ${id}'s ABSENT_CODES is not a list of codes`);
  }
  return true;
}

/* R31, K3143: the dock's wizard guide (`screens-wizards`' `GUIDE`), `{words, parts?, ops, acts, render, marks, start,
   entered, pressed, ring, control}` (R51: `control` handles the guide's own `data-guide` controls): no registry id;
   `ops` (the ops it reads by `cs.call`) and its acts' ops each an op `OPS` holds, carried with their gate rows as a
   screen's. Throws, naming the guide, for one that is not. */
export function checkGuide(guide) {
  if (guide === undefined || guide === null) return true;
  if (typeof guide !== "object" || typeof guide.render !== "function") throw new Error("interface-shell: the guide has no render");
  for (const f of ["marks", "start", "entered", "pressed", "ring", "control"]) if (guide[f] !== undefined && typeof guide[f] !== "function") throw new Error(`interface-shell: the guide's ${f} is not a function`);
  if (!Array.isArray(guide.acts)) throw new Error("interface-shell: the guide has no acts list");
  if (guide.ops !== undefined && !Array.isArray(guide.ops)) throw new Error("interface-shell: the guide's ops is not a list");
  for (const op of [...(guide.ops || []), ...guide.acts.map((a) => a && a.op)]) if (!(typeof op === "string" && Object.hasOwn(OPS, op))) throw new Error(`interface-shell: the guide names ${String(op)}, which OPS does not hold`);
  if (guide.words !== undefined && !Array.isArray(guide.words)) throw new Error("interface-shell: the guide's words is not a list");
  return true;
}

/* The page's script holds the screens as JavaScript source: each function by its own text, every other value as JSON. */
export function toSource(v) {
  if (typeof v === "function") {
    const src = v.toString();
    /* a method written `name(a) {…}` is an object's member, never an expression: make it one */
    if (/^(async\s+)?(function\b|\(|[\w$]+\s*=>)|^async\s*\(/.test(src)) return src;
    const m = /^async\s+/.exec(src);
    return (m ? "async function " : "function ") + src.slice(m ? m[0].length : 0);
  }
  if (Array.isArray(v)) return "[" + v.map(toSource).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ":" + toSource(x)).join(",") + "}";
  return v === undefined ? "undefined" : JSON.stringify(v);
}

/* R5, R70: every word the page may draw, `[key, en]`: `WORD_ROWS` (the shell's own keys are its rows) and each screen's
   own rows. A screen's own row under a key `WORD_ROWS` holds wins (DEC-149's conformed form, R5). */
export function wordsOf(screens) {
  const m = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
  for (const s of screens) for (const x of s.words || []) if (Array.isArray(x)) m.set(x[0], x[1]);
  return [...m.entries()];
}

/* The words the page carries (R70: the keys of `setup-words`' list, read from it, never English held here): the families the shell and its kit draw (R5–R7, R10, R11, R13, R14, R16, R32–R36, R40),
   each act's label and explanation, each registered screen's, and every key a screen (or the guide) names. */
const FAMILIES = ["shell.", "rail.", "tab.", "state.", "weight.", "mark.", "level.", "date.", "refusal.", "ai.refused.", "session.",
  "signing.ceremony.", "instance.test.", "page.", "unavailable.", "list.", "form.choose.passage"];
function pageWords(screens, ops) {
  const named = new Set(screens.flatMap((s) => (s.words || []).map((x) => (Array.isArray(x) ? x[0] : x))));
  const ids = screens.map((s) => s.id).filter(Boolean).concat(Object.keys(PATHS), ["unavailable", "more"]);
  const keep = (k) => named.has(k) || FAMILIES.some((f) => k.startsWith(f))
    || ids.some((id) => k.startsWith("screen." + id + ".")) || [...ops].some((op) => k.startsWith("act." + op + ".") || k.startsWith("act.owed_" + op + "."));
  return wordsOf(screens).filter(([k]) => keep(k));
}

/* R33 (K3061 D3; `credentials` R65): the page's own idle limits, the plane's answer governing over them. */
export const IDLE_LOCK_MS = 30 * 60 * 1000;
export const IDLE_END_MS = 15 * 60 * 1000;
/* R35 (DEC-201 (8)): a subject read refused with one of these is "You can't open this"; an absence code (R61: `NO_SUCH_*`,
   `*_NOT_FOUND`, `NOT_FOUND`, `NO_ENTITY`, `NO_CALC`, `NO_NODE`, and the codes a screen lists as its `ABSENT_CODES`), or an empty
   answer, is "Nothing is here"; no answer, or a 5xx, is "can't be reached", tried again every `RETRY_MS`. */
export const ABSENCE = /^NO_SUCH_|_NOT_FOUND$|^NOT_FOUND$|^NO_ENTITY$|^NO_CALC$|^NO_NODE$/;
export const NOT_YOURS = Object.freeze(["NOT_VISIBLE", "NOT_A_PARTICIPANT"]);
export const RETRY_MS = 30 * 1000;

function dataOf(screens, guide) {
  const all = guide ? screens.concat([guide]) : screens;
  const ops = new Set(SHELL_OPS);
  for (const s of all) for (const a of s.acts) ops.add(a.op);
  if (guide) for (const op of guide.ops || []) ops.add(op);
  const pick = (f) => Object.fromEntries([...ops].filter((op) => Object.hasOwn(OPS, op)).map((op) => [op, f(op)]).filter(([, v]) => v !== undefined));
  /* R11 (K3002, K3011): the weight from `RUNGS` (an alias carries its op's); an act that can never be undone weighs
     Irreversible (DEC-143, `op-grades` R21); a read (`OPS` declares it not mutating), or an op in `RUNG_ABSENT` under a
     ground other than `undetermined`, is not an act on the record: no weight (`none`), run on press; an undetermined or
     unnamed op is reasoned in the browser (DEC-87) */
  const rungOf = (op) => (OPS[op] && OPS[op].mutating === false ? "none" : IRREVERSIBLE_WEIGHT.includes(op) ? "irreversible"
    : Object.hasOwn(RUNG_ABSENT, op) ? (RUNG_ABSENT[op] && RUNG_ABSENT[op].ground !== "undetermined" ? "none" : undefined)
      : Object.hasOwn(RUNGS, op) ? RUNGS[op] : undefined);
  return {
    storeKey: SESSION_STORE_KEY, phoneWidth: PHONE_WIDTH, icons: ICONS,
    words: pageWords(all, ops),
    ops: pick(() => true),
    /* R30, R45: the public ops (`classes: null`), the only ones a page with no session calls, by an act or by `cs.call` */
    publicOps: Object.keys(OPS).filter((op) => OPS[op].classes === null),
    /* R123 (E12): the ops `OPS` declares not mutating, whichever screen asks them: the reads the page may share while they are in flight */
    readOps: Object.keys(OPS).filter((op) => OPS[op].mutating === false),
    needs: pick((op) => (Object.hasOwn(NEEDS, op) ? NEEDS[op] : undefined)),
    /* R12 (K4237): a read is gated by its classes, not by `SESSION_OPS`, which holds mutating ops alone */
    readClasses: pick((op) => (OPS[op] && OPS[op].mutating === false && (OPS[op].classes === null || Array.isArray(OPS[op].classes)) ? (OPS[op].classes === null ? null : [...OPS[op].classes]) : undefined)),
    sessionOps: { member: [...ops].filter((op) => SESSION_OPS.member.has(op)), admin: [...ops].filter((op) => SESSION_OPS.admin.has(op)) },
    adminActs: [...ops].filter((op) => ADMIN_ACTS.has(op)),
    markAsks: [...ops].filter(asksReason),
    rungs: pick(rungOf),
    /* R64 (`op-grades` R42): the design kit's mark for an act R11 draws with no weight, a mark and its explanation only.
       R11, R107 (fix round 2, C76; K4199): the mark and the asking agree. A read carries no mark; an act is marked Reasoned
       only where the shell asks its reason (`markAsks`), so no act says "Asks for a reason" and asks nothing. */
    marks: pick((op) => {
      if (rungOf(op) !== "none" || !Object.hasOwn(MARKS, op) || (OPS[op] && OPS[op].mutating === false)) return undefined;
      const mark = String(MARKS[op]).toLowerCase();
      return mark === "reasoned" && !asksReason(op) ? undefined : mark;
    }),
    /* R50 (K3156): the acts held at the phone width: every act carrying a weight that `op-grades.phoneOf` answers false
       for (its terminal, attested and irreversible rungs, `IRREVERSIBLE_WEIGHT`, its larger-screen acts through
       `OP_ALIASES`); never one run on press (a read, or an op `RUNG_ABSENT` grounds otherwise than `undetermined`: the
       credential acts `knock`, `enroll`, `recover` stay on the phone) */
    larger: [...ops].filter((op) => Object.hasOwn(OPS, op) && rungOf(op) !== "none" && phoneOf(op) === false),
    /* R100: the acts the page does alone, `{act: screen}` (never an op: no weight, no friction, no request) */
    browserActs: Object.fromEntries(all.flatMap((s) => s.acts.map((a) => a.op).filter((op) => typeof op === "string" && isBrowserAct(op, s.id)).map((op) => [op, s.id]))),
    /* R102: the pages that carry no weight mark and are titled by `page.title.public` */
    publicPages: PUBLIC_PAGES,
    paths: PATHS, placeScreens: PLACE_SCREENS, refScreens: REF_SCREENS, cardWordOnly: CARD_WORD_ONLY, frames: FRAMES, settingsScreens: SETTINGS_SCREENS, addresses: ADDRESSES, publicAddresses: PUBLIC_ADDRESSES, projectPart: PROJECT_PART,
    places: [...Object.keys(PLACE_SCREENS), "more"],
    idleLock: IDLE_LOCK_MS, idleEnd: IDLE_END_MS, notYours: NOT_YOURS, retry: RETRY_MS, absence: ABSENCE.source, adminScreens: ADMIN_SCREENS,
  };
}

/* The shell's own styles (R56, R65: only these two, never a hand copy of a design rule, which `shell.css` carries): the
   page's height settings, so the frame's main column scrolls and the page never does (R57; the frame's own fixed height is
   the design's `.cs-frame`), and motion stopped under reduced motion (R22); with the phone block (R108) and, R120, the grid of a
   `cs.row` whose first part is empty (`data-lead="none"`: the design's grid is lead, text, act, and a row with no lead would give
   the text the first column and the act what is left of the row). Every element the shell draws is a design
   class (R65), so nothing else is carried; no rule gives `cursor: help`, nor a pointer to an element that only explains
   itself (R52). */
const STYLE = `html,body.cs{height:100%}body.cs{margin:0;height:100dvh;display:flex;flex-direction:column;overflow:hidden}
#cs-root{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}#cs-root>.cs-frame{flex:1 1 auto;min-height:0;height:auto;overflow:hidden}
#cs-root>.cs-frame>.cs-main{overflow:auto;min-height:0}#cs-root>.cs-frame:not(.cs-shell){display:grid;grid-template-rows:minmax(0,1fr)}
.cs-main .cs-row[data-lead=none]{grid-template-columns:minmax(0,1fr) auto}.cs-main .cs-row[data-lead=none]>.meta{grid-column:1/-1}
@media (max-width:${PHONE_WIDTH}px){
:root:root .cs-main .cs-row[data-lead=none]{grid-template-columns:minmax(0,1fr)}:root:root .cs-main .cs-row[data-lead=none]>*{grid-column:1}
.cs-main{overflow-x:hidden;overflow-wrap:anywhere}.cs-main .cs-row,.cs-main .mk-rowname{grid-template-columns:auto minmax(0,1fr);min-width:0}.cs-main .cs-row>*{min-width:0}
.cs-main td,.cs-main th{min-width:0;overflow-wrap:anywhere}.cs-main .cs-field label{min-width:0}.cs-main fieldset.cs-field label{display:flex;align-items:flex-start;gap:8px}
.cs-main fieldset.cs-field label>span{display:block;min-width:0}.cs-main [role=tablist]{flex-wrap:wrap}
.cs-btn,button.mk-avatar,.cs-main a.cs-ref,.cs-main input:not([type=checkbox]):not([type=radio]),.cs-main select,.cs-tabs a,.cs-mast a,.cs-mast button,.cs-wizmark{min-height:44px;min-width:44px}
.cs-main :is(.cs-row,.mk-rowname,li,td) a.cs-ref{display:inline-flex;align-items:center;box-sizing:border-box}
.cs-main input[type=checkbox],.cs-main input[type=radio]{width:24px;height:24px;flex:none}
:root:root .cs-main input.mk-pick{width:44px;height:44px;margin:0}
:root:root .mk-open,:root:root .mk-mastsearch{min-width:44px;min-height:44px;box-sizing:border-box;align-items:center}
:root:root .cs-main label:has(>input[type=checkbox]),:root:root .cs-main label:has(>input[type=radio]){display:flex;align-items:center;gap:8px;min-height:44px;box-sizing:border-box}
.cs-main,.cs-main>*,.cs-section,.cs-section>*,.cs-sheet,.cs-row>*,.mk-card,.cs-field,.mk-acts>*{min-width:0;max-width:100%}
.cs-main :is(p,li,dt,dd,td,th,h1,h2,h3,.rec,.mk-data,.meta,a.cs-ref,code){overflow-wrap:anywhere}
.mk-people{max-width:100%;flex-wrap:wrap}.mk-next li>span{min-width:0;overflow-wrap:anywhere}.mk-strip .mk-strip-sum{min-width:0;max-width:100%}.mk-cards{grid-template-columns:minmax(0,1fr)}.cs-row .meta,.mk-acts{flex-wrap:wrap}.tw{max-width:100%;overflow-x:auto}
.cs-field :is(input,select,textarea){box-sizing:border-box;width:100%;max-width:100%;min-width:0}
.cs-btn{max-width:100%;white-space:normal;text-align:left}
.cs-path a,.cs-mast a,.cs-mast button,.cs-part>summary{display:inline-flex;align-items:center;box-sizing:border-box;min-height:44px}
.cs-dock:not(:has(.body>*)),.cs-band:empty{display:none}.cs-tip{max-width:min(300px,calc(100vw - 32px));pointer-events:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

/* R56: the script-hook classes, each with what reads it; a class here needs no style. */
export const HOOK_CLASSES = Object.freeze({
  "cs-crumbs": "the path's element, read by journey-check's walker (its screens.mjs) and the screen modules' tests",
  "cs-rows": "the kit's table of rows (R19), read by the screen modules' tests",
  "cs-r": "a row of `cs.rows`, read by the screen modules' tests",
  "cs-panel": "a row's panel, read by the shell's ring (R31) and `cs.fieldOf`, and by the screen modules' tests",
  "mk-lvlbtn": "the explanation-level control (R65), read by the design's script and journey-check (`mock-shell.js`:47)",
  "mk-updband": "the newer-version band (R92): the design's `cs-testband` with this hook, read by the shell's tests and journey-check (`mock-shell.js` `updBand`)",
});

/* R56: every class a served stylesheet defines: `civicsmith.css` (whose own elements' classes count with it), `shell.css`
   and the shell's `STYLE`. Comments and addresses are no selector. */
export function stylesheetClasses(...sheets) {
  const out = new Set();
  for (const css of sheets) {
    const text = String(css || "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/url\([^)]*\)/g, " ").replace(/"[^"\n]*"|'[^'\n]*'/g, " ");
    for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]);
  }
  return out;
}
let DEFINED = null;
const definedClasses = () => DEFINED || (DEFINED = stylesheetClasses(ASSET_FILES["civicsmith.css"].body, ASSET_FILES["shell.css"].body, STYLE));

/* R56: the classes written as literals in `class` attributes (and the `class` set by `setAttribute` or `classList.add`) in
   a source text. A literal cut by a quote of the program's own string, `${` or a backslash keeps its last word unless
   that word ends open (`cs-tag-` + a kind), so a class made at run time is never taken for a written one. */
export function classLiterals(src) {
  const out = new Set();
  const take = (body, closed) => {
    const words = body.split(/\s+/).filter(Boolean);
    if (!closed && words.length && /[-_]$/.test(words[words.length - 1])) words.pop();
    for (const c of words) if (/^-?[_a-zA-Z][\w-]*$/.test(c)) out.add(c);
  };
  for (const m of String(src).matchAll(/\bclass=(\\?)(["'])([^"'`$\\<>{}]*)(.)/g)) {
    const [, , q, body, end] = m;
    const closed = end === q || /\s$/.test(body);
    take(body, closed || end === "\\");
  }
  for (const m of String(src).matchAll(/setAttribute\(\s*["']class["']\s*,\s*["']([^"']*)["']\s*\)|classList\.add\(\s*["']([^"']*)["']\s*\)/g)) take(m[1] || m[2] || "", true);
  return out;
}
/* R56: throws, naming the screen (or the guide, or the shell) and the class, for a class no served stylesheet defines
   that is neither a hook class nor one of `civicsmith.css`' own. */
export function checkClasses(screens, guide, program) {
  const defined = definedClasses();
  const check = (who, src) => {
    for (const c of classLiterals(src)) if (!defined.has(c) && !Object.hasOwn(HOOK_CLASSES, c)) throw new Error(`interface-shell: ${who} draws the class ${c}, which no served stylesheet defines`);
  };
  check("the shell", program);
  for (const s of screens) check(`screen ${s.id}`, toSource(s));
  if (guide) check("the guide", toSource(guide));
  return true;
}

/* the page's own escaping of a served word */
const escape = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* R1, R2 (fix round 3, C15; P2.4; fix round 6, G30, R126): the shell's script, composed from the shell's own functions and each screen's and the
   guide's; it depends on those alone (the release version and the test-instance band are the page's), so it is the same for a release. The script,
   the checks of the screens and guide it is made from and its hash are done once, for the last screens and guide handed in (a release's isolate
   hands in the same ones every request): a front page and a script fetch after the first only read what was kept. A set that fails its checks
   is kept nowhere and is refused again at the next ask. */
const WORK = { scripts: 0, hashes: 0, checks: 0 };
/* R126: how much work the page route has done in this isolate, as counts (the Worker's clock is frozen during synchronous work, so a time
   measured in it reads as nothing, R-CLOCK): the scripts composed, the hashes taken of one and the screen and guide checks run. For a release
   served by one isolate each is 1, however many pages and script fetches it has answered; control-plane's `page` log line states them. */
export function pageWork() { return { ...WORK }; }
let SCRIPT = null;
function release(screens, options) {
  const guide = options && options.guide ? options.guide : null;
  if (SCRIPT && SCRIPT.screens === screens && SCRIPT.guide === guide) return SCRIPT;
  WORK.checks++;
  checkScreens(screens);
  checkGuide(guide);
  const program = shellProgram.toString();
  checkClasses(screens, guide, program);
  const D = dataOf(screens, guide);
  WORK.scripts++;
  const source = `(${program})(${toSource(D)}, ${toSource(screens)}, window, ${toSource(guide)}).start();`;
  return (SCRIPT = { screens, guide, source, hash: null });
}
export function interfaceScript(screens = [], options = {}) {
  return release(screens, options).source;
}
const base64 = (hex) => btoa(hex.match(/../g).map((h) => String.fromCharCode(parseInt(h, 16))).join(""));
/* R1: the hash the page policy names in place of a nonce (`answer-envelope` R6): `sha256-<base64>` of the script's UTF-8 bytes */
export function interfaceScriptHash(screens = [], options = {}) {
  const made = release(screens, options);
  if (made.hash === null) { WORK.hashes++; made.hash = "sha256-" + base64(sha256HexSync(made.source)); }
  return made.hash;
}
/* R1: the address that carries the release version (`control-plane` R75 serves the script there, `immutable`) */
export const scriptPath = (version) => "/app/shell-" + encodeURIComponent(String(version == null || version === "" ? "0" : version)) + ".js";
export function versionOfScriptPath(pathname) {
  const m = /^\/app\/shell-([^/]+)\.js$/.exec(String(pathname || ""));
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}

/**
 * R1: the page. One document, `<html lang>` `en` until the member's language is read; `interface-assets`' `civicsmith.css`
 * and then its `shell.css` (R56), both before the shell's own `<style>`; icons referenced from its `icons.svg`; one
 * script (R1, fix round 3): external, at the address that carries the release version (`options.version`, also named in the page for the
 * shell's `interfacewords` request, R5), its hash exported; no inline script and no nonce slot. No member-facing text
 * stands outside the words. R28: `screens` are the nine screen modules' `SCREENS`; R31: `options.guide` is
 * `screens-wizards`' `GUIDE`, the dock's wizard guide; R58: `options.testInstance` true serves the test band in the page
 * itself, above the frame, from first paint (`control-plane` R95). R56: throws for a class no served stylesheet defines.
 */
export function interfacePage(screens = [], options = {}) {
  const hash = interfaceScriptHash(screens, options);
  const version = options && typeof options.version === "string" && options.version ? options.version : null;
  /* R58, R67: the band as served: the design's `.cs-band[data-band="test"]`, the machine icon, `instance.test.band` and
     `instance.test.notice`, in the English of their words until the member's words are read (R5) */
  const band = options && options.testInstance === true
    ? `<div class="cs-band" data-band="test" id="cs-testband" role="note"><svg class="i" aria-hidden="true"><use href="${ICONS}#i-machine"/></svg><b>${escape(word("instance.test.band"))}</b> <span>${escape(word("instance.test.notice"))}</span></div>\n` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title></title>
${version ? `<meta name="cs-version" content="${escape(version)}">\n` : ""}<link rel="stylesheet" href="${STYLESHEET}">
<link rel="stylesheet" href="${SHELL_STYLESHEET}">
<style>${STYLE}</style>
</head>
<body class="cs">
${band}<div id="cs-root"></div>
<div class="sr" id="cs-live" role="status" aria-live="polite"></div>
<div class="cs-tip" id="cs-tip" role="tooltip" hidden></div>
<script src="${scriptPath(version)}" integrity="${hash}"></script>
</body>
</html>
`;
}
