/* store-request R19 (STORE-REQUEST #3, B6 START; K5148; SCREENS-INQUIRY #29 J42, `op-tables.md` §5.3): the recipes the screens' jobs need, each a
   sequence of real acts through the world's door that answers what its acts answered and inserts no row. A refused act throws, naming the op.
   The platform enters only as the world's doubles: the network (`world.script`, a daemon's fetch of a public address) and the environment. */
import { generateKeyPairSync, createHash, sign as cryptoSign } from "node:crypto";
import { generate } from "../../pdfgen.mjs";
import { HEADINGS } from "../../../src/record-grammar/index.mjs";
import { caseRatifyStatement, ratifyStatement, NS_RATIFY } from "../../../src/sshsig.mjs";
import { memoryBucket } from "../store-assembly/world.mjs";
import { hold, project, resultOf, refusedAct, instant, hex } from "./door.mjs";
import { PLANS, HOSTS } from "../ai-accounts/catalogue.mjs";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const counter = (world, key) => (world[key] = (world[key] || 0) + 1);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A web page held and read: its paragraphs and footnotes are text units of the reading, so a leg can address a paragraph (`doc-para`) or a
 *  footnote (`doc-part`). Answers `{sha, bundle, read}` as `hold` does. */
export async function page(world, as, name, { paragraphs = ["The council met on Tuesday and voted on the budget.", "The vote was five to two."], footnotes = [], project: filed = "" } = {}) {
  const html = `<html><head><title>${esc(name)}</title></head><body>\n<h1>${esc(name)}</h1>\n${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n")}\n`
    + (footnotes.length ? `<ol>${footnotes.map((f, i) => `<li id="fn${i + 1}">${esc(f)}</li>`).join("")}</ol>\n` : "") + "</body></html>";
  return hold(world, as, name, html, filed, { type: "text/html", read: true });
}

/** A PDF held and read: `pages` pages of `lines` text lines (pdfgen's seeded generator), so a leg can address a page (`pdf-page`). Answers `{sha, bundle, read, pages}`. */
export async function pdf(world, as, name, { pages = 3, lines = 4, seed = slug(name), project: filed = "", fonts = null } = {}) {
  const bytes = await generate({ kind: "pdf", seed, size: { pages, lines }, kinds: ["text"], ...(fonts ? { fonts } : {}) }).bytes();
  return { ...(await hold(world, as, name, bytes, filed, { type: "application/pdf", read: true })), pages };
}

const LEG_KEYS = ["grade", "grade_axis", "grade_source", "ground", "note", "extent_kind", "extent_page", "extent_para", "extent_part", "extent_ref", "extent_rect"];

/** A question promoted into `projectId`, as the question wizard promotes it (`promote` of an inquiry with no base): the whole inquiry document the record's grammar asks (its core
 *  fields, the six headings in order, a recheck trigger), its id the minted one and a slug of the title. `legs` are `{target, role?, ...}` with the extent and grade keys the leg
 *  grammar reads; `draw: true` draws it into the project too (`drawquestion`). Answers the promotion's answer with `id`. */
