/* screens-investigate R2: exploring connections, on interface-shell's served page over a scripted plane. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ok, refusedIn } from "../interface-shell/harness.mjs";
import { main, actsIn, button, fill, press, word, hasWord, drew, notDrew, dayOf } from "./fixtures.mjs";
import { inWorld, openAs, settled, settledUntil, readHeld, rewrite } from "./world.mjs";

/** Two people the record follows and a tie one declared to the other (a `proxy_for`, a declared step with no source), by the members' own acts. */
async function declaredTie(me) {
  const a = (await me.act("entitycreate", { body: { kind: "person", label: "Ana Rivera", note: "Deputy clerk, named in the minutes." } })).entity_id;
  const b = (await me.act("entitycreate", { body: { kind: "person", label: "Ben Okafor", note: "Contractor, named in the minutes." } })).entity_id;
  const tie = await me.act("relationdeclare", { body: { fromEntity: a, toEntity: b, relation: "proxy_for", justification: "He signs for her on the minutes.", citation: "minutes, page 2" } });
  return { a, b, relation: tie.relation_id };
}

/** A held document read as three pages (a reading the document's own promotion keeps, `extraction` R20), by the member's own upload: the generated PDF of
 *  `recipes.pdf` has no decodable text, so its pages offer no words to choose. Answers `{sha, bundle}`. */
