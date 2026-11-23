/* R16, R24: one file of a release fetched and checked against its hash, and one member's upload. */
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
import { cf, patiently } from "./api.mjs";
import { hex, relHeaders } from "./bytes.mjs";
import { DESCRIPTOR_PARTS } from "./containers.mjs";
/** @import { Session, Lasting, ApproveAgain } from './api.mjs' */
/** @import { DurableObjects } from './containers.mjs' */

/* ---------------------------------------------------- the fleet (IC-82/D-297) */

/* A part's module type maps to the upload content type. COPY-NEVER-DEFAULT on
   the verifier side too: a type this map does not know refuses that member by
   name rather than guessing — an inferred loader is the 3607b5c defect
   arriving inside a team's account. */
/** @type {Record<string, string>} a part's module type -> the content type it is uploaded with */
const PART_MIME = { CompiledWasm: "application/wasm", Data: "application/octet-stream",
                    Text: "text/plain", ESModule: "application/javascript+module" };

/* R71 (F5): the software source (the public release repository) is waited on like Cloudflare's API: a slow or unavailable
   answer (5xx, rate limit, no answer) is retried within the bound and then ends the run with `screen.install.stopped.source`,
   BEFORE anything is created; an answer that is not transient (not found, bytes that fail their hash) is the member's own
   refusal, as before. `onWait` draws the wait. */
/**
 * The software source stayed slow or unavailable for the whole bound (R16, R71): `source` is true and `cause` is the
 * Lasting failure; the message names `what`.
 */
export class SourceUnavailable extends Error {
  /**
   * @param {string} what the file asked for (a member, or a member and a part's path)
   * @param {Error} cause the failure that did not mend
   */
  constructor(what, cause) { super(`${what}: ${cause.message}`); this.source = true; this.cause = cause; }
}
/**
 * R16: one file of a release, its bytes answered only when their SHA-256 is `wantSha`.
 * @param {string} url
 * @param {string} wantSha the SHA-256 (hex) the bytes must have
 * @param {string} what the name the file's failures carry
 * @param {((waited: number, bound: number) => any)|null} [onWait] draws each wait, as OnWait
 * @returns {Promise<Uint8Array>} the verified bytes
 * @throws {SourceUnavailable} when the source stays slow or unavailable (5xx, 429, no answer) for the whole bound
 * @throws {Error} an answer that is not ok and not transient (its `status`, `fleetWhy`), or bytes that fail their integrity check
 */
async function fetchVerified(url, wantSha, what, onWait = null) {
  let bytes;
  try {
    bytes = await patiently(async () => {
      let r;
      try { r = await fetch(url, { redirect: "follow", headers: relHeaders }); }
      catch (e) { throw Object.assign(new Error(what + " " + String(e && e.message || e)), { network: true }); }
      if (!r.ok) throw Object.assign(new Error(what + " http " + r.status), { fleetWhy: word("installer.fleet.why.http", { status: r.status }) }, { status: r.status });
      return new Uint8Array(await r.arrayBuffer());
    }, { onWait });
  } catch (e) { if (e && e.lasting) throw new SourceUnavailable(what, e); throw e; }
  const got = hex(await crypto.subtle.digest("SHA-256", bytes));
  if (got !== wantSha) throw Object.assign(new Error(what + " failed its integrity check"), { fleetWhy: word("installer.fleet.why.integrity") });
  return bytes;
}

/* R37 (CR-22; K4094, K4121): a member's Durable Objects are the ones its signed `Worker` part states (`workerDescriptor`
   reads `durable_objects`), and no others. The installer keeps no table of its own: a part that states none deploys none. */
/* The migration a member's upload carries, given the tag the script holds now (null: it holds none): every step after that
   tag, in order, in one `steps` list ending at the last tag; nothing when it already holds the last. */
/**
 * @param {string|null} heldTag the migration tag the script holds now; null when it holds none
 * @param {DurableObjects|null|undefined} objects the member's own Durable Objects; absent when it states none
 * @returns {any} `{old_tag?, new_tag, steps: {new_sqlite_classes: string[]}[]}`, or null when there is nothing to migrate
 */
