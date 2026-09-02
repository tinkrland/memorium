# under the hood

## the retrieval pipeline in detail

memorium's retrieval is not a single similarity search. it is a 7-step pipeline where each step contributes a weighted signal to the final confidence score.

### step 1: semantic search (15% of final score)

the query is embedded and searched against the vector store (mem0 by default). this returns the top-n candidates by cosine similarity.

this is the only step that uses embeddings. in traditional rag, this is 100% of the retrieval. in memorium, it is demoted to 15%. embeddings are good at "this text is similar to that text" but terrible at "this is who i am" or "this is what matters right now."

```
query embedding → vector store → top-n candidates
                                    ↓
                          semantic_score (0-1)
```

### step 2: tag match (30% of final score)

the query is checked against canonical tags and their aliases. if the query matches a tag that a memory has, that memory gets a tag match score.

this is the primary signal. tags are human-assigned and human-wrangled. they encode what the memory is actually about, not just what words it contains.

```
query → tag wrangler → canonical tags
                         ↓
              match against memory tags
                         ↓
                  tag_match_score (0-1)
```

multi-tag matches compound: a memory tagged with 3 matching tags scores higher than one with 1 matching tag.

### step 3: hierarchy boost (10% of final score)

memories with high hierarchy (behavior drive) get a boost. if the query is about something actionable, high-hierarchy memories should surface first.

```
memory.hierarchy → hierarchy_boost_score (0-1)
```

this is why "deadline friday" surfaces when you ask about deadlines even if the semantic similarity is low — the hierarchy is high, so it gets boosted.

### step 4: identity weight (10% of final score)

memories with high weight (identity core) get a boost for identity-related queries. "who am i?" type queries should return high-weight memories.

```
memory.weight → weight_score (0-1)
```

### step 5: persona relevance (20% of final score)

each tag has a per-persona relevance weight. "programming" might be highly relevant to the "developer" persona (0.9) but barely relevant to the "student" persona (0.2). this signal adjusts retrieval based on which perspective is querying.

```
tag × persona → persona_relevance_score (0-1)
```

### step 6: source confidence (15% of final score)

each memory has a confidence score based on where it came from and how many times it's been corroborated. a memory from a reliable source that's been confirmed by multiple other memories scores higher.

```
memory.confidence → source_confidence_score (0-1)
```

### step 7: combination + threshold gate

```
final_score = (semantic × 0.15)
            + (tag_match × 0.30)
            + (hierarchy × 0.10)
            + (weight × 0.10)
            + (persona_relevance × 0.20)
            + (source_confidence × 0.15)
```

the final score gates output:
- ≥ 0.75 → confident → return without caveat
- ≥ 0.45 → uncertain → return but flag: "i'm not fully sure about this"
- ≥ 0.25 → needs clarification → ask user to clarify
- < 0.25 → unavailable → "i don't have enough information"

every retrieval logs all 6 component scores + the final score + the decision to `memory_retrieval_confidence`.

---

## memory indexing in detail

when a fact enters memorium:

### extraction

facts are extracted from various sources:
- **transcripts**: prixie processes meeting transcripts and extracts factual statements
- **user input**: the user directly adds a memory via the gui
- **inference**: the system infers a fact from existing memories (e.g., "if i am a developer and i prefer python, i probably know about pip")
- **shared**: a fact shared from another persona via sharing rules

### assignment

each fact is assigned to a perspective. this determines which sandbox it lives in.

### tagging

tags are assigned by the user or extracted from the content. tags are wrangled to canonical tags via the tag wrangler.

### weighting

| signal | initial weight | initial hierarchy |
| --- | --- | --- |
| mentioned multiple times in a transcript | 0.5-0.8 | — |
| mentioned once, seems central | 0.3-0.5 | — |
| mentioned once, seems peripheral | 0.1-0.3 | — |
| action-oriented ("deadline", "todo", "must") | — | 0.7-0.9 |
| time-sensitive ("tomorrow", "friday", "urgent") | — | 0.8-0.95 |
| passive ("i believe", "i prefer") | — | 0.1-0.3 |
| identity statement ("i am", "my name is") | 0.8-0.95 | — |

