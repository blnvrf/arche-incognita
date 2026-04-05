import { useState, useEffect } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { useStore } from '../store';
import { ICON_LIST, ICON_MAP } from '../icons';
import './NodeSidebar.css';

const DEFAULT_FORM = {
  title: '',
  icon: 'Target',
  timeEst: '',
  cost: '',
  moneyDelta: '',
  benefits: '',
  notes: '',
  requiresAll: true,
};

export default function NodeSidebar() {
  const { sidebarOpen, sidebarMode, editingNode, closeSidebar, addNode, updateNode, deleteNode, completeNode, addEdgeBetween, removeEdge, autoLayout, nodes, edges } = useStore();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [newPrereqs, setNewPrereqs] = useState([]);
  const [newUnlocks, setNewUnlocks] = useState([]);

  useEffect(() => {
    if (sidebarMode === 'edit' && editingNode) {
      setForm({
        title: editingNode.data.title || '',
        icon: editingNode.data.icon || 'Target',
        timeEst: editingNode.data.timeEst || '',
        cost: editingNode.data.cost != null ? String(editingNode.data.cost) : '',
        moneyDelta: editingNode.data.moneyDelta != null ? String(editingNode.data.moneyDelta) : '',
        benefits: (editingNode.data.benefits || []).join('\n'),
        notes: editingNode.data.notes || '',
        requiresAll: editingNode.data.requiresAll !== false,
      });
    } else {
      setForm(DEFAULT_FORM);
      setNewPrereqs([]);
      setNewUnlocks([]);
    }
  }, [sidebarMode, editingNode]);

  if (!sidebarOpen) return null;

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    const nodeData = {
      title: form.title.trim(),
      icon: form.icon,
      timeEst: form.timeEst.trim(),
      cost: parseFloat(form.cost) || 0,
      moneyDelta: parseFloat(form.moneyDelta) || 0,
      benefits: form.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
      notes: form.notes.trim(),
      requiresAll: form.requiresAll,
    };
    if (sidebarMode === 'add') {
      const newId = addNode(nodeData);
      newPrereqs.forEach((pid) => addEdgeBetween(pid, newId));
      newUnlocks.forEach((uid) => addEdgeBetween(newId, uid));
      await autoLayout();
    } else {
      updateNode(editingNode.id, nodeData);
      await autoLayout();
    }
    closeSidebar();
  };

  const handleDelete = () => {
    if (editingNode) deleteNode(editingNode.id);
    closeSidebar();
  };

  const handleComplete = () => {
    if (editingNode) completeNode(editingNode.id);
    closeSidebar();
  };

  const isEditing = sidebarMode === 'edit';
  const nodeStatus = editingNode?.data?.status;

  const nodeId = editingNode?.id;

  // Incoming edges (requires)
  const requiresEdges = edges.filter((e) => e.target === nodeId);
  const requiresNodes = nodes.filter((n) => requiresEdges.some((e) => e.source === n.id));

  // Outgoing edges (unlocks)
  const unlocksEdges = edges.filter((e) => e.source === nodeId);
  const unlocksNodes = nodes.filter((n) => unlocksEdges.some((e) => e.target === n.id));

  // Nodes available to add as requires (exclude self, already requires, and descendants to avoid cycles)
  const requiresCandidates = nodes.filter(
    (n) => n.id !== nodeId && !requiresNodes.some((r) => r.id === n.id)
  );
  const unlocksCandidates = nodes.filter(
    (n) => n.id !== nodeId && !unlocksNodes.some((u) => u.id === n.id)
  );

  return (
    <div className="sidebar" style={{ animation: 'slide-in-right 0.2s ease' }}>
      <div className="sidebar__header">
        <h2 className="sidebar__title">
          {isEditing ? 'Edit Task' : 'New Task'}
        </h2>
        <button className="sidebar__close" onClick={closeSidebar}>
          <X size={16} />
        </button>
      </div>

      <div className="sidebar__body">
        {/* Icon picker */}
        <div className="field">
          <label className="field__label">Icon</label>
          <div className="icon-grid">
            {ICON_LIST.map((name) => {
              const IC = ICON_MAP[name];
              return (
                <button
                  key={name}
                  className={`icon-btn ${form.icon === name ? 'icon-btn--active' : ''}`}
                  onClick={() => setForm({ ...form, icon: name })}
                  title={name}
                >
                  <IC size={16} strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div className="field">
          <label className="field__label">Task Title</label>
          <input
            className="field__input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What do you need to do?"
          />
        </div>

        {/* Time + Cost row */}
        <div className="field-row">
          <div className="field">
            <label className="field__label">Time Est.</label>
            <input
              className="field__input"
              value={form.timeEst}
              onChange={(e) => setForm({ ...form, timeEst: e.target.value })}
              placeholder="e.g. 4h, 2d"
            />
          </div>
          <div className="field">
            <label className="field__label">Cost ($)</label>
            <input
              className="field__input"
              type="number"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              placeholder="0"
            />
          </div>
        </div>

        {/* Money delta */}
        <div className="field">
          <label className="field__label">Money Earned on Complete ($)</label>
          <input
            className="field__input"
            type="number"
            value={form.moneyDelta}
            onChange={(e) => setForm({ ...form, moneyDelta: e.target.value })}
            placeholder="0"
          />
        </div>

        {/* Benefits */}
        <div className="field">
          <label className="field__label">Benefits / Unlocks <span className="field__hint">(one per line)</span></label>
          <textarea
            className="field__textarea"
            value={form.benefits}
            onChange={(e) => setForm({ ...form, benefits: e.target.value })}
            placeholder={"Earn $400\nUnlock YouTube channel\nPortfolio piece"}
            rows={3}
          />
        </div>

        {/* Notes */}
        <div className="field">
          <label className="field__label">Notes</label>
          <textarea
            className="field__textarea"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any context, links, reminders..."
            rows={2}
          />
        </div>

        {/* Requires — add mode */}
        {!isEditing && (
          <div className="field">
            <div className="field__label-row">
              <label className="field__label">Requires</label>
              <label className="field__check">
                <input
                  type="checkbox"
                  checked={form.requiresAll}
                  onChange={(e) => setForm({ ...form, requiresAll: e.target.checked })}
                />
                All required
              </label>
            </div>
            <div className="rel-list">
              {newPrereqs.map((pid) => {
                const n = nodes.find((x) => x.id === pid);
                if (!n) return null;
                return (
                  <div key={pid} className={`rel-item rel-item--${n.data.status}`}>
                    <span className="rel-item__title">{n.data.title}</span>
                    <button className="rel-item__remove" onClick={() => setNewPrereqs(newPrereqs.filter((id) => id !== pid))}>
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              {newPrereqs.length === 0 && <p className="field__hint">No prerequisites.</p>}
            </div>
            {nodes.filter((n) => !newPrereqs.includes(n.id)).length > 0 && (
              <div className="rel-add">
                <select
                  className="rel-add__select"
                  value=""
                  onChange={(e) => { if (e.target.value) setNewPrereqs([...newPrereqs, e.target.value]); }}
                >
                  <option value="" disabled>Add prerequisite…</option>
                  {nodes.filter((n) => !newPrereqs.includes(n.id)).map((n) => (
                    <option key={n.id} value={n.id}>{n.data.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Unlocks — add mode */}
        {!isEditing && (
          <div className="field">
            <label className="field__label">Unlocks</label>
            <div className="rel-list">
              {newUnlocks.map((uid) => {
                const n = nodes.find((x) => x.id === uid);
                if (!n) return null;
                return (
                  <div key={uid} className={`rel-item rel-item--${n.data.status}`}>
                    <span className="rel-item__title">{n.data.title}</span>
                    <button className="rel-item__remove" onClick={() => setNewUnlocks(newUnlocks.filter((id) => id !== uid))}>
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              {newUnlocks.length === 0 && <p className="field__hint">Unlocks nothing yet.</p>}
            </div>
            {nodes.filter((n) => !newUnlocks.includes(n.id)).length > 0 && (
              <div className="rel-add">
                <select
                  className="rel-add__select"
                  value=""
                  onChange={(e) => { if (e.target.value) setNewUnlocks([...newUnlocks, e.target.value]); }}
                >
                  <option value="" disabled>Add unlock…</option>
                  {nodes.filter((n) => !newUnlocks.includes(n.id)).map((n) => (
                    <option key={n.id} value={n.id}>{n.data.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Requires (incoming edges) */}
        {isEditing && (
          <div className="field">
            <div className="field__label-row">
              <label className="field__label">Requires</label>
              <label className="field__check">
                <input
                  type="checkbox"
                  checked={form.requiresAll}
                  onChange={(e) => setForm({ ...form, requiresAll: e.target.checked })}
                />
                All required
              </label>
            </div>
            <div className="rel-list">
              {requiresNodes.map((n) => {
                const edge = requiresEdges.find((e) => e.source === n.id);
                return (
                  <div key={n.id} className={`rel-item rel-item--${n.data.status}`}>
                    {(() => { const IC = ICON_MAP[n.data.icon] ?? ICON_MAP['Target']; return <IC size={12} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />; })()}
                    <span className="rel-item__title">{n.data.title}</span>
                    <span className="rel-item__status">{n.data.status}</span>
                    <button className="rel-item__remove" onClick={() => removeEdge(edge.id)} title="Remove">
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              {requiresNodes.length === 0 && (
                <p className="field__hint">No prerequisites.</p>
              )}
            </div>
            {requiresCandidates.length > 0 && (
              <div className="rel-add">
                <select
                  className="rel-add__select"
                  value=""
                  onChange={(e) => { if (e.target.value) { addEdgeBetween(e.target.value, nodeId); } }}
                >
                  <option value="" disabled>Add prerequisite…</option>
                  {requiresCandidates.map((n) => (
                    <option key={n.id} value={n.id}>{n.data.emoji} {n.data.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Unlocks (outgoing edges) */}
        {isEditing && (
          <div className="field">
            <label className="field__label">Unlocks</label>
            <div className="rel-list">
              {unlocksNodes.map((n) => {
                const edge = unlocksEdges.find((e) => e.target === n.id);
                return (
                  <div key={n.id} className={`rel-item rel-item--${n.data.status}`}>
                    {(() => { const IC = ICON_MAP[n.data.icon] ?? ICON_MAP['Target']; return <IC size={12} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />; })()}
                    <span className="rel-item__title">{n.data.title}</span>
                    <span className="rel-item__status">{n.data.status}</span>
                    <button className="rel-item__remove" onClick={() => removeEdge(edge.id)} title="Remove">
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              {unlocksNodes.length === 0 && (
                <p className="field__hint">Unlocks nothing yet.</p>
              )}
            </div>
            {unlocksCandidates.length > 0 && (
              <div className="rel-add">
                <select
                  className="rel-add__select"
                  value=""
                  onChange={(e) => { if (e.target.value) { addEdgeBetween(nodeId, e.target.value); } }}
                >
                  <option value="" disabled>Add unlock…</option>
                  {unlocksCandidates.map((n) => (
                    <option key={n.id} value={n.id}>{n.data.emoji} {n.data.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="sidebar__footer">
        {isEditing && nodeStatus !== 'completed' && nodeStatus !== 'locked' && (
          <button className="btn btn--complete" onClick={handleComplete}>
            <Check size={14} />
            Mark Complete
          </button>
        )}
        <button className="btn btn--primary" onClick={handleSubmit}>
          {isEditing ? 'Save Changes' : 'Add Task'}
        </button>
        {isEditing && (
          <button className="btn btn--danger" onClick={handleDelete}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
