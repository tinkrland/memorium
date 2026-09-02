# weighting mechanics — research scoping

scope: the most interesting research vector for a system like memorium — how its dual-rate weighting and hierarchical decay manage information over time. standard models treat all context equally or rely on simple token recency. memorium splits memory into structural forces that behave very differently.

this folder defines the key research questions and dataset angles for the adaptionlabs training data. not the research itself — the topics to touch and the data points to build.

feeds: adaptionlabs dataset. assumes the confidence tier split defined in [../tag-wrangling/readme.md](../tag-wrangling/readme.md#4-underconfident-boundary-tests).

---

## 1. non-decaying identity weight vs. exponential hierarchy decay

**the concept:** memorium separates foundational identity ("i am a developer", weight 0.95, zero decay) from active tasks/hierarchy ("deadline friday", hierarchy 0.9, exponential decay). two rates, two clocks.

```
identity weight:    0.95 ────────────────────────────►  0.95   (flat, no decay)
hierarchy decay:    0.90 ─╲                                         
                          ╲  e^(-λt)                                
                           ╲____                                   
                                ╲_______                           
                                       ╲_______________  →  ~0      
                    now          days          weeks         months
```

**what to test:** whether a model can recognize when a piece of context is a permanent core truth versus a temporary state. if an old project goal conflicts with a current active deadline, the model needs to prioritize the decaying hierarchy for immediate action — without letting it permanently overwrite the core identity weight.

**topics to research:**
- decay curve selection: exponential vs. power-law vs. stepped. what does human memory actually do, and does it matter that we match it?
- the λ (decay constant) per memory type — deadlines decay faster than preferences, preferences decay faster than identity traits. is one λ enough or do we need per-node λ?
- reinforcement interaction: every recall should *bump* the hierarchy score back up (use it or lose it). what's the bump function? does bumping decayed hierarchy ever promote something into non-decaying identity?
- collision handling: identity trait ("i am a backend developer") vs. active hierarchy ("i'm doing frontend this sprint") — the model must not resolve this by rewriting identity
- decay floor: should hierarchy scores asymptote to zero or to a small floor (0.05) so old context is retrievable-with-low-confidence rather than gone?

**dataset angle:** include samples where identity traits and active timelines collide, training the model to weight its reasoning based on the decay curves attached to the memory nodes rather than just the order of the prompt.

**dataset shape:**
```
input:
  query: "what should i build next?"
  node A: "i am a backend developer"  (identity, weight 0.95, decayed: 0.95)
  node B: "current sprint is frontend redesign" (hierarchy, 0.9 → decayed to 0.82)
  node C: "old goal: learn rust" (hierarchy, 0.7 → decayed to 0.11)

target: prioritize B (active, decaying but still high) as the immediate answer,
        frame it through A (identity context, never decays),
        do NOT let C resurface as urgent, but can mention it as an old interest
```

---

## 2. multi-signal confidence composition

**the concept:** total retrieval confidence isn't a flat vector score. it's a calculated blend where semantic similarity is heavily demoted (15%), tag matching is primary (30%), persona relevance drives 20%, and identity/hierarchy make up the rest (35%).

```
total confidence = 0.30 × tag_match          ← primary signal
                 + 0.20 × persona_relevance  ← whose laptop is logged in
                 + 0.35 × identity_hierarchy ← weight × decayed hierarchy
                 + 0.15 × semantic_sim       ← demoted embeddings
```

the exact weight split is a research question itself — these are the current pipeline v2 values.

**what to test:** feed the model scenarios where semantic similarity points one way, but tag relevance and persona weights point another.

**topics to research:**
- the semantic trap: a query that closely matches a memory semantically (same words, same vibe) but whose persona relevance or hierarchy score is practically zero. the model must ignore the trap and follow the structural weights.
- weight sensitivity analysis: if tag match goes from 30% → 40%, how does retrieval behavior change? are there phase transitions in the blend space?
- signal correlation: tag match and semantic sim are correlated in practice (matching tags often mean matching words). how much of the blend is actually independent signal vs. double-counting?
- normalization: are the four signals on comparable scales (0-1 each)? what happens when one signal is missing entirely (no tags on a memory)?
- adversarial composition: a memory with 0.95 semantic match, 0.9 tag match, but 0.0 persona relevance (belongs to a sandboxed perspective) — the blend may compute above threshold, but the sandbox must still block. composition is not the last word.

**dataset angle:** create training pairs where a query uses words that closely match a memory semantically, but the persona relevance or hierarchy score is practically zero. the dataset should teach the model to ignore the semantic trap and follow the structural weights instead.

**dataset shape:**
```
input:
  query: "that meeting about the API redesign"
  node A: semantic_sim 0.91, tag_match 0.85, persona_relevance 0.05, hierarchy 0.1
          → total ≈ 0.30(0.85) + 0.20(0.05) + 0.35(0.1×0.4) + 0.15(0.91) = 0.47 (uncertain tier)
  node B: semantic_sim 0.44, tag_match 0.80, persona_relevance 0.90, hierarchy 0.8
          → total ≈ 0.30(0.80) + 0.20(0.90) + 0.35(0.8×0.75) + 0.15(0.44) = 0.75 (high tier)

target: answer from node B despite node A being the obvious semantic match.
        flag the reasoning: "B is from your employee perspective and current; A was from
        the hackathon sandbox and its relevance has decayed."
```

---

## 3. cross-perspective permission friction & sandboxing

**the concept:** memory is strictly sandboxed by perspective unless explicit sharing rules exist. every cross-perspective access attempt is logged and weighed. the sandbox is a hard layer *after* the confidence blend — permissions can veto a high-confidence retrieval.

```
retrieval request
      │
      ▼
  confidence blend (signals 1+2 above)
      │
      ▼
  sandbox check ─── allowed ───► return memory
      │
    denied
      │
      ▼
  log the attempt (audit trail) + return structured refusal
```

**what to test:** whether the model handles permission boundaries gracefully. what happens when "hobbyist you" tries to query a memory locked inside "founder you" without a sharing rule?

**topics to research:**
- refusal vs. redirect: the clean boundary statement ("that information belongs to a different perspective and isn't shared") vs. offering the sharing path ("do you want to grant hobbyist-you access to this?")
- granularity of sharing rules: one-way, bidirectional, conditional (tag-based: only "portfolio" and "achievement" tags flow). how complex should conditional rules get before the model can't reason about them?
- the audit log as training data: logged denied attempts are signal — if the user keeps trying to reach a memory from the wrong persona, maybe they want a sharing rule. proactive suggestion?
- inference-based leakage: can the model *infer* the content of a blocked memory from unblocked adjacent memories? (e.g., blocked: "salary negotiation notes"; unblocked: "recently changed jobs"). the sandbox must extend to inference, not just retrieval. this is the hardest problem in this folder.
- permission changes over time: a memory shared, then unshared — does the model that already saw it "forget"? training-time vs. inference-time knowledge.
- the "shared laptop" framing: users think of personas as accounts. permission UX vocabulary — borrow from OS file permissions? from google docs sharing? something new?

**dataset angle:** build examples where the retrieval engine returns a memory node, but the sandbox layer flags a permission denial. the model needs to learn to respond with a clean boundary statement, preventing context leaks across different roles.

**dataset shape:**
```
input:
  query (persona: hobbyist): "what did the investor call say?"
  retrieval engine: found node "investor call notes" (confidence 0.88, high tier)
  sandbox layer: DENIED — node belongs to persona: founder, no sharing rule exists
  audit log: attempt logged (hobbyist → founder/mem#4821, denied)

target response:
  "that information belongs to a different perspective and isn't shared with your
   hobbyist persona. you can switch to founder you, or set up a sharing rule if
   you want this visible here."
```

---

## cross-cutting experiment matrix

| experiment | manipulates | expected observable |
| --- | --- | --- |
| decay race | two nodes, different λ, queried at t=0, t=1w, t=1m | ordering flips as decay crosses |
| blend ablation | drop one signal at a time (tag/persona/identity/semantic) | which drop hurts retrieval most |
| sandbox veto | high-confidence retrieval, denied permissions | model refuses despite high score |
| semantic trap | high sim, low structural score | model picks the structurally-sound node |
| identity overwrite attempt | active state contradicts identity | model frames action through identity, doesn't rewrite it |
| tier boundary | scores at 0.74/0.76, 0.44/0.46 | behavior change at thresholds (or smoothing) |

## tooling fit

- **wolfram alpha cloud**: validate the decay math, blend formulas, threshold sensitivity — every formula here should be checked computationally before it goes into training data.
- **featherless**: generate baseline comparisons — an unadapted model given the same retrieval context. the delta between baseline and adapted behavior *is* the training signal.
- **adaptionlabs**: where the composite dataset (these three + the tag-wrangling five) gets trained.
- **brightdata / firecrawl**: prior art — how other systems (ao3 wrangling guidelines, enterprise permission systems, spaced-repetition research like supermemo's forgetting curves) solved decay and permission problems.
