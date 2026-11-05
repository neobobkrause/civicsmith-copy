/* R12, R13, R15: the plane's two uploads, whether it is already as the release wants it, and its secrets. */
import { cf, special } from "./api.mjs";
import { rand, uploadForm } from "./bytes.mjs";
import { scriptHash, releaseSha } from "./readback.mjs";
import { planeCronsOfStream } from "./statements.mjs";
import { setSchedules } from "./containers.mjs";
import { word, hasWord } from "../../../bio-plane/src/setup-words/index.mjs";
import { selfBinding, BROWSER_BINDING, memberBindings, instanceAiBinding, sealBinding, profilesBinding, ownHostsBinding, placementBindings, heldPlace, SEAL_BINDING, PROFILES_BINDING } from "./bindings.mjs";

/* R39 (K4566; fix round 6, G1) — THE PLANE'S SCHEDULE. The plane's one cron is the watchdog that heals a stalled object, and
   nothing in the account sets it but this: a script's upload carries no schedule. It is read from the signed bundle's own
   statement (`bio-plane-crons/1`), streamed, before anything is uploaded, so a release that states none (or unreadably) is
   refused with nothing placed; and it is set after the upload, on the install and on the update alike, and a refusal STOPS
   the act (unlike a helper's schedule, a note), since a plane without it can stall unseen. Stand-in for the sentence:
   `installer.fleet.why.program`; the row owed is `installer-steps.plane.crons`, one line for "this release does not say when
   the plane's watchdog runs". Cloudflare's own refusal is thrown with its message, as every other upload's. The schedule
   takes up to 15 minutes to reach the platform; that wait is not the installer's. */
async function cronsOf(release) {
  const r = await planeCronsOfStream(release.blob.stream());
  if (!r.ok) throw new Error(word("installer.fleet.why.program"));
  return r.crons;
}
const setPlaneSchedules = (token, acct, slug, crons) => setSchedules(token, acct, slug, crons);

/* R40 (G54, K4702) — THE PLANE'S WORKERS LOGS. A script upload that states no `observability` leaves the logs off, so both
   metadata objects carry this one setting (the installer's constant, pinned by a test to the plane's `wrangler.jsonc`), and
   the account's settings are read back once the script is there: a plane that does not hold `enabled: true` stops the act.
   Stand-in for the sentence: `installer.fleet.why.program`; the row owed is `installer-steps.plane.observability`, one line
   for "your Cloudflare account did not switch on the plane's logs". */
export const OBSERVABILITY = Object.freeze({ enabled: true });
/* Refused only when the settings ARE read (they state their bindings) and the setting is not enabled. A read that fails, or
   answers nothing readable, is unknown, never "off" (as `heldBindings`): the act continues and `opts.note` is told, in words,
   that the logs could not be confirmed (row `installer.fleet.logsunconfirmed`, written by `installer`); an approval or a lasting wait is
   rethrown as everywhere. */
async function observabilityHeld(token, acct, slug, note) {
  let s;
  try { s = await cf(token, `/accounts/${acct}/workers/scripts/${slug}/settings`); }
  catch (e) { if (special(e)) throw e; s = null; }
  if (!s || !Array.isArray(s.bindings)) {
    /* the update never depends on a sentence: a key whose row is not in the table yet says nothing, and the act goes on */
    if (typeof note === "function" && hasWord("installer.fleet.logsunconfirmed")) note(word("installer.fleet.logsunconfirmed"));
    return;
  }
  if (s.observability?.enabled !== true) throw new Error(word("installer.fleet.why.program"));
}

/* `opts.noSelf` exists for ONE reason: an install PUT names a service binding to
   the script the same PUT creates, and nothing here can prove Cloudflare accepts
   that self-reference without a real install, which is deploy-gated. So the
   install degrades rather than failing — see the retry in runInstall. */
