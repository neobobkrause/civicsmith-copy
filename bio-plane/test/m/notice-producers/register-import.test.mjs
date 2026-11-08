/* R31, R32 (T53; N1259; K4403 (2), K1484): an import into a register that finished, stopped or failed, told once to the member who
   began it, built from counts and the register's name only. The feed is `registers`' `importsEnded` (its R13), handed in by the
   composition root as `deps.importsEnded` (as `readingsEnded` is, R29), so this module imports nothing of `registers`. Its rows below
   are the contract, stated as data in the shape `registers/runner.mjs`' `importsEnded` answers (`{import, register, scope, project?,
   state, reason?, finished_at, rows_out}`), with the two fields R31 reads that it does not yet answer, `author` (the table's own
   column) and `bytes` (reported to BOB). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "../file-safety/fixture.mjs";
import { fresh, reader, ofKind } from "./fixture.mjs";
import { NOTICE_KINDS, REGISTER_IMPORTS_MAX, REGISTER_IMPORT_DAYS } from "../../../src/notice-producers/index.mjs";

const NOW = Date.parse("2026-10-25T00:00:00Z");
const AT = new Date(NOW - 3600e3).toISOString().replace(".000", "");
const KINDS = ["register-import-done", "register-import-stopped", "register-import-failed"];
const SENTINEL = ["Jane Sentinel-Doe", "jane.sentinel@example.org", "+1 555 0100 7788"];

// fixtures-contract: registers imports-ended
const ROWS = Object.freeze([
  { import: 1, register: "town_filings", scope: "project", project: null, state: "indexed", finished_at: AT, rows_out: 120, bytes: 40960, author: "member:m1" },
  { import: 2, register: "town_filings", scope: "team", state: "stopped", reason: "stopped by a member", finished_at: AT, rows_out: 30, bytes: 1024, author: "member:m1" },
  { import: 3, register: "county_raw", scope: "team", state: "failed", reason: "the register's address did not answer", finished_at: AT, rows_out: 0, bytes: 0, author: "member:m1" },
  { import: 4, register: "town_filings", scope: "team", state: "indexed", finished_at: AT, rows_out: 5, bytes: 10, author: "member:m2" },
  { import: 5, register: "town_filings", scope: "team", state: "indexed", reason: "watch", finished_at: AT, rows_out: 7, bytes: 10, author: "member:m1" },
  { import: 6, register: "town_filings", scope: "team", state: "reading", finished_at: null, rows_out: 3, bytes: 10, author: "member:m1" },
  { import: 7, register: "town_filings", scope: "team", state: "indexed", finished_at: AT, rows_out: 5, bytes: 10, author: "class:daemon" },
  { import: 8, register: "town_filings", scope: "team", state: "indexed", finished_at: new Date(NOW - (REGISTER_IMPORT_DAYS + 1) * 86400e3).toISOString(), rows_out: 5, bytes: 10, author: "member:m1" },
]);

function setup(rows = ROWS, { feed } = {}) {
  const w = world({});
  w.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const asked = [];
  const importsEnded = feed ?? (({ after = 0, limit = 50 } = {}) => {
    asked.push({ after, limit });
    return rows.filter((r) => r.import > Number(after)).slice(0, Math.min(limit, 200)).map((r) => ({ ...r }));
  });
  const { read } = reader(fresh(w.host, { membership: w.membership, importsEnded }));
  return { w, read, asked };
}
const mine = (r) => KINDS.flatMap((k) => ofKind(r, k));

test("R31 a finished, a stopped and a failed import each make one item for the member who began it, keyed register-import-<state>::<import>; the same state read again makes none new", () => {
  for (const k of KINDS) assert.equal(NOTICE_KINDS[k], "FINDING", k);
  const { read } = setup();
  const r = read("m1", { now: NOW });
  assert.deepEqual(mine(r).map((i) => i.id).sort(),
    ["FINDING::register-import-done::1", "FINDING::register-import-failed::3", "FINDING::register-import-stopped::2"]);
  assert.deepEqual(r.facts.failed, []);
  const again = read("m1", { now: NOW });
  assert.deepEqual(mine(again).map((i) => i.id).sort(), mine(r).map((i) => i.id).sort(), "told once: the same keys");
  const done = ofKind(r, "register-import-done")[0];
  assert.deepEqual([done.fills.register, done.fills.rows, done.fills.bytes, done.fills.reason], ["town_filings", "120", "40960", ""]);
  assert.equal(done.door.length > 0, true, "its door opens the register");
  assert.equal(ofKind(r, "register-import-failed")[0].fills.reason, "the register's address did not answer");
});

test("R31 none for another member, a machine or a watch refresh; a running import makes none (control); a failed import restarted is a new import with a new key", () => {
  const { read } = setup();
  assert.deepEqual(mine(read("m2", { now: NOW })).map((i) => i.id), ["FINDING::register-import-done::4"], "m2 only her own");
  const ids = mine(read("m1", { now: NOW })).map((i) => i.id);
  for (const n of [4, 5, 6, 7]) assert.equal(ids.some((id) => id.endsWith(`::${n}`)), false, String(n));
  const again = setup([...ROWS, { import: 9, register: "county_raw", scope: "team", state: "indexed", finished_at: AT, rows_out: 3, bytes: 9, author: "member:m1" }]);
  assert.ok(mine(again.read("m1", { now: NOW })).some((i) => i.id === "FINDING::register-import-done::9"));
});

test("R31 the window is 90 days of finished_at; pages follow the last import read to at most 1,000, the bound and truncated stated; a feed that throws is named registers in facts.failed; with no importsEnded handed it contributes none and names none", () => {
  const { read } = setup();
  assert.equal(mine(read("m1", { now: NOW })).some((i) => i.id.endsWith("::8")), false, "older than the window");
  const many = Array.from({ length: 1001 }, (_, n) => ({ import: n + 1, register: "town_filings", scope: "team", state: "indexed", finished_at: AT, rows_out: 1, bytes: 1, author: "member:m1" }));
  const big = setup(many);
  const r = big.read("m1", { now: NOW });
  assert.equal(mine(r).length, REGISTER_IMPORTS_MAX);
  assert.deepEqual(r.facts.register_import, { bound: REGISTER_IMPORTS_MAX, days: REGISTER_IMPORT_DAYS, truncated: true });
  assert.ok(big.asked.every((a) => a.limit <= 200) && big.asked[1].after === 200, JSON.stringify(big.asked.slice(0, 2)));
  const thrown = setup(ROWS, { feed: () => { throw new Error("down"); } }).read("m1", { now: NOW });
  assert.deepEqual(mine(thrown), []);
  assert.ok(thrown.facts.failed.includes("registers"));
  const w = world({});
  w.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const none = reader(fresh(w.host, { membership: w.membership })).read("m1", { now: NOW });
  assert.deepEqual([mine(none), none.facts.failed], [[], []]);
});

test("R32 with sentinel names and contact values in an import's fields, no item's summary, detail, facts or subject holds any; the register's own label appears (control)", () => {
  const rows = [{ ...ROWS[0], first_row: { name: SENTINEL[0], email: SENTINEL[1], phone: SENTINEL[2] }, cells: SENTINEL, label: SENTINEL[0] }];
  const { read } = setup(rows);
  const r = read("m1", { now: NOW });
  const items = mine(r);
  assert.equal(items.length, 1);
  const text = JSON.stringify({ items, facts: r.facts });
  for (const s of SENTINEL) assert.equal(text.includes(s), false, s);
  assert.ok(items[0].summary.includes("town_filings"), "control: the register's own label");
});

test.todo("R31 over the real registers: importsEnded answers no starter (`author`) and no `bytes` yet, and store-assembly hands no deps.importsEnded (reported to BOB)");

/* R33–R35 are met in ai-notices-t53.test.mjs (queue's catalogue names their kinds, PR 833). R36 waits on the modules.json edge
   from notice-producers to mail-door (its Uses: "a new modules.json edge"), and the word table holds no sentence for
   mail-cleared yet; until then no item of its kind is minted. */
test.todo("R36 a member told once, privately, when her unconfirmed mail was removed (mail-door.clearedOwners): waits on the modules.json edge to mail-door and on the words for mail-cleared");
