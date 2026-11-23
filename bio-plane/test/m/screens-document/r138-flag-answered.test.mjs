/* screens-document R138 (T51 fix round 10; K5292; DEC-439, DEC-440): after `contradictionflag` is answered, the Document page says so. Each case runs through
 * the world's real `contradictionflag` (store-request's world, contradiction R61): a new flag draws `screen.document.flag.recorded` and the flag in the page's
 * list of flags (`screen.document.flags.head`, each pair `screen.document.flags.pair`, its raiser `screen.contradiction.flagged.by`); the same pair again,
 * answered `already: true`, draws `screen.document.flag.already`; a refusal draws the owner's refusal. The document screen alone is served, with this
 * module's shared readers (`COMMON`). Every word is read from the word table by key, never copied. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../interface-shell/harness.mjs";
import { storeWorld } from "../store-request/fixtures.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { documentScreen } from "../../../src/screens-inquiry/document.mjs";
import { COMMON } from "../../../src/screens-inquiry/common.mjs";

const SCREENS = [documentScreen(COMMON)];
const OWN = { capabilities: ["contribute", "create_projects"] };
const REASON = "One says November, the other December.";
const pageHtml = (title, paragraphs) => `<html><head><title>${title}</title></head><body>\n<h1>${title}</h1>\n${paragraphs.map((t) => `<p>${t}</p>`).join("\n")}\n</body></html>`;
const main = (p) => p.doc.getElementById("cs-main");
const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
/** the word for `key` as the page draws it, its fills given as plain text */
const plainWord = (key, fills = {}) => {
  let s = String(word(key));
  for (const [k, v] of Object.entries(fills)) s = s.split("{" + k + "}").join(v);
  return s.replace(/\s+/g, " ").trim();
};

