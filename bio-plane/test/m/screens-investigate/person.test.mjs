/* screens-investigate R1: a person the record follows, on interface-shell's served page over `store-request`'s world (K5148, K5054): the real store behind the
   page's door and a real sign-in. Each state a test draws is made by the members' own acts (`entitycreate`, `recordline`, `recordpersonfact`, `identityclaim`,
   `entityalias`, `relationdeclare`, ...); the values a test asserts are read back from the world's own answers. Scripted: a fault the real code cannot cause, and the
   one record the live copy holds that this build does not make (`rewrite`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inWorld, openAs, settled, rewrite } from "./world.mjs";
import { refusedIn } from "../interface-shell/harness.mjs";
import { main, actsIn, button, fill, press, word, drew, dayOf } from "./fixtures.mjs";

const REASON = "The minutes say so.";
const LATER = "2030-12-31";
const FIELDS = ["names", "identifiers", "posts", "life"];

/* ---- the member's own acts ---- */
const entity = async (as, kind, label, note = "Named in the minutes.") => (await as.act("entitycreate", { body: { kind, label, note } })).entity_id;
const post = (as, from, to, sha, o = {}) => as.act("recordline", { body: { kind: "holds", from, to, capacity: "employee", basis: { captureSha: sha, extent: { kind: "pdf-page", page: 0 } },
  valid: { from: "2022-03-01", to: LATER, precision: "day", zone: "UTC" }, ...o } });
const fact = (as, person, sha, o = {}) => as.act("recordpersonfact", { body: { person, kind: "locality", value: "Oakview district", valid: { from: "2022-03-01", to: LATER },
  citation: { captureSha: sha, extent: { kind: "pdf-page", page: 2 } }, ...o } });
