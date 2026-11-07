# jurisdictions-b: notes

## R109: the federal layer's records_help block (job jurisdictions-b, 5 Nov 2026)

For BOB. The federal layer (`jurisdictions/profiles/layers/us-federal.mjs`) now holds a `records_help` block for the Freedom of Information Act. That was R109's one unmet part. Each value was read on the official text of 5 U.S.C. § 552 (govinfo.gov, United States Code 2024 Edition). The text was read again on 2026-11-05. Its sha256 matches the 2026-10-21 capture's. The block's basis is `2026-11-05 foia-text`. The subsections it cites that the fixture did not quote are now in `jurisdictions/test/fixtures/foia-text.mjs`, word for word: (a)(2), (a)(3)(B), (a)(4)(A)(ii), (a)(4)(A)(iv), (a)(6)(B)(ii), (a)(6)(B)(iii), (a)(6)(C)(i) and (b). A script checked each quote against the text.

| field | value | read on |
|---|---|---|
| days | 20 (working days) | (a)(6)(A)(i): "20 days (excepting Saturdays, Sundays, and legal public holidays)" |
| extra_days | 10 (working days) | (a)(6)(B)(i): "more than ten working days" |
| extension_reasons | the three unusual circumstances | (a)(6)(B)(iii)(I), (II), (III) |
| answer | (a)(6)(A)(i) | |
| extend | (a)(6)(B)(i) | |
| assist | (a)(6)(B)(ii) | the chance to narrow the request, and the FOIA Public Liaison |
| segregate | (b) | "Any reasonably segregable portion…" |
| refuse_in_writing | (a)(6)(A)(i); (a)(6)(C)(i) | the notice of the decision and its reasons; a denial names the people responsible for it |
| electronic | (a)(3)(B) | "any form or format requested … if … readily reproducible" |
| cost | (a)(4)(A)(ii); (a)(4)(A)(iv) | the fee categories; only direct costs |
| cost_electronic | not provided by the statute | FOIA has no separate fee rule for electronic records. Subsections read: (a)(3)(B), (a)(4)(A)(ii), (a)(4)(A)(iv) |
| inspect_photograph | not provided by the statute | FOIA gives no right to inspect or photograph requested records in person. (a)(2) is about records an agency must post in an electronic format, not about records you request. Subsections read: (a)(2), (a)(3)(A), (a)(3)(B), (a)(4)(A)(ii), (a)(4)(A)(iv) |
| purpose | (a)(3)(A); (a)(4)(A)(ii) | see ruling (3) below |

How the coordinator rulings of 5 Nov 10:24 were applied:

- **Ruling (2), the kind of day.** `days` and `extra_days` are R93's integers. A block has no field for the kind of day, and `validate` refuses any field it doesn't know. The profile shows them as working days through the `foia_response` rule (`count: business`, extension `count: business`, `closures: federal`). The test checks that the block's figures equal that rule's.
- **Ruling (3), purpose.** The text agrees with the ruling. (a)(3)(A) asks only that a request "reasonably describes such records" and follows the agency's published rules. Purpose appears only in the fee categories of (a)(4)(A)(ii). The ruling named only (a)(4)(A)(ii). The block also cites (a)(3)(A), because that is the subsection showing that no purpose is asked.
- **inspect_photograph.** As the ruling says, the block records "not provided by 5 U.S.C. § 552" and names the subsections read. No value was invented.

Tests: `bio-plane/test/m/jurisdictions-b/federal-layer.test.mjs` (R109). It covers the block, the working days, and the due date from `combine` of the federal layer alone: received 2026-11-20, due 2026-12-21, extended to 2027-01-06, the same as the unsplit profile. The control is a request with no law named.

The package's `get` now composes two blocks, FOIA's and the Public Records Act's, into a list (R105's shape). Three tests in `jurisdictions/test/` assumed one block. They now pick the Public Records Act block by its law: `t50`, `t51-proceedings`, and `jurisdictions.test.mjs` R22 (now 3 blocks with the test profile). `t53-shipped`'s R109 todo is replaced by a pointer to the new test.

Notes for other modules (not this job's work):
- The `help-records` screen (`bio-plane/src/screens-action/help-records.mjs`) reads `view.records_help` only as a single object. Since R105, `combine` gives a list, so the screen draws no block for any law. That was true before this change. Separately, the screen's sentences 6 and 7 are written for California. With FOIA's block, sentence 6 would show "not provided…" as a citation, and the screen's "within {days} days" doesn't say these are working days.
- `bio-plane/test/m/screens-action/seam-t51.test.mjs` fails 2 of 2 on the tranche with or without this change.
