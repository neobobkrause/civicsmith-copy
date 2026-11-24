/* Test screens for the shell's own tests: real registry ids, each act the registry's for its screen, drawn with every
   part of the kit (reads in their four states, acts of each weight, references, marks, dates, rows with picks and the
   hold strip, fields, the dock). Every function refers only to its parameters, as R21's contract asks. */
import { fitSend as fit, declaredFit } from "./harness.mjs";
export const FIXTURE_WORDS = Object.freeze([
  ["screen.home.t.queue", "fx t queue", false],
  ["screen.home.t.queue.holds", "fx t queue holds", false],
  ["screen.home.t.projects", "fx t projects", false],
  ["screen.home.t.projects.holds", "fx t projects holds", false],
  ["screen.home.t.empty", "fx t empty", false],
  ["screen.home.t.title", "fx t title", false],
  ["screen.held.t.col.name", "fx t col name", false],
  ["screen.held.t.col.when", "fx t col when", false],
  ["screen.document.t.passages", "fx t passages", false],
  ["screen.document.t.passages.holds", "fx t passages holds", false],
  ["screen.members.t.roster", "fx t roster", false],
  ["screen.members.t.roster.holds", "fx t roster holds", false],
  ["screen.assistant.t.panel", "fx t panel", false],
  ["screen.assistant.t.panel.holds", "fx t panel holds", false],
  ["screen.front.t.handle", "fx t handle", false],
  ["screen.front.t.password", "fx t password", false],
  ["screen.front.t.state", "fx t state {state}", false],
  ["screen.join.t.handle", "fx t handle", false],
  ["screen.join.t.password", "fx t password", false],
  ["screen.join.t.codes", "fx t codes", false],
  ["screen.doorbell.t.what", "fx t what", false],
].map((r) => Object.freeze(r)));

const own = (prefix) => FIXTURE_WORDS.filter((r) => r[0].startsWith(prefix));

export const HOME = {
  id: "home",
  words: own("screen.home."),
  reads(view) { return { queue: { op: "queue", query: { limit: 5 } }, projects: { op: "projectdirectory", empty: (v) => !v || !v.projects || !v.projects.length } }; },
  render(cs, view) {
    return cs.title() + cs.sec("screen.home.t.queue", cs.state("queue", view, (q) => q.items.map((i) => cs.mark("kind", i.class === "OBLIGATION" ? "todo" : "noticed") + cs.esc(i.summary || "")).join("")))
      + cs.sec("screen.home.t.projects", cs.state(view.data.projects, (v) => v.projects.map((p) => cs.row(cs.ref("project", p.id, p.title, [p.questions + " questions"]), cs.due(p.due, "near"))).join(""), { empty: "screen.home.t.empty" }))
      + cs.field("home-title", "screen.home.t.title", { rec: true })
      + cs.act("promote", { label: "act.promote.label.home", tone: "primary" });
  },
  /* the body is what the owner declares (read through the collector, K3268), the typed title carried as `meta` */
  acts: [{ op: "promote", send: new Function("view", "el", "cs", `const t = cs.value("home-title"); return t ? { body: Object.assign(${JSON.stringify(declaredFit("promote"))}, { meta: { title: t } }) } : { refuse: "shell.reason.needed" };`),
    done(view, answer, cs) { if (answer && answer.project) cs.go("project", answer.project); } }],
};

export const HELD = {
  id: "held",
  words: own("screen.held."),
  reads() { return { held: { op: "heldcaptures" } }; },
  render(cs, view) {
    return cs.title() + cs.state("held", (v) => cs.rows({
      id: "held", pick: true, cols: ["screen.held.t.col.name", "screen.held.t.col.when"],
      items: v.items, key: (it) => it.id, name: (it) => it.title,
      cells: (it) => [cs.esc(it.title), cs.date(it.at)],
      sortKey: (it, col) => (col === 0 ? it.title : it.at),
      acts: (it) => cs.act("heldrestore", { data: { id: it.id } }),
      hold: (ids) => cs.act("release", { data: { ids: ids.join(",") } }) + cs.act("heldsetaside", { data: { ids: ids.join(",") } }),
    }));
  },
  acts: [
    { op: "release", send: fit("release", "{}") },
    { op: "heldsetaside", send: fit("heldsetaside", "{ ids: el.dataset.ids.split(\",\") }") },
    { op: "heldrestore", send: fit("heldrestore", "{ ids: [el.dataset.id] }") },
  ],
};

