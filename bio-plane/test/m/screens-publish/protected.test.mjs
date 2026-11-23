/* screens-publish: the words the Screens page "Publishing" puts on these screens that they drew nowhere before (ARCH's code differences of
 * 22 Nov 2026): on the ceremony the Sign step's protected words once a time is chosen (R12), what the key signs (R13), the photo rules (R4)
 * and the refusals of what is disclosed and of a document self-attested (R46, R51); on the case editor the refusals of what the case states
 * about itself and of a citation moved (R44, R53); on the review copy the band, the reader's link line and each live link's day and comments
 * (R2, R73); on the imported page the lens shown, the two bars and the assistant's refused citation (R58, R59); and on the docket the posted
 * edition and where the next edition opens (R8, R52). Each sentence is asserted by its key (R24). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { importRegradeAnswer } from "../case-import/fixtures.mjs";
import { open, main, drew, drewIn, day, clock, word, ops, press, fill, tick, last, ok, refused, refusedIn, keptKey, importedCase, PREFLIGHT, COPY, P, DR, C, B1, GRANT_SECRET, GRANT_UNTIL } from "./fixtures.mjs";

const CER = `/app/ceremony/${P}/${DR}`;
const R = "because";
const norm = (el) => String(el ? el.textContent : "").replace(/\s+/g, " ").trim();
const fold = (p, summary) => main(p).querySelector(`details[data-fold="${summary}"]`);

/** The ceremony with its Ties step confirmed: the edition prepared, the Sign step offered. */
async function prepared(o = {}) {
  const p = await open(CER, o);
  tick(p, "ce-tie", "yes");
  await press(p, "publish", { reason: R });
  return p;
}
/** A field typed into as the member types: its value set, the input event fired, and the half second the page waits run. */
async function type(p, id, value) {
  const el = p.doc.getElementById(id);
  el.value = value;
  p.fire(el, "input");
  await p.clock.tick(600);
  await p.settle();
}

/* ---------- ceremony ---------- */

test("R12 once a set time is chosen and its day and time given, the choice reads `.when.chosen`, `.when.note` is said under it and the button is `.publishat.button`, before anything is signed", async () => {
  const p = await prepared({ boot: { idb: await keptKey() } });
  const when = p.doc.getElementById("ce-when");
  when.value = "at";
  p.fire(when, "change");
  await p.settle();
  assert.ok(!main(p).querySelector("[data-when-note]"), "control: no note until a time is given");
  await type(p, "ce-date", "2026-11-19");
  await type(p, "ce-time", "06:00");
  const option = p.doc.getElementById("ce-when").querySelectorAll("option").find((o) => o.getAttribute("value") === "at");
  assert.equal(option.textContent.replace(/\s+/g, " ").trim(), word("screen.ceremony.when.chosen", { date: day("2026-11-19"), time: clock("06:00"), zone: "America/Los_Angeles" }).replace(/\s+/g, " ").trim());
  assert.ok(drewIn(main(p).querySelector("[data-when-note]"), "screen.ceremony.when.note", { time: clock("06:00") }));
  const b = main(p).querySelector('button[data-act="publishat"]');
  assert.ok(drewIn(b, "screen.ceremony.publishat.button", { time: clock("06:00"), date: day("2026-11-19") }));
  assert.equal(p.doc.getElementById("ce-date").value, "2026-11-19", "the day given stays in its field across the redraw");
  assert.equal(p.byOp("publishat").length, 0, "nothing is sent before the press");
  /* control: "Sign and publish now" keeps its own label and draws no note */
  const again = p.doc.getElementById("ce-when");
  again.value = "now";
  p.fire(again, "change");
  await p.settle();
  assert.ok(main(p).querySelector('button[data-act="caseratify"]').textContent.includes(word("act.caseratify.label.ceremony")));
  assert.ok(!main(p).querySelector("[data-when-note]"));
});

