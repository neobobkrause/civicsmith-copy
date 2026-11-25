/* The member itself (the HTTP surface and the recompute), in a module that imports no wasm: the engine is handed in,
 * so a node-side suite drives this same code with the real engine compiled from the vendored file, and with stand-ins
 * where it must reach a step no real workbook reaches. `index.mjs` wires the real engine in.
 *
 * Given a capture sha and a store namespace, it reads the captured workbook from R2 itself (`CAPTURES.get`, never
 * handed the bytes), recomputes every formula with the pinned engine, and answers each formula cell's value. Or it
 * refuses by name, saying the workbook is not recomputed here and why. It compares nothing with the file's cached
 * values and judges nothing: agreement is the caller's to measure (`workbooks`), between two engines, never a verdict.
 * It writes nothing (R10): it holds `CAPTURES` and no other binding, and calls nothing on it but `.get`.
 */
import { makeMeter } from "../../bio-plane/src/cpu.mjs";
import { MAX_CELLS, MAX_UNZIPPED_BYTES, NAMESPACES, NOT_RECOMPUTED, REFUSALS, TIME_BUDGET_MS, enabledIn } from "./contract.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

/** The default turn boundary: workerd advances `Date.now()` only between turns, so the time a synchronous load took
 *  is read after one. */
const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

const refusal = (reason, why, extra = {}) =>
  ({ ok: false, reason, not_recomputed: NOT_RECOMPUTED, why, detail: REFUSALS[reason], ...extra });

const engineMessage = (e) => String((e && e.message) || e);

/**
 * The member over an engine (`enginecore.mjs`'s `makeEngine`, or a stand-in of the same shape).
 * `bounds` and `now`/`turn` exist so the suite can reach each refusal; the worker uses the defaults.
 */
