/* affordances: `op=affordances` as this module's (R17, T19), at its two interfaces: `affordancesAnswer`, the composition
   (pure), and `affordancesOp`, the door's arm, driven with a store stand-in and the control plane's envelope and silence
   answers as plain recorders, so what the arm asks of the store, with which stamps, and what it answers in each case is
   measured exactly. The same arm in the running plane, with the real door, store and gate, is `plane.test.mjs`' R17. */
import test from "node:test";
import { ANSWERS_CHECKS } from "../../../src/answers/index.mjs";
import assert from "node:assert/strict";
import { ACTS, CAPTURE_ACTS, PER_ITEM_ACTS, PER_ITEM_MAX, VOCABULARIES, decorate, deriveActs, vocabulariesFor,
         affordancesAnswer, affordancesOp, ACT_HELP } from "../../../src/affordances.mjs";
import { PRODUCT_KINDS } from "../../../src/action-grammar/index.mjs";

const GATE = { needs: (op) => (op === "attest" ? "attest" : "contribute"), mode: (op) => (op === "adminremove" ? "admin-session" : "session") };
const KINDS = [...PRODUCT_KINDS, "a_profile_kind"];
const FACTS = { ok: true, target: "INQ-2026-0001-q", object_type: "inquiry", declared_type: "inquiry", current_state: "open",
  case_member: false, basis_legs: 1, rested_on: { working: 0, frozen: 0, severed: 0 }, basis_version_states: ["suggested"],
  basis_versions: 1, actor_is_machine: false, contradiction_inquiry: false };
/* a store refusal as the control plane's answer envelope hands it on (answer-envelope's door-helpers contract: BAD_JSON) */
const REFUSED = { answered: false, refused: true, result: undefined,
  reply: { status: 400, body: { ok: false, reason: "BAD_JSON", detail: "d" } } }; // fixtures-contract: answer-envelope door-helpers

test("R17 R37: with no target, the catalogue — every act decorated through the gate with appliesTo, the vocabularies for "
   + "the kinds handed in, the capture acts and the set acts with set_key, item_keys, shared_keys and max_items", () => {
  const r = affordancesAnswer({ kinds: KINDS, gate: GATE });
  assert.deepEqual(Object.keys(r).sort(), ["answer_checks" /* K1601 */, "capture_acts", "catalog", "detail", "screens",
                                           "set_acts", "target", "vocabularies", "wizard_scripts",
                                           "writing_help_refused" /* R44 */, "act_help" /* R49 */,
                                           "dimension_onward" /* R73 */].sort());
  /* R49: what each act does, ACT_HELP itself (R48) */
  assert.equal(r.act_help, ACT_HELP);
  /* K1601: answers' check family, the very object its table holds */
  assert.equal(r.answer_checks, ANSWERS_CHECKS);
  for (const [code, row] of Object.entries(r.answer_checks))
    assert.ok(typeof row.check === "string" && typeof row.translation === "string" && row.translation.length > 0, code);
  assert.deepEqual([r.screens, r.wizard_scripts], [[], []], "nothing handed in: two lists, empty");
  assert.equal(r.target, null);
  assert.deepEqual(r.catalog, ACTS.map((a) => ({ ...decorate(a, GATE), appliesTo: a.types })));
  assert.deepEqual(r.capture_acts, CAPTURE_ACTS.map((a) => decorate(a, GATE)));
  assert.deepEqual(r.set_acts, PER_ITEM_ACTS.map((a) => ({ ...decorate(a, GATE), set_key: a.set_key, item_keys: a.item_keys,
                                                          shared_keys: a.shared_keys, max_items: PER_ITEM_MAX })));
  assert.deepEqual(r.vocabularies, vocabulariesFor(KINDS));
  assert.deepEqual(r.vocabularies.action_kind, KINDS);
  for (const k of Object.keys(VOCABULARIES)) if (k !== "action_kind") assert.equal(r.vocabularies[k], VOCABULARIES[k], k);
  assert.ok(typeof r.detail === "string" && /rung_absence/.test(r.detail) && /set_acts/.test(r.detail));
  /* K899 (1): the text a member reads says "record" where it said "bundle"; the target names a record id */
  assert.match(r.detail, /^pass target=<record id> for /);
  assert.match(r.detail, /keyed by a capture sha rather than by a record/);
  assert.doesNotMatch(r.detail, /bundle/i);
  /* a kind answer that is not a kind list publishes the product's kinds (R26) */
  assert.equal(affordancesAnswer({ kinds: undefined, gate: GATE }).vocabularies.action_kind, PRODUCT_KINDS);
});

