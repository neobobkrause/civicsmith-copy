/* screens-action R24, R28, R29, R35 (T51-122): `actionnew`, the composer for an action of any kind; the kinds worded twice; the door
   from `request`; no template before an action exists. Every sentence is asserted by its key (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { actionWorld, profiledWorld, question, entityOf, officeFor, suggestingFor, actionsOf, openIn } from "./world-C.mjs";
import { open, main, text, ops, press, last, ok, refusedIn, button, choose, W, hasWord, DATA_PLANE, ROUTES, ACTION, ACTION_ID, PROJECT, QUESTION, QUESTION_TITLE, AFFORDANCES,
  OFFICES, KINDS, PREVIEW, STAKE, READ, FILINGS, draft, READER, RO } from "./page.mjs";

const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);
const PLANE = { ...DATA_PLANE, addresseesuggest: ok(OFFICES) };
/** The composer over the real store: a project with a question it draws on, an office the record holds for a subject, the Oakland profile active. */
async function composer() {
  const w = await profiledWorld();
  const asked = await question(w.world, w.me, w.project);
  const subject = await entityOf(w.me, "person", "Pothole repair program");
  await officeFor(w.me, subject, "City Clerk", "Office of the City Clerk");
  const offered = (await w.me.read("addresseesuggest", { query: { subject } })).offices[0].addressee;
  const path = `/app/actionnew/${w.project}`;
  return { ...w, asked, offered, path, page: (plane = {}) => openIn(w.world, w.me, path, { addresseesuggest: suggestingFor(w.world, w.me, subject), ...plane }) };
}
const optionsOf = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => [o.value, o.textContent.trim()]);

test("R24, R28: the kinds offered are the vocabulary's, each in its words (the drawing's last as `screen.actionnew.kind.other`), a profile's own by its label; one with neither is not offered", async () => {
  const p = await open(ROUTES.actionnew, PLANE);
  assert.equal(p.byOp("affordances").length, 1, "the vocabulary is read at each call");
  const kinds = optionsOf(p, "an-kind");
  for (const k of KINDS.filter((k) => k !== "other")) assert.ok(kinds.some(([v, t]) => v === k && t === W("screen.action.kind." + k)), k);
  assert.ok(kinds.some(([v, t]) => v === "other" && t === W("screen.actionnew.kind.other")), "other in the composer's words");
  assert.ok(kinds.some(([v, t]) => v === "profile_kind_x" && t === "Hearing statement"), "a profile kind by its label");
  assert.ok(!kinds.some(([v]) => v === "profile_kind_unlabelled"), "a kind with neither key nor label is not offered");
  assert.ok(kinds.every(([v, t]) => v === "other" || t !== W("screen.action.kind.other")), "no kind is ever drawn as Other but `other`");
  assert.deepEqual(kinds.map(([v]) => v).filter((v) => KINDS.includes(v)), AFFORDANCES.vocabularies.action_kind.filter((v) => KINDS.includes(v)), "in the vocabulary's order");
  const q = await open(ROUTES.actionnew, { ...PLANE, affordances: ok({ vocabularies: { ...AFFORDANCES.vocabularies, action_kind: ["records_request", "grand_jury"], action_kind_labels: {} } }) });
  assert.deepEqual(optionsOf(q, "an-kind").map(([v]) => v), ["records_request", "grand_jury"], "control: a product kind with no profile is offered, and no more");
});

test("R24, R28: a kind a profile defines, offered under the family's words, is drawn in the other screens the same way (the action page, start-send in lower case)", async () => {
  const prof = { ...AFFORDANCES.vocabularies, action_kind_labels: { profile_kind_x: "Hearing statement" } };
  const a = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, kind: "grand_jury" }), affordances: ok({ vocabularies: prof }) });
  const sub = (x) => text(x, main(x).querySelector("p.mk-sub"));
  assert.ok(sub(a).startsWith(W("screen.action.kind.grand_jury")));
  const b = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, kind: "profile_kind_x" }), affordances: ok({ vocabularies: prof }) });
  assert.ok(sub(b).startsWith("Hearing statement"), "a profile kind by its own label");
  const c = await open(ROUTES.action, { ...DATA_PLANE, action: ok({ ...ACTION, kind: "profile_kind_unlabelled" }), affordances: ok({ vocabularies: prof }) });
  assert.ok(!sub(c).startsWith(W("screen.action.kind.other")), "a kind with neither is never drawn as Other");
  // start-send: the same kind in lower case, in the preview and in the stake question's sentence
  const preview = { ...PREVIEW, action: { ...PREVIEW.action, kind: "grand_jury" } };
  const s = await open(ROUTES["start-send"], { ...DATA_PLANE, optionstartpreview: ok(preview) });
  assert.ok(text(s).includes(W("screen.start-send.kind.grand_jury")), "lower case in start-send");
  const kinds = optionsOf(s, "start-kind");
  assert.ok(kinds.some(([v, t]) => v === "grand_jury" && t === W("screen.start-send.kind.grand_jury")));
  assert.ok(kinds.some(([v, t]) => v === "profile_kind_x" && t === "Hearing statement"));
  assert.ok(!kinds.some(([v]) => v === "profile_kind_unlabelled"));
  const st = await open(`/app/start-send/${ACTION_ID}`, { ...DATA_PLANE, action: ok({ ...ACTION, kind: "grand_jury" }), filingsfor: ok(FILINGS([draft()])),
    stakeatpreparation: ok(STAKE({ higher_stakes: true, governing_tier: 2 })), groupidentity: ok({ display_name: "River Town" }), filingread: ok(READ()) });
  const kindWord = W("screen.start-send.kind.grand_jury");
  assert.ok(text(st).includes(kindWord.charAt(0).toUpperCase() + kindWord.slice(1)), "stake.ask.says reads the same family");
});

