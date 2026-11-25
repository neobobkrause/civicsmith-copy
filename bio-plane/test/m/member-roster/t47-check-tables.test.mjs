/* T47 (K3037; promotion R39's row families, answer-envelope): R68, the refusal-row tables this module holds (its
   `checks.mjs`; the module's `index.mjs` does not export them until `membership`'s CR-4 swaps the rows, so each code keeps one
   row throughout). Every `*_CHECKS` export is found by name from the file itself (so a table added later is held too), and each is a frozen
   map from a code to a frozen row `{check, where, translation}`; no code has two rows across them; the codes the
   module-level refusals mint carry their one row. At the interface only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as checks from "../../../src/member-roster/checks.mjs";
import * as index from "../../../src/member-roster/index.mjs";
import { notAnAdmin, noSuchMember, listenerRefusal } from "../../../src/member-roster/index.mjs";

const NAMED = ["MEMBERSHIP_CHECKS", "MEMBER_ID_CHECKS", "CUSTODIAL_CHECKS"];
const tables = () => Object.entries(checks.MEMBER_ROSTER_ROWS);

/* Each code's rows across a set of tables; the rule holds when every list has length one. */
const rowsByCode = (set) => {
  const by = new Map();
  for (const [name, table] of set) for (const code of Object.keys(table)) by.set(code, [...(by.get(code) ?? []), name]);
  return by;
};
const doubled = (set) => [...rowsByCode(set)].filter(([, names]) => names.length > 1).map(([code]) => code);

test("R68 the module holds MEMBERSHIP_CHECKS, MEMBER_ID_CHECKS, CUSTODIAL_CHECKS and every other *_CHECKS table, each a frozen map from a code to a frozen row {check, where, translation}; none is exported from index.mjs until the swap", () => {
  const names = tables().map(([name]) => name);
  assert.deepEqual([...names].sort(), [...NAMED].sort(), "exactly these tables");
  /* the copy window: no `*_CHECKS` name is exported from the module's index or from its checks file, so the census (which
     reaches every such export of every module) sees one row per code */
  assert.deepEqual(Object.keys(index).filter((n) => /_CHECKS$/.test(n)), [], "index.mjs exports no refusal-row table");
  assert.deepEqual(Object.keys(checks).filter((n) => /_CHECKS$/.test(n)), [], "checks.mjs exports no *_CHECKS name");
  for (const [name, table] of tables()) {
    assert.ok(table && typeof table === "object" && !Array.isArray(table), `${name} is a map`);
    assert.ok(Object.isFrozen(table), `${name} is frozen`);
    assert.ok(Object.keys(table).length > 0, `${name} holds rows`);
    for (const [code, row] of Object.entries(table)) {
      assert.match(code, /^[A-Z][A-Z0-9_]+$/, `${name}: ${code} is a code`);
      assert.ok(Object.isFrozen(row), `${name}.${code} is frozen`);
      assert.deepEqual(Object.keys(row).sort(), ["check", "translation", "where"], `${name}.${code}'s row`);
      assert.match(row.check, /^C-\d+\.\d+$/, `${name}.${code}.check`);
      assert.match(row.where, /^src\/member-roster\/index\.mjs \S+ > is-[a-z0-9-]+$/, `${name}.${code}.where`);
      assert.ok(typeof row.translation === "string" && row.translation.trim().length > 20, `${name}.${code}.translation`);
    }
  }
});

test("R68 no write changes a table or a row: adding, replacing or deleting a code, and changing a row's field, each throw and leave it as it was", () => {
  for (const [name, table] of tables()) {
    const before = JSON.stringify(table);
    const [code] = Object.keys(table);
    const writes = [
      () => { table.FORGED_CODE = { check: "C-0.0", where: "x", translation: "x" }; },
      () => { table[code] = { check: "C-0.0", where: "x", translation: "x" }; },
      () => { delete table[code]; },
      () => { table[code].translation = "forged"; },
      () => { table[code].check = "C-0.0"; },
      () => { delete table[code].where; },
    ];
    for (const w of writes) assert.throws(w, TypeError, `${name}: ${w}`);
    assert.equal(JSON.stringify(table), before, `${name} unchanged`);
  }
});

test("R68 K231 every code has exactly one row across the module's tables, and no two codes share a row's check (negative control: a code held twice is seen)", () => {
  assert.deepEqual(doubled(tables()), [], "no code in two tables");
  const checks = tables().flatMap(([, t]) => Object.values(t).map((r) => r.check));
  assert.equal(new Set(checks).size, checks.length, "each check id is one row's");
  /* negative control: the same rule refuses a set in which a second table holds a code the first holds */
  const [[, first]] = tables();
  const [code] = Object.keys(first);
  assert.deepEqual(doubled([...tables(), ["FORGED_CHECKS", { [code]: first[code] }]]), [code]);
});

test("R68 the refusals the module-level functions mint carry their one row, check and translation byte for byte, wherever it is held", () => {
  const rows = new Map(tables().flatMap(([, t]) => Object.entries(t)));
  const minted = [
    notAnAdmin("member:x", "an act"), noSuchMember("nobody"),
    listenerRefusal([], "", () => {}), listenerRefusal([{ module: "m" }], "m", () => {}),
  ];
  const carriesItsRow = (r) => {
    assert.equal(r.ok, false);
    const row = rows.get(r.code);
    assert.ok(row, `${r.code} has a row`);
    assert.deepEqual([r.check, r.translation], [row.check, row.translation], r.code);
  };
  for (const r of minted) carriesItsRow(r);
  /* negative control (T47-82, P8: the same check, run on forgeries, so it can fail): a translation or check departing
     from its row, and a code with no row, are each refused */
  assert.throws(() => carriesItsRow({ ...minted[0], translation: "forged" }));
  assert.throws(() => carriesItsRow({ ...minted[1], check: "C-0.0" }));
  // fixtures-generic: NO_SUCH_CODE
  assert.throws(() => carriesItsRow({ ...minted[1], code: "NO_SUCH_CODE" }));
});
