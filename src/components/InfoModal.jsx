import { X } from 'lucide-react';
import './InfoModal.css';

export default function InfoModal({ onClose }) {
  return (
    <div className="info-overlay" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="info-modal__header">
          <h2 className="info-modal__title">How to Use Arche Incognita</h2>
          <button className="info-modal__close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="info-modal__body">
          <p>Arche Incognita is a personal quest board — a dependency graph for your goals and tasks. Each card is a task, and tasks can unlock other tasks once completed.</p>

          <h3>Task Statuses</h3>
          <p><strong>Locked</strong> — this task has unfinished prerequisites. Complete them first to unlock it.</p>
          <p><strong>Available</strong> — all prerequisites are done. You can start this task now.</p>
          <p><strong>In Progress</strong> — you are actively working on this task. Only one task can be in progress at a time.</p>
          <p><strong>Completed</strong> — this task is done. It may unlock other tasks downstream.</p>

          <h3>Working with Tasks</h3>
          <p>Click the <strong>+</strong> button in the bottom-right corner to create a new task. You can set a title, icon, time estimate, cost, money earned on completion, benefits, and notes.</p>
          <p>When creating a task you can define which tasks it <strong>Requires</strong> (prerequisites) and which tasks it <strong>Unlocks</strong> (dependents).</p>
          <p>Click any task card to open it and edit its details, manage its connections, mark it complete, or delete it.</p>

          <h3>Active Task</h3>
          <p>Click an available task card to set it as your active task. It will appear in the toolbar at the top of the screen. From there you can mark it complete or abandon it to set it back to available.</p>

          <h3>Balance</h3>
          <p>The balance counter in the top-right tracks your running total. Each task can have a cost (negative) or a money earned value (positive) that adjusts the balance when completed or uncompleted.</p>

          <h3>Layout & Controls</h3>
          <p>The <strong>refresh</strong> button re-runs the auto-layout and recalculates all statuses across the graph.</p>
          <p>The <strong>save</strong> button exports your entire graph as a JSON file. The <strong>folder</strong> button imports a previously saved graph.</p>
          <p>The minimap in the bottom-left lets you navigate the graph. Click anywhere on it to jump to that area.</p>
        </div>
      </div>
    </div>
  );
}
