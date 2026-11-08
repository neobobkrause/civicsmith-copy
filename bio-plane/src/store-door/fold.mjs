/* store-door R20, R21 (T53; N1264, K4599 (a); `platform/combined-read-and-fold-draft.md` PL14, PL15; admission R34, R35):
   THE FOLD. The room's RPC `admitted(op, request)` resolves the session, judges admission, stamps and runs the op in one
   call, so a request a member's session makes crosses from the Worker to the room once: the session row is read in the
   room, `admission.admit` judges it with that row as `held` (its R34: no second session read, every refusal and its
   order as at the door), the composition root's stamper (`store-request`'s `innerRequest`, handed in as `stamp`: that
   module is composed after this one) makes the store's request from the admitted caller, and this module's `dispatch`
   runs it, all in the room. Every store ask admission makes on the way (the session, `reauthdue`) is answered by this
   room's own `dispatch`, never by a fetch out of it. A bearer (no session, a binding token, an `aik-` credential, a
   grant) is judged at the door as before (admission R35, `judgedInRoom`): the fold answers `{atDoor: true}` for it
   and reads nothing.

   `screenread` (surface-declarations R11; op-declarations' `SCREENREAD`) runs its waves inside the same call (R20): each
   read judged by `admit` with the same held row (a read refused answers its refusal, the others still answer), stamped
   and run here; a read that runs past its declared bound is cut (R21): it is answered `slow` with the bound, and the
   other reads of the wave are not held for it. The answer is op-declarations' `screenReadOf`, handed in as `answerOf`
   with the bounds as `boundOf`. The Durable Object's RPC method that calls `admitted` is `plane`'s, the door's call of
   it `control-plane`'s; this module states what one call does. */
import { admit, judgedInRoom, presentedCredential, bearerFence } from "../admission/index.mjs";
import { doAnswer } from "../answer-envelope/index.mjs";
import { localize } from "../setup-words/index.mjs";
import { dispatch, SESSION_HEADER } from "./dispatch.mjs";

export const SCREENREAD_OP = "screenread";

const clock = () => (typeof performance === "object" && performance && typeof performance.now === "function" ? performance.now() : Date.now());
const wholeMs = (ms) => Math.max(0, Math.round(ms));

/* The room as admission's env sees it: every store admission names (`bio`, its only room for a session's questions) is
   this room, answered by `dispatch` in-process. Every other binding is the Worker's own, unchanged. */
function roomEnv(env, store) {
  const stub = Object.freeze({ fetch: (req) => dispatch(req, store) });
  const ns = { idFromName: (name) => name, get: () => stub, jurisdiction: () => ns };
  return { ...(env || {}), STORE: ns };
}

/* The request's body, read once: its text (handed to the stamper as the door read it) and, when it is JSON of an
   object, the object (admission's `body`). Never throws. */