export async function question(world, as, projectId, { title = "A question", text = "Is it so?", legs = [], id = null, draw = false, subject = null } = {}) {
  const now = instant(world);
  const qid = id ?? (await as.read("allocid", { query: { prefix: "INQ", year: now.slice(0, 4) } })).id + (slug(title) !== "x" ? "-" + slug(title).slice(0, 40).replace(/-+$/, "") : "");
  const targets = [...new Set(legs.map((l) => l.target))];
  const heads = HEADINGS.inquiry;
  const front = ["---", `id: ${qid}`, "object_type: inquiry", "schema: inquiry@1", `title: ${JSON.stringify(title)}`, "current_state: open", "prior_state: null", `created: "${now}"`,
    `last_updated: "${now}"`, "surfaced_by: human",
    ...(projectId ? [`project: ${projectId}`] : []),
    ...(subject ? [`subject_entity: ${subject}`] : []),
    "produced_by:", "  mode: assisted", "  capability_tier: session", "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
    ...(targets.length ? ["references:", ...targets.flatMap((t) => [`  - target: ${t}`, "    rel: cites", "    status: confirmed"])] : ["references: []"]),
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role ?? "supports"}`,
      ...LEG_KEYS.filter((k) => l[k] !== undefined).map((k) => `    ${k}: ${Array.isArray(l[k]) ? "[" + l[k].join(", ") + "]" : l[k]}`)])] : []),
    "recheck_triggers:", "  - text: the sources change", "    description: a source this question rests on changes or is withdrawn",
    "---", ""];
  heads.forEach((h, i) => { front.push(h, ""); if (i === 0) front.push(text, ""); });
  const made = await as.act("promote", { body: { bundleId: qid, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + hex(qid).slice(0, 8),
    meta: { object_type: "inquiry", title, current_state: "open", created: now, last_updated: now }, files: [{ path: "bundle.md", text: front.join("\n") }], register: [] } });
  if (draw) await as.act("drawquestion", { query: { project: projectId, inquiry: qid, note: "" } });
  return { ...made, id: qid };
}

/** `n` questions drawn into `projectId` (a promotion and a `drawquestion` each); answers their ids in order. */
export async function questions(world, as, projectId, n, { legsOf = null } = {}) {
  const ids = [];
  for (let i = 0; i < n; i++)
    ids.push((await question(world, as, projectId, { title: `Question ${i + 1}`, text: `Is ${i + 1} so?`, legs: legsOf ? legsOf(i) : [], draw: true })).id);
  return ids;
}

/** The team's Claude account, by an administrator's real acts (ai-accounts R61, T53): her password again (`reauth`), the team's account of
 *  ai-accounts' published catalogue's team API plan added with its key sealed (`aiaccountadd`, owner `group`) and switched on
 *  (`aiaccountswitch`), and the recipient notice of its host read by her (`aisend`). The key is a stand-in no call ever sends.
 *  Answers the account's id. Needs the assembled plane's ai-accounts to hold a catalogue (else `aiaccountadd` is CATALOGUE_UNAVAILABLE). */
export async function aiAccount(world, as) {
  if (world.__aiAccount) return world.__aiAccount;
  await as.act("reauth", { body: { password: as.password } });
  const added = await as.act("aiaccountadd", { body: { owner: "group", provider: PLANS.provider, plan: PLANS.teamApi, means: "sealed",
    secret: "sk-ant-api03-" + "w".repeat(40) } });
  if (!added || added.ok !== true || typeof added.account_id !== "string") throw refusedAct("aiaccountadd", { json: added });
  const on = await as.act("aiaccountswitch", { body: { account_id: added.account_id, on: true } });
  if (!on || on.ok !== true) throw refusedAct("aiaccountswitch", { json: on });
  await noticeSeen(as);
  world.__aiAccount = added.account_id;
  return added.account_id;
}

/** The recipient notice of the team account's host, read by `as` (`aisend`, ai-accounts R51). */
export async function noticeSeen(as) {
  const seen = await as.act("aisend", { body: { provider: PLANS.provider, host: HOSTS.main } });
  if (!seen || seen.ok !== true) throw refusedAct("aisend", { json: seen });
}

/** A run opened by `as` over a project (`airunopen`), under the account `aiAccount` set. Answers the run's id. */
export async function openRun(world, as, projectId) {
  const run = `RUN-${instant(world).slice(0, 4)}-${String(counter(world, "__runs")).padStart(4, "0")}-world`;
  const opened = await as.act("airunopen", { body: { run, contextType: "project", contextId: projectId, skillVersion: "contradiction@1",
    principalClaude: `member:${as.member}`, mode: "check" } });
  if (!opened || opened.started !== true) throw new Error(`storeWorld: airunopen was refused: ${JSON.stringify(opened).slice(0, 400)}`);
  return run;
}

/** R19: a contradiction candidate by real acts (`storeWorld({ ai: true })`, an administrator `as`): the team's Claude account and an open run;
 *  two projects, a document held in each; one question resting on both, one supporting and one cutting against it; the pair the pairing forms
 *  (key K1, `contradictionpairs`); and the run's proposal over it (`contradictionpropose`) with `label`. Answers
 *  `{candidate, inquiry, run, projects: [a, b], documents: [a, b], proposal}`; `contradictioncandidates` reads it by the inquiry or a document. */
export async function contradiction(world, as, { label = "record", reason = "one document says the fee rose, the other that it fell" } = {}) {
  if (!world.env.CIVICSMITH_TEST_INSTANCE)
    throw new Error("storeWorld: recipes.contradiction needs a run, and a run opens only on a test instance: make the world with storeWorld({ ai: true })");
  const n = counter(world, "__contradictions");
  await aiAccount(world, as);
  const pa = await project(world, as, `Contradiction ${n} alpha`), pb = await project(world, as, `Contradiction ${n} beta`);
  const run = await openRun(world, as, pa);
  const a = await hold(world, as, `Rule ${n}`, "The fee rose in 2026.\n", pa), b = await hold(world, as, `Act ${n}`, "The fee fell in 2026.\n", pb);
  const q = await question(world, as, pa, { title: `Did the fee rise ${n}`, text: "Did the fee rise?", legs: [{ target: a.bundle, role: "supports" }, { target: b.bundle, role: "cuts_against" }] });
  const formed = (await as.read("contradictionpairs", { query: { key: "K1" } })).pairs.find((p) => p.inquiry === q.id);
  if (!formed) throw new Error(`storeWorld: the pairing formed no K1 pair over ${q.id}`);
  const proposal = await as.act("contradictionpropose", { body: { run, proposals: [{ key: "K1", a: formed.a, b: formed.b, label, reason }] } });
  return { candidate: proposal.candidates[0].candidate, inquiry: q.id, run, projects: [pa, pb], documents: [a.bundle, b.bundle], proposal };
}

/** R19: a document set aside that a question waits on, by real acts: a project and a question in it; a member's request to capture a public address
 *  for the question (`capturerequest`), drained by the daemon (`capturerequestdrain` with the daemon credential; the address answered by the world's
 *  network, scripted); the request `captured` and its document promoted at `collected`; and the member's `heldsetaside`. Answers
 *  `{project, question, request, sha, document, aside}`; `heldrestore` is the act that undoes it. */
export async function setAside(world, as, { project: filed = null, reason = "it is the wrong year", text = "<html><head><title>Council minutes</title></head><body><p>The council met.</p></body></html>" } = {}) {
  const n = counter(world, "__setasides");
  const projectId = filed ?? await project(world, as, `Set aside ${n}`);
  const q = await question(world, as, projectId, { title: `What was asked ${n}`, text: "What did the council decide?" });
  const address = `https://records.example.org/minutes-${n}.html`;
  world.script(address, async () => new Response(text, { status: 200, headers: { "content-type": "text/html" } }));
  const asked = await as.act("capturerequest", { body: { address, target: q.id } });
  const drained = await world.door({ url: "/api/?op=capturerequestdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } },
                                    { token: world.env.DAEMON_TOKEN });
  const done = (resultOf(drained).captured || []).find((c) => c.request === asked.request);
  if (!done || !done.promoted || !done.promoted.bundle_id) throw refusedAct("capturerequestdrain", drained);
  const aside = await as.act("heldsetaside", { body: { ids: [done.promoted.bundle_id], reason } });
  return { project: projectId, question: q.id, request: asked.request, sha: done.sha, document: done.promoted.bundle_id, aside };
}

const u32 = (n) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = Buffer.from(v); return Buffer.concat([u32(b.length), b]); };
/** An SSH signature (PROTOCOL.sshsig, armored) over `message` in `namespace` by `key` (`{privateKey, raw}`): what `ssh-keygen -Y sign` makes, off the world, with the member's own key. */
function sshsig(key, message, namespace) {
  const signed = Buffer.concat([Buffer.from("SSHSIG"), sstr(namespace), sstr(""), sstr("sha512"), sstr(createHash("sha512").update(message).digest())]);
  const blob = Buffer.concat([Buffer.from("SSHSIG"), u32(1), sstr(Buffer.concat([sstr("ssh-ed25519"), sstr(key.raw)])), sstr(namespace), sstr(""), sstr("sha512"),
    sstr(Buffer.concat([sstr("ssh-ed25519"), sstr(cryptoSign(null, signed, key.privateKey))]))]);
  return `-----BEGIN SSH SIGNATURE-----\n${blob.toString("base64").replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;
}

/** A signing key of the member's own, registered by her real act (`signerregisterown`: every administrator is told); a case is signed, and checked, with one. Once a member.
 *  Answers the key: `{keyB64, sign(message, namespace)}`, the private half never leaving it. */
export async function signer(world, as) {
  const held = world.__signers || (world.__signers = new Map());
  if (held.has(as.member)) return held.get(as.member);
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const keyB64 = Buffer.concat([sstr("ssh-ed25519"), sstr(raw)]).toString("base64");
  await as.act("signerregisterown", { body: { keyB64, comment: "the world's key" } });
  const key = { keyB64, sign: (message, namespace = NS_RATIFY) => sshsig({ privateKey, raw }, message, namespace) };
  held.set(as.member, key);
  return key;
}

/** R19: a concluded finding a case can be checked on, by real acts: a web page held and read (its text is what travels with the case), a question in the project resting on it
 *  (one supporting leg), the member's own reading concluded (`conclude`), her signing key (`signer`) and the two minutes the scheduler needs to make the document's publication
 *  copy (`world.tick`: the clock moves on). `as` holds `publish` for the check to be asked. Answers `{id, document, project, concluded, publish}`; `publish` is the `{query, body}` of
 *  `publishpreflight` and `publishcheck` over it, each authored field stated, so `as.act("publishcheck", finding.publish)` is held. */
export async function finding(world, as, projectId, { title = "Seven days", text = "Is the city repairing reported potholes within seven days?",
                                                      reading = "Reported potholes are repaired within seven days.", falsifier = "The work orders show otherwise." } = {}) {
  const doc = await page(world, as, `${title} source ${counter(world, "__findings")}`, { paragraphs: [reading], project: projectId });
  const q = await question(world, as, projectId, { title, text, legs: [{ target: doc.bundle, role: "supports", extent_kind: "doc-para", extent_para: 1 }], draw: true });
  const concluded = await as.act("conclude", { query: { target: q.id, reading, falsifier } });
  await signer(world, as);
  await world.tick(120_000);
  return { id: q.id, document: doc.bundle, project: projectId, concluded, publish: { query: { project: projectId }, body: {
    targets: [q.id], roles: { [doc.bundle]: "supporting", [q.id]: "load_bearing" }, statement: "This case does not cover repairs made after the reports were closed.",
    scope: "Potholes reported in 2026.", subjectPosition: "not_sought", subjectJustification: "The question concerns the city's own repair policy.",
    biasAcknowledgement: "We favour prompt repairs.", excluded: [], tieAttested: true } } };
}

/** R19 (K5178; SCREENS-INQUIRY #29 J42, STORE-REQUEST #3 J11 (2)): a conflict between two projects, by real acts, each half seen by the members of one project only (K3: two
 *  inquiries whose accepted readings rest on one document and state claims). `as` is an administrator (she sets up the team's Claude account). Three members are signed in
 *  (`create_projects`): an owner for each of two hidden projects, and a third, joined to both (each owner invites her, she joins), who opens the run and sees the conflict whole. One
 *  document is held by neither project; each project has a question of its own that rests on it and concludes it in its own words (`conclude` with `project` and `reading`: an
 *  accepted reading, the project's CURRENT, adopting those words), so the pairing forms the K3 pair over the document (`contradictionpairs`) and the run proposes it
 *  (`contradictionpropose`, `label`, default `record`: a duty). `through` stops the story where a test needs it: `notice` (each project's members are told of an unseen record),
 *  `asked` (the first project has asked to resolve it, `contradictionoptin`: the second's notice says `asked_by_another`), `revealed` (the second has asked too: the projects are named to each other)
 *  or `responded` (the first project's member has responded, `contradictionrespond`, sharing her cover). Answers
 *  `{candidate, inquiries: [a, b], run, projects: [a, b], members: [a, b], principal, document, proposal, optIns, response}`: `members` and `principal` are signed-in members (`act`, `read`);
 *  `optIns` and `response` the answers of the acts done. `hidden: false` makes the projects discoverable (named to each other from the start, R50). */
export async function conflict(world, as, { label = "record", through = "notice", hidden = true, reason = "the two projects read the same document in opposite ways" } = {}) {
  if (!world.env.CIVICSMITH_TEST_INSTANCE)
    throw new Error("storeWorld: recipes.conflict needs a run, and a run opens only on a test instance: make the world with storeWorld({ ai: true })");
  const STAGES = ["notice", "asked", "revealed", "responded"];
  if (!STAGES.includes(through)) throw new Error(`storeWorld: recipes.conflict goes through one of ${STAGES.join(", ")}, not ${JSON.stringify(through)}`);
  const n = counter(world, "__conflicts");
  await aiAccount(world, as);
  const caps = { capabilities: ["contribute", "create_projects"] };
  const members = [await world.signIn(`conflict-${n}-alpha`, caps), await world.signIn(`conflict-${n}-beta`, caps)];
  const projects = [];
  for (const [i, m] of members.entries()) projects.push(await project(world, m, `Conflict ${n} ${i ? "beta" : "alpha"}`, { visibility: hidden ? null : "discoverable" }));
  const judge = await world.signIn(`conflict-${n}-judge`, caps);
  for (const [i, m] of members.entries()) {
    await m.act("projectinvite", { query: { projectId: projects[i], handle: judge.handle } });
    await judge.act("projectjoin", { query: { projectId: projects[i] } });
  }
  await noticeSeen(judge);   /* the team's account is used for her only once she has read its host's notice */
  const run = await openRun(world, judge, projects[0]);
  const doc = await hold(world, members[0], `Fee schedule ${n}`, `The fee was set in 2026 (${n}).\n`, "");
  const words = ["The fee rose in 2026.", "The fee did not rise in 2026."];
  const inquiries = [];
  for (const [i, m] of members.entries()) {
    const q = await question(world, m, projects[i], { title: `Did the fee rise ${n} ${i ? "beta" : "alpha"}`, text: "Did the fee rise?", legs: [{ target: doc.bundle, role: "supports" }], draw: true });
    await m.act("conclude", { query: { target: q.id, project: projects[i], reading: words[i], falsifier: i ? "The ledger shows a rise." : "The ledger shows no rise." } });
    inquiries.push(q.id);
  }
  const pairs = (await judge.read("contradictionpairs", { query: { key: "K3" } })).pairs;
  const formed = pairs.find((p) => inquiries.includes(p.a.inquiry) && inquiries.includes(p.b.inquiry));
  if (!formed) throw new Error(`storeWorld: the pairing formed no K3 pair over ${inquiries.join(" and ")}`);
  const proposal = await judge.act("contradictionpropose", { body: { run, proposals: [{ key: "K3", a: formed.a, b: formed.b, label, reason }] } });
  const candidate = proposal.candidates[0].candidate;
  const out = { candidate, inquiries, run, projects, members, principal: judge, document: doc.bundle, proposal, optIns: [], response: null };
  if (through === "notice") return out;
  out.optIns.push(await members[0].act("contradictionoptin", { query: { candidate, project: projects[0] }, body: { words: "We would like to resolve it." } }));
  if (through === "asked") return out;
  out.optIns.push(await members[1].act("contradictionoptin", { query: { candidate, project: projects[1] }, body: { words: "So would we." } }));
  if (through === "revealed") return out;
  out.response = await members[0].act("contradictionrespond", { query: { candidate, project: projects[0] }, body: { text: "Our reading rests on the fee schedule.", disclose: { cover: true } } });
  return out;
}

/** R19 (K5178; STORE-REQUEST #3 J11): a case published, by the real ceremony. `finding` is `recipes.finding`'s answer; `as` is its member (the owner of its project, holding `publish`).
 *  `publish` prepares the case document; she gives her password again (`reauth`), signs the case and its finding with her key (`signer`) and `caseratify` ratifies it; the finding's
 *  document crosses to the published store and the case file is assembled (the recipe binds the published store, `PUBLISHED`, as an installation that publishes has it); each part of the case file is then fetched as anyone
 *  fetches it (`publishedbytes`). Answers `{case, edition, finding, published, ratified, manifest, parts}`: `parts` are the case file's bytes, ready for another team's `caseimport`. */
export async function published(world, as, finding) {
  world.env.PUBLISHED ??= memoryBucket();   /* an installation that publishes binds both buckets; the default world binds the captures alone */
  const key = await signer(world, as);
  const prepared = await as.act("publish", { query: finding.publish.query, body: { ...finding.publish.body, tieAttested: true } });
  const doc = prepared.caseDocument.doc_sha, pin = (prepared.findings.find((f) => f.target === finding.id) || {}).bundleSha;
  if (!pin) throw new Error(`storeWorld: the case document ${prepared.caseId} does not pin ${finding.id}`);
  await as.act("reauth", { body: { password: as.password } });
  const ratified = await as.act("caseratify", { body: { caseId: prepared.caseId, edition: prepared.edition, expectedSha: doc,
    sig: key.sign(caseRatifyStatement(prepared.caseId, prepared.edition, doc)),
    members: [{ id: finding.id, sha: pin, signature: key.sign(ratifyStatement(finding.id, pin)) }] } });
  const container = ratified.container;
  if (!container || !Array.isArray(container.part_addresses) || !container.part_addresses.length)
    throw new Error(`storeWorld: the case ${prepared.caseId} was ratified but its case file was not built: ${JSON.stringify(ratified.container).slice(0, 300)}`);
  const parts = [];
  for (const a of container.part_addresses) {
    const got = await world.door({ url: `/api/?${a.zip}`, init: { method: "GET" } }, null);
    if (got.status !== 200 || !got.bytes) throw refusedAct("publishedbytes", got);
    parts.push(got.bytes);
  }
  return { case: prepared.caseId, edition: prepared.edition, finding: finding.id, published: prepared, ratified, manifest: container.manifest_sha, parts };
}

/** R19 (K5178; SCREENS-INQUIRY #29 J42 (c)): another team's case, imported by the real act. A second world (`makeWorld()`, the source team) has a member publish a finding by the real
 *  ceremony (`published`), and `as` imports its case file here (`caseimport`, the parts as base64) and, with `accept` (default), accepts the edition's finding (`importaccept`, which
 *  asks that it recreated from its case file). Answers `{import, edition, case, group, finding, ref, imported, accepted, source}`: `ref` is the finding as a leg names it
 *  (`imported:<import>/<finding>`), `source` the source team's `{world, member, project, finding, published}`. */
export async function imported(world, as, { accept = true, title = "Seven days", reading = "Reported potholes are repaired within seven days." } = {}, makeWorld) {
  const source = await makeWorld();
  const publisher = await source.signIn("publisher", { capabilities: ["contribute", "create_projects", "publish"] });
  const projectId = await source.recipes.project(publisher, "The source team's potholes");
  const found = await source.recipes.finding(publisher, projectId, { title, reading });
  const case_ = await published(source, publisher, found);
  const done = await as.act("caseimport", { body: { parts: case_.parts.map((b) => Buffer.from(b).toString("base64")) } });
  const out = { import: done.import, edition: done.edition, case: done.case, group: done.group, finding: found.id, ref: `imported:${done.import}/${found.id}`, imported: done, accepted: null,
                source: { world: source, member: publisher, project: projectId, finding: found, published: case_ } };
  if (accept)
    out.accepted = await as.act("importaccept", { body: { import: done.import, edition: done.edition, findings: [found.id], checked: "every passage against its document", reason: "We recreated it whole." } });
  return out;
}

/** R19 (K5178; J42 (c)): a question of `projectId` resting on another team's accepted finding, by the real act (`citeimported`). With no `from`, the import is made here (`imported`, accepted).
 *  Answers `{...import, question, cited}`: `cited` the act's answer. */
export async function cited(world, as, projectId, { from = null, title = "Resting on another team", text = "Is it so?", role = "supports" } = {}, makeWorld) {
  const imp = from ?? await imported(world, as, {}, makeWorld);
  const q = await question(world, as, projectId, { title, text });
  const done = await as.act("citeimported", { query: { inquiry: q.id, import: imp.import, finding: imp.finding, edition: imp.edition, role, note: "" } });
  return { ...imp, question: q.id, cited: done };
}

/** R19 (K5178; J42 (c)): a project re-running another team's work, by the real acts: the import (`imported`, accepted) unless `from`, a project of `as` (`project`), the project declared a
 *  re-run of the edition (`rerunstart`) and, with `through: "paired"` (default), a finding of its own (`finding`) paired with the source's (`rerunpair`). `through: "started"` stops
 *  at the declaration. Answers `{...import, project, rerun, own, pairing}`: `own` the finding, `rerun` and `pairing` the acts' answers (`pairing` null when not paired). */
export async function rerun(world, as, { from = null, through = "paired", title = "Our own seven days" } = {}, makeWorld) {
  if (!["started", "paired"].includes(through)) throw new Error(`storeWorld: recipes.rerun goes through "started" or "paired", not ${JSON.stringify(through)}`);
  const imp = from ?? await imported(world, as, {}, makeWorld);
  const projectId = await project(world, as, `Re-running another team's work ${counter(world, "__reruns")}`);
  const started = await as.act("rerunstart", { query: { project: projectId, import: imp.import, edition: imp.edition } });
  if (through === "started") return { ...imp, project: projectId, rerun: started, own: null, pairing: null };
  const own = await finding(world, as, projectId, { title });
  const pairing = await as.act("rerunpair", { query: { project: projectId, source_finding: imp.ref, own_finding: own.id, edition: imp.edition } });
  return { ...imp, project: projectId, rerun: started, own, pairing };
}

