/* jurisdictions, T48 (T48-2; N847; DEC-227 (3), (4); K3186, K3190): R89–R92, the `pointers` section, `POINTER_KINDS`, R90's
 * validation codes and `combine`'s union, the test profile's pointers and the first profile's researched ones. Tested at the
 * module's interface: the exports, validate, combine and the held profiles. Every refusal is shown beside a well-formed
 * control. The first profile's pointers are judged against the reads in `fixtures/pointers.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, validate, combine, SECTIONS, POINTER_KINDS } from "../index.mjs";
import { walkFacts } from "./helpers.mjs";
import { READ, LEGAL_AID_LIST, REFUSED, READS } from "./fixtures/pointers.mjs";

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
const HOWS = ["web", "email", "phone", "mail", "address"];
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
const errs = (r) => r.errors.map((e) => [e.path, e.code]);
const P0 = "pointers[0]";

/* A small real (non-test) profile holding one pointer, the base each refusal breaks one field of. */
const pointer = (over = {}) => ({ kind: "legalaid", name: "Town Legal Aid", does: "Free advice for tenants of the town.",
  contacts: [{ how: "phone", value: "555 0100" }], source: "https://aid.sample.example/about", status: "researched",
  basis: "2026-10-14", ...over });
const bare = (pointers, over = {}) => ({ id: "sample-town", name: "Sample Town", covers: ["Sample Town"], test: false, pointers, ...over });
const breakP = (fn) => { const p = bare([pointer()]); fn(p.pointers[0], p); return validate(p); };
/* the test profile with another id, for combine */
const other = (fn = () => {}) => { const p = get(TEST); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };

test("R89 POINTER_KINDS is exported: legalaid, selfhelp, service, agency, representative, tipline, in that order, frozen", async () => {
  assert.deepEqual([...POINTER_KINDS], ["legalaid", "selfhelp", "service", "agency", "representative", "tipline"]);
  assert.ok(Object.isFrozen(POINTER_KINDS));
  assert.throws(() => { POINTER_KINDS.push("hotline"); }, TypeError);
  assert.throws(() => { POINTER_KINDS[0] = "hotline"; }, TypeError);
  assert.deepEqual([...POINTER_KINDS], ["legalaid", "selfhelp", "service", "agency", "representative", "tipline"]);
  assert.equal((await import("../index.mjs")).POINTER_KINDS, POINTER_KINDS, "one list");
});

test("R89 pointers is a known section; a well-formed pointer of every kind and every how is accepted", () => {
  assert.ok(SECTIONS.includes("pointers"));
  assert.deepEqual(validate(bare([pointer()])), { ok: true, errors: [] });
  for (const id of [FIRST, TEST]) assert.ok(!validate(get(id)).errors.some((e) => e.code === "UNKNOWN_SECTION"), id);
  for (const kind of POINTER_KINDS) assert.deepEqual(validate(bare([pointer({ kind })])), { ok: true, errors: [] }, kind);
  for (const how of HOWS) assert.deepEqual(validate(bare([pointer({ contacts: [{ how, value: "x" }] })])), { ok: true, errors: [] }, how);
  /* several of one kind and none of another, and an empty list */
  assert.ok(validate(bare([pointer(), pointer({ name: "Second Aid" }), pointer({ kind: "tipline", name: "Gazette" })])).ok);
  assert.ok(validate(bare([])).ok, "an empty list");
  /* the optional fields: hours in R42's form, languages isLocale accepts */
  const hours = { weekly: [{ day: "mon", open: "09:00", close: "12:00" }, { day: "mon", open: "13:00", close: "17:00" }], status: "researched", basis: "2026-10-14" };
  assert.deepEqual(validate(bare([pointer({ hours, languages: ["en", "es-MX", "zh-Hant-TW"] })])), { ok: true, errors: [] });
  /* name: 1 to 200 characters on one line; does: 1 to 500 */
  for (const name of ["A", "x".repeat(200)]) assert.ok(breakP((x) => { x.name = name; }).ok, `name ${name.length}`);
  for (const does of ["A", "x".repeat(500), "two\nlines are allowed in does"]) assert.ok(breakP((x) => { x.does = does; }).ok, `does ${does.length}`);
  /* `address` is a pointer's own means: a legal organisation's contact (R32) does not take it */
  const org = { ...bare([]), action_kinds: [{ kind: "suit", label: "suit", tier: 3, basis: "K1" }],
    legal_organisations: [{ name: "Law Centre", evaluates: ["suit"], contacts: [{ how: "address", value: "1 Main St" }], basis: "K1" }] };
  assert.ok(hasError(validate(org), "CONTACT_INVALID", "legal_organisations[0].contacts[0].how"), "address on a legal organisation");
  org.legal_organisations[0].contacts[0].how = "mail";
  assert.ok(validate(org).ok, "control: mail on a legal organisation");
});

