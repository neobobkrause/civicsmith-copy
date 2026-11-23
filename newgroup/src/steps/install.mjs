/* R17, R19, R20, R22, R23: every verified member installed beside the plane, then the plane bound to them. */
import { apiOf, special, approve } from "./api.mjs";
import { listScripts, listNamespaces } from "./account.mjs";
import { PLAN_PROBE } from "./probes.mjs";
import { BINDING_OF } from "./bindings.mjs";
import { uploadUpdate } from "./uploads.mjs";
import { uploadMember } from "./members.mjs";
import { containerPartsOf, lacksFor, WORKER_PART_LACKS, VPC_MEMBER, VPC_BINDING, vpcServiceOk, containerConditions, conditionWhy, placeContainer, setSchedules } from "./containers.mjs";
import { word } from "../../../bio-plane/src/setup-words/index.mjs";
/** @import { Emit, Names, Release, Session, Lasting, ApproveAgain } from './api.mjs' */
/** @import { LoadedFleet } from './load.mjs' */

/* Install (or refresh — the PUT is the same act) every member `loadFleet` verified. DEGRADES PER MEMBER, never fails the
   install: a team's plane must not be lost over a member it can add at the next update, and what was left out is SAID
   (D-115's "quietly doing less" is the defect; the cure is the saying, not the refusing). `ctx.vpc`: the Workers VPC service
   the operator named (R45), or none. `ctx.names`: the copy's names (R64). Answers `{done, left, imageLags, completed, containers}`; `containers` is each
   placed application `{member, id, appName, config}`, which `confirmContainers` (verify.mjs) restarts when its member still serves the old build. */
/* F10: a class a later release adds to a container member that is already installed is created by a migration from the tag it
   holds, in order, on an update as on a first install; nothing when it holds every class. */
function classMigration(heldTag, heldClasses, classes) {
  const missing = classes.map((d) => d.class_name).filter((c) => !heldClasses.includes(c));
  if (!missing.length) return {};
  const at = /^v([0-9]+)$/.exec(heldTag || "");
  return { migrations: { ...(heldTag ? { old_tag: heldTag } : {}), new_tag: `v${at ? Number(at[1]) + 1 : 2}`, new_sqlite_classes: missing } };
}

/**
 * @param {Emit} emit the progress sink
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {string} slug the copy's slug
 * @param {Release} release the release whose fleet is installed
 * @param {LoadedFleet} loaded what `loadFleet` answered
 * @param {any} [ctx] `{names, vpc, scope, plan}`: the copy's names (Names, required when any member is installed), the
 *   Workers VPC service named, and the scope and plan `containerConditions` reads
 * @returns {Promise<any>} `{done, left, imageLags, completed, containers}` (`done`, `completed`: member names; `left`:
 *   `{member, why, lacks?, out?}`; `imageLags`: sentences; `containers`: `{member, id, appName, config}`), or undefined
 *   when `loaded` is a skip
 * @throws {ApproveAgain} when the permission has expired
 * @throws {Lasting} when the API stays slow or unavailable for the whole bound
 */
