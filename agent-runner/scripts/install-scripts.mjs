// R16 (F20, AIR15): the image runs no package's install or lifecycle script at build. Its dependencies come from
// package-lock.json by `npm ci --omit=dev --ignore-scripts` (an image with none installs nothing), and the lock holds no package marked hasInstallScript
// unless a reviewed change BOB rules on names it in `admitted`. Answers the faults, each naming what fails; [] when none.
const INSTALL = /\bnpm\s+(ci|install|i|add|rebuild)\b/;
const LIFECYCLE = ['preinstall', 'install', 'postinstall', 'prepare', 'preprepare', 'postprepare'];

export function installScriptFaults({ dockerfile, lock, pkg, admitted = [] }) {
  const faults = [];
  const commands = dockerfile.split('\n').filter((l) => !/^\s*#/.test(l))
    .flatMap((l) => l.split(/&&|;|\|\|/)).map((c) => c.trim()).filter((c) => INSTALL.test(c));
  const deps = Object.keys((pkg && pkg.dependencies) || {});
  if (commands.length === 0 && deps.length) faults.push('the Dockerfile installs no dependencies');
  for (const c of commands) {
    if (!/^(RUN\s+)?npm\s+ci\b/.test(c)) faults.push(`${c}: not npm ci from package-lock.json`);
    if (!/(^|\s)--ignore-scripts(\s|$)/.test(c)) faults.push(`${c}: no --ignore-scripts`);
    if (!/(^|\s)--omit=dev(\s|$)/.test(c)) faults.push(`${c}: no --omit=dev`);
  }
  for (const [key, p] of Object.entries((lock && lock.packages) || {})) {
    const name = key.replace(/^.*node_modules\//, '');
    if (p.hasInstallScript && !admitted.includes(name)) faults.push(`${name}: has an install script`);
  }
  for (const s of LIFECYCLE) if (pkg && pkg.scripts && s in pkg.scripts) faults.push(`package.json declares ${s}`);
  return faults;
}
