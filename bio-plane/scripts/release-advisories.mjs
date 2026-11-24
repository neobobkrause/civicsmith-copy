#!/usr/bin/env node
/* THE THIRD-PARTY CODE A RELEASE SHIPS, AND THE ADVISORIES KNOWN AGAINST IT (bundler R28, R29; T35-6, F21, K1881).
 *
 * `thirdPartyInventory` (R28) lists every third-party package the release ships, from three sources: the production
 * install each lockfile resolves (the plane's and every member's the release carries), each container member's image
 * packages (R27, the same reading the signed `container.json` part carries), and the module's own declaration of
 * committed third-party code no lockfile names (`third-party.json`, beside this file). A source it cannot read is
 * named in `unread`, never dropped: an inventory that silently lost a lockfile would report the release clean of
 * exactly what it could not see.
 *
 * The command (R29) asks a public advisory database, OSV, which answers npm, crates.io, PyPI and the system-package
 * ecosystems a container member's package statement names (Debian, Alpine, …) alike, for each
 * entry, prints what it said, and names every package with a known advisory. IT REFUSES NOTHING: whether a release
 * goes out over an advisory is the operator's call (K1900 (1)). What it never does is call an entry clean that it
 * did not check: an unread source, an unreachable database or an unreadable answer is "not checked", by name, and
 * exits 1.
 *
 * usage, from the repository root, at each release:
 *   node bio-plane/scripts/release-advisories.mjs [--out <file.json>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, discoverMembers, isContainer, npmProductionPackages, containerClasses, classPackages } from "./fleet-bundle.mjs";

export const DECLARATION = "bio-plane/scripts/third-party.json";
export const ECOSYSTEMS = Object.freeze(["npm", "crates.io", "PyPI"]);
export const OSV = "https://api.osv.dev";

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ---- R28 (c)'s lock formats ---------------------------------------------- */

/** A Cargo.lock's crates, each `{name, version}`, leaving out every crate with no `source` (the root crate and any
 *  local path crate: first-party, and from no registry). */
function cargoLockPackages(text) {
  const blocks = text.split(/^\[\[package\]\]\s*$/m).slice(1);
  if (!blocks.length) throw new Error("it names no [[package]]");
  const out = [];
  for (const b of blocks) {
    const field = (k) => (b.match(new RegExp(`^${k}\\s*=\\s*"([^"]*)"\\s*$`, "m")) || [])[1];
    const name = field("name"), version = field("version"), source = field("source");
    if (!name || !version) throw new Error(`a [[package]] states no ${name ? "version" : "name"}${name ? ` (${name})` : ""}`);
    if (source) out.push({ name, version });
  }
  return out;
}

/** A pins file of vendored packages: `{packages: [{package, version}]}`. */
function pinsPackages(text) {
  const j = JSON.parse(text);
  if (!j || !Array.isArray(j.packages) || !j.packages.length) throw new Error("it has no `packages` list");
  return j.packages.map((p) => {
    if (!p || typeof p.package !== "string" || !p.package || typeof p.version !== "string" || !p.version)
      throw new Error(`an entry states no package or version: ${JSON.stringify(p)}`);
    return { name: p.package, version: p.version };
  });
}
const LOCK_FORMATS = { "cargo-lock": cargoLockPackages, pins: pinsPackages };

/* ---- R28 ------------------------------------------------------------------ */

