import { Hono } from "hono";
import {
  wrangleTag,
  wrangleTags,
  createCanonicalTag,
  addAlias,
  mergeTags,
  setTagExclusion,
  setTagAssociation,
  setTagPersonaRelevance,
  listCanonicalTags,
  getAliases,
  getChildTags,
  getTagExclusions,
  getTagAssociations,
  areTagsExclusive,
} from "../services/tag_wrangler.ts";
import { retrieveV2 } from "../services/memorium_retrieval_v2.ts";

const app = new Hono();

// ============================================================================
// tag wrangling
// ============================================================================

// POST /api/memorium/tags/wrangle
// body: { tags: ["coding", "dev", "software development"] }
// returns: canonical tags for each input
app.post("/tags/wrangle", async (c) => {
  const body = await c.req.json();
  if (!body.tags || !Array.isArray(body.tags)) {
    return c.json({ error: "tags array required" }, 400);
  }
  try {
    const results = await wrangleTags(body.tags);
    return c.json({
      input: body.tags,
      wrangled: results.map(r => ({
        input: r.input,
        canonical: r.canonical,
        canonical_id: r.canonical_id,
        confidence: r.confidence,
        alias_type: r.alias_type,
        suggestions: r.suggestions,
      })),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/tags/wrangle-single
app.post("/tags/wrangle-single", async (c) => {
  const body = await c.req.json();
  if (!body.tag) return c.json({ error: "tag required" }, 400);
  try {
    const result = await wrangleTag(body.tag);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// canonical tag management
// ============================================================================

// GET /api/memorium/tags?category=X&parentId=Y
app.get("/tags", async (c) => {
  const category = c.req.query("category");
  const parentId = c.req.query("parentId");
  try {
    const tags = await listCanonicalTags({
      category: category || undefined,
      parentId: parentId || undefined,
    });
    return c.json({ count: tags.length, tags });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/tags
// body: { canonical, description, parent_tag_id, category, weight }
app.post("/tags", async (c) => {
  const body = await c.req.json();
  if (!body.canonical) return c.json({ error: "canonical required" }, 400);
  try {
    const tag = await createCanonicalTag(body.canonical, {
      description: body.description,
      parent_tag_id: body.parent_tag_id,
      category: body.category,
      weight: body.weight,
    });
    return c.json({ tag });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// tag aliases
// ============================================================================

// GET /api/memorium/tags/:tagId/aliases
app.get("/tags/:tagId/aliases", async (c) => {
  const tagId = c.req.param("tagId");
  try {
    const aliases = await getAliases(tagId);
    return c.json({ count: aliases.length, aliases });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/tags/:tagId/aliases
// body: { alias, alias_type }
app.post("/tags/:tagId/aliases", async (c) => {
  const tagId = c.req.param("tagId");
  const body = await c.req.json();
  if (!body.alias) return c.json({ error: "alias required" }, 400);
  try {
    const alias = await addAlias(tagId, body.alias, body.alias_type || "synonym");
    return c.json({ alias });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// tag hierarchy
// ============================================================================

// GET /api/memorium/tags/:tagId/children
app.get("/tags/:tagId/children", async (c) => {
  const tagId = c.req.param("tagId");
  try {
    const children = await getChildTags(tagId);
    return c.json({ count: children.length, children });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// tag exclusions
// ============================================================================

// GET /api/memorium/tags/:tagId/exclusions
app.get("/tags/:tagId/exclusions", async (c) => {
  const tagId = c.req.param("tagId");
  try {
    const exclusions = await getTagExclusions(tagId);
    return c.json({ count: exclusions.length, exclusions });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/tags/exclusions
// body: { tag_a_id, tag_b_id, reason }
app.post("/tags/exclusions", async (c) => {
  const body = await c.req.json();
  if (!body.tag_a_id || !body.tag_b_id) return c.json({ error: "tag_a_id and tag_b_id required" }, 400);
  try {
    const exclusion = await setTagExclusion(body.tag_a_id, body.tag_b_id, body.reason);
    return c.json({ exclusion });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/tags/exclusions/check
app.post("/tags/exclusions/check", async (c) => {
  const body = await c.req.json();
  if (!body.tag_a_id || !body.tag_b_id) return c.json({ error: "tag_a_id and tag_b_id required" }, 400);
  try {
    const exclusive = await areTagsExclusive(body.tag_a_id, body.tag_b_id);
    return c.json({ exclusive });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// tag associations
// ============================================================================

// GET /api/memorium/tags/:tagId/associations
app.get("/tags/:tagId/associations", async (c) => {
  const tagId = c.req.param("tagId");
  try {
    const associations = await getTagAssociations(tagId);
    return c.json({ count: associations.length, associations });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/memorium/tags/associations
// body: { source_tag_id, target_tag_id, strength, association_type }
app.post("/tags/associations", async (c) => {
  const body = await c.req.json();
  if (!body.source_tag_id || !body.target_tag_id) return c.json({ error: "source_tag_id and target_tag_id required" }, 400);
  try {
    const assoc = await setTagAssociation(body.source_tag_id, body.target_tag_id, body.strength || 0.5, body.association_type || "related");
    return c.json({ association: assoc });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// tag persona relevance
// ============================================================================

// POST /api/memorium/tags/relevance
// body: { tag_id, perspective_id, relevance_weight }
app.post("/tags/relevance", async (c) => {
  const body = await c.req.json();
  if (!body.tag_id || !body.perspective_id) return c.json({ error: "tag_id and perspective_id required" }, 400);
  try {
    const relevance = await setTagPersonaRelevance(body.tag_id, body.perspective_id, body.relevance_weight || 0.5);
    return c.json({ relevance });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// tag merge
// ============================================================================

// POST /api/memorium/tags/merge
// body: { winner_id, loser_id }
app.post("/tags/merge", async (c) => {
  const body = await c.req.json();
  if (!body.winner_id || !body.loser_id) return c.json({ error: "winner_id and loser_id required" }, 400);
  try {
    await mergeTags(body.winner_id, body.loser_id);
    return c.json({ merged: true, winner_id: body.winner_id, loser_deactivated: body.loser_id });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============================================================================
// v2 retrieval (underconfident, tag-wrangled, multimodal-aware)
// ============================================================================

// POST /api/memorium/retrieve-v2
// body: { perspective_id, query, tags?, limit?, min_weight?, include_associations?, association_depth?, include_shared? }
app.post("/retrieve-v2", async (c) => {
  const body = await c.req.json();
  if (!body.perspective_id || !body.query) {
    return c.json({ error: "perspective_id and query required" }, 400);
  }
  try {
    const result = await retrieveV2({
      perspectiveId: body.perspective_id,
      query: body.query,
      tags: body.tags,
      limit: body.limit || 10,
      minWeight: body.min_weight || 0,
      includeAssociations: body.include_associations ?? true,
      associationDepth: body.association_depth ?? 2,
      includeShared: body.include_shared ?? true,
      includeParent: body.include_parent ?? true,
    });

    return c.json({
      decision: result.decision,
      confidence_score: result.confidence_score,
      message: result.message,
      query: body.query,
      results: result.results.length,
      components: result.components,
      memories: result.results.map(r => ({
        id: r.memory.id,
        key: r.memory.key,
        value: r.memory.value,
        category: r.memory.category,
        content_type: r.memory.content_type || "text",
        content_url: r.memory.content_url || null,
        weight: r.memory.weight,
        hierarchy: r.memory.hierarchy,
        score: r.score,
        components: r.components,
        retrieval_reason: r.retrieval_reason,
        tag_wrangling: r.tag_wrangling,
        association_path: r.association_path,
        parent: r.parent_context?.key || null,
        siblings: r.sibling_context?.map((s: any) => s.key) || [],
      })),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
