/* screens-publish FR-30 (T51 fix round; K4165, K4168, K4192, K4194, K4197): R52 the docket starts the next edition. Each sentence is
 * asserted by its key (R24); every request is compared with its owner's declaration by the harness (interface-shell R104). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, openWorld, main, drew, drewIn, ops, press, last, fill, choose, until, keptKey, ok, word, hasWord, COPY, PREFLIGHT, GRANT_SECRET, P, C, DR, importedCase, provided, refusalWords, text } from "./fixtures.mjs";

const tick = (p, id, v) => { p.doc.getElementById(id).querySelectorAll("input").forEach((b) => { if (b.value === v) b.checked = true; }); };
const DOCKET = `/app/docket/${P}/${C}`;
const boxes = (p) => p.doc.getElementById("dk-next-findings").querySelectorAll("input");

test("R52 'Start the next edition' sends casedraft with the published case's caseId, the findings chosen and the scope, and opens the case editor on the new draft", async () => {
  const made = await provided.casedraft(); // review's real answer to casedraft
  const p = await open(DOCKET, { plane: { casedraft: made } });
  assert.ok(drew(p, "screen.docket.next.heading"));
  assert.ok(ops(p).includes("casedraft"));
  assert.equal(boxes(p).length, 1);
  boxes(p)[0].checked = true;
  fill(p, { "dk-next-scope": "Corrects the 2025 rent schedule." });
  await press(p, "casedraft");
  const body = last(p, "casedraft").body;
  assert.equal(body.caseId, C);
  assert.equal(body.project, P);
  assert.deepEqual(body.targets, ["FND-2026-0031"]);
  assert.equal(body.scope, "Corrects the 2025 rent schedule.");
  assert.equal(decodeURIComponent(p.location.pathname), `/app/case-editor/${P}/${made.json.result.draftId}`, "the editor opens on the new draft");
});

test("R52 with no finding chosen, or no scope, nothing is sent and the refusal is in its fold (controls)", async () => {
  const p = await open(DOCKET);
  fill(p, { "dk-next-scope": "Corrects it." });
  await press(p, "casedraft");
  assert.equal(p.byOp("casedraft").length, 0);
  assert.ok(drew(p, "screen.docket.next.refused.nofinding"));
  boxes(p)[0].checked = true;
  fill(p, { "dk-next-scope": "" });
  await press(p, "casedraft");
  assert.equal(p.byOp("casedraft").length, 0);
  assert.ok(drew(p, "screen.docket.next.refused.noscope"));
  assert.ok(main(p));
});

/* K5202: case-import's real `importedcase` answers: an accepted import (edition 2) and a bare one (edition 1) */
const ACCEPTED = await importedCase({ accepted: true });
const BARE = await importedCase({ accepted: false });
const IMPORT = (acc) => ({ importedcase: (acc ? ACCEPTED : BARE).answer });
const pageOf = (a) => `/app/imported/${a.import}/${a.edition}`;

test("R55 an accepted import offers 'Withdraw this acceptance, with a reason' and the act sends the reason", async () => {
  const p = await open(pageOf(ACCEPTED), { plane: IMPORT(true) });
  assert.ok(ops(p).includes("importacceptwithdraw"));
  await press(p, "importacceptwithdraw", { values: { "im-withdraw": "The schedule was later corrected." } });
  const body = last(p, "importacceptwithdraw").body;
  assert.equal(body.import, ACCEPTED.import);
  assert.equal(body.edition, ACCEPTED.edition);
  assert.equal(body.reason, "The schedule was later corrected.");
});

test("R55 a non-accepted import offers no withdrawal, and a withdrawal with no reason sends nothing (controls)", async () => {
  const none = await open(pageOf(BARE), { plane: IMPORT(false) });
  assert.ok(!ops(none).includes("importacceptwithdraw"));
  const p = await open(pageOf(ACCEPTED), { plane: IMPORT(true) });
  await press(p, "importacceptwithdraw", { values: { "im-withdraw": "  " } });
  assert.equal(p.byOp("importacceptwithdraw").length, 0);
});

const PUBLIC = { session: null };

