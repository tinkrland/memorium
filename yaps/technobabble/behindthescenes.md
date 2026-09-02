# behind the scenes

## how memorium indexes a memory

1. a fact arrives (from a transcript, user input, inference, or shared from another persona)
2. the fact is assigned to a perspective (which persona does this belong to?)
3. tags are extracted or assigned by the user (human tags, not auto-generated)
4. tags are wrangled: "coding" → canonical "programming" (alias match, confidence 0.95)
5. weight is assigned: how core is this to the persona's identity? (default 0.3, user-adjustable)
6. hierarchy is assigned: how much does this drive behavior? (default 0.2, user-adjustable)
7. confidence is set: how sure are we this is accurate? (default 0.5, adjusts with corroboration)
8. associations are auto-detected: does this relate to existing memories? (shared tags, shared category)
9. the memory is stored in the graph backend (falkordb) + metadata in the relational db (supabase)
10. the memory is embedded and stored in the vector store (mem0) for semantic search

## how memorium retrieves a memory

1. a query comes in with a persona context ("which perspective am i?")
2. the query is embedded for semantic search
3. semantic search runs against the vector store (mem0) — returns top-n candidates
4. tag matching: does the query match any canonical tags or aliases?
5. hierarchy boost: memories with high hierarchy get boosted (they drive behavior)
6. weight filter: for identity-sensitive queries, only high-weight memories are considered
7. persona relevance: how relevant is this tag to this specific persona?
8. source confidence: how confident are we in each candidate?
9. all six signals are combined with their weights:
   - semantic: 15%
   - tag match: 30%
   - hierarchy boost: 10%
   - identity weight: 10%
   - persona relevance: 20%
   - source confidence: 15%
10. the combined confidence score gates the output:
    - ≥ 0.75 → confident → return results
    - ≥ 0.45 → uncertain → return with a caveat
    - ≥ 0.25 → needs clarification → ask the user
    - < 0.25 → unavailable → "i don't have enough information"
11. every step is logged to the retrieval confidence table for inspection

## how memorium handles a pov switch

1. user selects a perspective (or the system infers it from context)
2. the current persona context is loaded: identity, permissions, config
3. all subsequent queries are scoped to this persona's sandbox
4. no cross-perspective data is accessible unless sharing rules are configured
5. new memories are indexed under this persona's identity
6. retrieval uses this persona's tag relevance weights
7. behavior (tone, initiative, question style) follows this persona's config
8. the switch is instant — no reload, no re-deploy, just a context shift

## how tag wrangling works in practice

1. user tags a memory with "coding"
2. the tag wrangler checks: is "coding" a canonical tag? → no
3. is "coding" an alias of a canonical tag? → yes → "programming"
4. the memory is tagged with canonical "programming" but original "coding" is preserved
5. confidence: 0.95 (alias match)
6. if no match: fuzzy matching against existing canonical tags
   - if fuzzy match is strong (≥ 0.85): suggest the canonical tag, ask to confirm
   - if fuzzy match is weak: create a new canonical tag (auto-wrangling)
7. if two canonical tags are found to mean the same thing: tag merge
   - all aliases, associations, and memory references move to the winner
   - the loser is deactivated (not deleted — preserves history)

## how sandbox enforcement works

1. a retrieval query comes in for persona A
2. the system checks: does persona A have access to this memory?
3. is this memory in persona A's own sandbox? → yes → allow
4. is this memory in persona B's sandbox? → check sharing rules
5. is there a sharing rule from B → A?
   - no → deny. log to sandbox_access_log with reason "no sharing rule"
   - yes → is the sharing condition met? (tags, category, min weight)
     - no → deny. log with reason "condition not met"
     - yes → allow. log with sharing_rule_id
6. every access attempt (allowed or denied) is logged to the audit trail
7. denied attempts include the reason for denial

## how cross-domain association is detected in practice

1. a user indexes a memory about codebase refactoring ("cleaning technical debt in legacy code").
2. the tag wrangler assigns canonical tags `programming` and `maintenance`.
3. background associative worker evaluates new memory against existing graph nodes across different categories/domains.
4. worker finds a memory in domain `gardening`: "pruning overgrown branches to promote fruit growth" tagged with `maintenance` and `pruning`.
5. tag overlap score: `jaccard({programming, maintenance}, {gardening, maintenance, pruning}) = 1 / 4 = 0.25`.
6. semantic bridge check computes vector cosine similarity between abstract descriptions of both actions (`sim = 0.82`).
7. metaphor detection engine evaluates structural isomorphism ("removing dead elements to improve overall system health").
8. weighted combination yields `cross_domain_score = 0.35 * 0.25 + 0.35 * 0.82 + 0.30 * 0.78 = 0.609`.
9. because score `0.609 ≥ 0.45`, an association edge is created with `association_type = metaphor_for` and `strength = 0.61`.
10. when querying for refactoring strategies later, memorium can surface gardening pruning metaphors as creative analogies.

