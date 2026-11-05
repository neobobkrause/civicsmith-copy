/* The decisions the record routes to a member (R75; C62, DEC-378, K4169) on Home and the queue, on the real served page over the REAL store
   (store-request's `storeWorld()`, op-tables §5.3): the document whose issuer is not known, the proposed administrator, the declared expertise and
   the owner votes are made by the real acts, so the queue the page reads and every act it sends are the real store's. The owners' declared ops
   are registered first (`taskdecide` is `tasks`' alone), so the authority form is drawn; every request is checked by the harness against the
   owners' declarations. Every sentence is asserted as `word(key, vars)` (R34), so no test holds a sentence's English.
   The world is imported before the page: it registers every owner's declared ops (op-declarations R81), so `OPS` holds `taskdecide` when the page reads it. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { storeWorld } from "../store-request/fixtures.mjs";
import { counted } from "../interface-shell/harness.mjs";
import { open as openRaw, ok, settle, text, ops, button, press, beside, last, main, word, hasWord, withScreens, dmy } from "./page.mjs";

const timeout = { timeout: 180000 };
const SCR = { screens: withScreens("document", "project") };
const open = (w, as, path, plane = {}) => openRaw(path, plane, { ...w.boot(as), ...SCR });
const screens = ["queue", "home"];
const at = { queue: "/app/queue", home: "/app" };
const PERMIT = "https://city.example/permit";
const hex = (s) => createHash("sha256").update(s).digest("hex");
const stamp = (w) => new Date(w.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
const raw = (w, as, op, body, query = {}) => w.door({ url: `/api/?${new URLSearchParams({ op, ...query })}`,
  init: body === undefined ? { method: "GET" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } }, as);
const resultOf = (a) => (a && a.json && a.json.result !== undefined ? a.json.result : a && a.json);

/** A document the member holds, captured from a public address (`acquire`, the address answered by the world's network, scripted) and promoted at
 *  `collected` as the capture screen promotes it. Answers its bundle's id. */
async function held(w, as, { title, address }) {
  w.script(address, async () => new Response(`<html><head><title>${title}</title></head><body><p>${address} ${title}</p></body></html>`, { status: 200, headers: { "content-type": "text/html" } }));
  const doc = (await as.act("acquire", { body: { locator: address } })).document;
  const now = stamp(w);
  const minted = await as.read("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } });
  const id = minted.id + "-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sha = doc.capture.sha256;
  const front = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(title), "current_state: collected", "prior_state: null",
    "created: " + now, "last_updated: " + now, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0",
    "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting", "source_status: unchanged", "content_hash: sha256:" + hex(sha),
    "source:", "  locator: " + JSON.stringify(doc.locator), "  authority: member-entered", "  retrieved: " + now, "monitoring:", "  enabled: false", "  frequency: none",
    "---", "", "## Summary", "", title, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const prov = JSON.stringify({ documents: [doc] }, null, 1), dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator, sha256: sha }] });
  const len = (s) => new TextEncoder().encode(s).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: hex(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: hex(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: hex(dataset) }, { path: doc.file, blobSha: sha, sha256: sha, bytes: doc.capture.bytes }];
  const register = [{ sha256: sha, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }];
  const made = await as.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + hex(id).slice(0, 8),
    meta: { object_type: "information", title, current_state: "collected", created: now, last_updated: now }, files, register } });
  return made.bundleId || id;
}

/** A group where the administrator `rosa` looked at Home before and members `ana`, `ben` and `mai` belong to it. */
async function group(members = ["ana", "ben", "mai"]) {
  const w = await storeWorld();
  const rosa = await w.signIn("rosa", { admin: true });
  const who = {};
  for (const handle of members) who[handle] = await w.signIn(handle);
  await rosa.read("lookedsince");
  return { w, rosa, ...who };
}
/** The document "Permit application" captured by `as` from an address that does not say who issued it, and the to-do the record routes to a
 *  member about it (`taskdrain`, the scheduler's drain run by the root of trust's credential). Answers `{bundle, task}`. */
