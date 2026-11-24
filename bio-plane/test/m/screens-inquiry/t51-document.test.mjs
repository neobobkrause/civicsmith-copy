/* screens-inquiry T51, the `document` screen: R65 (the record of a copy and its revisions), R66 (fingerprints with Copy), R67 (the links in
 * five groups and the warning before an outside link), R68 (each name with its grade and how it was matched), R69 ("Your citations, leg
 * by leg"), R70 (a state of an item is the kit's word) and R78 (pages drawn from one), over a fake plane on interface-shell's served page.
 * Every expectation is a word read by key (`word`, `hasWord`); dates and the clock go through `cs.date` and `time.at` (`day`, `stamp`),
 * never copied. The browser acts (`revisioncompare`, `hashcopy`, `linkopen`; interface-shell R100) are tests that need the kit's R100 merged: they are
 * marked BROWSER ACT below. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, refusedIn, boot } from "../interface-shell/harness.mjs";
import { themeReadWithPassage } from "../connections/fixtures.mjs";
import { open, storeWorld, SCREENS, main, actsIn, fill, press, says, section, word, day, lead, READING, DOCUMENT_MD, P, Q, Q2, D, SHA, NEWER, INQUIRY_REFS, inquiryMd } from "./fixtures.mjs";

/* the clock the page draws is the browser's own; these tests run in one zone so a moment's time of day is exact */
process.env.TZ = "UTC";

const at = "/app/document/" + D;
/* the real world (store-assembly's store with the real door; the state is made by real acts, K5054): a page as `as` reads it over the world's door, `plane` scripting only the ops it names */
const OWN = { capabilities: ["contribute", "create_projects"] };
async function pageOn(world, as, path, o = {}) {
  const { door, session } = world.boot(as);
  const p = await boot({ screens: SCREENS, door, session, path, ...o });
  await p.settle();
  return p;
}
/** A member with a PDF (or, `kind: "page"`, a web page that is read) held in her project, and a question of the project (drawn into it). */
async function member({ kind = "pdf" } = {}) {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const held = kind === "pdf" ? await world.recipes.pdf(ann, "Policy memo", { project })
    : await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project });
  const q = await world.recipes.question(ann, project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true });
  return { world, ann, project, question: q.id, document: held.bundle, sha: held.sha, at: "/app/document/" + held.bundle };
}
const one = (p) => p + 1;
/** A moment as `time.at` draws it: the day by `date.*` and the 12-hour clock by `time.clock` (DEC-335 (3)), through the words. */
const stamp = (iso) => {
  const h = Number(/T(\d\d):/.exec(iso)[1]), m = /T\d\d:(\d\d)/.exec(iso)[1];
  return word("time.at", { date: day(iso), time: word("time.clock", { hour: String(h % 12 === 0 ? 12 : h % 12), minute: m, ampm: word(h < 12 ? "time.am" : "time.pm") }) });
};
const text = (el) => String(el && el.textContent || "");
/** The requests that wrote: the page's own frame read (`subscriptionsignin`) is a POST that writes nothing. */
const writes = (p) => p.requests.filter((r) => r.method === "POST" && r.op !== "subscriptionsignin");

/* ---- the record of a copy: three revisions of one document (promotion R58, record-core R15) ---- */
const SHA_SET = "7".repeat(64);
const mdOf = (state, history) => DOCUMENT_MD.replace("\nsource:", `\ncurrent_state: ${state}\nstate_history:\n${history.map(([ts, from, to, by]) =>
  `  - timestamp: "${ts}"\n    from_state: ${from}\n    to_state: ${to}\n    author: ${by}`).join("\n")}\nsource:`);
const provJson = (grade, set = false) => JSON.stringify({ documents: [{ capture: { sha256: SHA, ...(grade ? { grade } : {}) },
  provenance_chain: [{ who: "instance civicsmith-test (Civicsmith/2026.10.2)" }] }, ...(set ? [{ capture: { sha256: SHA_SET } }] : [])] });
const T1 = "2026-10-02T14:02:00Z", T2 = "2026-10-02T14:20:00Z", T3 = "2026-10-03T16:41:00Z";
const H1 = [[T1, "none", "collected", "dev"]], H2 = H1.concat([[T2, "collected", "verified", "dev"]]);
const REVS = (extra = {}) => [
  { seq: 3, snapKey: "K3", kind: "promotion", author: "mai", at: T3, sha256: "c".repeat(64), files: [{ path: "bundle.md", sha256: "3".repeat(64), bytes: 900 }, { path: "data/provenance.json", sha256: "4".repeat(64), bytes: 300 }], ...extra },
  { seq: 2, snapKey: "K2", kind: "promotion", author: "dev", at: T2, sha256: "b".repeat(64), files: [{ path: "bundle.md", sha256: "2".repeat(64), bytes: 880 }] },
  { seq: 1, snapKey: "K1", kind: "promotion", author: "dev", at: T1, sha256: "a".repeat(64), files: [{ path: "bundle.md", sha256: "1".repeat(64), bytes: 860 }, { path: "data/provenance.json", sha256: "5".repeat(64), bytes: 300 }] },
];
const STATES = [{ at: T2, from: "collected", to: "verified", author: "dev", blurb: "It reads exactly as the site gave it." }];
const HIST = (o = {}) => ok({ ok: true, bundle: D, revisions: REVS(), states: STATES, truncated: false, ...o });
/* the live files, and the snapshots each replacing promotion archived under its own key */
const IMG = (o = {}) => ({ "bundle.md": mdOf("verified", H2), "data/provenance.json": provJson("B", o.set),
  "_history/bundle_K3.md": mdOf("verified", H2), "_history/bundle_K2.md": mdOf("collected", H1), "_history/data/provenance_K3.json": provJson("C", o.set) });
const withHistory = (o = {}) => ({ images: { [D]: IMG(o) }, plane: { bundlehistory: HIST(o.hist), ...(o.plane || {}) } });
const record = (p) => section(p, "screen.document.a27.the_record_of_this_copy");

