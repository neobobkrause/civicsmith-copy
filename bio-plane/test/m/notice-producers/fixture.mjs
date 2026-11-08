/* notice-producers over the real modules it reads (K1563 (1)): each test file builds the provider's own test world
   (people's, money-checks', duties', answers' and inquiry's fixtures: their real modules on a real SQLite database at
   the plane's storage shape) and this module on the same host, the real provider handed in and every other provider a
   stand-in answering nothing, in the shape its requirements publish (credentials', following's and standards' too, T35; entities', T47; file-safety's and provenance's, T36;
   ai-use's, steps', question-explorer's, investigation's and review's, T41). `homesOf` and `optionsOf` are queue's (its R7,
   R12), passed in by R1; here they record what they were asked and answer a walk that finds nothing above the subjects,
   so a home set is the item's own cases. Every test drives `noticeItems` at its interface. */
import { noticeProducersOf, NoticeProducers } from "../../../src/notice-producers/index.mjs";
import { securityMapRefusal } from "../credentials/fixtures.mjs";
import { standardReadWorld } from "../standards/fixtures.mjs";
import { homeOfEmpty } from "../provenance/fixtures.mjs";
import { AiAccounts } from "../../../src/ai-accounts/index.mjs";

/** The refusals and the empty reads below are each provider's own, from its published fixtures (K4990): made by the real
 *  code, the world built on first use. */
const once = (make) => { let v; return () => (v ??= make()); };
const securityRefusals = await securityMapRefusal();
const standardsWorld = once(standardReadWorld);
const emptyProvenance = once(homeOfEmpty);
const noAccounts = new AiAccounts({ sql: null });

/** Providers answering nothing, each in its requirements' shape. */
export const NONE = Object.freeze({
  people: { checkResults: () => ({ ok: true, checks: [] }), listChecks: () => ({ ok: true, checks: [] }) },
  moneyChecks: { noticed: ({ project }) => ({ ok: true, project, label: "Noticed", items: [], truncated: false }) },
  duties: { dutiesOf: ({ entity, as }) => ({ ok: true, entity, as, duties: [], count: 0, limit: 500, truncated: false }),
            occurrencesOf: ({ dutyId }) => ({ ok: true, duty_id: dutyId, occurrences: [] }) },
  entities: { readEntity: ({ entityId }) => ({ ok: true, found: false, entity_id: entityId ?? null }) },
  answers: { standingAnswersFor: () => ({ ok: true, entries: [], cursor: null }) },
  inquiry: { datedWaits: ({ member }) => ({ ok: true, member, waits: [] }) },
  credentials: { securityLevel: () => ({ level: "Ordinary", levelAt: null }),
                 securityMap: () => securityRefusals.notAnAdmin },
  following: { policyChanges: () => ({ ok: true, changes: [], cursor: null }), dutyWatchEndAt: () => null,
               watchedBy: () => ({ ok: true, watchers: [] }) },
  /* R24 (T50; retrieval R85): the viewer's own watches */
  retrieval: { browse: ({ only }) => ({ ok: true, kinds: [], only, items: [], count: 0, limit: 200, truncated: false, next: null }) },
  standards: { standardRead: (a) => standardsWorld().standardRead(a) },
  fileSafety: { scanFindings: ({ after }) => ({ ok: true, findings: [], cursor: after ?? null, truncated: false }),
                securityToolEvents: ({ after }) => ({ ok: true, events: [], cursor: after ?? null, truncated: false }),
                securityTools: () => ({ ok: true, tools: [] }) },
  provenance: { homeOf: (sha) => emptyProvenance().homeOf(sha) },
  /* R27 (G2): capture's fetch_done records */
  capture: { fetchesDone: () => ({ ok: true, fetches: [], limit: 200, truncated: false, next: null }) },
  /* R28 (G55): calculations' finished or stopped background ingests */
  calculations: { ingestNotices: () => ({ ok: true, items: [], next: null }) },
  /* R16 (ai-use R5, R9; ai-accounts R13's suspended sign-ins retired, T53), R17 (steps, question-explorer, investigation, review), T41 */
  aiUse: { exploreAsksPending: () => ({ ok: true, asks: [] }), limitsReached: () => ({ ok: true, reached: [] }),
           /* R33 (ai-use R24) */
           thresholdsReached: () => ({ ok: true, crossed: [] }) },
  /* R34, R35 (ai-accounts R76, R72): the real module over no store answers each read empty, as it does when unreadable */
  aiAccounts: noAccounts,
  steps: { laterFound: () => ({ ok: true, found: [] }), stepsDue: () => ({ ok: true, due: [] }),
           costShares: () => ({ ok: true, shares: [] }), costMessages: () => ({ ok: true, messages: [] }) },
  questionExplorer: { findsFor: () => ({ ok: true, finds: [], truncated: false }) },
  investigation: { milestonesOverdue: () => ({ ok: true, due: [] }), quietPrompts: () => ({ ok: true, prompts: [] }) },
  review: { reviewCommentsLeftOut: () => ({ ok: true, items: [], undetermined: 0, truncated: false }) },
});

