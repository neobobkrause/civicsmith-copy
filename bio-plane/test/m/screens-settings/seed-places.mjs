/* The world for places, grouprules and bias (screens-settings R19, R25, R46, R60, R61 ...): the team's state made by the real acts of
   the owners, over store-request's world. A table is kept only to script a fault (`"none"`, a read made to fail) or an answer
   the owner gives that the page cannot be made to ask for, which is built here from the owner's own answer. */
import { storeWorld } from "./kit.mjs";
import { env } from "./fixtures.mjs";

export const PROFILE = "oakland-alameda";

/** A world with the founder (its one active administrator) and dev (a member who administers nothing), the Oakland profile active unless `profile: false`. */
export async function team({ profile = true, env = {}, devCapabilities = null } = {}) {
  const w = await storeWorld({ env });
  const founder = await w.signIn("founder");
  const dev = await w.signIn("dev", devCapabilities ? { capabilities: devCapabilities } : undefined);
  if (profile) await w.recipes.profiles(founder, [PROFILE]);
  return { w, founder, dev };
}

/** An act of a machine class (the root of trust's token): what the team's seeding does, an author the screens read as `class:admin`. Throws when refused. */
export async function machineAct(w, op, body) {
  const a = await w.door({ url: `/api/?op=${op}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } }, { token: w.env.ADMIN_TOKEN });
  const r = a.json && a.json.result;
  if (a.status >= 400 || !r || r.ok === false) throw new Error(`${op} was refused: ${JSON.stringify(a.json).slice(0, 300)}`);
  return r;
}

/** The owner's own answer to a request the page cannot be made to send (an act with a body of the caller's choosing): the whole enveloped answer. */
export async function rawAnswer(w, as, op, body, query = {}) {
  const a = await w.door({ url: `/api/?${new URLSearchParams({ op, ...query })}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } }, as);
  return a.json;
}

/** `n` offices the team holds, the last made by a machine (so that it reads as seeded), one page and one more of the offices read (500 a page). */
export async function manyOffices(w, founder, n) {
  for (let i = 0; i < n - 1; i++) await founder.act("entitycreate", { body: { kind: "office", label: "Office " + String(i).padStart(4, "0"), note: "n" } });
  await machineAct(w, "entitycreate", { kind: "office", label: "Seeded office", note: "n" });
}

/** Every page of the offices (the owner's own reads, 500 a page). */
export async function officesOf(as) {
  const out = []; let after = null;
  do {
    const r = await as.read("entitieskind", { query: { kind: "office", limit: "500", ...(after ? { after } : {}) } });
    out.push(...r.entities); after = r.next;
  } while (after);
  return out;
}

/** A table that answers every read of `op` as the world does, but a read `after` a first page, silently failing (a later page that cannot be read). */
export const laterPageFails = (as) => ({ entitieskind: async (q) => (q.after ? "none" : env(await as.read("entitieskind", { query: q }))) });
/** A table that answers the courts read silently failing, every other read as the world does. */
export const courtsFail = (as) => ({ entitieskind: async (q) => (q.kind === "body" ? "none" : env(await as.read("entitieskind", { query: q }))) });
/** The world's answer to `startfrom`, with the elsewhere route's pointer unread (null): a list that could not be read. */
export const pointerUnread = (as) => ({ startfrom: async () => { const r = await as.read("startfrom"); return env({ ...r, routes: r.routes.map((x) => (x.route === "elsewhere" ? { ...x, pointer: null } : x)) }); } });
/** The world's answer to `profiles`, with a profile held that is only for tests among those active (the world refuses to activate one). */
export const testProfileActive = (as) => ({ profiles: async () => { const r = await as.read("profiles"); return env({ ...r, profiles: [{ id: "test-port-ellery", name: "Port Ellery", covers: [], test: true }] }); } });
/** The world's answer to `profiles`, with no profile offered to choose (the world's jurisdictions always offer one). */
export const noChoices = (as) => ({ profiles: async () => env({ ...(await as.read("profiles")), choices: [] }) });

/* ---- grouprules ---- */

/** The paragraphs of the document the rules are drafted from. */
export const RULES_TEXT = ["Comments close five days before the meeting.", "Speakers register by noon on the meeting day."];

/** `as` holds a text document (`name` ends .txt so that it is read as text); the reading job runs on the scheduler's alarm, so its text units
 *  (the passages, each with the extent it is found at) are the owner's own. Answers `{sha, bundle, units}`. */
export async function holdDoc(w, as, name = "rules.txt", paragraphs = RULES_TEXT) {
  const h = await w.recipes.hold(as, name, paragraphs.join("\n\n"));
  await w.tick(60000);
  const r = await as.read("reading", { query: { sha256: h.sha } });
  if (!r.found || !Array.isArray(r.text_units) || r.text_units.length < paragraphs.length) throw new Error("the document was not read: " + JSON.stringify(r).slice(0, 200));
  return { ...h, units: r.text_units };
}

