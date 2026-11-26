/* connection-grammar at its interface: the neighbours contract (R6–R8), through a registry's read, which passes the
   arguments to the owner unchanged and refuses an answer that breaks the contract whole. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRegistry, BOUNDS, ownerConformance } from "../../../src/connection-grammar/index.mjs";
import { validAt, reasonText } from "../../../src/civil-time/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { KINDS, NODE, HUB, AT, INQUIRY, makeNeighbours, fixture, valid, tie } from "./fixtures/owner.mjs";
import { isObj } from "../../../src/connection-grammar/raw.mjs";
import { answerOf, refusalOf } from "./fixtures/reads.mjs";
/** @import { Connection, Registry } from "../../../src/connection-grammar/shape.mjs" */
/** @import { ReadAnswer, ReadRefusal, ReadExtra } from "./fixtures/reads.mjs" */

/**
 * A registry with the sample owner, breaking the rule named.
 * @param {string} [broken]
 */
const withOwner = (broken) => {
  const r = createRegistry();
  const res = r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(broken) });
  assert.equal("ok" in res && res.ok, true);
  return r;
};
/**
 * One read of the sample owner at the fixture's node, as Alice, within the fixture's inquiry, changed by `extra`.
 * @param {Registry} r
 * @param {ReadExtra} [extra]
 * @returns {ReadAnswer}
 */
const read = (r, extra = {}) => r.neighbours({ owner: "sample", node: NODE, kinds: KINDS.map((k) => k.kind), at: AT, viewer: "alice", scope: INQUIRY, ...extra });
/**
 * Every page of one read, joined.
 * @param {Registry} r
 * @param {ReadExtra} [extra]
 * @returns {Connection[]}
 */
const all = (r, extra = {}) => {
  /** @type {Connection[]} */
  const items = [];
  /** @type {unknown} */
  let page;
  for (;;) {
    const a = answerOf(read(r, { ...extra, page }));
    items.push(...a.items);
    const next = a.next;
    if (next === undefined) return items;
    page = next;
  }
};
/**
 * Every page until one is refused; the refusal, or null.
 * @param {Registry} r
 * @param {ReadExtra} [extra]
 * @returns {ReadRefusal | null}
 */
const firstRefusal = (r, extra = {}) => {
  /** @type {unknown} */
  let page;
  for (;;) {
    const a = read(r, { ...extra, page });
    const no = refusalOf(a);
    if (no) return no;
    const next = "next" in a ? a.next : undefined;
    if (next === undefined) return null;
    page = next;
  }
};
/**
 * The checks a battery's answer failed, each once.
 * @param {{failures: {check: string, why: string}[]}} res
 * @returns {string[]}
 */
const checks = (res) => [...new Set(res.failures.map((f) => f.check))];
/**
 * The first failure's reason, for an assertion's message.
 * @param {ReadRefusal | null} a
 * @returns {string}
 */
const firstWhy = (a) => String(a?.failures[0]?.why);

test("R6 R19 items are the owner's own connections in the shape, at the node, evaluated at the date, paged within the fan-out", () => {
  const r = withOwner();
  const items = all(r);
  const ids = items.map((i) => i.id);
  assert.deepEqual(ids.sort(), fixture().expected.sort(), "the pages joined are the whole set");
  for (const i of items) {
    assert.deepEqual(r.checkConnection(i), { ok: true });
    assert.ok(i.from === NODE || i.to === NODE);
  }
  assert.ok(!ids.includes("c-out"), "one out at the date is not returned");
  assert.ok(items.find((i) => i.id === "c-undetermined")?.undetermined?.why, "one undetermined is returned marked so");
  assert.equal(items.find((i) => i.id === "c-in")?.undetermined, undefined);
  // Only the kinds asked.
  assert.ok(all(r, { kinds: ["sample_said"] }).every((i) => i.kind === "sample_said"));
  // A hub is named by its set size, with no items.
  const h = answerOf(read(r, { node: HUB }));
  assert.deepEqual(h.items, []);
  const hub = h.hub;
  assert.ok(hub && hub.set_size > BOUNDS.hub && hub.why);
  // The owner receives exactly the caller's arguments, viewer and scope included.
  /** @type {unknown[]} */
  const seen = [];
  const r2 = createRegistry();
  r2.registerOwner({ owner: "spy", kinds: [{ kind: "spy_k", word: "w", class: "evidentiary" }], neighbours: (/** @type {unknown} */ a) => { seen.push(a); return { items: [] }; } });
  const args = { node: NODE, kinds: ["spy_k"], at: AT, page: 3, viewer: { member: "m-1" }, scope: null };
  r2.neighbours({ owner: "spy", ...args });
  assert.deepEqual(seen, [args]);
  const first = seen[0];
  assert.equal(isObj(first) ? first.viewer : undefined, args.viewer, "unchanged, the same value");
});

