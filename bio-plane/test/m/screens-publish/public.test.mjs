/* screens-publish R6 (the published case), R7 (another group's case), R8 and R16 (the docket) and R9 (the doorbell), on
 * interface-shell's served page: the two public pages drawn with no session and no credential, the imported case's
 * recreation and acts, the docket's entries, filing and posting signed with the member's key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupName, open, openWorld, main, text, tipOf, drew, drewIn, day, word, ops, press, fill, last, ok, refused, refusedIn, bytes, keptKey, answerSign, choose, plane, PUBLISHED_CASE, P, C, SHA, E1, B1, DIGEST } from "./fixtures.mjs";
const GROUP = await groupName();

const carries = (body, want) => { for (const [k, v] of Object.entries(want)) assert.deepEqual(body[k], v, k); };
const R = "because";
const PUBLIC = { session: null };

test("R6 the published case at /app/published/<case>, in the public frame with no session: findings with two strengths and the bar, dated", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC });
  assert.equal(p.byOp("whoami").length, 0, "no session read");
  for (const r of p.requests) assert.equal(r.headers.Authorization, undefined, `${r.op} carries no credential`);
  assert.equal(last(p, "publishedcase").query.id, C);
  const t = text(p);
  assert.ok(drew(p, "screen.published.dated", { edition: "2", signed: day("2026-11-18"), published: day("2026-11-19") }));
  assert.ok(drew(p, "screen.published.edition", { n: "1" }), "the other edition");
  assert.ok(drew(p, "screen.published.whose", { group: GROUP }));
  assert.ok(drew(p, "screen.published.howtoread"));
  assert.ok(t.includes("The 2024 adjustments were made without the council vote the lease requires."));
  assert.ok(t.includes(word("mark.scale.capture.name") + "B") && t.includes(word("mark.scale.connection.name") + "C"), "two strengths");
  assert.ok(drew(p, "screen.published.meets", { capture: "B", connection: "C" }), "meets the project's bar, named");
  assert.ok(t.includes("Council approves amendment 1") && t.includes(day("2024-01-12")));
  assert.match(t, /The City Administrator.*signed the March 2024 adjustment/);
  assert.match(t, /Council minutes, 12 January 2024/);
  assert.ok(main(p).querySelector(`a[href="/app/published/${encodeURIComponent(C + "/1")}"]`), "the other edition links its page");
});

test("R6 \"Check the signature\" (verify, the manifest's sha) and \"Read the case\", with no account; a mismatch is said (control)", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC });
  await press(p, "verify");
  assert.equal(last(p, "verify").query.sha256, SHA);
  assert.equal(last(p, "verify").headers.Authorization, undefined);
  assert.ok(drew(p, "screen.published.verify.ok"));
  const n = p.byOp("publishedcase").length;
  await press(p, "publishedcase", { nth: 1 }); // the first is the evidence row's "Open the document" (R19)
  assert.ok(p.byOp("publishedcase").length > n);
  const q = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { verify: ok({ published: false, sha256: SHA, matches: [] }) } });
  await press(q, "verify");
  assert.ok(drew(q, "screen.published.verify.no"));
});

const publishedWith = (captures, o = {}) => ({ publishedcase: ok({ ...PUBLISHED_CASE, captures }), ...o });
const opens = (p) => main(p).querySelectorAll('button[data-act="publishedcase"]').filter((b) => b.textContent.includes(word("screen.published.evidence.open")));

test("R19 each evidence row with a full SHA-256 opens its bytes through publishedbytes by that hash, as a public op with no Authorization header", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC });
  assert.equal(opens(p).length, 1);
  await p.click(opens(p)[0]);
  await p.settle();
  const q = last(p, "publishedbytes");
  assert.ok(q, "publishedbytes asked");
  assert.equal(q.query.sha256, E1);
  assert.equal(q.headers.Authorization, undefined, "no credential");
  assert.equal(p.files.length, 1, "the bytes are handed to the browser as a file");
  assert.equal(p.byOp("whoami").length, 0);
  for (const r of p.requests) assert.equal(r.headers.Authorization, undefined, `${r.op} carries no credential`);
});

test("R19 a row with no sha, or one that is not the full hash, draws no link (control); an upper-case hash opens by its lower-case form", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: publishedWith([
    { title: "Council minutes", sha256: E1 }, { title: "Unhashed memo" }, { title: "Short hash", sha256: E1.slice(0, 12) }, { title: "Mixed", sha256: E1.toUpperCase().replace(/^C/, "c") }]) });
  assert.equal(opens(p).length, 2, "only the two rows with a full hash");
  assert.match(text(p), /Unhashed memo/);
  assert.match(text(p), /Short hash/);
  await p.click(opens(p)[1]);
  await p.settle();
  assert.equal(last(p, "publishedbytes").query.sha256, E1.toLowerCase());
  const none = await open(`/app/published/${C}`, { boot: PUBLIC, plane: publishedWith([{ title: "Unhashed memo" }]) });
  assert.equal(opens(none).length, 0);
  assert.equal(none.byOp("publishedbytes").length, 0);
});

test("R19 a refused piece of evidence says why and saves nothing (control)", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedbytes: refused("NO_PUBLISHED_PART", "No published part answers to that hash.") } });
  await p.click(opens(p)[0]);
  await p.settle();
  assert.equal(p.files.length, 0);
  assert.match(text(p), /No published part answers to that hash\./);
});

const download = (p) => main(p).querySelectorAll('button[data-act="publishedcase"]').find((x) => x.textContent.includes(word("screen.published.download")));

test("R19 \"Download the complete edition\" fetches the edition's file through publishedbytes by the manifest's hash as a zip, with no credential, and hands it over as a file", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedbytes: bytes("PK-ZIP", "application/zip") } });
  assert.ok(download(p), "offered");
  await p.click(download(p));
  await p.settle();
  const q = last(p, "publishedbytes");
  assert.equal(q.query.sha256, SHA, "the manifest's hash");
  assert.equal(q.query.format, "zip");
  assert.equal(q.headers.Authorization, undefined);
  assert.equal(p.files.length, 1);
  assert.match(p.files[0].name, /\.zip$/);
  assert.ok(drew(p, "screen.published.download.done"));
  const other = await open(`/app/published/${C}/1`, { boot: PUBLIC, plane: { publishedbytes: bytes("PK-ZIP", "application/zip") } });
  await other.click(download(other));
  await other.settle();
  assert.match(other.files[0].name, /-edition-1\.zip$/, "named for the edition the address names");
});

test("R19 a refused download says why and saves nothing; an edition with no manifest hash offers no download (controls)", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedbytes: refused("PART_MISSING", "A part of the case file is missing.") } });
  await p.click(download(p));
  await p.settle();
  assert.equal(p.files.length, 0);
  assert.match(text(p), /A part of the case file is missing\./);
  const q = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: ok({ ...PUBLISHED_CASE, manifest_sha: "" }) } });
  assert.equal(download(q), undefined);
  const silent = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedbytes: ok(null) } });
  await silent.click(download(silent));
  await silent.settle();
  assert.ok(drew(silent, "screen.published.download.failed"));
});

test("R21 published opened with no id offers the group's public page, never \"Go to Home\"", async () => {
  const p = await open("/app/published", { boot: PUBLIC });
  assert.equal(p.byOp("publishedcase").length, 0);
  const home = main(p).querySelectorAll("a").map((a) => ({ href: a.getAttribute("href"), t: a.textContent }));
  assert.ok(home.some((a) => a.href === "/" && a.t.includes(word("screen.published.grouppage"))), "the public page is offered");
  assert.ok(!drew(p, "shell.unavailable.home"), "no Go to Home");
  assert.ok(!home.some((a) => a.href === "/app"), "no way into the working frame");
  const q = await open(`/app/published/${C}`, { boot: PUBLIC });
  assert.ok(q.byOp("publishedcase").length > 0, "control: with an id it reads");
});

test("R7 another group's case: each finding recreated, in part or not, read-only, with the four acts", async () => {
  const p = await open("/app/imported/IMP-2026-0001");
  assert.equal(last(p, "importedcase").query.import, "IMP-2026-0001");
  const r = main(p).querySelectorAll("[data-r]").map((x) => x.getAttribute("data-r"));
  assert.deepEqual(r, ["yes", "part", "no"]);
  for (const k of ["yes", "part", "no"]) assert.ok(drew(p, `screen.imported.result.${k}`), k);
  assert.deepEqual(ops(p).sort(), ["caseimport", "importaccept", "importflag", "importregrade", "importwatch", "rerunstart"]);
  await press(p, "importaccept", { values: { "im-checked": "Each document's hash against theirs.", "im-reason": "It recreated whole." } });
  carries(last(p, "importaccept").body, { import: "IMP-2026-0001", edition: 2, findings: ["FND-W-1"], checked: "Each document's hash against theirs.", reason: "It recreated whole." });
  await press(p, "importflag", { values: { "im-issue": "Their arrears figure double-counts March." }, reason: R });
  carries(last(p, "importflag").body, { import: "IMP-2026-0001", edition: 2, issue: "Their arrears figure double-counts March." });
  await press(p, "importwatch", { values: { "im-publisher": "http://not-https.example" }, reason: R });
  assert.equal(p.byOp("importwatch").length, 0, "an address that is not https sends nothing (control)");
  await press(p, "importwatch", { values: { "im-publisher": "https://westoakland.example" }, reason: R });
  carries(last(p, "importwatch").body, { import: "IMP-2026-0001", publisher: "https://westoakland.example" });
});

test("R7 \"Import a case\" sends the chosen file's bytes as one part and opens the import", async () => {
  const p = await open("/app/imported", { plane: { caseimport: ok({ import: "IMP-2026-0002", recreation: {} }) } });
  assert.match(text(p), /Port lease revenue/);
  choose(p, "im-file", new Uint8Array([1, 2, 3]));
  await press(p, "caseimport", { reason: R });
  assert.deepEqual(last(p, "caseimport").body.parts, ["AQID"]);
  assert.equal(p.location.pathname, "/app/imported/IMP-2026-0002");
});

test("R8 the docket's entries, each drafted or posted; \"File a docket entry\" with the member's reason for the record or public choice", async () => {
  const p = await open(`/app/docket/${P}/${C}`);
  assert.equal(last(p, "docket").query.case, C);
  const t = text(p);
  assert.ok(t.includes(`${word("screen.docket.kind.edition")} · Edition 2 published, superseding Edition 1`) && drew(p, "screen.docket.posted"));
  assert.ok(t.includes(`${word("screen.docket.kind.court-order")} · Order of 20 November: seal exhibit 4`) && drew(p, "screen.docket.drafted"));
  assert.equal(last(p, "docketprepare").query.entry, "2", "the draft entry is prepared for its post");
  /* B420 2 (DEC-387): the form is drawn whole: the edition it answers (one per ratified edition, the latest first and chosen), the captured
     document it rests on (the project's captures), and the door to capture it first */
  assert.equal(last(p, "heldcaptures").query.project, P);
  const ed = p.doc.getElementById("dk-edition"), cap = p.doc.getElementById("dk-capture");
  assert.ok(ed && cap, "both choices are drawn");
  assert.deepEqual([...ed.querySelectorAll("option")].map((o) => o.getAttribute("value")), ["2", "1"], "the latest edition first");
  assert.equal(ed.value, "2");
  assert.ok(drew(p, "screen.docket.capture.add") && drew(p, "screen.docket.edition.label") && drew(p, "screen.docket.capture.label"));
  await press(p, "docketfile", { values: { "dk-kind": "response", "dk-edition": "1", "dk-capture": E1, "dk-from": "Port of Oakland", "dk-summary": "The Port disputes finding 1.", "dk-proposed": "public", "dk-reason": "It answers a published finding." } });
  carries(last(p, "docketfile").body, { case: C, edition: 1, capture: E1, kind: "response", from: { kind: "other", name: "Port of Oakland" }, summary: "The Port disputes finding 1.", proposed: "public", reason: "It answers a published finding." });
  /* control: with no document chosen nothing is sent */
  const q = await open(`/app/docket/${P}/${C}`, { plane: { heldcaptures: ok({ held: [] }) } });
  await press(q, "docketfile", { values: { "dk-from": "Port of Oakland", "dk-summary": "The Port disputes finding 1.", "dk-reason": "It answers a published finding." } });
  assert.equal(q.byOp("docketfile").length, 0, "no captured document, nothing sent");
});

