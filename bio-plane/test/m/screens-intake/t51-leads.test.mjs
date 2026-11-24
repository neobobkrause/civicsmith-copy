/* screens-intake R44 (T51 fix round; DEC-375 C18): the `leads` screen on the real served page, over the REAL store (fix round 10, K5054): the
 * members are signed in by the real acts, a lead is written by the page's own act and read back by the owner's `leadread`/`leadlist`, a look and a
 * share are the owner's. Each act sends the fields its owner declares; a lead not shared stays the member's (control). A sentence is asserted by its
 * key. A fault (an owner's refusal the real acts cannot make) is the only scripted answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, text, main, fill, press, refused, says, saysIn, rawKeys } from "./page.mjs";

const WORDS = "The city inspected the Coliseum garage in 2019.";
const WHERE = "Oakland Public Works, inspection records, 2019";
const CAN = ["contribute", "create_projects"];
/* mai writes; rosa is a participant of a project mai shares to: invited by mai, joined by herself */
async function team() {
  const t = await members({ mai: CAN, rosa: [] });
  const project = await t.world.recipes.project(t.mai, "The Coliseum lease");
  const other = await t.world.recipes.project(t.mai, "Pothole repairs");
  await t.mai.act("projectinvite", { query: { projectId: project, handle: "rosa" } });
  await t.rosa.act("projectjoin", { query: { projectId: project } });
  return { ...t, project, other };
}
const at = (t, as = t.mai, path = "/app/leads", plane = {}) => openWorld(path, { world: t.world, as, plane });
const written = async (t, plane = {}) => {
  const p = await at(t, t.mai, "/app/leads", plane);
  fill(p, { "ld-words": WORDS, "ld-where": WHERE });
  await press(p, "lead", { reason: WORDS });
  return p;
};
const idOf = async (t) => (await t.mai.read("leadlist")).leads[0].lead_id;

test("R44 R52 writing a lead sends its words and where it might be found; it is then listed, unlooked-at, as the member's own", async () => {
  const t = await team();
  const p = await written(t);
  assert.deepEqual(p.byOp("lead").map((r) => ({ words: r.body.words, locator: r.body.locator })), [{ words: WORDS, locator: WHERE }]);
  assert.ok(says(p, "screen.leads.mine.head"));
  assert.ok(text(p).includes(WORDS));
  assert.ok(says(p, "screen.leads.state.never"));
  assert.ok(p.byOp("leadlist").length >= 2, "R52 a lead written in the visit appears by the list being read again");
  assert.ok(says(p, "screen.leads.write.note1") && says(p, "screen.leads.write.note2"), "only you can read it until you share it");
  assert.deepEqual(rawKeys(p), []);
  const kept = (await t.mai.read("leadlist")).leads;
  assert.deepEqual(kept.map((l) => [l.words, l.locator, l.author]), [[WORDS, WHERE, "mai"]], "the owner holds what the page sent");
  /* control: where is optional */
  const u = await team();
  const q = await at(u);
  fill(q, { "ld-words": "w" });
  await press(q, "lead", { reason: "w" });
  assert.deepEqual(q.byOp("lead").map((r) => Object.keys(r.body).sort()), [["words"]]);
  assert.equal((await u.mai.read("leadlist")).leads.length, 1);
});

test("R44 an empty lead is refused in the owner's words and nothing is listed; no list is drawn before anything is written", async () => {
  const t = await team();
  /* the page sends the words it was given as the reason, so a blank one is stopped before the owner; the owner's own refusal is a fault the real act cannot be made to
     cause from this page, and so the one scripted answer */
  const p = await at(t, t.mai, "/app/leads", { lead: refused("LEAD_NO_WORDS", "builder detail") });
  assert.ok(!says(p, "screen.leads.mine.head"));
  fill(p, { "ld-words": "x" });
  const r = await press(p, "lead", { reason: "x" });
  assert.ok(saysIn(r.slot(), "refusal.LEAD_NO_WORDS"));
  assert.ok(!r.slot().textContent.includes("builder detail"));
  assert.ok(!says(p, "screen.leads.mine.head"));
  assert.equal((await t.mai.read("leadlist")).leads.length, 0, "nothing was recorded");
  /* control: a blank lead is stopped at the page, which sends nothing */
  const q = await at(t);
  fill(q, { "ld-words": "   " });
  await press(q, "lead", { reason: "   " });
  assert.equal(q.byOp("lead").length, 0);
});