test("R56 the doorbell's consent form sends the declared fields, with no credential: the phrase, the detail, who may be told, and agree or take back", async () => {
  const p = await open("/app/doorbell", { boot: PUBLIC, plane: { knockerconsent: await provided.knockerconsent() } });
  assert.ok(drew(p, "screen.doorbell.consent.heading"));
  assert.ok(ops(p).includes("knockerconsent"));
  await press(p, "knockerconsent", { values: { "dc-secret": "a-long-phrase-of-at-least-twenty", "dc-entry": "7", "dc-answer": "no" } });
  const r = last(p, "knockerconsent");
  assert.equal(r.headers.Authorization, undefined);
  assert.deepEqual(r.body, { knockerSecret: "a-long-phrase-of-at-least-twenty", entry: "7", audience: "member", withdraw: true });
  await press(p, "knockerconsent", { values: { "dc-secret": "a-long-phrase-of-at-least-twenty", "dc-entry": "7", "dc-answer": "yes" } });
  assert.equal(last(p, "knockerconsent").body.withdraw, false);
});

test("R56 with no answer chosen nothing is sent; a refusal is drawn by its words (controls)", async () => {
  const p = await openWorld("/app/doorbell"); // the real consent op, asked with a phrase no source holds
  await press(p, "knockerconsent", { values: { "dc-secret": "a-long-phrase-of-at-least-twenty", "dc-entry": "7" } });
  assert.equal(p.byOp("knockerconsent").length, 0);
  await press(p, "knockerconsent", { values: { "dc-secret": "a-long-phrase-of-at-least-twenty", "dc-entry": "7", "dc-answer": "yes" } });
  assert.equal(p.answered("knockerconsent").code, "SECRET_NOT_RECOGNISED", "the door's own refusal");
  assert.ok(drew(p, "screen.doorbell.consent.refused.secret"));
});

test("R67 the receipt draws the knock's reference under the heading, by key; an answer without one draws the receipt as before (control)", async () => {
  const withRef = await openWorld("/app/doorbell"); // the real doorbell answers a knockId
  choose(withRef, "db-file", new Uint8Array([104, 105]));
  await press(withRef, "knock");
  assert.ok(withRef.doc.querySelector("[data-received]"));
  assert.ok(drew(withRef, "screen.doorbell.after.head"));
  assert.ok(withRef.answered("knock").knockId, "the doorbell answers a knockId");
  assert.ok(drew(withRef, "screen.doorbell.reference", { reference: withRef.answered("knock").knockId }), "the reference is the knockId the doorbell answers");
  /* the control: the real answer without its reference (the door always states one, so the field is taken off that answer) */
  const bare = { ...withRef.answered("knock") };
  delete bare.knockId;
  const without = await open("/app/doorbell", { boot: PUBLIC, plane: { knock: ok(bare) } });
  choose(without, "db-file", new Uint8Array([104, 105]));
  await press(without, "knock");
  assert.ok(without.doc.querySelector("[data-received]"));
  assert.ok(!drew(without, "screen.doorbell.after.head"));
});

test("R49 the receipt draws the knock's fingerprint, size, pseudonym and a made phrase once each by key; the phrase is kept nowhere (B420 1)", async () => {
  const p = await openWorld("/app/doorbell"); // the real doorbell makes the phrase, the fingerprint and the pseudonym
  choose(p, "db-file", new Uint8Array([104, 105]));
  tick(p, "db-make", "make");
  await press(p, "knock");
  const answer = p.answered("knock"), MADE = answer.secret;
  assert.ok(MADE && answer.sha256 && answer.pseudonym && answer.bytes === 2, "the doorbell's answer carries the made phrase, the fingerprint, the pseudonym and the size");
  const r = p.doc.querySelector("[data-receipt]");
  assert.ok(r, "the receipt is drawn");
  assert.ok(drew(p, "screen.doorbell.receipt.fingerprint", { fingerprint: answer.sha256.slice(0, 8) + "…" + answer.sha256.slice(-8) }));
  assert.ok(drew(p, "screen.doorbell.receipt.fingerprint.help"));
  assert.ok(drew(p, "screen.doorbell.receipt.size", { size: "2 B" }));
  assert.ok(drew(p, "screen.doorbell.receipt.pseudonym", { pseudonym: answer.pseudonym }) && drew(p, "screen.doorbell.receipt.pseudonym.help"));
  assert.ok(drew(p, "screen.doorbell.receipt.secret", { secret: MADE }) && drew(p, "screen.doorbell.receipt.secret.note"));
  assert.equal(String(r.textContent).split(MADE).length - 1, 1, "the phrase is drawn once");
  assert.ok(!JSON.stringify(p.requests).includes(MADE), "the made phrase is in no later request");
  assert.ok(!String(p.location.href).includes(MADE), "nor in an address");
  assert.ok(!JSON.stringify(p.storage || {}).includes(MADE), "nor in storage");
});

