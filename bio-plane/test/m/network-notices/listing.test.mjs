/* network-notices T53 (N1110, K5507, K5527, K5530 B2, K5532): a group's request to be listed on civicsmith.org (R32),
   the submission of a published case to the network pages, which is not a listing (R23), and the module's one outbound
   destination (R30). Driven at the interface over the real modules (`fixture.mjs`); member-roster's description is set
   by its own act, `groupDescriptionSet`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seeded, V, NOW } from "./fixture.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const A = V("alice");
const ERIN = V("erin");
const SENTINEL = "sentinel-erin@account.example";

/* alice, bob, carol and dave as `seeded`; erin an administrator whose account fields carry a sentinel address */
function admins() {
  const w = seeded();
  w.member("erin", { role: "admin" });
  w.st.sql.exec(`UPDATE members SET cover=?, handle=? WHERE member_id='erin'`, `Erin ${SENTINEL}`, SENTINEL);
  return w;
}
const describe = (w, visibility, focus = "Where the transport budget goes") =>
  w.membership.groupDescriptionSet({ kinds: [], focus, purpose: "Watching spending", visibility, by: "erin" });
/* every row of every table, for "nothing is recorded" */
const allRows = (w) => Object.fromEntries(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map(({ name }) => [name, JSON.stringify(w.rows(`SELECT * FROM "${name}"`))]));
/* no fetch of any kind while `fn` runs; answers what it returned and the addresses asked */
async function offline(w, fn) {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (u) => { asked.push(String(u)); throw new Error("no network in this test"); };
  try { return { r: await fn(), asked: [...asked, ...w.tsa.calls.map((c) => c.url)] }; } finally { globalThis.fetch = real; }
}