test("R24, R29: choosing 'Records request' draws the door to `request` and no composer; every other kind is composed here, `cpra_request` too; the note is drawn whatever is chosen", async () => {
  const p = await open(ROUTES.actionnew, PLANE);
  said(p, "screen.actionnew.records");
  assert.ok(main(p).querySelector(`a[href="/app/request/${PROJECT}"]`), "the door to request, with the project");
  assert.ok(p.doc.getElementById("an-ask"), "composed here");
  assert.ok(ops(p).includes("actioncreate"));
  await choose(p, "an-kind", "records_request");
  said(p, "screen.actionnew.records");
  assert.ok(main(p).querySelector(`a[href="/app/request/${PROJECT}"]`));
  assert.equal(p.doc.getElementById("an-ask"), null, "no composer");
  assert.ok(!ops(p).includes("actioncreate"), "control: no composer, no act");
  await choose(p, "an-kind", "cpra_request");
  assert.ok(p.doc.getElementById("an-ask"), "the profile kind cpra_request is composed here");
});

test("R24: 'Start the action' for a kind with an addressee, a leg and a dated entry sends one actioncreate carrying exactly those, and the action opens", async () => {
  const { me, project, asked, offered, page } = await composer();
  const p = await page();
  await choose(p, "an-kind", "grand_jury");
  await choose(p, "an-leg", asked);
  await press(p, "addresseesuggest");
  assert.equal(last(p, "addresseesuggest").query.subject, asked, "the office is suggested for what the action rests on");
  await press(p, "actioncreate", { values: { "an-office": "0", "an-ask": "Refer the closures to the grand jury", "an-tier": "2", "an-legk": "rests_on",
    "an-due-text": "Referral filed", "an-due-date": "2026-11-15", "an-due-because": "the notice of the draft standard" }, reason: "x" });
  const sent = p.byOp("actioncreate");
  assert.equal(sent.length, 1);
  const doc = sent[0].body.document;
  for (const piece of ['action_kind: "grand_jury"', 'title: "Refer the closures to the grand jury"', "risk_tier: 2", "project: " + project, "current_state: planned", "  role: " + JSON.stringify(offered.role),
    "  body: " + JSON.stringify(offered.body), "  - target: " + JSON.stringify(asked), '    kind: "rests_on"', "    date: 2026-11-15", '    basis: "the notice of the draft standard"', "    status: pending"])
    assert.ok(doc.includes(piece), piece);
  assert.ok(!/author/.test(doc), "the author is set by the door and never the body");
  const made = (await actionsOf(me)).filter((a) => a.kind === "grand_jury");
  assert.equal(made.length, 1, "the store holds the one action");
  assert.equal(p.location.pathname, `/app/action/${made[0].id}`, "the action opens");
  const held = await me.read("action", { query: { id: made[0].id } });
  assert.deepEqual([held.project, held.title, held.risk_tier], [project, "Refer the closures to the grand jury", 2], "as the record holds it");
});

test("R24: refusals in place send nothing: an undetermined addressee with no basis, a date with no basis, a request for comment with no advancing leg", async () => {
  const { me, page } = await composer();
  const p = await page();
  await choose(p, "an-kind", "media");
  await choose(p, "an-to", "undetermined");
  said(p, "screen.actionnew.to.unsent");
  said(p, "screen.actionnew.to.undetermined");
  const a = await press(p, "actioncreate", { values: { "an-ask": "Tell the story" }, reason: "x" });
  assert.equal(p.byOp("actioncreate").length, 0);
  assert.ok(text(p, p.root().querySelector(`[data-slot="${a.getAttribute("data-ai")}"]`)).includes(W("screen.actionnew.refused.addressee")), "R80 (T53): in the member's words");
  await press(p, "actioncreate", { values: { "an-basis": "A reporter, not yet chosen", "an-due-text": "Story runs", "an-due-date": "2026-11-01" }, reason: "x" });
  assert.equal(p.byOp("actioncreate").length, 0, "a date with no basis is refused in place");
  assert.deepEqual((await actionsOf(me)).filter((x) => x.kind === "media"), [], "control: the store holds none");
  await press(p, "actioncreate", { values: { "an-due-because": "the editor's schedule" }, reason: "x" });
  const doc = last(p, "actioncreate").body.document;
  assert.ok(doc.includes('state: "undetermined"') && doc.includes('basis: "A reporter, not yet chosen"'), "undetermined, with what is known");
  assert.equal((await actionsOf(me)).filter((x) => x.kind === "media").length, 1, "and the store took it");
  const q = await page();
  await choose(q, "an-kind", "request_for_comment");
  const rfc = await press(q, "actioncreate", { values: { "an-who": "The auditor", "an-ask": "Comment on the standard" }, reason: "x" });
  // R56 (walk E K-new): no local pre-check; the plane is asked and its refusal is drawn
  assert.equal(q.byOp("actioncreate").length, 1, "a request for comment with no advances leg is sent: the plane refuses it, not the screen");
  const shown = text(q, q.root().querySelector(`[data-slot="${rfc.getAttribute("data-ai")}"]`));
  assert.ok(shown.length > 0 && !shown.includes(W("refusal.ACTION_BASIS_REFUSED")), "the owner's reasons are drawn, not the code's sentence that ends 'leave it out' (re-walk 10 N7)");
  assert.equal((await actionsOf(me)).filter((x) => x.kind === "request_for_comment").length, 0, "and the store holds none");
});