test("R49 'Make one for me' sends generateSecret and no phrase, even with one typed; unticked it sends the typed phrase and not generateSecret (control)", async () => {
  const p = await openWorld("/app/doorbell");
  assert.ok(drew(p, "screen.doorbell.secret.make") && drew(p, "screen.doorbell.secret.make.help"));
  choose(p, "db-file", new Uint8Array([104, 105]));
  tick(p, "db-make", "make");
  fill(p, { "db-secret": "typed-and-then-ignored-by-the-tick" });
  await press(p, "knock");
  const b = last(p, "knock").body;
  assert.equal(b.generateSecret, true);
  assert.equal(b.knockerSecret, undefined);
  const q = await openWorld("/app/doorbell");
  choose(q, "db-file", new Uint8Array([104, 105]));
  await press(q, "knock", { values: { "db-secret": "a-long-enough-secret-phrase-of-mine" } });
  assert.equal(last(q, "knock").body.knockerSecret, "a-long-enough-secret-phrase-of-mine");
  assert.equal(last(q, "knock").body.generateSecret, undefined);
});

test("R49 an answer without the fingerprint, size, pseudonym or phrase draws none of them (control)", async () => {
  /* the control: the real answer with those four taken off (the door always states them) */
  const made = await openWorld("/app/doorbell");
  choose(made, "db-file", new Uint8Array([104, 105]));
  tick(made, "db-make", "make");
  await press(made, "knock");
  const bare = { ...made.answered("knock") };
  for (const k of ["secret", "sha256", "pseudonym", "bytes"]) delete bare[k];
  const p = await open("/app/doorbell", { boot: PUBLIC, plane: { knock: ok(bare) } });
  choose(p, "db-file", new Uint8Array([104, 105]));
  await press(p, "knock");
  assert.ok(p.doc.querySelector("[data-received]") && p.doc.querySelector("[data-receipt]"));
  for (const sel of ["[data-fingerprint]", "[data-size]", "[data-pseudonym]", "[data-secret]"]) assert.equal(p.doc.querySelector(sel), null, sel);
});

const CER = `/app/ceremony/${P}/${DR}`;

test("R66 a pre-flight refused for no finding draws the gate and the door to the case editor's findings", async () => {
  const refused = await provided.preflight("noFinding"); // case-authoring's real pre-flight for a call naming no finding: PUBLISH_NO_FINDING
  assert.equal(refused.json.result.first.reason, "PUBLISH_NO_FINDING");
  const none = await open(CER, { plane: { reviewcopy: ok(COPY({ findings: [] })), publishpreflight: refused } });
  assert.ok(drew(none, "ceremony.gate.notargets"));
  const door = none.doc.querySelector("[data-addfinding]");
  assert.ok(door && drew(none, "screen.ceremony.gate.addfinding"));
  assert.ok(door.getAttribute("href").startsWith(`/app/case-editor/${encodeURIComponent(P + "/" + DR)}`) && door.getAttribute("href").endsWith("#what-goes-in"));
  assert.ok(word("refusal.PUBLISH_NO_FINDING"));
});

test("R45 a browser that holds no signing key is offered one as soon as the Sign step is drawn, before any caseratify; with a key held neither is drawn (control)", async () => {
  const signStep = () => { const pre = PREFLIGHT(); return { publishpreflight: ok(pre) }; };
  const p = await open(CER, { plane: signStep() });
  tick(p, "ce-tie", "yes");
  await press(p, "publish", { reason: "x" });
  await until(p, () => p.doc.querySelector("[data-nokey]"));
  assert.ok(p.doc.querySelector("[data-nokey]"));
  assert.ok(ops(p).includes("signerregisterown"));
  assert.equal(p.byOp("caseratify").length, 0);
  const idb = await keptKey();
  const q = await open(CER, { plane: signStep(), boot: { idb } });
  tick(q, "ce-tie", "yes");
  await press(q, "publish", { reason: "x" });
  await until(q, () => ops(q).includes("caseratify"));
  await q.settle();
  assert.ok(!q.doc.querySelector("[data-nokey]"));
});

