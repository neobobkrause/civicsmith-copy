/* money-checks — checks over money facts that raise questions, never verdicts (requirements:
 * `build/requirements/money-checks.md`; T33-34, split from `money` at creation with no copy, K1504 Choices 9).
 *
 * Two kinds of thing live here:
 * - AMOUNT CHECKS, derived on every read and never stored: over one contract (R2; committed against paid, a signed
 *   amount against its award, change orders against a stated share of the award) and over one progression instance
 *   (R1; the amount part of progressions R32, moved here, K1505 (8), K1521: a signed amount against the award, and
 *   amendments past a stated share). A member declared the contract and the flow, so these answer at once, labelled
 *   "Noticed", each with the facts and stages read.
 * - DETECTORS (K1491), data-defined patterns the machine runs on its own over the facts held (R4–R7): a population
 *   filter, a closed `calc-grammar` recipe as the condition, a stated denominator and derivation. Their results are
 *   held in a table and reach a reader only through `noticed` (R9), for a detector version whose measured false-alarm
 *   rate is at most 20% (K1504) and that is switched on for the project; nothing else is shown or counted (plan T33
 *   Rule 7).
 * Nothing here is a fact, a finding about a person, or a score standing for a judgment (K1471, K1473); no result is
 * written anywhere but this module's own tables (R10).
 *
 * `money` is reached through its services (`readFact`, `moneyOf`, `summable`, `committedAgainstPaid`; J1, K1563)
 * and its read contract (money R19, named whole by K1563 (4)),
 * read in `#populationFacts` and `#captureOf`; a threshold or share is held by `stateParameter` (R3).
 *
 * REACHED as `moneyChecksOf(host, deps)` (K61): one instance per host, created on the first call with `deps`:
 *   record       `recordOf(host)`: `transact`, `declareTable`.
 *   membership   `membershipOf(host)`: `isAdministrator` (R8, R11); `existenceAct`, `participation` (R5, R13; K2467).
 *   entities     `entitiesOf(host)`: `readEntity` (an entity's kind: a person is never a subject, R4).
 *   progressions `progressionsOf(host)`: `readInstance` (R1), and its read contract `progression_instances` (its R34).
 *   money        `moneyOf(host)`: `readFact`, `moneyOf`, `summable`, `committedAgainstPaid` (R1, R2, R13).
 *   now          the clock for the instants written, an ISO string (default: the wall clock).
 *   nowMs        the clock a run's budget is measured on, milliseconds (default: the wall clock). */

import { isHypothesisId, isMachineIdentity, idPattern, sha256HexSync, canonicalJson } from "../record-grammar/index.mjs";
import { checkRecipe, evaluate, parseFigure, add, subtract, multiply, divide } from "../calc-grammar/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { viewerPredicate, noSuchProject, notAnAdmin, notAParticipant, membershipOf, listenerRefusal } from "../membership/index.mjs";
import { entitiesOf, noSuchEntity } from "../entities/index.mjs";
import { progressionsOf } from "../progressions/index.mjs";
import { moneyOf } from "../money/index.mjs";
import { moneyChecksTables, migrateMoneyChecks } from "./schema.mjs";
import { refusal } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { MONEY_CHECKS_SCHEMA } from "./schema.mjs";
export { MONEY_CHECKS_CHECKS } from "./checks.mjs";

/** R9 (K1504): the false-alarm rate at or under which a detector version's results may be shown. */
export const GATE_MAX = "0.2";
/** R6 (N604): the run's stated default budget, as `duties` and `people` state theirs. */
export const DETECTORS_DEFAULT_BUDGET_MS = 1000;
/** R11 (N618): the machine's stamp that may run the detectors through the op, besides an administrator. */
export const DETECTORS_RUNNER = "class:daemon";
/** R9: the bounds of `noticed`. */
export const NOTICED_DEFAULT = 100, NOTICED_MAX = 500;
/** R1, R2, R9: the one label every check and shown result carries: the machine's, a question. */
export const NOTICED = "Noticed";
/** R17 (DEC-131; K1863, N694): the mark every "Noticed" answer carries beside its label where an op relays it to a
 *  member, DEC-131's words exactly; `notice-producers` exports the same string as its `HINT_MARK`. */
export const HINT_MARK = word("mark.hint.label");
/** R4: how a detector groups the facts of its population into subjects. A subject is a fact, a contract, or the
 *  pattern of facts paid to (or by) one party; a party that is a person is never a subject (R4, R10). */
export const PER = Object.freeze(["fact", "contract", "payee", "payer"]);
/** R4: the filters a population may state, each over a column of money's read contract (money R19). */
export const POPULATION_FILTERS = Object.freeze({ kinds: "kind", phases: "phase", stages: "stage", bases: "basis",
                                                 currencies: "currency" });
/** R4: the inputs a detector's recipe may name besides its parameters. */
export const DETECTOR_INPUTS = Object.freeze({ facts: word("money-checks.subject_facts"), population: word("money-checks.fact_population") });
/** R3: the checks that read a parameter, and the parameters each reads. */
export const CHECK_PARAMETERS = Object.freeze({
  change_orders_past_share: Object.freeze({ share: word("money-checks.share_award_proportion") }),
  junction_stages: Object.freeze({ award_stage: word("money-checks.stage_key_holding"), signed_stage: word("money-checks.stage_key_holding_signed") }),
});
/* The table money facts are bound to a recipe as (calc-grammar's Table Schema types). `period` is one value per
   accounting period, so calc-grammar's summation rule (its R13) refuses a sum across periods by name. */
const FACT_FIELDS = Object.freeze([
  { name: "fact_id", type: "string" }, { name: "amount", type: "number" }, { name: "currency", type: "string" },
  { name: "kind", type: "string" }, { name: "phase", type: "string" }, { name: "stage", type: "string" },
  { name: "basis", type: "string" }, { name: "period", type: "string" }, { name: "from_entity", type: "string" },
  { name: "to_entity", type: "string" },
].map((f) => Object.freeze(f)));

const ENT_RE = idPattern("ENT");
const LABEL_MAX = 200, TEXT_MAX = 4000;
const str = (v) => (typeof v === "string" ? v.trim() : "");
const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const json = (v) => canonicalJson(v);
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
/* Every string anywhere in a value (keys and values), for the R4 and R12 scans. */
function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (plain(v)) for (const [k, x] of Object.entries(v)) { out.push(k); strings(x, out); }
  return out;
}

/* ---- figures (calc-grammar's exact decimals; R2, R3) ---- */

/** A money fact's amount as a calc-grammar figure, from either of money's two forms: its read (money R8: `amount`
 *  unsigned, or `{low, high}` for a range, with `sign`) or a row of its read contract (money R19: `amount`, `amount_low`,
 *  `amount_high` signed). Exact decimals throughout; the sign and precision as money holds them. */
