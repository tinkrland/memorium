import { Hono } from "hono";
import {
  indexMemory,
  indexMemoryBatch,
  retrieve,
  getMemoryTree,
  updateMemoryMetrics,
  deleteMemory,
  createAssociation,
  getAssociations,
  runDecayCycle,
  getAccessiblePerspectives,
  canShareMemory,
  extractFactsFromTranscript,
  type RetrievalOptions,
} from "../services/memorium.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();

// ============================================================================
// memory CRUD
// ============================================================================

// POST /api/memorium/memory
// body: { perspective_id, key, value, category, weight, hierarchy, tags, source, meeting_id }
app.post("/memory", async (c) => {
  const body = await c.req.json();

  if (!body.perspective_id || !body.key) {
    return c.json({ error: "perspective_id and key required" }, 400);
  }

  try {
    const node = await indexMemory(
      body.perspective_id,
      {
        key: body.key,
        value: body.value,
        category: body.category || "general",
        weight: body.weight ?? 0.5,
        hierarchy: body.hierarchy ?? 0.5,
        tags: body.tags || [],
      },
      body.source || "user_input",
      body.meeting_id
    );
    return c.json({ memory: node });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/memory/batch
// body: { perspective_id, facts: [...], source, meeting_id }
app.post("/memory/batch", async (c) => {
  const body = await c.req.json();

  if (!body.perspective_id || !body.facts) {
    return c.json({ error: "perspective_id and facts array required" }, 400);
  }

  try {
    const nodes = await indexMemoryBatch(
      body.perspective_id,
      body.facts,
      body.source || "user_input",
      body.meeting_id
    );
    return c.json({ indexed: nodes.length, memories: nodes });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/memory/transcript
// body: { perspective_id, transcript, meeting_id }
// extracts facts from transcript and indexes them
app.post("/memory/transcript", async (c) => {
  const body = await c.req.json();

  if (!body.perspective_id || !body.transcript) {
    return c.json({ error: "perspective_id and transcript required" }, 400);
  }

  try {
    const facts = extractFactsFromTranscript(body.transcript, body.perspective_id);
    const nodes = await indexMemoryBatch(
      body.perspective_id,
      facts,
      "transcript",
      body.meeting_id
    );
    return c.json({
      extracted_facts: facts.length,
      indexed: nodes.length,
      facts: facts.map(f => ({ key: f.key, category: f.category, weight: f.weight, hierarchy: f.hierarchy })),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/memorium/memory/:perspectiveId
// get all memories for a perspective (tree view)
app.get("/memory/:perspectiveId", async (c) => {
  const perspectiveId = c.req.param("perspectiveId");
  try {
    const tree = await getMemoryTree(perspectiveId);
    return c.json({ count: tree.length, memories: tree });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// PATCH /api/memorium/memory/:memoryId
// update weight, hierarchy, or tags manually
app.patch("/memory/:memoryId", async (c) => {
  const memoryId = c.req.param("memoryId");
  const body = await c.req.json();

  try {
    await updateMemoryMetrics(memoryId, body);
    const { data: updated } = await supabase
      .from("memory_nodes")
      .select("*")
      .eq("id", memoryId)
      .single();
    return c.json({ memory: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE /api/memorium/memory/:memoryId
app.delete("/memory/:memoryId", async (c) => {
  const memoryId = c.req.param("memoryId");
  try {
    await deleteMemory(memoryId);
    return c.json({ deleted: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// retrieval
// ============================================================================

// POST /api/memorium/retrieve
// body: { perspective_id, query, limit, min_weight, min_hierarchy, include_associations, association_depth, include_shared }
app.post("/retrieve", async (c) => {
  const body = await c.req.json();

  if (!body.perspective_id || !body.query) {
    return c.json({ error: "perspective_id and query required" }, 400);
  }

  try {
    const results = await retrieve({
      perspectiveId: body.perspective_id,
      query: body.query,
      limit: body.limit || 10,
      minWeight: body.min_weight || 0,
      minHierarchy: body.min_hierarchy || 0,
      includeAssociations: body.include_associations ?? true,
      associationDepth: body.association_depth ?? 2,
      includeParent: body.include_parent ?? true,
      includeShared: body.include_shared ?? true,
    });

    return c.json({
      query: body.query,
      results: results.length,
      memories: results.map(r => ({
        id: r.memory.id,
        key: r.memory.key,
        value: r.memory.value,
        category: r.memory.category,
        weight: r.weight,
        hierarchy: r.hierarchy,
        score: r.score,
        retrieval_reason: r.retrieval_reason,
        association_path: r.association_path,
        parent: r.parent_context?.key || null,
        siblings: r.sibling_context.map(s => s.key),
      })),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// associations
// ============================================================================

// POST /api/memorium/association
// body: { source_id, target_id, strength, type }
app.post("/association", async (c) => {
  const body = await c.req.json();
  if (!body.source_id || !body.target_id) {
    return c.json({ error: "source_id and target_id required" }, 400);
  }

  try {
    await createAssociation(body.source_id, body.target_id, body.strength || 0.5, body.type || "related");
    return c.json({ created: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/memorium/association/:nodeId
app.get("/association/:nodeId", async (c) => {
  const nodeId = c.req.param("nodeId");
  try {
    const associations = await getAssociations(nodeId);
    return c.json({ count: associations.length, associations });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// permissions
// ============================================================================

// GET /api/memorium/permissions/:perspectiveId
app.get("/permissions/:perspectiveId", async (c) => {
  const perspectiveId = c.req.param("perspectiveId");
  const { data, error } = await supabase
    .from("persona_permissions")
    .select("*")
    .eq("perspective_id", perspectiveId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ count: data.length, permissions: data });
});

// POST /api/memorium/permissions
// body: { perspective_id, source_type, source_id, source_label, access_level }
app.post("/permissions", async (c) => {
  const body = await c.req.json();
  if (!body.perspective_id || !body.source_type) {
    return c.json({ error: "perspective_id and source_type required" }, 400);
  }

  const { data, error } = await supabase
    .from("persona_permissions")
    .upsert({
      perspective_id: body.perspective_id,
      source_type: body.source_type,
      source_id: body.source_id || null,
      source_label: body.source_label || body.source_type,
      access_level: body.access_level || "read",
    }, { onConflict: "perspective_id,source_type,source_id" })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ permission: data });
});

// ============================================================================
// sharing
// ============================================================================

// GET /api/memorium/sharing/:perspectiveId
app.get("/sharing/:perspectiveId", async (c) => {
  const perspectiveId = c.req.param("perspectiveId");
  const { data, error } = await supabase
    .from("persona_sharing")
    .select("*")
    .or(`source_perspective_id.eq.${perspectiveId},target_perspective_id.eq.${perspectiveId}`);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ count: data.length, sharing_rules: data });
});

// POST /api/memorium/sharing
// body: { source_perspective_id, target_perspective_id, direction, condition_tags, condition_category, min_weight }
app.post("/sharing", async (c) => {
  const body = await c.req.json();
  if (!body.source_perspective_id || !body.target_perspective_id) {
    return c.json({ error: "source_perspective_id and target_perspective_id required" }, 400);
  }

  const { data, error } = await supabase
    .from("persona_sharing")
    .insert({
      source_perspective_id: body.source_perspective_id,
      target_perspective_id: body.target_perspective_id,
      direction: body.direction || "one_way",
      condition_tags: body.condition_tags || [],
      condition_category: body.condition_category || null,
      min_weight: body.min_weight || 0,
      active: true,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ sharing_rule: data });
});

// POST /api/memorium/sharing/check
// body: { memory_id, source_perspective_id, target_perspective_id }
app.post("/sharing/check", async (c) => {
  const body = await c.req.json();
  if (!body.memory_id || !body.source_perspective_id || !body.target_perspective_id) {
    return c.json({ error: "memory_id, source_perspective_id, target_perspective_id required" }, 400);
  }

  try {
    const result = await canShareMemory(body.memory_id, body.source_perspective_id, body.target_perspective_id);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// perspectives (POV management)
// ============================================================================

// GET /api/memorium/perspectives
app.get("/perspectives", async (c) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*");

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ count: data.length, perspectives: data });
});

// POST /api/memorium/perspectives
// body: { name, display_name, tone, initiative_level, question_style, voice_id, background, worldview }
app.post("/perspectives", async (c) => {
  const body = await c.req.json();
  if (!body.name || !body.display_name) {
    return c.json({ error: "name and display_name required" }, 400);
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      name: body.name,
      display_name: body.display_name,
      tone: body.tone || "neutral",
      initiative_level: body.initiative_level || "passive",
      question_style: body.question_style || "direct",
      voice_id: body.voice_id || null,
      background: body.background || null,
      worldview: body.worldview || null,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ perspective: data });
});

// ============================================================================
// decay
// ============================================================================

// POST /api/memorium/decay
// body: { perspective_id } (optional, runs for all if omitted)
app.post("/decay", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  try {
    const updated = await runDecayCycle(body.perspective_id);
    return c.json({ memories_updated: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// accessible perspectives
// ============================================================================

// GET /api/memorium/accessible/:perspectiveId
app.get("/accessible/:perspectiveId", async (c) => {
  const perspectiveId = c.req.param("perspectiveId");
  try {
    const ids = await getAccessiblePerspectives(perspectiveId, true);
    const { data: perspectives } = await supabase
      .from("profiles")
      .select("id, name, display_name")
      .in("id", ids);
    return c.json({ accessible: perspectives || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
