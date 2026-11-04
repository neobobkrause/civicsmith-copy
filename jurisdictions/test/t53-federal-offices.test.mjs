/* jurisdictions, T53 (N1256; DEC-401): the federal layer's records offices (R119) and the makers' script that keeps them
 * current by release (R120). Tested at the module's interface (get, validate, combine) and at the script's (its exported
 * `main`, `officesFrom`, `officesDiff`), on saved responses of the government's own list, the FOIA.gov agency component list
 * (`fixtures/foia-components.json`: a read of 2026-11-03 trimmed to the fields the script reads, in two pages, and a later
 * read with one office removed, one renamed and one added). No test reaches the network. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { get, validate, combine } from "../index.mjs";
import { main, officesFrom, officesDiff, KEY_VARIABLE, LIST_ADDRESS } from "../scripts/foia-offices.mjs";
import SNAPSHOT from "../profiles/layers/us-federal-offices.mjs";

const FED = "us-federal";
const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/foia-components.json", import.meta.url), "utf8"));
const BASIS = "2026-11-03 foia-gov-components";
const codes = (r) => (r.errors || []).map((e) => `${e.code} ${e.path}`);
const R119_FIELDS = ["basis", "body", "contacts", "elected", "level", "role", "source"];
/* a fetch over saved pages, in order; it records each address asked */
const served = (pages) => { const asked = []; let i = 0;
  const fn = async (u) => { asked.push(u); const doc = pages[i++]; return doc ? { ok: true, status: 200, json: async () => structuredClone(doc) } : { ok: false, status: 404 }; };
  return Object.assign(fn, { asked }); };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "foia-offices-"));
/* a federal layer holding exactly these offices */
const layerWith = (offices) => ({ ...structuredClone(get(FED)), counterparties: offices.map((o) => structuredClone(o.entry)) });
/* the laws a request to an office may go under: those of the view whose `governs` names the office's level (R106) */
const lawsOf = (view, office) => view.records_laws.filter((l) => Array.isArray(l.governs) && l.governs.includes(office.level)).map((l) => l.name);

test("R119 the layer holds each office of the government's list, with its contacts, its source and the dated read; each reads FOIA as its law", () => {
  const offices = officesFrom(FX.a, { basis: BASIS });
  /* three offices published on the list; the component the list marks unpublished is not one */
  assert.deepEqual(offices.map((o) => [o.entry.role, o.entry.body]).sort(), [
    ["Administrative Conference of the United States", "Administrative Conference of the United States"],
    ["American Battle Monuments Commission", "American Battle Monuments Commission"],
    ["Headquarters", "Environmental Protection Agency"]]);
  for (const { entry: e } of offices) {
    assert.deepEqual(Object.keys(e).sort(), R119_FIELDS, `${e.role}: R119's fields and no other`);
    assert.deepEqual([e.level, e.elected, e.source, e.basis], ["federal", false, LIST_ADDRESS, BASIS]);
  }
  const by = Object.fromEntries(offices.map((o) => [o.entry.role, o.entry.contacts]));
  assert.deepEqual(by["American Battle Monuments Commission"], [{ how: "email", value: "foia@abmc.gov" },
    { how: "mail", value: "2300 Clarendon Boulevard, Suite 500, Attn: FOIA, Arlington, VA 22201" }]);
  assert.deepEqual(by["Administrative Conference of the United States"].map((c) => c.how), ["web", "mail"], "an office with no e-mail has none");
  assert.deepEqual(by.Headquarters.map((c) => c.how), ["web", "mail"]);
  assert.equal(by.Headquarters[0].value, "https://foiapublicaccessportal.epa.gov/", "the web form or portal address the list states");
  const layer = layerWith(offices);
  assert.deepEqual(validate(layer).errors, []);
  const r = combine([layer]);
  assert.ok(r.ok && r.conflicts.length === 0);
  assert.equal(r.view.counterparties.length, 3);
  for (const c of r.view.counterparties) {
    assert.deepEqual(lawsOf(r.view, c), ["Freedom of Information Act"], `${c.role} is under FOIA`);
    /* its deadlines are the layer's: the request's window is FOIA's own */
    assert.equal(r.view.records_laws.find((l) => l.name === "Freedom of Information Act").response, "foia_response");
  }
  /* control: an office the list does not name is not in the layer */
  assert.ok(!r.view.counterparties.some((c) => c.role === "Office of Information Policy"));
});

