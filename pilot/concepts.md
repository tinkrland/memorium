# pilot concepts

expanding the architectural scope to include perspectives where opposing viewpoints are both right, ted nelson's concept of intertwingularity, spatial-cognitive memory UI, and in-graph filtering transforms this context engine from a backend database concept into an entirely intuitive digital environment.

---

## 1. perspectives where "both are right" (non-binary truth)

**the concept:** traditional databases operate on binary state logic (true/false, match/no match). human knowledge and persona viewpoints don't work that way. "employee you" views a codebase through the lens of maintainability, shipping speed, and corporate debt. "hobbyist you" views that exact same codebase through the lens of aesthetic joy, hackability, and chaos. both perspectives are completely right within their own sandboxes.

**the mechanic:** memory nodes and associations don't have a single universal ground truth. instead, weight, relevance, and even typed edges (`contrasts_with`, `supports`) can be perspective-relative. a code pattern can have a positive weight and an `essential_for` edge in the work sandbox, but a negative weight or a `slows_down_experimentation` edge in the hobbyist sandbox — without either perspective being "incorrect."

**why it matters:** this decouples *truth* from *relevance*. the system never has to arbitrate which perspective wins; it maintains both models simultaneously and lets the active persona decide which lens is loaded. factual accuracy is stored in absolute terms (see the [accuracy pillar](../research/agenda/pillars.md)); perspective-weighting is layered on top without mutating the underlying facts.

## 2. intertwingularity as a core architecture

**the concept:** coined by ted nelson, intertwingularity is the realization that everything is deeply intermingled — and that rigid, artificial hierarchies (folder trees, linear text files, inherited from the printing press) fight against how human memory actually functions.

**the mechanic:** memorium rejects the folder-and-file metaphor. information doesn't live in one place. through multi-hop associative chains and typed edges, a single memory node can exist simultaneously as:

- a foundational root of an identity ("i am a developer" → this pattern is part of who i am)
- a branch of an active project (the same pattern is a node in the current sprint's dependency tree)
- an association to an unrelated creative spark (the pattern `reminds_me_of` a song structure, via a dotted cross-domain bridge)

fully honoring the non-linear, web-like nature of human thought. no node is "filed" anywhere — it's held in tension by its connections, and the force-directed spatial UI (see [../research/ux.md](../research/ux.md)) renders that tension as visible geography.

---

together with the spatial-cognitive visual grammar and in-graph filtering (researched in [../research/ux.md](../research/ux.md)), these concepts are what make pilot feel like navigating an externalized mind rather than querying a database.
