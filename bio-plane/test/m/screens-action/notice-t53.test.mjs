/* screens-action, provider notices filing-templates:712, actions:715, action-plans:726 and filings:727 (no requirement text changed; actions'
   exports changed `actionOverdue`, `actionZone` and added `Actions.zoneRead`, `actionZoneRead`, `lawLayer`, `layersOf`, `officeLayer`). This
   module imports none of those exports: it reads `action`, `actionlaws`, `filingsfor`, `templatesforaction`, `plan` and `planchecks` as ops,
   and its seam tests build the world from `filings`' and `action-plans`' published fixtures (`real.mjs` imports `filings/fixture.mjs`). Its one
   adaptation is R60/R61's: the request's law list is the active chain's laws that govern the office's level, and `actionlaws` carries a
   law's `layer` only where two layers give it, as actions R113 (PR 715) takes it. These tests confirm both over the REAL providers. */
import test from "node:test";
import assert from "node:assert/strict";
import { text, main, press, last, ok, W, DATA_PLANE, ROUTES } from "./page.mjs";
import { realWorld, realPlane, realProfiles, open, until, V } from "./real.mjs";
import { seeded, opened } from "../action-plans/fixture.mjs";
import { dateBeforePhase } from "../action-plans/fixtures.mjs";

test("notice actions:715, filings:727, filing-templates:712 (R60, R61): over the real providers a city office's request offers the laws that govern it, and the law she ticks is stored by the real `actionlaws` with R113's layer key; the filings and templates reads answer as the screen reads them", async () => {
  const x = realWorld("oakland-alameda");
  const A = x.action({ kind: "records_request", risk_tier: 1, laws: null,
    counterparty: { state: "named", role: "City Clerk", body: "City of Oakland", level: "city" } });
  const p = await open(`/app/request/${A}`, realPlane(x, V("olive"), { ...DATA_PLANE, profiles: await realProfiles() }));
  await until(p, () => p.doc.getElementById("req-law"), "the law step");
  const boxes = p.doc.getElementById("req-law").querySelectorAll("label").map((l) => l.textContent.replace(/\s+/g, " ").trim());
  assert.ok(boxes.some((b) => b.includes("Oakland Sunshine Ordinance")) && boxes.some((b) => b.includes("California Public Records Act")), "the city's and the state's");
  assert.ok(!boxes.some((b) => b.includes("Freedom of Information Act")), "not the federal law, which governs no city office");
  const at = boxes.findIndex((b) => b.includes("Oakland Sunshine Ordinance"));
  await press(p, "actionlaws", { values: { [`req-law-${at}`]: true }, reason: "the city's ordinance" });
  assert.deepEqual(last(p, "actionlaws").body.laws, [{ level: "city", citation: "Oakland Mun. Code ch. 2.20" }], "one layer gives it: no layer is sent");
  const stored = x.actions.actionRead({ id: A, viewer: V("olive") }).governing_laws.laws;
  assert.deepEqual(stored.map(({ layer, ...l }) => l), [{ level: "city", citation: "Oakland Mun. Code ch. 2.20" }], "the real actionlaws stored it");
  assert.equal(main(p).querySelector('[data-state="failed"]'), null, "filingsfor, templatesforaction and the other reads answer as the screen reads them");
  assert.ok(p.requests.some((r) => r.op === "templatesforaction") && p.requests.some((r) => r.op === "filingsfor"));
});

test("notice action-plans:726 (R81): a plan the real action-plans reads (its published fixture) is drawn by the plan screen with its options and no read failed; the real optionAdd refuses an option with no summary, so 'Add an option' names the field first and the plane is not asked", async () => {
  const f = dateBeforePhase();
  const q = await open(ROUTES.plan, { ...DATA_PLANE, plan: ok(f.read) });
  assert.equal(main(q).querySelector('[data-state="failed"]'), null);
  for (const o of f.read.options) assert.ok(text(q).includes(o.summary), "each option by its summary");
  const w = seeded();
  opened(w, [w.SI, w.S1]);
  const real = w.ap.optionAdd({ plan: w.PL, summary: "", category: "awareness", subjects: [w.S1], author: V("bob"), viewer: V("bob") });
  assert.equal(real.ok, false, "the owner requires the summary");
  const p = await open(ROUTES.plan, { ...DATA_PLANE, optionadd: ok(real) });
  const b = await press(p, "optionadd", { values: { "plan-opt-summary": "" } });
  assert.equal(p.byOp("optionadd").length, 0, "not asked");
  assert.ok(text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`)).includes(W("screen.plan.option.needed")));
});
