Length: 83 lines. Last section: "Suggestions".

# calc-grammar: requirements

Next number: 24

**Size (P6).** About 800–1,200 lines (ladders §8.4).

## Public

### Purpose

The pure engine of calculation: it reads figures exactly as printed, holds them as exact decimals with unit, currency and precision, and evaluates recipes written in one closed grammar (`bio-calc/1`), refusing by name any total the summation rule forbids. It also makes recorded random draws over a frozen set, with an exact interval. It holds no record and runs no user code.

### Provides

**Values.** A *figure* is `{value, sign, unit?, currency?, precision, as_read}`: `value` an exact decimal written as a string of digits with at most one `.` and no exponent; `sign` `+` or `-`; `precision` one of `exact`, `rounded`, `approximate`, `range` (a range carries `low` and `high` in place of `value`); `as_read` the source's characters, unchanged. A *table* is `{fields: [{name, type, unit?, currency?}], rows}`, `type` one of `string`, `number`, `integer`, `date`, `datetime`, `boolean` (Table Schema's). No service throws, except `TypeError` for an argument of the wrong JavaScript type.

**parseFigure(text) → figure or `{refused, why}`**
- **R1** [met] Reads a figure as printed: digits with thousands separators and a decimal point, a leading or trailing currency sign or code, a minus sign or accounting parentheses, `%` (unit `percent`), and a scale word (thousand, million, billion, trillion and their abbreviations), scaled exactly: `$4.2 million` is `4200000`, never `4199999.99…`. Two signs, an unclosed parenthesis or an unknown scale word is refused with why.
- **R2** [met] `precision` is `approximate` when the text qualifies the figure ("about", "approximately", "nearly", "over", "~"), `range` when it states two figures joined by a dash or "to", `rounded` when a scale word is applied to fewer decimal places than the scale, and `exact` otherwise. Its `as_read` is the input as given.
- **R3** [met] It accepts every figure `consequences`' parser accepts today (`consequences/figures.mjs`, its R2) with the same value, so `consequences` can import it in place of its own (C:A-11).

**decimal arithmetic: `add`, `subtract`, `multiply`, `divide(a, b, {places, mode})`, `round(a, {places, mode})`**
- **R4** [met] `add`, `subtract` and `multiply` are exact (`0.1 + 0.2` is `0.3`). `divide` and `round` give the stated number of decimal places under a stated `mode` (`half_even`, `half_up`, `down`, `up`); a missing mode is refused `ROUNDING_UNSTATED`. A result rounded by them carries `precision: rounded` unless it was exact. Division by zero is undetermined, never zero or infinity.
- **R5** [met] Operands of different currencies, or of different units where the operation needs one, are refused `UNIT_MISMATCH`, naming both. An `approximate` operand makes the result `approximate`; a `range` operand makes the result a range bounding every reading.

**checkRecipe(recipe) → `{ok}` or `{ok: false, errors}`**. A recipe is `{method, inputs, steps, output}`: `method` `bio-calc/1`; `inputs` names each input (a table or a figure) by a name the caller binds; `steps` a list of `{op, as, ...}`; `output` the name of the step whose result is the answer.
- **R6** [met] The grammar is closed: `op` is one of `select`, `count`, `sum`, `difference`, `ratio`, `share`, `group`, `span`, `compare`, `round`, `join`, `sort`. Any other op, any field not in the step's form, any expression string, function or reference to code is refused `RECIPE_INVALID`, naming the step and field. A method other than `bio-calc/1` is refused `METHOD_UNKNOWN`. A step that names an input or step not defined before it is refused `NAME_UNDEFINED`.