test("R119 the shipped federal layer holds the snapshot's offices: every one federal, sourced on the list and dated by its read; the package combines with no conflict", () => {
  const f = get(FED);
  assert.ok(SNAPSHOT.offices.length > 100, "the government's list, not a sample");
  assert.deepEqual(f.counterparties, SNAPSHOT.offices.map((o) => o.entry));
  assert.equal(new Set(SNAPSHOT.offices.map((o) => o.key)).size, SNAPSHOT.offices.length, "one entry per component of the list");
  assert.equal(new Set(f.counterparties.map((c) => `${c.role}\u0000${c.body}`)).size, f.counterparties.length, "one office per name and agency");
  for (const c of f.counterparties) {
    assert.deepEqual([c.level, c.elected, c.source, c.basis], ["federal", false, LIST_ADDRESS, `${SNAPSHOT.as_of} foia-gov-components`], c.role);
    assert.ok(Object.keys(c).every((k) => R119_FIELDS.includes(k)), c.role);
  }
  assert.equal(f.coverage.as_of, SNAPSHOT.as_of, "R120: the layer's as_of is the list's read");
  assert.deepEqual(validate(f).errors, []);
  const r = combine(["oakland-alameda"]);
  assert.ok(r.ok && r.conflicts.length === 0);
  const federal = r.view.counterparties.filter((c) => c.level === "federal");
  assert.equal(federal.length, f.counterparties.length);
  for (const c of federal) assert.deepEqual(lawsOf(r.view, c), ["Freedom of Information Act"], c.role);
  assert.equal(r.view.layers.find((l) => l.id === FED).as_of, SNAPSHOT.as_of);
});

test("R119 an office's contacts are R32's {how, value}, each read from its source; malformed, CONTACT_INVALID; without a source, SOURCE_MISSING", () => {
  const one = (fn) => { const l = layerWith(officesFrom(FX.a, { basis: BASIS })); fn(l.counterparties[0]); return codes(validate(l)); };
  assert.ok(one((c) => { c.contacts = []; }).includes("CONTACT_INVALID counterparties[0].contacts"));
  assert.ok(one((c) => { c.contacts[0].how = "fax"; }).includes("CONTACT_INVALID counterparties[0].contacts[0].how"));
  assert.ok(one((c) => { c.contacts[0].value = " "; }).includes("CONTACT_INVALID counterparties[0].contacts[0].value"));
  assert.ok(one((c) => { c.contacts[0].note = "x"; }).some((e) => e.endsWith("counterparties[0].contacts[0].note")));
  assert.ok(one((c) => { delete c.source; }).includes("SOURCE_MISSING counterparties[0].source"));
  assert.ok(one((c) => { c.source = ""; }).includes("VALUE_INVALID counterparties[0].source"));
  /* control: an office with no contacts, and one with neither contacts nor source, validates as R24 always did */
  assert.deepEqual(one((c) => { delete c.contacts; }), []);
  assert.deepEqual(one((c) => { delete c.contacts; delete c.source; }), []);
});

