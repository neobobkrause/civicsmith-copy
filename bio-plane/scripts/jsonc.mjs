/* bundler R11: the module's one JSONC reader (T19 retired the old process's `tools/jsonc.mjs` copy).
   `deploy.mjs`, `resolve-version.mjs`, `deploy-fleet.mjs` and `release-assemble.mjs` all read
   `wrangler.jsonc` through it. */
/* Read a `wrangler.jsonc` — JSON with comments — without corrupting its strings.
 *
 * ONE COPY, because two tools now read the same configs for the same reason:
 * `deploy-fleet.mjs` derives a member's bindings to deploy it, and
 * `release-assemble.mjs` derives the same bindings to SIGN them. If those two
 * parsed differently, a release would be signed describing one binding set and
 * deployed with another, and the disagreement would surface as a signature
 * failure on a good release — the exact class of divergence `fleetStatement`
 * exists to prevent, one level down.
 *
 * THE STRIPPER IS STRING-AWARE, and that is not fastidiousness: a naive
 * `/\/\/.*$/` strip eats the `//` in any URL, and these configs carry several
 * (`$schema`, the observability docs link). It tracks quoting and escapes so a
 * `//` inside a string stays, and a `"` inside a comment is ignored.
 */
export function stripJsonc(text) {
  let out = "", inStr = false, quote = "", inLine = false, inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inLine) { if (c === "\n") { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === "*" && n === "/") { inBlock = false; i++; } continue; }
    if (inStr) {
      out += c;
      if (c === "\\") { out += text[++i] ?? ""; continue; }
      if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }
    if (c === "/" && n === "/") { inLine = true; i++; continue; }
    if (c === "/" && n === "*") { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}

/** Parse a JSONC file's text, naming the file when it does not parse. */
export function parseJsonc(text, what = "config") {
  try { return JSON.parse(stripJsonc(text)); }
  catch (e) { throw new Error(`${what} did not parse as JSONC: ${e.message}`); }
}
