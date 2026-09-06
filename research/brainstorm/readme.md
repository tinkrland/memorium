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

## why this matters now, specifically

memorium already has machinery that *partially* guards against exactly what these notes warn about — underconfident retrieval, weighted-not-binary confidence, decay, sandbox logging. the notes are useful precisely because they show **where the guardrails stop**:

- tag wrangling has a documented merge mechanic (winner/loser, aliases preserved) but no documented *unmerge / audit-the-canonical-judgment* path — see "survivable wrongness" in the aphorism doc.
- the confidence formula demotes semantic similarity and promotes tag match strength — good — but nothing in the formula currently distinguishes "retrievable" from "true." that's exactly "access becomes confidence" in the retrieval doc.
- `research/ux.md` is about to make design decisions for `/memorium/canvas` — the diagram-as-constraint point ("diagram = constraint of what thought becomes visible") should land *before* that visual grammar is locked in, not after.
- this is the same shape of finding the sibling substrate/canvas work already hit empirically: canonicalizing a messy corpus into clean domains made the resulting graph *look* more structured than the underlying reality actually is. same failure mode, independently rediscovered from a notebook instead of from data. that's a decent signal it's real and not a one-off.

## proposed next steps (not yet actioned — for review before merge)

1. add a **provenance depth** field alongside `confidence` on `memory_nodes` / retrieval logs — not "how confident," but "how many condensation/retrieval hops removed from the original source." lets "weakened provenance" be measured instead of just felt.
2. write an explicit repair path for tag merges (a `merge_log` with a revert/reweight operation), so a canonical judgment made in error doesn't propagate silently — this operationalizes "survivable wrongness" as a real property instead of an aspiration.
3. before `research/ux.md`'s visual vocabulary is finalized, add a line item there for "what relationship types are *not* representable in this diagram grammar" — make the diagram's blind spots a documented artifact, not a discovered-later surprise.
4. consider a periodic "coherence audit": deliberately sample low-weight / low-confidence / rarely-recalled nodes and check whether the graph's clean structure is smoothing over real ambiguity in the source data. this is the practical form of "a graph becomes more coherent than the world it represents."

## cross-references

- [`memorium.md`](../../memorium.md) — underconfident retrieval, tag wrangling, five layers
- [`research/agenda/pillars.md`](../agenda/pillars.md) — pillar 7 (accuracy) is the closest existing pillar to what "coherence ≠ contact" is pointing at; worth revisiting that pillar's definition once this branch is reviewed
- [`research/the-sandbox-problem/readme.md`](../the-sandbox-problem/readme.md) — "a shared node that forgets where it came from is a node nobody is accountable for" is the cross-sandbox instance of the same weakened-provenance problem named here in the single-sandbox case
- [`research/ux.md`](../ux.md) — where "diagram = constraint of what thought becomes visible" has a direct, near-term design consequence
