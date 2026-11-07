/* screens-action's T53 marks on `request`, `action`'s law list and `help-records`: R60 (the laws that govern the office's level), R61 (the layer
   where two layers share a name), R73 (an office added where no body is on file), R74 (the pointer to People as a sentence) and R76 (records
   help names the law). The profiles' view is `jurisdictions.combine`'s, the real provider's, for the active profile. */
import test from "node:test";
import assert from "node:assert/strict";
import { combine } from "../../../../jurisdictions/index.mjs";
import { actionWorld, openIn, entityOf, answerOf } from "./world-C.mjs";
import { SCREENS, open, main, text, press, last, ok, refused, beside, W, hasWord, DATA_PLANE, ACTION, ACTION_ID, PROFILES } from "./page.mjs";

const until = async (p, f, what) => { for (let i = 0; i < 40; i++) { const v = f(); if (v) return v; await p.settle(); } throw new Error("waited for " + what); };
const VIEW = () => combine(["oakland-alameda"]).view;
const REAL = () => ({ ...PROFILES, view: VIEW() });
const REQ = `/app/request/${ACTION_ID}`;
const boxes = (p) => p.doc.getElementById("req-law").querySelectorAll("label").map((l) => l.textContent.replace(/\s+/g, " ").trim());
const officeAction = (level, extra = {}) => ({ ...ACTION, governing_laws: { state: "undetermined" },
  counterparty: { state: "named", kind: "office", role: "City Clerk", body: "Office of the City Clerk", level, ...extra } });
/* a second city layer that also gives a "Sunshine Ordinance": the real Oakland layer's law and window, under another layer and place */
function twoCities() {
  const v = VIEW();
  const oak = v.records_laws.find((l) => l.layer === "us-ca-oakland");
  const rule = v.deadlines.find((d) => d.rule === oak.response);
  return { ...PROFILES, view: { ...v, layers: [...v.layers, { id: "us-ca-walkton", level: "city", place: "Walkton", within: "us-ca-alameda-county" }],
    records_laws: [...v.records_laws, { ...oak, layer: "us-ca-walkton", citation: "Walkton Mun. Code ch. 4" }],
    deadlines: [...v.deadlines, { ...rule, layer: "us-ca-walkton", amount: 5 }] } };
}

test("R60: a city office's request offers the state's Public Records Act and the city's Sunshine Ordinance, each with its own window; a federal office offers FOIA alone; control: no law is preselected and none ticked sends nothing", async () => {
  const p = await open(REQ, { ...DATA_PLANE, action: ok(officeAction("city")), profiles: ok(REAL()), actionlaws: ok({}) });
  const city = boxes(p);
  assert.equal(city.length, 2, "the two laws that govern a city office");
  assert.ok(city[0].includes("California Public Records Act") && city[0].includes(W("screen.request.window.calendar", { n: "10" })) && city[0].includes(W("screen.request.level.state")));
  assert.ok(city[1].includes("Oakland Sunshine Ordinance") && city[1].includes(W("screen.request.window.business", { n: "3" })) && city[1].includes(W("screen.request.level.city")));
  assert.ok(!city.some((t) => t.includes("Freedom of Information Act")), "not the federal law");
  assert.equal(p.doc.getElementById("req-law").querySelectorAll("input").filter((i) => i.checked).length, 0, "control: none preselected");
  const b = await press(p, "actionlaws", {});
  assert.equal(p.byOp("actionlaws").length, 0, "none named, nothing sent");
  assert.ok(beside(p, b).includes(W("screen.request.law.needed")));
  await press(p, "actionlaws", { values: { "req-law-0": true, "req-law-1": true } });
  assert.deepEqual(last(p, "actionlaws").body.laws.map((l) => l.citation), ["Cal. Gov. Code § 7920.000 et seq.", "Oakland Mun. Code ch. 2.20"], "she names one or more");
  const f = await open(REQ, { ...DATA_PLANE, action: ok(officeAction("federal")), profiles: ok(REAL()) });
  const fed = boxes(f);
  assert.equal(fed.length, 1);
  assert.ok(fed[0].includes("Freedom of Information Act") && fed[0].includes(W("screen.request.window.business", { n: "20" })), "FOIA with its 20 business days");
});

