# filing-templates: requirements notes

For BOB. Job `filing-templates`, attempt 1 (6 Nov 2026): meet the T53 marks R15, R35, R36, R37 and R38.

## What changed

- **R38, R15, R35.** The module's own judge of a profile template's attribution is gone. Offering (R15) and `unofferedFor` (R35) both call `jurisdictions.attributionLacks` (its R126) as it stands, and no word is mapped. So the fourth word is `second_approval`, never `approver`, and a professional review counts only when it carries the reviewer, organisation, credential, date and `reviewed_text_sha` of the text as it is now.
- **Effect on the test profile.** None of `test-port-ellery`'s reviews carries `reviewed_text_sha`, so `TPL-test-records-request` now lacks `sources` and `professional_review` (before, only `sources`). The existing tests that pinned the old answer now expect the new one. The fixture's `PRO_REVIEW` is given the text's hash through `proReview(text)`.
- **R37.** Profile templates are read layer by layer: a package's layers are each read alone. Each template carries `layer` (the profile it sits in), and that layer's level and place. A profile that is not a layer is its own `layer`. When two profile templates in different layers share a handle, `TEMPLATE_NAME_AMBIGUOUS` now carries `layers: [{layer, level, place}]`. `templatesFor` gives `layer` on each profile template. When two offered profile templates share a name, each also gets `name_shown`, which is the name followed by its layer's place. The `name` field itself is left alone, so handles don't change.
- **R36.** A group template's `profiles` may name a layer id or a package id. It is stored as written and expanded when read, using `jurisdictions.combine([id]).view.layers`. It is offered only when every layer it expands to is among the active profiles' layers. When it isn't, `offeredVersion` answers `TEMPLATE_NOT_OFFERED` with `layers_inactive`; `templateRead` answers `offered: false` with the same `layers_inactive`; and `templatesFor` leaves it out. A template naming a profile that is not a layer is judged exactly as before.

## Left for others

- R36's last sentence ("the sentence of R29 … names the layer") is `filings`' sentence `filings.template_written_jurisdiction`, built in `filings/index.mjs`. Nothing in this module spells it, so that part is for `filings`.
- `name_shown` is a new keyed phrase, `filing-templates.index.name_in_its_layer` ("{name} ({place})"). It goes to the word table through the usual extraction step.
