/* action-grammar — the phrasing lists Civicsmith holds (requirements: `build/requirements/action-grammar.md`, R16; T45,
 * N861, N884, N892 (b); v0.2 rules 2, 9, 21; K2781 (5)).
 *
 * Data, not words a member reads: per language (a BCP 47 primary subtag), per kind of `PHRASING_KINDS`, the phrasings
 * that make a sentence read as an assertion of a breach (rule 2), a policy position (rule 9) or an ask for the group's
 * own benefit (rule 21). A match is pointed out for a member to resolve; it decides nothing (`finder.mjs`). Each phrasing
 * is 2 to 100 characters on one line and names no place, office, person or party (R11). English alone at T45: any
 * other language reads undetermined, never "nothing found" (K2781 (5)); a profile may add phrasings (`jurisdictions`
 * R86), never remove one. The own-benefit list is kept narrow: no phrasing here can be a remedy of the harm (rule 21;
 * K2781 (5)). The lists grow only after M-T45-4 measures them over real letters; none of R16's pinned phrasings is
 * removed without a requirement change. */

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deepFreeze(v); return Object.freeze(o); };

export const PHRASINGS = deepFreeze({
  en: {
    /* R16's pinned list, then the inflections of its verbs (canon's "staff illegally split the contract", S1 §B1). */
    assertion: ["illegal", "illegally", "unlawful", "unlawfully", "violated", "in violation of", "broke the law",
      "in breach of", "breached", "failed to comply with", "covered up",
      "violates", "breaks the law", "breaking the law", "fails to comply with"],
    position: ["we support", "we oppose", "should adopt", "should pass", "should reject", "vote yes", "vote no",
      "vote for", "vote against",
      "we endorse"],
    own_benefit_ask: ["pay us", "pay our", "fund our", "hire us", "contract with us", "donate to us"],
  },
});