async function installFleet(emit, token, acct, slug, release, loaded, ctx = {}) {
  await emit.step("fleet", word("installer.step.helpers"));
  if (loaded.skip) { emit.ok("fleet", loaded.skip); return; }
  const names = ctx.names;
  const man = release.man;
  const done = [], left = [], notes = [], imageLags = [], completed = [], containers = [];
  const classOf = new Map();
  let conditions = null, leftover = false, vpcTaken = false;
  const scripts = await listScripts(apiOf(token, acct)).catch((e) => { if (approve(e)) throw e; return new Map(); });
  const spaces = await listNamespaces(apiOf(token, acct)).catch((e) => { if (approve(e)) throw e; return []; });
  for (const L of loaded.members) {
    const m = L.m;
    /* R15, R38 (K3793): a container member that never reached its upload (its image not pullable or not pinned, no Containers
       scope, not Workers Paid, a part missing or unreadable) is LEFT OUT, named here with why and what the copy lacks; it is
       not a failed upload and the verdict does not wait on it (`out`). A member whose upload was attempted and failed is. */
    const isContainer = containerPartsOf(m).length > 0;
    if (L.error) { left.push({ member: m.member, why: L.error, ...(lacksFor(m) ? { lacks: lacksFor(m) } : {}), ...(isContainer ? { out: true } : {}) }); continue; }
    let uploaded = false, attempted = false;
    try {
      const { box, limits, own, classes } = L;
      /* R18: this member's bytes, fetched again at its first upload and let go with the member. */
      let held = null;
      const fetchHeld = async () => {
        try { held = await L.bytes(); }
        catch (e) { if (special(e)) throw e; throw new Error(e && e.fleetWhy ? e.fleetWhy : word("installer.fleet.why.refetch")); }
      };
      /* Said once the member is installed (a member left out is named with its own reason). */
      const lacking = !L.workerPart && WORKER_PART_LACKS.includes(m.member) ? word("installer.fleet.note.scanner", { member: m.member }) : null;
      const ownBindings = own.r2_buckets.map((b) => ({ type: "r2_bucket", name: b.binding, bucket_name: names.role(b.bucket) }));
      const vpcBindings = vpcServiceOk(ctx.vpc) && m.member === VPC_MEMBER ? [{ type: "vpc_service", name: VPC_BINDING, service_id: ctx.vpc }] : [];
      const heldTag = scripts.get(names.member(m.member))?.migration_tag ?? null;
      const send = (extra) => uploadMember(token, acct, slug, m, String(man.version), held.bundle, held.partBytes,
        { ...extra, names, fleet: loaded.fleet, heldTag, objects: own.durable_objects });
      /* R45: a VPC binding refused (the permission may not reach the service, or the id names none) leaves out that
         binding alone, named; the member is uploaded again without it. */
      const upload = async (extra) => {
        const bindings = [...(extra.bindings || []), ...ownBindings];
        if (!vpcBindings.length) return send({ ...extra, bindings });
        try {
          await send({ ...extra, bindings: [...bindings, ...vpcBindings] });
          vpcTaken = true;
          notes.push(word("installer.fleet.note.vpc.connected", { member: m.member }));
        } catch (e) {
          if (special(e)) throw e;
          await send({ ...extra, bindings });
          vpcTaken = true;
          notes.push(word("installer.fleet.note.vpc.refused", { member: m.member, said: e.message }));
        }
      };
      const schedule = async () => {
        if (!own.crons.length) return;
        try { await setSchedules(token, acct, names.member(m.member), own.crons); }
        catch (e) { if (special(e)) throw e; notes.push(word("installer.fleet.note.schedule", { member: m.member, schedule: own.crons.join("; "), said: e.message })); }
      };
      if (scripts.has(names.member(m.member))) completed.push(m.member);
      if (!box.length) {
        await fetchHeld();
        attempted = true;
        await upload({ bindings: classOf.get(m.member), limits });
        uploaded = true;
        await schedule();
        done.push(m.member);
        if (lacking) notes.push(lacking);
        continue;
      }
      const multi = box.length > 1;
      /* A class bound into its own member is bound in that member's own upload (no script name); one bound into
         another member is bound cross-script into it, after its class exists. */
      const binds = () => { for (const d of classes) for (const b of d.bind) if (b.member !== m.member)
        classOf.set(b.member, [...(classOf.get(b.member) || []),
          { type: "durable_object_namespace", name: b.binding, class_name: d.class_name, script_name: names.member(m.member) }]); };
      const selfBinds = classes.flatMap((d) => d.bind.filter((b) => b.member === m.member)
        .map((b) => ({ type: "durable_object_namespace", name: b.binding, class_name: d.class_name })));
      const fresh = !scripts.has(names.member(m.member));
      const heldClasses = spaces.filter((n) => n && n.script === names.member(m.member)).map((n) => n.class);
      conditions ??= await containerConditions(token, acct, ctx);
      leftover = !!conditions.leftover;
      if (!conditions.ok) {
        /* Left out this time; a container an earlier act installed keeps serving, so its bindings are restated (a
           member re-uploaded without one would lose it). */
        if (!fresh) binds();
        throw new Error(conditionWhy(conditions));
      }
      await fetchHeld();
      attempted = true;
      await upload({ limits, bindings: [...(classOf.get(m.member) || []), ...selfBinds],
        ...(fresh ? { migrations: { new_tag: "v1", new_sqlite_classes: classes.map((d) => d.class_name) } } : classMigration(heldTag, heldClasses, classes)) });
      uploaded = true;
      for (const d of classes) {
        const placed = await placeContainer(token, acct, m, d, names.app(m.member, d.class_name, multi), names);
        if (placed.lag) imageLags.push(placed.lag);
        if (placed.id) containers.push({ member: m.member, id: placed.id, appName: placed.appName, config: placed.config });
      }
      await schedule();
      binds();
      done.push(m.member);
      if (lacking) notes.push(lacking);
    } catch (e) {
      if (special(e)) throw e;
      left.push({ member: m.member, why: String(e && e.fleetWhy ? e.fleetWhy : e && e.message || e), ...(lacksFor(m) ? { lacks: lacksFor(m) } : {}), ...(isContainer && !attempted ? { out: true } : {}) });
    }
  }
  /* R45: a VPC service named that no member installed here takes is said, never dropped in silence. */
  if (vpcServiceOk(ctx.vpc) && !vpcTaken)
    notes.push(word("installer.fleet.note.vpc.unused", { member: VPC_MEMBER }));
  const probeNote = leftover ? word("installer.probe.leftover", { name: PLAN_PROBE }) : "";
  const tail = [...notes, ...new Set(left.map((l) => l.lacks).filter(Boolean)), probeNote].filter(Boolean).map((n) => " " + n).join("");
  const doneNames = done.join(", ");
  const list = left.map((l) => word("installer.fleet.left.item", { member: l.member, why: l.why })).join("; ");
  if (left.length === 0) {
    emit.ok("fleet", (done.length === 1 ? word("installer.fleet.done.one", { names: doneNames }) : word("installer.fleet.done.other", { n: done.length, names: doneNames })) + tail);
  } else {
    emit.ok("fleet", (done.length ? word("installer.fleet.partial.some", { installed: done.length, names: doneNames, left: left.length, list })
      : word("installer.fleet.partial.none", { left: left.length, list })) + tail);
  }
  /* D-116: WHICH members this act uploaded, so the verify step can require each of them to answer THROUGH the plane's
     binding. Every early return above uploads nothing and returns undefined, which the caller reads as none. */
  return { done, left, imageLags, completed, containers };
}