/** R19 (K5178; J42 (d)): the team's Claude account set up by an administrator's real acts (`aiAccount`: `reauth`, `aiaccountadd`, `aiaccountswitch`, `aisend`), so the
 *  assistant is reachable (`assistantstate` on and the team's account listed and on), and each of `readers` (members) has read its host's notice (`aisend`). Needs
 *  `storeWorld({ ai: true })`. Answers `{assistant, account}`: `assistantstate` and the team's account as `accountsof` (owner `group`) lists it. */
export async function assistant(world, as, { readers = [] } = {}) {
  if (!world.env.ACCOUNT_SEAL_SECRET)
    throw new Error("storeWorld: recipes.assistant needs the team's account sealed: make the world with storeWorld({ ai: true })");
  const id = await aiAccount(world, as);
  for (const m of readers) await noticeSeen(m);
  const listed = await as.read("accountsof", { query: { owner: "group" } });
  return { assistant: await as.read("assistantstate"), account: (listed.accounts ?? []).find((a) => a.account_id === id) ?? null };
}

/** R19 (K5178; J42 (d)): the writing help, as the world's door answers `writinghelp` for `as`: `{op, field, told}` (the act the field belongs to, the field, what she told the assistant).
 *  Unlike the other recipes it answers the owner's answer whether or not it is a refusal, since the refusal is the state a screen draws (`NO_ACCOUNT` before `recipes.assistant`,
 *  `WRITING_HELP_NOTHING_TOLD` for nothing told, `WRITING_HELP_REFUSED` for an act the assistant never helps with, `ASSISTANT_DRAFT_UNAVAILABLE` past all of those). The draft
 *  itself is asked of the Worker's assistant object, which the world does not hold (it needs the model): no answer here carries `text`. */
