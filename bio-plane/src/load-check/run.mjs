/* runProfile (R1, R2, R5): seeded members working a profile against a scratch copy, stepped up a ramp until a screen
 * or act breaks its time class at the 90th percentile or more than 1 % of operations fail.
 *
 * profile = { name, seed, rounds, think_ms, rate, items: { <name>: item }, interpretation? }
 *   item = { weight, reads: [op | {op, input}] }      a screen: its declared reads, sent together
 *        | { weight, op, input? }                     an act
 *   each with an optional time class `class` (default: a screen `screen_load`, a mutating op `write_act`, else `read_act`)
 *   and `ceiling_ms` (downward only, runtime-limits R42). `input` is an object or `(ctx) => object`.
 * copy.door = { call(op, input, {member, members, credentials}) -> answer, gauge() -> {...}, cost?() -> number }
 *   an answer: { ok, status, code, body, hops, net_ms, wait_ms, hold_ms } (all but ok optional; net_ms is the door's own
 *   measure of the round trip when it has one, else the driver's clock is). */
import { budgetOf, levelOf } from "../read-bounds.mjs";
import { drawAt } from "../../test/seeded.mjs";
import { guardCopy, guardSeed, clip, declaredOp, codeOf, scrubber, loggerFor, nameOf, LoadRefusal } from "./guard.mjs";
import { seedInterpretation } from "./seed.mjs";

export const FAIL_SHARE = 0.01;
const DEFAULT_ROUNDS = 10;

/* nearest-rank percentile of sorted numbers; null for none */
export const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] : null);
const spread = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? { median: pct(s, 50), p90: pct(s, 90), p99: pct(s, 99), n: s.length } : null;
};

/* the items of a profile, each with its ops checked against op-declarations and its budget from runtime-limits */
export function itemsOf(profile) {
  const items = profile?.items;
  if (!items || typeof items !== "object" || !Object.keys(items).length) throw new LoadRefusal("NO_ITEMS");
  const out = [];
  for (const [name, it] of Object.entries(items)) {
    const reads = Array.isArray(it.reads) ? it.reads.map((r) => (typeof r === "string" ? { op: r } : r)) : null;
    const ops = reads ? reads : [{ op: it.op, input: it.input }];
    const specs = ops.map((r) => declaredOp(r.op));
    if (reads && specs.some((s) => s.mutating)) throw new LoadRefusal("WRITE_IN_SCREEN", { item: name });
    const cls = it.class ?? (reads ? "screen_load" : specs[0].mutating ? "write_act" : "read_act");
    const budget = budgetOf(it.ceiling_ms === undefined ? cls : { class: cls, ceiling_ms: it.ceiling_ms });
    const weight = Number.isFinite(it.weight) && it.weight > 0 ? it.weight : 1;
    out.push({ name, kind: reads ? "screen" : "act", ops, class: cls, budget, weight });
  }
  return out;
}

const pick = (items, x) => {
  const total = items.reduce((n, i) => n + i.weight, 0);
  let at = x * total;
  for (const i of items) { if (at < i.weight) return i; at -= i.weight; }
  return items[items.length - 1];
};

/* R2: request starts spaced at least 1000 / rate ms apart over all members, however many there are */
export function pacer(run) {
  const interval = 1000 / run.rate;
  let nextAt = null;
  return async () => {
    const t = run.now();
    nextAt = nextAt === null ? t : Math.max(nextAt + interval, t);
    if (nextAt > t) await run.sleep(nextAt - t, "pace");
  };
}

const failed = (a) => !a || a.ok === false || (Number.isInteger(a.status) && a.status >= 400);