test("R8 R16 \"Post it, signed\": docketStatement in NS_DOCKET through the signer kit, posted with its digest; declined, nothing is sent", async () => {
  const p = await open(`/app/docket/${P}/${C}`, { boot: { idb: await keptKey() } });
  await press(p, "docketpost", { reason: R });
  const lines = await answerSign(p, true, "docketpost");
  assert.ok(lines.includes(`bio-docket ${C} 3 ${DIGEST}`), "the prepared statement is what the key signs");
  carries(last(p, "docketpost").body, { digest: DIGEST, acknowledged: true });
  assert.match(last(p, "docketpost").body.signature, /^-----BEGIN SSH SIGNATURE-----/);
  const q = await open(`/app/docket/${P}/${C}`, { boot: { idb: await keptKey() } });
  await press(q, "docketpost", { reason: R });
  await answerSign(q, false);
  assert.equal(q.byOp("docketpost").length, 0);
});

test("R16 a prepared statement past its hour is prepared again before it is signed (control: within it, it is not)", async () => {
  let prepared = 0;
  const expired = { docketprepare: () => { prepared += 1; return ok({ entry: "{}", digest: DIGEST, statement: `bio-docket ${C} ${2 + prepared} ${DIGEST}\n`, warning: "", expires: prepared === 1 ? "2000-01-01T00:00:00Z" : "2999-01-01T00:00:00Z" }); } };
  const p = await open(`/app/docket/${P}/${C}`, { boot: { idb: await keptKey() }, plane: expired });
  await press(p, "docketpost", { reason: R });
  const lines = await answerSign(p, true, "docketpost");
  assert.ok(lines.includes(`bio-docket ${C} 4 ${DIGEST}`), "the fresh statement is the one signed");
  assert.ok(!lines.includes(`bio-docket ${C} 3 ${DIGEST}`), "not the stale one");
  const between = (q, n) => q.requests.slice(n, q.requests.indexOf(last(q, "docketpost"))).filter((r) => r.op === "docketprepare").length;
  const q = await open(`/app/docket/${P}/${C}`, { boot: { idb: await keptKey() } });
  const n = q.requests.length;
  await press(q, "docketpost", { reason: R });
  await answerSign(q, true, "docketpost");
  assert.equal(between(q, n), 0, "within its hour, not prepared again");
});