test("R65 the record of this copy: the release, what was done oldest first with the vouching and its blurb quoted, and three revisions; control: nothing is written", async () => {
  const p = await open(at, withHistory());
  assert.equal(p.byOp("bundlehistory")[0].query.bundle, D, "read by the document's bundle id");
  const s = record(p);
  assert.ok(s, "the section is drawn where the read answers");
  assert.equal(s.querySelector("[data-release]").textContent, "2026.10.2", "the release the first hop's `who` states");
  assert.ok(says(s, "screen.document.a27.the_release_of_civicsmith_that_wrote_thi"));
  assert.ok(says(s, "screen.document.record.release", { version: "2026.10.2" }), "\"Recorded by Civicsmith release <version>\" by its key");
  assert.ok(says(s, "screen.document.record.added", { member: "dev" }), "the first revision as \"Added by <member>\" by its key");
  assert.ok(!says(s, "screen.document.revisions.truncated", { n: "3" }), "control: a whole history says nothing is cut");
  assert.ok(says(s, "screen.document.a27.everything_done_to_this_copy_s_standing_") && says(s, "screen.document.a27.none_of_it_is_ever_changed_or_removed"));
  const rows = s.querySelectorAll(".cs-row");
  const log = rows.slice(1, 3);
  assert.ok(text(log[0]).includes("dev") && text(log[0]).includes(stamp(T1)), "the first revision: its author and its moment");
  assert.ok(text(log[0]).includes("https://example.org/ai-4-12.pdf") && says(log[0], "screen.document.a27.held_until_vouched_for"), "and the source's address from the capture");
  assert.ok(says(log[1], "screen.document.a27.vouched_for_by_dev", { member: "dev" }) && text(log[1]).includes(stamp(T2)));
  assert.ok(says(log[1], "screen.document.a27.now_used_by_the_team"));
  assert.ok(text(log[1]).includes("“It reads exactly as the site gave it.”"), "the stored blurb, quoted as her own words");
  const fold = s.querySelector('details[data-fold="revisions"]');
  assert.ok(text(fold.querySelector("summary")).includes("3") && says(fold.querySelector("summary"), "screen.document.a27.earlier_revisions_of_this_record"));
  for (const n of [3, 2, 1]) assert.ok(says(fold, "screen.document.revision.title", { n: String(n) }), `Revision ${n}`);
  assert.ok(says(fold.querySelectorAll(".cs-row")[0], "document.versions.thiscopy"), "the newest is marked as this one");
  /* control: no grade change and no "checked" line is composed (promotion R58 holds neither), and the page wrote nothing */
  for (const k of ["screen.document.a27.grade_changed_from_c_to_b_by_mai", "screen.document.a27.checked_the_words_against_the_original_f", "screen.document.a27.checked_the_issuer_is_the_department_s_o"])
    assert.ok(!says(s, k), k);
  assert.equal(writes(p).length, 0, "no write");
  assert.equal(p.byOp("image").filter((r) => r.query.id === D).length, 1, "the revisions are read from the image answer already held, by no other read");
});

test("R65 control: an answer with no states draws only the first revision's row in the log; a copy with one revision draws no fold of earlier revisions; no release is guessed", async () => {
  const noRelease = IMG(); noRelease["data/provenance.json"] = JSON.stringify({ documents: [{ capture: { sha256: SHA }, provenance_chain: [{ who: "instance old (the plane before T31)" }] }] });
  const p = await open(at, { images: { [D]: noRelease }, plane: { bundlehistory: HIST({ states: [], revisions: REVS().slice(2) }) } });
  const s = record(p);
  assert.equal(s.querySelectorAll(".cs-sheet .cs-row").length, 1, "only the first revision");
  assert.equal(s.querySelector("[data-release]"), null, "a `who` that carries no Civicsmith/<version> draws no release line");
  assert.equal(s.querySelector("details"), null);
  /* a document whose record holds no revision cannot exist: every promotion writes a manifest row (record-core/index.mjs:1048) and the image always carries _history/promotion_*.json (:840) */
});

test("R65 a refusal of the history is drawn in the section by its words, and the document's own page stands", async () => {
  const p = await open(at, { plane: { bundlehistory: refusedIn("NO_SUCH_DOCUMENT", "The record of this copy could not be read just now.") } });
  assert.ok(record(p).textContent.includes("The record of this copy could not be read just now."));
  assert.ok(main(p).querySelector("h1") && section(p, "document.read.title"), "never the page's absence");
  const bare = await open(at, { plane: { bundlehistory: refusedIn("NO_SUCH_DOCUMENT") } });
  assert.ok(says(record(bare), "refusal.NO_SUCH_DOCUMENT"), "without the plane's words, the word held for the code");
});

test("R65 R70 a standing is the stated word of its key: `retired` as state.item.retired.name, a standing no key names as state.undetermined", async () => {
  const states = [{ at: T2, from: "verified", to: "retired", author: "mai", blurb: "wrong page" }, { at: T3, from: "retired", to: "tombstoned", author: "mai", blurb: null }];
  const p = await open(at, withHistory({ hist: { states } }));
  const rows = record(p).querySelectorAll(".cs-row");
  assert.ok(says(rows[2], "state.item.retired.name"));
  assert.ok(says(rows[3], "state.undetermined", { reason: "tombstoned" }), "never a word composed here");
  assert.equal(main(p).querySelectorAll(".cs-chip, [data-state-chip]").length, 0, "R70 control: no chip is drawn where the drawing draws none");
  assert.equal(main(p).querySelectorAll(".cs-term, [data-term]").length, 0, "R70 control: no word is drawn as a term the glossary does not list");
});

