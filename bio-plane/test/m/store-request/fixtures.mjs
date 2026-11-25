/* store-request's published fixtures (K4990, K4993; K5046 (d), K5054): made by the real code when a test runs, never stored.
   `storeWorld()` is `store-assembly`'s world (its R90–R94) with this module's door, sign-ins and recipes over it (R16–R19):
   the real store, the real claim and sign-in, the page's door, recipes of real acts and a pinned clock. */
import { storeWorld as assemblyWorld, WORLD_NOW, WORLD_PASSWORD, WORLD_FOUNDER_HANDLE, WORLD_INSTANCE_NAME } from "../store-assembly/world.mjs";
import { doorOf, bootOf, routeOf, signIn, admittedAs, hold, project, trail, profiles, queue, WORLD_UNREACHED, WORLD_ORIGIN } from "./door.mjs";
import { WORLD_RELEASE_KEYS, WORLD_RUNNING_VERSION, worldDelivery, olderInstallation as olderOf, owed, lapsed, delivered, releaseNotice } from "./recipes-r10.mjs";
import { readings, machineReading, graded, sharedOrigin } from "./recipes-states.mjs";
import { holdAt, newerCapture, connection, partialPdf, unmatchedPerson, attested, paperFile, unretirable } from "./recipes-docs.mjs";
import { unnamedFounder, timeline, titlelessProject, deepChain, connectedSignIn, investigating, mentionedTogether } from "./recipes-team.mjs";
import { makeRenderer, rendered, renderPending, unfinished, partedAddress, followed } from "./recipes-capture.mjs";
import { page, pdf, question, questions, contradiction, conflict, setAside, finding, signer, published, imported, cited, rerun, assistant, writingHelp, grantAdmit, parted, largeSheet, credential, projects, draftOnly, register } from "./recipes.mjs";

export { WORLD_RELEASE_KEY } from "./recipes-r10.mjs";
export { WORLD_NOW, WORLD_PASSWORD, WORLD_FOUNDER_HANDLE, WORLD_UNREACHED, WORLD_ORIGIN, doorOf, bootOf, routeOf, signIn, admittedAs };

/** The binding tokens a world's `env` holds (the classes an operator binds; `admission`'s `BINDINGS`), each live. */
export const WORLD_TOKENS = Object.freeze({ ADMIN_TOKEN: "world-root-of-trust-7f3a9c2e5b1d4086",
                                           PROBE_TOKEN: "world-probe-credential-2c8e41a7d0b6",
                                           DAEMON_TOKEN: "world-daemon-credential-91f0c3e6a2d8" });
/** The producing team a world records: the one store-assembly's base binds as `INSTANCE_NAME` at its first boot (K5149), as an installer does. */
export const WORLD_GROUP = WORLD_INSTANCE_NAME;
/** What `storeWorld({ ai: true })` adds to the environment: the seal secret a team's Claude key is kept under, and the instance named a test instance
 *  (`CIVICSMITH_TEST_INSTANCE` equal to `INSTANCE_NAME`, as ai-runs reads it), the only instance a run opens on while no AI part is verified. */
export const WORLD_AI_SECRET = "world-account-seal-secret-3b9d71c4e0a5f628";

/** `storeWorld({claimed?, now?, env?, ai?, deliver?, releaseKeys?, renderer?, follow?})` (op-tables §5.2, K5054): store-assembly's world (its producing team recorded at its first boot, K5149) with the binding tokens of
 *  `WORLD_TOKENS`, plus
 *  `door(req, as)` (R17: what a page's `fetch("/api/?op=...")` receives), `signIn(handle, {admin?, capabilities?, device?})` (R16),
 *  `plane(as)` and `boot(as)` (R18: `{door, session}` for interface-shell's `boot`), `route(as)` (R18: a Playwright route handler answering the page's `/api/` from the door, for a browser test), `session(as)` (the record `{t, e, d, w}`),
 *  `admitted(token, op?)` (admission's caller for a token) and `recipes.hold|project|trail|profiles` (R19), each of real acts;
 *  `store`, `ctx`, `sql`, `tick(ms)` are the world's own. The world binds `CAPTURES` (store-assembly's) and no `PUBLISHED`: `selftest` reads that as the owner does, one bucket bound without the other, and a test that unbinds
 *  `CAPTURES` leaves neither bound (SCREENS-SETTINGS #20 J37 (1); STORE-REQUEST #6 B15 (4)); `recipes.published` binds the published store when it publishes. */