test("R9 the doorbell at /app/doorbell with no session: headed by the group's public name, what happens to what is sent", async () => {
  const p = await open("/app/doorbell", { boot: PUBLIC });
  assert.equal(p.byOp("whoami").length, 0);
  assert.ok(p.byOp("groupidentity").length > 0);
  const t = text(p);
  assert.ok(drew(p, "screen.doorbell.heading", { group: GROUP }));
  for (const k of ["only", "reads", "phrase", "court"]) assert.ok(drew(p, `screen.doorbell.happens.${k}`), k);
  assert.ok(p.doc.getElementById("db-file") && p.doc.getElementById("db-note") && p.doc.getElementById("db-secret"));
});

test("R9 R11 \"Hand it over\" sends the file, note and phrase with no credential, says it was received, and keeps no phrase", async () => {
  const phrase = "SENTINEL-PHRASE-correct-horse-battery";
  const p = await openWorld("/app/doorbell"); // the real doorbell behind the page's door (store-request's world)
  choose(p, "db-file", new Uint8Array([104, 105]));
  await press(p, "knock", { values: { "db-note": "Inspection sheets.", "db-secret": phrase } });
  const k = last(p, "knock");
  assert.equal(k.headers.Authorization, undefined);
  carries(k.body, { contentB64: "aGk=", note: "Inspection sheets.", knockerSecret: phrase });
  assert.ok(main(p).querySelector("[data-received]"));
  assert.equal(p.doc.getElementById("db-secret").value, "", "the phrase field is cleared");
  for (const v of [...p.store.values(), ...p.local.values()]) assert.ok(!String(v).includes(phrase));
  const later = p.requests.filter((r) => r !== k);
  for (const r of later) assert.ok(!JSON.stringify([r.url, r.body]).includes(phrase), "no other request carries it");
});