test("R13 \"What your key signs, exactly\" says how many lines the evidence makes, naming each piece (`.signs.lines`), and what each line is (`.signs.linesabout`)", async () => {
  const p = await prepared({ boot: { idb: await keptKey() } });
  const box = main(p).querySelector("[data-statements]");
  assert.ok(drewIn(box, "screen.ceremony.signs.lines", { n: "1", findings: "1", list: "INFO-2026-0004" }));
  assert.ok(drewIn(box, "screen.ceremony.signs.linesabout"));
  /* control: with no evidence signed, the lines sentence is not said; what each line is still is */
  const q = await prepared({ boot: { idb: await keptKey() }, plane: { casedocument: () => ok({ case_id: C, edition: 2, doc_sha: "a".repeat(64), text: "…", published_at: null,
    sign: { namespace: "bio-ratify", statement: `bio-ratify-case ${C} 2 ${"a".repeat(64)}\n` }, citations: { state: "signed", rows: [] }, findings: [{ target: "FND-2026-0031", version_sha: B1, role: "load_bearing" }] }) } });
  const box2 = main(q).querySelector("[data-statements]");
  assert.equal(box2.querySelector("[data-signs-lines]"), null);
  assert.ok(drewIn(box2, "screen.ceremony.signs.linesabout"));
});

test("R4 the Photos step says the photo rules (`.photos.rules`) beside each photo the case carries; a case with no photo draws no Photos step (control)", async () => {
  const p = await open(CER);
  assert.ok(drewIn(main(p).querySelector("[data-photo-rules]"), "screen.ceremony.photos.rules"));
  const pre = PREFLIGHT();
  pre.steps[3] = { photos: [], unchecked: 0 };
  const q = await open(CER, { plane: { publishpreflight: ok(pre) } });
  assert.ok(!drew(q, "screen.ceremony.photos.rules"));
});

test("R46 a contradiction that stops the signing is said in the fold \"When a contradiction is refused\" by the design's sentences for its code; a read that cannot be completed says the unread sentence; with none, no fold (control)", async () => {
  const p = await open(CER); // the pre-flight answers TENSION_NOT_DISCLOSED among its blockers
  const f = fold(p, "screen.ceremony.disc.refused.summary");
  assert.ok(f && drewIn(f, "screen.ceremony.disc.refused.summary"));
  assert.ok(drewIn(f, "screen.ceremony.disc.refused.notlisted1") && drewIn(f, "screen.ceremony.disc.refused.notlisted2"));
  const q = await open(CER, { plane: { publishpreflight: ok(PREFLIGHT({ first: null, blockers: [{ ok: false, code: "DISCLOSURE_NOT_STANDING" }] })) } });
  const g = fold(q, "screen.ceremony.disc.refused.summary");
  assert.ok(drewIn(g, "screen.ceremony.disc.refused.standing1") && drewIn(g, "screen.ceremony.disc.refused.standing2") && !drewIn(g, "screen.ceremony.disc.refused.notlisted1"));
  const r = await open(CER, { plane: { publishtensions: refusedIn("TENSIONS_UNDETERMINED") } });
  assert.ok(drewIn(fold(r, "screen.ceremony.disc.refused.summary"), "screen.ceremony.disc.refused.unread"));
  const none = await open(CER, { plane: { publishpreflight: ok(PREFLIGHT({ first: null, blockers: [], ready: true })) } });
  assert.equal(fold(none, "screen.ceremony.disc.refused.summary"), null);
});

/* R51's documents without a second confirmation, as the pre-flight lists them */
const B64 = "e".repeat(64);
const WITH_DOC = (o = {}) => { const pre = PREFLIGHT(o); pre.steps.push({ not_co_attested: [{ capture: B64, by: "dev", findings: [] }] }); return pre; };