/** `as` drafts a rule from the passage `unit` (the document's text unit) of `doc`, by the real ruledraft. Answers the owner's answer. */
export const draftRule = (as, doc, unit, section, entry, reason = "It is stated there.") =>
  as.act("ruledraft", { body: { section, entry, source: { captureSha: doc.sha, extent: doc.units[unit].extent }, reason } });

const deadline = (rule, applies_to, citation, over = {}) => ({ rule, applies_to, units: "days", amount: 5, starts: "hearing", citation, effective_from: "2026-07-01", ...over });
const fact = (key, statement, citation, over = {}) => ({ key, trigger: "pending_measure_or_candidate", statement, citation, effective_from: "2026-03-01", ...over });

/** A team holding rules in each of the states the screen draws (local-facts R10-R13): ana drafted a tier 1 deadline (public comment), a tier 2 one (party
 *  participation) and a legal fact for no kind (tier undetermined); dev, who views, drafted a legal fact; a legal fact was confirmed by lu; a deadline
 *  was drafted and withdrawn. `ids` names each rule by the owner's own id. */
export async function rulesTeam() {
  const t = await team();
  t.ana = await t.w.signIn("ana");
  t.lu = await t.w.signIn("lu");
  t.doc = await holdDoc(t.w, t.ana);
  const id = async (p) => (await p).rule;
  t.ids = {
    tier1: await id(draftRule(t.ana, t.doc, 0, "deadlines", deadline("parks_comment_cutoff", "public_comment", "Parks Commission Rule 4(b)"))),
    tier2: await id(draftRule(t.ana, t.doc, 0, "deadlines", deadline("rent_board_statement", "party_participation", "Hearing Rule 6(a)", { amount: 10, effective_from: "2026-01-01" }))),
    mine: await id(draftRule(t.dev, t.doc, 1, "legal_facts", fact("council_speakers", "Speakers register by noon on the meeting day", "Council Rules of Procedure 3.2", { applies_to: ["public_comment"] }))),
    noKind: await id(draftRule(t.ana, t.doc, 1, "legal_facts", fact("city_clerk_office_hours", "A recording needs notice", "Clerk Rule 2", { trigger: "recording", effective_from: "2026-10-01" }))),
    inForce: await id(draftRule(t.ana, t.doc, 1, "legal_facts", fact("three_minutes", "Each speaker gets three minutes", "Planning Commission Bylaws, Article 5", { applies_to: ["public_comment"], effective_from: "2026-01-01" }))),
    withdrawn: await id(draftRule(t.ana, t.doc, 0, "deadlines", deadline("withdrawn_rule", "public_comment", "x", { effective_from: "2026-01-01" }))),
  };
  await t.lu.act("ruleconfirm", { body: { rule: t.ids.inForce } });
  await t.lu.act("rulewithdraw", { body: { rule: t.ids.withdrawn, reason: "wrong" } });
  return t;
}

/** The team's own account, held (T53, R95: by `aiaccountadd`, the alpha's group key retired) by the real acts (the password asked again first, as an administrator's page does): the assistant is reachable. */
export const SEAL = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-settings-test-only" };
export async function holdKey(w, founder, key = "sk-ant-api03-TEAM-KEY-0123456789abcdef") {
  await founder.act("reauth", { body: { password: w.password } });
  await founder.act("aiaccountadd", { body: { owner: "group", provider: "anthropic", plan: "api-team", means: "sealed", secret: key } });
}

/** `as` vouches for the held document `bundle` (the selection and its release, as Home's "Vouch" does). */
export async function vouch(as, bundle) {
  const s = await as.act("select", { body: { ids: [bundle] } });
  return as.act("release", { query: { handle: s.handle }, body: { handle: s.handle, acknowledgment: "They are what they say.", mitigation: "I read them." } });
}

/** The pages of the owner's picker read, as the screen asks it: the first (200) and, while it says truncated, those the cursor names (1000 each). */
export async function pickerPages(as, state = "held_and_vouched") {
  const pages = []; let q = { state, fields: "picker", limit: "200" };
  for (;;) {
    const r = await as.read("heldcaptures", { query: q });
    pages.push(r);
    if (!r.truncated || !r.next) return pages;
    q = { state, fields: "picker", limit: "1000", after: r.next };
  }
}

/* ---- bias ---- */

import { createHash } from "node:crypto";
const sha256Hex = (t) => createHash("sha256").update(t).digest("hex");
const q = (x) => JSON.stringify(String(x));
const STATES = ["draft", "proposed", "adopted"];

/** The registry's subject: an entity the team holds under `label`. Answers its entity id. */
export const subjectNamed = async (as, label = "City Housing Department") => (await as.act("entitycreate", { body: { kind: "body", label, note: "n" } })).entity_id;

/** `as` writes a bias set the way the page's "Write a set" does (a minted id, then `promote` of its bundle.md), moved on through the states to `upTo`
 *  (a set reaches adopted only through proposed: the owner's state machine). Answers the last promotion's answer. */
