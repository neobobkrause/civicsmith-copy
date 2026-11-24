/* Project names (Membership v2 §7.1; R19, R38, R43): the one comparison key the write path's NAME_TAKEN refusal uses,
 * and C-77, the same rule judged over a handed corpus. Moved here whole from the catalogue in T18 (K586 BOB-4, K636):
 * the door and the corpus check are one function in one module. The notes below are the catalogue's, kept. */

import { parseFrontmatter, normalizeType } from "../record-grammar/index.mjs";
import { localize } from "../setup-words/index.mjs";

/* The catalogue's finding shape, `{check, severity, message, repairable?, repairs?}`. */
const f = (check, severity, message, repairs) => ({ check, severity, message, ...(repairs ? { repairable: true, repairs } : {}) });
const asText = (v) => (typeof v === "string" ? v : new TextDecoder().decode(v));

// ---------------------------------------------------------------------------
// C-77 — project name uniqueness over a HANDED CORPUS (D-50)
// ---------------------------------------------------------------------------

/**
 * THE comparison key for project name uniqueness (Membership v2 §7.1): the
 * `title`, trimmed, lower-cased, runs of whitespace collapsed to one space.
 *
 * ONE FUNCTION: `promote`'s and `forkProject`'s NAME_TAKEN refusal and
 * `checkProjectNameUniqueness` below call this same object, so they cannot
 * disagree about what a collision is (R38). A second normaliser that agrees on
 * a fixture is the way this rule is broken without any suite noticing.
 *
 * @param {unknown} title
 * @returns {string}
 */
export function projectNameKey(title) {
  return String(title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Membership v2 §11 item 8: project name uniqueness enforced IN THE CHECK
 * CATALOG as well as at the write path. The write path refuses a colliding
 * write (`promote` and `forkProject`, NAME_TAKEN); nothing could
 * judge a corpus handed in from elsewhere — an export, a migration, another
 * group's instance, §11 item 9's pre-enforcement recheck — until this.
 *
 * A CORPUS-level check, deliberately outside `checkBundle`: uniqueness is a
 * fact about a SET of bundles and no single bundle can carry it.
 *
 * The rule is §7.1's three consequences, in full:
 *   - compared by `projectNameKey` (case-insensitive, whitespace collapsed);
 *   - across EVERY lifecycle state: a deactivated (`closed`) project is still
 *     cited and its name must still resolve to what was cited, so there is NO
 *     state filter here and there must never be one;
 *   - about the project OBJECT: only bundles whose `object_type` is `project`.
 *
 * C-77.1 (error) names EVERY colliding PAIR, by bundle id and title — three
 * projects on one key are three pairs, because each pair is a separate thing
 * somebody has to resolve.
 *
 * C-77.2 (warning) names every bundle this check could NOT judge, which is
 * first-class rather than silence: a bundle with no readable `bundle.md` (it
 * may or may not be a project) and a project with no title (its key is empty,
 * so it can collide with nothing; the write path refuses it NO_TITLE). A clean
 * result over a corpus with C-77.2 findings is a clean result over the part
 * that could be read, and the finding says which part could not.
 *
 * @param {Iterable<{folderName?: string, files: Map<string, string|Uint8Array>}>} corpus
 *   the catalog's own BundleInput shape, one per bundle
 * @returns {{pass: boolean, findings: Finding[], projects: number, judged: number}}
 */
export function checkProjectNameUniqueness(corpus) {
  /** @type {Finding[]} */
  const findings = [];
  const keyed = [];
  let projects = 0;
  for (const input of corpus || []) {
    const raw = input && input.files && input.files.get ? input.files.get('bundle.md') : undefined;
    const fm = raw == null ? null : parseFrontmatter(asText(raw)).data;
    const label = (fm && typeof fm.id === 'string' && fm.id) || (input && input.folderName) || '(unnamed record)';
    if (!fm) {
      findings.push(f('C-77.2', 'warning',
        `${label}: bundle.md is ${raw == null ? 'absent' : 'unreadable'}, so whether it is a project, and whether its name collides, is UNDETERMINED`,
        ['hand the corpus with this record\'s bundle.md readable and run the check again']));
      continue;
    }
    if (normalizeType(fm.object_type) !== 'project') continue;
    projects++;
    const key = projectNameKey(fm.title);
    if (!key) {
      findings.push(f('C-77.2', 'warning',
        `${label}: a project with no title cannot be compared for name uniqueness (the write path refuses it NO_TITLE)`,
        [localize("promotion.names.give_project_title_unique", "give the project a title unique across your team's Civicsmith")]));
      continue;
    }
    keyed.push({ id: label, title: String(fm.title), state: fm.current_state, key });
  }
  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      const a = keyed[i], b = keyed[j];
      if (a.key !== b.key) continue;
      const st = (p) => (p.state === undefined ? '' : ` [${p.state}]`);
      findings.push(f('C-77.1', 'error',
        `project names collide: ${a.id} "${a.title}"${st(a)} and ${b.id} "${b.title}"${st(b)} are the same name `
          + 'compared case-insensitively with whitespace collapsed (Membership v2 §7.1), which holds across '
          + 'deactivated projects too',
        ['rename one of the two projects so each name identifies one project',
         'if one is deactivated, rename the live one: the deactivated project is still cited by its name']));
    }
  }
  return { pass: !findings.some((x) => x.severity === 'error'), findings, projects, judged: keyed.length };
}