async function uploadInstall(token, acct, slug, secrets, release, opts = {}) {
  const names = opts.names;
  /* R46: a hint and a jurisdiction both given are refused here, before anything is read or written. */
  const placement = placementBindings(opts.storeLocation, opts.storeJurisdiction);
  const crons = await cronsOf(release);
  const meta = {
    main_module: "index.mjs",
    compatibility_date: "2026-07-01",
    compatibility_flags: ["nodejs_compat"],
    /* R20: the plane's limits exactly as the release R8 chose states them (selectRelease), never a value of our own. */
    limits: { ...release.limits },
    bindings: [
      { type: "durable_object_namespace", name: "STORE", class_name: "Store" },
      { type: "plain_text", name: "VERSION", text: release.version },
      /* D-102: the instance name IS the worker name. The group already chose it
         here as `slug`, so there is nothing further to ask them; binding it is
         what puts a real name in the user-agent instead of "unnamed", and it
         means the name a third party sees is the same one the operator types
         into a URL. One source of truth, no second name to drift out of sync. */
      { type: "plain_text", name: "INSTANCE_NAME", text: slug },
      { type: "secret_text", name: "ADMIN_TOKEN", text: secrets.boot },
      /* R9 (T36; N711, K1936 Q3): no MEMBER_TOKEN. The shared member key is retired; members sign in with their own
         sessions, and admission refuses a member bearer by name. */
      { type: "secret_text", name: "PROBE_TOKEN", text: secrets.probe },
      /* DIST-2 (REC-33's follow-on): the scoped monitoring credential. The
         plane's #monitorToken() is DAEMON_TOKEN || ADMIN_TOKEN and classify()
         already recognises the class — DIST-1's ordering constraint is
         satisfied in this direction, so binding it here narrows the daemon
         from the root-of-trust ADMIN_TOKEN to a credential that can reach
         exactly two ops. Deliberately NOT on the success panel: no human ever
         spends this value — the plane spends it over SELF — and a credential
         displayed is a credential that can leak for no gain. The ADMIN_TOKEN
         fallback stays until DEC-43's retirement conditions are measured. */
      { type: "secret_text", name: "DAEMON_TOKEN", text: secrets.daemon },
      /* DIST-9 (D-260's deploy half): the organisation `ai` credential, ONLY when the operator supplied one. */
      ...instanceAiBinding(secrets.instanceAi),
      /* K1541: the seal secret members' own account references are sealed under; never shown. */
      ...sealBinding(secrets.seal),
      /* R21: the chosen jurisdiction profiles, only when some were chosen. */
      ...profilesBinding(opts.profiles),
      /* R42, R46: where the team's room is created: the hint (`STORE_LOCATION`) or the jurisdiction (`STORE_JURISDICTION`) the
         caller was given; neither, none. */
      ...placement,
      { type: "r2_bucket", name: "CAPTURES", bucket_name: names.captures },
      { type: "r2_bucket", name: "PUBLISHED", bucket_name: names.published },
      ...(opts.noSelf ? [] : [selfBinding(slug)]),
      /* DIST-11 (IC-252): the Browser Rendering binding D-64's render arm looks for. On every Workers tier, so an
         install is never refused over it; the plane reports it as a binding whose in-plane driver is not built. */
      BROWSER_BINDING,
      /* DIST-6: the members this account already holds (none on a fresh account — see BINDING_OF). */
      ...memberBindings(opts.members, names),
    ],
    observability: { ...OBSERVABILITY },
    /* SQLite backend is the irreversible choice, made correctly, once. */
    migrations: { new_tag: "v1", new_sqlite_classes: ["Store"] },
  };
  const put = await cf(token, `/accounts/${acct}/workers/scripts/${slug}`,
    { method: "PUT", body: uploadForm(meta, release.blob) });
  await observabilityHeld(token, acct, slug, opts.note);
  await setPlaneSchedules(token, acct, slug, crons);
  return put;
}

/* The update path. No fork, no CI/CD: the wizard re-uploads the current
   release into the existing script. keep_bindings preserves the instance's
   secrets, its Durable Object, and its buckets exactly as they are; VERSION
   is supplied fresh. No migrations field, because the Store class already
   exists and its storage backend never changes. Updates therefore cannot
   touch passwords or the record, and the success page says so. */
