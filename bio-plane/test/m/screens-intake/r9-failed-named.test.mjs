/* screens-intake fix round 9 (SCREENS-INTAKE #23): N1 (BOB #273, K4853; diagnosis-R9-rewalk8-A section 4) and P25 (BOB #274, K4855; diagnosis-R9-perf-P24-P25 item 2). R58, R49.
 * N1: an owed fetch refused for good is listed by acquisition (the REAL `openCaptures` over a store holding the session, as `r8-failed-listing.test.mjs`) and the Add
 * screen draws it with no press: the failed line names its document by its address, as the unfinished line does, so it is not a sentence beside unrelated presses that
 * names nothing; it is listed for a day (K4855). P25: a large file the team already holds, captured again, is said as R49 says an existing document ("already in the
 * record", with its title and link), when the copy the record shows was captured before the fetch began; a copy the fetch delivered is the finished line, as before.
 * Every test enters by pressing the act or opening the screen; a sentence is asserted by its key (R26).
 * Over the REAL store (fix round 10, K5054) except what the world cannot make: a parked fetch that the alarm delivered (or refused). The store-assembly world assembles the
 * store with no `deliver` (control-plane's owed delivery, assemble.mjs:188), so a parked fetch stays owed for ever: the listing of a failed session stays the real
 * `openCaptures` output over a store holding one (as before), the press that parks a large file a held answer, and, for P25, the listing's flip to "delivered" and the copy
 * the record then shows are the test's script. Everything else (`projectlist`, `heldcaptures`, `acquire` of a small page, `allocid`, `promote`, the empty listing) is the owners' own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, main, text, fill, press, idle, ok, says, DOCUMENT_STUB } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { openCaptures } from "../../../src/acquisition/index.mjs";

const iso = (ms) => new Date(ms).toISOString().split(".")[0] + "Z";
const ADDRESS = "https://www.govinfo.gov/content/pkg/BUDGET-2021-APP/pdf/BUDGET-2021-APP.pdf";
const OTHER = "https://www.example.gov/other/page.html";
const SESSION = "rs_n1";
const sessionStore = (startedMs, failed = "CAPTURE_HELD_BY_ANOTHER_BUNDLE") => ({ liveCaptureSessions: () => [{ session: SESSION, locator: ADDRESS, created: iso(startedMs), updated: iso(Date.now()), expires: iso(Date.now() + 29 * 86400000), primarySha: null,
  state: { opened_by: "mai", queue: [], fetch_done: { since: iso(startedMs) }, fetch_pending: { since: iso(startedMs), declared_bytes: 17400000, why: "over_wait", failed } } }] });
const listingAt = (startedMs, failed) => openCaptures(sessionStore(startedMs, failed), { by: "member:mai", now: iso(Date.now()) });
/* the world each page is opened over: mai, who captures; rosa, who has no capture (her listing is the owner's empty one) */
let team = null;
const open = async (path, plane = {}, serve = null) => {
  team = await members({ mai: ["contribute"], rosa: [] });
  if (serve) team.world.script(serve.address, async () => new Response(serve.body, { status: 200, headers: { "content-type": "text/html" } }));
  return openWorld(path, { world: team.world, as: team.mai, plane, screens: [...SCREENS, DOCUMENT_STUB] });
};
const failedLines = (p) => main(p).querySelectorAll("[data-fetch-failed]");

