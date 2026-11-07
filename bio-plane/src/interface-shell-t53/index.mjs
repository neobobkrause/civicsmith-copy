/* interface-shell-t53: what this module adds to the member interface's page (BOB ruling 7 Nov 2026, from this module's block).
   `interface-shell` imports this file and folds `CONTRIBUTION` into the page it composes (`interface-shell/index.mjs`,
   `contributionOf`), in a fixed order, after the shell's own:
   - `kit`: `{name: fn(cs, D, ...args)}`, each function self-contained (only its parameters and the language's own globals, as a
     screen's are, R21), added to the kit `cs` of every screen as `cs.<name>(...args)`, called with that kit and the page's data
     `D` (which holds `data` below) first; a name the shell's own kit holds stays the shell's;
   - `style`: CSS text appended to the shell's `STYLE` (the frame rules), after its own; no `@import`, `url()` or `</`;
   - `data`: JSON values added to the page's data `D` under their own keys, after the shell's; a key the shell's `D` holds throws.

   Attempt 2 fills it with the kit parts the T53 rules ask for that a contribution can carry:
   - R138 `cs.picker(view, id, o)`: the document picker with two scopes;
   - R141 `cs.machine(kind, o)`: a machine result's label, naming the AI from the result's label data.
   And `cs.t53word(key, fills)`, the words those parts draw. The page's word table (`D.words`) is the shell's and keeps only the
   families and screens it names (`interface-shell` `pageWords`), so this module carries the words its parts draw as its own data,
   `D.t53.words`, read from the word table (`setup-words`' rows) when the page is composed: the table still wins, and nothing is
   written twice. The other T53 marks rule the shell's own program (its read path, frame, act button, explanations, gate), which a
   contribution cannot reach: they are named to BOB as found marks for `interface-shell`. */
import { WORD_ROWS } from "../setup-words/index.mjs";

/* the words this module's kit parts draw, by key; each must be a row of the word table */
export const T53_WORD_KEYS = Object.freeze([
  /* R138 */
  "screen.document.pick.find", "screen.document.pick.find.help", "screen.document.pick.none", "screen.document.pick.more",
  "screen.document.pick.noproject", "screen.document.pick.member", "screen.document.pick.archive",
  "form.choose.document", "form.choose.widen.documents",
  /* R141 */
  "screen.machine.draft.ai", "screen.machine.draft.asked.ai", "screen.machine.proposed.ai", "screen.machine.suggested.date.ai",
  "screen.machine.suggested.plan.ai", "screen.machine.judgment.ai", "screen.machine.proposes.tier.ai", "screen.machine.ai.tip",
]);

/* R141: the kinds of machine label, each the word `screen.machine.<kind>.ai` */
export const MACHINE_KINDS = Object.freeze(["draft", "draft.asked", "proposed", "suggested.date", "suggested.plan", "judgment", "proposes.tier"]);

const wordsOf = (keys) => {
  const rows = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
  const out = {};
  for (const k of keys) {
    if (!rows.has(k)) throw new Error(`interface-shell-t53: the word table holds no ${k}`);
    out[k] = rows.get(k);
  }
  return out;
};