export function makeMember(engine, {
  bounds = { maxUnzippedBytes: MAX_UNZIPPED_BYTES, maxCells: MAX_CELLS, timeBudgetMs: TIME_BUDGET_MS },
  now = () => Date.now(),
  turn = nextTurn,
} = {}) {

  /** R3-R7 over one workbook's bytes. A function of the bytes, the engine and the bounds (R12). */
  async function recompute(bytes) {
    const meter = makeMeter();
    const absent = engine.open();
    try {
      if (absent) return refusal("ENGINE_ABSENT", absent);

      const seen = meter.sync("inspect", () => engine.inspect(bytes, bounds), bytes.length);
      if (!seen.zip || !seen.workbook) return refusal("NOT_A_WORKBOOK", seen.why);
      if (seen.over_unzipped)
        return refusal("OVER_BOUND", localize("sheet-worker.member.the_workbook_unzips_to_more", "the workbook unzips to more than {maxUnzippedBytes} B, this member's bound; reading stopped at {unzipped_bytes} B", { maxUnzippedBytes: String(bounds.maxUnzippedBytes), unzipped_bytes: String(seen.unzipped_bytes) }),
          { measure: "unzipped_bytes", measured: seen.unzipped_bytes, measured_is: "at_least", bound: bounds.maxUnzippedBytes });
      if (seen.over_cells)
        return refusal("OVER_BOUND", localize("sheet-worker.member.the_workbook_holds_cells_cells", "the workbook holds {cells} cells; this member's bound is {maxCells}", { cells: String(seen.cells), maxCells: String(bounds.maxCells) }),
          { measure: "cells", measured: seen.cells, measured_is: "exact", bound: bounds.maxCells });
      const ext = seen.external;
      const links = ext.parts + ext.formulas + ext.defined_names;
      if (links > 0)
        return refusal("EXTERNAL_LINKS", localize("sheet-worker.member.the_workbook_refers_to_other", "the workbook refers to other workbooks: {parts} external-link part(s), {formulas} formula(s) and {defined_names} defined name(s)", { parts: String(ext.parts), formulas: String(ext.formulas), defined_names: String(ext.defined_names) }), { links, external: ext });

      const t0 = now();
      try {
        meter.sync("load", () => engine.load(bytes), bytes.length);
      } catch (e) {
        return refusal("ENGINE_FAILED", localize("sheet-worker.member.the_engine_refused_the_workbook", "the engine refused the workbook while loading it"),
          { stage: "load", engine_error: engineMessage(e) });
      }
      await turn();
      const elapsed = now() - t0;
      if (elapsed > bounds.timeBudgetMs)
        return refusal("TIME_LIMIT", localize("sheet-worker.member.loading_took_elapsed_ms_the", "loading took {elapsed} ms; the budget is {timeBudgetMs} ms", { elapsed: String(elapsed), timeBudgetMs: String(bounds.timeBudgetMs) }),
          { elapsed_ms: elapsed, budget_ms: bounds.timeBudgetMs });

      let out;
      try {
        out = meter.sync("evaluate", () => engine.evaluate());
      } catch (e) {
        return refusal("ENGINE_FAILED", localize("sheet-worker.member.the_engine_failed_while_evaluating", "the engine failed while evaluating the workbook"),
          { stage: "evaluate", engine_error: engineMessage(e) });
      }
      return answer(out, seen, { ...meter.report(), wasm_memory_bytes: engine.memoryBytes() });
    } finally {
      engine.close();
    }
  }

  function answer(out, seen, work) {
    const cells = out.cells.map((c) => {
      const ref = `${c.sheet}!${c.cell}`;
      const entry = {
        source: { kind: "sheet-cell", ref, sheet: c.sheet, cell: c.cell },
        formula: c.formula,
        value: c.value,
        type: c.type,
      };
      if (c.type === "error") {
        entry.error = c.error;
        entry.cause = c.cause;
        if (c.function) entry.function = c.function;
        if (c.via) entry.via = c.via;
        if (c.message) entry.engine_message = c.message;
        entry.not_recomputed = NOT_RECOMPUTED;
      }
      entry.volatile = c.volatile;
      return entry;
    });
    const notes = [];
    if (seen.macros)
      notes.push("the workbook carries a VBA project; macros are never run, so it was recomputed by its formulas alone");
    if (out.counts.errors)
      notes.push(localize("sheet-worker.member.errors_formula_cell_s_gave", "{errors} formula cell(s) gave an error value and are marked \"{NOT_RECOMPUTED}\" with a cause; an error here is not a disagreement with the file", { errors: String(out.counts.errors), NOT_RECOMPUTED: String(NOT_RECOMPUTED) }));
    if (out.counts.volatile)
      notes.push(localize("sheet-worker.member.volatile_formula_cell_s_call", "{volatile} formula cell(s) call a volatile function, whose value now is not the value the file cached", { volatile: String(out.counts.volatile) }));
    if (out.spill_cells)
      notes.push(localize("sheet-worker.member.spill_cells_cell_s_hold", "{spill_cells} cell(s) hold an array formula's spilled values and are not listed; the formula is listed at its anchor", { spill_cells: String(out.spill_cells) }));
    return {
      ok: true,
      engine: engine.name,
      engine_version: engine.version,
      wasm_sha256: engine.wasm.sha256,
      macros_present: seen.macros,
      counts: out.counts,
      notes,
      cells,
      work,
    };
  }

  async function handleRecompute(req, env) {
    const body = await req.json().catch(() => null);
    const sha = typeof body?.capture_sha === "string" ? body.capture_sha.toLowerCase() : "";
    if (!/^[0-9a-f]{64}$/.test(sha)) return json({ ok: false, reason: "BAD_SHA", detail: REFUSALS.BAD_SHA }, 400);
    if (typeof body.store !== "string") return json({ ok: false, reason: "BAD_STORE", detail: REFUSALS.BAD_STORE }, 400);
    const store = body.store;
    if (!NAMESPACES.includes(store))
      return json({ ok: false, reason: "NAMESPACE_UNKNOWN", detail: REFUSALS.NAMESPACE_UNKNOWN,
        asked: store.slice(0, 80), namespaces: [...NAMESPACES] }, 400);
    if (!enabledIn(env))
      return json({ ok: false, reason: "NOT_ENABLED", not_recomputed: NOT_RECOMPUTED, detail: REFUSALS.NOT_ENABLED });
    if (typeof env?.CAPTURES?.get !== "function")
      return json({ ok: false, reason: "R2_NOT_CONFIGURED", detail: REFUSALS.R2_NOT_CONFIGURED }, 503);
    const obj = await env.CAPTURES.get(`${store}/captures/${sha}`);
    if (!obj) return json({ ok: false, reason: "NOT_FOUND", detail: REFUSALS.NOT_FOUND, capture_sha: sha, store }, 404);
    const bytes = new Uint8Array(await obj.arrayBuffer());
    /* A refusal is a 200 with ok:false: the member answered. */
    return json(await recompute(bytes));
  }

  /** R8. `engine_loaded` is asked, never assumed: a member deployed without its wasm part looks healthy otherwise. */
  function handleVersion(env) {
    const why = engine.check();
    return json({
      ok: true, name: "sheet-worker", version: env?.VERSION ?? null,
      engine: engine.name, engine_version: engine.version,
      wasm_bytes: engine.wasm.bytes, wasm_sha256: engine.wasm.sha256,
      engine_loaded: why == null, ...(why ? { engine_unavailable: why } : {}),
      enabled: enabledIn(env),
      bounds: { max_unzipped_bytes: bounds.maxUnzippedBytes, max_cells: bounds.maxCells, time_budget_ms: bounds.timeBudgetMs },
    });
  }

  async function fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (req.method === "GET" && path === "/version") return handleVersion(env);
    if (req.method === "POST" && path === "/recompute") return handleRecompute(req, env);
    return json({ ok: false, reason: "UNKNOWN", detail: REFUSALS.UNKNOWN }, 404);
  }

  return { fetch, recompute };
}
