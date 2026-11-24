/* The seeds of the `members` tests over the world (store-request's `storeWorld`): the team the roster tests read, made by the real
   acts, and what no act can make (a fault, a roster the owner never lists, a legacy row). Nothing here answers an op of another module. */
import { storeWorld } from "../store-request/fixtures.mjs";
import { env, refuse } from "./fixtures.mjs";

export const DAY = 24 * 3600 * 1000;
const JSON_POST = { method: "POST", headers: { "content-type": "application/json" } };

/** A public key line's base64 field, as a member pastes it (`ssh-ed25519 <this> comment`): `tag` makes it distinct. */
export const key = (tag) => "AAAAC3NzaC1lZDI1NTE5AAAAI" + String(tag).padEnd(40, "0");
export const KEYS = Object.freeze({ founder: key("F"), rosa: key("R"), lu: key("L"), dev: key("D"), devOld: key("X") });

/** An act made as the page's door would carry it, answered whatever the owner says (the world's `act` throws on a refusal). Answers the
 *  owner's `result`. */
export async function attempt(w, as, op, { query = {}, body } = {}) {
  const a = await w.door({ url: `/api/?${new URLSearchParams({ op, ...query })}`, init: body === undefined ? { method: "GET" } : { ...JSON_POST, body: JSON.stringify(body) } }, as);
  return a.json && a.json.result !== undefined ? a.json.result : a.json;
}
/** The password asked again, as the page's re-ask does (changing administrators asks for it, `REAUTH_DUE` otherwise). */
export const reauth = (as) => as.act("reauth", { body: { password: as.password } });

/** The world's door recording each answer the page received: `answers` lists `{op, query, body, answer}` in order (the page's act answers are
 *  not kept by the harness); `world` is what `open` takes. */
export function recorded(w) {
  const answers = [];
  const world = Object.create(w, { boot: { value: (as) => {
    const b = w.boot(as);
    return { session: b.session, door: async (req) => {
      const a = await b.door(req);
      answers.push({ op: req.op, query: req.query, body: req.body, answer: a && a.json && a.json.result !== undefined ? a.json.result : a && a.json });
      return a;
    } };
  } } });
  const last = (op) => { const x = answers.filter((r) => r.op === op); return x.length ? x[x.length - 1].answer : undefined; };
  return { world, answers, last };
}

/** A member who joined under an id other than the handle she chose: `memberadd` under `memberId`, her `enroll` as `handle`, `login`. */
export async function joined(w, founder, { memberId, handle, cover }) {
  const added = await founder.act("memberadd", { body: { memberId, cover, capabilities: ["contribute"] } });
  const password = `${handle}-world-passphrase`;
  const enrolled = await attempt(w, null, "enroll", { body: { invite: added.invite, handle, password } });
  if (!enrolled || enrolled.ok === false) throw new Error("seed-members: enroll refused: " + JSON.stringify(enrolled).slice(0, 300));
  const signed = await attempt(w, null, "login", { body: { handle, password, device: "own" } });
  const me = { handle, member: memberId, token: signed.token, password };
  me.act = async (op, { query = {}, body = {} } = {}) => {
    const r = await attempt(w, me, op, { query, body });
    if (r && r.ok === false) throw new Error(`seed-members: ${op} was refused: ${JSON.stringify(r).slice(0, 300)}`);
    return r;
  };
  return me;
}

/** A claimed world: the founder holding the handle `founder`, or (the default) none, as a founder holds none until she chooses one
 *  (membership R144): the claim made by the real `claim` with no handle. */
export async function claimed(named) {
  if (named) return storeWorld();
  const w = await storeWorld({ claimed: false });
  await w.claim({ password: "a-long-founder-passphrase-1" });
  return w;
}

/** A team of the roster the screen shows: the founder (no handle, or `founder` when `named`), two more active administrators (rosa and lu), dev (who may
 *  contribute), ana (who declared CPA), kim (an administrator proposed, whom the others have yet to endorse), old (revoked) and mai-k
 *  (invited, not enrolled), all made by the real acts. The founder and the administrators may each act. */
export async function team({ named = false } = {}) {
  const w = await claimed(named);
  const founder = await w.signIn(named ? "founder" : "admin");
  const rosa = await w.signIn("rosa", { admin: true });
  const lu = await w.signIn("lu", { admin: true });
  const dev = await w.signIn("dev", { capabilities: ["contribute"] });
  const ana = await w.signIn("ana", { capabilities: ["contribute"] });
  await ana.act("expertisedeclare", { body: { label: "CPA" } });
  await w.signIn("old", { capabilities: ["contribute"] });
  await founder.act("memberset", { body: { memberId: "old", status: "revoked" } });
  await founder.act("memberadd", { body: { memberId: "mai-k", cover: "Mai K., from the Seminary Ave block", capabilities: ["contribute"] } });
  // a fourth administrator is proposed by rosa: her endorsement is recorded and the founder and lu are awaited
  await reauth(rosa);
  const proposed = await attempt(w, rosa, "memberadd", { body: { memberId: "kim", cover: "Kim", role: "admin", capabilities: ["contribute"] } });
  if (!proposed || proposed.reason !== "CONSENSUS_REQUIRED") throw new Error("seed-members: kim was not proposed: " + JSON.stringify(proposed).slice(0, 300));
  return { w, founder, rosa, lu, dev, ana };
}