test("R19 R6 an answer that breaks the contract is refused whole as OWNER_NONCONFORMING, naming the check, never trimmed; a missing owner or a throw is refused", () => {
  /** @type {[string, string][]} */
  const rules = [["out", "at"], ["unmarked", "at"], ["kinds", "kinds"], ["foreign", "kinds"], ["nodeless", "node"],
    ["partialhub", "hub"], ["fanout", "fanout"], ["derived", "derived_id"], ["label", "label"], ["async", "answer"]];
  for (const [broken, check] of rules) {
    const r = withOwner(broken);
    const node = broken === "partialhub" || broken === "fanout" ? HUB : NODE;
    const kinds = broken === "kinds" ? ["sample_said"] : KINDS.map((k) => k.kind);
    const a = firstRefusal(r, { node, kinds });
    assert.equal(a?.refused, "OWNER_NONCONFORMING", broken);
    const why = a?.why;
    assert.ok(typeof why === "string" && why.length && a?.failures.some((f) => f.check === check), `${broken}: ${check}`);
    assert.equal(a?.items, false, "no partial items");
  }
  const t = refusalOf(read(withOwner("throws")));
  assert.equal(t?.refused, "OWNER_FAILED");
  assert.match(String(t?.why), /the store is closed/);
  assert.equal(refusalOf(createRegistry().neighbours({ owner: "nobody", node: NODE, at: AT, viewer: "a", scope: null }))?.refused, "OWNER_UNKNOWN");
});

test("R7 sight: a fenced item reaches only the viewer who may see it, uncounted for the other; a missing viewer is refused", () => {
  const r = withOwner();
  const alice = all(r).map((i) => i.id);
  const bob = all(r, { viewer: "bob" }).map((i) => i.id);
  assert.ok(alice.includes("c-fenced"));
  assert.ok(!bob.includes("c-fenced"));
  assert.equal(bob.length, alice.length - 1, "its existence does not show in the count");
  let called = 0;
  const spy = createRegistry();
  spy.registerOwner({ owner: "spy", kinds: [{ kind: "k", word: "w", class: "evidentiary" }], neighbours: () => { called++; return { items: [] }; } });
  for (const viewer of [undefined, null, ""]) {
    const a = refusalOf(spy.neighbours({ owner: "spy", node: NODE, at: AT, viewer, scope: null }));
    assert.equal(a?.refused, "VIEWER_MISSING");
    const why = a?.why;
    assert.ok(typeof why === "string" && why.length);
  }
  assert.equal(called, 0, "no owner is read for a missing viewer (R19)");
  // The battery holds every owner to the same: the owner's own sight, and its own refusal of a missing viewer.
  assert.ok(checks(ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours("sight"), fixture: fixture() })).includes("sight"));
  assert.ok(checks(ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours("viewer"), fixture: fixture() })).includes("sight"));
});

test("R8 scope: a hunch only within the working inquiry that holds it; other classes do not depend on scope", () => {
  const r = withOwner();
  const inScope = all(r);
  assert.ok(inScope.some((i) => i.id === "c-guess"));
  for (const scope of [null, "INQ-2026-0002-another"]) {
    const got = all(r, { scope });
    assert.ok(!got.some((i) => i.kind === "sample_guess"), String(scope));
    assert.deepEqual(got.map((i) => i.id), inScope.filter((i) => i.kind !== "sample_guess").map((i) => i.id), "the rest unchanged");
  }
  const bad = firstRefusal(withOwner("scope"), { scope: null });
  assert.equal(bad?.refused, "OWNER_NONCONFORMING");
  assert.ok(bad?.failures.some((f) => f.check === "scope"));
});