export function factFigure(f) {
  const neg = (d) => typeof d === "string" && d.startsWith("-");
  const abs = (d) => (neg(d) ? d.slice(1) : String(d));
  const cur = f.currency ? { currency: f.currency } : {};
  if (f.precision === "range") {
    if (plain(f.amount)) {
      const minus = f.sign === "-";
      const low = minus ? `-${abs(f.amount.high)}` : abs(f.amount.low), high = minus ? `-${abs(f.amount.low)}` : abs(f.amount.high);
      return { low, high, sign: minus ? "-" : "+", precision: "range", ...cur };
    }
    return { low: String(f.amount_low), high: String(f.amount_high), sign: neg(f.amount_low) ? "-" : "+", precision: "range", ...cur };
  }
  return { value: abs(f.amount), sign: f.sign === "-" || neg(f.amount) ? "-" : "+", precision: f.precision || "exact", ...cur };
}
const isZero = (v) => typeof v === "string" && /^0*(\.0*)?$/.test(v);
/* The relation of two figures: "lower", "equal", "higher", or `{undetermined, why}` / `{refused, why}`. An approximate
   or range difference is undetermined: the machine never concludes past what was printed (R1). */
function relation(a, b) {
  const d = subtract(a, b);
  if (d && d.refused) return d;
  if (d.precision === "range" || d.precision === "approximate")
    return { undetermined: true, why: word("money-checks.why.amount_approximate_range") };
  return isZero(d.value) ? "equal" : d.sign === "-" ? "lower" : "higher";
}
/** R3: a share as stated, to a proportion figure: `0.1`, or `10%` read as 0.1; null when it is neither. */
export function shareFigure(text) {
  const f = parseFigure(String(text ?? ""));
  if (!f || f.refused || f.precision === "range" || f.precision === "approximate" || f.sign === "-") return null;
  if (f.unit === "percent") return divide({ value: f.value, sign: "+", precision: "exact" }, { value: "100", sign: "+", precision: "exact" },
                                          { places: 12, mode: "half_even" });
  return f.unit || f.currency ? null : { value: f.value, sign: "+", precision: f.precision };
}

