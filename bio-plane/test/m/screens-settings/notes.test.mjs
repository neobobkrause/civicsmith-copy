/* Settings › Your notes at the module's interface (R6, R7, R8). Over the world (store-request): the notes are kept by the real acts
   (notewrite, noterevise, noteturn) and the expectations are read back from what the owner answers, never copied from a literal. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, ancestor, has, lacks, open, panelOf, rowOf, said, textOf } from "./kit.mjs";
import { team, assistantTeam, writingHelp, DRAFT_TEXT } from "./seed-account.mjs";
import { WORD_ROWS, hasWord } from "../../../src/setup-words/index.mjs";

const ops = (o) => [...new Set(acts(o.tree).map((b) => b.attrs["data-act"]))].sort();
/** dev keeps two notes (the first revised and turned into an observation), by the owner's acts; answers the observation's id. */
async function keep(dev) {
  const lead = await dev.act("lead", { body: { words: "The potholes on Seminary keep opening." } });   // an observation the member's own act made
  await dev.act("notewrite", { body: { text: "The potholes on Seminary keep opening." } });
  await dev.act("noterevise", { body: { note: 1, text: "The potholes on Seminary keep opening, again." } });
  await dev.act("noteturn", { body: { note: 1, into: "observation", made: lead.lead_id } });
  await dev.act("notewrite", { body: { text: "Ask the crew foreman on 60th what “closed” means to them." } });
  return lead.lead_id;
}

test("R6 reads the member's own notes; states who can see them (protected words); each note's acts in its panel", async () => {
  const { w, dev, teo } = await team();
  const observed = await keep(dev);
  const kept = (await dev.read("notes")).notes;
  assert.equal(kept.length, 2);
  const a = await open("notes", { world: w, as: dev });
  const no = a.p.requests.map((r) => r.op);
  assert.deepEqual(no.slice(no.indexOf("notes"), no.indexOf("notes") + 2), ["notes", "courtnotice"], "the screen's own reads, after the frame's");
  has(a, "screen.notes.private");
  // the words that say who can see the notes are protected words of the list (setup-words R1)
  for (const r of ["screen.notes.private", "screen.notes.protects", "screen.notes.court", "screen.notes.draft.label"])
    assert.equal(WORD_ROWS.find((x) => x[0] === r)[4], true, `${r} is protected`);
  for (const n of kept) {
    assert.ok(textOf(rowOf(a.tree, String(n.note), n.text)).includes(n.text));
    const panel = panelOf(a.tree, String(n.note));
    assert.deepEqual([...new Set(acts(panel).map((b) => b.attrs["data-act"]))].sort(), ["notedelete", "noterevise", "noteturn"]);
  }
  const turned = kept.flatMap((n) => n.turned).find((t) => t.into === "observation");
  assert.equal(turned.id, observed);
  has(a, "screen.notes.turned.observation", { id: turned.id });
  assert.deepEqual(ops(a), ["notedelete", "noterevise", "noteturn", "notewrite"], "no writing help while the assistant is not reachable");
  // a member who keeps none: told nothing (R28)
  const empty = await open("notes", { world: w, as: await w.signIn("ana") });
  lacks(empty, "screen.notes.empty");
  // a member without `contribute` is offered no act on notes (op-declarations NEEDS)
  const r = await open("notes", { world: w, as: teo });
  assert.deepEqual(ops(r), []);
});

test("R6 notewrite, noterevise and notedelete send their owner's arguments (hypotheses R11–R13)", async () => {
  const { w, dev } = await team();
  await keep(dev);
  const a = await open("notes", { world: w, as: dev });
  assert.deepEqual((await a.press("notewrite", { values: { "mn-new": " Ask the clerk. " } })).sent[0].body, { text: "Ask the clerk." });
  assert.equal(a.p.requests.at(-1).op, "notes", "R8: the notes read again");
  assert.ok((await dev.read("notes")).notes.some((n) => n.text === "Ask the clerk."), "kept by the owner");
  assert.deepEqual((await a.press("notewrite", { values: { "mn-new": "" } })).sent, []);
  assert.deepEqual((await a.press("noterevise", { data: { note: "2" }, values: { "mn-r2": "Revised." } })).sent[0].body, { note: 2, text: "Revised." });
  assert.equal((await dev.read("notes")).notes.find((n) => n.note === 2).text, "Revised.", "revised by the owner");
  assert.deepEqual((await a.press("notedelete", { data: { note: "1" } })).sent[0].body, { note: 1 });
  assert.ok(!(await dev.read("notes")).notes.some((n) => n.note === 1), "deleted by the owner");
  const rev = acts(a.tree).find((b) => b.attrs["data-act"] === "noterevise" && b.attrs["data-note"] === "2");
  assert.ok(ancestor(rev, (e) => /cs-panel/.test(e.attrs.class || "")));
});