/* BROWSER ACT: `revisioncompare` (interface-shell R100) must be admitted for this test to pass */
test("R65 two revisions compared in the page: choosing two and pressing the compare act sends nothing and marks what differs; a revision whose bytes are not held is not compared", async () => {
  const p = await open(at, withHistory());
  fill(p, { "document-rev-a": "1", "document-rev-b": "3" });
  const before = p.requests.length;
  await press(p, "revisioncompare");
  assert.equal(p.requests.length, before, "a browser act sends nothing and reads nothing");
  const panel = main(p).querySelector('[data-compare="revisions"]');
  const [left, right] = panel.querySelectorAll("div");
  assert.ok(says(left, "screen.document.revision.title", { n: "1" }) && says(right, "screen.document.revision.title", { n: "3" }));
  assert.ok(says(left.querySelector("del"), "screen.document.a27.standing_held_until_vouched_for") && says(right.querySelector("ins"), "screen.document.a27.standing_used_by_the_team"), "the standing");
  assert.equal(left.querySelectorAll("del").length, 3, "standing, grade and who vouched all differ");
  assert.ok(says(left, "screen.document.compare.grade") && says(right, "screen.document.compare.grade"), "the grade line's label by its key");
  assert.ok(left.querySelector("del .cs-grade").textContent.endsWith("C") && right.querySelector("ins .cs-grade").textContent.endsWith("B"), "the grade, C to B");
  assert.ok(says(left.querySelectorAll("del")[2], "screen.document.a27.vouched_for_by_nobody") && says(right.querySelectorAll("ins")[2], "screen.document.a27.vouched_for_by_dev.2", { member: "dev" }));
  /* revisions 2 and 3 are both used by the team: only the grade differs, and the standing line is not marked */
  fill(p, { "document-rev-a": "2", "document-rev-b": "3" });
  await press(p, "revisioncompare");
  const l2 = main(p).querySelector('[data-compare="revisions"]').querySelector("div");
  assert.equal(l2.querySelectorAll("del").length, 1, "one line differs");
  assert.ok(l2.querySelector("del .cs-grade"));
  /* control: a revision the answer holds no bytes for is not compared */
  const lost = IMG(); delete lost["_history/bundle_K2.md"];
  const q = await open(at, { images: { [D]: lost }, plane: { bundlehistory: HIST() } });
  fill(q, { "document-rev-a": "1", "document-rev-b": "3" });
  await press(q, "revisioncompare");
  const pane = main(q).querySelector('[data-compare="revisions"]');
  assert.ok(pane.querySelector(".cs-gap[data-gap=\"undetermined\"]") && says(pane, "screen.document.revision.nobytes"), "it says so, by its key");
  assert.equal(pane.querySelectorAll("del").length + pane.querySelectorAll("ins").length, 0, "nothing marked against bytes it does not hold");
});

test("R65 a copy that came as a set of files: every file with its digest in the list, the compare marks the files that changed, the note is drawn; a single file draws no such note", async () => {
  const revs = REVS(); revs[0].files = [{ path: "bundle.md", sha256: "1".repeat(64), bytes: 1 }, { path: "snapshots/map.png", sha256: "6".repeat(64), bytes: 9 }];
  revs[2].files = [{ path: "bundle.md", sha256: "1".repeat(64), bytes: 1 }, { path: "snapshots/map.png", sha256: "5".repeat(64), bytes: 9 }];
  const p = await open(at, withHistory({ set: true, hist: { revisions: revs } }));
  const s = record(p);
  assert.ok(says(s, "screen.document.a27.a_copy_that_came_as_a_set_of_files_such_"));
  assert.ok(text(s.querySelector('details[data-fold="revisions"]')).includes("snapshots/map.png"), "every file of the set is named");
  fill(p, { "document-rev-a": "1", "document-rev-b": "3" });
  await press(p, "revisioncompare");
  assert.ok(main(p).querySelector('[data-file-changed="snapshots/map.png"]') && !main(p).querySelector('[data-file-changed="bundle.md"]'), "only the file that changed (bundle.md's digest is the same in both)");
  const short = (h) => h.slice(0, 8) + "…" + h.slice(-4);
  const ch = main(p).querySelector('[data-file-changed="snapshots/map.png"]');
  assert.ok(says(ch.querySelector("del"), "screen.document.compare.fingerprint", { digest: short("5".repeat(64)) }) && says(ch.querySelector("ins"), "screen.document.compare.fingerprint", { digest: short("6".repeat(64)) }), "R65: each file's digest by screen.document.compare.fingerprint");
  const single = await open(at, withHistory());
  assert.ok(!says(record(single), "screen.document.a27.a_copy_that_came_as_a_set_of_files_such_"));
});

/* ---- R66 ---- */
const fingerprints = (p) => section(p, "screen.document.fingerprints.head");

/* BROWSER ACT: `hashcopy` (interface-shell R100) must be admitted for the Copy tests to pass */
test("R66 the first fingerprint is the capture's digest, drawn in full with its short form beside the title, and Copy puts the full value on the clipboard; sends nothing", async () => {
  const p = await open(at, withHistory());
  const s = fingerprints(p);
  assert.equal(s.querySelector('[data-fingerprint="capture"]').textContent, SHA, "the digest `image` states, in full");
  assert.ok(says(s, "screen.document.a26.this_copy_s_words_and_file") && says(s, "screen.document.a26.computed_from_the_exact_bytes_of_this_co"));
  assert.ok(text(s.querySelector(".cs-row b").parentElement).includes(SHA.slice(0, 8) + "…" + SHA.slice(-4)), "its short form beside the title");
  const copied = [];
  p.win.navigator = { clipboard: { writeText: (t) => copied.push(t) } };
  const before = p.requests.length;
  await p.click(s.querySelector('button[data-act="hashcopy"]'));
  assert.deepEqual(copied, [SHA]);
  assert.equal(p.requests.length, before, "nothing sent");
  assert.ok(says(s.querySelector('button[data-act="hashcopy"]'), "shell.copy"));
  /* the fingerprint in the head is the same value shortened, with its tip */
  const head = main(p).querySelector(".mk-facts .mk-tag");
  assert.equal(head.textContent, SHA.slice(0, 4) + "…" + SHA.slice(-4));
  assert.ok(head.getAttribute("data-tip").includes(word("screen.document.fingerprint.means").slice(0, 20)));
  /* control: a single-file copy draws one fingerprint and not the set's note */
  assert.equal(s.querySelectorAll("[data-fingerprint]").length, 1);
  assert.ok(!says(s, "screen.document.fingerprint.setonly"));
});

test("R66 a copy that came as a set of files draws the second fingerprint, the current revision's sha256, each with Copy, and the note beneath; a document with no digest draws none and no copy", async () => {
  const p = await open(at, withHistory({ set: true }));
  const s = fingerprints(p);
  assert.equal(s.querySelector('[data-fingerprint="set"]').textContent, "c".repeat(64), "the `bundle_sha` the last promotion left");
  assert.ok(says(s, "screen.document.a26.this_copy_and_the_files_captured_with_it") && says(s, "screen.document.a26.computed_from_the_whole_set_so_the_set_c"));
  assert.equal(s.querySelectorAll('button[data-act="hashcopy"]').length, 2);
  assert.ok(says(s, "screen.document.fingerprint.setonly"));
  const none = await open(at, { images: { [D]: { "bundle.md": DOCUMENT_MD } }, plane: { bundlehistory: HIST() } });
  assert.equal(fingerprints(none), undefined);
  assert.equal(main(none).querySelectorAll('button[data-act="hashcopy"]').length, 0);
});