weights and hierarchies are user-adjustable via the gui sliders.

### association

after indexing, the system checks for associations:
- does this memory share tags with existing memories? → tag-based association (strength = tag overlap)
- does this memory share a category? → category-based association (strength = 0.3 default)
- is this memory temporally close to another? → temporal association (strength = 1/days_apart)

associations are bidirectional. both memories get linked.

---

## memory decay in detail

### what decays

only hierarchy decays. weight (identity) does not. you don't stop being a developer because you haven't mentioned it in a while.

### decay formula

```
current_hierarchy = original_hierarchy × e^(-decay_rate × days_since_last_recall)
```

default decay rate: 0.1 per day (configurable per persona)

example:
- "deadline friday" indexed on monday with hierarchy 0.9
- on friday (4 days later, not recalled): 0.9 × e^(-0.1 × 4) = 0.9 × 0.67 = 0.60
- on saturday (5 days, recalled on friday): recall resets the clock, so on saturday: 0.9 × e^(-0.1 × 1) = 0.9 × 0.90 = 0.81
- if never recalled, after 30 days: 0.9 × e^(-0.1 × 30) = 0.9 × 0.05 = 0.045 (essentially gone from behavior)

### recall reinforcement

every time a memory is retrieved:
- recall_count += 1
- last_recalled = now
- hierarchy decay clock resets
- if recall_count > threshold: weight gets a small boost (frequently used = more core to identity)

### confidence adjustment

- if a new memory confirms an existing one: confidence += 0.05 (cap 0.95)
- if a new memory contradicts an existing one: confidence -= 0.1 (floor 0.1), flag for review
- if a memory has not been recalled in 90+ days and confidence < 0.3: suggest archival

---

## tag wrangling in detail

### the wrangling algorithm

```
input: user_tag
  ↓
1. is user_tag already canonical? → use it. confidence: 1.0
  ↓ no
2. is user_tag an alias of a canonical tag? → use canonical. confidence: 0.95
  ↓ no
3. fuzzy match against all canonical tags + aliases
   - if best match ≥ 0.85: suggest canonical, ask to confirm. confidence: 0.85
   - if best match ≥ 0.70: suggest top 3, let user pick. confidence: 0.70
   - if best match < 0.70: create new canonical tag. confidence: 0.50
  ↓
4. store with canonical tag, preserve original user_tag
```

### fuzzy matching

uses a combination of:
- levenshtein distance (edit distance)
- jaro-winkler similarity (good for short strings)
- phonetic matching (metaphone: "colour" and "color" sound the same)

the highest score across all three methods is used.

### tag merge

when two canonical tags are found to mean the same thing:
1. user selects a "winner" and a "loser"
2. all aliases from the loser are moved to the winner
3. all tag associations from the loser are moved to the winner
4. all memory references (the tag column in memory_nodes) are updated
5. the loser's canonical tag is deactivated (is_active = false)
6. the loser is not deleted — this preserves audit history
7. a merge log entry is created

---

## technical implementation of advanced concepts

### 1. cross-domain associativity

cross-domain associativity detects hidden structural relationships across disjoint domains (e.g. software engineering and gardening).

#### detection algorithm
1. **tag overlap calculation (jaccard index)**:
   ```
   jaccard(a, b) = |tags(a) ∩ tags(b)| / |tags(a) ∪ tags(b)|
   ```
2. **semantic bridge similarity**:
   abstract concept embeddings `v_a` and `v_b` are calculated from memory contents. cosine distance determines semantic alignment:
   ```
   sim_sem(a, b) = (v_a · v_b) / (||v_a|| * ||v_b||)
   ```
3. **metaphor detection score**:
   metaphor mapping evaluates structural relational isomorphism across domain ontologies:
   ```
   cross_domain_score = w_tag * jaccard(a, b) + w_sem * sim_sem(a, b) + w_meta * metaphor_score(a, b)
   ```
   where default weights are `w_tag = 0.35`, `w_sem = 0.35`, `w_meta = 0.30`. cross-domain edges are linked when `cross_domain_score ≥ 0.45`.

