/* R7, R8, R9, R43, R44: what the install asks the account before it creates anything: whether a script is there, the plan,
 * whether storage is on, the buckets and the workers.dev address. */
import { cf, special } from "./api.mjs";
import { uploadForm } from "./bytes.mjs";
/** @import { Session, Names, Lasting, ApproveAgain } from './api.mjs' */

/**
 * Whether the script's settings answer: false only on a 404 (R8).
 * @param {Session} token
 * @param {string} acct the account id
 * @param {string} slug the script's name
 * @returns {Promise<boolean>}
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 * @throws {Error} on any other failure than a 404: a lookup that fails is not a lookup that found nothing
 */
async function scriptExists(token, acct, slug) {
  try { await cf(token, `/accounts/${acct}/workers/scripts/${slug}/settings`); return true; }
  catch (e) { if (e.status === 404) return false; throw e; }
}

/* DIST-3 / DEC-42: Workers Paid IS a requirement, and the plan is established
   by PROVOKING the platform, never by reading a plan field — a field is a
   claim, a refusal is a measurement (the 2026-07-31 BOB session measured the
   provocation and free-tier-fleet-probe.mjs reproduces it). A PUT carrying
   `limits.cpu_ms` is refused on Free with code 100328 and accepted on Paid.
   The probe script is a throwaway with a fixed recognisable name, deleted on
   the spot; a fixed name means a re-run converges on any leftover instead of
   accumulating strays. Three honest answers and no fourth: "free", "paid",
   or "unknown" with the reason — an unverified plan is not a verified one. */
/** @type {string} */
const PLAN_PROBE = "bio-plan-probe";
/**
 * The plan, found by provoking the platform: "free" on code 100328, "unknown" with the platform's message on any other
 * failure, else "paid" with `leftover` true when the probe could not be deleted.
 * @param {Session} token
 * @param {string} acct the account id
 * @returns {Promise<{plan: string, detail?: string, leftover?: boolean}>}
 */
async function establishPlan(token, acct) {
  const meta = { main_module: "index.mjs", compatibility_date: "2026-07-01",
                 limits: { cpu_ms: 50000 } };
  const src = 'export default { async fetch() { return new Response("bio plan probe"); } };';
  try {
    await cf(token, `/accounts/${acct}/workers/scripts/${PLAN_PROBE}`,
      { method: "PUT", body: uploadForm(meta, src) });
  } catch (e) {
    if (e.code === 100328) return { plan: "free" };
    return { plan: "unknown", detail: e.message };
  }
  let leftover = false;
  try { await cf(token, `/accounts/${acct}/workers/scripts/${PLAN_PROBE}?force=true`,
    { method: "DELETE" }); }
  catch { leftover = true; /* stated to the operator, not swallowed */ }
  return { plan: "paid", leftover };
}

/* R43: whether the account may use R2 at all, asked by a read that creates nothing. Cloudflare's R2 error table gives 10042 for an
   account not entitled to the feature (403; measured on the rehearsal account, K4970) and 10073 for a bucket that already
   exists. Codes are matched, never words. */
const R2_NOT_ENTITLED = 10042, R2_BUCKET_CONFLICT = 10073;
/**
 * `state` is "on", "not_entitled", "permission" or "unknown" (with Cloudflare's message in `said`).
 * @param {Session} token
 * @param {string} acct the account id
 * @returns {Promise<{state: string, said?: string}>}
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 */
async function storageEntitlement(token, acct) {
  try { await cf(token, `/accounts/${acct}/r2/buckets`); return { state: "on" }; }
  catch (e) {
    if (special(e)) throw e;
    if (e.code === R2_NOT_ENTITLED) return { state: "not_entitled" };
    if (e.status === 403) return { state: "permission" };
    return { state: "unknown", said: e.message };
  }
}

/* Both buckets or neither: the fence is a pair. R2's BucketConflict (10073) counts as created, so a re-run after a mid-flight
   failure converges instead of failing on its own earlier success. The names are the copy's own (R2, `namesFor`). Returns the
   buckets that were already there (R6: what an earlier run left). */