async function holdPaged(world, me, name, text) {
  const up = await world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name })}`, init: { method: "POST", headers: { "content-type": "text/plain" }, body: new TextEncoder().encode(text) } }, me);
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
    text_source: [{ step: "layer", tier: 1, container: "pdf", extent: { kind: "pages", pages: [0, 1, 2] }, cap: null, measured_by: "unmeasured: a text layer is itself an unverified transcription", calibration: null }], entities: [] };
  const units = [0, 1, 2].map((page) => ({ extent: { kind: "pdf-page", page }, reference: "p" + (page + 1), text: `${text} (page ${page + 1})`, truncated: false }));
  const prov = JSON.stringify({ documents: [{ ...doc, reading, text_units: units }] }, null, 1);
  const dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: sha }] });
  const sum = (s) => createHash("sha256").update(s).digest("hex"), len = (s) => new TextEncoder().encode(s).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: sum(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: sum(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: sum(dataset) }, { path: doc.file, blobSha: sha, sha256: sha, bytes: doc.capture.bytes }];
  const register = [{ sha256: sha, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }];
  const made = await me.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + sum(id).slice(0, 8),
    meta: { object_type: "information", title: name, current_state: "collected", created: now, last_updated: now }, files, register } });
  return { sha, bundle: made.bundleId || id };
}

const START = "2026-09-30";
const explorePath = (id) => "/app/explore/" + id;
/** The connection kinds the vocabulary puts in the groups `groups`, in its order: what ticking those groups must send. */
const kindsOf = async (me, groups) => {
  const v = (await me.read("affordances", {})).vocabularies.connection_kinds;
  return v.values.filter((k) => groups.includes(v.words[k].group));
};
/** The walk the record gives for a request the page sent. */
const walkOf = async (me, p) => me.act("explore", { body: p.byOp("explore").at(-1).body });
const weakest = (hops) => hops.map((h) => h.grade.assertion).sort().at(-1);

/** A person with an employment (a roster's rule, grade C), the department she works in being part of the city (a page of a held PDF, grade D), and `leads`
 *  people she is declared a proxy of (a declared step with no source): three kinds of chain, the longest's grade its weakest hop's. */
async function network(world, me, { leads = 1 } = {}) {
  await world.recipes.profiles(me, ["oakland-alameda"]);
  const entity = async (kind, label) => (await me.act("entitycreate", { body: { kind, label, note: "Named in the minutes." } })).entity_id;
  const chen = await entity("person", "L. Chen");
  const org = await entity("body", "Public Works Department");
  const city = await entity("body", "City of Oakland");
  const charter = await world.recipes.pdf(me, "Charter.pdf");
  await me.act("recordline", { body: { kind: "holds", from: chen, to: org, capacity: "employee", valid: { from: "2025-03-01", to: "2030-01-01" }, basis: { rule: "roster", source: { profile: "oakland-alameda", entry: "public-works" } }, reason: "The roster says so." } });
  await me.act("recordline", { body: { kind: "part_of", from: org, to: city, valid: { from: "2000-01-01", to: "2030-01-01" }, basis: { captureSha: charter.sha, extent: { kind: "pdf-page", page: 1 } }, reason: "The charter says so." } });
  const proxies = [];
  for (let i = 0; i < leads; i++) {
    const other = await entity("person", "R. Alvarez " + (i + 1));
    proxies.push({ other, relation: (await me.act("relationdeclare", { body: { fromEntity: chen, toEntity: other, relation: "proxy_for", justification: "She signs for him on the minutes.", citation: "minutes, page 2" } })).relation_id });
  }
  return { chen, org, city, charter, proxies };
}
/** The explore page at the person, walked as of a day. */
const walked = async (world, me, C, o = {}) => {
  const p = await openAs(world, me, explorePath(C.chen), o);
  fill(p, { "explore-at": START });
  await press(p, "explore");
  await settled(p);
  return p;
};
const chainsOf = (p) => main(p).querySelectorAll("div.mk-msg[data-chain]");
const leadsOf = (p) => chainsOf(p).filter((c) => c.querySelector('button[data-act="stepsource"]'));
const longest = (p) => chainsOf(p).find((c) => c.querySelectorAll("[data-hop]").length === 2);

/** A person the record follows and an organisation, for the screens that need only a centre and an end. */
async function pair(world, me) {
  const chen = (await me.act("entitycreate", { body: { kind: "person", label: "L. Chen", note: "Director of the department." } })).entity_id;
  const org = (await me.act("entitycreate", { body: { kind: "body", label: "Public Works Department", note: "The department." } })).entity_id;
  return { chen, org };
}

test("R24 R27 explore's Follow offers the design's six groups, the first three ticked; ticking Money sends exactly the money kinds; ticking Stated in a source sends exactly its kinds; control: Mentioned together sends no step_source kind, no checkbox per kind", async () => {
  const { world, me } = await inWorld();
  const { chen, org } = await pair(world, me);
  const at = explorePath(chen);
  const p = await openAs(world, me, at);
  const box = p.doc.getElementById("explore-groups");
  const boxes = box.querySelectorAll("input");
  assert.deepEqual(boxes.map((b) => b.parentElement.textContent.trim()), ["pos", "money", "part", "ment", "same", "step_source"].map((g) => word("connection.kind." + g + ".name")));
  assert.deepEqual(boxes.map((b) => b.checked), [true, true, true, false, false, false]);
  assert.ok(!p.doc.getElementById("explore-kinds"),  "no raw kind checkbox is drawn");
  assert.equal(p.root().querySelectorAll('input[type="checkbox"]').filter((i) => /explore-kinds/.test(i.getAttribute("name") || "")).length, 0);
  boxes[0].checked = false; boxes[2].checked = false;
  fill(p, { "explore-to": org, "explore-at": "2025-06-30" });
  await press(p, "explore");
  const money = await kindsOf(me, ["money"]);
  assert.ok(money.length > 0, "the vocabulary has money kinds");
  assert.deepEqual(p.byOp("explore")[0].body, { from: chen, to: org, at: { value: "2025-06-30", precision: "day", zone: "UTC" }, kinds: money }, "only Money ticked: exactly the money kinds");
  const q = await openAs(world, me, at);
  q.doc.getElementById("explore-groups").querySelectorAll("input").forEach((b, i) => { b.checked = i === 3 || i === 4; });
  fill(q, { "explore-at": "2025-06-30" });
  await press(q, "explore");
  const same = await kindsOf(me, ["ment", "same"]);
  assert.ok(same.includes("mentioned_together") && same.length > 1);
  assert.deepEqual(q.byOp("explore")[0].body.kinds, same, "each group sends its kinds by the vocabulary's group");
  assert.ok(!q.byOp("explore")[0].body.kinds.includes("step_source"), "Mentioned together sends no step_source kind");
  const r = await openAs(world, me, at);
  r.doc.getElementById("explore-groups").querySelectorAll("input").forEach((b, i) => { b.checked = i === 5; });
  fill(r, { "explore-at": "2025-06-30" });
  await press(r, "explore");
  assert.deepEqual(r.byOp("explore")[0].body.kinds, await kindsOf(me, ["step_source"]), "Stated in a source sends exactly its kinds (affordances R60's group)");
  assert.ok(r.byOp("explore")[0].body.kinds.includes("step_source"));
});

test("R27 a step_source step is drawn in its own class (e-step_source), named by connection.kind.step_source.name and explained by its means; control: a mentioned-together step is not", async () => {
  const { world, me } = await inWorld();
  const { a, relation } = await declaredTie(me);
  const memo = await world.recipes.hold(me, "Memo.txt", "Ben Okafor signs for Ana Rivera when she is away.\n\nThe clerk confirms it.");
  const mu = await readHeld(world, me, memo.sha);
  /* control: before any source is attached, the declared step is no step_source step */
  const q = await openAs(world, me, explorePath(a));
  assert.equal(main(q).querySelector(".mk-graph").querySelectorAll(".gwrap .e-step_source").length, 0);
  const done = await me.act("stepsource", { body: { relation, captureSha: memo.sha, extent: mu[1].extent, basis: "The memo says he signs for her." } });
  assert.notEqual(done.ok, false, "the source is attached by the member's own act");
  const p = await openAs(world, me, explorePath(a));
  const gr = main(p).querySelector(".mk-graph");
  assert.equal(gr.querySelectorAll(".gwrap .e-step_source").length, 1, "its own class");
  assert.equal(gr.querySelectorAll(".gwrap .e-ment").length, 0, "not drawn as mentioned together");
  assert.ok(gr.querySelector(".mk-glegend").textContent.includes(word("connection.kind.step_source.name")), "the legend names it");
  assert.ok(gr.querySelector(`.mk-glegend [data-tip="${word("connection.kind.step_source.means")}"]`), "and explains it");
  for (const k of ["connection.kind.step_source.name", "connection.kind.step_source.means"]) assert.ok(hasWord(k), k);
});

test("R29 explore opened with no centre draws its sentence by key and asks the plane for no graph, never \"no centre is named\"; control: with a centre, the graph", async () => {
  const { world, me } = await inWorld();
  const { chen } = await pair(world, me);
  const p = await openAs(world, me, "/app/explore");
  drew(main(p), "screen.explore.nocentre");
  assert.equal(p.byOp("exploregraph").length, 0, "no graph is read");
  assert.ok(!main(p).querySelector(".mk-graph"));
  assert.ok(hasWord("screen.explore.nocentre"));
  const q = await openAs(world, me, explorePath(chen));
  assert.ok(main(q).querySelector(".mk-graph"));
  notDrew(main(q), "screen.explore.nocentre");
});

test("R24 a walk with no group ticked sends nothing (control)", async () => {
  const { world, me } = await inWorld();
  const { chen } = await pair(world, me);
  const p = await openAs(world, me, explorePath(chen));
  p.doc.getElementById("explore-groups").querySelectorAll("input").forEach((b) => { b.checked = false; });
  fill(p, { "explore-at": "2025-06-30" });
  await press(p, "explore");
  assert.equal(p.byOp("explore").length, 0);
});

test("R2 the day is never \"now\": no day sends nothing (control)", async () => {
  const { world, me } = await inWorld();
  const { chen } = await pair(world, me);
  const p = await openAs(world, me, explorePath(chen));
  fill(p, { "explore-at": "" });
  await press(p, "explore");
  assert.equal(p.byOp("explore").length, 0);
  drew(main(p), "screen.explore.at.empty");
});

test("R2 each chain drawn hop by hop, each hop a reference and its cited source; the chain's grade its weakest hop's; a declared step a lead, never a finding; no score", async () => {
  const { world, me } = await inWorld();
  const C = await network(world, me);
  const p = await walked(world, me, C);
  const walk = await walkOf(me, p);
  assert.equal(chainsOf(p).length, walk.paths.length, "every chain the record walked is drawn");
  const a = longest(p);
  const path = walk.paths[Number(a.getAttribute("data-chain"))];
  assert.equal(path.hops.length, 2);
  assert.ok(new Set(path.hops.map((h) => h.grade.assertion)).size > 1, "the world: the hops are graded apart");
  assert.equal(a.querySelector(".cs-grade").textContent, word("mark.scale.connection.name") + weakest(path.hops), "the weakest hop's grade");
  const words = (await me.read("affordances", {})).vocabularies.connection_kinds.words;
  const hops = a.querySelectorAll("[data-hop]");
  assert.equal(hops.length, 2);
  assert.ok(hops[0].querySelector(`a.cs-ref[href="/app/person/${C.chen}"]`) || hops[0].querySelector(".cs-card"));
  assert.ok(hops[0].textContent.includes(words[path.hops[0].kind].word), "the hop's kind, as the vocabulary words it");
  assert.ok(hops[1].querySelector(`[data-tip*="${word("screen.explore.page", { page: String(path.hops[1].evidence[0].extent.page + 1) })}"]`), "the hop's cited passage");
  const lead = chainsOf(p).find((c) => c.querySelector('button[data-act="stepsource"]'));
  assert.ok(lead, "the declared step is a chain of its own");
  drew(lead, "screen.explore.lead");
  drew(lead.querySelector("[data-hop]"), "screen.explore.declared");
  notDrew(a, "screen.explore.lead");
  drew(main(p), "screen.explore.noscore");
  assert.doesNotMatch(main(p).textContent, /most connected|score:/i);
});

test("R2 a walk stopped at a bound says so, undetermined (control: a complete walk says nothing of it)", async () => {
  const { world, me } = await inWorld();
  const C = await network(world, me);
  const why = "the walk reached its limit of 5000 nodes";
  /* a walk that reaches its bound: this world's few records never do */
  const p = await walked(world, me, C, { plane: { explore: changing(world, me, "explore", (r) => ({ ...r, truncated: true, undetermined: true, why, complete: false })) } });
  assert.ok(main(p).textContent.includes(why), "the plane's own reason");
  const q = await walked(world, me, C);
  assert.ok(!main(q).textContent.includes(why));
  assert.ok(!main(q).textContent.includes(word("screen.explore.stopped", { depth: "8" })));
});

test("R2 explore's own refusal ({refused, why}) is drawn, never as no chains (control)", async () => {
  const { world, me } = await inWorld();
  const C = await network(world, me);
  const p = await walked(world, me, C, { plane: { explore: ok({ refused: "UNKNOWN_KIND", why: "no such kind of connection" }) } });
  assert.ok(main(p).textContent.includes("no such kind of connection"), "the plane's own words");
  notDrew(main(p), "screen.explore.nochains");
});

test("R2 explorepreset by its name; promote opens a question naming the chain", async () => {
  const { world, me } = await inWorld();
  const { a, b } = await declaredTie(me);
  const p = await openAs(world, me, "/app/explore/" + a);
  fill(p, { "explore-at": "2026-09-30", "explore-preset": "pathBetween", "explore-to": b });
  await press(p, "explorepreset");
  await settled(p);
  assert.equal(p.byOp("explorepreset").at(-1).body.preset, "pathBetween");
  assert.equal(p.byOp("explorepreset").at(-1).body.from, a);
  const [chain] = main(p).querySelectorAll("div.mk-msg[data-chain]");
  assert.ok(chain, "the real walk draws the chain");
  assert.deepEqual(actsIn(chain).filter((x) => ["exploreverify", "promote"].includes(x)).sort(), ["exploreverify", "promote"]);
  const walk = (await world.door({ url: "/api/?op=explorepreset", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p.byOp("explorepreset").at(-1).body) } }, me)).json.result;
  const steps = walk.paths[0].hops.map((h) => `${h.from} → ${h.kind} → ${h.to}`).join("; ");
  await press(p, "promote", { within: chain, reason: "The minutes say so." });
  await settled(p);
  const pr = p.byOp("promote")[0].body;
  assert.match(pr.bundleId, /^INQ-\d{4}-\d{4}-chain$/, "the id the record allocated");
  assert.ok(pr.files[0].text.includes(word("file.chain.question", { steps })), "the question, by its key");
  assert.ok(pr.files[0].text.includes(word("file.recheck.chain")) && pr.files[0].text.includes(word("file.recheck.chain.why")), "the recheck trigger, by its keys");
  assert.ok(pr.meta.title.startsWith(word("file.chain.title", { steps }).slice(0, 40)));
  assert.equal(p.location.pathname, "/app/question/" + pr.bundleId);
});

test("R2 exploreverify \"Check this chain\" sends the drawn path as chain (explore R23) and draws matches, lead and each hop's answer; control: a tampered hop is drawn \"does not match\"", async () => {
  const { world, me } = await inWorld();
  const C = await network(world, me);
  const p = await walked(world, me, C);
  const walk = await walkOf(me, p);
  const a = longest(p), lead = leadsOf(p)[0];
  const chain = (c) => walk.paths[Number(c.getAttribute("data-chain"))].hops;
  const [ai, li] = [a, lead].map((c) => c.getAttribute("data-chain"));
  /* the check's answer is drawn when it arrives, after the press settles: waited for, never raced */
  const verifiedIn = (q, i) => settledUntil(q, () => main(q).querySelector(`[data-verified="${i}"]`));
  await press(p, "exploreverify", { within: a });
  await verifiedIn(p, ai);
  const body = p.byOp("exploreverify")[0].body;
  assert.equal(body.chain.length, 2);
  assert.deepEqual(body.chain, chain(a).map((h) => ({ id: h.id, kind: h.kind, owner: h.owner })), "the drawn path, hop by hop");
  const shown = main(p).querySelector(`[data-verified="${ai}"]`);
  drew(shown, "screen.explore.verify.matches", { why: "" });
  assert.equal(shown.querySelectorAll("li").length, 2, "each hop's answer");
  drew(shown, "screen.explore.verify.cited", undefined, "a hop the record cites is not re-derived");
  /* a hop the record derives (a co-mention) is re-derived on the check: the world makes none here, so its answer is changed for one hop */
  const rederived = await openAs(world, me, explorePath(C.chen), { plane: { exploreverify: changing(world, me, "exploreverify", (r) => ({ ...r, hops: r.hops.map((h, i) => (i ? { id: h.id, matches: true } : h)) })) } });
  fill(rederived, { "explore-at": START });
  await press(rederived, "explore");
  await settled(rederived);
  /* each page's own index: chains of one length may be drawn in another order on another walk */
  const ra = longest(rederived);
  await press(rederived, "exploreverify", { within: ra });
  await verifiedIn(rederived, ra.getAttribute("data-chain"));
  drew(main(rederived).querySelector(`[data-verified="${ra.getAttribute("data-chain")}"]`), "screen.explore.verify.hop.holds");
  /* a tampered hop: a fault the check is made to answer */
  const t = await walked(world, me, C, { plane: { exploreverify: changing(world, me, "exploreverify", (r) => ({ ...r, matches: false, lead: false, hops: r.hops.map((h, i) => (i ? { id: h.id, matches: false } : h)) })) } });
  const ta = longest(t);
  await press(t, "exploreverify", { within: ta });
  await verifiedIn(t, ta.getAttribute("data-chain"));
  const bad = main(t).querySelector(`[data-verified="${ta.getAttribute("data-chain")}"]`);
  drew(bad, "screen.explore.verify.differs", { why: "" });
  drew(bad, "screen.explore.verify.hop.differs");
  /* the declared step is a lead, said so by the check itself */
  await press(p, "exploreverify", { within: leadsOf(p)[0] });
  await verifiedIn(p, li);
  drew(main(p).querySelector(`[data-verified="${li}"]`), "screen.explore.verify.lead");
  assert.deepEqual(p.byOp("exploreverify")[1].body.chain.map((h) => h.id), chain(lead).map((h) => h.id));
});

test("R17 Attach a source to a declared step sends stepsource with the hop's relation, the chosen passage and the member's words; the walk is read again and the hop is drawn evidenced; B14: the design draws no withdrawal of the attached source on explore, so none is drawn", async () => {
  const { world, me } = await inWorld();
  const { a } = await declaredTie(me);
  const memo = await world.recipes.hold(me, "Memo.txt", "Ben Okafor signs for Ana Rivera when she is away.\n\nThe clerk confirms it.");
  const mu = await readHeld(world, me, memo.sha);
  const p = await openAs(world, me, "/app/explore/" + a);
  fill(p, { "explore-groups-4": true, "explore-at": "2026-09-30" });
  await press(p, "explore");
  await settled(p);
  const lead = () => main(p).querySelectorAll("div.mk-msg[data-chain]").find((c) => c.querySelector('button[data-act="stepsource"]') || c.querySelector("[data-attached]"));
  drew(lead(), "screen.explore.lead");
  assert.ok(!button(p, "connectionassert"),  "connectionassert is not drawn for this act");
  const basis = "The memo says he signs for her.";
  /* R34 (K5148): the document is chosen by title and the passage by its words, never typed */
  fill(p, { "explore-assert-doc": memo.sha, "explore-assert-basis": basis });
  p.fire(p.doc.getElementById("explore-assert-doc"), "change");
  await settled(p);
  await p.click(main(p).querySelectorAll("[data-words]").find((e) => e.getAttribute("data-words").startsWith("explore-assert-passage-")).querySelectorAll('[data-shell="word"]')[1]);
  await press(p, "stepsource", { within: lead(), reason: basis });
  await settled(p);
  const sent = p.byOp("stepsource")[0].body;
  assert.deepEqual([sent.captureSha, sent.extent, sent.basis], [memo.sha, mu[1].extent, basis]);
  assert.match(sent.relation, /^REL-/, "the hop's own relation");
  const done = lead();
  drew(done, "screen.explore.evidenced", undefined, "evidenced, no longer a lead");
  notDrew(done, "screen.explore.declared");
  const walked = (await world.door({ url: "/api/?op=explore", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p.byOp("explore").at(-1).body) } }, me)).json.result;
  const step = walked.paths.flatMap((x) => x.hops).find((h) => h.kind === "step_source");
  assert.ok(step && step.backs === sent.relation, "the world: the walk holds the attached source for that relation");
  assert.equal(done.querySelector(".cs-grade").textContent, word("mark.scale.connection.name") + step.grade.assertion, "at the capture's grade");
  drew(done.querySelector("[data-attached]"), "screen.explore.attached", { by: me.handle, date: dayOf(step.at.slice(0, 10)) });
  assert.ok(button(p, "stepsourcewithdraw") === null, "B14: stepsourcewithdraw is not the registry's act on explore and the design draws no control for it (K3052)");
  assert.equal(main(p).textContent.includes(word("screen.explore.withdraw")), false);
});

test("R17 an attachment without its passage or without the member's words sends nothing (control); a refusal is drawn by its words", async () => {
  const { world, me } = await inWorld();
  const C = await network(world, me);
  const memo = await world.recipes.hold(me, "Memo.txt", "Ben Okafor signs for Ana Rivera when she is away.");
  /* the refusal is a fault the real act is not made to cause */
  const p = await walked(world, me, C, { plane: { stepsource: refusedIn("EXTENT_MALFORMED", "That passage cannot be read.") } });
  const lead = () => leadsOf(p)[0];
  await press(p, "stepsource", { within: lead() });
  assert.equal(p.byOp("stepsource").length, 0);
  fill(p, { "explore-assert-doc": memo.sha, "explore-assert-basis": "The minutes name him." });
  await press(p, "stepsource", { within: lead() });
  assert.equal(p.byOp("stepsource").length, 1);
  assert.ok(main(p).textContent.includes(word("refusal.EXTENT_MALFORMED")), "the refusal by its words");
});

/* R43, R46 (T51-120) */
/** The world's own answer to `op` with its result changed by `fn(result)`: a node the registry gives no name, a page counted from 0, a document count
 *  by identifier: records the live copy holds that this build does not make (K5044 (1)). */
const changing = (world, me, op, fn) => rewrite(world, me, (req, a) => (a && a.json && a.json.result && req.url.includes("op=" + op)
  ? { ...a, json: { ...a.json, result: fn(a.json.result) } } : a));
/** A person, an organisation she is employed by (a `holds` line from a held document), and a second person she is declared a proxy of. */
async function career(world, me) {
  await world.recipes.profiles(me, ["oakland-alameda"]);
  const chen = (await me.act("entitycreate", { body: { kind: "person", label: "L. Chen", note: "Director of the department." } })).entity_id;
  const alvarez = (await me.act("entitycreate", { body: { kind: "person", label: "R. Alvarez", note: "Named in the minutes." } })).entity_id;
  const org = (await me.act("entitycreate", { body: { kind: "body", label: "Public Works Department", note: "The department." } })).entity_id;
  const roster = await world.recipes.hold(me, "Roster.txt", "L. Chen is employed by the Public Works Department.");
  await me.act("recordline", { body: { kind: "holds", from: chen, to: org, capacity: "employee", valid: { from: "2025-03-01", to: null }, basis: { captureSha: roster.sha, extent: { kind: "document" } }, reason: "The roster says so." } });
  await me.act("relationdeclare", { body: { fromEntity: chen, toEntity: alvarez, relation: "proxy_for", justification: "She signs for him on the minutes.", citation: "minutes, page 2" } });
  return { chen, alvarez, org, roster };
}
const noLabel = (id) => (r) => ({ ...r, nodes: (r.nodes || []).map((n) => (n.id === id ? { ...n, label: "" } : n)) });
const documentsOf = (id, n) => (r) => ({ ...r, entities: (r.entities || []).map((e) => (e.entity_id === id ? { ...e, documents: n } : e)) });

test("R43 an unnamed node in the graph says how many documents name it only by an identifier (entityidonly, asked once for the unnamed nodes' ids); a count of 0 or a failed read draws no why line; a named node draws neither", async () => {
  const { world, me } = await inWorld();
  const C = await career(world, me);
  const plane = (idonly) => ({ exploregraph: changing(world, me, "exploregraph", noLabel(C.org)), entityidonly: idonly });
  const p = await openAs(world, me, "/app/explore/" + C.chen, { plane: plane(changing(world, me, "entityidonly", documentsOf(C.org, 3))) });
  const q = p.byOp("entityidonly");
  assert.equal(q.length, 1);
  assert.equal(q[0].query.ids, C.org, "the unnamed node's id alone");
  const why = main(p).querySelector(`[data-why="${C.org}"]`);
  drew(why, "screen.explore.unnamed.why", { n: "3" });
  assert.equal(main(p).querySelectorAll("[data-why]").length, 1, "the named nodes draw none");
  /* the store's own count for a subject no document names by an identifier is 0; a refusal is a fault the real code cannot be made to cause */
  for (const variant of [undefined, refusedIn("TOO_MANY_IDS", "x")]) {
    const z = await openAs(world, me, "/app/explore/" + C.chen, { plane: plane(variant ? variant : changing(world, me, "entityidonly", (r) => r)) });
    if (!variant) assert.equal((await me.read("entityidonly", { query: { ids: C.org } })).entities[0].documents, 0, "the world: no document names it so");
    assert.equal(main(z).querySelectorAll("[data-why]").length, 0, "no why line, never 0 documents");
    drew(main(z), "connection.node.unnamed", undefined, "the node is still drawn unnamed");
  }
});

test("R43 an explored hop is worded From {from} to {to} with a name of each end, an end with no name an unnamed item, with the vocabulary's kind word; R46 a hop's cited page counts from one, page 0 drawn", async () => {
  const { world, me } = await inWorld();
  const C = await career(world, me);
  /* the employment hop ends at an id the registry holds no name for, and cites a page counted from 0: records the live copy holds that this build does not make */
  const GONE = "ENT-2026-0777";
  const live = changing(world, me, "explore", (r) => ({ ...r, paths: (r.paths || []).map((x) => ({ ...x, hops: (x.hops || []).map((h) => (h.kind === "line:holds:employee" ? { ...h, to: GONE, evidence: [{ capture_sha: C.roster.sha, extent: { kind: "pdf-page", page: 0 } }] } : h)) })) }));
  const p = await openAs(world, me, "/app/explore/" + C.chen, { plane: { explore: live, entityidonly: changing(world, me, "entityidonly", documentsOf(GONE, 2)) } });
  fill(p, { "explore-groups-4": true, "explore-at": "2026-09-30" });
  await press(p, "explore");
  await settled(p);
  const words = (await me.read("affordances", {})).vocabularies.connection_kinds.words;
  const hop = main(p).querySelector('[data-hop^="LIN-"]');
  assert.ok(hop, "the employment hop is drawn");
  drew(hop, "screen.explore.hop", { from: "L. Chen", to: word("screen.explore.hop.unnamed") });
  assert.ok(hop.textContent.includes(words["line:holds:employee"].word), "the vocabulary's kind word");
  drew(hop, "screen.explore.unnamed.why", { n: "2" });
  assert.ok(hop.querySelector(`[data-tip*="${word("screen.explore.page", { page: "1" })}"]`), "page 0 is drawn as page 1");
  const named = main(p).querySelectorAll("[data-hop]").find((h) => h.textContent.includes(words.proxy_for.word));
  assert.ok(named, "the declared step is drawn");
  assert.equal(named.querySelectorAll("[data-unnamed]").length, 0, "control: a hop whose ends are named draws no unnamed line");
  drew(named, "screen.explore.hop", { from: "L. Chen", to: "R. Alvarez" });
});

test("R46 R34 the assertion form's passage is the words chosen: the extent sent is the record's own, a page counted from 0 (its page 1 drawn as one), and a document read as no page is cited whole", async () => {
  const { world, me } = await inWorld();
  /* two declared steps: the first source attached makes its step evidenced, and only a declared step offers the attachment */
  const C = await network(world, me, { leads: 2 });
  const doc = await holdPaged(world, me, "Minutes.txt", "The minutes name him");
  const units = (await me.read("reading", { query: { sha256: doc.sha } })).text_units;
  assert.ok(units.length > 1 && units[0].extent.page === 0, "the world: the reading's first page is counted from 0");
  const p = await walked(world, me, C);
  assert.equal(leadsOf(p).length, 2);
  const choose = async (basis) => {
    fill(p, { "explore-assert-doc": doc.sha, "explore-assert-basis": basis });
    p.fire(p.doc.getElementById("explore-assert-doc"), "change");
    await settled(p);
  };
  await choose("The minutes name him.");
  await press(p, "stepsource", { within: leadsOf(p)[0] });
  assert.deepEqual(p.byOp("stepsource")[0].body.extent, { kind: "document" }, "no words chosen: the whole document");
  await settled(p);
  assert.equal(leadsOf(p).length, 1, "the first step is evidenced by the source attached");
  await choose("The minutes name her.");
  await p.click(main(p).querySelectorAll("[data-words]").find((e) => e.getAttribute("data-words").startsWith("explore-assert-passage-")).querySelectorAll('[data-shell="word"]')[0]);
  await press(p, "stepsource", { within: leadsOf(p)[0] });
  assert.deepEqual(p.byOp("stepsource")[1].body.extent, units[0].extent, "the first page, as the record counts it");
  assert.deepEqual([p.byOp("stepsource")[1].body.extent.kind, p.byOp("stepsource")[1].body.extent.page], ["pdf-page", 0]);
});
