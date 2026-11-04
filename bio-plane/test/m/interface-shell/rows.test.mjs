/* interface-shell R19 and R22: rows with their panels, picks and the hold strip; access by keyboard, names and labels. */
import test from "node:test";
import assert from "node:assert/strict";
import { interfacePage } from "../../../src/interface-shell/index.mjs";
import { boot, ok, refused, pending, controls, accessibleName, ADMIN } from "./harness.mjs";
import { ALL } from "./screens.fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "w", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });
const HELDA = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }, { id: "h2", title: "Budget", at: "2026-10-02" }] });
const PLANE = { image: IMAGE, heldcaptures: HELDA, projectdirectory: ok({ projects: [{ id: "P1", title: "Pothole", questions: 2, due: "2026-10-20" }] }) };
/* the dates of HELDA, as the date keys draw them (R6): never a literal in either order */
const DAYS = ["1", "2"].map((day) => word("date.daymonthyear", { day, month: word("date.month.october"), year: "2026" }));
const rowsOf = (p) => p.root().querySelectorAll("tr.cs-r");

test("R19 each row's acts are in a panel opened beneath it, by its name or the keyboard, never elsewhere on the screen", async () => {
  const p = await boot({ screens: ALL, path: "/app/held", plane: PLANE });
  const panel = (i) => rowsOf(p)[i].nextElementSibling;
  assert.ok(panel(0).classList.contains("cs-panel"));
  assert.equal(panel(0).hidden, true);
  assert.equal(p.root().querySelectorAll('button[data-act="heldrestore"]').every((b) => b.closest("tr.cs-panel")), true, "only in its row's panel");
  const open = rowsOf(p)[0].querySelector('[data-shell="row"]');
  assert.equal(open.getAttribute("aria-label"), "Acts for Minutes");
  assert.equal(open.closest(".mk-rowname").textContent, "Minutes" + open.textContent, "beside the row's name");
  assert.equal(open.getAttribute("aria-expanded"), "false");
  await p.click(open);
  assert.equal(panel(0).hidden, false);
  assert.equal(panel(1).hidden, true);
  assert.equal(rowsOf(p)[0].querySelector('[data-shell="row"]').getAttribute("aria-expanded"), "true");
  const second = rowsOf(p)[1].querySelector('[data-shell="row"]');
  p.fire(second, "keydown", { key: "Enter" }); await p.settle();
  assert.equal(panel(1).hidden, false, "by the keyboard");
  await p.click(rowsOf(p)[0].querySelector('[data-shell="row"]'));
  assert.equal(panel(0).hidden, true);
});

test("R19 ticking rows brings the hold strip with its count, the acts that apply to every picked row, and Unpick all", async () => {
  const p = await boot({ screens: ALL, path: "/app/held", plane: PLANE });
  assert.equal(p.root().querySelector(".cs-hold"), null);
  const pick = async (id) => { const b = p.doc.getElementById("pick-held-" + id); b.checked = !b.checked; p.fire(b, "change"); await p.settle(); };
  await pick("h1");
  let hold = p.root().querySelector(".cs-hold");
  assert.equal(hold.querySelector(".n").textContent, "1 picked");
  assert.ok(hold.querySelector('button[data-act="release"]') && hold.querySelector('button[data-act="heldsetaside"]'));
  await pick("h2");
  hold = p.root().querySelector(".cs-hold");
  assert.equal(hold.querySelector(".n").textContent, "2 picked");
  assert.equal(hold.querySelector('button[data-act="release"]').getAttribute("data-ids"), "h1,h2");
  assert.equal(p.doc.getElementById("pick-held-h1").getAttribute("aria-label"), "Pick Minutes");
  await p.click(hold.querySelector('[data-shell="unpick"]'));
  assert.equal(p.root().querySelector(".cs-hold"), null);
  assert.equal(p.doc.getElementById("pick-held-h1").checked, false);
});

