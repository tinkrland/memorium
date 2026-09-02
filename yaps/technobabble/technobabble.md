# technobabble

## the stack (and why each piece was chosen)

memorium is stack-agnostic. the following is what prixie uses today and what is recommended for the reference implementation. but the spec does not mandate any of these.

| layer | tech | why | replaceable with |
| --- | --- | --- | --- |
| graph backend | falkordb | redis-based, cypher-like queries, fast graph traversal for memory associations + tag hierarchy | neo4j, arangodb, or skip the graph and use recursive SQL |
| metadata store | supabase (postgres) | open source, row level security, real-time subscriptions, storage for multimodal files | any postgres, sqlite, planetscale, mongodb |
| vector store | mem0 | purpose-built for agent memory, simple API, handles embedding + search | pgvector, pinecone, weaviate, qdrant, chroma |
| multimodal storage | supabase storage | integrated with metadata store, signed URLs, file management | s3, minio, cloudinary, local filesystem |
| backend | hono (deno) | lightweight, fast, runs anywhere deno runs, good DX | fastapi, express, bun, rails, anything |
| frontend | react + tanstack router | file-based routing, fast, large ecosystem | vue, svelte, solid, vanilla |
| graph visualization | D3.js | the standard for interactive graph visualization, highly customizable | cytoscape.js, vis.js, sigma.js |
| styling | tailwind | semantic tokens, utility-first, matches prixie aesthetic | css modules, styled-components, anything |

## why falkordb over neo4j

- falkordb runs on redis (lighter, faster for most workloads)
- cypher-like query language (familiar if you know neo4j)
- open source, self-hostable, no vendor lock-in
- smaller memory footprint
- for memorium's scale (hundreds to low thousands of nodes per persona), falkordb is sufficient

neo4j is a valid alternative if you need heavier graph operations or already have it in your stack.

## why mem0 over raw pgvector

- mem0 handles embedding, storage, and search as a managed abstraction
- supports multiple backends (qdrant, pgvector, chroma, etc.)
- designed for agent memory use cases
- but: memorium demotes vector search to 15% of the retrieval score. if you don't want a separate vector store, pgvector in postgres works fine. the semantic signal is the smallest contributor.

## why D3 for the knowledge graph

the knowledge graph is the centerpiece of the GUI. it needs:
- force-directed layout (nodes repel, edges attract)
- interactive (drag, zoom, pan, click)
- customizable styling (node size by weight, color by hierarchy, edge thickness by association strength)
- D3 does all of this. cytoscape is a good alternative if you want a higher-level graph library.

## why GUI first

most memory systems are API-first. you build the API, then add a thin GUI wrapper. memorium inverts this:

- the GUI is where you understand your memory structure (knowledge graph, weight/hierarchy bars)
- the GUI is where you configure permissions (matrix, not JSON config)
- the GUI is where you set up sharing (flow diagram, not API calls)
- the GUI is where you debug retrieval (logged scores, not log files)
- the GUI is where you adjust weights and hierarchies (sliders, not SQL updates)

the API exists for programmatic access (agents, integrations). but the GUI is the primary interface. this is a design choice, not an afterthought.

## what memorium does NOT use

| tech | why not |
| --- | --- |
| langchain | memorium is not a chain/orchestration framework. it is a memory system. no dependency on langchain. |
| openai embeddings directly | mem0 handles embeddings. if you swap mem0 for pgvector, you bring your own embedding model. memorium doesn't care which one. |
| a separate search engine (elasticsearch, etc.) | search is handled by the vector store + tag matching. no need for a full-text search engine. |
| a message queue | memorium is request-response. indexing and decay are scheduled jobs, not event-driven. if you need event-driven, add a queue yourself. |
