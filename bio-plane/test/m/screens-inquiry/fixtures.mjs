/* screens-inquiry's tests: the scripted plane behind each screen, over interface-shell's served page (its tests' harness,
 * `harness.mjs`, and document stand-in, `dom.mjs`; B8, K3007). Each fixture answers its screen's reads in their owners'
 * documented shapes; a test overrides any op. R44: no test holds a sentence's English; each expectation is a word read
 * through setup-words' `word(key, vars)` (`says`), so a word changed in `words.json` changes no test. */
import { word } from "../../../src/setup-words/index.mjs";
import { SCREENS } from "../../../src/screens-inquiry/index.mjs";
import { boot, ok, textNodes, counted } from "../interface-shell/harness.mjs";
/* K4245, K5054: the op declarations are registered once, by the world (store-assembly R83: every owner's, op-declarations and op-grades), which
   this module's tests import for the acts they seed (op-tables §5.3) */
import { storeWorld as requestWorld, WORLD_FOUNDER_HANDLE } from "../store-request/fixtures.mjs";
/* the answers inquiry and case-import publish (K4990, K4993, K4995, K5200): made by their real code, never typed here */
import { questionWaitsSetAside, readRefusals } from "../inquiry/fixtures.mjs";
import { importedCasesAnswer } from "../case-import/fixtures.mjs";
import { listAnswer } from "../hypotheses/fixtures.mjs";
import { groupIdentityAnswer } from "../instance-setup/fixtures.mjs";
import { accountsServing } from "../ai-accounts/fixtures.mjs";

export { SCREENS, word, WORLD_FOUNDER_HANDLE };
export const storeWorld = requestWorld;
/** strength's batch (fix round 6, G12c) around a function giving one question's answer: `ids` answers `results`, keyed by id, each the single read's answer */
export const batchStrength = (one) => (r) => ok(r.query.ids ? { ok: true, results: Object.fromEntries(String(r.query.ids).split(",").map((id) => [id, one(id)])) } : one(r.query.id));
export const Q2 = "INQ-2026-0002-closed";
/** The cited policy as the readings and the strength name it: a title (record data), held once. */
export const POLICY = "Policy memo 4.12";
/** inquiry's real `questionwaits` answer for a question with one document set aside by `setter` (`member:<id>`, default `member:ben`) with `reason`
 *  (default "wrong year"), as its asker reads it: `document_waits`, `history`, `zone`, `projects` (inquiry R58). The document is `ASIDE_DOCUMENT`,
 *  whose record these fixtures serve under the title `ASIDE_TITLE`. Made by inquiry's real code, once for each setter and reason. */
export const ASIDE_TITLE = "2024 budget PDF";
const ASIDE_KEPT = new Map();
export const waitsSetAside = ({ setter = "member:ben", reason = "wrong year" } = {}) => {
  const key = setter + "\u0000" + reason;
  if (!ASIDE_KEPT.has(key)) ASIDE_KEPT.set(key, questionWaitsSetAside({ asker: "member:dev", setter, reason }));
  const fx = ASIDE_KEPT.get(key);
  return { ...fx, answer: structuredClone(fx.answer) };
};
export const ASIDE_DOCUMENT = waitsSetAside().document;
/** the record of the document a wait names, as the screen reads its title */
export const ASIDE_RECORD = { "bundle.md": ["---", `id: ${ASIDE_DOCUMENT}`, "object_type: information", `title: "${ASIDE_TITLE}"`, "---", "", "## Summary", ""].join("\n") };
/** inquiry's real partition read of a question that holds no grouping (`grouped: false`, no groups, no changes), as the viewer who may see it reads it (inquiry R33) */
const UNGROUPED = readRefusals().visible;
/** case-import's real `importedcases` answer: two imports, one of them with a withdrawn acceptance (case-import R4) */
const IMPORTS = (await importedCasesAnswer()).answer;
/** hypotheses' real list (R3) of a question holding a live hunch and a withdrawn one; `HUNCH` is the live one, held by `HUNCH_BY` (a member id) */
export const HUNCHES = listAnswer();
export const HUNCH = HUNCHES.hypotheses.find((h) => h.status === "live");
export const HUNCH_BY = HUNCH.held_by.replace(/^member:/, "");
/** instance-setup's real `groupidentity` answer (R11): the group's slug, its recorded name, no domain, no declared stake */
const GROUP = await groupIdentityAnswer();