/** `ann` with a project holding two read web pages: the one the page opens, and the other it is set beside */
async function world() {
  const w = await storeWorld();
  const ann = await w.signIn("ann", OWN);
  const project = await w.recipes.project(ann, "Pothole repairs");
  const here = await w.recipes.hold(ann, "Council minutes", pageHtml("Council minutes", ["The rent rises on December 1.", "Repairs are recorded as closed."]), project, { type: "text/html", read: true });
  const other = await w.recipes.page(ann, "Rent notice, October 2026", { paragraphs: ["The rent rises on November 1."], project });
  return { w, ann, here, other };
}
/** the Document page over the world's own door; the answers kept by op */
async function pageOn({ w, ann, here }) {
  const { door, session } = w.boot(ann);
  const kept = [];
  const p = await boot({ screens: SCREENS, session, path: "/app/document/" + here.bundle, door: async (req) => { const a = await door(req); kept.push([req.op, a]); return a; } });
  await p.settle();
  p.answers = (op) => kept.filter(([k]) => k === op).map(([, a]) => (a.json && a.json.result !== undefined ? a.json.result : a.json));
  return p;
}
const fill = (p, values) => {
  for (const [name, v] of Object.entries(values)) {
    const el = main(p).querySelector(`[name="${name}"]`);
    assert.ok(el, `the control ${name} is drawn`);
    el.value = v; p.fire(el, "input"); p.fire(el, "change");
  }
};
async function choose(p, other, reason) {
  const picker = main(p).querySelector('[data-picker="flag"]');
  const r = picker && picker.querySelectorAll("input").find((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === other && !i.closest("[data-pick-pages]"));
  assert.ok(r, "the other document is offered in the flag fold's picker");
  r.checked = true; p.fire(r, "change"); await p.settle();
  fill(p, { "document-flag-here": "0", "document-flag-there": "0", "document-flag-why": reason });
}
async function press(p) {
  const b = main(p).querySelector('[data-op="contradictionflag"]');
  assert.ok(b, "the flag act is drawn");
  p.fire(b, "click"); await p.settle();
}
const outcome = (p) => text(main(p).querySelector('[data-outcome="contradictionflag"]'));
const flagsSection = (p) => main(p).querySelectorAll("section").find((s) => text(s).startsWith(plainWord("screen.document.flags.head"))) || null;

test("R138 a new flag draws screen.document.flag.recorded and the flag in the page's list (head, the pair linked to its contradiction, who raised it); control: before any flag, no list and nothing beside the act", async () => {
  const s = await world();
  const p = await pageOn(s);
  assert.equal(flagsSection(p), null, "control: no flag, no list of flags");
  assert.equal(outcome(p), "", "control: nothing beside the act before it is pressed");
  await choose(p, s.other.bundle, REASON);
  await press(p);
  const [a] = p.answers("contradictionflag");
  assert.equal(a.wrote, true, "the world recorded the flag");
  assert.equal(outcome(p), plainWord("screen.document.flag.recorded"), "the recorded sentence, by key");
  const sec = flagsSection(p);
  assert.ok(sec, "the list of flags raised on the document is drawn after the act, under its head");
  const rows = sec.querySelectorAll("[data-flag]");
  assert.equal(rows.length, 1, "one row for the one flag");
  assert.equal(rows[0].getAttribute("data-flag"), a.candidate, "the row is the flag the world wrote");
  const link = rows[0].querySelector("a");
  assert.ok(link && link.getAttribute("href").includes("/app/contradiction/") && link.getAttribute("href").includes(a.candidate), "the pair links to its contradiction");
  assert.equal(text(link), plainWord("screen.document.flags.pair", { a: "Council minutes", b: "Rent notice, October 2026" }), "the pair named by the two documents' titles");
  assert.ok(text(rows[0]).includes(plainWord("screen.contradiction.flagged.by", { member: "ann" }).split("{date}")[0].trim()), "who raised it, by the word for it");
});

test("R138 the same pair flagged again is answered already: true and draws screen.document.flag.already; the list keeps the pair once", async () => {
  const s = await world();
  const p = await pageOn(s);
  await choose(p, s.other.bundle, REASON);
  await press(p);
  await press(p);
  const [first, again] = p.answers("contradictionflag");
  assert.equal(again.already, true, "the world answers that the pair is already held");
  assert.equal(outcome(p), plainWord("screen.document.flag.already"), "the already-flagged sentence, by key, in place of the owner's");
  assert.notEqual(outcome(p), plainWord("screen.document.flag.recorded"));
  const rows = flagsSection(p).querySelectorAll("[data-flag]");
  assert.equal(rows.length, 1, "the pair is listed once");
  assert.equal(rows[0].getAttribute("data-flag"), first.candidate);
});

test("R138 a refusal of the world's contradictionflag draws the owner's refusal, and no flag is drawn as recorded; bound: a reason of 500 characters is recorded, one of 501 refused (contradiction R61)", async () => {
  const s = await world();
  const p = await pageOn(s);
  await choose(p, s.other.bundle, "x".repeat(501));
  await press(p);
  const [refusal] = p.answers("contradictionflag");
  assert.equal(refusal.ok, false, "the world refuses a reason past its bound");
  const code = String(refusal.code || refusal.reason);
  assert.ok(code, "the refusal carries its code");
  const drawn = text(main(p).querySelector('[data-outcome="contradictionflag"]'));
  assert.ok(drawn, "the refusal is drawn beside the act");
  assert.notEqual(drawn, plainWord("screen.document.flag.recorded"), "a refusal is never drawn as recorded");
  assert.notEqual(drawn, plainWord("screen.document.flag.already"));
  assert.ok(!drawn.includes(code) || drawn !== code, "the refusal is drawn in words, not as its bare code");
  assert.equal(flagsSection(p), null, "nothing was written, so no list of flags");
  fill(p, { "document-flag-why": "y".repeat(500) });
  await press(p);
  assert.equal(p.answers("contradictionflag")[1].wrote, true, "a reason at the bound is recorded");
  assert.equal(outcome(p), plainWord("screen.document.flag.recorded"));
});