test("R89 a pointer is researched on a dated reading: status researched, basis a dated entry; TEST only in a test profile", () => {
  for (const b of ["2026-10-14", "2026-10-14 pointers", "2026-10-14, 2026-10-15", "2024-02-29; 2026-10-14 calbar"])
    assert.ok(breakP((x) => { x.basis = b; }).ok, b);
  for (const b of ["UNMEASURED", "M-190", "K3190", "D-149", "DEC-227", "2026-02-30", "2026-10-14, M-1", "K1; 2026-10-14", "TEST", "pointers"])
    assert.ok(hasError(breakP((x) => { x.basis = b; }), "BASIS_INVALID", `${P0}.basis`), b);
  assert.ok(hasError(breakP((x) => { delete x.basis; }), "BASIS_MISSING", `${P0}.basis`));
  for (const status of ["ruled", "measured", "", null, undefined]) {
    const r = breakP((x) => { if (status === undefined) delete x.status; else x.status = status; });
    assert.deepEqual(errs(r), [[`${P0}.status`, "BASIS_INVALID"]], `status ${status}`);
  }
  /* in a test profile TEST stands for the dated reading, and only there */
  assert.ok(breakP((x, p) => { p.test = true; x.basis = "TEST"; }).ok);
  assert.ok(hasError(breakP((x, p) => { p.test = true; x.basis = "UNMEASURED"; }), "BASIS_INVALID", `${P0}.basis`), "UNMEASURED in a test profile");
});

