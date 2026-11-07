/* screens-publish T53: the ceremony's marks (R83, R94, R95, R105; DEC-497's IV-3 and IV-7), over the providers' real answers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, ok, provided, COPY, P, DR, C, drew, drewIn, word, norm, main, press, last } from "./fixtures.mjs";

const carries = (body, want) => { for (const [k, v] of Object.entries(want)) assert.deepEqual(body[k], v, k); };

const CER = `/app/ceremony/${P}/${DR}`;
const stepOf = (answer, k) => (answer.json.result.steps || []).find((x) => x && k in x);

test("R83 the sign step lists each passage still ungraded, by its document and its finding, with the way to grade it; the list never stops signing", async () => {
  const pre = await provided.preflight("passes");
  const rows = stepOf(pre, "ungraded_passages").ungraded_passages.rows;
  assert.equal(rows.length, 2, "the provider's world has two ungraded passages");
  const finding = rows[0].finding;
  const p = await open(CER, { plane: { publishpreflight: pre, reviewcopy: ok(COPY({ findings: [{ target: finding, present: true, title: "The award", role: "load_bearing" }] })) } });
  const sec = main(p).querySelector("[data-ungraded]");
  assert.ok(sec, "the section is drawn");
  assert.ok(drew(p, "screen.ceremony.ungraded.head"));
  assert.ok(drew(p, "screen.ceremony.ungraded.lead", { n: "2" }));
  const lis = main(p).querySelectorAll("[data-ungraded-row]");
  assert.equal(lis.length, 2);
  assert.equal(norm(lis[0].textContent).includes(norm(word("screen.ceremony.ungraded.row", { passage: rows[0].title + ", " + word("screen.published.leg.supports"), n: "1" }))), true);
  assert.equal(norm(lis[1].textContent).includes(norm(word("screen.ceremony.ungraded.row", { passage: rows[1].title + ", " + word("screen.published.leg.cuts"), n: "1" }))), true);
  for (const li of lis) {
    const a = li.querySelector("a[data-grade-it]");
    assert.ok(a && decodeURIComponent(a.getAttribute("href")).includes(finding), "each row leads to its finding's grading fold");
    assert.equal(norm(a.textContent), norm(word("screen.ceremony.ungraded.grade")));
  }
  assert.ok(drew(p, "screen.ceremony.ungraded.note"));
  /* never a stop: no row is among the things to put right */
  const stops = main(p).querySelector("[data-blockers]");
  assert.ok(!stops || !stops.textContent.includes(rows[0].title), "not listed among the stops");
});

test("R83 control: a sign step that lists no ungraded passage draws no section", async () => {
  const pre = await provided.preflight("tension");
  assert.ok(!Array.isArray((stepOf(pre, "ungraded_passages") || {}).ungraded_passages?.rows), "the provider states none");
  const p = await open(CER, { plane: { publishpreflight: pre } });
  assert.equal(main(p).querySelector("[data-ungraded]"), null);
  assert.ok(!drew(p, "screen.ceremony.ungraded.head"));
});

test("DEC-497 IV-3 R3 the ceremony says that no adversarial check has run on this edition, and the step is not stopped by it", async () => {
  const p = await open(CER);
  const el = main(p).querySelector('[data-aicheck="none"]');
  assert.ok(el, "the check's section is drawn");
  assert.ok(drew(p, "screen.ceremony.aicheck.head"));
  assert.equal(norm(el.textContent), norm(word("screen.ceremony.aicheck.none")));
  const stops = main(p).querySelector("[data-blockers]");
  assert.ok(!stops || !norm(stops.textContent).includes(norm(word("screen.ceremony.aicheck.none"))), "never among the stops");
});

test("DEC-497 IV-7 R3 a team of one member is told no second member could read its answers; a team of two or more draws no reading state it cannot know (control)", async () => {
  const one = await open(CER, { plane: { memberlist: ok({ members: [{ member_id: "dev", handle: "dev" }] }) } });
  const el = main(one).querySelector('[data-secondread="alone"]');
  assert.ok(el, "the alone state is drawn");
  assert.ok(drew(one, "screen.ceremony.secondread.head"));
  assert.equal(norm(el.textContent), norm(word("screen.ceremony.secondread.alone")));
  const three = await open(CER);
  assert.equal(main(three).querySelector("[data-secondread]"), null);
  assert.ok(!drew(three, "screen.ceremony.secondread.head"));
});

test("R94 a member who is not an owner is offered, beside the stop that says so, to ask an owner to sign, and to confirm her ties; the bias is read, not written, and nothing prepares", async () => {
  const pre = await provided.preflight("notOwner");
  assert.equal(pre.json.result.first.reason, "NOT_THE_PROJECT_OWNER", "the provider's refusal for a member who owns nothing");
  const p = await open(CER, { plane: { publishpreflight: pre, signrequest: ok({ request: "SRQ-2026-0001", case: C, edition: 2, by: "dev", at: "2026-11-07T10:00:00Z", asked: 1 }) } });
  const stops = main(p).querySelector("[data-blockers]");
  assert.ok(stops && norm(stops.textContent).includes(norm(word("refusal.NOT_THE_PROJECT_OWNER")).replace(/\.$/, "")), "the stop is drawn");
  const ask = stops.querySelector('button[data-act="signrequest"]');
  assert.ok(ask, "Ask an owner to sign, beside the stop");
  assert.ok(main(p).querySelector("#ce-tie"), "Confirm your ties is drawn");
  assert.equal(main(p).querySelector('button[data-act="publish"]'), null, "preparing is an owner's act");
  assert.equal(main(p).querySelector("#ce-bias"), null, "the bias box is read-only");
  await press(p, "signrequest", { reason: "R94" });
  carries(last(p, "signrequest").body, { case: C, edition: 2 });
  assert.ok(drew(p, "screen.ceremony.asked"));
});

test("R94 control: an owner's ceremony offers no request to an owner and keeps the bias box and the preparing act", async () => {
  const p = await open(CER);
  assert.equal(main(p).querySelector('[data-blockers] button[data-act="signrequest"]'), null);
  assert.ok(main(p).querySelector("#ce-bias"));
  assert.ok(main(p).querySelector('button[data-act="publish"]'));
});