/** `{packages: [{ecosystem, name, version, shippedIn}], unread: [string]}`. Makes no request; never throws. */
export function thirdPartyInventory(root = REPO_ROOT) {
  const found = new Map();
  const unread = [];
  const add = (ecosystem, name, version, shippedIn) => {
    const key = JSON.stringify([ecosystem, name, version]);
    if (!found.has(key)) found.set(key, { ecosystem, name, version, shippedIn: new Set() });
    found.get(key).shippedIn.add(shippedIn);
  };

  /* (a) every production lockfile: the plane's, and each member's the release carries. A container member with no
     Worker bundle is left out of the release (R25, K1730), so it ships nothing. */
  let members = [];
  try { members = discoverMembers(root).filter((m) => !(isContainer(m) && !m.bundle)); }
  catch (e) { unread.push(`the fleet's members could not be discovered: ${e.message}`); }
  for (const [dir, shippedIn] of [["bio-plane", "bio-plane"], ...members.map((m) => [m.dir, m.name])]) {
    const lockPath = join(root, dir, "package-lock.json");
    let declares = false;
    try {
      const pkg = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8"));
      declares = !!pkg && typeof pkg.dependencies === "object" && pkg.dependencies !== null && Object.keys(pkg.dependencies).length > 0;
    } catch { /* no package.json: nothing is installed */ }
    const r = npmProductionPackages(lockPath, `${dir}/package-lock.json`);
    if (r.unread) {
      /* No lockfile and no dependencies is a member that installs nothing, which is legal; anything else is unread. */
      if (/ is missing$/.test(r.unread) && !declares) continue;
      unread.push(r.unread);
      continue;
    }
    for (const p of r.packages) add("npm", p.name, p.version, shippedIn);
  }

  /* (b) each container member's image packages, R27's own reading, for every class: npm's from the member's lockfile,
     or a system image's from its package statement, under the ecosystem the statement names (T36-2). */
  for (const m of members.filter((x) => isContainer(x))) {
    for (const cls of containerClasses(m).classes) {
      const r = classPackages(m, cls);
      if (r.unread) { if (!unread.includes(r.unread)) unread.push(r.unread); continue; }
      for (const p of r.packages) add(r.ecosystem, p.name, p.version, m.name);
    }
  }

  /* (c) the module's declaration of committed third-party code. */
  let decl = null;
  try {
    decl = JSON.parse(readFileSync(join(root, DECLARATION), "utf8"));
    if (!decl || !Array.isArray(decl.sources)) throw new Error("it has no `sources` list");
  } catch (e) {
    unread.push(`${DECLARATION} ${e.code === "ENOENT" ? "is missing" : `does not parse: ${e.message}`}`);
    decl = null;
  }
  for (const [i, s] of (decl ? decl.sources : []).entries()) {
    const what = `${DECLARATION} source ${i + 1}`;
    if (!s || typeof s.shippedIn !== "string" || !s.shippedIn) { unread.push(`${what} names no member that ships it`); continue; }
    if (s.package) {
      const p = s.package;
      if (!ECOSYSTEMS.includes(p.ecosystem) || typeof p.name !== "string" || !p.name || typeof p.version !== "string" || !p.version) {
        unread.push(`${what} (${s.shippedIn}) does not state its package as {ecosystem, name, version}`);
        continue;
      }
      add(p.ecosystem, p.name, p.version, s.shippedIn);
    } else if (typeof s.lock === "string" && s.lock) {
      const read = LOCK_FORMATS[s.format];
      if (!read || !ECOSYSTEMS.includes(s.ecosystem)) {
        unread.push(`${what} (${s.lock}) states no known format and ecosystem`);
        continue;
      }
      let text;
      try { text = readFileSync(join(root, s.lock), "utf8"); }
      catch { unread.push(`${s.lock} is missing`); continue; }
      let pkgs;
      try { pkgs = read(text); }
      catch (e) { unread.push(`${s.lock} does not parse: ${e.message}`); continue; }
      for (const p of pkgs) add(s.ecosystem, p.name, p.version, s.shippedIn);
    } else unread.push(`${what} (${s.shippedIn}) names neither a package nor a lock file`);
  }

  const packages = [...found.values()]
    .map((e) => ({ ecosystem: e.ecosystem, name: e.name, version: e.version, shippedIn: [...e.shippedIn].sort(cmp) }))
    .sort((a, b) => cmp(a.ecosystem, b.ecosystem) || cmp(a.name, b.name) || cmp(a.version, b.version));
  return { packages, unread };
}

/* ---- R29: the advisory check --------------------------------------------- */

/** One advisory, as the report states it: id, summary, severity and fixed versions where OSV states them. */
export function advisoryOf(vuln, entry) {
  const sev = vuln.database_specific && typeof vuln.database_specific.severity === "string"
    ? vuln.database_specific.severity
    : (Array.isArray(vuln.severity) && vuln.severity[0] && vuln.severity[0].score) || null;
  const fixed = new Set();
  for (const a of vuln.affected || []) {
    if (!a || !a.package || a.package.ecosystem !== entry.ecosystem || a.package.name !== entry.name) continue;
    for (const r of a.ranges || []) for (const ev of r.events || []) if (ev && typeof ev.fixed === "string") fixed.add(ev.fixed);
  }
  return { id: vuln.id, summary: typeof vuln.summary === "string" ? vuln.summary : null, severity: sev,
    fixed: [...fixed].sort(cmp) };
}

