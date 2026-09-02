import type {
  MemoryNode,
  MemoryAssociation,
  PersonaPermission,
  PersonaSharing,
  RetrievalResult,
  Perspective,
} from './memorium-types';

const API_BASE = '/api/memorium';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `request failed: ${res.status}`);
  }
  return res.json();
}

// perspectives
export async function listPerspectives(): Promise<{ count: number; perspectives: Perspective[] }> {
  return fetchJSON('/perspectives');
}

export async function createPerspective(data: {
  name: string;
  display_name: string;
  tone?: string;
  initiative_level?: string;
  question_style?: string;
  voice_id?: string;
  background?: string;
  worldview?: string;
}): Promise<{ perspective: Perspective }> {
  return fetchJSON('/perspectives', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// memory
export async function getMemoryTree(perspectiveId: string): Promise<{ count: number; memories: MemoryNode[] }> {
  return fetchJSON(`/memory/${perspectiveId}`);
}

export async function addMemory(data: {
  perspective_id: string;
  key: string;
  value: string;
  category: string;
  weight: number;
  hierarchy: number;
  tags?: string[];
  source?: string;
}): Promise<{ memory: MemoryNode }> {
  return fetchJSON('/memory', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMemory(
  memoryId: string,
  updates: { weight?: number; hierarchy?: number; tags?: string[] }
): Promise<{ memory: MemoryNode }> {
  return fetchJSON(`/memory/${memoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteMemory(memoryId: string): Promise<{ deleted: boolean }> {
  return fetchJSON(`/memory/${memoryId}`, { method: 'DELETE' });
}

export async function indexTranscript(data: {
  perspective_id: string;
  transcript: string;
  meeting_id?: string;
}): Promise<{ extracted_facts: number; indexed: number }> {
  return fetchJSON('/memory/transcript', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// retrieval
export async function retrieveMemories(data: {
  perspective_id: string;
  query: string;
  limit?: number;
  min_weight?: number;
  include_associations?: boolean;
  association_depth?: number;
  include_shared?: boolean;
}): Promise<{ query: string; results: number; memories: RetrievalResult[] }> {
  return fetchJSON('/retrieve', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// associations
export async function getAssociations(nodeId: string): Promise<{ count: number; associations: MemoryAssociation[] }> {
  return fetchJSON(`/association/${nodeId}`);
}

export async function createAssociation(data: {
  source_id: string;
  target_id: string;
  strength: number;
  type?: string;
}): Promise<{ created: boolean }> {
  return fetchJSON('/association', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// permissions
export async function getPermissions(perspectiveId: string): Promise<{ count: number; permissions: PersonaPermission[] }> {
  return fetchJSON(`/permissions/${perspectiveId}`);
}

export async function setPermission(data: {
  perspective_id: string;
  source_type: string;
  source_id?: string;
  source_label?: string;
  access_level: string;
}): Promise<{ permission: PersonaPermission }> {
  return fetchJSON('/permissions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// sharing
export async function getSharing(perspectiveId: string): Promise<{ count: number; sharing_rules: PersonaSharing[] }> {
  return fetchJSON(`/sharing/${perspectiveId}`);
}

export async function createSharing(data: {
  source_perspective_id: string;
  target_perspective_id: string;
  direction: string;
  condition_tags?: string[];
  condition_category?: string;
  min_weight?: number;
}): Promise<{ sharing_rule: PersonaSharing }> {
  return fetchJSON('/sharing', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// accessible perspectives
export async function getAccessible(perspectiveId: string): Promise<{ accessible: Perspective[] }> {
  return fetchJSON(`/accessible/${perspectiveId}`);
}

// decay
export async function runDecay(perspectiveId?: string): Promise<{ memories_updated: number }> {
  return fetchJSON('/decay', {
    method: 'POST',
    body: JSON.stringify({ perspective_id: perspectiveId }),
  });
}
