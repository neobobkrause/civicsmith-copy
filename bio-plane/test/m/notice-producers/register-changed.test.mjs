/* R30, R32 (T53; N1259; K4403 (7), K1484, K1489): a register watch's change told once, with its count, built from counts and the
   register's name only. Over the real `following` (its R43 `registerChanges`), on following's own test world (its fixture) with the
   real `registers`, the docket pages the court reader reads (`court-doctypes`' fixture) as the register's answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { world, testView, MEMBER, OUTSIDER, T0, DAY } from "../following/fixture.mjs";
import { fresh, reader, ofKind } from "./fixture.mjs";
import { NOTICE_KINDS, REGISTER_CHANGES_MAX, REGISTER_CHANGE_DAYS } from "../../../src/notice-producers/index.mjs";

const KIND = "register-changed-noticed";
const DOCKET = (v) => `https://board.marlow-county.example/proceeding/${v}/documents`;
const FILER = (v) => `https://data.marlow-county.example/filer/${v}`;
function regView() {
  const v = testView();
  v.query_templates = [
    { scheme: "filer", register: "town_filings", template: FILER("{value}"), basis: "TEST" },
    { scheme: "docket", register: "county_raw", template: DOCKET("{value}"), basis: "TEST" },
    ...v.query_templates.filter((t) => t.scheme === "company")];
  return v;
}
const DOCS = readFileSync(new URL("../../../../court-doctypes/test/fixtures/cpuc-A2106021-documents-p1.html", import.meta.url), "utf8");
const ROWS = DOCS.match(/<tr >[\s\S]*?<\/tr>/g);
const LESS = DOCS.replace(ROWS[ROWS.length - 1], "");
const FEWER = LESS.replace(ROWS[ROWS.length - 2], "");
const PRJ = "PRJ-2026-0001-a", HOME = "INFO-2026-0002-a";

function setup() {
  const w = world({ view: regView() });
  w.project(PRJ);
  w.bundle(HOME, { project: PRJ });
  w.st.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const f = w.f.followRegisterQuery({ register: "county_raw", scheme: "docket", value: "D123456", home: HOME, author: MEMBER, viewer: MEMBER });
  assert.equal(f.ok, true, JSON.stringify(f));
  return { w, watch: f.follow };
}

const NOW = T0 + 2 * DAY + 1000;
/* the real following's `registerChanges`, each entry with the watch's author, which R30 sends it to and following R43 does not yet
   answer (reported to BOB): the one field added, every other the real provider's own */
const withAuthor = (w) => ({
  registerChanges: (a) => {
    const r = w.f.registerChanges(a);
    // fixtures-contract: following register-changes
    return { ...r, changes: r.changes.map((c) => ({ ...c, author: w.one(`SELECT author FROM follows WHERE follow_id=?`, c.watch).author })) };
  },
  policyChanges: (a) => w.f.policyChanges(a), dutyWatchEndAt: (d) => w.f.dutyWatchEndAt(d), watchedBy: (i) => w.f.watchedBy(i) });
const told = (w, extra = {}, now = NOW) => {
  const { read } = reader(fresh(w.host, { membership: w.membership, following: withAuthor(w), ...extra }));
  const by = {};
  for (const m of ["alice", "root", "outsider"]) by[m] = read(m, { now });
  return by;
};
const all = (by) => [...new Map(Object.values(by).flatMap((r) => ofKind(r, KIND)).map((i) => [i.id, i])).values()];
/* the docket's own rows' text: a cell of the row the change added (R32's sentinel: it must reach no item) */
const ADDED_CELLS = (ROWS[ROWS.length - 1].match(/>([^<>]{6,})</g) || []).map((x) => x.slice(1, -1).trim()).filter((x) => x.length >= 6);

test("R30 a docket change over the real following is one register-changed-noticed FINDING keyed <watch>::<change>, with its count; read again it is the same key; a second change is a second item with its own count", async () => {
  const { w, watch } = setup();
  assert.equal(NOTICE_KINDS[KIND], "FINDING");
  w.serve(DOCKET("D123456"), LESS); await w.f.followTick(T0);
  assert.deepEqual(all(told(w)), [], "control: no change, no item");
  w.serve(DOCKET("D123456"), DOCS); await w.f.followTick(T0 + DAY);
  const first = all(told(w));
  assert.equal(first.length, 1);
  const [ch] = w.f.registerChanges({ viewer: MEMBER }).changes;
  assert.equal(first[0].id, `FINDING::${KIND}::${watch}::${ch.at}`);
  assert.equal(first[0].class, "FINDING");
  assert.equal(first[0].label, "noticed");
  assert.deepEqual([first[0].fills.register, first[0].fills.count, first[0].fills.added, first[0].fills.changed, first[0].fills.removed], ["county_raw", "1", "1", "0", "0"]);
  assert.match(first[0].fills.date, /October/);
  assert.deepEqual(all(told(w)).map((i) => i.id), [first[0].id], "the same change read again is the same key");
  w.serve(DOCKET("D123456"), FEWER); await w.f.followTick(T0 + 2 * DAY);
  const two = all(told(w));
  assert.equal(two.length, 2, "control: a second change makes a second item");
  const second = two.find((i) => i.id !== first[0].id);
  assert.equal(second.fills.count, String(w.f.registerChanges({ viewer: MEMBER }).changes[1].total));
});

