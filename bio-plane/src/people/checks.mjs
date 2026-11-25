/* people's interest checks (R22–R25; K1491, K1473): a check is DATA, a condition over held facts at two ends with a
   hop bound and a stated denominator, evaluated by computation (never a model run) into the checks' own result table.
   This file holds the condition grammar, the shipped checks and the evaluation of one person; it reads the record only
   through the readers it is handed (`lines`, `events`, `money`, `entities`) and writes nothing. A match is a fact about
   rows, never a judgment on a person (R29): its words are "Noticed", never "conflict". */
import { isHypothesisId } from "../record-grammar/index.mjs";
import { compare, span } from "../civil-time/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* R22: a hop goes only through these two line kinds, at most two hops. */
export const HOP_KINDS = Object.freeze(["related_to", "associate_of"]);
export const HOPS_MAX = 2;
export const MONEY_SIDES = Object.freeze(["payer", "payee"]);
/* The machine's own stamp on the shipped checks (DEC-52). */
export const CHECK_MACHINE = "class:daemon";

/* R22 (K1491): the shipped checks, the machine's own. The revolving door: a `holds` line to a government office or body,
   followed within two years by a `holds` line to an organisation that office (or the body it is part of) oversees or
   contracts with. */
export const SHIPPED_CHECKS = Object.freeze([
  Object.freeze({
    name: "revolving door",
    condition: Object.freeze({
      from: { line: "holds", sector: "government" },
      to: { line: "holds" },
      join: { lines: ["oversees", "contracts_with"] },
      order: { after: true, within_days: 730 },
      hops: 0,
    }),
    denominator: word("people.persons_record_holds"),
  }),
]);

const filled = (v) => typeof v === "string" && v.trim() !== "";
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/* Every string inside a value, for R22's hypothesis refusal. */
function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (isObj(v)) Object.values(v).forEach((x) => strings(x, out));
  return out;
}

/** R22 (K1467): the hypothesis id a check names, or null. A hypothesis is never a fact a check may rest on. */
export function hypothesisNamed(...values) {
  for (const s of strings(values)) {
    for (const tok of s.split(/[^A-Za-z0-9-]+/)) if (tok && isHypothesisId(tok)) return tok;
  }
  return null;
}

/* One end's selector: a line kind (optionally the counterparty's sector), an event role, or a money kind and side. */
function selectorError(sel, end) {
  if (!isObj(sel)) return `the condition's ${end} names a line kind, an event role or a money kind`;
  const forms = ["line", "event_role", "money"].filter((k) => sel[k] !== undefined);
  if (forms.length !== 1) return `the condition's ${end} names exactly one of line, event_role or money`;
  if (!filled(sel[forms[0]])) return `the condition's ${end}.${forms[0]} is not a name`;
  if (forms[0] === "money" && !MONEY_SIDES.includes(sel.side)) return `the condition's ${end}.side is one of ${MONEY_SIDES.join(", ")}`;
  if (sel.sector !== undefined && (forms[0] !== "line" || !filled(sel.sector))) return `the condition's ${end}.sector is a sector, on a line end only`;
  return null;
}

/** R22: the condition's shape, or the reason it is not one. Pure. */
export function conditionError(c) {
  if (!isObj(c)) return "a condition is {from, to, join, order?, hops?}";
  for (const end of ["from", "to"]) { const e = selectorError(c[end], end); if (e) return e; }
  const j = c.join;
  if (!(j === "same" || (isObj(j) && Array.isArray(j.lines) && j.lines.length && j.lines.every(filled))))
    return localize("people.checks.join_shape", 'the condition\'s join is "same" (one counterparty) or {lines: [kinds]} (a line between the two counterparties)');
  if (c.order !== undefined && c.order !== null) {
    if (!isObj(c.order) || c.order.after !== true) return "the condition's order is {after: true, within_days?}";
    if (c.order.within_days !== undefined && !(Number.isInteger(c.order.within_days) && c.order.within_days > 0))
      return "the condition's order.within_days is a whole number of days above zero";
  }
  const hops = c.hops === undefined ? 0 : c.hops;
  if (!Number.isInteger(hops) || hops < 0 || hops > HOPS_MAX)
    return `the condition's hops is a whole number from 0 to ${HOPS_MAX}, through ${HOP_KINDS.join(" or ")} only`;
  return null;
}

const listOf = (r) => {
  if (!r || r.ok === false) return [];
  for (const k of ["items", "lines", "events", "facts", "duties"]) if (Array.isArray(r[k])) return r[k];
  return Array.isArray(r) ? r : [];
};
const lineId = (l) => l.line_id ?? l.id ?? null;
const eventId = (e) => e.event_id ?? e.id ?? null;
const factId = (f) => f.fact_id ?? f.id ?? null;
const partyEntity = (p) => (isObj(p) ? p.entity ?? null : typeof p === "string" ? p : null);
const roleNames = (roles) => (Array.isArray(roles) ? roles.map((r) => (isObj(r) ? r.role : r)).filter(filled) : []);