test("R20 R19 an owner may add unread: [{what, why}], carried unchanged; an answer without it states nothing unread; a malformed one is refused whole", () => {
  const unread = [{ what: "the council's votes table", why: "the table is held and not read by this owner's index" }];
  const r = createRegistry();
  r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(undefined, { unread }) });
  /** @type {unknown} */
  let page;
  for (;;) {
    const a = answerOf(read(r, { page }));
    assert.deepEqual(a.unread, unread, "carried unchanged on every page");
    const next = a.next;
    if (next === undefined) break;
    page = next;
  }
  const spy = createRegistry();
  const answer = { items: [], unread: [{ what: "w", why: "y" }] };
  spy.registerOwner({ owner: "spy", kinds: [{ kind: "k", word: "w", class: "evidentiary" }], neighbours: () => answer });
  assert.equal(spy.neighbours({ owner: "spy", node: NODE, at: AT, viewer: "a", scope: null }), answer, "the owner's answer itself, not a copy or a trim");
  assert.equal(Object.hasOwn(read(withOwner()), "unread"), false, "no unread is added to an answer without one");
  for (const bad of [{}, "a table", [{ what: "w" }], [{ what: "", why: "y" }], [{ what: "w", why: 3 }], [null]]) {
    const b = createRegistry();
    b.registerOwner({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(undefined, { unread: bad }) });
    const a = refusalOf(read(b));
    assert.equal(a?.refused, "OWNER_NONCONFORMING", JSON.stringify(bad));
    assert.ok(a?.failures.some((f) => f.check === "unread"));
    assert.equal(a?.items, false, "never trimmed");
  }
  // The battery holds every owner to the same.
  assert.equal(ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(undefined, { unread }), fixture: fixture() }).ok, true);
  const bad = ownerConformance({ owner: "sample", kinds: KINDS, neighbours: makeNeighbours(undefined, { unread: [{ what: "w" }] }), fixture: fixture() });
  assert.ok(checks(bad).includes("unread"));
});

test("R6 an undetermined item not marked so breaks the at rule, its reason read by connection-grammar.reads.name_is_undetermined_at_the", () => {
  const a = firstRefusal(withOwner("unmarked"));
  assert.equal(a?.refused, "OWNER_NONCONFORMING");
  /** @type {string} */
  const why = reasonText(validAt({ valid: valid("2025-01-01", null) }, AT).why);
  assert.ok(a?.failures.some((f) => f.check === "at" && f.why === localize("connection-grammar.reads.name_is_undetermined_at_the",
    "{name} is undetermined at the date asked and is not marked undetermined: {why}", { name: "c-undetermined", why })), firstWhy(a));
});

test("R6 an undetermined item marked with a reason the word list cannot fill is refused, its reason read by connection-grammar.reads.reason_not_filled", () => {
  const bad = { ...tie("c-u", NODE, "ENT-2026-0002", valid("2025-01-01", null)), undetermined: { why: "a string, not a reason" } };
  const r = createRegistry();
  r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: () => ({ items: [bad] }) });
  const a = refusalOf(read(r));
  assert.equal(a?.refused, "OWNER_NONCONFORMING");
  assert.ok(a?.failures.some((f) => f.check === "at" && f.why === localize("connection-grammar.reads.reason_not_filled",
    "{name} is marked undetermined, but its reason is not a key with the vars the word list fills, nor a localize id", { name: "c-u" })), firstWhy(a));
});

test("R20 an unread entry missing what or why is refused, its shape read by connection-grammar.reads.unread_shape", () => {
  const r = createRegistry();
  r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: () => ({ items: [], unread: [{ what: "w" }] }) });
  const a = refusalOf(read(r));
  assert.equal(a?.refused, "OWNER_NONCONFORMING");
  assert.ok(a?.failures.some((f) => f.check === "unread" && f.why === localize("connection-grammar.reads.unread_shape",
    "unread is a list of entries, each with a non-empty what and a non-empty why")), firstWhy(a));
});

test("R6 a hub answered with items is refused, its reason read by connection-grammar.reads.hub_with_items", () => {
  const r = createRegistry();
  r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: () => ({ items: [tie("c-x", NODE, "ENT-2026-0002")], hub: { set_size: 5000, why: "a hub" } }) });
  const a = refusalOf(read(r));
  assert.equal(a?.refused, "OWNER_NONCONFORMING");
  assert.ok(a?.failures.some((f) => f.check === "hub" && f.why === localize("connection-grammar.reads.hub_with_items",
    "a hub is answered with no items, never a partial set shown as whole")), firstWhy(a));
});