/* B86 (K5245): the answers of project-stage, project-roster, strength, ai-accounts, capture, provenance, connections, provenance-routes and member-roster are theirs, never typed here:
   the plane's defaults for those reads are asked of store-request's real world (`storeWorld()`), which holds the project (founded by `dev`, `mai` joined, `ana` invited, another team
   project beside it), the question drawn into it and the page it cites, held at its address and changed there since (`recipes.newerCapture`), and the members these fixtures name.
   The page's member is `mai`, the harness's own; each default is the world's door answering the request the page made, as she is answered. */
const WORLD = await storeWorld();
const MEMBERS = {
  dev: await WORLD.signIn("dev", { capabilities: ["contribute", "create_projects"] }),
  mai: await WORLD.signIn("mai", { capabilities: ["contribute"] }),
  ana: await WORLD.signIn("ana", { capabilities: ["contribute"] }),
  rosa: await WORLD.signIn("rosa", { capabilities: ["contribute", "create_projects"] }),
};
for (const h of ["ben", HUNCH_BY]) if (!MEMBERS[h]) MEMBERS[h] = await WORLD.signIn(h, { capabilities: ["contribute"] });
export const P = await WORLD.recipes.project(MEMBERS.dev, "Pothole repairs");
await MEMBERS.dev.act("projectinvite", { query: { projectId: P, handle: "mai" } });
await MEMBERS.dev.act("projectinvite", { query: { projectId: P, handle: "ana" } });
await MEMBERS.mai.act("projectjoin", { query: { projectId: P } });
await WORLD.recipes.project(MEMBERS.rosa, "Elsewhere");
const SEEN = await WORLD.recipes.newerCapture(MEMBERS.dev, { project: P, address: "https://example.org/ai-4-12.pdf" });
export const Q = SEEN.question;
export const D = SEEN.document;
const CHAIN = (await MEMBERS.mai.read("versionchain", { query: { address: SEEN.address } })).versions;
/** the capture the document was first held with, and the newer one the source has changed to since (`versionchain`) */
export const SHA = CHAIN[0].capture_sha;
export const NEWER = CHAIN[1].capture_sha;
/** the world's door answering the request the page made, as the page's member; counted, so `settle()` waits on a late read (interface-shell K5242) */
const world = counted((req) => {
  const headers = Object.fromEntries(Object.entries({ ...(req.init && req.init.headers), ...req.headers }).filter(([k]) => k.toLowerCase() !== "authorization"));
  return WORLD.door({ ...req, headers, init: { ...req.init, headers } }, MEMBERS.mai);
});

const projectMd = (refs) => ["---", `id: ${P}`, "object_type: project", "title: \"Pothole repairs\"",
  "objective: \"Is the city repairing reported potholes as its own policy requires?\"", "references:",
  ...refs.flatMap(([t, rel, st]) => [`  - target: ${t}`, `    rel: ${rel}`, `    status: ${st}`]), "---", "", "## Summary", ""].join("\n");
export const PROJECT_MD = projectMd([[Q, "cites", "active"], [Q2, "cites", "confirmed"], ["INQ-2026-0003-gone", "cites", "severed"], ["INFO-2026-0009", "cites", "active"]]);
export const projectWith = (refs) => projectMd(refs);
/* the inquiry's own references: the policy cited live, the work orders severed with a reason, Mai's observation proposed
   (citation R15: a leg is live or severed as its reference is) */
export const INQUIRY_REFS = [[D, "cites", "confirmed", null], ["INFO-2026-0005", "cites", "severed", "\"Severed 2026-10-07T09:00:00Z: the wrong year's orders\""],
  ["INFO-2026-0006", "cites", "proposed", null]];
/* the inquiry's own legs (R34): two supporting, one cutting against; `ground` per leg when a partition is held */
export const LEGS = [{ target: D, role: "supports", grade: "B" }, { target: "INFO-2026-0005", role: "supports", grade: "B" },
  { target: "INFO-2026-0006", role: "cuts_against", grade: "D", grade_axis: "testimony" }];