export const DOCUMENT = {
  id: "document",
  words: own("screen.document."),
  place(view) { const d = view.data.doc; return d && d.state === "ok" ? { project: { id: d.value.project.id, title: d.value.project.title } } : null; },
  reads(view) { return { doc: { op: "image", query: { id: view.subject }, subject: true } }; },
  render(cs, view) {
    return cs.state("doc", view, (d) => cs.title(d.title, { kind: "document", facts: [d.pages + " pages"] })
      + cs.grade("capture", d.grade) + cs.mark("origin", "search") + cs.mark("gap", "refused", { reason: d.why })
      + cs.sec("screen.document.t.passages", d.passages.map((p) => cs.row(cs.ref("passage", view.subject + "#" + p.n, p.text, []), cs.act("cite", { data: { passage: p.n } }))).join(""))
      + cs.act("retire") + cs.act("attest") + cs.act("release", { data: { id: view.subject } }));
  },
  acts: [
    { op: "cite", send: fit("cite", "{ extent_para: Number(el.dataset.passage), content_id: view.subject }"), refusals: { CITE_GONE: "screen.document.t.passages" } },
    { op: "retire", send: fit("retire", "{}") },
    { op: "attest", send: fit("attest", "{ locator: extra.fields.locator }"), dialog: [{ name: "locator", label: "screen.document.t.passages" }] },
    { op: "release", send: fit("release", "{}") },
  ],
};

export const MEMBERS = {
  id: "members",
  words: own("screen.members."),
  reads() { return {}; },
  render(cs) { return cs.title() + cs.sec("screen.members.t.roster", cs.act("memberadd") + cs.act("membercaps")); },
  acts: [{ op: "memberadd", send: fit("memberadd") }, { op: "membercaps", send: fit("membercaps") }],
};

export const ASSISTANT = {
  id: "assistant",
  words: own("screen.assistant."),
  reads(view) { return {}; },
  render(cs, view) { return cs.sec("screen.assistant.t.panel", cs.mark("origin", "machine") + cs.act("airunopen", { data: { screen: view.serves.screen } })); },
  acts: [{ op: "airunopen", send: fit("airunopen", "{ contextType: view.serves.screen, contextId: view.serves.subject }") }],
};

/* T47: the public frame's `front` (screens-entry R2's sign-in, as the shell's R46 hands it over) and `doorbell`, the
   published frame's `published`, and the setup frame's `join` (R45, R46). */
export const FRONT = {
  id: "front",
  words: own("screen.front."),
  reads() { return { group: { op: "groupidentity" } }; },
  render(cs, view) {
    return cs.title() + "<p id=state>" + cs.w("screen.front.t.state", { state: view.session.state }) + "</p>"
      + cs.field("f-handle", "screen.front.t.handle", { value: view.session.handle || "" }) + cs.field("f-pass", "screen.front.t.password", { type: "password" })
      + cs.act("login") + cs.act("unlock") + (view.session.state === "locked" ? cs.signout() : "");
  },
  acts: [
    { op: "login", send(view, el, cs) { return { body: { handle: cs.value("f-handle"), password: cs.value("f-pass"), device: "own" } }; },
      async done(view, answer, cs) { await cs.signin(answer, { device: "own", handle: cs.value("f-handle") }); } },
    { op: "unlock", send(view, el, cs) { return { body: { password: cs.value("f-pass") } }; } },
  ],
};
export const DOORBELL = {
  id: "doorbell",
  words: own("screen.doorbell."),
  reads() { return { group: { op: "groupidentity" } }; },
  render(cs) { return cs.title() + cs.field("d-what", "screen.doorbell.t.what", { area: true }) + cs.act("knock"); },
  acts: [{ op: "knock", send(view, el, cs) { return { body: { content: cs.value("d-what") } }; } }],
};
export const PUBLISHED = {
  id: "published",
  reads(view) { return { c: { op: "publishedcase", query: { id: view.subject }, subject: true } }; },
  render(cs, view) { return cs.state("c", view, (c) => cs.title(c.title)); },
  acts: [{ op: "verify" }],
};
export const JOIN = {
  id: "join",
  words: own("screen.join."),
  reads(view) { return view.fragment.invite ? { invite: { op: "invitelook", body: { invite: view.fragment.invite } } } : {}; },
  render(cs, view) {
    return cs.title() + cs.field("j-handle", "screen.join.t.handle") + cs.field("j-pass", "screen.join.t.password", { type: "password" })
      + cs.act("enroll") + cs.act("memberlanguageset") + (view.ui.codes ? cs.sec("screen.join.t.codes", cs.save("codes.txt", view.ui.codes) + cs.copy(view.ui.codes)) : "");
  },
  acts: [
    { op: "enroll", send(view, el, cs) { return { body: { invite: view.fragment.invite || "x", handle: cs.value("j-handle"), password: cs.value("j-pass") } }; },
      async done(view, answer, cs) {
        const login = await cs.call("login", { body: { handle: "newbie", password: "pw-pw-pw-pw-pw", device: "own" } });
        await cs.signin(login, { device: "own", handle: "newbie", stay: true });
        cs.set("codes", "code-1\ncode-2");
        return { stay: true };
      } },
    { op: "memberlanguageset", send() { return { body: { language: "en" } }; } },
  ],
};
export const PERSON = {
  id: "person",
  reads(view) { return { p: { op: "person", query: { id: view.subject }, subject: true } }; },
  render(cs, view) { return cs.state("p", view, (p) => cs.title(p.name, { kind: "person" })) + cs.act("personexpunge"); },
  acts: [{ op: "personexpunge" }],
};

export const ALL = [HOME, HELD, DOCUMENT, MEMBERS, ASSISTANT];
export const ENTRY = [FRONT, DOORBELL, PUBLISHED, JOIN];
