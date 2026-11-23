/* queue R92 (T51; K4168, K4202): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. The calls go through `queueOps`, as the plane's one
   route map does, over a world with a member who has joined a project. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { declaredOpHolds, declaredOpsOf } from "../../declared-ops.mjs";
import { DECLARED_OPS, queueOps } from "../../../src/queue/index.mjs";
import { world, NOW } from "./world.mjs";

const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
/* a refusal names a field by a word of its code or detail, or by a code the table gives for it; an answer that succeeded
   refuses nothing, whatever its detail says */
const named = (codes = {}) => (answer, field) => {
  if (!answer || typeof answer !== "object" || answer.ok === true) return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c)) return true;
  return new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.reason, answer.detail].map(words).join(" "));
};
const setup = () => {
  const w = world();
  w.member("alice"); w.bundle("PRJ-1", "project"); w.join("PRJ-1", "alice"); w.bundle("INQ-1", "inquiry");
  return w;
};
/* the call as the door runs it: the stamps in the address, the fields as the body, the arm asked of a fresh world */
const mk = (op, stamps) => async (fields) => {
  const w = setup();
  const url = new URL("http://x/?" + new URLSearchParams({ op, ...stamps }));
  return queueOps(w.q, url, fields)[op]();
};
const ALICE = { member: "alice", viewer: "member:alice", identity: "member:alice" };

test("R92 queue declares proposedispose: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "proposedispose", declaration: DECLARED_OPS.proposedispose,
    call: async (fields) => { const w = setup(); const url = new URL("http://x/?" + new URLSearchParams({ op: "proposedispose", ...ALICE }));
                              return queueOps(w.q, url, { ...fields, decidedBy: "alice" }).proposedispose(); },
    refusedNaming: named({ to: ["NOT_A_DISPOSITION"] }),
    values: { project: "PRJ-1", finding: "FINDING::stance-changed-here-not-elsewhere::INQ-1::PRJ-1", to: "dismissed", reason: "not worth pursuing" },
    same: sameCode });
});

test("R92 queue declares queuemute: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "queuemute", declaration: DECLARED_OPS.queuemute, call: mk("queuemute", ALICE), refusedNaming: named(),
    values: { item: "FINDING::source-modified::DOC-1", case: "PRJ-1" }, same: sameCode });
});

test("R92 queue declares queuesnooze: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "queuesnooze", declaration: DECLARED_OPS.queuesnooze, call: mk("queuesnooze", ALICE), refusedNaming: named(),
    values: { case: "PRJ-1", until: new Date(NOW + 86400000).toISOString() }, same: sameCode });
});

/* queue R92: the ops are declared here. The owners' declarations, collected from the module order up to queue and no later
   (test-support's `declaredOpsOf`), hold the three ops as queue's own, each exactly as this module exports it, and no earlier
   owner declares any of them. Their agreement with the hand rows of `op-declarations` and `op-grades` is proven by
   op-declarations' `owners.test.mjs` (its R80, R81), which reads this module's export. */
test("R92 the owners' declarations, found from the module order up to queue, hold proposedispose, queuemute and queuesnooze as queue's own, declared by no earlier owner", async () => {
  const { ops, owners, duplicates } = await declaredOpsOf(fileURLToPath(new URL("../../../../", import.meta.url)), "queue");
  assert.deepEqual(Object.keys(DECLARED_OPS).sort(), ["proposedispose", "queuemute", "queuesnooze"]);
  for (const op of ["proposedispose", "queuemute", "queuesnooze"]) {
    assert.equal(owners[op], "queue", op);
    assert.deepEqual(ops[op], DECLARED_OPS[op], op);
    assert.deepEqual(duplicates.filter((d) => d.op === op), [], op);
  }
});

test("R92 each declaration carries its classes, mutating and weight: proposedispose reasoned, the two personal ops caller-owned, all three mutating", () => {
  for (const op of ["proposedispose", "queuemute", "queuesnooze"]) {
    const d = DECLARED_OPS[op];
    assert.ok(Array.isArray(d.classes) && d.classes.length > 0, op);
    assert.equal(d.mutating, true, op);
  }
  assert.equal(DECLARED_OPS.proposedispose.weight, "reasoned");
  assert.equal(DECLARED_OPS.queuemute.weight, "caller-owned");
  assert.equal(DECLARED_OPS.queuesnooze.weight, "caller-owned");
});

