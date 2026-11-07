# funding-register — requirements

**Status** · Drafted 7 Nov 2026 by BOB from the publication lane's BD-15 design (PF-6; docs/development/publication-design-research/bd-15-requirements.md; DECISIONS.md BD-15). A new module, layer 8, joined to layer 11. Every requirement not yet met.

## Public

### Purpose

A group's owners keep a register of who funds the group's work, so that a case may state its funding (BD-15). Stating funding is optional. The register names what BD-15 names: every institutional and in-kind funder at any amount, and individuals only at $5,000 or more a year or for a gift given for one case. AI vendor credits are not funding and are not offered. The register holds no amounts.

### Provides

**R1** *(not yet met: BD-15, PF-6)* Owners record and end funding sources. `fundingAdd({group, kind, name, entity?, for, case?, role, basis?, what?, by})` enters one source. `kind` is one of `group_funds`, `grant`, `donation`, `in_kind`, `commissioned`; `members` is implicit and never entered. `for` is `general` or `this_case` (with `case`). `role` is `none` or the group's own words, up to 600 characters. `in_kind` carries `what`. `fundingEnd({entry, reason, by})` ends an entry; ending never deletes it. Refusals, in this order, write nothing: `MACHINE_CANNOT_RECORD_FUNDING`, `NOT_A_GROUP_OWNER`, `FUNDING_UNKNOWN_KIND`, `FUNDING_NO_NAME`, `FUNDING_FOR_CASE_UNKNOWN`, `FUNDING_INDIVIDUAL_BELOW_THRESHOLD` (an individual's `donation` whose `basis` is neither `5000_or_more_a_year` nor `for_this_case`), `FUNDING_COMMISSION_NO_ROLE` (`commissioned` needs a role other than `none`).

**R2** *(not yet met: BD-15, PF-6)* `fundingOf({group, case?})` answers the live entries, `general` ones and, given a case, that case's `this_case` ones, each with its kind, name, entity, for, role and what. Members may read it. No amount, account or member id is held or answered.
