import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
} from '@xyflow/react';

import { useStore } from './store';
import TaskNode from './components/TaskNode';
import SmartEdge from './components/SmartEdge';
import NodeSidebar from './components/NodeSidebar';
import FocusBar from './components/FocusBar';
import BalanceCounter from './components/BalanceCounter';
import './App.css';

const nodeTypes = { taskNode: TaskNode };
const edgeTypes = { smart: SmartEdge };

// Pushes Zustand edge changes into React Flow's internal state immediately,
// so sidebar-driven adds/removes appear without a page reload.
function EdgeSyncer() {
  const edges = useStore((s) => s.edges);
  const { setEdges } = useReactFlow();
  useEffect(() => { setEdges(edges); }, [edges, setEdges]);
  return null;
}

export default function App() {
  const {
    nodes, edges,
    onNodesChange,
    openAddSidebar, autoLayout,
    sidebarOpen,
  } = useStore();

  useEffect(() => { autoLayout(); }, []);

  const onPaneClick = useCallback(() => {
    // deselect / close nothing needed
  }, []);

  return (
    <div className="app">
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar__logo">
          <span className="topbar__logo-symbol">⬡</span>
          <div className="topbar__logo-text">
            <span className="topbar__logo-main">Arche</span>
            <span className="topbar__logo-sub">Incognita</span>
          </div>
        </div>

        <div className="topbar__actions">
          <button className="topbar__btn" onClick={autoLayout} title="Auto-layout graph">
            ⊞ Sort
          </button>
          <BalanceCounter />
        </div>
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="legend__item">
          <span className="legend__dot legend__dot--locked" />
          <span>Locked</span>
        </div>
        <div className="legend__item">
          <span className="legend__dot legend__dot--available" />
          <span>Available</span>
        </div>
        <div className="legend__item">
          <span className="legend__dot legend__dot--active" />
          <span>In Progress</span>
        </div>
        <div className="legend__item">
          <span className="legend__dot legend__dot--completed" />
          <span>Completed</span>
        </div>
      </div>

      {/* Canvas */}
      <div className={`canvas-wrap ${sidebarOpen ? 'canvas-wrap--sidebar' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          deleteKeyCode="Delete"
          proOptions={{ hideAttribution: true }}
        >
          <EdgeSyncer />
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1}
            color="rgba(255,255,255,0.04)"
          />
          <MiniMap
            style={{
              background: '#0d1117',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            nodeColor={(n) => {
              const s = n.data?.status;
              if (s === 'completed') return '#6b6b2d';
              if (s === 'active') return '#2d6baa';
              if (s === 'available') return '#2d6b2d';
              return '#2a2a2a';
            }}
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
      </div>

      {/* Add button */}
      <button className="add-btn" onClick={openAddSidebar} title="Add new task">
        +
      </button>

      {/* Sidebar */}
      <NodeSidebar />

      {/* Focus bar */}
      <FocusBar />
    </div>
  );
}
