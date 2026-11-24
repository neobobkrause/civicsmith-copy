Length: 31 lines. Last section: "Working rules".

# Evidence rules for the layer research

Written 23 Nov 2026 by civicsmith plane-scope lane #1, after the owner found the lane stating conclusions it had not checked. Every worker on the layer research reads this file first, and the lane holds its own reports to the owner to the same rules.

## The five layers

The owner's layers, in the order he wants them stacked, lowest first: **model, middleware, control plane (the front door), launcher, UI**. Today the code stacks them model, middleware, UI, control plane, launcher. Which module belongs to which layer is a finding of this research, not an assumption: a module is placed by what its code does, with the evidence shown, and a module that does not fit one layer cleanly is recorded as AMBIGUOUS with the candidates, never forced.

## Every claim carries its evidence

1. Each factual claim carries exactly one tag:
   - **[MEASURED]**: you ran a command and its output shows the claim. Give the command and the part of the output that shows it.
   - **[READ]**: you read it in the code. Give `file:line` and quote the line.
   - **[NOT CHECKED]**: you did not establish it. Say what would.
2. There is no fourth kind. An inference is written as "INFERENCE from (a) and (b): ..." and says what would settle it; it is never worded as a fact.
3. A comment, a requirement's text, a function's name, a commit message or a document's description of what code does is a lead, not evidence. To say what code does, read the code or run it. Where a description and the code differ, report both.
4. "None", "no", "all", "only", "every" and any count are written only when a command that enumerates the whole set shows it. Give the command. A sample is called a sample, with its size and how it was drawn.
5. Describe the code as it exists now. What it could become after a change goes in a separate section headed "After a change", and never in a headline.
6. A headline answers the question that was asked, as asked. If the answer is "yes, it refers to a later module", the headline says yes, even when the reference is small.
7. A reference to a module is any of: an import (static or dynamic), a file or folder read or listed at run time, a process or Worker started from its files, a path to its files held as text and used, a value it registers that is called. All count.

## Working rules

- Base: the working tree at `/home/user/civicsmith-copy` as checked out (the lane's branch: `origin/p4-tranche` at `a26a8da2` plus the lane's research files). The local branch `p4-tranche` is stale; do not use it.
- Module facts: `process/modules/order.txt` (204 modules, in order), `process/modules/<name>.json` (`files`, `tests`, `uses`), `process/modules/<name>.md` (requirements). A file's owner is the module whose listed path matches it most specifically, across `files` and `tests`.
- Write only the output files your brief names, under `process/lanes/plane-scope/research/`. Change nothing else in the working tree. No commit, no push, no comment on GitHub, no workflow re-run.
- Anything you must change to try something is done in a scratch git worktree under `/tmp/claude-0/-home-user-civicsmith-copy/53b72b9b-955f-50e9-89b2-414bb3215ac9/scratchpad/`, made from `origin/p4-tranche`, and removed when you finish (`git worktree remove --force`). Symlink `node_modules` from the main checkout where needed.
- Each output file starts with `Length: N lines. Last section: "<name>".` and ends with a section "What I did not check", which is empty only if you say why.
- Your reply to the lane: the file path(s), then your findings as a short list, each with its tag, then what you did not check. No conclusion that a later line takes back.
