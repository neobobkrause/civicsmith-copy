/* screens-publish R25–R36 (T50) on interface-shell's served page: `imported` draws its list and whose stake an imported case
 * states; the review link's end counted in the team's zone; the ceremony and the draft in plain words; the check's third
 * answer; the confirmation's own explanation; a project's first case; publish with nothing prepared; the public page's
 * "Corrections and orders" and the public docket; the case editor's account; `publishedcase` read asynchronously. Each
 * sentence is asserted by its key (R24). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN } from "../interface-shell/harness.mjs";
import { open, main, text, tipOf, drew, drewIn, day, word, hasWord, ops, press, fill, tick, last, ok, refused, refusedIn, pending, silent, plane, rawKeys,
  PREFLIGHT, COPY, DEFAULT, PUBLISHED_CASE, P, DR, C, E1, B1, GRANT_UNTIL } from "./fixtures.mjs";

const PUBLIC = { session: null };
const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
const edition = (o = {}) => ({ edition: 2, imported_by: "admin", imported_at: "2026-10-01T09:00:00Z", importer: { member: "admin", handle: "rosa", founder: true },
  findings: 3, recreated: 1, recreated_in_part: 1, did_not_recreate: 1, ...o });
const imp = (id, caseName, group, ed, latest = 2) => ({ import: id, group, case: "CASE-" + id, scope: caseName, latest_edition: latest, editions: [ed] });
const delay = (ms, answer) => async () => { await new Promise((r) => setTimeout(r, ms)); return answer; };

/* ---------- R25, R26: imported ---------- */

test("R25 imported with no subject draws its list: a row per import with its group, edition, importer's handle, date and counts, and the in-part count", async () => {
  const p = await open("/app/imported", { plane: { importedcases: ok({ imports: [
    imp("IMP-1", "Port lease revenue", "West Oakland Neighbors", edition()),
    imp("IMP-2", "Rent roll", "Tenants Union", edition({ edition: 1, imported_by: "mai", importer: { member: "mai", handle: "mai" }, findings: 2, recreated: 2, recreated_in_part: 0, did_not_recreate: 0 }), 1)], count: 2, wrote: false }) } });
  assert.equal(p.byOp("importedcase").length, 0, "no read per case");
  assert.ok(drew(p, "screen.imported.list") && drew(p, "screen.imported.list.says"));
  const rows = main(p).querySelectorAll(".cs-row").map((r) => r.textContent);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].includes(word("screen.imported.list.row", { group: "West Oakland Neighbors", edition: "2", who: "rosa", date: day("2026-10-01"), recreated: "1", findings: "3" })), rows[0]);
  assert.ok(rows[0].includes(word("screen.imported.list.row.part", { n: "1" })), "some recreated in part");
  assert.ok(!rows[0].includes("admin"), "the founder by her handle, never admin");
  assert.ok(rows[1].includes(word("screen.imported.list.row", { group: "Tenants Union", edition: "1", who: "mai", date: day("2026-10-01"), recreated: "2", findings: "2" })));
  assert.ok(!rows[1].includes(word("screen.imported.list.row.part", { n: "0" })), "no in-part count at zero");
  assert.ok(main(p).querySelector('a[href="/app/imported/IMP-1"]'), "the case a reference to its own page");
  assert.ok(ops(p).includes("caseimport"), "Import a case beneath");
});

test("R25 a count of null (no recreation recorded) is not drawn as zero; with none imported the empty sentence; a viewer who is no active member reads the empty list; an unknown subject is Nothing is here (controls)", async () => {
  const p = await open("/app/imported", { plane: { importedcases: ok({ imports: [imp("IMP-1", "Port lease revenue", "West Oakland Neighbors",
    edition({ findings: null, recreated: null, recreated_in_part: null, did_not_recreate: null }))], count: 1 }) } });
  const row = main(p).querySelector(".cs-row").textContent;
  assert.ok(!/(^|[^\d])0([^\d]|$)/.test(row.replace(/2026|2099|\d{1,2} \w+ \d{4}/g, "")), "no zero drawn: " + row);
  assert.ok(row.includes("Edition 2") || row.includes(word("screen.imported.list.row", { group: "West Oakland Neighbors", edition: "2", who: "rosa", date: day("2026-10-01"), recreated: "–", findings: "–" })));
  for (const none of [{ imports: [], count: 0, wrote: false }]) {
    const q = await open("/app/imported", { plane: { importedcases: ok(none) } });
    assert.ok(drew(q, "screen.imported.list.none"));
    assert.equal(main(q).querySelector('[data-state="failed"]'), null);
  }
  const absent = await open("/app/imported/IMP-NONE", { plane: { importedcase: refused("IMPORT_NO_SUCH_EDITION", "No such import.", 404) } });
  assert.ok(main(absent).querySelector('[data-unavailable="nothing"]'), "Nothing is here");
});

