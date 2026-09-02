-- memorium schema: weighted, hierarchical, associative persona memory
-- this is an extension to the prixie supabase schema
-- run after the base schema (supabase_schema.sql)

-- -----------------------------------------------------------------------------
-- 0a. rename profiles -> perspectives (or keep as-is, add memorium columns)
-- add memorium-specific columns to existing profiles table
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voice_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS worldview TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'neutral';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initiative_level TEXT DEFAULT 'passive'
  CHECK (initiative_level IN ('passive', 'active', 'proactive'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS question_style TEXT DEFAULT 'direct'
  CHECK (question_style IN ('direct', 'indirect', 'socratic'));
ALTER TABLE public.profits ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

-- fix: profiles not profits
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'language_preference') THEN
    NULL;
  ELSE
    ALTER TABLE public.profiles ADD COLUMN language_preference TEXT DEFAULT 'en';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 0b. memory_nodes (weighted, hierarchical, associative)
-- this replaces the flat profile_memory table with a structured memory store
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- nesting: parent node for hierarchical structure
    parent_id UUID REFERENCES public.memory_nodes(id) ON DELETE SET NULL,

    -- content
    key TEXT NOT NULL,           -- human-readable label (e.g. "likes coffee")
    value TEXT,                  -- the actual memory content
    category TEXT,              -- grouping (identity, preferences, schedule, relationships, etc.)

    -- two axes (the core insight)
    weight FLOAT DEFAULT 0.5 NOT NULL,     -- 0-1, identity core (does NOT decay)
    hierarchy FLOAT DEFAULT 0.5 NOT NULL, -- 0-1, behavior drive (decays over time)

    -- metadata
    confidence FLOAT DEFAULT 0.5,           -- 0-1, how sure we are this is accurate
    source TEXT DEFAULT 'user_input',       -- transcript, user_input, inference, shared, global
    source_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',              -- for conditional sharing rules

    -- lifecycle
    recall_count INTEGER DEFAULT 0,        -- how many times retrieved
    last_recalled TIMESTAMPTZ,              -- when last retrieved
    decay_rate FLOAT DEFAULT 0.01,          -- lambda for exponential decay

    -- timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- constraints
    CHECK (weight >= 0 AND weight <= 1),
    CHECK (hierarchy >= 0 AND hierarchy <= 1),
    CHECK (confidence >= 0 AND confidence <= 1)
);

-- index for fast perspective-scoped queries
CREATE INDEX IF NOT EXISTS idx_memory_nodes_perspective ON public.memory_nodes(perspective_id);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_category ON public.memory_nodes(category);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_parent ON public.memory_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_weight ON public.memory_nodes(weight DESC);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_hierarchy ON public.memory_nodes(hierarchy DESC);
CREATE INDEX IF NOT EXISTS idx_memory_nodes_tags ON public.memory_nodes USING gin(tags);