test("R6 noteturn, as the owner's shape names: into a hunch {inquiry, kind, about}, or into an observation or question already made", async () => {
  const { w, dev } = await team();
  await keep(dev);
  const seen = (await dev.act("lead", { body: { words: "The crew foreman said the street was closed." } })).lead_id;   // an observation her own act made
  const a = await open("notes", { world: w, as: dev });
  const body = async (values) => { const r = await a.press("noteturn", { data: { note: "2" }, values }); return r.sent.length ? r.sent[0].body : null; };
  assert.deepEqual(await body({ "mn-observation2": true, "mn-made2": seen }), { note: 2, into: "observation", made: seen });
  assert.ok((await dev.read("notes")).notes.find((n) => n.note === 2).turned.some((t) => t.into === "observation" && t.id === seen), "turned by the owner");
  assert.deepEqual(await body({ "mn-question2": true, "mn-made2": "STQ-0003" }), { note: 2, into: "question", made: "STQ-0003" });
  assert.deepEqual(await body({ "mn-hunch2": true, "mn-inq2": "INQ-1", "mn-kind2": "cause", "mn-about2": "EV-1 EV-2" }), { note: 2, into: "hunch", hunch: { inquiry: "INQ-1", kind: "cause", about: { from: "EV-1", to: "EV-2" } } });
  assert.deepEqual(await body({ "mn-hunch2": true, "mn-inq2": "INQ-1", "mn-kind2": "flow", "mn-about2": "EV-1, EV-2, EV-3" }), { note: 2, into: "hunch", hunch: { inquiry: "INQ-1", kind: "flow", about: ["EV-1", "EV-2", "EV-3"] } });
  assert.equal(await body({ "mn-hunch2": true, "mn-inq2": "INQ-1", "mn-kind2": "relation", "mn-about2": "EV-1" }), null);
  assert.equal(a.refused.key, "screen.notes.turn.pair");
  assert.equal(await body({ "mn-observation2": true, "mn-made2": "" }), null);
  assert.equal(a.refused.key, "screen.notes.turn.nomade");
});

test("R6 writinghelp under the note's field only while the assistant is reachable; its draft in the field labeled \"Draft · the assistant's, asked by <handle>\", kept only by the member's own act", async () => {
  const { w, dev } = await assistantTeam();
  await keep(dev);
  const a = await open("notes", { world: w, as: dev, table: writingHelp("dev") });
  const help = acts(a.tree).filter((b) => b.attrs["data-act"] === "writinghelp");
  assert.deepEqual(help.map((b) => b.attrs["data-field"]).sort(), ["new", "note:1", "note:2"], "one under each note's field");
  const r = await a.press("writinghelp", { data: { field: "new", id: "mn-new" }, values: { "mn-new": "potholes keep opening" } });
  assert.deepEqual(r.sent.map((x) => [x.op, x.body]), [["writinghelp", { op: "notewrite", field: "text", told: "potholes keep opening" }]], "nothing is written: no notewrite");
  assert.equal((await dev.read("notes")).notes.length, 2, "the owner holds no new note");
  const field = all(a.tree, (e) => e.attrs.id === "mn-new")[0];
  assert.equal(textOf(field), DRAFT_TEXT);
  has(a, "screen.notes.draft.label", { handle: "dev" });
  lacks(a, "ai.label.untested");
  const kept = await a.press("notewrite", { values: { "mn-new": DRAFT_TEXT } });
  assert.deepEqual(kept.sent[0].body, { text: DRAFT_TEXT });
  assert.ok((await dev.read("notes")).notes.some((n) => n.text === DRAFT_TEXT), "kept by the member's own act");
  lacks(a, "screen.notes.draft.label", { handle: "dev" });
  // on a note being revised, the help names noterevise
  const b = await open("notes", { world: w, as: dev, table: writingHelp("dev") });
  assert.deepEqual((await b.press("writinghelp", { data: { field: "note:2", id: "mn-r2" }, values: { "mn-r2": "ask foreman" } })).sent[0].body, { op: "noterevise", field: "text", told: "ask foreman" });
  assert.equal(textOf(all(b.tree, (e) => e.attrs.id === "mn-r2")[0]), DRAFT_TEXT);
  // the assistant not reachable (no team key): no help is offered
  const bare = await team();
  await keep(bare.dev);
  const off = await open("notes", { world: bare.w, as: bare.dev });
  assert.ok(!ops(off).includes("writinghelp"), "absent while not reachable");
});