test("R25 one case's page draws the band and the line of who brought it in and when", async () => {
  const p = await open("/app/imported/IMP-2026-0001");
  assert.ok(drew(p, "screen.imported.band", { group: "West Oakland Neighbors", edition: "2", recreated: "1", findings: "3" }));
  assert.ok(drew(p, "screen.imported.from", { group: "West Oakland Neighbors", edition: "2", by: "dev", at: day("2026-10-01") }));
});

const withFields = (gf, extra = {}) => ({ importedcase: ok({ import: "IMP-2026-0001", group: "West Oakland Neighbors", case: "CASE-2026-3549", scope: "Port lease revenue",
  edition: { edition: 2, imported_by: "dev", imported_at: "2026-10-01T09:00:00Z", importer: { member: "dev", handle: "dev" }, findings: [{ finding: "F-1", title: "A finding", result: "recreated" }], group_fields: gf, ...extra } }) });

test("R26 an imported case says whose stake it states: labeled as the source's, its stake and its matter stake, never this team's", async () => {
  const p = await open("/app/imported/IMP-2026-0001");
  const sec = main(p).querySelectorAll("h2").find((h) => h.textContent === word("caseimport.stake.heading")).closest("section");
  assert.ok(drewIn(sec, "case-import.group_fields_label"));
  assert.ok(sec.textContent.includes("We live beside the port.") && sec.textContent.includes("Our block lies under the flight path."), "the stake and the matter stake");
  assert.ok(drewIn(sec, "stake.inmatter"));
  assert.equal(sec.querySelector("details"), null, "nothing folded when all is recorded and readable");
});

test("R26 a stake stated in a form that cannot be read draws its note in its fold and the other fields still; an edition recorded without fields draws the not-recorded sentence in its fold (controls)", async () => {
  const gf = { group: "west-oakland", name: "West Oakland Neighbors", domain: "westoakland.example", domain_verified_at: null, stake: "We live beside the port.", detail: null, matter_stake: null, read_at: "2026-10-01T08:59:00Z" };
  const p = await open("/app/imported/IMP-2026-0001", { plane: withFields(gf, { group_fields_note: word("caseimport.stake.unreadable") }) });
  const fold = main(p).querySelector('[data-fold="caseimport.unreadable.summary"]');
  assert.ok(fold && fold.hasAttribute("open") && drewIn(fold, "caseimport.unreadable.summary") && drewIn(fold, "caseimport.stake.unreadable"));
  assert.ok(text(p).includes("We live beside the port.") && text(p).includes("westoakland.example"), "its other fields still drawn");
  const none = await open("/app/imported/IMP-2026-0001", { plane: withFields(null, { group_fields_note: word("case-import.group_fields_none") }) });
  const f2 = main(none).querySelector('[data-fold="caseimport.notrecorded.summary"]');
  assert.ok(f2 && drewIn(f2, "case-import.group_fields_none") && drewIn(f2, "caseimport.notrecorded.summary"));
  assert.ok(!drew(none, "case-import.group_fields_label") && main(none).querySelector('[data-fold="caseimport.unreadable.summary"]') === null);
});

/* ---------- R27: the review link's end ---------- */

test("R27 with no zone held, an administrator is told to set it and a member to ask one, each in the fold, with no UTC drawn in its place; nothing is shared", async () => {
  const noZone = { reviewcopy: ok(COPY({ zone: null, grants: [{ grant_id: "GRT-1", recipient: "Prof. N. Iyer · housing law", until: GRANT_UNTIL, zone: null }] })) };
  const a = await open(`/app/review-copy/${P}`, { plane: { ...noZone, whoami: ok({ ...ADMIN, member: "rosa", handle: "rosa", capabilities: ["contribute", "create_projects", "publish"] }) } });
  fill(a, { "rc-name": "Ana", "rc-role": "editor", "rc-until": "2099-10-20" });
  await press(a, "reviewgrant", { reason: "so the reader can comment before publication" });
  const fold = main(a).querySelector('[data-fold="screen.review-copy.until.nozone.summary"]');
  assert.ok(fold && drewIn(fold, "screen.review-copy.until.nozone") && !drewIn(fold, "screen.review-copy.until.nozone.member"));
  assert.equal(a.byOp("reviewgrant").length, 0);
  assert.ok(!/UTC/.test(text(a)), "no UTC is drawn in its place");
  const roster = main(a).querySelector("[data-grant-until]").textContent;
  assert.ok(!/UTC/.test(roster));
});