export async function storeWorld({ env = {}, ai = false, deliver = null, releaseKeys = null, renderer = false, follow = false, ...opts } = {}) {
  const name = WORLD_GROUP;
  const holder = {};
  /* the browser renderer a page is captured as a visitor saw it with, bound as `RENDERER` (the platform's service binding, a double; recipes-capture.mjs) */
  const browser = renderer === true ? makeRenderer() : renderer || null;
  /* the world hands the owed-work ledger its own delivery (`worldDelivery`), as control-plane hands its `deliverOwedRender` (a later module) */
  // fixtures-own: harness the world's delivery, made of earlier modules' real acts (the alarm's filing of an owed fetch)
  const world = await assemblyWorld({ ...opts, ...(deliver === true ? { deliver: (a) => worldDelivery(holder.world)(a) } : deliver ? { deliver } : {}),
    ...(releaseKeys === true ? { releaseKeys: WORLD_RELEASE_KEYS } : releaseKeys ? { releaseKeys } : {}),
    env: { ...(releaseKeys === true ? { VERSION: WORLD_RUNNING_VERSION } : {}), ...WORLD_TOKENS, ...(ai ? { ACCOUNT_SEAL_SECRET: WORLD_AI_SECRET, INSTANCE_NAME: name, CIVICSMITH_TEST_INSTANCE: name } : {}), ...(browser ? { RENDERER: browser } : {}), ...env } });
  const door = doorOf(world);
  const make = () => storeWorld();
  holder.world = world;
  world.__delivery = deliver === true;
  world.__follow = follow === true;
  world.renderer = browser;
  world.__releaseKeys = releaseKeys === true;
  return Object.assign(world, {
    door: (req, as = null) => door(req, as),
    signIn: (handle, o) => signIn(world, handle, o),
    admitted: (token, op) => admittedAs(world, token, op),
    plane: (as) => bootOf(world, as),
    boot: (as) => bootOf(world, as),
    route: (as) => routeOf(world, as),
    session: (as) => (as ? as.session : null),
    recipes: {
      hold: (as, name, content, projectId, opts) => hold(world, as, name, content, projectId, opts),
      project: (as, title, o) => project(world, as, title, o),
      trail: (as, projectId, label) => trail(world, as, projectId, label),
      profiles: (as, ids) => profiles(world, as, ids),
      queue: (spec) => queue(world, spec),
      page: (as, name, o) => page(world, as, name, o),
      pdf: (as, name, o) => pdf(world, as, name, o),
      question: (as, projectId, o) => question(world, as, projectId, o),
      questions: (as, projectId, n, o) => questions(world, as, projectId, n, o),
      contradiction: (as, o) => contradiction(world, as, o),
      conflict: (as, o) => conflict(world, as, o),
      setAside: (as, o) => setAside(world, as, o),
      finding: (as, projectId, o) => finding(world, as, projectId, o),
      signer: (as) => signer(world, as),
      published: (as, found) => published(world, as, found),
      imported: (as, o) => imported(world, as, o, make),
      cited: (as, projectId, o) => cited(world, as, projectId, o, make),
      rerun: (as, o) => rerun(world, as, o, make),
      assistant: (as, o) => assistant(world, as, o),
      writingHelp: (as, o) => writingHelp(world, as, o),
      grantAdmit: (as, o) => grantAdmit(world, as, o),
      parted: (as, name, o) => parted(world, as, name, o),
      largeSheet: (as, o) => largeSheet(world, as, o),
      credential: (as, o) => credential(world, as, o),
      projects: (as, n, o) => projects(world, as, n, o),
      draftOnly: (as, o) => draftOnly(world, as, o),
      register: (as, o) => register(world, as, o),
      readings: (as, projectId, o) => readings(world, as, projectId, o),
      machineReading: (admin, as, projectId, o) => machineReading(world, admin, as, projectId, o),
      graded: (as, projectId, o) => graded(world, as, projectId, o),
      sharedOrigin: (as, projectId, o) => sharedOrigin(world, as, projectId, o),
      holdAt: (as, name, address, html, projectId) => holdAt(world, as, name, address, html, projectId),
      newerCapture: (as, o) => newerCapture(world, as, o),
      connection: (admin, as, o) => connection(world, admin, as, o),
      partialPdf: (as, name, o) => partialPdf(world, as, name, o),
      unmatchedPerson: (as, o) => unmatchedPerson(world, as, o),
      attested: (as, o) => attested(world, as, o),
      paperFile: (as, projectId) => paperFile(world, as, projectId),
      unretirable: (as, projectId) => unretirable(world, as, projectId),
      timeline: (as, projectId) => timeline(world, as, projectId),
      titlelessProject: (as, title) => titlelessProject(world, as, title),
      deepChain: (as, projectId, o) => deepChain(world, as, projectId, o),
      connectedSignIn: (as, o) => connectedSignIn(world, as, o),
      investigating: (as, projectId) => investigating(world, as, projectId),
      mentionedTogether: (admin, as, projectId) => mentionedTogether(world, admin, as, projectId),
      owed: (as, o) => owed(world, as, o),
      lapsed: (as, o) => lapsed(world, as, o),
      delivered: (as, o) => delivered(world, as, o),
      releaseNotice: (as, o) => releaseNotice(world, as, o),
      rendered: (as, o) => rendered(world, as, o),
      renderPending: (as, o) => renderPending(world, as, o),
      unfinished: (as, o) => unfinished(world, as, o),
      partedAddress: (as, o) => partedAddress(world, as, o),
      followed: (as, name, content, o) => followed(world, as, name, content, o),
    },
  });
}

/** R19: an older installation (no producing team recorded: `groupidentity` answers `group: null`): `storeWorld` with a first boot that bound no `INSTANCE_NAME`. */
export const olderInstallation = (opts = {}) => olderOf(storeWorld, opts);

/** R19: a founder with no handle: an unclaimed world claimed with a password and no handle; `unnamed` is the founder signed in. */
export const unnamedFounderWorld = (opts = {}) => unnamedFounder(storeWorld, opts);
