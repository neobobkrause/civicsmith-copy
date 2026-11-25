/* What instance-setup shares with the installer (N234, installer R30; K405): the slug grammar and the fleet's binding
   names, and R47's words on who controls the team's Civicsmith (installer R34), in a leaf whose only import is
   `setup-words` (R98), so the installer's neutral bundle can carry it without the plane's store or any `cloudflare:*`
   module. `setup.mjs` re-exports the names the screens read; this file is the one definition of each. */
import { word } from "./setup-words/index.mjs";

/* The producing group's slug grammar ("Terms"; R2, R4): 3 to 40 of a-z, 0-9 and '-', beginning and ending with a
   letter or digit. */
export const GROUP_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/* The fleet's members and the binding names the plane reads each by (R17), as `[member, binding]` pairs. T33 adds the
   recompute member (`sheet-worker`, K1531) and the assistant's container member (`agent-runner`, K1601), each read for
   its own build through the binding named here like every other member. T36 adds the virus scanner (`file-scanner`,
   K2152), which the installer installs with this binding (installer R44). */
export const FLEET_BINDINGS = [["agent-worker", "AGENT_WORKER"], ["pdf-worker", "PDF_WORKER"], ["ocr-worker", "OCR_WORKER"],
  ["sheet-worker", "SHEET_WORKER"], ["agent-runner", "AGENT_RUNNER"], ["file-scanner", "FILE_SCANNER"]];

/* R47, R97, R98 (DEC-109; H17; K1038; K405): WHO REALLY CONTROLS YOUR TEAM'S CIVICSMITH, told to the founder before they
   choose a password, in the design's words. Each text is `word(key)` of the word-list row `keys` names beside it (`heading`,
   `sentences` in order, `guide`'s `sentence` and `name`), so the leaf holds no sentence of its own (R98); the plane's
   screens and the installer's last screen (installer R34) read the same rows. Nothing asks for or records an
   acknowledgement of the block. `guide` (T35;
   F10, K1874) is the block's last sentence, naming the guide to replacing the one-time password and where it is found,
   the same words for the setup screen and the installer.
   `hostingControlBlock(cls, {guideHref})` is the block as HTML, every word escaped, in an element whose class is the
   caller's own; with `guideHref` (a screen's address of the guide) the guide's name is a link to it, and without (the
   installer's) it is text; with `deployer: true` (the installer's last screen, K3240) the deployer's steps follow. */
export const HOSTING_CONTROL = Object.freeze({
  heading: word("screen.hosting.heading"),
  sentences: Object.freeze([
    word("screen.hosting.s1"),
    word("screen.hosting.s2"),
    word("screen.hosting.s3"),
    word("screen.hosting.s4"),
    word("screen.hosting.s5"),
  ]),
  guide: Object.freeze({
    sentence: word("screen.hosting.guide"),
    name: word("setup-fleet.name.replace_time_password"),
  }),
  keys: Object.freeze({
    heading: "screen.hosting.heading",
    sentences: Object.freeze(["screen.hosting.s1", "screen.hosting.s2", "screen.hosting.s3", "screen.hosting.s4", "screen.hosting.s5"]),
    guide: Object.freeze({ sentence: "screen.hosting.guide", name: "setup-fleet.name.replace_time_password" }),
  }),
});
/* R47, R97, R98 (T48; K3240): the deployer's steps for that way back in, in the developer's own words, kept apart from the
   block so no member reads them: they belong to the installer's last screen and DEPLOY.md, whose texts add them after the
   block. The block itself says it in a founder's words (its last sentence above). Its text is `word("setup-fleet.hosting_recovery_deployer")`. */
export const HOSTING_RECOVERY_DEPLOYER_KEY = "setup-fleet.hosting_recovery_deployer";
export const HOSTING_RECOVERY_DEPLOYER = word("setup-fleet.hosting_recovery_deployer");

/* R47, R97, R98 (T48; K3240): what a member who cannot sign in is told on `forgot`, in members' words (DEC-149): who can help,
   and no more. Each text is `word(key)` of the row `keys` names beside it, as HOSTING_CONTROL's are. The founder-only
   block above ("who controls your team's Civicsmith") is for the founder's path and is not drawn here. */
export const FORGOT_HELP = Object.freeze({
  heading: word("screen.forgot.help.heading"),
  sentences: Object.freeze([word("screen.forgot.help.s1"), word("screen.forgot.help.s2")]),
  keys: Object.freeze({ heading: "screen.forgot.help.heading", sentences: Object.freeze(["screen.forgot.help.s1", "screen.forgot.help.s2"]) }),
});

const escBlock = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function hostingControlBlock(cls = "notice", { guideHref = null, deployer = false } = {}) {
  const { sentence, name } = HOSTING_CONTROL.guide;
  const guide = typeof guideHref === "string" && guideHref
    ? sentence.split(name).map(escBlock).join(`<a href="${escBlock(guideHref)}">${escBlock(name)}</a>`)
    : escBlock(sentence);
  return `<div class="${escBlock(cls)}" id="hosting-control"><p><b>${escBlock(HOSTING_CONTROL.heading)}</b></p>`
    + HOSTING_CONTROL.sentences.map((s) => `<p>${escBlock(s)}</p>`).join("")
    + (deployer === true ? `<p>${escBlock(HOSTING_RECOVERY_DEPLOYER)}</p>` : "")
    + `<p style="margin:0">${guide}</p></div>`;
}