test("R27 a grant with no `until` draws the end-of-sharing sentence and no zone line (control); at the reader's door a zone-less grant states no end", async () => {
  const none = await open("/app/review", { boot: { ...PUBLIC, hash: "#grant=S" }, plane: { reviewcopy: ok({ kind: "review-copy", reader: "recipient", draft: DR, case: { case_id: C, edition: 2, identity: "X" },
    authored: { scope: "Rents." }, findings: [], grant: { recipient: "Ana", until: null, zone: "America/Los_Angeles" } }) } });
  assert.ok(drew(none, "screen.review-outside.untilstopped"));
  assert.ok(!/\(Pacific/.test(text(none)), "no zone line");
  const nozone = await open("/app/review", { boot: { ...PUBLIC, hash: "#grant=S" }, plane: { reviewcopy: ok({ kind: "review-copy", reader: "recipient", draft: DR, case: { case_id: C, edition: 2, identity: "X" },
    authored: { scope: "Rents." }, findings: [], grant: { recipient: "Ana", until: GRANT_UNTIL, zone: null } }) } });
  assert.ok(!/UTC/.test(text(nozone)), "never UTC in its place");
});

/* ---------- R28: the ceremony and the draft in plain words ---------- */

const PATH = `/app/ceremony/${P}/${DR}`;
const pre = (o) => ({ publishpreflight: ok(PREFLIGHT(o)) });

test("R28 the ceremony lists what stops the signing under its heading, each gate on its own line: a gate's own sentence inside ceremony.gate.other, never a check's code", async () => {
  // fixtures-generic: STANDARD_DEPARTED (a made-up gate code carrying its own `says` words, to prove the screen draws the words and never the code)
  const p = await open(PATH, { plane: pre({ first: { ok: false, code: "STANDARD_DEPARTED", translation: "A developer text.", says: { key: "refusal.NO_REVIEW_COPY", vars: {} } },
    blockers: [{ ok: false, code: "TENSION_NOT_DISCLOSED", translation: "A contradiction is not yet disclosed." }] }) });
  const list = main(p).querySelector("[data-blockers]");
  assert.ok(drew(p, "ceremony.gate.heading"));
  const lines = list.querySelectorAll("li").map((l) => l.textContent);
  assert.equal(lines.length, 2, "each its own line");
  assert.ok(lines[0].includes(word("refusal.NO_REVIEW_COPY").replace(/[.\s]+$/, "")) && lines[0].includes(word("ceremony.gate.other", { what: "" }).split(":")[0]));
  assert.ok(!text(p).includes("STANDARD_DEPARTED") && !text(p).includes("A developer text."), "neither the code nor the checker's developer text");
});

test("R28 a draft naming no finding says ceremony.gate.notargets and no code; a ceremony with no gate draws no heading (control)", async () => {
  const none = await open(PATH, { plane: { reviewcopy: ok(COPY({ findings: [] })), ...pre({ first: { ok: false, code: "PUBLISH_NO_FINDING", translation: "pass targets" }, blockers: [] }) } });
  assert.ok(drew(none, "ceremony.gate.notargets"));
  assert.ok(!text(none).includes("NO_TARGET") && !text(none).includes("pass targets"));
  assert.equal(main(none).querySelector("[data-blockers]").querySelectorAll("li").length, 1, "said once");
  const clear = await open(PATH, { plane: pre({ ready: true, first: null, blockers: [] }) });
  assert.ok(!drew(clear, "ceremony.gate.heading") && main(clear).querySelector("[data-blockers]") === null);
});

const FIRST = (o = {}) => ({ casedrafts: ok({ kind: "review-drafts", project: P, drafts: [{ draft_id: DR, case: { identity: "A derived sentence about the findings of a project" }, created_by: "dev", updated_by: "dev" }], ...o }) });

test("R28 a draft that names no case is titled case.draft.untitled with its project, its line is prepared by the member's handle, the rungs read case.ladder.notyet and the ladder explains Distributed", async () => {
  const p = await open(`/app/case-editor/${P}`, { plane: { ...FIRST(), reviewcopy: ok(COPY({ case: { identity: "A derived sentence about the findings of a project" } })) } });
  assert.equal(main(p).querySelector("h1").textContent, word("case.draft.untitled", { project: "The Coliseum lease" }));
  assert.ok(!text(p).includes("A derived sentence"), "never the derivation prose");
  assert.ok(drew(p, "screen.case-editor.preparedby", { who: "dev" }), "the viewer's own handle for the member id she is");
  const handled = await open(`/app/case-editor/${P}`, { plane: { casedrafts: ok({ kind: "review-drafts", project: P, drafts: [{ draft_id: DR, case: { case_id: C, edition: 2, identity: "The Coliseum lease" }, created_by: "ana", updated_by: "ana", updated_by_handle: "ana-h" }] }) } });
  assert.ok(drew(handled, "screen.case-editor.preparedby", { who: "ana-h" }));
  assert.ok(!new RegExp(word("screen.case-editor.preparedby", { who: "WHO" }).replace("WHO", "ana(?![-\\w])")).test(text(handled)), "not the sign-in name");
  const rung = main(handled).querySelector('[data-rung="distributed"]');
  assert.ok(rung.textContent.includes(word("case.ladder.notyet")) && !rung.textContent.includes(word("screen.case-editor.rung.notyet")));
  assert.ok(drewIn(main(handled).querySelector("[data-ladder-note]"), "screen.case-editor.tip.distributed"));
});

/* ---------- R29: the third answer ---------- */

test("R29 a hash the team published for another edition draws published.check.elsewhere, not yes or no; a pinned evidence hash still draws yes and an unknown one no (controls)", async () => {
  const other = "5".repeat(64);
  const mk = (pins) => ({ verify: (req) => ok(pins.includes(req.query.sha256) ? { published: true, sha256: req.query.sha256, matches: [{ bundle_id: "FND-2026-0031", published: "2026-11-19T14:00:00Z" }] } : { published: false, sha256: req.query.sha256, matches: [] }) });
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: mk([other]) });
  await press(p, "verify", { nth: 1, values: { "pb-sha": other } });
  assert.ok(drew(p, "published.check.elsewhere") && !drew(p, "published.check.no") && !drew(p, "published.check.yes", { n: "1", finding: "x" }));
  const q = await open(`/app/published/${C}`, { boot: PUBLIC, plane: mk([E1]) });
  await press(q, "verify", { nth: 1, values: { "pb-sha": E1 } });
  assert.ok(drew(q, "published.check.yes", { n: "1", finding: "The 2024 adjustments were made without the council vote the lease requires." }));
  await press(q, "verify", { nth: 1, values: { "pb-sha": "0".repeat(64) } });
  assert.ok(drew(q, "published.check.no"));
});

