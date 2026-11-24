/* screens-investigate R9: the member's own ties, on interface-shell's served page over a the real store. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { main, actsIn, button, fill, press, word, drew } from "./fixtures.mjs";
import { inWorld, openAs, settled } from "./world.mjs";

const REASON = "It is so.";
/** A body the member's ties can name, by her own act. */
const entity = async (me, label) => (await me.act("entitycreate", { body: { kind: "body", label, note: "A body." } })).entity_id;

const at = "/app/ties";

test("R9 reads memberties (her own ties, seen only by her and the administrators) and says why she is asked and who sees the list", async () => {
  const { world, me } = await inWorld();
  const transit = await entity(me, "East Bay Transit");
  const mai = await entity(me, "Mai Tran");
  await me.act("declaretie", { body: { entity: transit, kind: "employer", note: "East Bay Transit", attribution: "group" } });
  await me.act("declaretie", { body: { entity: mai, kind: "relative", note: "my sister", attribution: "name" } });
  const p = await openAs(world, me, at);
  assert.equal(p.byOp("memberties").length, 1);
  assert.deepEqual(Object.keys(p.byOp("memberties")[0].query), ["op"], "her own, as the door stamps her");
  const m = main(p);
  for (const k of ["why", "why.1", "who", "who.1"]) drew(m, "screen.ties." + k);
  const held = (await me.read("memberties", {})).ties.filter((t) => !t.withdrawn);
  const rows = m.querySelectorAll("tr.cs-r");
  assert.equal(rows.length, held.length);
  assert.equal(rows.length, 2);
  const rowOf = (note) => rows.find((r) => r.textContent.includes(note));
  drew(rowOf("East Bay Transit"), "screen.ties.kind.employer");
  drew(rowOf("East Bay Transit"), "screen.ties.says.group");
  drew(rowOf("my sister"), "screen.ties.kind.relative");
  drew(rowOf("my sister"), "screen.ties.says.name", { handle: me.handle });
});

test("R9 declaretie \"Add this tie\": its kind, who, her words, and whether a case names her by her handle or says \"a member of the group\", the disclosure stated either way", async () => {
  const { world, me } = await inWorld();
  const co = await entity(me, "Lakeshore Hardware Co-op");
  const p = await openAs(world, me, at);
  drew(main(p), "screen.ties.either");
  fill(p, { "tie-kind": "business", "tie-who": co, "tie-note": "member-owner of Lakeshore Hardware Co-op", "tie-says": "name" });
  await press(p, "declaretie", { reason: REASON });
  await settled(p);
  assert.deepEqual(p.byOp("declaretie")[0].body, { entity: co, kind: "business", note: "member-owner of Lakeshore Hardware Co-op", attribution: "name" });
  const held = (await me.read("memberties", {})).ties.filter((t) => !t.withdrawn);
  assert.deepEqual(held.map((t) => [t.entity, t.kind, t.note, t.attribution]), [[co, "business", "member-owner of Lakeshore Hardware Co-op", "name"]], "the world holds the tie");
  const q = await openAs(world, me, at);
  fill(q, { "tie-who": co, "tie-note": "an interest" });
  await press(q, "declaretie", { reason: REASON });
  await settled(q);
  assert.equal(q.byOp("declaretie")[0].body.attribution, "group", "by default a case says \"a member of the group\"");
  const both = (await me.read("memberties", {})).ties.filter((t) => !t.withdrawn);
  assert.equal(both.find((t) => t.note === "an interest").attribution, "group", "the world holds it so");
});

test("R9 withdrawtie \"Remove a tie\" from its row, with a reason (control: an unnamed tie sends nothing)", async () => {
  const { world, me } = await inWorld();
  const co = await entity(me, "East Bay Transit");
  await me.act("declaretie", { body: { entity: co, kind: "employer", note: "East Bay Transit", attribution: "group" } });
  const tie = (await me.read("memberties", {})).ties[0];
  const p = await openAs(world, me, at);
  const row = main(p).querySelectorAll("tr.cs-r")[0];
  await p.click(row.querySelector('[data-shell="row"]'));
  await press(p, "withdrawtie", { within: main(p).querySelectorAll("tr.cs-r")[0].nextElementSibling, reason: "I left that job" });
  await settled(p);
  assert.deepEqual(p.byOp("withdrawtie")[0].body, { tieId: tie.tie_id, reason: "I left that job" });
  const after = (await me.read("memberties", {})).ties.filter((t) => !t.withdrawn);
  assert.equal(after.length, 0, "the world holds the tie withdrawn");
  const q = await openAs(world, me, at);
  await press(q, "declaretie");
  assert.equal(q.byOp("declaretie").length, 0);
});

test("R34 ties draws its two disclosure choices with every fill answered (the member's handle, the tie she is adding in words), never the braces", async () => {
  const { world, me } = await inWorld();
  const p = await openAs(world, me, "/app/ties");
  const texts = p.doc.getElementById("tie-says").querySelectorAll("option").map((o) => o.textContent);
  const tie = word("screen.ties.kind.employer");
  assert.deepEqual(texts, [word("screen.ties.says.group.choice", { handle: me.handle, tie }), word("screen.ties.says.name.choice", { handle: me.handle, tie })]);
  assert.ok(texts.every((t) => !/[{}]/.test(t)), "no braces");
});
