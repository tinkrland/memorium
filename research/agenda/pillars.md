# pillars: the seven that define memorium

refining the core architecture down to these seven pillars shifts memorium away from generic vector search and locks it into a precise context engine. here is how these pillars define the system mechanics:

1. **knowledge** — the foundational repository of multimodal nodes. not flat text chunks, but structured inputs (code, pdfs, notes, media) tethered to source provenance and content metadata.

2. **weightage** — the dual-axis baseline. identity core weights (0 to 1) that do not decay, establishing permanent foundational traits ("i am a developer") versus transient data.

3. **nesting** — parent-child memory hierarchies (`parent_id`) allowing recursive structuring of concepts, where sub-nodes inherit or override contextual properties from higher-level nodes.

4. **associativity** — multi-hop, typed graph connections (`caused_by`, `reminds_me_of`, `contrasts_with`) that bridge disparate domains via explicit relationship semantics rather than blind vector distance.

5. **priority** — behavioral drivers governed by exponential hierarchy decay. the active deadlines and current tasks that dominate attention without corrupting core identity.

6. **contextual relevance wrt perspective** — sandbox-scoped weighting where information is filtered, weighed, and permitted based on the active persona (e.g., employee vs. hobbyist), ensuring zero unapproved bleed.

7. **accuracy (the absolute-vs-irrelevant paradox)** — measuring the precise ground-truth probability of a memory: "how structurally true is this piece of data in absolute terms, even if it happens to be completely irrelevant to the current query or persona?" keeping absolute truth decoupled from current situational relevance prevents the system from mutating facts just because they aren't currently active.

---

these seven map directly onto the research agenda in [readme.md](./readme.md) — one investigative axis per pillar. the weighting mechanics behind pillars 2, 5, and 6 are scoped in detail in [../weighting-mechanics/readme.md](../weighting-mechanics/readme.md); the confidence tiers and boundary behaviors that pillar 7 implies are scoped in [../tag-wrangling/readme.md](../tag-wrangling/readme.md).