/* A fact at one end, as `{row: {module, id}, counterparty, from, to, precision, zone}`, the bounds as the owner holds them. */
function factsAt(readers, entity, sel, viewer) {
  const out = [];
  if (sel.line !== undefined) {
    for (const l of listOf(readers.lines.linesOf({ entity, kinds: [sel.line], direction: "from", limit: 500, viewer }))) {
      if (l.withdrawn || (l.from ?? l.from_entity) !== entity) continue;
      const to = l.to ?? l.to_entity;
      if (sel.sector !== undefined && !readers.sectorIs(to, sel.sector)) continue;
      const v = isObj(l.valid) ? l.valid : {};
      out.push({ row: { module: "lines", id: lineId(l) }, counterparty: to, from: v.from ?? null, to: v.to ?? null,
                 precision: v.precision || "day", zone: v.zone || "UTC" });
    }
  } else if (sel.event_role !== undefined) {
    const r = readers.events.eventsFor({ entity, limit: 500, viewer });
    for (const e of [...listOf(r), ...(r && Array.isArray(r.placed_nowhere) ? r.placed_nowhere : [])]) {
      if (!roleNames(e.roles).includes(sel.event_role)) continue;
      const w = isObj(e.when) ? e.when : {};
      out.push({ row: { module: "events", id: eventId(e) }, counterparty: eventId(e), from: w.start ?? null, to: w.end ?? w.start ?? null,
                 precision: w.precision || "day", zone: w.zone || "UTC" });
    }
  } else if (sel.money !== undefined) {
    for (const f of listOf(readers.money.moneyOf({ entity, kinds: [sel.money], limit: 500, viewer }))) {
      const payer = partyEntity(f.from), payee = partyEntity(f.to);
      const mine = sel.side === "payer" ? payer : payee;
      if (mine !== entity) continue;
      const p = isObj(f.period) ? f.period : {};
      out.push({ row: { module: "money", id: factId(f) }, counterparty: sel.side === "payer" ? payee : payer,
                 from: p.from ?? null, to: p.to ?? null, precision: p.precision || "day", zone: p.zone || "UTC" });
    }
  }
  return out.filter((f) => filled(f.row.id));
}

/* The persons `entity` reaches through at most `hops` related_to/associate_of lines, with the lines walked. */
function reach(readers, entity, hops, viewer) {
  const seen = new Map([[entity, []]]);
  let frontier = [entity];
  for (let h = 0; h < hops; h++) {
    const next = [];
    for (const p of frontier) {
      for (const l of listOf(readers.lines.linesOf({ entity: p, kinds: [...HOP_KINDS], limit: 500, viewer }))) {
        if (l.withdrawn) continue;
        const a = l.from ?? l.from_entity, b = l.to ?? l.to_entity;
        const other = a === p ? b : a;
        if (!filled(other) || seen.has(other)) continue;
        seen.set(other, [...seen.get(p), { module: "lines", id: lineId(l) }]);
        next.push(other);
      }
    }
    frontier = next;
  }
  return seen;
}

/* R22: the join of two counterparties: the same one, or a held line of the join's kinds from the first (or the body
   it is post_in or part_of, one step) to the second. Answers the rows it rests on, or null. */
function joined(readers, cf, ct, join, viewer) {
  if (!filled(cf) || !filled(ct)) return null;
  if (join === "same") return cf === ct ? [] : null;
  const starts = [[cf, []]];
  for (const l of listOf(readers.lines.linesOf({ entity: cf, kinds: ["post_in", "part_of"], direction: "from", limit: 500, viewer })))
    if (!l.withdrawn) starts.push([l.to ?? l.to_entity, [{ module: "lines", id: lineId(l) }]]);
  for (const [s, via] of starts) {
    for (const l of listOf(readers.lines.linesOf({ entity: s, kinds: join.lines, direction: "from", limit: 500, viewer }))) {
      if (!l.withdrawn && (l.to ?? l.to_entity) === ct) return [...via, { module: "lines", id: lineId(l) }];
    }
  }
  return null;
}

/* R22: "after, within n days": the first fact's end before the second's start, and every reading of the gap within the
   bound. Anything civil-time does not settle is no match (never a guess). */
function ordered(f, t, order) {
  if (!order) return true;
  if (!filled(f.to) || !filled(t.from)) return false;
  const a = { value: f.to, precision: f.precision, zone: f.zone }, b = { value: t.from, precision: t.precision, zone: t.zone };
  let c;
  try { c = compare(a, b); } catch { return false; }
  if (c !== "before") return false;
  if (order.within_days === undefined) return true;
  let s;
  try { s = span(a, b, { unit: "days" }); } catch { return false; }
  return !!s && Number.isFinite(s.max) && s.max <= order.within_days;
}

/** R23: one person's matches for one condition, each `{person, rows, derivation}`; `has` is true when the person holds a
 *  fact of the first end (the denominator's set). Pure over the readers; writes nothing. */
export function evaluatePerson(readers, person, condition, viewer) {
  const fromFacts = factsAt(readers, person, condition.from, viewer);
  const matches = [];
  if (!fromFacts.length) return { has: false, matches };
  const reached = reach(readers, person, condition.hops || 0, viewer);
  for (const [other, via] of reached) {
    const toFacts = factsAt(readers, other, condition.to, viewer);
    for (const f of fromFacts) {
      for (const t of toFacts) {
        if (f.row.module === t.row.module && f.row.id === t.row.id) continue;
        if (!ordered(f, t, condition.order)) continue;
        const j = joined(readers, f.counterparty, t.counterparty, condition.join, viewer);
        if (j === null) continue;
        const rows = [f.row, ...via, t.row, ...j];
        matches.push({ person, rows, derivation: { person, through: other === person ? null : other, from: f.row,
          to: t.row, hops: via, join: j, from_counterparty: f.counterparty, to_counterparty: t.counterparty } });
      }
    }
  }
  return { has: true, matches };
}
