# memorium

> memory becomes a weighted, hierarchical, associative structure that knows what information is important, what it relates to, who it belongs to, and when it should matter.

memorium is a standalone, portable persona-based memory system. it exists within prixie but is designed to work independently. it is not an LLM memory layer. it is a structured context engine.

---

## the reframe: POV switching

memorium is not "a persona joining a meeting." it is switching perspective.

think of it like a shared laptop. your coworker sits down, switches to their account, opens their instagram. the laptop is the same. the apps are the same. but what they see, what they can access, what matters to them — all different. they're a different perspective.

memorium does the same thing, but instead of different people, it's different perspectives of you: student you, founder you, employee you, hobbyist you. the POV switch is rapid. one minute you're in a standup as employee you. the next you're joining a hackathon as hobbyist you. the system doesn't deploy "a new agent." it shifts perspective.

---

## the retrieval pipeline

traditional RAG:
```
documents → chunks → embeddings → similarity → context
```

prixie:
```
knowledge → human tags → tag wrangling → canonical concepts
→ hierarchy + associations → weights + confidence
→ persona sandbox → permissions + relevance
→ semantic retrieval → context
```

embeddings aren't thrown away. they're demoted from "the thing that understands the knowledge base" to one component of a much richer retrieval system.

when retrieval gets something wrong, a human can inspect why: "oh, this was retrieved because these tags were wrangled together, this concept is nested under that one, and this persona has a high relevance weight for it."

---

## tag wrangling (AO3-style)

inspired by archive of our own's open-source tag wrangling system. instead of requiring users to understand embeddings, vector similarity, metadata schemas, or rigid taxonomies, information is organized using tags in a way that feels natural.

### the problem

people are inconsistent when describing things. one person tags something "programming," another uses "coding," another writes "software development," and another uses "dev." in a traditional system those become four separate retrieval concepts. tag wrangling establishes that they belong to the same broader concept while preserving the original language.

### how it works

1. user tags a memory with "coding"
2. tag wrangler checks: is "coding" a canonical tag? no.
3. is "coding" an alias of a canonical tag? yes → "programming"
4. memory is tagged with canonical "programming" but original "coding" is preserved
5. confidence: 0.95 (alias match)

if no match is found, the system creates a new canonical tag (auto-wrangling). if the fuzzy match is uncertain, it suggests alternatives.

### tag properties

tags are more than simple labels. they have:

- **canonical name**: the official tag (e.g. "programming")
- **aliases**: synonyms, misspellings, abbreviations, translations, variants
- **parent/child**: hierarchy ("python" is child of "programming")
- **exclusions**: mutually exclusive tags ("fiction" excludes "non-fiction")
- **associations**: related tags with strength ("javascript" ↔ "web development" at 0.8)
- **persona relevance**: a tag's relevance weight can vary per persona
- **weight**: default weight for memories tagged with this tag

### tag merge

when two canonical tags are found to represent the same concept, they can be merged. all aliases, associations, and memory references are moved to the winner. the loser is deactivated.

---

## five layers of each perspective

### 1. identity + perspective
who this perspective IS and how they interpret the world. stable. doesn't drift.

### 2. memory (weighted, hierarchical, associative, multimodal)
what this perspective knows. memory nodes have:

- **weight** (0-1): identity core. does NOT decay. "i am a developer" = 0.95.
- **hierarchy** (0-1): behavior drive. decays exponentially. "deadline friday" = 0.9.
- **confidence** (0-1): how sure the system is this is accurate.
- **tags**: AO3-style wrangled tags for organization and retrieval.
- **content_type**: text, image, pdf, document, code, audio, video.
- **content_url**: file URL for multimodal content.
- **content_metadata**: file-specific metadata (page numbers, line ranges, etc.)

memory is multimodal. it stores images, PDFs, documents, and code — not just text. extracted text from files is stored for searchable retrieval.

### 3. contextual permissions
what this perspective can ACCESS. strictly enforced. no leaks. every access attempt is logged.

### 4. relevance
what this perspective CARES about. shaped by tag-persona relevance weights.

### 5. behavior
how this perspective ACTS. tone, initiative, question style, decision-making.

---

## underconfident retrieval

the system is underconfident by default. it asks to repeat or says it's unsure rather than overconfidently replying. no context drift.

confidence thresholds:
- **≥ 0.75**: confident — return results without caveat
- **≥ 0.45**: uncertain — return results but flag uncertainty
- **≥ 0.25**: needs clarification — ask the user to clarify
- **< 0.25**: unavailable — say "i don't have enough information"

the overall confidence is a weighted combination of:
- semantic similarity: 15% (demoted from ~100% in traditional RAG)
- tag match strength: 30% (the primary signal)
- hierarchy boost: 10%
- identity weight: 10%
- persona relevance: 20%
- source confidence: 15%

every retrieval is logged with its component scores for transparency.

---

## strict sandbox enforcement

no access to other persona's data unless explicitly given access via sharing rules. every access attempt is logged to the sandbox_access_log table.

