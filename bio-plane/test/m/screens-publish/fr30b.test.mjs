/* screens-publish FR-30, second part (K4165, K4168, K4192, K4194, K4197; DEC-374 to DEC-378, DEC-382, DEC-384): R44, R46, R51, R53, R57
 * on the case editor and the ceremony; R47, R54 on the published page; R58, R59 on the imported page. Each sentence is asserted by its
 * key (R24); every request is compared with its owner's declaration by the harness (interface-shell R104). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { citeimportedAnswer } from "../case-import/fixtures.mjs";
import { open, main, drew, drewIn, ops, press, last, fill, tick, until, keptKey, answerSign, choose, day, publishedPlane, FINDING, F1, E1, DETAILS, DETAILS_PUBLIC, ok, refusedIn, word, hasWord, COPY, PREFLIGHT, P, C, DR, importedCase, rerunImport, provided, refusalWords, text } from "./fixtures.mjs";

const EDITOR = `/app/case-editor/${P}/${DR}`;
const CER = `/app/ceremony/${P}/${DR}`;
const TWO = [{ target: "FND-2026-0031", present: true, text: "The 2024 adjustments had no council vote.", statement: "The 2024 adjustments had no council vote.", role: "load_bearing" },
  { target: "FND-2026-0032", present: true, text: "A second adjustment followed in 2025.", statement: "A second adjustment followed in 2025.", role: "supporting" }];
/** Chooses `v` in a radio group, as the browser does: the others are cleared. */
const pick = (p, id, v) => p.doc.getElementById(id).querySelectorAll("input").forEach((i) => { i.checked = i.value === v; });
const checked = (p, id) => p.doc.getElementById(id).querySelectorAll("input").filter((i) => i.checked).map((i) => i.value);

test("R44 position, reasoning, one left-out row and each finding's role, then Save, send casedraft with those fields and no targets; a Save that changed one field sends that field alone (control)", async () => {
  const p = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ findings: TWO })) } });
  assert.deepEqual(checked(p, "ce-role-0"), ["load_bearing"], "the role the draft holds is the one drawn");
  assert.deepEqual(checked(p, "ce-role-1"), ["supporting"]);
  pick(p, "ce-role-1", "load_bearing");
  pick(p, "ce-pos", "sought_no_answer");
  fill(p, { "ce-posjust": "We wrote on September 22 and had no reply by October 6.", "ce-exwhat": "The 2019 negotiation", "ce-exwhy": "The record we hold begins in 2024." });
  await press(p, "casedraft", { reason: "edit" });
  const b = last(p, "casedraft").body;
  assert.equal(b.draft, DR);
  assert.equal(b.subjectPosition, "sought_no_answer");
  assert.equal(b.subjectJustification, "We wrote on September 22 and had no reply by October 6.");
  assert.deepEqual(b.excluded, [{ target: "INFO-9", description: "Whether the rents are fair", reason: "outside the lease's terms" }, { description: "The 2019 negotiation", reason: "The record we hold begins in 2024." }]);
  assert.deepEqual(b.roles, { "FND-2026-0031": "load_bearing", "FND-2026-0032": "load_bearing" }, "one choice for every finding");
  assert.ok(!("targets" in b) && !("target" in b), "a Save names no findings: the draft keeps its own");
  const q = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ findings: TWO })) } });
  fill(q, { "ce-posjust": "Because they did not answer." });
  await press(q, "casedraft", { reason: "edit" });
  assert.deepEqual(Object.keys(last(q, "casedraft").body).sort(), ["draft", "subjectJustification"], "control: one changed field, that field alone");
});

test("R44 a left-out row needs its reason, and 'nothing material left out' sends an empty list; silence sends none; the second member's Acknowledge is drawn once something is left out", async () => {
  const none = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ authored: { scope: "S", statement: "x", excluded: null }, statement_acknowledgements: null })) } });
  assert.ok(ops(none).includes("statementack"), "D-M5: what is acknowledged is the statement, so it is offered with nothing left out");
  const bare = await open(EDITOR, { plane: { reviewcopy: ok(COPY({ authored: { scope: "S", statement: "", excluded: null }, statement_acknowledgements: null })) } });
  assert.ok(!ops(bare).includes("statementack"), "control: no statement and nothing left out: nothing to acknowledge");
  await press(none, "casedraft", { reason: "edit" });
  assert.ok(!("excluded" in last(none, "casedraft").body), "silence sends none");
  fill(none, { "ce-exwhat": "Rents elsewhere", "ce-exwhy": "" });
  await press(none, "casedraft", { reason: "edit" });
  assert.equal(none.byOp("casedraft").length, 1, "a row with no reason is refused in place and nothing is sent");
  assert.ok(drew(none, "screen.case-editor.say_what_is_left_out_and"));
  fill(none, { "ce-exwhat": "", "ce-exwhy": "" });
  pick(none, "ce-exnone", "none");
  await press(none, "casedraft", { reason: "edit" });
  assert.deepEqual(last(none, "casedraft").body.excluded, [], "an empty list is a claim");
  const some = await open(EDITOR);
  assert.ok(ops(some).includes("statementack"), "something is left out: the second member's Acknowledge is drawn");
});

