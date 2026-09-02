import { useState, useEffect, useCallback } from 'react';
import {
  listPerspectives,
  getMemoryTree,
  updateMemory,
  addMemory,
  deleteMemory,
  retrieveMemories,
  getAssociations,
  getPermissions,
  getSharing,
  createSharing,
  setPermission,
  runDecay,
} from '../lib/memorium-api';
import type {
  Perspective,
  MemoryNode,
  RetrievalResult,
  PersonaPermission,
  PersonaSharing,
  MemoryAssociation,
} from '../lib/memorium-types';

// ============================================================================
// helpers
// ============================================================================

function weightColor(w: number): string {
  if (w >= 0.8) return 'bg-primary';
  if (w >= 0.5) return 'bg-primary/70';
  if (w >= 0.3) return 'bg-primary/40';
  return 'bg-primary/15';
}

function hierarchyColor(h: number): string {
  if (h >= 0.8) return 'bg-accent';
  if (h >= 0.5) return 'bg-accent/70';
  if (h >= 0.3) return 'bg-accent/40';
  return 'bg-accent/15';
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground w-8">{label}</span>
      <div className="flex-1 h-3 border border-primary/30 bg-background overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">{pct}%</span>
    </div>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-block border border-primary/30 px-1.5 py-0.5 text-[9px] text-muted-foreground mr-1 mb-1">
      {text}
    </span>
  );
}

function sourceBadge(source: string): string {
  switch (source) {
    case 'user_input': return 'text-primary';
    case 'transcript': return 'text-accent';
    case 'inference': return 'text-muted-foreground';
    case 'shared': return 'text-blue-500';
    case 'system': return 'text-muted-foreground/50';
    default: return 'text-muted-foreground';
  }
}

// ============================================================================
// perspective switcher
// ============================================================================

