/* op-declarations R80, R81 (T51 fix round; K4165, K4168): THE OWNERS' DECLARATIONS, held apart from `index.mjs`. An owner
   exports `DECLARED_OPS` beside its ops map, `{op: {classes, machineClasses?, mutating, weight, description, fields?,
   stamps?, needs?}}`; the plane (and the tests, through `test-support`'s collector) hand every owner's to
   `registerDeclaredOps` once, before the first read of any table. This file shapes and checks the rows (the shape, the
   duplicates, the agreement with the hand rows) and answers the pieces `build()` merges; it reads no table of its own,
   no request, store, clock or environment (R7). `weight` and `description` are `op-grades`' and are not read here. */

import { budgetOf } from "../read-bounds.mjs";

const CLASSES = Object.freeze(["admin", "member", "probe", "daemon"]);
const STAMPS = Object.freeze(["author", "bodyBy", "by", "country", "member", "owner", "principal", "proposer", "session", "source",
  "viewer"]);
/* `why` is a code for a developer's diagnostic (BAD_CLASSES, BAD_MACHINE_CLASSES, BAD_MUTATING, BAD_STAMPS, BAD_NEEDS,
   BAD_FIELDS, BAD_ROW, NEEDS_MISSING), never a sentence a member reads */
const fail = (op, why) => new TypeError(`op-declarations: ${op}: ${why} (R80)`);
const names = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x)) && b.every((x) => a.includes(x));

/* one owner's row for one op, checked and copied: a frozen record the registry keeps, never the owner's own object */
function shape(owner, op, row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw fail(op, "BAD_ROW");
  const { classes, machineClasses, mutating, stamps, needs, fields } = row;
  if (classes !== null && !(names(classes) && classes.length > 0 && classes.every((c) => CLASSES.includes(c))))
    throw fail(op, "BAD_CLASSES");
  if (machineClasses !== undefined && !(names(machineClasses) && machineClasses.every((c) => CLASSES.includes(c))))
    throw fail(op, "BAD_MACHINE_CLASSES");
  if (typeof mutating !== "boolean") throw fail(op, "BAD_MUTATING");
  if (stamps !== undefined && !(names(stamps) && stamps.every((s) => STAMPS.includes(s))))
    throw fail(op, "BAD_STAMPS");
  const hasNeeds = Object.hasOwn(row, "needs");
  if (hasNeeds && needs !== null && !(typeof needs === "string" && needs.length > 0)) throw fail(op, "BAD_NEEDS");
  let kept;
  if (fields !== undefined) {
    if (!fields || typeof fields !== "object" || Array.isArray(fields) || !names(fields.accepts)
      || !Array.isArray(fields.requires) || !fields.requires.every((r) => (typeof r === "string" && r.length > 0) || (names(r) && r.length > 0)))
      throw fail(op, "BAD_FIELDS");
    kept = Object.freeze({ accepts: Object.freeze([...fields.accepts]),
      requires: Object.freeze(fields.requires.map((r) => (Array.isArray(r) ? Object.freeze([...r]) : r))) });
  }
  return Object.freeze({ owner, classes: classes === null ? null : Object.freeze([...classes]),
    machineClasses: machineClasses === undefined ? undefined : Object.freeze([...machineClasses]), mutating,
    stamps: stamps === undefined ? undefined : Object.freeze([...stamps]), hasNeeds, needs: hasNeeds ? needs : undefined, fields: kept });
}

/* R80: the owners' rows as `Map<op, record>`, in the order given. `input` is `{owner: {op: row}}` or `[[owner, {op: row}]]`.
   An op in two owners' rows is refused naming both (R81). */
export function declaredRows(input) {
  if (!input || typeof input !== "object") throw new TypeError("op-declarations: the owners' declarations are an object or a list of pairs (R80)");
  const out = new Map();
  for (const [owner, ops] of Array.isArray(input) ? input : Object.entries(input)) {
    if (!ops || typeof ops !== "object" || Array.isArray(ops)) throw new TypeError(`op-declarations: ${owner}: its DECLARED_OPS is an object (R80)`);
    for (const [op, row] of Object.entries(ops)) {
      if (out.has(op)) throw new TypeError(`op-declarations: ${op}: declared by two owners, ${out.get(op).owner} and ${owner} (R81)`);
      out.set(op, shape(owner, op, row));
    }
  }
  return out;
}

