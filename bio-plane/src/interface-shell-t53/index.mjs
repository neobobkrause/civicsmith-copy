/* interface-shell-t53: what this module adds to the member interface's page (BOB ruling 7 Nov 2026, from this module's block).
   `interface-shell` imports this file and folds `CONTRIBUTION` into the page it composes (`interface-shell/index.mjs`,
   `contributionOf`), in a fixed order, after the shell's own:
   - `kit`: `{name: fn(cs, D, ...args)}`, each function self-contained (only its parameters and the language's own globals, as a
     screen's are, R21), added to the kit `cs` of every screen as `cs.<name>(...args)`, called with that kit and the page's data
     `D` (which holds `data` below) first; a name the shell's own kit holds stays the shell's;
   - `style`: CSS text appended to the shell's `STYLE` (the frame rules), after its own; no `@import`, `url()` or `</`;
   - `data`: JSON values added to the page's data `D` under their own keys, after the shell's; a key the shell's `D` holds throws.
   Created empty by interface-shell's job (attempt 9), as the ruling says: an empty contribution changes nothing on the page.
   This module's own job fills it. */
export const CONTRIBUTION = Object.freeze({
  kit: Object.freeze({}),
  style: "",
  data: Object.freeze({}),
});