const NOCASE = (o = {}) => COPY({ case: { case_id: null, edition: null, identity: "A CASE THIS DRAFT DOES NOT NAME AND PUBLICATION DERIVES", newCase: true }, title: word("review.title.draft", { title: "Rents, 2024 to 2026" }), ...o });

const REVIEW = `/app/review-copy/${P}/${DR}`;
const OUTSIDE = { session: null, hash: "#grant=" + GRANT_SECRET };
const heading = (p) => p.doc.querySelector("h1").textContent;

test("R60 R63 the ceremony, the review copy and the reader's page are headed by the title review answers, by key; the identity sentence is body text; a draft naming a case draws its title (control)", async () => {
  for (const [path, boot] of [[`/app/ceremony/${P}/${DR}`, {}], [REVIEW, {}], ["/app/review", OUTSIDE]]) {
    const p = await open(path, { boot, plane: { reviewcopy: ok(NOCASE()) } });
    assert.equal(heading(p), word("review.title.draft", { title: "Rents, 2024 to 2026" }), path);
    assert.ok(drew(p, "review.body.nocase"), path);
    assert.ok(!heading(p).includes("DOES NOT NAME"), path);
    const un = await open(path, { boot, plane: { reviewcopy: ok(NOCASE({ title: word("review.title.untitled") })) } });
    assert.equal(heading(un), word("review.title.untitled"), path);
    const named = await open(path, { boot, plane: { reviewcopy: ok(COPY({ title: "Case The Coliseum lease, edition 2" })) } });
    assert.equal(heading(named), "Case The Coliseum lease, edition 2", path);
    assert.ok(!drew(named, "review.body.nocase"), path);
  }
});

test("R61 the reader's page draws each finding's statement and no file line; a finding with no statement draws its target (control)", async () => {
  const p = await open("/app/review", { boot: OUTSIDE, plane: { reviewcopy: ok(COPY({ findings: [{ target: "FND-1", present: true, text: "--- id: INQ-1\nobject_type: inquiry", statement: "The rents rose without a vote." }, { target: "FND-2", present: true, text: "--- id: INQ-2" }] })) } });
  const t = main(p).textContent;
  assert.ok(t.includes("The rents rose without a vote.") && !t.includes("---") && !t.includes("object_type"));
  assert.ok(t.includes("FND-2"));
});

test("R62 R65 a draft naming no case still draws the reader's comment and the acknowledgement by key, with no raw reader id; none draws neither (control)", async () => {
  const p = await open(REVIEW, { plane: { reviewcopy: ok(NOCASE({ statement_acknowledgements: { acknowledgements: [{ kind: "recipient", by: "RVG-2026-0007", recipient: "Prof. N. Iyer", at: "2026-10-08T09:00:00Z", reason: "ok" }] } })) } });
  assert.ok(drew(p, "screen.review-copy.comments"));
  assert.ok(main(p).textContent.includes("Finding 1 should say which schedule the council approved."));
  assert.ok(p.doc.querySelector("[data-acked]").textContent.includes(word("screen.review-copy.acked", { who: "Prof. N. Iyer", date: "" }).split(",")[0]), "named by what the grant states, by key");
  assert.ok(!main(p).textContent.includes("RVG-"));
  const none = await open(REVIEW, { plane: { reviewcopy: ok(NOCASE({ comments: [], statement_acknowledgements: null })) } });
  assert.ok(!drew(none, "screen.review-copy.comments") && !none.doc.querySelector("[data-acked]"));
});

test("R64 no draft draws the sentence and the door that makes one; with a draft there is none (control)", async () => {
  const p = await open(`/app/review-copy/${P}`, { plane: { casedrafts: ok({ drafts: [] }) } });
  assert.ok(drew(p, "screen.review-copy.nodraft") && drew(p, "screen.review-copy.nodraft.go"));
  assert.equal(p.doc.querySelector("[data-nodraft-go]").getAttribute("href"), `/app/case-editor/${P}`);
  const q = await open(REVIEW);
  assert.ok(!q.doc.querySelector("[data-nodraft-go]"));
});

const EDITOR = `/app/case-editor/${P}/${DR}`;
const rung = (p, r) => p.doc.querySelector(`[data-rung="${r}"]`);