test("R9 the knock's refusals are drawn by their words; nothing chosen sends nothing (control)", async () => {
  const p = await open("/app/doorbell", { boot: PUBLIC });
  const { slot } = await press(p, "knock");
  assert.equal(p.byOp("knock").length, 0);
  assert.ok(slot().textContent.includes(word("screen.doorbell.refused.empty")));
  for (const [code, words] of [["KNOCK_EMPTY", "empty"], ["KNOCK_PAYLOAD_TOO_LARGE", "large"], ["KNOCK_ENVELOPE_TOO_LARGE", "large"], ["RATE_IP", "rate"]]) {
    const q = await open("/app/doorbell", { boot: PUBLIC, plane: { knock: refused(code, null, 413) } });
    choose(q, "db-file", new Uint8Array([1]));
    const r = await press(q, "knock");
    assert.ok(r.slot().textContent.includes(word(`screen.doorbell.refused.${words}`)), code);
    assert.equal(q.doc.getElementById("db-note").value, "", code);
  }
});

/* R22 (N1094; DEC-240 (P1); public-read R1, R3): "Check a file you hold". The plane answers by hash as public-read does:
   `verify` says whether a hash is published; `publishedcase` read by a finding's pinned hash names its case and finding, and
   answers a file's hash (evidence) `NOT_PUBLISHED`, so the edition's own parts name the finding for a file. */
