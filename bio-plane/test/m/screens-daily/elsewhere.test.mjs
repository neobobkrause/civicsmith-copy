/* Where else to go (R15, R16) on the real served page (interface-shell's harness), against a fake plane answering
   `wizard-scripts` R37's shape (`startfrom`'s `elsewhere` route and its `pointer`) until `plane` R51 merges. Every sentence is asserted as
   `word(key, vars)` (R34): no test here holds a sentence's English. */
import test from "node:test";
import assert from "node:assert/strict";
import { open, ok, refused, text, ops, main, screen, word, hasWord, dmy, inOrder } from "./page.mjs";
import { SHELL_OPS } from "../../../src/interface-shell/index.mjs";

const P = (kind, name, extra = {}) => ({ kind, name, does: `What ${name} does.`, contacts: [{ how: "phone", value: "(510) 555-0100" }, { how: "web", value: "help.example.org/" + kind }],
  source: `${name}'s website`, status: "researched", basis: "2026-10-02", ...extra });
// A fixture holding every kind, in an order other than DEC-227's, two of one kind.
const EVERY = [P("tipline", "Ledger tips"), P("legalaid", "Legal Aid Line"), P("agency", "Civil Rights Department"), P("selfhelp", "Self-Help Center"),
  P("agency", "Labor Commissioner"), P("representative", "District 3 office"), P("service", "Town 311")];
const door = (pointer) => ok({ ok: true, scripts: [], doors: [{ door: "elsewhere", scripts: [], opens: "elsewhere" }], routes: [{ route: "project" }, { route: "elsewhere", pointer }] });
const unesc = (t) => String(t).replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
const KIND = (k) => word(`elsewhere.kind.${k}`);
const heads = (p) => main(p).querySelectorAll("section > h2").map((h) => h.textContent);

test("R15: elsewhere reads startfrom and draws, under its heading, each kind holding a pointer in DEC-227's order, each pointer with what it does, how to reach it and its source with the date read", async () => {
  const p = await open("/app/elsewhere", { startfrom: door({ places: ["River Town"], pointers: EVERY }) });
  assert.equal(p.byOp("startfrom").length, 1);
  assert.equal(main(p).querySelector("h1").textContent, word("elsewhere.title"));
  assert.ok(inOrder(text(p), [word("elsewhere.says"), word("elsewhere.records_nothing")]));
  assert.deepEqual(heads(p), ["legalaid", "selfhelp", "service", "agency", "representative", "tipline"].map(KIND));
  // Each kind explained by its `_says` (interface-shell R14).
  assert.equal(unesc(main(p).querySelector("section > h2").getAttribute("data-tip")), word("elsewhere.kind.legalaid_says"));
  const agency = main(p).querySelectorAll("section")[3];
  assert.deepEqual(agency.querySelectorAll(".cs-row b").map((b) => b.textContent), ["Civil Rights Department", "Labor Commissioner"], "the profile's order within a kind");
  assert.ok(inOrder(text(p, agency), ["Civil Rights DepartmentWhat Civil Rights Department does.", `${word("elsewhere.reach.phone")} (510) 555-0100 · ${word("elsewhere.reach.web")} help.example.org`,
    word("elsewhere.source", { source: "Civil Rights Department's website", date: dmy("2026-10-02") })]));
  // A web value is an outside link.
  const web = agency.querySelector("a[target=_blank]");
  assert.equal(web.getAttribute("href"), "https://help.example.org/agency");
  assert.equal(web.getAttribute("rel"), "noopener noreferrer");
  // Back to Home; no act.
  assert.equal(main(p).querySelectorAll('a[href="/app"]').at(-1).textContent, word("elsewhere.back"));
  assert.deepEqual(ops(p), []);
  assert.ok(!text(p).includes(word("elsewhere.danger")), "the danger line is the none states'");
});