test("R30 R32 no item holds a cell, name or value of the register's rows; the register's own label appears; it says nothing of what a change means", async () => {
  const { w } = setup();
  w.serve(DOCKET("D123456"), LESS); await w.f.followTick(T0);
  w.serve(DOCKET("D123456"), DOCS); await w.f.followTick(T0 + DAY);
  const items = all(told(w));
  assert.equal(items.length, 1);
  assert.ok(ADDED_CELLS.length > 0, "the sentinel cells are read from the row added");
  const text = JSON.stringify(items);
  for (const cell of ADDED_CELLS) assert.equal(text.includes(cell), false, cell);
  assert.doesNotMatch(text, /D123456/, "not even the watched number");
  assert.ok(items[0].summary.includes("county_raw") && items[0].detail.includes("county_raw"), "control: the register's own label appears");
  assert.doesNotMatch(items[0].detail, /violat|conflict|suspici/i);
});

test("R30 a watch ended before the change makes none; a hidden project's change reaches nobody outside it", async () => {
  const { w, watch } = setup();
  w.serve(DOCKET("D123456"), LESS); await w.f.followTick(T0);
  w.f.registerWatchStop({ follow: watch, author: MEMBER, viewer: MEMBER });
  w.serve(DOCKET("D123456"), DOCS); await w.f.followTick(T0 + DAY);
  assert.deepEqual(all(told(w)), []);
  assert.deepEqual(ofKind(told(w).outsider, KIND), [], "an outsider is never told");
});

test("R30 R1 the read is from 90 days back, in pages following cursor to at most 1,000 entries, the bound and truncated stated; a read that throws or answers undetermined is named following in facts.failed", () => {
  const { w } = setup();
  const asked = [];
  const entries = Array.from({ length: 1001 }, (_, n) => ({ watch: 1, kind: "register-query", register: "county_raw", at: new Date(T0 + n * 1000).toISOString().replace(".000", ""),
    counts: { added: 1, changed: 0, removed: 0, possibly_removed: 0 }, total: 1, author: MEMBER }));
  // fixtures-contract: following register-changes
  const registerChanges = ({ after, since, limit }) => { asked.push({ after, since, limit }); const start = after === null ? 0 : Number(after); const page = entries.slice(start, start + limit);
    return { ok: true, changes: page, cursor: start + limit < entries.length ? String(start + limit) : null }; };
  const r = told(w, { following: { ...w.f, registerChanges, policyChanges: () => ({ ok: true, changes: [], cursor: null }), dutyWatchEndAt: () => null } }).alice;
  assert.equal(r.facts.register_changed.bound, REGISTER_CHANGES_MAX);
  assert.equal(r.facts.register_changed.days, REGISTER_CHANGE_DAYS);
  assert.equal(r.facts.register_changed.truncated, true);
  assert.ok(asked.every((a) => a.limit <= 200), "pages of at most 200");
  assert.equal(asked[0].since, new Date(NOW - REGISTER_CHANGE_DAYS * DAY).toISOString().replace(/\.\d{3}Z$/, "Z"));
  assert.equal(ofKind(r, KIND).length, REGISTER_CHANGES_MAX);
  for (const bad of [() => { throw new Error("x"); }, () => ({ ok: true, undetermined: true, changes: [] }), () => ({ ok: false })]) {
    const x = told(w, { following: { registerChanges: bad, policyChanges: () => ({ ok: true, changes: [], cursor: null }), dutyWatchEndAt: () => null } }).alice;
    assert.deepEqual(ofKind(x, KIND), []);
    assert.ok(x.facts.failed.includes("following"), JSON.stringify(x.facts.failed));
  }
});

test("R30 the change goes to the watch's author while active and while she may see the project, else the project's active owners, else the administrators, and to nobody else", () => {
  const { w } = setup();
  const entry = (x) => ({ watch: 7, kind: "register-query", register: "county_raw", project: PRJ, at: "2026-10-07T12:00:00Z",
    counts: { added: 2, changed: 1, removed: 0, possibly_removed: 0 }, total: 3, ...x });
  const via = (e) => {
    // fixtures-contract: following register-changes
    const fol = { registerChanges: () => ({ ok: true, changes: [e], cursor: null }), policyChanges: () => ({ ok: true, changes: [], cursor: null }), dutyWatchEndAt: () => null };
    const by = told(w, { following: fol });
    return Object.entries(by).filter(([, r]) => ofKind(r, KIND).length).map(([m]) => m);
  };
  assert.deepEqual(via(entry({ author: MEMBER })), ["alice"], "the author alone");
  assert.deepEqual(via(entry({ author: OUTSIDER })), ["alice"], "an author who may not see the project: its owners");
  assert.deepEqual(via(entry({ author: OUTSIDER, project: undefined })), ["outsider"], "a team watch: its author, who sees no project");
  assert.deepEqual(via(entry({ author: null })), ["alice"], "no author: the project's owners");
  assert.deepEqual(via(entry({ author: "class:daemon", project: undefined })), ["root"], "no member author and no project: the administrators");
  const [item] = ofKind(told(w, { following: { registerChanges: () => ({ ok: true, changes: [entry({ author: MEMBER })], cursor: null }), policyChanges: () => ({ ok: true, changes: [], cursor: null }), dutyWatchEndAt: () => null } }).alice, KIND);
  assert.deepEqual([item.fills.count, item.fills.added, item.fills.changed, item.fills.removed], ["3", "2", "1", "0"]);
  assert.equal(item.id, `FINDING::${KIND}::7::2026-10-07T12:00:00Z`);
});

test.todo("R30 over the real following, the change goes to the watch's author: following R43's entry answers no author (and no project for a number's watch), so today a project watch reaches nobody: its participants are not its known author, and an administrator outside a hidden project does not see it (reported to BOB)");