-- -----------------------------------------------------------------------------
-- 0c. memory_associations (relational edges between memory nodes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
    strength FLOAT DEFAULT 0.5 NOT NULL CHECK (strength >= 0 AND strength <= 1),
    association_type TEXT DEFAULT 'related'
      CHECK (association_type IN ('related', 'causes', 'part_of', 'contradicts', 'reinforces', 'derived_from')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_node_id, target_node_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_assoc_source ON public.memory_associations(source_node_id);
CREATE INDEX IF NOT EXISTS idx_memory_assoc_target ON public.memory_associations(target_node_id);

-- -----------------------------------------------------------------------------
-- 0d. persona_permissions (what each perspective can access)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN (
        'calendar', 'inbox', 'discord', 'slack', 'luma',
        'calendly', 'recall_ai', 'browserbase', 'notion',
        'apple_calendar', 'outlook', 'twitch', 'api'
    )),
    source_id TEXT,                          -- specific source identifier (calendar id, channel id, etc.)
    source_label TEXT,                       -- human-readable label ("work calendar", "study discord")
    access_level TEXT NOT NULL DEFAULT 'read'
      CHECK (access_level IN ('read', 'write', 'read_write', 'denied')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(perspective_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_perms_perspective ON public.persona_permissions(perspective_id);
CREATE INDEX IF NOT EXISTS idx_persona_perms_source ON public.persona_permissions(source_type);

-- -----------------------------------------------------------------------------
-- 0e. persona_sharing (how perspectives share memory)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_sharing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    direction TEXT NOT NULL DEFAULT 'one_way'
      CHECK (direction IN ('one_way', 'bidirectional')),
    condition_tags TEXT[] DEFAULT '{}',      -- share only memories with these tags
    condition_category TEXT,                 -- share only memories in this category
    min_weight FLOAT DEFAULT 0,              -- share only memories above this weight
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (source_perspective_id != target_perspective_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_sharing_source ON public.persona_sharing(source_perspective_id);
CREATE INDEX IF NOT EXISTS idx_persona_sharing_target ON public.persona_sharing(target_perspective_id);
CREATE INDEX IF NOT EXISTS idx_persona_sharing_active ON public.persona_sharing(active);

-- -----------------------------------------------------------------------------
-- 0f. memory_retrieval_log (transparency: why was this memory retrieved?)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_retrieval_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perspective_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,                     -- the query that triggered retrieval
    memory_node_id UUID NOT NULL REFERENCES public.memory_nodes(id) ON DELETE CASCADE,
    retrieval_reason TEXT,                   -- why it was retrieved (semantic, association, nesting, etc.)
    final_score FLOAT,                       -- final weighted score
    weight_at_retrieval FLOAT,              -- weight at time of retrieval
    hierarchy_at_retrieval FLOAT,           -- hierarchy at time of retrieval
    association_path TEXT,                  -- how it was reached (e.g. "semantic -> association:0.8 -> nesting:parent")
    retrieved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_log_perspective ON public.memory_retrieval_log(perspective_id);
CREATE INDEX IF NOT EXISTS idx_retrieval_log_memory ON public.memory_retrieval_log(memory_node_id);

-- -----------------------------------------------------------------------------
-- triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_memory_nodes_updated_at ON public.memory_nodes;
CREATE TRIGGER set_memory_nodes_updated_at BEFORE UPDATE ON public.memory_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_persona_permissions_updated_at ON public.persona_permissions;
CREATE TRIGGER set_persona_permissions_updated_at BEFORE UPDATE ON public.persona_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_persona_sharing_updated_at ON public.persona_sharing;
CREATE TRIGGER set_persona_sharing_updated_at BEFORE UPDATE ON public.persona_sharing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.memory_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_retrieval_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_memory_nodes" ON public.memory_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_memory_assoc" ON public.memory_associations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_persona_perms" ON public.persona_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_persona_sharing" ON public.persona_sharing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_retrieval_log" ON public.memory_retrieval_log FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- helpful views
-- -----------------------------------------------------------------------------

-- memory tree for a perspective (nested structure with depth)
CREATE OR REPLACE VIEW public.memory_tree AS
WITH RECURSIVE tree AS (
    SELECT
        id, perspective_id, parent_id, key, value, category,
        weight, hierarchy, confidence, tags, source,
        0 as depth,
        key::TEXT as path
    FROM public.memory_nodes
    WHERE parent_id IS NULL
    UNION ALL
    SELECT
        n.id, n.perspective_id, n.parent_id, n.key, n.value, n.category,
        n.weight, n.hierarchy, n.confidence, n.tags, n.source,
        t.depth + 1,
        t.path || ' > ' || n.key
    FROM public.memory_nodes n
    JOIN tree t ON n.parent_id = t.id
)
SELECT * FROM tree ORDER BY perspective_id, path;

-- perspective overview with memory stats
CREATE OR REPLACE VIEW public.perspective_overview AS
SELECT
    p.id,
    p.name,
    p.display_name,
    p.tone,
    p.initiative_level,
    p.question_style,
    p.is_default,
    COUNT(DISTINCT mn.id) as memory_count,
    COUNT(DISTINCT CASE WHEN mn.weight >= 0.8 THEN 1 END) as high_weight_count,
    COUNT(DISTINCT CASE WHEN mn.hierarchy >= 0.8 THEN 1 END) as high_hierarchy_count,
    COUNT(DISTINCT CASE WHEN mn.category = 'identity' THEN 1 END) as identity_memories,
    COUNT(DISTINCT pp.id) as permission_count,
    COUNT(DISTINCT ps.id) as sharing_rule_count
FROM public.profiles p
LEFT JOIN public.memory_nodes mn ON mn.perspective_id = p.id
LEFT JOIN public.persona_permissions pp ON pp.perspective_id = p.id
LEFT JOIN public.persona_sharing ps ON (ps.source_perspective_id = p.id OR ps.target_perspective_id = p.id)
    AND ps.active = TRUE
GROUP BY p.id, p.name, p.display_name, p.tone, p.initiative_level, p.question_style, p.is_default;

-- sharing graph (who shares with whom)
CREATE OR REPLACE VIEW public.sharing_graph AS
SELECT
    ps.id,
    sp.name as source_perspective,
    tp.name as target_perspective,
    ps.direction,
    ps.condition_tags,
    ps.condition_category,
    ps.min_weight,
    ps.active,
    COUNT(mn.id) as shared_memory_count
FROM public.persona_sharing ps
JOIN public.profiles sp ON ps.source_perspective_id = sp.id
JOIN public.profiles tp ON ps.target_perspective_id = tp.id
LEFT JOIN public.memory_nodes mn ON mn.perspective_id = ps.source_perspective_id
    AND (
        ps.condition_tags = '{}' OR array_overlap(mn.tags, ps.condition_tags)
    )
    AND (ps.condition_category IS NULL OR mn.category = ps.condition_category)
    AND mn.weight >= ps.min_weight
GROUP BY ps.id, sp.name, tp.name, ps.direction, ps.condition_tags, ps.condition_category, ps.min_weight, ps.active;
