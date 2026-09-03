# memorium roadmap

## current state (sept 2026)

### built (within prixie)
- memory schema v2 (8 tables + 3 views in supabase)
- memory engine v1 (indexing with auto-association, 7-step retrieval pipeline)
- retrieval pipeline v2 (underconfident, 6 weighted signals, logged scores)
- tag wrangler (ao3-style: canonical tags, aliases, synonyms, fuzzy matching, exclusions, associations, persona relevance, tag merge)
- multimodal memory (images, pdfs, docs, code)
- 20+ api endpoints at /api/memorium
- strict sandbox enforcement with audit log
- persona permissions + sharing rules (one-way, bidirectional, conditional)

### not yet working
- standalone extraction from prixie (memorium still coupled to prixie's backend)
- gui (designed, not built — persona cards, knowledge graph, permissions matrix, retrieval log)
- memory decay service (designed, not built)
- storage adapters beyond supabase
- cross-system portability (memorium should work outside prixie)

---

## phase 0: standalone extraction

memorium exists within prixie but is designed to work independently. this phase is about making that real.

### 0a. decouple from prixie
- extract memorium into its own `src/` with no prixie dependencies
- define stack-agnostic interfaces for storage, retrieval, indexing
- remove all imports from prixie's services (recall.ai, calendar, meetings, etc.)
- memorium should be installable and runnable without prixie

### 0b. storage adapters
- postgres adapter (default, maps to existing schema)
- sqlite adapter (for local/single-user use)
- falkordb adapter (graph backend for memory nodes + associations + tags)
- redis adapter (for caching + graph)
- supabase adapter (existing implementation, refactored as an adapter)
- storage adapter interface: any system implements the same crud + query contract

### 0c. vector store adapters
- mem0 adapter (current default)
- pgvector adapter (postgres-native, no external service)
- pinecone adapter
- weaviate adapter
- qdrant adapter
- chroma adapter
- vector store interface: any system implements embed + search

### 0d. reference implementation
- one complete, working, standalone memorium in a chosen stack
- documented setup guide (install, configure, run)
- example: plug memorium into a simple chatbot to show it works without prixie

---

## phase 1: gui (the primary interface)

gui first. the gui is not a wrapper around an api. it is the primary way to interact with memorium.

### 1a. persona cards
- visual cards for each perspective (identity, memory count, weight/hierarchy bars)
- click a card → expand into persona detail view
- create/edit/delete personas
- visual identity (display name, avatar, tone description)

### 1b. knowledge graph
- d3 visualization of memory nodes + associations
- nodes sized by weight (identity core), colored by hierarchy (behavior drive)
- edges show association type and strength
- click a node → detail panel (tags, source, confidence, last recall, recall count)
- drag nodes to reposition, zoom/pan
- filter by tag, by weight range, by hierarchy range, by content type
- this is the centerpiece of the gui

### 1c. tag browser
- ao3-style tag sidebar
- canonical tag tree (parent/child hierarchy)
- aliases shown under each canonical tag
- click a tag → filter the knowledge graph to memories with that tag
- tag management: create, merge, set parent, add alias, set exclusion, set association
- fuzzy search across tags and aliases

### 1d. memory explorer
- tree view of memories within a persona
- sort by weight, by hierarchy, by confidence, by recency
- weight/hierarchy visualization bars
- edit weight and hierarchy via sliders (manual adjustment)
- view source, tags, associations, content (including multimodal)
- add/edit/delete memories
- bulk tag operations

### 1e. permissions matrix
- grid of personas × sources with toggle controls
- grant/revoke access per persona per source
- visual indicators for access level (read, write, read-write)
- bulk permission operations

### 1f. sharing flow diagram
- visual arrows between persona cards showing sharing rules
- one-way arrows (→), bidirectional arrows (↔)
- conditional sharing shown with a filter icon on the arrow
- click an arrow → configure sharing rule (tags, category, min weight, direction)
- add/remove sharing rules visually
- this is the explicit interface for cross-perspective access

### 1g. retrieval log
- every retrieval query logged with:
  - the query text
  - the persona that queried
  - retrieved memories (count + list)
  - component scores (semantic, tag match, hierarchy, weight, persona relevance, source confidence)
  - overall confidence score
  - decision (confident / uncertain / needs clarification / unavailable)
- filter by persona, by confidence level, by date
- "why was this retrieved?" expand → show all 6 signals and their weights
- this is the transparency layer — no black boxes

### 1h. memory decay dashboard
- view hierarchy decay across all memories
- see which memories are about to decay below threshold
- manually reinforce a memory (reset decay timer, boost hierarchy)
- decay rate configuration per persona

---

## phase 2: retrieval improvements

### 2a. adaptive weights
- retrieval weights (semantic 15%, tag 30%, etc.) should be tunable per persona
- some personas may rely more on semantic similarity, others on tag matching
- gui slider to adjust the weight distribution
- a/b testing: compare retrieval quality with different weight distributions

### 2b. temporal relevance
- "deadline friday" should have high hierarchy on wednesday but near-zero on saturday
- time-based hierarchy boosting: memories tagged with time-sensitive tags get boosted when relevant
- configurable temporal windows per tag

### 2c. association traversal depth
- currently retrieves direct associations only
- add configurable traversal depth (2-hop, 3-hop associations)
- with diminishing strength per hop
- prevent infinite loops with cycle detection

### 2d. retrieval caching
- cache frequent queries per persona
- invalidate cache on memory add/update/delete
- configurable cache ttl

---

## phase 3: multimodal expansion

### 3a. audio memory
- store audio clips as memories
- transcription stored alongside audio for searchable retrieval
- speaker diarization metadata

### 3b. video memory
- store video clips with timestamps
- key frame extraction for visual context
- transcript + visual description stored for retrieval

### 3c. code memory
- store code snippets with language, syntax tree metadata
- function/class signature extraction for semantic search
- dependency graph for code memories

### 3d. structured data
- store tabular data (csv, json) as memories
- column-level metadata for structured retrieval
- schema-aware search

---

## phase 4: portability

### 4a. export/import
- export a persona's full memory (with weights, hierarchies, tags, associations) as a portable format (json)
- import a persona from a portable format
- share personas between systems
- this is the "portable" in "standalone, portable"

### 4b. federation
- multiple memorium instances can share personas (with explicit consent)
- cross-system memory queries (with permissions)
- this is the long-term vision: memorium as a standard for agent memory

### 4c. sdk
- typescript sdk (reference)
- python sdk
- rust sdk (maybe)
- simple api: `memorium.recall(persona, query)`, `memorium.index(persona, fact)`, etc.

---

## phase 5: integration

### 5a. prixie integration (existing)
- memorium is already used by prixie for meeting memory
- this is the reference integration

### 5b. generic agent integration
- plugin/adapter for any agent system
- memory indexing from agent conversations
- retrieval as a context provider
- example integrations: langchain, autogen, crewai, custom agents

### 5c. human-facing integration
- memorium as a personal knowledge base (not just for agents)
- browser extension: save a page as a memory (with tags, weight, hierarchy)
- mobile app: quick capture of facts as memories
- this is memorium as a tool for humans, not just for ai agents

---

## phase 6: graph associations & cross-domain links

builds on: memory engine v1 (indexing with auto-association) and tag wrangler associations.
new: typed edges, multi-hop chains, weak edge preservation, cross-domain bridge recognition, negative link exclusions.

### 6a. typed associations
- extend schema v2 association table to support explicit edge types
- support standardized edge relation types: `caused_by`, `example_of`, `contrasts_with`, `similar_to`, `prerequisite_for`, `derived_from`, `commonly_cooccurs_with`, `metaphor_for`, `part_of`, `applies_to`, `reminds_me_of`
- support directional vs symmetric properties per relation type
- store metadata payload on association edges for rich relationship attributes

### 6b. associative distance & weak link preservation
- assign scalar associative distance / strength values to graph edges
- distinguish direct high-relevance links from weak or distant thematic associations
- preserve weak associations without automatic pruning so broad creative links survive
- decay association score gracefully based on distance steps during graph traversal

### 6c. association chains & multi-hop traversal
- implement multi-hop graph traversal algorithms (query → conference → public speaking → previous presentation → attendee → their research)
- apply attenuation factors per hop so signal decreases over path length
- cycle detection and max-hop boundaries to prevent infinite traversal loops
- expose hop path trace in retrieval metadata

### 6d. cross-domain associativity
- implement background pattern engine to recognize structural similarities across separate domains (e.g. music orchestration ↔ distributed systems orchestration)
- generate candidate `metaphor_for` and `similar_to` links spanning isolated domain tags
- index cross-domain bridges into tag wrangler and retrieval graph for unexpected creative recall

### 6e. negative associations
- support explicit negative association edges (`x not related to y`)
- block auto-association from repeatedly re-creating rejected or invalid links
- use negative associations as hard exclusion constraints during graph traversal and candidate expansion

---

## phase 7: temporal memory & provenance

builds on: schema v2 views and retrieval pipeline v2 logged scores.
new: valid time windows, coexisting contradiction resolution, observation provenance tracking, memory derivation lineage.

### 7a. temporal associativity & validity state
- add temporal validity bounds (`valid_from`, `valid_to`, `current_status`) to memory nodes and associations
- track evolving real-world facts over time (e.g. `works_at` company a 2023-2025 vs company b 2025-present)
- support point-in-time time-travel queries ("what was true on june 2024?")

### 7b. contradiction & competing memories
- allow conflicting facts to coexist in the graph without overwriting or destructive updates
- resolve competing memories dynamically at retrieval time using temporal validity + confidence scores
- surface explicit contradiction warning flags when active competing memories overlap

### 7c. provenance & source attribution
- tag every memory with explicit source provenance (`conversation`, `user_input`, `system_inference`, `document_import`)
- maintain separate confidence channels for explicit user-stated facts vs inferred or extracted memories
- expose provenance attributes in api responses and sandbox audit logs

### 7d. memory lineage
- build traceable lineage chain from raw observation/input through extraction steps to persona-specific interpretations
- link derived memories back to parent memory ids with transformation step records
- allow full inspection and rollback of persona interpretations back to root observations

---

## phase 8: advanced persona & scopes

builds on: persona permissions + sharing rules (one-way, bidirectional, conditional) and strict sandbox enforcement.
new: multi-tier scopes, persona-specific association topology, edge permissions, composite context weights, ephemeral promotion pipeline.

### 8a. memory scopes & boundary isolation
- establish structured scope hierarchy: `global`, `organization`, `project`, `household`, `user`, `persona`, `session`, `temporary`
- enforce strict scope-aware queries and memory creation boundaries
- prevent unauthorized cross-scope leakages across organizational or personal boundaries

### 8b. persona-specific associations
- decouple node storage from edge topology so personas share core memory nodes but maintain persona-specific edge sets
- persona a sees edge x → y while persona b sees edge x → z on the same underlying node x
- isolated persona association creation, weight overrides, and custom relation labels

### 8c. association permissions
- implement edge-level permission controls (e.g. persona a can see association x → y, while persona b can view nodes x and y but cannot see the association)
- evaluate association permissions dynamically during graph traversal
- restrict multi-hop traversal along unpermitted edges

### 8d. context-dependent weight matrix
- calculate composite memory weights combining global baseline weight + per-persona weight + active session context weight
- dynamically alter signal relevance based on user environment, active project context, or chat mode
- provide api parameter overrides for runtime context weights

### 8e. ephemeral memory pipeline
- implement multi-stage lifecycle pipeline: `working` → `session` → `candidate` → `persistent`
- define automated promotion rules based on repetition frequency, retrieval counts, and explicit user confirmation
- auto-expire and sweep unpromoted working and session memories after ttl expiration

---

## phase 9: memory lifecycle

builds on: memory decay service design and retrieval pipeline v2 scoring signals.
new: two-dimensional confidence/importance matrix, memory action classification, soft retrieval decay with reactivation, usage reinforcement.

### 9a. confidence vs importance dimensions
- split flat score into two independent orthogonal dimensions: confidence (certainty of truth) and importance (value to retain/act on)
- detect high importance + low confidence states to trigger proactive clarification prompts (`ask/verify`)
- store separate confidence and importance floating point values (0.0 to 1.0) on every memory node

### 9b. memory actions & intent classification
- classify memory intent into functional action categories: `informational`, `reminder`, `preference`, `constraint`, `instruction`, `goal`, `warning`, `relationship`, `hypothesis`
- tailor agent behavior based on action type (e.g. strict enforcement for `constraint`, tracking progress for `goal`)
- apply action-specific schema validation and retrieval boosting rules

### 9c. memory decay service implementation
- turn design into active service where decay reduces retrieval priority / ranking score while preserving memory existence
- configurable exponential/linear decay rates per scope, tag, or persona
- support memory reactivation: direct queries or explicit references restore decayed memory priority to full strength

### 9d. memory reinforcement & usage learning
- automatically reinforce memories based on access frequency, successful retrieval utility, and explicit positive feedback
- reduce decay speed or increase base importance for frequently recalled memories
- feed usage telemetry back into auto-association heuristics to refine edge weighting over time

---

## phase 10: retrieval engine & inspectability

builds on: retrieval pipeline v2 (6 weighted signals, logged scores) and 20+ api endpoints.
new: multi-mode combinable retrieval strategies, fully inspectable 'why did you remember this?' explanation chain.

### 10a. combinable associative retrieval modes
- support flexible combinations of retrieval modes in single recall requests: `exact`, `semantic`, `hierarchical`, `associative`, `temporal`, `causal`, `persona-aware`, `tag-aware`, `graph_traversal`
- parameterize query api to allow selective enabling and weighting of multiple mode pipelines simultaneously
- execute dynamic query planning based on input characteristics and active persona preferences

### 10b. inspectable retrieval chain ('why did you remember this?')
- generate human-readable explanations detailing the exact retrieval decisions and path traversed
- expose hop paths, matched signal scores, active temporal filters, confidence ratings, and scope checks
- provide dedicated `/api/memorium/explain` endpoint and gui expander showing complete transparent reasoning trace
