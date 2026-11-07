# interface-shell-t53: requirements notes

Nothing here is a requirement; every **R** line is in `build/requirements/interface-shell-t53.md`. The change history before the split is in `docs/requirements-notes/interface-shell.md`.

## Attempt 2 (7 Nov 2026)

interface-shell's hook (PR 810, BOB ruling 7 Nov) lets this module add to the member page three things, after the shell's own: kit parts under new names (`cs.<name>`, a name the shell's kit holds stays the shell's), CSS appended to the frame rules, and data under new keys of `D`. This attempt meets, through it:

- **R138** `cs.picker(view, id, o)`: the document picker with two scopes. Its state is the screen's page memory: `view.ui["pick:<id>"]` the chosen document, `"pick:<id>:q"` the search, `"pick:<id>:wide"` the control. The screen reads its second scope while `"pick:<id>:wide"` holds a value (or always, when it knows no project), and hands the picker both reads as `cs.state` takes them. The search is the kit's field, the choice the kit's radio groups (one per scope and per project, the group's legend naming the project), the control the kit's box that redraws (R90). Scope rows are deduplicated across the two scopes.
- **R141** `cs.machine(kind, o)`: a machine result's label, `screen.machine.<kind>.ai`, `{ai}` from `o.label.display_name` alone (`ai-runs` R104), with `screen.machine.ai.tip`; a label with no display name draws nothing.

The page's word table (`D.words`) keeps only the words the shell's `pageWords` names (its families, the registered screens' own keys and the acts'), so the words these parts draw (`screen.document.pick.*`, `form.choose.widen.documents`, `screen.machine.*`) are carried as this module's data, `D.t53.words`, read from the word table when the page is composed (the table wins; nothing is written twice), and drawn by `cs.t53word`.

## What the hook cannot reach (named to BOB, 7 Nov)

The other fourteen marks rule the shell's own program, which a contribution of kit parts, style and data cannot change:

- R136, R137: the screen-open read path (`browser.mjs` `readAll`), and `screenread` is not an op `OPS` declares (`op-declarations` PL11).
- R139: `followfrom` is not an op `OPS` declares, so the kit's gate (R12, `can`) draws every entry it answers absent; and a contributed part has no press of its own (the shell's click delegation answers its own controls only), so its entries cannot be act buttons that call `onEntry`.
- R140: `cs.grade` is the shell's own part; a contribution cannot amend it (the hover-card reading "could be captured: {grade}").
- R142, R147: phone-width layout, reachable by the style hook, but untested here this attempt (it needs the browser harness over `front` and the public frames).
- R143 the dock's and Plan's tray offers, R144 the act button's pending state, R145 the explanation card's placement, R146 the skip link and tab stops, R148 `data-screen` and `more`'s sentence, R149 the reason mark, R150 the confirm in view, R151 the `ready` refusal before the reason box: each in `browser.mjs`.