export async function writingHelp(world, as, { op = "contradictionclarify", field = "explanation", told = "The notice is the later of the two." } = {}) {
  const answer = await world.door({ url: "/api/?op=writinghelp", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op, field, told }) } }, as);
  return resultOf(answer);
}

/** What one model call costs, as agent-worker reports it to `askusage` (ai-use R1). */
const CALL_USAGE = Object.freeze({ input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: 0.8 });

/** R19 (STORE-REQUEST #5, B9 2 (c); SCREENS-SETTINGS #19 J36): the model's own call counted under an ask's grant, as the agent-worker does it. `as` (a member signed in, the team's
 *  Claude account set up by `recipes.assistant`) mints the ask's grant (`aigrantmint`, under the member's own live session), and the model, holding only that grant, posts the usage of
 *  `calls` calls to `askusage` through the door, which admits it as the Worker's door does (control-plane R53). Answers `{grant, counted}`: the grant's token and the owner's answer
 *  to the count. A refusal of the grant's mint or of the count throws, naming the op. */
export async function grantAdmit(world, as, { calls = 1, mode = "ask", usage = CALL_USAGE } = {}) {
  const grant = await as.act("aigrantmint");
  const counted = resultOf(await world.door({ url: "/api/?op=askusage", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, usage, calls }) } }, { token: grant.token }));
  if (!counted || counted.ok !== true) throw refusedAct("askusage", { status: 200, json: { ok: true, result: counted } });
  return { grant: grant.token, counted };
}