async function permit(w, as, { title = "Permit application", address = PERMIT } = {}) {
  const bundle = await held(w, as, { title, address });
  const drained = await raw(w, { token: w.env.ADMIN_TOKEN }, "taskdrain", {});
  const made = resultOf(drained).created.find((t) => t.refers_to === bundle);
  if (!made) throw new Error("taskdrain made no to-do: " + JSON.stringify(resultOf(drained)).slice(0, 300));
  return { bundle, task: made.id };
}
/** The administrator `by` proposing `who` as a further administrator (`memberadd`; the team has two or more, so it waits for the others to endorse).
 *  `by` is never the founder: her proposal or endorsement alone issues the invitation (member-roster R87, K5563). */
async function propose(w, by, who) {
  await by.act("reauth", { body: { password: by.password } });
  const r = resultOf(await raw(w, by, "memberadd", { memberId: who, cover: `the world's member ${who}`, role: "admin" }));
  if (!r || r.reason !== "CONSENSUS_REQUIRED") throw new Error("memberadd did not wait for the others: " + JSON.stringify(r).slice(0, 300));
}
/** The queue's own item of `kind` for `as`. */
const itemOf = async (as, kind, pick = () => true) => (await as.read("queue")).items.find((i) => i.kind === kind && pick(i));
/** The people an item names, as the page names them: by handle (the record's items carry member ids). */
const namesOf = async (as) => Object.fromEntries((await as.read("memberlist")).members.map((m) => [m.member_id, m.handle || m.member_id]));
const list = (names, xs) => (xs || []).map((x) => names[x] || x).join(", ");

test("R75 (words): the words the authority form and the routed items read are held by the word list", () => {
  for (const k of ["screen.queue.routed.auth.item", "screen.queue.routed.auth.open", "screen.queue.routed.auth.question", "screen.queue.routed.auth.know",
    "screen.queue.routed.auth.cannot", "screen.queue.routed.auth.issuer.label", "screen.queue.routed.auth.tried.label", "screen.queue.routed.auth.tried.help1",
    "screen.queue.routed.auth.record", "screen.queue.routed.auth.how.label", "screen.queue.routed.auth.fine1", "queue.owed.nobody",
    "queue.endorsement-owed.summary", "queue.endorsement-owed.detail", "queue.endorsement-owed.owner.summary.add", "queue.endorsement-owed.owner.summary.remove",
    "queue.endorsement-owed.owner.detail", "queue.expertise-confirmation-owed.summary", "queue.expertise-confirmation-owed.detail", "act.projectownerremove.label.queue"]) assert.ok(hasWord(k), k);
});