/* ---- R67 ---- */
const LINKS = [
  { address: "https://example.org/ai-4-12.pdf#section-3", fragment: "section-3", partition: "anchor", resolution: "anchor", verdict: null },
  { address: "https://example.org/map.pdf", partition: "intra", resolution: "intra", verdict: null },
  { address: "https://example.org/report", partition: "deferred", resolution: "linked", verdict: "contemporaneous", target_bundle: "INFO-2026-0011", target_retrieved: "2026-10-02T09:00:00Z" },
  { address: "https://example.org/311", partition: "deferred", resolution: "offsite", verdict: null },
  { address: "https://example.org/code", partition: "deferred", resolution: "offsite", verdict: null },
  { address: "javascript:void(0)", partition: "refused", resolution: "refused", verdict: null },
];
const linksSection = (p) => section(p, "document.links.title");

test("R67 the links in five groups, in order, each only when it holds a link, each row with the verdict word of its link and no number invented", async () => {
  const p = await open(at, { plane: { links: ok({ ok: true, links: LINKS }) } });
  const s = linksSection(p);
  const heads = s.querySelectorAll("p.mk-small").map((h) => text(h)).filter((t) => t);
  const expected = [["inside", 1], ["beside", 1], ["held", 1], ["outside", 2], ["refused", 1]].map(([k, n]) => word("screen.document.links.group." + k, { n: String(n) }));
  assert.deepEqual(heads.filter((t) => expected.includes(t)), expected, "the five groups, their counts the groups' lengths, in the drawing's order");
  const rows = s.querySelectorAll(".cs-row");
  const verdict = (i, key) => assert.ok(says(rows[i], "screen.document.links.verdict." + key), `${key} on row ${i}`);
  verdict(0, "final"); verdict(1, "checked"); verdict(2, "same"); verdict(3, "nocapture"); verdict(4, "nocapture"); verdict(5, "refused");
  assert.ok(says(rows[0], "screen.document.a30.a_pointer_into_this_very_copy_settled_wh") && says(rows[1], "screen.document.a64.captured_together_with_this_page_and_che"));
  assert.ok(says(rows[2], "screen.document.a27.the_copy_your_team_holds_is_the_one_this") && says(rows[2], "document.links.held", { date: day("2026-10-02T09:00:00Z") }));
  assert.ok(rows[2].querySelector('a.cs-ref[href="/app/document/INFO-2026-0011"]'), "a held link is a reference");
  assert.ok(says(s, "screen.document.a30.the_other_verdicts_a_held_link_can_carry") && says(s, "screen.document.a64.not_established_means_the_record_cannot_"));
  assert.ok(says(rows[5], "screen.document.a30.not_an_address_the_record_will_carry") && says(rows[5], "screen.document.a30.this_is_a_refusal_not_a_gap_in_what_was_"));
  /* an address is shown as an address, never a bare anchor to the outside, and a refused or script address is never a link */
  assert.equal(s.querySelectorAll('a[href^="https://example.org/311"], a[href^="javascript:"]').length, 0);
  assert.equal(s.querySelectorAll("a[data-outward]").length, 0);
  assert.equal(writes(p).length, 0);
  /* the tally: the groups' lengths (6 links, 2 outside), the navigation note beside it */
  assert.ok(says(s, "screen.document.a30.6_links_on_this_page_4_lead_outside_the_", { n: "6", outside: "2" }) && says(s, "screen.document.links.navleft"));
});

test("R67 the tally has its own sentence for one link leading outside and for none; the numbers are the groups' lengths", async () => {
  const one1 = await open(at, { plane: { links: ok({ ok: true, links: [LINKS[0], LINKS[3]] }) } });
  assert.ok(says(linksSection(one1), "screen.document.a30.tally.one", { n: "2" }));
  const none = await open(at, { plane: { links: ok({ ok: true, links: [LINKS[0], LINKS[1], LINKS[5]] }) } });
  assert.ok(says(linksSection(none), "screen.document.a30.tally.none", { n: "3" }));
  assert.ok(!says(linksSection(none), "screen.document.a30.6_links_on_this_page_4_lead_outside_the_", { n: "3", outside: "0" }));
});

test("R67 control: a group with no link is not drawn, and the page with none draws no section", async () => {
  const p = await open(at, { plane: { links: ok({ ok: true, links: [LINKS[3]] }) } });
  const s = linksSection(p);
  assert.ok(says(s, "screen.document.links.group.outside", { n: "1" }));
  for (const k of ["inside", "beside", "held", "refused"]) assert.ok(!text(s).includes(word("screen.document.links.group." + k, { n: "1" })), k);
  assert.ok(!says(s, "screen.document.a30.the_other_verdicts_a_held_link_can_carry"), "the note on the other verdicts only where a held link is");
  const none = await open(at, { plane: { links: ok({ ok: true, links: [] }) } });
  assert.equal(linksSection(none), undefined);
  const failed = await open(at, { plane: { links: refusedIn("NO_SUCH_BUNDLE", "The links could not be read just now.") } });
  assert.ok(linksSection(failed).textContent.includes("The links could not be read just now."), "a read that failed is drawn failed, never as none");
});

/* BROWSER ACT: `linkopen` (interface-shell R100) must be admitted for these two tests to pass */
const ask = (p, address) => p.click(p.root().querySelector(`button[data-act="linkopen"][data-address="${address}"][data-step="ask"]`));
test("R67 pressing an outside link opens the warning and not the address; \"Open it anyway\" opens it once in a new window with noopener; nothing is sent", async () => {
  const p = await open(at, { plane: { links: ok({ ok: true, links: LINKS }) } });
  const opened = [];
  p.win.open = (...a) => opened.push(a);
  const before = p.requests.length;
  await ask(p, "https://example.org/311");
  assert.deepEqual(opened, [], "the address is not opened by the press");
  const dlg = main(p).querySelector('[data-dialog="leave"]');
  assert.ok(says(dlg, "screen.document.a30.you_are_about_to_leave_the_record") && says(dlg, "screen.document.a30.what_is_at_the_address_now_the_record_do"));
  assert.ok(says(dlg.querySelector('button[data-step="open"]'), "screen.document.a30.open_anyway"), "\"Open it anyway\" by its key");
  assert.equal(dlg.querySelector(".id").textContent, "https://example.org/311", "the address in the data face");
  await p.click(dlg.querySelector('button[data-step="open"]'));
  assert.deepEqual(opened, [["https://example.org/311", "_blank", "noopener"]]);
  assert.equal(main(p).querySelector('[data-dialog="leave"]'), null, "the warning closes");
  assert.equal(p.requests.length, before, "nothing sent to the plane");
});

