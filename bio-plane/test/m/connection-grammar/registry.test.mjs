/* connection-grammar at its interface: the owner registry (R2–R5). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as cg from "../../../src/connection-grammar/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

/** @import { KindSpec, Refusal } from "../../../src/connection-grammar/shape.mjs" */

const { createRegistry } = cg;
/** An owner's read that answers no items. */
const nb = () => ({ items: [] });
/**
 * A kind as an owner registers it.
 * @param {string} kind
 * @param {string} [word]
 * @param {string} [cls]
 * @returns {KindSpec}
 */
const k = (kind, word = "linked to", cls = "evidentiary") => ({ kind, word, class: cls });
/**
 * The refusal a registration answers, or null where it registered.
 * @param {{ok: boolean, owner: string} | Refusal} res
 * @returns {Refusal | null}
 */
const refusalOf = (res) => ("refused" in res ? res : null);
/**
 * Whether a registration registered.
 * @param {{ok: boolean, owner: string} | Refusal} res
 * @returns {boolean}
 */
const registered = (res) => "ok" in res && res.ok;

test("R2 registers an owner once, each kind with its class and members' word", () => {
  const r = createRegistry();
  assert.deepEqual(r.registerOwner({ owner: "lines", kinds: [k("holds", "holds the seat"), k("part_of", "part of", "declared")], neighbours: nb }),
    { ok: true, owner: "lines" });
  for (const cls of ["evidentiary", "derived", "declared", "hunch"]) {
    assert.equal(registered(r.registerOwner({ owner: `o-${cls}`, kinds: [k(`k-${cls}`, "w", cls)], neighbours: nb })), true, cls);
  }
  assert.deepEqual(cg.CLASSES, ["evidentiary", "derived", "declared", "hunch"]);
});

test("R2 refusals name their kind of no and leave nothing registered", () => {
  const r = createRegistry();
  r.registerOwner({ owner: "events", kinds: [k("within")], neighbours: nb });
  const before = JSON.stringify(r.owners());
  /** @type {[unknown, string, string][]} */
  const cases = [
    [{ owner: "events", kinds: [k("other")], neighbours: nb }, "OWNER_DUPLICATE", ""],
    [{ owner: "lines", kinds: [k("fresh"), k("within")], neighbours: nb }, "KIND_TAKEN", "events"],
    [{ owner: "lines", kinds: [k("a"), k("a")], neighbours: nb }, "KIND_TAKEN", ""],
    [{ owner: "lines", kinds: [k("a", "w", "suspicion")], neighbours: nb }, "CLASS_UNKNOWN", ""],
    [{ owner: "lines", kinds: [k("a", "")], neighbours: nb }, "WORD_MISSING", ""],
    [{ owner: "lines", kinds: [{ kind: "a", class: "derived" }], neighbours: nb }, "WORD_MISSING", ""],
    [{ owner: "lines", kinds: [k("a")] }, "NEIGHBOURS_MISSING", ""],
    [{ owner: "lines", kinds: [k("a")], neighbours: "read" }, "NEIGHBOURS_MISSING", ""],
    [{ owner: "", kinds: [k("a")], neighbours: nb }, "OWNER_MISSING", ""],
    [{ owner: "lines", kinds: [], neighbours: nb }, "KINDS_MISSING", ""],
    [{ owner: "lines", kinds: [{ word: "w", class: "derived" }], neighbours: nb }, "KIND_MISSING", ""],
    [undefined, "OWNER_MISSING", ""],
  ];
  for (const [arg, code, names] of cases) {
    const res = refusalOf(r.registerOwner(arg));
    assert.equal(res?.refused, code, JSON.stringify(arg));
    const why = res?.why;
    assert.ok(typeof why === "string" && why.length);
    if (names) assert.ok(why.includes(names), `${code} names ${names}`);
    assert.equal(JSON.stringify(r.owners()), before, `${code} registers nothing`);
    assert.equal(r.kindOf("fresh"), null);
  }
});

