# ux: spatial-cognitive & color-coded visual architecture

the graph is not a dashboard add-on. the graph IS the user interface.

---

## spatial-cognitive graph visualization and typed edge rendering

human memory is fundamentally spatial and visual. we remember where something was on a desk or a whiteboard, its visual grouping, and its color weight before we remember its exact text index. traditional graph databases (like standard neo4j implementations) render relationships as uniform, undifferentiated vector lines. this flattens semantic nuance — treating a structural dependency (`prerequisite_for`) identically to a loose creative association (`reminds_me_of`). in human cognition, spatial memory relies on visual differentiation: distance, line weight, stroke style, and color-coded typologies are immediate signifiers of relationship mechanics.

memorium treats the d3.js knowledge graph as a primary interactive interface. the visual encoding of edges and nodes directly maps to underlying retrieval weights, multi-signal confidence scores, and semantic typologies.

### the visual grammar

| visual property | maps to | behavior |
| --- | --- | --- |
| node radius | identity weight | anchored core traits are massive, heavy gravitational centers; minor preferences are small |
| node opacity/pulse | hierarchy decay | active, urgent tasks glow and pulse; older memories fade into a quiet archival fog |
| color mapping | category / perspective domain | pastel archive tones for writing, tactile vintage amber for work, soft green for hobbies |
| spatial clustering | edge tension | related memories naturally cluster into visual "neighborhoods" that map to the user's cognitive map |

---

## 1. visual typology of typed edges (stroke and pattern grammar)

edges in memorium are not binary connection lines; they carry explicit relationship semantics that dictate how data flows through the retrieval pipeline. the UI renders these semantics via distinct stroke patterns:

- **solid lines (weight-driven thickness):** structural hierarchies and direct dependencies (`parent_of`, `prerequisite_for`). stroke width scales with association strength (0.1 → 1.0), visually communicating tight coupling vs. loose relevance.
- **dashed lines:** causal or derivative relationships (`caused_by`, `derived_from`). dash frequency visualizes temporal distance or algorithmic inference confidence.
- **dotted lines:** associative leaps, metaphors, cross-domain bridges (`reminds_me_of`, `metaphor_for`). visual cues for creative cross-pollination without cluttering the structural foreground.
- **color-coded reference keys:** edge strokes inherit color profiles tied to specific reference keys, canonical tag clusters, or active perspective sandboxes — users trace provenance visually across domains.

## 2. spatial clustering and semantic folder previews

human memory organizes conceptually related information into spatial neighborhoods, not flat tabular files. memorium replaces rigid folder trees with spatial clusters:

- **gravitational node grouping:** nodes sharing high tag-persona relevance or tight association weights naturally cluster together via force-directed simulation physics.
- **cluster previews as fluid boundaries:** when zoomed out, dense topological clusters resolve into boundary-bounded spatial regions (acting as semantic folders). users can inspect, fold, or expand these regions without losing global context.
- **node rendering mechanics:** node radius maps to identity weight (unchanging structural cores appear as massive anchor points); node opacity maps to hierarchy decay (urgent, active tasks pulse and glow; archival noise fades into atmospheric blur).

## 3. interactive in-graph filtering and dynamic querying

looking at a massive, intertwingled graph of your life and projects all at once causes cognitive overload. but traditional text search breaks the visual flow. so memorium integrates real-time spatial filtering directly into the graph viewport:

- **live slice-and-dice sliders (multi-signal threshold sliders):** drag the hierarchy decay bar or the confidence threshold slider and watch the graph physically shed noise in real time — transient noise fades away, low-confidence nodes drop out, irrelevant edge lines thin before the user's eyes, leaving only high-weight identity roots and active context branches.
- **perspective goggles:** toggle a dropdown or click a persona card and the graph restructures dynamically — nodes that matter to that perspective light up and pull to the foreground, while unauthorized nodes recede into shadow, lock behind visual sandbox boundary walls, or vanish entirely behind permission boundaries. switching from work to hobbyist triggers a spatial re-weighting animation where perspective-relevant neighborhoods surface and everything else dims.
- **associative path isolation:** click any two disparate nodes across different domains (e.g., a music theory note and a system architecture snippet) and the graph instantly dims the entire canvas, highlighting only the multi-hop bridge connecting them — rendering the intermediate edge styles and weights for immediate human inspection, filtering out everything else to show why your mind made that cross-domain leap.

this shifts memorium from a technical context tool into an externalized spatial mind-space.

## 4. what this grammar cannot show

a diagram is not a neutral window — it renders thought only in the shapes its visual grammar supports, and anything without a slot doesn't render poorly, it renders *invisibly*. (full reasoning: [brainstorm/retrieval-as-construction.md](./brainstorm/retrieval-as-construction.md) — "diagram = constraint of what thought becomes visible.") this section is the standing inventory of that blind spot, written *before* the canvas vocabulary is locked, so the gaps are a documented artifact instead of a discovered-later surprise. each row should gain a mitigation (a visual notation, a hover treatment, or an explicit "not representable — see text" affordance) before `/memorium/canvas` ships:

| non-representable | why the grammar misses it | candidate mitigation |
| --- | --- | --- |
| **time / versioning** | the graph renders current state; a node that was rewritten (reconsolidated) shows one shape, no history dimension | hover reveals version stack; or a faint "palimpsest" outline for versioned nodes (ties to provenance depth — see [brainstorm/proposals/provenance-depth.md](./brainstorm/proposals/provenance-depth.md)) |
| **provenance depth** | nothing distinguishes an ingested fact from a twice-reconstructed summary — both render as equally real nodes | opacity already maps to decay; provenance needs its own channel (e.g. fill style: solid = source, hatched = derived) |
| **edge uncertainty vs. edge strength** | stroke width maps strength, but "strong and certain" and "strong but inferred" look identical | dash *within* the stroke (not the pattern reserved for causality) or a secondary hairline halo |
| **strength trends** | an association rising vs. one decaying read as the same static line at a snapshot | small directional tick or animation on hover; at minimum, trend shown on click |
| **absence** | the graph shows what is connected, never what *isn't* — the dark matter of "related things not yet linked" is invisible, which quietly makes the graph look more complete than the mind | explicit "uncharted" markers at cluster boundaries; a dedicated lens toggle |
| **exclusions & conditions** | `tag_exclusions`, conditional sharing rules, and persona-conditional relevance are pairwise/logical structures, not edges between nodes — no line style can draw "X but only when persona = employee" | rendered as translucent overlay panels (rules as a layer, not edges); the permissions matrix already carries some of this |

the rule going forward: when a relationship type is found that this grammar can't express, it gets a row here *and* a decision (new notation vs. explicit non-visual treatment) — never a silent flattening into the nearest drawable edge type. a maze is allowed to look like a maze.