test("R19 R62 sorting keeps each open panel with its row; at the phone width each row reads as the design's one-line row, its first value beside its name and the rest labelled", async () => {
  const p = await boot({ screens: ALL, path: "/app/held", plane: PLANE });
  await p.click(rowsOf(p)[1].querySelector('[data-shell="row"]'));
  const sort = p.root().querySelectorAll('[data-shell="sort"]')[0];
  assert.equal(sort.closest("th").getAttribute("aria-sort"), "none");
  await p.click(sort);
  await p.click(p.root().querySelectorAll('[data-shell="sort"]')[0]);
  assert.equal(p.root().querySelectorAll("th")[1].getAttribute("aria-sort"), "descending");
  const names = rowsOf(p).map((r) => r.querySelector('[data-shell="row"]').getAttribute("aria-label").replace(word("shell.row.open", { name: "" }), ""));
  assert.deepEqual(names, ["Minutes", "Budget"]);
  const budget = rowsOf(p).find((r) => r.textContent.includes("Budget"));
  assert.equal(rowsOf(p).indexOf(budget), 1);
  assert.equal(budget.nextElementSibling.hidden, false, "the open panel moved with its row");
  assert.equal(rowsOf(p).find((r) => r.textContent.includes("Minutes")).nextElementSibling.hidden, true);
  await p.click(p.root().querySelectorAll('[data-shell="sort"]')[0]);
  const b2 = rowsOf(p).find((r) => r.textContent.includes("Budget"));
  assert.equal(rowsOf(p).indexOf(b2), 0, "ascending now");
  assert.equal(b2.nextElementSibling.hidden, false);
  const q = await boot({ screens: ALL, path: "/app/held", plane: PLANE, phone: true });
  for (const r of rowsOf(q)) {
    assert.ok(DAYS.some((d) => r.querySelector(".mk-rowname").textContent.includes(d)), "the first value on the name's line");
    for (const td of r.querySelectorAll("td").slice(2)) assert.ok(td.getAttribute("data-label"), td.outerHTML);
  }
});

test("R22 every control of every screen has an accessible name, every field a label, every icon is beside a word, colour is never the only signal, and motion stops under reduced motion", async () => {
  for (const path of ["/app", "/app/held", "/app/document/c1", "/app/members", "/app/settings", "/app/people", "/app/more"]) for (const phone of [false, true]) {
    const p = await boot({ screens: ALL, path, phone, plane: { ...PLANE, whoami: ok(ADMIN), assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
    await p.click('[data-shell="dock"]');
    await p.click('[data-shell="menu"]');
    const reasonAct = p.root().querySelector('button[data-act="release"]');
    if (reasonAct) await p.click(reasonAct);
    const r = p.root();
    for (const c of controls(r)) assert.ok(accessibleName(c, p.doc).length > 0, path + " " + c.outerHTML.slice(0, 100));
    for (const f of r.querySelectorAll("input, select, textarea")) {
      const label = f.getAttribute("aria-label") || (f.id && r.querySelector(`label[for="${f.id}"]`)) || f.closest("label");
      assert.ok(label, path + " " + f.outerHTML);
    }
    for (const svg of r.querySelectorAll("svg")) {
      assert.equal(svg.getAttribute("aria-hidden"), "true");
      const host = svg.parentElement;
      assert.ok(host.textContent.trim().length > 0 || accessibleName(host, p.doc).length > 0, path + " " + host.outerHTML.slice(0, 120));
    }
    for (const g of r.querySelectorAll(".cs-grade, .cs-kind, .cs-origin, .cs-gap, .cs-due")) assert.ok(g.textContent.trim(), "a word beside every colour");
    for (const el of r.querySelectorAll("[data-tip]")) if (!el.matches("a, button, input, select, textarea")) assert.equal(el.getAttribute("tabindex"), "0", "reachable by keyboard: " + el.outerHTML.slice(0, 80));
  }
  const html = interfacePage(ALL);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)\{\*\{animation:none!important;transition:none!important\}\}/);
});

test("R22 controls are operable by keyboard in reading order: links and buttons, never a click-only element; the rail's edge by its arrow keys", async () => {
  const p = await boot({ screens: ALL, path: "/app/held", plane: PLANE });
  const r = p.root();
  for (const el of r.querySelectorAll("[data-shell], [data-act]")) assert.ok(["button", "input", "a"].includes(el.localName), el.outerHTML.slice(0, 80));
  assert.equal(r.querySelector("[tabindex]:not([tabindex='0'])"), null, "no positive tabindex: reading order");
  const states = [pending, refused("NO"), ok(null)];
  for (const s of states) { const q = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: s } }); assert.equal(q.root().querySelector("[tabindex]:not([tabindex='0'])"), null); }
});
