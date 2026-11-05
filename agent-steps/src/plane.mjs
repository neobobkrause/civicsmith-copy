/* agent-steps — the readers the shell shares with the steps: how a plane answer is read (R44), the published pack (R5), the
 * loadable layers (R46) and the model half (R47). Pure. */
/* Requirement ids in the comments below are `agent-worker`'s, as they stood when this code moved (T51, K3850); `build/requirements/agent-steps.md` maps them to this module's. */
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { RUN_RUNTIME, RUN_DATA_HANDLING } from "./talk.mjs";


/* -------------------------------------------------- D-276: THE ANSWER, NOT THE WIRE
 *
 * A REFUSAL THAT ARRIVES AS A WELL-FORMED HTTP RESPONSE IS STILL A REFUSAL, and
 * this is the one place in this member that says so. `askPlane` answers the
 * TRANSPORT question — did the plane answer at all — and nothing more. Reading
 * `.reached` and then taking fields off the body treats `{ok: false, reason:
 * MEANING_ROWS_UNKNOWN_ARM}` as an answer with no rows in it, which is how
 * D-276 turned the plane's own false-coverage fence into false coverage: the
 * run note said `0 meaning-grain row(s) queried` for a call that never
 * succeeded, and that note lands in an AI run's OBSERVATION ENTRIES, which are
 * record. CLAUDE.md: *"no meaning derived may mean nothing was extracted;
 * nothing extracted may mean the document was never read; no document may mean
 * nobody looked"* — saying WHICH is a first-class obligation, and "the record
 * was not asked" is a fourth sentence that must never be written as the first.
 *
 * REC-52/REC-53 swept exactly this shape through the plane — a silence or a
 * refusal turning into a normal-looking answer. This is that lesson on the
 * member side, and it is a FUNCTION rather than a rule so that a new call site
 * cannot get it wrong quietly: there are three outcomes and a caller must
 * handle each by name.
 *
 *   { silent }   the plane did not answer. Nothing is known about the record.
 *   { refused }  the plane answered, and its answer is NO. The code, the
 *                C-number and the plane's own body travel with it — this member
 *                re-words no refusal (A6).
 *   { result }   the plane answered YES, and this is what it said.
 *
 * AND THE REFUSAL IS NOT WHERE A READER EXPECTS IT — MEASURED 2026-08-09 BY
 * DRIVING THE REAL PLANE, and it is why "check `ok`" is only half the fix.
 * `op=meaningrows` refusing an unknown arm answers **HTTP 200** with a
 * **TOP-LEVEL `ok: true`**, because the control plane wraps whatever the Durable
 * Object returned:
 *
 *   { ok: true, result: { ok: false, reason: "MEANING_ROWS_UNKNOWN_ARM",
 *                         check: "C-23.2", translation: "…" }, store, tokenClass }
 *
 * A member that tested the ENVELOPE's `ok` would have read that as a successful
 * call, exactly as the member that tested `.reached` did — the same defect one
 * layer in. So the answer is the innermost object that states its own `ok`, and
 * a call is refused when EITHER the envelope or that object says no. An op whose
 * result carries no `ok` at all (`op=airunspawn`, `op=basisversions`) is
 * unaffected: the envelope is then the only thing that speaks.
 */
export function planeAnswer(asked, at) {
  if (!asked.reached) return { at, silent: asked };
  const envelope = (asked.body && typeof asked.body === "object") ? asked.body : {};
  const inner = (envelope.result && typeof envelope.result === "object" && !Array.isArray(envelope.result))
    ? envelope.result : null;
  /* WHOEVER STATES `ok` IS WHO IS ANSWERING. */
  const said = (inner && "ok" in inner) ? inner : envelope;
  if (asked.status !== 200 || envelope.ok !== true || said.ok === false)
    return { at, refused: { at,
                            code: said.reason ?? said.code ?? envelope.reason ?? envelope.code ?? null,
                            check: said.check ?? envelope.check ?? null,
                            plane: asked.body ?? null } };
  return { at, result: inner ?? envelope };
}

/** R48 — the pack on the plane's `op=agentpack` answer (control-plane R41): `{ok, pack}` when it carries
 *  one with a version, a resident layer and a disclosed map; otherwise `{ok: false, why}`, naming the plane's own
 *  `pack_absent` when it gave one. A partial pack is never used: its version is undetermined. */
export function publishedPack(answer) {
  const a = answer && typeof answer === "object" ? answer : {};
  const p = a.pack;
  if (p && typeof p === "object" && typeof p.version === "string" && p.version
      && p.resident && typeof p.resident === "object" && p.disclosed && typeof p.disclosed === "object")
    return { ok: true, pack: p };
  if (typeof a.pack_absent === "string" && a.pack_absent) return { ok: false, why: a.pack_absent.slice(0, 300) };
  return { ok: false, why: p == null ? localize("agent-steps.plane.the_answer_carries_no_pack", "the answer carries no pack")
    : localize("agent-steps.plane.the_answer_s_pack_has_no", "the answer's pack has no version, resident layer or disclosed layers") };
}

/* R56 (K1479, K1502, K1755) — THE SUGGESTIONS SWITCH THAT GOVERNS THE ACT, as the plane sends it beside the account
   (`suggestions`): the member's own (credentials R25; for the member's own sign-in, that sign-in's own, credentials R55,
   T46), or, for an act the group's API key serves, the group key's
   (credentials R37; K1479: the switch belongs to whoever holds the account). Only when it is on may the pack's
   `suggestions` layer (skills R35) be loaded; off, as by default, the layer is not offered and a call naming it is refused, so DEC-27's
   clause in the layers that are loaded governs and no unprompted suggestion is offered. The pack and its version are
   the same for every member (skills R35); only what this member lets the model load differs. */
