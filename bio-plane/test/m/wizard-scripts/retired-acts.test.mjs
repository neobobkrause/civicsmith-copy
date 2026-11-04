/* wizard-scripts: fallout of op-declarations PR 95 (ai-accounts R35, R36, T53; K5457, no aliases). The design files still name
   ai-accounts' retired door ops; the carried registry and library read each as its T53 op (ai-accounts R61) or as no act, so
   every act the module carries is an op op-declarations specs and the required flows pass R14's walk against the op table. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { SCREEN_REGISTRY, CIVICSMITH_LIBRARY } from "../../../src/wizard-scripts/index.mjs";
import * as data from "../../../src/wizard-scripts/data.mjs";

const { INSTALLER_ROUTES, screensFromFile } = data;
const RETIRED_ACTS = data.RETIRED_ACTS ?? {};

const RETIRED = ["groupkeyset", "groupkeyswitch", "groupkeyremove", "groupkeynoticeseen", "accountreferenceset", "accountreferenceremove",
                 "subscriptiondisconnect", "projectkeyset", "projectsigninset", "projectaccountswitch", "projectaccountremove", "projectkeynoticeseen"];
const specced = (op) => Object.hasOwn(OPS, op) || INSTALLER_ROUTES.includes(op);
const versions = (s) => [s, ...(s.earlier ?? [])];

test("ai-accounts R35, R36: no op the retirement names is specced by op-declarations, and each one's replacement is", () => {
  assert.deepEqual(Object.keys(RETIRED_ACTS).sort(), [...RETIRED].sort());
  for (const op of RETIRED) assert.ok(!Object.hasOwn(OPS, op), `${op} is retired`);
  for (const [op, to] of Object.entries(RETIRED_ACTS)) if (to !== null) assert.ok(Object.hasOwn(OPS, to), `${op} -> ${to}`);
});

test("every act a library script's offered version names is an op op-declarations specs, and no version of any script names a retired op", () => {
  const bad = [];
  for (const s of CIVICSMITH_LIBRARY) for (const [i, t] of s.steps.entries())
    if (t.act !== null && t.act !== undefined && !specced(t.act)) bad.push(`${s.id}@${s.version} step ${i}: ${t.act}`);
  for (const s of CIVICSMITH_LIBRARY) for (const v of versions(s)) for (const [i, t] of v.steps.entries())
    if (RETIRED.includes(t.act)) bad.push(`${s.id}@${v.version} step ${i}: ${t.act} (retired)`);
  assert.deepEqual(bad, []);
  /* the steps that named a retired op now name its replacement */
  const setup = CIVICSMITH_LIBRARY.find((s) => s.id === "WIZ-c887066cc553dd41");
  assert.equal(setup.steps[11].act, "aiaccountadd");
  const connect = CIVICSMITH_LIBRARY.find((s) => s.id === "WIZ-74328804ddae3503");
  assert.ok(connect.steps.some((t) => t.act === "aiownadd") && connect.steps.at(-1).act === "aiaccountremove", JSON.stringify(connect.steps.map((t) => t.act)));
});

test("no screen of SCREEN_REGISTRY registers a retired op; the retired ones are carried as their T53 ops, each specced", () => {
  const bad = SCREEN_REGISTRY.flatMap((s) => s.acts.filter((a) => RETIRED.includes(a)).map((a) => `${s.id}: ${a}`));
  assert.deepEqual(bad, []);
  const acts = Object.fromEntries(SCREEN_REGISTRY.map((s) => [s.id, s.acts]));
  for (const op of ["aiaccountadd", "aiaccountswitch"]) assert.ok(acts.setup.includes(op), `setup ${op}`);
  for (const op of ["subscriptionsignin", "aiownadd", "aiaccountremove"]) assert.ok(acts.connect.includes(op), `connect ${op}`);
  for (const op of ["aiaccountadd", "aiaccountswitch", "aiaccountremove"]) assert.ok(acts.teamai.includes(op) && acts.projectai.includes(op), op);
  for (const s of ["setup", "connect", "teamai", "projectai", "queue"]) for (const a of acts[s]) if (a.startsWith("ai")) assert.ok(specced(a), `${s}: ${a}`);
  /* an act the reading maps twice on one screen is one act */
  assert.equal(acts.connect.filter((a) => a === "aiaccountremove").length, 1);
});

test("control: the design file read without the retirement names the retired ops", () => {
  const file = JSON.parse(readFileSync(new URL("./source/registry.json", import.meta.url), "utf8"));
  const raw = file.screens.flatMap((s) => s.acts.filter((a) => a.status !== "owed").map((a) => a.op));
  assert.ok(RETIRED.every((op) => raw.includes(op)));
  assert.ok(screensFromFile(file).every((s) => s.acts.every((a) => !RETIRED.includes(a))));
});
