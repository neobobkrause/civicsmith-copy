/* screens-investigate R18, R27: the shared keys the connection graph (`PARTS.graph`) reads, listed by each screen that draws
 * it (its four own sentences are `<screen prefix>g.<part>`, listed with that screen's keys). */
export const GRAPH_SHARED = Object.freeze([
  ...["pos", "part", "money", "ment", "same", "step_source", "lead"].flatMap((k) => ["connection.kind." + k + ".name", "connection.kind." + k + ".means"]),
  "connection.graph.limit", "connection.graph.limit.means", "connection.graph.trail.means", "connection.graph.grade.means", "connection.graph.center.means",
  "connection.graph.click", "connection.graph.trail.label", "connection.graph.legend.grade",
  "connection.thing.person", "connection.thing.office", "connection.thing.org", "connection.thing.fund", "connection.thing.doc", "connection.thing.pay", "connection.thing.gap",
  "connection.thing.entity", "connection.node.unnamed", "connection.node.unnamed.tip", "screen.explore.attached", "screen.explore.unnamed.why", "screen.explore.testimony",
]);

/** R34: the keys `PARTS.docChoice` draws, listed by each screen that offers a document choice. */
export const FORM_SHARED = Object.freeze(["form.choose.search", "form.choose.search.none", "retrieval.notread.not_extracted", "form.choose.document", "form.choose.document.help", "form.choose.passage", "screen.held.untitled"]);