const FIND = "FND-2026-0031";
const EDITION = () => PUBLISHED_CASE;
const checkButton = (p) => main(p).querySelectorAll('button[data-act="verify"]').find((b) => b.getAttribute("data-check") === "1");
const checkIt = (p, typed) => press(p, "verify", { nth: 1, values: { "pb-sha": typed } });
const published = (pins, o = {}) => ({
  verify: (req) => ok(pins.includes(req.query.sha256) ? { published: true, sha256: req.query.sha256, matches: [{ bundle_id: FIND, path: "bundle.md", kind: "bundle", published: "2026-11-19T14:00:00Z" }] }
    : { published: false, sha256: req.query.sha256, matches: [] }),
  publishedcase: (req) => !req.query.sha256 ? ok(EDITION())
    : req.query.sha256 === B1 ? ok({ ...EDITION(), asked: FIND, findings: [{ ...EDITION().findings[0], version_sha: B1 }] }) : refused("NOT_PUBLISHED", "Nothing published answers to that.", 404),
  ...o });
const FINDING_SAYS = "The 2024 adjustments were made without the council vote the lease requires.";

test("R22 \"Check a file you hold\": a field for the SHA-256 and \"Check it\" on the published page, drawn with no session", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC });
  const head = main(p).querySelectorAll("h2").find((h) => h.textContent === word("published.check.title"));
  assert.ok(head, "the section's title");
  assert.ok(tipOf(head).includes(word("published.check.help")), "explained by published.check.help");
  assert.ok(drew(p, "published.check.field") && drew(p, "published.check.field.help"));
  assert.ok(p.doc.getElementById("pb-sha"), "the field");
  assert.ok(checkButton(p) && checkButton(p).textContent.includes(word("published.check.go")), "Check it");
  assert.equal(p.byOp("whoami").length, 0, "no account");
});

test("R22 a pinned hash (a finding's, and a file the finding rests on) draws the finding it belongs to; the hash is case-folded and nothing but the hash is sent, with no Authorization header", async () => {
  for (const [typed, shown] of [[E1.toUpperCase(), E1], [B1, B1]]) {
    const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: published([E1, B1]) });
    const n = p.requests.length;
    await checkIt(p, `  ${typed}  `);
    const sent = p.requests.slice(n);
    assert.ok(sent.some((r) => r.op === "verify"), "verify asked");
    for (const r of sent) {
      assert.equal(r.headers.Authorization, undefined, `${r.op}: no credential`);
      assert.deepEqual(Object.keys(r.query).sort(), ["op", "sha256"], `${r.op}: nothing but the hash`);
      assert.equal(r.query.sha256, shown, `${r.op}: the lower-case hash`);
      assert.equal(r.body, undefined, `${r.op}: no body, so no file`);
    }
    assert.ok(drew(p, "published.check.yes", { n: "1", finding: FINDING_SAYS }), "the evidence for finding 1, named");
    assert.ok(!drew(p, "published.check.no"));
  }
});

