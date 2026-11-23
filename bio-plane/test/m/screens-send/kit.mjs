/* screens-send's tests' kit: this module's seven screens (`start-send`, `request`, `help-records`, `actionnew`, `hold`, `holdnotice`,
 * `counsel`, with the send steps they share) booted alone on interface-shell's served page (its tests' harness, `harness.mjs`), signed
 * in as a member, over a scripted plane. Each answer is in its owner's documented shape (filings' `filingsfor`, `filingread` and the
 * packet ops, actions' `action`, action-plans' `optionstartpreview`, action-holds' reads, affordances' vocabularies, jurisdictions'
 * `profiles`); a test overrides any op. A sentence is asserted by its key (`drew`), never by its English. */
import { readFileSync } from "node:fs";
import { word, WORD_ROWS } from "../../../src/setup-words/index.mjs";
/* The plane registers every owner's declared ops before its first read (op-declarations R80, R81), and the harness reads the op
   tables when it loads: store-request's world, the plane as built, makes that registration when it is imported, so it comes first
   and the harness after it. No world is built: the member's session is the harness's own. */
await import("../store-request/fixtures.mjs");
const { boot, ok, refused, refusedIn, MEMBER } = await import("../interface-shell/harness.mjs");
/* the screens after the registration: `start-send` reads the declared ops when it loads (its owed act, R21) */
const { startSend } = await import("../../../src/screens-action/start-send.mjs");
const { request } = await import("../../../src/screens-action/request.mjs");
const { helpRecords } = await import("../../../src/screens-action/help-records.mjs");
const { actionNew } = await import("../../../src/screens-action/actionnew.mjs");
const { hold, holdNotice } = await import("../../../src/screens-action/hold.mjs");
const { counsel } = await import("../../../src/screens-action/counsel.mjs");
const steps = await import("../../../src/screens-action/send-steps.mjs");

export { ok, refused, refusedIn, MEMBER, word, steps };
/* The words the page carries for these screens: every key this module's source names, and every row under a prefix it names (a kind's
   words, `screen.action.kind.<kind>`). In the product the list each screen carries is `screens-action`'s, which registers them; here the
   screens are booted alone, so the page is given the keys they draw, and a test proves which key a screen draws, never the list. */
const SRC = ["start-send", "request", "help-records", "actionnew", "hold", "counsel", "send-steps"]
  .map((f) => readFileSync(new URL(`../../../src/screens-action/${f}.mjs`, import.meta.url), "utf8")).join("\n");
