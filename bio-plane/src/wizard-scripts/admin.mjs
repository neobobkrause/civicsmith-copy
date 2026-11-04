/* wizard-scripts R51 (K5046 (c); P1): the administrator's acts and screens, the data R40 withholds the group-setup scripts by.
   Copied verbatim from `interface-shell` (R12, R47, R50, R101, R107), which keeps its own until its job deletes them and imports
   these (K624). The plane's registration hands both at start (`store-assembly` R18); this module imports nothing of `interface-shell`. */

/* R12 on `ADMIN_SCREENS`: `updates`, after Security, is drawn only to a session that administers */
export const ADMIN_SCREENS = Object.freeze(["updates"]);

/* R12: the acts their owners refuse to a member who does not administer: `membership`'s administrator acts (its R84's
   one answer) and `aikeepaway` (`ai-accounts` R51). F1 (T53): `credentials`' group-key acts (`groupkeyset`, `groupkeyremove`,
   `groupkeyswitch`) are retired (`ai-accounts` R35, R36) and their T53 acts are a member's as much as an administrator's, so
   none is here. `scanmirror` and `officeconfirm` stay: their owners declare them (`file-safety` R49, `entities` R64), each an
   administrator's act, and `interface-shell` builds its administrator-only gate from this set. Every name here is an op the
   assembled registration declares (`op-declarations`' `OPS` or an owner's `DECLARED_OPS`, `store-assembly` R83). */
export const ADMIN_ACTS = Object.freeze(new Set([
  "memberadd", "membercaps", "memberset", "adminendorse", "adminremove", "expertiseconfirm", "hostingaccessset", "invitewithdraw",
  "websitekeycreate", "websitekeyset", "websitekeyrevoke", "joinlinkenable", "joinlinkset", "joinlinkreplace", "joinlinkoff",
  "courtnoticeset", "groupdescriptionset", "joindoors", "projectownerrescue",
  "aikeepaway",
  /* R47: `people`' expunging of a person (its R12) */
  "personexpunge",
  /* R50: the reset link, a member's key set by an administrator, the group's settings, its places and offices, its
     translators, its security tools */
  "passwordresetlink", "signerset", "groupnameset", "grouplogoset", "groupdomainset", "grouplanguagesset", "courtnoticeset",
  "hostingaccessset", "profilesset", "placewanted", "officesseed", "translationgrant", "translationrevert",
  "securitytools", "securitytoolcatalogue", "securitytoolevents", "securitytooladd", "securitytooltest", "securitytoolremove",
  /* R101 (T51): a member's signing key added by an administrator (`credentials` R6), and the root of trust's seeding of the
     team (`instance-setup` R4) */
  "signeradd", "instancegroupseed",
  /* F1 (attempt 4): the file scanner's check for new signatures (`file-safety` R49) and an office's confirm (`entities` R64) */
  "scanmirror", "officeconfirm",
]));
