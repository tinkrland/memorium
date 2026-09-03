# yaps

docs for memorium. lowercase, personal, not a product pitch.

these docs explain what memorium is, why it exists, how it works, and where it's going. they are written for humans, not for investors. if you want the technical deep-dive, go to `technobabble/`.

## what's in here

| file | what |
| --- | --- |
| `about.md` | what memorium is — the 26 design principles (foundations + 20 deeper concepts) |
| `features.md` | what memorium does — every feature grouped by concept area |
| `problem.md` | the problem memorium solves — flat memory is broken |
| `concept-sketch.md` | the core ideas sketched out — mental model, cross-domain associativity, typed associations, the bigger framing |
| `roadmap.md` | where memorium is going — phases 0-10 |
| `technobabble/` | technical docs (stack, architecture, internals) |

## technobabble

| file | what |
| --- | --- |
| `technobabble/behindthescenes.md` | how memorium works in practice — indexing, retrieval, POV switching, cross-domain detection, contradiction handling, ephemeral promotion |
| `technobabble/underthehood.md` | the internals — retrieval pipeline, decay formulas, cross-domain associativity algorithms, temporal state, provenance, lineage |
| `technobabble/technobabble.md` | the stack and why each piece was chosen |
| `technobabble/archtecture.md` | system architecture with mermaid diagrams (system overview, retrieval, indexing, POV switching, sandbox, cross-domain graph, typed associations, temporal state, contradiction handling, provenance/lineage, ephemeral promotion, retrieval modes, association permissions) |

## the short version

memorium is not a vector database wrapper. it is a personal knowledge graph with memory semantics.

a normal knowledge graph cares about "what is connected to what?" memorium cares about "what is connected to what, how strongly, why, when, according to whom, in what context, for which persona, with what confidence, and should this connection affect retrieval right now?"

it is extremely agnostic to your stack. it is GUI first. it is designed to be human-legible, sandboxed by default, underconfident by design, and associative in ways that go beyond "better rag."

it exists within prixie but is designed to work independently. this branch is where standalone memorium lives as a concept, outside of prixie.
