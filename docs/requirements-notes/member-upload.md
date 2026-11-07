# member-upload — notes

**Job member-upload, attempt 1 (5 Nov 2026).** Open marks at START: R117 and R120. Neither struck; both need code outside this job's paths.

## R117 (a message's attachments filed as its members)

What holds today, tested in `bio-plane/test/m/member-upload/r117-seam.test.mjs`: the `member` rows `emailCapture` registers (capture's `r116-t53.test.mjs`), each run through `acquisition`'s real `fileMember` (its R136) over the same record and evidence store, file each attachment under its own digest, method `emailed-attachment`, receipt `via: "email-attachment"` naming `email:<messageSha>!<index>`, each with its own `reading` row; an inline image is an attachment; a refused kind is `not_filed` while the message and the others are filed; a second run files nothing again; control: no attachment, no `member` row.

What stops the mark (each a `test.todo` in that file):

1. **Grade note.** "Filed at the message's grade" (received, never fetched): capture R76's `gradeNoteOf` answers null only when every receipt is in `RECEIVED_VIAS` (`bio-plane/src/capture/index.mjs:108`: doorbell, upload, email). An attachment's only receipt is `email-attachment`, so it answers the acquire note, which says the bytes were fetched. Fix: add `email-attachment` (provenance's `EMAIL_ATTACHMENT_VIA`) to `RECEIVED_VIAS`, and R76's text with it. Code in `src/capture/`, outside this job's paths.
2. **Runner.** "Never `waiting` for ever" needs the container-member job composed in the assembled store: nothing in `src/` runs a `member` row today (`store-jobs` R24, was `store-assembly` R102; `store-jobs` has no job yet).

## R120 (the Add door within budget at three uploaders)

Needs a measurement on PLATFORM's study driver against a deployment (the coordinator's act), and the fix may land in `reading-pipeline` or `store-door`. Nothing here can meet it.
