// memorium: memory engine
// the core of memorium: indexing, retrieval, association, and decay
//
// memory is not a bucket of chunks. it is a weighted, hierarchical, associative
// structure that knows what information is important, what it relates to,
// who it belongs to, and when it should matter.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ============================================================================
// types
// ============================================================================

export interface MemoryNode {
  id: string;
  perspective_id: string;
  parent_id: string | null;
  key: string;
  value: string | null;
  category: string | null;
  weight: number;
  hierarchy: number;
  confidence: number;
  source: string;
  source_meeting_id: string | null;
  tags: string[];
  recall_count: number;
  last_recalled: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryAssociation {
  id: string;
  source_node_id: string;
  target_node_id: string;
  strength: number;
  association_type: string;
}

export interface RetrievalResult {
  memory: MemoryNode;
  score: number;
  weight: number;
  hierarchy: number;
  retrieval_reason: string;
  association_path: string | null;
  parent_context: MemoryNode | null;
  sibling_context: MemoryNode[];
}

// ============================================================================
// indexing: extract facts from text and store as structured memory
// ============================================================================

export interface IndexedFact {
  key: string;
  value: string;
  category: string;
  weight: number;
  hierarchy: number;
  tags: string[];
}

// index facts from a transcript or user input into a perspective's memory
export async function indexMemory(
  perspectiveId: string,
  fact: IndexedFact,
  source: string = "user_input",
  meetingId?: string
): Promise<MemoryNode> {
  // find parent node based on category
  const parentId = await findOrCreateParentNode(perspectiveId, fact.category);

  // check if a similar memory already exists (same key for this perspective)
  const { data: existing } = await supabase
    .from("memory_nodes")
    .select("*")
    .eq("perspective_id", perspectiveId)
    .eq("key", fact.key)
    .single();

  if (existing) {
    // update: reinforce confidence, potentially adjust weight/hierarchy
    const newConfidence = Math.min(1, existing.confidence + 0.1);
    const newRecallCount = existing.recall_count;

    const { data: updated } = await supabase
      .from("memory_nodes")
      .update({
        value: fact.value || existing.value,
        confidence: newConfidence,
        tags: [...new Set([...(existing.tags || []), ...fact.tags])],
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    return updated;
  }

  // create new memory node
  const { data: node, error } = await supabase
    .from("memory_nodes")
    .insert({
      perspective_id: perspectiveId,
      parent_id: parentId,
      key: fact.key,
      value: fact.value,
      category: fact.category,
      weight: fact.weight,
      hierarchy: fact.hierarchy,
      confidence: source === "user_input" ? 1.0 : 0.5,
      source,
      source_meeting_id: meetingId,
      tags: fact.tags,
    })
    .select()
    .single();

  if (error) throw error;

  // auto-associate with existing memories in the same category
  await autoAssociate(node);

  return node;
}

// batch index multiple facts
export async function indexMemoryBatch(
  perspectiveId: string,
  facts: IndexedFact[],
  source: string = "user_input",
  meetingId?: string
): Promise<MemoryNode[]> {
  const results: MemoryNode[] = [];
  for (const fact of facts) {
    try {
      const node = await indexMemory(perspectiveId, fact, source, meetingId);
      results.push(node);
    } catch (err) {
      console.warn("memorium: failed to index fact:", fact.key, err);
    }
  }
  return results;
}

// find or create a parent node for a category
async function findOrCreateParentNode(perspectiveId: string, category: string): Promise<string | null> {
  if (!category) return null;

  const { data: existing } = await supabase
    .from("memory_nodes")
    .select("id")
    .eq("perspective_id", perspectiveId)
    .eq("key", category)
    .is("parent_id", null)
    .single();

  if (existing) return existing.id;

  const { data: parent, error } = await supabase
    .from("memory_nodes")
    .insert({
      perspective_id: perspectiveId,
      parent_id: null,
      key: category,
      value: null,
      category: category,
      weight: 0.5,
      hierarchy: 0.5,
      confidence: 1.0,
      source: "system",
    })
    .select()
    .single();

  if (error) {
    console.warn("memorium: failed to create parent node:", error);
    return null;
  }

  return parent.id;
}

// ============================================================================
// associations: connect related memories
// ============================================================================

// auto-associate a new memory with existing memories in the same category
async function autoAssociate(node: MemoryNode): Promise<void> {
  if (!node.category) return;

  // find other memories in the same category for this perspective
  const { data: siblings } = await supabase
    .from("memory_nodes")
    .select("id, key, value")
    .eq("perspective_id", node.perspective_id)
    .eq("category", node.category)
    .neq("id", node.id)
    .limit(20);

  if (!siblings || siblings.length === 0) return;

  for (const sibling of siblings) {
    // calculate simple association strength based on content overlap
    const strength = calculateAssociationStrength(node, sibling);
    if (strength > 0.3) {
      await createAssociation(node.id, sibling.id, strength, "related");
    }
  }
}

// calculate association strength between two memories
function calculateAssociationStrength(a: any, b: any): number {
  // simple word overlap heuristic (in production, use embeddings)
  const wordsA = new Set((a.value || a.key || "").toLowerCase().split(/\s+/));
  const wordsB = new Set((b.value || b.key || "").toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// create an association between two memory nodes
export async function createAssociation(
  sourceId: string,
  targetId: string,
  strength: number,
  associationType: string = "related"
): Promise<void> {
  const { error } = await supabase
    .from("memory_associations")
    .upsert({
      source_node_id: sourceId,
      target_node_id: targetId,
      strength,
      association_type: associationType,
    }, { onConflict: "source_node_id,target_node_id" });

  if (error) console.warn("memorium: failed to create association:", error);
}

// get associations for a memory node
export async function getAssociations(nodeId: string): Promise<MemoryAssociation[]> {
  const { data, error } = await supabase
    .from("memory_associations")
    .select("*")
    .eq("source_node_id", nodeId)
    .order("strength", { ascending: false });

  if (error) return [];
  return data || [];
}

// ============================================================================
// retrieval: the core operation
// ============================================================================

export interface RetrievalOptions {
  perspectiveId: string;
  query: string;
  limit?: number;
  minWeight?: number;       // filter by weight threshold
  minHierarchy?: number;    // filter by hierarchy threshold
  includeAssociations?: boolean;
  associationDepth?: number;  // how many hops (default 2)
  includeParent?: boolean;    // include parent/sibling context
  includeShared?: boolean;    // include memories shared from other perspectives
}

// the full retrieval pipeline:
// 1. perspective filter (what can this perspective access?)
// 2. semantic search (vector similarity via mem0 or text search)
// 3. hierarchy boost
// 4. weight threshold
// 5. association traversal
// 6. nesting context
// 7. confidence + decay
// 8. output: ranked list with retrieval reasons
export async function retrieve(opt: RetrievalOptions): Promise<RetrievalResult[]> {
  const limit = opt.limit || 10;
  const minWeight = opt.minWeight || 0;
  const minHierarchy = opt.minHierarchy || 0;
  const associationDepth = opt.associationDepth ?? 2;
  const includeAssociations = opt.includeAssociations ?? true;
  const includeParent = opt.includeParent ?? true;

  // step 1: perspective filter - get all memory node IDs this perspective can access
  const accessiblePerspectiveIds = await getAccessiblePerspectives(opt.perspectiveId, opt.includeShared ?? true);

  // step 2: semantic search (text-based for now; mem0 vector search in production)
  const { data: candidates, error } = await supabase
    .from("memory_nodes")
    .select("*")
    .in("perspective_id", accessiblePerspectiveIds)
    .gte("weight", minWeight)
    .gte("hierarchy", minHierarchy)
    .limit(limit * 3); // over-fetch for re-ranking

  if (error || !candidates) return [];

  // step 3: rank by semantic similarity + hierarchy boost + weight
  const queryWords = new Set(opt.query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const ranked: RetrievalResult[] = [];

  for (const mem of candidates as MemoryNode[]) {
    const memWords = new Set((`${mem.key} ${mem.value || ""}`).toLowerCase().split(/\s+/));
    const overlap = [...queryWords].filter(w => memWords.has(w)).length;
    const semanticScore = queryWords.size > 0 ? overlap / queryWords.size : 0;

    // hierarchy boost: high-hierarchy memories get a bonus
    const hierarchyBoost = mem.hierarchy * 0.3;
    // weight contribution: high-weight memories are more trusted
    const weightContribution = mem.weight * 0.2;
    // base semantic score
    const baseScore = semanticScore * 0.5;

    const finalScore = baseScore + hierarchyBoost + weightContribution;

    if (finalScore < 0.1) continue;

    // step 7: apply decay to hierarchy
    const decayedHierarchy = applyDecay(mem);

    ranked.push({
      memory: { ...mem, hierarchy: decayedHierarchy },
      score: finalScore,
      weight: mem.weight,
      hierarchy: decayedHierarchy,
      retrieval_reason: `semantic similarity: ${(semanticScore * 100).toFixed(0)}%, hierarchy boost: ${(hierarchyBoost * 100).toFixed(0)}%, weight: ${(weightContribution * 100).toFixed(0)}%`,
      association_path: null,
      parent_context: null,
      sibling_context: [],
    });
  }

  // sort by final score
  ranked.sort((a, b) => b.score - a.score);

  // step 5: association traversal (expand results)
  const finalResults: RetrievalResult[] = [];
  const seenNodeIds = new Set<string>();

  for (const r of ranked) {
    if (finalResults.length >= limit) break;
    if (seenNodeIds.has(r.memory.id)) continue;
    seenNodeIds.add(r.memory.id);

    // step 6: nesting context (parent + siblings)
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
      const associated = await traverseAssociations(
        r.memory.id,
        associationDepth,
        seenNodeIds,
        r.memory.perspective_id,
        minWeight
      );

      for (const assoc of associated) {
        if (finalResults.length >= limit) break;
        if (seenNodeIds.has(assoc.memory.id)) continue;
        seenNodeIds.add(assoc.memory.id);

        finalResults.push({
          ...assoc,
          association_path: `semantic -> association (${assoc.score.toFixed(2)})`,
          parent_context: null,
          sibling_context: [],
        });
      }
    }
  }

  // step 8: log retrieval for transparency
  for (const r of finalResults) {
    await logRetrieval(opt.perspectiveId, opt.query, r);
  }

  // increment recall count for retrieved memories
  await incrementRecallCounts(finalResults.map(r => r.memory.id));

  return finalResults;
}

// traverse association edges from a memory node
async function traverseAssociations(
  nodeId: string,
  depth: number,
  seenIds: Set<string>,
  perspectiveId: string,
  minWeight: number
): Promise<RetrievalResult[]> {
  if (depth <= 0) return [];

  const associations = await getAssociations(nodeId);
  const results: RetrievalResult[] = [];

  for (const assoc of associations) {
    if (seenIds.has(assoc.target_node_id)) continue;
    if (assoc.strength < 0.3) continue;

    const { data: targetMem } = await supabase
      .from("memory_nodes")
      .select("*")
      .eq("id", assoc.target_node_id)
      .single();

    if (!targetMem) continue;
    if (targetMem.weight < minWeight) continue;

    seenIds.add(assoc.target_node_id);

    const decayedHierarchy = applyDecay(targetMem);
    const score = assoc.strength * 0.5 + decayedHierarchy * 0.3 + targetMem.weight * 0.2;

    results.push({
      memory: { ...targetMem, hierarchy: decayedHierarchy },
      score,
      weight: targetMem.weight,
      hierarchy: decayedHierarchy,
      retrieval_reason: `association (${assoc.association_type}) strength: ${(assoc.strength * 100).toFixed(0)}%`,
      association_path: null,
      parent_context: null,
      sibling_context: [],
    });

    // recurse
    if (depth > 1) {
      const deeper = await traverseAssociations(
        assoc.target_node_id,
        depth - 1,
        seenIds,
        perspectiveId,
        minWeight
      );
      results.push(...deeper);
    }
  }

  return results;
}

// ============================================================================
// decay: hierarchy decays, weight does not
// ============================================================================

// apply exponential decay to hierarchy
export function applyDecay(mem: MemoryNode): number {
  if (!mem.last_recalled) return mem.hierarchy;

  const daysSinceRecall = (Date.now() - new Date(mem.last_recalled).getTime()) / (1000 * 60 * 60 * 24);
  const decayRate = mem.decay_rate || 0.01;
  const decayedHierarchy = mem.hierarchy * Math.exp(-decayRate * daysSinceRecall);

  // floor at 0.01 (never fully zero - it can be re-elevated)
  return Math.max(0.01, decayedHierarchy);
}

// run decay for all memories of a perspective (called periodically)
export async function runDecayCycle(perspectiveId?: string): Promise<number> {
  let query = supabase
    .from("memory_nodes")
    .select("id, hierarchy, last_recalled, decay_rate");

  if (perspectiveId) {
    query = query.eq("perspective_id", perspectiveId);
  }

  const { data: memories, error } = await query;

  if (error || !memories) return 0;

  let updated = 0;
  for (const mem of memories) {
    const decayed = applyDecay(mem);
    if (Math.abs(decayed - mem.hierarchy) > 0.01) {
      await supabase
        .from("memory_nodes")
        .update({ hierarchy: decayed })
        .eq("id", mem.id);
      updated++;
    }
  }

  return updated;
}

// ============================================================================
// permissions + sharing: who can access what
// ============================================================================

// get all perspective IDs that a given perspective can access (own + shared)
export async function getAccessiblePerspectives(
  perspectiveId: string,
  includeShared: boolean = true
): Promise<string[]> {
  const ids = [perspectiveId];

  if (!includeShared) return ids;

  // find all sharing rules where this perspective is the target
  const { data: sharingRules } = await supabase
    .from("persona_sharing")
    .select("source_perspective_id, target_perspective_id, direction")
    .or(`source_perspective_id.eq.${perspectiveId},target_perspective_id.eq.${perspectiveId}`)
    .eq("active", true);

  if (sharingRules) {
    for (const rule of sharingRules) {
      if (rule.direction === "bidirectional") {
        if (!ids.includes(rule.source_perspective_id)) ids.push(rule.source_perspective_id);
        if (!ids.includes(rule.target_perspective_id)) ids.push(rule.target_perspective_id);
      } else if (rule.direction === "one_way") {
        // one_way: source shares TO target
        if (rule.target_perspective_id === perspectiveId) {
          if (!ids.includes(rule.source_perspective_id)) ids.push(rule.source_perspective_id);
        }
      }
    }
  }

  return ids;
}

// check if a specific memory can be shared from source to target perspective
export async function canShareMemory(
  memoryId: string,
  sourcePerspectiveId: string,
  targetPerspectiveId: string
): Promise<{ allowed: boolean; reason: string }> {
  const { data: sharing } = await supabase
    .from("persona_sharing")
    .select("*")
    .eq("source_perspective_id", sourcePerspectiveId)
    .eq("target_perspective_id", targetPerspectiveId)
    .eq("active", true)
    .single();

  if (!sharing) {
    // check bidirectional
    const { data: biSharing } = await supabase
      .from("persona_sharing")
      .select("*")
      .eq("source_perspective_id", targetPerspectiveId)
      .eq("target_perspective_id", sourcePerspectiveId)
      .eq("direction", "bidirectional")
      .eq("active", true)
      .single();

    if (!biSharing) return { allowed: false, reason: "no sharing rule configured" };
  }

  const rule = sharing || (await supabase
    .from("persona_sharing")
    .select("*")
    .eq("source_perspective_id", sourcePerspectiveId)
    .eq("target_perspective_id", targetPerspectiveId)
    .eq("active", true)
    .limit(1)
    .single()
  ).data;

  if (!rule) return { allowed: false, reason: "no sharing rule found" };

  // check memory against sharing conditions
  const { data: memory } = await supabase
    .from("memory_nodes")
    .select("*")
    .eq("id", memoryId)
    .single();

  if (!memory) return { allowed: false, reason: "memory not found" };

  // check min_weight
  if (memory.weight < (rule.min_weight || 0)) {
    return { allowed: false, reason: `memory weight (${memory.weight}) below minimum (${rule.min_weight})` };
  }

  // check condition_category
  if (rule.condition_category && memory.category !== rule.condition_category) {
    return { allowed: false, reason: `memory category (${memory.category}) does not match (${rule.condition_category})` };
  }

  // check condition_tags
  if (rule.condition_tags && rule.condition_tags.length > 0) {
    const hasTag = rule.condition_tags.some((tag: string) => (memory.tags || []).includes(tag));
    if (!hasTag) {
      return { allowed: false, reason: `memory does not have any required tags (${rule.condition_tags.join(", ")})` };
    }
  }

  return { allowed: true, reason: "sharing rule allows this memory" };
}

// ============================================================================
// helpers
// ============================================================================

// increment recall count for retrieved memories
async function incrementRecallCounts(nodeIds: string[]): Promise<void> {
  for (const id of nodeIds) {
    await supabase.rpc("increment_recall_count", { node_id: id }).catch(() => {
      // rpc might not exist yet, do manual update
      supabase
        .from("memory_nodes")
        .update({
          recall_count: supabase.raw("recall_count + 1"),
          last_recalled: new Date().toISOString(),
        })
        .eq("id", id)
        .then(() => {});
    });
  }
}

// log retrieval for transparency
async function logRetrieval(
  perspectiveId: string,
  query: string,
  result: RetrievalResult
): Promise<void> {
  await supabase
    .from("memory_retrieval_log")
    .insert({
      perspective_id: perspectiveId,
      query,
      memory_node_id: result.memory.id,
      retrieval_reason: result.retrieval_reason,
      final_score: result.score,
      weight_at_retrieval: result.weight,
      hierarchy_at_retrieval: result.hierarchy,
      association_path: result.association_path,
    })
    .then(() => {});
}

// get memory tree for a perspective
export async function getMemoryTree(perspectiveId: string): Promise<any[]> {
  const { data, error } = await supabase
    .rpc("get_memory_tree", { p_perspective_id: perspectiveId })
    .catch(() => null);

  if (data) return data;

  // fallback: manual query
  const { data: nodes, error: nodesError } = await supabase
    .from("memory_nodes")
    .select("*")
    .eq("perspective_id", perspectiveId)
    .order("category")
    .order("weight", { ascending: false });

  if (nodesError || !nodes) return [];
  return nodes;
}

// update memory weight or hierarchy manually
export async function updateMemoryMetrics(
  memoryId: string,
  updates: { weight?: number; hierarchy?: number; tags?: string[] }
): Promise<void> {
  const update: any = { updated_at: new Date().toISOString() };
  if (updates.weight !== undefined) update.weight = Math.max(0, Math.min(1, updates.weight));
  if (updates.hierarchy !== undefined) update.hierarchy = Math.max(0, Math.min(1, updates.hierarchy));
  if (updates.tags !== undefined) update.tags = updates.tags;

  const { error } = await supabase
    .from("memory_nodes")
    .update(update)
    .eq("id", memoryId);

  if (error) throw error;
}

// delete a memory
export async function deleteMemory(memoryId: string): Promise<void> {
  // also delete associations
  await supabase
    .from("memory_associations")
    .delete()
    .or(`source_node_id.eq.${memoryId},target_node_id.eq.${memoryId}`);

  const { error } = await supabase
    .from("memory_nodes")
    .delete()
    .eq("id", memoryId);

  if (error) throw error;
}

// extract facts from a transcript (heuristic; LLM in production)
export function extractFactsFromTranscript(
  transcript: string,
  perspectiveId: string
): IndexedFact[] {
  const facts: IndexedFact[] = [];
  const lines = transcript.split("\n");

  for (const line of lines) {
    const lower = line.toLowerCase();

    // detect identity statements: "i am a developer"
    if (/i am a\b/i.test(line) || /i'm a\b/i.test(line)) {
      const match = line.match(/i am a (.+)|i'm a (.+)/i);
      const identity = match?.[1] || match?.[2];
      if (identity) {
        facts.push({
          key: identity.trim().toLowerCase(),
          value: line.trim(),
          category: "identity",
          weight: 0.85,
          hierarchy: 0.65,
          tags: ["identity", "self_described"],
        });
      }
    }

    // detect preferences: "i like", "i prefer", "i love"
    if (/i (like|prefer|love|enjoy)\b/i.test(line)) {
      const match = line.match(/i (like|prefer|love|enjoy) (.+)/i);
      if (match) {
        facts.push({
          key: match[2].trim().toLowerCase(),
          value: line.trim(),
          category: "preferences",
          weight: 0.4,
          hierarchy: 0.15,
          tags: ["preference"],
        });
      }
    }

    // detect deadlines: "deadline is", "due on", "by friday"
    if (/deadline|due (on|by)|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(line)) {
      facts.push({
        key: `deadline: ${line.substring(0, 50).trim()}`,
        value: line.trim(),
        category: "schedule",
        weight: 0.2,
        hierarchy: 0.9,
        tags: ["deadline", "urgent"],
      });
    }

    // detect allergies/critical: "allergic to", "important", "critical"
    if (/allergic to|critical|important: must/i.test(line)) {
      const match = line.match(/allergic to (.+)/i);
      facts.push({
        key: match ? `allergic to ${match[1].trim().toLowerCase()}` : line.substring(0, 50).trim(),
        value: line.trim(),
        category: "preferences",
        weight: 0.9,
        hierarchy: 0.7,
        tags: ["critical", "health"],
      });
    }
  }

  return facts;
}