async function uploadUpdate(token, acct, slug, withR2, release, opts = {}) {
  const names = opts.names;
  const crons = await cronsOf(release);
  /* R42: the place the script holds is read here, by this function, before anything is uploaded; unreadable refuses the act. */
  const place = await heldPlace(token, acct, slug);
  /* When the account's storage is available the update binds it explicitly,
     which quietly completes any copy installed before storage became a
     requirement. When it is not, the update proceeds the old way, keeping
     whatever bindings exist: an update must never be refused over storage. */
  const meta = {
    main_module: "index.mjs",
    compatibility_date: "2026-07-01",
    compatibility_flags: ["nodejs_compat"],
    /* R20: as on install; restated every update, because a copy installed before DIST-7 has no limit to keep. */
    limits: { ...release.limits },
    bindings: [
      { type: "plain_text", name: "VERSION", text: release.version },
      /* D-102: bound on UPDATE as well as install, which is what retro-names
         every copy installed before this existed. Those instances advertise
         "unnamed" today; their next update fixes it with no action from the
         operator. Same reasoning as the R2 binding below: an update quietly
         completes what an older install left out. */
      { type: "plain_text", name: "INSTANCE_NAME", text: slug },
      ...(withR2 ? [
        { type: "r2_bucket", name: "CAPTURES", bucket_name: names.captures },
        { type: "r2_bucket", name: "PUBLISHED", bucket_name: names.published },
      ] : []),
      /* REC-26: bound on UPDATE as well as install, and for the same reason as
         INSTANCE_NAME above — every copy installed before this existed has no
         SELF binding, so its monitoring consumers are dormant right now, and its
         next update arms them with no action from the operator. Unlike the
         INSTANCE_NAME case there is nothing cosmetic about it: an instance
         without this binding never re-checks a source it was asked to monitor. */
      /* `opts.noSelf` only on the install's step-3 re-PUT of a copy whose install already had SELF refused
         (runInstall's retry): that re-PUT restates exactly what the install achieved plus the members, so a SELF
         refusal cannot also cost the copy its members. An update never passes it. */
      ...(opts.noSelf ? [] : [selfBinding(slug)]),
      /* DIST-6: the fleet members, by the same healing shape as SELF — an update of a copy installed without them
         gains them (step 3 of the order at BINDING_OF), and one that has them keeps them (step 1). */
      ...memberBindings(opts.members, names),
      /* DIST-11: restated on every update, because `browser` is not in keep_bindings below — an update that did not
         name it would DROP it from a copy that holds it, and one installed before DIST-11 gains it here. */
      BROWSER_BINDING,
      /* DIST-2: bound on UPDATE as well, same healing shape as SELF above — an
         instance installed before the daemon class existed has no DAEMON_TOKEN
         and keep_bindings cannot create what was never there, so without this
         line that instance monitors on the root-of-trust ADMIN_TOKEN forever
         (DEC-43's silent licence, and DIST-4's report is what will count who
         is still doing it). A FRESH value on every update is deliberate and
         harmless: nothing outside the worker's own env ever holds this
         credential, so there is no holder to invalidate. The three group
         passwords still travel ONLY by keep_bindings below — this metadata
         cannot restate values it never sees. An explicit binding replacing the
         kept one of the same name is the API's contract; the next gated real
         update run is where that is read back rather than trusted. */
      /* R69: a run that resumes an install it did not finish cannot know the credentials the earlier run generated (they are
         never readable), so it states the ones it has just generated; they replace the kept ones of the same name. */
      ...(opts.secrets ? [
        { type: "secret_text", name: "ADMIN_TOKEN", text: opts.secrets.boot },
        { type: "secret_text", name: "PROBE_TOKEN", text: opts.secrets.probe },
        { type: "secret_text", name: SEAL_BINDING, text: opts.secrets.seal },
      ] : []),
      { type: "secret_text", name: "DAEMON_TOKEN", text: opts.daemon || opts.secrets?.daemon || rand(32) },
      /* DIST-9: restated ONLY when the operator supplied a value on this run. When none is supplied nothing is sent,
         and a value the copy already holds is KEPT by keep_bindings (secret_text) — an update neither sets nor clears
         it. Unlike DAEMON_TOKEN above there is NO `|| rand(32)` here, and there must never be one: see
         instanceAiBinding. */
      ...instanceAiBinding(opts.instanceAi),
      /* K1541: only when the copy is known to hold none (runUpdate reads its settings); never over one it holds. */
      ...sealBinding(opts.seal),
      /* R21: restated only by the install's step-3 re-PUT (see PROFILES_BINDING); an update never passes it. */
      ...profilesBinding(opts.profiles),
      /* R47: the copy's own hosts, restated on every upload of this shape that knows them (an install's last upload,
         after its address is enabled; an update, from the address it found). */
      ...ownHostsBinding(opts.ownHosts),
      /* R42: the room's place, restated as held (a plain text is not in keep_bindings below); never invented. */
      ...place,
    ],
    /* `service` is deliberately NOT in keep_bindings: the line above binds it
       explicitly, and an explicit binding is what heals the older copies that
       have none — inheritance cannot create what was never there. THE COROLLARY
       IS A TRAP: if the explicit binding above is ever removed, "service" MUST be
       added here in the same change, or an update will silently DELETE the
       binding from a working instance and re-inert its monitoring. */
    keep_bindings: ["secret_text", "durable_object_namespace", ...(withR2 ? [] : ["r2_bucket"])],
    observability: { ...OBSERVABILITY },
  };
  const put = await cf(token, `/accounts/${acct}/workers/scripts/${slug}`,
    { method: "PUT", body: uploadForm(meta, release.blob) });
  await observabilityHeld(token, acct, slug, opts.note);
  await setPlaneSchedules(token, acct, slug, crons);
  return put;
}