test("R51 a document listed as self-attested only with no reason is refused in place and said again in \"When these are refused\" with both sentences; a capture account refused to a member who did not capture it says the actor sentence", async () => {
  const p = await open(CER, { plane: { publishpreflight: ok(WITH_DOC()), captureaccounts: ok({ captureSha: B64, actors: [{ actor: "dev" }], accounts: [] }) } });
  assert.equal(fold(p, "screen.ceremony.conf.refused.summary"), null, "control: nothing refused, no fold");
  tick(p, "ce-sa", B64);
  await press(p, "publishpreflight");
  assert.equal(p.byOp("publishpreflight").length, 1, "nothing more is sent");
  const f = fold(p, "screen.ceremony.conf.refused.summary");
  assert.ok(f && drewIn(f, "screen.ceremony.conf.refused.noreason1") && drewIn(f, "screen.ceremony.conf.refused.noreason2"));
  const q = await open(CER, { boot: { idb: await keptKey() }, plane: { publishpreflight: ok(WITH_DOC()), captureaccounts: ok({ captureSha: B64, actors: [{ actor: "dev" }], accounts: [] }),
    captureaccount: ok({ ok: false, code: "NOT_THE_CAPTURING_ACTOR", reason: "NOT_THE_CAPTURING_ACTOR" }) } });
  fill(q, { "ce-cap-0": "I saved it." });
  await press(q, "captureaccount", { reason: R });
  const { answerSign } = await import("./fixtures.mjs");
  await answerSign(q, true, "captureaccount");
  assert.ok(drewIn(fold(q, "screen.ceremony.conf.refused.summary"), "screen.ceremony.conf.refused.actor"));
  /* the plane's refusal of an unlisted document, from the pre-flight */
  const r = await open(CER, { plane: { publishpreflight: ok(WITH_DOC({ first: null, blockers: [{ ok: false, code: "CO_ATTESTATION_UNACKNOWLEDGED" }] })) } });
  const g = fold(r, "screen.ceremony.conf.refused.summary");
  assert.ok(drewIn(g, "screen.ceremony.conf.refused.unlisted1") && drewIn(g, "screen.ceremony.conf.refused.unlisted2"));
});

/* ---------- case editor ---------- */

const EDITOR = `/app/case-editor/${P}/${DR}`;
test("R44 a Save the plane refuses for what the case states about itself is said in its fold: roles, a field, the position, the bias acknowledgement; another refusal is drawn as before (control)", async () => {
  const cases = [["BAD_ROLES", "screen.case-editor.when_the_roles_cant_be_saved", "a_finding_has_no_role_or", "choose_a_role_for_every_finding"],
    ["BELOW_PROJECT_STRENGTH", "screen.case-editor.when_the_roles_cant_be_saved", "a_finding_you_rely_on_does", "make_it_supporting_or_strengthen_it"],
    ["BAD_EXCLUSION", "screen.case-editor.when_it_cant_be_saved", "an_item_names_nothing_or_has", "say_what_is_left_out_and"],
    ["BAD_COMPLETENESS", "screen.case-editor.when_it_cant_be_saved", "a_field_is_longer_than_2000", "shorten_it_or_reword_it_then"],
    ["NO_SUBJECT_POSITION", "screen.case-editor.when_the_position_cant_be_saved", "no_position_is_chosen_or_it", "choose_one_and_say_why"],
    ["BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD", "screen.case-editor.when_it_cant_be_saved", "the_acknowledgement_is_missing_or_it", "write_it_for_this_edition"]];
  for (const [code, summary, a, b] of cases) {
    for (const answer of [refusedIn(code), refused(code)]) {
      const p = await open(EDITOR, { plane: { casedraft: answer } });
      await press(p, "casedraft", { reason: R });
      assert.equal(p.byOp("casedraft").length, 1, code);
      const f = fold(p, summary);
      assert.ok(f && drewIn(f, summary) && drewIn(f, "screen.case-editor." + a) && drewIn(f, "screen.case-editor." + b), `${code}: ${summary}`);
    }
  }
  const other = await open(EDITOR, { plane: { casedraft: refusedIn("REVIEW_NO_SUCH_DRAFT", "No such draft.") } });
  await press(other, "casedraft", { reason: R });
  for (const s of ["when_the_roles_cant_be_saved", "when_it_cant_be_saved", "when_the_position_cant_be_saved"]) assert.equal(fold(other, "screen.case-editor." + s), null);
});