test("R44 reading it back: Open it draws the lead, its looks by who looked and what they found, and where it was shared", async () => {
  const t = await team();
  const p = await written(t);
  const id = await idOf(t);
  await t.mai.act("leadshare", { body: { lead: id, project: t.project, reason: "The project needs this report." } });
  await t.rosa.act("leadlook", { body: { lead: id, state: "LOOKED_INDETERMINATE", detail: "Searched the portal; nothing under that name." } });
  await press(p, "leadread");
  assert.deepEqual(p.byOp("leadread").map((r) => r.query.id), [id]);
  assert.ok(says(p, "screen.leads.one.head"));
  const s = text(p);
  assert.ok(s.includes("rosa") && s.includes("Searched the portal; nothing under that name."));
  assert.ok(s.includes("The Coliseum lease") && s.includes("The project needs this report."));
  assert.ok(says(p, "screen.leads.state.unclear"));
});

test("R44 recording a look sends each outcome the owner declares: not there, could not tell, part, there; a found document is pointed at", async () => {
  const states = { absent: "LOOKED_ABSENT", unclear: "LOOKED_INDETERMINATE", part: "partial", found: "PRESENT" };
  for (const [key, state] of Object.entries(states)) {
    const t = await team();
    const held = await t.world.recipes.page(t.mai, "The inspection report");
    const p = await written(t);
    const id = await idOf(t);
    await press(p, "leadread");
    fill(p, { "ld-lks": state, "ld-lkd": "Looked at the portal.", ...(state === "PRESENT" || state === "partial" ? { "ld-lkk": "capture", "ld-lkr": held.sha } : {}) });
    await press(p, "leadlook", { reason: "Looked at the portal." });
    const b = p.byOp("leadlook")[0].body;
    assert.equal(b.state, state, key);
    assert.equal(b.lead, id);
    assert.equal(b.detail, "Looked at the portal.");
    if (state === "PRESENT" || state === "partial") assert.deepEqual([b.resultKind, b.resultRef], ["capture", held.sha]);
    else assert.ok(!("resultKind" in b) && !("resultRef" in b), "only a look that found something points at anything");
    const looks = (await t.mai.read("leadread", { query: { id } })).looks;
    assert.deepEqual(looks.map((l) => [l.state, l.detail]), [[state, "Looked at the portal."]], `${key}: the owner recorded the look`);
  }
});

test("R44 sharing it with a project sends the lead, the project and the reason; a lead not shared stays the member's (no share, no project told)", async () => {
  const t = await team();
  const p = await written(t);
  const id = await idOf(t);
  await press(p, "leadread");
  assert.equal(p.byOp("leadshare").length, 0, "control: opening it shares nothing");
  assert.deepEqual((await t.rosa.read("leadlist")).leads, [], "control: until it is shared, a participant reads none");
  fill(p, { "ld-lsp": t.other, "ld-lsr": "The project needs this report." });
  await press(p, "leadshare", { reason: "The project needs this report." });
  assert.deepEqual(p.byOp("leadshare").map((r) => ({ lead: r.body.lead, project: r.body.project, reason: r.body.reason })), [{ lead: id, project: t.other, reason: "The project needs this report." }]);
  assert.ok(says(p, "screen.leads.share.note1") && says(p, "screen.leads.share.note2"));
  assert.deepEqual((await t.mai.read("leadread", { query: { id } })).shared_to.map((s) => s.project), [t.other], "the owner recorded the share");
});

