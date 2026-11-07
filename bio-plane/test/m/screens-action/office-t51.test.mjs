/* screens-action, fix round 3 (T51; C64; DEC-401, DEC-402): "Name the office yourself" on `request`. A member who finds no office known
   to hold such records names one (the agency and the office within it, where requests go, the law it goes under; DEC-412), saved for the team through
   `entitycreate`, marked as named by a member, and chosen for the request. Every sentence is asserted by its key (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { open, main, text, ops, press, last, ok, refused, W, DATA_PLANE, ACTION_ID, PROJECT, PROFILES, ADMIN } from "./page.mjs";
import { until } from "./real.mjs";
import { naming, reach, BODY_NAME, DAYS } from "./naming.mjs";

const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const HUD = "U.S. Department of Housing and Urban Development, San Francisco Regional Office";
const FOIA = "5 U.S.C. § 552";
const LAWS = [{ level: "state", name: "California Public Records Act", citation: "Gov. Code § 7920.000" }, { level: "federal", name: "Freedom of Information Act", citation: FOIA }];
const WITH_LAWS = ok({ ...PROFILES, view: { ...PROFILES.view, records_laws: LAWS } });
/** A world with the team's one body: `{plane, body, path, x}` (naming.mjs). */
const world = (base = {}, over = {}) => { const w = naming({ ...DATA_PLANE, profiles: WITH_LAWS, ...base }); return { ...w, plane: { ...w.plane, ...over } }; };
/** The world, the request page opened, and the fold that names an office reached. */
const start = async (base, over) => { const w = world(base, over); const p = await open(w.path, w.plane); await reach(p, w.body, until); return { ...w, p }; };

test("R20, R4 (C64, DEC-402): with no office known a member names one: the fold, then `entitycreate` with the office, where requests go and the law, the office drawn marked and chosen, and 'Start the request' addressed to it", async () => {
  const { p, body } = await start();
  said(p, "screen.request.nooffice");
  said(p, "screen.request.nooffice.admin");
  for (const k of ["screen.request.nameoffice.head", "screen.request.nameoffice.note", "screen.request.nameoffice.name", "screen.request.nameoffice.name.help", "screen.request.nameoffice.where",
    "screen.request.nameoffice.where.help", "screen.request.nameoffice.law", "screen.request.nameoffice.law.help", "screen.request.nameoffice.use.help",
    "screen.request.nameoffice.role", "screen.request.nameoffice.role.help", "screen.request.nameoffice.why", "screen.request.nameoffice.why.help"]) said(p, k);
  assert.deepEqual(ops(p), ["addresseesuggest", "entitycreate"], "the acts the dead end offers, the name asked about and the office named: no start and no later step");
  assert.deepEqual(p.doc.getElementById("req-noff-law").querySelectorAll("option").map((o) => o.value), ["0", "1"], "the profile's records laws");
  assert.equal(p.doc.getElementById("req-what"), null);
  const bare = await press(p, "entitycreate", {});
  assert.equal(p.byOp("entitycreate").length, 0, "no name: refused in place, nothing sent");
  assert.ok(text(p, p.root().querySelector(`[data-slot="${bare.getAttribute("data-ai")}"]`)).includes(W("findin.fieldneeded", { field: W("screen.request.nameoffice.name") })));
  await press(p, "entitycreate", { values: { ...DAYS, "req-noff-body": body, "req-noff-name": HUD.split(", ")[0], "req-noff-role": HUD.split(", ")[1], "req-noff-where": "https://foiaonline.example/hud", "req-noff-law": "1", "req-noff-note": "It answers records requests for HUD in California." } });
  assert.deepEqual(last(p, "entitycreate").body, { kind: "office", label: HUD, contact: { kind: "portal", value: "https://foiaonline.example/hud" }, law: FOIA,
    note: "It answers records requests for HUD in California." });
  assert.ok(main(p).querySelector('[data-named="1"]').textContent.includes(W("screen.request.nameoffice.mark")), "the office is drawn marked as named by a member");
  assert.ok(text(p).includes(HUD.split(", ")[1]), "the office is chosen for this request, as the owner answers it");
  assert.deepEqual(ops(p), ["actioncreate"], "chosen: what is wanted is asked");
  await press(p, "actioncreate", { values: { "req-what": "Records of the regional office's housing inspections", "req-office": "0" }, reason: "x" });
  const doc = last(p, "actioncreate").body.document;
  for (const line of [`role: ${JSON.stringify(HUD)}`, `body: ${JSON.stringify(BODY_NAME)}`, 'action_kind: "records_request"'])
    assert.ok(doc.includes(line), line);
  assert.match(/entity_id: "(ENT-[^"]+)"/.exec(doc)[1], /^ENT-/, "the office is the entity the team now holds");
  await until(p, () => /^\/app\/request\/ACTN-/.test(p.location.pathname), "the started request's page");
});

