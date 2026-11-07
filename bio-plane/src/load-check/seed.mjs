/* seedCopy (R3) and the interpretation densities (R5): a scratch copy's record built through the product's own acts.
 *
 * Never a row written past the plane: every byte arrives by an upload act the door sends, and every figure returned is
 * what the copy's gauge (screens-settings) reports after it. */
import { budgetOf } from "../read-bounds.mjs";
import { generate } from "../../test/pdfgen.mjs";
import { guardCopy, declaredOp, codeOf, LoadRefusal, SEED_BY } from "./guard.mjs";
import { runStep, pct, pacer } from "./run.mjs";

export const SEED_TOLERANCE = 0.1;
export const STRESS_PAGES = 5000;
const MAX_PAGES = 2000;
const MAX_ROUNDS = 400;

/* the densities (R5): ordinary is a part for every 20th page of the busiest 10 % of documents, heavy every 5th page of
 * every document, stress every part of the 5,000-page document */
export const DENSITIES = Object.freeze({
  ordinary: Object.freeze({ every: 20, share: 0.1 }),
  heavy: Object.freeze({ every: 5, share: 1 }),
  stress: Object.freeze({ every: 1, stress: true }),
});

const within = (got, want) => (want === 0 ? got === 0 : Math.abs(got - want) <= SEED_TOLERANCE * want);
const failed = (a) => !a || a.ok === false || (Number.isInteger(a.status) && a.status >= 400);

/* a document of `pages` pages: text pages grow the database by their extracted text, scan pages the store by their images */
const documentOf = async (seedId, i, kind, pages) => {
  const g = generate({ kind: "pdf", seed: `${seedId}-${i}`, size: { pages, lines: kind === "stress" ? 2 : 20 }, kinds: [kind === "scan" ? "scan" : "text"] });
  return { name: `${seedId}-${i}.pdf`, type: g.type, size: g.size, bytes: await g.bytes() };
};

/* R3: seed `copy` to `size` = {database_bytes, r2_bytes, mix: "text" | "scan", stress_pages?}; returns the seed record
 * (and sets it as `copy.seed`): the bytes, rows and documents the gauge reports, and whether both sizes are within 10 % */
export async function seedCopy(copy, size, opts = {}) {
  guardCopy(copy);
  const want = { database: size?.database_bytes, r2: size?.r2_bytes };
  if (![want.database, want.r2].every((n) => Number.isFinite(n) && n >= 0)) throw new LoadRefusal("BAD_SIZE");
  const mix = size.mix === "scan" ? "scan" : "text";
  const upload = opts.upload_op ?? "captureupload";
  if (!declaredOp(upload).mutating) throw new LoadRefusal("UPLOAD_NOT_AN_ACT", { op: upload });
  const call = { member: 0, members: 1, credentials: copy.credentials };
  const id = opts.seed_id ?? `p3dev-load-${Date.now().toString(36)}`;
  const start = await copy.door.gauge({ credentials: copy.credentials });
  const documents = [];
  let g = start;
  const send = async (kind, pages, stress = false) => {
    const doc = await documentOf(id, documents.length, stress ? "stress" : kind, pages);
    const a = await copy.door.call(upload, { name: doc.name, type: doc.type, size: doc.size, bytes: doc.bytes }, call);
    if (failed(a)) throw new LoadRefusal("SEED_UPLOAD_REFUSED", { code: codeOf(a) });
    const before = g;
    g = await copy.door.gauge({ credentials: copy.credentials });
    documents.push({ id: a.body?.document ?? a.body?.id ?? doc.name, kind: stress ? "text" : kind, pages, bytes: doc.size, ...(stress ? { stress: true } : {}) });
    return { database: g.database_bytes - before.database_bytes, r2: g.r2_bytes - before.r2_bytes };
  };
  if (Number.isInteger(size.stress_pages) && size.stress_pages > 0) await send("text", size.stress_pages, true);
  /* what one page of each kind added, learnt from the first document of the kind */
  const perPage = { text: null, scan: null };
  const grows = { text: "database", scan: "r2" };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const short = { database: want.database - g.database_bytes, r2: want.r2 - g.r2_bytes };
    if (within(g.database_bytes, want.database) && within(g.r2_bytes, want.r2)) break;
    /* the mix's own kind first; the other kind only for the dimension the mix's kind does not grow */
    const other = mix === "text" ? "scan" : "text";
    const kind = short[grows[mix]] > SEED_TOLERANCE * want[grows[mix]] / 2 ? mix
      : short[grows[other]] > SEED_TOLERANCE * want[grows[other]] / 2 ? other : null;
    if (!kind) break;
    const dim = grows[kind];
    const pages = perPage[kind] ? Math.max(1, Math.min(MAX_PAGES, Math.floor(short[dim] / perPage[kind]))) : 1;
    const added = await send(kind, pages);
    if (added[dim] > 0) perPage[kind] = added[dim] / pages;
    else if (!perPage[kind]) throw new LoadRefusal("SEED_DOES_NOT_GROW", { kind });
  }
  const seed = {
    by: SEED_BY, id, team: start.team, mix,
    database_bytes: g.database_bytes, r2_bytes: g.r2_bytes, rows: g.rows ?? null,
    documents, upload_bytes: documents.reduce((n, d) => Math.max(n, d.bytes), 0),
    reached: within(g.database_bytes, want.database) && within(g.r2_bytes, want.r2),
  };
  copy.seed = seed;
  return seed;
}

const spread = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? { median: pct(s, 50), p90: pct(s, 90), p99: pct(s, 99), n: s.length } : null;
};
const judge = (name, t, budget) => (!t ? null : t.p90 > budget.ceiling_ms * budget.p90_factor ? { name, over: "p90", class: budget.class }
  : t.median > budget.ceiling_ms ? { name, over: "median", class: budget.class } : null);