test("R67 \"Stay in the record\" closes the warning and opens nothing; a script address offers no way to open", async () => {
  const p = await open(at, { plane: { links: ok({ ok: true, links: LINKS }) } });
  const opened = [];
  p.win.open = (...a) => opened.push(a);
  await ask(p, "https://example.org/code");
  await p.click(main(p).querySelector('[data-dialog="leave"] button[data-step="stay"]'));
  assert.equal(main(p).querySelector('[data-dialog="leave"]'), null);
  assert.deepEqual(opened, []);
  assert.equal(p.root().querySelectorAll('button[data-act="linkopen"][data-address^="javascript"]').length, 0);
});

/* ---- R68 ---- */
const NAMED = (o = {}) => ok({ ok: true, names: [
  { entity_id: "ENT-17", label: "L. Chen, Director of Public Works", kind: "person", grade: "A", established: true, needs_confirmation: false, matched_by: "identifier", mentions: 4 },
  { entity_id: "ENT-20", label: "Public Works", kind: "organization", grade: "B", established: true, needs_confirmation: false, matched_by: "reference_key", mentions: 9 },
  { entity_id: "ENT-21", label: "Oakland City Council", kind: "organization", grade: "C", established: false, needs_confirmation: true, matched_by: "label", mentions: 2 },
  ...(o.more || [])] });
const CONNS = ok({ ok: true, connections: [
  { a_capture_sha: SHA, b_capture_sha: "8".repeat(64), entity_id: "ENT-17", on_point: { a: { ref: "c1", occurrence: { page: 0 }, chosen_by: "record" }, b: null }, occurrences: 4 },
  { a_capture_sha: SHA, b_capture_sha: "8".repeat(64), entity_id: "ENT-20", on_point: { a: { ref: "c2", occurrence: { page: 0 }, chosen_by: "member:dev", at: "2026-10-03T10:00:00Z", why: "the department that issued it" }, b: null }, occurrences: 9 },
  { a_capture_sha: SHA, b_capture_sha: "8".repeat(64), entity_id: "ENT-21", on_point: { a: { ref: "c3", occurrence: { page: 5 }, chosen_by: "record" }, b: null }, occurrences: 2 }] });

test("R68 each name drawn with its grade as one mark (A, B, C), the number of mentions, and the mention that counts chosen by the record or by a named member with her words", async () => {
  const p = await open(at, { plane: { resolutions: NAMED(), connections: CONNS } });
  assert.equal(p.byOp("resolutions")[0].query.sha256, SHA);
  const s = section(p, "document.names.title");
  const rows = s.querySelectorAll(".cs-row");
  assert.equal(rows.length, 3);
  const grade = (r) => r.querySelector(".cs-grade");
  assert.deepEqual(rows.map((r) => [grade(r).getAttribute("data-scale"), grade(r).textContent.slice(-1)]), [["subject", "A"], ["subject", "B"], ["subject", "C"]]);
  assert.ok(says(rows[0], "document.names.row", { n: "4", page: String(one(0)), chosen: word("document.names.chosen.record") }));
  assert.ok(says(rows[1], "document.names.row", { n: "9", page: String(one(0)), chosen: word("document.names.chosen.member", { who: "dev", date: day("2026-10-03T10:00:00Z"), why: "the department that issued it" }) }));
  assert.ok(says(rows[2], "document.names.row", { n: "2", page: String(one(5)), chosen: word("document.names.chosen.record") }), "the mention's page drawn from one");
  assert.ok(says(rows[0], "screen.document.names.matched.identifier") && says(rows[1], "screen.document.names.matched.reference_key") && says(rows[2], "screen.document.names.matched.label"), "how each was matched, by its key");
  for (const k of ["screen.document.a31.the_grade_on_each_name_says_how_the_matc", "screen.document.a31.it_says_nothing_about_how_far_to_trust_t", "screen.document.a31.a_connection_to_another_document_takes_t"])
    assert.ok(says(s, k), k);
  /* a person is claimed from here; an organization is not */
  assert.ok(rows[0].querySelector('button[data-act="identityclaim"]') && !rows[1].querySelector('button[data-act="identityclaim"]'));
  assert.ok(rows[1].querySelector('button[data-act="connectionchoose"]'));
});

test("R68 control: a name whose grade or basis the read does not hold draws neither a letter nor a guess; a failed read is drawn failed", async () => {
  const p = await open(at, { plane: { resolutions: NAMED({ more: [{ entity_id: "ENT-30", label: "Old Name", kind: "organization", grade: null, matched_by: null, mentions: 1 }] }), connections: CONNS } });
  const row = section(p, "document.names.title").querySelectorAll(".cs-row")[3];
  assert.equal(row.querySelector(".cs-grade"), null, "no letter the read does not hold");
  assert.ok(row.querySelector('.cs-gap[data-gap="undetermined"]'));
  assert.ok(says(row, "screen.document.names.matched.none"), "a null basis says so by its key");
  for (const k of ["identifier", "reference_key", "label", "testimony"]) assert.ok(!says(row, "screen.document.names.matched." + k), "and draws no guess: " + k);
  const w = await member({ kind: "page" });
  const none = await pageOn(w.world, w.ann, w.at, { plane: { connections: CONNS } });
  assert.equal(none.byOp("resolutions").length, 1, "the world's own answer: the document names no one");
  assert.equal(section(none, "document.names.title"), undefined, "R20: no names, no section");
  const failed = await open(at, { plane: { resolutions: refusedIn("NO_SHA", "The names could not be read just now.") } });
  assert.ok(section(failed, "document.names.title").textContent.includes("The names could not be read just now."));
});