const KIT = {
  /* the word `key` as the page draws a word: from `D.t53.words` (the table's, carried here), else the page's own table; escaped,
     each `{name}` filled with its value escaped, a value `{html}` (a fragment the kit made) inserted as it is */
  t53word(cs, D, key, fills) {
    const own = D.t53 && D.t53.words && Object.prototype.hasOwnProperty.call(D.t53.words, key) ? D.t53.words[key] : null;
    if (own === null) return cs.w(key, fills);
    return cs.esc(own).replace(/\{(\w+)\}/g, (m, n) => {
      if (!fills || !(n in fills)) return m;
      const v = fills[n];
      return v && typeof v === "object" && "html" in v ? v.html : cs.esc(v);
    });
  },

  /* R141 (DEC-466 U1): a machine result's label, `screen.machine.<kind>.ai`, `{ai}` the AI's display name from the result's label
     data (`o.label.display_name`, `ai-runs` R104) and never an account; explained by `screen.machine.ai.tip`. `o.handle` and `o.date`
     fill the kinds that name them. A kind the table lacks, or a label with no display name, draws nothing. */
  machine(cs, D, kind, o) {
    o = o || {};
    const key = "screen.machine." + String(kind) + ".ai";
    const words = D.t53 && D.t53.words ? D.t53.words : {};
    const label = o.label && typeof o.label === "object" ? o.label : null;
    const ai = label && typeof label.display_name === "string" ? label.display_name.trim() : "";
    if (!Object.prototype.hasOwnProperty.call(words, key) || !ai) return "";
    const fills = { ai: ai, handle: o.handle == null ? "" : String(o.handle), date: o.date ? { html: cs.date(o.date) } : "" };
    const tip = cs.t53word("screen.machine.ai.tip");
    return '<span class="cs-draftlabel" data-machine="' + cs.esc(kind) + '" data-ai="' + cs.esc(ai) + '" tabindex="0" data-level="1" data-tip="'
      + cs.esc(tip) + '">' + cs.icon("machine") + cs.t53word(key, fills) + "</span>";
  },

  /* R138 (DEC-463; K5516, L2): the document picker with two scopes. `view` is the screen's view; `id` the picker's own id (the
     chosen document is `view.ui["pick:" + id]`, and `cs.value(id)` is not used); `o`:
     - `project`: the screen's own project id, or null when the screen knows none (then the list is the second scope alone,
       each row labelled with its project, and no control);
     - `here`: the read of the project's documents (`{state, value}` as `cs.state` takes it), `value` a list, or `{items, more}`;
     - `others`: the read of the documents of the member's other projects, asked by the screen while `view.ui["pick:" + id +
       ":wide"]` holds a value (the control's), or always when there is no project;
     - `single`: true when the member sees one project's documents only: no control;
     - `label`: the word key of the choice's legend (default `form.choose.document`).
     A document is `{id, title, date, project, project_name, files}`, `files` an archive's own documents, listed under it. */
  picker(cs, D, view, id, o) {
    o = o || {};
    const ui = view && view.ui ? view.ui : {};
    const name = "pick:" + id;
    const say = (k, f) => cs.t53word(k, f);
    const plain = (h) => String(h).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const q = typeof ui[name + ":q"] === "string" ? ui[name + ":q"].trim().toLowerCase() : "";
    const chosen = ui[name] == null ? null : String(ui[name]);
    const project = o.project == null || o.project === "" ? null : String(o.project);
    const wide = !project || (Array.isArray(ui[name + ":wide"]) ? ui[name + ":wide"].length > 0 : !!ui[name + ":wide"]);
    const itemsOf = (r) => (r && r.value ? (Array.isArray(r.value) ? r.value : Array.isArray(r.value.items) ? r.value.items : []) : []);
    const moreOf = (r) => (r && r.value && !Array.isArray(r.value) && Number(r.value.more) > 0 ? Number(r.value.more) : 0);
    const matches = (d) => !q || String(d.title == null ? "" : d.title).toLowerCase().includes(q);
    /* one option per choosable document: an archive's files under it, each a document, labelled with its archive */
    const optionsOf = (docs) => {
      const out = [];
      for (const d of docs) {
        if (!d || d.id == null) continue;
        const files = Array.isArray(d.files) ? d.files.filter((f) => f && f.id != null) : null;
        if (files) {
          for (const f of files) if (matches(f) || matches(d))
            out.push({ value: String(f.id), text: plain(String(f.title == null ? "" : f.title) + (f.date ? " · " + cs.date(f.date) : "") + " · " + say("screen.document.pick.member", { archive: String(d.title == null ? "" : d.title) })), on: chosen === String(f.id) });
        } else if (matches(d)) out.push({ value: String(d.id), text: plain(String(d.title == null ? "" : d.title) + (d.date ? " · " + cs.date(d.date) : "")), on: chosen === String(d.id) });
      }
      return out;
    };
    const pick = (c2, v2, value) => c2.set(name, value);
    let n = 0;
    /* a scope drawn as rows once its read answered; loading and failed are R10's states, a failed scope never drawn as empty */
    const shown = (r) => !!r && r.state !== "loading" && r.state !== "failed";
    const group = (gid, legend, docs) => {
      const opts = optionsOf(docs);
      n += opts.length;
      return opts.length ? cs.checks(id + "-" + gid, { text: legend }, opts, { radio: true, typing: pick }) : "";
    };
    /* the search: the kit's field, its label the picker's word */
    const fid = id + "-q";
    const search = cs.field(fid, "screen.document.pick.find", { value: ui[name + ":q"] || "", help: undefined, typing: (c2, v2, value) => c2.set(name + ":q", value) })
      .replace(/(<label for="[^"]*">)[\s\S]*?(<\/label>)/, (m, a, b) => a + say("screen.document.pick.find") + b);
    let body = "";
    /* the first scope: the screen's own project */
    const hereSeen = new Set();
    if (project) {
      const r = o.here || { state: "loading" };
      if (shown(r)) {
        const docs = itemsOf(r);
        for (const d of docs) if (d && d.id != null) hereSeen.add(String(d.id));
        body += '<div data-scope="here">' + group("here", plain(say(o.label || "form.choose.document")), docs)
          + (moreOf(r) ? '<p class="mk-note" data-more="here">' + say("screen.document.pick.more", { count: moreOf(r) }) + "</p>" : "") + "</div>";
      } else body += '<div data-scope="here">' + cs.state(r, () => "") + "</div>";
    }
    /* the second scope: the member's other projects, each group headed by its project, rows already listed not repeated */
    if (wide) {
      const r = o.others || { state: "loading" };
      if (shown(r)) {
        const groups = new Map();
        for (const d of itemsOf(r)) {
          if (!d || d.id == null || hereSeen.has(String(d.id))) continue;
          hereSeen.add(String(d.id));
          const p = d.project == null || d.project === "" ? "" : String(d.project);
          if (project && p === project) continue;
          if (!groups.has(p)) groups.set(p, { legend: p ? String(d.project_name || p) : plain(say("screen.document.pick.noproject")), docs: [] });
          groups.get(p).docs.push(d);
        }
        let i = 0;
        body += '<div data-scope="others">' + [...groups.values()].map((g) => group("o" + i++, g.legend, g.docs)).join("")
          + (moreOf(r) ? '<p class="mk-note" data-more="others">' + say("screen.document.pick.more", { count: moreOf(r) }) + "</p>" : "") + "</div>";
      } else body += '<div data-scope="others">' + cs.state(r, () => "") + "</div>";
    }
    /* nothing shown matches: the none-found sentence; the control is still offered */
    const settled = (r) => r && r.state !== "loading" && r.state !== "failed";
    if (!n && q && (project ? settled(o.here) : true) && (!wide || settled(o.others)))
      body += '<p class="cs-state" data-state="empty" data-none>' + say("screen.document.pick.none", { text: ui[name + ":q"] }) + "</p>";
    const control = project && !wide && !o.single
      ? cs.checks(id + "-wide", { text: "" }, [{ value: "1", text: plain(say("form.choose.widen.documents")), on: false }], { redraw: name + ":wide" })
      : "";
    return '<div data-picker="' + cs.esc(id) + '">' + search + body + control + "</div>";
  },
};

export const CONTRIBUTION = Object.freeze({
  kit: Object.freeze(KIT),
  style: "",
  data: Object.freeze({ t53: Object.freeze({ words: Object.freeze(wordsOf(T53_WORD_KEYS)) }) }),
});
