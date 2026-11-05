# acquisition: requirements notes

For BOB. Job `acquisition`, attempt 1 (5 Nov 2026): consolidate `build/requirements/acquisition.md` under the 70,000-byte cap.

## Why it cannot be consolidated as asked

The file is 127,015 bytes. Its 94 requirement lines (R1–R48, R95–R140), with their sub-bullets, kept verbatim, are 109,277 bytes on their own; everything else (Status, Size, Purpose, Provides, the service headings, Private, Uses, Satisfies, Suggestions, Open for Bob) is 17,739 bytes. Moving all of that out would still leave about 109k, so the file must split. A split makes new module ids, which is BOB's call (K617, K649); nothing was moved and no requirement changed.

## Proposed split, in three (bytes are the requirement lines with their sub-bullets)

| file | requirements | bytes (R lines) | code it covers |
|---|---|---|---|
| `acquisition` (stays) | the act, its arms and what it records: R1–R37, R42–R44, R47, R95, R97, R98, R124, with the keyed reads R130, R131, R134, R137 | 45,651 (37,754 + 7,897) | `index.mjs`, `checks.mjs`, `keyed.mjs`, `title.mjs`, `challenge.mjs` |
| `acquisition-owed` (new) | owed work and the member's wait: open captures, the whole keep, renders pending and failed, parked fetches, deliveries, the registrar, the profile's range reads, one text rule and decode, links, a site that asks for a person: R46, R96, R99–R106, R108–R112, R115–R120, R123, R140 | 28,144 | the owed paths of `index.mjs` (no file move needed) |
| `acquisition-archives` (new) | archives, containers, registers and limits: R38–R41, R45, R48, R107, R113, R114, R121, R122, R135, R136, R138, R139, with the registers R125–R129, R132, R133 | 35,482 (26,647 + 8,835) | `unpack.mjs`, `member.mjs`, `range.mjs`, `limits.mjs`, `register.mjs` |

With its share of Purpose, Provides, Uses, Invariants and Suggestions each file lands at about 60k, 35k and 45k. Each moved line would read `(was acquisition R<n>)`, as this file's own lines name their `capture` ids. The Invariants R25–R30 stay with `acquisition`; the two new files cite them.

## Open marks at this attempt

- R38's T53 sub-bullet (member rows through `fileMember`) and R138 (held-and-named kinds): met by the code on tranche, tested in `t53-member.test.mjs` and `t53-kinds.test.mjs`.
- R127 (bounded slices and resume): met with the bounds `registers` hands in, tested in `t53-register.test.mjs`.
- R126 stays open: its two figures are `READ_BOUNDS` rows set from M-R7, which is not recorded (`build/plan/T53-R1/runtime-limits.md`: "acquisition R126 `[waits: M-R7]`"; `runtime-limits` is blocked on the same measure). Until then `streamRegister` refuses `REGISTER_LIMITS_NOT_RECORDED` unless its caller hands bounds.

## The split, done (attempt 1, replacement session, 5 Nov 2026)

BOB split the file as proposed (PR 474, merged at a3af376b). This branch replaces in `build/requirements/acquisition.md` each of the 45 requirements now in `acquisition-archives` (22) and `acquisition-owed` (23) with a one-line stub, `*(retired: moved to <module> R<n>, PR 474)*`, as earlier splits did (README rule 6: a retired id is never reused), after checking each removed block byte for byte against its copy there. Nothing else in any requirement changed: lines that stay keep their cross-references to the moved ids, which still name the same requirements under the same numbers. The Status line names what moved where. The file goes from 126,952 to 66,640 bytes, under the 70,000 cap. Open marks moved with their lines (R126's `M-R7` wait is now `acquisition-archives`'); no requirement left here carries an open mark.
