/* WHAT THIS MEMBER NAMES TO THE PLANE: its namespaces (R4), the ops a run's rows call (R37, R53), the meaning arm it
 * reads at, and the ops an ask may read (R55). Data only, in a module of its own because a Worker entry may export only
 * handlers (workerd refuses a named export of anything else at startup, measured), and the suites and the control
 * plane's pin (N402) import these.
 *
 * NONE OF IT GRANTS ANYTHING. D-199 (2): what a run's credential may reach is a row a member authored, read at the
 * plane's gate; what an ask's grant may reach is `credentials`' grant class (its R28). These are DECLARATIONS of what
 * this member's rows and its ask do, pinned as exact sets by the suites, floor and ceiling both, so a call this member
 * gains is a call somebody decided to give it. Naming an op the credential or grant does not admit gets the plane's
 * refusal, passed through verbatim (R43).
 *
 * Held here since T33-57: `agent-harness` (T33-54) copied `harness.mjs` whole, these with it, but they are this
 * member's requirements (R4, R37, R53, R55), so this member declares them and reads none of them from there. */

/* D-462, R4 — THE NAMESPACES THIS MEMBER NAMES TO THE PLANE: EXACTLY `bio` OR `scratch`, case-sensitive (a Durable
 * Object name is an exact string). The plane's set is not per instance (`namespaceGate` holds it in code), so "no such
 * namespace exists" is the same fact on every instance this member can be bound to. A COPY, because a fleet member
 * cannot import the plane; pinned to the plane's gate by the suites (R44) and by control-plane (N402). */
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/** R4: the namespaces this member names to the plane, exactly these two.
 *  @type {readonly string[]} */
/**
 * The shell's own pieces (`agent-worker`'s index.mjs) each path's handler takes as `deps`: one route to the plane, one
 * refusal helper, one account judgement, the model's conversation and the readiness of the member's assistant.
 * @typedef {Object} RouteDeps
 * @property {(code: string, detail: any, status: number, extra?: any) => Response} refusal a refusal answer
 * @property {(obj: any, status?: number) => Response} json a JSON answer
 * @property {any} askPlane one call to the plane under a grant
 * @property {any} planeAnswer the plane's answer read
 * @property {any} publishedPack the published skill pack read
 * @property {any} accountOf the account that serves the member's act
 * @property {any} cascadeToken the token of that account
 * @property {any} modelHalf the model half of a mode
 * @property {any} loadableLayers the pack's layers that may be loaded
 * @property {any} loadLayer one layer loaded
 * @property {any} converse `agent-model`'s conversation
 * @property {any} segmentMeter the meter of a run's segments
 * @property {readonly string[]} NAMESPACES the plane's namespaces
 * @property {number} DEFAULT_MAX_SEGMENT_BYTES
 * @property {any} assistantReady whether the member's assistant may be taken: null, or the refusal to answer
 * @property {() => number} [now] the clock, in milliseconds
 * @property {(line: string) => void} [log] where a log line is written
 * @property {() => string} [mint] a new trace
 */
/**
 * A tool the model is offered, as the Messages API takes it.
 * @typedef {Object} ModelTool
 * @property {string} name
 * @property {string} description
 * @property {Object<string, any>} input_schema a JSON Schema of the tool's input
 */
/**
 * One turn of a conversation, as the Messages API takes it.
 * @typedef {Object} ModelTurn
 * @property {string} role `user` or `assistant`
 * @property {any[]} content its blocks
 */

export const NAMESPACES = Object.freeze(["bio", "scratch"]);

/* R37, R53 — THE OPS A RUN'S ROWS MAY NAME, AND WHY EACH ONE IS HERE. QUERY, NEVER LOAD (§14b.1): no op here returns
 * document bytes, and the suites assert that over the set itself. */
/**
 * An op this member declares: whether it writes, and why this member calls it.
 * @typedef {Object} DeclaredOp
 * @property {boolean} mutating true for a write
 * @property {string} why the reason, in words
 */
/** R37, R53: the ops a run's rows may name, each with whether it writes and why; none returns document bytes.
 *  @bound every member: query, never load; no op returns document bytes */