export class MoneyChecks {
  constructor({ storage, record, membership, entities, progressions, money, now = null, nowMs = null }) {
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.entities = entities;
    this.progressions = progressions;
    this.money = money;
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    this.nowMs = typeof nowMs === "function" ? nowMs : () => Date.now();
    this.listeners = [];
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  migrate() { migrateMoneyChecks(this.sql); }

  /* R11: THE ONE APPEND SITE. Every row this module writes goes through here, inside the caller's transaction. */
  #append(table, row) {
    const cols = Object.keys(row);
    this.sql.exec(`INSERT OR IGNORE INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
                  ...cols.map((c) => row[c]));
  }

  /* ---- who is acting, and what a viewer sees ---- */

  /* R5: a member's act is stamped with a member's own name, never a machine credential's. */
  static #memberOf(by) {
    const b = str(by);
    if (!b || isMachineIdentity(b)) return null;
    return b.startsWith("member:") ? b.slice(7) : b;
  }
  static #viewerOf(memberId) { return memberId === "admin" ? "admin" : `member:${memberId}`; }

  /* R5, R9: may this viewer see the project? membership's one rule (its R43) over record-core's `bundles` (its R37). */
  #projectSeen(projectId, viewer) {
    const gate = viewerPredicate(viewer);
    return !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND b.object_type='project' AND (${gate.sql})`,
                       projectId, ...gate.args);
  }
  /* R13: may this viewer see a bundle (a placement's document)? A placement with no bundle is the group's. */
  #bundleSeen(viewer) {
    const gate = viewerPredicate(viewer);
    return (id) => !id || !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args);
  }
  /* R13: the facts this viewer may see, asked of `money` (a fact follows its source capture's sight, money R21). */
  #factSeer(viewer) {
    const memo = new Map();
    return (id) => {
      if (!memo.has(id)) {
        let seen = false;
        try { const r = this.money.readFact({ factId: id, viewer }); seen = !!(r && r.ok !== false && r.found !== false && r.fact); }
        catch { seen = false; }
        memo.set(id, seen);
      }
      return memo.get(id);
    };
  }
  #kindOf(entityId) {
    try {
      const r = this.entities.readEntity({ entityId });
      return r && r.found && r.entity ? r.entity.kind : null;
    } catch { return null; }
  }

  /* ===================================================================== *
   * R3: PARAMETERS — a threshold or share a check reads, stated with its citation
   * ===================================================================== */

  /** R3: states a parameter of a check, for one contract or (no contract) group-wide. A member's act; every statement
   *  is kept and the latest governs. */
  stateParameter({ check, name, value, citation, contract = null, by } = {}) {
    const member = MoneyChecks.#memberOf(by);
    if (!member) return refusal("MEMBER_ACT_ONLY", { by: by ?? null });
    const ck = str(check), nm = str(name), cite = str(citation), con = str(contract);
    if (!ck) return refusal("NO_CHECK");
    if (!CHECK_PARAMETERS[ck]) return refusal("UNKNOWN_CHECK", { check_key: ck, checks: Object.keys(CHECK_PARAMETERS) });
    if (!CHECK_PARAMETERS[ck][nm]) return refusal("UNKNOWN_PARAMETER", { check_key: ck, name: nm || null, parameters: { ...CHECK_PARAMETERS[ck] } });
    const v = typeof value === "number" ? String(value) : str(value);
    if (!v) return refusal("NO_VALUE", { check_key: ck, name: nm });
    if ([v, cite, con].some(isHypothesisId)) return refusal("HYPOTHESIS_NOT_INPUT", { check_key: ck, name: nm });
    const ok = nm === "share" ? shareFigure(v) !== null : v.length <= LABEL_MAX;
    if (!ok) return refusal("BAD_VALUE", { check_key: ck, name: nm, takes: CHECK_PARAMETERS[ck][nm] });
    if (!cite) return refusal("MONEY_CHECK_NO_CITATION", { check_key: ck, name: nm });
    if (con && !this.entities.has(con)) return noSuchEntity(con);
    const at = this.now();
    return this.record.transact(() => {
      this.#append("money_check_params", { check_key: ck, name: nm, contract: con, value: v, citation: cite.slice(0, TEXT_MAX), by: str(by), at });
      return { ok: true, check: ck, name: nm, contract: con || null, value: v, citation: cite.slice(0, TEXT_MAX), by: str(by), at };
    });
  }

  /** R3: every statement of a check's parameters, for a contract and group-wide, each marked whether it governs. */
  parameters({ check, contract = null } = {}) {
    const ck = str(check), con = str(contract);
    if (!ck) return refusal("NO_CHECK");
    if (!CHECK_PARAMETERS[ck]) return refusal("UNKNOWN_CHECK", { check_key: ck, checks: Object.keys(CHECK_PARAMETERS) });
    const rows = this.#rows(`SELECT seq, name, contract, value, citation, by, at FROM money_check_params
                               WHERE check_key=? AND contract IN ('', ?) ORDER BY seq`, ck, con);
    const governing = new Set(Object.keys(CHECK_PARAMETERS[ck]).map((n) => this.#param(ck, n, con)?.seq).filter(Boolean));
    return { ok: true, check: ck, contract: con || null,
             statements: rows.map((r) => ({ name: r.name, contract: r.contract || null, value: r.value, citation: r.citation,
                                            by: r.by, at: r.at, governs: governing.has(r.seq) })) };
  }

  /* The governing statement: the contract's own latest, else the group-wide latest, else null (never a default). */
  #param(check, name, contract) {
    const own = contract ? this.#one(`SELECT * FROM money_check_params WHERE check_key=? AND name=? AND contract=? ORDER BY seq DESC LIMIT 1`,
                                     check, name, contract) : null;
    return own || this.#one(`SELECT * FROM money_check_params WHERE check_key=? AND name=? AND contract='' ORDER BY seq DESC LIMIT 1`,
                            check, name);
  }
  static #paramView(p) { return { name: p.name, value: p.value, citation: p.citation, by: p.by, at: p.at, scope: p.contract ? "contract" : "group" }; }

  /* ===================================================================== *
   * R1, R2: AMOUNT CHECKS, derived on read, never stored
   * ===================================================================== */

  /* A sum of money facts under money's summation rule (its R10): `{figure}`, `{refused}` (that refusal, answered as
     such), or `{undetermined}`. */
  #sum(facts) {
    if (!facts.length) return { figure: { value: "0", sign: "+", precision: "exact" }, empty: true };
    const ids = facts.map((f) => f.fact_id);
    let s;
    try { s = this.money.summable({ factIds: ids }); } catch (e) { return { undetermined: true, why: localize("money-checks.index.money_could_not_answer_message", "money could not answer: {message}", { message: String(e.message) }) }; }
    if (!s || s.ok === false) return { refused: s || { reason: "UNANSWERED" } };
    let acc = null;
    for (const f of facts) {
      acc = acc === null ? factFigure(f) : add(acc, factFigure(f));
      if (acc && acc.refused) return { refused: { reason: acc.refused, why: acc.why } };
    }
    return { figure: acc };
  }
  static #sumView(s) { return s.figure ? s.figure : s.refused ? { refused: s.refused } : { undetermined: true, why: s.why }; }

  /* One check's answer (R1's shape): `holds` true, false or "undetermined", why, and the derivation with what it read.
     A sum money refuses is answered as that refusal, never as a check (R2). */
  static #answer(check, { holds, why, sums = {}, read, parameters = [], refused = null }) {
    const base = { check, label: NOTICED, mark: HINT_MARK, kind: "question",
                   derivation: { method: "calc-grammar exact decimals over money's facts", sums, parameters }, read };
    if (refused) return { ...base, refused, holds: "undetermined", why: word("money-checks.why.sum_summation_rule") };
    return { ...base, holds, why };
  }
  static #fromRelation(rel, ifHigher, ifNot, isQuestion = (r) => r === "higher") {
    if (rel && rel.refused) return { holds: "undetermined", why: rel.why };
    if (rel && rel.undetermined) return { holds: "undetermined", why: rel.why };
    return isQuestion(rel) ? { holds: true, why: ifHigher } : { holds: false, why: ifNot };
  }

  /* R2, R1 (b): change orders summing above a stated share of the award. */
  #changeOrderCheck(check, award, orders, contract) {
    const p = this.#param("change_orders_past_share", "share", contract);
    const read = { facts: [...award, ...orders].map((f) => f.fact_id) };
    if (!p) return MoneyChecks.#answer(check, { holds: "undetermined", why: word("money-checks.why.threshold_stated"), read });
    const parameters = [MoneyChecks.#paramView(p)];
    const a = this.#sum(award), c = this.#sum(orders);
    const sums = { award: MoneyChecks.#sumView(a), change_orders: MoneyChecks.#sumView(c) };
    if (a.refused || c.refused) return MoneyChecks.#answer(check, { refused: a.refused || c.refused, sums, read, parameters });
    if (a.undetermined || c.undetermined) return MoneyChecks.#answer(check, { holds: "undetermined", why: (a.why || c.why), sums, read, parameters });
    if (a.empty) return MoneyChecks.#answer(check, { holds: "undetermined", why: word("money-checks.why.award_amount_held"), sums, read, parameters });
    const limit = multiply(a.figure, shareFigure(p.value));
    sums.share_of_award = limit;
    const r = MoneyChecks.#fromRelation(relation(c.figure, limit), word("money-checks.change_orders_sum"),
                                        word("money-checks.change_orders_sum_above"));
    return MoneyChecks.#answer(check, { ...r, sums, read, parameters });
  }

  /* A signed amount differing from its award's (R1 (a), R2). */
  static #differs(check, award, signed, read, extra = {}) {
    if (!award.length) return MoneyChecks.#answer(check, { holds: "undetermined", why: word("money-checks.why.award_amount_held"), read, ...extra });
    if (!signed.length) return MoneyChecks.#answer(check, { holds: "undetermined", why: word("money-checks.why.signed_amount_held"), read, ...extra });
    return { award, signed };
  }
  #differsCheck(check, award, signed, read, extra = {}) {
    const early = MoneyChecks.#differs(check, award, signed, read, extra);
    if (early.check) return early;
    const a = this.#sum(award), s = this.#sum(signed);
    const sums = { award: MoneyChecks.#sumView(a), signed: MoneyChecks.#sumView(s) };
    if (a.refused || s.refused) return MoneyChecks.#answer(check, { refused: a.refused || s.refused, sums, read, ...extra });
    if (a.undetermined || s.undetermined) return MoneyChecks.#answer(check, { holds: "undetermined", why: a.why || s.why, sums, read, ...extra });
    const r = MoneyChecks.#fromRelation(relation(s.figure, a.figure), word("money-checks.signed_amount_differs"),
                                        word("money-checks.signed_amount_equals"), (x) => x === "higher" || x === "lower");
    return MoneyChecks.#answer(check, { ...r, sums, read, ...extra });
  }

  /* money R14's answer: the committed facts, split into those at an award (concerning one of `committed.awards`) and
     the change orders amending one; the paid facts. Events not wired there leaves the committed side undetermined. */
  #committed(contract, viewer) {
    const r = this.money.committedAgainstPaid({ contract, viewer });
    if (!r || r.ok === false) return { refused: r || { reason: "UNANSWERED" } };
    const c = r.committed || {};
    const paid = Array.isArray(r.paid?.facts) ? r.paid.facts : [];
    if (c.undetermined) return { award: [], orders: [], paid, undetermined: c.why || word("money-checks.committed_side_undetermined") };
    const awards = new Set(Array.isArray(c.awards) ? c.awards : []);
    const facts = Array.isArray(c.facts) ? c.facts : [];
    const atAward = (f) => (f.concerns || []).some((x) => awards.has(x));
    return { award: facts.filter(atAward), orders: facts.filter((f) => !atAward(f)), paid };
  }
  #factsOf(entity, viewer, phases = null) {
    const r = this.money.moneyOf({ entity, viewer, limit: NOTICED_MAX, ...(phases ? { phases } : {}) });
    return r && r.ok !== false && Array.isArray(r.facts) ? r.facts.filter((f) => !f.withdrawn) : [];
  }

  /** R2, R3: the amount checks over one contract, each a question with the facts read and both sums. */
  amountChecks({ contract, viewer = null } = {}) {
    const con = str(contract);
    if (!con) return refusal("NO_CONTRACT");
    const cap = this.#committed(con, viewer);
    if (cap.refused) return cap.refused;
    const checks = [];
    /* paid above committed */
    {
      const committed = [...cap.award, ...cap.orders];
      const read = { facts: [...committed, ...cap.paid].map((f) => f.fact_id) };
      const c = this.#sum(committed), p = this.#sum(cap.paid);
      const sums = { committed: MoneyChecks.#sumView(c), paid: MoneyChecks.#sumView(p) };
      if (cap.undetermined) checks.push(MoneyChecks.#answer("paid_above_committed", { holds: "undetermined", why: cap.undetermined, sums, read }));
      else if (c.refused || p.refused) checks.push(MoneyChecks.#answer("paid_above_committed", { refused: c.refused || p.refused, sums, read }));
      else if (c.undetermined || p.undetermined) checks.push(MoneyChecks.#answer("paid_above_committed", { holds: "undetermined", why: c.why || p.why, sums, read }));
      else if (c.empty) checks.push(MoneyChecks.#answer("paid_above_committed", { holds: "undetermined", why: word("money-checks.why.committed_amount_held"), sums, read }));
      else checks.push(MoneyChecks.#answer("paid_above_committed", { ...MoneyChecks.#fromRelation(relation(p.figure, c.figure),
        word("money-checks.paid_amounts_sum"), word("money-checks.paid_amounts_sum_above")), sums, read }));
    }
    /* a signed amount differing from its award's: the award as the body adopted it against the commitment signed */
    {
      const adopted = this.#factsOf(con, viewer, ["adopted"]);
      checks.push(this.#differsCheck("signed_differs_from_award", adopted, cap.award,
                                     { facts: [...adopted, ...cap.award].map((f) => f.fact_id) }));
    }
    checks.push(cap.undetermined
      ? MoneyChecks.#answer("change_orders_past_share", { holds: "undetermined", why: cap.undetermined, read: { facts: [] } })
      : this.#changeOrderCheck("change_orders_past_share", cap.award, cap.orders, con));
    return { ok: true, contract: con, label: NOTICED, mark: HINT_MARK, checks };
  }

  /** R1: the amount part of a progression instance's junction checks (progressions R32, moved), derived on read and
   *  never stored; shown at once, since a member declared the flow (K1505 (8)). */
  junctionCheck({ progressionKey, entityId, viewer = null } = {}) {
    const inst = this.progressions.readInstance({ progressionKey, entityId, viewer });
    if (!inst || inst.ok === false) return inst;
    const key = str(progressionKey), eid = str(entityId);
    if (!inst.found) return { ok: true, found: false, defined: inst.defined !== false, progression_key: key, entity_id: eid, checks: [] };
    const seen = this.#bundleSeen(viewer);
    const placements = this.#rows(`SELECT stage_key, capture_sha, bundle_id FROM progression_instances
                                     WHERE progression_key=? AND entity_id=? ORDER BY stage_key, capture_sha`, key, eid)
      .filter((p) => seen(p.bundle_id));
    const checks = [];
    /* (a) the signed amount against the award: each side's facts are those sourced from a document placed at its stage */
    {
      const as = this.#param("junction_stages", "award_stage", eid), ss = this.#param("junction_stages", "signed_stage", eid);
      if (!as || !ss) checks.push(MoneyChecks.#answer("junction_signed_differs_from_award",
        { holds: "undetermined", why: word("money-checks.why.award_signed_stage"), read: { facts: [], stages: [] } }));
      else {
        const shas = (stage) => new Set(placements.filter((p) => p.stage_key === stage).map((p) => p.capture_sha));
        const awardShas = shas(as.value), signedShas = shas(ss.value);
        const facts = this.#factsOf(eid, viewer).map((f) => ({ f, sha: this.#captureOf(f) }));
        const award = facts.filter((x) => awardShas.has(x.sha)).map((x) => x.f);
        const signed = facts.filter((x) => signedShas.has(x.sha)).map((x) => x.f);
        const read = { facts: [...award, ...signed].map((f) => f.fact_id),
                       stages: placements.filter((p) => p.stage_key === as.value || p.stage_key === ss.value)
                         .map((p) => ({ stage_key: p.stage_key, capture_sha: p.capture_sha })) };
        checks.push(this.#differsCheck("junction_signed_differs_from_award", award, signed, read,
                                       { parameters: [MoneyChecks.#paramView(as), MoneyChecks.#paramView(ss)] }));
      }
    }
    /* (b) amendments past a stated share of the award: the contract's change orders (money R14) */
    {
      const cap = this.#committed(eid, viewer);
      if (cap.refused) checks.push(MoneyChecks.#answer("junction_amendments_past_share", { refused: cap.refused, read: { facts: [] } }));
      else if (cap.undetermined) checks.push(MoneyChecks.#answer("junction_amendments_past_share", { holds: "undetermined", why: cap.undetermined, read: { facts: [] } }));
      else checks.push(this.#changeOrderCheck("junction_amendments_past_share", cap.award, cap.orders, eid));
    }
    return { ok: true, found: true, progression_key: key, entity_id: eid, label: NOTICED, mark: HINT_MARK, shown: true, checks };
  }

  /* The capture a fact's source extent is in: money R19's `source_capture_sha` (K1563 (4)), or null. */
  #captureOf(fact) {
    const own = fact && (fact.source_capture_sha || (fact.source && fact.source.capture_sha));
    if (own) return own;
    const r = this.#one(`SELECT source_capture_sha FROM money_facts WHERE fact_id=?`, fact.fact_id);
    return r ? r.source_capture_sha || null : null;
  }

  /* ===================================================================== *
   * R4, R5: DETECTORS, as data, versioned; switched per project
   * ===================================================================== */

  /* R4: a population is `{per, kinds?, phases?, stages?, bases?, currencies?}`; the refusal's why, or null. */
  static #populationFault(p) {
    for (const k of Object.keys(p)) if (k !== "per" && !POPULATION_FILTERS[k]) return `"${k}" is not a population field`;
    if (!PER.includes(p.per)) return `per is one of ${PER.join(", ")}`;
    for (const k of Object.keys(POPULATION_FILTERS))
      if (p[k] !== undefined && !(Array.isArray(p[k]) && p[k].length && p[k].every((x) => typeof x === "string" && x.trim())))
        return `${k} is a list of one or more values`;
    return null;
  }
  /* R4: the condition is a closed recipe over `facts`, `population` and the stated parameters, answering a compare
     whose first operand is a ratio or share (its numerator and denominator are the result's). */
  static #recipeFault(recipe, paramNames) {
    const checked = checkRecipe(recipe);
    if (!checked.ok) return { errors: checked.errors, why: checked.errors[0].why };
    for (const inp of recipe.inputs) {
      if (DETECTOR_INPUTS[inp.name]) { if (inp.kind !== "table") return { why: word("money-checks.why.table_input", { name: String(inp.name) }) }; continue; }
      if (!paramNames.has(inp.name)) return { why: word("money-checks.why.facts_population_stated", { name: String(inp.name) }) };
      if (inp.kind !== "figure") return { why: word("money-checks.why.parameter_figure_input", { name: String(inp.name) }) };
    }
    const out = recipe.steps.find((s) => s.as === recipe.output);
    if (out.op !== "compare") return { why: word("money-checks.why.output_compare_step") };
    const a = recipe.steps.find((s) => s.as === out.a);
    if (!a || (a.op !== "ratio" && a.op !== "share")) return { why: word("money-checks.why.compare_ratio_share") };
    return null;
  }
  /* R3: parameters `[{name, value, citation}]`; `value` and `citation` both null for one not yet stated (a shipped
     detector raises nothing until a member states it). */
  static #parametersFault(params, shipped) {
    if (params === undefined) return { list: [] };
    if (!Array.isArray(params)) return { code: "BAD_VALUE", why: "parameters is a list of {name, value, citation}" };
    const names = new Set(), list = [];
    for (const p of params) {
      if (!plain(p) || typeof p.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(p.name) || names.has(p.name) || DETECTOR_INPUTS[p.name])
        return { code: "BAD_VALUE", why: "each parameter is {name, value, citation}, its name unique" };
      names.add(p.name);
      if (p.value === null && shipped) { list.push({ name: p.name, value: null, citation: null }); continue; }
      const f = parseFigure(typeof p.value === "number" ? String(p.value) : str(p.value));
      if (!f || f.refused) return { code: "BAD_VALUE", why: word("money-checks.why.parameter_figure", { name: String(p.name) }) };
      if (!str(p.citation)) return { code: "MONEY_CHECK_NO_CITATION", why: p.name };
      list.push({ name: p.name, value: str(String(p.value)), citation: str(p.citation).slice(0, TEXT_MAX) });
    }
    return { list };
  }

  /** R4, R12: defines a detector, or (with `detectorId`) a new version of one; earlier versions are kept. */
  defineDetector({ detectorId = null, label, population, condition, parameters, denominator, derivation, by } = {}) {
    return this.#define({ detectorId, label, population, condition, parameters, denominator, derivation, by }, false);
  }

  #define({ detectorId, label, population, condition, parameters, denominator, derivation, by }, shipped) {
    if (!shipped && !MoneyChecks.#memberOf(by)) return refusal("MEMBER_ACT_ONLY", { by: by ?? null });
    const lab = str(label);
    if (!lab) return refusal("NO_LABEL");
    if (!plain(population)) return refusal("NO_POPULATION");
    const pf = MoneyChecks.#populationFault(population);
    if (pf) return refusal("BAD_POPULATION", { why: pf });
    const pl = MoneyChecks.#parametersFault(parameters, shipped);
    if (pl.code) return refusal(pl.code, { why: pl.why });
    const rf = MoneyChecks.#recipeFault(condition, new Set(pl.list.map((p) => p.name)));
    if (rf) return refusal("BAD_RECIPE", { why: rf.why, ...(rf.errors ? { errors: rf.errors } : {}) });
    if (!str(denominator)) return refusal("NO_DENOMINATOR");
    if (!str(derivation)) return refusal("NO_DERIVATION");
    const named = strings([population, condition, pl.list]);
    if (named.some(isHypothesisId) || [lab, str(denominator), str(derivation)].some(isHypothesisId))
      return refusal("HYPOTHESIS_NOT_INPUT");
    const person = named.find((s) => ENT_RE.test(s) && this.#kindOf(s) === "person");
    if (person) return refusal("SUBJECT_IS_PERSON", { entity: person });
    const id = str(detectorId);
    const held = id ? this.#one(`SELECT detector_id, origin FROM money_detectors WHERE detector_id=?`, id) : null;
    if (id && !held && !shipped) return refusal("NO_SUCH_DETECTOR", { detector_id: id });
    const at = this.now(), who = str(by);
    return this.record.transact(() => {
      const did = id || `md-${(this.#one(`SELECT count(*) AS n FROM money_detectors`).n + 1)}-${sha256HexSync(json({ lab, at, who })).slice(0, 8)}`;
      if (!held) this.#append("money_detectors", { detector_id: did, origin: shipped ? "shipped" : "member", by: who, at });
      const version = (this.#one(`SELECT max(version) AS v FROM money_detector_versions WHERE detector_id=?`, did).v || 0) + 1;
      this.#append("money_detector_versions", { detector_id: did, version, label: lab.slice(0, LABEL_MAX), population: json(population),
        condition: json(condition), parameters: json(pl.list), denominator: str(denominator).slice(0, TEXT_MAX),
        derivation: str(derivation).slice(0, TEXT_MAX), by: who, at });
      return { ok: true, detector_id: did, version, origin: held ? held.origin : shipped ? "shipped" : "member", by: who, at };
    });
  }

  /** R5: switches a detector on or off for one project: a member's act; the latest act governs, every one is kept. */
  switchDetector({ detectorId, project, on, by } = {}) {
    const member = MoneyChecks.#memberOf(by);
    if (!member) return refusal("MEMBER_ACT_ONLY", { by: by ?? null });
    const did = str(detectorId), pid = str(project);
    if (!did || !this.#one(`SELECT 1 AS x FROM money_detectors WHERE detector_id=?`, did)) return refusal("NO_SUCH_DETECTOR", { detector_id: did || null });
    if (!pid) return refusal("NO_PROJECT");
    /* R5 (K2467): sight before position (membership R61). Existence-only sight answers C-70.1 through membership's one
       site (its R77); an act on a project held only by its participants, so an administrator's sight, which is never a
       position (its R60), is refused NOT_A_PARTICIPANT (its R87). */
    const viewer = MoneyChecks.#viewerOf(member);
    const existence = this.membership.existenceAct(pid, viewer);
    if (existence) return existence;
    if (!this.#projectSeen(pid, viewer)) return noSuchProject(pid);
    if (!this.membership.participation(pid, member)) return notAParticipant(pid, str(by));
    if (on !== true && on !== false) return refusal("NO_SWITCH");
    const at = this.now();
    const was = this.#switchedOn(did, pid);
    const done = this.record.transact(() => {
      this.#append("money_detector_switches", { detector_id: did, project_id: pid, on_: on ? 1 : 0, by: str(by), at });
      return { ok: true, detector_id: did, project: pid, on, by: str(by), at };
    });
    /* R16: after the act's transaction, and only when it turned the detector on where it was off. */
    if (done && done.ok && on && !was) this.#tell({ detector_id: did, project: pid });
    return done;
  }
  /* R5, R6 (N607): on only when the latest act for the project switched it on; with no act, off. */
  #switchedOn(did, pid) {
    const r = this.#one(`SELECT on_ FROM money_detector_switches WHERE detector_id=? AND project_id=? ORDER BY seq DESC LIMIT 1`, did, pid);
    return !!r && r.on_ === 1;
  }
  /* R6 (N607): the detectors switched on for at least one project, each by its latest act there. */
  #switchedAnywhere() {
    return new Set(this.#rows(`SELECT s.detector_id FROM money_detector_switches s
                                 WHERE s.on_ = 1 AND s.seq = (SELECT max(seq) FROM money_detector_switches x
                                                              WHERE x.detector_id = s.detector_id AND x.project_id = s.project_id)`)
      .map((r) => r.detector_id));
  }

  /** R16 (N605, K1666): one listener per module, told `{detector_id, project}` after a detector is switched on for a
   *  project where it was off, so `scheduler` arms its `money-detectors` wake at once. A malformed or second
   *  registration is refused through `membership.listenerRefusal` (its R81). */
  onDetectorSwitchedOn(module, fn) {
    const refused = listenerRefusal(this.listeners, module, fn);
    if (refused) return refused;
    this.listeners.push({ module, fn });
    return { ok: true, module };
  }
  /* R16: each listener once; one that throws never undoes the act, nor stops the others. */
  #tell(notice) {
    for (const l of this.listeners) { try { l.fn({ ...notice }); } catch { /* the act stands (R16) */ } }
  }
  #gate(did, version) {
    return this.#one(`SELECT gold_set, false_alarm_rate, by, at FROM money_detector_gates WHERE detector_id=? AND version=?
                        ORDER BY seq DESC LIMIT 1`, did, version);
  }
  static #gateOpen(g) {
    if (!g) return false;
    const r = relation({ value: g.false_alarm_rate, sign: "+", precision: "exact" }, { value: GATE_MAX, sign: "+", precision: "exact" });
    return r === "lower" || r === "equal";
  }
  #current() {
    return this.#rows(`SELECT v.* , d.origin FROM money_detector_versions v JOIN money_detectors d ON d.detector_id=v.detector_id
                         WHERE v.version = (SELECT max(version) FROM money_detector_versions x WHERE x.detector_id=v.detector_id)
                         ORDER BY v.detector_id`);
  }
  /* R6 (N607): the current versions a run works over: those of detectors switched on for at least one project. */
  #live() {
    const on = this.#switchedAnywhere();
    return this.#current().filter((v) => on.has(v.detector_id));
  }
  /** R11 (N618): may `by` run the detectors through the op: the machine (`class:daemon`) or an administrator. */
  mayRun(by) {
    const b = str(by);
    if (b === DETECTORS_RUNNER) return true;
    const member = MoneyChecks.#memberOf(b);
    return !!member && !!this.membership.isAdministrator(member);
  }
  static #versionView(v) {
    return { version: v.version, label: v.label, population: parse(v.population), condition: parse(v.condition),
             parameters: parse(v.parameters), denominator: v.denominator, derivation: v.derivation, by: v.by, at: v.at };
  }

  /** R5: every detector with its versions, origin, gate per version and switch per project the viewer may see. */
  detectors({ viewer = null } = {}) {
    const out = [];
    for (const d of this.#rows(`SELECT * FROM money_detectors ORDER BY detector_id`)) {
      const versions = this.#rows(`SELECT * FROM money_detector_versions WHERE detector_id=? ORDER BY version`, d.detector_id)
        .map((v) => {
          const gates = this.#rows(`SELECT gold_set, false_alarm_rate, by, at FROM money_detector_gates WHERE detector_id=? AND version=? ORDER BY seq`,
                                   d.detector_id, v.version);
          const g = gates.length ? gates[gates.length - 1] : null;
          return { ...MoneyChecks.#versionView(v), gate: g ? { ...g, shown: MoneyChecks.#gateOpen(g) } : null, gates };
        });
      const projects = this.#rows(`SELECT DISTINCT project_id FROM money_detector_switches WHERE detector_id=? ORDER BY project_id`, d.detector_id)
        .map((r) => r.project_id).filter((p) => this.#projectSeen(p, viewer));
      out.push({ detector_id: d.detector_id, origin: d.origin, by: d.by, at: d.at, versions,
                 switches: projects.map((p) => ({ project: p, on: this.#switchedOn(d.detector_id, p) })), default_switch: "off" });
    }
    return { ok: true, detectors: out };
  }

  /* ===================================================================== *
   * R6, R7: RUNS — a computation over the facts held, in slices, results keyed so a rerun writes nothing new
   * ===================================================================== */

  /* THE ONE READ OF money's facts (money R19's read contract, as this job reads it: J1 (3)). Withdrawn facts are never
     counted (money R7). */
  #populationFacts(population) {
    const where = ["f.fact_id NOT IN (SELECT fact_id FROM money_withdrawals)"], args = [];
    for (const [k, col] of Object.entries(POPULATION_FILTERS))
      if (population[k]) { where.push(`f.${col} IN (${population[k].map(() => "?").join(",")})`); args.push(...population[k]); }
    return this.#rows(`SELECT f.fact_id, f.amount, f.amount_low, f.amount_high, f.sign, f.precision, f.currency, f.kind, f.phase, f.stage, f.basis,
                              f.period_from, f.period_to, f.from_entity, f.from_fund, f.to_entity, f.to_fund
                         FROM money_facts f WHERE ${where.join(" AND ")} ORDER BY f.fact_id`, ...args);
  }
  #concernsOf(ids) {
    const out = new Map();
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90);
      for (const r of this.#rows(`SELECT fact_id, concerns FROM money_concerns WHERE fact_id IN (${chunk.map(() => "?").join(",")})`, ...chunk))
        (out.get(r.fact_id) || out.set(r.fact_id, []).get(r.fact_id)).push(r.concerns);
    }
    return out;
  }
  static #row(f) {
    const fig = factFigure(f);
    return { fact_id: f.fact_id, amount: { ...fig, currency: undefined }, currency: f.currency ?? "", kind: f.kind ?? "",
             phase: f.phase ?? "", stage: f.stage ?? "", basis: f.basis ?? "", period: `${f.period_from ?? ""}/${f.period_to ?? ""}`,
             from_entity: f.from_entity ?? "", to_entity: f.to_entity ?? "" };
  }

  /* R4, R10: the subjects of one detector version, in key order: `[{key, subject, facts}]`, and how many party groups
     were left out because the party is a person (never a subject). */
  #subjects(v) {
    const population = parse(v.population);
    const facts = this.#populationFacts(population);
    const groups = new Map();
    const put = (key, subject, f) => (groups.get(key) || groups.set(key, { key, subject, facts: [] }).get(key)).facts.push(f);
    let persons = 0;
    const kinds = new Map();
    const kind = (id) => (kinds.has(id) ? kinds.get(id) : (kinds.set(id, this.#kindOf(id)), kinds.get(id)));
    if (population.per === "fact") for (const f of facts) put(`fact:${f.fact_id}`, { kind: "fact", fact_id: f.fact_id }, f);
    else if (population.per === "contract") {
      const concerns = this.#concernsOf(facts.map((f) => f.fact_id));
      for (const f of facts) for (const c of concerns.get(f.fact_id) || []) if (kind(c) === "contract") put(`contract:${c}`, { kind: "contract", contract: c }, f);
    } else {
      const col = population.per === "payee" ? "to_entity" : "from_entity";
      const seenPersons = new Set();
      for (const f of facts) {
        const party = f[col];
        if (!party) continue;
        if (kind(party) === "person") { seenPersons.add(party); continue; }
        put(`pattern:${population.per}:${party}`, { kind: "pattern", over: `facts by ${population.per}`, party }, f);
      }
      persons = seenPersons.size;
    }
    return { subjects: [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)), facts, persons };
  }

  /* R6, R7: one subject's result row, or null when the condition does not raise one (or cannot be evaluated, or has
     no denominator). Pure over its arguments: the same detector version and facts give the same row (R13). */
  static #evaluateSubject(v, s, populationFacts) {
    const params = parse(v.parameters) || [];
    if (params.some((p) => p.value === null)) return { none: word("money-checks.why.threshold_stated") };
    const recipe = parse(v.condition);
    const names = new Set(recipe.inputs.map((i) => i.name));
    const table = (fs) => ({ fields: FACT_FIELDS.map((f) => ({ ...f })), rows: fs.map(MoneyChecks.#row) });
    const bound = {};
    if (names.has("facts")) bound.facts = table(s.facts);
    if (names.has("population")) bound.population = table(populationFacts);
    for (const p of params) bound[p.name] = parseFigure(p.value);
    const r = evaluate(recipe, bound);
    if (r.refused) return { none: word("money-checks.condition_refused", { refused: String(r.refused) }) };
    if (!r.result || r.result.relation !== "higher") return { none: r.result ? r.result.relation : "undetermined" };
    const out = recipe.steps.find((st) => st.as === recipe.output);
    const ratio = r.trace.find((t) => t.step === out.a)?.output;
    if (!ratio || !ratio.denominator || ratio.denominator.undetermined || isZero(ratio.denominator.value))
      return { none: localize("money-checks.why.no_denominator", "no denominator") };
    const inputs = [...new Set([...s.facts, ...(names.has("population") ? populationFacts : [])].map((f) => f.fact_id))].sort();
    const subject = json(s.subject);
    const key = sha256HexSync(json({ detector_id: v.detector_id, version: v.version, subject: s.subject, inputs }));
    return { row: { result_key: key, result_id: `mdr-${key.slice(0, 16)}`, detector_id: v.detector_id, version: v.version,
                    subject_key: s.key, subject, numerator: json(ratio.numerator), denominator: json(ratio.denominator),
                    derivation: json({ method: "bio-calc/1", stated: v.derivation, denominator_is: v.denominator, parameters: params,
                                       compare: r.result, trace: r.trace.map((t) => ({ step: t.step, op: t.op, output: t.output })) }),
                    inputs: json(inputs.map((id) => ({ fact_id: id, held_by: "money" }))) } };
  }

  /** R6: runs the current version of each detector switched on for at least one project over the facts held, within
   *  `budgetMs` (its stated default without one), from `cursor`. Each subject's result is written keyed by (detector,
   *  version, subject, inputs), so an unchanged rerun writes nothing; a subject that no longer raises, a superseded
   *  version, and a detector switched on nowhere (N607: run over nothing) lose their rows (a derived cache, R13). */
  runDetectors({ budgetMs, cursor = null } = {}) {
    const given = budgetMs !== undefined && budgetMs !== null;
    if (given && !(typeof budgetMs === "number" && Number.isFinite(budgetMs) && budgetMs > 0)) return refusal("NO_BUDGET", { budget_ms: budgetMs });
    const budget = given ? budgetMs : DETECTORS_DEFAULT_BUDGET_MS;
    const start = this.nowMs();
    const from = cursor ? parse(cursor) : null;
    const stats = { written: 0, unchanged: 0, raised: 0, skipped: {}, persons_skipped: 0, detectors: 0, budget_ms: budget };
    const current = this.#live();
    const live = new Set(current.map((v) => `${v.detector_id}#${v.version}`));
    this.record.transact(() => {
      for (const r of this.#rows(`SELECT result_key, detector_id, version FROM money_detector_results`))
        if (!live.has(`${r.detector_id}#${r.version}`)) this.#drop(r.result_key);
    });
    for (const v of current) {
      if (from && v.detector_id < from.d) continue;
      stats.detectors++;
      const { subjects, facts, persons } = this.#subjects(v);
      stats.persons_skipped += persons;
      const keys = new Set(subjects.map((s) => s.key));
      for (const s of subjects) {
        if (from && v.detector_id === from.d && s.key <= from.s) continue;
        const e = MoneyChecks.#evaluateSubject(v, s, facts);
        this.record.transact(() => {
          const others = this.#rows(`SELECT result_key FROM money_detector_results WHERE detector_id=? AND subject_key=?`, v.detector_id, s.key);
          for (const o of others) if (!e.row || o.result_key !== e.row.result_key) this.#drop(o.result_key);
          if (e.row) {
            stats.raised++;
            if (others.some((o) => o.result_key === e.row.result_key)) stats.unchanged++;
            else { this.#append("money_detector_results", e.row); this.#append("money_detector_result_times", { result_key: e.row.result_key, at: this.now() }); stats.written++; }
          } else stats.skipped[e.none] = (stats.skipped[e.none] || 0) + 1;
        });
        if (this.nowMs() - start >= budget) return { ok: true, ...stats, remaining: true, cursor: json({ d: v.detector_id, s: s.key }) };
      }
      /* a subject that vanished (its facts withdrawn) keeps no result */
      this.record.transact(() => {
        for (const r of this.#rows(`SELECT result_key, subject_key FROM money_detector_results WHERE detector_id=?`, v.detector_id))
          if (!keys.has(r.subject_key)) this.#drop(r.result_key);
      });
    }
    return { ok: true, ...stats, remaining: false, cursor: null };
  }
  #drop(key) {
    this.sql.exec(`DELETE FROM money_detector_results WHERE result_key=?`, key);
    this.sql.exec(`DELETE FROM money_detector_result_times WHERE result_key=?`, key);
  }

  /** R13 (record-core R77): the results table rebuilt from the detectors and the facts, as rows; writes nothing. */
  rebuild(scope = null) {
    const rows = [];
    for (const v of this.#live()) {
      if (scope && scope.detector_id && scope.detector_id !== v.detector_id) continue;
      const { subjects, facts } = this.#subjects(v);
      for (const s of subjects) { const e = MoneyChecks.#evaluateSubject(v, s, facts); if (e.row) rows.push(e.row); }
    }
    return rows;
  }

  /* ===================================================================== *
   * R8, R9: GATES AND WHAT IS SHOWN
   * ===================================================================== */

  /** R8: records a detector version's measured false-alarm rate on a named gold set: an administrator's act. */
  recordGate({ detectorId, version, goldSet, falseAlarmRate, by } = {}) {
    const member = MoneyChecks.#memberOf(by);
    if (!member || !this.membership.isAdministrator(member)) return notAnAdmin(by ?? null, "recording a detector's false-alarm rate");
    const did = str(detectorId), ver = Number(version);
    if (!did || !Number.isSafeInteger(ver) || !this.#one(`SELECT 1 AS x FROM money_detector_versions WHERE detector_id=? AND version=?`, did, ver))
      return refusal("NO_SUCH_DETECTOR", { detector_id: did || null, version: version ?? null });
    const gold = str(goldSet);
    if (!gold) return refusal("NO_GOLD_SET");
    const rate = typeof falseAlarmRate === "number" ? String(falseAlarmRate) : str(falseAlarmRate);
    const f = /^\d+(\.\d+)?$/.test(rate) ? { value: rate, sign: "+", precision: "exact" } : null;
    if (!f || relation(f, { value: "1", sign: "+", precision: "exact" }) === "higher") return refusal("BAD_RATE", { rate: falseAlarmRate ?? null });
    const at = this.now();
    return this.record.transact(() => {
      this.#append("money_detector_gates", { detector_id: did, version: ver, gold_set: gold.slice(0, LABEL_MAX), false_alarm_rate: rate, by: str(by), at });
      return { ok: true, detector_id: did, version: ver, gold_set: gold.slice(0, LABEL_MAX), false_alarm_rate: rate,
               shown: MoneyChecks.#gateOpen({ false_alarm_rate: rate }), by: str(by), at };
    });
  }

  /** R9, R10, R13: what the machine noticed for a project: only results of detector versions gated at or under 20% and
   *  switched on for it, whose every input the viewer may see; everything else withheld and not counted. */
  noticed({ project, viewer = null, limit = null } = {}) {
    const pid = str(project);
    if (!pid) return refusal("NO_PROJECT");
    const lim = limit === null || limit === undefined || limit === "" ? NOTICED_DEFAULT : Number(limit);
    if (!Number.isSafeInteger(lim) || lim < 1 || lim > NOTICED_MAX) return refusal("BAD_LIMIT", { limit });
    /* R13 (K2467): a project seen at existence only answers C-70.1 through membership (its R77), never as absent. */
    const existence = this.membership.existenceAct(pid, viewer);
    if (existence) return existence;
    if (!this.#projectSeen(pid, viewer)) return noSuchProject(pid);
    const sees = this.#factSeer(viewer);
    const items = [];
    let truncated = false;
    for (const v of this.#current()) {
      const g = this.#gate(v.detector_id, v.version);
      if (!MoneyChecks.#gateOpen(g) || !this.#switchedOn(v.detector_id, pid)) continue;
      const rows = this.#rows(`SELECT r.*, t.at FROM money_detector_results r LEFT JOIN money_detector_result_times t ON t.result_key=r.result_key
                                 WHERE r.detector_id=? AND r.version=? ORDER BY r.subject_key, r.result_id`, v.detector_id, v.version);
      for (const r of rows) {
        const inputs = parse(r.inputs) || [];
        if (!inputs.length || !inputs.every((i) => sees(i.fact_id))) continue;
        if (items.length >= lim) { truncated = true; break; }
        items.push({ result_id: r.result_id, detector_id: r.detector_id, version: r.version, label: NOTICED, mark: HINT_MARK, by: "the machine",
                     kind: "signal", layer: "hypothesis", detector_label: v.label, subject: parse(r.subject),
                     numerator: parse(r.numerator), denominator: parse(r.denominator), derivation: parse(r.derivation),
                     inputs, at: r.at, gate: { gold_set: g.gold_set, false_alarm_rate: g.false_alarm_rate } });
      }
      if (truncated) break;
    }
    return { ok: true, project: pid, label: NOTICED, mark: HINT_MARK, items, truncated };
  }

  /* R4: the shipped detectors, installed once as data, each version-kept like a member's. */
  installShipped() {
    for (const d of SHIPPED)
      if (!this.#one(`SELECT 1 AS x FROM money_detectors WHERE detector_id=?`, d.detectorId))
        this.#define({ ...d, by: "class:shipped" }, true);
  }
}

/** R4: the detectors that ship as data. Each states no threshold, so it raises nothing until a member defines a new
 *  version stating one with its citation (R3); none has a recorded gate, so nothing it raises is shown (plan T33 Rule 7).
 *  The list and its gold sets are owed by M-C8 (job record). */
export const SHIPPED = Object.freeze([Object.freeze({
  detectorId: "md-shipped-payee-share",
  label: word("money-checks.label.payee_share_paid"),
  population: { per: "payee", kinds: ["payment", "expenditure"], phases: ["actual"], stages: ["paid"] },
  condition: { method: "bio-calc/1", inputs: [{ name: "facts", kind: "table" }, { name: "population", kind: "table" }, { name: "share", kind: "figure" }],
               steps: [{ op: "sum", as: "part", from: "facts", field: "amount" },
                       { op: "sum", as: "whole", from: "population", field: "amount" },
                       { op: "ratio", as: "portion", numerator: "part", denominator: "whole" },
                       { op: "compare", as: "past", a: "portion", b: "share" }],
               output: "past" },
  parameters: [{ name: "share", value: null, citation: null }],
  denominator: word("money-checks.paid_amounts_payee"),
  derivation: word("money-checks.payee_paid_amounts"),
})]);

/** R11: the ops map, one route arm per act and read; every write reaches the one append site with the control
 *  plane's stamps (`by` in the body, `viewer` in the URL, read after the body so a body cannot set it). */
export function moneyChecksOps(c, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body || {};
  return {
    moneyamountchecks: () => c.amountChecks({ contract: q("contract"), viewer: q("viewer") }),
    moneyjunction: () => c.junctionCheck({ progressionKey: q("key"), entityId: q("id"), viewer: q("viewer") }),
    moneycheckparam: () => c.stateParameter(b),
    moneycheckparams: () => c.parameters({ check: q("check"), contract: q("contract") }),
    moneydetectordefine: () => c.defineDetector(b),
    moneydetectorswitch: () => c.switchDetector(b),
    moneydetectors: () => c.detectors({ viewer: q("viewer") }),
    /* R11 (N618): the machine's or an administrator's; anyone else is refused and nothing runs. */
    moneydetectorsrun: () => (c.mayRun(b.by) ? c.runDetectors({ budgetMs: b.budgetMs, cursor: b.cursor ?? null })
                                             : notAnAdmin(b.by ?? null, "running the money detectors")),
    moneydetectorgate: () => c.recordGate(b),
    moneynoticed: () => c.noticed({ project: q("project"), viewer: q("viewer"), limit: q("limit") }),
  };
}

const instances = new WeakMap();

/** K61: the one instance per host, created on the first call with `deps`. It creates and declares its tables
 *  (record-core R21, R77) and installs the shipped detectors. */
export function moneyChecksOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    c = new MoneyChecks({ ...d, storage, record, membership,
                          entities: d.entities || entitiesOf(host, { record, membership }),
                          progressions: d.progressions || progressionsOf(host, { record }),
                          money: d.money || moneyOf(host, { record, membership }) });
    instances.set(host, c);
    c.migrate();
    const declared = record.declareTable("money-checks", moneyChecksTables((scope) => c.rebuild(scope)));
    if (declared && declared.ok === false) throw new Error(`money-checks: record-core refused its tables: ${declared.reason}`);
    c.installShipped();
  }
  return c;
}
