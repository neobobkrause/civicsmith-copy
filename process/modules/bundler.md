Length: 77 lines. Last section: "Suggestions".

# bundler: requirements

Next number: 43

## Public

### Purpose

Builds each member of the fleet (the plane and the workers) into one bundled artifact with a manifest of hashes, and verifies that a committed artifact is exactly what its source builds, so a stale artifact fails instead of shipping. The release tooling run over the whole fleet is `release`'s.

### Provides

**`discoverMembers(repoRoot?)` → members.**
- **R1** [met] Lists the fleet's members from the repository, each with its directory and entry point, in a stable order.

**`buildMember(member, {write?})` → built.**
- **R2** [met] Bundles the member with one recipe (ES module output, platform-neutral, the declared externals), with the working directory pinned to the member's own directory and symlinks preserved, so the same source gives the same bytes from any checkout layout. (T51 fix round 6, G39; K4616, K4620) A fleet member's and the plane's bundle is pure ASCII: no byte over 0x7F. Comments are stripped (a licence banner is kept, its characters written as `\uXXXX` text), template literals are lowered, strings and identifiers are written ASCII, and every other non-ASCII character of a string or regex literal is written `\uXXXX` (`\u{X}` for an astral one in a `u` or `v` regex) by a pass over the output's tokens that changes no value and no regex pattern or flag. A non-ASCII character anywhere else, including the raw text of a template literal that was not lowered, refuses the build `[NON_ASCII_REMAINS]` naming the line. A descriptor that is neither a fleet member nor the plane (the standalone case checker's) keeps its form; a boolean `bundle.ascii` overrides either way. Provided beside the recipe: `asciiOptions()` (the esbuild options) and `asciiOutput(bytes)` (the pass), for a caller that builds with its own esbuild call (the installer's). Test: a fixture with a non-ASCII character in a comment, a string, an untagged, a tagged and a `String.raw` template and BMP and astral regexes builds to a bundle with no byte over 0x7F whose values and regexes equal the opt-out build's; an unlowered template or an identifier refuses; a descriptor with neither marker is unchanged; the plane and every real member build to no byte over 0x7F, and the plane boots and answers one Store op in raw workerd at `--max-old-space-size=60`.
- **R3** [met] Writes the artifact only when `write` is true.

**`manifestFrom(member, built)` → manifest.**
- **R4** [met] Records the SHA-256 of the artifact, of every first-party input file, and of the member's lockfile, and the pinned working directory. (T51 fix round 6, G39; K4620) The manifest's `recipe` also records `ascii`: R2's options, or `false` for an opt-out.

**`writeMember(member)`.**
- **R5** [met] Builds with writing on and writes the artifact and its manifest.

**`verifyStatic(member)` → result.**
- **R6** [met] With no dependencies installed, reports stale when any recorded input's hash, or the lockfile's, differs from the file now; reports which input. (T51 fix round 6, G39; K4620) A committed manifest whose `recipe.ascii` differs from the tree's is stale, naming `recipe.ascii`; the fleet gate also holds every committed bundle to no byte over 0x7F.

**`verifyFresh(member, committed)` → result.**
- **R7** [met] Where the member's dependencies are installed, rebuilds without writing and reports stale unless the bytes equal the committed artifact exactly; where they are not installed, says it could not check, never that the artifact is fresh.

**`unresolvableSpecifiers(text, allowed?)` → list.**
- **R8** [met] Lists every static `import` or `export … from` specifier in a built artifact that is neither bundled nor in the allowed externals (what a one-part upload must resolve at instantiation). A dynamic `import()` is not listed; `verifyFresh` checks those through the build's own metafile. (T51 fix round 6, G39; K4620) The scan accepts an `import` or `export` statement after `}` (a minified bundle).

**Provenance (`readGitProvenance`, `stateOf`, `classifyDiscovered`, `reportProvenance`).**
- **R9** [met] For a set of files, states for each whether it is committed and unchanged, changed, or untracked in the repository, and reports it.

**`stripJsonc(text)`, `parseJsonc(text, what?)` → string, object.**
- **R11** [met] `stripJsonc` removes `//` line comments (keeping their newline) and `/* … */` block comments, and nothing inside a single- or double-quoted string (escapes honoured), so a `//` in a URL survives. `parseJsonc` returns the parsed object, and throws `Error` reading `<what> did not parse as JSONC: …` otherwise. One implementation serves every caller in the module.

