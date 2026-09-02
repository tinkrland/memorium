# agenda: core research axes & investigative questions

establishing a formal research agenda around the seven core pillars (defined in [pillars.md](./pillars.md)) moves memorium from an engineering concept into an empirical study on structured memory systems.

investigating how contextual intelligence behaves when decoupled from flat vector storage requires evaluating specific failure modes and optimization thresholds across seven distinct dimensions:

---

## 1. knowledge: multimodal grounding and metadata fidelity

**research question:** how does decoupling raw data storage (multimodal files, code snippets, pdfs) from vector embeddings and tethering them to immutable structural metadata affect retrieval accuracy in long-context domains?

**investigation focus:** testing whether injecting exact line ranges, file hashes, and content-type metadata into the retrieval pipeline eliminates the citation hallucinations typical of standard chunk-and-embed architectures.

## 2. weightage: non-decaying identity stability

**research question:** what is the mathematical tipping point where persistent identity weights (0 to 1, zero decay) prevent catastrophic forgetting during continuous multi-persona training cycles?

**investigation focus:** measuring model drift over extended agentic interactions to prove that anchoring core traits structurally prevents an agent from losing its baseline persona during high-turn task execution.

## 3. nesting: recursive context inheritance

**research question:** how do parent-child memory hierarchies (`parent_id`) influence token efficiency compared to flat context windows when querying deeply nested, multi-layer project specifications?

**investigation focus:** evaluating whether multi-level tree traversal reduces redundant prompt injection by inheriting parent attributes automatically down sub-nodes.

## 4. associativity: multi-hop graph traversal vs. vector distance

**research question:** at what depth (n-hops) does typed graph associativity (`caused_by`, `reminds_me_of`, `contrasts_with`) introduce semantic noise, and how do explicit edge weights mitigate associative drift?

**investigation focus:** stress-testing multi-hop traversal chains against pure cosine similarity benchmarks to find the optimal balance point where creative cross-domain leaps don't sacrifice factual precision.

## 5. priority: exponential hierarchy decay and attention allocation

**research question:** how does modeling behavioral urgency via exponential hierarchy decay outperform simple token recency (sliding window) in task-switching environments?

**investigation focus:** simulating rapid context shifts (e.g., jumping between multiple active deadlines) to test whether decay-driven priority curves correctly suppress stale tasks without requiring manual context clearing.

## 6. contextual relevance wrt perspective: sandbox isolation & cross-pollination

**research question:** what architectural constraints are required to maintain strict sandbox isolation between disparate perspectives (e.g., employee vs. hobbyist) while safely permitting conditional, opt-in cross-sharing?

**investigation focus:** auditing cross-sandbox access logs under high-load multi-agent scenarios to quantify zero-leakage compliance alongside authorized bridging efficiency.

## 7. accuracy: the absolute-vs-irrelevant paradox

**research question:** how can a retrieval engine maintain high absolute ground-truth validity for a memory node even when its real-time contextual relevance score for the active persona approaches zero?

**investigation focus:** testing whether decoupling absolute factual accuracy from situational relevance prevents the model from mutating or degrading stored historical facts just because they are temporarily out of scope.

---

## methodology notes

- each axis needs a falsifiable benchmark against a flat-vector baseline (the "generic rag" control group)
- experiments 2, 5, and 6 share infrastructure with the weighting-mechanics experiment matrix in [../weighting-mechanics/readme.md](../weighting-mechanics/readme.md)
- experiment 4 is the highest-risk axis — it's the one where memorium most plausibly *loses* to naive vector search, and needs honest measurement
- results should be logged for the adaptionlabs experimental record; tooling chain is mapped in [../readme.md](../readme.md)