/** R19 (STORE-REQUEST #6, B15 (3); SCREENS-INTAKE #27 J57 (5)): a capture held in parts, by the real acts a member's upload of a file past what the store holds whole makes
 *  (`captureupload` of `bytes` bytes, then the `promote` that files it, as the capture screen files it). The bytes are the recipe's, a seeded filler distinct per `name`; the
 *  store cuts them into parts itself. Answers `{sha, bundle, parts, bytes}` (`parts`: the document's `[{file, sha256, bytes}]` in order). `bytes` defaults to 33 MiB, past the
 *  32 MiB of one part. */
export async function parted(world, as, name, { bytes = 33 * 1048576, project: filed = "", type = "application/pdf" } = {}) {
  const content = new Uint8Array(bytes);
  const seed = createHash("sha256").update(String(name)).digest();
  for (let i = 0; i < content.length; i += 4099) content[i] = seed[i % seed.length] ^ (i >>> 12);
  const held = await hold(world, as, name, content, filed, { type });
  if (!Array.isArray(held.parts) || held.parts.length < 2) throw new Error(`storeWorld: a file of ${bytes} bytes was held whole, not in parts`);
  return { ...held, bytes };
}

/** R19 (STORE-REQUEST #6, B15 (3); J57 (5)): a sheet at an address whose reading is over what a promotion takes inline, by the real read: the source serves a one-column CSV of
 *  `rows` numbers (the network, scripted), and the store's own `acquire` reads it into a document whose provenance file passes 1 MiB. The recipe acts for nobody: a page that presses
 *  "Capture" at `address` meets the same answer (the world's `script` is the only double). With `as` and `acquire: true` it also acquires it, answering the owner's answer. Answers
 *  `{address, rows, bytes}` and `{answer}` when acquired. */
