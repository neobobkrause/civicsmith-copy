/* Settings › Glossary at the module's interface (R59; T51; K3807; DEC-330 A11; DEC-335, DEC-336 (8)): every group, term and state row
   is drawn from its key and the module holds no sentence of it; it reads nothing and calls no op. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, has, lacks, open, said, textOf, storeWorld } from "./kit.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

const MONEY = ["acfr", "cafr", "gpf", "fy"], HONEST = ["fingerprint", "timestamp", "signature", "manifest", "provenance"];
const STATES = ["review", "reviewed", "retired", "open", "concluded", "deferred", "dismissed", "divided", "published", "waiting", "planned", "active", "resolved", "abandoned", "flagged", "watched"];
/** The world's two kinds of session: the founder (its administrator) and dev (a member who does not administer). */
async function sessions() {
  const w = await storeWorld();
  return { w, founder: await w.signIn("founder"), dev: await w.signIn("dev") };
}
const section = (o, key) => all(o.tree, (e) => e.tag === "section" && all(e, (h) => h.tag === "h2").some((h) => textOf(h) === said(key)))[0];
const rowsOf = (sec) => all(sec, (e) => e.tag === "div" && /\bcs-row\b/.test(e.attrs.class || ""));

test("R59 the glossary draws the title and its sub-line, how a term explains itself, two groups of terms each with its name and its definition, the states and the note about a document's own terms", async () => {
  const { w, founder, dev } = await sessions();
  for (const as of [founder, dev]) {
    const a = await open("glossary", { world: w, as });
    assert.ok(all(a.tree, (e) => e.tag === "h1" && textOf(e) === said("screen.glossary.name")).length === 1, "the title");
    for (const k of ["screen.glossary.sub", "screen.glossary.intro", "screen.glossary.documentterms"]) has(a, k);
    const money = section(a, "screen.glossary.money.heading"), honest = section(a, "screen.glossary.honest.heading");
    assert.ok(money && honest);
    for (const t of MONEY) { const r = rowsOf(money).find((x) => textOf(x).includes(said("glossary.term." + t))); assert.ok(r, t); assert.ok(textOf(r).includes(said("screen.glossary.money." + t)), `${t}'s definition`); }
    for (const t of HONEST) { const r = rowsOf(honest).find((x) => textOf(x).includes(said("glossary.term." + t))); assert.ok(r, t); assert.ok(textOf(r).includes(said("screen.glossary.honest." + t)), `${t}'s definition`); }
    assert.equal(rowsOf(money).length, MONEY.length);
    assert.equal(rowsOf(honest).length, HONEST.length);
  }
});

test("R59 what each state allows: one row for each of the sixteen item states, its chip or name, what it means, and what a member can and cannot then do where the words hold it", async () => {
  const { w, dev } = await sessions();
  const a = await open("glossary", { world: w, as: dev });
  const rows = rowsOf(section(a, "screen.glossary.states.heading"));
  assert.equal(rows.length, 16);
  STATES.forEach((k, i) => {
    const t = textOf(rows[i]).replace(/\s+/g, " ");
    assert.ok(t.includes(said("state.item." + k + ".name")), `${k}'s name`);
    assert.ok(t.includes(said("state.item." + k + ".means")), `${k}'s meaning`);
    assert.ok(t.includes(said("state.item." + k + ".can")), `${k} can`);
    if (hasWord("state.item." + k + ".cannot")) assert.ok(t.includes(said("state.item." + k + ".cannot")), `${k} cannot`);
    else assert.ok(!/cannot/.test(t), `${k} holds no cannot`);
    // each state is a chip that explains itself (interface-shell R95: the kit's `cs.stateChip` covers all sixteen): its name, and what it means
    const chips = all(rows[i], (e) => /\bmk-chip\b/.test(e.attrs.class || ""));
    assert.equal(chips.length, 1, `${k} is a chip`);
    assert.equal(textOf(chips[0]).trim(), said("state.item." + k + ".name"));
    assert.ok(chips[0].attrs["data-tip"].includes(said("state.item." + k + ".means").slice(0, 20)), `${k}'s chip explains`);
  });
});

test("R59 control: it reads nothing and calls no op, draws no act, and is registered in the module's screens", async () => {
  const { w, founder } = await sessions();
  const a = await open("glossary", { world: w, as: founder });
  // nothing but the frame's own reads (the assistant's state, interface-shell R20) is sent
  assert.deepEqual(a.p.requests.map((r) => r.op).filter((op) => !["assistantstate", "aipathready"].includes(op)), [], "no request is sent");
  assert.deepEqual(acts(a.tree), []);
  assert.deepEqual(a.s.acts, []);
  assert.deepEqual(a.s.reads({ me: founder }), {});
});
