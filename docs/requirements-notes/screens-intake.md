# screens-intake: requirements notes

Moved here verbatim from `build/requirements/screens-intake.md` by the screens-intake job (attempt 1, 5 Nov 2026), for the requirements cap. Nothing here is a requirement; every **R** line stayed in the requirements file, word for word (pinned by `bio-plane/test/m/screens-intake/requirements-ids.test.mjs`).

## Status (as it stood at the move)

**Status** · New in T46 (T46-56; K657, K1043): a module built fresh, layer 11 after `screens-settings` (N897 (1), Bob's K2816; DEC-97, DEC-153, DEC-168; N821's upload surface; N714's screen side; N747). Drafted in `build/plan/draft-T46-interface.md` §2.4, worded here by BOB (P5). No ids move. Not yet met (T46). Last changed T47 (T47-59: R10 new, the writing-help draft filled into its field and a knock's card, N987; R11 new, a held row's grade and thumbnail, N979; R12 new, the knock's source read with no typed ids, N980; R13 new, the set-aside list, N969; R14 new, watching from Add through `monitorset` and "Ask for this later" as a member's own request, N969; R15 new, the `archive` screen, N688's screen part); marked not yet met (T47). Last changed T48 (K3254, the L11 design fold of WALK-084 #2, K3250: R17 new, the common line; R18 new, the tab bar and act row; R19 new, no empty Set aside, the `heldcaptures` stall traced; R20 new, bare `archive` and `open-file`); marked not yet met (T48). Last changed T49 (T49-23: R21–R25 new; K3334); marked not yet met (T49). Last changed T50 (T50-30: R29–R36 new; R37 new, a held ZIP opens its files, DEC-310 (5), BOB's placement (K3683 names none); For which question by `for`, an archive entry already held, Unfinished, the inbox, titles from the reading, the second upload, no raw fingerprint, an added file opened as her own; N1117, N1126, N1094, N1106, N1139, N1185, N1194; DEC-245, DEC-289, DEC-302); marked not yet met (T50). Last changed T50 (T50-30, the re-fold of DEC-321 to DEC-325, BOB #205: R29, R32, R33, R35 and R36 amended in place; "For which question" on the address tab alone, the inbox's reference line, the untitled page's heading, the size keys now held, the safe text view; DEC-321, DEC-323, DEC-325; K3720, K3724, K3726, K3728); amended lines marked not yet met (T50). Last changed T51 (fix round, SCREENS-INTAKE #10: R42–R51 new; C55, C17, C18, C19, C56, C20, L3, the capture screen's progress, status, title and existing-document link, the held door; DEC-375, DEC-381, DEC-382, DEC-384); marked not yet met (T51). Last changed T51 (T51-117, L11 fold, BOB #210: R38 new, A64's already-held and site-changed rows on the address tab through `heldat`; R39 new, A28's browser check of the original's digest on opening; R40 new, an upload's uploader, date and size and the vouched documents (N1235); R41 retired at the verification (the design draws A10's line on `finder` and `queue` only, and T51-117 names none for `held`); A29 is met by R1 and R31 (its drawing is on Add's address tab); K3807, K3771, K3774; DEC-330; R38 and R39 worded to DEC-335 and DEC-336, K3897: "Open it", "Leave it", the copy's `{date}` and the digest check's words keyed); marked not yet met (T51). Fix round 6 (T51): R58 new, a capture too large for the request is said, watched and finished (G2, G3); R59 new, a capture states the supporting files it skipped (G19); R60 new, a list that stops says so (G20); R57 amended (G7, G14); R21 amended, a multipart upload's register names the whole first (G6). Fix round 9 (T51; K4831 (3), (5), K4835): R63-R66 new, the project-less upload's line, the refusals with their figures, the states from the job row and the fragile test (G135c, G135d, G135f, G143); R21 and R61 amended, the register as wholes and no door read (G127a, G127c, G126h); marked not yet met (T51). Last changed T53 (N1269, N1272: R72–R74 new, the limits before a file is added; A3, DEC-459: R75, R76 new, a source for listed members; A4, DEC-460: R77 new, a photograph's safe picture; DEC-454, DEC-455, DEC-467, DEC-473, DEC-474: R78–R83 new, owed lines; K4354, P24: R84 new; JOURNEYS: R85–R93 new); marked not yet met (T53).

## Size

**Size (P6).** Estimated 2,000–2,600 lines with comments, its own keyed sentences included, measured at its START (M-T46-1, K617).

## Uses

- `setup-words.word`, `setup-words.hasWord` (K3366, K3368): every member-facing sentence, by key.

- `interface-shell`: the kit `cs` and the screen contract (its R21).
- `setup-words`: `WORD_ROWS` keys.
- `wizard-scripts`: `SCREEN_REGISTRY` (its R13), in tests only (K3014).
- (T47) Through the plane: `acquisition` (`archivelist`, R41; R15), `capture` (R77's `capture`, R88; R11, R13), `monitoring` (`monitorset`, R74; R14), `capture-requests` (R56; R14), `sources` (`sourceof`, `sourcerung`; R12), `wizard-scripts` (R34's label; R10).
- Through the plane: `acquisition` (R10), `capture` (R76–R81, R86), `capture-requests`, `monitoring`, `entities` and `provenance` (`testify`), `ratification` (`release`), `file-safety` (R6, R8, R27–R32 and the open ops), `doorbell`, `store-door`, `sources`, `wizard-scripts` (`writinghelp`), `control-plane` (R58's `promoted`, R72).
- Tests only: `op-declarations` (`OPS`).
- (T51 fix round) Through the plane: `monitoring` (`monitoring`, `monitorpause`, `monitorslate`, R75/R76's `namedrequests` and `namedrequestset`), `link-sweep` (`sweeps`, `sweepset`, `sweepratify`), `sources` (`sourceof`, `sourcerung`, `sourcepublishable`, `sourcedisclose`, `sourceconsent`, `sourceconsentwithdraw`), `people` (`sourcepersonlink`, `peopledirectory`), `doorbell` (`knocksof`), `observation-log` (`lead`, `leadread`, `leadlook`, `leadshare`), `capture-sources` (`capturecredentialsupply`, `capturecredentiallist`, `capturecredentialwithdraw`), `capture-requests` (`capturerequests`, `capturerequestretry`), `project-roster` (`projectlist`, `projectparticipants`), `capture` (`heldat` by digest), `wizard-scripts` (`writinghelp`).
- (T51) Through the plane: `capture` R96 (`heldat`; R38), R77 and R88 (`heldcaptures`' `actor`, `retrieved`, `bytes` and `held_and_vouched`; R40), `membership` R17, R147 (`memberlist`'s handles; R38, R40), `file-safety` R8 (the digest header; R39). `interface-shell` R98 (bytes checked before they are handed on).
- (fix round 9; G135f; R65) Through the plane: `control-plane`'s `op=reading` and `owedwork`, which answer the job row (`control-plane` R135, `store-assembly` R74).
- (T53; R72–R74) `acquisition`: `limitsByKind` (its R135), over the door; `registers` (`registerList`, `registerFilter`; R74), over the door, no edge. (R75, R76) `sources`: `sourceLinksFor` (A3-R1), over the door.

## Satisfies

- Registry screens `capture`, `held`, `open-file`, `inbox` (DEC-139); N897 (1). (T47) `archive` (`registry.json` at `a0fab7abf0`; DEC-167, N688): R15; N969 (R13, R14), N979 (R11), N980 (R12), N987 (R10).
- DEC-97 (R4), DEC-153 (R3), DEC-168 and DEC-173 (R5, R6), K1852, K1888 (R9); N821 (a member's upload of a file she holds: R2); N714 (the open ops' screen: R5); N747 (R1).
- (T51) DEC-330 A64 (R38), A28 (R39); DEC-335 and DEC-336 (9) (R38, R39: the keys given); N1235 (R40); A29 (R1, R31).
- (T53) N1269, N1272, K5446, K5447, K5453 (R72–R74). DEC-459, K5518, K5519, K5544, K5545 (R75, R76; A3). DEC-460, DEC-473, K5471, K5473, K5521, K5546 (R77, R81; A4). DEC-454, DEC-455, DEC-456, DEC-467 (R78–R80, R82). DEC-474 (R83). K4354, P24 (R84). JOURNEYS R-1, R-21, R-22, R-23, R-24, R-29, R-56, R-57, R-58; K5553 (J1), K5554 (J2) (R85–R93).

## Suggestions

- "For which project" on the upload tab has no field in `capture` R86; T46 omits it (`draft-T46-interface.md` §7 T4 (a)).
- The camera's photo date and place (EXIF) are read in the browser only to pre-fill "Where and when", never sent apart from the bytes.
- `mark.gap.refused.means` is drawn from this module's own row (`interface-shell` R5: it names Civicsmith bare).

## A heading with nothing beneath it

Under Invariants, after R71, at the move (nothing followed it before Satisfies):

**Proposed requirement lines (BOB writes them):**

## Attempt 3 (7 Nov 2026): the found marks and R85–R92, for BOB

Done, each tested through the screen: F1 (`open-file` offers a JPEG or PNG photograph's safe view and draws `leftOutLine` beside it from the answer's `left_out`; its keys join the screen's words from `PART_KEYS`); R92 (inbox rows titled by the sender's file name, else the note's first words, else "handed in without a name or note", each with its true size; "Became {document}" after a pull in the visit; the five rungs each beside its own `.means` line); R79's "Cancel sending" (`captureuploadabort`) and its canceled line; R73's too-large refusal as DEC-500 draws it, for an upload (`toolarge.size` or `.archive`, then `nothing_read`, then R74 (b)'s part; never the figures row) and for an address (from `acquire`'s `bytes` and `maxBytes`); R74 (a)'s register way, matched mechanically against the real `registerlist` and linking `/app/registers/<key>?project=<project>`. `screen.capture.read.queued` was already drawn by key (r9-states R65) now that its row is held.

Not done, and why (each a REPORT, nothing invented):
- The parts limitsSection, tooLargeLines, registerOfAddress, partsCancelledLine and stepLine's `queued` are on job/screens-intake-rounds only (blocked, unmerged); BOB ruled (a), 7 Nov: they are drawn here instead, by the same keys, and screens-intake-rounds drops its duplicates when it reopens.
- `leftOutLine` passes `{what}` (phrases already HTML) as a plain string, so the kit escapes it again; `open-file` hands it a kit marking that fill as HTML. screens-intake-rounds should pass `{what: {html}}`.
- F2 in part: R72's limits section needs a read op serving `limitsByKind` (op-declarations t51 names it among the read acts, but no op row serves it); R74 (a)'s link names the route `/app/registers/<key>?project=`, and no screen module serves `registers` yet; R79's cut sentence needs `previewmore`.
- F3: `archivelist` answers no mailbox counts (`acquisition`), so `mailboxCountLine` has nothing to draw from.
- F4: a PDF safe view's `pages`/`source_pages` ride only in the `x-file-safety` header, and `cs.download` answers `{type, size}` (`interface-shell`): `safeViewPagesLine` has nothing to draw from.
- R92 across visits: `inbox`'s rows carry no bundle id (`doorbell`'s list joins `bundles` but does not select `bundle_id`), so only a knock pulled in this visit links what it became.
- R85–R91: R85, R87, R89 and R90 change plane answers (`capture`, `acquisition`, `provenance`, the not-yours refusal codes `interface-shell` R35 reads); R86 (held's project filter), R88 (a next-step row for `MACHINE_CANNOT_SET_ASIDE`) and R91 (390 layout) have no design rows or shell styles yet.
- The requirement file is over the cap (93,635 bytes against 70,000): consolidation is BOB's (REQ-6).
