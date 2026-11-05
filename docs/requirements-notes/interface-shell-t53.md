# interface-shell-t53: notes

**Status** · Written by the job interface-shell-t53, attempt 1, 5 Nov 2026. For BOB.

## Why no mark was met in attempt 1

This job's paths are the requirements file, this note and `bio-plane/test/m/interface-shell-t53/`. Every one of R136 to R151 needs code. The code lives in `bio-plane/src/interface-shell/` (`index.mjs`, `browser.mjs`), and for some marks in other modules too. All of it is outside these paths, and none of it is built on `tranche` (checked at 33859c8b):

- R136, R137: no `screenread` op in `bio-plane/src` (op-declarations PL11 declares it); the shell and the screens still read one by one.
- R138: no two-scope picker in the kit; the "Show documents from other projects" key is still owed by design.
- R139: no `cs.follow`, no `screen.follow.*` keys, no `data-follow-result` fold.
- R140: `cs.grade` has no `ceiling` scale; no `mark.scale.ceiling.*` words.
- R141: no `screen.machine.*.ai` labels; the AI's display name comes from ai-runs R104 label data (ai-runs PR 485, not merged).
- R142, R144 to R148, R150: shell CSS, focus and press behaviour, a skip link, and `data-screen` on every screen. These are browser-kit changes, plus browser tests at 390 px and 1280 px.
- R143: the assistant-ready condition and offers on Team, Ask, the dock and Plan's tray (instance-setup, screens-ai, screens-settings).
- R149, R151: a sweep over the declared Reasoned ops and their reason boxes, and R119's `ready` refusal ahead of the reason box (screens-action draws R151).

## What was done

`open-marks.test.mjs` names each id in a `test.todo`. No mark is struck.

## To unblock

Restart this module with `bio-plane/src/interface-shell/` in its paths. That is the code move the requirements file's Status names ("Until a job of this module moves the code they rule"). R136 and R137 also need op-declarations' `screenread` to land (PR 430), and R141 needs ai-runs (PR 485). The browser-measure marks (R142, R145 to R147, R150) need the module's suite to drive Chromium (Playwright is in the container).
