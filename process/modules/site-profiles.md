Length: 84 lines. Last section: "Suggestions".

# site-profiles: requirements

Next number: 23

**Size (P6).** About 905 lines copied. `docprofile` keeps about 3,150 after its deletion.

## Public

### Purpose

Recognises which host-technology stack served a captured document (`identify`) and, under that stack's handler, reduces its bytes to three digests that separate machinery, furniture and substance (`digests`, `compare`); judges whether a rendition is faithful enough to show (`fidelity`); serialises the profile for the capture's provenance (`profileRecord`). It also holds the one recogniser registry and confidence ladder every recognition axis is built on, and the one significance-graded event catalogue. The four stack handlers (`aspnet_webforms`, `wordpress`, `client_rendered`, `conservative`) detect technology and need no jurisdiction.

### Provides

**`identify(ctx) → {handler, confidence, signals, considered, kind?, why?}`** `ctx` carries whatever the caller knows about one fetch: `headers`, `locator` (the address), `content_type`, `text` (the bytes decoded, when read as text).
- **R1** [met] (was `docprofile` R1) Always returns a handler: the first registered stack recogniser to match at CERTAIN confidence, else the highest-confidence match among those that matched, else the always-present `conservative` handler at confidence NONE, with `why` stating that nothing was recognised.
- **R2** [met] (was `docprofile` R2) `kind` is the winning handler's own classification of the address (for example an index, a record, a shell) when the handler defines one; absent when it does not. (Fix round 9, G140) The kind `shell` is given, and `identify`'s answer carries `shell: true`, exactly when the winning handler is `client_rendered` at CERTAIN confidence; a `client_rendered` match at LIKELY or POSSIBLE (a server-rendered page with one framework marker) still ranks by R1 but gives no `shell` kind and no `shell: true`.
- **R3** [met] (was `docprofile` R3) Confidence is one of the ONE ladder's four values (R4) — CERTAIN, LIKELY, POSSIBLE, NONE — shared by every recogniser built on R5's registry, on every axis.
- Errors: never throws, provided every registered handler's own `detect` does not.

**`CONFIDENCE`**, **`confidenceRank(c)`**
- **R4** [met] (was `docprofile` R28) `CONFIDENCE` is the one ladder shared by every axis: `CERTAIN`, `LIKELY`, `POSSIBLE`, `NONE`, ranked in that order; `confidenceRank` answers a value's rank on it (an unknown value ranks with NONE). Never throws.

**`makeRegistry(opts) → {register, all, fallbackMember, recognise}`** The one recogniser registry, for any axis. A member is a recogniser: `key`, `label`, `version` and `detect(ctx) → {match, confidence, signals}`.
- **R5** [met] `register(m)` appends `m` (most specific first) and returns it; `all()` answers the members in order. `recognise(ctx)` always answers a member: the first to match at CERTAIN, else the highest-confidence match (the earlier on a tie), each with `considered` listing every member that matched with its confidence and signals and `matched: true`; when none matches, the fallback member (the one `opts.isFallback` names, by default the one carrying `fallback: true`, else the last) at confidence NONE with `matched: false`. Errors: a member's `detect` throwing propagates.

**`digests(bytes, handler, ctx) → {identity, rendition, evidentiary, applied, boundary_missed, mechanical_bytes, presentational_bytes, textual}`** `ctx.sha256` is a caller-supplied hash function.
- **R6** [met] (was `docprofile` R7) `identity` is always `sha256(bytes)`.
- **R7** [met] (was `docprofile` R8) When `handler.textual` is false, `rendition` and `evidentiary` both equal `identity` and `textual` is `false` on the result.
- **R8** [met] (was `docprofile` R9) When textual: `rendition` is the decoded text with the handler's MECHANICAL rules applied; `evidentiary` additionally has the handler's declared BOUNDARY applied (everything outside it normalised as presentational, region `"presentational"`) or, when the handler declares no boundary, its own PRESENTATIONAL rules. The three region labels a rule or a boundary reports under are exactly `"mechanical"`, `"presentational"` and `"evidentiary"` (`REGION`).
- **R9** [met] (was `docprofile` R10) A declared boundary that does not match the text normalises NOTHING beyond the mechanical pass, and `boundary_missed` is `true`; a boundary that missed is never read as a document with no content.
- Errors: throws only when `ctx.sha256` is not a function (a caller precondition); otherwise never throws.