test("R48 R64 R47 the external rung is not yet evaluated when the gates refused; the gates' first refusal is drawn as what is missing; the ladder is an ordered list; no not-met row where no check refused", async () => {
  const refusedCopy = await provided.reviewcopy(); // review's real copy: the publish gates refused, with what is missing
  const first = refusedCopy.json.result.missing[0];
  const p = await open(EDITOR, { plane: { reviewcopy: refusedCopy } });
  assert.ok(p.doc.querySelector("ol[data-ladder]") && rung(p, "external").tagName === "LI");
  assert.ok(drewIn(rung(p, "external"), "case.ladder.notyet") && !drewIn(rung(p, "external"), "screen.case-editor.rung.notmet"));
  assert.ok(p.doc.querySelector("[data-missing]") && drewIn(p.doc.querySelector("[data-missing]"), "refusal." + (first.code || first.reason), first));
  assert.ok(rung(p, "internal").className.includes("on"), "check held: the internal rung is on");
  const none = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ gates: "passed", missing: [] })) } });
  assert.ok(!none.doc.querySelector("[data-missing]"));
  const void_ = await open(EDITOR, { plane: { casecheck: ok({ state: "void", case: C, edition: 2 }) } });
  assert.ok(drewIn(rung(void_, "internal"), "screen.case-editor.rung.notmet"), "a refused check draws the not-met row");
  const nocase = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ case: { case_id: null, edition: null, identity: "x", newCase: true }, gates: "refused", missing: [] })), casecheck: ok({ state: "held" }) } });
  assert.ok(!drew(nocase, "screen.case-editor.rung.notmet"), "a draft with no case and no refused check draws no not-met row");
});

test("R63 R65 a draft naming no case says so in the fold by review's sentence; the case screen links to the owner's comments with their number, or says there are none", async () => {
  const p = await open(EDITOR, { plane: { reviewcopy: ok(NOCASE()) } });
  assert.ok(p.doc.querySelector('[data-fold="screen.case-editor.nocase.summary"]') && drew(p, "review.body.nocase"));
  assert.ok(drew(p, "screen.case-editor.comments.go", { n: "1" }));
  assert.equal(p.doc.querySelector("[data-comments] a").getAttribute("href"), `/app/review-copy/${encodeURIComponent(P + "/" + DR)}`);
  const none = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ comments: [] })) } });
  assert.ok(drew(none, "screen.case-editor.comments.none") && !none.doc.querySelector("[data-comments] a"));
  assert.ok(!none.doc.querySelector('[data-fold="screen.case-editor.nocase.summary"]'), "a draft naming a case draws no such fold");
});

test("R8 the assistant helps with the docket entry's summary only while it is reachable: it sends the summary for docketfile and draws wizard-scripts' real refusal in its words, the field left as typed (B17; B420 2); not reachable draws no help (control)", async () => {
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  /* the real `writinghelp` never returns a draft (K5212): the draft already held in the field, or the assistant unreachable */
  for (const which of ["held", "unreachable"]) {
    const answer = await provided.writinghelp(which);
    const p = await open(DOCKET, { plane: { ...reach, writinghelp: answer } });
    const helps = p.root().querySelectorAll('button[data-act="writinghelp"]');
    assert.equal(helps.length, 1, "one help, on the summary");
    assert.equal(helps[0].getAttribute("data-field"), "summary");
    assert.equal(helps[0].getAttribute("data-forop"), "docketfile");
    assert.equal(helps[0].getAttribute("data-id"), "dk-summary");
    await press(p, "writinghelp", { values: { "dk-summary": "admin replied 15 oct" } });
    assert.deepEqual(last(p, "writinghelp").body, { op: "docketfile", field: "summary", told: "admin replied 15 oct" });
    assert.equal(p.doc.getElementById("dk-summary").value, "admin replied 15 oct", `${which}: the field is left as typed`);
    assert.ok(text(p).includes(refusalWords(answer)), `${which}: the refusal in its words`);
  }
  const off = await open(DOCKET);
  assert.equal(off.root().querySelectorAll('button[data-act="writinghelp"]').length, 0, "control: no assistant, no help");
});

test("R8 the summary's help sends nothing when nothing was typed (control)", async () => {
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  const p = await open(DOCKET, { plane: { ...reach, writinghelp: await provided.writinghelp("held") } });
  await press(p, "writinghelp", { values: { "dk-summary": "" } });
  assert.equal(p.byOp("writinghelp").length, 0);
});
