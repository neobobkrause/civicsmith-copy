/* R9: what changed between two readings, in events from `site-profiles`'
 * catalogue only (through `docprofile`'s re-export). A held figure changed is
 * `outcome_changed`; a row or table added `item_added`, one gone `delisted`; an
 * org moved between departments within one period `item_changed`. A reading
 * in which nothing was read is a failed read, never a document emptied. */
import { event, isMeaningful, worstSignificance } from "../docprofile/registry.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/** Key each item by `keyOf`, a repeat of one key numbered in reading order. */
function keyed(items, keyOf) {
  const seen = new Map(), out = new Map();
  for (const it of items) {
    const k = keyOf(it);
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    out.set(n === 1 ? k : `${k} #${n}`, it);
  }
  return out;
}

function result(events, confirmed, why) {
  return { meaningful: isMeaningful(events), significance: worstSignificance(events), events, confirmed, why };
}

function failed(why) {
  return { meaningful: null, significance: null, events: [], confirmed: null, why };
}

const tableKey = (t) => `${t.title || "(untitled table)"} @ page ${t.page === null ? "?" : t.page + 1}`;
const rowLabel = (r) => (r.label === null ? localize("budget-doctypes.assess.row_with_no_label_read", "(row with no label read)") : r.label);
const cellsOf = (r) => r.cells.map((c) => c.as_read);

/** Two PDF readings: tables matched by title and page, rows by label. */
export function assessTables(before, after) {
  const bt = before && Array.isArray(before.tables) ? before.tables : [];
  const at = after && Array.isArray(after.tables) ? after.tables : [];
  if (!bt.length || !at.length)
    return failed(!bt.length && !at.length ? localize("budget-doctypes.assess.no_table_was_read_in_either", "no table was read in either reading, so nothing can be compared")
      : localize("budget-doctypes.assess.no_table_was_read_in", "no table was read in the {v1} reading: a failed read, not a document emptied", { v1: String(!bt.length ? "earlier" : "later") }));
  const b = keyed(bt, tableKey), a = keyed(at, tableKey);
  const events = [];
  let held = 0;
  for (const [k, was] of b) {
    const now = a.get(k);
    if (!now) { events.push(event("delisted", { table: k, why: localize("budget-doctypes.assess.the_table_k_is_no", "the table \"{k}\" is no longer read", { k: String(k) }) })); continue; }
    const br = keyed(was.rows, rowLabel), ar = keyed(now.rows, rowLabel);
    for (const [rk, r0] of br) {
      const r1 = ar.get(rk);
      if (!r1) { events.push(event("delisted", { table: k, row: rk, why: localize("budget-doctypes.assess.the_row_rk_of_k", "the row \"{rk}\" of \"{k}\" is gone", { rk: String(rk), k: String(k) }) })); continue; }
      const c0 = cellsOf(r0), c1 = cellsOf(r1);
      let same = true;
      for (let i = 0; i < Math.max(c0.length, c1.length); i++) {
        if (c0[i] === c1[i]) continue;
        same = false;
        events.push(event("outcome_changed", { table: k, row: rk, column: i + 1, before: c0[i] ?? null, after: c1[i] ?? null,
          why: localize("budget-doctypes.assess.in_k_row_rk_figure", "in \"{k}\", row \"{rk}\", figure {v1} was printed {v2} and is now {v3}", { k: String(k), rk: String(rk), v1: String(i + 1), v2: String(c0[i] ?? "(none)"), v3: String(c1[i] ?? "(none)") }) }));
      }
      if (same) held++;
    }
    for (const rk of ar.keys())
      if (!br.has(rk)) events.push(event("item_added", { table: k, row: rk, why: localize("budget-doctypes.assess.the_row_rk_of_k_2", "the row \"{rk}\" of \"{k}\" is new", { rk: String(rk), k: String(k) }) }));
  }
  for (const k of a.keys())
    if (!b.has(k)) events.push(event("item_added", { table: k, why: localize("budget-doctypes.assess.the_table_k_is_new", "the table \"{k}\" is new", { k: String(k) }) }));
  return result(events,
    held ? { kind: "rows_unchanged", count: held, why: localize("budget-doctypes.assess.held_row_s_read_in", "{held} row(s) read in both readings print the same figures", { held: String(held) }) } : null,
    events.length ? localize("budget-doctypes.assess.length_change_s_between_the", "{length} change(s) between the two readings' tables", { length: String(events.length) }) : localize("budget-doctypes.assess.every_table_and_figure_read", "every table and figure read is as it was"));
}

/** Two budget-table readings: rows by R7's key, groupings within a period. */
export function assessLines(before, after) {
  const bl = before && Array.isArray(before.rows) ? before.rows : [];
  const al = after && Array.isArray(after.rows) ? after.rows : [];
  if (!bl.length || !al.length)
    return failed(!bl.length && !al.length ? localize("budget-doctypes.assess.no_budget_line_was_read_in", "no budget line was read in either reading, so nothing can be compared")
      : localize("budget-doctypes.assess.no_budget_line_was_read", "no budget line was read in the {v1} reading: a failed read, not a table emptied", { v1: String(!bl.length ? "earlier" : "later") }));
  const b = keyed(bl, (r) => r.key), a = keyed(al, (r) => r.key);
  const events = [];
  let held = 0;
  for (const [k, r0] of b) {
    const r1 = a.get(k);
    if (!r1) { events.push(event("delisted", { row: k, why: localize("budget-doctypes.assess.the_line_k_is_gone", "the line {k} is gone", { k: String(k) }) })); continue; }
    const v0 = r0.amount ? r0.amount.value : null, v1 = r1.amount ? r1.amount.value : null;
    if (String(v0) !== String(v1))
      events.push(event("outcome_changed", { row: k, column: "amount", before: v0, after: v1,
        why: localize("budget-doctypes.assess.the_line_k_was_v0", "the line {k} was {v0} and is now {v1}, as written", { k: String(k), v0: String(v0), v1: String(v1) }) }));
    else held++;
  }
  for (const k of a.keys()) if (!b.has(k)) events.push(event("item_added", { row: k, why: localize("budget-doctypes.assess.the_line_k_is_new", "the line {k} is new", { k: String(k) }) }));
  /* An org that moved between departments within one period. */
  const placed = (groups) => {
    const m = new Map();
    for (const g of groups || []) for (const o of g.orgs) m.set(JSON.stringify([g.period_as_written, o]), g);
    return m;
  };
  const pb = placed(before.groupings), pa = placed(after.groupings);
  for (const [k, g0] of pb) {
    const g1 = pa.get(k);
    if (!g1 || (g0.department === g1.department && g0.department_code === g1.department_code)) continue;
    const [period, org] = JSON.parse(k);
    events.push(event("item_changed", { org, period_as_written: period, before: g0.department, after: g1.department,
      why: localize("budget-doctypes.assess.for_period_org_org_was", "for {period}, org {org} was under \"{department}\" and is now under \"{department_2}\"", { period: String(period), org: String(org), department: String(g0.department), department_2: String(g1.department) }) }));
  }
  return result(events,
    held ? { kind: "lines_unchanged", count: held, why: localize("budget-doctypes.assess.held_line_s_read_in", "{held} line(s) read in both readings hold the same amount", { held: String(held) }) } : null,
    events.length ? localize("budget-doctypes.assess.length_change_s_between_the_2", "{length} change(s) between the two readings' lines", { length: String(events.length) }) : localize("budget-doctypes.assess.every_line_read_is", "every line read is as it was"));
}
