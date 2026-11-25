/* capture-requests at T35 (T35-45): R49 (F2 as Bob ruled it, K1880, with BOB's final rule; K1881's bound) at the door
   (R2) and again at the drain (R14); R50 (K1888 (4)), the member's co-archive choice carried to the fetch (R15); R51–R53
   (N646; K1724, K1740), the records request for a policy known only by citation; R34's new rows; and R54 (DEC-149,
   N692), the eight strings that now say "your group's Civicsmith". Every test drives the module at its interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, sha, filed } from "./fixture.mjs";
import { standardReadWorld } from "../standards/fixtures.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { CAPTURE_REQUEST_CHECKS, CAPTURE_REQUEST_ADDRESS_MAX, RECORDS_ANSWERS, captureRequestsOps }
  from "../../../src/capture-requests/index.mjs";

const count = (w) => w.row(`SELECT count(*) AS n FROM capture_requests`).n;
const rrCount = (w) => w.row(`SELECT count(*) AS n FROM records_requests`).n;
const refusedBy = (a, code) => {
  assert.equal(a.ok, false, JSON.stringify(a).slice(0, 300));
  assert.equal(a.code, code, JSON.stringify(a).slice(0, 300));
  assert.equal(a.reason, code);
  assert.equal(a.check, CAPTURE_REQUEST_CHECKS[code].check);
  assert.equal(a.translation, CAPTURE_REQUEST_CHECKS[code].translation);
};
/** The door with nothing held for it (the fixture's `ask` holds its address unless told not to). */
const askUnheld = (w, over = {}, stamps = {}) => w.ask({ held: false, ...over }, stamps);

/* ===================================================================== *
 * R49 — AN ADDRESS THE RECORD ALREADY HOLDS
 * ===================================================================== */

