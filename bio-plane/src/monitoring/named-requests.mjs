/* monitoring — a member's door to a bundle's named requests, their read, and the one writer of `data/gathering.json`
 * (requirements: `build/requirements/monitoring.md`, R75, R76, R77; T51, K4189; UC-034, UC-035; Intake Doctrine §4).
 *
 * Kept apart from `index.mjs` for the module's size (P6): the Monitoring class holds one-line methods that call the
 * functions here with itself, so these read its public parts only (`record`, `membership`, `promotion`, `sql`, `now`,
 * `paused`) and the few helpers `index.mjs` hands them (`h`), and import nothing from `index.mjs`. */

import { stampInstant } from "../record-core/index.mjs";
import { viewerPredicate } from "../membership/index.mjs";
import { parseFrontmatter, createSha256, isMachineIdentity } from "../record-grammar/index.mjs";
import { checkGatheringGrammar, frequencyRefusal, GATHERING_CHECKS } from "./checks.mjs";
import { localize } from "../setup-words/index.mjs";

const GATHERING = "data/gathering.json";
/** R75: the statuses a member sets; `captured` is the daemon's. */
const MEMBER_STATUSES = Object.freeze(["open", "retired"]);
/** R76: the most requests one read answers. */
export const NAMED_REQUESTS_READ_MAX = 1000;

const utf8 = (t) => new TextEncoder().encode(t);
const sha256Of = (t) => createSha256().update(utf8(t)).hex();
const encoded = (t) => ({ text: t, bytes: utf8(t).length, sha256: sha256Of(t) });
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* R1's required-argument refusal, for an op of this file */
const required = (op, argument, shape) => ({ ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape,
  error: `${op} needs ${argument}`,
  detail: `op=${op} needs '${argument}' in the shape ${shape}, and this request carried none the operation could use. Nothing was changed.` });

/* R77: a gathering file that cannot be revised is refused as the write refuses a malformed one (C-18.10) */
const unrevisable = (why) => ({ ok: false, reason: "GATHERING_REFUSED", code: "GATHERING_REFUSED",
  check: GATHERING_CHECKS.GATHERING_REFUSED.check, translation: GATHERING_CHECKS.GATHERING_REFUSED.translation,
  findings: [{ check: "C-18.5", detail: localize("monitoring.named_requests.cannot_be_revised",
    "data/gathering.json {why}, so it cannot be revised. Nothing was written.", { why: String(why) }) }] });

/** R77: the one writer of a bundle's `data/gathering.json`. Reads the held file (absent: `{}`), applies `mutate` to the
 *  parsed object, in place, and writes the object canonically (two-space JSON and a newline) in one promotion authored
 *  by the member, with `log` as its Session Log entry, every other file carried. `mutate` returns the object, or a
 *  refusal (`{ok: false, reason, …}`), which is relayed unchanged with nothing written; it runs inside the same
 *  transaction as the write, so an id it minted is taken back with a refusal. R27's check and the registered sweep fence
 *  run in the promotion (R66) and their refusals are relayed unchanged. An object `mutate` leaves as it found it
 *  answers `{ok: true, existed: true}` and writes nothing. Answers `{ok: true, bundle, revision}`. */