export async function largeSheet(world, as, { address = "https://city.example/data/large.csv", rows = 200000, acquire = false } = {}) {
  const text = "x\n" + Array.from({ length: rows }, (_, i) => i).join("\n") + "\n";
  world.script(address, async () => new Response(text, { status: 200, headers: { "content-type": "text/csv" } }));
  const out = { address, rows, bytes: text.length };
  if (acquire) out.answer = await as.act("acquire", { body: { locator: address } });
  return out;
}

/** R19 (STORE-REQUEST #6, B15 (1), (3); CAPTURE-SOURCES #20): a capture credential stored by `as`, by the real act (`capturecredentialsupply`, the door stamping `by` as the member).
 *  Needs the instance's key: make the world with `storeWorld({ env: { CAPTURE_CREDENTIALS_KEY } })`. Answers the owner's answer (the entry R58 lists, never the secret). */
export async function credential(world, as, { host = "records.example.gov", kind = "login", secret = "a-login-no-answer-carries", scope = "member", project: filed = null } = {}) {
  if (!world.env.CAPTURE_CREDENTIALS_KEY)
    throw new Error("storeWorld: recipes.credential needs the instance's key: make the world with storeWorld({ env: { CAPTURE_CREDENTIALS_KEY } })");
  return as.act("capturecredentialsupply", { body: { kind, host, secret, scope, ...(filed ? { project: filed } : {}) } });
}

