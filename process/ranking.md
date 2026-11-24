Length: 19 lines. Last section: "The ranking".

# civicsmith: the ranking of governing texts

Kept by ARCH (Process4 build text 2, section 8). Every role reads it. The canon these lines name is the one `requirements/README.md` lists, in the parts it names; a document it names "by section" governs only there.

## The ranking

1. Mission: `docs/architecture/BIO_Complete_Roadmap_v5.md`, sections 1 to 5 (origin, purpose, name and preamble, the four core values, the eight operational principles).
2. Principles: `docs/architecture/BIO_Design_Requirements_v2.md` (the fifteen design requirements); the owner's product rulings (DEC-n) in `docs/development/DECISIONS.md`; and the owner's decisions under Process4 in `process/decisions-owner.md`.
3. Standards: the construct designs, levels 1 and 2, in the canon parts `requirements/README.md` lists (`docs/architecture/` and `docs/development/`), with `docs/architecture/BIO_Functional_Architecture_v3.md` and `docs/architecture/BIO_System_Design.md` in their canon parts.
4. Requirements: `process/modules/<name>.md`, one file for each module.
5. Design decisions: `process/decisions-arch.md`, and the lanes' folders under `process/lanes/`.

The earlier process's rulings, `build/rulings.md` (K1 onward), rank by the source each line names: a ruling whose line names Bob (the owner) as its source ranks with the owner's rulings at 2; a ruling that names only the earlier process's own sessions ("BOB #n", a lane or a job) ranks as a design decision at 5. A later ruling at the same rank that names the one it replaces stands over it.

A lower one never overrides a higher one. A session that finds two in conflict follows the higher and tells ARCH.

Where the owner's newer word and an older ruling at the same rank differ, the newer stands (Process4 design part 1, section 4).