test("R3 a word saying knows, network, conflict, suspicious or most connected, in any case, is refused WORD_FORBIDDEN", () => {
  const r = createRegistry();
  for (const w of ["knows", "Network of", "in CONFLICT with", "suspicious link", "Most Connected", "who KNOWS whom"]) {
    const res = refusalOf(r.registerOwner({ owner: "people", kinds: [k("tie", w)], neighbours: nb }));
    assert.equal(res?.refused, "WORD_FORBIDDEN", w);
    assert.equal(r.kindOf("tie"), null);
  }
  assert.equal(registered(r.registerOwner({ owner: "people", kinds: [k("tie", "worked with")], neighbours: nb })), true);
});

test("R4 owners lists every owner and its kinds in registration order; kindOf answers the entry or null; neither throws", () => {
  const r = createRegistry();
  assert.deepEqual(r.owners(), []);
  r.registerOwner({ owner: "b-owner", kinds: [k("b1", "bee"), k("b2", "bee two", "derived")], neighbours: nb });
  r.registerOwner({ owner: "a-owner", kinds: [k("a1", "ay", "hunch")], neighbours: nb });
  assert.deepEqual(r.owners(), [
    { owner: "b-owner", kinds: [k("b1", "bee"), k("b2", "bee two", "derived")] },
    { owner: "a-owner", kinds: [k("a1", "ay", "hunch")] },
  ]);
  assert.deepEqual(r.kindOf("b2"), { owner: "b-owner", word: "bee two", class: "derived" });
  assert.deepEqual(r.kindOf("a1"), { owner: "a-owner", word: "ay", class: "hunch" });
  for (const v of ["nobody", undefined, null, 3, "__proto__", "constructor", {}]) assert.equal(r.kindOf(v), null, String(v));
  // What a caller gets back is a copy: changing it changes nothing held.
  const o = r.owners();
  const first = o[0]?.kinds[0];
  assert.ok(first);
  first.word = "changed"; o.pop();
  assert.equal(r.kindOf("b1")?.word, "bee");
  assert.equal(r.owners().length, 2);
});

test("R7 a read with no viewer is refused VIEWER_MISSING, its reason read by connection-grammar.registry.viewer_missing", () => {
  const a = createRegistry().neighbours({ owner: "nobody", node: "ENT-2026-0001", at: null, viewer: undefined, scope: null });
  assert.ok("refused" in a);
  assert.equal(a.refused, "VIEWER_MISSING");
  assert.equal(a.why, localize("connection-grammar.registry.viewer_missing",
    "a read names the member reading; an absent viewer is neither an administrator nor the public"));
});

test("R5 each registry is its own; the default registry is one the plane wires, with the same services", () => {
  const a = createRegistry(), b = createRegistry();
  a.registerOwner({ owner: "x", kinds: [k("kx")], neighbours: nb });
  assert.deepEqual(b.owners(), []);
  assert.equal(b.kindOf("kx"), null);
  assert.equal(registered(b.registerOwner({ owner: "x", kinds: [k("kx")], neighbours: nb })), true, "the same owner and kind are free in another");
  assert.deepEqual(cg.owners(), [], "neither touched the default");
  const d = cg.defaultRegistry;
  /** @type {[string, unknown, unknown][]} */
  const services = [["registerOwner", cg.registerOwner, d.registerOwner], ["owners", cg.owners, d.owners], ["kindOf", cg.kindOf, d.kindOf],
    ["checkConnection", cg.checkConnection, d.checkConnection], ["neighbours", cg.neighbours, d.neighbours]];
  for (const [f, service, held] of services) {
    assert.equal(typeof service, "function", f);
    assert.equal(service, held, f);
  }
  assert.equal(registered(cg.registerOwner({ owner: "default-owner", kinds: [k("kd")], neighbours: nb })), true);
  assert.deepEqual(cg.kindOf("kd"), { owner: "default-owner", word: "linked to", class: "evidentiary" });
  assert.equal(a.kindOf("kd"), null);
  assert.ok(Object.isFrozen(a), "a registry's services cannot be replaced");
});
