/* Standing questions (R15–R21, R26, R27; L5; K1481, K1500, K1502, K1503, K1755; DEC-139 (7)). A member keeps a
 * question with the saved query shown when it was set (the one the assistant wrote, or the one the member made in the
 * search's own form), a cadence and an end date. None of it asks for an account: a member no account serves sets,
 * runs, sees and ends one as any member does, and its new finds reach them once as a list, read by no model (R26).
 * The scheduler's tick re-runs each due question's saved query under its author's sight at that moment, with no model
 * call (R17); a run finds something new only when its result holds an id the previous run's did not, or an occurrence
 * it reads changed state (R18). Only then may the AI half answer, and only when every condition of R19 holds; it is
 * built switched off (plan Rules (7)). A question, its runs
 * and its finds are seen by its author alone (R16), and it reads nothing outside the asking scope (R21). Its author may
 * move its end date while it runs, never revive it once ended (R34). Setting, ending or moving the end of one tells each
 * module listening (R27), so the scheduler re-arms its wake.
 *
 * A standing find (R28; DEC-164 (6), K1865) keeps a find in place of a saved query: "Keep finding this as documents
 * arrive", over a scope as `retrieval.findIn` takes it. Each run calls `findIn` under its author's sight, page by page,
 * and keeps the matches' keys (kind, capture, extent and the words as read); a match is new when its key was not in the
 * previous run's. No model is ever called for it and it needs no account; its new matches reach the author once, as one
 * entry, marked "Found by search", never "machine work". It records nothing else (DEC-164 (4)).
 *
 * These are the `Answers` instance's methods' bodies (`self`); `index.mjs` binds them. */

import { localDay } from "../civil-time/index.mjs";
import { isMachineIdentity, sha256HexSync, canonicalJson } from "../record-grammar/index.mjs";
import { refusal } from "./checks.mjs";
import { checkAnswer } from "./check.mjs";
import { ReadLog } from "./readlog.mjs";
import { KEPT_AWAY_UNREADABLE } from "../ai-accounts/index.mjs";
import { word } from "../setup-words/index.mjs";

/** R15: the cadences. */
export const CADENCES = Object.freeze(["daily", "weekly", "monthly"]);
/** R17: the most questions one tick runs. */
export const STANDING_TICK_MAX = 50;
/** R20: the most entries one read answers. */
export const STANDING_ANSWERS_MAX = 200;
/** R20 (DEC-94): the label a standing answer carries. */
export const STANDING_LABEL = word("answers.machine_work_standing");
/** The copy's switch for the AI half (R19; off until the 150-question bar is met, plan Rules (7)). */
export const STANDING_AI_SETTING = "answers_standing_ai";
/** R30: the use a standing question's AI half is, for `accountFor`, `useCheck`, keep-away and its reads. */
export const STANDING_USE = "standing";
/** R17: the most ids a run reads of its saved query's answer. */
export const STANDING_IDS_MAX = 10000;
/** R28 (K1881, K1941): the most new matches one entry carries; the rest are counted. */
export const STANDING_FIND_MAX = 500;
/** R28: the most match keys a standing find keeps from one run, and the most captures one run reads (the job's bound,
 *  as R17's ids). A match past the kept keys is neither kept nor told, so it is never told twice. */
export const STANDING_FIND_KEYS_MAX = 10000;
export const STANDING_FIND_CAPTURES_MAX = 10000;
/** R28 (DEC-164 (4)): a find's matches carry `origin: "search"` ("Found by search"), and so does its entry. */
export const FIND_ORIGIN = "search";
/** R20, R28: the label a standing find's entry carries in place of "machine work". */
export const STANDING_FIND_LABEL = word("answers.found_search_standing");
/* retrieval's bounds (its R73; K1881): the most items a kind answers per call, and the most ids an enumerated scope
   holds (a selection is frozen into at most that many, K1982). */
const FIND_ITEMS = 500;
const FIND_IDS = 200;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (v) => (v === undefined ? null : JSON.stringify(v));
const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

/** The member a stamp names: `member:<id>` → `<id>`, bare `admin` → `admin`; anything else → null. */
export function memberOf(stamp) {
  if (stamp === "admin") return "admin";
  const m = /^member:([A-Za-z0-9._:-]{1,128})$/.exec(typeof stamp === "string" ? stamp : "");
  return m ? m[1] : null;
}
const stampOf = (member) => `member:${member}`;

