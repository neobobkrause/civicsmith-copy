# held-captures — notes

**Status** · Job held-captures, attempt 1, 5 Nov 2026. For BOB and the next job of this module.

## What this module holds

`build/requirements/held-captures.md` holds R77, R78, R79, R81, R82, R83, R84, R88, R91, R100, R101 and R102, copied verbatim from `capture` under their `capture` numbers (the split of 5 Nov 2026). None carries a `(not yet met)` mark: each was met on `capture`'s branch before the split. Their history stays in `docs/requirements-notes/capture.md`.

## Where they are met and tested

The code stays in `bio-plane/src/capture/` (this module's paths name no source), and each requirement is named by a test in `bio-plane/test/m/capture/`, as found on 5 Nov 2026:

| id | tests in `bio-plane/test/m/capture/` |
|---|---|
| R77 | `held`, `archive`, `t47`, `t49`, `t50`, `t51`, `fix2-t51`, `fix3-t51`, `fix3b-t51`, `e13-t51`, `p10-t51`, `r6-t51`, `r7-t51`, `r7-alsohere`, `r103-t51`, `r77-r21-t53`, `upload` |
| R78 | `held`, `archive`, `t49`, `t51`, `fix2-t51` |
| R79 | `held`, `archive`, `services`, `t50`, `t50-words` |
| R81 | `held`, `archive`, `services` |
| R82 | `held` |
| R83 | `held`, `t50`, `t50-words`, `fix2-t51` |
| R84 | `held` |
| R88 | `t47`, `t49`, `t51`, `fix2-t51` |
| R91 | `t49`, `e13-t51`, `fix2-t51`, `p10-t51`, `r6-t51` |
| R100 | `fix3b-t51` |
| R101 | `fix3c-t51`, `r7-alsohere`, `r7-upload-t51`, `g41b-t51`, `evidence-absent`, `knocker`, `t50-words` |
| R102 | `p10-t51`, `upload` |

This module's own suite (`bio-plane/test/m/held-captures/`) checks that the file holds those twelve ids, each once, and stays under the requirements cap.

## Open

- Moving the held list's code and tests out of `capture` into a module of its own needs a module entry with source paths; that is BOB's to give, not this job's.
