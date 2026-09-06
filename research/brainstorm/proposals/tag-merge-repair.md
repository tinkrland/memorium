# proposal: tag merge repair (survivable wrongness for canonicalization)

draft from [../readme.md](../readme.md) proposed next step 2. operationalizes "survivable wrongness" ([../reality-denial-aphorism.md](../reality-denial-aphorism.md)): a bad canonicalization decision must be a recoverable local event, not a permanent structural fact.

## the problem being solved

the merge mechanic as documented in [memorium.md](../../../memorium.md) is one-way: winner absorbs aliases, associations, and memory references; loser deactivates. merge executes in one direction and nothing records enough of the "before" state to reverse it. a bad merge — two tags that *weren't* actually the same concept — compounds silently via trickle-down semantic drift: every memory tagged with the winner afterward inherits the wrong canonical concept, and every persona-relevance weight shaped on it compounds the error.

executing a merge without a reviewable trail is the exact "condensation feels like compression" trap: compression needs no audit trail because it's reversible by construction; condensation needs one because it isn't.

## the new table: `tag_merge_log`

| field | type | purpose |
| --- | --- | --- |
| id | uuid | — |
| winner_tag_id, loser_tag_id | FK → canonical_tags | the parties |
| executed_at, executed_by | timestamp, actor (user / auto-wrangler) | who made the call — auto-merges are exactly the ones to review |
| reason | text | why "these are the same concept" — forced, even for auto-merges ("fuzzy match 0.87") |
| transferred_aliases | jsonb | the alias list that moved to winner |
| transferred_associations | jsonb | associations moved to winner, with original strengths |
| pre_merge_memory_refs | jsonb | ids of memory nodes tagged with the loser *at merge time* — the restore set |
| post_merge_memory_refs | jsonb | ids tagged with the winner *via the merge* (loser-tagged nodes re-pointed) |
| reverted_at, revert_reason | nullable | set when undone |
| status | enum | active / reverted / contested |

the two memory-ref snapshots are the whole point. they make "how much damage did this merge do" a query, not an archaeology project: `jsonb_array_length(pre_merge_memory_refs) + jsonb_array_length(post_merge_memory_refs)` * average persona-relevance of the winner tag = a rough blast radius, computable before deciding whether to revert or just reweight.

## the two repair operations

### `revert_merge(merge_id)`

- loser reactivates as its own canonical tag
- aliases, associations return from winner (original strengths restored from `transferred_associations`)
- **pre-merge** memories (loser-tagged at merge time) move back to the loser
- **post-merge** memories (tagged with the winner *after* the merge executed) stay on the winner but get flagged `needs_review` — they were tagged in good faith against the merged concept; bulk-moving them would destroy the user's original language. the review flag surfaces them in the wrangler UI for a human to re-file one by one.
- this asymmetry is deliberate: it's the exact "keep enough of the before state that a merge is reviewable and reversible" principle, applied at the moment where it's cheap — and the review flag acknowledges that a wrong merge leaks *forward* in time even after it's undone.

### `reweight_merge(merge_id)` 

the lighter-touch option for merges that were *mostly* right but lost real nuance:

- merge stays, but all affected memories take a confidence reduction (proposal: −0.1, tunable), and the winner tag's association to the loser's former neighborhood drops to "contested" strength
- use when the concepts genuinely overlap but weren't identical — the common case, per the [navigability point](../reality-denial-aphorism.md) (don't over-simplify, but don't explode the graph to undo one fuzzy match either)

## detecting bad merges (they won't announce themselves)

a merge review queue, fed by signals that only show up after the fact:

- **retrieval confidence drop**: winner-tagged memories' average retrieval confidence falls measurably post-merge — the tags weren't the same concept, so queries are now hitting the wrong match
- **persona-relevance conflict**: the loser's persona relevance profile was shaped for a *different* persona set than the winner's (merge "coding" into "programming" and suddenly hobbyist-persona weightings apply to work memories)
- **association orphaning**: associations that made sense on the loser dangle nonsensically on the winner (a `contrasts_with` edge that now contradicts the winner's own neighborhood)
- **alias divergence complaints**: underconfident retrieval asks "did you mean X?" on content that never needed disambiguation before the merge

all four are computable from existing tables + the merge log's snapshots. none require new instrumentation at read time — they're periodic queries, not runtime checks, so they cost nothing until the review pass runs.

## what this deliberately does NOT do

- no auto-revert. every signal above is suggestive, not decisive; reverting is a human call (the wrangler UI is where AO3 puts this too — wranglers review, the system proposes)
- no prevention of auto-merges. auto-wrangling stays; it just now leaves a reviewable trail and appears in the queue with a blast-radius number attached, ordered by risk

## relation to existing schema

purely additive — one new table, one status enum on it, one `needs_review` flag concept on memory tagging (could be a lightweight `tag_review_queue` table rather than a column on memory_nodes, if we want zero writes to the hot path). no changes to the merge mechanic itself, so this can ship independently of the retrieval-side proposals.