/* ---------- R30: the confirmation before signing ---------- */

test("R30 the confirmation before signing is explained by act.publish.here.ceremony in place of act.publish.does; the photo line is undated when photosOf answers no date", async () => {
  const p = await open(PATH);
  const b = main(p).querySelector('button[data-act="publish"]');
  assert.ok(tipOf(b).includes(word("act.publish.here.ceremony")), "explained in its place");
  assert.ok(!tipOf(b).includes(word("act.publish.does")), "not the general sentence");
  const ph = main(p).querySelector('[data-photo]');
  assert.ok(drewIn(ph, "screen.ceremony.photo.facts", { by: "dev", findings: "FND-2026-0031" }), "undated: the sentence without a day");
});

/* ---------- R31: a project's first case ---------- */

const FIRSTCASE = (concluded) => ({ casedrafts: ok({ kind: "review-drafts", project: P, drafts: [], concluded }) });
const Q1 = { inquiry: "INQ-1", title: "Did the council vote?", concluded_at: "2026-09-01T10:00:00Z", concluded_by: "mai", findings: 2 };
const Q2 = { inquiry: "INQ-2", title: "Were the rents fair?", concluded_at: "2026-09-05T10:00:00Z", concluded_by: "mai", findings: 1 };

test("R31 a project with no draft draws What goes in: its concluded questions ticked, each with its title, date and finding count; unticking one sends casedraft with the other alone and no caseId or newCase", async () => {
  const p = await open(`/app/case-editor/${P}`, { plane: FIRSTCASE([Q1, Q2]) });
  assert.ok(drew(p, "screen.case-editor.whatgoesin"));
  const heading = main(p).querySelectorAll("h2").find((h) => h.textContent === word("screen.case-editor.whatgoesin"));
  assert.ok(tipOf(heading).includes(word("screen.case-editor.whatgoesin.note")), "explained by the note");
  const boxes = p.doc.getElementById("ce-targets").querySelectorAll("input");
  assert.equal(boxes.length, 2);
  assert.ok(boxes.every((b) => b.checked), "each ticked when the editor opens");
  const label = (i) => boxes[i].closest("label").textContent;
  assert.ok(label(0).includes("Did the council vote?") && label(0).includes(day("2026-09-01")) && label(0).includes("2"));
  assert.ok(ops(p).includes("casedraft"));
  boxes[1].checked = false;
  fill(p, { "ce-scope": "Rents, 2024 to 2026." });
  await press(p, "casedraft");
  const body = last(p, "casedraft").body;
  assert.deepEqual(body.targets, ["INQ-1"]);
  assert.equal(body.project, P);
  assert.equal(body.scope, "Rents, 2024 to 2026.");
  assert.ok(!("caseId" in body) && !("newCase" in body) && !("draft" in body));
});

test("R31 nothing ticked sends nothing and says so in place; a project that concluded none draws the fold and no ticks; a project with a draft draws state a and no ticks; a failed read is drawn failed (controls)", async () => {
  const p = await open(`/app/case-editor/${P}`, { plane: FIRSTCASE([Q1]) });
  p.doc.getElementById("ce-targets").querySelectorAll("input")[0].checked = false;
  fill(p, { "ce-scope": "Rents." });
  await press(p, "casedraft");
  assert.equal(p.byOp("casedraft").length, 0);
  assert.ok(drew(p, "capture.fieldneeded", { field: word("screen.case-editor.whatgoesin") }));
  const none = await open(`/app/case-editor/${P}`, { plane: FIRSTCASE([]) });
  assert.equal(none.doc.getElementById("ce-targets"), null, "no ticks");
  fill(none, { "ce-scope": "Rents." });
  await press(none, "casedraft");
  assert.equal(none.byOp("casedraft").length, 0);
  const a = await open(`/app/case-editor/${P}`, { plane: { casedrafts: ok({ kind: "review-drafts", project: P, concluded: [Q1], drafts: [{ draft_id: DR, case: { case_id: C, edition: 2, identity: "The Coliseum lease" }, created_by: "dev" }] }) } });
  assert.equal(a.doc.getElementById("ce-targets"), null, "state a: no ticks");
  assert.ok(drew(a, "screen.case-editor.ladder"));
  const bad = await open(`/app/case-editor/${P}`, { plane: { casedrafts: refusedIn("SOME_REFUSAL", "The plane refused this read.") } });
  assert.ok(main(bad).querySelector('[data-state="failed"]') && bad.doc.getElementById("ce-targets") === null && !drew(bad, "screen.case-editor.nodrafts"));
});