/** R19 (STORE-REQUEST #6, B16 (2); SCREENS-DAILY #24 J31 (6)): a team of `n` projects, each started by the real `promote` of its document (`project`), in order. Answers their bundle ids. */
export async function projects(world, as, n, { prefix = "Project" } = {}) {
  const ids = [];
  for (let i = 1; i <= n; i++) ids.push(await project(world, as, `${prefix} ${String(i).padStart(3, "0")}`));
  return ids;
}

/** R19 (STORE-REQUEST #6, B16 (2); SCREENS-DAILY #24 J31): a draft shared for review on a case no edition of which is published, by the real acts: a project and a finding in it, a
 *  draft of a new case (`casedraft` with `newCase`) and a reader's link to it (`reviewgrant`, `days` from the world's clock; `comment` makes the reader's own `reviewcomment` under the
 *  link's secret). Answers `{project, finding, draft, grant, secret, until, comment}`. `publishedlist` answers no case of it. */
export async function draftOnly(world, as, { project: filed = null, days = 60, comment = null } = {}) {
  const n = counter(world, "__draftonlys");
  const projectId = filed ?? await project(world, as, `Draft only ${n}`);
  const found = await finding(world, as, projectId, { title: `A finding awaiting its edition ${n}` });
  const draft = (await as.act("casedraft", { body: { project: projectId, newCase: true, targets: [found.id] } })).draftId;
  const until = new Date(world.now() + days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const grant = await as.act("reviewgrant", { body: { draft, recipient: "A reader", until } });
  let said = null;
  if (comment) said = resultOf(await world.door({ url: `/api/?${new URLSearchParams({ op: "reviewcomment", draft })}`, init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: grant.secret, text: comment }) } }, null));
  return { project: projectId, finding: found.id, draft, grant: grant.grantId, secret: grant.secret, until, comment: said };
}

