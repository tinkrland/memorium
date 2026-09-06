# substrate pilot → memorium pillars: the compute-objective mapping

**status: shelved.** substrate has two parents — memorium research is one, and custody currently sits with the co-parent. this mapping stays parked as review material; nothing below gets absorbed into the agenda unless custody comes back.

---

draft. this maps the substrate pilot's eight compute objectives (canvas branch, `research/canvas/compute/`) onto memorium's seven pillars / research axes, so every result the pilot produces lands in the agenda instead of sitting in the substrate repo unheard. it also names what each remaining objective will actually validate before it runs — so when the numbers come in, we already know which memorium claim they confirm or break.

## why this mapping exists

memorium's research agenda currently plans falsifiable benchmarks per pillar, but hasn't started them. the substrate pilot, meanwhile, has been quietly running pillar-shaped experiments for days — it just called them "compute objectives." the pilot is effectively the first five agenda experiments in disguise, minus the flat-vector baselines. recognizing that turns substrate from a side project into the agenda's running head start.

## the full map

| # | substrate objective | status | memorium pillar / axis | what it stress-tests |
| --- | --- | --- | --- | --- |
| 1 | aspect-conditioned embeddings (RG) | done — aspect +0.032 vs vanilla −0.007, bootstrap diff +0.052, 95% CI [0.010, 0.096] | **4. associativity** (axis 4) | whether conditioning retrieval on typed similarity axes (not raw cosine) actually recovers cross-field relations better. it does, and the CI excludes zero — the first empirical point for axis 4's core claim. also the honest result memorium needs: vanilla embeddings are *not* negative, they're just flat (−0.007 ≈ nothing). memorium's demoted-embeddings stance holds, but the margin is modest, not decisive |
| 2 | strength calibration (retest) | done — spearman 0.918, ece 0.15–0.18, accept threshold ~0.35–0.41 | **2. weightage** (axis 2) | that a 0–1 strength/weight score can be *calibrated* — reproducible across reruns, with a defensible accept/reject threshold. axis 2 assumes weights are stable enough to anchor identity; 0.918 retest is direct evidence they can be |
| 3 | grid distortion | done — flow-order 38.9% (strict 61.9%), held-karp buys ~10pts, sketch near-optimal, institutions loneliest | **3. nesting** (axis 3) | that hierarchical placement (domain grid, tier ordering) is *not arbitrary* — placement costs measurable accuracy, and there's a near-optimal arrangement a human sketch already approximates. axis 3's parent-child inheritance needs exactly this: structure that pays rent |
| 4 | thread score | done — 198 candidates → 80 draws (beat null, bootstrap surv ≥ 0.5, n ≥ 4); top: sound-epistemics 0.92, writing-practicum 0.87, sacred-text-ontology 0.77 | **4. associativity** (axis 4) | which associative clusters survive against a null — i.e., which `reminds_me_of`-style groupings are signal vs vibes. this is the pilot's answer to axis 4's "at what depth does associativity introduce semantic noise": the bootstrap-survival filter is the noise gate |
| 5 | dynamics (reinforcement–decay) | **remaining** — planned params α=0.05, λ=0.01/day, τ=0.3 | **5. priority** (axis 5) | the direct one. reinforcement-decay on weave edges is the same curve family as memorium's exponential hierarchy decay — usage strengthens, time erodes, floor τ prevents death. this is axis 5's decay-driven attention model run on real data before memorium ever implements it. memorium should treat the fitted curves as its prior, and wolfram validates the math per the agenda's tooling chain |
| 6 | load-bearing node index | **remaining** | **2. weightage** + **3. nesting** (axes 2/3) | deciding which nodes carry structural load — i.e., the empirical basis for memorium's weight-vs-hierarchy split. a load-bearing index computed from graph topology is how memorium could justify *why* "i am a developer" gets weight 0.95 and no decay, instead of hand-assigning it. potential upgrade: memorium's identity-core set becomes *derived*, not declared |
| 7 | validity | **remaining** | **7. accuracy** (axis 7) | whether the graph corresponds to reality at all — the "contact" check memorium currently lacks (see [retrieval-as-construction.md](./retrieval-as-construction.md): everything memorium measures today is coherence). if the pilot ships a validity metric, memorium's pillar 7 gets its missing half for free |
| 8 | compute mapping | **remaining** | methodology (all axes) | the toolchain write-up — which tool computed what, reproducibility, seeds, run logs. maps onto the agenda's methodology notes and the adaptionlabs experimental record. dry but load-bearing: it's what makes the other seven results citable |

## findings that already crossed the bridge (no compute needed)

two substrate results are already agenda-relevant on their own:

- **canonicalization manufactured coherence** — TWI jumped 5.93 → 10.17 when the field registry cleaned things up, and part of that jump was cleanup *creating* apparent structure rather than revealing it. this is the empirical instance of "a graph becomes more coherent than the world it represents" ([readme](./readme.md), point on coherence vs contact). agenda implication: axis 7's benchmark must run *before and after* any canonicalization pass, or the improvement gets attributed to the wrong cause.
- **asymmetric category-boundedness** — generators cross field boundaries 71% of the time when bridging to fields (≈ arXiv's human 67%) but stay home 31% for subject→subject weaves. cross-domain leaps are real but *directional*. agenda implication: axis 4's "creative cross-domain leaps without sacrificing precision" isn't symmetric — the traverse-from vs traverse-to matters, and the benchmark should measure both directions separately.

## the honest gap: pillar 6

substrate can't stress-test **contextual relevance wrt perspective** — it's single-perspective. no personas, no sandbox boundaries, no sharing rules, no access logs. axis 6 (zero-leakage compliance under load) remains untested by the pilot and probably always will be; it needs a multi-persona deployment, which substrate isn't. better to say that plainly here than let the mapping imply the pilot covers all seven.

the closest substrate gets: the domain grid's *conditional* visibility — which fields surface for a given subject tier — behaves a bit like scoped relevance, but it's a stretch and shouldn't be logged as a pillar-6 data point.

## proposed absorption path (for review)

1. objectives 5–8 run in substrate as planned, but each finding doc gets a "memorium implication" closing section (pilot findings already require a limits section — this adds the forward pointer).
2. once objective 7 (validity) lands, mirror its metric into `research/agenda/` axis 7 as the contact-check draft — don't wait for a memorium-native implementation.
3. agenda experiments 2 and 5 should import substrate's fitted decay/calibration params as priors instead of cold-starting, and cite the pilot runs in the adaptionlabs experimental record.
4. keep this doc on the brainstorm branch until objectives 5–8 land, then promote the confirmed rows into `research/agenda/readme.md` as a "pilot evidence" column.