test("R90 validate names a malformed pointer by its field, each code beside its control", () => {
  /* KIND_INVALID */
  for (const kind of ["emergency", "LegalAid", "legal_aid", "", null, 1, undefined])
    assert.deepEqual(errs(breakP((x) => { if (kind === undefined) delete x.kind; else x.kind = kind; })), [[`${P0}.kind`, "KIND_INVALID"]], String(kind));
  /* VALUE_INVALID: name and does empty or over-long, name over one line */
  for (const name of ["", "   ", "x".repeat(201), "a\nb", "a\rb", 3, null])
    assert.deepEqual(errs(breakP((x) => { x.name = name; })), [[`${P0}.name`, "VALUE_INVALID"]], JSON.stringify(name));
  for (const does of ["", "  ", "x".repeat(501), 3, null])
    assert.deepEqual(errs(breakP((x) => { x.does = does; })), [[`${P0}.does`, "VALUE_INVALID"]], JSON.stringify(does));
  assert.ok(hasError(breakP((x) => { delete x.name; }), "VALUE_INVALID", `${P0}.name`));
  /* CONTACT_INVALID: an empty or missing list, a how outside R89's, an empty value, a contact not an object */
  for (const contacts of [[], null, "phone", undefined])
    assert.deepEqual(errs(breakP((x) => { if (contacts === undefined) delete x.contacts; else x.contacts = contacts; })), [[`${P0}.contacts`, "CONTACT_INVALID"]], JSON.stringify(contacts));
  for (const how of ["fax", "sms", "Web", "", null]) assert.deepEqual(errs(breakP((x) => { x.contacts[0].how = how; })), [[`${P0}.contacts[0].how`, "CONTACT_INVALID"]], String(how));
  for (const value of ["", "  ", 5, null]) assert.deepEqual(errs(breakP((x) => { x.contacts[0].value = value; })), [[`${P0}.contacts[0].value`, "CONTACT_INVALID"]], String(value));
  assert.deepEqual(errs(breakP((x) => { x.contacts = ["555 0100"]; })), [[`${P0}.contacts[0]`, "CONTACT_INVALID"]]);
  assert.deepEqual(errs(breakP((x) => { x.contacts[0].label = "main"; })), [[`${P0}.contacts[0].label`, "UNKNOWN_SECTION"]]);
  /* HOURS_INVALID: R42's form */
  const h = () => ({ weekly: [{ day: "mon", open: "09:00", close: "17:00" }], status: "researched", basis: "2026-10-14" });
  assert.ok(breakP((x) => { x.hours = h(); }).ok, "control");
  for (const [fn, path] of [[(x) => { x.hours = "9-5"; }, `${P0}.hours`], [(x) => { x.hours = h(); x.hours.weekly[0].day = "monday"; }, `${P0}.hours.weekly[0].day`],
    [(x) => { x.hours = h(); x.hours.weekly[0].close = "08:00"; }, `${P0}.hours.weekly[0]`], [(x) => { x.hours = h(); x.hours.weekly = "mon"; }, `${P0}.hours.weekly`]])
    assert.deepEqual(errs(breakP(fn)), [[path, "HOURS_INVALID"]], path);
  /* LOCALE_INVALID: an empty list, or a tag isLocale refuses (each listed here, not read off isLocale) */
  for (const languages of [["en"], ["es-MX", "zh-Hant-TW", "yue"]]) assert.ok(breakP((x) => { x.languages = languages; }).ok, languages.join());
  for (const languages of [[], "en", null]) assert.deepEqual(errs(breakP((x) => { x.languages = languages; })), [[`${P0}.languages`, "LOCALE_INVALID"]], JSON.stringify(languages));
  for (const tag of ["en_US", "en US", "en,fr", "", "e", 3, null])
    assert.deepEqual(errs(breakP((x) => { x.languages = ["en", tag]; })), [[`${P0}.languages[1]`, "LOCALE_INVALID"]], JSON.stringify(tag));
  /* SOURCE_MISSING: no source; a source of the wrong type is VALUE_INVALID */
  for (const source of [undefined, "", null])
    assert.deepEqual(errs(breakP((x) => { if (source === undefined) delete x.source; else x.source = source; })), [[`${P0}.source`, "SOURCE_MISSING"]], String(source));
  for (const source of [3, ["https://a.example"], "   "]) assert.deepEqual(errs(breakP((x) => { x.source = source; })), [[`${P0}.source`, "VALUE_INVALID"]], JSON.stringify(source));
  assert.ok(breakP((x) => { x.source = "Test Stat. § 14.2"; }).ok, "a citation is a source too");
  /* an unknown field, and a pointer that is not an object */
  assert.deepEqual(errs(breakP((x) => { x.priority = 1; })), [[`${P0}.priority`, "UNKNOWN_SECTION"]]);
  assert.deepEqual(errs(validate(bare(["Town Legal Aid"]))), [[P0, "VALUE_INVALID"]]);
  assert.deepEqual(errs(validate(bare("Town Legal Aid"))), [["pointers", "VALUE_INVALID"]]);
  /* every fault is reported, not only the first */
  const all = validate(bare([{ kind: "x", name: "", does: "", contacts: [], languages: [], status: "ruled", basis: "K1" }]));
  assert.deepEqual(errs(all).sort(), [[`${P0}.basis`, "BASIS_INVALID"], [`${P0}.contacts`, "CONTACT_INVALID"], [`${P0}.does`, "VALUE_INVALID"],
    [`${P0}.kind`, "KIND_INVALID"], [`${P0}.languages`, "LOCALE_INVALID"], [`${P0}.name`, "VALUE_INVALID"], [`${P0}.source`, "SOURCE_MISSING"],
    [`${P0}.status`, "BASIS_INVALID"]]);
});