### 2. typed associations

associations between memory nodes carry explicit semantic edge types represented by the `association_type` enum.

#### schema & enum definition
`association_type` enum:
- `caused_by`
- `example_of`
- `contrasts_with`
- `similar_to`
- `prerequisite_for`
- `derived_from`
- `commonly_cooccurs_with`
- `metaphor_for`
- `part_of`
- `applies_to`
- `reminds_me_of`

#### edge structure
```sql
create type association_type as enum (
  'caused_by', 'example_of', 'contrasts_with', 'similar_to',
  'prerequisite_for', 'derived_from', 'commonly_cooccurs_with',
  'metaphor_for', 'part_of', 'applies_to', 'reminds_me_of'
);

alter table memory_associations add column type association_type not null default 'similar_to';
```

### 3. associative distance

every association edge stores a float `strength ∈ [0.0, 1.0]`. associative distance is defined as `distance = 1.0 - strength`.

#### threshold classification logic
- **strong relevance** (`strength ≥ 0.7`): primary traversal path. full signal weight passed without attenuation (`multiplier = 1.0`).
- **interesting association** (`0.2 ≤ strength < 0.7`): secondary traversal path. signal weight attenuated (`multiplier = 0.5 * strength`).
- **noise** (`strength < 0.2`): low signal association (`multiplier = 0.1`). stored permanently in graph database for completeness; skipped during default traversal unless `graph_traversal` mode is enabled. never hard pruned.

### 4. association chains

traversal through multi-hop edge paths with diminishing signal strength per hop.

#### traversal algorithm
```python
def traverse_chain(node, depth, current_strength, visited, max_depth=3, min_thresh=0.15, hop_decay=0.8):
    if depth >= max_depth or current_strength < min_thresh or node.id in visited:
        return []
    visited.add(node.id)
    results = []
    for edge in node.get_outgoing_edges():
        next_strength = current_strength * edge.strength * hop_decay
        if next_strength >= min_thresh and edge.target_id not in visited:
            results.append((edge.target_id, next_strength, depth + 1))
            results.extend(traverse_chain(edge.target, depth + 1, next_strength, visited, max_depth, min_thresh, hop_decay))
    return results
```

### 5. temporal associativity

memories and associations contain temporal validity windows (`valid_from` and `valid_until`) and transition across a lifecycle state machine.

#### lifecycle states & transitions
- `discovered`: newly extracted fact awaiting first confirmation or initial retrieval.
- `active`: valid fact where `valid_from <= current_time <= (valid_until OR ∞)`.
- `dormant`: expired fact where `current_time > valid_until` or `days_since_last_recall > dormancy_threshold` (e.g. 60 days).
- `abandoned`: explicitly invalidated or confidence reduced below `abandonment_floor` (`0.10`).

```
[discovered] ──(validate)──> [active] ──(expired/inactive)──> [dormant]
     │                          │                                │
     └──(invalidate/low conf)───┴───────> [abandoned] <──────────┘
```

### 6. contradiction and competing memories

when a new memory contradicts an existing memory, memorium preserves both and constructs a competing claim.

#### contradiction detection algorithm
1. target candidate memories sharing entities/tags via key overlap.
2. calculate semantic embedding cosine similarity: `cos_sim(m_new, m_old) ≥ 0.75`.
3. evaluate predicate negation / value mismatch (e.g. `location = "new york"` vs `location = "london"`).
4. on conflict: insert `m_new` without overwriting `m_old`.
5. insert edge `contrasts_with` between `m_old` and `m_new`.
6. score relative confidence:
   ```
   effective_confidence(m) = confidence(m) * (1.0 - 0.5 * max_competing_confidence)
   ```
   if `abs(confidence(m_new) - confidence(m_old)) < 0.15`, flag contradiction for user review in the gui.

### 7. provenance

