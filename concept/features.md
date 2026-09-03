# features

## core memory mechanics

### weighted, hierarchical, associative memory
every memory has two independent axes:
- weight (0-1): how core this is to the persona's identity. does not decay. "i am a developer" = 0.95.
- hierarchy (0-1): how much this drives the persona's behavior. decays exponentially. "deadline friday" = 0.9.
plus associations between memories (strength, type) and confidence (how sure the system is this is accurate).

### ao3-style tag wrangling
inspired by archive of our own. instead of rigid taxonomies or embeddings expertise:
- canonical tags with aliases (synonyms, misspellings, abbreviations, translations)
- parent/child hierarchy ("python" is child of "programming")
- exclusions (mutually exclusive tags)
- associations (related tags with strength)
- persona-specific relevance weights per tag
- tag merge (combine duplicate canonical tags)
- auto-wrangling for new tags with fuzzy matching
- original language always preserved alongside canonical

### multimodal memory
memory is not just text. it stores text, images, pdfs, documents, code, audio, and video. extracted text from files is stored for searchable retrieval. content metadata (page numbers, line ranges, language) is preserved.

### memory indexing
new facts from any source (transcripts, user input, inference, shared) are extracted and stored with:
- initial weight (based on how often it's mentioned / how central it seems)
- initial hierarchy (based on urgency and action-orientation)
- tags (for organization and sharing rules)
- source tracking (where this memory came from)
- confidence score

### strict sandbox enforcement
- no access to other persona's data unless explicitly configured
- sharing rules: one-way, bidirectional, conditional
- per-memory sharing (not all-or-nothing)
- every access attempt logged to audit trail
- denied access attempts logged with reason

### gui-first interaction
- persona cards with identity, memory stats, access, pending questions
- d3 knowledge graph (neo4j-esque visualization of memory nodes + associations)
- tag filter sidebar (ao3-style)
- memory tree with weight/hierarchy bars
- permissions matrix (personas × sources)
- sharing flow diagram (visual arrows between persona cards)
- retrieval log (transparency — see exactly what was retrieved and why)
- drag-and-drop meeting assignment to perspectives
- memory weight/hierarchy sliders for manual adjustment

### stack-agnostic
memorium defines a data model and a retrieval pipeline, not a specific implementation. use whatever you already have:
- database: postgres, sqlite, redis, falkordb, mongodb, supabase, planetscale
- backend: hono, fastapi, express, deno, bun, rails
- frontend: react, vue, svelte, solid, vanilla
- vector store: mem0, pinecone, weaviate, qdrant, pgvector, chroma
the concepts are portable. the spec is the spec. you implement it.

## associativity

### cross-domain associativity
recognizes relationships between domains even when never explicitly connected by the user. "orchestration" from music becomes relevant when thinking about "distributed systems". the same underlying concept appears across different contexts.

### association types
associations aren't just generic links ("a → related to → b"). typed edges capture explicit semantic links:
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
some are user-created, others are inferred by the system.

### associative distance
not all associations are equally strong. distinguishes between "strong relevance" and "interesting association". weak associations aren't pruned automatically — distant connections are often where useful insights happen.

### association chains
retrieval doesn't stop at first-degree matches. traverses the graph outward: query → conference presentation → public speaking → previous presentation → person who attended → their research → related project. graph traversal logic decides whether 2nd or 3rd degree connections should be brought into context.

### negative associations
supports explicit anti-relationships: "x NOT related to y" or "x avoid associating with y". prevents retrieval from repeatedly making connection loops the user has explicitly rejected.

## temporal dynamics

### temporal associativity
relationships change over time. "alice works_at company a (2023-2025), company b (2025-present)". memories have temporal validity states rather than static true/false values. user interests can be discovered, become active, or get abandoned over time.

### contradiction and competing memories
multiple conflicting facts coexist naturally without silent overwriting. "alice likes jazz" (confidence 0.71, valid 2021-2024) vs "alice dislikes jazz" (confidence 0.83, valid 2025-present). represents competing claims alongside their temporal validity windows.

## provenance and lineage

### provenance
every memory tracks its origin: source (conversation, user, inference), source_date, originally_stated_by, and confidence level (explicit statement vs model inference). tracks the difference between "user explicitly said this" and "model inferred this from three other memories".

### memory lineage
provides a traceable lineage chain: original observation → normalized memory → canonical tag → derived association → persona-specific interpretation. answers "why does memorium think this is relevant?" for debugging and auditing.

## persona and scope

### persona pov system
one you, many perspectives. each perspective has identity, memory (sandboxed), contextual permissions, relevance, and behavior. rapid pov switching with shared core identity but isolated contextual world models.

### memory sharing
- one-way flow: persona a can read persona b's memory, but b can't read a's
- bidirectional flow: both personas can read each other's memory
- common traits: shared identity facts across all personas (global self)
- conditional sharing: share only when certain tags or categories match
- per-memory granularity — share "i won best hack" without sharing "i forgot to eat for 18 hours"

### persona-specific associations
the same knowledge graph produces different edge weights and views per persona. career persona sees "machine learning → career → resume → jobs". technical persona sees "machine learning → research → papers → experiments". underlying knowledge isn't duplicated — the interpretation layer changes.

### context-dependent weights
memories don't have single global weights. a memory has global importance + per-persona weight + per-context weight. "user is learning spanish" = global 0.62, travel assistant 0.94, language tutor 0.99, coding assistant 0.08, trip planning context 0.97, grocery shopping 0.12.

### memory scopes beyond personas
general hierarchy of memory scopes: global, user, household, project, organization, persona, session, temporary. "this project uses supabase" belongs to the project scope, not the persona or individual user scope.

### association permissions
fine-grained permission rules on relationships. persona a can see memory x and association x→y. persona b can see memory x but cannot see association x→y. relationships between facts can be sensitive even if individual facts aren't.

## retrieval and inspectability

### underconfident retrieval pipeline
knowledge → human tags → tag wrangling → canonical concepts → hierarchy + associations → weights + confidence → persona sandbox → permissions + relevance → semantic retrieval → context.
confidence thresholds gate output:
- ≥ 0.75: confident — return without caveat
- ≥ 0.45: uncertain — return but flag uncertainty
- ≥ 0.25: needs clarification — ask the user
- < 0.25: unavailable — "i don't have enough information"
logged component scores: semantic similarity (15%), tag match (30%), hierarchy boost (10%), identity weight (10%), persona relevance (20%), source confidence (15%).

### associative retrieval modes
retrieval isn't just one query algorithm; it's a retrieval strategy engine combining multiple query modes: exact, semantic, hierarchical, associative, temporal, causal, persona-aware, tag-aware, and graph traversal.

### user-visible "why did you remember this?"
when memorium retrieves something via indirect association, it exposes the chain to the user: "you asked about conference planning → public speaking → your 2024 presentation → alex attended → alex works in your target field. confidence: 0.78". makes associative behavior fully inspectable.

## confidence, decay, and actions

### memory decay
- weight (identity) does NOT decay — you don't stop being a developer because you haven't mentioned it
- hierarchy (behavior drive) decays exponentially — "deadline friday" stops driving behavior after friday
- recall_count reinforces both axes — frequently used memories strengthen
- decay affects retrieval priority, not existence — a new interaction can reactivate decayed memories

### memory reinforcement
inverse of decay. if a memory keeps appearing (mentioned once → mentioned again → used in decision → referenced repeatedly), its confidence and importance increase. memory importance becomes partly learned through real usage over time.

### ephemeral memory
not everything deserves long-term persistence. memory tier hierarchy: working memory → session memory → candidate memory → persistent memory. temporarily tracks fleeting details and only promotes them to persistent storage if they prove important enough.

### memory confidence vs memory importance
confidence and importance are separate axes. "user might be moving to boston" has high importance but 0.45 confidence → triggers the agent to ask or verify, rather than treating it as established fact.

### memory actions
memories carry distinct behavioral implications depending on their action type: informational, reminder, preference, constraint, instruction, goal, warning, relationship, hypothesis. "user likes dark mode" (preference) behaves differently from "never send emails before 9am" (constraint).
