-- memorium schema v2: tag wrangling, multimodal, underconfident retrieval
-- extends memorium_schema.sql with AO3-style tag system and multimodal storage
-- run AFTER memorium_schema.sql

-- =============================================================================
-- 1. memory_nodes updates: multimodal support
-- =============================================================================

ALTER TABLE public.memory_nodes ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text'
  CHECK (content_type IN ('text', 'image', 'pdf', 'document', 'code', 'audio', 'video'));
ALTER TABLE public.memory_nodes ADD COLUMN IF NOT EXISTS content_url TEXT;
ALTER TABLE public.memory_nodes ADD COLUMN IF NOT EXISTS content_metadata JSONB DEFAULT '{}';

-- =============================================================================
-- 2. canonical_tags (the "official" tag names — AO3 style)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.canonical_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical TEXT NOT NULL UNIQUE,           -- the official tag name
    description TEXT,
    parent_tag_id UUID REFERENCES public.canonical_tags(id) ON DELETE SET NULL, -- hierarchy
    category TEXT,                            -- identity, preferences, schedule, relationships, etc.
    weight FLOAT DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),  -- default weight for memories with this tag
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canonical_tags_canonical ON public.canonical_tags(canonical);
CREATE INDEX IF NOT EXISTS idx_canonical_tags_parent ON public.canonical_tags(parent_tag_id);
CREATE INDEX IF NOT EXISTS idx_canonical_tags_category ON public.canonical_tags(category);
CREATE INDEX IF NOT EXISTS idx_canonical_tags_active ON public.canonical_tags(is_active);