every memory and association tracks full lineage metadata to ensure auditability.

#### schema fields
- `source_type`: enum (`user_explicit`, `user_inferred`, `transcript`, `system_inferred`, `shared`)
- `source_id`: string (reference to transcript id, chat message id, or rule id)
- `source_date`: timestamp
- `confidence_origin`: enum (`explicit`=1.0, `corroborated`=0.85, `inferred`=0.60)
- `transformation_log`: json array of processing steps: `[{"step": "extraction", "timestamp": "...", "agent": "..."}]`

### 8. memory lineage

lineage is maintained as a linked list / directed acyclic graph (dag) referencing parent derivation steps.

#### data structure
`memory_nodes` and `memory_associations` store `parent_lineage_id` pointing to the antecedent memory node or transformation event.

#### lineage traversal query
```python
def get_memory_lineage(node_id):
    chain = []
    curr = get_node(node_id)
    while curr and curr.parent_lineage_id:
        parent = get_node(curr.parent_lineage_id)
        chain.append({
            "child_id": curr.id,
            "parent_id": parent.id,
            "transformation": curr.transformation_log
        })
        curr = parent
    return chain
```

### 9. negative associations

negative associations represent explicit disassociations, rejections, or logical incompatibilities between memories.

#### edge representation
- `association_type = 'contrasts_with'` or `is_negative = true`.
- negative edge strength `s_neg ∈ (0, 1]`.

#### retrieval filter rule
during path traversal in retrieval queries, any path containing a negative edge receives a multiplier of `0.0` (hard exclude) or penalty `path_score *= (1.0 - s_neg)`. explicit user rejection of a retrieved association automatically creates a negative edge with `s_neg = 1.0`.

### 10. persona-specific associations

edge definitions and strengths are scoped per persona, allowing different perspectives to interpret the graph differently.

#### data model & query filter
`association_visibility` table:
```sql
create table association_visibility (
  id text primary key,
  persona_id text not null references personas(id),
  association_id text not null references memory_associations(id),
  custom_type association_type,
  custom_strength float,
  can_see boolean default true
);
```
query-time filter resolves effective edge attributes:
```sql
select 
  a.id,
  coalesce(v.custom_type, a.type) as effective_type,
  coalesce(v.custom_strength, a.strength) as effective_strength
from memory_associations a
left join association_visibility v 
  on a.id = v.association_id and v.persona_id = :current_persona
where coalesce(v.can_see, true) = true;
```

### 11. context-dependent weights

memory weight is dynamically computed as a function of global weight, persona relevance, and active session context tags.

#### formula
```
effective_weight(m, persona, context) = base_weight(m) × persona_relevance(m.tags, persona) × context_boost(m.tags, context)
```
where:
```
context_boost(m_tags, c_tags) = 1.0 + 0.5 × (|m_tags ∩ c_tags| / max(1, |c_tags|))
```

### 12. memory decay formulas and priority ranking

hierarchy decay governs behavior priority ranking without deleting underlying facts from storage.

#### decay equation
```
current_hierarchy = original_hierarchy × e^(-decay_rate × days_since_last_recall)
```
- decay modifies ranking order in the retrieval pipeline (step 3: hierarchy boost).
- memory nodes with `current_hierarchy` near `0.0` remain intact in postgres/falkordb.
- recall event sets `days_since_last_recall = 0`, resetting `current_hierarchy` to `original_hierarchy`.

### 13. memory reinforcement

frequent retrieval strengthens memory weight over time.

#### formula & thresholding
on retrieval: `recall_count += 1`.
if `recall_count > threshold` (default `threshold = 5`):
```
boosted_weight = min(1.0, original_weight + α × ln(1 + recall_count - threshold))
```
where `α = 0.05`.

### 14. memory scopes and inheritance

memories exist within hierarchical scopes that govern access and visibility across organizational layers.

#### scope enum
`global` → `user` → (`household` | `project` | `organization`) → `persona` → (`session` | `temporary`).

