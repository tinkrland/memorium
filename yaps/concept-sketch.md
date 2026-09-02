# concept sketch

## the bigger framing: knowledge graph with memory semantics

memorium isn't just a database of memories or a key-value store for user facts. it's a personal knowledge graph with memory semantics.

a normal knowledge graph asks:
> "what is connected to what?"

memorium asks:
> "what is connected to what, how strongly, why, when, according to whom, in what context, for which persona, with what confidence, and should this connection affect retrieval right now?"

traditional databases store facts. vector stores find loose text similarities. knowledge graphs link entities. memorium overlays memory dynamics — temporal decay, confidence, source provenance, persona perspectives, context weights, and associative chains — on top of a graph structure.

## the mental model

imagine your memory is not a filing cabinet (where everything is equally filed) but a living structure with:

- roots (identity — deep, stable, unchanging): "i am a developer." "my name is karl." these are the roots. pull one out and the tree changes.
- branches (behavior — what drives your actions right now): "the deadline is friday." "i'm presenting at the standup." these grow, wither, and fall off. they're not part of your identity, but they dominate your attention.
- leaves (transient facts — noise): "it rained last tuesday." "the meeting was at 3pm." these exist, they're technically memories, but they don't define you or drive you.

memorium models all three, on two axes:

```
         weight (identity core)
         high
          │
   "i am  │  "i believe in
   a dev" │   open source"
          │     (core to who i am,
          │      but i don't bring
          │      it up unless asked)
          │
          │         "it rained
          │          last tuesday"
          │           (noise)
          │
  ────────┼─────────────────── hierarchy (behavior drive)
          │
          │    "i am a student"
          │     (defines me AND
          │      drives everything)
          │
          │  "the exam is
          │   tomorrow"
          │    (not part of identity
          │     but ALL i think about)
          │
         low
```

## cross-domain associativity

memorium discovers connections across completely different domains without needing explicit links created by the user. conceptual bridges cross domain boundaries automatically:

```
music orchestration ──→ system orchestration ──→ distributed systems ──→ coordination ──→ narrative structure
```

a thought about system orchestration in distributed systems might activate a memory about musical orchestration or narrative structure in writing. the same underlying concept (coordination of independent actors over time) appears in different contexts, allowing the memory engine to pull creative, cross-domain insights into context when relevant.

## typed associations

edges in the graph carry explicit relationship semantics rather than simple undirected links:

- caused_by
- example_of
- contrasts_with
- similar_to
- prerequisite_for
- derived_from
- commonly_cooccurs_with
- metaphor_for
- part_of
- applies_to
- reminds_me_of

some edges are explicitly asserted by the user ("a prerequisite_for b"), while others are inferred by the system with a confidence score. edges can also be negative ("x avoid associating with y") to prevent retrieval loops when a connection has been rejected by the user.

## association chains

retrieval isn't restricted to direct 1-hop matches. memorium traverses the graph outward through multi-hop chains:

```
query ("speaker prep")
  └─→ conference presentation
        └─→ public speaking
              └─→ previous 2024 presentation
                    └─→ alex attended
                          └─→ alex research paper
                                └─→ target project connection
```

the traversal engine evaluates 2nd and 3rd degree connections, balancing associative distance against context relevance to decide whether distant nodes are worth pulling into context.

## the perspectives model

```
          one you
        (global self)
            │
    ┌───────┼───────┐
    │       │       │
    ▼       ▼       ▼
 student  employee  hobbyist
    │       │       │
  memory  memory  memory
  perms   perms   perms
  tags    tags    tags
    │       │       │
    └───┬───┴───┬───┘
        │       │
     sharing  sharing
     (opt-in) (opt-in)
```

each perspective is a sandbox. it has its own memory, its own permissions, its own behavior. sharing between perspectives is explicit and conditional. by default: nothing crosses.

## the retrieval pipeline

traditional rag:

```
documents → chunks → embeddings → similarity → context
                    (black box)
```

memorium:

```
knowledge
    ↓
human tags ("coding", "dev", "programming")
    ↓
tag wrangling (→ canonical: "programming")
    ↓
canonical concepts + hierarchy + associations
    ↓
weights + confidence scores
    ↓
persona sandbox (which perspective am i?)
    ↓
permissions + relevance (what can i see? what do i care about?)
    ↓
semantic retrieval (embeddings, demoted to 15%)
    ↓
confidence check (≥0.75? ≥0.45? ≥0.25?)
    ↓
context (with logged component scores)
```

every step is inspectable. every retrieval is debuggable. nothing is a black box.

## user-visible inspectability ("why did you remember this?")

when memorium makes a non-obvious or multi-hop retrieval, it exposes the full associative chain to the user:

> "you asked about conference planning → public speaking → your 2024 presentation → alex attended → alex works in your target field. confidence: 0.78"

this turns black-box vector similarity into a transparent, debuggable explanation graph. users can see why a memory was retrieved, adjust edge weights, or break incorrect association chains directly.

## the gui concept

```
┌──────────────────────────────────────────────────────────┐
│  memorium                                                  │
│                                                            │
│  [persona cards]                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │ hackathon│  │  work   │  │  class  │                    │
│  │ 12 mems  │  │ 47 mems │  │  8 mems │                    │
│  │ [graph]  │  │ [graph]  │  │ [graph] │                    │
│  └────┬────┘  └────┬────┘  └─────────┘                    │
│       └──→ one-way →┘                                      │
│           (project links)                                  │
│                                                            │
│  [knowledge graph]                                         │
│  d3 visualization of memory nodes + associations            │
│  nodes sized by weight, colored by hierarchy                │
│  edges show association strength                            │
│  click a node → see tags, source, confidence, last recall  │
│                                                            │
│  [tag sidebar]                                             │
│  ao3-style tag browser with hierarchy tree                  │
│  filter memories by canonical tag, alias, or category      │
│                                                            │
│  [permissions matrix]                                      │
│  personas × sources grid with toggles                       │
│                                                            │
│  [retrieval log]                                           │
│  every query, every score, every decision                   │
│  "why was this retrieved?" → expand → see all 6 signals    │
└──────────────────────────────────────────────────────────┘
```

## what makes this different from mem0, zep, etc.

| feature | mem0 | zep | memorium |
| --- | --- | --- | --- |
| two-axis memory (weight + hierarchy) | no | no | yes |
| ao3-style tag wrangling | no | no | yes |
| persona/perspective sandbox | no | no | yes |
| human-legible retrieval (6 logged signals) | no | no | yes |
| underconfident thresholds | no | no | yes |
| gui-first (not api-first) | no | no | yes |
| stack-agnostic | partially | no | yes |
| multimodal memory | partial | partial | yes |
| conditional per-memory sharing | no | no | yes |
| memory decay (hierarchy only, not identity) | no | no | yes |

memorium wraps mem0 for vector search. it doesn't replace it. it adds the structure that vector search alone can't provide.
