# The UX substrate folder

This folder holds only what the product's build and checks read (Bob, 5 Nov 2026). The design documents are claude.ai artifacts, kept by the ux lane and recorded with `p3 lane artifact ux`. Their earlier repository copies, the old handoff notes and the archive are in git history, before the commit that removed them.

## What the product reads here

- `screens/`: the screen registry, the wizard library, the mock scripts, `page.src.html`, and the words. `words-drawn.json`, `words.json` and `words-reads.json` are generated rows in `process/config.json`, built from `words-drawn.src.py`, `build_words.mjs` and `words-reads.src.mjs`. Many `bio-plane` modules read the words and the registry.
- `layouts.html`: the design mock, built by `screens/build_page.py`. `bio-plane/src/journey-check/design.mjs` reads it from git at the interface's `ASSETS_COMMIT`.
- `visual-language/`: `civicsmith.css`, built by `build.py` from `palette.json`, `tokens.head.css` and `components.css` (it then runs `check_contrast.py`); `faces.css`, `icons.svg` and `fonts/` are hand-kept sources. `site/test/browser.test.mjs` and the interface read them.
- `screens/check_library.py` builds `registry.json` and `library.json` from their `.src.py` files and checks every act against `origin/main`'s requirements (and the open `origin/tranche`'s, for acts ahead of main); fetch both first, or it falls back to `HEAD` and says so.
- `marks/`: the Civicsmith mark.

## Design documents (artifacts)

| document | link |
| --- | --- |
| The UX substrate | https://claude.ai/artifact/JsPZAftab91EL9Ut91qWGx |
| Design principles | https://claude.ai/artifact/MvsMPnJnk3o32FBeqgdxT1 |
| Brand and voice | https://claude.ai/artifact/EipzYKnNxe5LG3YwWnTkpv |
| The new name | https://claude.ai/artifact/Fmr6rVd7GMifYDRaWcV7s8 |
| Journeys | https://claude.ai/artifact/9hNPVCMcT8eyewWqKXfgSu |
| Visual language | https://claude.ai/artifact/QuvX7DzX7XbxS6SQG4MtT1 |
| Screens | https://claude.ai/artifact/MjC8pWKDj5PrYwm417GLAV |
| Questions from the alpha's live walk | https://claude.ai/artifact/KXfceZqCJkEocZFxyrBAkf |
| Measures map | https://claude.ai/artifact/TfqcXNaJQ86SZzUA8Xn6Ni |
