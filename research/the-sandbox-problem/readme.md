# the sandbox problem

isolation is only the easy half of the sandbox problem. the operational machine boundaries with regards to orchestration and coordination are the second and larger part to deal with.

this doc splits the problem into its halves, names the parts of the second half, and collects the considerations that shape how memorium approaches it.

## the easy half: isolation

isolation is the walls: a persona sees only its own memory graph, and nothing crosses a boundary unless a sharing rule explicitly allows it. memorium already treats this as solved mechanics — persona sandbox, strict sandbox enforcement, sharing rules (one-way, bidirectional, conditional), and every cross-boundary access attempt logged to `sandbox_access_log` with the result and the reason.

it is the easy half for a structural reason: **isolation is declarative**. it is access control — static rules checked at read time. "can persona A see node N" has a yes/no answer, is verifiable by inspection, and fails closed (no rules configured = fully sandboxed = only own perspective). a system that gets isolation wrong is broken loudly and early.

but isolation is only the starting point, not the goal. a sandbox that only isolates is a prison. the point of the walls was never the walls — it was making safe *movement* possible across a system of personas. that is the second half.

## the larger half: operational machine boundaries

once multiple personas exist and *do things*, the boundary stops being a wall and becomes an operating surface. the hard problems are not "can A see N" but "what happens when A and B must work together, in what order, on what shared state, and who is accountable when it goes sideways." orchestration and coordination are the machine boundaries — and they are larger because they are **behavioral, not declarative**: they can't be checked by rule inspection, only observed at runtime.

### orchestration — who runs what, when

- scheduling across sandboxes: which persona handles which task, in what order, under whose priority
- delegation: a persona handing work across a boundary — and the handoff itself being a first-class, auditable crossing
- meta-orchestration: who orchestrates the orchestrator. if a coordinator persona sits above the others, its sandbox is privileged — and privilege is exactly what sandboxing exists to constrain. the orchestrator's authority must itself be scoped, logged, and revocable

### coordination — working together without dissolving the walls

- boundary crossing as protocol, not as copy: when memory crosses between sandboxes, provenance must cross with it. a shared node that forgets where it came from is a node nobody is accountable for
- shared vs private state: which parts of a graph are per-persona private, which are conditionally shared, and what happens when two personas hold different versions of a "shared" memory
- concurrent access: two personas writing through the same sharing rule at the same time — which write wins, and what the loser is told
- boundary latency: coordination across a boundary costs a round trip. systems that must coordinate constantly pay for their isolation — sandbox sprawl turns into coordination tax

## considerations

- **the boundary is a protocol, not a location.** the wall is trivial; the gate — request, check, log, transform, deliver, audit — is where the design work lives
- **isolation fails closed, coordination fails open.** isolation violations are denied and logged. coordination failures are subtler: half-completed cross-sandbox tasks, stale shared nodes, lost provenance. these need their own drift-style detection (see [../the-sandbox-problem counterpart in concept/considerations.md](/concept/considerations.md) on stale-abstraction decay) rather than a permission check
- **audit at the boundary, not just at the wall.** `sandbox_access_log` answers "who saw what." orchestration needs more: "who did what, on whose behalf, in what order, with what outcome"
- **keep the failure mode graceful.** a denied read is fine; a half-orchestrated workflow that dies mid-crossing leaves shared state inconsistent. boundary crossings should be transactional — all the way across, or not at all
- **minimum viable sharing.** every standing sharing rule is a permanent coordination surface. prefer narrow, conditional, revocable rules over broad permanent ones

## relation to memorium's existing machinery

the isolation half is already built into the schema (persona sandbox, sharing rules, `sandbox_access_log`). the orchestration half is deliberately not yet specified — it belongs to the same layer as the retrieval pipeline's persona stage, but it operates on actions rather than reads. the open question is whether orchestration crossings get their own log table (mirroring `sandbox_access_log` for writes/actions) or extend it — that stays an open item for [the agenda](/research/agenda/readme.md).