test("R49 R2 the injected document: a held document carrying an instruction to request an address with a passage of the record in its query is refused CAPTURE_REQUEST_ADDRESS_NOT_HELD, nothing written or fetched; the same address with its query is accepted only once a held capture's outbound link carries it exactly; a held link without the query does not admit it", async () => {
  const w = world().scene();
  /* the record holds a document; its text carries an injected instruction that would carry a passage out */
  const passage = encodeURIComponent("the council's closed-session minutes, item 4: settlement of 2.1 million");
  const injected = `https://collect.example.net/x?d=${passage}`;
  w.hold("https://city.example.gov/minutes.pdf", { bundle: "DOC-1" });
  const heard = [];
  w.cr.onRequestFiled("listener", (n) => heard.push(n));
  /* the run follows the instruction: refused by name, before anything is written */
  const a = askUnheld(w, { address: injected });
  refusedBy(a, "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
  assert.match(a.detail, /reading may go anywhere, but only an address the record already holds is captured for it/);
  assert.equal(count(w), 0, "nothing written");
  assert.deepEqual(heard, [], "nobody told");
  await w.cr.drain({});
  assert.equal(w.capture.calls.length, 0, "nothing fetched");
  /* a held link to the address WITHOUT the query does not admit the address with one */
  w.hold("https://collect.example.net/x", { as: "link" });
  refusedBy(askUnheld(w, { address: injected }), "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
  /* the control: a held capture's outbound link carrying the address, query included, admits it */
  w.hold(injected, { as: "link" });
  const ok = askUnheld(w, { address: injected });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(count(w), 1);
});

test("R49 held means equal character for character once scheme and host are lower-cased: a receipt's address, a receipt's retrieval locator, or a held link with its fragment; path, query and fragment case and spelling count", () => {
  const w = world().scene();
  /* a receipt's address, held with an upper-case host: the asked address with a lower-case host and scheme matches */
  w.hold("https://Records.Example.org/Doc.pdf?ID=7");
  assert.equal(askUnheld(w, { address: "HTTPS://records.example.ORG/Doc.pdf?ID=7" }).ok, true);
  /* the path, the query and the fragment are compared as written */
  for (const address of ["https://records.example.org/doc.pdf?ID=7", "https://records.example.org/Doc.pdf?id=7",
                         "https://records.example.org/Doc.pdf?ID=7&x=1", "https://records.example.org/Doc.pdf?ID=7#p2",
                         "https://records.example.org/Doc.pdf", "https://records.example.org/Doc.pdf?ID=%37"])
    refusedBy(askUnheld(w, { address }), "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
  /* a receipt's retrieval locator */
  w.hold("https://mirror.example.org/copy/doc.pdf", { as: "retrieval", of: "https://gone.example.org/doc.pdf" });
  assert.equal(askUnheld(w, { address: "https://mirror.example.org/copy/doc.pdf" }).ok, true);
  /* a link with its fragment admits exactly that address with that fragment */
  w.hold("https://report.example.org/r.html#findings", { as: "link" });
  assert.equal(askUnheld(w, { address: "https://report.example.org/r.html#findings" }).ok, true);
  refusedBy(askUnheld(w, { address: "https://report.example.org/r.html#methods" }), "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
  refusedBy(askUnheld(w, { address: "https://report.example.org/r.html" }), "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
});

test("R49 sight: an address held only by a capture filed in a bundle the viewer may not see is not held for that viewer; it is for a member who sees the bundle; a capture filed in no bundle is visible", () => {
  const w = world().scene();
  w.project("PROJ-H");
  w.participant("PROJ-H", "inner");
  w.bundle("INQ-H");
  w.bundle("DOC-H", "information");
  w.st.sql.exec(`UPDATE bundles SET project='PROJ-H' WHERE bundle_id IN ('INQ-H', 'DOC-H')`);
  w.membership.reindexProjectSight("INQ-H");
  w.membership.reindexProjectSight("DOC-H");
  w.run("R-H", { plane: "member:inner/tok3" });
  const secret = "https://hidden.example.org/only-in-the-project.pdf";
  w.hold(secret, { bundle: "DOC-H" });
  /* ann sees INQ-1 but not DOC-H: the address is not one the record holds for her */
  refusedBy(askUnheld(w, { address: secret }), "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
  /* inner sees DOC-H */
  const inner = w.cr.captureRequest({ run: "R-H", address: secret, target: "INQ-H", purpose: "investigate" },
                                    { viewer: V("inner"), caller: "member:inner/tok3" });
  assert.equal(inner.ok, true, JSON.stringify(inner));
  /* a capture filed in no bundle */
  w.hold("https://loose.example.org/a.pdf");
  assert.equal(askUnheld(w, { address: "https://loose.example.org/a.pdf" }).ok, true);
  /* an unrecognised viewer holds nothing */
  w.hold("https://loose.example.org/b.pdf");
  /* (R1 answers first for a viewer who cannot see the run, so the run here is one every recognised stamp sees and the
     viewer is unrecognised only to membership: R49's own refusal, not R1's) */
  const nobody = askUnheld(w, { address: "https://loose.example.org/b.pdf" }, { viewer: "class:nobody" });
  refusedBy(nobody, "CAPTURE_REQUEST_ADDRESS_NOT_HELD");
});

test("R49 the bound: an address over 2,048 characters is refused CAPTURE_REQUEST_ADDRESS_TOO_LONG, naming the bound and the length, never cut, even when held; one of exactly 2,048 is judged as any other", () => {
  const w = world().scene();
  assert.equal(CAPTURE_REQUEST_ADDRESS_MAX, 2048);
  const base = "https://long.example.org/p?q=";
  const at = base + "a".repeat(2048 - base.length);
  const over = at + "b";
  assert.equal(at.length, 2048);
  w.hold(at); w.hold(over);
  const ok = askUnheld(w, { address: at });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 200));
  assert.equal(w.req(ok.request).address, at, "stored whole");
  const r = askUnheld(w, { address: over });
  refusedBy(r, "CAPTURE_REQUEST_ADDRESS_TOO_LONG");
  assert.deepEqual([r.bound, r.length], [2048, 2049]);
  assert.match(r.detail, /2049 characters long .* at most 2048; it was refused whole, never cut/);
  assert.equal(count(w), 1);
});

test("R49 R14 at the drain, directly after attribution: a row written before R49 (a migrated row) or returned by a retry, for an address the record does not hold, is refused CAPTURE_REQUEST_ADDRESS_NOT_HELD, terminal, nothing fetched; a row naming a sweep is judged first and its scope check never asked (no sweep exception); attribution still comes first", async () => {
  const w = world().scene();
  const asked = [];
  w.cr.registerSweepScope("link-sweep", (a) => { asked.push(a); return { ok: true, scope: ["https://"] }; });
  const migrated = (request, address, extra = {}) => w.st.sql.exec(
    `INSERT INTO capture_requests (request, run, target, address, host, purpose, ua_mode, principal_plane, principal_claude,
       state, attempts, requested_at, updated, expires, sweep)
     VALUES (?, 'R-1', 'INQ-1', ?, ?, 'investigate', 'civicsmith', 'member:ann/tok1', ?, 'requested', 0,
             '2026-09-28T00:59:00Z', '2026-09-28T00:59:00Z', '2026-09-29T00:59:00Z', ?)`,
    request, address, new URL(address).host, extra.claude ?? "instance", extra.sweep ?? null);
  migrated("CR-OLD-1", "https://old.example.org/a?d=passage");
  migrated("CR-OLD-SWEEP", "https://swept.example.org/b", { sweep: "INQ-1#agendas" });
  migrated("CR-OLD-HALF", "https://half.example.org/c", { claude: " " });
  const d = await w.cr.drain({});
  for (const id of ["CR-OLD-1", "CR-OLD-SWEEP"]) {
    assert.deepEqual([w.req(id).state, w.req(id).code], ["refused", "CAPTURE_REQUEST_ADDRESS_NOT_HELD"], id);
    const e = d.refused.find((x) => x.request === id);
    assert.equal(e.check, "C-28.24", id);
  }
  assert.deepEqual([w.req("CR-OLD-HALF").state, w.req("CR-OLD-HALF").code], ["refused", "CAPTURE_ATTRIBUTION_ONE_PRINCIPAL"]);
  assert.deepEqual(asked, [], "the sweep's scope check was never asked");
  assert.equal(w.capture.calls.length, 0, "nothing fetched");
  const look = w.log().find((l) => l.subject === "https://old.example.org/a?d=passage");
  assert.equal(look.state, "LOOKED_INDETERMINATE");
  /* a held address's row drains as before; a held address that stops being held (its bundle hidden from the asker)
     is refused at the drain */
  const ok = w.ask({ address: "https://held.example.org/now" }).request;
  w.project("PROJ-X");
  w.bundle("DOC-X", "information");
  w.st.sql.exec(`UPDATE bundles SET project='PROJ-X' WHERE bundle_id='DOC-X'`);
  w.membership.reindexProjectSight("DOC-X");
  w.hold("https://moved.example.org/later", { bundle: "DOC-X" });
  w.hold("https://moved.example.org/later", { capture: sha("loose copy") });
  const later = w.ask({ address: "https://moved.example.org/later", held: false }).request;
  w.st.sql.exec(`DELETE FROM captured_locators WHERE capture_sha=?`, sha("loose copy"));
  w.tick();
  const d2 = await w.cr.drain({});
  assert.ok(d2.captured.find((x) => x.request === ok));
  assert.deepEqual([w.req(later).state, w.req(later).code], ["refused", "CAPTURE_REQUEST_ADDRESS_NOT_HELD"]);
});

test("R49 R42 a refused request a member retries is judged again at the drain: an address no longer held is refused CAPTURE_REQUEST_ADDRESS_NOT_HELD and not fetched", async () => {
  const w = world().scene();
  const address = "https://login.example.org/doc";
  const id = w.ask({ address }).request;
  w.capture.script.set(address, { status: 401, body: { ok: false, reason: "SOURCE_REFUSED", status: 401 } });
  await w.cr.drain({});
  assert.equal(w.req(id).source_reason, "login");
  w.st.sql.exec(`DELETE FROM captured_locators`);
  assert.equal(w.cr.captureRequestRetry({ request: id }, { viewer: V("ann") }).ok, true);
  w.tick();
  await w.cr.drain({});
  assert.deepEqual([w.req(id).state, w.req(id).code], ["refused", "CAPTURE_REQUEST_ADDRESS_NOT_HELD"]);
  assert.equal(w.capture.calls.length, 1, "only the first fetch");
});

/* ===================================================================== *
 * R50 — THE MEMBER'S CO-ARCHIVE CHOICE
 * ===================================================================== */

test("R50 R15 a member's true or false is stored, answered by the door, by the standing row (R6) and by every read (R24, R43), and passed to the fetch unchanged as coArchive; absent or null leaves it to the group's setting and nothing is passed", async () => {
  const w = world().scene();
  const t = w.ask({ address: "https://a.example.org/yes", co_archive: true });
  const f = w.ask({ address: "https://a.example.org/no", co_archive: false });
  const n = w.ask({ address: "https://a.example.org/none" });
  const z = w.ask({ address: "https://a.example.org/null", co_archive: null });
  assert.deepEqual([t.co_archive, f.co_archive, n.co_archive, z.co_archive], [true, false, null, null]);
  assert.deepEqual([t, f, n].map((a) => w.req(a.request).co_archive), [1, 0, null]);
  /* the standing row keeps its stored value, whatever the second ask says */
  const again = w.ask({ address: "https://a.example.org/no", co_archive: true });
  assert.deepEqual([again.already, again.co_archive], [true, false]);
  const rows = w.cr.captureRequests({ viewer: V("ann") }).requests;
  const by = Object.fromEntries(rows.map((r) => [r.request, r.co_archive]));
  assert.deepEqual([t, f, n, z].map((x) => by[x.request]), [true, false, null, null]);
  assert.equal(w.cr.requestById({ request: t.request, viewer: V("ann") }).co_archive, true);
  /* the fetch: the member's choice reaches the fake capture as acquisition R43's `coArchive`; none for null */
  for (let i = 0; i < 4; i++) { await w.cr.drain({}); w.tick(); }
  const sent = Object.fromEntries(w.capture.calls.map((c) => [c.opts.captureRequest.locator, c.opts.captureRequest]));
  assert.equal(sent["https://a.example.org/yes"].coArchive, true);
  assert.equal(sent["https://a.example.org/no"].coArchive, false);
  assert.equal("coArchive" in sent["https://a.example.org/none"], false);
  assert.equal("coArchive" in sent["https://a.example.org/null"], false);
});

test("R50 a co-archive choice under a stamp that is not a member's is refused CAPTURE_REQUEST_CO_ARCHIVE_NOT_A_MEMBERS, and any value but true, false or null CAPTURE_REQUEST_CO_ARCHIVE_MALFORMED, each before anything is written; a member's own credential chooses; a machine sending none is accepted", () => {
  const w = world().scene();
  w.run("R-M", { plane: "class:probe" });
  for (const co_archive of [true, false]) {
    const r = w.ask({ run: "R-M", address: "https://m.example.org/x", co_archive }, { caller: "class:probe", viewer: "class:probe" });
    refusedBy(r, "CAPTURE_REQUEST_CO_ARCHIVE_NOT_A_MEMBERS");
  }
  for (const co_archive of ["yes", 1, 0, "true", {}, []]) refusedBy(w.ask({ co_archive }), "CAPTURE_REQUEST_CO_ARCHIVE_MALFORMED");
  assert.equal(count(w), 0);
  assert.equal(w.ask({ run: "R-M", address: "https://m.example.org/x" }, { caller: "class:probe", viewer: "class:probe" }).ok, true);
  /* a credential a member minted (`member:<id>/<token>`) is that member's */
  assert.equal(w.ask({ address: "https://m.example.org/mine", co_archive: false }).co_archive, false);
  /* the op reads it from the body, the stamp from the query string */
  w.hold("https://m.example.org/op");
  const url = new URL("http://x/capturerequest?viewer=member%3Aann&principal=member%3Aann%2Ftok1");
  const o = captureRequestsOps(w.cr, url, { run: "R-1", address: "https://m.example.org/op", target: "INQ-1",
                                           purpose: "investigate", co_archive: true }).capturerequest();
  assert.equal(o.co_archive, true);
});

/* ===================================================================== *
 * R51–R53 — RECORDS REQUESTS
 * ===================================================================== */

/** standards' R5 over standards' published fixture (`standardReadWorld`: the real `standardsOf` over a seeded record). The test names each standard (`add`);
 *  the read is the real standard's, made under the name's real id. A standard the test hides (`hidden`, with the viewers who see it) answers a viewer who
 *  does not as the real answer for an id the record does not hold (standards' own R17); the sight of a project is not offered by the fixture (reported to BOB, J7). */
function realStandards() {
  const sw = standardReadWorld();
  const ids = new Map(), hidden = new Map();
  const asViewer = (viewer) => (typeof viewer === "string" && /^(member:|class:|admin$)/.test(viewer) ? sw.member : sw.stranger);
  return {
    add(name, { held = "cited", cite = `Policy ${name}`, seenBy = null } = {}) {
      const p = sw.passage();
      const extra = held === "cited" ? { held, text: "", cited_by: { captureSha: p.capSha, extent: { kind: "pdf-page", page: 0 } } }
        : held === "absent" ? { held, text: "", search: { places: ["the issuer's records portal"] } } : { held };
      const r = sw.declare({ cite, kind: "policy", issuer: "Police Department", ...extra });
      assert.equal(r.ok, true, JSON.stringify(r));
      ids.set(name, r.id);
      if (seenBy) hidden.set(name, seenBy);
    },
    /** the real read of a named standard, as the viewer the fixture offers. */
    real: (name) => sw.standardRead({ id: ids.get(name), viewer: sw.member }),
    standardRead({ id, viewer }) {
      if (hidden.has(id) && !hidden.get(id).includes(viewer)) return sw.standardRead({ id, viewer: asViewer(viewer) });
      return sw.standardRead({ id: ids.get(id) ?? id, viewer: asViewer(viewer) });
    },
  };
}
function rrWorld() {
  const box = {};
  const w = world({ standards: () => box.s }).scene();
  box.s = realStandards();
  box.s.add("STD-1"); box.s.add("STD-2"); box.s.add("STD-TEXT", { held: "text" }); box.s.add("STD-ABSENT", { held: "absent" });
  w.project("PROJ-S");
  w.participant("PROJ-S", "inner");
  w.bundle("SRC-H", "information");
  w.st.sql.exec(`UPDATE bundles SET project='PROJ-S' WHERE bundle_id='SRC-H'`);
  w.membership.reindexProjectSight("SRC-H");
  box.s.add("STD-H", { seenBy: [V("inner")] });
  return { w, s: box.s };
}
const open = (w, standard, by = "member:ann/tok1", viewer = V("ann")) => w.cr.recordsRequestOpen({ standard, by }, { viewer });

test("R51 a member opens a records request for a standard held cited: one row open, its citation and addressee copied from the standard, opened by the member; asked again while open it answers that row with already true and writes nothing", () => {
  const { w, s } = rrWorld();
  const a = open(w, "STD-1");
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.already, false);
  assert.match(a.request, /^RR-\d{14}-[0-9a-f]{12}$/);
  assert.deepEqual({ ...a, request: "x", opened_at: "t" }, {
    ok: true, already: false, request: "x", standard: "STD-1",
    citation: { cite: s.real("STD-1").cite, cited_by: s.real("STD-1").cited_by },
    addressee: s.real("STD-1").owner,
    opened_by: "member:ann", opened_at: "t", state: "open", answer: null, answer_capture: null, answer_note: null,
    answered_by: null, answered_at: null });
  const b = open(w, "STD-1", "member:bea");
  assert.deepEqual([b.ok, b.already, b.request], [true, true, a.request]);
  assert.equal(rrCount(w), 1);
  assert.equal(w.capture.calls.length, 0, "a records request fetches nothing");
  assert.equal(count(w), 0, "and is not a capture request");
});

test("R51 refusals in order, each writing nothing: a machine or empty by MACHINE_CANNOT_REQUEST_RECORDS; an absent or unseen standard answered as standards answers it (NO_SUCH_STANDARD, one answer); one not held cited RECORDS_REQUEST_NOT_CITED naming its held", () => {
  const { w, s } = rrWorld();
  for (const by of ["class:daemon", "class:ai", "admin", "", null, "token:daemon"])
    refusedBy(open(w, "STD-1", by), "MACHINE_CANNOT_REQUEST_RECORDS");
  /* a machine is refused first even for an absent standard */
  refusedBy(open(w, "STD-NONE", "class:probe"), "MACHINE_CANNOT_REQUEST_RECORDS");
  const absent = open(w, "STD-NONE");
  const unseen = open(w, "STD-H");
  assert.deepEqual(absent, s.standardRead({ id: "STD-NONE", viewer: V("ann") }));
  assert.deepEqual(unseen, s.standardRead({ id: "STD-H", viewer: V("ann") }), "an unseen standard answers exactly as an absent one");
  for (const [id, held] of [["STD-TEXT", "text"], ["STD-ABSENT", "absent"]]) {
    const r = open(w, id);
    refusedBy(r, "RECORDS_REQUEST_NOT_CITED");
    assert.equal(r.held, held);
  }
  assert.equal(rrCount(w), 0);
  /* a member who sees the source opens one */
  assert.equal(open(w, "STD-H", "member:inner", V("inner")).ok, true);
});

test("R52 the issuer's answer is recorded once by a member: produced names a held capture the viewer may see, none_exists, withheld with its ground, no_answer; the row moves to answered and nothing else changes", () => {
  const { w } = rrWorld();
  const doc = w.hold("https://police.example.gov/policy-7.pdf");
  const answers = [
    ["STD-1", { answer: "produced", capture: doc }],
    ["STD-2", { answer: "withheld", note: "  exempt as a law-enforcement record  " }],
  ];
  for (const [std, ans] of answers) {
    const id = open(w, std).request;
    const r = w.cr.recordsRequestAnswer({ request: id, by: "member:bea/tok9", ...ans }, { viewer: V("bea") });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual([r.state, r.answer, r.answered_by], ["answered", ans.answer, "member:bea"]);
    if (ans.answer === "produced") assert.deepEqual([r.answer_capture, r.answer_note], [doc, null]);
    else assert.deepEqual([r.answer_capture, r.answer_note], [null, "exempt as a law-enforcement record"]);
    assert.equal(r.citation.cite, `Policy ${std}`, "nothing else changes");
  }
  for (const answer of ["none_exists", "no_answer"]) {
    w.cr.recordsRequestAnswer({ request: open(w, "STD-1").request, by: "member:ann", answer }, { viewer: V("ann") });
  }
  assert.deepEqual(RECORDS_ANSWERS, ["produced", "none_exists", "withheld", "no_answer"]);
  assert.deepEqual(w.rows(`SELECT answer FROM records_requests ORDER BY answered_at, request`).map((r) => r.answer).sort(),
                   ["no_answer", "none_exists", "produced", "withheld"]);
  /* once answered, a new open for that standard opens a new request */
  assert.equal(open(w, "STD-1").already, false);
});

test("R52 refusals in order, each writing nothing: MACHINE_CANNOT_REQUEST_RECORDS; NO_SUCH_RECORDS_REQUEST for an absent id and one whose standard the viewer may not see alike; RECORDS_REQUEST_ANSWERED; RECORDS_ANSWER_UNKNOWN naming the four; RECORDS_ANSWER_NO_CAPTURE; RECORDS_ANSWER_NO_GROUND", () => {
  const { w } = rrWorld();
  const id = open(w, "STD-1").request;
  const hid = open(w, "STD-H", "member:inner", V("inner")).request;
  const ans = (a, viewer = V("ann")) => w.cr.recordsRequestAnswer({ by: "member:ann", ...a }, { viewer });
  const before = JSON.stringify(w.rows(`SELECT * FROM records_requests ORDER BY request`));
  refusedBy(ans({ request: id, answer: "no_answer", by: "class:daemon" }), "MACHINE_CANNOT_REQUEST_RECORDS");
  const absent = ans({ request: "RR-NONE", answer: "no_answer" });
  const unseen = ans({ request: hid, answer: "no_answer" });
  refusedBy(absent, "NO_SUCH_RECORDS_REQUEST");
  refusedBy(unseen, "NO_SUCH_RECORDS_REQUEST");
  assert.deepEqual({ ...absent, request: null }, { ...unseen, request: null }, "one answer");
  const unknown = ans({ request: id, answer: "lost" });
  refusedBy(unknown, "RECORDS_ANSWER_UNKNOWN");
  assert.match(unknown.detail, /produced, none_exists, withheld, no_answer/);
  refusedBy(ans({ request: id, answer: "produced" }), "RECORDS_ANSWER_NO_CAPTURE");
  refusedBy(ans({ request: id, answer: "produced", capture: sha("never held") }), "RECORDS_ANSWER_NO_CAPTURE");
  /* a held capture filed in a bundle the viewer may not see */
  const hiddenDoc = w.hold("https://police.example.gov/hidden.pdf", { bundle: "SRC-H" });
  refusedBy(ans({ request: id, answer: "produced", capture: hiddenDoc }), "RECORDS_ANSWER_NO_CAPTURE");
  refusedBy(ans({ request: id, answer: "withheld" }), "RECORDS_ANSWER_NO_GROUND");
  refusedBy(ans({ request: id, answer: "withheld", note: "   " }), "RECORDS_ANSWER_NO_GROUND");
  refusedBy(ans({ request: id, answer: "withheld", note: "x".repeat(1001) }), "RECORDS_ANSWER_NO_GROUND");
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM records_requests ORDER BY request`)), before, "nothing written");
  assert.equal(ans({ request: id, answer: "withheld", note: "x".repeat(1000) }).ok, true);
  const again = ans({ request: id, answer: "no_answer" });
  refusedBy(again, "RECORDS_REQUEST_ANSWERED");
  assert.equal(w.row(`SELECT answer FROM records_requests WHERE request=?`, id).answer, "withheld", "never replaced");
});

test("R53 the reads answer the rows whose standard the viewer may read, each with every Terms field, filtered by standard and state; an unseen row is absent and counted nowhere; recordsRequestById answers null for a blank, unknown or unseen id alike; bounded with truncated and next", () => {
  const { w, s } = rrWorld();
  const one = open(w, "STD-1").request;
  const two = open(w, "STD-2").request;
  const hid = open(w, "STD-H", "member:inner", V("inner")).request;
  w.cr.recordsRequestAnswer({ request: two, by: "member:ann", answer: "none_exists" }, { viewer: V("ann") });
  const all = w.cr.recordsRequests({ viewer: V("ann") });
  assert.deepEqual(all.requests.map((r) => r.request).sort(), [one, two].sort());
  assert.deepEqual([all.count, all.truncated, all.next, all.limit], [2, false, null, 200]);
  assert.deepEqual(Object.keys(all.requests[0]).sort(), ["addressee", "answer", "answer_capture", "answer_note",
    "answered_at", "answered_by", "citation", "opened_at", "opened_by", "request", "standard", "state"]);
  assert.deepEqual(w.cr.recordsRequests({ viewer: V("ann"), state: "answered" }).requests.map((r) => r.request), [two]);
  assert.deepEqual(w.cr.recordsRequests({ viewer: V("ann"), standard: "STD-1" }).requests.map((r) => r.request), [one]);
  assert.deepEqual(w.cr.recordsRequests({ viewer: V("ann"), standard: "STD-H" }).requests, []);
  assert.equal(w.cr.recordsRequests({ viewer: V("inner") }).count, 3);
  assert.equal(w.cr.recordsRequests({ viewer: "nobody" }).count, 0);
  for (const request of ["", null, "RR-NONE", hid]) assert.equal(w.cr.recordsRequestById({ request, viewer: V("ann") }), null);
  assert.equal(w.cr.recordsRequestById({ request: hid, viewer: V("inner") }).standard, "STD-H");
  assert.equal(w.cr.recordsRequestById({ request: one, viewer: V("ann") }).state, "open");
  /* the bound and the cursor: an unseen row between pages is skipped and never counted */
  for (let i = 0; i < 5; i++) {
    s.add(`STD-P${i}`, { cite: `P${i}` });
    open(w, `STD-P${i}`);
  }
  const page1 = w.cr.recordsRequests({ viewer: V("ann"), limit: 3 });
  assert.deepEqual([page1.count, page1.truncated, page1.limit], [3, true, 3]);
  const page2 = w.cr.recordsRequests({ viewer: V("ann"), limit: 3, after: page1.next });
  const page3 = w.cr.recordsRequests({ viewer: V("ann"), limit: 3, after: page2.next });
  const seen = [...page1.requests, ...page2.requests, ...page3.requests].map((r) => r.request);
  assert.equal(seen.length, 7);
  assert.equal(seen.includes(hid), false);
  assert.equal(page3.truncated, false);
  assert.equal(w.cr.recordsRequests({ viewer: V("ann"), limit: 5000 }).limit, 1000);
  assert.equal(w.cr.recordsRequests({ viewer: V("ann"), limit: 0 }).limit, 200);
});

test("R53 R51 R52 the ops: recordsrequestopen and recordsrequestanswer take `by` from the control plane's principal stamp and the viewer from its viewer stamp, never the body; recordsrequests reads the query string", () => {
  const { w } = rrWorld();
  const url = (op) => new URL(`http://x/${op}?viewer=member%3Aann&principal=member%3Aann%2Ftok1&standard=STD-1`);
  const o = captureRequestsOps(w.cr, url("recordsrequestopen"), { standard: "STD-1", by: "member:eve" }).recordsrequestopen();
  assert.deepEqual([o.ok, o.opened_by], [true, "member:ann"]);
  const machine = captureRequestsOps(w.cr, new URL("http://x/recordsrequestopen?viewer=member%3Aann&principal=class%3Adaemon"),
    { standard: "STD-2", by: "member:ann" }).recordsrequestopen();
  refusedBy(machine, "MACHINE_CANNOT_REQUEST_RECORDS");
  const a = captureRequestsOps(w.cr, url("recordsrequestanswer"), { request: o.request, answer: "no_answer", by: "member:eve" })
    .recordsrequestanswer();
  assert.deepEqual([a.ok, a.answered_by], [true, "member:ann"]);
  const r = captureRequestsOps(w.cr, url("recordsrequests"), {}).recordsrequests();
  assert.deepEqual(r.requests.map((x) => x.request), [o.request]);
});

test("R53 the table is declared with the sight of the standard it names, exported, and purged with that standard, never as scratch", () => {
  const { w } = rrWorld();
  w.bundle("STD-1", "standard");
  w.bundle("STD-2", "standard");
  open(w, "STD-1"); open(w, "STD-2");
  const decl = w.record.declaredTables().find((d) => d.name === "records_requests");
  assert.deepEqual([decl.module, decl.keys, decl.export, decl.sight, decl.purge], ["capture-requests", ["standard"], "yes", "bundle", "clear"]);
  w.record.purge({ bundleId: "STD-1" });
  assert.deepEqual(w.rows(`SELECT standard FROM records_requests`).map((r) => r.standard), ["STD-2"]);
});

/* ===================================================================== *
 * R54 — DEC-149: THE EIGHT STRINGS
 * ===================================================================== */

test("R54 DEC-149's eight rows: each member-facing string says your group's Civicsmith, never this instance or this plane — :255 the unreadable host, :390 the door's detail, :712 the purpose, :757 the host in cool-off, :779 no scope check, :864 the fetch that did not complete, :933 the promotion that did not complete, :1316 an unknown sweep", async () => {
  const CS = /[Yy]our team's Civicsmith/;
  const NOT = /this instance|this plane|\bthe plane\b|\bthe instance\b/;
  const said = (s, row) => { assert.match(s, CS, row); assert.doesNotMatch(s, NOT, row); };
  const w = world().scene();
  /* :255 */
  said(askUnheld(w, { address: "https://a b.example.org/x" }).detail, ":255");
  /* :390 */
  said(w.ask({ address: "https://s.example.org/door" }).detail, ":390");
  /* :712 */
  const bad = w.ask({ address: "https://s.example.org/purpose", purpose: "browse" }).request;
  await w.cr.drain({}); w.tick();
  said(w.req(bad).detail, ":712");
  /* :757 */
  const cool = w.ask({ address: "https://cool.example.org/x" }).request;
  w.governor.isHeld = () => true;
  await w.cr.drain({}); w.tick();
  said(w.req(cool).detail, ":757");
  assert.match(w.req(cool).detail, /a stranger's server/, "a website's server keeps its word");
  delete w.governor.isHeld;
  /* :779 */
  const sw = w.ask({ address: "https://s.example.org/sweep", sweep: "INQ-1#agendas" }).request;
  await w.cr.drain({}); w.tick();
  said(w.req(sw).detail, ":779");
  /* :864 */
  const thrown = w.ask({ address: "https://s.example.org/throws" }).request;
  w.capture.throwNext();
  await w.cr.drain({}); w.tick();
  said(w.req(thrown).detail, ":864");
  assert.equal(w.req(thrown).detail.includes("SECRET"), false);
  /* :933 */
  const prom = w.ask({ address: "https://promote.example.org/doc" }).request;
  const real = w.promotion.promote;
  w.promotion.promote = () => { throw new Error("no"); };
  const d = await w.cr.drain({}); w.tick();
  w.promotion.promote = real;
  said(d.captured.find((c) => c.request === prom).promoted.detail, ":933");
  /* :1316 */
  const w2 = world().scene();
  w2.cr.registerSweepScope("link-sweep", () => ({ ok: false, reason: "unknown" }));
  const unk = w2.ask({ address: "https://s.example.org/unknown", sweep: "INQ-1#gone" }).request;
  await w2.cr.drain({});
  said(w2.req(unk).detail, ":1316");
  assert.ok(w2.req(unk).detail.includes(localize("capture-requests.index.is_not_a_sweep_your_team", "is not a sweep your team's Civicsmith holds")));
});

test("R54 R34 the new rows' translations and R49–R53's details say no copy, instance, plane or server for the group's Civicsmith", () => {
  for (const code of ["CAPTURE_REQUEST_ADDRESS_TOO_LONG", "CAPTURE_REQUEST_ADDRESS_NOT_HELD", "CAPTURE_REQUEST_CO_ARCHIVE_NOT_A_MEMBERS",
                      "CAPTURE_REQUEST_CO_ARCHIVE_MALFORMED", "MACHINE_CANNOT_REQUEST_RECORDS", "RECORDS_REQUEST_NOT_CITED",
                      "RECORDS_ANSWER_NO_CAPTURE", "RECORDS_ANSWER_NO_GROUND", "NO_SUCH_RECORDS_REQUEST",
                      "RECORDS_REQUEST_ANSWERED", "RECORDS_ANSWER_UNKNOWN"])
    assert.doesNotMatch(CAPTURE_REQUEST_CHECKS[code].translation, /\b(instance|plane|server)\b|this copy/, code);
  const { w } = rrWorld();
  const details = [askUnheld(w, { address: "https://x.example.org/" }).detail,
                   askUnheld(w, { address: "https://x.example.org/?" + "a".repeat(2100) }).detail,
                   w.ask({ co_archive: "x" }).detail, open(w, "STD-TEXT").detail, open(w, "STD-1", "class:ai").detail];
  for (const d of details) assert.doesNotMatch(d, /\b(instance|plane|server)\b|this copy/, d);
});
