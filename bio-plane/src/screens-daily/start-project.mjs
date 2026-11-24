/* "Start a project" (screens-daily R1, R23, R25, R30, R33, R80; DEC-88, DEC-237 (projects), DEC-384 T-20; N1091), a screen part (interface-shell
   R21, K3002) handed to Home and Projects as `view.parts.startProject`. `form(cs, id, label)` answers the act's own words as
   a disclosure that opens on press (R23): "What it is about" (the title), "Who can find it" (hidden or findable, neither
   chosen for the member, R80) and that it can be changed later with a reason (R30), then the act. `body(cs, view, id, trigger)`
   answers `{ body }`, what `promote` takes: the project's document with its `title` as well as its `objective` (R25: every
   screen reads the title), and the chosen `visibility` (R30); or `{ refuse }`, the word that says what is missing (the title,
   or the visibility, R80: nothing is sent until both are given). Self-contained: it refers only to its parameters. */

export function startProject() {
  const form = function (cs, id, label, act) {
    if (!act) return "";
    return '<details class="mk-details" data-start="project"><summary>' + cs.w(label) + "</summary>"
      + cs.field(id + "-title", "project.start.title", { rec: true, help: "project.start.title.help" })
      // R80: two radios, neither checked: the member chooses who can find the project; nothing is chosen for her.
      + '<fieldset class="mk-checks" id="' + id + '-visibility"><legend>' + cs.w("project.visibility.title") + "</legend>"
      + [["hidden", "project.visibility.start.hidden"], ["discoverable", "project.visibility.start.discoverable"]].map(function (o) {
        return '<label><input type="radio" name="' + id + '-visibility" id="' + id + "-visibility-" + o[0] + '" value="' + o[0] + '"> ' + cs.w(o[1]) + "</label>";
      }).join("") + "</fieldset>"
      + '<p class="mk-small muted">' + cs.w("project.visibility.start.later") + "</p>"
      + '<div class="mk-acts">' + act + "</div></details>";
  };
  const body = function (cs, view, id, trigger) {
    const title = String(cs.value(id + "-title") || "").trim();
    if (!title) return { refuse: null };
    const chosen = cs.value(id + "-visibility");
    const picked = Array.isArray(chosen) && chosen.length === 1 && (chosen[0] === "hidden" || chosen[0] === "discoverable") ? chosen[0] : "";
    if (!picked) return { refuse: "project.visibility.start.required" };
    const visibility = picked;
    // `cs.w` answers HTML; the session log is text, so the entities it made are undone.
    const plain = function (s) { return String(s).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); };
    const iso = new Date(cs.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
    const nonce = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    const text = "---\nobject_type: project\ntitle: " + JSON.stringify(title) + "\nobjective: " + JSON.stringify(title)
      + "\ncurrent_state: forming\ncreated: \"" + iso + "\"\nlast_updated: \"" + iso + "\"\n---\n\n## Session Log\n\n### Session " + iso
      + " | Formation | interactive\nTrigger: " + plain(cs.w(trigger)) + "\nChanges: created.\n";
    return { body: {
      base: null,
      snapKey: iso.replace(/[-:]/g, "") + "_" + nonce,
      meta: { object_type: "project", title: title, current_state: "forming", created: iso, last_updated: iso },
      files: [{ path: "bundle.md", text: text }],
      register: [],
      visibility: visibility,
    } };
  };
  return { form: form, body: body };
}