- no sharing rules configured = fully sandboxed = only own perspective
- sharing rules must be explicitly configured (one-way, bidirectional, conditional)
- every cross-perspective memory access is checked against sharing rules
- denied access attempts are logged with the reason

the `/memorium/canvas` (future) will be the explicit interface for granting cross-perspective access.

---

## architecture

```
┌─────────────────────────────────────────────────┐
│                  frontend                        │
│  /memorium page                                   │
│  ├── D3 knowledge graph (neo4j-esque)            │
│  ├── tag filter sidebar (AO3-style)               │
│  ├── memory tree with weight/hierarchy bars      │
│  ├── permissions matrix                          │
│  ├── sharing flow diagram                        │
│  └── retrieval log (transparency)                │
└──────────────────────┬──────────────────────────┘
                       │ HTTP
┌──────────────────────┴──────────────────────────┐
│               backend (hono)                      │
│  /api/memorium/*                                  │
│  ├── memory CRUD + batch + transcript             │
│  ├── retrieval v2 (underconfident)               │
│  ├── tag wrangling + management                   │
│  ├── permissions + sharing                        │
│  └── decay cycle                                  │
├──────────────────────────────────────────────────┤
│                  services                         │
│  ├── memorium.ts (memory engine v1)              │
│  ├── memorium_retrieval_v2.ts (retrieval pipeline)│
│  ├── tag_wrangler.ts (AO3-style tag system)       │
│  ├── falkor_graph.ts (FalkorDB graph backend)     │
│  └── multimodal.ts (file storage + extraction)    │
├──────────────────────────────────────────────────┤
│              data stores                          │
│  ├── FalkorDB (graph: nodes, edges, tags)         │
│  ├── Supabase (metadata, permissions, sharing)   │
│  ├── Supabase Storage (multimodal files)          │
│  └── mem0 (vector embeddings, semantic search)    │
└──────────────────────────────────────────────────┘
```

---

## data model (v2)

### memory_nodes
- id, perspective_id, parent_id (nesting)
- key, value, category
- weight (0-1, identity core, no decay)
- hierarchy (0-1, behavior drive, exponential decay)
- confidence (0-1)
- tags TEXT[] (wrangled canonical tags)
- content_type (text/image/pdf/document/code/audio/video)
- content_url, content_metadata JSONB
- source, source_meeting_id
- recall_count, last_recalled, decay_rate
- created_at, updated_at

### canonical_tags
- id, canonical (unique), description
- parent_tag_id (hierarchy)
- category, weight (default for memories with this tag)
- is_active

### tag_aliases
- canonical_tag_id, alias, alias_type (synonym/misspelling/abbreviation/translation/variant)

### tag_exclusions
- tag_a_id, tag_b_id (mutually exclusive), reason

### tag_associations
- source_tag_id, target_tag_id, strength, association_type

### tag_persona_relevance
- tag_id, perspective_id, relevance_weight (0-1)

### memory_associations
- source_node_id, target_node_id, strength, association_type

### persona_permissions
- perspective_id, source_type, source_id, source_label, access_level

### persona_sharing
- source_perspective_id, target_perspective_id, direction, condition_tags, condition_category, min_weight, active

### memory_retrieval_confidence
- perspective_id, query, retrieved_count, confidence_score, decision
- semantic_score, tag_match_score, hierarchy_score, weight_score, persona_relevance_score

### sandbox_access_log
- perspective_id, target_perspective_id, memory_node_id, access_result, sharing_rule_id, timestamp

### multimodal_content
- perspective_id, memory_node_id, content_type, file_name, file_url, file_size, mime_type, content_hash, extracted_text, page_count, line_count, language, metadata

---

## graph backend: FalkorDB

FalkorDB (github.com/FalkorDB/FalkorDB) is a Redis-based graph database that uses a Cypher-like query language. it serves as the graph backend for memorium's memory structure.

- memory nodes → graph nodes with properties
- parent-child relationships → directed edges
- associations → weighted edges
- tag relationships → separate edge types (SYNONYM_OF, CHILD_OF_TAG, EXCLUDES, ASSOCIATED_WITH)

if FalkorDB is not available, the system falls back to Supabase SQL for graph queries.

---

## the visual GUI

the memory map is a neo4j-esque knowledge graph on the `/memorium` frontend page. not an artifact — a proper React component using D3.js force-directed simulation.

features:
- node radius = weight (identity core)
- node fill opacity = hierarchy (behavior drive)
- node color = category
- double-click to expand/focus (infinite recursive nesting)
- pan and zoom viewport
- tag filter sidebar (AO3-style with canonical tags and alias counts)
- collapsed nodes show child count badge
- retrieval transparency (click a node to see why it was retrieved)

---

## the interesting research question

can associative + nested + weighted retrieval be efficient enough to actually improve training/inference behavior, while exposing it through a visual system where you can literally see and manipulate why something gets prioritized?

instead of memory being a bucket of chunks, memory becomes a weighted, hierarchical, associative structure that knows what information is important, what it relates to, who it belongs to, and when it should matter.
