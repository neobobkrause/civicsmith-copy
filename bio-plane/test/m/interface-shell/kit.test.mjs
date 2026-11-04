/* interface-shell R27, R31, R39, R44, R46, R47: the kit's T47 calls (a row's name as its reference, appearance, choices
   over record data, the page clock, filling a field, a knock's card), the dock's wizard guide and the ring, a refusal's
   trace, the at-a-glance elements, and the screens' session, fragment and bound controls. */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { REF_SCREENS, interfacePage, interfaceScript, checkGuide } from "../../../src/interface-shell/index.mjs";
import { ADMIN_ACTS } from "../../../src/wizard-scripts/index.mjs";
import { fitSend, boot, ok, refused, ADMIN, STORE_KEY, nestedTips } from "./harness.mjs";
import { ALL, HELD, FRONT, PERSON, DOORBELL, JOIN } from "./screens.fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const ROWS = ok({ items: [{ id: "c1", title: "Minutes <draft>", at: "2026-10-01" }, { id: "c2", title: "Budget", at: "2026-10-02" }] });
const btn = (p, op) => p.root().querySelector(`button[data-act="${op}"]`);

test("R27 cs.rows takes name(item), the HTML of the row's name (a reference), and draws the panel's control beside it, never around it: the name opens the reference's screen, the control the panel (R19); no explanation inside another (R15)", async () => {
  const doc = { id: "document", reads: () => ({}), acts: [], render: (cs) => cs.title() };
  const s = { id: "held", reads: () => ({ h: { op: "heldcaptures" } }), acts: [{ op: "heldrestore", send: fitSend("heldrestore", "{ ids: [el.dataset.id] }") }],
    render: (cs) => cs.state("h", (v) => cs.rows({ id: "t", cols: ["screen.held.name", "screen.held.name"], items: v.items, key: (i) => i.id,
      name: (i) => cs.ref("document", i.id, i.title, [i.at]), cells: (i) => [cs.date(i.at)], acts: (i) => cs.act("heldrestore", { data: { id: i.id } }) })) };
  const p = await boot({ screens: [s, doc], path: "/app/held", plane: { heldcaptures: ROWS } });
  const row = p.root().querySelector("tr.cs-r");
  const ref = row.querySelector("a.cs-ref");
  const ctl = row.querySelector('[data-shell="row"]');
  assert.equal(ref.textContent, "Minutes <draft>");
  assert.equal(ref.closest("button"), null, "the reference is not inside the control");
  assert.equal(ctl.querySelector("a"), null, "nor the control around the reference");
  assert.equal(ctl.getAttribute("aria-label"), "Acts for Minutes <draft>");
  assert.deepEqual(nestedTips(p.root()), []);
  await p.click(ctl);
  assert.equal(row.nextElementSibling.hidden === false || p.root().querySelector("tr.cs-panel").hidden === false, true, "the control opens the panel beneath");
  assert.ok(p.root().querySelector("tr.cs-panel button[data-act='heldrestore']"));
  await p.click(p.root().querySelector("tr.cs-r a.cs-ref"));
  assert.equal(p.location.pathname, "/app/document/c1", "the name opens the reference's screen");
  /* control: the old form (cells for every column, name as text) still draws the control beside the first cell */
  const q = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: ROWS } });
  assert.equal(q.root().querySelector("tr.cs-r .mk-rowname").childNodes[0].textContent, "Minutes <draft>");
});

test("R27 cs.appearance() draws R18's control (Follow my device, Light, Dark), each switching the appearance", async () => {
  const s = { id: "account", reads: () => ({}), acts: [], render: (cs) => "<div id=ap>" + cs.appearance() + "</div>" };
  const p = await boot({ screens: [s], path: "/app/account" });
  const bs = p.doc.getElementById("ap").querySelectorAll("button");
  assert.deepEqual(bs.map((b) => b.textContent), [word("shell.appearance.device"), word("shell.appearance.light"), word("shell.appearance.dark")]);
  assert.equal(bs[0].getAttribute("aria-pressed"), "true");
  await p.click(bs[2]);
  assert.equal(p.doc.documentElement.getAttribute("data-theme"), "dark");
  assert.equal(p.doc.getElementById("ap").querySelectorAll("button")[2].getAttribute("aria-pressed"), "true");
  assert.equal(p.local.get("cs-theme"), "dark");
});

test("R27 cs.choice takes options as words by key or as record data ({value, text}), the text drawn HTML-escaped and never read as a key", async () => {
  const s = { id: "project", reads: () => ({}), acts: [],
    render: (cs) => cs.choice("q", "shell.reason", [{ value: "Q1", text: "Was the <lease> signed?" }, { value: "Q2", text: "rail.home.name" }, ["k", "shell.appearance.dark"]], { value: "Q2" }) };
  const p = await boot({ screens: [s], path: "/app/project/P1" });
  const opts = p.doc.getElementById("q").querySelectorAll("option");
  assert.deepEqual(opts.map((o) => [o.getAttribute("value"), o.textContent]), [["Q1", "Was the <lease> signed?"], ["Q2", "rail.home.name"], ["k", "Dark"]]);
  assert.equal(opts[0].querySelectorAll("lease").length, 0);
  assert.equal(p.doc.getElementById("q").value, "Q2");
});