test("R17 R11: with a target, its type, state, acts (R8–R10, decorated through the same gate by the one function) and "
   + "vocabularies, and the capture acts never filtered by the target", () => {
  const r = affordancesAnswer({ target: FACTS.target, facts: FACTS, kinds: KINDS, gate: GATE });
  assert.deepEqual(Object.keys(r).sort(), ["acts", "capture_acts", "current_state", "object_type", "target", "vocabularies"]);
  assert.deepEqual([r.target, r.object_type, r.current_state], [FACTS.target, "inquiry", "open"]);
  assert.deepEqual(r.acts, deriveActs(FACTS).map((a) => decorate(a, GATE)));
  assert.ok(r.acts.length > 0);
  assert.deepEqual(r.capture_acts, affordancesAnswer({ kinds: KINDS, gate: GATE }).capture_acts);
  assert.deepEqual(r.vocabularies, vocabulariesFor(KINDS));
});

test("R17 R13: with a target, R13's refusal is answered as given, stated not ok", () => {
  for (const f of [{ ok: false, reason: "NO_SUCH_BUNDLE", target: "X-1" }, { ok: false, reason: "NO_TARGET", detail: "d" },
                   { reason: "SOMETHING" }])
    assert.deepEqual(affordancesAnswer({ target: "X-1", facts: f, kinds: KINDS, gate: GATE }), { ...f, ok: false });
});

/* ---- the door's arm, with a store stand-in ---- */
const SCREENS = { answered: true, result: { ok: true, screens: [{ id: "case-home", acts: ["casenote"] }],
  wizard_scripts: [{ id: "WIZ-1", version: "WIZ-1@1", name: "Note", steps: [], approver: "member:alice", finished: 2 }] } };
/* R67, R68: what the active profiles add, as the store's `affordancevocab` answers it (record data: a kind's own label) */
const PROFILE = { ok: true, proceeding_kinds: [{ kind: "zoning_appeal", label: "Zoning appeal", forum_kind: "court" },
  { kind: "ethics_complaint", label: null, forum_kind: "commission" }], action_kind_labels: { a_profile_kind: "A profile kind" } };
const VOCAB = { answered: true, result: PROFILE };
const door = ({ kinds = { answered: true, result: { kinds: KINDS } }, facts = { answered: true, result: FACTS },
                screens = SCREENS, vocab = VOCAB } = {}) => {
  const asked = [];
  const stub = { fetch: (u) => { asked.push(String(u)); const s = String(u);
    return s.startsWith("http://do/actionkinds") ? kinds : s.startsWith("http://do/affordancescreens") ? screens
      : s.startsWith("http://do/affordancevocab") ? vocab : facts; } };
  const deps = {
    json: (body, status) => ({ body, status }),
    doAnswer: async (r) => r,
    storeSilent: (op, correlation) => ({ silent: op, correlation: correlation ?? null }),
    storeRefusal: (out) => ({ refusal: out }),
    gate: GATE, viewer: "member:iris", identity: "member:iris", author: "iris", by: "iris", storeName: "bio", cls: "session",
  };
  return { stub, deps, asked };
};
const at = (q) => new URL(`http://x/api/?op=affordances${q}`);