test("R90 combine unions pointers in the order given: an equal pointer is kept once carrying both bases; nothing conflicts", () => {
  const t = get(TEST);
  const added = { kind: "tipline", name: "Marlow Evening Post (test)", does: "Takes readers' tips.", contacts: [{ how: "phone", value: "+1 555 0199" }],
    source: "https://post.marlow.example/tips", status: "researched", basis: "TEST" };
  const c = combine([TEST, other((p) => { p.pointers.push(added); })]);
  assert.equal(c.ok, true);
  assert.deepEqual(c.conflicts, []);
  const v = c.view.pointers;
  assert.deepEqual(v.map((x) => x.name), [...t.pointers.map((x) => x.name), added.name], "order kept, the new one last");
  for (const x of v.slice(0, t.pointers.length)) {
    assert.deepEqual(x.bases, [{ profile: TEST, basis: "TEST" }, { profile: "test-other", basis: "TEST" }], x.name);
    assert.equal(x.profile, TEST);
  }
  assert.deepEqual([v.at(-1).profile, v.at(-1).bases], ["test-other", [{ profile: "test-other", basis: "TEST" }]]);
  /* equal in everything but basis and profile: kept once, carrying both bases, its hours tagged with both too (R13) */
  const a = bare([pointer({ hours: { weekly: [{ day: "tue", open: "10:00", close: "12:00" }], status: "researched", basis: "2026-10-14" } })]);
  const b = bare([pointer({ basis: "2026-10-15", hours: { weekly: [{ day: "tue", open: "10:00", close: "12:00" }], status: "researched", basis: "2026-10-15" } })],
    { id: "sample-two", name: "Two", covers: ["Two"] });
  const ab = combine([a, b]);
  assert.deepEqual(ab.conflicts, []);
  assert.equal(ab.view.pointers.length, 1);
  assert.deepEqual(ab.view.pointers[0].bases, [{ profile: "sample-town", basis: "2026-10-14" }, { profile: "sample-two", basis: "2026-10-15" }]);
  assert.deepEqual(ab.view.pointers[0].hours.bases, [{ profile: "sample-town", basis: "2026-10-14" }, { profile: "sample-two", basis: "2026-10-15" }]);
  assert.deepEqual([ab.view.pointers[0].profile, ab.view.pointers[0].basis], ["sample-town", "2026-10-14"]);
  /* in the other order, the other first */
  assert.deepEqual(combine([b, a]).view.pointers[0].bases.map((x) => x.profile), ["sample-two", "sample-town"]);
  /* any other difference (a contact, hours, a language, the source) makes two pointers, both kept, never a conflict */
  for (const change of [(x) => { x.contacts[0].value = "555 0101"; }, (x) => { x.hours.weekly[0].close = "13:00"; }, (x) => { x.languages = ["es"]; },
    (x) => { x.source = "https://aid.sample.example/contact"; }]) {
    const d = bare([pointer({ hours: { weekly: [{ day: "tue", open: "10:00", close: "12:00" }], status: "researched", basis: "2026-10-14" } })],
      { id: "sample-two", name: "Two", covers: ["Two"] });
    change(d.pointers[0]);
    const r = combine([a, d]);
    assert.deepEqual(r.conflicts, [], change.toString());
    assert.equal(r.view.pointers.length, 2, change.toString());
  }
  /* absent, none: a profile without pointers, and an empty list */
  { const { pointers: _p, ...none } = bare([]); assert.equal(combine([none]).view.pointers, undefined); }
  assert.equal(combine([]).view.pointers, undefined);
  /* the view is the caller's copy */
  const w = combine([TEST]).view; w.pointers[0].contacts[0].value = "changed";
  assert.notEqual(combine([TEST]).view.pointers[0].contacts[0].value, "changed");
});

