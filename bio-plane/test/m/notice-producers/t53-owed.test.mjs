/* R33–R36 (T53; K5571 (2), K5527 (2)): owed, each waiting on another module (reported to BOB). Queue's catalogue (queuestate.mjs)
   names no kind for any of them, and an item of a kind it does not name refuses the member's whole Queue (`NO_SUCH_KIND`, queue R11;
   queue's catalogue test holds every kind of NOTICE_KINDS named); R36 also needs the `modules.json` edge to `mail-door` its Uses
   name. Until then no item of theirs is minted. */
import { test } from "node:test";

test.todo("R33 a crossed threshold is one alert, ai-use.thresholdsReached's key as given, ai.alert.threshold's words: waits on queue's catalogue naming its kind");
test.todo("R34 a dated terms change is a notice, never a step, ai-accounts.termsNoticesDue's key as given, ai.notice.termschange's words: waits on queue's catalogue naming its kind");
test.todo("R35 an AI account that left a list, or a project sign-in account that ended, told to the owners it concerns (ai-accounts.accountNoticesFor; ai.queue.leftlist.own|project, ai.queue.leftprojectlist, ai.queue.signinended): waits on queue's catalogue naming their kinds");
test.todo("R36 a member told once, privately, when her unconfirmed mail was removed (mail-door.clearedOwners): waits on queue's catalogue naming mail-cleared and on the modules.json edge to mail-door");