test("R17 R37: the door answers the catalogue in the control plane's envelope, having asked the store the kinds and, "
   + "for the stamped viewer, the screens and offered scripts, which it passes in unchanged", async () => {
  const { stub, deps, asked } = door();
  const r = await affordancesOp(at(""), stub, deps);
  assert.deepEqual(r, { status: 200, body: { ok: true, result: affordancesAnswer({ kinds: KINDS, gate: GATE,
    screens: SCREENS.result.screens, wizard_scripts: SCREENS.result.wizard_scripts, profile: PROFILE }), store: "bio", tokenClass: "session" } });
  assert.equal(r.body.result.screens, SCREENS.result.screens);
  assert.equal(r.body.result.wizard_scripts, SCREENS.result.wizard_scripts);
  assert.deepEqual(asked, ["http://do/actionkinds", "http://do/affordancescreens?viewer=member%3Airis", "http://do/affordancevocab"]);
  /* a targeted answer asks no screens and carries neither key */
  const t = door();
  const tr = await affordancesOp(at(`&target=${FACTS.target}`), t.stub, t.deps);
  assert.ok(!("screens" in tr.body.result) && !("wizard_scripts" in tr.body.result));
  assert.ok(!t.asked.some((u) => u.includes("affordancescreens")));
  /* R15's reading of an absent stamp: with no viewer stamped, the screens are asked with none, never `viewer=` */
  for (const viewer of [null, undefined]) {
    const n = door();
    await affordancesOp(at(""), n.stub, { ...n.deps, viewer });
    assert.deepEqual(n.asked, ["http://do/actionkinds", "http://do/affordancescreens?", "http://do/affordancevocab"], String(viewer));
  }
});

test("R37: a store silence or refusal on the screens is answered by the control plane's own answers, never as no "
   + "screens (REC-52)", async () => {
  let d = door({ screens: { answered: false, correlation: "c-2" } });
  assert.deepEqual(await affordancesOp(at(""), d.stub, d.deps), { silent: "affordances", correlation: "c-2" });
  const refused = REFUSED;
  d = door({ screens: refused });
  assert.deepEqual(await affordancesOp(at(""), d.stub, d.deps), { refusal: refused });
  d = door({ screens: { answered: true, result: null } });
  assert.deepEqual(await affordancesOp(at(""), d.stub, d.deps), { silent: "affordances", correlation: null });
});