test("R91 the test profile supplies pointers: each kind, two of one kind, one with hours and languages, each how; unlike the first's", () => {
  const t = get(TEST), f = get(FIRST);
  assert.deepEqual(validate(t), { ok: true, errors: [] });
  const kinds = t.pointers.map((x) => x.kind);
  for (const k of POINTER_KINDS) assert.ok(kinds.includes(k), k);
  assert.ok(POINTER_KINDS.some((k) => kinds.filter((x) => x === k).length >= 2), "two of one kind");
  assert.ok(t.pointers.some((x) => x.hours && x.hours.weekly.length && x.languages && x.languages.length), "one with hours and languages");
  assert.deepEqual([...new Set(t.pointers.flatMap((x) => x.contacts.map((c) => c.how)))].sort(), [...HOWS].sort(), "each how");
  /* every basis TEST, the hours' too */
  let n = 0;
  walkFacts({ pointers: t.pointers }, (fact, path) => { n++; assert.equal(fact.basis, "TEST", path); });
  assert.ok(n > t.pointers.length, "the pointers and their hours are walked");
  /* values differ from the first profile's: no name, source or contact value in common */
  const fset = (fn) => new Set(f.pointers.flatMap(fn));
  const names = fset((x) => [x.name]), sources = fset((x) => [x.source]), values = fset((x) => x.contacts.map((c) => c.value));
  for (const x of t.pointers) {
    assert.ok(!names.has(x.name) && !sources.has(x.source), x.name);
    for (const c of x.contacts) assert.ok(!values.has(c.value), c.value);
  }
  /* the two combine with no conflict, every pointer of each kept */
  const both = combine([FIRST, TEST]);
  assert.ok(!both.conflicts.some((c) => c.at.startsWith("pointers")));
  assert.equal(both.view.pointers.length, f.pointers.length + t.pointers.length);
});

/* The first profile's pointers, read on 2026-10-14 (fixtures/pointers.mjs). */
const digits = (s) => String(s).replace(/\D/g, "");
const ofKind = (k) => get(FIRST).pointers.filter((x) => x.kind === k);

test("R92 the first profile's pointers are researched: each from a page read, its source that page, the day read its basis", () => {
  const f = get(FIRST);
  assert.deepEqual(validate(f), { ok: true, errors: [] });
  assert.ok(f.pointers.length);
  for (const x of f.pointers) {
    assert.equal(x.status, "researched", x.name);
    assert.equal(x.basis, `${READ} pointers`, x.name);
    if (x.hours) assert.deepEqual([x.hours.status, x.hours.basis], ["researched", `${READ} pointers`], x.name);
    /* the source is a page read, by its address */
    const read = READS[x.source];
    assert.ok(read, `${x.name}: ${x.source} was read`);
    assert.equal(new URL(x.source).protocol, "https:", x.source);
    /* every contact is what that page prints: a number's digits, an address's street, an email or a page address */
    const text = read.quote.join(" | ");
    for (const c of x.contacts) {
      if (c.how === "phone") assert.ok(digits(text).includes(digits(c.value)), `${x.name} ${c.value}`);
      else if (c.how === "email") assert.ok(text.toLowerCase().includes(c.value.toLowerCase()), `${x.name} ${c.value}`);
      else if (c.how === "address" || c.how === "mail") assert.ok(text.includes(c.value.split(",")[0].replace(/^News Tips$/, "901 Mission Street")), `${x.name} ${c.value}`);
      else assert.ok(text.includes(c.value) || new URL(c.value).hostname === new URL(x.source).hostname, `${x.name} ${c.value}`);
    }
  }
  /* each source read is a pointer's: the fixture holds no read the profile does not use */
  const used = new Set(f.pointers.map((x) => x.source));
  for (const s of Object.keys(READS)) assert.ok(used.has(s), s);
  /* no source from a made-up host, nothing from the design stream's mockup (its entries are illustrative, .example) */
  for (const x of f.pointers) assert.ok(!/\.example$|\.test$|localhost/.test(new URL(x.source).hostname), x.source);
});

