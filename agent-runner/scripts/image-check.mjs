// R56: what an image's file listing and Dockerfile must not hold: no Claude Code or Agent SDK, no shell or other
// interpreter but the one Node runtime, no pseudo-terminal helper, no fetcher; a digest-pinned base; an exec-form entry;
// no RUN after the final COPY. Answers the faults, each naming what fails; [] when none.
const FORBIDDEN = /(^|\/)(sh|bash|dash|ash|zsh|busybox|script|curl|wget|python[0-9.]*|perl|claude)$/;
const FORBIDDEN_PKG = /(^|\/)(@anthropic-ai\/claude-agent-sdk|@anthropic-ai\/claude-code)(\/|$)/;

export function imageFaults({ listing, dockerfile }) {
  const faults = [];
  for (const raw of listing) {
    if (raw.endsWith('/')) continue;  // a directory: what it holds is listed line by line
    const p = raw.replace(/^\.?\//, '');
    if (FORBIDDEN.test(p)) faults.push(`${p}: a shell, interpreter, helper or fetcher`);
    if (FORBIDDEN_PKG.test(p)) faults.push(`${p}: Claude Code or its SDK`);
  }
  const lines = dockerfile.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const from = lines.filter((l) => /^FROM\s/i.test(l));
  if (!from.length || !from.every((l) => /@sha256:[0-9a-f]{64}(\s|$)/.test(l))) faults.push('a base not pinned by digest');
  const lastCopy = lines.map((l, i) => (/^(COPY|ADD)\s/i.test(l) ? i : -1)).filter((i) => i >= 0).at(-1) ?? -1;
  if (lines.slice(lastCopy + 1).some((l) => /^RUN\s/i.test(l))) faults.push('a RUN after the final copy');
  const entry = lines.filter((l) => /^(CMD|ENTRYPOINT)\s/i.test(l));
  if (!entry.length || !entry.every((l) => /^(CMD|ENTRYPOINT)\s+\[/.test(l))) faults.push('an entry not in exec form');
  return faults;
}