const B64 = "b".repeat(64);
const STEP3 = (o = {}) => ({ step: 3, tensions: { candidates: [], count: 0 }, not_co_attested: [], self_attested: [], ...o });
const WITH = (step3) => PREFLIGHT({ steps: [...PREFLIGHT().steps.slice(0, 5), step3, ...PREFLIGHT().steps.slice(5)] });
const pre = (p) => last(p, "publishpreflight").body;

test("R46 each candidate the Disclosures step lists has a tick and a field for the owner's words; the pre-flight and publish send the ticked ones as tensionsDisclosed; none ticked sends none", async () => {
  const p = await open(CER);
  assert.ok(drew(p, "screen.ceremony.disc.list.legend") && drew(p, "screen.ceremony.disc.words.label"));
  await press(p, "publishpreflight");
  assert.ok(!("tensionsDisclosed" in pre(p)), "none ticked sends none");
  tick(p, "ce-disc", "CAND-1");
  fill(p, { "ce-dw-0": "The two dates are being checked against the postmark." });
  await press(p, "publishpreflight");
  assert.deepEqual(pre(p).tensionsDisclosed, [{ candidate: "CAND-1", words: "The two dates are being checked against the postmark." }]);
  assert.deepEqual(checked(p, "ce-disc"), ["CAND-1"], "the tick is kept after the answer");
  tick(p, "ce-tie", "yes");
  await press(p, "publish", { reason: "x" });
  assert.deepEqual(last(p, "publish").body.tensionsDisclosed, [{ candidate: "CAND-1", words: "The two dates are being checked against the postmark." }]);
  assert.equal(last(p, "publish").body.tieAttested, true);
});

test("R46 a refusal is drawn by its key and the ticks are kept (control)", async () => {
  const refused = await provided.preflight("tension"); // case-authoring's real pre-flight for an undisclosed contradiction
  const first = refused.json.result.first;
  const p = await open(CER, { plane: { publishpreflight: refused } });
  tick(p, "ce-disc", "CAND-1");
  await press(p, "publishpreflight");
  assert.ok(drew(p, "refusal." + first.code, first));
  assert.deepEqual(checked(p, "ce-disc"), ["CAND-1"]);
});

test("R44 the Bias step holds the member's own words and the pre-flight and the publish send them as biasAcknowledgement; none typed sends none", async () => {
  const none = await open(CER);
  await press(none, "publishpreflight");
  assert.ok(!("biasAcknowledgement" in pre(none)));
  const p = await open(CER);
  fill(p, { "ce-bias": "We read the Department's own reports closely." });
  await press(p, "publishpreflight");
  assert.equal(pre(p).biasAcknowledgement, "We read the Department's own reports closely.");
  tick(p, "ce-tie", "yes");
  await press(p, "publish", { reason: "x" });
  assert.equal(last(p, "publish").body.biasAcknowledgement, "We read the Department's own reports closely.");
  const held = await open(CER, { plane: { reviewcopy: ok(COPY({ authored: { scope: "S", biasAcknowledgement: "Held words." } })) } });
  assert.equal(held.doc.getElementById("ce-bias").value || held.doc.getElementById("ce-bias").textContent, "Held words.", "the draft's own words are shown");
});

test("R50 the ceremony's three requests name the draft and the project and carry nothing else of the case: no findings, no words (the guard accepts them)", async () => {
  const p = await open(CER);
  await press(p, "publishpreflight");
  await press(p, "publishtensions");
  tick(p, "ce-tie", "yes");
  await press(p, "publish", { reason: "x" });
  for (const op of ["publishpreflight", "publishtensions", "publish"]) {
    const body = last(p, op).body;
    assert.equal(body.project, P, op);
    for (const k of Object.keys(body)) assert.ok(["project", "draft", "tieAttested", "tensionsDisclosed", "selfAttested", "biasAcknowledgement"].includes(k), `${op}: ${k}`);
    for (const k of ["targets", "target", "statement", "scope", "excluded", "roles", "account"]) assert.ok(!(k in body), `${op}: no ${k}`);
  }
});

const DOCS = { publishpreflight: ok(WITH(STEP3({ not_co_attested: [B64] }))), captureaccounts: ok({ captureSha: B64, actors: [{ actor: "dev", at: "2026-10-01T09:00:00Z" }], accounts: [] }) };

