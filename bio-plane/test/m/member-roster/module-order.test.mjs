/* R83 (K289, N280): `MODULE_ORDER`, the frozen list of build/modules.json's module ids in its total order, the one list
   the modules order their listeners by (this module's R79 among them). T49-1 (N1073, K3268): the test reads the order and
   every module's place from the file, the owner's declaration, and hand-lists no other module's ids. T50 (R146): the names
   tolerated as not yet built are the file's too (the modules without paths), none kept here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { world } from "./fixture.mjs";
import { MODULE_ORDER, moduleOrderFrom } from "../../../src/member-roster/index.mjs";

const modulesJson = async () =>
  JSON.parse(await readFile(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules;

/* A module's place: the module before it, itself, the module after it (undefined past either end). */
const pin = (list, id) => { const i = list.indexOf(id); return [list[i - 1], id, list[i + 1]]; };
const without = (list, id) => list.filter((x) => x !== id);
/* The list with `id` moved one place earlier: never the file's order. */
const earlier = (list, id) => { const i = list.indexOf(id); const out = [...list]; [out[i - 1], out[i]] = [out[i], out[i - 1]]; return out; };

test("R27 MODULE_ORDER is build/modules.json's module ids in its total order, each once and nothing else", async () => {
  const modules = await modulesJson();
  assert.ok(Array.isArray(MODULE_ORDER));
  assert.deepEqual([...MODULE_ORDER], modules.map((m) => m.id), "the file's ids, in the file's order");
  /* The file's order is the total order (P4): layer by layer, never back to an earlier layer. */
  const layers = modules.map((m) => m.layer);
  assert.deepEqual(layers, [...layers].sort((a, b) => a - b), "modules.json is in layer order");
  assert.equal(new Set(MODULE_ORDER).size, MODULE_ORDER.length, "no id twice");
  for (const id of MODULE_ORDER) assert.equal(typeof id, "string");
});

test("R27 every module the file names is in MODULE_ORDER in the file's place, and a list without it, or holding it one place early, is not the file's (negative control for every module, the last one included)", async () => {
  const modules = await modulesJson();
  const ids = modules.map((m) => m.id);
  for (const id of ids) {
    assert.deepEqual(pin(MODULE_ORDER, id), pin(ids, id), `${id}: its neighbours in the list are the file's`);
    assert.notDeepEqual(without(MODULE_ORDER, id), ids, `a list without ${id} is not the file's`);
    if (MODULE_ORDER.indexOf(id) > 0) {
      assert.notDeepEqual(earlier(MODULE_ORDER, id), ids, `${id} one place early is not the file's order`);
      assert.notDeepEqual(pin(earlier(MODULE_ORDER, id), id), pin(ids, id), `the pin refuses ${id} one place early`);
    }
  }
  assert.equal(MODULE_ORDER.at(-1), ids.at(-1), "the last module is held");
  assert.notDeepEqual(MODULE_ORDER.slice(0, -1), ids, "a list stopping before the last module is not the file's");
});

/* T50 (R146; N1115, N1171; K657, K3268; amends R83, R140, R145, R79): the list is assembled from the file, so the places
   R83, R140 and R145 gave a module ("directly after" another) describe the file as it then stood and bind nothing now. What
   they asked for, that each module sits in the file's place and the pathless ones are tolerated, is held for every module
   the file names, read from the file, with no module's id written here but as a fixture of the test itself. */