test("R53 a citation the plane will not take out for want of a reason, or for a viewer who is not a member, is said in \"When a citation can't be moved\"", async () => {
  const md = ["---", `id: ${P}`, "object_type: project", "title: \"The Coliseum lease\"", "references:", "  - target: INFO-2026-0004", "    rel: cites", "    status: confirmed", "---", ""].join("\n");
  const p = await open(EDITOR, { plane: { image: ok({ "bundle.md": md }), sever: refusedIn("NO_REASON") } });
  assert.ok(ops(p).includes("sever"), "the case editor offers Remove on a cited passage");
  await press(p, "sever", { reason: "It no longer bears." });
  const f = fold(p, "screen.case-editor.when_a_citation_cant_be_moved");
  assert.ok(f && drewIn(f, "screen.case-editor.you_gave_no_reason_or_you") && drewIn(f, "screen.case-editor.write_why_or_ask_a_member"));
});

/* ---------- review copy ---------- */

const RC = `/app/review-copy/${P}`;
test("R2 the review copy carries the band: how many outside readers hold a live link, until the latest end day in the team's zone; with no live link, none (control)", async () => {
  const p = await open(RC);
  assert.ok(drewIn(main(p).querySelector('[data-band="review"]'), "screen.review-copy.band", { n: "1", date: day("2099-10-20") }));
  const two = await open(RC, { plane: { reviewcopy: ok(COPY({ grants: [{ grant_id: "GRT-1", recipient: "A", until: GRANT_UNTIL, zone: "America/Los_Angeles" },
    { grant_id: "GRT-2", recipient: "B", until: "2099-11-01T06:59:59Z", zone: "America/Los_Angeles" }] })) } });
  assert.ok(drew(two, "screen.review-copy.band", { n: "2", date: day("2099-10-31") }), "the latest end, in the team's zone");
  const none = await open(RC, { plane: { reviewcopy: ok(COPY({ grants: [{ grant_id: "GRT-1", recipient: "A", until: "2020-01-01T00:00:00Z", zone: "America/Los_Angeles" }] })) } });
  assert.equal(main(none).querySelector('[data-band="review"]'), null);
});

test("R2 the reader's link, shown once, is followed by the one line the design words for it: for whom, until the day chosen, and that Civicsmith sends no email (`.link.line`)", async () => {
  const p = await open(RC, { plane: { reviewgrant: ok({ grantId: "GRT-2", draftId: DR, recipient: "Ana", secret: GRANT_SECRET }) } });
  await press(p, "reviewgrant", { reason: R, values: { "rc-name": "Ana", "rc-role": "editor", "rc-until": "2099-10-30" } });
  assert.ok(drewIn(main(p).querySelector("[data-reader-link]"), "screen.review-copy.link.line", { who: "Ana", until: day("2099-10-30") }));
});

test("R73 each live review link on any draft says the day it was shared and how many comments its reader made; a reader with none draws no count (control)", async () => {
  const OLD = "RVD-2026-0000";
  const drafts = { kind: "review-drafts", project: P, drafts: [
    { draft_id: OLD, case: { case_id: C, edition: 1, identity: "The Coliseum lease" }, created_by: "dev", updated_by: "dev", created_at: "2026-09-18T10:00:00Z" },
    { draft_id: DR, case: { case_id: C, edition: 2, identity: "The Coliseum lease" }, created_by: "dev", updated_by: "dev", created_at: "2026-10-12T10:00:00Z" }] };
  const G = (id, who, at) => ({ grant_id: id, recipient: who, until: GRANT_UNTIL, zone: "America/Los_Angeles", issued_at: at });
  const C1 = (id, g) => ({ comment_id: id, author_kind: "recipient", author: "x", grant_id: g, recipient: "x", text: "t", at: "2026-10-07T09:00:00Z" });
  const byDraft = { [OLD]: { grants: [G("GRT-OLD", "Ms. L. Brandt", "2026-09-20T10:00:00Z")], comments: [C1("RVC-1", "GRT-OLD"), C1("RVC-2", "GRT-OLD")] },
    [DR]: { grants: [G("GRT-NEW", "Prof. N. Iyer", "2026-10-13T10:00:00Z")], comments: [] } };
  const p = await open(`${RC}/${DR}`, { plane: { casedrafts: ok(drafts), reviewcopy: (req) => ok(COPY({ draft: req.query.draft, ...byDraft[req.query.draft] })) } });
  const sec = [...main(p).querySelectorAll("section")].find((s) => drewIn(s, "screen.review-copy.links.heading"));
  assert.ok(sec);
  assert.ok(drewIn(sec, "screen.review-copy.links.shared", { date: day("2026-09-20") }) && drewIn(sec, "screen.review-copy.links.shared", { date: day("2026-10-13") }));
  assert.ok(drewIn(sec, "screen.review-copy.links.comments.other", { n: "2" }));
  assert.equal(sec.querySelectorAll("[data-comments]").length, 1, "a reader with no comment draws no count");
});

