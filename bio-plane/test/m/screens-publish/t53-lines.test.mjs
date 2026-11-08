/* screens-publish T53 (JOURNEYS): the status line of an act is replaced by its next answer (R96). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, ok, refusedIn, P, C, E1, GRANT_SECRET, COPY, drew, main, press, word, norm } from "./fixtures.mjs";

const FILE = { "dk-kind": "response", "dk-edition": "1", "dk-capture": E1, "dk-from": "Port of Oakland", "dk-summary": "The Port disputes finding 1.", "dk-proposed": "public", "dk-reason": "It answers a published finding." };
const alerts = (p) => main(p).querySelectorAll('[role="alert"], [data-gap="refused"]');
const once = (first, then) => { let n = 0; return () => (n++ === 0 ? first : then); };

test("R96 on the docket a refusal is replaced when the same act next succeeds: only the success stands", async () => {
  const p = await open(`/app/docket/${P}/${C}`, { plane: { docketfile: once(refusedIn("DOCKET_NO_STANDING"), ok({ entry: "DKR-1", state: "filed" })) } });
  await press(p, "docketfile", { values: FILE, reason: "It answers a published finding." });
  assert.equal(p.byOp("docketfile").length, 1);
  assert.ok(alerts(p).length > 0, "the refusal is drawn");
  await press(p, "docketfile", { values: FILE, reason: "It answers a published finding." });
  assert.equal(alerts(p).length, 0, "no refusal stays beside the later success");
});

test("R96 on the outside reader's page a refused comment is replaced by its later success; a different act keeps its own line (control)", async () => {
  const boot = { session: null, hash: "#grant=" + GRANT_SECRET };
  const p = await open("/app/review", { boot, plane: { reviewcomment: once(refusedIn("REVIEW_EMPTY_COMMENT"), ok({ comment_id: "RVC-9" })) } });
  await press(p, "reviewcomment", { values: { "ro-comment": "Finding 1 needs its date." } });
  assert.ok(alerts(p).length > 0, "the refusal is drawn");
  await press(p, "reviewcomment", { values: { "ro-comment": "Finding 1 needs its date." } });
  assert.equal(p.byOp("reviewcomment").length, 2, "both sent");
  assert.equal(alerts(p).length, 0, "only the success");
  assert.ok(drew(p, "screen.review-outside.sent"));
});

test("R96 a refusal the page itself gives (a field not filled) is replaced when the act next succeeds", async () => {
  const p = await open(`/app/docket/${P}/${C}`, { plane: { docketfile: ok({ entry: "DKR-1", state: "filed" }) } });
  const { slot } = await press(p, "docketfile", { values: { ...FILE, "dk-summary": "" }, reason: "x" });
  assert.ok(norm(p.root().textContent).includes(norm(word("screen.docket.file.needed"))), "the page's own refusal");
  await press(p, "docketfile", { values: FILE, reason: "It answers a published finding." });
  assert.equal(p.byOp("docketfile").length, 1, "sent");
  assert.ok(!norm(p.root().textContent).includes(norm(word("screen.docket.file.needed"))), "no refusal beside the success");
});

/* review R46's acknowledgement rows: each names its author, `author_kind` saying whether a reader or a member */
const ACKS = (rows) => ({ statement_acknowledgements: { acknowledgements: rows } });
const READER = { kind: "recipient", by: "RVG-2026-0007", recipient: "Lee Outsider", author: "Lee Outsider", author_kind: "recipient", reason: "Fairly stated.", at: "2026-10-08T09:00:00Z" };
const MEMBER = { kind: "member", by: "mai", author: "mai", author_kind: "member", reason: "Read it.", at: "2026-10-09T09:00:00Z" };

test("R92 the owner's case editor names the outside reader who acknowledged by the reader's name, and a member by the member's handle", async () => {
  const p = await open(`/app/case-editor/${P}`, { plane: { reviewcopy: ok(COPY(ACKS([READER, MEMBER]))) } });
  assert.ok(drew(p, "screen.case-editor.ack.by", { who: "Lee Outsider" }), "the reader by name");
  assert.ok(drew(p, "screen.case-editor.ack.by", { who: "mai" }), "a member by handle");
  assert.ok(!drew(p, "screen.case-editor.ack.by", { who: word("shell.card.member") }), "never 'a member of your team' for a reader");
  assert.ok(!main(p).textContent.includes("RVG-"));
});

test("R92 control: the review copy page names the reader as before", async () => {
  const p = await open(`/app/review-copy/${P}`, { plane: { reviewcopy: ok(COPY(ACKS([READER]))) } });
  assert.ok(main(p).querySelector("[data-acked]").textContent.includes("Lee Outsider"));
});

/* docket R32's `kinds`: what the viewer may file, each with the fields its act needs */
const DOCKET = (kinds) => ok({ case: C, project: P, entries: [], kinds, wrote: false });
const kindsOffered = (p) => { const el = p.doc.getElementById("dk-kind"); return el ? [...el.querySelectorAll("option, input")].map((o) => o.getAttribute("value")).filter(Boolean) : []; };

test("R88 (part) the docket's \"Kind of entry\" lists only the kinds the viewer may file; a viewer who may file none is drawn no form (control)", async () => {
  const p = await open(`/app/docket/${P}/${C}`, { plane: { docket: DOCKET({ file: [{ kind: "response", fields: ["edition"] }, { kind: "outcome", fields: ["edition"] }], place: [] }) } });
  assert.deepEqual(kindsOffered(p), ["response", "outcome"]);
  const none = await open(`/app/docket/${P}/${C}`, { plane: { docket: DOCKET({ file: [], place: [] }) } });
  assert.equal(none.doc.getElementById("dk-kind"), null);
  assert.equal(main(none).querySelector('button[data-act="docketfile"]'), null);
});