/* R67 — IS THE PLANE ALREADY AS THIS RELEASE WANTS IT? "Already done" is judged by the whole deployed state: the bytes the
   account holds hash to the release's, the VERSION is the release's, and every binding the install would send is there with
   the kind it would send; any one missing and the plane is uploaded, bytes identical or not (S7). Secrets cannot be read, so a
   secret counts by its name. R42, R46: a room never moves, so `STORE_LOCATION`, `STORE_JURISDICTION` and `STORE_GENERATION` are not compared: a held
   value that differs from what an install would send, or none, never makes the plane out of sync. */
async function planeInSync(token, acct, slug, release, held, { names, members, profiles }) {
  const have = new Map(held.map((b) => [b.name, b]));
  const wants = [["STORE", "durable_object_namespace"], ["VERSION", "plain_text"], ["INSTANCE_NAME", "plain_text"], ["ADMIN_TOKEN", "secret_text"],
    ["PROBE_TOKEN", "secret_text"], ["DAEMON_TOKEN", "secret_text"], [SEAL_BINDING, "secret_text"], ["CAPTURES", "r2_bucket"], ["PUBLISHED", "r2_bucket"],
    ["SELF", "service"], ["BROWSER", "browser"], ...memberBindings(members, names).map((b) => [b.name, "service"]),
    ...(profiles.length ? [[PROFILES_BINDING, "plain_text"]] : [])];
  for (const [name, type] of wants) if (have.get(name)?.type !== type) return false;
  if (have.get("VERSION")?.text !== release.version) return false;
  if (have.get("CAPTURES")?.bucket_name !== names.captures || have.get("PUBLISHED")?.bucket_name !== names.published) return false;
  for (const b of memberBindings(members, names)) if (have.get(b.name)?.service !== b.service) return false;
  return (await scriptHash(token, acct, slug)) === (await releaseSha(release));
}
/* A secret set on its own, without an upload (R69: a run that resumes states the credentials it has just generated). */
async function putSecret(token, acct, slug, name, text) {
  return cf(token, `/accounts/${acct}/workers/scripts/${slug}/secrets`, { method: "PUT", body: JSON.stringify({ name, text, type: "secret_text" }) });
}
async function rotateSecrets(token, acct, slug, secrets, held) {
  for (const [name, text] of [["ADMIN_TOKEN", secrets.boot], ["PROBE_TOKEN", secrets.probe], ["DAEMON_TOKEN", secrets.daemon]]) await putSecret(token, acct, slug, name, text);
  if (!held.some((b) => b.name === SEAL_BINDING)) await putSecret(token, acct, slug, SEAL_BINDING, secrets.seal);
}
export { uploadInstall, uploadUpdate, planeInSync, putSecret, rotateSecrets };
