# The recommender's prompt on the blind fixture of dissolved pairs (contradiction-words R41)

Measured 2026-11-23 by the job contradiction-words #1. Proves R41: `sha256(RECOMMEND_PROMPT)` equals
`RECOMMEND_PROMPT_SHA256`, the digest under which this fixture was measured.

- **Prompt measured:** `RECOMMEND_PROMPT` in `bio-plane/src/contradiction.mjs`, sha256
  `169cb4da6b90c22ab5e32abd90387bcd86b5391a9a8c9eb021eadae2568a57c3`, unchanged by this measurement.
- **Fixture:** `recommend-fixture.mjs`, 14 dissolved pairs: three of K1, three of K2, two of K3 (each with its
  passage), three of K4 and three of K5. Each carries the respects a member dissolving it would name (`gold`) and why.
  Made-up civic text that names no real place.
- **Input:** `renderRecommendInput()`, which gives the prompt, then each pair's key, the respects it may name, K3's
  passage, and the two sides through `judgementSide`. It carries no pair id, gold respect or reason; the test checks
  this. sha256 of the whole input: `8db4c0d7d9288e97c94f8566e466a8d30ae0d9bd3e8c719c1c04c8e49d82b583`.
- **Runs:** three separate workers of the job's session. Each was told to Read that one input file and nothing
  else, use no other tool, and answer with the JSON only. R1 and R2 ran on the session's default model family, and R3
  on a second, smaller family. Model identifiers are not written in the repository. Answers are recorded verbatim in
  `recommend-recorded.mjs` and scored by `recommend-score.mjs`.

## Figures

| run | model family | answered | outside the pair's list | no reason | verdict words | pairs hit (recall) | named that the member named (precision) | empty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | session default | 14/14 | 0 | 0 | 0 | **14/14** | 16/20 | 0 |
| R2 | session default | 14/14 | 0 | 0 | 0 | **14/14** | 15/18 | 0 |
| R3 | second, smaller | 14/14 | 0 | 0 | 0 | **12/14** | 13/16 | 1 |

- **What the prompt forbids never happened.** No run named a respect outside its pair's list, gave a blank reason, or
  used a word of verdict (which side is wrong, or a kind or cause of conflict). The plane refuses the first two anyway
  (C-93.29, C-93.30).
- **What it missed.** R3 named time and scope for the community center's two meanings of "complete", and named
  nothing for the parcel tax, where both sides weigh the same two things the other way. The two larger runs named
  every pair's respect.
- **What the extra names were.** Except for R3's two names for the community center, every coordinate outside gold
  was a second respect beside a gold one, such as scope beside meaning or time beside meaning. A member sees each one
  with its reason and chooses.

## What this does not show

The fixture is 14 short pairs, written by one hand after the prompt was read. Each says its difference plainly
enough to see, so the two larger runs' perfect recall is a floor, not evidence of how the prompt does on captured
documents. As the judgement's own measurement (M-162) found for its corpus, this fixture will soon stop telling a
good prompt from a better one. The prompt's measure from here on is its acceptance rate in use (`contradiction` R39:
review due at 95 percent over at least 30 offered, provisional).

A recording measures only the runs it records. `recommend.test.mjs` re-scores these answers and runs no model. If
the prompt is edited, the test fails on its digest. If the fixture is edited, it fails on the input's digest. Either
way: run again, record, and rewrite this file and the digest in the same change.
