/* screens-action, fix round 4 (R-SEAM; K4429): the walker's federal records request, from "Name the office yourself" to "Recorded as sent",
   by the member's own presses over the REAL merged providers (`entities`, `actions`, `filings` with `filing-templates`, over the first
   profile `jurisdictions` holds), never a scripted double of one. */
import test from "node:test";
import assert from "node:assert/strict";
import { main, text, ops, press, last, ok, W, D, button } from "./page.mjs";
import { realWorld, realPlane, realProfiles, profilesOf, open, until, V } from "./real.mjs";

const OGIS = "Office of Government Information Services";
const FED = "5 U.S.C. § 552";
const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);

/* R60 (T53): the laws are boxes, none ticked, each labelled with its level, name, citation and window */
const lawsPick = (q) => q.doc.getElementById("req-law").querySelectorAll("label").map((o) => o.textContent.trim());
/* The walker's path, by the member's own presses. `profiles` is the op that answers the place's facts: the real `instance-setup` or, while
   its `profiles()` omits the laws (instance-setup R12, INSTANCE-SETUP #27), `jurisdictions.combine`'s view in its place. */
async function walk(profiles) {
  const x = realWorld();
  // R56 (walk E H1): the team's named offices are offered again, so the world's own seeded office would be; the walker's team holds none
  x.w.st.sql.exec(`DELETE FROM entities WHERE kind = 'office'`);
  // R57: the office she names is a post in a body the team holds (a body is registered by an administrator, never by a member naming an office)
  const BODY = "National Archives";
  const bodyId = x.ents.createEntity({ kind: "body", label: BODY, note: "the agency the office is in", declaredBy: V("olive") }).entity_id;
  const plane = realPlane(x, V("olive"), { peopledirectory: ok({ rows: [{ entity: bodyId, kind: "body", name: BODY }], truncated: false }), profiles,
    list: ok({ bundles: [{ bundle_id: x.proj, object_type: "project", title: "Parks" }], limit: 500, cursor: null, total: 1 }) });
  const p = await open(`/app/request/${x.proj}`, plane);
  // she asks about the agency's body; the record holds no office in it, so the state says so and she names one
  await press(p, "addresseesuggest", { values: { "req-subject": bodyId } });
  await until(p, () => p.doc.getElementById("req-noff-name"), "the fold that names an office");
  said(p, "screen.request.nooffice");
  // she names the office herself: the agency alone, where requests go, the federal law (a name with no comma, drawn once)
  const lawsIn = (q) => q.doc.getElementById("req-noff-law").querySelectorAll("option").map((o) => o.textContent.trim());
  const at = lawsIn(p).findIndex((t) => t.includes(FED));
  assert.ok(at >= 0, "the federal law is among the profile's records laws");
  await press(p, "entitycreate", { values: { "req-noff-name": OGIS, "req-noff-where": "https://www.archives.gov/ogis", "req-noff-law": String(at),
    "req-noff-body": bodyId, "req-noff-since": "2000-01-01", "req-noff-until": "2099-12-31", "req-noff-note": "It answers federal records requests for the archives." } });
  await until(p, () => p.doc.getElementById("req-office"), "the office she named to be chosen");
  assert.equal(last(p, "entitycreate").body.label, OGIS);
  assert.equal(last(p, "entitycreate").body.law, FED);
  assert.deepEqual(p.doc.getElementById("req-office").querySelectorAll("option").map((o) => o.textContent.trim()), [`${OGIS}, ${BODY}`], "chosen at once and drawn once, as the owner answers it: the office in its body");
  assert.ok(main(p).querySelector('[data-named="1"]'), "marked as named by a member");
  // R56 (walk E H1): on her next visit the office she named is offered again, by its label (the real `entities` lists it), and she is not asked to name it twice
  const again = await open(`/app/request/${x.proj}`, plane);
  assert.deepEqual(again.doc.getElementById("req-subject").querySelectorAll("option").map((o) => o.textContent.trim()), ["", BODY, OGIS], "the named office is offered again");
  assert.ok(!again.doc.getElementById("req-noff-name"), "and the fold that names one is not drawn: an office is known");
  assert.equal(x.rows("SELECT COUNT(*) AS n FROM entities WHERE label = ?", OGIS)[0].n, 1, "one entry for the office");
  await press(p, "actioncreate", { values: { "req-what": "Records of how the Archives handled federal records requests in 2024", "req-office": "0" }, reason: "start" });
  await until(p, () => /ACTN-/.test(p.location.pathname) && p.doc.getElementById("req-law"), "the started request's page");
  const ACTN = p.location.pathname.split("/").pop();
  assert.match(ACTN, /^ACTN-/);
  // the law: the profile's records laws, the Freedom of Information Act with its own level
  const lawAt = lawsPick(p).findIndex((t) => t.includes(FED));
  await press(p, "actionlaws", { values: { [`req-law-${lawAt}`]: true }, reason: "federal" });
  assert.deepEqual(last(p, "actionlaws").body, { target: ACTN, laws: [{ level: "federal", citation: FED }] });
  // F-R31 (action-grammar R31, PR 396): governingLawsOf answers {level, citation, layer}, layer null when absent. Where the stored law carries
  // the layer key it is null (no layer was named); where it does not (the provider before R31) the old shape stands.
  const stored = x.actions.actionRead({ id: ACTN, viewer: V("olive") }).governing_laws.laws;
  assert.deepEqual(stored, stored.map((l) => ("layer" in l ? { level: "federal", citation: FED, layer: null } : { level: "federal", citation: FED })), "stored, R31's shape where the layer key is present");
  assert.deepEqual(stored.map(({ layer, ...l }) => l), [{ level: "federal", citation: FED }], "stored");
  // the text: a plain request prepares although the period, form and cost boxes are filled (the text names no blank for them)
  const boxes = { "req-from": "2024-01-01", "req-to": "2024-12-31", "req-form": "pdf", "req-cost": "$25" };
  await press(p, "communicationprepare", { values: { ...boxes, "send-text-0": "Please send me the records of how the Archives handled federal records requests in 2024." }, reason: "ready" });
  await until(p, () => button(p, "filingapprove"), "the prepared text to be drawn for approval");
  assert.ok(!("fills" in last(p, "communicationprepare").body), "no fills for blanks the text does not have");
  assert.equal(x.rows("SELECT COUNT(*) AS n FROM communication_drafts WHERE action_id = ?", ACTN)[0].n, 1, "prepared and stored by the real filings");
  assert.ok(text(p).includes(W("screen.start-send.text.help")) && !text(p).includes(W("screen.request.text.help")), "no template is claimed");
  await press(p, "filingapprove", { reason: "ready", confirm: true });
  // the send step: nothing of "the city" for a federal request
  await until(p, () => button(p, "filingrecordsent"), "the send step after the approval");
  assert.ok(button(p, "filingrecordsent"), "approved: the sending is recorded here");
  assert.ok(!text(p).includes(W("screen.request.howsend.3")), "not 'the city can't send you updates'");
  await press(p, "filingrecordsent", { values: { "send-at": "2026-09-27", "send-account": "through the Archives' online form", "send-reference": "NARA-2026-0042" }, reason: "sent" });
  await until(p, () => text(p).includes(W("screen.start-send.sent", { date: D("2026-09-27") })), "the sending to be drawn as recorded");
  said(p, "screen.start-send.sent", { date: D("2026-09-27") });
  // the due date: the machine proposes the first-request window the profile's law names and the member adopts it (action-clocks), then the
  // action words it by the profile's label, never by the rule's code (the walker's "foia_appeal_response")
  const prop = x.clocks.clockPropose({ target: ACTN, rule: "foia_response", proposer: "class:daemon", viewer: "class:daemon" });
  assert.equal(prop.ok, true, JSON.stringify(prop).slice(0, 300));
  const adopted = x.clocks.clockAdopt({ target: ACTN, proposal: prop.proposal.key, author: V("olive"), viewer: V("olive"), date: "2026-11-19" });
  assert.equal(adopted.ok, true, JSON.stringify(adopted).slice(0, 300));
  const dated = await open(`/app/action/${ACTN}`, plane);
  assert.ok(text(dated).includes("answer to a first request"), "the profile's label for the first-request window");
  assert.ok(!text(dated).includes("foia_response") && !text(dated).includes("foia_appeal_response"), "no rule's code");
  assert.ok(text(dated).includes("5 U.S.C. § 552(a)(6)(A)(i)"), "the first-request clause, not the appeal's (A)(ii)");
  // the help for this request: the law's own first-request window, no state or city text
  const help = await open(`/app/help-records/${ACTN}`, plane);
  assert.ok(text(help).includes("5 U.S.C. § 552(a)(6)(A)(i)"), "the first-request clause");
  assert.ok(text(help).includes(W("screen.request.window.business", { n: "20" })), "20 business days");
  assert.ok(!/Gov\. Code|Mun\. Code|\bcity\b/i.test(text(help).replace(W("screen.help-records.purpose"), "")), "no California or city text");
  // the answer came: the action offers the way to keep the filing as the team's template (C65), and the real filings keeps it
  const act = await open(`/app/action/${ACTN}`, plane);
  const door = main(act).querySelector(`a[href="/app/start-send/${ACTN}"]`);
  assert.ok(door && door.textContent.includes(W("screen.start-send.template.heading")), "C65: the reference");
  const send = await open(`/app/start-send/${ACTN}`, plane);
  await press(send, "templatesave", { values: { "template-name": "A federal records request", "template-use": "file" }, reason: "keep" });
  await until(send, () => x.rows("SELECT name FROM tpl_templates").length === 1, "the template to be kept");
  const saved = last(send, "templatesave").body;
  assert.deepEqual({ ...saved, reason: undefined }, { filing: saved.filing, name: "A federal records request", use: "file", project: x.proj, reason: undefined });
  const kept = x.rows("SELECT kind, use, name, project FROM tpl_templates");
  assert.deepEqual(kept, [{ kind: "records_request", use: "file", name: "A federal records request", project: x.proj }], "the real filings keeps the template");
}

test("R20, R4, R9, R3, R8, R43, R48 (C64, C65): the walker's federal request, from naming the office to keeping the filing as a template, over the real providers (the profile's facts from jurisdictions.combine)", async () => {
  await walk(profilesOf("oakland-alameda"));
});

test("R20, R4, R9 (C64; instance-setup R12, INSTANCE-SETUP #27): the same request with the REAL instance-setup profiles(): its view carries the records laws the screens list (red by name until instance-setup carries them)", async () => {
  const profiles = await realProfiles("oakland-alameda");
  const view = profiles().json.result.view;
  assert.ok(Array.isArray(view.records_laws) && view.records_laws.some((l) => l.citation === FED && l.response === "foia_response"), "profiles().view.records_laws holds the federal law with its window");
  assert.ok(view.records_help === undefined || typeof view.records_help === "object");
  await walk(profiles);
});
