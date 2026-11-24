/* A published case's docket, from outside (registry screen `docket-public`; R34; DEC-313 (6)), drawn in the published frame
 * with no session at `/app/docket-public/<case>`: the case's posted entries, oldest first, each with what it is, what it
 * says and when it was first published, read only from `docketpublic` (`public-read` R21) with no credential. No draft is
 * drawn and no act is offered; members keep `docket` in the working frame. Its way back is the case's public page. Every
 * function is self-contained (interface-shell R21 (1)). */
import { PARTS } from "./parts.mjs";

export const DOCKET_PUBLIC = Object.freeze({
  id: "docket-public",
  parts: PARTS,

  reads: function (view) {
    if (!view.parts.subject(view, 1)) return {}; // K3171: no subject in the address, no subject read
    // The case is the subject: a case the docket does not know is "Nothing is here" (interface-shell R35).
    return { docket: { op: "docketpublic", query: { case: String(view.subject || "").split("/")[0] }, subject: true } };
  },

  render: function (cs, view) {
    if (!view.parts.subject(view, 1)) return view.parts.nothing(cs, "public"); // the way an outsider can go, never "Go to Home"
    const caseId = String(view.subject || "").split("/")[0];
    const out = [cs.title(null), '<p class="mk-sub">' + cs.w("screen.docket-public.sub") + "</p>"];
    const entries = function (v) {
      const kinds = ["edition", "correction", "withdrawal", "court-order", "response", "statement", "reaction", "outcome"];
      const list = Array.isArray(v.entries) ? v.entries : [];
      return cs.sheet(list.map(function (e) {
        const f = e.fields && typeof e.fields === "object" ? e.fields : {};
        const said = f.summary || f.reason || f.what_changed || "";
        return cs.row("", "<b>" + cs.w("screen.docket.kind." + (kinds.includes(f.kind) ? f.kind : "other")) + "</b>" + (said ? ' · <span class="rec">' + cs.esc(said) + "</span>" : ""),
          '<span class="meta">' + (e.published_at || f.date ? cs.date(e.published_at || f.date) : "") + "</span>");
      }).join(""));
    };
    out.push(view.data.docket && view.data.docket.state === "ok" && !(Array.isArray(view.data.docket.value.entries) && view.data.docket.value.entries.length)
      ? '<p class="cs-state" data-state="empty">' + cs.w("state.empty") + "</p>" : cs.state("docket", entries));
    out.push('<p><a class="cs-btn" data-tone="quiet" href="/app/published/' + encodeURIComponent(caseId) + '" data-nav data-public-page>' + cs.w("screen.docket-public.back") + "</a></p>");
    return out.join("");
  },

  acts: [],
});