/* ---- R69 ---- */
const QPROJECT = (legs) => ({ [Q]: { "bundle.md": inquiryMd(P, INQUIRY_REFS, { legs }) }, [Q2]: { "bundle.md": inquiryMd(P, INQUIRY_REFS, { legs }).replace(Q, Q2).replace("Seven days", "Closed") } });
const LEG = [{ target: D, role: "supports", grade: "B", extent_page: 2 }];
const TWO = { [D]: { "bundle.md": DOCUMENT_MD, "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: SHA } }] }) } };
const backlinks2 = ok({ ok: true, target: D, backlinks: [{ from: Q, from_type: "inquiry", from_title: "Seven days?", rel: "cites" }, { from: Q2, from_type: "inquiry", from_title: "Does closed mean repaired?", rel: "cites" }], out_of_view: true });
const legs = (p) => main(p).querySelectorAll("[data-leg-row]");
const NOTICE_Q = { notice: "REN-1", holder: Q, ord: 0, target: D, capture_sha: SHA, newer_capture: NEWER, state: "open", affects: "unaffected" };
const ANSWER = (state, affects, extra = {}) => ok({ ok: true, target: Q, notices: [{ ord: 0, target: D, content_id: "c1", capture_sha: SHA, state, newer: state === "chain_unread" ? null : true, affects,
  candidates: [{ capture_sha: NEWER, first_retrieved: "2026-10-09T09:00:00Z" }], chains: [], ...extra }], count: 1, wrote: false });

test("R69 every question that rests on the document is a row, not yet checked, with its project, the section it rests on and the act to ask; nothing is asked on load; an unseen citer is not named", async () => {
  const p = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2 } });
  const s = section(p, "screen.document.a34.your_citations_leg_by_leg");
  assert.ok(says(s, "screen.document.a34.a_newer_copy_never_moves_a_citation_by_i") && says(s, "screen.document.a34.each_reasoning_that_rests_on_this_docume"));
  assert.equal(legs(p).length, 2);
  for (const r of legs(p)) {
    assert.ok(says(r, "screen.document.a34.not_checked_yet"));
    assert.ok(says(r, "screen.document.place.restson", { page: String(one(2)) }), "the place it rests on, drawn from one");
    assert.ok(text(r).includes("Pothole repairs"), "its project");
    assert.deepEqual(actsIn(r), ["versionnotice"]);
  }
  assert.ok(legs(p)[0].querySelector(`a.cs-ref[href="/app/question/${Q}"]`));
  assert.equal(p.byOp("versionnotice").length, 0, "control: no row asks on load (B314)");
  assert.ok(says(main(p), "screen.document.backlinks.hidden"), "the note that something unseen cites it stands");
  assert.ok(!text(s).includes("INQ-2026-0099-other"), "a question the viewer cannot see is not named");
});

test("R69 asking for one row sends versionnotice for that question alone and draws the answer: the newer copy's date, the section reading the same; the other row stays unasked", async () => {
  const p = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, versionnotice: ANSWER("newer_capture_matched", "unaffected") } });
  await p.click(legs(p)[0].querySelector('button[data-act="versionnotice"]'));
  await p.settle();
  assert.deepEqual(p.byOp("versionnotice").map((r) => r.query.target), [Q]);
  const r = legs(p)[0];
  assert.ok(says(r, "screen.document.a34.a_newer_copy_exists_captured_2_october", { date: day("2026-10-09T09:00:00Z") }));
  assert.ok(says(r, "screen.document.a34.page_same", { page: String(one(2)) }));
  assert.ok(says(r, "screen.document.place.restson", { page: String(one(2)) }), "the place it rests on, by its key and drawn from one");
  assert.ok(says(legs(p)[1], "screen.document.a34.not_checked_yet"), "the other row has not been asked");
  assert.equal(writes(p).length, 0, "asking writes nothing");
});

test("R69 an answer the record could not give is drawn undetermined and says it does not guess, never as none; an undetermined section is marked, with no sentence composed here", async () => {
  const p = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, versionnotice: ANSWER("chain_unread", null) } });
  await p.click(legs(p)[0].querySelector('button[data-act="versionnotice"]'));
  await p.settle();
  const r = legs(p)[0];
  assert.ok(r.querySelector('[data-leg="unread"] .cs-gap[data-gap="undetermined"]') && says(r, "screen.document.a34.it_does_not_guess"));
  assert.ok(!text(r).includes(lead("screen.document.a34.a_newer_copy_exists_captured_2_october")));
  const q = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, versionnotice: ANSWER("newer_capture_undetermined", "undetermined") } });
  await q.click(legs(q)[0].querySelector('button[data-act="versionnotice"]'));
  await q.settle();
  assert.ok(legs(q)[0].querySelector('[data-leg="undetermined"] .cs-gap[data-gap="undetermined"]'));
});

test("R69 a notice the sweep raised is a read of the record: its row is drawn asked from the start, with the two acts; adopting needs her reason, sends the notice and the why, and the row re-reads", async () => {
  /* the real state: a question resting on a passage of a held page that has changed at its address since, the sweep's notice open (`recipes.newerCapture`) */
  const world = await storeWorld();
  const seen = await world.recipes.newerCapture(await world.signIn("ann", OWN));
  const chain = (await seen.as.read("versionchain", { query: { address: seen.address } })).versions;
  const p = await pageOn(world, seen.as, "/app/document/" + seen.document);
  const r = legs(p)[0];
  assert.deepEqual(actsIn(r).sort(), ["adoptversion", "keepversion"]);
  assert.ok(says(r, "screen.document.a34.a_newer_copy_exists_captured_2_october", { date: day(chain[1].first_retrieved) }));
  assert.equal(p.byOp("versionnotice").length, 0);
  /* without her reason nothing is written */
  await press(p, "adoptversion");
  assert.equal(p.byOp("adoptversion").length, 0);
  assert.ok(says(main(p), "shell.reason.needed"), "refused in words");
  const why = "the newer one adds the supervisor";
  fill(p, { ["document-version-why-" + seen.notice.notice]: why });
  await press(p, "adoptversion");
  assert.deepEqual(p.byOp("adoptversion")[0].body, { notice: seen.notice.notice, why });
  /* decided: what she chose, who and when, in her words, and nothing more offered */
  const closed = (await seen.as.read("reevaluationnotices", { query: { holder: seen.question, state: "all" } })).notices[0];
  const done = legs(p)[0];
  assert.ok(done.querySelector('[data-leg-state="decided"]') && done.querySelector('[data-decided="adopted"]'));
  assert.ok(text(done).includes(closed.closed_by) && text(done).includes(day(closed.closed_at)) && text(done).includes(`“${why}”`));
  assert.ok(says(done, "screen.document.a34.moved", { member: closed.closed_by, date: day(closed.closed_at), why }), "the decided row by its key, its three fills read from the notice");
  assert.deepEqual(actsIn(done), []);
});

