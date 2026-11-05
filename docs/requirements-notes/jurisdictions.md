# jurisdictions: requirements notes

## Split proposal (job jurisdictions, attempt 2, 2026-11-05), for BOB

**Why moving text out can't work.** `build/requirements/jurisdictions.md` is 137,280 bytes, and the cap is 70,000. Its 138 requirement lines (R1–R139, no F lines), with their sub-bullets, kept word for word as the START requires, come to **about 129,000 bytes on their own**. The lines without sub-bullets are 121,940 bytes. Stripping each line's opening source bracket would still leave about 117,400 bytes, and that wouldn't be word for word anyway. Moving the Status, Satisfies and Suggestions text (about 8,300 bytes) out can't get the file under the cap. So the file has to split.

Six requirements are marked `(not yet met: T53)`: R109, R119, R120, R124, R133 and R137.

**Running total of requirement bytes (with sub-bullets), by id:** R1–R60 42,854; R1–R70 50,855; R1–R88 60,125; R1–R92 64,065; R1–R94 67,246; R1–R110 82,895; R1–R139 about 129,000.

**Options.**

- **A. Split in two by tranche:** R1–R94 (the profile schema and the work of T33–T51) stay. R95–R139 (T53's places in layers, the federal layer, reviewed texts, fiscal year, registers and the first profile; 61,699 bytes) go to a new module. The catch is that R1–R94 is 67,246 bytes before any heading or Terms, which is too close to the cap to hold.
- **B. Split in three (recommended):** R1–R60 (about 43k) stay. R61–R110 (about 40k) and R111–R139 (about 47k) become two new modules. Each file sits well under the cap, with room to grow.

Either way, each moved line says "was jurisdictions R<n>" and keeps its meaning and mark. This follows the precedent of K617 and K624 and of op-declarations → surface-declarations. The code stays in `jurisdictions/` unless BOB rules otherwise. Only that module's profile data names a place (requirements README, convention 7). So the new modules would own requirement files and tests, and the profile code and data would stay where they are.

This job edited neither file's requirements. It blocked so that BOB can choose the split.
