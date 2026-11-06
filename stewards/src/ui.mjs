/* stewards: the pages and their words (R1, R5, R7, R18–R20, R22, R23). Nothing is loaded from another origin; every
   text a reporter or steward supplied is escaped where it is shown. */
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { KINDS, CAPS, RULE_PARTS } from "./config.mjs";

export const PUBLISHER = "Believe in Oakland";
export const STEWARDS = "Civicsmith's stewards";
export const RESPONSIBLE = localize("stewards.ui.responsible", "{stewards} decide every report. {publisher}, the publisher of Civicsmith, is responsible for them.", { stewards: STEWARDS, publisher: PUBLISHER });

/* The shared guide words (R7): byte for byte `stewards/guide.md`, which installer R48's README follows. */
export const GUIDE_PARAGRAPHS = Object.freeze([
  localize("stewards.ui.guide_heading", "What a team holds, and who could compel it"),
  localize("stewards.ui.guide_where", "Your team's Civicsmith keeps its record and its evidence in your team's own hosting account (its Cloudflare account), and nowhere else. Civicsmith's stewards hold none of it, and your team's Civicsmith sends them nothing."),
  localize("stewards.ui.guide_control", "Whoever can sign in to that hosting account controls your team's Civicsmith. They can replace the one-time password, claim it again, read everything in it and lock everyone else out, and no vote of the team's administrators can stop them. Use a team account for it, not anyone's personal login, and add at least one other trusted person to it."),
  localize("stewards.ui.guide_compelled", "Those who could be asked or compelled to hand over what your team's Civicsmith holds are your team itself (and anyone in it who keeps a copy), and its hosting provider, under the law that binds that provider. Civicsmith's stewards cannot be, because they hold none of it."),
  localize("stewards.ui.guide_advice", "This guide is not legal advice. If you need to know what the law could require of your team, ask a lawyer."),
]);
export const GUIDE_TEXT = `${GUIDE_PARAGRAPHS.join("\n\n")}\n`;

/* R7's second part: what this service holds and who could be asked for it. */
export const SERVICE_HOLDS = Object.freeze([
  localize("stewards.ui.service_heading", "What this reporting service holds"),
  localize("stewards.ui.service_holds", "This service, which Civicsmith's stewards run apart from every team's Civicsmith, holds the reports sent to it, the stewards' decisions on them, and the register of withdrawn shared services."),
  localize("stewards.ui.service_compelled", "Civicsmith's stewards could be asked or compelled to hand those over, and so could this service's hosting provider, under the law that binds it. What is kept, and for how long, is said on the reporting page."),
  localize("stewards.ui.service_advice", "This is not legal advice."),
]);

export const KIND_WORDS = Object.freeze({
  fabricated_evidence: localize("stewards.ui.kind_fabricated_evidence", "Fabricated evidence"),
  harassment: localize("stewards.ui.kind_harassment", "Harassment"),
  impersonation: localize("stewards.ui.kind_impersonation", "Impersonation"),
  other: localize("stewards.ui.kind_other", "Other abuse of Civicsmith"),
});
export const SERVICE_WORDS = Object.freeze({
  shared_profile: localize("stewards.ui.service_shared_profile", "A shared profile contribution"),
  template_library: localize("stewards.ui.service_template_library", "An item of the template library"),
  public_listing: localize("stewards.ui.service_public_listing", "A public listing"),
});
export const STATE_WORDS = Object.freeze({
  undecided: localize("stewards.ui.state_undecided", "Undecided"),
  dismissed: localize("stewards.ui.state_dismissed", "Dismissed"),
  withdrawn: localize("stewards.ui.state_withdrawn", "Withdrawn"),
});
export const DECISION_WORDS = Object.freeze({
  dismiss: localize("stewards.ui.decision_dismiss", "Dismissed"),
  withdraw: localize("stewards.ui.decision_withdraw", "Withdrawn"),
  reinstate: localize("stewards.ui.decision_reinstate", "Reinstated"),
});

/* R24: the parts of the approved listing rule, in words, by their number. */
export const RULE_PART_WORDS = Object.freeze({
  1: localize("stewards.ui.rule_part_1", "it is not a team using Civicsmith, or it is advertising or spam"),
  2: localize("stewards.ui.rule_part_2", "it pretends to be another team, person or office"),
  3: localize("stewards.ui.rule_part_3", "it was published against a court's order, or it is unlawful to publish"),
  4: localize("stewards.ui.rule_part_4", "it is aimed at a private person's home, family or private life"),
});