test("R51 a document without a second confirmation offers the confirmation again, self-attestation with a required reason, and the capturing member's signed account; each sends its request", async () => {
  const p = await open(CER, { boot: { idb: await keptKey() }, plane: { ...DOCS, reattest: await provided.reattest(), captureaccount: await provided.captureaccount() } });
  assert.ok(drew(p, "screen.ceremony.conf.heading") && ops(p).includes("reattest") && ops(p).includes("captureaccount"));
  await press(p, "reattest");
  assert.deepEqual(last(p, "reattest").body, { captureSha: B64 });
  fill(p, { "ce-cap-0": "I saved the page on October 1 from the city's site." });
  await press(p, "captureaccount", { reason: "x" });
  const lines = await answerSign(p, true, "captureaccount");
  assert.ok(lines.includes(`bio-capture-account ${B64}`), "the account's statement is what the key signs");
  const a = last(p, "captureaccount").body;
  assert.equal(a.captureSha, B64);
  assert.equal(a.text, "I saved the page on October 1 from the city's site.");
  assert.match(a.signature, /SSH SIGNATURE/);
  tick(p, "ce-sa", B64);
  fill(p, { "ce-sar-0": "No archive held a copy; the original is with the team." });
  await press(p, "publishpreflight");
  assert.deepEqual(pre(p).selfAttested, [{ capture: B64, reason: "No archive held a copy; the original is with the team." }]);
  tick(p, "ce-tie", "yes");
  await press(p, "publish", { reason: "x" });
  assert.deepEqual(last(p, "publish").body.selfAttested, [{ capture: B64, reason: "No archive held a copy; the original is with the team." }]);
});

test("R51 self-attestation without a reason is refused in place and nothing is sent; a member who did not capture it is offered no signed account (controls)", async () => {
  const p = await open(CER, { plane: { ...DOCS, captureaccounts: ok({ captureSha: B64, actors: [{ actor: "mai" }], accounts: [] }) } });
  tick(p, "ce-sa", B64);
  await press(p, "publishpreflight");
  assert.equal(p.byOp("publishpreflight").length, 1, "only the page's own read was sent");
  assert.ok(drew(p, "screen.ceremony.conf.refused.noreason1"));
  assert.ok(!ops(p).includes("captureaccount"), "only the member who captured it adds an account");
});

test("R69 a document without a second confirmation names the member who captured it and each finding resting on it; an entry with no capturer draws none (control)", async () => {
  const entry = { capture: B64, by: "mai", findings: [F1, "FND-2026-0032"] };
  const p = await open(CER, { plane: { ...DOCS, publishpreflight: ok(WITH(STEP3({ not_co_attested: [entry] }))) } });
  const who = p.doc.querySelector(`[data-capturer="${B64}"]`);
  assert.ok(who && who.textContent === "mai", "the capturer is drawn");
  const rests = p.doc.querySelectorAll(`[data-rests="${B64}"]`);
  assert.equal(rests.length, 2, "one sentence for each finding resting on it");
  assert.ok(drewIn(rests[0], "screen.ceremony.conf.intro2", { finding: F1 }) && drewIn(rests[1], "screen.ceremony.conf.intro2", { finding: "FND-2026-0032" }));
  const q = await open(CER, { plane: { ...DOCS, publishpreflight: ok(WITH(STEP3({ not_co_attested: [{ capture: B64, by: null, findings: [F1] }] }))) } });
  assert.ok(q.doc.querySelector(`[data-unconfirmed="${B64}"]`), "the document is listed");
  assert.ok(!q.doc.querySelector(`[data-capturer="${B64}"]`), "no capturer is drawn when none is recorded");
  assert.equal(q.doc.querySelectorAll(`[data-rests="${B64}"]`).length, 1);
});

const md = (refs) => ["---", `id: ${P}`, "object_type: project", "title: \"The Coliseum lease\"", "references:",
  ...refs.flatMap(([t, st, note]) => [`  - target: ${t}`, "    rel: cites", `    status: ${st}`, ...(note ? [`    note: "${note}"`] : [])]), "---", ""].join("\n");

test("R53 'Remove' and 'Reinstate' send the project, the handle and the reason the shell asks; a reinstated citation is listed again", async () => {
  let refs = [["INFO-2026-0004", "confirmed"], ["INFO-2026-0005", "severed", "Severed 2026-10-07T09:00:00Z: the wrong year"]];
  const SEVERED = await provided.sever(), REINSTATED = await provided.reinstate(); // citation's real answers
  const p = await open(EDITOR, { plane: { image: () => ok({ "bundle.md": md(refs) }), sever: () => { refs = [["INFO-2026-0004", "severed", "gone"], refs[1]]; return SEVERED; },
    reinstate: () => { refs = [refs[0], ["INFO-2026-0005", "confirmed"]]; return REINSTATED; } } });
  assert.ok(drew(p, "screen.case-editor.the_passages_this_case_cites"));
  assert.equal(p.doc.querySelectorAll('button[data-act="sever"]').length, 1);
  assert.equal(p.doc.querySelectorAll('button[data-act="reinstate"]').length, 1);
  await press(p, "sever", { reason: "The schedule was superseded." });
  assert.deepEqual(last(p, "sever").body, { project: P, handle: "INFO-2026-0004", reason: "The schedule was superseded." });
  await p.settle();
  assert.equal(p.doc.querySelectorAll('button[data-act="reinstate"]').length, 2, "the removed citation is listed with its way back");
  await press(p, "reinstate", { nth: 1, reason: "It still stands." });
  assert.deepEqual(last(p, "reinstate").body, { project: P, handle: "INFO-2026-0005", reason: "It still stands." });
  await p.settle();
  assert.equal(p.doc.querySelectorAll('button[data-act="reinstate"]').length, 1, "reinstated: it is live again");
});

