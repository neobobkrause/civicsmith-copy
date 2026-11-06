# Qualification: publication lane, 6 Nov 2026

The lane's first qualification, under BOB's START (Bob, 6 Nov: "the first time a lane is defined and run, it should start by using workers to fully research canon documents, existing code, and best practices related to their specialty area"). Lane session `session_018BhcecVeBq3c6BYSyTV3Ph`, started by BOB `session_018Bhceff4p3dNtYx3XNk4CX`. Researched at tranche `705f8823d1` (Merge PR 669, lane/publication-seed). The earlier lane's work was read at `design/actions` @ `9185526c7d`.

## What was researched, and by whom

Seven read-only workers (subagents) ran in parallel. Each worked in its own clone at `705f8823`, wrote nothing to it, and reported to the lane. The lane spot-checked the load-bearing citations against tranche (ratification F1 `build/requirements/ratification.md:220`; docket R33 `build/requirements/docket.md:136`; case-authoring F2 `build/requirements/case-authoring.md:279`; `docketRecordEdition` at `bio-plane/src/docket/index.mjs:913`, which no code outside docket calls), and they held.

| Worker | Topic | File | Main sources |
|---|---|---|---|
| 1 | Process3 canon for the lane | `canon-process.md` | Foundations artifact RVZ8szbF1UHHSETkcGrKw8 (SES-14, SES-19–23); `.process/README.md` lane rows; `.process/rulebooks/bob.md`, `job.md`; `.process/notes/lane-charters.md` §4; CLAUDE.md; `process/config.json`; DECISIONS.md BD-2 |
| 2 | Product canon and principles | `canon-publication.md` | `docs/architecture/BIO_Publication_v0_1.md`, `BIO_Case_Making_v0_1.md`, `BIO_Distribution_v0_1.md`; Roadmap values, Design Requirements v2, System Design; Design Principles artifact MvsMPnJnk3o32FBeqgdxT1; the related sections of Membership, Declared Bias, State Rules, TAD, Ladders, Investigation |
| 3 | Action canon and lane history | `canon-actions-and-history.md` | `BIO_Action_v0_2.md` (and v0_1); `design/actions` `docs/development/actions-design/` whole; `docs/development/action-design/`; `build/rulings.md` (K590–K608, K2433, K2775–K2781, K3469, K5558, K5559); artifacts JH9AK7rgmxRNR9QjPL3s5d, 8Ke3MafpR8R4knFDtiMEWx, J8E73nE7Y4qNczAVPTB5Sn, FXfQapxoZFhKbJ4c3UzX3E |
| 4 | Publication-side requirements | `requirements-publication.md` | `build/requirements/` and `process/ledger/` for publication, ratification, docket, signatures, publish-schedule, public-read, screens-publish, screens-public, case-disclosures, case-carriage, case-check, case-checker |
| 5 | Case and action requirements | `requirements-case-action.md` | `build/requirements/` and `process/ledger/` for case-account/authoring/catalogue/grammar/import/inputs/tensions, actions, action-clocks/grammar/holds/plans/producers/records/replies, screens-action |
| 6 | Existing code | `code.md` | `bio-plane/src/` publication, ratification, docket, signatures, `sshsig.mjs`, publish-schedule, public-read, screens-publish, screens-public, case-import, store-assembly; whatever reads `docs/development/publication-design/` |
| 7 | Best practice | `best-practice.md` | OpenSSH PROTOCOL.sshsig; TUF; Sigstore/Rekor; in-toto; RFC 9162; C2SP tlog-cosignature; regulations.gov, CPUC and court docket practice; RONR; SPJ, IFCN; C2PA; W3C VC Data Integrity; WCAG 2.2; plain-language guidance. Every source has a URL and was retrieved 2026-11-06 |

Limits:
- Worker 6 ran no module tests. Every bio-plane suite needs the generated `bio-plane/src/setup-words/rows.mjs`, which is not committed, and building it would have meant writing into the clone.
- Git history in the clones stops at 4 Nov (`47d7bf1d`), so changes before that date come from status lines only.
- Worker 7's "not verified" list is in `best-practice.md`. Among other items, it includes the 12th-edition RONR text on ratification.

## What the lane now holds as ground truth

