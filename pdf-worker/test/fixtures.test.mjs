/* The fixtures pdf-worker publishes (`fixtures.mjs`): each is called here and its answer checked against the real
 * module's own reading of the same bytes, so a user that takes it holds the answer the member gives and not a copy. */
import "../../bio-plane/test/sandbox.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openPdfRange } from "../../bio-plane/src/pdfstructure.mjs";
import { runner } from "./make-pdf.mjs";
import { tier2Answer } from "./fixtures.mjs";

const { t, finish } = runner("fixtures");

const answer = await tier2Answer();
const MIXED = new Uint8Array(readFileSync(fileURLToPath(new URL("../../bio-plane/test/fixtures/cpdf20/legistar-73545.pdf", import.meta.url))));
const opened = await openPdfRange(MIXED);
const openedPages = opened.ok ? opened.pages : undefined;
t("R7 tier2Answer is the member's answer: ok, tier 2, from pdf-reader's page count", [answer.ok, answer.tier, answer.pages, openedPages], [true, 2, 7, 7]);
t("R9 tier2Answer carries one entry per page, in order", answer.text.pages.map((p) => p.page), [0, 1, 2, 3, 4, 5, 6]);
t("R9 tier2Answer's page 0 has the words tier 1 cannot decode", (answer.text.pages[0]?.text.length ?? 0) > 1000, true);
t("R9 tier2Answer's document joins the non-empty pages with a newline", answer.text.document, answer.text.pages.map((p) => p.text).filter((x) => x.length).join("\n"));
t("R9 tier2Answer's counts", answer.text.counts, { chars: answer.text.document.length, undetermined: answer.text.undetermined.length });
t("R7 tier2Answer is not stated partial", [answer.partial, answer.notes], [undefined, []]);
finish();
