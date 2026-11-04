/* store-request R19 (STORE-REQUEST #7, B18 START; SCREENS-INQUIRY #31 J44): recipes of the team and project states a screen draws, each real acts through the world's door: a founder with no
   handle, a project's world timeline, a project whose record states no title, a connection axis made undetermined, a member's connected sign-in, a project that is investigating, two documents
   mentioned together. None inserts a row; the world's network and the runner of a sign-in are the only doubles. */
import { readFileSync } from "node:fs";
import { hold, instant, signIn } from "./door.mjs";
import { question } from "./recipes.mjs";

/** R19: a founder with no handle: an unclaimed world claimed with a password and no handle (`claim`), the founder signed in as `admin`. Takes the world factory (`storeWorld`), since the
 *  state is the claim's. Answers the world, with `founder` the signed-in member; `projectparticipants` names her `{founder: true, handle: null}`. */
export async function unnamedFounder(makeWorld, opts = {}) {
  const world = await makeWorld({ ...opts, claimed: false });
  await world.claim({ password: "a-long-founder-passphrase" });
  const founder = await signIn(world, "admin");
  return Object.assign(world, { unnamed: founder });
}

const actionDoc = (project, basis) => ["---", "object_type: action", "title: Inspection logs, 2025", "current_state: planned", "action_kind: records_request", `project: ${project}`,
  "counterparty:", "  state: named", "  role: Town Clerk", "  body: Town of Port Ellery", "action_basis:", `  - target: ${basis}`, "    kind: advances", "---", "", "An action.", ""].join("\n");

/** R19: a project's world timeline, by real acts: five events (`eventcreate`, a testimony attestation each) whose times are an EDTF month, a day, a minute and a second (two EDTF items are of
 *  undetermined order), a question, and an action advancing it (`actioncreate`, then `actioncorrespond` sent), all named in the `set` `timeline` reads. `as` holds the actions' rights.
 *  Answers `{project, question, action, events, set, timeline}`: `timeline` the owner's answer for the set. */
export async function timeline(world, as, projectId) {
  const ev = async (kind, value, precision) => (await as.act("eventcreate", { body: { kind, attestations: [{ testimony: "so it was", value: precision ? { value, precision } : value }] } })).event_id;
  const events = [await ev("meeting", "2024-03", "edtf"), await ev("filing", "2024-04", "edtf"), await ev("hearing", "2024-01-12"), await ev("issuance", "2024-05-01T10:00"), await ev("order", "2024-05-01T10:00:30")];
  const q = await question(world, as, projectId, { title: "Fee timeline" });
  const action = (await as.act("actioncreate", { body: { project: projectId, document: actionDoc(projectId, q.id) } })).id;
  await as.act("actioncorrespond", { query: { target: action, direction: "sent", at: "2026-09-19", medium: "email", party: "Town Clerk", account: "asked" }, body: {} });
  const set = [...events, q.id].join(",");
  return { project: projectId, question: q.id, action, events, set, timeline: await as.read("timeline", { query: { set } }) };
}

/** R19: a project whose record states no title: `promote` with the title in the promotion's meta only (a record the store accepts), so `image` has no `title:` line and `projectlist`
 *  names it from the meta. Answers its bundle id. */
export async function titlelessProject(world, as, title = "Pothole repairs") {
  const now = instant(world);
  const text = `---\nobject_type: project\nobjective: "x"\ncurrent_state: forming\ncreated: "${now}"\nlast_updated: "${now}"\n---\n\n## Session Log\n\n### Session ${now} | Formation | interactive\nTrigger: test\nChanges: created.\n`;
  const made = await as.act("promote", { body: { base: null, snapKey: now.replace(/[-:]/g, "") + "_nt", meta: { object_type: "project", title, current_state: "forming", created: now, last_updated: now },
    files: [{ path: "bundle.md", text }], register: [], visibility: "discoverable" } });
  return made.bundleId;
}

/** R19: a question whose connection axis is `undetermined`: a chain of `depth` (default nine) questions each resting on the one before, the first on a held document; the chain is longer than
 *  the arithmetic follows (depth bound 6, `strength/arithmetic.mjs:24`). Answers the chain's question ids, first to last. */