test("R22 an unknown hash draws \"no match\", and a hash published in another edition of the case is no match in this one (controls)", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: published([E1, B1]) });
  const n = p.requests.length;
  await checkIt(p, "0".repeat(64));
  assert.ok(drew(p, "published.check.no") && !drew(p, "published.check.yes", { n: "1", finding: FINDING_SAYS }));
  assert.deepEqual(p.requests.slice(n).map((r) => r.op), ["verify"], "an unknown hash is not looked up further");
  const other = "5".repeat(64);
  const q = await open(`/app/published/${C}`, { boot: PUBLIC, plane: published([other], {
    publishedcase: (req) => ok(req.query.sha256 ? { ...EDITION(), edition: 1, asked: FIND, findings: [{ ...EDITION().findings[0], version_sha: other }] } : EDITION()) }) });
  await checkIt(q, other);
  assert.ok(drew(q, "published.check.elsewhere") && !drew(q, "published.check.no"), "published in Edition 1, not in the Edition 2 on the page");
  assert.ok(!drew(q, "published.check.yes", { n: "1", finding: FINDING_SAYS }));
});

test("R22 a hash that is not 64 hexadecimal characters sends nothing and says what the field takes (control)", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: published([E1]) });
  const n = p.requests.length;
  for (const bad of ["", "abc", E1.slice(1), E1 + "0", "g".repeat(64)]) {
    await checkIt(p, bad);
    assert.equal(p.requests.length, n, `${JSON.stringify(bad)}: nothing sent`);
  }
  assert.ok(drew(p, "published.check.field.help"));
  assert.ok(!drew(p, "published.check.yes", { n: "1", finding: FINDING_SAYS }) && !drew(p, "published.check.no"));
});

test("R22 \"Check the signature\" still checks the manifest, and the page keeps the file out of reach: the field takes a fingerprint only", async () => {
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: published([SHA]) });
  await press(p, "verify");
  assert.equal(last(p, "verify").query.sha256, SHA);
  assert.ok(drew(p, "screen.published.verify.ok"));
  assert.notEqual(p.doc.getElementById("pb-sha").type, "file", "R22: no file is read or sent");
});

test("R22 a verify answered ok that carries a refusal is no match found (D29)", async () => {
  // fixtures-generic: VERIFY_NOT_RUN (a made-up refusal code: the page draws the plane's canned translation for a code it holds no word for)
  const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: { verify: ok({ started: false, code: "VERIFY_NOT_RUN", translation: "The check did not run." }) } });
  await checkIt(p, E1);
  assert.ok(text(p).includes("The check did not run."), "the refusal in the plane's words");
  assert.ok(!drew(p, "published.check.yes", { n: "1", finding: FINDING_SAYS }) && !drew(p, "published.check.no"));
});

test("R6 a finding below the project's bar is said so; one the bar was not asked of, or no bar was declared for, says nothing about it (standing, case-grammar R15)", async () => {
  const one = (standing) => ({ publishedcase: ok({ ...EDITION(), findings: [{ ...EDITION().findings[0], standing }] }) });
  const below = await open(`/app/published/${C}`, { boot: PUBLIC, plane: one({ role: "load_bearing", bar: { capture: "B", connection: "C" }, meets: false, short: ["capture"] }) });
  assert.ok(drew(below, "screen.published.below", { capture: "B", connection: "C" }) && !drew(below, "screen.published.meets", { capture: "B", connection: "C" }));
  for (const meets of ["not_asked", "no_bar", null]) {
    const p = await open(`/app/published/${C}`, { boot: PUBLIC, plane: one({ role: "supporting", bar: { capture: null, connection: null }, meets }) });
    assert.ok(!drew(p, "screen.published.below", { capture: "–", connection: "–" }) && !drew(p, "screen.published.meets", { capture: "–", connection: "–" }), String(meets));
  }
});

/* ---------- fix round 10 (K5148; WALK-FINAL-10B C5): the page draws what `publishedcase` carries ---------- */

const C5S = (o = {}) => ({ ...PUBLISHED_CASE, ...o });
const C5F = (o = {}) => ({ ...PUBLISHED_CASE.findings[0], ...o });
const c5pub = (o, p = {}) => open(`/app/published/${C}`, { boot: PUBLIC, plane: { publishedcase: ok(C5S(o)), ...p } });

