# tag wrangling — dataset scoping

scope: define the training data components for teaching a model to operate the tag wrangler (ao3-style canonical tags, aliases, fuzzy matching, hierarchy, associations, persona relevance). not the research itself — the topics and dataset shapes to build.

feeds: adaptionlabs dataset.

---

## 1. alias mapping pairs

**what it is:** training examples where messy, inconsistent human inputs ("dev", "coding", "software") are paired with their resolved canonical tag ("programming") and a confidence score.

**why it matters:** the model must learn to clean up raw tags without losing the original phrasing. the alias is preserved as provenance — the canonical tag is the resolution, not a replacement.

**dataset shape:**
```
input:  raw human input ("dev", "coding", "software", "sw eng")
output: canonical tag ("programming"), alias preserved, resolution confidence
```

**topics to research:**
- how ao3 wranglers handle ambiguous aliases (an alias that maps to two canonical tags depending on context)
- canonical tag ontology design — flat vs. hierarchical, how deep before it's unusable
- alias conflict resolution: when "apple" means the company vs. the fruit vs. the record label
- confidence calibration for fuzzy matches — what score does "sw eng" → "software engineering" get vs. "programming"?
- preserving original phrasing: alias provenance as first-class data, not a cleanup side effect

**key question:** can the model learn resolution *rules* from examples, or only resolution *instances*? if the latter, the wrangler stays rule-based and the model only handles the ambiguous tail.

---

## 2. perspective switching scenarios

**what it is:** multi-turn dialogue or prompt sequences where the active persona shifts (e.g., from student to founder). the same underlying query pulls entirely different memory weights, permissions, and context depending on who is currently "logged in."

**why it matters:** memorium's core identity is the shared-laptop model — one you, many perspectives. the model must internalize that perspective is a retrieval parameter, not a personality skin.

**dataset shape:**
```
input:  [persona: student] query: "what should i work on?"
        → retrieves: class deadlines (high), hackathon project (medium), work tasks (blocked)
output: student-perspective answer, citing only accessible memories

input:  [persona: founder] query: "what should i work on?"
        → retrieves: investor followups (high), product roadmap (high), class deadlines (blocked)
output: founder-perspective answer
```

**topics to research:**
- how the same query re-weights across personas — the retrieval score delta, not just different answers
- mid-conversation perspective switches: does context carry over, and what shouldn't?
- persona leakage: testing that blocked memories never surface in phrasing, hedging, or omissions
- implicit vs. explicit persona detection — does the model infer perspective from query content when not stated?

**key question:** what's the training signal for "correct perspective behavior"? the retrieval engine computes the scores — the model needs to respect them, not re-derive them.

---

## 3. weighted graph traversal chains

**what it is:** training samples formatted as paths, not flat text blocks. a query triggers a central tag, which cascades down parent/child hierarchies (python → programming) and pulls associated tags based on explicit strength weights (0.8), not random vector distance.

**why it matters:** memorium's retrieval is a graph walk, not a nearest-neighbor search. the model needs to reason over the traversal structure itself.

**dataset shape:**
```
input:  query triggers tag:python
        traversal: python --(parent 1.0)--> programming --(assoc 0.8)--> software-engineering
        traversal: python --(assoc 0.6)--> scripting --(assoc 0.4)--> automation
output: answer that cites the traversal path and the weights that pulled each node in
```

**topics to research:**
- path formatting: how to serialize a graph traversal so a model can reason over it (adjacency lists? path traces? both?)
- traversal depth vs. relevance — when does a 3-hop association stop being signal and start being noise?
- weight decay along chains: does a 0.8 × 0.4 chain mean 0.32 effective relevance? multiplication vs. min() vs. floor thresholds
- negative associations in traversal — paths that explicitly *block* traversal
- cycles: python → programming → python — how does the traversal terminate?

**key question:** should the model see full traversal traces (teach it the graph) or just the final retrieved set (teach it the result)? the former is more transferable, the latter is cheaper.

---

## 4. underconfident boundary tests