export function objectMigrations(heldTag, objects) {
  if (!objects) return null;
  const at = heldTag ? objects.migrations.findIndex((x) => x.tag === heldTag) : -1;
  const rest = objects.migrations.slice(at + 1);
  if (!rest.length) return null;
  return { ...(heldTag ? { old_tag: heldTag } : {}), new_tag: rest.at(-1).tag, steps: rest.map((x) => ({ new_sqlite_classes: [...x.classes] })) };
}
/**
 * R37: the bindings of a member's own Durable Objects, as its `Worker` part states them; none when it states none.
 * @param {DurableObjects|null|undefined} objects
 * @returns {{type: string, name: string, class_name: string}[]}
 */
const objectBindings = (objects) => (objects?.bindings || []).map((b) => ({ type: "durable_object_namespace", name: b.name, class_name: b.class_name }));

/**
 * R16, R37, R38, R39, R64: one member's upload, PUT as its Worker under the copy's names.
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {string} slug the copy's slug, which the member's `bio-plane` service binding names
 * @param {any} m the member as the signed fleet statement states it (`member`, `compat`, `services`, `parts`)
 * @param {string} version the release's version, bound as `VERSION`
 * @param {Uint8Array} bundle the member's verified module
 * @param {Record<string, Uint8Array>} partBytes each part's verified bytes, by its path
 * @param {any} [extra] `{names, heldTag, migrations, objects, limits, fleet, bindings}`: the copy's names (Names,
 *   required for any upload), the tag the script holds, a migration stated by the caller, the member's own objects
 *   (DurableObjects) and limits, the fleet's members (a Set of names), and further bindings
 * @returns {Promise<any>} the API's result
 * @throws {ApproveAgain} when the permission has expired
 * @throws {Lasting} when the API stays slow or unavailable for the whole bound
 * @throws {Error} the platform's refusal
 */
async function uploadMember(token, acct, slug, m, version, bundle, partBytes, extra = {}) {
  const names = extra.names;
  /* R37: the member's own Durable Objects, as its Worker part states them, migrated from the tag the script holds. */
  const held = extra.heldTag ?? null;
  const migrations = extra.migrations ?? objectMigrations(held, extra.objects);
  const meta = {
    main_module: "index.mjs",
    /* COPIED from the signed manifest, which copied it from the member's own
       config at cut time (IC-82). Nothing here is defaulted. */
    compatibility_date: m.compat.date,
    ...(m.compat.flags.length ? { compatibility_flags: m.compat.flags } : {}),
    /* R39: the member's own limits, exactly as its signed bundle states them; none stated, none sent. */
    ...(extra.limits ? { limits: { ...extra.limits } } : {}),
    bindings: [
      { type: "plain_text", name: "VERSION", text: version },
      /* D-292: the manifest carries the phantom exactly as the config wrote
         it, and the SLUG is substituted here — the same selfBinding shape the
         plane's own install has used since 2026-08-05. The slug never arrives
         over the network; it is the name the group chose. R64: another member is the Worker under this copy's names. */
      ...(m.services || []).map((sv) => ({ type: "service", name: sv.binding,
        service: sv.service === "bio-plane" ? slug : (extra.fleet && extra.fleet.has(sv.service) ? names.member(sv.service) : sv.service) })),
      /* R37 (the member's own objects, as its part states them). */
      ...objectBindings(extra.objects),
      /* R38: a container member's Durable Object class, bound cross-script into each member its descriptor names. */
      ...(extra.bindings || []),
    ],
    /* R38: a container member's class is created by its first upload's migration, and never restated after it. */
    ...(extra.migrations ? { migrations: extra.migrations } : migrations ? { migrations } : {}),
  };
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  fd.append("index.mjs", new Blob([bundle], { type: "application/javascript+module" }), "index.mjs");
  /* A container or Worker descriptor is read here, never uploaded as a module. */
  for (const p of (m.parts || []).filter((pp) => !DESCRIPTOR_PARTS.has(pp.type))) {
    fd.append(p.path, new Blob([partBytes[p.path]], { type: PART_MIME[p.type] }), p.path);
  }
  return cf(token, `/accounts/${acct}/workers/scripts/${names.member(m.member)}`, { method: "PUT", body: fd });
}
export { PART_MIME, fetchVerified, objectBindings, uploadMember };