const KEYS = WORD_ROWS.map((r) => r[0]);
const HELD = new Set(KEYS);
const NAMED = [...new Set([...SRC.matchAll(/["'`]([a-z][\w-]*(?:\.[\w-]+)+\.?)["'`]/g)].map((m) => m[1]))]
  .flatMap((k) => (k.endsWith(".") ? KEYS.filter((x) => x.startsWith(k)) : HELD.has(k) ? [k] : []));
export const SCREENS = Object.freeze([startSend, request, helpRecords, actionNew, hold, holdNotice, counsel].map((s) => Object.freeze({ ...s, words: NAMED })));
/** The member who may read and not act: no capability. */
export const READER = Object.freeze({ ...MEMBER, capabilities: [] });

export const PROJECT = "PRJ-2026-0007";
export const ACTION = "ACT-2026-0031";
export const PLAN = "APL-2026-0003";

/** actions' `action` answer: a request for comment in `PROJECT`, named to the Town Clerk; `o` over it. */
export const ACT = (o = {}) => ({ id: ACTION, kind: "request_for_comment", title: "Why the lease was renewed", project: PROJECT, risk_tier: 2,
  current_state: "planned", counterparty: { state: "named", role: "Town Clerk", body: "Town of Port Ellery" }, ...o });
/** filings' `filingsfor` answer: the drafts `drafts` and the packet versions `packets`. */
export const FILINGS = (drafts = [], packets = []) => ({ ok: true, action: ACTION, drafts, drafts_truncated: false, packets, packets_truncated: false });
/** One draft as `filingsfor` lists it: prepared at `at`, with `o` over it (an `approval`, a `sending`, `second_needed`). */
export const DRAFT = (o = {}) => ({ filing: "FIL-2026-0101", form: "filing", tier: 2, at: "2026-11-02T10:00:00Z", approval: null, second_approval: null,
  second_needed: false, signatories: [], voice: null, sending: null, ...o });
/** A prepared draft as `filingprepare`, `communicationprepare` or `filingread` answer it. */
export const PREPARED = (o = {}) => ({ ok: true, id: "FIL-2026-0101", text: "We ask why the lease was renewed without a vote.", blanks: [], unfilled: [],
  template: null, disclosure: null, advisory: null, offers: [], ...o });
/** affordances' vocabularies: the product's kinds and `labels` for the profile's own. */
export const VOCAB = (kinds = ["records_request", "request_for_comment", "grand_jury", "other"], labels = {}) => ({ vocabularies: { action_kind: kinds,
  action_kind_labels: labels, action_basis_kinds: ["rests_on", "advances"], risk_tiers: { 1: "file freely", 2: "take care", 3: "counsel first", undetermined: "not determined" } } });
/** A project row as `list` answers it. */
export const PROJECTS = ok({ bundles: [{ bundle_id: PROJECT, title: "The Coliseum lease" }] });

/** The plane behind these screens, keyed by op; `o` over it. */
export const plane = (o = {}) => ({
  action: ok(ACT()),
  list: PROJECTS,
  projectlist: ok({ projects: [{ id: PROJECT, participation: "joined" }] }),
  filingsfor: ok(FILINGS()),
  affordances: ok(VOCAB()),
  groupidentity: ok({ group: "lakeshore", display_name: "Lakeshore Tenants" }),
  stakeatpreparation: ok({ ok: true, group_stake: "We hold the city to its own rules.", matter_stake: null, higher_stakes: false, governing_tier: 2 }),
  memberlanguage: ok({ language: "en" }),
  grouplanguages: ok({ languages: ["en"] }),
  ...o,
});

/** The served page at `path`, signed in as `whoami` (the harness's member), over `plane(o.plane)`. */
export async function open(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o.plane || {}), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}

export const main = (p) => p.doc.getElementById("cs-main") || p.root();
export const norm = (s) => String(s).replace(/\s+/g, " ").trim();
export const text = (p, el = main(p)) => norm(el ? el.textContent : "");
/** Whether the page draws the word for `key` (with `vars`), compared as text. */
export const drew = (p, key, vars = {}, el = main(p)) => text(p, el).includes(norm(word(key, vars)));
export const last = (p, op) => p.byOp(op).at(-1);
export const ops = (p, el = main(p)) => el.querySelectorAll("button[data-act]").map((b) => b.getAttribute("data-act"));
export const button = (p, op, nth = 0, el = main(p)) => el.querySelectorAll(`button[data-act="${op}"]`)[nth] || null;
/** The day as the page draws a date (`cs.date`, interface-shell R6). */
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return word("date.daymonthyear", { day: String(d), month: word("date.month." + MONTHS[m - 1]), year: String(y) }); };

/** Fills the fields `values` names. */
export function fill(p, values = {}) {
  for (const [id, v] of Object.entries(values)) {
    const el = p.doc.getElementById(id);
    if (!el) throw new Error(`no field ${id}`);
    el.value = v;
  }
}
/** Fills `values`, then presses the act `op` (its `nth` button). Where the shell asks a reason first (a Reasoned act, interface-shell
 *  R11), `reason` answers it; where it asks a confirmation (a terminal act), it is confirmed. Answers the button. */
export async function press(p, op, values = {}, { nth = 0, reason = "Because the record needs it." } = {}) {
  fill(p, values);
  const b = button(p, op, nth);
  if (!b) throw new Error(`no act ${op}`);
  await p.click(b);
  const ai = b.getAttribute("data-ai");
  const ta = p.doc.getElementById("cs-reason-" + ai.replace(":", "-"));
  if (ta) { ta.value = reason; await p.click(p.root().querySelector(`[data-shell="reason-send"][data-for="${ai}"]`)); }
  const ok = p.root().querySelector(`[data-shell="confirm"][data-for="${ai}"]`);
  if (ok) await p.click(ok);
  await p.settle();
  return b;
}
/** The words the shell draws beside an act's button (its refusal, its answer). */
export const beside = (p, b) => text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));
