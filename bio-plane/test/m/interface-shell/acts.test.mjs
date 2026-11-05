/* interface-shell R11, R12, R13 and R21's act contract: weight and friction, the gate, refusals beside the act. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT } from "../../../src/op-grades/index.mjs";
import { NEEDS, SESSION_OPS } from "../../../src/op-declarations/index.mjs";
import { declaredFit, fitSend, boot, ok, refused, refusedIn, httpError, silent, pending, bytes, MEMBER, ADMIN } from "./harness.mjs";
import { ALL, HOME, HELD, FIXTURE_WORDS } from "./screens.fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const IMAGE = ok({ title: "A lease", pages: 3, grade: "B", why: "w", project: { id: "P1", title: "Pothole repairs" }, passages: [{ n: 1, text: "Closed" }] });
const HELDA = ok({ items: [{ id: "h1", title: "Minutes", at: "2026-10-01" }, { id: "h2", title: "Budget", at: "2026-10-02" }] });
const PLANE = { image: IMAGE, heldcaptures: HELDA };
const btn = (p, op) => p.root().querySelector(`button[data-act="${op}"]`);

test("R11 each act is a button labelled act.<op>.label.<screen>, carrying its weight's pips and name from op-grades' RUNGS (attested drawn as Signed)", async () => {
  assert.equal(RUNGS.cite, "reversible"); assert.equal(RUNGS.retire, "terminal"); assert.equal(RUNGS.attest, "attested"); assert.equal(RUNGS.release, "reasoned");
  assert.equal(RUNGS.promote, undefined);
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE });
  /* R77: a Reversible act draws no dots and no weight name; the rest draw them */
  const cases = [["retire", word("weight.terminal.name"), 3], ["attest", word("weight.signed.name"), 4], ["release", word("weight.reasoned.name"), 2]];
  for (const [op, name, on] of cases) {
    const b = btn(p, op);
    assert.equal(b.localName, "button");
    assert.equal(b.querySelector(".w").textContent, name, op);
    assert.equal(b.querySelectorAll(".cs-pips i.on").length, on, op);
    assert.ok(b.getAttribute("data-tip").includes(name + ":"), op);
  }
  assert.ok(btn(p, "cite").textContent.startsWith(word("act.cite.label.document")));
  assert.equal(btn(p, "cite").querySelector(".w"), null, "R77: a Reversible act draws no weight");
  assert.equal(btn(p, "cite").querySelectorAll(".cs-pips").length, 0);
  assert.ok(!(btn(p, "cite").getAttribute("data-tip") || "").includes(word("weight.reversible.name")), "nor in its explanation");
  /* R64 amends: promote, RUNG_ABSENT under substrate, carries no weight of its own, only the design kit's mark; (fix round 2, C76) the
     kit's mark is Reasoned and the shell asks no reason for it, so it is not drawn: the mark and the asking agree */
  const h = await boot({ screens: ALL, plane: PLANE });
  assert.equal(btn(h, "promote").querySelector(".w"), null, "C76: marked Reasoned, asking nothing, so no mark is drawn");
  assert.ok(btn(h, "promote").textContent.startsWith(word("act.promote.label.home")));
});