test("R24: control: no tier is preselected and nothing is filled from the project's questions without her choice; the machine sets no tier; a refusal is drawn by its words", async () => {
  /* the owner's own refusal: `public_comment` is no kind of the product's and no profile is active, so `actions` refuses `ACTION_KIND_UNKNOWN` */
  const { world, me, project } = await actionWorld();
  const asked = await question(world, me, project);
  const p = await openIn(world, me, `/app/actionnew/${project}`);
  assert.equal(p.doc.getElementById("an-tier").value, "", "no tier chosen for her");
  assert.equal(p.doc.getElementById("an-leg").value, "", "no question chosen for her");
  assert.ok(optionsOf(p, "an-leg").some(([v, t]) => v === asked && t === "Is closed the same as repaired?"), "the questions are picked from, as titled");
  const b = await press(p, "actioncreate", { values: { "an-kind": "public_comment", "an-who": "The council", "an-ask": "Comment by October 30" }, reason: "x" });
  const doc = last(p, "actioncreate").body.document;
  assert.ok(!/risk_tier/.test(doc), "no tier is sent unless she sets one");
  assert.ok(doc.includes("action_basis: []") && doc.includes("clock: []"), "nothing from the questions");
  assert.ok(doc.includes('state: "audience"') && doc.includes('description: "The council"'), "a described audience, never a bare string");
  assert.ok(text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W("refusal.ACTION_KIND_UNKNOWN")));
  assert.equal((await actionsOf(me)).filter((a) => a.kind === "public_comment").length, 0, "control: the owner refused it, the store holds none");
});

test("R24, R35: the composer offers no template or kind as a suggestion before an action exists; it says when templates are offered", async () => {
  const p = await open(ROUTES.actionnew, PLANE);
  said(p, "screen.actionnew.templates.after");
  said(p, "screen.actionnew.templates.none");
  assert.equal(p.byOp("templatesforaction").length, 0, "no template is read before an action exists");
  assert.equal(main(p).querySelector('[data-state="templates"]'), null);
  const bare = await open("/app/actionnew", PLANE);
  assert.ok(main(bare).querySelector('[data-state="empty"]'), "a bare screen draws only 'Nothing is here'");
});

test("R29: `request` leads to the composer for any other kind, in both of its states, on the same project; control: `actionnew` draws no door back for a kind other than records", async () => {
  const none = { ...DATA_PLANE, addresseesuggest: ok({ subject: PROJECT, offices: [], suggestion: true }) };
  const some = { ...DATA_PLANE, addresseesuggest: ok(OFFICES) };
  for (const plane of [none, some]) {
    const p = await open(`/app/request/${PROJECT}`, plane);
    said(p, "screen.request.other");
    const a = main(p).querySelectorAll("a").find((x) => x.textContent.includes(W("screen.request.other.go")));
    assert.equal(a.getAttribute("href"), `/app/actionnew/${PROJECT}`);
    assert.ok(text(p).includes(W("screen.actionnew.name")) && text(p).includes(W("screen.actionnew.purpose")), "its card");
  }
  const q = await open(`/app/request/${ACTION_ID}`, DATA_PLANE);
  unsaid(q, "screen.request.other");
  const c = await open(ROUTES.actionnew, PLANE);
  await choose(c, "an-kind", "grand_jury");
  assert.ok(hasWord("screen.request.other.go"));
});

test("R27: a member who may read and not act is told so and sees none of the composer's acts", async () => {
  const p = await open(ROUTES.actionnew, { ...PLANE, whoami: ok(READER) });
  assert.ok(text(p).includes(RO("actionnew")), "the kit's read-only sentence, the screen's name its noun");
  assert.deepEqual(ops(p), []);
  const q = await open(ROUTES.actionnew, PLANE);
  assert.ok(!text(q).includes(RO("actionnew")), "control: a member who may act reads no such sentence");
});