test("R20 (C64): where requests go is sent as an email, a portal or an address by its form, and not at all when left empty; a refused office chooses none; control: a profile with no records law draws no law choice and sends none", async () => {
  const { p: emailed, body: body_emailed } = await start();
  await press(emailed, "entitycreate", { values: { ...DAYS, "req-noff-body": body_emailed, "req-noff-name": "Records Office", "req-noff-where": "foia@agency.example", "req-noff-note": "x" } });
  assert.deepEqual(last(emailed, "entitycreate").body.contact, { kind: "email", value: "foia@agency.example" });
  const { p: mailed, body: body_mailed } = await start();
  await press(mailed, "entitycreate", { values: { ...DAYS, "req-noff-body": body_mailed, "req-noff-name": "Records Office", "req-noff-where": "1 Main St, Washington DC", "req-noff-note": "x" } });
  assert.deepEqual(last(mailed, "entitycreate").body.contact, { kind: "address", value: "1 Main St, Washington DC" });
  const { p: plain, body: body_plain } = await start();
  await press(plain, "entitycreate", { values: { ...DAYS, "req-noff-body": body_plain, "req-noff-name": "Records Office", "req-noff-note": "x" } });
  assert.equal(Object.hasOwn(last(plain, "entitycreate").body, "contact"), false, "no place stated: none sent");
  // a refusal is drawn by its words and the office is not chosen
  const { p: no, body: body_no } = await start({}, { entitycreate: refused("UNKNOWN_LAW") });
  await press(no, "entitycreate", { values: { ...DAYS, "req-noff-body": body_no, "req-noff-name": "Records Office", "req-noff-note": "x" } });
  assert.equal(no.doc.getElementById("req-what"), null);
  assert.equal(main(no).querySelector('[data-named="1"]'), null);
  // control: no records law in the profile
  const { p: bare, body: body_bare } = await start({ profiles: ok({ ...PROFILES, view: { ...PROFILES.view, records_laws: [] } }) });
  assert.equal(bare.doc.getElementById("req-noff-law"), null);
  await press(bare, "entitycreate", { values: { ...DAYS, "req-noff-body": body_bare, "req-noff-name": "Records Office", "req-noff-note": "x" } });
  assert.equal(Object.hasOwn(last(bare, "entitycreate").body, "law"), false);
});

test("R20 (C64): the administrator's wording is unchanged and she keeps Places; control: with offices known the fold is not drawn", async () => {
  const { p: admin } = await start({ whoami: ok(ADMIN) });
  said(admin, "screen.request.nooffice.admin");
  assert.ok(main(admin).querySelector('a[href="/app/places"]'));
  assert.ok(main(admin).querySelector("details.mk-details"), "the fold");
  const w = world();
  const known = await open(w.path, { ...w.plane, peopledirectory: ok({ rows: [{ entity: "ENT-2026-2222222222222222", kind: "office", name: "Pothole repair program" }], truncated: false }) });
  assert.ok(!text(known).includes(W("screen.request.nameoffice.head")));
  assert.equal(known.doc.getElementById("req-noff-name"), null);
});

test("R31 (C66): 'Show the routes' with none says that none is known for the kind, not only 'Nothing here'; control: a kind with routes lists them and says no such thing", async () => {
  const none = await open(`/app/action/${ACTION_ID}`, { ...DATA_PLANE, procedureguides: ok({ ok: true, kind: "records_request", guides: [], withheld: [], label: {} }) });
  said(none, "screen.action.routes.none"); // R79 (T53): the action screen's own row, with the cause
  assert.ok(!text(none).includes(W("state.empty")), "no bare 'Nothing here'");
  const some = await open(`/app/action/${ACTION_ID}`, DATA_PLANE);
  assert.ok(!text(some).includes(W("screen.action.routes.none")));
  assert.ok(text(some).includes("Ask in writing, naming the records"));
  await press(none, "procedureguides");
  said(none, "screen.action.routes.none"); // R79 (T53): the action screen's own row, with the cause
});