export const PLANE_OPS = {
  "whoami":         { mutating: false, why: "who the plane says this credential is (FL-2's round trip, kept)" },
  "airun":          { mutating: false, why: "the run object: its conditions, its live budget" },
  "airunlog":       { mutating: false, why: "§14b.7 — a RESUMED run reads its own log and continues" },
  "airunspawn":     { mutating: false, why: localize("agent-worker.ops.pl_12s_spawn_payload_the", "PL-12's spawn payload; the search half has no manifest field to read") },
  "meaningrows":    { mutating: false, why: "PL-9 / D-222 option C — the meaning-grain read. CONSUMED, never rebuilt" },
  "basisversions":  { mutating: false, why: localize("agent-worker.ops.pl_1s_version_set_what", "PL-1's version set — what DEDUP compares against, read before any write") },
  "search":         { mutating: false, why: "D-220 — which held record a citation names, and the source address its bytes name" },
  "versionchain":   { mutating: false, why: "D-220 / PL-10 — every version at that address, so a document is counted ONCE" },
  "agentpack":      { mutating: false, why: "R48 — the rendered skill pack and its fences, read apart from what else the plane publishes, before any model turn (N695)" },
  /* R51, R53 (K660) — MODE `plan`'s reads, under the run's credential and nothing else. Their op names are held in
     `agent-harness`' `PLAN_READS`, beside the rows that call them. */
  "plan":              { mutating: false, why: "R51 — the run's action plan: its subjects, options and proposals (action-plans R6)" },
  "plans":             { mutating: false, why: "R51 — the earlier plans of the SAME project, as the plane answers them (action-plans R7)" },
  "determination":     { mutating: false, why: "R51 — a determined subject's determination (conformance.determinationRead)" },
  "standard":          { mutating: false, why: "R51 — a subject's standard and its text (standards.standardRead)" },
  "consequencesof":    { mutating: false, why: "R51 — the consequences recorded for a determined outcome (consequences)" },
  "availableactions":  { mutating: false, why: "R51 — the actions a determination makes available (filings.availableActions)" },
  "publishededitions": { mutating: false, why: "R51 — a suspected subject's inquiry, as its findings stand published" },
  "profiles":          { mutating: false, why: "R51 — the active jurisdiction profiles (jurisdictions.combine), read once" },
  /* R78 (T45; N887) — a RE-EXAMINATION run's reads (ai-runs R77's `origin: "reexamination"`), besides R51's, and nothing
     else: the recorded response and the procedure guide for its action's kind. */
  "action":            { mutating: false, why: "R78 — the action the recorded response is on: its kind and its correspondence entry (actions' actionRead)" },
  "reading":           { mutating: false, why: "R78 — the response's capture as the plane's readers extracted it, text only (extraction R27)" },
  "procedureguides":   { mutating: false, why: "R78 — the procedure guide for the action's kind, the profile's first (reading-guides.procedureGuidesFor, R13)" },
  "airuntick":      { mutating: true,  why: "log-always and budget spend, through the plane's own producer" },
  "suggest":        { mutating: true,  why: "PL-3 — ONE version, as formed. The only write that reaches the record" },
  "capturerequest": { mutating: true,  why: "PL-4 — the internet level REQUESTS acquisition; it does not perform it" },
  "airunclose":     { mutating: true,  why: "the ordinary exit, naming the bound (C-22.5)" },
  "optionpropose":  { mutating: true,  why: "R52 — mode `plan`'s one write: ONE proposal to the run's plan, as formed (action-plans R11, R31)" },
};

/* R55 (K1450; the canon audit's R37 row) — AN ASK'S WHOLE REACH. Equal to `answers`' `ASK_SCOPE` (its R1) and to
 * `credentials`' `AI_GRANT_OPS` (its R28), both ways, by the suites. Since N580 (K1603, K1609) each entry is the op's
 * name as the plane routes it, `rule` included (`answers`' one door to its rule services), so the three lists are equal
 * with no exception: `career`, `dutyoccurrences`, `linesof`, `structureat`, `dutiesof`, `calculation` and `money` where
 * the old list held `careerof`, `occurrences`, `lines`, `duties`, `calculations` and `moneyfacts` (credentials R28,
 * T34-11, K1764). Every op is a read; none is a `sources*` op, member history, an administrative op or an export. An
 * ask's reach is NOT `PLANE_OPS`: a run's ops are unchanged by it, and a run's credential never reads through this
 * list. */
/** R55: an ask's whole reach, each a read; equal to `answers`' `ASK_SCOPE` and `credentials`' `AI_GRANT_OPS`.
 *  @type {readonly string[]} */
export const ASK_OPS = Object.freeze([
  "calculation", "career", "committedagainstpaid", "dutiesof", "dutyoccurrences", "entity", "entitybyalias",
  "eventsfor", "explore", "frontier", "holderat", "linesof", "meaningrows", "money", "moneyof", "profiles", "relation",
  "resolutions", "rule", "search", "searchfields", "standard", "standardinforce", "standards", "strengthbarof",
  "structureat", "timeline",
]);

/* R54 (K1601 (3), (4)) — THE ASK'S OWN CALLS, which are not reads of the record and so not in `ASK_OPS`: the control
 * plane admits them under a grant beside the grant's list. `askceiling` is asked before any model call (ai-runs R50);
 * `agentpack` carries the pack the ask is instructed by (R48, control-plane R41, no member data); `askcheck` hands the
 * answer to `answers`' checks over the read log the plane holds for the grant (its R4); `askusage` reports each model
 * call's `usage` (ai-runs R48's `countAskUsage`). */
/** R54: the ask's own calls beside its reach, each with whether it writes and why. */
export const ASK_PLANE_OPS = Object.freeze({
  askceiling:  { mutating: false, why: "R54 — the member's use ceiling, before any model call (ai-runs R50)" },
  agentpack:   { mutating: false, why: "R54, R48 — the rendered pack whose `ask` layer instructs the ask" },
  askcheck:    { mutating: false, why: "R54 — answers' checks over the read log the plane holds for the grant (answers R4)" },
  askusage:    { mutating: true,  why: "R54 — each model call's usage, counted for the member (ai-runs R48's countAskUsage)" },
});

/* R72, R73 (N832; K2611) — `POST /transcribe`'s bounds: BOB's figures for the pages one act may send and the model
 * turns one page may take, until M-Q7 and M-Q9 measure them, and the provider's own limit on one picture. Protective
 * limits (K1881): a request past one is refused, never cut. */
/** R72 — at most this many pages per act (K2611).
 *  @type {number} */
export const TRANSCRIBE_PAGES_MAX = 8;
/** R73 — at most this many model turns per page (K2611).
 *  @type {number} */
export const TRANSCRIBE_TURNS = 2;
/** R72 — a page's picture, decoded, at most this many bytes: the Messages API's per-image limit, 5 MB, as Anthropic's
 *  vision documentation states it at T42-20's START (2026-10-11).
 *  @type {number} */
export const TRANSCRIBE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