for (const where of screens) {
  test(`R75 (${where}): an authority task opens a small form, neither answer preselected; "I know who issued it" sends the issuer and how she knows`, timeout, async () => {
    const { w, rosa } = await group([]);
    const { bundle, task } = await permit(w, rosa);
    const p = await open(w, rosa, at[where]);
    await settle();
    assert.ok(text(p).includes(word("screen.queue.routed.auth.item")));
    assert.ok(main(p).querySelector(`a.cs-ref[href="/app/document/${bundle}"]`), "it names the document by its title");
    const b = button(p, "taskdecide");
    assert.ok(b, "the form's act is drawn");
    const f = b.dataset.f;
    const radios = main(p).querySelectorAll(`#${f}-who input[type="radio"]`);
    assert.deepEqual(radios.map((r) => r.getAttribute("value")), ["known", "unknown"]);
    assert.ok(radios.every((r) => !r.checked), "neither is preselected");
    assert.ok(text(p, main(p).querySelector(`#${f}-who legend`)).includes(word("screen.queue.routed.auth.question")));
    const form = text(p, b.closest("details"));
    for (const k of ["screen.queue.routed.auth.cannot", "screen.queue.routed.auth.issuer.label", "screen.queue.routed.auth.tried.label", "screen.queue.routed.auth.tried.help1"]) assert.ok(form.includes(word(k)), k);
    assert.ok(b.textContent.startsWith(word("screen.queue.routed.auth.record")), "the answer is recorded by its own button");
    // control: nothing chosen sends nothing
    await press(p, "taskdecide");
    assert.equal(p.byOp("taskdecide").length, 0);
    // known without the issuing party, then without how she knows: nothing is sent, each refused beside the act
    await press(p, "taskdecide", { values: { [`${f}-who-0`]: true } });
    assert.equal(p.byOp("taskdecide").length, 0);
    const missingParty = await press(p, "taskdecide", { values: { [`${f}-how`]: "Its letterhead" } });
    assert.equal(beside(p, missingParty), word("screen.queue.routed.auth.refused.issuer2"));
    const missingHow = await press(p, "taskdecide", { values: { [`${f}-issuer`]: "Public Works", [`${f}-how`]: "" } });
    assert.equal(beside(p, missingHow), word("screen.queue.routed.auth.refused.basis"));
    assert.equal(p.byOp("taskdecide").length, 0);
    await press(p, "taskdecide", { values: { [`${f}-how`]: " Its letterhead " } });
    assert.deepEqual(last(p, "taskdecide").body, { id: task, outcome: "determined", authority: "Public Works", basis: "Its letterhead" });
    assert.equal(await itemOf(rosa, "authority-undetermined"), undefined, "the real to-do is resolved");
  });

  test(`R75 (${where}): "I could not tell" requires what she tried and sends no issuer; a resolved item is gone on the next read`, timeout, async () => {
    const { w, rosa } = await group([]);
    const { task } = await permit(w, rosa);
    const p = await open(w, rosa, at[where]);
    await settle();
    const f = button(p, "taskdecide").dataset.f;
    const noTried = await press(p, "taskdecide", { values: { [`${f}-who-1`]: true, [`${f}-issuer`]: "Ignored" } });
    assert.equal(p.byOp("taskdecide").length, 0, "I could not tell without what she tried sends nothing");
    assert.equal(beside(p, noTried), word("screen.queue.routed.auth.refused.basis"));
    await press(p, "taskdecide", { values: { [`${f}-tried`]: "The clerk's office" } });
    assert.deepEqual(last(p, "taskdecide").body, { id: task, outcome: "undetermined_after_review", basis: "The clerk's office" });
    assert.equal(button(p, "taskdecide"), null, "the item leaves with the next read");
    assert.doesNotMatch(text(p), /overdue/i);
  });

  test(`R75 (${where}): an authority task is passed on with taskforward, and its refusals are drawn in their own words`, timeout, async () => {
    const { w, rosa, ana, ben } = await group(["ana", "ben"]);
    const mine = await permit(w, rosa);
    const p = await open(w, rosa, at[where]);
    await settle();
    const fwd = await press(p, "taskforward");
    assert.equal(p.byOp("taskforward").length, 0, "control: no member, nothing sent");
    assert.equal(beside(p, fwd), word(where === "home" ? "screen.home.fieldfirst" : "screen.queue.fieldfirst"));
    await press(p, "taskforward", { values: { [button(p, "taskforward").dataset.f + "-to"]: "@ana" } });
    assert.deepEqual(last(p, "taskforward").body, { id: mine.task, to: "ana" });
    assert.ok(await itemOf(ana, "authority-undetermined"), "the real to-do is hers now");
    // The refusal is the record's own: a to-do ben looks at is handed on to ana by an administrator while his page is open, and what he sends then is not his to send.
    const theirs = await permit(w, rosa, { title: "Second permit", address: "https://city.example/second-permit" });
    await rosa.act("taskforward", { body: { id: theirs.task, to: "ben" } });
    await ben.read("lookedsince");
    const q = await open(w, ben, at[where]);
    await settle();
    await rosa.act("taskforward", { body: { id: theirs.task, to: "ana" } });
    const f = button(q, "taskdecide").dataset.f;
    const b = await press(q, "taskdecide", { values: { [`${f}-who-1`]: true, [`${f}-tried`]: "The clerk" } });
    assert.equal(beside(q, b), `${word("screen.queue.routed.auth.refused.yours1")} ${word("screen.queue.routed.auth.refused.yours2")}`);
  });

  test(`R75 (${where}): an endorsement owed names the person with who has agreed and who is awaited and sends adminendorse for her; an expertise item names the member and the label and sends expertiseconfirm`, timeout, async () => {
    const { w, rosa, mai } = await group(["mai"]);
    await propose(w, await w.signIn("cy", { admin: true }), "ana");
    await mai.act("expertisedeclare", { body: { memberId: "mai", label: "tenant law" } });
    await rosa.act("reauth", { body: { password: rosa.password } });
    const names = await namesOf(rosa);
    const owed = await itemOf(rosa, "endorsement-owed");
    assert.ok(owed.basis.have.length && owed.basis.awaiting.length, "the record says who has agreed and who is awaited");
    const p = await open(w, rosa, at[where]);
    await settle();
    assert.ok(text(p).includes(word("queue.endorsement-owed.summary", { who: "ana", have: list(names, owed.basis.have), awaiting: list(names, owed.basis.awaiting) })));
    assert.ok(text(p).includes(word("queue.endorsement-owed.detail")));
    assert.ok(text(p).includes(word("queue.expertise-confirmation-owed.summary", { who: "mai", label: "tenant law" })));
    assert.ok(text(p).includes(word("queue.expertise-confirmation-owed.detail")));
    assert.ok(button(p, "adminendorse").textContent.startsWith(word(`act.adminendorse.label.${where}`)));
    await press(p, "adminendorse", { reason: "I know her work" });
    assert.deepEqual(Object.keys(last(p, "adminendorse").body).sort(), ["memberId", "reason"]);
    assert.equal(last(p, "adminendorse").body.memberId, "ana");
    await press(p, "expertiseconfirm", { reason: "I have read her cases" });
    assert.equal(last(p, "expertiseconfirm").body.memberId, "mai");
    assert.equal(last(p, "expertiseconfirm").body.label, "tenant law");
    assert.equal(await itemOf(rosa, "expertise-confirmation-owed"), undefined, "the real expertise is confirmed");
  });

  test(`R75 (${where}), C75: passing a task on to oneself is refused in words, nothing sent`, timeout, async () => {
    const { w, rosa } = await group([]);
    await permit(w, rosa);
    const p = await open(w, rosa, at[where]);
    await settle();
    const self = await press(p, "taskforward", { values: { [button(p, "taskforward").dataset.f + "-to"]: "@rosa" } });
    assert.equal(p.byOp("taskforward").length, 0);
    assert.equal(beside(p, self), word("refusal.ALREADY_THEIRS"));
  });

  test(`R82 (${where}): endorsing the last administrator keeps the invitation the answer carries and shows it once, with the sentence that no email is sent`, timeout, async () => {
    const { w, rosa } = await group([]);
    const cy = await w.signIn("cy", { admin: true });
    const founder = await w.signIn("founder");
    await propose(w, cy, "ana");
    await propose(w, cy, "bo");
    // cy has endorsed both by proposing them; the founder's endorsement is the last one for ana (member-roster R87: hers alone issues it, R90: she is owed it)
    await founder.act("reauth", { body: { password: founder.password } });   // changing administrators asks her password again
    await rosa.act("reauth", { body: { password: rosa.password } });
    // The page's answers to adminendorse are the world's own, kept as they pass (the invitation the last endorsement makes is in them).
    const kept = (as, answers) => { const door = w.boot(as).door; return { adminendorse: counted(async (req) => { const a = await door(req); answers.push(resultOf(a)); return a; }) }; };
    const answers = [];
    const p = await open(w, founder, at[where], kept(founder, answers));
    await settle();
    const buttonFor = (who) => {
      const row = main(p).querySelectorAll(".cs-row").find((r) => r.querySelector('button[data-act="adminendorse"]') && text(p, r).includes(who));
      return main(p).querySelectorAll('button[data-act="adminendorse"]').indexOf(row.querySelector('button[data-act="adminendorse"]'));
    };
    assert.ok(!text(p).includes("#invite="), "control: nothing is drawn before the act");
    await press(p, "adminendorse", { nth: buttonFor("ana"), reason: "I know her work" });
    const answer = answers.at(-1);
    assert.ok(answer.invite && answer.memberId === "ana", "the last endorsement makes the invitation");
    const link = "/#invite=" + encodeURIComponent(answer.invite);
    assert.equal(main(p).querySelectorAll("code").filter((c) => c.textContent.endsWith(link)).length, 1, "the link is drawn once");
    assert.ok(text(p).includes(word("screen.members.invite.noemail")), "with the sentence that the group's Civicsmith sends no email");
    assert.ok(text(p).includes(word("screen.members.invite.shown", { handle: "ana", expires: dmy(String(answer.expires).slice(0, 10)) })), "and who it is for and when it expires");
    // control: rosa's endorsement of bo answers with no invitation (bo still awaits the founder): her page draws no link
    const theirs = [];
    const q = await open(w, rosa, at[where], kept(rosa, theirs));
    await settle();
    await press(q, "adminendorse", { nth: main(q).querySelectorAll('button[data-act="adminendorse"]').indexOf(main(q).querySelectorAll(".cs-row").find((r) => r.querySelector('button[data-act="adminendorse"]') && text(q, r).includes("bo")).querySelector('button[data-act="adminendorse"]')), reason: "I know him too" });
    assert.equal(theirs.length, 1, "her endorsement was sent");
    assert.ok(!(theirs.at(-1) && theirs.at(-1).invite), "the answer carries no invitation");
    assert.equal(main(q).querySelectorAll("code").filter((c) => c.textContent.includes("#invite=")).length, 0, "control: an answer with no invite draws no link of its own");
    // The record answers a vote short of the last as a refusal (CONSENSUS_REQUIRED), not as an answer with no invite: the page keeps the earlier link until the next visit.
    const later = await open(w, founder, at[where]);
    await settle();
    assert.equal(main(later).querySelectorAll("code").filter((c) => c.textContent.includes("#invite=")).length, 0, "control: the link is not drawn on the next visit");
    assert.ok(!text(later).includes(word("screen.members.invite.noemail")));
  });

  test(`R75 (${where}): nobody agreed or awaited is "no one yet"; with no handle in fills the member's id is drawn`, timeout, async () => {
    const { w, rosa } = await group([]);
    await propose(w, await w.signIn("cy", { admin: true }), "ana");
    // No act of the record leaves a proposal with nobody agreed or awaited, so the real item is changed to that state: the one place the queue's answer is not the store's own.
    const real = await itemOf(rosa, "endorsement-owed");
    const none = { ...real, fills: {}, basis: { have: [], awaiting: [] } };
    const p = await open(w, rosa, at[where], { queue: ok({ items: [none], item_count: 1 }) });
    await settle();
    const nobody = word("queue.owed.nobody");
    assert.ok(text(p).includes(word("queue.endorsement-owed.summary", { who: "ana", have: nobody, awaiting: nobody })));
  });

  test(`R75 (${where}): an owner vote names the person, the project and who has agreed and sends projectowneradd; a vote to remove an owner is the project's own, so it is worded and opened, not drawn as an act`, timeout, async () => {
    const { w, rosa, ben, cy, mai } = await group(["ben", "cy", "mai"]);
    const project = await w.recipes.project(rosa, "Pothole repairs");
    for (const member of [mai, ben, cy]) {
      await rosa.act("projectinvite", { query: { projectId: project, handle: member.handle } });
      await member.act("projectjoin", { query: { projectId: project } });
    }
    await rosa.act("projectowneradd", { query: { projectId: project, handle: "mai" } });           // the sole owner acts alone
    await rosa.act("projectowneradd", { query: { projectId: project, handle: "cy" } }).catch(() => {});
    await raw(w, rosa, "projectowneradd", {}, { projectId: project, handle: "cy" });
    await mai.act("projectowneradd", { query: { projectId: project, handle: "cy" } });
    await raw(w, mai, "projectowneradd", {}, { projectId: project, handle: "ben" });                // mai proposes ben as an owner: rosa and cy are awaited
    await raw(w, mai, "projectownerremove", { reason: "She has moved on" }, { projectId: project, handle: "cy", reason: "She has moved on" });
    const add = await itemOf(rosa, "endorsement-owed", (i) => i.basis.change === "add");
    const remove = await itemOf(rosa, "endorsement-owed", (i) => i.basis.change === "remove");
    assert.ok(add && remove, "the record owes her both votes");
    const p = await open(w, rosa, at[where]);
    await settle();
    const names = await namesOf(rosa);
    const said = (item, key, who) => word(key, { who, project: "Pothole repairs", agreed: list(names, item.basis.agreed), awaiting: list(names, item.basis.awaiting) });
    assert.ok(text(p).includes(said(add, "queue.endorsement-owed.owner.summary.add", "ben")));
    assert.ok(text(p).includes(said(remove, "queue.endorsement-owed.owner.summary.remove", "cy")));
    assert.ok(text(p).includes(word("queue.endorsement-owed.owner.detail")));
    assert.ok(main(p).querySelector(`a.cs-ref[href="/app/project/${project}"]`), "the project is a reference");
    assert.deepEqual(ops(p).filter((o) => o.startsWith("projectowner")), ["projectowneradd"], "the removal is no act of this screen");
    await press(p, "projectowneradd", { reason: "She has done the work" });
    assert.deepEqual({ ...last(p, "projectowneradd").query, ...last(p, "projectowneradd").body, reason: undefined }, { op: "projectowneradd", projectId: project, handle: "ben", reason: undefined });
    assert.ok(main(p).querySelectorAll(`a[data-nav][href="/app/project/${project}"]`).some((a) => a.textContent === word(where === "home" ? "screen.home.open" : "screen.queue.open")), "the removal opens the project");
  });
}

test("R75: control: an item of another kind is drawn as before: no form, no routed sentence, its own words and its act", timeout, async () => {
  const { w, rosa, mai } = await group(["mai"]);
  const project = await w.recipes.project(rosa, "Pothole repairs");
  await rosa.act("projectinvite", { query: { projectId: project, handle: "mai" } });
  await mai.act("projectjoin", { query: { projectId: project } });
  await rosa.act("projectowneradd", { query: { projectId: project, handle: "mai" } });
  const orders = await w.recipes.hold(mai, "Work orders", "812 of 903 reports", project);
  await mai.act("checkrequest", { body: { target: orders.bundle, member: "rosa", note: "Check the first count" } });
  const other = await itemOf(rosa, "check-requested");
  for (const where of screens) {
    const p = await open(w, rosa, at[where]);
    await settle();
    assert.ok(text(p).includes(other.summary));
    assert.deepEqual(ops(p).filter((o) => ["taskdecide", "adminendorse", "projectowneradd", "expertiseconfirm"].includes(o)), []);
    assert.equal(main(p).querySelectorAll('fieldset[id$="-who"]').length, 0);
    assert.ok(!text(p).includes(word("screen.queue.routed.auth.item")));
  }
});
