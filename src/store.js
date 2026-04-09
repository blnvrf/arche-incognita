import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';

const STORAGE_KEY = 'arche-incognita-graph';

const ARCHE_NODE = {
  id: 'arche',
  type: 'taskNode',
  position: { x: 0, y: 0 },
  data: {
    title: 'Arche',
    status: 'completed',
    icon: 'Flame',
    isArche: true,
    timeEst: '',
    cost: 0,
    moneyDelta: 0,
    benefits: ['Before the map, there was only the horizon.', 'Start your journey now.'],
    notes: '',
  },
};

// Adds arche→node edges for every non-arche, non-incognita node that has no other prerequisites.
// Removes arche edges from nodes that have gained real prerequisites.
// Incognita nodes are fully excluded — they float with no edges.
function ensureArcheEdges(nodes, edges) {
  const incognitaIds = new Set(nodes.filter((n) => n.data?.isIncognita).map((n) => n.id));

  // Drop outgoing edges FROM incognita nodes, AND any arche→incognita edges.
  let result = edges.filter((e) => {
    if (incognitaIds.has(e.source)) return false;          // outgoing from incognita
    if (e.source === 'arche' && incognitaIds.has(e.target)) return false; // arche→incognita
    return true;
  });

  // Only non-arche, non-incognita nodes are eligible for arche fallback edges.
  const eligible = nodes.filter((n) => n.id !== 'arche' && !n.data?.isIncognita);
  const eligibleIds = new Set(eligible.map((n) => n.id));

  // Real (non-arche) prereqs among eligible nodes
  const realPrereqs = new Set(
    result.filter((e) => e.source !== 'arche' && eligibleIds.has(e.target)).map((e) => e.target)
  );
  // Drop stale arche edges for nodes that now have real prereqs
  result = result.filter(
    (e) => !(e.source === 'arche' && realPrereqs.has(e.target))
  );
  // Add arche edges for eligible nodes with no prereqs at all
  const hasAnyPrereq = new Set(result.map((e) => e.target));
  for (const n of eligible) {
    if (!hasAnyPrereq.has(n.id)) {
      result.push({ id: `e-arche-${n.id}`, source: 'arche', target: n.id, type: 'smart' });
    }
  }
  return result;
}

const initialNodes = [ARCHE_NODE];
const initialEdges = [];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Migrate old edge types to 'smart'
    if (data?.edges) data.edges = data.edges.map((e) => ({ ...e, type: 'smart' }));
    return data;
  } catch {
    return null;
  }
}

function saveToStorage(nodes, edges, balance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, balance }));
  } catch {}
}

// Re-evaluate locked/available status for every non-active, non-completed node.
// A node is available when all its prerequisite tasks are completed (requiresAll=true)
// or at least one is completed (requiresAll=false). No prereqs → always available.
// Enforces single-active: if multiple active nodes exist, keeps the first and reverts the rest.
function recomputeStatuses(nodes, edges, balance = 0) {
  // Ensure arche node is always present and always completed
  const hasArche = nodes.some((n) => n.id === 'arche');
  const baseNodes = hasArche ? nodes : [ARCHE_NODE, ...nodes];
  const withArche = baseNodes.map((n) =>
    n.id === 'arche' ? { ...ARCHE_NODE, position: n.position ?? ARCHE_NODE.position } : n
  );
  nodes = withArche;

  const completedIds = new Set(nodes.filter((n) => n.data.status === 'completed').map((n) => n.id));

  // Enforce single-active
  let activeSeenId = null;
  const sanitized = nodes.map((n) => {
    if (n.data.status === 'active') {
      if (!activeSeenId) { activeSeenId = n.id; return n; }
      return { ...n, data: { ...n.data, status: 'available' } };
    }
    return n;
  });

  return sanitized.map((n) => {
    if (n.id === 'arche' || n.data.status === 'active' || n.data.status === 'completed') return n;

    const prereqs = edges.filter((e) => e.target === n.id).map((e) => e.source);
    const prereqsSatisfied = prereqs.length === 0
      ? true
      : (n.data.requiresAll !== false)
        ? prereqs.every((pid) => completedIds.has(pid))
        : prereqs.some((pid) => completedIds.has(pid));

    const canAfford = !n.data.cost || n.data.cost <= 0 || balance >= n.data.cost;
    const next = (prereqsSatisfied && canAfford) ? 'available' : 'locked';
    return n.data.status === next ? n : { ...n, data: { ...n.data, status: next } };
  });
}

