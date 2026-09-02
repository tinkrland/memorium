# memorium (src)

this is where standalone memorium lives.

memorium is a standalone, portable, persona-based memory system. it is not coupled to prixie. it is not coupled to any specific stack. it is a structured context engine — more accurately, a personal knowledge graph with memory semantics — that any agent, app, or system can plug into.

## design principles

1. **stack-agnostic.** memorium does not assume your database, your backend, your frontend, or your language. it defines a data model and a retrieval pipeline. you implement it in whatever stack you already use. postgres, sqlite, redis, falkordb, mongodb, supabase, planetscale — doesn't matter. hono, fastapi, express, deno, bun, rails — doesn't matter. react, vue, svelte, solid, vanilla — doesn't matter. the concepts are portable.

2. **GUI first.** memorium is designed around visual interaction, not CLI or API-only flows. the GUI is not a wrapper around an API — it is the primary interface. personas are visual entities. memory is visualized as weighted, hierarchical, associative structures. permissions are a matrix. sharing is a flow diagram. retrieval is logged with transparency — including a user-visible "why did you remember this?" explanation chain. the GUI exists to make memory legible and manipulable, not just queryable.

3. **human-legible retrieval.** when memorium retrieves something wrong, a human can inspect why. every retrieval is logged with its component scores: semantic similarity, tag match, hierarchy boost, identity weight, persona relevance, source confidence. plus the full association chain that led to the result. plus the provenance and lineage of each memory involved. no black boxes.

4. **sandboxed by default.** personas are isolated. no cross-perspective access unless explicitly configured. sharing is opt-in, per-memory, conditional. association permissions add an extra layer — even if persona B can see memory X, it may not be able to see the association between X and Y.

5. **underconfident.** the system defaults to uncertainty. it asks to repeat, says it's unsure, rather than overconfidently replying. confidence thresholds gate whether results are returned, flagged, or withheld. confidence and importance are separate dimensions — high importance + low confidence means "ask and verify," not "treat as fact."

6. **associative, not just semantic.** memorium doesn't just retrieve by similarity. it traverses a typed, weighted, temporal, persona-aware association graph. it follows chains across domains. it recognizes that "orchestration" in music and "orchestration" in distributed systems share an underlying concept. it distinguishes "strong relevance" from "interesting association." it learns from negative associations — "x is NOT related to y."

## what lives here

this `src/` folder is the reference implementation home for standalone memorium. because memorium is stack-agnostic, the actual implementation can take many forms. the structure below is the canonical layout — adapt it to your stack.

```
src/
├── README.md              ← you are here
├── core/                  ← the memory engine (indexing, retrieval, decay, reinforcement)
├── tags/                  ← AO3-style tag wrangling
├── personas/              ← persona/perspective management + persona-specific associations
├── associations/          ← typed, weighted, temporal associations + cross-domain detection
├── temporal/              ← temporal associativity, competing memories, temporal state
├── provenance/            ← source tracking, lineage chains, transformation logs
├── permissions/           ← contextual permissions + sharing rules + association permissions
├── scopes/                ← memory scopes (global, user, project, org, persona, session, temporary)
├── ephemeral/             ← ephemeral memory promotion pipeline (working → session → candidate → persistent)
├── retrieval/             ← the retrieval strategy engine (multi-mode: semantic, associative, temporal, causal, etc.)
├── gui/                   ← the visual interface (GUI first, not API first)
├── storage/               ← storage adapters (postgres, sqlite, redis, falkordb, etc.)
├── vector/                ← vector store adapters (mem0, pgvector, pinecone, weaviate, etc.)
└── types/                  ← shared types / schemas (stack-agnostic data model)
```

## the data model at a glance

memorium's data model goes well beyond "embeddings in a vector store." here's what it tracks:

- **memory nodes** with weight (identity), hierarchy (behavior drive), confidence (accuracy), temporal validity (valid_from/valid_until), provenance (source, confidence origin), action type (informational, constraint, goal, etc.), and scope (global, user, project, persona, session, temporary)
- **typed associations** between nodes — not just "related to" but caused_by, example_of, contrasts_with, metaphor_for, prerequisite_for, derived_from, reminds_me_of, commonly_cooccurs_with, part_of, applies_to — each with a strength (0-1) and temporal validity
- **negative associations** — "x is NOT related to y" — to prevent rejected connections from recurring
- **canonical tags** with aliases, hierarchy, exclusions, associations, persona-specific relevance weights
- **persona-specific association visibility** — the same graph produces different edges per persona
- **memory lineage chains** — traceable from original observation through normalization, tagging, association derivation, and persona-specific interpretation
- **ephemeral memory tiers** — working → session → candidate → persistent, with promotion based on importance + recall frequency
- **retrieval explanations** — every retrieval logs the full chain of hops that led to the result, renderable as a "why did you remember this?" tree

## how to use this

1. read `../yaps/readme.md` for the concept overview
2. read `../yaps/about.md` for what memorium is (including the 26 design principles)
3. read `../yaps/problem.md` for why it exists
4. read `../yaps/concept-sketch.md` for the core ideas sketched out
5. read `../yaps/technobabble/archtecture.md` for the architecture with mermaid diagrams
6. read `../yaps/technobabble/underthehood.md` for the internals
7. pick your stack, implement the data model, wire the retrieval pipeline, build the GUI

memorium is not a library you install. it is a system you build from a spec. the spec lives in `yaps/`.
