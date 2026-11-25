/* store-request R26–R29 (K5162; copies of control-plane's R41, R57, R77, R80, R90, R93, K624): the four door ops whose shaping was the
   control plane's, each a function of what the door hands it (the request, the stamps, the hooks or the object's stub it calls) answering
   the `Response` the door gives today. They read no clock (`at` is handed in), mint no trace (the door's `trace` and `memberRef` are handed
   in) and hold no sentence of their own: the refusals are the owners' as given, and the one sentence read is `setup-words` `word(key)`.
   control-plane's Wave B job deletes its copies and calls these. */
import { json, doAnswer, storeSilent, CHECK_FAMILIES } from "../answer-envelope/index.mjs";
import { tokenRefusedSeen } from "../signin-door/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { machineFences, renderPack } from "../skillpack.mjs";

/** (control-plane R57, R90) The two drafts the object is asked for with no owner before them. */
export const TEXT_CHECK = "textcheck";
export const READ_TRANSLATE = "readtranslate";
/** What the plane's draft answer carries for its own use and never for the member. */
const DRAFT_INTERNAL = Object.freeze(["ok", "grant", "suggestions", "read", "usage", "calls"]);

const unboundRun = (storeName, cls) => json({ ok: false, reason: "AGENT_WORKER_UNBOUND", store: storeName, tokenClass: cls,
  detail: word("refusal.AGENT_WORKER_UNBOUND") }, 503);

/* R41: `fences` and the rendered `pack`, off the untargeted affordances answer; null for an answer that is not `ok: true` with a result */
async function packOf(res) {
  let body;
  try { body = await res.clone().json(); } catch { return null; }
  if (!body || body.ok !== true || !body.result || typeof body.result !== "object" || Array.isArray(body.result)) return null;
  const fences = machineFences(CHECK_FAMILIES);
  let pack = null, absent = null;
  try { pack = renderPack({ ...body.result, fences }); }
  catch (e) { absent = String((e && e.message) || localize("store-request.door_ops.the_pack_could_not_be_rendered", "the pack could not be rendered")).slice(0, 500); }
  return { fences, pack, ...(pack ? {} : { pack_absent: absent }) };
}

/** R26 (was `control-plane` R41): `op=agentpack`. `gatedOp` is the hook the plane composes (asked untargeted, with no body, for `affordances`
 *  and every stamp the door holds: `stamps` = `{env, cls, viaSession, sessMember, sessViewer, sessIdentity, sessRights, sessCaps, aiCred,
 *  aiViewer, storeName, stub, grantMember}`); a refusal or a silence is answered as that handler gives it. */
export async function agentPackOp({ url, headers, gatedOp, stamps }) {
  const { storeName, cls } = stamps;
  const u = new URL(url);
  u.searchParams.set("op", "affordances");
  u.searchParams.delete("target");
  const res = gatedOp ? await gatedOp({ req: new Request(u, { method: "GET", headers }), url: u, op: "affordances", ...stamps }) : undefined;
  if (!res) return storeSilent("agentpack");
  const served = await packOf(res);
  if (!served) return res;
  return json({ ok: true, ...served, store: storeName, tokenClass: cls }, 200);
}

/** R27 (was `control-plane` R77, R80, R93): `op=airundispatch`. `who` is the viewer a session's, else the actor; `at` the door's instant;
 *  `trace` and `memberRef` the door's. A store without `dispatchMemberRun` answers `AGENT_WORKER_UNBOUND`. */
export async function airunDispatchOp({ stub, reqBody, who, at, trace, memberRef, storeName, cls }) {
  const op = "airundispatch";
  if (typeof stub.dispatchMemberRun !== "function") return unboundRun(storeName, cls);
  const run = reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) && typeof reqBody.run === "string" ? reqBody.run : null;
  let out;
  try { out = await stub.dispatchMemberRun({ run, by: who, viewer: who, at, trace, memberRef }); } catch { return storeSilent(op); }
  if (!out || typeof out !== "object" || Array.isArray(out)) return storeSilent(op);
  if (typeof out.code === "string")
    return json({ ok: true, result: { ok: false, reason: out.code, ...out }, store: storeName, tokenClass: cls },
                out.code === "AI_RUN_NOT_PRINCIPAL" || out.code === "MEMBER_RUN_MODE_NOT_ADMITTED" ? 403 : 400);
  return json({ ok: true, result: out, store: storeName, tokenClass: cls }, 200);
}

/* (T46; N897 (2)) `{untested}` when the plane's draft answer carries the label, else nothing */
const untestedOf = (drafted) => {
  const u = drafted && typeof drafted === "object" ? drafted.untested : undefined;
  return u && typeof u === "object" && !Array.isArray(u) ? { untested: u } : {};
};

/** R28 (was `control-plane` R57, R90, R93; `draft.mjs` `checkedDraft`'s two arms): `op=textcheck` and `op=readtranslate`, a draft with no owner
 *  before it. Only a member's session asks (`viaSession`); the object's `draft` is asked with the body's `text`, or `subject` and `language`
 *  alone. `session` is the presented session token, `by` the stamp `tokenRefusedSeen` names, `viewer` the session's viewer (the day the
 *  draft is counted to), `store(path, init)` the store's answered call (`doAnswer` over the object). */
export async function draftCheckOp({ op, stub, viaSession, sessMember, session, reqBody, trace, memberRef, by, viewer, store, storeName, cls }) {
  if (!viaSession || typeof stub.draft !== "function") return unboundRun(storeName, cls);
  const asked = reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) ? reqBody : {};
  const ask = op === TEXT_CHECK
    ? { op, member: sessMember, session, text: asked.text ?? null, trace, memberRef }
    : { op, member: sessMember, session, subject: asked.subject ?? null, language: asked.language ?? null, trace, memberRef };
  const res = await stub.draft(ask);
  let drafted = null;
  try { drafted = await res.json(); } catch { drafted = null; }
  if (!drafted || typeof drafted !== "object") return storeSilent(op);
  await tokenRefusedSeen({ member: by, answer: drafted, store });
  if (drafted.ok === true)
    await doAnswer(stub.fetch(new Request(`http://do/askusage?viewer=${encodeURIComponent(viewer)}`, { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "draft", usage: drafted.usage ?? null, calls: drafted.calls }) })));
  let shaped;
  if (drafted.ok !== true) {
    const { grant: _g, ...given } = drafted;
    shaped = { status: res.status >= 400 ? res.status : 502, body: { ok: false, ...given } };
  } else if (op === READ_TRANSLATE) {
    shaped = { status: 200, body: { ok: true, ...Object.fromEntries(Object.entries(drafted).filter(([k]) => !DRAFT_INTERNAL.includes(k))) } };
  } else {
    shaped = { status: 200, body: { ok: true, draft: drafted.draft ?? null, label: drafted.label ?? null, ...untestedOf(drafted) } };
  }
  return shaped.body.ok === true ? json({ ok: true, result: shaped.body, store: storeName, tokenClass: cls }, 200)
    : json({ ...shaped.body, store: storeName, tokenClass: cls }, shaped.status);
}