export const inquiryMd = (project = P, refs = INQUIRY_REFS, o = {}) => ["---", `id: ${Q}`, "object_type: inquiry", "title: \"Seven days\"", "created: 2026-10-03T10:00:00Z",
  ...(project ? [`project: ${project}`] : []), ...(refs.length ? ["references:"] : ["references: []"]),
  ...refs.flatMap(([t, rel, st, note]) => [`  - target: ${t}`, `    rel: ${rel}`, `    status: ${st}`, ...(note ? [`    note: ${note}`] : [])]),
  ...((o.legs || LEGS).length ? ["basis:", ...(o.legs || LEGS).flatMap((l) => [`  - target: ${l.target}`, `    role: ${l.role}`,
    ...(l.grade ? [`    grade: ${l.grade}`] : []), ...(l.grade_axis ? [`    grade_axis: ${l.grade_axis}`] : []), ...(l.ground ? [`    ground: ${l.ground}`] : []),
    ...(l.extent_kind !== undefined ? [`    extent_kind: ${l.extent_kind}`] : []), ...(l.extent_page !== undefined ? [`    extent_page: ${l.extent_page}`] : []),
    ...(l.extent_para !== undefined ? [`    extent_para: ${l.extent_para}`] : []),
    ...(l.extent_part !== undefined ? [`    extent_part: ${l.extent_part}`] : []), ...(l.extent_ref !== undefined ? [`    extent_ref: ${l.extent_ref}`] : [])])] : []),
  ...(o.grounds ? ["grounds:", ...o.grounds.flatMap((g) => [`  - ground: ${g.ground}`, `    asserted_by: ${g.asserted_by}`, `    at: "${g.at}"`])] : []),
  "---", "", "## Question", "", "Is the city repairing reported potholes within seven days?", "",
  "## Session Log", "", ...(o.log || []), "## Review Notes", ""].join("\n");
/* the bundle's dataset digest (capture grammar C-2.7), never the capture's sha (K3387) */
export const DATASET = "5e44" + "1".repeat(56) + "d505";
/* the capture's own sha, in the bundle's provenance document (as `acquire` and `testify` write it) */
export const provenanceOf = (sha) => JSON.stringify({ documents: [{ capture: { sha256: sha } }] });
export const DOCUMENT_MD = ["---", `id: ${D}`, "object_type: information", "title: \"Pothole repair policy, Administrative Instruction 4.12\"",
  `content_hash: sha256:${DATASET}`, `project: ${P}`, "source:", "  locator: https://example.org/ai-4-12.pdf", "  authority: Public Works",
  "  retrieved: 2026-10-02T09:00:00Z", "---", "", "## Summary", ""].join("\n");

export const BASIS = (extra = {}) => ({ ok: true, inquiry: Q, versions: [{ name: "main", state: "accepted", author: "member:dev",
  moved: { by: "dev", at: "2026-10-06T09:00:00Z", reason: null }, grounds: [], legs: [
  { ord: 1, target: D, role: "supports", grade: "B", words: "within seven calendar days of the report", target_title: POLICY },
  { ord: 2, target: "INFO-2026-0005", role: "supports", grade: "B", status: "severed", target_title: "Work orders" },
  { ord: 3, target: "INFO-2026-0006", role: "cuts_against", grade: "D", scale: "testimony", words: "still open, about 60 cm across", target_title: "Mai's observation" }] }],
  ...extra });
/* extraction R27's answer: the reading (reading-pipeline R1's object, no text) and, beside it, R36's text units in seq
   order (K3387) */
export const READING = (o = {}) => ({ ok: true, found: true, capture_sha: SHA, reading: {
  content_type: "application/pdf", found: true, text_chars: 624,
  people: [{ id: "ENT-17", name: "L. Chen, Director of Public Works" }] },
  text_units: [{ seq: 1, extent: { kind: "pdf-page", page: 2 }, reference: "u1", truncated: false,
                 text: "3. The Director shall repair each reported pothole within seven calendar days of the report." },
               { seq: 2, extent: { kind: "pdf-page", page: 3 }, reference: "u2", truncated: false,
                 text: "5. Repairs are recorded as closed when the crew reports the work complete." }],
  unread_pages: [7, 8, 9], ...o });