test("R92 proposedispose accepts definitionVersion, the field its instance arm reads (the disposition's `requires`), never the snake-case definition_version", () => {
  assert.ok(DECLARED_OPS.proposedispose.fields.accepts.includes("definitionVersion"));
  assert.ok(!DECLARED_OPS.proposedispose.fields.accepts.includes("definition_version"));
});

test("R92: each description is read by key, queue.declared.proposedispose, queue.declared.queuemute and queue.declared.queuesnooze: a sentence the word list answers for that id once it holds it", async () => {
  const W = await import("../../../src/setup-words/index.mjs");
  for (const op of ["proposedispose", "queuemute", "queuesnooze"]) {
    const d = DECLARED_OPS[op].description;
    assert.equal(typeof d, "string");
    assert.ok(d.trim().length > 0, op);
    if (W.hasWord(`queue.declared.${op}`)) assert.equal(W.word(`queue.declared.${op}`), d, `${op}: the word list's sentence`);
  }
});

/* queue R92 (T51 fix round, B8 / K4238): a SET of proposedispose names each item's identity in `items` and shares the disposition
   and the reason at the top level (queue-states' set arm; `#perItem` spreads the shared fields onto every item). So `items` is an
   alternative for the identity groups, and `to` and `reason` stay required at the top level. The set's declaration is held true
   the same way as the single's: only its requires, each missing one refused naming it, a field outside accepts dropped or refused. */
test("R92 queue declares proposedispose's set form: `items` satisfies the identity groups, the disposition and the reason stay top-level", async () => {
  /* a set's refusal names a field either at the top or in the item it retained (its own act's refusal, `items[]`) */
  const inSet = (answer, field) => named({ to: ["NOT_A_DISPOSITION"] })(answer, field)
    || (Array.isArray(answer?.items) && answer.items.some((i) => named({ to: ["NOT_A_DISPOSITION"] })(i, field)));
  /* the module's own declaration names the set form: each identity group carries `items`, and `to`/`state` and `reason` stay as they are */
  const { accepts, requires } = DECLARED_OPS.proposedispose.fields;
  assert.ok(requires[0].includes("items") && requires[1].includes("items"), "the identity groups take `items`");
  assert.deepEqual(requires[2], ["to", "state"]);
  assert.equal(requires[3], "reason");
  /* the set's form is the same declaration with `items` first, so the helper's base is a set (it reads each group's first name) */
  const setDeclaration = { ...DECLARED_OPS.proposedispose, fields: { accepts,
    requires: [["items", ...requires[0].filter((k) => k !== "items")], ["items", ...requires[1].filter((k) => k !== "items")], requires[2], requires[3]] } };
  await declaredOpHolds({ op: "proposedispose", declaration: setDeclaration,
    call: async (fields) => { const w = setup(); const url = new URL("http://x/?" + new URLSearchParams({ op: "proposedispose", ...ALICE }));
                              return queueOps(w.q, url, { ...fields, decidedBy: "alice" }).proposedispose(); },
    refusedNaming: inSet,
    values: { items: [{ project: "PRJ-1", finding: "FINDING::stance-changed-here-not-elsewhere::INQ-1::PRJ-1" }],
              to: "dismissed", reason: "not worth pursuing" },
    same: sameCode });
});

test("R92 control: proposedispose with neither a project, a key, a progression nor items is refused, naming the identity it lacks", async () => {
  const w = setup();
  const url = new URL("http://x/?" + new URLSearchParams({ op: "proposedispose", ...ALICE }));
  const answer = queueOps(w.q, url, { to: "dismissed", reason: "not worth pursuing", decidedBy: "alice" }).proposedispose();
  assert.equal(answer.ok, false);
  assert.equal(answer.code, "NO_KEY");
  assert.match(answer.detail, /progressionKey/);
});

test("R92 control: a set whose items carry no reason is refused whole, the reason named on each retained item", async () => {
  const w = setup();
  const url = new URL("http://x/?" + new URLSearchParams({ op: "proposedispose", ...ALICE }));
  const answer = queueOps(w.q, url, { items: [{ project: "PRJ-1", finding: "FINDING::stance-changed-here-not-elsewhere::INQ-1::PRJ-1" }],
                                       to: "dismissed", decidedBy: "alice" }).proposedispose();
  assert.equal(answer.ok, false);
  assert.equal(answer.applied, 0);
  assert.equal(answer.items[0].reason, "NO_REASON");
});
