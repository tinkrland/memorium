// memorium types

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

export interface PersonaPermission {
  id: string;
  perspective_id: string;
  source_type: string;
  source_id: string | null;
  source_label: string | null;
  access_level: 'read' | 'write' | 'read_write' | 'denied';
}

export interface PersonaSharing {
  id: string;
  source_perspective_id: string;
  target_perspective_id: string;
  direction: 'one_way' | 'bidirectional';
  condition_tags: string[];
  condition_category: string | null;
  min_weight: number;
  active: boolean;
}

export interface RetrievalResult {
  id: string;
  key: string;
  value: string | null;
  category: string | null;
  weight: number;
  hierarchy: number;
  score: number;
  retrieval_reason: string;
  association_path: string | null;
  parent: string | null;
  siblings: string[];
}

export interface Perspective extends Profile {
  voice_id?: string;
  background?: string;
  worldview?: string;
  tone?: string;
  initiative_level?: 'passive' | 'active' | 'proactive';
  question_style?: 'direct' | 'indirect' | 'socratic';
  language_preference?: string;
}