/* R81: where an owner's record and the hand tables disagree, `field` names it; `null` when they agree. `hand` is
   `{spec, stamps, hasNeeds, needs}` for an op the hand tables hold. */
export function disagreement(rec, hand) {
  const { spec } = hand;
  if ((rec.classes === null) !== (spec.classes === null) || (rec.classes && !sameSet(rec.classes, spec.classes))) return "classes";
  if ((rec.machineClasses === undefined) !== (spec.machineClasses === undefined)
    || (rec.machineClasses && !sameSet(rec.machineClasses, spec.machineClasses))) return "machineClasses";
  if (rec.mutating !== spec.mutating) return "mutating";
  if (rec.stamps !== undefined && !sameSet(rec.stamps, hand.stamps)) return "stamps";
  if (rec.hasNeeds && (!hand.hasNeeds || rec.needs !== hand.needs)) return "needs";
  return null;
}

/* the pieces `build()` merges for an op the hand tables do not hold (R80) */
export const specOf = (rec) => ({ classes: rec.classes ? [...rec.classes] : null,
  ...(rec.machineClasses ? { machineClasses: [...rec.machineClasses] } : {}), mutating: rec.mutating });
export const stampsOf = (rec) => (rec.stamps ? [...rec.stamps] : rec.classes === null ? [] : ["viewer"]);
/* `[has, value]`: an act's row is the owner's (required, else refused); a session read's is null; a public op has none unless given */
export function needsOf(rec) {
  if (rec.hasNeeds) return [true, rec.needs];
  return rec.classes === null ? [false, undefined] : [true, null];
}
export const isPublic = (rec) => rec.classes === null;

/* R80: a mutating op with no hand row names its capability, or is refused: it is the one row with no honest default */
export function needsRequired(rec, op) {
  if (rec.mutating && !rec.hasNeeds) throw fail(op, "NEEDS_MISSING");
}

/* ---- surface-declarations R10–R12, R16 (T53; K4354, K4599, K5438, N1264; PL2–PL4, PL10, PL11, PL15) ----
   The budget classes, the screens' read waves and `screenread`'s answer. Data in, data out: `budgetOf` is
   `runtime-limits`' frozen table (its R41, R42), and nothing here reads a clock, a request or a store (R7): a read's
   elapsed time is the caller's measure, handed in. `why` codes are a developer's diagnostic, never a member's sentence. */

const refuse = (name, why) => new TypeError(`op-declarations: ${name}: ${why} (surface-declarations)`);

/* R12: one op's or screen's budget row, a class name or `{class, ceiling_ms}` (or a row already built, `{budget_class, ceiling_ms}`), checked against `runtime-limits`' classes and
   frozen as `{budget_class, ceiling_ms}`: an unknown class is refused (BAD_BUDGET_CLASS), an override above its class's
   ceiling is refused (BUDGET_ABOVE_CLASS); with no override the ceiling is the class's. */
export function budgetRow(name, row) {
  const cls = typeof row === "string" ? row : row && typeof row === "object" ? row.class ?? row.budget_class : undefined;
  let base;
  try { base = budgetOf(cls); } catch { throw refuse(name, "BAD_BUDGET_CLASS"); }
  if (typeof row === "string" || row.ceiling_ms === undefined) return Object.freeze({ budget_class: cls, ceiling_ms: base.ceiling_ms });
  try { return Object.freeze({ budget_class: cls, ceiling_ms: budgetOf({ class: cls, ceiling_ms: row.ceiling_ms }).ceiling_ms }); }
  catch { throw refuse(name, "BUDGET_ABOVE_CLASS"); }
}
/* R12: the class an op takes when no row names one: a write the write act's, a read the read act's */
export const defaultBudgetClass = (spec) => (spec.mutating ? "write_act" : "read_act");
/* R12: the totality finding: each name of `names` that `rows` gives no class (rows checked as `budgetRow` checks them) */
export function budgetFindings(names, rows) {
  for (const [name, row] of Object.entries(rows)) budgetRow(name, row);
  return Object.freeze([...names].filter((n) => !Object.hasOwn(rows, n)));
}