/* DIST-6, step 3 of the order at BINDING_OF: RE-PUT the plane bound to every bindable member now present — those
   bound at step 1 and those `installFleet` just uploaded. The re-PUT takes the UPDATE's shape on both paths (no
   `migrations`, the team's passwords and the Durable Object kept by `keep_bindings`), because that is the shape
   already proven against an existing script on every update; an install's own shape would restate its `v1` migration
   against a script that already carries it, which nothing here has established Cloudflare accepts. Nothing to add ->
   no PUT. A refusal DEGRADES, never fails the act: the members stay installed, the step is marked, and the verify step
   names each member the plane cannot reach (servingVerdict) — never a success over it. */
/**
 * @param {Emit} emit the progress sink
 * @param {Session} token the run's session
 * @param {string} acct the account id
 * @param {string} slug the copy's slug
 * @param {Release} release the release installed
 * @param {string[]} already the members the plane was bound to at step 1
 * @param {{done?: string[]}|null|undefined} fleet what `installFleet` answered
 * @param {{withR2: boolean, daemon?: string, noSelf?: boolean, profiles?: any, ownHosts?: string[], names: Names, writeHosts?: boolean}} opts
 *   what `uploadUpdate` takes, and whether to write the copy's own hosts
 * @returns {Promise<{bound: string[], unbound: string[], put?: boolean, hosts?: boolean}>}
 */
async function bindMembers(emit, token, acct, slug, release, already, fleet, opts) {
  const want = [...BINDING_OF.keys()]
    .filter((m) => already.includes(m) || (fleet?.done || []).includes(m));
  const added = want.filter((m) => !already.includes(m));
  /* R47: on the install, this is also the upload that first tells the copy its own hosts, so it runs when they are
     known even with no member to add. An update states them in its own upload, and restates them here. */
  const hosts = opts.writeHosts && Array.isArray(opts.ownHosts) && opts.ownHosts.length ? opts.ownHosts : null;
  if (added.length === 0 && !hosts) return { bound: already, unbound: [] };
  await emit.step("bind", added.length ? word("installer.step.connect") : word("installer.step.connect.address"));
  try {
    await uploadUpdate(token, acct, slug, opts.withR2, release,
      { members: want, daemon: opts.daemon, noSelf: opts.noSelf, profiles: opts.profiles, ownHosts: opts.ownHosts, names: opts.names });
    emit.ok("bind", [added.length ? word("installer.connect.done", { names: added.join(", ") }) : "",
      hosts ? word("installer.connect.address.done", { hosts: hosts.join(", ") }) : ""]
      .filter(Boolean).join(" "));
    return { bound: want, unbound: [], put: true, hosts: !!hosts };
  } catch (e) {
    emit.no("bind", [added.length ? word("installer.connect.refused", { names: added.join(", ") }) : "",
      hosts ? word("installer.connect.address.refused") : "",
      word("installer.cfsaid", { said: e.message })].filter(Boolean).join(" "));
    return { bound: already, unbound: added, hosts: false };
  }
}
export { installFleet, bindMembers };
