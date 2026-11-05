/* screens-publish T53 (JOURNEYS, DEC-479): the marks this module meets at its own interface, over the providers' real answers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, openWorld, drew, ok, word, norm, choose as chooseIn, press as pressIn } from "./fixtures.mjs";

const PUBLIC = { session: null };
const choose = (p, id) => chooseIn(p, id, new Uint8Array([104, 105]));
const press = (p) => pressIn(p, "knock");
const tick = (p, id, v) => { p.doc.getElementById(id).querySelectorAll("input").forEach((b) => { if (b.value === v) b.checked = true; }); };
/* the position in the receipt's text at which a key's words (filled) start */
const at = (el, key, vars) => norm(el.textContent).indexOf(norm(word(key, vars)));

test("R86 'What to keep' heads the receipt: the reference first, then the fingerprint, size, pseudonym and made phrase, in that order", async () => {
  const p = await openWorld("/app/doorbell"); // the real doorbell answers a knockId, the fingerprint, the pseudonym and the phrase
  choose(p, "db-file");
  tick(p, "db-make", "make");
  await press(p);
  const a = p.answered("knock");
  const r = p.doc.querySelector("[data-receipt]");
  const order = [
    at(r, "screen.doorbell.after.head"),
    at(r, "screen.doorbell.reference", { reference: a.knockId }),
    at(r, "screen.doorbell.receipt.fingerprint", { fingerprint: a.sha256.slice(0, 8) + "…" + a.sha256.slice(-8) }),
    at(r, "screen.doorbell.receipt.size", { size: "2 B" }),
    at(r, "screen.doorbell.receipt.pseudonym", { pseudonym: a.pseudonym }),
    at(r, "screen.doorbell.receipt.secret", { secret: a.secret }),
  ];
  assert.ok(order.every((n) => n >= 0), `each part drawn: ${order}`);
  assert.deepEqual([...order].sort((x, y) => x - y), order, "in the order the receipt keeps them");
  assert.equal(p.doc.querySelector("[data-receipt-sample]"), null, "the sample is gone once there is a receipt");
});

test("R86 before a send the sample receipt is folded under 'What you get back'; the court line stands with no card; a receipt with no reference draws no heading (control)", async () => {
  const p = await openWorld("/app/doorbell");
  const fold = p.doc.querySelector("details[data-receipt-sample]");
  assert.ok(fold && !fold.open, "folded");
  assert.equal(norm(fold.querySelector("summary").textContent), norm(word("screen.doorbell.preview.head")));
  assert.ok(fold.querySelector("[data-keep]"), "the sample shows what to keep");
  assert.ok(drew(p, "screen.doorbell.happens.court"), "the court line says on its own what it warns of");
  assert.ok(!drew(p, "screen.doorbell.tip.court"), "no 'What that means' card");
  /* control: the real answer with its reference taken off */
  choose(p, "db-file");
  await press(p);
  const bare = { ...p.answered("knock") };
  delete bare.knockId;
  const q = await open("/app/doorbell", { boot: PUBLIC, plane: { knock: ok(bare) } });
  choose(q, "db-file");
  await press(q);
  assert.ok(q.doc.querySelector("[data-receipt]"));
  assert.equal(q.doc.querySelector("[data-receipt] [data-keep]"), null);
  assert.ok(!drew(q, "screen.doorbell.after.head"));
});