test("R31 R34 on success the screen draws state a; the project with no concluded question draws screen.case-editor.noconcluded in a fold headed by its summary", async () => {
  let drafts = [];
  const p = await open(`/app/case-editor/${P}`, { plane: { casedrafts: () => ok({ kind: "review-drafts", project: P, concluded: [Q1], drafts }), casedraft: () => { drafts = [{ draft_id: DR, case: { case_id: C, edition: 1, identity: "The Coliseum lease" }, created_by: "dev" }]; return ok({ draft: DR }); } } });
  fill(p, { "ce-scope": "Rents." });
  await press(p, "casedraft");
  assert.ok(drew(p, "screen.case-editor.ladder") && p.doc.getElementById("ce-targets") === null, "state a once the draft stands");
  const none = await open(`/app/case-editor/${P}`, { plane: FIRSTCASE([]) });
  const fold = main(none).querySelector('[data-fold="screen.case-editor.noconcluded.summary"]');
  assert.ok(fold && fold.hasAttribute("open") && drewIn(fold, "screen.case-editor.noconcluded.summary") && drewIn(fold, "screen.case-editor.noconcluded"));
});

/* ---------- R32: publish with nothing prepared ---------- */

test("R32 the ceremony opened for a project with no draft draws screen.ceremony.nothing and the one door to the case being prepared, and sends none of its reads", async () => {
  const p = await open(`/app/ceremony/${P}`, { plane: { casedrafts: ok({ kind: "review-drafts", project: P, drafts: [] }) } });
  assert.ok(drew(p, "screen.ceremony.nothing"));
  const door = main(p).querySelector(`a[href="/app/case-editor/${P}"]`);
  assert.ok(door && door.textContent === word("case.links.editor"), "a reference of kind case-editor with the project as subject");
  assert.ok(tipOf(door).includes(word("shell.card.case-editor")));
  for (const op of ["publishpreflight", "publishtensions", "photomarks", "publishschedule", "reviewcopy"]) assert.equal(p.byOp(op).length, 0, op);
  assert.equal(main(p).querySelector("[data-step]"), null, "none of R3's steps");
});

test("R32 a project with a draft draws the ceremony as R3 says (the newest draft); a failed casedrafts read is drawn failed, never as nothing ready (controls)", async () => {
  const p = await open(`/app/ceremony/${P}`);
  assert.equal(main(p).querySelectorAll("[data-step]").length, 10);
  assert.equal(last(p, "reviewcopy").query.draft, DR);
  assert.ok(p.byOp("publishpreflight").length > 0 && !drew(p, "screen.ceremony.nothing"));
  assert.deepEqual(last(p, "publishpreflight").body, { draft: DR, project: P });
  const bad = await open(`/app/ceremony/${P}`, { plane: { casedrafts: refusedIn("SOME_REFUSAL", "The plane refused this read.") } });
  assert.ok(main(bad).querySelector('[data-state="failed"]') && !drew(bad, "screen.ceremony.nothing"));
});

/* ---------- R33, R34: corrections and orders, the public docket ---------- */

const withCorrections = (corrections) => ({ publishedcase: ok({ ...PUBLISHED_CASE, corrections }) });
const section = (p) => main(p).querySelectorAll("h2").find((h) => h.textContent === word("screen.published.corrections.heading")).closest("section");