test("R58 (N1) the real listing's failed fetch is drawn with no press, in the refusal's words and naming its document by its address", async () => {
  const listing = listingAt(Date.now() - 3600000);
  assert.equal(listing.captures[0].locator, ADDRESS, "the listing carries the address");
  const p = await open("/app/capture/address", { opencaptures: ok(listing) });
  const lines = failedLines(p);
  assert.equal(lines.length, 1);
  assert.ok(says(p, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"), "the refusal's sentence");
  assert.ok(lines[0].textContent.includes(ADDRESS), "red before: neither the address nor any title appeared, the sentence named no document");
  assert.equal(Array.from(main(p).querySelectorAll('button[data-act="acquire"]')).filter((b) => b.getAttribute("data-session")).length, 0, "no Finish it");
});

test("R58 (N1) beside an unrelated press the failed line still names its own document, not the press's", async () => {
  const listing = listingAt(Date.now() - 3600000);
  const p = await open("/app/capture/address", { opencaptures: ok(listing) },
    { address: OTHER, body: "<html><head><title>An unrelated page</title></head><body><p>Unrelated.</p></body></html>" });
  fill(p, { "ci-address": OTHER });
  await press(p, "acquire");
  await idle(p);
  assert.equal(failedLines(p).length, 1, "still listed");
  assert.ok(failedLines(p)[0].textContent.includes(ADDRESS), "and it names the document that failed");
  assert.ok(!failedLines(p)[0].textContent.includes(OTHER), "not the one just pressed");
});

test("R58 (N1) the failed line is listed for a day from the fetch and not after it; the listing of a day-old failure draws no line", async () => {
  const fresh = await open("/app/capture/address", { opencaptures: ok(listingAt(Date.now() - 23 * 3600000)) });
  assert.equal(failedLines(fresh).length, 1, "control: 23 hours after the fetch, still listed");
  const old = await open("/app/capture/address", { opencaptures: ok(listingAt(Date.now() - 26 * 3600000)) });
  assert.equal(failedLines(old).length, 0, "26 hours after: not drawn");
  assert.ok(!says(old, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"));
  const stated = listingAt(Date.now() - 26 * 3600000);
  stated.captures[0].fetch_pending.failed_at = iso(Date.now() - 3600000);
  const named = await open("/app/capture/address", { opencaptures: ok(stated) });
  assert.equal(failedLines(named).length, 1, "a failure instant the listing states governs: an hour ago");
});

/* ---- P25 ---- */

const SHA = "d".repeat(64), HOME = "INFO-2026-0140-budget", BYTES = 17400000;
const since = Date.now() - 600000;
const copyAt = (retrieved) => ({ ok: true, held: true, copy: { sha256: SHA, document: HOME, project: null, title: "FY 2021 budget appendix", retrieved, actor: "member:mai", address: ADDRESS }, versions: 1, truncated: false, changed: { state: "unchanged" } });
const PENDING = ok({ ok: true, fetch_pending: { session: SESSION, since: iso(since), declared_bytes: BYTES, why: "LARGE_DECLARED" } });
const STILL = ok({ ok: true, truncated: false, captures: [{ session: SESSION, locator: ADDRESS, started: iso(since), outstanding: 0, fetch_pending: { since: iso(since), declared_bytes: BYTES } }] });
async function pressed(copy) {
  const state = { listed: true };
  const p = await open("/app/capture/address", { acquire: PENDING, opencaptures: async () => (state.listed ? STILL : ok(await team.rosa.read("opencaptures"))),
    heldat: async (r) => (r.query.check || state.listed ? ok(await team.mai.read("heldat", { query: r.query })) : ok(copy)) });
  fill(p, { "ci-address": ADDRESS });
  await press(p, "acquire");
  state.listed = false;
  await p.clock.tick(4000);
  await idle(p);
  return p;
}

test("R49 (P25) a large file the team already holds, captured again, ends in 'already in the record' with its title and a link, not as a capture this press made", async () => {
  const p = await pressed(copyAt(iso(since - 86400000)));
  assert.ok(says(p, "screen.capture.address.existed", { title: "FY 2021 budget appendix" }), "the existing document, by title");
  assert.ok(main(p).querySelector(`a[href*="${HOME}"]`), "linked");
  assert.equal(main(p).querySelector("[data-fetched]"), null, "red before: the generic finished line, as if this press had made it");
  assert.equal(failedLines(p).length, 0);
});

test("R49 (P25) control: a copy the fetch delivered (captured after it began) is the finished line, as before", async () => {
  const p = await pressed(copyAt(iso(since + 30000)));
  assert.ok(main(p).querySelector("[data-fetched]"), "the finished line");
  assert.ok(!says(p, "screen.capture.address.existed", { title: "FY 2021 budget appendix" }));
  assert.ok(main(p).querySelector(`a[href*="${HOME}"]`));
  assert.ok(text(p).length > 0);
});