test("R27 cs.later(ms, fn) calls fn(cs, view) once after ms on the page clock; a timer set before the member leaves the screen, or the page, never fires", async () => {
  const s = { id: "held", reads: () => ({}), acts: [],
    render: (cs, view) => { if (!view.ui.armed) { view.ui.armed = true; cs.later(60000, (c, v) => c.set("fired", (v.ui.fired || 0) + 1)); } return "<p id=n>" + cs.esc(String(view.ui.fired || 0)) + "</p>"; } };
  const home = { id: "home", reads: () => ({}), acts: [], render: (cs) => cs.title() };
  const p = await boot({ screens: [s, home], path: "/app/held" });
  await p.clock.tick(59_999);
  assert.equal(p.doc.getElementById("n").textContent, "0");
  await p.clock.tick(1);
  assert.equal(p.doc.getElementById("n").textContent, "1");
  await p.clock.tick(120_000);
  assert.equal(p.doc.getElementById("n").textContent, "1", "once");
  /* control: left before it fires */
  const q = await boot({ screens: [s, home], path: "/app/held" });
  let fired = 0;
  const watch = { id: "held", reads: () => ({}), acts: [], render: (cs, view) => { if (!view.ui.a) { view.ui.a = 1; cs.later(1000, (c) => c.call("heldcaptures", { query: { late: "1" } })); } return ""; } };
  const r = await boot({ screens: [watch, home], path: "/app/held" });
  await r.click('a[href="/app"]');
  await r.clock.tick(5000);
  assert.equal(r.requests.filter((x) => x.query.late === "1").length, 0, "left the screen: never fires");
  const t = await boot({ screens: [watch, home], path: "/app/held" });
  for (const f of t.win.listeners.pagehide || []) f({});
  await t.clock.tick(5000);
  assert.equal(t.requests.filter((x) => x.query.late === "1").length, 0, "left the page: never fires");
  assert.equal(fired, 0);
  assert.ok(q);
});

test("R27 cs.fill(id, value) sets a field the screen drew over what was typed, and later redraws keep it (a typed value otherwise kept); a label is drawn beside it", async () => {
  const s = { id: "notes", reads: () => ({}), acts: [{ op: "notewrite", send: (view, el, cs) => { cs.fill("t", "A labelled draft", { label: "shell.reason.help" }); return null; } }],
    render: (cs, view) => cs.field("t", "shell.reason", { area: true }) + cs.act("notewrite") + "<p id=r>" + cs.esc(String(view.ui.n || 0)) + "</p>" };
  const p = await boot({ screens: [s], path: "/app/notes" });
  p.doc.getElementById("t").value = "typed";
  await p.click(btn(p, "notewrite"));
  if (p.root().querySelector('[data-shell="reason-send"]')) { p.root().querySelector("[data-slot] textarea").value = "r"; await p.click(p.root().querySelector('[data-shell="reason-send"]')); }
  assert.equal(p.doc.getElementById("t").value, "A labelled draft");
  assert.ok(p.root().querySelector(".cs-draftlabel").textContent.includes(word("shell.reason.help")));
  await p.click('[data-shell="menu"]');
  assert.equal(p.doc.getElementById("t").value, "A labelled draft", "kept by the redraw");
});

test("R27 R47 R66 REF_SCREENS: a knock opens inbox at that knock; a person, proceeding, standard, plan, timeline, money, calculation, case-editor, review-copy, ceremony and docket each open their screen, each with its card shell.card.<kind>; control: an unknown kind opens nothing and has no card", async () => {
  const KINDS = ["knock", "person", "proceeding", "standard", "plan", "timeline", "money", "calculation", "case-editor", "review-copy", "ceremony", "docket"];
  const SCREEN_OF = { knock: "inbox", person: "person", proceeding: "proceeding", standard: "standard", plan: "plan", timeline: "timeline", money: "money", calculation: "calculation",
    "case-editor": "case-editor", "review-copy": "review-copy", ceremony: "ceremony", docket: "docket" };
  assert.deepEqual(KINDS.map((k) => REF_SCREENS[k]), KINDS.map((k) => SCREEN_OF[k]));
  const target = (id) => ({ id, reads: () => ({}), acts: [], render: (cs) => cs.title() });
  const s = { id: "home", reads: () => ({}), acts: [],
    render: (cs) => ["knock", "person", "proceeding", "standard", "plan", "timeline", "money", "calculation", "case-editor", "review-copy", "ceremony", "docket"]
      .map((k, i) => cs.ref(k, "X" + i, "label " + k, ["a fact " + k])).join("") + cs.ref("zzz-unknown", "U1", "label unknown", []) };
  const p = await boot({ screens: [s, ...Object.values(SCREEN_OF).map(target)] });
  const refs = p.root().querySelectorAll("#cs-main a.cs-ref");
  assert.deepEqual(refs.map((a) => a.getAttribute("href")), KINDS.map((k, i) => "/app/" + SCREEN_OF[k] + "/X" + i));
  const tip = (el) => el.getAttribute("data-tip");
  refs.forEach((a, i) => {
    assert.ok(tip(a).includes(word("shell.card." + KINDS[i]).replace(/'/g, "&#39;")), KINDS[i] + ": its card");
    assert.ok(tip(a).includes("a fact " + KINDS[i]), KINDS[i] + ": the screen's facts");
    assert.ok(tip(a).includes(word("shell.card.open")), KINDS[i] + ": opens");
  });
  const unknown = p.root().querySelector("#cs-main .cs-card");
  assert.equal(unknown.localName, "span", "an unknown kind is no link");
  assert.equal(p.root().querySelectorAll("#cs-main a.cs-ref").length, KINDS.length);
  assert.ok(!String(tip(unknown) || "").includes(word("shell.card.open")), "nothing to open");
  /* a kind whose screen is not registered carries its card only (R16) */
  const q = await boot({ screens: [s] });
  assert.equal(q.root().querySelectorAll("#cs-main a.cs-ref").length, 0);
  assert.ok(q.root().querySelectorAll("#cs-main .cs-card").every((c) => !String(tip(c) || "").includes(word("shell.card.open"))));
});

test("R47 ADMIN_ACTS gains personexpunge: drawn only to a member who administers", async () => {
  assert.ok(ADMIN_ACTS.has("personexpunge"));
  const m = await boot({ screens: [PERSON], path: "/app/person/x", plane: { person: ok({ name: "Dana" }), whoami: ok({ ...ADMIN, administer: false, capabilities: ["contribute", "publish"] }) } });
  assert.equal(btn(m, "personexpunge"), null);
  const a = await boot({ screens: [PERSON], path: "/app/person/x", plane: { person: ok({ name: "Dana" }), whoami: ok({ ...ADMIN, capabilities: ["contribute", "publish"] }) } });
  assert.equal(!!btn(a, "personexpunge") || !!a.root().querySelector('[data-phone-act="personexpunge"]'), true);
});

test("R39 R69 a refusal carrying trace is drawn with Reference: <first 8 characters> beside its words; the trace is kept nowhere in the browser", async () => {
  const TRACE = "9f8e7d6c5b4a39281706";
  const p = await boot({ screens: ALL, plane: { projectdirectory: ok({ projects: [] }), promote: refused("SIGNIN_UNAVAILABLE", "Anthropic's sign-in did not answer.", 502, { trace: TRACE }) } });
  p.doc.getElementById("home-title").value = "T";
  await p.click(btn(p, "promote"));
  const slot = p.root().querySelector('[data-slot="m:0"]');
  assert.ok(slot.textContent.includes(word("refusal.reference", { ref: "9f8e7d6c" })));
  assert.ok(!slot.textContent.includes(TRACE), "the first 8 characters only");
  for (const v of [...p.local.values(), ...p.store.values()]) assert.ok(!String(v).includes(TRACE.slice(0, 8)));
  /* a read's refusal likewise; control: a refusal with no trace draws no reference */
  const q = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: refused("NOT_ALLOWED", "No.", 403, { trace: TRACE }) } });
  assert.ok(q.root().querySelector('[data-state="failed"]').textContent.includes(word("refusal.reference", { ref: "9f8e7d6c" })));
  const r = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: refused("NOT_ALLOWED", "No.") } });
  assert.ok(!r.root().querySelector('[data-state="failed"]').textContent.includes(word("refusal.reference", { ref: "" })));
});