test("R33 R34 the page draws Corrections and orders after the timeline and before the people named: none, one and several since it was published, each with the docket sentence", async () => {
  const none = await open(`/app/published/${C}`, { boot: PUBLIC });
  assert.ok(drewIn(section(none), "screen.published.corrections.none"));
  assert.ok(drewIn(section(none), "screen.published.corrections"));
  const order = main(none).querySelectorAll("h2").map((h) => h.textContent);
  assert.ok(order.indexOf(word("screen.published.timeline")) < order.indexOf(word("screen.published.corrections.heading")) && order.indexOf(word("screen.published.corrections.heading")) < order.indexOf(word("screen.published.people")));
  const one = await open(`/app/published/${C}`, { boot: PUBLIC, plane: withCorrections({ count: 1, last: { seq: 2, kind: "withdrawal", date: "2026-12-01" } }) });
  assert.ok(drewIn(section(one), "screen.published.corrections.some.one", { kind: word("screen.published.corrections.kind.withdrawal"), date: day("2026-12-01") }) && !drewIn(section(one), "screen.published.corrections.none"));
  const three = await open(`/app/published/${C}`, { boot: PUBLIC, plane: withCorrections({ count: 3, last: { seq: 4, kind: "court-order", date: "2026-12-09" } }) });
  assert.ok(drewIn(section(three), "screen.published.corrections.some", { count: "3", kind: word("screen.published.corrections.kind.court-order"), date: day("2026-12-09") }));
  const ed = await open(`/app/published/${C}`, { boot: PUBLIC, plane: withCorrections({ count: 2, last: { seq: 3, kind: "edition", date: "2026-12-02" } }) });
  assert.ok(drewIn(section(ed), "screen.published.corrections.some", { count: "2", kind: word("screen.published.corrections.kind.edition"), date: day("2026-12-02") }));
});

test("R33 R34 an undetermined count draws only screen.published.corrections, neither none nor a count; its docket is the door to docket-public with the case as subject (controls)", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: withCorrections({ count: null, last: null, undetermined: true }) });
  const s = section(p);
  assert.ok(drewIn(s, "screen.published.corrections") && !drewIn(s, "screen.published.corrections.none"));
  assert.ok(!/\d/.test(s.querySelector("p").textContent.replace(/\s/g, "")), "no count");
  const door = s.querySelector("a[data-docket-public]");
  assert.equal(door.getAttribute("href"), `/app/docket-public/${C}`);
  assert.ok(tipOf(door).includes(word("shell.card.docket")));
});

test("R34 docket-public opens in the published frame with no session and no Authorization header and sends only docketpublic: the posted entries, no act, and a way back to the case", async () => {
  const p = await open(`/app/docket-public/${C}`, { boot: PUBLIC });
  assert.equal(p.byOp("whoami").length, 0);
  for (const r of p.requests) assert.equal(r.headers.Authorization, undefined, `${r.op}: no credential`);
  assert.deepEqual([...new Set(p.requests.map((r) => r.op))].filter((o) => !["interfacewords", "groupidentity", "bootstrap"].includes(o)), ["docketpublic"]);
  assert.equal(last(p, "docketpublic").query.case, C);
  assert.ok(drew(p, "screen.docket-public.sub"));
  const t = text(p);
  /* each posted entry as the real `docketpublic` answer holds it: its kind's word, then what it says (its summary, else its reason) */
  const posted = DEFAULT.docketpublic.json.result.entries;
  assert.ok(posted.length > 0);
  for (const e of posted) assert.ok(t.includes(`${word("screen.docket.kind." + e.fields.kind)} · ${e.fields.summary || e.fields.reason}`), `entry ${e.seq}`);
  assert.equal(main(p).querySelectorAll("button[data-act]").length, 0, "no act offered");
  assert.equal(main(p).querySelector('a[data-public-page]').getAttribute("href"), `/app/published/${encodeURIComponent(C)}`);
  assert.ok(drew(p, "screen.docket-public.back"));
  assert.deepEqual(rawKeys(p.root()), []);
});

test("R34 \"its docket\" on the page opens docket-public; a member's docket in the working frame is unchanged (control); a case the docket does not know is Nothing is here", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC });
  await p.click(main(p).querySelector("a[data-docket-public]"));
  await p.settle();
  assert.equal(p.location.pathname, `/app/docket-public/${C}`);
  assert.equal(last(p, "docketpublic").headers.Authorization, undefined);
  const member = await open(`/app/docket/${P}/${C}`);
  assert.deepEqual(ops(member).sort(), ["casedraft", "docketfile", "docketpost"]);
  const absent = await open(`/app/docket-public/${C}`, { boot: PUBLIC, plane: { docketpublic: refused("NOT_PUBLISHED", "Nothing published.", 404) } });
  assert.ok(main(absent).querySelector("[data-state]"), "the refusal is drawn, not an empty page");
});

/* ---------- R35: the account ---------- */

const ACCOUNT_DRAFT = { id: "ACD-1", kind: "case_account", framing: "time_order", text: "In March the council voted. In April the rents rose.", flags: [], run: "RUN-1", label: { machine_work: true }, at: "2026-10-06T09:00:00Z" };
const FLAGS = { id: "ACD-2", kind: "account_check", framing: null, text: "", flags: [{ ord: 2, text: "The minutes it cites do not mention April.", cites: [] }], run: "RUN-2", label: { machine_work: true }, at: "2026-10-06T10:00:00Z" };