/** R19 (STORE-REQUEST #6, B16 (2); SCREENS-INVESTIGATE #17 J31 (3)): a court's register followed and read, by the real acts: the member follows the address (`followregister`), the source
 *  serves a page (the network double), and the world's clock is moved on (`tick`) so the following consumer reads it as it does. Afterwards `follows` carries the read's `last_read` and
 *  `last_outcome` (`captured`). The member's session locks after the idle that `tick` is, so she is signed in again; answers `{follow, address, as, read}` (`as` the fresh session). */
export async function register(world, as, { address = "https://court.example/register/RG26-114502", html = null, proceeding = null, tick = 1000, status = 200 } = {}) {
  world.script(address, async () => new Response(html ?? `<html><head><title>Register</title></head><body><p>Entry 1: an order was filed.</p></body></html>`, { status, headers: { "content-type": "text/html" } }));
  const made = await as.act("followregister", { body: { address, ...(proceeding ? { proceeding } : {}) } });
  const fired = await world.tick(tick);
  const read = ((fired.follow && fired.follow.read) || []).find((r) => r.follow === made.follow);
  if (!read || read.outcome === "failed") throw new Error(`storeWorld: the register at ${address} was not read: ${JSON.stringify(read || fired.follow || null).slice(0, 300)}`);
  const fresh = await world.signIn(as.handle);
  return { follow: made.follow, address, as: fresh, read };
}
