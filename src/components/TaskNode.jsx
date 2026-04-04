import { Handle, Position } from '@xyflow/react';
import { useStore } from '../store';
import './TaskNode.css';

const STATUS_EMOJI = {
  locked: '🔒',
  available: '◈',
  active: '◉',
  completed: '✦',
};

export default function TaskNode({ id, data, selected }) {
  const { setActiveNode, openEditSidebar, nodes } = useStore();
  const node = nodes.find((n) => n.id === id);

  const handleClick = (e) => {
    e.stopPropagation();
    if (data.status === 'available') {
      setActiveNode(id);
    } else if (data.status === 'active' || data.status === 'completed' || data.status === 'locked') {
      openEditSidebar(node);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (node) openEditSidebar(node);
  };

  return (
    <div
      className={`task-node task-node--${data.status} ${selected ? 'task-node--selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Left} className="task-handle" />

      {/* Animated border for active */}
      {data.status === 'active' && <div className="task-node__shimmer" />}

      <div className="task-node__inner">
        <div className="task-node__header">
          <span className="task-node__emoji">{data.emoji || '◈'}</span>
          <div className="task-node__meta">
            {data.timeEst && <span className="task-node__time">{data.timeEst}</span>}
            {data.cost > 0 && <span className="task-node__cost">${data.cost}</span>}
            {data.moneyDelta > 0 && <span className="task-node__earn">+${data.moneyDelta}</span>}
          </div>
        </div>

        <div className="task-node__title">{data.title}</div>

        {data.benefits && data.benefits.length > 0 && (
          <div className="task-node__benefits">
            {data.benefits.slice(0, 2).map((b, i) => (
              <span key={i} className="task-node__benefit">{b}</span>
            ))}
          </div>
        )}

        <div className="task-node__status-row">
          <span className="task-node__status-icon">{STATUS_EMOJI[data.status]}</span>
          <span className="task-node__status-label">{data.status}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="task-handle" />
    </div>
  );
}