test("R120 the script writes the layer's data file and the diff against the previous snapshot: added, removed, renamed, contacts changed", async () => {
  const dir = tmp(), out = path.join(dir, "offices.mjs"), diff = path.join(dir, "diff.txt");
  const KEY = "makers-key-7f3a9c";
  const first = served(FX.a);
  const a = await main(["--as-of", "2026-11-03", "--out", out, "--diff", diff], { [KEY_VARIABLE]: KEY }, first);
  assert.equal(a.code, 0, a.err);
  assert.equal(first.asked.length, 2, "every page of the list, by its next link");
  assert.ok(first.asked.every((u) => u.startsWith(LIST_ADDRESS) && u.includes(`api_key=${KEY}`)), "the key is sent to the government's service");
  const snapA = (await import(`${pathToFileURL(out).href}?a`)).default;
  assert.deepEqual([snapA.as_of, snapA.source, snapA.offices.length], ["2026-11-03", LIST_ADDRESS, 3]);
  /* the layer validates with the snapshot written */
  assert.deepEqual(validate(layerWith(snapA.offices)).errors, []);
  assert.match(fs.readFileSync(diff, "utf8"), /added 3, removed 0, renamed 0, contacts changed 0/);
  /* a later read against the snapshot */
  const b = await main(["--as-of", "2026-12-01", "--out", out, "--diff", diff], { [KEY_VARIABLE]: KEY }, served(FX.b));
  assert.equal(b.code, 0, b.err);
  const snapB = (await import(`${pathToFileURL(out).href}?b`)).default;
  assert.equal(snapB.as_of, "2026-12-01");
  assert.deepEqual(validate(layerWith(snapB.offices)).errors, []);
  const d = officesDiff(snapA.offices, snapB.offices);
  assert.deepEqual(d.added.map((x) => x.role), ["Department of Commerce (General)"]);
  assert.deepEqual(d.removed.map((x) => x.role), ["Administrative Conference of the United States"]);
  assert.deepEqual(d.renamed.map((x) => [x.from.role, x.role]), [["Headquarters", "Headquarters (renamed)"]]);
  assert.deepEqual(d.contacts.map((x) => x.role), ["Headquarters (renamed)"]);
  const text = fs.readFileSync(diff, "utf8");
  assert.match(text, /against the snapshot of 2026-11-03/);
  assert.match(text, /added 1, removed 1, renamed 1, contacts changed 1/);
  for (const s of ["Department of Commerce (General)", "Administrative Conference of the United States", "Headquarters (Environmental Protection Agency) -> Headquarters (renamed)", "records@hq.example"])
    assert.ok(text.includes(s), s);
  /* the key is in no line the script answers and no file it writes */
  for (const s of [a.out, a.err, b.out, b.err, fs.readFileSync(out, "utf8"), text]) assert.ok(!s.includes(KEY));
  /* control: the same list read twice changes nothing */
  assert.deepEqual(officesDiff(snapB.offices, snapB.offices), { added: [], removed: [], renamed: [], contacts: [] });
});

test("R120 with the key absent the script stops, names the missing key and prints no value; a failing read never shows the key", async () => {
  const dir = tmp(), out = path.join(dir, "offices.mjs");
  for (const env of [{}, { [KEY_VARIABLE]: "" }, { [KEY_VARIABLE]: "  " }]) {
    const fetchFn = served(FX.a);
    const r = await main(["--as-of", "2026-11-03", "--out", out], env, fetchFn);
    assert.notEqual(r.code, 0);
    assert.ok(r.err.includes(KEY_VARIABLE), "names the missing key");
    assert.equal(fetchFn.asked.length, 0, "nothing is read");
    assert.ok(!fs.existsSync(out), "nothing is written");
  }
  const KEY = "makers-key-0b1e";
  const leaky = async (u) => { throw new Error(`could not reach ${u}`); };
  const r = await main(["--as-of", "2026-11-03", "--out", out], { [KEY_VARIABLE]: KEY }, leaky);
  assert.notEqual(r.code, 0);
  assert.ok(!r.err.includes(KEY) && !r.out.includes(KEY), "the key's value is never printed");
  assert.ok(!fs.existsSync(out));
  /* control: a malformed date is refused before anything is read */
  const none = served(FX.a);
  assert.notEqual((await main(["--as-of", "2026-13-40", "--out", out], { [KEY_VARIABLE]: KEY }, none)).code, 0);
  assert.equal(none.asked.length, 0);
});

test("R120 a team's copy never fetches the list: the module and its layers hold no network and no key", () => {
  const src = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
  for (const p of ["../index.mjs", "../profiles/layers/us-federal.mjs", "../profiles/layers/us-federal-offices.mjs"]) {
    const s = src(p);
    assert.ok(!/\bfetch\s*\(|api_key|FOIA_GOV_API_KEY|import[^;]*scripts\//.test(s), p);
  }
});