test("R11 a writinghelp draft whose answer carries untested is drawn with ai.label.untested beside its Draft label; one without it carries none", async () => {
  const { w, dev } = await assistantTeam();
  await keep(dev);
  const a = await open("notes", { world: w, as: dev, table: writingHelp("dev", { text: "A draft.", untested: "untested" }) });
  await a.press("writinghelp", { data: { field: "new", id: "mn-new" }, values: { "mn-new": "x" } });
  has(a, "ai.label.untested");
  // beside the draft's label: the field draws its Draft label (cs.field's `draft`), the untested mark follows it at once
  const field = ancestor(all(a.tree, (e) => e.tag === "textarea" && e.attrs.id === "mn-new")[0], (e) => /\bcs-field\b/.test(e.attrs.class || ""));
  const dl = all(field, (e) => /cs-draftlabel/.test(e.attrs.class || ""))[0];
  assert.ok(dl && textOf(dl).includes(said("screen.notes.draft.label", { handle: "dev" })), "the Draft label");
  const sib = field.parent.children.filter((c) => c.tag);
  const mark = sib[sib.indexOf(field) + 1];
  assert.ok(mark && /mk-tag/.test(mark.attrs.class || "") && textOf(mark) === said("ai.label.untested"), "beside the Draft label");
  // on a note being revised too
  await a.press("writinghelp", { data: { field: "note:2", id: "mn-r2" }, values: { "mn-r2": "y" } });
  has(a, "ai.label.untested");
  // control: a draft without untested carries no label
  const b = await open("notes", { world: w, as: dev, table: writingHelp("dev") });
  await b.press("writinghelp", { data: { field: "new", id: "mn-new" }, values: { "mn-new": "x" } });
  has(b, "screen.notes.draft.label", { handle: "dev" });
  lacks(b, "ai.label.untested");
});

test("R7 the court sentence, in membership R108's words, once: the first time this member keeps a note while the group tells members", async () => {
  assert.ok(hasWord("screen.notes.court"));
  const { w, founder, dev } = await team();
  await founder.act("courtnoticeset", { body: { choice: "tell" } });
  assert.equal((await dev.read("courtnotice")).choice, "tell");
  assert.equal((await dev.read("notes")).notes.length, 0);
  const a = await open("notes", { world: w, as: dev });
  lacks(a, "screen.notes.court");
  await a.press("notewrite", { values: { "mn-new": "my first note" } });
  has(a, "screen.notes.court");
  // shown once: not on the next note
  await a.press("notewrite", { values: { "mn-new": "my second" } });
  lacks(a, "screen.notes.court");
  // the owner's own signal is followed too (hypotheses R11's `courtStatement`): a member who kept a note before the group told members
  const ana = await w.signIn("ana");
  await founder.act("courtnoticeset", { body: { choice: "dont" } });
  await ana.act("notewrite", { body: { text: "kept while the group did not tell" } });
  await founder.act("courtnoticeset", { body: { choice: "tell" } });
  const s = await open("notes", { world: w, as: ana });
  assert.equal((await ana.read("notes")).notes.length, 1, "she keeps a note already, so the screen alone would not tell");
  await s.press("notewrite", { values: { "mn-new": "x" } });
  has(s, "screen.notes.court");
  // controls: the group does not tell members, or the member already keeps notes (and was told)
  const dont = await w.signIn("dora");
  await founder.act("courtnoticeset", { body: { choice: "dont" } });
  const o1 = await open("notes", { world: w, as: dont });
  await o1.press("notewrite", { values: { "mn-new": "x" } });
  lacks(o1, "screen.notes.court");
  const o2 = await open("notes", { world: w, as: dev });
  await o2.press("notewrite", { values: { "mn-new": "x" } });
  lacks(o2, "screen.notes.court");
  // no choice made by the group: nothing is told (a team of its own, where no administrator has chosen)
  const fresh = await team();
  assert.equal((await fresh.dev.read("courtnotice")).choice, null);
  const o3 = await open("notes", { world: fresh.w, as: fresh.dev });
  await o3.press("notewrite", { values: { "mn-new": "x" } });
  lacks(o3, "screen.notes.court");
});
