/* screens-investigate R9: the member's own ties (Settings › Your ties; registry screen `ties`, its 2 acts; K1490). Reads
 * `people`' `memberties` (the member's own ties, seen only by her and the administrators), with why she is asked and who
 * sees the list in the screen's own sentences. A tie is added with its kind, who, and whether a case that concerns it
 * names her by her handle or says "a member of the group", the disclosure stated either way. */

import { PARTS } from "./parts.mjs";

function reads() {
  return { ties: { op: "memberties", query: {}, empty: (v) => !v || !Array.isArray(v.ties) || !v.ties.filter((t) => !t.withdrawn).length },
    people: { op: "peopledirectory", query: { limit: "200" } } };
}

function render(cs, view) {
  const S = "screen.ties.";
  const me = (view.me && view.me.handle) || "";
  const out = [cs.title()];
  out.push(cs.sec(S + "why", `<ul class="mk-list">${["why.1", "why.2", "why.3", "why.4"].map((k) => `<li>${cs.w(S + k)}</li>`).join("")}</ul>`));
  out.push(cs.sec(S + "who", `<ul class="mk-list">${["who.1", "who.2", "who.3"].map((k) => `<li>${cs.w(S + k)}</li>`).join("")}</ul>`));
  const mine = view.data.ties && view.data.ties.state === "ok" && view.data.ties.value ? (view.data.ties.value.ties || []).filter((t) => !t.withdrawn) : [];
  const who = view.parts.options(view, "people", (v) => v.rows, (r) => ({ value: r.entity, text: r.name || r.entity }));
  const nameOf = (id) => (who.find((o) => o.value === id) || {}).text || id;
  /* R22: a list that holds nothing is not drawn; the designed empty state names the first step */
  const settled = view.data.ties && (view.data.ties.state === "ok" || view.data.ties.state === "empty");
  if (settled && !mine.length) out.push(`<p class="mk-note">${cs.w(S + "first")}</p>`);
  else out.push(cs.sec(S + "list", cs.state(view.data.ties, (v) => cs.rows({ id: "ties", items: (v.ties || []).filter((t) => !t.withdrawn), key: (t) => t.tie_id,
    name: (t) => cs.w(S + "kind." + (["employer", "relative", "business", "other"].includes(t.kind) ? t.kind : "other")),
    cols: [S + "col.kind", S + "col.who", S + "col.disclosed"],
    cells: (t) => [cs.w(S + "kind." + (["employer", "relative", "business", "other"].includes(t.kind) ? t.kind : "other")),
      cs.ref("person", t.entity, nameOf(t.entity), [t.note || ""]) + (t.note ? ` <span class="mk-small">${cs.esc(t.note)}</span>` : ""),
      cs.w(t.attribution === "name" ? S + "says.name" : S + "says.group", { handle: me })],
    acts: (t) => cs.act("withdrawtie", { label: "act.withdrawtie.label.ties", data: { tie: t.tie_id } }) }))));
  /* R34: the two disclosure choices with every fill answered: `{handle}` the member's, `{tie}` the tie she is adding, in words */
  const kindNow = ["employer", "relative", "business", "other"].includes(view.ui["choice:tie-kind"]) ? view.ui["choice:tie-kind"] : "employer";
  const fills = { handle: me, tie: view.parts.plain(cs, S + "kind." + kindNow) };
  out.push(cs.sec(S + "add", cs.choice("tie-kind", S + "kind", [["employer", S + "kind.employer"], ["relative", S + "kind.relative"], ["business", S + "kind.business"], ["other", S + "kind.other"]], { acts: {} })
    + cs.choice("tie-who", S + "whofield", who, {})
    + cs.field("tie-note", S + "note", { area: true, rec: true, help: S + "note.help" })
    + cs.choice("tie-says", S + "says", [["group", S + "says.group.choice", fills], ["name", S + "says.name.choice", fills]], {})
    + `<p class="mk-note">${cs.w(S + "either")}</p>`
    + cs.act("declaretie", { label: "act.declaretie.label.ties", tone: "primary" })));
  return out.join("");
}

const acts = [
  /* "Add this tie": its kind, who, the member's note (her own words serve as the reason, DEC-88) and how a case says it */
  { op: "declaretie", label: "act.declaretie.label.ties", reasonField: "note",
    send(view, el, cs) {
      const entity = String(cs.value("tie-who") || "").trim(), note = String(cs.value("tie-note") || "").trim();
      if (!entity || !note) return { refuse: "screen.ties.add.empty" };
      return { body: { entity, kind: String(cs.value("tie-kind") || "other"), note, attribution: cs.value("tie-says") === "name" ? "name" : "group" } };
    } },
  /* "Remove a tie", from its row, with a reason */
  { op: "withdrawtie", label: "act.withdrawtie.label.ties",
    send(view, el) { return { body: { tieId: String(el.dataset.tie || "") } }; } },
];

const TIES_KEYS = [
  "screen.ties.why", "screen.ties.why.1", "screen.ties.why.2", "screen.ties.why.3", "screen.ties.why.4", "screen.ties.who", "screen.ties.who.1",
  "screen.ties.who.2", "screen.ties.who.3", "screen.ties.list", "screen.ties.first", "screen.ties.col.kind", "screen.ties.col.who",
  "screen.ties.col.disclosed", "screen.ties.kind", "screen.ties.kind.employer", "screen.ties.kind.relative", "screen.ties.kind.business",
  "screen.ties.kind.other", "screen.ties.add", "screen.ties.whofield", "screen.ties.note", "screen.ties.note.help", "screen.ties.says",
  "screen.ties.says.name.choice", "screen.ties.says.group.choice", "screen.ties.says.name", "screen.ties.says.group", "screen.ties.either",
  "screen.ties.add.empty",
];

const words = ["screen.ties.name", "screen.ties.purpose",
  ...["declaretie", "withdrawtie"].flatMap((op) => ["act." + op + ".label.ties", "act." + op + ".does"]),
  "state.empty", "state.loading", "state.failed", ...TIES_KEYS];

export const TIES_SCREEN = Object.freeze({ id: "ties", reads, render, acts, words, parts: PARTS });
