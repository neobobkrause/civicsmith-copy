Length: 29 lines. Last section: "4. Not read".

# UX research 05: can a page a member typed in be cited? (the lane's Q2)

UX lane research, 23 Nov 2026, by a worker for civicsmith ux lane #3, on the owner's word that the canon answers Q2. The lane checked the quotations below against the files. Ranks as `process/ranking.md` gives them.

## 1. The rules

- **The owner's ruling, 14 Sep 2026 (rank 2), his words:** "there should be a direct means for a member to select a section of a document and type in their transcription of that content." `docs/development/CONTENT-EXTENT-DESIGN-SPACE.md:173-174`. The same entry, in the design session's words: "its grading runs under this recommendation as the provisional: the member's typing is authored text with the provenance of an authored act, its cap undetermined and stated, and a SECOND member's attestation is what raises it — no member ever grading their own act." (:174-177)
- **Content Framework §14.2 (rank 3):** "the transcription is authored text whose fidelity is undetermined and stated until a second member attests it, so fidelity rises through people and never through a machine's confidence in itself"; `op=transcriptionattest` "lets a SECOND member attest it, raising what a leg citing it may claim exactly as any attestation does; and the typist attesting their own typing is refused by name (C-52.9)"; "The capture's own attestations do not raise a typing, and a typing's do not raise the capture's machine text." An attestation raises what a leg may claim "to B (the ceiling for an earned act; A is the record's own byte proof and is never reached by a person's word)". `docs/architecture/BIO_Content_Framework_v0_10.md:1806-1821`. A leg citing content "may claim no more than the weaker of the two" (the capture grade and the content's cap) (:1797-1799). Line 9: an unmeasured transcription "reads UNDETERMINED and the leg is INERT with its empty level named"; a leg claiming a letter on one is refused for claiming.
- **The content module, R24 and R25 (rank 4), both met:** the typing "is undetermined until a different member attests it"; an attestation needs the attestor's note of what they compared (C-52.10); the typist is refused (C-52.9). `process/modules/content.md:56-57`.
- **DEC-18 (rank 2, 2 Aug 2026):** an ungraded leg contributes nothing and is named on the case (`docs/architecture/BIO_Case_Making_v0_1.md`, R1's amendment).
- **DEC-4 (rank 2):** "Machine-read text is never indistinguishable from publisher text." (`docs/architecture/BIO_System_Design.md:261`)
- **DEC-88 (rank 2, 29 Sep 2026):** typing and attesting a typing are reasoned acts (`docs/development/DECISIONS.md:1432`).
- **D21 (rank 2, 9 Oct 2026), the parallel rule for the assistant's reading:** labelled as the AI's reading and graded undetermined; a member who checks it against the page may confirm it, and it then carries the document's grade (`docs/architecture/BIO_Investigation_v0_1.md:120`).

## 2. What it means for the screens

- Typed words are citable at once. Unchecked, the citation is undetermined, says so, and adds nothing to strength (DEC-18: named, inert). It is refused only if it claims a grade.
- A second member's check, never the typist's, with a note of what they compared, raises what a citation may claim: at most B, never A, never above the document's capture grade, and only over the typed portion.
- The typing is shown as a member's authored text, attributed to them: never as the publisher's text, the original, or Civicsmith's or the assistant's reading.

## 3. Against the lane's earlier recommendation

Q2's recommended option ("citable once a second member has checked it") was wrong: the canon makes typing citable at once, undetermined, and the check raises its grade rather than unlocking the citation. Its labelling ("typed by X, checked by Y", never Civicsmith's reading or the original) agrees with the canon. The `reading-a-document` page already words the typing as counting "for no more than that member's word until checked" (C12, A13). DEC-190 (design session, not the owner) speaks of pages nobody has read or typed and does not conflict. Grade D (testimony) is a firsthand account, not a transcription. One tension, not the lane's to settle: D21 lets a confirmed AI reading carry the document's grade, §14.2 caps a person's attestation at B; D21 concerns the AI's reading only.

## 4. Not read

The original texts of DEC-4 and DEC-23 (`docs/archive/ledgers/DECISIONS-2026-08.md` is a pointer to another branch); the original wording of D21 and of the 14 Sep ruling beyond the sentence quoted.
