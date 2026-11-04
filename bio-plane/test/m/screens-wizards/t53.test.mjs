/* T53 (JOURNEYS R-36): R23, each wizard filter explains itself. Not yet met: its words are owed (no key in the word table holds a
   filter's own explanation or its own empty line; `screen.wizards.empty` is the library's one line for every state). An id not yet
   met is named in a `test.todo` (K208), never a red test. */
import test from "node:test";

test.todo("R23 each filter's tip is distinct and names its own state; an empty Withdrawn list does not say it is listed to administrators for a member; control: the library tip stays on the library (words owed)");