#### inheritance resolution
queries at scope `persona` automatically inherit accessible memories from parent scopes (`user`, `global`). narrower scope rules override broader parent definitions when conflicting properties exist.

### 15. ephemeral memory promotion pipeline

memories move through four distinct tiers based on importance and recall frequency.

#### memory tiers
1. `working`: held in ram during an active conversational turn; lost unless written to session.
2. `session`: stored in temporary session storage; cleared upon session teardown.
3. `candidate`: stored in database with ttl (default 7 days).
4. `persistent`: stored permanently in graph database with no ttl.

#### promotion rule
`candidate` → `persistent` when:
```
importance_score ≥ 0.70  OR  recall_count ≥ 3 (within ttl window)
```
if ttl expires without satisfying promotion rules, candidate memory is purged.

### 16. confidence vs importance matrix

confidence (accuracy signal) and importance (significance signal) are stored in separate columns in `memory_nodes`.

#### 2x2 retrieval matrix
| | high importance (≥0.6) | low importance (<0.6) |
| --- | --- | --- |
| **high confidence (≥0.6)** | core fact: surface directly in retrieval without caveat | minor detail: keep in background, surface only on exact tag match |
| **low confidence (<0.6)** | unverified critical: surface with caveat flag for user verification | low signal: suppress entirely from retrieval results |

### 17. memory actions and constraint enforcement

memories can encode actions that trigger runtime behavior checks prior to system execution.

#### action_type enum
`informational`, `reminder`, `preference`, `constraint`, `instruction`, `goal`, `warning`, `relationship`, `hypothesis`.

#### constraint execution hook
before performing external side effects (e.g. sending emails, scheduling events):
1. query active memories with `action_type = constraint`.
2. check payload rules against planned action parameters (e.g. `never send email before 09:00`).
3. if constraint condition fails, block execution and return actionable error.

### 18. association permissions and edge sandboxing

sandboxing is enforced at both node and edge levels using explicit permission checking.

#### edge permission schema
`association_visibility` table records `(persona_id, source_node_id, target_node_id, can_see)`.

#### traversal filter algorithm
during graph traversal for `persona_id`:
1. verify `persona_id` can see `source_node`.
2. verify `persona_id` can see `target_node`.
3. query `association_visibility`: if `can_see = false`, prune edge from graph traversal.

### 19. associative retrieval modes

retrieval requests accept a `retrieval_mode` parameter (bitmask or array of mode flags) to customize query traversal.

#### retrieval modes
- `exact`: string and key exact lookup.
- `semantic`: vector cosine similarity search.
- `hierarchical`: parent-child scope tree filtering.
- `associative`: multi-hop edge traversal via graph database.
- `temporal`: validity window (`valid_from`/`valid_until`) filtering.
- `causal`: traversal restricted to `caused_by`, `prerequisite_for`, and `derived_from` edge types.
- `persona_aware`: persona tag relevance and edge visibility filtering.
- `tag_aware`: canonical tag and alias expansion.
- `graph_traversal`: attenuated multi-hop depth traversal.

### 20. user-visible retrieval explanations

retrieval operations record human-readable explanation chains to answer "why did you remember this?".

#### schema
```sql
create table retrieval_explanation (
  id text primary key,
  query text not null,
  persona_id text not null references personas(id),
  retrieved_node_id text not null references memory_nodes(id),
  explanation_chain jsonb not null,
  confidence_score float not null,
  created_at timestamp default now()
);
```

#### explanation_chain format
```json
[
  {
    "step": 1,
    "from_node": "query: python refactoring",
    "edge_type": "tag_match",
    "to_node": "memory: clean code guidelines",
    "score": 0.88,
    "rationale": "matched canonical tag 'programming'"
  },
  {
    "step": 2,
    "from_node": "memory: clean code guidelines",
    "edge_type": "metaphor_for",
    "to_node": "memory: tree pruning techniques",
    "score": 0.72,
    "rationale": "cross-domain metaphor association between codebase maintenance and horticulture"
  }
]
```
gui renders `explanation_chain` as an expandable tree component in the transparency panel.
