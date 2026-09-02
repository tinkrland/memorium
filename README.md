# memorium

a persona-based memory system. one you, many perspectives — each with its own memory, permissions, relevance, and behavior. sandboxed by default, sharing configurable.

memorium is not "a persona joining a meeting." it is switching perspective POV — like switching accounts on a shared laptop, but instead of different people, it's different perspectives of you (student you, founder you, employee you, hobbyist you). rapid POV switching is the goal.

## the core insight: two axes of memory

**weight** = how core a memory is to the persona's identity (0-1). "i am a developer" is weight 0.9 and never decays. "the meeting is at 3pm" is weight 0.1 and evaporates.

**hierarchy** = how much a memory drives behavior right now (0-1). "the exam is tomorrow" is low weight but hierarchy 0.9. identity-weighted, behavior-hierarchical, associative — this is memorium.

## the seven pillars

knowledge · weightage · nesting · associativity · priority · contextual relevance wrt perspective · accuracy — defined in [research/agenda/pillars.md](./research/agenda/pillars.md), with a formal research agenda per pillar in [research/agenda/readme.md](./research/agenda/readme.md).

## the graph IS the interface

the d3 force-directed knowledge graph is the primary UI, not a dashboard add-on. node radius = identity weight, glow/pulse = hierarchy decay, typed edges render as solid/dashed/dotted strokes, and filtering happens inside the graph. the spatial-cognitive visual architecture is scoped in [research/ux.md](./research/ux.md).

## repository map

| path | what |
| --- | --- |
| [memorium.md](./memorium.md) | full design doc — weighted, hierarchical, associative persona memory |
| [research/](./research) | research scoping: tag-wrangling datasets, weighting mechanics, seven-pillar agenda, visual UX |
| [pilot/](./pilot) | memorium deployed outside prixie — non-binary perspectives ("both are right"), ted nelson's intertwingularity |
| [src/](./src) | standalone, stack-agnostic, GUI-first memory system source |
| [yaps/](./yaps) / [yap/](./yap) | docs: problem, features, concept sketch, roadmap, technobabble |
| [applications/prixie](./applications/prixie) | prixie — the first application built on memorium (meeting proxy agent) |

## applications

memorium is an engine. applications consume it:

- **[prixie](./applications/prixie)** — a personal meeting proxy agent. she joins meetings on your behalf, listens for what you asked her to find, and comes back with exactly what you needed. prixie uses memorium to know which perspective of you is attending.
- **[pilot](./pilot)** — memorium as its own application: an externalized spatial mind-space (see [pilot/readme.md](./pilot/readme.md)).