test("R15 (journey-check R27): a link is drawn by its own label or its site, never by the path of its address: no slug is text; the address itself is the link's target", async () => {
  const slug = "https://www.oaklandca.gov/My-Household/Report-an-Issue-OAK-311";
  const pointers = [
    { kind: "service", name: "Town 311", does: "Takes reports.", contacts: [{ how: "web", value: slug }], source: slug, status: "researched", basis: "2026-10-14" },
    { kind: "service", name: "Legal line", does: "Gives advice.", contacts: [{ how: "web", value: "https://help.example.org/get-legal-help", label: "Legal line website" }], source: "the line's own page", status: "researched", basis: "2026-10-14" },
  ];
  const p = await open("/app/elsewhere", { startfrom: door({ places: ["River Town"], pointers }) });
  const links = main(p).querySelectorAll("a[target=_blank]");
  assert.deepEqual(links.map((a) => a.getAttribute("href")), [slug, "https://help.example.org/get-legal-help"], "the whole address is the target");
  assert.deepEqual(links.map((a) => a.textContent), ["oaklandca.gov", "Legal line website"], "the site, or the profile's own label");
  assert.doesNotMatch(text(p), /Report-an-Issue|My-Household|get-legal-help/, "control: no slug is drawn as text");
  assert.ok(text(p).includes(word("elsewhere.source", { source: "oaklandca.gov", date: dmy("2026-10-14") })), "a source address is drawn as its site");
  assert.ok(text(p).includes(word("elsewhere.source", { source: "the line's own page", date: dmy("2026-10-14") })), "control: a source that is words stays as given");
});

test("R15: control: a profile with one kind draws only that heading", async () => {
  const p = await open("/app/elsewhere", { startfrom: door({ places: ["River Town"], pointers: [P("service", "Town 311")] }) });
  assert.deepEqual(heads(p), [KIND("service")]);
});

test("R15: with no place, \"Nothing listed yet\" and why; with places and no pointer, the places named; both draw the danger line", async () => {
  const none = await open("/app/elsewhere", { startfrom: door({ places: [], pointers: [] }) });
  assert.deepEqual(heads(none), [word("elsewhere.none.head")]);
  assert.ok(inOrder(text(none), [word("elsewhere.none.noplace"), word("elsewhere.danger")]));
  const empty = await open("/app/elsewhere", { startfrom: door({ places: ["River Town", "Lake County"], pointers: [] }) });
  assert.deepEqual(heads(empty), [word("elsewhere.none.head")]);
  assert.ok(text(empty).includes(word("elsewhere.none.says", { place: "River Town, Lake County" })));
  assert.ok(text(empty).includes(word("elsewhere.danger")));
  // A pointer of an unknown kind is no kind's: the places named.
  const odd = await open("/app/elsewhere", { startfrom: door({ places: ["River Town"], pointers: [P("other", "X")] }) });
  assert.deepEqual(heads(odd), [word("elsewhere.none.head")]);
});

test("R15 (interface-shell R10): a pointer of null, or a startfrom that fails, is drawn failed, never as none", async () => {
  for (const startfrom of [door(null), refused("STORE_DID_NOT_ANSWER", null, 502), ok({ ok: true, doors: [], routes: [] })]) {
    const p = await open("/app/elsewhere", { startfrom });
    assert.ok(main(p).querySelector('[data-state="failed"]'));
    assert.ok(!text(p).includes(word("elsewhere.none.head")));
  }
});

test("R15: the record's data is drawn as data, HTML-escaped", async () => {
  const p = await open("/app/elsewhere", { startfrom: door({ places: ["River Town"], pointers: [P("service", "<b>Town</b> & 311", { does: "<img src=x onerror=alert(1)>", contacts: [{ how: "web", value: "javascript:alert(1)" }] })] }) });
  assert.match(text(p), /<b>Town<\/b> & 311/);
  assert.ok(!main(p).querySelector("img"));
  assert.equal(main(p).querySelectorAll("a[target=_blank]").length, 0, "a value that is no web address is no link");
});

test("R16: opening elsewhere records nothing and tells nobody: its only read is startfrom, beside the shell's own, and it sends no act and no wizardprogress", async () => {
  const p = await open("/app/elsewhere", { startfrom: door({ places: ["River Town"], pointers: EVERY }) });
  const SHELL = new Set(SHELL_OPS);
  const mine = [...new Set(p.requests.map((r) => r.op).filter((op) => !SHELL.has(op)))];
  assert.deepEqual(mine, ["startfrom"]);
  // The shell's own reachability read (`aipathready`, interface-shell R20 since T53) aside, nothing but reads.
  assert.deepEqual(p.requests.filter((r) => r.method !== "GET" && !SHELL.has(r.op)).map((r) => r.op), [], "nothing sent but reads");
  assert.equal(p.byOp("wizardprogress").length, 0);
  assert.equal(p.byOp("lookedsince").length, 0, "no look recorded");
});

test("R34: every key elsewhere reads is a word of the list", () => {
  for (const k of screen("elsewhere").words) assert.ok(hasWord(k), k);
});
