/* screens-settings R6, R7 (and R8): Settings › Your notes, the registry's 5 acts (DEC-136). A member's own notes, seen
   only by them: written, revised, deleted, and turned into an observation, a hunch or a question in the shapes the owner
   names (hypotheses R13); the assistant's help under the note's field only while it is reachable (interface-shell R20),
   its draft labeled "Draft · the assistant's, asked by <handle>" and kept only by the member's own act (DEC-153 (3)),
   with the test-instance label `ai.label.untested` beside it when the answer carries `untested` (R11; wizard-scripts
   R34); the court sentence once, the
   first time the member keeps a note while the group tells members what a court can reach (DEC-136; membership R108).
   Every function is self-contained (interface-shell R21). */

export const notes = {
  id: "notes",

  reads() {
    return {
      notes: { op: "notes", empty: (v) => !v.notes || v.notes.length === 0 },
      court: { op: "courtnotice" },
    };
  },

  render(cs, view) {
    const W = cs.w, E = cs.esc, S = "screen.notes.";
    const D = (iso) => String(cs.date(iso, { year: true })).replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
    const ui = view.ui || {};
    const data = view.data || {};
    // a note's field, holding the assistant's draft when one was asked for it, labeled as the assistant's
    const textField = (id, field, value) => {
      const dr = ui.draft && ui.draft.field === field ? ui.draft : null;
      const help = view.reachable ? cs.act("writinghelp", { data: { field, id } }) : "";
      // the test-instance label beside the draft's own, only where the answer carries `untested` (R11)
      return cs.field(id, field === "new" ? S + "new.field" : S + "revise.field", { area: true, rec: true, value: dr ? dr.text : value, ...(dr ? { draft: S + "draft.label", draftFills: { handle: dr.askedBy } } : {}) })
        + (dr && dr.untested ? ` <span class="mk-tag">${W("ai.label.untested")}</span>` : "") + help;
    };
    const out = [cs.title(), `<p>${W(S + "private")}</p><p class="mk-note">${W(S + "protects")}</p>`];

    // the court sentence, once (R7)
    if (ui.court) out.push(`<p class="mk-msg" data-shown="court">${W(S + "court")}</p>`);

    // a new note
    const write = cs.act("notewrite");
    if (write) out.push(`<div>${textField("mn-new", "new", "")}${write}</div>`);

    // the notes kept, each with its acts in its panel (interface-shell R19); none kept is told nothing (R28)
    if (!data.notes || data.notes.state !== "empty") out.push(cs.sec(S + "kept.heading", cs.state(data.notes, (v) => cs.rows({
      id: "notes", cols: [S + "col.note", S + "col.when"], items: v.notes || [], key: (n) => String(n.note), name: (n) => String(n.text).slice(0, 60),
      cells: (n) => [
        `<span class="rec">${E(n.text)}</span>`,
        `${E(D(n.at))}${n.revised ? " · " + W(S + "revised", { date: D(n.revised) }) : ""} · ${W(S + "onlyyou")}${(n.turned || []).map((t) => " · " + W(S + "turned." + (["observation", "hunch", "question"].indexOf(t.into) >= 0 ? t.into : "other"), { id: t.id })).join("")}`,
      ],
      acts: (n) => {
        const id = String(n.note);
        const p = [];
        const rev = cs.act("noterevise", { data: { note: id } });
        if (rev) p.push(`<div>${textField("mn-r" + id, "note:" + id, n.text)}${rev}</div>`);
        const turn = cs.act("noteturn", { data: { note: id } });
        if (turn) p.push(`<div><fieldset><legend>${W(S + "turn.into")}</legend>${["observation", "hunch", "question"].map((k, i) => `<label for="mn-${k}${id}"><input type="radio" id="mn-${k}${id}" name="mn-into${id}"${i === 0 ? " checked" : ""}>${W(S + "turn." + k)}</label>`).join("")}</fieldset>
${cs.field("mn-made" + id, S + "turn.made", { help: S + "turn.made.help" })}
${cs.field("mn-inq" + id, S + "turn.inquiry", { help: S + "turn.inquiry.help" })}
${cs.choice("mn-kind" + id, S + "turn.kind", ["cause", "identity", "relation", "flow", "other"].map((k) => [k, S + "turn.kind." + k]))}
${cs.field("mn-about" + id, S + "turn.about", { help: S + "turn.about.help" })}${turn}</div>`);
        p.push(cs.act("notedelete", { data: { note: id } }));
        return p.join("");
      },
    }))));
    return out.join("");
  },

  acts: [
    { op: "notewrite", rereads: ["notes"],
      send(view, el, cs) { const text = String(cs.value("mn-new") || "").trim(); return text ? { body: { text } } : { refuse: "screen.notes.notext" }; },
      // the court sentence the first time this member keeps a note, while the group tells members (R7)
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        const d = view.data || {};
        const tell = !!(d.court && d.court.state === "ok" && d.court.value && d.court.value.choice === "tell");
        const first = !!(d.notes && d.notes.state === "empty");
        const court = !!((a && a.courtStatement) || (tell && first));
        if (court || (view.ui && view.ui.court)) cs.set("court", court);
        if (view.ui && view.ui.draft) cs.set("draft", null);
      } },
    { op: "noterevise", rereads: ["notes"],
      send(view, el, cs) { const n = el.dataset.note; const text = String(cs.value("mn-r" + n) || "").trim(); return text ? { body: { note: Number(n), text } } : { refuse: "screen.notes.notext" }; },
      done(view, answer, cs) { if (view.ui && view.ui.draft) cs.set("draft", null); } },
    { op: "notedelete", rereads: ["notes"],
      send(view, el) { return { body: { note: Number(el.dataset.note) } }; } },
    // the owner's two shapes (hypotheses R13): into a hunch, or the link to an observation or question already made
    { op: "noteturn", rereads: ["notes"],
      send(view, el, cs) {
        const n = el.dataset.note, note = Number(n);
        const into = cs.value("mn-hunch" + n) === true ? "hunch" : cs.value("mn-question" + n) === true ? "question" : "observation";
        if (into === "hunch") {
          const inquiry = String(cs.value("mn-inq" + n) || "").trim();
          const ids = String(cs.value("mn-about" + n) || "").split(/[\s,]+/).filter(Boolean);
          const kind = cs.value("mn-kind" + n) || "other";
          if (!inquiry || !ids.length) return { refuse: "screen.notes.turn.incomplete" };
          const pair = ["cause", "identity", "relation"].indexOf(kind) >= 0;
          if (pair && ids.length !== 2) return { refuse: "screen.notes.turn.pair" };
          return { body: { note, into, hunch: { inquiry, kind, about: pair ? { from: ids[0], to: ids[1] } : ids } } };
        }
        const made = String(cs.value("mn-made" + n) || "").trim();
        return made ? { body: { note, into, made } } : { refuse: "screen.notes.turn.nomade" };
      } },
    // the assistant's help with the note's words (wizard-scripts R27; DEC-153): nothing is kept until the member keeps it
    // the member's own words it is told are its reason (interface-shell R11's `reasonField`; DEC-88): op-grades grades it
    // no rung, so the shell would otherwise ask a reason for asking help (REPORT)
    { op: "writinghelp", rereads: [], reasonField: "told",
      send(view, el, cs) {
        const told = String(cs.value(el.dataset.id) || "").trim();
        if (!told) return { refuse: "screen.notes.notext" };
        // which field asked, for the draft to land in (the act's `done` is handed no control)
        cs.set("helping", el.dataset.field);
        return { body: { op: el.dataset.field === "new" ? "notewrite" : "noterevise", field: "text", told } };
      },
      done(view, answer, cs) {
        const a = answer && answer.result !== undefined ? answer.result : answer;
        const me = view.me || {};
        const by = a && a.label && a.label.asked_by ? String(a.label.asked_by).replace(/^member:/, "") : me.member;
        cs.set("draft", { field: (view.ui && view.ui.helping) || "new", text: (a && a.text) || "", askedBy: by === me.member && me.handle ? me.handle : cs.memberName(by), untested: !!(a && (a.untested || (a.label && a.label.untested))) });
      } },
  ],
};