const SUGGESTIONS_LAYER = "suggestions";
export function loadableLayers(pack, suggestionsOn) {
  return Object.keys(pack?.disclosed || {}).filter((k) => suggestionsOn === true || k !== SUGGESTIONS_LAYER);
}
export function loadLayer(model, input) {
  const name = String(input?.name ?? "");
  if (!model.layers.includes(name))
    return { content: name === SUGGESTIONS_LAYER
      ? localize("agent-steps.plane.the_suggestions_layer_is_not", "the suggestions layer is not loaded: the suggestions switch that governs this act is off")
      : localize("agent-steps.plane.no_disclosed_layer_name", "no disclosed layer '{name}'", { name: String(name) }), error: true };
  return { content: model.pack.disclosed[name] };
}

/** R47 (T53; BR22, BR29) — A segment's, an ask's or a draft's model half: the account handle that serves the member's
 *  act (`agent-worker` R33, `{level, account_id, entries, ...}`), the meter, `suggestions`, the door's trace and member
 *  reference for every conversation (`traced`, `{trace?, memberRef?}`), `pack` null, `layers` and `messages` empty, and
 *  the usage of each conversation kept until it is reported (`spent`, `drain`; ai-runs R48). Nothing in it outlives the
 *  call that made it. `reference` and `runner` are gone from it.
 *
 *  HOW ITS CONVERSATIONS ARE REACHED is held beside that state, not in it (none of these is an own enumerable key): the
 *  `provider` the shell bound (`providerFor`, `talk.mjs`), with `runtime` and `data_handling` for its requests (no
 *  provider-held state unless the shell names otherwise, R55). A shell not yet on T53 hands no provider and its earlier
 *  `reference` and `runner` instead; they are held only as that route (`legacy`) and every T53 gate is skipped for it. */
export function modelHalf({ account = null, meter, suggestions, traced = {}, provider = null, runtime = RUN_RUNTIME,
                            data_handling = RUN_DATA_HANDLING, reference, runner } = {}) {
  const pending = [];
  const half = {
    account, meter, suggestions: suggestions === true, traced, pack: null, layers: [], messages: [],
    /* R14, R26, R47 (T53; BR22, BR29; ai-runs R72's list): one entry `{mode, entry_id, label, usage, calls}` per
       conversation that states `usage`, `usage` and `calls` exactly as `converse` answers them (`calls` null where it
       states none, which the plane counts as one call), so the plane counts each model call. `entry_id` and `label` are
       those `converse` answered, else null, never invented: no mode's model is filled in here, and the `model` and
       `effort` a pre-T53 `converse` answers are not carried (ai-runs R72 refuses an entry naming no `entry_id`). */
    spent(got, mode) {
      if (!got || !got.usage) return;
      pending.push({ mode, entry_id: got.entry_id ?? null, label: got.label ?? null, usage: got.usage,
                     calls: got.calls === undefined ? null : got.calls });
    },
    drain() { return pending.splice(0, pending.length); },
  };
  const held = (k, value) => Object.defineProperty(half, k, { value, enumerable: false, writable: false });
  held("provider", provider && typeof provider.converse === "function" ? provider : null);
  held("runtime", runtime);
  held("data_handling", data_handling);
  held("legacy", half.provider ? null : { reference: reference ?? null, runner: runner ?? null });
  /* `agent-worker`'s `/ask` still reads these off the half until it moves to the T53 provider (its R33, R127): kept
     readable on that route only, as the route, never as the half's state; a half on the T53 provider has neither. */
  if (!half.provider) { held("reference", reference ?? null); held("runner", runner ?? null); }
  return half;
}

/** THE ONE MEANING READER IN THIS MEMBER, AND THE OP IS NAMED IN EXACTLY ONE
 *  PLACE. Two rows now need PL-9's read — `compose` queries at meaning grain and
 *  `collect` re-reads a citation BY ADDRESS through the same compiler's `ids`
 *  restriction — and two call sites naming the op would be two readers to keep in
 *  step. §14b.1's query-never-load is not "call this op"; it is that the run
 *  reaches everything it does not hold by ASKING, through one door. D-15's
 *  one-compilation-point rule is the same argument one layer down, and
 *  `harness.test.mjs` A9 holds it at the interface: every meaning read a run makes
 *  reaches the plane as this op, the parent's at `MEANING_ARM` (N421).
 *
 *  IT ANSWERS THROUGH `planeAnswer`, so there is no way to read these rows
 *  without having decided what to do about a refusal. The op's NAME is a
 *  constant because `planeAnswer` also wants it, so the code says the name once. */
const MEANING_OP = "meaningrows";
/* R103: a passage row's `snippet` is read at the longest length query-language R12 allows (64 tokens); its default is
   one clause, which is all a sub-session would otherwise see of a cited passage. */
const SNIPPET_TOKENS = 64;
export const meaningRead = async (call, { q = "", rows, limit = 50, ids = null } = {}) =>
  planeAnswer(await call(MEANING_OP, { q, rows, limit, snippet: SNIPPET_TOKENS }, ids ? { ids } : null), MEANING_OP);
