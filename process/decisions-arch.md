Length: 10 lines. Last section: "Requirements: place and form".

# civicsmith: ARCH's technical decisions

Written only by ARCH (Process4 build text 2, section 8). One entry for each subject; a changed decision rewrites its entry in place. Each decision is one pull request. The `Decision` line is the plain line the coordinator gives the owner.

## Requirements: place and form
Decision: each module's requirements move from `build/requirements/<module>.md` into `process/modules/<module>.md`, in Process4's form. Each live requirement becomes one line, `- **R<n>** [met]` or `- **R<n>** [not yet met]`, with its number and words unchanged, under the same headings as before. A requirement the old file marks "not yet met" stays not yet met, and every other live one is met. Retired numbers are deleted, and `Next number` is set above the highest number ever used. The module's purpose, uses, invariants, suggestions and the canon it satisfies are carried as they are. The old "Open for Bob" sections are not carried: ARCH decides each technical item in this record, and any item that is the owner's goes to him through the coordinator. A module whose converted file would pass 60,000 bytes is split into two real modules before its first job. The old files stay in `build/` as history.
Why: Process4 reads a module's work from that one file alone. No module has one yet, so no module has work, and nothing can be placed until they exist.
Decided: 22 Nov 2026.