test("R35 with the assistant: the three framings, the draft act, its draft as machine work and a flagged sentence with its reason; without it: neither, and the field and the earlier drafts are", async () => {
  const p = await open(`/app/case-editor/${P}`, { plane: { ...reach, accountdrafts: ok({ case: C, drafts: [ACCOUNT_DRAFT, FLAGS] }),
    reviewcopy: ok(COPY({ authored: { scope: "Rents.", account: [{ text: "In March the council voted.", cites: [] }, { text: "In April the rents rose.", cites: [] }] } })) } });
  assert.ok(drew(p, "screen.case-editor.account"));
  const head = main(p).querySelectorAll("h2").find((h) => h.textContent === word("screen.case-editor.account"));
  assert.ok(tipOf(head).includes(word("screen.case-editor.account.help")));
  const sel = p.doc.getElementById("ce-framing");
  assert.deepEqual(sel.querySelectorAll("option").map((o) => o.getAttribute("value")), ["time_order", "by_question", "by_rule"]);
  assert.ok(drew(p, "case-account.framing.time_order") && drew(p, "case-account.framing.by_question") && drew(p, "case-account.framing.by_rule"));
  assert.ok(ops(p).includes("accountpropose") && ops(p).includes("accountdrafts") && ops(p).includes("casedraft"));
  const acct = head.closest("section");
  assert.ok(acct.querySelector('[data-origin="machine"]') && acct.textContent.includes("In March the council voted. In April the rents rose."), "the draft as machine work");
  assert.ok(drewIn(acct, "screen.case-editor.account.use") && drewIn(acct, "screen.case-editor.account.notasis"));
  assert.ok(drewIn(acct, "screen.case-editor.account.flagged", { sentence: "In April the rents rose." }) && acct.textContent.includes("The minutes it cites do not mention April."));
  const field = p.doc.getElementById("ce-account");
  assert.equal(field.value || field.textContent, "In March the council voted.\nIn April the rents rose.");
  const q = await open(`/app/case-editor/${P}`);
  assert.equal(q.doc.getElementById("ce-framing"), null, "no framings without the assistant");
  assert.ok(!ops(q).includes("accountpropose"));
  assert.ok(q.doc.getElementById("ce-account") && ops(q).includes("accountdrafts"), "the field and the earlier drafts remain");
});

test("R35 \"See its earlier drafts\" lists them; no act sends the machine draft unchanged as the account (control)", async () => {
  const p = await open(`/app/case-editor/${P}`, { plane: { ...reach, accountdrafts: ok({ case: C, drafts: [ACCOUNT_DRAFT] }) } });
  assert.ok(text(p).includes(ACCOUNT_DRAFT.text), "the draft the plane holds is drawn as machine work");
  await press(p, "accountdrafts");
  assert.equal(last(p, "accountdrafts").query.case, C);
  assert.equal(p.byOp("accountpropose").length, 0, "the screen sends nothing to accountpropose: asking the assistant for the draft is held with the assistant (K3717)");
  fill(p, { "ce-scope": "Rents.", "ce-account": "In March the council voted." });
  await press(p, "casedraft", { nth: 1, reason: "edit" });
  const body = last(p, "casedraft").body;
  assert.deepEqual(body.account, [{ text: "In March the council voted.", cites: [] }], "the member's own words");
  assert.ok(!JSON.stringify(body).includes(ACCOUNT_DRAFT.text), "the machine draft is never the account unchanged");
});

/* K3717 (BOB's ruling, B13): the press of "Draft the account with the assistant" is assistant work, held; `accountpropose` stores a draft an AI run made. */
test.todo("R35 the draft act sends the framing chosen for the case (held: K3717)");
test.todo("R35 accountpropose's refusals BAD_ACCOUNT_FRAMING and BAD_ACCOUNT_DRAFT are drawn by their words (held: K3717)");

test("R35 the account's refusals are drawn by key, refusal.BAD_ACCOUNT in a fold headed by its summary", async () => {
  const p = await open(`/app/case-editor/${P}`, { plane: { casedraft: refusedIn("BAD_ACCOUNT", "") } });
  fill(p, { "ce-scope": "Rents.", "ce-account": "One." });
  const { slot } = await press(p, "casedraft", { nth: 1, reason: "edit" });
  const fold = (slot() || main(p)).querySelector('[data-fold="screen.case-editor.account.refused.summary"]') || main(p).querySelector('[data-fold="screen.case-editor.account.refused.summary"]');
  assert.ok(fold && drewIn(fold, "screen.case-editor.account.refused.summary") && drewIn(fold, "refusal.BAD_ACCOUNT"));
  const d = await open(`/app/case-editor/${P}`, { plane: { ...reach, accountdrafts: refusedIn("NO_SUCH_ACCOUNT_DRAFT", "") } });
  await press(d, "accountdrafts", { reason: "list" });
  assert.ok(drew(d, "refusal.NO_SUCH_ACCOUNT_DRAFT"));
});

/* ---------- R36: publishedcase read asynchronously ---------- */