export function writeGathering(m, { bundle = null, mutate = null, author = null, viewer = null, log = null } = {}, h) {
  const op = "gatheringwrite";
  const who = typeof author === "string" ? author.trim() : "";
  if (!who || isMachineIdentity(who)) return required(op, "author", "a named member");
  if (typeof bundle !== "string" || !bundle) return required(op, "bundle", "a non-empty string");
  if (typeof mutate !== "function") return required(op, "mutate", "a function");
  if (typeof log !== "string" || !log.trim()) return required(op, "log", "the Session Log sentence");
  const img = m.membership.inSight(bundle, viewer) ? m.record.readImage(bundle) : null;
  if (!img || typeof img["bundle.md"] !== "string") return { ok: false, reason: "ABSENT", bundleId: bundle };
  const heldText = img[GATHERING];
  let g = {};
  if (heldText !== undefined) {
    if (typeof heldText !== "string") return unrevisable("is not held inline");
    try { g = JSON.parse(heldText); } catch { return unrevisable("is not parsable JSON"); }
    if (!isObject(g)) return unrevisable("is not a JSON object");
  }
  const before = JSON.stringify(g);
  return m.record.transact(() => {
    let next;
    try { next = mutate(g); }
    catch (e) { return { ok: false, reason: "GATHERING_MUTATE_FAILED", detail: String(e && e.message || e).slice(0, 160) }; }
    if (isObject(next) && next.ok === false && typeof next.reason === "string") return next;
    if (!isObject(next)) return { ok: false, reason: "GATHERING_MUTATE_FAILED", detail: "mutate answered no object" };
    const live = img["bundle.md"];
    const head = m.record.head(bundle);
    if (JSON.stringify(next) === before) return { ok: true, existed: true, bundle, revision: head ? head.bundleSha : null };
    const at = stampInstant("second", m.now());
    const fm = parseFrontmatter(live).data || {};
    const member = who.startsWith("member:") ? who.slice("member:".length) : who;
    const md = encoded(h.withSessionEntry(withLastUpdated(live, at), at, log));
    const carried = [];
    for (const [path, v] of Object.entries(img)) {
      if (path === "bundle.md" || path === GATHERING || path.startsWith("_history/")) continue;
      if (typeof v === "string") carried.push({ path, ...encoded(v) });
      else carried.push({ path, blobSha: v.blobSha, sha256: v.sha256, bytes: v.bytes });
    }
    const stamp = at.replace(/[-:]/g, "") + "_"
      + [...crypto.getRandomValues(new Uint8Array(4))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const r = m.promotion.promote({
      bundleId: bundle, base: sha256Of(live), snapKey: stamp, author: who,
      meta: { object_type: fm.object_type, title: fm.title, current_state: fm.current_state,
              prior_state: fm.prior_state ?? null, created: fm.created, last_updated: at },
      files: [{ path: "bundle.md", ...md }, ...carried, { path: GATHERING, ...encoded(`${JSON.stringify(next, null, 2)}\n`) }],
      actorIdentity: who, actorViewer: viewer ?? who, actorMemberId: member });
    if (!r || r.ok !== true) return r && typeof r === "object" ? r
      : { ok: false, reason: null, detail: "the promotion gave no answer. Nothing was written." };
    return { ok: true, bundle, revision: r.bundleSha ?? null };
  });
}

/* the document with its front matter's `last_updated` set to `at`, line by line, so nothing else can move */
function withLastUpdated(text, at) {
  const lines = String(text).split("\n");
  let fence = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "---" && fence < 2) { fence++; continue; }
    if (fence === 1 && /^last_updated:/.test(lines[i])) lines[i] = `last_updated: ${at}`;
  }
  return lines.join("\n");
}

/* R75: the slug a minted id ends in, from the request's words: runs of [a-z0-9] joined by "-", at most 40 characters */
function slugOf(text) {
  const s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
  return s || "request";
}

/** R75: a member plants one named request of a bundle's `data/gathering.json`, or revises one. See the requirement.
 *  `h` is `{withSessionEntry, monitorIntervalMs}` from `index.mjs`. */