test("R6 R81 (C5 a) a finding's unrated axis draws the design's 'not graded yet' words by key, and a case with no bar declared draws the plane's bar sentence; with a bar and grades neither is drawn (control)", async () => {
  const UNRATED = "Not graded yet on capture: none of the documents this conclusion rests on has a grade that can be counted.";
  const NOBAR = "No standard of evidence was recorded for this case, which is not a standard of zero.";
  const p = await c5pub({ bar: null, bar_detail: NOBAR, findings: [C5F({
    strength: [{ axis: "capture", state: "unrated", grade: null, detail: UNRATED }, { axis: "connection", state: "graded", grade: "B" }],
    standing: { role: "load_bearing", bar: { capture: null, connection: null }, meets: "no_bar", short: [], line: "x" } })] });
  const card = main(p).querySelector('[data-finding]');
  assert.ok(drew(p, "screen.published.strength.unrated", {}, card), "the unrated axis says it is not graded yet, by its key");
  assert.ok(!text(p, card).includes(UNRATED), "the served sentence is not drawn (R81)");
  assert.equal(main(p).querySelectorAll("[data-ungraded]").length, 1, "one axis is ungraded: one line");
  assert.ok(text(p).includes(NOBAR) && main(p).querySelectorAll("[data-bar-none]").length === 1, "the case says no bar was declared");
  assert.ok(!drew(p, "screen.published.meets", { capture: "–", connection: "–" }) && !drew(p, "screen.published.below", {}), "no bar: neither met nor below is said");
  const q = await c5pub({ bar: { capture: "B", connection: "C" }, bar_detail: "the standard this case was held to" });
  assert.equal(main(q).querySelectorAll("[data-ungraded]").length, 0, "graded axes draw no ungraded line");
  assert.equal(main(q).querySelectorAll("[data-bar-none]").length, 0, "a declared bar draws no 'no bar' line");
});

test("R6 (C5 b, R96 a) an older edition quotes the newer edition's What-changed beside its link; a successor whose document an order withholds is pointed to, with its detail and no statement; none draws nothing (control)", async () => {
  const one = await open(`/app/published/${encodeURIComponent(C + "/1")}`, { boot: PUBLIC, plane: { publishedcase: ok(C5S({ edition: 1,
    successor: { edition: 2, statement: "The newer reading adds the 2025 schedules." } })) } });
  const link = main(one).querySelector(`a[href="/app/published/${encodeURIComponent(C + "/2")}"]`);
  assert.ok(link, "the newer edition is linked");
  const beside = main(one).querySelector('[data-successor="2"]');
  assert.ok(beside && text(one, beside).includes("The newer reading adds the 2025 schedules."), "its statement is quoted beside the link");
  const held = await open(`/app/published/${encodeURIComponent(C + "/1")}`, { boot: PUBLIC, plane: { publishedcase: ok(C5S({ edition: 1,
    successor: { edition: 2, statement: null, withheld: true, detail: "A court order withholds it." } })) } });
  assert.ok(text(held).includes("A court order withholds it.") && !text(held).includes("null"), "the withheld successor's detail is drawn, no statement");
  const none = await open(`/app/published/${encodeURIComponent(C + "/2")}`, { boot: PUBLIC, plane: { publishedcase: ok(C5S({ successor: null })) } });
  assert.equal(main(none).querySelectorAll("[data-successor]").length, 0);
});

test("R6 (C5 c) the lens: its statements and the document's closing sentences are drawn under the lens heading; an edition with only the fingerprint says so; none draws no lens section (control)", async () => {
  const lens = { bias_acknowledgement: "We read the lease as tenants.", statements: [{ bundle: "B", id: "S1", kind: "statement", subject: "x", text: "A tenant's account counts as evidence.", justification: "Tenants hold the notices.", citations: [], withheld: 0 }],
    closing: ["Everyone who investigates looks through a lens.", "We state ours so you can discount it."], print: "…" };
  const p = await c5pub({ bias_acknowledgement: "We read the lease as tenants.", lens });
  const sec = main(p).querySelector("[data-lens]");
  assert.ok(sec, "the lens section");
  const t = text(p, sec);
  for (const s of ["We read the lease as tenants.", "A tenant's account counts as evidence.", "Tenants hold the notices.", ...lens.closing]) assert.ok(t.includes(s), s);
  const fp = await c5pub({ bias_acknowledgement: null, lens: null, lens_fingerprint: "f".repeat(64), lens_detail: "x" });
  assert.ok(drewIn(main(fp).querySelector("[data-lens]"), "screen.published.this_edition_carries_only_the", { fingerprint: "f".repeat(64) }));
  const none = await c5pub({ bias_acknowledgement: null, lens: null, lens_fingerprint: null });
  assert.equal(main(none).querySelectorAll("[data-lens]").length, 0, "nothing signed, nothing drawn");
});