-- =============================================================================
-- 3. tag_aliases (synonyms, misspellings, abbreviations, translations)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tag_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_tag_id UUID NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,                       -- the non-canonical form ("coding" → "programming")
    alias_type TEXT NOT NULL DEFAULT 'synonym'
      CHECK (alias_type IN ('synonym', 'misspelling', 'abbreviation', 'translation', 'variant')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(canonical_tag_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_tag_aliases_canonical ON public.tag_aliases(canonical_tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_aliases_alias ON public.tag_aliases(alias);

-- =============================================================================
-- 4. tag_exclusions (mutually exclusive tags)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tag_exclusions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_a_id UUID NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
    tag_b_id UUID NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tag_a_id, tag_b_id),
    CHECK (tag_a_id != tag_b_id)
);

-- =============================================================================
-- 5. tag_associations (related tags with strength)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tag_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_tag_id UUID NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
    target_tag_id UUID NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
    strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    association_type TEXT DEFAULT 'related'
      CHECK (association_type IN ('related', 'implies', 'often_co_occur', 'subsumes', 'contradicts')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_tag_id, target_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_assoc_source ON public.tag_associations(source_tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_assoc_target ON public.tag_associations(target_tag_id);

-- =============================================================================
-- 6. tag_persona_relevance (persona-specific tag weights)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tag_persona_relevance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID NOT NULL REFERENCES public.canonical_tags(id) ON DELETE CASCADE,
    perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relevance_weight FLOAT DEFAULT 0.5 CHECK (relevance_weight >= 0 AND relevance_weight <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tag_id, perspective_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_persona_relevance_tag ON public.tag_persona_relevance(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_persona_relevance_perspective ON public.tag_persona_relevance(perspective_id);

-- =============================================================================
-- 7. memory_retrieval_confidence (underconfident retrieval tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.memory_retrieval_confidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    retrieved_count INTEGER,
    confidence_score FLOAT,                    -- overall confidence in the retrieval
    decision TEXT,                             -- "confident", "uncertain", "unavailable", "needs_clarification"
    semantic_score FLOAT,                      -- semantic similarity component
    tag_match_score FLOAT,                     -- tag wrangling match component
    hierarchy_score FLOAT,                     -- hierarchy boost component
    weight_score FLOAT,                        -- weight threshold component
    persona_relevance_score FLOAT,             -- persona-specific relevance component
    notes TEXT,
    retrieved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_confidence_perspective ON public.memory_retrieval_confidence(perspective_id);
CREATE INDEX IF NOT EXISTS idx_retrieval_confidence_decision ON public.memory_retrieval_confidence(decision);

-- =============================================================================
-- 8. sandbox_access_log (strict sandbox enforcement audit trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sandbox_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perspective_id UUID NOT NULL,               -- who tried to access
    target_perspective_id UUID,                 -- whose data they tried to access
    memory_node_id UUID,                        -- specific memory they tried to read
    access_result TEXT NOT NULL,               -- "allowed", "denied_no_sharing_rule", "denied_condition_mismatch", "denied_min_weight"
    sharing_rule_id UUID,                       -- which sharing rule was checked (if any)
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_access_perspective ON public.sandbox_access_log(perspective_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_access_result ON public.sandbox_access_log(access_result);
CREATE INDEX IF NOT EXISTS idx_sandbox_access_timestamp ON public.sandbox_access_log(timestamp DESC);

-- =============================================================================
-- 9. multimodal_content (file storage for images, PDFs, documents, code)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.multimodal_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    memory_node_id UUID REFERENCES public.memory_nodes(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL
      CHECK (content_type IN ('text', 'image', 'pdf', 'document', 'code', 'audio', 'video')),
    file_name TEXT,
    file_url TEXT,                              -- Supabase Storage URL
    file_size BIGINT,
    mime_type TEXT,
    content_hash TEXT,                          -- dedup via content hash
    extracted_text TEXT,                        -- OCR/extracted text for searchable retrieval
    page_count INTEGER,                        -- for PDFs/documents
    line_count INTEGER,                         -- for code
    language TEXT,                              -- detected language (for code/text)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multimodal_perspective ON public.multimodal_content(perspective_id);
CREATE INDEX IF NOT EXISTS idx_multimodal_type ON public.multimodal_content(content_type);
CREATE INDEX IF NOT EXISTS idx_multimodal_memory ON public.multimodal_content(memory_node_id);
CREATE INDEX IF NOT EXISTS idx_multimodal_hash ON public.multimodal_content(content_hash);

-- =============================================================================
-- triggers
-- =============================================================================

DROP TRIGGER IF EXISTS set_canonical_tags_updated_at ON public.canonical_tags;
CREATE TRIGGER set_canonical_tags_updated_at BEFORE UPDATE ON public.canonical_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.canonical_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_persona_relevance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_retrieval_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sandbox_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multimodal_content ENABLE ROW LEVEL SECURITY;

-- service role has full access (backend uses service role key)
CREATE POLICY "service_role_all_canonical_tags" ON public.canonical_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_tag_aliases" ON public.tag_aliases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_tag_exclusions" ON public.tag_exclusions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_tag_associations" ON public.tag_associations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_tag_persona_relevance" ON public.tag_persona_relevance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_retrieval_confidence" ON public.memory_retrieval_confidence FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_sandbox_log" ON public.sandbox_access_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_multimodal" ON public.multimodal_content FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- views
-- =============================================================================

-- tag overview with counts
CREATE OR REPLACE VIEW public.tag_overview AS
SELECT
    ct.id,
    ct.canonical,
    ct.description,
    ct.category,
    ct.weight,
    ct.parent_tag_id,
    pt.canonical as parent_tag_name,
    ct.is_active,
    (SELECT COUNT(*) FROM public.tag_aliases ta WHERE ta.canonical_tag_id = ct.id) as alias_count,
    (SELECT COUNT(*) FROM public.canonical_tags children WHERE children.parent_tag_id = ct.id AND children.is_active = true) as child_count,
    (SELECT COUNT(*) FROM public.memory_nodes mn WHERE mn.tags @> ARRAY[ct.canonical]) as memory_count,
    (SELECT COUNT(*) FROM public.tag_associations tassoc WHERE tassoc.source_tag_id = ct.id OR tassoc.target_tag_id = ct.id) as association_count,
    (SELECT COUNT(*) FROM public.tag_exclusions te WHERE te.tag_a_id = ct.id OR te.tag_b_id = ct.id) as exclusion_count
FROM public.canonical_tags ct
LEFT JOIN public.canonical_tags pt ON ct.parent_tag_id = pt.id
WHERE ct.is_active = true;

-- retrieval confidence summary
CREATE OR REPLACE VIEW public.retrieval_confidence_summary AS
SELECT
    perspective_id,
    COUNT(*) as total_retrievals,
    COUNT(*) FILTER (WHERE decision = 'confident') as confident_count,
    COUNT(*) FILTER (WHERE decision = 'uncertain') as uncertain_count,
    COUNT(*) FILTER (WHERE decision = 'unavailable') as unavailable_count,
    COUNT(*) FILTER (WHERE decision = 'needs_clarification') as needs_clarification_count,
    AVG(confidence_score) as avg_confidence
FROM public.memory_retrieval_confidence
GROUP BY perspective_id;

-- sandbox access audit
CREATE OR REPLACE VIEW public.sandbox_access_audit AS
SELECT
    sal.id,
    p.name as perspective_name,
    tp.name as target_perspective_name,
    sal.access_result,
    mn.key as memory_key,
    sal.timestamp
FROM public.sandbox_access_log sal
LEFT JOIN public.profiles p ON sal.perspective_id = p.id
LEFT JOIN public.profiles tp ON sal.target_perspective_id = tp.id
LEFT JOIN public.memory_nodes mn ON sal.memory_node_id = mn.id
ORDER BY sal.timestamp DESC;