test("R53 with no reason the shell asks and nothing is sent (control); a project citing nothing draws no section", async () => {
  const p = await open(EDITOR, { plane: { image: ok({ "bundle.md": md([["INFO-2026-0004", "confirmed"]]) }) } });
  await press(p, "sever");
  assert.equal(p.byOp("sever").length, 0);
  const none = await open(EDITOR);
  assert.ok(!none.doc.querySelector('[data-cited]') && !drew(none, "screen.case-editor.the_passages_this_case_cites"));
});

/* K5202: case-import's real `importedcase` answers: an accepted import (edition 2, its first finding accepted) and a bare one (edition 1) */
const ACCEPTED = await importedCase({ accepted: true });
const BARE = await importedCase({ accepted: false });
const IMPORT = (acc) => ({ importedcase: (acc ? ACCEPTED : BARE).answer });
const IMP = `/app/imported/${ACCEPTED.import}/${ACCEPTED.edition}`;
const BARE_IMP = `/app/imported/${BARE.import}/${BARE.edition}`;
const FIRST = ACCEPTED.answer.json.result.edition.findings[0].finding;
const noneChosen = (p) => p.doc.getElementById("im-lens").querySelectorAll("input").every((i) => !i.checked);

test("R58 'View under another lens' offers three lenses none of them chosen; the one chosen sends importregrade with the declared fields and draws the findings that moved, the statement that moved each and the limit sentence", async () => {
  const regrade = ok({ ok: true, import: ACCEPTED.import, edition: ACCEPTED.edition, requested_lens: "removed", lens: "removed", limit: "A re-check re-weighs the analysis that exists.",
    findings: [{ finding: "FND-W-1", published: { pair: { capture: "B", connection: "B" } }, pair: { capture: "B", connection: "C" }, moved: true,
      because: [{ statement: "S-1", kind: "bias", subject: "x", text: "The source weights its own reports", touched: { target: "FND-W-1", ord: 1 } }] }] });
  const p = await open(IMP, { plane: { ...IMPORT(true), importregrade: regrade } });
  assert.ok(noneChosen(p), "none is preselected");
  assert.equal(p.doc.getElementById("im-lens").querySelectorAll("input").length, 3);
  await press(p, "importregrade");
  assert.equal(p.byOp("importregrade").length, 0, "no lens chosen, nothing is sent");
  pick(p, "im-lens", "removed");
  await press(p, "importregrade");
  assert.deepEqual(last(p, "importregrade").body, { import: ACCEPTED.import, edition: ACCEPTED.edition, lens: "removed" });
  assert.ok(drew(p, "screen.imported.lens_moved", { published: "B/B", regraded: "B/C" }));
  assert.ok(drew(p, "screen.imported.lens_because", { statement: "The source weights its own reports", part: "FND-W-1" }));
  assert.ok(main(p).textContent.includes("A re-check re-weighs the analysis that exists."));
});

test("R58 'Re-run this work in your own project' sends rerunstart with the project, the import and the edition; RERUN_ALREADY is drawn by its words; no project chosen sends nothing (controls)", async () => {
  const RR = await rerunImport();
  const p = await open(`/app/imported/${RR.import}/${RR.edition}`, { plane: { importedcase: RR.page, rerunstart: RR.answer } });
  await press(p, "rerunstart");
  assert.equal(p.byOp("rerunstart").length, 0);
  fill(p, { "im-rerun": P });
  await press(p, "rerunstart", { reason: "x" });
  /* the product registers op-declarations and op-grades together (store-assembly R83): `rerunstart` is not a reasoned act there, so the shell asks for
     no reason and the body is the declared fields alone */
  assert.deepEqual(last(p, "rerunstart").body, { project: P, import: RR.import, edition: RR.edition });
  const again = await rerunImport({ twice: true });
  const q = await open(`/app/imported/${again.import}/${again.edition}`, { plane: { importedcase: again.page, rerunstart: again.answer } });
  fill(q, { "im-rerun": P });
  await press(q, "rerunstart", { reason: "x" });
  assert.ok(drew(q, "screen.imported.rerun_refused_already"));
});