**`deriveBindings(cfg, {slug, version, instanceClaudeToken?, instanceAiToken?})` → bindings.**
- **R13** [met] From a parsed `wrangler.jsonc`: `plain_text` `VERSION` (the argument) and `INSTANCE_NAME` (the slug); each `vars` entry but `VERSION` as `plain_text`; each `r2_buckets` entry as `r2_bucket`; each `services` entry as `service`, a target of `bio-plane` replaced by the slug and any other kept as written; `browser` when declared; `secret_text` `INSTANCE_AI_TOKEN` only when given; never a Claude credential (K1502). No Durable Object binding is emitted.
- **R14** [met] Throws `REFUSED [NO_SLUG]` or `[NO_VERSION]` when either is missing; `[UNKNOWN_BINDING_CLASS]` naming each other binding key the config declares non-empty (`kv_namespaces`, `d1_databases`, `queues`, `analytics_engine_datasets`, `ai`, `vectorize`, `hyperdrive`, `dispatch_namespaces`, `mtls_certificates`, `send_email`, `wasm_modules`, `data_blobs`, `text_blobs`); `[BROWSER_BINDING_UNNAMED]` for a `browser` with no `binding`; `[PHANTOM_TARGET]` if a derived service still targets `bio-plane`. `serviceTargets(bindings, slug)` lists the service targets other than the slug.

**`deriveLimits(cfg)`, `limitsReadBack(settings, want)`.**
- **R15** [met] `deriveLimits` returns `{subrequests, cpu_ms?}` from `cfg.limits`; throws `REFUSED [NO_SUBREQUEST_LIMIT]` unless `subrequests` is a positive integer, and `[UNKNOWN_LIMIT_KEY]` for any key but `subrequests` and `cpu_ms`. `limitsReadBack` returns `{verdict, why}`: `UNDETERMINED` when the settings are unreadable or state no `limits.subrequests`, `MISMATCH` when it differs from `want.subrequests`, `MATCH` otherwise. Neither makes a request.

  (T51, G54; K4711) `deriveObservability(cfg)` returns `{enabled: true}` and throws `REFUSED [NO_OBSERVABILITY]` unless `cfg.observability.enabled` is `true`, and `[UNKNOWN_OBSERVABILITY_KEY]` for any key but `enabled`; `observabilityReadBack(settings, want)` returns `{verdict, why}`: `UNREADABLE` when the settings are unreadable, `MISMATCH` when they state no `observability` or an `enabled` that differs from `want.enabled`, `MATCH` otherwise. Neither makes a request.
**Build the plane (`npm run build` in `bio-plane/`, `scripts/build-plane.mjs`).**

**Container members** (T34-6; K1601, K1678 (1), K1705)
- **R24** [met] (N578) A member whose `fleet-member.json` has `"kind": "container"` and an `image` block is a *container member*: R1 discovers and lists it with its kind and its `image`, and it is not bundle-guarded, so R6, R7, R21 and R22's freshness proofs never report it stale, unguarded or missing an artifact for want of a Worker bundle.

**A member's word rows** (K3953)
- **R38** [met] (K3953; P17, BOB's) A fleet member's bundle carries only the word rows its own inputs can read, never the whole table: every row whose key is named by a string literal at a `word`, `localize` or `hasWord` call in any of the member's bundled inputs, and every row under a literal prefix from which a call builds its key (`'refusal.' + code`); the plane's bundle is unchanged. A call whose key has no literal prefix (a wrapper reading a variable key) makes the build keep the whole table for that member and list every such site in its manifest (`words: "all"`, the sites by file and line), so no row a member reads can be left out; each such site is an entry of its module's job, and once none is left every member keeps only its own rows (K3958). The member's manifest records the rows kept (their count and digest), and `verifyFresh` covers them. Test: a real fleet member's bundle holds the rows its inputs name and no other (each member's row count stated); controls: a fixture reading `'refusal.' + code` keeps every `refusal.` row; a fixture reading a key from a bare variable keeps the whole table and names the site; the real-fleet test names each member that keeps the whole table and its sites (agent-worker at K3958), and states every other member's kept row count.

## Private

### Uses

- `setup-words`: its vendored parser (`vendor/acorn.mjs`), read by R38's word-row trim at build time; and `WORD_ROWS`, the rows it trims (K3961).

### Invariants

- **R10** [met] Verification never writes: no verifying call creates or changes a file.

### Satisfies

- `docs/architecture/BIO_Distribution_v0_1.md`: an installable fleet is one bundled, hashed, signed artifact per member.
- `build/layers.md`, "Helper modules".

### Suggestions

- Its tests build a tiny fixture member in a temporary directory; `esbuild` comes from the plane's installed dependencies.
- **Release tooling (BOB-5).** The job moves `tools/`' four files beside the scripts (one directory for the module's commands), makes `tools/jsonc.mjs` and `scripts/jsonc.mjs` one (R11), re-points `bio-plane/package.json`'s `build` and `deploy` scripts if a path moves (legacy-index's file, `from`), and N31: `fleet-bundle.mjs`' remedy text names the rebuild command at its new path. Tests drive the commands at their interface: R11–R15 as functions; R16–R23 against a fixture repository with `fetch`, `wrangler` and `ssh-keygen` stubbed or a throwaway key, never a real account.