/* the parts a density interprets on the seeded record */
export function partsFor(documents, density, stressPages = STRESS_PAGES) {
  const d = DENSITIES[density];
  if (!d) throw new LoadRefusal("UNKNOWN_DENSITY", { density });
  if (d.stress) {
    const doc = documents.find((x) => x.stress && x.pages >= stressPages);
    return doc ? Array.from({ length: doc.pages }, (_, i) => ({ document: doc.id, part: i + 1 })) : null;
  }
  const docs = documents.filter((x) => !x.stress);
  const take = docs.slice(0, Math.max(docs.length ? 1 : 0, Math.ceil(d.share * docs.length)));
  return take.flatMap((doc) => Array.from({ length: doc.pages }, (_, i) => i + 1).filter((p) => (p - 1) % d.every === 0).map((p) => ({ document: doc.id, part: p })));
}

/* R5: each density in turn on the seeded record, through the members' acts (spec.acts: how opened, cited, marked,
 * accepted, in that order); per density the rows and bytes added a part (from the gauge), the room's hold a landing,
 * the acts' and (stress) the three reads' times, each judged against its budget, and the screens that read
 * interpretation re-run at the rated members. A break or a refusal is recorded, never passed silently. */
export async function seedInterpretation(run, items, spec, { rated = 0, log = () => {} } = {}) {
  const { copy, now } = run;
  const acts = (spec.acts ?? []).map((op) => ({ op, budget: budgetOf(declaredOp(op).mutating ? "write_act" : "read_act") }));
  if (!acts.length) throw new LoadRefusal("NO_INTERPRETATION_ACTS");
  const reads = Object.entries(spec.reads ?? {}).map(([name, r]) => ({ name, op: r.op, input: r.input, budget: budgetOf(r.class ?? "read_act") }));
  for (const r of reads) declaredOp(r.op);
  const screens = items.filter((i) => (spec.screens ?? []).includes(i.name));
  const pace = pacer(run);
  const ctx = { member: 0, members: 1, credentials: run.credentials };
  const timed = async (op, input) => {
    await pace();
    const t0 = now();
    let a;
    try { a = await copy.door.call(op, input, ctx); } catch (e) { a = { ok: false, code: typeof e?.code === "string" ? e.code : "THROWN" }; }
    return { a, ms: Number.isFinite(a?.net_ms) ? a.net_ms : now() - t0 };
  };
  const out = { densities: {}, rows_total: 0, bytes_total: { database: 0, r2: 0 }, interrupted: false };
  for (const density of spec.densities ?? Object.keys(DENSITIES)) {
    const parts = partsFor(copy.seed?.documents ?? [], density, spec.stress_pages ?? STRESS_PAGES);
    if (!parts) { out.densities[density] = { skipped: "NO_STRESS_DOCUMENT", held: false, breaks: [] }; continue; }
    log(`load-check: interpretation, ${density}, ${parts.length} parts`);
    const g0 = await copy.door.gauge({ credentials: copy.credentials });
    const times = new Map(acts.map((x) => [x.op, []]));
    const holds = [];
    let landed = 0, refused = null;
    for (const part of parts) {
      if (run.signal?.aborted) { out.interrupted = true; return out; }
      for (const act of acts) {
        const { a, ms } = await timed(act.op, part);
        times.get(act.op).push(ms);
        if (Number.isFinite(a?.hold_ms)) holds.push(a.hold_ms);
        if (failed(a)) { refused = { at: landed + 1, op: act.op, code: codeOf(a), figure: a.body?.figure ?? null, held: a.body?.held ?? null }; break; }
      }
      if (refused) break;
      landed++;
    }
    const g1 = await copy.door.gauge({ credentials: copy.credentials });
    const rows = (g1.rows ?? 0) - (g0.rows ?? 0);
    const bytes = { database: g1.database_bytes - g0.database_bytes, r2: g1.r2_bytes - g0.r2_bytes };
    const breaks = [];
    const actTimes = {};
    for (const act of acts) {
      const t = spread(times.get(act.op));
      actTimes[act.op] = t;
      const b = judge(act.op, t, act.budget);
      if (b) breaks.push(b);
    }
    const readTimes = {};
    if (DENSITIES[density].stress) {
      for (const r of reads) {
        const xs = [];
        for (let i = 0; i < (spec.samples ?? 5); i++) xs.push((await timed(r.op, { document: parts[0].document, ...(r.input ?? {}) })).ms);
        readTimes[r.name] = spread(xs);
        const b = judge(r.name, readTimes[r.name], r.budget);
        if (b) breaks.push(b);
      }
    }
    let screensHeld = null;
    if (rated > 0 && screens.length) {
      const s = await runStep(run, screens, rated, { label: `interpretation-${density}` });
      screensHeld = s.held;
      for (const name of s.broke) breaks.push({ name, over: s.items[name].over, class: s.items[name].class });
      if (s.failing) breaks.push({ name: "error_share", over: "errors", class: null });
    }
    out.rows_total += rows;
    out.bytes_total.database += bytes.database;
    out.bytes_total.r2 += bytes.r2;
    out.densities[density] = {
      parts: parts.length, landed, refused, rows_added: rows, bytes_added: bytes,
      rows_per_part: landed ? rows / landed : null,
      bytes_per_part: landed ? { database: bytes.database / landed, r2: bytes.r2 / landed } : null,
      hold: spread(holds), acts: actTimes, reads: readTimes, screens_held: screensHeld,
      rows_total: out.rows_total, bytes_total: { ...out.bytes_total },
      documents: new Set(parts.map((p) => p.document)).size,
      breaks, held: !breaks.length,
    };
  }
  return out;
}