test("R36 over a plane that answers publishedcase after a delay, the page and its corrections line appear only with the answer, never as none; a rejected read is drawn failed", async () => {
  const slow = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: delay(200, ok({ ...PUBLISHED_CASE, corrections: { count: 1, last: { seq: 2, kind: "withdrawal", date: "2026-12-01" } } })) } });
  assert.ok(!drew(slow, "screen.published.corrections.none") && !drew(slow, "screen.published.corrections.heading"), "nothing drawn from a read that has not answered");
  assert.ok(main(slow).querySelector('[data-state="loading"]'), "loading while it waits");
  await new Promise((r) => setTimeout(r, 300));
  await slow.settle();
  assert.ok(drew(slow, "screen.published.corrections.some.one", { kind: word("screen.published.corrections.kind.withdrawal"), date: day("2026-12-01") }), "drawn once it arrives");
  for (const bad of [refusedIn("SOME_REFUSAL", "The plane refused this read."), silent]) {
    const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: bad } });
    assert.ok(main(p).querySelector('[data-state="failed"]'));
    assert.ok(!drew(p, "screen.published.corrections.none"), "never count 0");
  }
});

test("R36 \"Check a file you hold\" waits for the read by that hash: a slow answer is drawn once it arrives, and one that failed or was not answered is drawn failed, never as the fingerprint being absent or elsewhere", async () => {
  const pins = [E1, B1];
  const verify = (req) => ok(pins.includes(req.query.sha256) ? { published: true, sha256: req.query.sha256, matches: [{ bundle_id: "FND-2026-0031", published: "2026-11-19T14:00:00Z" }] } : { published: false, sha256: req.query.sha256, matches: [] });
  const base = PUBLISHED_CASE;
  const slowby = { verify, publishedcase: (req) => (req.query.sha256 ? delay(150, ok({ ...base, asked: "FND-2026-0031", findings: [{ ...base.findings[0], version_sha: B1 }] }))() : ok(base)) };
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: slowby });
  fill(p, { "pb-sha": B1 });
  await p.click(main(p).querySelectorAll('button[data-act="verify"]').find((b) => b.getAttribute("data-check") === "1"));
  assert.ok(!drew(p, "published.check.no") && !drew(p, "published.check.elsewhere"), "nothing is said before the read answers");
  await new Promise((r) => setTimeout(r, 300));
  await p.settle();
  assert.ok(drew(p, "published.check.yes", { n: "1", finding: "The 2024 adjustments were made without the council vote the lease requires." }));
  for (const bad of [silent, refusedIn("SOME_REFUSAL", "The plane refused this read.")]) {
    const q = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { verify, publishedcase: (req) => (req.query.sha256 ? bad : ok(base)) } });
    await press(q, "verify", { nth: 1, values: { "pb-sha": E1 } });
    assert.ok(drew(q, "shell.unread"), "drawn failed");
    assert.ok(!drew(q, "published.check.no") && !drew(q, "published.check.elsewhere") && !drew(q, "published.check.yes", { n: "1", finding: "x" }));
  }
});

test("R24 the keys R25–R36 name are words the module lists on a screen that may draw them", async () => {
  const { SCREENS } = await import("./fixtures.mjs");
  const listed = new Set(SCREENS.flatMap((s) => s.words));
  for (const k of ["screen.imported.list", "screen.imported.list.says", "screen.imported.list.row", "screen.imported.list.row.part", "screen.imported.list.none", "caseimport.stake.heading",
    "case-import.group_fields_label", "case-import.group_fields_none", "caseimport.notrecorded.summary", "caseimport.stake.unreadable", "caseimport.unreadable.summary",
    "screen.review-outside.until.zone", "screen.review-copy.until.nozone.summary", "screen.review-copy.until.nozone.member", "ceremony.gate.heading", "ceremony.gate.notargets",
    "ceremony.gate.other", "case.draft.untitled", "case.ladder.notyet", "screen.case-editor.tip.distributed", "published.check.elsewhere", "act.publish.here.ceremony",
    "screen.case-editor.whatgoesin", "screen.case-editor.whatgoesin.note", "capture.fieldneeded", "screen.ceremony.nothing", "screen.published.corrections.heading",
    "screen.published.corrections", "screen.published.corrections.none", "screen.published.corrections.some", "screen.published.corrections.some.one", "screen.published.corrections.kind.edition",
    "screen.published.corrections.kind.withdrawal", "screen.published.corrections.kind.court-order", "screen.docket-public.sub", "screen.docket-public.back", "screen.case-editor.noconcluded",
    "screen.case-editor.noconcluded.summary", "screen.case-editor.account", "screen.case-editor.account.help", "screen.case-editor.account.order", "screen.case-editor.account.flagged",
    "screen.case-editor.account.use", "screen.case-editor.account.notasis", "screen.case-editor.account.refused.summary", "refusal.BAD_ACCOUNT", "refusal.BAD_ACCOUNT_DRAFT",
    "refusal.BAD_ACCOUNT_FRAMING", "refusal.NO_SUCH_ACCOUNT_DRAFT", "act.accountpropose.label.case-editor", "act.accountdrafts.label.case-editor"]) {
    assert.ok(hasWord(k), `${k} is a word`);
    assert.ok(listed.has(k), `${k} is listed by a screen`);
  }
});