/* ---------- imported ---------- */

test("R58 read with the source's bias removed, the rows say so (`.lens_shown`) and each finding whether it meets the team's bar and met the source's, under that lens (case-import's real answer)", async () => {
  const RG = await importRegradeAnswer({ lens: "removed" });
  const A = await importedCase({ accepted: true });
  const p = await open(`/app/imported/${A.import}/${A.edition}`, { plane: { importedcase: A.answer, importregrade: ok(RG.answer.json ? RG.answer.json.result : RG.answer) } });
  p.doc.getElementById("im-lens").querySelectorAll("input").forEach((i) => { i.checked = i.value === "removed"; });
  await press(p, "importregrade");
  const shown = main(p).querySelector("[data-regrade]");
  assert.ok(drewIn(shown, "screen.imported.lens_shown"));
  const found = (RG.answer.json ? RG.answer.json.result : RG.answer).findings.filter((f) => f.bar_met && typeof f.bar_met.own === "boolean");
  assert.ok(found.length, "the real answer states a standing against the bars");
  const yesno = (b) => ({ answer: word(b ? "screen.imported.lens_bar.yes" : "screen.imported.lens_bar.no") });
  assert.ok(drewIn(shown, "screen.imported.lens_bar_ours", yesno(found[0].bar_met.own)));
  if (typeof found[0].bar_met.source === "boolean") assert.ok(drewIn(shown, "screen.imported.lens_bar_theirs", yesno(found[0].bar_met.source)));
  /* control: as the source published it, the removed-bias caption is not said */
  const q = await open(`/app/imported/${A.import}/${A.edition}`, { plane: { importedcase: A.answer, importregrade: ok({ ...(RG.answer.json ? RG.answer.json.result : RG.answer), lens: "as_published", requested_lens: "as_published" }) } });
  q.doc.getElementById("im-lens").querySelectorAll("input").forEach((i) => { i.checked = i.value === "as_published"; });
  await press(q, "importregrade");
  assert.ok(!drew(q, "screen.imported.lens_shown"));
});

/** The imported page read under `lens`, with one finding that the answer says moved (or not) and stands against both bars. */
async function underLens(lens, moved = true, chosen = lens) {
  const A = await importedCase({ accepted: true });
  const answer = { ok: true, import: A.import, edition: A.edition, requested_lens: lens, lens, limit: null,
    findings: [{ finding: "FND-W-1", published: { pair: { capture: "B", connection: "B" } }, pair: { capture: "B", connection: moved ? "C" : "B" }, moved, because: [], bar_met: { own: true, source: false } }] };
  const p = await open(`/app/imported/${A.import}/${A.edition}`, { plane: { importedcase: A.answer, importregrade: ok(answer) } });
  p.doc.getElementById("im-lens").querySelectorAll("input").forEach((i) => { i.checked = i.value === chosen; });
  await press(p, "importregrade");
  return main(p).querySelector("[data-regrade]");
}

test("R58 (U15) a shown-line is drawn under every lens, each its own sentence: as published `.lens_shown.as_published`, the source's bias removed `.lens_shown`, the team's lens `.lens_shown.own`", async () => {
  const each = { as_published: "screen.imported.lens_shown.as_published", removed: "screen.imported.lens_shown", own: "screen.imported.lens_shown.own" };
  for (const [lens, key] of Object.entries(each)) {
    const r = await underLens(lens, lens !== "as_published");
    assert.ok(drewIn(r, key), lens);
    for (const other of Object.values(each).filter((k) => k !== key)) assert.ok(!drewIn(r, other), `${lens} draws no ${other}`);
  }
  /* control: the team's lens chosen, but the plane could not determine it: no shown-line is drawn */
  const u = await underLens("undetermined", false, "own");
  for (const k of Object.values(each)) assert.ok(!drewIn(u, k), k);
});