const GUIDE = {
  words: [["screen.guide.step", "Step {i} of {n}", false]],
  ops: ["wizardsat"],
  acts: [{ op: "wizarddraft", send: fitSend("wizarddraft", "{ recorded: view.ui.heard || [] }") }],
  render(cs, view) { return view.ui.running ? "<p id=g>" + cs.w("screen.guide.step", { i: String(view.ui.step || 1), n: "2" }) + "</p>" + cs.act("wizarddraft", { label: "screen.guide.step", fills: { i: "1", n: "2" } }) : ""; },
  marks(cs, view) { return '<p id=marks data-ui="' + cs.esc(JSON.stringify(view.ui)) + '">' + cs.esc(String(view.screen)) + "</p>"; },
  start(cs, view, o) { view.ui.running = o.script; view.ui.version = o.version; view.ui.o = o; },
  entered(cs, view, at) { cs.set("entered", (view.ui.entered || []).concat([at.screen])); },
  pressed(cs, view, p) { cs.set("heard", (view.ui.heard || []).concat([p])); },
  ring(cs, view) { cs.set("again", (view.ui.again || 0) + 1); },
};
const HELDROWS = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }] });

test("R31 (K3143) the dock holds one panel: the guide's while it draws one, in place of the assistant's (no close control), the assistant's returning when it ends; cs.wizard calls the guide's start from any screen", async () => {
  const starter = { id: "home", reads: () => ({}), acts: [{ op: "startfrom", send: (view, el, cs) => { cs.wizard("WIZ-1", 2, { at: "home" }); return null; } }], render: (cs) => cs.act("startfrom") };
  const p = await boot({ screens: [starter, ...ALL.filter((s) => s.id !== "home")], guide: GUIDE, plane: { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
  await p.click('.cs-mast [data-shell="dock"]');
  assert.equal(p.root().querySelector(".cs-dock").getAttribute("data-panel"), "assistant");
  await p.click(btn(p, "startfrom"));
  if (p.root().querySelector('[data-shell="reason-send"]')) { p.root().querySelector("[data-slot] textarea").value = "r"; await p.click(p.root().querySelector('[data-shell="reason-send"]')); }
  const dock = p.root().querySelector(".cs-dock");
  assert.equal(dock.getAttribute("data-panel"), "guide");
  assert.equal(p.doc.getElementById("g").textContent, "Step 1 of 2");
  assert.equal(dock.querySelector('[data-shell="dock"]'), null, "no close control: Stop is the guide's");
  assert.equal(p.root().querySelectorAll(".cs-dock").length, 1, "one panel at a time");
  /* the guide's own act is drawn and sent as a screen's */
  await p.click(dock.querySelector('button[data-act="wizarddraft"]'));
  if (p.root().querySelector('[data-shell="reason-send"]')) { p.root().querySelector("[data-slot] textarea").value = "r"; await p.click(p.root().querySelector('[data-shell="reason-send"]')); }
  assert.equal(p.byOp("wizarddraft").length, 1);
  /* the guide's page-memory view carries the start's arguments; it ends by drawing nothing */
  const q = await boot({ screens: ALL, guide: { ...GUIDE, render: (cs, view) => (view.ui.running && !view.ui.stopped ? "<p id=g>run</p>" : ""), start: (cs, view, o) => { view.ui.running = o.script; } } });
  assert.equal(q.root().querySelector(".cs-dock"), null, "no wizard, no guide panel");
  /* control: no guide given, cs.wizard answers false and nothing is drawn */
  const r = await boot({ screens: [starter] });
  await r.click(btn(r, "startfrom"));
  assert.equal(r.root().querySelector(".cs-dock"), null);
});

test("R31 R59 (K3143) the guide's marks are drawn in the title row of every working screen, after its heading; entered is called once the screen's reads settle; pressed hears each act by its op and screen only, never a value", async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  const p = await boot({ screens: ALL, guide: GUIDE, path: "/app/held", plane: { heldcaptures: async () => { await slow; return HELDROWS; } } });
  const main = p.root().querySelector("#cs-main");
  assert.equal(main.children[0].localName, "nav");
  const row = main.children[1];
  assert.ok(row.classList.contains("mk-titlerow"), "R59: the title row, never a block above the path or the heading");
  assert.equal(row.children[0].localName, "h1");
  assert.equal(row.children[1].getAttribute("data-guide-from"), "marks", "after the heading, held as the guide's (R51)");
  assert.equal(row.children[1].children[0].id, "marks");
  assert.equal(p.doc.getElementById("marks").textContent, "held");
  assert.equal(GUIDE_UI(p).entered, undefined, "not before the reads settle");
  release();
  await p.settle();
  assert.deepEqual(GUIDE_UI(p).entered, ["held"]);
  await p.click(p.root().querySelector('[data-shell="row"]'));
  await p.click(btn(p, "heldrestore"));
  const heard = GUIDE_UI(p).heard;
  assert.deepEqual(heard, [{ op: "heldrestore", screen: "held" }]);
});
/* the guide's view.ui, read back through the marks it draws */
const GUIDE_UI = (p) => JSON.parse(p.doc.getElementById("marks").getAttribute("data-ui"));

test("R31 cs.ring(op) finds the control the screen drew for op, opens the row panel holding it, draws the ring and its label (\"Press here when you're ready\" on a button), scrolls it into view and focuses it; an act the screen does not draw answers false; Alt+Shift+W asks the guide to ring again; the shell never presses it", async () => {
  const q = await boot({ screens: [{ id: "held", reads: () => ({ h: { op: "heldcaptures" } }), acts: [{ op: "heldrestore", send: fitSend("heldrestore") }, { op: "heldsetaside", send: (view, el, cs) => { cs.wizard("W", 1); return null; } }],
    render: (cs) => cs.act("heldsetaside") + cs.state("h", (v) => cs.rows({ id: "t", cols: ["screen.held.name"], items: v.items, key: (i) => i.id, name: (i) => i.title, cells: (i) => [cs.esc(i.title)], acts: () => cs.act("heldrestore") })) }],
    path: "/app/held", plane: { heldcaptures: HELDROWS }, guide: { ...GUIDE, render: () => "", start(cs, view) { view.ui.r = [cs.ring("heldrestore"), cs.ring("retire")]; } } });
  await q.click(btn(q, "heldsetaside"));
  if (q.root().querySelector('[data-shell="reason-send"]')) { q.root().querySelector("[data-slot] textarea").value = "r"; await q.click(q.root().querySelector('[data-shell="reason-send"]')); }
  const ringed = q.root().querySelector('button[data-act="heldrestore"]');
  assert.equal(q.root().querySelector("tr.cs-panel").hidden, false, "its row panel opened");
  assert.ok(ringed.classList.contains("cs-target"), "the design's ring");
  assert.equal(ringed.previousElementSibling.textContent, word("shell.ring.ready"));
  assert.ok(q.doc.activeElement === ringed, "focused");
  assert.ok(q.doc.scrolledTo && q.doc.scrolledTo.getAttribute("data-act") === "heldrestore", "scrolled into view");
  assert.equal(q.byOp("heldrestore").length, 0, "never pressed");
  /* Alt+Shift+W */
  const r = await boot({ screens: ALL, path: "/app/held", plane: { heldcaptures: HELDROWS }, guide: GUIDE });
  r.fire(r.doc.body, "keydown", { key: "W", altKey: true, shiftKey: true });
  await r.settle();
  assert.equal(GUIDE_UI(r).again, 1);
  /* control: the act the screen does not draw answers false */
  const t = await boot({ screens: [{ id: "held", reads: () => ({}), acts: [{ op: "heldsetaside", send: (view, el, cs) => { cs.set("r", String(cs.ring("heldrestore"))); return null; } }], render: (cs, view) => cs.act("heldsetaside") + "<p id=r>" + cs.esc(view.ui.r || "") + "</p>" }], path: "/app/held" });
  await t.click(btn(t, "heldsetaside"));
  if (t.root().querySelector('[data-shell="reason-send"]')) { t.root().querySelector("[data-slot] textarea").value = "r"; await t.click(t.root().querySelector('[data-shell="reason-send"]')); }
  assert.equal(t.doc.getElementById("r").textContent, "false");
});

test("R46 view.session tells a screen the session's state and handle; view.fragment carries the fragment read once; cs.signin with stay keeps the screen signed in, without it opens the kept page or Home", async () => {
  const p = await boot({ screens: [...ALL, FRONT], path: "/app/held", session: null });
  assert.equal(p.doc.getElementById("state").textContent, "fx t state none");
  const q = await boot({ screens: [...ALL, FRONT], path: "/app/held", session: { t: "t", e: 0, d: "own", w: "rosa" }, plane: { heldcaptures: refused("X", null, 401) } });
  assert.equal(q.doc.getElementById("state").textContent, "fx t state ended");
  assert.equal(q.doc.getElementById("f-handle").value, "rosa");
  const live = { id: "home", reads: () => ({}), acts: [], render: (cs, view) => "<p id=s>" + cs.esc(view.session.state + "/" + view.session.handle) + "</p>" };
  const r = await boot({ screens: [live] });
  assert.equal(r.doc.getElementById("s").textContent, "live/mai");
});

test("R46 R47 cs.signout({label}), cs.save(name, text, {label}) and cs.copy(text, {label}) each answer their own bound control; cs.signedOut() clears the record and draws front signed out", async () => {
  const copied = [];
  const s = { id: "recovery", reads: () => ({}), acts: [{ op: "recoverycodesissue", send: (view, el, cs) => { cs.signedOut(); return null; } }],
    render: (cs) => "<div id=c>" + cs.save("codes.txt", "AAA-111\nBBB-222", { label: "shell.reason" }) + cs.copy("AAA-111") + cs.signout() + "</div>" + cs.act("recoverycodesissue") };
  const p = await boot({ screens: [s, FRONT], path: "/app/recovery" });
  p.win.navigator = { clipboard: { writeText: (t) => copied.push(t) } };
  const [save, copy, out] = p.doc.getElementById("c").querySelectorAll("button");
  assert.deepEqual([save.textContent, copy.textContent, out.textContent], [word("shell.reason"), word("shell.copy"), word("shell.signout")]);
  await p.click(save);
  assert.equal(p.files.length, 1);
  assert.equal(p.files[0].name, "codes.txt");
  assert.equal(await p.files[0].blob.text(), "AAA-111\nBBB-222");
  assert.equal(p.objectUrls[0].released, true);
  await p.click(copy);
  assert.deepEqual(copied, ["AAA-111"]);
  for (const r of p.requests) assert.ok(!JSON.stringify(r).includes("AAA-111"), "made in the page, never sent");
  await p.click(out);
  assert.equal(p.byOp("signout").length, 1);
  assert.equal(p.local.has(STORE_KEY), false);
  assert.equal(p.doc.getElementById("state").textContent, "fx t state signedout");
  /* cs.signedOut: no signout op of its own */
  const q = await boot({ screens: [s, FRONT], path: "/app/recovery", plane: { whoami: ok({ ...ADMIN }) } });
  const b = btn(q, "recoverycodesissue");
  if (b) {
    await q.click(b);
    const go = q.root().querySelector('[data-shell="reason-send"], [data-shell="confirm"]');
    if (go) { const ta = q.root().querySelector("[data-slot] textarea"); if (ta) ta.value = "r"; await q.click(go); }
    assert.equal(q.byOp("signout").length, 0);
    assert.equal(q.local.has(STORE_KEY), false);
    assert.equal(q.doc.getElementById("state").textContent, "fx t state signedout");
  }
});

test("R44 the at-a-glance elements: a reading, activity, people, next steps, the story so far and the status strip, each drawn once as the visual language draws them", async () => {
  const s = { id: "home", reads: () => ({}), acts: [{ op: "promote" }],
    render: (cs) => "<div id=r>" + cs.reading({ label: "rail.queue.name", value: 12, change: { text: "3 more than last week" }, bars: [1, 2, 3, 4, 5, 6, 7, 8] }) + "</div>"
      + "<div id=a>" + cs.activity([0, 1, 0, 2, 3, 1, 4, 6], "shell.glance.busy") + "</div>"
      + "<div id=i>" + cs.initials(["mai", "rosa", "dev", "ana", "lee", "kim"]) + "</div>"
      + "<div id=n>" + cs.path([{ text: "rail.add.name", act: cs.act("promote") }, { text: { text: "Ask the clerk" }, now: true }]) + "</div>"
      + "<div id=t>" + cs.storyline([{ date: "2026-09-01", text: { text: "The council voted" } }, { date: null, text: { text: "Undated" } }, { date: "2026-09-10", text: { text: "We asked" }, us: true }], { open: { screen: "timeline", subject: "P1" } }) + "</div>"
      + "<div id=s>" + cs.strip([1, 2, 3, 4, 5].map((n) => ({ n, label: { text: "item " + n }, screen: "queue" }))) + "</div>" };
  const p = await boot({ screens: [s] });
  const $ = (id) => p.doc.getElementById(id);
  assert.equal($("r").querySelector(".k").textContent, "Queue");
  assert.equal($("r").querySelector(".v").textContent, "12");
  assert.equal($("r").querySelector(".d").textContent, "3 more than last week");
  assert.equal($("r").querySelectorAll(".mk-spark i").length, 8);
  assert.ok($("r").querySelector(".mk-tile"), "R56: the design's classes");
  const bars = $("a").querySelectorAll(".mk-spark i");
  assert.equal(bars.length, 8);
  assert.ok(bars[7].classList.contains("now"), "the newest week darker");
  assert.equal($("a").querySelector("b").textContent, "busy");
  assert.ok($("a").querySelector(".mk-spark").getAttribute("aria-label").includes("0, 1, 0, 2, 3, 1, 4, 6"));
  assert.deepEqual($("i").querySelectorAll("i").map((x) => x.textContent), ["M", "R", "D", "A", "+2"], "at most four, then the count");
  assert.equal($("i").querySelector(".mk-people > span").textContent, "6");
  const steps = $("n").querySelectorAll("li");
  assert.equal(steps.length, 2);
  assert.ok(steps[0].querySelector('button[data-act="promote"]'), "each step the act itself");
  assert.equal(steps[1].getAttribute("aria-current"), "step");
  const evs = $("t").querySelectorAll(".ev");
  assert.equal(evs.length, 2, "undated things never placed");
  assert.ok(!evs[0].classList.contains("us") && evs[1].classList.contains("us"));
  assert.equal($("t").querySelector("a").getAttribute("href"), "/app/timeline/P1");
  /* control: a strip handed five readings draws four */
  assert.equal($("s").querySelectorAll("a").length, 4);
  /* at the phone width, one chip */
  const q = await boot({ screens: [s], phone: true });
  const chip = q.doc.getElementById("s").querySelectorAll("a");
  assert.equal(chip.length, 1);
  assert.ok(chip[0].textContent.startsWith("10"), "the four's sum");
});

test("R31 (K3143) checkGuide: the guide's ops and acts each an op OPS holds; interfacePage throws, naming the guide, for one that is not", () => {
  assert.equal(checkGuide(GUIDE), true);
  assert.throws(() => interfacePage(ALL, { guide: { ...GUIDE, ops: ["nosuchop"] } }), /guide.*nosuchop.*OPS/);
  assert.throws(() => interfacePage(ALL, { guide: { ...GUIDE, acts: [{ op: "zz" }] } }), /guide.*zz/);
  assert.throws(() => interfacePage(ALL, { guide: { ...GUIDE, render: undefined } }), /guide/);
  assert.ok(interfaceScript(ALL, { guide: GUIDE }).includes("wizardsat"));
});

test("R49 cs.image(op, params, {alt}) fetches the image with the session's Authorization header and draws it from an object address the page made, never a credential in an address; released when the screen closes; control: a refusal draws no image", async () => {
  const { bytes } = await import("./harness.mjs");
  const s = { id: "open-file", reads: () => ({}), acts: [], render: (cs) => cs.image("openoriginal", { capture: "ab12" }, { alt: { text: "A photo of the site" } }) };
  const home = { id: "home", reads: () => ({}), acts: [], render: (cs) => cs.title() };
  const p = await boot({ screens: [s, home], path: "/app/open-file/ab12", plane: { openoriginal: bytes("PNGDATA", "image/png") } });
  const img = p.root().querySelector("img.mk-image");
  assert.equal(img.getAttribute("alt"), "A photo of the site");
  assert.equal(img.getAttribute("data-image"), "ok");
  assert.match(img.getAttribute("src"), /^blob:https:\/\/group\.example\//);
  const req = p.byOp("openoriginal")[0];
  assert.equal(req.headers.Authorization, "Bearer tok-1");
  assert.equal(req.query.capture, "ab12");
  assert.ok(!img.getAttribute("src").includes("tok-1"));
  assert.equal(p.byOp("openoriginal").length, 1, "fetched once across redraws");
  await p.click('[data-shell="menu"]');
  assert.equal(p.byOp("openoriginal").length, 1);
  await p.click('a[href="/app"]');
  assert.equal(p.objectUrls[0].released, true, "released when the screen closes");
  const q = await boot({ screens: [s], path: "/app/open-file/ab12", plane: { openoriginal: refused("NOT_VISIBLE") } });
  assert.equal(q.root().querySelector("img.mk-image").getAttribute("src"), null);
  assert.equal(q.root().querySelector("img.mk-image").getAttribute("data-image"), "failed");
});

test("R49 cs.areas draws rectangles over the image by pointer and by keyboard (added, moved, resized, removed), cs.value(id) answering [{left, top, width, height}] in the image's pixels", async () => {
  const { bytes } = await import("./harness.mjs");
  const s = { id: "ceremony", reads: () => ({}), acts: [{ op: "obscuremark", send: fitSend("obscuremark", "{ areas: cs.value('ph') }") }],
    render: (cs) => cs.areas(cs.image("openoriginal", { capture: "p1" }, { alt: { text: "Photo" } }), { id: "ph", areas: [{ left: 10, top: 20, width: 30, height: 40 }], label: { text: "Areas on the photo" } }) + cs.act("obscuremark") };
  const p = await boot({ screens: [s], path: "/app/ceremony/c1", plane: { openoriginal: bytes("PNG", "image/png") } });
  const box = () => p.root().querySelector('[data-shell="areas-box"]');
  /* the image is 1000 by 500 pixels, drawn 500 by 250 on the screen */
  const size = () => { const img = box().querySelector("img"); img.naturalWidth = 1000; img.naturalHeight = 500; box().getBoundingClientRect = () => ({ left: 100, top: 50, width: 500, height: 250 }); };
  size();
  assert.equal(p.doc.getElementById("ph").getAttribute("aria-label"), "Areas on the photo");
  assert.equal(p.root().querySelectorAll(".mk-imgarea").length, 1);
  /* drawn with the pointer: from (150, 100) to (250, 150) on the screen is (100, 100) to (300, 200) in the image */
  p.fire(box(), "pointerdown", { clientX: 150, clientY: 100 });
  for (const f of p.win.listeners.pointermove || []) f({ clientX: 250, clientY: 150 });
  for (const f of [...(p.win.listeners.pointerup || [])]) f({ clientX: 250, clientY: 150 });
  await p.settle();
  size();
  assert.equal(p.root().querySelectorAll(".mk-imgarea").length, 2);
  /* added, moved and resized by the keyboard, and one removed */
  await p.click('[data-shell="area-add"]');
  size();
  const third = () => p.root().querySelector('.mk-imgarea[data-i="2"]');
  third().focus();
  p.fire(third(), "keydown", { key: "ArrowRight" }); await p.settle(); size();
  p.fire(third(), "keydown", { key: "ArrowDown", shiftKey: true }); await p.settle(); size();
  p.fire(p.root().querySelector('.mk-imgarea[data-i="0"]'), "keydown", { key: "Delete" }); await p.settle(); size();
  await p.click('button[data-act="obscuremark"]');
  const go = p.root().querySelector('[data-shell="reason-send"], [data-shell="confirm"]');
  if (go) { const ta = p.root().querySelector("[data-slot] textarea"); if (ta) ta.value = "r"; await p.click(go); }
  assert.deepEqual(p.byOp("obscuremark")[0].body.areas, [{ left: 100, top: 100, width: 200, height: 100 }, { left: 410, top: 200, width: 200, height: 110 }]);
  /* control: nothing drawn, nothing answered but what was given */
  const q = await boot({ screens: [{ ...s, render: (cs) => cs.areas("", { id: "ph" }) + cs.act("obscuremark") }], path: "/app/ceremony/c1" });
  await q.click('button[data-act="obscuremark"]');
  const go2 = q.root().querySelector('[data-shell="reason-send"], [data-shell="confirm"]');
  if (go2) { const ta = q.root().querySelector("[data-slot] textarea"); if (ta) ta.value = "r"; await q.click(go2); }
  assert.deepEqual(q.byOp("obscuremark")[0].body.areas, []);
});

test("R49 cs.choice with {acts: {<value>: op}} drives the act it governs: one button whose label and act follow the choice (control: without acts, no button)", async () => {
  const s = { id: "ceremony", reads: () => ({}), acts: [{ op: "caseratify" }, { op: "publishat" }],
    render: (cs, view) => cs.choice("when", "shell.reason", [{ value: "now", text: "Record datum one" }, { value: "at", text: "Record datum two" }], { acts: { now: "caseratify", at: "publishat" } })
      + "<p id=chosen>" + cs.esc(view.ui["choice:when"] || "") + "</p>" + cs.choice("plain", "shell.reason", [{ value: "x", text: "Record datum three" }]) };
  const p = await boot({ screens: [s], path: "/app/ceremony/c1", plane: { whoami: ok({ ...ADMIN, capabilities: ["contribute", "publish"] }) } });
  const acts = () => p.root().querySelectorAll("button[data-act], [data-phone-act]").map((b) => b.getAttribute("data-act") || b.getAttribute("data-phone-act"));
  assert.deepEqual(acts(), ["caseratify"]);
  assert.equal(p.doc.getElementById("chosen").textContent, "now");
  const sel = p.doc.getElementById("when");
  sel.value = "at";
  p.fire(sel, "change");
  await p.settle();
  assert.deepEqual(acts(), ["publishat"], "one button, following the choice");
  assert.equal(p.doc.getElementById("chosen").textContent, "at");
  assert.equal(p.doc.getElementById("when").value, "at");
  assert.equal(p.doc.getElementById("plain").getAttribute("data-shell"), null, "control: a plain choice drives nothing");
});

test("R46 (K3147) view.fragment carries grant for review-outside, read once and removed from the address before any request", async () => {
  const review = { id: "review-outside", reads: () => ({}), acts: [], render: (cs, view) => "<p id=g>" + cs.esc(view.fragment.grant || "") + "</p>" };
  const p = await boot({ screens: [review], path: "/app/review", hash: "#grant=GRANT-SECRET-1", session: null });
  assert.equal(p.doc.getElementById("g").textContent, "GRANT-SECRET-1");
  assert.equal(p.location.hash, "");
  for (const r of p.requests) assert.ok(!JSON.stringify(r).includes("GRANT-SECRET-1"));
});

test("R50 ADMIN_ACTS names the reset link, signerset, the group's settings, places and offices, translators and security tools: none drawn to a member who does not administer; at the phone width op-grades' larger-screen acts (filingsent, filingrecordsent) are held with what they do and where to finish them", async () => {
  /* every op the shell holds back from a member who does not administer is an op its owner declares (OPS) */
  for (const op of ADMIN_ACTS) assert.ok(Object.hasOwn(OPS, op), op + ": declared by its owner");
  const g = { id: "group", reads: () => ({}), acts: [{ op: "groupnameset" }, { op: "courtnoticeset" }], render: (cs) => cs.act("groupnameset") + cs.act("courtnoticeset") };
  const m = await boot({ screens: [g], path: "/app/group" });
  assert.equal(btn(m, "groupnameset"), null);
  assert.equal(btn(m, "courtnoticeset"), null);
  const a = await boot({ screens: [g], path: "/app/group", plane: { whoami: ok(ADMIN) } });
  assert.ok(btn(a, "groupnameset") || a.root().querySelector('[data-phone-act="groupnameset"]'));
  const r = { id: "request", reads: () => ({}), acts: [{ op: "filingrecordsent" }, { op: "actioncreate" }], render: (cs) => cs.act("filingrecordsent") + cs.act("actioncreate") };
  const wide = await boot({ screens: [r], path: "/app/request/x", plane: { whoami: ok({ ...ADMIN, capabilities: ["contribute", "publish", "act"] }) } });
  const phone = await boot({ screens: [r], path: "/app/request/x", phone: true, plane: { whoami: ok({ ...ADMIN, capabilities: ["contribute", "publish", "act"] }) } });
  if (btn(wide, "filingrecordsent")) {
    assert.equal(btn(phone, "filingrecordsent"), null);
    const held = phone.root().querySelector('[data-phone-act="filingrecordsent"]');
    assert.ok(held.textContent.includes(word("shell.phone.larger")));
  }
  /* control: an everyday act is still a phone act */
  assert.equal(!!btn(phone, "actioncreate"), !!btn(wide, "actioncreate"));
});

test("R50 (K3156) at the phone width every weighed act op-grades.phoneOf answers false for is held (terminal, attested, irreversible rungs); never an act run on press: knock, enroll and recover stay on the phone", async () => {
  const who = ok({ ...ADMIN, capabilities: ["contribute", "publish", "act", "ratify", "attest"] });
  const c = { id: "ceremony", reads: () => ({}), acts: [{ op: "publish" }, { op: "publishat" }, { op: "caseratify" }, { op: "obscuremark" }],
    render: (cs) => cs.act("publish") + cs.act("publishat") + cs.act("caseratify") + cs.act("obscuremark") };
  const wide = await boot({ screens: [c], path: "/app/ceremony/x", plane: { whoami: who } });
  const phone = await boot({ screens: [c], path: "/app/ceremony/x", phone: true, plane: { whoami: who } });
  for (const op of ["publish", "publishat", "caseratify"]) {
    assert.ok(btn(wide, op), op + " is drawn on a wide screen");
    assert.equal(btn(phone, op), null, op + " is not sent from the phone");
    assert.ok(phone.root().querySelector(`[data-phone-act="${op}"]`).textContent.includes(word("shell.phone.larger")), op);
  }
  /* control: an act op-grades leaves on the phone is still a phone act */
  assert.equal(!!btn(phone, "obscuremark"), !!btn(wide, "obscuremark"));
  /* control: the credential acts R11 runs on press are never held, phoneOf notwithstanding */
  const forgot = { id: "forgot", reads: () => ({}), acts: [{ op: "recover" }], render: (cs) => cs.act("recover") };
  for (const [screens, path, op] of [[[DOORBELL], "/app/doorbell", "knock"], [[JOIN], "/app/join", "enroll"], [[forgot], "/app/forgot", "recover"]]) {
    const p = await boot({ screens, path, phone: true, session: null });
    assert.ok(btn(p, op), op + " is a phone act");
    assert.equal(p.root().querySelector(`[data-phone-act="${op}"]`), null, op);
    const mk = btn(p, op).querySelector(".w");
    assert.ok(!mk || mk.hasAttribute("data-mark"), op + " carries no weight, only R64's mark (R77: none at Reversible)");
  }
});

/* R51: a guide whose panel and marks draw its own controls, recording what `control` hears */
const STEPPER = {
  words: [["screen.guide.s.next", "Next", false], ["screen.guide.s.back", "Back", false], ["screen.guide.s.stop", "Stop", false]],
  ops: [], acts: [],
  render(cs, view) {
    return '<p id="heard">' + cs.esc(JSON.stringify(view.ui.heard || [])) + "</p>"
      + '<button type="button" data-guide="next" data-step="2" data-script-id="W-1">' + cs.w("screen.guide.s.next") + "</button>"
      + '<button type="button" data-guide="back">' + cs.w("screen.guide.s.back") + "</button>"
      + '<span tabindex="0" role="button" data-guide="stop" data-why="done">' + cs.w("screen.guide.s.stop") + "</span>";
  },
  marks() { return '<button type="button" id="mark-next" data-guide="next" data-from="marks">' + "Next" + "</button>"; },
  control(cs, view, control, dataset) { cs.set("heard", (view.ui.heard || []).concat([[control, dataset]])); },
};
const heardOf = (p) => JSON.parse(p.doc.getElementById("heard").textContent);

test("R51 (K3156) an element the guide draws with data-guide is handled on click, Enter or Space by GUIDE.control(cs, view, control, dataset), its data-* as the dataset; Next, Back and Stop reach it, from the panel and the marks; no request is sent", async () => {
  const p = await boot({ screens: ALL, guide: STEPPER, path: "/app/held", plane: { heldcaptures: ok({ items: [] }) } });
  const dock = () => p.root().querySelector('.cs-dock[data-panel="guide"]');
  assert.ok(dock());
  const before = p.requests.length;
  await p.click(dock().querySelector('[data-guide="next"]'));
  p.fire(dock().querySelector('[data-guide="back"]'), "keydown", { key: "Enter" });
  await p.settle();
  p.fire(dock().querySelector('[data-guide="stop"]'), "keydown", { key: " " });
  await p.settle();
  await p.click(p.doc.getElementById("mark-next"));
  assert.deepEqual(heardOf(p), [
    ["next", { guide: "next", step: "2", scriptId: "W-1" }],
    ["back", { guide: "back" }],
    ["stop", { guide: "stop", why: "done" }],
    ["next", { guide: "next", from: "marks" }],
  ]);
  assert.equal(p.requests.length, before, "no op is sent");
  assert.equal(p.location.pathname, "/app/held", "and nothing else happens");
  /* a key pressed and the click the browser makes of it are one press */
  const nb = dock().querySelector('[data-guide="back"]');
  p.fire(nb, "keydown", { key: "Enter" });
  p.fire(nb, "click", { detail: 0 });
  await p.settle();
  assert.equal(heardOf(p).length, 5);
});

test("R51 (K3156) control: a data-guide element the screen draws, not the guide, reaches no GUIDE.control", async () => {
  const s = { id: "held", reads: () => ({}), acts: [], render: () => '<button type="button" id="own" data-guide="next">x</button>' };
  const p = await boot({ screens: [s], guide: STEPPER, path: "/app/held" });
  await p.click(p.doc.getElementById("own"));
  p.fire(p.doc.getElementById("own"), "keydown", { key: "Enter" });
  await p.settle();
  assert.deepEqual(heardOf(p), []);
  /* a guide without control: its data-guide element does nothing and sends nothing */
  const q = await boot({ screens: ALL, guide: { ...STEPPER, control: undefined }, path: "/app/held", plane: { heldcaptures: ok({ items: [] }) } });
  const n = q.requests.length;
  await q.click(q.root().querySelector('.cs-dock [data-guide="next"]'));
  assert.equal(q.requests.length, n);
  assert.throws(() => interfacePage(ALL, { guide: { ...STEPPER, control: "no" } }), /guide's control/);
});