const claim = (as, a, b, o = {}) => as.act("identityclaim", { body: { a, b, kind: "same_as", basis: "testimony", note: "I met both at the same meeting", ...o } });
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** A held document whose reading names `names` (a `.pdf` name and type where its reading is a PDF's and its passages are `pdf-page` extents, which `content` R62
 *  refuses on a text document) (a reading the document's own promotion keeps, `extraction` R20), captured by the member's own upload. */
async function holdNamed(world, me, name, text, names) {
  const up = await world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name })}`, init: { method: "POST", headers: { "content-type": "application/pdf" }, body: new TextEncoder().encode("%PDF-1.4\n" + text) } }, me);
  const doc = up.json.result.document;
  const now = new Date(world.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const id = (await me.read("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } })).id + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sha = doc.capture.sha256;
  const front = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(name), "current_state: collected", "prior_state: null",
    "created: " + now, "last_updated: " + now, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0",
    "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting", "source_status: unchanged", "content_hash: sha256:" + sha,
    "source:", "  locator: " + JSON.stringify(doc.locator || "upload"), "  authority: member-entered", "  retrieved: " + now, "monitoring:", "  enabled: false", "  frequency: none",
    "---", "", "## Summary", "", name, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const reading = { content_type: "generic", reader_version: 1, found: true, at: now, facts: {}, page_count: 3, text_container: "pdf",
    text_source: [{ step: "layer", tier: 1, container: "pdf", extent: { kind: "pages", pages: [0, 1, 2] }, cap: null, measured_by: "unmeasured: a text layer is itself an unverified transcription", calibration: null }],
    entities: names.map((n) => ({ ref: n, kind: "person", key: null, label: n, source: { kind: "pdf-page", page: 2, ref: "p3" } })) };
  const units = [0, 1, 2].map((page) => ({ extent: { kind: "pdf-page", page }, reference: "p" + (page + 1), text: page === 2 ? text : `${text} (page ${page + 1})`, truncated: false }));
  const prov = JSON.stringify({ documents: [{ ...doc, reading, text_units: units }] }, null, 1);
  const dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: sha }] });
  const len = (s) => new TextEncoder().encode(s).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: sha256(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: sha256(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: sha256(dataset) }, { path: doc.file, blobSha: sha, sha256: sha, bytes: doc.capture.bytes }];
  const register = [{ sha256: sha, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }];
  const made = await me.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + sha256(id).slice(0, 8),
    meta: { object_type: "information", title: name, current_state: "collected", created: now, last_updated: now }, files, register } });
  return { sha, bundle: made.bundleId || id };
}

/** A world with the team's profile active, a department, L. Chen (the person) and a second record of the same name, and two held documents. */
async function scene() {
  const { world, me } = await inWorld();
  await world.recipes.profiles(me, ["oakland-alameda"]);
  const org = await entity(me, "body", "Public Works Department", "A city department");
  const chen = await entity(me, "person", "L. Chen", "Director of the department");
  const twin = await entity(me, "person", "L. Chen", "A second record under the same name");
  const lease = await holdNamed(world, me, "Lease amendment 1.pdf", "Lin Chen, Director of Public Works. Appointed in March 2022.", []);
  const rent = await holdNamed(world, me, "Rent schedule.pdf", "Monthly rent is due on the first.", []);
  return { world, me, org, chen, twin, lease, rent, member: (handle, o = {}) => world.signIn(handle, { admin: false, ...o }) };
}

const opts = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => [o.getAttribute("value"), o.textContent]);
const secOf = (p, key) => main(p).querySelectorAll("section").find((x) => x.querySelector("h2").textContent === word(key));
const personAt = (p) => p.byOp("person")[0].query.at;
const heldRows = async (as) => (await as.read("heldcaptures", { query: { limit: "200", state: "held_and_vouched", fields: "picker" } })).held;
const heldTitles = async (as) => (await heldRows(as)).map((h) => [h.capture.sha256, h.title]);
/* the document choice's text: the title and the day the record has held it since */
const pickerText = (h) => h.title + " · " + dayOf(h.collected_since.slice(0, 10));
const labelOf = async (as, id) => (await as.read("entity", { query: { id } })).entity.label;
const fieldWord = (c, state) => FIELDS.filter((k) => c.fields && c.fields[k] && c.fields[k].state === state).map((k) => word("screen.person.field." + k)).join(", ");

test("R1 reads person (as of the page's day, never \"now\") and samepersoncandidates; positions and facts each a reference to its source passage, with its grade", async () => {
  const { world, me, org, chen, lease } = await scene();
  await post(me, chen, org, lease.sha);
  await fact(me, chen, lease.sha);
  const p = await openAs(world, me, "/app/person/" + chen);
  const q = p.byOp("person")[0].query;
  assert.equal(q.id, chen);
  assert.match(q.at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(p.byOp("samepersoncandidates")[0].query.id, chen);
  const read = await me.read("person", { query: { id: chen, at: q.at } });
  const m = main(p);
  assert.equal(m.querySelector("h1").textContent, read.names[0].name);
  const secs = m.querySelectorAll("section");
  const pos = secs.find((s) => s.querySelector("h2").textContent === word("screen.person.positions"));
  const post0 = read.posts[0];
  assert.ok(pos.textContent.includes(await labelOf(me, post0.to) + " · " + post0.capacity + " · " + word("screen.person.span", { from: dayOf(post0.valid.from), to: dayOf(post0.valid.to) })));
  assert.equal(pos.querySelectorAll(".cs-grade").map((g) => [g.getAttribute("data-scale"), g.textContent.slice(-1)]).join(), ["connection", post0.grade.assertion].join());
  assert.ok(pos.querySelector(`[data-tip*="${word("screen.person.page", { page: String(post0.citation.extent.page + 1) })}"]`), "the position cites its passage");
  const facts = secs.find((s) => s.querySelector("h2").textContent === word("screen.person.facts"));
  const f0 = read.facts[0];
  assert.ok(facts.textContent.includes(word("screen.person.kind." + f0.kind) + " · " + f0.value));
  if (f0.grade) assert.equal(facts.querySelector(".cs-grade").textContent.slice(-1), f0.grade); else assert.ok(facts.querySelector(".cs-gap"), "a fact with no grade is drawn unrated");
  assert.ok(facts.querySelector(`[data-tip*="${word("screen.person.page", { page: String(f0.citation.extent.page + 1) })}"]`));
});

test("R1 same person? the cluster's other records linked as claimed (never merged) and the candidates, which are not claims", async () => {
  const { world, me, chen, twin, member } = await scene();
  const dev = await member("dev");
  await claim(dev, chen, twin);
  const read = await me.read("person", { query: { id: chen, at: "2026-10-25" } });
  assert.deepEqual(read.cluster.members.sort(), [chen, twin].sort(), "the claim links the two records");
  const cands = await me.read("samepersoncandidates", { query: { id: chen } });
  assert.ok(cands.count >= 1, "a record under the same name is a candidate");
  const p = await openAs(world, me, "/app/person/" + chen);
  const s = secOf(p, "screen.person.same");
  drew(s, "screen.person.same.claimed");
  drew(s, "screen.person.candidates");
});

test("R1 the acts as drawn for a member: explore, recordpersonfact, identityclaim, withdrawidentityclaim, followregister, and the entities acts (R32); no Open the person; personexpunge only for an administrator (interface-shell R47)", async () => {
  const { world, me, org, chen, twin, lease, member } = await scene();
  const mai = await member("mai");
  const dev = await member("dev");
  await post(me, chen, org, lease.sha);
  await fact(me, chen, lease.sha);
  await claim(dev, chen, twin);
  await mai.act("entityalias", { body: { entityId: chen, alias: "Lin Chen" } });
  await holdNamed(world, me, "Council packet.txt", "L. Chen spoke at the council meeting.", ["L. Chen"]);
  const p = await openAs(world, mai, "/app/person/" + chen);
  const acts = actsIn(main(p));
  assert.ok(!acts.includes("person"), "R32 (3): the person's own page has no Open the person");
  for (const op of ["explore", "followregister", "identityclaim", "recordpersonfact", "withdrawidentityclaim", "entityalias", "relationdeclare", "resolve", "resolvetestify", "connect"]) assert.ok(acts.includes(op), op);
  assert.ok(!acts.includes("personexpunge"), "a member who is no administrator is offered no personexpunge");
  const q = await openAs(world, me, "/app/person/" + chen);
  assert.ok(actsIn(main(q)).includes("personexpunge"));
});

test("R1 aliaswithdraw is offered for a name a member added (the store stamps the bare member id)", async () => {
  const { world, me, chen, member } = await scene();
  const mai = await member("mai");
  await mai.act("entityalias", { body: { entityId: chen, alias: "Lin Chen" } });
  const p = await openAs(world, me, "/app/person/" + chen);
  assert.ok(actsIn(main(p)).includes("aliaswithdraw"), "the alias a member added can be withdrawn");
});

test("R1 Explore connections opens explore from this person", async () => {
  const { world, me, org, chen, lease } = await scene();
  await post(me, chen, org, lease.sha);
  const p = await openAs(world, me, "/app/person/" + chen);
  await press(p, "explore");
  assert.equal(p.location.pathname, "/app/explore/" + chen);
});

test("R1 recordpersonfact: a fact read from the passage the member names, citing it (control: no passage sends nothing)", async () => {
  const { world, me, chen, lease } = await scene();
  const p = await openAs(world, me, "/app/person/" + chen);
  fill(p, { "person-fact-kind": "locality", "person-fact-value": "Lakeshore", "person-fact-from": "2024-01-01", "person-fact-doc": lease.sha });
  await press(p, "recordpersonfact", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("recordpersonfact")[0].body, { person: chen, kind: "locality", value: "Lakeshore", valid: { from: "2024-01-01", to: null },
    citation: { captureSha: lease.sha, extent: { kind: "document" } } });
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  const held = [...read.facts, ...read.undetermined].find((f) => f.value === "Lakeshore");
  assert.ok(held, "the fact is held on the person");
  assert.equal(held.citation.captureSha, lease.sha);
  assert.equal(p.byOp("person").length, 2, "after the act the screen reads the person again");
  /* control: with no document held there is no passage to cite (the first document held is the one drawn and chosen, C59) */
  const bare = await inWorld();
  const lone = await entity(bare.me, "person", "L. Chen");
  const q = await openAs(bare.world, bare.me, "/app/person/" + lone);
  fill(q, { "person-fact-value": "Lakeshore" });
  await press(q, "recordpersonfact", { reason: REASON });
  assert.equal(q.byOp("recordpersonfact").length, 0);
});

test("R1 identityclaim \"Say another record is this person\" with its basis and the member's words; withdrawidentityclaim with a reason (controls: a refusal drawn beside the act)", async () => {
  const { world, me, chen, twin, lease } = await scene();
  const p = await openAs(world, me, "/app/person/" + chen);
  fill(p, { "person-claim-other": twin, "person-claim-kind": "same_as", "person-claim-basis": "testimony", "person-claim-note": "I met both at the same meeting" });
  await press(p, "identityclaim", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("identityclaim")[0].body, { a: chen, b: twin, kind: "same_as", basis: "testimony", note: "I met both at the same meeting" });
  assert.equal(p.byOp("person").length, 2, "after the claim the screen reads the person again");
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  assert.equal(read.claims.length, 1);
  assert.deepEqual([read.claims[0].a, read.claims[0].b, read.claims[0].kind], [chen, twin, "same_as"]);
  assert.match(read.claims[0].grade, /^[A-D]$/);
  /* control: a basis the two records cannot earn (they share no name) is refused by the store, in its words, and the note is kept */
  const stranger = await entity(me, "person", "K. Osei");
  const q = await openAs(world, me, "/app/person/" + chen);
  fill(q, { "person-claim-other": stranger, "person-claim-basis": "name" });
  q.fire(q.doc.getElementById("person-claim-basis"), "change");
  fill(q, { "person-claim-doc-a": lease.sha, "person-claim-doc-b": lease.sha, "person-claim-note": "same name" });
  await press(q, "identityclaim", { reason: REASON });
  await settled(q);
  assert.equal(q.byOp("identityclaim")[0].body.evidence.a.captureSha, lease.sha);
  assert.ok(main(q).textContent.includes(word("refusal.IDENTITY_GRADE_UNEARNED")), "the refusal by its words");
  assert.equal(q.doc.getElementById("person-claim-note").value, "same name");
});

test("R1 followregister: a register the person appears in (control: an address that is not https sends nothing)", async () => {
  const { world, me, chen } = await scene();
  const p = await openAs(world, me, "/app/person/" + chen);
  fill(p, { "person-follow": "https://licences.example/engineers" });
  await press(p, "followregister", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("followregister")[0].body, { address: "https://licences.example/engineers" });
  const follows = await me.read("follows", { query: {} });
  assert.ok(follows.items.some((i) => i.subject && i.subject.address === "https://licences.example/engineers"), "the register is followed");
  const q = await openAs(world, me, "/app/person/" + chen);
  fill(q, { "person-follow": "licences.example" });
  await press(q, "followregister", { reason: REASON });
  assert.equal(q.byOp("followregister").length, 0);
});

test("R1 personexpunge: the consequence statement (op-grades R21) filled with the day and the member, the reason naming the law or order, the Irreversible weight, a dialog before anything is sent", async () => {
  const { world, me, chen, lease } = await scene();
  const gone = await fact(me, chen, lease.sha);
  const p = await openAs(world, me, "/app/person/" + chen);
  const d = main(p).querySelector('[data-consequence="personexpunge"]');
  const day = dayOf(new Date().toISOString().slice(0, 10));
  assert.equal(d.querySelector(".ends").textContent, word("screen.person.expunge.statement", { date: day, member: me.handle }), "the statement, filled with the day and the member");
  const b = button(p, "personexpunge");
  assert.ok(b.textContent.includes(word("weight.irreversible.name")));
  fill(p, { "person-x-fact": gone.fact_id, "person-x-ground": "court_order", "person-x-order": "Superior Court order of 2 October 2026, ¶3" });
  await p.click(b);
  assert.equal(p.byOp("personexpunge").length, 0, "nothing is sent before the dialog's confirm");
  await press(p, "personexpunge", { fields: ["Superior Court order of 2 October 2026, paragraph 3"] });
  await settled(p);
  assert.deepEqual(p.byOp("personexpunge")[0].body, { id: gone.fact_id, ground: "court_order", reason: "Superior Court order of 2 October 2026, paragraph 3", order: "Superior Court order of 2 October 2026, ¶3" });
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  assert.equal(read.removed.length, 1, "the store removed the fact and kept its tombstone");
  assert.ok(![...read.facts, ...read.undetermined].some((f) => f.fact_id === gone.fact_id));
});

test("R1 personexpunge at the phone width is read and not done (interface-shell R11, DEC-181)", async () => {
  const { world, me, chen, lease } = await scene();
  await fact(me, chen, lease.sha);
  const p = await openAs(world, me, "/app/person/" + chen, { phone: true });
  assert.ok(!button(p, "personexpunge"));
  assert.ok(main(p).querySelector('[data-phone-act="personexpunge"]'));
});

/* A project the member who made it keeps hidden, so that a claim made inside it is out of sight of another member (`people` R31). */
async function privateProject(world, as, title) {
  const now = new Date(world.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const text = "---\nobject_type: project\ntitle: " + JSON.stringify(title) + "\nobjective: " + JSON.stringify(title) + "\ncurrent_state: forming\ncreated: \"" + now
    + "\"\nlast_updated: \"" + now + "\"\n---\n\n## Session Log\n\n### Session " + now + " | Formation | interactive\nTrigger: test\nChanges: created.\n";
  const made = await as.act("promote", { body: { base: null, snapKey: now.replace(/[-:]/g, "") + "_" + sha256(title).slice(0, 8),
    meta: { object_type: "project", title, current_state: "forming", created: now, last_updated: now }, files: [{ path: "bundle.md", text }], register: [], visibility: "hidden" } });
  return made.bundleId;
}

test("R21 person draws each identity claim as person answers it (kind, grade, why, who and when); \"Withdraw this claim\" names that claim by its claim_id, with a reason; withdrawing one of two leaves the other drawn; control: a claim of a hidden project is not drawn", async () => {
  const { world, me, chen, twin, member } = await scene();
  const mai = await member("mai");
  const dev = await member("dev");
  const lead = await world.signIn("lead", { admin: false, capabilities: ["contribute", "create_projects"] });
  const stranger = await entity(me, "person", "K. Osei");
  await claim(dev, chen, twin);
  await claim(mai, chen, stranger, { kind: "unsure", note: "a similar name" });
  const hidden = await privateProject(world, lead, "Lead's own inquiry");
  await claim(lead, chen, await entity(me, "person", "R. Hidden"), { project: hidden, note: "seen only in the project" });
  const p = await openAs(world, mai, "/app/person/" + chen);
  const read = await mai.read("person", { query: { id: chen, at: personAt(p) } });
  assert.equal(read.claims.length, 2, "person does not answer the claim of a project the member cannot see");
  const m = main(p);
  const buttons = m.querySelectorAll('button[data-act="withdrawidentityclaim"]');
  assert.deepEqual(buttons.map((b) => b.getAttribute("data-claim")), read.claims.map((c) => c.claim_id));
  for (const c of read.claims) {
    drew(m, "label.identityclaimkinds." + c.kind);
    drew(m, "screen.person.claim.by", { by: c.by.replace(/^member:/, ""), date: dayOf(c.at.slice(0, 10)) });
  }
  assert.equal(m.querySelectorAll("*").filter((e) => e.getAttribute("id") === "person-claim-id").length, 0, "no field asks for a claim id");
  fill(p, { "person-wd-reason-0": "different middle initial" });
  await press(p, "withdrawidentityclaim", { el: buttons[0], reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("withdrawidentityclaim")[0].body, { claimId: read.claims[0].claim_id, reason: "different middle initial" });
  const after = main(p).querySelectorAll('button[data-act="withdrawidentityclaim"]');
  assert.deepEqual(after.map((b) => b.getAttribute("data-claim")), [read.claims[1].claim_id], "the other claim is still drawn");
  const left = await mai.read("person", { query: { id: chen, at: personAt(p) } });
  assert.deepEqual(left.claims.map((c) => c.claim_id), [read.claims[1].claim_id]);
  /* the hidden claim is the project's: it is not drawn for her, and is for the member who made it */
  const owner = await lead.read("person", { query: { id: chen, at: personAt(p) } });
  assert.ok(owner.claims.length > left.claims.length, "control: the member who made it sees it");
});

test("R32 (1) what the team says about them: other names (a roster name as data), ties a member declared, documents that may name them; each act sends the owner's arguments", async () => {
  const { world, me, org, chen, member } = await scene();
  const mai = await member("mai");
  const dev = await member("dev");
  await mai.act("entityalias", { body: { entityId: chen, alias: "Lin Chen" } });
  await dev.act("relationdeclare", { body: { fromEntity: chen, toEntity: org, relation: "member_of", justification: "sits on its board", citation: "minutes, page 2" } });
  const named = await holdNamed(world, me, "Council packet.txt", "L. Chen spoke at the council meeting.", ["L. Chen"]);
  const p = await openAs(world, me, "/app/person/" + chen);
  const ent = (await me.read("entity", { query: { id: chen } })).entity;
  const rel = ent.relations[0];
  const s = secOf(p, "entity.says.title");
  assert.ok(s, "the section is headed entity.says.title");
  drew(s, "entity.alias.roster");
  drew(s, "entity.relation.declared", { who: dev.handle, date: dayOf(rel.at.slice(0, 10)), where: rel.citation });
  fill(p, { "person-alias": "Lin C." });
  await press(p, "entityalias", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("entityalias")[0].body, { entityId: chen, alias: "Lin C." });
  assert.ok((await me.read("entity", { query: { id: chen } })).entity.aliases.some((a) => a.alias === "Lin C." && !a.withdrawn), "the name is held");
  const other = await entity(me, "body", "Parks Department", "A city department");
  fill(p, { "person-rel-kind": "proxy_for", "person-rel-with": other, "person-rel-why": "acts in their name", "person-rel-cite": "letter, page 1" });
  await press(p, "relationdeclare", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("relationdeclare")[0].body, { fromEntity: chen, toEntity: other, relation: "proxy_for", justification: "acts in their name", citation: "letter, page 1" });
  assert.ok((await me.read("entity", { query: { id: chen } })).entity.relations.some((r) => r.to_entity === other && r.relation === "proxy_for"), "the tie is held");
  const doc = (await me.read("readingname", { query: { entity: chen } })).documents[0];
  assert.equal(doc.capture_sha, named.sha);
  drew(secOf(p, "entity.says.title"), "entity.naming.row", { page: String(doc.page), alias: doc.matched_alias });
  await press(p, "resolve", { reason: "the name matches" });
  await settled(p);
  assert.deepEqual(p.byOp("resolve")[0].body, { captureSha: named.sha, ref: doc.ref, reason: "the name matches" });
  const resolved = await me.read("resolutions", { query: { sha256: named.sha } });
  assert.ok(resolved.resolutions.some((r) => r.entity_id === chen && r.ref === doc.ref), "the store holds the resolution of the reference to this person");
  fill(p, { "person-naming-basis": "I was at the meeting" });
  await press(p, "resolvetestify", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("resolvetestify")[0].body, { captureSha: named.sha, ref: doc.ref, entityId: chen, basis: "I was at the meeting" });
  await press(p, "connect", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("connect")[0].body, { entityId: chen });
});

test("R32 (1) the name a member added is drawn with who and when and can be withdrawn with a reason", async () => {
  const { world, me, chen, member } = await scene();
  const mai = await member("mai");
  await mai.act("entityalias", { body: { entityId: chen, alias: "Lin Chen" } });
  const p = await openAs(world, me, "/app/person/" + chen);
  const alias = (await me.read("entity", { query: { id: chen } })).entity.aliases.find((a) => a.alias === "Lin Chen");
  drew(secOf(p, "entity.says.title"), "entity.alias.by", { who: mai.handle, date: dayOf(alias.at.slice(0, 10)) });
  await press(p, "aliaswithdraw", { reason: "a typo" });
  await settled(p);
  assert.deepEqual(p.byOp("aliaswithdraw")[0].body, { entityId: chen, alias: "Lin Chen", reason: "a typo" });
  assert.ok((await me.read("entity", { query: { id: chen } })).entity.aliases.find((a) => a.alias === "Lin Chen").withdrawn, "the name is kept, shown withdrawn");
});

test("R32 (1) control: an organization's page words it for an organization; writinghelp is offered only while the assistant is reachable", async () => {
  const { world, me, org } = await scene();
  const p = await openAs(world, me, "/app/person/" + org);
  assert.ok(secOf(p, "entity.says.title.org"));
  assert.ok(!secOf(p, "entity.says.title"));
  assert.ok(!button(p, "writinghelp"),  "no assistant, no help");
});

test("R32 (2) every fact recorded is listed: valid today, then those whose validity is not stated or settled (marked undetermined with the reason and the source), the withdrawn in a fold with who, when and why", async () => {
  const { world, me, chen, lease, rent } = await scene();
  await fact(me, chen, lease.sha);
  await fact(me, chen, lease.sha, { kind: "birth", value: "1971", valid: { from: null, to: null } });
  await fact(me, chen, rent.sha, { kind: "address", value: "9 Elm St", valid: { from: "2020-01-01", to: null }, citation: { captureSha: rent.sha, extent: { kind: "pdf-page", page: 1 } } });
  const p = await openAs(world, me, "/app/person/" + chen);
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  const titles = new Map(await heldTitles(me));
  assert.ok(read.undetermined.length >= 2, "the store marks the facts whose validity does not settle");
  const f = secOf(p, "screen.person.facts");
  for (const u of read.undetermined) {
    drew(f, "screen.person.facts.undetermined", { reason: word(u.undetermined.why.key, u.undetermined.why.vars), document: titles.get(u.citation.captureSha) });
    assert.ok(f.textContent.includes(u.value), "none dropped: " + u.value);
  }
  assert.ok(f.querySelectorAll(".cs-gap").length >= read.undetermined.length, "each marked undetermined");
});

test("R32 (2) a fact withdrawn is listed in the withdrawn fold, by the member who withdrew it, from the store's `withdrawn_facts` (people R44)", async () => {
  const { world, me, chen, lease } = await scene();
  await fact(me, chen, lease.sha);
  const gone = await fact(me, chen, lease.sha, { kind: "contact", value: "old@example.org", valid: { from: "2020-01-01", to: LATER } });
  const w = (await me.act("personfactwithdraw", { body: { factId: gone.fact_id, reason: "a typo" } })).withdrawn;
  const p = await openAs(world, me, "/app/person/" + chen);
  const f = secOf(p, "screen.person.facts");
  drew(f, "screen.person.facts.withdrawn", { n: "1" });
  drew(f, "screen.person.facts.withdrawn.by", { name: me.handle, date: dayOf(w.at.slice(0, 10)), reason: "a typo" });
  assert.ok(!f.textContent.includes(word("screen.person.facts.withdrawn.by", { name: "admin", date: dayOf(w.at.slice(0, 10)), reason: "a typo" })), "never admin");
});

test("R32 (3) a person with no connection draws person.graph.none in place of an empty graph; the other sections stand", async () => {
  const { world, me, chen } = await scene();
  const p = await openAs(world, me, "/app/person/" + chen);
  const c = secOf(p, "screen.person.connections");
  drew(c, "person.graph.none");
  assert.equal(c.querySelectorAll("svg").length, 0);
  assert.ok(secOf(p, "screen.person.facts"));
});

test("R34 the fact form chooses a document by title and sends its digest; with no document the choice's empty state is drawn and nothing is sent", async () => {
  const { world, me, chen } = await scene();
  const p = await openAs(world, me, "/app/person/" + chen);
  const held = await heldRows(me);
  assert.equal(held.length, 2);
  assert.deepEqual(opts(p, "person-fact-doc"), held.map((h) => [h.capture.sha256, pickerText(h)]));
  const bare = await inWorld();
  const lone = await entity(bare.me, "person", "L. Chen");
  const none = await openAs(bare.world, bare.me, "/app/person/" + lone);
  assert.ok(!none.doc.getElementById("person-fact-doc"));
  drew(secOf(none, "screen.person.facts"), "state.empty");
  fill(none, { "person-fact-value": "x" });
  await press(none, "recordpersonfact", { reason: REASON });
  assert.equal(none.byOp("recordpersonfact").length, 0);
  assert.equal(main(p).querySelectorAll("*").filter((e) => /sha|fingerprint|content id/i.test(e.getAttribute("id") || "")).length, 0, "no field asks for a fingerprint");
});

test("R38 Same person?: a standing claim row (grade, the basis in the row's words, who and when), both acts explained, the form's menu listing the candidates and its basis choice worded by label.claimbases.<id>", async () => {
  const { world, me, chen, twin, lease, member } = await scene();
  const dev = await member("dev");
  const mai = await member("mai");
  const stranger = await entity(me, "person", "K. Osei");
  const evidence = { a: { captureSha: lease.sha, extent: { kind: "document" } }, b: { captureSha: lease.sha, extent: { kind: "document" } } };
  await claim(dev, chen, twin, { basis: "name", evidence, note: "the same name on the same lease" });
  await claim(mai, chen, stranger, { kind: "unsure", note: "a similar name" });
  const p = await openAs(world, me, "/app/person/" + chen);
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  const s = secOf(p, "screen.person.same");
  assert.equal(read.claims.length, 2);
  for (const c of read.claims) { assert.ok(s.textContent.includes(c.why), "the claim's sentence: " + c.kind); assert.ok(s.textContent.includes(word("label.identityclaimkinds." + c.kind))); }
  for (const k of ["act.identityclaim.does", "act.withdrawidentityclaim.does"]) drew(s, k);
  const cands = (await me.read("samepersoncandidates", { query: { id: chen } })).candidates;
  assert.ok(cands.length >= 1);
  const labels = new Map((await me.read("peopledirectory", { query: { limit: "200" } })).rows.map((r) => [r.entity, r.name]));
  assert.deepEqual(opts(p, "person-claim-other"), cands.map((c) => [c.entity_id, word("screen.person.claim.candidate", { record: labels.get(c.entity_id), agrees: fieldWord(c, "agrees"), differs: fieldWord(c, "differs") })]));
  assert.deepEqual(opts(p, "person-claim-basis").map((o) => o[1]), ["identifier", "corroborated_name", "name", "testimony"].map((b) => word("label.claimbases." + b)));
  assert.deepEqual(opts(p, "person-claim-kind").map((o) => o[1]), ["same_as", "not_same_as", "unsure"].map((k) => word("screen.person.claim.kind." + k)));
  fill(p, { "person-claim-other": twin, "person-claim-note": "" });
  await press(p, "identityclaim", { reason: REASON });
  assert.equal(p.byOp("identityclaim").length, 0, "with the note missing nothing is sent");
  const fold = secOf(p, "screen.person.same");
  drew(fold, "screen.person.claim.empty.summary");
  drew(fold, "screen.person.claim.empty");
});

test("R38 with no candidate the menu lists the people the record follows, never an empty menu; a failed candidates read is drawn failed and the menu is not drawn empty; a withdrawn claim is not drawn", async () => {
  const { world, me, chen, twin, member } = await scene();
  const dev = await member("dev");
  /* no other record carries her name: the menu lists the people the record follows */
  const alone = await inWorld();
  const solo = await entity(alone.me, "person", "L. Chen");
  const body = await entity(alone.me, "body", "Public Works Department", "A city department");
  assert.equal((await alone.me.read("samepersoncandidates", { query: { id: solo } })).count, 0);
  const none = await openAs(alone.world, alone.me, "/app/person/" + solo);
  const followed = (await alone.me.read("peopledirectory", { query: { limit: "200" } })).rows.map((r) => r.entity).filter((x) => x !== solo);
  assert.deepEqual(opts(none, "person-claim-other").map((o) => o[0]), followed);
  assert.deepEqual(followed, [body]);
  /* a candidates read that fails (a fault the store does not make for a person it holds): drawn failed, no menu */
  const bad = await openAs(world, me, "/app/person/" + chen, { plane: { samepersoncandidates: refusedIn("UNREADABLE", "The candidates could not be read.") } });
  assert.ok(!bad.doc.getElementById("person-claim-other"));
  assert.ok(secOf(bad, "screen.person.same").querySelector('[data-state="failed"], .cs-gap'), "drawn failed");
  /* a withdrawn claim is not drawn */
  const made = await claim(dev, chen, twin);
  await me.act("withdrawidentityclaim", { body: { claimId: made.claim_id, reason: "a mistake" } });
  const wd = await openAs(world, me, "/app/person/" + chen);
  assert.equal(main(wd).querySelectorAll('button[data-act="withdrawidentityclaim"]').length, 0);
});

test("R38 the withdraw fold asks its reason before it sends; a basis other than testimony chooses a document for each record", async () => {
  const { world, me, chen, twin, member } = await scene();
  const dev = await member("dev");
  await claim(dev, chen, twin);
  const p = await openAs(world, me, "/app/person/" + chen);
  await press(p, "withdrawidentityclaim", { el: button(p, "withdrawidentityclaim") });
  assert.equal(p.byOp("withdrawidentityclaim").length, 0, "no reason, nothing sent");
  assert.ok(!p.doc.getElementById("person-claim-doc-a"),  "control: testimony, the default, names no document");
  fill(p, { "person-claim-basis": "identifier" });
  p.fire(p.doc.getElementById("person-claim-basis"), "change");
  assert.equal(p.doc.getElementById("person-claim-doc-a") === null, false, "a basis other than testimony chooses a document for each record");
});

/* a world with a claim of each basis, made by the members' own acts: the same name, the same post, an identifier both hold, a member's word */
async function claimsOfEveryBasis() {
  const sc = await scene();
  const { me, org, chen, twin, lease, member } = sc;
  const dev = await member("dev");
  const cite = { captureSha: lease.sha, extent: { kind: "document" } };
  const a = { ...cite, date: "2022-01-01" }, b = { ...cite, date: "2024-01-01" };
  const wide = { valid: { from: "2020-01-01", to: LATER, precision: "day", zone: "UTC" } };
  const lineA = (await post(me, chen, org, lease.sha, { basis: cite, ...wide })).line_id, lineB = (await post(me, twin, org, lease.sha, { basis: cite, ...wide })).line_id;
  const shared = { scheme: "legistar_person_id", id: "1234" };
  /* the identifier is held by one record to the middle of 2023 and by the other from then on */
  await me.act("entityidentify", { body: { entityId: chen, ...shared, valid: { from: "2020-01-01", to: "2023-06-30", precision: "day", zone: "UTC" }, basis: "the council's roster" } });
  await me.act("entityidentify", { body: { entityId: twin, ...shared, valid: { from: "2023-07-01", to: LATER, precision: "day", zone: "UTC" }, basis: "the council's roster" } });
  await claim(dev, chen, twin, { basis: "name", evidence: { a, b }, note: "the same name" });
  await claim(dev, chen, twin, { basis: "corroborated_name", evidence: { a, b, lines: { a: lineA, b: lineB } }, note: "the same post" });
  await claim(dev, chen, twin, { basis: "identifier", evidence: { a, b, identifier: shared }, note: "the same identifier" });
  await claim(dev, chen, twin, { basis: "testimony", note: "I met both at the same meeting" });
  return sc;
}

test("R39 the form's basis words are label.claimbases.<id>, and screen.person.basis.<id> is not drawn beside a claim of each basis", async () => {
  const { world, me, chen } = await claimsOfEveryBasis();
  const p = await openAs(world, me, "/app/person/" + chen);
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  assert.equal(read.claims.length, 4, "a claim of each basis stands");
  const s = secOf(p, "screen.person.same");
  assert.deepEqual(opts(p, "person-claim-basis").map((o) => o[1]), ["identifier", "corroborated_name", "name", "testimony"].map((b) => word("label.claimbases." + b)));
  for (const b of ["identifier", "corroborated_name", "name", "testimony"]) assert.ok(!s.textContent.includes(word("screen.person.basis." + b)));
});

test("R39 a claim of each basis is drawn by screen.person.basis.row.<basis> (people R43 answers each claim's basis)", async () => {
  const { world, me, chen } = await claimsOfEveryBasis();
  const p = await openAs(world, me, "/app/person/" + chen);
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  const s = secOf(p, "screen.person.same");
  assert.deepEqual(read.claims.map((c) => c.basis).sort(), ["corroborated_name", "identifier", "name", "testimony"]);
  for (const c of read.claims) drew(s, "screen.person.same.because", { grade: c.grade, basis: word("screen.person.basis.row." + c.basis) });
});

test("R38 a standing claim row is drawn as its grade, the basis in the row's words (screen.person.same.because), who and when", async () => {
  const { world, me, chen, twin, lease, member } = await scene();
  const dev = await member("dev");
  const mai = await member("mai");
  const stranger = await entity(me, "person", "K. Osei");
  const evidence = { a: { captureSha: lease.sha, extent: { kind: "document" } }, b: { captureSha: lease.sha, extent: { kind: "document" } } };
  await claim(dev, chen, twin, { basis: "name", evidence, note: "the same name on the same lease" });
  await claim(mai, chen, stranger, { kind: "unsure", note: "a similar name" });
  const p = await openAs(world, me, "/app/person/" + chen);
  const read = await me.read("person", { query: { id: chen, at: personAt(p) } });
  const s = secOf(p, "screen.person.same");
  assert.ok(read.claims.every((c) => c.basis), "person gives each claim its basis");
  for (const c of read.claims) drew(s, "screen.person.same.because", { grade: c.grade, basis: word("screen.person.basis.row." + c.basis) });
});

/* R41, R44, R46, R48 (T51-120) */
const OTHER_NOTE = "The city's rule on tenant notices";

test("R41 an ordinance opens its own page: its note, kind and documents, \"Where the record cites it\" with each document's grade, its alias and a document that may name it; no person read, no facts, no career (control: a person's page is unchanged)", async () => {
  const { world, me, org, chen, lease, member } = await scene();
  const mai = await member("mai");
  const ordinance = await entity(me, "ordinance", "Tenant Notice Ordinance", OTHER_NOTE);
  await mai.act("entityalias", { body: { entityId: ordinance, alias: "Chapter 8.22" } });
  const one = await holdNamed(world, me, "Council packet.txt", "The Tenant Notice Ordinance was adopted.", ["Tenant Notice Ordinance"]);
  const two = await holdNamed(world, me, "Staff report.txt", "Chapter 8.22 requires notice.", ["Chapter 8.22"]);
  await holdNamed(world, me, "Minutes.txt", "Chapter 8.22 was read a second time.", ["Chapter 8.22"]);
  for (const [doc, ref] of [[one, "Tenant Notice Ordinance"], [two, "Chapter 8.22"]]) await me.act("resolve", { body: { captureSha: doc.sha, ref } });
  const concerns = await me.read("concerns", { query: { id: ordinance, limit: "200" } });
  assert.ok(concerns.count >= 1, "the store holds the documents that name it");
  const p = await openAs(world, me, "/app/person/" + ordinance);
  assert.equal(p.byOp("person").length, 0, "no person read is made for it");
  assert.equal(p.byOp("samepersoncandidates").length, 0);
  const m = main(p);
  assert.equal(m.querySelector("h1").textContent, "Tenant Notice Ordinance");
  drew(m, "find.row.kind.ordinance");
  drew(m, "screen.people.counts", { list: word("screen.people.count." + (concerns.count === 1 ? "document" : "documents"), { n: String(concerns.count) }) });
  const cited = secOf(p, "screen.person.cited");
  assert.equal(cited.querySelectorAll(".cs-grade").length, concerns.count, "each document's grade as one mark");
  const placed = concerns.documents.find((d) => d.extent && d.extent.page !== undefined);
  if (placed) assert.ok(cited.textContent.includes(word("screen.person.page", { page: String(placed.extent.page + 1) })), "the place, one-based (R46)");
  assert.ok(secOf(p, "entity.alias.title").textContent.includes("Chapter 8.22"));
  assert.ok(secOf(p, "entity.naming.title"), "a document that may name it");
  assert.ok(button(p, "explore"), "explore where a document names it");
  for (const k of ["screen.person.positions", "screen.person.facts", "screen.person.same"]) assert.ok(!secOf(p, k),  k);
  assert.ok(!button(p, "recordpersonfact"));
  assert.ok(button(p, "relationdeclare"), "the ties part, DEC-338");
  drew(secOf(p, "entity.relation.title"), "screen.person.ties.none.ordinance");
  await post(me, chen, org, lease.sha);
  const q = await openAs(world, me, "/app/person/" + chen);
  assert.ok(q.byOp("person").length >= 1 && secOf(q, "screen.person.positions") && secOf(q, "screen.person.facts"), "a person's page is unchanged");
});

test("R41 an office draws who has held it (the holders, their dates, source and grade) and not 'Where the record cites it'; a subject no document names draws the empty sentence and no explore", async () => {
  const { world, me, chen, twin, lease } = await scene();
  const office = await entity(me, "office", "City Clerk", OTHER_NOTE);
  await post(me, chen, office, lease.sha, { valid: { from: "2022-03-01", to: null, precision: "day", zone: "UTC" } });
  await post(me, twin, office, lease.sha, { valid: { from: "2015-01-01", to: "2021-12-31", precision: "day", zone: "UTC" } });
  const p = await openAs(world, me, "/app/person/" + office);
  assert.equal(p.byOp("linesof")[0].query.direction, "to");
  const held = (await me.read("linesof", { query: { entity: office, kinds: "holds", direction: "to", limit: "200" } })).lines;
  const h = secOf(p, "screen.person.holders");
  assert.equal(h.querySelectorAll(".cs-row").length, held.length);
  assert.equal(held.length, 2);
  const open = held.find((l) => !l.valid.to);
  assert.ok(h.textContent.includes(word("screen.person.since", { from: dayOf(open.valid.from) })));
  assert.ok(!secOf(p, "screen.person.cited"));
  assert.ok(!secOf(p, "entity.naming.title"),  "an office draws other names alone of the document part");
  drew(main(p), "screen.people.counts.none");
  assert.ok(!button(p, "explore"),  "no document names it: no explore");
});

test("R44 an undetermined fact's reason is drawn by its word with the owner's fills; a bare string draws no English of this module; R46 a page 0 is drawn as page 1", async () => {
  const { world, me, chen, lease } = await scene();
  const page0 = { captureSha: lease.sha, extent: { kind: "pdf-page", page: 0 } };
  await fact(me, chen, lease.sha, { kind: "birth", value: "1971", valid: { from: null, to: null }, citation: page0 });
  await fact(me, chen, lease.sha, { kind: "address", value: "9 Elm St", valid: { from: "2020-01-01", to: null }, citation: page0 });
  const read = await me.read("person", { query: { id: chen, at: "2026-10-25" } });
  assert.equal(read.undetermined.length, 2);
  const titles = new Map(await heldTitles(me));
  /* the reason as the store words it, by its key and fills */
  const p = await openAs(world, me, "/app/person/" + chen);
  const facts = secOf(p, "screen.person.facts");
  for (const u of read.undetermined) drew(facts, "screen.person.facts.undetermined", { reason: word(u.undetermined.why.key, u.undetermined.why.vars), document: titles.get(lease.sha) });
  assert.ok(facts.querySelector('[data-tip*="' + word("screen.person.page", { page: "1" }) + '"]'), "page 0 is drawn as page 1, not hidden");
  /* the live copy holds facts whose reason is a bare sentence of an older build (this build gives `{key, vars}`): the record is the store's answer with one reason so */
  const old = rewrite(world, me, (req, a) => {
    const j = JSON.parse(JSON.stringify(a.json));
    j.result.undetermined[1].undetermined.why = "an old sentence";
    return { ...a, json: j };
  });
  const q = await openAs(world, me, "/app/person/" + chen, { plane: { person: old } });
  const bare = secOf(q, "screen.person.facts");
  assert.ok(!bare.textContent.includes("an old sentence"), "a bare string is no English of ours");
  drew(bare, "state.undetermined", { reason: word("people.why.owner_settle_validity") });
});

test("R48 a person with no connections draws person.graph.none and no Explore connections; one connection draws the graph and the act", async () => {
  const { world, me, org, chen, twin, lease } = await scene();
  await post(me, chen, org, lease.sha);
  const one = await openAs(world, me, "/app/person/" + chen);
  assert.ok(button(one, "explore"), "control: one connection draws the act");
  assert.ok(secOf(one, "screen.person.connections").querySelectorAll("svg").length > 0);
  const none = await openAs(world, me, "/app/person/" + twin);
  drew(secOf(none, "screen.person.connections"), "person.graph.none");
  assert.ok(!button(none, "explore"));
});