const _saved = loadFromStorage();
const saved = _saved
  ? (() => {
      const edges = ensureArcheEdges(_saved.nodes ?? [], _saved.edges ?? []);
      const nodes = recomputeStatuses(_saved.nodes ?? [], edges, _saved.balance ?? 0);
      const activeNodeId = nodes.find((n) => n.data.status === 'active')?.id ?? null;
      return { ..._saved, edges, nodes, activeNodeId };
    })()
  : null;

export const useStore = create((set, get) => ({
  nodes: saved?.nodes ?? initialNodes,
  edges: saved?.edges ?? initialEdges,
  balance: saved?.balance ?? 0,
  activeNodeId: saved?.activeNodeId ?? null,
  sidebarOpen: false,
  sidebarMode: 'add', // 'add' | 'edit'
  editingNode: null,

  // React Flow handlers
  onNodesChange: (changes) => {
    const nodes = applyNodeChanges(changes, get().nodes);
    set({ nodes });
    saveToStorage(nodes, get().edges, get().balance);
  },
  onEdgesChange: (changes) => {
    const edges = applyEdgeChanges(changes, get().edges);
    set({ edges });
    saveToStorage(get().nodes, edges, get().balance);
  },
  onConnect: (connection) => {
    const edges = addEdge({ ...connection, type: 'smart' }, get().edges);
    set({ edges });
    saveToStorage(get().nodes, edges, get().balance);
  },

  addEdgeBetween: (sourceId, targetId) => {
    const { nodes } = get();
    let edges = get().edges;
    if (edges.some((e) => e.source === sourceId && e.target === targetId)) return;
    edges = [...edges, { id: `e-${sourceId}-${targetId}-${Date.now()}`, source: sourceId, target: targetId, type: 'smart' }];
    edges = ensureArcheEdges(nodes, edges);
    set({ edges });
    saveToStorage(nodes, edges, get().balance);
  },

  removeEdge: (edgeId) => {
    const { nodes } = get();
    let edges = get().edges.filter((e) => e.id !== edgeId);
    edges = ensureArcheEdges(nodes, edges);
    set({ edges });
    saveToStorage(nodes, edges, get().balance);
  },

  refreshStatuses: () => {
    const { nodes, edges, balance } = get();
    const updated = recomputeStatuses(nodes, edges, balance);
    set({ nodes: updated });
    saveToStorage(updated, edges, balance);
  },

  setBalance: (balance) => {
    const { nodes, edges } = get();
    const updated = recomputeStatuses(nodes, edges, balance);
    set({ balance, nodes: updated });
    saveToStorage(updated, edges, balance);
  },

  openAddSidebar: () => set({ sidebarOpen: true, sidebarMode: 'add', editingNode: null }),
  openEditSidebar: (node) => set({ sidebarOpen: true, sidebarMode: 'edit', editingNode: node }),
  closeSidebar: () => set({ sidebarOpen: false, editingNode: null }),

  setActiveNode: (id) => {
    const { nodes, edges, balance } = get();
    // Only activate if the node exists and is available
    const target = nodes.find((n) => n.id === id);
    if (!target || target.data.status !== 'available') return;
    const updated = nodes.map((n) => {
      if (n.id === id) return { ...n, data: { ...n.data, status: 'active' } };
      if (n.data.status === 'active') return { ...n, data: { ...n.data, status: 'available' } };
      return n;
    });
    set({ nodes: updated, activeNodeId: id });
    saveToStorage(updated, edges, balance);
  },

  abandonNode: (id) => {
    const { nodes, edges, balance } = get();
    const updated = nodes.map((n) =>
      n.id === id && n.data.status === 'active'
        ? { ...n, data: { ...n.data, status: 'available' } }
        : n
    );
    set({ nodes: updated, activeNodeId: null });
    saveToStorage(updated, edges, balance);
  },

  uncompleteNode: (id) => {
    const { nodes, edges, balance } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const newBalance = balance - (node.data.moneyDelta || 0);
    const marked = nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, status: 'available' } } : n
    );
    const final = recomputeStatuses(marked, edges, newBalance);
    set({ nodes: final, balance: newBalance, activeNodeId: null });
    saveToStorage(final, edges, newBalance);
  },

  completeNode: (id) => {
    const { nodes, balance, edges } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const newBalance = balance + (node.data.moneyDelta || 0);
    const marked = nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, status: 'completed' } } : n
    );
    const final = recomputeStatuses(marked, edges, newBalance);
    set({ nodes: final, balance: newBalance, activeNodeId: null });
    saveToStorage(final, edges, newBalance);
  },

  addNode: (nodeData) => {
    const { nodes, balance } = get();
    const id = `node-${Date.now()}`;
    const newNode = {
      id,
      type: 'taskNode',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { ...nodeData, status: 'available' },
    };
    const allNodes = [...nodes, newNode];
    const edges = ensureArcheEdges(allNodes, get().edges);
    const updated = recomputeStatuses(allNodes, edges, balance);
    set({ nodes: updated, edges });
    saveToStorage(updated, edges, balance);
    return id;
  },

  updateNode: (id, nodeData) => {
    const { balance } = get();
    const patched = get().nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...nodeData } } : n
    );
    const edges = ensureArcheEdges(patched, get().edges);
    const nodes = recomputeStatuses(patched, edges, balance);
    set({ nodes, edges });
    saveToStorage(nodes, edges, balance);
  },

  deleteNode: (id) => {
    if (id === 'arche') return; // arche is permanent
    const { balance } = get();
    const remainingNodes = get().nodes.filter((n) => n.id !== id);
    let edges = get().edges.filter((e) => e.source !== id && e.target !== id);
    edges = ensureArcheEdges(remainingNodes, edges);
    const nodes = recomputeStatuses(remainingNodes, edges, balance);
    set({ nodes, edges, activeNodeId: get().activeNodeId === id ? null : get().activeNodeId });
    saveToStorage(nodes, edges, balance);
  },

  loadGraph: (data) => {
    let edges = (data.edges ?? []).map((e) => ({ ...e, type: 'smart' }));
    const balance = data.balance ?? 0;
    const rawNodes = data.nodes ?? [];
    edges = ensureArcheEdges(rawNodes, edges);
    const nodes = recomputeStatuses(rawNodes, edges, balance);
    const activeNodeId = nodes.find((n) => n.data.status === 'active')?.id ?? null;
    set({ nodes, edges, balance, activeNodeId, sidebarOpen: false, editingNode: null });
    saveToStorage(nodes, edges, balance);
  },

  autoLayout: async () => {
    const { nodes, balance } = get();
    let edges = ensureArcheEdges(nodes, get().edges);
    const elk = new ELK();

    const NODE_W  = 240;
    const NODE_H  = 160;
    const GRID_W  = 400;
    const GRID_H  = 220;

    // Separate incognita nodes — they get their own final column
    const regularNodes   = nodes.filter((n) => !n.data?.isIncognita);
    const incognitaNodes = nodes.filter((n) => n.data?.isIncognita);
    const regularIds     = new Set(regularNodes.map((n) => n.id));
    const regularEdges   = edges.filter((e) => regularIds.has(e.source) && regularIds.has(e.target));

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.layered.spacing.nodeNodeBetweenLayers': String(GRID_W - NODE_W),
        'elk.spacing.nodeNode': String(GRID_H - NODE_H),
      },
      children: regularNodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
      edges: regularEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    };

    const laid = await elk.layout(graph);

    const sorted = [...laid.children].sort((a, b) => a.x - b.x);
    const layers = [];
    for (const node of sorted) {
      const last = layers[layers.length - 1];
      if (!last || node.x - last[0].x > NODE_W / 2) {
        layers.push([node]);
      } else {
        last.push(node);
      }
    }

    const posMap = {};
    layers.forEach((layer, col) => {
      layer.sort((a, b) => a.y - b.y);
      layer.forEach((n, row) => {
        posMap[n.id] = { x: col * GRID_W, y: row * GRID_H };
      });
    });

    // Place incognita nodes in the column after all regular columns
    const incognitaCol = layers.length;
    incognitaNodes.forEach((n, row) => {
      posMap[n.id] = { x: incognitaCol * GRID_W, y: row * GRID_H };
    });

    const positioned = nodes.map((n) => ({
      ...n,
      position: posMap[n.id] ?? n.position,
    }));
    const updated = recomputeStatuses(positioned, edges, balance);

    set({ nodes: updated, edges });
    saveToStorage(updated, edges, balance);
  },
}));