test("R58 (U15) under the team's lens a moved finding reads `.lens_moved.own`; with the source's bias removed `.lens_moved`; read as published no moved-line is drawn; the bars answer imported's lower-case yes and no", async () => {
  const pair = { published: "B/B", regraded: "B/C" };
  const own = await underLens("own");
  assert.ok(drewIn(own, "screen.imported.lens_moved.own", pair) && !drewIn(own, "screen.imported.lens_moved", pair));
  assert.ok(drewIn(own, "screen.imported.lens_bar_ours", { answer: word("screen.imported.lens_bar.yes") }));
  assert.ok(drewIn(own, "screen.imported.lens_bar_theirs", { answer: word("screen.imported.lens_bar.no") }));
  const removed = await underLens("removed");
  assert.ok(drewIn(removed, "screen.imported.lens_moved", pair) && !drewIn(removed, "screen.imported.lens_moved.own", pair));
  /* control: as published, even an answer marking a finding moved draws neither moved-line */
  const asPub = await underLens("as_published");
  assert.ok(!drewIn(asPub, "screen.imported.lens_moved", pair) && !drewIn(asPub, "screen.imported.lens_moved.own", pair));
});

test("R59 a citation of an imported finding the plane refuses because the assistant asked is said in \"When it is refused\" with the machine sentences", async () => {
  const A = await importedCase({ accepted: true });
  const refusal = ok({ ok: false, code: "BASIS_REFUSED", reason: "BASIS_REFUSED", findings: [{ ok: false, code: "MACHINE_CANNOT_CITE_IMPORTED" }] });
  const p = await open(`/app/imported/${A.import}/${A.edition}`, { plane: { importedcase: A.answer, citeimported: refusal } });
  fill(p, { "im-ci-q-0": "INQ-2026-0001" });
  p.doc.getElementById("im-ci-role-0").querySelectorAll("input").forEach((i) => { i.checked = i.value === "supports"; });
  await press(p, "citeimported", { reason: R });
  const f = fold(p, "screen.imported.citeimp.refd");
  assert.ok(f && drewIn(f, "screen.imported.citeimp.ref.machine1") && drewIn(f, "screen.imported.citeimp.ref.machine2"));
  assert.ok(!drewIn(f, "screen.imported.citeimp.ref.notaccepted1"), "control: not the not-accepted sentence");
});

/* ---------- docket ---------- */

const DK = `/app/docket/${P}/${C}`;
test("R8 a posted edition entry says by key which edition it published and which it superseded (`.edition.published`), read from the entry's signed fields; a record entry is drawn by its summary (control)", async () => {
  const p = await open(DK, { plane: { docket: ok({ case: C, project: P, entries: [
    { shelf: "public", seq: 1, entry: `${C}#1`, fields: { kind: "edition", edition: 3, summary: "a summary the key replaces" }, published_at: "2026-11-19T14:00:00Z" },
    { shelf: "record", entry: 2, kind: "response", edition: 3, summary: "The council answered.", state: "filed", filed_at: "2026-11-20T09:00:00Z" }], wrote: false }) } });
  assert.ok(drew(p, "screen.docket.edition.published", { n: "3", prior: "2" }));
  assert.ok(drew(p, "screen.docket.kind.edition") && drew(p, "screen.docket.kind.response"), "each kind read from where its entry states it");
  assert.ok(main(p).textContent.includes("The council answered."));
});

test("R52 beneath \"Start the next edition\" the docket says where the draft opens, a reference to the case being prepared (`.next.opens`)", async () => {
  const p = await open(DK);
  const line = main(p).querySelector("[data-next-opens]");
  assert.ok(line, "drawn where the next edition can be started");
  assert.ok(drewIn(line, "screen.docket.next.opens", { link: word("screen.docket.next.opens.link") }));
  assert.ok(line.querySelector("a"), "the case being prepared is a reference");
});