test("R44 the share and the look are refused in the owner's words: not a participant, already shared, no reason, no detail", async () => {
  const seen = new Set();
  /* what the owner refuses for the real acts: a share to a project the member is not in; a look at a found document the record does not hold */
  for (const [op, code, fields, projectOf] of [["leadshare", "LEAD_SHARE_NOT_A_PARTICIPANT", { "ld-lsr": "r" }, "PROJ-2026-0000-nobody"], ["leadlook", "LEAD_LOOK_REFERENT", { "ld-lkd": "d", "ld-lks": "PRESENT", "ld-lkk": "capture", "ld-lkr": "f".repeat(64) }]]) {
    const t = await team();
    const p = await written(t);
    await press(p, "leadread");
    fill(p, { ...(projectOf ? { "ld-lsp": projectOf } : {}), ...fields });
    const r = await press(p, op, { reason: "r" });
    assert.ok(saysIn(r.slot(), `refusal.${code}`), code);
    seen.add(r.slot().textContent);
  }
  /* the two the page's own reason field stops before the owner (it sends the reason as the reason/detail): the owner's refusal is a fault, the one scripted answer */
  for (const [op, code, fields] of [["leadshare", "LEAD_SHARE_NO_REASON", { "ld-lsr": "r" }], ["leadlook", "LEAD_LOOK_NO_DETAIL", { "ld-lkd": "d" }]]) {
    const t = await team();
    const p = await written(t, { [op]: refused(code, "builder detail") });
    await press(p, "leadread");
    fill(p, { ...(op === "leadshare" ? { "ld-lsp": t.project } : {}), ...fields });
    const r = await press(p, op, { reason: "r" });
    assert.ok(saysIn(r.slot(), `refusal.${code}`), code);
    assert.ok(!r.slot().textContent.includes("builder detail"));
    seen.add(r.slot().textContent);
  }
  assert.equal(seen.size, 4);
});

test("R44 a lead's address opens it: leadread is asked for it; one that cannot be read is Nothing is here", async () => {
  const t = await team();
  await written(t);
  const id = await idOf(t);
  const p = await at(t, t.mai, `/app/leads/${id}`);
  assert.ok(p.byOp("leadread").every((r) => r.query.id === id) && p.byOp("leadread").length >= 1);
  assert.ok(says(p, "screen.leads.one.head"));
  /* a lead the member cannot read is not found, however it is asked for: rosa reads none of mai's unshared lead */
  const q = await at(t, t.rosa, `/app/leads/${id}`);
  assert.ok(says(q, "shell.unavailable.nothing.says"));
});

test("R52 'Your leads' is what leadlist answers, newest first, one row for each; an empty answer draws no list; the screen keeps no list of its own", async () => {
  const t = await team();
  const first = await t.mai.act("lead", { body: { words: WORDS } });
  t.world.tick(1000);
  const second = await t.mai.act("lead", { body: { words: "The owner paid the city a fee in 2021." } });
  await t.mai.act("leadlook", { body: { lead: second.lead_id, state: "LOOKED_INDETERMINATE", detail: "Could not tell." } });
  const p = await at(t);
  assert.ok(says(p, "screen.leads.mine.head"));
  const s = text(p);
  const order = (await t.mai.read("leadlist")).leads;
  assert.deepEqual(order.map((l) => l.lead_id).sort(), [first.lead_id, second.lead_id].sort());
  assert.ok(s.includes(order[0].words) && s.includes(order[1].words) && s.indexOf(order[0].words) < s.indexOf(order[1].words), "in the order the plane answers");
  assert.deepEqual(main(p).querySelectorAll('button[data-act="leadread"]').map((b) => b.getAttribute("data-id")), order.map((l) => l.lead_id));
  assert.ok(says(p, "screen.leads.state.unclear") && says(p, "screen.leads.state.never"));
  assert.ok(p.byOp("leadlist").length >= 1);
  assert.deepEqual(rawKeys(p), []);
  /* the empty answer: the design draws no list */
  const q = await at(await team());
  assert.ok(!says(q, "screen.leads.mine.head"));
});

test("R52 control: a lead the viewer may not read is not drawn; a list that failed draws no list", async () => {
  const t = await team();
  await written(t);
  const other = await at(t, t.rosa);
  assert.ok(!says(other, "screen.leads.mine.head"), "the list is what the record shows this viewer: rosa reads none of mai's lead");
  assert.ok(!text(other).includes(WORDS));
  const f = await at(t, t.mai, "/app/leads", { leadlist: refused("LEAD_LIST_X", "x", 500) });
  assert.ok(!says(f, "screen.leads.mine.head") && says(f, "screen.leads.write.heading") && f.byOp("leadlist").length >= 1, "the writing form stays; no list is drawn from a list that failed");
  assert.deepEqual(rawKeys(f), []);
});