export async function deepChain(world, as, projectId, { depth = 9 } = {}) {
  const doc = await hold(world, as, "Rule", "The fee rose.\n", projectId);
  const ids = [(await question(world, as, projectId, { title: "Q0", legs: [{ target: doc.bundle }] })).id];
  for (let i = 1; i < depth; i++) ids.push((await question(world, as, projectId, { title: `Q${i}`, legs: [{ target: ids[i - 1] }] })).id);
  return ids;
}

/** R19: a member's connected sign-in, by the real acts of the sign-in door: the runner (the platform's agent worker, bound as `AGENT_WORKER`; a stand-in that answers the codes it is given) accepts
 *  the code the member pastes (`subscriptionsignin`, `step: "code"`) and the connection is held. Needs `storeWorld({ ai: true })`. Answers `{connected, reference}` (the `state` step's
 *  `connected`, and whether her own accounts, as ai-accounts' `accountsof` lists them for owner `member:<id>`, the read signin-door's state asks (T53), hold an `issued` one). */
export async function connectedSignIn(world, as, { code = "abc#def" } = {}) {
  world.env.AGENT_WORKER = { fetch: async (_url, init) => { const b = JSON.parse(init.body);
    return Response.json({ ok: true, member: b.member, step: b.step, connected: true, token: "sk-ant-oat01-" + "r".repeat(40), valid_for: 86400 }); } };
  /* notice signin-door:153: the sign-in's `code` holds the token on her own issued account through ai-accounts, which asks the
     disclosure first (ai-accounts R23): she is shown it by the real acts before she signs in */
  const d = await as.read("disclosureof", { query: { member: `member:${as.member}` } });
  await as.act("disclosureshown", { body: { member: `member:${as.member}`, version: d.version } });
  await as.act("subscriptionsignin", { body: { step: "code", code } });
  return { connected: (await as.act("subscriptionsignin", { body: { step: "state" } })).connected,
           reference: await issuedHeld(as) };
}

/** Whether `as`'s own accounts (`accountsof`, owner `member:<id>`) hold an account issued by a subscription sign-in (ai-accounts R19, R42). */
export async function issuedHeld(as) {
  return ((await as.read("accountsof", { query: { owner: `member:${as.member}` } })).accounts ?? []).some((a) => a.means === "issued");
}

/** R19: a project that is investigating: a document held in it and a question drawn into it resting on that document. `projectstage` reads `forming` before and `investigating` after. Answers
 *  `{question, document, before, after}`. */
export async function investigating(world, as, projectId) {
  const doc = await hold(world, as, "Doc", "text\n", projectId);
  const before = (await as.read("projectstage", { query: { project: projectId } })).stage;
  const q = await question(world, as, projectId, { title: "Q", legs: [{ target: doc.bundle }], draw: true });
  return { question: q.id, document: doc.bundle, before, after: (await as.read("projectstage", { query: { project: projectId } })).stage };
}

const AGENDA = () => JSON.parse(readFileSync(new URL("../../../../doctypes/test/fixtures/fw18-doctypes.json", import.meta.url), "utf8")).documents.agenda.text.document;
/** R19: two documents mentioned together: `admin` makes the Oakland profile active, `as` holds two agendas that print the same file numbers (read by the agenda reader), makes an entity, her
 *  testimony resolves one reference of each to it, and `connect` links them; `explore` from the first then has a hop `mentioned_together` to the second. Answers
 *  `{entity, documents: [a, b], explored}`. */
export async function mentionedTogether(world, admin, as, projectId) {
  await world.recipes.profiles(admin, ["oakland-alameda"]);
  const agenda = AGENDA();
  const html = (extra) => "<html><head><title>Agenda</title></head><body><pre>" + (agenda + extra).replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre></body></html>";
  const a = await hold(world, as, "Agenda A", html(""), projectId, { type: "text/html", read: true });
  const b = await hold(world, as, "Agenda B", html("\nAddendum.\n"), projectId, { type: "text/html", read: true });
  const ref = (await as.read("reading", { query: { sha256: a.sha } })).reading.entities[0].ref;
  const entity = (await as.act("entitycreate", { body: { kind: "ordinance", label: "Shared item", note: "n" } })).entity_id;
  for (const d of [a, b]) await as.act("resolvetestify", { body: { captureSha: d.sha, ref, entityId: entity, basis: "the agenda prints the file number" } });
  await as.act("connect", { body: { entityId: entity } });
  const explored = await as.act("explore", { body: { from: a.bundle, at: instant(world) } });
  return { entity, documents: [a.bundle, b.bundle], explored };
}