test("R69 the plane's refusal of an adoption is drawn by its words beside the act", async () => {
  const p = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, reevaluationnotices: (r) => ok({ ok: true, notices: r.query.holder === Q ? [NOTICE_Q] : [] }),
    adoptversion: refusedIn("VERSION_ADOPT_NO_REASON") } });
  fill(p, { "document-version-why-REN-1": "x" });
  const slot = await press(p, "adoptversion");
  assert.ok(says(slot, "refusal.VERSION_ADOPT_NO_REASON") || says(main(p), "refusal.VERSION_ADOPT_NO_REASON"));
  await press(p, "keepversion");
  assert.equal(p.byOp("keepversion")[0].body.notice, "REN-1");
});

/* ---- R78 ---- */
/* the PDF is the world's own, held, with the question to cite into; the world reads no text from a generated PDF, so its reading is scripted (needed: a recipe for a held PDF read in part); the typing is the world's */
test("R78 an extent of page 0 draws \"Page 1\" in the passage's place and in the picker of unread pages, a transcription of the picker's 1 sends page 0, and an extent that states no page draws no page", async () => {
  const w = await member();
  const reading = ok({ ...READING({ capture_sha: w.sha, unread_pages: [0] }), text_units: [{ seq: 1, extent: { kind: "pdf-page", page: 0 }, text: "1. A passage on the first page." }, { seq: 2, extent: { kind: "heading" }, text: "A heading with no page." }] });
  const p = await pageOn(w.world, w.ann, w.at, { plane: { reading } });
  const q = main(p).querySelectorAll("blockquote");
  assert.ok(says(q[0], "screen.document.passage.where", { page: one(0) }));
  assert.ok(!text(q[1]).includes(word("screen.document.passage.where", { page: "" })), "control: no page stated, no page drawn");
  assert.ok(says(main(p), "document.unread.pages", { pages: String(one(0)) }));
  assert.deepEqual(p.doc.getElementById("document-unread-page").querySelectorAll("option").map((o) => [o.getAttribute("value"), o.textContent]), [[String(one(0)), String(one(0))]]);
  fill(p, { "document-unread-page": "1", "document-unread-words": "A page typed." });
  await press(p, "transcribe");
  assert.deepEqual(p.byOp("transcribe")[0].body.extent, { kind: "pdf-page", page: 0 }, "the value sent is the record's own");
  const typed = (await w.ann.read("transcriptions", { query: { bundleId: w.document } })).transcriptions;
  assert.deepEqual(typed.map((t) => t.extent.page), [0], "the world holds the page typed");
  /* a citation keeps the record's page too */
  fill(p, { "document-cite-question": w.question });
  await press(p, "cite", { within: q[0].nextElementSibling });
});

/* connections' real theme read (R56, R78): a theme holding a passage of a paged document (page 1, counted from 0) and a whole document */
test("R78 a theme's placement page and the mention that counts are drawn from one: the placement's own page, by who placed it", async () => {
  const real = themeReadWithPassage();
  const passage = real.members.find((m) => m.target_kind === "content"), whole = real.members.find((m) => m.target_kind === "document");
  const themes = (r) => ok(r.query.id ? real : { ok: true, themes: [{ theme_id: real.theme_id, name: real.name }] });
  const roster = ok({ ok: true, members: [{ member_id: "bob", handle: passage.placed_by_handle }] });
  const on = (doc) => open("/app/document/" + doc, { images: { [doc]: { "bundle.md": DOCUMENT_MD.replace(D, doc), "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: SHA } }] }) } },
    plane: { themeread: themes, memberlist: roster } });
  const p = await on(passage.document);
  assert.ok(says(section(p, "theme.section"), "screen.document.theme.page", { page: String(one(passage.page)), name: passage.placed_by_handle, date: day(passage.placed_at), note: "" }),
    "the passage's page, counted from one, placed by the handle the read gives");
  /* control: a placement of the whole document states no page, so none is drawn */
  const w = await on(whole.document);
  assert.ok(!section(w, "theme.section").textContent.includes(word("screen.document.passage.where", { page: "1" }).split("1")[0]), "no page for a whole document");
  assert.ok(says(section(w, "theme.section"), "screen.document.theme.whole", { kind: word("shell.card.document"), name: whole.placed_by_handle, date: day(whole.placed_at) }));
});

test("R68 a name matched by a held reference and one by a member's testimony draw their own sentences", async () => {
  const more = [{ entity_id: "ENT-31", label: "Ref Name", kind: "organization", grade: "B", matched_by: "reference", mentions: 1 }, { entity_id: "ENT-32", label: "Told Name", kind: "organization", grade: "C", matched_by: "testimony", mentions: 1 }];
  const p = await open(at, { plane: { resolutions: NAMED({ more }), connections: CONNS } });
  const rows = section(p, "document.names.title").querySelectorAll(".cs-row");
  assert.ok(says(rows[3], "screen.document.names.matched.reference") && says(rows[4], "screen.document.names.matched.testimony"));
});

test("R65 a history the plane says is cut is said so with the number of revisions shown, never read as the whole", async () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ seq: 250 - i, snapKey: "K" + (250 - i), kind: "promotion", author: "dev", at: T1, sha256: "a".repeat(64), files: [{ path: "bundle.md", sha256: "1".repeat(64), bytes: 1 }] }));
  const p = await open(at, withHistory({ hist: { revisions: many, truncated: true } }));
  assert.ok(says(record(p), "screen.document.revisions.truncated", { n: "250" }));
  assert.equal(writes(p).length, 0);
});

test("R69 an answer that the cited section differs says so by page; no newer copy says none exists; a kept notice is drawn by its own sentence", async () => {
  const p = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, versionnotice: ANSWER("newer_capture_matched", "affected") } });
  await p.click(legs(p)[0].querySelector('button[data-act="versionnotice"]'));
  await p.settle();
  assert.ok(says(legs(p)[0], "screen.document.a34.page_differs", { page: String(one(2)) }));
  assert.ok(!says(legs(p)[0], "screen.document.a34.page_same", { page: String(one(2)) }));
  const q = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, versionnotice: ANSWER("no_newer_capture", null, { newer: false, candidates: [] }) } });
  await q.click(legs(q)[0].querySelector('button[data-act="versionnotice"]'));
  await q.settle();
  assert.ok(says(legs(q)[0], "screen.document.a34.no_newer"));
  const kept = (r) => ok({ ok: true, notices: r.query.holder === Q ? [{ ...NOTICE_Q, state: "kept", closed_by: "dev", closed_at: "2026-10-13T10:00:00Z", why: "the cited wording is the one we need" }] : [] });
  const k = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, reevaluationnotices: kept } });
  assert.ok(says(legs(k)[0], "screen.document.a34.kept", { member: "dev", date: day("2026-10-13T10:00:00Z"), why: "the cited wording is the one we need" }));
});