test("R61: two city layers with a 'Sunshine Ordinance': both are listed with their cities and choosing one sends its layer; NAME_AMBIGUOUS is drawn naming the layers with the picker open; control: a law one layer gives is drawn without a layer", async () => {
  const p = await open(REQ, { ...DATA_PLANE, action: ok(officeAction("city")), profiles: ok(twoCities()), actionlaws: ok({}) });
  const t = boxes(p);
  const sun = t.filter((x) => x.includes("Oakland Sunshine Ordinance"));
  assert.equal(sun.length, 2, "both listed");
  assert.ok(sun.some((x) => x.includes(W("screen.request.law.layer", { place: "Oakland" }))) && sun.some((x) => x.includes(W("screen.request.law.layer", { place: "Walkton" }))), "each with its city");
  const cpra = t.find((x) => x.includes("California Public Records Act"));
  assert.ok(!/ · in /.test(cpra), "control: a law one layer gives is drawn without a layer");
  const at = t.findIndex((x) => x.includes(W("screen.request.law.layer", { place: "Walkton" })));
  await press(p, "actionlaws", { values: { [`req-law-${at}`]: true } });
  assert.deepEqual(last(p, "actionlaws").body.laws, [{ level: "city", citation: "Walkton Mun. Code ch. 4", layer: "us-ca-walkton" }], "its layer is sent");
  const q = await open(REQ, { ...DATA_PLANE, action: ok(officeAction("city")), profiles: ok(twoCities()),
    actionlaws: refused("NAME_AMBIGUOUS", null, 409, { layers: [{ layer: "us-ca-oakland", level: "city", place: "Oakland" }, { layer: "us-ca-walkton", level: "city", place: "Walkton" }] }) });
  const b = await press(q, "actionlaws", { values: { "req-law-0": true } });
  assert.ok(beside(q, b).includes(W("screen.request.law.ambiguous", { layers: "Oakland, Walkton" })), "drawn by its words, naming the layers");
  assert.ok(q.doc.getElementById("req-law"), "the picker is still open");
  // on `action`, the law list (R54's law.pick) tells the two apart by layer and sends the one chosen
  const a = await open(`/app/action/${ACTION_ID}`, { ...DATA_PLANE, action: ok(officeAction("city")), profiles: ok(twoCities()), actionlaws: ok({}) });
  const opts = a.doc.getElementById("law-pick").querySelectorAll("option");
  const wk = opts.find((o) => o.textContent.includes("Walkton"));
  assert.ok(wk && opts.some((o) => o.textContent.includes(W("screen.action.law.layered", { citation: "Oakland Mun. Code ch. 2.20", place: "Oakland" }))));
  await press(a, "actionlaws", { values: { "law-pick": wk.getAttribute("value") } });
  assert.equal(last(a, "actionlaws").body.laws[0].layer, "us-ca-walkton");
  // a law stored with its layer is drawn with it
  const s = await open(`/app/action/${ACTION_ID}`, { ...DATA_PLANE, profiles: ok(twoCities()),
    action: ok({ ...officeAction("city"), governing_laws: { state: "stated", laws: [{ level: "city", citation: "Walkton Mun. Code ch. 4", layer: "us-ca-walkton" }], by: "member:mai", at: "2026-10-01T09:00:00Z" } }) });
  assert.ok(main(s).querySelector('[data-layer="us-ca-walkton"]'), "the stored layer is drawn");
});

test("R73: a team with no body on file draws the add with the body named in words; adding 'Records desk' in 'City of Walkton' records both through `entities` and chooses it; 'Use this office' is not refused for the body; control: with a body on file it is a choice, as now", async () => {
  const { world, me, project } = await actionWorld();
  const org = await entityOf(me, "institution", "Walkton Roads Program");
  const p = await openIn(world, me, `/app/request/${project}`);
  await until(p, () => p.doc.getElementById("req-subject"), "the names");
  await press(p, "addresseesuggest", { values: { "req-subject": org } });
  await until(p, () => p.doc.getElementById("req-noff-bodyname"), "the add");
  assert.equal(p.doc.getElementById("req-noff-body"), null, "no empty body choice");
  const b = await press(p, "entitycreate", { values: { "req-noff-name": "Records desk", "req-noff-bodyname": "City of Walkton", "req-noff-since": "2000-01-01", "req-noff-until": "2099-12-31",
    "req-noff-note": "It answers the city's records requests." } });
  assert.ok(!beside(p, b).includes(W("findin.fieldneeded", { field: W("screen.request.office.body") })), "never refused for the body");
  await until(p, () => p.doc.getElementById("req-office"), "the office to be chosen");
  const bodies = (await me.read("entitieskind", { query: { kind: "body", limit: "200" } })).entities.map((e) => e.label);
  assert.ok(bodies.includes("City of Walkton"), "the body is recorded");
  assert.deepEqual(p.doc.getElementById("req-office").querySelectorAll("option").map((o) => o.textContent.trim()), ["Records desk, City of Walkton"], "chosen at once");
  const q = await openIn(world, me, `/app/request/${project}`);
  await until(q, () => q.doc.getElementById("req-subject"), "the names");
  await press(q, "addresseesuggest", { values: { "req-subject": org } });
  const known = await answerOf(world, me, "addresseesuggest", { query: { subject: org } });
  if (!known.result.offices.length) {
    await until(q, () => q.doc.getElementById("req-noff-body"), "the fold with a body on file");
    assert.equal(q.doc.getElementById("req-noff-bodyname"), null, "control: with a body on file it is chosen, not typed");
  }
});

