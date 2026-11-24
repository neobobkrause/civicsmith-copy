/* interface-shell R84, R89, R108 (fix round 2, C81): the shared styles at 390 px, measured in a browser. The page the shell serves, with
   the served stylesheets, is drawn in Chromium at the phone width over stand-in screens that draw the constructs the walk found
   overflowing (cards with a long member name, a row with a long action, a table with ticks, the strip, tabs, checkboxes beside
   long words) and their widths and targets are measured. Needs `playwright-core` (found beside the product: `site/node_modules`,
   the journey check's, or the tools directory) and Chromium (CHROMIUM, or /opt/pw-browsers/chromium); without them the test fails,
   saying so. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { interfacePage, interfaceScript, scriptPath } from "../../../src/interface-shell/index.mjs";
import { ASSET_FILES } from "../../../src/interface-assets/index.mjs";
import { fitSend } from "./harness.mjs";

const root = (p) => fileURLToPath(new URL("../../../../" + p, import.meta.url));
function engine() {
  const homes = ["site/node_modules/", "bio-plane/src/journey-check/node_modules/", "bio-plane/node_modules/"].map(root).concat(["/opt/node-tools/node_modules/"]);
  for (const home of homes) {
    try { return createRequire(home + "noop.js")("playwright-core"); } catch { /* the next */ }
  }
  return null;
}
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

const LONG = "A-very-long-member-name-or-digest-that-has-no-break-at-all-0123456789abcdef0123456789abcdef0123456789abcdef";
/* a working screen (a real registry id, `question`) drawing what the walk found cut: acts in a row, cards, a table with ticks and
   panels, the strip, tabs, checkboxes beside words, a part that opens, and a table inside its scroller */
const STAND_IN = {
  id: "question", words: [], reads: () => ({}),
  render: new Function("cs", "view", `
    const long = ${JSON.stringify(LONG)};
    return cs.title("A question with a long title that wraps, " + long)
      + '<div class="mk-cards">' + [1, 2].map(function () { return '<div class="mk-card"><b>' + cs.esc(long) + '</b><span class="cs-kind" data-kind="todo">busy</span>' + cs.initials(["ann", "bo", "cy", "di", "ed", "fy"]) + '</div>'; }).join("") + '</div>'
      + cs.sec("screen.question.name", cs.row(cs.icon("sever"), cs.esc("The passage that is cited here, with a long sentence of text about what it is " + long),
        cs.act("sever", { label: "act.sever.label.question", data: { target: "a" } }) + cs.act("reinstate", { label: "act.reinstate.label.question", data: { target: "b" } }), cs.esc(long)))
      + cs.row(cs.icon("sever"), cs.ref("project", "P1", "Ann"), "", "") + '<ul class="mk-list"><li>' + cs.ref("project", "P2", "Bo") + '</li></ul>'
      + cs.rows({ id: "r", pick: true, cols: ["state.loading", "state.empty", "state.failed"], items: [{ id: "a", n: long, x: long }, { id: "b", n: "short", x: "" }],
        key: function (i) { return i.id; }, name: function (i) { return cs.ref("member", i.id, i.n); }, cells: function (i) { return [cs.esc(i.x), cs.esc(i.n)]; },
        acts: function () { return cs.act("reinstate", { label: "act.reinstate.label.question", data: { target: "z" } }); } })
      + cs.path([{ text: { text: "Check whether its route can be shown, with a long sentence of words that wraps " + long }, now: true, act: "" }, { text: { text: "Second" } }])
      + cs.strip([{ n: 1, label: { text: long } }, { n: 22, label: { text: "two" } }, { n: 3, label: { text: "three" } }, { n: 4, label: { text: "four" } }])
      + '<div role="tablist">' + ["one", "two", "three", "four", "five", "six"].map(function (t) { return '<button type="button" role="tab" class="cs-btn" data-tone="quiet">' + t + ' tab with words</button>'; }).join("") + '</div>'
      + cs.field("f1", "screen.question.name") + cs.checks("c1", { text: "legend" }, [{ value: "a", text: long }, { value: "b", text: "short", on: true }])
      + '<div data-guide-marks><button type="button" class="cs-wizmark" data-guide="chip" aria-expanded="false" data-level="2">Show me how</button></div>'
      + '<details class="cs-part"><summary>' + cs.esc(long) + '</summary><p>' + cs.esc(long) + '</p></details>'
      + '<div class="tw"><table class="mk-table"><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>' + cs.esc(long) + '</td><td>2</td></tr></tbody></table></div>';
  `),
  acts: [{ op: "sever", send: fitSend("sever") }, { op: "reinstate", send: fitSend("reinstate") }],
};

/* a registered screen a ref can open, so the refs are drawn as links */
const PROJECT = { id: "project", words: [], reads: () => ({}), acts: [], render: new Function("cs", "return cs.title('x');") };

const PLANE = { session: true, member: "mai", handle: "mai", tokenClass: "admin", administer: true, capabilities: ["contribute", "create_projects", "publish"], items: [], projects: [], display_name: "A team with a very long name that has to wrap and never be cut however many words it takes", members: [] };