async function bodyOf(request) {
  if (!request || request.method !== "POST") return { text: undefined, json: null };
  let text;
  try { text = await request.text(); } catch { text = undefined; }
  let json = null;
  if (typeof text === "string" && text.trim() !== "") {
    try { const v = JSON.parse(text); json = v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { json = null; }
  }
  return { text: text === "" ? undefined : text, json };
}

/* The session row this room holds for the token, as credentials' `session` answers it (null for none), read once, in
   the room, as no activity when the request is the page's own timer's. `{held}` or `{silent}`. */
async function heldRow(token, store, background) {
  const out = await doAnswer(dispatch(new Request(`http://do/session${background ? "?background=1" : ""}`,
    { method: "GET", headers: { [SESSION_HEADER]: token } }), store));
  if (!out.answered) return { silent: { op: "session", ...(out.correlation ? { correlation: out.correlation } : {}) } };
  const s = out.result?.session;
  return { held: s && typeof s === "object" && !Array.isArray(s) ? s : null };
}

/* One op, admitted with the held row and run in the room. `{refusal}`, `{silent}`, or `{caller, answer}` (`answer` the
   store's Response; absent when `run` is false). */
async function admitAndRun({ op, url, method, text, json, spec, credential, held, env, store, stamp, background, run, extra }) {
  if (!spec) return { refusal: { status: 400, body: { ok: false, error: "unknown op: " + op } } };
  let caller = null;
  if (spec.classes !== null) {
    const a = await admit({ url, env, op, spec, method, presented: { cred: null }, doAnswer, credential, body: json,
                            background, held });
    if (a.silent) return { silent: a.silent };
    if (a.refusal) return { refusal: a.refusal };
    const fenced = bearerFence(op, a.caller);
    if (fenced) return { refusal: fenced };
    caller = { ...a.caller, token: credential.token };
  }
  if (run === false) return { caller };
  const inner = stamp({ op, url, method, body: text, caller, ...(extra || {}) });
  if (!inner || inner.refusal) return { refusal: inner?.refusal ?? { status: 500, body: { ok: false, reason: "STORE_REQUEST_FAILED", op } } };
  const init = { method, headers: inner.headers || {} };
  if (inner.body !== undefined && method !== "GET" && method !== "HEAD") init.body = inner.body;
  return { caller, answer: await dispatch(new Request(String(inner.url), init), store) };
}

/* R21: a promise answered within `ms`, else `undefined` (the read is cut; nothing waits on it any longer) */
function within(promise, ms) {
  let timer;
  const cut = new Promise((resolve) => { timer = setTimeout(() => resolve(undefined), ms); });
  return Promise.race([Promise.resolve(promise).catch(() => undefined), cut]).finally(() => clearTimeout(timer));
}

/* R21 (PL15): THE WAVES OF A COMBINED READ, each read run by `runRead(read, args)` (answering `{ok, status, body |
   refusal}`), raced against its declared bound `boundOf(op)`: a read past its bound has no outcome and is answered
   `slow` with the bound by `answerOf` (op-declarations' `screenReadOf`), and the other reads of its wave are not held.
   A later wave's argument `{from: <read>}` takes that read's answered body (`null` when it was refused or cut). Answers
   `{answer, times}`: `answerOf`'s answer, and each answered read's own milliseconds by name. Never throws for a read. */
export async function runWaves(reads, { runRead, boundOf, answerOf, stamps = {}, now = clock } = {}) {
  const outcomes = {}, times = {};
  const waves = [...new Set(reads.map((r) => r.wave))].sort((a, b) => a - b);
  for (const w of waves) {
    await Promise.all(reads.filter((r) => r.wave === w).map(async (r) => {
      const args = {};
      for (const [k, v] of Object.entries(r.args || {}))
        args[k] = v && typeof v === "object" && Object.hasOwn(v, "from") ? (outcomes[v.from]?.ok ? outcomes[v.from].body : null) : v;
      const t0 = now();
      const got = await within(runRead(r, args), boundOf(r.op));
      if (got === undefined) return;
      const ms = wholeMs(now() - t0);
      times[r.name] = ms;
      outcomes[r.name] = { ...got, ms };
    }));
  }
  return { answer: answerOf(reads, outcomes, stamps), times };
}

/* R20: the address a read of a combined answer is asked at: the page's own address with the op and the read's
   arguments (a list or object as JSON), the screen's own parameters removed */
function readUrl(url, op, args) {
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) u.searchParams.delete(k);
  u.searchParams.set("op", op);
  for (const [k, v] of Object.entries(args || {})) {
    if (v === null || v === undefined) continue;
    u.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return u;
}
async function readOutcome(res) {
  const out = await doAnswer(res);
  if (out.answered) return { ok: true, status: 200, body: out.result };
  if (out.refused) return { ok: false, status: out.reply.status, refusal: out.reply.body };
  return { ok: false, status: 502, refusal: { ok: false, reason: "STORE_DID_NOT_ANSWER" } };
}

/* R20 (PL14): THE ROOM'S RPC. `op` the op's name after alias resolution; `request` the page's request (its address, its
   method, its `Authorization` and its body); handed by the composition root: `store` (this room's `{routes, membership,
   logRead}`, as `dispatch` takes it), `env` (the Worker's bindings, for admission's binding comparison), `specOf(op)` the
   op's declared spec (`op-declarations`' `OPS`, `SCREENREAD` for `screenread`), `stamp` (`store-request`'s
   `innerRequest`), and for `screenread` `screens(screen)` (the screen's declared reads, `declareScreenReads`' answer, or
   none), `boundOf` and `answerOf`. `background` is the door's mark of the page's own timer (admission R27); `run: false`
   admits and answers the caller only, for an op the door answers from the caller itself (`whoami`); `extra` is what the
   door hands the stamper beside the caller (`source`, `country`, ...).
   Answers `{atDoor: true}` for a bearer (nothing read); `{silent}` when the room could not read the session; `{refusal,
   in_ms}` as admission or the stamper refuses; else `{caller, answer, in_ms}`, `answer` the store's Response (`screenread`:
   a Response of `{ok: true, result}`, `result` the combined answer) and, for `screenread`, `times`, each read's
   milliseconds. `in_ms` is the whole milliseconds this call spent in the room. */
export async function admitted(op, request, { store, env = {}, specOf, stamp, screens = null, boundOf = null, answerOf = null,
                                             background = false, run = true, extra = null, now = clock } = {}) {
  const t0 = now();
  const url = new URL(request.url);
  const { text, json } = await bodyOf(request);
  const spec = typeof specOf === "function" ? specOf(op) : undefined;
  const credential = presentedCredential({ req: request, url, body: json });
  const room = roomEnv(env, store);
  const done = (out) => ({ ...out, in_ms: wholeMs(now() - t0) });
  /* a public op is the room's to run with no session at all; a session's op is judged here; a bearer at the door */
  const isPublic = !!spec && spec.classes === null;
  if (!isPublic && !(await judgedInRoom(credential, env))) return { atDoor: true };
  let held = null;
  if (!isPublic) {
    const h = await heldRow(credential.token, store, background === true);
    if (h.silent) return { silent: h.silent };
    held = h.held;
  }
  const common = { method: request.method, credential, held, env: room, store, stamp, background: background === true, extra };
  if (op !== SCREENREAD_OP) {
    const one = await admitAndRun({ ...common, op, url, text, json, spec, run });
    return one.silent ? { silent: one.silent } : done(one);
  }
  /* screenread: admitted as itself first, then its waves, each read judged as its own op with the same held row */
  const self = await admitAndRun({ ...common, op, url, text, json, spec, run: false });
  if (self.silent) return { silent: self.silent };
  if (self.refusal) return done({ refusal: self.refusal });
  const screen = json?.screen ?? url.searchParams.get("screen");
  const reads = typeof screens === "function" && typeof screen === "string" ? screens(screen) : null;
  if (!Array.isArray(reads))
    return done({ refusal: { status: 400, body: { ok: false, reason: "UNKNOWN_SCREEN", screen: typeof screen === "string" ? screen : null,
      detail: localize("store-door.fold.unknown_screen", "this screen declares no reads, so nothing was read; the screen asks for each of its reads on its own") } } });
  const runRead = async (r, args) => {
    const one = await admitAndRun({ ...common, method: "GET", op: r.op, url: readUrl(url, r.op, args), text: undefined, json: null,
                                    spec: specOf(r.op), run: true });
    if (one.silent) return { ok: false, status: 502, refusal: { ok: false, reason: "STORE_DID_NOT_ANSWER", op: one.silent.op } };
    if (one.refusal) return { ok: false, status: one.refusal.status, refusal: one.refusal.body };
    return readOutcome(one.answer);
  };
  const { answer, times } = await runWaves(reads, { runRead, boundOf, answerOf, now,
                                                   stamps: self.caller ? { viewer: self.caller.viewer } : {} });
  return done({ caller: self.caller, answer: Response.json({ ok: true, result: answer }), times });
}

/* R20 (control-plane R121 stands): the `Server-Timing` entries the door reports for a folded call: `do-<route>` the whole
   call as the door timed it, `in-<route>` the room's `in_ms`, and for a combined read `in-<route>-<read>` each read's
   own. Names are token characters only; a value that is not a finite number is left out. */
export function serverTimingOf(route, { do_ms = null, in_ms = null, times = null } = {}) {
  const tok = (s) => String(s).replace(/[^A-Za-z0-9_.-]/g, "_");
  const out = [];
  const add = (name, ms) => { if (Number.isFinite(ms)) out.push(`${tok(name)};dur=${wholeMs(ms)}`); };
  add(`do-${route}`, do_ms);
  add(`in-${route}`, in_ms);
  for (const [name, ms] of Object.entries(times || {})) add(`in-${route}-${name}`, ms);
  return out.join(", ");
}
