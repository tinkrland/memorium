# the problem

memory is flat. and flat memory is broken.

## the flat memory problem

every AI agent today has the same memory architecture: a vector database. you chunk some text, embed it, store it, and retrieve by similarity. that's it. one axis. one signal. one black box.

this has three problems:

### 1. everything has the same importance

"i am a developer" and "it rained last tuesday" are stored the same way. when the agent retrieves context, both are equally valid candidates. the system has no concept of "this is WHO i am" vs "this is a transient fact that doesn't matter." it's all just text in a vector space.

### 2. retrieval is a black box

when the system retrieves something wrong, you can't debug it. why was this chunk returned? because the cosine similarity was 0.87. what does that mean? nothing useful. you can't inspect the retrieval process. you can't see which signals contributed. you can't fix it.

### 3. there is no concept of perspective

all memory belongs to one entity. the "you" at work and the "you" at a hackathon share the same memory pool. your work persona knows about your weekend project. your hackathon persona knows about your quarterly review. there's no sandbox. no boundaries. no identity.

## what memorium solves

memorium introduces structure to memory:

### two axes instead of one

- **weight**: how core this is to identity (doesn't decay)
- **hierarchy**: how much this drives behavior (decays over time)

"i am a developer" = high weight, high hierarchy. "the exam is tomorrow" = low weight, high hierarchy. "it rained last tuesday" = low weight, low hierarchy. the system can now distinguish between identity, urgency, and noise.

### human-legible retrieval

instead of a single cosine similarity score, every retrieval combines six signals, each weighted and logged:
- semantic similarity (15%)
- tag match strength (30%)
- hierarchy boost (10%)
- identity weight (10%)
- persona relevance (20%)
- source confidence (15%)

when retrieval gets something wrong, you can inspect: "this was retrieved because these tags were wrangled together, this concept is nested under that one, and this persona has a high relevance weight for it." you can fix it.

### personas as first-class citizens

memory is scoped to perspectives. employee you, hobbyist you, student you — each with its own memory, permissions, and behavior. sandboxed by default. sharing is opt-in, per-memory, conditional.

the "you" at work does not bring up what was discussed at last weekend's hackathon unless you explicitly let it.

### human-organizable

instead of requiring users to understand embeddings, vector similarity, or rigid taxonomies, memorium uses AO3-style tag wrangling. tag something "coding" and the system knows that's "programming." tag something "dev" and it knows that too. humans organize the way they naturally think. the system handles the canonicalization.

### underconfident by default

the system doesn't pretend to be sure. confidence thresholds gate whether results are returned, flagged, or withheld. ≥ 0.75 = confident. ≥ 0.45 = uncertain. ≥ 0.25 = needs clarification. below that = "i don't have enough information." no context drift. no hallucinated confidence.

## the bigger problem

this isn't just about prixie. every AI agent — personal assistants, meeting bots, coding agents, research agents — has the same flat memory problem. memorium is designed to be standalone and portable. any system can plug into it. the problem is universal. the solution should be too.
