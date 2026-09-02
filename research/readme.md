# memorium research

scoping docs for dataset construction, retrieval mechanics, and tooling. no actual research lives here yet — this folder defines what to research, why it matters, and what the datasets need to look like.

## research areas

| item | topic | feeds into |
| --- | --- | --- |
| [tag-wrangling/](./tag-wrangling/readme.md) | dataset scoping for the tag wrangler — alias resolution, perspective switching, graph traversal chains, confidence boundaries, multimodal references | adaptionlabs dataset |
| [weighting-mechanics/](./weighting-mechanics/readme.md) | dual-rate weighting (identity vs hierarchy), exponential decay, multi-signal confidence composition, permission sandboxing | adaptionlabs dataset |
| [agenda/](./agenda/readme.md) | formal research agenda — seven investigative axes, one per pillar, each with research questions and falsifiable benchmarks | empirical study |
| [agenda/pillars.md](./agenda/pillars.md) | the seven pillars that define the system — knowledge, weightage, nesting, associativity, priority, contextual relevance, accuracy | architecture definition |
| [ux.md](./ux.md) | spatial-cognitive & color-coded visual architecture — the graph IS the UI: typed edge rendering, spatial clustering, in-graph filtering | pilot UI |

## tools available

tools the agent (vesper) has access to that may be usable for this research:

| tool | tier | what it does | research use |
| --- | --- | --- | --- |
| adaptionlabs.ai | pro | model adaptation / fine-tuning platform | where the datasets get trained — the tag wrangler model, retrieval behavior model, boundary/refusal behavior |
| featherless.ai | pro | serverless llm inference, thousands of open models | baseline comparison models, synthetic training-pair generation, dataset evaluation harness |
| wolfram alpha cloud | — | computational knowledge engine | validating decay curves, weight math, confidence composition formulas, threshold analysis |
| tavily | — | web search api built for llms/agents | literature scan: rag, memory systems, tag ontologies, ao3 tag wrangling prior art |
| brightdata | — | web data platform: scraping, proxies, datasets | large-scale tag corpus collection (ao3, reddit, hn, stackoverflow tag usage patterns at scale) |
| firecrawl | — | web scraping → llm-ready markdown | targeted scraping of docs, papers, and design references into clean corpora |
| browserbase | — | headless browser automation | dynamic/js-heavy sites that resist simple scraping; interactive crawling |
| supabase | — | postgres + pgvector | prototyping the actual memory schema, running live retrieval experiments, ablation testing |
| python (sandbox) | — | compute | offline dataset formatting, statistical analysis, decay curve simulation |

### how the tools chain together (rough pipeline)

```
brightdata / firecrawl / browserbase     tavily / wolfram
        │ raw corpus collection                │ literature + math validation
        ▼                                     ▼
   python (clean, structure, pair)      ──►  dataset construction
        │                                     │
        ▼                                     ▼
   featherless (synthetic generation,    adaptionlabs (train the actual
   baseline eval, quality filter)       adapted models)
```

## open questions (cross-cutting)

these apply across both research areas and should be answered before dataset construction starts:

- what's the minimum viable dataset size for each component? (alias pairs likely need thousands; boundary tests maybe hundreds)
- synthetic vs. scraped data ratio — how much can featherless generate before it's circular (model training on model output)?
- evaluation methodology — how do we measure whether the adapted model actually respects weight scores instead of pattern-matching vibes?
- does the trained model replace the retrieval engine, or wrap it? (current design: the engine computes scores, the model phrases responses — training should reinforce this, not bypass it)