/* R26: what the steward may tell the group, by their own mail; the service sends it nowhere. */
export const TELL_GROUP_KEY = "stewards.ui.tell_group_listing";
export const tellGroupSentence = ({ rule_part, reason }) => localize("stewards.ui.tell_group_listing",
  "Civicsmith's stewards have removed your team's public listing. It breaks part {number} of the listing rule: {part}. The stewards' reason: {reason}",
  { number: rule_part, part: RULE_PART_WORDS[rule_part] ?? rule_part, reason });
export const TELL_GROUP = Object.freeze({
  send: (contact) => localize("stewards.ui.tell_group_send", "If you tell the team, send it by your own mail to the contact given: {contact}. This service sends nothing to the team.", { contact }),
  noContact: localize("stewards.ui.tell_group_no_contact", "No contact was given, so the team is told nothing. No public status line exists for a declined or removed team."),
});
const tellGroupBlock = (d, contact) => `<section class="notice" data-word="${TELL_GROUP_KEY}"><h3>${esc(localize("stewards.ui.tell_group_heading", "What to tell the team"))}</h3>`
  + `<p data-part="${esc(d.rule_part)}">${esc(tellGroupSentence(d))}</p>`
  + `<p>${esc(contact == null ? TELL_GROUP.noContact : TELL_GROUP.send(contact))}</p></section>`;

/* A sentence that holds one link: the link's place is a marker in the sentence, put back after the sentence is escaped. */
const MARK = "\u0001";
const embed = (sentence, html) => esc(sentence).replace(MARK, () => html);

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const when = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

const CSS = `body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;max-width:44rem;margin:0 auto;padding:1rem;line-height:1.5;color:#1b1b1b;background:#fff}
@media (prefers-color-scheme:dark){body{color:#e8e8e8;background:#161616}input,textarea,select{color:#e8e8e8;background:#222}}
h1{font-size:1.4rem}h2{font-size:1.15rem}label{display:block;margin-top:.8rem;font-weight:600}
input,textarea,select{width:100%;box-sizing:border-box;font:inherit;padding:.4rem}textarea{min-height:10rem}
button{margin-top:1rem;font:inherit;padding:.5rem 1rem}.notice{border-left:4px solid #888;padding-left:.8rem}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #8884;padding:.3rem;text-align:left;vertical-align:top}
.small{font-size:.9rem}footer{margin-top:2rem;font-size:.9rem}`;