1. **The lane.** It owns "Publication & action": publication, ratification, docket, case making and the actions around them (BD-2; K2433 is the predecessor lane's charter). It decides design and wording in `docs/development/publication-design/`, within the product's principles. That folder holds only what the build reads, and today the build reads nothing there (`code.md` §1). Design documents are claude.ai artifacts. This folder is research. Asks come only through BOB, and each answer gives the decision, the reason (file:line) and what changes. Questions on values, policy, audiences, principles or doctrine are "decision: Bob's", with options and a recommendation (`canon-process.md` §§1–5).
2. **Canon in force.**
   - Action v0.2 is approved whole (K2775) and placed (K2780). Every decision of the earlier lanes (D1–D28) is folded into canon or requirements (`canon-actions-and-history.md` §3).
   - Publication v0.1 is listed as canon but calls itself DRAFT. Several rulings are missing from it: DEC-147, DEC-180, DEC-461, D56/D57 and the published record of actions.
   - Its §3 rule 15(b)–(d) is stale (`canon-publication.md` §6).
3. **The signature model as built.**
   - Statements are domain-separated by SSHSIG namespace and leading token. There are nine namespaces in `bio-plane/src/sshsig.mjs`; signatures R1 still counts five or six.
   - The docket is append-only and hash-chained per case (`seq`, `previous`).
   - Every public docket entry is signed by the manager's registered key in `NS_DOCKET` over `docketStatement(case, seq, digest)`. The plane holds no member key.
   - The ratification ceremony signs only `bio-ratify` statements (`code.md` §3).
4. **Ratification F1 as found.**
   - Docket R33, amended 4 Nov (BOB, PR 278, option (a); Bob J6 = A, K5559), files an `edition` entry for each ratified edition. The ceremony must also sign that entry with the manager's key: this is the "second signature" over `docketStatement`.
   - `docketRecordEdition` exists (`bio-plane/src/docket/index.mjs:913-982`), with a prepare step and a sign-and-file step. Nothing calls it, and ratification has no `uses` edge to docket.
   - Four facts constrain the design:
     - the entry can only be prepared after the edition's commit;
     - it binds `seq`, `previous` and the UTC day, and goes stale in 60 minutes;
     - "Publish at…" and the sweep commit with no member present;
     - a non-owner may deliver what an owner signed.
   - F1's wording predates R33's amendment and does not say where the signature comes from. Docket R9(b) and R33 disagree on edition 1 (`requirements-publication.md` §2; `code.md` §§3–4).
5. **Practice.** Civicsmith follows current practice in domain separation, canonical signed bytes, an append-only chained log and peer fork detection. It departs in four ways: no trusted timestamps, no signed log head or witness cosignatures, approvals that are `{by, at}` rather than signatures, and one manager able to withdraw alone. `best-practice.md` sets out five shapes for a second signature, with trade-offs (`best-practice.md` §"Implications").

## Found while qualifying (for BOB, not the lane's to fix)

- **Real publishes may be red at tranche.** case-authoring F2 (`build/requirements/case-authoring.md:279`) records that the document `op=publish` prepares lacks `ungraded_passages`/`typed_passages`. Ratification's gate therefore finds `UNGRADED_PASSAGES_MISMATCH` on every real publish, with "8 store-request tests red at tranche". The lane read this in the requirements; it did not run the tests.
- `publication-design`, this lane's module, has no ledger entry, no modules.json row and no requirements file (`canon-process.md` §8.1).
- action-holds and action-replies have no ledger entry (`requirements-case-action.md` §3.11).

## Open questions

Each topic file closes with its own table of open questions. These are the ones that bear on the lane's work first:

| # | Question | Whose call | Where |
|---|---|---|---|
| 1 | F1: is the edition entry signed in the ceremony's sitting, which would need docket to prepare before the commit, or in a second signing round right after it? What do the failure and stale cases show? Does a retry re-sign? | The lane (flow and words); BOB for the requirement changes | `requirements-publication.md` §4.1, §4.4; `code.md` Q1, Q4 |
| 2 | F1 under "Publish at…" and the sweep: leave the entry core-due for the owner, pre-sign and fail closed, or sign a statement that does not bind `seq`/`date` (a public-format change) | The lane; **Bob's** if a signed public format or J6 = A changes | `requirements-publication.md` §4.2; `code.md` Q2, Q3 |
| 3 | Does "second signature" mean the docket statement, as found here, or a second *person* (ratification by the group)? | Bob/BOB, to confirm the ask | `requirements-publication.md` §4.6; `best-practice.md` Q1 |
| 4 | Edition 1: does it get an entry (R33) or not (R9(b))? | BOB; the lane recommends | `code.md` Q5 |
| 5 | Words: the ceremony and docket keys live in the ux lane's words files (`docs/development/ux-substrate/screens/words-*.json`), which is the only place `setup-words` builds from. Which publication-area words are this lane's, and how do they reach the build? | BOB (lane boundary); Bob if it touches UX doctrine | `code.md` Q8; `canon-process.md` §8.3 |
| 6 | Manager or owner: one name for who places docket entries and withdraws an edition (§5D, K5558, v0.2 rules 16–17) | The lane (wording); **Bob's** if the actor changes | `canon-publication.md` §7.3; `canon-actions-and-history.md` §6.3 |
| 7 | Publication canon: v0.1 is DRAFT but in force. The missing rulings need folding in and rule 15(b)–(d) needs rewriting. | The lane drafts; Bob approves; BOB places | `canon-publication.md` §§6–7 |
| 8 | Who drafts requirement changes, and where the lane numbers its own decisions | BOB | `canon-process.md` §8.4–8.5 |

The topic files hold the rest: the Bob's-call doctrine items (DEC-25, DEC-147 timing, audiences, rule 11) and the lane's wording backlog (ceremony, docket shelves, public page, complete edition, `dash-action`, the action forms).

## Next

Once this lands in `tranche`, `lane ask publication` reaches the lane. The first ask is ratification F1's second-signature design over `docketStatement`, and its research is `requirements-publication.md` §2, `code.md` §3 and `best-practice.md` §"Implications".
