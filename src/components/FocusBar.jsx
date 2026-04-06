import { Check, X } from 'lucide-react';
import { useStore } from '../store';
import './FocusBar.css';

export default function FocusBar() {
  const { nodes, completeNode, abandonNode } = useStore();

  // Find active node purely by status — never relies on activeNodeId staying in sync
  const activeNode = nodes.find((n) => n.data.status === 'active');
  if (!activeNode) return null;

  return (
    <div className="focus-bar-wrap">
    <div className="focus-bar" style={{ animation: 'slide-in-up 0.25s ease' }}>
      <div className="focus-bar__indicator" />
      <div className="focus-bar__content">
        <span className="focus-bar__label">Currently Doing</span>
        <span className="focus-bar__title">{activeNode.data.title}</span>
      </div>
      {activeNode.data.timeEst && (
        <span className="focus-bar__time">{activeNode.data.timeEst}</span>
      )}
      <button className="focus-bar__abandon" onClick={() => abandonNode(activeNode.id)} title="Abandon task">
        <X size={13} />
      </button>
      <button className="focus-bar__complete" onClick={() => completeNode(activeNode.id)}>
        <Check size={14} />
        Complete
      </button>
    </div>
    </div>
  );
}
