import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';

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
  { id: 'e1-3', source: '1', target: '3', type: 'smart' },
  { id: 'e2-3', source: '2', target: '3', type: 'smart' },
  { id: 'e3-5', source: '3', target: '5', type: 'smart' },
  { id: 'e4-5', source: '4', target: '5', type: 'smart' },
];

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
    const edges = addEdge({ ...connection, type: 'smart' }, get().edges);
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

  autoLayout: async () => {
    const { nodes, edges } = get();
    const elk = new ELK();

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.layered.spacing.nodeNodeBetweenLayers': '320',
        'elk.spacing.nodeNode': '100',
      },
      children: nodes.map((n) => ({
        id: n.id,
        width:  n.measured?.width  ?? 240,
        height: n.measured?.height ?? 140,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    const laid = await elk.layout(graph);

    const posMap = {};
    for (const child of laid.children) posMap[child.id] = { x: child.x, y: child.y };

    const updated = nodes.map((n) => ({
      ...n,
      position: posMap[n.id] ?? n.position,
    }));

    set({ nodes: updated });
    saveToStorage(updated, edges, get().balance);
  },
}));