/** The members' signing keys, by the real acts: the founder's and rosa's own, one rosa registered for lu a day later, dev's own, and an
 *  older one of dev's that rosa withdrew a day after that. Ana has none. */
export async function keyed(t) {
  const { w } = t;
  const own = (as, k, comment) => as.act("signerregisterown", { body: { keyB64: k, ...(comment ? { comment } : {}) } });
  await own(t.dev, KEYS.devOld, "old phone");
  await own(t.founder, KEYS.founder);
  await own(t.rosa, KEYS.rosa, "laptop");
  // a day passes and the sessions are made again (a session does not outlive it)
  w.tick(DAY);
  delete w.__founderSession;   // `signIn` keeps the founder's session it made for adding members; a day has made it stale
  const rosa = await w.signIn("rosa"), dev = await w.signIn("dev");
  await rosa.act("signeradd", { body: { memberId: "lu", keyB64: KEYS.lu } });
  await own(dev, KEYS.dev);
  w.tick(DAY);
  delete w.__founderSession;   // `signIn` keeps the founder's session it made for adding members; a day has made it stale
  const again = await w.signIn("rosa");
  await again.act("signerset", { body: { keyB64: KEYS.devOld, status: "revoked" } });
  return refreshed(t);
}
/** The team's sessions made again, after the clock moved. */
async function refreshed(t) {
  const out = { w: t.w };
  out.founder = await t.w.signIn(t.founder.handle);
  for (const h of ["rosa", "lu", "dev", "ana"]) out[h] = await t.w.signIn(h);
  return out;
}

/** A removal under way: rosa has voted to remove lu, which three administrators need two votes to carry (the founder is awaited). */
export async function removing(t) {
  await reauth(t.rosa);
  const voted = await attempt(t.w, t.rosa, "adminremove", { body: { memberId: "lu", reason: "moved away" } });
  if (!voted || voted.reason !== "VOTES_SHORT") throw new Error("seed-members: the vote was not recorded: " + JSON.stringify(voted).slice(0, 300));
  return t;
}

/** A team of `n` administrators (the founder, rosa, lu, ...) and no one else. */
export async function admins(n, { named = false } = {}) {
  const w = await claimed(named);
  const founder = await w.signIn(named ? "founder" : "admin");
  const all = [founder];
  for (const h of ["rosa", "lu", "ana2", "ana3", "ana4", "ana5"].slice(0, n - 1)) all.push(await w.signIn(h, { admin: true }));
  return { w, founder, all };
}

/* ---- what no act makes ---- */

/** A roster the owner would not list (an empty one; a claimed team without its founder's row; fewer administrators than are counted): the real
 *  rows `rows`, as the screen reads them from `memberlist`. */
export const rosterOf = (rows) => ({ memberlist: env({ members: rows }) });
export const EMPTY_ROSTER = rosterOf([]);
/** The same roster as the owner answered it, without the founder's row (an unclaimed team lists none). */
export const withoutFounder = (rows) => rows.filter((m) => !(m.member_id === "admin" || m.founder === true));
/** The faults: a read that never answers, one the store did not answer, and the arithmetic an administrator is refused. */
export const WAITING = (op) => ({ [op]: "pending" });
export const SILENT = (op) => ({ [op]: "none" });
export const ARITH_REFUSED = { adminarith: refuse("NOT_AN_ADMIN") };

/** A key list in which a key of an active member is shown withdrawn by a member who has left (credentials R7 refuses the reactivation): the
 *  owner's own rows, one changed; the roster lists only active members, so no act makes the two disagree. */
export const keysOfAMemberWhoLeft = (signers, keyB64) => ({
  signerlist: env({ signers: signers.map((k) => (k.key_b64 === keyB64 ? { ...k, member_status: "revoked", attests_why: "member_revoked" } : k)) }),
});

/** Rows written before the registrar and the instant were kept (credentials R21): a NULL registrar, a NULL status author and instant; `''` for
 *  a registration instant the store did not keep (its column is not null). `w.sql` seeds them: no act writes a key without who made it. */
export function legacyKeys(w, { unregistered, unattributed, undated }) {
  w.sql.exec("UPDATE signers SET registered_by = NULL WHERE key_b64 = ?", unregistered);
  w.sql.exec("UPDATE signers SET status_by = NULL, status_at = NULL WHERE key_b64 = ?", unattributed);
  w.sql.exec("UPDATE signers SET registered_by = NULL, added = '' WHERE key_b64 = ?", undated);
}
/** Keys registered or withdrawn by a member the roster does not hold (`ghost-7`) or who has no handle yet (`mai-k`): `w.sql` seeds the
 *  actors; no act registers a key as a member that is not there. */
export function strangersKeys(w, { registeredBy, withdrawnBy }) {
  w.sql.exec("UPDATE signers SET registered_by = 'ghost-7', status_by = 'ghost-7' WHERE key_b64 = ?", registeredBy);
  w.sql.exec("UPDATE signers SET status_by = 'mai-k' WHERE key_b64 = ?", withdrawnBy);
}
/** A removal under way voted by a member the roster does not hold and awaiting one with no handle: the owner's shape, as no act can vote
 *  for an id that is not an administrator. */
const strangersVote = env({ ok: true, removals: [{ target: "lu", voters: [{ voter: "ghost-7", at: "2026-10-14T00:00:00Z" }], awaiting: ["mai-k"], have: 1, need: 2 }] });
export const removalByStrangers = { adminremovalsopen: strangersVote };
