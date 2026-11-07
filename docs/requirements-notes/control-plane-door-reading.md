# control-plane-door-reading — notes

Change history before the split is in `control-plane`'s notes. This file records what this module's own jobs did.

## Job 1 (5 Nov 2026): the T52 marks struck

The code these requirements rule stays in `bio-plane/src/control-plane/`; this job changed none of it. It found the door already meeting R72, R100, R120, R123, R124, R125, R128, R130, R133, R134 and R135, and struck their `*(not yet met: T52)*` marks on the tests now in `bio-plane/test/m/control-plane-door-reading/`:

- New: `r72-archive-wait.test.mjs` (R72: an uploaded archive no document holds is answered `ARCHIVE_NOT_FILED` to the plane's `unpack` job; once one holds it, its members are filed under that document's project; no earlier test covered this) and `r130-door-registration.test.mjs` (R130 through the door: a broken stub retried through a fresh one; both tries failing gives a stated refusal and no `reading_pending`).
- Copied from control-plane's suite, imports repointed: `r72-parted`, `r72-declared-door`, `r100-upload`, `r123-reading`, `r124-owed-render`, `r128-op-shape`, `r128-rpc-stub`, `r128-timing-desc-bytes`, `r133-r134-follow`, `r135-job-state`, `t51-round5-door`, `t51-reading-follows`, `t51-large-pdfs`, `t51-hops`.
- Ceilings read from the table: the copied `r123-reading` and `t51-round5-door` used the alpha's figures (a 24 MiB PDF ceiling; 40 MB over the text ceiling). Since N1267, `READ_BOUNDS` holds 100 MiB for PDF and text, so those copies read `boundOf` (R132). `t51-reading-follows`' F2 case (a 55 MB text read as its statement) is not copied. A text over 100 MiB is past one upload's request-body ceiling (R72), so the case is proven at the door instead.

Found and left with their owners: control-plane's own copies of those cases are still red on the old figures (`r123-reading`, `t51-round5-door`, `t51-reading-follows` F2, `r131-gate` R132's light kinds, round 9 seam §14/§14a). Round 9 seam §5 waits on provenance 21 (the refusal's `kind: whole`). Seam §11 is red because an email is not stated by its kind; that belongs to the email reader, not the door.