**evaluate(recipe, bound, {resolveId?}) → `{result, undetermined_rows, trace}` or refusal.** `bound` maps each input name to its table or figure; `resolveId(space, value)` is the caller's normaliser for a `join`.
- **R7** [met] `select` keeps the rows whose named field satisfies every condition (`eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `between`, inclusive); a row whose field is undetermined (empty, or not parsing as its type) is neither kept nor dropped but counted in `undetermined_rows`, never coerced. Dates compare through `civil-time`'s `compare`; a row it answers `undetermined` is counted likewise.
- **R8** [met] `count` counts rows; `sum` totals a numeric field exactly; `difference` subtracts two figures or totals. `ratio` gives `{numerator, denominator, value}`; `share` is a ratio of a selection to the rows it was selected from and always carries its denominator. A denominator of zero is undetermined.
- **R9** [met] `group` gives one result per distinct value of the named fields, in the order the values first appear; `span` gives, per row, `civil-time.span` between two date fields in a stated unit; `round` is R4's.
- **R10** [met] `compare` gives `{relation, label: "computed fact"}`, `relation` one of `lower`, `equal`, `higher`, `undetermined`; it never states a breach, a violation or a judgment (D275).
- **R11** [met] `join` joins two tables only through an identifier space or a crosswalk input named in the step: values are compared after `resolveId(space, value)` (or the crosswalk's pairs), never as raw strings or by name. A `join` naming neither is refused `JOIN_UNKEYED`; one naming a space with no `resolveId` given is undetermined, why "no resolver for the space" (D184).
- **R12** [met] `sort` orders rows by one numeric or date field the step names (a stated quantity), ascending or descending, ties kept in input order. A `sort` by a string field, or by a value composed in the recipe from more than one quantity, is refused `SORT_NOT_QUANTITY` (K1471).
- **R13** [met] The summation rule: a `sum` over rows that differ in `kind`, `phase` or `stage`, `basis`, `currency` or `period` (where the table declares those fields) is refused by name: `SUM_MIXED_KIND`, `SUM_MIXED_STAGE`, `SUM_MIXED_BASIS`, `SUM_MIXED_CURRENCY`, `SUM_MIXED_PERIOD`, naming the values found (K1463; ladders §2 MONEY).
- **R14** [met] `trace` lists each step with its input row count, output, the rows set aside as undetermined and why, and the method version; `evaluate` reads nothing but its arguments, and the same arguments give the same result.

**resultKey(recipe, inputHashes) → 64 hex characters**
- **R15** [met] The SHA-256 of the canonical JSON (keys sorted, no white space) of `{recipe, inputs: inputHashes, method_version}`; the same recipe and inputs give the same key under one method version, and a different method version gives a different key (ladders §2 ANALYSIS).

**draw({frame, n, seed}) → `{sample, frame_hash, seed, method}`**. `frame` is the frozen set: a list of distinct keys.
- **R16** [met] Selects `n` keys by ranking every key on SHA-256 of `seed` and the key, and taking the first `n`; the result is fully reproducible from `frame`, `seed` and `method`, and `frame_hash` is the SHA-256 of the canonical sorted frame. `seed` comes from the caller and is recorded in the result; the module reads no clock or randomness source of its own. `n` above the frame's size, or a frame with a repeated key, is refused (K1448; DEC-22).

**interval({frame_size, sample_size, successes, confidence}) → `{low, high, method}`**
- **R17** [met] The exact interval for a proportion in a frame of `frame_size` from a simple random sample drawn without replacement (hypergeometric), at the stated `confidence`: `low` and `high` are counts in the frame, each the extreme count whose tail probability is not below `(1 − confidence)/2`. `method` names it. Inputs out of range are refused (K1448).

**relate(a, b) → relation** (N567; K1569)
- **R21** [met] `relate` is exported from the module's index beside R4's arithmetic: R10's relation of two figures, `lower`, `equal`, `higher` or `{undetermined, why}`, refused `UNIT_MISMATCH` as R5 says, so a caller (`duties`) imports it from the index and from no inner file.

**A streamed table** (N571; K1576; `calculations` R1)
- **R22** [met] A table input of `evaluate` may also be bound as a *streamed table*: `{fields, rows}`, `rows` a function that answers, on each call, a new iterator over the table's rows, each row an array of its cell values in `fields` order, not an object keyed by field name. Over a streamed table `evaluate` answers exactly as over the same table bound as row objects (R7–R14: the same `result`, `undetermined_rows` and `trace`), and a malformed one is refused `INPUT_INVALID` as a malformed table is. Evaluating any recipe of R6's grammar over a streamed table of 1,000,000 cells grows the heap by less than the 35 MB K1576 measured for 500,000 cells as row objects, so `calculations` R1's cell bound can return to about 1,000,000; the test measures the growth and states it. A table result whose source was bound streamed is answered streamed, `{fields, rows}`, holding the same table as the row-object answer; a result over row objects alone is answered as before (K1734).
- **R23** [met] (fix round 9, G183; K5011; S-31) **`draw` and `interval` scale to the table bound.** `draw` over 1,000,000 keys yields on bounded slices and answers the same sample; `interval` is O(n log n) or better with the same intervals. Test: a 1,000,000-key draw equal to today's sample with no synchronous stretch over one slice; `interval` over 100,000 values, same result.

## Private

### Uses

- `record-grammar`: the id grammar, for names that bind inputs to record ids in a trace.
- `civil-time`: `compare` (R7), `span` (R9).
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R18** [met] No eval and no user code: no `eval`, `Function`, dynamic `import` or regular expression built from recipe text appears in the module; a recipe is data only.
- **R19** [met] Pure and exact: no store, no network, no clock, no floating-point arithmetic on a figure's value; a test sums 10,000 two-decimal figures against a decimal reference with no difference.
- **R20** [met] Every refusal and every undetermined answer says which kind of no and why; an undetermined value is never read as zero.

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §2, ANALYSIS (closed grammar with a method version; result keys; `span` from civil-time; joins through an id space or crosswalk; `compare` a computed fact) and MONEY (exact decimals with `as_read`, sign and precision; the summation rule); §8.4 L2; §8.5 L4 (recorded random draws).
- Rulings K1448, K1463, K1471, K1504 (Choices 4).

### Suggestions

- **For the caller** (`calculations`): canonical tables, their hashes, which rows a recipe's inputs are, and the flagging of interfund transfers summed city-wide (ladders §2 MONEY) are `calculations`' and `money`'s, which know a table's scope; this module refuses only what a recipe's own rows show (R13). A ranking's scope and period are named on the `CALC-` object (K1471).
- `consequences` R2 names `product`; a product is R4's `multiply`, not a recipe step, so the closed grammar of R6 is the ladders' list unchanged.
- SHA-256 can be computed synchronously in-module, so every service stays synchronous; tests compare it with `node:crypto`.
- R16's ranking by hash, rather than a seeded generator, lets a stranger reproduce a draw with any SHA-256 tool. R17's hypergeometric interval is exact for a finite frozen frame; Clopper–Pearson is the binomial alternative if BOB prefers it.
- **R22's streamed table.** Steps that keep rows (`select`, `group`, `sort`, `join`) may hold what they keep; a step that only totals or counts (`sum`, `count`, `share`) can read the iterator once without holding it. A caller streams the canonical CSV `calculations` holds row by row (its R1).
- `divide`'s places for `ratio` and `share` in R8: 12 decimal places, `half_even`, carried as `precision: rounded`, is a starting choice.