test("R11 (K3002) an op in RUNG_ABSENT under `undetermined`, or one neither table names, is drawn and frictioned as reasoned; under substrate, credential, caller-owned or observational it carries no weight mark and runs on press", async () => {
  assert.equal(RUNG_ABSENT.captureupload.ground, "undetermined");
  assert.equal(RUNG_ABSENT.openoriginal.ground, "observational");
  assert.equal(RUNG_ABSENT.memberadd.ground !== "undetermined", true);
  const s = { id: "capture", reads: () => ({}), acts: [{ op: "captureupload" }, { op: "acquire" }], render: (cs) => cs.act("captureupload") + cs.act("acquire") };
  const p = await boot({ screens: [s], path: "/app/capture" });
  assert.equal(btn(p, "captureupload").querySelector(".w").textContent, word("weight.reasoned.name"));
  await p.click(btn(p, "captureupload"));
  assert.equal(p.byOp("captureupload").length, 0, "asks a reason first");
  assert.ok(p.root().querySelector('[data-slot="m:0"] textarea'));
  const o = { id: "open-file", reads: () => ({}), acts: [{ op: "openoriginal", send: fitSend("openoriginal") }], render: (cs) => cs.act("openoriginal") };
  const q = await boot({ screens: [o], path: "/app/open-file/ab" });
  /* R64, R77: its kit mark is Reversible, so none is drawn; it runs on press */
  assert.equal(btn(q, "openoriginal").querySelector(".w"), null);
  await q.click(btn(q, "openoriginal"));
  assert.equal(q.byOp("openoriginal").length, 1, "runs on press");
  const a = await boot({ screens: ALL, path: "/app/members", plane: { whoami: ok(ADMIN) } });
  await a.click(btn(a, "memberadd"));
  assert.equal(a.byOp("memberadd").length, 0, "memberadd, an administrator's act marked Reasoned, asks its reason first (R107)");
  assert.ok(a.root().querySelector('[data-shell="reason-send"]'), "the reason box is open");
});

test("R11 (DEC-88) a reasoned act whose screen names a reasonField sends the member's own words in that field as its reason and asks no second one; with that field empty it sends nothing and says so", async () => {
  const s = { id: "held", reads: () => ({}), acts: [{ op: "heldsetaside", reasonField: "reason", send: (view, el, cs) => ({ body: { ids: ["h1"], reason: cs.value("why") } }) }],
    render: (cs) => cs.field("why", "shell.reason") + cs.act("heldsetaside") };
  const p = await boot({ screens: [s], path: "/app/held" });
  await p.click(btn(p, "heldsetaside"));
  assert.equal(p.byOp("heldsetaside").length, 0);
  assert.equal(p.root().querySelector('[data-slot="m:0"] textarea'), null, "no second reason asked");
  assert.ok(p.root().querySelector('[data-slot="m:0"]').textContent.includes(word("shell.reason.needed")));
  p.doc.getElementById("why").value = "a duplicate";
  await p.click(btn(p, "heldsetaside"));
  assert.deepEqual(p.byOp("heldsetaside")[0].body, { ids: ["h1"], reason: "a duplicate" });
});

test("R11 friction: a reversible act runs on press; a reasoned act opens a reason field in place and sends only with a reason; a terminal or signed act opens a dialog stating what it does and who signs, and sends only on its confirm", async () => {
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE });
  await p.click(btn(p, "cite"));
  assert.deepEqual(p.byOp("cite").map((r) => r.body), [declaredFit("cite", { extent_para: 1, content_id: "c1" })]);
  await p.click(btn(p, "release"));
  assert.equal(p.byOp("release").length, 0);
  const slot = p.root().querySelector('[data-slot="m:3"]');
  assert.ok(slot.querySelector("textarea"));
  assert.ok(slot.querySelector("label").textContent === word("shell.reason"));
  await p.click(slot.querySelector('[data-shell="reason-send"]'));
  assert.equal(p.byOp("release").length, 0, "no reason, nothing sent");
  assert.ok(slot.textContent.includes(word("shell.reason.needed")));
  slot.querySelector("textarea").value = "  it was checked  ";
  await p.click(slot.querySelector('[data-shell="reason-send"]'));
  assert.deepEqual(p.byOp("release")[0].body, { ...declaredFit("release"), reason: "it was checked" });
  for (const [op, signs] of [["retire", "Done in your name, mai."], ["attest", "Signed with your key, in your name, mai."]]) {
    await p.click(btn(p, op));
    const dlg = p.root().querySelector('[role="dialog"]');
    assert.ok(dlg, op);
    assert.ok(dlg.textContent.includes(signs), op);
    assert.equal(p.byOp(op).length, 0);
    await p.click(dlg.querySelector('[data-shell="cancel"]'));
    assert.equal(p.root().querySelector('[role="dialog"]'), null);
    assert.equal(p.byOp(op).length, 0);
    await p.click(btn(p, op));
    const d2 = p.root().querySelector('[role="dialog"]');
    if (op === "attest") d2.querySelector("textarea").value = "noted";
    await p.click(d2.querySelector('[data-shell="confirm"]'));
    assert.equal(p.byOp(op).length, 1, op);
  }
  assert.ok(p.root().querySelector('button[data-act="retire"]'));
  assert.deepEqual(p.byOp("attest")[0].body, { ...declaredFit("attest"), locator: "noted" }, "a dialog's fields arrive as extra.fields");
});

