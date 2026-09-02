# about

memorium is a standalone, portable, persona-based memory system. it exists within prixie but is designed to work independently. it is not an LLM memory layer. it is a structured context engine.

but more accurately: memorium is a personal knowledge graph with memory semantics.

a normal knowledge graph mostly cares about "what is connected to what?" memorium cares about "what is connected to what, how strongly, why, when, according to whom, in what context, for which persona, with what confidence, and should this connection affect retrieval right now?"

that's where weighting + hierarchy + associations + tag wrangling + provenance + persona sandboxing + contextual retrieval stops being "better rag" and becomes its own architecture.

## the reframe: POV switching

memorium is not "a persona joining a meeting." it is switching perspective.

think of it like a shared laptop. your coworker sits down, switches to their account, opens their instagram. the laptop is the same. the apps are the same. but what they see, what they can access, what matters to them — all different. they're a different perspective.

memorium does the same thing, but instead of different people, it's different perspectives of you: student you, founder you, employee you, hobbyist you. the POV switch is rapid. one minute you're in a standup as employee you. the next you're joining a hackathon as hobbyist you. the system doesn't deploy "a new agent." it shifts perspective.

## what it is not

- it is not a vector database. it uses vectors, but they are one component of a much richer retrieval system.
- it is not a chatbot memory. it does not store conversation history. it stores structured knowledge.
- it is not a note-taking tool. it does not summarize. it indexes, weights, and retrieves.
- it is not coupled to prixie. prixie uses it, but memorium is designed to work standalone with any system.
- it is not "better rag." rag retrieves documents by similarity. memorium retrieves knowledge by weighted, typed, temporal, persona-aware, provenance-tracked associations.

## what makes it different

### the foundations (already designed)

1. **two independent axes of memory.** weight (how core something is to identity) and hierarchy (how much it drives behavior). these are not the same thing. "i am a developer" is high weight (it's who i am) and high hierarchy (it drives what i do). "the exam is tomorrow" is low weight (not part of my identity) but high hierarchy (it's all i'm thinking about).

2. **AO3-style tag wrangling.** instead of requiring rigid taxonomies or embeddings expertise, information is organized using tags the way humans naturally describe things. synonyms, misspellings, abbreviations — all wrangled to canonical concepts.

3. **human-legible retrieval.** when retrieval gets something wrong, you can inspect why. every retrieval is logged with component scores. no black box.

4. **sandboxed by default.** personas are isolated. sharing is opt-in, per-memory, conditional. no leaks unless you explicitly configure them.

5. **underconfident by design.** the system defaults to uncertainty. it asks to repeat, says it's unsure, rather than overconfidently replying. no context drift.

6. **GUI first.** the visual interface is the primary way to interact with memorium. personas are visual entities. memory is visualized as weighted, hierarchical structures. permissions are a matrix. sharing is a flow diagram. the GUI is not a wrapper — it is the interface.

7. **stack-agnostic.** memorium does not assume your database, backend, frontend, or language. it defines a data model and a retrieval pipeline. you implement it in whatever you already use.

### the deeper layer (the 20 concepts)

the foundations make memorium better than flat vector search. but the deeper layer makes it something genuinely new:

8. **cross-domain associativity.** memorium recognizes that "orchestration" in music and "orchestration" in distributed systems share an underlying concept — not because they're semantically identical, but because the same pattern appears in different contexts. humans constantly do this kind of weird associative recall. memorium should too.

9. **typed associations.** not every relationship is just "related to." associations have types: caused_by, example_of, contrasts_with, metaphor_for, prerequisite_for, derived_from, reminds_me_of, and more. some are user-created, some are inferred. the type changes how retrieval uses the connection.

10. **associative distance.** not all associations are equally strong. memorium distinguishes between "strong relevance" and "interesting association." weak associations aren't pruned — the weird, distant connection is sometimes exactly what makes memory useful.

11. **association chains.** retrieval doesn't stop at the first relevant memory. it traverses outward: query → conference planning → public speaking → your 2024 presentation → alex attended → alex works in your target field. 2nd and 3rd degree connections get pulled in when they're worth it.

12. **temporal associativity.** relationships change over time. "alice works at company A" was true 2023-2025. now she's at company B. interests get discovered, become active, go dormant, get abandoned. memories have temporal state, not just true/false.

13. **contradiction and competing memories.** when facts conflict, memorium doesn't silently overwrite. "alice likes jazz" (confidence .71, valid 2021-2024) and "alice dislikes jazz" (confidence .83, valid 2025-present) can both exist. the system presents the most temporally relevant claim and flags the contradiction.

14. **provenance.** every memory knows where it came from: was it explicitly stated by the user? inferred by the model? corroborated by multiple sources? there's a massive difference between "user said this" and "model guessed this from three other memories."

15. **memory lineage.** you can trace the chain: original observation → normalized memory → canonical tag → derived association → persona-specific interpretation. when you ask "why does memorium think this is relevant?" you get a real answer, not a cosine similarity score.

16. **negative associations.** "x is NOT related to y" or "x avoid associating with y." when the user rejects an association, memorium learns and stops surfacing it. the graph has negative edges.

17. **persona-specific associations.** the same graph produces different edges per persona. your career persona sees "machine learning → career → resume → jobs." your technical persona sees "machine learning → research → papers → experiments." the underlying knowledge doesn't duplicate — the interpretation layer changes.

18. **context-dependent weights.** a memory doesn't have one global weight. "user is learning spanish" = global importance .62, travel assistant .94, language tutor .99, coding assistant .08. relevance is a function of persona + context, not a static number.

19. **memory decay + reinforcement.** decay affects retrieval priority, not existence. memories fade from prominence but stay available. a new interaction can reactivate them. and if something keeps getting referenced, its importance increases — importance becomes partly learned from usage.

20. **memory scopes.** beyond personas: global, user, household, project, organization, persona, session, temporary. "this project uses supabase" belongs to the project scope, not the user's personal memory.

21. **ephemeral memory.** not everything deserves persistence. working memory → session memory → candidate memory → persistent memory. the agent temporarily remembers something and only promotes it to long-term if it becomes important enough.

22. **confidence vs importance as separate dimensions.** "user might be moving to boston" could be extremely important but only 45% certain. that should cause the agent to ask and verify, not treat it as fact. confidence and importance are orthogonal.

23. **memory actions.** memories have behavioral implications: informational, reminder, preference, constraint, instruction, goal, warning, relationship, hypothesis. "user likes dark mode" (preference) is fundamentally different from "never send emails before 9am" (constraint). constraints trigger behavior checks.

24. **association permissions.** persona A can see memory X and the association X→Y. persona B can see memory X but cannot see the association X→Y. sometimes the relationship between two pieces of information is sensitive even if the pieces aren't.

25. **associative retrieval modes.** retrieval isn't one algorithm. it's a strategy engine: exact, semantic, hierarchical, associative, temporal, causal, persona-aware, tag-aware, graph traversal. combine them. different questions need different traversal strategies.

26. **user-visible "why did you remember this?"** if memorium retrieves something unexpectedly, it shows you the chain: "you asked about conference planning → public speaking → your 2024 presentation → alex attended → alex works in your target field. confidence: 0.78." the weird associative behavior becomes inspectable instead of magical.

## the bigger framing

memorium doesn't need to be "a database of memories."

it could be a personal knowledge graph with memory semantics — where every node, every edge, every weight, every tag, every temporal state, every provenance trail, and every persona interpretation contributes to a system that remembers the way humans actually do: associatively, contextually, imperfectly, and sometimes in surprisingly useful ways.
