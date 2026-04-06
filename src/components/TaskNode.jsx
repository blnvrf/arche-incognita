import { Handle, Position } from '@xyflow/react';
import { useStore } from '../store';
import { ICON_MAP } from '../icons';
import './TaskNode.css';

export default function TaskNode({ id, data, selected }) {
  const { setActiveNode, openEditSidebar, nodes } = useStore();
  const node = nodes.find((n) => n.id === id);

  const handleClick = (e) => {
    e.stopPropagation();
    if (data.isArche) return;
    if (data.status === 'available') {
      setActiveNode(id);
    } else if (data.status === 'active' || data.status === 'completed' || data.status === 'locked') {
      openEditSidebar(node);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (data.isArche) return;
    if (node) openEditSidebar(node);
  };

  return (
    <div
      className={`task-node task-node--${data.status} ${data.isArche ? 'task-node--arche' : ''} ${selected ? 'task-node--selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Left} className="task-handle" />

      <div className="task-node__inner">
        <div className="task-node__title">
          {(() => { const IC = ICON_MAP[data.icon] ?? ICON_MAP['Target']; return <IC size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />; })()}
          {data.title}
        </div>

        <div className="task-node__meta">
          {data.timeEst    && <span className="task-node__time">{data.timeEst}</span>}
          {data.cost > 0   && <span className="task-node__cost">${data.cost}</span>}
          {data.moneyDelta > 0 && <span className="task-node__earn">+${data.moneyDelta}</span>}
        </div>

        {data.benefits && data.benefits.length > 0 && (
          <div className="task-node__benefits">
            {data.benefits.slice(0, 2).map((b, i) => (
              <span key={i} className="task-node__benefit">{b}</span>
            ))}
          </div>
        )}

        <div className="task-node__status-row">
          <span className="task-node__status-label">{data.status}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="task-handle" />
    </div>
  );
}