/** This module on `host`, with `real` providers and the rest answering nothing. */
export function producers(host, real = {}) {
  return noticeProducersOf(host, { ...NONE, ...real });
}

/** A fresh instance on `host` (the factory keeps one per storage), for a test that lays other providers on one world. */
export function fresh(host, real = {}) {
  return new NoticeProducers({ host, storage: host.storage, deps: { ...NONE, ...real } });
}

/** R1's read, as queue makes it: `homesOf` and `optionsOf` recorded in `asked`. */
export function reader(n) {
  const asked = { homes: [], options: [] };
  const read = (member, { viewer = member ? `member:${member}` : "class:admin", now, homes = true, options = true } = {}) =>
    n.noticeItems({ member, viewer, now: typeof now === "string" ? Date.parse(now) : now, identity: member ? `member:${member}` : null,
      homesOf: homes ? (s) => { asked.homes.push([...s]); return { state: "determined", ungrouped: true, reasons: [], depth_bound: 6, ancestors: [] }; } : undefined,
      optionsOf: options ? (s) => { asked.options.push([...s]); return s.length ? [{ id: "opt", on: [...s] }] : []; } : undefined });
  return { read, asked };
}

/** The items of a read by id. */
export const byId = (r) => Object.fromEntries(r.items.map((i) => [i.id, i]));
export const ofKind = (r, kind) => r.items.filter((i) => i.kind === kind);

/** Every string an answer carries, keys included (the words a member could be shown). */
export function texts(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => texts(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); texts(x, out); }
  return out;
}
/** The member-facing sentences of an item: its summary, its detail and its options' labels. */
export const sentences = (i) => [i.summary, i.detail, ...(i.options || []).map((o) => o.label)].filter((s) => typeof s === "string");
/** R11 (DEC-131): what the machine raised is a hint, never a signal, in member text. */
export const SIGNAL = /\bsignal(s|led|ling)?\b/i;
export const HINT = /\bhints?\b/i;
/** R11: every member-facing sentence of an R2 or R3 item marks it and calls it a hint; none says "signal". The summary
 *  and detail carry the mark; the option's words, a button, call it a hint without repeating the mark (J1's reading). */
export function hintFailures(i, mark) {
  const bad = [];
  if (i.mark !== mark) bad.push(`mark ${i.mark}`);
  for (const s of [i.summary, i.detail]) if (typeof s !== "string" || !s.startsWith(mark)) bad.push(`unmarked: ${s}`);
  for (const s of sentences(i)) {
    if (!HINT.test(s)) bad.push(`not called a hint: ${s}`);
    if (SIGNAL.test(s)) bad.push(`says signal: ${s}`);
  }
  return bad;
}
/** R11: an item of R4, R5 or R6 is no hint: no mark, and none of its sentences calls it one or carries the mark. */
export function notHintFailures(i, mark) {
  const bad = [];
  if ("mark" in i) bad.push(`mark ${i.mark}`);
  for (const s of sentences(i)) if (s.includes(mark) || HINT.test(s) || SIGNAL.test(s)) bad.push(s);
  return bad;
}
/** R2, R3 (K1473, K1491): words a machine-noticed item never says of a person. */
export const JUDGMENT = /\b(conflict|conflicted|suspicio\w*|corrupt\w*|violat\w*|breach\w*|wrongdoing|guilty)\b/i;

/** Every table's rows, to show a read wrote nothing. */
export function snapshot(sqlExec) {
  const rows = (q) => [...sqlExec(q)];
  const out = {};
  for (const { name } of rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)) out[name] = JSON.stringify(rows(`SELECT * FROM "${name}"`));
  return out;
}

/** A local day as a sentence names it, from `words.json` (R16, R20): `date.daymonth` ("October 9"), or
 *  `date.daymonthyear` ("December 31, 2025") when a year is given. Built from the words, never copied (K3810). */
import { WORDS as DAY_WORDS } from "../ai-use/fixture.mjs";
export const dayOn = (day, month, year) => {
  const m = DAY_WORDS[`date.month.${month}`];
  return year === undefined
    ? DAY_WORDS["date.daymonth"].replace("{day}", String(day)).replace("{month}", m)
    : DAY_WORDS["date.daymonthyear"].replace("{day}", String(day)).replace("{month}", m).replace("{year}", String(year));
};