test("R59 an accepted import's finding offers 'Rest one of your team's questions on this' and the act sends the declared fields; a non-accepted import offers none, and IMPORTED_NOT_ACCEPTED is drawn by its words", async () => {
  const CITED = ok((await citeimportedAnswer()).answer); // case-import's real citeimported (citation's citation over its accepted import)
  const p = await open(IMP, { plane: { ...IMPORT(true), citeimported: CITED } });
  assert.ok(drew(p, "screen.imported.citeimp.head") && ops(p).includes("citeimported"));
  await press(p, "citeimported");
  assert.equal(p.byOp("citeimported").length, 0, "no question or role chosen, nothing is sent");
  fill(p, { "im-ci-q-0": "INQ-2026-0001", "im-ci-note-0": "It states the schedule." });
  pick(p, "im-ci-role-0", "supports");
  await press(p, "citeimported", { reason: "x" });
  const b = last(p, "citeimported").body;
  delete b.reason; // the shell's mark of a reasoned act
  assert.deepEqual(b, { inquiry: "INQ-2026-0001", import: ACCEPTED.import, finding: FIRST, edition: ACCEPTED.edition, role: "supports", note: "It states the schedule." });
  const none = await open(BARE_IMP, { plane: IMPORT(false) });
  assert.ok(!ops(none).includes("citeimported") && !drew(none, "screen.imported.citeimp.head"));
  /* a refusal the real op gives: the import and finding do not spell another team's finding */
  const malformed = ok((await citeimportedAnswer({ finding: "FND-2026-0032" })).answer);
  const bad = await open(IMP, { plane: { ...IMPORT(true), citeimported: malformed } });
  fill(bad, { "im-ci-q-0": "INQ-2026-0001" });
  pick(bad, "im-ci-role-0", "cuts_against");
  await press(bad, "citeimported", { reason: "x" });
  assert.ok(!hasWord("refusal." + malformed.json.result.code) && text(bad).includes(malformed.json.result.translation), "no word is held for it: the plane's own translation is drawn");
  /* IMPORTED_NOT_ACCEPTED: case-import's real refusal, citation's BASIS_REFUSED carrying it in findings[0].code */
  const refused = await open(IMP, { plane: { ...IMPORT(true), citeimported: await provided.citeimportedRefused() } });
  fill(refused, { "im-ci-q-0": "INQ-2026-0001" });
  pick(refused, "im-ci-role-0", "cuts_against");
  await press(refused, "citeimported", { reason: "x" });
  assert.ok(drew(refused, "screen.imported.citeimp.ref.notaccepted1"));
});

const PUBLIC = { session: null };
const SIGHT = { statement: "This case does not examine the 2019 lease amendment.", statement_by: "mai", author: "rosa", at: "2026-09-18T10:00:00Z",
  acknowledgements: [{ kind: "recipient", by: "RVG-1", recipient: "Prof. N. Iyer", at: "2026-09-15T09:00:00Z", reason: "The gap is fairly stated." }] };
const TENSION = { candidate: "CAND-1", finding: F1, state: "open", highlighted: false, unseen_other_side: false, depth: 1, acknowledged_by: "dev", acknowledged_at: "2026-09-15T09:00:00Z",
  owner_words: { text: "Being checked against the postmark.", by: "the team" }, kind: null, explanation: "The vote covered amendment 1.",
  sides: { a: { text: "the minutes record a vote" }, b: { text: "the adjustment cites no vote" } } };
const HIGH = { candidate: "CAND-2", finding: F1, state: "open", highlighted: true, unseen_other_side: true, depth: 1, side: { text: "the ledger shows March" }, sentence: word("case-disclosures.finding_rests_side") };

test("R47 the published page draws what the case leaves out and who else read that statement, the declared bias, each disclosed contradiction (a highlighted one by its fixed sentence) and each evidence row's grade, each only when the answer holds it", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: publishedPlane([FINDING(F1)], { completeness: SIGHT, bias_acknowledgement: "We read the Department's own reports closely.", tensions: [TENSION, HIGH],
    captures: [{ title: "Council minutes", sha256: E1, grade: "B", axis: "capture" }] }) });
  const t = main(p).textContent;
  assert.ok(drew(p, "screen.published.what_this_case_leaves_out") && t.includes(SIGHT.statement));
  assert.ok(drew(p, "screen.published.written_by_writer_and_published", { writer: "mai", publisher: "rosa", date: day("2026-09-18") }));
  assert.ok(drew(p, "screen.published.who_else_read_this_statement") && t.includes("Prof. N. Iyer") && t.includes("The gap is fairly stated.") && !t.includes("RVG-1"));
  assert.ok(drew(p, "screen.published.contradictions_the_team_disclosed") && t.includes("the minutes record a vote") && t.includes("The vote covered amendment 1."));
  assert.ok(drew(p, "screen.published.read_by_who_on_date", { who: "dev", date: day("2026-09-15") }));
  assert.ok(p.doc.querySelector("[data-highlighted]").textContent.includes(HIGH.sentence), "a highlighted one is set apart by its fixed sentence");
  assert.ok(t.includes("the ledger shows March"), "its seen side is shown");
  assert.ok(drew(p, "screen.published.the_lens_this_team_read") && t.includes("We read the Department's own reports closely."));
  assert.ok(p.doc.querySelector("[data-evidence-grade]"), "the evidence row's grade");
});

