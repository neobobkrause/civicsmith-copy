/* screens-public R6, R9, R17, R18, R34, R39, R47 and R56 at the module's interface, its screens served alone in the public
 * frame with no session: the published case and how to read it, its disclosures, the public docket, the doorbell's consent
 * form, and the review copy from outside. Every request is checked to carry no credential. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLISHED } from "../../../src/screens-publish/published.mjs";
import { open, ok, word, main, text, drew, last, day, tipOf, disclosure, press, CASE, COPY, LEFT_OUT, TENSION, GROUP, C, SECRET } from "./fixtures.mjs";

const noCredential = (p) => { for (const r of p.requests) assert.equal(r.headers.Authorization, undefined, `${r.op} carries no credential`); };

test("R6 the published case is drawn with no session: whose work it is, how to read it, and \"How to read a case\" explaining the two strengths", async () => {
  const p = await open(`/app/published/${C}`);
  assert.equal(p.byOp("whoami").length, 0, "no session read");
  noCredential(p);
  assert.ok(drew(p, "screen.published.whose", { group: GROUP }) && drew(p, "screen.published.howtoread"));
  assert.ok(drew(p, "screen.published.dated", { edition: "2", signed: day("2026-11-18"), published: day("2026-11-19") }));
  const link = main(p).querySelector("[data-howtoread]");
  assert.ok(link, "the link is drawn");
  assert.equal(link.textContent.trim(), word("screen.published.howtoread.link"));
  const tip = tipOf(link);
  for (const k of ["tip.capture", "tip.capture_why", "tip.connection"]) assert.ok(tip.includes(word("screen.published." + k)), k);
  assert.ok(tip.includes(word("mark.strength.means")), "the scale explained: an answer is only as strong as its weakest part");
  assert.ok(!tip.includes(word("screen.published.tip.connection_why")), "never the sentence that explains one grade (B)");
  assert.ok(tip.indexOf(word("screen.published.tip.capture")) < tip.indexOf(word("screen.published.tip.connection")), "capture, then connection");
  assert.equal(link.getAttribute("tabindex"), "0", "reached by keyboard, so its explanation shows on focus");
});

test("R6 control: an address with no case reads nothing and draws no case", async () => {
  const p = await open("/app/published");
  assert.equal(p.byOp("publishedcase").length, 0);
  assert.ok(!main(p).querySelector("[data-howtoread]"));
});

test("R47 what the case leaves out: who read it, and the two other states it can be in, each in its closed disclosure", async () => {
  const p = await open(`/app/published/${C}`, { plane: { publishedcase: ok(CASE({ completeness: LEFT_OUT() })) } });
  assert.ok(text(p).includes("Prof. N. Iyer"), "the reader who acknowledged it");
  const nobody = disclosure(p, "screen.published.when_no_one_else_has");
  const unsaid = disclosure(p, "screen.published.when_the_edition_does_not");
  assert.ok(nobody && unsaid, "both disclosures");
  assert.ok(!nobody.hasAttribute("open") && !unsaid.hasAttribute("open"), "closed until opened");
  assert.ok(drew(p, "screen.published.it_stands_as_the_team", {}, nobody) && drew(p, "screen.published.no_one_else_on_the", {}, nobody));
  assert.ok(drew(p, "screen.published.that_is_not_the_same", {}, unsaid) && drew(p, "screen.published.this_edition_does_not_say", {}, unsaid));
});

test("R47 controls: the state drawn is not repeated in a disclosure; with no statement no disclosure is drawn", async () => {
  const none = await open(`/app/published/${C}`, { plane: { publishedcase: ok(CASE({ completeness: LEFT_OUT([]) })) } });
  assert.ok(main(none).querySelector("[data-nobody]"), "no one else read it: said in place");
  assert.ok(!disclosure(none, "screen.published.when_no_one_else_has") && disclosure(none, "screen.published.when_the_edition_does_not"));
  const unsaid = await open(`/app/published/${C}`, { plane: { publishedcase: ok(CASE({ completeness: LEFT_OUT(null) })) } });
  assert.ok(main(unsaid).querySelector("[data-unsaid]"));
  assert.ok(disclosure(unsaid, "screen.published.when_no_one_else_has") && !disclosure(unsaid, "screen.published.when_the_edition_does_not"));
  const bare = await open(`/app/published/${C}`);
  assert.ok(!disclosure(bare, "screen.published.when_no_one_else_has") && !disclosure(bare, "screen.published.when_the_edition_does_not"));
});

test("R47 the contradictions the team disclosed carry the other things a disclosed contradiction can say; a case that says nothing of them draws no section (control)", async () => {
  for (const tensions of [[TENSION], [], null]) {
    const p = await open(`/app/published/${C}`, { plane: { publishedcase: ok(CASE({ tensions })) } });
    const d = disclosure(p, "screen.published.the_other_things_a_disclosed");
    assert.ok(d && !d.hasAttribute("open"), JSON.stringify(tensions));
    assert.ok(drew(p, "screen.published.explained_not_yet_shown_the", {}, d) && drew(p, "screen.published.taken_up_as_a_question", {}, d));
  }
  const one = await open(`/app/published/${C}`, { plane: { publishedcase: ok(CASE({ tensions: [TENSION] })) } });
  assert.ok(text(one).includes("the minutes record a vote"), "the contradiction itself is drawn beside it");
  const absent = await open(`/app/published/${C}`);
  assert.ok(!disclosure(absent, "screen.published.the_other_things_a_disclosed"));
});

test("R39 beside \"Print the case\", what a print made at a minimum strength says at its foot; no finding, no print and no disclosure (control)", async () => {
  const p = await open(`/app/published/${C}`);
  assert.ok(main(p).querySelector('button[data-act="pubprint"]'));
  const d = disclosure(p, "screen.published.when.a.minimum.strength.was");
  assert.ok(d && !d.hasAttribute("open") && drew(p, "screen.published.a.print.made.from.a", {}, d));
  const empty = await open(`/app/published/${C}`, { plane: { publishedcase: ok(CASE({ findings: [] })) } });
  assert.ok(!main(empty).querySelector('button[data-act="pubprint"]') && !disclosure(empty, "screen.published.when.a.minimum.strength.was"));
});

test("R34 the public docket reads only docketpublic, with no credential, draws its entries and the way back to the case", async () => {
  const p = await open(`/app/docket-public/${C}`);
  noCredential(p);
  assert.equal(p.byOp("docketpublic").length, 1);
  assert.equal(p.byOp("docket").length + p.byOp("publishedcase").length, 0, "never the members' docket, nor the case itself");
  assert.equal(last(p, "docketpublic").query.case, C);
  assert.ok(drew(p, "screen.docket-public.sub") && text(p).includes("Edition 2 published, superseding Edition 1"));
  assert.equal(main(p).querySelector("[data-public-page]").getAttribute("href"), `/app/published/${C}`);
  assert.equal(main(p).querySelectorAll("button[data-act]").length, 0, "no act is offered");
});

test("R34 control: a docket with no entry is drawn empty, never failed", async () => {
  const p = await open(`/app/docket-public/${C}`, { plane: { docketpublic: ok({ case: C, entries: [] }) } });
  assert.ok(main(p).querySelector('[data-state="empty"]'));
});

test("R56 the doorbell's consent form offers the three audiences the consent takes, and sends the one chosen with no credential", async () => {
  const p = await open("/app/doorbell", { plane: { knockerconsent: ok({ ok: true }) } });
  const options = [...p.doc.getElementById("dc-audience").querySelectorAll("option")];
  assert.deepEqual(options.map((o) => o.getAttribute("value")), ["member", "group", "public"]);
  assert.deepEqual(options.map((o) => o.textContent.trim()), ["member", "team", "public"].map((k) => word("screen.doorbell.consent.audience." + k)));
  for (const audience of ["member", "group", "public"]) {
    await press(p, "knockerconsent", { "dc-secret": "a-long-phrase-of-at-least-twenty", "dc-entry": "7", "dc-audience": audience, "dc-answer": "yes" });
    assert.deepEqual(last(p, "knockerconsent").body, { knockerSecret: "a-long-phrase-of-at-least-twenty", entry: "7", audience, withdraw: false });
  }
  noCredential(p);
});

test("R56 the consent form's phrase field is \"Your secret phrase\", never the knock's optional label; with no answer, phrase or detail nothing is sent (controls)", async () => {
  const p = await open("/app/doorbell", { plane: { knockerconsent: ok({ ok: true }) } });
  const label = (id) => p.doc.querySelector(`label[for="${id}"]`).textContent.trim();
  assert.equal(label("dc-secret"), word("screen.doorbell.consent.secret"));
  assert.equal(label("db-secret"), word("screen.doorbell.secret.label"), "the knock's own phrase stays optional");
  await press(p, "knockerconsent", { "dc-secret": "a-long-phrase-of-at-least-twenty", "dc-entry": "7", "dc-answer": "" });
  await press(p, "knockerconsent", { "dc-secret": "", "dc-entry": "7", "dc-answer": "no" });
  await press(p, "knockerconsent", { "dc-secret": "a-long-phrase-of-at-least-twenty", "dc-entry": " ", "dc-answer": "no" });
  assert.equal(p.byOp("knockerconsent").length, 0);
});

test("R9 the doorbell needs no session: headed by the group's public name, it says what happens to what is sent", async () => {
  const p = await open("/app/doorbell");
  assert.equal(p.byOp("whoami").length, 0);
  assert.ok(drew(p, "screen.doorbell.heading", { group: GROUP }));
  for (const k of ["only", "reads", "phrase", "court"]) assert.ok(drew(p, "screen.doorbell.happens." + k), k);
});

test("R17 R18 the review copy from outside: the ask, then once who can read it until the end day in the team's zone; the secret in the body only", async () => {
  const p = await open("/app/review", { boot: { hash: "#grant=" + SECRET } });
  noCredential(p);
  const r = last(p, "reviewcopy");
  assert.equal(r.body.secret, SECRET);
  assert.ok(!r.url.includes(SECRET), "never in an address");
  const sub = main(p).querySelector("[data-sub]"), end = main(p).querySelector("[data-link-end]");
  assert.ok(sub && drew(p, "screen.review-outside.ask", {}, sub), "the sub-line asks the reader to read and comment");
  assert.ok(end && text(p, end).includes(day("2099-10-20")), "R27's one line names the end day in the team's zone, not UTC's");
  assert.ok(!drew(p, "screen.review-outside.sub", { date: day("2099-10-20") }), "who can read it is said once, not twice");
});

test("R18 control: a grant with no end draws the ask and the end-of-sharing sentence, and names no day", async () => {
  const p = await open("/app/review", { boot: { hash: "#grant=" + SECRET }, plane: { reviewcopy: ok(COPY({ grant: {} })) } });
  assert.ok(drew(p, "screen.review-outside.ask", {}, main(p).querySelector("[data-sub]")));
  assert.ok(drew(p, "screen.review-outside.untilstopped", {}, main(p).querySelector("[data-link-end]")));
});

/* interface-shell R30 (ARCH, 23 Nov 2026): the published frame's foot draws its signature line from what `published` states. */
const TEAM = { state: "ok", value: { ok: true, group: "lakeshore", display_name: GROUP } };
const placeOf = (edition, o = {}) => /** @type {(view: *) => {signed: *}} */ (PUBLISHED.place)({ parts: PUBLISHED.parts, subject: o.subject ?? C, ui: {},
  data: Object.assign({ group: o.group === undefined ? TEAM : o.group }, edition === undefined ? {} : { edition: { state: "ok", value: edition } }) });