test("R92 K3190 legal aid is exactly what the official list names as serving the county, less the hosts that refused the read", () => {
  const held = ofKind("legalaid").map((x) => x.name);
  const refused = new Set(REFUSED.map((r) => r.name));
  const expected = LEGAL_AID_LIST.names.filter((n) => !refused.has(n)).map((n) => LEGAL_AID_LIST.own[n] || n);
  assert.deepEqual(held, expected, "the list's organisations, in its order, by their own names");
  /* every name on the list is held or named refused: none is dropped silently */
  for (const n of LEGAL_AID_LIST.names) assert.ok(refused.has(n) || held.includes(LEGAL_AID_LIST.own[n] || n), n);
  assert.ok(REFUSED.every((r) => LEGAL_AID_LIST.names.includes(r.name)));
  /* each is read on its own site, never on the list's page */
  for (const x of ofKind("legalaid")) assert.ok(!x.source.includes("calbar.ca.gov"), x.name);
});

test("R92 each kind starts from its primary list: the courts' self-help pages, the City's service line, every office on the Council's roster", () => {
  const self = ofKind("selfhelp").map((x) => x.source);
  assert.ok(self.includes("https://www.alameda.courts.ca.gov/self-help"), "the county court's self-help center");
  assert.ok(self.includes("https://selfhelp.courts.ca.gov/"), "the courts' statewide self-help guide");
  for (const s of self) assert.match(new URL(s).hostname, /(^|\.)courts\.ca\.gov$/);
  const service = ofKind("service");
  assert.ok(service.length >= 1 && service.every((x) => new URL(x.source).hostname === "www.oaklandca.gov"), "the City's own page");
  /* the roster: each office it lists, by its seat; the read names eight, at large and seven districts */
  const reps = ofKind("representative");
  const roster = READS["https://www.oaklandca.gov/Government/City-Council-Leadership/Leadership"].quote;
  assert.equal(reps.length, roster.length);
  for (const x of reps) assert.equal(x.source, "https://www.oaklandca.gov/Government/City-Council-Leadership/Leadership", x.name);
  assert.deepEqual(reps.map((x) => x.name.replace("Oakland City Council, ", "").replace(" office", "")),
    ["At-Large", ...[1, 2, 3, 4, 5, 6, 7].map((d) => `District ${d}`)]);
  /* never chosen by a member's address: no pointer carries an address-matching field (R89's fields are all there is) */
  for (const x of reps) assert.deepEqual(Object.keys(x).sort(), ["basis", "contacts", "does", "kind", "name", "source", "status"]);
  /* an agency's own page says it takes one person's complaint; a newsroom's own page publishes its tip channel */
  for (const x of ofKind("agency")) assert.match(READS[x.source].quote.join(" "), /complaint|petition/i, x.name);
  for (const x of ofKind("tipline")) assert.match(READS[x.source].quote.join(" "), /\btips?\b/i, x.name);
});

test("R92 DEC-227 (4) no emergency number is held, and the record names every kind held none of (here: none)", () => {
  const f = get(FIRST);
  const EMERGENCY = ["911", "112", "999", "988"];
  for (const x of f.pointers) for (const c of x.contacts) {
    /* a number that is, or dials, an emergency service: alone, or as its own group within the value */
    const groups = String(c.value).split(/[^0-9]+/).filter(Boolean);
    for (const e of EMERGENCY) assert.ok(!groups.includes(e), `${x.name} ${c.value}`);
    assert.ok(!/emergency/i.test(c.value), `${x.name} ${c.value}`);
  }
  /* the control: the same check refuses a value that is one */
  for (const v of ["911", "Call 911", "988", "+44 999"]) assert.ok(String(v).split(/[^0-9]+/).filter(Boolean).some((g) => EMERGENCY.includes(g)), v);
  /* every kind a primary page supports is held at least once; this reading found one for each */
  for (const k of POINTER_KINDS) assert.ok(f.pointers.some((x) => x.kind === k), k);
  /* combined alone, the view carries them, tagged with the first profile */
  const v = combine([FIRST]).view.pointers;
  assert.deepEqual(v.map((x) => [x.name, x.profile, x.basis]), f.pointers.map((x) => [x.name, FIRST, x.basis]));
});
