/* screens-public T53 (JOURNEYS, DEC-479): the doorbell's receipt (R86), over the real doorbell's answer; R101, R102, R104 on the published page.
 * The code lives in bio-plane/src/screens-publish/ until a job of this module moves it; the drawing is screens-publish's fixture. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, openWorld, drew, drewIn, main, groupName, ok, word, norm, choose as chooseIn, press as pressIn } from "../screens-publish/fixtures.mjs";
import { publishedCase } from "./world.mjs";

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

/* R101, R102, R104 on the public pages themselves (screens-publish's screens, which draw them), over public-read's real answer. */
const PUBLIC = { session: null };
const page = (answer, boot = PUBLIC) => open(`/app/published/${answer.caseId}`, { boot, plane: { publishedcase: ok(answer) } });

test("R102: a case whose evidence no member has graded draws one short line saying what would grade it, and the no-bar paragraph folded", async () => {
  const { byCase } = publishedCase({ ungraded: [0, 1], graded: false });
  const p = await page(byCase);
  const card = main(p).querySelector("[data-finding]");
  const line = card && card.querySelector('[data-ungraded="both"]');
  assert.ok(line && drewIn(line, "screen.published.ungraded.line"), "the short line");
  assert.ok(!drewIn(card, "screen.published.strength.unrated"), "not the long axis lines");
  const fold = main(p).querySelector('details[data-fold="screen.published.ungraded.more"]');
  assert.ok(fold && !fold.open, "the no-bar paragraph is folded");
  assert.ok(drewIn(fold.querySelector("summary"), "screen.published.ungraded.more"));
  assert.ok(fold.querySelector("[data-bar-none]"), "the paragraph is inside the fold");
});

/* "Neither" read as the ungraded line and its fold: the no-bar paragraph is R6's ("no bar declared"), drawn whenever the edition
   declares no bar, graded or not, and is folded there too. */
test("R102 control: a case with graded evidence draws no ungraded line", async () => {
  const { byCase } = publishedCase({ ungraded: [] });
  const p = await page(byCase);
  assert.equal(main(p).querySelectorAll("[data-ungraded]").length, 0);
  assert.equal(drew(p, "screen.published.ungraded.line"), false);
});

test("R101: 'Check it' with a short paste says how many characters are needed and sends nothing; a valid paste checks as before (control)", async () => {
  const { byCase } = publishedCase();
  const p = await page(byCase);
  await pressIn(p, "verify", { nth: 1, values: { "pb-sha": "abc123" } });
  assert.ok(drew(p, "screen.published.choose_a_file_or_paste"), "the sentence naming the 64 characters, by its key");
  assert.equal(p.byOp("verify").length, 0, "nothing sent");
  const sha = "b".repeat(64);
  await pressIn(p, "verify", { nth: 1, values: { "pb-sha": sha } });
  assert.equal(p.byOp("verify").at(-1).query.sha256, sha);
});
test.todo("R101 'Read the case' says it re-read, with the time: owed by screens-publish (the `publishedcase` act has no `done`) and the word table (no row)");
test.todo("R101 'Print the case' says why it cannot print: owed by interface-shell (`cs.print` answers no failure), screens-publish (`pubprint`) and the word table");

test("R104: with no session, the published case draws the group's public name at the head and 'Made with Civicsmith' at the foot", async () => {
  const { byCase } = publishedCase();
  for (const boot of [PUBLIC, {}]) {
    const p = await page(byCase, boot);
    const head = main(p).querySelector("[data-pubhead]"), foot = main(p).querySelector("[data-pubfoot]");
    assert.ok(head && norm(head.textContent) === norm(await groupName()), "the group's name at the head");
    assert.ok(foot && drewIn(foot, "case-grammar.text.made", { product: word("shell.mark") }), "the foot");
  }
});
test.todo("R104 the browser tab reads '<case title> - <group name>': owed by interface-shell (`page.title.public`)");
