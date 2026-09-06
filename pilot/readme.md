# pilot

pilot is a deployment of memorium **outside of prixie** — a standalone use of the persona memory system where memorium is the product, not a subsystem.

prixie embeds memorium as its persona/context layer: the meeting proxy needs sandboxed perspectives and weighted memory to know which "you" is attending. pilot inverts the relationship: memorium runs as its own application (personal knowledge base, externalized spatial mind-space), and prixie becomes just one of the many possible consumers of the memory engine — listed under [../applications/prixie](../applications/prixie) in the standalone repo.

where prixie asks "which perspective is in this meeting?", pilot asks "what does your entire mind look like, and how do you want to navigate it?"

see [concepts.md](./concepts.md) for the architectural concepts guiding pilot — non-binary perspectives and intertwingularity.

## the live pilot: substrate

pilot is no longer only a concept — **[tinkrland/substrate](https://github.com/tinkrland/substrate) (canvas branch) is memorium's first live pilot project.** the intertwingularity benchmark there is the empirical arm of exactly the architecture described above: a subject graph with typed similarity axes, weave edges, cross-field connections, strength calibration, and reinforcement-decay dynamics — pillar 3 (nesting), pillar 4 (associativity), and pillar 7 (accuracy) tested against a real corpus instead of on paper.

its findings feed directly back into memorium research. the sharpest one so far: canonicalizing a messy corpus into clean domains made the resulting graph *look* more structured than the underlying reality actually is — metrics improved partly because cleanup itself manufactured apparent connectedness. that's "coherence ≠ contact" (see [../research/brainstorm/retrieval-as-construction.md](../research/brainstorm/retrieval-as-construction.md)) found empirically, in the pilot, before the theory had a name for it. pilot theory and pilot practice just converged on the same failure mode from opposite directions — which is about as strong a signal as either one gets.

current state (canvas branch): field registry canonicalization v1.1, refinement v1 (standing gates clean), grid distortion + thread score computed, metrics v4 on the clean graph. remaining compute objectives: dynamics, node index, validity, mapping.