function PerspectiveSwitcher({
  perspectives,
  activeId,
  onSelect,
}: {
  perspectives: Perspective[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-0 border border-primary">
      {perspectives.map((p, i) => {
        const isActive = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`flex-1 min-w-[120px] px-3 py-3 text-left transition-colors ${
              isActive ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-accent/10'
            } ${i > 0 ? 'border-l border-primary' : ''}`}
          >
            <div className="text-[8px] uppercase tracking-wider opacity-60 mb-1">
              {isActive ? '> active pov' : 'perspective'}
            </div>
            <div className="text-sm font-bold lowercase">{p.display_name || p.name}</div>
            {p.tone && (
              <div className={`text-[9px] mt-0.5 lowercase ${isActive ? 'opacity-70' : 'text-muted-foreground'}`}>
                {p.tone} · {p.initiative_level || 'passive'}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// memory node card
// ============================================================================

function MemoryNodeCard({
  node,
  onUpdate,
  onDelete,
  onSelectAssoc,
}: {
  node: MemoryNode;
  onUpdate: (id: string, updates: { weight?: number; hierarchy?: number }) => void;
  onDelete: (id: string) => void;
  onSelectAssoc?: (node: MemoryNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(node.weight);
  const [hierarchy, setHierarchy] = useState(node.hierarchy);

  const handleSave = () => {
    onUpdate(node.id, { weight, hierarchy });
    setEditing(false);
  };

  const isParent = !node.parent_id;

  return (
    <div className={`border ${isParent ? 'border-primary/40 bg-card/50' : 'border-primary/20 bg-card'} px-3 py-2`}>
      {/* header row */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-muted-foreground hover:text-foreground mt-0.5"
        >
          {expanded ? '[-]' : '[+]'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${isParent ? 'font-bold uppercase tracking-wide' : 'font-medium'} lowercase`}>
              {node.key}
            </span>
            <span className={`text-[8px] ${sourceBadge(node.source)}`}>
              [{node.source}]
            </span>
            {node.category && (
              <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">
                {node.category}
              </span>
            )}
          </div>
          {node.value && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {node.value}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <button
            onClick={() => onSelectAssoc?.(node)}
            className="text-[8px] text-muted-foreground hover:text-primary underline underline-offset-2"
          >
            assoc
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="text-[8px] text-muted-foreground hover:text-primary underline underline-offset-2"
          >
            edit
          </button>
          <button
            onClick={() => onDelete(node.id)}
            className="text-[8px] text-muted-foreground hover:text-destructive underline underline-offset-2"
          >
            del
          </button>
        </div>
      </div>

      {/* weight + hierarchy bars */}
      <div className="mt-2 space-y-1">
        <Bar value={node.weight} color={weightColor(node.weight)} label="w" />
        <Bar value={node.hierarchy} color={hierarchyColor(node.hierarchy)} label="h" />
      </div>

      {/* expanded view */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-primary/10 space-y-1">
          {node.tags.length > 0 && (
            <div>
              {node.tags.map(t => <Tag key={t} text={t} />)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] text-muted-foreground">
            <div>confidence: {(node.confidence * 100).toFixed(0)}%</div>
            <div>recalls: {node.recall_count}</div>
            <div>source: {node.source}</div>
            <div>created: {new Date(node.created_at).toLocaleDateString()}</div>
            {node.last_recalled && (
              <div>last recalled: {new Date(node.last_recalled).toLocaleDateString()}</div>
            )}
          </div>
        </div>
      )}

      {/* edit sliders */}
      {editing && (
        <div className="mt-2 pt-2 border-t border-primary/10 space-y-2">
          <div>
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground">
              weight (identity core) — {Math.round(weight * 100)}%
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={weight}
              onChange={e => setWeight(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wider text-muted-foreground">
              hierarchy (behavior drive) — {Math.round(hierarchy * 100)}%
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={hierarchy}
              onChange={e => setHierarchy(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="border border-primary px-2 py-1 text-[10px] hover:bg-primary hover:text-primary-foreground"
            >
              save
            </button>
            <button
              onClick={() => { setWeight(node.weight); setHierarchy(node.hierarchy); setEditing(false); }}
              className="border border-primary/30 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// memory tree view
// ============================================================================

function MemoryTree({
  memories,
  activePerspectiveId,
  onUpdate,
  onDelete,
  onSelectAssoc,
}: {
  memories: MemoryNode[];
  activePerspectiveId: string;
  onUpdate: (id: string, updates: { weight?: number; hierarchy?: number }) => void;
  onDelete: (id: string) => void;
  onSelectAssoc: (node: MemoryNode) => void;
}) {
  // group by category, then sort by weight
  const categories: Record<string, MemoryNode[]> = {};
  for (const m of memories) {
    const cat = m.category || 'general';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(m);
  }
  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => b.weight - a.weight);
  }

  const sortedCategories = Object.keys(categories).sort();

  return (
    <div className="space-y-3">
      {sortedCategories.map(cat => (
        <div key={cat}>
          <div className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold mb-1.5 border-b border-primary/20 pb-1">
            {cat} ({categories[cat].length})
          </div>
          <div className="space-y-1.5 pl-2 border-l border-primary/15">
            {categories[cat].map(node => (
              <MemoryNodeCard
                key={node.id}
                node={node}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onSelectAssoc={onSelectAssoc}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// retrieval panel
// ============================================================================

function RetrievalPanel({ perspectiveId }: { perspectiveId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [minWeight, setMinWeight] = useState(0);

  const handleRetrieve = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await retrieveMemories({
        perspective_id: perspectiveId,
        query,
        limit: 10,
        min_weight: minWeight,
        include_associations: true,
        association_depth: 2,
        include_shared: true,
      });
      setResults(data.memories);
    } catch (err) {
      console.error('retrieval failed:', err);
    }
    setLoading(false);
  };

  return (
    <div className="border border-primary p-3">
      <div className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold mb-2">
        retrieval — query the memory structure
      </div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRetrieve()}
          placeholder="should i take on this project?"
          className="flex-1 border border-primary/30 bg-background px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleRetrieve}
          disabled={loading}
          className="border border-primary px-3 py-1.5 text-xs hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
        >
          {loading ? '...' : 'retrieve'}
        </button>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-[9px] text-muted-foreground">min weight: {Math.round(minWeight * 100)}%</label>
        <input
          type="range" min="0" max="1" step="0.1"
          value={minWeight}
          onChange={e => setMinWeight(parseFloat(e.target.value))}
          className="flex-1 accent-primary max-w-[200px]"
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] text-muted-foreground">{results.length} memories retrieved</div>
          {results.map((r, i) => (
            <div key={r.id} className="border border-primary/20 bg-card px-2 py-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[10px] tabular-nums text-muted-foreground/60 mt-0.5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium lowercase">{r.key}</span>
                    {r.parent && (
                      <span className="text-[8px] text-muted-foreground">
                        parent: {r.parent}
                      </span>
                    )}
                  </div>
                  {r.value && <div className="text-[10px] text-muted-foreground truncate">{r.value}</div>}
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-[9px] text-muted-foreground">
                      score: <span className="text-primary font-bold tabular-nums">{r.score.toFixed(3)}</span>
                    </span>
                    <span className="text-[9px] text-muted-foreground">w:{(r.weight * 100).toFixed(0)}%</span>
                    <span className="text-[9px] text-muted-foreground">h:{(r.hierarchy * 100).toFixed(0)}%</span>
                    {r.association_path && (
                      <span className="text-[8px] text-blue-500">{r.association_path}</span>
                    )}
                  </div>
                  <div className="text-[8px] text-muted-foreground/60 mt-0.5">{r.retrieval_reason}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// associations panel
// ============================================================================

function AssociationPanel({ node, onClose }: { node: MemoryNode; onClose: () => void }) {
  const [associations, setAssociations] = useState<MemoryAssociation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAssociations(node.id)
      .then(data => setAssociations(data.associations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [node.id]);

  return (
    <div className="border border-primary p-3 bg-card/30">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">
          associations — {node.key}
        </div>
        <button onClick={onClose} className="text-[10px] text-muted-foreground hover:text-foreground">[x]</button>
      </div>

      {loading ? (
        <div className="text-[10px] text-muted-foreground">loading...</div>
      ) : associations.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">no associations found</div>
      ) : (
        <div className="space-y-1">
          {associations.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground">{node.key}</span>
              <span className="text-primary/40">──{(a.strength * 100).toFixed(0)}%──</span>
              <span className="text-muted-foreground truncate">{a.target_node_id.substring(0, 8)}</span>
              <span className="text-[8px] text-muted-foreground/50 ml-auto">{a.association_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// permissions matrix
// ============================================================================

function PermissionsMatrix({
  perspectiveId,
  permissions,
  onUpdate,
}: {
  perspectiveId: string;
  permissions: PersonaPermission[];
  onUpdate: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newSource, setNewSource] = useState('calendar');
  const [newLabel, setNewLabel] = useState('');
  const [newAccess, setNewAccess] = useState('read');

  const handleAdd = async () => {
    try {
      await setPermission({
        perspective_id: perspectiveId,
        source_type: newSource,
        source_label: newLabel || newSource,
        access_level: newAccess,
      });
      setShowAdd(false);
      setNewLabel('');
      onUpdate();
    } catch (err) {
      console.error('failed to set permission:', err);
    }
  };

  const accessColor = (level: string) => {
    switch (level) {
      case 'read_write': return 'text-primary';
      case 'read': return 'text-accent';
      case 'write': return 'text-primary/70';
      case 'denied': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="border border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">
          permissions — what can this pov access?
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] text-primary hover:underline"
        >
          {showAdd ? '[cancel]' : '[+ add]'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-2 flex gap-1 items-end">
          <select
            value={newSource}
            onChange={e => setNewSource(e.target.value)}
            className="border border-primary/30 bg-background px-2 py-1 text-[10px]"
          >
            <option value="calendar">calendar</option>
            <option value="inbox">inbox</option>
            <option value="discord">discord</option>
            <option value="slack">slack</option>
            <option value="luma">luma</option>
            <option value="calendly">calendly</option>
            <option value="recall_ai">recall.ai</option>
            <option value="browserbase">browserbase</option>
            <option value="notion">notion</option>
          </select>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="label (e.g. work calendar)"
            className="flex-1 border border-primary/30 bg-background px-2 py-1 text-[10px]"
          />
          <select
            value={newAccess}
            onChange={e => setNewAccess(e.target.value)}
            className="border border-primary/30 bg-background px-2 py-1 text-[10px]"
          >
            <option value="read">read</option>
            <option value="write">write</option>
            <option value="read_write">read+write</option>
            <option value="denied">denied</option>
          </select>
          <button
            onClick={handleAdd}
            className="border border-primary px-2 py-1 text-[10px] hover:bg-primary hover:text-primary-foreground"
          >
            set
          </button>
        </div>
      )}

      {permissions.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">no permissions configured</div>
      ) : (
        <div className="space-y-0.5">
          {permissions.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-[10px] py-0.5 border-b border-primary/10">
              <span className="text-muted-foreground w-20 uppercase tracking-wider text-[9px]">{p.source_type}</span>
              <span className="flex-1 truncate">{p.source_label || p.source_id || p.source_type}</span>
              <span className={`${accessColor(p.access_level)} font-mono`}>{p.access_level}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// sharing config
// ============================================================================

function SharingPanel({
  perspectiveId,
  perspectives,
  sharing,
  onUpdate,
}: {
  perspectiveId: string;
  perspectives: Perspective[];
  sharing: PersonaSharing[];
  onUpdate: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [direction, setDirection] = useState('one_way');
  const [condTags, setCondTags] = useState('');

  const handleAdd = async () => {
    if (!targetId) return;
    try {
      await createSharing({
        source_perspective_id: perspectiveId,
        target_perspective_id: targetId,
        direction,
        condition_tags: condTags ? condTags.split(',').map(s => s.trim()) : [],
      });
      setShowAdd(false);
      setTargetId('');
      setCondTags('');
      onUpdate();
    } catch (err) {
      console.error('failed to create sharing rule:', err);
    }
  };

  const getName = (id: string) => perspectives.find(p => p.id === id)?.display_name || id.substring(0, 8);

  return (
    <div className="border border-primary p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] uppercase tracking-[0.15em] text-primary/70 font-bold">
          sharing — sandboxed by default
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] text-primary hover:underline"
        >
          {showAdd ? '[cancel]' : '[+ add]'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-2 space-y-1.5">
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full border border-primary/30 bg-background px-2 py-1 text-[10px]"
          >
            <option value="">target perspective...</option>
            {perspectives.filter(p => p.id !== perspectiveId).map(p => (
              <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <select
              value={direction}
              onChange={e => setDirection(e.target.value)}
              className="border border-primary/30 bg-background px-2 py-1 text-[10px]"
            >
              <option value="one_way">one-way (source -> target)</option>
              <option value="bidirectional">bidirectional (<->)</option>
            </select>
            <input
              type="text"
              value={condTags}
              onChange={e => setCondTags(e.target.value)}
              placeholder="tags (comma sep: portfolio, achievement)"
              className="flex-1 border border-primary/30 bg-background px-2 py-1 text-[10px]"
            />
            <button
              onClick={handleAdd}
              className="border border-primary px-2 py-1 text-[10px] hover:bg-primary hover:text-primary-foreground"
            >
              add
            </button>
          </div>
        </div>
      )}

      {sharing.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">no sharing rules — fully sandboxed</div>
      ) : (
        <div className="space-y-1">
          {sharing.map(s => {
            const isSource = s.source_perspective_id === perspectiveId;
            const otherId = isSource ? s.target_perspective_id : s.source_perspective_id;
            const otherName = getName(otherId);
            return (
              <div key={s.id} className="flex items-center gap-2 text-[10px] py-1 border-b border-primary/10">
                <span className="text-muted-foreground">
                  {isSource ? 'this pov' : getName(s.source_perspective_id)}
                </span>
                <span className="text-primary/40">
                  {s.direction === 'bidirectional' ? '<->' : '-->'}
                </span>
                <span className="text-muted-foreground">
                  {!isSource ? 'this pov' : otherName}
                </span>
                {s.condition_tags.length > 0 && (
                  <span className="text-[8px] text-blue-500">
                    [tags: {s.condition_tags.join(', ')}]
                  </span>
                )}
                {s.condition_category && (
                  <span className="text-[8px] text-accent">
                    [cat: {s.condition_category}]
                  </span>
                )}
                {s.min_weight > 0 && (
                  <span className="text-[8px] text-muted-foreground">
                    [min w: {(s.min_weight * 100).toFixed(0)}%]
                  </span>
                )}
                <span className={`ml-auto text-[8px] ${s.active ? 'text-primary' : 'text-destructive'}`}>
                  {s.active ? 'active' : 'inactive'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// add memory form
// ============================================================================

function AddMemoryForm({ perspectiveId, onAdded }: { perspectiveId: string; onAdded: () => void }) {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('general');
  const [weight, setWeight] = useState(0.5);
  const [hierarchy, setHierarchy] = useState(0.5);
  const [tags, setTags] = useState('');

  const handleAdd = async () => {
    if (!key.trim()) return;
    try {
      await addMemory({
        perspective_id: perspectiveId,
        key: key.trim(),
        value: value.trim(),
        category,
        weight,
        hierarchy,
        tags: tags ? tags.split(',').map(s => s.trim()) : [],
        source: 'user_input',
      });
      setKey(''); setValue(''); setTags(''); setWeight(0.5); setHierarchy(0.5);
      setShow(false);
      onAdded();
    } catch (err) {
      console.error('failed to add memory:', err);
    }
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full border border-primary/30 border-dashed py-2 text-[10px] text-muted-foreground hover:text-primary hover:border-primary transition-colors"
      >
        [+ add memory]
      </button>
    );
  }

  return (
    <div className="border border-primary p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-primary/70 font-bold">add memory</span>
        <button onClick={() => setShow(false)} className="text-[10px] text-muted-foreground hover:text-foreground">[x]</button>
      </div>
      <input
        type="text" value={key} onChange={e => setKey(e.target.value)}
        placeholder="key (e.g. allergic to shellfish)"
        className="w-full border border-primary/30 bg-background px-2 py-1 text-[10px]"
      />
      <input
        type="text" value={value} onChange={e => setValue(e.target.value)}
        placeholder="value (e.g. i am allergic to shellfish)"
        className="w-full border border-primary/30 bg-background px-2 py-1 text-[10px]"
      />
      <div className="flex gap-2">
        <select
          value={category} onChange={e => setCategory(e.target.value)}
          className="border border-primary/30 bg-background px-2 py-1 text-[10px]"
        >
          <option value="identity">identity</option>
          <option value="preferences">preferences</option>
          <option value="schedule">schedule</option>
          <option value="relationships">relationships</option>
          <option value="general">general</option>
        </select>
        <input
          type="text" value={tags} onChange={e => setTags(e.target.value)}
          placeholder="tags (comma sep)"
          className="flex-1 border border-primary/30 bg-background px-2 py-1 text-[10px]"
        />
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground">weight (identity core): {Math.round(weight * 100)}%</label>
        <input type="range" min="0" max="1" step="0.05" value={weight} onChange={e => setWeight(parseFloat(e.target.value))} className="w-full accent-primary" />
      </div>
      <div>
        <label className="text-[9px] text-muted-foreground">hierarchy (behavior drive): {Math.round(hierarchy * 100)}%</label>
        <input type="range" min="0" max="1" step="0.05" value={hierarchy} onChange={e => setHierarchy(parseFloat(e.target.value))} className="w-full accent-accent" />
      </div>
      <button
        onClick={handleAdd}
        className="border border-primary px-3 py-1.5 text-[10px] hover:bg-primary hover:text-primary-foreground"
      >
        add to memory
      </button>
    </div>
  );
}

// ============================================================================
// main memorium page
// ============================================================================

export default function MemoriumPage() {
  const [perspectives, setPerspectives] = useState<Perspective[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryNode[]>([]);
  const [permissions, setPermissions] = useState<PersonaPermission[]>([]);
  const [sharing, setSharing] = useState<PersonaSharing[]>([]);
  const [assocNode, setAssocNode] = useState<MemoryNode | null>(null);
  const [tab, setTab] = useState<'memory' | 'retrieve' | 'permissions' | 'sharing'>('memory');
  const [loading, setLoading] = useState(true);

  const loadPerspectives = useCallback(async () => {
    try {
      const data = await listPerspectives();
      setPerspectives(data.perspectives);
      if (data.perspectives.length > 0 && !activeId) {
        setActiveId(data.perspectives[0].id);
      }
    } catch {
      // backend not connected, show demo data
      setPerspectives([
        { id: 'demo-student', name: 'student', display_name: 'student you', tone: 'curious', initiative_level: 'active', question_style: 'direct', is_default: false, shared_memory: false } as any,
        { id: 'demo-employee', name: 'employee', display_name: 'employee you', tone: 'professional', initiative_level: 'passive', question_style: 'indirect', is_default: false, shared_memory: false } as any,
        { id: 'demo-hobbyist', name: 'hobbyist', display_name: 'hobbyist you', tone: 'casual', initiative_level: 'proactive', question_style: 'direct', is_default: false, shared_memory: false } as any,
        { id: 'demo-founder', name: 'founder', display_name: 'founder you', tone: 'ambitious', initiative_level: 'proactive', question_style: 'socratic', is_default: false, shared_memory: false } as any,
      ]);
      if (!activeId) setActiveId('demo-student');
    }
  }, []);

  const loadMemory = useCallback(async () => {
    if (!activeId) return;
    if (activeId.startsWith('demo-')) {
      // demo data
      setMemories([
        { id: 'd1', perspective_id: activeId, parent_id: null, key: 'identity', value: null, category: 'identity', weight: 0.95, hierarchy: 0.85, confidence: 1, source: 'user_input', source_meeting_id: null, tags: ['identity'], recall_count: 12, last_recalled: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'd2', perspective_id: activeId, parent_id: 'd1', key: 'developer', value: 'i am a developer', category: 'identity', weight: 0.95, hierarchy: 0.85, confidence: 1, source: 'user_input', source_meeting_id: null, tags: ['identity', 'self_described'], recall_count: 15, last_recalled: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'd3', perspective_id: activeId, parent_id: 'd1', key: 'student', value: 'i am a cs student', category: 'identity', weight: 0.85, hierarchy: 0.80, confidence: 1, source: 'transcript', source_meeting_id: null, tags: ['identity'], recall_count: 8, last_recalled: new Date(Date.now() - 86400000).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'd4', perspective_id: activeId, parent_id: null, key: 'preferences', value: null, category: 'preferences', weight: 0.5, hierarchy: 0.3, confidence: 1, source: 'system', source_meeting_id: null, tags: [], recall_count: 0, last_recalled: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'd5', perspective_id: activeId, parent_id: 'd4', key: 'likes coffee', value: 'i like coffee', category: 'preferences', weight: 0.30, hierarchy: 0.07, confidence: 1, source: 'user_input', source_meeting_id: null, tags: ['preference'], recall_count: 1, last_recalled: new Date(Date.now() - 30 * 86400000).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'd6', perspective_id: activeId, parent_id: 'd4', key: 'allergic to shellfish', value: 'allergic to shellfish', category: 'preferences', weight: 0.90, hierarchy: 0.70, confidence: 1, source: 'user_input', source_meeting_id: null, tags: ['critical', 'health'], recall_count: 3, last_recalled: new Date(Date.now() - 3 * 86400000).toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'd7', perspective_id: activeId, parent_id: null, key: 'schedule', value: null, category: 'schedule', weight: 0.3, hierarchy: 0.8, confidence: 1, source: 'system', source_meeting_id: null, tags: [], recall_count: 0, last_recalled: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'd8', perspective_id: activeId, parent_id: 'd7', key: 'exam friday', value: 'exam on friday at 2pm', category: 'schedule', weight: 0.15, hierarchy: 0.95, confidence: 1, source: 'transcript', source_meeting_id: null, tags: ['deadline', 'urgent'], recall_count: 5, last_recalled: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ] as MemoryNode[]);
      setPermissions([]);
      setSharing([]);
      return;
    }
    try {
      const [memData, permData, shareData] = await Promise.all([
        getMemoryTree(activeId),
        getPermissions(activeId),
        getSharing(activeId),
      ]);
      setMemories(memData.memories);
      setPermissions(permData.permissions);
      setSharing(shareData.sharing_rules);
    } catch (err) {
      console.error('failed to load memory:', err);
    }
  }, [activeId]);

  useEffect(() => {
    loadPerspectives();
  }, [loadPerspectives]);

  useEffect(() => {
    if (activeId) {
      setLoading(true);
      loadMemory().finally(() => setLoading(false));
    }
  }, [activeId, loadMemory]);

  const handleUpdate = async (id: string, updates: { weight?: number; hierarchy?: number }) => {
    if (id.startsWith('d')) return; // demo
    try {
      await updateMemory(id, updates);
      loadMemory();
    } catch (err) {
      console.error('failed to update:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith('d')) return; // demo
    try {
      await deleteMemory(id);
      loadMemory();
    } catch (err) {
      console.error('failed to delete:', err);
    }
  };

  const handleDecay = async () => {
    if (activeId && !activeId.startsWith('demo-')) {
      try {
        const result = await runDecay(activeId);
        alert(`decay cycle: ${result.memories_updated} memories updated`);
        loadMemory();
      } catch (err) {
        console.error('decay failed:', err);
      }
    }
  };

  const activePerspective = perspectives.find(p => p.id === activeId);
  const identityCount = memories.filter(m => m.category === 'identity' && m.parent_id).length;
  const highWeightCount = memories.filter(m => m.weight >= 0.8 && m.parent_id).length;
  const highHierarchyCount = memories.filter(m => m.hierarchy >= 0.8 && m.parent_id).length;

  return (
    <div className="space-y-4">
      {/* page header */}
      <div className="border border-primary p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-primary/60">module</div>
            <h1 className="text-xl font-black uppercase tracking-tight text-primary">memorium</h1>
            <p className="text-[10px] text-muted-foreground lowercase mt-0.5">
              weighted · hierarchical · associative · persona-sandboxed memory
            </p>
          </div>
          <div className="text-right text-[10px] text-muted-foreground">
            <div>pov switching — not personas joining</div>
            <div className="text-muted-foreground/60">same you, different perspectives</div>
          </div>
        </div>
      </div>

      {/* perspective switcher */}
      <PerspectiveSwitcher
        perspectives={perspectives}
        activeId={activeId}
        onSelect={setActiveId}
      />

      {/* stats bar */}
      {activePerspective && (
        <div className="grid grid-cols-4 gap-0 border border-primary">
          <div className="px-3 py-2 border-r border-primary">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground">total memory</div>
            <div className="text-lg font-bold tabular-nums">{memories.filter(m => m.parent_id).length}</div>
          </div>
          <div className="px-3 py-2 border-r border-primary">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground">high weight</div>
            <div className="text-lg font-bold tabular-nums text-primary">{highWeightCount}</div>
          </div>
          <div className="px-3 py-2 border-r border-primary">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground">high hierarchy</div>
            <div className="text-lg font-bold tabular-nums text-accent">{highHierarchyCount}</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[8px] uppercase tracking-wider text-muted-foreground">permissions</div>
            <div className="text-lg font-bold tabular-nums">{permissions.length}</div>
          </div>
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-0 border border-primary">
        {(['memory', 'retrieve', 'permissions', 'sharing'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-[10px] uppercase tracking-wider transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            } ${t !== 'memory' ? 'border-l border-primary' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* content */}
      {loading ? (
        <div className="text-xs text-muted-foreground text-center py-8">loading memorium...</div>
      ) : (
        <>
          {tab === 'memory' && activeId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                  memory structure — {activePerspective?.display_name || 'unknown'}
                </div>
                {!activeId.startsWith('demo-') && (
                  <button
                    onClick={handleDecay}
                    className="text-[9px] text-muted-foreground hover:text-primary underline underline-offset-2"
                  >
                    [run decay]
                  </button>
                )}
              </div>
              <MemoryTree
                memories={memories}
                activePerspectiveId={activeId}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSelectAssoc={setAssocNode}
              />
              <AddMemoryForm perspectiveId={activeId} onAdded={loadMemory} />
              {assocNode && (
                <AssociationPanel node={assocNode} onClose={() => setAssocNode(null)} />
              )}
            </div>
          )}

          {tab === 'retrieve' && activeId && (
            <RetrievalPanel perspectiveId={activeId} />
          )}

          {tab === 'permissions' && activeId && (
            <PermissionsMatrix
              perspectiveId={activeId}
              permissions={permissions}
              onUpdate={loadMemory}
            />
          )}

          {tab === 'sharing' && activeId && (
            <SharingPanel
              perspectiveId={activeId}
              perspectives={perspectives}
              sharing={sharing}
              onUpdate={loadMemory}
            />
          )}
        </>
      )}

      {/* legend */}
      <div className="border border-primary/20 p-3 text-[9px] text-muted-foreground">
        <div className="font-bold uppercase tracking-wider mb-1.5">legend</div>
        <div className="grid grid-cols-2 gap-y-0.5">
          <div><span className="text-primary font-bold">weight (w)</span> = identity core — does NOT decay</div>
          <div><span className="text-accent font-bold">hierarchy (h)</span> = behavior drive — decays over time</div>
          <div><span className="text-primary">[user_input]</span> = explicitly stated by you</div>
          <div><span className="text-accent">[transcript]</span> = extracted from meeting transcript</div>
          <div><span className="text-muted-foreground">[inference]</span> = inferred by the system</div>
          <div><span className="text-blue-500">[shared]</span> = shared from another perspective</div>
        </div>
      </div>
    </div>
  );
}