export async function writeSet(w, as, { title, subject, text, why, not = "It does not check whether a second source was independent of the first.", kind = "scrutiny", upTo = "proposed", locked = false, nullifies = null, id = "s1" }) {
  const iso = new Date(w.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const minted = await as.read("allocid", { query: { prefix: "BIAS", year: iso.slice(0, 4) } });
  const bundleId = minted.id + "-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-$/, "");
  let base = null, made = null;
  for (const [i, state] of STATES.slice(0, STATES.indexOf(upTo) + 1).entries()) {
    const yaml = ["---", "object_type: bias", "title: " + q(title), "current_state: " + state, "prior_state: " + (i === 0 ? "null" : STATES[i - 1]), "created: " + q(iso), "last_updated: " + q(iso), "statements:",
      "  - id: " + q(id), "    kind: " + q(kind), "    subject: " + q(subject), "    text: " + q(text), "    justification: " + q(why), "    citations: []", "    locked: " + locked,
      ...(nullifies ? ["    nullifies: " + q(nullifies)] : []), "---", "", "## What This Does Not Enforce", "", not, ""].join("\n");
    made = await as.act("promote", { body: { bundleId, base, snapKey: iso.replace(/[-:]/g, "") + "_" + sha256Hex(bundleId + state).slice(0, 8),
      meta: { object_type: "bias", title, current_state: state, created: iso, last_updated: iso }, files: [{ path: "bundle.md", text: yaml }], register: [] } });
    base = made.bundleSha;
  }
  return made;
}

/** `as` adopts the set `bundleId` for the team (`scope: "instance"`) or the project `scopeId`, with a reason (the owner reads the set and scope from the address, the reason from the body). */
export const adoptSet = (as, bundleId, reason = "We agreed.", scopeId = null) =>
  as.act("biasadopt", { query: { bundleId, scope: scopeId ? "project" : "instance", ...(scopeId ? { scopeId } : {}) }, body: { reason } });

/** A team with a subject in the registry, the founder, dev (who may start projects) and a project dev started. */
export async function biasTeam({ env = {} } = {}) {
  const t = await team({ profile: false, env, devCapabilities: ["contribute", "create_projects"] });
  t.dept = await subjectNamed(t.founder);
  t.project = await t.w.recipes.project(t.dev, "The Coliseum lease");
  return t;
}

/** Work made under a lens that has since moved: a question concluded under the project's lens (a finding, bias R40), then the project's lens changed and the
 *  scheduler's sweep run. Answers the work's key as bias names it (`finding:<bundle>`). The founder owns the project's lens here (the page's reader). */
export async function debtOf(t, { text0 = "We read the Department's reports closely.", text1 = "A late reply is not read as a refusal." } = {}) {
  const { w, founder, dept } = t;
  const project = await w.recipes.project(founder, "Findings project");
  await adoptSet(founder, (await writeSet(w, founder, { title: "First lens", subject: dept, text: text0, why: "It writes the figures it is judged by.", upTo: "adopted", id: "p1" })).bundleId, "The first.", project);
  const doc = await w.recipes.hold(founder, "evidence.txt", "The lease was signed.");
  const id = "INQ-2026-0001-signed", iso = new Date(w.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const { word } = await import("../../../src/setup-words/index.mjs");
  const md = (state, prior, extra) => ["---", "id: " + id, "object_type: inquiry", "schema: inquiry@1", 'title: "Was it signed?"', "current_state: " + state, "prior_state: " + prior, "created: " + q(iso), "last_updated: " + q(iso),
    "references:", "  - target: " + doc.bundle, "    rel: cites", "    status: confirmed", "state_history: []", "surfaced_by: human", 'disposition_reason: ""', "basis:", "  - target: " + doc.bundle, "    role: supports",
    ...extra, "---", "", "## Question", "", "Was it signed?", "", word("conformance.rests"), "", "## Conclusion", "", word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const promote = (state, prior, extra, base) => founder.act("promote", { body: { bundleId: id, base, snapKey: iso.replace(/[-:]/g, "") + "_" + sha256Hex(id + state).slice(0, 8),
    meta: { object_type: "inquiry", title: "Was it signed?", current_state: state, created: iso, last_updated: iso }, files: [{ path: "bundle.md", text: md(state, prior, extra) }], register: [] } });
  const opened = await promote("open", "null", ["project: " + project], null);
  await promote("concluded", "open", ["project: " + project, 'conclusion: "it was signed"', 'falsifier: "a ledger showing otherwise"'], opened.bundleSha);
  await adoptSet(founder, (await writeSet(w, founder, { title: "Second lens", subject: dept, text: text1, why: "Offices miss dates for many reasons.", upTo: "adopted", id: "p2" })).bundleId, "It changed.", project);
  for (let i = 0; i < 12; i++) { await w.tick(120000); await founder.read("whoami"); }   // the sweep runs on the scheduler's alarm; the reads keep the session unlocked
  const run = "finding:" + id;
  if (!(await founder.read("biasdebt", { query: { run } })).found) throw new Error("no debt was raised");
  return run;
}