/* R10: a screen's reads, a list of `{name, op, args, wave}`. Waves are whole numbers from 1 with none skipped; reads in one
   wave are independent; an argument `{from: <read name>}` takes an earlier wave's answer. Refused, naming the screen:
   a read with no name or a name twice (BAD_READ, DUPLICATE_READ), an op `isOp` does not know (UNKNOWN_OP), a write op
   (WRITE_IN_READS: a write is never batched, R11), an op that is never a first-wave read in wave 1 (NOT_FIRST_WAVE, R16),
   a bad or skipped wave (BAD_WAVE), and an argument taking the answer of a read in the same or a later wave or of no read
   (LATER_WAVE_ARG). Answers the frozen list. */
export function screenReads(screen, reads, { isOp, isWrite, notFirstWave = [] }) {
  if (!Array.isArray(reads)) throw refuse(screen, "BAD_READS");
  const waveOf = new Map();
  for (const r of reads) {
    if (!r || typeof r !== "object" || typeof r.name !== "string" || !r.name || typeof r.op !== "string") throw refuse(screen, "BAD_READ");
    if (waveOf.has(r.name)) throw refuse(screen, `${r.name}: DUPLICATE_READ`);
    if (!Number.isInteger(r.wave) || r.wave < 1) throw refuse(screen, `${r.name}: BAD_WAVE`);
    waveOf.set(r.name, r.wave);
  }
  const waves = new Set(waveOf.values());
  for (let w = 1; w <= waves.size; w++) if (!waves.has(w)) throw refuse(screen, `wave ${w}: BAD_WAVE`);
  const kept = reads.map((r) => {
    if (!isOp(r.op)) throw refuse(screen, `${r.name}: UNKNOWN_OP ${r.op}`);
    if (isWrite(r.op)) throw refuse(screen, `${r.name}: WRITE_IN_READS ${r.op}`);
    if (r.wave === 1 && notFirstWave.includes(r.op)) throw refuse(screen, `${r.name}: NOT_FIRST_WAVE ${r.op}`);
    const args = r.args ?? {};
    if (!args || typeof args !== "object" || Array.isArray(args)) throw refuse(screen, `${r.name}: BAD_READ`);
    for (const v of Object.values(args)) {
      if (v && typeof v === "object" && Object.hasOwn(v, "from") && !(waveOf.get(v.from) < r.wave))
        throw refuse(screen, `${r.name}: LATER_WAVE_ARG ${String(v.from)}`);
    }
    return Object.freeze({ name: r.name, op: r.op, args: Object.freeze({ ...args }), wave: r.wave });
  });
  return Object.freeze(kept);
}
/* R10: the hop count, derived: one for the session and one for each wave */
export const hopsOf = (reads) => 1 + new Set(reads.map((r) => r.wave)).size;

/* R11: `screenread`'s answer from each read's outcome, `outcomes[name] = {ok, status, body | refusal, ms}` (`ms` the caller's
   measure) and each read's declared bound in ms, `boundOf(op)`. A read refused answers `ok: false` with its refusal and the
   others still answer; a read past its bound, or with no outcome, is cut: `ok: false, status: "slow"` with the bound (PL15);
   `server_ms` is the sum over waves of the slowest read of each, each read counted at most its bound, so the answer never
   exceeds the sum of the reads' bounds. */
export function screenReadAnswer(reads, outcomes, boundOf, stamps = {}) {
  const out = {};
  const waveMs = new Map();
  for (const r of reads) {
    const bound = boundOf(r.op);
    const o = outcomes[r.name];
    let row;
    let ms;
    if (!o || !(Number.isFinite(o.ms) && o.ms <= bound)) { row = { ok: false, status: "slow", bound_ms: bound }; ms = bound; }
    else if (o.ok) { row = { ok: true, status: o.status ?? 200, body: o.body }; ms = o.ms; }
    else { row = { ok: false, status: o.status, refusal: o.refusal }; ms = o.ms; }
    out[r.name] = Object.freeze(row);
    waveMs.set(r.wave, Math.max(waveMs.get(r.wave) ?? 0, ms));
  }
  let server_ms = 0;
  for (const ms of waveMs.values()) server_ms += ms;
  return Object.freeze({ reads: Object.freeze(out), stamps: Object.freeze({ ...stamps }), server_ms });
}