export function page(title, body, { steward = false } = {}) {
  const header = steward ? localize("stewards.ui.header_stewards", "Civicsmith · for Civicsmith's stewards")
    : localize("stewards.ui.header_public", "Civicsmith · reporting abuse to Civicsmith's stewards");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<title>${esc(localize("stewards.ui.page_title", "{title} · Civicsmith", { title }))}</title><style>${CSS}</style></head><body>`
    + `<header><p class="small">${esc(header)}</p></header>`
    + `<main>${body}</main><footer><p>${esc(RESPONSIBLE)}</p>`
    + (steward ? "" : `<p><a href="/">${esc(localize("stewards.ui.link_report_abuse", "Report abuse"))}</a> · <a href="/guide">${esc(localize("stewards.ui.link_guide", "What a team holds, and who could compel it"))}</a> · <a href="/withdrawals">${esc(localize("stewards.ui.link_withdrawals", "Withdrawn shared services"))}</a></p>`)
    + `</footer></body></html>`;
}

export const html = (body, status = 200, headers = {}) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", ...headers } });

/* R1: while not yet open. */
export const NOT_YET_OPEN_HEADING = localize("stewards.ui.not_yet_open_heading", "Reporting to Civicsmith's stewards is not yet open");
export const notYetOpenPage = () => page(localize("stewards.ui.not_yet_open_title", "Not yet open"), `<h1>${esc(NOT_YET_OPEN_HEADING)}</h1>`
  + `<p>${esc(localize("stewards.ui.not_yet_open_body", "The service that receives reports of abuse of Civicsmith itself is not yet open, so it cannot take a report now."))}</p>`
  + `<p><a href="/guide">${esc(localize("stewards.ui.link_guide", "What a team holds, and who could compel it"))}</a></p>`);

/* R5: the notice's sentences, in order; the address's place in the e-mail sentence is MARK. */
export const noticeSentences = (cfg) => [
  localize("stewards.ui.notice_purpose", "Use this form to report abuse of Civicsmith itself: fabricated evidence, harassment or impersonation, or other abuse, by or about a team's public identity or a published case."),
  localize("stewards.ui.notice_limits", "{stewards} read every report. They may only withdraw a shared service (a shared profile contribution, an item of the template library, a public listing). They never edit or delete a team's record, and they have no way into any team's Civicsmith.", { stewards: STEWARDS }),
  localize("stewards.ui.notice_contact", "You do not need an account. The contact field is optional and is used only to reply to you; without it the stewards cannot reply."),
  localize("stewards.ui.notice_kept", "What is kept: your report and, if you give one, your contact. Only {stewards} read them. Your contact is erased {contact_days} days after the stewards' latest decision on your report, and the report itself is deleted {report_days} days after it. A report not yet decided is kept until it is decided.", { stewards: STEWARDS, contact_days: cfg.contactDays, report_days: cfg.reportDays }),
  localize("stewards.ui.notice_email", "You can also send a report by e-mail to {address}.", { address: MARK }),
  localize("stewards.ui.notice_advice", "This service gives no legal advice."),
  RESPONSIBLE,
];

export function reportPage(cfg) {
  const kinds = KINDS.map((k) => `<option value="${k}">${esc(KIND_WORDS[k])}</option>`).join("");
  const mail = `<a href="mailto:${esc(cfg.address)}">${esc(cfg.address)}</a>`;
  const notice = noticeSentences(cfg).map((x) => `<p>${embed(x, mail)}</p>`).join("\n");
  const title = localize("stewards.ui.report_title", "Report abuse of Civicsmith");
  return page(title, `<h1>${esc(title)}</h1>
<section class="notice" id="notice">
${notice}
</section>
<form method="post" action="/report">
<label for="kind">${esc(localize("stewards.ui.label_kind", "What kind of abuse"))}</label><select id="kind" name="kind" required>${kinds}</select>
<label for="concerns">${esc(localize("stewards.ui.label_concerns", "Which team or published case it concerns"))}</label>
<input id="concerns" name="concerns" required maxlength="${CAPS.concerns}" placeholder="${esc(localize("stewards.ui.placeholder_concerns", "a team's short name, or an https:// address"))}">
<label for="description">${esc(localize("stewards.ui.label_description", "What happened"))}</label>
<textarea id="description" name="description" required maxlength="${CAPS.description}"></textarea>
<label for="contact">${esc(localize("stewards.ui.label_contact", "How to reply to you (optional)"))}</label>
<input id="contact" name="contact" maxlength="${CAPS.contact}">
<button type="submit">${esc(localize("stewards.ui.button_send", "Send the report"))}</button>
</form>`);
}

export const RECEIVED = Object.freeze({
  withContact: localize("stewards.ui.received_with_contact", "A steward replies only by the contact you gave, if a reply is needed."),
  withoutContact: localize("stewards.ui.received_without_contact", "You gave no contact, so the stewards cannot reply to you."),
});
export const receivedPage = (ref, hasContact) => page(localize("stewards.ui.received_title", "Report received"), `<h1>${esc(localize("stewards.ui.received_heading", "Your report has been received"))}</h1>
<p>${embed(localize("stewards.ui.received_reference", "Its reference is {ref}.", { ref: MARK }), `<strong id="ref">${esc(ref)}</strong>`)}</p>
<p>${esc(hasContact ? RECEIVED.withContact : RECEIVED.withoutContact)}</p>
<p><a href="/">${esc(localize("stewards.ui.link_back", "Back"))}</a></p>`);

export const refusedPage = (status, code, words, { steward = false } = {}) => {
  const title = localize("stewards.ui.refused_title", "Not accepted");
  return page(title, `<h1>${esc(title)}</h1><p>${esc(words)}</p><p class="small">${esc(code)}</p>`, { steward });
};

/* R7. */
export function guidePage(open) {
  const [head, ...paras] = GUIDE_PARAGRAPHS;
  const [h2, ...more] = SERVICE_HOLDS;
  const link = `<a href="/">${esc(localize("stewards.ui.link_reporting_page", "the reporting page"))}</a>`;
  return page(localize("stewards.ui.guide_title", "What a team holds"), `<section id="guide"><h1>${esc(head)}</h1>${paras.map((p) => `<p>${esc(p)}</p>`).join("")}</section>`
    + `<section id="service"><h2>${esc(h2)}</h2>${more.map((p) => `<p>${esc(p)}</p>`).join("")}</section>`
    + (open ? `<p>${embed(localize("stewards.ui.guide_report_link", "To report abuse of Civicsmith itself, use {link}.", { link: MARK }), link)}</p>` : ""));
}

/* R22. */
export const publicRegisterPage = (rows) => page(localize("stewards.ui.register_title", "Withdrawn shared services"), `<h1>${esc(localize("stewards.ui.register_heading", "Shared services withdrawn by Civicsmith's stewards"))}</h1>
<p>${esc(localize("stewards.ui.register_intro", "Each line is a shared service the stewards have withdrawn and not reinstated, with the kind of abuse reported. No team's record is ever changed by a withdrawal."))}</p>`
  + (rows.length ? `<table><thead><tr><th>${esc(localize("stewards.ui.column_service", "Shared service"))}</th><th>${esc(localize("stewards.ui.column_item", "Item"))}</th><th>${esc(localize("stewards.ui.column_since", "Since"))}</th><th>${esc(localize("stewards.ui.column_kind_of_abuse", "Kind of abuse"))}</th></tr></thead><tbody>`
    + rows.map((r) => `<tr><td>${esc(SERVICE_WORDS[r.service] || r.service)}</td><td>${esc(r.item)}</td><td>${esc(when(r.since))}</td><td>${esc(KIND_WORDS[r.kind] || r.kind)}</td></tr>`).join("")
    + `</tbody></table>` : `<p>${esc(localize("stewards.ui.register_none", "None stands."))}</p>`));

/* The stewards' pages (R8, R11–R13). */
export const signinPage = () => page(localize("stewards.ui.signin_title", "Stewards' sign-in"), `<h1>${esc(localize("stewards.ui.signin_heading", "Sign in, Civicsmith's stewards"))}</h1>
<form method="post" action="/steward/signin"><label for="name">${esc(localize("stewards.ui.label_name", "Name"))}</label><input id="name" name="name" required autocomplete="username">
<label for="key">${esc(localize("stewards.ui.label_key", "Key"))}</label><input id="key" name="key" type="password" required autocomplete="current-password">
<button type="submit">${esc(localize("stewards.ui.button_signin", "Sign in"))}</button></form>`, { steward: true });

export const stewardHome = (name) => page(localize("stewards.ui.home_title", "Stewards"), `<h1>${esc(localize("stewards.ui.home_heading", "Civicsmith's stewards"))}</h1><p>${esc(localize("stewards.ui.home_signed_in", "Signed in as {name}.", { name }))}</p>
<p><a href="/steward/reports">${esc(localize("stewards.ui.link_reports", "Reports"))}</a> · <a href="/steward/withdrawals">${esc(localize("stewards.ui.link_register_json", "The register (JSON)"))}</a></p>
<form method="post" action="/steward/signout"><button type="submit">${esc(localize("stewards.ui.button_signout", "Sign out"))}</button></form>`, { steward: true });

export const reportsPage = (reports, n, more) => page(localize("stewards.ui.reports_title", "Reports"), `<h1>${esc(localize("stewards.ui.reports_title", "Reports"))}</h1><table><thead><tr><th>${esc(localize("stewards.ui.column_reference", "Reference"))}</th><th>${esc(localize("stewards.ui.column_kind", "Kind"))}</th><th>${esc(localize("stewards.ui.column_concerns", "Concerns"))}</th><th>${esc(localize("stewards.ui.column_received", "Received"))}</th><th>${esc(localize("stewards.ui.column_state", "State"))}</th></tr></thead><tbody>`
  + reports.map((r) => `<tr><td><a href="/steward/report/${esc(r.ref)}">${esc(r.ref)}</a></td><td>${esc(KIND_WORDS[r.kind])}</td><td>${esc(r.concerns)}</td><td>${esc(when(r.received))}</td><td>${esc(STATE_WORDS[r.state] || r.state)}</td></tr>`).join("")
  + `</tbody></table><p>${n > 1 ? `<a href="${n === 2 ? "/steward/reports" : `/steward/reports/${n - 1}`}">${esc(localize("stewards.ui.link_newer", "Newer"))}</a> ` : ""}${more ? `<a href="/steward/reports/${n + 1}">${esc(localize("stewards.ui.link_older", "Older"))}</a>` : ""}</p><p><a href="/steward">${esc(localize("stewards.ui.link_home", "Home"))}</a></p>`, { steward: true });

export function reportDetailPage({ report: r, decisions, standing }) {
  const services = Object.entries(SERVICE_WORDS).map(([k, w]) => `<option value="${k}">${esc(w)}</option>`).join("");
  const reason = esc(localize("stewards.ui.label_reason", "Reason"));
  const decided = (d) => `<li>${esc(when(d.at))} · ${esc(d.steward)} · ${esc(DECISION_WORDS[d.decision] || d.decision)}`
    + `${d.service ? ` · ${esc(SERVICE_WORDS[d.service] || d.service)} ${esc(d.item)}${d.already ? ` ${esc(localize("stewards.ui.already_withdrawn", "(already withdrawn)"))}` : ""}` : ""}`
    + `${d.rule_part != null ? ` · ${esc(localize("stewards.ui.decision_rule_part", "listing rule part {number} (text of {version})", { number: d.rule_part, version: d.rule_text_version }))}` : ""}: ${esc(d.reason)}`
    + `${d.decision === "withdraw" && d.service === "public_listing" && d.rule_part != null ? tellGroupBlock(d, r.contact) : ""}</li>`;
  const parts = RULE_PARTS.map((k) => `<option value="${k}">${esc(localize("stewards.ui.option_rule_part", "{number}: {part}", { number: k, part: RULE_PART_WORDS[k] }))}</option>`).join("");
  return page(localize("stewards.ui.detail_title", "Report {ref}", { ref: r.ref }), `<h1>${esc(localize("stewards.ui.detail_title", "Report {ref}", { ref: r.ref }))}</h1>
<p>${esc(localize("stewards.ui.detail_summary", "{kind} · received {received} · {state}", { kind: KIND_WORDS[r.kind], received: when(r.received), state: STATE_WORDS[r.state] || r.state }))}</p>
<p><strong>${esc(localize("stewards.ui.detail_concerns", "Concerns:"))}</strong> ${esc(r.concerns)}</p><p><strong>${esc(localize("stewards.ui.detail_contact", "Contact:"))}</strong> ${r.contact == null ? esc(localize("stewards.ui.detail_contact_none", "none kept")) : esc(r.contact)}</p>
<h2>${esc(localize("stewards.ui.detail_description", "Description"))}</h2><pre style="white-space:pre-wrap">${esc(r.description)}</pre>
<h2>${esc(localize("stewards.ui.detail_decisions", "Decisions"))}</h2>${decisions.length ? `<ul>${decisions.map(decided).join("")}</ul>` : `<p>${esc(localize("stewards.ui.detail_decisions_none", "None yet."))}</p>`}
<h2>${esc(localize("stewards.ui.detail_decide", "Decide"))}</h2><form method="post" action="/steward/decide"><input type="hidden" name="ref" value="${esc(r.ref)}">
<label for="decision">${esc(localize("stewards.ui.label_decision", "Decision"))}</label><select id="decision" name="decision"><option value="dismiss">${esc(localize("stewards.ui.option_dismiss", "Dismiss"))}</option><option value="withdraw">${esc(localize("stewards.ui.option_withdraw", "Withdraw a shared service"))}</option></select>
<label for="service">${esc(localize("stewards.ui.label_service", "Shared service (to withdraw)"))}</label><select id="service" name="withdraw_service"><option value=""></option>${services}</select>
<label for="item">${esc(localize("stewards.ui.label_item", "Item (to withdraw)"))}</label><input id="item" name="withdraw_item" maxlength="${CAPS.item}">
<label for="rule_part">${esc(localize("stewards.ui.label_rule_part", "Part of the listing rule (a public listing only)"))}</label><select id="rule_part" name="withdraw_rule_part"><option value=""></option>${parts}</select>
<label for="reason">${reason}</label><textarea id="reason" name="reason" required maxlength="${CAPS.reason}"></textarea><button type="submit">${esc(localize("stewards.ui.button_record", "Record the decision"))}</button></form>`
  + standing.map((w) => `<h2>${esc(localize("stewards.ui.reinstate_heading", "Reinstate {service} {item}", { service: SERVICE_WORDS[w.service] || w.service, item: w.item }))}</h2><form method="post" action="/steward/reinstate"><input type="hidden" name="service" value="${esc(w.service)}"><input type="hidden" name="item" value="${esc(w.item)}"><label>${reason}</label><textarea name="reason" required maxlength="${CAPS.reason}"></textarea><button type="submit">${esc(localize("stewards.ui.button_reinstate", "Reinstate"))}</button></form>`).join("")
  + `<p><a href="/steward/reports">${esc(localize("stewards.ui.link_reports", "Reports"))}</a></p>`, { steward: true });
}

/* R14: the notice to the stewards' address, a line at a time. No description, concerns, contact, key or session. */
export const noticeLines = ({ ref, kind, received, stewardsPage }) => [
  localize("stewards.ui.notice_arrived", "A report has arrived at Civicsmith's stewards' reporting service."),
  "",
  localize("stewards.ui.notice_reference", "Reference: {ref}", { ref }),
  localize("stewards.ui.notice_kind", "Kind: {kind}", { kind: KIND_WORDS[kind] }),
  localize("stewards.ui.notice_received", "Received: {received}", { received: when(received) }),
  "",
  localize("stewards.ui.notice_read", "Read it, signed in, at {page}", { page: stewardsPage }),
];
export const notifyText = (facts) => `${noticeLines(facts).join("\r\n")}\r\n`;
