/* screens-account R82 (amends R20): recovery draws "If you lose your codes too" (`screen.recovery.lost.heading`,
   `screen.recovery.lost.what`), last and in every state, read through the word table (Screens page team-and-account,
   recovery C4). The screen is drawn at its interface, `render(cs, view)`, with a kit that marks each word by its key and
   each section by its heading key, so the test reads which words were drawn and in what order. */
import test from "node:test";
import assert from "node:assert/strict";
import { recovery } from "../../../src/screens-settings/recovery.mjs";

const S = "screen.recovery.";

/** A kit with the shell's parts the screen calls (interface-shell R21): each word drawn as its key between marks. */
function kit({ act = true } = {}) {
  return {
    w: (k) => `«${k}»`,
    esc: (s) => String(s),
    date: () => "1 May 2026",
    title: () => "«title»",
    sec: (k, inner) => `<section data-h="${k}">«${k}»${inner}</section>`,
    state: (r, f) => (r && r.state === "ok" ? f(r.value) : `<p data-state="failed">«state.failed»</p>`),
    act: (op) => (act ? `<button data-act="${op}"></button>` : ""),
  };
}
const keys = (html) => [...html.matchAll(/«([^»]+)»/g)].map((m) => m[1]);
const sections = (html) => [...html.matchAll(/data-h="([^"]+)"/g)].map((m) => m[1]);
const ok = (value) => ({ state: "ok", value });

/* Every state the Screens page names (S1 codes held, S2 new codes just issued, S3 none or all used), a read that failed,
   the administrators' step while not met, and a viewer the issuing act is not offered to. */
const STATES = {
  "codes held": [{ data: { codes: ok({ held: true, remaining: 7, total: 10, issuedAt: "2026-05-01" }) } }],
  "new codes just issued": [{ data: { codes: ok({ held: true, remaining: 10, total: 10, issuedAt: "2026-05-01" }) }, ui: { codes: ["aaaa-bbbb", "cccc-dddd"] } }],
  "every code used": [{ data: { codes: ok({ held: true, remaining: 0, total: 10, issuedAt: "2026-05-01" }) } }],
  "none issued": [{ data: { codes: ok({ held: false }) } }],
  "the read failed": [{ data: { codes: { state: "failed" } } }],
  "an administrator, step not met": [{ me: { administer: true }, data: { codes: ok({ held: false }), step: ok({ met: false, administrators: 1 }) } }],
  "no issuing act": [{ data: { codes: ok({ held: false }) } }, { act: false }],
};

for (const [name, [view, o]] of Object.entries(STATES)) {
  test(`R82 recovery, ${name}: "If you lose your codes too" is drawn once, last, with its words`, () => {
    const html = recovery.render(kit(o), view);
    const k = keys(html);
    assert.equal(k.filter((x) => x === S + "lost.heading").length, 1, "the heading once");
    assert.equal(k.filter((x) => x === S + "lost.what").length, 1, "its words once");
    assert.equal(k.at(-2), S + "lost.heading", "the heading after every other part");
    assert.equal(k.at(-1), S + "lost.what", "its words last");
    assert.equal(sections(html).at(-1), S + "lost.heading", "the last section of the page");
  });
}

test("R82 recovery: the section follows the codes and the new codes, as C2, C3 and C4 order them", () => {
  const html = recovery.render(kit(), STATES["codes held"][0]);
  assert.deepEqual(sections(html), [S + "held.heading", S + "issue.heading", S + "lost.heading"]);
});

test("R82 recovery: the section asks nothing of the record and offers no act of its own", () => {
  assert.deepEqual(Object.keys(recovery.reads({})), ["codes"], "a member's reads are the codes alone");
  assert.deepEqual(Object.keys(recovery.reads({ me: { administer: true } })).sort(), ["codes", "step"]);
  assert.deepEqual(recovery.acts.map((a) => a.op), ["recoverycodesissue"]);
  const html = recovery.render(kit({ act: false }), STATES["none issued"][0]);
  const lost = html.slice(html.indexOf(`data-h="${S}lost.heading"`));
  assert.ok(!/<button|<a\b|<input/.test(lost), "no control in the section");
});

test("R82 recovery: a view with no data and no page memory still draws the section", () => {
  const k = keys(recovery.render(kit(), {}));
  assert.deepEqual(k.slice(-2), [S + "lost.heading", S + "lost.what"]);
});