**what it is:** explicit training cases designed to test confidence thresholds. examples where data is sparse or conflicting, so the model learns to output structured doubt — asking for clarification or stating it doesn't know — instead of confidently hallucinating context.

**why it matters:** a traditional llm will stretch a weak connection into a polished, confident answer. memorium's model must respect mathematical confidence scores and know when to pump the brakes.

### the confidence tier split (ground truth rules)

| tier | score | expected behavior |
| --- | --- | --- |
| high confidence | ≥ 0.75 | clear tag matches, strong identity weights, high semantic alignment → direct, unhedged answer |
| uncertain | 0.45 – 0.74 | valid tags match, but hierarchy decay has kicked in or persona relevance is low → answer with a flag ("based on your hobbyist perspective, but this reference is older...") |
| needs clarification | 0.25 – 0.44 | overlapping tags pull conflicting perspectives or ambiguous aliases → actively ask a clarifying question instead of guessing ("do you mean coding for the hackathon or your day job?") |
| unavailable | < 0.25 | missing tags or strict permission sandboxes block access → complete refusal, state the information isn't available |

### dataset sample format

```
input context:
  query: "what was that deadline again?"
  retrieved nodes: tag:deadline
    (hierarchy decay: 0.2, persona relevance for current perspective: 0.1, source confidence: 0.3)
  calculated total confidence score: 0.22 (< 0.25 threshold)

target model response:
  "i don't have enough information in your current perspective to find that deadline.
   do you want to switch to employee you or check the shared archive?"
```

**topics to research:**
- refusal phrasing design — refusals that offer the *next best action* (switch persona, check archive, rephrase query) instead of dead ends
- boundary hysteresis: scores near thresholds (0.74 vs. 0.76) — should behavior differ that sharply? smooth transitions vs. hard tiers
- conflicting evidence inside one tier — two retrieved nodes, one at 0.8 one at 0.3, same query
- the calibration problem: does the model learn *the numbers* or *the behaviors*? testing whether it can be fooled by relabeled scores
- structured doubt output format — how the model expresses which signal dragged the score down (decay? relevance? permissions?)

**key question:** how do you build a negative-evaluation set — inputs that *look* answerable but must be refused — without just enumerating gotchas?

---

## 5. multimodal content references

**what it is:** samples that tie raw text memories back to structured metadata or file sources (code snippets, docs, design logs) with attached line ranges and content types, showing the model how to pull reference materials alongside conceptual notes.

**why it matters:** memorium stores images, pdfs, docs, and code. retrieval must return the *source material* with the memory, not just a text summary of it.

**dataset shape:**
```
input:  query: "how did we fix the auth race condition?"
        retrieved: memory node (text summary)
                   + source: file:src/auth.ts, lines 45-62, type:code
                   + source: file:docs/postmortem.pdf, page 3, type:doc
output: answer that cites the summary AND quotes the relevant source lines
```

**topics to research:**
- reference serialization: file paths + line ranges + content types as a compact citation format
- when to quote vs. summarize — proximity of the retrieved memory to the actual source content
- citation integrity: testing that quoted content actually exists at the referenced location (anti-hallucination for sources, not just facts)
- cross-modal association — a text memory linking to an image with a region reference (bounding box? caption?)
- truncation behavior: line ranges that exceed the file's current state (file changed since indexing)

**key question:** is the model responsible for *fetching* the reference content, or does the retrieval engine hand it both the memory and the resolved source? (design answer: engine resolves, model phrases.)

---

## dataset construction priorities

1. **underconfident boundary tests** — highest leverage. this is the behavior that separates memorium from a wrapped llm. train it first.
2. **alias mapping pairs** — the volume component. needs scale, mostly mechanical, can be partially synthesized.
3. **perspective switching scenarios** — the identity component. fewer samples but each is dense.
4. **weighted graph traversal chains** — the reasoning component. format design matters more than volume.
5. **multimodal content references** — the citation component. depends on the source-resolution pipeline existing first.

see [../weighting-mechanics/readme.md](../weighting-mechanics/readme.md) for the scoring mechanics these datasets assume.
