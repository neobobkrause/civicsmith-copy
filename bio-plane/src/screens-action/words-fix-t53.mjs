/* screens-action's T53 words (R60–R81; K3366, K3943): each sentence written once at its use's key as `localize(id, en)`, so the build
   extracts it into the word table (setup-words R14) and the table wins. WORDS: keys added to SCREEN_WORDS. EXTRA: keys a screen draws that
   do not start with its `screen.<id>.` prefix, by screen id. */
import { localize } from "../setup-words/index.mjs";

const said = [
  // R63: "Move it to resolved" with no resolution chosen
  localize("screen.action.move.resolution.needed", "Choose how it was resolved first. Nothing was sent."),
  // R64: the order the replies are listed in
  localize("screen.action.replies.order", "Listed by the day each reply arrived, then in the order it was recorded."),
  // R66: a later stage with no entry chosen to follow
  localize("screen.action.reply.follows.needed", "Say which entry this reply follows, under It follows: the request or an earlier reply. Nothing was sent."),
  // R62: a profile guide not offered, with what it lacks; a kind with no profile text
  localize("screen.action.guide.notyet", "Not offered yet: this kind's guide lacks {lacks}.", { lacks: "{lacks}" }),
  localize("screen.action.guide.lacks.writer", "a named writer"),
  localize("screen.action.guide.lacks.sources", "the public sources it was written from"),
  localize("screen.action.guide.lacks.professional_review", "a professional's review"),
  localize("screen.action.guide.lacks.second_approval", "a second member's approval"),
  localize("screen.action.templates.noprofile", "No profile text for this yet."),
  // R77: "Propose another law" with the citation empty
  localize("screen.action.law.citation.needed", "Write the law's citation first. Nothing was sent."),
  // R79: no route known, and why
  localize("screen.action.routes.why", "None of your places' profiles names a procedure for this kind, and no guide of your team's covers it. A rule or a procedure your profile lacks is drafted under Group rules."),
  // R60, R61: the laws a request can go under, each with its level, name and window, and its layer where two layers share a name
  localize("screen.request.law.pick", "{law}", { law: "{law}" }),
  localize("screen.request.law.layer", "in {place}", { place: "{place}" }),
  localize("screen.action.law.layered", "{citation} · in {place}", { citation: "{citation}", place: "{place}" }),
  localize("screen.request.law.needed", "Choose the law it goes under first. Nothing was sent."),
  localize("screen.request.law.ambiguous", "More than one of your places gives a law by this name ({layers}). Choose the one you mean. Nothing was changed.", { layers: "{layers}" }),
  // R76: records help names the law, or says none is on file and how one is added
  localize("screen.help-records.notheld.law", "Your team's Civicsmith doesn't hold records help for this place yet, so none is shown here. The law's own text is the place to look: {laws}.", { laws: "{laws}" }),
  localize("screen.help-records.notheld.nolaw", "Your team's Civicsmith holds no records law for your places yet, so no help is shown here. An administrator adds a place and its rules under Settings, Places and offices."),
  // R73: a team with no body on file names it with the office
  localize("screen.request.office.body.new", "No body is on file yet: name the body that holds the office, such as the city or the agency, and it is recorded with the office."),
  // R74: the pointer to People, as a sentence
  localize("screen.request.nooffice.pointer.people", "If you know which office keeps these records, open People, find that office or its organization, and add the records it keeps there."),
];
void said;

export const WORDS = Object.freeze([
  "screen.action.move.resolution.needed", "screen.action.replies.order", "screen.action.reply.follows.needed", "screen.action.guide.notyet",
  "screen.action.guide.lacks.writer", "screen.action.guide.lacks.sources", "screen.action.guide.lacks.professional_review", "screen.action.guide.lacks.second_approval",
  "screen.action.templates.noprofile", "screen.action.law.citation.needed", "screen.action.routes.none", "screen.action.routes.why",
  "screen.request.law.pick", "screen.request.law.layer", "screen.action.law.layered", "screen.request.law.needed", "screen.request.law.ambiguous",
  "screen.help-records.notheld.law", "screen.help-records.notheld.nolaw", "screen.request.office.body.new", "screen.request.nooffice.pointer.people",
]);
export const EXTRA = Object.freeze({
  // R62: a text's standing (jurisdictions' `textStanding`, reading-guides R20); R79: the door to where a missing rule is drafted
  "help-records": ["screen.places.name", "screen.places.purpose"],
  action: ["text.reviewedby", "text.lastchecked", "guide.procedure.notreviewed", "guide.procedure.notreviewed.by", "screen.grouprules.name", "screen.grouprules.purpose"],
});
