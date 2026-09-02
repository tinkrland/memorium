// memorium: tag wrangler
// AO3-style tag wrangling system for the memorium memory structure
//
// tags are the primary organizational interface — not embeddings.
// humans organize information using concepts they understand,
// while the system continuously wrangles those concepts into a
// more consistent and retrievable structure.
//
// inspired by: https://github.com/otwcode/otwarchive (AO3's open-source codebase)
// tag wrangling concepts: canonical tags, synonyms, parent/child, exclusions, associations

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ============================================================================
// types
// ============================================================================

export interface CanonicalTag {
  id: string;
  canonical: string;           // the "official" tag name
  description: string | null;
  parent_tag_id: string | null; // hierarchy: "python" parent is "programming"
  category: string | null;      // grouping: identity, preferences, schedule, etc.
  weight: number;               // default weight for memories with this tag
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TagAlias {
  id: string;
  canonical_tag_id: string;
  alias: string;               // the non-canonical form ("coding" → canonical "programming")
  alias_type: "synonym" | "misspelling" | "abbreviation" | "translation" | "variant";
  created_at: string;
}

export interface TagExclusion {
  id: string;
  tag_a_id: string;             // mutually exclusive with tag_b
  tag_b_id: string;
  reason: string | null;
  created_at: string;
}

export interface TagAssociation {
  id: string;
  source_tag_id: string;
  target_tag_id: string;
  strength: number;             // 0-1, how strongly associated
  association_type: string;     // "related", "implies", "often_co_occur"
  created_at: string;
}

export interface TagPersonaRelevance {
  id: string;
  tag_id: string;
  perspective_id: string;
  relevance_weight: number;      // 0-1, how relevant this tag is to this persona
  created_at: string;
}

export interface WrangledTag {
  input: string;                // what the user typed
  canonical: string;            // what it maps to
  canonical_id: string;
  confidence: number;            // how confident the wrangling is
  alias_type: string | null;     // how it was matched (synonym, misspelling, etc.)
  suggestions: string[];         // if uncertain, other possible canonical tags
}

// ============================================================================
// tag resolution: the core wrangling operation
// ============================================================================

// resolve a raw user-provided tag to its canonical form
// this is the heart of the tag wrangling system
export async function wrangleTag(input: string): Promise<WrangledTag> {
  const normalized = normalizeTag(input);

  // step 1: check if it's already a canonical tag
  const { data: canonical } = await supabase
    .from("canonical_tags")
    .select("*")
    .ilike("canonical", normalized)
    .eq("is_active", true)
    .single();

  if (canonical) {
    return {
      input,
      canonical: canonical.canonical,
      canonical_id: canonical.id,
      confidence: 1.0,
      alias_type: null,
      suggestions: [],
    };
  }

  // step 2: check if it's an alias of a canonical tag
  const { data: alias } = await supabase
    .from("tag_aliases")
    .select(`
      *,
      canonical_tag:canonical_tags(*)
    `)
    .ilike("alias", normalized)
    .limit(1)
    .single();

  if (alias?.canonical_tag) {
    return {
      input,
      canonical: alias.canonical_tag.canonical,
      canonical_id: alias.canonical_tag.id,
      confidence: 0.95,
      alias_type: alias.alias_type,
      suggestions: [],
    };
  }

  // step 3: fuzzy match (find similar canonical tags)
  const { data: allTags } = await supabase
    .from("canonical_tags")
    .select("id, canonical")
    .eq("is_active", true);

  if (allTags && allTags.length > 0) {
    const fuzzy = fuzzyMatch(normalized, allTags.map(t => ({ id: t.id, text: t.canonical })));

    if (fuzzy.best && fuzzy.best.score >= 0.8) {
      return {
        input,
        canonical: fuzzy.best.text,
        canonical_id: fuzzy.best.id,
        confidence: fuzzy.best.score,
        alias_type: "variant",
        suggestions: fuzzy.alternates.map(a => a.text),
      };
    }

    if (fuzzy.best && fuzzy.best.score >= 0.6) {
      return {
        input,
        canonical: fuzzy.best.text,
        canonical_id: fuzzy.best.id,
        confidence: fuzzy.best.score,
        alias_type: "variant",
        suggestions: fuzzy.alternates.map(a => a.text),
      };
    }
  }

  // step 4: no match found — this is a new tag
  // create it as a new canonical tag (auto-wrangling)
  const { data: newTag, error } = await supabase
    .from("canonical_tags")
    .insert({
      canonical: normalized,
      is_active: true,
      weight: 0.5,
    })
    .select()
    .single();

  if (error || !newTag) {
    return {
      input,
      canonical: normalized,
      canonical_id: "unknown",
      confidence: 0.3,
      alias_type: null,
      suggestions: [],
    };
  }

  return {
    input,
    canonical: normalized,
    canonical_id: newTag.id,
    confidence: 0.5,
    alias_type: null,
    suggestions: [],
  };
}

// batch wrangle multiple tags
export async function wrangleTags(inputs: string[]): Promise<WrangledTag[]> {
  const results: WrangledTag[] = [];
  for (const input of inputs) {
    try {
      const result = await wrangleTag(input);
      results.push(result);
    } catch {
      results.push({
        input,
        canonical: normalizeTag(input),
        canonical_id: "unknown",
        confidence: 0.3,
        alias_type: null,
        suggestions: [],
      });
    }
  }
  return results;
}

// ============================================================================
// tag management
// ============================================================================

// create a new canonical tag
export async function createCanonicalTag(
  canonical: string,
  options: {
    description?: string;
    parent_tag_id?: string;
    category?: string;
    weight?: number;
  } = {}
): Promise<CanonicalTag> {
  const { data, error } = await supabase
    .from("canonical_tags")
    .insert({
      canonical: normalizeTag(canonical),
      description: options.description || null,
      parent_tag_id: options.parent_tag_id || null,
      category: options.category || null,
      weight: options.weight ?? 0.5,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// add an alias to a canonical tag (wrangling)
export async function addAlias(
  canonicalTagId: string,
  alias: string,
  aliasType: TagAlias["alias_type"] = "synonym"
): Promise<TagAlias> {
  const { data, error } = await supabase
    .from("tag_aliases")
    .insert({
      canonical_tag_id: canonicalTagId,
      alias: normalizeTag(alias),
      alias_type: aliasType,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// merge two canonical tags (move all aliases and memory associations to the winner)
export async function mergeTags(
  winnerId: string,
  loserId: string
): Promise<void> {
  // move all aliases from loser to winner
  await supabase
    .from("tag_aliases")
    .update({ canonical_tag_id: winnerId })
    .eq("canonical_tag_id", loserId);

  // add loser's canonical name as an alias of winner
  const { data: loser } = await supabase
    .from("canonical_tags")
    .select("canonical")
    .eq("id", loserId)
    .single();

  if (loser) {
    await addAlias(winnerId, loser.canonical, "synonym");
  }

  // move all tag associations
  await supabase
    .from("tag_associations")
    .update({ source_tag_id: winnerId })
    .eq("source_tag_id", loserId);
  await supabase
    .from("tag_associations")
    .update({ target_tag_id: winnerId })
    .eq("target_tag_id", loserId);

  // update memory node tags (replace loser with winner in tag arrays)
  // this requires finding all memory_nodes with the loser's canonical in their tags
  // and replacing it with the winner's canonical
  const { data: memories } = await supabase
    .from("memory_nodes")
    .select("id, tags")
    .contains("tags", [loser.canonical]);

  if (memories) {
    for (const mem of memories) {
      const newTags = mem.tags.map((t: string) => t === loser.canonical ? winner_canonical : t);
      await supabase
        .from("memory_nodes")
        .update({ tags: newTags })
        .eq("id", mem.id);
    }
  }

  // deactivate the loser tag
  await supabase
    .from("canonical_tags")
    .update({ is_active: false })
    .eq("id", loserId);
}

// set tag exclusion (mutually exclusive tags)
export async function setTagExclusion(
  tagAId: string,
  tagBId: string,
  reason?: string
): Promise<TagExclusion> {
  const { data, error } = await supabase
    .from("tag_exclusions")
    .insert({
      tag_a_id: tagAId,
      tag_b_id: tagBId,
      reason: reason || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// set tag association (related tags)
export async function setTagAssociation(
  sourceTagId: string,
  targetTagId: string,
  strength: number,
  associationType: string = "related"
): Promise<TagAssociation> {
  const { data, error } = await supabase
    .from("tag_associations")
    .upsert({
      source_tag_id: sourceTagId,
      target_tag_id: targetTagId,
      strength,
      association_type: associationType,
    }, { onConflict: "source_tag_id,target_tag_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// set persona-specific tag relevance
export async function setTagPersonaRelevance(
  tagId: string,
  perspectiveId: string,
  relevanceWeight: number
): Promise<TagPersonaRelevance> {
  const { data, error } = await supabase
    .from("tag_persona_relevance")
    .upsert({
      tag_id: tagId,
      perspective_id: perspectiveId,
      relevance_weight: relevanceWeight,
    }, { onConflict: "tag_id,perspective_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// tag retrieval for filtering
// ============================================================================

// get all canonical tags (for the filter sidebar)
export async function listCanonicalTags(filter?: {
  category?: string;
  parentId?: string;
}): Promise<(CanonicalTag & { alias_count: number; memory_count: number; child_count: number })[]> {
  let query = supabase
    .from("canonical_tags")
    .select("*")
    .eq("is_active", true);

  if (filter?.category) {
    query = query.eq("category", filter.category);
  }
  if (filter?.parentId) {
    query = query.eq("parent_tag_id", filter.parentId);
  }

  const { data: tags, error } = await query;

  if (error || !tags) return [];

  // enrich with counts
  const enriched = await Promise.all(tags.map(async (tag) => {
    const [aliases, children, memories] = await Promise.all([
      supabase.from("tag_aliases").select("id", { count: "exact", head: true }).eq("canonical_tag_id", tag.id),
      supabase.from("canonical_tags").select("id", { count: "exact", head: true }).eq("parent_tag_id", tag.id).eq("is_active", true),
      supabase.from("memory_nodes").select("id", { count: "exact", head: true }).contains("tags", [tag.canonical]),
    ]);

    return {
      ...tag,
      alias_count: aliases.count || 0,
      child_count: children.count || 0,
      memory_count: memories.count || 0,
    };
  }));

  return enriched;
}

// get aliases for a canonical tag
export async function getAliases(canonicalTagId: string): Promise<TagAlias[]> {
  const { data, error } = await supabase
    .from("tag_aliases")
    .select("*")
    .eq("canonical_tag_id", canonicalTagId);

  if (error) return [];
  return data || [];
}

// get child tags (hierarchy)
export async function getChildTags(parentTagId: string): Promise<CanonicalTag[]> {
  const { data, error } = await supabase
    .from("canonical_tags")
    .select("*")
    .eq("parent_tag_id", parentTagId)
    .eq("is_active", true);

  if (error) return [];
  return data || [];
}

// get tag exclusions
export async function getTagExclusions(tagId: string): Promise<{ excluded_tag: CanonicalTag; reason: string | null }[]> {
  const { data, error } = await supabase
    .from("tag_exclusions")
    .select(`
      reason,
      tag_a:canonical_tags!tag_a_id(*),
      tag_b:canonical_tags!tag_b_id(*)
    `)
    .or(`tag_a_id.eq.${tagId},tag_b_id.eq.${tagId}`);

  if (error || !data) return [];

  return data.map((row: any) => ({
    excluded_tag: row.tag_a_id === tagId ? row.tag_b : row.tag_a,
    reason: row.reason,
  }));
}

// get tag associations
export async function getTagAssociations(tagId: string): Promise<{ associated_tag: CanonicalTag; strength: number; type: string }[]> {
  const { data, error } = await supabase
    .from("tag_associations")
    .select(`
      strength,
      association_type,
      target:canonical_tags!target_tag_id(*),
      source:canonical_tags!source_tag_id(*)
    `)
    .or(`source_tag_id.eq.${tagId},target_tag_id.eq.${tagId}`);

  if (error || !data) return [];

  return data.map((row: any) => ({
    associated_tag: row.source_tag_id === tagId ? row.target : row.source,
    strength: row.strength,
    type: row.association_type,
  }));
}

// check if two tags are exclusive
export async function areTagsExclusive(tagAId: string, tagBId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tag_exclusions")
    .select("id")
    .or(`and(tag_a_id.eq.${tagAId},tag_b_id.eq.${tagBId}),and(tag_a_id.eq.${tagBId},tag_b_id.eq.${tagAId})`)
    .single();

  return !error && !!data;
}

// ============================================================================
// helpers
// ============================================================================

function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s-]/g, "");
}

// fuzzy string matching using Levenshtein distance
function fuzzyMatch(query: string, candidates: { id: string; text: string }[]): {
  best: { id: string; text: string; score: number } | null;
  alternates: { id: string; text: string; score: number }[];
} {
  const scored = candidates.map(c => ({
    id: c.id,
    text: c.text,
    score: similarity(query, c.text.toLowerCase()),
  }));

  scored.sort((a, b) => b.score - a.score);

  return {
    best: scored[0] || null,
    alternates: scored.slice(1, 4),
  };
}

// similarity score using Levenshtein distance (0-1, higher = more similar)
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}
