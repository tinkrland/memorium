# proposal: provenance depth

draft from [../readme.md](../readme.md) proposed next step 1. makes "weakened provenance" (the fourth symptom in [../retrieval-as-construction.md](../retrieval-as-construction.md)) measurable instead of felt.

## the field

`memory_nodes` gains two fields:

- **`provenance_depth`** (integer, default 0) — how many condensation/reconstruction hops this node is removed from its original source.
  - `0` = ingested directly from the real world: a meeting transcript, an uploaded pdf, a user statement. the node *is* its own source.
  - `1` = derived from depth-0 material by the system: a summary of a transcript, a distilled fact extracted from a document.
  - `2+` = derived from derivations: a persona-level generalization built from summaries, a reconsolidated node rewritten at recall time.
- **`provenance_source_id`** (nullable FK → memory_nodes.id) — the node this one was derived from. null for depth 0. with this, depth is also *auditable*: walk the chain, inspect every hop.

depth is computed at write time, mechanically: **a node created from other memory nodes gets `max(source depths) + 1`. a node created from anything else gets 0.** no judgment calls in the number itself — the judgment lives in *what created the node*, which the existing `source` field already records.

## what does *not* bump depth

deliberate, to keep the number honest:

- **tag wrangling doesn't bump it.** alias resolution preserves the original tag and the original content; nothing about the node changed. (the wrangling *judgment* has its own repair path — [tag-merge-repair.md](./tag-merge-repair.md) — don't double-track it here.)
- **retrieval reads don't bump it.** reading a node is free.
- **weight/hierarchy/decay updates don't bump it.** numeric maintenance, not reconstruction.

## what does bump depth (the interesting list)

- summarization / condensation of a source into a new node → depth 1
- `derived_from` / `caused_by`-style inference nodes created by the system → depth = source + 1
- **reconsolidation writes**: if a node's *content* is rewritten because it was recalled and "reinterpreted" (the reconstruction-through-retrieval symptom), the rewrite is a new version node at depth + 1, not an in-place edit of the old one. the old content stays queryable. this is the load-bearing rule: **memory rewrites are versioned, never overwritten.**
- canvas/diagram exports become nodes? if ever — depth + 1. a picture of thought is not the thought.

## retrieval integration

`memory_retrieval_confidence` gains one field:

- **`aggregate_provenance_depth`** — max depth across the retrieved set, logged per query.

and one display rule, layered on the existing confidence tiers rather than replacing them:

- retrieved set contains any node at depth ≥ 2 → the response carries a standing caveat ("reconstructed from reconstructions — treat as interpretation, not record"), *even if* the confidence score is in the confident tier. confidence and provenance are different axes: a summary can be perfectly retrievable and confidently-scored while being two drift-hops from what was actually said.

the confidence *formula* itself stays untouched for now — source confidence (15%) partially covers this, and stacking a provenance penalty on top risks double-counting. this proposal only adds visibility and a caveat trigger. whether provenance should eventually modulate the score is an open question for the agenda's axis 7 once there's data on how depth correlates with actual errors.

## migration

existing nodes: default 0, but flag `provenance_depth` as unverified in a one-time audit pass rather than trusting it — any node whose `source` indicates system generation (vs. external ingest) should be bumped to 1 by the audit, not by the default. the audit is cheap (one query on `source`) and prevents a silent fleet of mislabeled depth-0 nodes, which would be worse than no field at all.