**`compare(before, after, handler, ctx) → {verdict, evidentiary_change, why, handler, confidence, artifacts, applied, digests}`** The byte layers of a change question (`docprofile`'s `assess` L2–L3). `ctx` is `digests`' plus `confidence` (the handler's, from `identify`).
- **R10** [met] `verdict` is `identical` when the identity digests are equal; else `undetermined` (`evidentiary_change: null`) when `ctx.confidence` is not CERTAIN and the handler is not the `conservative` one; else `changed` when the evidentiary digests differ; else `restyled` when the rendition digests differ; else `unchanged`. `evidentiary_change` is `true` only for `changed`, `false` for the rest but `undetermined`; `why` states the verdict in words. Errors: as `digests`.

**`fidelity(manifest, handler, ctx) → {level, missing, critical, why?}`** `manifest.subresources` is a list of `{ok, reason?, kind?, url?}`.
- **R11** [met] (was `docprofile` R26) `level` is `faithful` when every part is present or ignorable by the handler; `degraded` when every missing part is non-critical (named in `missing`, none in `critical`); `insufficient` when any missing part is render-critical (named in `critical`), and the render is refused rather than shown misleadingly.
- Errors: never throws.

**`profileRecord(id, ctx) → record`** Serialises one `identify()` result for the capture's own provenance.
- **R12** [met] (was `docprofile` R27) Returns `{handler, handler_label, handler_version, confidence, signals, document_kind, considered, at, note}` — the handler's own key/label/version, `identify`'s confidence and signals, `id.kind` (or `"unknown"`), `ctx.now` or the current instant, and `id.why` (or `null`) as `note`. A judgment's author and version are always named, so a later session can find and revise it.
- Errors: never throws.

**The event catalogue: `SIGNIFICANCE`, `EVENTS`, `event(type, detail)`, `significanceRank`, `worstSignificance(events)`, `isMeaningful(events)`, `bySeverity(events)`**
- **R13** [met] Every event kind a recogniser may emit is named once in `EVENTS` with its fixed significance, one of `SIGNIFICANCE`'s `event`, `notice`, `routine`. `event(type, detail)` answers `{type, significance, ...detail}` with the catalogue's significance, and throws on a type the catalogue does not hold (a defect in the caller, never defaulted).
- **R14** [met] `worstSignificance` answers the highest significance among the events (`event` > `notice` > `routine`), or `null` for none; `isMeaningful(events)` is exactly `worstSignificance(events) === "event"`; `bySeverity` sorts the list worst first, in place. None throws on a list of events.

**`unescapeHtml(s) → string`**
- **R15** [met] Decodes `&amp;`, `&#39;`, `&quot;`, `&lt;`, `&gt;` and `&nbsp;` (to a space) in `String(s)`, nothing else, to read keys out of markup; never rewrites anything the record holds. Never throws.

**Bounded work and the one decode (fix round 9, G140, G131g; X22, X9; ruled K4835 (4): `handlers/client-rendered.mjs` is included)**
- **R20** [met] Every stack recogniser's `detect` examines the `text` it is given in work linear in the characters it examines, over the window the caller hands it, whatever the shape of the text (240 KB of `<div` with no closing, a long run of one marker, a long line). When `ctx.work` is an object `{chars}`, each `detect` adds the characters it examined to `ctx.work.chars`; the count is at most 4 times the window, and a test asserts the count, not a time. No `detect` builds a copy of the text larger than its window.
- **R21** [met] `identify`'s verdict never changes what is read: a recogniser's match, at any confidence, decides how a document is watched (`docprofile`'s `assess`) and never whether its text is read or what text is read.
- **R22** [met] `digests(bytes, handler, ctx)` decodes a textual document's bytes through ooxml's `decodeText` (its R36), not as a fixed encoding: a page in windows-1252 or UTF-16 yields its text and not replacement characters. A document whose declared encoding `decodeText` answers `ENCODING_UNSUPPORTED` for is treated as not textual (R7: `rendition` and `evidentiary` equal `identity`), stated in the result, never decoded lossily.

## Private

### Uses
- `ooxml`: `decodeText` (its R36), for R22 (the edge `site-profiles -> ooxml` is new, fix round 9, G131g).
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R16** [met] (`docprofile` R30's stack clause) No place is named in this module's code. The four stack handlers hold no local facts and need none, because they recognise technology, never place.
- **R17** [met] (`docprofile` R31) Deterministic over its inputs: the same `bytes`/`text` and the same `ctx` values always give the same answer, except `profileRecord`'s `at` without `ctx.now` (R12); nothing in this module reads a store or the network.
- **R18** [met] (`docprofile` R32) The failure asymmetry governs every default: an unrecognised document is never assumed decorated (`conservative` treats almost nothing as machinery and nothing as furniture, so any byte difference is reported), and a handler applied without CERTAIN confidence never asserts "unchanged" — only `conservative`'s own narrowing is trusted without certainty.
- **R19** [met] (`docprofile` R35) Every "no" (no match, no confidence, no digest, no meaningful change) says which kind of no and why; absence is never reported as sameness and never as non-existence.

### Satisfies

- `docs/architecture/BIO_Content_Framework_v0_10.md` §4, "One extension shape: the RECOGNISER" (the registry and ladder every axis shares), and §16, "How content is extracted today" (Identify).
- `docs/development/DOCUMENT-PROFILES.md`: the stack axis, the three digests, fidelity.
- `build/layers.md`, "No jurisdiction in the product".
- K4835 (4) and K4837 (fix round 9, G140): the linear detect and the shell-only-when-CERTAIN rule are in force for `client-rendered.mjs` as for the other handlers (R20-R21); G131g: one decode for every text a module reads (R22).

### Suggestions

- **Registration.** R1 requires the four built-in handlers registered (in order `client_rendered`, `aspnet_webforms`, `wordpress`, `conservative`: a shell can also be served by ASP.NET or WordPress, so `client_rendered` goes first) at this module's own interface, so `identify` is testable here without `docprofile`. `docprofile/registry.mjs` registers them today and stays `docprofile`'s; this module's job decides where its own registration sits (the handlers import `REGION` and `CONFIDENCE` from `index.mjs`, so beware an import cycle), and `docprofile`'s job then stops registering and only re-exports.
- **`register`/`handlers`, `applyRules`/`applyBoundary`.** The stack registry's `register`/`handlers` and the two rule primitives are how the built-in handlers and `digests` work; no other module calls them, so they are not required. The job may keep, narrow or drop them as long as R1–R19 hold.
- **No edge from the old interface.** (The retired `legacy-ui`, K4100, once bundled `docprofile`; no such edge exists now.)
- The events' error message names `docprofile`; the copy may name this module.