async function measure(width) {
  const pw = engine();
  assert.ok(pw && pw.chromium, "playwright-core is needed beside the product (`npm ci` in site/), with Chromium: this test cannot measure without them");
  assert.ok(existsSync(EXE), "Chromium is needed at CHROMIUM or /opt/pw-browsers/chromium");
  const html = interfacePage([STAND_IN, PROJECT]), script = interfaceScript([STAND_IN, PROJECT]);
  const browser = await pw.chromium.launch({ executablePath: EXE });
  try {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript(() => localStorage.setItem("bio-session", JSON.stringify({ t: "tok", e: 0, d: "own", w: "mai" })));
    const page = await ctx.newPage();
    await page.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.startsWith("/app/assets/")) {
        const f = ASSET_FILES[u.pathname.slice("/app/assets/".length)];
        if (!f) return r.fulfill({ status: 404, body: "" });
        return r.fulfill({ status: 200, contentType: f.type, body: f.encoding === "base64" ? Buffer.from(f.body, "base64") : f.body });
      }
      if (u.pathname === "/api/" || u.pathname === "/api") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: PLANE }) });
      if (u.pathname === scriptPath("0")) return r.fulfill({ status: 200, contentType: "text/javascript", body: script });
      if (u.pathname === "/version") return r.fulfill({ status: 200, contentType: "text/plain", body: "v1\n" });
      return r.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await page.goto("https://group.example/app/question/Q1");
    await page.waitForSelector("#cs-main .mk-cards", { timeout: 15000 });
    await page.waitForTimeout(300);
    return await page.evaluate((W) => {
      const seen = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const inScroller = (e) => !!e.closest(".tw");
      const out = { mainScroll: document.getElementById("cs-main").scrollWidth, over: [], small: [], pick: null, open: null, mast: null };
      for (const e of document.querySelectorAll("#cs-main *, .cs-mast *, .cs-tabs *")) {
        if (!seen(e) || inScroller(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.right > W + 0.5 || r.left < -0.5) out.over.push(e.localName + "." + e.className + " " + Math.round(r.left) + "-" + Math.round(r.right));
        if (e.matches("a, button, input, select, textarea, summary, [role=tab]")) {
          /* a box ticked beside its words is as big as the label that carries it */
          const t = e.matches("input[type=checkbox], input[type=radio]") && e.closest("label") ? e.closest("label").getBoundingClientRect() : r;
          if (t.height < 43.5 || t.width < 43.5) out.small.push(e.localName + "." + (e.className || "") + " " + Math.round(t.width) + "x" + Math.round(t.height) + " " + (e.textContent || "").slice(0, 20));
        }
      }
      const pick = document.querySelector("input.mk-pick"), open = document.querySelector("button.mk-open");
      out.pick = pick ? Math.round(pick.getBoundingClientRect().width) : null;
      out.open = open ? Math.round(open.getBoundingClientRect().height) : null;
      /* C81 (fix round 3): the phone's one strip chip is drawn where the design's stylesheet shows it (inside .mk-strip-sum), with its
         number clear of its words; the people chip and the numbered steps stay inside the screen with their numbers clear of the words */
      const strip = document.querySelector(".mk-strip a.cs-ref");
      out.strip = strip && seen(strip) ? { b: strip.querySelector("b").getBoundingClientRect().right, text: (() => { const r = document.createRange(); r.selectNodeContents(strip); r.setStart(strip.childNodes[1], 0); return r.getBoundingClientRect().left; })(), right: strip.getBoundingClientRect().right } : null;
      const people = document.querySelector(".mk-people");
      out.people = people ? Math.round(people.getBoundingClientRect().right) : null;
      out.steps = Array.from(document.querySelectorAll(".mk-next li")).map((li) => { const sp = li.querySelector("span"); return { span: Math.round(sp.getBoundingClientRect().left), li: Math.round(li.getBoundingClientRect().left) + 12 + 24, right: Math.round(li.getBoundingClientRect().right) }; });
      const grp = document.querySelector(".cs-mast .mk-grp");
      out.mast = grp ? { right: Math.round(grp.getBoundingClientRect().right), words: grp.textContent.length } : null;
      return out;
    }, width);
  } finally { await browser.close(); }
}

test("R84 R89 R108 R131 (C81) at 390 px no part of the main area or the masthead runs past the screen, a long name or digest wraps, and every control is at least 44 px to press (a ticked box counts its label)", { timeout: 120000 }, async () => {
  const m = await measure(390);
  assert.ok(m.mainScroll <= 390, "the main area is no wider than the screen: " + m.mainScroll);
  assert.deepEqual(m.over, [], "nothing past the edge");
  assert.deepEqual(m.small, [], "every target is at least 44 px");
  assert.ok(m.pick >= 44, "a row's tick is a 44 px target: " + m.pick);
  assert.ok(m.open >= 44, "a row's panel control is a 44 px target: " + m.open);
  assert.ok(m.strip, "the strip's one chip is shown, not hidden by the design's own rule for a link outside .mk-strip-sum");
  assert.ok(m.strip.b <= m.strip.text + 0.5 && m.strip.right <= 390, "its number is clear of its words and inside the screen");
  assert.ok(m.people !== null && m.people <= 390, "the people chip stays inside the screen: " + m.people);
  for (const st of m.steps) assert.ok(st.span >= st.li - 1 && st.right <= 390, "a step's number is clear of its words: " + JSON.stringify(st));
  assert.ok(m.mast && m.mast.right <= 390 && m.mast.words > 40, "the team's name wraps whole inside the screen");
});

test("R84 R89 (C81) control: at 1280 px the layout is the desktop's (a tick is its small box, the panel control a text link, the rows side by side, the page no wider than the screen)", { timeout: 120000 }, async () => {
  const m = await measure(1280);
  assert.ok(m.mainScroll <= 1280);
  assert.ok(m.pick < 30, "the desktop tick is unchanged: " + m.pick);
  assert.ok(m.open < 30, "and the panel control: " + m.open);
});