test("R69 a keep or a move with no reason is drawn by its own key (a34.kept.noreason, a34.moved.noreason), never a sentence composed from the act's label", async () => {
  for (const [state, key] of [["kept", "screen.document.a34.kept.noreason"], ["adopted", "screen.document.a34.moved.noreason"]]) {
    const dec = (r) => ok({ ok: true, notices: r.query.holder === Q ? [{ ...NOTICE_Q, state, closed_by: "dev", closed_at: "2026-10-13T10:00:00Z" }] : [] });
    const k = await open(at, { images: { ...QPROJECT(LEG), ...TWO }, plane: { backlinks: () => backlinks2, reevaluationnotices: dec } });
    assert.ok(says(legs(k)[0], key, { member: "dev", date: day("2026-10-13T10:00:00Z") }), key);
    assert.ok(!text(legs(k)[0]).includes(word("act.keepversion.label.document") + " ·") && !text(legs(k)[0].querySelector("[data-decided]")).includes("“"), "control: no composed fallback and no quotation of a reason (the cited words, R3 fix round 4, are drawn beside, apart from the decision)");
  }
});

/* ---- R80 ---- */
const unit = (seq, extent, t) => ({ seq, extent, reference: "u" + seq, truncated: false, text: t });
const readingOf = (units, o = {}) => ok({ ...READING({ unread_pages: [], ...o }), text_units: units });
const bar = (p) => main(p).querySelector("[data-pagebar]");
const nextBox = (p) => p.doc.getElementById("document-read-page").querySelectorAll("label").find((l) => l.textContent.includes(word("document.read.next"))).querySelector("input");

test("R80 a document of several pages draws the Read it tab and \"Page 1 of m\" from the reading it already read; Next moves to page 2 sending no request and no new read; Previous is not offered on page 1", async () => {
  const units = [unit(1, { kind: "pdf-page", page: 0 }, "First page words."), unit(2, { kind: "pdf-page", page: 1 }, "Second page words."), unit(3, { kind: "pdf-page", page: 2 }, "Third page words.")];
  const p = await open(at, { plane: { reading: readingOf(units) } });
  const s = section(p, "document.read.title");
  assert.ok(bar(p) && says(bar(p), "document.read.tab.page"), "the tab of the reading the screen reads, by its key");
  assert.ok(says(s, "document.read.page", { n: String(one(0)), count: String(units.length) }), "Page 1 of m, from one");
  assert.ok(says(s, "document.read.next") && !says(s, "document.read.prev"), "control: no Previous on the first page");
  assert.ok(text(main(p)).includes("First page words.") && !text(main(p)).includes("Second page words."), "the page's own words");
  assert.ok(says(main(p).querySelector("blockquote"), "screen.document.passage.where", { page: one(0) }));
  const before = p.requests.length, reads = p.byOp("reading").length;
  const box = nextBox(p); box.checked = true; p.fire(box, "change"); await p.settle();
  assert.ok(says(section(p, "document.read.title"), "document.read.page", { n: String(one(1)), count: String(units.length) }), "Page 2 of m");
  assert.ok(text(main(p)).includes("Second page words.") && !text(main(p)).includes("First page words."));
  assert.ok(says(section(p, "document.read.title"), "document.read.prev"), "Previous is offered from page 2");
  assert.equal(p.requests.length, before, "no request is sent");
  assert.equal(p.byOp("reading").length, reads, "no new read of what is held");
  assert.equal(writes(p).length, 0);
});

test("R80 a slide deck numbers from 1: slide 1 is \"Page 1\", never 0 or 2", async () => {
  const units = [unit(1, { kind: "slide", slide: 1 }, "Opening slide."), unit(2, { kind: "slide", slide: 2 }, "Second slide."), unit(3, { kind: "slide", slide: 3 }, "Third slide.")];
  const p = await open(at, { plane: { reading: readingOf(units) } });
  assert.ok(says(section(p, "document.read.title"), "document.read.page", { n: "1", count: String(units.length) }), "a slide counts from 1 as it is");
  assert.ok(text(main(p)).includes("Opening slide."));
  const box = nextBox(p); box.checked = true; p.fire(box, "change"); await p.settle();
  assert.ok(says(section(p, "document.read.title"), "document.read.page", { n: "2", count: String(units.length) }) && text(main(p)).includes("Second slide."));
});

test("R80 control: a single-page text draws no page bar and no tab, and a text with no page stated draws all its passages", async () => {
  const one1 = await open(at, { plane: { reading: readingOf([unit(1, { kind: "pdf-page", page: 0 }, "Only page.")]) } });
  assert.equal(bar(one1), null);
  assert.ok(!says(main(one1), "document.read.page", { n: "1", count: "1" }));
  assert.ok(text(main(one1)).includes("Only page."));
  const flat = await open(at, { plane: { reading: readingOf([unit(1, { kind: "heading" }, "A heading."), unit(2, { kind: "heading" }, "Another.")]) } });
  assert.equal(bar(flat), null);
  assert.equal(main(flat).querySelectorAll("blockquote").length, 2);
});

/* ---- DEC-366: two tabs only; the compare tab and the original-file card are drawn only where a read answers them ---- */
test("DEC-366 the document draws only the By page tab: no compare tab, no original-file card, no Whole text or Slides tab, and no `versioncompare` is sent (no read names the version a question cites, nor the original's size)", async () => {
  const units = [unit(1, { kind: "pdf-page", page: 0 }, "First page words."), unit(2, { kind: "pdf-page", page: 1 }, "Second page words.")];
  const p = await open(at, { plane: { reading: readingOf(units) } });
  const s = section(p, "document.read.title");
  assert.ok(says(s, "document.read.tab.page"), "By page");
  assert.ok(!says(main(p), "document.read.tab.compare"), "the compare tab is not drawn while no read answers it");
  assert.ok(!says(main(p), "document.read.original.card", { kind: "PDF", size: "" }) && !text(main(p)).includes(word("document.read.original", {})), "the original-file card is not drawn without a size");
  assert.equal(p.byOp("versioncompare").length, 0, "nothing is read that cannot be asked");
  assert.equal(bar(p).querySelectorAll('input[type="radio"][name="document-read-tab"]').length, 1, "one tab only");
  assert.equal(writes(p).length, 0);
});