test("R47 without them the sections are not drawn (R20); no acknowledgements say no one else has read, and a null list says the edition does not say; no contradictions say so", async () => {
  const none = await open(`/app/published/${C}`, { boot: PUBLIC, plane: publishedPlane([FINDING(F1)]) });
  for (const k of ["screen.published.what_this_case_leaves_out", "screen.published.contradictions_the_team_disclosed", "screen.published.the_lens_this_team_read"]) assert.ok(!drew(none, k), k);
  assert.ok(!none.doc.querySelector("[data-evidence-grade]"));
  const sparse = await open(`/app/published/${C}`, { boot: PUBLIC, plane: publishedPlane([FINDING(F1)], { completeness: { ...SIGHT, acknowledgements: [] }, tensions: [] }) });
  assert.ok(drew(sparse, "screen.published.no_one_else_on_the") && drew(sparse, "screen.published.the_team_disclosed_no_contradictions"));
  const unsaid = await open(`/app/published/${C}`, { boot: PUBLIC, plane: publishedPlane([FINDING(F1)], { completeness: { ...SIGHT, acknowledgements: null }, tensions: null }) });
  assert.ok(drew(unsaid, "screen.published.this_edition_does_not_say") && drew(unsaid, "screen.published.this_edition_was_signed_before"));
});

test("R54 a file chosen on the published page is fingerprinted in the page and compared with the case's fingerprints; the request carries nothing but the hash and no file leaves the page", async () => {
  const bytes = new Uint8Array([37, 80, 68, 70, 45, 49]);
  const hex = Array.from(new Uint8Array(await webcrypto.subtle.digest("SHA-256", bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { ...publishedPlane([FINDING(F1)]), verify: ok({ published: false, sha256: hex, matches: [] }) } });
  choose(p, "pb-file", bytes);
  const n = p.requests.length;
  await press(p, "verify", { nth: 1 });
  await until(p, () => p.requests.slice(n).some((r) => r.op === "verify")); // the file is hashed by the browser's crypto, asynchronously
  const sent = p.requests.slice(n).filter((r) => r.op === "verify");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].query.sha256, hex, "the SHA-256 worked out in the page");
  assert.deepEqual(Object.keys(sent[0].query).sort(), ["op", "sha256"]);
  assert.equal(sent[0].body, undefined, "the file's bytes are not sent");
  assert.equal(sent[0].headers.Authorization, undefined);
  assert.ok(drew(p, "published.check.no"));
  for (const r of p.requests) assert.ok(!JSON.stringify([r.query, r.body]).includes("%PDF"), `${r.op}: no file text`);
  const empty = await open(`/app/published/${C}`, { boot: PUBLIC, plane: publishedPlane([FINDING(F1)]) });
  const m = empty.requests.length;
  await press(empty, "verify", { nth: 1 });
  assert.equal(empty.requests.slice(m).filter((r) => r.op === "verify").length, 0, "control: no file and no hash, nothing is sent");
});