## how a contradiction is handled when discovered in practice

1. user says "i moved to new york in august 2026." system indexes memory M1: `location = "new york"`, `valid_from = 2026-08-01`, `confidence = 0.90`.
2. two weeks later, user mentions "i live in london."
3. contradiction detector runs: semantic similarity between M1 and new statement M2 is high (`0.81`), both target user primary location, but values conflict (`new york` vs `london`).
4. memorium does NOT overwrite M1 with M2.
5. system creates new memory node M2: `location = "london"`, `confidence = 0.85`.
6. system creates a `contrasts_with` association edge between M1 and M2.
7. temporal state manager updates M1's `valid_until` to `2026-08-31` and sets M2's `valid_from` to `2026-09-01`.
8. relative confidence calculation flags M1 as potentially dormant.
9. if retrieval asks "where do i live?", current timestamp matches M2's validity window, returning "london".
10. query "where did i live in august 2026?" returns M1 ("new york"), preserving accurate temporal history without data destruction.

## how an ephemeral memory gets promoted to persistent in practice

1. during a conversation, user mentions "i dislike meetings on monday mornings."
2. memory engine creates node M in `working` memory (RAM layer).
3. turn finishes; system marks M as potentially actionable. M is saved to `session` tier store.
4. session ends; evaluator evaluates M: `importance = 0.75` (high constraint signal), `recall_count = 1`.
5. because `importance ≥ 0.4`, M is promoted to `candidate` tier with a 7-day TTL expiration.
6. over the next 3 days, user asks twice about weekly scheduling; retrieval fetches M, incrementing `recall_count` to 3.
7. background promotion pipeline evaluates candidate memories:
   - criteria check: `importance (0.75) ≥ 0.70` AND `recall_count (3) ≥ 3`.
8. promotion triggers: TTL is removed, node is converted to `persistent` scope, and graph edges are indexed in FalkorDB and Postgres.

## how a 'why did you remember this?' explanation is generated in practice

1. user queries "what should i prepare for the upcoming python sprint?".
2. retrieval engine executes multi-hop graph search and surfaces memory M: "never deploy un-refactored code without tests".
3. user clicks "why did you remember this?" in the gui transparency panel.
4. explanation generator fetches the recorded trace from `retrieval_explanation` table for query execution ID.
5. generator inspects traversal hops:
   - hop 1: query matched canonical tag `programming` (score 0.90).
   - hop 2: tag `programming` traversed `applies_to` edge to node "python refactoring" (edge strength 0.85).
   - hop 3: node "python refactoring" traversed `prerequisite_for` edge to node "never deploy un-refactored code without tests" (edge strength 0.80).
6. system constructs a JSON hop tree and formats natural language rationale for each step.
7. gui renders an interactive expandable tree component displaying:
   `query → [tag match: programming] → [applies_to] → python refactoring → [prerequisite_for] → constraint rule`.

## how persona-specific associations produce different views of the same graph

1. shared node N1 ("rust programming language") and shared node N2 ("memory management") exist in the global graph.
2. persona 'developer' queries the graph:
   - lookup checks `association_visibility` for persona 'developer'.
   - finds edge override: `association_type = prerequisite_for`, `strength = 0.95`, `can_see = true`.
   - 'developer' persona sees a direct, strong causal relationship driving software architecture choices.
3. persona 'casual enthusiast' queries the same graph:
   - lookup checks `association_visibility` for persona 'casual enthusiast'.
   - finds edge override: `association_type = reminds_me_of`, `strength = 0.30`, `can_see = true`.
   - 'casual enthusiast' sees a low-priority background association.
4. persona 'executive' queries the graph:
   - `association_visibility` record has `can_see = false`.
   - 'executive' persona graph view completely omits the edge between N1 and N2 to keep workspace uncluttered.

## how negative associations prevent bad retrieval in practice

1. user previously searched for "apple" meaning the fruit, but retrieval mistakenly returned memory nodes related to "apple inc. stock prices".
2. user clicked "not relevant / reject association" in the GUI on the candidate edge between `apple` and `financial_stocks`.
3. memorium creates a negative association edge: `association_type = contrasts_with`, `is_negative = true`, `strength = 1.0`.
4. next time user queries "fresh fruits including apple", retrieval algorithm expands graph paths from tag `apple`.
5. graph traversal engine reaches edge (`apple` → `financial_stocks`); detects `is_negative = true`.
6. path score multiplier is set to `0.0`, instantly pruning all paths leading through financial stocks nodes.
7. retrieval returns clean fruit-related memories, successfully preventing irrelevant context contamination.
