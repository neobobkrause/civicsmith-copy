/* screens-public T53 (JOURNEYS, DEC-479): the doorbell's receipt (R86), over the real doorbell's answer.
 * The code lives in bio-plane/src/screens-publish/ until a job of this module moves it; the drawing is screens-publish's fixture. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, openWorld, drew, ok, word, norm, choose as chooseIn, press as pressIn } from "../screens-publish/fixtures.mjs";

const choose = (p, id) => chooseIn(p, id, new Uint8Array([111, 107]));
const press = (p) => pressIn(p, "knock");
const tick = (p, id, v) => { p.doc.getElementById(id).querySelectorAll("input").forEach((b) => { if (b.value === v) b.checked = true; }); };
const at = (el, key, vars) => norm(el.textContent).indexOf(norm(word(key, vars)));

test("R86: 'What to keep' stands above the reference, then the fingerprint, size, pseudonym and made phrase", async () => {
  const p = await openWorld("/app/doorbell");
  choose(p, "db-file");
  tick(p, "db-make", "make");
  await press(p);
  const a = p.answered("knock");
  const r = p.doc.querySelector("[data-receipt]");
  assert.ok(r, "a receipt is drawn");
  const order = [
    at(r, "screen.doorbell.after.head"),
    at(r, "screen.doorbell.reference", { reference: a.knockId }),
    at(r, "screen.doorbell.receipt.fingerprint", { fingerprint: a.sha256.slice(0, 8) + "…" + a.sha256.slice(-8) }),
    at(r, "screen.doorbell.receipt.size", { size: "2 B" }),
    at(r, "screen.doorbell.receipt.pseudonym", { pseudonym: a.pseudonym }),
    at(r, "screen.doorbell.receipt.secret", { secret: a.secret }),
  ];
  assert.ok(order.every((n) => n >= 0), `each part drawn: ${order}`);
  assert.deepEqual([...order].sort((x, y) => x - y), order);
});

test("R86: before a send the sample receipt folds under 'What you get back', and the court line is drawn with no card", async () => {
  const p = await openWorld("/app/doorbell");
  const fold = p.doc.querySelector("details[data-receipt-sample]");
  assert.ok(fold && !fold.open, "the sample receipt is folded");
  assert.equal(norm(fold.querySelector("summary").textContent), norm(word("screen.doorbell.preview.head")));
  assert.ok(drew(p, "screen.doorbell.happens.court"));
  assert.ok(!drew(p, "screen.doorbell.tip.court"), "no 'What that means' card");
});

test("R86 control: a receipt with no reference draws no 'What to keep' heading, and the rest of R49's receipt as before", async () => {
  const w = await openWorld("/app/doorbell");
  choose(w, "db-file");
  await press(w);
  const bare = { ...w.answered("knock") };
  delete bare.knockId;
  const q = await open("/app/doorbell", { boot: { session: null }, plane: { knock: ok(bare) } });
  choose(q, "db-file");
  await press(q);
  const r = q.doc.querySelector("[data-receipt]");
  assert.ok(r);
  assert.ok(!drew(q, "screen.doorbell.after.head"));
  assert.ok(at(r, "screen.doorbell.receipt.size", { size: "2 B" }) >= 0, "R49's size still drawn");
});

for (const [id, what] of [
  ["R84", "the edition and a signed case draw 'Published with {n} passages not yet graded' with a 'Which passages' fold (screen.published.ungraded); needs code in src/screens-publish/"],
  ["R100", "each case-level EVIDENCE row draws name, locator, short fingerprint and where to read it; signature and key drawn or the sentence not; needs code in src/screens-publish/"],
  ["R101", "'Read the case', 'Check it' (short paste) and 'Print the case' each draw a sentence on press; needs code in src/screens-publish/"],
  ["R102", "the unrated line is short and the 'NO BAR IS RECORDED' paragraph folds; words owed; needs code in src/screens-publish/"],
  ["R104", "published, the public docket and review-outside draw the group's name at head, 'Made with Civicsmith' at foot, tab '<case> - <group>'; needs code in src/screens-publish/"],
]) test.todo(`${id} (not yet met: T53): ${what}`);