/* case-inputs' real `casedetails` for a published case with two of the four details recorded (area, contact), and its public read: the screens' expectations are read from them */
const RECORDED = await provided.casedetails();
const DETAIL_ROWS = RECORDED.json.result.details;
const STATED = Object.keys(DETAIL_ROWS).filter((f) => DETAIL_ROWS[f].stated);
const AREA_WORDS = DETAIL_ROWS.area.value[0].words;
const DETAIL_EDITOR = (answer = RECORDED) => ({ casedetails: answer });
/** Presses the act button `sel` names, giving the reason the shell asks for a reasoned act (its mark, not a declared field). */
const click = async (p, sel) => {
  const b = p.doc.querySelector(sel);
  await p.click(b);
  const slot = p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`);
  const ta = slot && slot.querySelector('textarea[id^="cs-reason-"]');
  if (ta) { ta.value = "x"; await p.click(slot.querySelector('[data-shell="reason-send"]')); }
  await p.settle();
};
const sent = (p, op) => { const { reason, ...rest } = last(p, op).body; return rest; };

test("R57 the details of this work are drawn once the case has an id and before it only the note says they open once it is saved; each row sends casedetailsset with the declared shape and is read back", async () => {
  const first = await open(`/app/case-editor/${P}/${DR}`, { plane: { casedrafts: ok({ kind: "review-drafts", project: P, drafts: [{ draft_id: DR, case: { identity: "A case this draft does not name" }, created_by: "dev", updated_by: "dev" }] }),
    reviewcopy: ok(COPY({ case: { case_id: null, edition: null, identity: "x", newCase: true } })) } });
  assert.ok(drew(first, "screen.case-editor.details.first") && !first.doc.querySelector("[data-detail]"), "before the first save: the note alone");
  assert.ok(!ops(first).includes("casedetailsset"));
  const p = await open(EDITOR, { plane: DETAIL_EDITOR() });
  assert.equal(p.doc.querySelectorAll("[data-detail]").length, 4, "four rows, no classification row");
  assert.ok(drew(p, "screen.case-editor.details.intro1") && drew(p, "screen.case-editor.details.outward2"));
  assert.equal(p.doc.querySelectorAll("[data-notstated]").length, 4 - STATED.length, "each Not stated until set");
  const set = (field, mode) => `button[data-act="casedetailsset"][data-field="${field}"][data-mode="${mode}"]`;
  fill(p, { "cd-words": "Housing and rent policy" });
  await click(p, set("area", "add"));
  assert.deepEqual(sent(p, "casedetailsset"), { case: C, field: "area", value: [...DETAIL_ROWS.area.value, { words: "Housing and rent policy" }] }, "an area added joins those stated");
  pick(p, "cd-contact", "doorbell");
  await click(p, set("contact", "save"));
  assert.deepEqual(sent(p, "casedetailsset"), { case: C, field: "contact", value: { kind: "doorbell" } });
  fill(p, { "cd-rel-link": "https://example.org/housing-study", "cd-rel-relation": "disagrees_with", "cd-rel-words": "A competing reading" });
  await click(p, set("related", "add"));
  assert.deepEqual(sent(p, "casedetailsset"), { case: C, field: "related", value: [{ relation: "disagrees_with", url: "https://example.org/housing-study", words: "A competing reading" }] });
  pick(p, "cd-rels", "none");
  await click(p, set("relationships", "save"));
  assert.deepEqual(sent(p, "casedetailsset"), { case: C, field: "relationships", value: { none: true } });
  assert.ok(main(p).textContent.includes(AREA_WORDS), "what is stated reads back; the rest is Not stated");
});

test("R57 the owner's refusal is drawn by its words and the details are kept (control); a row with nothing typed sends nothing", async () => {
  const refused = (await provided.casedetailsset()).json.result.notOwner; // case-inputs' real refusal of a joined member's write
  assert.equal(refused.reason, "NOT_THE_PROJECT_OWNER");
  const p = await open(EDITOR, { plane: { ...DETAIL_EDITOR(), casedetailsset: ok(refused) } });
  await click(p, 'button[data-act="casedetailsset"][data-field="area"][data-mode="add"]');
  assert.equal(p.byOp("casedetailsset").length, 0, "nothing typed: nothing sent");
  fill(p, { "cd-words": "Housing" });
  await click(p, 'button[data-act="casedetailsset"][data-field="area"][data-mode="add"]');
  assert.ok(drew(p, "screen.case-editor.details.refused.owner1"));
});

test("R57 the ceremony lists the four details stated or not stated and no Publish is disabled by them; published draws what casedetailspublic answers and nothing for a field not stated (control)", async () => {
  const cer = await open(CER, { plane: DETAIL_EDITOR() });
  assert.equal(cer.doc.querySelectorAll("[data-detail]").length, 4);
  assert.equal(cer.doc.querySelectorAll("[data-stated]").length, STATED.length);
  assert.equal(cer.doc.querySelectorAll("[data-notstated]").length, 4 - STATED.length);
  assert.ok(drew(cer, "screen.ceremony.details.ceremony.notstated2"));
  assert.ok(!cer.doc.querySelector('button[data-act="publish"][disabled]'), "none of them stops the publishing");
  const pub = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { ...publishedPlane([FINDING(F1)]), casedetailspublic: await provided.casedetailspublic() } });
  assert.ok(main(pub).textContent.includes(AREA_WORDS));
  assert.ok(drew(pub, "screen.published.details.pub.current1"));
  assert.equal(pub.doc.querySelectorAll("[data-detail]").length, STATED.length, "a field not stated draws nothing");
});

test("R68 a project whose title the viewer cannot read is named by the unjoined crumb and no PROJ- text is drawn; NO_REVIEW_COPY is drawn by its key; a readable project draws its title (control)", async () => {
  const p = await open(CER, { plane: { image: refusedIn("NOT_FOUND", ""), reviewcopy: refusedIn("NO_REVIEW_COPY", "") } });
  const crumb = p.root().textContent;
  assert.ok(crumb.includes(word("crumb.project.unjoined")), "the unjoined crumb");
  assert.ok(!crumb.includes("PROJ-"), "no project id is drawn");
  assert.ok(drew(p, "refusal.NO_REVIEW_COPY"));
  const q = await open(CER);
  assert.ok(q.root().textContent.includes("The Coliseum lease"), "control: a readable project draws its title");
});

test("R59 the assistant helps with the citing note only while it is reachable: it sends the note for citeimported and draws wizard-scripts' real refusal in its words, the field left as typed (B420 3); not reachable draws no help (control)", async () => {
  const reach = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
  /* the real `writinghelp` never returns a draft (K5212): the draft already held in the field, or the assistant unreachable */
  for (const which of ["held", "unreachable"]) {
    const answer = await provided.writinghelp(which);
    const p = await open(IMP, { plane: { ...IMPORT(true), ...reach, writinghelp: answer } });
    const help = p.root().querySelector('button[data-act="writinghelp"]');
    assert.ok(help, "help is drawn beside the note");
    assert.equal(help.getAttribute("data-field"), "note");
    assert.equal(help.getAttribute("data-forop"), "citeimported");
    assert.equal(help.getAttribute("data-id"), "im-ci-note-0");
    const accepted = ACCEPTED.answer.json.result.edition.findings.filter((x) => x.origin?.acceptance).length;
    assert.equal(p.root().querySelectorAll('button[data-act="writinghelp"]').length, accepted, "one citing note per accepted finding, and nothing else");
    await press(p, "writinghelp", { values: { "im-ci-note-0": "schedule 2025" } });
    assert.deepEqual(last(p, "writinghelp").body, { op: "citeimported", field: "note", told: "schedule 2025" });
    assert.equal(p.doc.getElementById("im-ci-note-0").value, "schedule 2025", `${which}: the field is left as typed`);
    assert.ok(text(p).includes(refusalWords(answer)), `${which}: the refusal in its words`);
  }
  const off = await open(IMP, { plane: IMPORT(true) });
  assert.equal(off.root().querySelectorAll('button[data-act="writinghelp"]').length, 0);
});

test("R57 the details are named by key, Not stated by key and 'Take out' by key; the ceremony marks a stated detail 'Stated' (B428)", async () => {
  const p = await open(EDITOR, { plane: DETAIL_EDITOR() });
  for (const f of ["area", "contact", "related", "relationships"]) assert.ok(drewIn(p.doc.querySelector(`[data-detail="${f}"]`), `screen.case-editor.details.name.${f}`), f);
  assert.equal(p.doc.querySelectorAll("[data-notstated]").length, 4 - STATED.length);
  assert.ok(drew(p, "case-inputs.details.not_stated"));
  assert.ok(p.root().querySelectorAll('button[data-act="casedetailsset"]').some((b) => b.textContent.includes(word("screen.case-editor.details.takeout"))), "Take out");
  const cer = await open(CER, { plane: DETAIL_EDITOR() });
  assert.equal(cer.doc.querySelectorAll("[data-stated]").length, STATED.length);
  assert.ok(drew(cer, "screen.case-editor.details.stated") && drew(cer, "screen.case-editor.details.name.contact"));
  const pub = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { ...publishedPlane([FINDING(F1)]), casedetailspublic: await provided.casedetailspublic() } });
  assert.ok(drew(pub, "screen.case-editor.details.name.area"));
});

/* The related works and the "no relationships" standing are case-inputs' own published answers (`casedetailsRelated`, `casedetailsNone`). */
test("R57 a related work is drawn by its relation's word; a published 'no relationships' is drawn by its key", async () => {
  const related = await provided.casedetailsRelated();
  const p = await open(EDITOR, { plane: { casedetails: related.recorded } });
  for (const r of related.recorded.json.result.details.related.value) assert.ok(drew(p, `screen.case-editor.details.rel.${r.relation}`), r.relation);
  const shown = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { ...publishedPlane([FINDING(F1)]), casedetailspublic: related.publicRead } });
  for (const r of related.publicRead.json.result.details.related.value) assert.ok(text(shown).includes(r.words), "published draws the work as stated: " + r.words);
  assert.ok(!drew(shown, "screen.case-editor.details.ties.none"), "control: related works stated, no 'none' standing");
  const none = await provided.casedetailsNone();
  const pub = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { ...publishedPlane([FINDING(F1)]), casedetailspublic: none.publicRead } });
  assert.ok(drew(pub, "screen.case-editor.details.ties.none"));
});

test("R44 a finding's role choice is labelled by 'Finding {n}: its role in the case' and its two choices by key (B428)", async () => {
  const p = await open(EDITOR);
  const group = p.doc.getElementById("ce-role-0");
  assert.ok(drewIn(group, "screen.case-editor.finding.role", { n: "1" }));
  assert.ok(drewIn(group, "screen.case-editor.role.relied") && drewIn(group, "screen.case-editor.role.supporting"));
});

test("R51 each document held without a second confirmation has its tick 'Publish {document} as self-attested only' (B428)", async () => {
  const p = await open(CER, { boot: { idb: await keptKey() }, plane: { ...DOCS } });
  assert.ok(drew(p, "screen.ceremony.conf.self.tick", { document: B64.slice(0, 12) }));
});