test("R6 (C5 d) the header holds the case id and the manifest's hash; without a manifest no hash is drawn (control)", async () => {
  const p = await c5pub({ scope: "The Coliseum lease" });
  const head = main(p).querySelector("[data-case-head]");
  assert.ok(head && text(p, head).includes(C) && text(p, head).includes(SHA), "the case id and the manifest hash, whole");
  const q = await c5pub({ manifest_sha: null });
  assert.ok(text(q, main(q).querySelector("[data-case-head]")).includes(C) && !main(q).querySelector("[data-manifest]"), "no manifest: no hash drawn");
});

test("R6 R81 (C5 e, R95 a) the verification explanation is drawn by key with the signature check; an answer without one draws none (control)", async () => {
  const SAID = "tamper-EVIDENT, not tamper-proof; the deliverer is this team's Civicsmith's record, not covered by any signature.";
  /* R100: the explanation says the signature and key are shown here, so it is drawn with the case document's signature and key */
  const p = await c5pub({ verification: { container: "x", manifest: "y", case_file: null, findings: [], detail: SAID },
    document: { sig_armored: "-----BEGIN SSH SIGNATURE-----\nU1NIU0lH\n-----END SSH SIGNATURE-----", attestor: { member: "rosa", key_b64: "AAAAC3NzaC1lZDI1NTE5AAAAIKEY" } } });
  assert.ok(drew(p, "screen.published.verify.detail", {}, main(p).querySelector("[data-verification]")), "by its key");
  assert.ok(!text(p).includes(SAID), "the served sentence is not drawn (R81)");
  const q = await c5pub({});
  assert.equal(main(q).querySelectorAll("[data-verification]").length, 0);
});

test("R7 (C6; case-import R4) an imported case is named by its scope and its findings by their titles, in the list and on its page, never by an id; an answer stating none draws the screen's name and 'Finding n' (control)", async () => {
  const ID = "CASE-2026-3549", FID = "INQ-2026-0001-did-the-clerk-stamp-the-contract-before";
  const ed = { edition: 1, imported_by: "dev", imported_at: "2026-10-01T09:00:00Z", importer: { member: "dev", handle: "dev" } };
  const list = await open("/app/imported", { plane: { importedcases: ok({ imports: [{ import: "IMP-2026-0001", group: "West Oakland Neighbors", case: ID, scope: "Did the clerk stamp the contract before the vote?", latest_edition: 1,
    editions: [{ ...ed, findings: 1, recreated: 1, recreated_in_part: 0, did_not_recreate: 0 }] }], count: 1, wrote: false }) } });
  assert.ok(text(list).includes("Did the clerk stamp the contract before the vote?") && !text(list).includes(ID), "the list names the case by its scope");
  const one = await open("/app/imported/IMP-2026-0001", { plane: { importedcase: ok({ import: "IMP-2026-0001", group: "West Oakland Neighbors", case: ID, scope: "Did the clerk stamp the contract before the vote?",
    edition: { ...ed, findings: [{ finding: FID, title: "The clerk stamped it a day late", result: "recreated" }] }, wrote: false }) } });
  assert.ok(text(one).includes("Did the clerk stamp the contract before the vote?") && text(one).includes("The clerk stamped it a day late"), "the page names the case and the finding");
  assert.ok(!text(one).includes(ID) && !text(one).includes(FID), "no id is drawn");
  const bare = await open("/app/imported/IMP-2026-0001", { plane: { importedcase: ok({ import: "IMP-2026-0001", group: "West Oakland Neighbors", case: ID, scope: null,
    edition: { ...ed, findings: [{ finding: FID, title: null, result: "recreated" }] }, wrote: false }) } });
  assert.ok(!text(bare).includes(ID) && !text(bare).includes(FID), "an answer that states no name draws no id either");
  assert.ok(drew(bare, "screen.published.finding", { n: "1" }));
});
