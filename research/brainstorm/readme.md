# brainstorm: reality denial

source: two pages of handwritten notes (notebook, undated brainstorm session — top-right header on page 1 reads "reality denial aphorism"). this branch exists to hold the raw theorizing before any of it earns a place in `research/agenda/`, `concept/`, or the main architecture docs. nothing here is committed to the system yet — it's the scratch layer.

## the throughline

both pages are the same idea hitting two different layers of the stack:

**a lossy, selective representation of a thing is not the thing — and every layer of memorium (tagging, condensation, retrieval, the future canvas diagram) is a place where that gets forgotten.** the notebook literally titles this "reality denial" — the failure mode isn't having an imperfect representation, it's *denying that it's a representation at all* and starting to treat it as ground truth.

this isn't abstract philosophy for its own sake — it's a direct stress-test of memorium's central bet. memorium exists because it claims structured, weighted, tagged, associative memory beats flat embeddings. these notes ask the uncomfortable follow-up: **structured well enough to be useful is not the same as structured well enough to be true.** a system that is very good at being internally coherent can be very good at lying to itself.

## what's in this folder

| doc | covers | the one-line risk it names |
| --- | --- | --- |
| [reality-denial-aphorism.md](./reality-denial-aphorism.md) | page 1 — compression vs condensation, trickle-down semantic drift, survivable wrongness, information vs memory reintegration, distillation | canonicalization (tag wrangling) quietly replaces the thing it summarized, and errors compound downstream instead of staying local |
| [retrieval-as-construction.md](./retrieval-as-construction.md) | page 2 — retrieval as construction, coherence vs contact, diagrams as constraint, four provenance-decay symptoms | the system (and the humans using it) mistake "this looks clean and connects nicely" for "this is accurate," with nothing currently checking the difference |
| [substrate-pillar-mapping.md](./substrate-pillar-mapping.md) | draft — maps the substrate pilot's eight compute objectives onto the seven pillars/agenda axes, including the two findings that already crossed (canonicalization-manufactured coherence, asymmetric category-boundedness) | the pilot is the agenda's running head start — but pillar 6 (sandboxing) stays uncovered, and the mapping should say so |

## why this matters now, specifically

memorium already has machinery that *partially* guards against exactly what these notes warn about — underconfident retrieval, weighted-not-binary confidence, decay, sandbox logging. the notes are useful precisely because they show **where the guardrails stop**:

- tag wrangling has a documented merge mechanic (winner/loser, aliases preserved) but no documented *unmerge / audit-the-canonical-judgment* path — see "survivable wrongness" in the aphorism doc.
- the confidence formula demotes semantic similarity and promotes tag match strength — good — but nothing in the formula currently distinguishes "retrievable" from "true." that's exactly "access becomes confidence" in the retrieval doc.
- `research/ux.md` is about to make design decisions for `/memorium/canvas` — the diagram-as-constraint point ("diagram = constraint of what thought becomes visible") should land *before* that visual grammar is locked in, not after.
- the substrate pilot (memorium's first live pilot — see [../../pilot/readme.md](../../pilot/readme.md)) already hit this failure mode empirically: canonicalizing a messy corpus into clean domains made the resulting graph *look* more structured than the underlying reality actually is. the notebook theorized it, the pilot found it in the data — independently, before either knew of the other. theory and pilot converging on the same failure mode from opposite directions is a strong signal it's real and not a one-off.

## proposed next steps

1. **drafted** → [proposals/provenance-depth.md](./proposals/provenance-depth.md) — `provenance_depth` + `provenance_source_id` on memory_nodes, `aggregate_provenance_depth` on retrieval logs, and the versioned-rewrite rule (memory rewrites are new nodes, never overwrites). weakened provenance becomes measurable instead of felt.
2. **drafted** → [proposals/tag-merge-repair.md](./proposals/tag-merge-repair.md) — `tag_merge_log` with pre/post-merge ref snapshots, `revert_merge` + `reweight_merge` ops, and a signal-driven review queue (retrieval confidence drop, persona-relevance conflict, association orphaning). survivable wrongness for canonicalization, made concrete.
3. **drafted** → [../ux.md](../ux.md) §4 "what this grammar cannot show" — six non-representable relationship types (time/versioning, provenance, edge uncertainty, strength trends, absence, exclusions) with candidate mitigations, plus the standing rule that a new blind spot gets a row and a decision, never a silent flattening.
4. **still open** — periodic "coherence audit": deliberately sample low-weight / low-confidence / rarely-recalled nodes and check whether the graph's clean structure is smoothing over real ambiguity in the source data. needs a sample-selection spec and a human-review protocol; the substrate pilot's validity objective (objective 7) would have been the natural first contact-check here — but substrate is shelved (custody with the co-parent), so this stays a memorium-native design task.

## cross-references

- [`memorium.md`](../../memorium.md) — underconfident retrieval, tag wrangling, five layers
- [`research/agenda/pillars.md`](../agenda/pillars.md) — pillar 7 (accuracy) is the closest existing pillar to what "coherence ≠ contact" is pointing at; worth revisiting that pillar's definition once this branch is reviewed
- [`research/the-sandbox-problem/readme.md`](../the-sandbox-problem/readme.md) — "a shared node that forgets where it came from is a node nobody is accountable for" is the cross-sandbox instance of the same weakened-provenance problem named here in the single-sandbox case
- [`research/ux.md`](../ux.md) — where "diagram = constraint of what thought becomes visible" has a direct, near-term design consequence