/* Calendar arithmetic on local days (`YYYY-MM-DD`), the zone already applied. */
const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
const dayStr = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const isDay = (d) => typeof d === "string" && DAY.test(d) && dayStr(dayNum(d)) === d;
/** R17: the local day a question is next due, from the local day of its last run. A month with no such day takes its
 *  last day (the question is not skipped). */
export function nextDueDay(lastDay, cadence) {
  if (cadence === "daily") return dayStr(dayNum(lastDay) + 1);
  if (cadence === "weekly") return dayStr(dayNum(lastDay) + 7);
  const y = +lastDay.slice(0, 4), m = +lastDay.slice(5, 7), d = +lastDay.slice(8, 10);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

function today(self, now) {
  const z = self.zone() || "UTC";
  const d = localDay(String(now).replace(/\.\d+Z$/, "Z"), z);
  return typeof d === "string" ? d : now.slice(0, 10);
}

function questionAnswer(r) {
  const find = parse(r.find_json);
  return { id: r.stq_id, question: find && r.question === "" ? null : r.question, query: find ? null : parse(r.form_json),
           ...(find ? { find } : {}), cadence: r.cadence, ends: r.ends, ends_changes: parse(r.ends_changes_json) || [],
           created_at: r.created_at, ended: r.ended_at ? { at: r.ended_at, by: r.ended_by } : null,
           last_run_at: r.last_run_at, next_due: r.ended_at ? null : r.next_due };
}

/* R28: a find as the member set it, `{scope, kinds, term}` in the form `retrieval.findIn` takes them; null for anything
   that is not an object (findIn then answers its own refusal). */
function findOf(find) {
  if (find === null || typeof find !== "object" || Array.isArray(find)) return { scope: find ?? null, kinds: null, term: null };
  const kinds = Array.isArray(find.kinds) ? find.kinds : typeof find.kinds === "string" ? find.kinds.split(",") : [];
  return { scope: find.scope ?? null, kinds: [...new Set(kinds.map((k) => String(k).trim()).filter(Boolean))],
           term: typeof find.term === "string" && find.term.trim() ? find.term.trim() : null };
}
const given = (v) => v !== null && v !== undefined;

/** R15, R28: a member's standing question, by that member's own act: a saved query, or a find. */
export function standingQuestionSet(self, { author = null, owner = null, question = null, query = null, find = null,
                                            cadence = null, ends = null } = {}) {
  if (!memberOf(author) || isMachineIdentity(author))
    return refusal("MACHINE_CANNOT_AUTHOR", "a standing question is set only by a member's own act");
  if (given(query) === given(find))
    return refusal("STANDING_NEEDS_SEARCH", given(query) ? "a standing question keeps a saved query or a find, not both"
      : "a standing question keeps a saved query or a find, and neither was given");
  if (given(find)) return setFind(self, { author, owner, question, find, cadence, ends });
  const ql = self.dep("query");
  const asked = typeof query === "string" ? { q: query } : query && typeof query === "object" ? query : {};
  const saved = ql && typeof ql.savedForm === "function"
    ? ql.savedForm({ ...asked, zone: self.zone() }, self.relations()) : { ok: false, reason: "SAVED_QUERY_EMPTY", detail: "no query compiler is reachable" };
  if (!saved || saved.ok !== true) return saved;
  if (!CADENCES.includes(cadence)) return refusal("BAD_CADENCE", `the cadence is one of ${CADENCES.join(", ")}`);
  const now = self.now();
  if (!isDay(ends) || ends <= today(self, now)) return refusal("STANDING_NEEDS_END", "the end date is a date after today");
  const r = self.record.transact(() => {
    const a = self.record.allocId("STQ", now.slice(0, 4));
    if (!a || !a.id) return { ok: false, reason: "MINT_EXHAUSTED", detail: "no standing-question id could be allocated" };
    self.sql.exec(`INSERT INTO standing_questions (stq_id, author, question, form_json, cadence, ends, created_at, next_due)
                   VALUES (?,?,?,?,?,?,?,NULL)`, a.id, stampOf(memberOf(author)), String(question ?? ""), json(saved.form),
                  cadence, ends, now);
    return { ok: true, id: a.id, question: String(question ?? ""), query: saved.form, cadence, ends, created_at: now };
  });
  /* R27: a new question is due at once, on today's local day */
  if (r && r.ok) self.tellStanding(r.id, today(self, now));
  return r;
}

/* R28: a standing find. `findIn` is asked once, under the author's sight, to check the find (its refusal answered as
   given); it writes nothing. Then R15's cadence and end. A selection expires and a standing find outlives it, so a
   selection is frozen here into the bundle ids it now holds under the author's sight, read through retrieval's
   read-only `selectionRead` (its R77; N729, K1991), never `selectionResolve`, under the selection's owner (the control
   plane's stamp): setting a find extends no selection's life, and each refusal (`NO_SUCH_SELECTION`, `NOT_YOURS`, and
   `SCOPE_TOO_LARGE` over 200, K1982) writes nothing. Then the row. */
function setFind(self, { author, owner, question, find, cadence, ends }) {
  const want = findOf(find);
  const retrieval = self.dep("retrieval");
  const stamp = stampOf(memberOf(author));
  const maker = typeof owner === "string" && owner ? owner : stamp;
  const failed = (e) => ({ ok: false, reason: "NO_SCOPE", code: "NO_SCOPE", detail: String(e && e.message || e).slice(0, 200) });
  let checked;
  try {
    checked = retrieval && typeof retrieval.findIn === "function"
      ? retrieval.findIn({ ...want, limit: 1, viewer: stamp, owner: maker }) : failed("no find is reachable");
  } catch (e) { checked = failed(e); }
  if (!checked || checked.ok !== true) return checked;
  if (!CADENCES.includes(cadence)) return refusal("BAD_CADENCE", `the cadence is one of ${CADENCES.join(", ")}`);
  const now = self.now();
  if (!isDay(ends) || ends <= today(self, now)) return refusal("STANDING_NEEDS_END", "the end date is a date after today");
  const handle = want.scope && typeof want.scope === "object" && Object.keys(want.scope).length === 1
    ? want.scope.selection : undefined;
  if (handle !== undefined) {
    let sel;
    try {
      sel = typeof retrieval.selectionRead === "function" ? retrieval.selectionRead({ handle, viewer: stamp, owner: maker })
        : failed("no selection read is reachable");
    } catch (e) { sel = failed(e); }
    if (!sel || sel.ok !== true) return sel;
    const ids = Array.isArray(sel.members) ? sel.members : [];
    if (ids.length > FIND_IDS)
      return { ok: false, reason: "SCOPE_TOO_LARGE", code: "SCOPE_TOO_LARGE", limit: FIND_IDS, got: ids.length,
               detail: `a standing find keeps a selection as the ids it holds, at most ${FIND_IDS}, and this one holds ${ids.length}` };
    want.scope = { ids };
  }
  const words = typeof question === "string" && question.trim() ? question : null;
  const r = self.record.transact(() => {
    const a = self.record.allocId("STQ", now.slice(0, 4));
    if (!a || !a.id) return { ok: false, reason: "MINT_EXHAUSTED", detail: "no standing-question id could be allocated" };
    self.sql.exec(`INSERT INTO standing_questions (stq_id, author, question, form_json, find_json, cadence, ends, created_at, next_due)
                   VALUES (?,?,?,?,?,?,?,?,NULL)`, a.id, stamp, words ?? "", json(null), json(want), cadence, ends, now);
    return { ok: true, id: a.id, question: words, find: want, cadence, ends, created_at: now };
  });
  if (r && r.ok) self.tellStanding(r.id, today(self, now));   /* R27 */
  return r;
}

/* R16: the author's own row, or null for any other viewer, an administrator included. */
function own(self, id, viewer) {
  const m = memberOf(viewer);
  if (!m || typeof id !== "string") return null;
  const r = self.one(`SELECT * FROM standing_questions WHERE stq_id=?`, id);
  return r && memberOf(r.author) === m ? r : null;
}

const noSuch = (id) => refusal("NO_SUCH_STANDING_QUESTION", "no standing question of yours answers to that", { id: id ?? null });

/** R16: one of the viewer's own questions; any other viewer is answered as for none. */
export function standingQuestionRead(self, { id = null, viewer = null } = {}) {
  const r = own(self, id, viewer);
  if (!r) return noSuch(id);
  passEnd(self, r, self.now());
  return { ok: true, question: questionAnswer(own(self, id, viewer)) };
}

/** R16: the viewer's own questions. */
export function standingQuestionsOf(self, { viewer = null } = {}) {
  const m = memberOf(viewer);
  if (!m) return { ok: true, questions: [] };
  const rows = self.rows(`SELECT * FROM standing_questions WHERE author=? ORDER BY stq_id`, stampOf(m));
  return { ok: true, questions: rows.map(questionAnswer) };
}

/** R16: the author ends their own question, at any time. */
export function standingQuestionEnd(self, { id = null, author = null } = {}) {
  const r = own(self, id, author);
  if (!r) return noSuch(id);
  if (r.ended_at) return { ok: true, id, already: true, ended: { at: r.ended_at, by: r.ended_by } };
  const at = self.now();
  self.record.transact(() => {
    self.sql.exec(`UPDATE standing_questions SET ended_at=?, ended_by=? WHERE stq_id=?`, at, r.author, id);
    return { ok: true };
  });
  self.tellStanding(id, null);   /* R27 */
  return { ok: true, id, ended: { at, by: r.author } };
}

/** R34 (T45; N855; Actions D6d; v0.2 rule 17): the author changes their own question's end date, by their own act or
 *  inside it by `following` (its R25's `keep`). Refusals in order, each writing nothing: a machine or empty author; a
 *  question not the author's, answered as for none (R16); an ended one, by its author or by its date, never revived
 *  (`STANDING_ENDED`); an end not a calendar day after today's local day (R15's rule). The same end answers
 *  `unchanged` and writes nothing. Otherwise the new end is recorded, each earlier one kept on the question with who
 *  changed it and when (seen by its author alone, R16), and R27's listeners are told once after the act commits. No
 *  model, no account (R26). */
export function standingQuestionEndSet(self, { id = null, ends = null, author = null } = {}) {
  if (!memberOf(author) || isMachineIdentity(author))
    return refusal("MACHINE_CANNOT_AUTHOR", "a standing question's end date is changed only by its author's own act");
  const r = own(self, id, author);
  if (!r) return noSuch(id);
  const now = self.now();
  const day = today(self, now);
  /* R16: ended by its author, or past its end date (it ends itself; that write is the tick's or a read's, not this
     refusal's) */
  if (r.ended_at || day > r.ends)
    return refusal("STANDING_ENDED", "this standing question has ended and is never revived; set a new one", { id });
  if (!isDay(ends) || ends <= day) return refusal("STANDING_NEEDS_END", "the end date is a date after today");
  if (ends === r.ends) return { ok: true, id, ends, unchanged: true };
  const changes = [...(parse(r.ends_changes_json) || []), { ends, was: r.ends, at: now, by: r.author }];
  const done = self.record.transact(() => {
    self.sql.exec(`UPDATE standing_questions SET ends=?, ends_changes_json=? WHERE stq_id=? AND ended_at IS NULL`,
                  ends, json(changes), id);
    return { ok: true };
  });
  if (!done || done.ok !== true) return done;
  /* R27: the next due day the scheduler re-arms on: the one held, or today for a question not yet run; none when it
     falls after the new end */
  const due = r.next_due ?? day;
  self.tellStanding(id, due <= ends ? due : null);
  return { ok: true, id, ends, was: r.ends };
}

/* R16: a question past its end date ends itself. */
function passEnd(self, r, now) {
  if (r.ended_at) return true;
  if (today(self, now) > r.ends) {
    self.sql.exec(`UPDATE standing_questions SET ended_at=?, ended_by='ends' WHERE stq_id=? AND ended_at IS NULL`, now, r.stq_id);
    return true;
  }
  return false;
}

function dueRows(self, now) {
  const d = today(self, now);
  return self.rows(`SELECT * FROM standing_questions WHERE ended_at IS NULL AND (next_due IS NULL OR next_due <= ?)
                    ORDER BY COALESCE(next_due, substr(created_at, 1, 10)), created_at, stq_id`, d)
    .filter((r) => d <= r.ends);
}

/** R17: how many questions are due at `now`. */
export function standingDue(self, now) { return dueRows(self, now).length; }

/** R17: when the next question falls due: `now` when one is due, else the first instant of the earliest next due day,
 *  or null when no question will run again. */
export function standingWake(self, now) {
  if (standingDue(self, now) > 0) return now;
  const d = today(self, now);
  const r = self.one(`SELECT MIN(next_due) AS d FROM standing_questions WHERE ended_at IS NULL AND next_due > ? AND next_due <= ends`, d);
  if (!r || !r.d) return null;
  const z = self.zone() || "UTC";
  const range = self.dayStart(r.d, z);
  return range || `${r.d}T00:00:00Z`;
}

/* R18: the occurrences a run reads: those of each duty its result names. */
async function occurrenceStates(self, ids, author, now) {
  const duties = self.dep("duties");
  const out = {};
  if (!duties || typeof duties.occurrencesOf !== "function") return out;
  for (const id of ids.filter((x) => /^DUT-\d{4}-/.test(x))) {
    let r;
    try { r = await duties.occurrencesOf({ dutyId: id, asOf: now.replace(/\.\d+Z$/, "Z"), viewer: author }); } catch { r = null; }
    for (const o of (r && r.occurrences) || []) if (o && o.key) out[`${id}/${o.key}`] = o.state ?? null;
  }
  return out;
}

/* R19 (T37; N765, K231, K2200): keep-away as ai-accounts' one site answers it (its R7, `aiKeptAway`, asked for the
 * `standing` use, its R22): null while the group does not keep its material away from standing questions; otherwise
 * its `AI_KEPT_AWAY` refusal, which is also its answer when the setting cannot be read (fail closed, K2093). Only the
 * refusal's code and translation are carried. An ai-accounts that cannot be reached, whose read throws, or that
 * answers neither null nor a refusal, is not a reading of null: kept away, fail closed, carrying
 * `KEPT_AWAY_UNREADABLE`'s row as given (ai-accounts R34), never a code minted here (K231). */
function keptAway(accounts) {
  let away;
  try { away = accounts && typeof accounts.aiKeptAway === "function" ? accounts.aiKeptAway({ use: STANDING_USE }) : undefined; }
  catch { away = undefined; }
  if (away === null) return null;
  const r = away && typeof away === "object" && away.ok === false && (away.code || away.reason) ? away : KEPT_AWAY_UNREADABLE;
  return { condition: "kept_away", code: r.code || r.reason, translation: r.translation ?? null };
}

/* R19, R30: an account's refusal read as the condition that held the AI half back. Keep-away is never reported as
 * `no_account`, nor an account's refusal as `kept_away`; an account whose `standing` use is off (ai-accounts R11's
 * `AI_USE_SWITCHED_OFF`, naming whose, or R32's `STANDING_SWITCH_OFF`) is `switch_off` naming that account. */
const SWITCH_OF = { own: "member", group: "group", project: "project" };
function accountHeld(r, level) {
  const code = r ? r.code || r.reason || null : null;
  const translation = r ? r.translation ?? null : null;
  if (code === "AI_KEPT_AWAY" || code === "PROJECT_AI_KEPT_AWAY") return { condition: "kept_away", code, translation };
  if (code === "AI_USE_SWITCHED_OFF") return { condition: "switch_off", switch: SWITCH_OF[r.whose] || level || "member" };
  if (code === "STANDING_SWITCH_OFF") return { condition: "switch_off", switch: level || "member" };
  if (code === "NO_ACCOUNT" || code === null) return { condition: "no_account" };
  return { condition: "no_account", code, translation };
}

/** R19, R30: the paying owner of an account `ai-accounts.accountFor` answered, spelled as `ai-use` R1's. */
export function ownerOf(account, member) {
  /* (ai-accounts:124, :188) T53's answer names its owner as ai-use spells it; the level is read only when it does not */
  if (account && typeof account.owner === "string" && /^(group|project:.+|member:(?!member:).+)$/.test(account.owner)) return account.owner;
  if (account && account.level === "project" && account.project) return `project:${account.project}`;
  if (account && account.level === "group") return "group";
  return `member:${memberOf(member) ?? member}`;
}

/** R19, R30 (ai-use:105, its R3 T53): the account `accountFor` chose and its entry, as `useCheck` takes them, so a provider
 *  limit standing on the account or the entry (ai-use R18) holds the use back as the paying account's own limits do. Only
 *  the two ids; never a secret. */
export function accountNamed(account) {
  const id = (v) => (typeof v === "string" && v ? v : null);
  const out = {};
  if (account && id(account.account_id)) out.account_id = account.account_id;
  if (account && id(account.entry_id)) out.entry_id = account.entry_id;
  return out;
}

/* R19, R26, R30: what holds the AI half back, or null with the grant it reads under when every condition holds. In
 * order: the copy's switch (K1481; Rule 7), the answerer's deployment, keep-away (ai-accounts R7's `aiKeptAway`, read
 * before any account: while it holds no account is read and no grant minted, DEC-172), the account serving the
 * author's act of kind `standing` (ai-accounts R7, R11, no `project`, K2348: their own reference, else their own Claude
 * sign-in, else the group's key while held and on; none is R26's `no_account`; the one chosen with its `standing` use
 * off is `switch_off` naming it, never the next account), the paying account's limits (`ai-use.useCheck`, its R3, in
 * place of the ceiling: `AI_LIMIT_REACHED` is `limit`), and last the grant credentials mints for the author (its R32).
 * A sign-in is the author's own act, level `member`: with its `standing` use on it is granted and runs as the author's
 * reference does (N796, Bob K2425); off, it is `{switch_off, member}`. The grant is minted only when it would be used. */
async function heldBack(self, r, at) {
  const author = r.author;
  if (self.record.getSetting(STANDING_AI_SETTING) !== true) return { held: { condition: "switch_off", switch: "copy" } };
  if (!self.answerer) return { held: { condition: "not_deployed" } };
  const accounts = self.dep("accounts");
  const away = keptAway(accounts);
  if (away) return { held: away };
  const act = { kind: STANDING_USE, member: author };
  let acct = null;
  try { acct = accounts && typeof accounts.accountFor === "function" ? await accounts.accountFor({ member: author, act }) : null; }
  catch { acct = null; }
  if (!acct || acct.ok !== true) return { held: accountHeld(acct, null) };
  const level = acct.level === "group" ? "group" : acct.level === "project" ? "project" : "member";
  const owner = ownerOf(acct, author);
  const named = accountNamed(acct);
  acct = null;   /* the account's key is used by no caller here (ai-accounts R3, R7; agent-model R8) */
  const check = self.dep("useCheck");
  let limit;
  try { limit = typeof check === "function" ? await check({ owner, member: memberOf(author), use: STANDING_USE, at, ...named }) : undefined; }
  catch { limit = undefined; }
  /* a limit that cannot be judged holds it back, fail closed (ai-use R3) */
  if (limit === undefined) return { held: { condition: "limit", code: null, translation: null } };
  if (limit && limit.ok === false)
    return { held: { condition: "limit", code: limit.code || limit.reason, translation: limit.translation ?? null } };
  /* the grant stays credentials' (its R32), the only read of credentials here */
  const creds = self.dep("credentials");
  let g = null;
  try { g = await creds.aiGrantMintStanding({ member: author, question: r.question }); } catch { g = null; }
  if (!g || g.ok !== true || typeof g.token !== "string") {
    const code = g ? g.code || g.reason || null : null;
    if (code === "NO_QUESTION" || (code && !["AI_KEPT_AWAY", "PROJECT_AI_KEPT_AWAY", "AI_USE_SWITCHED_OFF",
        "STANDING_SWITCH_OFF", "NO_ACCOUNT", "ACCOUNT_MEMBER_NOT_ACTIVE"].includes(code)))
      return { held: { condition: "grant_refused", code, translation: g ? g.translation ?? null : null } };
    return { held: accountHeld(g, level) };
  }
  return { held: null, grant: g.token, owner };
}

/* R28: a match's key: its kind, capture and extent, and the words as read (two amounts in one paragraph share an
   extent), with the entity a name corresponds to and a table's column; the words stand in where no extent is read. */
function matchKey(m) {
  const t = m && m.table ? m.table : null;
  return sha256HexSync(canonicalJson({
    kind: m.kind ?? null, capture: m.capture_sha ?? (t && t.capture_sha) ?? null, extent: m.extent ?? (t && t.extent) ?? null,
    as_read: m.as_read ?? null, entity: m.entity && m.entity.entity_id ? m.entity.entity_id : null,
    column: t ? t.column ?? null : null, words: (m.extent ?? (t && t.extent)) == null ? m.words ?? null : null,
  })).slice(0, 32);
}

/* R28: one run of a standing find: `findIn` over the whole scope, page by page, under the author's sight now. */
async function runFind(self, r, now) {
  const retrieval = self.dep("retrieval");
  const want = parse(r.find_json) || {};
  const day = today(self, now);
  const next = nextDueDay(day, r.cadence);
  const matches = [];
  let cursor = null, read = 0, refused = null, partial = false;
  do {
    let res = null;
    try {
      res = retrieval && typeof retrieval.findIn === "function"
        ? retrieval.findIn({ scope: want.scope, kinds: want.kinds, term: want.term, limit: FIND_ITEMS, cursor,
                             viewer: r.author, owner: r.author })
        : null;
    } catch { res = null; }
    if (!res || res.ok !== true) { refused = res ? res.reason ?? res.code ?? null : "no retrieval"; break; }
    for (const k of res.kinds || []) {
      for (const m of k.items || []) matches.push(m);
      if (k.truncated) partial = true;
    }
    read += res.captures_read || 0;
    cursor = res.next ?? null;
    if (cursor !== null && read >= STANDING_FIND_CAPTURES_MAX) { partial = true; break; }
  } while (cursor !== null);
  if (refused !== null) {
    /* the run could not read its scope: it ran, found nothing, and says why */
    self.record.transact(() => {
      self.sql.exec(`UPDATE standing_questions SET last_run_at=?, next_due=? WHERE stq_id=?`, now, next, r.stq_id);
      self.sql.exec(`INSERT INTO standing_runs (stq_id, author, at, new_found, held_back_json) VALUES (?,?,?,0,?)`,
                    r.stq_id, r.author, now, json({ condition: "query_refused", reason: refused }));
      return { ok: true };
    });
    return { id: r.stq_id, ran: true, new_found: false };
  }
  const keyed = [], keys = new Set();
  for (const m of matches) {
    const k = matchKey(m);
    if (keys.has(k)) continue;
    if (keys.size >= STANDING_FIND_KEYS_MAX) { partial = true; break; }
    keys.add(k);
    keyed.push([k, m]);
  }
  const first = r.last_run_at === null;
  const prev = new Set(parse(r.last_ids_json) || []);
  const fresh = first ? [] : keyed.filter(([k]) => !prev.has(k)).map(([, m]) => m);
  const found = fresh.length > 0;
  const finds = found ? { matches: fresh.slice(0, STANDING_FIND_MAX), truncated: fresh.length > STANDING_FIND_MAX,
                          more: Math.max(0, fresh.length - STANDING_FIND_MAX), origin: FIND_ORIGIN,
                          ...(partial ? { partial: true } : {}) } : null;
  self.record.transact(() => {
    self.sql.exec(`UPDATE standing_questions SET last_run_at=?, next_due=?, last_ids_json=?, last_occ_json=NULL, last_digest=NULL
                   WHERE stq_id=?`, now, next, json([...keys]), r.stq_id);
    if (found) self.sql.exec(`INSERT INTO standing_runs (stq_id, author, at, new_found, finds_json) VALUES (?,?,?,1,?)`,
                             r.stq_id, r.author, now, json(finds));
    else self.sql.exec(`INSERT INTO standing_runs (stq_id, author, at, new_found) VALUES (?,?,?,0)`, r.stq_id, r.author, now);
    return { ok: true };
  });
  return { id: r.stq_id, ran: true, new_found: found, ...(found ? { held_back: null } : {}) };
}

/* One run of one question (R17–R19; a standing find's, R28). */
async function runOne(self, r, now) {
  if (r.find_json) return runFind(self, r, now);
  const retrieval = self.dep("retrieval");
  const form = parse(r.form_json);
  let res = null;
  try { res = retrieval ? retrieval.runSaved({ form, owner: r.author, viewer: r.author, limit: STANDING_IDS_MAX }) : null; }
  catch { res = null; }
  const day = today(self, now);
  const next = nextDueDay(day, r.cadence);
  if (!res || res.ok !== true) {
    /* the run could not read its query: it ran, found nothing, and says why */
    self.record.transact(() => {
      self.sql.exec(`UPDATE standing_questions SET last_run_at=?, next_due=? WHERE stq_id=?`, now, next, r.stq_id);
      self.sql.exec(`INSERT INTO standing_runs (stq_id, author, at, new_found, held_back_json) VALUES (?,?,?,0,?)`,
                    r.stq_id, r.author, now, json({ condition: "query_refused", reason: res ? res.reason ?? null : "no retrieval" }));
      return { ok: true };
    });
    return { id: r.stq_id, ran: true, new_found: false };
  }
  const ids = res.ids || [];
  const occ = await occurrenceStates(self, ids, r.author, now);
  const first = r.last_run_at === null;
  const prevIds = new Set(parse(r.last_ids_json) || []);
  const prevOcc = parse(r.last_occ_json) || {};
  const newIds = first ? [] : ids.filter((x) => !prevIds.has(x));
  const changed = first ? [] : Object.entries(occ).filter(([k, s]) => k in prevOcc && prevOcc[k] !== s)
    .map(([k, s]) => ({ occurrence: k, from: prevOcc[k], to: s }));
  const found = newIds.length > 0 || changed.length > 0;
  const finds = found ? { ids: newIds, occurrences: changed } : null;
  let answer = null, withheld = null, held = null;
  if (found) {
    const hb = await heldBack(self, r, now);
    held = hb.held;
    if (!held) {
      /* R19: the answerer reads under the grant credentials minted (its R32), each read logged here (R1, R2) */
      const log = new ReadLog({ grant: hb.grant, viewer: r.author, at: now, use: STANDING_USE });
      self.holdLog(log);
      try {
        const given = await self.answerer.fn({ id: r.stq_id, question: r.question, query: form, finds, author: r.author,
                                               grant: log.grant, mode: "ask" });
        const checked = checkAnswer(given, { readLog: log, viewer: r.author });
        if (checked.ok) { answer = checked.answer; withheld = checked.withheld; }
        else { held = { condition: "answer_refused", code: checked.code }; }
        self.countAsk({ outcome: checked.ok ? "answered" : "refused",
                        codes: checked.ok ? checked.withheld.map((w) => w.code) : [checked.code], mode: "standing", at: now });
      } catch (e) {
        held = { condition: "answerer_failed", reason: String(e && e.message || e).slice(0, 200) };
      } finally { self.dropLog(log.grant); }
    }
  }
  self.record.transact(() => {
    self.sql.exec(`UPDATE standing_questions SET last_run_at=?, next_due=?, last_ids_json=?, last_occ_json=?, last_digest=?
                   WHERE stq_id=?`, now, next, json(ids), json(occ), res.digest ?? null, r.stq_id);
    if (found) self.sql.exec(`INSERT INTO standing_runs (stq_id, author, at, new_found, finds_json, answer_json, withheld_json, held_back_json)
                              VALUES (?,?,?,1,?,?,?,?)`, r.stq_id, r.author, now, json(finds), json(answer), json(withheld), json(held));
    else self.sql.exec(`INSERT INTO standing_runs (stq_id, author, at, new_found) VALUES (?,?,?,0)`, r.stq_id, r.author, now);
    return { ok: true };
  });
  return { id: r.stq_id, ran: true, new_found: found, ...(found ? { held_back: held } : {}) };
}

/** R17: runs each due question's saved query, at most 50, oldest due first. */
export async function standingTick(self, now) {
  const at = typeof now === "string" ? now : self.now();
  const all = self.rows(`SELECT * FROM standing_questions WHERE ended_at IS NULL`);
  for (const r of all) passEnd(self, r, at);
  const due = dueRows(self, at);
  const ran = [];
  for (const r of due.slice(0, STANDING_TICK_MAX)) ran.push(await runOne(self, r, at));
  return { at, ran, remaining: Math.max(0, due.length - STANDING_TICK_MAX) };
}

/** R20: the runs of a member's own questions that found something new, each told once, in run order after `after`. */
export function standingAnswersFor(self, { member = null, after = null, limit = null } = {}) {
  const m = memberOf(member) ?? (typeof member === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(member) ? member : null);
  if (!m) return { ok: true, entries: [], cursor: null };
  const n = Number(limit);
  const cap = Number.isInteger(n) && n > 0 ? Math.min(n, STANDING_ANSWERS_MAX) : STANDING_ANSWERS_MAX;
  const from = Number.isInteger(Number(after)) ? Number(after) : 0;
  const rows = self.rows(`SELECT r.*, q.question, q.find_json FROM standing_runs r JOIN standing_questions q ON q.stq_id = r.stq_id
                          WHERE r.author=? AND r.new_found=1 AND r.seq > ? ORDER BY r.seq LIMIT ?`, stampOf(m), from, cap + 1);
  const page = rows.slice(0, cap);
  return { ok: true,
           entries: page.map((x) => ({ question: { id: x.stq_id, question: x.find_json && x.question === "" ? null : x.question },
                                       run: x.seq, at: x.at, finds: parse(x.finds_json), answer: parse(x.answer_json),
                                       withheld: parse(x.withheld_json) || [], held_back: parse(x.held_back_json),
                                       label: x.find_json ? STANDING_FIND_LABEL : STANDING_LABEL,
                                       ...(x.find_json ? { origin: FIND_ORIGIN } : {}) })),
           cursor: rows.length > cap ? page[page.length - 1].seq : null };
}
