import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
  useNodes,
  useViewport,
} from '@xyflow/react';

import { useStore } from './store';
import TaskNode from './components/TaskNode';
import SmartEdge from './components/SmartEdge';
import NodeSidebar from './components/NodeSidebar';
import FocusBar from './components/FocusBar';
import BalanceCounter from './components/BalanceCounter';
import { Save, FolderOpen, RefreshCw } from 'lucide-react';
import InfoModal from './components/InfoModal';
import worldMap from './assets/old world map.png';
import './App.css';

const nodeTypes = { taskNode: TaskNode };
const edgeTypes = { smart: SmartEdge };

const STATUS_COLOR = {
  active:    '#ffd700',
  available: '#c07028',
  locked:    '#8c8c8c',
  completed: '#363636',
};

const LEGEND = [
  { status: 'locked',    label: 'Locked' },
  { status: 'available', label: 'Available' },
  { status: 'active',    label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
];

const NODE_W = 240;
const NODE_H = 160;
const MAP_W  = 344;
const MAP_H  = 160;
const PAD    = 28;

function MapPanel() {
  const nodes    = useNodes();
  const viewport = useViewport();
  const { setViewport } = useReactFlow();
  const svgRef   = useRef(null);

  let mapEl = null;
  if (nodes.length > 0) {
    const xs   = nodes.map((n) => n.position.x);
    const ys   = nodes.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + NODE_W;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + NODE_H;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale  = Math.min((MAP_W - PAD * 2) / rangeX, (MAP_H - PAD * 2) / rangeY) * 0.55;

    // Viewport rect in graph space → SVG space
    const canvasW = window.innerWidth;
    const canvasH = window.innerHeight - 56;
    const vgx = -viewport.x / viewport.zoom;
    const vgy = -viewport.y / viewport.zoom;
    const vgw =  canvasW  / viewport.zoom;
    const vgh =  canvasH  / viewport.zoom;
    const vx = PAD + (vgx - minX) * scale;
    const vy = PAD + (vgy - minY) * scale;
    const vw = vgw * scale;
    const vh = vgh * scale;

    const handleClick = (e) => {
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const gx = minX + (mx - PAD) / scale;
      const gy = minY + (my - PAD) / scale;
      setViewport(
        {
          x: -(gx * viewport.zoom) + canvasW / 2,
          y: -(gy * viewport.zoom) + canvasH / 2,
          zoom: viewport.zoom,
        },
        { duration: 300 },
      );
    };

    mapEl = (
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        style={{ display: 'block', cursor: 'crosshair' }}
        onClick={handleClick}
      >
        {/* nodes */}
        {nodes.map((n) => (
          <rect
            key={n.id}
            x={PAD + (n.position.x - minX) * scale}
            y={PAD + (n.position.y - minY) * scale}
            width={Math.max(NODE_W * scale, 2)}
            height={Math.max(NODE_H * scale, 2)}
            rx={2}
            fill={STATUS_COLOR[n.data?.status] ?? '#363636'}
            opacity={n.data?.status === 'completed' ? 0.5 : n.data?.status === 'locked' ? 0.8 : 1}
          />
        ))}
        {/* mask: darken outside viewport */}
        <mask id="vp-mask">
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="white" />
          <rect x={vx} y={vy} width={vw} height={vh} fill="black" />
        </mask>
        <rect
          x={0} y={0} width={MAP_W} height={MAP_H}
          fill="rgba(0,0,0,0.55)"
          mask="url(#vp-mask)"
          style={{ pointerEvents: 'none' }}
        />
        {/* viewport outline */}
        <rect
          x={vx} y={vy} width={vw} height={vh}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1}
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    );
  }

  return (
    <Panel position="bottom-left">
      <div className="map-panel">
        {mapEl && <div className="map-panel__map">{mapEl}</div>}
        <div className="map-panel__legend">
          {LEGEND.map(({ status, label }) => (
            <div key={status} className="map-panel__legend-item">
              <span
                className="map-panel__dot"
                style={{
                  background: STATUS_COLOR[status],
                  opacity: status === 'completed' ? 0.5 : status === 'locked' ? 0.8 : 1,
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// Pushes Zustand edge changes into React Flow's internal state.
// Kept separate from refreshStatuses so they never race each other.
function EdgeSyncer() {
  const edges = useStore((s) => s.edges);
  const { setEdges } = useReactFlow();
  useEffect(() => { setEdges(edges); }, [edges, setEdges]);
  return null;
}

// Re-evaluates locked/available status whenever edges change.
function StatusRefresher() {
  const edges = useStore((s) => s.edges);
  const refreshStatuses = useStore((s) => s.refreshStatuses);
  useEffect(() => { refreshStatuses(); }, [edges, refreshStatuses]);
  return null;
}

export default function App() {
  const {
    nodes,
    onNodesChange,
    openAddSidebar, autoLayout, refreshStatuses,
    sidebarOpen, loadGraph,
  } = useStore();

  const fileInputRef = useRef(null);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => { autoLayout(); }, []);

  const onPaneClick = useCallback(() => {}, []);

  const handleExport = () => {
    const { nodes, edges, balance } = useStore.getState();
    const blob = new Blob(
      [JSON.stringify({ nodes, edges, balance }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arche-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { loadGraph(JSON.parse(ev.target.result)); } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="app" style={{ backgroundImage: `linear-gradient(rgba(9,11,15,0.55),rgba(9,11,15,0.55)),url(${worldMap})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat' }}>
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar__logo">
          <span className="topbar__logo-name">Arche<em>Incognita</em></span>
        </div>

        <div className="topbar__center">
          <FocusBar />
        </div>

        <div className="topbar__actions">
          <BalanceCounter />
        </div>
      </div>

      {/* Canvas */}
      <div className={`canvas-wrap ${sidebarOpen ? 'canvas-wrap--sidebar' : ''}`}>
        <ReactFlow
          nodes={nodes}
          defaultEdges={[]}
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
          <StatusRefresher />
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1}
            color="rgba(255,255,255,0.04)"
          />
          <MapPanel />
        </ReactFlow>
      </div>

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}

      {/* FAB cluster — Info / Refresh / Export / Import / Add */}
      <div className="fab-cluster">
        <button className="fab-btn fab-btn--info" onClick={() => setInfoOpen(true)} title="How to use">i</button>
        <button className="fab-btn" onClick={() => { autoLayout(); }} title="Sort & recalculate"><RefreshCw size={18} strokeWidth={1.8} /></button>
        <button className="fab-btn" onClick={handleExport} title="Export graph"><Save size={18} strokeWidth={1.8} /></button>
        <button className="fab-btn" onClick={() => fileInputRef.current?.click()} title="Import graph"><FolderOpen size={18} strokeWidth={1.8} /></button>
        <button className="add-btn" onClick={openAddSidebar} title="Add new task">+</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>

      {/* Sidebar */}
      <NodeSidebar />

    </div>
  );
}
