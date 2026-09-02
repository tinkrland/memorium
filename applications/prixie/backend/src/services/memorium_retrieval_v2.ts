// memorium: retrieval engine v2
// underconfident retrieval — the system asks to repeat or says it's unsure
// rather than overconfidently replying. no context drift.
//
// retrieval pipeline (the prixie way):
// knowledge → human tags → tag wrangling → canonical concepts
// → hierarchy + associations → weights + confidence
// → persona sandbox → permissions + relevance
// → semantic retrieval → context
//
// embeddings are NOT thrown away. they're demoted from "the thing that
// understands the knowledge base" to one component of a much richer
// retrieval system.
//
// when retrieval gets something wrong, a human can inspect why:
// "this was retrieved because these tags were wrangled together,
//  this concept is nested under that one, and this persona has
//  a high relevance weight for it."

import { createClient } from "npm:@supabase/supabase-js@2";
import { wrangleTags, areTagsExclusive, getTagAssociations, listCanonicalTags } from "./tag_wrangler.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ============================================================================
// confidence thresholds (the underconfident behavior)
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  CONFIDENT: 0.75,           // above this: return results confidently
  UNCERTAIN: 0.45,           // above this: return results but flag uncertainty
  NEEDS_CLARIFICATION: 0.25, // above this: ask for clarification
  UNAVAILABLE: 0.0,          // below: say "i don't have enough information"
};

// ============================================================================
// types
// ============================================================================

export interface RetrievalResultV2 {
  memory: any;
  score: number;
  components: {
    semantic: number;        // semantic similarity (embeddings, demoted)
    tag_match: number;       // tag wrangling match strength
    hierarchy: number;       // hierarchy boost
    weight: number;          // identity weight contribution
    persona_relevance: number; // persona-specific tag relevance
    confidence: number;      // source confidence of the memory
  };
  retrieval_reason: string;  // human-readable explanation
  tag_wrangling: {           // what tags were wrangled to retrieve this
    input_tags: string[];
    canonical_tags: string[];
    wrangle_confidence: number;
  };
  association_path: string | null;
  parent_context: any | null;
  sibling_context: any[];
}

export interface RetrievalDecision {
  decision: "confident" | "uncertain" | "needs_clarification" | "unavailable";
  confidence_score: number;
  message: string;            // what to tell the user
  results: RetrievalResultV2[];
  components: {
    semantic: number;
    tag_match: number;
    hierarchy: number;
    weight: number;
    persona_relevance: number;
  };
}

// ============================================================================
// the full retrieval pipeline (v2)
// ============================================================================