export function namedRequestSet(m, a = {}, h) {
  const op = "namedrequestset";
  const { bundle = null, request = null, target, locators, authority, criticality, cadence, status, author = null, viewer = null } = a || {};
  const who = typeof author === "string" ? author.trim() : "";
  /* DEC-49 REGION is-named-request-member */
  if (!who || isMachineIdentity(who))
    return frequencyRefusal("MACHINE_CANNOT_SET_REQUEST", localize("monitoring.named_requests.asked_by_a_named_member",
      "a named request is asked by a named member; a machine may propose a document to gather and never plants a request. Nothing was written."));
  /* END DEC-49 REGION is-named-request-member */
  if (typeof bundle !== "string" || !bundle) return required(op, "bundle", "a non-empty string in the POST body");
  /* R1's fail-closed read: absent and unseen are one answer. */
  const img = m.membership.inSight(bundle, viewer) ? m.record.readImage(bundle) : null;
  if (!img || typeof img["bundle.md"] !== "string") return { ok: false, reason: "ABSENT", bundleId: bundle };
  const at = stampInstant("second", m.now());
  const revising = request !== null && request !== undefined;
  const text = isObject(target) ? target.text : undefined;
  /* the request as the act states it: its known fields only, so a body never carries anything else into the file */
  const stated = {
    id: revising ? request : `GATH-${at.slice(0, 4)}-0000-${slugOf(text)}`,
    target: isObject(target) ? { ...(target.text !== undefined ? { text: target.text } : {}),
                                 ...(target.description !== undefined ? { description: target.description } : {}) } : target,
    locators, authority, criticality, ...(cadence !== undefined ? { cadence } : {}),
    status: status === undefined ? "open" : status, planted: at };
  /* the grammar C-18.5 judges it by, called, not copied (R42), over this one request */
  const findings = [];
  checkGatheringGrammar({ files: new Map([[GATHERING, JSON.stringify({ requests: [stated] })]]) }, findings);
  const named = findings.filter((x) => x.severity === "error").map((x) => ({ check: x.check, detail: x.message }));
  if (!named.length && !MEMBER_STATUSES.includes(stated.status))
    named.push({ check: "C-18.5", detail: localize("monitoring.named_requests.status_is_set_by_member",
      "gathering.json requests[0].status a member sets must be one of: {statuses} (captured is the daemon's)", { statuses: MEMBER_STATUSES.join(", ") }) });
  /* DEC-49 REGION is-named-request-shape */
  if (named.length)
    return frequencyRefusal("NAMED_REQUEST_REFUSED", `${named.map((x) => x.detail).join("; ")}. Nothing was written.`,
      { findings: named });
  /* END DEC-49 REGION is-named-request-shape */
  let result = null;
  const member = who.startsWith("member:") ? who.slice("member:".length) : who;
  const written = writeGathering(m, { bundle, author: who, viewer,
    log: revising
      ? localize("monitoring.named_requests.request_revised_by_member", "Named request {request} revised by {member}: {text} (a member's act; nothing was fetched).",
                 { request: String(request), member: String(member), text: String(text) })
      : localize("monitoring.named_requests.request_planted_by_member", "Named request planted by {member}: {text} (a member's act; nothing was fetched).",
                 { member: String(member), text: String(text) }),
    mutate: (g) => {
      const list = Array.isArray(g.requests) ? g.requests : [];
      const i = revising ? list.findIndex((r) => isObject(r) && r.id === request) : -1;
      if (revising && i < 0)
        return { ok: false, reason: "NO_SUCH_REQUEST", bundleId: bundle, request,
                 detail: localize("monitoring.named_requests.no_such_request_to_revise",
                   "this bundle's data/gathering.json holds no such request to revise. Nothing was written.") };
      const held = i >= 0 ? list[i] : null;
      const id = held ? held.id : `${m.record.allocId("GATH", at.slice(0, 4)).id}-${slugOf(text)}`;
      /* a revision keeps what the act does not state: its status, and the instant it was planted */
      const next = { id, target: stated.target, locators, authority, criticality,
                     ...(cadence !== undefined ? { cadence } : {}),
                     status: status === undefined && held && typeof held.status === "string" ? held.status : stated.status,
                     planted: held && typeof held.planted === "string" ? held.planted : at };
      result = next;
      g.requests = held ? list.map((r, j) => (j === i ? next : r)) : [...list, next];
      return g;
    } }, h);
  if (!written.ok) return written;
  return { ok: true, ...(written.existed ? { existed: true } : {}), bundle, request: result.id, status: result.status,
           ...(written.existed ? {} : { revision: written.revision }) };
}

/** R76: every request of every `data/gathering.json` the viewer may see, with its last attempt and when it is next due.
 *  Writes nothing and never throws. */
