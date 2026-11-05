/* R7, R8, R9, R43, R44: what the install asks the account before it creates anything: whether a script is there, the plan,
 * whether storage is on, the buckets and the workers.dev address. */
import { cf, special } from "./api.mjs";
import { uploadForm } from "./bytes.mjs";
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { JURISDICTIONS } from "./bindings.mjs";

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
const PLAN_PROBE = "bio-plan-probe";
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
/* R47 (T53; N1273, K5440, K5441): with `opts.jurisdiction` (one of `JURISDICTIONS`, R46) both buckets are created in that
   jurisdiction (Cloudflare's `cf-r2-jurisdiction` header), and a bucket Cloudflare answers as created anywhere else fails the act:
   the caller creates the room only after this, so a refusal leaves no room. A jurisdiction off the list is refused before any
   call. R2's bucket jurisdiction cannot be changed afterwards, so nothing here ever moves one. The coded failures are identifiers
   (K3971); the sentence is a stand-in, `installer.fleet.why.program`, the row owed `installer-steps.storage.jurisdiction`. */
export const BUCKET_JURISDICTION = "BUCKET_JURISDICTION";
const r2Jurisdiction = (j) => {
  if (j == null) return null;
  if (!JURISDICTIONS.includes(j)) throw Object.assign(new Error(word("installer.fleet.why.program")), { code: BUCKET_JURISDICTION, jurisdiction: j });
  return j;
};
/* R47: where an S3 client reads a bucket of the copy: the jurisdiction's own endpoint, or the account's. */
const r2Endpoint = (acct, jurisdiction) => `${acct}.${r2Jurisdiction(jurisdiction) ? `${jurisdiction}.` : ""}r2.cloudflarestorage.com`;
async function ensureBuckets(token, acct, names, opts = {}) {
  const j = r2Jurisdiction(opts.jurisdiction);
  const headers = j ? { "cf-r2-jurisdiction": j } : undefined;
  const there = [];
  for (const name of [names.captures, names.published]) {
    let made;
    try { made = await cf(token, `/accounts/${acct}/r2/buckets`, { method: "POST", body: JSON.stringify({ name }), idem: true, ...(headers ? { headers } : {}) }); }
    catch (e) { if (e.code !== R2_BUCKET_CONFLICT) throw e; there.push(name); continue; }
    /* Cloudflare answers the bucket with its jurisdiction; one stated and not the one asked is a bucket in the wrong place */
    if (j && made && typeof made.jurisdiction === "string" && made.jurisdiction !== j)
      throw Object.assign(new Error(word("installer.fleet.why.program")), { code: BUCKET_JURISDICTION, jurisdiction: j, bucket: name, said: made.jurisdiction });
  }
  return there;
}

/* R44: the workers.dev prefix is the account's and permanent in practice, so the founder chooses it. `addressState` reads it and,
   with none, proposes the copy's slug; it registers nothing. */
async function heldPrefix(token, acct) {
  try { return (await cf(token, `/accounts/${acct}/workers/subdomain`))?.subdomain || null; }
  catch (e) { if (e.status !== 404) throw e; return null; }
}
async function addressState(token, acct, slug) {
  const sub = await heldPrefix(token, acct);
  return sub ? { sub, proposed: null } : { sub: null, proposed: slug };
}

/* Registers exactly the name the founder chose. Cloudflare offers no availability check; a taken prefix is HTTP 403 with code
   10031, measured on the rehearsal account (K4970), decided by the code and never the words. HTTP 409 stays taken too. A 403
   without that code is a refusal like any other: thrown with Cloudflare's message. */
const SUBDOMAIN_UNAVAILABLE = 10031;
async function registerSubdomain(token, acct, name) {
  try { await cf(token, `/accounts/${acct}/workers/subdomain`, { method: "PUT", body: JSON.stringify({ subdomain: name }) }); }
  catch (e) { if ((e.code === SUBDOMAIN_UNAVAILABLE || e.status === 409) && !special(e)) return { ok: false, taken: true }; throw e; }
  return { ok: true };
}

/* R9 (amended by R44): enables the copy's address on the prefix the account holds and registers nothing; with none held the
   caller has skipped its choice, which is a fault of the caller, not a sentence for the founder. */
async function ensureSubdomain(token, acct, slug) {
  const sub = await heldPrefix(token, acct);
  if (!sub) throw Object.assign(new Error("no workers.dev prefix is registered on this account"), { noPrefix: true });
  await cf(token, `/accounts/${acct}/workers/scripts/${slug}/subdomain`,
    { method: "POST", body: JSON.stringify({ enabled: true }) });
  return { sub, registered: null };
}
/* Kept only so the installer, which still imports it, loads until its job (R84) moves to `addressState`; no candidates beyond the slug. */
const offerSubdomain = async (token, acct, slug) => {
  const { sub, proposed } = await addressState(token, acct, slug);
  return { sub, candidates: proposed ? [proposed] : [] };
};
export { scriptExists, PLAN_PROBE, establishPlan, storageEntitlement, ensureBuckets, r2Endpoint, addressState, registerSubdomain, offerSubdomain, ensureSubdomain };