/* one step: `members` seeded members, each working `rounds` picks of the profile; the door is paced to `rate` */
export async function runStep(run, items, members, { label = "step" } = {}) {
  const { copy, profile, now, sleep, credentials } = run;
  const per = new Map(items.map((i) => [i.name, { times: [], hops: [], requests: 0, repeats: 0, errors: 0 }]));
  const errors = {}, waits = [];
  let requests = 0, bad = 0;
  const pace = pacer(run);
  const call = async (op, input, member) => {
    await pace();
    requests++;
    let a;
    try { a = await copy.door.call(op, input, { member, members, credentials }); } catch (e) { a = { ok: false, code: typeof e?.code === "string" ? e.code : "THROWN" }; }
    if (Number.isFinite(a?.wait_ms)) waits.push(a.wait_ms);
    if (failed(a)) { bad++; const c = codeOf(a); errors[c] = (errors[c] ?? 0) + 1; }
    return a;
  };
  const cost0 = typeof copy.door.cost === "function" ? await copy.door.cost() : null;
  const think = profile.think_ms ?? 0;
  const rounds = Number.isInteger(profile.rounds) && profile.rounds > 0 ? profile.rounds : DEFAULT_ROUNDS;
  const member = async (m) => {
    for (let r = 0; r < rounds; r++) {
      if (run.signal?.aborted) return;
      const it = pick(items, drawAt(String(profile.seed ?? profile.name ?? "load"), label, members, m, r));
      const ctx = { member: m, members, round: r, documents: copy.seed?.documents ?? [] };
      const t0 = now();
      const answers = await Promise.all(it.ops.map((o) => call(o.op, typeof o.input === "function" ? o.input(ctx) : o.input ?? {}, m)));
      const t1 = now();
      const rec = per.get(it.name);
      const nets = answers.map((a) => a?.net_ms).filter(Number.isFinite);
      rec.times.push(nets.length === answers.length ? Math.max(...nets) : t1 - t0);
      const hops = answers.map((a) => a?.hops).filter(Number.isFinite);
      if (hops.length) rec.hops.push(Math.max(...hops));
      rec.requests += answers.length;
      rec.repeats += answers.length - new Set(it.ops.map((o) => o.op)).size;
      if (answers.some(failed)) rec.errors++;
      if (think > 0) await sleep(think, "think");
    }
  };
  await Promise.all(Array.from({ length: members }, (_, m) => member(m)));
  const cost1 = cost0 === null ? null : await copy.door.cost();
  const out = {};
  const broke = [];
  for (const it of items) {
    const rec = per.get(it.name);
    const t = spread(rec.times);
    const ceiling = it.budget.ceiling_ms;
    const over = !t ? null : t.p90 > ceiling * it.budget.p90_factor ? "p90" : t.median > ceiling ? "median" : null;
    if (over) broke.push(it.name);
    out[it.name] = {
      kind: it.kind, class: it.class, ceiling_ms: ceiling, samples: t?.n ?? 0,
      median: t?.median ?? null, p90: t?.p90 ?? null, p99: t?.p99 ?? null,
      hops: rec.hops.length ? pct(rec.hops.sort((a, b) => a - b), 50) : null,
      requests: rec.requests, repeats: rec.repeats, errors: rec.errors, over,
    };
  }
  const share = requests ? bad / requests : 0;
  return {
    members, requests, errors, error_share: share,
    door_wait: spread(waits) && { median: spread(waits).median, p90: spread(waits).p90 },
    cost: cost0 === null || !Number.isFinite(cost1) ? null : cost1 - cost0,
    items: out, broke, failing: share > FAIL_SHARE, held: !broke.length && share <= FAIL_SHARE,
  };
}

/* R1: refuse, then step up the ramp; the steps that held are returned, and the step that broke beside them */
export async function runProfile(copy, profile, ramp, opts = {}) {
  guardCopy(copy);
  const { steps, rate, clipped } = clip(ramp, profile?.rate);
  const items = itemsOf(profile);
  const { deep, scrub } = scrubber(copy.credentials);
  const log = loggerFor(opts.log, scrub);
  await guardSeed(copy);
  const run = {
    copy, profile, rate, signal: opts.signal, credentials: copy.credentials,
    now: opts.now ?? (() => performance.now()), sleep: opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
  };
  const held = [];
  let broken = null, interrupted = false;
  for (const n of steps) {
    if (opts.signal?.aborted) { interrupted = true; break; }
    log(`load-check ${nameOf(copy)}: step of ${n} members`);
    const s = await runStep(run, items, n, { label: `ramp-${n}` });
    if (opts.signal?.aborted) { interrupted = true; break; }
    if (!s.held) { broken = s; log(`load-check ${nameOf(copy)}: ${n} members broke ${s.broke.join(", ") || "the error share"}`); break; }
    held.push(s);
  }
  const rated = interrupted ? null : held.length ? held[held.length - 1].members : 0;
  let interpretation = null;
  if (!interrupted && profile.interpretation) {
    interpretation = await seedInterpretation(run, items, profile.interpretation, { rated, log });
    if (interpretation.interrupted) interrupted = true;
  }
  return deep({
    copy: nameOf(copy), level: levelOf(copy), profile: profile.name ?? null,
    completed: !interrupted, interrupted, rate, clipped, steps: held, broken, rated,
    seed: copy.seed ? { team: copy.seed.team, database_bytes: copy.seed.database_bytes ?? null, r2_bytes: copy.seed.r2_bytes ?? null,
      documents: copy.seed.documents?.length ?? 0, upload_bytes: copy.seed.upload_bytes ?? null } : null,
    samples: [...held, ...(broken ? [broken] : [])].reduce((n, s) => n + Object.values(s.items).reduce((k, i) => k + i.samples, 0), 0),
    interpretation,
  });
}