/* the project's questions (basis-versions R50), one page; and every question the member may see (`list`) */
export const PROJECT_QUESTIONS = { ok: true, project: P, items: [{ inquiry: Q, title: "Is the city repairing reported potholes within seven days?" },
  { inquiry: Q2, title: "Does closed mean repaired?" }], cursor: null };
const QUESTIONS = { bundles: [{ bundle_id: Q, title: "Is the city repairing reported potholes within seven days?" }, { bundle_id: Q2, title: "Does closed mean repaired?" },
                              { bundle_id: "INQ-2026-0003-gone", title: "Severed" }, { bundle_id: "INQ-2026-0099-other", title: "Another project's" }] };
/* project-roster's participants (owners first, R29), the founder unnamed (R40) */
export const PARTICIPANTS = [{ handle: "dev", state: "joined", owner: 1 }, { handle: "mai", state: "joined", owner: 0 },
  { handle: "ana", state: "invited", owner: 0 }];

/** The plane every screen reads from, keyed by op; `image` answers by the id asked. */
export function plane(o = {}) {
  const images = { [P]: { "bundle.md": PROJECT_MD }, [Q]: { "bundle.md": inquiryMd(o.inquiryProject === undefined ? P : o.inquiryProject) }, [D]: { "bundle.md": DOCUMENT_MD, "data/provenance.json": provenanceOf(SHA) }, [ASIDE_DOCUMENT]: ASIDE_RECORD, ...(o.images || {}) };
  return {
    image: (r) => (Object.hasOwn(images, r.query.id) ? ok(images[r.query.id]) : ok(null)),
    /* the owners' reads, answered by the world (B86): the project's stage, roster, bar, account, directory, visibility, owner votes and stake; the question's strength (single and batch),
       a reading's, and the grouping's independence; the document's held captures, version chain, grade and route; the themes; the members */
    ...Object.fromEntries(["projectstage", "projectparticipants", "strengthbarof", "projectdirectory", "projectvisibility", "projectownervotes", "projectstake"] /* the project page's reads */
      .concat(["inquirystrength", "versionstrength", "partitionindependence"] /* the question's */, ["heldcaptures", "versionchain", "capturegrade"] /* the document's */, ["themeread", "provenanceroutes", "memberlist"] /* the themes, the route, the members */)
      .map((op) => [op, world])),
    list: ok(QUESTIONS),
    projectquestions: ok(PROJECT_QUESTIONS),
    plans: ok({ ok: true, plans: [] }),
    basisversions: (r) => ok({ ...BASIS(), ...(r.query.project ? { current: { project: r.query.project, version: "main", at: "2026-10-06T09:00:00Z", by: "dev" } } : {}) }),
    hypotheses: ok(HUNCHES),
    questionwaits: ok(waitsSetAside().answer),
    backlinks: (r) => ok(r.query.target === D
      ? { ok: true, target: D, backlinks: [{ from: Q, from_type: "inquiry", from_title: "Seven days?", rel: "cites" },
                                           { from: P, from_type: "project", from_title: "Pothole repairs", rel: "cites" }], out_of_view: true }
      : { ok: true, target: r.query.target, backlinks: [] }),
    reading: ok(READING()),
    gradenote: ok({ captureSha: SHA, note: "Fetched from the city's site over HTTPS; a signed copy would raise it to A." }),
    captureprogressions: ok({ ok: true, instances: [] }),
    inquirypartition: ok(UNGROUPED),
    groupidentity: ok(GROUP),
    publishedlist: ok({ bundles: [], cases: [] }),
    links: ok({ ok: true, links: [] }),
    connections: ok({ ok: true, connections: [] }),
    reevaluationnotices: ok({ ok: true, notices: [] }),
    importedcases: ok(IMPORTS),
    origins: ok({ ok: true, bundleId: D, origins: [] }),
    transcriptions: ok({ ok: true, bundle_id: D, transcriptions: [], count: 0, truncated: false, cursor: null }),
    ...(o.plane || {}),
  };
}

/** The served page at `path` with this module's screens, over the plane. */
export async function open(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}