async function post(path, body) {
  const r = await fetch(OSV + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path} answered ${r.status}`);
  return r.json();
}

/** Asks OSV about every entry. Each result is `{...entry, checked, advisories, why?}`. Never throws. */
export async function checkAdvisories(packages) {
  const results = packages.map((e) => ({ ...e, checked: false, advisories: [], ids: [], why: null }));
  const query = (e) => ({ package: { ecosystem: e.ecosystem, name: e.name }, version: e.version });
  /* querybatch: at most 1000 queries a call; it answers ids only, and a page token where an entry has more. */
  for (let i = 0; i < results.length; i += 1000) {
    const chunk = results.slice(i, i + 1000);
    let ans;
    try {
      ans = await post("/v1/querybatch", { queries: chunk.map(query) });
      if (!ans || !Array.isArray(ans.results) || ans.results.length !== chunk.length) throw new Error("its answer is unreadable");
    } catch (e) { for (const r of chunk) r.why = `OSV could not be asked: ${e.message}`; continue; }
    for (const [j, r] of chunk.entries()) {
      const one = ans.results[j];
      if (!one || (one.vulns !== undefined && !Array.isArray(one.vulns))) { r.why = "OSV's answer for it is unreadable"; continue; }
      const ids = (one.vulns || []).map((v) => v && v.id);
      let token = one.next_page_token;
      try {
        while (token) {
          const more = await post("/v1/query", { ...query(r), page_token: token });
          if (!more || (more.vulns !== undefined && !Array.isArray(more.vulns))) throw new Error("its answer is unreadable");
          ids.push(...(more.vulns || []).map((v) => v && v.id));
          token = more.next_page_token;
        }
      } catch (e) { r.why = `OSV's further pages for it could not be read: ${e.message}`; continue; }
      if (ids.some((x) => typeof x !== "string" || !x)) { r.why = "OSV's answer for it names an advisory with no id"; continue; }
      r.ids = [...new Set(ids)];
      r.checked = true;
    }
  }
  /* Each advisory's details, once. One that cannot be read leaves every entry it is known against not checked. */
  const details = new Map();
  for (const id of new Set(results.flatMap((r) => r.ids))) {
    try {
      const res = await fetch(`${OSV}/v1/vulns/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`answered ${res.status}`);
      const v = await res.json();
      if (!v || v.id !== id) throw new Error("its answer is unreadable");
      details.set(id, v);
    } catch (e) { details.set(id, { error: e.message }); }
  }
  for (const r of results) {
    for (const id of r.ids) {
      const d = details.get(id);
      if (d.error) { r.checked = false; r.why = `the advisory ${id} known against it could not be read: ${d.error}`; r.advisories.push({ id }); }
      else r.advisories.push(advisoryOf(d, r));
    }
    delete r.ids;
    if (r.checked) delete r.why;
  }
  return results;
}

/** The whole report: `{report, text, exit}`. */
export async function run({ root = REPO_ROOT, now = () => new Date() } = {}) {
  const inv = thirdPartyInventory(root);
  const askedAt = now().toISOString();
  const entries = await checkAdvisories(inv.packages);
  const lines = [];
  lines.push(`third-party code this release ships: ${entries.length} package(s) (bundler R28)`);
  for (const e of entries) {
    const head = `  ${e.ecosystem} ${e.name} ${e.version}  [${e.shippedIn.join(", ")}]`;
    if (!e.checked) { lines.push(`${head}  NOT CHECKED — ${e.why}`); }
    else if (!e.advisories.length) lines.push(`${head}  no known advisory`);
    else lines.push(`${head}  ${e.advisories.length} known advisor${e.advisories.length === 1 ? "y" : "ies"}`);
    for (const a of e.advisories)
      lines.push(`      ${a.id}${a.severity ? ` (${a.severity})` : ""}${a.summary ? `: ${a.summary}` : ""}`
        + (!a.fixed ? " (its details could not be read)" : a.fixed.length ? ` — fixed in ${a.fixed.join(", ")}` : " — no fixed version stated"));
  }
  const withAdvisories = entries.filter((e) => e.advisories.length).map((e) => `${e.ecosystem} ${e.name} ${e.version}`);
  const notChecked = entries.filter((e) => !e.checked).map((e) => `${e.ecosystem} ${e.name} ${e.version}: ${e.why}`);
  lines.push("");
  lines.push(withAdvisories.length
    ? `this release would ship ${withAdvisories.length} package(s) with a known advisory: ${withAdvisories.join("; ")}`
    : "this release would ship no package with a known advisory among those checked");
  for (const u of inv.unread) lines.push(`NOT CHECKED — a source could not be read: ${u}`);
  for (const n of notChecked) lines.push(`NOT CHECKED — ${n}`);
  lines.push(`database: OSV (${OSV}), asked ${askedAt}`);
  const ok = !inv.unread.length && !notChecked.length;
  lines.push(ok ? "every entry was checked. Whether the release proceeds over an advisory is the operator's."
    : "NOT EVERY ENTRY WAS CHECKED: what is named above is not known to be free of advisories.");
  const report = { database: "OSV", url: OSV, askedAt, entries, withAdvisories, notChecked, unread: inv.unread };
  return { report, text: lines.join("\n") + "\n", exit: ok ? 0 : 1 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--out");
  const out = i === -1 ? null : argv[i + 1];
  if (i !== -1 && !out) { console.error("usage: node bio-plane/scripts/release-advisories.mjs [--out <file.json>]"); process.exit(2); }
  const { report, text, exit } = await run();
  process.stdout.write(text);
  if (out) { writeFileSync(out, JSON.stringify(report, null, 2) + "\n"); console.log(`report written to ${out}`); }
  process.exit(exit);
}