test("R61 R56 R60 MODULE_ORDER is the file's order with setup-words first and translations directly before instance-setup; every module keeps the file's neighbours", async () => {
  const modules = await modulesJson();
  const ids = modules.map((m) => m.id);
  assert.deepEqual([...MODULE_ORDER], ids, "the list is the file's order");
  assert.equal(MODULE_ORDER[0], "setup-words", "setup-words is first");
  assert.equal(modules[0].layer, 1, "and in layer 1");
  assert.deepEqual(pin(MODULE_ORDER, "translations").map((x) => x ?? null).slice(1, 3), ["translations", "instance-setup"],
    "translations directly before instance-setup");
  assert.equal(modules.find((m) => m.id === "translations").layer, 11);
  /* the places R140 and R145 named, as the file now holds them, are held for every module alike */
  for (const id of ids) assert.deepEqual(pin(MODULE_ORDER, id), pin(ids, id), `${id}: the file's neighbours`);
  /* controls: a list without the last module, with translations after instance-setup, or with setup-words not first fails */
  assert.notDeepEqual(MODULE_ORDER.slice(0, -1), ids, "a list lacking the file's last module fails");
  const swapped = [...MODULE_ORDER];
  const i = swapped.indexOf("translations");
  [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
  assert.notDeepEqual(swapped, ids, "translations after instance-setup fails");
  assert.notDeepEqual([...MODULE_ORDER.slice(1), MODULE_ORDER[0]], ids, "setup-words last fails");
});

test("R61 R27 the modules tolerated as not yet built are exactly those the file shows without paths, read from the file; every other module is held to its paths on disk, and a built module that lost its paths is not tolerated", async () => {
  const modules = await modulesJson();
  const unbuilt = modules.filter((m) => !m.paths.length).map((m) => m.id);
  for (const m of modules) {
    assert.ok(MODULE_ORDER.includes(m.id), `${m.id} is in the list, built or not`);
    if (m.paths.length) for (const p of m.paths) assert.ok(existsSync(new URL(`../../../../${p}`, import.meta.url)), `${m.id}: ${p} is on disk`);
  }
  /* control: forging a copy of the file, a built module without paths joins the tolerated names; the list is unchanged */
  const built = modules.find((m) => m.paths.length);
  const forged = modules.map((m) => (m.id === built.id ? { ...m, paths: [] } : m));
  assert.deepEqual(forged.filter((m) => !m.paths.length).map((m) => m.id).sort(), [...unbuilt, built.id].sort());
  assert.deepEqual([...moduleOrderFrom({ modules: forged })], [...MODULE_ORDER], "the list does not depend on paths");
});

test("R61 moduleOrderFrom answers the frozen ids of a parsed copy of the file, in its order: a module moved and one added take their new places and nothing else changes; MODULE_ORDER is its answer for the file itself", async () => {
  const file = JSON.parse(await readFile(new URL("../../../../build/modules.json", import.meta.url), "utf8"));
  assert.deepEqual([...moduleOrderFrom(file)], [...MODULE_ORDER]);
  assert.ok(Object.isFrozen(moduleOrderFrom(file)));
  const ids = file.modules.map((m) => m.id);
  /* move the module at position 5 to just before the last, and add a new one after position 10 */
  const moved = ids[5], after = ids[10];
  const copy = { ...file, modules: file.modules.filter((m) => m.id !== moved) };
  copy.modules.splice(copy.modules.length - 1, 0, file.modules.find((m) => m.id === moved));
  copy.modules.splice(copy.modules.findIndex((m) => m.id === after) + 1, 0, { id: "a-new-module", layer: 2, paths: [] });
  const got = [...moduleOrderFrom(copy)];
  assert.deepEqual(got, copy.modules.map((m) => m.id), "the copy's order");
  assert.equal(got.indexOf("a-new-module"), got.indexOf(after) + 1, "the added module is where it was put");
  assert.equal(got.at(-2), moved, "the moved module is where it was put");
  assert.deepEqual(got.filter((id) => id !== "a-new-module" && id !== moved), ids.filter((id) => id !== moved),
    "nothing else changed");
  assert.ok(Object.isFrozen(moduleOrderFrom(copy)));
  /* the same function takes the bare list, and drops what is not a module id and what repeats */
  assert.deepEqual([...moduleOrderFrom([{ id: "a" }, { id: "b" }, { id: "a" }, { nope: 1 }, null, { id: "" }])], ["a", "b"]);
  assert.deepEqual([...moduleOrderFrom(null)], []);
  assert.deepEqual([...moduleOrderFrom({ modules: "x" })], []);
});

test("R61 order.mjs is generated from build/modules.json, never hand-written: its text is exactly the generator's for the file, and a changed file makes it stale", async () => {
  const { render, idsOf, firstDifference, MODULES_PATH, ORDER_PATH } = await import("../../../src/member-roster/order-build.mjs");
  const bytes = await readFile(MODULES_PATH);
  const have = await readFile(ORDER_PATH, "utf8");
  assert.equal(have, render(bytes), "order.mjs is not stale");
  assert.equal(firstDifference(have, render(bytes)), null);
  const file = JSON.parse(bytes.toString("utf8"));
  const changed = Buffer.from(JSON.stringify({ ...file, modules: [...file.modules, { id: "zz-new", layer: 11, paths: [] }] }));
  assert.match(firstDifference(have, render(changed)), /^line \d+/, "a module added to the file stales it");
  const moved = Buffer.from(JSON.stringify({ ...file, modules: [file.modules.at(-1), ...file.modules.slice(0, -1)] }));
  assert.notEqual(render(moved), have, "a module moved stales it");
  assert.throws(() => idsOf({ modules: [{ id: "a" }, { id: "a" }] }), /not distinct/);
  assert.throws(() => idsOf({ modules: [{}] }), /without an id/);
  assert.throws(() => idsOf({}), /no modules list/);
});

test("R27 MODULE_ORDER is frozen: no write changes it", () => {
  const before = JSON.stringify(MODULE_ORDER);
  assert.ok(Object.isFrozen(MODULE_ORDER));
  const writes = [
    () => MODULE_ORDER.push("x"), () => MODULE_ORDER.pop(), () => MODULE_ORDER.reverse(), () => MODULE_ORDER.sort(),
    () => MODULE_ORDER.splice(0, 1), () => { MODULE_ORDER[0] = "x"; }, () => { MODULE_ORDER.length = 0; },
    () => { delete MODULE_ORDER[1]; },
  ];
  for (const w of writes) assert.throws(w, TypeError, String(w));
  assert.equal(JSON.stringify(MODULE_ORDER), before);
});

test("R27 R25 the revocation notice runs its listeners in MODULE_ORDER, whatever order they registered in, an unknown module last", async () => {
  const w = await world({ omit: ["revoked"] }).group("ann");
  const heard = [];
  const registered = [...MODULE_ORDER].reverse();
  registered.splice(7, 0, "unknown-b");
  registered.push("unknown-a");
  for (const m of registered) assert.equal(w.m.onRevoked(m, () => heard.push(m)).ok, true, m);
  assert.equal(w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" }).ok, true);
  assert.deepEqual(heard, [...MODULE_ORDER, "unknown-b", "unknown-a"]);
});

test("R61 R25 three listeners registered in an order other than the file's are called in the file's order; one registered by a module the file does not name is called last", async () => {
  const w = await world({ omit: ["revoked"] }).group("ann");
  const heard = [];
  const three = [MODULE_ORDER[40], MODULE_ORDER[3], MODULE_ORDER[120]];
  for (const m of [three[2], three[0], three[1]]) assert.equal(w.m.onRevoked(m, () => heard.push(m)).ok, true, m);
  assert.equal(w.m.onRevoked("not-in-the-file", () => heard.push("not-in-the-file")).ok, true);
  assert.equal(w.m.memberSet({ memberId: "ann", status: "revoked", by: "admin" }).ok, true);
  assert.deepEqual(heard, [MODULE_ORDER[3], MODULE_ORDER[40], MODULE_ORDER[120], "not-in-the-file"]);
});