test("R6 R39 the published case states for its foot the team's short name and the signing key's fingerprint, as stated", () => {
  const signed = placeOf(CASE({ signed_by: { member: "Ana Ruiz", fingerprint: "9f2c 41aa" } })).signed;
  assert.deepEqual(signed, { short: "lakeshore", fingerprint: "9f2c 41aa" });
  assert.notEqual(signed.short, GROUP, "the short name, never the team's display name");
  assert.equal(placeOf(CASE({ attestor: { fingerprint: "0b1d 77e2" } })).signed.fingerprint, "0b1d 77e2", "the attestor's key when no signer is named");
});

test("R39 control: a fact not stated is left out, never guessed or empty; with no case or no answer nothing is stated", () => {
  assert.deepEqual(placeOf(CASE()).signed, { short: "lakeshore" }, "no fingerprint stated: none in the foot");
  assert.deepEqual(placeOf(CASE({ signed_by: { fingerprint: "9f2c 41aa" } }), { group: { state: "failed" } }).signed, { fingerprint: "9f2c 41aa" });
  assert.equal(placeOf(undefined).signed, null);
  assert.equal(placeOf(CASE(), { subject: "" }).signed, null);
});

test("R17 the draft's opening, then \"Read the whole draft\": a closed fold holding each part the team wrote, in its own words", async () => {
  const p = await open("/app/review", { boot: { hash: "#grant=" + SECRET } });
  const fold = main(p).querySelector("details[data-readall]");
  assert.ok(fold && !fold.hasAttribute("open"));
  assert.equal(fold.querySelector("summary").textContent.trim(), word("screen.review-outside.readall"));
  const whole = text(p, fold);
  for (const s of ["Rent adjustments under the Coliseum lease, 2024 to 2026.", "We read every council agenda from 2023 on.", "Whether the rents are fair: outside the lease's terms"]) assert.ok(whole.includes(s), s);
  assert.ok(text(p).includes("The 2024 adjustments had no council vote."), "the findings are drawn in their own words");
});

test("R17 bounds: a long scope opens cut at a word with an ellipsis and is whole in the fold; a draft with nothing written draws no fold (control)", async () => {
  const scope = "word ".repeat(100).trim();
  const p = await open("/app/review", { boot: { hash: "#grant=" + SECRET }, plane: { reviewcopy: ok(COPY({ authored: { scope } })) } });
  const opening = main(p).querySelector("[data-opening]").textContent;
  assert.ok(opening.length <= 281 && opening.endsWith("…") && !opening.includes("wor…"), opening.slice(-12));
  assert.ok(text(p, main(p).querySelector("details[data-readall]")).includes(scope));
  const blank = await open("/app/review", { boot: { hash: "#grant=" + SECRET }, plane: { reviewcopy: ok(COPY({ authored: {} })) } });
  assert.ok(!main(blank).querySelector("details[data-readall]"));
});

test("R17 control: with no link in the address nothing is read and the page says so", async () => {
  const p = await open("/app/review");
  assert.equal(p.byOp("reviewcopy").length, 0);
  assert.ok(drew(p, "screen.review-outside.nolink"));
});

