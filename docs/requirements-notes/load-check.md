# load-check: notes from its first job (T53)

For BOB and PLATFORM, who run the load test. What the code in `bio-plane/src/load-check/` decides that the requirements leave open, and what its tests do not prove.

## How a copy is spoken to

A copy is `{name, address, account, credentials, shared, seed, door}`. The **door** is the only way the driver reaches the copy: `call(op, input, {member, members, credentials})`, `gauge({credentials})` (the record's `database_bytes`, `r2_bytes`, `rows`, `documents` and `team`, as screens-settings' gauge reports them) and, optionally, `cost()` (the account's running charge). `httpDoor({address, gauge_op})` is a plain HTTP door, one POST to `/api?op=<op>` a request with the credential as a bearer header. It has not been run against a deployed copy; the deploy may need it adjusted to the door's real path and to the gauge's op once screens-settings declares one.

Screens are each a list of their declared reads, sent together. When surface-declarations' `screenread` lands, a profile can name a screen as `{reads: [{op: "screenread", input: {screen}}]}` with no change here.

## Choices the requirements left open

- **Caps (R2):** `MEMBER_CAP` 100 members at once, `RATE_CAP` 50 requests a second over all members. The suggested ramp ends at 60, and the soak at 80 % of the breaking step stays under 100. Change them in `guard.mjs` if the first dry run shows they are wrong.
- **Breaking a budget (R1):** an item breaks when its p90 is over `ceiling_ms × p90_factor` (runtime-limits R41, 1.5) or its median is over `ceiling_ms`. A step also breaks when more than 1 % of its requests fail.
- **Default classes:** a screen is `screen_load`; an act is `write_act` when op-declarations marks it mutating, else `read_act`. A profile item may name its own class and a lower ceiling (runtime-limits R42).
- **"Never loads a copy it did not seed" (R2):** the copy must carry the seed record `seedCopy` returned (`by: "load-check"`), and the copy's gauge must name the team that record was made for. The check is one gauge read, made after the account and shared-copy refusals and before any load.
- **Credentials (R2):** they go only to the door. Every log line, the result and the report are scrubbed of any credential string as well, and an answer's error is kept only as an identifier code.
- **Seeding (R3):** text-heavy uses text PDF pages (they grow the database by extracted text), scan-heavy uses scanned pages (they grow stored files). The mix's own kind is added first, the other only for the store the first does not grow. Each document's page count comes from the growth the gauge measured for the last document of that kind. Seeding stops when both sizes are within 10 %. Files come from test-support's `pdfgen`. `stress_pages` adds the 5,000-page document R5's stress run needs.
- **Densities (R5):** "busiest 10 %" means the first 10 % of the seeded documents in seed order. Ordinary interprets pages 1, 21, 41 … of those; heavy pages 1, 6, 11 … of every document; stress every page of the stress document. The acts are the profile's `interpretation.acts` (how opened, cited, marked, accepted), and the three reads (`interpretationOf`, `proposeParts`, `partsOf`) are `interpretation.reads`, each naming its op. A refused act (for example extraction R119's ceiling) ends that density, and the refusal is recorded with its code, figure and count held.
- **Ceiling (R6):** the rows held by the last density at which the interpretation screens still held at the rated members, cut to what the room left under the level's record bound would take (database and stored files apart). "Rated documents" defaults to the seeded documents and can be given to `report`. When the ordinary rate is 0, the ceiling is flagged.
- **Report (R4):** `report` returns `{rows, text}`, one Markdown table line a level, and appends them to `path` when given. It does not edit PLATFORM.md; BOB records the row there.

## Not verified here

No run against a deployed copy: no live latency, cost, door wait or gauge. The tests speak through a fixture door (`bio-plane/test/m/load-check/fixture-copy.mjs`) that stands for a deployed Civicsmith. The first live run is BOB's, on a `p3dev-` scratch copy in the permitted account, starting with the dry run on the smallest record that the Suggestions ask for.

## Attempt 2 (7 Nov 2026): re-tested against op-declarations e4c350c01d

op-declarations' layer PR 802 (e4c350c01d) only adds op specs (`exportwhole`, `exportwholepart`) and moves five member ops under `ACT_HELP_ABSENT` grounds. load-check reads only `OPS` and each spec's `mutating` flag (`guard.mjs` `declaredOp`, `run.mjs` `itemsOf`), and both still have the same shape. The suite (21 tests, R1 to R7) passes on job/load-check, which includes e4c350c01d. No code or test change: a test that only confirms passes with nothing reverted, so the gate's revert check would refuse it.