test("R74: the pointer to People is drawn as one sentence of its own (where to go and what to add), not 'use Records its offices keep'; control: a team with offices draws none", async () => {
  const PROJ = "PROJ-2026-pppppppppppppppp";
  const names = ok({ rows: [{ entity: "ENT-2026-2222222222222222", kind: "institution", name: "Walkton Roads Program" }], truncated: false });
  const p = await open(`/app/request/${PROJ}`, { ...DATA_PLANE, peopledirectory: names, addresseesuggest: ok({ ok: true, offices: [] }) });
  await press(p, "addresseesuggest", { values: { "req-subject": "ENT-2026-2222222222222222" } });
  const ptr = main(p).querySelector('[data-pointer="people"]');
  assert.ok(ptr, "the pointer is drawn");
  assert.equal(text(p, ptr), W("screen.request.nooffice.pointer.people"), "one sentence, its own");
  assert.ok(!text(p).includes(W("screen.request.nooffice.pointer.a")), "not the sentence that said to use Records its offices keep");
  const q = await open(`/app/request/${PROJ}`, { ...DATA_PLANE, peopledirectory: names,
    addresseesuggest: ok({ ok: true, offices: [{ addressee: { state: "named", kind: "office", role: "Records desk", body: "City of Walkton" } }] }) });
  await press(q, "addresseesuggest", { values: { "req-subject": "ENT-2026-2222222222222222" } });
  assert.equal(main(q).querySelector('[data-pointer="people"]'), null, "control: with offices, none");
});

test("R76: with no records help, 'the law's own text' names the law from the profile and links it where the profile gives its text; with no law on file the sentence says how one is added; control: a place with records help is unchanged", async () => {
  const laws = [{ level: "state", name: "Testland Records Act", citation: "TRA § 1", url: "https://law.example/tra" }, { level: "city", name: "Open Ordinance", citation: "TOO § 1" }];
  const p = await open("/app/help-records", { ...DATA_PLANE, profiles: ok({ ...PROFILES, view: { ...PROFILES.view, records_help: undefined, records_laws: laws } }) });
  const line = main(p).querySelector('[data-notheld="law"]');
  assert.ok(line, "the law is named");
  assert.ok(text(p, line).includes("Testland Records Act, TRA § 1") && text(p, line).includes("Open Ordinance, TOO § 1"));
  assert.equal(line.querySelector('a[data-law="TRA § 1"]').getAttribute("href"), "https://law.example/tra", "linked to its text");
  const none = await open("/app/help-records", { ...DATA_PLANE, profiles: ok({ ...PROFILES, view: { ...PROFILES.view, records_help: undefined, records_laws: [] } }) });
  assert.ok(text(none).includes(W("screen.help-records.notheld.nolaw")), "none on file: the sentence");
  assert.ok(main(none).querySelector('[data-list="places"] a[data-screen="places"]'), "with the way to add one");
});

test("R60, R61, R73, R74, R76 (R19): each key the new lines name is a word of setup-words, on the screen that draws it", () => {
  const on = (id) => new Set(SCREENS.find((s) => s.id === id).words);
  const need = { request: ["screen.request.law.pick", "screen.request.law.layer", "screen.request.law.needed", "screen.request.law.ambiguous", "screen.request.office.body.new", "screen.request.nooffice.pointer.people"],
    action: ["screen.action.law.layered", "screen.request.law.layer", "screen.request.law.ambiguous"],
    "help-records": ["screen.help-records.notheld.law", "screen.help-records.notheld.nolaw", "screen.places.name", "screen.places.purpose"] };
  for (const [id, ks] of Object.entries(need)) for (const k of ks) { assert.ok(hasWord(k), k); assert.ok(on(id).has(k), `${id} reads ${k}`); }
});