export async function retrieveV2(opt: {
  perspectiveId: string;
  query: string;
  tags?: string[];              // user-provided tags to filter by
  limit?: number;
  minWeight?: number;
  includeAssociations?: boolean;
  associationDepth?: number;
  includeShared?: boolean;
  includeParent?: boolean;
}): Promise<RetrievalDecision> {
  const limit = opt.limit || 10;
  const minWeight = opt.minWeight || 0;
  const includeAssociations = opt.includeAssociations ?? true;
  const associationDepth = opt.associationDepth ?? 2;
  const includeShared = opt.includeShared ?? true;
  const includeParent = opt.includeParent ?? true;

  // step 1: wrangle any provided tags to canonical concepts
  let wrangledTags: any[] = [];
  let canonicalTagNames: string[] = [];
  let wrangleConfidence = 1.0;

  if (opt.tags && opt.tags.length > 0) {
    wrangledTags = await wrangleTags(opt.tags);
    canonicalTagNames = wrangledTags.map(w => w.canonical);
    wrangleConfidence = wrangledTags.reduce((sum, w) => sum + w.confidence, 0) / wrangledTags.length;
  }

  // step 2: extract tags from the query itself (auto-tagging)
  const queryTags = extractTagsFromQuery(opt.query);
  if (queryTags.length > 0) {
    const queryWrangled = await wrangleTags(queryTags);
    canonicalTagNames = [...new Set([...canonicalTagNames, ...queryWrangled.map(w => w.canonical)])];
    wrangleConfidence = (wrangleConfidence + queryWrangled.reduce((s, w) => s + w.confidence, 0) / queryWrangled.length) / 2;
  }

  // step 3: persona sandbox — strict access enforcement
  const accessiblePerspectiveIds = await getAccessiblePerspectivesStrict(opt.perspectiveId, includeShared);

  // log sandbox access for audit
  if (accessiblePerspectiveIds.length > 1) {
    for (const pid of accessiblePerspectiveIds) {
      if (pid !== opt.perspectiveId) {
        await logSandboxAccess(opt.perspectiveId, pid, null, "allowed", null);
      }
    }
  }

  // step 4: retrieve candidate memories
  let query = supabase
    .from("memory_nodes")
    .select("*")
    .in("perspective_id", accessiblePerspectiveIds)
    .gte("weight", minWeight)
    .limit(limit * 5);

  // filter by canonical tags if any
  if (canonicalTagNames.length > 0) {
    query = query.overlaps("tags", canonicalTagNames);
  }

  const { data: candidates, error } = await query;

  if (error || !candidates || candidates.length === 0) {
    return {
      decision: "unavailable",
      confidence_score: 0,
      message: "i don't have enough information in this perspective's memory to answer that. try a different perspective or add relevant memories.",
      results: [],
      components: { semantic: 0, tag_match: 0, hierarchy: 0, weight: 0, persona_relevance: 0 },
    };
  }

  // step 5: score each candidate across all signals
  const queryWords = new Set(opt.query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const scored: RetrievalResultV2[] = [];

  for (const mem of candidates) {
    // component 1: semantic similarity (demoted — one signal among many)
    const memWords = new Set((`${mem.key} ${mem.value || ""}`).toLowerCase().split(/\s+/));
    const overlap = [...queryWords].filter(w => memWords.has(w)).length;
    const semanticScore = queryWords.size > 0 ? overlap / queryWords.size : 0;

    // component 2: tag match strength (from wrangling)
    let tagMatchScore = 0;
    if (canonicalTagNames.length > 0) {
      const memTags = mem.tags || [];
      const matched = canonicalTagNames.filter(t => memTags.includes(t));
      tagMatchScore = matched.length / canonicalTagNames.length;
    }

    // component 3: hierarchy boost
    const decayedHierarchy = applyDecay(mem);
    const hierarchyScore = decayedHierarchy * 0.25;

    // component 4: weight contribution
    const weightScore = mem.weight * 0.20;

    // component 5: persona relevance (how relevant are the matched tags to this persona?)
    const personaRelevanceScore = await calculatePersonaRelevance(opt.perspectiveId, canonicalTagNames, mem.tags || []);

    // component 6: source confidence
    const confidence = mem.confidence || 0.5;

    // final score: weighted combination of all signals
    const finalScore =
      (semanticScore * 0.15) +     // semantic: 15% (demoted from ~100% in traditional RAG)
      (tagMatchScore * 0.30) +    // tag wrangling: 30% (the primary signal)
      (hierarchyScore * 0.10) +   // hierarchy: 10%
      (weightScore * 0.10) +      // weight: 10%
      (personaRelevanceScore * 0.20) + // persona relevance: 20%
      (confidence * 0.15);        // source confidence: 15%

    scored.push({
      memory: mem,
      score: finalScore,
      components: {
        semantic: semanticScore,
        tag_match: tagMatchScore,
        hierarchy: hierarchyScore,
        weight: weightScore,
        persona_relevance: personaRelevanceScore,
        confidence,
      },
      retrieval_reason: buildRetrievalReason(semanticScore, tagMatchScore, hierarchyScore, weightScore, personaRelevanceScore, canonicalTagNames, mem),
      tag_wrangling: {
        input_tags: opt.tags || queryTags,
        canonical_tags: canonicalTagNames,
        wrangle_confidence: wrangleConfidence,
      },
      association_path: null,
      parent_context: null,
      sibling_context: [],
    });
  }

  // sort by score
  scored.sort((a, b) => b.score - a.score);

  // step 6: association traversal
  const finalResults: RetrievalResultV2[] = [];
  const seenIds = new Set<string>();

  for (const r of scored) {
    if (finalResults.length >= limit) break;
    if (seenIds.has(r.memory.id)) continue;
    seenIds.add(r.memory.id);

    // nesting context
    if (includeParent && r.memory.parent_id) {
      const { data: parent } = await supabase
        .from("memory_nodes")
        .select("*")
        .eq("id", r.memory.parent_id)
        .single();
      r.parent_context = parent;

      const { data: siblings } = await supabase
        .from("memory_nodes")
        .select("*")
        .eq("parent_id", r.memory.parent_id)
        .neq("id", r.memory.id)
        .limit(5);
      r.sibling_context = siblings || [];
    }

    finalResults.push(r);

    // association traversal
    if (includeAssociations && associationDepth > 0) {
      const associated = await traverseAssociationsV2(r.memory.id, associationDepth, seenIds, minWeight);
      for (const a of associated) {
        if (finalResults.length >= limit) break;
        if (seenIds.has(a.memory.id)) continue;
        seenIds.add(a.memory.id);
        finalResults.push(a);
      }
    }
  }

  // step 7: calculate overall confidence and make decision
  const avgScore = finalResults.length > 0
    ? finalResults.reduce((s, r) => s + r.score, 0) / finalResults.length
    : 0;

  const componentAverages = {
    semantic: avg(finalResults.map(r => r.components.semantic)),
    tag_match: avg(finalResults.map(r => r.components.tag_match)),
    hierarchy: avg(finalResults.map(r => r.components.hierarchy)),
    weight: avg(finalResults.map(r => r.components.weight)),
    persona_relevance: avg(finalResults.map(r => r.components.persona_relevance)),
  };

  // underconfident behavior: the system is underconfident by default
  let decision: RetrievalDecision["decision"];
  let message: string;

  if (avgScore >= CONFIDENCE_THRESHOLDS.CONFIDENT) {
    decision = "confident";
    message = "";
  } else if (avgScore >= CONFIDENCE_THRESHOLDS.UNCERTAIN) {
    decision = "uncertain";
    message = "i found some potentially relevant memories, but i'm not fully confident. here's what i found — please verify if this is what you were looking for.";
  } else if (avgScore >= CONFIDENCE_THRESHOLDS.NEEDS_CLARIFICATION) {
    decision = "needs_clarification";
    message = "i'm not sure i have the right information. could you clarify what you're looking for, or try using more specific tags?";
  } else {
    decision = "unavailable";
    message = "i don't have enough information in this perspective's memory to answer that with confidence. you may want to add relevant memories or switch perspectives.";
  }

  // step 8: log the retrieval decision for transparency
  await logRetrievalConfidence(opt.perspectiveId, opt.query, finalResults.length, avgScore, decision, componentAverages);

  // step 9: check tag exclusions — if any results have mutually exclusive tags, flag them
  for (const r of finalResults) {
    const memTags = r.memory.tags || [];
    for (let i = 0; i < memTags.length; i++) {
      for (let j = i + 1; j < memTags.length; j++) {
        const tagA = await findTagIdByName(memTags[i]);
        const tagB = await findTagIdByName(memTags[j]);
        if (tagA && tagB) {
          const exclusive = await areTagsExclusive(tagA, tagB);
          if (exclusive) {
            r.retrieval_reason += ` [warning: tags "${memTags[i]}" and "${memTags[j]}" are mutually exclusive]`;
            r.score *= 0.5; // penalize conflicting tags
          }
        }
      }
    }
  }

  return {
    decision,
    confidence_score: avgScore,
    message,
    results: finalResults,
    components: componentAverages,
  };
}

// ============================================================================
// strict sandbox enforcement
// ============================================================================

// get accessible perspectives with STRICT enforcement — no leaks
async function getAccessiblePerspectivesStrict(
  perspectiveId: string,
  includeShared: boolean
): Promise<string[]> {
  // always include own perspective
  const ids = [perspectiveId];

  if (!includeShared) return ids;

  // check sharing rules — ONLY explicitly configured sharing
  const { data: sharingRules } = await supabase
    .from("persona_sharing")
    .select("*")
    .or(`source_perspective_id.eq.${perspectiveId},target_perspective_id.eq.${perspectiveId}`)
    .eq("active", true);

  if (!sharingRules || sharingRules.length === 0) {
    // no sharing rules = fully sandboxed = only own perspective
    return ids;
  }

  for (const rule of sharingRules) {
    if (rule.direction === "bidirectional") {
      if (!ids.includes(rule.source_perspective_id)) ids.push(rule.source_perspective_id);
      if (!ids.includes(rule.target_perspective_id)) ids.push(rule.target_perspective_id);
    } else if (rule.direction === "one_way" && rule.target_perspective_id === perspectiveId) {
      if (!ids.includes(rule.source_perspective_id)) ids.push(rule.source_perspective_id);
    }
  }

  return ids;
}

// log sandbox access attempts (audit trail)
async function logSandboxAccess(
  perspectiveId: string,
  targetPerspectiveId: string,
  memoryNodeId: string | null,
  result: string,
  sharingRuleId: string | null
): Promise<void> {
  await supabase
    .from("sandbox_access_log")
    .insert({
      perspective_id: perspectiveId,
      target_perspective_id: targetPerspectiveId,
      memory_node_id: memoryNodeId,
      access_result: result,
      sharing_rule_id: sharingRuleId,
    })
    .then(() => {});
}

// ============================================================================
// helpers
// ============================================================================

function applyDecay(mem: any): number {
  if (!mem.last_recalled) return mem.hierarchy;
  const daysSinceRecall = (Date.now() - new Date(mem.last_recalled).getTime()) / (1000 * 60 * 60 * 24);
  const decayRate = mem.decay_rate || 0.01;
  return Math.max(0.01, mem.hierarchy * Math.exp(-decayRate * daysSinceRecall));
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// extract tags from a natural language query
function extractTagsFromQuery(query: string): string[] {
  const tags: string[] = [];
  const lower = query.toLowerCase();

  // extract potential tag words (nouns, key terms)
  const words = lower.split(/\s+/).filter(w => w.length > 3);

  // look for tag-like patterns
  // "about X" → X is a tag
  const aboutMatch = lower.match(/about (\w+)/g);
  if (aboutMatch) {
    aboutMatch.forEach(m => tags.push(m.replace("about ", "")));
  }

  // "related to X" → X is a tag
  const relatedMatch = lower.match(/related to (\w+)/g);
  if (relatedMatch) {
    relatedMatch.forEach(m => tags.push(m.replace("related to ", "")));
  }

  // return unique
  return [...new Set(tags)];
}

// calculate persona-specific relevance for matched tags
async function calculatePersonaRelevance(
  perspectiveId: string,
  queryTags: string[],
  memoryTags: string[]
): Promise<number> {
  if (queryTags.length === 0 && memoryTags.length === 0) return 0.5;

  // check persona-specific tag relevance weights
  const { data: relevanceRules } = await supabase
    .from("tag_persona_relevance")
    .select("tag_id, relevance_weight")
    .eq("perspective_id", perspectiveId);

  if (!relevanceRules || relevanceRules.length === 0) return 0.5;

  // look up tag IDs for the memory's tags
  let relevanceScore = 0;
  let count = 0;

  for (const tagName of memoryTags) {
    const { data: tag } = await supabase
      .from("canonical_tags")
      .select("id")
      .ilike("canonical", tagName)
      .single();

    if (tag) {
      const rule = relevanceRules.find(r => r.tag_id === tag.id);
      if (rule) {
        relevanceScore += rule.relevance_weight;
        count++;
      }
    }
  }

  return count > 0 ? relevanceScore / count : 0.5;
}

// build a human-readable retrieval reason (for transparency)
function buildRetrievalReason(
  semantic: number, tagMatch: number, hierarchy: number, weight: number,
  personaRelevance: number, canonicalTags: string[], mem: any
): string {
  const reasons: string[] = [];

  if (tagMatch > 0.5) {
    reasons.push(`tag match: ${(tagMatch * 100).toFixed(0)}% (tags wrangled to: ${canonicalTags.join(", ")})`);
  }
  if (semantic > 0.3) {
    reasons.push(`semantic similarity: ${(semantic * 100).toFixed(0)}%`);
  }
  if (hierarchy > 0.15) {
    reasons.push(`hierarchy boost: ${(hierarchy * 100).toFixed(0)}% (currently drives behavior)`);
  }
  if (weight > 0.15) {
    reasons.push(`identity weight: ${(weight * 100).toFixed(0)}% (${mem.weight > 0.8 ? "core to identity" : "moderate"})`);
  }
  if (personaRelevance > 0.6) {
    reasons.push(`persona relevance: ${(personaRelevance * 100).toFixed(0)}% (highly relevant to this perspective)`);
  }

  if (reasons.length === 0) {
    return "retrieved as fallback (no strong signal match)";
  }

  return reasons.join("; ");
}

// traverse associations (v2)
async function traverseAssociationsV2(
  nodeId: string,
  depth: number,
  seenIds: Set<string>,
  minWeight: number
): Promise<RetrievalResultV2[]> {
  if (depth <= 0) return [];

  const { data: associations } = await supabase
    .from("memory_associations")
    .select("*")
    .eq("source_node_id", nodeId)
    .order("strength", { ascending: false })
    .limit(10);

  if (!associations || associations.length === 0) return [];

  const results: RetrievalResultV2[] = [];

  for (const assoc of associations) {
    if (seenIds.has(assoc.target_node_id)) continue;
    if (assoc.strength < 0.3) continue;

    const { data: targetMem } = await supabase
      .from("memory_nodes")
      .select("*")
      .eq("id", assoc.target_node_id)
      .single();

    if (!targetMem || targetMem.weight < minWeight) continue;

    seenIds.add(assoc.target_node_id);
    const decayedH = applyDecay(targetMem);
    const score = assoc.strength * 0.4 + decayedH * 0.3 + targetMem.weight * 0.3;

    results.push({
      memory: targetMem,
      score,
      components: {
        semantic: 0,
        tag_match: assoc.strength,
        hierarchy: decayedH * 0.25,
        weight: targetMem.weight * 0.2,
        persona_relevance: 0.5,
        confidence: targetMem.confidence,
      },
      retrieval_reason: `association (${assoc.association_type}) strength: ${(assoc.strength * 100).toFixed(0)}%`,
      tag_wrangling: {
        input_tags: [],
        canonical_tags: targetMem.tags || [],
        wrangle_confidence: 1.0,
      },
      association_path: `association (${assoc.strength.toFixed(2)})`,
      parent_context: null,
      sibling_context: [],
    });

    if (depth > 1) {
      const deeper = await traverseAssociationsV2(assoc.target_node_id, depth - 1, seenIds, minWeight);
      results.push(...deeper);
    }
  }

  return results;
}

// find tag ID by canonical name
async function findTagIdByName(name: string): Promise<string | null> {
  const { data } = await supabase
    .from("canonical_tags")
    .select("id")
    .ilike("canonical", name)
    .single();
  return data?.id || null;
}

// log retrieval confidence for transparency and audit
async function logRetrievalConfidence(
  perspectiveId: string,
  query: string,
  retrievedCount: number,
  confidenceScore: number,
  decision: string,
  components: any
): Promise<void> {
  await supabase
    .from("memory_retrieval_confidence")
    .insert({
      perspective_id: perspectiveId,
      query,
      retrieved_count: retrievedCount,
      confidence_score: confidenceScore,
      decision,
      semantic_score: components.semantic,
      tag_match_score: components.tag_match,
      hierarchy_score: components.hierarchy,
      weight_score: components.weight,
      persona_relevance_score: components.persona_relevance,
    })
    .then(() => {});
}