test("R17 R15: with a target, the door asks the facts with the four stamps exactly as handed in, and answers the "
   + "target's acts in the envelope", async () => {
  const { stub, deps, asked } = door();
  const r = await affordancesOp(at(`&target=${FACTS.target}`), stub, { ...deps, viewer: "member:iris & co",
    identity: "member:pam", author: "token:member", by: "class:member" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.result, affordancesAnswer({ target: FACTS.target, facts: FACTS, kinds: KINDS, gate: GATE, profile: PROFILE }));
  const q = new URL(asked[1]).searchParams;
  assert.deepEqual(asked.length, 3);
  assert.deepEqual([q.get("target"), q.get("viewer"), q.get("identity"), q.get("author"), q.get("by")],
    [FACTS.target, "member:iris & co", "member:pam", "token:member", "class:member"]);
  /* an absent stamp (undefined or null) is left off the query, so the facts read it null (R15): never sent as "", which
     actor_is_machine would read as no identity at all; a stamp handed in, "" included, is sent as given */
  const b = door();
  await affordancesOp(at(`&target=${FACTS.target}`), b.stub, { ...b.deps, identity: undefined, author: undefined, by: null });
  const q2 = new URL(b.asked[1]).searchParams;
  assert.deepEqual([q2.has("identity"), q2.has("author"), q2.has("by"), q2.get("viewer")], [false, false, false, "member:iris"]);
  const c = door();
  await affordancesOp(at(`&target=${FACTS.target}`), c.stub, { ...c.deps, author: "" });
  assert.equal(new URL(c.asked[1]).searchParams.get("author"), "");
});

test("R17 R13: NO_SUCH_BUNDLE answers 404 and any other refusal 400, each as the store gave it, in the envelope", async () => {
  for (const [f, status] of [[{ ok: false, reason: "NO_SUCH_BUNDLE", target: "X" }, 404], [{ ok: false, reason: "NO_TARGET" }, 400]]) {
    const { stub, deps } = door({ facts: { answered: true, result: f } });
    const r = await affordancesOp(at("&target=X"), stub, deps);
    assert.deepEqual(r, { status, body: { ...f, store: "bio", tokenClass: "session" } });
  }
});

test("R17: a store silence or refusal on either question is answered by the control plane's own answers, never as a "
   + "statement about the object (REC-52)", async () => {
  const silent = { answered: false, correlation: "c-1" }, refused = REFUSED;
  let d = door({ kinds: silent });
  assert.deepEqual(await affordancesOp(at(""), d.stub, d.deps), { silent: "affordances", correlation: "c-1" });
  d = door({ kinds: refused });
  assert.deepEqual(await affordancesOp(at("&target=X"), d.stub, d.deps), { refusal: refused });
  /* N630: the facts are asked beside the kinds, a read either way; the kinds' refusal is what is answered */
  assert.deepEqual(d.asked.map((u) => new URL(u).pathname), ["/actionkinds", "/affordancefacts", "/affordancevocab"]);
  d = door({ kinds: silent, facts: refused });
  assert.deepEqual(await affordancesOp(at("&target=X"), d.stub, d.deps), { silent: "affordances", correlation: "c-1" },
    "the kinds are answered first, whatever the second question answered");
  d = door({ facts: silent });
  assert.deepEqual(await affordancesOp(at("&target=X"), d.stub, d.deps), { silent: "affordances", correlation: "c-1" });
  d = door({ facts: refused });
  assert.deepEqual(await affordancesOp(at("&target=X"), d.stub, d.deps), { refusal: refused });
  d = door({ facts: { answered: true, result: null } });
  assert.deepEqual(await affordancesOp(at("&target=X"), d.stub, d.deps), { silent: "affordances", correlation: null });
});

test("R22: the door only reads — it asks the store's four read routes and nothing else, and changes nothing it is handed", async () => {
  const { stub, deps, asked } = door();
  const before = JSON.stringify(FACTS);
  await affordancesOp(at(""), stub, deps);
  await affordancesOp(at(`&target=${FACTS.target}`), stub, deps);
  assert.deepEqual(asked.map((u) => new URL(u).pathname), ["/actionkinds", "/affordancescreens", "/affordancevocab", "/actionkinds",
    "/affordancefacts", "/affordancevocab"]);
  assert.equal(JSON.stringify(FACTS), before);
});

test("R17 R22 (N630, K1717): the door asks its questions together — the second and the profiles' are asked before the kinds have "
   + "answered — so an answer costs one store round trip, with or without a target", async () => {
  for (const q of ["", `&target=${FACTS.target}`]) {
    const d = door();
    let release;
    const held = new Promise((r) => { release = r; });
    const fetch = d.stub.fetch;
    d.stub.fetch = (u) => (String(u).startsWith("http://do/actionkinds") ? held.then(() => fetch(u)) : fetch(u));
    const pending = affordancesOp(at(q), d.stub, d.deps);
    await Promise.resolve();
    assert.deepEqual(d.asked.length, 2, `${q}: the second and third questions are asked while the kinds are outstanding`);
    assert.ok(d.asked.every((u) => !u.startsWith("http://do/actionkinds")), q);
    assert.ok(d.asked[1].startsWith("http://do/affordancevocab"), q);
    release();
    assert.equal((await pending).status, 200, q);
  }
});

test("R67 R68: both arms of the door answer the profiles' proceeding kinds and action-kind labels as the store gave them, beside "
   + "`action_kind` unchanged and every other vocabulary the same object; no vocabulary but those three moves with the profiles", async () => {
  for (const q of ["", `&target=${FACTS.target}`]) {
    const { stub, deps } = door();
    const v = (await affordancesOp(at(q), stub, deps)).body.result.vocabularies;
    assert.deepEqual(v.proceeding_kinds, PROFILE.proceeding_kinds, `${q}: in the store's order, each kind once`);
    assert.deepEqual(v.action_kind_labels, PROFILE.action_kind_labels, q);
    assert.deepEqual(v.action_kind, KINDS, `${q}: the list of kind names keeps its shape and order`);
    const bare = vocabulariesFor(KINDS);
    assert.deepEqual(Object.keys(v).filter((k) => !(k in bare)).sort(), ["action_kind_labels", "proceeding_kinds"], q);
    for (const k of Object.keys(bare)) if (k !== "action_kind")
      (k in VOCABULARIES ? assert.equal : assert.deepEqual)(v[k], bare[k], `${q}: ${k} is the same value without the profiles`);
  }
});

test("R67 R68: what the profiles add is shaped at `vocabulariesFor`: an entry without a string kind is left out, a label that is not "
   + "a string is null, a labelled kind with an empty label is left out, and a key not answered as its shape is absent, never empty", () => {
  const v = vocabulariesFor(KINDS, { proceeding_kinds: [{ kind: "a_kind", label: "A", forum_kind: "court" }, { label: "no kind" },
    { kind: 7 }, null, { kind: "b_kind", label: 4, forum_kind: "auditor" }],
  action_kind_labels: { with_label: "Labelled", empty: "", blank: "  ", number: 3 } });
  assert.deepEqual(v.proceeding_kinds, [{ kind: "a_kind", label: "A", forum_kind: "court" }, { kind: "b_kind", label: null, forum_kind: "auditor" }]);
  assert.deepEqual(v.action_kind_labels, { with_label: "Labelled" });
  assert.deepEqual(vocabulariesFor(KINDS, { proceeding_kinds: [], action_kind_labels: {} }).proceeding_kinds, [], "no profile: []");
  assert.deepEqual(vocabulariesFor(KINDS, { proceeding_kinds: [], action_kind_labels: {} }).action_kind_labels, {}, "no profile: {}");
  for (const p of [undefined, null, {}, { proceeding_kinds: "x", action_kind_labels: [] }, { proceeding_kinds: {}, action_kind_labels: "y" }, "z"]) {
    const w = vocabulariesFor(KINDS, p);
    assert.equal(Object.hasOwn(w, "proceeding_kinds"), false, JSON.stringify(p));
    assert.equal(Object.hasOwn(w, "action_kind_labels"), false, JSON.stringify(p));
    assert.deepEqual(w.action_kind, KINDS, "every other vocabulary is unchanged");
  }
});

test("R67 R68: a store that does not answer the profiles' read — a silence, a refusal, an answer of another shape or no answer — leaves "
   + "those keys out of the answer and answers everything else unchanged, on both arms (never `[]`, never a refusal of the answer)", async () => {
  for (const vocab of [{ answered: false, correlation: "c-9" }, REFUSED, { answered: true, result: null },
                       { answered: true, result: FACTS }, { answered: true, result: { ok: false } }, { answered: true, result: { ok: true } }]) {
    for (const q of ["", `&target=${FACTS.target}`]) {
      const d = door({ vocab });
      const r = await affordancesOp(at(q), d.stub, d.deps);
      assert.equal(r.status, 200, `${q}: ${JSON.stringify(vocab)}`);
      const v = r.body.result.vocabularies;
      assert.equal(Object.hasOwn(v, "proceeding_kinds"), false);
      assert.equal(Object.hasOwn(v, "action_kind_labels"), false);
      assert.deepEqual(v, vocabulariesFor(KINDS));
    }
  }
});