export function namedRequests(m, { viewer = null } = {}, h) {
  const nowMs = m.now();
  try {
    const gate = viewerPredicate(viewer);
    const files = [...m.sql.exec(
      `SELECT f.bundle_id AS bundle_id, f.content AS content FROM files f JOIN bundles b ON b.bundle_id = f.bundle_id
        WHERE f.path = 'data/gathering.json' AND (${gate.sql}) ORDER BY f.bundle_id LIMIT ?`,
      ...gate.args, NAMED_REQUESTS_READ_MAX + 1)];
    const lastRun = new Map(), lastNotGoverned = new Map();
    for (const r of m.sql.exec(`SELECT g.bundle_id AS bundle_id, g.request_id AS request_id, g.at AS at, g.outcome AS outcome,
                                       g.locator AS locator
                                  FROM monitor_gathering_run g
                                  JOIN (SELECT bundle_id, request_id, MAX(seq) AS s FROM monitor_gathering_run
                                         GROUP BY bundle_id, request_id) x
                                    ON x.bundle_id = g.bundle_id AND x.request_id = g.request_id AND x.s = g.seq`))
      lastRun.set(`${r.bundle_id}#${r.request_id}`, { at: r.at, outcome: r.outcome, locator: r.locator ?? null });
    for (const r of m.sql.exec(`SELECT bundle_id, request_id, MAX(at) AS at FROM monitor_gathering_run
                                 WHERE outcome <> 'governed' GROUP BY bundle_id, request_id`))
      lastNotGoverned.set(`${r.bundle_id}#${r.request_id}`, r.at);
    const items = [];
    let truncated = files.length > NAMED_REQUESTS_READ_MAX;
    for (const f of files.slice(0, NAMED_REQUESTS_READ_MAX)) {
      let g = null;
      try { g = typeof f.content === "string" ? JSON.parse(f.content) : null; } catch { g = null; }
      if (!isObject(g)) continue;
      const daemon = isObject(g.daemon) ? g.daemon : null;
      for (const r of Array.isArray(g.requests) ? g.requests : []) {
        if (!isObject(r) || typeof r.id !== "string" || !r.id) continue;
        if (items.length >= NAMED_REQUESTS_READ_MAX) { truncated = true; break; }
        const key = `${f.bundle_id}#${r.id}`;
        items.push({ bundle: f.bundle_id, request: r.id, target: isObject(r.target) ? r.target : null,
          locators: Array.isArray(r.locators) ? r.locators : [], authority: r.authority ?? null, criticality: r.criticality ?? null,
          cadence: r.cadence ?? null, status: r.status ?? null, planted: r.planted ?? null,
          last_attempt: lastRun.get(key) ?? null, daemon,
          ...clockOf(r, daemon, lastNotGoverned.get(key) ?? null, nowMs, h) });
      }
    }
    const counts = {};
    for (const x of items) counts[x.state] = (counts[x.state] || 0) + 1;
    return { ok: true, as_of: stampInstant("second", nowMs), paused: m.paused(), items, counts,
             limit: NAMED_REQUESTS_READ_MAX, truncated };
  } catch (e) {
    return { ok: false, reason: null, items: [], counts: {}, limit: NAMED_REQUESTS_READ_MAX, truncated: false,
             detail: localize("monitoring.named_requests.could_not_be_read", "the named requests could not be read: {why}",
                              { why: String(String(e && e.message || e).slice(0, 160)) }) };
  }
}

/* R76, by R28's rule and R14's intervals: whether the request is `due` now, `next` the instant it falls due when it is
   not yet, and its `state`: closed (not open), disabled (the bundle's daemon block), unscheduled (no clock the daemon
   keeps, with the reason), due, scheduled, or done (no cadence: run once, and it has run). */
function clockOf(r, daemon, lastAt, nowMs, h) {
  const none = { due: false, next: null };
  if (r.status !== "open")
    return { ...none, state: "closed", unscheduled: localize("monitoring.named_requests.status_not_open",
      "its status is {status}: the daemon runs only open requests", { status: String(r.status) }) };
  if (daemon && daemon.enabled === false)
    return { ...none, state: "disabled", disabled: localize("monitoring.bundle_daemon_block",
      "its bundle's daemon block says enabled: false, so the daemon runs none of its requests") };
  if (r.cadence === "none")
    return { ...none, state: "unscheduled", unscheduled: localize("monitoring.cadence_none_daemon",
      "its cadence is none: the daemon does not run it") };
  if (lastAt === null) return { due: true, next: null, state: "due" };
  if (r.cadence === undefined || r.cadence === null) return { ...none, state: "done" };
  const iv = h.monitorIntervalMs(r.cadence);
  if (iv === null)
    return { ...none, state: "unscheduled", unscheduled: localize("monitoring.cadence_gives_interval",
      "the cadence '{cadence}' gives no interval", { cadence: String(r.cadence) }) };
  const dueAt = Date.parse(lastAt) + iv;
  return dueAt <= nowMs ? { due: true, next: null, state: "due" }
                        : { due: false, next: stampInstant("second", dueAt), state: "scheduled" };
}