test("R11 a terminal act's dialog states what the act does (act.<op>.does)", async () => {
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE });
  await p.click(btn(p, "retire"));
  assert.ok(p.root().querySelector('[role="dialog"] .ends').textContent.startsWith(word("act.retire.does")));
});

test("R11 an act that leaves the group carries mark.outward.means; one that does not, none", async () => {
  const s = { id: "connect", reads: () => ({}), acts: [{ op: "disclosureshown", outward: true }, { op: "aiaccountremove" }], render: (cs) => cs.act("disclosureshown") + cs.act("aiaccountremove") };
  const p = await boot({ screens: [s], path: "/app/connect" });
  assert.ok(btn(p, "disclosureshown").querySelector('use[href$="#i-outward"]'));
  assert.ok(btn(p, "disclosureshown").getAttribute("data-tip").includes(word("mark.outward.means").replace(/'/g, "&#39;")));
  assert.equal(btn(p, "aiaccountremove").querySelector('use[href$="#i-outward"]'), null);
});

test("R11 (DEC-181) at the phone width a signed act is drawn with what it does and where to finish it, and is not sent; the same act on a wide screen is a button", async () => {
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE, phone: true });
  assert.equal(btn(p, "attest"), null);
  const phone = p.root().querySelector('[data-phone-act="attest"]');
  assert.ok(phone.textContent.includes(word("shell.phone.larger")));
  assert.equal(phone.querySelector("button"), null);
  await p.click(phone);
  assert.equal(p.byOp("attest").length, 0);
  assert.ok(btn(p, "cite"), "a reversible act is still a phone act");
  /* R50 (K3156) amends this: a terminal act, which `op-grades.phoneOf` answers false for, is held at the phone width too */
  assert.equal(btn(p, "retire"), null);
  assert.ok(p.root().querySelector('[data-phone-act="retire"]'));
});

test("R12 an act is drawn only when NEEDS[op] is null or a held capability, the op is in the session's set, and, for an administrator's act, whoami's administer is true; absent, never greyed", async () => {
  assert.equal(NEEDS.cite, "contribute");
  assert.ok(SESSION_OPS.member.has("cite"));
  const noCap = await boot({ screens: ALL, path: "/app/document/c1", plane: { ...PLANE, whoami: ok({ ...MEMBER, capabilities: [] }) } });
  assert.equal(btn(noCap, "cite"), null);
  assert.equal(noCap.root().querySelector("button[disabled]"), null, "never greyed");
  const withCap = await boot({ screens: ALL, path: "/app/document/c1", plane: PLANE });
  assert.ok(btn(withCap, "cite"));
  const member = await boot({ screens: ALL, path: "/app/members" });
  assert.equal(btn(member, "memberadd"), null);
  assert.equal(btn(member, "membercaps"), null);
  const admin = await boot({ screens: ALL, path: "/app/members", plane: { whoami: ok(ADMIN) } });
  assert.ok(btn(admin, "memberadd"));
  assert.ok(btn(admin, "membercaps"));
  /* an op outside the session's set: the founder's set */
  const op = [...SESSION_OPS.member].find((o) => !SESSION_OPS.admin.has(o) && ["cite", "retire", "attest", "release"].includes(o));
  if (op) { const f = await boot({ screens: ALL, path: "/app/document/c1", plane: { ...PLANE, whoami: ok({ ...ADMIN, tokenClass: "admin" }) } }); assert.equal(btn(f, op), null); }
});

test("R12 before whoami answers, no act is drawn; an act the screen does not list is never drawn", async () => {
  const p = await boot({ screens: ALL, path: "/app/document/c1", plane: { ...PLANE, whoami: pending } });
  assert.equal(p.root().querySelector("button[data-act]"), null);
  const s = { id: "home", reads: () => ({}), acts: [], render: (cs) => cs.act("promote") };
  const q = await boot({ screens: [s] });
  assert.equal(btn(q, "promote"), null);
});

test("R13 R61 a refusal of each kind (ok: false at the top level, in result, an HTTP error, no answer) is drawn beside the act it answers, never in place of the screen, an HTTP error without words naming no code; a form keeps what the member typed; nothing else changes", async () => {
  const kinds = [[refused("NO_SUCH_THING_ZZ", "The thing is gone."), "The thing is gone."], [refusedIn("ZZ_IN", "Inside words."), "Inside words."], [httpError(500), word("shell.unread")], [silent, "did not answer"]];
  const code = "PROJECT_SCOPE_UNKNOWN";
  for (const [answer, words] of kinds) {
    const p = await boot({ screens: ALL, plane: { promote: answer, projectdirectory: ok({ projects: [] }) } });
    p.doc.getElementById("home-title").value = "Typed title";
    const before = p.root().querySelector("#cs-main").innerHTML;
    await p.click(btn(p, "promote"));
    const slot = p.root().querySelector('[data-slot="m:0"]');
    assert.ok(slot.querySelector('[data-gap="refused"]'), words);
    assert.ok(slot.textContent.includes(words), slot.textContent);
    assert.equal(p.doc.getElementById("home-title").value, "Typed title");
    for (const sl of p.root().querySelectorAll(".mk-slot")) sl.innerHTML = "";
    assert.equal(p.root().querySelector("#cs-main").innerHTML.replace(' value="Typed title"', ""), before.replace(/ value="[^"]*"/, ' value=""'), "nothing else changes");
  }
  /* refusal.<code> when held, and the screen's own key for a code first */
  const held = await boot({ screens: ALL, plane: { promote: refused(code, "ignored"), projectdirectory: ok({ projects: [] }) } });
  held.doc.getElementById("home-title").value = "T";
  await held.click(btn(held, "promote"));
  assert.ok(!held.root().querySelector('[data-slot="m:0"]').textContent.includes("ignored"));
  const own = await boot({ screens: ALL, path: "/app/document/c1", plane: { ...PLANE, cite: refused("CITE_GONE", "ignored") } });
  await own.click(btn(own, "cite"));
  assert.equal(own.root().querySelector('[data-slot="m:0"]').textContent, FIXTURE_WORDS.find((r) => r[0] === "screen.document.t.passages")[1]);
});

test("R21 an act's send: null sends nothing; {refuse: key} draws that word beside the act; a promise is awaited; done runs on success, then the reads named in rereads (all when absent)", async () => {
  const p = await boot({ screens: ALL, plane: { projectdirectory: ok({ projects: [] }) } });
  p.doc.getElementById("home-title").value = "";
  await p.click(btn(p, "promote"));
  assert.equal(p.byOp("promote").length, 0);
  assert.ok(p.root().querySelector('[data-slot="m:0"]').textContent.includes(word("shell.reason.needed")));
  const q = await boot({ screens: ALL, plane: { promote: ok({ project: "P9" }), projectdirectory: ok({ projects: [] }) } });
  q.doc.getElementById("home-title").value = "New";
  await q.click(btn(q, "promote"));
  assert.deepEqual(q.byOp("promote")[0].body, { ...declaredFit("promote"), meta: { title: "New" } }, "the declared fields, the typed title carried as meta");
  assert.equal(q.location.pathname, "/app/project/P9", "done opened another screen");
  let reads = 0;
  const s = { id: "held", reads: () => ({ a: { op: "heldcaptures" }, b: { op: "gradenote" } }), render: (cs) => cs.act("heldrestore"),
    acts: [{ op: "heldrestore", send: fitSend("heldrestore", "{ ids: ['x'] }"), rereads: ["a"] }] };
  const r = await boot({ screens: [s], path: "/app/held", plane: { heldcaptures: () => (reads++, ok({ items: [1] })) } });
  assert.equal(reads, 1);
  await r.click(btn(r, "heldrestore")); r.root().querySelector("textarea").value = "back"; await r.click(r.root().querySelector('[data-shell="reason-send"]'));
  assert.deepEqual(r.byOp("heldrestore")[0].body, { ...declaredFit("heldrestore", { ids: ["x"] }), reason: "back" });
  assert.equal(reads, 2);
  assert.equal(r.byOp("gradenote").length, 1, "only the named read again");
});

test("R21 (K2999) a picked-rows act receives the picked keys as extra.picked; send may answer {query, raw}, the raw body sent as it is under the session header with no JSON content type", async () => {
  const s = { id: "held", reads: () => ({ h: { op: "heldcaptures" } }), acts: [{ op: "heldsetaside", send: (view, el, cs, extra) => ({ query: { ids: String(extra.picked.length) }, raw: "RAW:" + extra.picked.join(",") }) }],
    render: (cs) => cs.state("h", (v) => cs.rows({ id: "t", pick: true, cols: ["screen.held.name"], items: v.items, key: (i) => i.id, name: (i) => i.title, cells: (i) => [cs.esc(i.title)], hold: () => cs.act("heldsetaside") })) };
  const p = await boot({ screens: [s], path: "/app/held", plane: { heldcaptures: HELDA } });
  for (const id of ["h1", "h2"]) { const box = p.doc.getElementById("pick-t-" + id); box.checked = true; p.fire(box, "change"); await p.settle(); }
  await p.click(btn(p, "heldsetaside")); p.root().querySelector("textarea").value = "dup"; await p.click(p.root().querySelector('[data-shell="reason-send"]'));
  const r = p.byOp("heldsetaside")[0];
  assert.equal(r.body, "RAW:h1,h2");
  assert.equal(r.query.ids, "2");
  assert.equal(r.query.reason, "dup", "a raw body's reason travels in the query");
  assert.equal(r.headers.Authorization, "Bearer tok-1");
  assert.equal(r.headers["content-type"], undefined);
});

test("R21 (K2999) cs.download hands a byte answer to the browser as a file, its object address released once the download starts; a refusal answers {ok: false}", async () => {
  const s = { id: "open-file", reads: () => ({}), acts: [{ op: "openoriginal", async send(view, el, cs) { const r = await cs.download("openoriginal", { query: { capture: "ab" } }); el.setAttribute("data-got", String(r.ok)); return null; } }],
    render: (cs) => cs.act("openoriginal") };
  const p = await boot({ screens: [s], path: "/app/open-file/ab", plane: { openoriginal: bytes("%PDF-1.7") } });
  const press = async (x) => { await x.click(btn(x, "openoriginal")); };
  await press(p);
  assert.equal(p.files.length, 1);
  assert.equal(p.objectUrls.length, 1);
  assert.equal(p.objectUrls[0].released, true);
  assert.equal(p.byOp("openoriginal")[0].headers.Authorization, "Bearer tok-1");
  const q = await boot({ screens: [s], path: "/app/open-file/ab", plane: { openoriginal: refused("HELD", "Held.") } });
  await press(q);
  assert.equal(q.files.length, 0);
});

test("R21 (K2998) a screen's closed(cs, view) is called when the member leaves it, and on pagehide; its ui is kept across redraws of the same page", async () => {
  const s = { id: "held", reads: () => ({}), acts: [], closed: (cs, view) => { view.ui.n = (view.ui.n || 0); cs.call("heldcaptures", { query: { state: "closed" } }); },
    render: (cs, view) => "<button type=button id=b data-shell=x>" + cs.esc(String(view.ui.k || 0)) + "</button>" };
  const p = await boot({ screens: [s, HOME], path: "/app/held", plane: { projectdirectory: ok({ projects: [] }) } });
  await p.click('a[href="/app"]');
  assert.equal(p.requests.filter((r) => r.op === "heldcaptures" && r.query.state === "closed").length, 1);
  const q = await boot({ screens: [s], path: "/app/held" });
  for (const f of q.win.listeners.pagehide || []) f({});
  await q.settle();
  assert.equal(q.requests.filter((r) => r.op === "heldcaptures" && r.query.state === "closed").length, 1);
});

export { HELD };

test("R21 (K3002) parts in view.parts, view.origin, a refusal word filled from the refusal's fields, a refusals function, {refuse, fills}, cs.value of a checkbox and a radio, cs.digest, cs.now, and no cs.open", async () => {
  const s = { id: "connect", reads: () => ({}),
    parts: { pane: (cs, x) => "<b id=part>" + cs.esc(x) + "</b>" },
    acts: [
      { op: "ailimitset", send: fitSend("ailimitset"), refusals: { ZZ_FN: (r, cs) => "<i id=fn>" + cs.esc(r.code + ":" + r.detail) + "</i>" } },
      { op: "disclosureshown", send: (view, el, cs) => ({ refuse: "shell.picked", fills: { n: String(cs.value("c1")) + "/" + String(cs.value("r2")) } }) },
      { op: "accountusesset", send: async (view, el, cs) => { const h = await cs.digest("abc"); el.setAttribute("data-h", h); el.setAttribute("data-now", String(cs.now())); el.setAttribute("data-open", typeof cs.open); return null; } },
    ],
    render: (cs, view) => view.parts.pane(cs, view.origin) + cs.checks("c", "shell.appearance", [["a", "shell.appearance.light", true]]) + '<input type="radio" id="r1" name="r"><input type="radio" id="r2" name="r" checked>'
      .replace(/<input type="radio" id="r1"/, '<label for="r1">x</label><input type="radio" id="r1"').replace(/<input type="radio" id="r2"/, '<label for="r2">y</label><input type="radio" id="r2"')
      + '<input type="checkbox" id="c1" checked aria-label="z">' + cs.act("ailimitset") + cs.act("disclosureshown") + cs.act("accountusesset") };
  const p = await boot({ screens: [s], path: "/app/connect", plane: { ailimitset: refused("ZZ_FN", null, 400, { detail: "why not" }) } });
  assert.equal(p.doc.getElementById("part").textContent, "https://group.example");
  await p.click(btn(p, "ailimitset"));
  assert.equal(p.doc.getElementById("fn").textContent, "ZZ_FN:why not");
  await p.click(btn(p, "disclosureshown"));
  assert.equal(p.root().querySelector('[data-slot="m:1"]').textContent, "true/true picked");
  assert.equal(p.byOp("disclosureshown").length, 0);
  p.doc.getElementById("c1").checked = false;
  await p.click(btn(p, "disclosureshown"));
  assert.equal(p.root().querySelector('[data-slot="m:1"]').textContent, "false/true picked");
  /* the digest is answered off the page's thread: wait for it */
  const pressed = async () => { await p.click(btn(p, "accountusesset")); for (let i = 0; i < 200 && !btn(p, "accountusesset").getAttribute("data-h"); i++) await new Promise((r) => setTimeout(r, 5)); };
  await pressed();
  const t0 = Number(btn(p, "accountusesset").getAttribute("data-now"));
  assert.equal(btn(p, "accountusesset").getAttribute("data-h"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(btn(p, "accountusesset").getAttribute("data-open"), "undefined");
  await p.clock.tick(5000);
  btn(p, "accountusesset").removeAttribute("data-h");
  await pressed();
  assert.equal(Number(btn(p, "accountusesset").getAttribute("data-now")) - t0, 5000, "the harness's fake clock");
  /* a refusal row's word filled from the refusal's own fields */
  const code = (await import("../../../src/setup-words/index.mjs")).WORD_ROWS.find((r) => r[0].startsWith("refusal.") && /\{detail\}/.test(r[1]));
  if (code) {
    const q = await boot({ screens: [s], path: "/app/connect", plane: { ailimitset: refused(code[0].slice(8), null, 400, { detail: "THE-DETAIL" }) } });
    await q.click(btn(q, "ailimitset"));
    assert.ok(q.root().querySelector('[data-slot="m:0"]').textContent.includes("THE-DETAIL"));
  }
});

test("R21 (K3009) an act's done that answers a promise is awaited before the reads named in rereads; and after an act succeeds every password field its screen drew is cleared, surviving no redraw (controls: a refused act keeps it; a plain field is kept)", async () => {
  const s = { id: "account", reads: () => ({ r: { op: "memberlanguage" } }),
    acts: [{ op: "setpassword", send: (view, el, cs) => ({ body: { current: cs.value("cur"), password: cs.value("new") } }),
      done: async (view, answer, cs) => { await cs.call("signerlist", {}); }, rereads: ["r"] }],
    render: (cs) => cs.field("cur", "shell.reason", { type: "password" }) + cs.field("new", "shell.reason", { type: "password" }) + cs.field("plain", "shell.reason") + cs.act("setpassword") };
  let seq = [];
  const plane = (answer) => ({ setpassword: answer, memberlanguage: () => (seq.push("reread"), ok({ language: "en" })), signerlist: async () => { await new Promise((r) => setTimeout(r, 20)); seq.push("done"); return ok({}); } });
  const p = await boot({ screens: [s], path: "/app/account", plane: plane(ok({ ok: true })) });
  seq = [];
  for (const [id, v] of [["cur", "old-secret"], ["new", "new-secret"], ["plain", "kept"]]) p.doc.getElementById(id).value = v;
  const b = p.root().querySelector('button[data-act="setpassword"]');
  await p.click(b);
  if (p.root().querySelector('[data-shell="reason-send"]')) { p.root().querySelector("textarea").value = "r"; await p.click(p.root().querySelector('[data-shell="reason-send"]')); }
  for (let i = 0; i < 100 && !seq.includes("reread"); i++) await new Promise((r) => setTimeout(r, 5));
  await p.settle();
  assert.deepEqual(seq, ["done", "reread"], "done awaited before the re-read");
  assert.deepEqual(p.byOp("setpassword")[0].body, { current: "old-secret", password: "new-secret" });
  assert.equal(p.doc.getElementById("cur").value, "");
  assert.equal(p.doc.getElementById("new").value, "");
  assert.equal(p.doc.getElementById("plain").value, "kept");
  assert.ok(!p.root().innerHTML.includes("secret"));
  const q = await boot({ screens: [s], path: "/app/account", plane: plane(refused("BAD_PASSWORD", "Wrong.")) });
  q.doc.getElementById("cur").value = "old-secret";
  await q.click(q.root().querySelector('button[data-act="setpassword"]'));
  if (q.root().querySelector('[data-shell="reason-send"]')) { q.root().querySelector("textarea").value = "r"; await q.click(q.root().querySelector('[data-shell="reason-send"]')); }
  assert.equal(q.doc.getElementById("cur").value, "old-secret", "a refused act keeps what was typed (R13)");
});

test("R21 (K3011) a streamed answer (application/x-ndjson) reaches done and cs.call as its list of parsed events, the answer the last; a stream whose last event refuses is a refusal beside the act (control: a JSON answer reaches done as its result)", async () => {
  const { ndjson } = await import("./harness.mjs");
  const s = { id: "answers", reads: () => ({}),
    acts: [{ op: "ask", send: () => ({ body: { question: "q" } }), done: async (view, answer, cs) => { const again = await cs.call("ask", { body: { question: "r" } }); cs.set("got", JSON.stringify([answer, again])); } },
      { op: "search", send: () => ({ query: { q: "x" } }), done: (view, answer, cs) => cs.set("got2", JSON.stringify(answer)) }],
    render: (cs, view) => cs.act("ask") + cs.act("search") + "<p id=got>" + cs.esc(view.ui.got || "") + "</p><p id=got2>" + cs.esc(view.ui.got2 || "") + "</p>" };
  const events = [{ event: "looking" }, { event: "read", n: 2 }, { ok: true, summary: "S" }];
  const p = await boot({ screens: [s], path: "/app/answers", plane: { ask: ndjson(events), search: ok({ results: [1] }) } });
  await p.click(btn(p, "ask"));
  if (p.root().querySelector('[data-shell="reason-send"]')) { p.root().querySelector("textarea").value = "r"; await p.click(p.root().querySelector('[data-shell="reason-send"]')); }
  await p.settle();
  assert.deepEqual(JSON.parse(p.doc.getElementById("got").textContent), [events, events]);
  await p.click(btn(p, "search"));
  assert.deepEqual(JSON.parse(p.doc.getElementById("got2").textContent), { results: [1] }, "control: JSON reaches done as its result");
  const q = await boot({ screens: [s], path: "/app/answers", plane: { ask: ndjson([{ event: "looking" }, { ok: false, code: "AI_NO_ACCOUNT", translation: "No account serves you." }]) } });
  await q.click(btn(q, "ask"));
  if (q.root().querySelector('[data-shell="reason-send"]')) { q.root().querySelector("textarea").value = "r"; await q.click(q.root().querySelector('[data-shell="reason-send"]')); }
  assert.ok(q.root().querySelector('[data-slot="m:0"] [data-gap="refused"]'));
});

test("R11 (K3011) a read (an op OPS declares not mutating) carries no weight mark and runs on press, whatever op-grades' tables hold (control: a mutating act keeps its weight)", async () => {
  const { OPS } = await import("../../../src/op-declarations/index.mjs");
  for (const op of ["search", "findin", "frontier", "ruleanswer"]) assert.equal(OPS[op].mutating, false, op);
  const s = { id: "finder", reads: () => ({}), acts: [{ op: "search" }, { op: "findin", send: fitSend("findin") }, { op: "frontier" }, { op: "select" }], render: (cs) => cs.act("search") + cs.act("findin") + cs.act("frontier") + cs.act("select") };
  const p = await boot({ screens: [s], path: "/app/finder" });
  for (const op of ["search", "findin"]) {
    assert.equal(btn(p, op).querySelector(".w"), null, op + ": R77: a Reversible mark draws nothing");
    await p.click(btn(p, op));
    assert.equal(p.byOp(op).length, 1, op + " runs on press");
  }
  const { SESSION_OPS } = await import("../../../src/op-declarations/index.mjs");
  assert.equal(btn(p, "frontier") === null, !SESSION_OPS.member.has("frontier"), "frontier is gated by R12 alone");
  assert.equal(OPS.cite.mutating, true);
  const c = { id: "document", reads: () => ({}), acts: [{ op: "release", send: fitSend("release") }], render: (cs) => cs.act("release") };
  const q = await boot({ screens: [c], path: "/app/document/x" });
  assert.equal(btn(q, "release").querySelector(".w").textContent, word("weight.reasoned.name"), "control: a mutating act keeps its weight");
});