test("R32 listingRequest prefills a public group's request for an administrator: name, focus, cases as the site's row shows them, an empty contact, and the contact note's words", async () => {
  const w = admins();
  assert.equal(describe(w, "public").ok, true);
  w.publish(w.P, "CASE-2026-0001-budget", 1, []);
  w.clock.now = NOW + 3 * 86400000;
  w.publish(w.P, "CASE-2026-0001-budget", 2, []);
  w.publish(w.Q, "CASE-2026-0002-harbour", 1, []);
  const before = allRows(w);
  const { r, asked } = await offline(w, () => w.nn.listingRequest({ viewer: ERIN, name: "Harbour Watch" }));
  assert.deepEqual(Object.keys(r).sort(), ["cases", "contact", "focus", "listed", "name", "note", "ok", "sends", "warning"]);
  assert.equal(r.ok, true);
  assert.equal(r.listed, true);
  assert.equal(r.name, "Harbour Watch", "the display name the layer-11 door hands in");
  assert.equal(r.focus, "Where the transport budget goes");
  assert.deepEqual(r.cases, { cases: 2, editions: 3, latest: "2026-10-04" }, "two cases in three editions, the latest dated");
  assert.equal(r.contact, "", "contact is present and empty");
  assert.ok(!("place" in r), "no field of the description holds a place");
  assert.equal(r.warning.code, "outward_act");
  assert.match(r.warning.meaning, /see/);
  /* the prefilled request's words, read by key: the stewards' own mail, optional, never on the site */
  assert.ok(hasWord("listing.contact.note"));
  assert.equal(r.note, word("listing.contact.note"));
  for (const said of [/stewards' own mail/, /optional/i, /never on the site/]) assert.match(r.note, said);
  assert.ok(!JSON.stringify(r).includes(SENTINEL) && !JSON.stringify(r).includes("sentinel-erin"), "nothing of a member's account");
  assert.deepEqual(asked, [], "no network call");
  assert.deepEqual(allRows(w), before, "nothing recorded");
  /* without the name handed in by the layer-11 door, the answer carries no name */
  const noName = w.nn.listingRequest({ viewer: ERIN });
  assert.ok(!("name" in noName));
  /* one edition of each case: no later edition, so no latest date */
  const once = admins();
  describe(once, "public");
  once.publish(once.P, "CASE-2026-0001-budget", 1, []);
  assert.deepEqual(once.nn.listingRequest({ viewer: ERIN }).cases, { cases: 1, editions: 1, latest: null });
});

test("R32 a group that keeps itself to its members answers {listed: false} and no field, contact included; a non-administrator is refused", async () => {
  const w = admins();
  describe(w, "members");
  w.publish(w.P, "CASE-2026-0001-budget", 1, []);
  const before = allRows(w);
  const { r, asked } = await offline(w, () => w.nn.listingRequest({ viewer: ERIN, name: "Harbour Watch" }));
  assert.deepEqual(r, { ok: true, listed: false });
  assert.deepEqual(asked, []);
  assert.deepEqual(allRows(w), before);
  /* no description at all is members-only too */
  assert.deepEqual(admins().nn.listingRequest({ viewer: ERIN }), { ok: true, listed: false });
  /* a member who is not an administrator, a machine, and no viewer: refused, with no field of the request */
  const pub = admins();
  describe(pub, "public");
  for (const who of [A, "class:ai", null]) {
    const x = pub.nn.listingRequest({ viewer: who, name: "Harbour Watch" });
    assert.equal(x.reason, "NOT_AN_ADMIN", String(who));
    for (const k of ["listed", "focus", "cases", "contact", "name"]) assert.ok(!(k in x), `${who}: ${k}`);
  }
  /* negative control: the same group, asked by its administrator, is listed */
  assert.equal(pub.nn.listingRequest({ viewer: ERIN }).listed, true);
});

test("R23 directorySubmission answers a submission to the network pages: exactly its eight keys, no listing, no domain, no call; Purpose and R30 name no directory", async () => {
  const w = admins();
  describe(w, "public");
  w.publish(w.P, "CASE-2026-0001-budget", 1, []);
  w.st.sql.exec(`INSERT INTO case_documents (case_id, edition, doc_sha, text, authored_at, sig_armored) VALUES (?, 1, 'd', ?, 't', 'sig')`,
                "CASE-2026-0001-budget", "---\ntitle: \"Where the fund went\"\n---\n\n# Where the fund went\n");
  const { r, asked } = await offline(w, () => w.nn.directorySubmission({ case: "CASE-2026-0001-budget", viewer: A }));
  assert.deepEqual(Object.keys(r).sort(), ["case", "edition", "group", "link", "ok", "sends", "summary", "title"]);
  for (const k of ["listed", "request", "contact"]) assert.ok(!(k in r), k);
  assert.deepEqual(asked, []);
  /* no domain: the link is relative, and no string of the answer holds a host name */
  assert.ok(r.link.startsWith("?op=publishedcase&"));
  for (const v of Object.values(r)) if (typeof v === "string") assert.doesNotMatch(v, /[a-z0-9-]+\.(?:org|com|net|example|dev)\b|https?:/i, v);
  /* a case with no published edition */
  assert.equal(w.nn.directorySubmission({ case: "CASE-2026-0009-none", viewer: A }).reason, "NO_PUBLISHED_EDITION");
  /* the requirements text of Purpose and R30 names no directory: the network pages read what this module publishes */
  const text = readFileSync(new URL("../../../../build/requirements/network-notices.md", import.meta.url), "utf8");
  const purpose = /### Purpose\n([\s\S]*?)\n### /.exec(text)[1];
  const r30 = /\*\*R30\*\*[^\n]*/.exec(text)[0];
  assert.ok(purpose.length > 100 && r30.length > 40);
  for (const part of [purpose, r30]) assert.doesNotMatch(part, /director/i);
  assert.match(purpose, /network pages read what it publishes/);
  assert.match(r30, /network page or list/);
  /* control: the listing request is a different answer, with the fields this one never carries */
  assert.ok("contact" in w.nn.listingRequest({ viewer: ERIN }));
});

test("R30 R32 neither the listing request nor the network-pages submission makes an outbound call or pushes to any page or list", async () => {
  const w = admins();
  describe(w, "public");
  w.publish(w.P, "CASE-2026-0001-budget", 1, []);
  const before = allRows(w);
  const { asked } = await offline(w, () => {
    w.nn.listingRequest({ viewer: ERIN, name: "Harbour Watch" });
    w.nn.listingRequest({ viewer: A });
    w.nn.directorySubmission({ case: "CASE-2026-0001-budget", viewer: A });
  });
  assert.deepEqual(asked, [], "no fetch, and no timestamp request either");
  assert.deepEqual(allRows(w), before, "nothing queued to send");
});
