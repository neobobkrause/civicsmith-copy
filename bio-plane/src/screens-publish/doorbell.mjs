/* The doorbell's page (registry screen `doorbell`; R9; DEC-78), drawn in the public frame with no session
 * (interface-shell R30) at `/app/doorbell`, headed by the group's public name: what happens to what is sent, a file, a
 * note and a secret phrase, each optional but the material; "Hand it over" sends them with no credential. The secret
 * phrase is never kept by the page. Every function is self-contained (interface-shell R21 (1)). */
import { PARTS } from "./parts.mjs";

export const DOORBELL = Object.freeze({
  id: "doorbell",
  parts: PARTS,

  reads: function () { return { group: { op: "groupidentity" } }; },

  render: function (cs, view) {
    const g = view.data.group && view.data.group.state === "ok" ? view.data.group.value : null;
    const group = g ? g.display_name || g.group || "" : "";
    const out = [];
    out.push('<div class="mk-setuphead"><span class="mk-grp">' + cs.esc(group) + "</span></div>");
    out.push(cs.title(group ? cs.w("screen.doorbell.heading", { group: group }) : null));
    out.push('<p class="mk-sub">' + cs.w("screen.doorbell.sub") + "</p>");
    out.push('<ul class="mk-list" data-what-happens>' + ["only", "reads", "phrase", "court"].map(function (k) { return "<li>" + cs.w("screen.doorbell.happens." + k) + "</li>"; }).join("") + "</ul>");
    if (view.ui.received) {
      out.push('<p class="mk-note" role="status" data-received>' + cs.w("screen.doorbell.received", { at: { html: cs.date(view.ui.received.at) } }) + "</p>");
      // R49 (B420 1; DEC-387): the receipt the answer holds: the fingerprint (shortened in the middle) and size, the pseudonym when a
      // secret phrase was used or made, and the made phrase, shown in this answer only; each only when the answer carried it.
      const rc = view.ui.received, sz = rc.bytes;
      const size = typeof sz !== "number" || !(sz >= 0) ? "" : sz < 1000 ? sz + " B" : sz < 1e6 ? (sz / 1e3).toFixed(1) + " kB" : (sz / 1e6).toFixed(1) + " MB";
      const sha = String(rc.sha256 || "").replace(/^sha256:/, "");
      out.push('<div data-receipt>' + (sha ? '<p data-fingerprint>' + cs.w("screen.doorbell.receipt.fingerprint", { fingerprint: sha.length > 20 ? sha.slice(0, 8) + "…" + sha.slice(-8) : sha })
        + '</p><p class="mk-small">' + cs.w("screen.doorbell.receipt.fingerprint.help") + "</p>" : "")
        + (size ? '<p data-size>' + cs.w("screen.doorbell.receipt.size", { size: size }) + "</p>" : "")
        + (rc.pseudonym ? '<p data-pseudonym>' + cs.w("screen.doorbell.receipt.pseudonym", { pseudonym: rc.pseudonym }) + '</p><p class="mk-small">' + cs.w("screen.doorbell.receipt.pseudonym.help") + "</p>" : "")
        + (rc.secret ? '<p data-secret>' + cs.w("screen.doorbell.receipt.secret", { secret: rc.secret }) + '</p><p class="mk-note">' + cs.w("screen.doorbell.receipt.secret.note") + "</p>" : "") + "</div>");
      // R67 (I-20; DEC-384): the knock's reference, the `knockId` the doorbell answers (doorbell R11), so the knocker has something to keep; an answer without one draws the receipt as before
      if (view.ui.received.reference) out.push("<h2>" + cs.w("screen.doorbell.after.head") + "</h2><p data-reference>" + cs.w("screen.doorbell.reference", { reference: view.ui.received.reference }) + "</p>");
    }
    out.push(cs.field("db-file", "screen.doorbell.file.label", { type: "file", help: "screen.doorbell.file.help" })
      + cs.field("db-note", "screen.doorbell.note.label", { area: true })
      + cs.field("db-secret", "screen.doorbell.secret.label", { type: "password", autocomplete: "off", help: "screen.doorbell.secret.help" })
      // R49 (B420 1): "Make one for me" is a tick beside the field; ticked, the field stays empty and the doorbell makes the phrase
      + cs.checks("db-make", "screen.doorbell.secret.label", [["make", "screen.doorbell.secret.make", false]]) + '<p class="mk-small">' + cs.w("screen.doorbell.secret.make.help") + "</p>"
      + '<div class="mk-acts">' + cs.act("knock", { tone: "primary" }) + "</div>" + view.parts.said(view, "knock"));
    // R56 (C17; DEC-375): the knocker's own form for what may be published about them: the secret phrase used, the detail's
    // reference, who may be told, and agree or take back. It asks nothing about who they are.
    out.push(cs.sec("screen.doorbell.consent.heading", "<p>" + cs.w("screen.doorbell.consent.intro1") + " " + cs.w("screen.doorbell.consent.intro2") + "</p>"
      + cs.field("dc-secret", "screen.doorbell.secret.label", { type: "password", autocomplete: "off" })
      + cs.field("dc-entry", "screen.doorbell.consent.detail", { rec: true, help: "screen.doorbell.consent.detail.help" })
      + cs.choice("dc-audience", "screen.doorbell.consent.audience", [["member", "screen.doorbell.consent.audience.member"]], { value: "member" })
      + cs.choice("dc-answer", "screen.doorbell.consent.heading", [{ value: "", text: "–" }, { value: "yes", key: "screen.doorbell.consent.yes" }, { value: "no", key: "screen.doorbell.consent.no" }])
      + "<p class=\"muted\">" + cs.w("screen.doorbell.consent.permanent1") + " " + cs.w("screen.doorbell.consent.permanent2") + "</p>"
      + '<div class="mk-acts">' + cs.act("knockerconsent", { tone: "primary" }) + "</div>" + view.parts.said(view, "knockerconsent")));
    return out.join("");
  },

  acts: [
    {
      // R9: "Hand it over": the file, the note and the secret phrase, sent with no credential; refusals by their words.
      op: "knock", label: "act.knock.label.doorbell", rereads: [],
      refusals: { KNOCK_EMPTY: "screen.doorbell.refused.empty", KNOCK_PAYLOAD_TOO_LARGE: "screen.doorbell.refused.large",
        KNOCK_ENVELOPE_TOO_LARGE: "screen.doorbell.refused.large", KNOCKER_SECRET_WEAK: "screen.doorbell.refused.weak",
        RATE_IP: "screen.doorbell.refused.rate", RATE_GLOBAL: "screen.doorbell.refused.rate", BAD_CONTENT: "screen.doorbell.refused.content",
        KNOCK_NOT_STORED: "screen.doorbell.refused.notstored", REQUIRED_ARGUMENT_MISSING: "screen.doorbell.refused.empty" },
      send: async function (view, el, cs) {
        const f = cs.file("db-file");
        const note = String(cs.value("db-note") || "").trim();
        const make = (cs.value("db-make") || []).includes("make");
        const secret = make ? "" : String(cs.value("db-secret") || "");
        if (!f) return { refuse: "screen.doorbell.refused.empty" };
        if (secret && secret.length < 20) return { refuse: "screen.doorbell.refused.weak" };
        const bytes = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
        const body = { contentB64: btoa(bin) };
        // R9 (C28; doorbell R11): the name and type the file states, so the Inbox row and detail show them
        if (typeof f.name === "string" && f.name.trim()) body.fileName = f.name.trim();
        if (typeof f.type === "string" && f.type.trim()) body.mediaType = f.type.trim();
        if (note) body.note = note;
        if (secret) body.knockerSecret = secret;
        else if (make) body.generateSecret = true;
        return { body: body };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "knock", answer)) return { stay: true }; // D29: nothing is received on a refusal
        const r = view.parts.value(answer) || {};
        view.ui.received = { at: new Date(cs.now()).toISOString(), reference: typeof r.knockId === "string" && r.knockId ? r.knockId : "",
          sha256: typeof r.sha256 === "string" ? r.sha256 : "", bytes: typeof r.bytes === "number" ? r.bytes : null,
          pseudonym: typeof r.pseudonym === "string" ? r.pseudonym : "", secret: typeof r.secret === "string" ? r.secret : "" };
        cs.fill("db-note", "");
        cs.fill("db-secret", "");
        return { stay: true };
      },
    },
    {
      // R56: "Send my answer": agree, or take the agreement back; with no answer chosen nothing is sent. Every failure is one
      // refusal (`SECRET_NOT_RECOGNISED`), drawn in its fold with the rate sentences.
      op: "knockerconsent", label: "act.knockerconsent.label.doorbell", rereads: [],
      refusals: { SECRET_NOT_RECOGNISED: function (r, cs) { return cs.w("screen.doorbell.consent.refused.secret"); },
        RATE_IP: function (r, cs) { return cs.w("screen.doorbell.consent.refused.rate") + " " + cs.w("screen.doorbell.consent.refused.rate.next"); },
        RATE_GLOBAL: function (r, cs) { return cs.w("screen.doorbell.consent.refused.rate") + " " + cs.w("screen.doorbell.consent.refused.rate.next"); } },
      send: function (view, el, cs) {
        const answer = String(cs.value("dc-answer") || "");
        const secret = String(cs.value("dc-secret") || "");
        const entry = String(cs.value("dc-entry") || "").trim();
        if (answer !== "yes" && answer !== "no") return null;
        if (!secret || !entry) return null;
        return { body: { knockerSecret: secret, entry: entry, audience: String(cs.value("dc-audience") || "member"), withdraw: answer === "no" } };
      },
      done: function (view, answer, cs) {
        if (view.parts.refused(cs, view, "knockerconsent", answer)) return { stay: true };
        cs.fill("dc-secret", "");
        return { stay: true };
      },
    },
  ],
});
