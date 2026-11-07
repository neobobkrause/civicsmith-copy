/* The screens the door's page is built from (R81: the nine screen modules, in the door's order) and screens-wizards' guide: what the
   end-to-end suites hand the shell harness, so the script it runs is `interfaceScript` over the same screens and guide as the
   script the plane serves at the release's address (R75; interface-shell R1). */
import { SCREENS as ENTRY } from "../../../src/screens-entry/index.mjs";
import { SCREENS as SETTINGS } from "../../../src/screens-settings/index.mjs";
import { SCREENS as INTAKE } from "../../../src/screens-intake/index.mjs";
import { SCREENS as DAILY } from "../../../src/screens-daily/index.mjs";
import { SCREENS as INQUIRY } from "../../../src/screens-inquiry/index.mjs";
import { SCREENS as WIZARDS, GUIDE } from "../../../src/screens-wizards/index.mjs";
import { SCREENS as INVESTIGATE } from "../../../src/screens-investigate/index.mjs";
import { SCREENS as PUBLISH } from "../../../src/screens-publish/index.mjs";
import { SCREENS as ACTION } from "../../../src/screens-action/index.mjs";
/* (BOB's found mark, 7 Nov; screens-ai PR 881) the door serves screens-ai's screens after the nine */
import { SCREENS as AI } from "../../../src/screens-ai/index.mjs";

export const APP_SCREENS = Object.freeze([...ENTRY, ...SETTINGS, ...INTAKE, ...DAILY, ...INQUIRY, ...WIZARDS, ...INVESTIGATE, ...PUBLISH, ...ACTION, ...AI]);
export { GUIDE };