/** The main area, its acts drawn by op, a button by op, and a field set. */
export const main = (p) => p.doc.getElementById("cs-main");
export const actsIn = (el) => el.querySelectorAll("button[data-act]").map((b) => b.getAttribute("data-act"));
export const button = (p, op, within) => (within || p.root()).querySelector(`button[data-act="${op}"]`);
export function fill(p, values) { for (const [id, v] of Object.entries(values)) { const el = p.doc.getElementById(id); if (!el) throw new Error(`no field ${id}`); el.value = v; } }
/** Press an act; a reasoned act's own reason field (when the shell asks one) answered with `reason`, a dialog confirmed. */
export async function press(p, op, { reason, within } = {}) {
  const b = button(p, op, within);
  if (!b) throw new Error(`no act ${op}`);
  await p.click(b);
  const slot = p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`);
  const ta = slot && slot.querySelector('textarea[id^="cs-reason-"]');
  if (ta && reason !== undefined) { ta.value = reason; await p.click(slot.querySelector('[data-shell="reason-send"]')); }
  await p.settle();
  return slot;
}
/** Every text node drawn that reads as a word key: a key the page holds no word for is drawn as itself (interface-shell R5). */
export const rawKeys = (root) => textNodes(root).map((t) => String(t.data).trim()).filter((t) => /^[a-z][\w-]*(\.[\w-]+){2,}$/.test(t));
/** R44: whether `el` draws the word `key` filled with `vars`, as setup-words' `word` gives it. */
export const says = (el, key, vars) => String(el && el.textContent || "").includes(word(key, vars || {}));
/** R6: a date as the kit draws it, by `date.daymonthyear` (or `date.daymonth` with `{year: false}`) and `date.month.*`, read through
 *  the same words and never copied: `day("2026-10-06T09:00:00Z")`. */
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export const day = (iso, o = {}) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  const month = word("date.month." + MONTHS[Number(m[2]) - 1]);
  return o.year === false ? word("date.daymonth", { day: String(Number(m[3])), month }) : word("date.daymonthyear", { day: String(Number(m[3])), month, year: m[1] });
};
/** The section whose heading is the word `key`. */
export const section = (p, key, vars) => main(p).querySelectorAll("section").find((s) => s.querySelector("h2").textContent === word(key, vars || {}));
/** A word's text up to its first placeholder, for a sentence filled with drawn markup (a date). */
export const lead = (key) => word(key, new Proxy({}, { get: () => "\u0000", has: () => true,
  getOwnPropertyDescriptor: () => ({ value: "\u0000", configurable: true, enumerable: true, writable: true }) })).split("\u0000")[0];

/* op-declarations PR 95 (T53; ai-accounts R35): who serves a member is read by `accountsof` (ai-accounts R2), an owner's list
   of accounts, each with `on`. Its answers are ai-accounts' real service's, over its published fixture (`accountsServing`):
   her own sealed key on (`own`), the team's list empty (`none`) and then holding a key switched on (`group`), and a project's
   own key on (`project`). `accountsOf({own, group, project})` answers each owner's read with the one named. Read once. */
let AI_ACCOUNTS = null;
export async function aiAccounts() {
  if (!AI_ACCOUNTS) AI_ACCOUNTS = (async () => {
    const s = await accountsServing({ member: "ann" });
    const read = (owner) => s.accounts.accountsOf({ owner, viewer: "ann" });
    const ACCOUNTS = { own: read("member:ann"), none: read("group") };
    const t = await s.world.team({ secret: "sk-ant-api03-" + "8".repeat(40) });
    s.accounts.accountSwitch({ account_id: t.account_id, on: true, by: "admin" });
    ACCOUNTS.group = read("group");
    s.world.project("P", "ann");
    const pa = await s.world.projectAccount("P", "ann", { secret: "sk-ant-api03-" + "9".repeat(40) });
    s.accounts.accountSwitch({ account_id: pa.account_id, on: true, by: "ann" });
    ACCOUNTS.project = read("project:P");
    const accountsOf = ({ own = ACCOUNTS.own, group = ACCOUNTS.group, project = ACCOUNTS.none } = {}) => (r) =>
      ok(/^member:/.test(r.query.owner) ? own : r.query.owner === "group" ? group : /^project:/.test(r.query.owner) ? project : ACCOUNTS.none);
    return { ACCOUNTS, accountsOf };
  })();
  return AI_ACCOUNTS;
}
