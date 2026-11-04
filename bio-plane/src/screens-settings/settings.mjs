/* screens-settings R17 (DEC-201 (8)): Settings, every setting in one list. "Yours" first (your account, your AI (`aimine`),
   your ties, your notes, your recovery codes), then, to a session that administers, "The team's" (your team, who your
   team is, members, the team's AI providers (`aiproviders`; R47, R95: `connect` and `teamai` are retired), places and offices, security, updates, translations, wizards), then "For every member" (the declared bias, `bias`, DEC-387, and the team's own rules, `grouprules`, C87). Each entry is a reference to its screen, its
   name and purpose the registry screen's own words (`screen.<id>.name`, `.purpose`). It reads nothing of its own: the
   shell's `whoami` says whether the session administers (interface-shell R12). Every function is self-contained
   (interface-shell R21). */

export const settings = {
  id: "settings",

  reads() { return {}; },

  render(cs, view) {
    const W = cs.w, S = "screen.settings.";
    const me = view.me || {};
    // the design's link list (R32): each section is its icon and its screen's name as the reference, its purpose beneath as a box of
    // its own, so the two never run together
    const ICON = { account: "subject", aimine: "machine", ties: "group", notes: "case", recovery: "signed", group: "group", "group-identity": "group", members: "subject", aiproviders: "machine",
      places: "group", security: "status", updates: "changed", translations: "wizard", wizards: "wizard", bias: "flagged", grouprules: "group", watching: "clock", leads: "case" };
    const I = (n) => `<svg class="i" aria-hidden="true"><use href="/app/assets/icons.svg#i-${n}"/></svg>`;
    // the design holds no purpose for the two doors added in the fix round (C91), so none is drawn for them
    const list = (ids) => `<div class="mk-links" data-list="settings">${ids.map((id) => `<a class="cs-ref" href="/app/${id}" data-nav data-screen="${id}">${I(ICON[id])}${W("screen." + id + ".name")}</a><span class="mk-small" data-purpose="${id}">${W("screen." + id + ".purpose")}</span>`).join("")}</div>`;
    const out = [cs.title(), cs.sec(S + "yours", list(["account", "aimine", "ties", "notes", "recovery"]))];
    if (me.administer === true) out.push(cs.sec(S + "groups", list(["group", "group-identity", "members", "aiproviders", "places", "security", "updates", "translations", "wizards"])));
    // the third section, for every member: the declared bias (DEC-387)
    // C91: the doors to the watched addresses and to the leads, to a member or an administrator who may use them
    // C87 (d): the team's own rules too, which any member drafts and another confirms; Places refers to them, but no Settings list did
    out.push(cs.sec(S + "everyone", list(["bias", "grouprules", ...(cs.can("monitoring") ? ["watching"] : []), ...(cs.can("lead") ? ["leads"] : [])])));
    return out.join("");
  },

  acts: [],
};
