import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

const STORAGE_KEY = 'arche-incognita-graph';

const sampleNodes = [
  {
    id: '1',
    type: 'taskNode',
    position: { x: 60, y: 200 },
    data: {
      title: 'Complete Logo for Nexus Studio',
      status: 'completed',
      emoji: '🎨',
      timeEst: '6h',
      cost: 0,
      moneyDelta: 400,
      benefits: ['Earn $400', 'Portfolio piece', 'Potential referral'],
      notes: 'Final delivery + invoice sent.',
    },
  },
  {
    id: '2',
    type: 'taskNode',
    position: { x: 60, y: 380 },
    data: {
      title: 'Buy Microphone',
      status: 'available',
      emoji: '🎙️',
      timeEst: '1h',
      cost: 150,
      moneyDelta: -150,
      benefits: ['Unlock YouTube filming', 'Sound pro in meetings'],
      notes: 'Shure MV7 or similar.',
    },
  },
  {
    id: '3',
    type: 'taskNode',
    position: { x: 380, y: 300 },
    data: {
      title: 'Post 1st YouTube Video',
      status: 'locked',
      emoji: '📹',
      timeEst: '8h',
      cost: 0,
      moneyDelta: 0,
      benefits: ['Channel momentum', 'Unlock sponsorship path', 'Proof of concept'],
      notes: 'Needs mic + edit setup first.',
    },
  },
  {
    id: '4',
    type: 'taskNode',
    position: { x: 380, y: 100 },
    data: {
      title: 'Build Client Brand Book',
      status: 'available',
      emoji: '📐',
      timeEst: '12h',
      cost: 0,
      moneyDelta: 800,
      benefits: ['Earn $800', 'Long-term retainer potential'],
      notes: 'Ella McMaster / mixmaster project.',
    },
  },
  {
    id: '5',
    type: 'taskNode',
    position: { x: 700, y: 300 },
    data: {
      title: 'Reach 100 YouTube Subscribers',
      status: 'locked',
      emoji: '🏆',
      timeEst: '3mo',
      cost: 0,
      moneyDelta: 0,
      benefits: ['Unlock monetization path', 'Social proof', 'Brand deal eligibility'],
      notes: 'Milestone node — no single action.',
    },
  },
];

const sampleEdges = [
  { id: 'e1-3', source: '1', target: '3', type: 'smoothstep' },
  { id: 'e2-3', source: '2', target: '3', type: 'smoothstep' },
  { id: 'e3-5', source: '3', target: '5', type: 'smoothstep' },
  { id: 'e4-5', source: '4', target: '5', type: 'smoothstep' },
];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(nodes, edges, balance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, balance }));
  } catch {}
}

const saved = loadFromStorage();

export const useStore = create((set, get) => ({
  nodes: saved?.nodes ?? sampleNodes,
  edges: saved?.edges ?? sampleEdges,
  balance: saved?.balance ?? 0,
  activeNodeId: null,
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
    const edges = addEdge({ ...connection, type: 'smoothstep' }, get().edges);
    set({ edges });
    saveToStorage(get().nodes, edges, get().balance);
  },

  setBalance: (balance) => {
    set({ balance });
    saveToStorage(get().nodes, get().edges, balance);
  },

  openAddSidebar: () => set({ sidebarOpen: true, sidebarMode: 'add', editingNode: null }),
  openEditSidebar: (node) => set({ sidebarOpen: true, sidebarMode: 'edit', editingNode: node }),
  closeSidebar: () => set({ sidebarOpen: false, editingNode: null }),

  setActiveNode: (id) => {
    const { nodes, activeNodeId } = get();
    // Deactivate previous
    const updated = nodes.map((n) => {
      if (n.id === activeNodeId && n.data.status === 'active') {
        return { ...n, data: { ...n.data, status: 'available' } };
      }
      if (n.id === id && n.data.status === 'available') {
        return { ...n, data: { ...n.data, status: 'active' } };
      }
      return n;
    });
    set({ nodes: updated, activeNodeId: id });
    saveToStorage(updated, get().edges, get().balance);
  },

  completeNode: (id) => {
    const { nodes, balance } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const newBalance = balance + (node.data.moneyDelta || 0);
    const updated = nodes.map((n) => {
      if (n.id === id) return { ...n, data: { ...n.data, status: 'completed' } };
      return n;
    });

    // Re-evaluate locked nodes
    const completedIds = new Set(updated.filter((n) => n.data.status === 'completed').map((n) => n.id));
    const edges = get().edges;
    const final = updated.map((n) => {
      if (n.data.status === 'locked') {
        const prereqs = edges.filter((e) => e.target === n.id).map((e) => e.source);
        const prereqsMet = prereqs.every((pid) => completedIds.has(pid));
        if (prereqsMet && newBalance >= (n.data.cost || 0)) {
          return { ...n, data: { ...n.data, status: 'available' } };
        }
      }
      return n;
    });

    set({ nodes: final, balance: newBalance, activeNodeId: null });
    saveToStorage(final, edges, newBalance);
  },

  addNode: (nodeData) => {
    const id = `node-${Date.now()}`;
    const newNode = {
      id,
      type: 'taskNode',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { ...nodeData, status: 'available' },
    };
    const nodes = [...get().nodes, newNode];
    set({ nodes });
    saveToStorage(nodes, get().edges, get().balance);
  },

  updateNode: (id, nodeData) => {
    const nodes = get().nodes.map((n) =>
      n.id === id ? { ...n, data: { ...n.data, ...nodeData } } : n
    );
    set({ nodes });
    saveToStorage(nodes, get().edges, get().balance);
  },

  deleteNode: (id) => {
    const nodes = get().nodes.filter((n) => n.id !== id);
    const edges = get().edges.filter((e) => e.source !== id && e.target !== id);
    set({ nodes, edges, activeNodeId: get().activeNodeId === id ? null : get().activeNodeId });
    saveToStorage(nodes, edges, get().balance);
  },

  autoLayout: () => {
    const { nodes, edges } = get();
    // Kahn's algorithm for topological sort + tier assignment
    const inDegree = {};
    const adj = {};
    nodes.forEach((n) => { inDegree[n.id] = 0; adj[n.id] = []; });
    edges.forEach((e) => { inDegree[e.target]++; adj[e.source].push(e.target); });

    const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const tier = {};
    queue.forEach((id) => (tier[id] = 0));

    while (queue.length) {
      const cur = queue.shift();
      adj[cur].forEach((next) => {
        tier[next] = Math.max(tier[next] || 0, (tier[cur] || 0) + 1);
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      });
    }

    const tierGroups = {};
    nodes.forEach((n) => {
      const t = tier[n.id] || 0;
      if (!tierGroups[t]) tierGroups[t] = [];
      tierGroups[t].push(n.id);
    });

    const X_GAP = 400;
    const Y_GAP = 180;
    const updated = nodes.map((n) => {
      const t = tier[n.id] || 0;
      const group = tierGroups[t];
      const idx = group.indexOf(n.id);
      const totalH = (group.length - 1) * Y_GAP;
      return {
        ...n,
        position: {
          x: 80 + t * X_GAP,
          y: 100 + idx * Y_GAP - totalH / 2 + 300,
        },
      };
    });

    set({ nodes: updated });
    saveToStorage(updated, edges, get().balance);
  },
}));