/**
 * @param {Session} token
 * @param {string} acct the account id
 * @param {Names} names the copy's names
 * @returns {Promise<string[]>} the buckets that were already there
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 * @throws {Error} on a refused creation other than "already exists"
 */
async function ensureBuckets(token, acct, names) {
  const there = [];
  for (const name of [names.captures, names.published]) {
    try { await cf(token, `/accounts/${acct}/r2/buckets`, { method: "POST", body: JSON.stringify({ name }), idem: true }); }
    catch (e) { if (e.code !== R2_BUCKET_CONFLICT) throw e; there.push(name); }
  }
  return there;
}

/* R44: the workers.dev prefix is the account's and permanent in practice, so the founder chooses it. `addressState` reads it and,
   with none, proposes the copy's slug; it registers nothing. */
async function heldPrefix(token, acct) {
  try { return (await cf(token, `/accounts/${acct}/workers/subdomain`))?.subdomain || null; }
  catch (e) { if (e.status !== 404) throw e; return null; }
}
/**
 * The prefix the account holds (`sub`), or, with none, the slug proposed (`proposed`).
 * @param {Session} token
 * @param {string} acct the account id
 * @param {string} slug
 * @returns {Promise<{sub: string|null, proposed: string|null}>}
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 * @throws {Error} on a failed read other than a 404
 */
async function addressState(token, acct, slug) {
  const sub = await heldPrefix(token, acct);
  return sub ? { sub, proposed: null } : { sub: null, proposed: slug };
}

/* Registers exactly the name the founder chose. Cloudflare offers no availability check; a taken prefix is HTTP 403 with code
   10031, measured on the rehearsal account (K4970), decided by the code and never the words. HTTP 409 stays taken too. A 403
   without that code is a refusal like any other: thrown with Cloudflare's message. */
const SUBDOMAIN_UNAVAILABLE = 10031;
/**
 * @param {Session} token
 * @param {string} acct the account id
 * @param {string} name the prefix the founder chose
 * @returns {Promise<{ok: boolean, taken?: boolean}>} `{ok: true}`, or `{ok: false, taken: true}` when the name is taken
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 * @throws {Error} on any other refusal, with Cloudflare's message
 */
async function registerSubdomain(token, acct, name) {
  try { await cf(token, `/accounts/${acct}/workers/subdomain`, { method: "PUT", body: JSON.stringify({ subdomain: name }) }); }
  catch (e) { if ((e.code === SUBDOMAIN_UNAVAILABLE || e.status === 409) && !special(e)) return { ok: false, taken: true }; throw e; }
  return { ok: true };
}

/* R9 (amended by R44): enables the copy's address on the prefix the account holds and registers nothing; with none held the
   caller has skipped its choice, which is a fault of the caller, not a sentence for the founder. */
/**
 * @param {Session} token
 * @param {string} acct the account id
 * @param {string} slug the copy's script
 * @returns {Promise<{sub: string, registered: null}>}
 * @throws {Error} when the account holds no prefix (`noPrefix: true`), or the enabling is refused
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 */
async function ensureSubdomain(token, acct, slug) {
  const sub = await heldPrefix(token, acct);
  if (!sub) throw Object.assign(new Error("no workers.dev prefix is registered on this account"), { noPrefix: true });
  await cf(token, `/accounts/${acct}/workers/scripts/${slug}/subdomain`,
    { method: "POST", body: JSON.stringify({ enabled: true }) });
  return { sub, registered: null };
}
/* Kept only so the installer, which still imports it, loads until its job (R84) moves to `addressState`; no candidates beyond the slug. */
/**
 * @param {Session} token
 * @param {string} acct the account id
 * @param {string} slug
 * @returns {Promise<{sub: string|null, candidates: string[]}>}
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 * @throws {Error} on a failed read other than a 404
 */
const offerSubdomain = async (token, acct, slug) => {
  const { sub, proposed } = await addressState(token, acct, slug);
  return { sub, candidates: proposed ? [proposed] : [] };
};
export { scriptExists, PLAN_PROBE, establishPlan, storageEntitlement, ensureBuckets, addressState, registerSubdomain, offerSubdomain, ensureSubdomain };
