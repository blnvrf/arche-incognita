import { useState, useEffect } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { useStore } from '../store';
import './NodeSidebar.css';

const EMOJIS = ['🎨', '📹', '🎙️', '📐', '💻', '📦', '🏆', '💰', '📝', '🔧', '🚀', '🎯', '🏋️', '📊', '🤝', '🌐', '✍️', '📸', '🎬', '🔑'];

const DEFAULT_FORM = {
  title: '',
  emoji: '🎯',
  timeEst: '',
  cost: '',
  moneyDelta: '',
  benefits: '',
  notes: '',
};

export default function NodeSidebar() {
  const { sidebarOpen, sidebarMode, editingNode, closeSidebar, addNode, updateNode, deleteNode, completeNode, nodes, edges } = useStore();

  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (sidebarMode === 'edit' && editingNode) {
      setForm({
        title: editingNode.data.title || '',
        emoji: editingNode.data.emoji || '🎯',
        timeEst: editingNode.data.timeEst || '',
        cost: editingNode.data.cost != null ? String(editingNode.data.cost) : '',
        moneyDelta: editingNode.data.moneyDelta != null ? String(editingNode.data.moneyDelta) : '',
        benefits: (editingNode.data.benefits || []).join('\n'),
        notes: editingNode.data.notes || '',
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [sidebarMode, editingNode]);

  if (!sidebarOpen) return null;

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    const nodeData = {
      title: form.title.trim(),
      emoji: form.emoji,
      timeEst: form.timeEst.trim(),
      cost: parseFloat(form.cost) || 0,
      moneyDelta: parseFloat(form.moneyDelta) || 0,
      benefits: form.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
      notes: form.notes.trim(),
    };
    if (sidebarMode === 'add') {
      addNode(nodeData);
    } else {
      updateNode(editingNode.id, nodeData);
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

  // Get available nodes for prerequisite info display
  const prereqIds = edges.filter((e) => e.target === editingNode?.id).map((e) => e.source);
  const prereqNodes = nodes.filter((n) => prereqIds.includes(n.id));

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
        {/* Emoji picker */}
        <div className="field">
          <label className="field__label">Icon</label>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className={`emoji-btn ${form.emoji === e ? 'emoji-btn--active' : ''}`}
                onClick={() => setForm({ ...form, emoji: e })}
              >
                {e}
              </button>
            ))}
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

        {/* Prerequisites info (edit mode) */}
        {isEditing && prereqNodes.length > 0 && (
          <div className="field">
            <label className="field__label">Prerequisites</label>
            <div className="prereq-list">
              {prereqNodes.map((n) => (
                <div key={n.id} className={`prereq-item prereq-item--${n.data.status}`}>
                  <span>{n.data.emoji}</span>
                  <span>{n.data.title}</span>
                  <span className="prereq-status">{n.data.status}</span>
                </div>
              ))}
            </div>
            <p className="field__hint" style={{ marginTop: 6 }}>
              Connect / disconnect edges directly on the canvas.
            </p>
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
